import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, open, readFile } from 'node:fs/promises';

export const FIXED48_CASE_STATES = Object.freeze([
  'PENDING',
  'CALL_RESERVED',
  'DISPATCHED',
  'RESPONSE_RECEIVED',
  'FINALIZED',
  'FAILED_BEFORE_DISPATCH',
  'UNKNOWN_AFTER_DISPATCH'
]);

const SAFE_RETURN_FIELDS = Object.freeze([
  'http_status',
  'schema_pass',
  'source_resolution_pass',
  'source_resolution_failure_code',
  'canonicalization_pass',
  'canonicalization_failure_code',
  'quality_gate_decision',
  'candidate_count',
  'duration_ms',
  'finish_reason',
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'error_code'
]);

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function safeScalar(value, max = 160) {
  if (typeof value === 'string') return value.slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return null;
}

function safeReturnMetadata(metadata = {}) {
  const output = {};
  for (const key of SAFE_RETURN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) continue;
    const value = metadata[key];
    if (key.endsWith('_pass') || key === 'schema_pass') {
      if (typeof value === 'boolean') output[key] = value;
    } else if (key.endsWith('_count') || key.endsWith('_ms') || key.endsWith('_tokens') || key === 'http_status') {
      if (Number.isFinite(Number(value))) output[key] = Number(value);
    } else {
      const safe = safeScalar(value);
      if (safe !== null) output[key] = safe;
    }
  }
  return output;
}

function caseKey(caseId) {
  const value = String(caseId || '').trim();
  if (!value) throw new Error('FIXED48_CASE_ID_REQUIRED');
  return value;
}

function normalizeCase(input, index) {
  const caseId = caseKey(input?.case_id || input?.caseId);
  const caseIndex = Number.isInteger(input?.case_index)
    ? input.case_index
    : Number.isInteger(input?.caseIndex) ? input.caseIndex : index + 1;
  if (caseIndex < 1) throw new Error('FIXED48_CASE_INDEX_INVALID');
  const inputHash = String(input?.input_sha256 || input?.inputHash || '').trim();
  const sourceHash = String(input?.source_sha256 || input?.sourceHash || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(inputHash) || !/^[a-f0-9]{64}$/i.test(sourceHash)) {
    throw new Error('FIXED48_CASE_HASH_REQUIRED');
  }
  return Object.freeze({ case_id: caseId, case_index: caseIndex, input_sha256: inputHash.toLowerCase(), source_sha256: sourceHash.toLowerCase() });
}

/**
 * Append-only Eval ledger. Every append opens, writes, fsyncs, and closes the
 * file before the caller is allowed to dispatch a Provider request.
 */
export class Fixed48RunLedger {
  constructor({ file_path, run_id = randomUUID(), case_count = null, call_cap = 48, clock = () => Date.now() } = {}) {
    if (!file_path) throw new Error('FIXED48_LEDGER_PATH_REQUIRED');
    if (!Number.isInteger(call_cap) || call_cap < 1) throw new Error('FIXED48_CALL_CAP_INVALID');
    this.file_path = file_path;
    this.run_id = String(run_id);
    this.case_count = Number.isInteger(case_count) ? case_count : null;
    this.call_cap = call_cap;
    this.clock = clock;
    this.events = [];
    this.cases = new Map();
  }

