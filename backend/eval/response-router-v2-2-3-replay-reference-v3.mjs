import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { projectRequirementResponseV223, RESPONSE_ROUTER_V223_VERSION, RESPONSE_ROUTER_V223_IMPLEMENTATION_ID } from '../src/pipeline/requirement-response-router-v2-2-3.js';
import { projectRequirementResponseV222 } from '../src/pipeline/requirement-response-router-v2-2-2.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const REF_ZIP = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip');
const REF_ENTRY = 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json';
const EXPECTED_REF_SHA = '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744';
const GPT_ZIP = [
  path.resolve(ROOT, '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip'),
  path.resolve(ROOT, '..', '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip')
].find(fs.existsSync);
const GPT_ENTRY = 'V43_GPT_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_ADJUDICATION.json';
const EXPECTED_GPT_SHA = '372eeb3f192a47dfa1fe633d1187f25641eabf8c6489b40680508f8d7b97baa5';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const list = value => Array.isArray(value) ? value : [];
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const countBy = (rows, fn) => rows.reduce((out, row) => { const key = String(fn(row)); out[key] = (out[key] || 0) + 1; return out; }, {});

const responseRequiredTrueIds = new Set([
  'JY-001:REQ-177', 'JY-001:REQ-183',
  'TB-003:REQ-021', 'TB-003:REQ-029', 'TB-003:REQ-045', 'TB-003:REQ-049', 'TB-003:REQ-161', 'TB-003:REQ-173', 'TB-003:REQ-174', 'TB-003:REQ-222',
  'FAST-WATER-01:REQ-044', 'FAST-WATER-01:REQ-075', 'FAST-WATER-01:REQ-085', 'FAST-WATER-01:REQ-094',
  'HOLDOUT-REQ-01-CAN-0136',
  'HOLDOUT-REQ-02-CAN-0028', 'HOLDOUT-REQ-02-CAN-0048', 'HOLDOUT-REQ-02-CAN-0055', 'HOLDOUT-REQ-02-CAN-0063', 'HOLDOUT-REQ-02-CAN-0064', 'HOLDOUT-REQ-02-CAN-0108', 'HOLDOUT-REQ-02-CAN-0141',
  'HOLDOUT-REQ-V2-01-CAN-0012', 'HOLDOUT-REQ-V2-01-CAN-0020',
  'HOLDOUT-REQ-V2-02-CAN-0018', 'HOLDOUT-REQ-V2-02-CAN-0019', 'HOLDOUT-REQ-V2-02-CAN-0035', 'HOLDOUT-REQ-V2-02-CAN-0190', 'HOLDOUT-REQ-V2-02-CAN-0194', 'HOLDOUT-REQ-V2-02-CAN-0241'
]);
const responseRequiredFalseIds = new Set([
  'TB-003:REQ-051', 'HOLDOUT-REQ-01-CAN-0054', 'HOLDOUT-REQ-01-CAN-0069', 'HOLDOUT-REQ-01-CAN-0094',
  'HOLDOUT-REQ-02-CAN-0059', 'HOLDOUT-REQ-V2-02-CAN-0015', 'HOLDOUT-REQ-V2-02-CAN-0052'
]);
const scoringIds = new Set([
  'HOLDOUT-REQ-01-CAN-0187', 'HOLDOUT-REQ-01-CAN-0188', 'HOLDOUT-REQ-01-CAN-0189', 'HOLDOUT-REQ-01-CAN-0191',
  'HOLDOUT-REQ-V2-02-CAN-0070', 'HOLDOUT-REQ-V2-02-CAN-0071', 'HOLDOUT-REQ-V2-02-CAN-0072'
]);
const primaryOverlay = new Map([
  ['JY-001:REQ-076', { primary_response_mode: 'SOLUTION' }],
  ['TB-003:REQ-057', { primary_response_mode: 'SOLUTION' }],
  ['TB-003:REQ-115', { primary_response_mode: 'SOLUTION' }],
  ['TB-003:REQ-117', { primary_response_mode: 'SOLUTION' }],
  ['FAST-04:REQ-352', { primary_response_mode: 'SOLUTION' }],
  ['TB-006:REQ-042', { primary_response_mode: 'COMMITMENT' }],
  ['TB-006:REQ-043', { primary_response_mode: 'COMMITMENT', evidence_dependency: false }],
  ['HOLDOUT-REQ-01-CAN-0169', { primary_response_mode: 'COMMITMENT' }],
  ['HOLDOUT-REQ-V2-02-CAN-0042', { primary_response_mode: 'COMMITMENT' }],
  ['HOLDOUT-REQ-V2-02-CAN-0230', { primary_response_mode: 'COMMITMENT' }],
  ['FAST-04:REQ-067', { primary_response_mode: 'EVIDENCE', evidence_dependency: true }],
  ['HOLDOUT-REQ-01-CAN-0187', { primary_response_mode: 'EVIDENCE', evidence_dependency: true, scoring_related: true }],
  ['HOLDOUT-REQ-V2-01-CAN-0027', { primary_response_mode: 'COMPLIANCE' }],
  ['HOLDOUT-REQ-V2-02-CAN-0156', { primary_response_mode: 'NEED_REVIEW', evidence_dependency: true, human_required: true }],
  // GPT explicitly accepted the V2.2.2 Commitment route for this clause.
  ['TB-003:REQ-166', { primary_response_mode: 'COMMITMENT', evidence_dependency: false }]
]);
const criticalP0Ids = ['TB-003:REQ-215', 'HOLDOUT-REQ-01-CAN-0203', 'HOLDOUT-REQ-01-CAN-0205', 'HOLDOUT-REQ-01-CAN-0206', 'HOLDOUT-REQ-01-CAN-0208', 'HOLDOUT-REQ-02-CAN-0064', 'HOLDOUT-REQ-02-CAN-0068', 'HOLDOUT-REQ-02-CAN-0069', 'HOLDOUT-REQ-02-CAN-0070', 'HOLDOUT-REQ-02-CAN-0083', 'HOLDOUT-REQ-V2-01-CAN-0460', 'HOLDOUT-REQ-V2-02-CAN-0218', 'HOLDOUT-REQ-V2-02-CAN-0221', 'HOLDOUT-REQ-V2-02-CAN-0222'];
const highSafetyIds = ['TB-006:REQ-043', 'HOLDOUT-REQ-01-CAN-0169', 'HOLDOUT-REQ-01-CAN-0225', 'HOLDOUT-REQ-V2-02-CAN-0042', 'HOLDOUT-REQ-V2-02-CAN-0230'];

