import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { evaluateEnterpriseClaimV2 } from '../../src/pipeline/enterprise-claim-gate-v2.js';
import { createClaimAssertion, CLAIM_ASSERTION_CONTRACT_VERSION } from '../../src/pipeline/claim-assertion-contract-v1.js';
import { createClaimGateIdentity, CLAIM_GATE_INPUT_ADAPTER_VERSION } from '../../src/pipeline/claim-gate-input-adapter-v1.js';
import {
  authorizeProjectFact,
  createWriterSafeContext,
  isCurrentAllowClaim,
  WRITER_INPUT_AUTHORIZATION_VERSION
} from '../../src/pipeline/writer-input-authorization-v1.js';
import { CLAIM_GATE_V2_RULE_VERSION } from '../../src/pipeline/claim-gate-v2-contract.js';
import {
  buildClaimQualityCases,
  claimQualityIdentity,
  validateClaimQualityCases
} from '../evidence-gold/claim-quality-cases.js';
import { buildGoldDatasets, validateGoldDatasets } from '../evidence-gold/contract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
export const DEFAULT_RESULT_DIR = path.join(here, 'results');
export const CLAIM_EVAL_SCHEMA_VERSION = '4.3-claim-eval-v1';
export const CLAIM_EVAL_MODES = Object.freeze(['fast', 'db', 'release']);

const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
const unique = values => [...new Set(values.filter(Boolean))];
const sha = value => createHash('sha256').update(String(value)).digest('hex');

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return null;
  }
}

export function readGitIdentity() {
  return {
    branch: gitValue(['branch', '--show-current']),
    head: gitValue(['rev-parse', 'HEAD']),
    dirty: Boolean(gitValue(['status', '--porcelain']))
  };
}

function expectedReasonsPresent(expected, actual) {
  return (expected?.reason_codes || []).every(code => actual?.reason_codes?.includes(code));
}

function firstFailingBoundary(expected, actual) {
  if (!actual || actual.error) return 'CLAIM_GATE_EXECUTION';
  if (actual.decision !== expected.decision) {
    if (expected.decision === 'allow' && actual.decision === 'reject') return 'FALSE_HARD_REJECT';
    if (expected.decision !== 'allow' && actual.decision === 'allow') return 'AUTHORITY_ESCALATION';
    return 'DECISION_PROJECTION';
  }
  if (actual.writer_eligible !== expected.writer_eligible) return 'WRITER_AUTHORIZATION_BYPASS';
  if (!expectedReasonsPresent(expected, actual)) return 'REASON_CODE_BOUNDARY';
  return null;
}

function classifyFailure(item, actual, firstFailure) {
  if (!firstFailure) return [];
  const tags = [];
  if (firstFailure === 'AUTHORITY_ESCALATION') tags.push('AUTHORITY_ESCALATION', 'FALSE_ALLOW');
  if (firstFailure === 'FALSE_HARD_REJECT') tags.push('FALSE_HARD_REJECT', 'NARROW_CLAIM_SUPPRESSION');
  if (firstFailure === 'WRITER_AUTHORIZATION_BYPASS') tags.push('WRITER_AUTHORIZATION_BYPASS');
  const classes = {
    status_overclaim: 'STATUS_OVERCLAIM',
    scope_overclaim: 'SCOPE_OVERCLAIM',
    quantity_overclaim: 'QUANTITY_OVERCLAIM',
    entity_overclaim: 'ENTITY_OVERCLAIM',
    stale_currentness: 'VALIDITY_OVERCLAIM',
    lineage_integrity: 'AUTHORITY_ESCALATION',
    authorization_boundary: 'AUTHORITY_ESCALATION',
    reference_authority: 'REFERENCE_ONLY_MISUSE'
  };
  if (classes[item.quality_class]) tags.push(classes[item.quality_class]);
  return unique(tags);
}

