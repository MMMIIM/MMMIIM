import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEvalRun, loadEvalRun } from '../../src/eval/flywheel/run-registry.js';

function input() { return { eval_run_id: 'run-identity', module: 'requirement', dataset_id: 'CORE6-DATASET', dataset_partition: 'CORE6', created_at: '2026-09-11T00:00:00.000Z', git_head: 'a'.repeat(40), git_dirty: false, git_status_sha256: `sha256:${'a'.repeat(64)}`, git_diff_sha256: `sha256:${'b'.repeat(64)}`, git_untracked_manifest_sha256: `sha256:${'c'.repeat(64)}`, source_corpus: { id: 's', version: 'v1', sha256: `sha256:${'d'.repeat(64)}` }, gold_or_source_truth: { id: 'g', version: 'v1', sha256: `sha256:${'d'.repeat(64)}` }, evaluator_version: 'test-v1' }; }

test('EvalRun file registry is immutable and idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flywheel-run-'));
  const first = createEvalRun(input(), { rootDir: root });
  const second = createEvalRun(input(), { rootDir: root });
  assert.equal(first.identity_hash, second.identity_hash);
  assert.equal(loadEvalRun('run-identity', { rootDir: root }).eval_run_id, 'run-identity');
  assert.throws(() => createEvalRun({ ...input(), git_dirty: true }, { rootDir: root }), (error) => error?.code === 'EVAL_RUN_IDENTITY_CONFLICT');
});
