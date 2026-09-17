import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeResponsePacket, SAFE_RESPONSE_PACKET_VERSION } from '../src/pipeline/safe-response-packet-builder.js';
import { buildFinalRequirementReconciliation } from '../src/pipeline/final-requirement-reconciliation.js';
import { buildComplianceMatrix, buildGateATasks } from '../src/pipeline/flow-projection-service.js';
import { ResponseRouterService } from '../src/pipeline/response-router-service.js';
import { createApp } from '../src/app.js';
import { buildGenerationBatches } from '../src/pipeline/writer-generation-batch-builder-v2.js';

const PROJECT = 'PROJECT-FLOW-1';
const requirement = (overrides = {}) => ({
  req_id: 'REQ-FLOW-1',
  text: '系统应支持审计日志。',
  requirement_category: 'technical',
  source_hash: 'a'.repeat(64),
  source_chunk_id: 'chunk-1',
  source_verified: true,
  ...overrides
});

const allowedClaim = (overrides = {}) => ({
  project_id: PROJECT,
  claim_id: 'CLM-FLOW-1',
  requirement_id: 'REQ-FLOW-1',
  claim_type: 'evidence_support',
  text: '企业具备审计日志能力。',
  assertion_hash: 'b'.repeat(64),
  current: true,
  ...overrides
});

const allowGate = (overrides = {}) => ({
  claim_id: 'CLM-FLOW-1',
  decision: 'allow',
  writer_eligible: true,
  lineage_current: true,
  claim_assertion_hash: 'b'.repeat(64),
  gate_result_id: 'GATE-FLOW-1',
  input_snapshot_hash: 'c'.repeat(64),
  current: true,
  ...overrides
});

test('Response Router service is project scoped and advisory only', async () => {
  const repository = {
    async getProject(id) { return { id }; },
    async getRequirementBaseline() { return { id: 'BASE-1', status: 'confirmed', parse_job_id: 'JOB-1', requirements: [requirement()] }; }
  };
  const service = new ResponseRouterService({ repository });
  const first = await service.get(PROJECT, 'REQ-FLOW-1');
  const second = await service.get(PROJECT, 'REQ-FLOW-1');
  assert.deepEqual(first, second);
  assert.equal(first.decision.authority.status, 'ADVISORY_ONLY');
  assert.equal(first.decision.authority.granted, false);
  assert.equal(first.requirement.source_identity.parse_job_id, 'JOB-1');
});

