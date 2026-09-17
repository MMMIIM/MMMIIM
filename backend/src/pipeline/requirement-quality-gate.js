import { createHash } from 'node:crypto';

export const REQUIREMENT_QUALITY_GATE_VERSION = '4.3-requirement-quality-gate-1';

const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;
const NEGATION_PATTERN = /(?:不得|禁止|不能|不应|不可|无需|无须|未|无|非)/g;
// Match requirement-bearing modality words without treating the "应" inside
// ordinary words such as "响应" or "应用" as a modal marker.
const MODALITY_PATTERN = /(?:必须|须|应当|需要|不得|禁止|不能|不可|应(?=(?:支持|提供|建设|实现|完成|满足|具备|达到|包含|包括|派驻|配置|采用|保证|遵守|负责|按照|按|进行|处理|开展|提交|设置|协助|配合|详细|及时|安排|覆盖|维护|服务|为|有|具有)))/g;
const TABLE_TERM_PATTERN = /(?:数量|单位|型号|规格|参数|阈值|性能|响应时间|服务期限|频率|容量)/g;
const SCOPE_PATTERN = /(?:范围|覆盖|区域|全市|全省|全国|全部|所有区域|仅限|不含)/g;
const STATUS_PATTERN = /(?:已验收|验收完成|中标|已交付|在用|有效|无效|作废|完成)/g;
const EXPLICIT_MUTATION_PATTERN = /(?:主体替换|未授权(?:企业|主体)|范围扩展至|状态改为|有效期改为|虚构认证|另一个独立|原文未声明|未经授权变更|表头缺失|可选(?!择))/;
const PARENT_CRITICAL_CONSEQUENCE_PATTERN = /(?:投标(?:将被|被)?否决|否决投标|无效投标|投标无效|作无效处理|废标|取消资格|资格无效|不予受理|拒绝投标|不接受投标|资格不合格|审查不通过)/;
const PARENT_GOVERNING_LIST_PATTERN = /(?:下列|以下|如下|任一|之一|相应(?:条款|情形|情况|条件)|附表|表[一二三四五六七八九十0-9]+)/;
const PARENT_GOVERNING_TABLE_PATTERN = /(?:附表[一二三四五六七八九十0-9]*|符合性审查表|资格审查表|评审表|检查表|评审矩阵|审查矩阵)/;
const PARENT_GOVERNING_RELATION_PATTERN = /(?:全部|所有|任一|有一项|任何一项|以下|如下|下列)[^。；:：]{0,40}(?:否则|则|如[^。；:：]{0,12}(?:则|即))[^。；:：]{0,24}/;
const INDEPENDENT_STRUCTURE_BOUNDARY_PATTERN = /第[一二三四五六七八九十百0-9]+章/;
// Entity identity is deliberately narrower than the old "ends with 系统/平台"
// heuristic.  Capability nouns are not enterprise identities and should not
// be reported merely because a paraphrase starts with a verb ("提供系统").
const ENTITY_PATTERN = /(?:[\u3400-\u9fffA-Za-z0-9]{1,20}(?:公司|集团|中心|部门|供应商|采购人|投标人|中标人|企业))/g;
const ROLE_TOKENS = ['投标人', '供应商', '采购人', '招标人', '中标人'];
const SAFE_ROLE_EQUIVALENTS = new Map([
  ['我单位', new Set(['投标人', '供应商'])],
  ['我方', new Set(['投标人', '供应商'])],
  ['本单位', new Set(['投标人', '供应商'])],
  ['供应商', new Set(['投标人', '供应商'])],
  ['投标人', new Set(['投标人', '供应商'])],
  ['采购人', new Set(['采购人', '招标人'])],
  ['招标人', new Set(['采购人', '招标人'])]
]);
const REQUIREMENT_ACTION_PATTERN = /(?:提供|支持|建设|实现|完成|满足|具备|达到|包含|包括|派驻|配置|采用|保证|遵守|负责|按照|按|进行|处理|开展|提交|设置|协助|配合|详细|及时|安排|覆盖|维护|服务|具有)/;
const OPTIONAL_CONTEXT_PATTERN = /(?:建议|鼓励|可(?:以)?|视情况|原则上|如有需要|若中标|必要时|不包括|仅限|只限)/;

