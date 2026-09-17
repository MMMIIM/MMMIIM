import {
  createEvidenceSupportAssessment,
  aggregateEvidenceSufficiency
} from './evidence-support-assessment-contract-v1.js';
import { classifyEvidenceBearing } from './evidence-bearing-classifier.js';
import { classifyEvidenceSourceEligibility } from './retrieval-source-eligibility.js';
import {
  EVIDENCE_SUPPORT_REASON_CODES
} from './evidence-support-assessment-contract-v1.js';
import {
  REVIEW_DIMENSIONS,
  REVIEW_DIMENSION_VALUES,
  SEMANTIC_RELEVANCE,
  EVIDENCE_CAPABILITY,
  EVIDENCE_SUPPORT_LEVEL
} from './evidence-review-contract.js';

export const EVIDENCE_SUPPORT_ROUTING_VERSION = 'evidence-support-responsibility-v1';
export const EVIDENCE_SUPPORT_ROUTING_DECISIONS = Object.freeze([
  'DETERMINISTIC_RESOLUTION',
  'NEEDS_SEMANTIC_ADJUDICATION'
]);

const DIMENSION_REASON_CODES = Object.freeze({
  subject_match: 'SUBJECT_MISMATCH',
  scope_match: 'SCOPE_MISMATCH',
  status_match: 'STATUS_MISMATCH',
  quantitative_match: 'QUANTITATIVE_MISMATCH',
  entity_match: 'ENTITY_MISMATCH',
  validity_match: 'VALIDITY_MISMATCH',
  source_authority: 'SOURCE_AUTHORITY_INSUFFICIENT',
  support_sufficiency: 'SUPPORT_INSUFFICIENT'
});

const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asText = value => String(value ?? '').trim();
const unique = values => [...new Set(values.filter(Boolean))];

function unknownDimensions() {
  return Object.fromEntries(REVIEW_DIMENSIONS.map(name => [name, 'unknown']));
}

function candidateMetadata(adapter) {
  return asObject(adapter?.candidate_metadata);
}

function sourceMaterial(adapter) {
  return asObject(adapter?.source?.material);
}

function explicitDimensions(adapter) {
  const metadata = candidateMetadata(adapter);
  const values = asObject(metadata.deterministic_dimensions || metadata.deterministic_checks);
  return Object.fromEntries(Object.entries(values).filter(([name, value]) => (
    REVIEW_DIMENSIONS.includes(name) && REVIEW_DIMENSION_VALUES.includes(value)
  )));
}

function explicitReasonCodes(adapter) {
  const values = candidateMetadata(adapter).deterministic_reason_codes;
  return Array.isArray(values)
    ? values.filter(code => EVIDENCE_SUPPORT_REASON_CODES.includes(code))
    : [];
}

function deterministicContext({ requirement, adapter }) {
  const sourceText = asText(adapter?._source_text);
  const metadata = candidateMetadata(adapter);
  const material = sourceMaterial(adapter);
  const candidateForChecks = {
    ...material,
    ...metadata,
    source_text: sourceText,
    source_origin: metadata.source_origin || material.source_origin,
    proof_eligibility: metadata.proof_eligibility || material.proof_eligibility,
    material_type: material.material_type || metadata.material_type
  };
  const eligibility = classifyEvidenceSourceEligibility(candidateForChecks);
  const bearing = classifyEvidenceBearing({
    requirement,
    sourceText,
    candidate: candidateForChecks
  });
  const dimensions = { ...unknownDimensions(), ...explicitDimensions(adapter) };
  const mismatchedDimensions = Object.entries(dimensions)
    .filter(([, value]) => value === 'mismatch')
    .map(([name]) => name);
  const explicitReasons = explicitReasonCodes(adapter);
  const reasons = unique([
    ...explicitReasons,
    ...mismatchedDimensions.map(name => DIMENSION_REASON_CODES[name])
  ]);

  return {
    source_text: sourceText,
    eligibility,
    bearing,
    dimensions,
    mismatched_dimensions: mismatchedDimensions,
    reasons,
    candidate_metadata: metadata,
    material
  };
}

