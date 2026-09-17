import { AppError } from '../errors.js';

export const CLAIM_GATE_V2_RULE_VERSION = '4.3-claim-gate-v2-contract-1';
export const CLAIM_GATE_V2_DECISIONS = Object.freeze(['allow','restrict','reject','needs_review']);
export const CLAIM_GATE_V2_REASON_CODES = Object.freeze([
  'EVIDENCE_NOT_APPROVED','MAPPING_NOT_APPROVED','SOURCE_NOT_USABLE','SOURCE_LINEAGE_REQUIRED',
  'REFERENCE_ONLY','EVIDENCE_SCOPE_EXCEEDED','QUANTITATIVE_UNSUPPORTED','ENTITY_MISMATCH',
  'STATUS_OVERCLAIM','EVIDENCE_EXPIRED','SUPPORT_INSUFFICIENT','HUMAN_REVIEW_REQUIRED'
]);
export const CLAIM_GATE_V2_DIMENSIONS = Object.freeze({
  subject_match:Object.freeze(['match','mismatch','unknown']),
  scope_match:Object.freeze(['match','partial','mismatch','unknown']),
  status_match:Object.freeze(['match','mismatch','unknown']),
  quantitative_match:Object.freeze(['match','mismatch','not_applicable','unknown']),
  entity_match:Object.freeze(['match','mismatch','unknown']),
  validity_match:Object.freeze(['match','mismatch','unknown']),
  support_sufficiency:Object.freeze(['sufficient','partial','insufficient','unknown']),
  source_authority:Object.freeze(['usable','reference_only','unusable','unknown'])
});

const DECISIONS=new Set(CLAIM_GATE_V2_DECISIONS);
const REASONS=new Set(CLAIM_GATE_V2_REASON_CODES);
const object=(value)=>value&&typeof value==='object'&&!Array.isArray(value);
const optionalHash=(value,name)=>{if(value===null||value===undefined||value==='')return null;const normalized=String(value).trim();if(!/^[a-f0-9]{64}$/i.test(normalized))throw new AppError('CLAIM_GATE_V2_IDENTITY_INVALID',`${name} 必须是 SHA-256。`,422);return normalized.toLowerCase();};
const identityFields=(input)=>({claim_assertion_hash:optionalHash(input.claim_assertion_hash,'claim_assertion_hash'),gate_result_id:input.gate_result_id?String(input.gate_result_id).trim():null,input_snapshot_hash:optionalHash(input.input_snapshot_hash,'input_snapshot_hash'),source_hashes:strings(input.source_hashes??[],'source_hashes').map((value)=>optionalHash(value,'source_hashes')),lineage_current:input.lineage_current===true});
const strings=(value,name)=>{
  if(!Array.isArray(value))throw new AppError('CLAIM_GATE_V2_CONTRACT_INVALID',`${name} 必须是数组。`,422);
  return [...new Set(value.map((item)=>String(item||'').trim()).filter(Boolean))];
};

export function projectLegacyClaimDecision(decision){
  if(decision==='allow')return'approved';
  if(decision==='reject')return'rejected';
  if(decision==='restrict'||decision==='needs_review')return null;
  throw new AppError('CLAIM_GATE_V2_DECISION_INVALID','Claim Gate v2 decision 无效。',422);
}

export function validateClaimGateDimensions(input){
  if(!object(input))throw new AppError('CLAIM_GATE_V2_DIMENSIONS_INVALID','dimensions 必须是对象。',422);
  const expected=Object.keys(CLAIM_GATE_V2_DIMENSIONS);
  const actual=Object.keys(input);
  const missing=expected.filter((key)=>!Object.hasOwn(input,key));
  const extra=actual.filter((key)=>!Object.hasOwn(CLAIM_GATE_V2_DIMENSIONS,key));
  if(missing.length||extra.length)throw new AppError('CLAIM_GATE_V2_DIMENSIONS_INVALID',`dimensions 字段不完整：missing=${missing.join(',')||'-'} extra=${extra.join(',')||'-'}`,422);
  const result={};
  for(const key of expected){const value=String(input[key]||'');if(!CLAIM_GATE_V2_DIMENSIONS[key].includes(value))throw new AppError('CLAIM_GATE_V2_DIMENSION_VALUE_INVALID',`${key} 的值无效。`,422);result[key]=value;}
  return result;
}

export function createClaimGateEvaluationContract(input={}){
  const decision=String(input.decision||'');
  if(!DECISIONS.has(decision))throw new AppError('CLAIM_GATE_V2_DECISION_INVALID','Claim Gate v2 decision 无效。',422);
  const reasonCodes=strings(input.reason_codes??[],'reason_codes');
  const invalidReasons=reasonCodes.filter((code)=>!REASONS.has(code));
  if(invalidReasons.length)throw new AppError('CLAIM_GATE_V2_REASON_CODE_INVALID',`未知 Core reason code：${invalidReasons.join('、')}`,422);
  const deterministicChecks=input.deterministic_checks??[];
  if(!Array.isArray(deterministicChecks))throw new AppError('CLAIM_GATE_V2_CONTRACT_INVALID','deterministic_checks 必须是数组。',422);
  const semantic=input.semantic_assessment??null;
  if(semantic!==null&&!object(semantic))throw new AppError('CLAIM_GATE_V2_CONTRACT_INVALID','semantic_assessment 必须是对象或 null。',422);
  const semanticUsed=input.semantic_assessment_used===true;
  if(semanticUsed&&semantic===null)throw new AppError('CLAIM_GATE_V2_CONTRACT_INVALID','semantic_assessment_used=true 时必须保存 semantic_assessment。',422);
  const humanReviewRequired=input.human_review_required===true;
  if(decision==='needs_review'&&!humanReviewRequired)throw new AppError('CLAIM_GATE_V2_HUMAN_REVIEW_REQUIRED','needs_review 必须设置 human_review_required=true。',422);
  const evaluatedBy=String(input.evaluated_by||'').trim();
  if(!evaluatedBy)throw new AppError('CLAIM_GATE_V2_EVALUATOR_REQUIRED','evaluated_by 不能为空。',422);
  return{
    decision,reason_codes:reasonCodes,dimensions:validateClaimGateDimensions(input.dimensions),
    allowed_scope:strings(input.allowed_scope??[],'allowed_scope'),required_conditions:strings(input.required_conditions??[],'required_conditions'),
    evidence_ids:strings(input.evidence_ids??[],'evidence_ids'),mapping_ids:strings(input.mapping_ids??[],'mapping_ids'),
    rule_version:String(input.rule_version||CLAIM_GATE_V2_RULE_VERSION).trim(),deterministic_checks:structuredClone(deterministicChecks),
    semantic_assessment:semantic===null?null:structuredClone(semantic),semantic_assessment_used:semanticUsed,
    human_review_required:humanReviewRequired,writer_eligible:decision==='allow',legacy_decision_projection:projectLegacyClaimDecision(decision),evaluated_by:evaluatedBy,
    ...identityFields(input)
  };
}