  async load() {
    await mkdir(dirname(this.file_path), { recursive: true });
    let text = '';
    try { text = await readFile(this.file_path, 'utf8'); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    this.events = text.split(/\r?\n/).filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { throw new Error('FIXED48_LEDGER_CORRUPT'); }
    });
    for (const event of this.events) {
      if (event.run_id !== this.run_id) throw new Error('FIXED48_LEDGER_RUN_ID_MISMATCH');
    }
    this.rebuildCases();
    return this;
  }

  rebuildCases() {
    this.cases = new Map();
    for (const event of this.events) {
      if (!event.case_id) continue;
      const current = this.cases.get(event.case_id) || {
        case_id: event.case_id,
        case_index: event.case_index,
        input_sha256: event.input_sha256,
        source_sha256: event.source_sha256,
        state: 'PENDING',
        call_sequence: null,
        attempt: null,
        return_metadata: null
      };
      if (event.input_sha256) current.input_sha256 = event.input_sha256;
      if (event.source_sha256) current.source_sha256 = event.source_sha256;
      if (Number.isInteger(event.case_index)) current.case_index = event.case_index;
      if (Number.isInteger(event.call_sequence)) current.call_sequence = event.call_sequence;
      if (Number.isInteger(event.attempt)) current.attempt = event.attempt;
      if (event.return_metadata) current.return_metadata = event.return_metadata;
      if (event.state) current.state = event.state;
      this.cases.set(event.case_id, current);
    }
  }

  async append(event) {
    const record = Object.freeze({
      run_id: this.run_id,
      timestamp: nowIso(this.clock),
      ...event
    });
    const handle = await open(this.file_path, 'a');
    try {
      await handle.write(`${JSON.stringify(record)}\n`, null, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.events.push(record);
    this.rebuildCases();
    return record;
  }

  async registerCases(cases = []) {
    const normalized = cases.map(normalizeCase);
    if (this.case_count !== null && normalized.length !== this.case_count) throw new Error('FIXED48_CASE_COUNT_MISMATCH');
    this.case_count = normalized.length;
    for (const item of normalized) {
      const current = this.cases.get(item.case_id);
      if (current) {
        if (current.input_sha256 !== item.input_sha256 || current.source_sha256 !== item.source_sha256) {
          throw new Error('FIXED48_CASE_IDENTITY_CHANGED');
        }
        continue;
      }
      await this.append({
        event: 'CASE_REGISTERED',
        case_id: item.case_id,
        case_index: item.case_index,
        input_sha256: item.input_sha256,
        source_sha256: item.source_sha256,
        state: 'PENDING'
      });
    }
    return this.snapshot();
  }

  reservedCallCount() {
    return this.events.filter(event => event.event === 'CALL_RESERVED').length;
  }

  retryCount() {
    return this.events.filter(event => event.event === 'CALL_RESERVED')
      .reduce((total, event) => total + Math.max(0, Number(event.attempt || 1) - 1), 0);
  }

  caseState(caseId) {
    const item = this.cases.get(caseKey(caseId));
    return item ? { ...item } : null;
  }

  async reserveCall(caseId) {
    const item = this.caseState(caseId);
    if (!item) throw new Error('FIXED48_CASE_NOT_REGISTERED');
    if (!['PENDING', 'FAILED_BEFORE_DISPATCH'].includes(item.state)) {
      throw new Error('FIXED48_CASE_NOT_SAFE_TO_RESERVE');
    }
    const used = this.reservedCallCount();
    if (used >= this.call_cap) throw new Error('FIXED48_CALL_CAP_REACHED');
    const callSequence = used + 1;
    await this.append({
      event: 'CALL_RESERVED',
      case_id: item.case_id,
      case_index: item.case_index,
      input_sha256: item.input_sha256,
      source_sha256: item.source_sha256,
      state: 'CALL_RESERVED',
      call_sequence: callSequence,
      attempt: 1,
      provider_task: 'requirement_extraction'
    });
    return this.caseState(caseId);
  }

  async markDispatched(caseId) {
    const item = this.caseState(caseId);
    if (!item || item.state !== 'CALL_RESERVED') throw new Error('FIXED48_DISPATCH_STATE_INVALID');
    await this.append({ event: 'CALL_DISPATCHED', case_id: item.case_id, case_index: item.case_index, state: 'DISPATCHED', call_sequence: item.call_sequence });
    return this.caseState(caseId);
  }

  async recordProviderReturned(caseId, metadata = {}) {
    const item = this.caseState(caseId);
    if (!item || item.state !== 'DISPATCHED') throw new Error('FIXED48_RETURN_STATE_INVALID');
    await this.append({ event: 'PROVIDER_RETURNED', case_id: item.case_id, case_index: item.case_index, state: 'RESPONSE_RECEIVED', call_sequence: item.call_sequence, return_metadata: safeReturnMetadata(metadata) });
    return this.caseState(caseId);
  }

  async finalizeCase(caseId, metadata = null) {
    const item = this.caseState(caseId);
    if (!item || item.state !== 'RESPONSE_RECEIVED') throw new Error('FIXED48_FINALIZE_STATE_INVALID');
    await this.append({ event: 'CASE_FINALIZED', case_id: item.case_id, case_index: item.case_index, state: 'FINALIZED', call_sequence: item.call_sequence, ...(metadata ? { return_metadata: safeReturnMetadata(metadata) } : {}) });
    return this.caseState(caseId);
  }

  async failBeforeDispatch(caseId, errorCode = 'RUNNER_FAILURE_BEFORE_DISPATCH') {
    const item = this.caseState(caseId);
    if (!item || !['PENDING', 'FAILED_BEFORE_DISPATCH'].includes(item.state)) throw new Error('FIXED48_PRE_DISPATCH_FAILURE_STATE_INVALID');
    await this.append({ event: 'CASE_FAILED_BEFORE_DISPATCH', case_id: item.case_id, case_index: item.case_index, state: 'FAILED_BEFORE_DISPATCH', error_code: safeScalar(errorCode, 120) });
    return this.caseState(caseId);
  }

  async markUnknownAfterDispatch(caseId, reason = 'PROCESS_EXIT_AFTER_DISPATCH') {
    const item = this.caseState(caseId);
    if (!item || !['CALL_RESERVED', 'DISPATCHED'].includes(item.state)) throw new Error('FIXED48_UNKNOWN_STATE_INVALID');
    await this.append({ event: 'CASE_UNKNOWN_AFTER_DISPATCH', case_id: item.case_id, case_index: item.case_index, state: 'UNKNOWN_AFTER_DISPATCH', call_sequence: item.call_sequence, error_code: safeScalar(reason, 120) });
    return this.caseState(caseId);
  }

  async recoverStaleCalls() {
    const stale = [...this.cases.values()].filter(item => ['CALL_RESERVED', 'DISPATCHED'].includes(item.state));
    for (const item of stale) await this.markUnknownAfterDispatch(item.case_id);
    return stale.map(item => item.case_id);
  }

  resumePlan() {
    return [...this.cases.values()].sort((a, b) => a.case_index - b.case_index).map(item => ({
      case_id: item.case_id,
      case_index: item.case_index,
      state: item.state,
      action: item.state === 'FINALIZED' || item.state === 'UNKNOWN_AFTER_DISPATCH'
        ? item.state === 'FINALIZED' ? 'SKIP_FINALIZED' : 'MANUAL_REVIEW_FOR_RERUN'
        : item.state === 'RESPONSE_RECEIVED' ? 'FINALIZE_FROM_DURABLE_RESPONSE' : 'RUN_PROVIDER'
    }));
  }

  summary() {
    const rows = [...this.cases.values()];
    return {
      run_id: this.run_id,
      case_count: this.case_count ?? rows.length,
      provider_calls: this.reservedCallCount(),
      retries: this.retryCount(),
      cases_completed: rows.filter(item => item.state === 'FINALIZED').length,
      cases_unknown: rows.filter(item => item.state === 'UNKNOWN_AFTER_DISPATCH').length,
      cases_failed: rows.filter(item => item.state === 'FAILED_BEFORE_DISPATCH').length,
      cases_pending: rows.filter(item => item.state === 'PENDING').length,
      states: Object.fromEntries(rows.map(item => [item.case_id, item.state]))
    };
  }

  snapshot() {
    return { run_id: this.run_id, case_count: this.case_count, call_cap: this.call_cap, cases: [...this.cases.values()].map(item => ({ ...item })) };
  }
}

/**
 * Sequential production-shaped orchestration. The dispatch callback is the
 * only network boundary; it is called only after CALL_RESERVED is durably
 * flushed. This function never retries and never handles UNKNOWN calls.
 */
export async function executeFixed48Run({ ledger, cases, dispatchCase, hooks = {} } = {}) {
  if (!(ledger instanceof Fixed48RunLedger)) throw new Error('FIXED48_LEDGER_REQUIRED');
  if (typeof dispatchCase !== 'function') throw new Error('FIXED48_DISPATCH_CALLBACK_REQUIRED');
  await ledger.load();
  await ledger.registerCases(cases);
  await ledger.recoverStaleCalls();
  for (const item of ledger.resumePlan()) {
    if (item.action === 'SKIP_FINALIZED' || item.action === 'MANUAL_REVIEW_FOR_RERUN') continue;
    if (item.action === 'FINALIZE_FROM_DURABLE_RESPONSE') {
      await ledger.finalizeCase(item.case_id);
      continue;
    }
    const registered = ledger.caseState(item.case_id);
    try {
      await hooks.beforeReserve?.(registered);
      await ledger.reserveCall(item.case_id);
      await hooks.beforeDispatch?.(registered);
      await ledger.markDispatched(item.case_id);
      await hooks.afterDispatch?.(registered);
      const result = await dispatchCase(registered);
      await ledger.recordProviderReturned(item.case_id, result?.metadata || result || {});
      await hooks.beforeFinalize?.(registered);
      await ledger.finalizeCase(item.case_id);
    } catch (error) {
      if (error?.isFixed48Crash) throw error;
      const state = ledger.caseState(item.case_id);
      if (state?.state === 'PENDING') await ledger.failBeforeDispatch(item.case_id, error?.code || 'RUNNER_FAILURE_BEFORE_DISPATCH');
      else if (['CALL_RESERVED', 'DISPATCHED'].includes(state?.state)) await ledger.markUnknownAfterDispatch(item.case_id, error?.code || 'RUNNER_FAILURE_AFTER_DISPATCH');
      throw error;
    }
  }
  return ledger.summary();
}

export function fixed48Hash(value) {
  return sha256(value);
}
