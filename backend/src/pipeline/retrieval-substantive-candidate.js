export const RETRIEVAL_SUBSTANTIVE_VERSION = 'retrieval-substantive-v1';

export const RETRIEVAL_SUBSTANTIVE_CLASSES = Object.freeze([
  'SUBSTANTIVE_CANDIDATE',
  'FRAGMENT',
  'LABEL_ONLY',
  'NAVIGATION',
  'BOILERPLATE',
  'INCOMPLETE_CLAUSE',
  'NON_SUBSTANTIVE'
]);

const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
const lines = (value) => normalize(value).split('\n').map((line) => line.trim()).filter(Boolean);

const NON_SUBSTANTIVE_LABELS = new Set([
  '信息分：',
  '必须明确：',
  '必须包含：',
  '用户界面优先回答：',
  '记录已经验证的核心原则：',
  '核心原则：',
  'I. Required Documents',
  'D. Open Source Policy',
  'CORE BID PRODUCT FLOW',
  'Architecture source-of-truth location',
  'Primary / Supporting / Audit / Technical',
  'Ensure:',
  '不要自研：'
].map(normalize));

const ABSTRACT_LIST = new Set(['可控', '可追溯', '可审核', '可修改', '可交付', '稳定', '易操作', '安全', '够用']);
const METADATA_LINE = /^(?:representative_synthetic|synthetic_test_material|not_real_customer_data|material_id|document_id|chunk_id|subject|scope|corpus_scope|industry|material_type|review_status|project_name|owner)\s*[:=]/i;
const NAVIGATION = /^(?:[A-Z](?:\.\s*)?|\d+(?:\.\d+)*\s*)?(?:required documents|open source policy|core bid product flow|architecture source-of-truth location|项目目录|目录|内容导航)$/i;
const STATUS_LABEL = /^(?:P[0-3](?:\s*[—-]\s*[A-Z_]+)?|SUPPORTED\s*\/|NO_EVIDENCE\s*\/|Unknown automatically upgraded|Provider\s*\/\s*Model\s*\/\s*Project data scope change|005-open-source-reuse\.md)$/i;
const FACTUAL_PREDICATE = /(?:\b(?:is|are|was|were|has|have|had|supports?|provides?|delivers?|completed?|deployed?|uses?|meets?|includes?|contains?|runs?|passed?|certified?|approved?|registered?|active|available|verified|recorded|accepted|responsible|requires?|ensures?|achieves?|achieved)\b|(?:具有|具备|拥有|支持|提供|完成|通过|采用|满足|包含|包括|达到|部署|负责|承担|实现|可以|能够|使用|配置|运行|记录|验收|签订|获得|认证|注册))/iu;
const FACT_ROW = /(?:^|[|\t])\s*[^|\t:：=]{1,48}\s*[:：=]\s*\S/;
const SENTENCE_PUNCTUATION = /[。！？!?；;，,。]/u;
const SUMMARY_MARKER = /(?:结构化摘要|资料摘要|文档摘要|摘要|summary)/iu;
const DEFER_TO_SOURCE = /(?:需|须|应|请|必须|应当).{0,32}(?:回到|依据|参照|以.{0,12}为准|核验|核查|验证|确认)/iu;
const AUTHORITATIVE_SOURCE_MARKER = /(?:原始|正式).{0,32}(?:法律|标准|政策|项目文件|原文)|(?:法律|标准|政策|项目文件|原文).{0,24}(?:核验|核查|验证|确认)/iu;

function isGenericSummaryDisclaimer(value) {
  const source = normalize(value);
  if (!source || source.length > 600) return false;
  return SUMMARY_MARKER.test(source)
    && DEFER_TO_SOURCE.test(source)
    && AUTHORITATIVE_SOURCE_MARKER.test(source);
}

/**
 * A short label is not an auditable proposition unless it carries a
 * structured factual value.  This is deliberately lexical and language-
 * neutral: it looks for predicate/value shape, never a business vocabulary.
 */
