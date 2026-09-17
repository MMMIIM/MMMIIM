import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const FACT_CANARY_LEDGER_VERSION = 'fact-canary-telemetry-v1';

const sha256 = value => createHash('sha256').update(String(value ?? '')).digest('hex');

function safeText(value, max = 240) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function safeInt(value) {
  return Number.isInteger(value) ? value : null;
}

/**
 * Project only bounded telemetry fields.  This deliberately drops prompts,
 * source text and provider response bodies before they can reach the ledger.
 */
export function projectFactCanaryTelemetry(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = {
    case_id: safeText(value.case_id, 120),
    call_index: safeInt(value.call_index),
    request_hash: /^[a-f0-9]{64}$/i.test(String(value.request_hash || '')) ? String(value.request_hash).toLowerCase() : null,
    gateway_status: safeInt(value.gateway_status),
    gateway_http_status: safeInt(value.gateway_http_status),
    gateway_error_code: safeText(value.gateway_error_code, 120),
    provider_status: safeText(value.provider_status, 80),
    provider_http_status: safeInt(value.provider_http_status),
    provider_http_reached: value.provider_http_reached === true,
    validation_path: safeText(value.validation_path, 240),
    validation_stage: safeText(value.validation_stage, 80),
    expected_shape: safeText(value.expected_shape, 240),
    actual_type: safeText(value.actual_type, 80),
    normalization_count: safeInt(value.normalization_count),
    normalizer_invoked: value.normalizer_invoked === true ? true : value.normalizer_invoked === false ? false : null,
    json_parse: value.json_parse === true ? true : value.json_parse === false ? false : null,
    schema_valid: value.schema_valid === true ? true : value.schema_valid === false ? false : null,
    final_result: safeText(value.final_result, 120),
    error_code: safeText(value.error_code, 120),
    cause_class: safeText(value.cause_class, 120),
    duration_ms: Number.isFinite(value.duration_ms) && value.duration_ms >= 0 ? Math.round(value.duration_ms) : null,
    content_present: value.content_present === true,
    content_length: safeInt(value.content_length),
    content_hash: /^[a-f0-9]{64}$/i.test(String(value.content_hash || '')) ? String(value.content_hash).toLowerCase() : null,
    retry_count: safeInt(value.retry_count)
  };
  return Object.fromEntries(Object.entries(allowed).filter(([, field]) => field !== null));
}

function assertCaseId(caseId) {
  const normalized = String(caseId || '').trim();
  if (!normalized || normalized.length > 120) throw new Error('FACT_CANARY_CASE_ID_INVALID');
  return normalized;
}

export class FactCanaryTelemetryLedger {
  constructor({ file_path, run_id, case_ids = [], call_cap = 2 } = {}) {
    if (!file_path) throw new Error('FACT_CANARY_LEDGER_PATH_REQUIRED');
    this.filePath = file_path;
    this.runId = String(run_id || `fact-canary-${Date.now()}`);
    this.caseIds = [...new Set(case_ids.map(assertCaseId))];
    this.callCap = Number.isInteger(call_cap) && call_cap > 0 ? call_cap : 2;
    this.events = [];
    this.states = new Map(this.caseIds.map(caseId => [caseId, { state: 'PENDING', call_index: null }]));
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this;
    await mkdir(dirname(this.filePath), { recursive: true });
    let content = '';
    try { content = await readFile(this.filePath, 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const line of content.split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.ledger_version !== FACT_CANARY_LEDGER_VERSION || event.run_id !== this.runId) {
        throw new Error('FACT_CANARY_LEDGER_IDENTITY_MISMATCH');
      }
      this.events.push(event);
      this.apply(event);
    }
    this.loaded = true;
    return this;
  }

  apply(event) {
    const caseId = event.case_id ? String(event.case_id) : null;
    if (!caseId) return;
    if (!this.states.has(caseId)) this.states.set(caseId, { state: 'PENDING', call_index: null });
    const state = this.states.get(caseId);
    if (event.event === 'CALL_RESERVED') {
      state.state = 'CALL_RESERVED';
      state.call_index = event.call_index;
    } else if (event.event === 'PROVIDER_RETURNED') {
      state.state = 'PROVIDER_RETURNED';
      state.return_metadata = event.metadata || {};
    } else if (event.event === 'CASE_FINALIZED') {
      state.state = 'FINALIZED';
      state.final_metadata = event.metadata || {};
    } else if (event.event === 'UNKNOWN_AFTER_DISPATCH') {
      state.state = 'UNKNOWN_AFTER_DISPATCH';
    }
  }

