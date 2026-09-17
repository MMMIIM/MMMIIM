import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEnterpriseFactSourceRole } from '../src/pipeline/enterprise-evidence-source-router.js';

const material = { source_kind: 'synthetic_company_evidence', synthetic_company_evidence: true, claim_permission: false };

test('source role resolves enterprise profile and capability from bounded headings', () => {
  const source = '# 公司概况\n\n## 公司\n澄川数智科技有限公司为示范企业。\n\n## 范围\n测试能力包括接口集成和运维。';
  const profile = resolveEnterpriseFactSourceRole({ candidate: { statement: '澄川数智科技有限公司为示范企业。', subject_name: '澄川数智科技有限公司' }, sourceText: source, material });
  const capability = resolveEnterpriseFactSourceRole({ candidate: { statement: '测试能力包括接口集成和运维。', subject_name: '测试能力' }, sourceText: source, material });
  assert.equal(profile.role, 'ENTERPRISE_PROFILE_ELIGIBLE');
  assert.equal(profile.eligibility, 'ENTERPRISE_FACT_ELIGIBLE');
  assert.equal(capability.role, 'ENTERPRISE_CAPABILITY_ELIGIBLE');
  assert.equal(capability.eligibility, 'ENTERPRISE_FACT_ELIGIBLE');
});

test('official source and governance headings remain non-enterprise authority', () => {
  const source = '## 官方来源 / 依据\n- OFF-U01｜政府采购需求管理办法｜财政部。\n\n## 时效使用规则\n当前性需复核。';
  const reference = resolveEnterpriseFactSourceRole({ candidate: { statement: 'OFF-U01 为政府采购需求管理办法，发布单位为财政部。', subject_name: '政府采购需求管理办法' }, sourceText: source, material });
  const governance = resolveEnterpriseFactSourceRole({ candidate: { statement: '当前性需复核。', subject_name: '当前性' }, sourceText: source, material });
  assert.equal(reference.role, 'REFERENCE_CONTEXT_ONLY');
  assert.equal(reference.eligibility, 'REFERENCE_CONTEXT_ONLY');
  assert.equal(governance.role, 'GOVERNANCE_CONTEXT_ONLY');
  assert.equal(governance.eligibility, 'GOVERNANCE_CONTEXT_ONLY');
});

test('unresolved source role fails closed', () => {
  const result = resolveEnterpriseFactSourceRole({ candidate: { statement: '未分类内容。', subject_name: '未分类内容' }, sourceText: '一段没有标题的内容。', material });
  assert.equal(result.role, 'SOURCE_ROLE_UNKNOWN');
  assert.equal(result.eligibility, 'SOURCE_ROLE_UNKNOWN');
});

test('statement anchor resolves role when subject is a heading or context field', () => {
  const source = '# 权限、安全与审计测试报告\n\n## 测试\n2026-08-01对v3.2测试环境执行账号、角色和登录审计。\n\n## 边界\n不代表通过等保、密评或第三方认证。';
  const testObservation = resolveEnterpriseFactSourceRole({
    candidate: {
      statement: '2026-08-01对v3.2测试环境执行账号、角色和登录审计。',
      subject_name: '权限、安全与审计测试报告',
      entity_mentions: [{ name: '账号' }]
    },
    sourceText: source,
    material
  });
  const boundaryObservation = resolveEnterpriseFactSourceRole({
    candidate: {
      statement: '该测试报告不代表通过等保、密评或第三方认证。',
      subject_name: '权限、安全与审计测试报告',
      status_text: '不代表通过'
    },
    sourceText: source,
    material
  });
  assert.equal(testObservation.role, 'ENTERPRISE_PERFORMANCE_ELIGIBLE');
  assert.equal(testObservation.eligibility, 'ENTERPRISE_FACT_ELIGIBLE');
  assert.equal(boundaryObservation.role, 'ENTERPRISE_CAPABILITY_ELIGIBLE');
  assert.equal(boundaryObservation.eligibility, 'ENTERPRISE_FACT_ELIGIBLE');
});

test('role resolution includes bounded heading context for structured fields', () => {
  const source = '# 运维、SLA与应急服务说明\n\n## 运维\n巡检、告警、故障、升级、备份和复盘。\n\n## 边界\n无真实客户合同，因此不提供可对外使用的7×24、分钟级响应或赔付承诺。\n\n## 官方来源 / 依据\nOFF-U05｜网络安全法。\n\n## 时效使用规则\n当前性需复核。';
  const operations = resolveEnterpriseFactSourceRole({
    candidate: {
      statement: '该文档说明运维工作包含巡检、告警、故障、升级、备份和复盘。',
      subject_name: '运维',
      scope_items: [{ text: '巡检' }, { text: '告警' }, { text: '故障' }, { text: '升级' }, { text: '备份' }, { text: '复盘' }]
    }, sourceText: source, material
  });
  const reference = resolveEnterpriseFactSourceRole({
    candidate: { statement: '该文档将 OFF-U05 网络安全法列为官方来源或依据。', subject_name: 'OFF-U05 网络安全法' }, sourceText: source, material
  });
  const governance = resolveEnterpriseFactSourceRole({
    candidate: { statement: '该文档说明当前性需复核。', subject_name: '时效使用规则', scope_items: [{ text: '当前性需复核' }] }, sourceText: source, material
  });
  assert.equal(operations.eligibility, 'ENTERPRISE_FACT_ELIGIBLE');
  assert.equal(reference.eligibility, 'REFERENCE_CONTEXT_ONLY');
  assert.equal(governance.eligibility, 'GOVERNANCE_CONTEXT_ONLY');
});