function scoreRows(rows, cases) {
  const totals = {
    strong: cases.filter(item => item.quality_class === 'supported_strong').length,
    narrow: cases.filter(item => item.quality_class === 'supported_narrow').length,
    useful: cases.filter(item => item.expected.useful_evidence === true).length,
    falseHardRejectDenominator: cases.filter(item => ['allow', 'restrict'].includes(item.expected.decision)).length,
    critical: cases.filter(item => item.expected.critical === true).length
  };
  const byId = new Map(rows.map(row => [row.case_id, row]));
  const strongRetained = cases.filter(item => item.quality_class === 'supported_strong' && byId.get(item.case_id)?.actual_decision === 'allow').length;
  const narrowRetained = cases.filter(item => item.quality_class === 'supported_narrow' && ['restrict', 'needs_review'].includes(byId.get(item.case_id)?.actual_decision)).length;
  const usefulRetained = cases.filter(item => item.expected.useful_evidence === true && ['allow', 'restrict', 'needs_review'].includes(byId.get(item.case_id)?.actual_decision)).length;
  const falseHardReject = cases.filter(item => ['allow', 'restrict'].includes(item.expected.decision) && byId.get(item.case_id)?.actual_decision === 'reject').length;
  const criticalPassed = cases.filter(item => item.expected.critical === true && byId.get(item.case_id)?.passed).length;
  return {
    supported_strong_claim_retention: ratio(strongRetained, totals.strong),
    supported_strong_claims: { retained: strongRetained, total: totals.strong },
    supported_narrow_claim_retention: ratio(narrowRetained, totals.narrow),
    supported_narrow_claims: { retained: narrowRetained, total: totals.narrow },
    false_hard_reject_rate: ratio(falseHardReject, totals.falseHardRejectDenominator),
    false_hard_reject: { count: falseHardReject, total: totals.falseHardRejectDenominator },
    useful_evidence_utilization: ratio(usefulRetained, totals.useful),
    useful_evidence: { utilized: usefulRetained, total: totals.useful },
    critical_expected_behavior_pass_rate: ratio(criticalPassed, totals.critical),
    critical_cases: { passed: criticalPassed, total: totals.critical }
  };
}

function scoreSafety(rows) {
  const countTag = tag => rows.filter(row => row.failure_tags.includes(tag)).length;
  const critical = rows.filter(row => row.critical);
  return {
    false_allow: countTag('FALSE_ALLOW'),
    unauthorized_strong_claim: rows.filter(row => row.expected_decision !== 'allow' && row.actual_decision === 'allow').length,
    authority_escalation: countTag('AUTHORITY_ESCALATION'),
    critical_overclaim: rows.filter(row => row.expected_decision === 'reject' && row.actual_decision !== 'reject').length,
    status_overclaim: countTag('STATUS_OVERCLAIM'),
    scope_overclaim: countTag('SCOPE_OVERCLAIM'),
    entity_overclaim: countTag('ENTITY_OVERCLAIM'),
    quantity_overclaim: countTag('QUANTITY_OVERCLAIM'),
    validity_overclaim: countTag('VALIDITY_OVERCLAIM'),
    reference_only_strong_claim: countTag('REFERENCE_ONLY_MISUSE'),
    writer_bypass: countTag('WRITER_AUTHORIZATION_BYPASS'),
    critical_case_failures: critical.filter(row => !row.passed).length
  };
}

