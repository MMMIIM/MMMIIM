import test from 'node:test';
import assert from 'node:assert/strict';
import { SemanticGatewayMappingEvaluator } from '../src/pipeline/semantic-gateway-mapping-evaluator.js';
import { buildEvidenceNeedProfile } from '../src/evidence-need-profile-builder.js';

const requirement = {
  requirement_id: 'JY-001:REQ-057',
  text: '事件标准库管理应通过提取多渠道事件字段信息,按对应规则匹配实现事件标准化和标准化库,并制定标准的事件联动接口规范,方便各类专业条线业务系统与智慧城市综合管理平台形成事件联动。',
  requirement_hash: 'c'.repeat(64)
};
const fact = {
  fact_id: 'EFACT-EVAL-30FE5146FFEF789D0D728A62A6C34DA6',
  subject: { type: '产品', name: '澄川事件标准化平台' }, entities: [], fact_status: 'unknown', scopes: ['接口'], quantities: [], validity: { status: 'unknown' }
};
const profile = buildEvidenceNeedProfile({ requirement, responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH' } });

test('Mapping evaluator applies only profile-proven non-applicability before the unchanged six-dimension contract', async () => {
  let payload;
  const evaluator = new SemanticGatewayMappingEvaluator({
    maxAttempts: 1,
    client: { async run(request) {
      payload = JSON.parse(request.task_payload_json);
      return { envelope: { data: { results: [{
        fact_ref: fact.fact_id, decision: 'direct_full',
        dimensions: { subject: 'match', scope: 'match', status: 'unknown', quantity: 'not_applicable', entity: 'not_applicable', validity: 'unknown' }
      }] } } };
    } }
  });

  const result = await evaluator.evaluate({ requirement, facts: [fact], evidenceNeedProfile: profile });
  assert.deepEqual(payload.requirement.evidence_need_profile, {
    profile_hash: profile.profile_hash,
    dimension_applicability: profile.dimension_applicability
  });
  assert.equal(result[0].dimensions.status_match, 'not_applicable');
  assert.equal(result[0].dimensions.validity_match, 'not_applicable');
  assert.equal(result[0].support_level, 'full_support');
});

test('Mapping evaluator refuses profile non-applicability that contradicts a known structured Requirement dimension', async () => {
  const contradictory = { ...profile, dimension_applicability: { ...profile.dimension_applicability, status: 'NOT_APPLICABLE' } };
  const evaluator = new SemanticGatewayMappingEvaluator({
    maxAttempts: 1,
    client: { async run() { return { envelope: { data: { results: [{ fact_ref: fact.fact_id, decision: 'direct_full', dimensions: { subject: 'match', scope: 'match', status: 'unknown', quantity: 'not_applicable', entity: 'not_applicable', validity: 'not_applicable' } }] } } }; } }
  });
  await assert.rejects(
    () => evaluator.evaluate({ requirement: { ...requirement, status: 'certified' }, facts: [fact], evidenceNeedProfile: contradictory }),
    error => error.code === 'EVIDENCE_NEED_PROFILE_CONTRADICTS_REQUIREMENT'
  );
});
