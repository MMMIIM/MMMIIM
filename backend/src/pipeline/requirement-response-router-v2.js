/**
 * Deterministic Response Router V2.
 *
 * This is an evaluation/read-model boundary.  It never mutates a Requirement,
 * persists business state, calls a provider, or grants an authorization.  The
 * router deliberately keeps the response mode, evidence dependency and
 * response-required decision independent so a downstream consumer cannot infer
 * one permission from another.
 */

export const RESPONSE_ROUTER_V2_VERSION = 'v43-response-router-v2';
export const RESPONSE_ROUTER_V2_IMPLEMENTATION_ID = 'v43-response-router-v2-staged-semantics';
export const RESPONSE_MODES_V2 = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW']);
export const RISK_TIERS_V2 = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'P0']);
export const RESPONSE_ROLES_V2 = Object.freeze(['TECHNICAL', 'SCORING', 'COMPLIANCE', 'CONTRACT', 'NONE']);

const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const matches = (value, pattern) => pattern.test(value);

// Compliance is about bid eligibility, submission, or a legal/procurement
// consequence.  Generic words such as “不予受理” are intentionally not P0 by
// themselves; the consequence must be tied to a real invalidity boundary.
const TRUE_P0 = /(?:投标|响应|资格|供应商|文件).{0,18}(?:无效|否决|废标|拒绝|取消资格|不通过)|(?:无效投标|投标无效|否决投标|废标|取消资格|资格审查不通过|拒绝参与|拒绝投标)|失信被执行人|重大税收违法|拖欠农民工工资|恶意串通|弄虚作假|虚假投标|禁止参与.*(?:投标|采购)|实质性响应.{0,18}(?:无效|拒绝|否决)|按无效标处理/;
const P0_LEGAL = /(?:违法|违规|重大违约|法律责任).{0,16}(?:投标|采购|合同|履约)?/;
const BID_FORMALITY = /投标文件|响应文件|投标截止|开标|递交|上传|电子投标|电子签章|签章|加盖(?:投标人|公章)|CA锁|联合体|招标文件|采购文件|质疑|答疑|异议|评标|评审|评分|得分|声明函|信用中国|信用记录|报价|预算|采购活动|中小企业|计量单位|不接受联合体/;
const PROCEDURAL_CONTEXT = /质疑|答疑|异议|投诉|采购文件|招标文件|查询.*信息|定义|适用|采用国家|报价确定|预算金额|不接受联合体|本项目(?:不|无需)|仅供参考|无需响应|不作为(?:评分|响应)|可以按照|可按照|可在|有权/;

const QUALIFICATION = /资质|资格证书|认证|检测报告|测评报告|安全可靠测评|软件著作权|证书|业绩|案例|客户(?:名称|案例)|项目经验|项目负责人|技术负责人|人员.*(?:证书|经验)|社保证明/;
const STRONG_PRODUCT = /操作系统|数据库|CPU|内存|服务器|交换机|防火墙|摄像机|存储|光模块|SSL|CA机构|电子印章|PostgreSQL|MySQL|Oracle|Linux|麒麟|统信|产品(?:型号|版本|参数)?|软件(?:版本|产品)?|UEFI|NUMA|GRUB|VPN|IOPS|Gbps|Mpps|Lux|千兆|万兆|兼容|适配|互认证|硬件|端口|并发连接|吞吐|响应时间|性能指标|技术参数|配置|规格/;
const PRODUCT_SPECIFIC = /操作系统|数据库|CPU|内存|服务器|交换机|防火墙|摄像机|存储|光模块|SSL|CA机构|电子印章|PostgreSQL|MySQL|Oracle|Linux|麒麟|统信|UEFI|NUMA|GRUB|VPN|IOPS|Gbps|Mpps|Lux|千兆|万兆|互认证|硬件|端口|并发连接|吞吐|性能指标|技术参数|型号|版本|规格/;
const CAPABILITY_VERBS = /支持|兼容|适配|具备|具有|拥有|提供|实现|能够|可(?:以)?提供|完成过|曾经|承担过|符合/;
const GENERIC_PROJECT = /本项目|项目建设|建设|平台|系统|业务|城市|应用|实施|部署|架构|方案|流程|方法|组织|运维|培训|验收|交付/;

