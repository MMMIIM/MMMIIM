import { createHash } from 'node:crypto';

/**
 * Deterministic routing metadata for Requirement Extraction.
 *
 * This is intentionally a small, conservative boundary helper.  It does not
 * delete source text or make a semantic/model decision: sections and clauses
 * that cannot be classified safely remain UNKNOWN and stay eligible for the
 * Requirement Extraction input.
 */

export const REQUIREMENT_SCOPE_ROLES = Object.freeze([
  'REQUIREMENT_ELIGIBLE',
  'SCORING',
  'QUALIFICATION',
  'COMMERCIAL',
  'PROCUREMENT',
  'LEGAL',
  'UNKNOWN'
]);

const ELIGIBLE_ROLES = new Set(['REQUIREMENT_ELIGIBLE', 'UNKNOWN']);
const EXCLUDED_ONLY_ROLES = new Set(['SCORING', 'QUALIFICATION', 'COMMERCIAL', 'PROCUREMENT', 'LEGAL']);

// These patterns describe a section's purpose, not an individual keyword in
// a requirement.  A section must be strongly identifiable before it is routed
// away from Requirement Extraction.
const SECTION_ROLE_PATTERNS = Object.freeze({
  SCORING: /(?:评标|评审|评分|得分).{0,12}(?:方法|标准|办法|细则|表|项)/,
  QUALIFICATION: /(?:投标人|供应商).{0,12}(?:资格|资质|条件|须知|前附表)|(?:营业执照|资质证书|类似业绩|资格审查)/,
  COMMERCIAL: /(?:商务|报价|价格|价款|付款|支付|税率|结算).{0,12}(?:要求|条款|说明|方式|表)/,
  PROCUREMENT: /(?:采购|投标|招标).{0,12}(?:邀请|公告|文件|流程|程序|截止|开标|递交|格式|组成)|(?:投标保证金|响应文件)/,
  LEGAL: /(?:合同|协议|法律责任|违约|赔偿|争议|知识产权|保密责任).{0,12}(?:条款|责任|约定|解决|协议)?/
});

const CLAUSE_ROLE_PATTERNS = Object.freeze({
  SCORING: /(?:评分|评标|评审|得分|分值|权重|加分项|扣分项)/,
  QUALIFICATION: /(?:资格审查|资质要求|营业执照|供应商须知|投标人须知|注册资本|类似业绩|认证证书|信用(?:信息)?查询|失信被执行人|严重违法失信|黑名单|资格(?:条件|要求))/,
  COMMERCIAL: /(?:报价|投标价|合同价|付款|支付|税率|结算|预算金额|最高限价|商务条款|服务费|发票|请款|包干制)/,
  PROCUREMENT: /(?:投标截止|递交投标|开标时间|采购流程|投标保证金|响应文件格式|采购代理|准备和参加投标.*费用|投标.*费用|采购过程)/,
  LEGAL: /(?:违约责任|赔偿责任|争议解决|法律责任|知识产权归属|知识产权.*侵害|侵害知识产权|保密义务|合同生效|终止合同|解除合同|违约金|经济损失)/
});