export function runAuthorizationIntegrity({ strongCase = buildClaimQualityCases().find(item => item.case_id === 'CQ-STRONG-SSO') } = {}) {
  const projectId = strongCase.binding.project_id;
  const rawClaim = {
    ...strongCase.claim,
    assertions: [],
    referenced_fact_ids: [strongCase.binding.evidence_id],
    referenced_mapping_ids: [strongCase.binding.mapping_id]
  };
  const claim = createClaimAssertion(rawClaim);
  const evaluation = evaluateEnterpriseClaimV2({ projectId, claim: strongCase.claim, binding: strongCase.binding });
  const identity = createClaimGateIdentity({ projectId, requirement: strongCase.requirement, claim, binding: strongCase.binding });
  const gate = { ...evaluation, ...identity, claim_id: claim.claim_id, current: true };
  const projectFact = {
    project_fact_id: 'PFACT-CLAIM-EVAL-SSO', project_id: projectId, version: 1, key: 'sso_capability',
    fact_role: 'enterprise_fact', value_type: 'string', value: 'SSO', value_status: 'known',
    review_status: 'approved', conflict_status: 'none', payload_hash: strongCase.binding.source_hash,
    provenance_refs: [{ source_type: 'evidence_fact', source_id: strongCase.binding.evidence_id }]
  };
  const currentAllow = isCurrentAllowClaim(claim, gate);
  const currentAuthorization = authorizeProjectFact(projectFact, { claims: [claim], gateResults: [gate] });
  const currentContext = createWriterSafeContext({
    projectId, chapterId: 'chapter-claim-eval', facts: [projectFact],
    bindings: [{ project_fact_id: projectFact.project_fact_id, target_type: 'chapter', target_id: 'chapter-claim-eval', binding_role: 'required', binding_status: 'active' }],
    claims: [claim], gateResults: [gate]
  });
  const staleVariants = [
    { name: 'claim_assertion_hash', gate: { ...gate, claim_assertion_hash: sha('changed-claim') } },
    { name: 'gate_result_id', gate: { ...gate, gate_result_id: null } },
    { name: 'input_snapshot_hash', gate: { ...gate, input_snapshot_hash: null } },
    { name: 'lineage_current', gate: { ...gate, lineage_current: false } }
  ];
  const staleResults = staleVariants.map(variant => ({
    identity: variant.name,
    writer_usable: isCurrentAllowClaim(claim, variant.gate),
    authorization_mode: authorizeProjectFact(projectFact, { claims: [claim], gateResults: [variant.gate] }).authorization_mode
  }));
  const parityErrors = gate.decision !== evaluation.decision || gate.legacy_decision_projection !== evaluation.legacy_decision_projection ? 1 : 0;
  return {
    status: currentAllow && currentAuthorization.authorization_mode === 'assertable' && currentContext.assertable_claims.length === 1
      && staleResults.every(item => item.writer_usable === false && item.authorization_mode === 'claim_required') && parityErrors === 0 ? 'PASS' : 'FAIL',
    metrics: {
      current_allow_roundtrip: currentAllow ? 1 : 0,
      stale_authorization_prevented: staleResults.filter(item => !item.writer_usable).length,
      stale_cases: staleResults.length,
      gate_decision_parity_errors: parityErrors,
      writer_authorization_bypass: currentContext.blocked_items.length ? 1 : 0,
      cross_project_mutation: 0
    },
    checks: {
      current_allow_roundtrip: currentAllow,
      current_writer_assertable: currentAuthorization.authorization_mode === 'assertable',
      writer_context_contains_only_assertable_claim: currentContext.assertable_claims.length === 1 && currentContext.blocked_items.length === 0,
      stale_authorization_fail_closed: staleResults.every(item => item.writer_usable === false && item.authorization_mode === 'claim_required'),
      gate_decision_parity: parityErrors === 0,
      cross_project_mutation: { status: 'NOT_EXECUTED', count: 0 }
    },
    stale_results: staleResults,
    provider_calls: 0,
    embedding_calls: 0,
    retrieval_calls: 0,
    db_writes: 0,
    contract_versions: {
      claim_assertion: CLAIM_ASSERTION_CONTRACT_VERSION,
      claim_gate: CLAIM_GATE_V2_RULE_VERSION,
      claim_gate_input_adapter: CLAIM_GATE_INPUT_ADAPTER_VERSION,
      writer_authorization: WRITER_INPUT_AUTHORIZATION_VERSION
    }
  };
}

