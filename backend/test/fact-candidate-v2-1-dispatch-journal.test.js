import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDispatchJournal, journalStateRows } from '../eval/rag-pilot/fact-candidate-v2-1-dispatch-journal.js';

function tempJournal() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fact-v21-journal-')), 'pre-dispatch-ledger.json');
}

test('planned ledger is persisted before dispatch', () => {
  const filePath = tempJournal();
  const journal = createDispatchJournal(filePath);
  journal.plan({ run_id: 'run-1', execution_id: 'exec-1', case_id: 'COM-01' });
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(journalStateRows(filePath, 'exec-1')[0].state, 'PLANNED');
});

test('dispatch state proves a request was dispatched when interrupted after dispatch', () => {
  const filePath = tempJournal();
  const journal = createDispatchJournal(filePath);
  const metadata = { run_id: 'run-1', execution_id: 'exec-2', case_id: 'COM-01' };
  journal.plan(metadata);
  journal.transition(metadata, 'DISPATCHING');
  journal.transition(metadata, 'DISPATCHED');
  const rows = journalStateRows(filePath, 'exec-2');
  assert.deepEqual(rows.map(row => row.state), ['PLANNED', 'DISPATCHING', 'DISPATCHED']);
  assert.equal(rows.at(-1).state === 'DISPATCHED', true);
});

test('planned-only state proves a request was not dispatched when interrupted before dispatch', () => {
  const filePath = tempJournal();
  const journal = createDispatchJournal(filePath);
  journal.plan({ run_id: 'run-1', execution_id: 'exec-3', case_id: 'COM-01' });
  assert.deepEqual(journalStateRows(filePath, 'exec-3').map(row => row.state), ['PLANNED']);
});

test('response and schema states are durable and ordered', () => {
  const filePath = tempJournal();
  const journal = createDispatchJournal(filePath);
  const metadata = { run_id: 'run-1', execution_id: 'exec-4', case_id: 'COM-01' };
  journal.plan(metadata);
  for (const state of ['DISPATCHING', 'DISPATCHED', 'RESPONSE_RECEIVED', 'SCHEMA_VALIDATED', 'FINALIZED']) {
    journal.transition(metadata, state, state === 'FINALIZED' ? { outcome: 'PASS' } : {});
  }
  assert.deepEqual(journalStateRows(filePath, 'exec-4').map(row => row.state), [
    'PLANNED', 'DISPATCHING', 'DISPATCHED', 'RESPONSE_RECEIVED', 'SCHEMA_VALIDATED', 'FINALIZED'
  ]);
  assert.equal(journalStateRows(filePath, 'exec-4').at(-1).outcome, 'PASS');
});
