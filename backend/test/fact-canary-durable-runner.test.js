import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FactCanaryTelemetryLedger,
  executeFactCanaryCase,
  factCanaryRequestHash,
  FACT_CANARY_LEDGER_VERSION
} from '../eval/rag-pilot/fact-canary-durable-runner.js';

async function fixture(caseIds = ['COM-01'], cap = 2) {
  const dir = await mkdtemp(join(tmpdir(), 'fact-canary-ledger-'));
  const filePath = join(dir, 'provider-call-ledger.jsonl');
  const ledger = new FactCanaryTelemetryLedger({ file_path: filePath, run_id: 'fact-canary-test', case_ids: caseIds, call_cap: cap });
  await ledger.load();
  return { ledger, filePath, caseIds };
}

test('normalizer telemetry is represented without persisting payloads', async () => {
  const item = await fixture();
  await executeFactCanaryCase({
    ledger: item.ledger,
    case_id: 'COM-01',
    dispatch: async () => ({ final_result: 'PASS', metadata: {
      request_hash: factCanaryRequestHash('request'),
      provider_http_reached: true,
      provider_http_status: 200,
      validation_path: 'data.facts[0].domain_metadata',
      expected_shape: 'non-empty object namespaces',
      actual_type: 'object',
      normalization_count: 1,
      normalizer_invoked: true,
      json_parse: true,
      schema_valid: true,
      prompt: 'must not persist',
      response_body: 'must not persist'
    } })
  });
  const rows = (await readFile(item.filePath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const returned = rows.find(row => row.event === 'PROVIDER_RETURNED');
  assert.equal(returned.metadata.normalization_count, 1);
  assert.equal(returned.metadata.validation_path, 'data.facts[0].domain_metadata');
  assert.equal(Object.hasOwn(returned.metadata, 'prompt'), false);
  assert.equal(Object.hasOwn(returned.metadata, 'response_body'), false);
  assert.equal(item.ledger.summary().provider_calls, 1);
  assert.equal(item.ledger.summary().cases_finalized, 1);
});

test('normalize-before-validation and exact validation path survive durable finalization', async () => {
  const item = await fixture();
  await executeFactCanaryCase({
    ledger: item.ledger,
    case_id: 'COM-01',
    dispatch: async () => ({ final_result: 'FAIL', metadata: {
      validation_stage: 'FACT',
      validation_path: 'data.facts[0].domain_metadata',
      normalization_count: 1,
      normalizer_invoked: true,
      schema_valid: false,
      gateway_status: 422,
      gateway_error_code: 'OUTPUT_SCHEMA_INVALID',
      expected_shape: 'non-empty object namespaces',
      actual_type: 'object'
    } })
  }).catch(error => assert.fail(error));
  const returned = item.ledger.events.find(row => row.event === 'PROVIDER_RETURNED');
  assert.equal(returned.metadata.normalizer_invoked, true);
  assert.equal(returned.metadata.normalization_count, 1);
  assert.equal(returned.metadata.validation_path, 'data.facts[0].domain_metadata');
  assert.equal(item.ledger.summary().unreconciled_cases.length, 0);
});

test('process exit before summary leaves a recoverable per-case state and no automatic retry', async () => {
  const item = await fixture(['COM-01', 'COM-06']);
  await item.ledger.reserve('COM-01', factCanaryRequestHash('one'));
  await item.ledger.providerReturned('COM-01', {
    provider_http_reached: true,
    provider_http_status: 200,
    final_result: 'PASS'
  });
  // Simulate process termination before CASE_FINALIZED.  A reload must retain
  // the call accounting and expose the case for manual review only.
  const reloaded = new FactCanaryTelemetryLedger({ file_path: item.filePath, run_id: 'fact-canary-test', case_ids: item.caseIds, call_cap: 2 });
  await reloaded.load();
  assert.equal(reloaded.summary().provider_calls, 1);
  assert.equal(reloaded.state('COM-01').state, 'PROVIDER_RETURNED');
  assert.equal(reloaded.state('COM-06').state, 'PENDING');
  const recovered = await reloaded.recoverUnfinalized();
  assert.deepEqual(recovered, [{ case_id: 'COM-01', action: 'MANUAL_REVIEW_NO_AUTO_RETRY', state: 'PROVIDER_RETURNED' }]);
  assert.equal(reloaded.state('COM-01').state, 'PROVIDER_RETURNED');
  assert.equal(reloaded.summary().provider_calls, 1);
});

test('reserved call crash is consumed and call cap remains durable', async () => {
  const item = await fixture(['COM-01', 'COM-06'], 1);
  await item.ledger.reserve('COM-01', factCanaryRequestHash('one'));
  const reloaded = new FactCanaryTelemetryLedger({ file_path: item.filePath, run_id: 'fact-canary-test', case_ids: item.caseIds, call_cap: 1 });
  await reloaded.load();
  assert.equal(reloaded.summary().provider_calls, 1);
  await assert.rejects(() => reloaded.reserve('COM-06'), /FACT_CANARY_CALL_CAP_REACHED/);
  const recovered = await reloaded.recoverUnfinalized();
  assert.deepEqual(recovered, [{ case_id: 'COM-01', action: 'MANUAL_REVIEW_NO_AUTO_RETRY', state: 'UNKNOWN_AFTER_DISPATCH' }]);
  assert.equal(reloaded.summary().provider_calls, 1);
});

test('ledger identity is append-only and versioned', async () => {
  const item = await fixture();
  await item.ledger.reserve('COM-01');
  const lines = (await readFile(item.filePath, 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].ledger_version, FACT_CANARY_LEDGER_VERSION);
  assert.equal(lines[0].event, 'CALL_RESERVED');
  assert.equal(lines[0].call_index, 1);
});
