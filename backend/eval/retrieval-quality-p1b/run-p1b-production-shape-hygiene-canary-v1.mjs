import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadFrozenChengchuanEvidenceSources } from '../real-e2e/chengchuan-evidence-source-loader.mjs';
import { partitionRetrievalCandidates } from '../../src/pipeline/retrieval-chunk-role.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../');
const GOLD_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const SUPPLEMENT_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/results/V43_RAG_RETRIEVAL_P0_HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1.json');
const P0_CHECKPOINT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_AND_K0_V2/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.json');
const P1A_REPLAY_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p1/results/V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_REPLAY_V1.json');
const P1A_PROJECTION_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p1/results/V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_PROJECTION_V1.json');
const OUTPUT_DIR = path.join(HERE, 'results');
const OVERLAY_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1B_DEVELOPMENT_VALIDATION_LABEL_OVERLAY_V1.json');
const QUERY_BATCH_FREEZE_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_QUERY_BATCH_FREEZE_V1.json');
const REPLAY_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_REPLAY_V1.json');
const CHECKPOINT_DIR = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_V1');
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1.json');
const CHECKPOINT_MD_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1.md');

const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const SNAPSHOT_SHA256 = '5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578';
const GOLD_SHA256 = '7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7';
const SNAPSHOT_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const PROVIDER_HOST = 'api.siliconflow.cn';
const DIMENSION = 1024;
const RAW_CANDIDATE_K = 20;
const FINAL_K = 8;
const FINAL_METRIC_K_VALUES = Object.freeze([1, 3, 5, 8]);
const RAW_POOL_K_VALUES = Object.freeze([1, 3, 5, 8, 20]);
const ALL_K_VALUES = Object.freeze([1, 3, 5, 8, 20]);
const DEVELOPMENT_VALIDATION_CASE_COUNT = 7;
const P1B_EXPERIMENT_ID = 'V43-RAG-RETRIEVAL-P1B-PRODUCTION-SHAPE-HYGIENE-CANARY-20260917';
const P1A_RULE_VERSION = 'P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC';
const ACCEPTED_P1A_RULE_HASH = '8320c40c28fa5052f6ea9abe3843a2544b6c929a955a252b97ee56b5180a79c2';
const GOLD_PROJECTION_VERSION = 'GPT_SEMANTIC_GOLD_V1_EXACT_SPAN_PROJECTION_V1';
const MATCHER_VERSION = 'EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE';
const MATCHER_HASH = 'ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2';
const FORMER_HOLDOUT_CASE_IDS = Object.freeze([
  'RAG-P0-HOLD-JY-001-REQ-027',
  'RAG-P0-HOLD-JY-001-REQ-077',
  'RAG-P0-HOLD-JY-001-REQ-051',
  'RAG-P0-HOLD-TB-003-REQ-119',
  'RAG-P0-HOLD-TB-003-REQ-170',
  'RAG-P0-HOLD-TB-006-REQ-037',
  'RAG-P0-HOLD-JY-001-REQ-148'
]);
const SPECIAL_REQUIREMENT_IDS = Object.freeze(['FAST-01:REQ-005', 'TB-003:REQ-119', 'JY-001:REQ-027', 'TB-003:REQ-170']);

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256Text = value => sha256(Buffer.from(String(value), 'utf8'));
const sha256File = file => sha256(fs.readFileSync(file));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const relative = file => path.relative(REPO_ROOT, file).replaceAll('\\', '/');
const num = value => Number(Number(value).toFixed(12));
const mean = values => values.length ? num(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });
function assert(condition, code, details = {}) { if (!condition) throw fail(code, details); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, json(value), 'utf8'); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
function deterministicContentHash(value, excludedKeys = []) {
  const clone = JSON.parse(JSON.stringify(value));
  for (const key of excludedKeys) delete clone[key];
  return sha256Text(JSON.stringify(canonicalize(clone)));
}

const P1A_RULE_SPEC = Object.freeze({
  exclusion_order: Object.freeze(['EMPTY_OR_WHITESPACE', 'HEADING_ONLY', 'URL_ONLY', 'CITATION_ONLY']),
  rules: Object.freeze({
    EMPTY_OR_WHITESPACE: 'trimmed source_text has length 0',
    HEADING_ONLY: 'every non-empty line is a Markdown heading, an empty list bullet, or a horizontal rule',
    URL_ONLY: 'every non-empty line is a standalone http(s), ftp, or www URL',
    CITATION_ONLY: 'every non-empty line is a standalone DOI, ISBN, ISSN, or PMID token'
  }),
  no_rechunking: true,
  no_parent_child_change: true,
  no_embedding_change: true,
  no_source_span_change: true
});

const MATCHER_CONTRACT = Object.freeze({
  candidate_unit: 'snapshot material_id + chunk_id + chunk_hash',
  accepted_match: 'candidate chunk identity equals a frozen Gold evidence item accepted span_ref chunk identity',
  alternative_match: 'any frozen Gold evidence item span_ref listed for the atom is acceptable; no semantic expansion is permitted',
  relevance_source: 'frozen Gold evidence item grade only',
  precision_relevant_grade: 'grade >= 2',
  ndcg_grades: [3, 2, 1, 0],
  atom_recall_source: 'frozen Gold evidence atom acceptable_span_refs only',
  post_hoc_rules: false
});

function sourceKey(row) { return `${row.material_id}|${row.chunk_id ?? row.source_chunk_id}|${row.chunk_hash ?? row.source_chunk_hash}`; }
function assertVector(vector, label) { assert(Array.isArray(vector) && vector.length === DIMENSION && vector.every(Number.isFinite), 'VECTOR_INVALID', { label, observed: Array.isArray(vector) ? vector.length : null }); }
function cosine(left, right) {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftNorm += left[index] * left[index]; rightNorm += right[index] * right[index]; }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}
function isHeadingOnly(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return !lines.length || lines.every(line => /^#{1,6}\s+\S.*$/u.test(line) || /^[-*•]\s*$/.test(line) || /^-{3,}$/.test(line));
}
function isUrlOnly(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^(?:(?:https?|ftp):\/\/|www\.)\S+$/iu.test(line));
}
function isCitationOnly(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^(?:doi:\s*\S+|isbn[:：]?\s*\S+|issn[:：]?\s*\S+|pmid[:：]?\s*\S+)$/iu.test(line));
}
function evaluateP1AHygiene(sourceText) {
  const text = String(sourceText || '');
  const reasons = [];
  if (text.trim().length === 0) reasons.push('EMPTY_OR_WHITESPACE');
  if (isHeadingOnly(text)) reasons.push('HEADING_ONLY');
  if (isUrlOnly(text)) reasons.push('URL_ONLY');
  if (isCitationOnly(text)) reasons.push('CITATION_ONLY');
  return { excluded: reasons.length > 0, reasons };
}
function p1aRuleHash() { return deterministicContentHash({ version: P1A_RULE_VERSION, spec: P1A_RULE_SPEC }); }

function gradeFor(candidate, caseGold, gold) {
  return (caseGold.evidence_items || []).filter(item => {
    const span = gold.source_spans[item.span_ref];
    return span && span.material_id === candidate.material_id && span.chunk_id === candidate.source_chunk_id && span.chunk_hash === candidate.source_chunk_hash;
  }).reduce((max, item) => Math.max(max, Number(item.grade)), 0);
}
function goldRefsFor(candidate, caseGold, gold) {
  return (caseGold.evidence_items || []).filter(item => {
    const span = gold.source_spans[item.span_ref];
    return span && span.material_id === candidate.material_id && span.chunk_id === candidate.source_chunk_id && span.chunk_hash === candidate.source_chunk_hash;
  }).map(item => item.span_ref);
}

