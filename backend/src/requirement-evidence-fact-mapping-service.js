import { AppError } from './errors.js';
import {
  createRequirementEvidenceMapping,
  ProviderNeutralMappingEvaluator,
  REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION
} from './pipeline/requirement-evidence-mapping-contract-v1.js';
import { MappingCandidateBuilder } from './pipeline/mapping-candidate-builder.js';
import { applyMappingDecisionPolicy } from './pipeline/mapping-decision-policy-v1.js';
import {
  hasMaterialSourceRoleData,
  resolveMaterialSourceRole,
  materialAuthorityAllowedForMode
} from './pipeline/material-source-authority-policy.js';

export class RequirementEvidenceFactMappingService {
  constructor({
    repository,
    evaluator = new ProviderNeutralMappingEvaluator(),
    candidateBuilder = null,
    contractVersion = REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION,
    evaluatorVersion = evaluator.version || 'provider-neutral-mapping-stub-v1',
    authorityMode = 'PRODUCTION'
  }) {
    this.repository = repository;
    this.evaluator = evaluator;
    this.candidateBuilder = candidateBuilder || null;
    this.contractVersion = contractVersion;
    this.evaluatorVersion = evaluatorVersion;
    this.authorityMode = authorityMode;
  }

  async propose({ projectId, requirementId, factId, sourceType = 'system_proposed' }) {
    const context = await this.repository.getRequirementEvidenceFactMappingContext({ projectId, requirementId, factId });
    if (!context) throw new AppError('MAPPING_TARGET_NOT_FOUND', 'Requirement 或 Evidence Fact 不存在。', 404);
    const material = context.material_id && typeof this.repository.getCompanyMaterial === 'function'
      ? await this.repository.getCompanyMaterial(context.material_id)
      : null;
    const authorityContext = material ? { ...context, ...material } : context;
    if (context.source_material_authority_eligible === false || context.current_authority === false) {
      throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', 'Evidence Fact 的来源材料当前已被隔离，不能建立当前 Mapping。', 409);
    }
    if (!materialAuthorityAllowedForMode(authorityContext, { authorityMode: this.authorityMode })) {
      throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE', 'Synthetic 材料仅可在隔离 Eval authority 中建立 Mapping。', 422);
    }
    if (hasMaterialSourceRoleData(authorityContext)
      && resolveMaterialSourceRole(authorityContext).role === 'REFERENCE_ONLY') {
      throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN', '参考资料不能进入 Mapping authority。', 422);
    }
    // Keep the legacy single-pair entry point compatible with the shared
    // requirement-level evaluator: it receives one Requirement plus a
    // one-element Fact batch, while Provider-neutral fixture evaluators may
    // continue to consume the original flat context shape.
    const evaluation = await this.evaluator.evaluate(Object.freeze({
      ...authorityContext,
      requirement: authorityContext.requirement || authorityContext,
      facts: Array.isArray(authorityContext.facts) ? authorityContext.facts : [authorityContext]
    }));
    const candidate = Array.isArray(evaluation)
      ? evaluation.find(item => item?.evidence_fact_id === context.fact_id || item?.fact_id === context.fact_id) || evaluation[0]
      : evaluation;
    if (!candidate) throw new AppError('MAPPING_EVALUATION_REQUIRED', 'Provider-neutral evaluator 未提供 Mapping Candidate。', 422);
    const value = createRequirementEvidenceMapping(
      authorityContext,
      { ...candidate, source_type: sourceType },
      { contractVersion: this.contractVersion, evaluatorVersion: this.evaluatorVersion }
    );
    if (typeof this.repository.replaceRequirementEvidenceFactMappingAtomic !== 'function') {
      throw new AppError('MAPPING_ATOMIC_PERSISTENCE_REQUIRED', 'Canonical Mapping repository 未提供原子替换持久化边界。', 503);
    }
    return this.repository.replaceRequirementEvidenceFactMappingAtomic(value);
  }

