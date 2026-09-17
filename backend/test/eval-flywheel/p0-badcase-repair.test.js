import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const WORK_DIR = path.join(ROOT, 'docs/eval/flywheel/p0-badcase-repair-v1');
const RUN_DIR = path.join(ROOT, 'docs/eval/flywheel/V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V1');
const SOURCE_SHA = 'sha256:9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';

function read(name, dir = WORK_DIR) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
}

test('P0 unsafe-44 import and diagnosis artifacts preserve frozen identity', () => {
  const checkpoint = read('V43_P0_BADCASE_44_IMPORT_CHECKPOINT.json');
  assert.equal(checkpoint.status, 'IMPORTED');
  assert.equal(checkpoint.dataset_partition, 'TARGETED_BADCASE');
  assert.equal(checkpoint.row_count, 44);
  assert.equal(checkpoint.unique_atom_ids, 44);
  assert.deepEqual(checkpoint.semantic_label_counts, { MISS: 31, PARTIAL: 7, DISTORTED: 6 });
  assert.equal(checkpoint.source_truth_sha256, SOURCE_SHA);
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.llm_calls, 0);
  assert.equal(checkpoint.production_db_writes, 0);
  assert.equal(checkpoint.gold_mutations, 0);

  const registry = read('badcases.json', RUN_DIR);
  const rows = registry.rows || registry;
  assert.equal(rows.length, 44);
  assert.equal(new Set(rows.map(row => row.case_id)).size, 44);
  assert.deepEqual(rows.reduce((acc, row) => {
    acc[row.semantic_label] = (acc[row.semantic_label] || 0) + 1;
    return acc;
  }, {}), { MISS: 31, PARTIAL: 7, DISTORTED: 6 });
});

test('P0 replay plan is deduplicated and remains provider-off', () => {
  const plan = read('V43_P0_BADCASE_44_REPLAY_PLAN.json');
  assert.equal(plan.case_count, 44);
  assert.equal(plan.replay_chunk_count, 39);
  assert.equal(plan.unresolved_case_count, 0);
  assert.equal(plan.deduplication_key, 'tender_id + source_chunk_id');
  assert.equal(plan.provider_execution.status, 'COMPLETED');
  assert.equal(plan.provider_execution.provider_calls, 39);
  assert.equal(plan.provider_execution.llm_calls, 0);
  assert.equal(plan.provider_execution.retry_count, 0);
  assert.equal(new Set(plan.chunks.map(chunk => chunk.replay_key)).size, 39);
  assert.ok(plan.chunks.every(chunk => chunk.replay_eligibility === 'ELIGIBLE_FOR_TARGETED_REPLAY_PLAN_ONLY'));

  const results = read('V43_P0_BADCASE_44_REPLAY_RESULTS.json');
  assert.equal(results.status, 'COMPLETED_TARGETED_ONLY');
  assert.equal(results.replay_chunk_count, 39);
  assert.equal(results.provider_calls, 39);
  assert.equal(results.provider_failures, 0);
  assert.equal(results.rows.length, 39);
  assert.ok(results.rows.every(row => row.status === 'RESPONSE_RECEIVED'));
  assert.ok(results.rows.every(row => row.provider === 'openai_compatible'));
  assert.ok(results.rows.every(row => row.model === 'deepseek-ai/DeepSeek-V4-Flash'));
  assert.ok(results.rows.every(row => row.requested_model === row.model));
  assert.ok(results.rows.every(row => row.response_model === row.model));
  assert.ok(results.rows.every(row => row.schema_pass === true));
  assert.ok(results.rows.every(row => row.retries === 0));
  assert.ok(results.rows.every(row => (row.restricted_evidence_refs || []).every(ref => ref.path && ref.sha256)));
});

