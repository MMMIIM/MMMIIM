import test from 'node:test';
import assert from 'node:assert/strict';
import { WriterReferenceSelector } from '../src/pipeline/writer-reference-selector.js';

const candidate = (overrides = {}) => ({
  material_id: 'M-1',
  chunk_id: 'C-1',
  chunk_hash: 'H-1',
  material_type: 'technical_solution',
  source_text: '系统支持统一身份认证，并提供可追溯的运维记录。',
  source_role: 'REFERENCE_ONLY',
  corpus_scope: 'GENERAL',
  source_document_id: 'DOC-1',
  source_chunk_id: 'C-1',
  source_text_sha256: 'text-hash',
  lifecycle_status: 'ACTIVE',
  review_status: 'approved',
  usage_status: 'ACTIVE_FULLTEXT',
  source_lineage: { document_id: 'DOC-1', chunk_id: 'C-1' },
  similarity_score: 0.9,
  ...overrides
});

test('Writer Reference final projection excludes headings, front matter and citation-index-only rows', async () => {
  const repository = {
    listWriterReferenceChunks: async () => [
      candidate({ chunk_id: 'heading', chunk_hash: 'H-heading', source_text: '# 技术方案' }),
      candidate({ chunk_id: 'front', chunk_hash: 'H-front', source_text: '目录\n投标邀请' }),
      candidate({ chunk_id: 'citation', chunk_hash: 'H-citation', source_text: '- **OFF-U01｜国务院办公厅｜状态：现行｜最后核验：2024-01｜https://example.com**', similarity_score: 0.99 }),
      candidate({ chunk_id: 'url-only', chunk_hash: 'H-url-only', source_text: 'https://example.com/reference', similarity_score: 0.98 }),
      candidate({ chunk_id: 'metadata-only', chunk_hash: 'H-metadata-only', source_text: '发布日期：2024-01-01', similarity_score: 0.97 }),
      candidate({ chunk_id: 'business', chunk_hash: 'H-business', source_text: '系统支持统一身份认证，并提供可追溯的运维记录。', similarity_score: 0.8 })
    ]
  };
  const selected = await new WriterReferenceSelector({ repository }).select({ projectId: 'P', section: { title: '技术方案' }, topK: 4 });
  assert.deepEqual(selected.map((item) => item.chunk_id), ['business']);
  assert.equal(selected[0].source_role, 'REFERENCE_ONLY');
  assert.deepEqual(selected[0].source_lineage, { document_id: 'DOC-1', chunk_id: 'C-1' });
});

test('Writer Reference final projection allows fewer than four references and accepts an explicit zero limit', async () => {
  const repository = {
    listWriterReferenceChunks: async () => [
      candidate({ chunk_id: 'business-1', chunk_hash: 'H-1', similarity_score: 0.8 }),
      candidate({ chunk_id: 'business-2', chunk_hash: 'H-2', similarity_score: 0.7 })
    ]
  };
  const selector = new WriterReferenceSelector({ repository, topK: 4 });
  const selected = await selector.select({ projectId: 'P', section: { title: '技术方案' }, topK: 4 });
  assert.equal(selected.length, 2);
  assert.deepEqual(await selector.select({ projectId: 'P', section: { title: '技术方案' }, topK: 0 }), []);
});