function sourceIndex(sources) {
  return new Map(sources.flatMap(source => source.chunks.map(chunk => [sourceKey({ material_id: source.material_id, chunk_id: chunk.chunk_id, chunk_hash: chunk.chunk_hash }), {
    ...chunk,
    material_id: source.material_id,
    doc_id: source.doc_id,
    original_name: source.original_name,
    source_file: source.source_file,
    material_type: source.material_type,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    enterprise_id: source.enterprise_id
  }])));
}

function buildQueries(gold, snapshot, supplement) {
  const inSnapshot = new Map((snapshot.query_vectors || []).map(row => [row.requirement_id, row]));
  const inSupplement = new Map((supplement.query_vectors || []).map(row => [row.requirement_id, row]));
  const queries = gold.cases.map((item, index) => {
    const vectorRow = inSnapshot.get(item.requirement_id) || inSupplement.get(item.requirement_id);
    assert(vectorRow, 'QUERY_VECTOR_MISSING', { requirement_id: item.requirement_id });
    assert(vectorRow.query_hash === item.query_hash, 'QUERY_HASH_DRIFT', { requirement_id: item.requirement_id });
    assertVector(vectorRow.vector, item.requirement_id);
    if (vectorRow.vector_hash) assert(sha256Text(JSON.stringify(vectorRow.vector)) === vectorRow.vector_hash, 'QUERY_VECTOR_HASH_DRIFT', { requirement_id: item.requirement_id });
    return { ordinal: index + 1, case_id: item.case_id, requirement_id: item.requirement_id, query_text: item.query_text, query_hash: item.query_hash, vector: vectorRow.vector, vector_source: inSnapshot.has(item.requirement_id) ? 'FROZEN_BASELINE_SNAPSHOT' : 'FROZEN_P0_HOLDOUT_SUPPLEMENT' };
  });
  return queries;
}

