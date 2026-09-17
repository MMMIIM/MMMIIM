import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';

function read(name) { return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')); }

test('V6.3 offline source-to-provider-input gate is complete for 43 non-conflict anchors', () => {
  const visibility = read('V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_3.json');
  assert.equal(visibility.source_truth_sha256, SOURCE_TRUTH_SHA);
  assert.equal(visibility.target_case_count, 43);
  const spans = visibility.rows.flatMap((row) => row.minimum_support_spans);
  assert.equal(visibility.rows.length, 43);
  assert.equal(spans.filter((span) => span.status === 'SOURCE_IN_PROVIDER_INPUT').length, spans.length);
  assert.equal(spans.filter((span) => span.cross_chunk_semantic_split).length, 0);
  assert.equal(visibility.provider_calls, 0);
});

test('V6.3 corrected replay plan preserves multi-span cases and no cross-tender chunks', () => {
  const plan = read('V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
  assert.equal(plan.authoritative_source_to_provider_input_visible, 'PASS');
  assert.equal(plan.replay_eligible_case_count, 43);
  assert.equal(plan.unique_production_provider_chunk_count, plan.unique_production_provider_chunks.length);
  assert.deepEqual(plan.multi_span_cases.sort(), [
    'FAST-01-P0-0017', 'FAST-01-P0-0018', 'FAST-01-P0-0019', 'JY-001-P0-0023'
  ]);
  for (const chunk of plan.unique_production_provider_chunks) {
    const tender = chunk.chunk_id.split(':')[0];
    assert.ok(chunk.atom_ids.every((atomId) => atomId.startsWith(`${tender}-`)));
  }
});

test('V6.3 replay packet is case-level, mechanical-only, and excludes the conflict atom', () => {
  const packet = read('V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3.json');
  const result = read('V43_P0_BADCASE_43_REPLAY_RESULTS_V6_3.json');
  assert.equal(packet.replay_eligible_case_count, 43);
  assert.equal(packet.rows.length, 43);
  assert.equal(new Set(packet.rows.map((row) => row.atom_id)).size, 43);
  assert.equal(packet.semantic_root_cause, 'PENDING_GPT');
  assert.equal(result.provider_calls, result.replay_chunk_count);
  assert.equal(result.provider_failures, 0);
  assert.equal(result.retry_count, 0);
  assert.ok(!packet.rows.some((row) => row.atom_id === 'FAST-WATER-01-P0-0072'));
  assert.ok(packet.rows.every((row) => row.mechanical_first_divergence));
  assert.ok(packet.rows.every((row) => row.semantic_root_cause === 'PENDING_GPT'));
});
