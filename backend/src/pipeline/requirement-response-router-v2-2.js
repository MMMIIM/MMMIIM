/**
 * Deterministic Response Router V2.2.
 *
 * V2.2 keeps the V2.1 projection contract and tightens only the general
 * boundary between existing enterprise/product facts and future delivery
 * obligations.  It is a pure read-model projection: no Gold, provider,
 * persistence, or case-specific data is consulted.
 */

import { projectRequirementResponseV21 } from './requirement-response-router-v2-1.js';

export const RESPONSE_ROUTER_V22_VERSION = 'v43-response-router-v2.2';
export const RESPONSE_ROUTER_V22_IMPLEMENTATION_ID = 'v43-response-router-v2.2-bounded-semantic-closure';

const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const has = (value, pattern) => pattern.test(value);
const list = (value) => Array.isArray(value) ? value : [];

// These are domain-level signals, deliberately independent of benchmark IDs,
// tender names, page numbers, and source hashes.
const ACTOR = /投标人|投标单位|投标方|供应商|中标人|乙方|承包方|承建方|厂商/;
const P0_CONSEQUENCE = /(?:投标|响应|资格|供应商|文件|产品|报价|标书).{0,24}(?:无效|否决|废标|拒收|拒绝|取消资格|不通过)|(?:无效投标|投标无效|无效标|否决投标|废标|取消中标资格|拒绝参与|不得参加|不得参与|不得同时参加|不接受联合体|无资格参加|禁止参加|资格审查不通过|视为无效|不予通过|不予受理|拒收)|失信被执行人|重大税收违法|恶意串通|弄虚作假|虚假投标|不得以任何形式进行转包|不符合资格.{0,24}(?:投标无效|拒绝)/;
const PRE_AWARD_FORMALITY = /投标文件|响应文件|投标截止|递交|上传|电子投标|电子签章|签字|签章|盖章|公章|CA锁|CA数字证书|CA证书|开标|评标|评审|质疑|答疑|异议|投诉|报价|投标有效期|投标保证金|声明函|承诺函|翻译文件/;
const ELIGIBILITY = /营业执照|法人证书|民事责任|税务|社会保障|社会保险|社保|信用记录|失信|重大违法|资格(?:审查|条件|要求|证明|等级)?|联合体|控股|管理关系|法定代表人|分支机构|不接受联合体|投标资格|许可证|财务会计|商业信誉|专业技术能力|设备和专业|中小企业|监狱企业|残疾人福利性单位/;
const PROOF_DOCUMENT = /须提供|应提供|需提供|提供.*(?:证书|报告|截图|复印件|扫描件|佐证|证明|材料)|证明材料|证书复印件|功能截图|测试报告|检测报告/;
const EXPLICIT_EXISTING = /现有|已有|已经|已取得|已获得|具备|具有|拥有|完成过|曾经|长期|成熟|正式员工|完善的.*(?:体系|团队|能力)|建立(?:了)?(?:全国|完善的)?(?:技术支持|技术服务|运维服务).{0,12}(?:体系|团队|制度)/;
const PRODUCT_NOUN = /产品|设备|货物|服务器|交换机|防火墙|摄像机|存储|光模块|操作系统|数据库|软件|平台|系统|模块|接口|组件|终端|资源|GPU|CPU|内存|算法库|证书|表空间|SQL(?:Server)?|MySQL|Oracle|OpenSSL|PKCS/;
const PRODUCT_CAPABILITY = /支持|兼容|适配|互认证|具备|具有|拥有|已(?:经)?(?:支持|完成|取得|部署)|完成过|符合|参数|指标|性能|规格|型号|版本|主频|容量|吞吐|并发|响应时间|可靠性|稳定性|管理(?:功能)?|功能|可用性|恢复|备份|加密|访问控制|身份鉴别/;
const PRODUCT_OFFERED = /所(?:投|供)(?:产品|设备|货物|系统|软件)|投标产品|拟提供(?:的)?(?:产品|设备|货物|系统|软件)|提供的(?:产品|设备|货物)|供货(?:产品|设备)|原厂(?:产品|设备)|所供货物/;
const NUMERIC = /(?:\d+(?:\.\d+)?\s*(?:秒|分钟|小时|天|月|年|人|个|套|次|路|台|张|万|％|%|Gbps|Mpps|IOPS|TB|GB|MB|GHz|G|核|°|度|毫秒|ms|Mbps|MB\/s|M\/s|\/s|英寸|"|”|毫米|mm|μm)|[<>≤≥]=?|不低于|不少于|不超过|至少|最高|最低|峰值|并发|吞吐|容量|占比)/i;
const DESIGN = /技术(?:方案|架构|路线)|实施(?:方案|计划|组织|方法|进度)|服务方案|架构(?:设计|方案)|部署(?:方案|设计)|集成(?:方案|设计)|迁移(?:方案|计划)|建设(?:方案|内容)|设计(?:开发|方案|思路)|搭建|规划|流程(?:设计|方案)|方法论|应急预案|培训方案|组织方案|项目管理|质量保证|管理办法|联调|上线方案|施工方案/;
const FUTURE_TIME = /中标后|合同(?:签订|生效|履行)|履约(?:期间|期内)|项目实施期间|项目建设过程中|服务期限|服务期内|质保期|质保期内|交付后|上线后|收到.*通知|开工后|工期|交货|交付|验收(?:前|后)?|驻场|派驻|在.{0,8}内完成|周期内/;
const SERVICE_OBLIGATION = /提供(?:服务|保障|响应|维护|运维|培训|资源|人员|升级|保修|安装|调试|资料|文档)|负责|完成|安排|配备|投入|驻场|维护|运维|培训|响应|保障|服务(?!器)|质保|验收|交付|工期|承诺|保证|缴纳|承担|履行|巡检|检修|维修|更换|保养|备件|到场|恢复/;
// Keep "处理器" and similar product nouns from being treated as SLA clauses.
const SLA = /(?:响应|故障处理|故障响应|解决时限|到场|恢复|故障|服务水平|SLA).{0,36}(?:\d|不超过|不少于|以内|小时|分钟|秒|天|立即|及时)/i;
const DELIVERY = /提供(?:证书|数字证书|USBKey|手写签名|技术资料|文档|产品安装|现场调试)|采购|租赁|购买|供货|交货|交付|验收|备件|耗材|免费(?:更换|维修)/;
const POST_AWARD_PENALTY = /违约金|违约责任|赔偿|赔付|处罚|扣款|罚款|损失由|承担全部.*(?:责任|费用)|解除合同|终止合同|没收.*保证金|履约保证金|法律责任|侵权指控/;
const INFORMATIONAL = /仅供(?:背景)?参考|无需(?:投标人|供应商)?响应|不作为(?:评分|响应)|背景|目标|原则|总体要求|另行招标|费用不包含|采购人(?:或代理机构)?(?:应当|可以|有权)|质疑|答疑|投诉|异议|公告|备案/;

function categoryOf(item) { return textOf(item.category ?? item.requirement_category).toLowerCase(); }

function classifySignals(item, base) {
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  const actor = has(text, ACTOR);
  const eligibility = has(text, ELIGIBILITY);
  const formality = has(text, PRE_AWARD_FORMALITY);
  const p0 = has(text, P0_CONSEQUENCE);
  const proof = has(text, PROOF_DOCUMENT);
  const productNoun = has(text, PRODUCT_NOUN);
  const capability = has(text, PRODUCT_CAPABILITY);
  const offered = has(text, PRODUCT_OFFERED);
  const futureTime = has(text, FUTURE_TIME);
  const service = has(text, SERVICE_OBLIGATION);
  const sla = has(text, SLA);
  const delivery = has(text, DELIVERY);
  const design = has(text, DESIGN);
  const explicitExisting = has(text, EXPLICIT_EXISTING);
  const technicalTokens = has(text, /算法|协议|接口|参数|指标|规格|语法|数据类型|加密|密码|访问控制|身份鉴别|归档|备份|还原|容灾|兼容|适配|功能截图/);
  const metric = has(text, NUMERIC);
  const technicalCapabilityVerb = has(text, /支持|兼容|适配|符合|满足|管理|配置|提供[^。；]{0,30}(?:功能|能力|接口|参数|规格|身份|访问控制|加解密|加密|备份|还原|容灾)/);
  const servicePhrase = has(text, /(?:技术支持|技术服务|运维|维护|保修|售后|升级|响应|故障处理)服务/);
  const maintenanceObligation = has(text, /(?:维护|运维|优化|巡检|检修|维修|保养|杀毒|病毒查杀|故障诊断|诊断处理|策略制定|状态监测|备件|保密|遵守|遵循|承担.*责任|咨询|处理(?!器)).{0,24}(?:服务|责任|应|需|须|必须|提供|开展|进行|目标|记录|备件)?/)
    || has(text, /(?:应|需|须|必须|负责|提供|开展|进行|每月|每季度|定期|周期内).{0,32}(?:升级|清理|恢复).{0,20}(?:服务|系统运行|终端|病毒|特征库|性能|故障)/)
    || has(text, /(?:项目执行|运维|网络|系统).{0,20}(?:应|需|须|必须).{0,32}(?:遵循|遵守|故障处理|策略制定|状态监测|网络性能优化|数据备份与恢复)/);
  const integrationObligation = has(text, /(?:应|需|须|必须).{0,20}(?:接入|部署|安装|配置|实现)/)
    || has(text, /按照接入路数收费|提供.*(?:文档|资料|手册|报告)/)
    || has(text, /(?:应|需|须|必须).{0,36}(?:完成|告知|协商).{0,20}(?:\d|一周|一个月|时间)/)
    || has(text, /(?:可用性目标|可接受|不可接受)/);
  const periodicObligation = has(text, /(?:每月|每季度|每周|定期|周期内).{0,32}(?:检查|巡检|开展|进行|目标|可接受|不可接受)/);
  const productCapabilityEvidence = (
    (capability && (productNoun || technicalTokens) && (technicalCapabilityVerb || metric) && (!servicePhrase || technicalTokens || has(text, /功能|兼容|适配|参数|指标|体系|团队/)))
    || (offered && (productNoun || technicalTokens))
    || (technicalTokens && technicalCapabilityVerb && (productNoun || category === 'technical' || category === 'performance'))
    || (has(text, /认证|资质|项目经验|项目案例|业绩|客户案例|检测报告|测评报告|软件著作权|安全等级保护/) && !delivery)
  );
  const productEvidence = !futureTime && !design
    && !sla && !maintenanceObligation && !periodicObligation && !integrationObligation
    && (productCapabilityEvidence || (explicitExisting && has(text, /体系|团队|能力|系统|服务/)));
  // A future obligation takes precedence over generic verbs such as 提供、支持、服务.
  // Product capability phrases (提供...功能 / 支持...参数) remain evidence.
  const futureObligation = !productEvidence && (
    futureTime
    || sla
    || (service && (delivery || /服务|维护|运维|保修|升级|响应|维修|巡检|培训|驻场|到场|备件|故障/.test(text)))
    || (delivery && (!technicalTokens || has(text, /文档|资料|手册|报告|证书|USBKey|安装|调试/)))
    || maintenanceObligation
    || integrationObligation
    || periodicObligation
    || (['service', 'delivery', 'implementation', 'contractual'].includes(category) && service && !design)
    || (/^(?:本项目)?\s*(?:应|须|需|必须)?\s*(?:提供|负责|配备|安排|建立)/.test(text) && service && !productEvidence)
  );
  const existingSystem = explicitExisting && has(text, /服务(?:支持)?体系|服务团队|技术支持|技术服务|运维服务|能力/)
    && !has(text, /中标后|合同|质保期|服务期限|交付后/);
  const complianceOnly = (p0 || formality || eligibility) && !productEvidence && !existingSystem
    && (formality || eligibility || actor)
    && (!futureObligation || has(text, /承诺函|无需再提交|按照规定|CA(?:锁|数字证书)?|上传|签章|盖章|翻译/));
  const mixed = Boolean(base.response_mode === 'NEED_REVIEW') || (
    productEvidence && futureObligation && (
      has(text, /方案|设计|建立|提供服务|支持服务|服务体系|用户服务记录|备品备件/)
      || text.length >= 120 && (text.match(/[；;]/g) || []).length >= 2
      || /[a-z]\)/i.test(text)
    )
  ) || (
    service && text.length >= 120
    && ((text.match(/[；;]/g) || []).length >= 2 || /[a-z]\)/i.test(text))
    && has(text, /体系|团队|制度|记录|备品备件|升级|培训|服务|技术资料|优化指南/)
  ) || (
    service && futureObligation && has(text, /建立.*制度|用户服务记录|备品备件/)
  );
  const explicitExistingProof = explicitExisting && proof && !futureObligation;
  const complianceEvidence = eligibility && proof && !has(text, /CA|上传|签章|盖章|翻译|承诺函|无需再提交/);
  return { text, category, actor, eligibility, formality, p0, proof, productNoun, capability, offered, futureTime, service, sla, delivery, design, technicalTokens, productEvidence, futureObligation, existingSystem, complianceOnly, mixed, explicitExistingProof, complianceEvidence, base };
}

