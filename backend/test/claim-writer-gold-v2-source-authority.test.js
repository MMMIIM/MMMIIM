import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import {
  buildClaimQualityCases,
  claimQualityIdentity
} from '../eval/evidence-gold/claim-quality-cases.js';
import {
  assertNoProductionSideEffects,
  stableSemanticHash,
  validateBlindPacket
} from '../eval/gold-governance/gold-governance-harness-v1.js';
import {
  CLAIM_REAL_GOLD_NOVELTY_GATE,
  CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE,
  WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
  claimNoveltyIdentity,
  claimSourceAuthorityCompleteness,
  claimSourceIdentity,
  compareClaimNovelty,
  validateClaimWriterGovernanceSafety,
  validateSourceOnlyPacket,
  validateSourcePacketRenderIdentity,
  validateWriterAuthorizationParity,
  writerSourceAuthorityCompleteness,
  writerSourceIdentity
} from '../eval/gold-governance/claim-writer-gold-v2-harness.js';

const backendRoot = fs.existsSync('backend/eval') ? 'backend' : '.';
const repoPath = relative => path.join(backendRoot, relative);
const readJson = file => JSON.parse(fs.readFileSync(repoPath(file), 'utf8'));
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(repoPath(file))).digest('hex');
const claimPacket = readJson('eval/gold-human-review/v2/claim/02_claim_real_source_packet.json');
const writerPacket = readJson('eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json');
const checkpoint = readJson('eval/gold-governance/09_claim_writer_gold_v2_source_authority_checkpoint.json');

function completeClaimFromQuality(item) {
  const binding = item.binding;
  const facts = (binding.evidence_facts || []).map(fact => ({
    fact_id: fact.fact_id,
    fact_ref: fact.evidence_identifier || fact.fact_id,
    source_hash: binding.source_hash
  }));
  return {
    case_id: item.case_id,
    claim: { claim_id: item.claim.claim_id, text: item.claim.text, claim_type: item.claim.claim_type },
    requirement: { requirement_id: item.requirement.req_id, text: item.requirement.text, source_hash: item.requirement.requirement_hash },
    facts,
    mapping: { mapping_id: binding.mapping_id, authority_status: binding.mapping_status, project_id: binding.project_id, support_level: binding.support_level, authority_context: binding.source_hash },
    provenance: { resolvable: true }
  };
}

test('Claim/Writer V2 source manifest is source-only and anchored to current datasets', () => {
  const identity = claimQualityIdentity();
  assert.equal(identity.dataset_id, 'claim-quality-gold-v1-2026-09-02');
  assert.equal(identity.dataset_sha, '0a3a691fa27afc5ebc2daa4e2c8d327d263ff69b424c248870e13fcbbbe1b3d0');
  assert.equal(checkpoint.claim_quality_case_count, 24);
  assert.equal(checkpoint.claim_legacy_case_count, 60);
  assert.equal(checkpoint.claim_quality_dataset_sha256, identity.dataset_sha);
  assert.equal(checkpoint.claim_legacy_dataset_sha256, 'd7151db9420186a9e4f63e72dbe7ebb03f7f3ccea461c92fae1fb5c40581ed12');
  assert.equal(sha256File('eval/evidence-gold/gold-candidates.json'), checkpoint.claim_legacy_dataset_sha256);
  assert.equal(sha256File('eval/gold-human-review/02_claim_gold_full_review.json'), 'a83905ced353ecd5dc5e7ff2fd38d3e33e96042e4637e79c95eb45623410a55c');
  assert.equal(sha256File('eval/gold-human-review/03_writer_gold_full_review.json'), 'db4cc94285ae5a7be26dea0fdaac780b2d7cc633a795661b6f242ef5ec5f6dd0');
  assert.equal(sha256File('eval/requirement-evidence-mapping-v1/gold-cases.json'), '5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707');
  assert.equal(sha256File('eval/gold-human-review/v2/claim/02_claim_real_source_packet.json'), checkpoint.claim_real_source_packet_sha256);
  assert.equal(sha256File('eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json'), checkpoint.writer_source_packet_sha256);
});

