import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
import { isCurrentAllowClaim } from './writer-input-authorization-v1.js';

export const SAFE_RESPONSE_PACKET_VERSION = 'safe-response-packet-v1';

const list = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? '').trim();
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function requirementId(requirement) { return requirement?.requirement_id ?? requirement?.req_id ?? requirement?.canonical_requirement_id ?? null; }
function claimRequirementIds(claim) { return list(claim?.basis_requirement_ids || claim?.requirement_ids || (claim?.requirement_id ? [claim.requirement_id] : [])); }
function claimText(claim) { return text(claim?.claim_text ?? claim?.text); }

function sourceRef(requirement) {
  return {
    source_refs: list(requirement?.source_refs),
    source_hash: requirement?.source_hash ?? requirement?.source_evidence?.source_hash ?? null,
    source_chunk_id: requirement?.source_chunk_id ?? requirement?.source_evidence?.source_chunk_id ?? null,
    source_page: requirement?.source_page ?? null,
    source_page_start: requirement?.source_page_start ?? null,
    source_page_end: requirement?.source_page_end ?? null,
    source_paragraph_start: requirement?.source_paragraph_start ?? null,
    source_paragraph_end: requirement?.source_paragraph_end ?? null,
    source_verified: requirement?.source_verified === true,
    snapshot_id: requirement?.snapshot_id ?? requirement?.source_hash ?? null
  };
}

function assertionView(claim, gate) {
  return {
    claim_id: claim.claim_id,
    claim_type: claim.claim_type ?? null,
    text: claimText(claim),
    assertion_hash: claim.assertion_hash ?? claim.claim_assertion_hash ?? gate.claim_assertion_hash ?? null,
    gate_result_id: gate.gate_result_id,
    input_snapshot_hash: gate.input_snapshot_hash,
    allowed_scope: list(gate.allowed_scope || claim.allowed_scope).map(String).sort(),
    required_conditions: list(gate.required_conditions || claim.required_conditions).map(String).sort(),
    limitations: list(claim.limitations || gate.limitations).map(String).sort(),
    source_hashes: list(gate.source_hashes || claim.source_hashes).map(String).sort(),
    lineage_current: gate.lineage_current === true,
    writer_eligible: gate.writer_eligible === true
  };
}

function projectCommitment(fact) {
  return {
    project_fact_id: fact.project_fact_id,
    version: fact.version ?? null,
    key: fact.key ?? null,
    value: fact.value_status === 'pending' ? null : fact.value ?? null,
    value_status: fact.value_status ?? null,
    source_hash: fact.payload_hash ?? fact.source_hash ?? null,
    authority: 'PROJECT_SCOPED_APPROVED_CURRENT'
  };
}