const OBLIGATION_PATTERN = /(?:必须|应当|应|须|不得|需提供|提供|支持|达到|不低于|不少于|完成|负责|保证|满足|符合)/;
const PURE_EXCLUDED_PATTERN = /(?:评分|评标|评审|得分|分值|权重|报价|投标价|付款|支付|税率|结算|投标截止|开标时间|投标保证金|资格审查|资质要求|营业执照|违约责任|赔偿责任|争议解决)/;
const TECHNICAL_OBJECT_PATTERN = /(?:系统|平台|接口|功能|性能|容量|数据|部署|环境|安全|服务|运维|响应时间|到达时间|解决时间|验收|测试|培训|交付)/;
const BIDDER_ACTOR_PATTERN = /(?:投标人|投标单位|供应商|响应方|报价人|中标人|乙方|服务方|承包方|拟派项目团队)/;
const BIDDER_SUBJECT_PATTERN = /(?:投标人|供应商|响应方|报价人|中标人|乙方|服务方|承包方|拟派项目团队|投标文件|响应文件|报价文件|技术方案|投标报价|投标价|投标产品|投标响应)/;
const BIDDER_ACTION_PATTERN = /(?:必须|应当|应|须|不得|需提供|提供|提交|递交|签署|签字|盖章|报价|承诺|承担|完成|履行|保证|满足|符合|缴纳|交付|验收|维护|保修|响应|恢复|达到|不低于|不少于|不超过|超过|列入|不接受|不允许|不响应|确认参加投标|修改|含有|选择性)/;
const BIDDER_CONSEQUENCE_PATTERN = /(?:无效|废标|不予受理|拒绝|取消资格|不得参加|不能通过|违约|违约金|罚款|扣除|承担[^。；]{0,20}责任|赔偿|不接受|不允许|不得参与)/;
const BIDDER_PERFORMANCE_CONTEXT_PATTERN = /(?:合同|履约|交付|实施|验收|服务|运维|维护|保修|响应时间|解决时间|恢复服务|SLA)/i;
const BIDDER_CONTEXT_PATTERN = /(?:投标|供应商|响应文件|投标文件|资格|资质|信用|联合体|报价|合同|付款|履约|解密|有效期|签署|盖章|开标一览表|报价明细表|机器码|创建标识码|认证)/;
const NON_APPLICABILITY_MARKER_PATTERN = /(?:本项目(?:不涉及|不适用|无需|无须|不要求)|(?:金额|形式|有效期|份额|产品|服务期限|交付期限|工期|资质|认证)[^。；]{0,12}(?:不涉及|不适用|无需|无须|不要求))/;
// These are broad obligation topics, not tender-specific source rules.  An
// explicit non-applicability marker only affects a candidate when the marker
// and candidate share one of these stable topic tokens.  Active prohibitions
// (不得/不允许/不应) intentionally do not appear here.
const NON_APPLICABILITY_TOPIC_PATTERNS = Object.freeze([
  ['GUARANTEE', /投标保证金|履约保证金|保证金/],
  ['SUBCONTRACT', /分包/],
  ['JOINT_BID', /联合体/],
  ['IMPORT_PRODUCT', /进口产品|进口设备/],
  ['QUALIFICATION', /资格|资质|营业执照|认证证书/],
  ['DELIVERY', /交付期限|服务期限|工期/],
  ['PAYMENT', /付款|支付|结算/]
]);
// Bare “电话/地址” tokens can be part of a bidder obligation (for example,
// the service hotline the supplier must provide).  Require the structural
// contact labels used by buyer metadata so those obligations remain visible.
const BUYER_ADMIN_PATTERN = /(?:采购人|招标人|评审委员会|代理机构).{0,12}(?:联系人|联系电话|联系地址|通讯地址|邮编|邮箱|组织评审|评审时间|开标时间|日程)/;
const BUYER_AUTHORITY_ACTOR_PATTERN = /(?:采购人|招标人|评审委员会|代理机构)/;
const BUYER_ONLY_ACTION_PATTERN = /(?:应|须|负责|退还|组织|支付|通知|确定|处理|办理|收取|发布)/;
const PROCEDURAL_ADMIN_ONLY_PATTERN = /(?:投标截止时间|开标时间|评审时间|递交时间|报名时间|联系人|联系电话|电话|地址|邮编|邮箱|采购代理机构)/;
const PURE_DEFINITION_PATTERN = /^(?:本文件|本项目|本合同|本文|企业定义|术语定义|以下简称|定义|释义).{0,30}(?:是指|系指|指的是|以下简称)/;
const STRUCTURAL_ELIGIBLE_PATTERN = /(?:技术|功能|性能|服务级别|服务要求|运维|部署|安全|接口|验收|测试|培训|交付)/;
const STRUCTURAL_SCORING_PATTERN = /(?:评分|评标|评审|得分|分值|权重|评分标准|评审标准)/;
const CHAPTER_HEADING_PATTERN = /^第\s*[一二三四五六七八九十百千万\d]+\s*章(?:\s|$)/;
const CHINESE_SUBSECTION_HEADING_PATTERN = /^[一二三四五六七八九十百千万]+、/;
const PROCUREMENT_POLICY_HEADING_PATTERN = /(?:落实|政府)采购政策/;
const PROCUREMENT_POLICY_SECTION_PATTERN = /《\s*采购需求\s*》/;
const SCORING_LEVEL_PATTERN = /^(?:第[一二三四五六七八九十百千万\d]+等次)[：:]/;
const SCORING_TITLE_PATTERN = /^(?:（\d+）|\(?\d+\)?)[^：:]*$/;
const NUMERIC_HEADING_PATTERN = /^\d+(?:\.\d+)*\s+\S+/;
const QUALIFICATION_BLOCK_PATTERN = /(?:资格|资质|营业执照|项目负责人.*能力|证书复印件|证书扫描件)/;
const PAGE_MARKER_PATTERN = /^\d{1,3}$/;

function textOf(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function nonApplicabilityTopics(value) {
  const text = textOf(value);
  return new Set(NON_APPLICABILITY_TOPIC_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([topic]) => topic));
}

function hasExplicitNonApplicability(value) {
  const text = textOf(value);
  // Conditional template language ("如本项目…无需…") is not a project
  // decision.  Keep such candidates for high-recall review instead of
  // treating the conditional branch as an observed non-applicability fact.
  if (/(?:如|若)\s*本项目/.test(text)) return false;
  return NON_APPLICABILITY_MARKER_PATTERN.test(text);
}

function explicitRole(value) {
  const role = String(value || '').trim().toUpperCase();
  return REQUIREMENT_SCOPE_ROLES.includes(role) ? role : null;
}

