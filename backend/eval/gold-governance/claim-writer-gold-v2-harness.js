import {
  assertNoProductionSideEffects,
  stableSemanticHash,
  stableSemanticSerialize,
  SOURCE_PACKET_RENDER_PARITY_GATE,
  validateBlindPacket,
  validateProductionImportGuard
} from './gold-governance-harness-v1.js';

/**
 * Eval-only authority and blindness primitives for Claim/Writer Gold V2.
 *
 * This module deliberately has no production imports, provider clients, or
 * database access. It validates source authority and builds identity keys for
 * human-review preparation; it never adjudicates a semantic answer.
 */

export const CLAIM_WRITER_GOLD_V2_HARNESS_VERSION = 'claim-writer-gold-v2-source-authority-v1';
export const CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE = 'CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE';
export const WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE = 'WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE';
export const CLAIM_REAL_GOLD_NOVELTY_GATE = 'CLAIM_REAL_GOLD_NOVELTY_GATE';

const REQUIRED_CLAIM_KEYS = Object.freeze([
  'case_id',
  'claim.claim_id',
  'claim.text',
  'claim.claim_type',
  'requirement.requirement_id',
  'requirement.text',
  'requirement.source_hash',
  'mapping.mapping_id',
  'mapping.authority_status',
  'provenance.resolvable'
]);

const REQUIRED_WRITER_KEYS = Object.freeze([
  'case_id',
  'section.section_id',
  'section.task_identity',
  'requirements',
  'approved_claims',
  'claim_limitations',
  'writer_authorization.snapshot_identity',
  'writer_authorization.snapshot_hash',
  'safe_context.identity',
  'safe_context.hash'
]);

function missingValue(value) {
  return value === undefined || value === null || value === '';
}

function getPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function fail(code, details = {}) {
  return { ok: false, code, ...details };
}

function sorted(values = []) {
  return [...values].filter(value => !missingValue(value)).map(String).sort();
}

function factIdentity(fact = {}) {
  return fact.fact_id || fact.fact_ref || fact.evidence_id || fact.id || null;
}

export function claimSourceIdentity(candidate = {}) {
  const requirement = candidate.requirement || {};
  const claim = candidate.claim || {};
  const mapping = candidate.mapping || {};
  const facts = Array.isArray(candidate.facts) ? candidate.facts : [];
  return {
    claim_id: claim.claim_id || null,
    claim_text_hash: claim.text ? stableSemanticHash({ text: claim.text }) : null,
    requirement_id: requirement.requirement_id || requirement.req_id || null,
    requirement_source_hash: requirement.source_hash || null,
    fact_identity_set: sorted(facts.map(factIdentity)),
    fact_source_hash_set: sorted(facts.map(fact => fact.source_hash)),
    mapping_id: mapping.mapping_id || null,
    mapping_authority_context: mapping.authority_context || mapping.context_hash || null
  };
}

export function claimSourceAuthorityCompleteness(candidate = {}) {
  const missing = REQUIRED_CLAIM_KEYS.filter(path => missingValue(getPath(candidate, path)));
  const facts = Array.isArray(candidate.facts) ? candidate.facts : null;
  if (!facts || facts.length === 0) missing.push('facts');
  for (const [index, fact] of (facts || []).entries()) {
    for (const field of ['fact_id', 'fact_ref', 'source_hash']) {
      if (missingValue(fact?.[field])) missing.push(`facts[${index}].${field}`);
    }
  }
  const mapping = candidate.mapping || {};
  if (missingValue(mapping.project_id)) missing.push('mapping.project_id');
  if (missingValue(mapping.support_level)) missing.push('mapping.support_level');
  if (candidate.provenance?.resolvable !== true) missing.push('provenance.resolvable');
  return missing.length
    ? fail('CLAIM_SOURCE_AUTHORITY_INCOMPLETE', {
      gate: CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE,
      case_id: candidate.case_id || null,
      missing,
      source_identity: claimSourceIdentity(candidate)
    })
    : {
      ok: true,
      code: 'CLAIM_SOURCE_AUTHORITY_COMPLETE',
      gate: CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE,
      case_id: candidate.case_id,
      source_identity: claimSourceIdentity(candidate)
    };
}

export function claimNoveltyIdentity(candidate = {}) {
  const identity = claimSourceIdentity(candidate);
  return stableSemanticSerialize(identity);
}

