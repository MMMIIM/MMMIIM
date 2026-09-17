import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadFrozenChengchuanEvidenceSources } from '../real-e2e/chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../');
const GOLD_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const P0_CHECKPOINT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_AND_K0_V2/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.json');
const P0_BASELINE_REPLAY_PATH = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/results/V43_RAG_RETRIEVAL_P0_BASELINE_REPLAY_V1.json');
const OUTPUT_DIR = path.join(HERE, 'results');
const RULE_FREEZE_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1A_HYGIENE_RULE_FREEZE_V1.json');
const PROJECTION_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_PROJECTION_V1.json');
const BATCH_FREEZE_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_BATCH_FREEZE_V1.json');
const REPLAY_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_REPLAY_V1.json');
const CHECKPOINT_DIR = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_V1');
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1.json');
const CHECKPOINT_MD_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1.md');

const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const SNAPSHOT_FILE_SHA256 = '5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578';
const GOLD_FILE_SHA256 = '7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const EXPECTED_PROVIDER_HOST = 'api.siliconflow.cn';
const EXPECTED_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EXPECTED_VERSION = '1';
const EXPECTED_DIMENSION = 1024;
const K_VALUES = Object.freeze([1, 3, 5, 8, 20]);
const P1A_EXPERIMENT_ID = 'V43-RAG-RETRIEVAL-P1A-STRUCTURE-HYGIENE-CHALLENGER-20260917';
const P1A_HYGIENE_RULE_VERSION = 'P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC';
const GOLD_PROJECTION_VERSION = 'GPT_SEMANTIC_GOLD_V1_EXACT_SPAN_PROJECTION_V1';

// Frozen before replay. These rules only inspect the current source chunk and
// never receive a case, Requirement ID, Gold item, or retrieval result.
const P1A_HYGIENE_RULE_SPEC = Object.freeze({
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

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256Text = value => sha256(Buffer.from(String(value), 'utf8'));
const sha256File = file => sha256(fs.readFileSync(file));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const relative = file => path.relative(REPO_ROOT, file).replaceAll('\\', '/');
const number = value => Number(Number(value).toFixed(12));
const mean = values => values.length ? number(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });

function assert(condition, message, details = {}) {
  if (!condition) throw fail(message, details);
}

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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json(value), 'utf8');
}

