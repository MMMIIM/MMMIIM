import test from 'node:test';
import assert from 'node:assert/strict';
import { findFirstMechanicalDivergence, runDeterministicEvaluators } from '../../src/eval/flywheel/deterministic-evaluator.js';
import { buildRequirementTrace } from '../../src/eval/flywheel/adapters/requirement.js';

test('deterministic evaluator reports first mechanical divergence and risk signals', () => {
  const trace = buildRequirementTrace({ evalRunId: 'r', caseId: 'c', source: { tender_id: 'FAST-01', source_hash: 's', text: '响应时间不超过30秒' }, stages: { section: { covered: true }, chunk: { reconstructable: true, source_span_valid: true }, provider_input: null, raw_candidate: { schema_valid: true }, source_resolution: { source_refs: ['C1'], source_verified: true }, canonical_requirement: { canonical_requirement_id: 'REQ', project_id: 'p' } }, actual: { text: '响应时间超过999秒' } });
  const observations = runDeterministicEvaluators(trace, { source_hash: 's' });
  assert.equal(findFirstMechanicalDivergence(trace).stage, 'Provider Input');
  assert.ok(observations.some((row) => row.risk_signals.includes('NUMERIC_TOKEN_CHANGED')));
  assert.equal(observations.some((row) => ['MATCH', 'PARTIAL', 'DISTORTED', 'MISS'].includes(row.result)), false);
});
