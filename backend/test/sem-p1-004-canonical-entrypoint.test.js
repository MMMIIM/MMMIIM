import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { EvidenceService } from '../src/evidence-service.js';
import { EvidenceFactService } from '../src/evidence-fact-service.js';
import { EvidenceReviewService } from '../src/evidence-review-service.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';
import { PRE_REVIEW_STAGING_ROLE } from '../src/evidence-lifecycle.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT = '22222222-2222-4222-8222-222222222222';
const EVIDENCE = '33333333-3333-4333-8333-333333333333';
const FACT = 'EFACT-1';
const marker = { lifecycle_role: PRE_REVIEW_STAGING_ROLE, canonical_review_required: true };

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function request(base, path, method = 'POST', body = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

function baseRepository(overrides = {}) {
  return {
    pool: { query: async () => ({ rows: [{ ok: 1 }] }) },
    getEvidenceRecord: async () => ({ id: EVIDENCE, project_id: PROJECT, metadata: marker }),
    decideEvidence: async () => { throw new Error('legacy approval must not be called'); },
    getEvidenceFactSource: async () => ({ id: EVIDENCE, project_id: PROJECT, approval_status: 'approved', metadata: marker, source_text: '原文', source_lineage_verified: true, evidence_scope: [] }),
    getEvidenceFactByIdentifier: async () => ({ fact_id: FACT, evidence_id: EVIDENCE, project_id: PROJECT, metadata: marker }),
    decideEvidenceFact: async () => { throw new Error('legacy fact decision must not be called'); },
    findInvalidConfirmedRequirementIds: async () => [],
    validateEvidenceForMapping: async () => ({ approval_status: 'approved', metadata: marker, source_lineage_verified: true }),
    createRequirementEvidenceMapping: async () => { throw new Error('legacy mapping must not be called'); },
    getProject: async (id) => ({ id, name: 'synthetic project' }),
    getProjectMembership: async () => ({ role: 'OWNER', status: 'ACTIVE' }),
    getEvidenceReviewProject: async () => ({ project_id: PROJECT }),
    getRequirementEvidenceFactMappingCurrent: async () => ({ mapping_id: 'MAP-1', project_id: PROJECT }),
    listEvidenceCatalog: async () => ({ evidences: [{ evidence_id: 'HIST-1', approval_status: 'approved', metadata: {} }], counts: { approved: 1 } }),
    getDocumentGenerationInput: async () => ({ project: { id: PROJECT }, baseline: { id: 'baseline' }, requirements: [], plans: [], claims: [], evidence: [{ evidence_id: EVIDENCE, approval_status: 'approved', metadata: marker }], coverage: [] }),
    ...overrides
  };
}

function appFor(repository, services = {}) {
  return createApp({
    repository,
    evidenceService: services.evidenceService || new EvidenceService({ repository }),
    evidenceFactService: services.evidenceFactService || new EvidenceFactService({ repository }),
    evidenceReviewService: services.evidenceReviewService,
    evidenceSourceFactService: services.evidenceSourceFactService,
    requirementEvidenceFactMappingService: services.requirementEvidenceFactMappingService,
    documentGenerationService: services.documentGenerationService || new DocumentGenerationService({ repository, provider: { draft: async () => ({ content: '' }) } }),
    projectAuthorizationService: { assertProjectAccess: async () => {} },
    actorResolver: () => ({ actor_id: 'trusted-reviewer', actor_type: 'test', source: 'test' })
  });
}

test('NC1 production Evidence approval cannot approve PRE_REVIEW_STAGING', async () => {
  const app = appFor(baseRepository());
  await withServer(app, async (base) => {
    const result = await request(base, `/api/evidences/${EVIDENCE}/approve`);
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error.code, 'EVIDENCE_REVIEW_REQUIRED');
  });
});

test('NC2 production legacy Evidence Fact entry cannot use PRE_REVIEW_STAGING', async () => {
  const app = appFor(baseRepository());
  await withServer(app, async (base) => {
    const result = await request(base, `/api/projects/${PROJECT}/evidences/${EVIDENCE}/facts`, 'POST', { created_by: 'spoof', subject: { type: 'organization' }, entities: [], fact_type: 'capability', fact_status: 'unknown', fact_scopes: [], quantities: [], validity: { status: 'unknown' } });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error.code, 'EVIDENCE_REVIEW_REQUIRED');
  });
});

