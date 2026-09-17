import { AppError } from '../errors.js';
import { projectResponseDecisionV1, RESPONSE_DECISION_V1_VERSION } from './response-decision-v1.js';
import { RESPONSE_ROUTER_V223_IMPLEMENTATION_ID, RESPONSE_ROUTER_V223_VERSION } from './requirement-response-router-v2-2-3.js';

export const RESPONSE_ROUTER_SERVICE_VERSION = 'v43-response-router-service-v1';

const list = value => Array.isArray(value) ? value : [];

function sourceIdentity(requirement = {}, baseline = {}) {
  const evidence = requirement.source_evidence || {};
  return {
    baseline_id: baseline.id ?? requirement.baseline_id ?? null,
    parse_job_id: baseline.parse_job_id ?? requirement.parse_job_id ?? null,
    source_hash: requirement.source_hash ?? evidence.source_hash ?? null,
    source_chunk_id: requirement.source_chunk_id ?? evidence.source_chunk_id ?? null,
    source_excerpt: requirement.source_excerpt ?? evidence.source_excerpt ?? null,
    source_page: requirement.source_page ?? null,
    source_page_start: requirement.source_page_start ?? null,
    source_page_end: requirement.source_page_end ?? null,
    source_paragraph: requirement.source_paragraph ?? null,
    source_paragraph_start: requirement.source_paragraph_start ?? null,
    source_paragraph_end: requirement.source_paragraph_end ?? null,
    source_paragraphs: list(requirement.source_paragraphs_json),
    source_match_type: requirement.source_match_type ?? null,
    source_resolution_method: requirement.source_resolution_method ?? null,
    source_verified: requirement.source_verified === true,
    source_status: requirement.source_status ?? null,
    snapshot_id: requirement.snapshot_id ?? evidence.snapshot_id ?? requirement.source_hash ?? null
  };
}

function nextAction(decision) {
  if (decision.decision_status === 'NEED_REVIEW' || decision.human_required) return 'HUMAN_REVIEW';
  if (decision.response_mode === 'EVIDENCE') return 'EVIDENCE_REVIEW';
  if (decision.response_mode === 'COMMITMENT') return 'PROJECT_DECISION';
  if (decision.response_mode === 'COMPLIANCE') return 'COMPLIANCE_REVIEW';
  return 'SAFE_RESPONSE_PACKET';
}

export function projectResponseDecision(requirement, baseline = null, context = {}) {
  const decision = projectResponseDecisionV1(requirement, context);
  return {
    ...decision,
    next_action: nextAction(decision),
    authority: {
      status: 'ADVISORY_ONLY',
      granted: false,
      source: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
      semantic_authority: 'BACKEND_DOMAIN_SERVICES_AND_HUMAN_REVIEW'
    },
    router: {
      service_version: RESPONSE_ROUTER_SERVICE_VERSION,
      projection_version: RESPONSE_ROUTER_V223_VERSION,
      implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
      contract_version: RESPONSE_DECISION_V1_VERSION
    },
    source_identity: sourceIdentity(requirement, baseline || {})
  };
}

export class ResponseRouterService {
  constructor({ repository } = {}) { this.repository = repository; }

  async get(projectId, requirementId) {
    if (!this.repository) throw new AppError('RESPONSE_ROUTER_UNAVAILABLE', 'Response Router 服务尚未配置。', 503);
    const project = this.repository.getProject ? await this.repository.getProject(projectId) : { id: projectId };
    if (!project) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    const baseline = this.repository.getRequirementBaseline ? await this.repository.getRequirementBaseline(projectId) : null;
    if (!baseline || baseline.status !== 'confirmed') throw new AppError('REQUIREMENT_BASELINE_REQUIRED', '请先确认 Requirement Baseline。', 409);
    const requirement = list(baseline.requirements).find(item => String(item.req_id) === String(requirementId) || String(item.id) === String(requirementId));
    if (!requirement) throw new AppError('REQUIREMENT_NOT_FOUND', 'Requirement 不存在。', 404);
    const decision = projectResponseDecision(requirement, baseline);
    return {
      project_id: projectId,
      requirement: {
        requirement_id: requirement.req_id,
        text: requirement.text ?? requirement.content ?? '',
        category: requirement.requirement_category ?? requirement.category ?? null,
        mandatory: requirement.is_mandatory === true,
        source_refs: list(requirement.source_refs),
        source_identity: decision.source_identity
      },
      decision
    };
  }

  project(requirement, context = {}) { return projectResponseDecision(requirement, context.baseline || null, context); }
}
