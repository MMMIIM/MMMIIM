import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceSearchOrchestrator,
  isStructuralOnlyEvidenceText,
  profileAwareHierarchicalProjection
} from '../src/evidence-search-orchestrator.js';
import { buildEvidenceNeedProfile } from '../src/evidence-need-profile-builder.js';

const requirement = {
  requirement_id: 'REQ-001', project_id: 'project-eval',
  text: '系统应提供事件标准化和接口联动能力。', requirement_hash: 'b'.repeat(64)
};
const profile = buildEvidenceNeedProfile({
  requirement,
  responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH' },
  enterpriseId: 'SYNTH-CHENGCHUAN-001'
});
const chunk = (id, overrides = {}) => ({
  material_id: `00000000-0000-4000-8000-0000000000${id}`.slice(-36),
  chunk_id: `MCH-${id}`,
  chunk_hash: String(id).padStart(64, 'a'),
  source_text: `candidate source ${id}`,
  enterprise_id: 'SYNTH-CHENGCHUAN-001',
  project_id: 'project-eval',
  source_role: 'EVIDENCE_CANDIDATE',
  authority: 'SYNTHETIC_EVAL_ONLY',
  production_authority: 'NONE',
  corpus_scope: 'ENTERPRISE_PRIVATE',
  lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded',
  material_type: 'product_documentation',
  ...overrides
});

function isolatedRepository(rows, calls) {
  return {
    isolation_mode: 'ISOLATED_EVAL',
    async listEvidenceCandidateChunks() { calls.listed += 1; return rows; },
    async upsertEvalEmbeddings(items) { calls.embedded.push(...items); },
    async rankEvidenceCandidateChunks({ candidates }) {
      return candidates.map((item, index) => ({ ...item, similarity_score: 0.99 - index / 100 }));
    }
  };
}

test('Evidence search applies evidence-only, enterprise, lifecycle and role gates before embedding and emits bounded candidate lineage', async () => {
  const calls = { listed: 0, embedded: [] };
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([
      chunk('01'),
      chunk('02', { source_role: 'REFERENCE_ONLY', material_type: 'product' }),
      chunk('03', { enterprise_id: 'OTHER-ENTERPRISE' }),
      chunk('04', { lifecycle_status: 'QUARANTINED' }),
      chunk('05', { source_role: null })
    ], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed(texts) { return texts.map(() => [1, 0, 0]); } }
  });

  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.equal(calls.listed, 1);
  assert.equal(calls.embedded.length, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source_role, 'EVIDENCE_CANDIDATE');
  assert.equal(result.candidates[0].creates_fact_authority, false);
  assert.equal(result.candidates[0].creates_claim_authority, false);
  assert.equal(result.candidates[0].profile_hash, profile.profile_hash);
  assert.equal(result.evidence_gap.status, 'FACT_REVIEW_REQUIRED');
});

test('Evidence search treats K=0 as a valid no-evidence result and never asserts absent enterprise capability', async () => {
  const calls = { listed: 0, embedded: [] };
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([chunk('11', { source_role: 'REFERENCE_ONLY' })], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed() { assert.fail('K=0 must not invoke embedding'); } }
  });

  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.evidence_gap.status, 'NO_EVIDENCE_FOUND');
  assert.equal(result.evidence_gap.means, 'NO_SUFFICIENT_EVIDENCE_FOUND');
  assert.equal(result.evidence_gap.means_enterprise_lacks_capability, false);
  assert.equal(calls.embedded.length, 0);
});

test('Evidence search content-deduplicates same chunk_hash across different chunk IDs and keeps the highest-ranked lineage', async () => {
  const calls = { listed: 0, embedded: [] };
  const sharedHash = 'c'.repeat(64);
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([
      chunk('31', { chunk_hash: sharedHash }),
      chunk('32', { chunk_hash: sharedHash })
    ], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed(texts) { return texts.map(() => [1, 0, 0]); } }
  });

  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].chunk_id, 'MCH-31');
  assert.equal(result.candidates[0].source_hash, sharedHash);
  assert.equal(result.retrieval_diagnostics.raw_candidate_count, 2);
  assert.equal(result.retrieval_diagnostics.deduplicated_candidate_count, 1);
  assert.equal(result.retrieval_diagnostics.content_duplicate_groups.length, 1);
  assert.equal(result.retrieval_diagnostics.content_duplicate_groups[0].removed_count, 1);
  assert.equal(result.retrieval_diagnostics.duplicate_candidates_removed_total, 1);
  assert.equal(result.retrieval_diagnostics.final_duplicate_candidate_count, 0);
});

