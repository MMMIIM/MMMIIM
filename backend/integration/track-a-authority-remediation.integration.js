import assert from 'node:assert/strict';
import { test } from 'node:test';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createPool, PgRepository } from '../src/db.js';
import { EvidenceReviewService } from '../src/evidence-review-service.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { EvidenceFactService } from '../src/evidence-fact-service.js';
import { EvidenceService } from '../src/evidence-service.js';
import { EnterpriseRetrievalService } from '../src/pipeline/enterprise-retrieval-service.js';
import { EvidenceSourceSpanService } from '../src/evidence-source-span-service.js';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';
import { ProjectAuthorizationService } from '../src/project-authorization-service.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const ACTOR = 'track-a-authority-integration';
const SOURCE = '# Qualification\n\nSynthetic Vendor holds ISO 27001 certification.';
const sha = value => createHash('sha256').update(String(value)).digest('hex');

function requirementInput(reqId, ordinal) {
  const content = `应具备 ISO 27001 认证（${reqId}）。`;
  return {
    req_id: reqId, content, source_excerpt: content, source_text: content,
    target_sections: [], ordinal, is_mandatory: false, mandatory_marker: null,
    source_section: null, source_clause_id: null, mandatory_scope_source_text: null,
    mandatory_scope_section: null, exception_clause_ids: [], source_hash: sha(content),
    source_chunk_id: null, category: 'requirement', requires_confirmation: false,
    source_page_start: null, source_page_end: null, source_paragraph_start: null,
    source_paragraph_end: null, source_paragraphs_json: [], source_match_type: 'exact',
    source_match_score: 1, source_resolution_method: 'track-a-integration', source_verified: true,
    source_status: 'verified', confirmation_type: 'verified', requirement_category: 'qualification',
    writer_eligible: false, classification_review_required: false, atomicity_review_required: false,
    classification_method: 'manual', confirmation_reasons: [], risk_flags: [], source_evidence: {},
    deduplication: {}, canonical_rule_version: 'track-a-integration'
  };
}

function factExtractor() {
  return {
    version: 'track-a-fact-extractor-v1',
    async extract() {
      return [{
        subject: { type: 'organization', name: 'Synthetic Vendor' },
        entities: [], status: 'unknown', scopes: [], quantities: [],
        validity: { status: 'unknown' }, domain_metadata: {}
      }];
    }
  };
}

async function seedFixture() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for Track A PostgreSQL tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `Track A authority ${Date.now()}-${randomUUID()}` });
  await repository.createProjectMembership({ projectId: project.id, actorId: ACTOR, role: 'OWNER', status: 'ACTIVE', createdBy: ACTOR });
  const material = await repository.createCompanyMaterial({
    projectId: project.id, originalName: 'track-a.txt', storageKey: `track-a-${project.id}`,
    materialType: 'qualification', mimeType: 'text/plain', sizeBytes: Buffer.byteLength(SOURCE), fileHash: sha(SOURCE)
  });
  await repository.completeCompanyMaterialExtraction(material.id, SOURCE);
  const chunks = chunkEnterpriseMaterial(material.id, SOURCE, { maxChars: 200 });
  await repository.replaceMaterialChunks(material.id, chunks);
  const chunk = chunks.find(item => item.source_text.includes('Synthetic Vendor')) || chunks[0];
  const spanService = new EvidenceSourceSpanService({ repository });
  const tender = await repository.addTenderFile({ projectId: project.id, originalName: 'track-a.txt', storageKey: `track-a-tender-${project.id}`, mimeType: 'text/plain', sizeBytes: 1 });
  const job = (await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,summary_json) VALUES($1,$2,'succeeded','{}') RETURNING id`, [project.id, tender.id])).rows[0];
  await repository.confirmRequirementBaseline({
    jobId: job.id,
    confirmedBy: ACTOR,
    requirements: [requirementInput('REQ-001', 1), requirementInput('REQ-002', 2)]
  });
  const requirements = {};
  const runs = {};
  const spans = {};
  for (const reqId of ['REQ-001', 'REQ-002']) {
    requirements[reqId] = (await pool.query(`SELECT * FROM requirements WHERE project_id=$1 AND req_id=$2`, [project.id, reqId])).rows[0];
    spans[reqId] = await spanService.resolve({ projectId: project.id, materialId: material.id, anchorChunkId: chunk.chunk_id, strategy: 'anchor_only' });
    const run = await repository.createRetrievalRun({
      projectId: project.id, requirementDbId: requirements[reqId].id, requirementRef: reqId,
      queryText: requirements[reqId].content, queryHash: sha(requirements[reqId].content), model: `track-a-${reqId}`,
      version: '1', dimension: 3, topK: 1, filters: {}, retrievalContractVersion: 'production-retrieval-v1',
      candidateK: 20, reviewK: 8, rerankVersion: 'track-a', semanticMetadata: {}
    });
    const embedding = (await pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,$3,'1',3,'[1,0,0]') RETURNING embedding_id`, [chunk.chunk_id, chunk.chunk_hash, `track-a-${reqId}`])).rows[0];
    await pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score,raw_vector_rank,raw_similarity,reranked_rank,is_final,content_role,role_compatibility,matched_evidence_needs,rerank_reasons,retrieval_contract_version,rerank_version) VALUES($1,$2,$3,1,1,1,1,1,true,'qualification','preferred','[]','[]','production-retrieval-v1','track-a')`, [run.retrieval_run_id, chunk.chunk_id, embedding.embedding_id]);
    await pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now() WHERE retrieval_run_id=$1`, [run.retrieval_run_id]);
    runs[reqId] = run;
  }
  return { pool, repository, project, material, chunk, spans, requirements, runs };
}

