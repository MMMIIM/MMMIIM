import { AppError } from '../errors.js';

export const MAPPING_DECISION_POLICY_VERSION = 'mapping-decision-policy-v1';

const TRANSPORT_TO_CANONICAL_DIMENSION = Object.freeze({
  subject: 'subject_match',
  scope: 'scope_match',
  status: 'status_match',
  quantity: 'quantitative_match',
  entity: 'entity_match',
  validity: 'validity_match'
});

const DECISION_PROJECTION = Object.freeze({
  direct_full: { relationship: 'direct', support: 'full_support' },
  partial_support: { relationship: 'partial', support: 'partial_support' },
  related_reference: { relationship: 'related', support: 'reference_only' },
  related_insufficient: { relationship: 'related', support: 'insufficient' },
  conflict: { relationship: 'conflict', support: 'conflict' },
  unrelated: { relationship: 'unrelated', support: 'insufficient' },
  unknown: { relationship: 'unknown', support: 'unknown' }
});

const DIMENSION_REASON = Object.freeze({
  subject: 'SUBJECT_MISMATCH',
  scope: 'SCOPE_MISMATCH',
  status: 'STATUS_MISMATCH',
  quantity: 'QUANTITATIVE_MISMATCH',
  entity: 'ENTITY_MISMATCH',
  validity: 'VALIDITY_MISMATCH'
});

const DIMENSION_FIELDS = Object.freeze([
  'subject_match', 'scope_match', 'status_match',
  'quantitative_match', 'entity_match', 'validity_match'
]);

const UNKNOWN_REASON = Object.freeze({
  status: 'STATUS_UNKNOWN',
  quantity: 'QUANTITATIVE_UNKNOWN',
  validity: 'VALIDITY_UNKNOWN'
});

const HIGH_RISK_PATTERN = /SLA|可用性|可用率|性能|并发|响应时间|恢复时间|服务期限|期限|工期|人员|资质|历史案例|第三方|品牌|型号|价格|商业|mandatory|qualification|availability|performance|concurrency/i;

function unique(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value))];
}

function dimensionValue(value) {
  return ['match', 'mismatch', 'unknown', 'not_applicable'].includes(value) ? value : 'unknown';
}

function upstreamRank(value) {
  return ({ conflict: 0, insufficient: 1, reference_only: 1, unknown: 1, partial_support: 2, full_support: 3 }[value] ?? 1);
}

function hasHighRiskRequirement(requirement = {}) {
  return HIGH_RISK_PATTERN.test(String(requirement.text || requirement.requirement_text || ''))
    || requirement.high_risk === true;
}

/**
 * Convert the model-only six-dimension result into the existing canonical
 * Mapping candidate.  The model never supplies lifecycle, IDs, provenance or
 * reason codes; all of those values come from the Backend context.
 */
export function projectMappingTransportResult(result, context = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new AppError('MAPPING_RESULT_INVALID', 'Mapping semantic result must be an object.', 422);
  }
  const projection = DECISION_PROJECTION[result.decision];
  if (!projection) throw new AppError('MAPPING_DECISION_INVALID', 'Mapping semantic decision is invalid.', 422);
  const dimensions = {};
  const reasonCodes = [];
  for (const [transportName, canonicalName] of Object.entries(TRANSPORT_TO_CANONICAL_DIMENSION)) {
    const value = dimensionValue(result.dimensions?.[transportName]);
    dimensions[canonicalName] = value;
    if (value === 'mismatch') reasonCodes.push(DIMENSION_REASON[transportName]);
    if (value === 'unknown' && UNKNOWN_REASON[transportName]) reasonCodes.push(UNKNOWN_REASON[transportName]);
  }
  dimensions.support_sufficiency = projection.support === 'unknown' ? 'unknown' : 'match';
  if (projection.relationship === 'related' && projection.support === 'reference_only') reasonCodes.push('REFERENCE_ONLY');
  if (projection.support === 'partial_support') reasonCodes.push('SUPPORT_PARTIAL');
  if (projection.support === 'insufficient') reasonCodes.push('SUPPORT_INSUFFICIENT');
  if (projection.relationship === 'unknown') reasonCodes.push('RELATIONSHIP_UNKNOWN');
  if (projection.relationship === 'conflict') reasonCodes.push('QUANTITATIVE_MISMATCH');
  return {
    ...context,
    evidence_fact_id: context.evidence_fact_id || context.fact_id || result.fact_ref,
    fact_id: context.fact_id || context.evidence_fact_id || result.fact_ref,
    semantic_relationship: projection.relationship,
    support_level: projection.support,
    dimensions,
    reason_codes: unique(reasonCodes),
    source_type: context.source_type || 'system_proposed'
  };
}

export const projectMappingResult = projectMappingTransportResult;

function valuesOf(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)).sort();
}

function statusValue(value) {
  const candidate = value?.status ?? value;
  return candidate === undefined || candidate === null || candidate === '' || candidate === 'unknown'
    ? null : String(candidate);
}

function entityValues(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (!item || typeof item !== 'object') return String(item);
    return String(item.name || item.identifier || item.type || '');
  }).filter(Boolean).sort();
}

