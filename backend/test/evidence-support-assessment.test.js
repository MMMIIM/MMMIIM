import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  adaptApprovedEvidenceFact,
  adaptRetrievalCandidate,
  aggregateEvidenceSufficiency,
  createEvidenceSupportAssessment,
  ProviderNeutralEvidenceSupportEvaluator,
  toEvidenceReviewAssessment,
  toRequirementEvidenceMappingCandidate
} from '../src/pipeline/evidence-support-assessment-contract-v1.js';
import { createEvidenceReviewContract } from '../src/pipeline/evidence-review-contract.js';
import { createRequirementEvidenceMapping } from '../src/pipeline/requirement-evidence-mapping-contract-v1.js';

const sha = value => createHash('sha256').update(String(value)).digest('hex');
const projectId = '11111111-1111-4111-8111-111111111111';
const requirement = (overrides = {}) => ({
  requirement_id: 'REQ-001',
  text: '系统平均响应时间应不超过1.4秒。',
  ...overrides
});
const sourceSpan = (text, id = 'SPAN-001') => ({
  source_span_id: id,
  source_text: text,
  source_text_hash: sha(text),
  source_page: 3,
  source_paragraph: 8
});
const candidate = (id = 'CAND-001') => ({
  candidate_id: id,
  metadata: { retrieval_run_id: 'RUN-001' }
});
const retrievalInput = ({ candidateId = 'CAND-001', spanId = 'SPAN-001', text = '系统平均响应时间应不超过1.4秒。' } = {}) => adaptRetrievalCandidate({
  requirement: requirement(),
  candidate: candidate(candidateId),
  sourceSpan: sourceSpan(text, spanId),
  material: { material_id: 'MAT-001', source_type: 'enterprise_material' },
  lineage: { project_id: projectId, retrieval_run_id: 'RUN-001', chunk_id: 'CHUNK-001' }
});
const dimensions = (overrides = {}) => ({
  subject_match: 'match',
  scope_match: 'match',
  status_match: 'match',
  quantitative_match: 'match',
  entity_match: 'match',
  validity_match: 'match',
  source_authority: 'match',
  support_sufficiency: 'match',
  ...overrides
});
const fullObservation = (overrides = {}) => ({
  semantic_relevance: 'relevant',
  evidence_capability: 'capable',
  support_level: 'full_support',
  semantic_relationship: 'direct',
  review_dimensions: dimensions(),
  support_observations: [{
    support_excerpt: '系统平均响应时间应不超过1.4秒。',
    observation_type: 'direct_support',
    reason_codes: []
  }],
  ...overrides
});

test('direct/full support is source-bound and aggregates to review ready', () => {
  const input = retrievalInput();
  const assessment = createEvidenceSupportAssessment(input, fullObservation());
  assert.equal(assessment.semantic_relationship, 'direct');
  assert.equal(assessment.support_level, 'full_support');
  assert.equal(assessment.support_observations[0].support_excerpt_hash, sha(assessment.support_observations[0].support_excerpt));
  assert.equal(assessment.source.source_text, undefined);
  assert.equal(aggregateEvidenceSufficiency([assessment]).status, 'EVIDENCE_REVIEW_READY');
});

test('canonical factory rejects direct relationship without full support', () => {
  const input = retrievalInput();
  assert.throws(() => createEvidenceSupportAssessment(input, fullObservation({
    support_level: 'partial_support',
    semantic_relationship: 'direct'
  })), error => error.code === 'EVIDENCE_SUPPORT_ASSESSMENT_INVALID');
});

test('canonical factory accepts direct relationship with full support', () => {
  const input = retrievalInput();
  assert.doesNotThrow(() => createEvidenceSupportAssessment(input, fullObservation({
    support_level: 'full_support',
    semantic_relationship: 'direct'
  })));
});

test('canonical factory rejects full support without direct relationship', () => {
  const input = retrievalInput();
  assert.throws(() => createEvidenceSupportAssessment(input, fullObservation({
    support_level: 'full_support',
    semantic_relationship: 'partial'
  })), error => error.code === 'EVIDENCE_SUPPORT_ASSESSMENT_INVALID');
});

test('partial support remains insufficient and never upgrades to ready', () => {
  const input = retrievalInput({ text: '系统平均响应时间约为1.4秒，测试条件另见附件。' });
  const assessment = createEvidenceSupportAssessment(input, {
    ...fullObservation({
      support_level: 'partial_support',
      semantic_relationship: 'partial',
      support_observations: [{ support_excerpt: '测试条件另见附件', observation_type: 'partial_support', reason_codes: ['SUPPORT_PARTIAL'] }]
    })
  });
  assert.equal(aggregateEvidenceSufficiency([assessment]).status, 'INSUFFICIENT_EVIDENCE');
});

