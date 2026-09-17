import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';
import { buildWriterAuthorizationSnapshot, writerAuthorizationSnapshotHash } from '../src/pipeline/writer-authorization-snapshot.js';
import { createApp } from '../src/app.js';

const PROJECT = '00000000-0000-4000-8000-000000000091';
const requirement = (overrides = {}) => ({
  req_id: 'REQ-AUTH-001',
  text: '系统应提供审计日志。',
  requirement_category: 'technical',
  writer_eligible: true,
  is_mandatory: false,
  source_status: 'verified',
  requirement_hash: 'a'.repeat(64),
  canonical_rule_version: 'canonical-requirement-v1',
  ...overrides
});

test('P1-001 production Claim persistence retains a current authorization identity for requirement_response', async () => {
  let plans = [];
  let persisted = null;
  let claims = [];
  const repository = {
    async getProject() { return { id: PROJECT }; },
    async getRequirementBaseline() { return { id: 'BASELINE-1' }; },
    async getFormalRequirements() { return [requirement()]; },
    async listApprovedEvidence() { return []; },
    async replaceResponsePlans(_projectId, input) { plans = input.plans; },
    async listResponsePlans() { return { plans, constraint_records: [] }; },
    async getApprovedRequirementFactSupport() { return []; },
    async replaceClaimsAndCoverage(_projectId, input) {
      persisted = input;
      claims = input.evaluatedClaims.map(item => ({ ...item.claim, ...item.decision, v2_evaluation: item.v2_evaluation }));
    },
    async listClaims() { return claims; },
    async listCoverage() { return []; },
    async saveProductionBetaFailure() {}
  };
  const service = new ProductionBetaService({ repository });
  await service.generatePlans(PROJECT);
  await service.generateClaims(PROJECT);
  const response = persisted.evaluatedClaims.find(item => item.claim.claim_type === 'requirement_response');
  assert.ok(response?.v2_evaluation, 'requirement_response must persist canonical Gate authorization identity');
  assert.equal(response.v2_evaluation.decision, 'allow');
  assert.equal(response.v2_evaluation.writer_eligible, true);
  assert.match(response.v2_evaluation.claim_assertion_hash, /^[a-f0-9]{64}$/);
  assert.match(response.v2_evaluation.input_snapshot_hash, /^[a-f0-9]{64}$/);
  assert.match(response.v2_evaluation.gate_result_id, /^CGR-[A-F0-9]{32}$/);
  assert.equal(response.v2_evaluation.lineage_current, true);
});

test('P1-002 generation identity changes when current Writer authorization changes', async () => {
  const identities = [];
  let gateResultId = 'GATE-A';
  const tasks = [];
  const repository = {
    async getDocumentGenerationInput() {
      return {
        project: { id: PROJECT, name: '测试项目' },
        baseline: { id: 'BASELINE-1' },
        requirements: [requirement()],
        plans: [{ requirement_id: 'REQ-AUTH-001', implementation_actions: [], conditions: [], responsibility_boundaries: [], target_sections: ['chapter-01'] }],
        claims: [{ claim_id: 'CLM-AUTH-001', requirement_id: 'REQ-AUTH-001', claim_type: 'requirement_response', basis_requirement_ids: ['REQ-AUTH-001'], target_sections: ['chapter-01'], text: '系统应提供审计日志。', decision: 'approved', current: true, assertion_hash: 'b'.repeat(64) }],
        evidence: [],
        coverage: {}
      };
    },
    async createDocumentGeneration(_projectId, _snapshot, _rules, identity) {
      identities.push(identity.input_snapshot_hash);
      return { id: `GEN-${identities.length}`, idempotent_replay: true, project_id: PROJECT, tasks };
    },
    async listProjectFacts() { return []; },
    async listProjectFactPropagationBindings() { return []; },
    async listLatestClaimGateEvaluations() {
      return [{ claim_id: 'CLM-AUTH-001', decision: 'allow', writer_eligible: true, current: true, lineage_current: true, claim_assertion_hash: 'b'.repeat(64), gate_result_id: gateResultId, input_snapshot_hash: 'c'.repeat(64), allowed_scope: gateResultId === 'GATE-A' ? ['audit'] : ['audit', 'project'] }];
    },
    async saveWriterSafeContext() {},
    async upsertFactMentionLedger() {},
    async getDocumentGeneration() { return { id: 'GEN', tasks: [] }; }
  };
  const service = new DocumentGenerationService({ repository, writerV2: true, provider: { async draft() { throw new Error('Writer must not be called by this fixture'); } }, referenceSelector: { async select() { return []; } } });
  await service.generateV2(PROJECT);
  gateResultId = 'GATE-B';
  await service.generateV2(PROJECT);
  assert.notEqual(identities[0], identities[1], 'authorization identity changes must prevent finalized-generation reuse');
});

