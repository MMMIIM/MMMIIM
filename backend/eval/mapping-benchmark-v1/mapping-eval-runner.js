import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadMappingGold } from './mapping-eval-metrics.js';
import { runMappingQualityGate } from './mapping-eval-quality-gate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
export const DEFAULT_RESULT_DIR = path.join(here, 'results');

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return null;
  }
}

export function readGitIdentity() {
  return {
    branch: gitValue(['branch', '--show-current']),
    head: gitValue(['rev-parse', 'HEAD']),
    dirty: Boolean(gitValue(['status', '--porcelain']))
  };
}

function walkJavaScript(directory, fsImpl = fs) {
  const found = [];
  const visit = current => {
    for (const entry of fsImpl.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) found.push(full);
    }
  };
  visit(directory);
  return found;
}

export function assertProductionDoesNotImportEval({ productionRoot = path.join(repoRoot, 'backend', 'src'), fsImpl = fs } = {}) {
  const offending_files = [];
  for (const file of walkJavaScript(productionRoot, fsImpl)) {
    const source = fsImpl.readFileSync(file, 'utf8');
    const importsEval = source.split(/\r?\n/).some(line => {
      const match = line.match(/^\s*import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/) 
        || line.match(/^\s*(?:const|let|var)\s+[^=]+?=\s*require\(\s*['"]([^'"]+)['"]\s*\)/);
      return Boolean(match && /(?:^|[\\/])eval(?:[\\/]|$)/i.test(match[1]));
    });
    if (importsEval) offending_files.push(path.relative(repoRoot, file).replaceAll('\\', '/'));
  }
  return { ok: offending_files.length === 0, offending_files };
}

function assertNoSecrets(value) {
  const sensitiveKey = /^(api[_-]?key|authorization|secret|password|token)$/i;
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (sensitiveKey.test(key)) throw new Error(`EVAL_ARTIFACT_SECRET_FIELD:${key}`);
      visit(child);
    }
  };
  visit(value);
}

export function writeMappingEvalArtifact(report, {
  fsImpl = fs,
  jsonPath = path.join(DEFAULT_RESULT_DIR, `${report.run_id}.json`),
  markdownPath = path.join(DEFAULT_RESULT_DIR, `${report.run_id}.md`)
} = {}) {
  assertNoSecrets(report);
  fsImpl.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fsImpl.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fsImpl.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const gates = report.gates || {};
  const markdown = [
    '# Mapping Eval V1',
    '',
    `- Run: ${report.run_id}`,
    `- Mode: ${report.mode}`,
    `- Gold: ${report.gold?.case_count ?? 'NOT_AVAILABLE'} (${report.gold?.gold_hash || 'UNKNOWN'})`,
    `- Semantic model quality: ${report.semantic_model_quality || 'NOT_MEASURED'}`,
    '',
    '| Gate | Status |',
    '| --- | --- |',
    ...Object.entries(gates).map(([name, value]) => `| ${name} | ${value?.status || 'UNKNOWN'} |`),
    '',
    `- Provider calls: ${report.provider_calls ?? 0}`,
    `- DB writes: ${report.db_writes ?? 0}`,
    '',
    'This artifact separates contract/policy, DB, semantic, and downstream evidence. It is not a model-quality claim unless the semantic gate is explicitly executed.'
  ].join('\n');
  fsImpl.writeFileSync(markdownPath, `${markdown}\n`, 'utf8');
  return { jsonPath, markdownPath };
}

export function parseMode(argv = []) {
  const modeIndex = argv.indexOf('--mode');
  const mode = modeIndex >= 0 ? argv[modeIndex + 1] : 'fast';
  if (!['fast', 'db', 'live', 'release'].includes(mode)) throw new Error(`MAPPING_EVAL_MODE_INVALID:${mode}`);
  return { mode, db: argv.includes('--db') || mode === 'db' || mode === 'release', live: argv.includes('--live') || mode === 'live' || mode === 'release' };
}

export async function runMappingEval({ mode = 'fast', db = false, live = false, gold = loadMappingGold(), evaluator = null, callCounter = { calls: 0 }, now = () => new Date().toISOString(), resultDir = DEFAULT_RESULT_DIR, fsImpl = fs } = {}) {
  const run_id = `mapping-eval-v1-${Date.now()}`;
  const quality = await runMappingQualityGate({ mode: live ? 'live' : mode, db, gold, evaluator, callCounter });
  const report = {
    schema_version: '4.3-mapping-eval-v1',
    run_id,
    generated_at: now(),
    mode,
    scope: mode === 'fast' ? 'offline-contract-policy-downstream' : mode,
    git: readGitIdentity(),
    gold: quality.gates.MAPPING_FAST_GATE.gold,
    evaluator_identity: 'production-mapping-projection-policy-v1',
    execution_policy: { provider_calls: quality.provider_calls, retries: 0, fallback: 0, db_writes: quality.db_writes },
    gates: quality.gates,
    metrics: quality.gates.MAPPING_FAST_GATE.metrics,
    taxonomy: quality.gates.MAPPING_FAST_GATE.taxonomy,
    case_results: quality.gates.MAPPING_FAST_GATE.case_results || [],
    failed_gold_ids: quality.gates.MAPPING_FAST_GATE.failed_gold_ids || [],
    semantic_model_quality: quality.gates.MAPPING_SEMANTIC_GATE.semantic_model_quality || 'NOT_MEASURED',
    provider_calls: quality.provider_calls,
    db_writes: quality.db_writes,
    production_dependency_direction: assertProductionDoesNotImportEval({ fsImpl }),
    artifact_lineage: { gold_file: path.relative(repoRoot, quality.gates.MAPPING_FAST_GATE.gold?.validation ? gold.__gold_file || '' : '').replaceAll('\\', '/'), source: 'backend/eval/requirement-evidence-mapping-v1/gold-cases.json' }
  };
  const paths = writeMappingEvalArtifact(report, { fsImpl, jsonPath: path.join(resultDir, `${run_id}.json`), markdownPath: path.join(resultDir, `${run_id}.md`) });
  return { ...report, result_paths: paths };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseMode(process.argv.slice(2));
  const report = await runMappingEval(options);
  console.log(JSON.stringify({
    status: report.gates.MAPPING_RELEASE_GATE.status,
    mode: report.mode,
    run_id: report.run_id,
    fast_gate: report.gates.MAPPING_FAST_GATE.status,
    db_gate: report.gates.MAPPING_DB_GATE.status,
    semantic_gate: report.gates.MAPPING_SEMANTIC_GATE.status,
    downstream_gate: report.gates.MAPPING_DOWNSTREAM_SAFETY_GATE.status,
    result_paths: report.result_paths
  }));
  if (report.gates.MAPPING_FAST_GATE.status !== 'PASS') process.exitCode = 1;
}