test('reference-only/context and unrelated sources produce no relevant evidence', () => {
  const referenceInput = retrievalInput({ text: '历史项目曾采用类似系统。' });
  const reference = createEvidenceSupportAssessment(referenceInput, {
    semantic_relevance: 'relevant',
    evidence_capability: 'reference_only',
    support_level: 'reference_only',
    semantic_relationship: 'related',
    review_dimensions: dimensions(),
    support_observations: [{ support_excerpt: '历史项目曾采用类似系统。', observation_type: 'context', reason_codes: ['REFERENCE_ONLY_SOURCE'] }]
  });
  const unrelatedInput = retrievalInput({ candidateId: 'CAND-002', spanId: 'SPAN-002', text: '办公区域照明管理要求。' });
  const unrelated = createEvidenceSupportAssessment(unrelatedInput, {
    semantic_relevance: 'irrelevant',
    evidence_capability: 'not_capable',
    support_level: 'insufficient',
    semantic_relationship: 'unrelated',
    review_dimensions: dimensions(),
    reason_codes: ['SEMANTICALLY_IRRELEVANT']
  });
  assert.equal(aggregateEvidenceSufficiency([reference]).status, 'NO_RELEVANT_EVIDENCE');
  assert.equal(aggregateEvidenceSufficiency([unrelated]).status, 'NO_RELEVANT_EVIDENCE');
});

test('explicit and cross-source conflicts block sufficiency', () => {
  const firstInput = retrievalInput();
  const secondInput = retrievalInput({ candidateId: 'CAND-002', spanId: 'SPAN-002', text: '系统平均响应时间为2.1秒。' });
  const first = createEvidenceSupportAssessment(firstInput, fullObservation({
    conflict_observations: [{
      conflict_group_id: 'QUANTITY-RESPONSETIME',
      dimension: 'average_response_time',
      observed_value: '1.4秒',
      support_excerpt: '系统平均响应时间应不超过1.4秒。',
      reason_codes: []
    }]
  }));
  const second = createEvidenceSupportAssessment(secondInput, fullObservation({
    support_observations: [{ support_excerpt: '系统平均响应时间为2.1秒。', observation_type: 'direct_support', reason_codes: [] }],
    conflict_observations: [{
      conflict_group_id: 'QUANTITY-RESPONSETIME',
      dimension: 'average_response_time',
      observed_value: '2.1秒',
      support_excerpt: '系统平均响应时间为2.1秒。',
      reason_codes: []
    }]
  }));
  const aggregate = aggregateEvidenceSufficiency([first, second]);
  assert.equal(aggregate.status, 'CONFLICTING_EVIDENCE');
  assert.equal(aggregate.blocking_conflicts[0].blocking, true);
  assert.ok(aggregate.reason_codes.includes('HUMAN_REVIEW_REQUIRED'));
});

test('unknown provider assessment is unavailable and never business-ready', async () => {
  const input = retrievalInput();
  const assessment = await new ProviderNeutralEvidenceSupportEvaluator().assess(input);
  assert.equal(assessment.assessment_status, 'unavailable');
  assert.deepEqual(assessment.reason_codes, ['ASSESSMENT_UNAVAILABLE']);
  assert.equal(aggregateEvidenceSufficiency([assessment]).status, 'ASSESSMENT_UNAVAILABLE');
  const mixed = createEvidenceSupportAssessment(input, fullObservation());
  assert.equal(aggregateEvidenceSufficiency([assessment, mixed]).status, 'ASSESSMENT_UNAVAILABLE');
  const forced = createEvidenceSupportAssessment(input, { ...fullObservation({ assessment_status: 'unavailable' }) });
  assert.equal(forced.semantic_relationship, 'unknown');
});

test('available semantic unknown is a non-decision result, not insufficient or ready', () => {
  const assessment = createEvidenceSupportAssessment(retrievalInput(), {
    semantic_relevance: 'unknown',
    evidence_capability: 'unknown',
    support_level: 'unknown',
    semantic_relationship: 'unknown',
    review_dimensions: dimensions()
  });
  assert.equal(aggregateEvidenceSufficiency([assessment]).status, 'ASSESSMENT_UNAVAILABLE');
});

test('support excerpt must be contained in source text and hash must match', () => {
  const input = retrievalInput();
  assert.throws(() => createEvidenceSupportAssessment(input, fullObservation({
    support_observations: [{ support_excerpt: '不存在于来源的内容', reason_codes: [] }]
  })), error => error.code === 'EVIDENCE_SUPPORT_OBSERVATION_UNGROUNDED');
  assert.throws(() => createEvidenceSupportAssessment(input, fullObservation({
    support_observations: [{ support_excerpt: '系统平均响应时间应不超过1.4秒。', support_excerpt_hash: 'a'.repeat(64), reason_codes: [] }]
  })), error => error.code === 'EVIDENCE_SUPPORT_SOURCE_HASH_INVALID');
});