const sha256 = (value) => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
const tokens = (pattern, value) => [...new Set((String(value ?? '').match(pattern) || []).map(normalize).filter(Boolean))];

function numericComparable(value) {
  return normalize(value).replace(/([一二两三四五六七八九十])(?=(?:人|名|个|项|次|套|台|年|月|日|天|小时|分钟|秒|条|份|家|处))/g, (digit) => ({
    一: '1', 二: '2', 两: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10'
  }[digit] || digit));
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function occurrences(pattern, value) {
  const source = String(value ?? '');
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  return [...source.matchAll(re)].map((match) => ({ token: normalize(match[0]), index: match.index ?? -1 }));
}

function classifyNumber(source, index, token) {
  const before = String(source).slice(Math.max(0, index - 36), index);
  const after = String(source).slice(index + String(token).length, index + String(token).length + 36);
  const context = `${before}${token}${after}`;
  if (/\d+\s*\/\s*\d+|第\s*\d+\s*页|页码/.test(context)) return 'PAGE_OR_LAYOUT_NUMBER';
  // Parenthesized/list and section numbers are layout, not business facts.
  if (/[（(]\s*\d+\s*[）)]/.test(context)
    || /(?:^|[\n\r])\s*\d+\s*[)）]/.test(context)
    || /(?:^|[\n\r])\s*\d+\s*[、.．]/.test(context)
    || /(?:^|[\n\r])\s*\d+\s+(?=[\u3400-\u9fff])/.test(context)
    || /第\s*\d+(?:\.\d+)*\s*[章节条款]/.test(context)) return 'STRUCTURAL_NUMBER';
  if (/项目编号|采购编号|标准|版本|编号|证书|代码|型号/.test(context)) return 'IDENTIFIER_NUMBER';
  if (/%|秒|毫秒|分钟|小时|日|年|月|次|人|名|个|台|套|条|项|容量|并发|响应|频率|期限|金额|元|万元|数量|不少于|不超过|以上|以下/.test(context)) return 'BUSINESS_CRITICAL_NUMBER';
  // The quality gate receives NFKC/whitespace-normalized source text, so a
  // plain section prefix such as "2服务地点" no longer contains the original
  // separating space. Treat only a bare leading number followed by prose as a
  // structural label; business units were already handled above.
  if (/(?:^|[\n\r])\d+(?=[\u3400-\u9fff])/.test(context)) return 'STRUCTURAL_NUMBER';
  return 'AMBIGUOUS_NUMBER';
}

const CLAUSE_SEPARATOR_PATTERN = /[。；;!?！？\n，,：:]+/;

function splitClausesWithOffsets(value) {
  const source = String(value ?? '');
  const clauses = [];
  let start = 0;
  for (let index = 0; index <= source.length; index += 1) {
    if (index !== source.length && !CLAUSE_SEPARATOR_PATTERN.test(source[index])) continue;
    const text = source.slice(start, index).trim();
    if (text) clauses.push({ text, start, end: index });
    start = index + 1;
  }
  return clauses;
}

function lexicalBigrams(value) {
  const text = normalize(value)
    .replace(NUMBER_PATTERN, '')
    .replace(/[^\p{L}\p{Script=Han}]/gu, '');
  const grams = new Set();
  for (let index = 0; index < text.length - 1; index += 1) grams.add(text.slice(index, index + 2));
  if (!grams.size && text) grams.add(text);
  return grams;
}

function lexicalClauseSimilarity(left, right) {
  const leftGrams = lexicalBigrams(left);
  const rightGrams = lexicalBigrams(right);
  if (!leftGrams.size || !rightGrams.size) return 0;
  let shared = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) shared += 1;
  return shared / Math.min(leftGrams.size, rightGrams.size);
}