test('all 24 Claim Quality source identities are complete without using answer fields', () => {
  const results = buildClaimQualityCases().map(completeClaimFromQuality).map(claimSourceAuthorityCompleteness);
  assert.equal(results.length, 24);
  assert.equal(results.filter(item => item.ok).length, 24);
  assert.ok(results.every(item => item.gate === CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE));
  const report = fs.readFileSync(repoPath('eval/gold-human-review/v2/claim/01_claim_quality_source_parity_report.md'), 'utf8');
  assert.equal((report.match(/^\| CQ-/gm) || []).length, 24);
  assert.equal(validateBlindPacket(claimPacket).ok, true);
});

test('Claim Legacy inventory keeps 60 source candidates and fails closed on missing canonical authority', () => {
  assert.equal(claimPacket.source_candidate_count, 60);
  assert.equal(claimPacket.selected_candidate_count, 12);
  assert.equal(claimPacket.candidates.length, 12);
  const gate = validateSourceOnlyPacket(claimPacket, { kind: 'claim' });
  assert.equal(gate.ok, false);
  assert.equal(gate.gate, CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE);
  assert.equal(gate.incomplete_count, 12);
  assert.equal(validateBlindPacket(claimPacket).ok, true);
  const inventory = fs.readFileSync(repoPath('eval/gold-human-review/v2/claim/01_claim_legacy_source_inventory.md'), 'utf8');
  assert.equal((inventory.match(/^\| CLM-/gm) || []).length, 60);
  assert.equal(Object.hasOwn(claimPacket.candidates[0], 'expected_decision'), false);
});

test('Claim novelty identity is stable and source-only candidates are auditable', () => {
  const first = claimPacket.candidates[0];
  const reordered = structuredClone(first);
  reordered.facts = [...reordered.facts].reverse();
  reordered.case_id = 'CLM-REORDERED';
  assert.equal(claimNoveltyIdentity(first), claimNoveltyIdentity(reordered));
  const novelty = compareClaimNovelty({ parentCandidates: [first], candidateCandidates: [reordered, claimPacket.candidates[1]] });
  assert.equal(novelty.gate, CLAIM_REAL_GOLD_NOVELTY_GATE);
  assert.equal(novelty.duplicate_case_ids.length, 1);
  assert.equal(novelty.novel_case_ids.length, 1);
});

test('source-only Claim packet render identity parity is deterministic', () => {
  const renderedIdentity = claimPacket.candidates.map(item => item.source_identity);
  const parity = validateSourcePacketRenderIdentity({ packet: claimPacket, renderedIdentity });
  assert.equal(parity.ok, true);
  const omitted = renderedIdentity.slice(1);
  assert.equal(validateSourcePacketRenderIdentity({ packet: claimPacket, renderedIdentity: omitted }).ok, false);
});

test('Writer source packet is blind, classified, and does not claim provider fidelity', () => {
  assert.equal(writerPacket.source_candidate_count, 12);
  assert.equal(writerPacket.provider_fidelity_status, 'NOT_ESTABLISHED');
  assert.equal(validateBlindPacket(writerPacket).ok, true);
  assert.equal(validateSourceOnlyPacket(writerPacket, { kind: 'writer' }).candidate_count, 12);
  assert.equal(validateSourceOnlyPacket(writerPacket, { kind: 'writer' }).incomplete_count, 9);
  assert.equal(checkpoint.writer_existing_case_count, 10);
  assert.equal(checkpoint.writer_semantic_case_count, 8);
  assert.equal(checkpoint.writer_engineering_case_count, 2);
  assert.equal(checkpoint.writer_provider_fidelity_source_case_count, 0);
  const manifest = fs.readFileSync(repoPath('eval/gold-human-review/v2/writer/00_writer_gold_v2_source_manifest.md'), 'utf8');
  assert.match(manifest, /W-AUTH-RETENTION-001 = DETERMINISTIC_REGRESSION/);
  assert.match(manifest, /W-IDEMPOTENCY-AUTH-001 = ENGINEERING \/ POSTGRESQL_REGRESSION/);
  assert.equal(validateSourcePacketRenderIdentity({ packet: writerPacket, renderedIdentity: writerPacket.candidates.map(item => item.source_identity) }).ok, true);
});

