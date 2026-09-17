import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chunkEnterpriseMaterial, ENTERPRISE_MATERIAL_CHUNKER_VERSION } from '../src/pipeline/enterprise-material-chunker.js';
import {
  ACTIVATED_SOURCE_IDS,
  TARGET_EVAL_DATABASE,
  assertEmbeddingContract,
  assertEvalDatabaseTarget,
  loadSourceManifest,
  stableUuid
} from '../eval/rag-governance/reference-eval-ingest-v4.mjs';

test('frozen activation manifests resolve exactly the eleven approved sources', async () => {
  const { entries } = await loadSourceManifest();
  assert.deepEqual(entries.map(item => item.source_id), ACTIVATED_SOURCE_IDS);
  assert.equal(new Set(entries.map(item => item.source_sha256)).size, entries.length);
  assert.ok(entries.every(item => item.source_role === 'REFERENCE_ONLY'));
  assert.ok(entries.every(item => item.non_synthetic && item.provenance_resolvable && item.requirement_blind));
});

test('new material identity is deterministic and source-bound', () => {
  const seed = 'HW-002|736cd73199dd8d89a9897b47dfa5347a3bb952c43491aed84d5aeb4fc94082d6|production-parser';
  assert.equal(stableUuid(seed), stableUuid(seed));
  assert.notEqual(stableUuid(seed), stableUuid(`${seed}|different`));
  assert.match(stableUuid(seed), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('harness uses the production chunk contract without semantic enrichment', () => {
  const materialId = stableUuid('test-material');
  const text = '第一段\n\n第二段，包含技术参数。';
  const chunks = chunkEnterpriseMaterial(materialId, text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].chunker_version, ENTERPRISE_MATERIAL_CHUNKER_VERSION);
  assert.equal(chunks[0].source_text, '第一段');
  assert.equal(chunks[1].source_text, '第二段，包含技术参数。');
});

test('wrong database targets and source/eval collisions fail closed', () => {
  assert.equal(assertEvalDatabaseTarget(`postgresql://localhost/${TARGET_EVAL_DATABASE}`), TARGET_EVAL_DATABASE);
  assert.throws(() => assertEvalDatabaseTarget('postgresql://localhost/bid_platform'), { code: 'BLOCKED_WRONG_EVAL_DATABASE_TARGET' });
  assert.throws(() => assertEvalDatabaseTarget(`postgresql://localhost/${TARGET_EVAL_DATABASE}`, `postgresql://localhost/${TARGET_EVAL_DATABASE}`), { code: 'BLOCKED_PRODUCTION_DB_TARGET_COLLISION' });
});

test('embedding contract rejects placeholders, fallback models and wrong dimensions', () => {
  assert.equal(assertEmbeddingContract({ model: 'Qwen/Qwen3-Embedding-0.6B', version: '1', dimension: 1024 }), true);
  for (const config of [
    { model: 'eval-placeholder', version: '1', dimension: 1 },
    { model: 'text-embedding-3-small', version: '1', dimension: 1536 },
    { model: 'Qwen/Qwen3-Embedding-0.6B', version: '2', dimension: 1024 },
    { model: 'Qwen/Qwen3-Embedding-0.6B', version: '1', dimension: 1536 }
  ]) assert.throws(() => assertEmbeddingContract(config), { code: 'BLOCKED_EMBEDDING_CONTRACT_MISMATCH' });
});

test('harness does not import Fact extraction paths', async () => {
  const source = await readFile(new URL('../eval/rag-governance/reference-eval-ingest-v4.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*(?:evidence-fact|fact-service|fact-extraction)[^'"]*['"]/i);
  assert.doesNotMatch(source, /(?:^|\n)\s*import\s+[^\n]*h3c-real-fact-extraction\.mjs/i);
});
