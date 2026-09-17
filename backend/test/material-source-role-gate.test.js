import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MATERIAL_SOURCE_ROLE_POLICY_VERSION,
  resolveMaterialSourceRole,
  resolveMaterialAuthorityTier
} from '../src/pipeline/material-source-authority-policy.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { EvidenceFactService } from '../src/evidence-fact-service.js';
import { EvidenceService } from '../src/evidence-service.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';
import { MappingCandidateBuilder } from '../src/pipeline/mapping-candidate-builder.js';
import { evaluateEnterpriseClaimV2 } from '../src/pipeline/enterprise-claim-gate-v2.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const MATERIAL = '22222222-2222-4222-8222-222222222222';
const SOURCE = '企业材料记录平台支持 50 用户并发。';
const sha = value => createHash('sha256').update(String(value)).digest('hex');
const actor = { actor_id: 'role-test', actor_type: 'test', source: 'test' };
const authorization = { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) };

const review = (material_type, extra = {}) => ({
  review_id: 'EREVIEW-ROLE', project_id: PROJECT, source_span_id: 'ESPAN-ROLE',
  material_id: MATERIAL, anchor_chunk_id: 'MCH-ROLE', source_text: SOURCE,
  source_text_hash: sha(SOURCE), current_source_text_hash: sha(SOURCE),
  review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable', support_level: 'partial_support', material_type, ...extra
});

const candidate = () => ({
  subject: { type: 'product', name: '平台' }, entities: [], status: 'unknown', scopes: [],
  quantities: [], validity: { status: 'unknown' }, domain_metadata: {}
});

test('material source role policy maps known taxonomy conservatively', () => {
  assert.equal(resolveMaterialSourceRole({ material_type: 'company_profile' }).role, 'REFERENCE_ONLY');
  assert.equal(resolveMaterialSourceRole({ material_type: 'technical_whitepaper' }).role, 'REFERENCE_ONLY');
  assert.equal(resolveMaterialSourceRole({ material_type: 'technical_solution' }).role, 'REFERENCE_ONLY');
  assert.equal(resolveMaterialSourceRole({ material_type: 'unknown-new-type' }).role, 'REFERENCE_ONLY');
  for (const material_type of ['qualification', 'project_case', 'case', 'product_documentation', 'personnel', 'delivery_capability']) {
    const result = resolveMaterialSourceRole({ material_type });
    assert.equal(result.role, 'EVIDENCE_CANDIDATE', material_type);
    assert.equal(result.policy_version, MATERIAL_SOURCE_ROLE_POLICY_VERSION);
  }
});

test('explicit human role is honored for non-synthetic material and diagnostics are stable', () => {
  const result = resolveMaterialSourceRole({ material_type: 'other', explicit_human_role: 'EVIDENCE_CANDIDATE' });
  assert.deepEqual(result, {
    role: 'EVIDENCE_CANDIDATE', reason: 'explicit_human_role', material_type: 'other',
    explicit_human_role: 'EVIDENCE_CANDIDATE', policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION
  });
});

test('synthetic flag does not override the material source role taxonomy', () => {
  const result = resolveMaterialSourceRole({ material_type: 'project_case', synthetic_test_material: true });
  assert.equal(result.role, 'EVIDENCE_CANDIDATE');
  assert.equal(result.reason, 'material_type_evidence_candidate');
  assert.equal(resolveMaterialSourceRole({ material_type: 'technical_solution', synthetic_test_material: true }).role, 'REFERENCE_ONLY');
});

test('synthetic and production authority tiers are separate from source role', () => {
  assert.deepEqual(resolveMaterialAuthorityTier({ material_type: 'project_case', synthetic_test_material: true }), {
    authority: 'SYNTHETIC_EVAL_ONLY',
    authority_tier: 'SYNTHETIC_EVAL_ONLY',
    production_authority: 'NONE',
    synthetic: true
  });
  assert.deepEqual(resolveMaterialAuthorityTier({ material_type: 'project_case', synthetic_test_material: false }), {
    authority: 'REAL_PRODUCTION',
    authority_tier: 'REAL_PRODUCTION',
    production_authority: 'REAL_PRODUCTION',
    synthetic: false
  });
});