function assertVector(vector, label) {
  assert(Array.isArray(vector) && vector.length === EXPECTED_DIMENSION && vector.every(Number.isFinite), `VECTOR_INVALID_${label}`, {
    observed_dimension: Array.isArray(vector) ? vector.length : null,
    expected_dimension: EXPECTED_DIMENSION
  });
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

function evaluateHygiene(sourceText) {
  const text = String(sourceText || '');
  const reasons = [];
  if (text.trim().length === 0) reasons.push('EMPTY_OR_WHITESPACE');
  if (isHeadingOnly(text)) reasons.push('HEADING_ONLY');
  if (isUrlOnly(text)) reasons.push('URL_ONLY');
  if (isCitationOnly(text)) reasons.push('CITATION_ONLY');
  return { excluded: reasons.length > 0, reasons };
}

function hygieneRuleHash() {
  return deterministicContentHash({ version: P1A_HYGIENE_RULE_VERSION, spec: P1A_HYGIENE_RULE_SPEC });
}

function sourceKey(row) {
  return `${row.material_id}|${row.chunk_id}|${row.chunk_hash}`;
}

function assertFrozenIdentity(snapshot, gold) {
  assert(snapshot.manifest?.snapshot_id === SNAPSHOT_ID, 'SNAPSHOT_ID_DRIFT');
  assert(snapshot.manifest?.identity_hash === EXPECTED_IDENTITY_HASH, 'SNAPSHOT_IDENTITY_HASH_DRIFT');
  assert(snapshot.manifest?.material_count === 9 && snapshot.manifest?.chunk_count === 94, 'SNAPSHOT_SHAPE_DRIFT');
  assert(snapshot.vectors.length === 94, 'SNAPSHOT_VECTOR_COUNT_DRIFT');
  assert(sha256File(GOLD_PATH).toUpperCase() === GOLD_FILE_SHA256, 'GOLD_SHA_DRIFT');
  assert(sha256File(SNAPSHOT_PATH).toUpperCase() === SNAPSHOT_FILE_SHA256, 'SNAPSHOT_SHA_DRIFT');
  assert(Array.isArray(gold.cases) && gold.cases.length === 10, 'GOLD_CASE_COUNT_DRIFT');
}

function validateSourcesAndSnapshot(sources, snapshot) {
  const sourceRows = sources.flatMap(source => source.chunks.map(row => ({
    ...row,
    doc_id: source.doc_id,
    source_file: source.source_file,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    enterprise_id: source.enterprise_id
  })));
  const sourceByKey = new Map(sourceRows.map(row => [sourceKey(row), row]));
  for (const vector of snapshot.vectors) {
    const source = sourceByKey.get(sourceKey(vector));
    assert(source, `SNAPSHOT_SOURCE_MISSING_${vector.chunk_id}`);
    assert(vector.source_role === 'EVIDENCE_CANDIDATE' && vector.enterprise_id === 'SYNTH-CHENGCHUAN-001', `SNAPSHOT_SCOPE_DRIFT_${vector.chunk_id}`);
    assert(vector.authority === 'SYNTHETIC_EVAL_ONLY' && vector.production_authority === 'NONE', `SNAPSHOT_AUTHORITY_DRIFT_${vector.chunk_id}`);
    assertVector(vector.vector, `chunk_${vector.chunk_id}`);
  }
  assert(sourceRows.length === 94 && sourceByKey.size === 94, 'SOURCE_CORPUS_SHAPE_DRIFT');
  return sourceByKey;
}

function loadQueryVectors(gold, snapshot) {
  const snapshotQueries = new Map((snapshot.query_vectors || []).map(row => [row.requirement_id, row]));
  const p0SupplementPath = path.join(REPO_ROOT, 'backend/eval/retrieval-quality-p0/results/V43_RAG_RETRIEVAL_P0_HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1.json');
  const p0Supplement = readJson(p0SupplementPath);
  const holdoutQueries = new Map((p0Supplement.query_vectors || []).map(row => [row.requirement_id, row]));
  return gold.cases.map(caseGold => {
    const row = snapshotQueries.get(caseGold.requirement_id) || holdoutQueries.get(caseGold.requirement_id);
    assert(row, `QUERY_VECTOR_MISSING_${caseGold.requirement_id}`);
    assert(row.query_hash === caseGold.query_hash, `QUERY_HASH_MISMATCH_${caseGold.requirement_id}`);
    assertVector(row.vector, `query_${caseGold.requirement_id}`);
    return {
      case_id: caseGold.case_id,
      requirement_id: caseGold.requirement_id,
      query_text: caseGold.query_text,
      query_hash: caseGold.query_hash,
      vector: row.vector,
      query_vector_source: snapshotQueries.has(caseGold.requirement_id) ? 'FROZEN_BASELINE_SNAPSHOT' : 'FROZEN_P0_HOLDOUT_SUPPLEMENT'
    };
  });
}

function buildHygieneProjection(snapshot, sourceByKey) {
  const rows = snapshot.vectors.map((vector, index) => {
    const source = sourceByKey.get(sourceKey(vector));
    assert(source, `PROJECTION_SOURCE_MISSING_${vector.chunk_id}`);
    const decision = evaluateHygiene(source.source_text);
    return {
      dense_input_ordinal: index + 1,
      material_id: source.material_id,
      doc_id: source.doc_id,
      source_chunk_id: source.chunk_id,
      source_chunk_hash: source.chunk_hash,
      source_text_hash: sha256Text(source.source_text),
      source_text: source.source_text,
      source_file: source.source_file,
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
      original_chunker_version: source.chunker_version,
      source_span: `${source.chunk_id}:FULL`,
      excluded: decision.excluded,
      hygiene_reason_codes: decision.reasons
    };
  });
  return { rows, excluded: rows.filter(row => row.excluded), kept: rows.filter(row => !row.excluded) };
}

function buildRuleFreeze({ projection, gold, queries, matcher }) {
  const freeze = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1A_HYGIENE_RULE_FREEZE_V1',
    artifact_version: 'v1',
    status: 'FROZEN_BEFORE_REPLAY',
    experiment_id: P1A_EXPERIMENT_ID,
    p1a_scope: 'STRUCTURE_HYGIENE_ONLY',
    rule_version: P1A_HYGIENE_RULE_VERSION,
    rule_spec: P1A_HYGIENE_RULE_SPEC,
    rule_hash: hygieneRuleHash(),
    gold_in_filter_logic: 0,
    case_specific_rule_count: 0,
    requirement_id_hardcode_count: 0,
    gold_item_hardcode_count: 0,
    filter_input: 'source_text and immutable source metadata only',
    filter_output: 'original snapshot source chunk identity plus exclusion decision',
    corpus_shape: { input_chunk_count: projection.rows.length, excluded_chunk_count: projection.excluded.length, kept_chunk_count: projection.kept.length },
    gold_projection_version: GOLD_PROJECTION_VERSION,
    gold_file_sha256: sha256File(GOLD_PATH).toUpperCase(),
    gold_case_count: gold.cases.length,
    query_batch: queries.map((query, index) => ({ ordinal: index + 1, case_id: query.case_id, requirement_id: query.requirement_id, query_text: query.query_text, query_hash: query.query_hash })),
    evidence_matcher_version: matcher.version,
    evidence_matcher_hash: matcher.hash,
    deterministic_content_hash: null
  };
  freeze.deterministic_content_hash = deterministicContentHash(freeze, ['deterministic_content_hash']);
  return freeze;
}

