/**
 * Deterministic Response Router V2.2.2.
 *
 * This is a deliberately thin safety-closure layer over V2.2.1.  It keeps
 * V2.2.1 as the semantic-stability baseline and applies only general
 * commitment/compliance/P0 boundary corrections.  It never reads evaluation
 * labels, benchmark identifiers, tenders, source hashes, providers or Gold.
 */

import { projectRequirementResponseV21 } from './requirement-response-router-v2-1.js';
import { projectRequirementResponseV22 } from './requirement-response-router-v2-2.js';
import {
  projectRequirementResponseV221,
  RESPONSE_ROUTER_V221_VERSION
} from './requirement-response-router-v2-2-1.js';

export const RESPONSE_ROUTER_V222_VERSION = 'v43-response-router-v2.2.2';
export const RESPONSE_ROUTER_V222_IMPLEMENTATION_ID = 'v43-response-router-v2.2.2-general-safety-closure';

const textOf = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const categoryOf = item => textOf(item.category ?? item.requirement_category).toLowerCase();
const has = (value, pattern) => pattern.test(value);

// General semantic families only; no case/tender/page/source identifiers.
const OBLIGATION = /应|须|需|必须|负责|安排|配备|提供|完成|承担|履行|遵守|不得/;
const FUTURE_CONTEXT = /中标后|若中标|中标人|合同(?:签订|生效|履行|执行期内|期内)|履约|项目实施期间|项目执行期间|服务期限|服务期内|质保期|交付后|验收后|驻场|派驻|工期|交货|到货|发运|工单|每月|每季度|定期|动态调整|按采购人要求/;
const DELIVERY_OR_SERVICE = /服务|维护|运维|售后|保修|维修|响应|到场|备件|培训|升级服务|部署|迁移|切换|交付|验收|技术资料|文档|计划|容量|算力|存储|技术人员|发运/;
const STRONG_SERVICE = /服务期|服务期限|质保|保修|售后|故障|响应|维修|维护|运维|驻场|备件|到场|工单|动态调整|不超过\s*\d+\s*(?:小时|天|分钟)|每月|每季度|定期|维保|升级服务|搬迁服务/;
const EXISTING_SIGNAL = /现有|已有|已经|已取得|已获得|具备|具有|拥有|建立|成熟|历史|记录|案例|项目经验|证书|认证/;
const MIXED_PERSONNEL = /(?:现有|已有|历史|服务记录|既有).{0,40}(?:人员|团队|工程师)|(?:人员|团队|工程师).{0,40}(?:现有|已有|历史|服务记录|既有)/;
const MIXED_FUTURE_SERVICE = /(?:中标后|合同|服务期|项目实施|项目执行|质保|交付|验收).{0,48}(?:服务|维护|运维|支持|维修|保修|培训|备件)/;
const CONFIDENTIALITY = /保密|机密|敏感数据|未公开信息|不得.*(?:披露|拷贝|复制|泄露)|返还或删除/;
const CONFIDENTIALITY_ACTOR = /乙方|中标人|投标人|供应商|工作人员|参与甲方|项目资料|甲方系统|甲方提供/;
const EVIDENCE_DOCUMENT = /证明材料|检测报告|认证报告|测评报告|报告扫描件|报告复印件|证书|截图|复印件|CMA|CNAS/;
const OFFERED_CONFORMANCE = /(?:所供|所投|投标产品|拟提供|供货).{0,40}(?:符合|满足|通过|认证|测评|标准|要求)/;
const PRODUCT_FEATURE = /(?:支持|兼容|适配|提供|具备|具有).{0,36}(?:功能|参数|指标|规格|接口|算法|数据库|加密|访问控制|备份|恢复|容灾|报表)/;
const COMPLIANCE_CONFORMITY = /(?:替代|等效|符合性|实质性(?:偏离|响应)).{0,50}(?:标准|规范|要求|产品|配置)|(?:标准|规范).{0,24}(?:替代|等效)|不低于.{0,20}(?:技术规格|标准|规范|要求|配置)/;
const CONTRACT_LIABILITY = /(?:中标人|乙方|承包方).{0,100}(?:知识产权|侵权|索赔|诉讼|解除合同|终止合同|赔偿|损失|承担.*责任|假冒伪劣|处罚)|(?:解除合同|终止合同).{0,80}(?:赔偿|损失|费用|责任)|假冒伪劣/;
const P0_CONSEQUENCE = /无效投标|投标无效|无效响应|无效标|否决投标|废标|不予通过|拒收|取消资格|终止合同|解除合同|重大违约|重大责任|赔偿责任|损失由|承担全部.*(?:责任|费用)|假冒伪劣|知识产权.{0,24}(?:侵权|索赔|诉讼)|(?:侵犯|不侵犯).{0,24}知识产权|侵权.{0,24}(?:索赔|诉讼|责任)|履约保证金|投标保证金|最高限价|报价.{0,20}预算金额|投标有效期|附加条件|开标.{0,20}(?:签到|参加)|盖章.{0,20}签署|签署.{0,20}盖章|带[★☆]|中小(?:微)?企业.{0,30}(?:采购|承接)|不得放弃中标|保密教育|保密协议|保密信息.{0,30}(?:披露|使用)|合同.{0,80}法律责任|法律责任.{0,80}合同/;

