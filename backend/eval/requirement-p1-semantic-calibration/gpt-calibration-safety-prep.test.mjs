import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const packet = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json'), 'utf8'));
const original = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json'), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROLS.json'), 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_GPT_CALIBRATION_SAFETY_CONTROL_PREP_CHECKPOINT.json'), 'utf8'));

const targets = new Set([
  'FAST-04:REQ-026',
  'FAST-01:REQ-026',
  'FAST-01:REQ-018',
  'FAST-01:REQ-021',
  'FAST-01:REQ-022',
  'FAST-01:REQ-023'
]);

test('recovered calibration packet separates structural completeness from semantic context sufficiency', () => {
  assert.equal(packet.calibration_case_count, 48);
  assert.equal(packet.packet_structurally_complete_count, 48);
  assert.equal(packet.semantic_context_sufficient_count, 39);
  assert.equal(packet.natural_context_complete_count, 39);
  assert.equal(packet.context_recovery_case_count, 6);
  assert.equal(packet.provider_calls, 0);
  assert.equal(packet.production_db_writes, 0);
  assert.equal(packet.gold_mutations, 0);
});

test('targeted context recovery is deterministic and does not alter requirement answer fields', () => {
  const originalById = new Map(original.cases.map(row => [row.req_id, row]));
  for (const row of packet.cases) {
    const before = originalById.get(row.req_id);
    assert.ok(before);
    for (const field of ['candidate_text', 'canonical_text', 'quality_gate_reason_codes', 'current_audit_classification', 'source_refs', 'source_text']) {
      assert.deepEqual(row[field], before[field], `${row.req_id}:${field}`);
    }
    assert.equal(row.packet_structural_completeness.structurally_complete, true);
    if (targets.has(row.req_id)) assert.notEqual(row.context_recovery.derivation, 'NOT_TARGETED_BY_THIS_PREP');
  }
  for (const id of ['FAST-01:REQ-021', 'FAST-01:REQ-022', 'FAST-01:REQ-023']) {
    const row = packet.cases.find(item => item.req_id === id);
    assert.equal(row.packet_structural_completeness.table_context_sufficient, false);
    assert.equal(row.packet_structural_completeness.semantic_context_sufficient, false);
  }
  assert.deepEqual(packet.source_ref_empty_case_ids, [
    'JY-001:REQ-069',
    'JY-001:REQ-021',
    'JY-001:REQ-023',
    'JY-001:REQ-139',
    'JY-001:REQ-073',
    'JY-001:REQ-072'
  ]);
  assert.equal(packet.provenance_gap_found, true);
});

test('safety positive controls are deterministic, excluded from Gold/Holdout, and grouped 3x4', () => {
  assert.equal(controls.control_count, 12);
  assert.deepEqual(controls.group_counts, {
    NUMBER: 3,
    MODALITY_NEGATION: 3,
    ENTITY_SCOPE: 3,
    SOURCE_FIDELITY_STATUS_QUANTITY: 3
  });
  assert.equal(controls.controls.every(row => row.eval_role === 'SAFETY_POSITIVE_CONTROL_NOT_GOLD_NOT_HOLDOUT'), true);
  assert.equal(controls.controls.every(row => row.expected_decision === 'FAIL_CLOSED'), true);
  assert.equal(checkpoint.safety_controls_all_currently_detected, false);
  assert.equal(checkpoint.safety_control_detection_count, 0);
});

test('preparation checkpoint is fail-closed on authority provenance and side-effect free', () => {
  assert.equal(checkpoint.status, 'PROVENANCE_GAP_FOUND_STOP');
  assert.equal(checkpoint.provenance_gap_found, true);
  assert.equal(checkpoint.source_ref_empty_case_count_before, 6);
  assert.equal(checkpoint.source_ref_empty_case_count_after, 6);
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.production_db_writes, 0);
  assert.equal(checkpoint.gold_mutations, 0);
  assert.equal(checkpoint.production_code_changes, 0);
});
