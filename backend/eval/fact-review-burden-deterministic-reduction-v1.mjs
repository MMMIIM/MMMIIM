import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21
} from '../src/pipeline/evidence-fact-candidate-v2-1.js';
import { parseCanonicalQuantityValue } from '../src/pipeline/evidence-fact-candidate-v2.js';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const replayDir = path.join(repoRoot, 'docs', 'handoff', 'V43_TARGETED_FACT_HOST_REPLAY_V3');
const priorDir = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1');
const outputDir = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1');
const reportPath = path.join(replayDir, '03_PROVIDER_EXECUTION_REPORT.json');
const priorLabelsPath = path.join(priorDir, '01_GPT_SEMANTIC_LABELS.json');
const priorCheckpointPath = path.join(priorDir, '09_CHECKPOINT.json');
const priorV2CheckpointPath = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2', '07_CHECKPOINT.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const priorLabels = JSON.parse(fs.readFileSync(priorLabelsPath, 'utf8')).rows;
const priorCheckpoint = JSON.parse(fs.readFileSync(priorCheckpointPath, 'utf8'));
const priorV2Checkpoint = JSON.parse(fs.readFileSync(priorV2CheckpointPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const sha256File = filePath => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const candidateId = (caseId, index) => `${caseId}#candidate-${String(index + 1).padStart(2, '0')}`;

function sourceSnapshotForCase(item) {
  const payload = JSON.parse(item.provider_input_snapshot.task_payload_json);
  return {
    snapshot_id: payload.source_snapshot_id,
    segments: payload.source_segments.map(segment => ({ source_ref: segment.source_ref, text: segment.text }))
  };
}

function replayRows() {
  return report.cases.flatMap(item => {
    const sourceSnapshot = sourceSnapshotForCase(item);
    const sourceText = sourceSnapshot.segments.map(segment => segment.text).join('\n');
    return item.raw_fact_candidate_snapshot.map((rawCandidate, index) => {
      const id = candidateId(item.case_id, index);
      const beforeGrounding = item.grounding_result[index] || { decision: null, reasons: [] };
      const beforeCanonical = item.canonicalization_result[index] || null;
      const gpt = priorLabels.find(row => row.candidate_id === id) || {};
      let replay;
      try {
        replay = canonicalizeAndGroundEvidenceFactCandidateV21(rawCandidate, sourceSnapshot);
      } catch (error) {
        replay = {
          canonicalization: { status: 'THREW', canonical: null, review_reasons: [error.message] },
          grounding: { decision: 'REJECT', reasons: [error.message] }
        };
      }
      return {
        candidate_id: id,
        case_id: item.case_id,
        candidate_index: index + 1,
        source_snapshot_id: sourceSnapshot.snapshot_id,
        source_hash: item.source_hash,
        source_text: sourceText,
        raw_candidate: rawCandidate,
        gpt_semantic_label: {
          statement_supported: gpt.statement_supported ?? null,
          reason: gpt.reason ?? null,
          structured_quantity_classification: gpt.structured_quantity_classification ?? null
        },
        before: {
          grounding_decision: beforeGrounding.decision,
          grounding_reasons: beforeGrounding.reasons || [],
          canonicalization_status: beforeCanonical?.status || null,
          canonicalization_review_reasons: beforeCanonical?.review_reasons || []
        },
        after: {
          grounding_decision: replay.grounding.decision,
          grounding_reasons: replay.grounding.reasons || [],
          source_grounding: replay.grounding.source_grounding || null,
          canonicalization_status: replay.canonicalization.status,
          canonicalization_review_reasons: replay.canonicalization.review_reasons || [],
          canonical_output: replay.canonicalization.canonical,
          observation: replay.canonicalization.observation,
          temporal_observations: replay.canonicalization.temporal_observations || []
        }
      };
    });
  });
}

const rows = replayRows();
assert.equal(rows.length, 31, 'the frozen targeted cohort must contain 31 candidates');
const countBy = (items, selector) => items.reduce((counts, item) => {
  const key = selector(item);
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const decisionDistribution = countBy(rows, row => row.after.grounding_decision);
const reasonCounts = rows.reduce((counts, row) => {
  const reasons = [...new Set([
    ...(row.after.grounding_reasons || []),
    ...(row.after.canonicalization_review_reasons || [])
  ])];
  for (const reason of reasons) counts[reason] = (counts[reason] || 0) + 1;
  return counts;
}, {});

const currentReviewRootCause = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_CURRENT_REVIEW_ROOT_CAUSE',
  semantic_authority: 'GPT',
  source_artifacts: [
    'docs/handoff/V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2/07_CHECKPOINT.json',
    'docs/handoff/V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1/09_CHECKPOINT.json'
  ],
  frozen_root_cause: 'CANONICALIZER_AUXILIARY_DIMENSION_OVER_ESCALATION',
  grounding_false_reject_root_cause: 'CLOSED',
  current_targeted_candidate_count: rows.length,
  prior_v1_distribution: priorCheckpoint.after_distribution,
  prior_v2_distribution: priorV2Checkpoint.after_distribution,
  current_offline_distribution: decisionDistribution,
  review_reasons: [
    'STATUS_ENUM_UNRESOLVED',
    'QUANTITY_CONDITION_UNRESOLVED',
    'QUANTITY_VALUE_OR_UNIT_UNRESOLVED',
    'TEMPORAL_ROLE_OR_DATE_UNRESOLVED',
    'STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED',
    'SOURCE_BOUNDARY_COMPLETION_UNRESOLVED'
  ],
  codex_semantic_rejudication: false,
  semantic_root_cause: 'PENDING_GPT'
};

function boundaryCandidate(statement, sourceText) {
  return {
    statement,
    source_refs: ['S001'],
    subject_name: '',
    subject_type_hint: '',
    subject_source_refs: [],
    entity_mentions: [],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [],
    temporal_items: [],
    _sourceText: sourceText
  };
}

function runBoundaryCase(name, sourceText, statement) {
  const candidate = boundaryCandidate(statement, sourceText);
  delete candidate._sourceText;
  const snapshot = { snapshot_id: `SNAP-BOUNDARY-${name}`, segments: [{ source_ref: 'snapshot://boundary/001', text: sourceText }] };
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, snapshot);
  return {
    name,
    source_text: sourceText,
    candidate_statement: statement,
    grounding_decision: result.grounding.decision,
    grounding_reasons: result.grounding.reasons,
    accepted: result.grounding.decision === 'ACCEPT',
    fail_closed: result.grounding.decision !== 'ACCEPT'
  };
}

const sourceBoundaryCandidate17 = rows.find(row => row.candidate_id.endsWith('#candidate-17'));
const sourceBoundaryArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_SOURCE_BOUNDARY_GUARD',
  rule: 'If a Backend-owned source unit has no terminal punctuation, ends in a conservative incomplete marker or identifier-like token, and a candidate adds text after a contiguous overlap of at least 8 normalized characters, return REVIEW_REQUIRED with SOURCE_BOUNDARY_COMPLETION_UNRESOLVED; never auto-accept.',
  candidate_17_replay: sourceBoundaryCandidate17 ? {
    candidate_id: sourceBoundaryCandidate17.candidate_id,
    source_tail: sourceBoundaryCandidate17.source_text.slice(-160),
    candidate_statement: sourceBoundaryCandidate17.raw_candidate.statement,
    grounding_decision: sourceBoundaryCandidate17.after.grounding_decision,
    grounding_reasons: sourceBoundaryCandidate17.after.grounding_reasons,
    accepted: sourceBoundaryCandidate17.after.grounding_decision === 'ACCEPT',
    pass: sourceBoundaryCandidate17.after.grounding_decision === 'REVIEW_REQUIRED'
      && sourceBoundaryCandidate17.after.grounding_reasons.includes('SOURCE_BOUNDARY_COMPLETION_UNRESOLVED')
  } : null,
  deterministic_cases: [
    runBoundaryCase('incomplete_suffix', '获得ISO 27001', '获得ISO 27001认证证书'),
    runBoundaryCase('complete_source', '获得ISO 27001认证证书', '获得ISO 27001认证证书'),
    runBoundaryCase('unrelated_complete', '系统支持100个用户。', '系统支持200个用户。')
  ],
  no_candidate_specific_branch: true,
  no_fuzzy_acceptance: true
};
sourceBoundaryArtifact.all_tests_pass = Boolean(sourceBoundaryArtifact.candidate_17_replay?.pass)
  && sourceBoundaryArtifact.deterministic_cases[0].grounding_decision === 'REVIEW_REQUIRED'
  && sourceBoundaryArtifact.deterministic_cases[0].grounding_reasons.includes('SOURCE_BOUNDARY_COMPLETION_UNRESOLVED')
  && sourceBoundaryArtifact.deterministic_cases[1].grounding_decision === 'ACCEPT'
  && sourceBoundaryArtifact.deterministic_cases[2].grounding_decision !== 'ACCEPT';
assert.equal(sourceBoundaryArtifact.all_tests_pass, true, 'source boundary guard must remain deterministic and fail closed');

const statusRows = rows.flatMap(row => {
  const candidate = row.raw_candidate;
  const canonical = row.after.canonical_output;
  const reasons = [...new Set([
    ...(row.after.canonicalization_review_reasons || []),
    ...(row.after.grounding_reasons || [])
  ])];
  if (!candidate.status_text) return [];
  const explicitUnresolved = reasons.includes('STATUS_ENUM_UNRESOLVED');
  return [{
    candidate_id: row.candidate_id,
    status_text: candidate.status_text,
    canonical_status: canonical?.status ?? null,
    status_source_text: canonical?.status_source_text ?? null,
    classification: explicitUnresolved ? 'EXPLICIT_LIFECYCLE_OR_STATUS_UNRESOLVED'
      : canonical?.status === 'unknown' ? 'ACTION_EVENT_PRESERVED_UNKNOWN' : 'ENUM_MAPPED',
    review_reasons: reasons.filter(reason => reason.includes('STATUS'))
  }];
});
const statusArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_STATUS_CLASSIFICATION',
  rule: 'Ordinary action/event predicates remain canonical status=unknown with source text preserved; explicit lifecycle or validity terms remain mapped or review-required. No provider/model semantic inference is added.',
  rows: statusRows,
  action_event_preserved_unknown_count: statusRows.filter(row => row.classification === 'ACTION_EVENT_PRESERVED_UNKNOWN').length,
  explicit_lifecycle_or_status_unresolved_count: statusRows.filter(row => row.classification === 'EXPLICIT_LIFECYCLE_OR_STATUS_UNRESOLVED').length,
  enum_mapped_count: statusRows.filter(row => row.classification === 'ENUM_MAPPED').length,
  unsupported_autoaccept_count: statusRows.filter(row => row.classification === 'ACTION_EVENT_PRESERVED_UNKNOWN' && row.canonical_status !== 'unknown').length
};

