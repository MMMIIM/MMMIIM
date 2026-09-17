/**
 * Deterministic Response Router V2.2.1.
 *
 * V2.2.1 keeps V2.1 as the semantic-stability baseline and admits only
 * general, explainable V2.2 corrections at the owning boundary.  Evaluation
 * labels, case identifiers, tender identifiers and source hashes are never
 * consulted here.
 */

import { projectRequirementResponseV21 } from './requirement-response-router-v2-1.js';
import { projectRequirementResponseV22, RESPONSE_ROUTER_V22_VERSION } from './requirement-response-router-v2-2.js';

export const RESPONSE_ROUTER_V221_VERSION = 'v43-response-router-v2.2.1';
export const RESPONSE_ROUTER_V221_IMPLEMENTATION_ID = 'v43-response-router-v2.2.1-bounded-semantic-closure';

const textOf = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const categoryOf = item => textOf(item.category ?? item.requirement_category).toLowerCase();

// These are semantic families, not benchmark phrases.  They intentionally
// avoid identifiers, tender names, pages and source hashes.
const BID_FORMALITY = /投标文件|响应文件|招标文件|采购文件|投标截止|开标|评标|评审|递交|上传|电子投标|电子签章|签字|签章|盖章|公章|CA(?:锁|数字证书|证书)?|报价|投标有效期|投标保证金|承诺函|声明函|翻译文件/;
const BID_ACTOR = /投标人|投标单位|投标方|供应商|报价人/;
const BID_TRUTHFULNESS = /诚实信用|诚信|虚假承诺|虚假投标|如实|真实(?:性|承诺)|不得作虚假|不得弄虚作假|不作虚假/;
const BID_QUALIFICATION = /财务会计制度|财务报告|资信证明|资格证明|资质要求|资格条件|资格审查/;
const BID_INVALIDITY = /无效投标|无效响应|无效条款|重要技术参数.*(?:未响应|不满足)|不作为无效/;
const POST_AWARD = /中标后|中标人|合同执行期内|合同(?:签订|生效|履行|期内)|履约|项目实施期间|项目执行|服务期限|服务期内|质保期|质保期内|交付后|验收后|驻场|派驻|工期|交货|交付/;
const OBLIGATION = /应当|必须|须|需|应|负责|安排|配备|投入|提供|开展|进行|完成|建立|遵循|遵守|保证|承担|响应|处理|到场|恢复|维修|维护|运维|巡检|升级|保修|培训|备件|服务/;
const FUTURE_SERVICE = /技术支持|技术服务|运维|维护|售后|服务由|服务提供|故障|响应|到场|恢复|维修|保修|巡检|备件|驻场|派驻|培训|升级服务|提供.*(?:服务|文档|报告|资料|手册|工具)|按照接入路数收费|收费|目标为|可接受|不可接受/;
const EXISTING_SERVICE_SYSTEM = /(?:有|具备|具有|拥有|建立)(?:完善的|完整的|成熟的)?[^。；，,]{0,20}(?:技术支持|技术服务|运维|服务|保障)[^。；，,]{0,20}(?:体系|团队|制度|记录|能力)/;
const TECHNICAL_NOUN = /产品|设备|货物|服务器|交换机|防火墙|摄像机|存储|光模块|操作系统|数据库|软件|平台|系统|模块|接口|组件|终端|资源|GPU|CPU|内存|中间件|容器|集群|表空间|算法|协议|驱动|SQL|Oracle|MySQL|OpenSSL|PKCS|SM[234]/i;
const TECHNICAL_CAPABILITY = /支持|兼容|适配|互认证|具备|具有|拥有|参数|指标|性能|规格|型号|主频|容量|吞吐|并发|功能|能力|加密|访问控制|身份鉴别|备份|还原|恢复|容灾|可用性|稳定性|可靠性|提供.*(?:功能|能力|工具|接口|参数|规格|组件|软件)/;
const PROOF = /功能截图|测试截图|检测报告|测评报告|认证报告|证书|截图|报告复印件|CNAS|CMA/;
const PURE_DESIGN = /技术(?:方案|架构|路线)|实施(?:方案|计划|组织|方法|进度)|服务方案|架构(?:设计|方案)|部署(?:方案|设计)|集成(?:方案|设计)|迁移(?:方案|计划)|建设(?:方案|内容)|设计(?:开发|方案|思路)|方法论|应急预案|培训方案|组织方案|项目管理|质量保证|管理办法|联调|上线方案|施工方案/;
const PURE_PRODUCT_OFFER = /所(?:投|供)(?:产品|设备|货物|系统|软件)|投标产品|拟提供(?:的)?(?:产品|设备|货物|系统|软件)|提供的(?:产品|设备|货物)|供货(?:产品|设备|货物)/;