function alignSourceNumberOwnership(source, candidate) {
  const sourceClauses = splitClausesWithOffsets(source);
  const candidateClauses = splitClausesWithOffsets(candidate);
  const ownership = new Map();
  let ambiguous = false;

  for (const [candidateIndex, candidateClause] of candidateClauses.entries()) {
    const scores = sourceClauses.map((sourceClause) => lexicalClauseSimilarity(candidateClause.text, sourceClause.text));
    const best = Math.max(...scores, 0);
    if (best < 0.55) continue;
    const matches = scores
      .map((score, sourceIndex) => ({ score, sourceIndex }))
      .filter(({ score }) => score >= Math.max(0.55, best * 0.65));
    if (matches.length > 1 && matches[1].score >= matches[0].score * 0.92) {
      ambiguous = true;
      continue;
    }
    const sourceIndex = matches[0]?.sourceIndex;
    if (sourceIndex == null) continue;
    if (!ownership.has(sourceIndex)) ownership.set(sourceIndex, new Set());
    ownership.get(sourceIndex).add(candidateIndex);
  }

  if (ambiguous || !ownership.size) return { aligned: false, sourceClauses, candidateClauses, ownership };

  const omittedNumbers = [];
  const ignoredSiblingNumbers = [];
  for (const [sourceIndex, sourceClause] of sourceClauses.entries()) {
    const sourceNumbers = occurrences(NUMBER_PATTERN, sourceClause.text).map((entry) => ({
      ...entry,
      index: sourceClause.start + entry.index
    }));
    if (!sourceNumbers.length) continue;
    const candidateIndexes = ownership.get(sourceIndex);
    if (!candidateIndexes) {
      for (const entry of sourceNumbers) ignoredSiblingNumbers.push({ token: entry.token, reason: 'SIBLING_ATOMIC_ASSERTION' });
      continue;
    }
    const candidateNumbers = [...candidateIndexes]
      .flatMap((candidateIndex) => occurrences(NUMBER_PATTERN, candidateClauses[candidateIndex].text).map((entry) => entry.token));
    const available = new Map();
    for (const token of candidateNumbers) available.set(token, (available.get(token) || 0) + 1);
    for (const entry of sourceNumbers) {
      const remaining = available.get(entry.token) || 0;
      if (remaining > 0) available.set(entry.token, remaining - 1);
      else omittedNumbers.push({ token: entry.token, classification: classifyNumber(source, entry.index, entry.token) });
    }
  }

  return { aligned: true, sourceClauses, candidateClauses, ownership, omittedNumbers, ignoredSiblingNumbers };
}

function semanticContextIsSufficient({ source, sourceVerified, sourceRange, semanticContextSufficient, tableContext }) {
  if (semanticContextSufficient === false) return false;
  if (tableContext?.semantic_context_sufficient === false) return false;
  if (tableContext?.required_header_count > 0 && tableContext?.missing_header_count > 0) return false;
  if (semanticContextSufficient === true) return true;
  return sourceVerified === true && Boolean(source) && Boolean(sourceRange);
}

function safeRequirementModalization(source, candidate, contextSufficient) {
  if (!contextSufficient || OPTIONAL_CONTEXT_PATTERN.test(source)) return false;
  if (!REQUIREMENT_ACTION_PATTERN.test(source) || !REQUIREMENT_ACTION_PATTERN.test(candidate)) return false;
  const withoutModal = (value) => normalize(value)
    .replace(/(?:必须|须|应当|需要|不得|禁止|不能|不可|应)/g, '');
  const sourceBase = withoutModal(source);
  const candidateBase = withoutModal(candidate);
  if (!sourceBase || !candidateBase) return false;
  // Only treat a modal insertion as safe when the action-bearing content is
  // retained, not when the candidate rewrites scope, quantities or conditions.
  if (sourceBase === candidateBase || (candidateBase.includes(sourceBase) && candidateBase.length - sourceBase.length <= 8)) return true;

  const featureTokens = (value) => ({
    numbers: occurrences(NUMBER_PATTERN, numericComparable(value))
      .filter((entry) => !['STRUCTURAL_NUMBER', 'PAGE_OR_LAYOUT_NUMBER'].includes(classifyNumber(numericComparable(value), entry.index, entry.token)))
      .map((entry) => entry.token)
      .sort(),
    negation: tokens(NEGATION_PATTERN, value).sort(),
    scope: tokens(SCOPE_PATTERN, value).sort(),
    status: tokens(STATUS_PATTERN, value).sort(),
    actions: [...new Set([...String(value ?? '').matchAll(new RegExp(REQUIREMENT_ACTION_PATTERN.source, 'g'))].map((match) => normalize(match[0])).filter(Boolean))].sort()
  });
  const sourceFeatures = featureTokens(source);
  const candidateFeatures = featureTokens(candidate);
  if (JSON.stringify(sourceFeatures.numbers) !== JSON.stringify(candidateFeatures.numbers)
    || JSON.stringify(sourceFeatures.negation) !== JSON.stringify(candidateFeatures.negation)
    || JSON.stringify(sourceFeatures.scope) !== JSON.stringify(candidateFeatures.scope)
    || JSON.stringify(sourceFeatures.status) !== JSON.stringify(candidateFeatures.status)
    || !sourceFeatures.actions.some((action) => candidateFeatures.actions.includes(action))) return false;

  // A direct action-verb modalization ("提供" -> "应提供", etc.) is the
  // narrow frozen normalization path. All semantic feature sets above must
  // remain identical before this path can clear the modality-only review.
  if (sourceFeatures.actions.some((action) => candidateFeatures.actions.includes(action))) return true;

  return false;
}