export function buildSafeResponsePacket({
  projectId,
  requirement = {},
  responseDecision = {},
  projectContext = {},
  referenceContext = [],
  claims = [],
  gateResults = [],
  projectFacts = [],
  humanDecisions = [],
  citationRequirements = []
  ,responseUnitId = null
  ,requirementIds = []
} = {}) {
  const id = requirementId(requirement);
  if (!id) throw new AppError('SAFE_RESPONSE_PACKET_REQUIREMENT_REQUIRED', 'Safe Response Packet 缺少 Requirement identity。', 422);
  const mismatchedClaim = list(claims).find(claim => claim.project_id && String(claim.project_id) !== String(projectId));
  const mismatchedFact = list(projectFacts).find(fact => fact.project_id && String(fact.project_id) !== String(projectId));
  if (mismatchedClaim || mismatchedFact) throw new AppError('SAFE_RESPONSE_PACKET_CROSS_PROJECT_AUTHORITY', 'Safe Response Packet 拒绝跨项目 authority。', 422);

  const relevantClaims = list(claims).filter(claim => claimRequirementIds(claim).map(String).includes(String(id)) || String(claim.requirement_id || '') === String(id));
  const allowedEnterprise = [];
  const forbidden = [];
  for (const claim of relevantClaims) {
    const gate = list(gateResults).find(item => item.claim_id === claim.claim_id);
    if (gate && isCurrentAllowClaim(claim, gate) && claim.claim_type !== 'requirement_response') allowedEnterprise.push(assertionView(claim, gate));
    else if (claim.claim_type !== 'requirement_response') forbidden.push({ type: 'claim', claim_id: claim.claim_id, reason: 'CLAIM_NOT_CURRENTLY_AUTHORIZED' });
  }

  const allowedCommitments = list(projectFacts)
    .filter(fact => fact.fact_role === 'response_commitment' && fact.review_status === 'approved' && fact.conflict_status !== 'conflict' && fact.current !== false && fact.value_status !== 'pending')
    .map(projectCommitment);
  for (const fact of list(projectFacts)) {
    if (!allowedCommitments.some(item => item.project_fact_id === fact.project_fact_id) && fact.fact_role === 'response_commitment') forbidden.push({ type: 'project_commitment', project_fact_id: fact.project_fact_id, reason: 'PROJECT_COMMITMENT_NOT_CURRENT_APPROVED' });
  }

  const mode = Object.prototype.hasOwnProperty.call(responseDecision, 'response_mode') ? responseDecision.response_mode : 'NEED_REVIEW';
  const needsReview = responseDecision.decision_status === 'NEED_REVIEW' || mode === 'NEED_REVIEW' || mode === null;
  const risk = responseDecision.risk_tier ?? 'HIGH';
  const mandatory = requirement.is_mandatory === true || requirement.mandatory === true;
  const mustCover = responseDecision.response_required !== false || mandatory || ['P0', 'HIGH'].includes(risk) || responseDecision.is_scoring_related === true;
  const decisions = [...list(humanDecisions)];
  if (needsReview) decisions.push({ type: 'response_boundary', status: 'NEED_REVIEW', reason: 'ROUTER_ABSTENTION' });
  if (mode === 'EVIDENCE' && !allowedEnterprise.length) decisions.push({ type: 'evidence', status: 'WAITING_FOR_EVIDENCE', reason: 'APPROVED_ENTERPRISE_ASSERTION_REQUIRED' });
  if (mode === 'COMMITMENT' && !allowedCommitments.length) decisions.push({ type: 'commitment', status: 'WAITING_FOR_HUMAN_DECISION', reason: 'APPROVED_PROJECT_COMMITMENT_REQUIRED' });

  const body = {
    contract_version: SAFE_RESPONSE_PACKET_VERSION,
    project_id: projectId,
    requirement_id: id,
    requirement_ids: list(requirementIds).length ? [...new Set(requirementIds.map(String))].sort() : [String(id)],
    response_unit_id: responseUnitId,
    requirement_source: sourceRef(requirement),
    response_mode: mode,
    decision_status: responseDecision.decision_status ?? (mode === 'NEED_REVIEW' || mode === null ? 'NEED_REVIEW' : 'ROUTED'),
    readiness_status: responseDecision.readiness_status ?? null,
    risk_tier: risk,
    must_cover: mustCover,
    project_context: projectContext || {},
    reference_context: list(referenceContext).map(item => ({
      material_id: item.material_id ?? null,
      chunk_id: item.chunk_id ?? null,
      source_hash: item.chunk_hash ?? item.source_hash ?? null,
      text: item.source_text ?? item.text ?? '',
      source_type: 'CONTEXT_ONLY'
    })),
    allowed_enterprise_assertions: allowedEnterprise.sort((a, b) => String(a.claim_id).localeCompare(String(b.claim_id))),
    allowed_project_commitments: allowedCommitments.sort((a, b) => String(a.project_fact_id).localeCompare(String(b.project_fact_id))),
    forbidden_assertions: forbidden.sort((a, b) => `${a.type}:${a.claim_id || a.project_fact_id}`.localeCompare(`${b.type}:${b.claim_id || b.project_fact_id}`)),
    citation_requirements: list(citationRequirements).length ? list(citationRequirements) : [sourceRef(requirement)],
    human_decisions: decisions,
    authority: { status: 'PROJECTION_ONLY', creates_authority: false }
  };
  return { ...body, packet_hash: hash(body) };
}

export class SafeResponsePacketBuilder {
  build(input) { return buildSafeResponsePacket(input); }
}

export class SafeResponsePacketService {
  constructor({ repository, responseRouterService, builder = new SafeResponsePacketBuilder() } = {}) {
    this.repository = repository;
    this.responseRouterService = responseRouterService;
    this.builder = builder;
  }

  async get(projectId, requirementId) {
    const input = this.repository.getDocumentGenerationInput ? await this.repository.getDocumentGenerationInput(projectId) : null;
    if (!input?.baseline || input.baseline.status !== 'confirmed') throw new AppError('REQUIREMENT_BASELINE_REQUIRED', '请先确认 Requirement Baseline。', 409);
    const requirement = list(input.requirements).find(item => String(item.req_id) === String(requirementId) || String(item.id) === String(requirementId));
    if (!requirement) throw new AppError('REQUIREMENT_NOT_FOUND', 'Requirement 不存在。', 404);
    const decision = this.responseRouterService?.project(requirement, { baseline: input.baseline }) || {};
    const facts = this.repository.listProjectFacts ? await this.repository.listProjectFacts(projectId) : [];
    const gates = this.repository.listLatestClaimGateEvaluations ? await this.repository.listLatestClaimGateEvaluations(projectId) : [];
    const bindings = this.repository.listProjectFactPropagationBindings ? await this.repository.listProjectFactPropagationBindings(projectId) : [];
    const references = this.repository.listWriterReferenceChunks ? await this.repository.listWriterReferenceChunks({ projectId, queryText: requirement.text, materialTypes: ['technical_solution', 'technical_whitepaper'], limit: 4 }) : [];
    return this.builder.build({ projectId, requirement, responseDecision: decision, projectContext: input.project, referenceContext: references, claims: input.claims, gateResults: gates, projectFacts: facts, bindings });
  }
}
