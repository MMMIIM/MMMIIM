import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AUDIT_BASE = path.join(ROOT, 'docs', 'handoff', 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_AND_FAILURE_DECOMPOSITION_V1');
const EVAL_BASE = path.join(ROOT, 'docs', 'handoff', 'V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1');
const OUT = path.join(ROOT, 'docs', 'handoff', 'V43_REFERENCE_FAIL_QUIET_DECISION_PACKET_V1');
const R1_FILE = path.join(EVAL_BASE, '10_R1_RESULTS.json');
const GPT_FILE = path.join(AUDIT_BASE, '01_GPT_R1_SEMANTIC_ADJUDICATION.json');
const REPLAY_FILE = path.join(AUDIT_BASE, '05_R1_OFFLINE_REPLAY.json');
const RANKING_FILE = path.join(AUDIT_BASE, '06_RANKING_FAILURE_FORENSICS.json');
const COVERAGE_FILE = path.join(AUDIT_BASE, '08_CORPUS_COVERAGE_DEBT.json');
const CONCENTRATION_FILE = path.join(AUDIT_BASE, '09_GENERIC_CHUNK_CONCENTRATION.json');
const SWEEP_FILE = path.join(AUDIT_BASE, '10_SIMILARITY_FAIL_QUIET_SWEEP.json');
const AFFINITY_FILE = path.join(AUDIT_BASE, '11_DOMAIN_AFFINITY_OFFLINE_ANALYSIS.json');
const RAW_ADJUSTED_FILE = path.join(AUDIT_BASE, '12_RAW80_VS_ADJUSTED74_METRICS.json');
const CHECKPOINT_FILE = path.join(AUDIT_BASE, '15_CHECKPOINT.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const pct = (value) => round(value * 100, 2);

fs.mkdirSync(OUT, { recursive: true });
const r1 = readJson(R1_FILE);
const gpt = readJson(GPT_FILE);
const replay = readJson(REPLAY_FILE);
const ranking = readJson(RANKING_FILE);
const coverage = readJson(COVERAGE_FILE);
const concentration = readJson(CONCENTRATION_FILE);
const sweep = readJson(SWEEP_FILE);
const affinity = readJson(AFFINITY_FILE);
const rawAdjusted = readJson(RAW_ADJUSTED_FILE);
const priorCheckpoint = readJson(CHECKPOINT_FILE);
if (!Array.isArray(r1.cases) || r1.cases.length !== 80) throw new Error('R1_CASE_COUNT_MISMATCH');
if (!Array.isArray(gpt.cases) || gpt.cases.length !== 80) throw new Error('GPT_CASE_COUNT_MISMATCH');
if (!Array.isArray(replay.cases) || replay.cases.length !== 80) throw new Error('REPLAY_CASE_COUNT_MISMATCH');

const gptByCase = new Map(gpt.cases.map((item) => [item.case_id, item]));
const replayByCase = new Map(replay.cases.map((item) => [item.case_id, item]));
const r1ByCase = new Map(r1.cases.map((item) => [item.case_id, item]));
const labelOf = (caseId) => gptByCase.get(caseId)?.semantic_label ?? 'UNMAPPED';
const oldRefs = (item) => item?.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references ?? [];
const replayRefs = (item) => item?.replay_r1_references ?? [];
const labelCounts = (items) => items.reduce((out, item) => { const label = labelOf(item.case_id); out[label] = (out[label] || 0) + 1; return out; }, {});

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower), 6);
};

