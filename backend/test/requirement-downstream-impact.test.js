import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRequirementIdsUnchanged,
  buildCanonicalRequirements,
  validateCanonicalRequirements
} from '../src/pipeline/canonical-requirements.js';
import { planChapters, routeRequirement } from '../src/pipeline/chapter-router.js';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';
import {
  combineRequirementExtractionSections,
  routeRequirementExtractionSections
} from '../src/pipeline/requirement-scope-router.js';
import { DeterministicResponsePlanBuilder } from '../src/pipeline/deterministic-response-plan-builder.js';
import { ResponsePlanValidator } from '../src/pipeline/response-plan-validator.js';
import { EvidenceCatalogService } from '../src/pipeline/evidence-catalog-service.js';
import { DeterministicClaimBuilder } from '../src/pipeline/deterministic-claim-builder.js';
import { ClaimGateService } from '../src/pipeline/claim-gate-service.js';
import { CoverageValidator } from '../src/pipeline/coverage-validator.js';
import { buildWriterBatches, validateDocument } from '../src/pipeline/document-generation.js';
import { EnterpriseRetrievalService } from '../src/pipeline/enterprise-retrieval-service.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';
import { chunkExtractedText } from '../src/pipeline/requirement-chunker.js';
import { SourceLocationResolver } from '../src/pipeline/source-location-resolver.js';
import { RequirementSourceService } from '../src/requirement-source-service.js';
import { createHash } from 'node:crypto';
import { REQUIREMENT_CANDIDATE_SCHEMA, REQUIREMENT_CANDIDATE_SCHEMA_SHA256, REQUIREMENT_CANDIDATE_SCHEMA_VERSION } from '../../packages/semantic-contracts/index.js';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const REQUIREMENT_DB_ID = '00000000-0000-4000-8000-000000000002';

function sourceCandidate(text, category, sourceRef, mandatoryObserved = false) {
  return {
    text,
    category,
    source_range: { start_ref: sourceRef, end_ref: sourceRef },
    source_text: text,
    source_verified: true,
    source_resolution_status: 'verified',
    source_match_type: 'exact_single_paragraph',
    source_chunk_id: '00000000-0000-4000-8000-000000000003',
    source_page_start: 1,
    source_page_end: 1,
    source_paragraph_start: 1,
    source_paragraph_end: 1,
    source_refs: [sourceRef],
    mandatory_observed: mandatoryObserved,
    requires_confirmation: false
  };
}

function atomicRequirements() {
  return buildCanonicalRequirements([
    sourceCandidate('系统应支持统一身份认证。', 'functional', 'C001-S001', true),
    sourceCandidate('平台响应时间不超过2秒。', 'performance', 'C001-S002'),
    sourceCandidate('提供7×24小时运维服务。', 'service', 'C001-S003')
  ]).map((item, index) => ({
    ...item,
    id: `${REQUIREMENT_DB_ID.slice(0, -1)}${index + 3}`,
    target_sections: routeRequirement(item)
  }));
}

function section(sectionKey, title, paragraphs) {
  return {
    section_key: sectionKey,
    title,
    archive_role: null,
    content_text: paragraphs.map((item) => item.text).join('\n'),
    paragraphs
  };
}

test('scoring content is routed away from Requirement Extraction but retained for scoring', () => {
  const scoring = { text: '评分项：满足条件得5分。', paragraph: 2, page: 1 };
  const technical = { text: '系统应支持统一身份认证。', paragraph: 1, page: 1 };
  const routed = routeRequirementExtractionSections([
    section('technical_requirements', '技术要求', [technical, scoring]),
    section('evaluation_method', '评标方法和标准', [{ text: '技术方案得20分。', paragraph: 3, page: 1 }])
  ]);
  const technicalView = routed.requirementSections.find((item) => item.archive_role === 'requirement_extraction_routed_view');
  assert.deepEqual(technicalView.paragraphs.map((item) => item.text), [technical.text]);
  assert.deepEqual(routed.scoringSections.map((item) => item.section_key), ['evaluation_method']);
  assert.equal(routed.sections.find((item) => item.title === '技术要求').paragraphs.length, 2);
});

test('mixed technical/commercial clause remains safely eligible and unknown is never dropped', () => {
  const mixed = { text: '平台应提供统一身份认证，报价按合同约定执行。', paragraph: 1, page: 1 };
  const unknown = { text: '系统应提供可核验的审计日志。', paragraph: 2, page: 1 };
  const routed = routeRequirementExtractionSections([
    section('commercial', '商务条款', [mixed]),
    section('unclassified', '其他说明', [unknown])
  ]);
  assert.equal(routed.requirementSections.some((item) => item.archive_role === 'requirement_extraction_routed_view'), true);
  assert.equal(routed.requirementSections.some((item) => item.routing_role === 'UNKNOWN'), true);
  const combined = combineRequirementExtractionSections(routed.sections);
  assert.deepEqual(combined.paragraphs.map((item) => item.text), [mixed.text, unknown.text]);
});

