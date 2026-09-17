import { AppError } from '../errors.js';
import { deriveReadinessStatus } from './response-decision-v1.js';

export const FINAL_REQUIREMENT_RECONCILIATION_VERSION = 'final-requirement-reconciliation-v1';
const list = value => Array.isArray(value) ? value : [];
const severityRank = value => ({ P0: 0, HIGH: 1, critical: 0, MEDIUM: 2, warning: 3, LOW: 4, pass: 5 }[String(value || '').toUpperCase()] ?? 4);
const requirementId = item => item?.req_id ?? item?.requirement_id ?? item?.canonical_requirement_id;

function source(requirement) {
  return {
    source_refs: list(requirement.source_refs),
    source_hash: requirement.source_hash ?? requirement.source_evidence?.source_hash ?? null,
    source_chunk_id: requirement.source_chunk_id ?? requirement.source_evidence?.source_chunk_id ?? null,
    source_page: requirement.source_page ?? null,
    source_page_start: requirement.source_page_start ?? null,
    source_page_end: requirement.source_page_end ?? null,
    source_verified: requirement.source_verified === true,
    snapshot_id: requirement.snapshot_id ?? requirement.source_hash ?? null
  };
}

export function buildFinalRequirementReconciliation({ projectId = null, requirements = [], responseDecisions = [], coverage = [], findings = [], unresolvedEvidence = [], unresolvedCommitments = [], generation = null, finalVersion = null, writerIdentity = null } = {}) {
  const decisions = new Map(list(responseDecisions).map(item => [String(item.requirement_id), item]));
  const coverageById = new Map(list(coverage).map(item => [String(item.requirement_id), item]));
  const writtenIds = new Set([
    ...list(finalVersion?.sections_json).flatMap(section => list(section.requirement_ids || section.covered_requirement_ids)),
    ...list(generation?.tasks).flatMap(task => list(task.covered_requirement_ids || task.input_snapshot?.covered_requirement_ids).concat(list(task.input_snapshot?.sections).flatMap(section => list(section.requirement_ids || section.covered_requirement_ids))))
  ].map(String));
  const rows = list(requirements).map(requirement => {
    const id = requirementId(requirement);
    const decision = decisions.get(String(id)) || {};
    const covered = coverageById.get(String(id)) || null;
    const rowFindings = list(findings).filter(item => list(item.requirement_ids || item.requirementIds || (item.requirement_id ? [item.requirement_id] : [])).map(String).includes(String(id)));
    const evidencePending = list(unresolvedEvidence).filter(item => String(item.requirement_id || item.requirement_ref || '') === String(id));
    const commitmentPending = list(unresolvedCommitments).filter(item => String(item.requirement_id || '') === String(id));
    const readiness_status = decision.readiness_status || deriveReadinessStatus(decision);
    const critical = rowFindings.some(item => ['P0', 'HIGH', 'critical'].includes(String(item.severity || item.risk || '').toUpperCase())) || decision.decision_status === 'NEED_REVIEW' || readiness_status === 'NEED_REVIEW';
    const humanAction = critical || evidencePending.length > 0 || commitmentPending.length > 0 || decision.human_required === true || covered?.covered === false;
    return {
      requirement_id: id,
      tender_project_id: projectId,
      requirement_text: requirement.text ?? requirement.content ?? '',
      source: source(requirement),
      risk_tier: decision.risk_tier ?? null,
      response_mode: decision.response_mode ?? null,
      decision_status: decision.decision_status ?? (decision.response_mode ? 'ROUTED' : 'NEED_REVIEW'),
      readiness_status,
      response_required: decision.response_required !== false,
      must_cover: decision.must_cover ?? (requirement.is_mandatory === true),
      coverage_state: covered ? (covered.covered ? 'COVERED' : 'UNCOVERED') : 'UNKNOWN',
      written_coverage_status: decision.response_required === false || decision.response_mode === 'COMPLIANCE' ? 'NOT_APPLICABLE' : writtenIds.has(String(id)) ? 'COVERED' : 'NOT_COVERED',
      findings: rowFindings.sort((a, b) => severityRank(a.severity || a.risk) - severityRank(b.severity || b.risk)),
      unresolved_evidence: evidencePending,
      unresolved_commitment_or_human_decision: commitmentPending,
      writer_generation_identity: writerIdentity || generation?.rule_versions?.writer_authorization_snapshot_hash || null,
      final_version_identity: finalVersion ? { version_id: finalVersion.id ?? null, version_number: finalVersion.version_number ?? null, status: finalVersion.status ?? null } : null,
      human_action_required: humanAction,
      state: humanAction ? (critical ? 'BLOCKED' : 'REVIEW_REQUIRED') : 'READY'
    };
  }).sort((a, b) => severityRank(a.risk_tier) - severityRank(b.risk_tier) || String(a.requirement_id).localeCompare(String(b.requirement_id)));
  const blocked = rows.filter(item => item.state === 'BLOCKED').length;
  const review = rows.filter(item => item.state === 'REVIEW_REQUIRED').length;
  const required = rows.filter(item => item.response_required).length;
  const ready = rows.filter(item => item.readiness_status === 'READY_FOR_WRITER').length;
  const needReview = rows.filter(item => item.readiness_status === 'NEED_REVIEW').length;
  const writtenCovered = rows.filter(item => item.written_coverage_status === 'COVERED').length;
  const writtenNotCovered = rows.filter(item => item.written_coverage_status === 'NOT_COVERED').length;
  const complianceAction = rows.filter(item => item.readiness_status === 'COMPLIANCE_ACTION_REQUIRED').length;
  return {
    contract_version: FINAL_REQUIREMENT_RECONCILIATION_VERSION,
    project_id: projectId,
    generation_id: generation?.id ?? null,
    final_version_id: finalVersion?.id ?? null,
    status: blocked ? 'BLOCKED' : review ? 'REVIEW_REQUIRED' : 'READY',
    summary: { total: rows.length, required, blocked, review_required: review, ready: rows.length - blocked - review, ready_for_writer: ready, need_review: needReview, written_covered: writtenCovered, written_not_covered: writtenNotCovered, compliance_action_required: complianceAction },
    requirements: rows,
    authority: { creates_authority: false, semantic_judgment: false }
  };
}

