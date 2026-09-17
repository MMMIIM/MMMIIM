import { AppError } from '../errors.js';

export const WRITER_BATCH_V2_VERSION = 'writer-generation-batch-v2';
const estimate = value => Math.ceil(JSON.stringify(value).length / 4);

const requirementId = (item) => item?.requirement_id ?? item?.req_id;

const safeEvidence = (evidence) => ({
  evidence_id: evidence.evidence_id,
  title: evidence.title,
  content: evidence.content,
  usage_scope: evidence.usage_scope,
  risk_notes: evidence.risk_notes
});

export function buildGenerationBatches({ plan, sectionContexts = [], responsePlans = [], approvedEvidence = [], maxTokens = 20000 } = {}) {
  const contextById = new Map(sectionContexts.map((context) => [context.section.section_id, context]));
  const plansByRequirement = new Map((responsePlans || []).map((item) => [requirementId(item), item]));
  const evidenceByRequirement = new Map();
  for (const evidence of approvedEvidence || []) {
    for (const id of evidence.applicable_requirement_ids || []) {
      const list = evidenceByRequirement.get(id) || [];
      list.push(evidence);
      evidenceByRequirement.set(id, list);
    }
  }
  const projectSection = (context) => {
    const { section, requirements, approved_claims, authorized_enterprise_claims, authorized_project_responses, project_facts, reference_materials, context_only_references, safe_response_packets, safe_response_packet_hash, covered_requirement_ids, response_unit_id } = context;
    const relatedPlans = requirements.map((item) => plansByRequirement.get(requirementId(item))).filter(Boolean);
    const planProjection = relatedPlans.map((item) => ({
      requirement_id: requirementId(item),
      implementation_actions: Array.isArray(item.implementation_actions) ? item.implementation_actions : [],
      conditions: Array.isArray(item.conditions) ? item.conditions : [],
      responsibility_boundaries: Array.isArray(item.responsibility_boundaries) ? item.responsibility_boundaries : []
    }));
    const relatedEvidence = [...new Map(requirements.flatMap((item) => evidenceByRequirement.get(requirementId(item)) || []).map((item) => [item.evidence_id, item])).values()];
    return {
      section,
      requirements,
      response_plans: planProjection,
      approved_claims,
      authorized_enterprise_claims: authorized_enterprise_claims || [],
      authorized_project_responses: authorized_project_responses || [],
      project_facts,
      reference_materials,
      context_only_references: context_only_references || reference_materials || [],
      safe_response_packets: safe_response_packets || [],
      safe_response_packet_hash: safe_response_packet_hash || null,
      covered_requirement_ids: [...(covered_requirement_ids || section.requirement_ids || [])].map(String).sort(),
      response_unit_id: response_unit_id || null,
      conditions: planProjection.flatMap((item) => item.conditions),
      responsibility_boundaries: planProjection.flatMap((item) => item.responsibility_boundaries),
      approved_evidence: relatedEvidence.map(safeEvidence)
    };
  };
  const batches = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    const section_ids = group.map((context) => context.section.section_id);
    const chapter_id = group[0].section.parent_id || section_ids[0];
    const inputSections = group.map(projectSection);
    batches.push({
      contract_version: WRITER_BATCH_V2_VERSION,
      chapter_id,
      section_ids,
      batch_index: batches.filter((item) => item.chapter_id === chapter_id).length,
      estimated_tokens: estimate(inputSections),
      claim_ids: group.flatMap((context) => context.approved_claims.map((claim) => claim.claim_id)),
      input: { chapter_id, sections: inputSections }
    });
    group = [];
  };
  for (const section of plan.sections) {
    const context = contextById.get(section.section_id);
    if (!context) continue;
    if (!context.requirements?.length && !context.approved_claims?.length && !context.project_facts?.length && !context.reference_materials?.length) continue;
    const singleInput = projectSection(context);
    const singleTokens = estimate([singleInput]);
    if (singleTokens > maxTokens) throw new AppError('WRITER_BATCH_OVER_BUDGET', `章节 ${section.section_id} 超出 Writer token budget。`, 422);
    const candidate = [...group, context];
    if (group.length && (group.length >= 4 || estimate(candidate.map(projectSection)) > maxTokens || context.section.parent_id !== group[0].section.parent_id)) flush();
    group.push(context);
  }
  flush();
  return batches;
}

export function mergePlannedSections(tasks, plan) {
  const expectedSections = (plan?.sections || []).filter((section) => Array.isArray(section.requirement_ids) && section.requirement_ids.length > 0);
  const expected = new Set(expectedSections.map((section) => section.section_id));
  const contents = new Map();
  for (const task of tasks || []) for (const section of task.section_outputs || []) {
    const id = section?.section_id;
    if (!expected.has(id)) throw new AppError('ASSEMBLY_UNKNOWN_SECTION', '生成结果包含未规划的 Section。', 422);
    if (contents.has(id)) throw new AppError('ASSEMBLY_DUPLICATE', '生成结果包含重复的 Section。', 422);
    contents.set(id, section.content_markdown);
  }
  const missing = expectedSections.filter((section) => !contents.has(section.section_id)).map((section) => section.section_id);
  if (missing.length) throw new AppError('ASSEMBLY_INCOMPLETE', '生成结果缺少规划的 Section。', 422);
  const sections_json = expectedSections.map((section) => ({
    section_id: section.section_id,
    chapter_id: section.section_id,
    parent_id: section.parent_id ?? null,
    role: section.role,
    order: section.order,
    title: section.title,
    requirement_ids: [...section.requirement_ids],
    covered_requirement_ids: [...section.requirement_ids],
    content_markdown: contents.get(section.section_id),
    claim_ids: []
  }));
  return { sections_json, markdown: sections_json.map((section) => `## ${section.title}\n\n${section.content_markdown}`).join('\n\n') };
}
