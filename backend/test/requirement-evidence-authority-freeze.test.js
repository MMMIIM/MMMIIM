import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequirementEvidenceMapping } from '../src/pipeline/requirement-evidence-mapping-contract-v1.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';
import { EvidenceReadinessService, deriveReadiness } from '../src/evidence-readiness-service.js';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';
import { adaptRetrievalCandidate, adaptApprovedEvidenceFact } from '../src/pipeline/evidence-support-assessment-contract-v1.js';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const REQUIREMENT = {
  req_id: 'REQ-001',
  text: '系统应支持数据接入。',
  source_status: 'verified',
  confirmation_type: 'verified',
  requirement_category: 'technical',
  writer_eligible: true,
  classification_review_required: false,
  atomicity_review_required: false
};
const PLAN = {
  requirement_id: 'REQ-001', response_status: 'full', response_summary: REQUIREMENT.text,
  implementation_actions: [], optional_design: [], deliverables: [], acceptance_methods: [],
  conditions: [], supporting_evidence_ids: [], capability_gap: '', target_sections: ['chapter-05']
};
const canonicalSupport = {
  mapping_id: 'MAP-CANONICAL', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'FACT-CANONICAL',
  mapping_status: 'approved', mapping_current: true, approval_status: 'approved', is_current: true,
  support_level: 'full_support', source_lineage_verified: true, usable_for_claims: true,
  source_text: '系统具备数据接入能力。', content: '系统具备数据接入能力。', material_type: 'project_case',
  evidence_scope: ['technical'], metadata: {}, evidence_facts: []
};
const legacyEvidence = {
  mapping_id: 'MAP-LEGACY', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'OLD-EVIDENCE',
  approval_status: 'approved', content: '旧 evidence_facts / requirement_evidence_mappings 内容',
  source_lineage_verified: true, usable_for_claims: true
};

function repository({ canonical = [], legacy = [] } = {}) {
  let saved = null;
  return {
    getProject: async (id) => ({ id }),
    getRequirementBaseline: async () => ({ id: 'baseline' }),
    getFormalRequirements: async () => [REQUIREMENT],
    listResponsePlans: async () => ({ plans: [PLAN], constraint_records: [] }),
    listApprovedEvidence: async () => legacy,
    getApprovedRequirementFactSupport: async () => canonical,
    replaceClaimsAndCoverage: async (_id, value) => { saved = value; },
    listClaims: async () => [],
    saveProductionBetaFailure: async () => {},
    get saved() { return saved; }
  };
}

test('authority docs identify one canonical Fact and Mapping owner', async () => {
  const [adr, registry, matrix] = await Promise.all([
    readFile(new URL('../../docs/decisions/017-canonical-requirement-evidence-fact-mapping-authority.md', import.meta.url), 'utf8'),
    readFile(new URL('../../docs/CONCEPT_REGISTRY.md', import.meta.url), 'utf8'),
    readFile(new URL('../../docs/audits/CONCEPT_OWNERSHIP_MATRIX.md', import.meta.url), 'utf8')
  ]);
  for (const text of [adr, registry, matrix]) {
    assert.match(text, /evidence_source_facts/);
    assert.match(text, /requirement_evidence_fact_mappings/);
    assert.match(text, /legacy/i);
  }
  assert.match(adr, /Canonical Requirement 与 approved Evidence Fact/);
  assert.match(adr, /Mapping approval[\s\S]*Claim approval/);
});

test('legacy Mapping or Evidence Fact cannot grant Claim authority', async () => {
  const repo = repository({ legacy: [legacyEvidence] });
  const service = new ProductionBetaService({ repository: repo });
  await service.generateClaims(PROJECT);
  assert.equal(repo.saved.evaluatedClaims.some((item) => item.claim.claim_type === 'evidence_support'), false);
});

test('approved canonical Fact Mapping is consumable by the Claim path', async () => {
  const repo = repository({ canonical: [canonicalSupport] });
  const service = new ProductionBetaService({ repository: repo });
  await service.generateClaims(PROJECT);
  assert.equal(repo.saved.evaluatedClaims.filter((item) => item.claim.claim_type === 'evidence_support').length, 1);
});

