import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentPlan, validateDocumentPlan } from '../src/pipeline/document-plan.js';
import { buildSectionContext } from '../src/pipeline/section-context-builder.js';
import { WriterReferenceSelector } from '../src/pipeline/writer-reference-selector.js';
import { buildGenerationBatches } from '../src/pipeline/writer-generation-batch-builder-v2.js';
import { parseSectionMarkers, renderSectionMarkers } from '../src/pipeline/writer-output-markers.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';
import { createApp } from '../src/app.js';
import { buildBidDocumentModel } from '../src/pipeline/bid-document-model.js';

const requirement = (id, category = 'technical', text = `${id} 应提供能力。`) => ({
  req_id: id, text, requirement_category: category, writer_eligible: true, is_mandatory: false
});
const claim = (id, reqId, sections, text = `${reqId} 已批准响应。`) => ({
  claim_id: id, requirement_id: reqId, basis_requirement_ids: [reqId], target_sections: sections,
  text, decision: 'approved', current: true, assertion_hash: `hash-${id}`
});

test('DocumentPlan uses explicit signals, assigns every writer requirement, and rejects duplicates', () => {
  const plan = buildDocumentPlan({
    requirements: [requirement('REQ-1'), requirement('REQ-2', 'service')],
    structureSignals: [
      { section_id: 'S05', parent_id: null, title: '技术响应', role: 'technical_bid_section', order: 1 },
      { section_id: 'S05-01', parent_id: 'S05', title: '功能响应', role: 'functional_solution', order: 2 }
    ],
    routes: { 'REQ-1': 'S05-01', 'REQ-2': 'S05-01' }
  });
  assert.deepEqual(plan.sections[1].requirement_ids, ['REQ-1', 'REQ-2']);
  assert.doesNotThrow(() => validateDocumentPlan(plan, [requirement('REQ-1'), requirement('REQ-2', 'service')]));
  assert.throws(() => validateDocumentPlan({ sections: [{ ...plan.sections[0] }, { ...plan.sections[0] }] }, []), { code: 'DOCUMENT_PLAN_INVALID' });
  assert.throws(() => validateDocumentPlan({ contract_version: 'document-plan-v1', sections: [{ section_id: 'S1', parent_id: 'MISSING', requirement_ids: ['REQ-1'] }] }, [requirement('REQ-1')]), { code: 'DOCUMENT_PLAN_INVALID' });
  assert.throws(() => validateDocumentPlan({ contract_version: 'document-plan-v1', sections: [{ section_id: 'S1', parent_id: null, requirement_ids: ['UNKNOWN'] }] }, [requirement('REQ-1')]), { code: 'DOCUMENT_PLAN_INVALID' });
});

test('DocumentPlan falls back to the deterministic technical bid template', () => {
  const plan = buildDocumentPlan({ requirements: [requirement('REQ-1')] });
  assert.equal(plan.sections.length, 11);
  assert.equal(plan.sections[0].section_id, 'chapter-01');
  assert.deepEqual(plan.sections.flatMap((section) => section.requirement_ids), ['REQ-1']);
});

test('SectionContext only projects authorized inputs and excludes internal Evidence/Mapping fields', () => {
  const section = { section_id: 'S05-01', title: '功能响应', role: 'functional_solution', requirement_ids: ['REQ-1'] };
  const auth = { build: input => ({ ...input, contract_version: 'writer-safe-context-v1', project_id: input.projectId, chapter_id: input.chapterId, authorization_snapshot_hash: 'ctx', context_items: [], assertable_claims: [], blocked_items: [], pending_items: [] }) };
  const context = buildSectionContext({ project: { id: 'P', name: '项目' }, section, requirements: [requirement('REQ-1'), requirement('REQ-2')], claims: [claim('CLM-1', 'REQ-1', ['S05-01']), { ...claim('CLM-2', 'REQ-2', ['S05-01']), decision: 'rejected' }], facts: [], bindings: [], gateResults: [], referenceMaterials: [{ material_id: 'M', chunk_id: 'C', text: '方法参考', source_type: 'CONTEXT_ONLY', similarity_score: 0.99 }] }, { authorizationService: auth });
  assert.deepEqual(context.requirements.map(x => x.requirement_id), ['REQ-1']);
  assert.deepEqual(context.approved_claims, []);
  assert.equal(context.reference_materials[0].source_type, 'CONTEXT_ONLY');
  assert.equal('similarity_score' in context.reference_materials[0], false);
  assert.equal('mapping_id' in context, false);
});