test('REFERENCE_ONLY Fact entry is nonfatal and performs no provider or persistence call', async () => {
  let providerCalls = 0;
  let persistenceCalls = 0;
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => review('technical_whitepaper'), upsertEvidenceSourceFactsAtomic: async () => { persistenceCalls += 1; } },
    projectAuthorizationService: authorization,
    extractor: { version: 'role-test', extract: async () => { providerCalls += 1; return [candidate()]; } }
  });
  const result = await service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ROLE', actor });
  assert.equal(result.status, 'FACT_SKIPPED_REFERENCE_ONLY');
  assert.deepEqual(result.facts, []);
  assert.equal(result.source_role, 'REFERENCE_ONLY');
  assert.equal(providerCalls, 0);
  assert.equal(persistenceCalls, 0);
});

test('EVIDENCE_CANDIDATE enters the existing Fact gate', async () => {
  let providerCalls = 0;
  let persistenceCalls = 0;
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => review('project_case'), upsertEvidenceSourceFactsAtomic: async facts => { persistenceCalls += 1; return facts; } },
    projectAuthorizationService: authorization,
    extractor: { version: 'role-test', extract: async () => { providerCalls += 1; return [candidate()]; } }
  });
  const result = await service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ROLE', actor });
  assert.equal(result.facts.length, 1);
  assert.equal(providerCalls, 1);
  assert.equal(persistenceCalls, 1);
});

test('synthetic evidence candidate is blocked by the production Fact boundary', async () => {
  let providerCalls = 0;
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => review('project_case'),
      getCompanyMaterial: async () => ({
        id: MATERIAL, material_type: 'project_case', source_type: 'synthetic_company_evidence',
        synthetic_test_material: true
      })
    },
    projectAuthorizationService: authorization,
    extractor: { version: 'role-test', extract: async () => { providerCalls += 1; return [candidate()]; } }
  });
  const result = await service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ROLE', actor });
  assert.equal(result.status, 'FACT_SKIPPED_SYNTHETIC_PRODUCTION_AUTHORITY');
  assert.equal(result.source_role, 'EVIDENCE_CANDIDATE');
  assert.equal(result.authority, 'SYNTHETIC_EVAL_ONLY');
  assert.equal(providerCalls, 0);
});

test('synthetic evidence candidate is allowed through the existing Fact gate in Eval mode', async () => {
  let providerCalls = 0;
  let persistenceCalls = 0;
  const service = new EvidenceSourceFactService({
    authorityMode: 'SYNTHETIC_EVAL_ONLY',
    repository: {
      getEvidenceReviewForFact: async () => review('project_case'),
      getCompanyMaterial: async () => ({
        id: MATERIAL, material_type: 'project_case', source_type: 'synthetic_company_evidence',
        synthetic_test_material: true
      }),
      upsertEvidenceSourceFactsAtomic: async facts => { persistenceCalls += 1; return facts; }
    },
    projectAuthorizationService: authorization,
    extractor: { version: 'role-test', extract: async () => { providerCalls += 1; return [candidate()]; } }
  });
  const result = await service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ROLE', actor });
  assert.equal(result.facts.length, 1);
  assert.equal(result.source_role, 'EVIDENCE_CANDIDATE');
  assert.equal(result.authority, 'SYNTHETIC_EVAL_ONLY');
  assert.equal(providerCalls, 1);
  assert.equal(persistenceCalls, 1);
});

test('REFERENCE_ONLY Evidence cannot be created for the formal Evidence lane', async () => {
  const repository = {
    getCompanyMaterial: async () => ({ id: MATERIAL, project_id: PROJECT, material_type: 'company_profile', extraction_status: 'succeeded' })
  };
  const service = new EvidenceService({ repository });
  await assert.rejects(
    () => service.create(PROJECT, { material_id: MATERIAL, title: '参考', content: '背景' }),
    error => error.code === 'EVIDENCE_REFERENCE_ONLY_FORBIDDEN'
  );
});

test('legacy Evidence approval resolves material_id before granting authority', async () => {
  const evidenceId = '55555555-5555-4555-8555-555555555555';
  let persisted = false;
  const service = new EvidenceService({ repository: {
    getEvidenceRecord: async () => ({ id: evidenceId, material_id: MATERIAL, metadata: {} }),
    getCompanyMaterial: async () => ({ id: MATERIAL, project_id: PROJECT, material_type: 'company_profile', extraction_status: 'succeeded' }),
    decideEvidence: async () => { persisted = true; return {}; }
  }});
  await assert.rejects(
    () => service.decide(evidenceId, 'approved', { decided_by: 'tester' }),
    error => error.code === 'EVIDENCE_REFERENCE_ONLY_FORBIDDEN'
  );
  assert.equal(persisted, false);
});