export function compareClaimNovelty({ parentCandidates = [], candidateCandidates = [] } = {}) {
  const parentByIdentity = new Map(parentCandidates.map(item => [claimNoveltyIdentity(item), item.case_id]));
  const seen = new Map();
  const duplicateCaseIds = [];
  const novelCaseIds = [];
  const classifications = [];
  for (const item of candidateCandidates) {
    const identity = claimNoveltyIdentity(item);
    const parentId = parentByIdentity.get(identity);
    if (parentId) {
      duplicateCaseIds.push(item.case_id);
      classifications.push({ case_id: item.case_id, parent_case_id: parentId, classification: 'DUPLICATE_PARENT_CLAIM' });
    } else if (seen.has(identity)) {
      duplicateCaseIds.push(item.case_id);
      classifications.push({ case_id: item.case_id, parent_case_id: seen.get(identity), classification: 'DUPLICATE_CLAIM_POOL' });
    } else {
      novelCaseIds.push(item.case_id);
      classifications.push({ case_id: item.case_id, classification: 'NOVEL' });
      seen.set(identity, item.case_id);
    }
  }
  return {
    gate: CLAIM_REAL_GOLD_NOVELTY_GATE,
    ok: duplicateCaseIds.length === 0,
    code: duplicateCaseIds.length ? 'CLAIM_REAL_GOLD_NOVELTY_REVIEW_REQUIRED' : 'CLAIM_REAL_GOLD_NOVELTY_PASS',
    duplicate_case_ids: duplicateCaseIds,
    novel_case_ids: novelCaseIds,
    classifications
  };
}

export function writerSourceIdentity(candidate = {}) {
  const requirements = Array.isArray(candidate.requirements) ? candidate.requirements : [];
  const claims = Array.isArray(candidate.approved_claims) ? candidate.approved_claims : [];
  return {
    case_id: candidate.case_id || null,
    section_id: candidate.section?.section_id || null,
    task_identity: candidate.section?.task_identity || null,
    requirement_identity_set: sorted(requirements.map(item => item.requirement_id)),
    requirement_source_hash_set: sorted(requirements.map(item => item.source_hash)),
    approved_claim_identity_set: sorted(claims.map(item => item.claim_id)),
    approved_claim_text_hash_set: sorted(claims.map(item => item.text_hash || (item.text ? stableSemanticHash({ text: item.text }) : null))),
    limitation_hash: stableSemanticHash(candidate.claim_limitations || []),
    authorization_snapshot_identity: candidate.writer_authorization?.snapshot_identity || null,
    authorization_snapshot_hash: candidate.writer_authorization?.snapshot_hash || null,
    safe_context_identity: candidate.safe_context?.identity || null,
    safe_context_hash: candidate.safe_context?.hash || null
  };
}

export function writerSourceAuthorityCompleteness(candidate = {}) {
  const missing = REQUIRED_WRITER_KEYS.filter(path => missingValue(getPath(candidate, path)));
  if (!Array.isArray(candidate.requirements) || candidate.requirements.length === 0) missing.push('requirements.non_empty');
  for (const [index, requirement] of (candidate.requirements || []).entries()) {
    for (const field of ['requirement_id', 'text', 'source_hash']) {
      if (missingValue(requirement?.[field])) missing.push(`requirements[${index}].${field}`);
    }
  }
  if (candidate.writer_authorization?.authorization_mode === 'APPROVED_CLAIM_AUTHORITY'
    && (!Array.isArray(candidate.approved_claims) || candidate.approved_claims.length === 0)) {
    missing.push('approved_claims.non_empty');
  }
  const authorization = candidate.writer_authorization || {};
  if (authorization.project_id && candidate.project_id && authorization.project_id !== candidate.project_id) missing.push('writer_authorization.project_id_match');
  return missing.length
    ? fail('WRITER_SOURCE_AUTHORITY_INCOMPLETE', {
      gate: WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
      case_id: candidate.case_id || null,
      missing,
      source_identity: writerSourceIdentity(candidate)
    })
    : {
      ok: true,
      code: 'WRITER_SOURCE_AUTHORITY_COMPLETE',
      gate: WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
      case_id: candidate.case_id,
      source_identity: writerSourceIdentity(candidate)
    };
}

