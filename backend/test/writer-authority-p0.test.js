import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectionContext } from '../src/pipeline/section-context-builder.js';
import { createWriterSafeContext } from '../src/pipeline/writer-input-authorization-v1.js';
import { buildWriterTask, guardCriticalAssertions, validateWriterOutput } from '../src/pipeline/writer-execution-contract-v1.js';
import { WRITER_SYSTEM_PROMPT } from '../src/pipeline/external-writer-preflight-v1.js';
import { buildGenerationBatches } from '../src/pipeline/writer-generation-batch-builder-v2.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';

const PROJECT = 'writer-authority-p0-project';
const CHAPTER = 'chapter-01';
const HASH = 'a'.repeat(64);

const requirement = (overrides = {}) => ({
  req_id: 'REQ-001',
  text: '系统应支持统一身份认证。',
  requirement_category: 'technical',
  writer_eligible: true,
  is_mandatory: false,
  ...overrides
});

const claim = (overrides = {}) => ({
  claim_id: 'CLM-001',
  requirement_id: 'REQ-001',
  claim_type: 'enterprise_capability',
  text: '我司现有平台具备统一身份认证能力。',
  claim_text: '我司现有平台具备统一身份认证能力。',
  requested_commitment: 'conditional',
  allowed_scope: ['华东区域'],
  required_conditions: ['仅限已部署的 Model A'],
  limitations: ['不包含其他区域或型号'],
  target_sections: [CHAPTER],
  decision: 'approved',
  current: true,
  assertion_hash: HASH,
  referenced_fact_ids: [],
  referenced_mapping_ids: [],
  ...overrides
});

const gate = (overrides = {}) => ({
  claim_id: 'CLM-001',
  decision: 'allow',
  writer_eligible: true,
  lineage_current: true,
  current: true,
  claim_assertion_hash: HASH,
  gate_result_id: 'GATE-001',
  input_snapshot_hash: HASH,
  source_hashes: [HASH],
  allowed_scope: ['华东区域'],
  required_conditions: ['仅限已部署的 Model A'],
  ...overrides
});

const safe = (overrides = {}) => ({
  project_id: PROJECT,
  chapter_id: CHAPTER,
  authorization_snapshot_hash: HASH,
  contract_version: 'writer-safe-context-v1',
  context_items: [],
  assertable_claims: [],
  blocked_items: [],
  pending_items: [],
  ...overrides
});

const task = (overrides = {}) => buildWriterTask({
  safeContext: safe(),
  chapterRole: 'functional_solution',
  chapterInstruction: '仅使用授权输入。',
  ...overrides
});

const outputFor = (writerTask, text, refs = []) => validateWriterOutput(writerTask, {
  writer_task_id: writerTask.writer_task_id,
  chapter_id: writerTask.chapter_id,
  source_context_hash: writerTask.safe_context_hash,
  blocks: [{ block_id: 'block-1', text, used_context_refs: [], used_claim_refs: refs }]
});

test('provider prompt labels requirements as response-only', () => {
  assert.match(WRITER_SYSTEM_PROMPT, /REQUIREMENT_RESPONSE_ONLY/);
  assert.match(WRITER_SYSTEM_PROMPT, /enterprise capability/i);
});

test('provider batch keeps enterprise claims, project responses, and references in separate lanes', () => {
  const context = buildSectionContext({
    project: { id: PROJECT, name: '测试项目' },
    section: { section_id: CHAPTER, title: '功能响应', role: 'functional_solution', requirement_ids: ['REQ-001'] },
    requirements: [requirement()],
    claims: [],
    facts: [],
    bindings: [],
    gateResults: [],
    referenceMaterials: [{ material_id: 'M-1', chunk_id: 'C-1', source_text: '仅供参考。' }]
  });
  const [batch] = buildGenerationBatches({ plan: { sections: [context.section] }, sectionContexts: [context] });
  const [section] = batch.input.sections;
  assert.deepEqual(section.authorized_enterprise_claims, []);
  assert.deepEqual(section.authorized_project_responses, []);
  assert.deepEqual(section.context_only_references, [{ material_id: 'M-1', chunk_id: 'C-1', text: '仅供参考。', source_type: 'CONTEXT_ONLY' }]);
});