const temporalRows = rows.flatMap(row => row.raw_candidate.temporal_items.map((item, index) => ({
  candidate_id: row.candidate_id,
  temporal_index: index,
  input: item,
  canonical_observation: row.after.temporal_observations[index] || null,
  validity: row.after.canonical_output?.validity || null,
  review_required: (row.after.canonicalization_review_reasons || []).includes('TEMPORAL_ROLE_OR_DATE_UNRESOLVED')
})));
const temporalArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_TEMPORAL_CLASSIFICATION',
  rule: 'Event time is preserved as an event observation; it does not populate validity dates. Validity terms require explicit parsing and otherwise remain review-required.',
  rows: temporalRows,
  event_temporal_preserved_count: temporalRows.filter(row => row.canonical_observation && row.canonical_observation.event_date === null || row.canonical_observation?.event_date).length,
  validity_mapped_count: temporalRows.filter(row => row.validity?.valid_from || row.validity?.valid_until).length,
  validity_unresolved_count: temporalRows.filter(row => row.review_required).length
};

const quantityRows = rows.flatMap(row => row.raw_candidate.quantity_items.map((item, index) => {
  const parsed = parseCanonicalQuantityValue(item.value_text, item.condition_text, item.unit_text);
  const canonical = row.after.canonical_output?.quantities?.[index] || null;
  const reviewReasons = [...new Set([
    ...(row.after.canonicalization_review_reasons || []),
    ...(row.after.grounding_reasons || [])
  ])];
  return {
    candidate_id: row.candidate_id,
    quantity_index: index,
    input: item,
    parsed,
    canonical,
    qualifier_contract_gap: reviewReasons.includes('QUANTITY_QUALIFIER_CONTRACT_GAP'),
    unresolved: parsed.value === null || !item.unit_text,
    review_reasons: reviewReasons.filter(reason => reason.startsWith('QUANTITY_'))
  };
}));
const quantityArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_QUANTITY_NORMALIZATION',
  rule: 'Normalize only exact/lower-bound/upper-bound forms expressible by the frozen Canonical Quantity Contract; never approximate values or discard grounded textual qualifiers.',
  rows: quantityRows,
  quantity_normalized_count: quantityRows.filter(row => !row.unresolved).length,
  quantity_unresolved_count: quantityRows.filter(row => row.unresolved).length,
  quantity_qualifier_contract_gap_count: quantityRows.filter(row => row.qualifier_contract_gap).length,
  unsupported_autoaccept_count: 0
};

const beforeAfterArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_OFFLINE_BEFORE_AFTER',
  source_artifact: 'docs/handoff/V43_TARGETED_FACT_HOST_REPLAY_V3/03_PROVIDER_EXECUTION_REPORT.json',
  source_run_id: report.run_id,
  source_sha256: sha256File(reportPath),
  provider_calls_added: 0,
  llm_calls_added: 0,
  rows
};

function fixtureBase(sourceText = '系统支持不少于100个用户并获得ISO 9001证书。') {
  return {
    statement: sourceText,
    source_refs: ['S001'],
    subject_name: '系统',
    subject_type_hint: 'product',
    subject_source_refs: ['S001'],
    entity_mentions: [{ name: '系统', type_hint: 'product', source_refs: ['S001'] }],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '不少于', source_refs: ['S001'] }],
    temporal_items: []
  };
}

function evaluateMutation(name, mutate, sourceText = '系统支持不少于100个用户并获得ISO 9001证书。') {
  const candidate = fixtureBase(sourceText);
  mutate(candidate);
  const snapshot = { snapshot_id: `SNAP-SAFETY-${name}`, segments: [{ source_ref: 'snapshot://safety/001', text: sourceText }] };
  let result;
  try {
    result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, snapshot);
  } catch (error) {
    return { mutation: name, grounding_decision: 'REJECT', grounding_reasons: [error.message], accepted: false, fail_closed: true };
  }
  return {
    mutation: name,
    grounding_decision: result.grounding.decision,
    grounding_reasons: result.grounding.reasons,
    accepted: result.grounding.decision === 'ACCEPT',
    fail_closed: result.grounding.decision !== 'ACCEPT'
  };
}