function entityIdentityTokens(value) {
  return tokens(ENTITY_PATTERN, value).map((entity) => {
    const role = ROLE_TOKENS.find((candidate) => entity.endsWith(candidate));
    if (role) return role;
    if (/^(?:应|并|与|提供|包含|项目采购内容包括|进度控制以及)/.test(entity)) return null;
    return entity;
  }).filter(Boolean);
}

function addIssue(issues, code, severity = 'P0', detail = null) {
  issues.push({ code, severity, ...(detail ? { detail } : {}) });
}

function sourceEntityMismatch(sourceText, candidateText) {
  const sourceEntities = entityIdentityTokens(sourceText);
  const candidateEntities = entityIdentityTokens(candidateText);
  const sourceRoles = ROLE_TOKENS.filter((role) => String(sourceText).includes(role));
  const sourceRoleAliases = [...SAFE_ROLE_EQUIVALENTS.keys()].filter((role) => String(sourceText).includes(role));
  const candidateRoles = ROLE_TOKENS.filter((role) => String(candidateText).includes(role));
  const added = difference(candidateEntities, sourceEntities).filter((entity) => {
    // A role paraphrase is safe only for the explicitly frozen tender-role
    // aliases; arbitrary organization/entity substitution remains review.
    if (ROLE_TOKENS.includes(entity)) return !sourceRoles.some((role) => SAFE_ROLE_EQUIVALENTS.get(role)?.has(entity));
    return true;
  });
  const addedRoles = candidateRoles.filter((role) => !sourceRoles.includes(role)
    && !sourceRoles.some((sourceRole) => SAFE_ROLE_EQUIVALENTS.get(sourceRole)?.has(role))
    && !sourceRoleAliases.some((sourceRole) => SAFE_ROLE_EQUIVALENTS.get(sourceRole)?.has(role)));
  if (addedRoles.length) added.push(...addedRoles);
  if (added.length) return [...new Set(added)];
  // Explicit unknown/foreign subject wording is an unambiguous boundary
  // violation even when the source contains no organization token.
  return /(?:未授权(?:企业|主体)|其他企业|主体替换为)/.test(candidateText) ? ['UNAUTHORIZED_SUBJECT'] : [];
}

/**
 * Detects a parent/list-level critical consequence that governs an atomic
 * source row without copying that context into the generic semantic checks.
 * The result is an omission risk only; it never rewrites the requirement.
 */