function commitmentSignal(item, baseline, candidate, current) {
  const text = textOf(item.requirement_text ?? item.text);
  const category = categoryOf(item);
  if (!text || has(text, COMPLIANCE_CONFORMITY) && !has(text, /提供.*(?:服务|交付|资料)/)) return false;
  if (has(text, OFFERED_CONFORMANCE) && !has(text, STRONG_SERVICE)) return false;

  const obligation = has(text, OBLIGATION);
  const future = has(text, FUTURE_CONTEXT);
  const service = has(text, DELIVERY_OR_SERVICE);
  const strongService = has(text, STRONG_SERVICE);
  const serviceDeliveryCategory = /^(service|delivery|implementation|contractual)$/.test(category);
  const directServiceDelivery = has(text, /(?:应|须|需|必须)\s*(?:提供|负责|完成|安排|配备|承担|交付|安装|部署|迁移|维修|更换|发运|切换).{0,100}(?:服务|计划|资料|文档|部署|迁移|维修|更换|资源|容量|算力|存储|技术人员|发运|交付|验收|切换|搬迁)/)
    || has(text, /(?:负责|完成|安排|配备)\s*(?:提供|负责|完成|安排|配备|承担|交付|安装|部署|迁移|维修|更换|发运|切换).{0,100}(?:服务|计划|资料|文档|部署|迁移|维修|更换|资源|容量|算力|存储|技术人员|发运|交付|验收|切换|搬迁)/)
    || (has(text, /(?:应|须|需|必须)\s*提供/) && has(text, /服务|资源|容量|算力|存储|技术人员|计划|资料|文档/) && !has(text, /功能|接口|工具|平台|系统/))
    || has(text, /(?:若中标|中标后).{0,100}(?:承诺|配合|提供|完成|通过|审查)/)
    || has(text, /(?:须|应|需|必须).{0,120}(?:免费提供|搬迁服务|安装部署|发运|修理|更换)/);
  const confidentialityObligation = has(text, CONFIDENTIALITY)
    && has(text, OBLIGATION)
    && has(text, CONFIDENTIALITY_ACTOR);

  // Delivery/service categories and explicit service deliverables are future
  // obligations even when a sentence does not say “中标后”.
  if (has(text, EVIDENCE_DOCUMENT) && !future && !strongService && !confidentialityObligation) return false;
  if (current.response_mode === 'COMMITMENT' || current.response_mode === 'COMPLIANCE') return false;
  if (has(text, /无需|无须|不再承担|不承担.*保密责任/)) return false;
  if (!future && !confidentialityObligation && has(text, PRODUCT_FEATURE)
    && !(directServiceDelivery && has(text, /算力|容量|存储/))) return false;
  if (!future && !confidentialityObligation && has(text, /完善的技术支持服务体系|服务支持体系|运维服务体系/)) return false;
  const futureDeliverable = (obligation && service && (
    (future && (directServiceDelivery || strongService || serviceDeliveryCategory))
    || directServiceDelivery
    || (serviceDeliveryCategory && directServiceDelivery)
  )) || confidentialityObligation;
  if (!futureDeliverable) return false;

  // Existing technical capabilities remain Evidence unless the text carries
  // a concrete service/delivery obligation.
  if (has(text, PRODUCT_FEATURE) && !strongService && !future && !directServiceDelivery) return false;
  return baseline.response_mode === 'EVIDENCE' || candidate.response_mode === 'EVIDENCE' || candidate.response_mode === 'NEED_REVIEW';
}