function reasonFor(mode, s, scoring) {
  const reasons = [];
  if (mode === 'NEED_REVIEW') reasons.push('AMBIGUOUS_SUBJECT_OR_TEMPORAL_BOUNDARY');
  if (mode === 'COMPLIANCE') reasons.push(s.p0 ? 'P0_OR_ELIGIBILITY_COMPLIANCE' : 'BID_FORMALITY_OR_PROCEDURE');
  if (mode === 'EVIDENCE') reasons.push('ENTERPRISE_OR_PRODUCT_EVIDENCE');
  if (mode === 'COMMITMENT') reasons.push('PROJECT_OR_CONTRACT_COMMITMENT');
  if (mode === 'SOLUTION') reasons.push('PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN');
  if (scoring) reasons.push('SCORING_RELATED');
  return [...new Set(reasons)];
}

function riskFor(mode, s) {
  if (mode === 'NEED_REVIEW') return 'HIGH';
  if (mode === 'COMPLIANCE') return s.p0 ? 'P0' : (s.complianceEvidence ? 'HIGH' : 'MEDIUM');
  if (mode === 'EVIDENCE') return (s.p0 && s.productEvidence) || s.productEvidence || s.proof ? 'HIGH' : 'MEDIUM';
  if (mode === 'COMMITMENT') return s.p0 && !s.futureObligation ? 'P0' : (s.futureObligation || s.sla || s.service || s.delivery ? 'HIGH' : 'MEDIUM');
  return s.base.risk_tier === 'LOW' ? 'LOW' : 'MEDIUM';
}