const FUTURE = /中标后|合同签订后|合同生效后|履约期间|项目实施期间|服务期限内|合同期内|验收前|质保期内|交付后|上线后|收到.*通知|开工后|在.{0,8}内完成|工期|交货|交付|验收|运维|维护|质保|驻场|派驻|投入(?:不少于|至少)?\s*\d*\s*[名人]|承诺|保证|应提供.{0,12}(?:服务|人员|资源)|服务响应|响应时限|SLA|违约金|赔付|培训/;
const PROJECT_DESIGN = /技术方案|实施方案|服务方案|架构方案|部署方案|应急预案|培训方案|组织方案|项目管理|质量保证|方法论|设计时|设计开发|建设内容|建设方案|实现.*平台|搭建|规划|流程设计|体系建设|管理办法/;
const NUMERIC = /(?:\d+(?:\.\d+)?\s*(?:秒|分钟|小时|天|月|年|人|个|套|次|万|％|%|Gbps|Mpps|IOPS|TB|GB|MB)|[<>≤≥]=?|不少于|不低于|不超过|至少|最高|最低|峰值|并发|吞吐|容量)/i;
const CONTEXT_ONLY = /(?:坚持|围绕|着力|目标|原则|包括|例如|可按照|可以|如认为|发现.*问题|提出质疑|无需|不接受联合体)/;

function categoryOf(item) {
  return `${textOf(item.category)} ${textOf(item.requirement_category)}`.toLowerCase();
}

function scoringOf(text, item) {
  return /评分|评标|评审|得分|分值|权重|每提供|每满足|满分/.test(text)
    || [item.score, item.weight, item.max_score].some((value) => value != null);
}

function productEvidenceOf(text, category) {
  const qualification = matches(text, QUALIFICATION);
  const product = matches(text, STRONG_PRODUCT) && matches(text, CAPABILITY_VERBS);
  const productMetric = matches(text, NUMERIC) && matches(text, /产品|设备|系统|平台|操作系统|数据库|服务器|交换机|防火墙|性能|指标|参数|接口/);
  const productSpecific = matches(text, PRODUCT_SPECIFIC);
  const categoryEvidence = qualification || product || productMetric
    || /(?:performance|security|functional|technical)/.test(category) && (matches(text, CAPABILITY_VERBS) || productSpecific);
  const existing = matches(text, /所投产品|投标产品|产品(?:具有|支持|具备)|操作系统(?:支持|具备)|数据库(?:支持|具备)|具备|具有|兼容|适配|互认证|已(?:有|完成)|曾经|案例|业绩/);
  return { qualification, product, productMetric, productSpecific, existing, categoryEvidence };
}

function complianceOf(text, category, evidenceSignals) {
  const p0 = matches(text, TRUE_P0) || matches(text, P0_LEGAL);
  const formal = matches(text, BID_FORMALITY);
  // A detailed offered-product statement remains evidence even when it says
  // “须提供” a proof document.  Pure submission/procedure remains compliance.
  const substantive = evidenceSignals.qualification || evidenceSignals.product || evidenceSignals.productMetric;
  const procedural = matches(text, PROCEDURAL_CONTEXT);
  const compliance = p0 || (formal && (!substantive || procedural || matches(text, /投标文件|招标文件|采购活动|评分|得分|报价|截止|签章|上传|递交/)));
  return { p0, compliance, procedural };
}

function commitmentOf(text, category, evidenceSignals) {
  const future = matches(text, FUTURE);
  const projectPerformance = matches(text, NUMERIC) && !evidenceSignals.product && !evidenceSignals.productMetric
    && /(?:performance|delivery|service|implementation|technical)/.test(category);
  const deliveryCategory = /(?:delivery|service|implementation|contractual|acceptance|constraint)/.test(category);
  const commitment = future || projectPerformance || (deliveryCategory && !evidenceSignals.product && !matches(text, PROJECT_DESIGN));
  return { future, projectPerformance, commitment };
}

