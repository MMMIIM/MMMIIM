import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddingClient, EmbeddingError } from '../src/pipeline/embedding-client.js';
import { EnterpriseRetrievalService } from '../src/pipeline/enterprise-retrieval-service.js';

const REQUIREMENT_ID='00000000-0000-4000-8000-000000000001';
const PROJECT_ID='00000000-0000-4000-8000-000000000002';

test('Embedding Client 验证批量数量、维度和有限数值',async()=>{
  const requests=[];const client=new EmbeddingClient({apiBase:'https://embedding.invalid/v1',apiKey:'secret',model:'fixture',version:'v1',dimension:3,fetchImpl:async(_url,init)=>{requests.push(JSON.parse(init.body));return new Response(JSON.stringify({data:[{index:1,embedding:[0,1,0]},{index:0,embedding:[1,0,0]}]}),{status:200,headers:{'content-type':'application/json'}});}});
  assert.deepEqual(await client.embed(['query','chunk']),[[1,0,0],[0,1,0]]);assert.equal(requests.length,1);assert.deepEqual(requests[0],{model:'fixture',input:['query','chunk'],dimensions:3});
  const invalid=new EmbeddingClient({apiBase:'x',apiKey:'x',model:'x',version:'x',dimension:3,fetchImpl:async()=>new Response(JSON.stringify({data:[{index:0,embedding:[1,0]}]}),{status:200})});await assert.rejects(()=>invalid.embed(['x']),(error)=>error.code==='EMBEDDING_DIMENSION_MISMATCH');
});

test('Retrieval Query 只使用 Canonical Requirement 且不创建 Evidence',async()=>{
  let created;let completed;let evidenceWrites=0;const repository={getCanonicalRequirementForRetrieval:async()=>({id:REQUIREMENT_ID,project_id:PROJECT_ID,req_id:'REQ-001',text:'国产化部署',requirement_category:'technical'}),createRetrievalRun:async(value)=>{created=value;return{retrieval_run_id:'run',...value};},listChunksForRetrieval:async()=>[{chunk_id:'C1',chunk_hash:'H1',source_text:'部署环境：麒麟环境',material_type:'product_documentation',embedding_id:null}],prepareRetrievalCandidates:async(value)=>{assert.equal(value.candidateK,20);return[{chunk_id:'C1',material_id:'M1',source_text:'部署环境：麒麟环境',material_type:'product_documentation',embedding_id:'E1',similarity_score:.9,rank:1}]},completeRetrievalRun:async(value)=>{completed=value;return{run:{status:'succeeded'},raw_candidates:value.ranking.raw_candidates,final_candidates:value.ranking.final_candidates,results:value.ranking.final_candidates};},failRetrievalRun:async()=>{},createEvidenceRecord:async()=>{evidenceWrites+=1;}};
  const embeddingClient={model:'fixture',version:'v1',dimension:3,embed:async(texts)=>{assert.deepEqual(texts,['国产化部署','部署环境：麒麟环境']);return[[1,0,0],[.9,.1,0]];}};const service=new EnterpriseRetrievalService({repository,embeddingClient,defaultTopK:4,clock:()=>10});
  await assert.rejects(()=>service.retrieve(REQUIREMENT_ID,{query_text:'伪造'}),(error)=>error.code==='RETRIEVAL_QUERY_IMMUTABLE');const result=await service.retrieve(REQUIREMENT_ID,{});assert.equal(result.run.status,'succeeded');assert.equal(result.answer_status,'CANDIDATES_FOUND');assert.equal(completed.ranking.fallback_mode,'raw_vector');assert.equal(result.semantic_rerank_activated,false);assert.equal(result.rerank_mode,'RAW_VECTOR_FALLBACK');assert.equal(result.rerank_fallback_reason,'BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE');assert.deepEqual(created.semanticMetadata,{});assert.equal(result.final_candidates.length,1);assert.equal(evidenceWrites,0);
});