test('Writer authorization snapshot is a projection and parity fails closed for rejected visibility', () => {
  const parity = writerPacket.candidates.map(validateWriterAuthorizationParity);
  assert.equal(parity.filter(item => item.ok).length, 9);
  assert.equal(parity.filter(item => !item.ok).length, 3);
  assert.ok(parity.filter(item => !item.ok).every(item => item.code === 'WRITER_AUTHORIZATION_PARITY_FAILED'));
  const candidate = structuredClone(writerPacket.candidates.find(item => item.approved_claims.length > 0));
  candidate.rejected_claims = [{ claim_id: candidate.approved_claims[0].claim_id }];
  assert.equal(validateWriterAuthorizationParity(candidate).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
  assert.equal(candidate.writer_authorization.snapshot_identity, 'writer-authorization-snapshot-v1');
});

test('mutation sensitivity is source-authority fail closed and label independent', () => {
  const sourceComplete = completeClaimFromQuality(buildClaimQualityCases()[0]);
  const baseline = claimSourceAuthorityCompleteness(sourceComplete);
  assert.equal(baseline.ok, true);
  const factRemoved = structuredClone(sourceComplete);
  factRemoved.facts = [];
  assert.equal(claimSourceAuthorityCompleteness(factRemoved).code, 'CLAIM_SOURCE_AUTHORITY_INCOMPLETE');
  const labelMutation = structuredClone(sourceComplete);
  labelMutation.reviewer_annotation = 'human-only-not-scored';
  assert.equal(stableSemanticHash(claimSourceIdentity(sourceComplete)), stableSemanticHash(claimSourceIdentity(labelMutation)));

  const writer = structuredClone(writerPacket.candidates.find(item => item.case_id === 'W-AUTH-RETENTION-001'));
  const writerBaseline = writerSourceAuthorityCompleteness(writer);
  assert.equal(writerBaseline.ok, true);
  const claimRemoved = structuredClone(writer);
  claimRemoved.approved_claims = [];
  assert.equal(writerSourceAuthorityCompleteness(claimRemoved).code, 'WRITER_SOURCE_AUTHORITY_INCOMPLETE');
  const limitationChanged = structuredClone(writer);
  limitationChanged.claim_limitations = [...limitationChanged.claim_limitations, 'new boundary'];
  assert.notEqual(stableSemanticHash(writerSourceIdentity(writer)), stableSemanticHash(writerSourceIdentity(limitationChanged)));
  const writerLabelMutation = structuredClone(writer);
  writerLabelMutation.reviewer_annotation = 'human-only-not-scored';
  assert.equal(stableSemanticHash(writerSourceIdentity(writer)), stableSemanticHash(writerSourceIdentity(writerLabelMutation)));
});

test('governance safety proves Provider/DB side effects remain zero and production import guard passes', () => {
  assert.equal(assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0 }).ok, true);
  const safety = validateClaimWriterGovernanceSafety({ repoRoot: backendRoot === 'backend' ? path.resolve('..') : process.cwd(), providerCalls: 0, dbWrites: 0, packet: claimPacket });
  assert.equal(safety.ok, true);
  assert.equal(checkpoint.production_files_changed, 0);
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.db_writes, 0);
});

test('checkpoint records bounded readiness only, not Gold or production readiness', () => {
  assert.equal(checkpoint.final_verdict, 'CLAIM_WRITER_GOLD_V2_SOURCE_AUTHORITY_READY_FOR_HUMAN_REVIEW');
  assert.equal(checkpoint.old_gold_changed, 0);
  assert.equal(checkpoint.claim_known_review_target_count, 7);
  assert.equal(checkpoint.writer_authorization_parity_gate, 'PASS_FOR_9_SOURCE_COMPLETE; FAIL_CLOSED_FOR_3_LEGACY_UNRESOLVED');
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.db_writes, 0);
  assert.doesNotMatch(JSON.stringify(checkpoint), /WRITER_PRODUCTION_READY|WRITER_PROVIDER_FIDELITY_PASS|MAPPING_SEMANTIC_LIVE_PASS/);
});