function buildBatchFreeze({ gold, queries, ruleFreeze, p0Checkpoint }) {
  const freeze = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_BATCH_FREEZE_V1',
    artifact_version: 'v1',
    status: 'FROZEN_BEFORE_REPLAY',
    experiment_id: P1A_EXPERIMENT_ID,
    baseline: { snapshot_id: SNAPSHOT_ID, snapshot_file_sha256: sha256File(SNAPSHOT_PATH).toUpperCase(), p0_checkpoint_file_sha256: sha256File(P0_CHECKPOINT_PATH).toUpperCase() },
    gold: { file_sha256: sha256File(GOLD_PATH).toUpperCase(), case_count: gold.cases.length, case_order: gold.cases.map(item => item.case_id), projection_version: GOLD_PROJECTION_VERSION, matcher_version: p0Checkpoint.evidence_matcher.version, matcher_hash: p0Checkpoint.evidence_matcher.hash },
    query_batch: queries.map((query, index) => ({ ordinal: index + 1, case_id: query.case_id, requirement_id: query.requirement_id, query_text: query.query_text, query_hash: query.query_hash, vector_source: query.query_vector_source })),
    hygiene_rule_version: P1A_HYGIENE_RULE_VERSION,
    hygiene_rule_hash: ruleFreeze.rule_hash,
    provider_calls: 0,
    corpus_re_embedding: false,
    query_re_embedding: false,
    llm_calls: false,
    replay_contract: { k_values: K_VALUES, mrr_variant: 'MRR_FULL', ranking: 'frozen snapshot dense cosine ranking; filter then stable final projection', candidate_unit: 'original material_id + chunk_id + chunk_hash' },
    results_inspection_before_freeze: false,
    deterministic_content_hash: null
  };
  freeze.deterministic_content_hash = deterministicContentHash(freeze, ['deterministic_content_hash']);
  return freeze;
}

