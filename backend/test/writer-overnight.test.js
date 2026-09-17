import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/errors.js';
import { routeBatchGeneration } from '../src/pipeline/batch-generation-router.js';
import { buildGenerationBatches, mergePlannedSections } from '../src/pipeline/writer-generation-batch-builder-v2.js';
import { WriterExecutionService } from '../src/writer-execution-service.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';
import { guardCriticalAssertions } from '../src/pipeline/writer-execution-contract-v1.js';
import { createWriterProvider } from '../src/pipeline/writer-provider.js';
import { createApp } from '../src/app.js';
import { runWriterFastGate } from '../eval/rag-pilot/writer-fast-gate-v1.js';

const section = (id, requirements = ['REQ-1']) => ({
  section_id: id,
  parent_id: null,
  title: id,
  role: 'functional_solution',
  order: requirements.length ? 1 : 2,
  requirement_ids: requirements
});

test('V2 simple single-section batch reuses deterministic routing policy', () => {
  const route = routeBatchGeneration({
    chapter_id: 'S1',
    section_ids: ['S1'],
    input: {
      chapter_id: 'S1',
      sections: [{
        section: section('S1'),
        requirements: [{ req_id: 'REQ-1', text: '系统应提供审计日志。' }],
        approved_claims: [{ claim_id: 'CLM-1', requirement_id: 'REQ-1', text: '系统应提供审计日志。' }],
        authorized_project_responses: [{ claim_id: 'CLM-1', requirement_id: 'REQ-1', text: '系统应提供审计日志。' }],
        authorized_enterprise_claims: [],
        project_facts: [],
        reference_materials: [],
        context_only_references: []
      }]
    }
  });
  assert.equal(route.generation_mode, 'deterministic_template');
  assert.match(route.content, /系统应提供审计日志/);
});

test('V2 batch with authorized enterprise/context material stays semantic', () => {
  const route = routeBatchGeneration({
    section_ids: ['S1'],
    input: { sections: [{ section: section('S1'), requirements: [{ req_id: 'REQ-1', text: '要求' }], approved_claims: [{ claim_id: 'CLM-1', text: '能力' }], authorized_enterprise_claims: [{ claim_id: 'CLM-1', text: '能力' }], project_facts: [{ project_fact_id: 'PF-1', value: '受控事实' }], reference_materials: [], context_only_references: [] }] }
  });
  assert.equal(route.generation_mode, 'semantic_gateway');
});

test('V2 implementation actions are carried into routing and prevent deterministic shortcut', () => {
  const route = routeBatchGeneration({
    section_ids: ['S1'],
    input: {
      sections: [{ section: section('S1'), requirements: [{ req_id: 'REQ-1', text: '要求' }], response_plans: [{ requirement_id: 'REQ-1', implementation_actions: ['部署'] }], approved_claims: [{ claim_id: 'CLM-1', basis_requirement_ids: ['REQ-1'], text: '要求' }], authorized_enterprise_claims: [], project_facts: [], reference_materials: [], context_only_references: [] }]
    }
  });
  assert.equal(route.generation_mode, 'semantic_gateway');
});

test('V2 batch preserves plan conditions, responsibility boundaries, and approved Evidence for routing', () => {
  const batch = buildGenerationBatches({
    plan: { sections: [section('S1')] },
    sectionContexts: [{
      section: section('S1'),
      requirements: [{ requirement_id: 'REQ-1', text: '要求' }],
      approved_claims: [{ claim_id: 'CLM-1', basis_requirement_ids: ['REQ-1'], text: '要求' }],
      authorized_enterprise_claims: [],
      authorized_project_responses: [],
      project_facts: [],
      reference_materials: [],
      context_only_references: []
    }],
    responsePlans: [{ requirement_id: 'REQ-1', implementation_actions: [], conditions: ['甲方确认接口'], responsibility_boundaries: ['不含第三方改造'] }],
    approvedEvidence: [{ evidence_id: 'EVD-1', title: '已批准材料', content: '受控证据', usage_scope: ['REQ-1'], risk_notes: [], applicable_requirement_ids: ['REQ-1'] }]
  });
  const input = batch[0].input.sections[0];
  assert.deepEqual(input.conditions, ['甲方确认接口']);
  assert.deepEqual(input.responsibility_boundaries, ['不含第三方改造']);
  assert.deepEqual(input.approved_evidence.map((item) => item.evidence_id), ['EVD-1']);
  assert.equal(routeBatchGeneration(batch[0]).generation_mode, 'semantic_gateway');
});

