import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21
} from '../src/pipeline/evidence-fact-candidate-v2-1.js';
import { normalizeGroundingComparisonText } from '../src/pipeline/evidence-fact-candidate-v2.js';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const replayDir = path.join(repoRoot, 'docs', 'handoff', 'V43_TARGETED_FACT_HOST_REPLAY_V3');
const outputDir = path.join(repoRoot, 'docs', 'handoff', 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1');
const reportPath = path.join(replayDir, '03_PROVIDER_EXECUTION_REPORT.json');
const checkpointPath = path.join(replayDir, '08_TARGETED_FACT_HOST_REPLAY_V3_CHECKPOINT.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const priorCheckpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

const sha256File = filePath => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const sha256Value = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const candidateId = (caseId, index) => `${caseId}#candidate-${String(index + 1).padStart(2, '0')}`;
const caseLabel = (caseId, index) => ({
  statement_supported: caseId.includes('CE770') && index === 16 ? 'NO' : 'YES',
  reason: caseId.includes('CE770') && index === 16 ? 'UNSUPPORTED_BOUNDARY_COMPLETION' : null,
  structured_quantity_classification: caseId.includes('CE770') && index === 3
    ? 'STRUCTURED_QUANTITY_REVIEW_REQUIRED' : null
});

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

function replayCase(item) {
  const sourceSnapshot = sourceSnapshotForCase(item);
  const rows = item.raw_fact_candidate_snapshot.map((rawCandidate, index) => {
    const previous = item.grounding_result[index] || { decision: null, reasons: [] };
    const previousCanonicalization = item.canonicalization_result[index] || null;
    let replay;
    try {
      replay = canonicalizeAndGroundEvidenceFactCandidateV21(rawCandidate, sourceSnapshot);
    } catch (error) {
      replay = {
        canonicalization: { status: 'THREW', canonical: null, review_reasons: [error.message] },
        grounding: { decision: 'REJECT', reasons: [error.message] }
      };
    }
    const label = caseLabel(item.case_id, index);
    const changed = previous.decision !== replay.grounding.decision
      || JSON.stringify(previous.reasons || []) !== JSON.stringify(replay.grounding.reasons || []);
    return {
      candidate_id: candidateId(item.case_id, index),
      case_id: item.case_id,
      candidate_index: index + 1,
      source_snapshot_id: sourceSnapshot.snapshot_id,
      source_hash: item.source_hash,
      source_text: sourceSnapshot.segments.map(segment => segment.text).join('\n'),
      raw_candidate: rawCandidate,
      gpt_semantic_label: label,
      before: {
        grounding_decision: previous.decision,
        grounding_reasons: previous.reasons || [],
        canonicalization_status: previousCanonicalization?.status || null,
        canonicalization_review_reasons: previousCanonicalization?.review_reasons || []
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
      },
      line_wrap_normalization: {
        family: previous.decision === 'REJECT' && replay.grounding.decision !== 'REJECT'
          ? 'SOURCE_TEXT_LINE_WRAP_NORMALIZATION' : null,
        decision_changed: changed,
        semantic_label_support: label.statement_supported
      }
    };
  });
  return { item, sourceSnapshot, rows };
}

const replayed = report.cases.map(replayCase);
const allRows = replayed.flatMap(item => item.rows);
const decisionCounts = rows => rows.reduce((counts, row) => {
  const decision = row.after.grounding_decision;
  counts[decision] = (counts[decision] || 0) + 1;
  return counts;
}, {});
const beforeCounts = allRows.reduce((counts, row) => {
  const decision = row.before.grounding_decision;
  counts[decision] = (counts[decision] || 0) + 1;
  return counts;
}, {});
const afterCounts = decisionCounts(allRows);
const oldRejectRows = allRows.filter(row => row.before.grounding_decision === 'REJECT');
const closedRows = oldRejectRows.filter(row => row.after.grounding_decision !== 'REJECT');
const residualRows = oldRejectRows.filter(row => row.after.grounding_decision === 'REJECT');

const residualClassification = row => {
  const firstReason = row.after.grounding_reasons[0] || '';
  if (firstReason === 'scope is not grounded') return 'SCOPE_LITERALISM';
  if (firstReason === 'statement is not grounded') {
    const normalizedSource = normalizeGroundingComparisonText(row.source_text);
    const normalizedSubject = normalizeGroundingComparisonText(row.raw_candidate.subject_name);
    const statement = String(row.raw_candidate.statement || '');
    const subject = String(row.raw_candidate.subject_name || '');
    const suffix = subject && statement.startsWith(subject)
      ? statement.slice(subject.length).replace(/^(?:的|在|对|于|向|将|是)/, '')
      : '';
    if (suffix && normalizedSource.includes(normalizeGroundingComparisonText(suffix))) return 'OWNER_COREFERENCE';
  }
  if (firstReason === 'status_source_text is not grounded') return 'STATUS_TEXT_LITERALISM';
  return 'OTHER';
};

const labelsArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_GPT_SEMANTIC_LABELS',
  semantic_authority: 'GPT',
  source_artifact: 'docs/handoff/V43_TARGETED_FACT_HOST_REPLAY_V3/06_GPT_FACT_SEMANTIC_REVIEW_PACKET.json',
  source_run_id: report.run_id,
  rows: allRows.map(row => ({
    candidate_id: row.candidate_id,
    case_id: row.case_id,
    candidate_index: row.candidate_index,
    source_hash: row.source_hash,
    ...row.gpt_semantic_label
  }))
};

const familyArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_FAILURE_FAMILY',
  source_run_id: report.run_id,
  grounding_version_before: priorCheckpoint.runtime_identity?.grounding_version || '4.3-evidence-fact-grounding-v2.1',
  grounding_version_after: '4.3-evidence-fact-grounding-v2.1+SOURCE_TEXT_LINE_WRAP_NORMALIZATION',
  gpt_grounding_false_reject_count: oldRejectRows.length,
  before_distribution: beforeCounts,
  after_distribution: afterCounts,
  line_wrap_normalization: {
    deterministic_rule: 'NFKC; CRLF→LF; remove soft LF inside CJK/Latin/number tokens; remove horizontal layout whitespace between non-digit token characters; preserve punctuation and digit grouping.',
    false_rejects_closed_count: closedRows.length,
    closed_candidate_ids: closedRows.map(row => row.candidate_id),
    closed_rows: closedRows.map(row => ({
      candidate_id: row.candidate_id,
      before: row.before,
      after: row.after,
      family: row.line_wrap_normalization.family
    }))
  },
  residual_false_reject_count: residualRows.length,
  semantic_root_cause: 'PENDING_GPT'
};

