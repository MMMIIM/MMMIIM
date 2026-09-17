import { buildFinalRequirementReconciliation } from './final-requirement-reconciliation.js';
import { buildBidResponseMatrix } from './bid-response-matrix-v1.js';

const list = value => Array.isArray(value) ? value : [];
const rank = value => ({ P0: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[String(value || '').toUpperCase()] ?? 4);

export function buildComplianceMatrix({ requirements = [], responseDecisions = [], coverage = [], findings = [] } = {}) {
  const decisions = new Map(list(responseDecisions).map(item => [String(item.requirement_id), item]));
  const coverageById = new Map(list(coverage).map(item => [String(item.requirement_id), item]));
  return list(requirements).map(requirement => {
    const id = requirement.req_id ?? requirement.requirement_id;
    const decision = decisions.get(String(id)) || {};
    const rowFindings = list(findings).filter(item => list(item.requirement_ids || (item.requirement_id ? [item.requirement_id] : [])).map(String).includes(String(id)));
    const critical = decision.risk_tier === 'P0' || decision.risk_tier === 'HIGH' || requirement.is_mandatory === true || rowFindings.some(item => ['P0', 'HIGH', 'critical'].includes(String(item.severity || item.risk || '').toUpperCase()));
    return {
      requirement_id: id,
      source: { source_hash: requirement.source_hash ?? null, source_chunk_id: requirement.source_chunk_id ?? null, source_verified: requirement.source_verified === true },
      risk: decision.risk_tier ?? null,
      mandatory: requirement.is_mandatory === true,
      p0: decision.risk_tier === 'P0',
      response_required: decision.response_required !== false,
      current_state: coverageById.has(String(id)) ? (coverageById.get(String(id)).covered ? 'COVERED' : 'UNCOVERED') : 'UNKNOWN',
      reason: decision.routing_reasons || [],
      human_action_required: critical || decision.human_required === true || rowFindings.length > 0,
      findings: rowFindings
    };
  }).sort((a, b) => rank(a.risk) - rank(b.risk) || String(a.requirement_id).localeCompare(String(b.requirement_id)));
}

export function buildGateATasks({ reviewCenter = {}, reconciliation = {} } = {}) {
  const tasks = list(reviewCenter.pending).map(item => ({
    task_id: `${item.kind}:${item.id}`,
    kind: item.kind,
    source_id: item.id,
    requirement_id: item.requirement_id ?? null,
    severity: item.status === 'conflict' || item.status === 'reject' ? 'P0' : item.status === 'needs_review' ? 'HIGH' : 'MEDIUM',
    reason: item.reason || '需要人工处理',
    action: item.kind === 'evidence_fact' ? '企业证据复核' : item.kind === 'project_fact' ? '项目事实确认' : item.kind === 'claim' ? 'Claim 审核' : '审核中心',
    authority_mutation: false
  }));
  for (const item of list(reconciliation.requirements)) if (item.human_action_required && !tasks.some(task => task.requirement_id === item.requirement_id)) tasks.push({ task_id: `requirement:${item.requirement_id}`, kind: 'requirement_reconciliation', source_id: item.requirement_id, requirement_id: item.requirement_id, severity: item.risk_tier || 'HIGH', reason: item.state === 'BLOCKED' ? '存在未解决的关键校验问题。' : '需要人工完成最终需求核对。', action: '最终需求核对', authority_mutation: false });
  return tasks.sort((a, b) => rank(a.severity) - rank(b.severity) || String(a.task_id).localeCompare(String(b.task_id)));
}

export class FlowProjectionService {
  constructor({ repository, responseRouterService, reviewCenterService, reconciliationService } = {}) { Object.assign(this, { repository, responseRouterService, reviewCenterService, reconciliationService }); }
  async getCompliance(projectId) {
    const input = await this.repository.getDocumentGenerationInput(projectId);
    const decisions = list(input.requirements).map(item => this.responseRouterService.project(item, { baseline: input.baseline }));
    const review = this.reviewCenterService?.get ? await this.reviewCenterService.get(projectId) : {};
    return { project_id: projectId, rows: buildComplianceMatrix({ requirements: input.requirements, responseDecisions: decisions, coverage: input.coverage, findings: review.pending }), authority: { creates_authority: false } };
  }
  async getBidResponseMatrix(projectId) {
    const input = await this.repository.getDocumentGenerationInput(projectId);
    const [projectFacts, mappings, review] = await Promise.all([
      this.repository.listProjectFacts ? this.repository.listProjectFacts(projectId) : [],
      this.repository.listRequirementEvidenceFactMappings ? this.repository.listRequirementEvidenceFactMappings(projectId) : [],
      this.reviewCenterService?.get ? this.reviewCenterService.get(projectId) : {}
    ]);
    const decisions = list(input.requirements).map((item) => this.responseRouterService.project(item, { baseline: input.baseline }));
    return {
      project_id: projectId,
      contract_version: 'bid-response-matrix-v1',
      rows: buildBidResponseMatrix({ requirements: input.requirements, responseDecisions: decisions, claims: input.claims, projectFacts, mappings, findings: review.pending }),
      authority: { creates_authority: false }
    };
  }
  async getTasks(projectId) {
    const reconciliation = await this.reconciliationService.get(projectId);
    const review = this.reviewCenterService?.get ? await this.reviewCenterService.get(projectId) : {};
    return { project_id: projectId, tasks: buildGateATasks({ reviewCenter: review, reconciliation }), authority: { creates_authority: false } };
  }
}