test('V2 malformed routing metadata fails closed to semantic gateway', () => {
  const route = routeBatchGeneration({ input: {
    sections: [{
      section: section('S1'),
      requirements: [{ requirement_id: 'REQ-1', text: '要求' }],
      approved_claims: [{ claim_id: 'CLM-1', basis_requirement_ids: ['REQ-1'], text: '要求' }],
      response_plans: [{ requirement_id: 'REQ-1', implementation_actions: [] }],
      conditions: '未经确认', approved_evidence: [], responsibility_boundaries: [],
      authorized_enterprise_claims: [], project_facts: [], reference_materials: [], context_only_references: []
    }]
  }});
  assert.equal(route.generation_mode, 'semantic_gateway');
});

test('assembly rejects missing planned sections', () => {
  assert.throws(
    () => mergePlannedSections([{ section_outputs: [{ section_id: 'S1', content_markdown: '正文' }] }], { sections: [section('S1'), section('S2')] }),
    (error) => error instanceof AppError && error.code === 'ASSEMBLY_INCOMPLETE'
  );
});

test('assembly rejects duplicate and unknown section outputs', () => {
  assert.throws(
    () => mergePlannedSections([{ section_outputs: [{ section_id: 'S1', content_markdown: '一' }, { section_id: 'S1', content_markdown: '二' }] }], { sections: [section('S1')] }),
    (error) => error.code === 'ASSEMBLY_DUPLICATE'
  );
  assert.throws(
    () => mergePlannedSections([{ section_outputs: [{ section_id: 'UNKNOWN', content_markdown: '未知' }] }], { sections: [section('S1')] }),
    (error) => error.code === 'ASSEMBLY_UNKNOWN_SECTION'
  );
});

test('WriterExecutionService uses one atomic persistence boundary when available', async () => {
  const task = { writer_task_id: 'WT-1' };
  const result = { task, output: { writer_output_id: 'WO-1' }, mentions: [], guard: {}, verification: {} };
  const calls = [];
  const service = new WriterExecutionService({ repository: {
    async persistWriterExecutionAtomic(value) { calls.push(value); return { task: value.task, output: value.output, mentions: value.mentions }; },
    async saveWriterExecutionTask() { throw new Error('split task write must not be used'); },
    async saveWriterOutput() { throw new Error('split output write must not be used'); },
    async upsertMaterializedFactMentions() { throw new Error('split mention write must not be used'); }
  } });
  const persisted = await service.persist(result);
  assert.equal(calls.length, 1);
  assert.equal(persisted.output.writer_output_id, 'WO-1');
});