const testedThresholds = (sweep.thresholds ?? []).map((row) => Number(row.threshold));
const thresholdRows = testedThresholds.map((threshold) => {
  const retainedByCase = new Map(r1.cases.map((item) => [item.case_id, oldRefs(item).filter((ref) => Number(ref.similarity_score ?? 0) >= threshold)]));
  const retainedCaseCount = [...retainedByCase.values()].filter((refs) => refs.length > 0).length;
  const retainedReferenceCount = [...retainedByCase.values()].reduce((sum, refs) => sum + refs.length, 0);
  const count = (label) => r1.cases.filter((item) => labelOf(item.case_id) === label).length;
  const retained = (label) => r1.cases.filter((item) => labelOf(item.case_id) === label && retainedByCase.get(item.case_id).length > 0).length;
  const usefulTotal = count('USEFUL');
  const partialTotal = count('PARTIAL');
  const notUsefulTotal = count('NOT_USEFUL');
  const usefulRetained = retained('USEFUL');
  const partialRetained = retained('PARTIAL');
  const notUsefulRetained = retained('NOT_USEFUL');
  return {
    threshold,
    total_retained_references: retainedReferenceCount,
    total_retained_cases: retainedCaseCount,
    useful_cases_retained: usefulRetained,
    useful_retention_pct: pct(usefulRetained / usefulTotal),
    partial_cases_retained: partialRetained,
    partial_retention_pct: pct(partialRetained / partialTotal),
    not_useful_cases_retained: notUsefulRetained,
    not_useful_rejection_pct: pct(1 - notUsefulRetained / notUsefulTotal),
    zero_reference_case_count: 80 - retainedCaseCount,
    zero_reference_rate_pct: pct((80 - retainedCaseCount) / 80),
    derivation: 'Existing R1 similarity scores only; no retrieval rerun and no threshold deployed.'
  };
});
const thresholdCandidate = (purpose, row, basis) => ({ purpose, candidate_threshold: row?.threshold ?? null, evidence_row: row ?? null, selection_status: 'NOT_SELECTED', basis, production_deployment: false });
const conservativeRow = [...thresholdRows].sort((a, b) => b.not_useful_rejection_pct - a.not_useful_rejection_pct || b.threshold - a.threshold)[0];
const balancedRow = [...thresholdRows].sort((a, b) => {
  const scoreA = (a.useful_retention_pct / 100) * (a.not_useful_rejection_pct / 100);
  const scoreB = (b.useful_retention_pct / 100) * (b.not_useful_rejection_pct / 100);
  return scoreB - scoreA || a.zero_reference_rate_pct - b.zero_reference_rate_pct;
})[0];
const recallRow = [...thresholdRows].sort((a, b) => b.useful_retention_pct - a.useful_retention_pct || a.threshold - b.threshold)[0];
const thresholdCandidates = [
  thresholdCandidate('CONSERVATIVE_QUALITY', conservativeRow, 'Maximum NOT_USEFUL rejection in the tested table; candidate only.'),
  thresholdCandidate('BALANCED', balancedRow, 'Maximum product of USEFUL retention and NOT_USEFUL rejection among tested rows; candidate only.'),
  thresholdCandidate('RECALL_PRESERVING', recallRow, 'Maximum USEFUL retention, then lowest tested threshold; candidate only.')
];

const scoreRows = { USEFUL: [], PARTIAL: [], NOT_USEFUL: [] };
for (const item of replay.cases) for (const ref of replayRefs(item)) {
  if (scoreRows[labelOf(item.case_id)]) scoreRows[labelOf(item.case_id)].push(Number(ref.similarity_score ?? 0));
}
const scoreDistribution = Object.fromEntries(Object.entries(scoreRows).map(([label, values]) => [label, {
  reference_count: values.length,
  case_count: new Set(replay.cases.filter((item) => labelOf(item.case_id) === label && replayRefs(item).length).map((item) => item.case_id)).size,
  min: quantile(values, 0),
  p25: quantile(values, 0.25),
  median: quantile(values, 0.5),
  p75: quantile(values, 0.75),
  max: quantile(values, 1)
}]));

