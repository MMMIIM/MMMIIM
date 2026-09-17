import dotenv from 'dotenv';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPool,PgRepository} from '../../src/db.js';
import {createEmbeddingClientFromEnv} from '../../src/pipeline/embedding-client.js';
import {EnterpriseRetrievalService} from '../../src/pipeline/enterprise-retrieval-service.js';
import {MAX_RERANK_SHIFT} from '../../src/pipeline/semantic-retrieval-reranker.js';

const here=dirname(fileURLToPath(import.meta.url)),backend=resolve(here,'../..');
dotenv.config({path:resolve(backend,'.env'),quiet:true});
const PROJECT_NAME='E2E-PRODUCTION-RETRIEVAL-V1 [data_classification=synthetic]';
const needs={'E2E-REQ-001':'quantitative_performance','E2E-REQ-002':'compatibility','E2E-REQ-003':'qualification','E2E-REQ-004':'project_experience'};
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const pool=createPool(),repository=new PgRepository(pool),provider=createEmbeddingClientFromEnv(),providerAudit=[];
const embeddingClient={model:provider.model,version:provider.version,dimension:provider.dimension,embed:async(inputs)=>{const started=Date.now(),requestHash=sha(JSON.stringify({model:provider.model,version:provider.version,dimension:provider.dimension,inputs}));try{const vectors=await provider.embed(inputs);providerAudit.push({status:'succeeded',input_count:inputs.length,latency_ms:Date.now()-started,request_hash:requestHash});return vectors;}catch(error){providerAudit.push({status:'failed',input_count:inputs.length,latency_ms:Date.now()-started,request_hash:requestHash,error_code:error.code||'EMBEDDING_FAILED'});throw error;}}};
const service=new EnterpriseRetrievalService({repository,embeddingClient});
try{
  const project=(await pool.query(`SELECT id FROM projects WHERE name=$1 ORDER BY created_at LIMIT 1`,[PROJECT_NAME])).rows[0];if(!project)throw new Error('SYNTHETIC_E2E_PROJECT_MISSING');
  const requirements=(await pool.query(`SELECT r.id,r.req_id FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id AND b.status='confirmed' WHERE r.project_id=$1 AND r.req_id=ANY($2::text[]) ORDER BY r.req_id`,[project.id,Object.keys(needs)])).rows;if(requirements.length!==4)throw new Error('SYNTHETIC_E2E_REQUIREMENTS_INVALID');
  const chunks=(await pool.query(`SELECT c.chunk_id,m.original_name FROM material_chunks c JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1 ORDER BY c.chunk_id`,[project.id])).rows;if(chunks.length!==60)throw new Error('SYNTHETIC_E2E_CHUNKS_INVALID');
  const sideEffectsBefore=(await pool.query(`SELECT (SELECT count(*)::int FROM evidences WHERE project_id=$1) evidences,(SELECT count(*)::int FROM evidence_facts WHERE project_id=$1) facts,(SELECT count(*)::int FROM requirement_evidence_mappings rem JOIN requirements r ON r.id=rem.requirement_id WHERE r.project_id=$1) mappings,(SELECT count(*)::int FROM claims WHERE project_id=$1) claims`,[project.id])).rows[0];
  const results=[];
  for(const requirement of requirements){const response=await service.retrieve(requirement.id);if(response.semantic_rerank_activated||response.rerank_mode!=='RAW_VECTOR_FALLBACK'||response.rerank_fallback_reason!=='BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE')throw new Error('PRODUCTION_RERANK_AUTHORITY_CONTAINMENT_VIOLATION');const audit=await service.get(response.run.retrieval_run_id);const rows=audit.final_candidates.map((item)=>({source_document_id:item.source_document_id,source_chunk_id:item.source_chunk_id,raw_vector_rank:item.raw_vector_rank,raw_similarity:Number(item.raw_similarity.toFixed(8)),reranked_rank:item.reranked_rank,content_role:item.content_role,role_compatibility:item.role_compatibility,matched_evidence_needs:item.matched_evidence_needs,rerank_reasons:item.rerank_reasons,rank_shift:item.reranked_rank-item.raw_vector_rank}));if(audit.raw_candidates.length!==20||rows.length>8||rows.some((item)=>Math.abs(item.rank_shift)>MAX_RERANK_SHIFT))throw new Error('PRODUCTION_RETRIEVAL_CONTRACT_VIOLATION');results.push({requirement_id:requirement.req_id,retrieval_run_id:response.run.retrieval_run_id,raw_candidate_count:audit.raw_candidates.length,final_candidate_count:rows.length,candidates:rows});}
  const sideEffectsAfter=(await pool.query(`SELECT (SELECT count(*)::int FROM evidences WHERE project_id=$1) evidences,(SELECT count(*)::int FROM evidence_facts WHERE project_id=$1) facts,(SELECT count(*)::int FROM requirement_evidence_mappings rem JOIN requirements r ON r.id=rem.requirement_id WHERE r.project_id=$1) mappings,(SELECT count(*)::int FROM claims WHERE project_id=$1) claims`,[project.id])).rows[0];if(JSON.stringify(sideEffectsBefore)!==JSON.stringify(sideEffectsAfter))throw new Error('EVIDENCE_BOUNDARY_VIOLATION');
  process.stdout.write(`${JSON.stringify({ok:true,data_classification:'REPRESENTATIVE_SYNTHETIC',not_real_customer_data:true,provider_category:'openai_compatible',embedding_model:provider.model,embedding_version:provider.version,embedding_dimension:provider.dimension,provider_audit:providerAudit,project_id:project.id,requirements:results,side_effects_before:sideEffectsBefore,side_effects_after:sideEffectsAfter},null,2)}\n`);
}catch(error){process.stderr.write(`${JSON.stringify({ok:false,error_code:error.code||error.message||'PRODUCTION_RETRIEVAL_E2E_FAILED',provider_audit:providerAudit})}\n`);process.exitCode=1;}finally{await pool.end();}
