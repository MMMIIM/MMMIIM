import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPool, PgRepository } from '../src/db.js';
import { createApp } from '../src/app.js';
import { EvidenceReviewService } from '../src/evidence-review-service.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';
import { EvidenceSourceSpanService } from '../src/evidence-source-span-service.js';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';
import { ProjectAuthorizationService } from '../src/project-authorization-service.js';
import { EvidenceSupportReviewEvaluator } from '../src/pipeline/evidence-support-review-evaluator.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const directory = dirname(fileURLToPath(import.meta.url));
const SOURCE = '# 认证 A\n\n项目主体：Synthetic Vendor。\n认证材料：ISO 27001。\n\n# 认证 B\n\n项目主体：Synthetic Vendor。\n认证材料：ISO 27001。';
const TRUSTED_ACTOR_ID = 'integration-trusted-reviewer';

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

function requirementInput(reqId, ordinal) {
  const content = '应具备 ISO 27001 认证。';
  return {
    req_id:reqId, content, source_excerpt:content, source_text:content,
    target_sections:[], ordinal, is_mandatory:false, mandatory_marker:null,
    source_section:null, source_clause_id:null, mandatory_scope_source_text:null,
    mandatory_scope_section:null, exception_clause_ids:[], source_hash:hash(content),
    source_chunk_id:null, category:'requirement', requires_confirmation:false,
    source_page_start:null, source_page_end:null, source_paragraph_start:null,
    source_paragraph_end:null, source_paragraphs_json:[], source_match_type:'exact',
    source_match_score:1, source_resolution_method:'integration', source_verified:true,
    source_status:'verified', confirmation_type:'verified', requirement_category:'qualification',
    writer_eligible:false, classification_review_required:false, atomicity_review_required:false,
    classification_method:'manual', confirmation_reasons:[], risk_flags:[], source_evidence:{},
    deduplication:{}, canonical_rule_version:'integration'
  };
}

function appFor({ repository, evidenceReviewService, evidenceSourceFactService, requirementEvidenceFactMappingService }) {
  return createApp({
    repository, storage:{}, generationService:{}, requirementParseService:{}, requirementSourceService:{},
    productionBetaService:{}, companyMaterialService:{}, evidenceService:{}, evidenceFactService:{},
    enterpriseRetrievalService:{}, documentGenerationService:{}, evidenceReviewService,
    evidenceSourceFactService, requirementEvidenceFactMappingService,
    projectAuthorizationService:new ProjectAuthorizationService({ repository }),
    actorResolver:() => ({ actor_id:'integration-trusted-reviewer', actor_type:'test', source:'test' })
  });
}

async function withServer(app, work) {
  const server = await new Promise((resolvePromise) => {
    const listener = app.listen(0, '127.0.0.1', () => resolvePromise(listener));
  });
  try { return await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())); }
}

async function request(base, path, method='POST', body={}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers:{'content-type':'application/json'},
    body:method === 'GET' ? undefined : JSON.stringify(body)
  });
  return { response, body:await response.json() };
}

