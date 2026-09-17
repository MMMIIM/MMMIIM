import { createHash } from 'node:crypto';

const dimensions = {
  subject_match: 'match',
  scope_match: 'match',
  status_match: 'match',
  quantitative_match: 'match',
  entity_match: 'match',
  validity_match: 'match',
  source_authority: 'match',
  support_sufficiency: 'match'
};

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const firstText = value => String(value || '').trim().slice(0, 120);

function evidenceData(payload) {
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  const assessments = sources.map(source => {
    const sourceText = String(source.source_text || '');
    const lower = sourceText.toLowerCase();
    const unrelated = lower.includes('[[unrelated]]');
    const partial = lower.includes('[[partial]]');
    const unknown = lower.includes('[[unknown]]');
    const conflict = lower.match(/\[\[conflict:([^\]]+)\]\]/i);
    const semanticRelevance = unknown ? 'unknown' : unrelated ? 'irrelevant' : 'relevant';
    const evidenceCapability = unknown ? 'unknown' : unrelated ? 'not_capable' : 'capable';
    const supportLevel = unknown ? 'unknown' : unrelated ? 'insufficient' : conflict ? 'conflict' : partial ? 'partial_support' : 'full_support';
    const semanticRelationship = unknown ? 'unknown' : unrelated ? 'unrelated' : conflict ? 'conflict' : partial ? 'partial' : 'direct';
    const reasonCodes = unknown
      ? ['HUMAN_REVIEW_REQUIRED']
      : unrelated
      ? ['SEMANTICALLY_IRRELEVANT', 'SOURCE_NOT_EVIDENCE_CAPABLE', 'SUPPORT_INSUFFICIENT']
      : conflict ? ['HUMAN_REVIEW_REQUIRED'] : partial ? ['SUPPORT_PARTIAL'] : [];
    const excerpt = firstText(sourceText);
    return {
      source_id: source.source_id,
      source_span_id: source.source_span_id,
      semantic_relevance: semanticRelevance,
      evidence_capability: evidenceCapability,
      support_level: supportLevel,
      semantic_relationship: semanticRelationship,
      review_dimensions: { ...dimensions },
      reason_codes: reasonCodes,
      support_observations: [{
        source_id: source.source_id,
        source_span_id: source.source_span_id,
        support_excerpt: excerpt,
        observation_type: conflict ? 'contradiction' : partial ? 'partial_support' : unrelated || unknown ? 'context' : 'direct_support',
        reason_codes: reasonCodes
      }]
    };
  });
  const conflictSources = new Map();
  for (const source of sources) {
    const match = String(source.source_text || '').match(/\[\[conflict:([^\]]+)\]\]/i);
    if (!match) continue;
    const group = conflictSources.get('mock-conflict') || [];
    group.push({
      source_id: source.source_id,
      source_span_id: source.source_span_id,
      observed_value: match[1],
      support_excerpt: firstText(source.source_text)
    });
    conflictSources.set('mock-conflict', group);
  }
  const conflict_observations = [...conflictSources.entries()]
    .filter(([, items]) => items.length >= 2 && new Set(items.map(item => JSON.stringify(item.observed_value))).size >= 2)
    .map(([conflict_group_id, items]) => ({
      conflict_group_id,
      dimension: 'status_match',
      sources: items,
      reason_codes: ['HUMAN_REVIEW_REQUIRED']
    }));
  return { assessments, conflict_observations };
}

export class MockSemanticProvider {
  constructor({ model = 'mock-semantic-v1' } = {}) {
    this.model = model;
  }

  async invoke({ taskType, payload }) {
    if (taskType === 'evidence_support_assessment') return { data: evidenceData(payload), provider_audit: { model: this.model } };
    if (taskType === 'requirement_extraction') return { data: { requirements: [] }, provider_audit: { model: this.model } };
    if (taskType === 'evidence_fact_extraction') return { data: { facts: [] }, provider_audit: { model: this.model } };
    if (taskType === 'response_planning') {
      return { data: {
        response_plans: (payload.requirements || []).map(requirement => ({
          requirement_id: requirement.req_id || requirement.requirement_id,
          response_status: 'full',
          response_summary: '基于已确认需求生成响应计划。',
          implementation_actions: [],
          optional_design: [],
          deliverables: [],
          acceptance_methods: [],
          conditions: [],
          supporting_evidence_ids: [],
          capability_gap: ''
        }))
      }, provider_audit: { model: this.model } };
    }
    if (taskType === 'claim_generation') {
      return { data: {
        claims: (payload.plans || []).map(plan => ({
          requirement_id: plan.requirement_id,
          claim_type: 'requirement_response',
          text: plan.response_summary || '按已确认要求进行响应。',
          basis_requirement_ids: [plan.requirement_id],
          basis_evidence_ids: plan.supporting_evidence_ids || [],
          requested_commitment: 'conditional'
        }))
      }, provider_audit: { model: this.model } };
    }
    if (taskType === 'section_drafting') {
      return { data: { chapter_id: payload.chapter_id || 'mock-chapter', content_markdown: '基于已授权上下文生成的章节草稿。' }, provider_audit: { model: this.model } };
    }
    if (taskType === 'targeted_revision') return { data: { revised_text: String(payload.paragraph || payload.text || '').trim() || '已完成受控修订。' }, provider_audit: { model: this.model } };
    if (taskType === 'draft_sections') return { data: { sections: [] }, provider_audit: { model: this.model } };
    throw Object.assign(new Error('Unsupported task'), { code: 'TASK_UNSUPPORTED' });
  }
}

export function createMockProvider(options) {
  return new MockSemanticProvider(options);
}

export function mockProviderFingerprint(provider) {
  return hash(provider?.model || 'mock-semantic-v1').slice(0, 12);
}
