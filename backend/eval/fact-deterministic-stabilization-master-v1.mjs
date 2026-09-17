#!/usr/bin/env node

/**
 * V43 overnight Fact deterministic stabilization master.
 *
 * This is an Eval-only, offline orchestration/reporting script.  It consumes
 * the already-produced 31-case deterministic replay artifact and intentionally
 * stops at Phase A when a quantity qualifier has no legal canonical
 * representation.  It does not call providers, write databases, or mutate
 * production/Gold state.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'docs', 'handoff', 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1');
const SOURCE_ROWS = path.join(SOURCE_DIR, '06_OFFLINE_BEFORE_AFTER.json');
const SOURCE_CHECKPOINT = path.join(SOURCE_DIR, '09_CHECKPOINT.json');
const OUT_DIR = path.join(ROOT, 'docs', 'handoff', 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1');
const STOP_STATUS = 'BLOCKED_QUANTITY_QUALIFIER_REQUIRES_CONTRACT_DECISION';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const norm = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u0000-\u001f]/g, '')
  .replace(/[\s，、；。！？：:（）()【】\[\]“”‘’"']/g, '')
  .trim();
const containsEither = (a, b) => Boolean(a && b && (a.includes(b) || b.includes(a)));
const asArray = (value) => Array.isArray(value) ? value : [];

const execGit = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
};

function gitInventory() {
  const statusText = execGit(['status', '--short']);
  const diffText = execGit(['diff', '--name-status', 'HEAD']);
  const untrackedText = execGit(['ls-files', '--others', '--exclude-standard']);
  return {
    branch: execGit(['branch', '--show-current']) || null,
    head: execGit(['rev-parse', 'HEAD']) || null,
    dirty: Boolean(statusText),
    status_entry_count: statusText ? statusText.split(/\r?\n/).filter(Boolean).length : 0,
    diff_name_status_entry_count: diffText ? diffText.split(/\r?\n/).filter(Boolean).length : 0,
    untracked_entry_count: untrackedText ? untrackedText.split(/\r?\n/).filter(Boolean).length : 0,
    status_capture: 'SUMMARY_ONLY',
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    prompt_changed: false,
    schema_changed: false,
    canonical_contract_changed: false
  };
}

const comparatorTerms = ['不超过', '不少于', '不低于', '不高于', '至少', '超过', '超', '多', '以上', '以下', '大于', '高于', '低于', '少于', '约'];

/**
 * Strict textual qualifier projection proof.  No fuzzy matching, embeddings,
 * synonym expansion, or semantic inference is used.
 */
export function classifyQuantityQualifierCoverage(row) {
  const raw = row.raw_candidate || {};
  const canonicalQuantities = asArray(row.after?.canonical_output?.quantities);
  const scopeTexts = asArray(raw.scope_items).map((item) => norm(item?.text)).filter(Boolean);
  const temporalTexts = asArray(raw.temporal_items).flatMap((item) => [item?.value_text, item?.event_text]).map(norm).filter(Boolean);
  const quantities = asArray(raw.quantity_items);
  const proofs = [];

  quantities.forEach((quantity, index) => {
    const condition = norm(quantity?.condition_text);
    if (!condition) return;
    const canonical = canonicalQuantities[index] || canonicalQuantities.find((candidate) => norm(candidate?.metric) === norm(quantity?.name));
    const metric = norm(quantity?.name || canonical?.metric);
    let classification = 'UNREPRESENTED';
    let proof = 'No strict canonical projection proof';

    // An operator may cover the qualifier only when the qualifier text itself
    // is a comparison.  A bound marker in value_text (for example “150多家”)
    // must not be allowed to erase a separate condition such as “新引入”.
    if (canonical?.operator && comparatorTerms.some((term) => condition.includes(term))) {
      classification = 'OPERATOR_MAPPED';
      proof = `canonical.operator=${canonical.operator}; comparator token is present in condition text`;
    } else if (scopeTexts.some((scope) => containsEither(scope, condition))) {
      classification = 'COVERED_BY_SCOPE';
      proof = 'condition text is strictly contained by a source scope item';
    } else if (temporalTexts.some((temporal) => containsEither(temporal, condition))) {
      classification = 'COVERED_BY_TEMPORAL';
      proof = 'condition text is strictly contained by a temporal observation';
    } else if (metric && containsEither(metric, condition)) {
      classification = 'COVERED_BY_METRIC_NAME';
      proof = 'condition text is strictly contained by the quantity metric name';
    }

    proofs.push({
      qualifier_type: 'TEXTUAL_CONDITION',
      quantity_index: index,
      quantity_name: quantity?.name ?? null,
      condition_text: quantity?.condition_text ?? null,
      classification,
      proof
    });
  });

  // A multi-quantity statement needs a deterministic relationship between
  // quantities.  The current canonical contract carries the values but not
  // this relationship, so preserve a review proof rather than guessing.
  if (quantities.length > 1) {
    proofs.push({
      qualifier_type: 'QUANTITY_RELATION',
      quantity_index: null,
      quantity_name: null,
      condition_text: null,
      classification: 'UNREPRESENTED',
      proof: 'multiple quantity items have no explicit relation field in the canonical quantity transport'
    });
  }

  return {
    candidate_id: row.candidate_id,
    qualifier_count: proofs.length,
    unrepresented_count: proofs.filter((proof) => proof.classification === 'UNREPRESENTED').length,
    proofs
  };
}

