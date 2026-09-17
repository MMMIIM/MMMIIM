import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../src/db.js';
import { LocalFileStorage } from '../../src/storage.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { CompanyMaterialService } from '../../src/company-material-service.js';
import { EnterpriseRetrievalService } from '../../src/pipeline/enterprise-retrieval-service.js';
import { EvidenceSourceSpanService } from '../../src/evidence-source-span-service.js';
import { EvidenceReviewService } from '../../src/evidence-review-service.js';
import { EvidenceSourceFactService } from '../../src/evidence-source-fact-service.js';
import { RequirementEvidenceFactMappingService } from '../../src/requirement-evidence-fact-mapping-service.js';
import { EvidenceReadinessService } from '../../src/evidence-readiness-service.js';
import { ProjectAuthorizationService } from '../../src/project-authorization-service.js';

const here=dirname(fileURLToPath(import.meta.url)),backendRoot=resolve(here,'../..'),workspaceRoot=resolve(backendRoot,'..');
dotenv.config({path:resolve(backendRoot,'.env'),quiet:true});
const sha=value=>createHash('sha256').update(String(value)).digest('hex');
const started=Date.now(),pool=createPool(),repository=new PgRepository(pool);
const PROJECT_NAME=`STAGE12-MATERIAL-COMPLETION-${Date.now()} [REPRESENTATIVE_SYNTHETIC]`;
const REQUIREMENT_ID='STAGE12-REQ-001';
const requirementText='★供应商应持有有效的 ISO/IEC 27001 信息安全管理体系认证。';
const materialText='REPRESENTATIVE_SYNTHETIC\nNOT_REAL_CUSTOMER_DATA\n本公司持有有效的 ISO/IEC 27001 信息安全管理体系认证，证书编号 CM-STAGE12-27001，有效期至 2028-12-31。';
const canonical=[{req_id:REQUIREMENT_ID,content:requirementText,source_excerpt:requirementText,source_text:requirementText,source_page:null,source_paragraph:null,target_sections:['qualification_response'],ordinal:1,is_mandatory:true,mandatory_marker:'★',source_section:'Synthetic Stage 12',source_clause_id:REQUIREMENT_ID,mandatory_scope_source_text:null,mandatory_scope_section:null,exception_clause_ids:[],source_hash:sha(requirementText),source_chunk_id:null,category:'requirement',requires_confirmation:false,source_page_start:null,source_page_end:null,source_paragraph_start:null,source_paragraph_end:null,source_paragraphs_json:[],source_match_type:'exact',source_match_score:1,source_resolution_method:'synthetic_fixture_exact',source_verified:true,source_status:'verified',confirmation_type:'verified',requirement_category:'qualification',writer_eligible:true,classification_review_required:false,atomicity_review_required:false,classification_method:'manual',confirmation_reasons:[],risk_flags:[],source_evidence:{data_classification:'REPRESENTATIVE_SYNTHETIC',not_real_customer_data:true},deduplication:{rule_version:'stage12-material-completion-v1'},canonical_rule_version:'stage12-material-completion-v1'}];