function solutionOf(text, category, evidenceSignals) {
  const design = matches(text, PROJECT_DESIGN) || matches(text, /架构|部署|实施|方案|方法|流程|管理|体系|建设/);
  const projectFunctional = matches(text, GENERIC_PROJECT) && !evidenceSignals.qualification && !evidenceSignals.productMetric;
  const solution = design || projectFunctional;
  return { design, solution };
}

function responseRequiredOf(text, mode, complianceSignals) {
  if (!text) return false;
  if (matches(text, /仅供参考|无需响应|不作为(?:评分|响应)|可以|可按照|有权|如认为.*可以|发现.*问题.*联系|本项目不接受联合体/)) return false;
  if (complianceSignals.procedural && matches(text, /质疑|答疑|投诉|异议|解释|查询|定义|适用/)) return false;
  // An explicit imperative or a substantive routed mode requires a response;
  // this decision is independent from the mode itself.
  if (matches(text, /须|必须|应当|应|需|需要|要求|提供|支持|具备|具有|完成|承诺|保证|不得/)) return true;
  return mode !== 'NEED_REVIEW';
}

function modeOf({ text, category, evidenceSignals, commitmentSignals, solutionSignals, compliance, p0 }) {
  const { categoryEvidence: evidence, existing } = evidenceSignals;
  const { commitment, future } = commitmentSignals;
  const { solution, design } = solutionSignals;
  if (p0 || compliance) return 'COMPLIANCE';
  // Existing/offered product or enterprise facts win over future promises;
  // future-only obligations remain COMMITMENT.  A design/architecture clause
  // does not become enterprise evidence merely because it mentions a product.
  const deliveryCategory = /(?:service|delivery|implementation|acceptance|constraint|contractual)/.test(category);
  // These categories describe work the bidder must perform or deliver.  A
  // bare “provide X” is therefore a commitment; only an explicitly offered or
  // already-existing product/qualification is evidence.
  if (deliveryCategory && commitment && !existing) return 'COMMITMENT';
  if (evidence && commitment) return (future && !existing) ? 'COMMITMENT' : 'EVIDENCE';
  if (evidence && design && !existing && !evidenceSignals.qualification && !evidenceSignals.productMetric) return 'SOLUTION';
  if (evidence) return 'EVIDENCE';
  if (commitment) return 'COMMITMENT';
  if (solution) return 'SOLUTION';
  if (/(?:technical|functional|implementation|delivery|service|performance|security|data|constraint)/.test(category)) return 'SOLUTION';
  // A non-empty requirement still needs a stable read-model route.  Unknown
  // free text is conservatively a solution/context route; NEED_REVIEW is
  // reserved for an absent requirement where no semantic subject exists.
  return text ? 'SOLUTION' : 'NEED_REVIEW';
}

function riskOf({ mode, p0, text, evidence, commitment, scoring, item }) {
  if (p0) return 'P0';
  if (evidence && (matches(text, QUALIFICATION) || matches(text, NUMERIC) || matches(text, /客户|案例|业绩|SLA|有效期|认证|资质/))) return 'HIGH';
  if (commitment && (matches(text, NUMERIC) || matches(text, /SLA|质保|验收|工期|交付|维护|人员|安全|保密|违约/))) return 'HIGH';
  if (mode === 'COMPLIANCE' || scoring || commitment) return 'MEDIUM';
  if (Array.isArray(item.risk_flags) && item.risk_flags.some((flag) => /HIGH|P0/i.test(String(flag)))) return 'HIGH';
  return mode === 'SOLUTION' ? 'LOW' : 'MEDIUM';
}

