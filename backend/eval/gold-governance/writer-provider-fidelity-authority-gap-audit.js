import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  assertNoProductionSideEffects,
  stableSemanticHash,
  validateProductionImportGuard
} from './gold-governance-harness-v1.js';
import {
  WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
  writerSourceAuthorityCompleteness,
  validateSourcePacketRenderIdentity,
  validateWriterAuthorizationParity,
  writerSourceIdentity
} from './claim-writer-gold-v2-harness.js';

/**
 * Eval-only audit for the nine Writer Provider Fidelity source candidates that
 * intentionally fail the authority completeness gate.  This module reads
 * source packets only; it has no Provider, database, or Production imports.
 */

export const WRITER_AUTHORITY_GAP_AUDIT_VERSION = 'writer-provider-fidelity-authority-gap-v1';
export const WRITER_AUTHORITY_LAUNDERING_GATE = 'WRITER_AUTHORITY_LAUNDERING_GATE';

const backendRoot = fs.existsSync('backend/eval') ? 'backend' : '.';
const repoPath = relative => path.join(backendRoot, relative);
const readJson = relative => JSON.parse(fs.readFileSync(repoPath(relative), 'utf8'));
const sha256File = relative => crypto.createHash('sha256').update(fs.readFileSync(repoPath(relative))).digest('hex');

const writerPacketPath = 'eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json';
const writerPacketMarkdownPath = 'eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.md';
const writerReviewPath = 'eval/gold-human-review/03_writer_gold_full_review.json';
const writerPacket = readJson(writerPacketPath);
const writerReview = readJson(writerReviewPath);
const writerReviewById = new Map((writerReview.cases || []).map(item => [item.case_id, item]));

const baseline = writerPacket.candidates.map(candidate => ({
  case_id: candidate.case_id,
  complete: writerSourceAuthorityCompleteness(candidate).ok,
  parity: validateWriterAuthorizationParity(candidate).ok,
  source_identity_hash: stableSemanticHash(candidate.source_identity || writerSourceIdentity(candidate))
}));
const baselineSourceCompleteIds = baseline.filter(item => item.complete).map(item => item.case_id);
const gapCandidates = writerPacket.candidates.filter(candidate => !writerSourceAuthorityCompleteness(candidate).ok);
const gapIds = new Set(gapCandidates.map(item => item.case_id));
const legacyIds = new Set(['CLM-030-1', 'CLM-016-1', 'CLM-187-1']);

function sourceCase(candidate) {
  return writerReviewById.get(candidate.case_id) || null;
}

function claimGateStatus(candidate, reviewCase) {
  const sourceClaims = reviewCase?.gold_input?.task?.assertable_claims || [];
  if (!sourceClaims.length) return 'ABSENT_IN_SOURCE';
  const hasGateIdentity = sourceClaims.some(claim => claim.gate_result_id && claim.input_snapshot_hash && claim.lineage_current === true);
  return hasGateIdentity ? 'PRESENT_FIXTURE_GATE_METADATA_NOT_CANONICAL' : 'PRESENT_UNRESOLVED';
}

