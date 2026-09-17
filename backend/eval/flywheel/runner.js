#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildDirtyWorktreeIdentity } from '../../src/eval/flywheel/identity.js';
import { createEvalRun, loadEvalRun } from '../../src/eval/flywheel/run-registry.js';
import { buildRequirementTrace, linkCanonicalRequirements } from '../../src/eval/flywheel/adapters/requirement.js';
import { runDeterministicEvaluators } from '../../src/eval/flywheel/deterministic-evaluator.js';
import { importBadCaseLedger, persistBadCases } from '../../src/eval/flywheel/badcase-registry.js';
import { buildArtifactManifest, snapshotArtifact } from '../../src/eval/flywheel/artifact-snapshot.js';
import { persistBaselineFailures } from '../../src/eval/flywheel/known-baseline-registry.js';
import { hashJson, sha256 } from '../../src/eval/flywheel/contract.js';
import { runRegression } from '../../src/eval/flywheel/regression-runner.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(MODULE_DIR, '../../..');
const DEFAULT_FLYWHEEL_DIR = path.join(ROOT, 'docs/eval/flywheel');
const P0_SOURCE = path.join(ROOT, 'docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const P0_SOURCE_SHA = 'sha256:9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const PRODUCTION_DIR = path.join(ROOT, 'docs/eval/requirement-production-core6-20260911');
const TENDER_EXPORTS = Object.freeze({
  'JY-001': 'JY-001.production-requirements.json',
  'TB-003': 'TB-003.production-requirements.json',
  'TB-006': 'TB-006.production-requirements.json',
  'FAST-01': 'FAST-01.production-requirements.json',
  'FAST-04': 'FAST-04.production-requirements.json',
  'FAST-WATER-01': 'FAST-WATER-01.production-requirements.json'
});

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2).replaceAll('-', '_');
    out[key] = argv[index + 1]?.startsWith('--') ? true : argv[index + 1];
    if (out[key] !== true) index += 1;
  }
  return out;
}

function gitText(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }); } catch { return ''; }
}

function worktreeIdentity() {
  const status = gitText(['status', '--short']);
  const diff = gitText(['diff', '--no-ext-diff']);
  const untracked = gitText(['ls-files', '--others', '--exclude-standard']);
  return buildDirtyWorktreeIdentity({
    gitHead: gitText(['rev-parse', 'HEAD']).trim() || null,
    statusText: status,
    diffText: diff,
    untrackedManifest: untracked
  });
}

