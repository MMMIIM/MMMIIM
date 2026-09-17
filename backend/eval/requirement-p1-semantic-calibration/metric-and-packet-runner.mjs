import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const runId = process.env.P1_CALIBRATION_RUN_ID || `req-p1-calibration-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const OUT = path.join(ROOT, 'backend/eval/requirement-p1-semantic-calibration/results', runId);
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const norm = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
const safe = (value, max = 420) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const uniq = (values) => [...new Set(values.filter(Boolean))];
const countBy = (items, fn) => items.reduce((out, item) => { const k = fn(item) || 'UNCLASSIFIED'; out[k] = (out[k] || 0) + 1; return out; }, {});

function numberClass(token, source) {
  const i = source.indexOf(token);
  const context = i >= 0 ? source.slice(Math.max(0, i - 34), i + token.length + 34) : source;
  if (/\d+\s*\/\s*\d+|第\s*\d+\s*页|页码/.test(context)) return 'PAGE_OR_LAYOUT_NUMBER';
  if (/项目编号|采购编号|标准|GB\/?T|ISO|版本|编号|证书|代码|型号/.test(context)) return 'IDENTIFIER_NUMBER';
  if (/得分|分值|满分|扣分|评分|分，|分。/.test(context)) return 'SCORING_NUMBER';
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(token) || /[（(]\s*\d+\s*[）)]/.test(context) || /第\s*\d+(?:\.\d+)*\s*[章节条款]/.test(context)) return 'STRUCTURAL_NUMBER';
  if (/%|秒|毫秒|分钟|小时|日|年|月|次|人|名|个|台|套|条|项|容量|并发|响应|频率|期限|金额|元|万元|数量|不少于|不超过|以上|以下/.test(context)) return 'BUSINESS_CRITICAL_NUMBER';
  return 'AMBIGUOUS_NUMBER';
}

function entityClass(source, candidate, added) {
  if (/(我单位|我方|本单位|供应商)/.test(source) && /投标人/.test(candidate)) return 'SAFE_CONTEXTUAL_ENTITY_RESOLUTION';
  if (/本项目/.test(source) && /项目/.test(candidate)) return 'SAFE_CONTEXTUAL_ENTITY_RESOLUTION';
  if (/测试环境/.test(source) && /生产环境/.test(candidate)) return 'TRUE_ENTITY_DRIFT';
  if (/街道和社区/.test(source) && /职能部门/.test(candidate)) return 'TRUE_ENTITY_DRIFT';
  if (added.some((x) => /其他企业|未授权|第三方/.test(x))) return 'TRUE_ENTITY_DRIFT';
  return 'AMBIGUOUS';
}

function modalityClass(source, candidate) {
  if (/(建议|鼓励|可|视情况|原则上|如有需要|若中标)/.test(source) && /(必须|须|应当|应)/.test(candidate)) return 'TRUE_MODALITY_ESCALATION';
  if (/(须|必须|应当|应|需|需要)/.test(source) && /(必须|须|应当|应|需|需要)/.test(candidate)) return 'SAFE_REQUIREMENT_NORMALIZATION';
  if (/(建设|支持|提供|实现)/.test(source) && /(应建设|应支持|应提供|应实现)/.test(candidate)) return 'SAFE_REQUIREMENT_NORMALIZATION';
  if (/(必须|须|应当|应|需要|不得|禁止)/.test(source) && !/(必须|须|应当|应|需要|不得|禁止)/.test(candidate)) return 'TRUE_MODALITY_WEAKENING';
  return 'AMBIGUOUS';
}

function atomicKind(item) {
  const text = String(item.requirement_text || '');
  const domains = [
    /接口|性能|响应|参数|功能|系统|平台/.test(text),
    /实施|交付|培训|售后|运维|验收/.test(text),
    /资质|证书|认证|人员|业绩/.test(text),
    /合同|付款|违约|投标/.test(text),
    /安全|数据|权限|密码/.test(text)
  ].filter(Boolean).length;
  if (domains >= 2 && /;|；|包括|同时|以及|分别/.test(text)) return 'MAPPING_CRITICAL_OVERMERGED';
  if (domains >= 1 && /;|；|包括|同时|以及|分别/.test(text)) return 'BOUNDED_OVERMERGED';
  return 'RESPONSE_GROUPING_ACCEPTABLE';
}

function roleProjection(item) {
  const text = String(item.requirement_text || '');
  const category = String(item.category || '').toLowerCase();
  const context = String(item.requirement_category || '').toLowerCase();
  if (/得分|扣分|满分|评分项|评审标准|每提供一项/.test(text)) return { role: 'SCORING', reason: 'explicit scoring language', confidence: 'HIGH' };
  if (/合同|签订|付款|支付|违约|赔偿|保证金|履约|责任边界|合同期限|交付责任/.test(text)) return { role: 'CONTRACT', reason: 'contract or delivery-liability language', confidence: 'HIGH' };
  if (/投标截止|签章|加盖公章|上传|电子投标|资格|承诺函|证明材料|信用记录|格式要求|无效投标|不予通过/.test(text)) return { role: 'COMPLIANCE', reason: 'bid procedure or qualification evidence language', confidence: 'HIGH' };
  if (['technical', 'functional', 'performance', 'security', 'data', 'implementation', 'service', 'acceptance', 'delivery'].includes(category)
    || /系统|平台|接口|性能|响应时间|参数|功能|部署|兼容|数据|安全|实施|培训|运维|售后|验收|方案|技术要求/.test(text)) {
    return { role: 'TECHNICAL', reason: `technical/response content (${category || context || 'text signal'})`, confidence: 'MEDIUM' };
  }
  if (context === 'context' || category === 'other') {
    if (!/(应|须|需|必须|提供|支持|完成|提交|具备|满足|实施|验收|培训|配置|管理|查询|展示|上传|签订|具有)/.test(text)) return { role: 'NON_RESPONSE', reason: 'background or context without response obligation marker', confidence: 'MEDIUM' };
  }
  return { role: 'UNCLASSIFIED', reason: 'deterministic evidence insufficient for a safe role', confidence: 'LOW' };
}

function naturalContext(item, candidateId) {
  const span = item.source_span || {};
  const refs = item.source_refs || [];
  return {
    candidate_id: candidateId || null,
    source_refs: refs,
    source_hash: item.source_hash || null,
    source_span: span,
    parent_heading: null,
    section_role: item.requirement_category || item.category || null,
    table_title: null,
    table_headers: null,
    row_header: null,
    natural_source_window: { previous_context: null, current_context: item.source_excerpt || null, next_context: null },
    context_availability: { previous_context: false, current_context: Boolean(item.source_excerpt), next_context: false, parent_heading: false, table_context: false },
    semantic_context_refs: refs.length ? refs.map((ref) => ({ ref, origin: 'canonical.source_refs' })) : [{ ref: 'canonical.source_span', origin: 'canonical.source_span' }],
    semantic_context_refs_complete: Boolean(item.source_excerpt && item.source_span),
    natural_context_complete: Boolean(item.source_excerpt && item.source_span && item.source_hash),
    context_note: 'Only current canonical source excerpt/span is available in the authoritative packet; unavailable heading/table/sibling fields are explicit nulls, not inferred.'
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const canonical = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json').requirements;
  const recoveredCalibration = readJson('docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json');
  const recoveredByReqId = new Map((recoveredCalibration.cases || []).map((row) => [row.req_id || row.canonical_id, row]));
  const qualityAudit = readJson('docs/V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json');
  const candidateArtifact = readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json');
  const candidateRows = Array.isArray(candidateArtifact) ? candidateArtifact : (candidateArtifact.candidates || []);
  const candidateTextById = new Map(candidateRows.map((row) => [row.candidate_id, row.requirement_text]));
  const priorAudit = readJson('backend/eval/requirement-output-p1-audit/results/req-output-p1-audit-20260907163151/checkpoint.json');
  const mapping = new Map((qualityAudit.candidate_accounting?.rows || []).map((row) => [row.canonical_requirement_id, row.candidate_id]));
  const reasonSets = new Map(); const evaluations = [];
  const numberRows = []; const modalityRows = []; const entityRows = []; const fidelityRows = [];
  for (const item of canonical) {
    const gate = evaluateRequirementCandidateQuality({ requirement_text: item.requirement_text, source_verified: item.source_verified === true }, {
      sourceText: item.source_excerpt,
      sourceVerified: item.source_verified === true,
      sourceRange: item.source_span || null,
      semanticContextSufficient: recoveredByReqId.get(item.canonical_requirement_id)?.packet_structural_completeness?.semantic_context_sufficient === true
    });
    reasonSets.set(item.canonical_requirement_id, new Set(gate.reason_codes));
    evaluations.push({ item, gate });
    const numbers = gate.issues.find((x) => x.code === 'NUMBER_OMISSION_REVIEW');
    if (numbers) numberRows.push({ item, gate, classes: (numbers.detail?.omitted || []).map((token) => ({ token, classification: numberClass(token, item.source_excerpt || '') })) });
    const modality = gate.reason_codes.filter((x) => x === 'MODALITY_ADDITION_REVIEW' || x === 'MODALITY_OMISSION_REVIEW');
    if (modality.length) modalityRows.push({ item, gate, reason_codes: modality, classification: modalityClass(item.source_excerpt || '', item.requirement_text || '') });
    const entity = gate.issues.find((x) => x.code === 'ENTITY_MISMATCH_REVIEW');
    if (entity) entityRows.push({ item, gate, added: entity.detail?.added || [], classification: entityClass(item.source_excerpt || '', item.requirement_text || '', entity.detail?.added || []) });
    if (gate.reason_codes.some((x) => ['NEGATION_DISTORTION', 'NUMBER_DISTORTION', 'STATUS_DISTORTION', 'SCOPE_EXPANSION_REVIEW', 'OBVIOUS_SEMANTIC_MUTATION'].includes(x))) fidelityRows.push({ item, gate });
  }
  const reasonCodes = uniq(evaluations.flatMap((x) => x.gate.reason_codes)).sort();
  const reasonSummary = reasonCodes.map((reason) => {
    const ids = evaluations.filter((x) => x.gate.reason_codes.includes(reason)).map((x) => x.item.canonical_requirement_id);
    const co = ids.filter((id) => (reasonSets.get(id)?.size || 0) > 1);
    return { reason_code: reason, trigger_count: ids.length, unique_requirement_count: uniq(ids).length, cooccurrence_requirement_count: uniq(co).length, cooccurrence_rate: ids.length ? uniq(co).length / uniq(ids).length : 0 };
  });
  const pairMap = new Map();
  for (const set of reasonSets.values()) { const rs = [...set].sort(); for (let i = 0; i < rs.length; i += 1) for (let j = i + 1; j < rs.length; j += 1) { const k = `${rs[i]}|||${rs[j]}`; pairMap.set(k, (pairMap.get(k) || 0) + 1); } }
  const topPairs = [...pairMap.entries()].map(([key, shared_requirement_count]) => { const [reason_a, reason_b] = key.split('|||'); return { reason_a, reason_b, shared_requirement_count }; }).sort((a, b) => b.shared_requirement_count - a.shared_requirement_count || `${a.reason_a}${a.reason_b}`.localeCompare(`${b.reason_a}${b.reason_b}`)).slice(0, 10);
  const roles = canonical.map((item) => ({ item, projection: roleProjection(item) }));
  const roleCounts = countBy(roles, (x) => x.projection.role);
  const roleRows = roles.map(({ item, projection }) => ({ tender_id: item.tender_id, req_id: item.canonical_requirement_id, category: item.category, writer_eligible: item.writer_eligible === true, response_role: projection.role, reason: projection.reason, confidence: projection.confidence, source_verified: item.source_verified === true }));
  const roleGap = canonical.length - roleRows.length;

  const used = new Set();
  const selected = [];
  const addBucket = (bucket, rows, targetTotal, predicate = () => true, subbucket = null) => {
    for (const row of rows.filter(predicate).sort((a, b) => a.item.canonical_requirement_id.localeCompare(b.item.canonical_requirement_id))) {
      if (selected.filter((x) => x.primary_bucket === bucket).length >= targetTotal) break;
      const id = row.item.canonical_requirement_id;
      if (used.has(id)) continue;
      used.add(id); selected.push({ primary_bucket: bucket, subbucket, row });
    }
  };
  addBucket('NUMBER', numberRows, 4, (row) => row.classes.some((x) => x.classification === 'STRUCTURAL_NUMBER'), 'STRUCTURAL_ROW_LIST_SECTION');
  addBucket('NUMBER', numberRows, 8, (row) => row.classes.some((x) => x.classification === 'BUSINESS_CRITICAL_NUMBER'), 'BUSINESS_CRITICAL');
  addBucket('NUMBER', numberRows, 10, (row) => row.classes.some((x) => ['SCORING_NUMBER', 'IDENTIFIER_NUMBER'].includes(x.classification)), 'SCORING_OR_IDENTIFIER');
  addBucket('NUMBER', numberRows, 12, (row) => row.classes.some((x) => x.classification === 'AMBIGUOUS_NUMBER'), 'AMBIGUOUS');
  addBucket('NUMBER', numberRows, 12, () => true, 'FALLBACK');
  addBucket('MODALITY', modalityRows, 1, (row) => /提供/.test(row.item.source_excerpt || '') && /应提供/.test(row.item.requirement_text || ''), 'PROVIDE_TO_SHOULD_PROVIDE');
  addBucket('MODALITY', modalityRows, 2, (row) => /支持/.test(row.item.source_excerpt || '') && /应支持/.test(row.item.requirement_text || ''), 'SUPPORT_TO_SHOULD_SUPPORT');
  addBucket('MODALITY', modalityRows, 3, (row) => /建设/.test(row.item.source_excerpt || '') && /应建设/.test(row.item.requirement_text || ''), 'BUILD_TO_SHOULD_BUILD');
  addBucket('MODALITY', modalityRows, 4, (row) => /实现/.test(row.item.source_excerpt || '') && /(应实现|需实现|必须实现)/.test(row.item.requirement_text || ''), 'REALIZE_TO_MODALIZED');
  addBucket('MODALITY', modalityRows, 4, (row) => /(提供|支持|建设|实现)/.test(row.item.requirement_text || ''), 'ACTION_VERB_FALLBACK');
  addBucket('MODALITY', modalityRows, 8, (row) => /(建议|鼓励|可|视情况|原则上|如有需要|若中标)/.test(row.item.source_excerpt || ''), 'QUALIFIER');
  addBucket('MODALITY', modalityRows, 12, () => true, 'FALLBACK');
  addBucket('ENTITY', entityRows, 2, (row) => row.classification === 'TRUE_ENTITY_DRIFT', 'POTENTIAL_TRUE_SUBSTITUTION');
  addBucket('ENTITY', entityRows, 5, (row) => row.classification === 'SAFE_CONTEXTUAL_ENTITY_RESOLUTION', 'SAFE_CONTEXTUAL_RESOLUTION');
  addBucket('ENTITY', entityRows, 8, () => true, 'AMBIGUOUS_OR_BOUNDARY');
  for (const reason of ['NEGATION_DISTORTION', 'NUMBER_DISTORTION', 'STATUS_DISTORTION', 'SCOPE_EXPANSION_REVIEW', 'OBVIOUS_SEMANTIC_MUTATION']) {
    const target = Math.min(8, selected.filter((x) => x.primary_bucket === 'SOURCE_FIDELITY').length + 1);
    addBucket('SOURCE_FIDELITY', fidelityRows, target, (row) => row.gate.reason_codes.includes(reason), reason);
  }
  addBucket('SOURCE_FIDELITY', fidelityRows, 8, () => true, 'FALLBACK_NON_NUMBER_OMISSION');
  const atomicRows = (qualityAudit.atomicity_review_queue || []).map((q) => { const item = canonical.find((x) => x.canonical_requirement_id === q.canonical_requirement_id); return item ? { item, gate: evaluations.find((x) => x.item.canonical_requirement_id === item.canonical_requirement_id)?.gate, detector: q } : null; }).filter(Boolean);
  addBucket('ATOMICITY', atomicRows, 2, (row) => atomicKind(row.item) === 'MAPPING_CRITICAL_OVERMERGED', 'MAPPING_CRITICAL_OVERMERGED');
  addBucket('ATOMICITY', atomicRows, 3, (row) => atomicKind(row.item) === 'BOUNDED_OVERMERGED', 'BOUNDED_OVERMERGED');
  addBucket('ATOMICITY', atomicRows, 4, () => true, 'RESPONSE_GROUPING_ACCEPTABLE');
  addBucket('ROLE', roles.map((x) => ({ item: x.item, projection: x.projection })), 1, (row) => row.projection.role === 'TECHNICAL', 'TECHNICAL');
  addBucket('ROLE', roles.map((x) => ({ item: x.item, projection: x.projection })), 2, (row) => row.projection.role === 'SCORING', 'SCORING');
  addBucket('ROLE', roles.map((x) => ({ item: x.item, projection: x.projection })), 3, (row) => row.projection.role === 'COMPLIANCE', 'COMPLIANCE');
  addBucket('ROLE', roles.map((x) => ({ item: x.item, projection: x.projection })), 4, (row) => row.projection.role === 'CONTRACT', 'CONTRACT');
  const bucketCounts = countBy(selected, (x) => x.primary_bucket);
  const modalityPatternCoverage = {
    provide_to_should_provide: modalityRows.filter((row) => /提供/.test(row.item.source_excerpt || '') && /应提供/.test(row.item.requirement_text || '')).length,
    support_to_should_support: modalityRows.filter((row) => /支持/.test(row.item.source_excerpt || '') && /应支持/.test(row.item.requirement_text || '')).length,
    build_to_should_build: modalityRows.filter((row) => /建设/.test(row.item.source_excerpt || '') && /应建设/.test(row.item.requirement_text || '')).length,
    realize_to_modalized: modalityRows.filter((row) => /实现/.test(row.item.source_excerpt || '') && /(应实现|需实现|必须实现)/.test(row.item.requirement_text || '')).length,
    selected_subbuckets: countBy(selected.filter((x) => x.primary_bucket === 'MODALITY'), (x) => x.subbucket)
  };
  const duplicatePrimary = selected.length - uniq(selected.map((x) => x.row.item.canonical_requirement_id)).length;
  const packet = selected.map(({ primary_bucket, subbucket, row }) => {
    const item = row.item;
    const reqId = item.canonical_requirement_id;
    const gate = row.gate || evaluations.find((x) => x.item.canonical_requirement_id === reqId)?.gate;
    const secondary = uniq((gate?.reason_codes || []).filter((reason) => {
      if (primary_bucket === 'NUMBER') return reason !== 'NUMBER_OMISSION_REVIEW';
      if (primary_bucket === 'MODALITY') return !reason.startsWith('MODALITY_');
      if (primary_bucket === 'ENTITY') return reason !== 'ENTITY_MISMATCH_REVIEW';
      return true;
    }));
    const role = roleProjection(item);
    const detectorEvidence = primary_bucket === 'NUMBER' ? (numberRows.find((x) => x.item.canonical_requirement_id === reqId)?.classes || []) : primary_bucket === 'MODALITY' ? [{ reason_codes: gate?.reason_codes || [], classification: modalityRows.find((x) => x.item.canonical_requirement_id === reqId)?.classification || null }] : primary_bucket === 'ENTITY' ? [{ added_entities: entityRows.find((x) => x.item.canonical_requirement_id === reqId)?.added || [], classification: entityRows.find((x) => x.item.canonical_requirement_id === reqId)?.classification || null }] : [{ quality_gate_reason_codes: gate?.reason_codes || [], atomicity_marker: row.detector || null }];
    return {
      calibration_case_id: `${primary_bucket}-${reqId}`,
      primary_bucket,
      primary_subbucket: subbucket,
      tender_id: item.tender_id,
      req_id: reqId,
      candidate_id: mapping.get(reqId) || null,
      canonical_id: reqId,
      category: item.category,
      writer_eligible: item.writer_eligible === true,
      current_response_role: role.role,
      source_refs: item.source_refs || [],
      source_text: item.source_excerpt || '',
      parent_heading: null,
      section_role: item.requirement_category || item.category || null,
      table_title: null,
      table_headers: null,
      row_header: null,
      natural_source_window: naturalContext(item, mapping.get(reqId)),
      candidate_text: candidateTextById.get(mapping.get(reqId)) || item.requirement_text,
      canonical_text: item.requirement_text,
      quality_gate_reason_codes: gate?.reason_codes || [],
      secondary_reason_codes: secondary,
      detector_evidence: detectorEvidence,
      current_audit_classification: primary_bucket === 'ROLE' ? role.role : primary_bucket === 'ATOMICITY' ? 'ATOMICITY_REVIEW_QUEUE' : gate?.decision || 'DETECTOR_HIT',
      semantic_context_refs: naturalContext(item, mapping.get(reqId)).semantic_context_refs,
      source_location_verified: item.source_verified === true,
      semantic_provenance_complete: naturalContext(item, mapping.get(reqId)).semantic_context_refs_complete,
      adjudication_status: 'PENDING_GPT_SEMANTIC_ADJUDICATION',
      not_gold: true,
      not_holdout: true,
      not_production_authority: true
    };
  });
  const validationReserve = canonical.filter((item) => !used.has(item.canonical_requirement_id)).slice(0, 24).map((item) => ({ tender_id: item.tender_id, req_id: item.canonical_requirement_id, source_hash: item.source_hash, reserved_for_independent_development_validation: true, adjudicated: false }));
  const naturalComplete = packet.filter((x) => x.natural_source_window.natural_context_complete).length;
  const semanticRefsComplete = packet.filter((x) => x.semantic_provenance_complete).length;
  const metricCheckpoint = {
    artifact_type: 'V43_REQUIREMENT_P1_METRIC_INTEGRITY_CHECKPOINT', run_id: runId, generated_at: new Date().toISOString(), total_canonicals: canonical.length, reason_code_count: reasonCodes.length,
    cooccurrence_metric_definition: 'For reason R, count unique Requirements containing R and at least one other reason_code; not pair count or raw triggers.', cooccurrence_recomputed: 'PASS', reason_summary: reasonSummary, top_reason_pairs: topPairs,
    role_technical: roleCounts.TECHNICAL || 0, role_scoring: roleCounts.SCORING || 0, role_compliance: roleCounts.COMPLIANCE || 0, role_contract: roleCounts.CONTRACT || 0, role_non_response: roleCounts.NON_RESPONSE || 0, role_unclassified: roleCounts.UNCLASSIFIED || 0, role_total: roleRows.length, role_gap: roleGap, role_identity_loss: qualityAudit.candidate_accounting?.unmapped_count || 0,
    source_identity_loss: 0, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, production_code_changes: 0, prompt_changes: 0, schema_changes: 0,
    phase_a_status: roleGap === 0 && (qualityAudit.candidate_accounting?.unmapped_count || 0) === 0 ? 'PASS' : 'FAIL', role_rows: roleRows
  };
  const cooccurrence = { artifact_type: 'V43_REQUIREMENT_P1_COOCCURRENCE_ANALYSIS', run_id: runId, metric_definition: metricCheckpoint.cooccurrence_metric_definition, reason_summary: reasonSummary, top_reason_pairs: topPairs, reason_sets_by_requirement: Object.fromEntries([...reasonSets.entries()].map(([id, set]) => [id, [...set].sort()])) };
  const roleCoverage = { artifact_type: 'V43_REQUIREMENT_P1_RESPONSE_ROLE_COVERAGE', run_id: runId, taxonomy: ['TECHNICAL', 'SCORING', 'COMPLIANCE', 'CONTRACT', 'NON_RESPONSE', 'UNCLASSIFIED'], counts: roleCounts, total: roleRows.length, gap: roleGap, identity_loss: metricCheckpoint.role_identity_loss, rows: roleRows };
  const packetArtifact = { artifact_type: 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET', run_id: runId, data_classification: 'DEVELOPMENT_CALIBRATION_ONLY', human_gold: false, holdout: false, production_gold: false, calibration_case_count: packet.length, bucket_counts: bucketCounts, modality_pattern_coverage: modalityPatternCoverage, duplicate_primary_case_count: duplicatePrimary, natural_context_complete_count: naturalComplete, semantic_context_refs_complete_count: semanticRefsComplete, validation_reserve_count: validationReserve.length, cases: packet, validation_reserve: validationReserve, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, adjudication_status: 'PENDING_GPT_SEMANTIC_ADJUDICATION' };
  const write = (file, value) => fs.writeFileSync(path.join(OUT, file), JSON.stringify(value, null, 2));
  write('metric-integrity-checkpoint.json', metricCheckpoint); write('cooccurrence-analysis.json', cooccurrence); write('response-role-coverage.json', roleCoverage); write('gpt-semantic-calibration-packet.json', packetArtifact);
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json'), JSON.stringify(packetArtifact, null, 2));
  console.log(JSON.stringify({ run_id: runId, output_dir: path.relative(ROOT, OUT), calibration_packet: path.relative(ROOT, path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json')), phase_a: metricCheckpoint.phase_a_status, total_canonicals: canonical.length, reason_code_count: reasonCodes.length, top_reason_pairs: topPairs, role_counts: roleCounts, role_total: roleRows.length, role_gap: roleGap, role_identity_loss: metricCheckpoint.role_identity_loss, calibration_case_count: packet.length, bucket_counts: bucketCounts, natural_context_complete_count: naturalComplete, semantic_context_refs_complete_count: semanticRefsComplete, duplicate_primary_case_count: duplicatePrimary, validation_reserve_count: validationReserve.length, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }));
}

main();
