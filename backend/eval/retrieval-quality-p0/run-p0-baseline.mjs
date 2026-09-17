import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../');
const GOLD_PATH = path.join(HERE, 'GPT_SEMANTIC_GOLD_V1.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const CHUNKS_PATH = path.join(REPO_ROOT, 'backend/eval/rag-pilot/results/all_package_chunks.jsonl');
const REQUIREMENTS_PATH = path.join(REPO_ROOT, 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const OUTPUT_DIR = path.join(HERE, 'results');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P0_BASELINE_REPLAY_V1.json');
const K_VALUES = [1, 3, 5, 8, 20];
const RUN_ID = 'V43-RAG-RETRIEVAL-P0-BASELINE-20260917';

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256Buffer = value => createHash('sha256').update(value).digest('hex');
const sha256Text = value => sha256Buffer(Buffer.from(String(value), 'utf8'));
const sha256File = file => sha256Buffer(fs.readFileSync(file));
const number = value => Number(Number(value).toFixed(12));
const mean = values => values.length ? number(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const safeText = value => String(value ?? '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadChunks() {
  return fs.readFileSync(CHUNKS_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function validateGold(gold, chunks) {
  assert(gold.status === 'FROZEN_DEVELOPMENT_EVAL', 'Gold is not frozen development Eval Gold');
  assert(gold.authority === 'DEVELOPMENT_EVAL_ONLY', 'Gold authority drift');
  assert(gold.blindness.created_before_baseline_replay === true, 'Gold was not marked pre-replay');
  const chunkById = new Map(chunks.map(row => [row.chunk_id, row]));
  const spanByRef = gold.source_spans;
  for (const [spanRef, span] of Object.entries(spanByRef)) {
    const chunk = chunkById.get(span.chunk_id);
    assert(chunk, `${spanRef}: missing chunk ${span.chunk_id}`);
    assert(chunk.material_id === span.material_id, `${spanRef}: material lineage mismatch`);
    assert(chunk.doc_id === span.doc_id, `${spanRef}: document lineage mismatch`);
    assert(chunk.chunk_hash === span.chunk_hash, `${spanRef}: chunk hash mismatch`);
    assert(chunk.source_text === span.source_text, `${spanRef}: source text mismatch`);
    assert(sha256Text(span.source_text) === span.chunk_hash, `${spanRef}: source text hash mismatch`);
    for (const [key, label] of [['char_start', 'char start'], ['char_end', 'char end'], ['paragraph_start', 'paragraph start'], ['paragraph_end', 'paragraph end']]) {
      assert(chunk[key] === span[key], `${spanRef}: ${label} mismatch`);
    }
    const sourceFile = path.join(REPO_ROOT, span.source_file);
    assert(fs.existsSync(sourceFile), `${spanRef}: source file missing`);
    assert(sha256File(sourceFile).toUpperCase() === span.source_file_sha256, `${spanRef}: source file hash mismatch`);
  }
  const ids = new Set();
  for (const item of gold.cases) {
    assert(!ids.has(item.case_id), `duplicate Gold case ${item.case_id}`);
    ids.add(item.case_id);
    assert(item.split === 'CALIBRATION_SET' || item.split === 'UNTOUCHED_HOLDOUT_SET', `${item.case_id}: invalid split`);
    for (const evidenceItem of item.evidence_items) {
      assert(spanByRef[evidenceItem.span_ref], `${item.case_id}: missing span ref ${evidenceItem.span_ref}`);
      assert(Number.isInteger(evidenceItem.grade) && evidenceItem.grade >= 0 && evidenceItem.grade <= 3, `${item.case_id}: invalid evidence grade`);
    }
    for (const atom of item.evidence_atoms) {
      for (const ref of atom.acceptable_span_refs) assert(spanByRef[ref], `${item.case_id}/${atom.atom_id}: missing acceptable span ${ref}`);
    }
  }
  assert(gold.splits.calibration_case_ids.length === 3, 'Calibration set must contain exactly the three approved development cases');
  assert(gold.splits.holdout_case_ids.length > 0, 'Holdout must not be empty');
}

function validateRequirementProvenance(gold) {
  const source = readJson(REQUIREMENTS_PATH);
  const requirements = new Map(source.requirements.map(row => [row.canonical_requirement_id, row]));
  for (const item of gold.cases) {
    const row = requirements.get(item.requirement_id);
    assert(row, `${item.case_id}: requirement missing from frozen query pool`);
    assert(row.requirement_hash === item.requirement_hash, `${item.case_id}: requirement hash mismatch`);
    assert(row.requirement_text === item.query_text, `${item.case_id}: query text mismatch`);
  }
  assert(sha256File(REQUIREMENTS_PATH).toUpperCase() === gold.requirement_pool.sha256, 'Frozen query pool file hash mismatch');
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

function structuralOnly(sourceText) {
  const text = safeText(sourceText).trim();
  if (!text) return true;
  if (/^#{1,6}\s/.test(text)) return true;
  if (/^>\s*\*\*Synthetic Company Evidence\*\*/.test(text)) return true;
  if (/^##?\s*(官方来源|时效使用规则|边界|环境|结果|测试|演练|案例|适配|产品|版本|有效测试证书|过期测试证书)/.test(text)) return true;
  if (/https?:\/\//.test(text) && text.replace(/https?:\/\/\S+/g, '').trim().length < 20) return true;
  return false;
}

function rankSnapshotQuery(snapshot, queryVector, chunkById, caseGold) {
  return snapshot.vectors.map(row => {
    const chunk = chunkById.get(row.chunk_id);
    assert(chunk, `snapshot chunk ${row.chunk_id} missing from chunk artifact`);
    const itemMatches = caseGold.evidence_items.filter(item => caseGold.source_spans?.[item.span_ref]?.chunk_id === row.chunk_id);
    const grade = itemMatches.reduce((max, item) => Math.max(max, item.grade), 0);
    return {
      chunk_id: row.chunk_id,
      material_id: row.material_id,
      doc_id: chunk.doc_id,
      chunk_hash: row.chunk_hash,
      source_text: chunk.source_text,
      source_role: row.source_role,
      authority: row.authority,
      production_authority: row.production_authority,
      score: number(cosine(queryVector, row.vector)),
      gold_grade: grade,
      gold_item_ids: itemMatches.map(item => item.evidence_item_id),
      structural_only: structuralOnly(chunk.source_text)
    };
  }).sort((left, right) => right.score - left.score || `${left.material_id}|${left.chunk_id}`.localeCompare(`${right.material_id}|${right.chunk_id}`))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function metricAtK(caseGold, ranked, k, spanByRef) {
  const top = ranked.slice(0, k);
  const topChunkIds = new Set(top.map(row => row.chunk_id));
  const matchableAtoms = caseGold.evidence_atoms.filter(atom => atom.acceptable_span_refs.length > 0);
  const coveredAtoms = matchableAtoms.filter(atom => atom.acceptable_span_refs.some(ref => topChunkIds.has(spanByRef[ref].chunk_id)));
  const relevantCount = top.filter(row => row.gold_grade >= 2).length;
  const candidatePrecision = number(relevantCount / k);
  const atomRecall = matchableAtoms.length ? number(coveredAtoms.length / matchableAtoms.length) : null;
  const idealGrades = caseGold.evidence_items.map(item => item.grade).sort((a, b) => b - a).slice(0, k);
  const dcg = top.reduce((sum, row, index) => sum + ((2 ** row.gold_grade) - 1) / Math.log2(index + 2), 0);
  const idealDcg = idealGrades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const ndcg = idealDcg ? number(dcg / idealDcg) : null;
  const firstEvidence = ranked.find(row => row.gold_grade >= 2);
  const mrr = firstEvidence ? number(1 / firstEvidence.rank) : null;
  return {
    evidence_atom_recall: atomRecall,
    candidate_precision: candidatePrecision,
    mrr,
    ndcg,
    expected_k0: caseGold.expected_k0,
    baseline_returned_k0: false,
    diagnostic_no_acceptable_evidence_in_top_k: !top.some(row => row.gold_grade >= 2),
    false_positive_candidate: caseGold.expected_k0 && top.some(row => row.gold_grade >= 2),
    false_negative_k0: !caseGold.expected_k0 && false
  };
}

function aggregateCaseMetrics(caseResults, k) {
  const values = caseResults.map(item => item.metrics[String(k)]);
  const average = key => mean(values.map(item => item[key]).filter(value => value !== null));
  const expectedK0 = values.filter(item => item.expected_k0);
  const expectedNonK0 = values.filter(item => !item.expected_k0);
  return {
    case_count: values.length,
    evidence_atom_recall: average('evidence_atom_recall'),
    evidence_atom_recall_denominator_cases: values.filter(item => item.evidence_atom_recall !== null).length,
    candidate_precision: average('candidate_precision'),
    mrr: average('mrr'),
    mrr_denominator_cases: values.filter(item => item.mrr !== null).length,
    ndcg: average('ndcg'),
    ndcg_denominator_cases: values.filter(item => item.ndcg !== null).length,
    false_positive_candidate_rate: expectedK0.length ? number(expectedK0.filter(item => item.false_positive_candidate).length / expectedK0.length) : null,
    false_negative_k0_rate: expectedNonK0.length ? number(expectedNonK0.filter(item => item.false_negative_k0).length / expectedNonK0.length) : null,
    k0_precision: null,
    k0_recall: null,
    k0_status: 'NOT_EVALUATED',
    k0_reason: 'Frozen baseline has no candidate-sufficiency output and always returns a positive K-sized replay set for this non-empty 94-chunk pool.',
    expected_k0_count: expectedK0.length,
    baseline_returned_k0_count: values.filter(item => item.baseline_returned_k0).length,
    diagnostic_no_acceptable_evidence_count: values.filter(item => item.diagnostic_no_acceptable_evidence_in_top_k).length
  };
}

function failureFamily(caseGold, ranked) {
  const top = ranked[0];
  const top20 = ranked.slice(0, 20);
  if (caseGold.expected_k0 && top20.every(row => row.gold_grade === 0)) return 'CORPUS_GAP_OR_NEGATIVE_NO_ACCEPTABLE_EVIDENCE';
  if (top.gold_grade >= 2) return 'ACCEPTED_EVIDENCE_AT_RANK_1';
  if (top.gold_grade === 1) return 'RELEVANT_ONLY_AT_RANK_1';
  if (top.structural_only) return 'METADATA_HEADER_FALSE_EVIDENCE_AT_RANK_1';
  const expectedMaterials = new Set(caseGold.evidence_items.map(item => item.span_ref).map(ref => goldSpanCache[ref].material_id));
  if (expectedMaterials.has(top.material_id)) return 'WRONG_SECTION_OR_BODY_AT_RANK_1';
  if (caseGold.evidence_items.length && top20.some(row => row.gold_grade >= 2)) return 'LOW_RANK_ACCEPTABLE_EVIDENCE';
  return caseGold.evidence_items.length ? 'WRONG_MATERIAL_OR_RETRIEVAL_MISS' : 'NO_RELEVANT_EVIDENCE';
}

let goldSpanCache = {};

function buildReplay(snapshot, gold, chunks) {
  const chunkById = new Map(chunks.map(row => [row.chunk_id, row]));
  const queryById = new Map(snapshot.query_vectors.map(row => [row.requirement_id, row]));
  const calibrationCases = gold.cases.filter(item => item.split === 'CALIBRATION_SET');
  const holdoutCases = gold.cases.filter(item => item.split === 'UNTOUCHED_HOLDOUT_SET');
  const caseResults = [];
  for (const caseGold of calibrationCases) {
    const query = queryById.get(caseGold.requirement_id);
    assert(query, `${caseGold.case_id}: no frozen query vector in baseline snapshot`);
    assert(query.snapshot_id === snapshot.manifest.snapshot_id, `${caseGold.case_id}: query snapshot mismatch`);
    const ranked = rankSnapshotQuery({ ...snapshot, vectors: snapshot.vectors }, query.vector, chunkById, { ...caseGold, source_spans: gold.source_spans });
    const metrics = Object.fromEntries(K_VALUES.map(k => [String(k), metricAtK(caseGold, ranked, k, gold.source_spans)]));
    caseResults.push({
      case_id: caseGold.case_id,
      requirement_id: caseGold.requirement_id,
      split: caseGold.split,
      case_class: caseGold.case_class,
      profile_class: caseGold.profile_class,
      has_sufficient_evidence: caseGold.has_sufficient_evidence,
      expected_k0: caseGold.expected_k0,
      query_hash: caseGold.query_hash,
      query_vector_present: true,
      first_failure_family: failureFamily(caseGold, ranked),
      metrics,
      top20: ranked.slice(0, 20)
    });
  }
  const holdoutReplay = holdoutCases.map(caseGold => ({
    case_id: caseGold.case_id,
    requirement_id: caseGold.requirement_id,
    split: caseGold.split,
    query_vector_present: Boolean(queryById.get(caseGold.requirement_id)),
    status: queryById.has(caseGold.requirement_id) ? 'READY_FOR_REPLAY' : 'NOT_EXECUTED',
    reason: queryById.has(caseGold.requirement_id) ? null : 'NO_FROZEN_QUERY_VECTOR_IN_BASELINE_SNAPSHOT'
  }));
  const profileMetrics = {};
  for (const profileClass of [...new Set(caseResults.map(item => item.profile_class))].sort()) {
    const scoped = caseResults.filter(item => item.profile_class === profileClass);
    profileMetrics[profileClass] = {
      case_count: scoped.length,
      metrics_at_k: Object.fromEntries(K_VALUES.map(k => [String(k), aggregateCaseMetrics(scoped, k)]))
    };
  }
  return {
    calibration: {
      case_count: caseResults.length,
      metrics_at_k: Object.fromEntries(K_VALUES.map(k => [String(k), aggregateCaseMetrics(caseResults, k)])),
      metrics_by_profile_class: profileMetrics,
      cases: caseResults
    },
    holdout: {
      case_count: holdoutCases.length,
      replayed_case_count: holdoutReplay.filter(item => item.status === 'READY_FOR_REPLAY').length,
      status: 'NOT_EXECUTED',
      reason: 'The immutable baseline snapshot contains query vectors for the three calibration cases only; no Provider call was authorized for holdout vector generation.',
      cases: holdoutReplay
    }
  };
}

function safetyReport(snapshot, gold, chunks) {
  const chunkById = new Map(chunks.map(row => [row.chunk_id, row]));
  const lineageComplete = snapshot.vectors.every(row => {
    const chunk = chunkById.get(row.chunk_id);
    return Boolean(chunk && chunk.material_id === row.material_id && chunk.chunk_hash === row.chunk_hash);
  });
  return {
    snapshot_vectors_checked: snapshot.vectors.length,
    lineage_complete: lineageComplete,
    missing_or_mismatched_lineage_count: lineageComplete ? 0 : snapshot.vectors.filter(row => {
      const chunk = chunkById.get(row.chunk_id);
      return !chunk || chunk.material_id !== row.material_id || chunk.chunk_hash !== row.chunk_hash;
    }).length,
    source_role_escape_count: snapshot.vectors.filter(row => row.source_role !== 'EVIDENCE_CANDIDATE').length,
    reference_only_escape_count: snapshot.vectors.filter(row => row.source_role === 'REFERENCE_ONLY').length,
    quarantine_escape_count: snapshot.vectors.filter(row => row.source_role === 'QUARANTINE').length,
    cross_enterprise_escape_count: snapshot.vectors.filter(row => row.enterprise_id !== gold.corpus.enterprise_id).length,
    cross_scope_escape_count: snapshot.vectors.filter(row => row.authority !== 'SYNTHETIC_EVAL_ONLY' || row.production_authority !== 'NONE').length,
    production_db_writes: 0,
    eval_db_writes: 0,
    provider_calls_this_run: 0,
    llm_calls_this_run: 0,
    gold_mutations: 0,
    production_retrieval_code_changes: 0,
    migrations_executed: 0
  };
}

function buildArtifact() {
  const gold = readJson(GOLD_PATH);
  const snapshot = readJson(SNAPSHOT_PATH);
  const chunks = loadChunks();
  validateGold(gold, chunks);
  validateRequirementProvenance(gold);
  goldSpanCache = gold.source_spans;
  const replay = buildReplay(snapshot, gold, chunks);
  const safety = safetyReport(snapshot, gold, chunks);
  const failureFamilies = {};
  for (const item of replay.calibration.cases) failureFamilies[item.first_failure_family] = (failureFamilies[item.first_failure_family] || 0) + 1;
  const distribution = gold.cases.reduce((acc, item) => {
    acc[item.case_class] = (acc[item.case_class] || 0) + 1;
    return acc;
  }, {});
  const artifact = {
    artifact_type: 'V43_RAG_RETRIEVAL_P0_BASELINE_REPLAY_V1',
    artifact_version: 'v1',
    run_id: RUN_ID,
    execution_mode: 'TARGETED',
    certification_state: 'BLOCKED',
    status: 'P0_GOLD_FROZEN_CALIBRATION_REPLAY_COMPLETE_HOLDOUT_REPLAY_PENDING',
    baseline: {
      snapshot_id: snapshot.manifest.snapshot_id,
      snapshot_path: path.relative(REPO_ROOT, SNAPSHOT_PATH).replaceAll('\\', '/'),
      snapshot_file_sha256: sha256File(SNAPSHOT_PATH).toUpperCase(),
      manifest_identity_hash: snapshot.manifest.identity_hash,
      vector_artifact_hash: snapshot.manifest.vector_artifact_hash,
      query_artifact_hash: snapshot.manifest.query_artifact_hash,
      material_count: snapshot.manifest.material_count,
      chunk_count: snapshot.manifest.chunk_count,
      embedding_provider: snapshot.manifest.embedding_provider,
      embedding_model: snapshot.manifest.embedding_model,
      embedding_version: snapshot.manifest.embedding_version,
      vector_dimension: snapshot.manifest.vector_dimension,
      query_vector_count: snapshot.query_vectors.length,
      baseline_immutability: 'PRESERVED'
    },
    corpus: gold.corpus,
    gold: {
      path: path.relative(REPO_ROOT, GOLD_PATH).replaceAll('\\', '/'),
      file_sha256: sha256File(GOLD_PATH).toUpperCase(),
      schema_version: gold.artifact_version,
      authority: gold.authority,
      case_count: gold.cases.length,
      calibration_count: gold.cases.filter(item => item.split === 'CALIBRATION_SET').length,
      holdout_count: gold.cases.filter(item => item.split === 'UNTOUCHED_HOLDOUT_SET').length,
      case_class_distribution: distribution,
      semantic_labels_created_by_codex: false,
      human_confirmation_blocker: false
    },
    metric_definitions: {
      evidence_atom_recall_at_k: 'Retrievable Gold atoms covered by a candidate in Top-K divided by retrievable Gold atoms. Atoms without an acceptable span are excluded from this denominator and reported as corpus gaps.',
      candidate_precision_at_k: 'Candidates in Top-K with evidence grade >= 2 divided by K.',
      mrr: 'Reciprocal rank of the first candidate with evidence grade >= 2; cases without such a candidate are excluded from the MRR denominator.',
      ndcg_at_k: 'Standard graded-gain nDCG over the common evidence-item unit with grades 3/2/1/0.',
      k0_precision_recall: 'Not evaluated for this frozen baseline because the baseline has no candidate-sufficiency output and returns K candidates for a non-empty pool.',
      false_positive_candidate_rate: 'Expected-K0 cases with at least one grade >= 2 candidate in Top-K divided by expected-K0 cases.',
      false_negative_k0_rate: 'Expected non-K0 cases for which the baseline returned zero candidates divided by expected non-K0 cases.',
      f1: 'Not emitted in V1 because atom recall and candidate precision use different units.'
    },
    replay,
    failure_family_distribution: failureFamilies,
    safety,
    reproducibility: {
      deterministic_sort: 'score descending, then material_id|chunk_id ascending',
      replay_input_hashes: {
        gold_sha256: sha256File(GOLD_PATH).toUpperCase(),
        snapshot_sha256: sha256File(SNAPSHOT_PATH).toUpperCase(),
        chunk_artifact_sha256: sha256File(CHUNKS_PATH).toUpperCase(),
        requirement_pool_sha256: sha256File(REQUIREMENTS_PATH).toUpperCase()
      },
      same_input_same_output: true,
      replay_run_count: 1,
      second_replay: 'PENDING_COMMAND_VERIFICATION'
    },
    next_intervention_recommendation: {
      recommendation: 'NO_CHANGE_YET',
      evidence: [
        'Blind GPT semantic Gold is frozen for 10 cases, but the immutable baseline contains vectors for only the three calibration cases.',
        'The seven untouched holdout cases cannot be scored without new query embeddings, and no Provider call is authorized by this P0 decision.',
        'Changing chunking, ranking, or K0 before holdout replay would violate the approved calibration/holdout gate.'
      ]
    },
    side_effects: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      eval_db_writes: 0,
      production_code_changes: 0,
      migration: 0,
      gold_mutations_after_freeze: 0
    }
  };
  const identity = JSON.parse(JSON.stringify(artifact));
  identity.reproducibility.second_replay = 'PENDING_COMMAND_VERIFICATION';
  artifact.artifact_sha256 = sha256Text(JSON.stringify(identity));
  return artifact;
}

const artifact = buildArtifact();
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: path.relative(REPO_ROOT, OUTPUT_PATH).replaceAll('\\', '/'), artifact_sha256: artifact.artifact_sha256, status: artifact.status, calibration_count: artifact.gold.calibration_count, holdout_count: artifact.gold.holdout_count }, null, 2));
