import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { createPool, PgRepository } from '../src/db.js';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';
import { EvidenceService } from '../src/evidence-service.js';
import { EvidenceSourceSpanService } from '../src/evidence-source-span-service.js';
import { createEvidenceFactContract } from '../src/pipeline/evidence-fact-contract-v1.js';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';

dotenv.config({ path: resolve('.env') });

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

test('Mapping→Claim production path uses canonical Fact Mapping and never falls back to legacy Mapping', async () => {
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `Canonical Claim authority ${Date.now()}` });
  try {
    const requirementText = '相关项目应完成中标交付。';
    const file = (await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'canonical-claim.txt',$2,'text/plain',1) RETURNING *`, [project.id, `canonical-claim-${project.id}`])).rows[0];
    const job = (await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`, [project.id, file.id])).rows[0];
    const baseline = (await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`, [project.id, job.id])).rows[0];
    const requirement = (await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible,classification_review_required,atomicity_review_required,canonical_rule_version) VALUES($1,$2,'REQ-001',$3,$3,$3,false,'["chapter-05"]',1,'verified','verified','technical',true,false,false,'4.3-canonical-requirement-1') RETURNING *`, [baseline.id, project.id, requirementText])).rows[0];
    await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='integration',confirmation_type='verified' WHERE id=$1`, [baseline.id]);
    const sourceText = '相关项目中标并完成交付。';
    const material = await repository.createCompanyMaterial({ projectId: project.id, originalName: 'canonical-source.txt', storageKey: `canonical-source-${project.id}`, materialType: 'project_case', mimeType: 'text/plain', sizeBytes: Buffer.byteLength(sourceText), fileHash: hash(sourceText) });
    await repository.completeCompanyMaterialExtraction(material.id, sourceText);
    const chunks = chunkEnterpriseMaterial(material.id, sourceText);
    await repository.replaceMaterialChunks(material.id, chunks);
    const span = await new EvidenceSourceSpanService({ repository }).resolve({ projectId: project.id, materialId: material.id, anchorChunkId: chunks[0].chunk_id });
    const run = await repository.createRetrievalRun({ projectId: project.id, requirementDbId: requirement.id, requirementRef: 'REQ-001', queryText: requirementText, queryHash: hash(requirementText), model: 'integration', version: '1', dimension: 3, topK: 1, filters: {}, retrievalContractVersion: 'production-retrieval-v1', candidateK: 1, reviewK: 1, rerankVersion: 'integration', semanticMetadata: {} });
    const embedding = (await pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,'integration','1',3,'[1,0,0]') RETURNING embedding_id`, [chunks[0].chunk_id, chunks[0].chunk_hash])).rows[0];
    await pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score,raw_vector_rank,raw_similarity,reranked_rank,is_final,content_role,role_compatibility,matched_evidence_needs,rerank_reasons,retrieval_contract_version,rerank_version) VALUES($1,$2,$3,1,1,1,1,1,true,'qualification','preferred','[]','[]','production-retrieval-v1','integration')`, [run.retrieval_run_id, chunks[0].chunk_id, embedding.embedding_id]);
    await pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now() WHERE retrieval_run_id=$1`, [run.retrieval_run_id]);
    const reviewId = `ER-CANONICAL-${project.id}`;
    await repository.upsertEvidenceCandidateReview({ review_id: reviewId, project_id: project.id, requirement_id: requirement.id, retrieval_run_id: run.retrieval_run_id, retrieval_candidate_id: chunks[0].chunk_id, source_span_id: span.span_id, requirement_text_hash: hash(requirementText), source_text_hash: span.source_text_hash, semantic_relevance: 'relevant', evidence_capability: 'capable', support_level: 'full_support', review_dimensions: {}, reason_codes: [], requires_human_review: false, review_status: 'approved', reviewer_type: 'human', reviewer_version: 'integration', semantic_reviewer_version: 'integration', contract_version: 'evidence-review-v1' });
    const fact = createEvidenceFactContract({ project_id: project.id, review_id: reviewId, source_span_id: span.span_id, material_id: material.id, source_text: span.source_text, source_text_hash: span.source_text_hash, anchor_chunk_id: chunks[0].chunk_id }, { subject: { type: 'project', name: '相关项目' }, entities: [], status: 'award', status_source_text: '中标', scopes: ['award_fact'], scope_source_texts: { award_fact: '中标' }, quantities: [], validity: { status: 'unknown' } }, { extractorType: 'machine', extractorVersion: 'integration-canonical' });
    await repository.upsertEvidenceSourceFact(fact);
    await repository.decideEvidenceSourceFact({ factId: fact.fact_id, status: 'approved', reviewer: 'integration', note: null });
    const mappingId = 'MAP-CANONICAL-001';
    await pool.query(`INSERT INTO requirement_evidence_fact_mappings(mapping_id,project_id,requirement_id,evidence_fact_id,source_type,source,semantic_relationship,support_level,dimensions,reason_codes,review_status,reviewer_type,evaluator_version,contract_version,requirement_hash,requirement_contract_version,fact_payload_hash,fact_contract_version,reviewed_by,reviewed_at) VALUES($1,$2,$3,$4,'manual',$5::jsonb,'direct','full_support','{}','[]','approved','human','integration','requirement-evidence-mapping-v1.1',$6,'4.3-canonical-requirement-1',$7,'evidence-fact-v1','integration',now())`, [mappingId, project.id, requirement.id, fact.fact_id, JSON.stringify({ source_span_id: span.span_id }), hash(requirementText), fact.payload_hash]);

    const legacyEvidence = await new EvidenceService({ repository }).create(project.id, { material_id: material.id, source_chunk_id: chunks[0].chunk_id, evidence_type: 'project_case', title: 'legacy mapping only', content: sourceText, applicable_requirement_ids: ['REQ-001'] });
    await new EvidenceService({ repository }).setValidity(legacyEvidence.id, { validity_status: 'active', reviewed_by: 'integration' });
    await new EvidenceService({ repository }).decide(legacyEvidence.id, 'approved', { decided_by: 'integration' });
    const legacyMapping = (await pool.query(`INSERT INTO requirement_evidence_mappings(requirement_id,evidence_id,mapping_source,mapping_status,support_level,created_by,reviewed_by,reviewed_at) VALUES($1,$2,'manual','approved','full_support','integration','integration',now()) RETURNING mapping_id`, [requirement.id, legacyEvidence.id])).rows[0];

    const service = new ProductionBetaService({ repository });
    await service.generatePlans(project.id);
    await service.generateClaims(project.id);
    let claims = await repository.listClaims(project.id);
    let evidenceClaim = claims.find((item) => item.claim_type === 'evidence_support');
    assert.ok(evidenceClaim, 'approved canonical Mapping should create an evidence support Claim');
    const evaluation = await repository.getLatestClaimGateEvaluation(project.id, evidenceClaim.claim_id);
    assert.deepEqual(evaluation.mapping_ids, [mappingId]);
    assert.deepEqual(evaluation.evidence_ids, [fact.fact_id]);
    assert.equal(evaluation.mapping_ids.includes(legacyMapping.mapping_id), false);

    await pool.query(`UPDATE requirement_evidence_fact_mappings SET review_status='invalidated' WHERE mapping_id=$1`, [mappingId]);
    await service.generateClaims(project.id);
    claims = await repository.listClaims(project.id);
    assert.equal(claims.some((item) => item.claim_type === 'evidence_support'), false, 'legacy-only support must not become a new Claim');
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM claims WHERE project_id=$1 AND claim_type='evidence_support'`, [project.id])).rows[0].count, 0);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]);
    await pool.end();
  }
});
