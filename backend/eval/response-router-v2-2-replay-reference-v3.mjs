import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import {
  projectRequirementResponseV22,
  RESPONSE_ROUTER_V22_VERSION,
  RESPONSE_ROUTER_V22_IMPLEMENTATION_ID
} from '../src/pipeline/requirement-response-router-v2-2.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const REFERENCE_PACKAGE = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip');
const REFERENCE_ENTRY = 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json';
const GPT_BUNDLE_CANDIDATES = [
  path.resolve(ROOT, '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip'),
  path.resolve(ROOT, '..', '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip')
];
const GPT_ENTRY = 'V43_GPT_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_ADJUDICATION.json';
const ROUTER_FILE = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2.js');
const EXPECTED_REFERENCE_SHA = '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744';
const EXPECTED_GPT_SHA = '372eeb3f192a47dfa1fe633d1187f25641eabf8c6489b40680508f8d7b97baa5';
const COHORTS = Object.freeze({ CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 });
const MODES = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW']);
const RISKS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'P0']);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const countBy = (rows, selector) => rows.reduce((out, row) => {
  const key = String(selector(row) ?? 'null'); out[key] = (out[key] || 0) + 1; return out;
}, {});
const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
};
const hashJson = value => sha256(Buffer.from(stable(value), 'utf8'));

async function readZipJson(zipPath, entry) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const file = zip.file(entry);
  if (!file) throw new Error(`MISSING_ZIP_ENTRY:${entry}`);
  const raw = await file.async('nodebuffer');
  return { raw, value: JSON.parse(raw.toString('utf8')), zipPath, entry };
}

function gitInfo() {
  try {
    const status = execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' });
    return {
      branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      dirty: Boolean(status.trim()),
      status_entry_count: status.trim() ? status.trim().split(/\r?\n/).length : 0,
      status_sha256: sha256(status)
    };
  } catch {
    return { branch: null, head: null, dirty: null, status_entry_count: null, status_sha256: null };
  }
}

function v3Mode(row) {
  return row.v3_expected_router_mode ||
    (row.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : row.v3_semantic_primary_mode);
}

function confusion(rows, left, right, labels) {
  const out = Object.fromEntries(labels.map(label => [label, Object.fromEntries(labels.map(other => [other, 0]))]));
  for (const row of rows) {
    const a = String(left(row) ?? 'null'); const b = String(right(row) ?? 'null');
    if (!out[a]) out[a] = {}; out[a][b] = (out[a][b] || 0) + 1;
  }
  return out;
}

function perMode(rows, left, right) {
  return Object.fromEntries(MODES.map(mode => {
    const tp = rows.filter(row => left(row) === mode && right(row) === mode).length;
    const fp = rows.filter(row => left(row) === mode && right(row) !== mode).length;
    const fn = rows.filter(row => left(row) !== mode && right(row) === mode).length;
    return [mode, { true_positive: tp, false_positive: fp, false_negative: fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn) }];
  }));
}

function expectedFromReference(row) {
  return {
    primary_response_mode: v3Mode(row),
    risk_tier: row.v3_risk_tier,
    response_required: row.v3_response_required,
    evidence_dependency: row.v3_evidence_dependency,
    human_required: row.v3_human_required,
    scoring_related: row.v3_scoring_related,
    secondary_dependencies: row.v3_secondary_dependencies || [],
    semantic_status: row.v3_semantic_status || null,
    reason: row.v3_reason || null
  };
}

function expectedFromGpt(row) {
  return {
    primary_response_mode: row.gpt_recommended_primary_mode,
    evidence_dependency: row.gpt_recommended_evidence_dependency,
    risk_tier: row.reference_v3?.risk_tier ?? null,
    hard_safety_gate: row.hard_safety_gate,
    verdict: row.gpt_gate_verdict,
    reason: row.gpt_reason
  };
}

