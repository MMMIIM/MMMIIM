import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TENDERS,
  TENDER_COUNTS,
  loadInputs,
  buildPacketArtifacts,
  rankCandidates,
  validateReviewRows
} from '../../eval/flywheel/p0-semantic-reconstruction.js';

const FORBIDDEN_KEYS = new Set([
  'semantic_label',
  'semantic_label_author',
  'semantic_label_version',
  'gold_label',
  'gold_decision',
  'failure_family',
  'semantic_root_cause',
  'historical_label',
  'expected_label'
]);

function assertNoForbiddenKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(FORBIDDEN_KEYS.has(key), false, `forbidden semantic key: ${key}`);
    assertNoForbiddenKeys(child);
  }
}

test('P0 reconstruction builds all 487 atoms with tender-local candidates', () => {
  const artifacts = buildPacketArtifacts(loadInputs());
  assert.equal(validateReviewRows(artifacts.rows), true);
  assert.equal(artifacts.rows.length, 487);
  assert.equal(new Set(artifacts.rows.map((row) => row.atom_id)).size, 487);
  for (const tender of TENDERS) {
    const rows = artifacts.rows.filter((row) => row.tender_id === tender);
    assert.equal(rows.length, TENDER_COUNTS[tender], tender);
    for (const row of rows) {
      assert.ok(row.candidate_canonicals.length > 0, `${row.atom_id} has no candidate`);
      for (const candidate of row.candidate_canonicals) assert.equal(candidate.tender_id, tender);
    }
  }
  const noLinkRows = artifacts.rows.filter((row) => row.mechanical_trace.no_mechanical_link_found);
  assert.equal(noLinkRows.length, 15);
  assert.equal(noLinkRows.every((row) => row.candidate_canonicals.every((candidate) => candidate.candidate_origin === 'TENDER_LOCAL_RETRIEVAL')), true);
});

test('candidate ranking is deterministic and honors mechanical precedence', () => {
  const candidates = [
    { requirement_id: 'REQ-SAME', tender_id: 'T', requirement_text: 'unrelated', source_excerpt: 'context', link_method: 'same_page_span_only' },
    { requirement_id: 'REQ-SHARED', tender_id: 'T', requirement_text: 'abcde12345678 tail', link_method: 'shared_8gram' },
    { requirement_id: 'REQ-EXACT', tender_id: 'T', requirement_text: 'prefix target text suffix', link_method: 'normalized_exact_substring' }
  ];
  const first = rankCandidates('target text', candidates, 5).map((candidate) => candidate.requirement_id);
  const second = rankCandidates('target text', [...candidates].reverse(), 5).map((candidate) => candidate.requirement_id);
  assert.deepEqual(first, second);
  assert.equal(first[0], 'REQ-EXACT');
});

test('review packets and index contain no semantic labels or aggregate adjudication fields', () => {
  const artifacts = buildPacketArtifacts(loadInputs());
  assertNoForbiddenKeys(artifacts.reviewIndex);
  for (const { packet } of Object.values(artifacts.packets)) {
    assertNoForbiddenKeys(packet);
    assert.equal(packet.semantic_labels_present, false);
    assert.equal(packet.historical_aggregate_included, false);
    for (const row of packet.rows) {
      assert.equal(Object.hasOwn(row, 'aggregate'), false);
      assert.equal(Object.hasOwn(row, 'semantic_label'), false);
      assert.equal(Object.hasOwn(row, 'expected_label'), false);
    }
  }
  assert.equal(artifacts.aggregateReference.importable_as_ledger, false);
});

test('same frozen inputs produce stable packet hashes', () => {
  const first = buildPacketArtifacts(loadInputs());
  const second = buildPacketArtifacts(loadInputs());
  assert.deepEqual(first.manifest, second.manifest);
  for (const fileName of Object.keys(first.packets)) assert.equal(first.packets[fileName].serialized, second.packets[fileName].serialized, fileName);
});
