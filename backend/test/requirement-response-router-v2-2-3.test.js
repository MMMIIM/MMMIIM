import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV223,
  RESPONSE_ROUTER_V223_VERSION,
  RESPONSE_ROUTER_V223_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-2-3.js';

const route = (requirement_text, category = 'other', extra = {}) =>
  projectRequirementResponseV223({ requirement_text, category, ...extra });

test('V2.2.3 exposes a distinct implementation identity', () => {
  const result = route('项目应提交总体技术方案。', 'solution');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V223_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V223_IMPLEMENTATION_ID);
});

test('mandatory bidder actions are response-required', () => {
  for (const text of [
    '投标人应在截止时间前登录开标大厅完成文件解密。',
    '投标文件须使用中文并加盖公章。',
    '投标人须提供满足指标的产品。',
    '中标后应提供项目服务并维护系统。'
  ]) assert.equal(route(text, 'compliance').response_required, true);
});

test('optional objection or buyer-side procedures remain not response-required', () => {
  for (const text of [
    '供应商可以提出质疑或异议。',
    '采购人可以安排现场踏勘。',
    '投标人可以选择等效标准。'
  ]) assert.equal(route(text, 'other').response_required, false);
});

test('explicit scoring points and criteria are scoring-related', () => {
  for (const text of [
    '每项2分，共计4项。',
    '★为关键指标，不满足不得分。',
    '评分标准按方案完整性计分。'
  ]) assert.equal(route(text, 'technical').is_scoring_related, true);
});

test('project design remains Solution', () => {
  for (const text of [
    '投标人须提供国产化适配方案，方案内容包括数据迁移。',
    '投标人需提供有效的安全保密措施，确保平台安全运行。',
    '系统应提供全媒体坐席首页门户和运营统计报表。',
    '项目实施方案应包括供货、安装、适配和进度控制。'
  ]) assert.equal(route(text, 'technical').response_mode, 'SOLUTION');
});

test('post-award performance and confidentiality obligations are Commitment', () => {
  for (const text of [
    '保密信息披露范围应严格限制在确有必要的工作人员范围内。',
    '向工作人员披露保密信息前应开展保密教育并签署保密协议。',
    '中标后应缴纳履约保证金并承担合同义务。',
    '乙方应承担合同通知不及时造成的法律责任。'
  ]) assert.equal(route(text, 'contractual').response_mode, 'COMMITMENT');
});

test('documentation and certification proof are Evidence', () => {
  const documentation = route('供应商应提供软件开发参考文档和API文档。', 'functional');
  assert.equal(documentation.response_mode, 'EVIDENCE');
  assert.equal(documentation.evidence_dependency, true);
  const certification = route('投标人须提供有效认证证书复印件，每项0.5分。', 'security');
  assert.equal(certification.response_mode, 'EVIDENCE');
  assert.equal(certification.evidence_dependency, true);
});

test('bid-price composition is Compliance', () => {
  const result = route('投标报价应包含交货、安装调试、售后和培训等全部费用。', 'other');
  assert.equal(result.response_mode, 'COMPLIANCE');
});

test('mixed personnel qualification and future service stays NEED_REVIEW with evidence dependency', () => {
  const result = route('实施团队人员须具备三年经验，并免费提供设备搬迁服务。', 'implementation');
  assert.equal(result.response_mode, 'NEED_REVIEW');
  assert.equal(result.evidence_dependency, true);
  assert.equal(result.human_required, true);
});

test('V2.2.3 remains deterministic and does not consult identifiers', () => {
  const input = { requirement_text: '系统应支持数据备份与恢复。', category: 'technical', requirement_id: 'X' };
  assert.deepEqual(projectRequirementResponseV223(input), projectRequirementResponseV223(input));
});