test('candidate and source identifiers are mandatory for the raw adapter', () => {
  assert.throws(() => adaptRetrievalCandidate({
    requirement: requirement(),
    candidate: {},
    sourceSpan: sourceSpan('来源')
  }), error => error.code === 'EVIDENCE_SUPPORT_INPUT_INVALID');
  assert.throws(() => adaptRetrievalCandidate({
    requirement: requirement(),
    candidate: candidate(),
    sourceSpan: { source_text: '来源' }
  }), error => error.code === 'EVIDENCE_SUPPORT_INPUT_INVALID');
});

test('approved Evidence Fact adapter carries lifecycle and lineage without approving Mapping', () => {
  const text = '企业已完成同类项目实施。';
  const factInput = adaptApprovedEvidenceFact({
    requirement: requirement({ text: '应具备同类项目实施经验。' }),
    fact: {
      fact_id: 'EFACT-001',
      review_status: 'approved',
      payload_hash: 'b'.repeat(64),
      contract_version: 'evidence-fact-v1'
    },
    sourceSpan: sourceSpan(text, 'SPAN-FACT-001'),
    material: { material_id: 'MAT-FACT-001' },
    lineage: { project_id: projectId, evidence_review_id: 'EREVIEW-001' }
  });
  const assessment = createEvidenceSupportAssessment(factInput, {
    ...fullObservation({
      support_observations: [{ support_excerpt: text, reason_codes: [] }]
    })
  });
  assert.equal(assessment.input_kind, 'evidence_fact');
  assert.equal(assessment.source.source_kind, 'evidence_fact');
  assert.throws(() => adaptApprovedEvidenceFact({
    requirement: requirement(),
    fact: { fact_id: 'EFACT-002', review_status: 'draft', payload_hash: 'c'.repeat(64), contract_version: 'evidence-fact-v1' },
    sourceSpan: sourceSpan('来源', 'SPAN-FACT-002')
  }), error => error.code === 'EVIDENCE_SUPPORT_FACT_NOT_APPROVED');
});

test('shared assessment adapts additively to Review and Formal Mapping contracts', () => {
  const text = '系统平均响应时间应不超过1.4秒。';
  const factInput = adaptApprovedEvidenceFact({
    requirement: requirement(),
    fact: { fact_id: 'EFACT-003', review_status: 'approved', payload_hash: 'd'.repeat(64), contract_version: 'evidence-fact-v1' },
    sourceSpan: sourceSpan(text, 'SPAN-FACT-003'),
    material: { material_id: 'MAT-FACT-003' },
    lineage: { project_id: projectId, evidence_review_id: 'EREVIEW-003' }
  });
  const assessment = createEvidenceSupportAssessment(factInput, fullObservation());
  const review = createEvidenceReviewContract({
    project_id: projectId,
    requirement_db_id: '22222222-2222-4222-8222-222222222222',
    requirement_id: requirement().requirement_id,
    requirement_text: requirement().text,
    retrieval_run_id: 'RUN-003',
    retrieval_candidate_id: 'CAND-003',
    source_span_id: 'SPAN-FACT-003',
    source_text_hash: sha(text),
    content_role: 'performance_test',
    material_type: 'technical_whitepaper'
  }, toEvidenceReviewAssessment(assessment));
  assert.equal(review.support_level, 'full_support');
  assert.equal(review.review_status, 'needs_review');

  const mappingCandidate = toRequirementEvidenceMappingCandidate(assessment);
  const mapping = createRequirementEvidenceMapping({
    project_id: projectId,
    requirement_db_id: '22222222-2222-4222-8222-222222222222',
    requirement_id: requirement().requirement_id,
    requirement_hash: requirement().text && sha(requirement().text),
    requirement_contract_version: 'canonical-v1',
    requirement_valid: true,
    fact_id: 'EFACT-003',
    fact_payload_hash: 'd'.repeat(64),
    fact_contract_version: 'evidence-fact-v1',
    fact_review_status: 'approved',
    evidence_review_id: 'EREVIEW-003',
    source_span_id: 'SPAN-FACT-003',
    material_id: 'MAT-FACT-003'
  }, mappingCandidate);
  assert.equal(mapping.review_status, 'proposed');
  assert.equal(mapping.evidence_fact_id, 'EFACT-003');
});

test('raw Candidate path is isolated from Review, Fact, Mapping and downstream state', () => {
  const input = retrievalInput();
  const assessment = createEvidenceSupportAssessment(input, fullObservation());
  const aggregate = aggregateEvidenceSufficiency([assessment]);
  assert.equal(aggregate.status, 'EVIDENCE_REVIEW_READY');
  assert.equal(assessment.review_id, undefined);
  assert.equal(assessment.fact_id, undefined);
  assert.equal(assessment.mapping_id, undefined);
  assert.equal(assessment.review_status, undefined);
  assert.equal(assessment.approval_state, undefined);
  assert.equal(assessment.readiness, undefined);
});