test('V2 generation identity is stable and an idempotent replay does not create tasks or call Writer', async () => {
  let createCalls = 0;
  let taskWrites = 0;
  let providerCalls = 0;
  let inputCalls = 0;
  const identities = [];
  const tasks = [];
  const existing = { id: 'G-1', project_id: 'P', tasks, requirement_snapshot: [{ req_id: 'REQ-1', text: '系统应提供审计日志。', requirement_category: 'technical', writer_eligible: true, is_mandatory: false }], claim_snapshot: [{ claim_id: 'CLM-1', requirement_id: 'REQ-1', basis_requirement_ids: ['REQ-1'], target_sections: ['chapter-01'], text: '系统应提供审计日志。', decision: 'approved', current: true }], evidence_snapshot: [], coverage_snapshot: {} };
  const repository = {
    async getDocumentGenerationInput() { inputCalls += 1; return { project: { id: 'P', name: '项目' }, baseline: { id: 'B' }, requirements: [{ req_id: 'REQ-1', text: '系统应提供审计日志。', requirement_category: 'technical', writer_eligible: true, is_mandatory: false }], plans: inputCalls >= 3 ? [{ requirement_id: 'REQ-1', conditions: ['甲方确认接口'], implementation_actions: [] }] : [], claims: [{ claim_id: 'CLM-1', requirement_id: 'REQ-1', claim_type: 'requirement_response', basis_requirement_ids: ['REQ-1'], target_sections: ['chapter-01'], text: '系统应提供审计日志。', decision: 'approved', current: true, assertion_hash: 'ASSERT-1' }], evidence: [], coverage: {} }; },
    async createDocumentGeneration(_projectId, _snapshot, _rules, identity) { identities.push(identity.input_snapshot_hash); createCalls += 1; return createCalls === 1 ? { ...existing, idempotent_replay: false } : { ...existing, idempotent_replay: true }; },
    async createDocumentTasks(_id, batches) { taskWrites += 1; tasks.push(...batches.map((batch) => ({ ...batch, status: 'queued', output_markdown: null, input_snapshot: batch.input }))); },
    async claimDocumentTask(_id, chapterId, batchIndex) { const task = tasks.find((item) => item.chapter_id === chapterId && item.batch_index === batchIndex); if (!task || task.status !== 'queued') return false; task.status = 'running'; return true; },
    async finishDocumentTask(_id, batch, status, data) { const task = tasks.find((item) => item.chapter_id === batch.chapter_id && item.batch_index === batch.batch_index); Object.assign(task, { status, ...data }); },
    async getDocumentGeneration() { return existing; },
    async listProjectFacts() { return []; },
    async listProjectFactPropagationBindings() { return []; },
    async listLatestClaimGateEvaluations() { return [{ claim_id: 'CLM-1', decision: 'allow', writer_eligible: true, current: true, lineage_current: true, claim_assertion_hash: 'ASSERT-1', gate_result_id: 'GATE-1', input_snapshot_hash: 'INPUT-1' }]; },
    async saveWriterSafeContext() {},
    async upsertFactMentionLedger() {},
    async createPipelineDocumentVersion(input) { return { id: 'V-1', sections_json: input.sections_json }; },
    async updateDocumentGeneration() {}
  };
  const service = new DocumentGenerationService({ repository, writerV2: true, provider: { async draft() { providerCalls += 1; return { content: '' }; } }, referenceSelector: { async select() { return []; } } });
  await service.generateV2('P');
  await service.generateV2('P');
  await service.generateV2('P');
  assert.equal(createCalls, 3);
  assert.equal(taskWrites, 1);
  assert.equal(providerCalls, 0);
  assert.equal(identities[0], identities[1]);
  assert.notEqual(identities[1], identities[2]);
});

test('critical guard catches high-risk commitment and expansion phrases', () => {
  const task = {
    requirements: [], context_items: [],
    assertable_claims: [{ claim_id: 'CLM-1', claim_type: 'enterprise_capability', claim_text: '系统支持统一认证。', allowed_scope: ['当前项目'], required_conditions: [], limitations: ['不包含其他区域'], structured_assertion: [] }]
  };
  const output = { blocks: [{ block_id: 'b1', text: '我司承诺全国所有产品7×24服务，SLA 99.99%，保证第三方配合。', used_context_refs: [], used_claim_refs: ['CLM-1'] }] };
  const guard = guardCriticalAssertions(task, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.some((item) => item.code === 'WRITER_AUTHORITY_EXPANSION' || item.code === 'WRITER_UNSUPPORTED_COMMITMENT'));
});

