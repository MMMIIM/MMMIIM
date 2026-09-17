import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaimQualityCases,
  CLAIM_QUALITY_DATASET_CLASSIFICATION,
  CLAIM_QUALITY_DATASET_ID,
  CLAIM_QUALITY_SCHEMA_VERSION,
  validateClaimQualityCases
} from '../eval/evidence-gold/claim-quality-cases.js';
import {
  buildClaimEvalReport,
  runAuthorizationIntegrity,
  runClaimFastGate,
  runClaimDbGate
} from '../eval/claim-eval-v1/runner.js';

test('Claim Quality Gold is synthetic, unique, and contract-valid', () => {
  const cases = buildClaimQualityCases();
  const validation = validateClaimQualityCases(cases);
  assert.equal(validation.ok, true, validation.errors.join(','));
  assert.equal(validation.case_count, 24);
  assert.equal(new Set(cases.map(item => item.case_id)).size, 24);
  assert.ok(cases.every(item => item.dataset_classification === CLAIM_QUALITY_DATASET_CLASSIFICATION));
  assert.ok(cases.every(item => item.real_customer_data === false));
  assert.equal(CLAIM_QUALITY_SCHEMA_VERSION, '4.3-claim-quality-v1');
  assert.equal(CLAIM_QUALITY_DATASET_ID, 'claim-quality-gold-v1-2026-09-02');
});

test('Fast Gate calls the production Claim Gate and never Provider/DB', () => {
  const report = runClaimFastGate();
  assert.equal(report.status, 'PASS');
  assert.equal(report.gate, 'CLAIM_FAST_GATE');
  assert.equal(report.provider_calls, 0);
  assert.equal(report.embedding_calls, 0);
  assert.equal(report.retrieval_calls, 0);
  assert.equal(report.db_writes, 0);
  assert.equal(report.case_results.length, 24);
  assert.ok(report.case_results.every(row => row.first_failing_boundary === null));
  assert.deepEqual(report.checks, {
    critical_expected_behavior: true,
    safety_zero: true,
    authorization_integrity: true,
    provider_calls_zero: true,
    embedding_calls_zero: true,
    retrieval_calls_zero: true,
    db_writes_zero: true
  });
});

test('Claim Eval retains strong and narrow supported claims without authority escalation', () => {
  const report = buildClaimEvalReport();
  assert.equal(report.evaluator_identity, 'production-enterprise-claim-gate-v2');
  assert.equal(report.gates.CLAIM_FAST_GATE.status, 'PASS');
  assert.equal(report.gates.CLAIM_BID_QUALITY_BASELINE.status, 'MEASURED');
  assert.equal(report.gates.CLAIM_BID_QUALITY.status, 'MEASURED');
  assert.equal(report.cases_total, 84);
  assert.equal(report.quality_cases_total, 24);
  assert.equal(report.legacy_cases_total, 60);
  assert.equal(report.cases_scored, 24);
  assert.equal(report.bid_quality_metrics.supported_strong_claim_retention, 1);
  assert.equal(report.bid_quality_metrics.supported_narrow_claim_retention, 1);
  assert.equal(report.bid_quality_metrics.false_hard_reject_rate, 0);
  assert.equal(report.bid_quality_metrics.useful_evidence_utilization, 1);
  assert.equal(report.safety_metrics.false_allow, 0);
  assert.equal(report.safety_metrics.authority_escalation, 0);
  assert.equal(report.safety_metrics.writer_bypass, 0);
  assert.equal(report.execution.provider_calls, 0);
  assert.equal(report.execution.embedding_calls, 0);
  assert.equal(report.execution.retrieval_calls, 0);
  assert.equal(report.execution.db_writes, 0);
  assert.deepEqual(report.dataset.legacy_claim_slice, {
    schema_version: '4.3-evidence-claim-gold-v1',
    contract_valid: true,
    total: 60,
    approved: 6,
    pending: 54,
    rejected: 0,
    note: 'Legacy Gold remains a source authority; only the new quality slice is executed by this runner.'
  });
});

test('Critical boundary cases preserve expected decisions and reason codes', () => {
  const rows = runClaimFastGate().case_results;
  const byId = new Map(rows.map(row => [row.case_id, row]));
  for (const [id, decision, reason] of [
    ['CQ-COMMITMENT-ENTERPRISE', 'reject', 'QUANTITATIVE_UNSUPPORTED'],
    ['CQ-COMMITMENT-PROJECT', 'needs_review', null],
    ['CQ-STATUS-AWARD', 'reject', 'STATUS_OVERCLAIM'],
    ['CQ-SCOPE-BROAD', 'reject', 'EVIDENCE_SCOPE_EXCEEDED'],
    ['CQ-QUANTITY-OVERCLAIM', 'reject', 'QUANTITATIVE_UNSUPPORTED'],
    ['CQ-ENTITY-OVERCLAIM', 'reject', 'ENTITY_MISMATCH'],
    ['CQ-STALE-EXPIRED', 'reject', 'EVIDENCE_EXPIRED'],
    ['CQ-MISSING-LINEAGE', 'reject', 'SOURCE_LINEAGE_REQUIRED'],
    ['CQ-HISTORICAL-BID', 'reject', 'SOURCE_NOT_USABLE'],
    ['CQ-REFERENCE-ONLY', 'restrict', 'REFERENCE_ONLY'],
    ['CQ-COMPOSITE-STATUS-CONFLICT', 'needs_review', 'HUMAN_REVIEW_REQUIRED']
  ]) {
    const row = byId.get(id);
    assert.ok(row, id);
    assert.equal(row.actual_decision, decision, id);
    if (reason) assert.ok(row.actual_reason_codes.includes(reason), `${id}: ${row.actual_reason_codes.join(',')}`);
    assert.equal(row.passed, true, id);
  }
});

test('Authorization integrity is fail-closed for stale identity and reports DB gate separately', () => {
  const authorization = runAuthorizationIntegrity();
  assert.equal(authorization.status, 'PASS');
  assert.equal(authorization.metrics.current_allow_roundtrip, 1);
  assert.equal(authorization.metrics.stale_authorization_prevented, authorization.metrics.stale_cases);
  assert.equal(authorization.metrics.gate_decision_parity_errors, 0);
  assert.equal(authorization.metrics.writer_authorization_bypass, 0);
  assert.equal(authorization.checks.cross_project_mutation.status, 'NOT_EXECUTED');
  assert.equal(runClaimDbGate().status, 'NOT_EXECUTED');
});

test('Claim Eval result contains no prompt, source text, or secret fields', () => {
  const report = buildClaimEvalReport();
  const serialized = JSON.stringify(report);
  assert.equal(serialized.toLowerCase().includes('api_key'), false);
  assert.equal(serialized.toLowerCase().includes('bearer'), false);
  assert.equal(serialized.toLowerCase().includes('password'), false);
  assert.equal(serialized.toLowerCase().includes('source_text'), false);
  assert.equal(serialized.toLowerCase().includes('claim_text'), false);
  assert.equal(report.gates.CLAIM_DB_GATE.status, 'NOT_EXECUTED');
});
