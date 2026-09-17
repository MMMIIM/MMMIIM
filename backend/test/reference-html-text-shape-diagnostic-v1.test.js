import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runDiagnostic } from '../eval/rag-governance/reference-html-text-shape-diagnostic-v1.mjs';

const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, 'docs/handoff/V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1');
const TARGETS = ['H3C-003', 'H3C-004', 'H3C-010', 'H3C-013'];

test('HTML text-shape diagnostic uses deterministic samples and preserves the retrieval blocker', async () => {
  const checkpoint = await runDiagnostic();
  assert.equal(checkpoint.status, 'BLOCKED_REFERENCE_HTML_TEXT_GRANULARITY_NOT_RETRIEVAL_READY');
  assert.equal(checkpoint.sample_row_count, 95);
  assert.equal(checkpoint.existing_corpus_snapshot.html_planned_chunks, 1819);
  assert.equal(checkpoint.existing_corpus_snapshot.html_fragment_share, 0.960418);
  assert.equal(checkpoint.existing_corpus_snapshot.input_unit_parity.input_unit_parity, 'MECHANICALLY_ESTABLISHED');
  assert.deepEqual(Object.keys(checkpoint.sample_counts_by_source).sort(), TARGETS.slice().sort());
  for (const id of TARGETS) {
    assert.deepEqual(checkpoint.sample_counts_by_source[id], { UNDER_30: 10, FROM_30_TO_99: 10, AT_LEAST_100: id === 'H3C-013' ? 0 : 5 });
  }
  const samples = JSON.parse(await readFile(resolve(OUT, '01_SAMPLED_CHUNKS.json'), 'utf8'));
  assert.equal(samples.rows.length, 95);
  assert.equal(new Set(samples.rows.map(row => `${row.source_id}:${row.chunk_index}`)).size, 95);
  for (const row of samples.rows) {
    assert.ok(TARGETS.includes(row.source_id));
    assert.ok(typeof row.chunk_text === 'string' && row.chunk_text.length > 0);
    assert.ok(['HEADING', 'PARAGRAPH', 'LIST_ITEM', 'TABLE_CELL', 'MECHANICAL_FRAGMENT', 'UNKNOWN'].includes(row.classification));
    assert.ok(Object.hasOwn(row, 'previous_chunk_text'));
    assert.ok(Object.hasOwn(row, 'next_chunk_text'));
    assert.ok(Object.hasOwn(row, 'source_dom_tag'));
    assert.ok(Object.hasOwn(row, 'nearest_structural_parent'));
  }
  const alternative = JSON.parse(await readFile(resolve(OUT, '03_ALTERNATIVE_SOURCE_AUDIT.json'), 'utf8'));
  assert.equal(alternative.total_candidates, 0);
  assert.equal(checkpoint.side_effects.provider_calls, 0);
  assert.equal(checkpoint.side_effects.embedding_calls, 0);
  assert.equal(checkpoint.side_effects.db_writes, 0);
  assert.equal(checkpoint.side_effects.production_db_writes, 0);
});
