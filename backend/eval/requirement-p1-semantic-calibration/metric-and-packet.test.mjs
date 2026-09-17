import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const packet = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json'), 'utf8'));
const runDir = path.join(ROOT, 'backend/eval/requirement-p1-semantic-calibration/results', packet.run_id);
const metric = JSON.parse(fs.readFileSync(path.join(runDir, 'metric-integrity-checkpoint.json'), 'utf8'));
const cooccurrence = JSON.parse(fs.readFileSync(path.join(runDir, 'cooccurrence-analysis.json'), 'utf8'));
const roles = JSON.parse(fs.readFileSync(path.join(runDir, 'response-role-coverage.json'), 'utf8'));

test('metric integrity is complete and co-occurrence is non-zero where reasons overlap', () => {
  assert.equal(metric.total_canonicals, 1009);
  assert.equal(metric.cooccurrence_recomputed, 'PASS');
  assert.equal(metric.role_total, 1009);
  assert.equal(metric.role_gap, 0);
  assert.equal(metric.role_identity_loss, 0);
  assert.ok(metric.reason_summary.some((row) => row.cooccurrence_requirement_count > 0));
  assert.ok(cooccurrence.top_reason_pairs.length > 0);
  assert.equal(roles.rows.length, 1009);
});

test('calibration packet has fixed stratified composition and no Gold/Provider side effects', () => {
  assert.equal(packet.data_classification, 'DEVELOPMENT_CALIBRATION_ONLY');
  assert.equal(packet.human_gold, false);
  assert.equal(packet.holdout, false);
  assert.equal(packet.production_gold, false);
  assert.equal(packet.calibration_case_count, 48);
  assert.deepEqual(packet.bucket_counts, { NUMBER: 12, MODALITY: 12, ENTITY: 8, SOURCE_FIDELITY: 8, ATOMICITY: 4, ROLE: 4 });
  assert.equal(packet.duplicate_primary_case_count, 0);
  assert.equal(packet.natural_context_complete_count, 48);
  assert.equal(packet.semantic_context_refs_complete_count, 48);
  assert.equal(packet.provider_calls, 0);
  assert.equal(packet.production_db_writes, 0);
  assert.equal(packet.gold_mutations, 0);
  assert.equal(packet.cases.filter((row) => row.adjudication_status === 'PENDING_GPT_SEMANTIC_ADJUDICATION').length, 48);
  assert.equal(packet.cases.some((row) => 'expected_decision' in row || 'provider_result' in row || 'semantic_decision' in row), false);
});
