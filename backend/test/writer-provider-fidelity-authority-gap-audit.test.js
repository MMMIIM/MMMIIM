import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  assertNoProductionSideEffects,
  stableSemanticHash
} from '../eval/gold-governance/gold-governance-harness-v1.js';
import {
  WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
  validateSourcePacketRenderIdentity,
  validateWriterAuthorizationParity,
  writerSourceAuthorityCompleteness,
  writerSourceIdentity
} from '../eval/gold-governance/claim-writer-gold-v2-harness.js';
import {
  runWriterAuthorityGapAudit,
  WRITER_AUTHORITY_LAUNDERING_GATE
} from '../eval/gold-governance/writer-provider-fidelity-authority-gap-audit.js';

const backendRoot = fs.existsSync('backend/eval') ? 'backend' : '.';
const repoPath = relative => path.join(backendRoot, relative);
const readJson = relative => JSON.parse(fs.readFileSync(repoPath(relative), 'utf8'));
const writerPacket = readJson('eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json');
const audit = readJson('eval/gold-human-review/v2/writer/04_writer_provider_fidelity_authority_gap_audit.json');

test('authority gap audit classifies all nine fail-closed candidates without recovery', () => {
  assert.equal(audit.writer_source_authority_gate, WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE);
  assert.equal(audit.total_writer_candidates, 12);
  assert.equal(audit.baseline_source_complete, 3);
  assert.equal(audit.authority_gap_count, 9);
  assert.equal(audit.source_recoverable_count, 0);
  assert.equal(audit.source_not_authorized_count, 9);
  assert.equal(audit.source_ambiguous_count, 0);
  assert.equal(audit.recovered_source_complete_count, 0);
  assert.equal(audit.final_source_complete_count, 3);
  assert.equal(audit.candidates.length, 9);
  assert.ok(audit.candidates.every(row => row.recoverability === 'SOURCE_NOT_AUTHORIZED'));
  assert.equal(audit.root_cause_distribution.REQUIREMENT_IDENTITY_MISMATCH, 6);
  assert.equal(audit.root_cause_distribution.HISTORICAL_FIXTURE_WITHOUT_FORMAL_AUTHORITY, 3);
});

test('six claim-only fixtures and three legacy candidates retain distinct authority reasons', () => {
  const claimOnly = audit.candidates.filter(row => !['CLM-030-1', 'CLM-016-1', 'CLM-187-1'].includes(row.writer_case_id));
  const legacy = audit.candidates.filter(row => ['CLM-030-1', 'CLM-016-1', 'CLM-187-1'].includes(row.writer_case_id));
  assert.equal(claimOnly.length, 6);
  assert.equal(legacy.length, 3);
  assert.ok(claimOnly.every(row => row.requirement_identity_status === 'MISSING_CANONICAL_REQUIREMENT_IDENTITY'));
  assert.ok(claimOnly.every(row => row.root_cause === 'REQUIREMENT_IDENTITY_MISMATCH'));
  assert.ok(claimOnly.every(row => row.claim_gate_evaluation_status === 'PRESENT_FIXTURE_GATE_METADATA_NOT_CANONICAL'));
  assert.ok(claimOnly.every(row => row.claim_gold_v2_dependency === 'NO'));
  assert.ok(legacy.every(row => row.requirement_identity_status === 'IDENTITY_PRESENT_SOURCE_HASH_UNRESOLVED'));
  assert.ok(legacy.every(row => row.approved_claim_identity_status === 'PRESENT_BUT_UNRESOLVED_LEGACY'));
  assert.ok(legacy.every(row => row.claim_gate_evaluation_status === 'ABSENT_IN_SOURCE'));
  assert.ok(legacy.every(row => row.claim_gold_v2_dependency === 'YES_BLOCKED_BY_CLAIM_GOLD_V2'));
  assert.ok(legacy.every(row => row.root_cause === 'HISTORICAL_FIXTURE_WITHOUT_FORMAL_AUTHORITY'));
  assert.ok(legacy.every(row => row.writer_gold_admission === 'BLOCKED_BY_CLAIM_GOLD_V2'));
});

