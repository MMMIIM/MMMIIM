/**
 * Deterministic Response Router V2.2.3.
 *
 * V2.2.3 is a thin independent-dimension closure over V2.2.2.  It adds
 * general handling-loop, scoring, and mixed-authority rules only.  It never
 * reads evaluation identifiers, Gold, providers, or persistence state.
 */

import {
  projectRequirementResponseV222,
  RESPONSE_ROUTER_V222_VERSION,
  RESPONSE_ROUTER_V222_IMPLEMENTATION_ID
} from './requirement-response-router-v2-2-2.js';

export const RESPONSE_ROUTER_V223_VERSION = 'v43-response-router-v2.2.3';
export const RESPONSE_ROUTER_V223_IMPLEMENTATION_ID = 'v43-response-router-v2.2.3-response-authority-closure';

const textOf = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const categoryOf = item => textOf(item.category ?? item.requirement_category).toLowerCase();
const has = (value, pattern) => pattern.test(value);

// General semantic signals.  No benchmark, tender, page, source-hash, or
// case identifiers are used in the production projection.
const OPTIONAL = /无需(?:投标人|供应商)?响应|仅供(?:背景)?参考|不作为(?:评分|响应)|仅起说明作用|可(?:以)?提出(?:质疑|异议)|可以(?:提出|选择|采用|要求)?(?:质疑|异议|等效标准|替代方案)|采购人(?:或代理机构)?(?:可以|有权)|买方(?:可以|有权)|可选择|可自行决定|有异议.{0,24}应当.{0,16}(?:提出|现场)|质疑函应(?:当)?(?:以书面|.*符合)|如有疑问.{0,24}可以|权益受到损害.{0,80}可以|可以在.{0,80}(?:提出质疑|提出询问|提出异议)|可以修改或撤回|可与采购人协商|组织现场考察|标前答疑会|鼓励|按照招标公告规定.*获取招标文件|质疑期/;
const MANDATORY = /必须|须|应当|应|需|需要|要求|提供|提交|递交|参加|登录|签到|解密|翻译|加盖|盖章|签署|签字|满足|符合|保证|承诺|承担|实施|维护|运维|服务|履行|执行|完成|配备|负责|不得/;
const BIDDER_ACTION_OR_CONSEQUENCE = /投标人|投标单位|投标方|供应商|报价人|中标人|乙方|承包方|投标文件|响应文件|投标报价|参加投标|一旦.*参加|视为|放弃投标|法律责任|不良后果|承担.*(?:责任|后果|费用)|不一致.*(?:为准|结果)/;
const SCORING = /评分|评标|评审|得分|分值|权重|每项\s*[0-9０-９]+(?:\.[0-9０-９]+)?\s*分|共计\s*[0-9０-９]+\s*项|得\s*[0-9０-９]+(?:\.[0-9０-９]+)?\s*分|满分|计分(?!析)|评分标准|评分细则|(?:★|▲|△|#).{0,24}(?:每项|共计|得分|分值|[0-9０-９]+\s*分)/;
const DESIGN = /(?:技术|实施|服务|项目|国产化|安全保密|适配|迁移|部署|集成|供货|架构|建设|运维|培训|应急|质量).{0,16}(?:方案|计划|设计|措施|方法|路线|思路|手段)|方案内容包括|实施方案|安全保密措施|维护手段|应采用.*技术|主要包括.{0,80}(?:功能|服务|门户|报表|系统)|系统应提供.{0,100}(?:门户|坐席|运营|业务)/;
const DESIGN_CONTEXT = /(?:方案|计划|设计|措施|方法|路线|思路|手段|搭建|建设|实施|适配|迁移|部署|集成|架构|规划|维护手段|应采用)/;
const FUTURE = /中标后|中标(?:方|人)|中标通知书发出后|合同(?:签订|生效|履行|执行期内|期内)|履约|项目实施期间|项目执行期间|服务期限|服务期内|质保期|交付后|验收后|驻场|派驻|工期|交货|到货|发运|履约保证金/;
const STRONG_SERVICE = /服务期|服务期限|质保|保修|售后|故障|响应|维修|维护|运维|驻场|备件|到场|工单|动态调整|不超过\s*\d+\s*(?:小时|天|分钟)|每月|每季度|定期|维保|升级服务|搬迁服务/;
const CONTRACT_OBLIGATION = /中标人|乙方|合同双方|合同货物|履约保证金|保密信息|保密教育|保密协议|法律责任|赔偿|违约|履行.*义务|不得放弃中标|承担.*后果/;
const EVIDENCE_PROOF = /认证证书|资质证书|检测报告|测评报告|项目经验|项目案例|客户案例|业绩|截图证明|功能截图|参考文档|开发文档|驱动开发|应用移植|API文档|复印件|证明材料|证书/;
const PRODUCT_CAPABILITY = /产品|系统|软件|平台|设备|功能|接口|参数|指标|性能|兼容|适配|支持|具备|具有|提供.*(?:功能|能力|接口|参数|文档|资料)/;
const PRICE_COMPOSITION = /(?:投标|供应商|投标人).{0,20}(?:报价|价格).{0,60}(?:包含|包括|构成|组成|最终价格|全部费用)|报价.{0,40}(?:包含|包括|构成|组成)/;
const MIXED_PERSONNEL = /(?:人员|团队|工程师).{0,60}(?:经验|资格|证书).{0,100}(?:免费提供|搬迁服务)|(?:现有|已有|历史|既有).{0,40}(?:人员|团队|工程师).{0,100}(?:中标后|合同|服务|免费|维护|运维|提供)/;
const DEVELOPMENT_OBLIGATION = /开发(?:工作|过程|阶段)?\s*(?:应|须|需)|开发进度.{0,16}(?:提供|提交|文档)/;
const SERVICE_MAINTENANCE_OBLIGATION = /(?:应|须|需|必须).{0,80}(?:维护|清理|修复漏洞|数据恢复|备份|运维)/;
const PROJECT_OBLIGATION_ACTOR = /项目组|项目负责人|运维|巡检|故障处理|服务期限|服务期|采购人|甲方|乙方|中标人|合同|所投标|所投产品|响应设备|中标\(成交\)人/;
const CAPABILITY_OBLIGATION = /(?:支持|具备|具有|建立|实现|打造|提供).{0,80}(?:功能|体系|软件|系统|设备|服务|文档|转换|接口|指标|能力)/;
const MARKET_ACCESS = /市场准入|核准证|许可证|安全认证|安全检测|国家相关法律法规|严格执行.*(?:公告|目录|标准|规范)|所投标.*(?:符合|满足)|合同及验收环节.*要求/;

function mandatoryResponseRequired(text, mode, current) {
  if (!text) return false;
  const optionalOnly = has(text, OPTIONAL) && !has(text, /必须|须|不得|无效|拒绝|承担|视为|放弃/)
    || has(text, /有异议.{0,24}应当|质疑函应(?:当)?|如有疑问.{0,24}可以|权益受到损害.{0,80}可以|可以在.{0,80}(?:提出质疑|提出询问|提出异议)|可以修改或撤回|可与采购人协商|仅起说明作用|组织现场考察|标前答疑会|鼓励|按照招标公告规定.*获取招标文件|质疑期/);
  if (optionalOnly) return false;
  const action = has(text, MANDATORY) && (has(text, BIDDER_ACTION_OR_CONSEQUENCE) || has(text, PROJECT_OBLIGATION_ACTOR));
  const capability = has(text, MANDATORY) && has(text, CAPABILITY_OBLIGATION);
  const consequence = has(text, /一旦.*参加|即被认为|视为|放弃投标|不良后果|承担.*(?:责任|后果|费用)|以中文文本为准|以查询结果为准|达到设计要求|通过.*验收|质量目标/);
  if (action || consequence) return true;
  if (mode === 'EVIDENCE' || mode === 'COMMITMENT' || mode === 'COMPLIANCE') return current.response_required !== false || action || capability || consequence;
  return current.response_required !== false;
}

function scoringRelated(text, item, current) {
  if (current.is_scoring_related === true || item.scoring_related === true || item.score != null || item.weight != null || item.max_score != null) return true;
  return has(text, SCORING);
}

function isSolutionDesign(text, category, current) {
  if (!has(text, DESIGN)) return false;
  if (has(text, FUTURE) && has(text, /负责|完成|交付|维护|服务|保证|承担|履行/)) return false;
  if (current.response_mode === 'COMMITMENT'
    && !has(text, /方案|措施|设计|系统应提供|主要包括|维护手段|维护和管理|应采用/)) return false;
  if (current.response_mode === 'EVIDENCE'
    && has(text, /符合|标准|规范|检测方法/)
    && !has(text, /方案|措施|设计|计划/)) return false;
  if (current.response_mode === 'EVIDENCE' && has(text, EVIDENCE_PROOF) && !has(text, /方案|措施|设计/)) return false;
  return ['solution', 'technical', 'functional', 'implementation', 'delivery', 'security'].includes(category)
    || has(text, /方案|措施|设计|计划|方法|手段/);
}

function isEnterpriseEvidence(text, category) {
  const proof = has(text, EVIDENCE_PROOF);
  const product = has(text, PRODUCT_CAPABILITY);
  const noFutureObligation = !has(text, FUTURE)
    && !has(text, /中标人|乙方|合同履行|质保期|服务期/)
    && !has(text, DEVELOPMENT_OBLIGATION)
    && !has(text, SERVICE_MAINTENANCE_OBLIGATION);
  return noFutureObligation && proof && (product || ['technical', 'functional', 'performance', 'security'].includes(category));
}

function isCommitment(text, current) {
  if (has(text, PRICE_COMPOSITION) || has(text, MARKET_ACCESS)) return false;
  // A proof/document clause is Evidence unless it also carries a concrete
  // service or contractual liability obligation.  Contract-stage timing
  // alone does not promote an existing capability proof to Commitment.
  if (has(text, EVIDENCE_PROOF) && !has(text, STRONG_SERVICE) && !has(text, CONTRACT_OBLIGATION)) return false;
  const strictContract = has(text, /保密信息|保密教育|保密协议|合同双方.*(?:通知|回复)|变更.*(?:地址|帐号).{0,80}(?:通知|法律责任)/);
  if (strictContract) return true;
  // Bid-stage declarations and eligibility clauses remain Compliance even
  // when they mention a contract or a future consequence.
  if (current.response_mode === 'COMPLIANCE' && has(text, /投标承诺函|投标人须.*承诺函|投标文件|响应文件|不得参加|资格|无效投标/)) return false;
  if (current.response_mode === 'COMPLIANCE' && !has(text, FUTURE) && !has(text, /中标人|乙方|履约|质保期|合同履行/)) return false;
  if (has(text, CONTRACT_OBLIGATION) && (has(text, FUTURE) || has(text, /保密信息|保密教育|保密协议|不得放弃中标|法律责任/))) return true;
  if (has(text, /(?:中标后|合同|履约|质保期|服务期内).{0,100}(?:应|须|需|必须|保证|承担|提供|完成|维护|服务|缴纳|通知)/)) return true;
  if (has(text, /保密信息.*(?:范围|披露)|严格限制.*工作人员/)) return true;
  return current.response_mode === 'COMMITMENT' && has(text, /应|须|必须|不得|承担|履行|完成/);
}

function projectP0(result, text) {
  if (!has(text, /无效投标|投标无效|无效标|否决投标|废标|拒收|取消资格|终止合同|解除合同|履约保证金|投标保证金|重大违约|赔偿责任|法律责任.{0,80}合同|合同.{0,80}法律责任/)) return result;
  return { ...result, risk_tier: 'P0', human_required: true, deep_chain_required: true, routing_reasons: [...new Set([...(result.routing_reasons || []), 'P0_HUMAN_GATE'])] };
}

export function projectRequirementResponseV223(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const current = projectRequirementResponseV222(item, context);
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  const scoring = scoringRelated(text, item, current);
  const mixed = has(text, MIXED_PERSONNEL);
  const price = has(text, PRICE_COMPOSITION);
  const evidence = isEnterpriseEvidence(text, category);
  const solution = isSolutionDesign(text, category, current);
  const commitment = isCommitment(text, current);
  const buyerProcedure = current.risk_tier !== 'HIGH' && has(text, /组织验收|出具《?验收报告|公告验收结果/);

  let result = { ...current };
  const preserveNeedReview = current.response_mode === 'NEED_REVIEW' && !mixed;
  if (preserveNeedReview) {
    result = { ...current };
  } else if (mixed) {
    result = { ...result, response_mode: 'NEED_REVIEW', response_role: 'NONE', evidence_dependency: true, human_required: true, deep_chain_required: true, routing_reasons: ['AMBIGUOUS_SUBJECT_OR_TEMPORAL_BOUNDARY'] };
  } else if (price) {
    result = { ...result, response_mode: 'COMPLIANCE', response_role: 'COMPLIANCE', evidence_dependency: false, routing_reasons: ['BID_CONFORMITY_OR_EQUIVALENCE'] };
  } else if (evidence && current.response_mode !== 'COMPLIANCE') {
    result = { ...result, response_mode: 'EVIDENCE', response_role: 'TECHNICAL', evidence_dependency: true, human_required: false, deep_chain_required: true, risk_tier: result.risk_tier === 'P0' ? 'P0' : 'HIGH', routing_reasons: ['ENTERPRISE_OR_PRODUCT_EVIDENCE'] };
  } else if (solution && current.response_mode !== 'COMPLIANCE') {
    result = { ...result, response_mode: 'SOLUTION', response_role: 'TECHNICAL', evidence_dependency: current.evidence_dependency, human_required: false, deep_chain_required: current.evidence_dependency, risk_tier: result.risk_tier === 'P0' ? 'P0' : 'MEDIUM', routing_reasons: ['PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN'] };
  } else if (commitment) {
    result = { ...result, response_mode: 'COMMITMENT', response_role: 'CONTRACT', evidence_dependency: current.evidence_dependency, deep_chain_required: true, human_required: buyerProcedure ? false : true, routing_reasons: ['PROJECT_OR_CONTRACT_COMMITMENT'] };
    if (has(text, /保密信息|保密教育|保密协议/) && !has(text, EVIDENCE_PROOF)) result.evidence_dependency = false;
  }
  if (has(text, MARKET_ACCESS) && !evidence && current.response_mode !== 'EVIDENCE') {
    result = { ...result, response_mode: 'COMPLIANCE', response_role: 'COMPLIANCE', evidence_dependency: current.evidence_dependency, routing_reasons: ['BID_CONFORMITY_OR_EQUIVALENCE'] };
  }
  result = { ...result, is_scoring_related: scoring, scoring_priority: scoring ? (result.scoring_priority === 'NONE' ? 'MEDIUM' : result.scoring_priority) : result.scoring_priority };
  result = { ...result, response_required: mandatoryResponseRequired(text, result.response_mode, result) };
  if (scoring && !result.secondary_dependencies.includes('SCORING')) result.secondary_dependencies = [...result.secondary_dependencies, 'SCORING'].sort();
  result = projectP0(result, text);
  return Object.freeze({
    ...result,
    projection_version: context.projection_version || RESPONSE_ROUTER_V223_VERSION,
    implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
    baseline_v222_version: RESPONSE_ROUTER_V222_VERSION,
    baseline_v222_implementation_id: RESPONSE_ROUTER_V222_IMPLEMENTATION_ID
  });
}

export const projectRequirementResponseV223ReadOnly = projectRequirementResponseV223;