test('legacy Evidence Fact mutation cannot create or approve Reference-only authority', async () => {
  const source = {
    id: '33333333-3333-4333-8333-333333333333', project_id: PROJECT,
    material_type: 'company_profile', approval_status: 'approved',
    source_lineage_verified: true, source_text: SOURCE, evidence_scope: [],
    source_location: {}, source_hash: sha(SOURCE), source_material_authority_eligible: true
  };
  const repository = {
    getEvidenceFactSource: async () => source,
    getEvidenceFactByIdentifier: async () => ({ ...source, fact_id: 'EFACT-REF', metadata: {} }),
    decideEvidenceFact: async () => { throw new Error('must not persist Reference-only decision'); }
  };
  const service = new EvidenceFactService({ repository });
  await assert.rejects(
    () => service.create(PROJECT, source.id, { fact_type: 'capability', created_by: 'tester' }),
    error => error.code === 'EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN'
  );
  await assert.rejects(
    () => service.decide('EFACT-REF', 'approved', { reviewed_by: 'tester' }),
    error => error.code === 'EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN'
  );
});

test('Evidence-to-Mapping entry point rejects Reference-only material', async () => {
  const evidenceId = '44444444-4444-4444-8444-444444444444';
  const service = new EvidenceService({ repository: {
    findInvalidConfirmedRequirementIds: async () => [],
    validateEvidenceForMapping: async () => ({
      approval_status: 'approved', source_lineage_verified: true,
      source_material_authority_eligible: true, material_type: 'technical_solution'
    })
  }});
  await assert.rejects(
    () => service.proposeMapping(PROJECT, { evidence_id: evidenceId, requirement_id: 'REQ-1', created_by: 'tester' }),
    error => error.code === 'EVIDENCE_REFERENCE_ONLY_FORBIDDEN'
  );
});

test('canonical Requirement-Evidence-Fact Mapping entry point rejects Reference-only material', async () => {
  const service = new RequirementEvidenceFactMappingService({ repository: {
    getRequirementEvidenceFactMappingContext: async () => ({
      source_material_authority_eligible: true, current_authority: true,
      material_type: 'company_profile', fact_id: 'EFACT-REF'
    }),
    replaceRequirementEvidenceFactMappingAtomic: async () => { throw new Error('must not persist Reference-only mapping'); }
  }});
  await assert.rejects(
    () => service.propose({ projectId: PROJECT, requirementId: 'REQ-1', factId: 'EFACT-REF' }),
    error => error.code === 'EVIDENCE_REFERENCE_ONLY_FORBIDDEN'
  );
});

test('Mapping candidate builder excludes REFERENCE_ONLY material facts', async () => {
  const builder = new MappingCandidateBuilder({ repository: {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'REQ-DB', requirement_id: 'REQ-1', project_id: PROJECT, text: '需求', requirement_hash: 'b'.repeat(64), requirement_contract_version: 'canonical-v1', requirement_valid: true },
      reviews: [{ review_id: 'R1', requirement_id: 'REQ-DB', requirement_text_hash: 'b'.repeat(64), review_status: 'approved' }],
      facts: [{ fact_id: 'F-REF', project_id: PROJECT, evidence_review_id: 'R1', material_id: MATERIAL, material_type: 'technical_solution', fact_review_status: 'approved', fact_current: true, source_lineage_verified: true, source_material_authority_eligible: true, source_span_id: 'S1', fact_payload_hash: 'c'.repeat(64), fact_contract_version: 'fact-v1', upstream_support_level: 'full_support' }]
    })
  }});
  const result = await builder.build({ projectId: PROJECT, requirementId: 'REQ-1' });
  assert.deepEqual(result.facts, []);
});

test('Mapping candidate builder rechecks synthetic markers before authority projection', async () => {
  const builder = new MappingCandidateBuilder({ repository: {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'REQ-DB', requirement_id: 'REQ-1', project_id: PROJECT, text: '需求', requirement_hash: 'b'.repeat(64), requirement_contract_version: 'canonical-v1', requirement_valid: true },
      reviews: [{ review_id: 'R1', requirement_id: 'REQ-DB', requirement_text_hash: 'b'.repeat(64), review_status: 'approved' }],
      facts: [{ fact_id: 'F-SYNTH', project_id: PROJECT, evidence_review_id: 'R1', material_id: MATERIAL, material_type: 'project_case', fact_review_status: 'approved', fact_current: true, source_lineage_verified: true, source_material_authority_eligible: true, source_span_id: 'S1', fact_payload_hash: 'c'.repeat(64), fact_contract_version: 'fact-v1', upstream_support_level: 'full_support' }]
    }),
    getCompanyMaterial: async () => ({ id: MATERIAL, material_type: 'project_case', source_type: 'synthetic_company_evidence', synthetic_test_material: true })
  }});
  const result = await builder.build({ projectId: PROJECT, requirementId: 'REQ-1' });
  assert.deepEqual(result.facts, []);
});