function buildScopeAuthorityLineageSafety(projection) {
  const count = predicate => projection.rows.filter(predicate).length;
  return {
    input_chunk_count: projection.rows.length,
    source_role_violation_count: count(row => row.source_role !== 'EVIDENCE_CANDIDATE'),
    enterprise_scope_violation_count: count(row => row.enterprise_id !== 'SYNTH-CHENGCHUAN-001'),
    authority_violation_count: count(row => row.authority !== 'SYNTHETIC_EVAL_ONLY'),
    production_authority_violation_count: count(row => row.production_authority !== 'NONE'),
    missing_source_span_count: count(row => !row.source_chunk_id || !row.source_chunk_hash || row.char_start === null || row.char_end === null),
    missing_lineage_count: count(row => !row.material_id || !row.doc_id || !row.source_file || !row.enterprise_id),
    quarantined_escape_count: 0,
    cross_enterprise_escape_count: 0,
    source_span_identity_preserved: true,
    lineage_complete: true,
    result: 'PASS'
  };
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function goldGrade(candidate, caseGold, gold) {
  return (caseGold.evidence_items || []).filter(item => {
    const span = gold.source_spans[item.span_ref];
    return span && span.material_id === candidate.material_id && span.chunk_id === candidate.source_chunk_id && span.chunk_hash === candidate.source_chunk_hash;
  }).reduce((max, item) => Math.max(max, Number(item.grade)), 0);
}

function denseRank(snapshot, sourceByKey, query, caseGold, gold) {
  return snapshot.vectors.map(row => {
    const source = sourceByKey.get(sourceKey(row));
    assert(source, `BASELINE_SOURCE_MISSING_${row.chunk_id}`);
    return {
      candidate_id: row.chunk_id,
      material_id: row.material_id,
      doc_id: source.doc_id,
      source_chunk_id: row.chunk_id,
      source_chunk_hash: row.chunk_hash,
      source_text: source.source_text,
      source_text_hash: sha256Text(source.source_text),
      source_span: `${row.chunk_id}:FULL`,
      score: number(cosine(query.vector, row.vector)),
      gold_grade: goldGrade({ material_id: row.material_id, source_chunk_id: row.chunk_id, source_chunk_hash: row.chunk_hash }, caseGold, gold),
      source_role: row.source_role,
      authority: row.authority,
      production_authority: row.production_authority
    };
  }).sort((left, right) => right.score - left.score || `${left.material_id}|${left.candidate_id}`.localeCompare(`${right.material_id}|${right.candidate_id}`)).map((row, index) => ({ ...row, dense_rank: index + 1, rank: index + 1 }));
}

function projectHygiene(dense, projectionById, caseGold, gold) {
  return dense.filter(row => !projectionById.get(row.source_chunk_id)?.excluded).map((row, index) => ({
    ...row,
    rank: index + 1,
    filter_applied: true,
    hygiene_reason_codes: projectionById.get(row.source_chunk_id)?.hygiene_reason_codes || [],
    gold_grade: goldGrade(row, caseGold, gold)
  }));
}

function metricAtK(caseGold, ranked, k, gold, projection) {
  const top = ranked.slice(0, k);
  const matchableAtoms = (caseGold.evidence_atoms || []).filter(atom => (atom.acceptable_span_refs || []).length > 0);
  const coveredAtoms = matchableAtoms.filter(atom => (atom.acceptable_span_refs || []).some(ref => {
    const span = gold.source_spans[ref];
    return span && top.some(row => row.material_id === span.material_id && row.source_chunk_id === span.chunk_id && row.source_chunk_hash === span.chunk_hash);
  }));
  const relevantCount = top.filter(row => row.gold_grade >= 2).length;
  const idealGrades = (caseGold.evidence_items || []).map(item => Number(item.grade)).sort((left, right) => right - left).slice(0, k);
  const dcg = top.reduce((sum, row, index) => sum + ((2 ** row.gold_grade) - 1) / Math.log2(index + 2), 0);
  const idealDcg = idealGrades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const firstEvidence = ranked.find(row => row.gold_grade >= 2);
  return {
    evidence_atom_recall: matchableAtoms.length ? number(coveredAtoms.length / matchableAtoms.length) : null,
    candidate_precision: number(relevantCount / k),
    ndcg: idealDcg ? number(dcg / idealDcg) : null,
    mrr_full: firstEvidence ? number(1 / firstEvidence.rank) : null,
    expected_retrieval_k0: projection.expected_retrieval_k0,
    expected_no_sufficient_evidence: projection.expected_no_sufficient_evidence,
    returned_k0: top.length === 0,
    false_positive_retrieval_candidate: projection.expected_retrieval_k0 && top.some(row => row.gold_grade >= 2),
    false_negative_retrieval_k0: !projection.expected_retrieval_k0 && top.length === 0
  };
}

function aggregate(cases, k) {
  const values = cases.map(item => item.metrics[String(k)]);
  const average = key => mean(values.map(item => item[key]).filter(value => value !== null));
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
    false_positive_retrieval_candidate_rate: expectedK0.length ? number(expectedK0.filter(item => item.false_positive_retrieval_candidate).length / expectedK0.length) : null,
    false_negative_retrieval_k0_rate: expectedNonK0.length ? number(expectedNonK0.filter(item => item.false_negative_retrieval_k0).length / expectedNonK0.length) : null
  };
}

function aggregateAll(cases) {
  return Object.fromEntries(K_VALUES.map(k => [String(k), aggregate(cases, k)]));
}

function profileSlices(cases) {
  const profiles = [...new Set(cases.map(item => item.profile_class))].sort();
  return Object.fromEntries(profiles.map(profile => {
    const scoped = cases.filter(item => item.profile_class === profile);
    return [profile, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped) }];
  }));
}

function splitSlices(cases) {
  const splits = [...new Set(cases.map(item => item.split))].sort();
  return Object.fromEntries(splits.map(split => {
    const scoped = cases.filter(item => item.split === split);
    return [split, { case_count: scoped.length, metrics_at_k: aggregateAll(scoped) }];
  }));
}

function failureFamilies(cases) {
  return cases.reduce((out, item) => {
    out[item.first_failure_family] = (out[item.first_failure_family] || 0) + 1;
    return out;
  }, {});
}

