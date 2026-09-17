import { AppError } from './errors.js';
import {
  createEvidenceFactContract,
  EVIDENCE_FACT_CONTRACT_VERSION,
  ProviderNeutralEvidenceFactExtractor
} from './pipeline/evidence-fact-contract-v1.js';
import { FACT_PROVIDER_AUDIT } from './pipeline/semantic-gateway-evidence-fact-extractor.js';
import { hashSource } from './pipeline/source-location-resolver.js';
import {
  hasMaterialSourceRoleData,
  resolveMaterialSourceRole,
  materialAuthorityAllowedForMode,
  resolveMaterialAuthorityTier
} from './pipeline/material-source-authority-policy.js';

export const MAX_EXTRACTION_ATTEMPTS = 2;

const sha = hashSource;

function safeText(value, maxLength = 240) {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function safeSchemaDiagnostics(error) {
  const details = error?.details || {};
  if (!Array.isArray(details.schema_validation_errors)) return [];
  return details.schema_validation_errors.slice(0, 20).map(item => {
    const diagnostic = {
      ...(item?.stage === 'FACT' ? { stage: 'FACT' } : {}),
      ...(safeText(item?.path, 200) ? { path: safeText(item.path, 200) } : {}),
      ...(safeText(item?.keyword, 80) ? { keyword: safeText(item.keyword, 80) } : {}),
      ...(safeText(item?.expected, 240) ? { expected: safeText(item.expected, 240) } : {}),
      ...(safeText(item?.actual_type, 80) ? { actual_type: safeText(item.actual_type, 80) } : {})
    };
    for (const key of ['additional_property', 'missing_property', 'pattern']) {
      const value = safeText(item?.[key], key === 'pattern' ? 160 : 120);
      if (value) diagnostic[key] = value;
    }
    return diagnostic;
  });
}

function schemaRetryFeedback(error) {
  const details = error?.details || {};
  const causeCode = details.cause_code || error?.code;
  if (causeCode !== 'OUTPUT_SCHEMA_INVALID') return null;
  const diagnostic = safeSchemaDiagnostics(error).find(item => (
    item.stage === 'FACT'
    &&
    typeof item.path === 'string'
    && typeof item.keyword === 'string'
    && typeof item.expected === 'string'
    && typeof item.actual_type === 'string'
  ));
  if (!diagnostic) return null;
  const { path, keyword, expected, actual_type, additional_property, missing_property, pattern } = diagnostic;
  return {
    path,
    keyword,
    expected,
    actual_type,
    ...(additional_property ? { additional_property } : {}),
    ...(missing_property ? { missing_property } : {}),
    ...(pattern ? { pattern } : {})
  };
}

function isRetryEligible(error, context) {
  // Schema-contract failures are deterministic boundary errors.  Retrying the
  // same provider request (even with corrective text) cannot make an
  // incompatible response format safe and previously obscured the first
  // failure while consuming a second paid call.  Keep them fail-closed.
  if (error?.code === 'FACT_SEMANTIC_EMPTY' && context.fact_extraction_expected === true) {
    return { eligible: true, feedback: null };
  }
  return { eligible: false, feedback: null };
}

function safeFailureSnapshot(error) {
  const details = error?.details || {};
  const schemaValidationErrors = safeSchemaDiagnostics(error);
  return {
    stage: details.stage === 'FACT' ? 'FACT' : null,
    boundary: safeText(details.boundary, 160),
    error_code: safeText(error?.code, 100),
    cause_code: safeText(details.cause_code || error?.code, 100),
    ...(schemaValidationErrors.length > 0 ? { schema_validation_errors: schemaValidationErrors } : {})
  };
}

function wrapExtractionError(error) {
  if (String(error?.code || '').startsWith('FACT_')) return error;
  return new AppError('FACT_SEMANTIC_EXTRACTION_FAILED', 'Fact semantic extraction failed.', 502, {
    stage: 'FACT',
    boundary: 'EvidenceSourceFactService -> SemanticGatewayEvidenceFactExtractor',
    cause_code: error?.code || null,
    provider_audit: error?.details?.provider_audit || null,
    provider_invocation: error?.details?.provider_invocation || null,
    ...(Array.isArray(error?.details?.schema_validation_errors)
      ? { schema_validation_errors: error.details.schema_validation_errors.slice(0, 100) }
      : {})
  });
}

function recoveryFailure({ initialFailure, retryResult }) {
  return new AppError('AUTO_RECOVERY_FAILED', 'Automatic Fact semantic recovery failed.', 422, {
    stage: 'FACT',
    boundary: 'EvidenceSourceFactService -> SemanticGatewayEvidenceFactExtractor',
    final_status: 'NEEDS_REVIEW',
    attempt_count: MAX_EXTRACTION_ATTEMPTS,
    first_pass: false,
    retry_eligible: true,
    retry_attempted: true,
    retry_success: false,
    auto_recovered: false,
    final_auto_success: false,
    human_escalation: true,
    initial_failure: initialFailure,
    retry_result: retryResult,
    cause_code: retryResult.cause_code || 'AUTO_RECOVERY_FAILED'
  });
}

export class EvidenceSourceFactService {
  constructor({
    repository,
    projectAuthorizationService,
    extractor = new ProviderNeutralEvidenceFactExtractor(),
    contractVersion = EVIDENCE_FACT_CONTRACT_VERSION,
    extractorVersion = extractor.version || 'provider-neutral-fact-stub-v1',
    authorityMode = 'PRODUCTION'
  }) {
    this.repository = repository;
    this.projectAuthorizationService = projectAuthorizationService;
    this.extractor = extractor;
    this.contractVersion = contractVersion;
    this.extractorVersion = extractorVersion;
    this.authorityMode = authorityMode;
  }

  async extract({ projectId, reviewId, actor } = {}) {
    if (!projectId || !reviewId || !actor) {
      throw new AppError('FACT_PROJECT_SCOPE_REQUIRED', '创建 Fact Candidate 需要明确项目范围和可信身份。', 400);
    }
    if (!this.projectAuthorizationService) {
      throw new AppError('PROJECT_AUTHORIZATION_REQUIRED', '项目授权服务尚未配置。', 503);
    }
    await this.projectAuthorizationService.assertProjectAccess({ projectId, actor, action: 'WRITE' });
    const context = await this.repository.getEvidenceReviewForFact({ projectId, reviewId });
    if (!context) throw new AppError('EVIDENCE_REVIEW_NOT_FOUND', 'Evidence Review 不存在或不属于当前项目。', 404);
    if (context.source_material_authority_eligible === false) {
      throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', 'Fact 的来源材料当前已被隔离，不能创建新的 Canonical Fact。', 409);
    }
    if (context.review_status !== 'approved') {
      throw new AppError('EVIDENCE_REVIEW_NOT_APPROVED', '只有 approved Evidence Review 才能创建 Fact Candidate。', 409);
    }
    if (this.isReviewStale(context)) {
      await this.repository.invalidateEvidenceCandidateReview(reviewId);
      throw new AppError('EVIDENCE_REVIEW_VERSION_INVALIDATED', 'Requirement、Source Span 或 Contract 已变化，旧 Evidence Review 不得继续创建 Fact。', 409);
    }
    // The review query intentionally projects only the fields needed for the
    // review contract.  Refresh the complete material row at this authority
    // boundary so synthetic/source-role markers cannot be lost in a partial
    // SQL projection. Test doubles may omit this repository method.
    const material = context.material_id && typeof this.repository.getCompanyMaterial === 'function'
      ? await this.repository.getCompanyMaterial(context.material_id)
      : null;
    const roleContext = material ? { ...context, ...material } : context;
    const sourceRole = resolveMaterialSourceRole(roleContext);
    const authorityTier = resolveMaterialAuthorityTier(roleContext);
    if (hasMaterialSourceRoleData(roleContext) && sourceRole.role === 'REFERENCE_ONLY') {
      return {
        status: 'FACT_SKIPPED_REFERENCE_ONLY',
        facts: [],
        source_role: sourceRole.role,
        material_id: roleContext.material_id || context.material_id,
        material_type: sourceRole.material_type,
        role_reason: sourceRole.reason,
        authority: authorityTier.authority,
        production_authority: authorityTier.production_authority,
        authority_mode: this.authorityMode,
        policy_version: sourceRole.policy_version,
        provider_audit: {
          provider_calls: 0,
          skipped: true,
          skip_reason: sourceRole.reason,
          source_role: sourceRole.role,
          authority: authorityTier.authority,
          production_authority: authorityTier.production_authority,
          policy_version: sourceRole.policy_version
        }
      };
    }
    if (!materialAuthorityAllowedForMode(roleContext, { authorityMode: this.authorityMode })) {
      return {
        status: 'FACT_SKIPPED_SYNTHETIC_PRODUCTION_AUTHORITY',
        facts: [],
        source_role: sourceRole.role,
        material_id: roleContext.material_id || context.material_id,
        material_type: sourceRole.material_type,
        role_reason: sourceRole.reason,
        authority: authorityTier.authority,
        production_authority: authorityTier.production_authority,
        authority_mode: this.authorityMode,
        policy_version: sourceRole.policy_version,
        provider_audit: {
          provider_calls: 0,
          skipped: true,
          skip_reason: 'synthetic_material_production_authority_none',
          source_role: sourceRole.role,
          authority: authorityTier.authority,
          production_authority: authorityTier.production_authority,
          policy_version: sourceRole.policy_version
        }
      };
    }
    if (context.evidence_capability === 'reference_only'
      || context.support_level === 'reference_only'
      || context.material_type === 'historical_bid') {
      throw new AppError('EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN', 'reference-only 来源不得形成正式企业 Fact Candidate。', 422);
    }

    const extractionContext = Object.freeze({ ...context });
    let candidates;
    let attemptCount = 0;
    let retryEligible = false;
    let retryAttempted = false;
    let retrySuccess = false;
    let correctiveFeedback = null;
    let initialFailure = null;

    for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
      attemptCount = attempt;
      try {
        candidates = await this.extractor.extract(
          extractionContext,
          attempt === 2 ? { correctiveFeedback } : undefined
        );
        if (!Array.isArray(candidates)) {
          throw new AppError('FACT_SEMANTIC_OUTPUT_INVALID', 'Fact semantic worker output is invalid.', 502, {
            stage: 'FACT',
            boundary: 'EvidenceSourceFactService -> SemanticGatewayEvidenceFactExtractor'
          });
        }
        // A schema-valid empty result is a successful window completion.  It
        // is not a semantic/transport failure and must not trigger a retry;
        // document-level zero-fact classification happens only after all
        // eligible windows have completed.
        if (attempt === 2) retrySuccess = true;
        break;
      } catch (rawError) {
        const error = wrapExtractionError(rawError);
        if (attempt === 1) {
          const eligibility = isRetryEligible(error, extractionContext);
          retryEligible = eligibility.eligible;
          initialFailure = safeFailureSnapshot(error);
          if (!eligibility.eligible) throw error;
          correctiveFeedback = eligibility.feedback;
          retryAttempted = true;
          continue;
        }
        throw recoveryFailure({ initialFailure, retryResult: safeFailureSnapshot(error) });
      }
    }

    const facts = [];
    for (const candidate of candidates) {
      let fact;
      try {
        fact = createEvidenceFactContract(context, candidate, {
          contractVersion: this.contractVersion,
          extractorVersion: this.extractorVersion,
          extractorType: 'machine'
        });
      } catch (error) {
        if (String(error?.code || '').startsWith('EVIDENCE_FACT_')) {
          error.details = { ...(error.details || {}), stage: 'FACT' };
        }
        throw error;
      }
      facts.push(fact);
    }

    let persistedFacts = [];
    if (facts.length > 0) {
      if (typeof this.repository.upsertEvidenceSourceFactsAtomic !== 'function') {
        throw new AppError('FACT_ATOMIC_PERSISTENCE_REQUIRED', 'Canonical Fact repository 未提供原子批量持久化边界。', 503);
      }
      persistedFacts = await this.repository.upsertEvidenceSourceFactsAtomic(facts);
    }

    const providerAudit = candidates[FACT_PROVIDER_AUDIT];
    const executionAudit = {
      ...(providerAudit && typeof providerAudit === 'object' ? providerAudit : {}),
      attempt_count: attemptCount,
      retry_attempt: Math.max(0, attemptCount - 1),
      retry_reason: retryAttempted
        ? safeText(initialFailure?.cause_code || initialFailure?.error_code, 100)
        : null,
      first_pass: attemptCount === 1,
      retry_eligible: retryEligible,
      retry_attempted: retryAttempted,
      retry_success: retrySuccess,
      auto_recovered: retrySuccess,
      final_auto_success: true,
      human_escalation: false
    };
    return {
      facts: persistedFacts,
      source_role: sourceRole.role,
      material_id: roleContext.material_id || context.material_id,
      material_type: sourceRole.material_type,
      role_reason: sourceRole.reason,
      authority: authorityTier.authority,
      production_authority: authorityTier.production_authority,
      authority_mode: this.authorityMode,
      policy_version: sourceRole.policy_version,
      provider_audit: executionAudit
    };
  }

  isReviewStale(context) {
    return context.evidence_review_contract_version !== 'evidence-review-v1'
      || context.source_text_hash !== context.current_source_text_hash
      || sha(context.source_text) !== context.current_source_text_hash;
  }

  async decide(factId, decision, { reviewer, note = null } = {}) {
    if (!['approve', 'reject'].includes(decision)) {
      throw new AppError('EVIDENCE_FACT_DECISION_INVALID', 'Fact 决定必须为 approve 或 reject。', 422);
    }
    if (!String(reviewer || '').trim()) {
      throw new AppError('EVIDENCE_FACT_REVIEWER_REQUIRED', 'Fact 审核人不能为空。', 422);
    }
    const current = await this.repository.getEvidenceSourceFactCurrent(factId);
    if (!current) throw new AppError('EVIDENCE_FACT_NOT_FOUND', 'Fact 不存在。', 404);
    if (this.isStale(current)) {
      await this.repository.invalidateEvidenceSourceFact(factId);
      throw new AppError('EVIDENCE_FACT_INVALIDATED', 'Fact 来源或上游 Review 已变化。', 409);
    }
    if (current.review_status !== 'draft') throw new AppError('EVIDENCE_FACT_ALREADY_DECIDED', 'Fact 已完成审核。', 409);
    if (decision === 'approve' && current.source_material_authority_eligible === false) {
      throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', 'Fact 的来源材料当前已被隔离，不能批准。', 409);
    }
    const material = current.material_id && typeof this.repository.getCompanyMaterial === 'function'
      ? await this.repository.getCompanyMaterial(current.material_id)
      : null;
    const roleContext = material ? { ...current, ...material } : current;
    const currentRole = resolveMaterialSourceRole(roleContext);
    if (decision === 'approve' && hasMaterialSourceRoleData(roleContext) && currentRole.role === 'REFERENCE_ONLY') {
      throw new AppError('EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN', 'reference-only 来源不得批准为正式企业 Fact。', 422);
    }
    return this.repository.decideEvidenceSourceFact({
      factId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewer: String(reviewer).trim(),
      note
    });
  }

  async edit(factId, payload, { reviewer, note = null } = {}) {
    const editor = String(reviewer || '').trim();
    if (!editor) throw new AppError('EVIDENCE_FACT_REVIEWER_REQUIRED', 'Fact 编辑人不能为空。', 422);
    const current = await this.repository.getEvidenceSourceFactCurrent(factId);
    if (!current) throw new AppError('EVIDENCE_FACT_NOT_FOUND', 'Fact 不存在。', 404);
    if (current.source_material_authority_eligible === false) {
      throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', 'Fact 的来源材料当前已被隔离，不能编辑。', 409);
    }
    const material = current.material_id && typeof this.repository.getCompanyMaterial === 'function'
      ? await this.repository.getCompanyMaterial(current.material_id)
      : null;
    const roleContext = material ? { ...current, ...material } : current;
    const currentRole = resolveMaterialSourceRole(roleContext);
    if (hasMaterialSourceRoleData(roleContext) && currentRole.role === 'REFERENCE_ONLY') {
      throw new AppError('EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN', 'reference-only 来源不得编辑为正式企业 Fact。', 422);
    }
    if (this.isStale(current)) throw new AppError('EVIDENCE_FACT_INVALIDATED', 'Fact 来源或上游 Review 已变化。', 409);
    const context = {
      project_id: current.project_id,
      review_id: current.evidence_review_id,
      source_span_id: current.source_span_id,
      material_id: current.material_id,
      source_text_hash: current.current_source_text_hash,
      anchor_chunk_id: current.anchor_chunk_id,
      source_text: current.source_text
    };
    const edited = createEvidenceFactContract(context, payload, {
      contractVersion: this.contractVersion,
      extractorVersion: `human-edit:${editor}`,
      extractorType: 'human',
      version: current.version + 1,
      supersedesFactId: current.fact_id,
      editedBy: editor,
      editNote: note
    });
    if (typeof this.repository.replaceEvidenceSourceFactAtomic !== 'function') {
      throw new AppError('FACT_ATOMIC_PERSISTENCE_REQUIRED', 'Canonical Fact repository 未提供原子替换持久化边界。', 503);
    }
    return this.repository.replaceEvidenceSourceFactAtomic({ predecessorFactId: factId, replacement: edited });
  }

  isStale(current) {
    return current.contract_version !== this.contractVersion
      || (current.extractor_type === 'machine' && current.extractor_version !== this.extractorVersion)
      || current.evidence_review_status !== 'approved'
      || current.evidence_review_contract_version !== 'evidence-review-v1'
      || current.source_text_hash !== current.current_source_text_hash
      || sha(current.source_text) !== current.current_source_text_hash;
  }
}
