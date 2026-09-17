import test from 'node:test';
import assert from 'node:assert/strict';
import { runRegression } from '../../src/eval/flywheel/regression-runner.js';

test('regression runner preserves case-level outcomes and partition boundaries', () => {
  const result = runRegression({ scope: 'core6', evalDatasetId: 'CORE6-DATASET', datasetPartition: 'CORE6', baselineIdentity: { a: 1 }, currentIdentity: { a: 1 }, cases: [{ case_id: 'c1', observations: [{ result: 'PASS' }] }] });
  assert.equal(result.results[0].status, 'PASS');
  assert.throws(() => runRegression({ scope: 'core6', evalDatasetId: 'HOLDOUT-DATASET', datasetPartition: 'FRESH_HOLDOUT', cases: [] }), (error) => error?.code === 'CORE6_PARTITION_REQUIRED');
  assert.throws(() => runRegression({ scope: 'targeted', evalDatasetId: 'D', datasetPartition: 'OTHER', baselineIdentity: { a: 1 }, currentIdentity: { a: 2 }, cases: [] }), (error) => error?.code === 'REGRESSION_IDENTITY_MISMATCH');
});
