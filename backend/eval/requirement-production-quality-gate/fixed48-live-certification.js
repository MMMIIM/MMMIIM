import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import { prepareTender, safeProbeAudit } from '../requirement-semantic-quality-v1/runner.js';
import { evaluateCandidatePayload } from './candidate-pipeline-evaluator.js';
import { Fixed48RunLedger } from './fixed48-durable-runner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const FROZEN_INPUT_PATH = path.join(DOCS, 'V43_REQUIREMENT_FIXED_48_RUNTIME_RUN.json');
const TASK = 'requirement_extraction';
const TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
const FIRST_ATTEMPT_CASES = 48;
const TRANSIENT_RETRY_BUDGET = 5;
const TOTAL_CALL_CAP = FIRST_ATTEMPT_CASES + TRANSIENT_RETRY_BUDGET;
const CONCURRENCY = 2;

const sha256 = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8').digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const safeText = (value, max = 160) => typeof value === 'string' ? value.slice(0, max) : null;
const nowIso = () => new Date().toISOString();

const TENDER_SOURCE_FILES = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});

function relative(file) {
  return path.relative(REPO, file).replaceAll('\\', '/');
}

function percentile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] : null;
}

function safeErrorAudit(error) {
  return safeProbeAudit({
    ...(error?.audit || {}),
    ...(error?.audit?.probe_diagnostics || {})
  });
}

export function classifyFixed48Failure(error, audit = {}) {
  const gatewayStatus = Number(audit.gateway_http_status || error?.audit?.gateway_http_status || 0);
  const providerStatus = Number(audit.provider_http_status || error?.audit?.provider_http_status || 0);
  const code = String(error?.code || audit.provider_error_code || audit.gateway_error_code || '').toUpperCase();
  const transientCode = /TIMEOUT|NETWORK|ECONNRESET|CONNECTION_RESET|EAI_AGAIN|502|503|504/.test(code);
  const transientStatus = [502, 503, 504].includes(gatewayStatus) || [502, 503, 504].includes(providerStatus);
  const retryable = transientCode || transientStatus;
  if (retryable) return { classification: 'TRANSIENT_NETWORK', retryable: true, code: safeText(error?.code || audit.provider_error_code || audit.gateway_error_code || 'TRANSIENT_NETWORK', 120) };
  if (gatewayStatus >= 400 || providerStatus >= 400) {
    return { classification: providerStatus >= 500 || gatewayStatus >= 500 ? 'PROVIDER_OR_GATEWAY_5XX' : 'PROVIDER_OR_GATEWAY_4XX', retryable: false, code: safeText(error?.code || audit.provider_error_code || audit.gateway_error_code || `HTTP_${providerStatus || gatewayStatus}`, 120) };
  }
  return { classification: safeText(error?.code || audit.safe_error_code || 'RUNTIME_FAILURE', 120), retryable: false, code: safeText(error?.code || audit.safe_error_code || 'RUNTIME_FAILURE', 120) };
}

export function buildFrozenCaseIdentity({ frozen = readJson(FROZEN_INPUT_PATH), preparedByTender } = {}) {
  if (frozen.task_type !== TASK || frozen.frozen_case_count !== FIRST_ATTEMPT_CASES || !Array.isArray(frozen.cases) || frozen.cases.length !== FIRST_ATTEMPT_CASES) {
    throw Object.assign(new Error('FIXED48_FROZEN_INPUT_INVALID'), { code: 'FIXED48_FROZEN_INPUT_INVALID' });
  }
  if (!preparedByTender || typeof preparedByTender.get !== 'function') {
    throw Object.assign(new Error('FIXED48_PREPARED_INPUT_REQUIRED'), { code: 'FIXED48_PREPARED_INPUT_REQUIRED' });
  }
  const sourceMap = frozen.source_identity_parity?.source_sha256_by_tender || {};
  const cases = frozen.cases.map(row => {
    const prepared = preparedByTender.get(row.tender_id);
    const chunk = prepared?.chunks?.find(item => item.chunk_number === row.chunk_number);
    const input = chunk ? resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text }) : null;
    const inputHash = input == null ? null : sha256(input);
    const sourceHash = prepared?.source_sha256 || null;
    const inputMatch = inputHash === row.input_sha256;
    const sourceMatch = sourceHash === sourceMap[row.tender_id];
    if (!prepared || !chunk || !inputMatch || !sourceMatch) {
      throw Object.assign(new Error('FIXED48_INPUT_SHA256_MISMATCH'), {
        code: 'FIXED48_INPUT_SHA256_MISMATCH',
        case_id: row.case_id,
        tender_id: row.tender_id,
        chunk_number: row.chunk_number,
        input_match: inputMatch,
        source_match: sourceMatch
      });
    }
    return Object.freeze({
      case_id: row.case_id,
      case_index: row.case_index,
      tender_id: row.tender_id,
      chunk_number: row.chunk_number,
      input_sha256: row.input_sha256,
      source_sha256: sourceHash,
      input,
      prepared,
      chunk
    });
  });
  return { cases, frozen_source_artifact: frozen.frozen_source_artifact || relative(FROZEN_INPUT_PATH), source_sha256_by_tender: sourceMap };
}