export function runClaimFastGate({ cases = buildClaimQualityCases(), now = () => new Date().toISOString() } = {}) {
  const validation = validateClaimQualityCases(cases);
  if (!validation.ok) {
    return {
      status: 'FAIL', gate: 'CLAIM_FAST_GATE', validation, provider_calls: 0, embedding_calls: 0, retrieval_calls: 0, db_writes: 0
    };
  }
  const started = performance.now();
  const rows = cases.map(item => {
    let actual = null;
    let error = null;
    try {
      actual = evaluateEnterpriseClaimV2({ projectId: item.binding.project_id, claim: item.claim, binding: item.binding });
    } catch (caught) {
      error = { code: caught.code || 'CLAIM_GATE_EVAL_ERROR', message: 'Claim Gate evaluation failed.' };
    }
    const expected = item.expected;
    const firstFailure = firstFailingBoundary(expected, actual ? { ...actual, error } : { error });
    const passed = !firstFailure;
    return {
      case_id: item.case_id,
      quality_class: item.quality_class,
      critical: expected.critical === true,
      expected_decision: expected.decision,
      actual_decision: actual?.decision || null,
      expected_writer_eligible: expected.writer_eligible,
      actual_writer_eligible: actual?.writer_eligible ?? false,
      expected_reason_codes: expected.reason_codes,
      actual_reason_codes: actual?.reason_codes || [],
      passed,
      first_failing_boundary: firstFailure,
      failure_tags: classifyFailure(item, actual, firstFailure),
      error_code: error?.code || null
    };
  });
  const authorization = runAuthorizationIntegrity({ strongCase: cases.find(item => item.case_id === 'CQ-STRONG-SSO') });
  const safety = scoreSafety(rows);
  const quality = scoreRows(rows, cases);
  const criticalPass = rows.filter(row => row.critical).every(row => row.passed);
  const status = criticalPass && Object.values(safety).every(value => value === 0) && authorization.status === 'PASS' ? 'PASS' : 'FAIL';
  return {
    status,
    gate: 'CLAIM_FAST_GATE',
    generated_at: now(),
    validation,
    elapsed_ms: Math.round(performance.now() - started),
    metrics: { safety, bid_quality: quality, authorization_integrity: authorization.metrics },
    checks: {
      critical_expected_behavior: criticalPass,
      safety_zero: Object.values(safety).every(value => value === 0),
      authorization_integrity: authorization.status === 'PASS',
      provider_calls_zero: true,
      embedding_calls_zero: true,
      retrieval_calls_zero: true,
      db_writes_zero: true
    },
    case_results: rows,
    failures_by_category: Object.fromEntries(unique(rows.flatMap(row => row.failure_tags)).map(tag => [tag, rows.filter(row => row.failure_tags.includes(tag)).length])),
    authorization_integrity: authorization,
    provider_calls: 0,
    embedding_calls: 0,
    retrieval_calls: 0,
    db_writes: 0,
    production_dependency_direction: 'eval->production'
  };
}

export function runClaimDbGate() {
  return {
    status: 'NOT_EXECUTED',
    gate: 'CLAIM_DB_GATE',
    reason: 'DB Gate requires an explicit PostgreSQL fixture run; Fast Gate never writes production truth.',
    provider_calls: 0,
    embedding_calls: 0,
    retrieval_calls: 0,
    db_writes: 0
  };
}

function assertNoSecrets(value) {
  const sensitive = /^(api[_-]?key|authorization|bearer|secret|password|token)$/i;
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (sensitive.test(key)) throw new Error(`CLAIM_EVAL_ARTIFACT_SECRET_FIELD:${key}`);
      visit(child);
    }
  };
  visit(value);
}

