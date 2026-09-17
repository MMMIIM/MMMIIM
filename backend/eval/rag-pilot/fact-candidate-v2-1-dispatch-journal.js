import fs from 'node:fs';
import path from 'node:path';

const JOURNAL_STATES = Object.freeze([
  'PLANNED',
  'DISPATCHING',
  'DISPATCHED',
  'RESPONSE_RECEIVED',
  'SCHEMA_VALIDATED',
  'FINALIZED'
]);

function safeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function readJournal(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function writeJournal(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Eval-only append-safe execution journal. The write happens before every
 * network boundary so an interruption cannot be mistaken for a zero-call run.
 */
export function createDispatchJournal(filePath) {
  const append = entry => {
    const rows = readJournal(filePath);
    rows.push(Object.freeze({
      ...safeRecord(entry),
      journal_index: rows.length,
      recorded_at: new Date().toISOString()
    }));
    writeJournal(filePath, rows);
  };

  return Object.freeze({
    filePath,
    plan(metadata) {
      append({ ...safeRecord(metadata), state: 'PLANNED' });
    },
    transition(metadata, state, details = {}) {
      if (!JOURNAL_STATES.includes(state)) throw new Error(`unsupported dispatch state: ${state}`);
      append({ ...safeRecord(metadata), ...safeRecord(details), state });
    },
    rows() {
      return readJournal(filePath);
    }
  });
}

export function journalStateRows(filePath, executionId) {
  return readJournal(filePath).filter(row => row.execution_id === executionId);
}

export { JOURNAL_STATES };