async function seedFixture({ requirementIds=['REQ-001'] }={}) {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name:`SEM-P1-004 matrix ${Date.now()}-${Math.random()}` });
  const otherProject = await repository.createProject({ name:`SEM-P1-004 other ${Date.now()}-${Math.random()}` });
  await repository.createProjectMembership({ projectId:project.id, actorId:TRUSTED_ACTOR_ID, role:'OWNER', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
  const material = await repository.createCompanyMaterial({
    projectId:project.id, originalName:'matrix.txt', storageKey:`matrix-${project.id}`,
    materialType:'qualification', mimeType:'text/plain', sizeBytes:Buffer.byteLength(SOURCE),
    fileHash:hash(SOURCE)
  });
  await repository.completeCompanyMaterialExtraction(material.id, SOURCE);
  const chunks = chunkEnterpriseMaterial(material.id, SOURCE, { maxChars:40 });
  await repository.replaceMaterialChunks(material.id, chunks);
  const spanService = new EvidenceSourceSpanService({ repository });
  const strategies = ['auto','paragraph_reconstruction','anchor_only','bounded_paragraph_window'];
  const spans = {};
  for (const [index, reqId] of requirementIds.entries()) {
    spans[reqId] = await spanService.resolve({
      projectId:project.id, materialId:material.id, anchorChunkId:chunks[1].chunk_id,
      strategy:strategies[index % strategies.length]
    });
  }
  const tender = await repository.addTenderFile({ projectId:project.id, originalName:'matrix.txt', storageKey:`matrix-tender-${project.id}`, mimeType:'text/plain', sizeBytes:1 });
  const job = (await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,summary_json) VALUES($1,$2,'succeeded','{}') RETURNING id`, [project.id,tender.id])).rows[0];
  await repository.confirmRequirementBaseline({
    jobId:job.id, confirmedBy:'integration', requirements:requirementIds.map((id,index)=>requirementInput(id,index+1))
  });

  const runs = {};
  for (const reqId of requirementIds) {
    const requirement = (await pool.query(`SELECT * FROM requirements WHERE project_id=$1 AND req_id=$2`, [project.id,reqId])).rows[0];
    const run = await repository.createRetrievalRun({
      projectId:project.id, requirementDbId:requirement.id, requirementRef:reqId,
      queryText:requirement.content, queryHash:hash(requirement.content), model:`integration-${reqId}`,
      version:'1', dimension:3, topK:1, filters:{}, retrievalContractVersion:'production-retrieval-v1',
      candidateK:20, reviewK:8, rerankVersion:'integration', semanticMetadata:{}
    });
    const embedding = (await pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,$3,'1',3,'[1,0,0]') RETURNING embedding_id`, [chunks[1].chunk_id,chunks[1].chunk_hash,`integration-${reqId}`])).rows[0];
    await pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score,raw_vector_rank,raw_similarity,reranked_rank,is_final,content_role,role_compatibility,matched_evidence_needs,rerank_reasons,retrieval_contract_version,rerank_version) VALUES($1,$2,$3,1,1,1,1,1,true,'qualification','preferred','[]','[]','production-retrieval-v1','integration')`, [run.retrieval_run_id,chunks[1].chunk_id,embedding.embedding_id]);
    await pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now() WHERE retrieval_run_id=$1`, [run.retrieval_run_id]);
    runs[reqId] = run;
  }
  const otherMaterial = await repository.createCompanyMaterial({
    projectId:otherProject.id, originalName:'other-matrix.txt', storageKey:`other-matrix-${otherProject.id}`,
    materialType:'qualification', mimeType:'text/plain', sizeBytes:Buffer.byteLength(SOURCE), fileHash:hash(`${SOURCE}-other`)
  });
  await repository.completeCompanyMaterialExtraction(otherMaterial.id, SOURCE);
  const otherChunks = chunkEnterpriseMaterial(otherMaterial.id, SOURCE, { maxChars:40 });
  await repository.replaceMaterialChunks(otherMaterial.id, otherChunks);
  const otherSpan = await new EvidenceSourceSpanService({ repository }).resolve({
    projectId:otherProject.id, materialId:otherMaterial.id, anchorChunkId:otherChunks[1].chunk_id, strategy:'auto'
  });
  const otherTender = await repository.addTenderFile({ projectId:otherProject.id, originalName:'other-matrix.txt', storageKey:`other-matrix-tender-${otherProject.id}`, mimeType:'text/plain', sizeBytes:1 });
  const otherJob = (await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,summary_json) VALUES($1,$2,'succeeded','{}') RETURNING id`, [otherProject.id,otherTender.id])).rows[0];
  await repository.confirmRequirementBaseline({ jobId:otherJob.id, confirmedBy:'integration', requirements:[requirementInput('REQ-001',1)] });
  const otherRequirement = (await pool.query(`SELECT * FROM requirements WHERE project_id=$1 AND req_id='REQ-001'`, [otherProject.id])).rows[0];
  const otherRun = await repository.createRetrievalRun({
    projectId:otherProject.id, requirementDbId:otherRequirement.id, requirementRef:'REQ-001',
    queryText:otherRequirement.content, queryHash:hash(otherRequirement.content), model:'integration-other',
    version:'1', dimension:3, topK:1, filters:{}, retrievalContractVersion:'production-retrieval-v1',
    candidateK:20, reviewK:8, rerankVersion:'integration', semanticMetadata:{}
  });
  const otherEmbedding = (await pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,'integration-other','1',3,'[1,0,0]') RETURNING embedding_id`, [otherChunks[1].chunk_id,otherChunks[1].chunk_hash])).rows[0];
  await pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score,raw_vector_rank,raw_similarity,reranked_rank,is_final,content_role,role_compatibility,matched_evidence_needs,rerank_reasons,retrieval_contract_version,rerank_version) VALUES($1,$2,$3,1,1,1,1,1,true,'qualification','preferred','[]','[]','production-retrieval-v1','integration')`, [otherRun.retrieval_run_id,otherChunks[1].chunk_id,otherEmbedding.embedding_id]);
  await pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now() WHERE retrieval_run_id=$1`, [otherRun.retrieval_run_id]);
  return { pool, repository, project, otherProject, material, chunks, span:spans[requirementIds[0]], spans, anchors:{...Object.fromEntries(requirementIds.map((id)=>[id,chunks[1]]))}, runs, otherRun, otherSpan, otherAnchor:otherChunks[1] };
}

