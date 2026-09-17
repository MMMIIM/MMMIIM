import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadFrozenChengchuanEvidenceSources,
  buildDirectFactSourceRows
} from '../eval/real-e2e/chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

test('frozen Chengchuan evidence rows are selected independently of retrieval', async () => {
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  assert.equal(sources.length, 9);
  assert.deepEqual(sources.map(item => item.doc_id), [
    'COM-02', 'COM-03', 'COM-04', 'COM-06', 'COM-07',
    'COM-08', 'COM-13', 'COM-14', 'COM-15'
  ]);
  assert.ok(sources.every(item => item.source_role === 'EVIDENCE_CANDIDATE'));
  assert.ok(sources.every(item => item.enterprise_id === 'SYNTH-CHENGCHUAN-001'));
  assert.ok(sources.every(item => item.anchor?.source_text && item.anchor?.chunk_id));

  const { queries, factSourceRows } = buildDirectFactSourceRows(sources);
  assert.equal(queries.length, 9);
  assert.equal(factSourceRows.size, 9);
  assert.ok(queries.every(query => query.reference_retrieval_dependency === false));
  assert.ok(queries.every(query => factSourceRows.get(query.requirement_id)?.length === 1));
  assert.equal(queries.some(query => query.requirement_text), false);
});

test('frozen loader fails closed when a reference-only material is requested', async () => {
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  assert.equal(sources.some(item => ['COM-01', 'COM-05', 'COM-09', 'COM-10', 'COM-11', 'COM-12', 'COM-16'].includes(item.doc_id)), false);
});