test('NC3 production legacy Mapping entry cannot use PRE_REVIEW_STAGING', async () => {
  const app = appFor(baseRepository());
  await withServer(app, async (base) => {
    const result = await request(base, `/api/projects/${PROJECT}/evidence-mappings`, 'POST', { requirement_id: 'REQ-001', evidence_id: EVIDENCE, mapping_source: 'manual', support_level: 'full_support', created_by: 'spoof' });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error.code, 'EVIDENCE_REVIEW_REQUIRED');
  });
});

test('NC5 production Writer entry rejects staging evidence before generation persistence', async () => {
  let writes = 0;
  const repository = baseRepository({ createDocumentGeneration: async () => { writes += 1; } });
  const app = appFor(repository);
  await withServer(app, async (base) => {
    const result = await request(base, `/api/projects/${PROJECT}/document-generations`);
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error.code, 'EVIDENCE_REVIEW_REQUIRED');
  });
  assert.equal(writes, 0);
});

test('NC4 Claim Gate receives no authorized support from staging evidence', async () => {
  let persisted = null;
  const repository = {
    getProject: async () => ({ id: PROJECT }),
    getRequirementBaseline: async () => ({ id: 'baseline' }),
    getFormalRequirements: async () => [{ req_id: 'REQ-001', text: '商务要求', requirement_category: 'commercial', writer_eligible: false, is_mandatory: false }],
    listResponsePlans: async () => ({ plans: [] }),
    listApprovedEvidence: async () => [{ evidence_id: EVIDENCE, approval_status: 'approved', metadata: marker }],
    listEnterpriseEvidenceBindings: async () => [{ evidence_id: EVIDENCE, metadata: marker, requirement_id: 'REQ-001' }],
    getApprovedRequirementFactSupport: async () => [],
    listApprovedCurrentEvidenceFacts: async () => [],
    replaceClaimsAndCoverage: async (_projectId, value) => { persisted = value; },
    listClaims: async () => []
  };
  await new ProductionBetaService({ repository }).generateClaims(PROJECT);
  assert.deepEqual(persisted.evaluatedClaims, []);
  assert.equal(persisted.coverage.coverage.length, 0);
});

test('NC6 canonical Review proposal can continue through human review, Fact and Mapping services', async () => {
  const context = { project_id: PROJECT, requirement_db_id: 'REQ-DB-1', requirement_id: 'REQ-001', requirement_text: '需求', retrieval_run_id: 'run-1', retrieval_candidate_id: 'chunk-1', source_span_id: 'SPAN-1', source_text: '原文', source_text_hash: 'hash', material_id: EVIDENCE, source_material: 'fixture.md', material_type: 'project_case' };
  let proposed = null; let reviewDecision = null; const lifecycle = [];
  const repository = baseRepository({
    getEvidenceReviewCandidate: async () => context,
    upsertEvidenceCandidateReview: async (value) => { proposed = value; lifecycle.push('review_proposed'); return value; },
    getEvidenceCandidateReviewCurrent: async () => ({ ...proposed, requirement_text: context.requirement_text, current_source_text_hash: proposed.source_text_hash }),
    decideEvidenceCandidateReview: async ({ reviewId, status, reviewer }) => { reviewDecision = { reviewId, status, reviewer }; lifecycle.push('review_decided'); return { ...proposed, review_status: status, reviewer }; }
  });
  const evidenceReviewService = new EvidenceReviewService({ repository, semanticReviewer: { review: async () => ({ semantic_relevance: 'relevant', evidence_capability: 'capable', support_level: 'full_support', review_dimensions: {}, reason_codes: [], requires_human_review: true }) } });
  const evidenceSourceFactService = { extract: async ({ reviewId }) => { lifecycle.push('fact_proposed'); return { facts: [{ fact_id: 'FACT-1', evidence_review_id: reviewId, review_status: 'draft' }] }; } };
  const requirementEvidenceFactMappingService = { propose: async (input) => { lifecycle.push('mapping_proposed'); return { mapping_id: 'MAP-1', ...input, review_status: 'proposed' }; }, decide: async (mappingId, decision) => { lifecycle.push('mapping_decided'); return { mapping_id: mappingId, review_status: decision === 'approve' ? 'approved' : 'rejected' }; } };
  const app = appFor(repository, { evidenceReviewService, evidenceSourceFactService, requirementEvidenceFactMappingService });
  await withServer(app, async (base) => {
    const result = await request(base, `/api/projects/${PROJECT}/requirements/REQ-001/evidence-reviews`, 'POST', { retrieval_run_id: 'run-1', retrieval_candidate_id: 'chunk-1', source_span_id: 'SPAN-1' });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.data.review.review_status, 'needs_review');
    const reviewId = result.body.data.review.review_id;
    const decision = await request(base, `/api/evidence-reviews/${reviewId}/approve`, 'POST', { reviewer: 'spoofed-client-value' });
    assert.equal(decision.response.status, 200, JSON.stringify(decision.body)); assert.equal(decision.body.data.review.review_status, 'approved');
    const facts = await request(base, `/api/evidence-reviews/${reviewId}/facts`, 'POST');
    assert.equal(facts.response.status, 201); assert.equal(facts.body.data.facts[0].review_status, 'draft');
    const mapping = await request(base, `/api/projects/${PROJECT}/requirement-evidence-fact-mappings`, 'POST', { requirement_id: 'REQ-001', fact_id: 'FACT-1', source_type: 'manual' });
    assert.equal(mapping.response.status, 201); assert.equal(mapping.body.data.mapping.review_status, 'proposed');
    const mappingDecision = await request(base, '/api/requirement-evidence-fact-mappings/MAP-1/approve', 'POST', { reviewer: 'spoofed-client-value' });
    assert.equal(mappingDecision.response.status, 200); assert.equal(mappingDecision.body.data.mapping.review_status, 'approved');
  });
  assert.equal(proposed.review_status, 'needs_review'); assert.deepEqual(reviewDecision, { reviewId: proposed.review_id, status: 'approved', reviewer: 'trusted-reviewer' });
  assert.deepEqual(lifecycle, ['review_proposed', 'review_decided', 'fact_proposed', 'mapping_proposed', 'mapping_decided']);
});

