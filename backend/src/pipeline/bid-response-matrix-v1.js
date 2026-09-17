import { projectResponseDecisionV1, deriveReadinessStatus } from './response-decision-v1.js';

const list = (value) => Array.isArray(value) ? value : [];
const rank = (value) => ({ P0: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[String(value || '').toUpperCase()] ?? 4);

export function deriveMatrixReadiness({ response_mode, response_required = true, approved_claim_count = 0, approved_commitment_count = 0, decision_status = 'ROUTED' } = {}) {
  return deriveReadinessStatus({ response_mode, response_required, decision_status, authority: { approved_claim_count, approved_commitment_count } });
}

function authorityPointers({ requirement, decision, claims = [], projectFacts = [], mappings = [], findings = [] }) {
  const id = String(requirement.req_id ?? requirement.requirement_id);
  const claimIds = claims.filter((claim) => list(claim.basis_requirement_ids || claim.requirement_ids || [claim.requirement_id]).map(String).includes(id) && claim.decision === 'approved' && claim.current !== false).map((claim) => claim.claim_id).filter(Boolean).sort();
  const factIds = projectFacts.filter((fact) => fact.project_fact_id && fact.current !== false).map((fact) => fact.project_fact_id).sort();
  const mappingIds = mappings.filter((mapping) => String(mapping.requirement_id) === id && mapping.decision === 'approved').map((mapping) => mapping.mapping_id).filter(Boolean).sort();
  const rowFindings = findings.filter((item) => list(item.requirement_ids || (item.requirement_id ? [item.requirement_id] : [])).map(String).includes(id));
  return { claim_ids: claimIds, fact_ids: factIds, mapping_ids: mappingIds, finding_count: rowFindings.length };
}

export function buildBidResponseMatrix({ requirements = [], responseDecisions = [], claims = [], projectFacts = [], mappings = [], findings = [] } = {}) {
  const byId = new Map(list(responseDecisions).map((item) => [String(item.requirement_id), item]));
  return list(requirements).map((requirement) => {
    const requirement_id = requirement.req_id ?? requirement.requirement_id;
    const routed = byId.get(String(requirement_id)) || projectResponseDecisionV1(requirement);
    const pointers = authorityPointers({ requirement, decision: routed, claims, projectFacts, mappings, findings });
    const decision = { ...routed, authority: { ...(routed.authority || {}), approved_claim_count: pointers.claim_ids.length, approved_commitment_count: projectFacts.filter((fact) => fact.fact_role === 'response_commitment' && fact.review_status === 'approved' && fact.current !== false && fact.value_status !== 'pending').length } };
    const readiness_status = deriveReadinessStatus(decision);
    const blocking_reason_codes = readiness_status === 'EVIDENCE_REQUIRED' ? ['APPROVED_ENTERPRISE_ASSERTION_REQUIRED'] : readiness_status === 'HUMAN_DECISION_REQUIRED' ? ['APPROVED_PROJECT_COMMITMENT_REQUIRED'] : readiness_status === 'COMPLIANCE_ACTION_REQUIRED' ? ['BID_COMPLIANCE_ACTION_REQUIRED'] : readiness_status === 'NEED_REVIEW' ? ['ROUTER_ABSTENTION'] : [];
    const writer_target = readiness_status === 'READY_FOR_WRITER' && decision.response_mode !== 'COMPLIANCE' ? { eligible: true, section_key: requirement.target_section_id ?? requirement.target_section ?? null } : { eligible: false, section_key: null };
    return {
      requirement_id,
      requirement_text: requirement.text ?? requirement.content ?? '',
      source: { page: requirement.source_page ?? requirement.source_page_start ?? null, clause_ref: requirement.source_chunk_id ?? requirement.source_ref ?? null, source_hash: requirement.source_hash ?? null, source_verified: requirement.source_verified === true },
      content_category: requirement.requirement_category ?? requirement.category ?? null,
      response_decision: decision,
      readiness_status,
      blocking_reason_codes,
      authority: { ...pointers, creates_authority: false },
      writer_target,
      response_required: decision.response_required !== false,
      scoring_related: decision.scoring_related === true,
      mandatory: requirement.is_mandatory === true || requirement.mandatory === true
    };
  }).sort((a, b) => rank(a.response_decision.risk_tier) - rank(b.response_decision.risk_tier) || String(a.requirement_id).localeCompare(String(b.requirement_id)));
}
