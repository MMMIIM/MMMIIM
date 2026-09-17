import { AppError } from '../errors.js';
import { chapterConfig } from './chapter-config.js';

export const DOCUMENT_PLAN_VERSION = 'document-plan-v1';
const WRITER_CATEGORIES = new Set(['technical', 'performance', 'implementation', 'delivery', 'service']);

const fail = (message) => { throw new AppError('DOCUMENT_PLAN_INVALID', message, 422); };

function fallbackSections() {
  return chapterConfig.map((chapter) => ({
    section_id: chapter.chapter_id,
    parent_id: null,
    title: chapter.title,
    role: 'technical_bid_section',
    requirement_ids: []
  }));
}

function writerEligible(requirement) {
  // Formal V2 Writer authority is a backend-derived ResponseDecision result.
  // The legacy flag remains only for compatibility callers that do not provide
  // the formal projection.
  if (Object.prototype.hasOwnProperty.call(requirement || {}, 'writer_authorized')) return requirement.writer_authorized === true;
  return requirement?.writer_eligible === true && WRITER_CATEGORIES.has(requirement.requirement_category);
}

function routeRequirement(requirement, sections, routes = {}) {
  const explicit = routes[requirement.req_id] || requirement.target_section_id || requirement.target_section;
  if (explicit && sections.some((section) => section.section_id === explicit)) return explicit;
  const targets = Array.isArray(requirement.target_sections) ? requirement.target_sections : [];
  const target = targets.find((id) => sections.some((section) => section.section_id === id));
  if (target) return target;
  const chapter = chapterConfig.find((item) => item.allowed_requirement_categories.includes(requirement.requirement_category));
  return sections.find((section) => section.section_id === chapter?.chapter_id)?.section_id || sections[0]?.section_id;
}

export function buildDocumentPlan({ requirements = [], structureSignals = [], routes = {} } = {}) {
  const source = Array.isArray(structureSignals) && structureSignals.length ? structureSignals : fallbackSections();
  const eligibleIds = new Set(requirements.filter(writerEligible).map((requirement) => requirement.req_id));
  const knownIds = new Set(requirements.map((requirement) => requirement.req_id));
  const seen = new Set();
  const sections = source.map((raw, index) => {
    const section_id = String(raw.section_id || '').trim();
    if (!section_id || seen.has(section_id)) fail('DocumentPlan section_id 必须唯一且非空。');
    seen.add(section_id);
    const rawRequirementIds = Array.isArray(raw.requirement_ids) ? [...new Set(raw.requirement_ids.map(String))] : [];
    if (rawRequirementIds.some((id) => !knownIds.has(id))) fail(`Section ${section_id} 引用了未知 Requirement。`);
    return {
      section_id,
      parent_id: raw.parent_id ?? null,
      title: String(raw.title || section_id),
      role: String(raw.role || 'technical_bid_section'),
      order: Number.isInteger(raw.order) ? raw.order : index + 1,
      requirement_ids: rawRequirementIds.filter((id) => eligibleIds.has(id))
    };
  }).sort((a, b) => a.order - b.order || a.section_id.localeCompare(b.section_id));
  const byId = new Map(sections.map((section) => [section.section_id, section]));
  for (const requirement of requirements.filter(writerEligible)) {
    const sectionId = routeRequirement(requirement, sections, routes);
    if (!sectionId || !byId.has(sectionId)) fail(`Requirement ${requirement.req_id} 没有可用章节。`);
    const section = byId.get(sectionId);
    if (!section.requirement_ids.includes(requirement.req_id)) section.requirement_ids.push(requirement.req_id);
  }
  for (const section of sections) section.requirement_ids.sort();
  const plan = { contract_version: DOCUMENT_PLAN_VERSION, sections };
  validateDocumentPlan(plan, requirements);
  return plan;
}

export function validateDocumentPlan(plan, requirements = []) {
  if (!plan || plan.contract_version !== DOCUMENT_PLAN_VERSION || !Array.isArray(plan.sections) || !plan.sections.length) fail('DocumentPlan 结构无效。');
  const ids = new Set();
  const assigned = new Set();
  const knownRequirements = new Set(requirements.map((requirement) => requirement.req_id));
  for (const section of plan.sections) {
    if (!section.section_id || ids.has(section.section_id) || !Array.isArray(section.requirement_ids)) fail('DocumentPlan section 定义无效。');
    ids.add(section.section_id);
    if (section.parent_id !== null && section.parent_id !== undefined && !ids.has(section.parent_id) && !plan.sections.some((candidate) => candidate.section_id === section.parent_id)) fail(`Section ${section.section_id} 的 parent_id 不存在。`);
    for (const id of section.requirement_ids) {
      if (!knownRequirements.has(id)) fail(`Section ${section.section_id} 引用了未知 Requirement ${id}。`);
      if (assigned.has(id)) fail(`Requirement ${id} 被重复绑定。`);
      assigned.add(id);
    }
  }
  for (const requirement of requirements.filter(writerEligible)) {
    if (!assigned.has(requirement.req_id)) fail(`Writer Requirement ${requirement.req_id} 未绑定章节。`);
  }
  return true;
}