function reasonFamily({ mode, p0, procedural, qualification, product, commitment, solution, scoring, ambiguous }) {
  const reasons = [];
  if (p0) reasons.push('P0_OR_ELIGIBILITY_COMPLIANCE');
  else if (procedural && mode === 'COMPLIANCE') reasons.push('BID_FORMALITY_OR_PROCEDURE');
  if (qualification) reasons.push('ENTERPRISE_OR_PERSONNEL_EVIDENCE');
  else if (product && mode === 'EVIDENCE') reasons.push('OFFERED_PRODUCT_CAPABILITY_EVIDENCE');
  if (commitment && mode === 'COMMITMENT') reasons.push('PROJECT_OR_CONTRACT_COMMITMENT');
  if (solution && mode === 'SOLUTION') reasons.push('PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN');
  if (scoring) reasons.push('SCORING_RELATED');
  if (ambiguous) reasons.push('AMBIGUOUS_SUBJECT_OR_TEMPORAL_BOUNDARY');
  return reasons.length ? [...new Set(reasons)].sort() : ['UNCLASSIFIED_RESPONSE_BOUNDARY'];
}

/**
 * Project one Requirement using V2 staged semantics.  The input is never
 * mutated and all fields are read-only observations for Eval/read-model use.
 */
export function projectRequirementResponseV2(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  const scoring = scoringOf(text, item);
  const evidenceSignals = productEvidenceOf(text, category);
  const complianceSignals = complianceOf(text, category, evidenceSignals);
  const commitmentSignals = commitmentOf(text, category, evidenceSignals);
  const solutionSignals = solutionOf(text, category, evidenceSignals);
  const ambiguous = !text || (!complianceSignals.compliance && !evidenceSignals.categoryEvidence && !commitmentSignals.commitment && !solutionSignals.solution);
  const response_mode = modeOf({
    text,
    category,
    evidenceSignals,
    commitmentSignals,
    solutionSignals,
    compliance: complianceSignals.compliance,
    p0: complianceSignals.p0
  });
  const response_required = responseRequiredOf(text, response_mode, complianceSignals);
  const secondary_dependencies = [];
  if (evidenceSignals.categoryEvidence && matches(text, /提供|证明|报告|截图|复印件|佐证/)) secondary_dependencies.push('PROOF_DOCUMENT');
  if (response_mode === 'EVIDENCE' && commitmentSignals.commitment) secondary_dependencies.push('PROJECT_COMMITMENT');
  if (response_mode === 'COMMITMENT' && evidenceSignals.categoryEvidence) secondary_dependencies.push('ENTERPRISE_EVIDENCE');
  const evidence_dependency = response_mode === 'EVIDENCE' || secondary_dependencies.includes('ENTERPRISE_EVIDENCE');
  const risk_tier = riskOf({ mode: response_mode, p0: complianceSignals.p0, text, evidence: evidenceSignals.categoryEvidence, commitment: commitmentSignals.commitment, scoring, item });
  const human_required = complianceSignals.p0 || item.requires_confirmation === true || (response_mode === 'COMMITMENT' && risk_tier === 'HIGH');
  const response_role = response_mode === 'COMPLIANCE' ? 'COMPLIANCE' : scoring ? 'SCORING' : response_mode === 'COMMITMENT' ? 'CONTRACT' : response_mode === 'SOLUTION' || response_mode === 'EVIDENCE' ? 'TECHNICAL' : 'NONE';
  const projection_version = context.projection_version || RESPONSE_ROUTER_V2_VERSION;
  return Object.freeze({
    requirement_id: item.requirement_id ?? item.canonical_requirement_id ?? null,
    response_role,
    response_mode,
    response_required,
    risk_tier,
    is_scoring_related: scoring,
    scoring_priority: scoring ? (matches(text, /重大|关键|核心|最高|满分/) ? 'HIGH' : 'MEDIUM') : 'NONE',
    routing_reasons: reasonFamily({ mode: response_mode, p0: complianceSignals.p0, procedural: complianceSignals.procedural, qualification: evidenceSignals.qualification, product: evidenceSignals.product || evidenceSignals.productMetric, commitment: commitmentSignals.commitment, solution: solutionSignals.solution, scoring, ambiguous }),
    secondary_dependencies: [...new Set(secondary_dependencies)].sort(),
    evidence_dependency,
    deep_chain_required: evidence_dependency || response_mode === 'COMMITMENT',
    human_required,
    projection_version,
    implementation_id: RESPONSE_ROUTER_V2_IMPLEMENTATION_ID
  });
}

export const projectRequirementResponse = projectRequirementResponseV2;