function classifyRuntimeStatus(result, evaluation, error) {
  if (error) return 'FAILED_RUNTIME';
  if (!result) return 'FAILED_RUNTIME';
  if (evaluation?.source_resolution_success === false) return 'REVIEW_REQUIRED_SOURCE_RESOLUTION';
  if (evaluation?.canonicalization_success === false) return 'REVIEW_REQUIRED_CANONICALIZATION';
  if (evaluation?.quality_gate_decision !== 'PASS') return 'REVIEW_REQUIRED_QUALITY_GATE';
  return 'PASS';
}

function safeCaseTelemetry({ item, runId, startedAt, endedAt, attempt, retryCount, result, error, audit, evaluation, providerReached }) {
  return {
    run_id: runId,
    case_id: item.case_id,
    case_index: item.case_index,
    tender_id: item.tender_id,
    chunk_number: item.chunk_number,
    input_sha256: item.input_sha256,
    source_sha256: item.source_sha256,
    provider_reached: providerReached === true,
    provider_http_status: audit.provider_http_status,
    gateway_http_status: audit.gateway_http_status,
    schema_valid: Boolean(result),
    candidate_count: Array.isArray(result?.candidates) ? result.candidates.length : null,
    source_resolution_pass_count: evaluation?.source_resolution_success === true ? 1 : 0,
    source_resolution_failure_code: evaluation?.source_resolution_failure_code || null,
    canonicalization_pass_count: evaluation?.canonicalization_success === true ? 1 : 0,
    canonicalization_failure_code: evaluation?.canonicalization_failure_code || null,
    quality_gate_decision: evaluation?.quality_gate_decision || null,
    quality_gate_reason_codes: evaluation?.quality_gate_reason_codes || [],
    truncation: audit.output_truncated === true,
    retry_count: retryCount,
    attempt,
    latency_ms: endedAt - startedAt,
    finish_reason: audit.finish_reason,
    prompt_tokens: audit.prompt_tokens,
    completion_tokens: audit.completion_tokens,
    total_tokens: audit.total_tokens,
    provider_model: audit.response_model || 'PROVIDER_NOT_EXPOSED',
    final_case_status: classifyRuntimeStatus(result, evaluation, error),
    error_code: safeText(error?.code || audit.safe_error_code, 120),
    failure_class: error ? classifyFixed48Failure(error, audit).classification : null
  };
}

async function appendRetrySchedule(ledger, item, reason, nextAttempt) {
  await ledger.append({
    event: 'CASE_RETRY_SCHEDULED',
    case_id: item.case_id,
    case_index: item.case_index,
    input_sha256: item.input_sha256,
    source_sha256: item.source_sha256,
    state: 'FAILED_BEFORE_DISPATCH',
    attempt: nextAttempt,
    retry_reason: safeText(reason, 120)
  });
}

async function reserveAttempt(ledger, item) {
  const current = ledger.caseState(item.case_id);
  if (!current || !['PENDING', 'FAILED_BEFORE_DISPATCH'].includes(current.state)) {
    throw Object.assign(new Error('FIXED48_CASE_NOT_SAFE_TO_RESERVE'), { code: 'FIXED48_CASE_NOT_SAFE_TO_RESERVE' });
  }
  const used = ledger.reservedCallCount();
  if (used >= ledger.call_cap) throw Object.assign(new Error('FIXED48_CALL_CAP_REACHED'), { code: 'FIXED48_CALL_CAP_REACHED' });
  const attempt = Number(current.attempt || 0) + 1;
  await ledger.append({
    event: 'CALL_RESERVED',
    case_id: item.case_id,
    case_index: item.case_index,
    input_sha256: item.input_sha256,
    source_sha256: item.source_sha256,
    state: 'CALL_RESERVED',
    call_sequence: used + 1,
    attempt,
    provider_task: TASK
  });
  await ledger.markDispatched(item.case_id);
  return { attempt, call_sequence: used + 1 };
}