test('critical guard covers generic SLA, scope, regional and third-party expansion tokens', () => {
  const task = {
    requirements: [], context_items: [],
    assertable_claims: [{ claim_id: 'CLM-BOUNDARY', claim_type: 'enterprise_capability', claim_text: '系统提供服务。', allowed_scope: ['当前项目'], required_conditions: [], limitations: [] }]
  };
  const output = { blocks: [{ block_id: 'b1', text: '覆盖全部产品、所有地区，全天候提供服务，7×24响应，SLA 99.99%，保证第三方配合。', used_context_refs: [], used_claim_refs: [] }] };
  const guard = guardCriticalAssertions(task, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.length >= 5);
  assert.ok(guard.findings.some((item) => item.code === 'WRITER_AUTHORITY_EXPANSION'));
  assert.ok(guard.findings.some((item) => item.code === 'WRITER_UNSUPPORTED_COMMITMENT'));
});

test('V2 retry stops after the bounded retry budget is exhausted', async () => {
  const service = new DocumentGenerationService({ repository: { async getDocumentGeneration() { return { id: 'G', tasks: [{ status: 'failed', attempt: 2, chapter_id: 'S1', batch_index: 0 }] }; } }, writerV2: true, provider: { async draft() { throw new Error('must not call'); } } });
  await assert.rejects(() => service.retry('G'), (error) => error.code === 'WRITER_RETRY_EXHAUSTED');
});

test('Writer semantic audit keeps identity and safe usage fields without raw provider payload', async () => {
  const envelope = {
    schema_version: '4.3-section-drafting',
    task_type: 'section_drafting',
    status: 'success',
    data: { chapter_id: 'S1', content_markdown: '安全正文。' },
    warnings: []
  };
  const provider = createWriterProvider({
    env: {
      GENERATION_PROVIDER: 'semantic_gateway',
      V43_WRITER_GATEWAY_API_BASE: 'https://writer.example/v1',
      V43_WRITER_GATEWAY_API_KEY: 'test-only-key',
      V43_WRITER_TIMEOUT_MS: '1000',
      V43_WRITER_GATEWAY_MODEL: 'writer-fixture',
      V43_WRITER_GATEWAY_VERSION: 'v1',
      V43_WRITER_GATEWAY_TEMPERATURE: '0',
      V43_WRITER_GATEWAY_MAX_OUTPUT_TOKENS: '128',
      V43_WRITER_GATEWAY_ENABLE_THINKING: 'false',
      V43_GATEWAY_USER: 'writer-test'
    },
    fetchImpl: async () => new Response(JSON.stringify({ data: { outputs: { response_payload_json: JSON.stringify(envelope) } } }), { status: 200 })
  });
  const result = await provider.draft({ chapter_id: 'S1', section_ids: ['S1'], input: { sections: [] } });
  assert.equal(result.content, '安全正文。');
  assert.equal(result.audit.provider, 'semantic_gateway');
  assert.equal(result.audit.model, 'writer-fixture');
  assert.equal(result.audit.model_version, 'v1');
  assert.equal(result.audit.prompt_version, 'writer-prompt-v1');
  assert.match(result.audit.prompt_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.audit.schema_version, 'writer-output-v1');
  assert.equal(result.audit.input_tokens, 'NOT_EXPOSED');
  assert.equal(result.audit.output_tokens, 'NOT_EXPOSED');
  assert.equal(typeof result.audit.latency_ms, 'number');
  assert.equal(Object.hasOwn(result.audit, 'raw_response_payload_json'), false);
  assert.equal(JSON.stringify(result.audit).includes('test-only-key'), false);
});

