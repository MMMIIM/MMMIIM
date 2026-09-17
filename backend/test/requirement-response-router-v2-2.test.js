import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectRequirementResponseV22,
  RESPONSE_ROUTER_V22_VERSION,
  RESPONSE_ROUTER_V22_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-2.js';

const project = (text, extra = {}) => projectRequirementResponseV22({
  canonical_requirement_id: 'V22-FIXTURE',
  requirement_text: text,
  ...extra
});

test('V2.2 has a distinct deterministic implementation identity', () => {
  const result = project('本项目应提交总体技术方案');
  assert.equal(result.projection_version, RESPONSE_ROUTER_V22_VERSION);
  assert.equal(result.implementation_id, RESPONSE_ROUTER_V22_IMPLEMENTATION_ID);
});

test('existing product capability is evidence even when it uses 提供 or 支持', () => {
  for (const text of [
    '提供图形化管理数据的备份、还原和恢复功能',
    '支持Oracle数据库语法及NLS_NUMERIC_CHARACTERS参数',
    '支持OpenSSL及PKCS#7证书并须提供功能测试截图',
    '所投数据库兼容PostgreSQL并支持标准接口'
  ]) {
    const result = project(text, { category: 'technical' });
    assert.equal(result.response_mode, 'EVIDENCE', text);
    assert.equal(result.evidence_dependency, true, text);
  }
});

test('product nouns containing 服务器/处理器 do not trigger service or SLA heuristics', () => {
  const result = project('所投服务器处理器主频不低于3.2GHz', { category: 'technical' });
  assert.equal(result.response_mode, 'EVIDENCE');
  assert.equal(result.evidence_dependency, true);
});

test('future SLA, warranty and maintenance obligations are commitments', () => {
  for (const text of [
    '中标后提供7×24小时故障响应，2小时内解决',
    '质保期内负责设备维修和软件维护',
    '合同履行期间提供一年原厂保修和备件服务',
    '应每月开展软件巡检并提交巡检报告'
  ]) {
    const result = project(text, { category: 'service' });
    assert.equal(result.response_mode, 'COMMITMENT', text);
    assert.equal(result.evidence_dependency, false, text);
  }
});

test('existing enterprise service system is evidence, not a future promise', () => {
  for (const text of [
    '投标人必须有完善的技术支持服务体系和服务团队',
    '企业已建立全国技术服务体系，为客户提供原厂中文服务'
  ]) {
    const result = project(text, { category: 'service' });
    assert.equal(result.response_mode, 'EVIDENCE', text);
    assert.equal(result.evidence_dependency, true, text);
  }
});

test('compliance document actions do not create enterprise evidence dependency', () => {
  for (const text of [
    '投标人须提前办理CA数字证书并使用电子投标文件上传',
    '原版外文证书须提供中文翻译文件并加盖投标人公章',
    '投标时按照规定提供承诺函，无需再提交证明材料'
  ]) {
    const result = project(text, { category: 'contractual' });
    assert.equal(result.response_mode, 'COMPLIANCE', text);
    assert.equal(result.evidence_dependency, false, text);
  }
});

test('future commitment containing 提供/支持/服务 does not become evidence', () => {
  const result = project('操作系统厂商提供工作日每日不少于8h技术支持服务', { category: 'service' });
  assert.equal(result.response_mode, 'COMMITMENT');
  assert.equal(result.evidence_dependency, false);
});

test('mixed existing capability and future obligation abstains', () => {
  const result = project('现有产品支持统一认证，本项目设计集成方案，中标后承诺提供驻场服务');
  assert.equal(result.response_mode, 'NEED_REVIEW');
  assert.equal(result.human_required, true);
});

test('P0 compliance remains fail-closed', () => {
  const result = project('未满足资格要求则投标无效');
  assert.equal(result.response_mode, 'COMPLIANCE');
  assert.equal(result.risk_tier, 'P0');
  assert.equal(result.human_required, true);
});

test('projection is deterministic and does not mutate input', () => {
  const input = { canonical_requirement_id: 'V22-1', requirement_text: '中标后提供维护服务', source_refs: ['S-1'] };
  const before = JSON.stringify(input);
  assert.deepEqual(projectRequirementResponseV22(input), projectRequirementResponseV22(input));
  assert.equal(JSON.stringify(input), before);
});