test('Retrieval Candidate is not an Evidence Fact', () => {
  const candidate = adaptRetrievalCandidate({
    requirement: { requirement_id: 'REQ-001', text: REQUIREMENT.text },
    candidate: { candidate_id: 'RET-001' },
    sourceSpan: { source_span_id: 'SPAN-001', source_text: '候选来源。' }
  });
  assert.equal(candidate.input_kind, 'retrieval_candidate');
  assert.equal(Object.hasOwn(candidate, 'fact'), false);
  assert.throws(() => adaptApprovedEvidenceFact({
    requirement: { requirement_id: 'REQ-001', text: REQUIREMENT.text },
    fact: candidate,
    sourceSpan: { source_span_id: 'SPAN-001', source_text: '候选来源。' }
  }), /Evidence Fact/);
});

test('Requirement and Fact Mapping identities use database FKs, not display IDs', () => {
  const mapping = createRequirementEvidenceMapping({
    project_id: PROJECT,
    requirement_db_id: 'REQ-DB-UUID',
    requirement_id: 'REQ-001',
    requirement_hash: 'a'.repeat(64),
    requirement_contract_version: 'canonical-v1',
    requirement_valid: true,
    fact_id: 'FACT-001',
    fact_payload_hash: 'b'.repeat(64),
    fact_contract_version: 'evidence-fact-v1',
    fact_review_status: 'approved',
    evidence_review_id: 'REVIEW-001', source_span_id: 'SPAN-001', material_id: 'MATERIAL-001'
  }, {
    semantic_relationship: 'direct', support_level: 'full_support',
    dimensions: Object.fromEntries(['subject_match', 'scope_match', 'status_match', 'quantitative_match', 'entity_match', 'validity_match', 'support_sufficiency'].map((key) => [key, 'match'])),
    reason_codes: []
  });
  assert.equal(mapping.requirement_db_id, 'REQ-DB-UUID');
  assert.equal(mapping.requirement_id, 'REQ-001');
  assert.equal(mapping.evidence_fact_id, 'FACT-001');
  assert.equal(mapping.evidence_id, undefined);
});

test('Mapping approval remains distinct from Claim approval', async () => {
  const service = new RequirementEvidenceFactMappingService({
    repository: {
      getRequirementEvidenceFactMappingCurrent: async () => ({ mapping_id: 'MAP-1', contract_version: 'requirement-evidence-mapping-v1.1', evaluator_version: 'v1', requirement_hash: 'a', current_requirement_hash: 'a', requirement_contract_version: 'canonical-v1', current_requirement_contract_version: 'canonical-v1', requirement_valid: true, fact_payload_hash: 'b', current_fact_payload_hash: 'b', fact_contract_version: 'evidence-fact-v1', current_fact_contract_version: 'evidence-fact-v1', fact_review_status: 'approved', review_status: 'proposed' }),
      decideRequirementEvidenceFactMapping: async (value) => value
    },
    evaluatorVersion: 'v1'
  });
  const result = await service.decide('MAP-1', 'approve', { reviewer: 'human' });
  assert.equal(result.status, 'approved');
  assert.equal(result.claim_permission, undefined);
});

test('Sufficiency and Readiness are derived boundaries, not Mapping authority', async () => {
  assert.equal(deriveReadiness([{ mapping_current: true, fact_current: true, review_status: 'approved', fact_review_status: 'approved', evidence_review_status: 'approved', support_level: 'full_support', semantic_relationship: 'direct' }]), 'SUPPORTED');
  const service = new EvidenceReadinessService({ repository: {
    getFormalRequirements: async () => [REQUIREMENT],
    listRequirementEvidenceFactMappings: async () => [],
    listEvidenceCandidateReviews: async () => [],
    listEvidenceSourceFacts: async () => []
  } });
  const result = await service.get(PROJECT);
  assert.equal(result.requirements[0].readiness, 'NO_EVIDENCE');
});
