export const RETRIEVAL_CHUNK_ROLE_VERSION = 'retrieval-chunk-role-v1';
import { applySubstantiveCandidate, RETRIEVAL_SUBSTANTIVE_VERSION } from './retrieval-substantive-candidate.js';
import { applyEvidenceSourceEligibility, RETRIEVAL_SOURCE_ELIGIBILITY_VERSION } from './retrieval-source-eligibility.js';
export { classifySubstantiveCandidate } from './retrieval-substantive-candidate.js';
export { classifyEvidenceSourceEligibility } from './retrieval-source-eligibility.js';

export const RETRIEVAL_CHUNK_ROLES = Object.freeze([
  'BUSINESS_CONTENT',
  'TABLE_ROW',
  'HEADING',
  'METADATA',
  'FRONT_MATTER',
  'OTHER'
]);

const text = (value) => String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
const lines = (value) => text(value).split('\n').map((line) => line.trim()).filter(Boolean);
const headingOnly = (value) => /^#{1,6}\s+[^\n]+$/.test(text(value));

const FRONT_MATTER = /(?:^|[\n# ])(?:封面|目录|目\s*录|投标邀请|招标公告|投标须知|contents?|cover page)(?:$|[\n：: ])/i;
const METADATA_KEY = /^(?:representative_synthetic|synthetic_test_material|not_real_customer_data|subject|source_type|source_org|license_or_usage_status|material_id|scope|corpus_scope|industry|material_type|review_status|project_name|owner|document_id|chunk_id)\s*[:=]/i;
const TABLE_ROW = /^\s*\|.*\|\s*$|(?:^|[\t ])(?:字段|参数|指标|名称|编号|状态|有效至)\s*[:：]/;

function isMetadataOnly(value) {
  const valueLines = lines(value);
  return valueLines.length > 0
    && valueLines.length <= 2
    && valueLines.every((line) => METADATA_KEY.test(line));
}

/**
 * Writer references may retain source lineage for audit while excluding
 * citation/index rows from the final context.  This is a content-shape
 * predicate only; it does not decide authority, scope or relevance.
 */
export function isCitationIndexLike(value) {
  const source = text(value);
  if (!source) return false;
  const valueLines = lines(source);
  // URL query strings may contain '?' and should not turn a citation row into
  // sentence punctuation.  Evaluate punctuation only after removing URLs.
  const sourceWithoutUrls = source.replace(/https?:\/\/\S+/giu, '');
  if (valueLines.length > 3 || /[。！？!?；;]/u.test(sourceWithoutUrls)) return false;
  const hasReferenceMarker = /(?:https?:\/\/|(?:OFF|REF|SRC|DOC)[-_]?[A-Z]?\d{1,4}\b|来源(?:单位|组织)?|发布单位|发布日期|最后核验|有效期|文号|出处|状态\s*[:：`]|实施\s*[:：`])/iu.test(source);
  const hasIndexSeparator = /(?:\|+|｜+|\s[-—]\s|\*\*[^*]+\*\*)/u.test(source);
  const bareMetadataLine = /^(?:[-*•\s]*(?:https?:\/\/\S+|(?:来源(?:单位|组织)?|发布单位|发布日期|最后核验|有效期|文号|出处|状态|实施)\s*[:：].*))$/iu;
  const allBareMetadata = valueLines.every((line) => bareMetadataLine.test(line));
  return hasReferenceMarker && (hasIndexSeparator || allBareMetadata);
}

/**
 * Classifies a retrieved chunk without changing its text or similarity order.
 * Heading/metadata roles are intentionally retained for context recovery and
 * audit, but can be excluded from the formal evidence lane by the service.
 */
export function classifyRetrievalChunkRole(candidate = {}) {
  const source = text(candidate.source_text ?? candidate.raw_original_text);
  const explicit = text(candidate.chunk_role ?? candidate.retrieval_chunk_role).toUpperCase();
  if (RETRIEVAL_CHUNK_ROLES.includes(explicit)) {
    return { role: explicit, version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'EXPLICIT_ROLE' };
  }
  if (!source) return { role: 'OTHER', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'EMPTY_SOURCE' };
  if (String(candidate.front_matter ?? '').toLowerCase() === 'true' || FRONT_MATTER.test(source)) {
    return { role: 'FRONT_MATTER', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'FRONT_MATTER_MARKER' };
  }
  if (headingOnly(source)) {
    return { role: 'HEADING', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'HEADING_ONLY' };
  }
  if (isMetadataOnly(source)) {
    return { role: 'METADATA', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'METADATA_FIELDS_ONLY' };
  }
  if (String(candidate.table_row ?? '').toLowerCase() === 'true' || lines(source).some((line) => /^\s*\|.*\|\s*$/.test(line))) {
    return { role: 'TABLE_ROW', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'TABLE_OR_STRUCTURED_ROW' };
  }
  return { role: 'BUSINESS_CONTENT', version: RETRIEVAL_CHUNK_ROLE_VERSION, reason: 'SUBSTANTIVE_SOURCE_TEXT' };
}

const METADATA_INTENT = /(?:项目名称|文件名称|材料名称|文件编号|文号|发布日期|发布单位|来源单位|标题|目录|页眉|页脚|编号|metadata|header|front.?matter)/i;

export function requirementExplicitlyRequestsMetadata(requirement = {}) {
  const value = `${requirement.requirement_category ?? requirement.category ?? ''} ${requirement.text ?? ''}`;
  return METADATA_INTENT.test(value);
}

export function isFormalEvidenceChunkEligible({ requirement = {}, candidate = {} } = {}) {
  const role = candidate.chunk_role ?? classifyRetrievalChunkRole(candidate).role;
  const substantive = candidate.substantive_candidate ?? applySubstantiveCandidate(candidate).substantive_candidate;
  if (!substantive) return false;
  const sourceEligible = applyEvidenceSourceEligibility(candidate).evidence_source_eligible;
  if (!sourceEligible) return false;
  if (['HEADING', 'FRONT_MATTER'].includes(role)) return requirementExplicitlyRequestsMetadata(requirement);
  if (role === 'METADATA') return requirementExplicitlyRequestsMetadata(requirement);
  return true;
}

/**
 * Final Writer Reference content gate.  Authority, lifecycle and scope are
 * owned by the retrieval query; this gate only prevents non-substantive
 * presentation/index content from consuming Writer slots.
 */
export function isWriterReferenceContentEligible(candidate = {}) {
  const annotated = candidate.chunk_role && candidate.substantive_candidate !== undefined
    ? candidate
    : applyRetrievalChunkRole(candidate);
  if (!text(annotated.source_text ?? annotated.raw_original_text)) return false;
  if (['HEADING', 'FRONT_MATTER', 'METADATA'].includes(annotated.chunk_role)) return false;
  if (annotated.substantive_candidate !== true) return false;
  if (isCitationIndexLike(annotated.source_text ?? annotated.raw_original_text)) return false;
  return true;
}

export function applyRetrievalChunkRole(candidate = {}) {
  const classified = classifyRetrievalChunkRole(candidate);
  const role = classified.role;
  const substantive = applySubstantiveCandidate(candidate);
  const citationIndex = isCitationIndexLike(candidate.source_text ?? candidate.raw_original_text);
  return {
    ...candidate,
    chunk_role: role,
    chunk_role_version: classified.version,
    chunk_role_reason: classified.reason,
    ...substantive,
    ...(citationIndex ? { substantive_candidate: false, substantive_class: 'NON_SUBSTANTIVE', substantive_reason: 'CITATION_INDEX' } : {}),
    substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION,
    ...applyEvidenceSourceEligibility(candidate),
    evidence_source_version: RETRIEVAL_SOURCE_ELIGIBILITY_VERSION
  };
}

export function partitionRetrievalCandidates({ requirement = {}, candidates = [] } = {}) {
  const annotated = (Array.isArray(candidates) ? candidates : []).map(applyRetrievalChunkRole);
  const eligible = annotated.filter((candidate) => isFormalEvidenceChunkEligible({ requirement, candidate }));
  const eligibleIds = new Set(eligible.map((candidate) => candidate.chunk_id));
  const classified = annotated.map((candidate) => ({
    ...candidate,
    candidate_eligibility: eligibleIds.has(candidate.chunk_id) ? 'EVIDENCE_ELIGIBLE' : 'CONTEXT_ONLY',
    candidate_exclusion_reason: eligibleIds.has(candidate.chunk_id)
      ? null
      : (!candidate.substantive_candidate ? candidate.substantive_reason : (!candidate.evidence_source_eligible ? candidate.evidence_source_reason : 'NON_EVIDENCE_ROLE'))
  }));
  const excluded = classified.filter((candidate) => candidate.candidate_eligibility === 'CONTEXT_ONLY');
  return {
    all_candidates: classified,
    eligible_candidates: classified.filter((candidate) => candidate.candidate_eligibility === 'EVIDENCE_ELIGIBLE'),
    excluded_candidates: excluded,
    internal_candidate_pool_size: annotated.length,
    eligible_candidate_pool_size: eligible.length,
    excluded_candidate_count: excluded.length,
    hygiene_version: RETRIEVAL_CHUNK_ROLE_VERSION
  };
}
