import { createHash } from 'node:crypto';

export const CLAIM_QUALITY_SCHEMA_VERSION = '4.3-claim-quality-v1';
export const CLAIM_QUALITY_DATASET_ID = 'claim-quality-gold-v1-2026-09-02';
export const CLAIM_QUALITY_DATASET_CLASSIFICATION = 'REPRESENTATIVE_SYNTHETIC';
export const CLAIM_QUALITY_DATASET_REAL_CUSTOMER_DATA = false;

const PROJECT_ID = 'CLAIM-EVAL-SYNTHETIC';
const CONTRACT_VERSION = 'canonical-requirement-v1';
const HASH = value => createHash('sha256').update(String(value)).digest('hex');

const FACT_SCOPES = Object.freeze({
  capability: ['capability_fact'],
  completion: ['capability_fact', 'completion_fact'],
  verification: ['capability_fact', 'verification_fact'],
  performance: ['performance_fact', 'verification_fact'],
  qualification: ['qualification_fact', 'verification_fact'],
  project: ['project_fact', 'completion_fact']
});

function requirement(caseId, text) {
  return {
    req_id: `REQ-EVAL-${caseId}`,
    requirement_hash: HASH(`requirement:${caseId}:${text}`),
    contract_version: CONTRACT_VERSION,
    text
  };
}

function fact({ id, subject, entities = [], status = 'verified', scopes = FACT_SCOPES.capability,
  quantities = [], validity = 'active', factType = 'capability', current = true,
  reviewStatus = 'approved', evidenceIdentifier = id }) {
  return {
    fact_id: id,
    evidence_identifier: evidenceIdentifier,
    project_id: PROJECT_ID,
    review_status: reviewStatus,
    is_current: current,
    version: 1,
    fact_type: factType,
    subject_json: { type: 'capability', name: subject },
    entities_json: entities.map(name => ({ type: 'capability', name })),
    fact_status: status,
    fact_scopes_json: scopes,
    quantities_json: quantities,
    validity_json: { status: validity }
  };
}

function binding({ caseId, fact: primaryFact, facts = [primaryFact], support = 'full_support',
  mappingStatus = 'approved', approvalStatus = 'approved', validityStatus = 'active',
  lineage = true, usable = true, materialType = 'project_case', evidenceScope = primaryFact.fact_scopes_json }) {
  return {
    project_id: PROJECT_ID,
    requirement_id: `REQ-EVAL-${caseId}`,
    mapping_id: `MAP-EVAL-${caseId}`,
    mapping_status: mappingStatus,
    support_level: support,
    evidence_id: primaryFact.evidence_identifier,
    approval_status: approvalStatus,
    validity_status: validityStatus,
    source_lineage_verified: lineage,
    usable_for_claims: usable,
    material_type: materialType,
    evidence_scope: evidenceScope,
    source_hash: HASH(`source:${caseId}`),
    evidence_facts: facts,
    content: 'Representative synthetic evidence content.',
    source_text: 'Representative synthetic source text.'
  };
}

function claim({ caseId, text, subject, entities = [], scopes = [], claimType = 'enterprise_capability' }) {
  return {
    claim_id: `CLM-EVAL-${caseId}`,
    requirement_id: `REQ-EVAL-${caseId}`,
    claim_type: claimType,
    basis_evidence_ids: [`FACT-EVAL-${caseId}`],
    text,
    metadata: { subject, entities, scope: scopes }
  };
}

function makeCase({ caseId, qualityClass, requirementText, claimText, factOptions, bindingOptions = {},
  claimOptions = {}, expectedDecision, expectedWriterEligible = expectedDecision === 'allow',
  expectedReasonCodes = [], critical = true, usefulEvidence = false }) {
  const req = requirement(caseId, requirementText);
  const primaryFact = fact({ id: `FACT-EVAL-${caseId}`, ...factOptions });
  const evidenceFacts = bindingOptions.facts || [primaryFact];
  const claimValue = claim({ caseId, text: claimText, ...claimOptions });
  return {
    case_id: `CQ-${caseId}`,
    quality_class: qualityClass,
    dataset_classification: CLAIM_QUALITY_DATASET_CLASSIFICATION,
    real_customer_data: CLAIM_QUALITY_DATASET_REAL_CUSTOMER_DATA,
    requirement: req,
    claim: claimValue,
    binding: binding({ caseId, fact: primaryFact, facts: evidenceFacts, ...bindingOptions }),
    expected: {
      decision: expectedDecision,
      writer_eligible: expectedWriterEligible,
      reason_codes: expectedReasonCodes,
      critical,
      useful_evidence: usefulEvidence
    }
  };
}