function validateFrozenInputs({ gold, snapshot, sources, p0Checkpoint, p1aReplay, p1aProjection }) {
  assert(sha256File(GOLD_PATH).toUpperCase() === GOLD_SHA256, 'GOLD_SHA_DRIFT');
  assert(sha256File(SNAPSHOT_PATH).toUpperCase() === SNAPSHOT_SHA256, 'SNAPSHOT_SHA_DRIFT');
  assert(snapshot.manifest?.snapshot_id === SNAPSHOT_ID, 'SNAPSHOT_ID_DRIFT');
  assert(snapshot.manifest?.identity_hash === SNAPSHOT_IDENTITY_HASH, 'SNAPSHOT_IDENTITY_HASH_DRIFT');
  assert(snapshot.manifest?.material_count === 9 && snapshot.manifest?.chunk_count === 94, 'SNAPSHOT_SHAPE_DRIFT');
  assert(snapshot.manifest?.embedding_model === MODEL && snapshot.manifest?.embedding_provider === PROVIDER_HOST, 'SNAPSHOT_EMBEDDING_IDENTITY_DRIFT');
  assert(Number(snapshot.manifest?.vector_dimension) === DIMENSION && snapshot.vectors?.length === 94, 'SNAPSHOT_VECTOR_COUNT_OR_DIMENSION_DRIFT');
  assert(gold.cases?.length === 10, 'GOLD_CASE_COUNT_DRIFT');
  assert(gold.authority === 'DEVELOPMENT_EVAL_ONLY' && gold.status === 'FROZEN_DEVELOPMENT_EVAL', 'GOLD_AUTHORITY_OR_STATUS_DRIFT');
  assert(sha256Text(JSON.stringify(MATCHER_CONTRACT)) !== '', 'MATCHER_CONTRACT_INVALID');
  assert(p0Checkpoint.evidence_matcher?.version === MATCHER_VERSION && p0Checkpoint.evidence_matcher?.hash === MATCHER_HASH, 'MATCHER_DRIFT');
  assert(p1aReplay.artifact_type === 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_REPLAY_V1', 'P1A_REPLAY_MISSING');
  assert(p1aProjection.rule_version === P1A_RULE_VERSION && p1aProjection.rule_hash === ACCEPTED_P1A_RULE_HASH, 'P1A_PROJECTION_RULE_DRIFT');
  assert(p1aProjection.excluded_chunk_count === 47 && p1aProjection.kept_chunk_count === 47, 'P1A_PROJECTION_COUNT_DRIFT');
  const sourcesRows = sources.flatMap(source => source.chunks.map(chunk => ({ ...chunk, material_id: source.material_id, doc_id: source.doc_id, source_file: source.source_file, source_role: source.source_role, authority: source.authority, production_authority: source.production_authority, enterprise_id: source.enterprise_id, material_type: source.material_type })));
  assert(sourcesRows.length === 94, 'SOURCE_CORPUS_COUNT_DRIFT');
  assert(sha256Text(JSON.stringify(sourcesRows.map(row => ({ material_id: row.material_id, chunk_id: row.chunk_id, chunk_hash: row.chunk_hash })))) === SNAPSHOT_IDENTITY_HASH, 'SOURCE_IDENTITY_HASH_DRIFT');
  const sourceKeys = new Set(sourcesRows.map(sourceKey));
  for (const row of snapshot.vectors) {
    assert(sourceKeys.has(sourceKey(row)), 'SNAPSHOT_SOURCE_LINEAGE_MISSING', { chunk_id: row.chunk_id });
    assert(row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID && row.authority === 'SYNTHETIC_EVAL_ONLY' && row.production_authority === 'NONE', 'SNAPSHOT_SCOPE_ESCAPE', { chunk_id: row.chunk_id });
    assertVector(row.vector, row.chunk_id);
  }
  return sourcesRows;
}

function denseRank(snapshot, sourceByKey, query, caseGold, gold) {
  return snapshot.vectors.map(row => {
    const source = sourceByKey.get(sourceKey(row));
    assert(source, 'DENSE_SOURCE_MISSING', { chunk_id: row.chunk_id });
    const candidate = {
      candidate_id: row.chunk_id,
      chunk_id: row.chunk_id,
      material_id: row.material_id,
      doc_id: source.doc_id,
      original_name: source.original_name,
      source_file: source.source_file,
      source_chunk_id: row.chunk_id,
      source_chunk_hash: row.chunk_hash,
      source_text: source.source_text,
      source_text_hash: sha256Text(source.source_text),
      source_span: `${row.chunk_id}:FULL`,
      char_start: source.char_start,
      char_end: source.char_end,
      page_start: source.page_start,
      page_end: source.page_end,
      paragraph_start: source.paragraph_start,
      paragraph_end: source.paragraph_end,
      source_role: source.source_role,
      authority: source.authority,
      production_authority: source.production_authority,
      enterprise_id: source.enterprise_id,
      material_type: source.material_type,
      score: num(cosine(query.vector, row.vector)),
      gold_grade: gradeFor({ material_id: row.material_id, source_chunk_id: row.chunk_id, source_chunk_hash: row.chunk_hash }, caseGold, gold),
      gold_span_refs: goldRefsFor({ material_id: row.material_id, source_chunk_id: row.chunk_id, source_chunk_hash: row.chunk_hash }, caseGold, gold)
    };
    return candidate;
  }).sort((left, right) => right.score - left.score || `${left.material_id}|${left.candidate_id}`.localeCompare(`${right.material_id}|${right.candidate_id}`))
    .map((row, index) => ({ ...row, dense_rank: index + 1 }));
}

function expectedProjection(caseGold) {
  return { expected_retrieval_k0: (caseGold.evidence_items || []).every(item => Number(item.grade) < 2), expected_no_sufficient_evidence: caseGold.has_sufficient_evidence !== true };
}

function currentProductionHygiene(rawPool, caseGold) {
  const partition = partitionRetrievalCandidates({ requirement: { text: caseGold.query_text }, candidates: rawPool });
  const eligibleIds = new Set(partition.eligible_candidates.map(item => item.source_chunk_id ?? item.chunk_id));
  return {
    current_contract: 'retrieval-chunk-role-v1 / partitionRetrievalCandidates',
    all: rawPool.map(item => ({ ...item, current_hygiene_eligible: eligibleIds.has(item.source_chunk_id), current_hygiene_reason: eligibleIds.has(item.source_chunk_id) ? null : 'CURRENT_PRODUCTION_HYGIENE' })),
    eligible: rawPool.filter(item => eligibleIds.has(item.source_chunk_id)),
    excluded: rawPool.filter(item => !eligibleIds.has(item.source_chunk_id)),
    contract_version: partition.hygiene_version
  };
}

function applyP1AHygiene(rows) {
  return rows.map(row => ({ ...row, p1a_hygiene: evaluateP1AHygiene(row.source_text) }));
}

function finalProjection(rows, { p1aEnabled }) {
  const afterP1A = p1aEnabled ? rows.filter(row => !row.p1a_hygiene.excluded) : rows;
  return afterP1A.slice(0, FINAL_K).map((row, index) => ({ ...row, rank: index + 1, final_rank: index + 1 }));
}

function metricAtK(caseGold, ranked, k, gold, expected, scope = 'FINAL_REVIEW') {
  const top = ranked.slice(0, k);
  const topKeys = new Set(top.map(row => `${row.material_id}|${row.source_chunk_id}|${row.source_chunk_hash}`));
  const atoms = (caseGold.evidence_atoms || []).filter(atom => (atom.acceptable_span_refs || []).length > 0);
  const coveredAtoms = atoms.filter(atom => (atom.acceptable_span_refs || []).some(ref => {
    const span = gold.source_spans[ref];
    return span && topKeys.has(`${span.material_id}|${span.chunk_id}|${span.chunk_hash}`);
  }));
  const relevantCount = top.filter(row => row.gold_grade >= 2).length;
  const idealGrades = (caseGold.evidence_items || []).map(item => Number(item.grade)).sort((a, b) => b - a).slice(0, k);
  const dcg = top.reduce((sum, row, index) => sum + ((2 ** row.gold_grade) - 1) / Math.log2(index + 2), 0);
  const idealDcg = idealGrades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const firstEvidence = ranked.find(row => row.gold_grade >= 2);
  return {
    scope,
    requested_k: k,
    returned_count: top.length,
    evidence_atom_recall: atoms.length ? num(coveredAtoms.length / atoms.length) : null,
    candidate_precision: num(relevantCount / k),
    ndcg: idealDcg ? num(dcg / idealDcg) : null,
    mrr_full: firstEvidence ? num(1 / firstEvidence.rank) : null,
    expected_retrieval_k0: expected.expected_retrieval_k0,
    expected_no_sufficient_evidence: expected.expected_no_sufficient_evidence,
    returned_k0: top.length === 0,
    false_positive_retrieval_candidate: expected.expected_retrieval_k0 && top.some(row => row.gold_grade >= 2),
    false_negative_retrieval_k0: !expected.expected_retrieval_k0 && top.length === 0
  };
}

function aggregate(cases, k, key = 'metrics') {
  const values = cases.map(item => item[key][String(k)]);
  const average = field => mean(values.map(item => item[field]).filter(value => value !== null));
  const expectedK0 = values.filter(item => item.expected_retrieval_k0);
  const expectedNonK0 = values.filter(item => !item.expected_retrieval_k0);
  return {
    case_count: values.length,
    evidence_atom_recall: average('evidence_atom_recall'),
    candidate_precision: average('candidate_precision'),
    ndcg: average('ndcg'),
    mrr_full: average('mrr_full'),
    mrr_full_denominator_cases: values.filter(item => item.mrr_full !== null).length,
    expected_retrieval_k0_count: expectedK0.length,
    expected_no_sufficient_evidence_count: values.filter(item => item.expected_no_sufficient_evidence).length,
    false_positive_retrieval_candidate_rate: expectedK0.length ? num(expectedK0.filter(item => item.false_positive_retrieval_candidate).length / expectedK0.length) : null,
    false_negative_retrieval_k0_rate: expectedNonK0.length ? num(expectedNonK0.filter(item => item.false_negative_retrieval_k0).length / expectedNonK0.length) : null,
    returned_k0_count: values.filter(item => item.returned_k0).length
  };
}
function aggregateAll(cases, key = 'metrics', kValues = FINAL_METRIC_K_VALUES) { return Object.fromEntries(kValues.map(k => [String(k), aggregate(cases, k, key)])); }
function slices(cases, key = 'metrics') {
  const values = [...new Set(cases.map(item => item.profile_class))].sort();
  return Object.fromEntries(values.map(profile => { const scoped = cases.filter(item => item.profile_class === profile); return [profile, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped, key) }]; }));
}
function splitSlices(cases, key = 'metrics') {
  const values = [...new Set(cases.map(item => item.governance_split))].sort();
  return Object.fromEntries(values.map(split => { const scoped = cases.filter(item => item.governance_split === split); return [split, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped, key) }]; }));
}
function failureFamily(item) {
  const first = item.final_candidates.find(row => row.gold_grade >= 2);
  if (item.expected.expected_retrieval_k0 && !first) return 'EXPECTED_K0_NO_GRADE_GE_2_EVIDENCE';
  if (first?.rank === 1) return 'GRADE_GE_2_EVIDENCE_AT_RANK_1';
  if (first) return 'LOW_RANK_GRADE_GE_2_EVIDENCE';
  if (item.final_candidates.some(row => row.gold_grade === 1)) return 'RETRIEVAL_RELEVANT_ONLY_NO_GRADE_GE_2';
  return 'RETRIEVAL_MISS_OR_RELEVANT_ONLY';
}
function failureFamilies(cases) { return cases.reduce((out, item) => { out[item.first_failure_family] = (out[item.first_failure_family] || 0) + 1; return out; }, {}); }
function metricDelta(left, right) {
  const delta = field => left[field] === null || right[field] === null ? null : num(left[field] - right[field]);
  return { evidence_atom_recall: delta('evidence_atom_recall'), candidate_precision: delta('candidate_precision'), ndcg: delta('ndcg'), mrr_full: delta('mrr_full') };
}