function modeFor(s) {
  if (!s.text || s.mixed) return 'NEED_REVIEW';
  const productDominant = s.productEvidence || s.existingSystem;
  if (s.p0 && !has(s.text, POST_AWARD_PENALTY) && (s.formality || s.eligibility || s.actor)) return 'COMPLIANCE';
  if (s.complianceOnly) return 'COMPLIANCE';
  if (s.futureObligation && !productDominant) return 'COMMITMENT';
  if (productDominant) return 'EVIDENCE';
  if (s.p0 && (s.formality || s.eligibility || s.actor)) return 'COMPLIANCE';
  return s.base.response_mode;
}

function secondary(mode, s, scoring) {
  const out = [];
  if (scoring) out.push('SCORING');
  if (s.proof && (mode === 'EVIDENCE' || (mode === 'COMPLIANCE' && s.complianceEvidence))) out.push('PROOF_DOCUMENT');
  if ((mode === 'EVIDENCE' && s.futureObligation) || (mode === 'COMMITMENT' && s.explicitExistingProof)) out.push('ENTERPRISE_EVIDENCE');
  return [...new Set(out)].sort();
}

function responseRequired(text, mode, base) {
  if (!text) return false;
  if (has(text, /无需(?:投标人|供应商)?响应|仅供(?:背景)?参考|不作为(?:评分|响应)/)) return false;
  if (has(text, INFORMATIONAL) && mode === 'COMPLIANCE' && !has(text, /必须|须|应当|不得|无效|拒绝/)) return false;
  return base.response_required !== false;
}