const strong = [
  makeCase({
    caseId: 'STRONG-SSO', qualityClass: 'supported_strong', usefulEvidence: true,
    requirementText: '系统应支持单点登录。',
    claimText: '我司统一身份认证平台已完成 SSO 能力建设。',
    factOptions: { subject: 'SSO', entities: ['统一身份认证平台'], status: 'completed', scopes: FACT_SCOPES.completion },
    claimOptions: { subject: 'SSO', entities: ['统一身份认证平台'], scopes: FACT_SCOPES.completion },
    expectedDecision: 'allow'
  }),
  makeCase({
    caseId: 'STRONG-INTERFACE', qualityClass: 'supported_strong', usefulEvidence: true,
    requirementText: '系统应支持标准数据交换接口。',
    claimText: '标准数据交换接口已验证可用。',
    factOptions: { subject: '接口服务', entities: ['标准数据交换接口'], status: 'verified', scopes: FACT_SCOPES.verification },
    claimOptions: { subject: '接口服务', entities: ['标准数据交换接口'], scopes: FACT_SCOPES.verification },
    expectedDecision: 'allow'
  }),
  makeCase({
    caseId: 'STRONG-PERFORMANCE', qualityClass: 'supported_strong', usefulEvidence: true,
    requirementText: '数据服务接口响应时间应不超过1秒。',
    claimText: '数据服务已验证响应时间不超过1秒。',
    factOptions: {
      subject: '数据服务', status: 'verified', scopes: FACT_SCOPES.performance,
      quantities: [{ metric: 'latency', operator: 'lte', value: '1', unit: '秒' }]
    },
    claimOptions: { subject: '数据服务', scopes: FACT_SCOPES.performance },
    expectedDecision: 'allow'
  }),
  makeCase({
    caseId: 'STRONG-QUALIFICATION', qualityClass: 'supported_strong', usefulEvidence: true,
    requirementText: '供应商应具备有效的信息安全管理体系。',
    claimText: '信息安全管理体系已验证有效。',
    factOptions: { subject: '信息安全管理体系', status: 'verified', scopes: FACT_SCOPES.qualification },
    claimOptions: { subject: '信息安全管理体系', scopes: FACT_SCOPES.qualification },
    expectedDecision: 'allow'
  })
];

const narrow = [
  ['NARROW-SSO', '系统应支持统一身份体系。', '我司平台已完成 SSO 能力建设。', 'SSO', FACT_SCOPES.completion],
  ['NARROW-LDAP', '系统应支持统一目录服务。', '我司平台已验证支持 LDAP。', 'LDAP', FACT_SCOPES.verification],
  ['NARROW-INTERFACE', '系统应支持多类异构系统接口集成。', '我司已验证支持标准数据交换接口。', '接口服务', FACT_SCOPES.verification],
  ['NARROW-CLOUD', '系统应具备云服务部署能力。', '我司已完成云服务部署适配。', '云服务', FACT_SCOPES.completion],
  ['NARROW-PERFORMANCE', '系统接口响应时间应不超过1秒。', '数据服务已验证响应时间不超过1秒。', '数据服务', FACT_SCOPES.performance]
].map(([caseId, requirementText, claimText, subject, scopes]) => makeCase({
  caseId, qualityClass: 'supported_narrow', requirementText, claimText,
  factOptions: {
    subject, status: scopes.includes('completion_fact') ? 'completed' : 'verified', scopes,
    quantities: caseId === 'NARROW-PERFORMANCE' ? [{ metric: 'latency', operator: 'lte', value: '1', unit: '秒' }] : []
  },
  claimOptions: { subject, scopes },
  bindingOptions: { support: 'partial_support' }, expectedDecision: 'needs_review', expectedWriterEligible: false,
  usefulEvidence: true
}));

