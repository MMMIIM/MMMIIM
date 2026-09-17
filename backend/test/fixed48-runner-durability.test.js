import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Fixed48RunLedger,
  executeFixed48Run,
  fixed48Hash
} from '../eval/requirement-production-quality-gate/fixed48-durable-runner.js';

const hash = value => fixed48Hash(value);
const cases = count => Array.from({ length: count }, (_, index) => ({
  case_id: `FIXED48-${String(index + 1).padStart(2, '0')}`,
  case_index: index + 1,
  input_sha256: hash(`input-${index + 1}`),
  source_sha256: hash(`source-${index + 1}`)
}));

async function ledgerFixture(count = 1, cap = 48) {
  const dir = await mkdtemp(join(tmpdir(), 'fixed48-ledger-'));
  const ledger = new Fixed48RunLedger({ file_path: join(dir, 'run.jsonl'), run_id: `run-${Date.now()}-${Math.random()}`, case_count: count, call_cap: cap });
  await ledger.load();
  await ledger.registerCases(cases(count));
  return { ledger, file_path: join(dir, 'run.jsonl'), cases: cases(count) };
}

function crash(code) {
  return Object.assign(new Error(code), { code, isFixed48Crash: true });
}

test('A: crash before reservation performs zero Provider dispatch and resumes safely', async () => {
  const fixture = await ledgerFixture();
  await assert.rejects(() => executeFixed48Run({
    ledger: fixture.ledger,
    cases: fixture.cases,
    dispatchCase: async () => { throw new Error('must not dispatch'); },
    hooks: { beforeReserve: async () => { throw crash('CRASH_BEFORE_RESERVE'); } }
  }), /CRASH_BEFORE_RESERVE/);
  const reloaded = new Fixed48RunLedger({ file_path: fixture.file_path, run_id: fixture.ledger.run_id, case_count: 1, call_cap: 48 });
  await reloaded.load();
  assert.equal(reloaded.summary().provider_calls, 0);
  assert.equal(reloaded.caseState(fixture.cases[0].case_id).state, 'PENDING');
});

test('B: CALL_RESERVED crash is conservatively consumed and is not retried', async () => {
  const fixture = await ledgerFixture();
  await fixture.ledger.reserveCall(fixture.cases[0].case_id);
  const reloaded = new Fixed48RunLedger({ file_path: fixture.file_path, run_id: fixture.ledger.run_id, case_count: 1, call_cap: 48 });
  await reloaded.load();
  await reloaded.recoverStaleCalls();
  assert.equal(reloaded.summary().provider_calls, 1);
  assert.equal(reloaded.caseState(fixture.cases[0].case_id).state, 'UNKNOWN_AFTER_DISPATCH');
  assert.equal(reloaded.resumePlan()[0].action, 'MANUAL_REVIEW_FOR_RERUN');
});

test('C: dispatch crash becomes UNKNOWN_AFTER_DISPATCH and cannot auto retry', async () => {
  const fixture = await ledgerFixture();
  await assert.rejects(() => executeFixed48Run({
    ledger: fixture.ledger,
    cases: fixture.cases,
    dispatchCase: async () => { throw crash('CRASH_AFTER_DISPATCH'); },
    hooks: { afterDispatch: async () => { throw crash('CRASH_AFTER_DISPATCH'); } }
  }), /CRASH_AFTER_DISPATCH/);
  const reloaded = new Fixed48RunLedger({ file_path: fixture.file_path, run_id: fixture.ledger.run_id, case_count: 1, call_cap: 48 });
  await reloaded.load();
  await reloaded.recoverStaleCalls();
  assert.equal(reloaded.summary().provider_calls, 1);
  assert.equal(reloaded.resumePlan()[0].action, 'MANUAL_REVIEW_FOR_RERUN');
});

test('D: durable response resumes finalization without another Provider call', async () => {
  const fixture = await ledgerFixture();
  await fixture.ledger.reserveCall(fixture.cases[0].case_id);
  await fixture.ledger.markDispatched(fixture.cases[0].case_id);
  await fixture.ledger.recordProviderReturned(fixture.cases[0].case_id, { http_status: 200, schema_pass: true, candidate_count: 2 });
  const reloaded = new Fixed48RunLedger({ file_path: fixture.file_path, run_id: fixture.ledger.run_id, case_count: 1, call_cap: 48 });
  await reloaded.load();
  const calls = { count: 0 };
  const summary = await executeFixed48Run({ ledger: reloaded, cases: fixture.cases, dispatchCase: async () => { calls.count += 1; } });
  assert.equal(calls.count, 0);
  assert.equal(summary.cases_completed, 1);
  assert.equal(reloaded.caseState(fixture.cases[0].case_id).return_metadata.schema_pass, true);
});

test('E: completed prefix is retained and resume starts at the next safe case', async () => {
  const fixture = await ledgerFixture(3);
  let calls = 0;
  const first = await executeFixed48Run({
    ledger: fixture.ledger,
    cases: fixture.cases,
    dispatchCase: async () => { calls += 1; return { metadata: { http_status: 200, schema_pass: true } }; },
    hooks: { beforeReserve: async item => { if (item.case_index === 2) throw crash('CRASH_CASE_2'); } }
  }).catch(error => { assert.equal(error.code, 'CRASH_CASE_2'); });
  assert.equal(calls, 1);
  const reloaded = new Fixed48RunLedger({ file_path: fixture.file_path, run_id: fixture.ledger.run_id, case_count: 3, call_cap: 48 });
  await reloaded.load();
  assert.equal(reloaded.caseState(fixture.cases[0].case_id).state, 'FINALIZED');
  assert.equal(reloaded.caseState(fixture.cases[1].case_id).state, 'PENDING');
  const resumed = await executeFixed48Run({ ledger: reloaded, cases: fixture.cases, dispatchCase: async () => { calls += 1; return { metadata: { http_status: 200, schema_pass: true } }; } });
  assert.equal(calls, 3);
  assert.equal(resumed.cases_completed, 3);
});

test('budget accounting is ledger-derived and UNKNOWN consumes the cap', async () => {
  const fixture = await ledgerFixture(3, 2);
  await fixture.ledger.reserveCall(fixture.cases[0].case_id);
  await fixture.ledger.markUnknownAfterDispatch(fixture.cases[0].case_id);
  await fixture.ledger.reserveCall(fixture.cases[1].case_id);
  assert.equal(fixture.ledger.summary().provider_calls, 2);
  await assert.rejects(() => fixture.ledger.reserveCall(fixture.cases[2].case_id), /FIXED48_CALL_CAP_REACHED/);
  const persisted = await readFile(fixture.file_path, 'utf8');
  assert.equal(persisted.split(/\r?\n/).filter(Boolean).length > 0, true);
});

test('safe ledger excludes payloads, prompts, and Provider response bodies', async () => {
  const fixture = await ledgerFixture();
  await fixture.ledger.reserveCall(fixture.cases[0].case_id);
  await fixture.ledger.markDispatched(fixture.cases[0].case_id);
  await fixture.ledger.recordProviderReturned(fixture.cases[0].case_id, {
    http_status: 200,
    schema_pass: true,
    prompt: 'secret prompt must not persist',
    response_body: 'sensitive response must not persist'
  });
  const persisted = await readFile(fixture.file_path, 'utf8');
  assert.equal(persisted.includes('secret prompt'), false);
  assert.equal(persisted.includes('sensitive response'), false);
});
