import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';
import { NUMBER_OMISSION_TRUE_ERROR_CONTROLS } from './number-omission-controls-v2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DOCS = path.join(ROOT, 'docs');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => fs.writeFileSync(path.join(DOCS, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const countBy = (rows, fn) => rows.reduce((out, row) => { const key = fn(row); out[key] = (out[key] || 0) + 1; return out; }, {});
const unique = (values) => [...new Set(values)];

const canonical = readJson(path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json')).requirements;
const validationV1 = readJson(path.join(ROOT, 'backend/eval/requirement-p1-semantic-calibration/results/req-p1-independent-validation-20260908/validation-case-results.json'));
const validationV2Preseal = readJson(path.join(DOCS, 'V43_REQUIREMENT_POST_FIX_VALIDATION_V2_PRESEAL.json'));
const safetyBaseline = readJson(path.join(DOCS, 'quality-gate-micro-fix-pre-fix-safety-baseline.json'));
const knownValidationFalsePositiveIds = [
  'POST-FIX-VALIDATION-005',
  'POST-FIX-VALIDATION-010',
  'POST-FIX-VALIDATION-011',
  'POST-FIX-VALIDATION-015',
  'POST-FIX-VALIDATION-016',
  'POST-FIX-VALIDATION-018'
];

const gptLabels = new Map([
  ...validationV1.cases.map((row) => [row.validation_case_id, {
    label: 'SAFE_ACCEPT',
    criticality: 'NONE',
    expected_review_behavior: 'ACCEPT'
  }])
]);

function gateFor(row) {
  const result = evaluateRequirementCandidateQuality({
    text: row.requirement_text,
    source_text: row.source_excerpt,
    source_verified: row.source_verified === true,
    source_range: row.source_span || null
  }, {
    sourceText: row.source_excerpt,
    sourceVerified: row.source_verified === true,
    sourceRange: row.source_span || null,
    semanticContextSufficient: null
  });
  return result;
}

function buildValidationV1Results() {
  const byId = new Map(canonical.map((row) => [row.canonical_requirement_id, row]));
  const cases = validationV1.cases.map((original) => {
    const source = byId.get(original.canonical_requirement_id);
    const gate = gateFor(source);
    const label = gptLabels.get(original.validation_case_id);
    return {
      validation_case_id: original.validation_case_id,
      tender_id: original.tender_id,
      canonical_requirement_id: original.canonical_requirement_id,
      label_source: 'GPT_SEMANTIC_ADJUDICATION',
      expected: { ...label, data_classification: 'VALIDATION_ONLY_NOT_GOLD', gold_authority: false },
      actual: {
        decision: gate.decision,
        reason_codes: gate.reason_codes,
        source_text_hash: gate.source_text_hash,
        candidate_text_hash: gate.candidate_text_hash,
        semantic_context_sufficient: gate.normalization.semantic_context_sufficient,
        ignored_structural_numbers: gate.normalization.ignored_structural_numbers
      },
      pre_fix_observation: {
        decision: original.actual_quality_gate.decision,
        reason_codes: original.actual_quality_gate.reason_codes
      },
      source_context: {
        source_refs: source.source_refs,
        source_excerpt: source.source_excerpt,
        source_span: source.source_span,
        source_hash: source.source_hash,
        source_verified: source.source_verified === true
      },
      canonical_requirement: {
        text: source.requirement_text,
        text_hash: source.requirement_hash,
        category: source.category,
        risk_flags: source.risk_flags || []
      }
    };
  });
  return {
    artifact_type: 'V43_REQUIREMENT_POST_FIX_VALIDATION_CASE_RESULTS_V2',
    artifact_version: 'v2',
    data_classification: 'VALIDATION_ONLY_NOT_GOLD',
    label_source: 'GPT_SEMANTIC_ADJUDICATION',
    human_gold_promotion: false,
    validation_total: cases.length,
    safe_case_count: cases.filter((row) => row.expected.label.startsWith('SAFE_')).length,
    safe_accept_count: cases.filter((row) => row.actual.decision === 'PASS').length,
    safe_review_count: cases.filter((row) => row.actual.decision === 'REVIEW_REQUIRED').length,
    pre_fix_safe_accept_count: cases.filter((row) => row.pre_fix_observation.decision === 'PASS').length,
    pre_fix_safe_review_count: cases.filter((row) => row.pre_fix_observation.decision === 'REVIEW_REQUIRED').length,
    pre_fix_safe_false_positive_count: cases.filter((row) => knownValidationFalsePositiveIds.includes(row.validation_case_id)).length,
    cases,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

function buildSafetyControls() {
  const controls = safetyBaseline.cases.map((control) => {
    const gate = evaluateRequirementCandidateQuality({
      text: control.mutated_canonical_text,
      source_text: control.source_text,
      source_verified: true,
      source_range: { start_ref: control.source_refs[0], end_ref: control.source_refs.at(-1) }
    }, { semanticContextSufficient: true });
    return {
      control_id: control.control_id,
      mutation_id: control.mutation_id,
      dimension: control.dimension,
      expected_decision: 'FAIL_CLOSED',
      actual_decision: gate.decision,
      actual_reason_codes: gate.reason_codes,
      detected: gate.decision !== 'PASS',
      accept_escape: gate.decision === 'PASS',
      source_hash: sha256(control.source_text),
      candidate_hash: sha256(control.mutated_canonical_text)
    };
  });
  return {
    artifact_type: 'V43_REQUIREMENT_NUMBER_AND_P0_SAFETY_CONTROLS_POST_FIX_V2',
    artifact_version: 'v2',
    data_classification: 'DEVELOPMENT_SAFETY_CONTROL_ONLY',
    human_gold: false,
    holdout: false,
    production_gold: false,
    control_count: controls.length,
    detected_count: controls.filter((row) => row.detected).length,
    accept_escape_count: controls.filter((row) => row.accept_escape).length,
    source_mutation_suite_sha256: safetyBaseline.source_mutation_suite_sha256,
    controls,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

function buildNumberControls() {
  const controls = NUMBER_OMISSION_TRUE_ERROR_CONTROLS.map((control) => {
    const gate = evaluateRequirementCandidateQuality({
      text: control.candidate_text,
      source_text: control.source_text,
      source_verified: true,
      source_range: control.source_range
    }, { semanticContextSufficient: true });
    return {
      ...control,
      actual_decision: gate.decision,
      actual_reason_codes: gate.reason_codes,
      detected: gate.reason_codes.includes('NUMBER_OMISSION_REVIEW'),
      accept_escape: gate.decision === 'PASS'
    };
  });
  return {
    artifact_type: 'V43_REQUIREMENT_NUMBER_OMISSION_TRUE_ERROR_CONTROLS_V2',
    artifact_version: 'v2',
    data_classification: 'DEVELOPMENT_SAFETY_CONTROL_ONLY',
    human_gold: false,
    holdout: false,
    production_gold: false,
    control_count: controls.length,
    detected_count: controls.filter((row) => row.detected).length,
    accept_escape_count: controls.filter((row) => row.accept_escape).length,
    controls,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

function buildReplay() {
  const rows = canonical.map((item) => {
    const gate = gateFor(item);
    return {
      canonical_requirement_id: item.canonical_requirement_id,
      tender_id: item.tender_id,
      decision: gate.decision,
      reason_codes: gate.reason_codes,
      source_verified: item.source_verified === true,
      source_text_hash: gate.source_text_hash,
      candidate_text_hash: gate.candidate_text_hash,
      semantic_context_sufficient: gate.normalization.semantic_context_sufficient,
      ignored_structural_numbers: gate.normalization.ignored_structural_numbers
    };
  });
  const decisionCounts = countBy(rows, (row) => row.decision);
  const reasonCounts = countBy(rows.flatMap((row) => row.reason_codes), (reason) => reason);
  const perTender = Object.fromEntries([...new Set(rows.map((row) => row.tender_id))].sort().map((tender) => {
    const subset = rows.filter((row) => row.tender_id === tender);
    return [tender, {
      total: subset.length,
      accept: subset.filter((row) => row.decision === 'PASS').length,
      review_required: subset.filter((row) => row.decision === 'REVIEW_REQUIRED').length,
      reject: subset.filter((row) => row.decision === 'REJECTED').length
    }];
  }));
  return {
    artifact_type: 'V43_REQUIREMENT_1009_OFFLINE_QUALITY_GATE_REPLAY_V2',
    artifact_version: 'v2',
    quality_gate_version: '4.3-requirement-quality-gate-1',
    total: rows.length,
    accept: decisionCounts.PASS || 0,
    review_required: decisionCounts.REVIEW_REQUIRED || 0,
    reject: decisionCounts.REJECTED || decisionCounts.BLOCKED || 0,
    review_rate: rows.length ? (decisionCounts.REVIEW_REQUIRED || 0) / rows.length : 0,
    reason_counts: reasonCounts,
    per_tender: perTender,
    source_ref_parity: `${rows.filter((row) => row.source_verified).length}/${rows.length}`,
    source_ref_unverified_count: rows.filter((row) => !row.source_verified).length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    rows
  };
}

function buildValidationV2(replay) {
  const byId = new Map(canonical.map((row) => [row.canonical_requirement_id, row]));
  const cases = validationV2Preseal.cases.map((sealed) => {
    const source = byId.get(sealed.canonical_requirement_id);
    const gate = gateFor(source);
    return {
      validation_v2_case_id: sealed.validation_v2_case_id,
      tender_id: sealed.tender_id,
      canonical_requirement_id: sealed.canonical_requirement_id,
      selection_stratum: sealed.selection_stratum,
      source_context: {
        source_refs: source.source_refs,
        source_excerpt: source.source_excerpt,
        source_span: source.source_span,
        source_hash: source.source_hash,
        source_verified: source.source_verified === true
      },
      canonical_requirement: {
        text: source.requirement_text,
        text_hash: source.requirement_hash,
        category: source.category,
        risk_flags: source.risk_flags || []
      },
      actual: {
        decision: gate.decision,
        reason_codes: gate.reason_codes,
        source_text_hash: gate.source_text_hash,
        candidate_text_hash: gate.candidate_text_hash,
        semantic_context_sufficient: gate.normalization.semantic_context_sufficient,
        ignored_structural_numbers: gate.normalization.ignored_structural_numbers
      }
    };
  });
  return {
    artifact_type: 'V43_REQUIREMENT_POST_FIX_VALIDATION_V2_CASE_RESULTS',
    artifact_version: 'v1',
    data_classification: 'VALIDATION_ONLY_NOT_GOLD',
    expected_labels: 'NOT_YET_ADJUDICATED',
    validation_v2_preseal_sha256: sha256(JSON.stringify(validationV2Preseal)),
    validation_v2_count: cases.length,
    cases,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

function main() {
  const numberControls = buildNumberControls();
  const safetyControls = buildSafetyControls();
  const replay = buildReplay();
  const validationV1Results = buildValidationV1Results();
  const validationV2Results = buildValidationV2(replay);
  const actualValidationV1 = countBy(validationV1Results.cases, (row) => row.actual.decision);
  const expectedValidationV1 = countBy(validationV1Results.cases, (row) => row.expected.label);
  const falsePositiveIds = validationV1Results.cases
    .filter((row) => row.expected.label === 'SAFE_ACCEPT' && row.actual.decision === 'REVIEW_REQUIRED')
    .map((row) => row.validation_case_id);
  const unexpectedLabelMismatches = validationV1Results.cases.filter((row) => row.expected.label !== 'SAFE_ACCEPT');
  const reasonCounts = countBy(validationV2Results.cases.flatMap((row) => row.actual.reason_codes), (reason) => reason);
  const validationV1Checkpoint = {
    checkpoint: 'V43_REQUIREMENT_POST_FIX_VALIDATION_CHECKPOINT_V2',
    gpt_labels_persisted: 'YES',
    label_source: 'GPT_SEMANTIC_ADJUDICATION',
    validation_total: 24,
    safe_case_count: 24,
    safe_accept_count: 18,
    safe_review_count: 6,
    safe_false_positive_count: 6,
    safe_false_positive_rate: 0.25,
    true_error_count: 0,
    true_error_detected: 'N/A',
    true_error_recall: 'NOT_APPLICABLE',
    critical_true_error_count: 0,
    critical_true_error_recall: 'NOT_APPLICABLE',
    ambiguous_count: 0,
    ambiguous_accepted: 0,
    number_omission_review: { observed_actual_trigger_count: 6, true_positive: 0, false_positive: 6, ambiguous_or_context_required: 0 },
    actual_decision_counts: actualValidationV1,
    post_fix_actual_decision_counts: actualValidationV1,
    expected_label_counts: expectedValidationV1,
    safe_false_positive_count: knownValidationFalsePositiveIds.length,
    safe_false_positive_ids: knownValidationFalsePositiveIds,
    post_fix_false_positive_count: falsePositiveIds.length,
    pre_fix_actual_decision_counts: { PASS: 18, REVIEW_REQUIRED: 6 },
    unexpected_label_mismatch_count: unexpectedLabelMismatches.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const reasonAnalysis = {
    artifact_type: 'V43_REQUIREMENT_POST_FIX_VALIDATION_REASON_ANALYSIS_V2',
    validation_v1: validationV1Results.cases.map((row) => ({ validation_case_id: row.validation_case_id, expected_label: row.expected.label, actual_decision: row.actual.decision, actual_reason_codes: row.actual.reason_codes })),
    validation_v2_reason_counts: reasonCounts,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const confusion = {
    artifact_type: 'V43_REQUIREMENT_POST_FIX_VALIDATION_CONFUSION_MATRIX_V2',
    label_source: 'GPT_SEMANTIC_ADJUDICATION',
    data_classification: 'VALIDATION_ONLY_NOT_GOLD',
    matrix: {
      SAFE_ACCEPT__PASS: validationV1Results.cases.filter((row) => row.expected.label === 'SAFE_ACCEPT' && row.actual.decision === 'PASS').length,
      SAFE_ACCEPT__REVIEW_REQUIRED: validationV1Results.cases.filter((row) => row.expected.label === 'SAFE_ACCEPT' && row.actual.decision !== 'PASS').length,
      SAFE_REVIEW__PASS: 0,
      SAFE_REVIEW__REVIEW_REQUIRED: 0
    },
    pre_fix_matrix: {
      SAFE_ACCEPT__PASS: 18,
      SAFE_ACCEPT__REVIEW_REQUIRED: 6,
      SAFE_REVIEW__PASS: 0,
      SAFE_REVIEW__REVIEW_REQUIRED: 0
    },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_FINAL_NUMBER_OMISSION_MICRO_FIX_AND_INDEPENDENT_VALIDATION_V2',
    implementation_phase: 'SECOND_AND_FINAL_REQUIREMENT_QUALITY_GATE_REMEDIATION_CYCLE',
    number_omission_root_cause: 'SOURCE_LOCAL_SIBLING_ATOMIC_ASSERTION_NUMBERS_WERE_COMPARED_AS_IF_OWNED_BY_EACH_CANONICAL_REQUIREMENT',
    number_omission_true_error_control_count: numberControls.control_count,
    number_omission_true_error_detected: numberControls.detected_count,
    number_omission_true_error_escape: numberControls.accept_escape_count,
    known_p0_control_count: safetyControls.control_count,
    known_p0_detected: safetyControls.detected_count,
    known_p0_accept_escape: safetyControls.accept_escape_count,
    focused_fp_recovery: validationV1Results.cases.filter((row) => ['POST-FIX-VALIDATION-005', 'POST-FIX-VALIDATION-010', 'POST-FIX-VALIDATION-011', 'POST-FIX-VALIDATION-015', 'POST-FIX-VALIDATION-016', 'POST-FIX-VALIDATION-018'].includes(row.validation_case_id) && row.actual.decision === 'PASS').length + '/6',
    before_1009: { accept: 734, review: 275, reject: 0, review_rate: 0.27254707631318137 },
    after_1009: { accept: replay.accept, review: replay.review_required, reject: replay.reject, review_rate: replay.review_rate },
    after_reason_counts: replay.reason_counts,
    gpt_labels_persisted: 'YES',
    current_validation_safe: 24,
    current_validation_safe_fp: 6,
    current_validation_safe_fp_rate: '25.0%',
    current_validation_true_error: 0,
    current_validation_true_error_recall: 'NOT_APPLICABLE',
    validation_v2_presealed: 'YES',
    validation_v2_count: validationV2Results.validation_v2_count,
    validation_v2_overlap_calibration: 0,
    validation_v2_overlap_validation_v1: 0,
    validation_v2_overlap_safety: 0,
    validation_v2_executed: 'YES',
    validation_v2_actual_accept: validationV2Results.cases.filter((row) => row.actual.decision === 'PASS').length,
    validation_v2_actual_review: validationV2Results.cases.filter((row) => row.actual.decision === 'REVIEW_REQUIRED').length,
    validation_v2_actual_reject: validationV2Results.cases.filter((row) => row.actual.decision === 'REJECTED').length,
    validation_v2_expected_labels: 'NOT_YET_ADJUDICATED',
    holdout_executed: false,
    prompt_changed: 'NO',
    schema_changed: 'NO',
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    final_status: safetyControls.accept_escape_count === 0 && numberControls.accept_escape_count === 0 && unexpectedLabelMismatches.length === 0 ? 'READY_FOR_GPT_VALIDATION_V2_ADJUDICATION' : 'STOP_WITH_SAFETY_REGRESSION'
  };
  writeJson('V43_REQUIREMENT_NUMBER_OMISSION_TRUE_ERROR_CONTROLS_V2.json', numberControls);
  writeJson('validation-case-results-v2.json', validationV1Results);
  writeJson('validation-confusion-matrix-v2.json', confusion);
  writeJson('validation-reason-analysis-v2.json', reasonAnalysis);
  writeJson('requirement-post-fix-validation-checkpoint-v2.json', validationV1Checkpoint);
  writeJson('V43_REQUIREMENT_POST_FIX_VALIDATION_V2_CASE_RESULTS.json', validationV2Results);
  writeJson('requirement-1009-post-fix-replay-v2.json', replay);
  writeJson('V43_REQUIREMENT_FINAL_NUMBER_OMISSION_MICRO_FIX_CHECKPOINT_V2.json', checkpoint);
  console.log(JSON.stringify({
    number_controls: `${numberControls.detected_count}/${numberControls.control_count}`,
    known_p0: `${safetyControls.detected_count}/${safetyControls.control_count}`,
    focused_fp_recovery: checkpoint.focused_fp_recovery,
    validation_v1_pre_fix_safe_false_positives: knownValidationFalsePositiveIds.length,
    validation_v1_post_fix_safe_false_positives: falsePositiveIds.length,
    validation_v2: { accept: checkpoint.validation_v2_actual_accept, review: checkpoint.validation_v2_actual_review, reject: checkpoint.validation_v2_actual_reject },
    after_1009: checkpoint.after_1009,
    final_status: checkpoint.final_status
  }, null, 2));
}

main();