function projectP0Safety(selected, text) {
  if (!has(text, P0_CONSEQUENCE)) return selected;
  return {
    ...selected,
    risk_tier: 'P0',
    human_required: true,
    deep_chain_required: true,
    routing_reasons: [...new Set([...(selected.routing_reasons || []), 'P0_HUMAN_GATE'])]
  };
}

/** Project a requirement through the V2.2.2 general safety closure. */
export function projectRequirementResponseV222(requirement = {}, context = {}) {
  const item = requirement && typeof requirement === 'object' ? requirement : {};
  const baseline = projectRequirementResponseV21(item, context);
  const candidate = projectRequirementResponseV22(item, context);
  const current = projectRequirementResponseV221(item, context);
  const text = textOf(item.requirement_text ?? item.text);
  const mixedBoundary = has(text, MIXED_PERSONNEL)
    && (has(text, MIXED_FUTURE_SERVICE)
      || (candidate.response_mode === 'NEED_REVIEW' && has(text, CONFIDENTIALITY)));
  const shouldCommit = commitmentSignal(item, baseline, candidate, current);
  const shouldReview = mixedBoundary
    || (candidate.response_mode === 'NEED_REVIEW'
      && current.response_mode === 'EVIDENCE'
      && has(text, /(?:人员|专人|团队|工程师)/)
      && has(text, CONFIDENTIALITY));
  const conformity = has(text, COMPLIANCE_CONFORMITY) && has(text, /投标|供应商|产品|货物|标准|规范/);

  let selected = current;
  let family = null;
  if (shouldReview) {
    selected = {
      ...current,
      response_mode: 'NEED_REVIEW',
      response_role: 'NONE',
      evidence_dependency: false,
      deep_chain_required: true,
      human_required: true,
      routing_reasons: ['AMBIGUOUS_SUBJECT_OR_TEMPORAL_BOUNDARY']
    };
    family = 'MIXED_AUTHORITY_BOUNDARY';
  } else if (shouldCommit) {
    selected = {
      ...current,
      response_mode: 'COMMITMENT',
      response_role: 'CONTRACT',
      evidence_dependency: false,
      deep_chain_required: true,
      human_required: true,
      routing_reasons: ['PROJECT_OR_CONTRACT_COMMITMENT']
    };
    family = 'FUTURE_DELIVERY_OR_SERVICE';
  } else if (has(text, CONTRACT_LIABILITY)
    && ['SOLUTION', 'COMPLIANCE'].includes(current.response_mode)) {
    selected = {
      ...current,
      response_mode: 'COMMITMENT',
      response_role: 'CONTRACT',
      evidence_dependency: false,
      deep_chain_required: true,
      human_required: true,
      routing_reasons: ['PROJECT_OR_CONTRACT_COMMITMENT']
    };
    family = 'CONTRACT_LIABILITY';
  } else if (conformity && current.response_mode !== 'COMPLIANCE') {
    selected = {
      ...current,
      response_mode: 'COMPLIANCE',
      response_role: 'COMPLIANCE',
      evidence_dependency: false,
      deep_chain_required: false,
      human_required: current.risk_tier === 'P0' || current.risk_tier === 'HIGH',
      routing_reasons: ['BID_CONFORMITY_OR_EQUIVALENCE']
    };
    family = 'COMPLIANCE_CONFORMITY';
  }
  selected = projectP0Safety(selected, text);
  return Object.freeze({
    ...selected,
    projection_version: context.projection_version || RESPONSE_ROUTER_V222_VERSION,
    implementation_id: RESPONSE_ROUTER_V222_IMPLEMENTATION_ID,
    baseline_v21_mode: baseline.response_mode,
    baseline_v22_mode: candidate.response_mode,
    baseline_v221_mode: current.response_mode,
    bounded_correction_family: family
  });
}

export const projectRequirementResponseV222ReadOnly = projectRequirementResponseV222;
export { RESPONSE_ROUTER_V221_VERSION };
