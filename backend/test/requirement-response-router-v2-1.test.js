import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV21,
  RESPONSE_ROUTER_V21_VERSION,
  RESPONSE_ROUTER_V21_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-1.js';

const project = (text, extra = {}) => projectRequirementResponseV21({
  canonical_requirement_id: 'V21-SYNTHETIC',
  requirement_text: text,
  ...extra
});

test('V2.1 keeps a stable versioned identity without replacing V2', () => {
  const result = project('投标人应提供项目实施方案');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V21_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V21_IMPLEMENTATION_ID);
});

test('pre-award eligibility and qualification remain compliance', () => {
  const licence = project('投标人须具备有效营业执照及税务登记证明，未满足资格要求则投标无效');
  assert.equal(licence.response_mode, 'COMPLIANCE');
  assert.equal(licence.risk_tier, 'P0');
  assert.equal(licence.evidence_dependency, true);

  const related = project('单位负责人存在直接控股关系的供应商不得参加本项目投标');
  assert.equal(related.response_mode, 'COMPLIANCE');
  assert.equal(related.risk_tier, 'P0');

  const seal = project('投标文件须加盖公章并由法定代表人签字');
  assert.equal(seal.response_mode, 'COMPLIANCE');
  assert.equal(seal.risk_tier, 'MEDIUM');
});

test('offered product and enterprise facts are evidence, not solution', () => {
  assert.equal(project('所投服务器处理器主频不低于3.2GHz').response_mode, 'EVIDENCE');
  assert.equal(project('球型摄像机水平视场角60°，水平速度不低于210°/s').response_mode, 'EVIDENCE');
  assert.equal(project('所投软件兼容 Linux 与 PostgreSQL 数据库').response_mode, 'EVIDENCE');
  assert.equal(project('企业已取得 ISO 27001 信息安全管理体系认证').response_mode, 'EVIDENCE');
  assert.equal(project('企业完成过三个同类项目案例').response_mode, 'EVIDENCE');
});

test('project design and implementation remain solution', () => {
  for (const text of [
    '本项目应提交系统总体架构设计方案',
    '项目实施阶段制定数据迁移与联调方法',
    '系统集成应设计跨平台接口流程'
  ]) {
    const result = project(text);
    assert.equal(result.response_mode, 'SOLUTION');
    assert.equal(result.evidence_dependency, false);
  }
});

test('post-award staffing, SLA, warranty and damages are commitments', () => {
  for (const text of [
    '中标后安排不少于5名项目人员驻场服务',
    '合同签订后提供7×24小时故障响应，响应时间不超过2小时',
    '质保期内负责设备维修和软件维护',
    '合同履行期间按约缴纳履约保证金，逾期承担违约金'
  ]) {
    const result = project(text);
    assert.equal(result.response_mode, 'COMMITMENT');
    assert.equal(result.risk_tier === 'HIGH' || result.risk_tier === 'P0', true);
  }
});

test('proof documents are secondary and personnel credential differs from assignment', () => {
  const proof = project('所投操作系统支持国产化适配，须提供检测报告复印件');
  assert.equal(proof.response_mode, 'EVIDENCE');
  assert.equal(proof.evidence_dependency, true);
  assert.equal(proof.secondary_dependencies.includes('PROOF_DOCUMENT'), true);

  assert.equal(project('项目负责人具有高级工程师证书').response_mode, 'EVIDENCE');
  assert.equal(project('中标后安排项目负责人驻场').response_mode, 'COMMITMENT');
});

test('mixed evidence, solution and commitment abstains conservatively', () => {
  const result = project('现有产品支持统一认证，本项目设计集成方案，中标后承诺提供驻场服务');
  assert.equal(result.response_mode, 'NEED_REVIEW');
  assert.equal(result.human_required, true);
});

test('informational context is not a required response', () => {
  const result = project('本段内容仅供背景参考，无需投标人响应');
  assert.equal(result.response_required, false);
  assert.equal(result.response_mode, 'SOLUTION');
});

test('explicitly incomplete boundary fragments abstain without case-specific rules', () => {
  for (const text of [
    '有关信息以及补充条款等，但应当在必要范围内执行',
    '投标人不得以任何方式进行必要的澄清、说明或者补正的情形除外'
  ]) {
    assert.equal(project(text).response_mode, 'NEED_REVIEW');
    assert.equal(project(text).human_required, true);
  }
});

test('projection is deterministic, read-only and keeps scoring cross-cutting', () => {
  const input = { canonical_requirement_id: 'V21-1', requirement_text: '每提供一个类似项目案例得2分', source_refs: ['S-1'] };
  const before = JSON.stringify(input);
  const first = projectRequirementResponseV21(input);
  const second = projectRequirementResponseV21(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
  assert.equal(first.is_scoring_related, true);
});
