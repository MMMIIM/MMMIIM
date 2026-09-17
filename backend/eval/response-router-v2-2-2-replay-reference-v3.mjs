import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { projectRequirementResponseV222, RESPONSE_ROUTER_V222_VERSION, RESPONSE_ROUTER_V222_IMPLEMENTATION_ID } from '../src/pipeline/requirement-response-router-v2-2-2.js';
import { projectRequirementResponseV221 } from '../src/pipeline/requirement-response-router-v2-2-1.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const ROUTER_PATH = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2-2.js');
const REF_ZIP = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip');
const REF_ENTRY = 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json';
const GPT_ZIP = [
  path.resolve(ROOT, '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip'),
  path.resolve(ROOT, '..', '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip')
].find(fs.existsSync);
const GPT_ENTRY = 'V43_GPT_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_ADJUDICATION.json';
const EXPECTED_REF_SHA = '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744';
const EXPECTED_GPT_SHA = '372eeb3f192a47dfa1fe633d1187f25641eabf8c6489b40680508f8d7b97baa5';
const COHORTS = { CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 };
const CRITICAL_P0_IDS = [
  'TB-003:REQ-215',
  'HOLDOUT-REQ-01-CAN-0203', 'HOLDOUT-REQ-01-CAN-0205', 'HOLDOUT-REQ-01-CAN-0206', 'HOLDOUT-REQ-01-CAN-0208',
  'HOLDOUT-REQ-02-CAN-0064', 'HOLDOUT-REQ-02-CAN-0068', 'HOLDOUT-REQ-02-CAN-0069', 'HOLDOUT-REQ-02-CAN-0070', 'HOLDOUT-REQ-02-CAN-0083',
  'HOLDOUT-REQ-V2-01-CAN-0460',
  'HOLDOUT-REQ-V2-02-CAN-0218', 'HOLDOUT-REQ-V2-02-CAN-0221', 'HOLDOUT-REQ-V2-02-CAN-0222'
];
const HIGH_SAFETY_IDS = [
  'TB-006:REQ-043',
  'HOLDOUT-REQ-01-CAN-0169', 'HOLDOUT-REQ-01-CAN-0225',
  'HOLDOUT-REQ-V2-02-CAN-0042', 'HOLDOUT-REQ-V2-02-CAN-0230'
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const countBy = (rows, fn) => rows.reduce((out, row) => { const key = String(fn(row)); out[key] = (out[key] || 0) + 1; return out; }, {});
const modeOf = row => row.v3_expected_router_mode || (row.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : row.v3_semantic_primary_mode);
const readZipJson = async (zipPath, entry) => {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const file = zip.file(entry);
  if (!file) throw new Error(`MISSING_ENTRY:${entry}`);
  const raw = await file.async('nodebuffer');
  return { raw, value: JSON.parse(raw.toString('utf8')) };
};
const expectedView = (row, adjudication) => ({
  primary_response_mode: adjudication?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? adjudication.gpt_recommended_primary_mode : modeOf(row),
  evidence_dependency: adjudication?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? adjudication.gpt_recommended_evidence_dependency : row.v3_evidence_dependency,
  risk_tier: row.v3_risk_tier ?? null,
  response_required: row.v3_response_required,
  human_required: row.v3_human_required,
  scoring_related: row.v3_scoring_related,
  secondary_dependencies: row.v3_secondary_dependencies || [],
  semantic_status: row.v3_semantic_status || null,
  reason: row.v3_reason || null
});
const dimensions = (router, expected) => {
  const mismatches = [];
  if (router.response_mode !== expected.primary_response_mode) mismatches.push('primary_response_mode');
  if (expected.risk_tier != null && router.risk_tier !== expected.risk_tier) mismatches.push('risk_tier');
  if (expected.response_required != null && router.response_required !== expected.response_required) mismatches.push('response_required');
  if (expected.evidence_dependency != null && router.evidence_dependency !== expected.evidence_dependency) mismatches.push('evidence_dependency');
  if (expected.human_required != null && router.human_required !== expected.human_required) mismatches.push('human_required');
  if (expected.scoring_related != null && router.is_scoring_related !== expected.scoring_related) mismatches.push('scoring_related');
  return mismatches;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  if (!GPT_ZIP) throw new Error('GPT_ADJUDICATION_BUNDLE_MISSING');
  const reference = await readZipJson(REF_ZIP, REF_ENTRY);
  const adjudication = await readZipJson(GPT_ZIP, GPT_ENTRY);
  if (sha(reference.raw) !== EXPECTED_REF_SHA) throw new Error('REFERENCE_V3_IDENTITY_MISMATCH');
  if (sha(adjudication.raw) !== EXPECTED_GPT_SHA) throw new Error('GPT_ADJUDICATION_IDENTITY_MISMATCH');
  const requirements = reference.value.requirements;
  const gptRows = adjudication.value.rows;
  if (requirements?.length !== 2178 || new Set(requirements.map(row => row.case_id)).size !== 2178) throw new Error('REFERENCE_ROW_IDENTITY_MISMATCH');
  if (gptRows?.length !== 76 || new Set(gptRows.map(row => row.case_id)).size !== 76) throw new Error('GPT_ROW_IDENTITY_MISMATCH');
  const gptByCase = new Map(gptRows.map(row => [row.case_id, row]));
  const rows = requirements.map(req => {
    const gpt = gptByCase.get(req.case_id);
    const expected = expectedView(req, gpt);
    const v221 = projectRequirementResponseV221(req);
    const v222 = projectRequirementResponseV222(req);
    return {
      case_id: req.case_id,
      cohort: req.cohort,
      tender_id: req.tender_id,
      requirement_id: req.requirement_id,
      requirement_text: req.requirement_text,
      category: req.category,
      requirement_category: req.requirement_category,
      expected_view: expected,
      gpt_adjudication: gpt ? { verdict: gpt.gpt_gate_verdict, primary_response_mode: gpt.gpt_recommended_primary_mode, evidence_dependency: gpt.gpt_recommended_evidence_dependency, hard_safety_gate: gpt.hard_safety_gate, reason: gpt.gpt_reason } : null,
      v221,
      v222,
      v221_correct: dimensions(v221, expected).length === 0,
      v222_correct: dimensions(v222, expected).length === 0,
      v221_to_v222: `${v221.response_mode}→${v222.response_mode}`,
      changed_dimensions: same(v221, v222) ? [] : ['router_projection']
    };
  });
  const byCase = new Map(rows.map(row => [row.case_id, row]));
  const trueRows = gptRows.filter(row => row.gpt_gate_verdict !== 'REFERENCE_V3_SEMANTIC_DEBT');
  const highRows = trueRows.filter(row => row.hard_safety_gate === 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE');
  const futureRows = trueRows.filter(row => row.hard_safety_gate === 'FUTURE_COMMITMENT_AS_EXISTING_FACT');
  const highBad = highRows.filter(row => byCase.get(row.case_id).v222.evidence_dependency !== true);
  const futureBad = futureRows.filter(row => byCase.get(row.case_id).v222.response_mode === 'EVIDENCE');
  const overlay = gptRows.filter(row => row.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT');
  const overlayRows = overlay.map(gpt => {
    const row = byCase.get(gpt.case_id);
    return { case_id: gpt.case_id, expected_mode: gpt.gpt_recommended_primary_mode, expected_evidence_dependency: gpt.gpt_recommended_evidence_dependency, actual_mode: row.v222.response_mode, actual_evidence_dependency: row.v222.evidence_dependency, mode_match: row.v222.response_mode === gpt.gpt_recommended_primary_mode, evidence_dependency_match: row.v222.evidence_dependency === gpt.gpt_recommended_evidence_dependency };
  });
  const correct = row => row.v222_correct;
  const modeAgreement = subset => subset.filter(row => row.v222.response_mode === row.expected_view.primary_response_mode).length;
  const riskMismatches = rows.filter(row => row.expected_view.risk_tier != null && row.v222.risk_tier !== row.expected_view.risk_tier).map(row => ({ case_id: row.case_id, requirement_id: row.requirement_id, expected: row.expected_view.risk_tier, actual: row.v222.risk_tier, higher_or_equal_risk: ['LOW', 'MEDIUM', 'HIGH', 'P0'].indexOf(row.v222.risk_tier) >= ['LOW', 'MEDIUM', 'HIGH', 'P0'].indexOf(row.expected_view.risk_tier), p0_or_invalidity_downgrade: row.expected_view.risk_tier === 'P0' && row.v222.risk_tier !== 'P0' }));
  const routerSha = sha(fs.readFileSync(ROUTER_PATH));
  const iteration = Number(process.env.V222_ITERATION || '1');
  const runId = `V43-RR-V2_2_2-V3-REPLAY-${sha(`${EXPECTED_REF_SHA}:${EXPECTED_GPT_SHA}:${routerSha}:${iteration}`).slice(0, 16)}`;
  const metrics = {
    overall_primary_mode_agreement: { matched: modeAgreement(rows), total: rows.length, rate: pct(modeAgreement(rows), rows.length) },
    per_cohort: Object.fromEntries(Object.keys(COHORTS).map(cohort => { const subset = rows.filter(row => row.cohort === cohort); return [cohort, { matched: modeAgreement(subset), total: subset.length, rate: pct(modeAgreement(subset), subset.length) }]; })),
    v221_correct_v222_wrong: rows.filter(row => row.v221_correct && !row.v222_correct).length,
    v221_wrong_v222_correct: rows.filter(row => !row.v221_correct && row.v222_correct).length,
    true_high_risk_evidence_false_negative: highBad.length,
    true_future_commitment_as_existing_fact: futureBad.length,
    p0_compliance_escape: rows.filter(row => row.expected_view.primary_response_mode === 'COMPLIANCE' && row.expected_view.risk_tier === 'P0' && !['COMPLIANCE', 'NEED_REVIEW'].includes(row.v222.response_mode)).length,
    overlay_primary_mode_mismatch: overlayRows.filter(row => !row.mode_match).length,
    overlay_evidence_dependency_mismatch: overlayRows.filter(row => !row.evidence_dependency_match).length,
    need_review_count: rows.filter(row => row.v222.response_mode === 'NEED_REVIEW').length,
    p0_human_gate_missing: rows.filter(row => row.expected_view.risk_tier === 'P0' && (!['P0'].includes(row.v222.risk_tier) || row.v222.human_required !== true)).length
  };
  const full = {
    artifact_type: 'V43_ROUTER_V2_2_2_FULL_REPLAY_REFERENCE_V3',
    router_identity: { version: RESPONSE_ROUTER_V222_VERSION, implementation_id: RESPONSE_ROUTER_V222_IMPLEMENTATION_ID, path: 'backend/src/pipeline/requirement-response-router-v2-2-2.js', sha256: routerSha },
    reference_v3_sha256: EXPECTED_REF_SHA,
    gpt_adjudication_sha256: EXPECTED_GPT_SHA,
    run_id: runId,
    generated_at: new Date().toISOString(),
    case_count: rows.length,
    cohorts: COHORTS,
    provider_calls: 0,
    llm_calls: 0,
    metrics,
    distributions: { mode: countBy(rows, row => row.v222.response_mode), risk: countBy(rows, row => row.v222.risk_tier), evidence_dependency: countBy(rows, row => row.v222.evidence_dependency) },
    rows
  };
  const delta = { artifact_type: 'V43_ROUTER_V2_2_2_SEMANTIC_DELTA', run_id: runId, reference_v3_sha256: EXPECTED_REF_SHA, rows: rows.map(row => ({ case_id: row.case_id, cohort: row.cohort, tender_id: row.tender_id, requirement_id: row.requirement_id, requirement_text: row.requirement_text, expected_view: row.expected_view, v221: row.v221, v222: row.v222, v221_correct: row.v221_correct, v222_correct: row.v222_correct, v221_to_v222: row.v221_to_v222, changed_dimensions: row.changed_dimensions })) };
  const needReview = { artifact_type: 'V43_ROUTER_V2_2_2_NEED_REVIEW_AUDIT', run_id: runId, case_count: rows.filter(row => row.v222.response_mode === 'NEED_REVIEW').length, rows: rows.filter(row => row.v222.response_mode === 'NEED_REVIEW').map(row => ({ case_id: row.case_id, requirement_id: row.requirement_id, semantic_adjudication: 'NOT_PERFORMED', source_status: row.expected_view.semantic_status })) };
  const risk = { artifact_type: 'V43_ROUTER_V2_2_2_RISK_TIER_AUDIT', run_id: runId, mismatch_count: riskMismatches.length, p0_or_invalidity_downgrade_count: riskMismatches.filter(row => row.p0_or_invalidity_downgrade).length, rows: riskMismatches };
  const overlayAudit = { artifact_type: 'V43_ROUTER_V2_2_2_PRIMARY_MODE_OVERLAY_RECERT', run_id: runId, reference_v3_sha256: EXPECTED_REF_SHA, row_count: overlayRows.length, mode_mismatch_count: overlayRows.filter(row => !row.mode_match).length, evidence_dependency_mismatch_count: overlayRows.filter(row => !row.evidence_dependency_match).length, rows: overlayRows };
  const safetyAudit = { artifact_type: 'V43_ROUTER_V2_2_2_RISK_OVERLAY_RECERT', run_id: runId, gpt_hard_safety_rows: trueRows.length, high_risk_rows: highRows.length, future_commitment_rows: futureRows.length, high_risk_false_negative_count: highBad.length, future_commitment_as_existing_fact_count: futureBad.length, p0_human_gate_missing: metrics.p0_human_gate_missing, rows: [...highBad, ...futureBad].map(row => ({ case_id: row.case_id, hard_safety_gate: row.hard_safety_gate, current_response_mode: byCase.get(row.case_id).v222.response_mode, current_evidence_dependency: byCase.get(row.case_id).v222.evidence_dependency })) };
  const criticalP0Missing = CRITICAL_P0_IDS.filter(requirementId => { const row = rows.find(candidate => candidate.requirement_id === requirementId); return !row || row.v222.risk_tier !== 'P0' || row.v222.human_required !== true; });
  const highSafetyMissing = HIGH_SAFETY_IDS.filter(requirementId => { const row = rows.find(candidate => candidate.requirement_id === requirementId); return !row || !['HIGH', 'P0'].includes(row.v222.risk_tier) || row.v222.human_required !== true; });
  metrics.critical_p0_gate_missing = criticalP0Missing.length;
  metrics.high_safety_gate_missing = highSafetyMissing.length;
  metrics.reference_p0_human_gate_missing = metrics.p0_human_gate_missing;
  const checkpoint = { checkpoint: 'V43_RESPONSE_ROUTER_V2_2_2_DAYTIME_CLOSURE', run_id: runId, router_version: RESPONSE_ROUTER_V222_VERSION, implementation_id: RESPONSE_ROUTER_V222_IMPLEMENTATION_ID, repair_iterations: iteration, full_replay_count: rows.length, safety_scope: { critical_p0_ids: CRITICAL_P0_IDS, high_safety_ids: HIGH_SAFETY_IDS, critical_p0_gate_missing: criticalP0Missing, high_safety_gate_missing: highSafetyMissing, reference_p0_human_gate_missing: metrics.p0_human_gate_missing }, metrics, side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, source_truth_mutations: 0, reference_v3_mutations: 0 }, status: metrics.v221_correct_v222_wrong === 0 && criticalP0Missing.length === 0 && highSafetyMissing.length === 0 ? 'DETERMINISTIC_SAFETY_GATES_PASS_PENDING_SEMANTIC_REVIEW' : 'RESIDUAL_SAFETY_REVIEW_REQUIRED' };
  fs.mkdirSync(path.join(DOCS, 'eval'), { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(DOCS, name), JSON.stringify(value, null, 2) + '\n');
  write('V43_ROUTER_V2_2_2_FULL_REPLAY_REFERENCE_V3.json', full);
  write('V43_ROUTER_V2_2_2_SEMANTIC_DELTA.json', delta);
  write('V43_ROUTER_V2_2_2_NEED_REVIEW_AUDIT.json', needReview);
  write('V43_ROUTER_V2_2_2_RISK_TIER_AUDIT.json', risk);
  write('V43_RESPONSE_ROUTER_V2_2_2_PRIMARY_MODE_OVERLAY_RECERT.json', overlayAudit);
  write('V43_RESPONSE_ROUTER_V2_2_2_RISK_GPT_OVERLAY_V1.json', safetyAudit);
  write('V43_RESPONSE_ROUTER_V2_2_2_ITERATION_1_CHECKPOINT.json', checkpoint);
  console.log(JSON.stringify({ run_id: runId, metrics, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, status: checkpoint.status }, null, 2));
}

try { await main(); } catch (error) { console.error(error?.stack || error); process.exitCode = 1; }