test('classifier preserves source archive while routing unknown content into extraction scope', () => {
  const values = ['第一章 项目技术要求', '系统应支持审计。', '第二章 未识别章节', '平台应提供接口。'];
  const analysis = classifyTenderSections({
    text: values.join('\n'),
    paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: 1 })),
    pages: [], warnings: []
  });
  assert.equal(analysis.sections.length, 2);
  assert.equal(analysis.requirementExtractionSections.length, 2);
  assert.equal(analysis.sections.find((item) => item.routing_role === 'UNKNOWN').paragraphs.length, 2);
});

test('Candidate V3 remains distinct from Canonical Requirement and exact schema is unchanged', () => {
  assert.deepEqual(REQUIREMENT_CANDIDATE_SCHEMA.required, [
    'text', 'category', 'source_range', 'mandatory_observed', 'requires_confirmation'
  ]);
  assert.equal(REQUIREMENT_CANDIDATE_SCHEMA.additionalProperties, false);
  assert.equal(REQUIREMENT_CANDIDATE_SCHEMA_VERSION, '4.3-requirement-candidate-v3');
  assert.equal(REQUIREMENT_CANDIDATE_SCHEMA_SHA256, '1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba');
  assert.throws(() => validateCanonicalRequirements([sourceCandidate('系统应支持审计。', 'functional', 'C001-S001')]), {
    code: 'REQUIREMENT_ID_INVALID'
  });
});

test('atomic Canonical Requirements fan out through Chapter Router, Planning, Retrieval, Mapping, Claim Gate, Writer and Validator', async () => {
  const requirements = atomicRequirements();
  const evidenceCatalog = new EvidenceCatalogService([]);
  const plans = new DeterministicResponsePlanBuilder().build({ requirements, approvedEvidence: [] });
  assert.equal(plans.length, requirements.length);
  assert.deepEqual(planChapters(requirements).flatMap((item) => item.requirement_ids).sort(), requirements.map((item) => item.req_id).sort());
  const validated = new ResponsePlanValidator({ requirements, evidenceCatalog }).validate(plans).plans;
  assert.deepEqual(validated.map((item) => item.requirement_id), requirements.map((item) => item.req_id));
  assert.ok(validated.every((item) => item.target_sections.length));

  const claims = new DeterministicClaimBuilder().build({ requirements, plans: validated });
  const gate = new ClaimGateService({ projectId: PROJECT_ID, requirements, plans: validated, evidenceCatalog });
  const evaluated = gate.evaluate(claims).evaluated;
  assert.equal(evaluated.length, requirements.length);
  assert.ok(evaluated.every((item) => item.decision.decision === 'approved'));

  const coverage = new CoverageValidator().validate({ requirements, plans: validated, evaluatedClaims: evaluated });
  assert.equal(coverage.writer_eligible_requirement_count, requirements.length);
  assert.equal(coverage.requirements_with_approved_claim_count, requirements.length);
  assert.equal(coverage.risk_status, 'pass');

  const writerClaims = evaluated.map((item) => ({ ...item.claim, decision: item.decision.decision }));
  const batches = buildWriterBatches({
    project: { id: PROJECT_ID, name: '影响审计项目' },
    claims: writerClaims,
    plans: validated,
    evidence: []
  });
  assert.ok(batches.length > 0);
  assert.equal(batches.reduce((sum, batch) => sum + batch.claim_ids.length, 0), requirements.length);
  const chapterTitle = batches[0].input.chapter.title;
  const validation = validateDocument({
    text: `## ${chapterTitle}\n${writerClaims.find((item) => item.target_sections.includes(batches[0].chapter_id)).text}`,
    requirements,
    approvedClaims: writerClaims,
    approvedEvidence: []
  });
  assert.equal(validation.validation_pass, true);

  let retrievalQuery;
  let completeCalled = false;
  const retrievalRequirement = { ...requirements[0], id: REQUIREMENT_DB_ID, project_id: PROJECT_ID };
  const retrieval = new EnterpriseRetrievalService({
    repository: {
      getCanonicalRequirementForRetrieval: async () => retrievalRequirement,
      createRetrievalRun: async (value) => ({ retrieval_run_id: 'run-1', ...value }),
      listChunksForRetrieval: async () => [],
      prepareRetrievalCandidates: async (value) => { retrievalQuery = value; return []; },
      completeRetrievalRun: async (value) => { completeCalled = true; return { run: { status: 'succeeded' }, ...value }; },
      failRetrievalRun: async () => assert.fail('retrieval should not fail')
    },
    embeddingClient: {
      model: 'fixture-model', version: 'fixture-v1', dimension: 3,
      embed: async (texts) => { assert.deepEqual(texts, [retrievalRequirement.text]); return [[1, 0, 0]]; }
    },
    clock: () => 10
  });
  const retrievalResult = await retrieval.retrieve(REQUIREMENT_DB_ID);
  assert.equal(completeCalled, true);
  assert.deepEqual(retrievalQuery.queryVector, [1, 0, 0]);
  assert.equal(retrievalResult.answer_status, 'NO_RELEVANT_EVIDENCE');

  const mapping = await new RequirementEvidenceFactMappingService({
    repository: {
      getRequirementEvidenceFactMappingContext: async () => ({
        project_id: PROJECT_ID,
        requirement_id: requirements[0].req_id,
        requirement_db_id: REQUIREMENT_DB_ID,
        requirement_hash: 'req-hash',
        requirement_contract_version: 'canonical-v1',
        requirement_valid: true,
        fact_id: 'fact-1',
        fact_payload_hash: 'fact-hash',
        fact_contract_version: 'fact-v1',
        fact_review_status: 'approved',
        evidence_review_id: 'review-1',
        source_span_id: 'span-1',
        material_id: 'material-1'
      }),
      replaceRequirementEvidenceFactMappingAtomic: async (value) => value
    },
    evaluator: {
      version: 'fixture-mapping-v1',
      evaluate: async () => ({
        semantic_relationship: 'direct',
        support_level: 'full_support',
        dimensions: {
          subject_match: 'match', scope_match: 'match', status_match: 'match',
          quantitative_match: 'match', entity_match: 'match', validity_match: 'match', support_sufficiency: 'match'
        },
        reason_codes: []
      })
    }
  }).propose({ projectId: PROJECT_ID, requirementId: requirements[0].req_id, factId: 'fact-1' });
  assert.equal(mapping.review_status, 'proposed');
  assert.equal(mapping.requirement_id, requirements[0].req_id);
  assert.equal(mapping.claim_permission, undefined);
});