test('P1G caller semantic_metadata cannot activate or influence Production ranking',async()=>{
  const variants=[
    {},
    {semantic_metadata:{requirement_role:{value:'project_case',status:'approved'},evidence_needs:[{value:'project_case',status:'approved'}],candidate_roles:{business:{value:'project_case',status:'approved'}}}},
    {semantic_metadata:{requirement_role:{value:'qualification',status:'approved'},evidence_needs:[{value:'qualification',status:'approved'}],candidate_roles:{business:{value:'qualification',status:'approved'},second:{value:'personnel_profile',status:'approved'}}}},
    {semantic_metadata:{requirement_role:{value:'unknown',status:'unknown'},evidence_needs:[],candidate_roles:{}}}
  ];
  const runWithVariant=async(input)=>{
    let created;let completed;
    const repository={
      getCanonicalRequirementForRetrieval:async()=>({id:REQUIREMENT_ID,project_id:PROJECT_ID,req_id:'REQ-001',text:'系统应提供可核验的测试记录。',requirement_category:'technical'}),
      createRetrievalRun:async(value)=>{created=value;return{retrieval_run_id:'run',...value};},
      listChunksForRetrieval:async()=>[],
      prepareRetrievalCandidates:async()=>[
        {chunk_id:'heading',chunk_hash:'H1',source_text:'# 测试记录',material_id:'M1',material_type:'qualification',embedding_id:'E1',similarity_score:.99,rank:1},
        {chunk_id:'business',chunk_hash:'H2',source_text:'测试记录：已完成并可核验。',material_id:'M1',material_type:'qualification',embedding_id:'E2',similarity_score:.8,rank:2},
        {chunk_id:'second',chunk_hash:'H3',source_text:'测试结果归档于项目资料。',material_id:'M2',material_type:'qualification',embedding_id:'E3',similarity_score:.7,rank:3}
      ],
      completeRetrievalRun:async(value)=>{completed=value;return{run:{status:'succeeded'},raw_candidates:value.ranking.raw_candidates,final_candidates:value.ranking.final_candidates,results:value.ranking.final_candidates};},
      failRetrievalRun:async()=>{}
    };
    const embeddingClient={model:'fixture',version:'v1',dimension:3,embed:async()=>[[1,0,0]]};
    const result=await new EnterpriseRetrievalService({repository,embeddingClient,defaultTopK:8}).retrieve(REQUIREMENT_ID,input);
    return{created,completed,result};
  };
  const runs=await Promise.all(variants.map(runWithVariant));
  const finalOrder=runs[0].result.final_candidates.map((item)=>item.chunk_id);
  const survivorOrder=runs[0].result.candidate_hygiene.eligible_candidates.map((item)=>item.chunk_id);
  for(const [index,run] of runs.entries()){
    assert.deepEqual(run.result.final_candidates.map((item)=>item.chunk_id),finalOrder,`variant ${index} final order`);
    assert.deepEqual(run.result.candidate_hygiene.eligible_candidates.map((item)=>item.chunk_id),survivorOrder,`variant ${index} hygiene survivors`);
    assert.deepEqual(run.completed.ranking.final_candidates.map((item)=>item.chunk_id),finalOrder,`variant ${index} persisted order`);
    assert.deepEqual(run.created.semanticMetadata,{});
    assert.equal(run.completed.ranking.fallback_mode,'raw_vector');
    assert.equal(run.result.semantic_rerank_activated,false);
    assert.equal(run.result.rerank_mode,'RAW_VECTOR_FALLBACK');
    assert.equal(run.result.rerank_fallback_reason,'BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE');
    assert.equal(run.result.caller_semantic_metadata_ignored,index>0);
  }
});

test('Retrieval material scope is explicit and empty scope returns no-answer',async()=>{
  let listed,prepared;const repository={getCanonicalRequirementForRetrieval:async()=>({id:REQUIREMENT_ID,project_id:PROJECT_ID,req_id:'REQ-001',text:'无对应材料',requirement_category:'technical'}),createRetrievalRun:async(value)=>({retrieval_run_id:'run',...value}),listChunksForRetrieval:async(value)=>{listed=value;return[];},prepareRetrievalCandidates:async(value)=>{prepared=value;return[];},completeRetrievalRun:async(value)=>({run:{status:'succeeded'},raw_candidates:[],final_candidates:[],results:[]}),failRetrievalRun:async()=>{}};
  const client={model:'fixture',version:'v1',dimension:3,embed:async()=>[[1,0,0]]};const service=new EnterpriseRetrievalService({repository,embeddingClient:client});const selected='00000000-0000-4000-8000-000000000003';const result=await service.retrieve(REQUIREMENT_ID,{material_ids:[selected]});assert.equal(result.answer_status,'NO_RELEVANT_EVIDENCE');assert.equal(result.no_answer_code,'NO_RELEVANT_EVIDENCE');assert.deepEqual(listed.materialIds,[selected]);assert.deepEqual(prepared.materialIds,[selected]);
  await assert.rejects(()=>service.retrieve(REQUIREMENT_ID,{material_ids:['not-a-uuid']}),(error)=>error.code==='RETRIEVAL_FILTER_INVALID');
});

test('Enterprise proof retrieval never promotes government reference material into formal candidates',async()=>{
  let completed;
  const repository={
    getCanonicalRequirementForRetrieval:async()=>({id:REQUIREMENT_ID,project_id:PROJECT_ID,req_id:'REQ-001',text:'企业应证明自身具备实施能力。',requirement_category:'technical'}),
    createRetrievalRun:async(value)=>({retrieval_run_id:'run',...value}),
    listChunksForRetrieval:async()=>[{chunk_id:'C1',chunk_hash:'H1',source_text:'行业指南说明。',material_id:'M1',material_type:'other',source_type:'official',source_authority:'administrative_regulation',corpus_scope:'GOVERNMENT_ENTERPRISE',embedding_id:null}],
    prepareRetrievalCandidates:async()=>[{chunk_id:'C1',chunk_hash:'H1',source_text:'行业指南说明。',material_id:'M1',material_type:'other',source_type:'official',source_authority:'administrative_regulation',corpus_scope:'GOVERNMENT_ENTERPRISE',embedding_id:'E1',similarity_score:.99,rank:1}],
    completeRetrievalRun:async(value)=>{completed=value;return{run:{status:'succeeded'},raw_candidates:[],final_candidates:[],results:[]};},
    failRetrievalRun:async()=>{}
  };
  const client={model:'fixture',version:'v1',dimension:3,embed:async()=>[[1,0,0],[.9,.1,0]]};
  const result=await new EnterpriseRetrievalService({repository,embeddingClient:client}).retrieve(REQUIREMENT_ID);
  assert.equal(result.answer_status,'NO_RELEVANT_EVIDENCE');
  assert.equal(result.source_routing.intent,'ENTERPRISE_PRODUCT_CAPABILITY');
  assert.equal(result.source_routing.reference_candidates.length,1);
  assert.equal(completed.ranking.final_candidates.length,0);
});