export function isLabelLikeNounPhrase(value) {
  const source = normalize(value);
  if (!source || source.includes('\n') || source.length > 80) return false;
  if (FACT_ROW.test(source)) return false;
  if (SENTENCE_PUNCTUATION.test(source)) return false;
  if (FACTUAL_PREDICATE.test(source)) return false;
  if (/=>|→|->/.test(source)) return false;
  return /^[\p{L}\p{N}\p{M}_/ .&()+-]+$/u.test(source);
}

function isMetadataBlock(valueLines) {
  return valueLines.length > 0 && valueLines.every((line) => {
    const match = line.match(METADATA_LINE);
    return match && !line.slice(match[0].length).trim();
  });
}

function isAbstractList(valueLines) {
  return valueLines.length >= 3 && valueLines.every((line) => {
    const compact = line.replace(/[、,，/\\|·]/g, '').trim();
    return ABSTRACT_LIST.has(compact) || compact.length <= 4;
  });
}

/**
 * Deterministic content-shape check only. This deliberately does not decide
 * whether a candidate supports a Requirement; that remains the separate
 * Requirement-relative Evidence classifier.
 */
export function classifySubstantiveCandidate(candidate = {}) {
  const source = normalize(candidate.source_text ?? candidate.raw_original_text);
  const valueLines = lines(source);
  if (!source) return { substantive_candidate: false, substantive_class: 'NON_SUBSTANTIVE', substantive_reason: 'EMPTY_SOURCE', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (isGenericSummaryDisclaimer(source)) return { substantive_candidate: false, substantive_class: 'BOILERPLATE', substantive_reason: 'GENERIC_SUMMARY_DISCLAIMER', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (isMetadataBlock(valueLines)) return { substantive_candidate: false, substantive_class: 'LABEL_ONLY', substantive_reason: 'METADATA_LABEL_BLOCK', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && NON_SUBSTANTIVE_LABELS.has(valueLines[0])) return { substantive_candidate: false, substantive_class: 'LABEL_ONLY', substantive_reason: 'KNOWN_LABEL_ONLY', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && NAVIGATION.test(valueLines[0])) return { substantive_candidate: false, substantive_class: 'NAVIGATION', substantive_reason: 'NAVIGATION_LABEL', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && STATUS_LABEL.test(valueLines[0])) return { substantive_candidate: false, substantive_class: 'BOILERPLATE', substantive_reason: 'STATUS_OR_POLICY_LABEL', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (isAbstractList(valueLines)) return { substantive_candidate: false, substantive_class: 'BOILERPLATE', substantive_reason: 'ABSTRACT_VALUE_LIST', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && /[:：]\s*$/.test(valueLines[0])) return { substantive_candidate: false, substantive_class: 'INCOMPLETE_CLAUSE', substantive_reason: 'VALUE_MISSING_AFTER_LABEL', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && isLabelLikeNounPhrase(valueLines[0])) return { substantive_candidate: false, substantive_class: 'LABEL_ONLY', substantive_reason: 'LABEL_LIKE_NOUN_PHRASE', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  if (valueLines.length === 1 && valueLines[0].length <= 3 && /^[\p{L}\p{N}_-]+$/u.test(valueLines[0])) return { substantive_candidate: false, substantive_class: 'FRAGMENT', substantive_reason: 'SHORT_TOKEN_FRAGMENT', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
  return { substantive_candidate: true, substantive_class: 'SUBSTANTIVE_CANDIDATE', substantive_reason: 'COMPLETE_PROPOSITION_OR_STRUCTURED_VALUE', substantive_version: RETRIEVAL_SUBSTANTIVE_VERSION };
}

export function applySubstantiveCandidate(candidate = {}) {
  const result = classifySubstantiveCandidate(candidate);
  return { ...candidate, ...result };
}
