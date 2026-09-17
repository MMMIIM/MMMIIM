import {createHash} from 'node:crypto';
import {evaluateClaimGateBridge} from './claim-gate-input-adapter-v1.js';
import {createProjectFactCandidate} from './project-fact-control-contract-v1.js';
import {createPropagationBinding} from './project-fact-propagation-contract-v1.js';
import {createWriterSafeContext} from './writer-input-authorization-v1.js';
import {buildWriterTask,deriveAuthorizedWriterProviderSchema} from './writer-execution-contract-v1.js';

export const WRITER_PROMPT_VERSION='writer-prompt-v1';
export const EXTERNAL_WRITER_PREFLIGHT_VERSION='external-writer-preflight-v1';
const sha=value=>createHash('sha256').update(String(value)).digest('hex');

export const WRITER_SYSTEM_PROMPT=`You are a chapter writer. Return one JSON object with a blocks array only.
Requirements marked REQUIREMENT_RESPONSE_ONLY describe what the project must respond to; they are not enterprise capability facts. Use context_only items only to understand constraints. Make enterprise factual statements only from assertable_claims.
Never add or expand numbers, dates, status, qualifications, people, compatibility scope, validity, delivery scope, or commitments.
Every block must contain text, used_context_refs, and used_claim_refs. References must be IDs present in the Writer Task.
Do not return Markdown fences, commentary, reasoning, or fields outside the requested output contract.`;

export function buildExternalWriterRequest(task,{model,maxOutputTokens=1600,responseFormatMode='json_object',enableThinking=false}={}){const response_format=responseFormatMode==='json_schema'?{type:'json_schema',json_schema:{name:'writer_output_v1',strict:true,schema:deriveAuthorizedWriterProviderSchema(task)}}:{type:'json_object'};return{model,temperature:0.2,max_tokens:maxOutputTokens,enable_thinking:enableThinking,response_format,messages:[{role:'system',content:WRITER_SYSTEM_PROMPT},{role:'user',content:JSON.stringify({instruction:'只输出一个 JSON object，不得输出 Markdown、code fence、解释或前后缀。根层只允许 blocks。每个 block 必须包含 block_id、text、used_context_refs、used_claim_refs。每个事实块必须逐字包含对应 assertable claim，并同时列出授权的 context ref 和 claim ref。',writer_task:task,output_contract:{blocks:[{block_id:'string',text:'string',used_context_refs:['authorized project_fact_id'],used_claim_refs:['authorized claim_id']}]}})}]};}

export function resolveExternalWriterRuntime(env=process.env){
  const apiBase=String(env.EXTERNAL_WRITER_API_BASE||'').replace(/\/+$/,'');
  const keySetting=String(env.EXTERNAL_WRITER_API_KEY||'');
  const reference=keySetting.match(/^\$\{([A-Z][A-Z0-9_]*)\}$/)?.[1];
  const apiKey=reference?String(env[reference]||''):keySetting;
  const model=String(env.EXTERNAL_WRITER_MODEL||'');
  let host=null;
  try{host=apiBase?new URL(apiBase).host:null;}catch{host=null;}
  const responseFormatMode=env.EXTERNAL_WRITER_RESPONSE_FORMAT==='json_schema'?'json_schema':'json_object';
  return{provider:'SiliconFlow',protocol:'OpenAI-compatible',endpoint_type:'chat_completions',api_base:apiBase,host,api_key_configured:Boolean(apiKey),model,model_available:env.EXTERNAL_WRITER_MODEL_AVAILABLE==='true',mode:'non-think',enable_thinking:env.EXTERNAL_WRITER_ENABLE_THINKING==='true',temperature:0.2,max_output_tokens:Number(env.EXTERNAL_WRITER_MAX_OUTPUT_TOKENS)||1600,timeout_ms:Number(env.EXTERNAL_WRITER_TIMEOUT_MS)||120000,response_format_mode:responseFormatMode,concurrency:1,retry_count:0,prompt_version:WRITER_PROMPT_VERSION,configured:Boolean(apiBase&&apiKey&&host&&model)};
}

