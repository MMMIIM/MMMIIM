/**
 * Deterministic Response Router V2.1.
 *
 * V2.1 is an evaluation/read-model projection that tightens semantic
 * boundaries without replacing the V2 production path.  It consumes only the
 * requirement text, category and existing requirement metadata; it has no
 * dependency on Gold, benchmark labels, providers or persistence.
 */

import { projectRequirementResponseV2 } from './requirement-response-router-v2.js';

export const RESPONSE_ROUTER_V21_VERSION = 'v43-response-router-v2.1';
export const RESPONSE_ROUTER_V21_IMPLEMENTATION_ID = 'v43-response-router-v2.1-systematic-boundary-repair';

const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const has = (value, pattern) => pattern.test(value);

const CATEGORY = Object.freeze({
  context: 'context',
  technical: 'technical',
  performance: 'performance',
  implementation: 'implementation',
  service: 'service',
  delivery: 'delivery',
  contractual: 'contractual'
});

// These expressions describe semantic boundaries rather than tender-specific
// wording.  They deliberately remain broad enough to work for unseen tenders.
const ACTOR = /投标人|投标单位|投标方|供应商|潜在投标人|中标人|乙方|承包方|承建方/;
const BIDDER_ELIGIBILITY = /营业执照|法人证书|民事责任|税务|社会保障|社会保险|社保|信用记录|失信|重大违法|资格(?:审查|条件|要求|证明|等级)?|联合体|控股|管理关系|法定代表人|分支机构|不接受联合体|转包|分包|商业贿赂|投标资格|许可证|财务会计|商业信誉|专业技术能力|设备和专业|中小企业|监狱企业|残疾人福利性单位/;
const PRE_AWARD_FORMALITY = /投标文件|响应文件|投标截止|递交|上传|电子投标|电子签章|签字|签章|盖章|公章|CA锁|开标|评标|评审|质疑|答疑|异议|投诉|报价|投标有效期|投标保证金|招标文件|采购文件|声明函|承诺函|无效标|投标无效|拒绝参与/;
const P0_CONSEQUENCE = /(?:投标|响应|资格|供应商|文件|产品|报价|标书).{0,24}(?:无效|否决|废标|拒收|拒绝|取消资格|不通过)|(?:无效投标|投标无效|无效标|否决投标|废标|取消中标资格|拒绝参与|不得参加|不得参与|不得同时参加|不接受联合体|无资格参加|禁止参加|资格审查不通过|视为无效|不予通过|不予受理|拒收)|失信被执行人|重大税收违法|拖欠农民工工资|恶意串通|弄虚作假|虚假投标|禁止参与.*(?:投标|采购)|不得以任何形式进行转包|实质性响应.{0,24}(?:无效|拒绝|否决)|不满足.{0,24}(?:拒绝|无效|否决)|不符合.{0,24}(?:拒绝|无效|否决)|未满足.{0,24}投标无效|未提供.{0,24}(?:投标无效|无效标)|不符合资格.{0,24}(?:投标无效|拒绝)/;
const P0_POST_AWARD = /违约金|违约责任|赔偿|赔付|处罚|扣款|罚款|损失由|承担全部.*(?:责任|费用)|解除合同|终止合同|没收.*保证金|履约保证金|法律责任|侵权指控|知识产权.*索赔/;
const QUALIFICATION_EVIDENCE = /认证|资质证书|资质等级|检测报告|测评报告|软件著作权|项目经验|项目案例|业绩|客户(?:名称|案例)|历史项目|人员.*(?:证书|资格|经验)|工程师证书|安全等级保护/;
const PRODUCT_NOUN = /产品|设备|货物|服务器|交换机|防火墙|摄像机|存储|光模块|操作系统|数据库|软件|平台|系统|模块|接口|组件|终端|资源|GPU|CPU|内存/;
const PRODUCT_CAPABILITY = /支持|兼容|适配|互认证|具备|具有|拥有|已(?:经)?(?:支持|完成|取得|部署)|完成过|曾经|符合|参数|指标|性能|规格|型号|版本|主频|容量|吞吐|并发|响应时间|可靠性|稳定性/;
const PRODUCT_OFFERED = /所投(?:产品|设备|货物|系统|软件)|投标产品|拟提供(?:的)?(?:产品|设备|货物|系统|软件)|提供的(?:产品|设备|货物)|供货(?:产品|设备)|原厂(?:产品|设备)/;
const NUMERIC = /(?:\d+(?:\.\d+)?\s*(?:秒|分钟|小时|天|月|年|人|个|套|次|路|台|张|万|％|%|Gbps|Mpps|IOPS|TB|GB|MB|GHz|G|核|°|度|毫秒|ms|Mbps|MB\/s|M\/s|\/s|英寸|\"|”|毫米|mm|μm)|[<>≤≥]=?|不低于|不少于|不超过|至少|最高|最低|峰值|并发|吞吐|容量|占比)/i;
const DESIGN = /技术(?:方案|架构|路线)|实施(?:方案|计划|组织|方法|进度)|服务方案|架构(?:设计|方案)|部署(?:方案|设计)|集成(?:方案|设计)|迁移(?:方案|计划)|建设(?:方案|内容)|设计(?:开发|方案|思路)|搭建|规划|流程(?:设计|方案)|方法论|应急预案|培训方案|组织方案|项目管理|质量保证|管理办法|联调|上线方案|施工方案/;
const FUTURE_TIME = /中标后|合同(?:签订|生效|履行)|履约(?:期间|期内)|项目实施期间|项目建设过程中|服务期限|服务期内|质保期|质保期内|交付后|上线后|收到.*通知|开工后|工期|交货|交付|验收(?:前|后)?|驻场|派驻|在.{0,8}内完成/;
const SERVICE_OBLIGATION = /提供(?:服务|保障|响应|维护|运维|培训|资源|人员)|负责|完成|安排|配备|投入|驻场|维护|运维|培训|响应|保障|服务|质保|验收|交付|工期|承诺|保证|缴纳|承担|履行/;
const DELIVERY_NOUN = /采购|租赁|购买|供货|交货|货物|设备|资源|服务|人员|备件|耗材|费用|合同|保密|知识产权/;
const INFORMATIONAL = /仅供(?:背景)?参考|无需(?:投标人|供应商)?响应|不作为(?:评分|响应)|可以(?:按照|提出|要求)?|可(?:按照|提出|要求)?|有权|定义|适用|背景|目标|原则|总体要求|另行招标|费用不包含|采购人(?:或代理机构)?(?:应当|可以|有权)|质疑|答疑|投诉|异议|公告|备案/;
const INCOMPLETE_BOUNDARY = /(?:情形除外|等[，,]?$|以及[，,]?$|但应当[，,]?$|^有关(?:信息)?(?:以及|和)|^以及|^并且|^但)/;

function categoryOf(item) {
  return textOf(item.category ?? item.requirement_category).toLowerCase();
}

function scoringOf(text, item) {
  return /评分|评标|评审|得分|分值|权重|每提供|每满足|满分/.test(text)
    || [item.score, item.weight, item.max_score].some((value) => value != null);
}

function signalsOf(text, category, item) {
  const actor = has(text, ACTOR);
  const eligibility = has(text, BIDDER_ELIGIBILITY);
  const formality = has(text, PRE_AWARD_FORMALITY);
  const p0 = has(text, P0_CONSEQUENCE);
  const postAwardP0 = has(text, P0_POST_AWARD);
  const qualification = has(text, QUALIFICATION_EVIDENCE);
  const productNoun = has(text, PRODUCT_NOUN);
  const productCapability = productNoun && has(text, PRODUCT_CAPABILITY);
  const offered = has(text, PRODUCT_OFFERED);
  const productMetric = has(text, NUMERIC) && productNoun && !has(text, /工期|服务期限|质保期|驻场|人员|培训|交付/);
  const performanceMetric = /^(?:technical|performance)$/.test(category)
    && has(text, NUMERIC) && !has(text, DESIGN) && !has(text, FUTURE_TIME)
    && !has(text, /采购|租赁|购买|供货|交付|服务期限|质保期/);
  const technicalSpec = /^(?:technical|functional|performance|security)$/.test(category)
    && (productNoun || productMetric || productCapability || has(text, /传感器|视场角|速度|分区|日志|工具|协议|配置|接口|部署方式|缓存|会话|连接|容错/))
    && !has(text, DESIGN) && !has(text, FUTURE_TIME) && !has(text, /采购|租赁|购买|供货|交付/);
  const evidence = qualification || productCapability || productMetric || performanceMetric || technicalSpec || (category === CATEGORY.performance && productNoun);
  const design = has(text, DESIGN) || (category === CATEGORY.implementation && !has(text, FUTURE_TIME));
  const futureTime = has(text, FUTURE_TIME);
  const serviceObligation = has(text, SERVICE_OBLIGATION);
  const procurementDeliverable = has(text, /^(?:本项目)?\s*(?:应|须|需)?\s*(?:提供|采购|租赁|购买|交付|供货)/)
    || (has(text, /采购|租赁|购买/) && has(text, DELIVERY_NOUN));
  const future = futureTime && serviceObligation;
  const bareService = ['service', 'delivery', 'implementation', 'contractual'].includes(category)
    && serviceObligation && !evidence && !design;
  const strongFuture = future || bareService || procurementDeliverable;
  const bidderCompliance = actor && (eligibility || formality) && !(
    evidence && (offered || productMetric || has(text, /所投|投标产品|产品.*(?:支持|兼容|适配|参数|指标|符合)/))
  );
  const procedureCompliance = formality || (category === CATEGORY.context && (eligibility || has(text, /招标|采购|投标/)));
  const mixed = !p0 && evidence && design
    && (future || (serviceObligation && text.length >= 80))
    && text.length >= 30;
  // Boundary fragments are intrinsically incomplete even when a nearby noun
  // happens to make the fragment look topical.  Treat only explicit fragment
  // forms as malformed; this remains independent of any tender/case identity.
  const malformed = has(text, INCOMPLETE_BOUNDARY)
    && (/(?:情形除外|等[，,]?$|以及[，,]?$|但应当[，,]?$)/.test(text)
      || /^(?:有关(?:信息)?(?:以及|和)|以及|并且|但)/.test(text));
  return {
    actor,
    eligibility,
    formality,
    p0,
    postAwardP0,
    qualification,
    productNoun,
    productCapability,
    offered,
    productMetric,
    technicalSpec,
    performanceMetric,
    evidence,
    design,
    futureTime,
    future,
    procurementDeliverable,
    strongFuture,
    bidderCompliance,
    procedureCompliance,
    mixed,
    malformed,
    category,
    item
  };
}

function modeOf(text, s, baseline) {
  if (!text || s.malformed || s.mixed) return 'NEED_REVIEW';
  // Product/enterprise fact semantics are primary even when a proof document
  // or an invalid-bid consequence is mentioned in the same clause.
  const productDominant = s.evidence && (
    s.offered
    || s.productMetric
    || (s.productCapability && !s.eligibility)
    || (s.technicalSpec && !s.eligibility && !s.design && !s.futureTime
      && has(text, /提供|支持|兼容|适配|配置|参数|指标|规格|工具|接口|功能|能力/))
  );
  const procurementBoundary = s.procurementDeliverable
    && (/^(?:delivery|service|implementation|contractual|other)$/.test(s.category) || has(text, /采购|租赁|购买|供货/));
  const resourceProvision = /^(?:本项目)?\s*(?:应|须|需)?\s*提供/.test(text)
    && has(text, /服务|资源|人员|设备|货物|软件|系统/)
    && !has(text, /功能|能力|工具|接口|管理|查看|支持/);
  const explicitFutureCommitment = s.future || procurementBoundary
    || resourceProvision
    || (has(text, /中标人|乙方|合同|质保期|售后|交付|验收|驻场|运维|服务期限|有责任/) && s.serviceObligation);
  if (s.mixed) return 'NEED_REVIEW';
  if (s.bidderCompliance && !productDominant) return 'COMPLIANCE';
  if (s.p0 && !productDominant && (s.formality || s.eligibility || s.actor)) return 'COMPLIANCE';
  if (explicitFutureCommitment && baseline?.response_mode !== 'COMPLIANCE') return 'COMMITMENT';
  if ((productDominant || s.performanceMetric) && !s.future && !s.design && baseline?.response_mode !== 'COMPLIANCE') return 'EVIDENCE';
  if (s.strongFuture && !s.evidence && baseline?.response_mode !== 'COMPLIANCE') return 'COMMITMENT';
  if (s.future && s.evidence && !s.design && baseline?.response_mode !== 'COMPLIANCE') return 'COMMITMENT';
  if (s.procedureCompliance && !s.evidence && !s.design && !s.strongFuture) return 'COMPLIANCE';
  // Preserve a conservative deterministic read-model route for non-empty
  // context; NEED_REVIEW is reserved for absent or structurally incomplete
  // semantic subjects.
  return baseline?.response_mode || (text ? (s.category === CATEGORY.context ? 'COMPLIANCE' : 'SOLUTION') : 'NEED_REVIEW');
}

function riskOf(mode, text, s) {
  if (mode === 'NEED_REVIEW') return 'HIGH';
  if (mode === 'COMPLIANCE') {
    if (s.p0 || (s.bidderCompliance && s.eligibility) || has(text, /无效|否决|拒绝|不通过|取消资格|不予受理|没收|重大违法|失信|不得参加|不得参与/)) return 'P0';
    if (has(text, /背景|目标|原则|可以|可(?:以)?|有权|质疑|答疑|异议|公告|定义|适用|现场勘查|费用不包含|采购人|评标委员会/)
      && !has(text, /须|必须|应当|不得|提供.*(?:营业执照|证明|证书|资质|声明|承诺)/)) return 'LOW';
    if (s.qualification || has(text, /声明函|承诺函|证明|证书|营业执照|税务|社保|资质|资格/)) return 'HIGH';
    return 'MEDIUM';
  }
  if (mode === 'EVIDENCE') {
    if (s.p0 && has(text, /产品|设备|系统|软件|货物|技术响应/)) return 'P0';
    if (has(text, NUMERIC) || s.qualification || s.productCapability || has(text, /认证|资质|案例|业绩|客户|有效期|参数|指标|兼容|适配|性能|规格/)) return 'HIGH';
    return 'MEDIUM';
  }
  if (mode === 'COMMITMENT') {
    if (s.postAwardP0 || has(text, /扣款|罚款|赔偿|赔付|违约|没收|解除合同|终止合同|法律责任|不履行/)) return 'P0';
    if (has(text, /背景|目标|原则|可以|可(?:以)?|采购人(?:应当|可以)|另行招标|费用不包含|公告|备案/) && !has(text, /中标人|乙方|投标人应|必须/)) return 'LOW';
    if (s.future || s.procurementDeliverable || has(text, /服务|人员|交付|验收|质保|维护|运维|工期|响应|提供|采购|租赁|培训|资源/)) return 'HIGH';
    return 'MEDIUM';
  }
  // Current-project design defaults to MEDIUM; generic background/context is
  // LOW.  This keeps risk independent from mode and evidence dependency.
  if (mode === 'SOLUTION') {
    if (s.category === CATEGORY.context && has(text, /目标|原则|总体|包括|提升|构建|背景|内容/)) return 'LOW';
    if (Array.isArray(s.item.risk_flags) && s.item.risk_flags.some((flag) => /P0/i.test(String(flag)))) return 'P0';
    return 'MEDIUM';
  }
  return 'MEDIUM';
}

function responseRequiredOf(text, mode, s) {
  if (!text) return false;
  if (has(text, INFORMATIONAL) && (
    (mode === 'SOLUTION' && s.category === CATEGORY.context)
    || (mode === 'COMPLIANCE' && (has(text, /质疑|答疑|异议|投诉|公告|定义|适用|采购人|评标委员会|现场勘查|可以|有权/) && !has(text, /必须|须|不得|无效|拒绝/)))
    || (mode === 'COMMITMENT' && has(text, /采购人|采购方|另行招标|费用不包含|公告|备案/) && !has(text, /中标人|乙方|投标人须|投标人应/))
  )) return false;
  if (has(text, /无需(?:投标人|供应商)?响应|仅供(?:背景)?参考|不作为(?:评分|响应)/)) return false;
  if (has(text, /须|必须|应当|应|需|需要|要求|提供|支持|具备|具有|完成|承诺|保证|不得/)) return true;
  return mode !== 'NEED_REVIEW';
}

function secondaryDependencies(mode, text, s, scoring) {
  const out = [];
  const proof = has(text, /提供|证明|证书|报告|截图|复印件|扫描件|佐证|声明函|承诺函/);
  const enterprise = s.qualification || s.eligibility || s.productCapability || s.productMetric || has(text, /营业执照|资质|认证|案例|业绩|产品参数|技术参数|专业技术能力|独立承担民事责任/);
  if (proof && (s.evidence || s.bidderCompliance || s.procedureCompliance)) out.push('PROOF_DOCUMENT');
  if (mode === 'COMMITMENT' && enterprise) out.push('ENTERPRISE_EVIDENCE');
  if (mode === 'COMPLIANCE' && enterprise && has(text, /证明|证书|资料|材料|报告|截图|声明|承诺|资格|信用|营业执照|税务|社保|资质|产品标准/)) out.push('ENTERPRISE_EVIDENCE');
  if (mode === 'EVIDENCE' && s.future) out.push('PROJECT_COMMITMENT');
  if (scoring) out.push('SCORING');
  return [...new Set(out)].sort();
}

function reasonFamily(mode, text, s, scoring) {
  const reasons = [];
  if (mode === 'NEED_REVIEW') reasons.push(s.malformed ? 'INCOMPLETE_OR_BROKEN_BOUNDARY' : 'AMBIGUOUS_SUBJECT_OR_TEMPORAL_BOUNDARY');
  if (mode === 'COMPLIANCE') {
    if (s.p0) reasons.push('P0_OR_ELIGIBILITY_COMPLIANCE');
    else if (s.procedureCompliance) reasons.push('BID_FORMALITY_OR_PROCEDURE');
  }
  if (s.qualification || (s.evidence && mode === 'EVIDENCE')) reasons.push('ENTERPRISE_OR_PRODUCT_EVIDENCE');
  if (mode === 'COMMITMENT') reasons.push('PROJECT_OR_CONTRACT_COMMITMENT');
  if (mode === 'SOLUTION') reasons.push('PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN');
  if (scoring) reasons.push('SCORING_RELATED');
  return reasons.length ? [...new Set(reasons)].sort() : ['UNCLASSIFIED_RESPONSE_BOUNDARY'];
}

/**
 * Project one requirement with V2.1 systematic semantic-boundary rules.
 * The input is never mutated and no business state is persisted.
 */
export function projectRequirementResponseV21(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  const scoring = scoringOf(text, item);
  const s = signalsOf(text, category, item);
  const baseline = projectRequirementResponseV2(item, { projection_version: context.baseline_projection_version });
  const response_mode = modeOf(text, s, baseline);
  const evidence_dependency = response_mode === 'EVIDENCE'
    // Evidence dependency is independent of the primary lane.  A technical,
    // qualification, or product signal still requires enterprise proof even
    // when the primary boundary conservatively resolves to Compliance,
    // Commitment, or an abstention.
    || s.evidence
    || secondaryDependencies(response_mode, text, s, scoring).includes('ENTERPRISE_EVIDENCE');
  const risk_tier = riskOf(response_mode, text, s);
  const secondary_dependencies = secondaryDependencies(response_mode, text, s, scoring);
  const response_required = responseRequiredOf(text, response_mode, s);
  const human_required = response_mode === 'NEED_REVIEW'
    || (response_mode === 'EVIDENCE' && (risk_tier === 'P0' || item.requires_confirmation === true))
    || (response_mode === 'COMMITMENT' && (['HIGH', 'P0'].includes(risk_tier) || item.mandatory_observed === true))
    || (response_mode === 'COMPLIANCE' && ['HIGH', 'P0'].includes(risk_tier));
  const response_role = response_mode === 'COMPLIANCE' ? 'COMPLIANCE'
    : scoring ? 'SCORING'
      : response_mode === 'COMMITMENT' ? 'CONTRACT'
        : response_mode === 'SOLUTION' || response_mode === 'EVIDENCE' ? 'TECHNICAL' : 'NONE';
  const projection_version = context.projection_version || RESPONSE_ROUTER_V21_VERSION;
  // Keep a reference to the V2 shape for compatibility audits, but only copy
  // fields that are part of the read-only projection contract.
  return Object.freeze({
    requirement_id: item.requirement_id ?? item.canonical_requirement_id ?? null,
    response_role,
    response_mode,
    response_required,
    risk_tier,
    is_scoring_related: scoring,
    scoring_priority: scoring ? (has(text, /重大|关键|核心|最高|满分/) ? 'HIGH' : 'MEDIUM') : 'NONE',
    routing_reasons: reasonFamily(response_mode, text, s, scoring),
    secondary_dependencies,
    evidence_dependency,
    deep_chain_required: evidence_dependency || response_mode === 'COMMITMENT',
    human_required,
    projection_version,
    implementation_id: RESPONSE_ROUTER_V21_IMPLEMENTATION_ID,
    baseline_v2_mode: baseline.response_mode
  });
}

export const projectRequirementResponseV21ReadOnly = projectRequirementResponseV21;
