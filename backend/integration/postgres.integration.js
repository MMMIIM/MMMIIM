import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createPool, PgRepository } from '../src/db.js';
import { createDifyClient } from '../src/dify.js';
import { GenerationService } from '../src/service.js';
import { DeterministicPipelineService } from '../src/pipeline/generation-audit.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';
import { SemanticGatewayError } from '../src/pipeline/semantic-gateway-client.js';
import { ProductionBetaService } from '../src/pipeline/production-beta-service.js';
import { RequirementSourceService } from '../src/requirement-source-service.js';
import { createApp } from '../src/app.js';
import { CompanyMaterialService } from '../src/company-material-service.js';
import { EvidenceService } from '../src/evidence-service.js';
import { ProductionTaskProvider } from '../src/pipeline/production-task-provider.js';
import { DocumentGenerationService } from '../src/pipeline/document-generation-service.js';
import { WriterProvider } from '../src/pipeline/writer-provider.js';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';
import { EnterpriseRetrievalService } from '../src/pipeline/enterprise-retrieval-service.js';
import { EmbeddingError } from '../src/pipeline/embedding-client.js';
import { EvidenceFactService } from '../src/evidence-fact-service.js';
import { EvidenceSourceContextResolver } from '../src/pipeline/evidence-source-context-resolver.js';
import { EvidenceSourceSpanService } from '../src/evidence-source-span-service.js';
import { EvidenceReviewService } from '../src/evidence-review-service.js';
import { PRE_REVIEW_STAGING_ROLE } from '../src/evidence-lifecycle.js';

test('External Writer PostgreSQL 审计状态按请求生命周期持久化',async()=>{const pool=createPool(),repository=new PgRepository(pool),project=await repository.createProject({name:`Writer lifecycle ${Date.now()}`});try{const authorizationId=`LOCAL-LIFECYCLE-${randomUUID()}`,audit=await repository.createExternalWriterCallAudit({writer_task_id:'WT-LOCAL-LIFECYCLE',project_id:project.id,provider:'LocalFixture',model:'fixture',endpoint_host:'127.0.0.1',sanitized_request_hash:'0'.repeat(64),authorization_id:authorizationId});assert.equal(audit.status,'created');let row=await repository.transitionExternalWriterCallAudit(audit.id,'dispatched',{});assert.equal(row.status,'dispatched');assert.ok(row.dispatched_at);row=await repository.transitionExternalWriterCallAudit(audit.id,'response_received',{provider_request_id:'local-request',http_status:200,latency_ms:12});assert.equal(row.status,'response_received');assert.ok(row.response_received_at);assert.equal(row.http_status,200);row=await repository.finishExternalWriterCallAudit(audit.id,{status:'completed',provider_request_id:'local-request',http_status:200,latency_ms:12,json_parse_success:true,schema_validation_success:true,top_level_keys:['blocks'],missing_required_fields:[],unexpected_fields:[],field_type_mismatches:[],blocks_count:1,block_missing_fields:[],schema_error_paths:[],schema_error_codes:[]});assert.equal(row.status,'completed');assert.ok(row.finished_at);assert.equal(row.error_code,null);assert.deepEqual(row.top_level_keys,['blocks']);assert.equal(row.blocks_count,1);assert.deepEqual(row.schema_error_codes,[]);}finally{await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]);await pool.end();}});

const directory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(directory, '../.env') });
process.env.BACKEND_DEV_ACTOR_ID = process.env.BACKEND_DEV_ACTOR_ID || 'validity-reviewer';
const INTEGRATION_ACTOR_ID = process.env.BACKEND_DEV_ACTOR_ID;

async function authorizeIntegrationActor(repository, ...projectIds) {
  for (const projectId of projectIds) {
    await repository.createProjectMembership({
      projectId,
      actorId:INTEGRATION_ACTOR_ID,
      role:'OWNER',
      status:'ACTIVE',
      createdBy:INTEGRATION_ACTOR_ID
    });
  }
}

test('Evidence Source Span PostgreSQL lineage 验证连续范围、hash 与 Anchor',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');const pool=createPool();const repository=new PgRepository(pool);const project=await repository.createProject({name:`Evidence span ${Date.now()}`});
  try{const source='# 系统集成\n\n企业支持接口集成与系统对接。\n\n# 其他\n\n无关内容';const material=(await pool.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash,extraction_status,extracted_text) VALUES($1,'span.md',$2,'product_documentation','text/markdown',$3,$4,'succeeded',$5) RETURNING *`,[project.id,`span-${project.id}`,Buffer.byteLength(source),createHash('sha256').update(source).digest('hex'),source])).rows[0];const chunks=chunkEnterpriseMaterial(material.id,source);await repository.replaceMaterialChunks(material.id,chunks);const span=new EvidenceSourceContextResolver().resolve({material,chunks,anchorChunkId:chunks[1].chunk_id});const evidence=await repository.createEvidenceRecord({evidenceId:`EVI-${randomUUID().toUpperCase()}`,projectId:project.id,materialId:material.id,sourceChunkId:chunks[1].chunk_id,evidenceType:'product_documentation',title:'span',content:span.source_text,sourceText:span.source_text,sourcePage:null,sourceParagraph:span.source_location.paragraph_start,sourceHash:span.source_hash,sourceLocation:span.source_location,evidenceScope:[],capabilityTags:[],metadata:{},validityStatus:'unknown',applicableRequirementIds:[],usageScope:null,riskNotes:null});let catalog=await repository.listEvidenceCatalog(project.id);assert.equal(catalog.evidences.find((item)=>item.id===evidence.id).source_lineage_verified,true);await pool.query(`UPDATE evidences SET source_hash='${'0'.repeat(64)}' WHERE id=$1`,[evidence.id]);catalog=await repository.listEvidenceCatalog(project.id);assert.equal(catalog.evidences.find((item)=>item.id===evidence.id).source_lineage_verified,false);
  }finally{await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]);await pool.end();}
});

test('OPTION B staging metadata persists and legacy approval leaves formal state unchanged', async () => {
  const pool = createPool(); const repository = new PgRepository(pool); const project = await repository.createProject({ name:`Canonical staging ${Date.now()}` });
  try {
    const source = '企业材料原文。';
    const material = (await pool.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash,extraction_status,extracted_text) VALUES($1,'staging.md',$2,'project_case','text/markdown',$3,$4,'succeeded',$5) RETURNING *`, [project.id, `staging-${project.id}`, Buffer.byteLength(source), createHash('sha256').update(source).digest('hex'), source])).rows[0];
    const chunk = chunkEnterpriseMaterial(material.id, source)[0]; await repository.replaceMaterialChunks(material.id, [chunk]);
    const service = new EvidenceService({ repository });
    const staging = await service.create(project.id, { material_id:material.id, source_chunk_id:chunk.chunk_id, evidence_type:'project_case', title:'retrieval candidate', content:source, evidence_scope:[] }, { lifecycleRole:PRE_REVIEW_STAGING_ROLE });
    assert.equal(staging.metadata.lifecycle_role, PRE_REVIEW_STAGING_ROLE); assert.equal(staging.metadata.canonical_review_required, true);
    await assert.rejects(() => service.decide(staging.id, 'approved', { decided_by:'human' }), (error) => error.code === 'EVIDENCE_REVIEW_REQUIRED');
    const persisted = (await pool.query(`SELECT approval_status,metadata->>'lifecycle_role' AS lifecycle_role FROM evidences WHERE id=$1`, [staging.id])).rows[0];
    assert.deepEqual(persisted, { approval_status:'draft', lifecycle_role:PRE_REVIEW_STAGING_ROLE });
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM requirement_evidence_mappings WHERE evidence_id=$1`, [staging.id])).rows[0].count, 0);
  } finally { await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]); await pool.end(); }
});

test('025 Evidence Source Span Contract 持久化稳定 identity 且 migration 可重复',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');const pool=createPool();const repository=new PgRepository(pool);const sql=await readFile(resolve(directory,'../migrations/025_evidence_source_span_v1.sql'),'utf8');await pool.query(sql);await pool.query(sql);const project=await repository.createProject({name:`Source span contract ${Date.now()}`});
  try{const source='# 性能测试\n\n测试对象：数据交换服务。\n并发用户：50。\n平均响应时间：1.4 秒。\nP95：1.9 秒。';const material=(await pool.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash,extraction_status,extracted_text) VALUES($1,'performance.md',$2,'technical_whitepaper','text/markdown',$3,$4,'succeeded',$5) RETURNING *`,[project.id,`source-span-${project.id}`,Buffer.byteLength(source),createHash('sha256').update(source).digest('hex'),source])).rows[0];const chunks=chunkEnterpriseMaterial(material.id,source,{maxChars:25});await repository.replaceMaterialChunks(material.id,chunks);const service=new EvidenceSourceSpanService({repository});const first=await service.resolve({projectId:project.id,materialId:material.id,anchorChunkId:chunks[2].chunk_id,strategy:'heading_group'});const second=await service.resolve({projectId:project.id,materialId:material.id,anchorChunkId:chunks[2].chunk_id,strategy:'heading_group'});assert.equal(first.span_id,second.span_id);assert.equal(first.source_text,source);assert.equal(createHash('sha256').update(first.source_text).digest('hex'),first.source_text_hash);assert.equal((await pool.query(`SELECT count(*)::int AS count FROM evidence_source_spans WHERE span_id=$1`,[first.span_id])).rows[0].count,1);assert.deepEqual(first.source_chunk_ids,chunks.map((item)=>item.chunk_id));
  }finally{await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]);await pool.end();}
});