test('production Writer HTTP entry keeps authorization and gate failures as JSON negative controls', async () => {
  let generateCalls = 0;
  const app = createApp({
    repository: {},
    documentGenerationService: {
      async generate(projectId) {
        generateCalls += 1;
        if (projectId === 'P-NO-CLAIM') throw new AppError('COVERAGE_CRITICAL', 'mandatory Requirement 缺少 approved Claim。', 409);
        throw new AppError('DOCUMENT_GENERATION_IDENTITY_CONFLICT', '已有相同输入的正文生成任务。', 409);
      }
    },
    projectAuthorizationService: {
      async assertProjectAccess({ projectId }) {
        if (projectId !== 'P-NO-CLAIM') throw new AppError('PROJECT_ACCESS_DENIED', '当前身份无权执行该项目操作。', 403);
      }
    },
    actorResolver: () => ({ actor_id: 'writer-http-test', actor_type: 'test', source: 'test' })
  });
  const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const unauthorized = await fetch(`${base}/api/projects/P-CROSS/document-generations`, { method: 'POST' });
    const unauthorizedBody = await unauthorized.json();
    assert.equal(unauthorized.status, 403);
    assert.equal(unauthorizedBody.ok, false);
    assert.equal(unauthorizedBody.error.code, 'PROJECT_ACCESS_DENIED');
    const blocked = await fetch(`${base}/api/projects/P-NO-CLAIM/document-generations`, { method: 'POST' });
    const blockedBody = await blocked.json();
    assert.equal(blocked.status, 409);
    assert.equal(blockedBody.ok, false);
    assert.equal(blockedBody.error.code, 'COVERAGE_CRITICAL');
    assert.equal(generateCalls, 1);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('one failed V2 batch is terminal, auditable, and cannot finalize a version', async () => {
  const finished = [];
  let versionWrites = 0;
  const generation = {
    id: 'G-FAILED', project_id: 'P', tasks: [], requirement_snapshot: [], claim_snapshot: [], evidence_snapshot: [], coverage_snapshot: {}
  };
  const repository = {
    async claimDocumentTask() { return true; },
    async finishDocumentTask(_generationId, batch, status, data) { finished.push({ batch, status, data }); },
    async getDocumentGeneration() { return { ...generation, tasks: [{ status: 'failed', chapter_id: 'S1', batch_index: 0, input_snapshot: { sections: [{ section: { section_id: 'S1' } }] }, output_markdown: null }] }; },
    async updateDocumentGeneration(_id, data) { Object.assign(generation, data); },
    async createPipelineDocumentVersion() { versionWrites += 1; throw new Error('must not create a version'); }
  };
  const service = new DocumentGenerationService({ repository, writerV2: true, concurrency: 1, provider: { async draft() { throw Object.assign(new Error('provider unavailable'), { code: 'GATEWAY_NETWORK_ERROR' }); } } });
  await service.runBatchesV2('G-FAILED', [{ chapter_id: 'chapter-01', section_ids: ['S1'], batch_index: 0, input: { sections: [{ section: section('S1'), requirements: [{ req_id: 'REQ-1', text: '要求' }], approved_claims: [{ claim_id: 'CLM-1', basis_requirement_ids: ['REQ-1'], text: '要求' }], authorized_enterprise_claims: [], project_facts: [], reference_materials: [{ material_id: 'M1', chunk_id: 'C1', source_text: '受控参考' }], context_only_references: [{ material_id: 'M1', chunk_id: 'C1', source_text: '受控参考' }] }] } }]);
  assert.equal(finished.length, 1);
  assert.equal(finished[0].status, 'failed');
  assert.equal(finished[0].data.provider_audit.section_ids[0], 'S1');
  assert.equal(finished[0].data.provider_audit.error_category, 'GATEWAY_NETWORK_ERROR');
  const finalized = await service.finalizeV2('G-FAILED', { sections: [section('S1')] });
  assert.equal(finalized.status, 'failed');
  assert.equal(versionWrites, 0);
});

test('WRITER_FAST_GATE is deterministic and uses zero Provider calls', () => {
  const result = runWriterFastGate();
  assert.equal(result.status, 'PASS');
  assert.equal(result.provider_calls, 0);
  assert.equal(result.metrics.unauthorized_assertion_count, 0);
  assert.equal(result.metrics.requirement_laundering_count, 0);
  assert.equal(result.metrics.authority_expansion_count, 0);
  assert.equal(result.metrics.restrict_condition_loss_count, 0);
  assert.equal(result.metrics.fact_bypass_count, 0);
  assert.equal(result.metrics.mapping_bypass_count, 0);
  assert.equal(result.metrics.stale_authorization_use_count, 0);
  assert.equal(result.metrics.authorized_requirement_response_retention, 1);
  assert.equal(result.metrics.section_completeness, 1);
});