export class FinalRequirementReconciliationService {
  constructor({ repository, responseRouterService, reviewCenterService } = {}) { this.repository = repository; this.responseRouterService = responseRouterService; this.reviewCenterService = reviewCenterService; }

  async get(projectId, versionId = null) {
    if (!this.repository?.getDocumentGenerationInput) throw new AppError('RECONCILIATION_UNAVAILABLE', 'Final Requirement Reconciliation 服务尚未配置。', 503);
    const input = await this.repository.getDocumentGenerationInput(projectId);
    if (!input?.baseline) throw new AppError('REQUIREMENT_BASELINE_REQUIRED', '请先确认 Requirement Baseline。', 409);
    const projectFacts = this.repository.listProjectFacts ? await this.repository.listProjectFacts(projectId) : [];
    const decisions = list(input.requirements).map(requirement => {
      const relatedClaims = list(input.claims).filter(claim => list(claim.basis_requirement_ids || claim.requirement_ids || [claim.requirement_id]).map(String).includes(String(requirement.req_id)));
      return this.responseRouterService?.project(requirement, { baseline: input.baseline, claims: relatedClaims, projectFacts }) || {};
    });
    const reviewCenter = this.reviewCenterService?.get ? await this.reviewCenterService.get(projectId) : {};
    const generations = this.repository.listDocumentGenerations ? await this.repository.listDocumentGenerations(projectId) : [];
    const generation = generations[0] || null;
    const finalVersion = versionId && this.repository.getPipelineDocumentVersion ? await this.repository.getPipelineDocumentVersion(versionId) : (this.repository.listVersions ? (await this.repository.listVersions(projectId))[0] : null);
    const findings = [
      ...(finalVersion?.validation_errors || []),
      ...(finalVersion?.warnings_json || []),
      ...(generation?.tasks || []).filter(item => item.error_code).map(item => ({ ...item, severity: 'HIGH' }))
    ];
    const unresolvedEvidence = [...list(reviewCenter?.evidence), ...list(reviewCenter?.evidence_facts), ...list(reviewCenter?.mappings)].filter(item => ['draft', 'needs_review', 'proposed', 'unknown', 'insufficient'].includes(String(item.status || item.review_status || item.support_level)));
    const unresolvedCommitments = list(reviewCenter?.project_facts).filter(item => ['needs_review', 'conflict', 'pending'].includes(String(item.status || item.review_status)));
    return buildFinalRequirementReconciliation({ projectId, requirements: input.requirements, responseDecisions: decisions, coverage: input.coverage, findings, unresolvedEvidence, unresolvedCommitments, generation, finalVersion, writerIdentity: generation?.rule_versions?.writer_authorization_snapshot_hash || null });
  }
}
