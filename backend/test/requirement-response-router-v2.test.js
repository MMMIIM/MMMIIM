import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV2,
  RESPONSE_ROUTER_V2_VERSION,
  RESPONSE_ROUTER_V2_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2.js';

const project = (text, extra = {}) => projectRequirementResponseV2({
  canonical_requirement_id: 'V2-FIXTURE',
  requirement_text: text,
  ...extra
});

test('V2 identity and existing product capability stay evidence-bound', () => {
  const result = project('所投数据库产品支持 PostgreSQL 兼容接口');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V2_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V2_IMPLEMENTATION_ID);
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
  assert.equal(result.response_required, true);
});

test('product quantitative performance is evidence with high risk', () => {
  const result = project('网络交换机转发性能不低于6.4Tbps');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.risk_tier, 'HIGH');
  assert.equal(result.evidence_dependency, true);
});

test('qualification and certification retain enterprise evidence authority', () => {
  const result = project('投标人具有 ISO 27001 信息安全管理体系认证，须提供证书复印件');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
  assert.equal(result.secondary_dependencies.includes('PROOF_DOCUMENT'), true);
});

test('future staffing and SLA are commitments, not existing facts', () => {
  const result = project('中标后投入不少于5名人员并提供7×24服务响应');
  assert.equal(result.response_mode, 'COMMITMENT');
  assert.equal(result.evidence_dependency, false);
  assert.equal(result.risk_tier, 'HIGH');
  assert.equal(result.human_required, true);
});

test('project architecture and implementation method route to solution', () => {
  const result = project('投标人应提交系统部署架构与项目实施方案');
  assert.equal(result.response_mode, 'SOLUTION');
  assert.equal(result.evidence_dependency, false);
  assert.equal(result.risk_tier, 'LOW');
});

test('bid eligibility and true invalid-bid consequence are P0 compliance', () => {
  const result = project('未满足资格要求则投标无效');
  assert.equal(result.response_mode, 'COMPLIANCE');
  assert.equal(result.risk_tier, 'P0');
  assert.equal(result.human_required, true);
  assert.equal(result.response_required, true);
});

test('submission signature and ordinary process are compliance without automatic P0', () => {
  const submission = project('投标文件须加盖公章并在投标截止前上传');
  assert.equal(submission.response_mode, 'COMPLIANCE');
  assert.equal(submission.risk_tier, 'MEDIUM');
  const process = project('投标人认为招标文件有倾向性可以提出质疑');
  assert.equal(process.response_mode, 'COMPLIANCE');
  assert.equal(process.risk_tier, 'MEDIUM');
  assert.equal(process.response_required, false);
});

test('proof documents remain secondary to substantive capability', () => {
  const result = project('所投操作系统支持强制访问控制，须提供功能截图并加盖公章');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
  assert.equal(result.secondary_dependencies.includes('PROOF_DOCUMENT'), true);
});

test('response_required is explicit and independent from response mode', () => {
  const result = project('以上内容仅供参考，无需响应');
  assert.equal(result.response_required, false);
  assert.notEqual(result.response_mode, 'NEED_REVIEW');
});

test('scoring is cross-cutting and does not grant a mode or authority', () => {
  const result = project('每提供一个类似项目案例得3分，最多得9分');
  assert.equal(result.is_scoring_related, true);
  assert.equal(result.response_role, 'SCORING');
  assert.equal(result.response_required, true);
  assert.equal(result.secondary_dependencies.includes('PROOF_DOCUMENT'), true);
});

test('projection is deterministic and does not mutate input', () => {
  const input = { canonical_requirement_id: 'V2-1', requirement_text: '提供技术架构方案', source_refs: ['S-1'] };
  const before = JSON.stringify(input);
  assert.deepEqual(projectRequirementResponseV2(input), projectRequirementResponseV2(input));
  assert.equal(JSON.stringify(input), before);
});