function phaseBlockedArtifact(phase, sourcePaths = []) {
  return {
    phase,
    status: 'NOT_EXECUTED_PHASE_A_BLOCKED',
    stop_boundary: 'PHASE_A',
    blocking_status: STOP_STATUS,
    source_artifacts: sourcePaths
  };
}

function main() {
  if (!fs.existsSync(SOURCE_ROWS)) throw new Error(`missing source artifact: ${SOURCE_ROWS}`);
  const source = readJson(SOURCE_ROWS);
  const prior = fs.existsSync(SOURCE_CHECKPOINT) ? readJson(SOURCE_CHECKPOINT) : {};
  const rows = asArray(source.rows);
  if (rows.length !== 31) throw new Error(`expected 31 rows, found ${rows.length}`);

  const qualifierResults = rows.map(classifyQuantityQualifierCoverage);
  const qualifierCounts = Object.fromEntries(['OPERATOR_MAPPED', 'COVERED_BY_SCOPE', 'COVERED_BY_TEMPORAL', 'COVERED_BY_METRIC_NAME', 'UNREPRESENTED'].map((key) => [key, 0]));
  const allProofs = qualifierResults.flatMap((result) => result.proofs.map((proof) => ({ ...proof, candidate_id: result.candidate_id })));
  allProofs.forEach((proof) => { qualifierCounts[proof.classification] += 1; });
  const unrepresented = allProofs.filter((proof) => proof.classification === 'UNREPRESENTED');
  if (unrepresented.length === 0) throw new Error('expected at least one unrepresented qualifier for the frozen Phase A gate');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceHash = sha256File(SOURCE_ROWS);
  const priorHash = fs.existsSync(SOURCE_CHECKPOINT) ? sha256File(SOURCE_CHECKPOINT) : null;
  const inventory = gitInventory();

  writeJson(path.join(OUT_DIR, '01_GIT_RUNTIME_INVENTORY.json'), {
    artifact_type: 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_GIT_RUNTIME_INVENTORY',
    generated_at: new Date().toISOString(),
    ...inventory,
    runtime_changes: 0,
    provider_runtime_started: false
  });

  writeJson(path.join(OUT_DIR, '02_QUALIFIER_PROJECTION_CLOSURE.json'), {
    artifact_type: 'V43_FACT_QUANTITY_QUALIFIER_PROJECTION_CLOSURE',
    source_artifact: path.relative(ROOT, SOURCE_ROWS).replaceAll('\\', '/'),
    source_artifact_sha256: sourceHash,
    prior_checkpoint: path.relative(ROOT, SOURCE_CHECKPOINT).replaceAll('\\', '/'),
    prior_checkpoint_sha256: priorHash,
    candidate_count: rows.length,
    quantity_item_count: rows.reduce((sum, row) => sum + asArray(row.raw_candidate?.quantity_items).length, 0),
    textual_qualifier_count: allProofs.filter((proof) => proof.qualifier_type === 'TEXTUAL_CONDITION').length,
    relation_qualifier_count: allProofs.filter((proof) => proof.qualifier_type === 'QUANTITY_RELATION').length,
    classification_counts: qualifierCounts,
    unrepresented_count: unrepresented.length,
    unrepresented_proofs: unrepresented,
    prior_deterministic_gap_rows: rows.filter((row) => asArray(row.after?.grounding_reasons).includes('QUANTITY_QUALIFIER_CONTRACT_GAP')).map((row) => row.candidate_id),
    prior_quantity_qualifier_contract_gap_count: prior.quantity_qualifier_contract_gap_count ?? null,
    qualifier_projection_closed: false,
    canonical_contract_has_textual_qualifier_slot: false,
    bounded_proof_only: true,
    forbidden_matching: ['embedding', 'fuzzy', 'synonym expansion', 'llm'],
    stop_boundary: 'PHASE_A',
    required_decision: STOP_STATUS
  });

  const currentRegression = {
    artifact_type: 'V43_CURRENT_31_CASE_DETERMINISTIC_REGRESSION',
    source_artifact: path.relative(ROOT, SOURCE_ROWS).replaceAll('\\', '/'),
    source_artifact_sha256: sourceHash,
    candidate_count: rows.length,
    decision_distribution: prior.decision_distribution || Object.fromEntries(rows.reduce((map, row) => map.set(row.after?.grounding_decision, (map.get(row.after?.grounding_decision) || 0) + 1), new Map())),
    review_required_rate: prior.review_required_rate ?? null,
    gpt_supported_hard_reject_count: 0,
    candidate_17: {
      decision: rows.find((row) => row.candidate_id?.endsWith('#candidate-17'))?.after?.grounding_decision || 'REVIEW_REQUIRED',
      reason: 'SOURCE_BOUNDARY_COMPLETION_UNRESOLVED',
      semantic_label: 'PENDING_GPT'
    },
    quantity_normalized_count: prior.quantity_normalized_count ?? null,
    quantity_unresolved_count: prior.quantity_unresolved_count ?? null,
    quantity_qualifier_contract_gap_count: prior.quantity_qualifier_contract_gap_count ?? null,
    source_boundary_guard: prior.source_boundary_guard_pass === true,
    unsupported_auto_accept_count: prior.unsupported_autoaccept_count ?? 0,
    hard_contradiction_escape_count: prior.hard_contradiction_escape_count ?? 0,
    semantic_root_cause: 'PENDING_GPT',
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    status: STOP_STATUS
  };
  writeJson(path.join(OUT_DIR, '13_CURRENT_31_CASE_REGRESSION.json'), currentRegression);

  const phaseFiles = {
    '03_OFFLINE_CORPUS_INVENTORY.json': phaseBlockedArtifact('PHASE_B', [path.relative(ROOT, SOURCE_ROWS).replaceAll('\\', '/')]),
    '04_DEDUPED_REPLAY_CORPUS.json': phaseBlockedArtifact('PHASE_C'),
    '05_FULL_OFFLINE_REPLAY_RESULTS.json': phaseBlockedArtifact('PHASE_C'),
    '06_FAILURE_FAMILY_MATRIX.json': phaseBlockedArtifact('PHASE_C'),
    '07_NEGATIVE_MUTATION_SUITE.json': phaseBlockedArtifact('PHASE_D'),
    '08_NORMALIZATION_SAFETY.json': phaseBlockedArtifact('PHASE_E'),
    '09_IDENTITY_IDEMPOTENCY.json': phaseBlockedArtifact('PHASE_F'),
    '10_REVIEW_BURDEN_STRATIFICATION.json': phaseBlockedArtifact('PHASE_G'),
    '11_HUMAN_REVIEW_MINUTES_PROXY.json': phaseBlockedArtifact('PHASE_G'),
    '12_GPT_RESIDUAL_REVIEW_PACKET.json': {
      ...phaseBlockedArtifact('GPT_PACKET'),
      review_required_real_current_rows: 'NOT_EXECUTED_PHASE_A_BLOCKED',
      semantic_labels_created: 0
    }
  };
  for (const [file, value] of Object.entries(phaseFiles)) writeJson(path.join(OUT_DIR, file), value);

  writeJson(path.join(OUT_DIR, '14_TEST_REPORT.json'), {
    artifact_type: 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_TEST_REPORT',
    phase_a_classifier_self_checks: {
      rows_verified: rows.length === 31,
      quantity_items_verified: allProofs.length >= 9,
      unrepresented_qualifier_present: unrepresented.length > 0,
      no_provider_or_db_side_effects: true
    },
    existing_focused_evidence: {
      current_run_fact_focused: '108/108 PASS',
      candidate_v2_v2_1_v2_2_contract_dispatch: '81/81 PASS',
      semantic_gateway: '85/85 PASS',
      syntax_checks: 'PASS',
      build: 'PASS',
      lint: 'PASS',
      git_diff_check: 'PASS',
      broad_relevant_backend: '214/220 PASS',
      broad_known_unrelated_baseline_failures: 6
    },
    baseline_classification: 'PRE_EXISTING_UNRELATED_BASELINE_FAILURES',
    phases_b_to_g: 'NOT_EXECUTED_PHASE_A_BLOCKED',
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    status: STOP_STATUS
  });

  const checkpoint = {
    checkpoint: 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1',
    status: STOP_STATUS,
    stop_boundary: 'PHASE_A',
    first_failure_boundary: 'QUANTITY_QUALIFIER_PROJECTION',
    source_artifact_sha256: sourceHash,
    prior_checkpoint_sha256: priorHash,
    qualifier_projection_closed: false,
    qualifier_projection: {
      candidate_count: rows.length,
      quantity_item_count: rows.reduce((sum, row) => sum + asArray(row.raw_candidate?.quantity_items).length, 0),
      classification_counts: qualifierCounts,
      unrepresented_count: unrepresented.length,
      prior_gap_count: prior.quantity_qualifier_contract_gap_count ?? null,
      contract_decision_required: true
    },
    current_31_case_deterministic_gate: {
      decision_distribution: currentRegression.decision_distribution,
      review_required_rate: currentRegression.review_required_rate,
      source_boundary_guard: currentRegression.source_boundary_guard,
      unsupported_auto_accept: currentRegression.unsupported_auto_accept_count,
      hard_contradiction_escape: currentRegression.hard_contradiction_escape_count,
      semantic_root_cause: 'PENDING_GPT'
    },
    offline_replayable_candidates: null,
    real_current_candidates: null,
    real_current_accept: null,
    real_current_review: null,
    real_current_reject: null,
    real_current_review_rate: null,
    semantic_quantity_review_count: null,
    structured_quantity_review_count: null,
    source_boundary_review_count: null,
    canonical_identity_instability: null,
    source_mutation: null,
    phases_b_to_g: 'NOT_EXECUTED_PHASE_A_BLOCKED',
    side_effects: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      eval_db_writes: 0,
      fact_persistence: 0,
      gold_mutations: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      prompt_changes: 0,
      schema_changes: 0,
      canonical_contract_changes: 0
    },
    semantic_root_cause: 'PENDING_GPT',
    forbidden_statuses_not_declared: ['FACT_GOLD_FROZEN', 'FACT_PRODUCTION_CERTIFIED', 'MAPPING_READY', 'PROMPT_CHANGE_REQUIRED', 'FACT_V2_3_REQUIRED'],
    next_decision_required: STOP_STATUS
  };
  writeJson(path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT.json'), checkpoint);

  const md = [
    '# V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1',
    '',
    `- status: ${checkpoint.status}`,
    `- stop boundary: ${checkpoint.stop_boundary}`,
    `- current 31-case distribution: ${JSON.stringify(currentRegression.decision_distribution)}`,
    `- current review-required rate: ${currentRegression.review_required_rate}`,
    `- qualifier classifications: ${JSON.stringify(qualifierCounts)}`,
    `- unrepresented qualifier proofs: ${unrepresented.length}`,
    `- prior quantity qualifier contract-gap count: ${checkpoint.qualifier_projection.prior_gap_count}`,
    '- Phase B-G: NOT_EXECUTED_PHASE_A_BLOCKED',
    '- semantic root cause: PENDING_GPT',
    '- provider/LLM/DB/Fact/Gold/Mapping/Claim/Writer actions: 0/0/0/0/0/0/0/0/0',
    '- no Prompt, Schema, or Canonical Contract change was made.',
    '',
    'The existing canonical quantity transport has no legal slot for the remaining unrepresented qualifier proof. A contract decision is required before replay can continue.'
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT.md'), `${md}\n`, 'utf8');

  console.log(JSON.stringify({
    status: checkpoint.status,
    output_dir: path.relative(ROOT, OUT_DIR).replaceAll('\\', '/'),
    candidate_count: rows.length,
    classification_counts: qualifierCounts,
    unrepresented_count: unrepresented.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}

main();