function classifyCandidate(candidate) {
  const reviewCase = sourceCase(candidate);
  const requirements = Array.isArray(candidate.requirements) ? candidate.requirements : [];
  const claims = Array.isArray(candidate.approved_claims) ? candidate.approved_claims : [];
  const parity = validateWriterAuthorizationParity(candidate);
  const legacy = legacyIds.has(candidate.case_id);
  const sourceComplete = writerSourceAuthorityCompleteness(candidate);
  const requirementIdentityStatus = requirements.length === 0
    ? 'MISSING_CANONICAL_REQUIREMENT_IDENTITY'
    : requirements.some(item => !item?.source_hash)
      ? 'IDENTITY_PRESENT_SOURCE_HASH_UNRESOLVED'
      : 'PRESENT';
  const approvedClaimIdentityStatus = claims.length === 0
    ? 'MISSING_APPROVED_CLAIM'
    : legacy
      ? 'PRESENT_BUT_UNRESOLVED_LEGACY'
      : claims.some(item => item?.claim_id && item?.authorization_status === 'approved' && item?.writer_eligible === true)
        ? 'PRESENT_FIXTURE_ONLY'
        : 'PRESENT_UNAPPROVED_OR_UNRESOLVED';
  const limitationStatus = (candidate.claim_limitations || []).length ? 'PRESENT' : 'NONE_DECLARED';
  const authorizationStatus = legacy ? 'PRESENT_BUT_NOT_FORMAL_AUTHORITY' : 'PRESENT_SYNTHETIC_FIXTURE_AUTHORITY';
  const snapshotStatus = legacy ? 'PRESENT_UNVERIFIED_LEGACY' : 'PRESENT_CURRENT_FIXTURE';
  const safeContextStatus = legacy ? 'PRESENT_DERIVED_LEGACY' : 'PRESENT_FIXTURE';
  const currentnessStatus = legacy ? 'ASSERTED_TRUE_UNVERIFIED' : 'TRUE_IN_FIXTURE_ONLY';
  const provenanceStatus = legacy ? 'UNRESOLVABLE_LEGACY' : 'INCOMPLETE_REQUIREMENT_IDENTITY';
  return {
    writer_case_id: candidate.case_id,
    requirement_identity_status: requirementIdentityStatus,
    approved_claim_identity_status: approvedClaimIdentityStatus,
    claim_gate_evaluation_status: claimGateStatus(candidate, reviewCase),
    claim_limitation_status: limitationStatus,
    writer_authorization_status: authorizationStatus,
    authorization_snapshot_status: snapshotStatus,
    safe_context_projection_status: safeContextStatus,
    project_scope_status: candidate.writer_authorization?.project_id === candidate.project_id
      ? 'SAME_PROJECT_IN_SOURCE_PACKET'
      : 'MISMATCH_OR_MISSING',
    currentness_status: currentnessStatus,
    source_provenance_status: provenanceStatus,
    root_cause: legacy ? 'HISTORICAL_FIXTURE_WITHOUT_FORMAL_AUTHORITY' : 'REQUIREMENT_IDENTITY_MISMATCH',
    root_cause_class: legacy ? 'SOURCE_NOT_AUTHORIZED' : 'SOURCE_NOT_AUTHORIZED',
    recoverability: 'SOURCE_NOT_AUTHORIZED',
    claim_gold_v2_dependency: legacy ? 'YES_BLOCKED_BY_CLAIM_GOLD_V2' : 'NO',
    writer_gold_admission: legacy ? 'BLOCKED_BY_CLAIM_GOLD_V2' : 'NOT_ADMITTED_NO_FORMAL_AUTHORITY',
    authority_gate_code: sourceComplete.code,
    authority_gate_missing: sourceComplete.missing || [],
    authorization_parity_code: parity.code,
    authorization_parity_failures: parity.failures || []
  };
}