async function writeCheckpoint(file, checkpoint) {
  await writeFile(file, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

async function gatewayProbe(env) {
  const config = readSemanticGatewayRuntimeConfig(env);
  const base = String(config.gatewayApiBase || '').replace(/\/+$/, '');
  const safeGet = async endpoint => {
    if (!base) return { status: null, ok: false, body: null, error_code: 'GATEWAY_NOT_CONFIGURED' };
    try {
      const response = await fetch(`${base}/${endpoint}`, { method: 'GET' });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      return { status: response.status, ok: response.ok, body };
    } catch (error) {
      return { status: null, ok: false, body: null, error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' };
    }
  };
  const [ready, info] = await Promise.all([safeGet('ready'), safeGet('info')]);
  return {
    ready_http_status: ready.status,
    ready_ok: ready.ok,
    gateway_provider_family: safeText(ready.body?.provider, 120),
    provider_configured: ready.body?.provider_configured === true,
    info_http_status: info.status,
    info_ok: info.ok,
    task_registry_loaded: info.body?.task_registry_loaded === true,
    local_config_provider: config.provider,
    local_config_model: config.model,
    local_config_gateway_host: (() => { try { return new URL(config.gatewayApiBase).hostname; } catch { return null; } })(),
    provider_identity_status: 'ACTUAL_REQUEST_REQUIRED',
    sensitive_values_logged: false
  };
}

export async function runFixed48LiveCertification({ env = loadBackendEnvironment(), runId = null, rootDir = REPO, frozen = readJson(FROZEN_INPUT_PATH), dispatchOverride = null } = {}) {
  const preparedByTender = new Map();
  for (const tenderId of TENDER_IDS) preparedByTender.set(tenderId, await prepareTender(tenderId, env));
  const identity = buildFrozenCaseIdentity({ frozen, preparedByTender });
  const generatedRunId = runId || `req-fixed48-live-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = path.join(rootDir, 'backend/eval/requirement-production-quality-gate/results', generatedRunId);
  await mkdir(runDir, { recursive: true });
  const ledger = new Fixed48RunLedger({ file_path: path.join(runDir, 'ledger.jsonl'), run_id: generatedRunId, case_count: FIRST_ATTEMPT_CASES, call_cap: TOTAL_CALL_CAP });
  await ledger.load();
  await ledger.registerCases(identity.cases);
  await ledger.recoverStaleCalls();
  const probe = await gatewayProbe(env);
  const preflight = {
    artifact_type: 'V43_REQUIREMENT_FIXED48_LIVE_CERTIFICATION_PREFLIGHT',
    artifact_version: 'v1',
    run_id: generatedRunId,
    task_type: TASK,
    fixed48_cases: identity.cases.length,
    input_sha256_match: identity.cases.length,
    source_sha256_match_tenders: TENDER_IDS.length,
    input_identity_status: 'PASS',
    source_identity_status: 'PASS',
    concurrency: CONCURRENCY,
    first_attempt_cases: FIRST_ATTEMPT_CASES,
    transient_retry_budget: TRANSIENT_RETRY_BUDGET,
    total_provider_call_cap: TOTAL_CALL_CAP,
    gateway_probe: probe,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    historical_run_reused: false,
    historical_artifact_appended: false,
    frozen_input_artifact: relative(FROZEN_INPUT_PATH),
    source_files: Object.fromEntries(TENDER_IDS.map(id => [id, TENDER_SOURCE_FILES[id]]))
  };
  await writeCheckpoint(path.join(runDir, 'preflight.json'), preflight);

  const gateway = createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: TASK }));
  const telemetry = new Map();
  const startedAt = Date.now();
  const mutex = { tail: Promise.resolve() };
  const withLedger = async fn => {
    const previous = mutex.tail;
    let release;
    mutex.tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  };
  let cursor = 0;
  let halted = false;
  const dispatch = dispatchOverride || ((item) => gateway.extract({
    fileName: item.prepared.source_file,
    text: item.input,
    paragraphs: item.chunk.segments,
    chunk: item.chunk,
    projectName: item.prepared.title,
    sectionName: item.tender_id,
    chunkCount: item.prepared.chunk_count,
    diagnosticMode: 'probe-v1'
  }));

  const worker = async () => {
    while (true) {
      if (halted) return;
      const index = cursor++;
      if (index >= identity.cases.length) return;
      const item = identity.cases[index];
      let retryCount = 0;
      let finalTelemetry = null;
      while (!halted) {
        const reservation = await withLedger(() => reserveAttempt(ledger, item));
        const attemptStarted = Date.now();
        let result = null;
        let error = null;
        try {
          result = await dispatch(item);
        } catch (caught) {
          error = caught;
        }
        const audit = safeProbeAudit({
          ...(result?.audit || error?.audit || {}),
          ...(result?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || {})
        });
        const evaluation = result ? evaluateCandidatePayload({ candidates: result.candidates, chunk: item.chunk, qualityGate: true }) : null;
        const providerReached = audit.provider_adapter_invoked === true && audit.fetch_invoked === true && audit.provider_http_reached === true;
        finalTelemetry = safeCaseTelemetry({
          item,
          runId: generatedRunId,
          startedAt: attemptStarted,
          endedAt: Date.now(),
          attempt: reservation.attempt,
          retryCount,
          result,
          error,
          audit,
          evaluation,
          providerReached
        });
        if (error) {
          const failure = classifyFixed48Failure(error, audit);
          if (failure.retryable && retryCount < TRANSIENT_RETRY_BUDGET && ledger.reservedCallCount() < TOTAL_CALL_CAP) {
            await withLedger(async () => {
              await ledger.recordProviderReturned(item.case_id, { http_status: audit.gateway_http_status || audit.provider_http_status, error_code: failure.code, duration_ms: finalTelemetry.latency_ms });
              await appendRetrySchedule(ledger, item, failure.code, reservation.attempt + 1);
            });
            retryCount += 1;
            continue;
          }
          await withLedger(async () => {
            await ledger.recordProviderReturned(item.case_id, { http_status: audit.gateway_http_status || audit.provider_http_status, error_code: failure.code, duration_ms: finalTelemetry.latency_ms });
            await ledger.finalizeCase(item.case_id, { http_status: audit.gateway_http_status || audit.provider_http_status, error_code: failure.code, duration_ms: finalTelemetry.latency_ms });
          });
          telemetry.set(item.case_id, finalTelemetry);
          if (failure.classification === 'PROVIDER_OR_GATEWAY_4XX' || failure.classification === 'PROVIDER_OR_GATEWAY_5XX' || failure.classification === 'TRANSIENT_NETWORK') halted = true;
          break;
        }
        await withLedger(async () => {
          await ledger.recordProviderReturned(item.case_id, {
            http_status: audit.gateway_http_status || audit.provider_http_status,
            schema_pass: Boolean(result),
            source_resolution_pass: evaluation?.source_resolution_success === true,
            source_resolution_failure_code: evaluation?.source_resolution_failure_code,
            canonicalization_pass: evaluation?.canonicalization_success === true,
            canonicalization_failure_code: evaluation?.canonicalization_failure_code,
            quality_gate_decision: evaluation?.quality_gate_decision,
            candidate_count: Array.isArray(result?.candidates) ? result.candidates.length : null,
            duration_ms: finalTelemetry.latency_ms,
            finish_reason: audit.finish_reason,
            prompt_tokens: audit.prompt_tokens,
            completion_tokens: audit.completion_tokens,
            total_tokens: audit.total_tokens
          });
          await ledger.finalizeCase(item.case_id);
        });
        telemetry.set(item.case_id, finalTelemetry);
        break;
      }
      const checkpoint = buildLiveCheckpoint({ generatedRunId, preflight, ledger, telemetry, startedAt, halted });
      await writeCheckpoint(path.join(runDir, 'checkpoint.json'), checkpoint);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const checkpoint = buildLiveCheckpoint({ generatedRunId, preflight, ledger, telemetry, startedAt, halted });
  await writeCheckpoint(path.join(runDir, 'checkpoint.json'), checkpoint);
  return { run_id: generatedRunId, run_dir: relative(runDir), preflight, checkpoint, telemetry: [...telemetry.values()], ledger: ledger.summary() };
}

function buildLiveCheckpoint({ generatedRunId, preflight, ledger, telemetry, startedAt, halted }) {
  const rows = [...telemetry.values()];
  const durations = rows.map(row => row.latency_ms);
  const finalized = ledger.summary().cases_completed;
  const schemaValid = rows.filter(row => row.schema_valid).length;
  const retries = rows.reduce((sum, row) => sum + row.retry_count, 0);
  const sourceFailures = rows.filter(row => row.source_resolution_failure_code).length;
  const canonicalFailures = rows.filter(row => row.canonicalization_failure_code).length;
  const runtimeFailures = rows.filter(row => row.final_case_status === 'FAILED_RUNTIME').length;
  const truncation = rows.filter(row => row.truncation).length;
  const providerModels = [...new Set(rows.map(row => row.provider_model).filter(Boolean))];
  const pass = finalized === FIRST_ATTEMPT_CASES
    && rows.length === FIRST_ATTEMPT_CASES
    && schemaValid === FIRST_ATTEMPT_CASES
    && truncation === 0
    && sourceFailures === 0
    && canonicalFailures === 0
    && runtimeFailures === 0
    && ledger.summary().provider_calls <= TOTAL_CALL_CAP;
  return {
    checkpoint: 'V43_REQUIREMENT_FIXED48_LIVE_CERTIFICATION_CHECKPOINT',
    artifact_version: 'v1',
    run_id: generatedRunId,
    generated_at: nowIso(),
    fixed48_cases: FIRST_ATTEMPT_CASES,
    finalized_cases: finalized,
    provider_calls: ledger.summary().provider_calls,
    retries,
    retry_rate: ledger.summary().provider_calls ? retries / ledger.summary().provider_calls : 0,
    schema_valid_rate: rows.length ? schemaValid / rows.length : 0,
    truncation_count: truncation,
    unexplained_source_failures: sourceFailures,
    unexplained_canonicalization_failures: canonicalFailures,
    unexplained_runtime_failures: runtimeFailures,
    latency_p50_ms: percentile(durations, 0.5),
    latency_p95_ms: percentile(durations, 0.95),
    projected_100_page_tender_c2: percentile(durations, 0.95) == null ? 'NOT_COMPUTED' : Math.ceil((100 * percentile(durations, 0.95)) / (CONCURRENCY * 8 * 1000)),
    substantive_recall: 'NOT_AVAILABLE_PENDING_INDEPENDENT_ADJUDICATION',
    mandatory_critical_recall: 'NOT_AVAILABLE_PENDING_INDEPENDENT_ADJUDICATION',
    canonical_precision: 'NOT_AVAILABLE_PENDING_INDEPENDENT_ADJUDICATION',
    semantic_fidelity: 'NOT_AVAILABLE_PENDING_INDEPENDENT_ADJUDICATION',
    atomic_or_intentionally_grouped: 'NOT_AVAILABLE_PENDING_INDEPENDENT_ADJUDICATION',
    actionable_human_review_rate: rows.length ? rows.filter(row => row.final_case_status !== 'PASS').length / rows.length : null,
    p0_detected: 'NOT_MEASURED_FIXED48_RUNTIME',
    p0_review_routed: 'NOT_MEASURED_FIXED48_RUNTIME',
    p0_escape: 'NOT_MEASURED_FIXED48_RUNTIME',
    provider_identity: {
      gateway_provider_family: preflight.gateway_probe.gateway_provider_family,
      actual_provider_reached: rows.some(row => row.provider_reached),
      actual_model_id: providerModels.length === 1 ? providerModels[0] : providerModels,
      identity_status: providerModels.includes('PROVIDER_NOT_EXPOSED') ? 'CONDITIONAL_PROVIDER_IDENTITY' : 'OBSERVED'
    },
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    halted,
    final_status: pass ? 'PASS' : (halted ? 'FAIL_STOPPED' : 'CONDITIONAL_OR_FAIL'),
    live_gate: {
      all_cases_finalized: finalized === FIRST_ATTEMPT_CASES,
      schema_valid_100_percent: schemaValid === FIRST_ATTEMPT_CASES,
      truncation_zero: truncation === 0,
      unexplained_source_failures_zero: sourceFailures === 0,
      unexplained_canonicalization_failures_zero: canonicalFailures === 0,
      unexplained_runtime_failures_zero: runtimeFailures === 0,
      provider_call_cap_respected: ledger.summary().provider_calls <= TOTAL_CALL_CAP,
      retry_rate_lte_10_percent: (ledger.summary().provider_calls ? retries / ledger.summary().provider_calls : 0) <= 0.1,
      p0_escape_zero: 'NOT_MEASURED_FIXED48_RUNTIME'
    },
    run_ledger_summary: ledger.summary(),
    telemetry_case_count: rows.length,
    started_at_ms: startedAt,
    side_effects: { provider_calls: ledger.summary().provider_calls, production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runFixed48LiveCertification().then(result => {
    process.stdout.write(`${JSON.stringify({ run_id: result.run_id, run_dir: result.run_dir, preflight: result.preflight, checkpoint: result.checkpoint }, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${JSON.stringify({ error_code: error?.code || 'FIXED48_LIVE_CERTIFICATION_FAILED', case_id: error?.case_id || null, message: safeText(error?.message, 240) }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