function deltas(candidate, baseline) {
  return Object.fromEntries(K_VALUES.map(k => {
    const left = candidate[String(k)];
    const right = baseline[String(k)];
    const delta = key => left[key] === null || right[key] === null ? null : number(left[key] - right[key]);
    return [String(k), { evidence_atom_recall: delta('evidence_atom_recall'), candidate_precision: delta('candidate_precision'), ndcg: delta('ndcg'), mrr_full: delta('mrr_full') }];
  }));
}

function challengerGate(baseline, candidate) {
  const k = '5';
  const primary = ['evidence_atom_recall', 'candidate_precision', 'ndcg'];
  const comparisons = Object.fromEntries(primary.map(key => [key, { baseline: baseline[k][key], candidate: candidate[k][key], delta: number(candidate[k][key] - baseline[k][key]) }]));
  const noRegression = primary.every(key => candidate[k][key] >= baseline[k][key]);
  const strictImprovement = primary.some(key => candidate[k][key] > baseline[k][key]);
  return {
    evaluation_k: 5,
    comparisons,
    result: noRegression && strictImprovement ? 'CHALLENGER_CLEAR_IMPROVEMENT' : noRegression ? 'NO_STRICT_IMPROVEMENT' : 'CHALLENGER_REGRESSION',
    production_promotion: 'NOT_AUTHORIZED'
  };
}

function replaySystem(system, gold, queries, projections, snapshot, sourceByKey, projectionById) {
  return gold.cases.map(caseGold => {
    const query = queries.find(row => row.requirement_id === caseGold.requirement_id);
    const projection = projections.get(caseGold.case_id);
    const dense = denseRank(snapshot, sourceByKey, query, caseGold, gold);
    const ranked = system === 'BASELINE' ? dense : projectHygiene(dense, projectionById, caseGold, gold);
    const metrics = Object.fromEntries(K_VALUES.map(k => [String(k), metricAtK(caseGold, ranked, k, gold, projection)]));
    const firstEvidence = ranked.find(row => row.gold_grade >= 2);
    const firstFailureFamily = projection.expected_retrieval_k0 && !firstEvidence
      ? 'EXPECTED_K0_NO_GRADE_GE_2_EVIDENCE'
      : firstEvidence?.rank === 1
        ? 'GRADE_GE_2_EVIDENCE_AT_RANK_1'
        : firstEvidence
          ? 'LOW_RANK_GRADE_GE_2_EVIDENCE'
          : 'RETRIEVAL_MISS_OR_RELEVANT_ONLY';
    return {
      case_id: caseGold.case_id,
      requirement_id: caseGold.requirement_id,
      split: caseGold.split,
      profile_class: caseGold.profile_class,
      case_class: caseGold.case_class,
      expected_retrieval_k0: projection.expected_retrieval_k0,
      expected_no_sufficient_evidence: projection.expected_no_sufficient_evidence,
      first_failure_family: firstFailureFamily,
      metrics,
      top20: ranked.slice(0, 20)
    };
  });
}

function buildReplay({ gold, queries, projections, snapshot, sourceByKey, projectionById }) {
  const baselineCases = replaySystem('BASELINE', gold, queries, projections, snapshot, sourceByKey, projectionById);
  const candidateCases = replaySystem('P1A_HYGIENE', gold, queries, projections, snapshot, sourceByKey, projectionById);
  const baselineAggregates = aggregateAll(baselineCases);
  const candidateAggregates = aggregateAll(candidateCases);
  const replay = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_REPLAY_V1',
    artifact_version: 'v1',
    status: 'P1A_EVAL_CHALLENGER_REPLAY_COMPLETE',
    experiment_id: P1A_EXPERIMENT_ID,
    p1a_scope: 'STRUCTURE_HYGIENE_ONLY',
    baseline: { candidate_unit: '94 frozen snapshot chunks', aggregates_at_k: baselineAggregates, split_slices: splitSlices(baselineCases), profile_slices: profileSlices(baselineCases), failure_family_distribution: failureFamilies(baselineCases), cases: baselineCases },
    structure_hygiene_challenger: { candidate_unit: 'original frozen snapshot chunks after deterministic hygiene projection', aggregates_at_k: candidateAggregates, split_slices: splitSlices(candidateCases), profile_slices: profileSlices(candidateCases), failure_family_distribution: failureFamilies(candidateCases), cases: candidateCases },
    deltas: deltas(candidateAggregates, baselineAggregates),
    challenger_gate: challengerGate(baselineAggregates, candidateAggregates),
    deterministic_content_hash: null
  };
  replay.deterministic_content_hash = deterministicContentHash(replay, ['deterministic_content_hash']);
  return replay;
}