test('026 Evidence Review v1 持久化、幂等与独立人工决定',async()=>{assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required');const pool=createPool();const repository=new PgRepository(pool);const migration=await readFile(resolve(directory,'../migrations/026_evidence_review_v1.sql'),'utf8');await pool.query(migration);await pool.query(migration);const project=await repository.createProject({name:`Evidence review ${Date.now()}`});try{const source='# 认证\n\nISO 27001认证材料';const material=(await pool.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash,extraction_status,extracted_text) VALUES($1,'qualification.md',$2,'qualification','text/markdown',$3,$4,'succeeded',$5) RETURNING *`,[project.id,`review-${project.id}`,Buffer.byteLength(source),createHash('sha256').update(source).digest('hex'),source])).rows[0];const chunks=chunkEnterpriseMaterial(material.id,source);await repository.replaceMaterialChunks(material.id,chunks);const span=await new EvidenceSourceSpanService({repository}).resolve({projectId:project.id,materialId:material.id,anchorChunkId:chunks[1].chunk_id});const tender=await repository.addTenderFile({projectId:project.id,originalName:'review.txt',storageKey:`review-tender-${project.id}`,mimeType:'text/plain',sizeBytes:1});const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,summary_json) VALUES($1,$2,'succeeded','{}') RETURNING *`,[project.id,tender.id])).rows[0];await repository.confirmRequirementBaseline({jobId:job.id,confirmedBy:'integration',requirements:[{req_id:'REQ-001',content:'应具备ISO 27001认证。',source_excerpt:'应具备ISO 27001认证。',source_text:'应具备ISO 27001认证。',target_sections:[],ordinal:1,is_mandatory:false,mandatory_marker:null,source_section:null,source_clause_id:null,mandatory_scope_source_text:null,mandatory_scope_section:null,exception_clause_ids:[],source_hash:createHash('sha256').update('应具备ISO 27001认证。').digest('hex'),source_chunk_id:null,category:'requirement',requires_confirmation:false,source_page_start:null,source_page_end:null,source_paragraph_start:null,source_paragraph_end:null,source_paragraphs_json:[],source_match_type:'exact',source_match_score:1,source_resolution_method:'test',source_verified:true,source_status:'verified',confirmation_type:'verified',requirement_category:'qualification',writer_eligible:false,classification_review_required:false,atomicity_review_required:false,classification_method:'manual',confirmation_reasons:[],risk_flags:[],source_evidence:{},deduplication:{},canonical_rule_version:'test'}]});const requirement=(await pool.query(`SELECT * FROM requirements WHERE project_id=$1 AND req_id='REQ-001'`,[project.id])).rows[0];const run=await repository.createRetrievalRun({projectId:project.id,requirementDbId:requirement.id,requirementRef:'REQ-001',queryText:requirement.content,queryHash:createHash('sha256').update(requirement.content).digest('hex'),model:'test',version:'1',dimension:3,topK:1,filters:{},retrievalContractVersion:'production-retrieval-v1',candidateK:20,reviewK:8,rerankVersion:'test',semanticMetadata:{}});const embedding=(await pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,'test','1',3,'[1,0,0]') RETURNING *`,[chunks[1].chunk_id,chunks[1].chunk_hash])).rows[0];await pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score,raw_vector_rank,raw_similarity,reranked_rank,is_final,content_role,role_compatibility,matched_evidence_needs,rerank_reasons,retrieval_contract_version,rerank_version) VALUES($1,$2,$3,1,1,1,1,1,true,'qualification','preferred','[]','[]','production-retrieval-v1','test')`,[run.retrieval_run_id,chunks[1].chunk_id,embedding.embedding_id]);await pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now() WHERE retrieval_run_id=$1`,[run.retrieval_run_id]);const reviewer={review:async()=>({semantic_relevance:'relevant',evidence_capability:'capable',support_level:'partial_support',review_dimensions:{subject_match:'match',scope_match:'unknown',status_match:'unknown',quantitative_match:'unknown',entity_match:'match',validity_match:'unknown',source_authority:'unknown',support_sufficiency:'unknown'},requires_human_review:true})};const service=new EvidenceReviewService({repository,semanticReviewer:reviewer,reviewerVersion:'integration-v1'});const input={projectId:project.id,requirementId:'REQ-001',retrievalRunId:run.retrieval_run_id,retrievalCandidateId:chunks[1].chunk_id,sourceSpanId:span.span_id};const first=await service.propose(input),second=await service.propose(input);assert.equal(first.review_id,second.review_id);assert.equal((await pool.query(`SELECT count(*)::int count FROM evidence_candidate_reviews WHERE review_id=$1`,[first.review_id])).rows[0].count,1);const approved=await service.decide(first.review_id,'approve',{reviewer:'integration-human',note:'逐字核验'});assert.equal(approved.review_status,'approved');assert.equal(approved.human_review_version,1);assert.equal((await pool.query(`SELECT count(*)::int facts FROM evidence_facts WHERE project_id=$1`,[project.id])).rows[0].facts,0);
  }finally{await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]);await pool.end();}});

test('019 Enterprise Evidence Contract migration 可重复执行',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');
  const pool=createPool();
  try{
    const sql=await readFile(resolve(directory,'../migrations/019_enterprise_evidence_contract.sql'),'utf8');
    await pool.query(sql);await pool.query(sql);
    const tables=await pool.query(`SELECT to_regclass('public.material_chunks') AS chunks,to_regclass('public.requirement_evidence_mappings') AS mappings`);
    assert.equal(tables.rows[0].chunks,'material_chunks');assert.equal(tables.rows[0].mappings,'requirement_evidence_mappings');
    const columns=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='evidences' AND column_name=ANY($1::text[])`,[['evidence_origin','source_document_id','source_chunk_id','source_location','evidence_scope','capability_tags','metadata','validity_status']]);
    assert.equal(columns.rowCount,8);
  }finally{await pool.end();}
});

test('021 Evidence Review Mapping Contract migration 可重复执行',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');
  const pool=createPool();
  try{
    const sql=await readFile(resolve(directory,'../migrations/021_evidence_review_mapping_contract.sql'),'utf8');
    await pool.query(sql);await pool.query(sql);
    const columns=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='requirement_evidence_mappings' AND column_name=ANY($1::text[])`,[['support_level','review_notes','retrieval_run_id','retrieval_chunk_id']]);
    assert.equal(columns.rowCount,4);
  }finally{await pool.end();}
});

test('023 Evidence Fact Contract migration 可重复执行',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');const pool=createPool();
  try{const sql=await readFile(resolve(directory,'../migrations/023_evidence_facts.sql'),'utf8');await pool.query(sql);await pool.query(sql);const table=await pool.query(`SELECT to_regclass('public.evidence_facts') AS facts`);assert.equal(table.rows[0].facts,'evidence_facts');const triggers=await pool.query(`SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid='evidence_facts'::regclass AND NOT tgisinternal`);assert.equal(triggers.rows[0].count,2);}finally{await pool.end();}
});

test('Evidence Fact PostgreSQL 生命周期、来源、版本和 HTTP API 闭环',async()=>{
  const pool=createPool();const repository=new PgRepository(pool);const project=await repository.createProject({name:`Evidence Fact ${Date.now()}`});const other=await repository.createProject({name:`Evidence Fact other ${Date.now()}`});let server;
  try{
    await authorizeIntegrationActor(repository,project.id);
    const source='供应商东软集团股份有限公司中标数据共享交换平台软件项目，合同金额为100万元。';const material=await repository.createCompanyMaterial({projectId:project.id,originalName:'award.txt',storageKey:`fact-${project.id}`,materialType:'project_case',mimeType:'text/plain',sizeBytes:source.length,fileHash:createHash('sha256').update(source).digest('hex')});await repository.completeCompanyMaterialExtraction(material.id,source);const chunks=chunkEnterpriseMaterial(material.id,source);await repository.replaceMaterialChunks(material.id,chunks);const evidenceService=new EvidenceService({repository});const evidence=await evidenceService.create(project.id,{material_id:material.id,source_chunk_id:chunks[0].chunk_id,evidence_type:'project_case',title:'公开中标公告',content:source,evidence_scope:['award_fact','contract_amount']});await evidenceService.setValidity(evidence.id,{validity_status:'active',reviewed_by:'integration'});await evidenceService.decide(evidence.id,'approved',{decided_by:'integration'});
    const service=new EvidenceFactService({repository});const body={fact_type:'project_award',subject:{type:'organization',name:'东软集团股份有限公司'},entities:[{type:'procurement_item',name:'数据共享交换平台软件',relation:'awarded_item'}],fact_status:'award',fact_scopes:['award_fact','contract_amount'],quantities:[{metric:'contract_amount',operator:'eq',value:'100',unit:'万元',source_text:'合同金额为100万元'}],validity:{status:'not_applicable'},created_by:'integration'};
    await assert.rejects(()=>service.create(other.id,evidence.id,body),(error)=>error.code==='EVIDENCE_NOT_FOUND');const created=await service.create(project.id,evidence.id,body);assert.equal(created.review_status,'draft');assert.equal(created.source_text,source);assert.equal(created.source_hash,chunks[0].chunk_hash);assert.deepEqual(created.source_location.char_start,0);
    const app=createApp({repository,storage:{},generationService:{},requirementParseService:{},requirementSourceService:{},productionBetaService:{},companyMaterialService:{},evidenceService,enterpriseRetrievalService:{},documentGenerationService:{},evidenceFactService:service});server=await new Promise((resolve)=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});const base=`http://127.0.0.1:${server.address().port}`;let response=await fetch(`${base}/api/evidence-facts/${created.fact_id}`);let result=await response.json();assert.equal(response.status,200);assert.equal(result.data.fact.fact_id,created.fact_id);response=await fetch(`${base}/api/evidence-facts/${created.fact_id}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reviewed_by:'integration',review_notes:'原文核验'})});result=await response.json();assert.equal(response.status,200);assert.equal(result.data.fact.review_status,'approved');
    let approved=await service.listApproved(project.id,evidence.id);assert.equal(approved.facts.length,1);assert.equal(approved.facts[0].usable_for_claims,true);await assert.rejects(()=>pool.query(`UPDATE evidence_facts SET fact_status='completed' WHERE fact_id=$1`,[created.fact_id]),(error)=>error.code==='23514');
    const replacement=await service.supersede(created.fact_id,{...body,created_by:'integration-v2'});assert.equal(replacement.version,2);approved=await service.listApproved(project.id,evidence.id);assert.equal(approved.facts[0].usable_for_claims,true);await service.decide(replacement.fact_id,'approved',{reviewed_by:'integration'});approved=await service.listApproved(project.id,evidence.id);assert.equal(approved.facts.find((item)=>item.fact_id===created.fact_id).usable_for_claims,false);assert.equal(approved.facts.find((item)=>item.fact_id===replacement.fact_id).usable_for_claims,true);
    await evidenceService.setValidity(evidence.id,{validity_status:'revoked',reviewed_by:'integration'});approved=await service.listApproved(project.id,evidence.id);assert.equal(approved.facts.every((item)=>item.usable_for_claims===false),true);
    await assert.rejects(()=>pool.query(`INSERT INTO evidence_facts(fact_id,project_id,evidence_id,fact_type,subject_json,entities_json,fact_status,fact_scopes_json,quantities_json,validity_json,source_text,source_hash,review_status,created_by) VALUES('EFACT-00000000-0000-4000-8000-000000000099',$1,$2,'x','{}','[]','unknown','[]','[]','{"status":"unknown"}','x','x','approved','x')`,[project.id,evidence.id]),(error)=>error.code==='23514');
  }finally{if(server)await new Promise((resolve)=>server.close(resolve));await pool.query(`DELETE FROM projects WHERE id=ANY($1::uuid[])`,[[project.id,other.id]]);await pool.end();}
});

test('完整 migration chain 支持 fresh、ambiguous existing 与连续重放',async()=>{
  assert.ok(process.env.DATABASE_URL,'DATABASE_URL is required for PostgreSQL integration tests');const pool=createPool();const client=await pool.connect();const schema=`migration_freeze_${Date.now()}_${Math.floor(Math.random()*100000)}`;const quoted=`"${schema}"`;
  try{
    await client.query(`CREATE SCHEMA ${quoted}`);await client.query(`SET search_path TO ${quoted}, public`);const migrationDirectory=resolve(directory,'../migrations');const files=(await readdir(migrationDirectory)).filter((name)=>name.endsWith('.sql')).sort();
    const run=async()=>{for(const file of files)await client.query(await readFile(resolve(migrationDirectory,file),'utf8'));};
    await run();
    const project=(await client.query(`INSERT INTO projects(name) VALUES('migration fresh') RETURNING id`)).rows[0];const tender=(await client.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'x.txt',$2,'text/plain',1) RETURNING id`,[project.id,`${schema}/x.txt`])).rows[0];const job=(await client.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id) VALUES($1,$2) RETURNING id`,[project.id,tender.id])).rows[0];await client.query(`INSERT INTO requirement_candidates(parse_job_id,req_id,content,source_excerpt,source_text,ordinal,source_resolution_status) VALUES($1,'REQ-001','x','x','x',1,'ambiguous')`,[job.id]);
    const materialTypes=['company_profile','qualification','case','project_case','product','product_documentation','personnel','technical_solution','technical_whitepaper','delivery_capability','historical_bid','other'];
    for(const [index,materialType] of materialTypes.entries())await client.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash) VALUES($1,$2,$3,$4,'text/plain',1,$5)`,[project.id,`${materialType}.txt`,`${schema}/${materialType}.txt`,materialType,`migration-hash-${index}`]);
    await run();await run();
    const status=await client.query(`SELECT source_resolution_status FROM requirement_candidates WHERE parse_job_id=$1`,[job.id]);assert.equal(status.rows[0].source_resolution_status,'ambiguous');
    const persistedTypes=(await client.query(`SELECT material_type FROM company_materials WHERE project_id=$1 ORDER BY material_type`,[project.id])).rows.map((item)=>item.material_type);assert.deepEqual(persistedTypes,[...materialTypes].sort());
    await assert.rejects(()=>client.query(`INSERT INTO company_materials(project_id,original_name,storage_key,material_type,mime_type,size_bytes,file_hash) VALUES($1,'invalid.txt','invalid.txt','invalid_material_type','text/plain',1,'invalid-hash')`,[project.id]),(error)=>error.code==='23514');
  }finally{await client.query('SET search_path TO public');await client.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);client.release();await pool.end();}
});