function buildProductionCase(caseGold, query, snapshot, sourceByKey, gold) {
  const dense = denseRank(snapshot, sourceByKey, query, caseGold, gold);
  const rawPool = dense.slice(0, RAW_CANDIDATE_K).map((row, index) => ({ ...row, raw_vector_rank: index + 1, rank: index + 1 }));
  const current = currentProductionHygiene(rawPool, caseGold);
  const annotated = applyP1AHygiene(rawPool);
  const r0Rows = annotated.filter(row => current.eligible.some(candidate => candidate.source_chunk_id === row.source_chunk_id));
  const r1Rows = r0Rows.filter(row => !row.p1a_hygiene.excluded);
  const r0Final = finalProjection(r0Rows, { p1aEnabled: false });
  const r1Final = finalProjection(r1Rows, { p1aEnabled: false });
  const expected = expectedProjection(caseGold);
  const makeMetricMap = rows => Object.fromEntries(FINAL_METRIC_K_VALUES.map(k => [String(k), metricAtK(caseGold, rows, k, gold, expected)]));
  const rawMetricMap = Object.fromEntries(ALL_K_VALUES.map(k => [String(k), metricAtK(caseGold, rawPool, k, gold, expected, 'RAW_CANDIDATE_POOL')]));
  const decorate = rows => rows.map(row => ({
    candidate_id: row.candidate_id,
    material_id: row.material_id,
    doc_id: row.doc_id,
    source_chunk_id: row.source_chunk_id,
    source_chunk_hash: row.source_chunk_hash,
    source_text_hash: row.source_text_hash,
    source_span: row.source_span,
    char_start: row.char_start,
    char_end: row.char_end,
    page_start: row.page_start,
    page_end: row.page_end,
    paragraph_start: row.paragraph_start,
    paragraph_end: row.paragraph_end,
    source_role: row.source_role,
    authority: row.authority,
    production_authority: row.production_authority,
    enterprise_id: row.enterprise_id,
    material_type: row.material_type,
    score: row.score,
    gold_grade: row.gold_grade,
    gold_span_refs: row.gold_span_refs,
    dense_rank: row.dense_rank,
    raw_vector_rank: row.raw_vector_rank,
    rank: row.rank ?? null,
    current_hygiene_eligible: row.current_hygiene_eligible ?? current.eligible.some(candidate => candidate.source_chunk_id === row.source_chunk_id),
    p1a_hygiene_excluded: row.p1a_hygiene.excluded,
    p1a_hygiene_reason_codes: row.p1a_hygiene.reasons
  }));
  const firstDenseRelevant = dense.find(row => row.gold_grade >= 2);
  const firstR0 = r0Final.find(row => row.gold_grade >= 2);
  const firstR1 = r1Final.find(row => row.gold_grade >= 2);
  return {
    case_id: caseGold.case_id,
    requirement_id: caseGold.requirement_id,
    governance_split: caseGold.split === 'UNTOUCHED_HOLDOUT_SET' ? 'DEVELOPMENT_VALIDATION_SET' : caseGold.split,
    former_gold_split: caseGold.split,
    profile_class: caseGold.profile_class,
    case_class: caseGold.case_class,
    expected,
    raw_candidate_pool_size: rawPool.length,
    current_hygiene_contract: current.current_contract,
    current_filtered_count: current.excluded.length,
    current_survivor_count: current.eligible.length,
    p1a_filtered_count_within_raw_pool: r0Rows.filter(row => row.p1a_hygiene.excluded).length,
    p1a_survivor_count_after_raw_pool: r1Rows.length,
    final_k: FINAL_K,
    replenishment: false,
    raw_pool_metrics: rawMetricMap,
    r0: { metrics: makeMetricMap(r0Final), final_candidates: decorate(r0Final) },
    r1: { metrics: makeMetricMap(r1Final), final_candidates: decorate(r1Final) },
    first_grade_ge_2: {
      raw_dense_rank: firstDenseRelevant?.dense_rank ?? null,
      r0_final_rank: firstR0?.rank ?? null,
      r1_final_rank: firstR1?.rank ?? null,
      present_in_raw_pool: Boolean(firstDenseRelevant && firstDenseRelevant.dense_rank <= RAW_CANDIDATE_K),
      present_in_r0_final: Boolean(firstR0),
      present_in_r1_final: Boolean(firstR1)
    },
    raw_pool_candidates: decorate(annotated)
  };
}

function buildCaseCollections(caseGolds, queriesByRequirement, snapshot, sourceByKey, gold) {
  return caseGolds.map(caseGold => buildProductionCase(caseGold, queriesByRequirement.get(caseGold.requirement_id), snapshot, sourceByKey, gold));
}

function p1aFullRankSummary(p1aReplay) {
  const rename = value => ({ ...value, governance_split: value.split === 'UNTOUCHED_HOLDOUT_SET' ? 'DEVELOPMENT_VALIDATION_SET' : value.split });
  const mapSlice = source => Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key === 'UNTOUCHED_HOLDOUT_SET' ? 'DEVELOPMENT_VALIDATION_SET' : key, value]));
  return {
    artifact_path: relative(P1A_REPLAY_PATH),
    artifact_sha256: sha256File(P1A_REPLAY_PATH).toUpperCase(),
    baseline_metrics_at_k: p1aReplay.baseline.aggregates_at_k,
    challenger_metrics_at_k: p1aReplay.structure_hygiene_challenger.aggregates_at_k,
    baseline_development_validation_metrics_at_k: mapSlice(p1aReplay.baseline.split_slices).DEVELOPMENT_VALIDATION_SET?.metrics_at_k || null,
    challenger_development_validation_metrics_at_k: mapSlice(p1aReplay.structure_hygiene_challenger.split_slices).DEVELOPMENT_VALIDATION_SET?.metrics_at_k || null,
    baseline_profile_slices: p1aReplay.baseline.profile_slices,
    challenger_profile_slices: p1aReplay.structure_hygiene_challenger.profile_slices,
    p1a_case_projection: p1aReplay.structure_hygiene_challenger.cases.map(rename)
  };
}

function metricsFor(cases, system, kValues = FINAL_METRIC_K_VALUES) {
  const key = system === 'R0' ? 'r0' : 'r1';
  return aggregateAll(cases.map(item => ({ ...item, metrics: item[key].metrics })), 'metrics', kValues);
}
function profileMetricsFor(cases, system) {
  const key = system === 'R0' ? 'r0' : 'r1';
  const profiles = [...new Set(cases.map(item => item.profile_class))].sort();
  return Object.fromEntries(profiles.map(profile => { const scoped = cases.filter(item => item.profile_class === profile).map(item => ({ ...item, metrics: item[key].metrics })); return [profile, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped) }]; }));
}
function splitMetricsFor(cases, system) {
  const key = system === 'R0' ? 'r0' : 'r1';
  const splits = [...new Set(cases.map(item => item.governance_split))].sort();
  return Object.fromEntries(splits.map(split => { const scoped = cases.filter(item => item.governance_split === split).map(item => ({ ...item, metrics: item[key].metrics })); return [split, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped) }]; }));
}

function buildOverlay(gold) {
  const cases = gold.cases.filter(item => FORMER_HOLDOUT_CASE_IDS.includes(item.case_id)).map((item, index) => ({
    ordinal: index + 1,
    case_id: item.case_id,
    requirement_id: item.requirement_id,
    source_split: item.split,
    governance_split: 'DEVELOPMENT_VALIDATION_SET',
    semantic_gold_label_unchanged: true,
    gold_case_projection_sha256: sha256Text(JSON.stringify({ case_id: item.case_id, has_sufficient_evidence: item.has_sufficient_evidence, evidence_items: item.evidence_items, evidence_atoms: item.evidence_atoms }))
  }));
  assert(cases.length === DEVELOPMENT_VALIDATION_CASE_COUNT, 'DEVELOPMENT_VALIDATION_OVERLAY_COUNT_DRIFT');
  const overlay = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1B_DEVELOPMENT_VALIDATION_LABEL_OVERLAY_V1',
    artifact_version: 'v1',
    status: 'GOVERNANCE_METADATA_ONLY',
    authority: 'CODEX_MECHANICAL_GOVERNANCE_ONLY',
    gold_semantic_authority: 'GPT_SEMANTIC_GOLD_V1',
    gold_path: relative(GOLD_PATH),
    gold_file_sha256: sha256File(GOLD_PATH).toUpperCase(),
    gold_semantic_labels_mutated: false,
    fresh_blind_holdout_claim: false,
    reason: 'P0 results were inspected and used for intervention selection; the former seven-case holdout is no longer release-blind.',
    cases,
    deterministic_content_hash: null
  };
  overlay.deterministic_content_hash = deterministicContentHash(overlay, ['deterministic_content_hash']);
  return overlay;
}