test('HTTP production generation route retains requirement_response authorization and invalidates changed authorization', async () => {
  const identities = [];
  let gateResultId = 'GATE-HTTP-A';
  const responseClaim = { claim_id: 'CLM-HTTP-001', requirement_id: 'REQ-AUTH-001', claim_type: 'requirement_response', text: '系统应提供审计日志。', assertion_hash: 'b'.repeat(64), basis_requirement_ids: ['REQ-AUTH-001'], target_sections: ['chapter-01'], decision: 'approved', current: true };
  const repository = {
    async getDocumentGenerationInput() {
      return { project: { id: PROJECT, name: 'HTTP 测试项目' }, baseline: { id: 'BASELINE-HTTP' }, requirements: [requirement({ target_sections: ['chapter-01'] })], plans: [{ requirement_id: 'REQ-AUTH-001', target_sections: ['chapter-01'], implementation_actions: [], conditions: [], responsibility_boundaries: [] }], claims: [responseClaim], evidence: [], coverage: {} };
    },
    async listProjectFacts() { return []; },
    async listProjectFactPropagationBindings() { return []; },
    async listLatestClaimGateEvaluations() { return [{ claim_id: responseClaim.claim_id, decision: 'allow', writer_eligible: true, current: true, lineage_current: true, claim_assertion_hash: responseClaim.assertion_hash, gate_result_id: gateResultId, input_snapshot_hash: 'c'.repeat(64), allowed_scope: [] }]; },
    async saveWriterSafeContext() {},
    async upsertFactMentionLedger() {},
    async createDocumentGeneration(_projectId, _snapshot, _rules, identity) { identities.push(identity.input_snapshot_hash); return { id: `GEN-HTTP-${identities.length}`, idempotent_replay: true, project_id: PROJECT, tasks: [] }; },
    async getDocumentGeneration(id) { return { id, project_id: PROJECT, tasks: [] }; }
  };
  const service = new DocumentGenerationService({ repository, writerV2: true, provider: { async draft() { throw new Error('HTTP fixture must not call Writer'); } }, referenceSelector: { async select() { return []; } } });
  const app = createApp({ repository, documentGenerationService: service, projectAuthorizationService: { assertProjectAccess: async () => {} }, actorResolver: () => ({ actor_id: 'writer-auth-http', actor_type: 'test', source: 'test' }) });
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/projects/${PROJECT}/document-generations`;
    const first = await fetch(url, { method: 'POST' });
    assert.equal(first.status, 201);
    gateResultId = 'GATE-HTTP-B';
    const second = await fetch(url, { method: 'POST' });
    assert.equal(second.status, 201);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  assert.equal(identities.length, 2);
  assert.notEqual(identities[0], identities[1]);
});

const authClaim = (overrides = {}) => ({
  claim_id: 'CLM-AUTH-001',
  requirement_id: 'REQ-AUTH-001',
  claim_type: 'requirement_response',
  text: '系统应提供审计日志。',
  assertion_hash: 'b'.repeat(64),
  target_sections: ['chapter-01'],
  ...overrides
});
const authContext = (overrides = {}) => ({
  section: { section_id: 'chapter-01' },
  requirements: [requirement()],
  approved_claims: [authClaim()],
  bindings: [],
  safe_context: {
    project_id: PROJECT,
    chapter_id: 'chapter-01',
    contract_version: 'writer-safe-context-v1',
    authorization_contract_version: 'writer-input-authorization-v1',
    assertable_claims: [{ ...authClaim(), claim_assertion_hash: 'b'.repeat(64), claim_assertion_identity: 'b'.repeat(64), gate_result_id: 'GATE-A', decision: 'allow', writer_eligible: true, allowed_scope: ['audit'], required_conditions: [], limitations: [], input_snapshot_hash: 'c'.repeat(64), source_hashes: [], lineage_current: true }],
    context_items: [],
    ...overrides
  }
});

test('Writer Authorization Snapshot is stable under DB ordering and audit-only changes', () => {
  const secondRequirement = requirement({ req_id: 'REQ-AUTH-002', text: '系统应提供备份能力。' });
  const secondClaim = authClaim({ claim_id: 'CLM-AUTH-002', requirement_id: 'REQ-AUTH-002', text: '系统应提供备份能力。' });
  const secondAssertable = { ...authContext().safe_context.assertable_claims[0], claim_id: 'CLM-AUTH-002', requirement_id: 'REQ-AUTH-002', claim_text: '系统应提供备份能力。', text: '系统应提供备份能力。' };
  const first = buildWriterAuthorizationSnapshot({
    projectId: PROJECT,
    requirements: [requirement(), secondRequirement],
    plans: [{ requirement_id: 'REQ-AUTH-001', implementation_actions: [], conditions: [] }, { requirement_id: 'REQ-AUTH-002', implementation_actions: [], conditions: [] }],
    claims: [authClaim(), secondClaim],
    evidence: [{ evidence_id: 'E-1', content: '证据', source_hash: 'd'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-001'] }, { evidence_id: 'E-2', content: '备份证据', source_hash: 'e'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-002'] }],
    sectionContexts: [authContext({ requirements: [requirement(), secondRequirement], safe_context: { ...authContext().safe_context, assertable_claims: [authContext().safe_context.assertable_claims[0], secondAssertable] } })]
  });
  const second = buildWriterAuthorizationSnapshot({
    projectId: PROJECT,
    requirements: [{ ...secondRequirement, updated_at: 'later' }, { ...requirement(), updated_at: 'later' }],
    plans: [{ requirement_id: 'REQ-AUTH-002', implementation_actions: [], conditions: [] }, { requirement_id: 'REQ-AUTH-001', implementation_actions: [], conditions: [] }],
    claims: [{ ...secondClaim, updated_at: 'later', created_at: 'later' }, { ...authClaim(), updated_at: 'later', created_at: 'later' }],
    evidence: [{ evidence_id: 'E-2', content: '备份证据', source_hash: 'e'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-002'], created_at: 'later' }, { evidence_id: 'E-1', content: '证据', source_hash: 'd'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-001'], created_at: 'later' }],
    sectionContexts: [authContext({ requirements: [secondRequirement, requirement({ updated_at: 'later' })], safe_context: { ...authContext().safe_context, assertable_claims: [ { ...secondAssertable, created_at: 'later' }, { ...authContext().safe_context.assertable_claims[0], created_at: 'later' } ] } })]
  });
  assert.equal(writerAuthorizationSnapshotHash(first), writerAuthorizationSnapshotHash(second));

  const reordered = buildWriterAuthorizationSnapshot({
    projectId: PROJECT,
    requirements: [secondRequirement, requirement()],
    plans: [{ requirement_id: 'REQ-AUTH-002', implementation_actions: [], conditions: [] }, { requirement_id: 'REQ-AUTH-001', implementation_actions: [], conditions: [] }],
    claims: [secondClaim, authClaim()],
    evidence: [{ evidence_id: 'E-2', content: '备份证据', source_hash: 'e'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-002'] }, { evidence_id: 'E-1', content: '证据', source_hash: 'd'.repeat(64), applicable_requirement_ids: ['REQ-AUTH-001'] }],
    sectionContexts: [authContext({ requirements: [secondRequirement, requirement()], safe_context: { ...authContext().safe_context, assertable_claims: [secondAssertable, authContext().safe_context.assertable_claims[0]] } })]
  });
  assert.equal(writerAuthorizationSnapshotHash(first), writerAuthorizationSnapshotHash(reordered));
});

test('unbound irrelevant facts do not change Writer Authorization Snapshot', () => {
  const base = buildWriterAuthorizationSnapshot({ projectId: PROJECT, requirements: [requirement()], sectionContexts: [authContext()] });
  const withIrrelevant = buildWriterAuthorizationSnapshot({ projectId: PROJECT, requirements: [requirement()], facts: [{ project_fact_id: 'PF-UNBOUND', value: '无关' }], sectionContexts: [authContext()] });
  assert.equal(writerAuthorizationSnapshotHash(base), writerAuthorizationSnapshotHash(withIrrelevant));
});

test('stale currentness and authorization scope changes invalidate the snapshot', () => {
  const base = buildWriterAuthorizationSnapshot({ projectId: PROJECT, requirements: [requirement()], sectionContexts: [authContext()] });
  const stale = buildWriterAuthorizationSnapshot({ projectId: PROJECT, requirements: [requirement()], sectionContexts: [authContext({ assertable_claims: [{ ...authContext().safe_context.assertable_claims[0], lineage_current: false }] })] });
  const scope = buildWriterAuthorizationSnapshot({ projectId: PROJECT, requirements: [requirement()], sectionContexts: [authContext({ assertable_claims: [{ ...authContext().safe_context.assertable_claims[0], allowed_scope: ['audit', 'project'] }] })] });
  assert.notEqual(writerAuthorizationSnapshotHash(base), writerAuthorizationSnapshotHash(stale));
  assert.notEqual(writerAuthorizationSnapshotHash(base), writerAuthorizationSnapshotHash(scope));
});
