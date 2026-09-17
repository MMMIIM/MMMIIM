import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { GenerationService } from '../src/service.js';
import { PgRepository } from '../src/db.js';

function createVersionApp({ actorResolver = () => ({ actor_id: 'user-A', actor_type: 'test', source: 'test' }) } = {}) {
  const versions = {
    pass: { id: 'pass', project_id: 'project', risk_status: 'pass' },
    warning: { id: 'warning', project_id: 'project', risk_status: 'warning' },
    critical: { id: 'critical', project_id: 'project', risk_status: 'critical' }
  };
  const confirmations = [];
  const repository = {
    pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) },
    async getVersion(id) { return versions[id] || null; },
    async getPipelineDocumentVersion(id) { return versions[id] || null; },
    async confirmVersion(version, confirmationText, actorId) {
      confirmations.push({ version, confirmationText, actorId });
      return { decision: { confirmation_text: confirmationText || null, actor_id: actorId }, version: { ...version, status: 'confirmed' } };
    }
  };
  const app = createApp({
    repository,
    generationService: new GenerationService({ repository, workflowVersion: '4.2' }),
    actorResolver,
    projectAuthorizationService: { assertProjectAccess: async () => {} },
    legacyGenerationCompat: false
  });
  return { app, confirmations };
}

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function post(base, path, body = {}) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

