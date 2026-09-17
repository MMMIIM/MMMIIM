import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PACKET = new URL('../../docs/V43_RAG_RETRIEVAL_CURRENTNESS_24_EXPECTED_SOURCE_PACKET.json', import.meta.url);
const MANIFEST = new URL('../eval/rag-pilot/V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION/00_meta/extension_import_manifest.jsonl', import.meta.url);

test('24-case retrieval currentness packet is requirement-blind and manifest-backed', async () => {
  const packet = JSON.parse(await readFile(PACKET, 'utf8'));
  const manifestIds = new Set((await readFile(MANIFEST, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line).doc_id));
  assert.equal(packet.requirement_blind, true);
  assert.equal(packet.classification, 'EVAL_ONLY_EXPECTED_SOURCE_PACKET');
  assert.equal(packet.cases.length, 24);
  assert.equal(new Set(packet.cases.map(item => item.case_id)).size, 24);
  assert.deepEqual(packet.cases.map(item => item.theme), Array.from({ length: 24 }, (_, index) => `U${String(index + 1).padStart(2, '0')}`));
  const serialized = JSON.stringify(packet);
  assert.doesNotMatch(serialized, /JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01|REQ-[A-Z0-9_-]+/i);
  for (const item of packet.cases) {
    assert.ok(Array.isArray(item.expected_doc_ids) && item.expected_doc_ids.length > 0);
    for (const docId of item.expected_doc_ids) assert.equal(manifestIds.has(docId), true, `${item.case_id}:${docId}`);
  }
});