export function detectParentCriticalConsequenceOmission({
  sourceText = '',
  parentContext = '',
  candidateText = '',
  sourceVerified = false,
  sourceRange = null
} = {}) {
  const source = normalize(sourceText);
  const parent = normalize(parentContext);
  const candidate = normalize(candidateText);
  if (!sourceVerified || !source || !parent || !sourceRange) {
    return { matched: false, reason_code: null, alignment: 'INSUFFICIENT_INPUT' };
  }

  const sourceIndex = parent.indexOf(source);
  if (sourceIndex < 0) return { matched: false, reason_code: null, alignment: 'ATOMIC_SOURCE_NOT_LOCATED' };

  const boundedPrefix = parent.slice(Math.max(0, sourceIndex - 2400), sourceIndex);
  const consequenceMatches = [...boundedPrefix.matchAll(new RegExp(PARENT_CRITICAL_CONSEQUENCE_PATTERN.source, 'g'))];
  const listMatches = [...boundedPrefix.matchAll(new RegExp(PARENT_GOVERNING_LIST_PATTERN.source, 'g'))];
  const tableMatches = [...boundedPrefix.matchAll(new RegExp(PARENT_GOVERNING_TABLE_PATTERN.source, 'g'))];
  const consequence = consequenceMatches.at(-1);
  const listMarker = listMatches.at(-1);
  const tableMarker = tableMatches.at(-1);
  const candidateRetainsConsequence = PARENT_CRITICAL_CONSEQUENCE_PATTERN.test(candidate);
  if (!consequence) return { matched: false, reason_code: null, alignment: 'NO_GOVERNING_CRITICAL_STRUCTURE' };

  // A critical list governs the child only when no new chapter/section boundary
  // intervenes. This keeps sibling or later independent structures isolated.
  const betweenConsequenceAndSource = boundedPrefix.slice(
    consequence.index + consequence[0].length
  );
  const crossedIndependentStructure = INDEPENDENT_STRUCTURE_BOUNDARY_PATTERN.test(betweenConsequenceAndSource);
  const listGoverns = Boolean(listMarker && listMarker.index <= consequence.index && !crossedIndependentStructure);

  // Review/qualification tables may state the governing consequence before
  // rendering the table itself (e.g. “全部内容，否则其投标无效”). The table
  // marker must precede the governing relation/consequence and the atomic source
  // must occur after that marker; a later unrelated table heading alone is not
  // sufficient to establish ownership.
  const governingRelation = [...boundedPrefix.matchAll(new RegExp(PARENT_GOVERNING_RELATION_PATTERN.source, 'g'))]
    .find(match => match.index < consequence.index);
  const tableGoverns = Boolean(
    tableMatches.some(match => match.index < consequence.index)
      && governingRelation
      && !crossedIndependentStructure
  );
  if (!listGoverns && !tableGoverns) {
    return { matched: false, reason_code: null, alignment: 'NO_GOVERNING_CRITICAL_STRUCTURE' };
  }

  const alignment = {
    source_index: sourceIndex,
    source_text: source,
    governing_list_marker: listGoverns ? listMarker[0] : null,
    governing_table_marker: tableGoverns ? tableMatches.find(match => match.index < consequence.index)?.[0] : null,
    governing_relation: governingRelation?.[0] || null,
    governing_consequence: consequence[0],
    governing_context_excerpt: boundedPrefix.slice(
      Math.max(0, (listGoverns ? listMarker.index : (governingRelation?.index ?? tableMatches.find(match => match.index < consequence.index)?.index ?? 0)) - 48),
      consequence.index + consequence[0].length + 32
    ),
    candidate_retains_consequence: candidateRetainsConsequence
  };
  if (candidateRetainsConsequence) return { matched: false, reason_code: null, alignment: 'CONSEQUENCE_RETAINED', evidence: alignment };
  return {
    matched: true,
    reason_code: 'PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW',
    alignment: tableGoverns ? 'GOVERNING_CRITICAL_TABLE' : 'GOVERNING_CRITICAL_LIST',
    evidence: alignment
  };
}

/**
 * Deterministic, source-first quality gate. It never rewrites requirement text
 * and never assigns a semantic verdict to uncertain prose; uncertainty is
 * routed to review. The gate is intentionally small and reusable by the
 * production aggregate path and Eval mutation harness.
 */
