import fs from 'node:fs';
import path from 'node:path';
import { validateBadCaseInput, hashJson } from './contract.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  OPEN: ['ROOT_CAUSE_CONFIRMED', 'REPAIR_PLANNED', 'DISPUTED', 'WONT_FIX'],
  ROOT_CAUSE_CONFIRMED: ['REPAIR_PLANNED', 'DISPUTED', 'WONT_FIX'],
  REPAIR_PLANNED: ['REPAIRED', 'DISPUTED', 'WONT_FIX'],
  REPAIRED: ['REGRESSION_PASS', 'REGRESSION_FAIL'],
  REGRESSION_FAIL: ['REPAIRED', 'DISPUTED', 'WONT_FIX'],
  REGRESSION_PASS: [],
  DISPUTED: [],
  WONT_FIX: []
});

function rowsOf(store) { return Array.isArray(store) ? store : Array.isArray(store?.rows) ? store.rows : []; }

export function registerBadCase(input, store = { rows: [] }) {
  const candidateInput = { ...input };
  if (!candidateInput.badcase_id) candidateInput.badcase_id = `badcase:${hashJson(candidateInput).slice(-24)}`;
  const value = validateBadCaseInput(candidateInput);
  const rows = rowsOf(store);
  const existing = rows.find((row) => row.eval_run_id === value.eval_run_id && row.case_id === value.case_id && row.semantic_label_version === value.semantic_label_version);
  if (existing) {
    if (hashJson(existing) !== hashJson(value)) throw Object.assign(new Error('Existing BadCase conflicts with immutable evidence.'), { code: 'BADCASE_IDENTITY_CONFLICT' });
    return { record: existing, created: false, store };
  }
  const record = { ...value };
  rows.push(record);
  return { record, created: true, store };
}

export function transitionBadCase({ badcaseId, nextStatus, evidenceRefs = [], store = { rows: [] } } = {}) {
  const rows = rowsOf(store);
  const row = rows.find((item) => item.badcase_id === badcaseId);
  if (!row) throw Object.assign(new Error('BadCase not found.'), { code: 'BADCASE_NOT_FOUND' });
  if (!ALLOWED_TRANSITIONS[row.status]?.includes(nextStatus)) throw Object.assign(new Error(`Invalid BadCase transition: ${row.status} -> ${nextStatus}`), { code: 'BADCASE_TRANSITION_INVALID' });
  return { ...row, status: nextStatus, evidence_refs: [...row.evidence_refs, ...evidenceRefs], updated_at: new Date().toISOString() };
}

export function importBadCaseLedger({ evalRunId, ledgerPath, store = { rows: [] } } = {}) {
  if (!ledgerPath || !fs.existsSync(ledgerPath)) return { status: 'SEED_LEDGER_INPUT_PENDING_GPT', imported_count: 0, rejected_count: 0, reason: 'LEDGER_NOT_FOUND' };
  const raw = fs.readFileSync(ledgerPath, 'utf8');
  let rows;
  try { rows = ledgerPath.toLowerCase().endsWith('.jsonl') ? raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : JSON.parse(raw); } catch { return { status: 'SEED_LEDGER_INPUT_PENDING_GPT', imported_count: 0, rejected_count: 0, reason: 'LEDGER_PARSE_FAILED' }; }
  if (!Array.isArray(rows) || rows.length !== 44 || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    return { status: 'SEED_LEDGER_INPUT_PENDING_GPT', imported_count: 0, rejected_count: 0, reason: 'EXACT_44_ROW_LEDGER_REQUIRED' };
  }
  let imported = 0; let rejected = 0;
  for (const row of rows) {
    try {
      const result = registerBadCase({
        ...row,
        module: row.module || 'requirement',
        eval_run_id: row.eval_run_id || evalRunId,
        case_id: row.case_id || row.atom_id,
        badcase_id: row.badcase_id || row.atom_id,
        severity: 'P0',
        status: row.status || 'OPEN'
      }, store);
      if (result.created) imported += 1;
    } catch { rejected += 1; }
  }
  return { status: rejected ? 'PARTIAL' : 'IMPORTED', imported_count: imported, rejected_count: rejected };
}

export function persistBadCases(store, filePath) {
  const rows = rowsOf(store);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ artifact_type: 'V43_BADCASE_REGISTRY', artifact_version: 'v1', rows }, null, 2)}\n`, 'utf8');
  return filePath;
}

export { ALLOWED_TRANSITIONS };