  /**
   * Requirement-level producer entry point. It prepares the complete set of
   * approved/current facts, evaluates every batch, then persists the set in one
   * repository transaction. Human mappings are carried forward unchanged.
   */
  async produceForRequirement({ projectId, requirementId, evidenceNeedProfile = null } = {}) {
    const builder = this.candidateBuilder || (this.repository?.getMappingCandidateContext
      ? new MappingCandidateBuilder({ repository: this.repository, authorityMode: this.authorityMode }) : null);
    if (!builder) throw new AppError('MAPPING_CANDIDATE_BUILDER_REQUIRED', 'Requirement-level Mapping candidate builder 未配置。', 503);
    const candidateSet = await builder.build({ projectId, requirementId });
    if (candidateSet.facts.length === 0) return { mappings: [], status: 'NO_APPROVED_CURRENT_FACTS' };
    if (typeof this.repository.replaceRequirementEvidenceFactMappingSetAtomic !== 'function') {
      throw new AppError('MAPPING_ATOMIC_PERSISTENCE_REQUIRED', 'Canonical Mapping repository 未提供 Requirement-level 原子替换边界。', 503);
    }

    const existing = typeof this.repository.listRequirementEvidenceFactMappings === 'function'
      ? await this.repository.listRequirementEvidenceFactMappings(projectId)
      : [];
    const existingForRequirement = (existing || []).filter(item => (
      item.requirement_identifier === requirementId || item.requirement_id === requirementId
    ));
    const humanMappings = existingForRequirement.filter(item => (
      item.reviewer_type === 'human' && item.review_status !== 'invalidated' && item.mapping_current !== false
    ));
    const currentMachine = existingForRequirement.filter(item => (
      item.reviewer_type === 'machine'
      && item.review_status !== 'invalidated'
      && item.contract_version === this.contractVersion
      && item.evaluator_version === this.evaluatorVersion
      && item.mapping_current !== false
    ));
    const currentFacts = new Set(candidateSet.facts.map(fact => fact.fact_id));
    if (currentMachine.length === currentFacts.size
      && currentMachine.every(item => currentFacts.has(item.evidence_fact_id))) {
      return { mappings: existingForRequirement, status: 'IDEMPOTENT_REPLAY' };
    }
    const evaluated = await this.evaluator.evaluate({
      requirement: candidateSet.requirement,
      facts: candidateSet.facts,
      upstream_support_level: candidateSet.upstream_support_level,
      upstream_allows_full: candidateSet.upstream_support_level !== 'conflict',
      evidenceNeedProfile
    });
    if (!Array.isArray(evaluated)) throw new AppError('MAPPING_EVALUATION_REQUIRED', 'Mapping semantic evaluator 未返回结果集。', 422);

    const factsById = new Map(candidateSet.facts.map(fact => [fact.fact_id, fact]));
    const mappings = [];
    for (const candidate of evaluated) {
      const factId = candidate.evidence_fact_id || candidate.fact_id;
      const fact = factsById.get(factId);
      if (!fact) throw new AppError('MAPPING_RESULT_SET_INVALID', 'Mapping result 引用了未提供的 Evidence Fact。', 422);
      const context = { ...fact, ...candidate, fact_id: fact.fact_id, evidence_fact_id: fact.fact_id };
      const canonical = createRequirementEvidenceMapping(
        context,
        { ...candidate, source_type: 'system_proposed' },
        { contractVersion: this.contractVersion, evaluatorVersion: this.evaluatorVersion, reviewerType: 'machine' }
      );
      mappings.push(applyMappingDecisionPolicy(canonical, {
        requirement: candidateSet.requirement,
        upstream_support_level: candidateSet.upstream_support_level,
        upstream_allows_full: candidateSet.upstream_support_level !== 'conflict'
      }));
    }

    const preservedIds = humanMappings.map(item => item.mapping_id).sort();
    const machineFactIds = new Set(mappings.map(item => item.evidence_fact_id));
    for (const human of humanMappings) {
      if (!machineFactIds.has(human.evidence_fact_id)) mappings.push(human);
    }
    mappings.sort((left, right) => String(left.evidence_fact_id).localeCompare(String(right.evidence_fact_id)));
    const persisted = await this.repository.replaceRequirementEvidenceFactMappingSetAtomic({
      projectId,
      requirementId,
      mappings,
      preserve_mapping_ids: preservedIds,
      contractVersion: this.contractVersion,
      evaluatorVersion: this.evaluatorVersion
    });
    return { mappings: persisted, status: 'PRODUCED' };
  }

  async decide(mappingId, decision, { reviewer, note = null } = {}) {
    if (!['approve', 'reject'].includes(decision)) throw new AppError('MAPPING_DECISION_INVALID', 'Mapping 决定必须为 approve 或 reject。', 422);
    if (!String(reviewer || '').trim()) throw new AppError('MAPPING_REVIEWER_REQUIRED', 'Mapping 审核人不能为空。', 422);
    const current = await this.repository.getRequirementEvidenceFactMappingCurrent(mappingId);
    if (!current) throw new AppError('MAPPING_NOT_FOUND', 'Mapping 不存在。', 404);
    const material = current.material_id && typeof this.repository.getCompanyMaterial === 'function'
      ? await this.repository.getCompanyMaterial(current.material_id)
      : null;
    const authorityCurrent = material ? { ...current, ...material } : current;
    if (!materialAuthorityAllowedForMode(authorityCurrent, { authorityMode: this.authorityMode })) {
      throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE', 'Synthetic 材料仅可在隔离 Eval authority 中批准 Mapping。', 422);
    }
    if (this.isStale(authorityCurrent)) {
      await this.repository.invalidateRequirementEvidenceFactMapping(mappingId);
      throw new AppError('MAPPING_INVALIDATED', 'Requirement、Fact 或版本已经变化。', 409);
    }
    if (current.review_status !== 'proposed') throw new AppError('MAPPING_ALREADY_DECIDED', 'Mapping 已完成人工决定。', 409);
    return this.repository.decideRequirementEvidenceFactMapping({
      mappingId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewer: String(reviewer).trim(),
      note
    });
  }

  isStale(current) {
    return current.contract_version !== this.contractVersion
      || current.evaluator_version !== this.evaluatorVersion
      || current.current_requirement_hash !== current.requirement_hash
      || current.current_requirement_contract_version !== current.requirement_contract_version
      || current.fact_review_status !== 'approved'
      || current.current_fact_payload_hash !== current.fact_payload_hash
      || current.current_fact_contract_version !== current.fact_contract_version
      || current.source_material_authority_eligible === false
      || (hasMaterialSourceRoleData(current)
        && resolveMaterialSourceRole(current).role === 'REFERENCE_ONLY')
      || current.requirement_valid !== true;
  }
}