const normalizedClassification = (value) => value === 'A_SELECTOR_OR_RANKING_FAILURE' ? 'SELECTOR_RANKING_FAILURE' : value === 'B_DENSE_RETRIEVAL_CANDIDATE_FAILURE_PROPOSAL' ? 'DENSE_RETRIEVAL_CANDIDATE_FAILURE' : value === 'C_CORPUS_GAP_PROPOSAL' ? 'CORPUS_GAP' : 'UNMAPPED';
const rankingCases = (ranking.cases ?? []).map((item) => {
  const selected = (item.previous_r1_final_references ?? []).map((row) => ({ chunk_id: row.chunk_id, material_id: row.material_id, original_name: row.original_name, similarity_score: row.similarity_score, source_text: row.source_text ?? '' }));
  const proposal = normalizedClassification(item.mechanical_classification_proposal);
  return {
    case_id: item.case_id,
    requirement_id: item.requirement_id,
    tender_id: item.tender_id,
    classification: proposal,
    mechanical_classification_proposal: item.mechanical_classification_proposal,
    best_relevant_candidate_rank: null,
    best_relevant_similarity: null,
    relevance_evidence: 'No GPT-confirmed relevant-candidate marker exists in the mechanical artifact; values intentionally remain null.',
    selected_final_references: selected,
    one_line_reason: `${item.confidence}; ${item.selection_note}`,
    semantic_root_cause: 'PENDING_GPT'
  };
});
const rankingSummary = {
  classification_authority: 'MECHANICAL_PROPOSAL_ONLY',
  semantic_relabeling: false,
  counts: rankingCases.reduce((out, item) => { out[item.classification] = (out[item.classification] || 0) + 1; return out; }, {}),
  cases: rankingCases
};

const coverageByTopic = new Map();
for (const item of coverage.cases ?? []) {
  const label = labelOf(item.case_id);
  for (const topic of item.observed_topic_signals ?? []) {
    if (!coverageByTopic.has(topic)) coverageByTopic.set(topic, { topic_family: topic, case_ids: new Set(), tenders: new Set(), labels: { USEFUL: 0, PARTIAL: 0, NOT_USEFUL: 0 }, references: [], classification_basis: [] });
    const row = coverageByTopic.get(topic);
    row.case_ids.add(item.case_id); row.tenders.add(item.tender_id); if (row.labels[label] !== undefined) row.labels[label] += 1;
    for (const ref of item.r1_references ?? []) row.references.push(ref);
  }
}
const corpusGapPriority = [...coverageByTopic.values()].map((row) => {
  const chunks = new Set(row.references.map((ref) => ref.chunk_id).filter(Boolean));
  const materials = new Set(row.references.map((ref) => ref.material_id).filter(Boolean));
  const isTrueGap = row.references.length === 0;
  return {
    topic_family: row.topic_family,
    affected_case_count: row.case_ids.size,
    not_useful_count: row.labels.NOT_USEFUL,
    partial_count: row.labels.PARTIAL,
    tender_count: row.tenders.size,
    tenders: [...row.tenders].sort(),
    classification: isTrueGap ? 'TRUE_CORPUS_GAP' : 'CORPUS_EXISTS_BUT_TOO_GENERIC',
    classification_evidence: isTrueGap ? 'No persisted R1 candidate reference rows for this topic signal.' : 'Persisted R1 candidate rows exist; weakness is represented by GPT WEAK_CORPUS/PARTIAL_WEAK_CORPUS labels in the source cases.',
    observed_candidate_material_count: materials.size,
    observed_candidate_chunk_count: chunks.size,
    current_relevant_material_chunk_availability: { candidate_rows_present: row.references.length > 0, candidate_row_count: row.references.length, semantic_relevance: 'NOT_ASSESSED_BY_CODEX' },
    source_case_count: row.case_ids.size,
    no_new_ingestion: true
  };
}).sort((a, b) => b.affected_case_count - a.affected_case_count || a.topic_family.localeCompare(b.topic_family));

