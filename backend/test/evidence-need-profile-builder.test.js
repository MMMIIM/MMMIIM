import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvidenceNeedProfile,
  EVIDENCE_NEED_PROFILE_VERSION
} from '../src/evidence-need-profile-builder.js';

const requirement = (id, text, extra = {}) => ({
  requirement_id: id,
  text,
  requirement_hash: 'a'.repeat(64),
  project_id: 'project-eval',
  ...extra
});
test('EvidenceNeedProfile deterministically classifies product capability and preserves REQ-057 non-applicable status/validity', () => {
  const profile = buildEvidenceNeedProfile({
    requirement: requirement('JY-001:REQ-057', '事件标准库管理应通过提取多渠道事件字段信息,按对应规则匹配实现事件标准化和标准化库,并制定标准的事件联动接口规范,方便各类专业条线业务系统与智慧城市综合管理平台形成事件联动。'),
    responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH', response_required: true },
    enterpriseId: 'SYNTH-CHENGCHUAN-001'
  });

  assert.equal(profile.profile_version, EVIDENCE_NEED_PROFILE_VERSION);
  assert.equal(profile.evidence_need_class, 'PRODUCT_CAPABILITY');
  assert.equal(profile.evidence_dependency, 'REQUIRED');
  assert.equal(profile.dimension_applicability.status, 'NOT_APPLICABLE');
  assert.equal(profile.dimension_applicability.validity, 'NOT_APPLICABLE');
  assert.ok(profile.required_dimensions.includes('subject'));
  assert.equal(profile.source_constraints.source_roles[0], 'EVIDENCE_CANDIDATE');
  assert.match(profile.profile_hash, /^[a-f0-9]{64}$/);
});

test('quantitative and certificate/current/expiry signals activate the frozen dimensions', () => {
  const profile = buildEvidenceNeedProfile({
    requirement: requirement('REQ-Q', '投标人须具备有效的 ISO27001 认证证书，证书有效期截至2028年12月31日，并支持不少于5000并发用户。'),
    responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'P0' }
  });

  assert.equal(profile.evidence_need_class, 'QUALIFICATION');
  assert.equal(profile.dimension_applicability.quantity, 'REQUIRED');
  assert.equal(profile.dimension_applicability.status, 'REQUIRED');
  assert.equal(profile.dimension_applicability.validity, 'REQUIRED');
  assert.ok(profile.critical_literals.some(value => value.includes('5000')));
});

test('UNKNOWN is not rewritten as NOT_APPLICABLE when requirement semantics remain ambiguous', () => {
  const profile = buildEvidenceNeedProfile({
    requirement: requirement('REQ-OTHER', '投标人应提供与本项目相关的其他支撑材料。'),
    responseDecision: { response_mode: 'EVIDENCE' }
  });

  assert.equal(profile.evidence_need_class, 'OTHER_EVIDENCE');
  assert.equal(profile.dimension_applicability.status, 'CONDITIONAL');
  assert.equal(profile.dimension_applicability.validity, 'CONDITIONAL');
  assert.equal(profile.dimension_applicability.quantity, 'NOT_APPLICABLE');
});
