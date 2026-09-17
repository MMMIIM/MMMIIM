import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  getSemanticTaskContract,
  schemaSha256
} from '../../../packages/semantic-contracts/index.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import {
  prepareTender,
  runLiveBenchmark,
  runMutationSuite,
  safeProbeAudit
} from '../requirement-semantic-quality-v1/runner.js';
import { evaluateCandidatePayload } from './candidate-pipeline-evaluator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const QUALITY_DIR = path.join(REPO, 'backend/eval/requirement-production-quality-gate');
const CANONICAL_PATH = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const OUTPUT_REVIEW_PATH = path.join(DOCS, 'V43_REQUIREMENT_OUTPUT_SIDE_REVIEW.jsonl');
const BLIND_RECALL_PATH = path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl');
const HISTORICAL_INVENTORY_PATH = path.join(DOCS, 'V43_REQUIREMENT_SEMANTIC_FAILURE_INVENTORY.json');
const TASK = 'requirement_extraction';
const TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
const TENDER_SOURCE_FILES = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonl = file => fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  : [];
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const writeJsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
};
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

function relative(file) {
  return path.relative(REPO, file).replaceAll('\\', '/');
}

function safeHost(value) {
  try { return new URL(value).hostname; } catch { return value ? 'invalid' : null; }
}

function safeGatewayInfo(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { available: false };
  const task = body.task_registry?.requirement_extraction
    || body.tasks?.requirement_extraction
    || body.requirement_extraction
    || {};
  return {
    available: true,
    top_level_keys: Object.keys(body).sort().slice(0, 40),
    provider: typeof body.provider === 'string' ? body.provider : null,
    model: typeof body.model === 'string' ? body.model : null,
    provider_configured: body.provider_configured === true,
    task_registry_loaded: body.task_registry_loaded === true,
    task_contract_version: typeof task.contract_version === 'string' ? task.contract_version : null,
    task_schema_version: typeof task.schema_version === 'string' ? task.schema_version : null,
    task_schema_hash: typeof task.schema_hash === 'string' ? task.schema_hash : null,
    task_prompt_hash: typeof task.prompt_hash === 'string' ? task.prompt_hash : null
  };
}