async function cleanup(fixture) {
  await fixture.pool.query(`DELETE FROM projects WHERE id=ANY($1::uuid[])`, [[fixture.project.id,fixture.otherProject.id]]);
  await fixture.pool.end();
}

function factExtractor() {
  return {
    version:'integration-fact-extractor-v1',
    async extract() {
      return [{ subject:{type:'organization',name:'Synthetic Vendor'}, entities:[], status:'unknown', scopes:[], quantities:[], validity:{status:'unknown'}, domain_metadata:{} }];
    }
  };
}

function mappingEvaluator() {
  return {
    version:'integration-mapping-evaluator-v1',
    async evaluate() {
      return {
        source_type:'system_proposed', semantic_relationship:'direct', support_level:'partial_support',
        dimensions:{subject_match:'match',scope_match:'match',status_match:'unknown',quantitative_match:'unknown',entity_match:'match',validity_match:'unknown',support_sufficiency:'unknown'},
        reason_codes:['SUPPORT_PARTIAL']
      };
    }
  };
}

test('SEM-P1-004 Proposal HTTP entry matrix P1-P6 with PostgreSQL persistence', async () => {
  const fixture = await seedFixture();
  const evidenceReviewService = new EvidenceReviewService({ repository:fixture.repository });
  const app = appFor({ repository:fixture.repository, evidenceReviewService });
  try {
    const valid = { retrieval_run_id:fixture.runs['REQ-001'].retrieval_run_id, retrieval_candidate_id:fixture.anchors['REQ-001'].chunk_id, source_span_id:fixture.spans['REQ-001'].span_id };
    const invalidCases = [
      ['P1 wrong project candidate', `/api/projects/${fixture.otherProject.id}/requirements/REQ-001/evidence-reviews`, valid],
      ['P2 wrong requirement', `/api/projects/${fixture.project.id}/requirements/REQ-999/evidence-reviews`, valid],
      ['P3 candidate/span mismatch', `/api/projects/${fixture.project.id}/requirements/REQ-001/evidence-reviews`, { ...valid, retrieval_candidate_id:'MCH-NOT-THE-SPAN' }],
      ['P4 missing exact span', `/api/projects/${fixture.project.id}/requirements/REQ-001/evidence-reviews`, { retrieval_run_id:valid.retrieval_run_id, retrieval_candidate_id:valid.retrieval_candidate_id }]
    ];
    await withServer(app, async (base) => {
      for (const [label,path,body] of invalidCases) {
        const result = await request(base,path,'POST',body);
        const unauthorized = label === 'P1 wrong project candidate';
        assert.equal(result.response.status, unauthorized ? 403 : 422, label);
        assert.equal(result.body.error.code, unauthorized ? 'PROJECT_ACCESS_DENIED' : 'EVIDENCE_REVIEW_SOURCE_INVALID', label);
      }
      assert.equal((await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_candidate_reviews WHERE project_id=$1`, [fixture.project.id])).rows[0].count,0);

      const first = await request(base,`/api/projects/${fixture.project.id}/requirements/REQ-001/evidence-reviews`,'POST',valid);
      assert.equal(first.response.status,201);
      const reviewId = first.body.data.review.review_id;
      const duplicate = await request(base,`/api/projects/${fixture.project.id}/requirements/REQ-001/evidence-reviews`,'POST',valid);
      assert.equal(duplicate.response.status,201);
      assert.equal(duplicate.body.data.review.review_id,reviewId);
      assert.equal((await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_candidate_reviews WHERE review_id=$1`, [reviewId])).rows[0].count,1);

      await fixture.pool.query(`UPDATE evidence_source_spans SET source_text_hash=repeat('0',64) WHERE span_id=$1`, [fixture.spans['REQ-001'].span_id]);
      const stale = await request(base,`/api/evidence-reviews/${reviewId}/approve`,'POST',{});
      assert.equal(stale.response.status,409);
      assert.equal(stale.body.error.code,'EVIDENCE_REVIEW_VERSION_INVALIDATED');
      assert.equal((await fixture.pool.query(`SELECT review_status FROM evidence_candidate_reviews WHERE review_id=$1`, [reviewId])).rows[0].review_status,'invalidated');
    });
  } finally { await cleanup(fixture); }
});

