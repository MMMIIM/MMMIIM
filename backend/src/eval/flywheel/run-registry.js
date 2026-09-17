import fs from 'node:fs';
import path from 'node:path';
import { validateEvalRunInput, hashJson, sha256 } from './contract.js';

export function createEvalRun(input = {}, { rootDir = path.join(process.cwd(), 'docs/eval/flywheel') } = {}) {
  const seed = { ...input };
  if (!seed.eval_run_id) seed.eval_run_id = `eval-${sha256(JSON.stringify({ ...seed, eval_run_id: undefined })).slice(0, 20)}`;
  const seedRunDir = path.join(rootDir, seed.eval_run_id);
  seed.artifact_manifest = {
    ...(seed.artifact_manifest || {}),
    path: seed.artifact_manifest?.path || path.relative(process.cwd(), path.join(seedRunDir, 'manifest.json')).replaceAll('\\', '/')
  };
  const { value, identity_hash } = validateEvalRunInput(seed);
  const runDir = path.join(rootDir, value.eval_run_id);
  const runPath = path.join(runDir, 'eval-run.json');
  fs.mkdirSync(runDir, { recursive: true });
  if (fs.existsSync(runPath)) {
    const existing = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    if (existing.identity_hash !== identity_hash) throw Object.assign(new Error('EvalRun identity conflicts with existing immutable run.'), { code: 'EVAL_RUN_IDENTITY_CONFLICT' });
    return existing;
  }
  const record = { ...value, identity_hash };
  fs.writeFileSync(runPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}

export function loadEvalRun(evalRunId, { rootDir = path.join(process.cwd(), 'docs/eval/flywheel') } = {}) {
  const runPath = path.join(rootDir, String(evalRunId), 'eval-run.json');
  if (!fs.existsSync(runPath)) throw Object.assign(new Error(`EvalRun not found: ${evalRunId}`), { code: 'EVAL_RUN_NOT_FOUND' });
  return JSON.parse(fs.readFileSync(runPath, 'utf8'));
}

export function markEvalRunStatus(evalRunId, status, { rootDir = path.join(process.cwd(), 'docs/eval/flywheel') } = {}) {
  const current = loadEvalRun(evalRunId, { rootDir });
  if (current.status !== 'OPEN' && current.status !== status) throw Object.assign(new Error('Completed EvalRun identity is immutable.'), { code: 'EVAL_RUN_IMMUTABLE' });
  const next = { ...current, status };
  fs.writeFileSync(path.join(rootDir, String(evalRunId), 'eval-run.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function evalRunIdentity(record) {
  return hashJson({ ...record, status: undefined, artifact_manifest: undefined, identity_hash: undefined });
}
