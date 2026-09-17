import { routeRequirement } from './chapter-router.js';
import {
  assertMandatoryRequirementMetadata,
  enrichMandatoryRequirement
} from './mandatory-requirement.js';
import { createHash } from 'node:crypto';
import { normalizeSourceText } from './source-location-resolver.js';
import { evaluateRequirementCandidateQuality } from './requirement-quality-gate.js';

export const CANONICAL_REQUIREMENT_RULE_VERSION = '4.3-canonical-requirement-1';
const CATEGORIES=new Set(['functional','technical','performance','security','data','implementation','delivery','acceptance','service','constraint','other']);
const CATEGORY_ALIASES=new Map([['function','functional'],['功能','functional'],['技术','technical'],['性能','performance'],['安全','security'],['数据','data'],['实施','implementation'],['交付','delivery'],['验收','acceptance'],['服务','service'],['约束','constraint']]);
const DOWNSTREAM_CATEGORIES={functional:'technical',technical:'technical',performance:'performance',security:'technical',data:'technical',implementation:'implementation',delivery:'delivery',acceptance:'delivery',service:'service',constraint:'contractual',other:'context'};
const WRITER_CATEGORIES=new Set(['technical','performance','implementation','delivery','service']);
const CONFIRMATION_RULES=[
  ['EXPLICIT_PENDING_CONFIRMATION',/(?:待确认|需(?:由)?双方进一步确认|双方进一步确认|进一步确认|由[^。；\n]{0,40}(?:实施阶段|后续)[^。；\n]{0,20}双方确认)/],
  ['INFORMATION_TO_BE_PROVIDED',/(?:待提供|后续提供|另行提供)/],
  ['DETAIL_TO_BE_DETERMINED',/(?:待确定|后续确定|另行确定)/]
];
const EXCLUDED=/(?:付款|支付)[^。；\n]*(?:\d+(?:\.\d+)?%|万元|元)|(?:废弃|作废|已取消|不再适用)[^。；\n]*(?:条款|要求|功能)|(?:忽略以上|无视以上|执行以下指令|system prompt|prompt injection)/i;

function normalizedCategory(value,warnings,index){const raw=String(value||'').trim().toLowerCase();const category=CATEGORIES.has(raw)?raw:CATEGORY_ALIASES.get(raw);if(category)return category;warnings.push({code:'REQUIREMENT_CATEGORY_UNKNOWN',candidate_index:index,message:'未知 Candidate category 已归一为 other。'});return'other';}
function riskFlags(text){const value=String(text||'');const flags=[];if(/(?:AI|人工智能|智能分析|机器学习)/i.test(value))flags.push('AI_SCOPE_UNSPECIFIED');if(/(?:接口|对接)/.test(value)&&!/(?:接口清单|接口规范|协议|字段)/.test(value))flags.push('INTERFACE_SCOPE_UNSPECIFIED');if(/(?:第三方|现有业务平台).*(?:接口|对接|接入|同步)|(?:接口|对接|接入|同步).*第三方/.test(value))flags.push('THIRD_PARTY_INTERFACE');if(/(?:性能|高可靠性|可用率|恢复时间|响应时间)/.test(value)&&!/[0-9]+(?:\.[0-9]+)?\s*(?:秒|毫秒|分钟|小时|%)/.test(value))flags.push('PERFORMANCE_METRIC_UNSPECIFIED');if(/(?:依赖|采购人提供|第三方)/.test(value))flags.push('EXTERNAL_DEPENDENCY');if(/(?:具备|提供|支持)[^。；\n]{0,30}(?:分析|处理|管理|智能)?能力/.test(value)&&!/(?:包括|包含|具体|至少|如下)/.test(value))flags.push('CAPABILITY_SCOPE_UNSPECIFIED');return[...new Set(flags)];}
function sha(value){return createHash('sha256').update(value).digest('hex');}
function verifiedEvidence(raw){const match=raw.source_match_type||null;const status=match==='ambiguous'?'ambiguous':match==='suggested'?'suggested':raw.source_resolution_status||'unresolved';const verified=raw.source_verified===true&&status==='verified'&&!['ambiguous','suggested','unresolved'].includes(match);return{source_clause:raw.source_clause_id||raw.source_clause||null,source_text:String(raw.source_text||'').trim()||null,context_text:verified?String(raw.source_context_text||raw.source_text||'').trim()||null:null,verified,resolution_status:status,match_type:match,source_hash:verified?(raw.source_hash||null):null,chunk_id:raw.source_chunk_id||null,page_start:verified?(raw.source_page_start??raw.source_page??null):null,page_end:verified?(raw.source_page_end??raw.source_page??null):null,paragraph_start:verified?(raw.source_paragraph_start??raw.source_paragraph??null):null,paragraph_end:verified?(raw.source_paragraph_end??raw.source_paragraph??null):null};}
function missingReference(text,documentText){if(!documentText)return false;const refs=[...String(text||'').matchAll(/附件\s*([A-Za-z0-9一二三四五六七八九十]+)(?:《([^》]+)》)?/g)];return refs.some((match)=>{const label=`附件${match[1]}`.replace(/\s/g,'');const document=String(documentText).replace(/\s/g,'');const labelCount=document.split(label).length-1;const title=match[2]?.replace(/\s/g,'');const titleCount=title?document.split(title).length-1:0;return labelCount<=1&&(!title||titleCount<=1);});}
function incompleteClause(text){return /(?:进行|实现|完成|提供|支持|对接|接入|同步|建设|配置|管理|处理|执行)\s*$/.test(String(text||'').trim());}

