export const BATCH_GENERATION_RULE_VERSION='4.3-batch-routing-1';

// Missing optional metadata is compatible with older persisted batches; a
// present non-array value is treated as non-empty so malformed input cannot
// accidentally take the deterministic shortcut.
const empty=(value)=>value == null || (Array.isArray(value) && value.length===0);

export function routeBatchGeneration(batch){
  const input=batch?.input||{};
  // V2 batches carry one or more DocumentPlan sections. Reuse the frozen
  // legacy decision rule for a single, fully deterministic section instead of
  // silently sending every V2 batch to the Writer Provider.
  if (Array.isArray(input.sections)) {
    if (input.sections.length !== 1) return {generation_mode:'semantic_gateway',rule_version:BATCH_GENERATION_RULE_VERSION};
    const section = input.sections[0] || {};
    const claims = Array.isArray(section.approved_claims) ? section.approved_claims : [];
    const plans = Array.isArray(section.response_plans) ? section.response_plans : [];
    const hasEnterprise = Array.isArray(section.authorized_enterprise_claims) && section.authorized_enterprise_claims.length > 0;
    const hasContext = (Array.isArray(section.project_facts) && section.project_facts.length > 0)
      || (Array.isArray(section.reference_materials) && section.reference_materials.length > 0)
      || (Array.isArray(section.context_only_references) && section.context_only_references.length > 0);
    const simple = claims.length === 1 && plans.every((plan) => empty(plan.implementation_actions))
      && empty(section.approved_evidence) && empty(section.conditions)
      && empty(section.responsibility_boundaries) && !hasEnterprise && !hasContext;
    if (!simple) return {generation_mode:'semantic_gateway',rule_version:BATCH_GENERATION_RULE_VERSION};
    const requirement = (section.requirements || []).find((item) => {
      const id = item?.requirement_id ?? item?.req_id;
      return id && (claims[0]?.basis_requirement_ids || []).includes(id);
    }) || section.requirements?.[0];
    const anchor = requirement?.text || claims[0]?.text || '';
    return {generation_mode:'deterministic_template',rule_version:BATCH_GENERATION_RULE_VERSION,
      content:`本项目将按照招标文件要求，${anchor}`};
  }
  const claims=Array.isArray(input.approved_claims)?input.approved_claims:[];
  const plans=Array.isArray(input.response_plans)?input.response_plans:[];
  const simple=claims.length===1
    && plans.every((plan)=>empty(plan.implementation_actions))
    && empty(input.approved_evidence)
    && empty(input.conditions)
    && empty(input.responsibility_boundaries);
  if(!simple)return{generation_mode:'semantic_gateway',rule_version:BATCH_GENERATION_RULE_VERSION};
  const anchor=input.requirement_anchors?.[0]?.requirement_anchor||claims[0]?.text||'';
  return{
    generation_mode:'deterministic_template',
    rule_version:BATCH_GENERATION_RULE_VERSION,
    content:`本项目将按照招标文件要求，${anchor}`
  };
}