/** Project a requirement using the bounded V2.2 semantic boundary rules. */
export function projectRequirementResponseV22(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const base = projectRequirementResponseV21(item, context);
  const s = classifySignals(item, base);
  const mode = modeFor(s);
  const scoring = base.is_scoring_related === true;
  const evidenceDependency = mode === 'EVIDENCE'
      ? true
      : mode === 'COMPLIANCE'
        ? s.complianceEvidence
      : mode === 'NEED_REVIEW'
        ? base.evidence_dependency === true
          || s.productEvidence
          || s.existingSystem
          || s.explicitExistingProof
          || has(s.text, /体系|团队|制度|记录|备品备件|认证|资质|项目案例|业绩/)
        : s.explicitExistingProof;
  const risk = riskFor(mode, s);
  const responseRequiredValue = responseRequired(s.text, mode, base);
  const humanRequired = mode === 'NEED_REVIEW'
    || (mode === 'EVIDENCE' && (risk === 'P0' || item.requires_confirmation === true))
    || (mode === 'COMMITMENT' && ['HIGH', 'P0'].includes(risk))
    || (mode === 'COMPLIANCE' && ['HIGH', 'P0'].includes(risk));
  const responseRole = mode === 'COMPLIANCE' ? 'COMPLIANCE'
    : scoring ? 'SCORING'
      : mode === 'COMMITMENT' ? 'CONTRACT'
        : mode === 'SOLUTION' || mode === 'EVIDENCE' ? 'TECHNICAL' : 'NONE';
  return Object.freeze({
    ...base,
    requirement_id: item.requirement_id ?? item.canonical_requirement_id ?? null,
    response_role: responseRole,
    response_mode: mode,
    response_required: responseRequiredValue,
    risk_tier: risk,
    is_scoring_related: scoring,
    scoring_priority: base.scoring_priority,
    routing_reasons: reasonFor(mode, s, scoring),
    secondary_dependencies: secondary(mode, s, scoring),
    evidence_dependency: evidenceDependency,
    deep_chain_required: evidenceDependency || mode === 'COMMITMENT',
    human_required: humanRequired,
    projection_version: context.projection_version || RESPONSE_ROUTER_V22_VERSION,
    implementation_id: RESPONSE_ROUTER_V22_IMPLEMENTATION_ID,
    baseline_v21_mode: base.response_mode
  });
}

export const projectRequirementResponseV22ReadOnly = projectRequirementResponseV22;