function buildDependencyDiagnostic({ productionCases, p1aReplay }) {
  const fullByRequirement = new Map(p1aReplay.structure_hygiene_challenger.cases.map(item => [item.requirement_id, item]));
  const baselineByRequirement = new Map(p1aReplay.baseline.cases.map(item => [item.requirement_id, item]));
  const rows = productionCases.map(item => {
    const full = fullByRequirement.get(item.requirement_id);
    const baseline = baselineByRequirement.get(item.requirement_id);
    const outside = (full?.top20 || []).filter(row => row.gold_grade >= 2 && row.dense_rank > RAW_CANDIDATE_K);
    const fullK5 = full?.metrics?.['5'];
    const baseK5 = baseline?.metrics?.['5'];
    const fullRankGain = fullK5 && baseK5 && (fullK5.evidence_atom_recall > baseK5.evidence_atom_recall || fullK5.candidate_precision > baseK5.candidate_precision || fullK5.ndcg > baseK5.ndcg);
    const fullRankGainAtAnyReportedK = ALL_K_VALUES.some(k => {
      const left = full?.metrics?.[String(k)];
      const right = baseline?.metrics?.[String(k)];
      return left && right && ['evidence_atom_recall', 'candidate_precision', 'ndcg'].some(field => left[field] > right[field]);
    });
    const r0K5 = item.r0.metrics['5'];
    const r1K5 = item.r1.metrics['5'];
    const withinGain = r1K5.evidence_atom_recall > r0K5.evidence_atom_recall || r1K5.candidate_precision > r0K5.candidate_precision || r1K5.ndcg > r0K5.ndcg;
    const classification = fullRankGainAtAnyReportedK && outside.length ? 'HYGIENE_GAIN_REQUIRES_DEEPER_POOL' : withinGain || (fullRankGainAtAnyReportedK && !outside.length) ? 'HYGIENE_GAIN_WITHIN_POOL' : 'NO_OBSERVED_HYGIENE_GAIN';
    return {
      case_id: item.case_id,
      requirement_id: item.requirement_id,
      is_special_diagnostic_case: SPECIAL_REQUIREMENT_IDS.includes(item.requirement_id),
      raw_candidate_k: RAW_CANDIDATE_K,
      p1a_full_rank_gain_at_k5: Boolean(fullRankGain),
      p1a_full_rank_gain_at_any_reported_k: Boolean(fullRankGainAtAnyReportedK),
      p1a_relevant_evidence_outside_raw_pool: outside.map(row => ({ source_chunk_id: row.source_chunk_id, dense_rank: row.dense_rank, gold_grade: row.gold_grade })),
      first_grade_ge_2_dense_rank: item.first_grade_ge_2.raw_dense_rank,
      r0_k5: r0K5,
      r1_k5: r1K5,
      classification
    };
  });
  const special = rows.filter(row => row.is_special_diagnostic_case);
  const development = rows.filter(row => row.is_special_diagnostic_case || row.governance_split === 'DEVELOPMENT_VALIDATION_SET');
  const fullCaseByRequirement = new Map(p1aReplay.structure_hygiene_challenger.cases.map(item => [item.requirement_id, item]));
  const requiredDepthAtK = Object.fromEntries(ALL_K_VALUES.map(k => {
    const depths = development.map(item => {
      const full = fullCaseByRequirement.get(item.requirement_id);
      return Math.max(0, ...(full?.top20 || []).slice(0, k).map(row => Number(row.dense_rank) || 0));
    });
    return [String(k), { observed_required_raw_depth_max: depths.length ? Math.max(...depths) : 0, diagnostic_only: true, not_a_production_configuration: true }];
  }));
  return {
    required_depth_diagnostic: { description: 'Maximum original dense rank needed by the frozen P1A projected Top-K rows across the inspected development-validation cases; diagnostic only.', by_k: requiredDepthAtK },
    special_cases: special,
    all_cases: rows,
    counts: rows.reduce((out, row) => { out[row.classification] = (out[row.classification] || 0) + 1; return out; }, {})
  };
}

function chooseGate({ productionCases, fullRank, dependency }) {
  const validationCases = productionCases.filter(item => item.governance_split === 'DEVELOPMENT_VALIDATION_SET');
  const r0 = metricsFor(validationCases, 'R0');
  const r1 = metricsFor(validationCases, 'R1');
  const k = '5';
  const primary = ['evidence_atom_recall', 'candidate_precision', 'ndcg'];
  const withinPoolNoRegression = primary.every(field => r1[k][field] >= r0[k][field]);
  const withinPoolStrictGain = primary.some(field => r1[k][field] > r0[k][field]);
  const fullRankCandidate = fullRank.challenger_development_validation_metrics_at_k?.[k];
  const fullRankBaseline = fullRank.baseline_development_validation_metrics_at_k?.[k];
  const fullRankStrictGain = fullRankCandidate && fullRankBaseline && primary.some(field => fullRankCandidate[field] > fullRankBaseline[field]);
  const deeperCases = validationCases.filter(item => item.dependency_classification === 'HYGIENE_GAIN_REQUIRES_DEEPER_POOL');
  const currentShapeReproducesP1AGain = Boolean(fullRankCandidate && primary.every(field => r0[k][field] >= fullRankCandidate[field]) && primary.every(field => r1[k][field] >= r0[k][field]));
  const observedRequiredDepthAtK = dependency.required_depth_diagnostic.by_k[k]?.observed_required_raw_depth_max || 0;
  let result;
  if (currentShapeReproducesP1AGain) result = 'P1A_PRODUCTION_SAFE_AS_IS';
  else if (fullRankStrictGain && (deeperCases.length > 0 || observedRequiredDepthAtK > RAW_CANDIDATE_K)) result = 'P1A_NEEDS_BOUNDED_OVERFETCH';
  else result = 'P1A_NOT_PRODUCTION_JUSTIFIED';
  return {
    result,
    evaluation_k: 5,
    comparison_scope: 'DEVELOPMENT_VALIDATION_SET_ONLY; CALIBRATION_SET remains reported separately',
    comparisons: { r0, r1, full_rank_baseline: fullRankBaseline || null, full_rank_p1a: fullRankCandidate || null },
    full_rank_strict_gain: Boolean(fullRankStrictGain),
    current_shape_reproduces_p1a_gain: currentShapeReproducesP1AGain,
    observed_required_depth_at_evaluation_k: observedRequiredDepthAtK,
    within_pool_no_regression: withinPoolNoRegression,
    within_pool_strict_gain: withinPoolStrictGain,
    deeper_pool_dependency_case_count: deeperCases.length,
    observed_depth_is_diagnostic_only: true,
    production_promotion: 'NOT_AUTHORIZED'
  };
}