export function buildClaimEvalReport({ mode = 'fast', cases = buildClaimQualityCases(), now = () => new Date().toISOString() } = {}) {
  if (!CLAIM_EVAL_MODES.includes(mode)) throw new Error(`CLAIM_EVAL_MODE_INVALID:${mode}`);
  const qualityIdentity = claimQualityIdentity(cases);
  const legacyGold = buildGoldDatasets();
  const legacyValidation = validateGoldDatasets(legacyGold);
  const legacyClaims = legacyGold.claims || [];
  const legacyClaimSlice = {
    schema_version: legacyGold.schema_version,
    contract_valid: legacyValidation.ok,
    total: legacyClaims.length,
    approved: legacyClaims.filter(item => item.review_status === 'approved').length,
    pending: legacyClaims.filter(item => item.review_status === 'pending').length,
    rejected: legacyClaims.filter(item => item.review_status === 'rejected').length,
    note: 'Legacy Gold remains a source authority; only the new quality slice is executed by this runner.'
  };
  const fast = runClaimFastGate({ cases, now });
  const db = runClaimDbGate();
  const bidQuality = fast.metrics?.bid_quality || {};
  const report = {
    schema_version: CLAIM_EVAL_SCHEMA_VERSION,
    dataset: { ...qualityIdentity, legacy_claim_slice: legacyClaimSlice },
    mode,
    generated_at: now(),
    git: readGitIdentity(),
    evaluator_identity: 'production-enterprise-claim-gate-v2',
    claim_contract: CLAIM_ASSERTION_CONTRACT_VERSION,
    gate_rule_version: CLAIM_GATE_V2_RULE_VERSION,
    mapping_contract: 'requirement-evidence-mapping-v1.1',
    cases_total: cases.length + legacyClaims.length,
    quality_cases_total: cases.length,
    legacy_cases_total: legacyClaims.length,
    cases_scored: fast.case_results?.length || 0,
    gates: {
      CLAIM_FAST_GATE: { status: fast.status, checks: fast.checks, metrics: fast.metrics },
      CLAIM_DB_GATE: db,
      CLAIM_BID_QUALITY_BASELINE: { status: fast.status === 'PASS' ? 'MEASURED' : 'NOT_MEASURED', metrics: bidQuality },
      CLAIM_RELEASE_GATE: { status: fast.status === 'PASS' && db.status === 'PASS' ? 'PASS' : 'NOT_READY' }
    },
    safety_metrics: fast.metrics?.safety || {},
    bid_quality_metrics: bidQuality,
    authorization_metrics: fast.metrics?.authorization_integrity || {},
    case_results: fast.case_results || [],
    failures_by_category: fast.failures_by_category || {},
    execution: {
      provider_calls: 0,
      embedding_calls: 0,
      retrieval_calls: 0,
      db_writes: 0,
      retries: 0,
      fallback: 0,
      elapsed_ms: fast.elapsed_ms || 0
    },
    result_policy: 'No production Truth is created or mutated by Claim Eval.'
  };
  // Keep the previous descriptive key as a read-only compatibility alias;
  // CLAIM_BID_QUALITY_BASELINE is the canonical report field.
  report.gates.CLAIM_BID_QUALITY = report.gates.CLAIM_BID_QUALITY_BASELINE;
  assertNoSecrets(report);
  return report;
}

/**
 * Build a DB-backed report only when the caller explicitly selects db/release.
 * The synchronous builder remains provider-free and intentionally reports the
 * DB gate as NOT_EXECUTED for unit/eval-only callers.
 */
export async function buildClaimEvalReportAsync({ mode = 'db', globalRegressionStatus = 'NOT_EXECUTED', ...options } = {}) {
  if (!['db', 'release'].includes(mode)) return buildClaimEvalReport({ mode, ...options });
  if (!['PASS', 'FAIL', 'NOT_EXECUTED'].includes(globalRegressionStatus)) {
    throw new Error(`CLAIM_GLOBAL_REGRESSION_STATUS_INVALID:${globalRegressionStatus}`);
  }
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(repoRoot, 'backend', '.env'), quiet: true });
  const report = buildClaimEvalReport({ mode, ...options });
  const { runClaimDbGate: executeDbGate } = await import('./db-gate.js');
  const db = await executeDbGate();
  report.gates.CLAIM_DB_GATE = db;
  report.gates.CLAIM_RELEASE_GATE = {
    status: report.gates.CLAIM_FAST_GATE.status === 'PASS'
      && db.status === 'PASS'
      && report.gates.CLAIM_BID_QUALITY_BASELINE.status === 'MEASURED'
      && globalRegressionStatus === 'PASS' ? 'PASS' : 'NOT_READY',
    global_regression: globalRegressionStatus
  };
  report.execution.db_writes = db.production_db_writes ?? 0;
  report.execution.fixture_db_writes = db.fixture_db_writes || 'ephemeral_synthetic_fixture_only';
  report.authorization_metrics = {
    ...report.authorization_metrics,
    ...(db.metrics || {})
  };
  assertNoSecrets(report);
  return report;
}

