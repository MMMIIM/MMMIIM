import { createHash } from 'node:crypto';
import { createEvidenceFactContract, EVIDENCE_FACT_CONTRACT_VERSION } from '../../src/pipeline/evidence-fact-contract-v1.js';
import { createRequirementEvidenceMapping, REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION } from '../../src/pipeline/requirement-evidence-mapping-contract-v1.js';

const sha = value => createHash('sha256').update(String(value)).digest('hex');

export const STAGE13_FIXTURE = Object.freeze({
  projectId: 'stage13-acceptance-project',
  requirementId: 'REQ-001',
  materialId: 'stage13-acceptance-material',
  reviewId: 'stage13-acceptance-review',
  spanId: 'stage13-acceptance-span',
  oldSource: '旧版产品说明：支持 10 个并发用户。',
  newSource: '新版产品说明：数据交换平台支持 50 个并发用户。',
});

export function createStage13AcceptanceFixture() {
  const f = STAGE13_FIXTURE;
  const state = {
    source: f.newSource,
    oldFact: null,
    facts: new Map(),
    mappings: new Map(),
  };
  const review = {
    review_id: f.reviewId,
    project_id: f.projectId,
    source_span_id: f.spanId,
    evidence_capability: 'capable',
    support_level: 'partial_support',
    evidence_review_contract_version: 'evidence-review-v1',
    material_id: f.materialId,
    anchor_chunk_id: 'stage13-acceptance-chunk',
    source_text: state.source,
    source_text_hash: sha(state.source),
    material_type: 'product_documentation',
    review_status: 'approved',
    requirement_ref: f.requirementId,
  };
  const requirement = {
    req_id: f.requirementId,
    text: '系统应支持 50 个并发用户。',
    is_mandatory: true,
    requirement_category: 'performance',
    risk_flags: [],
    source_evidence: [],
  };
  const repository = {
    async getEvidenceReviewForFact() {
      return { ...review, source_text: state.source, source_text_hash: review.source_text_hash, current_source_text_hash: sha(state.source) };
    },
    async upsertEvidenceSourceFact(fact) {
      state.facts.set(fact.fact_id, fact);
      return fact;
    },
    async upsertEvidenceSourceFactsAtomic(facts) {
      for (const fact of facts) state.facts.set(fact.fact_id, fact);
      return facts;
    },
    async getEvidenceSourceFactCurrent(factId) {
      const fact = state.facts.get(factId);
      if (!fact) return null;
      return {
        ...fact,
        evidence_review_status: review.review_status,
        evidence_review_contract_version: review.evidence_review_contract_version,
        source_text: state.source,
        current_source_text_hash: sha(state.source),
        source_text_hash: fact.source?.source_text_hash,
        anchor_chunk_id: review.anchor_chunk_id,
      };
    },
    async invalidateEvidenceSourceFact(factId) {
      const fact = state.facts.get(factId);
      if (fact) state.facts.set(factId, { ...fact, review_status: 'invalidated' });
    },
    async decideEvidenceSourceFact({ factId, status, reviewer, note }) {
      const fact = state.facts.get(factId);
      const decided = { ...fact, review_status: status, reviewed_by: reviewer, review_note: note };
      state.facts.set(factId, decided);
      return decided;
    },
    async getRequirementEvidenceFactMappingContext() {
      const fact = [...state.facts.values()].find(item => item.review_status === 'approved');
      if (!fact) return null;
      return {
        requirement_db_id: 'stage13-requirement-db-id',
        requirement_id: f.requirementId,
        project_id: f.projectId,
        requirement_text: requirement.text,
        requirement_hash: sha(requirement.text),
        requirement_contract_version: 'canonical-requirement-v1',
        requirement_valid: true,
        fact_id: fact.fact_id,
        fact_payload_hash: fact.payload_hash,
        fact_contract_version: fact.contract_version,
        fact_review_status: fact.review_status,
        evidence_review_id: f.reviewId,
        source_span_id: f.spanId,
        material_id: f.materialId,
      };
    },
    async upsertRequirementEvidenceFactMapping(mapping) {
      state.mappings.set(mapping.mapping_id, mapping);
      return mapping;
    },
    async replaceRequirementEvidenceFactMappingAtomic(mapping) {
      for (const current of state.mappings.values()) {
        if (current.project_id === mapping.project_id
          && current.requirement_db_id === mapping.requirement_db_id
          && current.evidence_fact_id === mapping.evidence_fact_id
          && current.mapping_id !== mapping.mapping_id) current.review_status = 'invalidated';
      }
      state.mappings.set(mapping.mapping_id, mapping);
      return mapping;
    },
    async invalidateObsoleteRequirementEvidenceFactMappings() {},
    async getRequirementEvidenceFactMappingCurrent(mappingId) {
      const mapping = state.mappings.get(mappingId);
      if (!mapping) return null;
      const fact = state.facts.get(mapping.evidence_fact_id);
      return {
        ...mapping,
        current_requirement_hash: mapping.requirement_hash,
        current_requirement_contract_version: mapping.requirement_contract_version,
        current_fact_payload_hash: fact?.payload_hash,
        current_fact_contract_version: fact?.contract_version,
        fact_review_status: fact?.review_status,
        requirement_valid: true,
      };
    },
    async decideRequirementEvidenceFactMapping({ mappingId, status, reviewer, note }) {
      const mapping = state.mappings.get(mappingId);
      const decided = { ...mapping, review_status: status, reviewed_by: reviewer, review_note: note };
      state.mappings.set(mappingId, decided);
      return decided;
    },
    async invalidateRequirementEvidenceFactMapping(mappingId) {
      const mapping = state.mappings.get(mappingId);
      if (mapping) state.mappings.set(mappingId, { ...mapping, review_status: 'invalidated' });
    },
    async getFormalRequirements() { return [requirement]; },
    async listEvidenceCandidateReviews() { return [review]; },
    async listEvidenceSourceFacts() {
      return [...state.facts.values()].map(fact => ({
        ...fact,
        evidence_review_id: f.reviewId,
        evidence_review_status: review.review_status,
        current_source_text_hash: sha(state.source),
        fact_current: fact.review_status !== 'invalidated',
      }));
    },
    async listRequirementEvidenceFactMappings() {
      return [...state.mappings.values()].map(mapping => ({
        ...mapping,
        requirement_identifier: f.requirementId,
        fact_review_status: state.facts.get(mapping.evidence_fact_id)?.review_status,
        evidence_review_status: review.review_status,
        fact_current: state.facts.get(mapping.evidence_fact_id)?.review_status === 'approved',
        mapping_current: mapping.review_status !== 'invalidated',
      }));
    },
  };
  const projectAuthorizationService = {
    async assertProjectAccess() { return { membership: { role: 'OWNER', status: 'ACTIVE' } }; },
  };
  return {
    state,
    projectId: f.projectId,
    requirementId: f.requirementId,
    review,
    requirement,
    repository,
    projectAuthorizationService,
    extractor: {
      version: 'stage13-acceptance-fixture-v1',
      async extract() {
        return [{
          subject: { type: 'product', name: '数据交换平台' },
          entities: [],
          status: 'unknown',
          scopes: [],
          quantities: [{ metric: 'concurrency', value: '50', unit: 'user' }],
          validity: { status: 'unknown' },
          domain_metadata: {},
        }];
      },
    },
    mappingEvaluator: {
      version: 'stage13-acceptance-mapping-fixture-v1',
      async evaluate() {
        return {
          semantic_relationship: 'direct',
          support_level: 'full_support',
          dimensions: {
            subject_match: 'match', scope_match: 'match', status_match: 'match',
            quantitative_match: 'match', entity_match: 'match', validity_match: 'match',
            support_sufficiency: 'match',
          },
          reason_codes: [],
        };
      },
    },
    makeOldFact() {
      const oldContext = { ...review, source_text: f.oldSource, source_text_hash: sha(f.oldSource) };
      const oldFact = createEvidenceFactContract(oldContext, {
        subject: { type: 'product', name: '产品' },
        entities: [], status: 'unknown', scopes: [], quantities: [],
        validity: { status: 'unknown' }, domain_metadata: {},
      }, { extractorVersion: 'stage13-acceptance-fixture-v1' });
      state.oldFact = oldFact;
      state.facts.set(oldFact.fact_id, { ...oldFact, review_status: 'approved' });
      return oldFact;
    },
    makeMapping(context) {
      return createRequirementEvidenceMapping(context, {
        semantic_relationship: 'direct', support_level: 'full_support',
        dimensions: {
          subject_match: 'match', scope_match: 'match', status_match: 'match',
          quantitative_match: 'match', entity_match: 'match', validity_match: 'match',
          support_sufficiency: 'match',
        }, reason_codes: [], source_type: 'manual',
      }, { evaluatorVersion: 'stage13-acceptance-mapping-fixture-v1' });
    },
    constants: { EVIDENCE_FACT_CONTRACT_VERSION, REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION },
  };
}
