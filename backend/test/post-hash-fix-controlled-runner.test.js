import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createCallLedger, acquireRunLock } from '../eval/rag-pilot/post-hash-fix/controlled-run-guard.js';

test('controlled ledger durably records ABOUT_TO_SEND before terminal event and enforces budget', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reqx-ledger-'));
  try {
    const ledger = await createCallLedger({ filePath: path.join(dir, 'provider_call_ledger.jsonl'), runId: 'TEST-RUN', budget: 1 });
    const attempt = await ledger.aboutToSend({ phase: 'B', caseId: 'B-01' });
    assert.equal(attempt, 1);
    await ledger.record({ phase: 'B', caseId: 'B-01', attempt, event: 'HTTP_SUCCESS', httpStatus: 200 });
    await assert.rejects(() => ledger.aboutToSend({ phase: 'B', caseId: 'B-02' }), /PROVIDER_CALL_BUDGET_EXCEEDED/);
    const lines = (await readFile(path.join(dir, 'provider_call_ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(lines.map(item => item.event), ['ABOUT_TO_SEND', 'HTTP_SUCCESS']);
    assert.equal(lines[0].run_id, 'TEST-RUN');
    assert.equal(lines[0].attempt, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('controlled run lock refuses a second active instance and releases cleanly', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reqx-lock-'));
  const filePath = path.join(dir, 'run.lock');
  try {
    const first = await acquireRunLock({ filePath, runId: 'RUN-1', pid: process.pid });
    await assert.rejects(() => acquireRunLock({ filePath, runId: 'RUN-2', pid: process.pid }), /REFUSE_SECOND_START/);
    await first.release();
    const second = await acquireRunLock({ filePath, runId: 'RUN-2', pid: process.pid });
    await second.release();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
