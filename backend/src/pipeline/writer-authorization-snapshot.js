import { createHash } from 'node:crypto';

export const WRITER_AUTHORIZATION_SNAPSHOT_VERSION = 'writer-authorization-snapshot-v1';

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const stringList = value => Array.isArray(value) ? [...new Set(value.map(item => String(item ?? '').trim()).filter(Boolean))].sort() : [];
const orderedList = value => Array.isArray(value) ? value.map(item => String(item ?? '')).filter(Boolean) : [];
const valueHash = value => value === null || value === undefined ? null : hash(value);
const by = key => (left, right) => String(left?.[key] ?? '').localeCompare(String(right?.[key] ?? ''));

function projectRequirement(requirement = {}) {
  return {
    requirement_id: requirement.req_id ?? requirement.requirement_id ?? null,
    text_hash: valueHash(requirement.text ?? requirement.content ?? ''),
    requirement_category: requirement.requirement_category ?? requirement.category ?? null,
    writer_eligible: requirement.writer_eligible === true,
    is_mandatory: requirement.is_mandatory === true || requirement.mandatory === true,
    source_status: requirement.source_status ?? null,
    confirmation_type: requirement.confirmation_type ?? null,
    target_sections: orderedList(requirement.target_sections)
  };
}
function projectPlan(plan = {}) {
  return {
    requirement_id: plan.requirement_id ?? plan.req_id ?? null,
    response_status: plan.response_status ?? null,
    response_summary_hash: valueHash(plan.response_summary ?? null),
    implementation_actions_hash: valueHash(plan.implementation_actions ?? []),
    optional_design_hash: valueHash(plan.optional_design ?? []),
    deliverables_hash: valueHash(plan.deliverables ?? []),
    acceptance_methods_hash: valueHash(plan.acceptance_methods ?? []),
    conditions_hash: valueHash(plan.conditions ?? []),
    responsibility_boundaries_hash: valueHash(plan.responsibility_boundaries ?? []),
    capability_gap_hash: valueHash(plan.capability_gap ?? ''),
    target_sections: orderedList(plan.target_sections)
  };
}

function projectClaim(claim = {}) {
  return {
    claim_id: claim.claim_id ?? null,
    requirement_id: claim.requirement_id ?? null,
    claim_type: claim.claim_type ?? null,
    text_hash: valueHash(claim.claim_text ?? claim.text ?? ''),
    claim_assertion_hash: claim.claim_assertion_hash ?? claim.assertion_hash ?? claim.claim_assertion_identity ?? null,
    basis_requirement_ids: stringList(claim.basis_requirement_ids),
    basis_evidence_ids: stringList(claim.basis_evidence_ids),
    target_sections: orderedList(claim.target_sections),
    requested_commitment: claim.requested_commitment ?? null,
    decision: claim.decision ?? claim.gate_result_decision ?? null,
    current: claim.current !== false,
    writer_eligible: claim.writer_eligible === true,
    gate_result_id: claim.gate_result_id ?? null,
    allowed_scope: stringList(claim.allowed_scope),
    required_conditions: stringList(claim.required_conditions),
    limitations: stringList(claim.limitations),
    input_snapshot_hash: claim.input_snapshot_hash ?? null,
    source_hashes: stringList(claim.source_hashes),
    lineage_current: claim.lineage_current === true,
    referenced_fact_ids: stringList(claim.referenced_fact_ids ?? claim.basis_fact_ids),
    referenced_mapping_ids: stringList(claim.referenced_mapping_ids)
  };
}

function projectEvidence(evidence = {}) {
  return {
    evidence_id: evidence.evidence_id ?? null,
    content_hash: valueHash(evidence.content ?? ''),
    source_hash: evidence.source_hash ?? null,
    applicable_requirement_ids: stringList(evidence.applicable_requirement_ids),
    usage_scope: stringList(evidence.usage_scope ?? evidence.module),
    approval_status: evidence.approval_status ?? null,
    validity_status: evidence.validity_status ?? null
  };
}

function projectContext(context = {}) {
  const safe = context.safe_context || context;
  return {
    section_id: context.section?.section_id ?? safe.chapter_id ?? null,
    requirements: (context.requirements || []).map(projectRequirement).sort(by('requirement_id')),
    authorized_claims: (safe.assertable_claims || context.approved_claims || []).map(projectClaim).sort(by('claim_id')),
    context_items: (safe.context_items || context.project_facts || []).map(item => ({
      project_fact_id: item.project_fact_id ?? null,
      version: item.version ?? null,
      role: item.role ?? null,
      authorization_mode: item.authorization_mode ?? null,
      value_status: item.value_status ?? null,
      source_hash: item.source_hash ?? null,
      value_hash: valueHash(item.value ?? null)
    })).sort(by('project_fact_id')),
    bindings: (context.bindings || []).filter(item => item.binding_status === 'active').map(item => ({
      binding_id: item.propagation_id || `${item.target_type}:${item.target_id}:${item.project_fact_id}`,
      project_fact_id: item.project_fact_id ?? null,
      target_type: item.target_type ?? null,
      target_id: item.target_id ?? null,
      binding_role: item.binding_role ?? null,
      binding_status: item.binding_status ?? null
    })).sort(by('binding_id')),
    versions: {
      project_fact_context_hash: safe.project_fact_context_hash ?? null,
      propagation_binding_version: safe.propagation_binding_version ?? null,
      chapter_plan_version: safe.chapter_plan_version ?? null,
      claim_gate_identity: safe.claim_gate_identity ?? null,
      authorization_contract_version: safe.authorization_contract_version ?? null,
      contract_version: safe.contract_version ?? null
    }
  };
}

export function buildWriterAuthorizationSnapshot({ projectId = null, requirements = [], plans = [], claims = [], evidence = [], sectionContexts = [] } = {}) {
  const contexts = (Array.isArray(sectionContexts) ? sectionContexts : []).map(projectContext).sort(by('section_id'));
  return {
    snapshot_version: WRITER_AUTHORIZATION_SNAPSHOT_VERSION,
    project_id: projectId,
    requirements: requirements.map(projectRequirement).sort(by('requirement_id')),
    plans: plans.map(projectPlan).sort(by('requirement_id')),
    claims: claims.map(projectClaim).sort(by('claim_id')),
    evidence: evidence.map(projectEvidence).sort(by('evidence_id')),
    sections: contexts
  };
}

export function writerAuthorizationSnapshotHash(snapshot) {
  return hash(snapshot);
}