test('Enterprise Retrieval pgvector Top-K、隔离、失效与审计闭环',async()=>{
  const pool=createPool();const repository=new PgRepository(pool);const project=await repository.createProject({name:`Retrieval ${Date.now()}`});const other=await repository.createProject({name:`Retrieval other ${Date.now()}`});let server;
  try{
    await authorizeIntegrationActor(repository,project.id);
    const file=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'r.txt',$2,'text/plain',1) RETURNING *`,[project.id,`retrieval-${project.id}`])).rows[0];const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`,[project.id,file.id])).rows[0];const baseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,[project.id,job.id])).rows[0];const requirement=(await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible) VALUES($1,$2,'REQ-001','国产化环境部署','国产化环境部署','国产化环境部署',false,'[]',1,'verified','verified','technical',true) RETURNING *`,[baseline.id,project.id])).rows[0];await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='test',confirmation_type='verified' WHERE id=$1`,[baseline.id]);
    const addMaterial=async(target,type,text,label)=>{const material=await repository.createCompanyMaterial({projectId:target.id,originalName:`${label}.txt`,storageKey:`${target.id}/${label}`,materialType:type,mimeType:'text/plain',sizeBytes:text.length,fileHash:createHash('sha256').update(`${target.id}|${label}`).digest('hex')});await repository.completeCompanyMaterialExtraction(material.id,text);const chunks=chunkEnterpriseMaterial(material.id,text);await repository.replaceMaterialChunks(material.id,chunks);return{material,chunk:chunks[0]};};
     const relevant=await addMaterial(project,'project_case','项目已完成麒麟鲲鹏国产化适配部署。','relevant');const history=await addMaterial(project,'historical_bid','历史标书记录了国产化环境部署响应。','history');const unrelated=await addMaterial(project,'company_profile','公司地址和联系方式','unrelated');const cross=await addMaterial(other,'project_case','完全匹配的国产化环境部署','cross');
    const otherFile=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'other.txt',$2,'text/plain',1) RETURNING *`,[other.id,`retrieval-other-${other.id}`])).rows[0];const otherJob=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`,[other.id,otherFile.id])).rows[0];const otherBaseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,[other.id,otherJob.id])).rows[0];const otherRequirement=(await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible) VALUES($1,$2,'REQ-001','国产化环境部署','国产化环境部署','国产化环境部署',false,'[]',1,'verified','verified','technical',true) RETURNING *`,[otherBaseline.id,other.id])).rows[0];await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='test',confirmation_type='verified' WHERE id=$1`,[otherBaseline.id]);
    const vectorFor=(text)=>text==='国产化环境部署'?[1,0,0]:text.includes('麒麟')?[.95,.05,0]:text.includes('历史标书')?[.8,.2,0]:text.includes('地址')?[0,1,0]:text.includes('完全匹配')?[1,0,0]:[.9,.1,0];const calls=[];const embeddingClient={model:'fixture-embedding',version:'v1',dimension:3,embed:async(texts)=>{calls.push([...texts]);return texts.map(vectorFor);}};const service=new EnterpriseRetrievalService({repository,embeddingClient,defaultTopK:3});
    const evidenceService=new EvidenceService({repository});const app=createApp({repository,storage:{},generationService:{},requirementParseService:{},requirementSourceService:{},productionBetaService:{},companyMaterialService:{},evidenceService,enterpriseRetrievalService:service,documentGenerationService:{}});server=await new Promise((resolve)=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});const base=`http://127.0.0.1:${server.address().port}`;let response=await fetch(`${base}/api/requirements/${requirement.id}/enterprise-retrieval`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({top_k:3,corpus_scopes:[]})});let body=await response.json();assert.equal(response.status,201);assert.deepEqual(body.data.results.map((item)=>item.rank),[1,2]);assert.equal(body.data.raw_candidates.length,3);assert.equal(body.data.final_candidates.length,2);assert.equal(body.data.results[0].chunk_id,relevant.chunk.chunk_id);assert.equal(body.data.results[1].chunk_id,history.chunk.chunk_id);assert.deepEqual(body.data.results[1].risk_flags,['HISTORICAL_BID_REFERENCE_ONLY']);assert.equal(body.data.results.some((item)=>item.chunk_id===cross.chunk.chunk_id),false);assert.equal(body.data.results.every((item)=>item.evidence_created===false),true);const firstRun=body.data.run;
    response=await fetch(`${base}/api/enterprise-retrieval-runs/${firstRun.retrieval_run_id}`);body=await response.json();assert.equal(body.data.run.status,'succeeded');assert.equal(body.data.run.query_text,'国产化环境部署');assert.equal(body.data.run.top_k,3);assert.equal(body.data.run.candidate_k,20);assert.equal(body.data.run.review_k,3);assert.equal(body.data.run.retrieval_contract_version,'4.3-production-retrieval-v1');assert.equal(body.data.run.fallback_mode,'raw_vector');assert.ok(body.data.run.completed_at);assert.equal(body.data.raw_candidates.length,3);assert.equal(body.data.final_candidates.length,2);assert.equal(body.data.results.length,2);assert.equal(body.data.raw_candidates.find((item)=>item.chunk_id===unrelated.chunk.chunk_id).evidence_source_eligible,false);for(const item of body.data.raw_candidates)for(const field of ['source_document_id','source_chunk_id','raw_vector_rank','raw_similarity','reranked_rank','content_role','role_compatibility','matched_evidence_needs','rerank_reasons','retrieval_contract_version','rerank_version'])assert.ok(Object.hasOwn(item,field),field);
    response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-review?retrieval_run_id=${firstRun.retrieval_run_id}`);body=await response.json();assert.equal(response.status,200);assert.equal(body.data.requirement.req_id,'REQ-001');assert.equal(body.data.results[0].material_name,'relevant.txt');assert.equal(body.data.results[0].evidence_id,null);
    const candidateInput={retrieval_run_id:firstRun.retrieval_run_id,chunk_id:relevant.chunk.chunk_id,title:'国产化项目依据',evidence_type:'project_case',evidence_scope:['project_fact']};response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-candidates/from-retrieval`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(candidateInput)});body=await response.json();assert.equal(response.status,201);assert.equal(body.data.created,true);assert.equal(body.data.evidence.approval_status,'draft');const evidence=body.data.evidence;response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-candidates/from-retrieval`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(candidateInput)});body=await response.json();assert.equal(response.status,200);assert.equal(body.data.created,false);assert.equal(body.data.evidence.id,evidence.id);
    response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-candidates/from-retrieval`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...candidateInput,source_text:'伪造原文'})});body=await response.json();assert.equal(response.status,422);assert.equal(body.error.code,'EVIDENCE_RETRIEVAL_FIELD_FORBIDDEN');
    const mappingInput={requirement_id:'REQ-001',evidence_id:evidence.id,mapping_source:'retrieval',support_level:'reference_only',review_notes:'语义相关不等于完整事实支撑。',retrieval_run_id:firstRun.retrieval_run_id,retrieval_chunk_id:relevant.chunk.chunk_id,created_by:'integration'};response=await fetch(`${base}/api/projects/${project.id}/evidence-mappings`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(mappingInput)});body=await response.json();assert.equal(response.status,409);assert.equal(body.error.code,'EVIDENCE_NOT_APPROVED');await evidenceService.setValidity(evidence.id,{validity_status:'active',reviewed_by:'integration'});await evidenceService.decide(evidence.id,'approved',{decided_by:'integration'});response=await fetch(`${base}/api/projects/${project.id}/evidence-mappings`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(mappingInput)});body=await response.json();assert.equal(response.status,201);const proposed=body.data.mapping;assert.equal(proposed.mapping_status,'proposed');
    await assert.rejects(()=>evidenceService.proposeMapping(project.id,{requirement_id:'REQ-001',evidence_id:evidence.id,mapping_source:'retrieval',support_level:'partial_support',retrieval_run_id:firstRun.retrieval_run_id,retrieval_chunk_id:'MCH-NOT-IN-RESULT',created_by:'integration'}),(error)=>error.code==='EVIDENCE_RETRIEVAL_PROVENANCE_INVALID');
    const otherRun=(await service.retrieve(otherRequirement.id,{top_k:1,corpus_scopes:[]})).run;await assert.rejects(()=>evidenceService.proposeMapping(project.id,{requirement_id:'REQ-001',evidence_id:evidence.id,mapping_source:'retrieval',support_level:'partial_support',retrieval_run_id:otherRun.retrieval_run_id,retrieval_chunk_id:cross.chunk.chunk_id,created_by:'integration'}),(error)=>error.code==='EVIDENCE_RETRIEVAL_PROVENANCE_INVALID');
    response=await fetch(`${base}/api/evidence-mappings/${proposed.mapping_id}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reviewed_by:'integration'})});body=await response.json();assert.equal(response.status,200);const approved=body.data.mapping;assert.equal(approved.support_level,'reference_only');let formal=await evidenceService.listApprovedForRequirement(project.id,'REQ-001');assert.equal(formal.evidences.length,1);assert.equal(formal.evidences[0].usable_for_claims,false);response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-review?retrieval_run_id=${firstRun.retrieval_run_id}`);body=await response.json();assert.equal(body.data.results[0].mapping_status,'approved');assert.equal(body.data.results[0].support_level,'reference_only');await evidenceService.decideMapping(proposed.mapping_id,'rejected',{reviewed_by:'integration'});formal=await evidenceService.listApprovedForRequirement(project.id,'REQ-001');assert.equal(formal.evidences.length,0);
    await assert.rejects(()=>pool.query(`UPDATE requirement_evidence_mappings SET support_level='rejected' WHERE mapping_id=$1`,[proposed.mapping_id]),(error)=>error.code==='23514');await pool.query(`UPDATE requirement_evidence_mappings SET support_level=NULL WHERE mapping_id=$1`,[proposed.mapping_id]);await assert.rejects(()=>pool.query(`UPDATE requirement_evidence_mappings SET mapping_status='approved' WHERE mapping_id=$1`,[proposed.mapping_id]),(error)=>error.code==='23514');for(const level of ['full_support','partial_support','reference_only']){await pool.query(`UPDATE requirement_evidence_mappings SET mapping_status='approved',support_level=$2 WHERE mapping_id=$1`,[proposed.mapping_id,level]);assert.equal((await pool.query(`SELECT support_level FROM requirement_evidence_mappings WHERE mapping_id=$1`,[proposed.mapping_id])).rows[0].support_level,level);}await pool.query(`UPDATE requirement_evidence_mappings SET mapping_status='rejected' WHERE mapping_id=$1`,[proposed.mapping_id]);
    const firstCount=Number((await pool.query(`SELECT count(*) FROM material_chunk_embeddings WHERE chunk_id=ANY($1::text[])`,[[relevant.chunk.chunk_id,history.chunk.chunk_id,unrelated.chunk.chunk_id]])).rows[0].count);assert.equal(firstCount,3);await service.retrieve(requirement.id,{top_k:3,corpus_scopes:[]});assert.equal(calls[2].length,1);const secondCount=Number((await pool.query(`SELECT count(*) FROM material_chunk_embeddings WHERE chunk_id=ANY($1::text[])`,[[relevant.chunk.chunk_id,history.chunk.chunk_id,unrelated.chunk.chunk_id]])).rows[0].count);assert.equal(secondCount,3);
     const changedText='项目已完成麒麟国产化新版适配。';const changedHash=createHash('sha256').update(changedText).digest('hex');await pool.query(`UPDATE material_chunks SET source_text=$2,chunk_hash=$3,char_end=char_start+$4 WHERE chunk_id=$1`,[relevant.chunk.chunk_id,changedText,changedHash,changedText.length]);const changed=await service.retrieve(requirement.id,{top_k:3,corpus_scopes:[]});assert.equal(changed.results[0].chunk_hash,changedHash);assert.equal(Number((await pool.query(`SELECT count(*) FROM material_chunk_embeddings WHERE chunk_id=$1`,[relevant.chunk.chunk_id])).rows[0].count),2);
    const evidenceCount=Number((await pool.query(`SELECT count(*) FROM evidences WHERE project_id=$1`,[project.id])).rows[0].count);assert.equal(evidenceCount,1);const beforeFailure=Number((await pool.query(`SELECT count(*) FROM material_chunk_embeddings`)).rows[0].count);const failing=new EnterpriseRetrievalService({repository,embeddingClient:{model:'fixture-embedding',version:'failure',dimension:3,embed:async()=>{throw new EmbeddingError('EMBEDDING_TIMEOUT','Embedding 服务超时。',504);}}});await assert.rejects(()=>failing.retrieve(requirement.id),(error)=>error.code==='EMBEDDING_TIMEOUT');const failed=(await pool.query(`SELECT * FROM enterprise_retrieval_runs WHERE requirement_id=$1 AND status='failed' ORDER BY started_at DESC LIMIT 1`,[requirement.id])).rows[0];assert.equal(failed.error_code,'EMBEDDING_TIMEOUT');assert.ok(failed.completed_at);assert.equal(Number((await pool.query(`SELECT count(*) FROM material_chunk_embeddings`)).rows[0].count),beforeFailure);
  }finally{if(server)await new Promise((resolve)=>server.close(resolve));await pool.query(`DELETE FROM projects WHERE id=ANY($1::uuid[])`,[[project.id,other.id]]);await pool.end();}
});