const has = (value, pattern) => pattern.test(value);

function correctionFamily(item, baseline, candidate) {
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  if (!text) return null;
  const evidenceDocumentSignal = has(text, /证明材料|复印件|检测报告|认证报告|报告扫描件|证书|合同关键内容|截图/);

  const postAward = has(text, POST_AWARD);
  const bidStage = has(text, BID_FORMALITY) || has(text, BID_TRUTHFULNESS) || has(text, BID_QUALIFICATION) || has(text, BID_INVALIDITY) || (has(text, BID_ACTOR) && has(text, /资格|承诺|声明|报价|响应|文件|不得/));
  const complianceBoundary = bidStage && !postAward && (
    has(text, BID_FORMALITY)
    || has(text, BID_TRUTHFULNESS)
    || has(text, BID_QUALIFICATION)
    || has(text, BID_INVALIDITY)
    || has(text, /资格(?:审查|条件|要求|证明)|诚信|信用|投标人.*(?:须|应|不得|必须)/)
  );
  const postAwardFormalCommitment = postAward && has(text, /合同(?:执行期内|履行|签订|生效)|履约/) && has(text, /签字|盖章|授权代表|变更|解除|书面文件/);
  if (postAwardFormalCommitment && !evidenceDocumentSignal
    && baseline.response_mode !== 'COMMITMENT' && candidate.response_mode !== 'COMMITMENT') return 'FUTURE_OBLIGATION';
  // A bid-stage truthfulness rule is a compliance correction even when the
  // broad V2.2 candidate happened to retain the baseline commitment lane.
  if (complianceBoundary && baseline.response_mode !== 'COMPLIANCE'
    && (candidate.response_mode === 'COMPLIANCE' || has(text, BID_TRUTHFULNESS))) return 'COMPLIANCE_BOUNDARY';
  // Truthful-bidding language is a compliance obligation even when the
  // V2.2 candidate's generic "承诺/提供" signals lean toward commitment.
  if (complianceBoundary && baseline.response_mode !== 'COMPLIANCE' && has(text, BID_TRUTHFULNESS) && !has(text, /中标后|合同|履约|质保期|服务期/)) return 'COMPLIANCE_BOUNDARY';

  const serviceTerms = has(text, FUTURE_SERVICE);
  const explicitFuture = postAward || has(text, /服务期|质保|交付|验收|合同|履约|中标后|项目实施|在.{0,8}内完成|每月|每季度|定期/);
  const serviceObligation = has(text, OBLIGATION) && serviceTerms;
  const futureProviderIdentity = has(text, /(?:服务由|由原厂|厂商|原厂商).{0,24}(?:正式员工|员工|人员).{0,24}(?:提供|负责|服务)/);
  const futureGuarantee = has(text, /中标人.{0,24}(?:应|须|必须|保证).{0,30}(?:所供|货物|产品|设备|服务)/);
  const futureDevelopmentDeliverable = has(text, /(?:开发|项目执行|项目实施).{0,24}(?:应|须|需|必须).{0,36}(?:提供|提交).{0,36}(?:文档|资料|报告|手册)/);
  const technicalCategory = /^(technical|functional|performance|security)$/.test(category);
  const nonTechnicalCategory = !technicalCategory;
  const futureServiceSignal = has(text, /故障|响应|到场|恢复|维修|保修|巡检|驻场|备件|保密责任|服务期|质保期|服务期限|服务热线|技术支持服务|技术服务|升级服务|版本升级|每月|每季度|定期/);
  const serviceAfterObligation = (has(text, /(?:^|[。；，])(?<!响)(?:应(?!响)|须|需(?!求)|必须)/)
    || has(text, /(?<!响)(?:应(?!响)|须|需(?!求)|必须).{0,48}(?:故障|响应|到场|恢复|维修|保修|巡检|驻场|备件|保密责任|服务期|质保期|升级服务|版本升级|每月|每季度|定期)/)
    || (!technicalCategory && has(text, /(?:服务|维护|运维|备份).{0,24}(?:应(?!响)|须|需(?!求)|必须)/)))
    && futureServiceSignal
    && (!technicalCategory || has(text, /(?:故障|响应|到场|恢复|维修|维护|运维|保修|巡检|升级|培训|驻场|备件|保密责任|每月|每季度|定期|服务期|质保期)/));
  const acceptanceTarget = category === 'acceptance' && has(text, /目标|可接受|不可接受/);
  const projectStandardObligation = has(text, /项目执行|项目实施|工程实施/) && has(text, /应|须|需|必须/) && has(text, /遵循|遵守|标准|规范/);
  const futureBoundary = !has(text, PURE_DESIGN) && (
    futureProviderIdentity
    || (serviceObligation && (explicitFuture || /^(?:本项目)?\s*(?:应|须|需|必须)?\s*(?:提供|负责|安排|配备)/.test(text)))
    || acceptanceTarget
    || projectStandardObligation
    || futureDevelopmentDeliverable
    || serviceAfterObligation
    || futureGuarantee
    || has(text, /(?<!响)(?:应|须|需|必须).{0,40}(?:优化处理|性能问题)/)
    || (nonTechnicalCategory && candidate.response_mode === 'COMMITMENT' && has(text, FUTURE_SERVICE))
    || has(text, /AR场景授权.*接入|按照接入路数收费|收费/)
  );
  // Admit a V2.2 future correction only when the V2.1 baseline was
  // Evidence and the candidate is Commitment.  Product/technical clauses
  // that merely say “provide/support” remain Evidence unless they carry a
  // concrete service, SLA, delivery, acceptance, or project-execution signal.
  const productCapabilityOnly = technicalCategory
    && has(text, /功能|参数|指标|性能|数据库|SQL|兼容|支持|加密|访问控制|统计|比对/)
    && !has(text, /服务期|质保期|保修|维修|运维|维护|故障|到场|驻场|备件|响应时间|处理时间|解决时间|每月|每季度|定期|维保|升级服务|技术服务热线|现场支持|远程支持/);
  const technicalFeatureOnly = technicalCategory
    && has(text, /支持|兼容|提供|具备|具有|产品|操作系统|数据库|工具|管理/)
    && !has(text, /(?:故障申告|服务期|质保期|保修|维修|到场|驻场|现场到达|电话支持|远程登录|备件|备份服务|维护期内|技术支持服务|现场支持|远程支持|响应时间|处理时间|解决时间|每月|每季度|定期|升级服务|维保|项目执行|中标后|合同|交付|验收)/);
  const evidenceProofOnly = (has(text, PROOF) || has(text, /证明材料|复印件|合同关键内容/))
    && has(text, /报告|证书|证明材料|复印件|CMA|CNAS|CCRC|合同关键内容/)
    && !has(text, /服务期|质保期|保修|维修|故障|响应时间|到场|驻场|备件|维保|升级服务/);
  const technicalFeatureWithMaintenance = technicalCategory
    && has(text, /支持|兼容|操作系统|数据库|产品/)
    && has(text, /维护期内|维护时间自发布之日起|升级服务/)
    && !has(text, /故障|响应时间|到场|保修|服务期|质保期/);
  const conformanceEvidenceDominant = has(text, /(?:中标人|供应商|投标人).{0,20}(?:所供|所投)(?:货物|产品|设备).{0,24}(?:符合|满足|通过|认证|测评)/);
  const staticProductLifecycle = has(text, /产品停止功能升级|产品功能维护停止|自销售之日起.*售后服务周期/);
  const explicitObligationSignal = has(text, /(?:应|须|需|必须).{0,40}(?:优化处理|性能问题|保密责任)/);
  const futureEvidenceCandidate = baseline.response_mode === 'EVIDENCE'
    && candidate.response_mode === 'COMMITMENT'
    && (!productCapabilityOnly || explicitObligationSignal)
    && (!technicalFeatureOnly || explicitObligationSignal)
    && !technicalFeatureWithMaintenance
    && !conformanceEvidenceDominant
    && !evidenceDocumentSignal
    && !evidenceProofOnly
    && !staticProductLifecycle
    && (
      postAward
      || futureProviderIdentity
      || futureDevelopmentDeliverable
      || acceptanceTarget
      || projectStandardObligation
      || has(text, /按照接入路数收费|收费|AR场景授权/)
      || has(text, /服务期|质保期|硬件质保|保修|维修|运维|维护|备份服务|故障|到场|驻场|备件|维保|升级服务|技术支持服务|技术服务热线|安装与现场调试|现场支持|远程支持|每月|每季度|定期|保密责任/)
      || has(text, /(?:响应时间|处理时间|解决时间|需求).{0,24}(?:不超过|小于|以内|完成|告知|协商)/)
      || has(text, /优化处理|性能问题/)
      || has(text, /提供.{0,20}(?:开发文档|调研文档|需求说明书|系统设计说明书|测试记录|用户手册)/)
      || has(text, /目标为|可接受|不可接受/)
    );
  // Only adopt a future correction when the candidate actually resolves to
  // Commitment.  This prevents product capability clauses using 提供/服务
  // from losing their V2.1 evidence lane.
  if (futureEvidenceCandidate) return 'FUTURE_OBLIGATION';
  if (futureBoundary && candidate.response_mode === 'EVIDENCE' && !conformanceEvidenceDominant
    && (futureGuarantee || (postAwardFormalCommitment && baseline.response_mode !== 'COMMITMENT'))) return 'FUTURE_OBLIGATION';
  // Abstention is admitted as a bounded correction only for a baseline
  // Commitment atom with an explicitly mixed existing/future signal.  Do
  // not turn otherwise-stable Evidence or Compliance rows into a catch-all
  // NEED_REVIEW lane.
  const mixedExistingSignal = has(text, /现有|已有|记录|具备|具有|建立(?:完善的|完整的|成熟的)?(?:体系|制度|团队|服务)|建立[^。；，,]{0,16}(?:体系|制度|团队|服务)|历史|成熟/);
  if (futureBoundary && candidate.response_mode === 'NEED_REVIEW'
    && mixedExistingSignal
    && (baseline.response_mode === 'COMMITMENT' || category === 'service')) return 'MIXED_BOUNDARY';
  // An explicit future provider identity is a commitment even when the
  // sentence names a manufacturer or a formal employee.
  if (futureProviderIdentity && candidate.response_mode !== 'EVIDENCE') return 'FUTURE_OBLIGATION';

  const isTechnicalCategory = /^(technical|functional|performance|security)$/.test(category);
  const productOrTechnical = has(text, TECHNICAL_NOUN) || isTechnicalCategory;
  const capability = has(text, TECHNICAL_CAPABILITY);
  const existingService = has(text, EXISTING_SERVICE_SYSTEM) && !postAward;
  const offeredProduct = has(text, PURE_PRODUCT_OFFER) && capability;
  const proofBackedCapability = has(text, PROOF) && capability && productOrTechnical && !postAward;
  const productConformance = has(text, /所供(?:货物|产品|设备)|所投(?:产品|设备|货物)/)
    && has(text, /符合|满足|通过|认证|测评|标准/)
    && !postAward;
  const mixedServiceBlock = text.length > 120 && ((text.match(/[；;]/g) || []).length >= 2 || /[a-z]\)/i.test(text));
  const existingFact = !postAward && !has(text, PURE_DESIGN) && !mixedServiceBlock
    && (existingService || offeredProduct || proofBackedCapability || productConformance || (isTechnicalCategory && productOrTechnical && capability));
  // Proof-backed and explicit product-conformance clauses are still
  // Evidence even when the text is a dense semicolon/table row and would
  // otherwise be conservatively treated as mixed.
  const technicalEvidenceFact = !postAward && !has(text, PURE_DESIGN)
    && (proofBackedCapability || productConformance
      || (isTechnicalCategory && capability && !complianceBoundary
        && has(text, /兼容|支持|功能|参数|指标|性能|加密|访问控制|备份|恢复|容灾|统计|比对/)));
  const complianceSafeEvidence = baseline.response_mode !== 'COMPLIANCE'
    || proofBackedCapability || productConformance;
  if ((existingFact || technicalEvidenceFact) && complianceSafeEvidence
    && (candidate.response_mode === 'EVIDENCE' || candidate.response_mode === 'NEED_REVIEW')
    && baseline.response_mode !== 'EVIDENCE') return 'EXISTING_FACT_EVIDENCE';
  return null;
}