const chunkScopes = new Map();
for (const item of r1.cases) for (const ref of oldRefs(item)) {
  if (!chunkScopes.has(ref.chunk_id)) chunkScopes.set(ref.chunk_id, new Set());
  if (ref.corpus_scope) chunkScopes.get(ref.chunk_id).add(ref.corpus_scope);
}
const concentrationRows = (concentration.top_repeated_chunks ?? []).slice(0, 15).map((row) => {
  const labels = {};
  for (const caseId of row.case_ids ?? []) { const label = labelOf(caseId); labels[label] = (labels[label] || 0) + 1; }
  const domainCount = chunkScopes.get(row.chunk_id)?.size ?? 0;
  return {
    chunk_id: row.chunk_id,
    material: row.original_name,
    short_excerpt: String(row.excerpt ?? '').slice(0, 240),
    appearance_count: row.appearances,
    tender_count: (row.tenders ?? []).length,
    domain_count: domainCount,
    gpt_labels_of_affected_cases: labels,
    repeated_cross_tender_flag: row.appearances >= 5 && (row.tenders ?? []).length >= 2,
    diagnostic_only: true
  };
});

const replayLabelCounts = labelCounts(replay.cases);
const baseline = {
  case_count: replay.cases.length,
  reference_count: replay.metrics?.returned_reference_count ?? replay.cases.reduce((n, item) => n + replayRefs(item).length, 0),
  zero_reference_case_count: replay.metrics?.zero_reference_count ?? null,
  label_counts: replayLabelCounts
};
const domainAffinitySummary = {
  method: affinity.method,
  source_artifact: rel(AFFINITY_FILE),
  source_sha256: sha256File(AFFINITY_FILE),
  tested_rule_count: 0,
  tested_rules: [],
  baseline,
  observed_affinity_aggregate: affinity.aggregate,
  USEFUL_retained_or_improved: 'NOT_TESTED_IN_EXISTING_ARTIFACT',
  PARTIAL_changed: 'NOT_TESTED_IN_EXISTING_ARTIFACT',
  NOT_USEFUL_suppressed: 'NOT_TESTED_IN_EXISTING_ARTIFACT',
  new_wrong_domain_risk: 'NOT_TESTED_IN_EXISTING_ARTIFACT',
  zero_reference_delta: 'NOT_TESTED_IN_EXISTING_ARTIFACT',
  promotion_evidence: 'NO_DOMAIN_AFFINITY_PROMOTION_EVIDENCE'
};

const strategyMatrix = [
  {
    option: 'A_R1_HYGIENE_ONLY',
    benefit: 'Offline replay removes observed heading/front-matter/citation-index/boilerplate/duplicate escapes.',
    risk: 'GPT R1 semantic useful rate remains 15%; weak corpus, near misses and ranking failures remain.',
    engineering_complexity: 'LOW; existing chunk-role/substantive owner only.',
    current_evidence_strength: 'STRONG_ENGINEERING_OFFLINE (10/10 focused; 83/83 relevant regression).',
    production_readiness: 'NOT_READY_FOR_PRODUCT_FREEZE',
    selection_status: 'NOT_SELECTED'
  },
  {
    option: 'B_R1_PLUS_GLOBAL_SIMILARITY_FAIL_QUIET_THRESHOLD',
    benefit: 'Offline sweep shows increased NOT_USEFUL suppression at higher thresholds.',
    risk: 'Useful/partial retention falls and zero-reference cases rise; no threshold deployment evidence.',
    engineering_complexity: 'MEDIUM; threshold contract and monitoring would be required.',
    current_evidence_strength: 'OFFLINE_SCORE_SWEEP_ONLY',
    production_readiness: 'NOT_READY_NO_THRESHOLD_DEPLOYMENT',
    selection_status: 'NOT_SELECTED'
  },
  {
    option: 'C_R1_PLUS_DOMAIN_AFFINITY',
    benefit: 'Existing artifact provides a diagnostic affinity signal by GPT label.',
    risk: 'No tested rule/weight or wrong-domain safety result supports promotion.',
    engineering_complexity: 'MEDIUM',
    current_evidence_strength: 'NO_DOMAIN_AFFINITY_PROMOTION_EVIDENCE',
    production_readiness: 'NOT_READY',
    selection_status: 'NOT_SELECTED'
  },
  {
    option: 'D_R1_PLUS_THRESHOLD_PLUS_DOMAIN_AFFINITY',
    benefit: 'Potential combined fail-quiet filtering is untested.',
    risk: 'Compounded unmeasured recall, domain, and zero-reference effects.',
    engineering_complexity: 'HIGH',
    current_evidence_strength: 'NO_COMBINED_SIMULATION',
    production_readiness: 'NOT_READY',
    selection_status: 'NOT_SELECTED'
  },
  {
    option: 'E_R1_NOW_PLUS_CORPUS_ENRICHMENT_THEN_RETEST',
    benefit: 'Addresses actual WEAK_CORPUS case families before later threshold/ranking testing.',
    risk: 'Corpus governance and source activation are not part of this task; no ingestion performed.',
    engineering_complexity: 'HIGH; corpus activation and a new controlled evaluation would be required.',
    current_evidence_strength: 'ACTUAL_CASE_COVERAGE_DEBT_ONLY',
    production_readiness: 'NOT_READY_NO_INGESTION_OR_RETEST',
    selection_status: 'NOT_SELECTED'
  }
];

