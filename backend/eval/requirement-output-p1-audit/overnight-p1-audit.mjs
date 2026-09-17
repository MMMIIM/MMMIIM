import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const OUT_ROOT = path.join(ROOT, 'backend/eval/requirement-output-p1-audit/results');
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const runId = process.env.P1_AUDIT_RUN_ID || `req-output-p1-audit-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const OUT = path.join(OUT_ROOT, runId);

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const readJsonl = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const norm = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
const textNorm = (value) => norm(value).replace(/[，。；、：:（）()【】\[\]“”"‘’'《》<>／/\\\-—_]/g, '');
const countBy = (items, keyFn) => items.reduce((out, item) => { const key = keyFn(item) || 'UNKNOWN'; out[key] = (out[key] || 0) + 1; return out; }, {});
const uniq = (items) => [...new Set(items.filter(Boolean))];
const safe = (value, max = 240) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function sourceManifest() {
  const parity = readJson('docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.json');
  const candidatePath = 'docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json';
  const canonicalPath = 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json';
  const qualityPath = 'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json';
  const candidatesArtifact = readJson(candidatePath);
  const candidates = Array.isArray(candidatesArtifact) ? candidatesArtifact : (candidatesArtifact.candidates || []);
  const canonicals = readJson(canonicalPath).requirements;
  const quality = readJson(qualityPath);
  const identityReady = quality.candidate_accounting?.unmapped_count === 0
    && quality.candidate_accounting?.mapped_count === quality.canonical_count
    && quality.source_hash_mismatch_count === 0;
  return TENDERS.map((tenderId) => {
    const row = parity.tenders.find((item) => item.tender_id === tenderId) || {};
    const candidateCount = candidates.filter((item) => item.tender_id === tenderId).length;
    const canonicalCount = canonicals.filter((item) => item.tender_id === tenderId).length;
    const sourceReady = ['PASS', 'SOURCE_PACKET'].includes(row.source_authority) && row.source_identity?.source_file_exists === true
      && row.source_identity?.source_hash_match === true && row.canonical_linkage?.source_verified_all === true;
    const complete = candidateCount > 0 && canonicalCount > 0 && sourceReady && identityReady;
    return {
      tender_id: tenderId,
      source_artifact: row.source_identity?.source_file || null,
      source_sha256: row.source_identity?.actual_source_file_sha256 || null,
      candidate_artifact: candidatePath,
      canonical_artifact: canonicalPath,
      quality_gate_artifact: qualityPath,
      candidate_count: candidateCount,
      canonical_count: canonicalCount,
      source_resolution_status: sourceReady ? 'PASS' : 'NOT_VERIFIED',
      source_canonical_identity_status: identityReady ? 'PASS' : 'UNRELIABLE',
      quality_gate_status: 'RECOMPUTED_OFFLINE_FROM_CURRENT_CANONICAL_INPUT',
      pipeline_completeness: complete ? 'COMPLETE' : 'PACKET_INCOMPLETE',
      authority_status: complete ? 'SOURCE_CANONICAL_AUTHORITY_READY_PENDING_HUMAN_REVIEW' : 'PACKET_INCOMPLETE',
      authority_basis: {
        current_source_parity_v2: row.source_lineage || null,
        current_quality_audit_status: quality.status,
        current_candidate_canonical_identity: quality.candidate_accounting?.unmapped_count === 0 ? 'MAPPED_NO_UNEXPLAINED_LOSS' : 'UNRELIABLE',
        historical_resolver_manifest_not_used_as_authority: true
      }
    };
  });
}

function classifyNumberToken(token, source) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const index = source.search(new RegExp(escaped));
  const context = index >= 0 ? source.slice(Math.max(0, index - 32), index + token.length + 32) : source;
  if (/\d+\s*\/\s*\d+|第\s*\d+\s*页|页码|页$/.test(context)) return 'PAGE_OR_LAYOUT_NUMBER';
  if (/项目编号|采购编号|标准|GB\/?T|ISO|版本|编号|证书|代码|型号/.test(context)) return 'IDENTIFIER_NUMBER';
  if (/得分|分值|满分|扣分|评分|分，|分。/.test(context)) return 'SCORING_NUMBER';
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(token) || /[（(]\s*\d+\s*[）)]/.test(context) || /第\s*\d+(?:\.\d+)*\s*[章节条款]/.test(context)) return 'STRUCTURAL_NUMBER';
  if (/%|秒|毫秒|分钟|小时|日|年|月|次|人|名|个|台|套|条|项|容量|并发|响应|频率|期限|金额|元|万元|数量|不少于|不超过|以上|以下/.test(context)) return 'BUSINESS_CRITICAL_NUMBER';
  return 'AMBIGUOUS_NUMBER';
}

function entityClassification(source, candidate, added) {
  const pair = `${source} ${candidate}`;
  if (/(我单位|我方|本单位|供应商)/.test(source) && /(投标人|供应商)/.test(candidate)) return 'BIDDER_NORMALIZATION';
  if (/(采购方|招标人|采购人)/.test(source) && /(采购方|招标人|采购人)/.test(candidate)) return 'PURCHASER_NORMALIZATION';
  if (/本项目/.test(source) && /(项目|本项目)/.test(candidate)) return 'PROJECT_ENTITY_NORMALIZATION';
  if (/测试环境/.test(source) && /生产环境/.test(candidate)) return 'TRUE_ENTITY_DRIFT';
  if (/街道和社区/.test(source) && /职能部门/.test(candidate)) return 'TRUE_ENTITY_DRIFT';
  if (added.some((item) => /其他企业|未授权|外国|第三方/.test(item))) return 'TRUE_ENTITY_DRIFT';
  return 'AMBIGUOUS';
}

function modalityClassification(source, candidate) {
  const equivalent = [
    ['须', '必须'], ['应当', '应'], ['需', '需要'], ['可以', '可']
  ].some(([a, b]) => source.includes(a) && candidate.includes(b));
  if (equivalent) return 'SAFE_NORMALIZATION';
  if (!/(必须|须|应当|应|需要|不得|禁止|不能|不可)/.test(source)
    && /(必须|须|应当|应|需要|不得|禁止|不能|不可)/.test(candidate)) return 'TRUE_MODALITY_ESCALATION';
  return 'AMBIGUOUS';
}

function roleFor(item) {
  const text = String(item.requirement_text || '');
  if (/得分|满分|评分|每提供一项|加分|扣分/.test(text)) return 'SCORING';
  if (/合同|签订|违约|赔偿|付款|支付|投标有效期|保函/.test(text)) return 'CONTRACT';
  if (/资质|证书|认证|不得|必须提供|符合|资格|证明|信用/.test(text)) return 'COMPLIANCE';
  if (/方案|实施|培训|售后|运维|验收|演示|系统|平台|接口|响应时间|性能|部署|兼容|支持|参数|数据/.test(text)) return 'TECHNICAL';
  return null;
}

function atomicity(item) {
  const text = String(item.requirement_text || '');
  const pieces = text.split(/[;；]|(?:\(\d+\)|（\d+）)|(?:\d+[、.])/).map((part) => part.trim()).filter(Boolean);
  const domains = [];
  if (/接口|性能|响应|参数|功能|系统|平台/.test(text)) domains.push('technical');
  if (/实施|交付|培训|售后|运维|验收/.test(text)) domains.push('delivery');
  if (/资质|证书|认证|人员|业绩/.test(text)) domains.push('qualification');
  if (/合同|付款|违约|投标/.test(text)) domains.push('contract');
  if (/安全|数据|权限|密码/.test(text)) domains.push('security');
  const units = uniq(pieces.filter((part) => /(?:应|须|需|必须|支持|提供|完成|具备|满足|提交|实施|验收|培训|配置|管理|查询|展示|上传|签订|出具|组织|具有|通过|保证|实现|采用|覆盖)/.test(part)).map((part) => safe(part, 160)));
  const independent = Math.max(units.length, domains.length > 1 ? domains.length : 1);
  if (independent >= 2 && domains.length >= 2 && (pieces.length >= 2 || /包括|分别|同时|以及|并且/.test(text))) {
    return { classification: 'HIGH_CONFIDENCE_OVERMERGED', independent_obligation_count: independent, obligation_units: units.slice(0, 8), confidence: 'HIGH' };
  }
  if (independent >= 2 || pieces.length >= 2) {
    return { classification: 'ATOMIC_REVIEW', independent_obligation_count: independent, obligation_units: units.slice(0, 8), confidence: 'MEDIUM' };
  }
  return { classification: 'ATOMIC_PASS', independent_obligation_count: 1, obligation_units: units.slice(0, 4), confidence: 'HIGH' };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const canonical = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json').requirements;
  const candidatesArtifact = readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json');
  const candidates = Array.isArray(candidatesArtifact) ? candidatesArtifact : (candidatesArtifact.candidates || []);
  const qualityAudit = readJson('docs/V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json');
  const parity = readJson('docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.json');
  const authority = sourceManifest();
  const incomplete = authority.filter((x) => x.pipeline_completeness !== 'COMPLETE').map((x) => x.tender_id);
  const candidateByReq = new Map();
  for (const row of candidates) {
    const id = row.formal_req_id_assigned || row.canonical_requirement_id;
    if (id) candidateByReq.set(`${row.tender_id}:${id.includes(':') ? id.split(':').pop() : id}`, row);
  }
  const reasonRows = [];
  const numberRows = [];
  const entityRows = [];
  const modalityRows = [];
  const roleRows = [];
  const sourceFidelityRows = [];
  const atomicQueue = new Set((qualityAudit.atomicity_review_queue || []).map((row) => row.canonical_requirement_id));
  const atomicRows = [];
  const p1Cases = [];
  const roleDistribution = {};
  const riskDistribution = {};
  const perTender = countBy(canonical, (x) => x.tender_id);
  let gateAccept = 0; let gateReview = 0; let gateReject = 0;
  let sourceVerified = 0; let sourceUnverified = 0;
  for (const item of canonical) {
    const source = String(item.source_excerpt || '');
    const candidate = { requirement_text: item.requirement_text, source_verified: item.source_verified === true };
    const gate = evaluateRequirementCandidateQuality(candidate, {
      sourceText: source,
      sourceVerified: item.source_verified === true,
      sourceRange: item.source_span || null
    });
    const reqId = item.canonical_requirement_id;
    if (item.source_verified === true) sourceVerified += 1; else sourceUnverified += 1;
    if (gate.decision === 'PASS') gateAccept += 1; else gateReview += 1;
    for (const issue of gate.reason_codes) {
      reasonRows.push({ req_id: reqId, tender_id: item.tender_id, reason_code: issue, detail: gate.issues.find((x) => x.code === issue)?.detail || null });
    }
    const numbers = gate.issues.find((x) => x.code === 'NUMBER_OMISSION_REVIEW');
    if (numbers) {
      const omitted = numbers.detail?.omitted || [];
      const classes = omitted.map((token) => ({ token, classification: classifyNumberToken(token, source) }));
      const allNonBusiness = classes.length > 0 && classes.every((x) => ['STRUCTURAL_NUMBER', 'IDENTIFIER_NUMBER', 'SCORING_NUMBER', 'PAGE_OR_LAYOUT_NUMBER'].includes(x.classification));
      const classification = allNonBusiness ? 'FALSE_POSITIVE' : classes.some((x) => x.classification === 'BUSINESS_CRITICAL_NUMBER') ? 'TRUE_POSITIVE' : 'AMBIGUOUS';
      numberRows.push({ req_id: reqId, tender_id: item.tender_id, omitted_numbers: classes, classification, source_excerpt: safe(source), candidate_text: safe(item.requirement_text), confidence: classification === 'AMBIGUOUS' ? 'LOW' : 'MEDIUM' });
    }
    const entities = gate.issues.find((x) => x.code === 'ENTITY_MISMATCH_REVIEW');
    if (entities) {
      const added = entities.detail?.added || [];
      const classification = entityClassification(source, item.requirement_text, added);
      entityRows.push({ req_id: reqId, tender_id: item.tender_id, source_entity: safe(source), candidate_entity: safe(item.requirement_text), canonical_entity: added, classification, semantic_impact: classification === 'TRUE_ENTITY_DRIFT' ? 'authority_or_scope_change' : 'normalization_or_unresolved', confidence: classification === 'AMBIGUOUS' ? 'LOW' : 'MEDIUM' });
    }
    const modality = gate.reason_codes.filter((x) => ['MODALITY_ADDITION_REVIEW', 'MODALITY_OMISSION_REVIEW'].includes(x));
    if (modality.length) {
      const classification = modalityClassification(source, item.requirement_text);
      modalityRows.push({ req_id: reqId, tender_id: item.tender_id, reason_codes: modality, classification, source_text: safe(source), candidate_text: safe(item.requirement_text), confidence: classification === 'AMBIGUOUS' ? 'LOW' : 'MEDIUM' });
    }
    const atom = atomicQueue.has(reqId) ? atomicity(item) : { classification: 'ATOMIC_PASS', independent_obligation_count: 1, obligation_units: [], confidence: 'HIGH' };
    atomicRows.push({ tender_id: item.tender_id, req_id: reqId, canonical_text: safe(item.requirement_text, 400), source_refs: item.source_refs || [], source_text: safe(source, 400), current_category: item.category, ...atom, mapping_risk: atom.classification === 'HIGH_CONFIDENCE_OVERMERGED' ? 'HIGH' : atom.classification === 'ATOMIC_REVIEW' ? 'MEDIUM' : 'LOW', claim_risk: atom.classification === 'HIGH_CONFIDENCE_OVERMERGED' ? 'HIGH' : 'LOW', writer_risk: atom.classification === 'HIGH_CONFIDENCE_OVERMERGED' ? 'MEDIUM' : 'LOW' });
    const role = roleFor(item);
    if (role) roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    if (role && item.writer_eligible !== true && /方案|实施|培训|售后|运维|验收|演示|应对措施|建议|保障|评分|参数/.test(item.requirement_text || '')) {
      const row = { tender_id: item.tender_id, req_id: reqId, current_category: item.category, writer_eligible: item.writer_eligible === true, suggested_response_role: role, response_planning_required: true, writer_context_required: role === 'TECHNICAL' || role === 'SCORING', reason: 'Current writer_eligible is false while text contains response-planning or scoring obligation signals; this is an analysis risk only.', confidence: 'MEDIUM' };
      roleRows.push(row);
    }
    const normalizedSource = textNorm(source);
    const normalizedCandidate = textNorm(item.requirement_text);
    const entityIssue = gate.issues.find((x) => x.code === 'ENTITY_MISMATCH_REVIEW');
    const entityClass = entityIssue ? entityClassification(source, item.requirement_text, entityIssue.detail?.added || []) : null;
    // Literal non-containment alone is not a fidelity defect: the current
    // canonicalizer legitimately normalizes punctuation, units and wording.
    // Require a semantic expansion signal before calling this P1.
    const explicitExpansion = gate.reason_codes.some((x) => ['NUMBER_DISTORTION', 'STATUS_DISTORTION', 'SCOPE_EXPANSION_REVIEW', 'OBVIOUS_SEMANTIC_MUTATION'].includes(x));
    const trueEntityExpansion = entityClass === 'TRUE_ENTITY_DRIFT';
    const lengthExpansion = normalizedSource && normalizedCandidate.length > normalizedSource.length * 1.1;
    const fidelityIssue = item.source_verified === true && (explicitExpansion || trueEntityExpansion || lengthExpansion);
    if (fidelityIssue) {
      sourceFidelityRows.push({ tender_id: item.tender_id, req_id: reqId, source_verified: item.source_verified === true, source_hash: item.source_hash, fidelity_classification: 'HIGH_CONFIDENCE_SOURCE_EXPANSION', gate_reason_codes: gate.reason_codes, source_excerpt: safe(source, 400), canonical_text: safe(item.requirement_text, 400), confidence: 'HIGH' });
    }
  }
  const atomicPass = atomicRows.filter((x) => x.classification === 'ATOMIC_PASS').length;
  const atomicReview = atomicRows.filter((x) => x.classification === 'ATOMIC_REVIEW').length;
  const atomicHigh = atomicRows.filter((x) => x.classification === 'HIGH_CONFIDENCE_OVERMERGED').length;
  const numFP = numberRows.filter((x) => x.classification === 'FALSE_POSITIVE').length;
  const numTP = numberRows.filter((x) => x.classification === 'TRUE_POSITIVE').length;
  const numAmb = numberRows.filter((x) => x.classification === 'AMBIGUOUS').length;
  const entTP = entityRows.filter((x) => x.classification === 'TRUE_ENTITY_DRIFT').length;
  const entFP = entityRows.filter((x) => ['BIDDER_NORMALIZATION', 'PURCHASER_NORMALIZATION', 'PROJECT_ENTITY_NORMALIZATION', 'SYSTEM_ENTITY_NORMALIZATION', 'FALSE_POSITIVE'].includes(x.classification)).length;
  const entAmb = entityRows.filter((x) => x.classification === 'AMBIGUOUS').length;
  const modalEsc = modalityRows.filter((x) => x.classification === 'TRUE_MODALITY_ESCALATION').length;
  for (const row of atomicRows.filter((x) => x.classification !== 'ATOMIC_PASS')) p1Cases.push({ p1_case_id: `ATOMIC-${row.req_id}`, req_id: row.req_id, tender_id: row.tender_id, issue_type: row.classification, severity: row.classification === 'HIGH_CONFIDENCE_OVERMERGED' ? 'P1-HIGH' : 'P1-MEDIUM', owner: 'CANONICAL_ATOMICITY', impact: row.mapping_risk === 'HIGH' ? 'possible mapping/claim fragmentation' : 'review burden', evidence: row.obligation_units });
  for (const row of numberRows.filter((x) => x.classification === 'FALSE_POSITIVE')) p1Cases.push({ p1_case_id: `NUMBER-${row.req_id}`, req_id: row.req_id, tender_id: row.tender_id, issue_type: 'NUMBER_FALSE_POSITIVE', severity: 'P1-MEDIUM', owner: 'QUALITY_GATE', impact: 'avoidable review burden', evidence: row.omitted_numbers });
  for (const row of entityRows.filter((x) => x.classification === 'BIDDER_NORMALIZATION' || x.classification === 'PURCHASER_NORMALIZATION' || x.classification === 'PROJECT_ENTITY_NORMALIZATION')) p1Cases.push({ p1_case_id: `ENTITY-${row.req_id}`, req_id: row.req_id, tender_id: row.tender_id, issue_type: 'ENTITY_FALSE_POSITIVE', severity: 'P1-MEDIUM', owner: 'QUALITY_GATE', impact: 'avoidable entity review burden', evidence: row.canonical_entity });
  for (const row of roleRows) p1Cases.push({ p1_case_id: `ROLE-${row.req_id}`, req_id: row.req_id, tender_id: row.tender_id, issue_type: 'DOWNSTREAM_ROLE_RISK', severity: row.suggested_response_role === 'TECHNICAL' || row.suggested_response_role === 'SCORING' ? 'P1-HIGH' : 'P1-MEDIUM', owner: 'DOWNSTREAM_ROUTING', impact: 'response planning coverage may be lost while Writer authority remains unchanged', evidence: row.reason });
  for (const row of sourceFidelityRows.filter((x) => x.fidelity_classification === 'HIGH_CONFIDENCE_SOURCE_EXPANSION')) p1Cases.push({ p1_case_id: `SOURCE-${row.req_id}`, req_id: row.req_id, tender_id: row.tender_id, issue_type: 'SOURCE_FIDELITY_EXPANSION', severity: 'P1-HIGH', owner: 'BACKEND_DETERMINISTIC', impact: 'source-backed output may exceed source span', evidence: row.gate_reason_codes });
  const uniqueP1 = uniq(p1Cases.map((x) => x.req_id)).length;
  const severityCounts = countBy(p1Cases, (x) => x.severity);
  const categoryDistribution = countBy(canonical, (x) => x.category);
  const riskFlags = {}; for (const item of canonical) for (const flag of (item.risk_flags || [])) riskFlags[flag] = (riskFlags[flag] || 0) + 1;
  const reasonSummary = Object.entries(countBy(reasonRows, (x) => x.reason_code)).map(([reason_code, trigger_count]) => ({ reason_code, trigger_count, unique_requirement_count: uniq(reasonRows.filter((x) => x.reason_code === reason_code).map((x) => x.req_id)).length, cooccurrence_count: reasonRows.filter((x) => x.reason_code === reason_code).length - uniq(reasonRows.filter((x) => x.reason_code === reason_code).map((x) => x.req_id)).length }));
  const numberSummary = { total: numberRows.length, true_positive: numTP, false_positive: numFP, ambiguous: numAmb, false_positive_rate: numberRows.length ? numFP / numberRows.length : 0 };
  const entitySummary = { total: entityRows.length, true_entity_drift: entTP, false_positive: entFP, ambiguous: entAmb, false_positive_rate: entityRows.length ? entFP / entityRows.length : 0 };
  const severityRank = { 'P1-HIGH': 0, 'P1-MEDIUM': 1, 'P1-LOW': 2 };
  const top = p1Cases.sort((a, b) => (severityRank[a.severity] - severityRank[b.severity]) || a.req_id.localeCompare(b.req_id)).slice(0, 10);
  const checkpoint = {
    artifact_type: 'V43_OVERNIGHT_REQUIREMENT_OUTPUT_P1_MASTER_AUDIT', run_id: runId, generated_at: new Date().toISOString(),
    INPUT_AUTHORITY_STATUS: incomplete.length ? 'FAIL_PACKET_INCOMPLETE' : 'PASS_CURRENT_PRODUCTION_SHAPED_SIX_TENDER_PACKET',
    INPUT_AUTHORITY_MANIFEST: authority, AUTHORITATIVE_PACKET_READY_COUNT: authority.filter((x) => x.pipeline_completeness === 'COMPLETE').length, PACKET_INCOMPLETE_TENDERS: incomplete,
    TOTAL_CANDIDATES: candidates.length, TOTAL_CANONICALS: canonical.length, SOURCE_VERIFIED_COUNT: sourceVerified, SOURCE_UNVERIFIED_COUNT: sourceUnverified,
    QUALITY_GATE_ACCEPT: gateAccept, QUALITY_GATE_REVIEW_REQUIRED: gateReview, QUALITY_GATE_REJECT: gateReject, REVIEW_REQUIRED_RATE: gateReview / canonical.length,
    ATOMIC_PASS_COUNT: atomicPass, ATOMIC_REVIEW_COUNT: atomicReview, HIGH_CONFIDENCE_OVERMERGED_COUNT: atomicHigh, ATOMIC_REVIEW_RATE: (atomicReview + atomicHigh) / canonical.length, HIGH_CONFIDENCE_OVERMERGED_RATE: atomicHigh / canonical.length,
    NUMBER_REVIEW_TOTAL: numberRows.length, NUMBER_TRUE_POSITIVE: numTP, NUMBER_FALSE_POSITIVE: numFP, NUMBER_AMBIGUOUS: numAmb, NUMBER_FALSE_POSITIVE_RATE: numberSummary.false_positive_rate,
    ENTITY_REVIEW_TOTAL: entityRows.length, TRUE_ENTITY_DRIFT_COUNT: entTP, ENTITY_FALSE_POSITIVE_COUNT: entFP, ENTITY_AMBIGUOUS_COUNT: entAmb, ENTITY_FALSE_POSITIVE_RATE: entitySummary.false_positive_rate,
    MODALITY_ESCALATION_COUNT: modalEsc, DOWNSTREAM_ROLE_RISK_COUNT: roleRows.length, WRITER_FALSE_NEGATIVE_RISK_COUNT: roleRows.filter((x) => x.writer_eligible === false).length,
    SOURCE_FIDELITY_P1_COUNT: sourceFidelityRows.length, HIGH_CONFIDENCE_SOURCE_EXPANSION_COUNT: sourceFidelityRows.filter((x) => x.fidelity_classification === 'HIGH_CONFIDENCE_SOURCE_EXPANSION').length, UNIQUE_P1_REQUIREMENT_COUNT: uniqueP1,
    P1_HIGH_COUNT: severityCounts['P1-HIGH'] || 0, P1_MEDIUM_COUNT: severityCounts['P1-MEDIUM'] || 0, P1_LOW_COUNT: severityCounts['P1-LOW'] || 0,
    PROVIDER_CALLS: 0, PRODUCTION_DB_WRITES: 0, FACT_PERSISTENCE: 0, GOLD_MUTATIONS: 0, MAPPING_ACTIONS: 0, CLAIM_ACTIONS: 0, WRITER_ACTIONS: 0,
    INPUT_ARTIFACTS: { canonical: 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json', candidates: 'docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json', quality_audit: 'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json', source_parity: 'docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.json' },
    HISTORICAL_MANIFEST_NOTE: 'Historical resolver coverage is retained as context only; current source parity v2 and canonical linkage are the authority used by this audit.',
    TOP_10_HIGH_VALUE_P1_CASES: top,
    TOP_3_MINIMAL_FIX_RECOMMENDATIONS: [
      { id: 'P1-A', owner: 'QUALITY_GATE', recommendation: 'Add context-aware classification for structural/identifier/scoring numbers before NUMBER_OMISSION_REVIEW.', business_impact: 'reduce avoidable review burden', confidence: 'MEDIUM', implementation_risk: 'LOW' },
      { id: 'P1-B', owner: 'DOWNSTREAM_ROUTING', recommendation: 'Introduce analysis-only response_role projection before changing writer eligibility; keep Claim/Writer authority unchanged.', business_impact: 'reduce response-planning coverage loss', confidence: roleRows.length ? 'MEDIUM' : 'LOW', implementation_risk: 'MEDIUM' },
      { id: 'P1-C', owner: 'CANONICAL_ATOMICITY', recommendation: 'Review only high-confidence multi-domain obligations for bounded mapping impact; do not auto-split.', business_impact: 'reduce mapping fragmentation risk', confidence: atomicHigh ? 'MEDIUM' : 'LOW', implementation_risk: 'MEDIUM' }
    ],
    REQUIREMENT_OUTPUT_P1_GATE: incomplete.length ? 'CONDITIONAL_PASS' : 'PASS',
    DECISION_BOUNDARY: 'Offline output-side audit only; no Production fix, Gold promotion, Provider quality claim, Holdout, Mapping, Claim, or Writer action.'
  };
  const caseManifest = { artifact_type: 'V43_REQUIREMENT_OUTPUT_P1_CASE_MANIFEST', run_id: runId, data_classification: 'EVAL_ONLY_DEVELOPMENT_REMEDIATION_COHORT', cases: p1Cases, unique_requirement_count: uniqueP1, no_gold_labels: true };
  const qualityForensics = { artifact_type: 'V43_REQUIREMENT_OUTPUT_P1_QUALITY_GATE_FORENSICS', run_id: runId, reason_summary: reasonSummary, number: numberSummary, entity: entitySummary, modality: { total: modalityRows.length, escalation: modalEsc, rows: modalityRows }, source_fidelity: sourceFidelityRows, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 };
  const atomicAudit = { artifact_type: 'V43_REQUIREMENT_OUTPUT_P1_ATOMICITY_AUDIT', run_id: runId, metrics: { pass: atomicPass, review: atomicReview, high_confidence_overmerged: atomicHigh, review_rate: (atomicReview + atomicHigh) / canonical.length, high_confidence_rate: atomicHigh / canonical.length }, by_tender: countBy(atomicRows.filter((x) => x.classification !== 'ATOMIC_PASS'), (x) => x.tender_id), cases: atomicRows.filter((x) => x.classification !== 'ATOMIC_PASS') };
  const downstreamAudit = { artifact_type: 'V43_REQUIREMENT_OUTPUT_P1_DOWNSTREAM_ROLE_AUDIT', run_id: runId, role_distribution: roleDistribution, downstream_role_risk_count: roleRows.length, writer_false_negative_risk_count: roleRows.filter((x) => x.writer_eligible === false).length, cases: roleRows, production_contract_changed: false };
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  write('checkpoint.json', checkpoint); write('case-manifest.json', caseManifest); write('quality-gate-forensics.json', qualityForensics); write('atomicity-audit.json', atomicAudit); write('downstream-role-audit.json', downstreamAudit);
  fs.writeFileSync(path.join(OUT, 'summary.md'), `# ${runId}\n\n- Input authority: ${checkpoint.INPUT_AUTHORITY_STATUS}\n- Canonicals: ${canonical.length}\n- Quality review required: ${gateReview}\n- Atomic high-confidence overmerged: ${atomicHigh}\n- Number false positives: ${numFP}\n- Downstream role risks: ${roleRows.length}\n- Provider calls / DB writes / Gold mutations: 0 / 0 / 0\n- Gate: ${checkpoint.REQUIREMENT_OUTPUT_P1_GATE}\n`);
  const developmentManifest = {
    artifact_type: 'V43_REQUIREMENT_OUTPUT_P1_DEVELOPMENT_MANIFEST', manifest_role: 'Development / Remediation Cohort', human_gold: false, holdout: false, production_gold: false, run_id: runId,
    atomicity_cases: atomicRows.filter((x) => x.classification !== 'ATOMIC_PASS').map((x) => x.req_id), number_review_false_positives: numberRows.filter((x) => x.classification === 'FALSE_POSITIVE').map((x) => x.req_id), entity_review_false_positives: entityRows.filter((x) => ['BIDDER_NORMALIZATION', 'PURCHASER_NORMALIZATION', 'PROJECT_ENTITY_NORMALIZATION'].includes(x.classification)).map((x) => x.req_id), modality_cases: modalityRows.map((x) => x.req_id), downstream_role_cases: roleRows.map((x) => x.req_id), source_fidelity_cases: sourceFidelityRows.map((x) => x.req_id), no_gold_mutation: true, no_production_change: true
  };
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_OUTPUT_P1_MANIFEST.json'), JSON.stringify(developmentManifest, null, 2));
  console.log(JSON.stringify({ run_id: runId, output_dir: path.relative(ROOT, OUT), checkpoint: path.relative(ROOT, path.join(OUT, 'checkpoint.json')), ...Object.fromEntries(['INPUT_AUTHORITY_STATUS','AUTHORITATIVE_PACKET_READY_COUNT','PACKET_INCOMPLETE_TENDERS','TOTAL_CANDIDATES','TOTAL_CANONICALS','SOURCE_VERIFIED_COUNT','QUALITY_GATE_ACCEPT','QUALITY_GATE_REVIEW_REQUIRED','QUALITY_GATE_REJECT','REVIEW_REQUIRED_RATE','ATOMIC_PASS_COUNT','ATOMIC_REVIEW_COUNT','HIGH_CONFIDENCE_OVERMERGED_COUNT','NUMBER_REVIEW_TOTAL','NUMBER_TRUE_POSITIVE','NUMBER_FALSE_POSITIVE','NUMBER_AMBIGUOUS','ENTITY_REVIEW_TOTAL','TRUE_ENTITY_DRIFT_COUNT','ENTITY_FALSE_POSITIVE_COUNT','ENTITY_AMBIGUOUS_COUNT','MODALITY_ESCALATION_COUNT','DOWNSTREAM_ROLE_RISK_COUNT','WRITER_FALSE_NEGATIVE_RISK_COUNT','SOURCE_FIDELITY_P1_COUNT','UNIQUE_P1_REQUIREMENT_COUNT','P1_HIGH_COUNT','P1_MEDIUM_COUNT','P1_LOW_COUNT','REQUIREMENT_OUTPUT_P1_GATE'].map((key) => [key, checkpoint[key]])) }));
}

main();
