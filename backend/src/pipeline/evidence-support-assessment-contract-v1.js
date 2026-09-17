import { AppError } from '../errors.js';
import {
  EVIDENCE_CAPABILITY,
  EVIDENCE_REVIEW_REASON_CODES,
  EVIDENCE_SUPPORT_LEVEL,
  REVIEW_DIMENSIONS,
  REVIEW_DIMENSION_VALUES,
  SEMANTIC_RELEVANCE
} from './evidence-review-contract.js';
import {
  MAPPING_DIMENSIONS,
  MAPPING_REASON_CODES,
  MAPPING_RELATIONSHIPS,
  MAPPING_SUPPORT_LEVELS
} from './requirement-evidence-mapping-contract-v1.js';
import { hashSource } from './source-location-resolver.js';

export const EVIDENCE_SUPPORT_ASSESSMENT_VERSION = 'evidence-support-assessment-v1';
export const EVIDENCE_SUPPORT_ADAPTER_VERSION = 'evidence-support-adapter-v1';
export const EVIDENCE_SUPPORT_ASSESSMENT_STATUSES = Object.freeze(['available', 'unavailable']);
export const EVIDENCE_SUPPORT_OBSERVATION_TYPES = Object.freeze([
  'direct_support',
  'partial_support',
  'context',
  'contradiction'
]);
export const EVIDENCE_SUPPORT_REASON_CODES = Object.freeze([
  ...new Set([
    ...EVIDENCE_REVIEW_REASON_CODES,
    ...MAPPING_REASON_CODES,
    'ASSESSMENT_UNAVAILABLE'
  ])
]);
export const EVIDENCE_SUFFICIENCY_STATUSES = Object.freeze([
  'EVIDENCE_REVIEW_READY',
  'NO_RELEVANT_EVIDENCE',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'ASSESSMENT_UNAVAILABLE'
]);

const SHA256 = /^[0-9a-f]{64}$/;
const hash = hashSource;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const clean = value => String(value ?? '').trim();
const exactText = value => String(value ?? '');
const unique = values => [...new Set(values)];

function invalid(message, code = 'EVIDENCE_SUPPORT_ASSESSMENT_INVALID') {
  throw new AppError(code, message, 422);
}

function required(value, name, code = 'EVIDENCE_SUPPORT_INPUT_INVALID') {
  const result = clean(value);
  if (!result) invalid(`${name} 不能为空。`, code);
  return result;
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) invalid(`${name} 值无效。`);
  return value;
}

function normalizeHash(value, sourceText, name) {
  const actual = hash(sourceText);
  if (value != null && (!SHA256.test(String(value)) || String(value) !== actual)) {
    invalid(`${name} 与来源原文不一致。`, 'EVIDENCE_SUPPORT_SOURCE_HASH_INVALID');
  }
  return actual;
}

function normalizeRequirement(requirement) {
  if (!object(requirement)) invalid('Requirement 必须是对象。');
  return {
    requirement_id: required(requirement.requirement_id ?? requirement.req_id, 'requirement_id'),
    text: required(requirement.text ?? requirement.requirement_text, 'requirement.text'),
    text_hash: normalizeHash(requirement.text_hash ?? requirement.requirement_hash, requirement.text ?? requirement.requirement_text, 'requirement_hash')
  };
}

function normalizeSource({ sourceId, sourceSpanId, sourceText, sourceTextHash, kind, lineage = {}, material = {} }) {
  const text = exactText(sourceText);
  if (!text.trim()) invalid('source_text 不能为空。', 'EVIDENCE_SUPPORT_INPUT_INVALID');
  return {
    source_id: required(sourceId, 'source_id'),
    source_kind: oneOf(kind, ['retrieval_candidate', 'evidence_fact'], 'source_kind'),
    source_span_id: required(sourceSpanId, 'source_span_id'),
    source_text_hash: normalizeHash(sourceTextHash, text, 'source_text_hash'),
    lineage: object(lineage) ? structuredClone(lineage) : {},
    material: object(material) ? structuredClone(material) : {},
    _source_text: text
  };
}

function publicSource(source) {
  const { _source_text: ignored, ...result } = source;
  return result;
}