test('SectionContext projects only current allow Claim and approved Project Fact', () => {
  const fact = { project_fact_id: 'PF-1', version: 1, key: 'users', value: '6238', value_status: 'known', review_status: 'approved', conflict_status: 'none', fact_role: 'enterprise_fact', payload_hash: 'p-hash' };
  const approved = claim('CLM-ALLOW', 'REQ-1', ['S1'], '系统覆盖6238名用户。');
  approved.referenced_fact_ids = ['PF-1'];
  const context = buildSectionContext({ project: { id: 'P', name: '项目' }, section: { section_id: 'S1', title: '功能', role: 'functional_solution', requirement_ids: ['REQ-1'] }, requirements: [requirement('REQ-1')], claims: [approved, { ...approved, claim_id: 'CLM-BLOCK', decision: 'rejected' }], facts: [fact], bindings: [{ project_fact_id: 'PF-1', target_type: 'chapter', target_id: 'S1', binding_role: 'required', binding_status: 'active', propagation_id: 'PB-1' }], gateResults: [{ claim_id: 'CLM-ALLOW', decision: 'allow', writer_eligible: true, lineage_current: true, claim_assertion_hash: approved.assertion_hash, gate_result_id: 'G-1', input_snapshot_hash: 'I-1' }] });
  assert.deepEqual(context.approved_claims.map(x => x.claim_id), ['CLM-ALLOW']);
  assert.deepEqual(context.project_facts.map(x => x.project_fact_id), ['PF-1']);
  assert.equal(context.safe_context.blocked_items.length, 0);
});

test('SectionContext never exposes claim_required enterprise Fact to Provider input', () => {
  const fact = { project_fact_id: 'PF-UNAUTHORIZED', version: 1, key: 'users', value: '6238名用户', value_status: 'known', review_status: 'approved', conflict_status: 'none', fact_role: 'enterprise_fact', payload_hash: 'p-hash' };
  const context = buildSectionContext({ project: { id: 'P', name: '项目' }, section: { section_id: 'S1', title: '功能', role: 'functional_solution', requirement_ids: ['REQ-1'] }, requirements: [requirement('REQ-1')], claims: [], facts: [fact], bindings: [{ project_fact_id: fact.project_fact_id, target_type: 'chapter', target_id: 'S1', binding_role: 'required', binding_status: 'active' }], gateResults: [] });
  assert.deepEqual(context.project_facts, []);
  assert.equal(context.safe_context.context_items.length, 0);
  assert.equal(context.safe_context.blocked_items[0].authorization_mode, 'claim_required');
  assert.equal(context.safe_context.blocked_items[0].value, '6238名用户');
});

test('WriterReferenceSelector filters types, deduplicates deterministically, bounds Top K, and performs no writes', async () => {
  let writes = 0;
  const repository = { listWriterReferenceChunks: async () => [
    { material_id: 'M1', chunk_id: 'C1', chunk_hash: 'H1', material_type: 'technical_solution', source_text: '系统支持统一身份认证。' },
    { material_id: 'M1', chunk_id: 'C1b', chunk_hash: 'H1', material_type: 'technical_solution', source_text: '系统支持统一身份认证（重复）。' },
    { material_id: 'M2', chunk_id: 'C2', chunk_hash: 'H2', material_type: 'technical_whitepaper', source_text: '系统提供可追溯的运维记录。' },
    { material_id: 'M3', chunk_id: 'C3', chunk_hash: 'H3', material_type: 'project_case', source_text: 'blocked' }
  ], createRetrievalRun: async () => { writes += 1; } };
  const selected = await new WriterReferenceSelector({ repository }).select({ projectId: 'P', section: { title: '功能' }, requirements: [requirement('REQ-1')], topK: 2 });
  assert.deepEqual(selected.map(x => x.chunk_id), ['C1', 'C2']);
  assert.equal(writes, 0);
});

test('GenerationBatchBuilder groups adjacent sections only within token budget and fails closed for a dense section', () => {
  const sections = ['S1', 'S2', 'S3'].map((id) => ({ section_id: id, parent_id: 'P', title: id, role: 'functional_solution', requirement_ids: [id] }));
  const contexts = sections.map(section => ({ section, requirements: [requirement(section.section_id)], approved_claims: [], project_facts: [], reference_materials: [] }));
  const batches = buildGenerationBatches({ plan: { sections }, sectionContexts: contexts, maxTokens: 1000 });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].chapter_id, 'P');
  assert.equal(batches[0].input.chapter_id, 'P');
  assert.deepEqual(batches[0].section_ids, ['S1', 'S2', 'S3']);
  assert.throws(() => buildGenerationBatches({ plan: { sections: [sections[0]] }, sectionContexts: [{ ...contexts[0], reference_materials: [{ text: 'x'.repeat(3000) }] }], maxTokens: 10 }), { code: 'WRITER_BATCH_OVER_BUDGET' });
});

