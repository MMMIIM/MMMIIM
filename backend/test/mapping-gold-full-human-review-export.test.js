import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  assertNoProductionSideEffects,
  stableSemanticSerialize,
  validateBlindPacket,
  validateProductionImportGuard
} from '../eval/gold-governance/gold-governance-harness-v1.js';
import {
  buildMappingGoldFullHumanReviewExport,
  HUMAN_REVIEW_EXPORT_PARITY_GATE,
  realPairIdentity,
  realSourceIdentity,
  syntheticSourceIdentity
} from '../eval/gold-governance/build-mapping-gold-full-human-review-export.js';

const backendRoot = fs.existsSync('backend/eval') ? 'backend' : '.';
const repoPath = relative => path.join(backendRoot, relative);
const readJson = relative => JSON.parse(fs.readFileSync(repoPath(relative), 'utf8'));
const sha256File = relative => crypto.createHash('sha256').update(fs.readFileSync(repoPath(relative))).digest('hex');
const parent = readJson('eval/gold-human-review/v2/01_mapping_real_source_packet.json');
const supplemental = readJson('eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json');
const realBlind = readJson('eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.json');
const synthetic = readJson('eval/requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json');
const syntheticBlind = readJson('eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.json');
const engineering = readJson('eval/requirement-evidence-mapping-v2/engineering-fixtures-v2.json');
const disputed = readJson('eval/requirement-evidence-mapping-v2/disputed-cases-v2.json');
const checkpoint = readJson('eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.json');

function scanForbidden(value, pathName = '$', findings = []) {
  const forbiddenKeys = new Set(['expected_decision', 'expected_dimensions', 'current_human_decision', 'production_mapping_result', 'provider_prediction', 'pass_fail', 'suggested_answer', 'historical_accuracy']);
  if (Array.isArray(value)) { value.forEach((child, index) => scanForbidden(child, `${pathName}[${index}]`, findings)); return findings; }
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) findings.push(`${pathName}.${key}`);
    scanForbidden(child, `${pathName}.${key}`, findings);
  }
  return findings;
}

test('real review export includes all parent plus unique supplemental review cases', () => {
  assert.equal(realBlind.parent_case_count, 24);
  assert.equal(realBlind.supplemental_unique_review_count, 3);
  assert.equal(realBlind.source_candidate_count, 27);
  assert.equal(realBlind.duplicate_excluded_count, 7);
  assert.deepEqual(realBlind.candidates.slice(0, 24).map(item => item.source_origin), Array(24).fill('PARENT_PACKET'));
  assert.equal(realBlind.candidates.filter(item => item.source_origin === 'SUPPLEMENTAL_UNIQUE_REVIEW').length, 3);
  assert.equal(realBlind.candidates.filter(item => item.source_origin === 'SUPPLEMENTAL_UNIQUE_REVIEW').map(item => item.candidate_id).sort().join(','), 'REAL-MAP-SUPP-007,REAL-MAP-SUPP-009,REAL-MAP-SUPP-010');
  assert.equal(new Set(realBlind.duplicate_relationships.map(item => item.candidate_id)).size, 7);
  assert.ok(realBlind.candidates.every(item => Object.hasOwn(item.requirement, 'source_hash')));
  assert.ok(realBlind.candidates.every(item => item.facts.every(fact => Object.hasOwn(fact, 'source_quality_review'))));
});

