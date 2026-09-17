import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

import {
  assertNoProductionSideEffects,
  comparePacketNovelty,
  mutationSensitivity,
  semanticIdentity,
  validateCaseSet,
  validateProductionImportGuard,
  validateSourcePacketRenderParity
} from '../eval/gold-governance/gold-governance-harness-v1.js';

const root = 'backend/eval/requirement-evidence-mapping-v2';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fileHash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const real = readJson(`${root}/real-derived-gold-v1.json`);
const synthetic = readJson(`${root}/synthetic-boundary-gold-v2.json`);
const engineering = readJson(`${root}/engineering-fixtures-v2.json`);
const disputed = readJson(`${root}/disputed-cases-v2.json`);
const corrections = readJson(`${root}/synthetic-corrections-v1.json`);
const manifest = readJson(`${root}/successor-manifest.json`);

test('successor partitions are explicit and semantically scored only where authorized', () => {
  assert.equal(validateCaseSet(real.cases).ok, true);
  assert.equal(validateCaseSet(synthetic.cases).ok, true);
  assert.equal(validateCaseSet(engineering.cases, { semanticRequired: false }).ok, true);
  assert.equal(validateCaseSet(disputed.cases, { semanticRequired: false }).ok, true);
  assert.equal(real.cases.length, 12);
  assert.equal(synthetic.cases.length, 29);
  assert.equal(engineering.cases.length, 6);
  assert.equal(disputed.cases.length, 1);
  assert.equal(engineering.cases.every(item => item.scored === false), true);
  assert.equal(disputed.cases.every(item => item.scored === false), true);
});

test('real-derived Gold selection preserves restored human authority and distribution', () => {
  assert.deepEqual(real.cases.map(item => item.case_id), [
    'REAL-MAP-CAND-002', 'REAL-MAP-CAND-007', 'REAL-MAP-CAND-008',
    'REAL-MAP-CAND-013', 'REAL-MAP-CAND-014', 'REAL-MAP-CAND-015',
    'REAL-MAP-CAND-017', 'REAL-MAP-CAND-018', 'REAL-MAP-CAND-021',
    'REAL-MAP-CAND-023', 'REAL-MAP-SUPP-009', 'REAL-MAP-SUPP-010'
  ]);
  assert.equal(real.cases.every(item => item.human_authority?.source === 'user_provided_human_adjudication'), true);
  const distribution = real.cases.reduce((groups, item) => {
    (groups[item.expected.decision] ||= []).push(item);
    return groups;
  }, {});
  assert.equal(distribution.partial_support.length, 3);
  assert.equal(distribution.related_reference.length, 2);
  assert.equal(distribution.related_insufficient.length, 4);
  assert.equal(distribution.unrelated.length, 3);
  assert.equal(real.cases.find(item => item.case_id === 'REAL-MAP-CAND-013').facts.length, 2);
});

test('synthetic successor applies only the approved expectation deltas', () => {
  assert.equal(corrections.corrections.length, 6);
  const byId = new Map(synthetic.cases.map(item => [item.case_id, item]));
  assert.equal(byId.get('MAP-G002').expected.decision, 'direct_full');
  assert.equal(byId.get('MAP-G004').expected.dimensions.subject, 'unknown');
  assert.equal(byId.get('MAP-G005').expected.decision, 'conflict');
  assert.equal(byId.get('MAP-G005').expected.dimensions.status, 'mismatch');
  assert.equal(byId.get('MAP-G008').expected.decision, 'conflict');
  assert.equal(byId.get('MAP-G008').expected.dimensions.status, 'mismatch');
  assert.equal(byId.get('MAP-G016').expected.decision, 'related_insufficient');
  assert.equal(byId.get('MAP-G017').expected.decision, 'related_insufficient');
  assert.equal(byId.get('MAP-G017').expected.dimensions.quantity, 'unknown');
  assert.equal(byId.get('MAP-G033').expected.decision, 'related_insufficient');
  assert.equal(corrections.production_contract_changed, false);
});

test('engineering and disputed cases remain auditable but outside semantic denominator', () => {
  assert.deepEqual(engineering.cases.map(item => item.case_id), [
    'MAP-G023', 'MAP-G024', 'MAP-G025', 'MAP-G026', 'MAP-G027', 'MAP-G028'
  ]);
  assert.equal(engineering.cases.find(item => item.case_id === 'MAP-G028').expected.all_fact_refs_required, true);
  assert.equal(disputed.cases[0].case_id, 'MAP-G032');
  assert.equal(disputed.cases[0].review_status, 'DISPUTED');
  assert.equal(disputed.cases[0].classification, 'DISPUTED_CASE');
  assert.equal(disputed.cases[0].scored, false);
});

test('successor has no semantic identity collisions and stable file hashes', () => {
  const scored = [...real.cases, ...synthetic.cases];
  assert.equal(new Set(scored.map(semanticIdentity)).size, scored.length);
  for (const [file, metadata] of Object.entries(manifest.datasets)) {
    if (!fs.existsSync(file)) continue;
    assert.equal(fileHash(file), metadata.sha256, file);
  }
  assert.equal(fileHash('backend/eval/requirement-evidence-mapping-v1/gold-cases.json'), '5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707');
  assert.equal(manifest.old_gold.immutable, true);
});

test('source parity, production import, mutation and side-effect gates pass', () => {
  const packet = readJson('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json');
  const markdown = fs.readFileSync('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.md', 'utf8');
  assert.equal(validateSourcePacketRenderParity({ packet, markdown }).ok, true);
  assert.equal(validateProductionImportGuard({ repoRoot: process.cwd() }).ok, true);
  const semantic = synthetic.cases.find(item => item.case_id === 'MAP-G002');
  assert.equal(mutationSensitivity({ item: semantic, prediction: semantic.expected }).ok, true);
  assert.equal(assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0, evidenceWrites: 0, mappingWrites: 0, claimWrites: 0 }).ok, true);
  assert.equal(manifest.side_effects.production_files_changed, 0);
  assert.equal(manifest.side_effects.active_gold_changed, 0);
  assert.equal(manifest.side_effects.provider_calls, 0);
  assert.equal(manifest.side_effects.dify_calls, 0);
  assert.equal(manifest.side_effects.embedding_calls, 0);
  assert.equal(manifest.side_effects.db_writes, 0);
});

test('real supplemental novelty is computed from Requirement plus sorted Fact identity', () => {
  const parent = readJson('backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json');
  const supplemental = readJson('backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json');
  const novelty = comparePacketNovelty({ parentCandidates: parent.candidates, supplementalCandidates: supplemental.candidates });
  assert.equal(novelty.duplicate_pairs.filter(row => row.duplicate_scope === 'parent_packet').length, 7);
  assert.deepEqual(novelty.fact_set_changed_candidates, ['REAL-MAP-SUPP-007']);
  assert.deepEqual(novelty.novel_candidates, ['REAL-MAP-SUPP-009', 'REAL-MAP-SUPP-010']);
  assert.equal(novelty.duplicate_pairs.some(row => row.candidate_id === 'REAL-MAP-SUPP-005' && row.parent_candidate_id === 'REAL-MAP-CAND-013'), true);
});

test('dual evaluation is explicitly not executed without trusted frozen predictions', () => {
  assert.equal(manifest.dual_eval.status, 'NOT_EXECUTED');
  assert.equal(manifest.dual_eval.reason, 'NO_TRUSTED_FROZEN_PREDICTIONS');
});