export function buildSafePositiveWriterFixture({projectId}){
  const sourceText='Synthetic Vendor 的 Model A 产品具有有效注册证 CERT-001。';
  const evidenceFact={fact_id:'EFACT-SYNTHETIC-SAFE-001',project_id:projectId,evidence_review_id:'EREVIEW-SYNTHETIC-SAFE-001',review_status:'approved',version:1,payload_hash:sha(sourceText),contract_version:'evidence-fact-v1',subject:{type:'organization',name:'Synthetic Vendor'},entities:[{type:'product_model',name:'Model A',relation:'registered_product'},{type:'certificate',identifier:'CERT-001',relation:'registration'}],fact_status:'registered',scopes:['registration_fact'],quantities:[],validity:{status:'active'}};
  const mapping={mapping_id:'MAP-SYNTHETIC-SAFE-001',review_status:'approved',support_level:'full_support',semantic_relationship:'direct',dimensions:{subject_match:'match',scope_match:'match',status_match:'match',quantitative_match:'not_applicable',entity_match:'match',validity_match:'match',support_sufficiency:'sufficient',source_authority:'authoritative'},contract_version:'requirement-evidence-mapping-v1',payload_hash:sha('MAP-SYNTHETIC-SAFE-001')};
  const requirement={req_id:'E2E-REQ-SAFE-001',requirement_hash:sha('供应商应提供有效产品注册资质。'),contract_version:'canonical-v1'};
  const claimInput={claim_id:'CLM-SYNTHETIC-SAFE-001',project_id:projectId,requirement_id:requirement.req_id,text:sourceText,assertions:[{subject:{type:'organization',name:'Synthetic Vendor'},entities:evidenceFact.entities,status:'registered',scopes:['registration_fact'],quantities:[],validity:evidenceFact.validity}],referenced_fact_ids:[evidenceFact.fact_id],referenced_mapping_ids:[mapping.mapping_id],target_sections:['chapter-qualification']};
  const bridge=evaluateClaimGateBridge({projectId,requirement,claim:claimInput,facts:[evidenceFact],mappings:[mapping],lineage:{verified:true,usable:true,material_type:'qualification'},evaluatorVersion:'deterministic_backend'});
  if(bridge.evaluation.decision!=='allow'||bridge.evaluation.writer_eligible!==true)throw Object.assign(new Error('Safe Positive Claim did not pass Claim Gate v2.'),{code:'SAFE_POSITIVE_GATE_NOT_ALLOW'});
  const projectFact=createProjectFactCandidate({project_id:projectId,key:'synthetic.qualification.registration',fact_role:'enterprise_fact',value_type:'structured',value:{subject:'Synthetic Vendor',product_model:'Model A',certificate:'CERT-001',status:'registered',valid_until:'2099-12-31'},value_status:'known',scope:['chapter-qualification'],provenance_refs:[{source_type:'evidence_fact',source_id:evidenceFact.fact_id,snapshot_hash:evidenceFact.payload_hash,source_ref:{fact_id:evidenceFact.fact_id}}],created_by_type:'system',created_by:'task-9d-auth-r1',review_status:'approved'});
  projectFact.review_status='approved';
  const binding=createPropagationBinding({project_id:projectId,project_fact_id:projectFact.project_fact_id,project_fact_version:projectFact.version,target_type:'chapter',target_id:'chapter-qualification',binding_role:'required',binding_status:'active',source_reason:'deterministic_rule',source_ref:{fixture:'task-9d-safe-positive'}});
  const editableFact=createProjectFactCandidate({project_id:projectId,key:'synthetic.writer.section_label',fact_role:'project_decision',value_type:'string',value:'资质情况',value_status:'known',scope:['chapter-qualification'],provenance_refs:[{source_type:'human_input',source_id:'task-9d-section-label',snapshot_hash:'0'.repeat(64),source_ref:{classification:'synthetic'}}],created_by_type:'human',created_by:'task-9d-auth-r1',review_status:'approved'});editableFact.review_status='approved';
  const editableBinding=createPropagationBinding({project_id:projectId,project_fact_id:editableFact.project_fact_id,project_fact_version:editableFact.version,target_type:'chapter',target_id:'chapter-qualification',binding_role:'required',binding_status:'active',source_reason:'deterministic_rule',source_ref:{fixture:'task-9d-editable-control'}});
  const gate={...bridge.evaluation,claim_id:bridge.claim.claim_id,claim_assertion_hash:bridge.claim.assertion_hash,gate_result_id:bridge.gate_result_id,input_snapshot_hash:bridge.input_snapshot_hash,lineage_current:true,current:true,source_hashes:[evidenceFact.payload_hash]};
  const facts=[projectFact,editableFact],bindings=[binding,editableBinding],context=createWriterSafeContext({projectId,chapterId:'chapter-qualification',writerTaskId:'WT-SYNTHETIC-SAFE-001',facts,bindings,claims:[{...bridge.claim,current:true}],gateResults:[gate],versions:{projectFactContextHash:sha(facts.map(x=>x.payload_hash).join(':')),propagationBindingVersion:'project-fact-propagation-v1',chapterPlanVersion:'production-shaped-synthetic-v1',claimGateIdentity:bridge.gate_result_id}});
  const task=buildWriterTask({safeContext:context,chapterRole:'qualification',chapterInstruction:'以授权的章节标签开头，仅陈述已获授权的产品注册资质事实，不扩展主体、产品范围、证书、有效期或状态。',bindings});
  return{source_truth:{classification:'REPRESENTATIVE_SYNTHETIC',not_real_customer_data:true,hash:sha(sourceText)},evidence_fact:evidenceFact,mapping,claim:bridge.claim,gate,project_fact:projectFact,binding,editable_fact:editableFact,editable_binding:editableBinding,facts,bindings,safe_context:context,writer_task:task};
}

export function writerTaskInventory(task,maxOutputTokens=1600){
  const outbound={writer_task_id:task.writer_task_id,chapter_id:task.chapter_id,chapter_role:task.chapter_role,chapter_instruction:task.chapter_instruction,context_items:task.context_items,assertable_claims:task.assertable_claims,required_bindings:task.required_bindings,optional_bindings:task.optional_bindings,pending_controls:task.pending_controls,forbidden_assertions:task.forbidden_assertions};
  const estimated_chars=JSON.stringify(outbound).length;
  const request=buildExternalWriterRequest(task,{model:'MODEL',maxOutputTokens}),provider_request_estimated_chars=JSON.stringify(request).length;
  return{writer_task_id:task.writer_task_id,chapter_id:task.chapter_id,chapter_role:task.chapter_role,context_items_count:task.context_items.length,assertable_claims_count:task.assertable_claims.length,required_bindings_count:task.required_bindings.length,optional_bindings_count:task.optional_bindings.length,pending_controls_count:task.pending_controls.length,forbidden_assertions_count:task.forbidden_assertions.length,estimated_chars,safe_context_estimated_tokens:Math.ceil(estimated_chars/4),provider_request_estimated_chars,provider_request_estimated_tokens:Math.ceil(provider_request_estimated_chars/2.5),estimated_input_tokens:Math.ceil(provider_request_estimated_chars/2.5),max_output_tokens:maxOutputTokens};
}