const inputs = {
  project_name: 'PostgreSQL 失败审计集成测试',
  project_type: 'AI 应用',
  bid_need: '验证非法契约审计持久化',
  focus_points: '不得创建正式文档版本',
  output_mode: '技术标初稿'
};

const cases = [
  {
    name: 'missing',
    payload: { data: { outputs: {} } },
    expected: 'missing'
  },
  {
    name: 'wrong-type',
    payload: { data: { outputs: { response_payload_json: 42 } } },
    expected: 'jsonb'
  },
  {
    name: 'invalid-json',
    payload: { data: { outputs: { response_payload_json: '{bad-json' } } },
    expected: 'text'
  },
  {
    name: 'invalid-fields',
    payload: { data: { outputs: { response_payload_json: { risk_status: 'pass' } } } },
    expected: 'jsonb'
  }
];

test('PostgreSQL 持久化四类 CONTRACT_INVALID，且不创建 DocumentVersion', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `失败审计集成测试 ${Date.now()}` });
  let example;

  try {
    for (const scenario of cases) {
      const difyClient = createDifyClient({
        apiBase: 'https://dify.invalid/v1',
        apiKey: 'integration-test-only',
        fetchImpl: async () => new Response(JSON.stringify(scenario.payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      });
      const service = new GenerationService({
        repository,
        difyClient,
        workflowVersion: '4.2',
        logger: { error: () => {} }
      });

      await assert.rejects(
        () => service.generate({ projectId: project.id, inputs: { ...inputs, project_name: `${inputs.project_name}-${scenario.name}` } }),
        (error) => error.code === 'CONTRACT_INVALID'
      );

      const { rows } = await pool.query(`
        SELECT g.id, g.job_id, g.status, g.error_code, g.error_message,
          g.workflow_version, g.runtime_ms, g.response_payload_json,
          g.raw_dify_response_json, g.raw_response_text,
          (SELECT count(*)::int FROM document_versions v WHERE v.generation_id = g.id) AS version_count
        FROM generations g
        WHERE g.project_id = $1
        ORDER BY g.created_at DESC
        LIMIT 1
      `, [project.id]);
      const audit = rows[0];
      assert.ok(audit?.id, `${scenario.name}: failed Generation was not created`);
      assert.equal(audit.status, 'failed');
      assert.equal(audit.error_code, 'CONTRACT_INVALID');
      assert.equal(audit.error_message, '生成结果格式校验失败，请联系管理员检查 Dify Workflow 输出契约。');
      assert.equal(audit.workflow_version, '4.2');
      assert.ok(audit.runtime_ms >= 0);
      assert.ok(audit.raw_dify_response_json);
      assert.equal(audit.version_count, 0);

      if (scenario.expected === 'text') {
        assert.equal(audit.response_payload_json, null);
        assert.match(audit.raw_response_text, /^\[redacted raw text; length=\d+\]$/);
      } else if (scenario.expected === 'jsonb') {
        assert.notEqual(audit.response_payload_json, null);
        assert.equal(audit.raw_response_text, null);
      } else {
        assert.equal(audit.response_payload_json, null);
        assert.equal(audit.raw_response_text, null);
      }

      if (scenario.name === 'invalid-json') {
        example = {
          id: audit.id,
          job_id: audit.job_id,
          status: audit.status,
          error_code: audit.error_code,
          workflow_version: audit.workflow_version,
          runtime_ms: audit.runtime_ms,
          has_json_payload: audit.response_payload_json !== null,
          has_raw_text: audit.raw_response_text !== null,
          has_raw_dify_json: audit.raw_dify_response_json !== null,
          version_count: audit.version_count
        };
      }
    }

    const { rows: versionRows } = await pool.query(
      `SELECT count(*)::int AS count FROM document_versions WHERE project_id = $1`,
      [project.id]
    );
    assert.equal(versionRows[0].count, 0);
    console.log(`FAILED_GENERATION_EXAMPLE=${JSON.stringify(example)}`);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 持久化 Production Beta Plan、Claim 决策、Coverage 与失败审计', async () => {
  const pool=createPool(); const repository=new PgRepository(pool); const project=await repository.createProject({name:`Beta 集成 ${Date.now()}`});
  try {
    const file=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'fixture.txt','fixture','text/plain',1) RETURNING *`,[project.id])).rows[0];
    const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status) VALUES($1,$2,'succeeded') RETURNING *`,[project.id,file.id])).rows[0];
    const baseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status,confirmed_at) VALUES($1,$2,'building',now()) RETURNING *`,[project.id,job.id])).rows[0];
    await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,mandatory_marker,target_sections,ordinal,requirement_category,writer_eligible,classification_review_required,atomicity_review_required) VALUES($1,$2,'REQ-001','数据接入','★数据接入','★数据接入',true,'★','["data-integration"]',1,'technical',true,false,true)`,[baseline.id,project.id]);
    await pool.query(`UPDATE requirement_baselines SET status='confirmed' WHERE id=$1`,[baseline.id]);
    const service=new ProductionBetaService({repository});
    const material=await repository.createCompanyMaterial({projectId:project.id,originalName:'fixture.txt',storageKey:`evidence-${project.id}`,materialType:'project_case',mimeType:'text/plain',sizeBytes:4,fileHash:`hash-${project.id}`});const sourceText='能力依据';await repository.completeCompanyMaterialExtraction(material.id,sourceText);const chunks=chunkEnterpriseMaterial(material.id,sourceText);await repository.replaceMaterialChunks(material.id,chunks);const evidenceService=new EvidenceService({repository});const createdEvidence=await evidenceService.create(project.id,{material_id:material.id,source_chunk_id:chunks[0].chunk_id,evidence_type:'project_case',title:'能力依据',content:sourceText,applicable_requirement_ids:['REQ-001']});await evidenceService.setValidity(createdEvidence.id,{validity_status:'active',reviewed_by:'integration'});await evidenceService.decide(createdEvidence.id,'approved',{decided_by:'integration'});const evidence=(await repository.listApprovedEvidence(project.id))[0];
    const result=await service.process(project.id,{evidence:[evidence],response_plans:[{requirement_id:'REQ-001',response_status:'full',response_summary:'响应',supporting_evidence_ids:[evidence.evidence_id]}],claims:[{claim_id:`CLM-${Date.now()}`,requirement_id:'REQ-001',claim_type:'statement',text:'支持数据接入',basis_requirement_ids:['REQ-001'],basis_evidence_ids:[evidence.evidence_id]}]});
    assert.equal(result.run.status,'succeeded'); assert.equal(result.coverage.valid,true); assert.equal(result.writer_input.length,1);
    const persisted = await service.get(project.id);
    assert.equal(persisted.plans[0].source_status, 'verified');
    assert.equal(persisted.claims[0].basis_requirement_source_statuses['REQ-001'], 'verified');
    assert.equal(persisted.coverage[0].source_status, 'verified');
    await assert.rejects(()=>service.process(project.id,{evidence:[],response_plans:[],claims:[]}));
    const {rows}=await pool.query(`SELECT status,error_code FROM production_beta_runs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1`,[project.id]); assert.equal(rows[0].status,'failed'); assert.equal(rows[0].error_code,'RESPONSE_PLAN_MISSING');
  } finally { await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]); await pool.end(); }
});

