import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';

export const WRITER_INPUT_AUTHORIZATION_VERSION='writer-input-authorization-v1';
export const WRITER_SAFE_CONTEXT_VERSION='writer-safe-context-v1';
export const FACT_MENTION_LEDGER_VERSION='fact-mention-ledger-v1';
export const AUTHORIZATION_MODES=['context_only','claim_required','assertable','blocked'];
export const MENTION_ROLES=['context_reference','claim_expression','constraint_expression','pending_reference'];

const stable=(value)=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])])):value;
export const authorizationHash=(value)=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const approved=(fact)=>fact?.review_status==='approved'&&fact.conflict_status!=='conflict';
const claimFactIds=(claim)=>new Set([...(claim.referenced_fact_ids||[]),...(claim.basis_fact_ids||[])]);
const projectFactSourceIds=(fact)=>new Set([fact.project_fact_id,...(fact.provenance_refs||[]).filter((x)=>x.source_type==='evidence_fact').map((x)=>x.source_id)]);
const referencesFact=(claim,fact)=>{if((fact.provenance_refs||[]).some((ref)=>ref.source_type==='approved_claim'&&ref.source_id===claim.claim_id))return true;const ids=claimFactIds(claim);return [...projectFactSourceIds(fact)].some((id)=>ids.has(id));};

export function isCurrentAllowClaim(claim,gate,{revalidationRequired=[]}={}){
  if(!claim||!gate||revalidationRequired.includes(claim.claim_id))return false;
  return (claim.decision===undefined||claim.decision==='approved')&&claim.current!==false&&gate.current!==false&&gate.decision==='allow'&&gate.writer_eligible===true&&gate.lineage_current===true&&
    Boolean(claim.assertion_hash)&&gate.claim_assertion_hash===claim.assertion_hash&&Boolean(gate.gate_result_id)&&Boolean(gate.input_snapshot_hash);
}

export function authorizeProjectFact(fact,{claims=[],gateResults=[],revalidationRequired=[]}={}){
  if(!approved(fact))return{authorization_mode:'blocked',reason_code:'PROJECT_FACT_NOT_CURRENT_APPROVED'};
  const matches=claims.filter((claim)=>referencesFact(claim,fact));
  const allow=matches.find((claim)=>isCurrentAllowClaim(claim,gateResults.find((gate)=>gate.claim_id===claim.claim_id),{revalidationRequired}));
  if(fact.value_status==='pending')return{authorization_mode:'context_only',reason_code:'PENDING_NOT_ASSERTABLE',allow_claim:null};
  if(fact.fact_role==='requirement_constraint'||fact.fact_role==='project_decision'||fact.fact_role==='assignment')return{authorization_mode:'context_only',reason_code:'CONTEXT_AUTHORIZED',allow_claim:null};
  if(fact.fact_role==='enterprise_fact')return{authorization_mode:allow?'assertable':'claim_required',reason_code:allow?'CURRENT_ALLOW_CLAIM':'NOT_ASSERTABLE',allow_claim:allow||null};
  if(fact.fact_role==='response_commitment')return{authorization_mode:allow?'assertable':'blocked',reason_code:allow?'CURRENT_ALLOW_CLAIM':'RESPONSE_COMMITMENT_NOT_AUTHORIZED',allow_claim:allow||null};
  return{authorization_mode:'context_only',reason_code:'CONSERVATIVE_CONTEXT_ONLY',allow_claim:null};
}

export function createFactMention(input){
  if(!MENTION_ROLES.includes(input.mention_role))throw new AppError('FACT_MENTION_ROLE_INVALID','Fact Mention role 无效。',422);
  if(input.document_anchor&&('start_offset'in input.document_anchor||'end_offset'in input.document_anchor))throw new AppError('FACT_MENTION_OFFSET_FORBIDDEN','正文尚未生成，不能伪造 offset。',422);
  if(input.mention_role==='claim_expression'&&(!input.claim_id||!input.gate_result_id))throw new AppError('FACT_MENTION_CLAIM_LINEAGE_REQUIRED','正式 Claim Mention 必须关联 Claim 与 Gate Result。',422);
  const body={project_id:input.project_id,chapter_id:input.chapter_id,writer_task_id:input.writer_task_id||null,project_fact_id:input.project_fact_id||null,project_fact_version:input.project_fact_version||null,claim_id:input.claim_id||null,gate_result_id:input.gate_result_id||null,mention_role:input.mention_role,source_context_hash:input.source_context_hash,document_anchor:input.document_anchor||null,status:input.status||'expected',contract_version:FACT_MENTION_LEDGER_VERSION};
  return{...body,mention_id:`FM-${authorizationHash(body).slice(0,32).toUpperCase()}`};
}