test('approved Claim resolver and valid snapshot source recovery pass; missing requirement remains fail closed', () => {
  const baseline = writerPacket.candidates.find(item => item.case_id === 'W-AUTH-RETENTION-001');
  assert.ok(baseline);
  assert.equal(writerSourceAuthorityCompleteness(baseline).ok, true);
  assert.equal(validateWriterAuthorizationParity(baseline).ok, true);
  const missingRequirement = structuredClone(baseline);
  missingRequirement.requirements = [];
  assert.equal(writerSourceAuthorityCompleteness(missingRequirement).code, 'WRITER_SOURCE_AUTHORITY_INCOMPLETE');
  assert.equal(validateWriterAuthorizationParity(missingRequirement).ok, true);
});

test('negative authority controls cannot recover Fact-only, Mapping-only, unapproved, stale, or cross-project inputs', () => {
  const baseline = writerPacket.candidates.find(item => item.case_id === 'W-AUTH-RETENTION-001');
  const factOnly = structuredClone(baseline);
  factOnly.approved_claims = [];
  assert.equal(writerSourceAuthorityCompleteness(factOnly).ok, false);
  const mappingOnly = structuredClone(factOnly);
  mappingOnly.mapping = { mapping_id: 'MAP-ONLY', review_status: 'approved' };
  assert.equal(writerSourceAuthorityCompleteness(mappingOnly).ok, false);
  const unapproved = structuredClone(baseline);
  unapproved.approved_claims[0].authorization_status = 'rejected';
  assert.equal(validateWriterAuthorizationParity(unapproved).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
  const stale = structuredClone(baseline);
  stale.writer_authorization.currentness = false;
  assert.equal(validateWriterAuthorizationParity(stale).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
  const crossProject = structuredClone(baseline);
  crossProject.writer_authorization.project_id = 'OTHER-PROJECT';
  assert.equal(validateWriterAuthorizationParity(crossProject).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
});

test('missing snapshot, rejected Claim, and laundering fail closed; limitations affect source identity', () => {
  const baseline = writerPacket.candidates.find(item => item.case_id === 'W-AUTH-RETENTION-001');
  const missingSnapshot = structuredClone(baseline);
  missingSnapshot.writer_authorization.snapshot_hash = null;
  assert.equal(writerSourceAuthorityCompleteness(missingSnapshot).ok, false);
  const rejectedVisible = structuredClone(baseline);
  rejectedVisible.rejected_claims = [{ claim_id: rejectedVisible.approved_claims[0].claim_id }];
  assert.equal(validateWriterAuthorizationParity(rejectedVisible).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
  const laundering = structuredClone(baseline);
  laundering.enterprise_capability_laundering = true;
  assert.equal(validateWriterAuthorizationParity(laundering).code, 'WRITER_AUTHORIZATION_PARITY_FAILED');
  const limited = structuredClone(baseline);
  limited.claim_limitations = [...limited.claim_limitations, 'additional boundary'];
  assert.notEqual(stableSemanticHash(writerSourceIdentity(baseline)), stableSemanticHash(writerSourceIdentity(limited)));
});

test('source packet parity, laundering gate, and side-effect counters remain clean', () => {
  const parity = validateSourcePacketRenderIdentity({ packet: writerPacket, renderedIdentity: writerPacket.candidates.map(item => item.source_identity) });
  assert.equal(parity.ok, true);
  assert.equal(audit.gates.source_packet_render_parity, 'PASS');
  assert.equal(audit.gates.writer_authority_laundering, 'PASS');
  assert.equal(WRITER_AUTHORITY_LAUNDERING_GATE, 'WRITER_AUTHORITY_LAUNDERING_GATE');
  assert.equal(assertNoProductionSideEffects({ providerCalls: audit.provider_calls, dbWrites: audit.db_writes }).ok, true);
  assert.equal(audit.production_files_changed, 0);
  assert.equal(audit.claim_authority_changed, 0);
  assert.equal(audit.writer_authorization_changed, 0);
});

test('audit remains bounded and reports partial source-pool readiness', () => {
  const rerun = runWriterAuthorityGapAudit({ writeArtifacts: false });
  assert.equal(rerun.authority_gap_count, 9);
  assert.equal(rerun.final_source_complete_count, 3);
  assert.equal(rerun.provider_calls, 0);
  assert.equal(rerun.db_writes, 0);
  assert.equal(rerun.final_verdict, 'WRITER_SOURCE_POOL_PARTIALLY_READY');
  assert.match(JSON.stringify(audit), /WRITER_SOURCE_POOL_PARTIALLY_READY/);
});