test('NC7 historical legacy evidence remains readable and NC8 project isolation remains enforced', async () => {
  const repository = baseRepository({ getEvidenceRecord: async (id) => id === EVIDENCE ? { id, project_id: PROJECT, metadata: marker } : null, validateEvidenceForMapping: async (projectId) => projectId === PROJECT ? { approval_status: 'approved', metadata: marker, source_lineage_verified: true } : null });
  const app = appFor(repository);
  await withServer(app, async (base) => {
    const readable = await request(base, `/api/projects/${PROJECT}/evidences`, 'GET');
    assert.equal(readable.response.status, 200);
    assert.equal(readable.body.data.evidences[0].evidence_id, 'HIST-1');
    const isolated = await request(base, `/api/evidences/${EVIDENCE}/approve`);
    assert.equal(isolated.response.status, 409);
    const mapping = await request(base, `/api/projects/${OTHER_PROJECT}/evidence-mappings`, 'POST', { requirement_id: 'REQ-001', evidence_id: EVIDENCE, mapping_source: 'manual', support_level: 'full_support' });
    assert.equal(mapping.response.status, 404);
  });
});

test('retrieval transition marks new evidence as staging and calls Review before returning', async () => {
  const material = { id: 'material-1', project_id: PROJECT, material_type: 'project_case', extraction_status: 'succeeded', extracted_text: '来源原文' };
  const chunk = { chunk_id: 'chunk-1', material_id: material.id, chunk_index: 0, source_text: '来源原文', char_start: 0, char_end: 4, chunk_hash: 'hash', page_start: 1, page_end: 1, paragraph_start: 1, paragraph_end: 1, section: 'section' };
  let created = null;
  const repository = baseRepository({
    getRetrievalEvidenceSource: async () => ({ ...chunk, status: 'succeeded', material_id: EVIDENCE, chunk_id: chunk.chunk_id, material_type: material.material_type, original_name: 'fixture.md' }),
    getCompanyMaterial: async () => ({ ...material, id: EVIDENCE }),
    listMaterialChunks: async () => [{ ...chunk, material_id: EVIDENCE }],
    getMaterialChunk: async () => ({ ...chunk, material_id: EVIDENCE }),
    findEvidenceBySourceSpan: async () => null,
    findInvalidConfirmedRequirementIds: async () => [],
    createEvidenceRecord: async (value) => { created = value; return { id: EVIDENCE, approval_status: 'draft', metadata: value.metadata }; },
    upsertEvidenceSourceSpan: async () => undefined
  });
  const evidenceReviewService = { propose: async () => ({ review_id: 'ER-1', review_status: 'needs_review' }) };
  const service = new EvidenceService({ repository, evidenceReviewService, requireReviewTransition: true });
  const result = await service.createFromRetrieval(PROJECT, 'REQ-001', { retrieval_run_id: PROJECT, chunk_id: chunk.chunk_id });
  assert.equal(result.transition.lifecycle_role, PRE_REVIEW_STAGING_ROLE);
  assert.equal(created.metadata.lifecycle_role, PRE_REVIEW_STAGING_ROLE);
  assert.equal(created.metadata.canonical_review_required, true);
});