const claimText=(claim)=>String(claim?.claim_text??claim?.text??'');
const listValues=(value)=>Array.isArray(value)?value.map((item)=>String(item||'').trim()).filter(Boolean):[];
const projectAssertableClaim=(claim,gate)=>{
  const assertionHash=claim.assertion_hash??claim.claim_assertion_hash??gate.claim_assertion_hash;
  const gateScope=listValues(gate.allowed_scope), claimScope=listValues(claim.allowed_scope);
  const gateConditions=listValues(gate.required_conditions), claimConditions=listValues(claim.required_conditions);
  const gateLimitations=listValues(gate.limitations), claimLimitations=listValues(claim.limitations);
  const gateSourceHashes=listValues(gate.source_hashes), claimSourceHashes=listValues(claim.source_hashes);
  return{
    claim_id:claim.claim_id,
    claim_assertion_identity:assertionHash,
    claim_assertion_hash:assertionHash,
    gate_result_id:gate.gate_result_id,
    decision:gate.decision,
    writer_eligible:gate.writer_eligible,
    claim_text:claimText(claim),
    text:claimText(claim),
    claim_type:claim.claim_type??null,
    requested_commitment:claim.requested_commitment??null,
    allowed_scope:gateScope.length?gateScope:claimScope,
    required_conditions:gateConditions.length?gateConditions:claimConditions,
    limitations:claimLimitations.length?claimLimitations:gateLimitations,
    referenced_fact_ids:[...(claim.referenced_fact_ids||claim.basis_fact_ids||[])].sort(),
    referenced_mapping_ids:[...(claim.referenced_mapping_ids||[])].sort(),
    structured_assertion:claim.structured_assertion||claim.assertions||[],
    source_hashes:(gateSourceHashes.length?gateSourceHashes:claimSourceHashes).sort(),
    input_snapshot_hash:gate.input_snapshot_hash??claim.input_snapshot_hash??null,
    lineage_current:gate.lineage_current===true
  };
};

export function createWriterSafeContext({projectId,chapterId,writerTaskId=null,facts=[],bindings=[],claims=[],gateResults=[],revalidationRequired=[],futureAnchorId=null,versions={}}){
  const chapterFactIds=new Set(bindings.filter((binding)=>binding.binding_status==='active'&&binding.target_type==='chapter'&&binding.target_id===chapterId).map((binding)=>binding.project_fact_id));
  const bindingByFact=new Map(bindings.filter((binding)=>chapterFactIds.has(binding.project_fact_id)).map((binding)=>[binding.project_fact_id,binding]));
  const context_items=[],blocked_items=[],pending_items=[],assertableMap=new Map();
  for(const claim of claims){
    const gate=gateResults.find((item)=>item.claim_id===claim.claim_id);
    if(gate&&isCurrentAllowClaim(claim,gate,{revalidationRequired}))assertableMap.set(claim.claim_id,projectAssertableClaim(claim,gate));
  }
  for(const fact of [...facts].sort((a,b)=>a.project_fact_id.localeCompare(b.project_fact_id))){
    if(!chapterFactIds.has(fact.project_fact_id))continue;
    const authorization=authorizeProjectFact(fact,{claims,gateResults,revalidationRequired}),binding=bindingByFact.get(fact.project_fact_id);
    const item={project_fact_id:fact.project_fact_id,version:fact.version,key:fact.key,role:fact.fact_role,value_status:fact.value_status,value:fact.value_status==='pending'?null:fact.value,authorization_mode:authorization.authorization_mode,authorization_reason:authorization.reason_code,binding_role:binding.binding_role,source_hash:fact.payload_hash};
    if(authorization.authorization_mode==='blocked'||authorization.authorization_mode==='claim_required'){blocked_items.push(item);continue;}
    context_items.push(item);
    if(fact.value_status==='pending')pending_items.push(item);
    if(authorization.allow_claim){const claim=authorization.allow_claim,gate=gateResults.find((x)=>x.claim_id===claim.claim_id);if(gate&&isCurrentAllowClaim(claim,gate,{revalidationRequired}))assertableMap.set(claim.claim_id,projectAssertableClaim(claim,gate));}
  }
  const assertable_claims=[...assertableMap.values()].filter((claim)=>{const source=claims.find((x)=>x.claim_id===claim.claim_id);return !Array.isArray(source?.target_sections)||source.target_sections.includes(chapterId);}).sort((a,b)=>a.claim_id.localeCompare(b.claim_id));
  const body={project_id:projectId,chapter_id:chapterId,writer_task_id:writerTaskId,context_items,assertable_claims,blocked_items,pending_items,project_fact_context_hash:versions.projectFactContextHash||'current',propagation_binding_version:versions.propagationBindingVersion||'current',chapter_plan_version:versions.chapterPlanVersion||'current',claim_gate_identity:versions.claimGateIdentity||'current',authorization_contract_version:WRITER_INPUT_AUTHORIZATION_VERSION,contract_version:WRITER_SAFE_CONTEXT_VERSION};
  const authorization_snapshot_hash=authorizationHash(body);
  const mentions=[];
  for(const item of context_items)mentions.push(createFactMention({project_id:projectId,chapter_id:chapterId,writer_task_id:writerTaskId,project_fact_id:item.project_fact_id,project_fact_version:item.version,mention_role:item.value_status==='pending'?'pending_reference':item.role==='requirement_constraint'?'constraint_expression':'context_reference',source_context_hash:authorization_snapshot_hash,document_anchor:futureAnchorId?{future_anchor_id:futureAnchorId}:null}));
  for(const claim of assertable_claims)mentions.push(createFactMention({project_id:projectId,chapter_id:chapterId,writer_task_id:writerTaskId,claim_id:claim.claim_id,gate_result_id:claim.gate_result_id,mention_role:'claim_expression',source_context_hash:authorization_snapshot_hash,document_anchor:futureAnchorId?{future_anchor_id:futureAnchorId}:null}));
  return{...body,authorization_snapshot_hash,future_mentions:mentions};
}

export function deterministicWriterInputFixture(context){return{context_keys:context.context_items.map((x)=>x.key),assertable_claim_ids:context.assertable_claims.map((x)=>x.claim_id),pending_keys:context.pending_items.map((x)=>x.key)};}