function costDiagnostic(cases, gate, dependency) {
  const raw = cases.reduce((sum, item) => sum + item.raw_candidate_pool_size, 0);
  const filtered = cases.reduce((sum, item) => sum + item.current_filtered_count + item.p1a_filtered_count_within_raw_pool, 0);
  const survivors = cases.reduce((sum, item) => sum + item.p1a_survivor_count_after_raw_pool, 0);
  const observedDepth = Math.max(...Object.values(dependency.required_depth_diagnostic.by_k).map(item => item.observed_required_raw_depth_max));
  return {
    applicable_only_if_gate_is_bounded_overfetch: gate.result === 'P1A_NEEDS_BOUNDED_OVERFETCH',
    candidate_pool_expansion_ratio_diagnostic: raw ? num(observedDepth / RAW_CANDIDATE_K) : null,
    filtered_candidate_ratio_within_current_raw_pool: raw ? num(filtered / raw) : null,
    survivor_count_within_current_raw_pool: survivors,
    observed_required_depth_max_diagnostic: observedDepth,
    estimated_payload_delta: observedDepth > RAW_CANDIDATE_K ? { additional_candidate_rows_max: observedDepth - RAW_CANDIDATE_K, basis: 'frozen candidate row count only', production_config: false } : { additional_candidate_rows_max: 0, basis: 'no observed deeper-pool requirement', production_config: false },
    estimated_latency_impact: 'NOT_MEASURABLE_OFFLINE_NO_VECTOR_DB_CALL',
    no_full_corpus_retrieval: true,
    no_unbounded_overfetch_recommendation: true
  };
}

function safetyReport({ productionCases, sourcesRows }) {
  const all = productionCases.flatMap(item => item.r1.final_candidates);
  return {
    source_role_escape_count: all.filter(row => row.source_role !== 'EVIDENCE_CANDIDATE').length,
    quarantine_escape_count: all.filter(row => row.source_role === 'QUARANTINE' || row.quarantined === true).length,
    cross_enterprise_escape_count: all.filter(row => row.enterprise_id !== ENTERPRISE_ID).length,
    authority_scope_escape_count: all.filter(row => row.authority !== 'SYNTHETIC_EVAL_ONLY' || row.production_authority !== 'NONE').length,
    lineage_incomplete_count: all.filter(row => !row.source_chunk_id || !row.source_chunk_hash || !row.source_span || row.char_start == null || row.char_end == null).length,
    source_corpus_count: sourcesRows.length,
    source_span_identity_preserved: all.every(row => row.source_span === `${row.source_chunk_id}:FULL`),
    fact_mapping_claim_writer_mutations: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    corpus_mutations: 0
  };
}

function buildReplay({ gold, snapshot, sourceByKey, queries, p1aReplay, overlay, sourcesRows }) {
  const queryByRequirement = new Map(queries.map(row => [row.requirement_id, row]));
  const cases = buildCaseCollections(gold.cases, queryByRequirement, snapshot, sourceByKey, gold);
  const dependency = buildDependencyDiagnostic({ productionCases: cases, p1aReplay });
  const dependencyByRequirement = new Map(dependency.all_cases.map(row => [row.requirement_id, row.classification]));
  for (const item of cases) item.dependency_classification = dependencyByRequirement.get(item.requirement_id) || 'NO_OBSERVED_HYGIENE_GAIN';
  const fullRank = p1aFullRankSummary(p1aReplay);
  const gate = chooseGate({ productionCases: cases, fullRank, dependency });
  const replay = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_REPLAY_V1',
    artifact_version: 'v1',
    status: 'P1B_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING',
    experiment_id: P1B_EXPERIMENT_ID,
    p1b_scope: 'STRUCTURE_HYGIENE_ONLY_PRODUCTION_SHAPE_CANARY',
    P1A_HYGIENE_RULE_VERSION: P1A_RULE_VERSION,
    P1A_HYGIENE_RULE_HASH: ACCEPTED_P1A_RULE_HASH,
    evidence_matcher_version: MATCHER_VERSION,
    evidence_matcher_hash: MATCHER_HASH,
    governance_split_overlay: { path: relative(OVERLAY_PATH), file_sha256: sha256File(OVERLAY_PATH).toUpperCase(), deterministic_content_hash: overlay.deterministic_content_hash, former_holdout_count: DEVELOPMENT_VALIDATION_CASE_COUNT, fresh_blind_holdout: false },
    production_shape: {
      current_hygiene_position: 'POST_TRUNCATION',
      current_slot_replenishment: 'NO',
      current_raw_candidate_k: RAW_CANDIDATE_K,
      raw_vector_candidate_k: RAW_CANDIDATE_K,
      current_final_k: FINAL_K,
      rerank_review_k: FINAL_K,
      filtering_order: 'raw vector candidate truncation -> current hygiene -> rerank/fallback -> final review projection',
      raw_vector_query_count: 1,
      additional_vector_db_call_for_replenishment: false,
      maximum_raw_candidate_pool_available: RAW_CANDIDATE_K,
      post_filter_candidate_count: {
        per_case: cases.map(item => ({ case_id: item.case_id, current_filtered_count: item.current_filtered_count, current_survivor_count: item.current_survivor_count })),
        total_survivors: cases.reduce((sum, item) => sum + item.current_survivor_count, 0),
        minimum_survivors: Math.min(...cases.map(item => item.current_survivor_count)),
        maximum_survivors: Math.max(...cases.map(item => item.current_survivor_count))
      },
      current_hygiene_contract: 'retrieval-chunk-role-v1 / partitionRetrievalCandidates',
      rerank_contract: '4.3-role-need-rerank-v1; frozen Eval inputs lack approved semantic metadata, so raw-vector fallback is used',
      distinction: 'POST_TRUNCATION_HYGIENE is the current behavior; BOUNDED_OVERFETCH_THEN_HYGIENE is not implemented or silently simulated.'
    },
    R0_current_production_shape: {
      candidate_unit: 'raw dense top-20 -> current production hygiene -> raw-vector fallback order -> final top-8',
      metrics_at_k: metricsFor(cases, 'R0'),
      split_slices: splitMetricsFor(cases, 'R0'),
      profile_slices: profileMetricsFor(cases, 'R0'),
      failure_family_distribution: failureFamilies(cases.map(item => ({ ...item, final_candidates: item.r0.final_candidates })))
    },
    R1_same_shape_plus_frozen_p1a_hygiene: {
      candidate_unit: 'raw dense top-20 -> current production hygiene -> frozen P1A hygiene -> raw-vector fallback order -> final top-8',
      metrics_at_k: metricsFor(cases, 'R1'),
      split_slices: splitMetricsFor(cases, 'R1'),
      profile_slices: profileMetricsFor(cases, 'R1'),
      failure_family_distribution: failureFamilies(cases.map(item => ({ ...item, final_candidates: item.r1.final_candidates })))
    },
    raw_pool_metrics_at_k20: {
      note: 'K=20 is reported only for the raw candidate pool; it is not a final review result because CURRENT_FINAL_K=8.',
      R0: aggregateAll(cases.map(item => ({ ...item, metrics: item.raw_pool_metrics })), 'metrics', RAW_POOL_K_VALUES),
      R1: aggregateAll(cases.map(item => ({ ...item, metrics: item.raw_pool_metrics })), 'metrics', RAW_POOL_K_VALUES)
    },
    cases,
    candidate_pool_dependency_diagnostic: dependency,
    full_rank_projection_result: fullRank,
    gate,
    cost_diagnostic: costDiagnostic(cases, gate, dependency),
    safety: safetyReport({ productionCases: cases, sourcesRows }),
    provider_calls: 0,
    embedding_calls: 0,
    llm_calls: 0,
    production_retrieval_changes: 0,
    deterministic_content_hash: null
  };
  replay.deterministic_content_hash = deterministicContentHash(replay, ['deterministic_content_hash']);
  return replay;
}

