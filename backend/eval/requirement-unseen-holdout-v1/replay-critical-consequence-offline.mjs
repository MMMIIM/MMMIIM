import fs from 'node:fs';
import path from 'node:path';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const HOLDOUT_DIR = path.resolve('backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab');
const canonicalPacket = JSON.parse(fs.readFileSync(path.join(HOLDOUT_DIR, 'canonical-requirements.json'), 'utf8'));
const lineagePacket = JSON.parse(fs.readFileSync(path.join(HOLDOUT_DIR, 'candidate-lineage.json'), 'utf8'));
const canonicalRequirements = canonicalPacket.requirements;
const lineage = lineagePacket.candidates;

function findLineage(requirement) {
  const refs = new Set(requirement.source_refs || []);
  return lineage.find((entry) => entry.holdout_tender_id === requirement.holdout_tender_id
    && (requirement.source_refs || []).every((ref) => entry.source_refs?.includes(ref)))
    || lineage.find((entry) => entry.holdout_tender_id === requirement.holdout_tender_id
      && [...refs].some((ref) => entry.source_refs?.includes(ref)));
}

function evaluate(requirement, entry) {
  const location = entry?.location || {};
  const sourceText = location.source_text || entry?.source_context || requirement.resolved_source_context || '';
  const parentContext = requirement.natural_parent_context || location.source_context_text || entry?.source_context || '';
  const sourceRange = entry?.raw_candidate?.source_range || null;
  const candidateText = requirement.candidate_text?.[0] || requirement.canonical_requirement_text || '';
  return evaluateRequirementCandidateQuality({
    text: candidateText,
    source_text: sourceText,
    source_verified: entry?.source_verified === true || requirement.source_location_verified === true,
    source_range: sourceRange,
    source_context_text: parentContext
  }, {
    sourceText,
    sourceVerified: entry?.source_verified === true || requirement.source_location_verified === true,
    sourceRange,
    parentContext
  });
}

const rows = canonicalRequirements.map((requirement) => {
  const entry = findLineage(requirement);
  const result = evaluate(requirement, entry);
  const oldDecision = requirement.quality_gate_decision_class || requirement.quality_gate_decision || 'UNKNOWN';
  const newDecision = result.decision === 'PASS' ? 'ACCEPT' : result.decision;
  return {
    case_id: requirement.canonical_requirement_id,
    tender_id: requirement.holdout_tender_id,
    source_refs: requirement.source_refs,
    source_resolved: Boolean(entry),
    atomic_source_text: entry?.location?.source_text || entry?.source_context || null,
    natural_parent_context: requirement.natural_parent_context || entry?.location?.source_context_text || null,
    candidate: requirement.candidate_text?.[0] || requirement.canonical_requirement_text,
    canonical: requirement.canonical_requirement_text,
    old_decision: oldDecision,
    new_decision: newDecision,
    old_reason_codes: requirement.quality_gate_reason_codes || [],
    new_reason_codes: result.reason_codes,
    matched_consequence: result.parent_consequence?.evidence?.governing_consequence || null,
    parent_consequence: result.parent_consequence,
    alignment_evidence: result.parent_consequence?.evidence || null,
    source_verified: result.source_verified,
    source_text_hash: result.source_text_hash,
    candidate_text_hash: result.candidate_text_hash
  };
});