test('requirement context is explicitly response-only and not an enterprise fact', () => {
  const context = buildSectionContext({
    project: { id: PROJECT, name: '测试项目' },
    section: { section_id: CHAPTER, title: '功能响应', role: 'functional_solution', requirement_ids: ['REQ-001'] },
    requirements: [requirement()],
    claims: [],
    facts: [],
    bindings: [],
    gateResults: []
  });
  assert.equal(context.requirements[0].response_mode, 'REQUIREMENT_RESPONSE_ONLY');
  assert.equal(context.requirements[0].enterprise_capability_assertion_allowed, false);
  assert.deepEqual(context.authorized_enterprise_claims, []);
  assert.deepEqual(context.authorized_project_responses, []);
  assert.deepEqual(context.context_only_references, []);
});

test('writer guard blocks enterprise capability laundering from a bare requirement', () => {
  const writerTask = task({ requirements: [{ ...requirement(), response_mode: 'REQUIREMENT_RESPONSE_ONLY', enterprise_capability_assertion_allowed: false }] });
  const output = outputFor(writerTask, '我司现有平台具备统一身份认证能力。');
  const guard = guardCriticalAssertions(writerTask, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.some((finding) => finding.code === 'WRITER_REQUIREMENT_LAUNDERING'));
});

test('production V2 entry point blocks laundering before Writer persistence', async () => {
  const context = buildSectionContext({
    project: { id: PROJECT, name: '测试项目' },
    section: { section_id: CHAPTER, title: '功能响应', role: 'functional_solution', requirement_ids: ['REQ-001'] },
    requirements: [requirement()],
    claims: [],
    facts: [],
    bindings: [],
    gateResults: []
  });
  const service = new DocumentGenerationService({
    repository: {},
    writerV2: true,
    provider: { async draft() { return { content: '我司现有平台具备统一身份认证能力。', audit: { provider: 'test' } }; } }
  });
  const batch = { section_ids: [CHAPTER], chapter_id: CHAPTER, section_contexts: [context], input: { sections: [{ section: context.section, requirements: context.requirements, approved_claims: [], project_facts: [], reference_materials: [] }] } };
  await assert.rejects(() => service.executeV2Batch(batch, { persist: false }), (error) => error.code === 'WRITER_OUTPUT_GUARD_FAILED');
});

test('requirement-response language remains allowed without an enterprise claim', () => {
  const writerTask = task({ requirements: [{ ...requirement(), response_mode: 'REQUIREMENT_RESPONSE_ONLY', enterprise_capability_assertion_allowed: false }] });
  const output = outputFor(writerTask, '本项目将按照招标要求开展设计、测试与验收。');
  assert.equal(guardCriticalAssertions(writerTask, output).status, 'pass');
});

test('authorized claim projection preserves restrict fields and lineage', () => {
  const context = createWriterSafeContext({
    projectId: PROJECT,
    chapterId: CHAPTER,
    facts: [],
    bindings: [],
    claims: [claim()],
    gateResults: [gate()]
  });
  const projected = context.assertable_claims[0];
  assert.ok(projected);
  assert.equal(projected.claim_text, claim().claim_text);
  assert.equal(projected.claim_type, 'enterprise_capability');
  assert.equal(projected.requested_commitment, 'conditional');
  assert.deepEqual(projected.allowed_scope, ['华东区域']);
  assert.deepEqual(projected.required_conditions, ['仅限已部署的 Model A']);
  assert.deepEqual(projected.limitations, ['不包含其他区域或型号']);
  assert.equal(projected.claim_assertion_hash, HASH);
  assert.equal(projected.gate_result_id, 'GATE-001');
  assert.equal(projected.input_snapshot_hash, HASH);
  assert.deepEqual(projected.source_hashes, [HASH]);
  assert.equal(projected.lineage_current, true);

  const writerTask = task({ safeContext: context });
  assert.deepEqual(writerTask.assertable_claims[0].limitations, ['不包含其他区域或型号']);
});

