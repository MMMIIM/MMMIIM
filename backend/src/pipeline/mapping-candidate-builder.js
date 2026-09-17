import { AppError } from '../errors.js';
import {
  hasMaterialSourceRoleData,
  resolveMaterialSourceRole,
  materialAuthorityAllowedForMode,
  resolveMaterialAuthorityTier
} from './material-source-authority-policy.js';

export const MAPPING_CANDIDATE_VIEW_VERSION = 'mapping-candidate-view-v1';

const UPSTREAM_SUPPORT_RANK = Object.freeze({
  conflict: 0,
  insufficient: 1,
  reference_only: 1,
  unknown: 1,
  partial_support: 2,
  full_support: 3
});
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function mostRestrictiveSupport(facts) {
  return facts.reduce((current, fact) => {
    const value = fact.upstream_support_level;
    if (!value) return current;
    if (!current || (UPSTREAM_SUPPORT_RANK[value] ?? 1) < (UPSTREAM_SUPPORT_RANK[current] ?? 1)) return value;
    return current;
  }, null);
}

function requirementView(value = {}) {
  const requirement = {
    requirement_db_id: value.requirement_db_id || value.id || null,
    requirement_id: value.requirement_id || value.req_id || null,
    project_id: value.project_id || null,
    text: value.text || value.requirement_text || value.content || '',
    requirement_hash: value.requirement_hash || null,
    requirement_contract_version: value.requirement_contract_version || value.contract_version || null,
    requirement_valid: value.requirement_valid === true || value.status === 'confirmed'
  };
  if (!requirement.requirement_db_id || !requirement.requirement_id || !requirement.project_id
    || !requirement.requirement_valid || !SHA256_PATTERN.test(String(requirement.requirement_hash || ''))) {
    throw new AppError('MAPPING_REQUIREMENT_INVALID', 'Mapping candidate 需要当前有效 Canonical Requirement。', 409);
  }
  return Object.freeze(requirement);
}

function factView(value = {}, requirement) {
  const factId = value.fact_id || value.evidence_fact_id;
  const reviewId = value.evidence_review_id || value.review_id;
  const fact = {
    ...value,
    fact_id: factId,
    fact_ref: factId,
    evidence_fact_id: factId,
    fact_review_status: value.fact_review_status || value.review_status || null,
    evidence_review_status: value.evidence_review_status || value.review_status_evidence || null,
    evidence_review_id: reviewId,
    source_span_id: value.source_span_id || null,
    material_id: value.material_id || null,
    fact_payload_hash: value.fact_payload_hash || value.payload_hash || null,
    fact_contract_version: value.fact_contract_version || value.contract_version || null,
    project_id: value.project_id || requirement.project_id,
    fact_current: value.fact_current === true,
    source_lineage_verified: value.source_lineage_verified === true,
    source_material_authority_eligible: value.source_material_authority_eligible !== false,
    upstream_support_level: value.upstream_support_level || value.support_level || null
  };
  const authorityTier = resolveMaterialAuthorityTier(value);
  fact.authority = authorityTier.authority;
  fact.production_authority = authorityTier.production_authority;
  return fact;
}

function sameRequirement(review, requirement) {
  const owner = review?.requirement_db_id || review?.requirement_id;
  return Boolean(owner)
    && (owner === requirement.requirement_db_id || owner === requirement.requirement_id);
}

/**
 * Builds the only model-facing Mapping input. It intentionally strips raw
 * source text, retrieval candidates and business policy fields; those remain
 * Backend authority and are never sent to the semantic worker.
 */
export function createMappingRequirementView(requirement, facts) {
  return Object.freeze({
    requirement_id: requirement.requirement_id,
    requirement_text: requirement.text,
    requirement_hash: requirement.requirement_hash,
    facts: Object.freeze(facts.map(fact => Object.freeze({
      fact_ref: fact.fact_id,
      subject: fact.subject || null,
      entities: fact.entities || [],
      fact_status: fact.fact_status || 'unknown',
      scopes: fact.scopes || [],
      quantities: fact.quantities || [],
      validity: fact.validity || { status: 'unknown' }
    })))
  });
}

