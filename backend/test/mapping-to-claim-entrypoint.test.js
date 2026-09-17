import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';

const PROJECT = '00000000-0000-4000-8000-000000000011';
const requirement = {
  req_id: 'REQ-001',
  text: '相关项目应完成中标交付。',
  source_status: 'verified',
  confirmation_type: 'verified',
  requirement_category: 'technical',
  writer_eligible: true,
  classification_review_required: false,
  atomicity_review_required: false
};
const plan = {
  requirement_id: 'REQ-001',
  response_status: 'full',
  response_summary: requirement.text,
  implementation_actions: [],
  optional_design: [],
  deliverables: [],
  acceptance_methods: [],
  conditions: [],
  supporting_evidence_ids: [],
  capability_gap: '',
  target_sections: ['chapter-05']
};

function canonicalSupport(support_level = 'full_support') {
  return {
    mapping_id: 'MAP-001', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'FACT-001',
    mapping_status: 'approved', mapping_current: true, approval_status: 'approved', is_current: true,
    support_level, source_lineage_verified: true, usable_for_claims: true,
    source_text: '相关项目中标并完成交付。', content: '相关项目中标并完成交付。',
    material_type: 'project_case', evidence_scope: ['award_fact'], metadata: {}, evidence_facts: []
  };
}

function repository({ canonical = [], legacy = [] } = {}) {
  let persisted = null;
  const claims = [];
  return {
    getProject: async (id) => id === PROJECT ? { id } : null,
    getRequirementBaseline: async () => ({ id: 'baseline' }),
    getFormalRequirements: async () => [requirement],
    listResponsePlans: async () => ({ plans: [plan], constraint_records: [] }),
    listApprovedEvidence: async () => legacy,
    getApprovedRequirementFactSupport: async () => canonical,
    replaceClaimsAndCoverage: async (_id, value) => {
      persisted = value;
      claims.splice(0, claims.length, ...value.evaluatedClaims.map((item) => ({ ...item.claim, ...item.decision, v2_evaluation: item.v2_evaluation })));
    },
    listClaims: async () => claims,
    saveProductionBetaFailure: async () => {},
    get persisted() { return persisted; }
  };
}

async function withServer(repository, run) {
  const service = new ProductionBetaService({ repository });
  const app = createApp({ repository, productionBetaService: service, projectAuthorizationService: { assertProjectAccess: async () => {} }, actorResolver: () => ({ actor_id: 'trusted-test', actor_type: 'test', source: 'test' }) });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function generate(base) {
  const response = await fetch(`${base}/api/projects/${PROJECT}/claims/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return { response, body: await response.json() };
}

test('production Claim route uses canonical Fact Mapping and persists its support', async () => {
  const repo = repository({ canonical: [canonicalSupport()] });
  await withServer(repo, async (base) => {
    const result = await generate(base);
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.ok(repo.persisted.evaluatedClaims.some((item) => item.claim.claim_type === 'evidence_support'));
    assert.deepEqual(repo.persisted.evaluatedClaims.find((item) => item.claim.claim_type === 'evidence_support').v2_evaluation.mapping_ids, ['MAP-001']);
  });
});

for (const support_level of ['partial_support', 'insufficient', 'conflict', 'unknown']) {
  test(`production Claim route cannot promote ${support_level} Mapping support`, async () => {
    const repo = repository({ canonical: [canonicalSupport(support_level)] });
    await withServer(repo, async (base) => {
      const result = await generate(base);
      assert.equal(result.response.status, 201, JSON.stringify(result.body));
      const evidenceSupport = repo.persisted.evaluatedClaims.find((item) => item.claim.claim_type === 'evidence_support');
      assert.ok(evidenceSupport, `expected evidence_support result for ${support_level}`);
      assert.notEqual(evidenceSupport.v2_evaluation.decision, 'allow');
      assert.equal(evidenceSupport.v2_evaluation.writer_eligible, false);
    });
  });
}

test('production Claim route cannot fall back to legacy Mapping when canonical support is absent', async () => {
  const repo = repository({ legacy: [{ mapping_id: 'LEGACY-MAP', project_id: PROJECT, requirement_id: 'REQ-001', evidence_id: 'LEGACY-EVIDENCE', approval_status: 'approved', content: 'legacy support' }] });
  await withServer(repo, async (base) => {
    const result = await generate(base);
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.equal(repo.persisted.evaluatedClaims.some((item) => item.claim.claim_type === 'evidence_support'), false);
  });
});
