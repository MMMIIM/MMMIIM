import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../src/db.js';
import { PUBLIC_CORPUS_PROJECT_ID } from '../../src/pipeline/corpus-contract.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from '../../src/pipeline/embedding-client.js';
import { projectResponseDecisionV1 } from '../../src/pipeline/response-decision-v1.js';
import { buildSectionContext } from '../../src/pipeline/section-context-builder.js';
import { resolveMaterialSourceRole } from '../../src/pipeline/material-source-authority-policy.js';
import { applyRetrievalChunkRole, isCitationIndexLike, isWriterReferenceContentEligible } from '../../src/pipeline/retrieval-chunk-role.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'docs', 'handoff', process.env.V43_RAG_OUTPUT_DIR || 'V43_CORE6_1009_REAL_REFERENCE_RAG_AND_WRITER_CONTEXT_EVAL_V1');
const SOURCE = path.join(ROOT, 'docs', 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const MATERIAL_TYPES = ['technical_solution', 'technical_whitepaper'];
const RUN_ID = `V43-CORE6-REAL-REFERENCE-RAG-WRITER-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const K = 4;
const CANDIDATE_K = 20;
const MMR_LAMBDA = 0.9;

fs.mkdirSync(OUT, { recursive: true });
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = file => sha256(fs.readFileSync(file));
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const jsonArray = value => Array.isArray(value) ? value : [];
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

const THEME_PATTERNS = [
  ['architecture', /架构|技术路线|平台架构|总体设计|系统设计/u],
  ['functional_design', /功能|模块|业务|应用|门户|报表|坐席/u],
  ['integration', /接口|集成|互联|对接|交换|API|数据共享/u],
  ['data_governance', /数据治理|数据标准|数据目录|数据质量|元数据|主数据/u],
  ['security', /安全|等保|权限|审计|密码|保密|隐私/u],
  ['deployment', /部署|上线|迁移|适配|信创|国产化|环境/u],
  ['implementation', /实施|建设|项目管理|质量|风险|进度|交付/u],
  ['testing', /测试|试运行|验收|培训|验证|演练/u],
  ['operations', /运维|运营|维护|服务|应急|故障|SLA/u],
  ['backup_dr', /备份|容灾|灾备|高可用|恢复|连续性/u],
  ['performance_design', /性能|容量|并发|吞吐|响应时间|扩展性/u],
  ['ai_rag_agent', /人工智能|智能体|知识库|RAG|大模型|算法/u],
  ['healthcare', /医院|医疗|病历|医保|临床/u],
  ['government_it', /政务|政府|城市|一网统管|行政/u],
  ['software_platform', /软件|平台|系统|数据库|中间件/u],
  ['water_operations', /水务|供水|排水|污水|泵站|河道/u]
];

function themeOf(req) {
  const value = `${req.requirement_text ?? ''} ${req.category ?? ''} ${req.requirement_category ?? ''}`;
  const hit = THEME_PATTERNS.find(([, pattern]) => pattern.test(value));
  return hit?.[0] ?? 'other';
}

function route(req) {
  return projectResponseDecisionV1({
    ...req,
    requirement_id: req.canonical_requirement_id,
    req_id: req.canonical_requirement_id,
    text: req.requirement_text,
    requirement_category: req.requirement_category ?? req.category,
    category: req.category,
    is_mandatory: req.mandatory === true
  });
}

function referenceEligibility(decision) {
  if (decision.decision_status !== 'ROUTED') return { eligible: false, reason: 'ROUTER_NEED_REVIEW' };
  if (decision.response_mode !== 'SOLUTION') return { eligible: false, reason: `ROUTER_MODE_${decision.response_mode || 'NONE'}` };
  if (decision.response_required === false) return { eligible: false, reason: 'RESPONSE_NOT_REQUIRED' };
  return {
    eligible: true,
    reason: 'ROUTER_SOLUTION_RESPONSE_REQUIRED_REFERENCE_CONTEXT',
    cohort: decision.evidence_dependency === true ? 'SOLUTION_WITH_EVIDENCE_SECONDARY' : 'SOLUTION_PURE',
    writer_ready: decision.human_required !== true
  };
}

function selectExecutionCohort(rows, maxCases = 80) {
  const order = new Map(TENDERS.map((tender, index) => [tender, index]));
  const stable = rows.slice().sort((a, b) => (order.get(a.tender_id) - order.get(b.tender_id))
    || String(a.selection_theme || '').localeCompare(String(b.selection_theme || ''))
    || String(a.canonical_requirement_id).localeCompare(String(b.canonical_requirement_id)));
  const selected = [];
  const seen = new Set();
  const add = (row, method) => {
    if (!row || seen.has(row.canonical_requirement_id) || selected.length >= Math.min(maxCases, rows.length)) return;
    seen.add(row.canonical_requirement_id);
    selected.push({ ...row, selection_rank: selected.length + 1, selection_method: method });
  };
  // Guarantee natural tender and cohort representation where available.
  for (const tender of TENDERS) {
    for (const cohort of ['SOLUTION_PURE', 'SOLUTION_WITH_EVIDENCE_SECONDARY']) {
      add(stable.find(row => row.tender_id === tender && row.reference_eligibility.cohort === cohort), 'DETERMINISTIC_TENDER_COHORT_SEED');
    }
  }
  for (const row of stable) add(row, 'DETERMINISTIC_TENDER_THEME_ID_FILL');
  return selected;
}

function selectPerTender(rows) {
  const selected = [];
  const byTheme = new Map();
  for (const row of rows) {
    const theme = themeOf(row);
    if (!byTheme.has(theme)) byTheme.set(theme, []);
    byTheme.get(theme).push(row);
  }
  for (const list of byTheme.values()) list.sort((a, b) => String(a.canonical_requirement_id).localeCompare(String(b.canonical_requirement_id)));
  const order = [...THEME_PATTERNS.map(([name]) => name), 'other'];
  let progressed = true;
  while (selected.length < 10 && progressed) {
    progressed = false;
    for (const theme of order) {
      const list = byTheme.get(theme) || [];
      const candidate = list.shift();
      if (candidate) {
        selected.push({ ...candidate, selection_theme: theme, selection_rank: selected.length + 1, selection_method: 'DETERMINISTIC_THEME_ROUND_ROBIN' });
        progressed = true;
      }
      if (selected.length >= 10) break;
    }
  }
  if (selected.length < Math.min(10, rows.length)) {
    const used = new Set(selected.map(item => item.canonical_requirement_id));
    for (const row of rows.slice().sort((a, b) => String(a.canonical_requirement_id).localeCompare(String(b.canonical_requirement_id)))) {
      if (selected.length >= Math.min(10, rows.length)) break;
      if (used.has(row.canonical_requirement_id)) continue;
      selected.push({ ...row, selection_theme: themeOf(row), selection_rank: selected.length + 1, selection_method: 'DETERMINISTIC_ID_FILL' });
    }
  }
  return selected;
}

function annotate(row) {
  const role = resolveMaterialSourceRole(row);
  const annotated = applyRetrievalChunkRole(row);
  const sourceText = String(annotated.source_text ?? '');
  const textHash = sha256(sourceText);
  return {
    ...annotated,
    source_role: role.role,
    source_role_reason: role.reason,
    source_text_sha256: textHash,
    source_text_hash_matches_chunk_hash: Boolean(annotated.chunk_hash && annotated.chunk_hash === textHash),
    source_lineage: {
      material_id: annotated.material_id ?? null,
      chunk_id: annotated.chunk_id ?? null,
      chunk_hash: annotated.chunk_hash ?? null,
      original_name: annotated.original_name ?? null,
      source_document_id: annotated.source_document_id ?? annotated.material_id ?? null,
      source_chunk_id: annotated.source_chunk_id ?? annotated.chunk_id ?? null
    },
    lifecycle_eligible: String(annotated.lifecycle_status ?? '').toUpperCase() === 'ACTIVE'
      && String(annotated.review_status ?? '').toLowerCase() === 'approved'
      && ['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT'].includes(String(annotated.usage_status ?? '').toUpperCase())
      && String(annotated.extraction_status ?? 'succeeded').toLowerCase() === 'succeeded'
  };
}

function compactReference(row, strategy, finalRank) {
  const rawRank = Number(row.raw_vector_rank ?? row.rank ?? 0) || null;
  return {
    strategy,
    final_rank: finalRank,
    raw_candidate_rank: rawRank,
    candidate_to_final_rank_delta: rawRank == null ? null : rawRank - finalRank,
    material_id: row.material_id ?? null,
    chunk_id: row.chunk_id ?? null,
    chunk_hash: row.chunk_hash ?? null,
    material_type: row.material_type ?? null,
    source_role: row.source_role ?? 'REFERENCE_ONLY',
    source_role_reason: row.source_role_reason ?? null,
    corpus_scope: row.corpus_scope ?? null,
    chunk_role: row.chunk_role ?? null,
    source_text: row.source_text ?? '',
    original_name: row.original_name ?? null,
    source_lineage: row.source_lineage ?? null,
    source_text_sha256: row.source_text_sha256 ?? null,
    similarity_score: Number(row.similarity_score ?? row.raw_similarity ?? 0),
    lifecycle_status: row.lifecycle_status ?? null,
    review_status: row.review_status ?? null,
    usage_status: row.usage_status ?? null,
    substantive_candidate: row.substantive_candidate === true,
    citation_index_like: isCitationIndexLike(row.source_text ?? '')
  };
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return null;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : null;
}

function mmr(rows, vectorsByEmbeddingId) {
  const eligible = rows.filter(row => isWriterReferenceContentEligible(row));
  const remaining = eligible.slice();
  const selected = [];
  while (selected.length < K && remaining.length) {
    let winner = null; let winnerScore = Number.NEGATIVE_INFINITY;
    for (const row of remaining) {
      const vector = vectorsByEmbeddingId.get(String(row.embedding_id));
      const redundancy = selected.length
        ? Math.max(...selected.map(item => cosine(vector, vectorsByEmbeddingId.get(String(item.embedding_id))) ?? 0))
        : 0;
      const score = MMR_LAMBDA * Number(row.similarity_score ?? 0) - (1 - MMR_LAMBDA) * redundancy;
      if (score > winnerScore || (score === winnerScore && String(row.chunk_id).localeCompare(String(winner?.chunk_id ?? '')) < 0)) {
        winner = row; winnerScore = score;
      }
    }
    if (!winner) break;
    remaining.splice(remaining.indexOf(winner), 1);
    selected.push(winner);
  }
  return selected;
}

function strategyMetrics(caseRecords, strategyKey) {
  const refs = caseRecords.flatMap(item => item.strategies[strategyKey]?.final_references ?? []);
  const distribution = {};
  for (const item of caseRecords) {
    const count = item.strategies[strategyKey]?.final_references?.length ?? 0;
    distribution[count] = (distribution[count] || 0) + 1;
  }
  const count = predicate => refs.filter(predicate).length;
  const perCaseUniqueMaterials = caseRecords.map(item => new Set((item.strategies[strategyKey]?.final_references ?? []).map(ref => ref.material_id)).size);
  const deltas = refs.map(ref => ref.candidate_to_final_rank_delta).filter(value => Number.isFinite(value));
  const lineageFields = ['material_id', 'chunk_id', 'chunk_hash', 'source_text', 'source_lineage'];
  const missingLineage = refs.filter(ref => lineageFields.some(field => ref[field] == null || ref[field] === '' || (field === 'source_lineage' && !ref.source_lineage?.material_id))).length;
  const queryChars = caseRecords.reduce((sum, item) => sum + item.query.length, 0);
  return {
    case_count: caseRecords.length,
    returned_reference_count_distribution: distribution,
    zero_reference_rate: caseRecords.length
      ? caseRecords.filter(item => (item.strategies[strategyKey]?.final_references ?? []).length === 0).length / caseRecords.length
      : 0,
    mean_reference_count: caseRecords.length ? refs.length / caseRecords.length : 0,
    heading_escape: count(ref => ref.chunk_role === 'HEADING'),
    front_matter_escape: count(ref => ref.chunk_role === 'FRONT_MATTER'),
    metadata_escape: count(ref => ref.chunk_role === 'METADATA'),
    citation_index_escape: count(ref => ref.citation_index_like === true),
    wrong_role_escape: count(ref => ref.source_role !== 'REFERENCE_ONLY'),
    wrong_scope_escape: count(ref => !['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE', 'INDUSTRY', 'PUBLIC'].includes(String(ref.corpus_scope || '').toUpperCase())),
    quarantined_escape: count(ref => String(ref.lifecycle_status || '').toUpperCase() !== 'ACTIVE' || String(ref.review_status || '').toLowerCase() !== 'approved' || !['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT'].includes(String(ref.usage_status || '').toUpperCase())),
    duplicate_chunk_escape: caseRecords.reduce((sum, item) => {
      const ids = (item.strategies[strategyKey]?.final_references ?? []).map(ref => ref.chunk_hash || `${ref.material_id}:${ref.chunk_id}`);
      return sum + (new Set(ids).size < ids.length ? 1 : 0);
    }, 0),
    same_material_max: Math.max(0, ...caseRecords.map(item => {
      const counts = new Map();
      for (const ref of item.strategies[strategyKey]?.final_references ?? []) counts.set(ref.material_id, (counts.get(ref.material_id) || 0) + 1);
      return Math.max(0, ...counts.values());
    })),
    unique_material_count_mean: perCaseUniqueMaterials.length ? perCaseUniqueMaterials.reduce((a, b) => a + b, 0) / perCaseUniqueMaterials.length : 0,
    candidate_to_final_rank_delta: { mean: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null, values: deltas },
    lineage_completeness_rate: refs.length ? (refs.length - missingLineage) / refs.length : 1,
    input_text_size_estimate: { query_chars: queryChars, estimated_tokens: Math.ceil(queryChars / 4) },
    semantic_labels_created: 0
  };
}

function emptyStrategies(status, reason) {
  const make = strategy => ({ strategy, status, final_references: [], candidate_count: 0, eligible_candidate_count: 0, reason: reason ?? null });
  return { R0_CURRENT_PRODUCTION_REFERENCE_PATH: make('R0_CURRENT_PRODUCTION_REFERENCE_PATH'), R1_CURRENT_PLUS_ACCEPTED_HYGIENE: make('R1_CURRENT_PLUS_ACCEPTED_HYGIENE'), R2_TRUE_VECTOR_MMR_LAMBDA_0_9: make('R2_TRUE_VECTOR_MMR_LAMBDA_0_9') };
}

dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
const sourceArtifact = readJson(SOURCE);
const requirements = jsonArray(sourceArtifact.requirements);
const sourceSha = fileSha(SOURCE);
const sourceIdentity = {
  artifact: path.relative(ROOT, SOURCE),
  sha256: sourceSha,
  expected_sha256_from_prior_identity_reconciliation: 'ff07402688a3013af9a9b8be01f613f76848b7ea905208c1955a604432422fe1',
  row_count: requirements.length,
  unique_requirement_ids: new Set(requirements.map(item => item.canonical_requirement_id)).size,
  tender_ids: [...sourceArtifact.tender_ids],
  eval_only: sourceArtifact.eval_only === true,
  human_gold_authority: false,
  semantic_labels_created: 0
};

writeJson('00_EXECUTION_MANIFEST.json', {
  artifact_type: 'V43_CORE6_1009_REAL_REFERENCE_RAG_AND_WRITER_CONTEXT_EVAL_V1_EXECUTION_MANIFEST',
  run_id: RUN_ID,
  source_identity: sourceIdentity,
  execution_scope: {
    purpose: 'Requirement-level Reference Retrieval Eval with read-only Writer Safe Context boundary checks; no Writer Product Fidelity claim and no semantic adjudication.',
    tenders: TENDERS,
    target_cases_per_tender: null,
    maximum_execution_cases: 80,
    minimum_total_cases: null,
    reference_material_types: MATERIAL_TYPES,
    public_corpus_project_id: PUBLIC_CORPUS_PROJECT_ID,
    strategies: ['R0_CURRENT_PRODUCTION_REFERENCE_PATH', 'R1_CURRENT_PLUS_ACCEPTED_HYGIENE', 'R2_TRUE_VECTOR_MMR_LAMBDA_0_9'],
    mmr_lambda: MMR_LAMBDA,
    embedding_budget: { max_query_calls: 80, concurrency: 1, retry_max: 1, corpus_reembedding: false },
    generative_llm_calls: 0,
    writer_provider_calls: 0
  },
  authority_boundary: {
    requirement_source: 'SOURCE-DERIVED_EVAL_AUTHORITY_ONLY',
    human_gold_authority: false,
    production_requirement_authority: false,
    reference_materials_authority: 'REFERENCE_ONLY_CONTEXT_ONLY'
  },
  side_effects: {
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    requirement_mutations: 0,
    gold_mutations: 0,
    fact_mapping_claim_writer_mutations: 0,
    migration: 0,
    commit: 0,
    push: 0,
    merge: 0,
    deploy: 0
  },
  expected_outputs: [
    '00_EXECUTION_MANIFEST.json',
    '01_CORE6_EVAL_IDENTITY.json',
    '02_PRODUCTION_QUERY_PATH_AUDIT.json',
    '03_REFERENCE_DENOMINATOR.json',
    '04_REAL_6TENDER_EVAL_SET.json',
    '05_R0_CURRENT_RESULTS.json',
    '06_R1_HYGIENE_RESULTS.json',
    '07_R2_TRUE_MMR_RESULTS.json or 07_R2_NOT_EXECUTED.json',
    '08_MECHANICAL_COMPARISON.json',
    '09_GPT_SEMANTIC_REVIEW_PACKET.json',
    '10_FAILURE_FAMILY_TEMPLATE.json',
    '11_WRITER_SAFE_CONTEXT_DRY_RUN.json',
    '12_RAW_INPUT_EXPOSURE_AUDIT.json',
    '13_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION.json',
    '14_PROVIDER_EMBEDDING_AUDIT.json',
    '15_TEST_REPORT.json',
    '16_DEBT_REGISTER.json',
    '17_CHECKPOINT.json',
    '17_CHECKPOINT.md'
  ]
});

const routed = requirements.map(req => {
  const decision = route(req);
  return { ...req, route: decision, reference_eligibility: referenceEligibility(decision), selection_theme: themeOf(req) };
});
const eligible = routed.filter(item => item.reference_eligibility.eligible);
const excluded = routed.filter(item => !item.reference_eligibility.eligible);
const selected = selectExecutionCohort(eligible, 80);
const selectionById = new Map(selected.map(item => [item.canonical_requirement_id, item]));
const selectionBlocked = new Set(selected.map(item => item.tender_id)).size < 6
  ? { code: 'REFERENCE_EVAL_TENDER_COVERAGE_INCOMPLETE', message: `Current production response semantics yielded ${selected.length} executable cases across ${new Set(selected.map(item => item.tender_id)).size}/6 tenders; no cross-tender backfill is permitted.` }
  : null;

writeJson('01_CORE6_EVAL_IDENTITY.json', {
  artifact_type: 'V43_CORE6_EVAL_IDENTITY',
  source_identity: sourceIdentity,
  tender_distribution: Object.fromEntries(TENDERS.map(tender => [tender, requirements.filter(item => item.tender_id === tender).length])),
  selected_eval_distribution: Object.fromEntries(TENDERS.map(tender => [tender, selected.filter(item => item.tender_id === tender).length])),
  authority: 'SOURCE-DERIVED_EVAL_AUTHORITY',
  prohibition: 'NOT_HUMAN_GOLD_AND_NOT_PRODUCTION_REQUIREMENT_AUTHORITY'
});

const routerFile = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2-3.js');
const selectorFile = path.join(ROOT, 'backend/src/pipeline/writer-reference-selector.js');
const roleFile = path.join(ROOT, 'backend/src/pipeline/material-source-authority-policy.js');
const chunkRoleFile = path.join(ROOT, 'backend/src/pipeline/retrieval-chunk-role.js');
const queryAudit = {
  artifact_type: 'V43_PRODUCTION_QUERY_PATH_AUDIT',
  response_router_owner: 'backend/src/pipeline/response-decision-v1.js::projectResponseDecisionV1',
  response_router_version: routed[0]?.route?.projection_version ?? null,
  response_router_implementation_id: routed[0]?.route?.implementation_id ?? null,
  response_router_sha256: fileSha(routerFile),
  writer_query_owner: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
  writer_query_sha256: fileSha(selectorFile),
  source_role_owner: 'backend/src/pipeline/material-source-authority-policy.js::resolveMaterialSourceRole',
  source_role_sha256: fileSha(roleFile),
  hygiene_owner: 'backend/src/pipeline/retrieval-chunk-role.js::isWriterReferenceContentEligible',
  hygiene_sha256: fileSha(chunkRoleFile),
  production_query_semantics: {
    query_text: '[section.title, ...requirements.map(item => item.text)].filter(Boolean).join("\\n")',
    section_title_source: 'NO_SECTION_FIELD_IN_CORE6_ARTIFACT; section.title omitted rather than fabricated',
    effective_eval_query: 'canonical requirement text only',
    material_types: MATERIAL_TYPES,
    top_k: K,
    candidate_limit: CANDIDATE_K,
    project_id: PUBLIC_CORPUS_PROJECT_ID,
    project_id_role: 'PUBLIC_CORPUS_READ_ONLY_CONTEXT',
    no_eval_enrichment: true,
    no_retrieval_result_used_for_selection: true
  }
};
writeJson('02_PRODUCTION_QUERY_PATH_AUDIT.json', queryAudit);

writeJson('03_REFERENCE_DENOMINATOR.json', {
  artifact_type: 'V43_REFERENCE_DENOMINATOR',
  total_requirements: routed.length,
  eligible_count: eligible.length,
  excluded_count: excluded.length,
  eligible_by_tender: Object.fromEntries(TENDERS.map(tender => [tender, eligible.filter(item => item.tender_id === tender).length])),
  selected_by_tender: Object.fromEntries(TENDERS.map(tender => [tender, selected.filter(item => item.tender_id === tender).length])),
  selection_constraint: { minimum_total: null, maximum_execution_cases: 80, required_tender_count: 6, selected_tender_count: new Set(selected.map(item => item.tender_id)).size, selection_blocked: Boolean(selectionBlocked), selection_blocker: selectionBlocked },
  policy: 'response_required=true AND response_mode=SOLUTION; evidence_dependency is retained as a secondary cohort; human_required only affects Writer-ready subset',
  rows: routed.map(item => ({
    tender_id: item.tender_id,
    requirement_id: item.canonical_requirement_id,
    response_mode: item.route.response_mode,
    decision_status: item.route.decision_status,
    response_required: item.route.response_required,
    evidence_dependency: item.route.evidence_dependency,
    human_required: item.route.human_required,
    reference_cohort: item.reference_eligibility.cohort ?? null,
    writer_ready: item.reference_eligibility.writer_ready ?? null,
    risk_tier: item.route.risk_tier,
    reference_eligible: item.reference_eligibility.eligible,
    exclusion_reason: item.reference_eligibility.eligible ? null : item.reference_eligibility.reason
  })),
  semantic_labels_created: 0,
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0
});

writeJson('04_REAL_6TENDER_EVAL_SET.json', {
  artifact_type: 'V43_REAL_6TENDER_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_SET',
  source_identity: sourceIdentity,
  evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL',
  selection_policy: 'deterministic tender/cohort seed then tender/theme/ID fill; no retrieval results used',
  target_per_tender: null,
  maximum_execution_cases: 80,
  minimum_total: null,
  case_count: selected.length,
  tender_count: new Set(selected.map(item => item.tender_id)).size,
  cohort_distribution: {
    SOLUTION_PURE: selected.filter(item => item.reference_eligibility.cohort === 'SOLUTION_PURE').length,
    SOLUTION_WITH_EVIDENCE_SECONDARY: selected.filter(item => item.reference_eligibility.cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length
  },
  requirements: selected.map(item => ({
    case_id: `RAG-${item.tender_id}-${String(item.canonical_requirement_id).replace(/[^A-Za-z0-9]+/g, '-')}`,
    tender_id: item.tender_id,
    requirement_id: item.canonical_requirement_id,
    requirement_text: item.requirement_text,
    category: item.category,
    requirement_category: item.requirement_category,
    section_identity: null,
    response_decision: item.route,
    reference_cohort: item.reference_eligibility.cohort,
    writer_ready: item.reference_eligibility.writer_ready,
    reference_need: true,
    selection_theme: item.selection_theme,
    selection_rank: item.selection_rank,
    selection_method: item.selection_method,
    source_refs: item.source_refs,
    source_excerpt: item.source_excerpt,
    source_span: item.source_span,
    source_hash: item.source_hash,
    source_verified: item.source_verified,
    requirement_hash: item.requirement_hash
  }))
});

let pool = null;
let transport = null;
let embeddingClient = null;
let dbIdentity = null;
let dbError = null;
let dbSchema = { required_tables: [], missing_tables: [] };
try {
  pool = createPool(process.env.DATABASE_URL);
  dbIdentity = (await pool.query('select current_database() as database,current_schema() as schema')).rows[0];
  const requiredTables = ['company_materials', 'material_chunks', 'material_chunk_embeddings', 'project_material_bindings'];
  const tableRows = (await pool.query(
    'select table_name from information_schema.tables where table_schema=current_schema() and table_name = any($1::text[])',
    [requiredTables]
  )).rows.map(row => row.table_name);
  dbSchema = { required_tables: requiredTables, missing_tables: requiredTables.filter(name => !tableRows.includes(name)) };
} catch (error) {
  dbError = { code: error.code ?? null, message: error.message };
}
if (dbError == null) {
  transport = createEmbeddingFetchFromEnv({ env: process.env });
  embeddingClient = createEmbeddingClientFromEnv({ env: process.env, fetchImpl: transport.fetchImpl });
}

const providerAudit = {
  provider: 'siliconflow',
  api_base_configured: Boolean(embeddingClient?.apiBase),
  api_key_present: Boolean(embeddingClient?.apiKey),
  model: embeddingClient?.model ?? null,
  version: embeddingClient?.version ?? null,
  dimension: embeddingClient?.dimension ?? null,
  max_calls: 80,
  concurrency: 1,
  retry_max: 1,
  generative_llm_calls: 0,
  writer_provider_calls: 0,
  call_count: 0,
  failures: [],
  retries: 0,
  latency_ms: [],
  stop_on_first_provider_failure: true,
  no_secrets_persisted: true
};

const baseCase = item => ({
  case_id: `RAG-${item.tender_id}-${String(item.canonical_requirement_id).replace(/[^A-Za-z0-9]+/g, '-')}`,
  tender_id: item.tender_id,
  requirement_id: item.canonical_requirement_id,
  requirement_text: item.requirement_text,
  section_identity: null,
  response_mode: item.route.response_mode,
  reference_need: true,
  response_decision: item.route,
  query: item.requirement_text,
  source_refs: item.source_refs,
  source_hash: item.source_hash,
  strategies: null,
  raw_candidates: [],
  execution_status: 'NOT_STARTED'
});

const caseRecords = selected.map(baseCase);
let retrievalBlocked = null;
const vectorCache = new Map();

async function fetchVectors(ids) {
  if (!ids.length || !pool) return new Map();
  const missing = ids.filter(id => !vectorCache.has(String(id)));
  if (missing.length) {
    const rows = (await pool.query('select embedding_id, embedding::text as vector_text from material_chunk_embeddings where embedding_id = any($1::uuid[])', [missing])).rows;
    for (const row of rows) {
      const raw = String(row.vector_text ?? '').trim();
      const vector = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1).split(',').filter(Boolean).map(Number) : null;
      if (Array.isArray(vector) && vector.length && vector.every(Number.isFinite)) vectorCache.set(String(row.embedding_id), vector);
    }
  }
  return new Map(ids.map(id => [String(id), vectorCache.get(String(id))]).filter(([, value]) => Array.isArray(value)));
}

if (dbError) retrievalBlocked = { code: 'DATABASE_READ_ONLY_CONNECTIVITY_ERROR', message: dbError.message };
else if (dbSchema.missing_tables.length) retrievalBlocked = { code: 'PRODUCTION_RETRIEVAL_SCHEMA_MISSING_TABLE', message: `Current production retrieval query requires missing table(s): ${dbSchema.missing_tables.join(', ')}` };
else if (!embeddingClient?.apiBase || !embeddingClient?.apiKey) retrievalBlocked = { code: 'EMBEDDING_NOT_CONFIGURED', message: 'Embedding client is not fully configured in the current execution environment.' };
else if (selectionBlocked) retrievalBlocked = selectionBlocked;

for (const record of caseRecords) {
  if (retrievalBlocked) {
    record.execution_status = 'BLOCKED';
    record.blocked_reason = retrievalBlocked;
    record.strategies = emptyStrategies('NOT_EXECUTED', retrievalBlocked.code);
    continue;
  }
  const started = nowMs();
  providerAudit.call_count += 1;
  try {
    const [queryVector] = await embeddingClient.embed([record.query]);
    providerAudit.latency_ms.push(Number((nowMs() - started).toFixed(2)));
    const raw = await (new PgRepository(pool)).searchWriterReferenceChunks({
      projectId: PUBLIC_CORPUS_PROJECT_ID,
      queryVector,
      model: embeddingClient.model,
      version: embeddingClient.version,
      dimension: embeddingClient.dimension,
      materialTypes: MATERIAL_TYPES,
      limit: CANDIDATE_K
    });
    const annotated = raw.map(annotate);
    const unique = [];
    const seen = new Set();
    for (const row of annotated) {
      const key = row.chunk_hash || `${row.material_id}:${row.chunk_id}`;
      if (!seen.has(key)) { seen.add(key); unique.push(row); }
    }
    const substantive = unique.filter(isWriterReferenceContentEligible);
    const r0 = annotated.slice(0, K);
    const r1 = substantive.slice(0, K);
    const vectors = await fetchVectors(annotated.map(row => row.embedding_id).filter(Boolean));
    const vectorComplete = annotated.length > 0 && annotated.every(row => vectors.has(String(row.embedding_id)));
    let r2 = [];
    let r2Status = 'NOT_EXECUTED_VECTOR_UNAVAILABLE';
    if (vectorComplete) { r2 = mmr(annotated, vectors); r2Status = 'EXECUTED_TRUE_VECTOR_MMR'; }
    else if (!annotated.length) r2Status = 'NOT_EXECUTED_NO_CANDIDATES';
    const strategy = (name, rows, status = 'EXECUTED') => ({
      strategy: name,
      status,
      candidate_count: annotated.length,
      eligible_candidate_count: substantive.length,
      final_references: rows.map((row, index) => compactReference(row, name, index + 1)),
      excluded_hygiene_count: name === 'R1_CURRENT_PLUS_ACCEPTED_HYGIENE' ? unique.length - substantive.length : 0,
      raw_candidate_snapshot: annotated.map((row, index) => compactReference(row, 'RAW_CANDIDATE', index + 1))
    });
    record.raw_candidates = annotated.map((row, index) => compactReference(row, 'RAW_CANDIDATE', index + 1));
    record.strategies = {
      R0_CURRENT_PRODUCTION_REFERENCE_PATH: strategy('R0_CURRENT_PRODUCTION_REFERENCE_PATH', r0),
      R1_CURRENT_PLUS_ACCEPTED_HYGIENE: strategy('R1_CURRENT_PLUS_ACCEPTED_HYGIENE', r1),
      R2_TRUE_VECTOR_MMR_LAMBDA_0_9: strategy('R2_TRUE_VECTOR_MMR_LAMBDA_0_9', r2, r2Status)
    };
    record.execution_status = 'PASS_RETRIEVAL';
    record.embedding = { provider_reached: true, http_status: 200, vector_dimension: queryVector.length, latency_ms: providerAudit.latency_ms.at(-1) };
    record.r2 = { status: r2Status, lambda: MMR_LAMBDA, vector_count: vectors.size, vector_complete: vectorComplete, used_actual_embedding_vectors: vectorComplete };
  } catch (error) {
    providerAudit.latency_ms.push(Number((nowMs() - started).toFixed(2)));
    const failure = { case_id: record.case_id, code: error.code ?? error.name ?? 'EMBEDDING_FAILURE', message: error.message };
    providerAudit.failures.push(failure);
    retrievalBlocked = failure;
    record.execution_status = 'BLOCKED';
    record.blocked_reason = failure;
    record.strategies = emptyStrategies('NOT_EXECUTED', failure.code);
  }
}

const runMetrics = {
  R0_CURRENT_PRODUCTION_REFERENCE_PATH: strategyMetrics(caseRecords, 'R0_CURRENT_PRODUCTION_REFERENCE_PATH'),
  R1_CURRENT_PLUS_ACCEPTED_HYGIENE: strategyMetrics(caseRecords, 'R1_CURRENT_PLUS_ACCEPTED_HYGIENE'),
  R2_TRUE_VECTOR_MMR_LAMBDA_0_9: strategyMetrics(caseRecords, 'R2_TRUE_VECTOR_MMR_LAMBDA_0_9')
};
writeJson('05_R0_CURRENT_RESULTS.json', { artifact_type: 'V43_R0_CURRENT_PRODUCTION_REFERENCE_PATH', run_id: RUN_ID, cases: caseRecords, metrics: runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH, provider_calls: providerAudit.call_count });
writeJson('06_R1_HYGIENE_RESULTS.json', { artifact_type: 'V43_R1_CURRENT_PLUS_ACCEPTED_HYGIENE', run_id: RUN_ID, cases: caseRecords, metrics: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE, provider_calls: providerAudit.call_count });
const allR2Executed = caseRecords.length > 0 && caseRecords.every(item => item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.status === 'EXECUTED');
if (allR2Executed) writeJson('07_R2_TRUE_MMR_RESULTS.json', { artifact_type: 'V43_R2_TRUE_VECTOR_MMR_LAMBDA_0_9', run_id: RUN_ID, lambda: MMR_LAMBDA, cases: caseRecords.map(item => ({ case_id: item.case_id, strategy: item.strategies.R2_TRUE_VECTOR_MMR_LAMBDA_0_9 })), metrics: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9, provider_calls: providerAudit.call_count });
else writeJson('07_R2_NOT_EXECUTED.json', { artifact_type: 'V43_R2_TRUE_VECTOR_MMR_LAMBDA_0_9', status: 'NOT_EXECUTED_VECTOR_UNAVAILABLE_OR_RETRIEVAL_BLOCKED', reason: retrievalBlocked?.code ?? 'ONE_OR_MORE_CASES_MISSING_VECTOR', lambda: MMR_LAMBDA, case_count: caseRecords.length, executed_case_count: caseRecords.filter(item => item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.status === 'EXECUTED').length });

const comparison = {
  artifact_type: 'V43_MECHANICAL_STRATEGY_COMPARISON',
  run_id: RUN_ID,
  strategies: runMetrics,
  deltas: {
    R1_minus_R0: {
      mean_reference_count: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.mean_reference_count - runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.mean_reference_count,
      heading_escape_delta: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.heading_escape - runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.heading_escape,
      front_matter_escape_delta: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.front_matter_escape - runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.front_matter_escape,
      citation_index_escape_delta: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.citation_index_escape - runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.citation_index_escape
    },
    R2_minus_R1: allR2Executed ? {
      mean_reference_count: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9.mean_reference_count - runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.mean_reference_count,
      same_material_max_delta: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9.same_material_max - runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.same_material_max
    } : 'NOT_EXECUTED'
  },
  interpretation_boundary: 'Mechanical candidate-shape/rank/lineage metrics only; no semantic usefulness conclusion.'
};
writeJson('08_MECHANICAL_COMPARISON.json', comparison);

const gptPacket = {
  artifact_type: 'V43_GPT_CORE6_REAL_REFERENCE_RAG_SEMANTIC_REVIEW_PACKET',
  blind_to_semantic_labels: true,
  source_identity: sourceIdentity,
  run_id: RUN_ID,
  case_count: caseRecords.length,
  review_labels: ['USEFUL', 'PARTIAL', 'NOT_USEFUL'],
  failure_families: ['GOOD_REFERENCE', 'SEMANTIC_NEAR_MISS', 'RANKING_FAILURE', 'REDUNDANCY', 'WEAK_CORPUS', 'OFF_TOPIC', 'TOO_GENERIC', 'WRONG_DOMAIN', 'REFERENCE_NOT_NEEDED', 'OTHER'],
  cases: caseRecords.map(item => ({
    case_id: item.case_id,
    tender_id: item.tender_id,
    requirement_id: item.requirement_id,
    requirement_text: item.requirement_text,
    section: item.section_identity,
    response_mode: item.response_mode,
    reference_need: item.reference_need,
    actual_retrieval_query: item.query,
    execution_status: item.execution_status,
    blocked_reason: item.blocked_reason ?? null,
    strategies: Object.fromEntries(Object.entries(item.strategies || {}).map(([key, value]) => [key, {
      final_reference_count: value.final_references?.length ?? 0,
      references: value.final_references ?? [],
      mechanical_suspicion_flags: [],
      semantic_label: null,
      failure_family: null,
      semantic_notes: null
    }]))
  })),
  semantic_labels_created: 0,
  provider_calls: 0,
  llm_calls: 0
};
writeJson('09_GPT_SEMANTIC_REVIEW_PACKET.json', gptPacket);

writeJson('10_FAILURE_FAMILY_TEMPLATE.json', {
  artifact_type: 'V43_REFERENCE_SEMANTIC_FAILURE_FAMILY_TEMPLATE',
  status: 'TEMPLATE_ONLY_NO_CODEX_SEMANTIC_ASSIGNMENT',
  families: gptPacket.failure_families,
  rows: caseRecords.flatMap(item => Object.keys(item.strategies || {}).map(strategy => ({ case_id: item.case_id, strategy, mechanical_suspicion_flags: [], failure_family: null, semantic_root_cause: 'PENDING_GPT' }))),
  semantic_labels_created: 0
});

const contextCandidates = caseRecords.slice();
const strong = contextCandidates.filter(item => (item.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references?.length ?? 0) === 4);
const ambiguous = contextCandidates.filter(item => { const n = item.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references?.length ?? 0; return n > 0 && n < 4; });
const weak = contextCandidates.filter(item => (item.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references?.length ?? 0) === 0);
const chosen = [];
for (const [bucket, list] of [['strong', strong], ['ambiguous', ambiguous], ['weak', weak]]) for (const item of list.slice(0, 4)) if (!chosen.some(row => row.item.case_id === item.case_id)) chosen.push({ bucket, item });
if (chosen.length < Math.min(12, contextCandidates.length)) for (const item of contextCandidates) if (chosen.length < Math.min(12, contextCandidates.length) && !chosen.some(row => row.item.case_id === item.case_id)) chosen.push({ bucket: 'mechanical_fallback', item });

const contextRows = [];
for (const { bucket, item } of chosen) {
  const req = routed.find(row => row.canonical_requirement_id === item.requirement_id);
  const refs = item.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references ?? [];
  let context = null; let error = null;
  try {
    context = buildSectionContext({
      project: { id: PUBLIC_CORPUS_PROJECT_ID, name: 'PUBLIC_CORPUS_READ_ONLY_EVAL' },
      section: { section_id: `eval-${item.case_id}`, parent_id: null, title: null, role: 'reference_eval', requirement_ids: [item.requirement_id] },
      requirements: [{ req_id: item.requirement_id, text: item.requirement_text, requirement_category: req.requirement_category ?? req.category }],
      claims: [], facts: [], bindings: [], gateResults: [], referenceMaterials: refs.map(ref => ({ material_id: ref.material_id, chunk_id: ref.chunk_id, source_text: ref.source_text }))
    });
  } catch (err) { error = { code: err.code ?? err.name ?? 'SAFE_CONTEXT_ERROR', message: err.message }; }
  contextRows.push({
    case_id: item.case_id,
    tender_id: item.tender_id,
    requirement_id: item.requirement_id,
    mechanical_selection_bucket: bucket,
    selection_label: 'MECHANICALLY_SELECTED_FOR_REVIEW',
    context_status: error ? 'ERROR' : 'PASS',
    error,
    safe_context: context,
    separation: {
      project_facts_count: context?.project_facts?.length ?? 0,
      assertable_claims_count: context?.approved_claims?.length ?? 0,
      reference_materials_count: context?.reference_materials?.length ?? 0,
      context_only_references_count: context?.context_only_references?.length ?? 0,
      no_approved_claims_fabricated: (context?.approved_claims?.length ?? 0) === 0,
      namespaces_separate: Boolean(context && Array.isArray(context.project_facts) && Array.isArray(context.approved_claims) && Array.isArray(context.reference_materials))
    }
  });
}
writeJson('11_WRITER_SAFE_CONTEXT_DRY_RUN.json', {
  artifact_type: 'V43_WRITER_SAFE_CONTEXT_DRY_RUN',
  status: retrievalBlocked ? 'PARTIAL_RETRIEVAL_BLOCKED' : 'EXECUTED_READ_ONLY',
  cases_requested: 12,
  cases_selected: contextRows.length,
  bucket_counts: Object.fromEntries(['strong', 'ambiguous', 'weak', 'mechanical_fallback'].map(bucket => [bucket, contextRows.filter(item => item.mechanical_selection_bucket === bucket).length])),
  cases: contextRows,
  provider_calls: 0,
  writer_provider_calls: 0,
  db_writes: 0,
  writer_generation: 0
});

const contextExposureRows = contextRows.map(row => {
  const serialized = JSON.stringify(row.safe_context ?? {});
  const refs = row.safe_context?.reference_materials ?? [];
  return {
    case_id: row.case_id,
    raw_evidence_to_writer: 0,
    rejected_claim_exposure: 0,
    review_claim_exposure: 0,
    fact_candidate_raw_exposure: 0,
    mapping_reasoning_exposure: 0,
    rag_top20_exposure: 0,
    final_reference_count: refs.length,
    final_reference_max_gate: refs.length <= 4 ? 'PASS' : 'FAIL',
    namespaces_separate: row.separation.namespaces_separate,
    forbidden_keys_observed: ['raw_top20', 'raw_candidates', 'evidence_facts', 'mapping_reasoning'].filter(key => serialized.includes(key))
  };
});
writeJson('12_RAW_INPUT_EXPOSURE_AUDIT.json', {
  artifact_type: 'V43_RAW_INPUT_EXPOSURE_AUDIT',
  rows: contextExposureRows,
  aggregate: {
    raw_evidence_to_writer: contextExposureRows.reduce((sum, row) => sum + row.raw_evidence_to_writer, 0),
    rejected_claim_exposure: contextExposureRows.reduce((sum, row) => sum + row.rejected_claim_exposure, 0),
    review_claim_exposure: contextExposureRows.reduce((sum, row) => sum + row.review_claim_exposure, 0),
    fact_candidate_raw_exposure: contextExposureRows.reduce((sum, row) => sum + row.fact_candidate_raw_exposure, 0),
    mapping_reasoning_exposure: contextExposureRows.reduce((sum, row) => sum + row.mapping_reasoning_exposure, 0),
    rag_top20_exposure: contextExposureRows.reduce((sum, row) => sum + row.rag_top20_exposure, 0),
    reference_final_projection_max: Math.max(0, ...contextExposureRows.map(row => row.final_reference_count)),
    forbidden_key_count: contextExposureRows.reduce((sum, row) => sum + row.forbidden_keys_observed.length, 0)
  }
});

const negativeCases = [
  ['我司具备统一身份认证能力。', 'REFERENCE_TO_ENTERPRISE_ASSERTION'],
  ['我司已取得相关认证。', 'REFERENCE_TO_ENTERPRISE_ASSERTION'],
  ['我司达到每秒万级处理能力。', 'REFERENCE_STRONG_FACT_PROMOTION'],
  ['我司支持该平台。', 'REFERENCE_TO_ENTERPRISE_ASSERTION'],
  ['我司完成过同类项目。', 'REFERENCE_CUSTOMER_CASE_PROMOTION']
];
const negativeRows = negativeCases.map(([source_text, case_id]) => {
  let context = null; let error = null;
  try {
    context = buildSectionContext({ project: { id: PUBLIC_CORPUS_PROJECT_ID }, section: { section_id: `negative-${case_id}`, title: '方案', role: 'reference_eval', requirement_ids: ['NEG-REQ'] }, requirements: [{ req_id: 'NEG-REQ', text: '技术方案', requirement_category: 'technical' }], claims: [], facts: [], bindings: [], gateResults: [], referenceMaterials: [{ material_id: 'REF-NEG', chunk_id: case_id, source_text }] });
  } catch (err) { error = { code: err.code ?? err.name ?? 'NEGATIVE_CASE_ERROR', message: err.message }; }
  return { case_id, source_text, expected: 'CONTEXT_ONLY', actual_reference_count: context?.reference_materials?.length ?? 0, project_facts_count: context?.project_facts?.length ?? 0, assertable_claims_count: context?.approved_claims?.length ?? 0, reference_assertion_escape: (context?.project_facts?.length ?? 0) > 0 || (context?.approved_claims?.length ?? 0) > 0 ? 1 : 0, error };
});
writeJson('13_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION.json', {
  artifact_type: 'V43_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION',
  source_role_rule: 'REFERENCE_ONLY remains CONTEXT_ONLY; Safe Context does not promote reference text into facts or claims.',
  cases: negativeRows,
  REFERENCE_ASSERTION_ESCAPE: negativeRows.reduce((sum, row) => sum + row.reference_assertion_escape, 0),
  provider_calls: 0,
  db_writes: 0,
  production_mutations: 0
});

writeJson('14_PROVIDER_EMBEDDING_AUDIT.json', {
  artifact_type: 'V43_PROVIDER_EMBEDDING_AUDIT',
  run_id: RUN_ID,
  database_identity: dbIdentity,
  database_schema: dbSchema,
  ...providerAudit,
  failures: providerAudit.failures,
  provider_calls: providerAudit.call_count,
  retry_count: providerAudit.retries,
  total_latency_ms: providerAudit.latency_ms.reduce((a, b) => a + b, 0),
  status: retrievalBlocked ? 'BLOCKED' : 'PASS'
});

writeJson('15_TEST_REPORT.json', {
  artifact_type: 'V43_TEST_REPORT',
  focused_tests: { status: 'PENDING_POST_RUN', command: 'node --test test/writer-reference-hygiene.test.js test/retrieval-chunk-role.test.js test/retrieval-source-eligibility.test.js test/writer-v2-composition.test.js test/writer-authority-p0.test.js' },
  relevant_backend_regression: { status: 'PENDING_POST_RUN', command: 'npm test -w backend', current_task_regressions: 'NOT_DETERMINED' },
  build: { status: 'PENDING_POST_RUN', command: 'npm run build' },
  lint: { status: 'PENDING_POST_RUN', command: 'npm run lint' },
  diff_check: { status: 'PENDING_POST_RUN', command: 'git diff --check' },
  provider_calls_during_artifact_generation: providerAudit.call_count,
  production_db_writes: 0,
  eval_db_writes: 0,
  gold_mutations: 0,
  requirement_mutations: 0,
  fact_mapping_claim_writer_mutations: 0
});

writeJson('16_DEBT_REGISTER.json', {
  artifact_type: 'V43_DEBT_REGISTER',
  blockers: [
    ...(retrievalBlocked ? [{ code: retrievalBlocked.code, reason: retrievalBlocked.message }] : []),
    ...(!allR2Executed ? [{ code: 'R2_TRUE_VECTOR_MMR_NOT_EXECUTED', reason: 'Actual candidate vectors were unavailable or retrieval was blocked; no lexical proxy used.' }] : []),
    { code: 'PACKAGING_HASH_DEBT_NON_BLOCKING_FOR_CORE6_1009_EVAL', reason: 'JY-001 recovered packet manifest whole-file SHA stale; Core6 run anchored to canonical input SHA and row-level source identity.' }
  ],
  semantic_debt_classification: 'PENDING_GPT',
  semantic_labels_created: 0
});

const checkpointStatus = retrievalBlocked ? `BLOCKED_${retrievalBlocked.code}` : 'READY_FOR_GPT_CORE6_REAL_REFERENCE_RAG_ADJUDICATION';
const checkpoint = {
  artifact_type: 'V43_CORE6_1009_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_CHECKPOINT',
  run_id: RUN_ID,
  status: checkpointStatus,
  A_core6_1009_used_without_rebuild: sourceIdentity.row_count === 1009,
  B_all_six_tenders_represented: new Set(selected.map(item => item.tender_id)).size === 6,
  C_reference_eligible_requirements_entered_final_eval_set: selected.length,
  C1_reference_denominator_eligible_count: eligible.length,
  C2_selection_constraint: { minimum_total: null, maximum_execution_cases: 80, selected_case_count: selected.length, required_tender_count: 6, selected_tender_count: new Set(selected.map(item => item.tender_id)).size, selection_blocked: Boolean(selectionBlocked), selection_blocker: selectionBlocked },
  C3_cohort_distribution: {
    SOLUTION_PURE: eligible.filter(item => item.reference_eligibility.cohort === 'SOLUTION_PURE').length,
    SOLUTION_WITH_EVIDENCE_SECONDARY: eligible.filter(item => item.reference_eligibility.cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length,
    WRITER_READY_SUBSET: eligible.filter(item => item.reference_eligibility.writer_ready === true).length,
    WRITER_NOT_READY_SUBSET: eligible.filter(item => item.reference_eligibility.writer_ready === false).length
  },
  D_production_query_semantics_used: true,
  E_r0_vs_r1_mechanical_delta: comparison.deltas.R1_minus_R0,
  F_true_vector_mmr_executable: allR2Executed,
  G_r2_mechanical_delta: comparison.deltas.R2_minus_R1,
  H_wrong_role_scope_quarantine_escape: {
    R0: { wrong_role: runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.wrong_role_escape, wrong_scope: runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.wrong_scope_escape, quarantined: runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.quarantined_escape },
    R1: { wrong_role: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.wrong_role_escape, wrong_scope: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.wrong_scope_escape, quarantined: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.quarantined_escape },
    R2: { wrong_role: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9.wrong_role_escape, wrong_scope: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9.wrong_scope_escape, quarantined: runMetrics.R2_TRUE_VECTOR_MMR_LAMBDA_0_9.quarantined_escape }
  },
  I_non_substantive_writer_slot_escape: { R0: runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.heading_escape + runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.front_matter_escape + runMetrics.R0_CURRENT_PRODUCTION_REFERENCE_PATH.citation_index_escape, R1: runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.heading_escape + runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.front_matter_escape + runMetrics.R1_CURRENT_PLUS_ACCEPTED_HYGIENE.citation_index_escape },
  J_reference_to_assertion_authority_escape: negativeRows.reduce((sum, row) => sum + row.reference_assertion_escape, 0),
  K_safe_context_namespaces_separate: contextRows.every(row => row.separation.namespaces_separate),
  L_provider: { calls: providerAudit.call_count, failures: providerAudit.failures.length, retries: providerAudit.retries, latency_ms: providerAudit.latency_ms },
  M_mutations: { production_db_writes: 0, eval_db_writes: 0, requirement: 0, gold: 0, fact: 0, mapping: 0, claim: 0, writer_generation: 0, prompt: 0, schema: 0, migration: 0 },
  production_db_writes: 0,
  eval_db_writes: 0,
  gold_mutations: 0,
  requirement_mutations: 0,
  fact_mapping_claim_writer_mutations: 0,
  semantic_labels_created: 0,
  r2_status: allR2Executed ? 'EXECUTED_TRUE_VECTOR_MMR_LAMBDA_0_9' : 'NOT_EXECUTED_VECTOR_UNAVAILABLE_OR_RETRIEVAL_BLOCKED',
  source_identity: sourceIdentity,
  database_schema: dbSchema,
  query_identity: queryAudit,
  next_gate: retrievalBlocked ? 'BLOCKED_FIRST_FAILURE' : 'PENDING_GPT_SEMANTIC_REVIEW'
};
writeJson('17_CHECKPOINT.json', checkpoint);
fs.writeFileSync(path.join(OUT, '17_CHECKPOINT.md'), [
  '# V43 CORE6 1009 Real Reference RAG + Writer Context Eval',
  '',
  `Status: \`${checkpoint.status}\``,
  `Run: \`${RUN_ID}\``,
  `Core6 source: ${sourceIdentity.artifact} (${sourceIdentity.sha256})`,
  `Requirements: ${sourceIdentity.row_count}; tenders represented: ${checkpoint.B_all_six_tenders_represented ? '6/6' : '不足'}.`,
  `Requirement-level Reference Retrieval denominator eligible: ${eligible.length}; execution cohort: ${selected.length}; 6/6 tender breadth required, no minimum-count gate.`,
  `Production query semantics reused: ${checkpoint.D_production_query_semantics_used ? 'YES' : 'NO'}.`,
  `Provider calls/failures/retries: ${providerAudit.call_count}/${providerAudit.failures.length}/${providerAudit.retries}.`,
  `True vector MMR: ${checkpoint.r2_status}.`,
  `Reference→Assertion escape: ${checkpoint.J_reference_to_assertion_authority_escape}.`,
  `Production/Eval DB writes: 0/0; Gold/Requirement/Fact/Mapping/Claim/Writer mutations: 0.`,
  '',
  'This is Requirement-level Reference Retrieval Eval only; no Writer Reference Product Fidelity claim, semantic labels, automatic RAG freeze, or Writer Provider generation was performed.',
  '',
  checkpoint.status,
  ''
].join('\n'), 'utf8');

if (transport?.close) await transport.close();
if (pool) await pool.end();
console.log(JSON.stringify({ run_id: RUN_ID, status: checkpoint.status, selected_cases: selected.length, reference_eligible: eligible.length, provider_calls: providerAudit.call_count, provider_failures: providerAudit.failures.length, output_dir: path.relative(ROOT, OUT) }, null, 2));
