/**
 * Offline-only response projection for the Bid Copilot Wave 1 foundation.
 *
 * This module is deliberately a read-model boundary.  It does not alter a
 * Requirement, call a provider, persist anything, or grant any authority.
 * Rules are conservative: when the text does not establish a safe route the
 * result is NEED_REVIEW rather than an inferred business fact.
 */

export const RESPONSE_PROJECTION_VERSION = 'v43-response-projection-v1';

export const RESPONSE_ROLES = Object.freeze(['TECHNICAL', 'SCORING', 'COMPLIANCE', 'CONTRACT', 'NONE']);
export const RESPONSE_MODES = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW']);
export const RISK_TIERS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'P0']);
export const SCORING_PRIORITIES = Object.freeze(['NONE', 'LOW', 'MEDIUM', 'HIGH']);

const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const has = (text, patterns) => (Array.isArray(patterns) ? patterns : [patterns]).some((pattern) => pattern.test(text));

const P0_PATTERNS = Object.freeze([
  /无效投标|投标无效|不满足[^。；:：]{0,24}(?:投标)?无效|否决投标|废标|取消资格|资格无效|不予受理|拒绝投标|资格审查不通过/,
  /不得参与|禁止投标|禁止提供|法律责任|违法|违规|重大违约/
]);
const COMPLIANCE_PATTERNS = Object.freeze([
  /投标截止|开标时间|递交|上传|签章|加盖公章|格式要求|响应文件|投标文件/,
  /资格审查|资格要求|资质要求|营业执照|信用记录|联合体|声明函|证明文件/,
  /实质性响应|符合性审查|禁止事项|禁止投标|禁止提供|法律义务|知识产权|保密义务/,
  /不得[^。；:：]{0,20}(?:参与投标|投标|泄露|转包|分包|违反|使用)/
]);
const SCORING_PATTERNS = Object.freeze([/评分|评标|评审|得分|分值|权重|每提供[^。；:：]{0,16}得|每满足[^。；:：]{0,16}得|评分标准|评审标准/]);
const EVIDENCE_PATTERNS = Object.freeze([
  /资质|证书|认证|检测报告|测评报告|业绩|案例|客户名称|产品型号|产品版本|软件版本/,
  /兼容|适配|支持(?:[A-Za-z]|国产|数据库|操作系统)|性能|响应时间|吞吐|并发|P\s*\d+|不少于|不低于|小于|不超过/,
  /已有|具备|具有|曾经|完成过|实施过|高级工程师|项目负责人|人员.*经验|有效期/
]);
const COMMITMENT_PATTERNS = Object.freeze([
  /中标后|合同签订后|合同生效后|项目实施期间|履约期间|服务期限内/,
  /承诺|投入(?:不少于|至少)?\s*\d*\s*[名人]|派驻|驻场|工期|交付期限|服务响应|响应时限|SLA|赔付|违约金|专项资源/,
  /7\s*[×x*]\s*24|7\s*天\s*24\s*小时|全天候/
]);
const SOLUTION_PATTERNS = Object.freeze([
  /实施方案|技术方案|服务方案|架构方案|部署方案|应急预案|培训方案|质量管理|组织方案|项目组织|流程设计|方法论/,
  /建设|部署|实施|架构|设计|培训|运维方案|售后方案|应急响应|质量保证|管理流程/
]);
const CONTRACT_PATTERNS = Object.freeze([/合同|付款|支付|结算|交付责任|履约|违约|赔偿|服务期限|质保期|保证金/]);

function scoringPriority(text, requirement = {}) {
  if (!has(text, SCORING_PATTERNS) && ![requirement.score, requirement.weight, requirement.max_score].some((value) => value != null)) return 'NONE';
  if (/重大|关键|核心|一票否决|最高|满分/.test(text) || Number(requirement.weight) >= 20 || Number(requirement.max_score) >= 20) return 'HIGH';
  if (/重要|每项|每提供|每满足|分值|权重/.test(text) || Number(requirement.weight) >= 10) return 'MEDIUM';
  return 'LOW';
}

function explicitCategory(requirement) {
  return `${textOf(requirement.category)} ${textOf(requirement.requirement_category)}`.toLowerCase();
}

function routeMode({ text, compliance, p0, evidence, commitment, solution, ambiguous }) {
  if (p0 || compliance) return 'COMPLIANCE';
  // An existing enterprise fact is stronger than a future promise.  A mixed
  // clause remains reviewable through secondary_dependencies below.
  if (evidence && !commitment) return 'EVIDENCE';
  if (commitment && !evidence) return 'COMMITMENT';
  if (solution && !evidence && !commitment) return 'SOLUTION';
  if (evidence && commitment) return 'EVIDENCE';
  return ambiguous ? 'NEED_REVIEW' : 'NEED_REVIEW';
}

function roleFor({ mode, scoring, category, text }) {
  if (mode === 'COMPLIANCE') return 'COMPLIANCE';
  if (scoring) return 'SCORING';
  if (mode === 'COMMITMENT' || /contract|commercial|delivery/.test(category) || has(text, CONTRACT_PATTERNS)) return 'CONTRACT';
  if (mode === 'SOLUTION' || mode === 'EVIDENCE') return 'TECHNICAL';
  return 'NONE';
}