function deterministicObservation(context) {
  const { eligibility, bearing, dimensions, mismatched_dimensions: mismatches, reasons } = context;
  const route = context.candidate_metadata.proof_eligibility || context.material.proof_eligibility;
  if (route === 'REFERENCE_CONTEXT' || bearing.classification === 'REFERENCE_CONTEXT_ONLY') {
    return {
      semantic_relevance: 'relevant',
      evidence_capability: 'reference_only',
      support_level: 'reference_only',
      semantic_relationship: 'related',
      review_dimensions: dimensions,
      reason_codes: unique([...reasons, 'REFERENCE_ONLY_SOURCE']),
      support_observations: []
    };
  }
  const explicitIneligible = !eligibility.evidence_source_eligible
    && eligibility.evidence_source_class !== 'UNKNOWN';
  if (route === 'OUT_OF_SCOPE'
    || explicitIneligible
    || bearing.classification === 'METADATA_OR_HEADER') {
    return {
      semantic_relevance: 'irrelevant',
      evidence_capability: 'not_capable',
      support_level: 'insufficient',
      semantic_relationship: 'unrelated',
      review_dimensions: dimensions,
      reason_codes: unique([...reasons, 'SEMANTICALLY_IRRELEVANT', 'SOURCE_NOT_EVIDENCE_CAPABLE']),
      support_observations: []
    };
  }
  if (mismatches.length > 0) {
    return {
      semantic_relevance: 'relevant',
      evidence_capability: 'capable',
      support_level: 'conflict',
      semantic_relationship: 'conflict',
      review_dimensions: dimensions,
      reason_codes: unique(reasons),
      support_observations: []
    };
  }
  return null;
}

/**
 * Performs only objective checks.  A candidate that is not conclusively
 * excluded or contradicted remains unresolved and is eligible for semantic
 * adjudication.  This function never equates ranking with support.
 */
export function runDeterministicEvidenceChecks({ requirement, adapter } = {}) {
  const context = deterministicContext({ requirement, adapter });
  const observation = deterministicObservation(context);
  return {
    routing_version: EVIDENCE_SUPPORT_ROUTING_VERSION,
    decision: observation ? 'DETERMINISTIC_RESOLUTION' : 'NEEDS_SEMANTIC_ADJUDICATION',
    source_id: adapter?.source?.source_id || null,
    source_span_id: adapter?.source?.source_span_id || null,
    deterministic_dimensions: context.dimensions,
    unresolved_dimensions: REVIEW_DIMENSIONS.filter(name => context.dimensions[name] === 'unknown'),
    eligibility: context.eligibility,
    bearing: context.bearing,
    reason_codes: context.reasons,
    observation
  };
}

function createDeterministicAssessment({ adapter, check, evaluatorVersion }) {
  return createEvidenceSupportAssessment(adapter, check.observation, {
    evaluatorVersion: evaluatorVersion || EVIDENCE_SUPPORT_ROUTING_VERSION
  });
}

/**
 * Routes a Top-K set without making a model call.  If any source has an
 * unresolved semantic relationship, the complete set remains on the
 * adjudication path so no candidate is silently upgraded or dropped.
 */
export function routeEvidenceSupport({ requirement, adapters = [], evaluatorVersion } = {}) {
  if (!Array.isArray(adapters) || adapters.length === 0) {
    return {
      routing_version: EVIDENCE_SUPPORT_ROUTING_VERSION,
      decision: 'DETERMINISTIC_RESOLUTION',
      checks: [],
      assessments: [],
      aggregate: aggregateEvidenceSufficiency([]),
      metrics: {
        total_candidates: 0,
        rule_resolved: 0,
        semantic_adjudication_required: 0,
        llm_call_rate: 0,
        human_review_rate: 0,
        unsafe_false_supported: 0
      }
    };
  }
  const checks = adapters.map(adapter => runDeterministicEvidenceChecks({ requirement, adapter }));
  const assessments = checks
    .map((check, index) => ({ check, adapter: adapters[index], index }))
    .filter(({ check }) => check.decision === 'DETERMINISTIC_RESOLUTION')
    .map(({ check, adapter }) => createDeterministicAssessment({ adapter, check, evaluatorVersion }));
  const unresolved = checks.filter(check => check.decision === 'NEEDS_SEMANTIC_ADJUDICATION');
  return {
    routing_version: EVIDENCE_SUPPORT_ROUTING_VERSION,
    decision: unresolved.length ? 'NEEDS_SEMANTIC_ADJUDICATION' : 'DETERMINISTIC_RESOLUTION',
    checks,
    assessments: unresolved.length ? [] : assessments,
    aggregate: unresolved.length ? null : aggregateEvidenceSufficiency(assessments),
    metrics: {
      total_candidates: adapters.length,
      rule_resolved: checks.length - unresolved.length,
      semantic_adjudication_required: unresolved.length,
      llm_call_rate: unresolved.length ? 1 : 0,
      human_review_rate: unresolved.length ? 1 : 0,
      unsafe_false_supported: 0
    }
  };
}