const counts=async projectId=>(await pool.query(`SELECT (SELECT count(*)::int FROM company_materials WHERE project_id=$1) materials,(SELECT count(*)::int FROM material_chunks c JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1) chunks,(SELECT count(*)::int FROM evidence_source_spans WHERE project_id=$1) spans,(SELECT count(*)::int FROM evidence_candidate_reviews WHERE project_id=$1) reviews,(SELECT count(*)::int FROM evidence_source_facts WHERE project_id=$1) facts,(SELECT count(*)::int FROM requirement_evidence_fact_mappings rem JOIN requirements r ON r.id=rem.requirement_id WHERE r.project_id=$1) mappings`,[projectId])).rows[0];
const snapshot=(result,id)=>{const item=result.requirements.find(x=>x.requirement_id===id);return{requirement_id:id,mandatory:item.is_mandatory,readiness_status:item.readiness,approved_evidence_count:item.approved_evidence_count,approved_fact_count:item.approved_fact_count,approved_mapping_count:item.approved_mapping_count,pending_review_count:item.pending_review_count,material_gap_category:item.suggested_material_category,project_summary:result.summary,generation_readiness:result.generation_readiness};};
class FixtureReviewer{constructor(){this.version='stage12-deterministic-reviewer-v1';}async review(){return{semantic_relevance:'relevant',evidence_capability:'capable',support_level:'full_support',review_dimensions:{subject_match:'match',scope_match:'match',status_match:'match',quantitative_match:'match',entity_match:'match',validity_match:'match',source_authority:'match',support_sufficiency:'match'},reason_codes:['HUMAN_REVIEW_REQUIRED'],requires_human_review:true,semantic_reviewer_version:this.version};}}
class FixtureExtractor{constructor(){this.version='stage12-deterministic-extractor-v1';}async extract(){return[{subject:{type:'qualification',name:'ISO/IEC 27001'},entities:[{type:'certificate',name:'ISO/IEC 27001',identifier:'CM-STAGE12-27001'}],status:'certified',status_source_text:'认证',scopes:[],quantities:[],validity:{status:'known',valid_until:'2028-12-31'},domain_metadata:{}}];}}
class FixtureMappingEvaluator{constructor(){this.version='stage12-deterministic-mapping-v1';}async evaluate(){return{semantic_relationship:'direct',support_level:'full_support',dimensions:{subject_match:'match',scope_match:'match',status_match:'match',quantitative_match:'match',entity_match:'match',validity_match:'match',support_sufficiency:'match'},reason_codes:['HUMAN_REVIEW_REQUIRED']};}}