test('GenerationBatchBuilder caps groups at four sections', () => {
  const sections = Array.from({ length: 5 }, (_, i) => ({ section_id: `S${i + 1}`, parent_id: 'P', title: `S${i + 1}`, role: 'functional_solution', requirement_ids: [`R${i + 1}`] }));
  const contexts = sections.map(section => ({ section, requirements: [requirement(section.requirement_ids[0])], approved_claims: [], project_facts: [], reference_materials: [] }));
  const batches = buildGenerationBatches({ plan: { sections }, sectionContexts: contexts, maxTokens: 1000 });
  assert.deepEqual(batches.map(x => x.section_ids), [['S1', 'S2', 'S3', 'S4'], ['S5']]);
});

test('section markers are strict and deterministic', () => {
  const text = renderSectionMarkers([{ section_id: 'S1', content: '一' }, { section_id: 'S2', content: '二' }]);
  assert.deepEqual(parseSectionMarkers(text, ['S1', 'S2']), { S1: '一', S2: '二' });
  assert.throws(() => parseSectionMarkers('<<<SECTION:S1>>>x<<<END_SECTION>>>', ['S1', 'S2']), { code: 'WRITER_SECTION_MARKER_INVALID' });
  assert.throws(() => parseSectionMarkers('<<<SECTION:S1>>>x<<<END_SECTION>>><<<SECTION:S1>>>y<<<END_SECTION>>>', ['S1']), { code: 'WRITER_SECTION_MARKER_INVALID' });
  assert.throws(() => parseSectionMarkers('<<<SECTION:S1>>>x<<<END_SECTION>>><<<SECTION:UNKNOWN>>>y<<<END_SECTION>>>', ['S1']), { code: 'WRITER_SECTION_MARKER_INVALID' });
});

test('DocumentPlan sections project into the existing bid-document model', () => {
  const model = buildBidDocumentModel({ project: { id: 'P', name: '项目' }, version: { id: 'V', project_id: 'P', final_text: '正文', sections_json: [{ section_id: 'S1', title: '功能响应', order: 1, content_markdown: '正文' }] } });
  assert.equal(model.sections[0].section_id, 'S1');
  assert.equal(model.sections[0].content_blocks[0].text, '正文');
});