function adaptedInput(input, expectedKind) {
  if (!object(input) || input.adapter_version !== EVIDENCE_SUPPORT_ADAPTER_VERSION) {
    invalid('必须使用 EvidenceSupportAssessment 官方 Input Adapter。', 'EVIDENCE_SUPPORT_ADAPTER_REQUIRED');
  }
  if (input.source?.source_kind !== expectedKind) {
    invalid(`输入类型必须是 ${expectedKind}。`, 'EVIDENCE_SUPPORT_INPUT_KIND_INVALID');
  }
  return input;
}

export function adaptRetrievalCandidate({ requirement, candidate, sourceSpan, material = {}, lineage = {} } = {}) {
  if (!object(candidate)) invalid('Retrieval Candidate 必须是对象。', 'EVIDENCE_SUPPORT_INPUT_INVALID');
  if (!object(sourceSpan)) invalid('Source Span 必须是对象。', 'EVIDENCE_SUPPORT_INPUT_INVALID');
  const candidateId = candidate.candidate_id ?? candidate.retrieval_candidate_id ?? candidate.chunk_id;
  const sourceText = sourceSpan.source_text ?? candidate.source_text ?? candidate.source_excerpt;
  const source = normalizeSource({
    sourceId: candidateId,
    sourceSpanId: sourceSpan.source_span_id ?? sourceSpan.span_id,
    sourceText,
    sourceTextHash: sourceSpan.source_text_hash ?? sourceSpan.source_hash,
    kind: 'retrieval_candidate',
    lineage: { ...lineage, ...(object(sourceSpan.lineage) ? sourceSpan.lineage : {}) },
    material: { ...material }
  });
  return {
    adapter_version: EVIDENCE_SUPPORT_ADAPTER_VERSION,
    input_kind: 'retrieval_candidate',
    requirement: normalizeRequirement(requirement),
    source: publicSource(source),
    _source_text: source._source_text,
    candidate_metadata: structuredClone(candidate.metadata || candidate.material_metadata || {})
  };
}

export function adaptApprovedEvidenceFact({ requirement, fact, sourceSpan, lineage = {}, material = {} } = {}) {
  if (!object(fact)) invalid('Evidence Fact 必须是对象。', 'EVIDENCE_SUPPORT_INPUT_INVALID');
  if (fact.review_status !== 'approved') {
    invalid('只有 approved Evidence Fact 才能使用 Fact Adapter。', 'EVIDENCE_SUPPORT_FACT_NOT_APPROVED');
  }
  if (!object(sourceSpan)) invalid('Evidence Fact Adapter 必须提供 Source Span。', 'EVIDENCE_SUPPORT_INPUT_INVALID');
  const sourceText = sourceSpan.source_text ?? fact.source_text;
  const source = normalizeSource({
    sourceId: fact.fact_id,
    sourceSpanId: fact.source_span_id ?? sourceSpan.source_span_id ?? sourceSpan.span_id,
    sourceText,
    sourceTextHash: sourceSpan.source_text_hash ?? fact.source?.source_text_hash ?? fact.source_hash,
    kind: 'evidence_fact',
    lineage: { ...lineage, ...(object(fact.source) ? fact.source : {}), ...(object(sourceSpan.lineage) ? sourceSpan.lineage : {}) },
    material: { ...material }
  });
  return {
    adapter_version: EVIDENCE_SUPPORT_ADAPTER_VERSION,
    input_kind: 'evidence_fact',
    requirement: normalizeRequirement(requirement),
    source: publicSource(source),
    _source_text: source._source_text,
    fact: {
      fact_id: required(fact.fact_id, 'fact_id'),
      payload_hash: required(fact.payload_hash, 'fact.payload_hash'),
      contract_version: required(fact.contract_version, 'fact.contract_version'),
      review_status: 'approved'
    }
  };
}

function normalizeDimensions(value = {}) {
  if (!object(value)) invalid('review_dimensions 必须是对象。');
  return Object.fromEntries(REVIEW_DIMENSIONS.map(name => [
    name,
    oneOf(value[name] ?? 'unknown', REVIEW_DIMENSION_VALUES, `review_dimensions.${name}`)
  ]));
}

