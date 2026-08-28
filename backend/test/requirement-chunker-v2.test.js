import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyBoundary,
  chunkExtractedText,
  mapRequirementCandidateToCanonicalInput,
  resolveRequirementChunkBudget
} from '../src/pipeline/requirement-chunker.js';
import { SourceLocationResolver } from '../src/pipeline/source-location-resolver.js';

test('chunker assigns deterministic Cxxx-Sxxx span ids and an annotated model text', () => {
  const text = '第一段要求。\n第二段要求。';
  const chunks = chunkExtractedText({
    text,
    paragraphs: [
      { paragraph: 1, page: 1, text: '第一段要求。', source_start_offset: 0, source_end_offset: 6 },
      { paragraph: 2, page: 1, text: '第二段要求。', source_start_offset: 7, source_end_offset: 13 }
    ],
    singleCallThreshold: 1000,
    characterBudget: 100,
    tokenBudget: 100
  });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, text);
  assert.deepEqual(chunks[0].segments.map((segment) => segment.source_ref), ['C001-S001', 'C001-S002']);
  assert.match(chunks[0].model_text, /\[C001-S001\] 第一段要求。/);
  assert.match(chunks[0].model_text, /\[C001-S002\] 第二段要求。/);
});

test('字符预算以内保持单片，超过上限进入段落分片', () => {
  const paragraph = (text, number) => ({ paragraph: number, page: 1, text });
  const exactlyAtLimit = 'a'.repeat(3_000);
  const atLimit = chunkExtractedText({
    text: exactlyAtLimit,
    paragraphs: [paragraph(exactlyAtLimit, 1)],
    singleCallThreshold: 3_000,
    characterBudget: 3_000,
    tokenBudget: 8_000
  });
  assert.equal(atLimit.length, 1);
  assert.equal(atLimit[0].character_count, 3_000);

  const overLimit = ['a'.repeat(2_000), 'b'.repeat(1_500)].join('\n');
  const chunks = chunkExtractedText({
    text: overLimit,
    paragraphs: [paragraph('a'.repeat(2_000), 1), paragraph('b'.repeat(1_500), 2)],
    singleCallThreshold: 3_000,
    characterBudget: 3_000,
    tokenBudget: 8_000
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 3_000));
});

test('4,930 字符 FAST-01 窗口按自然段分片，单片同时受 token 上限约束', () => {
  const paragraphTexts = [
    ...Array.from({ length: 254 }, () => '中'.repeat(18)),
    '中'.repeat(104)
  ];
  const text = paragraphTexts.join('\n');
  const chunks = chunkExtractedText({
    text,
    paragraphs: paragraphTexts.map((value, index) => ({ paragraph: index + 1, page: 1, text: value })),
    singleCallThreshold: 2_000,
    characterBudget: 2_000,
    tokenBudget: 8_000,
    sourceSpanBudget: 50
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 2_000));
  assert.ok(chunks.every((chunk) => chunk.segments.length <= 50));
  assert.deepEqual(chunks.flatMap((chunk) => chunk.segments).map((segment) => segment.text), paragraphTexts);

  const punctuation = '.'.repeat(8_000);
  assert.throws(() => chunkExtractedText({
    text: punctuation,
    paragraphs: [{ paragraph: 1, page: 1, text: punctuation }],
    singleCallThreshold: 2_000,
    characterBudget: 2_000,
    tokenBudget: 7_999,
    sourceSpanBudget: 50
  }), (error) => error.code === 'REQUIREMENT_SOURCE_SPAN_EXCEEDS_BUDGET');
});

