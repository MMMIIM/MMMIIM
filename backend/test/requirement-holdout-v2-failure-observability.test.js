import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHoldoutExecutionIdentity,
  classifyHoldoutFirstFailure,
  summarizeHoldoutExecutionAccounting
} from '../eval/requirement-unseen-holdout-v2/failure-observability.mjs';
import { runTender } from '../eval/requirement-extraction-real-tender-pilot-v1/run-live-eval.js';

test('holdout observability gives HTTP failure a single provider-first classification', () => {
  const failure = classifyHoldoutFirstFailure({
    errorCode: 'PROVIDER_HTTP_FAILURE',
    diagnostic: { provider_http_reached: true, provider_http_status: 502, json_parse_success: null },
    schemaPass: false,
    ok: false
  });
  assert.deepEqual(failure, {
    family: 'B_PROVIDER_HTTP_FAILURE',
    first_failure_stage: 'PROVIDER_HTTP',
    first_failure_code: 'PROVIDER_HTTP_FAILURE'
  });
});

test('holdout observability separates malformed JSON from schema failure', () => {
  const malformed = classifyHoldoutFirstFailure({
    errorCode: 'GATEWAY_INVALID_JSON',
    diagnostic: { provider_http_reached: true, provider_http_status: 200, json_parse_success: false },
    schemaPass: false,
    ok: false
  });
  const schema = classifyHoldoutFirstFailure({
    errorCode: 'GATEWAY_REQUIREMENTS_INVALID',
    diagnostic: { provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_validation_errors: [{ path: 'data.requirements[0].text' }] },
    schemaPass: false,
    ok: false
  });
  assert.equal(malformed.family, 'D_JSON_PARSE_FAILURE');
  assert.equal(schema.family, 'E_SCHEMA_VALIDATION_FAILURE');
  assert.notEqual(malformed.family, schema.family);
});

test('holdout execution identity is deterministic and request-bound', () => {
  const first = buildHoldoutExecutionIdentity({ tenderId: 'T-01', chunkNumber: 3, sourceChunkId: 'T-01-C003', requestHash: 'abc' });
  const second = buildHoldoutExecutionIdentity({ tenderId: 'T-01', chunkNumber: 3, sourceChunkId: 'T-01-C003', requestHash: 'abc' });
  const changed = buildHoldoutExecutionIdentity({ tenderId: 'T-01', chunkNumber: 4, sourceChunkId: 'T-01-C004', requestHash: 'abc' });
  assert.deepEqual(first, second);
  assert.notEqual(first.execution_id, changed.execution_id);
  assert.equal(first.request_hash, 'abc');
});

test('holdout accounting distinguishes zero-candidate success from candidate-producing success', () => {
  const entries = [
    { execution_id: 'e1', ok: true, candidate_count: 0 },
    { execution_id: 'e2', ok: true, candidate_count: 2 },
    { execution_id: 'e3', ok: false, candidate_count: 0, failure_family: 'E_SCHEMA_VALIDATION_FAILURE' },
    { execution_id: 'e4', ok: false, candidate_count: 0, failure_family: 'B_PROVIDER_HTTP_FAILURE' }
  ];
  const summary = summarizeHoldoutExecutionAccounting(entries, { plannedExecutionCount: 4, retryCount: 0 });
  assert.equal(summary.attempted_execution_count, 4);
  assert.equal(summary.successful_execution_count, 2);
  assert.equal(summary.failed_execution_count, 2);
  assert.equal(summary.zero_candidate_success_count, 1);
  assert.equal(summary.candidate_producing_success_count, 1);
  assert.equal(summary.unique_failed_execution_count, 2);
  assert.equal(summary.accounting_identity_pass, true);
  assert.equal(summary.planned_attempt_identity_pass, true);
  assert.equal(summary.failure_family_distribution.E_SCHEMA_VALIDATION_FAILURE, 1);
  assert.equal(summary.failure_family_distribution.B_PROVIDER_HTTP_FAILURE, 1);
});

test('runTender persists per-execution identity and bounded first-failure journal data', async () => {
  const prepared = {
    chunks: [
      { id: 'T-01-C001', chunk_number: 1, text: 'window one', model_text: 'window one', character_count: 10, segments: [{ source_ref: 'P1', text: 'window one', page: 1, paragraph: 1 }] },
      { id: 'T-01-C002', chunk_number: 2, text: 'window two', model_text: 'window two', character_count: 10, segments: [{ source_ref: 'P2', text: 'window two', page: 1, paragraph: 2 }] }
    ],
    table_annotation: { status: 'NOT_AVAILABLE', rows: 0, ambiguous_rows: 0 }
  };
  const gateway = {
    extract: async ({ chunk }) => {
      if (chunk.chunk_number === 1) {
        return {
          candidates: [],
          audit: { probe_diagnostics: { provider: 'mock', requested_model: 'fixture', provider_http_reached: true, provider_http_status: 200, json_parse_success: true } }
        };
      }
      const error = new Error('schema invalid');
      error.code = 'GATEWAY_REQUIREMENTS_INVALID';
      error.audit = { probe_diagnostics: { provider: 'mock', requested_model: 'fixture', provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_validation_errors: [{ path: 'data.requirements[0].text', keyword: 'type' }] } };
      throw error;
    }
  };
  const run = await runTender({ tender_id: 'T-01', source_file: 'fixture.pdf', source_file_sha256: 'fixture-sha', title: 'Fixture', source_extraction: { selection: { title: 'FULL_DOCUMENT' } } }, prepared, gateway);
  assert.equal(run.chunk_results.length, 2);
  assert.equal(new Set(run.chunk_results.map(item => item.execution_id)).size, 2);
  assert.ok(run.chunk_results.every(item => item.request_hash));
  assert.equal(run.chunk_results[0].ok, true);
  assert.equal(run.chunk_results[0].candidate_count, 0);
  assert.equal(run.chunk_results[1].failure_family, 'E_SCHEMA_VALIDATION_FAILURE');
  assert.equal(run.chunk_results[1].first_failure_stage, 'SCHEMA_VALIDATION');
  assert.deepEqual(run.chunk_results[1].diagnostic.schema_validation_errors, [{
    stage: null,
    path: 'data.requirements[0].text',
    keyword: 'type',
    expected: null,
    actual_type: null,
    additional_property: null,
    message: null
  }]);
});
