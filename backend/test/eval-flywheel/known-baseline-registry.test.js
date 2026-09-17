import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFailureSignature, classifyFailure, recordBaselineFailure } from '../../src/eval/flywheel/known-baseline-registry.js';

test('known baseline registry distinguishes known, environment and new failures', () => {
  const registry = { failures: [] };
  const signature = buildFailureSignature({ testId: 'T1', errorCode: 'E1', message: 'old' });
  recordBaselineFailure({ test_id: 'T1', failure_signature: signature, classification: 'KNOWN_BASELINE_FAILURE' }, registry);
  assert.equal(classifyFailure({ test_id: 'T1', failure_signature: signature }, registry), 'KNOWN_BASELINE_FAILURE');
  assert.equal(classifyFailure({ test_id: 'T2', environmental: true }, registry), 'ENVIRONMENT');
  assert.equal(classifyFailure({ test_id: 'T3' }, registry), 'NEW_TASK_REGRESSION');
});