async function safeGatewayGet(url, fetchImpl = fetch, timeoutMs = 5000) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    let body = null;
    if (response.headers?.get?.('content-type')?.includes('json')) {
      try { body = await response.json(); } catch { body = null; }
    }
    return { status: response.status, ok: response.ok, latency_ms: Date.now() - started, body };
  } catch (error) {
    return {
      status: null,
      ok: false,
      latency_ms: Date.now() - started,
      error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildMutationOwnershipAudit({ canonical = [], historical = null } = {}) {
  const suite = runMutationSuite(canonical);
  const rows = suite.cases.map(row => ({
    mutation_id: row.mutation_id,
    dimension: row.dimension,
    severity: row.severity,
    original_requirement_id: row.original_requirement_id,
    original_input_layer: 'CANONICAL_REQUIREMENT_INPUT',
    mutation_injection_layer: row.injection_layer,
    component_under_test: row.component_under_test,
    expected_detector_owner: 'REQUIREMENT_QUALITY_GATE_V1',
    actual_detector_owner: row.current_gate_detected ? 'REQUIREMENT_QUALITY_GATE_V1' : 'NO_DETECTOR',
    mutation_applied: row.mutation_applied === true,
    detected: row.current_gate_detected === true,
    routed_to_review: row.routed_to_review === true,
    escape: row.escaped_as_accept === true,
    classification: row.current_gate_detected ? 'DETECTED_BY_PRODUCTION_QUALITY_GATE' : 'ESCAPE'
  }));
  const historicalP0 = Array.isArray(historical?.p0_mutation_cases)
    ? historical.p0_mutation_cases.length
    : Number(historical?.p0_mutation_escape_count || 0);
  return {
    artifact_type: 'V43_REQUIREMENT_MUTATION_OWNERSHIP_AUDIT',
    artifact_version: 'v2',
    mutation_test_validity: rows.every(row => row.mutation_applied) ? 'VALID' : 'PARTIALLY_VALID',
    ownership_scope: 'CANONICAL_INPUT_TO_QUALITY_GATE',
    production_responsibility_claim: 'QUALITY_GATE_ONLY_FOR_DETERMINISTIC_P0_BOUNDARY; PRODUCER_SEMANTIC_JUDGEMENT_REMAINS_SEPARATE',
    current_suite: {
      total_cases: suite.total_cases,
      p0_cases: suite.p0_cases,
      p0_detected: suite.p0_detected_count,
      p0_detection_recall: suite.p0_detection_recall,
      p0_escape: suite.p0_escape_count,
      cases: rows
    },
    historical_observation: {
      source: relative(HISTORICAL_INVENTORY_PATH),
      pre_remediation_p0_escape_count: historicalP0,
      interpretation: 'Historical rows used only to explain prior observation; they are not current Gold labels and were not rewritten.'
    },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0
  };
}

export async function buildRuntimeIdentityAudit({ env = loadBackendEnvironment(), fetchImpl = fetch } = {}) {
  const config = readSemanticGatewayRuntimeConfig(env);
  const task = getSemanticTaskContract(TASK);
  const gatewayBase = config.gatewayApiBase?.replace(/\/+$/, '');
  const ready = gatewayBase ? await safeGatewayGet(`${gatewayBase}/ready`, fetchImpl) : { status: null, ok: false, error_code: 'GATEWAY_NOT_CONFIGURED' };
  const info = gatewayBase ? await safeGatewayGet(`${gatewayBase}/info`, fetchImpl) : { status: null, ok: false, error_code: 'GATEWAY_NOT_CONFIGURED' };
  const gatewayIdentity = safeGatewayInfo(info.body);
  const backendIdentity = {
    provider: config.provider,
    model: config.model,
    gateway_host: safeHost(config.gatewayApiBase),
    provider_host: safeHost(config.providerApiBase),
    provider_configured: Boolean(config.providerApiBase && config.providerApiKey && config.model),
    gateway_configured: Boolean(config.gatewayApiBase && config.serviceApiKey),
    timeout_ms: config.timeoutMs
  };
  const identityMismatch = gatewayIdentity.provider && backendIdentity.provider
    ? gatewayIdentity.provider !== backendIdentity.provider
    : null;
  return {
    artifact_type: 'V43_REQUIREMENT_RUNTIME_IDENTITY_AUDIT',
    artifact_version: 'v1',
    task_type: TASK,
    eval_runner_identity: {
      runner: 'requirement-production-quality-gate/recovery.js',
      runner_version: 'v1',
      task_contract_version: task.contract_version,
      task_schema_hash: schemaSha256(task.data_schema),
      provider_calls: 0
    },
    backend_runtime_identity: backendIdentity,
    semantic_gateway_identity: {
      ready_http_status: ready.status,
      ready_ok: ready.ok,
      ready_provider: typeof ready.body?.provider === 'string' ? ready.body.provider : null,
      ready_provider_configured: ready.body?.provider_configured === true,
      info_http_status: info.status,
      info_ok: info.ok,
      info: gatewayIdentity
    },
    actual_request_provider_identity: null,
    actual_model_identity: null,
    provider_identity_source_of_truth: 'gateway probe diagnostics from an actual request; /info is configuration only',
    configuration_identity_mismatch: identityMismatch,
    status: identityMismatch === true ? 'RECONCILIATION_REQUIRED' : (ready.ok && info.ok ? 'PRECHECK_PASS' : 'PRECHECK_BLOCKED'),
    sensitive_values_logged: false,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

export function chooseSmokeChunk(prepared, tenderId) {
  const preferredPatterns = {
    // The first deterministic TABLE match in TB-003 is procurement-policy
    // front matter. Pin the smoke probe to the explicit 采购需求 section so
    // the Eval exercises requirement extraction rather than policy text.
    'TB-003': /（三）采购需求/
  };
  const preferred = prepared.chunks.find(chunk => preferredPatterns[tenderId]?.test(String(chunk.text || '')));
  if (preferred) return preferred;
  const patterns = {
    'JY-001': /响应时间|性能|不少于|不低于|数量|容量/,
    'TB-003': /序号|单位|参数|规格|配置|指标/,
    'TB-006': /同时|分别|并且|且应|并应/,
    'FAST-01': /★|实质性|必须|应当|须提供/,
    'FAST-04': /仅供参考|不得|禁止|不应|说明|背景/,
    'FAST-WATER-01': /应支持|支持|提供|实现|服务|系统/
  };
  const match = prepared.chunks.find(chunk => patterns[tenderId]?.test(String(chunk.text || '')));
  return match || prepared.chunks[0] || null;
}

function smokeLabel(tenderId) {
  return {
    'JY-001': 'QUANTITATIVE',
    'TB-003': 'TABLE',
    'TB-006': 'MULTI_CLAUSE',
    'FAST-01': 'MANDATORY',
    'FAST-04': 'NEGATIVE_CONTEXT_BOUNDARY',
    'FAST-WATER-01': 'NORMAL_PROSE'
  }[tenderId] || 'UNCLASSIFIED';
}

function classifyFailure(error, audit) {
  if (error?.code === 'GATEWAY_TIMEOUT' || error?.code === 'PROVIDER_TIMEOUT') return 'PROVIDER_TIMEOUT';
  if (error?.code === 'GATEWAY_NETWORK_ERROR' || error?.code === 'PROVIDER_NETWORK_ERROR') return 'PROVIDER_NETWORK';
  const gatewayStatus = audit.gateway_http_status || error?.audit?.gateway_http_status;
  const providerStatus = audit.provider_http_status || error?.audit?.provider_http_status;
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 500) return 'GATEWAY_5XX';
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 400) return 'GATEWAY_4XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 500) return 'PROVIDER_5XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 400) return 'PROVIDER_4XX';
  return error?.code || 'LIVE_PROVIDER_FAILURE';
}

async function runSixCaseSmoke(prepared, env) {
  const gateway = createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: TASK }));
  const rows = [];
  let providerCalls = 0;
  let firstFailure = null;
  for (const item of prepared) {
    const chunk = chooseSmokeChunk(item, item.tender_id);
    if (!chunk) {
      firstFailure = { tender_id: item.tender_id, failure_stage: 'CHUNK_SELECTION', error_code: 'NO_CHUNK_AVAILABLE' };
      break;
    }
    if (providerCalls >= 10) {
      firstFailure = { tender_id: item.tender_id, failure_stage: 'PROVIDER_CAP', error_code: 'PROVIDER_CALL_CAP_EXCEEDED' };
      break;
    }
    const input = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
    const started = Date.now();
    providerCalls += 1;
    let result = null;
    let error = null;
    try {
      result = await gateway.extract({
        fileName: item.source_file,
        text: input,
        paragraphs: chunk.segments,
        chunk,
        projectName: item.title,
        sectionName: item.tender_id,
        chunkCount: item.chunk_count,
        diagnosticMode: 'probe-v1'
      });
    } catch (caught) {
      error = caught;
    }
    const audit = safeProbeAudit({
      ...(result?.audit || error?.audit || {}),
      ...(result?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || {})
    });
    let evaluation = null;
    let candidateCount = null;
    if (result) {
      candidateCount = result.candidates.length;
      evaluation = evaluateCandidatePayload({ candidates: result.candidates, chunk, qualityGate: true });
    }
    const row = {
      case_id: `LIVE-SMOKE-${item.tender_id}`,
      tender_id: item.tender_id,
      coverage_class: smokeLabel(item.tender_id),
      chunk_number: chunk.chunk_number,
      input_sha256: sha256(input),
      input_length: input.length,
      provider_call: 1,
      retry_count: 0,
      duration_ms: Date.now() - started,
      producer_success: Boolean(result),
      producer_schema_valid: Boolean(result),
      candidate_contract_valid: Boolean(result),
      source_resolution_success: evaluation?.source_resolution_success ?? false,
      source_resolution_failure_code: evaluation?.source_resolution_failure_code || null,
      source_resolution_failed_candidate_index: evaluation?.source_resolution_failed_candidate_index ?? null,
      canonicalization_success: evaluation?.canonicalization_success ?? false,
      canonicalization_failure_code: evaluation?.canonicalization_failure_code || null,
      canonicalization_failed_candidate_index: evaluation?.canonicalization_failed_candidate_index ?? null,
      quality_gate_decision: evaluation?.quality_gate_decision || null,
      quality_gate_reason_codes: evaluation?.quality_gate_reason_codes || [],
      candidate_count: candidateCount,
      gateway_http_status: audit.gateway_http_status || error?.audit?.gateway_http_status || null,
      provider_http_status: audit.provider_http_status,
      provider_chain_reached: audit.provider_adapter_invoked && audit.fetch_invoked && audit.provider_http_reached,
      response_shape: result ? 'response_payload_json_envelope' : 'UNAVAILABLE',
      finish_reason: audit.finish_reason,
      prompt_tokens: audit.prompt_tokens,
      completion_tokens: audit.completion_tokens,
      output_truncated: audit.output_truncated,
      probe_audit: audit,
      error_code: error?.code || evaluation?.source_resolution_failure_code || evaluation?.canonicalization_failure_code || null,
      failure_class: error ? classifyFailure(error, audit) : (evaluation?.failure_stage || null),
      status: result && evaluation?.failure_stage !== 'QUALITY_GATE' && evaluation?.source_resolution_success === true && evaluation?.canonicalization_success === true ? 'PASS' : 'FAIL'
    };
    rows.push(row);
    if (row.status !== 'PASS') {
      firstFailure = {
        tender_id: item.tender_id,
        case_id: row.case_id,
        failure_stage: !result ? 'PRODUCER' : (evaluation?.failure_stage || 'QUALITY_GATE'),
        error_code: row.error_code,
        failure_class: row.failure_class
      };
      break;
    }
  }
  return {
    smoke_cases: rows,
    smoke_case_count: rows.length,
    smoke_pass: rows.length === TENDER_IDS.length && rows.every(row => row.status === 'PASS'),
    provider_calls: providerCalls,
    retries: 0,
    first_failure: firstFailure,
    stopped_on_first_failure: Boolean(firstFailure)
  };
}