test('formal evidence retrieval filters heading and metadata candidates before final TopK', async () => {
  let completed;
  const repository = {
    getCanonicalRequirementForRetrieval: async () => ({ id: REQUIREMENT_ID, project_id: PROJECT_ID, req_id: 'REQ-001', text: '系统应提供可核验的测试记录。', requirement_category: 'technical' }),
    createRetrievalRun: async (value) => ({ retrieval_run_id: 'run', ...value }),
    listChunksForRetrieval: async () => [
      { chunk_id: 'heading', chunk_hash: 'H1', source_text: '# ISO 27001 受控记录', material_id: 'M1', material_type: 'qualification', embedding_id: null },
      { chunk_id: 'business', chunk_hash: 'H2', source_text: '名称：ISO/IEC 27001\n状态：active\n有效至：2027-11-30', material_id: 'M1', material_type: 'qualification', embedding_id: null },
      { chunk_id: 'wrong-heading', chunk_hash: 'H3', source_text: '# ISO 9001 受控记录', material_id: 'M2', material_type: 'qualification', embedding_id: null }
    ],
    prepareRetrievalCandidates: async () => [
      { chunk_id: 'heading', chunk_hash: 'H1', source_text: '# ISO 27001 受控记录', material_id: 'M1', material_type: 'qualification', embedding_id: 'E1', similarity_score: 0.99, rank: 1 },
      { chunk_id: 'business', chunk_hash: 'H2', source_text: '名称：ISO/IEC 27001\n状态：active\n有效至：2027-11-30', material_id: 'M1', material_type: 'qualification', embedding_id: 'E2', similarity_score: 0.8, rank: 2 },
      { chunk_id: 'wrong-heading', chunk_hash: 'H3', source_text: '# ISO 9001 受控记录', material_id: 'M2', material_type: 'qualification', embedding_id: 'E3', similarity_score: 0.7, rank: 3 }
    ],
    completeRetrievalRun: async (value) => { completed = value; return { run: { status: 'succeeded' }, raw_candidates: value.ranking.raw_candidates, final_candidates: value.ranking.final_candidates, results: value.ranking.final_candidates }; },
    failRetrievalRun: async () => {}
  };
  const embeddingClient = { model: 'fixture', version: 'v1', dimension: 3, embed: async (texts) => texts.map(() => [1, 0, 0]) };
  const result = await new EnterpriseRetrievalService({ repository, embeddingClient, defaultTopK: 5 }).retrieve(REQUIREMENT_ID);
  assert.deepEqual(result.final_candidates.map((item) => item.chunk_id), ['business']);
  assert.deepEqual(result.candidate_hygiene.excluded_candidates.map((item) => item.chunk_id), ['heading', 'wrong-heading']);
  assert.equal(result.candidate_hygiene.internal_candidate_pool_size, 3);
  assert.equal(result.candidate_hygiene.eligible_candidate_pool_size, 1);
  assert.equal(completed.ranking.raw_candidates.length, 3);
  assert.equal(completed.ranking.final_candidates[0].chunk_role, 'BUSINESS_CONTENT');
});

test('Embedding failure 必须持久化 failed run 且不伪造向量',async()=>{
  let failure;let completed=false;const repository={getCanonicalRequirementForRetrieval:async()=>({id:REQUIREMENT_ID,project_id:PROJECT_ID,req_id:'REQ-001',text:'query'}),createRetrievalRun:async()=>({retrieval_run_id:'run'}),listChunksForRetrieval:async()=>[{chunk_id:'C1',chunk_hash:'H1',source_text:'chunk'}],prepareRetrievalCandidates:async()=>[],completeRetrievalRun:async()=>{completed=true;},failRetrievalRun:async(value)=>{failure=value;}};const client={model:'fixture',version:'v1',dimension:3,embed:async()=>{throw new EmbeddingError('EMBEDDING_TIMEOUT','Embedding 服务超时。',504);}};
  await assert.rejects(()=>new EnterpriseRetrievalService({repository,embeddingClient:client}).retrieve(REQUIREMENT_ID),(error)=>error.code==='EMBEDDING_TIMEOUT');assert.equal(failure.errorCode,'EMBEDDING_TIMEOUT');assert.equal(completed,false);
});