function buildRows(reference, adjudications) {
  const byCase = new Map(adjudications.rows.map(row => [row.case_id, row]));
  return reference.requirements.map(requirement => {
    const router = projectRequirementResponseV22(requirement, { projection_version: RESPONSE_ROUTER_V22_VERSION });
    const gpt = byCase.get(requirement.case_id) || null;
    const referenceExpected = expectedFromReference(requirement);
    const overlayExpected = gpt?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? expectedFromGpt(gpt) : null;
    const expected = overlayExpected || referenceExpected;
    const disagreementDimensions = [];
    if (router.response_mode !== expected.primary_response_mode) disagreementDimensions.push('primary_response_mode');
    if (router.risk_tier !== expected.risk_tier && expected.risk_tier !== null) disagreementDimensions.push('risk_tier');
    if (router.response_required !== expected.response_required && expected.response_required !== undefined) disagreementDimensions.push('response_required');
    if (router.evidence_dependency !== expected.evidence_dependency && expected.evidence_dependency !== undefined) disagreementDimensions.push('evidence_dependency');
    if (router.human_required !== expected.human_required && expected.human_required !== undefined) disagreementDimensions.push('human_required');
    if (router.is_scoring_related !== expected.scoring_related && expected.scoring_related !== undefined) disagreementDimensions.push('scoring_related');
    return {
      case_id: requirement.case_id,
      cohort: requirement.cohort,
      tender_id: requirement.tender_id,
      requirement_id: requirement.requirement_id,
      requirement_text: requirement.requirement_text,
      category: requirement.category,
      requirement_category: requirement.requirement_category,
      source_refs: requirement.source_refs,
      source_excerpt: requirement.source_excerpt,
      source_span: requirement.source_span,
      source_hash: requirement.source_hash,
      source_verified: requirement.source_verified,
      reference_v3: referenceExpected,
      gpt_adjudication: gpt ? expectedFromGpt(gpt) : null,
      gpt_overlay_applied: Boolean(overlayExpected),
      expected_view: expected,
      router,
      disagreement_dimensions: disagreementDimensions,
      disagrees: disagreementDimensions.length > 0
    };
  });
}

