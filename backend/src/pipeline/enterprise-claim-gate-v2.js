import { createClaimGateEvaluationContract } from './claim-gate-v2-contract.js';
import {evaluateEvidenceFacts} from './evidence-fact-claim-evaluator.js';
import {hasMaterialSourceRoleData, resolveMaterialSourceRole, materialAuthorityAllowedForMode, resolveMaterialAuthorityTier} from './material-source-authority-policy.js';

const reasonMessage=(code)=>({
  MAPPING_NOT_APPROVED:'Enterprise Claim 缺少当前 Requirement 的 approved Mapping。',
  EVIDENCE_NOT_APPROVED:'Enterprise Evidence 尚未批准。',
  SOURCE_LINEAGE_REQUIRED:'Enterprise Evidence 缺少可信 Material/Chunk 来源。',
  SOURCE_NOT_USABLE:'Enterprise Evidence 来源不可用于企业事实 Claim。',
  REFERENCE_ONLY:'reference_only Mapping 不能直接形成强企业事实 Claim。',
  EVIDENCE_EXPIRED:'Enterprise Evidence 已过期或撤销。',
  SUPPORT_INSUFFICIENT:'Mapping 支撑级别不足。',
  HUMAN_REVIEW_REQUIRED:'关键事实边界仍存在 unknown，必须人工复核。'
}[code]||'Enterprise Claim 未通过 Claim Gate v2。');
const dimensions=()=>({subject_match:'unknown',scope_match:'unknown',status_match:'unknown',quantitative_match:'unknown',entity_match:'unknown',validity_match:'unknown',support_sufficiency:'unknown',source_authority:'unknown'});
const check=(name,passed,actual)=>({check:name,passed,actual});
const text=(value)=>String(value||'').normalize('NFKC').toLowerCase();
const array=(value)=>Array.isArray(value)?value:[];
const flatten=(value)=>Array.isArray(value)?value.flatMap(flatten):value===null||value===undefined?[]:[String(value).trim()].filter(Boolean);
const entityKeys=['subject','company','product','product_model','model','certificate','project','entity','entities'];
const entities=(source={})=>entityKeys.flatMap((key)=>flatten(source?.[key]));
const statusPatterns={award:/\b(?:award(?:ed)?|selected|contracted)\b|中标|入选|签约/u,participated:/\bparticipat(?:ed|ing)\b|参与/u,in_progress:/\bin[ -]?progress\b|实施中|进行中/u,completed:/\bcomplet(?:ed|ion)\b|已完成|成功完成|完成建设|成功交付/u,accepted:/\baccept(?:ed|ance)\b|已验收|通过验收/u,verified:/\bverif(?:ied|ication)\b|已核验|已验证|验证通过/u};
const claimStatuses=(value)=>Object.entries(statusPatterns).filter(([,pattern])=>pattern.test(text(value))).map(([status])=>status);
const evidenceStatuses=(binding)=>{const metadata=binding?.metadata||{};const fromScope=array(binding?.evidence_scope).map((item)=>String(item).replace(/_fact$/,'')).filter((item)=>Object.hasOwn(statusPatterns,item));return[...new Set([...flatten(metadata.status),...flatten(metadata.fact_status),...fromScope].map((item)=>text(item).replace(/\s+/g,'_')))];};
const quantityPattern=/\d+(?:\.\d+)?\s*(?:%|％|ms|毫秒|秒|分钟|小时|天|日|个|项|套|台|人|并发|bps|kbps|mbps|gbps)/giu;
const quantities=(value)=>[...text(value).matchAll(quantityPattern)].map((match)=>match[0].replace(/\s+/g,'').replace('％','%'));
const structuredQuantities=(value)=>array(value).flatMap((item)=>item&&typeof item==='object'&&item.value!==undefined&&item.unit?quantities(`${item.value}${item.unit}`):quantities(item));
const broadScope=/\b(?:all|every|entire)\b|全部|所有|全系列|全线/u;
function evaluateBoundaries(claim,binding,result,checks,reasons){
  const claimText=text(claim?.text);const metadata=binding?.metadata||{};const scopes=array(binding?.evidence_scope).map(text);const claimStatus=claimStatuses(claimText);const evidenceStatus=evidenceStatuses(binding);
  if(claimStatus.length){const unsupported=claimStatus.filter((status)=>!evidenceStatus.includes(status));result.status_match=unsupported.length?'mismatch':'match';checks.push(check('status_boundary',!unsupported.length,{claim:claimStatus,evidence:evidenceStatus}));if(unsupported.length)reasons.push('STATUS_OVERCLAIM');}
  const claimQuantities=quantities(claimText);if(!claimQuantities.length)result.quantitative_match='not_applicable';else{const evidenceQuantities=new Set([...quantities(binding?.content),...quantities(binding?.source_text),...structuredQuantities(metadata.quantities)]);const unsupported=claimQuantities.filter((item)=>!evidenceQuantities.has(item));result.quantitative_match=unsupported.length?'mismatch':'match';checks.push(check('quantitative_boundary',!unsupported.length,{claim:claimQuantities,evidence:[...evidenceQuantities]}));if(unsupported.length)reasons.push('QUANTITATIVE_UNSUPPORTED');}
  const evidenceEntities=entities(metadata);const claimEntities=entities(claim?.metadata||claim?.structured_facts||{});const exactInText=evidenceEntities.some((item)=>text(item)&&claimText.includes(text(item)));const explicitMismatch=claimEntities.length>0&&!claimEntities.some((item)=>evidenceEntities.some((evidence)=>text(evidence)===text(item)));const broadEntity=broadScope.test(claimText)&&evidenceEntities.some(Boolean);
  if(evidenceEntities.length&&(claimEntities.length||exactInText||broadEntity)){result.entity_match=explicitMismatch||broadEntity?'mismatch':'match';checks.push(check('entity_boundary',result.entity_match==='match',{claim:claimEntities,evidence:evidenceEntities,broad:broadEntity}));if(result.entity_match==='mismatch')reasons.push('ENTITY_MISMATCH');}
  const claimMetadata=claim?.metadata||claim?.structured_facts||{};const claimScopes=[...flatten(claimMetadata.evidence_scope),...flatten(claimMetadata.scope),...flatten(claimMetadata.fact_scope)].map(text);const explicitScopeMismatch=claimScopes.length>0&&scopes.length>0&&!claimScopes.some((item)=>scopes.includes(item));const explicitScopeMatch=claimScopes.length>0&&claimScopes.every((item)=>scopes.includes(item));const statusScopeExceeded=scopes.includes('award_fact')&&claimStatus.some((status)=>['completed','accepted'].includes(status));const broadScopeExceeded=broadScope.test(claimText)&&evidenceEntities.some(Boolean);if(statusScopeExceeded||broadScopeExceeded||explicitScopeMismatch){result.scope_match='mismatch';checks.push(check('scope_boundary',false,{claim_scopes:claimScopes,scopes,status_scope_exceeded:statusScopeExceeded,broad_scope_exceeded:broadScopeExceeded}));reasons.push('EVIDENCE_SCOPE_EXCEEDED');}else if(explicitScopeMatch){result.scope_match='match';checks.push(check('scope_boundary',true,{claim_scopes:claimScopes,scopes}));}
}

