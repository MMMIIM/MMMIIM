import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticSystemicBlocker, shouldRunFactPhase } from '../eval/rag-pilot/post-hash-fix/controlled-rerun.js';
import { safeFactProbeDiagnostics } from '../eval/rag-pilot/chengchuan-controlled-fact-extraction.mjs';

const gate = blocker => shouldRunFactPhase({ semanticBlocker: blocker, observedAttempts: 0, providerBudget: 90 });

test('H01: repeated schema failures stop before Fact', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'S1', error: { code: 'SCHEMA_INVALID' } },
    { case_id: 'S2', error: { code: 'SCHEMA_INVALID' } }
  ] });
  assert.equal(blocker.stop_before_fact, true);
  let factInvocations = 0;
  if (gate(blocker)) factInvocations += 1;
  assert.equal(factInvocations, 0);
});

test('repeated output schema failures are systemic and stop before Fact', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'OS1', error: { code: 'OUTPUT_SCHEMA_INVALID' } },
    { case_id: 'OS2', error: { code: 'OUTPUT_SCHEMA_INVALID' } }
  ] });
  assert.equal(blocker.stop_before_fact, true);
  assert.equal(gate(blocker), false);
});

test('H02: repeated assessment unavailability stops before Fact', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'A1', error: { code: 'ASSESSMENT_UNAVAILABLE' } },
    { case_id: 'A2', error: { code: 'ASSESSMENT_UNAVAILABLE' } }
  ] });
  assert.equal(blocker.stop_before_fact, true);
  let factInvocations = 0;
  if (gate(blocker)) factInvocations += 1;
  assert.equal(factInvocations, 0);
});

test('H03: ordinary semantic quality failure does not stop Fact', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'Q1', expected_label: 'EXPECTED_POSITIVE', actual_label: 'EXPECTED_LIMITED', error: null }
  ] });
  assert.equal(blocker.stop_before_fact, false);
  assert.equal(gate(blocker), true);
});

test('source hash failure is an immediate systemic stop', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'H', error: { code: 'EVIDENCE_SUPPORT_SOURCE_HASH_INVALID' } }
  ] });
  assert.equal(blocker.stop_before_fact, true);
});

test('support span provenance failure is an immediate systemic stop', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'SPAN', error: { code: 'SUPPORT_SPAN_INVALID' } }
  ] });
  assert.equal(blocker.stop_before_fact, true);
});

test('different deterministic failure classes do not stop on aggregate failure count alone', () => {
  const blocker = semanticSystemicBlocker({ rows: [
    { case_id: 'S', error: { code: 'SCHEMA_INVALID' } },
    { case_id: 'A', error: { code: 'ASSESSMENT_UNAVAILABLE' } }
  ] });
  assert.equal(blocker.stop_before_fact, false);
});

test('Fact probe telemetry keeps only contract shape metadata and never provider content', () => {
  const safe = safeFactProbeDiagnostics({
    gateway_http_status: 422,
    gateway_error_code: 'OUTPUT_SCHEMA_INVALID',
    provider_http_status: 200,
    provider_http_reached: true,
    response_format_type: 'json_schema',
    semantic_contract_version: '4.3-evidence-fact-extraction-v1',
    instruction_sha256: 'a'.repeat(64),
    schema_validation_errors: [{
      stage: 'FACT', path: 'data.facts[0].entities', keyword: 'type',
      expected: 'object', actual_type: 'string', additional_property: 'secret'
    }],
    structural_summary: {
      available: true,
      top_level_type: 'object',
      top_level_keys: ['facts'],
      facts_present: true,
      facts_type: 'array',
      facts_count: 1
    },
    model_content: '{"facts":[{"subject_name":"must not persist"}]}'
  });
  assert.equal(safe.response_format_type, 'json_schema');
  assert.equal(safe.provider_http_status, 200);
  assert.equal(safe.schema_validation_errors[0].path, 'data.facts[0].entities');
  assert.equal(safe.structural_summary.top_level_keys[0], 'facts');
  assert.equal(Object.hasOwn(safe, 'model_content'), false);
  assert.equal(JSON.stringify(safe).includes('must not persist'), false);
  assert.equal(JSON.stringify(safe).includes('secret'), true);
});