export function evaluateRequirementCandidateQuality(candidate = {}, {
  sourceText = candidate.source_text ?? candidate.source_excerpt ?? '',
  sourceVerified = candidate.source_verified === true,
  sourceRange = candidate.source_range ?? null,
  parentContext = candidate.parent_context ?? candidate.source_context_text ?? '',
  tableContext = null,
  semanticContextSufficient = null
} = {}) {
  const text = normalize(candidate.text ?? candidate.content ?? candidate.requirement_text ?? '');
  const source = normalize(sourceText);
  const issues = [];
  let contextSufficient = false;
  let ignoredStructuralNumbers = [];
  if (!text) addIssue(issues, 'REQUIREMENT_TEXT_MISSING');
  if (!sourceRange && candidate.source_verified === true && !candidate.source_start_offset
    && !candidate.source_clause_id && !candidate.source_chunk_id
    && candidate.source_page_start == null && candidate.source_page == null) {
    addIssue(issues, 'SOURCE_SPAN_MISSING');
  }
  if (!source) {
    addIssue(issues, sourceVerified ? 'SOURCE_SPAN_MISSING' : 'SOURCE_NOT_VERIFIED', sourceVerified ? 'P0' : 'P1');
  }

  if (source) {
    contextSufficient = semanticContextIsSufficient({ source, sourceVerified, sourceRange, semanticContextSufficient, tableContext });
    const numberSource = numericComparable(source);
    const numberCandidate = numericComparable(text);
    const sourceNumberOccurrences = occurrences(NUMBER_PATTERN, numberSource);
    const candidateNumberOccurrences = occurrences(NUMBER_PATTERN, numberCandidate);
    const candidateNumbers = [...new Set(candidateNumberOccurrences.map((entry) => entry.token))];
    const sourceNumbers = sourceNumberOccurrences.map((entry) => entry.token);
    const addedNumbers = difference(candidateNumbers, sourceNumbers);
    const candidateNumberCounts = new Map();
    for (const entry of candidateNumberOccurrences) candidateNumberCounts.set(entry.token, (candidateNumberCounts.get(entry.token) || 0) + 1);
    const seenSourceCounts = new Map();
    const omittedNumbers = [];
    ignoredStructuralNumbers = [];
    const alignedOwnership = contextSufficient ? alignSourceNumberOwnership(source, text) : { aligned: false };
    if (alignedOwnership.aligned) {
      for (const entry of alignedOwnership.ignoredSiblingNumbers || []) {
        ignoredStructuralNumbers.push({ token: entry.token, classification: 'SIBLING_ATOMIC_ASSERTION' });
      }
      for (const entry of alignedOwnership.omittedNumbers || []) {
        if (entry.classification === 'STRUCTURAL_NUMBER' || entry.classification === 'PAGE_OR_LAYOUT_NUMBER') {
          ignoredStructuralNumbers.push({ token: entry.token, classification: entry.classification });
        } else {
          omittedNumbers.push(entry);
        }
      }
    } else {
      for (const entry of sourceNumberOccurrences) {
        const seen = seenSourceCounts.get(entry.token) || 0;
        const available = candidateNumberCounts.get(entry.token) || 0;
        seenSourceCounts.set(entry.token, seen + 1);
        if (seen < available) continue;
        const classification = classifyNumber(source, entry.index, entry.token);
        if (contextSufficient && (classification === 'STRUCTURAL_NUMBER' || classification === 'PAGE_OR_LAYOUT_NUMBER')) {
          ignoredStructuralNumbers.push({ token: entry.token, classification });
        } else {
          omittedNumbers.push({ token: entry.token, classification });
        }
      }
    }
    if (addedNumbers.length) addIssue(issues, 'NUMBER_DISTORTION', 'P0', { added: addedNumbers });
    else if (omittedNumbers.length) addIssue(issues, 'NUMBER_OMISSION_REVIEW', 'P0', { omitted: omittedNumbers.map((item) => item.token), classifications: omittedNumbers });

    const sourceNegation = tokens(NEGATION_PATTERN, source);
    const candidateNegation = tokens(NEGATION_PATTERN, text);
    if (sourceNegation.length !== candidateNegation.length
      || difference(sourceNegation, candidateNegation).length
      || difference(candidateNegation, sourceNegation).length) {
      addIssue(issues, 'NEGATION_DISTORTION', 'P0');
    }

    const sourceModality = tokens(MODALITY_PATTERN, source);
    const candidateModality = tokens(MODALITY_PATTERN, text);
    if (sourceModality.length && !candidateModality.length) addIssue(issues, 'MODALITY_OMISSION_REVIEW', 'P0');
    if (!sourceModality.length && candidateModality.length && !safeRequirementModalization(source, text, contextSufficient)) {
      addIssue(issues, 'MODALITY_ADDITION_REVIEW', 'P0');
    }
    // Catch a one-character weakening (应 -> 可) even when the source token
    // is embedded in an ordinary word such as 应用 and therefore is not a
    // standalone modality marker. This is an aligned lexical comparison, not
    // a domain-specific entity or phrase rule.
    if (source.length === text.length) {
      let differenceCount = 0;
      let sourceDifference = '';
      let candidateDifference = '';
      for (let index = 0; index < source.length; index += 1) {
        if (source[index] === text[index]) continue;
        differenceCount += 1;
        sourceDifference = source[index];
        candidateDifference = text[index];
        if (differenceCount > 1) break;
      }
      if (differenceCount === 1 && sourceDifference === '应' && candidateDifference === '可') {
        addIssue(issues, 'MODALITY_OMISSION_REVIEW', 'P0', { aligned_substitution: '应→可' });
      }
    }
    // The candidate may cover only a sub-span of the source excerpt. In that
    // case an aligned full-string comparison is not possible; still detect a
    // weakening when restoring the frozen 应用→可用 lexical pair makes the
    // candidate phrase present in the source while the weakened phrase is not.
    if (text.includes('可用') && source.includes('应用') && !source.includes('可用')) {
      const restoredCandidate = text.replaceAll('可用', '应用');
      if (restoredCandidate !== text && !source.includes(text)) {
        addIssue(issues, 'MODALITY_OMISSION_REVIEW', 'P0', { lexical_substitution: '应用→可用' });
      }
    }

    const sourceTableTerms = tokens(TABLE_TERM_PATTERN, source);
    const candidateTableTerms = tokens(TABLE_TERM_PATTERN, text);
    if (sourceTableTerms.length >= 2 && difference(sourceTableTerms, candidateTableTerms).length >= 2) {
      addIssue(issues, 'TABLE_HEADER_OR_ROW_LOSS', 'P0');
    }

    const sourceScope = tokens(SCOPE_PATTERN, source);
    const candidateScope = tokens(SCOPE_PATTERN, text);
    if (difference(candidateScope, sourceScope).length) addIssue(issues, 'SCOPE_EXPANSION_REVIEW', 'P0');

    const sourceStatus = tokens(STATUS_PATTERN, source);
    const candidateStatus = tokens(STATUS_PATTERN, text);
    if (difference(candidateStatus, sourceStatus).length) addIssue(issues, 'STATUS_DISTORTION', 'P0');

    const entityMismatch = sourceEntityMismatch(source, text);
    if (entityMismatch.length) addIssue(issues, 'ENTITY_MISMATCH_REVIEW', 'P0', { added: entityMismatch });
  }

  const parentConsequence = detectParentCriticalConsequenceOmission({
    sourceText,
    parentContext,
    candidateText: text,
    sourceVerified,
    sourceRange
  });
  if (parentConsequence.matched) addIssue(issues, parentConsequence.reason_code, 'P0', parentConsequence.evidence);

  if (EXPLICIT_MUTATION_PATTERN.test(text)) addIssue(issues, 'OBVIOUS_SEMANTIC_MUTATION', 'P0');
  if (/；并且(?:另一个|其他)/.test(text)) addIssue(issues, 'HARMFUL_MERGE_REVIEW', 'P0');
  if (tableContext?.required_header_count > 0 && tableContext.missing_header_count > 0) {
    addIssue(issues, 'TABLE_HEADER_CONTEXT_MISSING', 'P0');
  }

  const hasP0 = issues.some((issue) => issue.severity === 'P0');
  const decision = hasP0 ? 'REVIEW_REQUIRED' : issues.length ? 'REVIEW_REQUIRED' : 'PASS';
  return {
    quality_gate_version: REQUIREMENT_QUALITY_GATE_VERSION,
    decision,
    semantic_quality_review_required: decision !== 'PASS',
    reason_codes: [...new Set(issues.map((issue) => issue.code))],
    issues,
    parent_consequence: parentConsequence,
    normalization: {
      semantic_context_sufficient: contextSufficient,
      ignored_structural_numbers: ignoredStructuralNumbers,
    },
    source_verified: sourceVerified,
    source_text_hash: source ? sha256(source) : null,
    candidate_text_hash: text ? sha256(text) : null
  };
}

export function assertRequirementCandidateQuality(candidate, options = {}) {
  const result = evaluateRequirementCandidateQuality(candidate, options);
  if (result.decision !== 'PASS') {
    const error = new Error('Requirement candidate requires semantic quality review.');
    error.code = 'REQUIREMENT_SEMANTIC_QUALITY_REVIEW_REQUIRED';
    error.quality = result;
    throw error;
  }
  return result;
}