function roleFromPattern(value, patterns) {
  const text = textOf(value);
  const matches = Object.entries(patterns).filter(([, pattern]) => pattern.test(text)).map(([role]) => role);
  return matches.length === 1 ? matches[0] : null;
}

function rolesFromPattern(value, patterns) {
  const text = textOf(value);
  return Object.entries(patterns)
    .filter(([, pattern]) => pattern.test(text))
    .map(([role]) => role);
}

function paragraphStructuralText(paragraph = {}) {
  return textOf(
    paragraph.source_section
      || paragraph.source_section_title
      || paragraph.detected_section_title
      || paragraph.heading_text
      || paragraph.text
  );
}

function isScoringLevel(paragraph = {}) {
  return SCORING_LEVEL_PATTERN.test(textOf(paragraph.text));
}

function isScoringTitle(paragraph = {}) {
  const text = textOf(paragraph.text);
  return SCORING_TITLE_PATTERN.test(text) || NUMERIC_HEADING_PATTERN.test(text);
}

/**
 * Derive only high-confidence structural exclusions from the already parsed
 * provenance.  These signals are intentionally container/heading based:
 * a single keyword in an otherwise technical sentence is never sufficient.
 */
function structuralScopeRoles(paragraphs = []) {
  const roles = Array(paragraphs.length).fill(null);

  // A source section rendered as 《采购需求》。 is the policy chapter in the
  // certified parser output. Keep the evidence tied to that structural title.
  paragraphs.forEach((paragraph, index) => {
    if (PROCUREMENT_POLICY_SECTION_PATTERN.test(paragraphStructuralText(paragraph))) {
      roles[index] = 'PROCUREMENT';
    }
  });

  // Within a broad “采购需求” section, preserve the explicit policy heading
  // boundary instead of letting the section-level eligible fallback win.
  let policySubsection = false;
  paragraphs.forEach((paragraph, index) => {
    const text = textOf(paragraph.text);
    if (CHINESE_SUBSECTION_HEADING_PATTERN.test(text)) {
      policySubsection = PROCUREMENT_POLICY_HEADING_PATTERN.test(text);
      if (policySubsection) roles[index] = 'PROCUREMENT';
      return;
    }
    if (policySubsection) roles[index] = 'PROCUREMENT';
  });

  // A run of 第一等次/第二等次/... is a scoring container. Include the
  // immediately preceding structural title and organization intro so a
  // model range cannot straddle an eligible paragraph and evade the scope
  // boundary. Qualification certificates use the same container shape but
  // retain the more specific QUALIFICATION role.
  let index = 0;
  while (index < paragraphs.length) {
    if (!isScoringLevel(paragraphs[index])) {
      index += 1;
      continue;
    }
    const firstLevel = index;
    let start = firstLevel;
    let cursor = firstLevel - 1;
    while (cursor >= 0) {
      const text = textOf(paragraphs[cursor].text);
      const immediate = firstLevel - cursor;
      const isIntro = /编制[^\n]{0,20}组织方案/.test(text) && immediate <= 4;
      if (isScoringTitle(paragraphs[cursor]) || isIntro) {
        start = cursor;
        cursor -= 1;
        continue;
      }
      break;
    }

    let end = firstLevel;
    let levelCount = 1;
    cursor = firstLevel + 1;
    while (cursor < paragraphs.length) {
      const text = textOf(paragraphs[cursor].text);
      if (isScoringLevel(paragraphs[cursor])) {
        levelCount += 1;
        end = cursor;
        cursor += 1;
        continue;
      }
      if (PAGE_MARKER_PATTERN.test(text)
        || /^(?:注[：:]|说明[：:])/.test(text)
        || (levelCount > 1 && QUALIFICATION_BLOCK_PATTERN.test(text))) {
        end = cursor;
        cursor += 1;
        continue;
      }
      if (SCORING_TITLE_PATTERN.test(text)) break;
      if (CHINESE_SUBSECTION_HEADING_PATTERN.test(text)
        || CHAPTER_HEADING_PATTERN.test(text)) break;
      // Continuation lines immediately after a scoring level belong to the
      // same row; stop only once a new structural heading is encountered.
      const previousText = textOf(paragraphs[cursor - 1]?.text);
      const continuation = previousText
        && !/[。；;：:！？]$/.test(previousText)
        && !/^(?:系统|平台|服务|供应商|本项目|合同|应|必须|不得|须)/.test(text);
      if (levelCount > 0 && cursor === end + 1 && text
        && !NUMERIC_HEADING_PATTERN.test(text) && continuation) {
        end = cursor;
        cursor += 1;
        continue;
      }
      break;
    }
    if (levelCount >= 2) {
      const blockText = paragraphs.slice(start, end + 1).map((paragraph) => textOf(paragraph.text)).join('\n');
      const role = QUALIFICATION_BLOCK_PATTERN.test(blockText) ? 'QUALIFICATION' : 'SCORING';
      for (let pointer = start; pointer <= end; pointer += 1) {
        // A stronger policy subsection signal remains authoritative.
        if (roles[pointer] !== 'PROCUREMENT') roles[pointer] = role;
      }
    }
    index = Math.max(cursor, firstLevel + 1);
  }
  return roles;
}

