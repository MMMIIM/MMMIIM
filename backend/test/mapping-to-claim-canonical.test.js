import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const requirement = { req_id: 'REQ-001', text: '相关项目应完成中标交付。', source_status: 'verified', confirmation_type: 'verified', requirement_category: 'technical', writer_eligible: true, classification_review_required: false, atomicity_review_required: false };
const plan = { requirement_id: 'REQ-001', response_status: 'full', response_summary: requirement.text, implementation_actions: [], optional_design: null, deliverables: [], acceptance_methods: [], conditions: [], supporting_evidence_ids: [], capability_gap: '', target_sections: ['chapter-05'] };

function support(overrides = {}) {
  const fact = { fact_id: 'FACT-001', evidence_identifier: 'FACT-001', project_id: PROJECT, review_status: 'approved', is_current: true, fact_status: 'award', fact_scopes_json: ['award_fact'], quantities_json: [], validity_json: { status: 'not_applicable' }, subject_json: { type: 'project', name: '相关项目' }, entities_json: [], version: 1 };
  return {
    mapping_id: 'MAP-001', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'FACT-001', mapping_status: 'approved', mapping_current: true,
    approval_status: 'approved', is_current: true, support_level: 'full_support', source_lineage_verified: true, usable_for_claims: true,
    source_text: '相关项目中标并完成交付。', content: '相关项目中标并完成交付。', material_type: 'project_case', evidence_scope: ['award_fact'], metadata: { subject: fact.subject_json, entities: [], fact_status: 'award', quantities: [] }, evidence_facts: [fact],
    ...overrides
  };
}

function legacyOnly() {
  return [{ mapping_id: 'LEGACY-MAP', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'LEGACY-EVIDENCE', approval_status: 'approved', content: '旧 Evidence Mapping 不得授权新 Claim。', source_lineage_verified: true, usable_for_claims: true }];
}

function repository({ supports = [], legacy = [] } = {}) {
  let saved = null;
  const claims = [];
  return {
    getProject: async (id) => ({ id }),
    getRequirementBaseline: async () => ({ id: 'baseline' }),
    getFormalRequirements: async () => [requirement],
    listResponsePlans: async () => ({ plans: [plan], constraint_records: [] }),
    listApprovedEvidence: async () => legacy,
    getApprovedRequirementFactSupport: async () => supports,
    replaceClaimsAndCoverage: async (_projectId, value) => { saved = value; claims.splice(0, claims.length, ...value.evaluatedClaims.map((item) => ({ ...item.claim, ...item.decision, v2_evaluation: item.v2_evaluation }))); },
    listClaims: async () => claims,
    listCoverage: async () => [],
    saveProductionBetaFailure: async () => {},
    get saved() { return saved; }
  };
}

async function run(options = {}) {
  const repo = repository(options);
  const result = await new ProductionBetaService({ repository: repo }).generateClaims(PROJECT);
  return { repo, result, persisted: repo.saved };
}

test('MC1 approved canonical Fact Mapping supplies Claim support and lineage', async () => {
  const { persisted } = await run({ supports: [support()] });
  const item = persisted.evaluatedClaims.find((x) => x.claim.claim_type === 'evidence_support');
  assert.ok(item);
  assert.deepEqual(item.claim.basis_evidence_ids, ['FACT-001']);
  assert.deepEqual(item.v2_evaluation.mapping_ids, ['MAP-001']);
  assert.deepEqual(item.v2_evaluation.evidence_ids, ['FACT-001']);
  assert.match(item.v2_evaluation.claim_assertion_hash, /^[0-9a-f]{64}$/);
  assert.match(item.v2_evaluation.input_snapshot_hash, /^[0-9a-f]{64}$/);
  assert.match(item.v2_evaluation.gate_result_id, /^CGR-[A-F0-9]{32}$/);
  assert.equal(item.v2_evaluation.lineage_current, true);
});

test('MC2 legacy Mapping only never becomes new Claim support', async () => {
  const { persisted } = await run({ supports: [], legacy: legacyOnly() });
  assert.equal(persisted.evaluatedClaims.some((x) => x.claim.claim_type === 'evidence_support'), false);
});

for (const [name, overrides] of [
  ['MC3 draft Fact', { approval_status: 'draft' }],
  ['MC4 rejected Fact', { approval_status: 'rejected' }],
  ['MC5 invalidated Fact', { approval_status: 'invalidated' }],
  ['MC6 draft Mapping', { mapping_status: 'draft' }],
  ['MC7 rejected Mapping', { mapping_status: 'rejected' }],
  ['MC8 invalidated Mapping', { mapping_status: 'invalidated' }],
  ['MC9 cross-project Fact Mapping', { project_id: '00000000-0000-4000-8000-000000000002' }],
  ['MC10 wrong Requirement Mapping', { requirement_id: 'REQ-999' }],
  ['MC11 stale Fact lineage', { mapping_current: false }]
]) {
  test(`${name} cannot provide formal Claim support`, async () => {
    const { persisted } = await run({ supports: [support(overrides)] });
    assert.equal(persisted.evaluatedClaims.some((x) => x.claim.claim_type === 'evidence_support'), false);
  });
}

test('MC12 duplicate approved canonical Mapping is deterministic and idempotent', async () => {
  const { persisted } = await run({ supports: [support(), support()] });
  const evidenceClaims = persisted.evaluatedClaims.filter((x) => x.claim.claim_type === 'evidence_support');
  assert.equal(evidenceClaims.length, 1);
  assert.deepEqual(evidenceClaims[0].v2_evaluation.mapping_ids, ['MAP-001']);
});