function renderMarkdown(checkpoint, replay) {
  const r0 = replay.R0_current_production_shape.metrics_at_k;
  const r1 = replay.R1_same_shape_plus_frozen_p1a_hygiene.metrics_at_k;
  const row = k => `| ${k} | ${r0[String(k)]?.evidence_atom_recall ?? 'n/a'} | ${r1[String(k)]?.evidence_atom_recall ?? 'n/a'} | ${r0[String(k)]?.candidate_precision ?? 'n/a'} | ${r1[String(k)]?.candidate_precision ?? 'n/a'} | ${r0[String(k)]?.ndcg ?? 'n/a'} | ${r1[String(k)]?.ndcg ?? 'n/a'} |`;
  return [
    '# V43 RAG Retrieval P1B Production-Shape Hygiene Canary Checkpoint', '',
    `- Status: **${checkpoint.status}**`,
    '- Mode: **ENGINEERING VALIDATION ONLY**; production promotion: **NOT AUTHORIZED**.',
    '- Scope: **P1A_STRUCTURE_HYGIENE_ONLY / production-shape canary**; re-chunking 0; parent/child change 0; embedding change 0.',
    `- P1A rule: ${P1A_RULE_VERSION} / ${ACCEPTED_P1A_RULE_HASH}`,
    `- Matcher: ${MATCHER_VERSION} / ${MATCHER_HASH}`, '',
    '## Production shape', '',
    `- CURRENT_HYGIENE_POSITION: **POST_TRUNCATION**; CURRENT_RAW_CANDIDATE_K: **${RAW_CANDIDATE_K}**; CURRENT_FINAL_K: **${FINAL_K}**; CURRENT_SLOT_REPLENISHMENT: **NO**.`,
    '- One vector query; no replenishment query. Bounded overfetch was not implemented or inferred as a runtime setting.', '',
    '## Final-review metrics', '',
    '| K | R0 atom recall | R1 atom recall | R0 precision | R1 precision | R0 nDCG | R1 nDCG |',
    '|---:|---:|---:|---:|---:|---:|---:|',
    ...FINAL_METRIC_K_VALUES.map(row), '',
    '- K=20 is raw-pool-only and is not mixed with final review K=8 metrics.',
    `- Gate: **${replay.gate.result}**`,
    `- OVERFETCH_REQUIRED_FOR_P1A_GAIN: **${replay.gate.result === 'P1A_NEEDS_BOUNDED_OVERFETCH' ? 'YES' : 'NO'}**`, '',
    '## Diagnostic and safety', '',
    `- Development-validation overlay: **${DEVELOPMENT_VALIDATION_CASE_COUNT}** former holdout cases; semantic Gold mutated: **0**; fresh blind holdout claim: **false**.`,
    `- Special-case classifications: ${JSON.stringify(replay.candidate_pool_dependency_diagnostic.special_cases.map(item => ({ requirement_id: item.requirement_id, classification: item.classification, outside: item.p1a_relevant_evidence_outside_raw_pool })))}.`,
    `- Reproducibility: **${checkpoint.reproducibility.replay_parity}**.`,
    '- Provider/embedding/LLM calls: **0/0/0**; production/eval DB writes: **0/0**; no corpus or authority mutation.', '',
    'Stop for GPT review. Do not implement P1B runtime changes, P2, P3, P4, MMR, hybrid, or reranker.', '',
    '**V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1**', ''
  ].join('\n');
}

