import test from 'node:test';
import assert from 'node:assert/strict';
import { projectResponseDecisionV1, deriveReadinessStatus, RESPONSE_DECISION_V1_VERSION } from '../src/pipeline/response-decision-v1.js';

const req = (text, extra = {}) => ({ req_id: extra.req_id || 'REQ-1', text, requirement_category: extra.category || 'technical', ...extra });

test('ResponseDecisionV1 normalizes NEED_REVIEW without creating a fifth mode', () => {
  const decision = projectResponseDecisionV1(req('有关信息以及'));
  assert.equal(decision.requirement_id, 'REQ-1');
  assert.equal(decision.contract_version, RESPONSE_DECISION_V1_VERSION);
  assert.equal(decision.decision_status, 'NEED_REVIEW');
  assert.equal(decision.response_mode, null);
  assert.equal(decision.readiness_status, 'NEED_REVIEW');
});

test('ResponseDecisionV1 keeps four modes and derives fail-closed readiness', () => {
  const solution = projectResponseDecisionV1(req('本项目应提交系统总体架构设计方案'));
  assert.equal(solution.decision_status, 'ROUTED');
  assert.equal(solution.response_mode, 'SOLUTION');
  assert.equal(solution.readiness_status, 'READY_FOR_WRITER');

  const evidence = projectResponseDecisionV1(req('所投服务器处理器主频不低于3.2GHz'));
  assert.equal(evidence.response_mode, 'EVIDENCE');
  assert.equal(evidence.readiness_status, 'EVIDENCE_REQUIRED');

  const commitment = projectResponseDecisionV1(req('中标后安排不少于5名项目人员驻场服务'));
  assert.equal(commitment.response_mode, 'COMMITMENT');
  assert.equal(commitment.readiness_status, 'HUMAN_DECISION_REQUIRED');

  const compliance = projectResponseDecisionV1(req('投标文件须加盖公章并由法定代表人签字'));
  assert.equal(compliance.response_mode, 'COMPLIANCE');
  assert.equal(compliance.readiness_status, 'COMPLIANCE_ACTION_REQUIRED');
});

test('readiness is independent from response_required and authority context', () => {
  assert.equal(deriveReadinessStatus({ response_mode: 'SOLUTION', response_required: false }), 'NO_RESPONSE_REQUIRED');
  assert.equal(deriveReadinessStatus({ response_mode: 'EVIDENCE', response_required: true, authority: { approved_claim_count: 1 } }), 'READY_FOR_WRITER');
  assert.equal(deriveReadinessStatus({ response_mode: 'COMMITMENT', response_required: true, authority: { approved_commitment_count: 1 } }), 'READY_FOR_WRITER');
});
