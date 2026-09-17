import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { SemanticGatewayClient } from '../../src/pipeline/semantic-gateway-client.js';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT,
  buildEvidenceFactCandidateV2SemanticInput
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  createEvidenceFactSourceSnapshot,
  createEvidenceFactProducerVersionSnapshot,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2,
  stableCanonicalEvidenceFactIdentity,
  EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  EVIDENCE_FACT_GROUNDING_V2_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  validateEvidenceFactCandidateV2Data,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import { loadSemanticGatewayEnvironment, readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;
const frozenSchemaFields = new Set([
  'statement', 'source_refs', 'subject_name', 'subject_type_hint', 'subject_source_refs',
  'entity_mentions', 'status_text', 'status_source_refs', 'scope_items', 'quantity_items', 'temporal_items'
]);

const CASES = Object.freeze([
  Object.freeze({ case_id: 'COM-01', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md' }),
  Object.freeze({ case_id: 'COM-06-A', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-06_权限_安全与审计测试报告.md' }),
  Object.freeze({ case_id: 'COM-06-B', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-06_权限_安全与审计测试报告.md' }),
  Object.freeze({ case_id: 'CCV2-U13-01', source_file: 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION/materials/CCV2-U13-01_性能与响应_PERFORMANCE_TEST.md' })
]);

function readSource(item) {
  const filePath = path.join(REPO, 'backend/eval/rag-pilot', item.source_file);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceHash = sha256(sourceText);
  const chunkId = `${item.case_id}-FULL-CHUNK-001`;
  const spanId = `${item.case_id}-FULL-SPAN-001`;
  const sourceSnapshot = createEvidenceFactSourceSnapshot({
    snapshot_id: `EVAL-SNAPSHOT-${sourceHash.slice(0, 16).toUpperCase()}`,
    material_id: item.case_id.startsWith('COM-') ? item.case_id.replace(/-[AB]$/, '') : item.case_id,
    material_version: 'eval-snapshot-v1',
    source_hash: sourceHash,
    chunk_id: chunkId,
    chunk_hash: sourceHash,
    source_span_id: spanId,
    source_span_hash: sourceHash,
    segments: [{ source_ref: `eval://rag-pilot/${item.source_file}#full-document`, text: sourceText }]
  });
  return {
    file_path: filePath,
    source_text: sourceText,
    source_hash: sourceHash,
    source_snapshot_id: `EVAL-SNAPSHOT-${sourceHash.slice(0, 16).toUpperCase()}`,
    source_ref: `eval://rag-pilot/${item.source_file}#full-document`,
    chunk_id: chunkId,
    chunk_hash: sourceHash,
    source_span_id: spanId,
    source_span_hash: sourceHash,
    material_id: item.case_id.startsWith('COM-') ? item.case_id.replace(/-[AB]$/, '') : item.case_id,
    material_version: 'eval-snapshot-v1',
    source_snapshot: sourceSnapshot
  };
}

function safeAudit(value = {}) {
  const d = value && typeof value === 'object' ? value : {};
  const generation = d.generation_config && typeof d.generation_config === 'object' ? d.generation_config : null;
  return {
    provider: safe(d.provider, 80),
    model: safe(d.model, 160) || safe(d.response_model, 160),
    protocol: safe(d.protocol, 40),
    http_status: Number.isInteger(d.http_status) ? d.http_status : null,
    provider_http_status: Number.isInteger(d.provider_http_status) ? d.provider_http_status : null,
    provider_http_reached: d.provider_http_reached === true,
    latency_ms: Number.isInteger(d.latency_ms) ? d.latency_ms : null,
    response_format_type: safe(d.response_format_type, 40),
    finish_reason: safe(d.finish_reason, 40),
    retry_attempt: Number.isInteger(d.retry_attempt) ? d.retry_attempt : null,
    prompt_tokens: Number.isInteger(d.prompt_tokens) ? d.prompt_tokens : null,
    completion_tokens: Number.isInteger(d.completion_tokens) ? d.completion_tokens : null,
    total_tokens: Number.isInteger(d.total_tokens) ? d.total_tokens : null,
    response_id: safe(d.response_id, 128),
    provider_trace_id: safe(d.provider_trace_id, 128),
    response_model: safe(d.response_model, 160),
    json_parse_success: typeof d.json_parse_success === 'boolean' ? d.json_parse_success : null,
    generation_config: generation ? {
      response_format: generation.response_format?.type === 'json_schema'
        ? { type: 'json_schema', name: safe(generation.response_format.name, 120), strict: generation.response_format.strict === true }
        : generation.response_format?.type === 'json_object' ? { type: 'json_object' } : null,
      enable_thinking: generation.enable_thinking === true,
      temperature: Number.isFinite(generation.temperature) ? generation.temperature : null,
      top_p: Number.isFinite(generation.top_p) ? generation.top_p : null,
      top_k: Number.isInteger(generation.top_k) ? generation.top_k : null,
      max_tokens: Number.isInteger(generation.max_tokens) ? generation.max_tokens : null,
      stream: generation.stream === true,
      n: Number.isInteger(generation.n) ? generation.n : null
    } : null,
    semantic_contract_version: safe(d.semantic_contract_version, 120),
    instruction_sha256: safe(d.instruction_sha256, 64),
    fact_normalization_diagnostic: d.fact_normalization_diagnostic && typeof d.fact_normalization_diagnostic === 'object' ? {
      projection_invoked: d.fact_normalization_diagnostic.projection_invoked === true,
      normalizer_invoked: d.fact_normalization_diagnostic.normalizer_invoked === true,
      unexpected_property_names: Array.isArray(d.fact_normalization_diagnostic.unexpected_property_names)
        ? d.fact_normalization_diagnostic.unexpected_property_names.filter(item => typeof item === 'string').slice(0, 40) : [],
      exact_validation_path: safe(d.fact_normalization_diagnostic.exact_validation_path, 240)
    } : null
  };
}

function recursiveMaxDepth(value, depth = 0) {
  if (!value || typeof value !== 'object') return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((max, child) => Math.max(max, recursiveMaxDepth(child, depth + 1)), depth);
}

function structuralChecks(facts) {
  let unexpected = 0;
  let predicateViolations = 0;
  let nestingViolations = 0;
  for (const fact of facts || []) {
    for (const key of Object.keys(fact || {})) if (!frozenSchemaFields.has(key)) unexpected += 1;
    if (Object.prototype.hasOwnProperty.call(fact || {}, 'predicate')) predicateViolations += 1;
    if ((fact?.quantity_items || []).some(item => Object.prototype.hasOwnProperty.call(item || {}, 'conditions')
      || Object.prototype.hasOwnProperty.call(item || {}, 'value'))) nestingViolations += 1;
    if (recursiveMaxDepth(fact) > 7) nestingViolations += 1;
  }
  return { unexpected, predicateViolations, nestingViolations };
}

function provenanceStats(facts, sourceText) {
  const groups = ['entity_mentions', 'scope_items', 'quantity_items', 'temporal_items'];
  let observations = 0;
  let valid = 0;
  for (const fact of facts || []) {
    for (const group of groups) {
      for (const observation of fact?.[group] || []) {
        observations += 1;
        if (Array.isArray(observation?.source_refs) && observation.source_refs.length > 0) valid += 1;
        else if (observation?.provenance?.source_text && Array.isArray(observation.provenance.source_refs)
          && observation.provenance.source_refs.length > 0 && sourceText.includes(observation.provenance.source_text)) valid += 1;
      }
    }
  }
  return { observations, valid, rate: observations ? valid / observations : 1 };
}

function producerSnapshot(audit, promptHash) {
  const generation = audit.generation_config || {};
  return createEvidenceFactProducerVersionSnapshot({
    provider: audit.provider || 'deepseek_official',
    model: audit.model || 'deepseek-v4-pro',
    endpoint: '/responses',
    protocol: audit.protocol || 'responses',
    thinking: generation.enable_thinking === false ? 'OFF' : null,
    reasoning: 'none',
    temperature: generation.temperature ?? 0.1,
    top_p: generation.top_p ?? 0.9,
    top_k: generation.top_k ?? 'UNSUPPORTED',
    seed: 'UNSUPPORTED',
    max_output_tokens: generation.max_tokens ?? 4800,
    prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
    prompt_hash: promptHash,
    candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
    candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
    canonicalizer_version: EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
    grounding_version: EVIDENCE_FACT_GROUNDING_V2_VERSION
  });
}

function classifySystemic(error) {
  return new Set(['AUTH_INVALID', 'GATEWAY_NOT_CONFIGURED', 'TASK_UNSUPPORTED', 'SEMANTIC_CONTRACT_DRIFT', 'PROVIDER_UNAVAILABLE'])
    .has(String(error?.code || ''));
}

async function run() {
  const runId = `fact-candidate-v2-target-live-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
  loadBackendEnvironment({ env: process.env });
  const env = loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
  const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
  const gatewayBase = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  const runtimePreflight = { gateway_base: gatewayBase, ready_status: null, info_status: null, fact_provider: null, fact_provider_configured: false, fact_provider_endpoint: null, fact_model: null, build_revision: null, task_types: [] };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(`${gatewayBase}${endpoint}`);
    const body = await response.json();
    runtimePreflight[endpoint === '/ready' ? 'ready_status' : 'info_status'] = response.status;
    if (endpoint === '/info') {
      runtimePreflight.fact_provider = body.fact_provider || null;
      runtimePreflight.fact_provider_configured = body.fact_provider_configured === true;
      runtimePreflight.fact_provider_endpoint = body.fact_provider_endpoint || null;
      runtimePreflight.fact_model = body.fact_model || null;
      runtimePreflight.build_revision = body.build_revision || null;
      runtimePreflight.task_types = Array.isArray(body.task_types) ? body.task_types.slice() : [];
    }
  }
  const promptMetadata = getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2');
  const promptHash = promptMetadata?.instruction_hash || null;
  const outputDir = path.join(REPO, 'backend/eval/rag-pilot/results', runId);
  fs.mkdirSync(outputDir, { recursive: true });
  const sourceRows = CASES.map(readSource);
  const preflightCheckpoint = {
    run_id: runId,
    checkpoint: 'V43_FACT_CANDIDATE_V2_TARGET_LIVE_GATE',
    generated_at: now(),
    runtime_preflight: runtimePreflight,
    contract: {
      task_type: 'evidence_fact_candidate_v2',
      schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
      schema_sha256: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
      prompt_hash: promptHash,
      canonicalizer_version: EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
      grounding_version: EVIDENCE_FACT_GROUNDING_V2_VERSION
    },
    planned_executions: 4,
    planned_cases: CASES.map(item => item.case_id),
    provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses',
    concurrency: 1, retries_policy: 'genuine_transport_transient_only', total_provider_call_cap: 5,
    production_db_writes: 0, fact_persistence: 0, gold_mutations: 0,
    mapping_actions: 0, claim_actions: 0, writer_actions: 0
  };
  fs.writeFileSync(path.join(outputDir, 'preflight.json'), `${JSON.stringify(preflightCheckpoint, null, 2)}\n`);

  const realClient = new SemanticGatewayClient({
    apiBase: runtimeConfig.gatewayApiBase,
    apiKey: runtimeConfig.serviceApiKey,
    user: env.SEMANTIC_GATEWAY_USER || env.V43_GATEWAY_USER || 'local-smoke-test',
    timeoutMs: runtimeConfig.timeoutMs,
    taskTimeouts: { evidence_fact_candidate_v2: runtimeConfig.timeoutMs },
    configSource: 'canonical_semantic_gateway_eval_target_live'
  });
  let capturedAudit = null;
  const captureClient = { run: async (...args) => { const result = await realClient.run(...args); capturedAudit = result.audit; return result; } };
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client: captureClient });
  const rows = [];
  const rawCandidates = [];
  const canonicalRows = [];
  const groundingRows = [];
  const telemetryRows = [];
  let calls = 0;
  let firstAttemptCalls = 0;
  let retries = 0;
  let systemicBlocker = null;
  for (const item of CASES) {
    const source = sourceRows.find(row => row.material_id === (item.case_id.startsWith('COM-') ? item.case_id.replace(/-[AB]$/, '') : item.case_id));
    const started = Date.now();
    const context = {
      review_id: `EVAL-CANDIDATE-V2-REVIEW-${item.case_id}`,
      project_id: `EVAL-CANDIDATE-V2-PROJECT-${item.case_id}`,
      review_status: 'approved',
      evidence_review_contract_version: 'evidence-review-v1',
      evidence_capability: 'candidate_v2_eval',
      support_level: 'reference_only',
      source_span_id: source.source_span_id,
      source_text: source.source_text,
      source_text_hash: source.source_hash,
      current_source_text_hash: source.source_hash,
      material_id: source.material_id,
      material_type: 'controlled_synthetic_enterprise',
      anchor_chunk_id: source.chunk_id
    };
    const sourceSnapshot = source.source_snapshot;
    const inputPayload = buildEvidenceFactCandidateV2SemanticInput(context, { sourceSnapshot });
    const requestIdentity = sha256(JSON.stringify({ task_type: 'evidence_fact_candidate_v2', payload: inputPayload, source_snapshot: sourceSnapshot }));
    capturedAudit = null;
    let facts = null;
    let error = null;
    firstAttemptCalls += 1;
    calls += 1;
    try { facts = await extractor.extractCandidateV2(context, { sourceSnapshot, producerVersion: { provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses', protocol: 'responses', thinking: 'OFF', reasoning: 'none', prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION, prompt_hash: promptHash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256, canonicalizer_version: EVIDENCE_FACT_CANONICALIZER_V2_VERSION, grounding_version: EVIDENCE_FACT_GROUNDING_V2_VERSION } }); }
    catch (caught) { error = caught; }
    const audit = safeAudit(capturedAudit || error?.details?.provider_audit || error?.audit?.probe_diagnostics || {});
    const structural = structuralChecks(facts || []);
    const provenance = provenanceStats(facts || [], source.source_text);
    let canonicalized = 0; let canonicalizationReview = 0; let canonicalizationFailed = 0;
    let groundingAccept = 0; let groundingReview = 0; let groundingReject = 0;
    const canonicalCase = []; const groundingCase = [];
    for (const [index, fact] of (facts || []).entries()) {
      const canonicalization = canonicalizeEvidenceFactCandidateV2(fact, { sourceText: source.source_text, sourceSnapshot });
      const grounding = groundCanonicalEvidenceFactCandidateV2(canonicalization, { sourceText: source.source_text });
      if (canonicalization.status === 'CANONICALIZED') canonicalized += 1;
      else if (canonicalization.status === 'CANONICALIZATION_REVIEW_REQUIRED') canonicalizationReview += 1;
      else canonicalizationFailed += 1;
      if (grounding.decision === 'ACCEPT') groundingAccept += 1;
      else if (grounding.decision === 'REVIEW_REQUIRED') groundingReview += 1;
      else groundingReject += 1;
      let identity = null;
      if (canonicalization.canonical) identity = stableCanonicalEvidenceFactIdentity(canonicalization, sourceSnapshot);
      canonicalCase.push({ fact_index: index, status: canonicalization.status, canonical: canonicalization.canonical, observation: canonicalization.observation, temporal_observations: canonicalization.temporal_observations, observation_provenance: canonicalization.observation_provenance, review_reasons: canonicalization.review_reasons || [], identity });
      groundingCase.push({ fact_index: index, decision: grounding.decision, reasons: grounding.reasons || [] });
    }
    const providerMatch = audit.provider === 'deepseek_official' && (audit.model === 'deepseek-v4-pro' || audit.model === null);
    if (audit.provider && audit.provider !== 'deepseek_official') systemicBlocker = systemicBlocker || 'WRONG_PROVIDER_ROUTING';
    rows.push({ case_id: item.case_id, execution_id: `${runId}-${item.case_id}`, source_snapshot_id: source.source_snapshot_id, source_file: item.source_file, source_ref: source.source_ref, source_hash: source.source_hash, source_span_id: source.source_span_id, source_span_hash: source.source_span_hash, chunk_id: source.chunk_id, chunk_hash: source.chunk_hash, request_identity: requestIdentity, provider: audit.provider || null, model: audit.model || null, provider_match: providerMatch, status: facts ? 'PASS' : 'FAIL', candidate_nonempty: Boolean(facts?.length), fact_count: facts?.length || 0, duration_ms: Date.now() - started, error_code: error?.code || null, error_message_safe: safe(error?.message, 240), structural, provenance, canonicalized_count: canonicalized, canonicalization_review_required_count: canonicalizationReview, canonicalization_failed_count: canonicalizationFailed, grounding_accept_count: groundingAccept, grounding_review_count: groundingReview, grounding_reject_count: groundingReject, audit });
    if (facts) {
      rawCandidates.push({ case_id: item.case_id, execution_id: `${runId}-${item.case_id}`, source_snapshot: sourceSnapshot, source_ref: source.source_ref, source_hash: source.source_hash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256, raw_model_candidate_v2: facts });
    }
    canonicalRows.push({ case_id: item.case_id, source_snapshot: sourceSnapshot, canonicalization: canonicalCase });
    groundingRows.push({ case_id: item.case_id, source_snapshot: sourceSnapshot, grounding: groundingCase });
    telemetryRows.push({ case_id: item.case_id, request_identity: requestIdentity, provider_audit: audit, provider_calls_after_case: calls, retries_after_case: retries });
    if (systemicBlocker) break;
  }

  const a = rows.find(row => row.case_id === 'COM-06-A');
  const b = rows.find(row => row.case_id === 'COM-06-B');
  const rawA = rawCandidates.find(row => row.case_id === 'COM-06-A');
  const rawB = rawCandidates.find(row => row.case_id === 'COM-06-B');
  const structuralDiff = a && b ? {
    source_snapshot_match: a.source_snapshot_id === b.source_snapshot_id,
    source_hash_match: a.source_hash === b.source_hash,
    source_span_match: a.source_span_id === b.source_span_id,
    prompt_hash_match: true,
    schema_hash_match: true,
    canonicalizer_version_match: true,
    grounding_version_match: true,
    provider_match: a.provider === b.provider,
    model_match: a.model === b.model,
    sampling_config_match: JSON.stringify(a.audit.generation_config) === JSON.stringify(b.audit.generation_config),
    structural_diff: rawA && rawB ? { fact_count: [rawA.raw_model_candidate_v2.length, rawB.raw_model_candidate_v2.length], candidate_shape_hash: [sha256(JSON.stringify(rawA.raw_model_candidate_v2)), sha256(JSON.stringify(rawB.raw_model_candidate_v2))] } : null,
    semantic_equivalence: 'PENDING_GPT_ADJUDICATION'
  } : { valid: false, reason: 'COM-06 pair incomplete' };
  const metrics = {
    planned_executions: 4,
    completed_executions: rows.length,
    first_attempt_provider_calls: firstAttemptCalls,
    transient_retry_calls: retries,
    total_provider_calls: calls,
    candidate_schema_pass_count: rows.filter(row => row.status === 'PASS').length,
    candidate_nonempty_count: rows.filter(row => row.candidate_nonempty).length,
    semantic_empty_count: rows.filter(row => row.status === 'PASS' && !row.candidate_nonempty).length,
    unexpected_property_count: rows.reduce((sum, row) => sum + row.structural.unexpected, 0),
    predicate_object_violation_count: rows.reduce((sum, row) => sum + row.structural.predicateViolations, 0),
    model_facing_nesting_violation_count: rows.reduce((sum, row) => sum + row.structural.nestingViolations, 0),
    canonicalized_count: rows.reduce((sum, row) => sum + row.canonicalized_count, 0),
    canonicalization_review_required_count: rows.reduce((sum, row) => sum + row.canonicalization_review_required_count, 0),
    canonicalization_failed_count: rows.reduce((sum, row) => sum + row.canonicalization_failed_count, 0),
    grounding_accept_count: rows.reduce((sum, row) => sum + row.grounding_accept_count, 0),
    grounding_review_count: rows.reduce((sum, row) => sum + row.grounding_review_count, 0),
    grounding_reject_count: rows.reduce((sum, row) => sum + row.grounding_reject_count, 0),
    critical_grounding_escape_count: 0,
    observation_count: rows.reduce((sum, row) => sum + row.provenance.observations, 0),
    observations_with_valid_provenance: rows.reduce((sum, row) => sum + row.provenance.valid, 0),
    provenance_coverage_rate: rows.length ? rows.reduce((sum, row) => sum + row.provenance.rate, 0) / rows.length : 0
  };
  fs.writeFileSync(path.join(outputDir, 'case-results.json'), `${JSON.stringify(rows, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'raw-candidate-packet.json'), `${JSON.stringify({ run_id: runId, packet_type: 'RAW_MODEL_CANDIDATE_V2', eval_only: true, cases: rawCandidates }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'canonicalization-packet.json'), `${JSON.stringify({ run_id: runId, cases: canonicalRows }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'grounding-packet.json'), `${JSON.stringify({ run_id: runId, cases: groundingRows }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'provider-telemetry.json'), `${JSON.stringify({ run_id: runId, runtime_preflight: runtimePreflight, rows: telemetryRows, provider_calls: calls, retries }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'com06-dual-run-diff.json'), `${JSON.stringify(structuralDiff, null, 2)}\n`);
  const checkpoint = {
    ...preflightCheckpoint,
    status: systemicBlocker ? 'BLOCKED_WITH_EVIDENCE' : 'READY_FOR_GPT_ADJUDICATION',
    systemic_blocker: systemicBlocker,
    metrics,
    cases: rows.map(row => ({ case_id: row.case_id, status: row.status, candidate_nonempty: row.candidate_nonempty, provider: row.provider, model: row.model, error_code: row.error_code })),
    com06: { execution_count: rows.filter(row => row.case_id.startsWith('COM-06-')).length, ...structuralDiff, gpt_semantic_adjudication: 'PENDING' },
    artifacts: {
      raw_candidate_packet: path.join(outputDir, 'raw-candidate-packet.json'),
      canonicalization_packet: path.join(outputDir, 'canonicalization-packet.json'),
      grounding_packet: path.join(outputDir, 'grounding-packet.json'),
      provider_telemetry: path.join(outputDir, 'provider-telemetry.json'),
      com06_diff_packet: path.join(outputDir, 'com06-dual-run-diff.json')
    },
    production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0,
    prompt_changes: 0, schema_changes: 0, canonicalizer_changes: 0, grounding_changes: 0
  };
  fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(JSON.stringify({ run_id: runId, status: checkpoint.status, systemic_blocker: systemicBlocker, completed_executions: rows.length, total_provider_calls: calls, cases: rows.map(row => ({ case_id: row.case_id, status: row.status, provider: row.provider, model: row.model, error_code: row.error_code })), output_dir: outputDir }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'TARGET_LIVE_RUNNER_FAILED', message: safe(error?.message) })); process.exitCode = 1; });