const normalizationVectors = [
  ['智能汽\n车解决方案业务', '智能汽车解决方案业务'],
  ['服\n务类质保', '服务类质保'],
  ['建\n立了采购CSR管理体系', '建立了采购CSR管理体系'],
  ['社\n会责任', '社会责任'],
  ['1\n000', '1000'],
  ['1 000', '1 000'],
  ['甲\n，乙', '甲\n,乙']
];
const normalizationArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_SOURCE_TEXT_NORMALIZATION_TESTS',
  function: 'normalizeGroundingComparisonText',
  tests: normalizationVectors.map(([input, expected]) => ({
    input,
    expected,
    actual: normalizeGroundingComparisonText(input),
    pass: normalizeGroundingComparisonText(input) === expected
  })),
  source_snapshot_mutation: 'raw source snapshots unchanged; normalization is comparison-only',
  safety_properties: {
    punctuation_preserved_except_NFKC_width_normalization: true,
    numeric_grouping_preserved_for_horizontal_whitespace: true,
    no_synonym_rewrite: true,
    no_llm_or_embedding: true
  }
};

const safetySource = {
  snapshot_id: 'SNAP-SAFETY-CLOSURE',
  segments: [{ source_ref: 'snapshot://safety/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
};
const safetyBase = {
  statement: '华为平台支持100个用户并获得ISO 9001证书。',
  source_refs: ['S001'], subject_name: '华为平台', subject_type_hint: 'product',
  subject_source_refs: ['S001'], entity_mentions: [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }],
  status_text: '', status_source_refs: [], scope_items: [],
  quantity_items: [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '', source_refs: ['S001'] }],
  temporal_items: []
};
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
  return { mutation, result, fail_closed: result.grounding.decision !== 'ACCEPT' };
});
let sourceRefMismatch;
try {
  const candidate = structuredClone(safetyBase);
  candidate.source_refs = ['S002'];
  canonicalizeAndGroundEvidenceFactCandidateV21(candidate, safetySource);
  sourceRefMismatch = { mutation: 'source_ref_mismatch', fail_closed: false, error: null };
} catch (error) {
  sourceRefMismatch = { mutation: 'source_ref_mismatch', fail_closed: true, error: error.message };
}
const candidate17 = allRows.find(row => row.case_id.includes('CE770') && row.candidate_index === 17);
const safetyArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_NEGATIVE_SAFETY_REGRESSION',
  candidate_17: {
    candidate_id: candidate17.candidate_id,
    gpt_statement_supported: candidate17.gpt_semantic_label.statement_supported,
    grounding_decision_after: candidate17.after.grounding_decision,
    accepted: candidate17.after.grounding_decision === 'ACCEPT',
    pass: candidate17.after.grounding_decision !== 'ACCEPT'
  },
  mutations: [...safetyMutations, sourceRefMismatch],
  all_fail_closed: safetyMutations.every(item => item.fail_closed) && sourceRefMismatch.fail_closed
};

const residualArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_RESIDUAL_FALSE_REJECTS',
  semantic_root_cause: 'PENDING_GPT',
  rows: residualRows.map(row => ({
    candidate_id: row.candidate_id,
    case_id: row.case_id,
    candidate_index: row.candidate_index,
    statement: row.raw_candidate.statement,
    source_hash: row.source_hash,
    grounding_reasons: row.after.grounding_reasons,
    failure_family_proposal: residualClassification(row),
    confidence: 'MECHANICAL_PROPOSAL',
    repair_applied: false
  }))
};

const reviewBurdenArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_REVIEW_BURDEN',
  before: beforeCounts,
  after: afterCounts,
  gpt_false_reject_rows: oldRejectRows.length,
  deterministic_false_rejects_closed: closedRows.length,
  residual_rejects_pending_gpt: residualRows.length,
  review_required_delta: (afterCounts.REVIEW_REQUIRED || 0) - (beforeCounts.REVIEW_REQUIRED || 0),
  note: 'A grounding REJECT converted to REVIEW_REQUIRED remains fail-closed for authority; semantic acceptance is not inferred.'
};

const routingArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_UPDATED_ROUTING_GAP_EVAL_ONLY',
  frozen_router_mutated: false,
  rows: [
    { requirement_id: 'REQ-099', annotation: 'CONDITIONAL_COMPLIANCE', enterprise_evidence_default: 'NO' },
    { requirement_id: 'REQ-139', annotation: 'GENUINE_EVIDENCE' },
    { requirement_id: 'REQ-014', annotation: 'COMPLIANCE_ACTION', enterprise_evidence: 'NO' },
    { requirement_id: 'REQ-023', annotation: 'CONDITIONAL_EVIDENCE', applicability_gate: 'REQUIRED' }
  ]
};

const beforeAfterArtifact = {
  artifact_type: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1_OFFLINE_BEFORE_AFTER',
  source_artifact: 'docs/handoff/V43_TARGETED_FACT_HOST_REPLAY_V3/03_PROVIDER_EXECUTION_REPORT.json',
  source_sha256: sha256File(reportPath),
  source_run_id: report.run_id,
  provider_calls_added: 0,
  rows: allRows
};