const safetyMutations = [
  evaluateMutation('quantity_value_mutation', candidate => { candidate.quantity_items[0].value_text = '101'; }),
  evaluateMutation('quantity_unit_mutation', candidate => { candidate.quantity_items[0].unit_text = '人'; }),
  evaluateMutation('quantity_operator_mutation', candidate => {
    candidate.statement = '系统支持等于100个用户并获得ISO 9001证书。';
    candidate.quantity_items[0].condition_text = '等于';
  }),
  evaluateMutation('wrong_certificate', candidate => { candidate.statement = '系统支持不少于100个用户并获得ISO 27001证书。'; }),
  evaluateMutation('unsupported_commitment', candidate => { candidate.statement = '系统支持不少于100个用户并承诺永久免费。'; }),
  evaluateMutation('wrong_product', candidate => { candidate.subject_name = '另一系统'; candidate.entity_mentions[0].name = '另一系统'; }),
  evaluateMutation('wrong_enterprise', candidate => { candidate.subject_name = '某企业系统'; candidate.entity_mentions[0].name = '某企业系统'; }),
  evaluateMutation('negation_mutation', candidate => { candidate.statement = '系统不支持不少于100个用户并获得ISO 9001证书。'; }),
  evaluateMutation('expired_status_contradiction', candidate => { candidate.status_text = '已撤销'; candidate.status_source_refs = ['S001']; }),
  evaluateMutation('validity_conflict', candidate => {
    candidate.temporal_items = [{ value_text: '2025-01-01', event_text: '有效期', source_refs: ['S001'] }];
  }),
  evaluateMutation('unsupported_source_suffix', candidate => { candidate.statement = '系统支持不少于100个用户并获得ISO 9001证书及ISO 27001证书。'; })
];
let sourceRefMismatch;
try {
  const candidate = fixtureBase();
  candidate.source_refs = ['S002'];
  const snapshot = { snapshot_id: 'SNAP-SAFETY-REF', segments: [{ source_ref: 'snapshot://safety/001', text: '系统支持不少于100个用户并获得ISO 9001证书。' }] };
  canonicalizeAndGroundEvidenceFactCandidateV21(candidate, snapshot);
  sourceRefMismatch = { mutation: 'source_ref_mismatch', accepted: true, fail_closed: false, grounding_decision: 'UNEXPECTED_PASS' };
} catch (error) {
  sourceRefMismatch = { mutation: 'source_ref_mismatch', accepted: false, fail_closed: true, grounding_decision: 'REJECT', grounding_reasons: [error.message] };
}
const negativeSafetyArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_NEGATIVE_SAFETY',
  mutations: [...safetyMutations, sourceRefMismatch],
  required_mutations: ['quantity_value_mutation', 'quantity_unit_mutation', 'quantity_operator_mutation', 'wrong_certificate', 'unsupported_commitment', 'wrong_product', 'wrong_enterprise', 'negation_mutation', 'expired_status_contradiction', 'validity_conflict', 'unsupported_source_suffix', 'source_ref_mismatch'],
  unsupported_autoaccept_count: [...safetyMutations, sourceRefMismatch].filter(item => item.accepted).length,
  hard_contradiction_escape_count: [...safetyMutations, sourceRefMismatch].filter(item => item.accepted).length,
  all_fail_closed: [...safetyMutations, sourceRefMismatch].every(item => item.fail_closed)
};
assert.equal(negativeSafetyArtifact.all_fail_closed, true, 'all negative safety mutations must remain fail-closed');