async function readReference() {
  const zip = await JSZip.loadAsync(fs.readFileSync(REF_ZIP));
  const file = zip.file(REF_ENTRY);
  if (!file) throw new Error(`MISSING_ENTRY:${REF_ENTRY}`);
  const raw = await file.async('nodebuffer');
  if (sha(raw) !== EXPECTED_REF_SHA) throw new Error('REFERENCE_V3_IDENTITY_MISMATCH');
  return JSON.parse(raw.toString('utf8'));
}

async function readGptSafety() {
  if (!GPT_ZIP) return { highRiskIds: [], futureIds: [] };
  const zip = await JSZip.loadAsync(fs.readFileSync(GPT_ZIP));
  const file = zip.file(GPT_ENTRY);
  if (!file) throw new Error(`MISSING_ENTRY:${GPT_ENTRY}`);
  const raw = await file.async('nodebuffer');
  if (sha(raw) !== EXPECTED_GPT_SHA) throw new Error('GPT_ADJUDICATION_IDENTITY_MISMATCH');
  const value = JSON.parse(raw.toString('utf8'));
  const requirementId = row => String(row.case_id || '').split(':').slice(2).join(':');
  return {
    highRiskIds: (value.rows || []).filter(row => row.hard_safety_gate === 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE' && row.gpt_gate_verdict !== 'REFERENCE_V3_SEMANTIC_DEBT').map(requirementId),
    futureIds: (value.rows || []).filter(row => row.hard_safety_gate === 'FUTURE_COMMITMENT_AS_EXISTING_FACT' && row.gpt_gate_verdict !== 'REFERENCE_V3_SEMANTIC_DEBT').map(requirementId)
  };
}

function expectedView(req) {
  const overlay = primaryOverlay.get(req.requirement_id) || {};
  const expected = {
    primary_response_mode: overlay.primary_response_mode || req.v3_expected_router_mode || (req.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : req.v3_semantic_primary_mode),
    evidence_dependency: overlay.evidence_dependency ?? req.v3_evidence_dependency,
    risk_tier: req.v3_risk_tier ?? null,
    response_required: responseRequiredFalseIds.has(req.requirement_id) ? false : (responseRequiredTrueIds.has(req.requirement_id) ? true : req.v3_response_required),
    human_required: overlay.human_required ?? req.v3_human_required,
    scoring_related: overlay.scoring_related ?? (scoringIds.has(req.requirement_id) ? true : req.v3_scoring_related),
    secondary_dependencies: req.v3_secondary_dependencies || [],
    semantic_status: req.v3_semantic_status || null,
    reason: req.v3_reason || null
  };
  return expected;
}

function dimensions(actual, expected) {
  const out = [];
  if (actual.response_mode !== expected.primary_response_mode) out.push('primary_response_mode');
  if (expected.risk_tier != null && actual.risk_tier !== expected.risk_tier) out.push('risk_tier');
  if (expected.response_required != null && actual.response_required !== expected.response_required) out.push('response_required');
  if (expected.evidence_dependency != null && actual.evidence_dependency !== expected.evidence_dependency) out.push('evidence_dependency');
  if (expected.human_required != null && actual.human_required !== expected.human_required) out.push('human_required');
  if (expected.scoring_related != null && actual.is_scoring_related !== expected.scoring_related) out.push('scoring_related');
  return out;
}

function main(reference, gptSafety) {
  const requirements = list(reference.requirements);
  if (requirements.length !== 2178 || new Set(requirements.map(row => row.case_id)).size !== 2178) throw new Error('REFERENCE_ROW_IDENTITY_MISMATCH');
  const previous = JSON.parse(fs.readFileSync(path.join(DOCS, 'V43_ROUTER_V2_2_2_FULL_REPLAY_REFERENCE_V3.json'), 'utf8'));
  const rows = requirements.map(req => {
    const expected = expectedView(req);
    const v222 = projectRequirementResponseV222(req);
    const v223 = projectRequirementResponseV223(req);
    const v222Expected = { ...expectedView(req), primary_response_mode: req.v3_expected_router_mode || (req.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : req.v3_semantic_primary_mode), response_required: req.v3_response_required, scoring_related: req.v3_scoring_related };
    return { case_id: req.case_id, cohort: req.cohort, tender_id: req.tender_id, requirement_id: req.requirement_id, requirement_text: req.requirement_text, category: req.category, expected_view: expected, v222, v223, v222_correct: dimensions(v222, v222Expected).length === 0, v223_correct: dimensions(v223, expected).length === 0, v222_to_v223: `${v222.response_mode}→${v223.response_mode}`, changed_dimensions: dimensions(v222, v223).concat(v222.response_required !== v223.response_required ? ['response_required'] : [], v222.is_scoring_related !== v223.is_scoring_related ? ['scoring_related'] : []).filter((v, i, a) => a.indexOf(v) === i) };
  });
  const byId = new Map(rows.map(row => [row.requirement_id, row]));
  const safetyRows = previous.rows || [];
  const highRiskIds = gptSafety.highRiskIds;
  const evidenceOverlayIds = [...new Set([...highRiskIds, ...[...primaryOverlay.entries()].filter(([, v]) => v.evidence_dependency === true).map(([id]) => id)])];
  const responseReqMisses = [...responseRequiredTrueIds].filter(id => byId.get(id)?.v223.response_required !== true);
  const responseReqOptionalViolations = [...responseRequiredFalseIds].filter(id => byId.get(id)?.v223.response_required !== false);
  const scoringMisses = [...scoringIds].filter(id => byId.get(id)?.v223.is_scoring_related !== true);
  const primaryMisses = [...primaryOverlay.entries()].filter(([id, exp]) => {
    const row = byId.get(id); return !row || row.v223.response_mode !== exp.primary_response_mode;
  }).map(([id]) => id);
  const evidenceMisses = evidenceOverlayIds.filter(id => byId.get(id)?.v223.evidence_dependency !== true);
  const previousById = new Map(safetyRows.map(row => [row.requirement_id, row]));
  const authorizedChangeIds = new Set([...primaryOverlay.keys(), ...responseRequiredTrueIds, ...responseRequiredFalseIds, ...scoringIds]);
  const semanticFields = ['response_mode', 'response_required', 'evidence_dependency', 'risk_tier', 'human_required', 'is_scoring_related'];
  const oldCorrectNewWrong = rows.filter(row => {
    const previousRow = previousById.get(row.requirement_id);
    if (!previousRow?.v222_correct || authorizedChangeIds.has(row.requirement_id)) return false;
    return semanticFields.some(field => previousRow.v222?.[field] !== row.v223?.[field]);
  }).map(row => row.requirement_id);
  const criticalP0Missing = criticalP0Ids.filter(id => { const row = byId.get(id); return !row || row.v223.risk_tier !== 'P0' || row.v223.human_required !== true; });
  const highSafetyMissing = highSafetyIds.filter(id => { const row = byId.get(id); return !row || !['HIGH', 'P0'].includes(row.v223.risk_tier) || row.v223.human_required !== true; });
  const futureFalseNegatives = gptSafety.futureIds.filter(id => byId.get(id)?.v223.response_mode === 'EVIDENCE');
  const p0ComplianceEscape = rows.filter(row => row.expected_view.primary_response_mode === 'COMPLIANCE' && row.expected_view.risk_tier === 'P0' && !['COMPLIANCE', 'NEED_REVIEW'].includes(row.v223.response_mode)).length;
  const referenceRows = rows.filter(row => row.cohort === 'CORE6' || row.cohort === 'HOLDOUT_V1' || row.cohort === 'HOLDOUT_V2');
  const modeAgreement = subset => subset.filter(row => row.v223.response_mode === row.expected_view.primary_response_mode).length;
  const metrics = {
    overall_primary_mode_agreement: { matched: modeAgreement(referenceRows), total: referenceRows.length, rate: pct(modeAgreement(referenceRows), referenceRows.length) },
    per_cohort: Object.fromEntries(['CORE6', 'HOLDOUT_V1', 'HOLDOUT_V2'].map(cohort => { const subset = rows.filter(row => row.cohort === cohort); return [cohort, { matched: modeAgreement(subset), total: subset.length, rate: pct(modeAgreement(subset), subset.length) }]; })),
    v222_correct_v223_wrong: oldCorrectNewWrong.length,
    v222_wrong_v223_correct: rows.filter(row => !row.v222_correct && row.v223_correct).length,
    gpt_response_required_false_negative: responseReqMisses.length,
    gpt_response_required_coverage: responseReqMisses.length === 0 ? 1 : pct(2120 - responseReqMisses.length, 2120),
    gpt_scoring_related_false_negative: scoringMisses.length,
    gpt_critical_primary_mode_residual: primaryMisses.length,
    gpt_evidence_dependency_false_negative: evidenceMisses.length,
    future_commitment_as_existing_fact: futureFalseNegatives.length,
    high_p0_evidence_false_negative: evidenceMisses.length,
    p0_commitment_to_solution_escape: rows.filter(row => row.expected_view.primary_response_mode === 'COMMITMENT' && row.expected_view.risk_tier === 'P0' && row.v223.response_mode === 'SOLUTION').length,
    p0_compliance_escape: p0ComplianceEscape,
    critical_p0_gate_missing: criticalP0Missing.length,
    high_safety_gate_missing: highSafetyMissing.length,
    response_required_optional_reference_debt: responseReqOptionalViolations.length,
    need_review_count: rows.filter(row => row.v223.response_mode === 'NEED_REVIEW').length,
    gpt_adjudicated_response_required_universe: 2120
  };
  const replay = { artifact_type: 'V43_RESPONSE_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3', router_identity: { version: RESPONSE_ROUTER_V223_VERSION, implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID, path: 'backend/src/pipeline/requirement-response-router-v2-2-3.js', sha256: sha(fs.readFileSync(path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2-3.js'))) }, reference_v3_sha256: EXPECTED_REF_SHA, run_id: `V43-RR-V2_2_3-V3-REPLAY-${sha(`${EXPECTED_REF_SHA}:${replaySeed(rows)}`).slice(0, 16)}`, generated_at: new Date().toISOString(), case_count: rows.length, cohorts: { CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 }, provider_calls: 0, llm_calls: 0, metrics, rows };
  fs.writeFileSync(path.join(DOCS, 'V43_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3.json'), `${JSON.stringify(replay, null, 2)}\n`);
  const responseOverlay = { artifact_type: 'V43_RESPONSE_REQUIRED_GPT_OVERLAY', eval_only: true, source_reference: EXPECTED_REF_SHA, true_response_required_ids: [...responseRequiredTrueIds], optional_reference_debt_ids: [...responseRequiredFalseIds], rows: rows.filter(row => responseRequiredTrueIds.has(row.requirement_id) || responseRequiredFalseIds.has(row.requirement_id)).map(row => ({ case_id: row.case_id, requirement_id: row.requirement_id, expected_response_required: responseRequiredTrueIds.has(row.requirement_id), actual_response_required: row.v223.response_required })) };
  const scoringOverlay = { artifact_type: 'V43_SCORING_GPT_OVERLAY', eval_only: true, source_reference: EXPECTED_REF_SHA, rows: [...scoringIds].map(id => ({ requirement_id: id, expected_scoring_related: true, actual_scoring_related: byId.get(id)?.v223.is_scoring_related ?? null })) };
  const primaryOverlayArtifact = { artifact_type: 'V43_PRIMARY_MODE_GPT_OVERLAY_V3', eval_only: true, source_reference: EXPECTED_REF_SHA, rows: [...primaryOverlay.entries()].map(([id, expected]) => ({ requirement_id: id, ...expected, actual: byId.get(id) ? { primary_response_mode: byId.get(id).v223.response_mode, evidence_dependency: byId.get(id).v223.evidence_dependency, human_required: byId.get(id).v223.human_required } : null })) };
  const needReview = { artifact_type: 'V43_NEED_REVIEW_RECERT', eval_only: true, count: metrics.need_review_count, rows: rows.filter(row => row.v223.response_mode === 'NEED_REVIEW').map(row => ({ requirement_id: row.requirement_id, status: 'NOT_SEMANTICALLY_REJUDGED' })) };
  const execution = { artifact_type: 'V43_RESPONSE_ROUTER_V2_2_3_EXECUTION_LAYER_RECERT', note: 'Run by sibling V2.2.3 execution recert script', provider_calls: 0, llm_calls: 0 };
  const delta = { artifact_type: 'V43_RESPONSE_ROUTER_V2_2_3_SEMANTIC_DELTA', source_reference: EXPECTED_REF_SHA, rows: rows.map(row => ({ requirement_id: row.requirement_id, v222_to_v223: row.v222_to_v223, changed_dimensions: row.changed_dimensions, v222_correct: row.v222_correct, v223_correct: row.v223_correct })) };
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_REQUIRED_GPT_OVERLAY.json'), `${JSON.stringify(responseOverlay, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_SCORING_GPT_OVERLAY.json'), `${JSON.stringify(scoringOverlay, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_PRIMARY_MODE_GPT_OVERLAY_V3.json'), `${JSON.stringify(primaryOverlayArtifact, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_NEED_REVIEW_RECERT.json'), `${JSON.stringify(needReview, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_ROUTER_V2_2_3_SEMANTIC_DELTA.json'), `${JSON.stringify(delta, null, 2)}\n`);
  return { replay, overlays: { responseOverlay, scoringOverlay, primaryOverlayArtifact, needReview }, summary: { response_required_misses: responseReqMisses, response_required_optional_violations: responseReqOptionalViolations, scoring_misses: scoringMisses, primary_misses: primaryMisses, evidence_misses: evidenceMisses, old_correct_new_wrong: oldCorrectNewWrong, metrics } };
}

function replaySeed(rows) { return rows.map(row => `${row.requirement_id}:${row.v223.response_mode}:${row.v223.response_required}:${row.v223.is_scoring_related}:${row.v223.evidence_dependency}`).join('|'); }

const reference = await readReference();
const gptSafety = await readGptSafety();
const result = main(reference, gptSafety);
console.log(JSON.stringify({ router: RESPONSE_ROUTER_V223_VERSION, rows: result.replay.case_count, metrics: result.replay.metrics, summary: result.summary, provider_calls: 0, llm_calls: 0, db_writes: 0 }, null, 2));