export class MappingCandidateBuilder {
  constructor({ repository, maxFactsPerBatch = 6, authorityMode = 'PRODUCTION' } = {}) {
    this.repository = repository;
    this.maxFactsPerBatch = maxFactsPerBatch;
    this.authorityMode = authorityMode;
  }

  async build({ projectId, requirementId } = {}) {
    if (!projectId || !requirementId) throw new AppError('MAPPING_SCOPE_REQUIRED', 'Mapping candidate 需要 projectId 与 requirementId。', 400);
    if (typeof this.repository?.getMappingCandidateContext !== 'function') {
      throw new AppError('MAPPING_CANDIDATE_SOURCE_REQUIRED', 'Canonical Mapping candidate source 未配置。', 503);
    }
    const raw = await this.repository.getMappingCandidateContext({ projectId, requirementId });
    if (!raw) throw new AppError('MAPPING_TARGET_NOT_FOUND', 'Requirement 不存在或不属于当前项目。', 404);
    const requirement = requirementView(raw.requirement || raw);
    if (requirement.project_id !== projectId) throw new AppError('MAPPING_SCOPE_INVALID', 'Requirement project scope 不一致。', 409);
    const reviewsProvided = Array.isArray(raw.reviews);
    if (!reviewsProvided) {
      throw new AppError('MAPPING_REVIEW_LINEAGE_REQUIRED', 'Mapping candidate 必须由目标 Requirement 的 approved Review lineage 提供。', 409);
    }
    const reviews = reviewsProvided ? raw.reviews : [];
    const approvedReviewIds = new Set(reviews.filter(review => review.review_status === 'approved'
      && sameRequirement(review, requirement)
      && review.requirement_text_hash === requirement.requirement_hash).map(review => review.review_id));
    const rawFacts = Array.isArray(raw.facts) ? raw.facts : [];
    // Mapping context projections may intentionally omit non-contract
    // material fields.  Rehydrate the authoritative material row before
    // applying the single source-role policy, so synthetic markers cannot
    // disappear at this downstream boundary.
    const enrichedFacts = typeof this.repository?.getCompanyMaterial === 'function'
      ? await Promise.all(rawFacts.map(async value => {
        if (!value?.material_id) return value;
        const material = await this.repository.getCompanyMaterial(value.material_id);
        return material ? { ...value, ...material } : value;
      }))
      : rawFacts;
    const facts = enrichedFacts
      .map(value => factView(value, requirement))
      .filter(fact => fact.project_id === projectId)
      .filter(fact => fact.fact_review_status === 'approved')
      .filter(fact => fact.evidence_review_status === null || fact.evidence_review_status === 'approved')
      .filter(fact => !reviewsProvided || approvedReviewIds.has(fact.evidence_review_id))
      .filter(fact => fact.fact_current && fact.source_lineage_verified)
      .filter(fact => fact.source_material_authority_eligible)
      .filter(fact => materialAuthorityAllowedForMode(fact, { authorityMode: this.authorityMode }))
      .filter(fact => !hasMaterialSourceRoleData(fact)
        || resolveMaterialSourceRole(fact).role === 'EVIDENCE_CANDIDATE')
      .filter(fact => fact.source_span_id && fact.material_id && SHA256_PATTERN.test(String(fact.fact_payload_hash || '')))
      .sort((left, right) => String(left.fact_id).localeCompare(String(right.fact_id)));
    const uniqueFacts = [];
    const seen = new Set();
    for (const fact of facts) {
      if (!fact.fact_id || seen.has(fact.fact_id)) continue;
      seen.add(fact.fact_id);
      uniqueFacts.push(Object.freeze(fact));
    }
    if (uniqueFacts.some(fact => !Object.prototype.hasOwnProperty.call(UPSTREAM_SUPPORT_RANK, fact.upstream_support_level))) {
      throw new AppError('MAPPING_UPSTREAM_SUPPORT_REQUIRED', 'Mapping candidate 缺少 approved Review 的 support boundary。', 409);
    }
    return Object.freeze({
      view_version: MAPPING_CANDIDATE_VIEW_VERSION,
      requirement,
      facts: Object.freeze(uniqueFacts),
      model_input: createMappingRequirementView(requirement, uniqueFacts),
      max_facts_per_batch: this.maxFactsPerBatch,
      upstream_support_level: mostRestrictiveSupport(uniqueFacts)
    });
  }
}
