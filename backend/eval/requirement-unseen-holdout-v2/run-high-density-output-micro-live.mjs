import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput,
  assertRequirementExtractionProviderInputParity
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { mapValidatedCandidatesToCanonicalInput } from '../../src/verification/requirement-extraction-verifier.js';
import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import {
  loadSemanticGatewayEnvironment,
  readSemanticGatewayRuntimeConfig
} from '../../../packages/semantic-contracts/runtime-config.js';
import {
  createStandaloneGatewayServer,
  gatewayConfigFromEnv
} from '../../../services/semantic-gateway/src/gateway.js';
import { OpenAICompatibleProvider } from '../../../services/semantic-gateway/src/provider/openai-compatible-provider.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const DOCS = resolve(REPO, 'docs');
const MANIFEST_PATH = resolve(HERE, 'work/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json');
const CHECKPOINT_JSON = resolve(DOCS, 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2.json');
const CHECKPOINT_MD = resolve(DOCS, 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2.md');
const GPT_PACKET = resolve(DOCS, 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_GPT_PACKET_V2.json');
const TARGET_TENDER = 'HOLDOUT-REQ-V2-01';
const TARGET_CHUNKS = Object.freeze([
  { chunk_number: 45, source_chunk_hash: '4e7b360135fc5e8f998e539c06cf022a7695346a961ba717fb073e8531892697' },
  { chunk_number: 6, source_chunk_hash: '4ca3bf0a278242a152e8318f5ae437f430a5cfd0bcce3514b8aa629978570b77' },
  { chunk_number: 14, source_chunk_hash: '01308fd8a1f60bfa5a679994cea9dae313aa45d79d9b609fcad32ae55e4f99d1' }
]);
const PRODUCTION_DEFAULT_MAX_TOKENS = 4800;
const MICRO_TEST_MAX_OUTPUT_TOKENS = 9600;
const CALL_CAP = 3;

const sha256 = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function json(value) {
  return JSON.stringify(value, null, 2);
}

function safeError(error) {
  return {
    name: typeof error?.name === 'string' ? error.name.slice(0, 100) : null,
    code: typeof error?.code === 'string' ? error.code.slice(0, 120) : null,
    message: typeof error?.message === 'string'
      ? error.message.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').slice(0, 240)
      : null
  };
}

function safeRawBody(value) {
  if (typeof value !== 'string') return null;
  return value;
}

function safeProviderAudit(audit) {
  if (!audit || typeof audit !== 'object') return null;
  return {
    provider: audit.provider || null,
    protocol: audit.protocol || null,
    model: audit.model || null,
    requested_provider: audit.requested_provider || null,
    requested_model: audit.requested_model || null,
    response_provider: audit.response_provider || null,
    response_model: audit.response_model || null,
    endpoint: audit.endpoint || null,
    http_status: Number.isInteger(audit.http_status) ? audit.http_status : null,
    latency_ms: Number.isInteger(audit.latency_ms) ? audit.latency_ms : null,
    provider_http_reached: audit.provider_http_reached === true,
    provider_adapter_invoked: audit.provider_adapter_invoked === true,
    fetch_invoked: audit.fetch_invoked === true,
    finish_reason: audit.finish_reason || null,
    prompt_tokens: Number.isInteger(audit.prompt_tokens) ? audit.prompt_tokens : null,
    completion_tokens: Number.isInteger(audit.completion_tokens) ? audit.completion_tokens : null,
    total_tokens: Number.isInteger(audit.total_tokens) ? audit.total_tokens : null,
    model_content_length_chars: Number.isInteger(audit.model_content_length_chars)
      ? audit.model_content_length_chars : null,
    output_truncated: audit.output_truncated === true,
    response_format_type: audit.response_format_type || null,
    generation_config: audit.generation_config ? clone(audit.generation_config) : null,
    outbound_prompt_diagnostics: audit.outbound_prompt_diagnostics
      ? clone(audit.outbound_prompt_diagnostics) : null,
    json_parse_success: audit.json_parse_success === true
      ? true : audit.json_parse_success === false ? false : null,
    json_parse_error_offset: Number.isInteger(audit.json_parse_error_offset)
      ? audit.json_parse_error_offset : null,
    model_content: typeof audit.model_content === 'string' ? audit.model_content : null,
    parsed_json: audit.parsed_json === undefined ? null : clone(audit.parsed_json),
    safe_error_code: audit.safe_error_code || null,
    safe_error_message: audit.safe_error_message || null,
    failure_stage: audit.failure_stage || null,
    current_stage: audit.current_stage || null
  };
}

function diagnosticFrom(value) {
  if (!value || typeof value !== 'object') return null;
  return value.probe_diagnostics && typeof value.probe_diagnostics === 'object'
    ? value.probe_diagnostics : value;
}

function sourceResolutionSummary(candidates, chunk) {
  const resolver = new SourceLocationResolver();
  const resolutions = [];
  const failures = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      const resolved = resolver.resolve(candidate, chunk);
      const location = resolved?.location || {};
      resolutions.push({
        candidate_index: index,
        source_range: clone(candidate.source_range),
        source_refs: Array.isArray(location.source_refs) ? [...location.source_refs] : [],
        source_verified: location.source_verified === true,
        source_match_type: location.source_match_type || null,
        source_page_start: location.source_page_start ?? null,
        source_page_end: location.source_page_end ?? null,
        source_start_offset: location.source_start_offset ?? null,
        source_end_offset: location.source_end_offset ?? null,
        source_text_hash: sha256(location.source_text || '')
      });
    } catch (error) {
      failures.push({ candidate_index: index, error: safeError(error) });
    }
  }
  return {
    resolutions,
    failures,
    pass: failures.length === 0 && resolutions.every(item => item.source_verified === true)
  };
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolvePromise(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('EVAL_GATEWAY_ADDRESS_UNAVAILABLE');
  return `http://127.0.0.1:${address.port}`;
}

function close(server) {
  return new Promise(resolvePromise => server.close(() => resolvePromise()));
}

async function main() {
  const runId = `requirement-high-density-output-micro-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const tender = manifest.tenders?.find(item => item.tender_id === TARGET_TENDER);
  if (!tender) throw new Error('HOLDOUT_TENDER_NOT_FOUND');
  const packet = {
    tender_id: tender.tender_id,
    title: tender.primary.project_name,
    source_file: tender.primary.path,
    source_file_sha256: tender.primary.sha256,
    windows: [],
    source_extraction: {
      selection: {
        type: 'controlled_paragraph_window',
        start_paragraph: 0,
        end_paragraph: Number.MAX_SAFE_INTEGER,
        title: 'FULL_DOCUMENT'
      }
    }
  };
  const backendEnv = loadBackendEnvironment({ env: {} });
  const gatewayEnvFile = resolve(REPO, 'services/semantic-gateway/.env');
  const gatewayEnv = loadSemanticGatewayEnvironment({ env: {}, envFile: gatewayEnvFile });
  const baselineRuntime = readSemanticGatewayRuntimeConfig(gatewayEnv);
  const configuredProvider = String(gatewayEnv.SEMANTIC_GATEWAY_PROVIDER || '');
  const configuredModel = String(gatewayEnv.SEMANTIC_GATEWAY_MODEL || '');
  const precheck = {
    production_default_max_output_tokens: PRODUCTION_DEFAULT_MAX_TOKENS,
    configured_max_output_tokens: Number(gatewayEnv.SEMANTIC_GATEWAY_MAX_TOKENS || 0),
    adapter_accepts_positive_integer_max_tokens: true,
    task_specific_override_in_production_gateway: false,
    isolated_eval_override: true,
    micro_test_max_output_tokens: MICRO_TEST_MAX_OUTPUT_TOKENS,
    configured_provider: configuredProvider,
    configured_model: configuredModel,
    provider_base_host: (() => { try { return new URL(baselineRuntime.providerApiBase).host; } catch { return null; } })(),
    endpoint_category: 'chat_completions',
    production_gateway_untouched: true
  };
  if (precheck.configured_max_output_tokens !== PRODUCTION_DEFAULT_MAX_TOKENS) {
    throw new Error('CONFIGURED_PRODUCTION_MAX_TOKENS_CHANGED_UNEXPECTEDLY');
  }
  if (MICRO_TEST_MAX_OUTPUT_TOKENS <= PRODUCTION_DEFAULT_MAX_TOKENS) {
    throw new Error('BLOCKED_NO_HIGHER_SUPPORTED_OUTPUT_BUDGET');
  }

  const prepared = await buildAnnotatedPath(packet, backendEnv);
  const selectedChunks = TARGET_CHUNKS.map(target => {
    const chunk = prepared.chunks.find(item => item.chunk_number === target.chunk_number);
    if (!chunk) throw new Error(`TARGET_CHUNK_NOT_FOUND_${target.chunk_number}`);
    const providerInput = assertRequirementExtractionProviderInputParity({
      chunk,
      fallbackText: chunk.text,
      actualInput: resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text })
    });
    const actualHash = sha256(providerInput);
    if (actualHash !== target.source_chunk_hash) {
      throw new Error(`TARGET_CHUNK_INPUT_HASH_MISMATCH_${target.chunk_number}`);
    }
    return {
      target,
      chunk,
      provider_input_sha256: actualHash,
      provider_input_char_count: providerInput.length,
      source_refs: chunk.segments.map(segment => segment.source_ref),
      source_ref_hash: sha256(JSON.stringify(chunk.segments.map(segment => segment.source_ref)))
    };
  });

  const evalEnv = {
    ...gatewayEnv,
    SEMANTIC_GATEWAY_MAX_TOKENS: String(MICRO_TEST_MAX_OUTPUT_TOKENS),
    SEMANTIC_GATEWAY_WORKTREE_DIRTY: 'true'
  };
  const rawProviderResponses = [];
  const captureFetch = async (url, options = {}) => {
    const response = await fetch(url, options);
    let rawBody = null;
    try { rawBody = await response.clone().text(); } catch (_error) { rawBody = null; }
    let pathname = null;
    try { pathname = new URL(url).pathname; } catch (_error) { pathname = null; }
    rawProviderResponses.push({
      endpoint: pathname,
      http_status: response.status,
      content_type: response.headers.get('content-type') || null,
      body_sha256: sha256(rawBody || ''),
      body_length_chars: typeof rawBody === 'string' ? rawBody.length : null,
      raw_body: safeRawBody(rawBody)
    });
    return response;
  };

  const baseConfig = gatewayConfigFromEnv(evalEnv);
  const baseProvider = baseConfig.provider;
  const evalProvider = new OpenAICompatibleProvider({
    baseUrl: baseProvider.baseUrl,
    apiKey: baseProvider.apiKey,
    model: baseProvider.model,
    timeoutMs: baseProvider.timeoutMs,
    fetchImpl: captureFetch,
    logger: { info() {}, warn() {} },
    generationConfig: baseProvider.generationConfig,
    endpointPath: baseProvider.endpointPath,
    protocol: baseProvider.protocol,
    providerName: baseProvider.providerName
  });
  const providerAudits = [];
  const originalInvoke = evalProvider.invoke.bind(evalProvider);
  evalProvider.invoke = async invocation => {
    try {
      const result = await originalInvoke(invocation);
      providerAudits.push(safeProviderAudit(result?.provider_audit));
      return result;
    } catch (error) {
      providerAudits.push(safeProviderAudit(error?.provider_audit));
      throw error;
    }
  };
  const evalConfig = {
    ...baseConfig,
    provider: evalProvider,
    taskProviders: { ...baseConfig.taskProviders }
  };
  const server = createStandaloneGatewayServer({
    env: evalEnv,
    config: evalConfig,
    logger: { info() {}, warn() {} }
  });
  const localBase = await listen(server);
  const clientEnv = {
    ...backendEnv,
    SEMANTIC_GATEWAY_API_BASE: localBase,
    SEMANTIC_GATEWAY_API_KEY: gatewayEnv.SEMANTIC_GATEWAY_API_KEY,
    V43_GATEWAY_API_BASE: localBase,
    V43_GATEWAY_API_KEY: gatewayEnv.SEMANTIC_GATEWAY_API_KEY,
    V43_GATEWAY_USER: backendEnv.V43_GATEWAY_USER || 'requirement-high-density-output-micro'
  };
  const client = createSemanticGatewayClientFromEnv({
    env: clientEnv,
    taskType: 'requirement_extraction',
    logger: { warn() {} }
  });
  const gateway = createRequirementExtractionGateway(client);
  const executions = [];
  let providerCalls = 0;
  let stoppedEarly = false;
  try {
    for (const selected of selectedChunks) {
      if (providerCalls >= CALL_CAP) throw new Error('PROVIDER_CALL_CAP_EXCEEDED');
      const chunk = selected.chunk;
      const providerInput = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
      const executionId = `${runId}-${chunk.chunk_number}-${randomUUID().slice(0, 8)}`;
      const startedAt = new Date().toISOString();
      const started = Date.now();
      const record = {
        case_id: TARGET_TENDER,
        chunk_number: chunk.chunk_number,
        execution_id: executionId,
        input: {
          tender_id: TARGET_TENDER,
          source_file_sha256: tender.primary.sha256,
          source_chunk_id: chunk.id,
          source_chunk_hash: selected.provider_input_sha256,
          source_ref_hash: selected.source_ref_hash,
          chunk_count: prepared.chunks.length,
          source_ref_count: selected.source_refs.length
        },
        execution_identity: {
          configured_provider: configuredProvider,
          configured_model: configuredModel,
          requested_provider: configuredProvider,
          requested_model: configuredModel,
          endpoint: '/chat/completions',
          response_format: 'json_schema',
          strict: true,
          enable_thinking: false,
          temperature: Number(evalEnv.SEMANTIC_GATEWAY_TEMPERATURE),
          top_p: Number(evalEnv.SEMANTIC_GATEWAY_TOP_P),
          top_k: Number(evalEnv.SEMANTIC_GATEWAY_TOP_K),
          max_output_tokens: MICRO_TEST_MAX_OUTPUT_TOKENS,
          only_changed_generation_field: 'max_output_tokens'
        },
        started_at: startedAt,
        status: null,
        provider_calls_before: providerCalls,
        provider_calls_after: null,
        provider_http_reached: null,
        provider_http_status: null,
        gateway_http_status: null,
        response_model: null,
        finish_reason: null,
        latency_ms: null,
        json_parse_success: null,
        schema_pass: false,
        source_resolution: null,
        candidate_count: 0,
        raw_output_chars: null,
        usage: null,
        provider_audit: null,
        raw_provider_response: null,
        parsed_candidates: [],
        error: null
      };
      try {
        providerCalls += 1;
        const gatewayResult = await gateway.extract({
          fileName: packet.source_file,
          text: providerInput,
          paragraphs: chunk.segments,
          chunk,
          projectName: packet.title,
          sectionName: packet.source_extraction.selection.title,
          chunkCount: prepared.chunks.length,
          diagnosticMode: 'probe-v1'
        });
        const audit = gatewayResult.audit || {};
        const diagnostic = diagnosticFrom(audit) || {};
        const sourceResolution = sourceResolutionSummary(gatewayResult.candidates, chunk);
        let canonicalization = { pass: false, count: 0, error: null };
        try {
          const resolved = sourceResolution.resolutions.map(item => ({
            location: {
              source_verified: item.source_verified,
              source_match_type: item.source_match_type,
              source_refs: item.source_refs,
              source_start_offset: item.source_start_offset,
              source_end_offset: item.source_end_offset
            }
          }));
          const canonical = mapValidatedCandidatesToCanonicalInput(gatewayResult.candidates, { resolutions: resolved });
          canonicalization = { pass: true, count: canonical.length, error: null };
        } catch (error) {
          canonicalization = { pass: false, count: 0, error: safeError(error) };
        }
        record.status = diagnostic.finish_reason === 'length' ? 'TRUNCATED' : 'PASS';
        record.provider_http_reached = diagnostic.provider_http_reached === true;
        record.provider_http_status = diagnostic.provider_http_status ?? null;
        record.gateway_http_status = diagnostic.gateway_http_status ?? 200;
        record.response_model = diagnostic.response_model || null;
        record.finish_reason = diagnostic.finish_reason || null;
        record.latency_ms = diagnostic.latency_ms ?? (Date.now() - started);
        record.json_parse_success = diagnostic.json_parse_success !== false;
        record.schema_pass = true;
        record.source_resolution = sourceResolution;
        record.candidate_count = gatewayResult.candidates.length;
        record.raw_output_chars = diagnostic.model_content_length_chars ?? null;
        record.usage = {
          prompt_tokens: diagnostic.prompt_tokens ?? null,
          completion_tokens: diagnostic.completion_tokens ?? null,
          total_tokens: diagnostic.total_tokens ?? null
        };
        record.provider_audit = safeProviderAudit(providerAudits.at(-1) || audit);
        record.raw_provider_response = rawProviderResponses.at(-1) || null;
        record.parsed_candidates = clone(gatewayResult.candidates);
        record.canonicalization = canonicalization;
        if (chunk.chunk_number === 45 && (
          record.finish_reason === 'length'
          || record.json_parse_success !== true
          || record.schema_pass !== true
          || record.source_resolution.pass !== true
        )) {
          stoppedEarly = true;
        }
      } catch (error) {
        const audit = error?.audit || {};
        const diagnostic = diagnosticFrom(audit) || {};
        record.status = diagnostic.finish_reason === 'length' || diagnostic.output_truncated === true
          ? 'TRUNCATED' : 'FAILED';
        record.provider_http_reached = diagnostic.provider_http_reached === true;
        record.provider_http_status = diagnostic.provider_http_status ?? null;
        record.gateway_http_status = diagnostic.gateway_http_status ?? null;
        record.response_model = diagnostic.response_model || null;
        record.finish_reason = diagnostic.finish_reason || null;
        record.latency_ms = diagnostic.latency_ms ?? (Date.now() - started);
        record.json_parse_success = diagnostic.json_parse_success === true ? true : false;
        record.raw_output_chars = diagnostic.model_content_length_chars ?? null;
        record.usage = {
          prompt_tokens: diagnostic.prompt_tokens ?? null,
          completion_tokens: diagnostic.completion_tokens ?? null,
          total_tokens: diagnostic.total_tokens ?? null
        };
        record.provider_audit = safeProviderAudit(providerAudits.at(-1) || audit);
        record.raw_provider_response = rawProviderResponses.at(-1) || null;
        record.error = safeError(error);
        if (chunk.chunk_number === 45) stoppedEarly = true;
      }
      record.provider_calls_after = providerCalls;
      record.finished_at = new Date().toISOString();
      executions.push(record);
      if (stoppedEarly) break;
    }
  } finally {
    await close(server);
  }

  const first = executions[0] || null;
  const allCompleted = executions.length === TARGET_CHUNKS.length;
  let finalStatus;
  if (!first) {
    finalStatus = 'BLOCKED_PROVIDER_CONNECTIVITY_RECURRENT';
  } else if (first.status === 'TRUNCATED' || first.finish_reason === 'length') {
    finalStatus = 'BLOCKED_HIGH_DENSITY_WINDOW_REQUIRES_BOUNDED_PARTITION_DECISION';
  } else if (first.status !== 'PASS' || first.schema_pass !== true || first.json_parse_success !== true || first.source_resolution?.pass !== true) {
    const providerStatus = first.provider_http_status;
    finalStatus = providerStatus != null && providerStatus >= 400
      ? `BLOCKED_PROVIDER_HTTP_${providerStatus}`
      : 'BLOCKED_PROVIDER_CONNECTIVITY_RECURRENT';
  } else if (!allCompleted) {
    finalStatus = 'BLOCKED_PROVIDER_CONNECTIVITY_RECURRENT';
  } else if (executions.some(item => item.status === 'TRUNCATED' || item.finish_reason === 'length')) {
    finalStatus = 'BLOCKED_HIGH_DENSITY_WINDOW_REQUIRES_BOUNDED_PARTITION_DECISION';
  } else {
    finalStatus = 'READY_FOR_GPT_REQUIREMENT_HIGH_DENSITY_OUTPUT_ADJUDICATION';
  }
  const packetOut = {
    artifact_type: 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_GPT_PACKET',
    run_id: runId,
    dataset: 'HOLDOUT-REQ-V2-01',
    execution_mode: 'TARGETED',
    decision: 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_BUDGET_MICRO_LIVE_PROOF',
    input_parity: {
      tender_id: TARGET_TENDER,
      source_file: packet.source_file,
      source_file_sha256: tender.primary.sha256,
      prepared_chunk_count: prepared.chunks.length,
      target_chunk_hashes: selectedChunks.map(item => ({ chunk_number: item.chunk.chunk_number, source_chunk_hash: item.provider_input_sha256 })),
      source_hashes_verified: selectedChunks.every(item => item.provider_input_sha256 === item.target.source_chunk_hash)
    },
    execution_identity: {
      provider: configuredProvider,
      model: configuredModel,
      endpoint: '/chat/completions',
      prompt_contract: '4.3-requirement-extraction-v3.1.1',
      prompt_instruction_hash: '9b8fe6582e774a64f36b2be307274e297fafb309cf17270a4d8fc463da817305',
      candidate_contract: '4.3-requirement-candidate-v3',
      candidate_schema_hash: '1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba',
      response_format: 'json_schema',
      strict: true,
      enable_thinking: false,
      production_default_max_output_tokens: PRODUCTION_DEFAULT_MAX_TOKENS,
      eval_max_output_tokens: MICRO_TEST_MAX_OUTPUT_TOKENS,
      override_scope: 'isolated_eval_standalone_gateway_only'
    },
    precheck,
    calls: executions,
    provider_calls: providerCalls,
    retries: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    production_routing_change: 0,
    complete_raw_provider_responses_retained: true,
    final_status: finalStatus
  };
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2',
    generated_at: new Date().toISOString(),
    run_id: runId,
    final_status: finalStatus,
    configured_provider: configuredProvider,
    configured_model: configuredModel,
    production_default_max_output_tokens: PRODUCTION_DEFAULT_MAX_TOKENS,
    eval_max_output_tokens: MICRO_TEST_MAX_OUTPUT_TOKENS,
    target_calls: TARGET_CHUNKS.length,
    provider_calls: providerCalls,
    retries: 0,
    calls_completed: executions.length,
    call_statuses: executions.map(item => ({ chunk_number: item.chunk_number, status: item.status, finish_reason: item.finish_reason })),
    first_failure: executions.find(item => item.status !== 'PASS') ? {
      chunk_number: executions.find(item => item.status !== 'PASS').chunk_number,
      status: executions.find(item => item.status !== 'PASS').status,
      error: executions.find(item => item.status !== 'PASS').error
    } : null,
    input_parity: packetOut.input_parity,
    production_gateway_untouched: true,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    production_routing_change: 0,
    provider_calls_capped: providerCalls <= CALL_CAP
  };
  const markdown = [
    '# V43 Requirement High-Density Output Micro Live Checkpoint V2',
    '',
    `- Final status: ${finalStatus}`,
    `- Run ID: ${runId}`,
    `- Provider: ${configuredProvider}`,
    `- Model: ${configuredModel}`,
    `- Production default max output tokens: ${PRODUCTION_DEFAULT_MAX_TOKENS}`,
    `- Isolated Eval max output tokens: ${MICRO_TEST_MAX_OUTPUT_TOKENS}`,
    `- Calls: ${providerCalls}/${CALL_CAP}; retries: 0`,
    `- Executions completed: ${executions.length}/${TARGET_CHUNKS.length}`,
    '',
    '## Per-call result',
    '',
    '| Chunk | Status | Finish reason | Provider HTTP | JSON parse | Schema | Source resolution | Latency ms | Candidates | Raw chars |',
    '| ---: | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: |',
    ...executions.map(item => `| ${item.chunk_number} | ${item.status} | ${item.finish_reason || 'null'} | ${item.provider_http_status ?? 'null'} | ${item.json_parse_success ? 'PASS' : 'FAIL'} | ${item.schema_pass ? 'PASS' : 'FAIL'} | ${item.source_resolution?.pass ? 'PASS' : item.source_resolution ? 'FAIL' : 'N/A'} | ${item.latency_ms ?? 'null'} | ${item.candidate_count} | ${item.raw_output_chars ?? 'null'} |`),
    '',
    '## Safety',
    '',
    '- Production DB writes: 0',
    '- Gold mutations: 0',
    '- Mapping/Claim/Writer actions: 0',
    '- Production routing change: 0',
    '- Production default configuration changed: no',
    ''
  ].join('\n');
  await mkdir(DOCS, { recursive: true });
  await writeFile(GPT_PACKET, `${json(packetOut)}\n`, 'utf8');
  await writeFile(CHECKPOINT_JSON, `${json(checkpoint)}\n`, 'utf8');
  await writeFile(CHECKPOINT_MD, `${markdown}\n`, 'utf8');
  console.log(JSON.stringify({
    final_status: finalStatus,
    run_id: runId,
    provider_calls: providerCalls,
    calls_completed: executions.length,
    statuses: executions.map(item => ({ chunk_number: item.chunk_number, status: item.status, finish_reason: item.finish_reason, provider_http_status: item.provider_http_status })),
    artifacts: [
      'docs/V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2.json',
      'docs/V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2.md',
      'docs/V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_GPT_PACKET_V2.json'
    ]
  }, null, 2));
}

main().catch(async error => {
  const failure = {
    checkpoint: 'V43_REQUIREMENT_HIGH_DENSITY_OUTPUT_MICRO_LIVE_CHECKPOINT_V2',
    generated_at: new Date().toISOString(),
    final_status: error?.message === 'BLOCKED_NO_HIGHER_SUPPORTED_OUTPUT_BUDGET'
      ? 'BLOCKED_NO_HIGHER_SUPPORTED_OUTPUT_BUDGET' : 'BLOCKED_PRECHECK_FAILURE',
    provider_calls: 0,
    retries: 0,
    error: safeError(error),
    production_db_writes: 0,
    gold_mutations: 0,
    production_gateway_untouched: true
  };
  await mkdir(DOCS, { recursive: true });
  await writeFile(CHECKPOINT_JSON, `${json(failure)}\n`, 'utf8');
  await writeFile(CHECKPOINT_MD, `# V43 Requirement High-Density Output Micro Live Checkpoint V2\n\n- Final status: ${failure.final_status}\n- Provider calls: 0\n- Error code: ${failure.error.code || 'PRECHECK_FAILURE'}\n- Error message: ${failure.error.message || 'precheck failed'}\n`, 'utf8');
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
});