test('PostgreSQL 持久化合法 Dify 外层审计并创建 DocumentVersion', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `成功归档集成测试 ${Date.now()}` });
  const response = { data: { outputs: { response_payload_json: JSON.stringify({
    document: {
      title: '脱敏技术响应',
      markdown: '# 脱敏技术响应\n\n测试正文',
      sections: [{ id: 'overview', title: '项目概述' }]
    },
    warnings: [],
    risk_status: 'pass'
  }) } } };

  try {
    const difyClient = createDifyClient({
      apiBase: 'https://dify.invalid/v1',
      apiKey: 'integration-test-only',
      fetchImpl: async () => new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    });
    const service = new GenerationService({ repository, difyClient, workflowVersion: '4.2' });
    const result = await service.generate({ projectId: project.id, inputs });

    assert.equal(result.generation.status, 'succeeded');
    assert.equal(result.version.risk_status, 'pass');
    assert.ok(result.generation.raw_dify_response_json);
    assert.equal(result.generation.raw_response_text, null);
    assert.equal(result.generation.error_code, null);

    const generations = await repository.listGenerations(project.id);
    assert.equal(generations.length, 1);
    assert.equal(generations[0].has_response_payload_json, true);
    assert.equal(generations[0].has_raw_dify_response_json, true);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

const pipelineRequirements = [
  { req_id: 'REQ-001', text: '支持通过标准接口完成第三方系统数据接入。' },
  { req_id: 'REQ-002', text: '方案应说明访问权限控制和安全审计机制。' }
];

test('4.3 critical 终检持久化 failed Generation 且不创建 DocumentVersion', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `4.3 critical 集成测试 ${Date.now()}` });
  const service = new DeterministicPipelineService({
    repository,
    writer: {
      async write() {
        return [{
          id: 'data-integration',
          title: '数据接入与集成',
          requirement_ids: ['REQ-001'],
          draft_text: '平台支持通过标准接口完成第三方系统数据接入。'
        }];
      }
    },
    logger: { error: () => {} }
  });

  try {
    await assert.rejects(
      () => service.generate({ projectId: project.id, requirements: pipelineRequirements }),
      (error) => error.code === 'DOCUMENT_VALIDATION_FAILED'
    );
    const { rows } = await pool.query(`
      SELECT g.status, g.error_code, g.workflow_version, g.response_payload_json,
        (SELECT count(*)::int FROM document_versions v WHERE v.generation_id = g.id) AS version_count
      FROM generations g
      WHERE g.project_id = $1
      ORDER BY g.created_at DESC
      LIMIT 1
    `, [project.id]);
    const audit = rows[0];
    assert.equal(audit.status, 'failed');
    assert.equal(audit.error_code, 'DOCUMENT_VALIDATION_FAILED');
    assert.equal(audit.workflow_version, '4.3');
    assert.equal(audit.response_payload_json.schema_version, '4.3');
    assert.equal(audit.response_payload_json.risk_status, 'critical');
    assert.equal(audit.response_payload_json.generation_audit.state, 'failed');
    assert.equal(audit.version_count, 0);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('4.3 writer 阶段失败必须落库审计', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `4.3 writer 失败审计 ${Date.now()}` });
  const service = new DeterministicPipelineService({
    repository,
    writer: { async write() { throw Object.assign(new Error('mock writer failed'), { code: 'WRITER_FAILED' }); } },
    logger: { error: () => {} }
  });

  try {
    await assert.rejects(
      () => service.generate({ projectId: project.id, requirements: [pipelineRequirements[0]] }),
      (error) => error.code === 'WRITER_FAILED'
    );
    const { rows } = await pool.query(`
      SELECT status, error_code, workflow_version, response_payload_json
      FROM generations WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [project.id]);
    assert.equal(rows[0].status, 'failed');
    assert.equal(rows[0].error_code, 'WRITER_FAILED');
    assert.equal(rows[0].workflow_version, '4.3');
    assert.deepEqual(
      rows[0].response_payload_json.generation_audit.events.map((event) => event.state),
      ['created', 'canonicalized', 'planned', 'claims_gated', 'failed']
    );
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('4.3 合法 envelope 持久化 Generation 并创建 DocumentVersion', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `4.3 成功归档 ${Date.now()}` });
  const service = new DeterministicPipelineService({
    repository,
    writer: {
      async write() {
        return [
          {
            id: 'data-integration', title: '数据接入与集成', requirement_ids: ['REQ-001'],
            draft_text: '平台支持通过标准接口完成第三方系统数据接入。'
          },
          {
            id: 'security-compliance', title: '安全与合规', requirement_ids: ['REQ-002'],
            draft_text: '平台采用最小权限原则，并记录关键操作审计日志。'
          }
        ];
      }
    }
  });

  try {
    const result = await service.generate({ projectId: project.id, requirements: pipelineRequirements });
    assert.equal(result.generation.status, 'succeeded');
    assert.equal(result.version.risk_status, 'pass');
    assert.equal(result.envelope.schema_version, '4.3');
    assert.equal(result.envelope.generation_audit.state, 'finalized');
    const { rows } = await pool.query(`
      SELECT response_payload_json, workflow_version
      FROM generations WHERE id = $1
    `, [result.generation.id]);
    assert.equal(rows[0].workflow_version, '4.3');
    assert.equal(rows[0].response_payload_json.schema_version, '4.3');
    assert.ok(rows[0].response_payload_json.document.markdown.includes('第三方系统数据接入'));
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 确认 Requirement 基线后禁止增删改合并', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `Requirement 冻结集成测试 ${Date.now()}` });
  const tenderFile = await repository.addTenderFile({
    projectId: project.id,
    originalName: 'tender.txt',
    storageKey: `${project.id}/integration-${Date.now()}.txt`,
    mimeType: 'text/plain',
    sizeBytes: 30
  });
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('★系统应支持标准接口并提供安全审计，详见第 3.2 条。') },
    textExtractor: async () => ({
      text: '★系统应支持标准接口并提供安全审计，详见第 3.2 条。',
      paragraphs: [{ paragraph: 1, page: null, text: '★系统应支持标准接口并提供安全审计，详见第 3.2 条。' }],
      pages: [],
      warnings: []
    }),
    extractionGateway: {
      extract: async () => ({
        candidates: [{
          text: '系统应支持标准接口并提供安全审计。',
          category: 'security',
          source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
          mandatory_observed: true,
          requires_confirmation: false
        }],
        warnings: [],
        audit: { provider: 'semantic_gateway', task_type: 'requirement_extraction' }
      })
    }
  });

  try {
    const parseJob = await service.start({
      projectId: project.id, tenderFileId: tenderFile.id, waitForCompletion: true
    });
    assert.equal(parseJob.status, 'succeeded');
    assert.equal(parseJob.candidates[0].req_id, 'REQ-001');
    assert.equal(parseJob.candidates[0].is_mandatory, true);
    assert.equal(parseJob.candidates[0].mandatory_marker, '★');
    assert.match(parseJob.candidates[0].source_text, /★.*第 3\.2 条/);
    assert.equal(parseJob.phase, 'succeeded');
    assert.equal(parseJob.total_chunks, 1);
    assert.equal(parseJob.chunks[0].status, 'succeeded');
    await pool.query(`
      UPDATE requirement_candidates
      SET is_mandatory = false, mandatory_marker = NULL
      WHERE id = $1
    `, [parseJob.candidates[0].id]);
    await assert.rejects(
      () => service.confirm(parseJob.id, { confirmed_by: 'integration-reviewer' }),
      (error) => error.code === 'REQUIREMENT_MANDATORY_METADATA_CONFLICT'
    );
    assert.equal(await repository.getRequirementBaseline(project.id), null);
    await pool.query(`
      UPDATE requirement_candidates
      SET is_mandatory = true, mandatory_marker = '★'
      WHERE id = $1
    `, [parseJob.candidates[0].id]);
    const confirmed = await service.confirm(parseJob.id, { confirmed_by: 'integration-reviewer' });
    assert.equal(confirmed.baseline.status, 'confirmed');
    const baseline = await repository.getRequirementBaseline(project.id);
    assert.equal(baseline.requirements.length, 1);
    assert.equal(baseline.requirements[0].is_mandatory, true);
    assert.equal(baseline.requirements[0].mandatory_marker, '★');
    assert.match(baseline.requirements[0].source_text, /★.*第 3\.2 条/);
    assert.deepEqual(baseline.requirements[0].target_sections, [
      'data-integration', 'solution-design', 'security-compliance'
    ]);

    await assert.rejects(
      () => pool.query(`UPDATE requirements SET content = 'mutated' WHERE id = $1`, [baseline.requirements[0].id]),
      (error) => error.code === '55000'
    );
    await assert.rejects(
      () => pool.query(`DELETE FROM requirements WHERE id = $1`, [baseline.requirements[0].id]),
      (error) => error.code === '55000'
    );
    await assert.rejects(
      () => pool.query(`
        INSERT INTO requirements
          (baseline_id, project_id, req_id, content, source_excerpt, target_sections, ordinal)
        VALUES ($1, $2, 'REQ-002', 'new', 'new', '[]'::jsonb, 2)
      `, [baseline.id, project.id]),
      (error) => error.code === '55000'
    );
    await assert.rejects(
      () => pool.query(`UPDATE requirement_baselines SET status = 'building' WHERE id = $1`, [baseline.id]),
      (error) => error.code === '55000'
    );
    const { rows: versions } = await pool.query(
      `SELECT count(*)::int AS count FROM document_versions WHERE project_id = $1`, [project.id]
    );
    assert.equal(versions[0].count, 0);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 解析契约失败只创建 failed 解析审计，不创建 Requirement 基线', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `Requirement 失败集成测试 ${Date.now()}` });
  const tenderFile = await repository.addTenderFile({
    projectId: project.id,
    originalName: 'invalid.txt',
    storageKey: `${project.id}/invalid-${Date.now()}.txt`,
    mimeType: 'text/plain',
    sizeBytes: 10
  });
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('技术要求：系统应提供审计能力。') },
    textExtractor: async () => ({
      text: '技术要求：系统应提供审计能力。', paragraphs: [{ paragraph: 1, page: null, text: '技术要求：系统应提供审计能力。' }],
      pages: [], warnings: []
    }),
    extractionGateway: {
      extract: async () => {
        throw new SemanticGatewayError(
          'GATEWAY_REQUIREMENTS_INVALID', '候选需求输出契约无效。',
          { raw_response_payload_json: '{invalid' }, 422
        );
      }
    },
    logger: { error: () => {} }
  });

  try {
    await assert.rejects(
      () => service.start({
        projectId: project.id, tenderFileId: tenderFile.id, waitForCompletion: true
      }),
      (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID'
    );
    const jobs = await repository.listParseJobs(project.id);
    assert.equal(jobs[0].status, 'failed');
    assert.equal(jobs[0].phase, 'failed');
    assert.equal(jobs[0].error_code, 'GATEWAY_REQUIREMENTS_INVALID');
    assert.equal(jobs[0].failed_chunk_number, 1);
    assert.equal(jobs[0].requirement_count, 0);
    const failedJob = await repository.getParseJob(jobs[0].id);
    assert.equal(failedJob.chunks[0].status, 'failed');
    assert.equal(failedJob.chunks[0].error_code, 'GATEWAY_REQUIREMENTS_INVALID');
    assert.equal(await repository.getRequirementBaseline(project.id), null);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 持久化章节、succeeded_empty 与章节级 mandatory scope', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `PDF 章节集成测试 ${Date.now()}` });
  const tenderFile = await repository.addTenderFile({
    projectId: project.id,
    originalName: 'section-fixture.pdf',
    storageKey: `${project.id}/section-${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 100
  });
  const values = [
    '第一章 投标邀请', '邀请内容。',
    '第二章 投标人须知前附表', '前附表。',
    '第三章 投标人须知', '须知内容。',
    '第四章 项目要求和有关说明',
    '以下除5.2.6外，其余均为实质性要求。',
    `5.2.1 ${'审计要求。'.repeat(35)}`,
    `5.2.6 ${'例外要求。'.repeat(35)}`,
    '第五章 评标方法和评标标准', '评标内容。',
    '第六章 合同书（格式）', '合同内容。',
    '第七章 投标文件的组成和格式', '格式内容。'
  ];
  const text = values.join('\n');
  const paragraphs = values.map((value, index) => ({ paragraph: index + 1, page: index + 1, text: value }));
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('fixture') },
    textExtractor: async () => ({ text, paragraphs, pages: [], warnings: [] }),
    // Keep each natural fixture paragraph intact under the explicit chunk budget;
    // the single-call threshold still forces this integration path to exercise
    // multi-window persistence behavior.
    chunkBudget: { singleCallThreshold: 1, characterBudget: 200, tokenBudget: 300 },
    extractionGateway: {
      extract: async ({ chunk }) => {
        const requirements = [];
        const mandatory = chunk.segments.find((segment) => segment.source_clause_id === '5.2.1');
        const exception = chunk.segments.find((segment) => segment.source_clause_id === '5.2.6');
        if (mandatory) requirements.push({
          text: '提供审计能力。', category: 'security',
          source_range: { start_ref: mandatory.source_ref, end_ref: mandatory.source_ref },
          mandatory_observed: true, requires_confirmation: false
        });
        if (exception) requirements.push({
          text: '提供例外能力。', category: 'technical',
          source_range: { start_ref: exception.source_ref, end_ref: exception.source_ref },
          mandatory_observed: false, requires_confirmation: false
        });
        return { candidates: requirements, warnings: [], audit: { provider: 'semantic_gateway' } };
      }
    }
  });

  try {
    const job = await service.start({
      projectId: project.id, tenderFileId: tenderFile.id, waitForCompletion: true
    });
    assert.equal(job.status, 'succeeded');
    assert.equal(job.document_sections.length, 6);
    assert.equal(job.mandatory_scope_rules.length, 1);
    assert.deepEqual(job.mandatory_scope_rules[0].exception_clause_ids, ['5.2.6']);
    assert.ok(job.chunks.some((chunk) => chunk.status === 'succeeded_empty'));
    const mandatory = job.candidates.find((candidate) => candidate.source_clause_id === '5.2.1');
    const exception = job.candidates.find((candidate) => candidate.source_clause_id === '5.2.6');
    assert.equal(mandatory.is_mandatory, true);
    assert.equal(mandatory.mandatory_scope_section, '项目要求和有关说明');
    assert.equal(exception.is_mandatory, false);
    assert.equal(await repository.getRequirementBaseline(project.id), null);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 对历史 Latin-1 乱码文件名只修复 API 展示，不改持久化字段', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `文件名编码集成测试 ${Date.now()}` });
  const chineseName = '正常中文招标文件.docx';
  const mojibakeName = Buffer.from(chineseName, 'utf8').toString('latin1');
  const file = await repository.addTenderFile({
    projectId: project.id,
    originalName: mojibakeName,
    storageKey: `${project.id}/filename-${Date.now()}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 1
  });

  try {
    const listed = await repository.listTenderFiles(project.id);
    assert.equal(listed[0].original_name, chineseName);
    const fetched = await repository.getTenderFile(file.id);
    assert.equal(fetched.original_name, chineseName);
    const { rows } = await pool.query(`SELECT original_name FROM tender_files WHERE id = $1`, [file.id]);
    assert.equal(rows[0].original_name, mojibakeName);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [project.id]);
    await pool.end();
  }
});

test('PostgreSQL 持久化人工来源范围、排除决定与审计', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool(); const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `来源人工复核集成测试 ${Date.now()}` });
  const file = await repository.addTenderFile({ projectId: project.id, originalName: 'source.pdf', storageKey: `${project.id}/source.pdf`, mimeType: 'application/pdf', sizeBytes: 10 });
  const job = await repository.createParseJob({ projectId: project.id, tenderFileId: file.id });
  try {
    const candidate = (await pool.query(`INSERT INTO requirement_candidates(parse_job_id,req_id,content,source_excerpt,source_text,ordinal) VALUES($1,'REQ-001','需求正文','来源原文','来源原文',1) RETURNING *`, [job.id])).rows[0];
    for (const paragraph of [1, 2]) await pool.query(`INSERT INTO tender_document_paragraphs(parse_job_id,tender_file_id,page_number,paragraph_number,text,normalized_text,start_offset,end_offset,text_hash,extractor_version) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,'test')`, [job.id,file.id,paragraph,paragraph,`第${paragraph}段`,(paragraph-1)*10,paragraph*10,`hash-${paragraph}`]);
    const range = await repository.getCandidateParagraphRange(candidate.id, 1, 2);
    assert.equal(range.length, 2);
    const associated = await repository.saveCandidateSourceDecision({ candidateId: candidate.id, action: 'associate', reason: '人工核验', confirmedBy: 'source-reviewer', location: { source_page: 1, source_paragraph: 1, source_page_start: 1, source_page_end: 2, source_paragraph_start: 1, source_paragraph_end: 2, source_paragraphs_json: [{paragraph:1},{paragraph:2}], source_hash: 'verified-hash', source_match_type: 'manual', source_match_score: 1 } });
    assert.equal(associated.source_verified, true);
    assert.equal(associated.candidate_decision, 'include');
    const excluded = await repository.saveCandidateSourceDecision({ candidateId: candidate.id, action: 'exclude', reason: '不纳入', confirmedBy: 'source-reviewer' });
    assert.equal(excluded.candidate_decision, 'exclude');
    const audit = await pool.query(`SELECT action FROM requirement_source_decision_audits WHERE candidate_id=$1 ORDER BY created_at`, [candidate.id]);
    assert.deepEqual(audit.rows.map((item) => item.action), ['associate', 'exclude']);
  } finally { await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]); await pool.end(); }
});

test('PostgreSQL 暂定基线批量跳过 mandatory 并幂等保存确认元数据', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool(); const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `暂定基线集成测试 ${Date.now()}` });
  const file = await repository.addTenderFile({ projectId: project.id, originalName: 'provisional.txt', storageKey: `${project.id}/provisional.txt`, mimeType: 'text/plain', sizeBytes: 10 });
  const job = await repository.createParseJob({ projectId: project.id, tenderFileId: file.id });
  try {
    await pool.query(`UPDATE tender_parse_jobs SET status='succeeded' WHERE id=$1`, [job.id]);
    await pool.query(`INSERT INTO requirement_candidates(parse_job_id,req_id,content,source_excerpt,source_text,ordinal,is_mandatory,mandatory_marker,candidate_decision,source_status,source_verified) VALUES
      ($1,'REQ-001','已定位需求','已定位原文','已定位原文',1,false,NULL,'include','verified',true),
      ($1,'REQ-002','普通暂定需求','普通暂定原文','普通暂定原文',2,false,NULL,'pending','provisional',false),
      ($1,'REQ-003','强制暂定需求','★强制暂定原文','★强制暂定原文',3,true,'★','pending','provisional',false)`, [job.id]);
    const batch = await repository.includeProvisionalCandidates({ parseJobId: job.id, confirmedBy: 'batch-reviewer' });
    assert.equal(batch.included_count, 1);
    assert.deepEqual(batch.mandatory_manual_required.map((item) => item.req_id), ['REQ-003']);
    const mandatoryId = batch.mandatory_manual_required[0].id;
    await repository.saveCandidateProvisionalDecision({ candidateId: mandatoryId, confirmedBy: 'mandatory-reviewer' });
    const service = new RequirementParseService({ repository });
    const confirmed = await service.confirm(job.id, { confirmed_by: 'baseline-owner' });
    assert.equal(confirmed.baseline.confirmed_by, 'baseline-owner');
    assert.equal(confirmed.baseline.confirmation_type, 'mixed_provisional');
    const baseline = await repository.getRequirementBaseline(project.id);
    assert.deepEqual(baseline.requirements.map((item) => item.source_status), ['verified', 'provisional', 'provisional']);
    assert.equal(baseline.requirements[1].confirmation_type, 'provisional_bulk');
    assert.equal(baseline.requirements[2].confirmation_type, 'provisional_individual');
    assert.equal(baseline.requirements[1].source_page, null);
    assert.equal(baseline.requirements[2].source_paragraph, null);
  } finally { await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]); await pool.end(); }
});

test('A阶段候选确认 HTTP API 保持固定 JSON 契约与完整门禁', async () => {
  const pool = createPool(); const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `候选 API 集成 ${Date.now()}` });
  const file = await repository.addTenderFile({ projectId: project.id, originalName: 'api.txt', storageKey: `${project.id}/api.txt`, mimeType: 'text/plain', sizeBytes: 1 });
  const job = await repository.createParseJob({ projectId: project.id, tenderFileId: file.id });
  let server;
  try {
    await authorizeIntegrationActor(repository,project.id);
    await pool.query(`UPDATE tender_parse_jobs SET status='succeeded',phase='succeeded' WHERE id=$1`, [job.id]);
    const { rows } = await pool.query(`INSERT INTO requirement_candidates(parse_job_id,req_id,content,source_excerpt,source_text,ordinal,is_mandatory,mandatory_marker,candidate_decision,source_status,source_verified,source_page,source_paragraph,source_hash,confirmation_type) VALUES
      ($1,'REQ-001','已核验技术需求','已核验技术需求','已核验技术需求',1,false,NULL,'include','verified',true,1,1,'verified-hash','verified'),
      ($1,'REQ-002','普通实施需求','普通实施需求','普通实施需求',2,false,NULL,'pending','provisional',false,NULL,NULL,NULL,NULL),
      ($1,'REQ-003','强制交付需求','★强制交付需求','★强制交付需求',3,true,'★','pending','provisional',false,NULL,NULL,NULL,NULL) RETURNING id,req_id`, [job.id]);
    const ids = Object.fromEntries(rows.map((item) => [item.req_id, item.id]));
    const requirementParseService = new RequirementParseService({ repository });
    const requirementSourceService = new RequirementSourceService({ repository, storage: {}, textExtractor: async () => ({}) });
    const app = createApp({ repository, storage: {}, generationService: {}, productionBetaService: {}, requirementParseService, requirementSourceService });
    server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, options) => { const response = await fetch(base + path, options); return { response, body: await response.json() }; };

    let result = await call(`/api/tender-parse-jobs/${job.id}/requirement-candidates`);
    assert.equal(result.response.status, 200); assert.equal(result.body.ok, true); assert.equal(result.body.data.candidates.length, 3);
    result = await call(`/api/tender-parse-jobs/${job.id}/requirement-candidates?source_status=verified`);
    assert.deepEqual(result.body.data.candidates.map((item) => item.req_id), ['REQ-001']);
    result = await call(`/api/tender-parse-jobs/${job.id}/confirmation-risk`);
    assert.equal(result.body.data.provisional_pending, 2); assert.equal(result.body.data.mandatory_provisional_pending, 1);

    result = await call(`/api/tender-parse-jobs/${job.id}/confirm-provisional`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmed_by:'batch-user'}) });
    assert.equal(result.body.data.included_count, 1); assert.deepEqual(result.body.data.mandatory_manual_required.map((item) => item.req_id), ['REQ-003']);
    result = await call(`/api/tender-parse-jobs/${job.id}/confirm`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmed_by:'owner'}) });
    assert.equal(result.response.status, 422); assert.equal(result.body.error.code, 'MANDATORY_PROVISIONAL_CONFIRMATION_REQUIRED');
    result = await call(`/api/requirement-candidates/${ids['REQ-003']}/confirm-provisional`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmed_by:'mandatory-user'}) });
    assert.equal(result.body.data.candidate.confirmation_type, 'provisional_individual');
    result = await call(`/api/requirement-candidates/${ids['REQ-002']}/exclude`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    assert.equal(result.body.data.candidate.source_status, 'excluded');
    result = await call(`/api/requirement-candidates/${ids['REQ-002']}/restore`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    assert.equal(result.body.data.candidate.source_status, 'provisional'); assert.equal(result.body.data.candidate.candidate_decision, 'include');
    result = await call(`/api/requirement-candidates/${ids['REQ-002']}/classification`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({requirement_category:'implementation'}) });
    assert.equal(result.body.data.candidate.writer_eligible, true); assert.equal(result.body.data.candidate.classification_review_required, false);
    result = await call(`/api/tender-parse-jobs/${job.id}/confirmation-risk`);
    assert.equal(result.body.data.can_confirm, true);
    result = await call(`/api/tender-parse-jobs/${job.id}/confirm`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmed_by:'owner'}) });
    assert.equal(result.response.status, 201); assert.equal(result.body.data.requirements.length, 3);
    assert.deepEqual(result.body.data.requirements.map((item) => item.req_id), ['REQ-001','REQ-002','REQ-003']);

    result = await call('/api/tender-parse-jobs/not-a-uuid/requirement-candidates');
    assert.equal(result.response.status, 400); assert.equal(result.body.error.code, 'INVALID_JOB_ID');
    result = await call('/api/not-a-route');
    assert.equal(result.response.status, 404); assert.deepEqual(Object.keys(result.body).sort(), ['error','ok']);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]); await pool.end();
  }
});

test('B阶段企业材料与 Evidence Catalog PostgreSQL/HTTP 约束', async () => {
  const pool=createPool(); const repository=new PgRepository(pool);
  const project=await repository.createProject({name:`Evidence MVP 集成 ${Date.now()}`}); let server;
  try {
    await authorizeIntegrationActor(repository,project.id);
    const tender=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'baseline.txt','baseline','text/plain',1) RETURNING *`,[project.id])).rows[0];
    const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`,[project.id,tender.id])).rows[0];
    const baseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,[project.id,job.id])).rows[0];
    await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,mandatory_marker,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible) VALUES($1,$2,'REQ-001','接口能力','接口能力','接口能力',false,NULL,'["data-integration"]',1,'verified','verified','technical',true)`,[baseline.id,project.id]);
    await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='test',confirmation_type='verified' WHERE id=$1`,[baseline.id]);
    const storage={save:async({projectId,originalName})=>`${projectId}/${originalName}`};
    const companyMaterialService=new CompanyMaterialService({repository,storage,textExtractor:async({fileName})=>({text:`企业材料:${fileName}`})});
    const evidenceService=new EvidenceService({repository});
    const app=createApp({repository,storage,generationService:{},productionBetaService:{},requirementParseService:{},requirementSourceService:{},companyMaterialService,evidenceService});
    server=await new Promise((resolve)=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));}); const base=`http://127.0.0.1:${server.address().port}`;
    const uploadBody=new FormData(); uploadBody.append('material_type','case'); uploadBody.append('file',new Blob(['case material'],{type:'text/plain'}),'case.txt');
    let response=await fetch(`${base}/api/projects/${project.id}/company-materials`,{method:'POST',body:uploadBody}); let body=await response.json();
    assert.equal(response.status,201,JSON.stringify(body)); assert.equal(body.data.material.extraction_status,'succeeded'); const material=body.data.material;
    response=await fetch(`${base}/api/company-materials/${material.id}/chunks`);body=await response.json();assert.equal(response.status,200);assert.equal(body.data.chunks.length,1);const chunk=body.data.chunks[0];assert.equal(body.data.material.extracted_text.slice(chunk.char_start,chunk.char_end),chunk.source_text);
    const duplicateBody=new FormData(); duplicateBody.append('material_type','case'); duplicateBody.append('file',new Blob(['case material'],{type:'text/plain'}),'duplicate.txt');
    response=await fetch(`${base}/api/projects/${project.id}/company-materials`,{method:'POST',body:duplicateBody}); body=await response.json();
    assert.equal(response.status,409); assert.equal(body.error.code,'MATERIAL_DUPLICATE');
    response=await fetch(`${base}/api/projects/${project.id}/evidences`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:material.id,evidence_type:'case',title:'非法关联',content:'案例',applicable_requirement_ids:['REQ-X']})}); body=await response.json();
    assert.equal(response.status,422); assert.equal(body.error.code,'EVIDENCE_REQUIREMENT_INVALID');
    response=await fetch(`${base}/api/projects/${project.id}/evidences`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({material_id:material.id,source_chunk_id:chunk.chunk_id,evidence_type:'project_case',title:'有效案例',content:'案例能力',usable_for_claims:true})}); body=await response.json();
    assert.equal(response.status,201,JSON.stringify(body)); const evidence=body.data.evidence; assert.equal(evidence.approval_status,'draft'); assert.equal(evidence.evidence_origin,'enterprise');assert.equal(evidence.source_text,chunk.source_text);assert.equal(evidence.source_hash,chunk.chunk_hash);assert.equal(Object.hasOwn(evidence,'usable_for_claims'),false);
    response=await fetch(`${base}/api/evidences/${evidence.id}/validity`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({validity_status:'active',reviewed_by:'validity-reviewer'})});body=await response.json();assert.equal(body.data.evidence.validity_status,'active');assert.equal(body.data.evidence.validity_reviewed_by,'validity-reviewer');
    assert.equal((await repository.listApprovedEvidence(project.id)).length,0);
    const mappingInput={requirement_id:'REQ-001',evidence_id:evidence.id,mapping_source:'manual',support_level:'partial_support',review_notes:'仅证明接口能力，不证明量化性能。',created_by:'mapper'};response=await fetch(`${base}/api/projects/${project.id}/evidence-mappings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mappingInput)});body=await response.json();assert.equal(response.status,409);assert.equal(body.error.code,'EVIDENCE_NOT_APPROVED');
    response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/enterprise-evidence`);body=await response.json();assert.equal(body.data.evidences.length,0);
    response=await fetch(`${base}/api/evidences/${evidence.id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decided_by:'reviewer'})}); body=await response.json();
    assert.equal(body.data.evidence.approval_status,'approved'); assert.equal((await repository.listApprovedEvidence(project.id)).length,1);response=await fetch(`${base}/api/projects/${project.id}/evidence-mappings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mappingInput)});body=await response.json();assert.equal(response.status,201);assert.equal(body.data.mapping.mapping_status,'proposed');assert.equal(body.data.mapping.support_level,'partial_support');const mapping=body.data.mapping;
    response=await fetch(`${base}/api/evidences/${evidence.id}/validity`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({validity_status:'expired',reviewed_by:'validity-reviewer'})});await response.json();assert.equal((await repository.listApprovedEvidence(project.id)).length,0);response=await fetch(`${base}/api/evidences/${evidence.id}/validity`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({validity_status:'active',reviewed_by:'validity-reviewer'})});await response.json();
    response=await fetch(`${base}/api/evidence-mappings/${mapping.mapping_id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewed_by:'reviewer'})});body=await response.json();assert.equal(body.data.mapping.mapping_status,'approved');response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/enterprise-evidence`);body=await response.json();assert.equal(body.data.evidences.length,1);assert.equal(body.data.evidences[0].support_level,'partial_support');assert.equal(body.data.evidences[0].usable_for_claims,true);response=await fetch(`${base}/api/projects/${project.id}/requirements/REQ-001/evidence-mappings`);body=await response.json();assert.equal(body.data.mappings[0].review_notes,'仅证明接口能力，不证明量化性能。');
    response=await fetch(`${base}/api/evidence-mappings/${mapping.mapping_id}/reject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewed_by:'reviewer'})});await response.json();assert.equal((await repository.listApprovedEvidence(project.id))[0].applicable_requirement_ids.includes('REQ-001'),false);response=await fetch(`${base}/api/evidence-mappings/${mapping.mapping_id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewed_by:'reviewer'})});await response.json();
    const unknownSource=await evidenceService.create(project.id,{material_id:material.id,evidence_type:'project_case',title:'无来源案例',content:'不可用'});await evidenceService.setValidity(unknownSource.id,{validity_status:'active',reviewed_by:'validity-reviewer'});await evidenceService.decide(unknownSource.id,'approved',{decided_by:'reviewer'});const unknownCatalog=await evidenceService.list(project.id);assert.equal(unknownCatalog.evidences.find((item)=>item.id===unknownSource.id).usable_for_claims,false);assert.equal((await repository.listApprovedEvidence(project.id)).some((item)=>item.evidence_id===unknownSource.evidence_id),false);await evidenceService.decide(unknownSource.id,'rejected',{decided_by:'reviewer'});
    const rejected=await evidenceService.create(project.id,{material_id:material.id,evidence_type:'case',title:'拒绝案例',content:'不采用',applicable_requirement_ids:['REQ-001']});
    const rejectedDecision=await evidenceService.decide(rejected.id,'rejected',{decided_by:'reviewer'});
    assert.equal(rejectedDecision.approved_by,null); assert.equal(rejectedDecision.approved_at,null);
    const catalog=await evidenceService.list(project.id); assert.deepEqual(catalog.counts,{draft:0,approved:1,rejected:2});
  } finally { if(server) await new Promise((resolve)=>server.close(resolve)); await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]); await pool.end(); }
});

