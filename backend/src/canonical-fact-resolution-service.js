import { AppError } from './errors.js';
import {
  hasMaterialSourceRoleData,
  materialAuthorityAllowedForMode,
  resolveMaterialSourceRole
} from './pipeline/material-source-authority-policy.js';

function safeCandidate(candidate, projectId) {
  if (!candidate || typeof candidate !== 'object'
    || candidate.creates_fact_authority !== false || candidate.creates_claim_authority !== false) {
    throw new AppError('EVIDENCE_CANDIDATE_AUTHORITY_INVALID', 'Evidence Candidate 只能是检索候选，不能携带 Fact 或 Claim authority。', 422);
  }
  if (String(candidate.project_id || '') !== String(projectId || '')) {
    throw new AppError('EVIDENCE_CANDIDATE_SCOPE_INVALID', 'Evidence Candidate 不属于当前项目。', 409);
  }
  if (String(candidate.source_role || '').toUpperCase() !== 'EVIDENCE_CANDIDATE'
    || !candidate.material_id || !candidate.source_span_id || !candidate.source_hash) {
    throw new AppError('EVIDENCE_CANDIDATE_AUTHORITY_INVALID', 'Evidence Candidate 缺少可用的 Evidence source lineage。', 422);
  }
}
function exactEligibleFact(fact, candidate) {
  if (!fact || typeof fact !== 'object') return false;
  const role = resolveMaterialSourceRole(fact);
  return fact.review_status === 'approved'
    && fact.fact_current === true
    && fact.source_lineage_verified === true
    && fact.source_material_authority_eligible !== false
    && String(fact.material_id) === String(candidate.material_id)
    && String(fact.source_span_id) === String(candidate.source_span_id)
    && String(fact.source_hash || fact.source_text_hash) === String(candidate.source_hash)
    && (!hasMaterialSourceRoleData(fact) || role.role === 'EVIDENCE_CANDIDATE')
    && materialAuthorityAllowedForMode(fact, { authorityMode: 'SYNTHETIC_EVAL_ONLY' });
}

/**
 * Resolves a search candidate only by reusing its exact canonical Fact, or by
 * delegating to the existing EvidenceSourceFactService after an approved
 * Evidence Review. It intentionally cannot construct a Fact from raw search
 * text, and extraction remains a review-gated lifecycle operation.
 */
export class CanonicalFactResolutionService {
  constructor({ repository, evidenceSourceFactService } = {}) {
    this.repository = repository;
    this.evidenceSourceFactService = evidenceSourceFactService;
  }

  async resolve({ projectId, candidate, actor } = {}) {
    safeCandidate(candidate, projectId);
    if (typeof this.repository?.findCurrentCanonicalFactForSource !== 'function') {
      throw new AppError('CANONICAL_FACT_LOOKUP_REQUIRED', 'Canonical Fact resolution 缺少精确 source lookup。', 503);
    }
    const existing = await this.repository.findCurrentCanonicalFactForSource({
      projectId,
      materialId: candidate.material_id,
      sourceSpanId: candidate.source_span_id,
      sourceHash: candidate.source_hash
    });
    if (exactEligibleFact(existing, candidate)) {
      return { status: 'FACT_REUSED', fact: existing, facts: [existing], evidence_gap: null };
    }
    if (!candidate.evidence_review_id) {
      return {
        status: 'FACT_REVIEW_REQUIRED', facts: [],
        evidence_gap: { status: 'FACT_REVIEW_REQUIRED', derived_only: true, creates_authority: false }
      };
    }
    if (!this.evidenceSourceFactService || typeof this.evidenceSourceFactService.extract !== 'function') {
      throw new AppError('CANONICAL_FACT_SERVICE_REQUIRED', 'Canonical Fact resolution 必须复用 EvidenceSourceFactService。', 503);
    }
    // Existing service owns authorization, approved-review verification,
    // extraction, canonical contract and Fact persistence. Do not duplicate it.
    await this.evidenceSourceFactService.extract({
      projectId,
      reviewId: candidate.evidence_review_id,
      actor
    });
    return {
      status: 'FACT_REVIEW_REQUIRED', facts: [],
      evidence_gap: { status: 'FACT_REVIEW_REQUIRED', derived_only: true, creates_authority: false }
    };
  }
}