const transitions = {};
for (const row of rows) {
  const key = `${row.old_decision}->${row.new_decision}`;
  transitions[key] = (transitions[key] || 0) + 1;
}
const detectorDelta = rows.filter((row) => row.old_decision === 'ACCEPT'
  && row.new_decision === 'REVIEW_REQUIRED'
  && row.new_reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
const anchorIds = new Set(['HOLDOUT-REQ-01-CAN-0149', 'HOLDOUT-REQ-01-CAN-0208']);
const anchors = rows.filter((row) => anchorIds.has(row.case_id));

const outputDir = path.join(HOLDOUT_DIR, 'critical-consequence-offline');
fs.mkdirSync(outputDir, { recursive: true });
const replay = {
  artifact_type: 'V43_REQUIREMENT_CRITICAL_CONSEQUENCE_OFFLINE_REPLAY',
  eval_only: true,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  total: rows.length,
  source_resolution_unexplained_failure: rows.filter((row) => !row.source_resolved).length,
  before: {
    accept: rows.filter((row) => row.old_decision === 'ACCEPT').length,
    review_required: rows.filter((row) => row.old_decision === 'REVIEW_REQUIRED').length,
    reject: rows.filter((row) => row.old_decision === 'REJECT').length
  },
  after: {
    accept: rows.filter((row) => row.new_decision === 'ACCEPT').length,
    review_required: rows.filter((row) => row.new_decision === 'REVIEW_REQUIRED').length,
    reject: rows.filter((row) => row.new_decision === 'REJECT').length
  },
  transitions,
  parent_consequence_reason_count: rows.filter((row) => row.new_reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')).length,
  detector_delta_count: detectorDelta.length,
  anchor_case_ids: [...anchorIds],
  anchors,
  rows
};
fs.writeFileSync(path.join(outputDir, 'offline-replay.json'), `${JSON.stringify(replay, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'offline-replay.md'), [
  '# Critical consequence offline replay',
  '',
  `- Canonical total: ${replay.total}`,
  `- Before ACCEPT/REVIEW/REJECT: ${replay.before.accept}/${replay.before.review_required}/${replay.before.reject}`,
  `- After ACCEPT/REVIEW/REJECT: ${replay.after.accept}/${replay.after.review_required}/${replay.after.reject}`,
  `- ACCEPT → REVIEW via parent detector: ${replay.detector_delta_count}`,
  `- Source resolution unexplained failures: ${replay.source_resolution_unexplained_failure}`,
  `- Provider calls: ${replay.provider_calls}`,
  '',
  'This is Eval-only evidence. No expected semantic labels or production verdicts are assigned.'
].join('\n') + '\n');

const deltaPacket = {
  artifact_type: 'V43_REQUIREMENT_CRITICAL_CONSEQUENCE_DELTA_GPT_PACKET',
  eval_only: true,
  expected_labels: 'NOT_INCLUDED',
  codex_verdict: 'NOT_INCLUDED',
  recommended_gold: 'NOT_INCLUDED',
  provider_calls: 0,
  cases: [...detectorDelta, ...anchors.filter((anchor) => !detectorDelta.some((row) => row.case_id === anchor.case_id))]
};
const postFixCases = JSON.parse(fs.readFileSync(path.resolve('docs/V43_REQUIREMENT_POST_FIX_VALIDATION_V2_CASE_RESULTS.json'), 'utf8')).cases;
const postFix015 = postFixCases.find((item) => item.validation_v2_case_id === 'POST-FIX-V2-015');
if (postFix015) {
  const source = postFix015.source_context?.source_excerpt || '';
  const result = evaluateRequirementCandidateQuality({
    text: postFix015.canonical_requirement?.text || '',
    source_text: source,
    source_verified: postFix015.source_context?.source_verified === true,
    source_range: postFix015.source_context?.source_span || null
  }, {
    sourceText: source,
    sourceVerified: postFix015.source_context?.source_verified === true,
    sourceRange: postFix015.source_context?.source_span || null,
    parentContext: source
  });
  deltaPacket.cases.push({
    case_id: postFix015.validation_v2_case_id,
    tender_id: postFix015.tender_id,
    source_refs: postFix015.source_context.source_refs,
    atomic_source_text: source,
    natural_parent_context: source,
    candidate: postFix015.canonical_requirement.text,
    canonical: postFix015.canonical_requirement.text,
    old_decision: postFix015.actual.decision,
    new_decision: result.decision,
    old_reason_codes: postFix015.actual.reason_codes,
    new_reason_codes: result.reason_codes,
    matched_consequence: result.parent_consequence?.evidence?.governing_consequence || null,
    parent_consequence: result.parent_consequence,
    alignment_evidence: result.parent_consequence?.evidence || null
  });
}
fs.writeFileSync(path.join(outputDir, 'V43_REQUIREMENT_CRITICAL_CONSEQUENCE_DELTA_GPT_PACKET.json'), `${JSON.stringify(deltaPacket, null, 2)}\n`);

const sixTender = JSON.parse(fs.readFileSync(path.resolve('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'), 'utf8'));
const replay1009Rows = sixTender.requirements.map((requirement) => {
  const sourceText = requirement.source_excerpt || '';
  const result = evaluateRequirementCandidateQuality({
    text: requirement.requirement_text,
    source_text: sourceText,
    source_verified: requirement.source_verified === true,
    source_range: requirement.source_span || null
  }, {
    sourceText,
    sourceVerified: requirement.source_verified === true,
    sourceRange: requirement.source_span || null,
    parentContext: ''
  });
  return {
    canonical_requirement_id: requirement.canonical_requirement_id,
    tender_id: requirement.tender_id,
    decision: result.decision === 'PASS' ? 'PASS' : result.decision,
    reason_codes: result.reason_codes,
    source_verified: result.source_verified,
    source_text_hash: result.source_text_hash,
    candidate_text_hash: result.candidate_text_hash
  };
});
const replay1009 = {
  artifact_type: 'V43_REQUIREMENT_1009_CRITICAL_CONSEQUENCE_OFFLINE_REPLAY',
  eval_only: true,
  total: replay1009Rows.length,
  accept: replay1009Rows.filter((row) => row.decision === 'PASS').length,
  review_required: replay1009Rows.filter((row) => row.decision === 'REVIEW_REQUIRED').length,
  reject: replay1009Rows.filter((row) => row.decision === 'REJECT').length,
  parent_consequence_reason_count: replay1009Rows.filter((row) => row.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')).length,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  rows: replay1009Rows
};
fs.writeFileSync(path.resolve('docs/V43_REQUIREMENT_1009_CRITICAL_CONSEQUENCE_OFFLINE_REPLAY.json'), `${JSON.stringify(replay1009, null, 2)}\n`);

console.log(JSON.stringify({
  holdout: {
    total: replay.total,
    before: replay.before,
    after: replay.after,
    transitions: replay.transitions,
    detector_delta_count: replay.detector_delta_count,
    anchors: anchors.map((row) => ({ case_id: row.case_id, old_decision: row.old_decision, new_decision: row.new_decision, new_reason_codes: row.new_reason_codes }))
  },
  six_tender_1009: { total: replay1009.total, accept: replay1009.accept, review_required: replay1009.review_required, reject: replay1009.reject, parent_consequence_reason_count: replay1009.parent_consequence_reason_count },
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
}, null, 2));
