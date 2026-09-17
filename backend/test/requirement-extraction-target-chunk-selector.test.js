import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectCurrentProviderChunksForGold } from '../eval/requirement-extraction-real-tender-pilot-v1/target-chunk-selector.js';
import { buildAnnotatedPath } from '../eval/requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { loadBackendEnvironment } from '../src/backend-runtime.js';

const repoRoot = resolve(import.meta.dirname, '../..');
const evalRoot = resolve(repoRoot, 'backend/eval/requirement-extraction-real-tender-pilot-v1');

async function packet() {
  return JSON.parse(await readFile(resolve(evalRoot, 'semantic-boundary-v1.1', 'packets/TB-006.json'), 'utf8'));
}

test('targeted selector projects historical Gold refs onto current provider chunks', async () => {
  const sourcePacket = await packet();
  const prepared = await buildAnnotatedPath(sourcePacket, loadBackendEnvironment());
  const selected = selectCurrentProviderChunksForGold({
    packet: sourcePacket,
    prepared,
    goldIds: [
      'TB-006-G001', 'TB-006-G007', 'TB-006-G008', 'TB-006-G010',
      'TB-006-G011', 'TB-006-G012', 'TB-006-G013'
    ]
  });

  assert.equal(selected.targets.length, 7);
  assert.equal(selected.selected_chunks.length <= 2, true);
  assert.equal(new Set(selected.selected_chunks.map((chunk) => chunk.chunk_number)).size,
    selected.selected_chunks.length);
  assert.ok(selected.targets.every((target) => target.current_source_refs.length > 0));
  assert.ok(selected.targets.every((target) => target.current_chunk_numbers.length > 0));
  assert.deepEqual(selected.selected_chunks.map((chunk) => chunk.chunk_number), [1]);

  const target = new Map(selected.targets.map((item) => [item.gold_id, item]));
  assert.deepEqual(target.get('TB-006-G001').current_chunk_numbers, [1]);
  assert.deepEqual(target.get('TB-006-G012').current_chunk_numbers, [1]);
  assert.deepEqual(target.get('TB-006-G013').current_chunk_numbers, [1]);

  const currentChunk1 = prepared.chunks.find((chunk) => chunk.chunk_number === 1);
  assert.equal(selected.selected_chunks.find((chunk) => chunk.chunk_number === 1).provider_input_text,
    currentChunk1.model_text,
    'targeted provider input must use the enriched production model_text');
});

test('targeted selector rejects an unprojectable Gold range', () => {
  assert.throws(() => selectCurrentProviderChunksForGold({
    packet: {
      tender_id: 'T',
      windows: [{ spans: [{ span_id: 'OLD-S001', text: 'x', paragraph: 1 }] }],
      gold_requirements: [{ gold_id: 'T-G001', source_range: { start_ref: 'OLD-S001', end_ref: 'OLD-S001' } }]
    },
    prepared: { chunks: [{ chunk_number: 1, segments: [{ source_ref: 'NEW-S001', text: 'y', paragraph: 1 }] }], selected_paragraphs: [] },
    goldIds: ['T-G001']
  }), (error) => error.code === 'TARGET_GOLD_SOURCE_UNRESOLVED');
});

test('targeted selector falls back to raw text only when model_text is absent or empty', () => {
  const packet = {
    windows: [{ spans: [{ source_ref: 'OLD-S001', text: 'raw', paragraph: 1,
      source_start_offset: 0, source_end_offset: 2 }] }],
    gold_requirements: [{ gold_id: 'T-G001', source_range: {
      start_ref: 'OLD-S001', end_ref: 'OLD-S001'
    } }]
  };
  const segment = { source_ref: 'NEW-S001', text: 'raw', paragraph: 1,
    source_start_offset: 0, source_end_offset: 2, routing_role: 'REQUIREMENT_ELIGIBLE' };
  const prepared = {
    selected_paragraphs: [segment],
    chunks: [{ chunk_number: 1, text: 'raw', model_text: 'enriched', segments: [segment] }]
  };

  const selected = selectCurrentProviderChunksForGold({ packet, prepared, goldIds: ['T-G001'] });
  assert.equal(selected.selected_chunks[0].provider_input_text, 'enriched');

  const fallback = selectCurrentProviderChunksForGold({
    packet,
    prepared: { ...prepared, chunks: [{ ...prepared.chunks[0], model_text: '' }] },
    goldIds: ['T-G001']
  });
  assert.equal(fallback.selected_chunks[0].provider_input_text, 'raw');
});