  async append(event, metadata = {}) {
    await this.load();
    const safe = projectFactCanaryTelemetry({ ...metadata, case_id: event.case_id });
    // Keep the call ledger shape stable even when the runtime cannot expose a
    // diagnostic yet.  Null is an explicit observation gap, not an omitted
    // field that a later reader could mistake for a successful check.
    for (const key of ['gateway_status', 'provider_status', 'validation_path', 'normalization_count', 'final_result']) {
      if (!Object.hasOwn(safe, key)) safe[key] = null;
    }
    const row = Object.freeze({
      ledger_version: FACT_CANARY_LEDGER_VERSION,
      run_id: this.runId,
      event: String(event.event),
      event_at: new Date().toISOString(),
      ...(event.case_id ? { case_id: assertCaseId(event.case_id) } : {}),
      ...(Number.isInteger(event.call_index) ? { call_index: event.call_index } : {}),
      ...(Object.keys(safe).length ? { metadata: safe } : {})
    });
    const handle = await open(this.filePath, 'a');
    try {
      await handle.writeFile(`${JSON.stringify(row)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.events.push(row);
    this.apply(row);
    return row;
  }

  state(caseId) {
    return this.states.get(assertCaseId(caseId)) || { state: 'PENDING', call_index: null };
  }

  reservedCount() {
    return this.events.filter(event => event.event === 'CALL_RESERVED').length;
  }

  async reserve(caseId, request_hash = null) {
    const normalized = assertCaseId(caseId);
    const current = this.state(normalized);
    if (current.state !== 'PENDING') throw new Error('FACT_CANARY_CASE_NOT_PENDING');
    if (this.reservedCount() >= this.callCap) throw new Error('FACT_CANARY_CALL_CAP_REACHED');
    const callIndex = this.reservedCount() + 1;
    return this.append({ event: 'CALL_RESERVED', case_id: normalized, call_index: callIndex }, {
      request_hash,
      call_index: callIndex
    });
  }

  async providerReturned(caseId, metadata = {}) {
    const current = this.state(caseId);
    if (current.state !== 'CALL_RESERVED') throw new Error('FACT_CANARY_RETURN_WITHOUT_RESERVATION');
    return this.append({ event: 'PROVIDER_RETURNED', case_id: caseId, call_index: current.call_index }, metadata);
  }

  async finalize(caseId, metadata = {}) {
    const current = this.state(caseId);
    if (current.state !== 'PROVIDER_RETURNED') throw new Error('FACT_CANARY_FINALIZE_WITHOUT_RETURN');
    return this.append({ event: 'CASE_FINALIZED', case_id: caseId, call_index: current.call_index }, metadata);
  }

  /** A stale in-flight call is consumed conservatively and never retried. */
  async recoverUnfinalized() {
    const recovered = [];
    for (const [caseId, state] of this.states.entries()) {
      if (state.state === 'CALL_RESERVED' || state.state === 'PROVIDER_RETURNED') {
        if (state.state === 'CALL_RESERVED') {
          await this.append({ event: 'UNKNOWN_AFTER_DISPATCH', case_id: caseId, call_index: state.call_index }, {
            final_result: 'UNKNOWN_AFTER_DISPATCH',
            cause_class: 'EVAL_HARNESS'
          });
        }
        recovered.push({ case_id: caseId, action: 'MANUAL_REVIEW_NO_AUTO_RETRY', state: this.state(caseId).state });
      }
    }
    return recovered;
  }

  summary() {
    const finalized = [...this.states.values()].filter(item => item.state === 'FINALIZED').length;
    const returned = [...this.states.values()].filter(item => item.state === 'PROVIDER_RETURNED' || item.state === 'FINALIZED').length;
    return {
      ledger_version: FACT_CANARY_LEDGER_VERSION,
      run_id: this.runId,
      call_cap: this.callCap,
      provider_calls: this.reservedCount(),
      provider_returns: returned,
      cases_finalized: finalized,
      unreconciled_cases: [...this.states.entries()]
        .filter(([, item]) => item.state !== 'FINALIZED')
        .map(([case_id, item]) => ({ case_id, state: item.state, call_index: item.call_index }))
    };
  }
}

export async function executeFactCanaryCase({ ledger, case_id, dispatch }) {
  if (!(ledger instanceof FactCanaryTelemetryLedger)) throw new Error('FACT_CANARY_LEDGER_REQUIRED');
  await ledger.reserve(case_id);
  const started = Date.now();
  try {
    const result = await dispatch();
    await ledger.providerReturned(case_id, {
      ...(result?.metadata || {}),
      duration_ms: Date.now() - started
    });
    await ledger.finalize(case_id, { final_result: result?.final_result || 'PASS' });
    return result;
  } catch (error) {
    await ledger.providerReturned(case_id, {
      ...(error?.metadata || {}),
      duration_ms: Date.now() - started,
      error_code: error?.code || 'FACT_CANARY_DISPATCH_FAILED',
      final_result: 'FAIL'
    });
    await ledger.finalize(case_id, { final_result: 'FAIL', error_code: error?.code || 'FACT_CANARY_DISPATCH_FAILED' });
    throw error;
  }
}

export const factCanaryRequestHash = value => sha256(value);