const commitment = [
  makeCase({
    caseId: 'COMMITMENT-ENTERPRISE', qualityClass: 'commitment_distinction',
    requirementText: '系统接口响应P95应不超过1秒。',
    claimText: '我司现有平台接口响应P95不超过1秒。',
    factOptions: { subject: '接口服务', status: 'verified', scopes: FACT_SCOPES.performance },
    claimOptions: { subject: '接口服务', scopes: FACT_SCOPES.performance },
    expectedDecision: 'reject', expectedWriterEligible: false, expectedReasonCodes: ['QUANTITATIVE_UNSUPPORTED']
  }),
  makeCase({
    caseId: 'COMMITMENT-PROJECT', qualityClass: 'commitment_distinction',
    requirementText: '系统接口响应P95应不超过1秒。',
    claimText: '本项目将按招标要求开展性能设计和验收。',
    factOptions: { subject: '接口服务', status: 'verified', scopes: FACT_SCOPES.performance },
    claimOptions: { subject: '接口服务', scopes: FACT_SCOPES.performance, claimType: 'response_commitment' },
    expectedDecision: 'needs_review', expectedWriterEligible: false
  })
];

const boundary = [
  makeCase({
    caseId: 'STATUS-AWARD', qualityClass: 'status_overclaim',
    requirementText: '供应商应具有相关项目实施经验。',
    claimText: '我司已完成该项目全部建设内容。',
    factOptions: { subject: '项目A', status: 'award', scopes: ['project_fact', 'award_fact'] },
    claimOptions: { subject: '项目A', scopes: ['project_fact', 'completion_fact'] },
    expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['STATUS_OVERCLAIM', 'EVIDENCE_SCOPE_EXCEEDED']
  }),
  makeCase({
    caseId: 'SCOPE-BROAD', qualityClass: 'scope_overclaim',
    requirementText: '产品应支持统一认证。',
    claimText: '我司全部产品已验证支持统一认证。',
    factOptions: { subject: '产品A', entities: ['产品A'], status: 'verified', scopes: FACT_SCOPES.verification },
    claimOptions: { subject: '产品A', entities: ['产品A'], scopes: FACT_SCOPES.verification },
    expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['ENTITY_MISMATCH', 'EVIDENCE_SCOPE_EXCEEDED']
  }),
  makeCase({
    caseId: 'QUANTITY-OVERCLAIM', qualityClass: 'quantity_overclaim',
    requirementText: '系统应支持100并发用户。',
    claimText: '系统已验证支持1000并发用户。',
    factOptions: {
      subject: '并发服务', status: 'verified', scopes: FACT_SCOPES.performance,
      quantities: [{ metric: 'concurrency', operator: 'eq', value: '100', unit: '并发' }]
    },
    claimOptions: { subject: '并发服务', scopes: FACT_SCOPES.performance },
    expectedDecision: 'reject', expectedWriterEligible: false, expectedReasonCodes: ['QUANTITATIVE_UNSUPPORTED']
  }),
  makeCase({
    caseId: 'ENTITY-OVERCLAIM', qualityClass: 'entity_overclaim',
    requirementText: '供应商应提供统一认证能力。',
    claimText: '集团公司已验证具备统一认证能力。',
    factOptions: { subject: '子公司A', status: 'verified', scopes: FACT_SCOPES.verification },
    claimOptions: { subject: '集团公司', scopes: FACT_SCOPES.verification },
    expectedDecision: 'reject', expectedWriterEligible: false, expectedReasonCodes: ['ENTITY_MISMATCH']
  })
];