/** Apply only explicit structured mismatches supplied by the Backend. */
export function applyDeterministicMappingOverrides(mapping, { requirement = {}, fact = {} } = {}) {
  const result = { ...mapping, dimensions: { ...(mapping.dimensions || {}) }, reason_codes: unique(mapping.reason_codes || []) };
  const requirementSubject = requirement.subject?.name || requirement.subject_name;
  const factSubject = fact.subject?.name || fact.subject_name;
  if (requirementSubject && factSubject && String(requirementSubject) !== String(factSubject)) {
    result.dimensions.subject_match = 'mismatch';
    result.reason_codes = unique([...result.reason_codes, 'SUBJECT_MISMATCH']);
  }
  const requirementScopes = valuesOf(requirement.scopes || requirement.scope);
  const factScopes = valuesOf(fact.scopes || fact.scope);
  if (requirementScopes.length && factScopes.length && !requirementScopes.some(value => factScopes.includes(value))) {
    result.dimensions.scope_match = 'mismatch';
    result.reason_codes = unique([...result.reason_codes, 'SCOPE_MISMATCH']);
  }
  const requirementQuantities = valuesOf(requirement.quantities || requirement.quantity);
  const factQuantities = valuesOf(fact.quantities || fact.quantity);
  if (requirementQuantities.length && factQuantities.length && !requirementQuantities.some(value => factQuantities.includes(value))) {
    result.dimensions.quantitative_match = 'mismatch';
    result.semantic_relationship = 'conflict';
    result.support_level = 'conflict';
    result.reason_codes = unique([...result.reason_codes, 'QUANTITATIVE_MISMATCH']);
  }
  const requirementStatus = statusValue(requirement.status);
  const factStatus = statusValue(fact.fact_status || fact.status);
  if (requirementStatus && factStatus && requirementStatus !== factStatus) {
    result.dimensions.status_match = 'mismatch';
    result.reason_codes = unique([...result.reason_codes, 'STATUS_MISMATCH']);
  }
  const requirementValidity = statusValue(requirement.validity);
  const factValidity = statusValue(fact.validity);
  if (requirementValidity && factValidity && requirementValidity !== factValidity) {
    result.dimensions.validity_match = 'mismatch';
    result.reason_codes = unique([...result.reason_codes, 'VALIDITY_MISMATCH']);
  }
  const requirementEntities = entityValues(requirement.entities || requirement.entity);
  const factEntities = entityValues(fact.entities || fact.entity);
  if (requirementEntities.length && factEntities.length
    && !requirementEntities.some(value => factEntities.includes(value))) {
    result.dimensions.entity_match = 'mismatch';
    result.reason_codes = unique([...result.reason_codes, 'ENTITY_MISMATCH']);
  }
  return result;
}

/**
 * Apply deterministic Backend policy after semantic projection.  It caps
 * support at the approved upstream boundary and records machine-review state;
 * it does not infer semantic fields from the model output.
 */
export function applyMappingDecisionPolicy(mapping, {
  upstream_support_level = null,
  requirement = null,
  upstream_allows_full = true,
  high_risk = null
} = {}) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new AppError('MAPPING_POLICY_INPUT_INVALID', 'Mapping policy input must be an object.', 422);
  }
  const result = { ...mapping, reason_codes: unique(mapping.reason_codes || []) };
  const dimensions = { ...(mapping.dimensions || {}) };
  const hasMismatch = Object.values(dimensions).some(value => value === 'mismatch');
  const hasCriticalUnknown = DIMENSION_FIELDS.some(name => dimensions[name] === 'unknown');

  if (hasMismatch && result.support_level === 'full_support') {
    result.semantic_relationship = dimensions.quantitative_match === 'mismatch' ? 'conflict' : 'partial';
    result.support_level = dimensions.quantitative_match === 'mismatch' ? 'conflict' : 'partial_support';
    result.reason_codes = unique([...result.reason_codes, 'HUMAN_REVIEW_REQUIRED', 'SUPPORT_PARTIAL']);
  }
  if (upstream_support_level && upstreamRank(upstream_support_level) < upstreamRank(result.support_level)) {
    if (upstream_support_level === 'conflict') {
      result.semantic_relationship = 'conflict';
      result.support_level = 'conflict';
    } else if (upstream_support_level === 'partial_support') {
      result.semantic_relationship = 'partial';
      result.support_level = 'partial_support';
    } else if (['reference_only'].includes(upstream_support_level)) {
      result.semantic_relationship = 'related';
      result.support_level = 'reference_only';
    } else {
      result.semantic_relationship = 'unknown';
      result.support_level = upstream_support_level === 'insufficient' ? 'insufficient' : 'unknown';
    }
    result.reason_codes = unique([...result.reason_codes, 'SUPPORT_PARTIAL', 'HUMAN_REVIEW_REQUIRED']);
  }
  if (!upstream_allows_full && result.support_level === 'full_support') {
    result.semantic_relationship = 'partial';
    result.support_level = 'partial_support';
    result.reason_codes = unique([...result.reason_codes, 'SUPPORT_PARTIAL', 'HUMAN_REVIEW_REQUIRED']);
  }

  const risk = high_risk ?? hasHighRiskRequirement(requirement || {});
  const canAutoFull = result.semantic_relationship === 'direct'
    && result.support_level === 'full_support'
    && !hasMismatch
    && !hasCriticalUnknown
    && upstream_allows_full
    && !risk;
  const autoApprove = result.semantic_relationship === 'partial' && result.support_level === 'partial_support'
    || result.semantic_relationship === 'related' && ['reference_only', 'insufficient'].includes(result.support_level)
    || result.semantic_relationship === 'conflict' && result.support_level === 'conflict';
  if (result.semantic_relationship === 'unrelated') {
    result.review_status = 'rejected';
  } else if (canAutoFull || autoApprove) {
    result.review_status = 'approved';
  } else {
    result.review_status = 'proposed';
    result.reason_codes = unique([...result.reason_codes, 'HUMAN_REVIEW_REQUIRED']);
  }
  result.reviewer_type = 'machine';
  result.evaluator_version = result.evaluator_version || MAPPING_DECISION_POLICY_VERSION;
  if (result.review_status === 'approved' || result.review_status === 'rejected') {
    result.reviewed_by = result.evaluator_version;
    result.reviewed_at = result.reviewed_at || new Date().toISOString();
  }
  return result;
}