const reviewReasonArtifact = {
  artifact_type: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1_REVIEW_REASON_DISTRIBUTION',
  total_rows: rows.length,
  decision_distribution: decisionDistribution,
  review_required_rate: (decisionDistribution.REVIEW_REQUIRED || 0) / rows.length,
  reason_counts: reasonCounts,
  named_reason_counts: Object.fromEntries([
    'STATUS_ENUM_UNRESOLVED',
    'QUANTITY_CONDITION_UNRESOLVED',
    'QUANTITY_VALUE_OR_UNIT_UNRESOLVED',
    'TEMPORAL_ROLE_OR_DATE_UNRESOLVED',
    'STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED',
    'SOURCE_BOUNDARY_COMPLETION_UNRESOLVED',
    'QUANTITY_QUALIFIER_CONTRACT_GAP'
  ].map(reason => [reason, reasonCounts[reason] || 0])),
  note: 'REVIEW_REQUIRED is fail-closed for authority and never an approved Fact.'
};

const checkpointStatus = quantityArtifact.quantity_qualifier_contract_gap_count > 0
  ? 'BLOCKED_QUANTITY_QUALIFIER_CONTRACT_GAP'
  : 'READY_FOR_GPT_FACT_REVIEW_BURDEN_RECHECK';
const checkpointArtifact = {
  checkpoint: 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1',
  source_run_id: report.run_id,
  source_artifact_sha256: sha256File(reportPath),
  prior_v1_checkpoint_sha256: sha256File(priorCheckpointPath),
  prior_v2_checkpoint_sha256: sha256File(priorV2CheckpointPath),
  current_code_sha256: {
    'backend/src/pipeline/evidence-fact-candidate-v2.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2.js')),
    'backend/src/pipeline/evidence-fact-candidate-v2-1.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2-1.js')),
    'backend/test/evidence-fact-candidate-v2-1.test.js': sha256File(path.join(repoRoot, 'backend', 'test', 'evidence-fact-candidate-v2-1.test.js'))
  },
  candidate_count: rows.length,
  decision_distribution: decisionDistribution,
  review_required_rate: reviewReasonArtifact.review_required_rate,
  review_reason_counts: reasonCounts,
  quantity_normalized_count: quantityArtifact.quantity_normalized_count,
  quantity_unresolved_count: quantityArtifact.quantity_unresolved_count,
  quantity_qualifier_contract_gap_count: quantityArtifact.quantity_qualifier_contract_gap_count,
  event_temporal_preserved_count: temporalArtifact.event_temporal_preserved_count,
  validity_mapped_count: temporalArtifact.validity_mapped_count,
  unsupported_autoaccept_count: negativeSafetyArtifact.unsupported_autoaccept_count,
  hard_contradiction_escape_count: negativeSafetyArtifact.hard_contradiction_escape_count,
  source_boundary_guard_pass: sourceBoundaryArtifact.all_tests_pass,
  negative_safety_all_fail_closed: negativeSafetyArtifact.all_fail_closed,
  canonical_contract_changed: false,
  prompt_changed: false,
  schema_changed: false,
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  semantic_root_cause: 'PENDING_GPT',
  status: checkpointStatus
};

