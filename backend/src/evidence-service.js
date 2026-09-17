import { createHash } from 'node:crypto';
import { AppError } from './errors.js';
import { createEvidenceIdentifier } from './company-material-service.js';
import { EvidenceSourceContextResolver } from './pipeline/evidence-source-context-resolver.js';
import { PRE_REVIEW_STAGING_ROLE, assertFormalEvidenceEligible, isPreReviewStagingEvidence } from './evidence-lifecycle.js';
import {
  hasMaterialSourceRoleData,
  isEvidenceSourceEligible,
  resolveMaterialSourceRole,
  materialAuthorityAllowedForMode
} from './pipeline/material-source-authority-policy.js';

function materialAuthorityAllows(material) {
  // Current repository rows carry the complete lifecycle/provenance
  // projection. Older injected repositories may intentionally expose only
  // the pre-authority shape; keep that compatibility surface while the SQL
  // authority predicate remains fail-closed for production rows.
  const hasAuthorityProjection = material && [
    'id', 'corpus_scope', 'lifecycle_status', 'review_status',
    'usage_status', 'extraction_status'
  ].every(field => material[field] != null);
  return !hasAuthorityProjection || isEvidenceSourceEligible(material);
}

function materialRoleAllowsEvidence(material) {
  return !hasMaterialSourceRoleData(material)
    || resolveMaterialSourceRole(material).role === 'EVIDENCE_CANDIDATE';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value, code, message) { if (!UUID_PATTERN.test(String(value || ''))) throw new AppError(code, message, 400); }
