import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const DIR = path.join(ROOT, 'docs/eval/flywheel/p0-badcase-repair-v2');
const read = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));

test('P0 V2 replay parity resolves all atoms with explicit authority levels', () => {
  const parity = read('V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2.json');
  assert.equal(parity.source_truth_sha256, '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0');
  assert.equal(parity.case_count, 44);
  assert.equal(parity.resolved_case_count, 44);
  assert.equal(parity.unresolved_case_count, 0);
  assert.equal(parity.replay_input_parity_gate, 'PASS');
  assert.deepEqual(parity.replay_input_authority_levels, { level_2: 22, level_3: 1 });
  assert.equal(parity.provider_calls, 0);
  assert.equal(parity.production_db_writes, 0);
  assert.equal(parity.gold_mutations, 0);
  assert.equal(parity.authoritative_chunk_parity, 'PASS_WITH_LEVEL3_RECONSTRUCTION');
  assert.equal(parity.source_truth_to_replay_input_authority, 'PASS');
});

test('TB-006 abnormal-low-price atom resolves to the full production chunk, not the V1 same-page artifact', () => {
  const parity = read('V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2.json');
  const row = parity.resolutions.find((item) => item.atom_id === 'TB-006-P0-0015');
  assert.ok(row);
  assert.equal(row.resolution_status, 'RESOLVED');
  assert.equal(row.chunks.length, 1);
  assert.equal(row.chunks[0].chunk_number, 9);
  assert.notEqual(row.chunks[0].authoritative_source_chunk_id, '01e0ba3a-1325-4e58-8fe8-04836dcdfcde');
  assert.equal(row.chunks[0].original_chunk_chars, row.chunks[0].replay_chunk_chars);
  assert.equal(row.chunks[0].original_chunk_sha256, row.chunks[0].replay_chunk_sha256);
  assert.equal(row.chunks[0].parity_status, 'PASS');
});

test('representative table and governing-context atoms use production chunk ranges', () => {
  const parity = read('V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2.json');
  const fast04 = parity.resolutions.find((item) => item.atom_id === 'FAST-04-P0-0203');
  assert.equal(fast04.resolution_status, 'RESOLVED');
  assert.equal(fast04.chunks[0].chunk_number, 35);
  assert.equal(fast04.replay_input_authority_level, 2);
  const jyStandards = parity.resolutions.find((item) => item.atom_id === 'JY-001-P0-0023');
  assert.equal(jyStandards.resolution_status, 'RESOLVED');
  assert.equal(jyStandards.resolution_method, 'DETERMINISTIC_NORMATIVE_LIST_STRUCTURE');
  assert.equal(jyStandards.replay_input_authority_level, 2);
  const fast01Page2 = parity.resolutions.find((item) => item.atom_id === 'FAST-01-P0-0011');
  assert.equal(fast01Page2.resolution_status, 'RESOLVED');
  assert.equal(fast01Page2.replay_input_authority_level, 3);
  assert.equal(fast01Page2.chunks[0].parity_status, 'PASS_RECONSTRUCTED_NO_PERSISTED_HASH');
});

test('V2 plan records authority levels and never uses forbidden R3 or excerpt-only replay origins', () => {
  const plan = read('V43_P0_BADCASE_44_REPLAY_PLAN_V2.json');
  assert.equal(plan.replay_input_parity_gate, 'PASS');
  assert.equal(plan.provider_execution.status, 'COMPLETED');
  assert.equal(plan.provider_execution.provider_calls, 23);
  assert.equal(plan.provider_execution.retry_count, 0);
  assert.ok(plan.chunks.every((chunk) => String(chunk.replay_eligibility).startsWith('ELIGIBLE_ONLY_IF_GLOBAL_PARITY_GATE_PASS')));
  assert.ok(plan.chunks.every((chunk) => String(chunk.parity_status).startsWith('PASS')));
  assert.ok(plan.chunks.every((chunk) => [2, 3].includes(chunk.replay_input_authority_level)));
  assert.ok(plan.chunks.some((chunk) => chunk.replay_input_authority_level === 3));
});

