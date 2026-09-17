import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';

export const EVIDENCE_REVIEW_CONTRACT_VERSION='evidence-review-v1';
export const SEMANTIC_RELEVANCE=Object.freeze(['relevant','weakly_relevant','irrelevant','unknown']);
export const EVIDENCE_CAPABILITY=Object.freeze(['capable','reference_only','not_capable','unknown']);
export const EVIDENCE_SUPPORT_LEVEL=Object.freeze(['full_support','partial_support','conflict','insufficient','reference_only','unknown']);
// ADR-020: support_sufficiency ownership remains under evaluation; do not
// derive it from support_level without an explicit parity decision.
export const REVIEW_DIMENSIONS=Object.freeze(['subject_match','scope_match','status_match','quantitative_match','entity_match','validity_match','source_authority','support_sufficiency']);
export const REVIEW_DIMENSION_VALUES=Object.freeze(['match','mismatch','unknown']);
export const EVIDENCE_REVIEW_REASON_CODES=Object.freeze(['SEMANTICALLY_IRRELEVANT','SOURCE_NOT_EVIDENCE_CAPABLE','REFERENCE_ONLY_SOURCE','SUBJECT_MISMATCH','SCOPE_MISMATCH','ENTITY_MISMATCH','STATUS_MISMATCH','STATUS_UNKNOWN','QUANTITATIVE_MISMATCH','QUANTITATIVE_UNKNOWN','VALIDITY_MISMATCH','VALIDITY_UNKNOWN','SOURCE_AUTHORITY_INSUFFICIENT','SUPPORT_PARTIAL','SUPPORT_INSUFFICIENT','HUMAN_REVIEW_REQUIRED']);
const sha=(value)=>createHash('sha256').update(String(value)).digest('hex');
const oneOf=(value,allowed,name)=>{if(!allowed.includes(value))throw new AppError('EVIDENCE_REVIEW_CONTRACT_INVALID',`${name} 枚举无效。`,422);return value;};
const unique=(values)=>[...new Set(values)];

export function createEvidenceReviewContract(context,assessment={},options={}){
  const contractVersion=options.contractVersion||EVIDENCE_REVIEW_CONTRACT_VERSION;
  const reviewerVersion=String(options.reviewerVersion||assessment.reviewer_version||'deterministic-boundary-v1');
  const dimensions=Object.fromEntries(REVIEW_DIMENSIONS.map((name)=>[name,oneOf(assessment.review_dimensions?.[name]||'unknown',REVIEW_DIMENSION_VALUES,`review_dimensions.${name}`)]));
  let relevance=oneOf(assessment.semantic_relevance||'unknown',SEMANTIC_RELEVANCE,'semantic_relevance');
  let capability=oneOf(assessment.evidence_capability||'unknown',EVIDENCE_CAPABILITY,'evidence_capability');
  let support=oneOf(assessment.support_level||'unknown',EVIDENCE_SUPPORT_LEVEL,'support_level');
  const reasons=unique((assessment.reason_codes||[]).map((code)=>oneOf(code,EVIDENCE_REVIEW_REASON_CODES,'reason_code')));
  const role=String(context.content_role||'unknown'),materialType=String(context.material_type||'other');
  if(relevance==='irrelevant'){capability='not_capable';support='insufficient';reasons.push('SEMANTICALLY_IRRELEVANT','SOURCE_NOT_EVIDENCE_CAPABLE','SUPPORT_INSUFFICIENT');}
  if(materialType==='historical_bid'){capability='reference_only';support='reference_only';reasons.push('REFERENCE_ONLY_SOURCE');}
  if(['marketing_claim','company_positioning'].includes(role)){capability='not_capable';support='insufficient';reasons.push('SOURCE_NOT_EVIDENCE_CAPABLE','SUPPORT_INSUFFICIENT');}
  if(capability==='reference_only'){support='reference_only';reasons.push('REFERENCE_ONLY_SOURCE');}
  if(capability==='not_capable'){support='insufficient';reasons.push('SOURCE_NOT_EVIDENCE_CAPABLE','SUPPORT_INSUFFICIENT');}
  if(dimensions.quantitative_match==='mismatch'){support='conflict';reasons.push('QUANTITATIVE_MISMATCH');}
  for(const [dimension,reason] of [['subject_match','SUBJECT_MISMATCH'],['scope_match','SCOPE_MISMATCH'],['entity_match','ENTITY_MISMATCH'],['status_match','STATUS_MISMATCH'],['validity_match','VALIDITY_MISMATCH']])if(dimensions[dimension]==='mismatch')reasons.push(reason);
  if(dimensions.status_match==='unknown'&&['project_case','award_record','contract_record','implementation_record','acceptance_record','qualification'].includes(role))reasons.push('STATUS_UNKNOWN');if(dimensions.quantitative_match==='unknown'&&role==='performance_test')reasons.push('QUANTITATIVE_UNKNOWN');if(dimensions.validity_match==='unknown'&&(role==='qualification'||materialType==='qualification'))reasons.push('VALIDITY_UNKNOWN');if(dimensions.source_authority==='mismatch')reasons.push('SOURCE_AUTHORITY_INSUFFICIENT');
  if(support==='partial_support')reasons.push('SUPPORT_PARTIAL');if(support==='insufficient')reasons.push('SUPPORT_INSUFFICIENT');
  const requiresHuman=assessment.requires_human_review!==false||support!=='full_support'||Object.values(dimensions).includes('unknown')||Object.values(dimensions).includes('mismatch');
  if(requiresHuman)reasons.push('HUMAN_REVIEW_REQUIRED');
  const status=requiresHuman?'needs_review':'proposed';
  const requirementHash=sha(context.requirement_text),sourceHash=context.source_text_hash;
  const reviewId=`EREVIEW-${sha([context.requirement_id,context.source_span_id,contractVersion,reviewerVersion,requirementHash,sourceHash].join('|')).slice(0,32).toUpperCase()}`;
  return{review_id:reviewId,project_id:context.project_id,requirement_id:context.requirement_db_id,retrieval_run_id:context.retrieval_run_id,retrieval_candidate_id:context.retrieval_candidate_id,source_span_id:context.source_span_id,requirement_text_hash:requirementHash,source_text_hash:sourceHash,semantic_relevance:relevance,evidence_capability:capability,support_level:support,review_dimensions:dimensions,reason_codes:unique(reasons),requires_human_review:requiresHuman,review_status:status,reviewer_type:'machine',reviewer_version:reviewerVersion,semantic_reviewer_version:assessment.semantic_reviewer_version||null,contract_version:contractVersion,supplemental_note:assessment.supplemental_note||null};
}

export class ProviderNeutralEvidenceReviewer {
  constructor({version='provider-neutral-stub-v1'}={}){this.version=version;}
  async review(){return{semantic_relevance:'unknown',evidence_capability:'unknown',support_level:'unknown',review_dimensions:Object.fromEntries(REVIEW_DIMENSIONS.map((name)=>[name,'unknown'])),reason_codes:['HUMAN_REVIEW_REQUIRED'],requires_human_review:true,semantic_reviewer_version:this.version};}
}