test('model Candidate v3 requires backend-derived provenance before Canonical mapping', () => {
  const candidate = {
    text: '系统应记录日志。', category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true, requires_confirmation: false
  };
  assert.equal(mapRequirementCandidateToCanonicalInput(candidate, 1), null);
  const resolved = { ...candidate, source_refs: ['C001-S001'], source_text: '系统应记录日志。' };
  const mapped = mapRequirementCandidateToCanonicalInput(resolved, 1, { allowBackendProvenance: true });
  assert.equal(mapped.content, candidate.text);
  assert.deepEqual(mapped.sources[0].source_refs, resolved.source_refs);
  assert.equal(mapRequirementCandidateToCanonicalInput({ ...resolved, source_text: '伪造原文' }, 1), null);
  assert.equal(mapRequirementCandidateToCanonicalInput({ ...resolved, source_clause: '5.1' }, 1), null);
  assert.equal(mapRequirementCandidateToCanonicalInput({ ...resolved, content: 'legacy' }, 1), null);
  assert.equal(mapRequirementCandidateToCanonicalInput({ ...resolved, source_excerpt: 'legacy' }, 1), null);
});

test('production semantic budget of 2,000 chars and 50 spans splits a dense 4,930-char window without losing spans', () => {
  const paragraphTexts = [
    ...Array.from({ length: 254 }, () => '中'.repeat(18)),
    '中'.repeat(104)
  ];
  const text = paragraphTexts.join('\n');
  assert.equal(text.length, 4_930);
  const paragraphs = paragraphTexts.map((value, index) => ({
    paragraph: index + 1,
    page: 1,
    text: value
  }));
  const budget = resolveRequirementChunkBudget({});
  assert.equal(budget.singleCallThreshold, 2_000);
  assert.equal(budget.characterBudget, 2_000);
  assert.equal(budget.tokenBudget, 8_000);
  assert.equal(budget.sourceSpanBudget, 50);
  const chunks = chunkExtractedText({ text, paragraphs, ...budget });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 2_000));
  assert.ok(chunks.every((chunk) => chunk.segments.length <= 50));
  const segments = chunks.flatMap((chunk) => chunk.segments);
  assert.equal(segments.length, paragraphs.length);
  assert.deepEqual(segments.map((segment) => segment.text), paragraphTexts);
  assert.equal(new Set(segments.map((segment) => segment.source_ref)).size, segments.length);
  assert.deepEqual(chunkExtractedText({ text, paragraphs, ...budget }), chunks);
  const resolver = new SourceLocationResolver();
  for (const chunk of chunks) {
    const resolved = resolver.resolve({ source_range: {
      start_ref: chunk.segments[0].source_ref,
      end_ref: chunk.segments.at(-1).source_ref
    } }, chunk);
    assert.equal(resolved.location.source_verified, true);
  }
});

test('single-call threshold cannot bypass the 2,000-character window budget', () => {
  const paragraphs = [
    { paragraph: 1, page: 1, text: '甲'.repeat(1_800) },
    { paragraph: 2, page: 1, text: '乙'.repeat(1_800) }
  ];
  const text = paragraphs.map((item) => item.text).join('\n');
  const chunks = chunkExtractedText({
    text,
    paragraphs,
    singleCallThreshold: 8_000,
    characterBudget: 2_000,
    tokenBudget: 8_000,
    sourceSpanBudget: 50
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 2_000));
});

test('an indivisible source span larger than the semantic budget fails closed', () => {
  const oversized = '中'.repeat(3_001);
  assert.throws(() => chunkExtractedText({
    text: oversized,
    paragraphs: [{ paragraph: 1, page: 1, text: oversized }],
    singleCallThreshold: 2_000,
    characterBudget: 2_000,
    tokenBudget: 8_000,
    sourceSpanBudget: 50
  }), (error) => error.code === 'REQUIREMENT_SOURCE_SPAN_EXCEEDS_BUDGET');
});

test('default budget enforces character, token, and source-span caps deterministically', () => {
  const paragraphTexts = [
    ...Array.from({ length: 254 }, () => '中'.repeat(18)),
    '中'.repeat(104)
  ];
  const text = paragraphTexts.join('\n');
  const paragraphs = paragraphTexts.map((value, index) => ({ paragraph: index + 1, page: 1, text: value }));
  const budget = resolveRequirementChunkBudget({});
  const chunks = chunkExtractedText({ text, paragraphs, ...budget });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= budget.characterBudget));
  assert.ok(chunks.every((chunk) => chunk.estimated_token_count <= budget.tokenBudget));
  assert.ok(chunks.every((chunk) => chunk.segments.length <= budget.sourceSpanBudget));
});