function riskFor({ mode, p0, text, requirement, scoring }) {
  if (p0) return 'P0';
  if (mode === 'COMPLIANCE' && has(text, COMPLIANCE_PATTERNS)) return 'HIGH';
  if (has(text, EVIDENCE_PATTERNS) || requirement.risk_flags?.length || /客户|证书|认证|资质|业绩|性能|SLA|赔付|金额|有效期/.test(text)) return 'HIGH';
  if (mode === 'COMMITMENT' || scoring) return 'MEDIUM';
  if (mode === 'SOLUTION') return 'LOW';
  return 'MEDIUM';
}

function reasonsFor({ mode, p0, scoring, evidence, commitment, solution, compliance, ambiguous }) {
  const reasons = [];
  if (p0) reasons.push('DISQUALIFICATION_CONSEQUENCE');
  else if (compliance) reasons.push('COMPLIANCE_RESPONSE_REQUIRED');
  if (scoring) reasons.push('SCORING_RESPONSE_REQUIRED');
  if (evidence) reasons.push('ENTERPRISE_QUALIFICATION_EVIDENCE');
  if (commitment) reasons.push('PROJECT_COMMITMENT_REQUIRED');
  if (solution) reasons.push('SOLUTION_PLAN_REQUIRED');
  if (mode === 'EVIDENCE' && commitment) reasons.push('COMMITMENT_DEPENDS_ON_ENTERPRISE_EVIDENCE');
  if (ambiguous || mode === 'NEED_REVIEW') reasons.push('AMBIGUOUS_RESPONSE_BOUNDARY');
  return [...new Set(reasons)].sort();
}

/**
 * Project one canonical Requirement without mutating the input object.
 * `context` is intentionally read-only metadata for eval callers.
 */
export function projectRequirementResponse(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const text = textOf(item.requirement_text ?? item.text);
  const category = explicitCategory(item);
  const p0 = has(text, P0_PATTERNS) || (Array.isArray(item.risk_flags) && item.risk_flags.some((flag) => /P0|DISQUAL|INVALID|LEGAL/i.test(flag)));
  const compliance = has(text, COMPLIANCE_PATTERNS);
  const scoring = has(text, SCORING_PATTERNS) || [item.score, item.weight, item.max_score].some((value) => value != null);
  const evidence = has(text, EVIDENCE_PATTERNS);
  // Mandatory is a governance attribute, not evidence of a post-award promise.
  // Commitment requires explicit future/performance language from the text.
  const commitment = has(text, COMMITMENT_PATTERNS);
  const solution = has(text, SOLUTION_PATTERNS);
  const ambiguous = !text || (evidence && commitment && solution) || (!compliance && !evidence && !commitment && !solution);
  const response_mode = routeMode({ text, compliance, p0, evidence, commitment, solution, ambiguous });
  const secondary_dependencies = [];
  if (response_mode === 'EVIDENCE' && commitment) secondary_dependencies.push('PROJECT_COMMITMENT');
  if (response_mode === 'COMMITMENT' && evidence) secondary_dependencies.push('ENTERPRISE_EVIDENCE');
  if (response_mode === 'SOLUTION' && evidence) secondary_dependencies.push('ENTERPRISE_EVIDENCE');
  const scoring_priority = scoringPriority(text, item);
  const response_role = roleFor({ mode: response_mode, scoring, category, text });
  const risk_tier = riskFor({ mode: response_mode, p0, text, requirement: item, scoring });
  const routing_reasons = reasonsFor({ mode: response_mode, p0, scoring, evidence, commitment, solution, compliance, ambiguous });
  const evidence_dependency = response_mode === 'EVIDENCE' || secondary_dependencies.includes('ENTERPRISE_EVIDENCE');
  const deep_chain_required = response_mode === 'EVIDENCE' || (response_mode === 'COMMITMENT' && evidence_dependency);
  return Object.freeze({
    requirement_id: item.requirement_id ?? item.canonical_requirement_id ?? null,
    response_role,
    response_mode,
    risk_tier,
    is_scoring_related: scoring,
    scoring_priority,
    routing_reasons,
    secondary_dependencies: [...new Set(secondary_dependencies)].sort(),
    evidence_dependency,
    deep_chain_required,
    human_required: response_mode === 'NEED_REVIEW' || risk_tier === 'P0',
    projection_version: context.projection_version || RESPONSE_PROJECTION_VERSION
  });
}

export function buildComplianceMatrixRow(requirement, projection, downstream = {}) {
  const item = requirement || {};
  return Object.freeze({
    requirement_id: item.requirement_id ?? item.canonical_requirement_id ?? null,
    requirement_text: item.requirement_text ?? item.text ?? '',
    source_refs: Array.isArray(item.source_refs) ? [...item.source_refs] : [],
    response_role: projection.response_role,
    response_mode: projection.response_mode,
    risk_tier: projection.risk_tier,
    scoring_priority: projection.scoring_priority,
    current_evidence_status: downstream.current_evidence_status || 'NOT_EVALUATED',
    response_decision_status: downstream.response_decision_status || 'NOT_EVALUATED',
    human_required: projection.human_required,
    next_action: downstream.next_action || (projection.response_mode === 'NEED_REVIEW' ? 'HUMAN_REVIEW' : 'NOT_EVALUATED')
  });
}