async function main() {
  const gold = readJson(GOLD_PATH);
  const snapshot = readJson(SNAPSHOT_PATH);
  const supplement = readJson(SUPPLEMENT_PATH);
  const p0Checkpoint = readJson(P0_CHECKPOINT_PATH);
  const p1aReplay = readJson(P1A_REPLAY_PATH);
  const p1aProjection = readJson(P1A_PROJECTION_PATH);
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO_ROOT });
  const sourcesRows = validateFrozenInputs({ gold, snapshot, sources, p0Checkpoint, p1aReplay, p1aProjection });
  assert(p1aRuleHash() === ACCEPTED_P1A_RULE_HASH, 'P1A_RULE_HASH_DRIFT', { observed: p1aRuleHash(), expected: ACCEPTED_P1A_RULE_HASH });
  assert(deterministicContentHash(MATCHER_CONTRACT) === MATCHER_HASH, 'MATCHER_HASH_DRIFT', { observed: deterministicContentHash(MATCHER_CONTRACT), expected: MATCHER_HASH });
  const overlay = buildOverlay(gold);
  writeJson(OVERLAY_PATH, overlay);
  const overlayAfter = readJson(OVERLAY_PATH);
  const queries = buildQueries(gold, snapshot, supplement);
  const queryBatchFreeze = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_QUERY_BATCH_FREEZE_V1',
    artifact_version: 'v1',
    status: 'FROZEN_BEFORE_PRODUCTION_SHAPE_REPLAY',
    experiment_id: P1B_EXPERIMENT_ID,
    exact_case_order: queries.map(({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source }) => ({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source })),
    query_count: queries.length,
    gold_projection_version: GOLD_PROJECTION_VERSION,
    evidence_matcher_version: MATCHER_VERSION,
    evidence_matcher_hash: MATCHER_HASH,
    all_query_vectors_loaded_before_retrieval_inspection: true,
    provider_calls: 0,
    embedding_calls: 0,
    deterministic_content_hash: null
  };
  queryBatchFreeze.deterministic_content_hash = deterministicContentHash(queryBatchFreeze, ['deterministic_content_hash']);
  writeJson(QUERY_BATCH_FREEZE_PATH, queryBatchFreeze);
  const queryBatchFreezeSha = sha256File(QUERY_BATCH_FREEZE_PATH).toUpperCase();
  const sourceByKey = sourceIndex(sources);
  const replay1 = buildReplay({ gold, snapshot, sourceByKey, queries, p1aReplay, overlay: overlayAfter, sourcesRows });
  replay1.query_batch_freeze = { path: relative(QUERY_BATCH_FREEZE_PATH), file_sha256: queryBatchFreezeSha, deterministic_content_hash: queryBatchFreeze.deterministic_content_hash };
  const replay2 = buildReplay({ gold, snapshot, sourceByKey, queries, p1aReplay, overlay: overlayAfter, sourcesRows });
  replay2.query_batch_freeze = { path: relative(QUERY_BATCH_FREEZE_PATH), file_sha256: queryBatchFreezeSha, deterministic_content_hash: queryBatchFreeze.deterministic_content_hash };
  assert(replay1.deterministic_content_hash === replay2.deterministic_content_hash, 'P1B_REPLAY_PARITY_DRIFT', { first: replay1.deterministic_content_hash, second: replay2.deterministic_content_hash });
  writeJson(REPLAY_PATH, replay1);
  const replaySha = sha256File(REPLAY_PATH).toUpperCase();
  const goldAfter = sha256File(GOLD_PATH).toUpperCase();
  const snapshotAfter = sha256File(SNAPSHOT_PATH).toUpperCase();
  const checkpoint = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1',
    artifact_version: 'v1',
    status: 'P1B_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING',
    execution_mode: 'ENGINEERING_VALIDATION_ONLY',
    decision: 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_V1',
    P1A_SCOPE: 'STRUCTURE_HYGIENE_ONLY',
    p1b_scope: 'STRUCTURE_HYGIENE_ONLY',
    RECHUNKING: 0,
    PARENT_CHILD_CHANGE: 0,
    EMBEDDING_CHANGE: 0,
    GOLD_IN_FILTER_LOGIC: 0,
    CASE_SPECIFIC_RULE_COUNT: 0,
    REQUIREMENT_ID_HARDCODE_COUNT: 0,
    GOLD_ITEM_HARDCODE_COUNT: 0,
    P1A_HYGIENE_RULE_VERSION: P1A_RULE_VERSION,
    P1A_HYGIENE_RULE_HASH: ACCEPTED_P1A_RULE_HASH,
    CURRENT_HYGIENE_POSITION: 'POST_TRUNCATION',
    CURRENT_SLOT_REPLENISHMENT: 'NO',
    CURRENT_RAW_CANDIDATE_K: RAW_CANDIDATE_K,
    CURRENT_FINAL_K: FINAL_K,
    OVERFETCH_REQUIRED_FOR_P1A_GAIN: replay1.gate.result === 'P1A_NEEDS_BOUNDED_OVERFETCH' ? 'YES' : 'NO',
    observed_depth_is_production_config: false,
    baseline_identity: { snapshot_id: SNAPSHOT_ID, snapshot_file_sha256: SNAPSHOT_SHA256, snapshot_identity_hash: SNAPSHOT_IDENTITY_HASH, material_count: 9, chunk_count: 94, embedding_provider: PROVIDER_HOST, embedding_model: MODEL, vector_dimension: DIMENSION },
    corpus_identity: { loader: relative(path.join(REPO_ROOT, 'backend/eval/real-e2e/chengchuan-evidence-source-loader.mjs')), source_chunk_count: sourcesRows.length, source_identity_sha256: sha256Text(JSON.stringify(sourcesRows.map(row => ({ material_id: row.material_id, chunk_id: row.chunk_id, chunk_hash: row.chunk_hash })))) },
    gold_identity: { path: relative(GOLD_PATH), file_sha256_before: GOLD_SHA256, file_sha256_after: goldAfter, semantic_gold_mutated: false, case_count: gold.cases.length, projection_version: GOLD_PROJECTION_VERSION },
    former_holdout_relabel: { overlay_path: relative(OVERLAY_PATH), overlay_file_sha256: sha256File(OVERLAY_PATH).toUpperCase(), overlay_content_hash: overlayAfter.deterministic_content_hash, former_holdout_case_count: DEVELOPMENT_VALIDATION_CASE_COUNT, new_governance_label: 'DEVELOPMENT_VALIDATION_SET', fresh_blind_holdout: false, semantic_gold_labels_changed: false },
    evidence_matcher: { version: MATCHER_VERSION, hash: MATCHER_HASH, contract: MATCHER_CONTRACT },
    query_batch_freeze: { path: relative(QUERY_BATCH_FREEZE_PATH), artifact_sha256: queryBatchFreezeSha, deterministic_content_hash: queryBatchFreeze.deterministic_content_hash, exact_case_order_frozen: true, all_query_vectors_loaded_before_retrieval_inspection: true },
    full_rank_projection_result: { path: relative(P1A_REPLAY_PATH), file_sha256: sha256File(P1A_REPLAY_PATH).toUpperCase(), metrics_not_mixed_with_production_shape: true, result: replay1.full_rank_projection_result },
    production_shape_result: { path: relative(REPLAY_PATH), file_sha256: replaySha, R0: replay1.R0_current_production_shape, R1: replay1.R1_same_shape_plus_frozen_p1a_hygiene, raw_pool_k20: replay1.raw_pool_metrics_at_k20, candidate_pool_dependency_diagnostic: replay1.candidate_pool_dependency_diagnostic },
    production_retrieval_shape: replay1.production_shape,
    metric_definitions: { final_review_k_values: FINAL_METRIC_K_VALUES, raw_pool_k_values: RAW_POOL_K_VALUES, evidence_atom_recall: 'Frozen Gold atoms with at least one accepted span; Top-K candidate identity match covers atom.', candidate_precision: 'Top-K candidates with frozen Gold grade >= 2 divided by requested K; denominator remains requested K when final pool is short.', mrr: 'Reciprocal rank of first frozen Gold grade >= 2 candidate in the returned final ranking; null when absent.', ndcg: 'Frozen Gold item grades only, standard gain (2^grade-1) and log2 discount.', k0: 'Expected retrieval K0 is derived from frozen Gold evidence items all having grade < 2; false positive/negative rates are reported separately.', matching_contract: `${MATCHER_VERSION}/${MATCHER_HASH}` },
    safety_parity: { ...safetyReport({ productionCases: replay1.cases, sourcesRows }), source_snapshot_sha256_before: SNAPSHOT_SHA256, source_snapshot_sha256_after: snapshotAfter, source_snapshot_unchanged: snapshotAfter === SNAPSHOT_SHA256 },
    reproducibility: { replay_parity: true, first_replay_hash: replay1.deterministic_content_hash, second_replay_hash: replay2.deterministic_content_hash, query_batch_freeze_hash: queryBatchFreeze.deterministic_content_hash },
    safety_metrics: { provider_calls: 0, embedding_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, corpus_mutations: 0, fact_mapping_claim_writer_mutations: 0, authority_changes: 0, lineage_changes: 0, production_retrieval_changes: 0 },
    gate_result: replay1.gate.result,
    cost_diagnostic: replay1.cost_diagnostic,
    stop_conditions: ['Do not promote P1A to production.', 'Do not convert observed depth into candidateK, overfetchK, reviewK, or runtime threshold.', 'Do not implement full-ranking retrieval or unbounded overfetch.', 'Do not start P2, P3, P4, MMR, hybrid, or reranker.', 'Do not treat retrieved candidates as supported evidence or claim authorization.'],
    next_action: 'GPT_REVIEW_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY',
    deterministic_content_hash: null
  };
  checkpoint.deterministic_content_hash = deterministicContentHash(checkpoint, ['deterministic_content_hash']);
  writeJson(CHECKPOINT_PATH, checkpoint);
  fs.writeFileSync(CHECKPOINT_MD_PATH, renderMarkdown(checkpoint, replay1), 'utf8');
  console.log(JSON.stringify({ status: checkpoint.artifact_type, checkpoint: relative(CHECKPOINT_PATH), checkpoint_file_sha256: sha256File(CHECKPOINT_PATH).toUpperCase(), replay: relative(REPLAY_PATH), replay_file_sha256: replaySha, gate: replay1.gate.result, current_shape: replay1.production_shape, P1A_HYGIENE_RULE_HASH: ACCEPTED_P1A_RULE_HASH, EVIDENCE_MATCHER_VERSION: MATCHER_VERSION, EVIDENCE_MATCHER_HASH: MATCHER_HASH, provider_calls: 0, embedding_calls: 0, llm_calls: 0, production_retrieval_changes: 0, replay_parity: true }, null, 2));
}

try { await main(); } catch (error) {
  console.error(JSON.stringify({ status: error.code || 'P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_FAILED', reason: error.message, details: error.details || {} }, null, 2));
  process.exitCode = 1;
}
