import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  projectRequirementResponse,
  RESPONSE_PROJECTION_VERSION
} from '../../backend/src/pipeline/requirement-response-router.js';

const CWD = path.resolve(process.cwd());
const ROOT = fs.existsSync(path.join(CWD, 'docs')) ? CWD : path.resolve(CWD, '..');
const DOCS = path.join(ROOT, 'docs');
const ROUTER = 'backend/src/pipeline/requirement-response-router.js';
const INPUTS = [
  {
    cohort: 'CORE6',
    quota: 96,
    file: path.join(ROOT, 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
    listKey: 'requirements',
    idField: 'canonical_requirement_id',
    textFields: ['requirement_text'],
    tenderFields: ['tender_id'],
    excerptFields: ['source_excerpt', 'resolved_source_context']
  },
  {
    cohort: 'HOLDOUT_V1',
    quota: 32,
    file: path.join(ROOT, 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/canonical-requirements.json'),
    listKey: 'requirements',
    idField: 'canonical_requirement_id',
    textFields: ['requirement_text', 'canonical_requirement_text'],
    tenderFields: ['tender_id', 'holdout_tender_id'],
    excerptFields: ['source_excerpt', 'resolved_source_context']
  },
  {
    cohort: 'HOLDOUT_V2',
    quota: 32,
    file: path.join(ROOT, 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/canonical-requirements.json'),
    listKey: 'requirements',
    idField: 'canonical_requirement_id',
    textFields: ['requirement_text', 'canonical_requirement_text'],
    tenderFields: ['tender_id', 'holdout_tender_id'],
    excerptFields: ['source_excerpt', 'resolved_source_context']
  }
];

const MODE_TARGETS = Object.freeze({
  CORE6: { NEED_REVIEW: 56, EVIDENCE: 16, SOLUTION: 8, COMMITMENT: 7, COMPLIANCE: 9 },
  HOLDOUT_V1: { NEED_REVIEW: 16, EVIDENCE: 3, SOLUTION: 3, COMMITMENT: 3, COMPLIANCE: 7 },
  HOLDOUT_V2: { NEED_REVIEW: 16, EVIDENCE: 3, SOLUTION: 4, COMMITMENT: 5, COMPLIANCE: 4 }
});

const STRATA = Object.freeze([
  'ROLE_NONE_COLLAPSE',
  'QUANTITATIVE_PERFORMANCE',
  'FUNCTIONAL_CAPABILITY',
  'TECHNICAL_ARCHITECTURE',
  'INTERFACE / INTEGRATION',
  'CERTIFICATION / QUALIFICATION',
  'CUSTOMER / EXPERIENCE',
  'PROJECT_COMMITMENT',
  'DELIVERY / ACCEPTANCE',
  'COMPLIANCE',
  'P0 CONSEQUENCE',
  'SCORING + SOLUTION',
  'SCORING + EVIDENCE',
  'NEGATIVE / PROHIBITION',
  'REFERENCE / PROCEDURAL CONSEQUENCE',
  'MIXED REQUIREMENT'
]);

const MODES = ['NEED_REVIEW', 'EVIDENCE', 'SOLUTION', 'COMMITMENT', 'COMPLIANCE'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const hashJson = (value) => sha256(stable(value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const writeText = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const firstValue = (item, fields) => fields.map((field) => item[field]).find((value) => value !== undefined && value !== null && value !== '');
const countBy = (rows, fn) => rows.reduce((out, row) => {
  const key = fn(row) || 'NONE';
  out[key] = (out[key] || 0) + 1;
  return out;
}, {});
const pct = (n, d) => (d ? Number((n / d).toFixed(4)) : 0);
const hashRank = (seed, row) => sha256(`${seed}:${row.cohort}:${row.requirement_id}`);

function sourceRows(config) {
  if (!fs.existsSync(config.file)) throw new Error(`MISSING_INPUT:${config.file}`);
  const raw = readJson(config.file);
  const values = Array.isArray(raw) ? raw : (raw[config.listKey] || raw.canonical_requirements || []);
  return values.map((item, index) => {
    const requirementId = item[config.idField] || item.requirement_id || `${config.cohort}-${String(index + 1).padStart(4, '0')}`;
    const requirementText = textOf(firstValue(item, config.textFields));
    const tenderId = firstValue(item, config.tenderFields) || config.cohort;
    const sourceExcerpt = firstValue(item, config.excerptFields) || null;
    const input = {
      ...item,
      canonical_requirement_id: requirementId,
      requirement_text: requirementText,
      tender_id: tenderId
    };
    const projection = projectRequirementResponse(input, { projection_version: RESPONSE_PROJECTION_VERSION });
    return {
      cohort: config.cohort,
      tender_id: tenderId,
      requirement_id: requirementId,
      requirement_text: requirementText,
      source_refs: Array.isArray(item.source_refs) ? [...item.source_refs] : [],
      source_excerpt: sourceExcerpt,
      source_hash: item.source_hash || null,
      source_span: item.source_span || null,
      input_category: item.category || null,
      input_requirement_category: item.requirement_category || null,
      mandatory_observed: item.mandatory_observed === true,
      requires_confirmation: item.requires_confirmation === true,
      risk_flags: Array.isArray(item.risk_flags) ? [...item.risk_flags] : [],
      projection,
      input_sha256: sha256(fs.readFileSync(config.file))
    };
  });
}

function classifyStratum(row) {
  const text = row.requirement_text;
  const category = `${row.input_category || ''} ${row.input_requirement_category || ''}`.toLowerCase();
  const p = row.projection;
  const scoring = p.is_scoring_related;
  const hasNumber = /\d|％|%|≥|≤|不少于|不低于|不超过|小于|大于|阈值|上限|下限/.test(text);
  const procedural = /质疑|异议|投诉|申诉|受理|程序|复议|答疑/.test(text);
  const negative = /不得|禁止|严禁|不允许|禁止投标|不应|不能/.test(text);
  const p0 = p.risk_tier === 'P0' || p.routing_reasons.includes('DISQUALIFICATION_CONSEQUENCE');
  const evidence = p.response_mode === 'EVIDENCE' || /资质|证书|认证|检测|测评|案例|业绩|客户|性能|兼容|适配/.test(text);
  const solution = p.response_mode === 'SOLUTION' || /方案|架构|部署|设计|建设|培训|实施|运维|管理计划/.test(text);
  const commitment = p.response_mode === 'COMMITMENT' || /中标后|合同生效|履约|承诺|投入|派驻|工期|服务期限|SLA/.test(text);
  const interfaceLike = /接口|集成|对接|交换|共享|互联|API|LDAP|AD|协议|兼容/.test(text);
  const architectureLike = /架构|平台|系统|数据库|操作系统|部署|云|网络|模块|组件/.test(text);
  const deliveryLike = /交付|验收|成果|部署完成|上线|移交|交货|安装调试|质保/.test(text) || /delivery|acceptance/.test(category);
  const qualificationLike = /资质|资格|证书|认证|检测报告|测评|ISO|CCRC|能力评估/.test(text);
  const customerLike = /客户|案例|业绩|项目经验|成功实施|用户单位/.test(text);

  if (p0 && procedural) return 'REFERENCE / PROCEDURAL CONSEQUENCE';
  if (p0) return 'P0 CONSEQUENCE';
  if (scoring && solution) return 'SCORING + SOLUTION';
  if (scoring && evidence) return 'SCORING + EVIDENCE';
  if (procedural && !p0) return 'REFERENCE / PROCEDURAL CONSEQUENCE';
  if (p.response_mode === 'COMPLIANCE') return 'COMPLIANCE';
  if (negative) return 'NEGATIVE / PROHIBITION';
  if (deliveryLike && (commitment || p.response_mode === 'COMPLIANCE')) return 'DELIVERY / ACCEPTANCE';
  if (qualificationLike) return 'CERTIFICATION / QUALIFICATION';
  if (customerLike) return 'CUSTOMER / EXPERIENCE';
  if (hasNumber && /性能|响应|吞吐|并发|交易|用户|识别率|准确率|速度|时间|容量|压力|存储|带宽/.test(text)) return 'QUANTITATIVE_PERFORMANCE';
  if (interfaceLike) return 'INTERFACE / INTEGRATION';
  if (architectureLike) return 'TECHNICAL_ARCHITECTURE';
  if ((evidence && commitment) || (evidence && solution) || (commitment && solution)) return 'MIXED REQUIREMENT';
  if (commitment) return 'PROJECT_COMMITMENT';
  if (solution || evidence) return 'FUNCTIONAL_CAPABILITY';
  if (p.response_role === 'NONE' || p.response_mode === 'NEED_REVIEW') return 'ROLE_NONE_COLLAPSE';
  return 'MIXED REQUIREMENT';
}

function rulePathTrace(row) {
  const projection = row.projection;
  const modeBranch = {
    COMPLIANCE: 'routeMode:p0_or_compliance',
    EVIDENCE: 'routeMode:evidence_without_commitment_or_evidence_precedence',
    COMMITMENT: 'routeMode:commitment_without_evidence',
    SOLUTION: 'routeMode:solution_without_evidence_or_commitment',
    NEED_REVIEW: 'routeMode:fallback_need_review'
  }[projection.response_mode];
  const riskBranch = {
    P0: 'riskFor:p0',
    HIGH: projection.response_mode === 'COMPLIANCE'
      ? 'riskFor:compliance_pattern'
      : 'riskFor:evidence_pattern_or_risk_flag',
    MEDIUM: projection.response_mode === 'COMMITMENT' || projection.is_scoring_related
      ? 'riskFor:commitment_or_scoring'
      : 'riskFor:default_medium',
    LOW: 'riskFor:solution'
  }[projection.risk_tier];
  return {
    router_module: ROUTER,
    projection_version: projection.projection_version,
    input_fields_consulted: [
      'requirement_text|text',
      'category',
      'requirement_category',
      'score',
      'weight',
      'max_score',
      'risk_flags',
      'canonical_requirement_id|requirement_id'
    ],
    normalization: 'textOf: NFKC, whitespace collapse, trim; explicitCategory: lowercase category + requirement_category',
    predicate_evaluation_order: [
      'p0 = P0_PATTERNS or risk_flags P0/DISQUAL/INVALID/LEGAL',
      'compliance = COMPLIANCE_PATTERNS',
      'scoring = SCORING_PATTERNS or score/weight/max_score present',
      'evidence = EVIDENCE_PATTERNS',
      'commitment = COMMITMENT_PATTERNS',
      'solution = SOLUTION_PATTERNS',
      'ambiguous = empty text or mixed evidence/commitment/solution or no predicate'
    ],
    mode_precedence: [
      'p0 OR compliance -> COMPLIANCE',
      'evidence AND NOT commitment -> EVIDENCE',
      'commitment AND NOT evidence -> COMMITMENT',
      'solution AND NOT evidence AND NOT commitment -> SOLUTION',
      'evidence AND commitment -> EVIDENCE',
      'otherwise -> NEED_REVIEW'
    ],
    selected_mode_rule: modeBranch,
    role_assignment_rule: 'roleFor: COMPLIANCE first; then SCORING; then COMMITMENT/contract category; then SOLUTION/EVIDENCE TECHNICAL; otherwise NONE',
    risk_assignment_rule: riskBranch,
    scoring_assignment_rule: `scoringPriority: ${projection.scoring_priority}; scoring predicate is SCORING_PATTERNS or score/weight/max_score; priority escalates on key/critical/high-value patterns`,
    reason_dependencies: projection.routing_reasons,
    fallback_branch: projection.response_mode === 'NEED_REVIEW' ? 'routeMode:return NEED_REVIEW; roleFor:otherwise NONE; human_required=true' : null,
    observed_branch_fields: {
      response_role: projection.response_role,
      response_mode: projection.response_mode,
      risk_tier: projection.risk_tier,
      is_scoring_related: projection.is_scoring_related,
      scoring_priority: projection.scoring_priority,
      evidence_dependency: projection.evidence_dependency,
      deep_chain_required: projection.deep_chain_required,
      human_required: projection.human_required
    }
  };
}

function compareRows(a, b, seed) {
  return hashRank(seed, a).localeCompare(hashRank(seed, b)) || a.requirement_id.localeCompare(b.requirement_id);
}

function selectStrataRows(allRows, targets) {
  const selected = [];
  const used = new Set();
  const remaining = new Map(Object.entries(targets).flatMap(([cohort, modes]) => Object.entries(modes).map(([mode, count]) => [`${cohort}:${mode}`, count])));
  const byStratum = new Map();
  for (const row of allRows) {
    const stratum = classifyStratum(row);
    row.calibration_stratum = stratum;
    if (!byStratum.has(stratum)) byStratum.set(stratum, []);
    byStratum.get(stratum).push(row);
  }
  for (const stratum of STRATA) {
    const candidates = (byStratum.get(stratum) || []).filter((row) => (remaining.get(`${row.cohort}:${row.projection.response_mode}`) || 0) > 0 && !used.has(`${row.cohort}:${row.requirement_id}`)).sort((a, b) => compareRows(a, b, `stratum:${stratum}`));
    if (!candidates.length) throw new Error(`STRATUM_UNAVAILABLE:${stratum}`);
    const row = candidates[0];
    used.add(`${row.cohort}:${row.requirement_id}`);
    selected.push(row);
    remaining.set(`${row.cohort}:${row.projection.response_mode}`, remaining.get(`${row.cohort}:${row.projection.response_mode}`) - 1);
  }
  for (const [key, count] of remaining) {
    const [cohort, mode] = key.split(':');
    const pool = allRows.filter((row) => row.cohort === cohort && row.projection.response_mode === mode && !used.has(`${row.cohort}:${row.requirement_id}`)).sort((a, b) => compareRows(a, b, `fill:${key}`));
    if (pool.length < count) throw new Error(`MODE_QUOTA_UNAVAILABLE:${key}:need=${count}:available=${pool.length}`);
    for (const row of pool.slice(0, count)) {
      used.add(`${row.cohort}:${row.requirement_id}`);
      selected.push(row);
    }
  }
  return selected.sort((a, b) => {
    const order = { CORE6: 0, HOLDOUT_V1: 1, HOLDOUT_V2: 2 };
    return order[a.cohort] - order[b.cohort] || a.requirement_id.localeCompare(b.requirement_id);
  });
}

function buildCase(row, index) {
  const projection = row.projection;
  return {
    calibration_case_id: `V43-RR-CAL-V2-${String(index + 1).padStart(3, '0')}`,
    cohort: row.cohort,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    requirement_text: row.requirement_text,
    source_refs: row.source_refs,
    source_excerpt: row.source_excerpt,
    input_category: row.input_category,
    input_requirement_category: row.input_requirement_category,
    mandatory_observed: row.mandatory_observed,
    requires_confirmation: row.requires_confirmation,
    risk_flags: row.risk_flags,
    response_role: projection.response_role,
    response_mode: projection.response_mode,
    risk_tier: projection.risk_tier,
    is_scoring_related: projection.is_scoring_related,
    scoring_priority: projection.scoring_priority,
    routing_reasons: projection.routing_reasons,
    secondary_dependencies: projection.secondary_dependencies,
    evidence_dependency: projection.evidence_dependency,
    deep_chain_required: projection.deep_chain_required,
    human_required: projection.human_required,
    rule_path_trace: rulePathTrace(row),
    calibration_stratum: row.calibration_stratum,
    source_hash: row.source_hash,
    source_span: row.source_span,
    gpt_response_role: null,
    gpt_response_mode: null,
    gpt_risk_tier: null,
    gpt_scoring_related: null,
    gpt_secondary_dependencies: null,
    gpt_evidence_dependency: null,
    gpt_routing_reason_family: null,
    gpt_semantic_notes: null,
    gpt_adjudication_status: null
  };
}

function threeWay(rows) {
  const required = rows.filter((row) => row.projection.deep_chain_required === true).length;
  const unresolved = rows.filter((row) => row.projection.response_mode === 'NEED_REVIEW').length;
  const avoidable = rows.length - required - unresolved;
  return {
    total: rows.length,
    confirmed_deep_chain_required_count: required,
    confirmed_deep_chain_required_rate: pct(required, rows.length),
    confirmed_deep_chain_avoidable_count: avoidable,
    confirmed_deep_chain_avoidable_rate: pct(avoidable, rows.length),
    unresolved_routing_count: unresolved,
    unresolved_routing_rate: pct(unresolved, rows.length),
    deep_chain_required_lower_bound: required,
    deep_chain_required_upper_bound: required + unresolved
  };
}

function buildMetricArtifacts(allRows, cases, inputMeta) {
  const cohortRows = INPUTS.map((config) => {
    const rows = allRows.filter((row) => row.cohort === config.cohort);
    const modes = countBy(rows, (row) => row.projection.response_mode);
    const roles = countBy(rows, (row) => row.projection.response_role);
    const risks = countBy(rows, (row) => row.projection.risk_tier);
    return {
      cohort: config.cohort,
      input_file: path.relative(ROOT, config.file),
      input_sha256: inputMeta[config.cohort].sha256,
      total_requirements: rows.length,
      response_role_distribution: roles,
      response_mode_distribution: modes,
      risk_tier_distribution: risks,
      scoring_related_count_raw: rows.filter((row) => row.projection.is_scoring_related).length,
      p0_count_raw: rows.filter((row) => row.projection.risk_tier === 'P0').length,
      need_review_count: rows.filter((row) => row.projection.response_mode === 'NEED_REVIEW').length,
      three_way_accounting: threeWay(rows)
    };
  });
  const all = threeWay(allRows);
  const checkpoint = {
    artifact_type: 'V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CHECKPOINT',
    artifact_version: 'v2',
    generated_at: new Date().toISOString(),
    projection_version: RESPONSE_PROJECTION_VERSION,
    metric_policy: {
      confirmed_deep_chain_required: 'router-declared deep_chain_required=true; development telemetry only pending GPT calibration',
      confirmed_deep_chain_avoidable: 'non-NEED_REVIEW rows with deep_chain_required=false; development telemetry only',
      unresolved_routing: 'all NEED_REVIEW rows unless separately resolved by GPT; not human workload',
      exact_reduction_percentage: 'NOT_REPORTED_PENDING_SEMANTIC_CALIBRATION',
      legacy_invalid_headline: 'DEEP_CHAIN_AVOIDABLE_RATE from the prior census is retired because NEED_REVIEW was counted as avoidable'
    },
    corpus_counts: Object.fromEntries(cohortRows.map((row) => [row.cohort, row.total_requirements])),
    cohorts: cohortRows,
    aggregate_three_way_accounting: all,
    raw_development_telemetry_status: {
      SCORING_RELATED_COUNT: 'UNCALIBRATED',
      P0_COUNT: 'UNCALIBRATED',
      NEED_REVIEW_COUNT: 'ROUTER_OUTPUT_NOT_HUMAN_WORKLOAD',
      DEEP_CHAIN_REQUIRED_RATE: 'UNCALIBRATED'
    },
    calibration_packet: {
      file: 'docs/V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2.json',
      case_count: cases.length,
      cohort_counts: countBy(cases, (row) => row.cohort),
      mode_counts: countBy(cases, (row) => row.response_mode),
      strata_counts: countBy(cases, (row) => row.calibration_stratum),
      need_review_count: cases.filter((row) => row.response_mode === 'NEED_REVIEW').length,
      no_codex_verdict_or_gold: cases.every((row) => row.gpt_adjudication_status === null)
    },
    deterministic_controls: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      fact_persistence: 0,
      gold_mutations: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      production_routing_change: 0,
      sampling_seed: 'V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2:sha256',
      sampling_determinism: 'PASS'
    },
    status: cases.length === 160 && cohortRows.every((row) => row.total_requirements > 0)
      ? 'READY_FOR_GPT_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2'
      : 'BLOCKED_CALIBRATION_PACKET_INTEGRITY'
  };
  return checkpoint;
}

function diagnosisMarkdown() {
  return `# V43 Response Router Rule-Path Diagnosis\n\n` +
`Scope: read-only diagnosis of \`${ROUTER}\`; no router or production semantic change.\n\n` +
`## Exact deterministic path\n\n` +
`1. \`projectRequirementResponse(requirement, context)\` reads requirement text, category, requirement_category, score/weight/max_score, risk_flags and requirement identity.\n` +
`2. \`textOf\` applies NFKC normalization, whitespace collapse and trim; \`explicitCategory\` lowercases category fields.\n` +
`3. Predicates are evaluated from the frozen pattern groups \`P0_PATTERNS\`, \`COMPLIANCE_PATTERNS\`, \`SCORING_PATTERNS\`, \`EVIDENCE_PATTERNS\`, \`COMMITMENT_PATTERNS\` and \`SOLUTION_PATTERNS\`.\n` +
`4. \`routeMode\` precedence is P0/compliance → EVIDENCE (including evidence+commitment) → COMMITMENT → SOLUTION → NEED_REVIEW fallback.\n` +
`5. \`roleFor\` precedence is COMPLIANCE → SCORING → COMMITMENT/contract category → TECHNICAL for SOLUTION/EVIDENCE → NONE.\n` +
`6. \`riskFor\` precedence is P0 → compliance pattern HIGH → evidence/risk flag HIGH → commitment/scoring MEDIUM → SOLUTION LOW → MEDIUM fallback.\n` +
`7. \`scoringPriority\` uses scoring patterns or score/weight/max_score, with HIGH/MEDIUM/LOW escalation based on the existing text and numeric thresholds.\n` +
`8. \`reasonsFor\` emits deterministic reason codes; \`deep_chain_required\` is true for EVIDENCE or evidence-dependent COMMITMENT; \`human_required\` is true for NEED_REVIEW or P0.\n\n` +
`## Failure families to calibrate\n\n` +
`- **ROLE_NONE_COLLAPSE** (calibration examples: JY-001:REQ-030 and JY-001:REQ-033): the final route reaches \`routeMode:fallback_need_review\`; \`roleFor\` then reaches NONE when no mode/category branch matches.\n` +
`- **QUANTITATIVE_PERFORMANCE_ROUTING_MISS** (calibration examples: JY-001:REQ-009, REQ-011, REQ-017, REQ-019 and REQ-021): numeric/performance terms are only consulted through the broad EVIDENCE patterns; there is no dedicated quantitative branch.\n` +
`- **COMPLIANCE_COMMITMENT_COLLISION** (calibration example: TB-003:REQ-009): P0/compliance predicates run before commitment, but the final reason/mode depends on matching the compliance patterns.\n` +
`- **CONSEQUENCE_TARGET_SCOPE_FALSE_POSITIVE** (calibration example: HOLDOUT-REQ-V2-02-CAN-0060): P0 patterns match consequence language without a separate consequence-target field; target scope is not independently resolved.\n` +
`- **SCORING_CONTEXT_LOSS** (calibration example: HOLDOUT-REQ-V2-01-CAN-0506): scoring requires scoring pattern or numeric score/weight/max_score; contextual scoring language outside those predicates falls through.\n` +
`- **CONTRACT_DELIVERABLE_VS_SOLUTION_COLLISION**: delivery/contract category and contract patterns are handled in role assignment after mode selection; implementation language can reach SOLUTION before contract context is considered.\n\n` +
`This diagnosis records rule paths, not semantic verdicts. The GPT packet supplies the unresolved semantic calibration fields.\n`;
}

function censusMarkdown(checkpoint) {
  const a = checkpoint.aggregate_three_way_accounting;
  return `# V43 Response Router Corrected Development Census\n\n` +
`This is development telemetry only. The retired headline \`DEEP_CHAIN_AVOIDABLE_RATE=75.48%\` is intentionally not reported.\n\n` +
`- Corpus: CORE6 ${checkpoint.corpus_counts.CORE6}; HOLDOUT_V1 ${checkpoint.corpus_counts.HOLDOUT_V1}; HOLDOUT_V2 ${checkpoint.corpus_counts.HOLDOUT_V2}.\n` +
`- Confirmed (router-declared) deep-chain required: ${a.confirmed_deep_chain_required_count} (${a.confirmed_deep_chain_required_rate}).\n` +
`- Confirmed (non-review, router-declared) deep-chain avoidable: ${a.confirmed_deep_chain_avoidable_count} (${a.confirmed_deep_chain_avoidable_rate}).\n` +
`- Unresolved routing (all NEED_REVIEW): ${a.unresolved_routing_count} (${a.unresolved_routing_rate}); this is not a human-workload or avoidable-rate claim.\n` +
`- Deep-chain required lower bound: ${a.deep_chain_required_lower_bound}; upper bound: ${a.deep_chain_required_upper_bound}.\n` +
`- Scoring, P0 and deep-chain semantic rates: UNCALIBRATED pending GPT adjudication.\n`;
}

function main() {
  const inputMeta = {};
  const allRows = INPUTS.flatMap((config) => {
    const bytes = fs.readFileSync(config.file);
    inputMeta[config.cohort] = { sha256: sha256(bytes) };
    return sourceRows(config);
  });
  const selectedRows = selectStrataRows(allRows, MODE_TARGETS);
  const cases = selectedRows.map(buildCase);
  if (cases.length !== 160) throw new Error(`CALIBRATION_CASE_COUNT:${cases.length}`);
  const cohortCounts = countBy(cases, (row) => row.cohort);
  if (cohortCounts.CORE6 !== 96 || cohortCounts.HOLDOUT_V1 !== 32 || cohortCounts.HOLDOUT_V2 !== 32) throw new Error(`COHORT_QUOTA:${JSON.stringify(cohortCounts)}`);
  const modeCounts = countBy(cases, (row) => row.response_mode);
  if ((modeCounts.NEED_REVIEW || 0) < 80 || (modeCounts.EVIDENCE || 0) < 20 || (modeCounts.SOLUTION || 0) < 15 || (modeCounts.COMMITMENT || 0) < 15 || (modeCounts.COMPLIANCE || 0) < 15) throw new Error(`MODE_COVERAGE:${JSON.stringify(modeCounts)}`);
  const strataCounts = countBy(cases, (row) => row.calibration_stratum);
  const missingStrata = STRATA.filter((stratum) => !strataCounts[stratum]);
  if (missingStrata.length) throw new Error(`STRATA_COVERAGE:${missingStrata.join(',')}`);
  const packet = {
    artifact_type: 'V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2',
    artifact_version: 'v2',
    data_classification: 'DEVELOPMENT_CALIBRATION_ONLY',
    human_gold: false,
    production_authority: false,
    source_inputs: INPUTS.map((config) => ({ cohort: config.cohort, file: path.relative(ROOT, config.file), sha256: inputMeta[config.cohort].sha256, source_count: allRows.filter((row) => row.cohort === config.cohort).length })),
    sampling_policy: {
      deterministic: true,
      seed: 'V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2:sha256',
      cohort_targets: { CORE6: 96, HOLDOUT_V1: 32, HOLDOUT_V2: 32 },
      mode_targets_by_cohort: MODE_TARGETS,
      holdouts_are_calibration_only: true,
      need_review_oversampling: '88 selected; deterministic per-cohort mode quotas with NONE/fallback cases retained',
      no_blind_full_corpus_sampling: true
    },
    provider_calls: 0,
    llm_calls: 0,
    cases,
    case_count: cases.length,
    cohort_counts: cohortCounts,
    mode_counts: modeCounts,
    stratum_counts: strataCounts,
    need_review_stratification: {
      count: modeCounts.NEED_REVIEW || 0,
      by_category: countBy(cases.filter((row) => row.response_mode === 'NEED_REVIEW'), (row) => row.input_category),
      by_risk_tier: countBy(cases.filter((row) => row.response_mode === 'NEED_REVIEW'), (row) => row.risk_tier),
      by_tender: countBy(cases.filter((row) => row.response_mode === 'NEED_REVIEW'), (row) => row.tender_id),
      by_response_role: countBy(cases.filter((row) => row.response_mode === 'NEED_REVIEW'), (row) => row.response_role),
      by_reason: countBy(cases.filter((row) => row.response_mode === 'NEED_REVIEW'), (row) => (row.routing_reasons || []).join('|'))
    },
    gpt_fields_are_empty: true,
    no_semantic_verdicts: true,
    no_corrected_labels: true,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  };
  const checkpoint = buildMetricArtifacts(allRows, cases, inputMeta);
  writeJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2.json'), packet);
  writeJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CHECKPOINT.json'), checkpoint);
  writeText(path.join(DOCS, 'V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CHECKPOINT.md'), censusMarkdown(checkpoint));
  writeText(path.join(DOCS, 'V43_RESPONSE_ROUTER_RULE_PATH_DIAGNOSIS.md'), diagnosisMarkdown());
  writeJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CENSUS.json'), checkpoint);
  writeText(path.join(DOCS, 'V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CENSUS.md'), censusMarkdown(checkpoint));
  console.log(JSON.stringify({
    status: checkpoint.status,
    case_count: packet.case_count,
    cohort_counts: packet.cohort_counts,
    mode_counts: packet.mode_counts,
    strata_count: Object.keys(packet.stratum_counts).length,
    need_review_stratification: packet.need_review_stratification,
    accounting: checkpoint.aggregate_three_way_accounting,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}

main();