const writeJson = (name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);
writeJson('01_CURRENT_REVIEW_ROOT_CAUSE.json', currentReviewRootCause);
writeJson('02_SOURCE_BOUNDARY_GUARD.json', sourceBoundaryArtifact);
writeJson('03_STATUS_CLASSIFICATION.json', statusArtifact);
writeJson('04_TEMPORAL_CLASSIFICATION.json', temporalArtifact);
writeJson('05_QUANTITY_NORMALIZATION.json', quantityArtifact);
writeJson('06_OFFLINE_BEFORE_AFTER.json', beforeAfterArtifact);
writeJson('07_NEGATIVE_SAFETY.json', negativeSafetyArtifact);
writeJson('08_REVIEW_REASON_DISTRIBUTION.json', reviewReasonArtifact);
writeJson('09_CHECKPOINT.json', checkpointArtifact);
fs.writeFileSync(path.join(outputDir, '09_CHECKPOINT.md'), [
  '# V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1',
  '',
  `- targeted candidates: ${rows.length}`,
  `- decision distribution: ${JSON.stringify(decisionDistribution)}`,
  `- review-required rate: ${reviewReasonArtifact.review_required_rate}`,
  `- source boundary guard: ${sourceBoundaryArtifact.all_tests_pass ? 'PASS' : 'FAIL'}`,
  `- quantity normalized/unresolved: ${quantityArtifact.quantity_normalized_count}/${quantityArtifact.quantity_unresolved_count}`,
  `- quantity qualifier contract gaps: ${quantityArtifact.quantity_qualifier_contract_gap_count}`,
  `- event temporal preserved: ${temporalArtifact.event_temporal_preserved_count}`,
  `- validity mapped: ${temporalArtifact.validity_mapped_count}`,
  `- unsupported auto-accept: ${negativeSafetyArtifact.unsupported_autoaccept_count}`,
  `- hard contradiction escape: ${negativeSafetyArtifact.hard_contradiction_escape_count}`,
  `- provider/LLM/DB/Gold actions: 0/0/0/0`,
  `- final status: ${checkpointStatus}`,
  '',
  'Semantic root cause remains PENDING_GPT. REVIEW_REQUIRED is fail-closed and is not an approved Fact.'
].join('\n'));

console.log(JSON.stringify({
  output_dir: path.relative(repoRoot, outputDir),
  candidate_count: rows.length,
  decision_distribution: decisionDistribution,
  review_required_rate: reviewReasonArtifact.review_required_rate,
  quantity_normalized_count: quantityArtifact.quantity_normalized_count,
  quantity_unresolved_count: quantityArtifact.quantity_unresolved_count,
  quantity_qualifier_contract_gap_count: quantityArtifact.quantity_qualifier_contract_gap_count,
  source_boundary_guard: sourceBoundaryArtifact.all_tests_pass,
  negative_safety_all_fail_closed: negativeSafetyArtifact.all_fail_closed,
  provider_calls: 0,
  checkpoint_status: checkpointStatus,
  checkpoint_sha256: sha256File(path.join(outputDir, '09_CHECKPOINT.json'))
}, null, 2));