/**
 * Classify a section conservatively.  Metadata supplied by an upstream parser
 * wins; otherwise the existing classifier's section key/archive role is used
 * as a stable structural signal.
 */
export function classifyRequirementSectionRole(section = {}) {
  const explicit = explicitRole(section.routing_role || section.scope_role || section.requirement_role);
  if (explicit) return explicit;
  if (section.section_key === 'technical_requirements'
    || section.archive_role === 'requirement_extraction') return 'REQUIREMENT_ELIGIBLE';
  if (section.section_key === 'evaluation_method'
    || section.archive_role === 'scoring_point_candidate') return 'SCORING';
  if (section.section_key === 'bidder_instructions'
    || section.archive_role === 'compliance_rule_candidate') return 'QUALIFICATION';
  if (section.section_key === 'contract'
    || section.archive_role === 'delivery_constraint_candidate') return 'LEGAL';
  if (section.section_key === 'tender_invitation'
    || section.section_key === 'bid_document_format'
    || section.archive_role === 'word_template_candidate') return 'PROCUREMENT';
  return roleFromPattern(section.title || section.heading_text || section.content_text, SECTION_ROLE_PATTERNS) || 'UNKNOWN';
}

/**
 * Classify a clause only when the text is unambiguously out of scope.  A mixed
 * clause containing both an excluded phrase and an obligation is UNKNOWN so
 * its substantive requirement is preserved for review.
 */
export function classifyRequirementClauseRole(paragraph = {}, { sectionRole = 'UNKNOWN' } = {}) {
  const explicit = explicitRole(paragraph.routing_role || paragraph.scope_role || paragraph.requirement_role);
  if (explicit) return explicit;
  const text = textOf(paragraph.text);
  const structuralContext = textOf(
    paragraph.clause_title
      || paragraph.source_clause_title
      || paragraph.heading_text
  );
  if (!text) return 'UNKNOWN';
  // A parser-provided clause title is stronger structural evidence than
  // ordinary clause wording. It may safely route score/evaluation sections,
  // while the mixed-clause safeguard below still protects unlabelled text.
  if (STRUCTURAL_SCORING_PATTERN.test(structuralContext)) return 'SCORING';
  const matchedRoles = rolesFromPattern(text, CLAUSE_ROLE_PATTERNS);
  const role = matchedRoles.length === 1 ? matchedRoles[0] : null;
  if (matchedRoles.length > 1) {
    if (OBLIGATION_PATTERN.test(text) && TECHNICAL_OBJECT_PATTERN.test(text)) return 'UNKNOWN';
    if (matchedRoles.every((candidateRole) => EXCLUDED_ONLY_ROLES.has(candidateRole))) {
      // Multiple excluded signals still describe a non-requirement clause;
      // keep a deterministic category for audit metadata rather than allowing
      // a REQUIREMENT_ELIGIBLE section fallback to retain it.
      return matchedRoles.includes('LEGAL') ? 'LEGAL' : matchedRoles[0];
    }
    return 'UNKNOWN';
  }
  if (STRUCTURAL_ELIGIBLE_PATTERN.test(structuralContext)
    && OBLIGATION_PATTERN.test(text)
    && !role) {
    return 'REQUIREMENT_ELIGIBLE';
  }
  if (!role) {
    if (sectionRole === 'REQUIREMENT_ELIGIBLE') return 'REQUIREMENT_ELIGIBLE';
    // A known excluded chapter heading is structural context for that
    // section, not an unknown requirement clause. Keep the archive intact but
    // do not route the heading into Requirement Extraction.
    if (CHAPTER_HEADING_PATTERN.test(text)) return sectionRole;
    return 'UNKNOWN';
  }
  // Do not discard mixed clauses: they may carry an actual technical or
  // delivery obligation alongside a rubric/policy phrase.
  if (OBLIGATION_PATTERN.test(text) && TECHNICAL_OBJECT_PATTERN.test(text)) return 'UNKNOWN';
  if (OBLIGATION_PATTERN.test(text) && PURE_EXCLUDED_PATTERN.test(text)) return role;
  return role;
}

/**
 * Decide whether a paragraph from a non-scoring section is a bidder-facing
 * obligation.  This is a structural boundary rule only: it requires an
 * actor/subject plus an action or consequence, and never infers a new
 * requirement from a business keyword alone.
 */