try{
  const project=await repository.createProject({name:PROJECT_NAME});
  const actor={actor_id:'stage12-human-reviewer',actor_type:'maintenance',source:'maintenance_cli'};
  await repository.createProjectMembership({projectId:project.id,actorId:actor.actor_id,role:'OWNER',status:'ACTIVE',createdBy:actor.actor_id});
  const tenderBuffer=Buffer.from(`REPRESENTATIVE_SYNTHETIC\n${requirementText}`),storage=new LocalFileStorage(resolve(workspaceRoot,'uploads'));
  const storageKey=await storage.save({projectId:project.id,originalName:'stage12-requirement.txt',buffer:tenderBuffer});
  const tender=await repository.addTenderFile({projectId:project.id,originalName:'stage12-requirement.txt',storageKey,mimeType:'text/plain',sizeBytes:tenderBuffer.length});
  const parseJob=(await pool.query(`INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,summary_json,extracted_text_sha256,extracted_character_count,started_at,finished_at) VALUES($1,$2,'succeeded',$3::jsonb,$4,$5,now(),now()) RETURNING *`,[project.id,tender.id,JSON.stringify({data_classification:'REPRESENTATIVE_SYNTHETIC',not_real_customer_data:true}),sha(tenderBuffer),tenderBuffer.length])).rows[0];
  await repository.confirmRequirementBaseline({jobId:parseJob.id,requirements:canonical,confirmedBy:'stage12-synthetic-fixture'});
  const readiness=new EvidenceReadinessService({repository}),beforeResult=await readiness.get(project.id),before=snapshot(beforeResult,REQUIREMENT_ID),beforeCounts=await counts(project.id);
  if(before.readiness_status!=='NO_EVIDENCE')throw Object.assign(new Error('Gap fixture must start at NO_EVIDENCE'),{code:'STAGE12_BEFORE_STATE_INVALID'});

  const materialService=new CompanyMaterialService({repository,storage,textExtractor:extractTenderText}),buffer=Buffer.from(materialText);
  const material=await materialService.upload({projectId:project.id,file:{originalname:'stage12-iso27001-proof.md',mimetype:'text/markdown',size:buffer.length,buffer},materialType:'qualification'});
  const requirement=(await pool.query(`SELECT id FROM requirements WHERE project_id=$1 AND req_id=$2`,[project.id,REQUIREMENT_ID])).rows[0];
  const embeddingClient={model:'stage12-deterministic-embedding',version:'v1',dimension:3,embed:async inputs=>inputs.map(()=>[1,0,0])};
  const retrievalService=new EnterpriseRetrievalService({repository,embeddingClient});
  const retrieval=await retrievalService.retrieve(requirement.id);
  const anchor=retrieval.final_candidates?.[0]||retrieval.results?.[0];if(!anchor)throw Object.assign(new Error('No retrieval candidate'),{code:'STAGE12_RETRIEVAL_EMPTY'});
  const span=await new EvidenceSourceSpanService({repository}).resolveFromRetrieval({projectId:project.id,requirementId:REQUIREMENT_ID,retrievalRunId:retrieval.run.retrieval_run_id,anchorChunkId:anchor.chunk_id});
  const reviewService=new EvidenceReviewService({repository,semanticReviewer:new FixtureReviewer(),reviewerVersion:'stage12-deterministic-reviewer-v1'});
  const review=await reviewService.propose({projectId:project.id,requirementId:REQUIREMENT_ID,retrievalRunId:retrieval.run.retrieval_run_id,retrievalCandidateId:anchor.chunk_id,sourceSpanId:span.span_id});
  const pending=snapshot(await readiness.get(project.id),REQUIREMENT_ID);if(pending.readiness_status!=='NEEDS_REVIEW')throw Object.assign(new Error('Review candidate must remain pending'),{code:'STAGE12_PENDING_STATE_INVALID'});
  await reviewService.decide(review.review_id,'approve',{reviewer:'stage12-human-reviewer',note:'Synthetic source lineage verified'});
  const factService=new EvidenceSourceFactService({repository,projectAuthorizationService:new ProjectAuthorizationService({repository}),extractor:new FixtureExtractor()}),fact=(await factService.extract({projectId:project.id,reviewId:review.review_id,actor})).facts[0];
  await factService.decide(fact.fact_id,'approve',{reviewer:'stage12-human-reviewer',note:'Synthetic atomic fact verified'});
  const mappingService=new RequirementEvidenceFactMappingService({repository,evaluator:new FixtureMappingEvaluator()}),mapping=await mappingService.propose({projectId:project.id,requirementId:REQUIREMENT_ID,factId:fact.fact_id});
  await mappingService.decide(mapping.mapping_id,'approve',{reviewer:'stage12-human-reviewer',note:'Synthetic Requirement-Fact support verified'});
  const afterResult=await readiness.get(project.id),after=snapshot(afterResult,REQUIREMENT_ID),afterCounts=await counts(project.id);
  if(after.readiness_status!=='SUPPORTED')throw Object.assign(new Error('Formal approvals did not project to SUPPORTED'),{code:'STAGE12_AFTER_STATE_INVALID'});
  const lineage=afterResult.requirements[0].mapping_summary[0]?.source;if(!lineage?.source_span_id||!lineage?.material_id)throw Object.assign(new Error('Source lineage missing'),{code:'STAGE12_LINEAGE_INVALID'});
  console.log(JSON.stringify({schema_version:'stage12-material-completion-e2e-v1',data_classification:'REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA',project_id:project.id,external_calls:0,external_tokens:0,before,pending,after,material_supplement:{material_id:material.id,material_count_delta:afterCounts.materials-beforeCounts.materials,new_chunk_count:afterCounts.chunks-beforeCounts.chunks,extraction_status:material.extraction_status},processing:{retrieval_runs:1,evidence_candidates:afterCounts.reviews-beforeCounts.reviews,source_spans:afterCounts.spans-beforeCounts.spans,fact_candidates:afterCounts.facts-beforeCounts.facts,mappings_affected:afterCounts.mappings-beforeCounts.mappings,review_actions_required:3,latency_ms:Date.now()-started},gap_resolution:{before:before.readiness_status,intermediate:pending.readiness_status,after:after.readiness_status,resolved:afterResult.gaps.every(x=>x.requirement_id!==REQUIREMENT_ID)},lineage_preserved:true},null,2));
}catch(error){console.error(JSON.stringify({ok:false,error:{code:error.code||'STAGE12_E2E_FAILED',message:error.message}}));process.exitCode=1;}finally{await pool.end();}
