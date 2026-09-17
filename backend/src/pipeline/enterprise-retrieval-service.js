import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
import { EmbeddingError } from './embedding-client.js';
import { PRODUCTION_CANDIDATE_K,PRODUCTION_REVIEW_K,RERANK_VERSION,RETRIEVAL_CONTRACT_VERSION,rerankProductionCandidates } from './semantic-retrieval-reranker.js';
import { PUBLIC_CORPUS_PROJECT_ID } from './corpus-contract.js';
import { routeEnterpriseProofCandidates } from './enterprise-evidence-source-router.js';
import { partitionRetrievalCandidates } from './retrieval-chunk-role.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES=new Set(['company_profile','qualification','case','project_case','product','product_documentation','personnel','technical_solution','technical_whitepaper','delivery_capability','historical_bid','other']);
const RAW_VECTOR_FALLBACK_MODE='RAW_VECTOR_FALLBACK';
const SEMANTIC_RERANK_MODE='SEMANTIC_RERANK';
const BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE='BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE';
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const topK=(value,fallback)=>{const parsed=value==null?fallback:Number(value);if(!Number.isInteger(parsed)||parsed<1||parsed>50)throw new AppError('RETRIEVAL_TOP_K_INVALID','top_k 必须是 1 至 50 的整数。',422);return parsed;};
const rerankAudit=(fallbackMode)=>fallbackMode==='raw_vector'?{semantic_rerank_activated:false,rerank_mode:RAW_VECTOR_FALLBACK_MODE,rerank_fallback_reason:BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE}:{semantic_rerank_activated:true,rerank_mode:SEMANTIC_RERANK_MODE,rerank_fallback_reason:null};
const materialIds=(value)=>{
  if(value==null)return [];
  if(!Array.isArray(value))throw new AppError('RETRIEVAL_FILTER_INVALID','material_ids 必须是数组。',422);
  const ids=[...new Set(value.map(String))];
  if(ids.some((id)=>!UUID.test(id)))throw new AppError('RETRIEVAL_FILTER_INVALID','material_ids 包含无效值。',422);
  return ids;
};