export function isBidderFacingRequirementParagraph(paragraph = {}, { sectionRole = 'UNKNOWN' } = {}) {
  const text = textOf(paragraph.text);
  if (!text || explicitRole(paragraph.routing_role) === 'SCORING') return false;
  if (BUYER_ADMIN_PATTERN.test(text) || PURE_DEFINITION_PATTERN.test(text)) return false;
  const role = explicitRole(paragraph.routing_role) || sectionRole;
  const bidderActorOrSubject = BIDDER_ACTOR_PATTERN.test(text) || BIDDER_SUBJECT_PATTERN.test(text);
  const action = BIDDER_ACTION_PATTERN.test(text);
  const consequence = BIDDER_CONSEQUENCE_PATTERN.test(text);
  if (BIDDER_CONTEXT_PATTERN.test(text)
    && !BUYER_ADMIN_PATTERN.test(text)
    && (!PROCEDURAL_ADMIN_ONLY_PATTERN.test(text) || action || consequence || bidderActorOrSubject)) return true;
  if (['QUALIFICATION', 'COMMERCIAL', 'PROCUREMENT', 'LEGAL'].includes(role)
    && /(?:付款方式|付款进度|合同价款支付|资格|资质|营业执照|证书|业绩|认证|行贿犯罪档案|信用|失信|报价|有效期|联合体|解密)/.test(text)
    && !BUYER_ADMIN_PATTERN.test(text)) return true;
  if (bidderActorOrSubject && (action || consequence)) return true;
  if (consequence && (action || BIDDER_PERFORMANCE_CONTEXT_PATTERN.test(text))) return true;
  if (action && ['QUALIFICATION', 'COMMERCIAL', 'PROCUREMENT', 'LEGAL'].includes(role)
    && (BIDDER_PERFORMANCE_CONTEXT_PATTERN.test(text) || /资格|资质|证书|业绩|认证/.test(text))) return true;
  return false;
}

function withRoutingMetadata(section) {
  const routingRole = classifyRequirementSectionRole(section);
  const rawParagraphs = Array.isArray(section.paragraphs)
    ? section.paragraphs.map((paragraph) => ({
      ...paragraph,
    }))
    : [];
  const structuralRoles = structuralScopeRoles(rawParagraphs);
  const paragraphs = rawParagraphs.map((paragraph, index) => {
    const existingRole = explicitRole(paragraph.routing_role);
    const explicitMetadataRole = explicitRole(paragraph.scope_role || paragraph.requirement_role);
    const structuralRole = structuralRoles[index];
    const broadFallback = existingRole === 'REQUIREMENT_ELIGIBLE' && !explicitMetadataRole;
    const classificationInput = broadFallback ? { ...paragraph, routing_role: null } : paragraph;
    const routing_role = structuralRole && (!explicitMetadataRole && (!existingRole || broadFallback))
      ? structuralRole
      : classifyRequirementClauseRole(classificationInput, { sectionRole: routingRole });
    return {
      ...paragraph,
      routing_role,
      ...(structuralRole ? { routing_reason: `STRUCTURAL_${structuralRole}` } : {})
    };
  });
  const eligibleParagraphs = paragraphs.filter((paragraph) => ELIGIBLE_ROLES.has(paragraph.routing_role));
  return {
    ...section,
    routing_role: routingRole,
    requirement_extraction_eligible: ELIGIBLE_ROLES.has(routingRole),
    paragraphs,
    requirement_paragraphs: eligibleParagraphs
  };
}

function requirementView(section, paragraphs) {
  const contentText = paragraphs.map((paragraph) => paragraph.text).join('\n');
  return {
    ...section,
    section_key: `${section.section_key}_requirement_view`,
    archive_role: 'requirement_extraction_routed_view',
    content_text: contentText,
    content_sha256: createHash('sha256').update(contentText).digest('hex'),
    character_count: contentText.length,
    source_start_page: paragraphs[0]?.page ?? null,
    source_end_page: paragraphs.at(-1)?.page ?? null,
    source_start_paragraph: paragraphs[0]?.paragraph ?? null,
    source_end_paragraph: paragraphs.at(-1)?.paragraph ?? null,
    source_start_offset: paragraphs[0]?.source_start_offset ?? 0,
    source_end_offset: paragraphs.at(-1)?.source_end_offset ?? 0,
    paragraphs
  };
}

function hasSharedStructuralBlock(previous, current, next) {
  const units = [previous, current, next];
  const structuralKeys = ['semantic_block_id', 'source_block_id', 'source_clause_id', 'clause_id'];
  const sharedKey = structuralKeys.find((key) => {
    const values = units.map((unit) => unit?.[key]);
    return values.every((value) => value != null)
      && values.every((value) => String(value) === String(values[0]));
  });
  if (!sharedKey) return false;

  const paragraphNumbers = units.map((unit) => unit?.paragraph);
  if (paragraphNumbers.every((value) => Number.isInteger(value))) {
    return paragraphNumbers[1] === paragraphNumbers[0] + 1
      && paragraphNumbers[2] === paragraphNumbers[1] + 1;
  }
  const offsets = units.map((unit) => [unit?.source_start_offset, unit?.source_end_offset]);
  if (offsets.every(([start, end]) => Number.isInteger(start) && Number.isInteger(end))) {
    return offsets[0][1] <= offsets[1][0] && offsets[1][1] <= offsets[2][0];
  }
  return false;
}