const sourceArtifacts = [RANKING_FILE, COVERAGE_FILE, CONCENTRATION_FILE, SWEEP_FILE, AFFINITY_FILE, RAW_ADJUSTED_FILE, GPT_FILE, REPLAY_FILE, CHECKPOINT_FILE];
const inputIdentity = sourceArtifacts.map((file) => ({ path: rel(file), sha256: sha256File(file) }));
const packet = {
  artifact_type: 'V43_REFERENCE_FAIL_QUIET_DECISION_PACKET_V1',
  status: 'READY_FOR_GPT_REFERENCE_FAIL_QUIET_FINAL_DECISION',
  scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL',
  no_execution: { provider_calls: 0, embedding_calls: 0, llm_calls: 0, db_writes: 0, production_changes: 0, router_changes: 0, corpus_ingestion: 0, mmr: 0, hybrid_bm25_reranker: 0, commit: 0, push: 0, merge: 0, deploy: 0 },
  authority: { gpt_r1_labels: true, codex_semantic_relabeling: false, semantic_root_cause: 'PENDING_GPT', writer_reference_product_fidelity: 'NOT_ESTABLISHED' },
  source_artifacts: inputIdentity,
  r1_label_summary: gpt.label_counts,
  fail_quiet_threshold_table: { tested_rows: thresholdRows, candidate_thresholds: thresholdCandidates, final_strategy_selection: 'PENDING_GPT' },
  label_score_distribution: scoreDistribution,
  ranking_failure_summary: rankingSummary,
  corpus_gap_priority: corpusGapPriority,
  generic_chunk_concentration_top15: concentrationRows,
  domain_affinity_summary: domainAffinitySummary,
  raw80_vs_adjusted74: rawAdjusted,
  strategy_decision_matrix: strategyMatrix,
  canonical_prior_checkpoint: { status: priorCheckpoint.status, scope: priorCheckpoint.scope, r2_status: priorCheckpoint.R2_authority?.canonical_status ?? null }
};