test('Evidence search content-deduplicates same chunk_hash across different material IDs without merging lineage', async () => {
  const calls = { listed: 0, embedded: [] };
  const sharedHash = 'd'.repeat(64);
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([
      chunk('33', { material_id: '00000000-0000-4000-8000-000000000033', chunk_hash: sharedHash }),
      chunk('34', { material_id: '00000000-0000-4000-8000-000000000034', chunk_hash: sharedHash })
    ], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed(texts) { return texts.map(() => [1, 0, 0]); } }
  });

  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].material_id, '00000000-0000-4000-8000-000000000033');
  assert.equal(result.retrieval_diagnostics.content_duplicate_groups[0].removed_candidates[0].material_id, '00000000-0000-4000-8000-000000000034');
});

test('Evidence search keeps different chunk_hash candidates and preserves authority isolation after content deduplication', async () => {
  const calls = { listed: 0, embedded: [] };
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([
      chunk('35', { chunk_hash: 'e'.repeat(64) }),
      chunk('36', { chunk_hash: 'f'.repeat(64) }),
      chunk('37', { chunk_hash: '1'.repeat(64), source_role: 'REFERENCE_ONLY' }),
      chunk('38', { chunk_hash: '2'.repeat(64), enterprise_id: 'OTHER-ENTERPRISE' }),
      chunk('39', { chunk_hash: '3'.repeat(64), lifecycle_status: 'QUARANTINED' })
    ], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed(texts) { return texts.map(() => [1, 0, 0]); } }
  });

  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.deepEqual(result.candidates.map(item => item.chunk_id), ['MCH-35', 'MCH-36']);
  assert.equal(new Set(result.candidates.map(item => item.search_run_id)).size, 1);
  assert.equal(result.search_run_id, result.candidates[0].search_run_id);
  assert.equal(result.retrieval_diagnostics.content_duplicate_groups.length, 0);
});

test('Evidence search uses a structural title only as a material discovery anchor and emits the substantive sibling lineage', () => {
  const title = chunk('40', { material_id: '00000000-0000-4000-8000-000000000040', source_text: '# 性能与容量测试报告', similarity_score: 0.99 });
  const body = chunk('41', { material_id: title.material_id, source_text: '系统性能测试结果显示，响应时间满足当前测试条件。', similarity_score: 0.40 });
  const projected = profileAwareHierarchicalProjection([title, body], profile).projected;
  assert.equal(isStructuralOnlyEvidenceText(title.source_text), true);
  assert.equal(isStructuralOnlyEvidenceText(body.source_text), false);
  assert.equal(projected.length, 1);
  assert.equal(projected[0].chunk_id, body.chunk_id);
  assert.equal(projected[0].final_evidence_chunk_id, body.chunk_id);
  assert.equal(projected[0].discovery_anchor_chunk_id, title.chunk_id);
  assert.equal(projected[0].chunk_hash, body.chunk_hash);
});

test('Evidence search profile class changes bounded material ranking priority without hard-excluding another evidence type', () => {
  const product = chunk('42', { material_id: '00000000-0000-4000-8000-000000000042', material_type: 'product_documentation', source_text: '产品平台能力说明。', similarity_score: 0.50 });
  const performance = chunk('43', { material_id: '00000000-0000-4000-8000-000000000043', material_type: 'performance_test', source_text: '性能测试报告。', similarity_score: 0.50 });
  const performanceProfile = { ...profile, evidence_need_class: 'PERFORMANCE', critical_literals: [], search_signals: ['PERFORMANCE'] };
  const productProfile = { ...profile, evidence_need_class: 'PRODUCT_CAPABILITY', critical_literals: [], search_signals: ['PRODUCT_CAPABILITY'] };
  assert.equal(profileAwareHierarchicalProjection([product, performance], performanceProfile).projected[0].material_id, performance.material_id);
  assert.equal(profileAwareHierarchicalProjection([product, performance], productProfile).projected[0].material_id, product.material_id);

  const higherSemanticProduct = { ...product, similarity_score: 0.80 };
  const lowerSemanticPerformance = { ...performance, similarity_score: 0.74 };
  assert.equal(profileAwareHierarchicalProjection([higherSemanticProduct, lowerSemanticPerformance], performanceProfile).projected[0].material_id, product.material_id);
});

test('Evidence search critical literals provide a deterministic bounded ranking supplement', () => {
  const plain = chunk('44', { material_id: '00000000-0000-4000-8000-000000000044', source_text: '系统处理能力说明。', similarity_score: 0.50 });
  const literal = chunk('45', { material_id: '00000000-0000-4000-8000-000000000045', source_text: '系统性能与响应说明。', similarity_score: 0.50 });
  const literalProfile = { ...profile, evidence_need_class: 'PERFORMANCE', critical_literals: ['性能'], search_signals: ['PERFORMANCE', '性能'] };
  const first = profileAwareHierarchicalProjection([plain, literal], literalProfile).projected[0];
  const second = profileAwareHierarchicalProjection([plain, literal], literalProfile).projected[0];
  assert.equal(first.material_id, literal.material_id);
  assert.deepEqual(first.profile_rerank_contribution.matched_critical_literals, ['性能']);
  assert.deepEqual(first, second);
});