function buildOutputAdjudication() {
  return readJsonl(OUTPUT_REVIEW_PATH).map(row => ({
    run_id: row.run_id,
    tender_id: row.tender_id,
    canonical_requirement_id: row.canonical_requirement_id,
    requirement_text: row.requirement_text,
    source_excerpt: row.source_excerpt,
    source_hash: row.source_hash,
    source_span: row.source_span,
    features: row.features,
    adjudication_status: 'PENDING_BLINDED_HUMAN_OR_INDEPENDENT_JUDGE',
    decision: null,
    failure_type: null,
    severity: null,
    semantic_fidelity: null,
    atomicity_assessment: null,
    mapping_usability: null,
    label_source: null,
    contamination_check: 'NO_GOLD_OR_PRODUCER_LABEL_EXPOSED'
  }));
}

function buildSourceBlindAdjudication() {
  return readJsonl(BLIND_RECALL_PATH).map(row => ({
    run_id: row.run_id,
    tender_id: row.tender_id,
    window_id: row.window_id,
    source_file: row.source_file,
    source_sha256: row.source_sha256,
    source_refs: row.source_refs,
    source_excerpt: row.source_excerpt,
    canonical_visibility: 'HIDDEN_FIRST_PASS',
    expected_substantive_requirements: [],
    blind_adjudication_status: 'PENDING_BLINDED_HUMAN_OR_INDEPENDENT_JUDGE',
    second_pass_alignment: null,
    label_source: null
  }));
}