function protectInteriorExcludedFragments(paragraphs) {
  return paragraphs.map((paragraph, index) => {
    if (!EXCLUDED_ONLY_ROLES.has(paragraph.routing_role)) return paragraph;
    const previous = paragraphs[index - 1];
    const next = paragraphs[index + 1];
    if (!previous || !next
      || !ELIGIBLE_ROLES.has(previous.routing_role)
      || !ELIGIBLE_ROLES.has(next.routing_role)
      || !hasSharedStructuralBlock(previous, paragraph, next)) {
      return paragraph;
    }
    return {
      ...paragraph,
      routing_role: 'UNKNOWN',
      routing_reason: 'INTERIOR_FRAGMENT_PROTECTED'
    };
  });
}

function orderSourceParagraphs(paragraphs = []) {
  const indexed = (Array.isArray(paragraphs) ? paragraphs : [])
    .map((paragraph, index) => ({ paragraph, index }));
  indexed.sort((left, right) => {
    const leftStart = Number.isInteger(left.paragraph?.source_start_offset)
      ? left.paragraph.source_start_offset : Number.POSITIVE_INFINITY;
    const rightStart = Number.isInteger(right.paragraph?.source_start_offset)
      ? right.paragraph.source_start_offset : Number.POSITIVE_INFINITY;
    if (leftStart !== rightStart) return leftStart - rightStart;
    const leftEnd = Number.isInteger(left.paragraph?.source_end_offset)
      ? left.paragraph.source_end_offset : Number.POSITIVE_INFINITY;
    const rightEnd = Number.isInteger(right.paragraph?.source_end_offset)
      ? right.paragraph.source_end_offset : Number.POSITIVE_INFINITY;
    if (leftEnd !== rightEnd) return leftEnd - rightEnd;
    return left.index - right.index;
  });

  const seen = new Set();
  return indexed.filter(({ paragraph }) => {
    if (!Number.isInteger(paragraph?.source_start_offset)
      || !Number.isInteger(paragraph?.source_end_offset)) return true;
    const key = [
      paragraph.source_start_offset,
      paragraph.source_end_offset,
      String(paragraph.text || '')
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ paragraph }) => paragraph);
}

function structuralClauseKey(paragraph = {}) {
  return paragraph.source_clause_id ?? paragraph.source_block_id ?? paragraph.source_clause_id
    ?? paragraph.clause_id ?? null;
}

function isParagraphTerminated(paragraph = {}) {
  return /[。！？；;!?：:]$/.test(textOf(paragraph.text));
}

function isPageOrLayoutNoise(paragraph = {}) {
  const value = textOf(paragraph.text);
  return /^\d{1,3}$/.test(value) || /^[-—]?\s*\d+\s*[-—]?\s*$/.test(value);
}

function expandBidderFacingParagraphs(section, paragraphs) {
  const source = Array.isArray(section?.paragraphs) ? section.paragraphs : [];
  const selected = new Set(paragraphs);
  const selectedIndexes = new Set(source.map((paragraph, index) => (selected.has(paragraph) ? index : -1)).filter((index) => index >= 0));
  for (const initialIndex of [...selectedIndexes]) {
    let previousIndex = initialIndex;
    let traversedNoise = false;
    for (let index = initialIndex + 1; index < source.length; index += 1) {
      const paragraph = source[index];
      if (paragraph.routing_role === 'SCORING') break;
      const previous = source[previousIndex];
      const currentKey = structuralClauseKey(paragraph);
      const previousKey = structuralClauseKey(previous);
      if (isPageOrLayoutNoise(paragraph)) {
        traversedNoise = true;
        previousIndex = index;
        continue;
      }
      const sameClause = currentKey != null && previousKey != null && String(currentKey) === String(previousKey);
      if (!sameClause || isParagraphTerminated(previous)) break;
      if (BUYER_ADMIN_PATTERN.test(textOf(paragraph.text)) || PURE_DEFINITION_PATTERN.test(textOf(paragraph.text))) break;
      selected.add(paragraph);
      selectedIndexes.add(index);
      previousIndex = index;
      traversedNoise = false;
    }
    void traversedNoise;
  }
  return source.filter((paragraph) => selected.has(paragraph));
}

/**
 * Route already-classified sections to their existing consumers.  The source
 * archive remains complete; this only supplies an explicit destination view.
 * An excluded section with clearly eligible mixed clauses gets a derived view
 * while UNKNOWN is always retained rather than silently dropped.
 */