test('example environments declare the canonical production chunk budget', () => {
  for (const relative of ['../../.env.example', '../.env.example']) {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.match(source, /^REQUIREMENT_SINGLE_CALL_CHAR_THRESHOLD=2000$/m);
    assert.match(source, /^REQUIREMENT_CHUNK_CHAR_BUDGET=2000$/m);
    assert.match(source, /^REQUIREMENT_CHUNK_TOKEN_BUDGET=8000$/m);
    assert.match(source, /^REQUIREMENT_CHUNK_SOURCE_SPAN_BUDGET=50$/m);
  }
});

test('boundary classifier protects colon-led parent enumerations from numbered-child cuts', () => {
  const result = classifyBoundary(
    { text: '系统应支持以下功能：', source_clause_id: '3.1' },
    { text: '1. 用户管理', source_clause_id: '3.1' }
  );
  assert.equal(result.classification, 'UNSAFE');
  assert.equal(result.reason, 'PARENT_ENUMERATION');
});

test('boundary classifier marks independent clauses as strong', () => {
  const result = classifyBoundary(
    { text: '投标人应完成用户管理能力建设。', source_clause_id: '3.1' },
    { text: '投标人应完成日志管理能力建设。', source_clause_id: '3.2' }
  );
  assert.equal(result.classification, 'STRONG');
  assert.equal(result.reason, 'SOURCE_CLAUSE_CHANGE');
});

test('numbered child-like item after a completed paragraph is not treated as a strong boundary', () => {
  const result = classifyBoundary(
    { text: '上一项要求已完成。' },
    { text: '1. 子项说明' }
  );
  assert.equal(result.classification, 'MEDIUM');
  assert.equal(result.reason, 'INDEPENDENT_CLAUSE_AFTER_COMPLETE');
});

test('multi-level numbered clause is recognized as a high-level semantic boundary', () => {
  const result = classifyBoundary(
    { text: '上一项要求已完成。' },
    { text: '3.2 日志管理' }
  );
  assert.equal(result.classification, 'STRONG');
  assert.equal(result.reason, 'INDEPENDENT_CLAUSE');
});

test('boundary classifier does not treat a page break inside one clause as safe', () => {
  const result = classifyBoundary(
    { text: '同一条款的前半句。', source_clause_id: '3.1', page: 4 },
    { text: '同一条款的后半句。', source_clause_id: '3.1', page: 5 }
  );
  assert.equal(result.classification, 'UNSAFE');
  assert.equal(result.reason, 'SAME_SOURCE_CLAUSE');
});

test('multiple safe semantic boundaries below the hard budget stay maximally packed', () => {
  const paragraphs = [
    { paragraph: 1, page: 1, source_clause_id: '3.1', text: '甲'.repeat(40) },
    { paragraph: 2, page: 1, source_clause_id: '3.2', text: '乙'.repeat(30) },
    { paragraph: 3, page: 1, source_clause_id: '3.3', text: '丙'.repeat(10) }
  ];
  const chunks = chunkExtractedText({
    text: paragraphs.map((item) => item.text).join('\n'),
    paragraphs,
    singleCallThreshold: 200,
    characterBudget: 100,
    tokenBudget: 8000,
    sourceSpanBudget: 50
  });
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0].segments.map((segment) => segment.text), paragraphs.map((item) => item.text));
});