export function writeClaimEvalArtifact(report, {
  fsImpl = fs,
  resultDir = DEFAULT_RESULT_DIR
} = {}) {
  assertNoSecrets(report);
  fsImpl.mkdirSync(resultDir, { recursive: true });
  const runId = `claim-eval-v1-${Date.now()}`;
  const jsonPath = path.join(resultDir, `${runId}.json`);
  const markdownPath = path.join(resultDir, `${runId}.md`);
  fsImpl.writeFileSync(jsonPath, `${JSON.stringify({ run_id: runId, ...report }, null, 2)}\n`, 'utf8');
  const markdown = [
    '# Claim Eval V1', '',
    `- Dataset: ${report.dataset.dataset_id} (${report.dataset.dataset_sha})`,
    `- Quality cases scored: ${report.cases_scored}/${report.quality_cases_total} (legacy Claim Gold retained: ${report.legacy_cases_total})`,
    `- Fast Gate: ${report.gates.CLAIM_FAST_GATE.status}`,
    `- DB Gate: ${report.gates.CLAIM_DB_GATE.status}`,
    `- Bid Quality: ${report.gates.CLAIM_BID_QUALITY.status}`,
    `- Provider / Embedding / Retrieval calls: ${report.execution.provider_calls} / ${report.execution.embedding_calls} / ${report.execution.retrieval_calls}`,
    '',
    '| Metric | Value |', '| --- | --- |',
    `| Supported strong retention | ${report.bid_quality_metrics.supported_strong_claim_retention ?? 'N/A'} |`,
    `| Supported narrow retention | ${report.bid_quality_metrics.supported_narrow_claim_retention ?? 'N/A'} |`,
    `| False hard reject rate | ${report.bid_quality_metrics.false_hard_reject_rate ?? 'N/A'} |`,
    `| Useful evidence utilization | ${report.bid_quality_metrics.useful_evidence_utilization ?? 'N/A'} |`,
    '', 'Case failures are reported by case ID and boundary only; claim text and source material are intentionally omitted.'
  ].join('\n');
  fsImpl.writeFileSync(markdownPath, `${markdown}\n`, 'utf8');
  return { run_id: runId, jsonPath, markdownPath };
}

export function parseMode(argv = []) {
  const index = argv.indexOf('--mode');
  const mode = index >= 0 ? argv[index + 1] : 'fast';
  if (!CLAIM_EVAL_MODES.includes(mode)) throw new Error(`CLAIM_EVAL_MODE_INVALID:${mode}`);
  return { mode };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
   try {
    const options = parseMode(process.argv.slice(2));
    const report = await buildClaimEvalReportAsync(options);
    const result = writeClaimEvalArtifact(report);
    const overallStatus = report.mode === 'fast'
      ? report.gates.CLAIM_FAST_GATE.status
      : report.mode === 'db'
        ? report.gates.CLAIM_DB_GATE.status
        : report.gates.CLAIM_RELEASE_GATE.status;
    console.log(JSON.stringify({
      status: overallStatus,
      mode: report.mode,
      dataset_id: report.dataset.dataset_id,
      cases: report.cases_scored,
      fast_gate: report.gates.CLAIM_FAST_GATE.status,
      db_gate: report.gates.CLAIM_DB_GATE.status,
      bid_quality: report.gates.CLAIM_BID_QUALITY.status,
      release_gate: report.gates.CLAIM_RELEASE_GATE.status,
      provider_calls: report.execution.provider_calls,
      result_paths: { json: result.jsonPath, markdown: result.markdownPath }
    }));
    if (report.gates.CLAIM_FAST_GATE.status !== 'PASS'
      || (report.mode !== 'fast' && report.gates.CLAIM_DB_GATE.status !== 'PASS')
      || (report.mode === 'release' && report.gates.CLAIM_RELEASE_GATE.status !== 'PASS')) process.exitCode = 1;
   } catch (error) {
    console.error(JSON.stringify({ ok: false, error: { code: 'CLAIM_EVAL_FAILED', message: String(error.message || 'Claim Eval failed.') } }));
    process.exitCode = 1;
   }
  })();
}
