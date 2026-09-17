import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV221,
  RESPONSE_ROUTER_V221_VERSION,
  RESPONSE_ROUTER_V221_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-2-1.js';

const route = (requirement_text, category = 'other') => projectRequirementResponseV221({ requirement_text, category });

test('V2.2.1 exposes a stable implementation identity', () => {
  const result = route('技术方案应说明系统部署与实施方法。');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V221_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V221_IMPLEMENTATION_ID);
});

test('bid-stage truthful commitment remains Compliance', () => {
  const result = route('供应商应当遵循诚实信用原则，不得作虚假承诺。');
  assert.equal(result.response_mode, 'COMPLIANCE');
  assert.equal(result.evidence_dependency, false);
});

test('qualification and commitment-letter submission remains Compliance', () => {
  assert.equal(route('投标人须提供资格证明文件。').response_mode, 'COMPLIANCE');
  assert.equal(route('投标人须提交承诺函。').response_mode, 'COMPLIANCE');
});

test('signature and seal obligation remains Compliance', () => {
  assert.equal(route('投标文件须签字并加盖公章。').response_mode, 'COMPLIANCE');
});

test('future service-provider identity is Commitment', () => {
  assert.equal(route('服务由原厂正式员工提供。', 'service').response_mode, 'COMMITMENT');
});

test('future SLA, warranty, maintenance, and staffing are Commitment', () => {
  assert.equal(route('质保期内故障响应时间不超过4小时。', 'service').response_mode, 'COMMITMENT');
  assert.equal(route('项目服务期内提供维护服务。', 'service').response_mode, 'COMMITMENT');
  assert.equal(route('项目实施期间应安排技术人员驻场。', 'service').response_mode, 'COMMITMENT');
});

test('existing enterprise service system is Evidence', () => {
  const result = route('企业具备完善的技术支持服务体系和服务团队。', 'service');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
});

test('offered product capability and compatibility are Evidence', () => {
  assert.equal(route('投标产品支持多租户功能。', 'technical').response_mode, 'EVIDENCE');
  assert.equal(route('产品兼容Oracle数据库。', 'technical').response_mode, 'EVIDENCE');
});

test('explicit screenshot or certificate proof is Evidence when not bid-formality-only', () => {
  const result = route('产品支持国产密码算法，须提供功能测试截图。', 'technical');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
});

test('project design and architecture plan are Solution', () => {
  assert.equal(route('技术方案应说明如何部署和实施。', 'solution').response_mode, 'SOLUTION');
});

test('mixed existing capability and future obligation abstains when candidate is ambiguous', () => {
  const result = route('具备用户服务记录并备有备件，中标后应提供维护。', 'service');
  assert.equal(result.response_mode, 'NEED_REVIEW');
  assert.equal(result.bounded_correction_family, 'MIXED_BOUNDARY');
});

test('future obligation using provide/support/service is not Evidence', () => {
  assert.notEqual(route('中标后应提供故障响应服务。', 'service').response_mode, 'EVIDENCE');
});

test('product capability using provide/support/service is not Commitment', () => {
  assert.equal(route('产品提供数据统计功能。', 'technical').response_mode, 'EVIDENCE');
});

test('P0 compliance remains fail-closed for financial qualification and invalidity', () => {
  const qualification = route('投标人须具有健全的财务会计制度，并提供经审计的财务报告。');
  const invalidity = route('重要技术参数未响应或不满足时，按无效投标处理。');
  assert.equal(qualification.response_mode, 'COMPLIANCE');
  assert.equal(invalidity.response_mode, 'COMPLIANCE');
  assert.ok(['HIGH', 'P0'].includes(invalidity.risk_tier));
});

test('same input is deterministic and does not consult evaluation identifiers', () => {
  const input = { requirement_text: '系统需提供备份恢复功能。', category: 'technical' };
  const first = projectRequirementResponseV221(input);
  const second = projectRequirementResponseV221(input);
  assert.deepEqual(first, second);
  assert.equal(first.requirement_id, null);
});
