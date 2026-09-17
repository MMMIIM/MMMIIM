import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const root = path.resolve('backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab');
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const outDir = path.join(root, `critical-structure-final-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'canonical-requirements.json'), 'utf8')).requirements;
const lineage = JSON.parse(fs.readFileSync(path.join(root, 'candidate-lineage.json'), 'utf8')).candidates;
const sixTender = JSON.parse(fs.readFileSync(path.resolve('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'), 'utf8')).requirements;
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');

function findLineage(requirement) {
  const refs = new Set(requirement.source_refs || []);
  return lineage.find(entry => entry.holdout_tender_id === requirement.holdout_tender_id
    && (requirement.source_refs || []).every(ref => entry.source_refs?.includes(ref)))
    || lineage.find(entry => entry.holdout_tender_id === requirement.holdout_tender_id
      && [...refs].some(ref => entry.source_refs?.includes(ref)));
}

function replayOne(requirement, entry) {
  const location = entry?.location || {};
  const sourceText = location.source_text || entry?.source_context || requirement.resolved_source_context || requirement.source_excerpt || '';
  const parentContext = requirement.natural_parent_context || location.source_context_text || entry?.source_context || '';
  const sourceRange = entry?.raw_candidate?.source_range || requirement.source_span || null;
  const result = evaluateRequirementCandidateQuality({
    text: requirement.candidate_text?.[0] || requirement.canonical_requirement_text || requirement.requirement_text,
    source_text: sourceText,
    source_verified: entry?.source_verified === true || requirement.source_location_verified === true || requirement.source_verified === true,
    source_range: sourceRange,
    source_context_text: parentContext
  }, { sourceText, sourceVerified: entry?.source_verified === true || requirement.source_location_verified === true || requirement.source_verified === true, sourceRange, parentContext });
  return {
    case_id: requirement.canonical_requirement_id,
    tender_id: requirement.holdout_tender_id || requirement.tender_id,
    source_refs: requirement.source_refs,
    source_resolved: Boolean(entry) || requirement.source_verified === true,
    source_text_hash: sha256(sourceText),
    candidate_text_hash: sha256(requirement.candidate_text?.[0] || requirement.canonical_requirement_text || requirement.requirement_text),
    old_decision: requirement.quality_gate_decision_class || requirement.quality_gate_decision || 'UNKNOWN',
    new_decision: result.decision === 'PASS' ? 'ACCEPT' : result.decision,
    old_reason_codes: requirement.quality_gate_reason_codes || [],
    new_reason_codes: result.reason_codes,
    parent_consequence: result.parent_consequence,
    natural_parent_context_present: Boolean(parentContext),
    atomic_source_hash: sha256(sourceText)
  };
}

const holdoutRows = canonical.map(requirement => replayOne(requirement, findLineage(requirement)));
const sixTenderRows = sixTender.map(requirement => replayOne(requirement, null));
function metrics(rows) {
  const transitions = {};
  for (const row of rows) {
    const key = `${row.old_decision}->${row.new_decision}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }
  return {
    total: rows.length,
    before: {
      accept: rows.filter(row => row.old_decision === 'ACCEPT').length,
      review_required: rows.filter(row => row.old_decision === 'REVIEW_REQUIRED').length,
      reject: rows.filter(row => row.old_decision === 'REJECT').length
    },
    after: {
      accept: rows.filter(row => row.new_decision === 'ACCEPT').length,
      review_required: rows.filter(row => row.new_decision === 'REVIEW_REQUIRED').length,
      reject: rows.filter(row => row.new_decision === 'REJECT').length
    },
    transitions,
    parent_review_count: rows.filter(row => row.new_reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')).length,
    source_unresolved: rows.filter(row => !row.source_resolved).length,
    accept_to_review_parent: rows.filter(row => row.old_decision === 'ACCEPT' && row.new_decision === 'REVIEW_REQUIRED' && row.new_reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')).length
  };
}
const anchors = holdoutRows.filter(row => ['HOLDOUT-REQ-01-CAN-0149', 'HOLDOUT-REQ-01-CAN-0208'].includes(row.case_id));
const postFix = JSON.parse(fs.readFileSync(path.resolve('docs/V43_REQUIREMENT_POST_FIX_VALIDATION_V2_CASE_RESULTS.json'), 'utf8')).cases
  .find(item => item.validation_v2_case_id === 'POST-FIX-V2-015');
const postFixRow = postFix ? replayOne({
  canonical_requirement_id: postFix.validation_v2_case_id,
  holdout_tender_id: postFix.tender_id,
  canonical_requirement_text: postFix.canonical_requirement.text,
  candidate_text: [postFix.canonical_requirement.text],
  source_refs: postFix.source_context.source_refs,
  source_location_verified: postFix.source_context.source_verified,
  resolved_source_context: postFix.source_context.source_excerpt,
  natural_parent_context: postFix.source_context.source_excerpt,
  quality_gate_decision: postFix.actual.decision,
  quality_gate_reason_codes: postFix.actual.reason_codes
}, { location: { source_text: postFix.source_context.source_excerpt, source_context_text: postFix.source_context.source_excerpt }, source_verified: postFix.source_context.source_verified, raw_candidate: { source_range: postFix.source_context.source_span } }) : null;

const artifact = {
  artifact_type: 'V43_PARALLEL_REQUIREMENT_CRITICAL_STRUCTURE_OFFLINE_REPLAY',
  eval_only: true,
  generated_at: new Date().toISOString(),
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  holdout_v1: metrics(holdoutRows),
  six_tender_1009: metrics(sixTenderRows),
  anchors,
  post_fix_v2_015: postFixRow,
  rows: holdoutRows
};
fs.writeFileSync(path.join(outDir, 'offline-replay.json'), `${JSON.stringify(artifact, null, 2)}\n`);
const deltaCases = holdoutRows.filter(row => row.old_decision !== row.new_decision);
if (postFixRow) deltaCases.push(postFixRow);
fs.writeFileSync(path.join(outDir, 'V43_REQUIREMENT_CRITICAL_STRUCTURE_DELTA_GPT_PACKET.json'), `${JSON.stringify({
  artifact_type: 'V43_REQUIREMENT_CRITICAL_STRUCTURE_DELTA_GPT_PACKET', eval_only: true,
  expected_labels: 'NOT_INCLUDED', codex_verdict: 'NOT_INCLUDED', provider_calls: 0,
  cases: deltaCases
}, null, 2)}\n`);
console.log(JSON.stringify({ outDir, holdout_v1: artifact.holdout_v1, six_tender_1009: artifact.six_tender_1009, anchors, post_fix_v2_015: postFixRow && { old: postFixRow.old_decision, new: postFixRow.new_decision, reasons: postFixRow.new_reason_codes }, provider_calls: 0 }, null, 2));