test('production service V2 composition reaches Safe Context, guard, validator and version persistence', async () => {
  const events = [];
  let providerInput = null;
  const repository = {
    async getDocumentGenerationInput() { return { project: { id: 'P', name: '项目' }, baseline: { id: 'B' }, requirements: [requirement('REQ-1')], plans: [], claims: [claim('CLM-1', 'REQ-1', ['chapter-01'])], evidence: [], coverage: {} }; },
    async createDocumentGeneration(_projectId, snapshot) { events.push(['generation', snapshot]); return { id: 'G', project_id: 'P', coverage_snapshot: {}, requirement_snapshot: snapshot.requirements, claim_snapshot: snapshot.claims, evidence_snapshot: snapshot.evidence, tasks: [] }; },
    async createDocumentTasks(_id, batches) { events.push(['tasks', batches]); },
    async claimDocumentTask() { return true; },
    async finishDocumentTask(_id, batch, status, data) { events.push(['finish', batch, status, data]); },
    async getDocumentGeneration() { return { id: 'G', project_id: 'P', tasks: [{ chapter_id: 'chapter-01', batch_index: 0, output_markdown: '<<<SECTION:chapter-01>>>\n正文\n<<<END_SECTION>>>', input_snapshot: { sections: [{ section: { section_id: 'chapter-01' } }] }, claim_ids: ['CLM-1'] }], requirement_snapshot: [requirement('REQ-1')], claim_snapshot: [claim('CLM-1', 'REQ-1', ['chapter-01'])], evidence_snapshot: [], coverage_snapshot: {} }; },
    async createPipelineDocumentVersion(input) { events.push(['version', input]); return { id: 'V1', sections_json: input.sections_json }; },
    async updateDocumentGeneration() {},
    async listProjectFacts() { return [{ project_fact_id: 'PF-UNAUTHORIZED', version: 1, key: 'users', value: '6238名用户', value_status: 'known', review_status: 'approved', conflict_status: 'none', fact_role: 'enterprise_fact', payload_hash: 'p-hash' }]; },
    async listProjectFactPropagationBindings() { return [{ project_fact_id: 'PF-UNAUTHORIZED', target_type: 'chapter', target_id: 'chapter-01', binding_role: 'required', binding_status: 'active', propagation_id: 'PB-UNAUTHORIZED' }]; },
    async listLatestClaimGateEvaluations() { return []; },
    async saveWriterSafeContext() { events.push(['safe-context']); },
    async upsertFactMentionLedger() {},
    async saveWriterExecutionTask() { events.push(['writer-task']); },
    async saveWriterOutput() { events.push(['writer-output']); },
    async upsertMaterializedFactMentions() {}
  };
  const service = new DocumentGenerationService({ repository, provider: { async draft(batch) { providerInput = batch.input; return { content: renderSectionMarkers(batch.input.sections.map(s => ({ section_id: s.section.section_id, content: '安全正文' }))), audit: { provider: 'mock' } }; } }, writerV2: true, concurrency: 1 });
  const app = createApp({ repository, documentGenerationService: service, projectAuthorizationService: { assertProjectAccess: async () => {} }, actorResolver: () => ({ actor_id: 'writer-test', actor_type: 'test', source: 'test' }) });
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/P/document-generations`, { method: 'POST' });
    assert.equal(response.status, 201);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  assert.ok(events.some(x => x[0] === 'safe-context'));
  assert.ok(events.some(x => x[0] === 'writer-task'));
  assert.ok(providerInput);
  assert.deepEqual(providerInput.sections.flatMap((section) => section.project_facts), []);
  assert.equal(JSON.stringify(providerInput).includes('6238名用户'), false);
  const versionEvent = events.find(x => x[0] === 'version');
  assert.ok(versionEvent);
  assert.equal(versionEvent[1].validation.structural_validation.valid, true);
  assert.equal(versionEvent[1].validation.document_structure_validation.valid, true);
  assert.deepEqual(versionEvent[1].sections_json[0].requirement_ids, ['REQ-1']);
});

test('V2 regeneration reuses the frozen section snapshot without a retrieval run', async () => {
  let retrievalCalls = 0;
  let providerCalls = 0;
  const repository = {
    async getPipelineDocumentVersion() {
      return {
        id: 'V1', project_id: 'P', title: '项目', final_text: '旧正文',
        sections_json: [
          { chapter_id: 'chapter-01', title: '编制说明', order: 1, requirement_ids: ['REQ-1'], content_markdown: '旧正文' },
          { chapter_id: 'chapter-02', title: '项目需求理解', order: 2, requirement_ids: [], content_markdown: '保留正文' }
        ],
        requirement_snapshot: [{ ...requirement('REQ-1'), target_sections: ['chapter-01'] }],
        claim_snapshot: [], evidence_snapshot: [],
        chapter_tasks: [{ input_snapshot: { sections: [{ section: { section_id: 'chapter-01' }, reference_materials: [{ material_id: 'M1', chunk_id: 'C1', source_text: '冻结参考' }] }] } }]
      };
    },
    async listProjectFacts() { return []; },
    async listProjectFactPropagationBindings() { return []; },
    async listLatestClaimGateEvaluations() { return []; },
    async listWriterReferenceChunks() { retrievalCalls += 1; return []; }
  };
  const service = new DocumentGenerationService({
    repository,
    writerV2: true,
    referenceSelector: { async select() { retrievalCalls += 1; return []; } },
    provider: { async draft(batch) { providerCalls += 1; return { content: renderSectionMarkers(batch.input.sections.map((section) => ({ section_id: section.section.section_id, content: '重生成正文' }))), audit: { provider: 'mock' } }; } }
  });
  const prepared = await service.prepareRegeneration('V1', 'chapter-01');
  assert.equal(prepared.chapter_id, 'chapter-01');
  assert.equal(providerCalls, 1);
  assert.equal(retrievalCalls, 0);
  assert.equal(prepared.preview.sections_json.find((section) => section.chapter_id === 'chapter-01').content_markdown, '重生成正文');
});

test('formal writer plan uses backend writer_authorized projection, not legacy writer_eligible', () => {
  const requirements = [
    { req_id: 'REQ-FORMAL', requirement_category: 'service', writer_eligible: false, writer_authorized: true },
    { req_id: 'REQ-COMPLIANCE', requirement_category: 'contractual', writer_eligible: true, writer_authorized: false }
  ];
  const plan = buildDocumentPlan({ requirements, structureSignals: [{ section_id: 'S1', title: '方案', role: 'technical_bid_section', requirement_ids: [] }] });
  assert.deepEqual(plan.sections[0].requirement_ids, ['REQ-FORMAL']);
});

test('formal writer gate does not filter by legacy writer_eligible', async () => {
  const service = new DocumentGenerationService({ writerV2: true, repository: {
    async getDocumentGenerationInput() { return { project: { id: 'P' }, baseline: { id: 'B' }, requirements: [{ req_id: 'REQ-SERVICE', text: '本项目应制定服务方案', requirement_category: 'service', writer_eligible: false }], claims: [], evidence: [] }; }
  } });
  const result = await service.gate('P');
  assert.deepEqual(result.requirements.map((item) => item.req_id), ['REQ-SERVICE']);
});
