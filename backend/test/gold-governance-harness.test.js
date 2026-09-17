import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

import {
  DELTA_CLASSES,
  REAL_GOLD_NOVELTY_GATE,
  SOURCE_PACKET_RENDER_PARITY_GATE,
  assertNoProductionSideEffects,
  buildSupplementalHumanReviewPacket,
  comparePacketNovelty,
  dualEvaluate,
  mutationSensitivity,
  stableSemanticHash,
  aggregateBatch01Authority,
  validateBatch01CaseAuthority,
  validateBatch01AggregateParity,
  validateCaseSet,
  validateClassification,
  validateDatasetIdentity,
  validateBlindPacket,
  validateProductionImportGuard,
  validateReviewStatus,
  validateSemanticCase,
  validateSourcePacketRenderParity,
  validateSupplementalHumanReviewPacket
} from '../eval/gold-governance/gold-governance-harness-v1.js';

function semanticCase(overrides = {}) {
  return {
    case_id: 'MAP-SYN-001',
    review_status: 'ACCEPTED',
    classification: 'SYNTHETIC_BOUNDARY_GOLD',
    requirement: { requirement_id: 'REQ-SYN-001', text: '提供统一认证能力' },
    facts: [{ fact_ref: 'FACT-SYN-001' }],
    expected: {
      decision: 'direct_full',
      dimensions: { subject: 'match', scope: 'match' }
    },
    ...overrides
  };
}

test('dataset identity gate is exact and fail-closed', () => {
  assert.equal(validateDatasetIdentity(
    { dataset_id: 'mapping-v2', dataset_version: '1', path: 'gold.json', sha256: 'abc' },
    { dataset_id: 'mapping-v2', dataset_version: '1', path: 'gold.json', sha256: 'abc' }
  ).ok, true);
  assert.equal(validateDatasetIdentity(
    { dataset_id: 'mapping-v2', dataset_version: '1', path: 'gold.json', sha256: 'drift' },
    { dataset_id: 'mapping-v2', dataset_version: '1', path: 'gold.json', sha256: 'abc' }
  ).code, 'GOLD_DATASET_IDENTITY_INVALID');
});

test('review and classification gates distinguish scored, disputed, and engineering cases', () => {
  assert.equal(validateReviewStatus('ACCEPTED').scored, true);
  assert.equal(validateReviewStatus('DISPUTED').scored, false);
  assert.equal(validateReviewStatus('unknown').code, 'GOLD_REVIEW_STATUS_INVALID');
  assert.equal(validateClassification('ENGINEERING_FIXTURE').scored, false);
  assert.equal(validateClassification('unknown').code, 'GOLD_CLASSIFICATION_INVALID');
  const engineering = validateSemanticCase(semanticCase({ classification: 'ENGINEERING_FIXTURE', expected: undefined }));
  assert.equal(engineering.ok, true);
  assert.equal(engineering.scored, false);
});

test('semantic completeness requires identity, fact refs, and expected dimensions', () => {
  const missing = validateSemanticCase(semanticCase({ expected: undefined }));
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'GOLD_SEMANTIC_EXPECTATION_MISSING');
  assert.deepEqual(missing.missing, ['expected']);
});

test('duplicate ids and conflicting semantic identities fail closed', () => {
  const duplicate = validateCaseSet([semanticCase(), semanticCase({ case_id: 'MAP-SYN-001' })]);
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some(error => error.code === 'GOLD_CASE_ID_DUPLICATE'));
  const conflict = validateCaseSet([
    semanticCase(),
    semanticCase({ case_id: 'MAP-SYN-002', expected: { decision: 'unrelated', dimensions: { subject: 'mismatch' } } })
  ]);
  assert.equal(conflict.ok, false);
  assert.ok(conflict.errors.some(error => error.code === 'GOLD_SEMANTIC_CONSISTENCY_REVIEW_REQUIRED'));
});