export function routeRequirementExtractionSections(sections = []) {
  const routedSections = (Array.isArray(sections) ? sections : []).map((section) => {
    const routed = withRoutingMetadata(section);
    const paragraphs = protectInteriorExcludedFragments(routed.paragraphs);
    return {
      ...routed,
      paragraphs,
      requirement_paragraphs: paragraphs.filter((paragraph) => ELIGIBLE_ROLES.has(paragraph.routing_role))
    };
  });
  const requirementSections = routedSections.flatMap((section) => {
    if (ELIGIBLE_ROLES.has(section.routing_role)) {
      if (!section.paragraphs.length) return [section];
      if (!section.requirement_paragraphs.length) return [];
      if (section.requirement_paragraphs.length === section.paragraphs.length) return [section];
      return [requirementView(section, section.requirement_paragraphs)];
    }
    if (!section.requirement_paragraphs.length) return [];
    return [requirementView(section, section.requirement_paragraphs)];
  });
  return Object.freeze({
    sections: routedSections,
    requirementSections,
    scoringSections: routedSections.filter((section) => section.routing_role === 'SCORING'),
    excludedSections: routedSections.filter((section) => !ELIGIBLE_ROLES.has(section.routing_role))
  });
}

/**
 * Produce the single ordered semantic scope consumed by Requirement
 * Extraction. Sections remain independently archived; this view only joins
 * eligible/unknown paragraphs in deterministic document order.
 */
export function combineRequirementExtractionSections(sections = [], options = {}) {
  const routed = routeRequirementExtractionSections(sections);
  // Diagnostics may explicitly request source-bearing compliance,
  // qualification, commercial and legal sections for coverage analysis.
  // Scoring-only sections remain excluded. The default keeps the historical
  // conservative view used by production callers that need only
  // requirement-eligible/unknown paragraphs.
  const sourceSections = options.includeNonScoringSections === true
    ? routed.sections
      .map((section) => {
        const scoringSection = section.routing_role === 'SCORING';
        const baseParagraphs = section.paragraphs.filter((paragraph) => (
          (!BUYER_ADMIN_PATTERN.test(textOf(paragraph.text))
            && !PURE_DEFINITION_PATTERN.test(textOf(paragraph.text)))
          && (isPageOrLayoutNoise(paragraph)
            || paragraph.routing_role !== 'SCORING'
            || isBidderFacingRequirementParagraph({ ...paragraph, routing_role: null }, { sectionRole: section.routing_role }))
          && (scoringSection
            ? isPageOrLayoutNoise(paragraph)
              || isBidderFacingRequirementParagraph({ ...paragraph, routing_role: null }, { sectionRole: section.routing_role })
            : ELIGIBLE_ROLES.has(paragraph.routing_role)
              || isBidderFacingRequirementParagraph({ ...paragraph, routing_role: null }, { sectionRole: section.routing_role }))
        ));
        const paragraphs = expandBidderFacingParagraphs(section, baseParagraphs);
        if (paragraphs.length === section.paragraphs.length) return section;
        return {
          ...section,
          paragraphs,
          content_text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
          content_sha256: createHash('sha256').update(paragraphs.map((paragraph) => paragraph.text).join('\n')).digest('hex'),
          character_count: paragraphs.reduce((total, paragraph) => total + String(paragraph.text || '').length, 0),
          source_start_page: paragraphs[0]?.page ?? null,
          source_end_page: paragraphs.at(-1)?.page ?? null,
          source_start_paragraph: paragraphs[0]?.paragraph ?? null,
          source_end_paragraph: paragraphs.at(-1)?.paragraph ?? null,
          source_start_offset: paragraphs[0]?.source_start_offset ?? 0,
          source_end_offset: paragraphs.at(-1)?.source_end_offset ?? 0
        };
      })
      .filter((section) => section.paragraphs.length > 0)
    : routed.requirementSections;
  const orderedSections = [...sourceSections]
    .sort((left, right) => (left.source_start_offset ?? 0) - (right.source_start_offset ?? 0));
  const paragraphs = orderSourceParagraphs(orderedSections.flatMap((section) => section.paragraphs || []));
  if (!paragraphs.length) return null;
  const contentText = paragraphs.map((paragraph) => paragraph.text).join('\n');
  return {
    section_key: 'requirement_extraction_scope',
    title: orderedSections.length === 1 ? orderedSections[0].title : '需求提取范围',
    archive_role: 'requirement_extraction_scope',
    content_text: contentText,
    content_sha256: createHash('sha256').update(contentText).digest('hex'),
    character_count: contentText.length,
    source_start_page: paragraphs[0]?.page ?? null,
    source_end_page: paragraphs.at(-1)?.page ?? null,
    source_start_paragraph: paragraphs[0]?.paragraph ?? null,
    source_end_paragraph: paragraphs.at(-1)?.paragraph ?? null,
    source_start_offset: paragraphs[0]?.source_start_offset ?? 0,
    source_end_offset: paragraphs.at(-1)?.source_end_offset ?? 0,
    paragraphs,
    source_sections: orderedSections.map((section) => section.section_key)
  };
}