test('real blind source packet preserves full canonical identity and remains blind', () => {
  const parentById = new Map(parent.candidates.map(item => [item.candidate_id, item]));
  const supplementalById = new Map(supplemental.candidates.map(item => [item.candidate_id, item]));
  const source = realBlind.candidates.map(item => (parentById.get(item.candidate_id) || supplementalById.get(item.candidate_id)));
  const expected = source.map(realSourceIdentity).sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const actual = realBlind.candidates.map(item => item.source_identity).sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  assert.equal(stableSemanticSerialize(expected), stableSemanticSerialize(actual));
  assert.equal(validateBlindPacket(realBlind).ok, true);
  assert.deepEqual(scanForbidden(realBlind), []);
  assert.equal((fs.readFileSync(repoPath('eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.md'), 'utf8').match(/^### REAL-MAP-/gm) || []).length, 27);
});

test('synthetic semantic packet derives 29 cases and excludes engineering/disputed partitions', () => {
  const semanticCases = synthetic.cases.filter(item => item.classification === 'SYNTHETIC_BOUNDARY_GOLD' && item.scored === true);
  assert.equal(semanticCases.length, 29);
  assert.equal(syntheticBlind.source_case_count, semanticCases.length);
  assert.equal(syntheticBlind.candidates.length, semanticCases.length);
  assert.ok(syntheticBlind.candidates.every(item => !Object.hasOwn(item, 'expected')));
  assert.deepEqual(scanForbidden(syntheticBlind), []);
  assert.equal(validateBlindPacket(syntheticBlind).ok, true);
  const expected = semanticCases.map(item => syntheticSourceIdentity({ ...item, fixture_input: Object.fromEntries(Object.entries(item).filter(([key]) => !['case_id', 'requirement', 'facts', 'label', 'expected', 'classification', 'review_status', 'scored', 'exclusion_reason'].includes(key))) }));
  const actual = syntheticBlind.candidates.map(item => item.source_identity);
  assert.equal(stableSemanticSerialize(expected), stableSemanticSerialize(actual));
  assert.equal(engineering.cases.length, 6);
  assert.equal(disputed.cases.length, 1);
  assert.match(fs.readFileSync(repoPath('eval/gold-human-review/v2/13_mapping_engineering_disputed_review.md'), 'utf8').toString(), /MAP-G028[\s\S]*semantic_expected_decision: ABSENT/);
});

test('overlays are separate and carry current expected authority only after blind review', () => {
  const realMd = fs.readFileSync(repoPath('eval/gold-human-review/v2/11b_mapping_real_current_authority_overlay.md'), 'utf8').toString();
  const syntheticMd = fs.readFileSync(repoPath('eval/gold-human-review/v2/12b_mapping_synthetic_current_expected_overlay.md'), 'utf8').toString();
  assert.match(realMd, /existing_expected_decision/);
  assert.match(syntheticMd, /successor_expected_decision/);
  assert.doesNotMatch(fs.readFileSync(repoPath('eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.md'), 'utf8').toString(), /existing_expected_decision|successor_expected_decision/);
  assert.doesNotMatch(fs.readFileSync(repoPath('eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.md'), 'utf8').toString(), /expected_decision|expected_dimensions/);
});

test('parity mutation and immutable Gold gates fail closed', () => {
  const source = parent.candidates[0];
  const reordered = structuredClone(source);
  reordered.facts = [...reordered.facts].reverse();
  assert.equal(stableSemanticSerialize(realSourceIdentity(source)), stableSemanticSerialize(realSourceIdentity(reordered)));
  assert.equal(stableSemanticSerialize(realPairIdentity(source)), stableSemanticSerialize(realPairIdentity(reordered)));
  const omittedFact = structuredClone(source);
  omittedFact.facts = omittedFact.facts.slice(1);
  assert.notEqual(stableSemanticSerialize(realSourceIdentity(source)), stableSemanticSerialize(realSourceIdentity(omittedFact)));
  const oldSha = sha256File('eval/requirement-evidence-mapping-v1/gold-cases.json');
  assert.equal(oldSha, '5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707');
  assert.equal(checkpoint.old_gold_sha_parity, 'PASS');
  assert.equal(checkpoint.old_gold_sha_before, checkpoint.old_gold_sha_after);
  assert.equal(checkpoint.active_gold_changed, 0);
});

test('export gates and side effects remain bounded', () => {
  assert.equal(checkpoint[HUMAN_REVIEW_EXPORT_PARITY_GATE], undefined);
  assert.equal(checkpoint.gates[HUMAN_REVIEW_EXPORT_PARITY_GATE], 'PASS');
  assert.equal(checkpoint.gates.blind_contamination, 'PASS');
  assert.equal(checkpoint.gates.production_import_guard, 'PASS');
  assert.equal(checkpoint.production_files_changed, 0);
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.dify_calls, 0);
  assert.equal(checkpoint.embedding_calls, 0);
  assert.equal(checkpoint.db_writes, 0);
  assert.equal(assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0 }).ok, true);
  assert.equal(validateProductionImportGuard({ repoRoot: backendRoot === 'backend' ? path.resolve('..') : process.cwd() }).ok, true);
});

test('export builder is deterministic and does not write when disabled', () => {
  const built = buildMappingGoldFullHumanReviewExport({ writeArtifacts: false });
  assert.equal(built.result.final_verdict, 'MAPPING_FULL_HUMAN_REVIEW_PACKETS_READY');
  assert.equal(built.result.real_review_case_count, 27);
  assert.equal(built.result.synthetic_review_case_count, 29);
  assert.equal(built.result.engineering_count, 6);
  assert.equal(built.result.disputed_count, 1);
  assert.equal(built.result.provider_calls, 0);
  assert.equal(built.result.db_writes, 0);
});