test('blind packet gate rejects answer and provider leakage but accepts neutral source fields', () => {
  assert.equal(validateBlindPacket({ case_id: 'REAL-MAP-SUPP-001', source_text: '公开来源原文' }).ok, true);
  assert.equal(validateBlindPacket({ case_id: 'REAL-MAP-SUPP-001', expected_decision: 'direct_full' }).code, 'GOLD_BLIND_PACKET_CONTAMINATED');
  assert.equal(validateBlindPacket({ case_id: 'REAL-MAP-SUPP-001', note: 'provider_result=allow' }).code, 'GOLD_BLIND_PACKET_CONTAMINATED');
});

test('supplemental novelty gate blocks exact parent Requirement plus sorted Fact duplicates', () => {
  const parent = semanticCase({ case_id: 'REAL-MAP-CAND-001' });
  const supplementalDuplicate = semanticCase({ case_id: 'REAL-MAP-SUPP-001' });
  const supplementalNovel = semanticCase({
    case_id: 'REAL-MAP-SUPP-002',
    requirement: { requirement_id: 'REQ-SYN-002', text: '提供数据交换能力' }
  });
  const result = comparePacketNovelty({ parentCandidates: [parent], supplementalCandidates: [supplementalDuplicate, supplementalNovel] });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SUPPLEMENTAL_NOVELTY_REVIEW_REQUIRED');
  assert.equal(result.gate, REAL_GOLD_NOVELTY_GATE);
  assert.equal(result.eligible_new_count, 1);
  assert.equal(result.duplicate_pairs[0].parent_candidate_id, 'REAL-MAP-CAND-001');
  assert.equal(result.duplicate_pairs[0].classification, 'DUPLICATE_PARENT_PAIR');
  assert.deepEqual(result.novel_candidates, ['REAL-MAP-SUPP-002']);
});

test('novelty identity is fact-order independent and distinguishes changed Fact sets', () => {
  const parent = semanticCase({
    case_id: 'REAL-MAP-CAND-010',
    facts: [{ fact_ref: 'FACT-B' }, { fact_ref: 'FACT-A' }]
  });
  const reordered = semanticCase({
    case_id: 'REAL-MAP-SUPP-010',
    facts: [{ fact_ref: 'FACT-A' }, { fact_ref: 'FACT-B' }]
  });
  const changed = semanticCase({
    case_id: 'REAL-MAP-SUPP-011',
    facts: [{ fact_ref: 'FACT-A' }, { fact_ref: 'FACT-C' }]
  });
  const result = comparePacketNovelty({ parentCandidates: [parent], supplementalCandidates: [reordered, changed] });
  assert.equal(result.duplicate_pairs[0].classification, 'DUPLICATE_PARENT_PAIR');
  assert.deepEqual(result.fact_set_changed_candidates, ['REAL-MAP-SUPP-011']);
  assert.equal(result.eligible_new_count, 1);
});

test('frozen real packets are checked without promoting duplicate supplemental candidates', () => {
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const parent = readJson('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json');
  const supplemental = readJson('backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json');
  const batch = readJson('backend/eval/gold-human-review/v2/02_mapping_batch01_human_adjudication.json');
  const packetHash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(packetHash('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json'), '5ca994228f7d4bfedb61aed0c0aac5ef5cf0b284aa573c7732ce4383ecde4acb');
  assert.equal(packetHash('backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json'), 'a3a0c1abb4f98eef4d77fd120f4d4e47639fa1680a1a17139c65077756032bd0');
  assert.equal(validateBlindPacket(supplemental).ok, true);
  const novelty = comparePacketNovelty({ parentCandidates: parent.candidates, supplementalCandidates: supplemental.candidates });
  assert.equal(novelty.code, 'SUPPLEMENTAL_NOVELTY_REVIEW_REQUIRED');
  assert.equal(novelty.duplicate_pairs.length, 7);
  assert.equal(novelty.eligible_new_count, 3);
  assert.deepEqual(novelty.novel_candidates, ['REAL-MAP-SUPP-009', 'REAL-MAP-SUPP-010']);
  assert.deepEqual(novelty.fact_set_changed_candidates, ['REAL-MAP-SUPP-007']);
  for (const id of ['REAL-MAP-SUPP-001', 'REAL-MAP-SUPP-002', 'REAL-MAP-SUPP-003', 'REAL-MAP-SUPP-004', 'REAL-MAP-SUPP-006', 'REAL-MAP-SUPP-008']) {
    assert.ok(novelty.duplicate_pairs.some(row => row.candidate_id === id && row.classification === 'DUPLICATE_PARENT_PAIR'));
  }
  assert.equal(batch.case_level_labels_supplied, true);
  assert.equal(batch.case_level_authority_status, 'COMPLETE');
  assert.equal(batch.case_level_authority_count, 24);
  assert.ok(['NOT_AUTHORIZED', 'NOT_YET_AUTHORIZED'].includes(batch.final_gold_promotion));
});

