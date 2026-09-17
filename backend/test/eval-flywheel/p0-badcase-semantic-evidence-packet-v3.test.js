import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const PACKET_PATH = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2', 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V3.json');

test('V3 semantic evidence packet is mechanically complete and remains GPT-blind', () => {
  assert.equal(fs.existsSync(PACKET_PATH), true);
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  assert.equal(packet.artifact_type, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V3');
  assert.equal(packet.rows.length, 44);
  assert.equal(new Set(packet.rows.map((row) => row.atom_id)).size, 44);
  assert.equal(packet.provider_rerun_calls, 0);
  assert.equal(packet.unique_restricted_snapshots_reused_count, 100);
  assert.equal(packet.historical_runtime_parity, 'PARTIAL');
  assert.deepEqual(
    Object.fromEntries([...new Set(packet.rows.map((row) => row.frozen_semantic_label))]
      .map((label) => [label, packet.rows.filter((row) => row.frozen_semantic_label === label).length])),
    { MISS: 31, PARTIAL: 7, DISTORTED: 6 }
  );
  assert.equal(packet.rows.filter((row) => row.current_provider_output.candidate_count > 0).length, 32);
  assert.equal(packet.rows.filter((row) => row.current_provider_output.candidate_count === 0).length, 12);
  for (const row of packet.rows) {
    assert.equal(row.divergence_boundaries.current_replay_failure_mechanism, 'PENDING_GPT');
    assert.equal(row.divergence_boundaries.semantic_root_cause, 'PENDING_GPT');
    assert.equal(row.restricted_evidence.all_references_verified, true);
    if (row.current_provider_output.candidate_count > 0) {
      assert.equal(row.current_provider_output.candidate_semantic_contents_available, true);
      assert.equal(row.current_provider_output.candidates.length, row.current_provider_output.candidate_count);
      for (const candidate of row.current_provider_output.candidates) {
        assert.ok(candidate.provider_output.text);
        assert.ok(candidate.normalized_output.text);
        assert.ok(candidate.normalization_trace);
        assert.ok(candidate.source_resolution);
        assert.ok(candidate.canonicalization);
      }
    } else {
      assert.ok(row.current_provider_output.candidate_zero_evidence);
      assert.equal(row.current_provider_output.candidates.length, 0);
    }
    const serialized = JSON.stringify(row);
    assert.equal(/response_payload_json|api[_-]?key|authorization|bearer|secret|credential/i.test(serialized), false);
  }
});