test('P0 first divergence records only mechanically observed replay stages', () => {
  const divergence = read('V43_P0_BADCASE_44_FIRST_DIVERGENCE.json');
  assert.equal(divergence.status, 'TARGETED_REPLAY_COMPLETED_MECHANICAL_STAGES_OBSERVED');
  assert.equal(divergence.rows.length, 44);
  assert.ok(divergence.rows.every(row => row.observability_state === 'TRACE_SUFFICIENT_FOR_MECHANICAL_DIAGNOSIS'));
  const allowedStages = new Set(['SOURCE_RESOLUTION', 'CANONICAL_OUTPUT', 'PROVIDER_OUTPUT', 'PROVIDER_INPUT', 'CANONICALIZATION', 'CHUNK_CONSTRUCTION', null]);
  assert.ok(divergence.rows.every(row => ['DETERMINED', 'NOT_OBSERVED'].includes(row.mechanical_first_divergence.status)));
  assert.ok(divergence.rows.every(row => allowedStages.has(row.mechanical_first_divergence.stage)));
  assert.ok(divergence.rows.every(row => row.replay_evidence?.provider_http_status === 200));
  assert.equal(divergence.semantic_root_cause_owner, 'GPT_HUMAN');
});

test('P0 repair and GPT packet do not add semantic conclusions', () => {
  const repair = read('V43_P0_BADCASE_44_REPAIR_LOG.json');
  assert.equal(repair.status, 'NO_REPAIR_ATTEMPTED');
  assert.deepEqual(repair.repairs, []);
  assert.equal(repair.production_code_changes, 0);
  assert.equal(repair.prompt_changes, 0);
  assert.equal(repair.schema_changes, 0);
  assert.equal(repair.gold_mutations, 0);
  assert.equal(repair.provider_calls, 0);

  const packet = read('V43_P0_BADCASE_44_GPT_POST_REPAIR_PACKET.json');
  assert.equal(packet.status, 'READY_FOR_GPT_POST_REPAIR_ADJUDICATION');
  assert.equal(packet.rows.length, 44);
  assert.equal(packet.codex_semantic_conclusions, 0);
  assert.equal(packet.provider_calls, 39);
  assert.ok(packet.rows.every(row => row.gpt_semantic_review_required === true));
});

test('P0 targeted regression artifact records all mechanical safety gates', () => {
  const regression = read('V43_P0_BADCASE_44_TARGETED_REGRESSION.json');
  assert.equal(regression.status, 'PASS_MECHANICAL_IMPORT_AND_IDENTITY');
  assert.equal(regression.checks.exact_44_rows, true);
  assert.equal(regression.checks.unique_atom_ids, true);
  assert.equal(regression.checks.allowed_labels_only, true);
  assert.equal(regression.checks.source_truth_identity, true);
  assert.equal(regression.checks.no_semantic_reinterpretation, true);
  assert.equal(regression.checks.provider_calls, 0);
  assert.equal(regression.checks.llm_calls, 0);
  assert.equal(regression.checks.production_db_writes, 0);
  assert.equal(regression.checks.gold_mutations, 0);
  assert.equal(regression.replay.status, 'COMPLETED_TARGETED_ONLY');
  assert.equal(regression.replay.provider_calls, 39);
  assert.equal(regression.replay.retry_count, 0);
  assert.equal(regression.case_results.length, 44);
  assert.ok(regression.case_results.every(row => row.semantic_re_adjudication_required === true));
  assert.ok(regression.case_results.every(row => row.post_repair_candidate_output.status === 'NOT_APPLICABLE_NO_REPAIR'));
});

test('P0 failure families remain mechanical proposals pending GPT review', () => {
  const families = read('V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS.json');
  assert.equal(families.status, 'PENDING_GPT_FAILURE_FAMILY_SEMANTIC_REVIEW');
  assert.equal(families.replay_execution.status, 'COMPLETED');
  assert.equal(families.replay_execution.provider_calls, 39);
  assert.ok(families.proposals.some(item => item.failure_family_id === 'MECHANICAL_SOURCE_RESOLUTION'));
  assert.ok(families.proposals.some(item => item.failure_family_id === 'MECHANICAL_CANONICAL_OUTPUT'));
  assert.ok(families.proposals.filter(item => item.failure_family_id.startsWith('MECHANICAL_')).every(item => item.semantic_review_required === true));
  assert.ok(families.proposals.filter(item => item.failure_family_id.startsWith('MECHANICAL_')).every(item => item.suspected_root_cause === 'MECHANICAL_STAGE_OBSERVATION_ONLY'));
});
