import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceLocationResolver } from '../src/pipeline/source-location-resolver.js';
import { RequirementSourceService, summarizeSourceReadiness } from '../src/requirement-source-service.js';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';
import { createHash } from 'node:crypto';

function chunk(values) {
  return { id: '00000000-0000-0000-0000-000000000001', segments: values.map((text, index) => ({
    source_ref: `C001-S${String(index + 1).padStart(3, '0')}`,
    text, paragraph: index + 10, page: index < 2 ? 16 : 17,
    source_start_offset: index * 100, source_end_offset: index * 100 + text.length
  })) };
}

test('来源 resolver 支持单段、跨2至8段及跨页确定性反向映射', () => {
  const resolver = new SourceLocationResolver();
  const value = chunk(['第一段要求', '第二段连续', '第三段跨页', '第四段结束']);
  const single = resolver.resolve({ source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' } }, value).location;
  assert.equal(single.source_match_type, 'exact_single_paragraph');
  const multi = resolver.resolve({ source_range: { start_ref: 'C001-S001', end_ref: 'C001-S004' } }, value).location;
  assert.equal(multi.source_verified, true);
  assert.equal(multi.source_match_type, 'exact_multi_paragraph_span');
  assert.equal(multi.source_paragraph_start, 10);
  assert.equal(multi.source_paragraph_end, 13);
  assert.equal(multi.source_page_start, 16);
  assert.equal(multi.source_page_end, 17);
  assert.equal(multi.source_paragraphs_json.length, 4);
});

test('source range 保持后端原文边界，不接受模型改写文本', () => {
  const result = new SourceLocationResolver().resolve(
    { source_range: { start_ref: 'C001-S001', end_ref: 'C001-S002' } },
    chunk(['系统(含审计)应支持:', '日志查询.'])
  ).location;
  assert.equal(result.source_verified, true);
  assert.equal(result.source_match_type, 'exact_multi_paragraph_span');
});

test('未知来源范围使当前 chunk fail closed，不能进入 unresolved Candidate', () => {
  const resolver = new SourceLocationResolver();
  assert.throws(
    () => resolver.resolve({ source_range: { start_ref: 'C001-S999', end_ref: 'C001-S999' } }, chunk(['原文要求提供完整的审计能力和日志查询功能'])),
    (error) => error.code === 'SOURCE_LOCATION_UNRESOLVED'
  );
});

test('生产确认门禁阻止 mandatory 未定位及 pending，并允许全部处理后的 include', () => {
  assert.equal(summarizeSourceReadiness([{ is_mandatory: true, source_verified: false, candidate_decision: 'pending' }]).mandatory_unverified, 1);
  assert.equal(summarizeSourceReadiness([{ is_mandatory: false, source_verified: false, candidate_decision: 'pending' }]).pending, 1);
  const ready = summarizeSourceReadiness([
    { is_mandatory: true, source_verified: true, candidate_decision: 'include' },
    { is_mandatory: false, source_verified: false, candidate_decision: 'exclude' }
  ]);
  assert.deepEqual(ready, { pending: 0, included: 1, excluded: 1, mandatory_unverified: 0, mandatory_provisional_pending: 0, included_unverified: 0 });
});

function reconciliationFixture({ previousFileHash = null, extractedHash } = {}) {
  const values = ['第一章 投标邀请', '第二章 投标人须知', '第三章 投标人须知', '第四章 项目要求和有关说明', '5.1 第一段要求', '第二段连续', '第五章 评标方法和标准'];
  const extraction = { text: values.join('\n'), paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: index + 1 })), pages: [], warnings: [] };
  const buffer = Buffer.from('unchanged-pdf');
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const saved = [];
  const repository = {
    pool: {},
    getSourceReconciliationContext: async () => ({
      job: { status: 'succeeded', extracted_text_sha256: extractedHash || digest(extraction.text) },
      file: { id: 'file', storage_key: 'file.pdf', original_name: 'file.pdf', mime_type: 'application/pdf', size_bytes: buffer.length },
      previous_file_hash: previousFileHash,
      technical_section: { content_sha256: classifyTenderSections(extraction).technicalSection.content_sha256 },
      chunks: [], candidates: [{ id: 'candidate', req_id: 'REQ-001', content: '正文不变', source_text: '第一段要求第二段连续', source_refs: ['C001-S002', 'C001-S003'], source_clause_id: '5.1', is_mandatory: false, ordinal: 1, candidate_decision: 'pending' }]
    }),
    saveSourceReconciliation: async (value) => saved.push(value)
  };
  return { extraction, buffer, digest, saved, repository };
}

test('离线 reconciliation 幂等且不需要 Gateway、不改变正文与REQ-ID', async () => {
  const fixture = reconciliationFixture();
  const service = new RequirementSourceService({ repository: fixture.repository, storage: { read: async () => fixture.buffer }, textExtractor: async () => fixture.extraction });
  const first = await service.reconcileRequirementSources('00000000-0000-0000-0000-000000000001');
  const second = await service.reconcileRequirementSources('00000000-0000-0000-0000-000000000001');
  assert.deepEqual(first.statistics, second.statistics);
  assert.equal(fixture.saved.length, 2);
  assert.equal(fixture.saved[0].updates[0].id, 'candidate');
  assert.equal(fixture.saved[0].updates[0].source_verified, true);
  assert.equal(fixture.repository.gateway, undefined);
});

test('文件hash或提取文本hash不一致时停止且不更新候选', async () => {
  const fileMismatch = reconciliationFixture({ previousFileHash: 'different' });
  await assert.rejects(() => new RequirementSourceService({ repository: fileMismatch.repository, storage: { read: async () => fileMismatch.buffer }, textExtractor: async () => fileMismatch.extraction }).reconcileRequirementSources('00000000-0000-0000-0000-000000000001'), (error) => error.code === 'TENDER_FILE_HASH_MISMATCH');
  assert.equal(fileMismatch.saved.length, 0);
  const textMismatch = reconciliationFixture({ extractedHash: 'different' });
  await assert.rejects(() => new RequirementSourceService({ repository: textMismatch.repository, storage: { read: async () => textMismatch.buffer }, textExtractor: async () => textMismatch.extraction }).reconcileRequirementSources('00000000-0000-0000-0000-000000000001'), (error) => error.code === 'EXTRACTED_TEXT_HASH_MISMATCH');
  assert.equal(textMismatch.saved.length, 0);
});