function buildHumanPacket(rows) {
  const selected = rows
    .filter(row => Number(row.features?.risk_score || 0) >= 8 || row.features?.RISK_FLAGS?.includes('POSSIBLE_CONTEXT_ONLY'))
    .slice(0, 30);
  return {
    artifact_type: 'V43_REQUIREMENT_HUMAN_ADJUDICATION_PACKET',
    artifact_version: 'v1',
    review_status: 'PENDING_HUMAN_AUTHORITY',
    label_blind: true,
    case_count: selected.length,
    cases: selected.map(row => ({
      tender_id: row.tender_id,
      canonical_requirement_id: row.canonical_requirement_id,
      requirement_text: row.requirement_text,
      source_excerpt: row.source_excerpt,
      source_hash: row.source_hash,
      source_span: row.source_span,
      risk_features: row.features,
      expected_decision: null,
      producer_decision: null,
      provider_result: null,
      review_fields: ['decision', 'failure_type', 'severity', 'semantic_fidelity', 'atomicity_assessment', 'mapping_usability']
    })),
    excluded_from_packet: rows.length - selected.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

export async function buildRecoveryArtifacts({
  now = new Date().toISOString(),
  docsDir = DOCS,
  outputDir = QUALITY_DIR,
  runLive = false,
  env = loadBackendEnvironment(),
  liveDiagnosticsInput = null
} = {}) {
  const canonical = readJson(CANONICAL_PATH).requirements || [];
  const historical = fs.existsSync(HISTORICAL_INVENTORY_PATH) ? readJson(HISTORICAL_INVENTORY_PATH) : null;
  const mutationAudit = buildMutationOwnershipAudit({ canonical, historical });
  const runtimeIdentity = await buildRuntimeIdentityAudit({ env });
  const outputRows = buildOutputAdjudication();
  const blindRows = buildSourceBlindAdjudication();
  const humanPacket = buildHumanPacket(outputRows);
  let liveDiagnostics = liveDiagnosticsInput || {
    artifact_type: 'V43_REQUIREMENT_LIVE_PIPELINE_DIAGNOSTICS',
    artifact_version: 'v1',
    mode: runLive ? 'BOUNDED_LIVE' : 'PRE_LIVE_PREPARATION',
    six_case_smoke: 'NOT_EXECUTED',
    fixed_48_case_benchmark: 'NOT_EXECUTED',
    provider_calls: 0,
    retries: 0,
    first_failure: null,
    stages: {
      producer: 'NOT_EXECUTED',
      source_resolution: 'NOT_EXECUTED',
      canonicalization: 'NOT_EXECUTED',
      quality_gate: 'NOT_EXECUTED'
    },
    safe_side_effects: { production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  if (runLive) {
    const prepared = [];
    for (const tenderId of TENDER_IDS) prepared.push(await prepareTender(tenderId, env));
    const smoke = await runSixCaseSmoke(prepared, env);
    liveDiagnostics = {
      ...liveDiagnostics,
      six_case_smoke: smoke.smoke_pass ? 'PASS' : 'FAIL_STOPPED_FIRST_FAILURE',
      fixed_48_case_benchmark: smoke.smoke_pass ? 'NOT_EXECUTED_PENDING_SMOKE_GATE' : 'NOT_EXECUTED_SMOKE_FAILED',
      provider_calls: smoke.provider_calls,
      retries: smoke.retries,
      smoke_cases: smoke.smoke_cases,
      first_failure: smoke.first_failure,
      stages: {
        producer: smoke.smoke_cases.every(row => row.producer_success) ? 'PASS' : 'FAIL',
        source_resolution: smoke.smoke_cases.length && smoke.smoke_cases.every(row => row.source_resolution_success) ? 'PASS' : 'FAIL',
        canonicalization: smoke.smoke_cases.length && smoke.smoke_cases.every(row => row.canonicalization_success) ? 'PASS' : 'FAIL',
        quality_gate: smoke.smoke_cases.length && smoke.smoke_cases.every(row => row.quality_gate_decision === 'PASS') ? 'PASS' : 'REVIEW_REQUIRED_OR_BLOCKED',
      },
      tender_preparation: prepared.map(item => ({
        tender_id: item.tender_id,
        source_file: item.source_file,
        source_sha256: item.source_sha256,
        parser_status: item.parser_status,
        chunker_status: item.chunker_status,
        chunk_count: item.chunk_count
      }))
    };
    const actual = smoke.smoke_cases.find(row => row.provider_chain_reached);
    if (actual) {
      runtimeIdentity.actual_request_provider_identity = actual.probe_audit.provider_trace_id
        ? 'gateway-provider-traced'
        : 'provider-reached-identity-unreported';
      runtimeIdentity.actual_model_identity = actual.probe_audit.response_model || null;
      runtimeIdentity.provider_identity_source_of_truth = 'actual bounded smoke probe diagnostics';
    }
    if (smoke.smoke_pass) {
      // The fixed benchmark is intentionally callable only after the six-case gate.
      // Keep it opt-in for this recovery artifact so a failed smoke can never spend
      // additional calls or conceal the first failure.
      liveDiagnostics.fixed_48_case_benchmark = 'NOT_EXECUTED_RECOVERY_STOPS_AFTER_SMOKE_GATE';
    }
  } else if (liveDiagnosticsInput) {
    const actual = liveDiagnosticsInput.smoke_cases?.find(row => row.provider_chain_reached);
    if (actual) {
      runtimeIdentity.actual_request_provider_identity = actual.probe_audit?.provider_trace_id
        ? 'gateway-provider-traced'
        : 'provider-reached-identity-unreported';
      runtimeIdentity.actual_model_identity = actual.probe_audit?.response_model || null;
      runtimeIdentity.provider_identity_source_of_truth = 'actual bounded smoke probe diagnostics';
    }
  }
  const outputFiles = {
    mutation: path.join(docsDir, 'V43_REQUIREMENT_MUTATION_OWNERSHIP_AUDIT.json'),
    runtime: path.join(docsDir, 'V43_REQUIREMENT_RUNTIME_IDENTITY_AUDIT.json'),
    diagnostics: path.join(docsDir, 'V43_REQUIREMENT_LIVE_PIPELINE_DIAGNOSTICS.json'),
    outputAdjudicated: path.join(docsDir, 'V43_REQUIREMENT_OUTPUT_SIDE_ADJUDICATED.jsonl'),
    sourceAdjudicated: path.join(docsDir, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL_ADJUDICATED.jsonl'),
    humanPacket: path.join(docsDir, 'V43_REQUIREMENT_HUMAN_ADJUDICATION_PACKET.json'),
    checkpoint: path.join(docsDir, 'V43_REQUIREMENT_PRODUCTION_READINESS_RECOVERY_CHECKPOINT.json'),
    checkpointMd: path.join(docsDir, 'V43_REQUIREMENT_PRODUCTION_READINESS_RECOVERY_CHECKPOINT.md')
  };
  writeJson(outputFiles.mutation, { ...mutationAudit, generated_at: now });
  writeJson(outputFiles.runtime, { ...runtimeIdentity, generated_at: now });
  writeJson(outputFiles.diagnostics, { ...liveDiagnostics, generated_at: now });
  writeJsonl(outputFiles.outputAdjudicated, outputRows);
  writeJsonl(outputFiles.sourceAdjudicated, blindRows);
  writeJson(outputFiles.humanPacket, humanPacket);
  const smokeRows = liveDiagnostics.smoke_cases || [];
  const providerCalls = liveDiagnostics.provider_calls || 0;
  const providerFailures = smokeRows.filter(row => row.status !== 'PASS').length;
  const mutationPass = mutationAudit.current_suite.p0_escape === 0 && mutationAudit.current_suite.p0_detection_recall === 1;
  const liveSmokePass = liveDiagnostics.six_case_smoke === 'PASS';
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_READINESS_RECOVERY_CHECKPOINT',
    artifact_version: 'v1',
    generated_at: now,
    mutation_test_validity: mutationAudit.mutation_test_validity,
    actual_provider_identity: runtimeIdentity.actual_request_provider_identity,
    actual_model_identity: runtimeIdentity.actual_model_identity,
    live_smoke_cases: smokeRows.length,
    live_smoke_pass: liveSmokePass,
    live_cases: liveDiagnostics.fixed_48_case_benchmark === 'PASS' ? 48 : 0,
    live_pipeline_completion: liveDiagnostics.fixed_48_case_benchmark === 'PASS' ? 1 : null,
    substantive_recall: 'NOT_EVALUATED_PENDING_BLIND_ADJUDICATION',
    mandatory_critical_recall: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    canonical_precision: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    semantic_fidelity: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    atomic_or_intentionally_grouped: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    actionable_human_review_rate: 'NOT_EVALUATED_PENDING_HUMAN_OR_INDEPENDENT_JUDGE',
    raw_p0_error_count: mutationAudit.current_suite.p0_cases,
    p0_detected: mutationAudit.current_suite.p0_detected,
    p0_review_routed: mutationAudit.current_suite.p0_detected,
    p0_escape: mutationAudit.current_suite.p0_escape,
    p0_mutation_detection_recall: mutationAudit.current_suite.p0_detection_recall,
    p0_mutation_escape: mutationAudit.current_suite.p0_escape,
    source_traceability: 'NOT_EVALUATED_PENDING_LIVE_SOURCE_AND_ADJUDICATION',
    source_semantic_mismatch: 'NOT_EVALUATED_PENDING_BLIND_ADJUDICATION',
    provider_calls: providerCalls,
    retry_rate: 0,
    truncation: smokeRows.filter(row => row.output_truncated).length,
    latency_p50: null,
    latency_p95: null,
    projected_100_page_tender_c2: 'NOT_COMPUTED',
    patch_cycles_used: 0,
    production_files_changed: 0,
    eval_only_files_changed: Object.values(outputFiles).map(relative),
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    verdicts: {
      requirement_producer_runtime: liveDiagnostics.six_case_smoke === 'FAIL_STOPPED_FIRST_FAILURE' ? 'FAIL' : 'CONDITIONAL',
      requirement_engineering_quality: mutationPass ? 'PASS' : 'FAIL',
      requirement_semantic_quality: 'CONDITIONAL',
      requirement_performance: providerFailures === 0 && liveSmokePass
        ? 'CONDITIONAL'
        : (liveDiagnostics.six_case_smoke === 'FAIL_STOPPED_FIRST_FAILURE' || runLive ? 'FAIL' : 'CONDITIONAL'),
      requirement_review_burden: 'CONDITIONAL',
      requirement_extraction_production_readiness: mutationPass && liveSmokePass && outputRows.length > 0 && blindRows.length > 0 ? 'CONDITIONAL_PASS_PENDING_SEMANTIC_CERTIFICATION' : 'FAIL',
      requirement_mapping_input_ready: 'NO'
    },
    blockers: [
      'Independent output-side and source-side adjudication is not established; semantic metrics are not certified.',
      'Human authority packet remains pending and does not mutate Gold.',
      ...(runtimeIdentity.configuration_identity_mismatch === true ? ['Backend env identity differs from Semantic Gateway /info identity; actual request identity must be used for certification.'] : []),
      ...(liveDiagnostics.first_failure ? [`First live smoke failure: ${liveDiagnostics.first_failure.failure_stage}/${liveDiagnostics.first_failure.error_code || 'UNSPECIFIED'}.`] : []),
      'Recovery task stops before Mapping and does not promote any Gold.'
    ],
    artifact_paths: Object.fromEntries(Object.entries(outputFiles).map(([key, file]) => [key, relative(file)])),
    side_effects: { provider_calls: providerCalls, production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  writeJson(outputFiles.checkpoint, checkpoint);
  const markdown = [
    '# V43_REQUIREMENT_PRODUCTION_READINESS_RECOVERY_CHECKPOINT',
    '',
    `- MUTATION_TEST_VALIDITY: ${checkpoint.mutation_test_validity}`,
    `- LIVE_SMOKE_CASES: ${checkpoint.live_smoke_cases}`,
    `- LIVE_SMOKE_PASS: ${checkpoint.live_smoke_pass}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- P0_MUTATION_DETECTION_RECALL: ${checkpoint.p0_mutation_detection_recall}`,
    `- P0_MUTATION_ESCAPE: ${checkpoint.p0_mutation_escape}`,
    `- REQUIREMENT_ENGINEERING_QUALITY: ${checkpoint.verdicts.requirement_engineering_quality}`,
    `- REQUIREMENT_SEMANTIC_QUALITY: ${checkpoint.verdicts.requirement_semantic_quality}`,
    `- REQUIREMENT_EXTRACTION_PRODUCTION_READINESS: ${checkpoint.verdicts.requirement_extraction_production_readiness}`,
    `- REQUIREMENT_MAPPING_INPUT_READY: ${checkpoint.verdicts.requirement_mapping_input_ready}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    '',
    '## Blockers',
    '',
    ...checkpoint.blockers.map(item => `- ${item}`),
    '',
    'Semantic and recall metrics remain unqualified until blinded independent adjudication exists. This checkpoint does not promote Gold or enter Mapping.'
  ].join('\n');
  fs.writeFileSync(outputFiles.checkpointMd, `${markdown}\n`, 'utf8');
  return { checkpoint, mutationAudit, runtimeIdentity, liveDiagnostics, outputFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runLive = process.argv.includes('--live');
  buildRecoveryArtifacts({ runLive }).then(result => {
    process.stdout.write(`${JSON.stringify({
      checkpoint: result.checkpoint.checkpoint,
      mutation_test_validity: result.checkpoint.mutation_test_validity,
      live_smoke_cases: result.checkpoint.live_smoke_cases,
      live_smoke_pass: result.checkpoint.live_smoke_pass,
      provider_calls: result.checkpoint.provider_calls,
      first_failure: result.liveDiagnostics.first_failure,
      requirement_engineering_quality: result.checkpoint.verdicts.requirement_engineering_quality,
      requirement_extraction_production_readiness: result.checkpoint.verdicts.requirement_extraction_production_readiness,
      production_db_writes: 0,
      gold_mutations: 0
    }, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${JSON.stringify({ error_code: error?.code || 'REQUIREMENT_RECOVERY_FAILED', message: String(error?.message || '').slice(0, 240) })}\n`);
    process.exitCode = 1;
  });
}
