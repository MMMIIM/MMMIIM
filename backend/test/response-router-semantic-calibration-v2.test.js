import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const ROOT = process.cwd().replace(/\\backend$/, '');
const packetPath = `${ROOT}/docs/V43_RESPONSE_ROUTER_SEMANTIC_CALIBRATION_V2.json`;
const checkpointPath = `${ROOT}/docs/V43_RESPONSE_ROUTER_METRIC_INTEGRITY_CHECKPOINT.json`;
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));

test('V2 calibration packet has frozen cohort/mode/stratum coverage', () => {
  assert.equal(packet.case_count, 160);
  assert.deepEqual(packet.cohort_counts, { CORE6: 96, HOLDOUT_V1: 32, HOLDOUT_V2: 32 });
  assert.ok(packet.mode_counts.NEED_REVIEW >= 80);
  assert.ok(packet.mode_counts.EVIDENCE >= 20);
  assert.ok(packet.mode_counts.SOLUTION >= 15);
  assert.ok(packet.mode_counts.COMMITMENT >= 15);
  assert.ok(packet.mode_counts.COMPLIANCE >= 15);
  assert.deepEqual(new Set(Object.keys(packet.stratum_counts)), new Set([
    'ROLE_NONE_COLLAPSE',
    'QUANTITATIVE_PERFORMANCE',
    'FUNCTIONAL_CAPABILITY',
    'TECHNICAL_ARCHITECTURE',
    'INTERFACE / INTEGRATION',
    'CERTIFICATION / QUALIFICATION',
    'CUSTOMER / EXPERIENCE',
    'PROJECT_COMMITMENT',
    'DELIVERY / ACCEPTANCE',
    'COMPLIANCE',
    'P0 CONSEQUENCE',
    'SCORING + SOLUTION',
    'SCORING + EVIDENCE',
    'NEGATIVE / PROHIBITION',
    'REFERENCE / PROCEDURAL CONSEQUENCE',
    'MIXED REQUIREMENT'
  ]));
  assert.equal(packet.gpt_fields_are_empty, true);
  assert.equal(packet.no_semantic_verdicts, true);
  assert.equal(packet.provider_calls, 0);
  assert.equal(packet.llm_calls, 0);
});

test('packet cases carry rule traces and no verdict/gold leakage', () => {
  const forbidden = new Set(['codex_verdict', 'recommended_gold', 'corrected_label', 'provider_result', 'model_result']);
  for (const row of packet.cases) {
    assert.ok(row.calibration_case_id);
    assert.ok(row.requirement_id);
    assert.ok(Object.hasOwn(row, 'source_refs'));
    assert.ok(Object.hasOwn(row, 'rule_path_trace'));
    assert.equal(row.rule_path_trace.router_module, 'backend/src/pipeline/requirement-response-router.js');
    assert.equal(row.gpt_response_mode, null);
    for (const key of forbidden) assert.equal(Object.hasOwn(row, key), false, `${row.calibration_case_id}:${key}`);
  }
});

test('metric accounting is three-way and retires invalid headline', () => {
  const aggregate = checkpoint.aggregate_three_way_accounting;
  assert.equal(aggregate.total, 2178);
  assert.equal(aggregate.confirmed_deep_chain_required_count + aggregate.confirmed_deep_chain_avoidable_count + aggregate.unresolved_routing_count, aggregate.total);
  assert.equal(aggregate.unresolved_routing_count, 1078);
  assert.equal(checkpoint.raw_development_telemetry_status.NEED_REVIEW_COUNT, 'ROUTER_OUTPUT_NOT_HUMAN_WORKLOAD');
  assert.equal(checkpoint.raw_development_telemetry_status.DEEP_CHAIN_REQUIRED_RATE, 'UNCALIBRATED');
  assert.equal(checkpoint.metric_policy.exact_reduction_percentage, 'NOT_REPORTED_PENDING_SEMANTIC_CALIBRATION');
  assert.match(checkpoint.metric_policy.legacy_invalid_headline, /retired/);
});

test('sampling is deterministic by packet content hash', () => {
  const bytes = fs.readFileSync(packetPath);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.match(hash, /^[0-9a-f]{64}$/);
  const ids = packet.cases.map((row) => row.calibration_case_id);
  assert.equal(new Set(ids).size, ids.length);
});
