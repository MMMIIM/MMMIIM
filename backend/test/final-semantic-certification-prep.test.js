import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INPUTS,
  OUTPUTS,
  buildArtifacts
} from '../eval/requirement-production-quality-gate/build-final-semantic-certification-packet.mjs';

const forbiddenLabelFields = new Set([
  'semantic_decision',
  'failure_type',
  'severity',
  'corrected_semantic_intent',
  'atomicity_assessment',
  'mapping_usability',
  'expected_decision',
  'producer_decision',
  'provider_result'
]);

test('final semantic certification prep preserves complete output packet without labels', () => {
  const { outputPacket, sourceManifest, checkpoint } = buildArtifacts({
    generatedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(outputPacket.rows.length, 239);
  assert.equal(sourceManifest.case_count, 72);
  assert.equal(checkpoint.output_side.packet_case_count, 239);
  assert.equal(checkpoint.source_side.case_count, 72);
  assert.equal(checkpoint.output_side.quality_gate_decision_persisted_count, 0);
  assert.equal(checkpoint.side_effects_this_task.provider_calls, 0);
  assert.equal(checkpoint.side_effects_this_task.production_db_writes, 0);
  assert.equal(checkpoint.side_effects_this_task.gold_mutations, 0);
  for (const [index, row] of outputPacket.rows.entries()) {
    assert.equal(row.case_id, `OUTPUT-SIDE-${String(index + 1).padStart(3, '0')}`);
    for (const field of forbiddenLabelFields) assert.equal(field in row, false, `${field} leaked at ${row.case_id}`);
    assert.equal(row.label_status, 'PENDING_INDEPENDENT_ADJUDICATION');
    assert.equal(row.gold_label_exposed, false);
    assert.equal(row.producer_label_exposed, false);
    assert.equal(typeof row.canonical_requirement_text, 'string');
    assert.equal(typeof row.exact_source_excerpt, 'string');
    assert.equal(typeof row.source_hash, 'string');
    assert.ok(row.source_span && typeof row.source_span === 'object');
  }
});

test('frozen source-side packet remains blind and source assets are not rewritten', () => {
  const sourceRows = fs.readFileSync(INPUTS.sourceBlind, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(sourceRows.length, 72);
  assert.ok(sourceRows.every(row => row.canonical_visibility === 'HIDDEN_FIRST_PASS'));
  assert.ok(sourceRows.every(row => Array.isArray(row.expected_substantive_requirements) && row.expected_substantive_requirements.length === 0));
  assert.equal(fs.existsSync(OUTPUTS.outputPacket), true);
  assert.equal(fs.existsSync(OUTPUTS.sourceManifest), true);
});
