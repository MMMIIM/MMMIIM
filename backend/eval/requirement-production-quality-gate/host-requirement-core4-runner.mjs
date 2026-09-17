/**
 * Human-host-only Requirement live runner.
 *
 * This file is deliberately an Eval-only orchestration layer.  It reuses the
 * production parser, scope router, chunker and Requirement Gateway adapter;
 * it never writes business state.  It refuses to dispatch unless the caller
 * explicitly sets V43_REQUIREMENT_HOST_LIVE=true on the Human host.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  createRequirementExtractionGateway,
  buildRequirementExtractionPayload,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { prepareTender } from '../requirement-semantic-quality-v1/runner.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const TASK = 'requirement_extraction';
const TARGETS = Object.freeze([
  Object.freeze({ tender_id: 'JY-001', chunk_number: 23 }),
  Object.freeze({ tender_id: 'FAST-01', chunk_number: 5 })
]);
const OUTPUT_ROOT = path.join(REPO, 'backend/eval/requirement-production-quality-gate/results');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();

function safeText(value, limit = 240) {
  return typeof value === 'string' ? value.slice(0, limit) : null;
}

function safeAudit(value = {}) {
  const probe = value && typeof value === 'object' ? value : {};
  return {
    gateway_http_status: Number.isInteger(probe.gateway_http_status) ? probe.gateway_http_status : null,
    provider_http_status: Number.isInteger(probe.provider_http_status) ? probe.provider_http_status : null,
    provider_http_reached: probe.provider_http_reached === true,
    provider_adapter_invoked: probe.provider_adapter_invoked === true,
    fetch_invoked: probe.fetch_invoked === true,
    gateway_error_code: safeText(probe.gateway_error_code, 120),
    provider_error_code: safeText(probe.provider_error_code, 120),
    semantic_error_code: safeText(probe.semantic_error_code, 120),
    finish_reason: safeText(probe.finish_reason, 40),
    response_model: safeText(probe.response_model, 120),
    response_format_type: safeText(probe.response_format_type, 40),
    instruction_sha256: /^[a-f0-9]{64}$/i.test(String(probe.instruction_sha256 || '')) ? probe.instruction_sha256 : null,
    json_parse_success: typeof probe.json_parse_success === 'boolean' ? probe.json_parse_success : null,
    schema_validation_errors: Array.isArray(probe.schema_validation_errors)
      ? probe.schema_validation_errors.slice(0, 20).map(error => ({
        path: safeText(error?.path, 200), keyword: safeText(error?.keyword, 80),
        expected: safeText(error?.expected, 240), actual_type: safeText(error?.actual_type, 80)
      })) : [],
    output_truncated: probe.output_truncated === true,
    prompt_tokens: Number.isInteger(probe.prompt_tokens) ? probe.prompt_tokens : null,
    completion_tokens: Number.isInteger(probe.completion_tokens) ? probe.completion_tokens : null
  };
}

function retryable(error, audit) {
  const code = String(error?.code || audit?.gateway_error_code || audit?.provider_error_code || '');
  return new Set([
    'GATEWAY_TIMEOUT', 'PROVIDER_TIMEOUT', 'GATEWAY_NETWORK_ERROR',
    'PROVIDER_NETWORK_ERROR', 'GATEWAY_HTTP_ERROR', 'PROVIDER_HTTP_FAILURE'
  ]).has(code);
}

function safeGet(url, timeoutMs = 8000) {
  return (async () => {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      return { status: response.status, ok: response.ok, latency_ms: Date.now() - started, body };
    } catch (error) {
      return { status: null, ok: false, latency_ms: Date.now() - started,
        error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' };
    } finally { clearTimeout(timer); }
  })();
}

async function preflight(env) {
  const config = readSemanticGatewayRuntimeConfig(env);
  if (!config.gatewayApiBase || !config.serviceApiKey) {
    return { ok: false, reason: 'GATEWAY_CLIENT_NOT_CONFIGURED', gateway_base_present: Boolean(config.gatewayApiBase), service_key_present: Boolean(config.serviceApiKey) };
  }
  const [ready, info] = await Promise.all([
    safeGet(`${config.gatewayApiBase.replace(/\/+$/, '')}/ready`),
    safeGet(`${config.gatewayApiBase.replace(/\/+$/, '')}/info`)
  ]);
  return {
    ok: ready.ok && info.ok,
    ready: { status: ready.status, ok: ready.ok, latency_ms: ready.latency_ms },
    info: {
      status: info.status, ok: info.ok, latency_ms: info.latency_ms,
      build_revision: safeText(info.body?.build_revision, 160),
      task_registry_loaded: info.body?.task_registry_loaded === true,
      task_type_registered: Array.isArray(info.body?.task_types) && info.body.task_types.includes(TASK),
      requirement_contract_version: safeText(info.body?.requirement_extraction_contract_version, 120),
      requirement_prompt_hash: /^[a-f0-9]{64}$/i.test(String(info.body?.requirement_extraction_prompt_hash || ''))
        ? info.body.requirement_extraction_prompt_hash : null
    }
  };
}

function projectCanonicalCandidates(candidates, chunk) {
  const resolver = new SourceLocationResolver();
  const resolved = [];
  const sourceResolution = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      const location = resolver.resolve(candidate, chunk).location;
      const projected = { ...candidate, ...location };
      resolved.push(projected);
      sourceResolution.push({ candidate_index: index + 1, status: 'verified', source_refs: location.source_refs });
    } catch (error) {
      sourceResolution.push({ candidate_index: index + 1, status: 'failed', error_code: error?.code || 'SOURCE_LOCATION_UNRESOLVED' });
    }
  }
  const failedResolution = sourceResolution.find(row => row.status !== 'verified');
  if (failedResolution) {
    return {
      source_resolution: sourceResolution,
      canonicalization: {
        status: 'BLOCKED_SOURCE_RESOLUTION',
        error: { code: failedResolution.error_code || 'SOURCE_LOCATION_UNRESOLVED', candidate_index: failedResolution.candidate_index },
        count: 0
      },
      canonicals: []
    };
  }
  let canonicals = [];
  let canonicalError = null;
  try {
    canonicals = buildCanonicalRequirements(resolved.map((candidate, index) => ({
      ...candidate,
      candidate_index: index + 1
    })), { qualityGate: true });
  } catch (error) {
    canonicalError = { code: error?.code || 'CANONICALIZATION_FAILED', message: safeText(error?.message, 240) };
  }
  return {
    source_resolution: sourceResolution,
    canonicalization: { status: canonicalError ? 'FAIL' : 'PASS', error: canonicalError, count: canonicals.length },
    canonicals
  };
}

async function dispatchCase(gateway, item, chunk, state) {
  const providerInput = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
  const transportPayload = buildRequirementExtractionPayload({
    projectName: item.title,
    sectionName: item.tender_id,
    chunkIndex: chunk.chunk_number,
    chunkCount: item.chunk_count,
    chunkText: providerInput
  });
  const base = {
    case_id: `${item.tender_id}-CHUNK-${String(chunk.chunk_number).padStart(2, '0')}`,
    tender_id: item.tender_id,
    chunk_number: chunk.chunk_number,
    source_file: item.source_file,
    source_sha256: item.source_sha256,
    source_refs: chunk.segments.map(segment => segment.source_ref),
    section_identity: [...new Set(chunk.segments.map(segment => segment.source_section).filter(Boolean))],
    source_clause_ids: [...new Set(chunk.segments.map(segment => segment.source_clause_id).filter(Boolean))],
    provider_input: providerInput,
    provider_input_sha256: sha256(providerInput),
    transport_payload: transportPayload,
    started_at: now(),
    attempts: []
  };
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (state.calls >= 3) break;
    state.calls += 1;
    const started = Date.now();
    let response = null;
    let error = null;
    try {
      response = await gateway.extract({
        fileName: item.source_file, text: providerInput, paragraphs: chunk.segments,
        chunk, projectName: item.title, sectionName: item.tender_id,
        chunkCount: item.chunk_count, diagnosticMode: 'probe-v1'
      });
    } catch (caught) { error = caught; lastError = caught; }
    const audit = safeAudit(response?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || {});
    const attemptRecord = {
      attempt: attempt + 1, started_at: new Date(started).toISOString(),
      finished_at: now(), duration_ms: Date.now() - started,
      status: response ? 'RESPONSE_RECEIVED' : 'FAILED', audit,
      error_code: error?.code || null
    };
    base.attempts.push(attemptRecord);
    if (response) {
      const projected = projectCanonicalCandidates(response.candidates, chunk);
      return {
        ...base,
        finished_at: now(),
        status: projected.canonicalization.status === 'PASS' ? 'PASS' : 'CANONICALIZATION_FAILED',
        candidates: response.candidates,
        candidate_count: response.candidates.length,
        warnings: response.warnings,
        source_resolution: projected.source_resolution,
        canonicalization: projected.canonicalization,
        canonicals: projected.canonicals,
        quality_gate: projected.canonicalization.status === 'PASS' ? 'EVALUATED' : 'BLOCKED',
        filter_events: [], dedup_events: [], source_fidelity: projected.source_resolution
          .filter(row => row.status === 'verified').length / Math.max(1, response.candidates.length),
        provider_call_count: attempt + 1
      };
    }
    if (!retryable(error, audit) || attempt >= 1 || state.calls >= 3) break;
  }
  return {
    ...base, finished_at: now(), status: 'FAILED', candidates: [], candidate_count: 0,
    source_resolution: [], canonicalization: { status: 'NOT_RUN', error: { code: lastError?.code || 'PROVIDER_FAILURE' }, count: 0 },
    canonicals: [], quality_gate: 'NOT_RUN', filter_events: [], dedup_events: [], source_fidelity: null,
    provider_call_count: base.attempts.length, error_code: lastError?.code || 'PROVIDER_FAILURE'
  };
}

export async function runHostRequirementCore4({ env = process.env, allowLive = env.V43_REQUIREMENT_HOST_LIVE === 'true' } = {}) {
  if (!allowLive) return { status: 'BLOCKED_HOST_ONLY', provider_calls: 0, reason: 'Set V43_REQUIREMENT_HOST_LIVE=true on the Human host.' };
  loadBackendEnvironment({ env });
  const preflightResult = await preflight(env);
  if (!preflightResult.ok) return { status: 'BLOCKED_GATEWAY_PREFLIGHT', provider_calls: 0, preflight: preflightResult };
  const prepared = [];
  for (const target of TARGETS) {
    const item = await prepareTender(target.tender_id, env);
    const chunk = item.chunks.find(candidate => candidate.chunk_number === target.chunk_number);
    if (!chunk) throw Object.assign(new Error(`Target chunk not found: ${target.tender_id}/${target.chunk_number}`), { code: 'TARGET_CHUNK_NOT_FOUND' });
    prepared.push({ item, chunk });
  }
  const gateway = createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: TASK }));
  const state = { calls: 0 };
  const cases = [];
  for (const { item, chunk } of prepared) cases.push(await dispatchCase(gateway, item, chunk, state));
  const runId = `host-req-core4-${Date.now()}`;
  const outputDir = path.join(OUTPUT_ROOT, runId);
  fs.mkdirSync(outputDir, { recursive: true });
  const checkpoint = {
    checkpoint: 'V43_HOST_REQUIREMENT_CORE4_LIVE_CHECKPOINT', run_id: runId, generated_at: now(),
    targets: TARGETS, provider_calls: state.calls, retry_count: Math.max(0, state.calls - 2),
    cases: cases.map(row => ({ case_id: row.case_id, status: row.status, candidate_count: row.candidate_count,
      canonical_count: row.canonicals?.length || 0, attempts: row.attempts.length, error_code: row.error_code || null })),
    preflight: preflightResult, production_db_writes: 0, gold_mutations: 0,
    mapping_actions: 0, claim_actions: 0, writer_actions: 0
  };
  fs.writeFileSync(path.join(outputDir, 'case-telemetry.json'), `${JSON.stringify(cases, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  return { status: cases.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL', output_dir: outputDir, checkpoint };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runHostRequirementCore4().then(result => {
    console.log(JSON.stringify({ status: result.status, provider_calls: result.provider_calls || result.checkpoint?.provider_calls || 0, output_dir: result.output_dir || null }));
    if (result.status.startsWith('BLOCKED') || result.status === 'FAIL') process.exitCode = 1;
  }).catch(error => {
    console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'HOST_REQUIREMENT_RUNNER_FAILED' }));
    process.exitCode = 1;
  });
}