test('restrict expansion is blocked instead of entering finalized output', () => {
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims: [claim()], gateResults: [gate()] });
  const writerTask = task({ safeContext: context });
  const output = outputFor(writerTask, '我司现有平台在全国范围具备统一身份认证能力。', ['CLM-001']);
  const guard = guardCriticalAssertions(writerTask, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.some((finding) => finding.code === 'WRITER_AUTHORITY_EXPANSION'));
});

test('scope expansion is blocked even when the provider omits the claim reference', () => {
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims: [claim()], gateResults: [gate()] });
  const writerTask = task({ safeContext: context });
  const output = outputFor(writerTask, '系统支持全国所有产品的统一身份认证能力。');
  const guard = guardCriticalAssertions(writerTask, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.some((finding) => finding.code === 'WRITER_AUTHORITY_EXPANSION'));
});

test('validity and protocol expansion are blocked for a narrow claim', () => {
  const narrow = claim({ limitations: ['仅限当前有效期和 SSO'], allowed_scope: ['华东区域'] });
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims: [narrow], gateResults: [gate()] });
  const writerTask = task({ safeContext: context });
  const output = outputFor(writerTask, '我司现有平台在华东区域长期有效，并支持 LDAP 与 AD。', ['CLM-001']);
  const guard = guardCriticalAssertions(writerTask, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.filter((finding) => finding.code === 'WRITER_AUTHORITY_EXPANSION').length >= 2);
});

test('different model or region is not substituted for an authorized narrow scope', () => {
  const narrow = claim({ allowed_scope: ['华东区域', 'Model A'], limitations: ['仅限 Model A'] });
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims: [narrow], gateResults: [gate()] });
  const writerTask = task({ safeContext: context });
  const output = outputFor(writerTask, '我司现有平台在华南区域支持 Model B。', ['CLM-001']);
  const guard = guardCriticalAssertions(writerTask, output);
  assert.equal(guard.status, 'failed');
  assert.ok(guard.findings.filter((finding) => finding.code === 'WRITER_AUTHORITY_EXPANSION').length >= 2);
});

test('requirement-response claim remains visible without a project fact', () => {
  const responseClaim = claim({
    claim_type: 'requirement_response',
    text: '本项目将按照招标要求开展统一身份认证设计。',
    claim_text: '本项目将按照招标要求开展统一身份认证设计。',
    requested_commitment: 'conditional',
    allowed_scope: [],
    required_conditions: [],
    limitations: []
  });
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims: [responseClaim], gateResults: [gate()] });
  assert.deepEqual(context.assertable_claims.map((item) => item.claim_id), ['CLM-001']);
  const sectionContext = buildSectionContext({
    project: { id: PROJECT, name: '测试项目' },
    section: { section_id: CHAPTER, title: '功能响应', role: 'functional_solution', requirement_ids: ['REQ-001'] },
    requirements: [requirement()],
    claims: [responseClaim],
    facts: [],
    bindings: [],
    gateResults: [gate()]
  });
  assert.deepEqual(sectionContext.authorized_project_responses.map((item) => item.claim_id), ['CLM-001']);
  assert.deepEqual(sectionContext.authorized_enterprise_claims, []);
});

test('stale, restricted, and reference-only claims remain invisible', () => {
  const claims = [claim({ claim_id: 'CLM-STALE', assertion_hash: 'b'.repeat(64) }), claim({ claim_id: 'CLM-RESTRICT', assertion_hash: 'c'.repeat(64) }), claim({ claim_id: 'CLM-REF', assertion_hash: 'd'.repeat(64) })];
  const gates = [gate({ claim_id: 'CLM-STALE', claim_assertion_hash: 'b'.repeat(64), current: false }), gate({ claim_id: 'CLM-RESTRICT', claim_assertion_hash: 'c'.repeat(64), decision: 'restrict' }), gate({ claim_id: 'CLM-REF', claim_assertion_hash: 'd'.repeat(64), writer_eligible: false })];
  const context = createWriterSafeContext({ projectId: PROJECT, chapterId: CHAPTER, facts: [], bindings: [], claims, gateResults: gates });
  assert.deepEqual(context.assertable_claims, []);
});