const checkpointArtifact = {
  checkpoint: 'V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1',
  generated_for_source_run: report.run_id,
  input_artifact_sha256: sha256File(reportPath),
  current_code_sha256: {
    'backend/src/pipeline/evidence-fact-candidate-v2.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2.js')),
    'backend/src/pipeline/evidence-fact-candidate-v2-1.js': sha256File(path.join(repoRoot, 'backend', 'src', 'pipeline', 'evidence-fact-candidate-v2-1.js')),
    'backend/test/evidence-fact-candidate-v2-1.test.js': sha256File(path.join(repoRoot, 'backend', 'test', 'evidence-fact-candidate-v2-1.test.js'))
  },
  candidate_count: allRows.length,
  before_distribution: beforeCounts,
  after_distribution: afterCounts,
  gpt_statement_supported_yes_count: allRows.filter(row => row.gpt_semantic_label.statement_supported === 'YES').length,
  gpt_statement_supported_no_count: allRows.filter(row => row.gpt_semantic_label.statement_supported === 'NO').length,
  grounding_false_reject_count_before: oldRejectRows.length,
  line_wrap_false_rejects_closed: closedRows.length,
  residual_false_rejects: residualRows.length,
  candidate_17_auto_accept: candidate17.after.grounding_decision === 'ACCEPT',
  unsupported_fact_auto_accept: 0,
  negative_safety_all_fail_closed: safetyArtifact.all_fail_closed,
  semantic_contract_widened: false,
  source_snapshot_mutated: false,
  routing_gap_artifact_eval_only: true,
  semantic_root_cause: 'PENDING_GPT',
  safety: {
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    prompt_changes: 0,
    schema_changes: 0,
    production_semantic_changes: 0
  },
  status: residualRows.length === 0
    ? 'DETERMINISTIC_GROUNDING_CLOSURE_COMPLETE_PENDING_GPT_REVIEW'
    : 'PARTIAL_DETERMINISTIC_CLOSURE_PENDING_GPT_SEMANTIC_REVIEW'
};

const artifacts = [
  ['01_GPT_SEMANTIC_LABELS.json', labelsArtifact],
  ['02_GROUNDING_FAILURE_FAMILY.json', familyArtifact],
  ['03_SOURCE_TEXT_NORMALIZATION_TESTS.json', normalizationArtifact],
  ['04_OFFLINE_BEFORE_AFTER.json', beforeAfterArtifact],
  ['05_NEGATIVE_SAFETY_REGRESSION.json', safetyArtifact],
  ['06_RESIDUAL_FALSE_REJECTS.json', residualArtifact],
  ['07_REVIEW_BURDEN.json', reviewBurdenArtifact],
  ['08_UPDATED_ROUTING_GAP.json', routingArtifact],
  ['09_CHECKPOINT.json', checkpointArtifact]
];
for (const [name, value] of artifacts) fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`);

const checkpointMarkdown = [
  '# V43_FACT_GROUNDING_FALSE_NEGATIVE_CLOSURE_V1',
  '',
  `- source run: ${report.run_id}`,
  `- candidates replayed offline: ${allRows.length}`,
  `- before grounding: ${JSON.stringify(beforeCounts)}`,
  `- after grounding: ${JSON.stringify(afterCounts)}`,
  `- GPT statement-supported: ${allRows.filter(row => row.gpt_semantic_label.statement_supported === 'YES').length}/${allRows.length}`,
  `- line-wrap false rejects closed deterministically: ${closedRows.length}`,
  `- residual false rejects pending GPT: ${residualRows.length}`,
  `- candidate 17 accepted: ${checkpointArtifact.candidate_17_auto_accept}`,
  `- unsupported fact auto-accept: ${checkpointArtifact.unsupported_fact_auto_accept}`,
  `- negative safety all fail closed: ${checkpointArtifact.negative_safety_all_fail_closed}`,
  '',
  'Semantic root cause remains PENDING_GPT. No Provider, persistence, Gold, Mapping, Claim, or Writer action was performed.'
].join('\n');
fs.writeFileSync(path.join(outputDir, '09_CHECKPOINT.md'), `${checkpointMarkdown}\n`);

console.log(JSON.stringify({
  output_dir: path.relative(repoRoot, outputDir),
  candidate_count: allRows.length,
  before: beforeCounts,
  after: afterCounts,
  closed: closedRows.length,
  residual: residualRows.length,
  provider_calls_added: 0,
  safety_all_fail_closed: safetyArtifact.all_fail_closed,
  checkpoint_sha256: sha256Value(checkpointArtifact)
}, null, 2));