test('Mapping candidate builder allows synthetic Evidence-candidate facts only in Eval mode', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'REQ-DB', requirement_id: 'REQ-1', project_id: PROJECT, text: '需求', requirement_hash: 'b'.repeat(64), requirement_contract_version: 'canonical-v1', requirement_valid: true },
      reviews: [{ review_id: 'R1', requirement_id: 'REQ-DB', requirement_text_hash: 'b'.repeat(64), review_status: 'approved' }],
      facts: [{ fact_id: 'F-SYNTH', project_id: PROJECT, evidence_review_id: 'R1', material_id: MATERIAL, material_type: 'project_case', fact_review_status: 'approved', fact_current: true, source_lineage_verified: true, source_material_authority_eligible: true, source_span_id: 'S1', fact_payload_hash: 'c'.repeat(64), fact_contract_version: 'fact-v1', upstream_support_level: 'full_support' }]
    }),
    getCompanyMaterial: async () => ({ id: MATERIAL, material_type: 'project_case', source_type: 'synthetic_company_evidence', synthetic_test_material: true })
  };
  const result = await new MappingCandidateBuilder({ repository, authorityMode: 'SYNTHETIC_EVAL_ONLY' }).build({ projectId: PROJECT, requirementId: 'REQ-1' });
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].authority, 'SYNTHETIC_EVAL_ONLY');
});

test('Claim Gate rejects direct Reference authority even when a caller lies about usability', () => {
  const evaluation = evaluateEnterpriseClaimV2({
    projectId: PROJECT,
    claim: { claim_id: 'C1', project_id: PROJECT, requirement_id: 'REQ-1', text: '我司具备能力。', basis_evidence_ids: ['E1'] },
    binding: { project_id: PROJECT, requirement_id: 'REQ-1', mapping_id: 'M1', mapping_status: 'approved', support_level: 'full_support', evidence_id: 'E1', approval_status: 'approved', validity_status: 'active', source_lineage_verified: true, usable_for_claims: true, material_type: 'company_profile' }
  });
  assert.equal(evaluation.decision, 'reject');
  assert.ok(evaluation.reason_codes.includes('SOURCE_NOT_USABLE'));
});

test('Claim Gate permits synthetic Evidence-candidate only in Eval mode and never in production', () => {
  const fact = { fact_id: 'F-SYNTH', project_id: PROJECT, evidence_id: 'E1', evidence_identifier: 'E1', review_status: 'approved', is_current: true, version: 1, fact_type: 'capability', subject_json: { type: 'product', name: '平台' }, entities_json: [], fact_status: 'unknown', fact_scopes_json: [], quantities_json: [], validity_json: { status: 'active' } };
  const input = {
    projectId: PROJECT,
    claim: { claim_id: 'C-SYNTH', project_id: PROJECT, requirement_id: 'REQ-1', text: '平台具备相关能力。', basis_evidence_ids: ['E1'] },
    binding: { project_id: PROJECT, requirement_id: 'REQ-1', mapping_id: 'M1', mapping_status: 'approved', support_level: 'full_support', evidence_id: 'E1', approval_status: 'approved', validity_status: 'active', source_lineage_verified: true, usable_for_claims: true, material_type: 'project_case', synthetic_test_material: true, evidence_facts: [fact] }
  };
  const production = evaluateEnterpriseClaimV2(input);
  assert.ok(production.reason_codes.includes('SOURCE_NOT_USABLE'));
  assert.equal(production.deterministic_checks.find(item => item.check === 'source_usable').actual.authority, 'SYNTHETIC_EVAL_ONLY');
  const evaluation = evaluateEnterpriseClaimV2({ ...input, authorityMode: 'SYNTHETIC_EVAL_ONLY' });
  assert.ok(!evaluation.reason_codes.includes('SYNTHETIC_SOURCE_PRODUCTION_AUTHORITY_NONE'));
});
