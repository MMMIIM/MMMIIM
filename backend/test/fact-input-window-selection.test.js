import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSubstantiveFactChunk,
  selectFactAnchor
} from '../eval/rag-pilot/chengchuan-controlled-fact-extraction.mjs';
import {
  buildEvidenceFactProducerInputWindows,
  windowHasSiblingHeadingBody
} from '../src/pipeline/evidence-fact-producer-input-window.js';

test('Fact Eval anchor selection skips heading-only chunks by default', () => {
  const heading = { chunk_id: 'heading-only', source_text: '# U13 性能与响应' };
  const substantive = {
    chunk_id: 'substantive',
    source_text: '# U13 性能与响应\n系统在标准测试条件下支持每秒 100 次请求，并保留完整测量记录。'
  };

  assert.equal(isSubstantiveFactChunk(heading), false);
  assert.equal(isSubstantiveFactChunk(substantive), true);
  assert.equal(selectFactAnchor([heading, substantive]), substantive);
});

test('Fact Eval anchor selection returns null when no substantive evidence exists', () => {
  const chunks = [
    { chunk_id: 'h1', source_text: '# U01 公司概况' },
    { chunk_id: 'h2', source_text: '## U02 产品能力' }
  ];
  assert.equal(selectFactAnchor(chunks), null);
});

test('Fact Eval substantive selection is deterministic and preserves input chunks', () => {
  const chunks = [
    { chunk_id: 'h', source_text: '# heading' },
    { chunk_id: 'b', source_text: 'A source sentence with enough factual content for extraction.' },
    { chunk_id: 'later', source_text: 'A later substantive source sentence that must not win.' }
  ];
  const before = structuredClone(chunks);
  assert.equal(selectFactAnchor(chunks).chunk_id, 'b');
  assert.deepEqual(chunks, before);
});

test('producer input windows keep each heading body bounded and metadata separate', () => {
  const result = buildEvidenceFactProducerInputWindows({
    documentId: 'COM-07',
    sourceRef: 'eval://COM-07#full-document',
    sourceText: [
      '---\nsource_kind: synthetic_company_evidence\n---',
      '# 性能与容量测试报告',
      '',
      '## 环境',
      '',
      'Synthetic TEST：4 vCPU。',
      '',
      '## 结果',
      '',
      'P95=1.8秒。',
      '',
      '## 官方来源 / 依据',
      '',
      'OFF-U01。'
    ].join('\n'),
    metadata: { source_kind: 'synthetic_company_evidence', claim_permission: false }
  });
  assert.equal(result.document.source_hash.length, 64);
  assert.ok(result.windows.length >= 3);
  assert.equal(result.windows.every(window => window.document_metadata.source_kind === 'synthetic_company_evidence'), true);
  assert.equal(result.windows.some(window => window.heading === '结果' && window.body.includes('OFF-U01')), false);
  assert.equal(result.windows.some(window => window.heading === '官方来源 / 依据' && window.body.includes('P95')), false);
  assert.equal(result.windows.some(window => windowHasSiblingHeadingBody(window, result.windows)), false);
});

test('producer windows are deterministic for adjacent and empty headings', () => {
  const input = '# A\n\n## Empty\n\n## B\n\n事实 B';
  const first = buildEvidenceFactProducerInputWindows({ documentId: 'DOC', sourceText: input, sourceRef: 'eval://DOC' });
  const second = buildEvidenceFactProducerInputWindows({ documentId: 'DOC', sourceText: input, sourceRef: 'eval://DOC' });
  assert.deepEqual(first, second);
  assert.equal(first.windows.some(window => window.heading === 'B' && window.body === '事实 B'), true);
  assert.equal(first.windows.some(window => window.heading === 'Empty'), false);
});