test('V4.3 ResponsePlan、Claim Gate 与 Coverage HTTP 闭环',async()=>{
  const pool=createPool();const repository=new PgRepository(pool);const project=await repository.createProject({name:`Planning loop ${Date.now()}`});const emptyProject=await repository.createProject({name:`Empty baseline ${Date.now()}`});let server;
  try{
    await authorizeIntegrationActor(repository,project.id,emptyProject.id);
    const productionBetaService=new ProductionBetaService({repository,provider:new ProductionTaskProvider({provider:'mock'})});
    const app=createApp({repository,storage:{},generationService:{},requirementParseService:{},requirementSourceService:{},productionBetaService,companyMaterialService:{},evidenceService:{}});
    server=await new Promise((resolve)=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});const base=`http://127.0.0.1:${server.address().port}`;
    let response=await fetch(`${base}/api/projects/${project.id}/response-plans`);let body=await response.json();assert.equal(response.status,200);assert.equal(body.data.has_confirmed_baseline,false);
    response=await fetch(`${base}/api/projects/${project.id}/response-plans/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});body=await response.json();assert.equal(response.status,409);assert.equal(body.error.code,'REQUIREMENT_BASELINE_REQUIRED');
    for(const target of [project,emptyProject]){const file=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'baseline.txt',$2,'text/plain',1) RETURNING *`,[target.id,`baseline-${target.id}`])).rows[0];const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`,[target.id,file.id])).rows[0];const baseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,[target.id,job.id])).rows[0];if(target.id===project.id){const rows=[['REQ-001','★必须支持审计日志',true,'verified','verified','technical',true],['REQ-002','提供实施计划',false,'provisional','provisional_individual','implementation',true],['REQ-003','报价不得超过预算',false,'verified','verified','commercial',false],['REQ-004','项目背景',false,'verified','verified','context',false]];for(let i=0;i<rows.length;i++){const r=rows[i];await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,mandatory_marker,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible,classification_review_required,atomicity_review_required) VALUES($1,$2,$3,$4,$4,$4,$5,CASE WHEN $5 THEN '★' ELSE NULL END,'[]'::jsonb,$6,$7,$8,$9,$10,false,true)`,[baseline.id,target.id,r[0],r[1],r[2],i+1,r[3],r[4],r[5],r[6]]);}}await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='test',confirmation_type='verified' WHERE id=$1`,[baseline.id]);}
    response=await fetch(`${base}/api/projects/${emptyProject.id}/response-plans/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});body=await response.json();assert.equal(response.status,409);assert.equal(body.error.code,'REQUIREMENT_BASELINE_EMPTY');
    response=await fetch(`${base}/api/projects/${project.id}/response-plans/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});body=await response.json();assert.equal(response.status,201);assert.equal(body.data.plans.length,2);assert.equal(body.data.constraint_records.length,0);assert.equal(body.data.plans[1].source_status,'provisional');assert.equal(body.data.plans.some((item)=>item.requirement_id==='REQ-003'),false);
    response=await fetch(`${base}/api/projects/${project.id}/claims/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});body=await response.json();assert.equal(response.status,201);assert.equal(body.data.approved_claims.length,2);assert.equal(body.data.summary.writer_eligible_requirement_count,2);
    response=await fetch(`${base}/api/projects/${project.id}/coverage`);body=await response.json();assert.equal(body.data.writer_eligible_requirement_count,2);assert.equal(body.data.requirements_with_approved_claim_count,2);assert.equal(body.data.provisional_requirement_count,1);assert.deepEqual(body.data.mandatory_uncovered_ids,[]);
    const mandatoryClaim=(await repository.listClaims(project.id)).find((item)=>item.requirement_id==='REQ-001');
    response=await fetch(`${base}/api/claims/${mandatoryClaim.claim_id}/reject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decided_by:'reviewer'})});body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.data.coverage.mandatory_uncovered_ids,['REQ-001']);assert.equal(body.data.coverage.risk_status,'critical');
    response=await fetch(`${base}/api/claims/${mandatoryClaim.claim_id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decided_by:'reviewer'})});body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.data.coverage.mandatory_uncovered_ids,[]);
  }finally{if(server)await new Promise((resolve)=>server.close(resolve));await pool.query(`DELETE FROM projects WHERE id=ANY($1::uuid[])`,[[project.id,emptyProject.id]]);await pool.end();}
});

