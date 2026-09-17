import test from 'node:test';
import assert from 'node:assert/strict';
import { importBadCaseLedger, registerBadCase, transitionBadCase } from '../../src/eval/flywheel/badcase-registry.js';

const row = { badcase_id: 'b1', module: 'requirement', eval_run_id: 'r1', case_id: 'c1', severity: 'P0', status: 'OPEN', evidence_refs: [{ artifact_id: 'a' }], created_at: '2026-09-11T00:00:00.000Z', updated_at: '2026-09-11T00:00:00.000Z' };

test('BadCase registration is idempotent and lifecycle is guarded', () => {
  const store = { rows: [] };
  assert.equal(registerBadCase(row, store).created, true);
  assert.equal(registerBadCase(row, store).created, false);
  const next = transitionBadCase({ badcaseId: 'b1', nextStatus: 'ROOT_CAUSE_CONFIRMED', store });
  assert.equal(next.status, 'ROOT_CAUSE_CONFIRMED');
  assert.throws(() => transitionBadCase({ badcaseId: 'b1', nextStatus: 'REGRESSION_PASS', store }), (error) => error?.code === 'BADCASE_TRANSITION_INVALID');
});

test('aggregate or missing 44-row seed remains pending GPT', () => {
  assert.equal(importBadCaseLedger({ evalRunId: 'r', ledgerPath: 'missing.json', store: { rows: [] } }).status, 'SEED_LEDGER_INPUT_PENDING_GPT');
});