test('late safe boundary is selected when the source-span budget applies pressure', () => {
  const paragraphs = Array.from({ length: 51 }, (_, index) => ({
    paragraph: index + 1,
    page: 1,
    source_clause_id: index < 19 ? 'A' : index < 41 ? 'B' : index < 46 ? 'C' : 'D',
    text: `要求${String(index + 1).padStart(2, '0')}`
  }));
  const chunks = chunkExtractedText({
    text: paragraphs.map((item) => item.text).join('\n'),
    paragraphs,
    singleCallThreshold: 1,
    characterBudget: 2000,
    tokenBudget: 8000,
    sourceSpanBudget: 50
  });
  assert.deepEqual(chunks.map((chunk) => chunk.segments.length), [46, 5]);
  assert.equal(chunks[0].segments.at(-1).text, '要求46');
  assert.equal(chunks[1].segments[0].text, '要求47');
  assert.ok(chunks.every((chunk) => chunk.segments.length <= 50));
  assert.deepEqual(chunks.flatMap((chunk) => chunk.segments).map((segment) => segment.text), paragraphs.map((item) => item.text));
});

test('parent and numbered children stay together while an independent clause starts the next chunk', () => {
  const paragraphs = [
    { paragraph: 1, page: 1, source_clause_id: 'A', text: '系统应支持以下功能：' },
    { paragraph: 2, page: 1, source_clause_id: 'A', text: '1. 用户管理' },
    { paragraph: 3, page: 1, source_clause_id: 'A', text: '2. 权限管理' },
    { paragraph: 4, page: 1, source_clause_id: 'B', text: '3.1 日志管理' },
    { paragraph: 5, page: 1, source_clause_id: 'B', text: '日志应支持审计查询。' }
  ];
  const chunks = chunkExtractedText({
    text: paragraphs.map((item) => item.text).join('\n'),
    paragraphs,
    singleCallThreshold: 200,
    characterBudget: 40,
    tokenBudget: 8000,
    sourceSpanBudget: 50
  });
  assert.deepEqual(chunks.map((chunk) => chunk.segments.map((segment) => segment.text)), [
    ['系统应支持以下功能：', '1. 用户管理', '2. 权限管理'],
    ['3.1 日志管理', '日志应支持审计查询。']
  ]);
});

test('page change with a completed statement and independent numbered clause is medium', () => {
  const result = classifyBoundary(
    { text: '上一项要求已完成。', page: 4 },
    { text: '3.2 日志管理', page: 5 }
  );
  assert.equal(result.classification, 'MEDIUM');
  assert.equal(result.reason, 'PAGE_AND_INDEPENDENT_CLAUSE');
});

test('page change after a complete non-numbered paragraph is a medium boundary', () => {
  const result = classifyBoundary(
    { text: '上一项要求已完成。', page: 4 },
    { text: '后续说明继续。', page: 5 }
  );
  assert.equal(result.classification, 'MEDIUM');
  assert.equal(result.reason, 'PAGE_AFTER_COMPLETE');
});

test('a heading followed by dependent body text remains unsafe', () => {
  const result = classifyBoundary(
    { text: '三、服务要求' },
    { text: '投标人应提供驻场服务。' }
  );
  assert.equal(result.classification, 'UNSAFE');
});

test('page counter extraction is not mistaken for an independent clause', () => {
  const result = classifyBoundary(
    { text: '上一项要求已完成。', page: 18 },
    { text: '18 / 56', page: 18 }
  );
  assert.equal(result.classification, 'UNSAFE');
});

test('a semantic group larger than the span cap still cuts atomically at the hard limit', () => {
  const paragraphs = Array.from({ length: 60 }, (_, index) => ({
    paragraph: index + 1,
    page: 1,
    source_clause_id: 'same-clause',
    text: `要求${String(index + 1).padStart(2, '0')}`
  }));
  const text = paragraphs.map((item) => item.text).join('\n');
  const chunks = chunkExtractedText({
    text,
    paragraphs,
    singleCallThreshold: 2_000,
    characterBudget: 2_000,
    tokenBudget: 8_000,
    sourceSpanBudget: 50
  });
  assert.deepEqual(chunks.map((chunk) => chunk.segments.length), [50, 10]);
  assert.deepEqual(chunks.flatMap((chunk) => chunk.segments).map((segment) => segment.text), paragraphs.map((item) => item.text));
});