export function validateWriterAuthorizationParity(candidate = {}) {
  const failures = [];
  const authorization = candidate.writer_authorization || {};
  const claims = Array.isArray(candidate.approved_claims) ? candidate.approved_claims : [];
  if (authorization.project_id && candidate.project_id && authorization.project_id !== candidate.project_id) failures.push('CROSS_PROJECT_AUTHORIZATION');
  if (authorization.currentness === false || authorization.stale === true) failures.push('STALE_AUTHORIZATION');
  if (authorization.snapshot_hash && authorization.snapshot_identity_hash && authorization.snapshot_hash !== authorization.snapshot_identity_hash) failures.push('SNAPSHOT_IDENTITY_MISMATCH');
  if (claims.some(claim => claim.authorization_status !== 'approved' || claim.writer_eligible !== true)) failures.push('UNAPPROVED_OR_UNRESOLVED_CLAIM_VISIBLE');
  if (Array.isArray(candidate.rejected_claims) && candidate.rejected_claims.some(rejected => claims.some(claim => claim.claim_id === rejected.claim_id))) failures.push('REJECTED_CLAIM_VISIBLE');
  if (candidate.enterprise_capability_laundering === true) failures.push('ENTERPRISE_CAPABILITY_LAUNDERING');
  return failures.length
    ? fail('WRITER_AUTHORIZATION_PARITY_FAILED', { failures })
    : { ok: true, code: 'WRITER_AUTHORIZATION_PARITY_PASS' };
}

export function validateSourceOnlyPacket(packet, { kind = 'claim' } = {}) {
  const blind = validateBlindPacket(packet);
  if (!blind.ok) return blind;
  const candidates = Array.isArray(packet?.candidates) ? packet.candidates : [];
  const completeness = candidates.map(candidate => kind === 'claim'
    ? claimSourceAuthorityCompleteness(candidate)
    : writerSourceAuthorityCompleteness(candidate));
  return {
    ok: completeness.every(item => item.ok),
    code: completeness.every(item => item.ok) ? 'SOURCE_ONLY_PACKET_COMPLETE' : `${kind.toUpperCase()}_SOURCE_AUTHORITY_INCOMPLETE`,
    gate: kind === 'claim' ? CLAIM_SOURCE_AUTHORITY_COMPLETENESS_GATE : WRITER_SOURCE_AUTHORITY_COMPLETENESS_GATE,
    candidate_count: candidates.length,
    complete_count: completeness.filter(item => item.ok).length,
    incomplete_count: completeness.filter(item => !item.ok).length,
    incomplete_cases: completeness.filter(item => !item.ok).map(item => ({ case_id: item.case_id, missing: item.missing }))
  };
}

export function validateSourcePacketRenderIdentity({ packet, renderedIdentity } = {}) {
  const sourceCandidates = Array.isArray(packet?.candidates) ? packet.candidates : [];
  const rendered = Array.isArray(renderedIdentity) ? renderedIdentity : [];
  const expected = sourceCandidates.map(candidate => candidate.source_identity || (packet.kind === 'writer'
    ? writerSourceIdentity(candidate)
    : claimSourceIdentity(candidate)));
  const expectedHashes = expected.map(item => stableSemanticHash(item)).sort();
  const renderedHashes = rendered.map(item => stableSemanticHash(item)).sort();
  const ok = stableSemanticSerialize(expectedHashes) === stableSemanticSerialize(renderedHashes);
  return ok
    ? { ok: true, code: 'SOURCE_PACKET_RENDER_PARITY_PASS', gate: SOURCE_PACKET_RENDER_PARITY_GATE, count: expected.length }
    : fail('SOURCE_PACKET_RENDER_PARITY_MISMATCH', { gate: SOURCE_PACKET_RENDER_PARITY_GATE, expected_count: expected.length, rendered_count: rendered.length });
}

export function validateClaimWriterGovernanceSafety({ repoRoot, providerCalls = 0, dbWrites = 0, packet } = {}) {
  const sideEffects = assertNoProductionSideEffects({ providerCalls, dbWrites });
  if (!sideEffects.ok) return sideEffects;
  const blind = validateBlindPacket(packet || {});
  if (!blind.ok) return blind;
  const production = validateProductionImportGuard({ repoRoot });
  if (!production.ok) return production;
  return { ok: true, code: 'CLAIM_WRITER_GOVERNANCE_SAFETY_PASS' };
}
