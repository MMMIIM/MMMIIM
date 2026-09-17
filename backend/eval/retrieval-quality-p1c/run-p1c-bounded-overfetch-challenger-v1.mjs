import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadFrozenChengchuanEvidenceSources } from '../real-e2e/chengchuan-evidence-source-loader.mjs';
import { partitionRetrievalCandidates, RETRIEVAL_CHUNK_ROLE_VERSION } from '../../src/pipeline/retrieval-chunk-role.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../');
const GOLD_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const SUPPLEMENT_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/results/V43_RAG_RETRIEVAL_P0_HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1.json');
const P0_CHECKPOINT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_AND_K0_V2/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.json');
const P1B_QUERY_FREEZE_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p1b/results/V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_QUERY_BATCH_FREEZE_V1.json');
const P1B_REPLAY_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p1b/results/V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_REPLAY_V1.json');
const OUTPUT_DIR = path.join(HERE, 'results');
const QUERY_BATCH_FREEZE_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_QUERY_BATCH_FREEZE_V1.json');
const REPLAY_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_REPLAY_V1.json');
const CHECKPOINT_DIR = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_V1');
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1.json');
const CHECKPOINT_MD_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1.md');

const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const SNAPSHOT_SHA256 = '5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578';
const GOLD_SHA256 = '7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7';
const SNAPSHOT_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const PROVIDER_HOST = 'api.siliconflow.cn';
const DIMENSION = 1024;
const CANDIDATE_K_LADDER = Object.freeze([20, 32, 48, 64]);
const CHALLENGER_DEPTHS = Object.freeze([32, 48]);
const FINAL_K = 8;
const METRIC_K_VALUES = Object.freeze([1, 3, 5, 8]);
const DEVELOPMENT_VALIDATION_CASE_COUNT = 7;
const EXPERIMENT_ID = 'V43-RAG-RETRIEVAL-P1C-BOUNDED-OVERFETCH-CHALLENGER-20260917';
const MATCHER_VERSION = 'EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE';
const MATCHER_HASH = 'ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2';
const GOLD_PROJECTION_VERSION = 'GPT_SEMANTIC_GOLD_V1_EXACT_SPAN_PROJECTION_V1';
const P1A_RULE_VERSION = 'P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC';
const P1A_RULE_HASH = '8320c40c28fa5052f6ea9abe3843a2544b6c929a955a252b97ee56b5180a79c2';
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
function sourceKey(row) { return `${row.material_id}|${row.chunk_id ?? row.source_chunk_id}|${row.chunk_hash ?? row.source_chunk_hash}`; }
function assertVector(vector, label) { assert(Array.isArray(vector) && vector.length === DIMENSION && vector.every(Number.isFinite), 'VECTOR_INVALID', { label, observed: Array.isArray(vector) ? vector.length : null }); }
function cosine(left, right) {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftNorm += left[index] * left[index]; rightNorm += right[index] * right[index]; }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

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
  return gold.cases.map((item, index) => {
    const vectorRow = inSnapshot.get(item.requirement_id) || inSupplement.get(item.requirement_id);
    assert(vectorRow, 'QUERY_VECTOR_MISSING', { requirement_id: item.requirement_id });
    assert(vectorRow.query_hash === item.query_hash, 'QUERY_HASH_DRIFT', { requirement_id: item.requirement_id });
    assertVector(vectorRow.vector, item.requirement_id);
    if (vectorRow.vector_hash) assert(sha256Text(JSON.stringify(vectorRow.vector)) === vectorRow.vector_hash, 'QUERY_VECTOR_HASH_DRIFT', { requirement_id: item.requirement_id });
    return { ordinal: index + 1, case_id: item.case_id, requirement_id: item.requirement_id, query_text: item.query_text, query_hash: item.query_hash, vector: vectorRow.vector, vector_source: inSnapshot.has(item.requirement_id) ? 'FROZEN_BASELINE_SNAPSHOT' : 'FROZEN_P0_HOLDOUT_SUPPLEMENT' };
  });
}
function validateFrozenInputs({ gold, snapshot, supplement, sources, p0Checkpoint, p1bFreeze, p1bReplay }) {
  assert(sha256File(GOLD_PATH).toUpperCase() === GOLD_SHA256, 'GOLD_SHA_DRIFT');
  assert(sha256File(SNAPSHOT_PATH).toUpperCase() === SNAPSHOT_SHA256, 'SNAPSHOT_SHA_DRIFT');
  assert(snapshot.manifest?.snapshot_id === SNAPSHOT_ID && snapshot.manifest?.identity_hash === SNAPSHOT_IDENTITY_HASH, 'SNAPSHOT_IDENTITY_DRIFT');
  assert(snapshot.manifest?.material_count === 9 && snapshot.manifest?.chunk_count === 94 && snapshot.vectors?.length === 94, 'SNAPSHOT_SHAPE_DRIFT');
  assert(snapshot.manifest?.embedding_model === MODEL && snapshot.manifest?.embedding_provider === PROVIDER_HOST && Number(snapshot.manifest?.vector_dimension) === DIMENSION, 'SNAPSHOT_EMBEDDING_IDENTITY_DRIFT');
  assert(gold.cases?.length === 10 && gold.authority === 'DEVELOPMENT_EVAL_ONLY' && gold.status === 'FROZEN_DEVELOPMENT_EVAL', 'GOLD_STATUS_OR_COUNT_DRIFT');
  assert(p0Checkpoint.evidence_matcher?.version === MATCHER_VERSION && p0Checkpoint.evidence_matcher?.hash === MATCHER_HASH, 'MATCHER_DRIFT');
  assert(p1bFreeze.artifact_type === 'V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_QUERY_BATCH_FREEZE_V1' && p1bFreeze.query_count === 10 && p1bFreeze.all_query_vectors_loaded_before_retrieval_inspection === true, 'P1B_QUERY_FREEZE_INVALID');
  assert(p1bReplay.production_shape?.current_raw_candidate_k === 20 && p1bReplay.production_shape?.current_final_k === FINAL_K, 'P1B_SHAPE_DRIFT');
  const rows = sources.flatMap(source => source.chunks.map(chunk => ({ ...chunk, material_id: source.material_id, doc_id: source.doc_id, source_file: source.source_file, source_role: source.source_role, authority: source.authority, production_authority: source.production_authority, enterprise_id: source.enterprise_id, material_type: source.material_type })));
  assert(rows.length === 94, 'SOURCE_CORPUS_COUNT_DRIFT');
  assert(sha256Text(JSON.stringify(rows.map(row => ({ material_id: row.material_id, chunk_id: row.chunk_id, chunk_hash: row.chunk_hash })))) === SNAPSHOT_IDENTITY_HASH, 'SOURCE_IDENTITY_HASH_DRIFT');
  const sourceKeys = new Set(rows.map(sourceKey));
  for (const row of snapshot.vectors) {
    assert(sourceKeys.has(sourceKey(row)), 'SNAPSHOT_SOURCE_LINEAGE_MISSING', { chunk_id: row.chunk_id });
    assert(row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID && row.authority === 'SYNTHETIC_EVAL_ONLY' && row.production_authority === 'NONE', 'SNAPSHOT_SCOPE_ESCAPE', { chunk_id: row.chunk_id });
    assertVector(row.vector, row.chunk_id);
  }
  return rows;
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
  const eligibleIds = new Set(partition.eligible_candidates.map(item => item.chunk_id));
  return {
    contract: `${RETRIEVAL_CHUNK_ROLE_VERSION} / partitionRetrievalCandidates`,
    filtered: rawPool.filter(item => !eligibleIds.has(item.chunk_id)),
    survivors: rawPool.filter(item => eligibleIds.has(item.chunk_id)),
    eligibleIds
  };
}
function candidateIdentity(row) { return `${row.material_id}|${row.source_chunk_id}|${row.source_chunk_hash}`; }
function atomKeys(caseGold, gold) {
  return (caseGold.evidence_atoms || []).filter(atom => (atom.acceptable_span_refs || []).length > 0).map(atom => (atom.acceptable_span_refs || []).map(ref => {
    const span = gold.source_spans[ref];
    return span ? `${span.material_id}|${span.chunk_id}|${span.chunk_hash}` : null;
  }).filter(Boolean));
}
function metricAtK(caseGold, ranked, k, gold, expected, scope) {
  const top = ranked.slice(0, k);
  const topKeys = new Set(top.map(candidateIdentity));
  const atoms = atomKeys(caseGold, gold);
  const coveredAtoms = atoms.filter(refs => refs.some(ref => topKeys.has(ref)));
  const relevantCount = top.filter(row => row.gold_grade >= 2).length;
  const idealGrades = (caseGold.evidence_items || []).map(item => Number(item.grade)).sort((a, b) => b - a).slice(0, k);
  const dcg = top.reduce((sum, row, index) => sum + ((2 ** row.gold_grade) - 1) / Math.log2(index + 2), 0);
  const idealDcg = idealGrades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const first = top.findIndex(row => row.gold_grade >= 2);
  const mrr = first < 0 ? 0 : num(1 / (first + 1));
  return {
    scope,
    requested_k: k,
    returned_count: top.length,
    evidence_atom_recall: atoms.length ? num(coveredAtoms.length / atoms.length) : null,
    candidate_precision: num(relevantCount / k),
    ndcg: idealDcg ? num(dcg / idealDcg) : null,
    mrr: mrr,
    expected_retrieval_k0: expected.expected_retrieval_k0,
    expected_no_sufficient_evidence: expected.expected_no_sufficient_evidence,
    returned_k0: top.length === 0,
    false_positive_retrieval_candidate: expected.expected_retrieval_k0 && top.some(row => row.gold_grade >= 2),
    false_negative_retrieval_k0: !expected.expected_retrieval_k0 && top.length === 0
  };
}
function decorate(row, currentEligible) {
  return {
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
    current_hygiene_eligible: currentEligible,
    final_rank: row.final_rank ?? null
  };
}
function buildCase(caseGold, query, snapshot, sourceByKey, gold) {
  const dense = denseRank(snapshot, sourceByKey, query, caseGold, gold);
  const expected = expectedProjection(caseGold);
  const depths = {};
  for (const depth of CANDIDATE_K_LADDER) {
    const rawPool = dense.slice(0, depth).map((row, index) => ({ ...row, raw_vector_rank: index + 1 }));
    const current = currentProductionHygiene(rawPool, caseGold);
    const survivors = current.survivors;
    const final = survivors.slice(0, FINAL_K).map((row, index) => ({ ...row, final_rank: index + 1 }));
    const finalMetrics = Object.fromEntries(METRIC_K_VALUES.map(k => [String(k), metricAtK(caseGold, final, k, gold, expected, 'FINAL_REVIEW')]));
    const rawMetric = metricAtK(caseGold, rawPool, depth, gold, expected, 'RAW_CANDIDATE_POOL');
    const finalRelevant = final.find(row => row.gold_grade >= 2);
    const eligibleRelevant = survivors.find(row => row.gold_grade >= 2);
    const outsideRelevant = dense.filter(row => row.dense_rank > 20 && row.gold_grade >= 2);
    const outsideSurvivor = survivors.find(row => row.dense_rank > 20 && row.gold_grade >= 2);
    const outsideFinal = final.find(row => row.dense_rank > 20 && row.gold_grade >= 2);
    const newRelevantSurvivors = survivors.filter(row => row.dense_rank > 20 && row.gold_grade >= 2);
    const newRelevant = final.filter(row => row.dense_rank > 20 && row.gold_grade >= 2);
    const baselineFinal = depth === 20 ? final : null;
    depths[String(depth)] = {
      candidate_k: depth,
      raw_candidate_count: rawPool.length,
      hygiene_filtered_count: current.filtered.length,
      hygiene_survivor_count: survivors.length,
      final_returned_candidate_count: final.length,
      final_pool_fill_rate: num(final.length / FINAL_K),
      final_pool_underfilled: final.length < FINAL_K,
      current_hygiene_contract: current.contract,
      final_metrics_at_k: finalMetrics,
      mrr_final_at_8: finalMetrics['8'].mrr,
      mrr_raw_at_depth: rawMetric.mrr,
      raw_metrics_at_depth: rawMetric,
      final_candidates: final.map(row => decorate(row, true)),
      raw_candidates: rawPool.map(row => decorate(row, current.eligibleIds.has(row.chunk_id))),
      grade_gte_2_entering_from_gt20: {
        raw_pool_entry_count: new Set(newRelevantSurvivors.map(row => candidateIdentity(row))).size,
        post_hygiene_survivor_count: newRelevantSurvivors.length,
        post_hygiene_case_count: new Set(newRelevantSurvivors.map(row => caseGold.case_id)).size,
        final_review_candidate_count: newRelevant.length,
        final_review_case_count: newRelevant.length ? 1 : 0,
        candidates_in_survivor_pool: newRelevantSurvivors.map(row => ({ source_chunk_id: row.source_chunk_id, dense_rank: row.dense_rank, post_hygiene_rank: survivors.indexOf(row) + 1, gold_grade: row.gold_grade })),
        candidates_in_final_review: newRelevant.map(row => ({ source_chunk_id: row.source_chunk_id, dense_rank: row.dense_rank, final_rank: row.final_rank, gold_grade: row.gold_grade })),
        atom_count: new Set(newRelevant.flatMap(row => row.gold_span_refs)).size
      },
      first_grade_ge_2: {
        dense_rank: dense.find(row => row.gold_grade >= 2)?.dense_rank ?? null,
        post_hygiene_rank: eligibleRelevant ? survivors.indexOf(eligibleRelevant) + 1 : null,
        final_review_rank: finalRelevant?.final_rank ?? null,
        entered_final_review: Boolean(finalRelevant)
      },
      first_grade_ge_2_outside_top20: {
        dense_rank: outsideRelevant[0]?.dense_rank ?? null,
        post_hygiene_rank: outsideSurvivor ? survivors.indexOf(outsideSurvivor) + 1 : null,
        final_review_rank: outsideFinal?.final_rank ?? null,
        entered_survivor_pool: Boolean(outsideSurvivor),
        entered_final_review: Boolean(outsideFinal)
      },
      baseline_final_identity_count: baselineFinal ? baselineFinal.length : null
    };
  }
  const first = dense.find(row => row.gold_grade >= 2);
  const rawKRequired = CANDIDATE_K_LADDER.find(depth => depths[String(depth)].first_grade_ge_2.entered_final_review) ?? null;
  const rawKRequiredOutsideFinal = CANDIDATE_K_LADDER.find(depth => depths[String(depth)].first_grade_ge_2_outside_top20.entered_final_review) ?? null;
  return {
    case_id: caseGold.case_id,
    requirement_id: caseGold.requirement_id,
    governance_split: caseGold.split === 'UNTOUCHED_HOLDOUT_SET' ? 'DEVELOPMENT_VALIDATION_SET' : caseGold.split,
    former_gold_split: caseGold.split,
    profile_class: caseGold.profile_class,
    case_class: caseGold.case_class,
    expected,
    first_grade_ge_2_dense_rank: first?.dense_rank ?? null,
    first_grade_ge_2_outside_top20_dense_rank: dense.find(row => row.dense_rank > 20 && row.gold_grade >= 2)?.dense_rank ?? null,
    raw_candidate_k_required_for_entry: rawKRequired,
    raw_candidate_k_required_for_survivor_entry: CANDIDATE_K_LADDER.find(depth => itemDepthHasOutsideSurvivor(depths[String(depth)])) ?? null,
    raw_candidate_k_required_for_gt20_final_review_entry: rawKRequiredOutsideFinal,
    depths
  };
}
function itemDepthHasOutsideSurvivor(depth) {
  return depth.first_grade_ge_2_outside_top20?.entered_survivor_pool === true;
}
function aggregate(cases, depth, k) {
  const values = cases.map(item => item.depths[String(depth)].final_metrics_at_k[String(k)]);
  const avg = field => mean(values.map(item => item[field]).filter(value => value !== null));
  const expectedK0 = values.filter(item => item.expected_retrieval_k0);
  const expectedNonK0 = values.filter(item => !item.expected_retrieval_k0);
  return {
    case_count: values.length,
    evidence_atom_recall: avg('evidence_atom_recall'),
    candidate_precision: avg('candidate_precision'),
    ndcg: avg('ndcg'),
    expected_retrieval_k0_count: expectedK0.length,
    expected_no_sufficient_evidence_count: values.filter(item => item.expected_no_sufficient_evidence).length,
    false_positive_retrieval_candidate_rate: expectedK0.length ? num(expectedK0.filter(item => item.false_positive_retrieval_candidate).length / expectedK0.length) : null,
    false_negative_retrieval_k0_rate: expectedNonK0.length ? num(expectedNonK0.filter(item => item.false_negative_retrieval_k0).length / expectedNonK0.length) : null
  };
}
function meanFinalMrr(cases, depth) {
  const values = cases.map(item => item.depths[String(depth)].mrr_final_at_8);
  return { value: mean(values), hit_count: values.filter(value => value > 0).length, case_count: values.length, contract: 'MRR_FINAL@8; misses contribute 0; final-review set is capped at 8' };
}
function rawMrr(cases, depth) {
  const values = cases.map(item => item.depths[String(depth)].mrr_raw_at_depth);
  return { value: mean(values), hit_count: values.filter(value => value > 0).length, case_count: values.length, metric: `MRR_RAW@${depth}`, contract: 'dense raw candidate pool only; never mixed with final-review MRR' };
}
function depthAggregate(cases, depth) {
  const finalCounts = cases.map(item => item.depths[String(depth)].final_returned_candidate_count);
  const rawCounts = cases.map(item => item.depths[String(depth)].raw_candidate_count);
  const filtered = cases.map(item => item.depths[String(depth)].hygiene_filtered_count);
  const survivors = cases.map(item => item.depths[String(depth)].hygiene_survivor_count);
  const enteringSurvivors = cases.flatMap(item => item.depths[String(depth)].grade_gte_2_entering_from_gt20.candidates_in_survivor_pool.map(candidate => ({ ...candidate, case_id: item.case_id, requirement_id: item.requirement_id })));
  const enteringFinal = cases.flatMap(item => item.depths[String(depth)].grade_gte_2_entering_from_gt20.candidates_in_final_review.map(candidate => ({ ...candidate, case_id: item.case_id, requirement_id: item.requirement_id })));
  return {
    candidate_k: depth,
    raw_candidate_count: { total: rawCounts.reduce((a, b) => a + b, 0), mean: mean(rawCounts), per_case: rawCounts },
    hygiene_filtered_count: { total: filtered.reduce((a, b) => a + b, 0), mean: mean(filtered), per_case: filtered },
    hygiene_survivor_count: { total: survivors.reduce((a, b) => a + b, 0), mean: mean(survivors), min: Math.min(...survivors), max: Math.max(...survivors), per_case: survivors },
    final_returned_candidate_count: { total: finalCounts.reduce((a, b) => a + b, 0), mean: mean(finalCounts), min: Math.min(...finalCounts), max: Math.max(...finalCounts), per_case: finalCounts },
    final_pool_fill_rate: mean(cases.map(item => item.depths[String(depth)].final_pool_fill_rate)),
    cases_final_pool_lt_8: cases.filter(item => item.depths[String(depth)].final_pool_underfilled).length,
    raw_to_final_survival_ratio: num(finalCounts.reduce((a, b) => a + b, 0) / rawCounts.reduce((a, b) => a + b, 0)),
    grade_gte_2_entering_from_gt20: { raw_pool_entry_count: enteringSurvivors.length, post_hygiene_survivor_count: enteringSurvivors.length, post_hygiene_case_count: new Set(enteringSurvivors.map(item => item.case_id)).size, final_review_candidate_count: enteringFinal.length, final_review_case_count: new Set(enteringFinal.map(item => item.case_id)).size, candidates_in_survivor_pool: enteringSurvivors, candidates_in_final_review: enteringFinal },
    metrics_at_k: Object.fromEntries(METRIC_K_VALUES.map(k => [String(k), aggregate(cases, depth, k)])),
    mrr_final_at_8: meanFinalMrr(cases, depth),
    mrr_raw_at_depth: rawMrr(cases, depth)
  };
}
function caseMetric(cases, depth, k, field) { return cases.map(item => item.depths[String(depth)].final_metrics_at_k[String(k)][field]); }
function regressionForDepth(cases, depth) {
  const base = cases.map(item => item.depths['20']);
  const challenger = cases.map(item => item.depths[String(depth)]);
  const noGoldGrade2Removed = cases.every(item => {
    const baseline = new Set(item.depths['20'].final_candidates.map(candidate => `${candidate.material_id}|${candidate.source_chunk_id}|${candidate.source_chunk_hash}`));
    const challengerCandidates = new Set(item.depths[String(depth)].final_candidates.map(candidate => `${candidate.material_id}|${candidate.source_chunk_id}|${candidate.source_chunk_hash}`));
    return [...baseline].every(key => challengerCandidates.has(key));
  });
  const noRecallRegressionAt5 = cases.every(item => (item.depths[String(depth)].final_metrics_at_k['5'].evidence_atom_recall ?? 0) >= (item.depths['20'].final_metrics_at_k['5'].evidence_atom_recall ?? 0));
  const noRecallRegressionAt8 = cases.every(item => (item.depths[String(depth)].final_metrics_at_k['8'].evidence_atom_recall ?? 0) >= (item.depths['20'].final_metrics_at_k['8'].evidence_atom_recall ?? 0));
  const productCases = cases.filter(item => item.profile_class === 'PRODUCT_CAPABILITY' && item.depths['20'].final_metrics_at_k['8'].evidence_atom_recall !== null);
  const productCapabilityNoRegression = productCases.every(item => (item.depths[String(depth)].final_metrics_at_k['8'].evidence_atom_recall ?? 0) >= (item.depths['20'].final_metrics_at_k['8'].evidence_atom_recall ?? 0));
  const enteringAtoms = cases.reduce((sum, item) => sum + item.depths[String(depth)].grade_gte_2_entering_from_gt20.atom_count, 0);
  const finalPoolUnderfillReduction = cases.filter(item => item.depths['20'].final_pool_underfilled).length - cases.filter(item => item.depths[String(depth)].final_pool_underfilled).length;
  return {
    depth,
    no_frozen_grade_gte_2_candidate_removed: noGoldGrade2Removed,
    recall_at_5_no_regression: noRecallRegressionAt5,
    recall_at_8_no_regression: noRecallRegressionAt8,
    product_capability_success_no_regression: productCapabilityNoRegression,
    product_capability_case_ids: productCases.map(item => item.requirement_id),
    grade_gte_2_entering_from_gt20_count: cases.reduce((sum, item) => sum + item.depths[String(depth)].grade_gte_2_entering_from_gt20.final_review_candidate_count, 0),
    grade_gte_2_post_hygiene_survivor_entry_count: cases.reduce((sum, item) => sum + item.depths[String(depth)].grade_gte_2_entering_from_gt20.post_hygiene_survivor_count, 0),
    missing_atom_entered_final_review_count: enteringAtoms,
    final_pool_underfill_reduction: finalPoolUnderfillReduction,
    all_regression_gates_pass: noGoldGrade2Removed && noRecallRegressionAt5 && noRecallRegressionAt8 && productCapabilityNoRegression,
    gate_e_missing_atom_pass: enteringAtoms > 0
  };
}
function selectionEvaluation(cases, aggregates, regressions) {
  const dev = cases.filter(item => item.governance_split === 'DEVELOPMENT_VALIDATION_SET');
  const devAgg = Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), depthAggregate(dev, depth)]));
  const base = devAgg['20'];
  const reference = devAgg['64'];
  const gain = depth => {
    const candidate = devAgg[String(depth)];
    const recallDelta = num((candidate.metrics_at_k['8'].evidence_atom_recall ?? 0) - (base.metrics_at_k['8'].evidence_atom_recall ?? 0));
    const ndcgDelta = num((candidate.metrics_at_k['8'].ndcg ?? 0) - (base.metrics_at_k['8'].ndcg ?? 0));
    const referenceRecallGain = Math.max(0, (reference.metrics_at_k['8'].evidence_atom_recall ?? 0) - (base.metrics_at_k['8'].evidence_atom_recall ?? 0));
    const referenceNdcgGain = Math.max(0, (reference.metrics_at_k['8'].ndcg ?? 0) - (base.metrics_at_k['8'].ndcg ?? 0));
    const usefulGain = Math.max(0, recallDelta) + Math.max(0, ndcgDelta);
    const referenceUsefulGain = referenceRecallGain + referenceNdcgGain;
    const saturationRatio = referenceUsefulGain > 0 ? num(usefulGain / referenceUsefulGain) : null;
    const materialGain = (recallDelta > 0 || ndcgDelta > 0) && regressions[String(depth)].missing_atom_entered_final_review_count > 0;
    const underfillReduced = regressions[String(depth)].final_pool_underfill_reduction > 0;
    const capturesEssentialGain = referenceUsefulGain === 0 || saturationRatio >= 0.9;
    const qualifies = regressions[String(depth)].all_regression_gates_pass && regressions[String(depth)].gate_e_missing_atom_pass && materialGain && underfillReduced && capturesEssentialGain;
    return { depth, recall_at_8_delta: recallDelta, ndcg_at_8_delta: ndcgDelta, material_gain: materialGain, underfill_reduced: underfillReduced, useful_gain_score: num(usefulGain), reference_useful_gain_score: num(referenceUsefulGain), saturation_ratio_vs_r64: saturationRatio, captures_essential_gain: capturesEssentialGain, qualifies };
  };
  const evaluations = Object.fromEntries(CHALLENGER_DEPTHS.map(depth => [String(depth), gain(depth)]));
  const selected = CHALLENGER_DEPTHS.find(depth => evaluations[String(depth)].qualifies) ?? null;
  const r64OnlyMaterial = !selected && (reference.metrics_at_k['8'].evidence_atom_recall > base.metrics_at_k['8'].evidence_atom_recall || reference.metrics_at_k['8'].ndcg > base.metrics_at_k['8'].ndcg) && regressions['64'].missing_atom_entered_final_review_count > 0;
  const recommendation = selected ? 'BOUNDED_OVERFETCH_PRODUCTION_CANDIDATE' : (r64OnlyMaterial ? 'P1_STRUCTURE_INDEX_CONSTRUCTION_CHALLENGER' : 'NO_CHANGE_YET');
  const saturationPoint = selected ?? (r64OnlyMaterial ? '64_DIAGNOSTIC_ONLY' : 'NONE');
  return {
    selection_contract_version: 'P1C_DEVELOPMENT_SELECTION_V1',
    selection_contract: 'Smallest challenger in 32/48 that passes all regression gates, admits at least one previously Top20-truncated Gold atom into final review, reduces underfill, and captures >=90% of the combined positive Recall@8+nDCG@8 gain available at R64. The selected value is development-only and is not a production config or release threshold.',
    development_selected_candidate_k: selected,
    r64_diagnostic_only: true,
    overfetch_gain_saturation_point: saturationPoint,
    development_validation_case_count: dev.length,
    development_metrics_by_depth: devAgg,
    challenger_evaluations: evaluations,
    r64_only_material_gain: r64OnlyMaterial,
    bounded_overfetch_too_deep_for_direct_promotion: r64OnlyMaterial,
    recommendation_candidate: recommendation
  };
}
function buildSpecialDiagnostics(cases) {
  return SPECIAL_REQUIREMENT_IDS.map(requirementId => {
    const item = cases.find(candidate => candidate.requirement_id === requirementId);
    assert(item, 'SPECIAL_CASE_MISSING', { requirementId });
    return {
      requirement_id: requirementId,
      case_id: item.case_id,
      first_grade_gte_2_dense_rank: item.first_grade_ge_2_dense_rank,
      first_grade_gte_2_outside_top20_dense_rank: item.first_grade_ge_2_outside_top20_dense_rank,
      raw_candidate_k_required_for_entry: item.raw_candidate_k_required_for_entry,
      raw_candidate_k_required_for_survivor_entry: item.raw_candidate_k_required_for_survivor_entry,
      raw_candidate_k_required_for_gt20_final_review_entry: item.raw_candidate_k_required_for_gt20_final_review_entry,
      post_hygiene_rank_by_depth: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), item.depths[String(depth)].first_grade_ge_2.post_hygiene_rank])),
      final_review_rank_by_depth: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), item.depths[String(depth)].first_grade_ge_2.final_review_rank])),
      outside_top20_post_hygiene_rank_by_depth: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), item.depths[String(depth)].first_grade_ge_2_outside_top20.post_hygiene_rank])),
      outside_top20_final_review_rank_by_depth: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), item.depths[String(depth)].first_grade_ge_2_outside_top20.final_review_rank])),
      atom_recall_at_8_by_depth: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), item.depths[String(depth)].final_metrics_at_k['8'].evidence_atom_recall])),
      atom_recall_movement_vs_r0_at_8: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), num((item.depths[String(depth)].final_metrics_at_k['8'].evidence_atom_recall ?? 0) - (item.depths['20'].final_metrics_at_k['8'].evidence_atom_recall ?? 0))]))
    };
  });
}
function safetyReport(cases, sourcesRows) {
  const all = cases.flatMap(item => item.depths['64'].final_candidates);
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
    corpus_mutations: 0,
    authority_changes: 0,
    lineage_changes: 0
  };
}
function buildReplay({ gold, snapshot, sourceByKey, queries, sourcesRows, p1bFreeze }) {
  const queryByRequirement = new Map(queries.map(row => [row.requirement_id, row]));
  const cases = gold.cases.map(caseGold => buildCase(caseGold, queryByRequirement.get(caseGold.requirement_id), snapshot, sourceByKey, gold));
  const aggregates = Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), depthAggregate(cases, depth)]));
  const regressions = Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), regressionForDepth(cases, depth)]));
  const selection = selectionEvaluation(cases, aggregates, regressions);
  return {
    artifact_type: 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_REPLAY_V1',
    artifact_version: 'v1',
    status: 'P1C_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING',
    execution_mode: 'EVAL_ENGINEERING_CHALLENGER_ONLY',
    experiment_id: EXPERIMENT_ID,
    p1c_scope: 'BOUNDED_OVERFETCH_BEFORE_EXISTING_PRODUCTION_HYGIENE_ONLY',
    frozen_candidate_k_ladder: [...CANDIDATE_K_LADDER],
    final_k: FINAL_K,
    full_corpus_candidate_retrieval: false,
    max_candidate_depth_used: 64,
    current_production_shape: 'raw dense Top20 -> existing Production Hygiene -> existing raw-vector fallback -> final Top8',
    challenger_shape: 'raw dense candidateK -> existing Production Hygiene -> existing raw-vector fallback -> final Top8',
    existing_production_hygiene: { version: RETRIEVAL_CHUNK_ROLE_VERSION, new_hygiene_rules: 0, p1a_rule_changed: 0, p1a_rule_hash: P1A_RULE_HASH },
    query_batch_freeze: { path: relative(QUERY_BATCH_FREEZE_PATH), p1b_source_path: relative(P1B_QUERY_FREEZE_PATH), p1b_source_sha256: sha256File(P1B_QUERY_FREEZE_PATH).toUpperCase(), exact_case_order_preserved: true, all_query_vectors_loaded_before_replay: true },
    candidate_pool_metrics_by_depth: aggregates,
    R0: aggregates['20'],
    R32: aggregates['32'],
    R48: aggregates['48'],
    R64: aggregates['64'],
    raw_pool_diagnostics: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), aggregates[String(depth)].mrr_raw_at_depth])),
    MRR_FINAL_AT_8_BY_DEPTH: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), aggregates[String(depth)].mrr_final_at_8])),
    RAW_MRR_DIAGNOSTICS: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [`MRR_RAW@${depth}`, aggregates[String(depth)].mrr_raw_at_depth])),
    FINAL_POOL_FILL_RATE_BY_DEPTH: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), aggregates[String(depth)].final_pool_fill_rate])),
    GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), aggregates[String(depth)].grade_gte_2_entering_from_gt20])),
    RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH: Object.fromEntries(CANDIDATE_K_LADDER.map(depth => [String(depth), aggregates[String(depth)].raw_to_final_survival_ratio])),
    special_case_diagnostic: buildSpecialDiagnostics(cases),
    regression_gates: regressions,
    selection,
    development_selected_candidate_k: selection.development_selected_candidate_k,
    R64_DIAGNOSTIC_ONLY: selection.r64_diagnostic_only,
    OVERFETCH_GAIN_SATURATION_POINT: selection.overfetch_gain_saturation_point,
    cases,
    metric_contract: {
      final_review_metrics: 'Evidence Atom Recall, Candidate Precision, nDCG at final K=1/3/5/8; MRR_FINAL@8 is the downstream-visible final-review MRR only.',
      raw_pool_metrics: 'Raw dense diagnostics are named MRR_RAW@20, MRR_RAW@32, MRR_RAW@48, MRR_RAW@64 and are never mixed with MRR_FINAL@8.',
      mrr_final_at_8: 'Mean reciprocal rank of the first frozen Gold grade >=2 candidate in final returned Top8; misses contribute 0 over all cases.',
      candidate_precision: 'Frozen Gold grade >=2 candidates divided by requested final K; denominator remains requested K when final pool is short.',
      matcher: `${MATCHER_VERSION}/${MATCHER_HASH}`
    },
    safety: safetyReport(cases, sourcesRows),
    provider_calls: 0,
    embedding_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    production_retrieval_changes: 0,
    gold_mutations: 0,
    corpus_mutations: 0,
    p1b_gate_reviewed: 'GPT_OVERRIDE_P1A_NEEDS_BOUNDED_OVERFETCH',
    deterministic_content_hash: null
  };
}
function renderMarkdown(checkpoint, replay) {
  const lines = [
    '# V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1',
    '',
    `- Status: **${checkpoint.status}**`,
    '- Mode: **EVAL / ENGINEERING CHALLENGER ONLY**; no Production Retrieval change.',
    `- Frozen candidateK ladder: **${CANDIDATE_K_LADDER.join(' / ')}**; final K: **${FINAL_K}**.`,
    '- Shape: raw dense candidateK → existing Production Hygiene → existing fallback → final Top8.',
    '- New Hygiene rules: **0**; Provider calls: **0**; Embedding calls: **0**; LLM calls: **0**.',
    '',
    '## Final-review metrics',
    '',
    '| Depth | K | Evidence Atom Recall | Candidate Precision | nDCG |',
    '|---:|---:|---:|---:|---:|',
    ...CANDIDATE_K_LADDER.flatMap(depth => METRIC_K_VALUES.map(k => {
      const row = replay.candidate_pool_metrics_by_depth[String(depth)].metrics_at_k[String(k)];
      return `| ${depth} | ${k} | ${row.evidence_atom_recall ?? 'n/a'} | ${row.candidate_precision ?? 'n/a'} | ${row.ndcg ?? 'n/a'} |`;
    })),
    '',
    '## MRR and pool diagnostics',
    '',
    `- MRR_FINAL@8 by depth: **${JSON.stringify(replay.MRR_FINAL_AT_8_BY_DEPTH)}**`,
    `- Raw diagnostics: **${JSON.stringify(replay.RAW_MRR_DIAGNOSTICS)}**`,
    `- FINAL_POOL_FILL_RATE_BY_DEPTH: **${JSON.stringify(replay.FINAL_POOL_FILL_RATE_BY_DEPTH)}**`,
    `- RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH: **${JSON.stringify(replay.RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH)}**`,
    `- GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH: **${JSON.stringify(replay.GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH)}**`,
    '',
    '## Selection and gates',
    '',
    `- DEVELOPMENT_SELECTED_CANDIDATE_K: **${replay.development_selected_candidate_k ?? 'NONE'}**`,
    `- R64_DIAGNOSTIC_ONLY: **${replay.R64_DIAGNOSTIC_ONLY}**`,
    `- OVERFETCH_GAIN_SATURATION_POINT: **${replay.OVERFETCH_GAIN_SATURATION_POINT}**`,
    `- Recommendation candidate: **${replay.selection.recommendation_candidate}**`,
    `- Selection contract: ${replay.selection.selection_contract}`,
    '',
    '## Special diagnostics',
    '',
    ...replay.special_case_diagnostic.map(item => `- ${item.requirement_id}: overall first grade≥2 dense rank ${item.first_grade_gte_2_dense_rank ?? 'NONE'}; Top20-external first dense rank ${item.first_grade_gte_2_outside_top20_dense_rank ?? 'NONE'}; raw K to survivor ${item.raw_candidate_k_required_for_survivor_entry ?? 'NONE'}; overall final rank by depth ${JSON.stringify(item.final_review_rank_by_depth)}; Top20-external final rank by depth ${JSON.stringify(item.outside_top20_final_review_rank_by_depth)}; Recall@8 movement ${JSON.stringify(item.atom_recall_movement_vs_r0_at_8)}.`),
    '',
    '## Safety',
    '',
    '- Scope, authority, quarantine, enterprise, lineage, Gold, corpus, DB, Fact, Mapping, Claim, and Writer boundaries are unchanged.',
    `- Safety report: **${JSON.stringify(replay.safety)}**`,
    '',
    'STOP FOR GPT REVIEW. Do not implement the recommendation.',
    ''
  ];
  return lines.join('\n');
}

