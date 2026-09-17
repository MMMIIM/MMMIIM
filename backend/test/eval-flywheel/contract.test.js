import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJson, validateEvalRunInput, validateBadCaseInput } from '../../src/eval/flywheel/contract.js';

const base = {
  eval_run_id: 'run-1', module: 'requirement', dataset_id: 'DATASET-1', dataset_partition: 'CORE6',
  created_at: '2026-09-11T00:00:00.000Z', git_head: 'a'.repeat(40), git_dirty: true,
  git_status_sha256: `sha256:${'b'.repeat(64)}`, git_diff_sha256: `sha256:${'c'.repeat(64)}`, git_untracked_manifest_sha256: `sha256:${'d'.repeat(64)}`,
  source_corpus: { id: 'source', version: 'v1', sha256: `sha256:${'e'.repeat(64)}` },
  gold_or_source_truth: { id: 'gold', version: 'v1', sha256: `sha256:${'e'.repeat(64)}`, semantic_status: 'FROZEN' },
  evaluator_version: 'test-v1'
};

test('EvalRun contract validates dataset and immutable identity fields', () => {
  const result = validateEvalRunInput(base);
  assert.match(result.identity_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.value.dataset_partition, 'CORE6');
  assert.throws(() => validateEvalRunInput({ ...base, dataset_partition: 'FRESH_HOLDOUT', dataset_id: 'CORE6' }), /CORE6/);
  assert.throws(() => validateEvalRunInput({ ...base, api_key: 'secret' }), (error) => error?.code === 'SENSITIVE_REGISTRY_FIELD');
});

test('stable hash ignores object key order', () => {
  assert.equal(hashJson({ a: 1, b: { c: 2 } }), hashJson({ b: { c: 2 }, a: 1 }));
});

test('semantic label requires explicit provenance', () => {
  assert.throws(() => validateBadCaseInput({ badcase_id: 'b', module: 'requirement', eval_run_id: 'r', case_id: 'c', severity: 'P0', semantic_label: 'MISS' }), (error) => error?.code === 'SEMANTIC_LABEL_PROVENANCE_REQUIRED');
});