const lifecycle = [
  makeCase({
    caseId: 'STALE-EXPIRED', qualityClass: 'stale_currentness',
    requirementText: '供应商应具备有效资质。', claimText: '资质证书已验证有效。',
    factOptions: { subject: '资质证书', status: 'verified', scopes: FACT_SCOPES.qualification },
    claimOptions: { subject: '资质证书', scopes: FACT_SCOPES.qualification },
    bindingOptions: { validityStatus: 'expired' }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['EVIDENCE_EXPIRED']
  }),
  makeCase({
    caseId: 'STALE-REVOKED', qualityClass: 'stale_currentness',
    requirementText: '供应商应具备有效资质。', claimText: '资质证书已验证有效。',
    factOptions: { subject: '资质证书', status: 'verified', scopes: FACT_SCOPES.qualification },
    claimOptions: { subject: '资质证书', scopes: FACT_SCOPES.qualification },
    bindingOptions: { validityStatus: 'revoked' }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['EVIDENCE_EXPIRED']
  }),
  makeCase({
    caseId: 'MISSING-LINEAGE', qualityClass: 'lineage_integrity',
    requirementText: '供应商应具备接口集成能力。', claimText: '接口服务已验证可用。',
    factOptions: { subject: '接口服务', status: 'verified', scopes: FACT_SCOPES.verification },
    claimOptions: { subject: '接口服务', scopes: FACT_SCOPES.verification },
    bindingOptions: { lineage: false, usable: false }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['SOURCE_LINEAGE_REQUIRED']
  }),
  makeCase({
    caseId: 'MAPPING-PENDING', qualityClass: 'authorization_boundary',
    requirementText: '供应商应具备接口集成能力。', claimText: '接口服务已验证可用。',
    factOptions: { subject: '接口服务', status: 'verified', scopes: FACT_SCOPES.verification },
    claimOptions: { subject: '接口服务', scopes: FACT_SCOPES.verification },
    bindingOptions: { mappingStatus: 'proposed' }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['MAPPING_NOT_APPROVED']
  })
];

const authority = [
  makeCase({
    caseId: 'HISTORICAL-BID', qualityClass: 'reference_authority',
    requirementText: '供应商应具备项目实施经验。', claimText: '我司具备该项目实施经验。',
    factOptions: { subject: '历史标书材料', status: 'verified', scopes: FACT_SCOPES.project },
    claimOptions: { subject: '历史标书材料', scopes: FACT_SCOPES.project },
    bindingOptions: { materialType: 'historical_bid' }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['SOURCE_NOT_USABLE']
  }),
  makeCase({
    caseId: 'REFERENCE-ONLY', qualityClass: 'reference_authority',
    requirementText: '供应商应具备项目实施经验。', claimText: '项目材料可作为相关能力参考。',
    factOptions: { subject: '项目材料', status: 'verified', scopes: FACT_SCOPES.project },
    claimOptions: { subject: '项目材料', scopes: FACT_SCOPES.project },
    bindingOptions: { support: 'reference_only' }, expectedDecision: 'restrict', expectedWriterEligible: false,
    expectedReasonCodes: ['REFERENCE_ONLY']
  }),
  makeCase({
    caseId: 'SUPPORT-UNKNOWN', qualityClass: 'support_authority',
    requirementText: '供应商应具备项目实施经验。', claimText: '项目材料支持相关能力。',
    factOptions: { subject: '项目材料', status: 'verified', scopes: FACT_SCOPES.project },
    claimOptions: { subject: '项目材料', scopes: FACT_SCOPES.project },
    bindingOptions: { support: 'unknown' }, expectedDecision: 'reject', expectedWriterEligible: false,
    expectedReasonCodes: ['SUPPORT_INSUFFICIENT']
  })
];

