import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalizeAndGroundEvidenceFactCandidateV21 } from '../src/pipeline/evidence-fact-candidate-v2-1.js';
import { normalizeGroundingComparisonText } from '../src/pipeline/evidence-fact-candidate-v2.js';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const replayDir = path.join(repoRoot, 'docs', 'handoff', 'V43_TARGETED_FACT_HOST_REPLAY_V3');
const priorDir = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1');
const outputDir = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2');
const reportPath = path.join(replayDir, '03_PROVIDER_EXECUTION_REPORT.json');
const priorLabelsPath = path.join(priorDir, '01_GPT_SEMANTIC_LABELS.json');
const priorCheckpointPath = path.join(priorDir, '09_CHECKPOINT.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const priorLabels = JSON.parse(fs.readFileSync(priorLabelsPath, 'utf8')).rows;
const priorCheckpoint = JSON.parse(fs.readFileSync(priorCheckpointPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const sha256File = filePath => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const candidateId = (caseId, index) => `${caseId}#candidate-${String(index + 1).padStart(2, '0')}`;

function sourceSnapshotForCase(item) {
  const payload = JSON.parse(item.provider_input_snapshot.task_payload_json);
  return {
    snapshot_id: payload.source_snapshot_id,
    segments: payload.source_segments.map(segment => ({
      source_ref: segment.source_ref,
      text: segment.text
    }))
  };
}

function replayRows() {
  return report.cases.flatMap(item => {
    const sourceSnapshot = sourceSnapshotForCase(item);
    const sourceText = sourceSnapshot.segments.map(segment => segment.text).join('\n');
    return item.raw_fact_candidate_snapshot.map((rawCandidate, index) => {
      const before = item.grounding_result[index] || { decision: null, reasons: [] };
      const beforeCanonicalization = item.canonicalization_result[index] || null;
      let replay;
      try {
        replay = canonicalizeAndGroundEvidenceFactCandidateV21(rawCandidate, sourceSnapshot);
      } catch (error) {
        replay = {
          canonicalization: { status: 'THREW', canonical: null, review_reasons: [error.message] },
          grounding: { decision: 'REJECT', reasons: [error.message] }
        };
      }
      const id = candidateId(item.case_id, index);
      const label = priorLabels.find(row => row.candidate_id === id) || {
        candidate_id: id,
        case_id: item.case_id,
        candidate_index: index + 1,
        source_hash: item.source_hash,
        statement_supported: null,
        reason: null,
        structured_quantity_classification: null
      };
      return {
        candidate_id: id,
        case_id: item.case_id,
        candidate_index: index + 1,
        source_snapshot_id: sourceSnapshot.snapshot_id,
        source_hash: item.source_hash,
        source_text: sourceText,
        raw_candidate: rawCandidate,
        gpt_semantic_label: {
          statement_supported: label.statement_supported,
          reason: label.reason,
          structured_quantity_classification: label.structured_quantity_classification
        },
        before: {
          grounding_decision: before.decision,
          grounding_reasons: before.reasons || [],
          canonicalization_status: beforeCanonicalization?.status || null,
          canonicalization_review_reasons: beforeCanonicalization?.review_reasons || []
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
const priorLabelById = new Map(priorLabels.map(row => [row.candidate_id, row]));
const countDecisions = key => rows.reduce((counts, row) => {
  const decision = key(row);
  counts[decision] = (counts[decision] || 0) + 1;
  return counts;
}, {});
const beforeDistribution = countDecisions(row => row.before.grounding_decision);
const afterDistribution = countDecisions(row => row.after.grounding_decision);
const oldRejectRows = rows.filter(row => row.before.grounding_decision === 'REJECT');
const closedRows = oldRejectRows.filter(row => row.after.grounding_decision !== 'REJECT');
const statementBoundaryRows = rows.filter(row => row.after.grounding_reasons.includes('STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED'));

const residualRootCauses = new Map([
  [2, ['SOURCE_LAYOUT_CONTINUATION_BREAK']],
  [3, ['SOURCE_OWNER_ATTRIBUTION']],
  [4, ['SOURCE_OWNER_ATTRIBUTION', 'CLAUSE_SUBJECT_INHERITANCE']],
  [5, ['COORDINATED_SENTENCE_SPLIT', 'SOURCE_OWNER_ATTRIBUTION']],
  [7, ['CLAUSE_SUBJECT_INHERITANCE']],
  [8, ['CONTEXTUAL_SCOPE_INHERITANCE']],
  [9, ['ELLIPSIS_COREFERENCE', 'CONTEXTUAL_SCOPE_INHERITANCE']]
]);

const residualClassificationArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_GPT_RESIDUAL_CLASSIFICATION',
  semantic_authority: 'GPT',
  source_artifact: 'docs/handoff/V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1/01_GPT_SEMANTIC_LABELS.json',
  rows: [...residualRootCauses.entries()].map(([index, rootCauses]) => {
    const id = `MCH-CE770B545973FB9CF092951FCDC402B5#candidate-${String(index).padStart(2, '0')}`;
    const label = priorLabelById.get(id);
    return {
      candidate_id: id,
      case_id: 'MCH-CE770B545973FB9CF092951FCDC402B5',
      candidate_index: index,
      statement_supported: label?.statement_supported,
      root_causes: rootCauses,
      structured_quantity_classification: label?.structured_quantity_classification || null,
      auto_accept_authorized: false,
      semantic_root_cause: 'GPT_AUTHORITY_RECORDED'
    };
  })
};

const continuationVectors = [
  ['token_soft_lf', '智能汽\n车解决方案业务', '智能汽车解决方案业务'],
  ['continuation_comma_soft_lf', '提升安全意识和能力，\n共同保障客户网络的安全稳定运行', '提升安全意识和能力,共同保障客户网络的安全稳定运行'],
  ['continuation_semicolon_soft_lf', '供应商完成评估；\n随后进入复核流程', '供应商完成评估;随后进入复核流程'],
  ['continuation_colon_soft_lf', '结论：\n需要人工复核', '结论:需要人工复核'],
  ['real_paragraph_boundary', '第一段。\n第二段。', '第一段。\n第二段。'],
  ['blank_line_boundary', '第一段。\n\n第二段。', '第一段。\n\n第二段。'],
  ['heading_boundary', '# 标题\n正文内容', '# 标题\n正文内容']
];
const continuationTests = continuationVectors.map(([name, input, expected]) => ({
  name,
  input,
  expected,
  actual: normalizeGroundingComparisonText(input),
  pass: normalizeGroundingComparisonText(input) === expected
}));
const continuationCandidate = rows.find(row => row.candidate_id === 'MCH-CE770B545973FB9CF092951FCDC402B5#candidate-02');
const continuationArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_CONTINUATION_LINEBREAK_REGRESSION',
  function: 'normalizeGroundingComparisonText',
  rule: 'Remove only a single layout LF after explicit continuation punctuation; preserve sentence breaks, blank lines, heading boundaries, and raw source.',
  tests: continuationTests,
  candidate_02_replay: continuationCandidate ? {
    candidate_id: continuationCandidate.candidate_id,
    before_grounding_decision: continuationCandidate.before.grounding_decision,
    after_grounding_decision: continuationCandidate.after.grounding_decision,
    after_source_grounding: continuationCandidate.after.source_grounding,
    pass: continuationCandidate.after.grounding_decision !== 'REJECT'
  } : null,
  raw_source_mutated: false,
  all_tests_pass: continuationTests.every(test => test.pass)
};

function boundaryBase() {
  return {
    statement: '华为平台具备100个用户并获得ISO 9001证书。',
    source_refs: ['S001'],
    subject_name: '华为平台',
    subject_type_hint: 'product',
    subject_source_refs: ['S001'],
    entity_mentions: [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '', source_refs: ['S001'] }],
    temporal_items: []
  };
}

function evaluateBoundaryCase(name, mutate) {
  const sourceSnapshot = {
    snapshot_id: `SNAP-REVIEW-BOUNDARY-${name}`,
    segments: [{ source_ref: 'snapshot://review-boundary/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
  };
  const candidate = boundaryBase();
  mutate(candidate);
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, sourceSnapshot);
  return {
    name,
    grounding_decision: result.grounding.decision,
    grounding_reasons: result.grounding.reasons,
    accepted: result.grounding.decision === 'ACCEPT'
  };
}

const statementBoundaryCases = [
  evaluateBoundaryCase('statement_only_semantic_mismatch', candidate => {}),
  evaluateBoundaryCase('statement_plus_wrong_number', candidate => {
    candidate.statement = '华为平台具备101个用户并获得ISO 9001证书。';
    candidate.quantity_items[0].value_text = '101';
  }),
  evaluateBoundaryCase('statement_plus_wrong_entity', candidate => {
    candidate.entity_mentions[0].name = '华为另一平台';
    candidate.subject_name = '华为另一平台';
  }),
  evaluateBoundaryCase('statement_plus_wrong_subject', candidate => { candidate.subject_name = '某企业平台'; }),
  evaluateBoundaryCase('statement_plus_negation_contradiction', candidate => {
    candidate.statement = '华为平台不支持100个用户并获得ISO 9001证书。';
  })
];
const statementBoundaryArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_STATEMENT_REVIEW_BOUNDARY',
  rule: 'A non-empty statement-only literal grounding failure becomes REVIEW_REQUIRED; any hard field, source identity, cross-unit, or polarity contradiction remains REJECT.',
  replay_rows: statementBoundaryRows.map(row => ({
    candidate_id: row.candidate_id,
    before_grounding_decision: row.before.grounding_decision,
    after_grounding_decision: row.after.grounding_decision,
    after_grounding_reasons: row.after.grounding_reasons,
    gpt_statement_supported: row.gpt_semantic_label.statement_supported,
    auto_accept: row.after.grounding_decision === 'ACCEPT'
  })),
  deterministic_cases: statementBoundaryCases,
  statement_only_review_required_count: statementBoundaryCases.filter(item => item.name === 'statement_only_semantic_mismatch' && item.grounding_decision === 'REVIEW_REQUIRED').length,
  hard_contradiction_reject_count: statementBoundaryCases.filter(item => item.name !== 'statement_only_semantic_mismatch' && item.grounding_decision === 'REJECT').length,
  unsupported_auto_accept: statementBoundaryCases.filter(item => item.accepted).length
};

const safetySource = {
  snapshot_id: 'SNAP-SAFETY-REVIEW-BOUNDARY',
  segments: [{ source_ref: 'snapshot://safety-review/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
};
const safetyBase = boundaryBase();
const safetyMutations = [
  ['unsupported_suffix', candidate => { candidate.statement = '华为平台支持100个用户并获得ISO 9001证书及ISO 27001证书。'; }],
  ['wrong_number', candidate => { candidate.quantity_items[0].value_text = '101'; }],
  ['wrong_certificate', candidate => { candidate.statement = '华为平台支持100个用户并获得ISO 27001证书。'; }],
  ['wrong_product', candidate => {
    candidate.subject_name = '华为另一平台';
    candidate.entity_mentions[0].name = '华为另一平台';
  }],
  ['wrong_enterprise', candidate => {
    candidate.subject_name = '某企业平台';
    candidate.entity_mentions[0].name = '某企业平台';
  }],
  ['negation_mutation', candidate => { candidate.statement = '华为平台不支持100个用户并获得ISO 9001证书。'; }]
].map(([mutation, mutate]) => {
  const candidate = structuredClone(safetyBase);
  mutate(candidate);
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, safetySource);
  return {
    mutation,
    grounding_decision: result.grounding.decision,
    grounding_reasons: result.grounding.reasons,
    accepted: result.grounding.decision === 'ACCEPT',
    fail_closed: result.grounding.decision !== 'ACCEPT'
  };
});
let sourceRefMismatch;
try {
  const candidate = structuredClone(safetyBase);
  candidate.source_refs = ['S002'];
  canonicalizeAndGroundEvidenceFactCandidateV21(candidate, safetySource);
  sourceRefMismatch = { mutation: 'source_ref_mismatch', accepted: true, fail_closed: false, error: null };
} catch (error) {
  sourceRefMismatch = { mutation: 'source_ref_mismatch', accepted: false, fail_closed: true, error: error.message };
}
const candidate17 = rows.find(row => row.candidate_id === 'MCH-CE770B545973FB9CF092951FCDC402B5#candidate-17');
const safetyArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_NEGATIVE_SAFETY_REGRESSION',
  candidate_17: candidate17 ? {
    candidate_id: candidate17.candidate_id,
    gpt_statement_supported: candidate17.gpt_semantic_label.statement_supported,
    grounding_decision_after: candidate17.after.grounding_decision,
    accepted: candidate17.after.grounding_decision === 'ACCEPT',
    pass: candidate17.after.grounding_decision !== 'ACCEPT'
  } : null,
  mutations: [...safetyMutations, sourceRefMismatch],
  hard_contradiction_mutations: ['wrong_number', 'wrong_product', 'wrong_enterprise', 'negation_mutation'],
  all_fail_closed: safetyMutations.every(item => item.fail_closed) && sourceRefMismatch.fail_closed
};

const reviewReasonCounts = rows.reduce((counts, row) => {
  if (row.after.grounding_decision !== 'REVIEW_REQUIRED') return counts;
  for (const reason of row.after.grounding_reasons) counts[reason] = (counts[reason] || 0) + 1;
  return counts;
}, {});
const reviewBurdenArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_REVIEW_REASON_DISTRIBUTION',
  total_rows: rows.length,
  decision_distribution: afterDistribution,
  review_required_rate: (afterDistribution.REVIEW_REQUIRED || 0) / rows.length,
  review_reason_counts: reviewReasonCounts,
  statement_semantic_grounding_unresolved_count: reviewReasonCounts.STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED || 0,
  note: 'REVIEW_REQUIRED is fail-closed for authority and is not an approved Fact.'
};

const beforeAfterArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2_OFFLINE_BEFORE_AFTER',
  source_artifact: 'docs/handoff/V43_TARGETED_FACT_HOST_REPLAY_V3/03_PROVIDER_EXECUTION_REPORT.json',
  source_sha256: sha256File(reportPath),
  source_run_id: report.run_id,
  provider_calls_added: 0,
  rows
};

const checkpointArtifact = {
  checkpoint: 'V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2',
  source_run_id: report.run_id,
  prior_v1_checkpoint_sha256: sha256File(priorCheckpointPath),
  input_artifact_sha256: sha256File(reportPath),
  current_code_sha256: {
    'backend/src/pipeline/evidence-fact-candidate-v2.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2.js')),
    'backend/src/pipeline/evidence-fact-candidate-v2-1.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2-1.js')),
    'backend/test/evidence-fact-candidate-v2-1.test.js': sha256File(path.join(repoRoot, 'backend', 'test', 'evidence-fact-candidate-v2-1.test.js'))
  },
  candidate_count: rows.length,
  gpt_residual_rows: residualClassificationArtifact.rows.length,
  gpt_supported_hard_reject_count: oldRejectRows.filter(row => row.gpt_semantic_label.statement_supported === 'YES' && row.after.grounding_decision === 'REJECT').length,
  before_distribution: beforeDistribution,
  after_distribution: afterDistribution,
  continuation_linebreak_tests_pass: continuationArtifact.all_tests_pass,
  continuation_punctuation_candidate_02_closed: continuationArtifact.candidate_02_replay?.pass === true,
  statement_boundary_replay_review_count: statementBoundaryRows.length,
  statement_boundary_deterministic_cases_pass: statementBoundaryCases[0].grounding_decision === 'REVIEW_REQUIRED'
    && statementBoundaryCases.slice(1).every(item => item.grounding_decision === 'REJECT'),
  candidate_17_auto_accept: candidate17?.after.grounding_decision === 'ACCEPT',
  unsupported_auto_accept: safetyArtifact.mutations.filter(item => item.accepted).length,
  negative_safety_all_fail_closed: safetyArtifact.all_fail_closed,
  semantic_contract_widened: false,
  source_snapshot_mutated: false,
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  status: 'READY_FOR_GPT_FACT_REVIEW_BURDEN_ADJUDICATION'
};

const writeJson = (name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);
writeJson('01_GPT_RESIDUAL_CLASSIFICATION.json', residualClassificationArtifact);
writeJson('02_CONTINUATION_LINEBREAK_REGRESSION.json', continuationArtifact);
writeJson('03_STATEMENT_REVIEW_BOUNDARY.json', statementBoundaryArtifact);
writeJson('04_OFFLINE_BEFORE_AFTER.json', beforeAfterArtifact);
writeJson('05_NEGATIVE_SAFETY_REGRESSION.json', safetyArtifact);
writeJson('06_REVIEW_REASON_DISTRIBUTION.json', reviewBurdenArtifact);
writeJson('07_CHECKPOINT.json', checkpointArtifact);
fs.writeFileSync(path.join(outputDir, '07_CHECKPOINT.md'), [
  '# V43_FACT_GROUNDING_REVIEW_BOUNDARY_V2',
  '',
  `- source run: ${report.run_id}`,
  `- candidates replayed offline: ${rows.length}`,
  `- GPT-supported hard rejects remaining: ${checkpointArtifact.gpt_supported_hard_reject_count}`,
  `- continuation line-break tests: ${continuationArtifact.all_tests_pass ? 'PASS' : 'FAIL'}`,
  `- statement-only boundary rows: ${statementBoundaryRows.length}`,
  `- decision distribution: ${JSON.stringify(afterDistribution)}`,
  `- review-required rate: ${reviewBurdenArtifact.review_required_rate}`,
  `- candidate 17 accepted: ${checkpointArtifact.candidate_17_auto_accept}`,
  `- negative safety all fail closed: ${safetyArtifact.all_fail_closed}`,
  '',
  'No Provider, persistence, Gold, Mapping, Claim, or Writer action was performed.',
  'Semantic acceptance remains separate from REVIEW_REQUIRED.'
].join('\n'));

console.log(JSON.stringify({
  output_dir: path.relative(repoRoot, outputDir),
  candidate_count: rows.length,
  before: beforeDistribution,
  after: afterDistribution,
  gpt_supported_hard_reject_count: checkpointArtifact.gpt_supported_hard_reject_count,
  continuation_tests_pass: continuationArtifact.all_tests_pass,
  statement_boundary_rows: statementBoundaryRows.length,
  negative_safety_all_fail_closed: safetyArtifact.all_fail_closed,
  provider_calls_added: 0,
  checkpoint_sha256: sha256File(path.join(outputDir, '07_CHECKPOINT.json'))
}, null, 2));