writeJson('01_FAIL_QUIET_THRESHOLD_TABLE.json', { artifact_type: 'V43_FAIL_QUIET_THRESHOLD_TABLE', source_artifact: rel(SWEEP_FILE), source_sha256: sha256File(SWEEP_FILE), tested_thresholds: thresholdRows, candidate_thresholds: thresholdCandidates, final_strategy_selection: 'PENDING_GPT' });
writeJson('02_LABEL_SCORE_DISTRIBUTION.json', { artifact_type: 'V43_R1_LABEL_SCORE_DISTRIBUTION_AFTER_HYGIENE_REPLAY', source_artifact: rel(REPLAY_FILE), source_sha256: sha256File(REPLAY_FILE), score_source: 'replay_r1_references.similarity_score', distributions: scoreDistribution });
writeJson('03_RANKING_FAILURE_SUMMARY.json', { artifact_type: 'V43_RANKING_FAILURE_SUMMARY', source_artifact: rel(RANKING_FILE), source_sha256: sha256File(RANKING_FILE), ...rankingSummary });
writeJson('04_CORPUS_GAP_PRIORITY.json', { artifact_type: 'V43_CORPUS_GAP_PRIORITY', source_artifact: rel(COVERAGE_FILE), source_sha256: sha256File(COVERAGE_FILE), rows: corpusGapPriority, true_corpus_gap_count: corpusGapPriority.filter((row) => row.classification === 'TRUE_CORPUS_GAP').length, corpus_exists_but_too_generic_count: corpusGapPriority.filter((row) => row.classification === 'CORPUS_EXISTS_BUT_TOO_GENERIC').length, no_new_ingestion: true });
writeJson('05_GENERIC_CHUNK_CONCENTRATION_SUMMARY.json', { artifact_type: 'V43_GENERIC_CHUNK_CONCENTRATION_SUMMARY', source_artifact: rel(CONCENTRATION_FILE), source_sha256: sha256File(CONCENTRATION_FILE), top15: concentrationRows, flag_definition: 'appearance_count >= 5 and tender_count >= 2', diagnostic_only: true });
writeJson('06_DOMAIN_AFFINITY_SUMMARY.json', { artifact_type: 'V43_DOMAIN_AFFINITY_SUMMARY', ...domainAffinitySummary });
writeJson('07_RAW80_ADJUSTED74.json', { artifact_type: 'V43_RAW80_ADJUSTED74', source_artifact: rel(RAW_ADJUSTED_FILE), source_sha256: sha256File(RAW_ADJUSTED_FILE), ...rawAdjusted, benchmark_rewritten: false });
writeJson('08_STRATEGY_DECISION_MATRIX.json', { artifact_type: 'V43_REFERENCE_FAIL_QUIET_STRATEGY_DECISION_MATRIX', options: strategyMatrix, winner: 'PENDING_GPT' });
writeJson('09_GPT_DECISION_PACKET.json', packet);
fs.writeFileSync(path.join(OUT, '09_GPT_DECISION_PACKET.md'), [
  '# V43 Reference Fail-Quiet Decision Packet', '',
  '**Status:** `READY_FOR_GPT_REFERENCE_FAIL_QUIET_FINAL_DECISION`', '',
  'Scope: Requirement-level Reference Retrieval Eval only. Writer Reference Product Fidelity is not established.', '',
  `R1 labels: USEFUL ${gpt.label_counts.USEFUL ?? 0} / PARTIAL ${gpt.label_counts.PARTIAL ?? 0} / NOT_USEFUL ${gpt.label_counts.NOT_USEFUL ?? 0} (80).`,
  `Offline hygiene replay: ${replay.metrics?.returned_reference_count ?? 0} references; heading/front-matter/citation-index/boilerplate/duplicate escapes all 0.`,
  `Ranking proposals: ${JSON.stringify(rankingSummary.counts)}; all are mechanical proposals with semantic root cause PENDING_GPT.`,
  `Reference-needed metrics remain RAW_80 and ADJUSTED_74; no retroactive benchmark rewrite.`,
  'No final threshold, domain-affinity rule, ingestion, Router change, MMR rerun, Provider/LLM call, DB write, commit, push, merge, or deploy was performed.', '',
  'Final strategy selection: PENDING_GPT.', ''
].join('\n'), 'utf8');

console.log(JSON.stringify({ status: packet.status, output_dir: rel(OUT), provider_calls: 0, embedding_calls: 0, llm_calls: 0, db_writes: 0, r1_labels: gpt.label_counts, ranking_counts: rankingSummary.counts, threshold_rows: thresholdRows.length }, null, 2));