async function cleanup(fixture) {
  await fixture.pool.query(`DELETE FROM projects WHERE id=$1`, [fixture.project.id]);
  await fixture.pool.end();
}

async function approvedReview(fixture, reviewService, reqId) {
  const review = await reviewService.propose({
    projectId: fixture.project.id,
    requirementId: reqId,
    retrievalRunId: fixture.runs[reqId].retrieval_run_id,
    retrievalCandidateId: fixture.chunk.chunk_id,
    sourceSpanId: fixture.spans[reqId].span_id
  });
  await reviewService.decide(review.review_id, 'approve', { reviewer: ACTOR });
  return review;
}

async function evidenceForLegacy(fixture) {
  const evidenceService = new EvidenceService({ repository: fixture.repository });
  const evidence = await evidenceService.create(fixture.project.id, {
    material_id: fixture.material.id,
    source_chunk_id: fixture.chunk.chunk_id,
    evidence_type: 'qualification',
    title: 'Track A qualification evidence',
    content: fixture.chunk.source_text,
    evidence_scope: ['qualification_fact']
  });
  await evidenceService.decide(evidence.id, 'approved', { decided_by: ACTOR });
  return { evidenceService, evidence };
}

test('NC02 historical Retrieval reload reuses Material Authority Gate', async () => {
  const fixture = await seedFixture();
  try {
    const service = new EnterpriseRetrievalService({ repository: fixture.repository });
    const before = await service.get(fixture.runs['REQ-001'].retrieval_run_id);
    assert.equal(before.final_candidates.length, 1, 'valid material positive control');
    await fixture.repository.quarantineCompanyMaterial({ materialId: fixture.material.id, reason: 'NC02' });
    const after = await service.get(fixture.runs['REQ-001'].retrieval_run_id);
    assert.equal(after.final_candidates.length, 0, 'quarantined historical result must not be surfaced');
    assert.equal(after.raw_candidates.length, 0, 'quarantined raw result must not re-enter authority');
  } finally { await cleanup(fixture); }
});