async function main() {
  const gold = readJson(GOLD_PATH);
  const snapshot = readJson(SNAPSHOT_PATH);
  const supplement = readJson(SUPPLEMENT_PATH);
  const p0Checkpoint = readJson(P0_CHECKPOINT_PATH);
  const p1bFreeze = readJson(P1B_QUERY_FREEZE_PATH);
  const p1bReplay = readJson(P1B_REPLAY_PATH);
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO_ROOT });
  const sourcesRows = validateFrozenInputs({ gold, snapshot, supplement, sources, p0Checkpoint, p1bFreeze, p1bReplay });
  assert(deterministicContentHash(MATCHER_CONTRACT) === MATCHER_HASH, 'MATCHER_HASH_DRIFT', { observed: deterministicContentHash(MATCHER_CONTRACT), expected: MATCHER_HASH });
  const queries = buildQueries(gold, snapshot, supplement);
  const expectedOrder = p1bFreeze.exact_case_order.map(({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source }) => ({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source }));
  const observedOrder = queries.map(({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source }) => ({ ordinal, case_id, requirement_id, query_text, query_hash, vector_source }));
  assert(JSON.stringify(observedOrder) === JSON.stringify(expectedOrder), 'P1B_QUERY_ORDER_OR_HASH_DRIFT');
  const queryBatchFreeze = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_QUERY_BATCH_FREEZE_V1',
    artifact_version: 'v1',
    status: 'FROZEN_BEFORE_P1C_REPLAY',
    experiment_id: EXPERIMENT_ID,
    frozen_candidate_k_ladder: [...CANDIDATE_K_LADDER],
    final_k: FINAL_K,
    exact_case_order: observedOrder,
    query_count: queries.length,
    gold_projection_version: GOLD_PROJECTION_VERSION,
    evidence_matcher_version: MATCHER_VERSION,
    evidence_matcher_hash: MATCHER_HASH,
    p1b_query_batch_freeze_sha256: sha256File(P1B_QUERY_FREEZE_PATH).toUpperCase(),
    all_query_vectors_loaded_before_retrieval_inspection: true,
    provider_calls: 0,
    embedding_calls: 0,
    llm_calls: 0,
    deterministic_content_hash: null
  };
  queryBatchFreeze.deterministic_content_hash = deterministicContentHash(queryBatchFreeze, ['deterministic_content_hash']);
  writeJson(QUERY_BATCH_FREEZE_PATH, queryBatchFreeze);
  const sourceByKey = sourceIndex(sources);
  const build = () => buildReplay({ gold, snapshot, sourceByKey, queries, sourcesRows, p1bFreeze });
  const replay1 = build();
  const replay2 = build();
  assert(deterministicContentHash(replay1) === deterministicContentHash(replay2), 'P1C_REPLAY_PARITY_DRIFT');
  replay1.query_batch_freeze.file_sha256 = sha256File(QUERY_BATCH_FREEZE_PATH).toUpperCase();
  replay1.query_batch_freeze.deterministic_content_hash = queryBatchFreeze.deterministic_content_hash;
  replay1.deterministic_content_hash = deterministicContentHash(replay1, ['deterministic_content_hash']);
  writeJson(REPLAY_PATH, replay1);
  const checkpoint = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1',
    artifact_version: 'v1',
    status: 'P1C_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING',
    execution_mode: 'EVAL_ENGINEERING_CHALLENGER_ONLY',
    decision: 'V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_V1',
    p1b_review: { P1B_ENGINEERING_VALIDATION: 'PASS', CODEX_GATE_RESULT: 'P1A_PRODUCTION_SAFE_AS_IS', GPT_GATE_RESULT: 'P1A_NEEDS_BOUNDED_OVERFETCH', P1A_PRODUCTION_PROMOTION: 'NOT_AUTHORIZED' },
    frozen_candidate_k_ladder: [...CANDIDATE_K_LADDER],
    baseline_identity: { snapshot_id: SNAPSHOT_ID, snapshot_file_sha256: SNAPSHOT_SHA256, material_count: 9, chunk_count: 94, embedding_provider: PROVIDER_HOST, embedding_model: MODEL, vector_dimension: DIMENSION },
    corpus_identity: { loader: relative(path.join(REPO_ROOT, 'backend/eval/real-e2e/chengchuan-evidence-source-loader.mjs')), source_chunk_count: sourcesRows.length, source_identity_sha256: sha256Text(JSON.stringify(sourcesRows.map(row => ({ material_id: row.material_id, chunk_id: row.chunk_id, chunk_hash: row.chunk_hash })))) },
    gold_identity: { path: relative(GOLD_PATH), file_sha256: GOLD_SHA256, authority: gold.authority, status: gold.status, semantic_gold_mutated: false, projection_version: GOLD_PROJECTION_VERSION },
    evidence_matcher: { version: MATCHER_VERSION, hash: MATCHER_HASH, contract: MATCHER_CONTRACT },
    query_batch_freeze: { path: relative(QUERY_BATCH_FREEZE_PATH), file_sha256: sha256File(QUERY_BATCH_FREEZE_PATH).toUpperCase(), deterministic_content_hash: queryBatchFreeze.deterministic_content_hash, exact_case_order_frozen: true, all_query_vectors_loaded_before_retrieval_inspection: true },
    existing_production_hygiene: { version: RETRIEVAL_CHUNK_ROLE_VERSION, p1a_rule_version: P1A_RULE_VERSION, p1a_rule_hash: P1A_RULE_HASH, new_hygiene_rules: 0 },
    production_shape: { raw_candidate_k: 20, current_hygiene_position: 'POST_TRUNCATION', current_slot_replenishment: 'NO', final_k: FINAL_K, additional_vector_db_call: false },
    full_corpus_candidate_retrieval: false,
    max_candidate_depth_used: 64,
    production_shape_replay: { path: relative(REPLAY_PATH), file_sha256: sha256File(REPLAY_PATH).toUpperCase(), metrics_by_depth: replay1.candidate_pool_metrics_by_depth, R0: replay1.R0, R32: replay1.R32, R48: replay1.R48, R64: replay1.R64 },
    MRR_FINAL_AT_8_BY_DEPTH: replay1.MRR_FINAL_AT_8_BY_DEPTH,
    RAW_MRR_DIAGNOSTICS: replay1.RAW_MRR_DIAGNOSTICS,
    FINAL_POOL_FILL_RATE_BY_DEPTH: replay1.FINAL_POOL_FILL_RATE_BY_DEPTH,
    GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH: replay1.GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH,
    RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH: replay1.RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH,
    special_case_diagnostic: replay1.special_case_diagnostic,
    regression_gates: replay1.regression_gates,
    DEVELOPMENT_SELECTED_CANDIDATE_K: replay1.development_selected_candidate_k,
    R64_DIAGNOSTIC_ONLY: replay1.R64_DIAGNOSTIC_ONLY,
    OVERFETCH_GAIN_SATURATION_POINT: replay1.OVERFETCH_GAIN_SATURATION_POINT,
    next_recommendation_candidate: replay1.selection.recommendation_candidate,
    selection: replay1.selection,
    safety: { ...replay1.safety, provider_calls: 0, embedding_calls: 0, llm_calls: 0, production_retrieval_changes: 0 },
    reproducibility: { replay_parity: true, replay_hash: replay1.deterministic_content_hash, query_batch_freeze_hash: queryBatchFreeze.deterministic_content_hash },
    stop_conditions: ['Do not implement bounded overfetch yet.', 'Do not convert DEVELOPMENT_SELECTED_CANDIDATE_K into a production config or release threshold.', 'Do not use R64 as a direct Production candidate.', 'Do not start P2, P3, P4, MMR, hybrid, or reranker.', 'Do not treat retrieved candidates as supported evidence or claim authorization.'],
    deterministic_content_hash: null
  };
  checkpoint.deterministic_content_hash = deterministicContentHash(checkpoint, ['deterministic_content_hash']);
  writeJson(CHECKPOINT_PATH, checkpoint);
  fs.mkdirSync(path.dirname(CHECKPOINT_MD_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_MD_PATH, renderMarkdown(checkpoint, replay1), 'utf8');
  console.log(JSON.stringify({ status: checkpoint.artifact_type, checkpoint: relative(CHECKPOINT_PATH), replay: relative(REPLAY_PATH), query_batch_freeze: relative(QUERY_BATCH_FREEZE_PATH), DEVELOPMENT_SELECTED_CANDIDATE_K: replay1.development_selected_candidate_k, R64_DIAGNOSTIC_ONLY: replay1.R64_DIAGNOSTIC_ONLY, OVERFETCH_GAIN_SATURATION_POINT: replay1.OVERFETCH_GAIN_SATURATION_POINT, next_recommendation_candidate: replay1.selection.recommendation_candidate, provider_calls: 0, embedding_calls: 0, llm_calls: 0, production_retrieval_changes: 0, replay_parity: true }, null, 2));
}

try { await main(); } catch (error) {
  console.error(JSON.stringify({ status: error.code || 'P1C_BOUNDED_OVERFETCH_CHALLENGER_FAILED', reason: error.message, details: error.details || {} }, null, 2));
  process.exitCode = 1;
}