export function buildCanonicalRequirements(candidates,{mandatoryScopeRules=[],documentText=null,qualityGate=false}={}){
  if(!Array.isArray(candidates)||!candidates.length)throw ruleError('REQUIREMENTS_REQUIRED','至少需要一条 Candidate。');
  const warnings=[],errors=[],prepared=[];
  for(let index=0;index<candidates.length;index+=1){const raw=candidates[index];const text=String(raw?.text||raw?.content||'').trim();if(!text)continue;const evidence=verifiedEvidence(raw);const policyText=evidence.verified?evidence.context_text:'';if(EXCLUDED.test(`${text}\n${policyText}`)){warnings.push({code:'CANDIDATE_EXCLUDED_NON_REQUIREMENT',candidate_index:index+1,message:'候选属于付款、废弃条款或指令文本，未进入 Canonical Requirement。'});continue;}const category=normalizedCategory(raw.category,warnings,index+1);const requirementCategory=DOWNSTREAM_CATEGORIES[category];const confirmationReasons=evidence.verified?CONFIRMATION_RULES.filter(([,pattern])=>pattern.test(policyText)).map(([code])=>code):[];if(evidence.verified&&missingReference(policyText,documentText))confirmationReasons.push('REFERENCED_CONTENT_MISSING');if(evidence.verified&&incompleteClause(policyText))confirmationReasons.push('CLAUSE_INCOMPLETE');const mandatory=enrichMandatoryRequirement({...raw,source_section:raw.source_section??null,source_clause_id:evidence.source_clause},{sourceText:evidence.source_text,scopeRules:mandatoryScopeRules});const quality=evaluateRequirementCandidateQuality(raw,{sourceText:evidence.source_text,sourceVerified:evidence.verified,sourceRange:raw.source_range||null});const exactValue=[category,normalizeSourceText(text),normalizeSourceText(evidence.source_text),evidence.source_clause||''].join('|');prepared.push({...mandatory,text,content:text,source_excerpt:evidence.source_text,source_page:evidence.page_start,source_paragraph:evidence.paragraph_start,source_page_start:evidence.page_start,source_page_end:evidence.page_end,source_paragraph_start:evidence.paragraph_start,source_paragraph_end:evidence.paragraph_end,source_hash:evidence.source_hash,source_chunk_id:evidence.chunk_id,source_match_type:evidence.match_type,source_resolution_status:evidence.resolution_status,source_verified:evidence.verified,category,requirement_category:requirementCategory,writer_eligible:WRITER_CATEGORIES.has(requirementCategory)&&(!qualityGate||quality.decision==='PASS'),classification_review_required:category==='other',classification_method:'automatic',requires_confirmation:confirmationReasons.length>0,confirmation_reasons:[...new Set(confirmationReasons)],risk_flags:riskFlags(`${text}\n${policyText}`),quality_gate_version:qualityGate?quality.quality_gate_version:null,quality_gate_decision:qualityGate?quality.decision:null,quality_gate_reason_codes:qualityGate?quality.reason_codes:[],semantic_quality_review_required:qualityGate?quality.semantic_quality_review_required:false,source_evidence:evidence,exact_key:sha(exactValue),candidate_ref:raw.candidate_index||index+1});}
  const unique=[],byKey=new Map();let duplicateCount=0;
  for(const item of prepared){const existing=byKey.get(item.exact_key);if(existing){existing.merged_candidate_refs.push(item.candidate_ref);existing.sources.push(...(item.sources||[]));duplicateCount++;continue;}const stored={...item,merged_candidate_refs:[item.candidate_ref],sources:[...(item.sources||[])]};byKey.set(item.exact_key,stored);unique.push(stored);}
  const canonical=unique.map((item,index)=>{const{exact_key,merged_candidate_refs,candidate_ref,...value}=item;return{...value,req_id:`REQ-${String(index+1).padStart(3,'0')}`,ordinal:index+1,deduplication:{rule_version:CANONICAL_REQUIREMENT_RULE_VERSION,exact_key,merged_candidate_count:merged_candidate_refs.length,merged_candidate_refs}};});
  const audit={candidate_count:candidates.length,verified_count:canonical.filter((x)=>x.source_evidence.verified).length,unverified_count:canonical.filter((x)=>!x.source_evidence.verified).length,duplicate_count:duplicateCount,canonical_count:canonical.length,confirmation_count:canonical.filter((x)=>x.requires_confirmation).length,warnings,errors};
  Object.defineProperty(canonical,'audit',{value:audit,enumerable:false});return canonical;
}

