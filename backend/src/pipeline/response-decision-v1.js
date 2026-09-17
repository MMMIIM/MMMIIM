import { projectRequirementResponseV223, RESPONSE_ROUTER_V223_IMPLEMENTATION_ID, RESPONSE_ROUTER_V223_VERSION } from './requirement-response-router-v2-2-3.js';

export const RESPONSE_DECISION_V1_VERSION = 'v43-response-decision-v1';
export const RESPONSE_MODES = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE']);
export const READINESS_STATUSES = Object.freeze([
  'READY_FOR_WRITER',
  'EVIDENCE_REQUIRED',
  'HUMAN_DECISION_REQUIRED',
  'COMPLIANCE_ACTION_REQUIRED',
  'NO_RESPONSE_REQUIRED',
  'NEED_REVIEW'
]);

const list = (value) => Array.isArray(value) ? value : [];

export function deriveReadinessStatus(decision = {}) {
  const mode = decision.response_mode;
  if (decision.decision_status === 'NEED_REVIEW' || mode === 'NEED_REVIEW' || !RESPONSE_MODES.includes(mode)) return 'NEED_REVIEW';
  if (decision.response_required === false) return 'NO_RESPONSE_REQUIRED';
  if (mode === 'COMPLIANCE') return 'COMPLIANCE_ACTION_REQUIRED';
  if (mode === 'EVIDENCE') return Number(decision.authority?.approved_claim_count || 0) > 0 ? 'READY_FOR_WRITER' : 'EVIDENCE_REQUIRED';
  if (mode === 'COMMITMENT') return Number(decision.authority?.approved_commitment_count || 0) > 0 ? 'READY_FOR_WRITER' : 'HUMAN_DECISION_REQUIRED';
  return 'READY_FOR_WRITER';
}

function authoritySummary(context = {}) {
  const claims = list(context.approved_claims || context.claims).filter((claim) => claim?.decision === 'approved' && claim?.current !== false && claim?.claim_type !== 'requirement_response');
  const commitments = list(context.approved_commitments || context.projectFacts).filter((fact) => fact?.fact_role === 'response_commitment' && fact?.review_status === 'approved' && fact?.conflict_status !== 'conflict' && fact?.current !== false && fact?.value_status !== 'pending');
  return { approved_claim_count: claims.length, approved_commitment_count: commitments.length };
}

/**
 * Canonical runtime/read-model projection around the existing V2.1 semantic
 * router. This adapter does not make authority decisions or persist state.
 */
export function projectResponseDecisionV1(requirement = {}, context = {}) {
  const canonicalInput = { ...requirement, requirement_id: requirement.requirement_id ?? requirement.canonical_requirement_id ?? requirement.req_id };
  const legacy = projectRequirementResponseV223(canonicalInput, context);
  const decision_status = legacy.response_mode === 'NEED_REVIEW' ? 'NEED_REVIEW' : 'ROUTED';
  const response_mode = decision_status === 'NEED_REVIEW' ? null : legacy.response_mode;
  const authority = authoritySummary(context);
  const decision = {
    contract_version: RESPONSE_DECISION_V1_VERSION,
    requirement_id: legacy.requirement_id,
    decision_status,
    response_mode,
    response_mode_legacy: legacy.response_mode,
    response_required: legacy.response_required,
    risk_tier: legacy.risk_tier,
    scoring_related: legacy.is_scoring_related === true,
    is_scoring_related: legacy.is_scoring_related === true,
    scoring_priority: legacy.scoring_priority,
    evidence_dependency: legacy.evidence_dependency,
    human_required: legacy.human_required,
    secondary_dependencies: list(legacy.secondary_dependencies),
    routing_reasons: list(legacy.routing_reasons),
    authority,
    readiness_status: null,
    projection_version: RESPONSE_ROUTER_V223_VERSION,
    implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID
  };
  decision.readiness_status = deriveReadinessStatus(decision);
  return Object.freeze(decision);
}

export const projectResponseDecision = projectResponseDecisionV1;
