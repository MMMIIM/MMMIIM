import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponse,
  buildComplianceMatrixRow,
  RESPONSE_PROJECTION_VERSION
} from '../src/pipeline/requirement-response-router.js';

const project = (text, extra = {}) => projectRequirementResponse({ canonical_requirement_id: 'FIXTURE-1', requirement_text: text, ...extra });

test('response projection fixtures cover the frozen Wave 1 boundary', () => {
  assert.equal(project('投标人应提供实施方案').response_mode, 'SOLUTION');
  assert.equal(project('投标人须提供ISO27001证书').response_mode, 'EVIDENCE');
  assert.equal(project('中标后提供7×24服务').response_mode, 'COMMITMENT');
  assert.equal(project('不满足则投标无效').response_mode, 'COMPLIANCE');
  assert.equal(project('不满足则投标无效').risk_tier, 'P0');
  const scoringEvidence = project('每提供一个案例得2分');
  assert.equal(scoringEvidence.is_scoring_related, true);
  assert.equal(scoringEvidence.response_mode, 'EVIDENCE');
  assert.equal(scoringEvidence.response_role, 'SCORING');
  const scoringSolution = project('项目实施方案每满足一点得2分');
  assert.equal(scoringSolution.is_scoring_related, true);
  assert.equal(scoringSolution.response_mode, 'SOLUTION');
  assert.equal(project('投标人承诺中标后投入5名人员').response_mode, 'COMMITMENT');
  assert.equal(project('已有5名高级工程师').response_mode, 'EVIDENCE');
  assert.equal(project('数据服务类接口响应时间不得超过1秒').response_mode, 'EVIDENCE');
  assert.equal(project('请结合项目实际情况说明').response_mode, 'NEED_REVIEW');
});

test('P0 compliance has precedence and qualification is not downgraded to solution', () => {
  const item = project('投标人须提供ISO证书，否则投标无效');
  assert.equal(item.response_mode, 'COMPLIANCE');
  assert.equal(item.response_role, 'COMPLIANCE');
  assert.equal(item.risk_tier, 'P0');
  assert.ok(item.secondary_dependencies.includes('ENTERPRISE_EVIDENCE') === false);
  const qualification = project('投标人应具备信息系统安全集成服务资质');
  assert.equal(qualification.response_mode, 'EVIDENCE');
  assert.notEqual(qualification.response_mode, 'SOLUTION');
});

test('commitment does not become enterprise existing fact and mixed clauses retain a dependency', () => {
  const commitment = project('中标后承诺投入5名人员并提供服务');
  assert.equal(commitment.response_mode, 'COMMITMENT');
  assert.equal(commitment.evidence_dependency, false);
  const mixed = project('已有同类项目案例，并承诺中标后提供7×24服务');
  assert.equal(mixed.response_mode, 'EVIDENCE');
  assert.ok(mixed.secondary_dependencies.includes('PROJECT_COMMITMENT'));
  assert.equal(mixed.deep_chain_required, true);
});

test('projection is deterministic, does not mutate input, and matrix uses explicit unknowns', () => {
  const input = { canonical_requirement_id: 'R-1', requirement_text: '提供技术架构方案', source_refs: ['S-1'], mandatory: true };
  const before = JSON.stringify(input);
  const first = projectRequirementResponse(input);
  const second = projectRequirementResponse(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
  assert.equal(first.projection_version, RESPONSE_PROJECTION_VERSION);
  const row = buildComplianceMatrixRow(input, first);
  assert.equal(row.current_evidence_status, 'NOT_EVALUATED');
  assert.equal(row.response_decision_status, 'NOT_EVALUATED');
  assert.deepEqual(row.source_refs, ['S-1']);
});
