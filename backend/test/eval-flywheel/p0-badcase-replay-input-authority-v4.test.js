import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const REPORT_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json');
const CHECKPOINT_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT.json');
const ALLOWED = new Set([
  'VALID_PROVIDER_INPUT',
  'EVAL_REPLAY_JOIN_MISALIGNMENT',
  'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS',
  'MULTI_CHUNK_BOUNDARY_LOSS',
  'LEVEL3_RECONSTRUCTION',
  'UNRESOLVED'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectKeys(value, keys = []) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectKeys(child, keys);
  }
  return keys;
}

test('V4 replay-input authority report is mechanically complete and fail-closed', () => {
  assert.ok(fs.existsSync(REPORT_PATH));
  assert.ok(fs.existsSync(CHECKPOINT_PATH));
  const report = readJson(REPORT_PATH);
  const checkpoint = readJson(CHECKPOINT_PATH);
  assert.equal(report.artifact_type, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4');
  assert.equal(report.rows.length, 44);
  assert.equal(new Set(report.rows.map((row) => row.atom_id)).size, 44);
  assert.equal(report.provider_calls, 0);
  assert.equal(report.production_db_writes, 0);
  assert.equal(report.gold_mutations, 0);
  assert.equal(report.semantic_adjudication_performed, false);
  for (const row of report.rows) {
    assert.ok(ALLOWED.has(row.authority_status));
    assert.ok(Array.isArray(row.production_parse_chunk_ids));
    assert.ok(Array.isArray(row.replay_selected_parse_chunk_ids));
    assert.equal(typeof row.source_truth.source_excerpt, 'string');
    assert.ok(row.source_truth.source_excerpt.length > 0);
    for (const chunk of row.chunks) {
      assert.ok('persisted_chunk_text_char_count' in chunk);
      assert.ok('persisted_chunk_text_sha256' in chunk);
      assert.ok('provider_task_payload_chunk_text_char_count' in chunk);
      assert.ok('provider_task_payload_chunk_text_sha256' in chunk);
      assert.ok('source_excerpt_present_in_parse_chunk' in chunk);
      assert.ok('source_excerpt_present_in_provider_input' in chunk);
      assert.ok('normalized_lexical_containment_evidence' in chunk);
    }
  }
  const multi = report.rows.find((row) => row.atom_id === 'JY-001-P0-0089');
  assert.deepEqual(multi.production_parse_chunk_ids, [
    '6119e013-d56c-4b41-a40a-a529a79b1050',
    '146d0a57-ee10-41f6-ba37-dbc3889948df'
  ]);
  assert.equal(multi.authority_status, 'MULTI_CHUNK_BOUNDARY_LOSS');
  assert.equal(checkpoint.case_count, 44);
  assert.equal(checkpoint.target_source_evidence_in_provider_input, 'FAIL');
  assert.equal(checkpoint.authority_status_counts.VALID_PROVIDER_INPUT, 0);
  assert.equal(checkpoint.authority_status_counts.EVAL_REPLAY_JOIN_MISALIGNMENT, 2);
  assert.equal(checkpoint.authority_status_counts.PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS, 37);
  assert.equal(checkpoint.authority_status_counts.MULTI_CHUNK_BOUNDARY_LOSS, 1);
  assert.equal(checkpoint.authority_status_counts.LEVEL3_RECONSTRUCTION, 4);
  assert.equal(checkpoint.authority_status_counts.UNRESOLVED, 0);
  assert.equal(checkpoint.production_parse_to_provider_input_coverage_loss_confirmed, true);
  assert.equal(checkpoint.production_parse_coverage_loss_case_ids.length, 31);
  assert.equal(checkpoint.final_status, 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS_CONFIRMED');
  const keys = collectKeys(report);
  assert.equal(keys.includes('response_payload_json'), false);
  assert.equal(keys.includes('authorization'), false);
  assert.equal(keys.includes('api_key'), false);
});