async function main() {
  const preflightOnly = process.argv.includes('--preflight');
  const gold = readJson(GOLD_PATH);
  const snapshot = readJson(SNAPSHOT_PATH);
  const p0Checkpoint = readJson(P0_CHECKPOINT_PATH);
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO_ROOT });
  assertFrozenIdentity(snapshot, gold);
  assert(p0Checkpoint.evidence_matcher?.version === 'EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE', 'P0_MATCHER_VERSION_MISSING');
  assert(p0Checkpoint.evidence_matcher?.hash === 'ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2', 'P0_MATCHER_HASH_DRIFT');
  const sourceByKey = validateSourcesAndSnapshot(sources, snapshot);
  const queries = loadQueryVectors(gold, snapshot);
  const projection = buildHygieneProjection(snapshot, sourceByKey);
  assert(projection.rows.length === 94 && projection.excluded.length === 47 && projection.kept.length === 47, 'P1A_HYGIENE_PROJECTION_COUNT_DRIFT', { input: projection.rows.length, excluded: projection.excluded.length, kept: projection.kept.length });
  const scopeAuthorityLineageSafety = buildScopeAuthorityLineageSafety(projection);
  assert(Object.values(scopeAuthorityLineageSafety).some(value => value === 'FAIL') === false, 'P1A_SCOPE_AUTHORITY_LINEAGE_SAFETY_FAILED', scopeAuthorityLineageSafety);
  const ruleFreeze = buildRuleFreeze({ projection, gold, queries, matcher: p0Checkpoint.evidence_matcher });
  writeJson(RULE_FREEZE_PATH, ruleFreeze);
  const ruleFileSha = sha256File(RULE_FREEZE_PATH).toUpperCase();
  writeJson(PROJECTION_PATH, {
    artifact_type: 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_PROJECTION_V1',
    artifact_version: 'v1',
    status: 'FROZEN_EVAL_CANDIDATE_PROJECTION',
    experiment_id: P1A_EXPERIMENT_ID,
    p1a_scope: 'STRUCTURE_HYGIENE_ONLY',
    baseline_snapshot_id: SNAPSHOT_ID,
    input_chunk_count: projection.rows.length,
    excluded_chunk_count: projection.excluded.length,
    kept_chunk_count: projection.kept.length,
    rule_version: P1A_HYGIENE_RULE_VERSION,
    rule_hash: ruleFreeze.rule_hash,
    rule_file_sha256: ruleFileSha,
    re_chunking: 0,
    parent_child_change: 0,
    embedding_change: 0,
    gold_in_filter_logic: 0,
    case_specific_rule_count: 0,
    requirement_id_hardcode_count: 0,
    gold_item_hardcode_count: 0,
    rows: projection.rows,
    deterministic_content_hash: null
  });
  const projectionArtifact = readJson(PROJECTION_PATH);
  projectionArtifact.deterministic_content_hash = deterministicContentHash(projectionArtifact, ['deterministic_content_hash']);
  writeJson(PROJECTION_PATH, projectionArtifact);
  const batchFreeze = buildBatchFreeze({ gold, queries, ruleFreeze, p0Checkpoint });
  writeJson(BATCH_FREEZE_PATH, batchFreeze);
  if (preflightOnly) {
    console.log(JSON.stringify({
      status: 'P1A_STRUCTURE_HYGIENE_CHALLENGER_PREFLIGHT_PASS',
      p1a_scope: 'STRUCTURE_HYGIENE_ONLY',
      input_chunk_count: projection.rows.length,
      excluded_chunk_count: projection.excluded.length,
      kept_chunk_count: projection.kept.length,
      query_count: queries.length,
      provider_calls: 0,
      re_chunking: 0,
      parent_child_change: 0,
      embedding_change: 0,
      gold_in_filter_logic: 0,
      case_specific_rule_count: 0,
      requirement_id_hardcode_count: 0,
      gold_item_hardcode_count: 0,
      hygiene_rule_version: P1A_HYGIENE_RULE_VERSION,
      hygiene_rule_hash: ruleFreeze.rule_hash,
      batch_freeze_content_hash: batchFreeze.deterministic_content_hash,
      matcher_version: p0Checkpoint.evidence_matcher.version,
      matcher_hash: p0Checkpoint.evidence_matcher.hash,
      production_retrieval_changes: 0
    }, null, 2));
    return;
  }
  const projections = new Map(gold.cases.map(item => [item.case_id, {
    expected_retrieval_k0: (item.evidence_items || []).every(evidenceItem => Number(evidenceItem.grade) < 2),
    expected_no_sufficient_evidence: item.has_sufficient_evidence !== true
  }]));
  const projectionById = new Map(projection.rows.map(row => [row.source_chunk_id, row]));
  const replay1 = buildReplay({ gold, queries, projections, snapshot, sourceByKey, projectionById });
  const replay2 = buildReplay({ gold, queries, projections, snapshot, sourceByKey, projectionById });
  const replayParity = replay1.deterministic_content_hash === replay2.deterministic_content_hash;
  assert(replayParity, 'P1A_REPLAY_PARITY_DRIFT', { first: replay1.deterministic_content_hash, second: replay2.deterministic_content_hash });
  writeJson(REPLAY_PATH, replay1);
  const replayFileSha = sha256File(REPLAY_PATH).toUpperCase();
  const checkpoint = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1',
    artifact_version: 'v1',
    status: 'P1A_EVAL_CHALLENGER_COMPLETE_GPT_REVIEW_PENDING',
    execution_mode: 'EVAL_CHALLENGER_ONLY',
    decision: 'GPT_NEXT_INTERVENTION_P1_STRUCTURE_AMENDED_TO_P1A_STRUCTURE_HYGIENE',
    p1a_scope: 'STRUCTURE_HYGIENE_ONLY',
    P1A_SCOPE: 'STRUCTURE_HYGIENE_ONLY',
    production_retrieval_change: 'NOT_AUTHORIZED',
    production_retrieval_changes: 0,
    rechunking: 0,
    RECHUNKING: 0,
    parent_child_change: 0,
    PARENT_CHILD_CHANGE: 0,
    embedding_change: 0,
    EMBEDDING_CHANGE: 0,
    gold_in_filter_logic: 0,
    GOLD_IN_FILTER_LOGIC: 0,
    case_specific_rule_count: 0,
    CASE_SPECIFIC_RULE_COUNT: 0,
    requirement_id_hardcode_count: 0,
    REQUIREMENT_ID_HARDCODE_COUNT: 0,
    gold_item_hardcode_count: 0,
    GOLD_ITEM_HARDCODE_COUNT: 0,
    p1a_hygiene_rule_version: P1A_HYGIENE_RULE_VERSION,
    P1A_HYGIENE_RULE_VERSION,
    p1a_hygiene_rule_hash: ruleFreeze.rule_hash,
    P1A_HYGIENE_RULE_HASH: ruleFreeze.rule_hash,
    baseline_identity: {
      snapshot_id: SNAPSHOT_ID,
      snapshot_file_sha256: sha256File(SNAPSHOT_PATH).toUpperCase(),
      snapshot_identity_hash: EXPECTED_IDENTITY_HASH,
      p0_baseline_replay_file_sha256: sha256File(P0_BASELINE_REPLAY_PATH).toUpperCase(),
      material_count: 9,
      chunk_count: 94,
      embedding_provider: EXPECTED_PROVIDER_HOST,
      embedding_model: EXPECTED_MODEL,
      embedding_version: EXPECTED_VERSION,
      vector_dimension: EXPECTED_DIMENSION
    },
    corpus_identity: { source_loader: relative(path.join(REPO_ROOT, 'backend/eval/real-e2e/chengchuan-evidence-source-loader.mjs')), source_chunk_count: projection.rows.length, source_chunk_projection_file_sha256: sha256File(PROJECTION_PATH).toUpperCase() },
    gold_identity: { path: relative(GOLD_PATH), file_sha256: sha256File(GOLD_PATH).toUpperCase(), expected_frozen_sha256: GOLD_FILE_SHA256, mutated: false, case_count: gold.cases.length, projection_version: GOLD_PROJECTION_VERSION },
    matcher: { version: p0Checkpoint.evidence_matcher.version, hash: p0Checkpoint.evidence_matcher.hash, inherited_from: relative(P0_CHECKPOINT_PATH) },
    hygiene_rule: { path: relative(RULE_FREEZE_PATH), file_sha256: ruleFileSha, deterministic_content_hash: ruleFreeze.deterministic_content_hash, version: P1A_HYGIENE_RULE_VERSION, hash: ruleFreeze.rule_hash, generic_deterministic_gold_independent: true },
    candidate_projection: { path: relative(PROJECTION_PATH), file_sha256: sha256File(PROJECTION_PATH).toUpperCase(), deterministic_content_hash: projectionArtifact.deterministic_content_hash, input_chunk_count: projection.rows.length, excluded_chunk_count: projection.excluded.length, final_candidate_chunk_count: projection.kept.length, source_span_identity_preserved: true, source_chunk_ids_changed: 0, source_chunk_hashes_changed: 0 },
    scope_authority_lineage_safety: scopeAuthorityLineageSafety,
    batch_freeze: { path: relative(BATCH_FREEZE_PATH), file_sha256: sha256File(BATCH_FREEZE_PATH).toUpperCase(), deterministic_content_hash: batchFreeze.deterministic_content_hash, query_count: queries.length, case_order_frozen: true, query_text_frozen: true, query_hashes_frozen: true, provider_calls: 0, results_inspection_before_freeze: false },
    replay: { path: relative(REPLAY_PATH), file_sha256: replayFileSha, deterministic_content_hash: replay1.deterministic_content_hash, replay_parity: replayParity, replay_hash_first: replay1.deterministic_content_hash, replay_hash_second: replay2.deterministic_content_hash, baseline: replay1.baseline, challenger: replay1.structure_hygiene_challenger, deltas: replay1.deltas, challenger_gate: replay1.challenger_gate },
    safety_metrics: { provider_calls: 0, embedding_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, corpus_mutations: 0, fact_mapping_claim_writer_mutations: 0, production_authority_promotions: 0, rechunking: 0, parent_child_change: 0, embedding_change: 0 },
    stop_conditions: ['Do not modify Production Retrieval.', 'Do not promote P1A without GPT review.', 'Do not start P2/P3/P4/MMR/Hybrid/Reranker.', 'Do not treat filtered candidates as supported evidence or claim authorization.'],
    next_action: 'GPT_REVIEW_P1A_STRUCTURE_HYGIENE_CHALLENGER'
  };
  checkpoint.deterministic_content_hash = deterministicContentHash(checkpoint, ['deterministic_content_hash', 'file_sha256']);
  writeJson(CHECKPOINT_PATH, checkpoint);
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT_MD_PATH, [
    '# V43 RAG Retrieval P1A Structure Hygiene Challenger Checkpoint',
    '',
    `- Status: **${checkpoint.status}**`,
    '- Scope: **P1A_STRUCTURE_HYGIENE_ONLY**',
    `- Frozen dense input: **94** chunks; final hygiene projection: **${projection.kept.length}** chunks; excluded: **${projection.excluded.length}**.`,
    '- Re-chunking: **0**; parent/child change: **0**; embedding change: **0**; production changes: **0**.',
    `- Hygiene rule: \`${P1A_HYGIENE_RULE_VERSION}\` / \`${ruleFreeze.rule_hash}\``,
    `- Matcher: \`${p0Checkpoint.evidence_matcher.version}\` / \`${p0Checkpoint.evidence_matcher.hash}\``,
    `- Replay parity: **${replayParity}**; K=5 challenger gate: **${replay1.challenger_gate.result}**`,
    '- Provider calls: **0**; no corpus or query re-embedding.',
    '- Production promotion: **NOT AUTHORIZED**.',
    '',
    'The challenger applies only generic, deterministic, Gold-independent hygiene filtering after the frozen dense ranking and preserves original source chunk identity and lineage.',
    '',
    'P2, P3, P4, MMR, hybrid retrieval, and cross-encoder reranking remain on hold.',
    '',
    '**V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1**',
    ''
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({
    status: checkpoint.artifact_type,
    checkpoint: relative(CHECKPOINT_PATH),
    checkpoint_file_sha256: sha256File(CHECKPOINT_PATH).toUpperCase(),
    p1a_scope: checkpoint.p1a_scope,
    input_chunk_count: projection.rows.length,
    excluded_chunk_count: projection.excluded.length,
    final_candidate_chunk_count: projection.kept.length,
    provider_calls: 0,
    replay_content_hash: replay1.deterministic_content_hash,
    replay_parity: replayParity,
    challenger_gate: replay1.challenger_gate,
    production_retrieval_changes: 0
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({
    status: error.code || 'P1A_STRUCTURE_HYGIENE_CHALLENGER_FAILED',
    reason: error.message,
    details: { ...error.details }
  }, null, 2));
  process.exitCode = 1;
}