function safetyMetrics(rows, adjudications) {
  const coreRows = rows.filter(row => row.cohort === 'CORE6');
  const trueRows = adjudications.rows.filter(row => row.gpt_gate_verdict !== 'REFERENCE_V3_SEMANTIC_DEBT');
  const byCase = new Map(rows.map(row => [row.case_id, row]));
  const trueHighRisk = trueRows.filter(row => row.hard_safety_gate === 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE');
  const trueFuture = trueRows.filter(row => row.hard_safety_gate === 'FUTURE_COMMITMENT_AS_EXISTING_FACT');
  const highRiskFN = trueHighRisk.filter(row => byCase.get(row.case_id)?.router.evidence_dependency !== true);
  const futureAsEvidence = trueFuture.filter(row => byCase.get(row.case_id)?.router.response_mode === 'EVIDENCE');
  const p0Escapes = coreRows.filter(row => row.expected_view.primary_response_mode === 'COMPLIANCE' && row.expected_view.risk_tier === 'P0' && !['COMPLIANCE', 'NEED_REVIEW'].includes(row.router.response_mode));
  // Writer-direct leakage is an execution-layer property. The deterministic
  // Router projection never invokes Writer or emits a writer packet, so this
  // replay contributes zero by construction; execution-layer recertification
  // is reported separately.
  const complianceDirect = [];
  return {
    gpt_adjudicated: {
      adjudicated_case_count: adjudications.rows.length,
      true_router_defect_count: trueRows.length,
      reference_v3_semantic_debt_count: adjudications.rows.length - trueRows.length,
      true_high_risk_evidence_false_negative: { target: 0, actual: highRiskFN.length, case_ids: highRiskFN.map(row => row.case_id), pass: highRiskFN.length === 0 },
      true_future_commitment_as_existing_fact: { target: 0, actual: futureAsEvidence.length, case_ids: futureAsEvidence.map(row => row.case_id), pass: futureAsEvidence.length === 0 },
      p0_compliance_escape: { target: 0, actual: p0Escapes.length, case_ids: p0Escapes.map(row => row.case_id), pass: p0Escapes.length === 0 },
      compliance_to_normal_writer_direct: { target: 0, actual: complianceDirect.length, case_ids: [], pass: true, basis: 'no writer path invoked by deterministic router replay' },
      writer_lineage_violation: { target: 0, actual: 0, pass: true, basis: 'deterministic router replay emits no writer output' },
      enterprise_authority_lineage_violation: { target: 0, actual: 0, pass: true, basis: 'deterministic router replay emits no enterprise assertions' }
    },
    legacy_reference_v3_mechanical: {
      high_risk_evidence_false_negative: coreRows.filter(row => row.reference_v3.evidence_dependency === true && ['HIGH', 'P0'].includes(row.reference_v3.risk_tier) && row.router.evidence_dependency !== true).length,
      future_commitment_as_existing_fact: coreRows.filter(row => row.reference_v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'EVIDENCE').length,
      p0_compliance_escape: p0Escapes.length
    }
  };
}

async function main() {
  const reference = await readZipJson(REFERENCE_PACKAGE, REFERENCE_ENTRY);
  const referenceSha = sha256(reference.raw);
  if (referenceSha !== EXPECTED_REFERENCE_SHA) throw new Error('BLOCKED_REFERENCE_V3_IDENTITY_MISMATCH');
  if (reference.value.requirements?.length !== 2178 || new Set(reference.value.requirements.map(row => row.case_id)).size !== 2178) throw new Error('REFERENCE_V3_ROW_IDENTITY_MISMATCH');
  for (const [cohort, expected] of Object.entries(COHORTS)) if (reference.value.requirements.filter(row => row.cohort === cohort).length !== expected) throw new Error(`REFERENCE_V3_COHORT_MISMATCH:${cohort}`);
  for (const row of reference.value.requirements) if (!row.v3_expected_router_mode || row.v3_risk_tier === null || row.v3_response_required === null || row.v3_evidence_dependency === null || row.v3_human_required === null || row.v3_scoring_related === null) throw new Error(`REFERENCE_V3_LABEL_MISSING:${row.case_id}`);
  const GPT_BUNDLE = GPT_BUNDLE_CANDIDATES.find(file => fs.existsSync(file));
  if (!GPT_BUNDLE) throw new Error('GPT_ADJUDICATION_BUNDLE_MISSING');
  const gpt = await readZipJson(GPT_BUNDLE, GPT_ENTRY);
  const gptSha = sha256(gpt.raw);
  if (gptSha !== EXPECTED_GPT_SHA) throw new Error('GPT_ADJUDICATION_IDENTITY_MISMATCH');
  if (gpt.value.case_count !== 76 || !Array.isArray(gpt.value.rows) || gpt.value.rows.length !== 76 || new Set(gpt.value.rows.map(row => row.case_id)).size !== 76) throw new Error('GPT_ADJUDICATION_ROW_IDENTITY_MISMATCH');
  const rows = buildRows(reference.value, gpt.value);
  const overlayRows = gpt.value.rows.filter(row => row.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT').map(row => ({
    case_id: row.case_id,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    adjudication_authority: 'GPT',
    adjudication_artifact: 'V43_GPT_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_ADJUDICATION.json',
    adjudication_sha256: gptSha,
    reference_v3_semantic_debt: true,
    recommended_primary_response_mode: row.gpt_recommended_primary_mode,
    recommended_evidence_dependency: row.gpt_recommended_evidence_dependency,
    hard_safety_gate: row.hard_safety_gate,
    rationale: row.gpt_reason
  }));
  const metrics = safetyMetrics(rows, gpt.value);
  const routeMode = row => row.router.response_mode;
  const expectedMode = row => row.expected_view.primary_response_mode;
  const disagreements = rows.filter(row => row.disagrees);
  const routerNeedReview = rows.filter(row => row.router.response_mode === 'NEED_REVIEW');
  const modeAgreementCount = rows.filter(row => routeMode(row) === expectedMode(row)).length;
  const field = (key, actual, expected) => ({ count: rows.filter(row => actual(row) === expected(row)).length, rate: pct(rows.filter(row => actual(row) === expected(row)).length, rows.length), key });
  const gptByCase = new Map(gpt.value.rows.map(row => [row.case_id, row]));
  const unsafeRows = rows.filter(row => gptByCase.has(row.case_id)).map(row => ({
    case_id: row.case_id,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    requirement_text: row.requirement_text,
    hard_safety_gate: row.gpt_adjudication.hard_safety_gate,
    gpt_gate_verdict: row.gpt_adjudication.verdict,
    reference_v3: row.reference_v3,
    router_v2_2: {
      response_mode: row.router.response_mode,
      evidence_dependency: row.router.evidence_dependency,
      risk_tier: row.router.risk_tier,
      response_required: row.router.response_required,
      human_required: row.router.human_required,
      scoring_related: row.router.is_scoring_related,
      routing_reasons: row.router.routing_reasons
    },
    gpt_recommended_primary_mode: row.gpt_adjudication.primary_response_mode,
    gpt_recommended_evidence_dependency: row.gpt_adjudication.evidence_dependency,
    gpt_reason: row.gpt_adjudication.reason,
    semantic_root_cause: 'PENDING_GPT'
  }));
  const routerSha = sha256(fs.readFileSync(ROUTER_FILE));
  const runId = `V43-RR-V2_2-V3-REPLAY-${sha256(`${referenceSha}:${gptSha}:${routerSha}:${RESPONSE_ROUTER_V22_IMPLEMENTATION_ID}`).slice(0, 16)}`;
  const generatedAt = new Date().toISOString();
  const full = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FULL_CORPUS_EVAL',
    artifact_version: 'v2.2-v3-replay', run_id: runId, generated_at: generatedAt,
    deterministic: true, provider_calls: 0, llm_calls: 0,
    reference_v3: { locator: `${path.relative(ROOT, REFERENCE_PACKAGE)}#${REFERENCE_ENTRY}`, sha256: referenceSha, row_count: rows.length, cohort_counts: COHORTS },
    gpt_adjudication: { locator: `${path.relative(ROOT, GPT_BUNDLE)}#${GPT_ENTRY}`, sha256: gptSha, row_count: gpt.value.rows.length, overlay_row_count: overlayRows.length, true_router_defect_count: 56 },
    router_identity: { path: path.relative(ROOT, ROUTER_FILE), sha256: routerSha, projection_version: RESPONSE_ROUTER_V22_VERSION, implementation_id: RESPONSE_ROUTER_V22_IMPLEMENTATION_ID },
    case_count: rows.length,
    overall_primary_mode: { agreement_count: modeAgreementCount, agreement_rate: pct(modeAgreementCount, rows.length), per_mode_precision_recall: perMode(rows, routeMode, expectedMode), confusion_matrix: confusion(rows, routeMode, expectedMode, MODES) },
    distributions: { actual_mode: sorted(countBy(rows, routeMode)), expected_mode: sorted(countBy(rows, expectedMode)), actual_risk: sorted(countBy(rows, row => row.router.risk_tier)), actual_evidence_dependency: sorted(countBy(rows, row => row.router.evidence_dependency)), need_review: routerNeedReview.length },
    safety_metrics: metrics,
    field_agreements: {
      risk_tier: field('risk_tier', row => row.router.risk_tier, row => row.expected_view.risk_tier),
      response_required: field('response_required', row => row.router.response_required, row => row.expected_view.response_required),
      evidence_dependency: field('evidence_dependency', row => row.router.evidence_dependency, row => row.expected_view.evidence_dependency),
      human_required: field('human_required', row => row.router.human_required, row => row.expected_view.human_required),
      scoring_related: field('scoring_related', row => row.router.is_scoring_related, row => row.expected_view.scoring_related)
    },
    disagreements: { count: disagreements.length, case_ids: disagreements.map(row => row.case_id) },
    semantic_boundary: { overlay_version: 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1', overlay_rows: overlayRows.length, overlay_is_eval_only: true, semantic_root_cause_policy: 'PENDING_GPT' },
    side_effects: { PROVIDER_CALLS: 0, LLM_CALLS: 0, PRODUCTION_DB_WRITES: 0, GOLD_MUTATIONS: 0, SOURCE_TRUTH_MUTATIONS: 0, REQUIREMENT_MUTATIONS: 0, REFERENCE_V3_MUTATIONS: 0, ROUTER_MUTATIONS: 0, MAPPING: 0, CLAIM: 0, WRITER: 0, COMMIT: 0, PUSH: 0, MERGE: 0, DEPLOY: 0 }
  };
  const fullOut = { ...full, rows };
  const confusionOut = { artifact_type: 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_CONFUSION_MATRIX', run_id: runId, reference_v3_sha256: referenceSha, router_sha256: routerSha, case_count: rows.length, primary_response_mode: full.overall_primary_mode, risk_tier: { labels: RISKS, matrix_router_rows_expected_columns: confusion(rows, row => row.router.risk_tier, row => row.expected_view.risk_tier, RISKS) }, evidence_dependency: confusion(rows, row => row.router.evidence_dependency, row => row.expected_view.evidence_dependency, ['true', 'false']) };
  const failureOut = { artifact_type: 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FAILURE_FAMILIES', run_id: runId, reference_v3_sha256: referenceSha, router_sha256: routerSha, disagreement_count: disagreements.length, families: [{ id: 'GPT_ADJUDICATED_UNSAFE_ROWS', count: unsafeRows.length, case_ids: unsafeRows.map(row => row.case_id) }, { id: 'OVERLAY_SEMANTIC_DEBT_ROWS', count: overlayRows.length, case_ids: overlayRows.map(row => row.case_id) }] };
  const checkpoint = {
    checkpoint: 'V43_RESPONSE_ROUTER_V2_2_BOUNDED_SEMANTIC_CLOSURE', run_id: runId, generated_at: generatedAt,
    reference_v3_identity: { sha256: referenceSha, rows: rows.length, unique_case_ids: new Set(rows.map(row => row.case_id)).size, cohort_counts: COHORTS },
    gpt_adjudication_identity: { sha256: gptSha, rows: gpt.value.rows.length, unique_case_ids: new Set(gpt.value.rows.map(row => row.case_id)).size, true_router_defect_count: 56, overlay_rows: overlayRows.length },
    router_identity: { path: path.relative(ROOT, ROUTER_FILE), sha256: routerSha, projection_version: RESPONSE_ROUTER_V22_VERSION, implementation_id: RESPONSE_ROUTER_V22_IMPLEMENTATION_ID },
    metrics: { response_decision_coverage: { actual: rows.length, expected: rows.length, pass: rows.length === 2178 }, ...metrics, requirement_id_closure: { pass: new Set(rows.map(row => row.requirement_id)).size === rows.length } },
    execution_layer: { status: 'PENDING_RECERT', provider_calls: 0, db_writes: 0 },
    side_effects: full.side_effects,
    status: 'READY_FOR_GPT_RESPONSE_ROUTER_V2_2_FINAL_ADJUDICATION'
  };
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json'), `${JSON.stringify({ artifact_type: 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1', eval_only: true, reference_v3_sha256: referenceSha, gpt_source_sha256: gptSha, row_count: overlayRows.length, rows: overlayRows }, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FULL_CORPUS_EVAL.json'), `${JSON.stringify(fullOut, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_CONFUSION_MATRIX.json'), `${JSON.stringify(confusionOut, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FAILURE_FAMILIES.json'), `${JSON.stringify(failureOut, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_GPT_UNSAFE_76_REVIEW_ROWS.json'), `${JSON.stringify({ artifact_type: 'V43_RESPONSE_ROUTER_V2_2_GPT_UNSAFE_76_REVIEW_ROWS', run_id: runId, rows: unsafeRows }, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_CHECKPOINT.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_CHECKPOINT.md'), [
    '# V43 Response Router V2.2 bounded semantic closure', '', `- run_id: ${runId}`, `- Reference V3 SHA256: ${referenceSha}`, `- Reference rows: ${rows.length}`, `- GPT adjudicated unsafe rows: ${gpt.value.rows.length}`, `- GPT overlay rows: ${overlayRows.length}`, `- Router: ${RESPONSE_ROUTER_V22_IMPLEMENTATION_ID}`, '',
    `- GPT true high-risk evidence false negatives: ${metrics.gpt_adjudicated.true_high_risk_evidence_false_negative.actual} (target 0)`, `- GPT true future commitment as existing fact: ${metrics.gpt_adjudicated.true_future_commitment_as_existing_fact.actual} (target 0)`, `- P0 compliance escape: ${metrics.gpt_adjudicated.p0_compliance_escape.actual} (target 0)`, `- Compliance to normal writer direct: ${metrics.gpt_adjudicated.compliance_to_normal_writer_direct.actual} (target 0)`, `- NEED_REVIEW: ${routerNeedReview.length}`, '', '- Provider/LLM/DB/Gold/Reference/Requirement mutations: 0', '- Semantic root cause remains PENDING_GPT.', '', '- Legacy Reference V3 mechanical metrics are reported separately and are not semantic acceptance metrics.'
  ].join('\n') + '\n');
  console.log(JSON.stringify({ status: checkpoint.status, run_id: runId, cases: rows.length, overlay_rows: overlayRows.length, unsafe_rows: unsafeRows.length, gpt_true_high_risk_fn: metrics.gpt_adjudicated.true_high_risk_evidence_false_negative.actual, gpt_future_as_evidence: metrics.gpt_adjudicated.true_future_commitment_as_existing_fact.actual, p0_escape: metrics.gpt_adjudicated.p0_compliance_escape.actual, provider_calls: 0, llm_calls: 0 }, null, 2));
}

try { await main(); } catch (error) { console.error(error?.message || String(error)); process.exitCode = 1; }
