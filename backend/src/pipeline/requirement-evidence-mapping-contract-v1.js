import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
export const REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION='requirement-evidence-mapping-v1.1';
export const MAPPING_RELATIONSHIPS=['direct','partial','related','conflict','unrelated','unknown'];
export const MAPPING_SUPPORT_LEVELS=['full_support','partial_support','conflict','insufficient','reference_only','unknown'];
export const MAPPING_DIMENSIONS=['subject_match','scope_match','status_match','quantitative_match','entity_match','validity_match','support_sufficiency'];
export const MAPPING_DIMENSION_VALUES=['match','mismatch','unknown','not_applicable'];
export const MAPPING_REASON_CODES=['FACT_NOT_APPROVED','REQUIREMENT_INVALID','SUBJECT_MISMATCH','SCOPE_MISMATCH','STATUS_MISMATCH','STATUS_UNKNOWN','QUANTITATIVE_MISMATCH','QUANTITATIVE_UNKNOWN','ENTITY_MISMATCH','VALIDITY_MISMATCH','VALIDITY_UNKNOWN','SUPPORT_PARTIAL','SUPPORT_INSUFFICIENT','REFERENCE_ONLY','RELATIONSHIP_UNKNOWN','HUMAN_REVIEW_REQUIRED'];
const sha=(value)=>createHash('sha256').update(String(value)).digest('hex');
export function createRequirementEvidenceMapping(context,candidate,{contractVersion=REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION,evaluatorVersion='provider-neutral-mapping-stub-v1',reviewerType='machine'}={}){
  if(context.fact_review_status!=='approved')throw new AppError('FACT_NOT_APPROVED','只有 approved Evidence Fact 才能建立正式 Mapping Candidate。',409);
  if(!context.requirement_valid)throw new AppError('REQUIREMENT_INVALID','Requirement 不是当前有效 Canonical Requirement。',409);
  const semanticRelationship=String(candidate.semantic_relationship||'unknown');if(!MAPPING_RELATIONSHIPS.includes(semanticRelationship))throw new AppError('MAPPING_RELATIONSHIP_INVALID','semantic_relationship 非法。',422);
  const supportLevel=String(candidate.support_level||'unknown');if(!MAPPING_SUPPORT_LEVELS.includes(supportLevel))throw new AppError('MAPPING_SUPPORT_INVALID','support_level 非法。',422);
  const dimensions={};for(const name of MAPPING_DIMENSIONS){const value=candidate.dimensions?.[name]||'unknown';if(!MAPPING_DIMENSION_VALUES.includes(value))throw new AppError('MAPPING_DIMENSION_INVALID',`${name} 非法。`,422);dimensions[name]=value;}
  if(dimensions.quantitative_match==='mismatch'&&supportLevel!=='conflict')throw new AppError('MAPPING_CONFLICT_REQUIRED','明确数量冲突必须保留为 conflict。',422);
  if((dimensions.scope_match==='mismatch'||dimensions.validity_match==='unknown'||dimensions.status_match==='unknown')&&supportLevel==='full_support')throw new AppError('MAPPING_FULL_SUPPORT_UNSAFE','范围不完整或关键维度 unknown 时不得 full_support。',422);
  const reasonCodes=[...new Set(candidate.reason_codes||[])];if(reasonCodes.some((code)=>!MAPPING_REASON_CODES.includes(code)))throw new AppError('MAPPING_REASON_CODE_INVALID','reason_codes 包含非受控值。',422);
  const sourceType=String(candidate.source_type||'system_proposed');if(!['manual','retrieval','system_proposed'].includes(sourceType))throw new AppError('MAPPING_SOURCE_INVALID','Mapping source 非法。',422);
  const mappingId=`EMAP-${sha([context.project_id,context.requirement_id,context.requirement_hash,context.requirement_contract_version,context.fact_id,context.fact_payload_hash,context.fact_contract_version,contractVersion,evaluatorVersion].join('|')).slice(0,32).toUpperCase()}`;
  return{mapping_id:mappingId,project_id:context.project_id,requirement_db_id:context.requirement_db_id,requirement_id:context.requirement_id,evidence_fact_id:context.fact_id,source_type:sourceType,source:{evidence_review_id:context.evidence_review_id,source_span_id:context.source_span_id,material_id:context.material_id},semantic_relationship:semanticRelationship,support_level:supportLevel,dimensions,reason_codes:reasonCodes,review_status:'proposed',reviewer_type:reviewerType,evaluator_version:evaluatorVersion,contract_version:contractVersion,requirement_hash:context.requirement_hash,requirement_contract_version:context.requirement_contract_version,fact_payload_hash:context.fact_payload_hash,fact_contract_version:context.fact_contract_version};
}
export class ProviderNeutralMappingEvaluator {constructor(){this.version='provider-neutral-mapping-stub-v1';}async evaluate(){return null;}}