test('confirmed Requirement baseline cannot be silently rewritten by a more atomic extraction', () => {
  const baseline = atomicRequirements();
  const same = baseline.map((item) => ({ ...item }));
  assert.doesNotThrow(() => assertRequirementIdsUnchanged(baseline, same));
  const changed = baseline.map((item, index) => index === 1 ? { ...item, source_text: '被静默改写的来源。' } : { ...item });
  assert.throws(() => assertRequirementIdsUnchanged(baseline, changed), { code: 'REQUIREMENT_MANDATORY_METADATA_MUTATED' });
  const renumbered = baseline.map((item, index) => index === 0 ? { ...item, req_id: 'REQ-999' } : { ...item });
  assert.throws(() => assertRequirementIdsUnchanged(baseline, renumbered), { code: 'REQUIREMENT_ID_MUTATED' });
});

test('non-contiguous source refs and unsafe table units fail closed without synthetic provenance', () => {
  const resolver = new SourceLocationResolver();
  assert.throws(() => resolver.resolve({ source_range: {
    start_ref: 'C001-S001', end_ref: 'C001-S003'
  } }, {
    segments: [
      { source_ref: 'C001-S001', text: '第一行' },
      { source_ref: 'C001-S003', text: '第三行' }
    ]
  }), { code: 'SOURCE_LOCATION_UNRESOLVED' });

  assert.throws(() => chunkExtractedText({
    text: '不可拆分的表格行',
    paragraphs: [{
      text: '不可拆分的表格行', table_id: 'table-1', table_row_id: 'row-1',
      table_header_context: '级别|响应时间'
    }],
    singleCallThreshold: 1, characterBudget: 4, tokenBudget: 8000, sourceSpanBudget: 50
  }), { code: 'REQUIREMENT_SOURCE_SPAN_EXCEEDS_BUDGET' });
});

test('source reconciliation uses original paragraph bounds after routing compacts the semantic window', async () => {
  const values = [
    '第一章 投标邀请',
    '第四章 项目技术要求',
    '4.1 系统应支持统一身份认证。',
    '评分项：满足条件得5分。',
    '4.2 平台应提供审计日志。',
    '第五章 评标方法和标准'
  ];
  const extraction = {
    text: values.join('\n'),
    paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: 1 })),
    pages: [], warnings: []
  };
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const analysis = classifyTenderSections(extraction);
  const saved = [];
  const buffer = Buffer.from('fixture-pdf');
  const repository = {
    pool: {},
    getSourceReconciliationContext: async () => ({
      job: { status: 'succeeded', extracted_text_sha256: digest(extraction.text) },
      file: { id: 'file', storage_key: 'fixture.pdf', original_name: 'fixture.pdf', mime_type: 'text/plain', size_bytes: buffer.length },
      previous_file_hash: null,
      technical_section: { content_sha256: analysis.technicalSection.content_sha256 },
      chunks: [{ id: 'chunk', chunk_number: 1, source_start_offset: 0, source_end_offset: 58, source_start_paragraph: 2, source_end_paragraph: 5 }],
      candidates: [{ id: 'candidate', req_id: 'REQ-001', content: '平台应提供审计日志。', source_chunk_id: 'chunk', source_refs: ['C001-S003'], is_mandatory: false }]
    }),
    saveSourceReconciliation: async (value) => saved.push(value)
  };
  const service = new RequirementSourceService({
    repository,
    storage: { read: async () => buffer },
    textExtractor: async () => extraction
  });
  await service.reconcileRequirementSources('00000000-0000-0000-0000-000000000001');
  assert.equal(saved[0].updates[0].source_verified, true);
  assert.equal(saved[0].updates[0].source_text, '4.2 平台应提供审计日志。');
});