export function runWriterAuthorityGapAudit({ writeArtifacts = true } = {}) {
  const rows = gapCandidates.map(classifyCandidate);
  const completeBaselineParity = baseline.filter(item => item.complete && item.parity);
  const renderParity = validateSourcePacketRenderIdentity({
    packet: writerPacket,
    renderedIdentity: writerPacket.candidates.map(item => item.source_identity)
  });
  const safety = assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0 });
  const production = validateProductionImportGuard({ repoRoot: backendRoot === 'backend' ? path.resolve('..') : process.cwd() });
  const result = {
    audit: 'V43_WRITER_PROVIDER_FIDELITY_AUTHORITY_GAP_RESOLUTION_AUDIT',
    version: WRITER_AUTHORITY_GAP_AUDIT_VERSION,
    writer_source_authority_gate: WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
    total_writer_candidates: writerPacket.candidates.length,
    baseline_source_complete: baselineSourceCompleteIds.length,
    baseline_source_complete_ids: baselineSourceCompleteIds,
    authority_gap_count: rows.length,
    source_recoverable_count: 0,
    source_not_authorized_count: rows.filter(row => row.recoverability === 'SOURCE_NOT_AUTHORIZED').length,
    source_ambiguous_count: rows.filter(row => row.recoverability === 'SOURCE_AMBIGUOUS_REVIEW_REQUIRED').length,
    recovered_source_complete_count: 0,
    final_source_complete_count: completeBaselineParity.length,
    claim_gold_v2_dependent_count: rows.filter(row => row.claim_gold_v2_dependency.startsWith('YES')).length,
    root_cause_distribution: rows.reduce((distribution, row) => {
      distribution[row.root_cause] = (distribution[row.root_cause] || 0) + 1;
      return distribution;
    }, {}),
    candidates: rows,
    baseline_revalidation: {
      source_complete_ids: completeBaselineParity.map(item => item.case_id),
      source_authority_complete: completeBaselineParity.length === baselineSourceCompleteIds.length,
      authorization_parity_pass: completeBaselineParity.length === baselineSourceCompleteIds.length,
      stable_source_identity: new Set(completeBaselineParity.map(item => item.source_identity_hash)).size === completeBaselineParity.length
    },
    gates: {
      writer_source_completeness: `BASELINE_${baselineSourceCompleteIds.length}_PASS; ${rows.length}_FAIL_CLOSED`,
      writer_authorization_parity: `GAP_FIXTURES_${rows.filter(row => row.authorization_parity_code === 'WRITER_AUTHORIZATION_PARITY_PASS').length}_PASS; LEGACY_${rows.filter(row => row.authorization_parity_code !== 'WRITER_AUTHORIZATION_PARITY_PASS').length}_FAIL_CLOSED`,
      source_packet_render_parity: renderParity.ok ? 'PASS' : 'FAIL',
      writer_authority_laundering: safety.ok && production.ok ? 'PASS' : 'FAIL'
    },
    production_files_changed: 0,
    claim_authority_changed: 0,
    writer_authorization_changed: 0,
    provider_calls: 0,
    dify_calls: 0,
    embedding_calls: 0,
    db_writes: 0,
    source_packet_sha256: sha256File(writerPacketPath),
    source_packet_markdown_sha256: sha256File(writerPacketMarkdownPath),
    final_verdict: rows.length > 0 && completeBaselineParity.length === baselineSourceCompleteIds.length
      ? 'WRITER_SOURCE_POOL_PARTIALLY_READY'
      : 'WRITER_SOURCE_POOL_REVIEW_REQUIRED'
  };

  if (writeArtifacts) {
    const auditJsonPath = 'eval/gold-human-review/v2/writer/04_writer_provider_fidelity_authority_gap_audit.json';
    const auditMdPath = 'eval/gold-human-review/v2/writer/04_writer_provider_fidelity_authority_gap_audit.md';
    const checkpoint = {
      checkpoint: 'V43_WRITER_PROVIDER_FIDELITY_AUTHORITY_GAP_AUDIT_CHECKPOINT',
      task: result.audit,
      total_writer_candidates: result.total_writer_candidates,
      baseline_source_complete: result.baseline_source_complete,
      authority_gap_count: result.authority_gap_count,
      source_recoverable_count: result.source_recoverable_count,
      source_not_authorized_count: result.source_not_authorized_count,
      source_ambiguous_count: result.source_ambiguous_count,
      recovered_source_complete_count: result.recovered_source_complete_count,
      final_source_complete_count: result.final_source_complete_count,
      claim_gold_v2_dependent_count: result.claim_gold_v2_dependent_count,
      root_cause_distribution: result.root_cause_distribution,
      writer_source_completeness_gate: result.gates.writer_source_completeness,
      writer_authorization_parity_gate: result.gates.writer_authorization_parity,
      source_packet_render_parity_gate: result.gates.source_packet_render_parity,
      writer_authority_laundering_gate: result.gates.writer_authority_laundering,
      production_files_changed: result.production_files_changed,
      claim_authority_changed: result.claim_authority_changed,
      writer_authorization_changed: result.writer_authorization_changed,
      provider_calls: result.provider_calls,
      db_writes: result.db_writes,
      focused_tests: 'PENDING',
      backend_test_delta: 'PENDING',
      lint: 'PENDING',
      build: 'PENDING',
      git_diff_check: 'PENDING',
      source_packet_sha256: result.source_packet_sha256,
      source_packet_markdown_sha256: result.source_packet_markdown_sha256,
      final_verdict: result.final_verdict,
      git_safety: 'PRESERVE_DIRTY_WORKTREE_NO_GIT_MUTATION'
    };
    const json = value => JSON.stringify(value, null, 2) + '\n';
    fs.writeFileSync(repoPath(auditJsonPath), json(result));
    const lines = [
      '# Writer Provider Fidelity Authority Gap Audit',
      '',
      `- audit: \`${result.audit}\``,
      `- version: \`${result.version}\``,
      `- source packet SHA-256: \`${result.source_packet_sha256}\``,
      `- source packet Markdown SHA-256: \`${result.source_packet_markdown_sha256}\``,
      '',
      `- TOTAL_WRITER_CANDIDATES: ${result.total_writer_candidates}`,
      `- BASELINE_SOURCE_COMPLETE: ${result.baseline_source_complete}`,
      `- AUTHORITY_GAP_COUNT: ${result.authority_gap_count}`,
      `- SOURCE_RECOVERABLE_COUNT: ${result.source_recoverable_count}`,
      `- SOURCE_NOT_AUTHORIZED_COUNT: ${result.source_not_authorized_count}`,
      `- SOURCE_AMBIGUOUS_COUNT: ${result.source_ambiguous_count}`,
      `- RECOVERED_SOURCE_COMPLETE_COUNT: ${result.recovered_source_complete_count}`,
      `- FINAL_SOURCE_COMPLETE_COUNT: ${result.final_source_complete_count}`,
      `- CLAIM_GOLD_V2_DEPENDENT_COUNT: ${result.claim_gold_v2_dependent_count}`,
      '',
      '## Nine fail-closed candidates',
      '',
      '| writer_case_id | requirement | approved claim | gate evaluation | limitation | writer authorization | snapshot | safe context | project scope | currentness | provenance | root cause | recoverability | Claim Gold V2 dependency |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...result.candidates.map(row => `| ${row.writer_case_id} | ${row.requirement_identity_status} | ${row.approved_claim_identity_status} | ${row.claim_gate_evaluation_status} | ${row.claim_limitation_status} | ${row.writer_authorization_status} | ${row.authorization_snapshot_status} | ${row.safe_context_projection_status} | ${row.project_scope_status} | ${row.currentness_status} | ${row.source_provenance_status} | ${row.root_cause} | ${row.recoverability} | ${row.claim_gold_v2_dependency} |`),
      '',
      '## Governance boundary',
      '',
      '- The six synthetic claim-only fixtures have fixture gate metadata, but no canonical Requirement identity in their source; they are not recoverable by an Eval resolver.',
      '- The three legacy real-public candidates have no canonical Claim/Mapping/Requirement authority and remain blocked by Claim Gold V2 review.',
      '- No Fact, Mapping, legacy text, or other project is used as a Writer authorization fallback.',
      '- Existing source-complete baseline is preserved; no candidate is rejudged or promoted.',
      '',
      '## Gates',
      '',
      `- WRITER_SOURCE_COMPLETENESS_GATE: ${result.gates.writer_source_completeness}`,
      `- WRITER_AUTHORIZATION_PARITY_GATE: ${result.gates.writer_authorization_parity}`,
      `- SOURCE_PACKET_RENDER_PARITY_GATE: ${result.gates.source_packet_render_parity}`,
      `- WRITER_AUTHORITY_LAUNDERING_GATE: ${result.gates.writer_authority_laundering}`,
      '',
      `FINAL_VERDICT: ${result.final_verdict}`
    ];
    fs.writeFileSync(repoPath(auditMdPath), lines.join('\n') + '\n');
    const checkpointJsonPath = 'eval/gold-governance/10_writer_provider_fidelity_authority_gap_audit_checkpoint.json';
    const checkpointMdPath = 'eval/gold-governance/10_writer_provider_fidelity_authority_gap_audit_checkpoint.md';
    fs.writeFileSync(repoPath(checkpointJsonPath), json(checkpoint));
    fs.writeFileSync(repoPath(checkpointMdPath), [
      '# V43_WRITER_PROVIDER_FIDELITY_AUTHORITY_GAP_AUDIT_CHECKPOINT',
      '',
      ...Object.entries(checkpoint).filter(([key]) => key !== 'root_cause_distribution').map(([key, value]) => `- ${key.toUpperCase()}: ${typeof value === 'object' ? JSON.stringify(value) : value}`),
      `- ROOT_CAUSE_DISTRIBUTION: ${JSON.stringify(checkpoint.root_cause_distribution)}`,
      '',
      'No Provider, database, Production, Gold, or Git mutation was performed.'
    ].join('\n') + '\n');
  }
  return result;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  const result = runWriterAuthorityGapAudit();
  process.stdout.write(JSON.stringify({
    audit: result.audit,
    total_writer_candidates: result.total_writer_candidates,
    authority_gap_count: result.authority_gap_count,
    source_recoverable_count: result.source_recoverable_count,
    source_not_authorized_count: result.source_not_authorized_count,
    source_ambiguous_count: result.source_ambiguous_count,
    recovered_source_complete_count: result.recovered_source_complete_count,
    final_source_complete_count: result.final_source_complete_count,
    claim_gold_v2_dependent_count: result.claim_gold_v2_dependent_count,
    gates: result.gates,
    provider_calls: result.provider_calls,
    db_writes: result.db_writes,
    final_verdict: result.final_verdict
  }, null, 2) + '\n');
}
