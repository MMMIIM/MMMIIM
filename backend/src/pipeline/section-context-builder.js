import { WriterInputAuthorizationService } from '../writer-input-authorization-service.js';

const safeRequirement = (requirement) => ({
  requirement_id: requirement.req_id,
  text: requirement.text,
  category: requirement.requirement_category,
  mandatory: requirement.is_mandatory === true,
  response_mode: requirement.response_mode ?? requirement.response_decision?.response_mode ?? 'REQUIREMENT_RESPONSE_ONLY',
  response_unit_id: requirement.response_unit_id ?? null,
  enterprise_capability_assertion_allowed: false
});

const safeClaim = (claim) => ({
  claim_id: claim.claim_id,
  text: claim.claim_text ?? claim.text ?? '',
  claim_text: claim.claim_text ?? claim.text ?? '',
  claim_type: claim.claim_type ?? null,
  requested_commitment: claim.requested_commitment ?? null,
  allowed_scope: claim.allowed_scope || [],
  required_conditions: claim.required_conditions || [],
  limitations: claim.limitations || [],
  claim_assertion_hash: claim.claim_assertion_hash ?? claim.assertion_hash ?? null,
  gate_result_id: claim.gate_result_id ?? null,
  input_snapshot_hash: claim.input_snapshot_hash ?? null,
  source_hashes: claim.source_hashes || [],
  lineage_current: claim.lineage_current === true,
  referenced_fact_ids: claim.referenced_fact_ids || [],
  structured_assertion: claim.structured_assertion || []
});

const safeReference = (reference) => ({
  material_id: reference.material_id,
  chunk_id: reference.chunk_id,
  text: reference.source_text ?? reference.text ?? '',
  source_type: 'CONTEXT_ONLY'
});

export function buildSectionContext({ project, section, requirements = [], claims = [], facts = [], bindings = [], gateResults = [], versions = {}, referenceMaterials = [], writerTaskId = null }, { authorizationService = new WriterInputAuthorizationService() } = {}) {
  const ids = new Set(section.requirement_ids || []);
  const sectionRequirements = requirements.filter((item) => ids.has(item.req_id));
  const sectionClaims = claims.filter((claim) => (claim.target_sections || []).includes(section.section_id) && claim.decision === 'approved' && claim.current !== false);
  const safeContext = authorizationService.build({
    projectId: project.id,
    chapterId: section.section_id,
    writerTaskId,
    facts,
    bindings,
    claims: sectionClaims,
    gateResults,
    versions
  });
  const approvedClaims = safeContext.assertable_claims.map(safeClaim);
  const authorizedEnterpriseClaims = approvedClaims.filter((claim) => claim.claim_type !== 'requirement_response');
  const authorizedProjectResponses = approvedClaims.filter((claim) => claim.claim_type === 'requirement_response');
  const contextOnlyReferences = referenceMaterials.map(safeReference);
  return {
    section: { section_id: section.section_id, parent_id: section.parent_id ?? null, title: section.title, role: section.role },
    requirements: sectionRequirements.map(safeRequirement),
    approved_claims: approvedClaims,
    authorized_enterprise_claims: authorizedEnterpriseClaims,
    authorized_project_responses: authorizedProjectResponses,
    project_facts: safeContext.context_items.map(({ project_fact_id, key, value, value_status, role }) => ({ project_fact_id, key, value, value_status, role })),
    reference_materials: contextOnlyReferences,
    context_only_references: contextOnlyReferences,
    safe_context: safeContext,
    bindings: bindings.filter((binding) => binding.binding_status === 'active' && binding.target_type === 'chapter' && binding.target_id === section.section_id)
  };
}