export function validateCanonicalRequirements(requirements,router=routeRequirement){return canonicalizeRequirements(requirements,router);}

function ruleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertRequirementIdsUnchanged(baseline, candidate) {
  const expected = baseline.map((requirement) => requirement.req_id);
  const actual = candidate.map((requirement) => requirement.req_id);
  if (expected.length !== actual.length || expected.some((reqId, index) => reqId !== actual[index])) {
    throw ruleError('REQUIREMENT_ID_MUTATED', 'REQ-ID 不得增删、修改、合并或重排。');
  }
  baseline.forEach((requirement, index) => {
    assertMandatoryRequirementMetadata(requirement);
    assertMandatoryRequirementMetadata(candidate[index]);
    if (requirement.source_text !== candidate[index].source_text
      || requirement.is_mandatory !== candidate[index].is_mandatory
      || requirement.mandatory_marker !== candidate[index].mandatory_marker
      || requirement.source_section !== candidate[index].source_section
      || requirement.source_clause_id !== candidate[index].source_clause_id
      || requirement.mandatory_scope_source_text !== candidate[index].mandatory_scope_source_text
      || requirement.mandatory_scope_section !== candidate[index].mandatory_scope_section
      || (requirement.source_status || 'verified') !== (candidate[index].source_status || 'verified')
      || JSON.stringify(requirement.exception_clause_ids) !== JSON.stringify(candidate[index].exception_clause_ids)) {
      throw ruleError('REQUIREMENT_MANDATORY_METADATA_MUTATED', 'Requirement mandatory 元数据不得修改。');
    }
  });
}

export function canonicalizeRequirements(rawRequirements, router = routeRequirement) {
  if (!Array.isArray(rawRequirements) || rawRequirements.length === 0) {
    throw ruleError('REQUIREMENTS_REQUIRED', '至少需要一条 Requirement。');
  }

  const seen = new Set();
  return rawRequirements.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw ruleError('REQUIREMENT_INVALID', 'Requirement 必须是对象。');
    }
    const reqId = raw.req_id;
    if (typeof reqId !== 'string' || !reqId.trim() || reqId !== reqId.trim()) {
      throw ruleError('REQUIREMENT_ID_INVALID', 'REQ-ID 必须是非空且无首尾空格的字符串。');
    }
    if (seen.has(reqId)) throw ruleError('REQUIREMENT_ID_DUPLICATED', `REQ-ID 重复：${reqId}`);
    seen.add(reqId);

    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text) throw ruleError('REQUIREMENT_TEXT_INVALID', `${reqId} 缺少有效需求正文。`);
    const targetSections = router({ req_id: reqId, text });
    if (!Array.isArray(targetSections) || targetSections.length === 0) {
      throw ruleError('REQUIREMENT_ROUTE_FAILED', `${reqId} 未路由到后端章节。`);
    }

    const sourceText = typeof raw.source_text === 'string' && raw.source_text.trim()
      ? raw.source_text.trim()
      : typeof raw.source_excerpt === 'string' && raw.source_excerpt.trim()
        ? raw.source_excerpt.trim()
        : text;
    const hasProvidedMetadata = Object.hasOwn(raw, 'is_mandatory')
      || Object.hasOwn(raw, 'mandatory_marker');
    const mandatoryRequirement = hasProvidedMetadata
      ? {
        source_text: sourceText,
        source_section: raw.source_section ?? null,
        source_clause_id: raw.source_clause_id ?? null,
        is_mandatory: raw.is_mandatory,
        mandatory_marker: raw.mandatory_marker,
        mandatory_scope_source_text: raw.mandatory_scope_source_text ?? null,
        mandatory_scope_section: raw.mandatory_scope_section ?? null,
        exception_clause_ids: raw.exception_clause_ids ?? []
      }
      : enrichMandatoryRequirement({}, { sourceText });
    assertMandatoryRequirementMetadata(mandatoryRequirement);

    return {
      req_id: reqId,
      text,
      source_ref: typeof raw.source_ref === 'string' ? raw.source_ref.trim() || null : null,
      source_text: mandatoryRequirement.source_text,
      is_mandatory: mandatoryRequirement.is_mandatory,
      mandatory_marker: mandatoryRequirement.mandatory_marker,
      source_section: mandatoryRequirement.source_section ?? null,
      source_clause_id: mandatoryRequirement.source_clause_id ?? null,
      mandatory_scope_source_text: mandatoryRequirement.mandatory_scope_source_text,
      mandatory_scope_section: mandatoryRequirement.mandatory_scope_section,
      exception_clause_ids: [...mandatoryRequirement.exception_clause_ids],
      source_status: raw.source_status === 'provisional' ? 'provisional' : 'verified',
      target_sections: [...new Set(targetSections)]
    };
  });
}