/**
 * Assembles a canonical assessment while keeping deterministic fields
 * authoritative.  Semantic output may fill unknown fields, but cannot
 * overwrite a rule result or create a formal lifecycle object.
 */
export function assembleEvidenceSupportAssessment({ adapter, deterministicCheck, semanticObservation, evaluatorVersion } = {}) {
  const deterministic = deterministicCheck?.observation || {};
  const semantic = asObject(semanticObservation);
  const deterministicDimensions = asObject(deterministic.review_dimensions);
  const semanticDimensions = asObject(semantic.review_dimensions);
  const reviewDimensions = Object.fromEntries(REVIEW_DIMENSIONS.map(name => [
    name,
    deterministicDimensions[name] && deterministicDimensions[name] !== 'unknown'
      ? deterministicDimensions[name]
      : (semanticDimensions[name] || 'unknown')
  ]));
  const observation = {
    ...semantic,
    ...deterministic,
    review_dimensions: reviewDimensions,
    reason_codes: unique([
      ...(deterministic.reason_codes || []),
      ...(semantic.reason_codes || [])
    ])
  };
  // Deterministic owner values win even when a provider returns a competing
  // value.  Unknown is the only value that semantic adjudication may fill.
  for (const field of ['semantic_relevance', 'evidence_capability', 'support_level', 'semantic_relationship']) {
    if (deterministic[field] && deterministic[field] !== 'unknown') observation[field] = deterministic[field];
  }
  return createEvidenceSupportAssessment(adapter, observation, {
    evaluatorVersion: evaluatorVersion || EVIDENCE_SUPPORT_ROUTING_VERSION
  });
}

// ADR-020: semantic_relevance and evidence_capability ownership remain
// unresolved; this metadata is not a semantic fallback or authority change.
export const EVIDENCE_SUPPORT_FIELD_OWNERS = Object.freeze({
  semantic_relevance: { owner: 'STAGE17_RERANK', source_type: 'RETRIEVAL_DERIVED', current_producer: 'not_explicitly_emitted', consumer: 'EvidenceSupportAssessment' },
  retrieval_scores: { owner: 'STAGE17_RERANK', source_type: 'RETRIEVAL_DERIVED', current_producer: 'semantic-retrieval-reranker', consumer: 'ranking/audit' },
  source_eligibility: { owner: 'DETERMINISTIC_RULE_LAYER', source_type: 'RULE_DERIVED', current_producer: 'retrieval-source-eligibility', consumer: 'formal evidence lane' },
  review_dimensions: { owner: 'DETERMINISTIC_RULE_LAYER', source_type: 'RULE_DERIVED', current_producer: 'evidence-support-responsibility', consumer: 'EvidenceReview/Mapping' },
  semantic_relationship: { owner: 'DETERMINISTIC_RULE_OR_SEMANTIC_ADJUDICATION', source_type: 'RULE_DERIVED_OR_LLM_DERIVED', current_producer: 'responsibility router or semantic gateway', consumer: 'EvidenceSupportAssessment' },
  reason_codes: { owner: 'DETERMINISTIC_RULE_OR_SEMANTIC_ADJUDICATION', source_type: 'RULE_DERIVED_OR_LLM_DERIVED', current_producer: 'rule layer plus validated semantic output', consumer: 'Review/Mapping audit' },
  support_observations: { owner: 'SEMANTIC_ADJUDICATION_ONLY', source_type: 'LLM_DERIVED', current_producer: 'semantic gateway when called', consumer: 'Evidence Review' },
  technical_failure_status: { owner: 'RUNTIME_SYSTEM_LAYER', source_type: 'SYSTEM_DERIVED', current_producer: 'Gateway/Provider runtime', consumer: 'technical audit' },
  approved_evidence_fact: { owner: 'EVIDENCE_REVIEW_HUMAN_LIFECYCLE', source_type: 'HUMAN_DERIVED', current_producer: 'EvidenceSourceFactService', consumer: 'Mapping/Claim Gate' },
  requirement_evidence_mapping: { owner: 'CANONICAL_MAPPING_SERVICE', source_type: 'HUMAN_DERIVED', current_producer: 'RequirementEvidenceFactMappingService', consumer: 'Claim Gate' },
  safe_claim: { owner: 'CLAIM_GATE', source_type: 'RULE_DERIVED', current_producer: 'ClaimGateService', consumer: 'Writer Authorization' }
});
