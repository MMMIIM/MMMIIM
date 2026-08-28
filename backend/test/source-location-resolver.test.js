import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceLocationResolver, parseSourceHint } from '../src/pipeline/source-location-resolver.js';
import { validateRequirementExtractionEnvelope } from '../src/pipeline/requirement-extraction.js';

const chunk = {
  id: '11111111-1111-4111-8111-111111111111', chunk_number: 1,
  source_start_offset: 0, source_end_offset: 100,
  segments: [
    { source_ref: 'C001-S001', paragraph: 5, page: 2, text: '5.1 系统应记录审计日志。', source_start_offset: 0, source_end_offset: 15, source_section: '第四章', source_clause_id: '5.1' },
    { source_ref: 'C001-S002', paragraph: 8, page: 3, text: '系统应保留操作记录。', source_start_offset: 16, source_end_offset: 25, source_section: '第四章', source_clause_id: '5.2' },
    { source_ref: 'C001-S003', paragraph: 12, page: 4, text: '系统应支持审计查询。', source_start_offset: 26, source_end_offset: 35, source_section: '第四章', source_clause_id: '5.3' }
  ]
};

test('source_paragraph number、数字字符串和第N段只转为 source_hint', () => {
  assert.equal(parseSourceHint(123).hint, 123);
  assert.equal(parseSourceHint('123').hint, 123);
  assert.equal(parseSourceHint('第123段').hint, 123);
  assert.equal(parseSourceHint([123, 124]).hint, 123);
});

test('无效 source_paragraph 被忽略并产生 warning', () => {
  const result = parseSourceHint('第十二段附近');
  assert.equal(result.hint, null);
  assert.equal(result.warning.code, 'SOURCE_HINT_IGNORED');
});

test('单段 source_range 由后端生成真实页码、段落和 hash', () => {
  const result = new SourceLocationResolver().resolve({ source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' } }, chunk);
  assert.equal(result.warning, null);
  assert.equal(result.location.source_text, '5.1 系统应记录审计日志。');
  assert.equal(result.location.source_paragraph, 5);
  assert.equal(result.location.source_page, 2);
  assert.match(result.location.source_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.location.source_chunk_id, chunk.id);
  assert.deepEqual(result.location.source_refs, ['C001-S001']);
});

test('连续多段 source_range 反向映射段落、页码和上下文', () => {
  const result = new SourceLocationResolver().resolve({ source_range: { start_ref: 'C001-S001', end_ref: 'C001-S002' } }, chunk);
  assert.equal(result.warning, null);
  assert.equal(result.location.source_paragraph_start, 5);
  assert.equal(result.location.source_paragraph_end, 8);
  assert.equal(result.location.source_page_start, 2);
  assert.equal(result.location.source_page_end, 3);
  assert.equal(result.location.source_paragraphs_json.length, 2);
  assert.equal(result.location.source_match_type, 'exact_multi_paragraph_span');
  assert.match(result.location.source_context_text, /操作记录/);
});

test('未知 source_range 端点使当前 chunk fail closed', () => {
  assert.throws(
    () => new SourceLocationResolver().resolve({ source_range: { start_ref: 'C001-S999', end_ref: 'C001-S999' } }, chunk),
    (error) => error.code === 'SOURCE_LOCATION_UNRESOLVED'
  );
});

test('反向 source_range 使当前 chunk fail closed', () => {
  assert.throws(
    () => new SourceLocationResolver().resolve({ source_range: { start_ref: 'C001-S003', end_ref: 'C001-S001' } }, chunk),
    (error) => error.code === 'SOURCE_LOCATION_UNRESOLVED'
  );
});

test('source_range 缺失、额外字段或格式非法仍为非法候选', () => {
  assert.throws(() => new SourceLocationResolver().resolve({}, chunk), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  assert.throws(() => new SourceLocationResolver().resolve({ source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001', extra: true } }, chunk), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  assert.throws(() => new SourceLocationResolver().resolve({ source_range: { start_ref: 'SPAN-1', end_ref: 'SPAN-1' } }, chunk), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
});

test('模型来源文本和历史别名不会被 resolver 接受', () => {
  assert.throws(() => new SourceLocationResolver().resolve({ source_text: '系统应记录审计日志。' }, chunk), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  assert.throws(() => new SourceLocationResolver().resolve({ source_excerpt: '系统应记录审计日志。' }, chunk), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
});

test('Schema Adapter 拒绝 source_text/source_clause/content/source_excerpt 模型字段', () => {
  const envelope = (candidate) => ({
    envelope: { schema_version: '4.3-requirement-extraction-v3', task_type: 'requirement_extraction', status: 'success', warnings: [], data: { requirements: [candidate] } },
    audit: {}
  });
  const base = { text: '记录日志', category: 'technical', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }, mandatory_observed: true, requires_confirmation: false };
  for (const candidate of [
    { ...base, source_text: '系统应记录审计日志。' },
    { ...base, source_clause: '5.1' },
    { ...base, content: '记录日志' },
    { ...base, source_excerpt: '系统应记录审计日志。' }
  ]) {
    assert.throws(() => validateRequirementExtractionEnvelope(envelope(candidate)), error => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  }
});
