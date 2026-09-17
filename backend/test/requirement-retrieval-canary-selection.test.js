import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_REQUIREMENT_SNAPSHOT,
  selectRequirementCanary,
  verifyFrozenSnapshot
} from '../eval/real-e2e/prepare-requirement-retrieval-canary.mjs';

test('frozen TB-006 snapshot resolves to 337 in-scope requirements', () => {
  const bytes = fs.readFileSync(DEFAULT_REQUIREMENT_SNAPSHOT);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  const verified = verifyFrozenSnapshot(snapshot, bytes);
  assert.equal(verified.post_recert_count, 337);
  assert.equal(verified.candidate_count, 341);
  assert.equal(verified.excluded_count, 4);
  assert.equal(new Set(verified.candidates.map(item => item.req_id)).size, 337);
  assert.ok(verified.source_sha256.length === 64);
});

test('requirement canary selection is deterministic, bounded, and evidence dependent', () => {
  const bytes = fs.readFileSync(DEFAULT_REQUIREMENT_SNAPSHOT);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  const verified = verifyFrozenSnapshot(snapshot, bytes);
  const first = selectRequirementCanary(verified.candidates, { limit: 20 });
  const second = selectRequirementCanary(verified.candidates, { limit: 20 });
  assert.equal(first.selected.length, 20);
  assert.deepEqual(
    first.selected.map(item => item.candidate.req_id),
    second.selected.map(item => item.candidate.req_id)
  );
  assert.equal(new Set(first.selected.map(item => item.candidate.req_id)).size, 20);
  for (const item of first.selected) {
    assert.equal(item.route.response_required, true);
    assert.equal(item.route.evidence_dependency, true);
    assert.ok(String(item.candidate.content).trim());
    assert.ok(String(item.candidate.source_hash).trim());
    assert.ok(String(item.candidate.source_chunk_id).trim());
  }
});

test('selection module has no live-call side effect when imported', () => {
  assert.equal(process.env.V43_HOST_EXECUTION, undefined);
  assert.equal(path.basename(DEFAULT_REQUIREMENT_SNAPSHOT), '03_TB006_POST_RECERT_REQUIREMENTS.json');
});
