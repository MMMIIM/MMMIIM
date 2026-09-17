import { createHash } from 'node:crypto';
import { AppError } from './errors.js';

export const EVIDENCE_NEED_PROFILE_VERSION = 'evidence-need-profile-v1';
export const EVIDENCE_NEED_CLASSES = Object.freeze([
  'PRODUCT_CAPABILITY', 'PERFORMANCE', 'QUALIFICATION', 'PERSONNEL',
  'PROJECT_CASE', 'SERVICE_CAPABILITY', 'OTHER_EVIDENCE'
]);
export const EVIDENCE_NEED_DIMENSIONS = Object.freeze([
  'subject', 'scope', 'status', 'quantity', 'entity', 'validity'
]);

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hash = value => createHash('sha256').update(JSON.stringify(stable(value)), 'utf8').digest('hex');
const text = value => String(value ?? '').trim();
const unique = values => [...new Set(values.filter(Boolean))];

function requirementText(requirement) {
  const value = text(requirement?.text || requirement?.requirement_text || requirement?.content);
  if (!value) throw new AppError('EVIDENCE_NEED_REQUIREMENT_TEXT_REQUIRED', 'EvidenceNeedProfile 需要 Canonical Requirement 文本。', 422);
  return value;
}
function requirementId(requirement) {
  const value = text(requirement?.requirement_id || requirement?.req_id || requirement?.canonical_requirement_id);
  if (!value) throw new AppError('EVIDENCE_NEED_REQUIREMENT_ID_REQUIRED', 'EvidenceNeedProfile 需要 Canonical Requirement identity。', 422);
  return value;
}

function classify(value) {
  if (/(资质|资格|认证|证书|许可|ISO\s*\d|登记证)/iu.test(value)) return 'QUALIFICATION';
  if (/(人员|工程师|项目经理|团队|专家|驻场)/iu.test(value)) return 'PERSONNEL';
  if (/(案例|业绩|项目经验|合同|验收案例)/iu.test(value)) return 'PROJECT_CASE';
  if (/(性能|并发|响应时间|吞吐|可用率|时延|延迟|秒|分钟)/iu.test(value)) return 'PERFORMANCE';
  if (/(运维|服务|售后|保障|培训|支持服务|响应)/iu.test(value)) return 'SERVICE_CAPABILITY';
  if (/(系统|平台|产品|功能|接口|集成|部署|标准化|软件|模块)/iu.test(value)) return 'PRODUCT_CAPABILITY';
  return 'OTHER_EVIDENCE';
}

function dimensionApplicability(value, evidenceNeedClass) {
  const dimensions = Object.fromEntries(EVIDENCE_NEED_DIMENSIONS.map(name => [name, 'NOT_APPLICABLE']));
  dimensions.subject = 'REQUIRED';
  dimensions.scope = /(本项目|系统|平台|接口|范围|条线|部署|实施|服务)/iu.test(value)
    ? 'REQUIRED' : 'CONDITIONAL';
  dimensions.entity = /(江阴|澄川|智慧城市|\b[A-Z][A-Z0-9-]{1,}\b)/u.test(value)
    ? 'REQUIRED' : 'NOT_APPLICABLE';
  const quantity = /(?:\d+(?:\.\d+)?\s*(?:个|套|台|人|项|年|月|天|小时|分钟|秒|%|并发|用户)|不少于|不低于|不超过|至少|最高)/u.test(value);
  if (quantity) dimensions.quantity = 'REQUIRED';
  const controlledStatus = /(资质|资格|认证|证书|许可|有效|当前|现行|到期|截止|期限|年审|状态)/iu.test(value);
  const validity = /(有效|当前|现行|到期|截止|期限|有效期|年审)/iu.test(value);
  if (controlledStatus) dimensions.status = 'REQUIRED';
  if (validity) dimensions.validity = 'REQUIRED';
  if (evidenceNeedClass === 'OTHER_EVIDENCE') {
    if (dimensions.status === 'NOT_APPLICABLE') dimensions.status = 'CONDITIONAL';
    if (dimensions.validity === 'NOT_APPLICABLE') dimensions.validity = 'CONDITIONAL';
  }
  return dimensions;
}

function criticalLiterals(value) {
  return unique([
    ...value.matchAll(/\d+(?:\.\d+)?\s*(?:个|套|台|人|项|年|月|天|小时|分钟|秒|%|并发|用户)?/gu)
      .map(match => match[0]),
    ...value.matchAll(/(?:ISO\s*\d+|有效期|到期|截止|证书|认证|接口规范|标准化)/giu)
      .map(match => match[0])
  ]).sort();
}

/**
 * A deterministic downstream view. It classifies what a Requirement needs to
 * prove; it neither manufactures enterprise truth nor changes the canonical
 * Requirement, Router, Fact, Mapping taxonomy, or Provider transport.
 */
export function buildEvidenceNeedProfile({ requirement = {}, responseDecision = {}, enterpriseId = null } = {}) {
  const id = requirementId(requirement);
  const value = requirementText(requirement);
  const evidenceNeedClass = classify(value);
  const responseMode = text(responseDecision.response_mode || 'NEED_REVIEW').toUpperCase();
  const riskTier = text(responseDecision.risk_tier || 'HIGH').toUpperCase();
  const required = responseMode === 'EVIDENCE';
  const applicability = dimensionApplicability(value, evidenceNeedClass);
  const body = {
    profile_version: EVIDENCE_NEED_PROFILE_VERSION,
    requirement_id: id,
    response_mode: responseMode,
    risk_tier: riskTier,
    evidence_dependency: required ? 'REQUIRED' : responseMode === 'NEED_REVIEW' ? 'CONDITIONAL' : 'NOT_REQUIRED',
    deep_chain_required: required && responseDecision.response_required !== false,
    evidence_need_class: evidenceNeedClass,
    required_dimensions: EVIDENCE_NEED_DIMENSIONS.filter(name => applicability[name] === 'REQUIRED'),
    conditional_dimensions: EVIDENCE_NEED_DIMENSIONS.filter(name => applicability[name] === 'CONDITIONAL'),
    dimension_applicability: applicability,
    critical_literals: criticalLiterals(value),
    search_signals: unique([evidenceNeedClass, ...criticalLiterals(value)]).sort(),
    source_constraints: {
      enterprise_id: enterpriseId || requirement.enterprise_id || null,
      project_id: requirement.project_id || null,
      corpus_scope: 'ENTERPRISE_PRIVATE',
      source_roles: ['EVIDENCE_CANDIDATE'],
      authority_mode: 'SYNTHETIC_EVAL_ONLY',
      production_authority: 'NONE'
    },
    profile_reasons: unique([
      `CLASS_${evidenceNeedClass}`,
      required ? 'ROUTER_EVIDENCE_REQUIRED' : `ROUTER_${responseMode}`,
      ...EVIDENCE_NEED_DIMENSIONS.map(name => `DIMENSION_${name.toUpperCase()}_${applicability[name]}`)
    ])
  };
  return Object.freeze({ ...body, profile_hash: hash(body) });
}
