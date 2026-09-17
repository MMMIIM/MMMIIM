import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DOCS = new URL('../../docs/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, DOCS), 'utf8');
const readJson = name => JSON.parse(read(name));
const readJsonl = name => read(name).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const forbiddenSemanticKeys = new Set([
  'semantic_decision',
  'failure_type',
  'severity',
  'corrected_semantic_intent',
  'expected_decision',
  'provider_result',
  'old_gold_expected',
  'pass_fail'
]);

test('V2 packet preserves all frozen answer fields and adds source context only', () => {
  const review = readJsonl('V43_REQUIREMENT_OUTPUT_SIDE_REVIEW.jsonl');
  const packet = readJsonl('V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET_V2.jsonl');
  assert.equal(review.length, 239);
  assert.equal(packet.length, 239);
  for (let index = 0; index < review.length; index += 1) {
    const before = review[index];
    const after = packet[index];
    assert.equal(after.canonical_requirement_text, before.requirement_text);
    assert.equal(after.exact_source_excerpt, before.source_excerpt);
    assert.deepEqual(after.mandatory_observed, before.features?.MANDATORY_OBSERVED ?? null);
    assert.deepEqual(after.requires_confirmation, before.features?.REQUIRES_CONFIRMATION ?? null);
    assert.deepEqual(after.risk_flags, before.features?.RISK_FLAGS || []);
    assert.equal(after.gold_label_exposed, false);
    assert.equal(after.producer_label_exposed, false);
    assert.equal(after.label_status, 'PENDING_INDEPENDENT_ADJUDICATION');
    for (const key of forbiddenSemanticKeys) assert.equal(Object.hasOwn(after, key), false, `${after.case_id}:${key}`);
    assert.ok(after.previous_context && after.next_context);
    if (after.risk_flags.includes('TABLE_HEADER_DEPENDENCY')) {
      assert.ok(after.table_header_context);
      assert.ok(after.row_column_semantic_context);
      assert.ok(typeof after.table_header_context.status === 'string');
      assert.ok(Array.isArray(after.row_column_semantic_context.row_segments));
    } else {
      assert.equal(after.table_header_context, null);
      assert.equal(after.row_column_semantic_context, null);
    }
  }
});

test('source-side blind recall remains the frozen hidden-first-pass asset', () => {
  const source = read('V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl');
  const manifest = readJson('V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_SOURCE_PACKET_MANIFEST.json');
  const expected = 'ca1581455882b441ee755d5af32c537c8ba454baf28847e7ef4408dcc7b88dea';
  assert.equal(sha256(source), expected);
  assert.equal(manifest.source_packet_sha256, expected);
  const rows = source.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(rows.length, 72);
  for (const row of rows) {
    assert.equal(row.canonical_visibility, 'HIDDEN_FIRST_PASS');
    assert.deepEqual(row.expected_substantive_requirements, []);
    assert.equal(Object.hasOwn(row, 'canonical_answer'), false);
    assert.equal(Object.hasOwn(row, 'provider_result'), false);
    assert.equal(Object.hasOwn(row, 'pass_fail'), false);
  }
});

test('V2 checkpoint records zero side effects and frozen zero-candidate runtime list', () => {
  const checkpoint = readJson('V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PACKET_V2_CHECKPOINT.json');
  assert.deepEqual(checkpoint.zero_candidate_authoritative_list, ['FIXED48-26', 'FIXED48-28', 'FIXED48-41']);
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.production_db_writes, 0);
  assert.equal(checkpoint.gold_mutations, 0);
  assert.equal(checkpoint.answer_fields_modified, false);
  assert.equal(checkpoint.forbidden_labels_included, false);
});