export function evaluateEnterpriseClaimV2({projectId,claim,binding,evaluatedBy='deterministic_backend',authorityMode='PRODUCTION'}){
  const result=dimensions();const reasons=[];const checks=[];let decision='needs_review';
  const mapped=Boolean(binding?.mapping_id)&&binding?.project_id===projectId&&binding?.requirement_id===claim.requirement_id&&binding?.evidence_id===claim.basis_evidence_ids?.[0]&&binding?.mapping_status==='approved';
  checks.push(check('approved_mapping',mapped,binding?.mapping_status||null));if(!mapped)reasons.push('MAPPING_NOT_APPROVED');
  const approved=binding?.approval_status==='approved';checks.push(check('evidence_approved',approved,binding?.approval_status||null));if(mapped&&!approved)reasons.push('EVIDENCE_NOT_APPROVED');
  const lineage=binding?.source_lineage_verified===true;checks.push(check('source_lineage_verified',lineage,binding?.source_lineage_verified??null));if(mapped&&approved&&!lineage)reasons.push('SOURCE_LINEAGE_REQUIRED');
  const validity=String(binding?.validity_status||'unknown');result.validity_match=validity==='active'?'match':validity==='expired'||validity==='revoked'?'mismatch':'unknown';checks.push(check('evidence_validity',result.validity_match==='match',validity));if(mapped&&approved&&lineage&&result.validity_match==='mismatch')reasons.push('EVIDENCE_EXPIRED');
  const historical=binding?.material_type==='historical_bid';const roleAware=hasMaterialSourceRoleData(binding||{});const sourceRole=resolveMaterialSourceRole(binding||{});const authorityTier=resolveMaterialAuthorityTier(binding||{});const authorityAllowed=materialAuthorityAllowedForMode(binding||{},{authorityMode});const usable=binding?.usable_for_claims===true&&!historical&&authorityAllowed&&(!roleAware||sourceRole.role==='EVIDENCE_CANDIDATE');
  if(historical||binding?.usable_for_claims===false||sourceRole.role==='REFERENCE_ONLY')result.source_authority='unusable';else if(binding?.support_level==='reference_only')result.source_authority='reference_only';else if(usable)result.source_authority='usable';
  checks.push(check('source_usable',usable,{usable_for_claims:binding?.usable_for_claims??null,source_role:sourceRole.role,authority:authorityTier.authority,production_authority:authorityTier.production_authority,authority_mode:authorityMode,policy_version:sourceRole.policy_version}));if(mapped&&approved&&lineage&&result.validity_match!=='mismatch'&&!authorityAllowed)reasons.push('SOURCE_NOT_USABLE');if(mapped&&approved&&lineage&&result.validity_match!=='mismatch'&&(historical||binding?.usable_for_claims===false||sourceRole.role==='REFERENCE_ONLY'))reasons.push('SOURCE_NOT_USABLE');
  if(binding?.support_level==='full_support')result.support_sufficiency='sufficient';else if(binding?.support_level==='partial_support')result.support_sufficiency='partial';else if(binding?.support_level==='reference_only')result.support_sufficiency='insufficient';
  checks.push(check('support_level_recorded',['full_support','partial_support','reference_only'].includes(binding?.support_level),binding?.support_level||null));if(mapped&&binding?.support_level==='reference_only')reasons.push('REFERENCE_ONLY');else if(mapped&&!['full_support','partial_support'].includes(binding?.support_level))reasons.push('SUPPORT_INSUFFICIENT');
  let factIds=[];let factConflict=false;if(mapped&&approved&&lineage&&usable){const factEvaluation=evaluateEvidenceFacts({claim,binding,facts:binding?.evidence_facts});factIds=factEvaluation.fact_ids;factConflict=factEvaluation.conflict;checks.push(...factEvaluation.checks);reasons.push(...factEvaluation.reasons);if(factIds.length)Object.assign(result,factEvaluation.dimensions);else evaluateBoundaries(claim,binding,result,checks,reasons);}
  if(reasons.some((code)=>['MAPPING_NOT_APPROVED','EVIDENCE_NOT_APPROVED','SOURCE_LINEAGE_REQUIRED','SOURCE_NOT_USABLE','EVIDENCE_EXPIRED','SUPPORT_INSUFFICIENT','STATUS_OVERCLAIM','QUANTITATIVE_UNSUPPORTED','ENTITY_MISMATCH','EVIDENCE_SCOPE_EXCEEDED'].includes(code)))decision='reject';else if(reasons.includes('REFERENCE_ONLY'))decision='restrict';else{decision='needs_review';reasons.push('HUMAN_REVIEW_REQUIRED');}
  const relevant=['subject_match','scope_match','status_match','entity_match','validity_match'];const factsAllow=factIds.length>0&&!factConflict&&result.support_sufficiency==='sufficient'&&result.source_authority==='usable'&&relevant.every((key)=>result[key]==='match')&&['match','not_applicable'].includes(result.quantitative_match);if(decision==='needs_review'&&factsAllow){decision='allow';const index=reasons.indexOf('HUMAN_REVIEW_REQUIRED');if(index>=0)reasons.splice(index,1);}
  const factDimensions=Object.fromEntries(['subject_match','entity_match','status_match','scope_match','quantitative_match','validity_match'].map((key)=>[key,result[key]]));const evaluation=createClaimGateEvaluationContract({decision,reason_codes:[...new Set(reasons)],dimensions:result,allowed_scope:binding?.evidence_scope||[],required_conditions:[],evidence_ids:binding?.evidence_id?[binding.evidence_id]:[],mapping_ids:binding?.mapping_id?[binding.mapping_id]:[],deterministic_checks:[...checks,{check:'evidence_fact_ids_used',passed:factIds.length>0,actual:{fact_ids:factIds}},{check:'evidence_fact_dimension_summary',passed:!factConflict,actual:{fact_ids:factIds,dimensions:factDimensions}}],semantic_assessment:null,semantic_assessment_used:false,human_review_required:decision==='needs_review',evaluated_by:evaluatedBy});
  return{...evaluation,reason_message:reasonMessage(evaluation.reason_codes[0])};
}

export function applyEnterpriseEvaluationToLegacyDecision(item,evaluation){
  if(evaluation.writer_eligible)return{...item,v2_evaluation:evaluation};
  return{...item,decision:{...item.decision,decision:'rejected',reason_code:evaluation.reason_codes[0]||'HUMAN_REVIEW_REQUIRED',reason_message:evaluation.reason_message,rule_version:evaluation.rule_version,decided_at:new Date().toISOString()},v2_evaluation:evaluation};
}