export function isRequirementExtractionEligibleRole(role) {
  return ELIGIBLE_ROLES.has(String(role || '').toUpperCase());
}

/**
 * Validate a resolved Candidate's provenance at the existing Candidate
 * boundary.  A range made exclusively of known non-requirement roles is
 * rejected; mixed/unknown ranges remain eligible so substantive obligations
 * are not discarded.  This deliberately inspects provenance metadata only
 * and never filters Candidate text by keyword.
 */
export function validateCandidateSourceScope(candidate = {}, chunk = {}) {
  const range = candidate?.source_range;
  const segments = Array.isArray(chunk?.segments) ? chunk.segments : [];
  if (!range || !Array.isArray(segments) || !segments.length) return { eligible: true, roles: [] };
  const startIndex = segments.findIndex((segment) => (segment.source_ref || segment.span_id) === range.start_ref);
  const endIndex = segments.findIndex((segment) => (segment.source_ref || segment.span_id) === range.end_ref);
  if (startIndex < 0 || endIndex < startIndex) return { eligible: true, roles: [] };
  const roles = segments.slice(startIndex, endIndex + 1).map((segment) => (
    explicitRole(segment.routing_role || segment.scope_role || segment.requirement_role) || 'UNKNOWN'
  ));
  const selectedSegments = segments.slice(startIndex, endIndex + 1);
  const excludedOnly = roles.length && roles.every((role) => EXCLUDED_ONLY_ROLES.has(role));
  const selectedText = selectedSegments.map((segment) => textOf(segment.text)).join(' ');
  const candidateText = textOf(candidate?.requirement_text || candidate?.content || candidate?.text);
  // Prefer the model candidate's own obligation wording over the potentially
  // wider provenance span.  This prevents a neighboring guarantee clause in
  // a shared source span from making an unrelated validity/format candidate
  // non-applicable.  Unit callers that have no candidate text retain the
  // source-span fallback for backwards compatibility.
  const selectedTopics = nonApplicabilityTopics(candidateText || selectedText);
  // A bidder-facing consequence (for example, a buyer rejecting an
  // off-platform submission) is itself an in-scope obligation.  A guarantee
  // mentioned as an exception in such a consequence clause must not inherit a
  // nearby template override.
  const selectedHasBidderConsequence = BIDDER_CONSEQUENCE_PATTERN.test(selectedText);
  const candidateDeclaresNonApplicability = !selectedHasBidderConsequence
    && hasExplicitNonApplicability(candidateText)
    && selectedTopics.size > 0;
  const nonApplicableSource = candidateDeclaresNonApplicability
    ? selectedSegments[0]
    : selectedHasBidderConsequence ? null : segments.find((segment) => {
      if (!hasExplicitNonApplicability(segment.text)) return false;
      const overrideTopics = nonApplicabilityTopics(segment.text);
      return [...selectedTopics].some((topic) => overrideTopics.has(topic));
    });
  // A project-specific clause can explicitly make a generic template
  // obligation inapplicable (for example, "投标保证金金额：无须提交").
  // This is a deterministic same-source check: it requires an explicit
  // marker and a shared obligation topic, and does not infer from fuzzy
  // similarity or from active prohibitions such as "不得".
  if (nonApplicableSource) {
    throw Object.assign(new Error('候选来源范围明确声明本项目不适用。'), {
      code: 'REQUIREMENT_SCOPE_EXCLUDED',
      status: 422,
      scope_roles: [...new Set(roles)],
      scope_reason: 'REQUIREMENT_SCOPE_NON_APPLICABLE',
      non_applicability_source_ref: nonApplicableSource.source_ref || nonApplicableSource.span_id || null
    });
  }
  // Source/content roles are routing metadata, not scope authority.  Apply
  // the negative filter only when the selected span is clearly context-only;
  // an explicit bidder-facing action or consequence keeps the candidate in
  // the high-recall stream even inside a qualification/procurement/scoring/
  // commercial/legal container.
  const bidderFacing = selectedSegments.some((segment) => isBidderFacingRequirementParagraph(
    { ...segment, routing_role: null },
    { sectionRole: 'UNKNOWN' }
  ));
  const buyerOnlyDuty = selectedSegments.some((segment) => {
    const segmentText = textOf(segment.text);
    return BUYER_AUTHORITY_ACTOR_PATTERN.test(segmentText)
      && BUYER_ONLY_ACTION_PATTERN.test(segmentText)
      && !BIDDER_CONSEQUENCE_PATTERN.test(segmentText);
  });
  if (excludedOnly && (!bidderFacing || buyerOnlyDuty)) {
    throw Object.assign(new Error('候选来源范围仅包含非需求范围内容。'), {
      code: 'REQUIREMENT_SCOPE_EXCLUDED',
      status: 422,
      scope_roles: [...new Set(roles)]
    });
  }
  return { eligible: true, roles: [...new Set(roles)] };
}