function normalizeReasonCodes(value = []) {
  if (!Array.isArray(value)) invalid('reason_codes 必须是数组。');
  const result = unique(value.map(code => required(code, 'reason_code')));
  for (const code of result) oneOf(code, EVIDENCE_SUPPORT_REASON_CODES, 'reason_code');
  return result;
}

function normalizeObservation(item, source, observationTypeName) {
  if (!object(item)) invalid(`${observationTypeName} 必须是对象。`, 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  const excerpt = required(item.support_excerpt ?? item.source_text, `${observationTypeName}.support_excerpt`, 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  if (!source._source_text.includes(excerpt)) {
    invalid(`${observationTypeName}.support_excerpt 必须来自 source_text。`, 'EVIDENCE_SUPPORT_OBSERVATION_UNGROUNDED');
  }
  const excerptHash = normalizeHash(item.support_excerpt_hash, excerpt, `${observationTypeName}.support_excerpt_hash`);
  const sourceId = required(item.source_id ?? source.source_id, `${observationTypeName}.source_id`, 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  const sourceSpanId = required(item.source_span_id ?? source.source_span_id, `${observationTypeName}.source_span_id`, 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  if (sourceId !== source.source_id || sourceSpanId !== source.source_span_id) {
    invalid(`${observationTypeName} 不能引用其他来源。`, 'EVIDENCE_SUPPORT_OBSERVATION_LINEAGE_INVALID');
  }
  return {
    source_id: sourceId,
    source_span_id: sourceSpanId,
    support_excerpt: excerpt,
    support_excerpt_hash: excerptHash,
    ...(observationTypeName === 'support_observations'
      ? { observation_type: oneOf(item.observation_type ?? 'direct_support', EVIDENCE_SUPPORT_OBSERVATION_TYPES, 'observation_type') }
      : {
          conflict_group_id: required(item.conflict_group_id, 'conflict_group_id', 'EVIDENCE_SUPPORT_CONFLICT_INVALID'),
          dimension: required(item.dimension, 'conflict.dimension', 'EVIDENCE_SUPPORT_CONFLICT_INVALID'),
          observed_value: item.observed_value == null ? null : structuredClone(item.observed_value)
        }),
    reason_codes: normalizeReasonCodes(item.reason_codes || [])
  };
}

function deriveRelationship({ semanticRelationship, supportLevel, semanticRelevance }) {
  if (semanticRelationship != null) return oneOf(semanticRelationship, MAPPING_RELATIONSHIPS, 'semantic_relationship');
  if (supportLevel === 'full_support') return 'direct';
  if (supportLevel === 'partial_support') return 'partial';
  if (supportLevel === 'conflict') return 'conflict';
  if (supportLevel === 'reference_only') return 'related';
  if (semanticRelevance === 'irrelevant') return 'unrelated';
  return 'unknown';
}

/**
 * Shared cross-field rule for the Gateway transport and canonical assessment.
 * The full rationale is recorded in ADR-020; keep both validation boundaries
 * behaviorally aligned instead of maintaining two independent rule copies.
 */
export function getEvidenceSupportInvariantViolation({
  semanticRelevance,
  evidenceCapability,
  supportLevel,
  semanticRelationship
} = {}) {
  const unknownCore = semanticRelevance === 'unknown'
    || evidenceCapability === 'unknown'
    || supportLevel === 'unknown';
  if (unknownCore && (semanticRelationship === 'direct' || supportLevel === 'full_support')) {
    return 'unknown core values cannot be paired with direct or full_support';
  }
  if (semanticRelationship === 'direct'
    && (semanticRelevance !== 'relevant'
      || evidenceCapability !== 'capable'
      || supportLevel !== 'full_support')) {
    return 'direct requires relevant/capable/full_support';
  }
  if (supportLevel === 'full_support' && semanticRelationship !== 'direct') {
    return 'full_support requires direct';
  }
  return null;
}

export function createEvidenceSupportAssessment(input, observation = {}, { evaluatorVersion = 'fixture-v1' } = {}) {
  if (!object(input)) invalid('Assessment input 必须是对象。');
  if (!object(observation)) invalid('Assessment observation 必须是对象。', 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  if (!['retrieval_candidate', 'evidence_fact'].includes(input.input_kind)) {
    invalid('Assessment input_kind 无效。', 'EVIDENCE_SUPPORT_INPUT_KIND_INVALID');
  }
  const normalizedInput = adaptedInput(input, input.input_kind);
  const source = normalizedInput.source;
  const sourceText = normalizedInput._source_text;
  if (!sourceText) invalid('Assessment input 缺少 source_text。');
  const assessmentStatus = oneOf(observation.assessment_status ?? 'available', EVIDENCE_SUPPORT_ASSESSMENT_STATUSES, 'assessment_status');
  let semanticRelevance = oneOf(observation.semantic_relevance ?? 'unknown', SEMANTIC_RELEVANCE, 'semantic_relevance');
  let capability = oneOf(observation.evidence_capability ?? 'unknown', EVIDENCE_CAPABILITY, 'evidence_capability');
  let supportLevel = oneOf(observation.support_level ?? 'unknown', EVIDENCE_SUPPORT_LEVEL, 'support_level');
  const dimensions = normalizeDimensions(observation.review_dimensions || observation.dimensions || {});
  const reasonCodes = normalizeReasonCodes(observation.reason_codes || []);
  if (observation.support_observations != null && !Array.isArray(observation.support_observations)) {
    invalid('support_observations 必须是数组。', 'EVIDENCE_SUPPORT_OBSERVATION_INVALID');
  }
  if (observation.conflict_observations != null && !Array.isArray(observation.conflict_observations)) {
    invalid('conflict_observations 必须是数组。', 'EVIDENCE_SUPPORT_CONFLICT_INVALID');
  }
  const supportObservations = (observation.support_observations || []).map(item => normalizeObservation(item, { ...source, _source_text: sourceText }, 'support_observations'));
  const conflictObservations = (observation.conflict_observations || []).map(item => normalizeObservation(item, { ...source, _source_text: sourceText }, 'conflict_observations'));
  if (assessmentStatus === 'unavailable') {
    semanticRelevance = 'unknown';
    capability = 'unknown';
    supportLevel = 'unknown';
  }
  const relationship = assessmentStatus === 'unavailable'
    ? 'unknown'
    : deriveRelationship({
      semanticRelationship: observation.semantic_relationship,
      supportLevel,
      semanticRelevance
    });
  // Cross-field business invariant; keep this aligned with the Gateway
  // validator. See ADR-020.
  const invariantViolation = getEvidenceSupportInvariantViolation({
    semanticRelevance,
    evidenceCapability: capability,
    supportLevel,
    semanticRelationship: relationship
  });
  if (invariantViolation) invalid(invariantViolation, 'EVIDENCE_SUPPORT_ASSESSMENT_INVALID');
  const assessmentId = `ESA-${hash([
    normalizedInput.requirement.requirement_id,
    source.source_id,
    source.source_span_id,
    normalizedInput.requirement.text_hash,
    source.source_text_hash,
    EVIDENCE_SUPPORT_ASSESSMENT_VERSION,
    evaluatorVersion
  ].join('|')).slice(0, 32).toUpperCase()}`;
  return {
    assessment_id: assessmentId,
    assessment_version: EVIDENCE_SUPPORT_ASSESSMENT_VERSION,
    evaluator_version: String(evaluatorVersion || 'fixture-v1'),
    assessment_status: assessmentStatus,
    input_kind: normalizedInput.input_kind,
    requirement: { ...normalizedInput.requirement },
    source: publicSource(source),
    semantic_relevance: semanticRelevance,
    evidence_capability: capability,
    support_level: supportLevel,
    semantic_relationship: relationship,
    review_dimensions: dimensions,
    reason_codes: reasonCodes,
    support_observations: supportObservations,
    conflict_observations: conflictObservations
  };
}

export class ProviderNeutralEvidenceSupportEvaluator {
  constructor({ version = 'provider-neutral-support-stub-v1' } = {}) {
    this.version = version;
  }

  async assess(input) {
    return createEvidenceSupportAssessment(input, {
      assessment_status: 'unavailable',
      reason_codes: ['ASSESSMENT_UNAVAILABLE']
    }, { evaluatorVersion: this.version });
  }

  async evaluate(input) {
    return this.assess(input);
  }
}

function reasonForReview(code) {
  if (EVIDENCE_REVIEW_REASON_CODES.includes(code)) return code;
  if (code === 'ASSESSMENT_UNAVAILABLE') return 'HUMAN_REVIEW_REQUIRED';
  if (MAPPING_REASON_CODES.includes(code)) return code;
  return null;
}

export function toEvidenceReviewAssessment(assessment) {
  if (!object(assessment) || assessment.assessment_version !== EVIDENCE_SUPPORT_ASSESSMENT_VERSION) {
    invalid('不是有效的 EvidenceSupportAssessment。', 'EVIDENCE_SUPPORT_ASSESSMENT_REQUIRED');
  }
  const unavailable = assessment.assessment_status !== 'available';
  const reasons = unique((assessment.reason_codes || []).map(reasonForReview).filter(Boolean));
  if (unavailable && !reasons.includes('HUMAN_REVIEW_REQUIRED')) reasons.push('HUMAN_REVIEW_REQUIRED');
  return {
    assessment_id: assessment.assessment_id,
    semantic_relationship: unavailable ? 'unknown' : assessment.semantic_relationship,
    semantic_relevance: unavailable ? 'unknown' : assessment.semantic_relevance,
    evidence_capability: unavailable ? 'unknown' : assessment.evidence_capability,
    support_level: unavailable ? 'unknown' : assessment.support_level,
    review_dimensions: structuredClone(assessment.review_dimensions),
    reason_codes: reasons,
    requires_human_review: true,
    semantic_reviewer_version: assessment.evaluator_version,
    support_observations: structuredClone(assessment.support_observations),
    conflict_observations: structuredClone(assessment.conflict_observations)
  };
}

function reasonForMapping(code) {
  if (MAPPING_REASON_CODES.includes(code)) return code;
  if (code === 'REFERENCE_ONLY_SOURCE') return 'REFERENCE_ONLY';
  if (code === 'SOURCE_NOT_EVIDENCE_CAPABLE' || code === 'SEMANTICALLY_IRRELEVANT') return 'SUPPORT_INSUFFICIENT';
  if (code === 'ASSESSMENT_UNAVAILABLE') return 'HUMAN_REVIEW_REQUIRED';
  return null;
}

export function toRequirementEvidenceMappingCandidate(assessment) {
  if (!object(assessment) || assessment.assessment_version !== EVIDENCE_SUPPORT_ASSESSMENT_VERSION) {
    invalid('不是有效的 EvidenceSupportAssessment。', 'EVIDENCE_SUPPORT_ASSESSMENT_REQUIRED');
  }
  if (assessment.input_kind !== 'evidence_fact' || assessment.source.source_kind !== 'evidence_fact') {
    invalid('Formal Mapping 只能消费 Evidence Fact Adapter 结果。', 'EVIDENCE_SUPPORT_MAPPING_FACT_REQUIRED');
  }
  const reasons = unique((assessment.reason_codes || []).map(reasonForMapping).filter(Boolean));
  const dimensions = Object.fromEntries(MAPPING_DIMENSIONS.map(name => [name, assessment.review_dimensions[name] || 'unknown']));
  return {
    assessment_id: assessment.assessment_id,
    semantic_relationship: assessment.assessment_status === 'available' ? assessment.semantic_relationship : 'unknown',
    support_level: assessment.assessment_status === 'available' ? assessment.support_level : 'unknown',
    dimensions,
    reason_codes: reasons,
    source_type: 'system_proposed',
    support_observations: structuredClone(assessment.support_observations),
    conflict_observations: structuredClone(assessment.conflict_observations)
  };
}

function conflictGroups(assessments) {
  const groups = new Map();
  for (const assessment of assessments) {
    for (const observation of assessment.conflict_observations) {
      const key = observation.conflict_group_id;
      const group = groups.get(key) || {
        conflict_group_id: key,
        dimension: observation.dimension,
        observations: [],
        source_ids: new Set(),
        values: new Set()
      };
      group.observations.push({ ...observation, assessment_id: assessment.assessment_id });
      group.source_ids.add(observation.source_id);
      group.values.add(JSON.stringify(observation.observed_value));
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(group => ({
    conflict_group_id: group.conflict_group_id,
    dimension: group.dimension,
    observations: group.observations,
    blocking: group.source_ids.size >= 2 && group.values.size >= 2
  }));
}

export function aggregateEvidenceSufficiency(assessments = []) {
  if (!Array.isArray(assessments)) invalid('assessments 必须是数组。', 'EVIDENCE_SUPPORT_AGGREGATION_INVALID');
  if (assessments.some(item => !object(item) || item.assessment_version !== EVIDENCE_SUPPORT_ASSESSMENT_VERSION)) {
    invalid('assessments 包含非 EvidenceSupportAssessment。', 'EVIDENCE_SUPPORT_ASSESSMENT_REQUIRED');
  }
  if (!assessments.length) {
    return { status: 'NO_RELEVANT_EVIDENCE', assessment_count: 0, blocking_conflicts: [], reason_codes: [] };
  }
  if (assessments.some(item => item.assessment_status !== 'available')) {
    return { status: 'ASSESSMENT_UNAVAILABLE', assessment_count: assessments.length, blocking_conflicts: [], reason_codes: ['ASSESSMENT_UNAVAILABLE'] };
  }
  const groups = conflictGroups(assessments);
  const blocking = groups.filter(group => group.blocking);
  const hasConflictObservation = assessments.some(item => item.conflict_observations.length > 0);
  if (blocking.length || hasConflictObservation || assessments.some(item => item.semantic_relationship === 'conflict' || item.support_level === 'conflict')) {
    const conflictReasons = unique([
      ...groups.flatMap(group => group.observations.flatMap(item => item.reason_codes || [])),
      ...assessments.flatMap(item => item.reason_codes || [])
    ]);
    return {
      status: 'CONFLICTING_EVIDENCE',
      assessment_count: assessments.length,
      blocking_conflicts: blocking.length ? blocking : groups,
      reason_codes: conflictReasons.length ? conflictReasons : ['HUMAN_REVIEW_REQUIRED']
    };
  }
  const hasUnknownSemanticAssessment = assessments.some(item => (
    item.semantic_relevance === 'unknown'
    || item.evidence_capability === 'unknown'
    || item.support_level === 'unknown'
    || item.semantic_relationship === 'unknown'
  ));
  if (hasUnknownSemanticAssessment) {
    return { status: 'ASSESSMENT_UNAVAILABLE', assessment_count: assessments.length, blocking_conflicts: [], reason_codes: ['ASSESSMENT_UNAVAILABLE'] };
  }
  const allNonRelevant = assessments.every(item => (
    item.semantic_relevance === 'irrelevant'
    || item.semantic_relationship === 'unrelated'
    || item.support_level === 'reference_only'
  ));
  if (allNonRelevant) {
    return { status: 'NO_RELEVANT_EVIDENCE', assessment_count: assessments.length, blocking_conflicts: [], reason_codes: [] };
  }
  const hasDirectSupport = assessments.some(item => item.semantic_relationship === 'direct' && item.support_level === 'full_support');
  if (hasDirectSupport) {
    return { status: 'EVIDENCE_REVIEW_READY', assessment_count: assessments.length, blocking_conflicts: [], reason_codes: [] };
  }
  return { status: 'INSUFFICIENT_EVIDENCE', assessment_count: assessments.length, blocking_conflicts: [], reason_codes: ['SUPPORT_INSUFFICIENT'] };
}

export function assessmentSupportObservation(input, observation) {
  return createEvidenceSupportAssessment(input, {
    semantic_relevance: 'relevant',
    evidence_capability: 'capable',
    support_level: observation.observation_type === 'direct_support' ? 'full_support' : 'partial_support',
    semantic_relationship: observation.observation_type === 'direct_support' ? 'direct' : 'partial',
    support_observations: [observation],
    review_dimensions: {},
    reason_codes: []
  }, { evaluatorVersion: 'fixture-support-observation-v1' });
}