export class EnterpriseRetrievalService{
  constructor({repository,embeddingClient,defaultTopK=PRODUCTION_REVIEW_K,clock=()=>Date.now()}){this.repository=repository;this.embeddingClient=embeddingClient;this.defaultTopK=Number(defaultTopK)||PRODUCTION_REVIEW_K;this.clock=clock;}
  async retrieve(requirementId,input={}){
    if(!UUID.test(String(requirementId||'')))throw new AppError('INVALID_REQUIREMENT_ID','Requirement ID 格式无效。',400);
    const requirement=await this.repository.getCanonicalRequirementForRetrieval(requirementId);if(!requirement)throw new AppError('REQUIREMENT_NOT_FOUND','Canonical Requirement 不存在或基线未确认。',404);
    if(Object.hasOwn(input,'query_text'))throw new AppError('RETRIEVAL_QUERY_IMMUTABLE','Retrieval Query 必须来自 Canonical Requirement。',422);
    const legacyLimit=topK(input.top_k,this.defaultTopK);const materialTypes=[...new Set((input.material_types||[]).map(String))];if(materialTypes.some((type)=>!TYPES.has(type)))throw new AppError('RETRIEVAL_FILTER_INVALID','material_types 包含无效值。',422);const selectedMaterialIds=materialIds(input.material_ids);const corpusScopes=[...new Set((input.corpus_scopes||['GENERAL']).map(String))].filter((scope)=>['GENERAL','GOVERNMENT_ENTERPRISE','HEALTHCARE'].includes(scope));
    const callerSemanticMetadataProvided=Object.hasOwn(input,'semantic_metadata');const productionSemanticMetadata=Object.freeze({});const config={model:this.embeddingClient.model,version:this.embeddingClient.version,dimension:this.embeddingClient.dimension};const filters={project_id:requirement.project_id,corpus_project_id:PUBLIC_CORPUS_PROJECT_ID,corpus_scopes:corpusScopes,extraction_status:'succeeded',material_types:materialTypes,material_ids:selectedMaterialIds};const started=this.clock();const run=await this.repository.createRetrievalRun({projectId:requirement.project_id,requirementDbId:requirement.id,requirementRef:requirement.req_id,queryText:requirement.text,queryHash:sha(requirement.text),...config,topK:legacyLimit,candidateK:PRODUCTION_CANDIDATE_K,reviewK:Math.min(PRODUCTION_REVIEW_K,legacyLimit),filters,semanticMetadata:productionSemanticMetadata,retrievalContractVersion:RETRIEVAL_CONTRACT_VERSION,rerankVersion:RERANK_VERSION});
    try{
      const chunks=await this.repository.listChunksForRetrieval({projectId:requirement.project_id,materialTypes,materialIds:selectedMaterialIds,corpusScopes,corpusProjectId:PUBLIC_CORPUS_PROJECT_ID,...config});if(chunks.some((item)=>item.embedding_id&&Number(item.embedding_dimension)!==config.dimension))throw new AppError('EMBEDDING_IDENTITY_CONFLICT','同一 embedding model/version 的维度不一致，请更新 embedding_version。',409);const missing=chunks.filter((item)=>!item.embedding_id);const vectors=await this.embeddingClient.embed([requirement.text,...missing.map((item)=>item.source_text)]);const queryVector=vectors[0];const newEmbeddings=missing.map((chunk,index)=>({chunkId:chunk.chunk_id,chunkHash:chunk.chunk_hash,embedding:vectors[index+1],...config}));
      const rawCandidates=await this.repository.prepareRetrievalCandidates({queryVector,newEmbeddings,projectId:requirement.project_id,materialTypes,materialIds:selectedMaterialIds,corpusScopes,corpusProjectId:PUBLIC_CORPUS_PROJECT_ID,...config,candidateK:PRODUCTION_CANDIDATE_K});
      const hygiene=partitionRetrievalCandidates({requirement,candidates:rawCandidates});
      const sourceRouting=routeEnterpriseProofCandidates({requirement,candidates:hygiene.eligible_candidates});
      const ranking=rerankProductionCandidates(sourceRouting.intent?sourceRouting.proof_candidates:hygiene.eligible_candidates,productionSemanticMetadata);const selected=ranking.final_candidates.slice(0,Math.min(PRODUCTION_REVIEW_K,legacyLimit));const rerankStatus=rerankAudit(ranking.fallback_mode);
      // Keep candidates excluded by deterministic hygiene in the persisted audit
      // pool, but never let them enter the formal reranked/final evidence lane.
      const excludedForAudit=hygiene.excluded_candidates.map((item)=>({...item,content_role:item.content_role||item.chunk_role||'unknown',audit_rank:ranking.reranked_candidates.length+(item.raw_vector_rank??item.rank??0),reranked_rank:null,retrieval_contract_version:RETRIEVAL_CONTRACT_VERSION,rerank_version:RERANK_VERSION,role_compatibility:'unknown',matched_evidence_needs:[],rerank_reasons:['EXCLUDED_BEFORE_RERANK']}));
      const rankingWithHygiene={...ranking,...rerankStatus,raw_candidates:hygiene.all_candidates,reranked_candidates:[...ranking.reranked_candidates,...excludedForAudit],final_candidates:selected};
      const result=await this.repository.completeRetrievalRun({runId:run.retrieval_run_id,ranking:rankingWithHygiene,latencyMs:Math.max(0,this.clock()-started),...config});
      return{...result,...rerankStatus,caller_semantic_metadata_ignored:callerSemanticMetadataProvided,answer_status:selected.length?'CANDIDATES_FOUND':'NO_RELEVANT_EVIDENCE',no_answer_code:selected.length?null:'NO_RELEVANT_EVIDENCE',source_routing:sourceRouting,reference_candidates:sourceRouting.reference_candidates,candidate_hygiene:{...hygiene,final_evidence_candidate_count:selected.length}};
    }catch(error){const code=error instanceof EmbeddingError?error.code:error instanceof AppError?error.code:'RETRIEVAL_FAILED';const message=error instanceof EmbeddingError?error.message:'Enterprise Retrieval 执行失败。';await this.repository.failRetrievalRun({runId:run.retrieval_run_id,errorCode:code,errorMessage:message,latencyMs:Math.max(0,this.clock()-started)});throw error instanceof EmbeddingError?error:new AppError(code,message,error instanceof AppError?error.status:500);}
  }
  async get(runId){if(!UUID.test(String(runId||'')))throw new AppError('INVALID_RETRIEVAL_RUN_ID','Retrieval Run ID 格式无效。',400);const result=await this.repository.getRetrievalRun(runId);if(!result)throw new AppError('RETRIEVAL_RUN_NOT_FOUND','Retrieval Run 不存在。',404);return{...result,...rerankAudit(result.run?.fallback_mode)};}
}