test('SEM-P1-004 Review-to-Fact HTTP routes enforce approval and persist only approved lineage', async () => {
  const fixture = await seedFixture({ requirementIds:['REQ-001','REQ-002','REQ-003'] });
  const evidenceReviewService = new EvidenceReviewService({ repository:fixture.repository });
  const evidenceSourceFactService = new EvidenceSourceFactService({ repository:fixture.repository, projectAuthorizationService:new ProjectAuthorizationService({ repository:fixture.repository }), extractor:factExtractor() });
  const app = appFor({ repository:fixture.repository, evidenceReviewService, evidenceSourceFactService });
  try {
    await withServer(app, async (base) => {
      const propose = async (reqId) => request(base,`/api/projects/${fixture.project.id}/requirements/${reqId}/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs[reqId].retrieval_run_id, retrieval_candidate_id:fixture.anchors[reqId].chunk_id, source_span_id:fixture.spans[reqId].span_id });
      const factCount = async () => (await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_source_facts WHERE project_id=$1`, [fixture.project.id])).rows[0].count;

      const unapproved = await propose('REQ-001');
      assert.equal((await request(base,`/api/evidence-reviews/${unapproved.body.data.review.review_id}/facts`)).response.status,409);
      assert.equal((await factCount()),0);

      const approved = await request(base,`/api/evidence-reviews/${unapproved.body.data.review.review_id}/approve`,'POST',{});
      assert.equal(approved.response.status,200);
      const created = await request(base,`/api/projects/${fixture.project.id}/evidence-reviews/${unapproved.body.data.review.review_id}/facts`,'POST',{});
      assert.equal(created.response.status,201);
      assert.equal(created.body.data.facts.length,1);
      assert.equal((await factCount()),1);
      assert.equal((await fixture.pool.query(`SELECT review_status FROM evidence_source_facts WHERE project_id=$1`, [fixture.project.id])).rows[0].review_status,'draft');

      const rejected = await propose('REQ-002');
      const rejectedDecision = await request(base,`/api/evidence-reviews/${rejected.body.data.review.review_id}/reject`,'POST',{});
      assert.equal(rejectedDecision.response.status,200);
      const rejectedFact = await request(base,`/api/evidence-reviews/${rejected.body.data.review.review_id}/facts`,'POST',{});
      assert.equal(rejectedFact.response.status,409);
      assert.equal(rejectedFact.body.error.code,'EVIDENCE_REVIEW_NOT_APPROVED');
      assert.equal(await factCount(),1);

      const stale = await propose('REQ-003');
      await fixture.pool.query(`UPDATE evidence_source_spans SET source_text_hash=repeat('1',64) WHERE span_id=$1`, [fixture.spans['REQ-003'].span_id]);
      const staleDecision = await request(base,`/api/evidence-reviews/${stale.body.data.review.review_id}/approve`,'POST',{});
      assert.equal(staleDecision.response.status,409);
      assert.equal(staleDecision.body.error.code,'EVIDENCE_REVIEW_VERSION_INVALIDATED');
      const invalidatedFact = await request(base,`/api/evidence-reviews/${stale.body.data.review.review_id}/facts`,'POST',{});
      assert.equal(invalidatedFact.response.status,409);
      assert.equal(invalidatedFact.body.error.code,'EVIDENCE_REVIEW_NOT_APPROVED');
      assert.equal((await fixture.pool.query(`SELECT review_status FROM evidence_candidate_reviews WHERE review_id=$1`, [stale.body.data.review.review_id])).rows[0].review_status,'invalidated');
      assert.equal(await factCount(),1);

      const crossProjectProposal = await request(base,`/api/projects/${fixture.otherProject.id}/requirements/REQ-001/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs['REQ-001'].retrieval_run_id, retrieval_candidate_id:fixture.anchors['REQ-001'].chunk_id, source_span_id:fixture.spans['REQ-001'].span_id });
      assert.equal(crossProjectProposal.response.status,403);
      assert.equal(crossProjectProposal.body.error.code,'PROJECT_ACCESS_DENIED');
      assert.equal((await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_source_facts WHERE project_id=$1`, [fixture.otherProject.id])).rows[0].count,0);
    });
  } finally { await cleanup(fixture); }
});

