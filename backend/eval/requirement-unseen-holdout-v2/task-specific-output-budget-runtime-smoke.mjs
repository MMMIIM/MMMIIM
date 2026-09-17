import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  assertRequirementExtractionProviderInputParity,
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import {
  loadSemanticGatewayEnvironment,
  readSemanticGatewayRuntimeConfig
} from '../../../packages/semantic-contracts/runtime-config.js';
import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import {
  createStandaloneGatewayServer,
  gatewayConfigFromEnv
} from '../../../services/semantic-gateway/src/gateway.js';
import { OpenAICompatibleProvider } from '../../../services/semantic-gateway/src/provider/openai-compatible-provider.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const DOCS = resolve(REPO, 'docs');
const MANIFEST_PATH = resolve(HERE, 'work/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json');
const TARGET_TENDER = 'HOLDOUT-REQ-V2-01';
const TARGET_CHUNK_NUMBER = 45;
const TARGET_CHUNK_HASH = '4e7b360135fc5e8f998e539c06cf022a7695346a961ba717fb073e8531892697';
const EXPECTED_PROVIDER = 'openai_compatible';
const EXPECTED_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const EXPECTED_PROVIDER_HOST = 'api.siliconflow.cn';
const PRODUCTION_DEFAULT_MAX_TOKENS = 4800;
const TASK_MAX_TOKENS = 9600;
const RUN_ID = `requirement-task-budget-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const CHECKPOINT_JSON = resolve(DOCS, 'V43_REQUIREMENT_TASK_SPECIFIC_OUTPUT_BUDGET_RUNTIME_SMOKE_CHECKPOINT.json');
const CHECKPOINT_MD = resolve(DOCS, 'V43_REQUIREMENT_TASK_SPECIFIC_OUTPUT_BUDGET_RUNTIME_SMOKE_CHECKPOINT.md');
const PACKET_JSON = resolve(DOCS, 'V43_REQUIREMENT_TASK_SPECIFIC_OUTPUT_BUDGET_RUNTIME_SMOKE_PACKET.json');

const sha256 = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function safeString(value, max = 240) {
  return typeof value === 'string' && value.length ? value.slice(0, max) : null;
}

function safeError(error) {
  return {
    name: safeString(error?.name, 80),
    code: safeString(error?.code, 120),
    message: safeString(String(error?.message || '').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]'), 240)
  };
}

function urlHost(value) {
  try { return new URL(String(value || '')).hostname || null; } catch { return null; }
}

function diagnosticFrom(value) {
  if (!value || typeof value !== 'object') return {};
  return value.probe_diagnostics && typeof value.probe_diagnostics === 'object'
    ? value.probe_diagnostics : value;
}

function safeDiagnostic(value) {
  const d = diagnosticFrom(value);
  return {
    provider: safeString(d.provider, 80),
    configured_provider: safeString(d.configured_provider, 80),
    requested_provider: safeString(d.requested_provider, 80),
    response_provider: safeString(d.response_provider, 80),
    configured_model: safeString(d.configured_model, 160),
    requested_model: safeString(d.requested_model, 160),
    response_model: safeString(d.response_model, 160),
    endpoint: safeString(d.endpoint, 80),
    provider_http_reached: d.provider_http_reached === true,
    provider_http_status: Number.isInteger(d.provider_http_status) ? d.provider_http_status : null,
    gateway_http_status: Number.isInteger(d.gateway_http_status) ? d.gateway_http_status : null,
    json_parse_success: typeof d.json_parse_success === 'boolean' ? d.json_parse_success : null,
    schema_validation_pass: d.json_parse_success === true && !d.semantic_error_code && !d.gateway_error_code,
    finish_reason: safeString(d.finish_reason, 40),
    output_truncated: d.output_truncated === true,
    model_content_length_chars: Number.isInteger(d.model_content_length_chars) ? d.model_content_length_chars : null,
    latency_ms: Number.isInteger(d.latency_ms) ? d.latency_ms : null,
    configured_default_max_tokens: Number.isInteger(d.configured_default_max_tokens) ? d.configured_default_max_tokens : null,
    task_override_applied: d.task_override_applied === true,
    resolved_max_output_tokens: Number.isInteger(d.resolved_max_output_tokens) ? d.resolved_max_output_tokens : null,
    response_format_type: safeString(d.response_format_type, 40),
    generation_config: d.generation_config && typeof d.generation_config === 'object'
      ? {
        max_tokens: Number.isInteger(d.generation_config.max_tokens) ? d.generation_config.max_tokens : null,
        temperature: Number.isFinite(d.generation_config.temperature) ? d.generation_config.temperature : null,
        top_p: Number.isFinite(d.generation_config.top_p) ? d.generation_config.top_p : null,
        top_k: Number.isInteger(d.generation_config.top_k) ? d.generation_config.top_k : null,
        enable_thinking: d.generation_config.enable_thinking === true,
        response_format: d.generation_config.response_format?.type === 'json_schema'
          ? { type: 'json_schema', strict: d.generation_config.response_format.strict === true }
          : d.generation_config.response_format?.type === 'json_object' ? { type: 'json_object' } : null
      } : null,
    error_code: safeString(d.gateway_error_code || d.safe_error_code || d.provider_error_code, 120),
    failure_stage: safeString(d.failure_stage || d.current_stage, 100)
  };
}

function sourceResolutionSummary(candidates, chunk) {
  const resolver = new SourceLocationResolver();
  let passCount = 0;
  let failCount = 0;
  const sourceRefHashes = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    try {
      const resolved = resolver.resolve(candidate, chunk);
      const location = resolved?.location || {};
      const refs = Array.isArray(location.source_refs) ? location.source_refs : [];
      sourceRefHashes.push(sha256(JSON.stringify(refs)));
      if (location.source_verified === true) passCount += 1;
      else failCount += 1;
    } catch (_error) {
      failCount += 1;
    }
  }
  return {
    candidate_count: Array.isArray(candidates) ? candidates.length : 0,
    source_resolution_pass_count: passCount,
    source_resolution_fail_count: failCount,
    source_resolution_rate: (passCount + failCount) > 0 ? passCount / (passCount + failCount) : 1,
    source_resolution_pass: failCount === 0,
    source_ref_hashes: sourceRefHashes
  };
}

function listen(server) {
  return new Promise((resolvePromise, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolvePromise(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
}

function close(server) {
  return new Promise(resolvePromise => server.close(() => resolvePromise()));
}

function classifyFailure({ error, diagnostic, stage }) {
  const d = safeDiagnostic(diagnostic);
  if (d.finish_reason === 'length' || d.output_truncated) return 'BLOCKED_HIGH_DENSITY_WINDOW_REQUIRES_BOUNDED_PARTITION_DECISION';
  const code = d.error_code || error?.code || null;
  if (d.provider_http_status !== null && d.provider_http_status >= 400) return `BLOCKED_PROVIDER_HTTP_${d.provider_http_status}`;
  if (code === 'PROVIDER_TIMEOUT' || code === 'GATEWAY_TIMEOUT') return 'BLOCKED_PROVIDER_TIMEOUT';
  if (code === 'PROVIDER_NETWORK' || code === 'GATEWAY_NETWORK_ERROR') return 'BLOCKED_PROVIDER_NETWORK';
  if (stage === 'SOURCE_RESOLUTION') return 'BLOCKED_SOURCE_RESOLUTION';
  if (stage === 'SCHEMA_VALIDATION') return 'BLOCKED_SCHEMA_VALIDATION';
  if (stage === 'BUDGET') return 'BLOCKED_TASK_SPECIFIC_BUDGET_NOT_PROPAGATED';
  return `BLOCKED_${String(code || stage || 'RUNTIME_FAILURE').replace(/[^A-Za-z0-9_]+/g, '_')}`;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const tender = manifest.tenders?.find(item => item.tender_id === TARGET_TENDER);
  if (!tender) throw new Error('HOLDOUT_TENDER_NOT_FOUND');

  const backendEnv = loadBackendEnvironment({ env: {} });
  const gatewayEnvFile = resolve(REPO, 'services/semantic-gateway/.env');
  const gatewayEnv = loadSemanticGatewayEnvironment({ env: {}, envFile: gatewayEnvFile });
  const runtime = readSemanticGatewayRuntimeConfig(gatewayEnv);
  const configuredDefault = Number(gatewayEnv.SEMANTIC_GATEWAY_MAX_TOKENS || PRODUCTION_DEFAULT_MAX_TOKENS);
  const preflight = {
    provider: runtime.provider,
    model: runtime.model,
    provider_host: urlHost(runtime.providerApiBase),
    provider_key_present: Boolean(runtime.providerApiKey),
    service_key_present: Boolean(runtime.serviceApiKey),
    configured_default_max_output_tokens: configuredDefault,
    target_task: 'requirement_extraction',
    target_chunk: TARGET_CHUNK_NUMBER,
    provider_calls_authorized: 1,
    retries: 0,
    concurrency: 1
  };
  if (preflight.provider !== EXPECTED_PROVIDER) throw Object.assign(new Error('EXPECTED_PROVIDER_MISMATCH'), { code: 'EXPECTED_PROVIDER_MISMATCH' });
  if (preflight.model !== EXPECTED_MODEL) throw Object.assign(new Error('EXPECTED_MODEL_MISMATCH'), { code: 'EXPECTED_MODEL_MISMATCH' });
  if (preflight.provider_host !== EXPECTED_PROVIDER_HOST) throw Object.assign(new Error('EXPECTED_PROVIDER_HOST_MISMATCH'), { code: 'EXPECTED_PROVIDER_HOST_MISMATCH' });
  if (!preflight.provider_key_present || !preflight.service_key_present) throw Object.assign(new Error('PROVIDER_OR_GATEWAY_NOT_CONFIGURED'), { code: 'PROVIDER_UNAVAILABLE' });
  if (configuredDefault !== PRODUCTION_DEFAULT_MAX_TOKENS) throw Object.assign(new Error('SHARED_DEFAULT_MAX_TOKENS_CHANGED'), { code: 'SHARED_DEFAULT_MAX_TOKENS_CHANGED' });

  const packet = {
    tender_id: tender.tender_id,
    title: tender.primary.project_name,
    source_file: tender.primary.path,
    source_file_sha256: tender.primary.sha256,
    windows: [],
    source_extraction: {
      selection: { type: 'controlled_paragraph_window', start_paragraph: 0, end_paragraph: Number.MAX_SAFE_INTEGER, title: 'FULL_DOCUMENT' }
    }
  };
  const prepared = await buildAnnotatedPath(packet, backendEnv);
  const chunk = prepared.chunks.find(item => item.chunk_number === TARGET_CHUNK_NUMBER);
  if (!chunk) throw new Error('TARGET_CHUNK_NOT_FOUND');
  const providerInput = assertRequirementExtractionProviderInputParity({
    chunk,
    fallbackText: chunk.text,
    actualInput: resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text })
  });
  const providerInputHash = sha256(providerInput);
  if (providerInputHash !== TARGET_CHUNK_HASH) throw new Error('TARGET_CHUNK_INPUT_HASH_MISMATCH');

  const evalEnv = { ...gatewayEnv, SEMANTIC_GATEWAY_MAX_TOKENS: String(PRODUCTION_DEFAULT_MAX_TOKENS), SEMANTIC_GATEWAY_WORKTREE_DIRTY: 'true' };
  const baseConfig = gatewayConfigFromEnv(evalEnv);
  if (baseConfig.generationConfig.max_tokens !== PRODUCTION_DEFAULT_MAX_TOKENS) throw new Error('BASE_GENERATION_CONFIG_NOT_4800');
  const rawBodyMeta = { calls: 0, status: null, endpoint: null, body_sha256: null, body_length_chars: null, content_type: null };
  const captureFetch = async (url, options = {}) => {
    if (rawBodyMeta.calls >= 1) throw Object.assign(new Error('PROVIDER_CALL_CAP_EXCEEDED'), { code: 'PROVIDER_CALL_CAP_EXCEEDED' });
    rawBodyMeta.calls += 1;
    const response = await fetch(url, options);
    rawBodyMeta.status = response.status;
    rawBodyMeta.content_type = response.headers.get('content-type') || null;
    rawBodyMeta.endpoint = (() => { try { return new URL(url).pathname; } catch { return null; } })();
    try {
      const body = await response.clone().text();
      rawBodyMeta.body_sha256 = sha256(body);
      rawBodyMeta.body_length_chars = body.length;
    } catch (_error) {
      rawBodyMeta.body_sha256 = null;
      rawBodyMeta.body_length_chars = null;
    }
    return response;
  };
  const baseProvider = baseConfig.provider;
  const provider = new OpenAICompatibleProvider({
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
  const server = createStandaloneGatewayServer({
    env: evalEnv,
    config: { ...baseConfig, provider, taskProviders: { ...baseConfig.taskProviders } },
    logger: { info() {}, warn() {} }
  });
  await listen(server);
  const address = server.address();
  const localBase = `http://127.0.0.1:${address.port}`;
  let gatewayResult = null;
  let error = null;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const clientEnv = {
      ...backendEnv,
      SEMANTIC_GATEWAY_API_BASE: localBase,
      SEMANTIC_GATEWAY_API_KEY: gatewayEnv.SEMANTIC_GATEWAY_API_KEY,
      V43_GATEWAY_API_BASE: localBase,
      V43_GATEWAY_API_KEY: gatewayEnv.SEMANTIC_GATEWAY_API_KEY,
      V43_GATEWAY_USER: backendEnv.V43_GATEWAY_USER || 'requirement-task-budget-smoke'
    };
    const client = createSemanticGatewayClientFromEnv({ env: clientEnv, taskType: 'requirement_extraction', logger: { warn() {} } });
    const gateway = createRequirementExtractionGateway(client);
    gatewayResult = await gateway.extract({
      fileName: packet.source_file,
      text: providerInput,
      paragraphs: chunk.segments,
      chunk,
      projectName: packet.title,
      sectionName: packet.source_extraction.selection.title,
      chunkCount: prepared.chunks.length,
      diagnosticMode: 'probe-v1'
    });
  } catch (caught) {
    error = caught;
  } finally {
    await close(server);
  }

  const diagnostic = safeDiagnostic(error?.audit || gatewayResult?.audit || {});
  const sourceResolution = gatewayResult ? sourceResolutionSummary(gatewayResult.candidates, chunk) : null;
  const contract = getSemanticTaskContract('requirement_extraction');
  const instruction = getSemanticTaskInstructionMetadata('requirement_extraction');
  const resolvedBudget = diagnostic.resolved_max_output_tokens;
  let status = 'FAILED';
  let finalVerdict = null;
  if (error) {
    finalVerdict = classifyFailure({ error, diagnostic, stage: diagnostic.json_parse_success === false ? 'SCHEMA_VALIDATION' : 'PROVIDER' });
  } else if (resolvedBudget !== TASK_MAX_TOKENS || diagnostic.task_override_applied !== true) {
    finalVerdict = 'BLOCKED_TASK_SPECIFIC_BUDGET_NOT_PROPAGATED';
  } else if (rawBodyMeta.status !== 200 || diagnostic.provider_http_status !== 200) {
    finalVerdict = `BLOCKED_PROVIDER_HTTP_${rawBodyMeta.status ?? diagnostic.provider_http_status ?? 'UNKNOWN'}`;
  } else if (diagnostic.finish_reason === 'length' || diagnostic.output_truncated) {
    finalVerdict = 'BLOCKED_HIGH_DENSITY_WINDOW_REQUIRES_BOUNDED_PARTITION_DECISION';
  } else if (diagnostic.json_parse_success !== true) {
    finalVerdict = 'BLOCKED_JSON_PARSE_FAILURE';
  } else if (diagnostic.schema_validation_pass !== true) {
    finalVerdict = 'BLOCKED_SCHEMA_VALIDATION';
  } else if (!sourceResolution?.source_resolution_pass) {
    finalVerdict = 'BLOCKED_SOURCE_RESOLUTION';
  } else {
    status = 'PASS';
    finalVerdict = 'READY_FOR_GPT_REQUIREMENT_TASK_BUDGET_CLOSURE';
  }
  const checkpoint = {
    artifact_type: 'V43_REQUIREMENT_TASK_SPECIFIC_OUTPUT_BUDGET_RUNTIME_SMOKE_CHECKPOINT',
    run_id: RUN_ID,
    generated_at: new Date().toISOString(),
    status,
    final_verdict: finalVerdict,
    task: 'requirement_extraction',
    target: { tender_id: TARGET_TENDER, chunk_number: TARGET_CHUNK_NUMBER, source_file_sha256: tender.primary.sha256, source_chunk_hash: providerInputHash, source_ref_count: chunk.segments.length },
    provider: { category: EXPECTED_PROVIDER, host: EXPECTED_PROVIDER_HOST, model: EXPECTED_MODEL, endpoint: rawBodyMeta.endpoint || '/chat/completions', provider_calls: rawBodyMeta.calls, retries: 0, concurrency: 1 },
    generation: { shared_default_max_output_tokens: PRODUCTION_DEFAULT_MAX_TOKENS, resolved_max_output_tokens: resolvedBudget, task_override_applied: diagnostic.task_override_applied, eval_override_only: true },
    contract: { task_contract_version: contract.contract_version, instruction_hash: instruction.instruction_hash, candidate_schema_hash: sha256(JSON.stringify(contract.data_schema)), response_format: 'json_schema', strict: true },
    runtime: { provider: diagnostic.provider, configured_provider: diagnostic.configured_provider, requested_provider: diagnostic.requested_provider, requested_model: diagnostic.requested_model, response_model: diagnostic.response_model, gateway_http_status: diagnostic.gateway_http_status, provider_http_status: diagnostic.provider_http_status, finish_reason: diagnostic.finish_reason, json_parse: diagnostic.json_parse_success === true, schema: diagnostic.schema_validation_pass === true, latency_ms: diagnostic.latency_ms ?? (Date.now() - started), started_at: startedAt, completed_at: new Date().toISOString(), failure_stage: diagnostic.failure_stage, error: error ? safeError(error) : null },
    source_resolution: sourceResolution ? { candidate_count: sourceResolution.candidate_count, pass_count: sourceResolution.source_resolution_pass_count, fail_count: sourceResolution.source_resolution_fail_count, rate: sourceResolution.source_resolution_rate, pass: sourceResolution.source_resolution_pass, source_ref_hashes: sourceResolution.source_ref_hashes } : null,
    response_observation: { content_present: diagnostic.model_content_length_chars !== null, content_length_chars: diagnostic.model_content_length_chars, body_sha256: rawBodyMeta.body_sha256, body_length_chars: rawBodyMeta.body_length_chars, content_type: rawBodyMeta.content_type },
    safety: { provider_calls: rawBodyMeta.calls, production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, raw_provider_response_persisted: false, prompt_persisted: false, secret_output: false }
  };
  const packetOut = { artifact_type: 'V43_REQUIREMENT_TASK_SPECIFIC_OUTPUT_BUDGET_RUNTIME_SMOKE_PACKET', blind: true, run_id: RUN_ID, case: { tender_id: TARGET_TENDER, chunk_number: TARGET_CHUNK_NUMBER, source_file_sha256: tender.primary.sha256, source_chunk_hash: providerInputHash }, result: { final_verdict: finalVerdict, status, candidate_count: sourceResolution?.candidate_count ?? 0, source_resolution_pass: sourceResolution?.source_resolution_pass ?? false }, runtime_identity: checkpoint.runtime, generation: checkpoint.generation, contract: checkpoint.contract, provider: checkpoint.provider };
  await mkdir(DOCS, { recursive: true });
  await writeFile(CHECKPOINT_JSON, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  await writeFile(PACKET_JSON, `${JSON.stringify(packetOut, null, 2)}\n`, 'utf8');
  await writeFile(CHECKPOINT_MD, [
    '# Requirement task-specific output budget runtime smoke',
    '',
    `RUN_ID: ${RUN_ID}`,
    `FINAL_VERDICT: ${finalVerdict}`,
    `STATUS: ${status}`,
    `TARGET: ${TARGET_TENDER} / Chunk ${TARGET_CHUNK_NUMBER}`,
    `PROVIDER_CALLS: ${rawBodyMeta.calls}`,
    `RETRIES: 0`,
    `PROVIDER_HTTP_STATUS: ${rawBodyMeta.status ?? 'not reached'}`,
    `GATEWAY_HTTP_STATUS: ${diagnostic.gateway_http_status ?? 'not reached'}`,
    `RESOLVED_MAX_OUTPUT_TOKENS: ${resolvedBudget ?? 'not observed'}`,
    `FINISH_REASON: ${diagnostic.finish_reason ?? 'not observed'}`,
    `JSON_PARSE: ${diagnostic.json_parse_success === true ? 'PASS' : 'FAIL'}`,
    `SCHEMA: ${diagnostic.schema_validation_pass === true ? 'PASS' : 'FAIL'}`,
    `SOURCE_RESOLUTION: ${sourceResolution?.source_resolution_pass ? 'PASS' : 'FAIL/NOT_REACHED'}`,
    `PRODUCTION_DB_WRITES: 0`,
    `GOLD_MUTATIONS: 0`,
    `RAW_PROVIDER_RESPONSE_PERSISTED: false`,
    '',
    'Only safe metadata (hashes, lengths, statuses, and counts) is persisted; no prompt, secret, or raw provider content is included.'
  ].join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({ final_verdict: finalVerdict, status, run_id: RUN_ID, provider_calls: rawBodyMeta.calls, resolved_max_output_tokens: resolvedBudget, provider_http_status: rawBodyMeta.status, gateway_http_status: diagnostic.gateway_http_status, finish_reason: diagnostic.finish_reason, json_parse: diagnostic.json_parse_success === true, schema: diagnostic.schema_validation_pass === true, source_resolution: sourceResolution?.source_resolution_pass ?? false, checkpoint: CHECKPOINT_JSON, packet: PACKET_JSON }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(JSON.stringify({ final_verdict: `BLOCKED_${safeError(error).code || 'PRECHECK_FAILURE'}`, error: safeError(error), provider_calls: 0 }, null, 2)); process.exitCode = 1; });
}