function sourceCorpusIdentity(sourcePath) {
  const bytes = fs.readFileSync(sourcePath);
  return { id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1', version: 'v1', sha256: `sha256:${sha256(bytes)}` };
}

function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

function productionIndex() {
  const index = new Map();
  for (const [tender, fileName] of Object.entries(TENDER_EXPORTS)) {
    const filePath = path.join(PRODUCTION_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    const artifact = loadJson(filePath);
    index.set(tender, artifact);
  }
  return index;
}

function buildP0TraceRows({ sourcePath = P0_SOURCE, evalRunId } = {}) {
  const source = loadJson(sourcePath);
  if (!Array.isArray(source.atoms) || source.atoms.length !== 487) throw new Error(`P0_SOURCE_ATOM_COUNT_MISMATCH:${source.atoms?.length || 0}`);
  const exports = productionIndex();
  const sourceHashByTender = source.source_sha256 || {};
  return source.atoms.map((atom) => {
    const tender = atom.tender;
    const artifact = exports.get(tender);
    const linkedArtifacts = linkCanonicalRequirements({ atom, requirements: artifact?.requirements || [] });
    const linkedIds = linkedArtifacts.map((item) => item.requirement_id).filter(Boolean);
    const sourceRefs = [...new Set(linkedArtifacts.flatMap((item) => item.source_refs || []))];
    const linkedSourceHashes = [...new Set(linkedArtifacts.map((item) => item.source_hash).filter(Boolean))];
    const chunkNumbers = [...new Set(linkedArtifacts.map((item) => item.source_span?.chunk_number).filter(Boolean))];
    const methodCounts = linkedArtifacts.reduce((counts, item) => {
      counts[item.link_method] = (counts[item.link_method] || 0) + 1;
      return counts;
    }, {});
    const canonicalStage = linkedArtifacts.length ? {
      canonical_requirement_id: linkedIds[0] || null,
      canonical_requirement_ids: linkedIds,
      canonical_link_count: linkedArtifacts.length,
      linked_artifacts: linkedArtifacts,
      project_id: artifact.project_id,
      source_hash: linkedSourceHashes.length === 1 ? linkedSourceHashes[0] : null,
      source_refs: sourceRefs,
      source_verified: linkedArtifacts.every((item) => item.source_verified === true),
      mechanical_link_methods: [...new Set(linkedArtifacts.map((item) => item.link_method))],
      mechanical_link_method_counts: methodCounts
    } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND', canonical_link_count: 0, linked_artifacts: [] };
    const chunkStage = linkedArtifacts.length ? {
      chunk_numbers: chunkNumbers,
      chunk_count: chunkNumbers.length,
      source_span_valid: linkedArtifacts.every((item) => item.source_span?.page_start !== null),
      reconstructable: true,
      source_hashes: linkedSourceHashes
    } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND' };
    const sourceResolutionStage = linkedArtifacts.length ? {
      source_refs: sourceRefs,
      source_hashes: linkedSourceHashes,
      source_page_start: Math.min(...linkedArtifacts.map((item) => item.source_page_start).filter(Number.isFinite)),
      source_page_end: Math.max(...linkedArtifacts.map((item) => item.source_page_end).filter(Number.isFinite)),
      source_verified: linkedArtifacts.every((item) => item.source_verified === true),
      source_resolution_status: linkedArtifacts.every((item) => item.source_verified === true) ? 'verified' : 'unresolved'
    } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND' };
    const trace = buildRequirementTrace({
      evalRunId,
      caseId: atom.atom_id,
      source: { atom_id: atom.atom_id, tender_id: tender, source_hash: sourceHashByTender[tender], source_truth_sha256: P0_SOURCE_SHA, text: atom.atomic_requirement },
      expected: { source_truth_atom_id: atom.atom_id },
      actual: linkedArtifacts.length ? { linked_artifacts: linkedArtifacts, text: linkedArtifacts.map((item) => item.requirement_text).filter(Boolean).join('\n') } : null,
      stages: {
        source: { atom_id: atom.atom_id, tender_id: tender, source_hash: sourceHashByTender[tender] },
        section: { section_id: atom.page ? `page:${atom.page}` : null },
        chunk: chunkStage,
        provider_input: null,
        raw_candidate: null,
        normalization: null,
        source_resolution: sourceResolutionStage,
        canonical_requirement: canonicalStage
      }
    });
    return {
      atom_id: atom.atom_id,
      tender_id: tender,
      risk_tier: atom.risk_tier || 'P0',
      source_truth_sha256: P0_SOURCE_SHA,
      production_run_id: artifact?.run_id || null,
      trace
    };
  });
}

function ensureRun({ runId, sourcePath = P0_SOURCE, partition = 'TARGETED_BADCASE', datasetId = 'V43_P0_SOURCE_TRUTH_487' } = {}) {
  const git = worktreeIdentity();
  const sourceCorpus = sourceCorpusIdentity(sourcePath);
  const run = createEvalRun({
    eval_run_id: runId || `V43-FLYWHEEL-${Date.now()}`,
    module: 'requirement',
    dataset_id: datasetId,
    dataset_partition: partition,
    created_at: new Date().toISOString(),
    ...git,
    source_corpus: sourceCorpus,
    gold_or_source_truth: { id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1', version: 'v1', sha256: sourceCorpus.sha256, semantic_status: 'FROZEN' },
    production_artifact_identity: { run_id: 'V43-CORE6-20260911', artifact_id: 'docs/eval/requirement-production-core6-20260911', sha256: null },
    contract_versions: { prompt: null, schema: null, task: 'requirement_extraction', rules: { tracer: 'v1' } },
    provider_model: { provider: null, model: null, endpoint_category: null },
    evaluator_version: 'v43-flywheel-v1'
  }, { rootDir: DEFAULT_FLYWHEEL_DIR });
  return run;
}

function traceCommand(options) {
  if (!fs.existsSync(options.source || P0_SOURCE)) throw new Error('SOURCE_ARTIFACT_NOT_FOUND');
  const run = ensureRun({ runId: options.run, sourcePath: options.source || P0_SOURCE, partition: options.partition || 'TARGETED_BADCASE', datasetId: options.dataset || 'V43_P0_SOURCE_TRUTH_487' });
  const runDir = path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id);
  const rows = buildP0TraceRows({ sourcePath: options.source || P0_SOURCE, evalRunId: run.eval_run_id });
  const tracePath = path.join(runDir, 'V43_P0_487_PROVENANCE_TRACE_INDEX.json');
  fs.writeFileSync(tracePath, `${JSON.stringify({ artifact_type: 'V43_P0_487_PROVENANCE_TRACE_INDEX', artifact_version: 'v1', eval_run_id: run.eval_run_id, source_truth_sha256: P0_SOURCE_SHA, atom_count: rows.length, unique_atom_count: new Set(rows.map((row) => row.atom_id)).size, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, rows }, null, 2)}\n`, 'utf8');
  const artifact = snapshotArtifact({ filePath: tracePath, producer: 'v43-flywheel-trace', sourceRunId: run.eval_run_id });
  const manifest = buildArtifactManifest([artifact]);
  fs.writeFileSync(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { run, tracePath, atom_count: rows.length, unique_atom_count: new Set(rows.map((row) => row.atom_id)).size, manifest };
}

function evaluateCommand(options) {
  if (!options.run) throw new Error('EVAL_RUN_REQUIRED');
  const run = loadEvalRun(options.run, { rootDir: DEFAULT_FLYWHEEL_DIR });
  const runDir = path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id);
  const tracePath = options.trace || path.join(runDir, 'V43_P0_487_PROVENANCE_TRACE_INDEX.json');
  const input = loadJson(tracePath);
  const rows = input.rows.map((row) => ({ atom_id: row.atom_id, case_id: row.atom_id, observations: runDeterministicEvaluators(row.trace, { source_hash: row.trace.source?.source_hash || null }) }));
  const outputPath = path.join(runDir, 'deterministic-evaluations.json');
  fs.writeFileSync(outputPath, `${JSON.stringify({ artifact_type: 'V43_FLYWHEEL_DETERMINISTIC_EVALUATIONS', artifact_version: 'v1', eval_run_id: run.eval_run_id, provider_calls: 0, llm_calls: 0, rows }, null, 2)}\n`, 'utf8');
  return { run_id: run.eval_run_id, evaluated_case_count: rows.length, output_path: outputPath, fail_count: rows.filter((row) => row.observations.some((item) => item.result === 'FAIL')).length };
}

function importCommand(options) {
  const run = loadEvalRun(options.run, { rootDir: DEFAULT_FLYWHEEL_DIR });
  const store = { rows: [] };
  const result = importBadCaseLedger({ evalRunId: run.eval_run_id, ledgerPath: options.ledger, store });
  if (result.status === 'IMPORTED' || result.status === 'PARTIAL') persistBadCases(store, path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id, 'badcases.json'));
  return result;
}

function regressionCommand(options) {
  if (!options.run) throw new Error('EVAL_RUN_REQUIRED');
  const run = loadEvalRun(options.run, { rootDir: DEFAULT_FLYWHEEL_DIR });
  const casesPath = options.cases ? path.resolve(options.cases) : null;
  let cases = [];
  if (casesPath) {
    if (!fs.existsSync(casesPath)) throw new Error('REGRESSION_CASES_NOT_FOUND');
    const loaded = loadJson(casesPath);
    cases = Array.isArray(loaded) ? loaded : Array.isArray(loaded.rows) ? loaded.rows : [];
  } else if (options.scope && options.scope !== 'targeted') {
    const evaluatedPath = path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id, 'deterministic-evaluations.json');
    if (fs.existsSync(evaluatedPath)) {
      const loaded = loadJson(evaluatedPath);
      cases = Array.isArray(loaded) ? loaded : Array.isArray(loaded.rows) ? loaded.rows : [];
    }
  }
  const caseIds = options.case_ids ? String(options.case_ids).split(',').map((item) => item.trim()).filter(Boolean) : [];
  const scope = options.scope || 'targeted';
  const result = runRegression({
    scope,
    caseIds,
    familyId: options.family_id || null,
    evalDatasetId: run.dataset_id,
    datasetPartition: run.dataset_partition,
    baselineIdentity: run.identity_hash,
    currentIdentity: run.identity_hash,
    cases
  });
  const runDir = path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id);
  const outputPath = path.join(runDir, 'regression-results.json');
  fs.writeFileSync(outputPath, `${JSON.stringify({ artifact_type: 'V43_FLYWHEEL_REGRESSION_RESULTS', artifact_version: 'v1', eval_run_id: run.eval_run_id, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, ...result }, null, 2)}\n`, 'utf8');
  return { ...result, output_path: outputPath, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0 };
}

function summaryCommand(options) {
  const run = loadEvalRun(options.run, { rootDir: DEFAULT_FLYWHEEL_DIR });
  const runDir = path.join(DEFAULT_FLYWHEEL_DIR, run.eval_run_id);
  const files = fs.existsSync(runDir) ? fs.readdirSync(runDir) : [];
  return { eval_run_id: run.eval_run_id, module: run.module, dataset_id: run.dataset_id, dataset_partition: run.dataset_partition, files, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0 };
}

function main() {
  const [command = 'summary', ...rest] = process.argv.slice(2);
  const options = argsOf(rest);
  let result;
  if (command === 'trace') result = traceCommand(options);
  else if (command === 'evaluate') result = evaluateCommand(options);
  else if (command === 'import-badcases') result = importCommand(options);
  else if (command === 'summary') result = summaryCommand(options);
  else if (command === 'regression') result = regressionCommand(options);
  else throw Object.assign(new Error(`Unknown flywheel command: ${command}`), { code: 'UNKNOWN_FLYWHEEL_COMMAND' });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath && invokedPath === modulePath) main();
