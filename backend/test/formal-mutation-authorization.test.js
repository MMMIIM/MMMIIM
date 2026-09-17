import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { ProjectAuthorizationService } from '../src/project-authorization-service.js';

const PROJECT_A = '11111111-1111-4111-8111-111111111111';
const PROJECT_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = 'formal-owner';

async function withServer(app, fn) {
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

async function request(base, method, path, body = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

function appFixture({ membershipByProject = {}, actorId = ACTOR } = {}) {
  const writes = [];
  const repository = {
    getProjectMembership: async ({ projectId, actorId: requestedActor }) => (
      requestedActor === actorId ? membershipByProject[projectId] || null : null
    ),
    getEvidenceReviewProject: async id => ({ review_id: id, project_id: PROJECT_B }),
    getEvidenceSourceFactCurrent: async id => ({ fact_id: id, project_id: PROJECT_B }),
    getRequirementEvidenceFactMappingCurrent: async id => ({ mapping_id: id, project_id: PROJECT_B }),
    getProjectFactCurrent: async id => ({ project_fact_id: id, project_id: PROJECT_B }),
    getClaimProject: async id => ({ claim_id: id, project_id: PROJECT_B }),
    getDocumentGeneration: async id => ({ id, project_id: PROJECT_B }),
    getPipelineDocumentVersion: async id => ({ id, project_id: PROJECT_B, risk_status: 'pass' })
  };
  const projectAuthorizationService = new ProjectAuthorizationService({ repository });
  const app = createApp({
    repository,
    projectAuthorizationService,
    actorResolver: () => ({ actor_id: actorId, actor_type: 'test', source: 'test' }),
    evidenceReviewService: { decide: async () => { writes.push('review'); return {}; } },
    evidenceSourceFactService: {
      decide: async () => { writes.push('fact'); return {}; },
      extract: async () => { writes.push('fact-extract'); return { facts: [] }; }
    },
    requirementEvidenceFactMappingService: {
      propose: async () => { writes.push('mapping-propose'); return {}; },
      decide: async () => { writes.push('mapping-decide'); return {}; }
    },
    projectFactControlService: { decide: async () => { writes.push('project-fact'); return {}; } },
    productionBetaService: {
      decideClaim: async () => { writes.push('claim'); return {}; },
      generateClaims: async () => { writes.push('claim-generate'); return {}; }
    },
    documentGenerationService: {
      generate: async () => { writes.push('document-generate'); return {}; },
      retry: async () => { writes.push('document-retry'); return {}; },
      regenerate: async () => { writes.push('document-regenerate'); return {}; }
    },
    generationService: { confirmVersion: async () => { writes.push('document-confirm'); return {}; } }
  });
  return { app, writes };
}

test('AUTH-T01/T05: trusted project member mutates and request-body actor cannot replace trusted actor', async () => {
  const { app, writes } = appFixture({ membershipByProject: { [PROJECT_A]: { role: 'OWNER', status: 'ACTIVE' } } });
  await withServer(app, async base => {
    const result = await request(base, 'POST', `/api/projects/${PROJECT_A}/requirement-evidence-fact-mappings`, {
      requirement_id: 'REQ-001', fact_id: 'EFACT-1', actor_id: 'spoofed-admin', reviewer: 'spoofed-admin'
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
  });
  assert.deepEqual(writes, ['mapping-propose']);
});

test('AUTH-T02: trusted non-member is denied before formal Mapping write', async () => {
  const { app, writes } = appFixture();
  await withServer(app, async base => {
    const result = await request(base, 'POST', `/api/projects/${PROJECT_A}/requirement-evidence-fact-mappings`, {
      requirement_id: 'REQ-001', fact_id: 'EFACT-1'
    });
    assert.equal(result.response.status, 403, JSON.stringify(result.body));
    assert.equal(result.body.error.code, 'PROJECT_ACCESS_DENIED');
  });
  assert.deepEqual(writes, []);
});

test('AUTH-T03/MAP-TX04: Project A member cannot mutate Project B mapping and causes zero writes', async () => {
  const { app, writes } = appFixture({ membershipByProject: { [PROJECT_A]: { role: 'OWNER', status: 'ACTIVE' } } });
  await withServer(app, async base => {
    const result = await request(base, 'POST', '/api/requirement-evidence-fact-mappings/EMAP-B/approve');
    assert.equal(result.response.status, 403, JSON.stringify(result.body));
    assert.equal(result.body.error.code, 'PROJECT_ACCESS_DENIED');
  });
  assert.deepEqual(writes, []);
});

test('AUTH-T04: revoked member is denied before formal Claim mutation', async () => {
  const { app, writes } = appFixture({ membershipByProject: { [PROJECT_B]: { role: 'OWNER', status: 'REVOKED' } } });
  await withServer(app, async base => {
    const result = await request(base, 'POST', '/api/claims/CLM-B/approve');
    assert.equal(result.response.status, 403, JSON.stringify(result.body));
    assert.equal(result.body.error.code, 'PROJECT_ACCESS_DENIED');
  });
  assert.deepEqual(writes, []);
});

test('all current authority-bearing ID routes resolve project and fail before owning-service mutation', async () => {
  const { app, writes } = appFixture();
  await withServer(app, async base => {
    for (const path of [
      '/api/evidence-reviews/EREVIEW-B/approve',
      '/api/evidence-source-facts/EFACT-B/approve',
      '/api/requirement-evidence-fact-mappings/EMAP-B/approve',
      '/api/project-facts/PFACT-B/approve',
      '/api/claims/CLM-B/approve',
      '/api/document-generations/DGEN-B/retry-batches',
      '/api/document-versions/DVER-B/confirm',
      '/api/document-versions/DVER-B/chapters/chapter-01/regenerate'
    ]) {
      const result = await request(base, 'POST', path);
      assert.equal(result.response.status, 403, `${path}: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.error.code, 'PROJECT_ACCESS_DENIED');
    }
  });
  assert.deepEqual(writes, []);
});