async function patch(base, path, body = {}) {
  const response = await fetch(`${base}${path}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

test('DocumentVersion HTTP confirmation uses one owning service and preserves risk gate', async () => {
  const { app, confirmations } = createVersionApp();
  await withServer(app, async (base) => {
    let result = await post(base, '/api/document-versions/pass/confirm');
    assert.equal(result.response.status, 200);
    result = await post(base, '/api/document-versions/warning/confirm');
    assert.equal(result.response.status, 400);
    assert.equal(result.body.error.code, 'WARNING_CONFIRMATION_REQUIRED');
    result = await post(base, '/api/document-versions/warning/confirm', { confirmation_text: '   ' });
    assert.equal(result.response.status, 400);
    result = await post(base, '/api/document-versions/warning/confirm', { confirmation_text: '已核对风险并承担后续复核责任。' });
    assert.equal(result.response.status, 200);
    result = await post(base, '/api/document-versions/critical/confirm', { confirmation_text: '已知悉' });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error.code, 'CRITICAL_RISK');
  });
  assert.deepEqual(confirmations.map((item) => item.version.id), ['pass', 'warning']);
  assert.equal(confirmations[1].confirmationText, '已核对风险并承担后续复核责任。');
  assert.deepEqual(confirmations.map((item) => item.actorId), ['user-A', 'user-A']);
});

test('client reviewer/editor cannot override trusted actor and missing actor fails safely', async () => {
  const calls = [];
  const app = createApp({
    repository: { getEvidenceReviewProject: async () => ({ project_id: 'project' }) },
    evidenceReviewService: { async decide(id, decision, input) { calls.push({ id, decision, input }); return { reviewed_by: input.reviewer }; } },
    actorResolver: () => ({ actor_id: 'user-A', actor_type: 'test', source: 'test' }),
    projectAuthorizationService: { assertProjectAccess: async () => {} }
  });
  await withServer(app, async (base) => {
    const result = await post(base, '/api/evidence-reviews/ER-1/approve', { reviewer: 'admin' });
    assert.equal(result.response.status, 200);
  });
  assert.equal(calls[0].input.reviewer, 'user-A');

  const missingActorApp = createApp({ repository: { getEvidenceReviewProject: async () => ({ project_id: 'project' }) }, evidenceReviewService: { async decide() { assert.fail('must not reach service'); } }, projectAuthorizationService: { assertProjectAccess: async () => {} }, actorResolver: null });
  await withServer(missingActorApp, async (base) => {
    const result = await post(base, '/api/evidence-reviews/ER-1/approve', { reviewer: 'admin' });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error.code, 'AUTHENTICATED_ACTOR_REQUIRED');
  });
});

test('ResponsePlan edit discards client edited_by and persists trusted actor only', async () => {
  const calls = [];
  const app = createApp({
    repository: {},
    productionBetaService: {
      async editPlan(...args) { calls.push(args); return { audit: { edited_by: args[3].actor_id } }; }
    },
    actorResolver: () => ({ actor_id: 'user-A', actor_type: 'test', source: 'test' }),
    projectAuthorizationService: { assertProjectAccess: async () => {} }
  });
  await withServer(app, async (base) => {
    const result = await patch(base, '/api/projects/project/response-plans/REQ-001', {
      edited_by: 'admin', edit_reason: '人工复核', response_status: 'full',
      implementation_actions: [], conditions: [], supporting_evidence_ids: []
    });
    assert.equal(result.response.status, 200);
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].edited_by, undefined);
  assert.equal(calls[0][3].actor_id, 'user-A');

  const missingActorApp = createApp({
    repository: {},
    productionBetaService: { async editPlan() { assert.fail('must not reach service'); } },
    actorResolver: null,
    projectAuthorizationService: { assertProjectAccess: async () => {} }
  });
  await withServer(missingActorApp, async (base) => {
    const result = await patch(base, '/api/projects/project/response-plans/REQ-001', { edited_by: 'admin', edit_reason: 'x' });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error.code, 'AUTHENTICATED_ACTOR_REQUIRED');
  });
});

test('formal requirement/source services reject missing or placeholder actors', async () => {
  const { RequirementParseService } = await import('../src/requirement-parse-service.js');
  const { RequirementSourceService } = await import('../src/requirement-source-service.js');
  const parse = new RequirementParseService({ repository: {
    getParseJob: async () => ({ id: '11111111-1111-4111-8111-111111111111', status: 'succeeded', candidates: [{
      req_id: 'REQ-001', content: '提供审计能力。', source_text: '提供审计能力。', source_excerpt: '提供审计能力。',
      is_mandatory: false, mandatory_marker: null, mandatory_scope_source_text: null,
      mandatory_scope_section: null, exception_clause_ids: [], source_status: 'verified',
      source_verified: true, candidate_decision: 'include', confirmation_type: 'verified', source_page: 1,
      source_paragraph: 1, ordinal: 1
    }] })
  } });
  await assert.rejects(
    () => parse.confirm('11111111-1111-4111-8111-111111111111', { confirmed_by: 'current_user' }),
    (error) => error.code === 'AUTHENTICATED_ACTOR_REQUIRED'
  );
  const source = new RequirementSourceService({ repository: {} });
  await assert.rejects(
    () => source.excludeCandidate('11111111-1111-4111-8111-111111111111', { confirmed_by: 'current_user' }),
    (error) => error.code === 'AUTHENTICATED_ACTOR_REQUIRED'
  );
  const repository = new PgRepository({});
  await assert.rejects(
    () => repository.saveCandidateSourceDecision({ candidateId: 'candidate', action: 'exclude', reason: 'test' }),
    (error) => error.code === 'AUTHENTICATED_ACTOR_REQUIRED'
  );
});

test('legacy generation routes are unavailable by default and only exposed in explicit compatibility mode', async () => {
  const baseArgs = { repository: { listJobs: async () => [] }, generationService: { async generate() { return { parsed: { markdown: 'legacy' }, job: { id: 'job' } }; } } };
  const off = createApp(baseArgs);
  await withServer(off, async (base) => {
    const response = await post(base, '/api/generate-bid', { project_name: 'legacy' });
    assert.equal(response.response.status, 404);
    assert.equal(response.body.error.code, 'API_NOT_FOUND');
  });
  const on = createApp({ ...baseArgs, legacyGenerationCompat: true });
  await withServer(on, async (base) => {
    const response = await post(base, '/api/generate-bid', { project_name: 'legacy' });
    assert.notEqual(response.response.status, 404);
  });
});