test('source packet render parity gate preserves every canonical Fact identity', () => {
  const packet = JSON.parse(fs.readFileSync('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json', 'utf8'));
  const markdown = fs.readFileSync('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.md', 'utf8');
  const result = validateSourcePacketRenderParity({ packet, markdown });
  assert.equal(result.ok, true);
  assert.equal(result.gate, SOURCE_PACKET_RENDER_PARITY_GATE);
  assert.equal(result.total_cases, 24);
  assert.equal(result.parity_pass_count, 24);
  assert.equal(result.parity_fail_count, 0);

  const omittedFact = markdown.replace(
    '- fact_id: EFACT-CD2403D4-C896-4762-9DBC-8ECA23B7B1D4\n',
    ''
  );
  const failed = validateSourcePacketRenderParity({ packet, markdown: omittedFact });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'SOURCE_PACKET_RENDER_PARITY_MISMATCH');
  assert.ok(failed.mismatches.some(row => row.candidate_id === 'REAL-MAP-CAND-013'));
});

test('Batch01 case-level authority is fail-closed when only aggregate labels exist', () => {
  const result = validateBatch01CaseAuthority([]);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HUMAN_AUTHORITY_COMPLETENESS_GAP');
  assert.equal(result.actual_count, 0);
});

test('Batch01 human authority preserves all supplied cases and aggregate parity', () => {
  const batch = JSON.parse(fs.readFileSync('backend/eval/gold-human-review/v2/02_mapping_batch01_human_adjudication.json', 'utf8'));
  const records = batch.case_level_adjudications || [];
  const authority = validateBatch01CaseAuthority(records);
  assert.equal(authority.ok, true);
  assert.equal(authority.case_count, 24);
  const expected = {
    classification_counts: {
      ACCEPT_FOR_GOLD_POOL: 14,
      HOLD_REDUNDANT: 5,
      REJECT_UPSTREAM_SCOPE: 3,
      REJECT_LOW_INFORMATION: 2
    },
    accepted_distribution: {
      direct_full: 0,
      partial_support: 3,
      related_reference: 2,
      related_insufficient: 4,
      conflict: 0,
      unrelated: 5,
      unknown: 0
    }
  };
  assert.deepEqual(aggregateBatch01Authority(records), expected);
  assert.equal(validateBatch01AggregateParity(records, expected).ok, true);
  assert.equal(batch.final_gold_promotion, 'NOT_YET_AUTHORIZED');
  assert.equal(new Set(records.map(record => record.candidate_id)).size, 24);
});

