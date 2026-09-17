import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequirementReconstructionFoundation,
  renderBlindReconstructionPacket,
  RECONSTRUCTION_TENDER_IDS
} from '../eval/gold-governance/requirement-source-reconstruction.js';

test('reconstruction foundation preserves the three B tenders without upgrading authority', () => {
  const result = buildRequirementReconstructionFoundation({ write: false });
  assert.deepEqual(result.tender_ids, RECONSTRUCTION_TENDER_IDS);
  assert.equal(result.provider_calls, 0);
  assert.equal(result.db_writes, 0);
  assert.equal(result.gold_mutations, 0);
  assert.deepEqual(result.source_classifications, {
    'JY-001': 'B_HUMAN_RECONSTRUCTION_POSSIBLE',
    'TB-003': 'C_REEXTRACTION_REQUIRED',
    'FAST-04': 'C_REEXTRACTION_REQUIRED'
  });
  assert.equal(result.tenders.find(row => row.tender_id === 'JY-001').candidate_requirements.length, 193);
  assert.equal(result.tenders.find(row => row.tender_id === 'JY-001').blocked_historical_rows.length, 28);
  assert.equal(result.tenders.find(row => row.tender_id === 'TB-003').candidate_requirements.length, 0);
  assert.equal(result.tenders.find(row => row.tender_id === 'FAST-04').candidate_requirements.length, 0);
  assert.equal(result.gates.SIX_TENDER_SOURCE_PARITY, 'BLOCKED_HUMAN_AUTHORITY_PENDING');
  assert.equal(result.gates.SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION, 'YES');
});

test('JY reconstruction rows carry source identity, coordinates and non-authoritative provenance', () => {
  const result = buildRequirementReconstructionFoundation({ write: false });
  const jy = result.tenders.find(row => row.tender_id === 'JY-001');
  const row = jy.candidate_requirements[0];
  assert.equal(row.requirement.requirement_id, null);
  assert.match(row.requirement.historical_requirement_id, /^REQ-/);
  assert.ok(row.requirement.text);
  assert.ok(row.source.source_file_sha256);
  assert.ok(row.source.source_span.page_start >= 1);
  assert.ok(row.source.source_span.paragraph_start >= 0);
  assert.ok(row.source.source_span_hash);
  assert.equal(row.source.exact_source_text, null);
  assert.equal(row.source.source_text_capture_status, 'NOT_CAPTURED_IN_HISTORICAL_ARTIFACT');
  assert.equal(row.historical_provenance.authority_status, 'NON_AUTHORITATIVE_RECONSTRUCTION_EVIDENCE');
  assert.equal(row.proposed_reconstruction.formal_requirement_id, null);
  assert.equal(row.proposed_reconstruction.authority_decision, 'PENDING_HUMAN_AUTHORITY');
});

test('raw-only tenders remain blocked and do not receive fabricated requirements', () => {
  const result = buildRequirementReconstructionFoundation({ write: false });
  for (const tenderId of ['TB-003', 'FAST-04']) {
    const tender = result.tenders.find(row => row.tender_id === tenderId);
    assert.ok(tender.source_identity.source_file_sha256);
    assert.equal(tender.source_identity.source_hash_match, true);
    assert.equal(tender.candidate_requirements.length, 0);
    assert.equal(tender.proposed_reconstruction ?? null, null);
    assert.equal(tender.reconstruction_blocker, 'NO_HISTORICAL_PACKET_OR_SOURCE_INDEX');
    assert.equal(tender.reextraction_authorization, 'NOT_AUTHORIZED');
  }
});

test('blind rendering contains no historical expected/provider labels', () => {
  const result = buildRequirementReconstructionFoundation({ write: false });
  const rendered = renderBlindReconstructionPacket(result).toLowerCase();
  for (const forbidden of ['expected_pass', 'expected_fail', 'expected_decision', 'provider_result', 'production_result', 'gold_label', 'semantic_label']) {
    assert.equal(rendered.includes(forbidden), false, `blind packet leaked ${forbidden}`);
  }
  assert.match(rendered, /human_authority: required/);
  assert.match(rendered, /source_text_capture_status/);
});

test('blind reconstruction packet is deterministic for unchanged inputs', () => {
  const a = buildRequirementReconstructionFoundation({ write: false, now: '2026-09-04T00:00:00.000Z' });
  const b = buildRequirementReconstructionFoundation({ write: false, now: '2026-09-04T00:00:00.000Z' });
  assert.deepEqual(a.tenders, b.tenders);
  assert.deepEqual(a.source_classifications, b.source_classifications);
});
