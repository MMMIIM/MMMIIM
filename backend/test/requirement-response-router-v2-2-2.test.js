import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV222,
  RESPONSE_ROUTER_V222_VERSION,
  RESPONSE_ROUTER_V222_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-2-2.js';

const route = (requirement_text, category = 'other') =>
  projectRequirementResponseV222({ requirement_text, category });

test('V2.2.2 exposes its implementation identity', () => {
  const result = route('技术方案应说明系统部署与实施方法。', 'solution');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V222_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V222_IMPLEMENTATION_ID);
});

test('future cloud capacity service is Commitment', () => {
  const result = route('项目服务期内应提供云端容量扩容服务。', 'service');
  assert.equal(result.response_mode, 'COMMITMENT');
  assert.equal(result.evidence_dependency, false);
  assert.equal(result.human_required, true);
});

test('future deployment and migration are Commitment', () => {
  assert.equal(route('中标后应完成系统部署和迁移。', 'implementation').response_mode, 'COMMITMENT');
  assert.equal(route('项目实施期间应负责数据迁移。', 'implementation').response_mode, 'COMMITMENT');
});

test('future service and support are Commitment', () => {
  assert.equal(route('合同期内应提供技术支持服务。', 'service').response_mode, 'COMMITMENT');
  assert.equal(route('质保期内应提供故障响应和维护服务。', 'service').response_mode, 'COMMITMENT');
});

test('future confidentiality obligation is Commitment', () => {
  const result = route('合同履行期间乙方应严格保密，不得向第三方披露项目资料。', 'contractual');
  assert.equal(result.response_mode, 'COMMITMENT');
  assert.equal(result.evidence_dependency, false);
});

test('future repair and replacement liability is Commitment', () => {
  const result = route('发生产品缺陷时，中标人应负责修理或更换并承担相关费用。', 'service');
  assert.equal(result.response_mode, 'COMMITMENT');
  assert.equal(result.evidence_dependency, false);
});

test('future provider and staff identity is Commitment', () => {
  assert.equal(route('项目服务由原厂正式员工提供。', 'service').response_mode, 'COMMITMENT');
  assert.equal(route('项目实施期间应配备具有经验的技术人员。', 'implementation').response_mode, 'COMMITMENT');
});

test('existing IP ownership or authorization is Evidence', () => {
  const result = route('投标人拥有所供软件的知识产权或已取得合法授权。', 'technical');
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
});

test('existing product functionality and compatibility are Evidence', () => {
  assert.equal(route('产品支持多租户功能。', 'technical').response_mode, 'EVIDENCE');
  assert.equal(route('产品兼容Oracle数据库。', 'technical').response_mode, 'EVIDENCE');
});

test('certificate-backed and screenshot-backed capability are Evidence', () => {
  assert.equal(route('产品已取得安全认证证书。', 'security').response_mode, 'EVIDENCE');
  assert.equal(route('产品支持报表功能并提供功能截图。', 'technical').response_mode, 'EVIDENCE');
});

test('alternative standard and equivalent product rule is Compliance', () => {
  const result = route('投标人可以采用不低于技术规格要求的替代标准或等效产品。', 'compliance');
  assert.equal(result.response_mode, 'COMPLIANCE');
  assert.equal(result.evidence_dependency, false);
});

test('P0 bid invalidity and major contract liability retain human gate', () => {
  const invalidity = route('不符合资格条件的投标按无效投标处理。', 'compliance');
  assert.equal(invalidity.response_mode, 'COMPLIANCE');
  assert.equal(invalidity.risk_tier, 'P0');
  assert.equal(invalidity.human_required, true);

  const liability = route('重大违约时甲方有权解除合同并要求乙方承担全部赔偿责任。', 'contractual');
  assert.equal(liability.risk_tier, 'P0');
  assert.equal(liability.human_required, true);
  assert.ok(['COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW'].includes(liability.response_mode));
});

test('P0 intellectual-property and termination liability are commitment-gated', () => {
  const ip = route('中标人保证所供产品不侵犯第三方知识产权并承担由此引起的经济和法律责任。', 'contractual');
  assert.equal(ip.response_mode, 'COMMITMENT');
  assert.equal(ip.risk_tier, 'P0');
  assert.equal(ip.human_required, true);

  const termination = route('若货物为假冒伪劣产品，乙方应承担处罚并赔偿因此造成的损失。', 'contractual');
  assert.equal(termination.response_mode, 'COMMITMENT');
  assert.equal(termination.risk_tier, 'P0');
  assert.equal(termination.human_required, true);
});

test('P0 bid-formality and financial gates remain compliance-gated', () => {
  const bidBond = route('投标人须按照招标文件规定提交投标保证金。', 'compliance');
  assert.equal(bidBond.response_mode, 'COMPLIANCE');
  assert.equal(bidBond.risk_tier, 'P0');
  assert.equal(bidBond.human_required, true);

  const opening = route('投标人应在投标截止时间前登录开标大厅签到。', 'compliance');
  assert.equal(opening.response_mode, 'COMPLIANCE');
  assert.equal(opening.risk_tier, 'P0');
  assert.equal(opening.human_required, true);
});

test('mixed existing personnel evidence and future free service abstains', () => {
  const result = route('现有人员具备项目经验，中标后提供免费项目服务。', 'service');
  assert.equal(result.response_mode, 'NEED_REVIEW');
  assert.equal(result.human_required, true);
});

test('V2.2.2 remains deterministic and does not consult evaluation identity', () => {
  const input = { requirement_text: '系统应支持数据备份与恢复。', category: 'technical' };
  const first = projectRequirementResponseV222(input);
  const second = projectRequirementResponseV222(input);
  assert.deepEqual(first, second);
  assert.equal(first.requirement_id, null);
});