test('V4.3 正文 coverage critical 在创建 Batch 前阻断',async()=>{const pool=createPool();const repository=new PgRepository(pool);const project=await repository.createProject({name:`Document gate ${Date.now()}`});try{const file=(await pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes) VALUES($1,'x.txt',$2,'text/plain',1) RETURNING *`,[project.id,`doc-gate-${project.id}`])).rows[0];const job=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase) VALUES($1,$2,'succeeded','succeeded') RETURNING *`,[project.id,file.id])).rows[0];const baseline=(await pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,[project.id,job.id])).rows[0];await pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,mandatory_marker,target_sections,ordinal,source_status,confirmation_type,requirement_category,writer_eligible) VALUES($1,$2,'REQ-001','★必须提供审计','★必须提供审计','★必须提供审计',true,'★','["chapter-06"]',1,'verified','verified','technical',true)`,[baseline.id,project.id]);await pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='test',confirmation_type='verified' WHERE id=$1`,[baseline.id]);const service=new DocumentGenerationService({repository,provider:new WriterProvider({provider:'mock'})});await assert.rejects(()=>service.generate(project.id),(error)=>error.code==='COVERAGE_CRITICAL');const counts=await pool.query(`SELECT (SELECT count(*) FROM document_generations WHERE project_id=$1)::int generations,(SELECT count(*) FROM document_generation_tasks t JOIN document_generations g ON g.id=t.generation_id WHERE g.project_id=$1)::int tasks`,[project.id]);assert.deepEqual(counts.rows[0],{generations:0,tasks:0});}finally{await pool.query(`DELETE FROM projects WHERE id=$1`,[project.id]);await pool.end();}});