test('V2 Provider replay is complete with frozen provider/model identity and no semantic labels created', () => {
  const result = read('V43_P0_BADCASE_44_REPLAY_V2_RESULTS.json');
  assert.equal(result.replay_chunk_count, 23);
  assert.equal(result.provider_calls, 23);
  assert.equal(result.provider_failures, 0);
  assert.equal(result.retry_count, 0);
  assert.ok(result.rows.every((row) => row.status === 'RESPONSE_RECEIVED'));
  assert.ok(result.rows.every((row) => row.provider_http_status === 200 && row.gateway_http_status === 200));
  assert.ok(result.rows.every((row) => row.schema_pass === true));
  assert.deepEqual([...new Set(result.rows.map((row) => row.provider))], ['openai_compatible']);
  assert.deepEqual([...new Set(result.rows.map((row) => row.model))], ['deepseek-ai/DeepSeek-V4-Flash']);
  assert.deepEqual([...new Set(result.rows.map((row) => row.response_model))], ['deepseek-ai/DeepSeek-V4-Flash']);
  assert.deepEqual([...new Set(result.rows.map((row) => row.finish_reason))], ['stop']);
});

test('V2 main checkpoints reflect the completed replay metadata', () => {
  const checkpoint = read('V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.json');
  assert.equal(checkpoint.provider_calls, 23);
  assert.equal(checkpoint.provider_failures, 0);
  assert.equal(checkpoint.retry_count, 0);
  assert.equal(checkpoint.replay_execution_status, 'COMPLETED');
  assert.equal(checkpoint.final_status, 'READY_FOR_GPT_P0_44_ROOT_CAUSE_ADJUDICATION_V2');
  const checkpointMd = fs.readFileSync(path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.md'), 'utf8');
  assert.match(checkpointMd, /Provider calls: 23/);
  assert.match(checkpointMd, /Replay failures: 0/);
  assert.match(checkpointMd, /Mechanical divergence scope: EVAL_HARNESS only/);
});

test('every planned first-divergence record has explicit eval/production scope and stage', () => {
  const divergence = read('V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2.json');
  assert.equal(divergence.rows.length, 44);
  for (const row of divergence.rows) {
    assert.ok(['PRODUCTION', 'EVAL_HARNESS', 'SOURCE'].includes(row.mechanical_first_divergence_scope));
    assert.ok(typeof row.mechanical_first_divergence_stage === 'string');
    assert.ok(['PRODUCTION', 'EVAL_HARNESS', 'SOURCE'].includes(row.mechanical_first_divergence.scope));
    assert.ok(typeof row.mechanical_first_divergence.stage === 'string');
  }
});

test('mechanical divergence remains separate from semantic root cause', () => {
  const divergence = read('V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2.json');
  assert.ok(divergence.rows.every((row) => row.semantic_re_adjudication_required === true));
  assert.ok(divergence.rows.every((row) => row.mechanical_first_divergence.scope === 'EVAL_HARNESS'));
  const packet = read('V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
  assert.equal(packet.rows.length, 44);
  assert.ok(packet.rows.every((row) => row.semantic_root_cause === 'PENDING_GPT'));
  assert.ok(packet.rows.every((row) => row.source_condition?.status === 'REPLAY_INPUT_PARITY_PASS'));
});

test('GPT packet preserves replay input authority for every case', () => {
  const packet = read('V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
  assert.equal(packet.rows.length, 44);
  assert.ok(packet.rows.every((row) => {
    const level = row.source_condition?.replay_input_authority_level;
    const chunks = row.authoritative_replay_input?.chunk_identity;
    return [2, 3].includes(level)
      && Array.isArray(chunks)
      && chunks.length > 0
      && chunks.every((chunk) => chunk.replay_input_authority_level === level);
  }));
});