test('P0 Review-to-Fact authorization NC1-NC15 and original cross-project exploit regression', async () => {
  const fixture = await seedFixture({ requirementIds:['REQ-001','REQ-002','REQ-003','REQ-004','REQ-005','REQ-006','REQ-007','REQ-008','REQ-009'] });
  const evidenceReviewService = new EvidenceReviewService({ repository:fixture.repository });
  const evidenceSourceFactService = new EvidenceSourceFactService({ repository:fixture.repository, projectAuthorizationService:new ProjectAuthorizationService({ repository:fixture.repository }), extractor:factExtractor() });
  const app = appFor({ repository:fixture.repository, evidenceReviewService, evidenceSourceFactService });
  try {
    await withServer(app, async (base) => {
      const factCount = async (projectId) => (await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_source_facts WHERE project_id=$1`, [projectId])).rows[0].count;
      const propose = async (projectId, reqId, run, anchor, span) => request(base,`/api/projects/${projectId}/requirements/${reqId}/evidence-reviews`,'POST',{ retrieval_run_id:run.retrieval_run_id, retrieval_candidate_id:anchor.chunk_id, source_span_id:span.span_id });
      const approve = async (reviewId) => request(base,`/api/evidence-reviews/${reviewId}/approve`,'POST',{});
      const extract = async (projectId, reviewId, body={}) => request(base,`/api/projects/${projectId}/evidence-reviews/${reviewId}/facts`,'POST',body);

      const ownerReview = await propose(fixture.project.id,'REQ-001',fixture.runs['REQ-001'],fixture.anchors['REQ-001'],fixture.spans['REQ-001']);
      await approve(ownerReview.body.data.review.review_id);
      const ownerFact = await extract(fixture.project.id,ownerReview.body.data.review.review_id);
      assert.equal(ownerFact.response.status,201,'NC1 OWNER');
      const countAfterOwner = await factCount(fixture.project.id);

      await fixture.repository.upsertProjectMembership({ projectId:fixture.project.id, actorId:TRUSTED_ACTOR_ID, role:'EDITOR', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
      const editorReview = await propose(fixture.project.id,'REQ-002',fixture.runs['REQ-002'],fixture.anchors['REQ-002'],fixture.spans['REQ-002']);
      await approve(editorReview.body.data.review.review_id);
      const editorFact = await extract(fixture.project.id,editorReview.body.data.review.review_id);
      assert.equal(editorFact.response.status,201,'NC2 EDITOR');

      await fixture.repository.upsertProjectMembership({ projectId:fixture.project.id, actorId:TRUSTED_ACTOR_ID, role:'VIEWER', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
      const viewerReview = await propose(fixture.project.id,'REQ-003',fixture.runs['REQ-003'],fixture.anchors['REQ-003'],fixture.spans['REQ-003']);
      assert.equal(viewerReview.response.status,403,'NC3 VIEWER proposal');
      assert.equal(viewerReview.body.error.code,'PROJECT_ACCESS_DENIED');
      const countBeforeViewer = await factCount(fixture.project.id);
      assert.equal(await factCount(fixture.project.id),countBeforeViewer);

      await fixture.repository.upsertProjectMembership({ projectId:fixture.project.id, actorId:TRUSTED_ACTOR_ID, role:'OWNER', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
      await fixture.repository.upsertProjectMembership({ projectId:fixture.otherProject.id, actorId:TRUSTED_ACTOR_ID, role:'OWNER', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
      const otherReview = await propose(fixture.otherProject.id,'REQ-001',fixture.otherRun,fixture.otherAnchor,fixture.otherSpan);
      await approve(otherReview.body.data.review.review_id);
      await fixture.repository.revokeProjectMembership({ projectId:fixture.otherProject.id, actorId:TRUSTED_ACTOR_ID });
      const otherBefore = await factCount(fixture.otherProject.id);
      const legacyCrossProject = await request(base,`/api/evidence-reviews/${otherReview.body.data.review.review_id}/facts`,'POST',{});
      assert.equal(legacyCrossProject.response.status,403,'NC4 legacy cross-project exploit');
      assert.equal(await factCount(fixture.otherProject.id),otherBefore);
      const routeProjectB = await extract(fixture.otherProject.id,otherReview.body.data.review.review_id);
      assert.equal(routeProjectB.response.status,403,'NC5 route project B without membership');
      assert.equal(await factCount(fixture.otherProject.id),otherBefore);
      const routeProjectAOtherReview = await extract(fixture.project.id,otherReview.body.data.review.review_id);
      assert.equal(routeProjectAOtherReview.response.status,404,'NC6 route A with project B review');
      assert.equal(await factCount(fixture.project.id),countAfterOwner + 1);

      await fixture.repository.revokeProjectMembership({ projectId:fixture.project.id, actorId:TRUSTED_ACTOR_ID });
      const noMembership = await extract(fixture.project.id,ownerReview.body.data.review.review_id);
      assert.equal(noMembership.response.status,403,'NC7 no membership');
      assert.equal(await factCount(fixture.project.id),countAfterOwner + 1);
      const revoked = await extract(fixture.project.id,editorReview.body.data.review.review_id);
      assert.equal(revoked.response.status,403,'NC8 revoked membership');
      assert.equal(await factCount(fixture.project.id),countAfterOwner + 1);
      const historical = await extract(fixture.otherProject.id,otherReview.body.data.review.review_id);
      assert.equal(historical.response.status,403,'NC9 historical unassigned project');
      assert.equal(await factCount(fixture.otherProject.id),otherBefore);

      await fixture.repository.upsertProjectMembership({ projectId:fixture.project.id, actorId:TRUSTED_ACTOR_ID, role:'OWNER', status:'ACTIVE', createdBy:TRUSTED_ACTOR_ID });
      const unapprovedReview = await propose(fixture.project.id,'REQ-004',fixture.runs['REQ-004'],fixture.anchors['REQ-004'],fixture.spans['REQ-004']);
      const countBeforeUnapproved = await factCount(fixture.project.id);
      const unapproved = await extract(fixture.project.id,unapprovedReview.body.data.review.review_id);
      assert.equal(unapproved.response.status,409,'NC10 unapproved');
      assert.equal(await factCount(fixture.project.id),countBeforeUnapproved);

      const rejectedReview = await propose(fixture.project.id,'REQ-005',fixture.runs['REQ-005'],fixture.anchors['REQ-005'],fixture.spans['REQ-005']);
      await request(base,`/api/evidence-reviews/${rejectedReview.body.data.review.review_id}/reject`,'POST',{});
      const rejected = await extract(fixture.project.id,rejectedReview.body.data.review.review_id);
      assert.equal(rejected.response.status,409,'NC11 rejected');
      assert.equal(await factCount(fixture.project.id),countBeforeUnapproved);

      const staleReview = await propose(fixture.project.id,'REQ-006',fixture.runs['REQ-006'],fixture.anchors['REQ-006'],fixture.spans['REQ-006']);
      await approve(staleReview.body.data.review.review_id);
      await fixture.pool.query(`UPDATE evidence_source_spans SET source_text_hash=repeat('2',64) WHERE span_id=$1`, [fixture.spans['REQ-006'].span_id]);
      const stale = await extract(fixture.project.id,staleReview.body.data.review.review_id);
      assert.equal(stale.response.status,409,'NC12 stale');
      assert.equal(stale.body.error.code,'EVIDENCE_REVIEW_VERSION_INVALIDATED');
      assert.equal(await factCount(fixture.project.id),countBeforeUnapproved);

      const unknown = await extract(fixture.project.id,'missing-review-id');
      assert.equal(unknown.response.status,404,'NC13 unknown review');
      assert.equal(await factCount(fixture.project.id),countBeforeUnapproved);

      const actorReview = await propose(fixture.project.id,'REQ-007',fixture.runs['REQ-007'],fixture.anchors['REQ-007'],fixture.spans['REQ-007']);
      await approve(actorReview.body.data.review.review_id);
      const clientActor = await extract(fixture.project.id,actorReview.body.data.review.review_id,{ actor_id:'client-spoof', actor:'client-spoof', reviewer:'client-spoof', editor:'client-spoof' });
      assert.equal(clientActor.response.status,201,'NC14 client actor cannot override trusted actor');
      const countAfterClientActor = await factCount(fixture.project.id);

      const duplicate = await extract(fixture.project.id,actorReview.body.data.review.review_id);
      assert.equal(duplicate.response.status,201,'NC15 duplicate idempotency');
      assert.equal(await factCount(fixture.project.id),countAfterClientActor);
    });
  } finally { await cleanup(fixture); }
});

test('SEM-P1-004 Fact-to-Mapping HTTP routes reject non-approved or cross-project Facts', async () => {
  const fixture = await seedFixture({ requirementIds:['REQ-001','REQ-002','REQ-003','REQ-004'] });
  const evidenceReviewService = new EvidenceReviewService({ repository:fixture.repository });
  const evidenceSourceFactService = new EvidenceSourceFactService({ repository:fixture.repository, projectAuthorizationService:new ProjectAuthorizationService({ repository:fixture.repository }), extractor:factExtractor() });
  const requirementEvidenceFactMappingService = new RequirementEvidenceFactMappingService({ repository:fixture.repository, evaluator:mappingEvaluator() });
  const app = appFor({ repository:fixture.repository, evidenceReviewService, evidenceSourceFactService, requirementEvidenceFactMappingService });
  try {
    await withServer(app, async (base) => {
      const proposeAndExtract = async (reqId) => {
        const proposal = await request(base,`/api/projects/${fixture.project.id}/requirements/${reqId}/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs[reqId].retrieval_run_id, retrieval_candidate_id:fixture.anchors[reqId].chunk_id, source_span_id:fixture.spans[reqId].span_id });
        const reviewId = proposal.body.data.review.review_id;
        assert.equal((await request(base,`/api/evidence-reviews/${reviewId}/approve`,'POST',{})).response.status,200);
        const fact = await request(base,`/api/projects/${fixture.project.id}/evidence-reviews/${reviewId}/facts`,'POST',{});
        assert.equal(fact.response.status,201);
        assert.equal(fact.body.data.facts[0].review_status,'draft');
        return fact.body.data.facts[0].fact_id;
      };
      const mappingCount = async (projectId=fixture.project.id) => (await fixture.pool.query(`SELECT count(*)::int AS count FROM requirement_evidence_fact_mappings WHERE project_id=$1`, [projectId])).rows[0].count;

      const approvedFact = await proposeAndExtract('REQ-001');
      assert.equal((await request(base,`/api/evidence-source-facts/${approvedFact}/approve`,'POST',{})).response.status,200);
      const allowed = await request(base,`/api/projects/${fixture.project.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-001', fact_id:approvedFact, source_type:'system_proposed' });
      assert.equal(allowed.response.status,201);
      assert.equal(allowed.body.data.mapping.review_status,'proposed');
      assert.equal(await mappingCount(),1);
      const approvedDecision = await request(base,`/api/requirement-evidence-fact-mappings/${allowed.body.data.mapping.mapping_id}/approve`,'POST',{});
      assert.equal(approvedDecision.response.status,200);
      assert.equal((await fixture.pool.query(`SELECT review_status FROM requirement_evidence_fact_mappings WHERE mapping_id=$1`, [allowed.body.data.mapping.mapping_id])).rows[0].review_status,'approved');

      const draftFact = await proposeAndExtract('REQ-002');
      assert.equal((await fixture.pool.query(`SELECT review_status FROM evidence_source_facts WHERE fact_id=$1`, [draftFact])).rows[0].review_status,'draft');
      const draftMapping = await request(base,`/api/projects/${fixture.project.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-002', fact_id:draftFact, source_type:'system_proposed' });
      assert.equal(draftMapping.response.status,409);
      assert.equal(draftMapping.body.error.code,'FACT_NOT_APPROVED');
      assert.equal(await mappingCount(),1);

      const rejectedFact = await proposeAndExtract('REQ-003');
      assert.equal((await request(base,`/api/evidence-source-facts/${rejectedFact}/reject`,'POST',{})).response.status,200);
      const rejectedMapping = await request(base,`/api/projects/${fixture.project.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-003', fact_id:rejectedFact, source_type:'system_proposed' });
      assert.equal(rejectedMapping.response.status,409);
      assert.equal(rejectedMapping.body.error.code,'FACT_NOT_APPROVED');
      assert.equal(await mappingCount(),1);

      const invalidatedFact = await proposeAndExtract('REQ-004');
      await fixture.pool.query(`UPDATE evidence_source_facts SET review_status='invalidated' WHERE fact_id=$1`, [invalidatedFact]);
      const invalidatedMapping = await request(base,`/api/projects/${fixture.project.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-004', fact_id:invalidatedFact, source_type:'system_proposed' });
      assert.equal(invalidatedMapping.response.status,409);
      assert.equal(invalidatedMapping.body.error.code,'FACT_NOT_APPROVED');
      assert.equal(await mappingCount(),1);

      const crossProject = await request(base,`/api/projects/${fixture.otherProject.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-001', fact_id:approvedFact, source_type:'system_proposed' });
      assert.equal(crossProject.response.status,403);
      assert.equal(crossProject.body.error.code,'PROJECT_ACCESS_DENIED');
      const wrongRequirement = await request(base,`/api/projects/${fixture.project.id}/requirement-evidence-fact-mappings`,'POST',{ requirement_id:'REQ-999', fact_id:approvedFact, source_type:'system_proposed' });
      assert.equal(wrongRequirement.response.status,404);
      assert.equal(wrongRequirement.body.error.code,'MAPPING_TARGET_NOT_FOUND');
      assert.equal(await mappingCount(),1);
    });
  } finally { await cleanup(fixture); }
});

test('Stage20 Evidence Support routing is enforced at the real HTTP entry and persists only canonical reviews', async () => {
  const fixture = await seedFixture({ requirementIds:['REQ-001','REQ-002','REQ-003'] });
  let semanticCalls = 0;
  const adjudicator = {
    async adjudicate({ requirement, evidence }) {
      semanticCalls += 1;
      if (requirement.requirement_id === 'REQ-003') {
        throw Object.assign(new Error('semantic adjudication unavailable'), { code:'ASSESSMENT_UNAVAILABLE', status:503 });
      }
      return {
        semantic_relevance:'relevant',
        evidence_capability:'capable',
        support_level:'partial_support',
        semantic_relationship:'partial',
        review_dimensions:{
          subject_match:'match', scope_match:'unknown', status_match:'unknown',
          quantitative_match:'unknown', entity_match:'match', validity_match:'unknown',
          source_authority:'unknown', support_sufficiency:'unknown'
        },
        reason_codes:[],
        support_observations:[{
          source_id:evidence.source_id,
          source_span_id:evidence.source_span_id,
          support_excerpt:evidence.source_text.slice(0, 8),
          observation_type:'partial_support',
          reason_codes:[]
        }]
      };
    }
  };
  const evaluator = new EvidenceSupportReviewEvaluator({ semanticAdjudicator:adjudicator });
  const evidenceReviewService = new EvidenceReviewService({ repository:fixture.repository, evidenceSupportEvaluator:evaluator });
  const app = appFor({ repository:fixture.repository, evidenceReviewService });
  const reviewCount = async projectId => (await fixture.pool.query(`SELECT count(*)::int AS count FROM evidence_candidate_reviews WHERE project_id=$1`, [projectId])).rows[0].count;
  try {
    await fixture.pool.query(`UPDATE enterprise_retrieval_results SET candidate_eligibility='OUT_OF_SCOPE' WHERE retrieval_run_id=$1 AND chunk_id=$2`, [fixture.runs['REQ-001'].retrieval_run_id, fixture.anchors['REQ-001'].chunk_id]);
    await withServer(app, async (base) => {
      const deterministic = await request(base,`/api/projects/${fixture.project.id}/requirements/REQ-001/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs['REQ-001'].retrieval_run_id, retrieval_candidate_id:fixture.anchors['REQ-001'].chunk_id, source_span_id:fixture.spans['REQ-001'].span_id });
      assert.equal(deterministic.response.status,201,JSON.stringify(deterministic.body));
      assert.equal(deterministic.body.data.review.semantic_relevance,'irrelevant');
      assert.equal(deterministic.body.data.review.support_level,'insufficient');
      assert.equal(semanticCalls,0);
      assert.equal(await reviewCount(fixture.project.id),1);

      const ambiguous = await request(base,`/api/projects/${fixture.project.id}/requirements/REQ-002/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs['REQ-002'].retrieval_run_id, retrieval_candidate_id:fixture.anchors['REQ-002'].chunk_id, source_span_id:fixture.spans['REQ-002'].span_id });
      assert.equal(ambiguous.response.status,201,JSON.stringify(ambiguous.body));
      assert.equal(ambiguous.body.data.review.support_level,'partial_support');
      assert.equal(semanticCalls,1);
      assert.equal(await reviewCount(fixture.project.id),2);

      const technical = await request(base,`/api/projects/${fixture.project.id}/requirements/REQ-003/evidence-reviews`,'POST',{ retrieval_run_id:fixture.runs['REQ-003'].retrieval_run_id, retrieval_candidate_id:fixture.anchors['REQ-003'].chunk_id, source_span_id:fixture.spans['REQ-003'].span_id });
      assert.equal(technical.response.status,503,JSON.stringify(technical.body));
      assert.equal(technical.body.error.code,'ASSESSMENT_UNAVAILABLE');
      assert.equal(semanticCalls,2);
      assert.equal(await reviewCount(fixture.project.id),2);

      const unauthorized = await request(base,`/api/projects/${fixture.otherProject.id}/requirements/REQ-001/evidence-reviews`,'POST',{ retrieval_run_id:fixture.otherRun.retrieval_run_id, retrieval_candidate_id:fixture.otherAnchor.chunk_id, source_span_id:fixture.otherSpan.span_id });
      assert.equal(unauthorized.response.status,403,JSON.stringify(unauthorized.body));
      assert.equal(unauthorized.body.error.code,'PROJECT_ACCESS_DENIED');
      assert.equal(await reviewCount(fixture.otherProject.id),0);
    });
  } finally { await cleanup(fixture); }
});
