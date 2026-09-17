import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const TERMINAL_EVENTS = new Set([
  'HTTP_SUCCESS',
  'HTTP_ERROR',
  'TIMEOUT',
  'VALIDATION_FAILURE_AFTER_HTTP'
]);

async function appendDurably(filePath, value) {
  const handle = await open(filePath, 'a');
  try {
    await handle.write(`${JSON.stringify(value)}\n`, null, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function createCallLedger({ filePath, runId, budget }) {
  const numericBudget = Number(budget);
  if (!filePath || !runId || !Number.isInteger(numericBudget) || numericBudget <= 0) {
    throw new Error('CALL_LEDGER_CONFIG_INVALID');
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  let handle;
  try {
    handle = await open(filePath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('CALL_LEDGER_ALREADY_EXISTS');
    throw error;
  } finally {
    await handle?.close();
  }

  let attempts = 0;
  return {
    get observedAttempts() {
      return attempts;
    },
    async aboutToSend({ phase, caseId }) {
      if (attempts >= numericBudget) throw new Error('PROVIDER_CALL_BUDGET_EXCEEDED');
      const attempt = attempts + 1;
      await appendDurably(filePath, {
        run_id: String(runId),
        phase: String(phase),
        case_id: String(caseId),
        attempt,
        event: 'ABOUT_TO_SEND',
        timestamp: new Date().toISOString()
      });
      attempts = attempt;
      return attempt;
    },
    async record({ phase, caseId, attempt, event, ...safeDetails }) {
      if (!TERMINAL_EVENTS.has(event)) throw new Error('CALL_LEDGER_EVENT_INVALID');
      await appendDurably(filePath, {
        run_id: String(runId),
        phase: String(phase),
        case_id: String(caseId),
        attempt: Number(attempt),
        event,
        timestamp: new Date().toISOString(),
        ...safeDetails
      });
    }
  };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export async function acquireRunLock({ filePath, runId, pid = process.pid, processAlive = processIsAlive }) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload = { run_id: String(runId), pid: Number(pid), started_at: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(filePath, 'wx');
      try {
        await handle.write(`${JSON.stringify(payload)}\n`, null, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return {
        async release() {
          try {
            const current = JSON.parse(await readFile(filePath, 'utf8'));
            if (current.run_id === payload.run_id && current.pid === payload.pid) await unlink(filePath);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let existing = null;
      try {
        existing = JSON.parse(await readFile(filePath, 'utf8'));
      } catch {
        throw new Error('REFUSE_SECOND_START');
      }
      if (processAlive(Number(existing?.pid))) throw new Error('REFUSE_SECOND_START');
      await unlink(filePath).catch(unlinkError => {
        if (unlinkError.code !== 'ENOENT') throw unlinkError;
      });
    }
  }
  throw new Error('REFUSE_SECOND_START');
}
