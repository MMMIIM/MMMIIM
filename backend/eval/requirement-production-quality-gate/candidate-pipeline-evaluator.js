import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';

const resolver = new SourceLocationResolver();

function failure(code, index = null) {
  const sourceFailure = new Set([
    'SOURCE_LOCATION_UNRESOLVED',
    'GATEWAY_REQUIREMENTS_INVALID',
    'CANDIDATE_CONTRACT_FIELD_DEFECT',
    'CANDIDATE_PAYLOAD_INVALID'
  ]).has(code);
  return {
    source_resolution_success: null,
    source_resolution_failure_code: null,
    source_resolution_failed_candidate_index: null,
    canonicalization_success: null,
    canonicalization_failure_code: null,
    canonicalization_failed_candidate_index: null,
    quality_gate_decision: 'BLOCKED',
    quality_gate_reason_codes: [],
    failure_stage: sourceFailure
      ? 'SOURCE_RESOLUTION' : 'CANONICALIZATION',
    ...(sourceFailure
      ? {
        source_resolution_success: false,
        source_resolution_failure_code: code,
        source_resolution_failed_candidate_index: index
      }
      : {
        source_resolution_success: true,
        canonicalization_success: false,
        canonicalization_failure_code: code,
        canonicalization_failed_candidate_index: index
      })
  };
}

/**
 * Eval-only deterministic replay of the production candidate boundary.
 * It intentionally returns metadata, not candidate text or source content.
 */
export function evaluateCandidatePayload({ candidates, chunk, qualityGate = true } = {}) {
  if (!Array.isArray(candidates)) return failure('CANDIDATE_PAYLOAD_INVALID', null);
  if (candidates.length === 0) {
    return {
      source_resolution_success: null,
      source_resolution_failure_code: null,
      source_resolution_failed_candidate_index: null,
      canonicalization_success: null,
      canonicalization_failure_code: null,
      canonicalization_failed_candidate_index: null,
      quality_gate_decision: 'REVIEW_REQUIRED_OR_EMPTY',
      quality_gate_reason_codes: ['NO_CANDIDATES_RETURNED_BY_PROVIDER'],
      failure_stage: 'QUALITY_GATE',
      canonical_count: 0
    };
  }

  const projected = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return failure('CANDIDATE_CONTRACT_FIELD_DEFECT', index);
    }
    try {
      const resolved = resolver.resolve(candidate, chunk);
      projected.push({ ...candidate, ...resolved.location });
    } catch (error) {
      return failure(error?.code || 'SOURCE_LOCATION_UNRESOLVED', index);
    }
  }

  const invalidTextIndex = projected.findIndex((candidate) => !String(candidate.text || '').trim());
  if (invalidTextIndex >= 0) return failure('REQUIREMENT_TEXT_INVALID', invalidTextIndex);

  let canonicalized;
  try {
    canonicalized = buildCanonicalRequirements(projected.map((candidate, index) => ({
      text: candidate.text,
      category: candidate.category,
      source_text: candidate.source_text,
      source_context_text: candidate.source_context_text,
      source_verified: candidate.source_verified,
      source_resolution_status: candidate.source_resolution_status,
      source_match_type: candidate.source_match_type,
      source_hash: candidate.source_hash,
      source_page_start: candidate.source_page_start,
      source_page_end: candidate.source_page_end,
      source_paragraph_start: candidate.source_paragraph_start,
      source_paragraph_end: candidate.source_paragraph_end,
      source_clause_id: candidate.source_clause_id,
      source_chunk_id: candidate.source_chunk_id,
      mandatory_observed: candidate.mandatory_observed,
      requires_confirmation: candidate.requires_confirmation,
      candidate_index: index + 1
    })), { qualityGate });
  } catch (error) {
    return {
      ...failure(error?.code || 'CANONICALIZATION_FAILED', null),
      source_resolution_success: true,
      canonicalization_success: false,
      canonicalization_failure_code: error?.code || 'CANONICALIZATION_FAILED',
      canonical_count: 0
    };
  }

  const reasonCodes = [...new Set(canonicalized.flatMap((item) => item.quality_gate_reason_codes || []))];
  const qualityPass = !qualityGate || canonicalized.every((item) => item.quality_gate_decision === 'PASS');
  return {
    source_resolution_success: true,
    source_resolution_failure_code: null,
    source_resolution_failed_candidate_index: null,
    canonicalization_success: true,
    canonicalization_failure_code: null,
    canonicalization_failed_candidate_index: null,
    quality_gate_decision: qualityPass ? 'PASS' : 'REVIEW_REQUIRED_OR_BLOCKED',
    quality_gate_reason_codes: reasonCodes,
    failure_stage: qualityPass ? null : 'QUALITY_GATE',
    canonical_count: canonicalized.length,
    duplicate_count: canonicalized.audit?.duplicate_count ?? null
  };
}