function text(value, name) { const result=String(value || '').trim(); if(!result) throw new AppError('EVIDENCE_VALIDATION_FAILED', `${name}不能为空。`, 422); return result; }
function ids(values) { return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))]; }
const VALIDITY=new Set(['active','expired','revoked','unknown']);
const MAPPING_SOURCES=new Set(['manual','retrieval']);
const MAPPING_DECISIONS=new Set(['approved','rejected']);
const SUPPORT_LEVELS=new Set(['full_support','partial_support','reference_only']);
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function metadata(value){const input=object(value);const result=Object.fromEntries(['issuer','valid_from','valid_until','customer','product','version'].filter((key)=>input[key]!=null&&String(input[key]).trim()).map((key)=>[key,String(input[key]).trim()]));for(const key of ['valid_from','valid_until'])if(result[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(result[key]))throw new AppError('EVIDENCE_METADATA_INVALID',`${key} 必须是 YYYY-MM-DD。`,422);return result;}

export class EvidenceService {
  constructor({ repository, contextResolver=new EvidenceSourceContextResolver(), evidenceReviewService=null, requireReviewTransition=false, authorityMode='PRODUCTION' }) { this.repository = repository;this.contextResolver=contextResolver;this.evidenceReviewService=evidenceReviewService;this.requireReviewTransition=requireReviewTransition;this.authorityMode=authorityMode; }

  async list(projectId) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    if (!await this.repository.getProject(projectId)) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    const catalog = await this.repository.listEvidenceCatalog(projectId);
    return { ...catalog, evidences:(catalog.evidences || []).map((evidence) => isPreReviewStagingEvidence(evidence) ? { ...evidence, usable_for_claims:false } : evidence) };
  }

  async create(projectId, input = {}, {trustedSpan=false, lifecycleRole=null}={}) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    assertUuid(input.material_id, 'INVALID_MATERIAL_ID', '企业材料 ID 格式无效。');
    const material = await this.repository.getCompanyMaterial(input.material_id);
    if (!material || material.project_id !== projectId) throw new AppError('MATERIAL_NOT_FOUND', '企业材料不存在或不属于当前项目。', 404);
    if (material.extraction_status !== 'succeeded') throw new AppError('MATERIAL_NOT_READY', '企业材料尚未成功提取文本。', 409);
    if (!materialAuthorityAllows(material)) throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', '该企业材料当前已被隔离，不能形成新的 Evidence。', 409);
    if (!materialAuthorityAllowedForMode(material, { authorityMode: this.authorityMode })) throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE', 'Synthetic 材料仅可在隔离 Eval authority 中形成 Evidence。', 422);
    if (!materialRoleAllowsEvidence(material)) throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN', '参考资料不能进入正式 Enterprise Evidence authority。', 422);
    if(Object.hasOwn(input,'resolved_source_span')&&!trustedSpan)throw new AppError('EVIDENCE_SOURCE_LINEAGE_FORBIDDEN','Evidence Source Span 只能由后端 Context Resolver 生成。',422);
    let chunk=null;let resolvedSpan=trustedSpan?input.resolved_source_span||null:null;
    if(input.source_chunk_id){
      chunk=await this.repository.getMaterialChunk(String(input.source_chunk_id));
      if(!chunk||chunk.material_id!==material.id) throw new AppError('EVIDENCE_SOURCE_CHUNK_INVALID', 'Material Chunk 不存在或不属于指定材料。', 422);
      if(material.extracted_text.slice(chunk.char_start,chunk.char_end)!==chunk.source_text) throw new AppError('EVIDENCE_SOURCE_LINEAGE_INVALID', 'Material Chunk 无法回溯到材料原文。', 409);
      if(!resolvedSpan&&input.source_text!=null&&String(input.source_text)!==chunk.source_text)throw new AppError('EVIDENCE_SOURCE_LINEAGE_INVALID','Evidence source_text 与 Material Chunk 原文不一致。',422);
    }
    if(!chunk&&input.source_text!=null&&String(input.source_text).trim())throw new AppError('EVIDENCE_SOURCE_CHUNK_REQUIRED','Enterprise Evidence 的来源原文必须由真实 Material Chunk 提供。',422);
    const requirementIds = ids(input.applicable_requirement_ids);
    const invalidIds = await this.repository.findInvalidConfirmedRequirementIds(projectId, requirementIds);
    if (invalidIds.length) throw new AppError('EVIDENCE_REQUIREMENT_INVALID', `Evidence 关联了未确认 Requirement：${invalidIds.join('、')}`, 422);
    const content = text(input.content, 'Evidence 内容');
    if(resolvedSpan){const location=object(resolvedSpan.source_location);const start=location.char_start;const end=location.char_end;if(location.anchor_chunk_id!==chunk?.chunk_id||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||chunk.char_start<start||chunk.char_end>end||material.extracted_text.slice(start,end)!==resolvedSpan.source_text||createHash('sha256').update(resolvedSpan.source_text).digest('hex')!==resolvedSpan.source_hash)throw new AppError('EVIDENCE_SOURCE_LINEAGE_INVALID','Evidence Source Span 无法回溯到材料原文。',422);}
    const sourceText = resolvedSpan?.source_text??chunk?.source_text ?? (input.source_text == null || String(input.source_text).trim() === '' ? null : String(input.source_text).trim());
    const sourceLocation=resolvedSpan?.source_location??(chunk?{char_start:chunk.char_start,char_end:chunk.char_end,page_start:chunk.page_start,page_end:chunk.page_end,paragraph_start:chunk.paragraph_start,paragraph_end:chunk.paragraph_end,section:chunk.section,anchor_chunk_id:chunk.chunk_id,chunk_start_index:chunk.chunk_index,chunk_end_index:chunk.chunk_index,resolution_method:'anchor_only',resolver_version:'evidence-source-span-v1'}:{});
    const sourcePage = sourceLocation.page_start ?? (input.source_page == null || input.source_page === '' ? null : Number(input.source_page));
    const sourceParagraph = sourceLocation.paragraph_start ?? (input.source_paragraph == null || input.source_paragraph === '' ? null : Number(input.source_paragraph));
    if (sourcePage !== null && (!Number.isInteger(sourcePage) || sourcePage < 1)) throw new AppError('EVIDENCE_SOURCE_INVALID', '来源页码必须为正整数。', 422);
    if (sourceParagraph !== null && (!Number.isInteger(sourceParagraph) || sourceParagraph < 1)) throw new AppError('EVIDENCE_SOURCE_INVALID', '来源段落必须为正整数。', 422);
    if (!sourceText && (sourcePage !== null || sourceParagraph !== null)) throw new AppError('EVIDENCE_SOURCE_INVALID', '没有来源原文时，来源页码和段落必须留空。', 422);
    const validityStatus='unknown';
    if(input.validity_status!=null&&String(input.validity_status)!=='unknown')throw new AppError('EVIDENCE_VALIDITY_REVIEW_REQUIRED','Evidence 有效性必须通过独立审核接口设置。',422);
    const normalizedMetadata = metadata(input.metadata);
    if (lifecycleRole === PRE_REVIEW_STAGING_ROLE) {
      normalizedMetadata.lifecycle_role = PRE_REVIEW_STAGING_ROLE;
      normalizedMetadata.canonical_review_required = true;
    }
    return this.repository.createEvidenceRecord({ evidenceId:createEvidenceIdentifier(), projectId, materialId:material.id, sourceChunkId:chunk?.chunk_id||null,
      evidenceType:text(input.evidence_type || material.material_type, 'Evidence 类型'), title:text(input.title, 'Evidence 标题'), content,
      sourceText, sourcePage, sourceParagraph, sourceHash:resolvedSpan?.source_hash??chunk?.chunk_hash??(sourceText ? createHash('sha256').update(sourceText).digest('hex') : null),sourceLocation,
      evidenceScope:ids(input.evidence_scope), capabilityTags:ids(input.capability_tags), metadata:normalizedMetadata, validityStatus,
      applicableRequirementIds:requirementIds, usageScope:String(input.usage_scope || '').trim() || null, riskNotes:String(input.risk_notes || '').trim() || null });
  }

  async getRequirementReview(projectId,requirementId,input={}){
    assertUuid(projectId,'INVALID_PROJECT_ID','项目 ID 格式无效。');const req=String(requirementId||'').trim();if(!req)throw new AppError('INVALID_REQUIREMENT_ID','Requirement ID 格式无效。',400);const runId=input.retrieval_run_id==null||String(input.retrieval_run_id).trim()===''?null:String(input.retrieval_run_id).trim();if(runId)assertUuid(runId,'INVALID_RETRIEVAL_RUN_ID','Retrieval Run ID 格式无效。');const result=await this.repository.getEvidenceReviewContext({projectId,requirementId:req,retrievalRunId:runId});if(!result)throw new AppError('EVIDENCE_REQUIREMENT_INVALID','Requirement 不存在或未确认。',404);if(runId&&!result.retrieval_run)throw new AppError('RETRIEVAL_RUN_NOT_FOUND','Retrieval Run 不存在或不属于该 Requirement。',404);return result;
  }

  async createFromRetrieval(projectId,requirementId,input={}){
    assertUuid(projectId,'INVALID_PROJECT_ID','项目 ID 格式无效。');const req=String(requirementId||'').trim();const runId=String(input.retrieval_run_id||'').trim();assertUuid(runId,'INVALID_RETRIEVAL_RUN_ID','Retrieval Run ID 格式无效。');const chunkId=String(input.chunk_id||'').trim();if(!chunkId)throw new AppError('EVIDENCE_RETRIEVAL_CHUNK_REQUIRED','Retrieval Result Chunk 不能为空。',422);
    for(const key of ['source_text','source_hash','source_page','source_paragraph','material_id','source_chunk_id','content','approval_status','validity_status','usable_for_claims','usage_scope','risk_notes'])if(Object.hasOwn(input,key))throw new AppError('EVIDENCE_RETRIEVAL_FIELD_FORBIDDEN',`客户端不得提供 ${key}。`,422);
    const source=await this.repository.getRetrievalEvidenceSource({projectId,requirementId:req,retrievalRunId:runId,chunkId});if(!source)throw new AppError('EVIDENCE_RETRIEVAL_RESULT_INVALID','Retrieval Result 不存在、跨项目或与 Requirement 不一致。',422);if(source.status!=='succeeded')throw new AppError('EVIDENCE_RETRIEVAL_RUN_NOT_READY','Retrieval Run 尚未成功完成。',409);
    const material=await this.repository.getCompanyMaterial(source.material_id);const chunks=await this.repository.listMaterialChunks(source.material_id);const span=this.contextResolver.resolve({material,chunks,anchorChunkId:source.chunk_id,strategy:String(input.resolution_strategy||'auto')});
    if (this.requireReviewTransition && (!this.evidenceReviewService || typeof this.evidenceReviewService.propose !== 'function')) throw new AppError('EVIDENCE_REVIEW_REQUIRED','Retrieval 候选必须先进入 Evidence Review。',409);
    const existing=await this.repository.findEvidenceBySourceSpan(projectId,source.material_id,span.source_location.char_start,span.source_location.char_end,span.source_hash);
    const staging = this.requireReviewTransition && this.evidenceReviewService;
    const evidence = existing || await this.create(projectId,{material_id:source.material_id,source_chunk_id:source.chunk_id,resolved_source_span:span,evidence_type:input.evidence_type||source.material_type,title:input.title||`${source.original_name} 来源证据`,content:span.source_text,evidence_scope:input.evidence_scope,capability_tags:input.capability_tags,metadata:input.metadata},{trustedSpan:true,lifecycleRole:staging ? PRE_REVIEW_STAGING_ROLE : null});
    if (!staging) return { evidence, created: !existing };
    if (typeof this.repository.upsertEvidenceSourceSpan === 'function') await this.repository.upsertEvidenceSourceSpan(span);
    const review = await this.evidenceReviewService.propose({projectId,requirementId:req,retrievalRunId:runId,retrievalCandidateId:source.chunk_id,sourceSpanId:span.span_id});
    return { evidence, created: !existing, review, transition:{lifecycle_role:PRE_REVIEW_STAGING_ROLE, review_id:review.review_id} };
  }

  async decide(evidenceId, decision, input = {}) {
    assertUuid(evidenceId, 'INVALID_EVIDENCE_ID', 'Evidence ID 格式无效。');
    if (!['approved','rejected'].includes(decision)) throw new AppError('EVIDENCE_DECISION_INVALID', 'Evidence 审批结论无效。', 422);
    const decidedBy = String(input.decided_by || '').trim();
    if (!decidedBy) throw new AppError('EVIDENCE_DECIDED_BY_REQUIRED', '审批人不能为空。', 422);
    const current = typeof this.repository.getEvidenceRecord === 'function' ? await this.repository.getEvidenceRecord(evidenceId) : null;
    if (current && decision === 'approved') {
      assertFormalEvidenceEligible(current);
      const sourceMaterialId = current.source_document_id || current.material_id;
      if (sourceMaterialId && typeof this.repository.getCompanyMaterial === 'function') {
        const material = await this.repository.getCompanyMaterial(sourceMaterialId);
        if (material && !materialAuthorityAllows(material)) throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED', '该 Evidence 的来源材料当前已被隔离，不能批准。', 409);
        if (material && !materialAuthorityAllowedForMode(material, { authorityMode: this.authorityMode })) throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE', 'Synthetic 材料仅可在隔离 Eval authority 中批准 Evidence。', 422);
        if (material && !materialRoleAllowsEvidence(material)) throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN', '参考资料不能批准为正式 Enterprise Evidence。', 422);
      }
      if (!sourceMaterialId && !materialRoleAllowsEvidence(current)) throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN', '参考资料不能批准为正式 Enterprise Evidence。', 422);
    }
    const result = await this.repository.decideEvidence({ id:evidenceId, decision, decidedBy, riskNotes:String(input.risk_notes || '').trim() || null });
    if (!result) throw new AppError('EVIDENCE_NOT_FOUND', 'Evidence 不存在。', 404);
    return result;
  }

  async setValidity(evidenceId,input={}){
    assertUuid(evidenceId,'INVALID_EVIDENCE_ID','Evidence ID 格式无效。');const validityStatus=String(input.validity_status||'');if(!VALIDITY.has(validityStatus))throw new AppError('EVIDENCE_VALIDITY_INVALID','Evidence 有效性状态无效。',422);
    const reviewedBy=String(input.reviewed_by||'').trim();if(!reviewedBy)throw new AppError('EVIDENCE_VALIDITY_REVIEWER_REQUIRED','有效性审核人不能为空。',422);const result=await this.repository.updateEvidenceValidity({id:evidenceId,validityStatus,reviewedBy});if(!result)throw new AppError('EVIDENCE_NOT_FOUND','Evidence 不存在。',404);return result;
  }

  async proposeMapping(projectId,input={}){
    assertUuid(projectId,'INVALID_PROJECT_ID','项目 ID 格式无效。'); assertUuid(input.evidence_id,'INVALID_EVIDENCE_ID','Evidence ID 格式无效。');
    const source=String(input.mapping_source||'manual'); if(!MAPPING_SOURCES.has(source))throw new AppError('EVIDENCE_MAPPING_SOURCE_INVALID','Mapping 来源无效。',422);
    const createdBy=String(input.created_by||'').trim(); if(!createdBy)throw new AppError('EVIDENCE_MAPPING_CREATED_BY_REQUIRED','Mapping 创建人不能为空。',422);
    const supportLevel=input.support_level==null||String(input.support_level).trim()===''?null:String(input.support_level).trim();if(supportLevel&&!SUPPORT_LEVELS.has(supportLevel))throw new AppError('EVIDENCE_SUPPORT_LEVEL_INVALID','support_level 必须是 full_support、partial_support 或 reference_only。',422);
    const reviewNotes=String(input.review_notes||'').trim()||null;const retrievalRunId=input.retrieval_run_id==null||String(input.retrieval_run_id).trim()===''?null:String(input.retrieval_run_id).trim();const retrievalChunkId=input.retrieval_chunk_id==null||String(input.retrieval_chunk_id).trim()===''?null:String(input.retrieval_chunk_id).trim();
    if(source==='retrieval'){assertUuid(retrievalRunId,'INVALID_RETRIEVAL_RUN_ID','Retrieval Run ID 格式无效。');if(!retrievalChunkId)throw new AppError('EVIDENCE_RETRIEVAL_PROVENANCE_REQUIRED','Retrieval Mapping 必须提供 Retrieval Result 来源。',422);}else if(retrievalRunId||retrievalChunkId)throw new AppError('EVIDENCE_RETRIEVAL_PROVENANCE_NOT_ALLOWED','manual Mapping 不得携带 Retrieval provenance。',422);
    const invalid=await this.repository.findInvalidConfirmedRequirementIds(projectId,[String(input.requirement_id||'').trim()]);
    if(invalid.length)throw new AppError('EVIDENCE_REQUIREMENT_INVALID','Mapping 必须关联已确认 Requirement。',422);
    const eligibility=await this.repository.validateEvidenceForMapping(projectId,input.evidence_id);if(!eligibility)throw new AppError('EVIDENCE_NOT_FOUND','Enterprise Evidence 不存在或不属于当前项目。',404);assertFormalEvidenceEligible(eligibility);if(eligibility.source_material_authority_eligible===false)throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED','Evidence 的来源材料当前已被隔离，不能建立当前 Mapping。',409);if(!materialAuthorityAllowedForMode(eligibility, { authorityMode: this.authorityMode }))throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE','Synthetic 材料仅可在隔离 Eval authority 中建立 Mapping。',422);if(!materialRoleAllowsEvidence(eligibility))throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN','参考资料不能进入 Mapping authority。',422);if(eligibility.approval_status!=='approved')throw new AppError('EVIDENCE_NOT_APPROVED','只有已批准 Enterprise Evidence 才能建立 Mapping。',409);if(eligibility.source_lineage_verified!==true)throw new AppError('EVIDENCE_SOURCE_LINEAGE_REQUIRED','Enterprise Evidence 缺少可信 Material/Chunk 来源。',422);
    if(source==='retrieval'&&!await this.repository.validateRetrievalMappingProvenance({projectId,requirementId:String(input.requirement_id).trim(),evidenceId:input.evidence_id,retrievalRunId,retrievalChunkId}))throw new AppError('EVIDENCE_RETRIEVAL_PROVENANCE_INVALID','Retrieval Result 不存在、跨项目或与 Requirement/Evidence 来源不一致。',422);
    const mapping=await this.repository.createRequirementEvidenceMapping({projectId,requirementId:String(input.requirement_id).trim(),evidenceId:input.evidence_id,mappingSource:source,supportLevel,reviewNotes,retrievalRunId,retrievalChunkId,createdBy});
    if(!mapping)throw new AppError('EVIDENCE_NOT_FOUND','Enterprise Evidence 不存在或不属于当前项目。',404); return mapping;
  }

  async decideMapping(mappingId,decision,input={}){
    assertUuid(mappingId,'INVALID_MAPPING_ID','Mapping ID 格式无效。'); if(!MAPPING_DECISIONS.has(decision))throw new AppError('EVIDENCE_MAPPING_DECISION_INVALID','Mapping 审批结论无效。',422);
    const reviewedBy=String(input.reviewed_by||'').trim(); if(!reviewedBy)throw new AppError('EVIDENCE_MAPPING_REVIEWER_REQUIRED','Mapping 审核人不能为空。',422);const current=await this.repository.getRequirementEvidenceMapping(mappingId);if(!current)throw new AppError('EVIDENCE_MAPPING_NOT_FOUND','Requirement-Evidence Mapping 不存在。',404);if(decision==='approved'&&current.source_material_authority_eligible===false)throw new AppError('MATERIAL_SOURCE_NOT_AUTHORIZED','Mapping 的来源材料当前已被隔离，不能批准。',409);if(decision==='approved'&&!materialAuthorityAllowedForMode(current, { authorityMode: this.authorityMode }))throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE','Synthetic 材料仅可在隔离 Eval authority 中批准 Mapping。',422);if(decision==='approved'&&!materialRoleAllowsEvidence(current))throw new AppError('EVIDENCE_REFERENCE_ONLY_FORBIDDEN','参考资料不能批准为 Mapping authority。',422);
    const requested=input.support_level==null||String(input.support_level).trim()===''?null:String(input.support_level).trim();if(requested&&!SUPPORT_LEVELS.has(requested))throw new AppError('EVIDENCE_SUPPORT_LEVEL_INVALID','support_level 必须是 full_support、partial_support 或 reference_only。',422);const supportLevel=requested||current.support_level;if(decision==='approved'&&!supportLevel)throw new AppError('EVIDENCE_SUPPORT_LEVEL_REQUIRED','批准 Mapping 前必须确定 support_level。',422);
    const result=await this.repository.decideRequirementEvidenceMapping({mappingId,decision,supportLevel,reviewNotes:String(input.review_notes||'').trim()||null,reviewedBy}); return result;
  }

  async listMappings(projectId,requirementId){assertUuid(projectId,'INVALID_PROJECT_ID','项目 ID 格式无效。');const req=String(requirementId||'').trim();const invalid=await this.repository.findInvalidConfirmedRequirementIds(projectId,[req]);if(invalid.length)throw new AppError('EVIDENCE_REQUIREMENT_INVALID','Requirement 不存在或未确认。',404);return{mappings:await this.repository.listRequirementEvidenceMappings(projectId,req)};}

  async listApprovedForRequirement(projectId,requirementId){
    assertUuid(projectId,'INVALID_PROJECT_ID','项目 ID 格式无效。'); const invalid=await this.repository.findInvalidConfirmedRequirementIds(projectId,[String(requirementId||'').trim()]);
    if(invalid.length)throw new AppError('EVIDENCE_REQUIREMENT_INVALID','Requirement 不存在或未确认。',404); return {evidences:(await this.repository.listApprovedEnterpriseEvidenceForRequirement(projectId,requirementId)).filter((evidence)=>!isPreReviewStagingEvidence(evidence)).filter((evidence)=>materialAuthorityAllowedForMode(evidence,{authorityMode:this.authorityMode})).filter(materialRoleAllowsEvidence)};
  }
}