test('Evidence search keeps qualification behavior bounded and deterministic', () => {
  const qualification = chunk('46', { material_id: '00000000-0000-4000-8000-000000000046', material_type: 'qualification', source_text: '企业持有信息安全认证证书。', similarity_score: 0.50 });
  const product = chunk('47', { material_id: '00000000-0000-4000-8000-000000000047', material_type: 'product_documentation', source_text: '产品平台功能说明。', similarity_score: 0.51 });
  const qualificationProfile = { ...profile, evidence_need_class: 'QUALIFICATION', critical_literals: ['认证'], search_signals: ['QUALIFICATION', '认证'] };
  const projected = profileAwareHierarchicalProjection([product, qualification], qualificationProfile).projected;
  assert.equal(projected[0].material_id, qualification.material_id);
  assert.deepEqual(projected[0].profile_rerank_contribution.matched_critical_literals, ['认证']);
});

test('Evidence search excludes duplicate headings while retaining substantive spans from each discovered material', () => {
  const firstHeading = chunk('48', { material_id: '00000000-0000-4000-8000-000000000048', source_text: '# 案例', similarity_score: 0.90 });
  const firstBody = chunk('49', { material_id: firstHeading.material_id, source_text: '项目已完成接口联调并记录验收结果。', similarity_score: 0.30 });
  const secondHeading = chunk('50', { material_id: '00000000-0000-4000-8000-000000000050', source_text: '# 案例', similarity_score: 0.89 });
  const secondBody = chunk('51', { material_id: secondHeading.material_id, source_text: '项目已完成接口联调并记录验收结果。', similarity_score: 0.29 });
  const projected = profileAwareHierarchicalProjection([firstHeading, firstBody, secondHeading, secondBody], profile).projected;
  assert.deepEqual(projected.map(item => item.chunk_id), [firstBody.chunk_id, secondBody.chunk_id]);
  assert.ok(projected.every(item => !isStructuralOnlyEvidenceText(item.source_text)));
});

test('Evidence search preserves no-match K=0 and stable deterministic tie-break behavior', async () => {
  const calls = { listed: 0, embedded: [] };
  const search = new EvidenceSearchOrchestrator({
    repository: isolatedRepository([], calls),
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed() { assert.fail('empty eligible pool must not invoke embedding'); } }
  });
  const result = await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001', maxCandidates: 5 });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.evidence_gap.status, 'NO_EVIDENCE_FOUND');
  const left = chunk('52', { material_id: '00000000-0000-4000-8000-000000000052', similarity_score: 0.50 });
  const right = chunk('53', { material_id: '00000000-0000-4000-8000-000000000053', similarity_score: 0.50 });
  const first = profileAwareHierarchicalProjection([right, left], profile).projected.map(item => item.chunk_id);
  const second = profileAwareHierarchicalProjection([left, right], profile).projected.map(item => item.chunk_id);
  assert.deepEqual(first, second);
});

test('Evidence search binds a frozen Eval vector snapshot once and reuses only the exact model/version/dimension identity', async () => {
  const calls = { listed: 0, embedded: [] };
  const rows = [chunk('21')];
  const repository = isolatedRepository(rows, calls);
  repository.upsertEvalEmbeddings = async items => {
    calls.embedded.push(...items);
    for (const item of items) Object.assign(rows.find(row => row.chunk_id === item.chunk_id), {
      eval_embedding: item.embedding,
      eval_embedding_model: item.embedding_model,
      eval_embedding_version: item.embedding_version,
      eval_embedding_dimension: item.embedding_dimension
    });
  };
  const embeddingClient = { model: 'fixture', version: 'v1', dimension: 3, async embed(texts) { return texts.map(() => [1, 0, 0]); } };
  const search = new EvidenceSearchOrchestrator({ repository, embeddingClient });
  await search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001' });
  await search.search({ requirement: { ...requirement, requirement_id: 'REQ-002', text: '另一个检索问题。' }, profile: { ...profile, requirement_id: 'REQ-002' }, enterpriseId: 'SYNTH-CHENGCHUAN-001' });
  assert.equal(calls.embedded.length, 1);
  rows[0].eval_embedding_dimension = 4;
  await assert.rejects(
    () => search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001' }),
    error => error.code === 'EVIDENCE_SEARCH_EMBEDDING_IDENTITY_MISMATCH'
  );
});

test('Evidence search refuses a non-isolated repository before any retrieval or embedding operation', async () => {
  const search = new EvidenceSearchOrchestrator({
    repository: { isolation_mode: 'PRODUCTION', async listEvidenceCandidateChunks() { assert.fail('must not read'); } },
    embeddingClient: { model: 'fixture', version: 'v1', dimension: 3, async embed() { assert.fail('must not embed'); } }
  });
  await assert.rejects(
    () => search.search({ requirement, profile, enterpriseId: 'SYNTH-CHENGCHUAN-001' }),
    error => error.code === 'EVIDENCE_SEARCH_ISOLATED_EVAL_REQUIRED'
  );
});