const composite = [
  makeCase({
    caseId: 'COMPOSITE-STATUS-CONFLICT', qualityClass: 'composite_boundary',
    requirementText: '系统应支持已完成的统一认证能力。', claimText: '统一认证能力已完成建设。',
    factOptions: { subject: '统一认证', status: 'completed', scopes: FACT_SCOPES.completion, factType: 'capability' },
    bindingOptions: {
      facts: [
        fact({ id: 'FACT-EVAL-COMPOSITE-STATUS-CONFLICT', evidenceIdentifier: 'FACT-EVAL-COMPOSITE-STATUS-CONFLICT', subject: '统一认证', status: 'completed', scopes: FACT_SCOPES.completion }),
        fact({ id: 'FACT-EVAL-COMPOSITE-STATUS-CONFLICT-2', evidenceIdentifier: 'FACT-EVAL-COMPOSITE-STATUS-CONFLICT', subject: '统一认证', status: 'verified', scopes: FACT_SCOPES.verification })
      ]
    },
    claimOptions: { subject: '统一认证', scopes: FACT_SCOPES.completion },
    expectedDecision: 'needs_review', expectedWriterEligible: false, expectedReasonCodes: ['HUMAN_REVIEW_REQUIRED']
  }),
  makeCase({
    caseId: 'COMPOSITE-SUBJECT-CONFLICT', qualityClass: 'composite_boundary',
    requirementText: '系统应支持统一认证能力。', claimText: '统一认证能力已验证可用。',
    factOptions: { subject: '产品A', status: 'verified', scopes: FACT_SCOPES.verification, factType: 'capability' },
    bindingOptions: {
      facts: [
        fact({ id: 'FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT', evidenceIdentifier: 'FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT', subject: '产品A', status: 'verified', scopes: FACT_SCOPES.verification }),
        fact({ id: 'FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT-2', evidenceIdentifier: 'FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT', subject: '产品B', status: 'verified', scopes: FACT_SCOPES.verification })
      ]
    },
    claimOptions: { subject: '产品A', scopes: FACT_SCOPES.verification },
    expectedDecision: 'needs_review', expectedWriterEligible: false, expectedReasonCodes: ['HUMAN_REVIEW_REQUIRED']
  })
];

export function buildClaimQualityCases() {
  return [...strong, ...narrow, ...commitment, ...boundary, ...lifecycle, ...authority, ...composite]
    .map(item => structuredClone(item));
}

export function validateClaimQualityCases(cases = buildClaimQualityCases()) {
  const errors = [];
  const ids = new Set();
  const decisions = new Set(['allow', 'restrict', 'reject', 'needs_review']);
  for (const item of cases) {
    if (!item?.case_id || ids.has(item.case_id)) errors.push(`duplicate_case_id:${item?.case_id || 'missing'}`);
    ids.add(item?.case_id);
    if (item.dataset_classification !== CLAIM_QUALITY_DATASET_CLASSIFICATION || item.real_customer_data !== false) errors.push(`data_boundary:${item.case_id}`);
    if (!item.requirement?.req_id || item.claim?.requirement_id !== item.requirement.req_id) errors.push(`requirement_identity:${item.case_id}`);
    if (!item.binding || item.binding.project_id !== PROJECT_ID || item.binding.requirement_id !== item.requirement.req_id) errors.push(`binding_identity:${item.case_id}`);
    if (!item.claim?.basis_evidence_ids?.includes(item.binding?.evidence_id)) errors.push(`claim_evidence_identity:${item.case_id}`);
    if (!decisions.has(item.expected?.decision)) errors.push(`expected_decision:${item.case_id}`);
    if (!Array.isArray(item.expected?.reason_codes)) errors.push(`expected_reason_codes:${item.case_id}`);
  }
  if (cases.length !== 24) errors.push(`case_count:${cases.length}`);
  return { ok: errors.length === 0, errors, case_count: cases.length, schema_version: CLAIM_QUALITY_SCHEMA_VERSION };
}

export function claimQualityIdentity(cases = buildClaimQualityCases()) {
  const validation = validateClaimQualityCases(cases);
  const hash = createHash('sha256').update(JSON.stringify(cases)).digest('hex');
  return {
    dataset_id: CLAIM_QUALITY_DATASET_ID,
    schema_version: CLAIM_QUALITY_SCHEMA_VERSION,
    dataset_classification: CLAIM_QUALITY_DATASET_CLASSIFICATION,
    real_customer_data: CLAIM_QUALITY_DATASET_REAL_CUSTOMER_DATA,
    case_count: cases.length,
    dataset_sha: hash,
    validation
  };
}