test('production response-decision endpoint performs no mutation and keeps NEED_REVIEW', async () => {
  const calls = [];
  const repository = {
    async getProject(id) { return { id }; },
    async getRequirementBaseline() { return { id: 'BASE-1', status: 'confirmed', requirements: [requirement({ text: '以及但应当' })] }; }
  };
  const service = new ResponseRouterService({ repository });
  const app = createApp({ repository, responseRouterService: service, actorResolver: () => ({ actor_id: 'flow-test', actor_type: 'test' }), projectAuthorizationService: { assertProjectAccess: async () => { calls.push('auth'); } } });
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/${PROJECT}/requirements/REQ-FLOW-1/response-decision`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.decision.decision_status, 'NEED_REVIEW');
    assert.equal(payload.data.decision.response_mode, null);
    assert.equal(payload.data.decision.response_mode_legacy, 'NEED_REVIEW');
    assert.equal(calls.length, 0);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('Safe Response Packet exposes only current approved enterprise claims and approved commitments', () => {
  const packet = buildSafeResponsePacket({
    projectId: PROJECT,
    requirement: requirement(),
    responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH', response_required: true },
    projectContext: { id: PROJECT, name: 'flow' },
    referenceContext: [{ material_id: 'REF-1', chunk_id: 'CH-1', source_text: '参考方案' }],
    claims: [allowedClaim(), allowedClaim({ claim_id: 'CLM-FLOW-2', decision: 'rejected', assertion_hash: 'd'.repeat(64) })],
    gateResults: [allowGate()],
    projectFacts: [{ project_id: PROJECT, project_fact_id: 'PF-1', fact_role: 'response_commitment', review_status: 'approved', conflict_status: 'none', value_status: 'known', value: '提供服务' }]
  });
  assert.equal(packet.contract_version, SAFE_RESPONSE_PACKET_VERSION);
  assert.deepEqual(packet.allowed_enterprise_assertions.map(item => item.claim_id), ['CLM-FLOW-1']);
  assert.deepEqual(packet.allowed_project_commitments.map(item => item.project_fact_id), ['PF-1']);
  assert.equal(packet.reference_context[0].source_type, 'CONTEXT_ONLY');
  assert.equal(packet.forbidden_assertions.some(item => item.claim_id === 'CLM-FLOW-2'), true);
  assert.match(packet.packet_hash, /^[a-f0-9]{64}$/);
});

test('Safe Response Packet fails closed for cross-project authority and missing evidence', () => {
  assert.throws(() => buildSafeResponsePacket({ projectId: PROJECT, requirement: requirement(), responseDecision: { response_mode: 'EVIDENCE' }, claims: [allowedClaim({ project_id: 'OTHER' })] }), { code: 'SAFE_RESPONSE_PACKET_CROSS_PROJECT_AUTHORITY' });
  const packet = buildSafeResponsePacket({ projectId: PROJECT, requirement: requirement(), responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH' } });
  assert.equal(packet.allowed_enterprise_assertions.length, 0);
  assert.equal(packet.human_decisions[0].status, 'WAITING_FOR_EVIDENCE');
});

test('Final reconciliation preserves source identity, unresolved states and version identity', () => {
  const result = buildFinalRequirementReconciliation({
    projectId: PROJECT,
    requirements: [requirement()],
    responseDecisions: [{ requirement_id: 'REQ-FLOW-1', response_mode: 'EVIDENCE', risk_tier: 'P0', must_cover: true }],
    coverage: [{ requirement_id: 'REQ-FLOW-1', covered: false }],
    findings: [{ requirement_id: 'REQ-FLOW-1', severity: 'P0', code: 'MISSING_CLAIM' }],
    unresolvedEvidence: [{ requirement_id: 'REQ-FLOW-1', status: 'needs_review' }],
    generation: { id: 'GEN-1', rule_versions: { writer_authorization_snapshot_hash: 'AUTH-1' } },
    finalVersion: { id: 'VER-1', version_number: 2, status: 'pending_review' }
  });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.requirements[0].source.source_chunk_id, 'chunk-1');
  assert.equal(result.requirements[0].writer_generation_identity, 'AUTH-1');
  assert.equal(result.requirements[0].final_version_identity.version_id, 'VER-1');
});

test('Compliance projection keeps mandatory/P0 requirement visible when response_required is false', () => {
  const [row] = buildComplianceMatrix({
    requirements: [requirement({ is_mandatory: true })],
    responseDecisions: [{ requirement_id: 'REQ-FLOW-1', response_required: false, risk_tier: 'P0', human_required: true }],
    coverage: []
  });
  assert.equal(row.response_required, false);
  assert.equal(row.p0, true);
  assert.equal(row.human_action_required, true);
});

test('Gate A projection remains read-only and sorts critical work first', () => {
  const tasks = buildGateATasks({ reviewCenter: { pending: [{ kind: 'evidence_fact', id: 'EF-1', requirement_id: 'REQ-1', status: 'needs_review', reason: 'fact' }, { kind: 'claim', id: 'CL-1', requirement_id: 'REQ-2', status: 'reject', reason: 'claim' }] }, reconciliation: { requirements: [] } });
  assert.equal(tasks[0].severity, 'P0');
  assert.equal(tasks.every(item => item.authority_mutation === false), true);
});

test('Writer batch carries Safe Response Packet identity without changing authority', () => {
  const [batch] = buildGenerationBatches({ plan: { sections: [{ section_id: 'chapter-1', parent_id: null, title: '方案', role: 'technical_bid_section', requirement_ids: ['REQ-FLOW-1'] }] }, sectionContexts: [{ section: { section_id: 'chapter-1', parent_id: null, title: '方案', role: 'technical_bid_section', requirement_ids: ['REQ-FLOW-1'] }, requirements: [{ req_id: 'REQ-FLOW-1', text: '需求', requirement_category: 'technical' }], approved_claims: [], authorized_enterprise_claims: [], authorized_project_responses: [], project_facts: [], reference_materials: [], context_only_references: [], safe_response_packets: [{ requirement_id: 'REQ-FLOW-1', packet_hash: 'e'.repeat(64) }], safe_response_packet_hash: 'f'.repeat(64) }] });
  assert.equal(batch.input.sections[0].safe_response_packet_hash, 'f'.repeat(64));
  assert.equal(batch.input.sections[0].safe_response_packets[0].packet_hash, 'e'.repeat(64));
});