test('novel supplemental human-review packet is source-complete and blind', () => {
  const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const parent = readJson('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json');
  const supplemental = readJson('backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json');
  const packet = buildSupplementalHumanReviewPacket({ parentCandidates: parent.candidates, supplementalCandidates: supplemental.candidates });
  const rendered = readJson('backend/eval/gold-human-review/v2/05_mapping_real_supplemental_human_review_packet.json');
  assert.equal(packet.novelty_gate, REAL_GOLD_NOVELTY_GATE);
  assert.equal(packet.candidates.length, 3);
  assert.deepEqual(packet.candidates.map(item => item.candidate_id), ['REAL-MAP-SUPP-007', 'REAL-MAP-SUPP-009', 'REAL-MAP-SUPP-010']);
  assert.deepEqual(rendered, packet);
  assert.equal(validateSupplementalHumanReviewPacket(packet).ok, true);
  assert.equal(validateSupplementalHumanReviewPacket(rendered).ok, true);
  assert.equal(validateBlindPacket(packet).ok, true);
  assert.equal(validateBlindPacket(rendered).ok, true);
  assert.equal(Object.hasOwn(packet.candidates[0], 'expected'), false);
  assert.equal(Object.hasOwn(packet.candidates[0], 'provider_result'), false);
});

test('frozen source and active Gold hashes remain unchanged while repair artifacts are evaluated', () => {
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json'), '5ca994228f7d4bfedb61aed0c0aac5ef5cf0b284aa573c7732ce4383ecde4acb');
  assert.equal(hash('backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json'), 'a3a0c1abb4f98eef4d77fd120f4d4e47639fa1680a1a17139c65077756032bd0');
  assert.equal(hash('backend/eval/requirement-evidence-mapping-v1/gold-cases.json'), '5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707');
});

test('production import guard is independent from Gold and has no source violations', () => {
  const result = validateProductionImportGuard({ repoRoot: process.cwd() });
  assert.equal(result.ok, true);
  assert.deepEqual(result.offending_files, []);
});

test('stable semantic hash ignores volatile run metadata and key order', () => {
  const first = semanticCase({ generated_at: '2026-01-01', absolute_path: 'C:\\temp\\one' });
  const second = semanticCase({ absolute_path: 'D:\\other\\two', generated_at: '2027-01-01', expected: { dimensions: { scope: 'match', subject: 'match' }, decision: 'direct_full' } });
  assert.equal(stableSemanticHash(first), stableSemanticHash(second));
});

test('mutation sensitivity catches a changed expected decision without Provider calls', () => {
  const item = semanticCase();
  const prediction = { decision: 'direct_full', dimensions: { subject: 'match', scope: 'match' } };
  const result = mutationSensitivity({ item, prediction });
  assert.equal(result.ok, true);
  assert.equal(assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0 }).ok, true);
});

test('dual evaluation keeps the same predictions and classifies governance deltas', () => {
  const unchanged = semanticCase({ case_id: 'MAP-SYN-UNCHANGED' });
  const changedOld = semanticCase({ case_id: 'MAP-SYN-CHANGED' });
  const changedNew = semanticCase({ case_id: 'MAP-SYN-CHANGED', expected: { decision: 'unrelated', dimensions: { subject: 'mismatch' } } });
  const added = semanticCase({ case_id: 'MAP-SYN-ADDED' });
  const disputed = semanticCase({ case_id: 'MAP-SYN-DISPUTED', review_status: 'DISPUTED' });
  const rows = dualEvaluate({
    predictions: [
      { case_id: unchanged.case_id, prediction: unchanged.expected },
      { case_id: changedOld.case_id, prediction: changedOld.expected },
      { case_id: added.case_id, prediction: added.expected }
    ],
    oldGold: [unchanged, changedOld],
    newGold: [unchanged, changedNew, added, disputed]
  });
  assert.equal(rows.find(row => row.case_id === unchanged.case_id).delta_class, 'UNCHANGED');
  assert.equal(rows.find(row => row.case_id === changedOld.case_id).delta_class, 'GOLD_EXPECTATION_CHANGED');
  assert.equal(rows.find(row => row.case_id === added.case_id).delta_class, 'ADDED_CASE');
  assert.equal(rows.find(row => row.case_id === disputed.case_id).delta_class, 'DISPUTED');
  assert.deepEqual([...new Set(rows.map(row => row.delta_class))].sort(), [...DELTA_CLASSES].filter(item => ['UNCHANGED', 'GOLD_EXPECTATION_CHANGED', 'ADDED_CASE', 'DISPUTED'].includes(item)).sort());
});