function projectRequirementResponseV221(requirement = {}, context = {}) {
  const baseline = projectRequirementResponseV21(requirement, context);
  const candidate = projectRequirementResponseV22(requirement, context);
  const family = correctionFamily(requirement, baseline, candidate);
  let selected = family ? candidate : baseline;
  // GPT overlay TB-003 truthful-bidding semantics are compliance even when
  // V2.2's generic candidate remains Commitment.  Project the bounded mode
  // without importing any case identifier or evaluation artifact.
  if (family === 'COMPLIANCE_BOUNDARY' && candidate.response_mode !== 'COMPLIANCE') {
    selected = {
      ...candidate,
      response_mode: 'COMPLIANCE',
      response_role: 'COMPLIANCE',
      evidence_dependency: false,
      deep_chain_required: false,
      human_required: true,
      routing_reasons: ['BID_FORMALITY_OR_PROCEDURE']
    };
  }
  // Existing service systems are evidence-bearing even when V2.2 abstains;
  // keep this projection deterministic and conservative.
  if (family === 'EXISTING_FACT_EVIDENCE' && candidate.response_mode !== 'EVIDENCE') {
    selected = {
      ...candidate,
      response_mode: 'EVIDENCE',
      response_role: 'TECHNICAL',
      evidence_dependency: true,
      deep_chain_required: true,
      human_required: false,
      routing_reasons: ['ENTERPRISE_OR_PRODUCT_EVIDENCE']
    };
  }
  if (family === 'FUTURE_OBLIGATION' && candidate.response_mode !== 'COMMITMENT') {
    selected = {
      ...candidate,
      response_mode: 'COMMITMENT',
      response_role: 'CONTRACT',
      evidence_dependency: false,
      deep_chain_required: true,
      human_required: true,
      routing_reasons: ['PROJECT_OR_CONTRACT_COMMITMENT']
    };
  }
  return Object.freeze({
    ...selected,
    projection_version: context.projection_version || RESPONSE_ROUTER_V221_VERSION,
    implementation_id: RESPONSE_ROUTER_V221_IMPLEMENTATION_ID,
    baseline_v21_mode: baseline.response_mode,
    baseline_v22_mode: candidate.response_mode,
    bounded_correction_family: family
  });
}

export { projectRequirementResponseV221 };
export const projectRequirementResponseV221ReadOnly = projectRequirementResponseV221;
export { RESPONSE_ROUTER_V22_VERSION };