test('NC03 Evidence Review context and decision fail closed after quarantine', async () => {
  const fixture = await seedFixture();
  try {
    const reviewService = new EvidenceReviewService({ repository: fixture.repository });
    const pending = await reviewService.propose({
      projectId: fixture.project.id, requirementId: 'REQ-002',
      retrievalRunId: fixture.runs['REQ-002'].retrieval_run_id,
      retrievalCandidateId: fixture.chunk.chunk_id, sourceSpanId: fixture.spans['REQ-002'].span_id
    });
    await fixture.repository.quarantineCompanyMaterial({ materialId: fixture.material.id, reason: 'NC03' });
    await assert.rejects(
      () => reviewService.propose({
        projectId: fixture.project.id, requirementId: 'REQ-002',
        retrievalRunId: fixture.runs['REQ-002'].retrieval_run_id,
        retrievalCandidateId: fixture.chunk.chunk_id, sourceSpanId: fixture.spans['REQ-002'].span_id
      }),
      error => error?.code === 'EVIDENCE_REVIEW_SOURCE_INVALID',
      'quarantined material must not create a new Review candidate'
    );
    await assert.rejects(
      () => reviewService.decide(pending.review_id, 'approve', { reviewer: ACTOR }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'quarantined review must not be approvable'
    );
    const row = (await fixture.pool.query(`SELECT review_status FROM evidence_candidate_reviews WHERE review_id=$1`, [pending.review_id])).rows[0];
    assert.equal(row.review_status, 'needs_review');
  } finally { await cleanup(fixture); }
});

test('NC04 canonical Fact draft and edit cannot re-enter after quarantine', async () => {
  const fixture = await seedFixture();
  try {
    const reviewService = new EvidenceReviewService({ repository: fixture.repository });
    const review = await approvedReview(fixture, reviewService, 'REQ-001');
    const factService = new EvidenceSourceFactService({
      repository: fixture.repository,
      projectAuthorizationService: new ProjectAuthorizationService({ repository: fixture.repository }),
      extractor: factExtractor()
    });
    const actor = { actor_id: ACTOR, actor_type: 'test', source: 'integration' };
    const created = await factService.extract({ projectId: fixture.project.id, reviewId: review.review_id, actor });
    assert.equal(created.facts.length, 1, 'valid material positive control');
    const factId = created.facts[0].fact_id;
    await fixture.repository.quarantineCompanyMaterial({ materialId: fixture.material.id, reason: 'NC04' });
    await assert.rejects(
      () => factService.extract({ projectId: fixture.project.id, reviewId: review.review_id, actor }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'quarantined material must not create a new canonical Fact'
    );
    await assert.rejects(
      () => factService.edit(factId, { subject: { type: 'organization', name: 'Synthetic Vendor' }, entities: [], status: 'unknown', scopes: [], quantities: [], validity: { status: 'unknown' }, domain_metadata: {} }, { reviewer: ACTOR }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'quarantined material must not create an edited canonical Fact'
    );
  } finally { await cleanup(fixture); }
});

test('NC05 legacy Fact and Mapping mutations cannot regain canonical authority', async () => {
  const fixture = await seedFixture();
  try {
    const reviewService = new EvidenceReviewService({ repository: fixture.repository });
    await approvedReview(fixture, reviewService, 'REQ-001');
    const { evidenceService, evidence } = await evidenceForLegacy(fixture);
    const legacyFactService = new EvidenceFactService({ repository: fixture.repository });
    const fact = await legacyFactService.create(fixture.project.id, evidence.id, {
      fact_type: 'qualification',
      subject: { type: 'organization', name: 'Synthetic Vendor' },
      entities: [], fact_status: 'unknown', fact_scopes: ['qualification_fact'],
      quantities: [], validity: { status: 'unknown' }, created_by: ACTOR
    });
    const mapping = await evidenceService.proposeMapping(fixture.project.id, {
      requirement_id: 'REQ-001', evidence_id: evidence.id, mapping_source: 'manual',
      support_level: 'partial_support', created_by: ACTOR
    });
    await fixture.repository.quarantineCompanyMaterial({ materialId: fixture.material.id, reason: 'NC05' });
    await assert.rejects(
      () => legacyFactService.create(fixture.project.id, evidence.id, {
        fact_type: 'qualification', subject: { type: 'organization', name: 'Synthetic Vendor' },
        entities: [], fact_status: 'unknown', fact_scopes: ['qualification_fact'],
        quantities: [], validity: { status: 'unknown' }, created_by: ACTOR
      }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'legacy Fact creation must fail closed after quarantine'
    );
    await assert.rejects(
      () => evidenceService.proposeMapping(fixture.project.id, {
        requirement_id: 'REQ-001', evidence_id: evidence.id, mapping_source: 'manual',
        support_level: 'partial_support', created_by: ACTOR
      }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'legacy Mapping proposal must fail closed after quarantine'
    );
    await assert.rejects(
      () => legacyFactService.decide(fact.fact_id, 'approved', { reviewed_by: ACTOR }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'legacy Fact approval must fail closed'
    );
    await assert.rejects(
      () => evidenceService.decideMapping(mapping.mapping_id, 'approved', { reviewed_by: ACTOR }),
      error => error?.code === 'MATERIAL_SOURCE_NOT_AUTHORIZED',
      'legacy Mapping approval must fail closed'
    );
  } finally { await cleanup(fixture); }
});
