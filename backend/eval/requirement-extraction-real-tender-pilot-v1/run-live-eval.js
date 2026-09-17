import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  assertRequirementExtractionProviderInputParity,
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  applyTableAnnotationsToChunks,
  applyTableAnnotationsToParagraphs,
  annotatePdfTableLayout,
  collectPdfLayout
} from '../../src/pipeline/pdf-table-layout-annotator.js';
import { getSemanticTaskContract } from '../../../packages/semantic-contracts/index.js';
import {
  loadSemanticGatewayEnvironment,
  readSemanticGatewayRuntimeConfig,
  SEMANTIC_GATEWAY_DEFAULT_TIMEOUT_MS
} from '../../../packages/semantic-contracts/runtime-config.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { mapValidatedCandidatesToCanonicalInput } from '../../src/verification/requirement-extraction-verifier.js';
import { buildRealProductionPath } from './production-path.js';
import {
  buildStableProvenanceIndex,
  calculateEvaluationPrecision,
  projectStableRangeToRetained,
  resolveStableRange
} from './evaluation-matching.js';
import {
  buildCandidateArtifact,
  buildChunkArtifact,
  buildFailedChunkArtifact,
  buildMappingEvidence,
  buildSuccessfulChunkArtifact,
  beginCertifiedCaptureArtifact,
  persistCertifiedArtifactFile,
  persistCertifiedRequestArtifact,
  persistCertifiedResponseArtifact
} from './evaluation-artifact.js';
import {
  EVALUATION_CONTRACT_VERSION,
  EVALUATOR_REVISION,
  certifyEvaluation,
  validateEvaluationArtifactIdentity
} from './evaluation-certification.js';
import {
  buildHoldoutExecutionIdentity,
  classifyHoldoutFirstFailure
} from '../requirement-unseen-holdout-v2/failure-observability.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const reportDirectory = resolve(here, '../reports');
const reportPath = resolve(reportDirectory, 'reqx-v3-real-tender-eval-capture-v2.json');
const adjudicationPath = resolve(reportDirectory, 'reqx-v3-adjudication-199.json');
const unmatchedPath = resolve(reportDirectory, 'reqx-v3-unmatched-candidates.json');
const packetDirectory = resolve(here, 'semantic-boundary-v1.1', 'packets');
const ids = ['FAST-01', 'FAST-WATER-01', 'TB-006'];
const expectedGoldCounts = { 'FAST-01': 39, 'FAST-WATER-01': 114, 'TB-006': 46 };
const expectedGoldCount = Object.values(expectedGoldCounts).reduce((sum, value) => sum + value, 0);
const datasetVersion = 'reqx-v3-real-tender-gold-pilot-v1.1-semantic-boundary';
const runId = 'reqx-v3-real-tender-eval-capture-v2';
const requirementContract = getSemanticTaskContract('requirement_extraction');
const CANDIDATE_SCHEMA_HASH = '1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba';
const EXPECTED_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const EXPECTED_PROMPT = '4.3-requirement-extraction-v3.1.1';
const EXPECTED_PROMPT_HASH = '9b8fe6582e774a64f36b2be307274e297fafb309cf17270a4d8fc463da817305';
const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerOr(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanOr(value, fallback) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function urlHost(value) {
  try { return new URL(String(value || '')).host || null; } catch (_error) { return null; }
}

function responseFormatIdentity() {
  return {
    type: 'json_schema',
    strict: true,
    schema_name: 'requirement_extraction_data',
    schema_hash: sha256(JSON.stringify(requirementContract.data_schema))
  };
}

/** Build the complete non-secret runtime identity used by certified artifacts. */
export function buildProductionRuntimeIdentity({ env = {}, info = {}, gatewayEnv = env, providerTimeoutMs = null } = {}) {
  const runtime = readSemanticGatewayRuntimeConfig(gatewayEnv);
  const providerTimeout = integerOr(providerTimeoutMs ?? gatewayEnv.SEMANTIC_GATEWAY_TIMEOUT_MS, SEMANTIC_GATEWAY_DEFAULT_TIMEOUT_MS);
  const gatewayTimeout = integerOr(
    env.SEMANTIC_GATEWAY_REQUIREMENT_EXTRACTION_TIMEOUT_MS || env.SEMANTIC_GATEWAY_TIMEOUT_MS,
    300000
  );
  const model = String(info.model || runtime.model || gatewayEnv.SEMANTIC_GATEWAY_MODEL || '').trim() || null;
  const generation = {
    enable_thinking: booleanOr(gatewayEnv.SEMANTIC_GATEWAY_ENABLE_THINKING, false),
    response_format: responseFormatIdentity(),
    temperature: numberOr(gatewayEnv.SEMANTIC_GATEWAY_TEMPERATURE, 0.1),
    top_p: numberOr(gatewayEnv.SEMANTIC_GATEWAY_TOP_P, 0.9),
    top_k: integerOr(gatewayEnv.SEMANTIC_GATEWAY_TOP_K, 20),
    frequency_penalty: numberOr(gatewayEnv.SEMANTIC_GATEWAY_FREQUENCY_PENALTY, 0),
    max_tokens: integerOr(gatewayEnv.SEMANTIC_GATEWAY_MAX_TOKENS, 4800),
    stream: booleanOr(gatewayEnv.SEMANTIC_GATEWAY_STREAM, false),
    n: integerOr(gatewayEnv.SEMANTIC_GATEWAY_N, 1)
  };
  return {
    gateway_base_url: runtime.gatewayApiBase || gatewayEnv.SEMANTIC_GATEWAY_API_BASE || null,
    gateway_host: urlHost(runtime.gatewayApiBase || gatewayEnv.SEMANTIC_GATEWAY_API_BASE),
    provider: runtime.provider || gatewayEnv.SEMANTIC_GATEWAY_PROVIDER || null,
    provider_host: urlHost(runtime.providerApiBase || gatewayEnv.SEMANTIC_GATEWAY_PROVIDER_API_BASE),
    task_type: 'requirement_extraction',
    model,
    prompt_contract: info.requirement_extraction_contract_version || EXPECTED_PROMPT,
    prompt_instruction_hash: info.requirement_extraction_prompt_hash || EXPECTED_PROMPT_HASH,
    candidate_contract: info.candidate_schema_contract_version || '4.3-requirement-candidate-v3',
    candidate_schema_hash: info.candidate_schema_sha256 || CANDIDATE_SCHEMA_HASH,
    gateway_schema_version: info.gateway_schema_version || 'semantic-gateway-envelope-v1',
    build_revision: info.build_revision || gatewayEnv.SEMANTIC_GATEWAY_BUILD_REVISION || env.BUILD_REVISION || null,
    working_tree_dirty: typeof info.working_tree_dirty === 'boolean' ? info.working_tree_dirty : null,
    service_key_present: Boolean(runtime.serviceApiKey || gatewayEnv.SEMANTIC_GATEWAY_API_KEY),
    provider_key_present: Boolean(runtime.providerApiKey || gatewayEnv.SEMANTIC_GATEWAY_PROVIDER_API_KEY),
    timeout_ms: providerTimeout,
    gateway_request_timeout_ms: gatewayTimeout,
    generation,
    retry_count: 0,
    fallback_count: 0,
    dify_call_count: 0,
    chunk_budget: { singleCallThreshold: 2000, characterBudget: 2000, tokenBudget: 8000, sourceSpanBudget: 100 }
  };
}

function stableRuntimeIdentity(identity) {
  return `sha256:${sha256(JSON.stringify(identity))}`;
}

/** Hash the actual prepared production chunks, inputs, refs and table metadata. */
export function buildProvenanceCaptureIdentity(preparedPaths = []) {
  const canonical = (Array.isArray(preparedPaths) ? preparedPaths : []).map((prepared) => ({
    tender_id: prepared.tender_id,
    source_file: prepared.source_file,
    source_file_sha256: prepared.source_file_sha256,
    raw_selected_character_count: prepared.raw_selected_character_count,
    parsed_span_count: prepared.parsed_span_count,
    chunks: (prepared.chunks || []).map((chunk) => ({
      id: chunk.id,
      chunk_number: chunk.chunk_number,
      character_count: chunk.character_count,
      provider_input_sha256: sha256(resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text })),
      source_refs: (chunk.segments || []).map((segment) => ({
        source_ref: segment.source_ref,
        text_sha256: sha256(segment.text),
        page: segment.page ?? null,
        paragraph: segment.paragraph ?? null,
        routing_role: segment.routing_role ?? null,
        semantic_unit_type: segment.semantic_unit_type ?? null
      })),
      table_units_sha256: sha256(JSON.stringify(chunk.table_units || []))
    }))
  }));
  return `sha256:${sha256(JSON.stringify(canonical))}`;
}

function safeDiagnostic(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    gateway_http_status: Number.isInteger(value.gateway_http_status) ? value.gateway_http_status : null,
    gateway_error_code: typeof value.gateway_error_code === 'string' ? value.gateway_error_code.slice(0, 120) : null,
    semantic_error_code: typeof value.semantic_error_code === 'string' ? value.semantic_error_code.slice(0, 120) : null,
    provider_error_code: typeof value.provider_error_code === 'string' ? value.provider_error_code.slice(0, 120) : null,
    provider: typeof value.provider === 'string' ? value.provider.slice(0, 80) : null,
    model: typeof value.model === 'string' ? value.model.slice(0, 120) : null,
    configured_provider: typeof value.configured_provider === 'string' ? value.configured_provider.slice(0, 80) : null,
    configured_model: typeof value.configured_model === 'string' ? value.configured_model.slice(0, 120) : null,
    requested_provider: typeof value.requested_provider === 'string' ? value.requested_provider.slice(0, 80) : null,
    requested_model: typeof value.requested_model === 'string' ? value.requested_model.slice(0, 120) : null,
    response_provider: typeof value.response_provider === 'string' ? value.response_provider.slice(0, 80) : null,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint.slice(0, 120) : null,
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    provider_http_reached: value.provider_http_reached === true,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    json_parse_success: value.json_parse_success === true ? true : value.json_parse_success === false ? false : null,
    failure_stage: typeof value.failure_stage === 'string' ? value.failure_stage.slice(0, 80) : null,
    safe_error_code: typeof value.safe_error_code === 'string' ? value.safe_error_code.slice(0, 80) : null,
    safe_error_message: typeof value.safe_error_message === 'string' ? value.safe_error_message.slice(0, 240) : null,
    response_id: typeof value.response_id === 'string' ? value.response_id.slice(0, 128) : null,
    provider_trace_id: typeof value.provider_trace_id === 'string' ? value.provider_trace_id.slice(0, 128) : null,
    finish_reason: typeof value.finish_reason === 'string' ? value.finish_reason : null,
    prompt_tokens: Number.isInteger(value.prompt_tokens) ? value.prompt_tokens : null,
    completion_tokens: Number.isInteger(value.completion_tokens) ? value.completion_tokens : null,
    total_tokens: Number.isInteger(value.total_tokens) ? value.total_tokens : null,
    output_truncated: value.output_truncated === true,
    response_model: typeof value.response_model === 'string' ? value.response_model : null,
    response_format_type: value.response_format_type === 'json_schema' ? 'json_schema' : value.response_format_type === 'json_object' ? 'json_object' : null,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    provider_http_reached: value.provider_http_reached === true,
    schema_validation_errors: Array.isArray(value.schema_validation_errors)
      ? value.schema_validation_errors.slice(0, 100).map(item => ({
        stage: typeof item?.stage === 'string' ? item.stage.slice(0, 40) : null,
        path: typeof item?.path === 'string' ? item.path.slice(0, 200) : null,
        keyword: typeof item?.keyword === 'string' ? item.keyword.slice(0, 80) : null,
        expected: typeof item?.expected === 'string' ? item.expected.slice(0, 240) : null,
        actual_type: typeof item?.actual_type === 'string' ? item.actual_type.slice(0, 80) : null,
        additional_property: typeof item?.additional_property === 'string' ? item.additional_property.slice(0, 120) : null,
        message: typeof item?.message === 'string' ? item.message.slice(0, 240) : null
      })) : []
  };
}

export async function buildAnnotatedPath(packet, env) {
  const prepared = await buildRealProductionPath(packet, { repoRoot, env });
  let chunks = prepared.chunks;
  let tableAnnotation = { status: 'NOT_AVAILABLE', rows: 0, ambiguous_rows: 0 };
  try {
    const sourceBuffer = await readFile(resolve(repoRoot, packet.source_file));
    const pages = [...new Set(prepared.scope.paragraphs.map((item) => Number(item.page)).filter((page) => Number.isInteger(page) && page > 0))];
    const layout = await collectPdfLayout(sourceBuffer, { pages });
    const annotations = annotatePdfTableLayout({ paragraphs: prepared.scope.paragraphs, layout });
    const annotatedParagraphs = applyTableAnnotationsToParagraphs(
      prepared.scope.paragraphs,
      annotations.rows,
      annotations.headers
    );
    chunks = applyTableAnnotationsToChunks(chunks, annotatedParagraphs);
    tableAnnotation = { status: 'APPLIED', rows: annotations.rows.length, ambiguous_rows: Number(annotations.ambiguous_rows || 0) };
  } catch (error) {
    tableAnnotation = { status: 'UNAVAILABLE', rows: 0, ambiguous_rows: 0, error_code: error?.code || 'PDF_LAYOUT_ANNOTATION_UNAVAILABLE' };
  }
  return { ...prepared, chunks, table_annotation: tableAnnotation };
}

export async function runTender(packet, prepared, gateway, capture = null, options = {}) {
  const resolver = new SourceLocationResolver();
  const chunks = prepared.chunks;
  const providerInputs = chunks.map((chunk) => assertRequirementExtractionProviderInputParity({
    chunk,
    fallbackText: chunk.text,
    actualInput: Object.hasOwn(chunk, 'provider_input_text')
      ? chunk.provider_input_text
      : resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text })
  }));
  const results = new Array(chunks.length);
  let nextIndex = 0;
  const execute = async (chunk, index) => {
    const started = Date.now();
    const requestStartedAt = new Date().toISOString();
    const providerInput = providerInputs[index];
    const executionIdentity = buildHoldoutExecutionIdentity({
      tenderId: packet.tender_id,
      chunkNumber: chunk.chunk_number,
      sourceChunkId: chunk.id,
      requestHash: sha256(providerInput)
    });
    if (capture) {
      await persistCertifiedRequestArtifact({
        artifactRoot: capture.artifactRoot,
        sourceCaptureRunId: capture.sourceCaptureRunId,
        tenderId: packet.tender_id,
        chunkNumber: chunk.chunk_number,
        request: {
          source_capture_run_id: capture.sourceCaptureRunId,
          tender_id: packet.tender_id,
          chunk_id: chunk.id,
          chunk_number: chunk.chunk_number,
          source_refs: chunk.segments.map((segment) => segment.source_ref),
          provider_ready_input_text: providerInput,
          provider_input_sha256: sha256(providerInput),
          table_semantic_presentation: clone(chunk.table_units || []),
          prompt_contract: capture.runtimeIdentity.prompt_contract,
          prompt_instruction_hash: capture.runtimeIdentity.prompt_instruction_hash,
          candidate_contract: capture.runtimeIdentity.candidate_contract,
          candidate_schema_hash: capture.runtimeIdentity.candidate_schema_hash,
          model: capture.runtimeIdentity.model,
          generation: clone(capture.runtimeIdentity.generation),
          production_runtime_identity: capture.runtimeIdentityString,
          request_started_at: requestStartedAt
        }
      });
    }
    try {
      const gatewayResult = await gateway.extract({
        fileName: packet.source_file,
        text: providerInput,
        paragraphs: chunk.segments,
        chunk,
        projectName: packet.title,
        sectionName: packet.source_extraction.selection?.title || packet.source_extraction.selection?.section_key || packet.tender_id,
        chunkCount: chunks.length,
        diagnosticMode: 'probe-v1'
      });
      const resolutions = gatewayResult.candidates.map((candidate) => resolver.resolve(candidate, chunk));
      const canonical = mapValidatedCandidatesToCanonicalInput(gatewayResult.candidates, { resolutions });
      const diagnostic = safeDiagnostic({
        ...(gatewayResult.audit || {}),
        ...(gatewayResult.audit?.probe_diagnostics || {})
      });
      const runtimeCandidates = gatewayResult.candidates.map((candidate, candidateIndex) => ({
        candidate,
        chunk_number: chunk.chunk_number,
        source_excerpt: resolutions[candidateIndex].location.source_text,
        source_verified: resolutions[candidateIndex].location.source_verified === true,
        source_match_type: resolutions[candidateIndex].location.source_match_type,
        source_start_offset: resolutions[candidateIndex].location.source_start_offset,
        source_end_offset: resolutions[candidateIndex].location.source_end_offset
      }));
      if (capture) {
        await persistCertifiedResponseArtifact({
          artifactRoot: capture.artifactRoot,
          sourceCaptureRunId: capture.sourceCaptureRunId,
          tenderId: packet.tender_id,
          chunkNumber: chunk.chunk_number,
          response: {
            source_capture_run_id: capture.sourceCaptureRunId,
            tender_id: packet.tender_id,
            chunk_id: chunk.id,
            chunk_number: chunk.chunk_number,
            provider_http_status: diagnostic?.provider_http_status ?? null,
            finish_reason: diagnostic?.finish_reason ?? null,
            prompt_tokens: diagnostic?.prompt_tokens ?? null,
            completion_tokens: diagnostic?.completion_tokens ?? null,
            output_truncated: diagnostic?.output_truncated === true,
            schema_pass: true,
            parse_pass: diagnostic?.json_parse_success !== false,
            source_resolution_pass: runtimeCandidates.every((item) => item.source_verified),
            backend_ingestion_pass: canonical.length === runtimeCandidates.length,
            candidate_count: runtimeCandidates.length,
            raw_gateway_response_payload_json: typeof gatewayResult.audit?.raw_response_payload_json === 'string'
              ? gatewayResult.audit.raw_response_payload_json : 'RAW_PROVIDER_TEXT_UNAVAILABLE',
            parsed_candidates: clone(gatewayResult.candidates),
            response_received_at: new Date().toISOString(),
            runtime_ms: Date.now() - started
          }
        });
      }
      results[index] = {
        ok: true,
        ...executionIdentity,
        started_at: requestStartedAt,
        finished_at: new Date().toISOString(),
        chunk_number: chunk.chunk_number,
        character_count: chunk.character_count,
        span_count: chunk.segments.length,
        provider_http_status: diagnostic?.provider_http_status ?? null,
        finish_reason: diagnostic?.finish_reason ?? null,
        prompt_tokens: diagnostic?.prompt_tokens ?? null,
        completion_tokens: diagnostic?.completion_tokens ?? null,
        output_truncated: diagnostic?.output_truncated === true,
        provider_chain_verified: diagnostic?.provider_adapter_invoked === true && diagnostic?.fetch_invoked === true && diagnostic?.provider_http_reached === true && diagnostic?.provider_http_status === 200,
        candidate_count: runtimeCandidates.length,
        schema_pass: true,
        source_resolution_pass: runtimeCandidates.every((item) => item.source_verified),
        backend_ingestion_pass: canonical.length === runtimeCandidates.length,
        unresolved_ref_count: 0,
        duplicate_ref_failure_count: 0,
        non_contiguous_ref_failure_count: 0,
        runtime_ms: Date.now() - started,
        raw_model_output: typeof gatewayResult.audit?.raw_response_payload_json === 'string'
          ? gatewayResult.audit.raw_response_payload_json : null,
        first_failure_stage: null,
        first_failure_code: null,
        failure_family: null,
        diagnostic,
        _runtime_candidates: runtimeCandidates,
        _chunk: chunk
      };
    } catch (error) {
      const diagnostic = safeDiagnostic({
        ...(error?.audit || {}),
        ...(error?.audit?.probe_diagnostics || {})
      });
      if (capture) {
        await persistCertifiedResponseArtifact({
          artifactRoot: capture.artifactRoot,
          sourceCaptureRunId: capture.sourceCaptureRunId,
          tenderId: packet.tender_id,
          chunkNumber: chunk.chunk_number,
          response: {
            source_capture_run_id: capture.sourceCaptureRunId,
            tender_id: packet.tender_id,
            chunk_id: chunk.id,
            chunk_number: chunk.chunk_number,
            provider_http_status: diagnostic?.provider_http_status ?? error?.audit?.http_status ?? null,
            finish_reason: diagnostic?.finish_reason ?? null,
            prompt_tokens: diagnostic?.prompt_tokens ?? null,
            completion_tokens: diagnostic?.completion_tokens ?? null,
            output_truncated: diagnostic?.output_truncated === true,
            schema_pass: false,
            parse_pass: false,
            source_resolution_pass: false,
            backend_ingestion_pass: false,
            candidate_count: 0,
            schema_error: error?.message || null,
            raw_gateway_response_payload_json: typeof error?.audit?.raw_response_payload_json === 'string'
              ? error.audit.raw_response_payload_json : 'RAW_PROVIDER_TEXT_UNAVAILABLE',
            candidates: [],
            response_received_at: new Date().toISOString(),
            runtime_ms: Date.now() - started
          }
        });
      }
      const sourceFailure = error?.code === 'SOURCE_LOCATION_UNRESOLVED' || error?.code === 'GATEWAY_REQUIREMENTS_INVALID';
      const failure = classifyHoldoutFirstFailure({
        errorCode: error?.code,
        diagnostic,
        schemaPass: false,
        ok: false
      });
      results[index] = {
        ok: false,
        ...executionIdentity,
        started_at: requestStartedAt,
        finished_at: new Date().toISOString(),
        chunk_number: chunk.chunk_number,
        character_count: chunk.character_count,
        span_count: chunk.segments.length,
        provider_http_status: diagnostic?.provider_http_status ?? error?.audit?.http_status ?? null,
        finish_reason: diagnostic?.finish_reason ?? null,
        prompt_tokens: diagnostic?.prompt_tokens ?? null,
        completion_tokens: diagnostic?.completion_tokens ?? null,
        output_truncated: diagnostic?.output_truncated === true,
        provider_chain_verified: diagnostic?.provider_adapter_invoked === true && diagnostic?.fetch_invoked === true && diagnostic?.provider_http_reached === true && diagnostic?.provider_http_status === 200,
        candidate_count: 0,
        schema_pass: false,
        source_resolution_pass: sourceFailure ? false : null,
        backend_ingestion_pass: false,
        unresolved_ref_count: sourceFailure ? 1 : 0,
        duplicate_ref_failure_count: /重复引用/.test(error?.message || '') ? 1 : 0,
        non_contiguous_ref_failure_count: /连续|反向/.test(error?.message || '') ? 1 : 0,
        runtime_ms: Date.now() - started,
        raw_model_output: typeof error?.audit?.raw_response_payload_json === 'string'
          ? error.audit.raw_response_payload_json : null,
        error_code: error?.code || 'REQUIREMENT_EXTRACTION_FAILED',
        error_message: typeof error?.message === 'string' ? error.message : null,
        first_failure_stage: failure.first_failure_stage,
        first_failure_code: failure.first_failure_code,
        failure_family: failure.family,
        diagnostic,
        _runtime_candidates: [],
        _chunk: chunk,
        _failed_artifact: buildFailedChunkArtifact({ tenderId: packet.tender_id, chunk, diagnostics: diagnostic, error })
      };
    }
  };
  const requestedConcurrency = Number.isInteger(options?.concurrency) && options.concurrency > 0
    ? options.concurrency : 2;
  const workerCount = Math.max(1, Math.min(chunks.length || 1, requestedConcurrency));
  const worker = async () => { while (true) { const index = nextIndex++; if (index >= chunks.length) return; await execute(chunks[index], index); } };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const rawCandidates = results.flatMap((result) => result._runtime_candidates || []);
  const candidateArtifacts = rawCandidates.map((entry, index) => buildCandidateArtifact({ tenderId: packet.tender_id, candidateIndex: index, candidate: entry.candidate }));
  let offset = 0;
  const chunkResults = results.map((result) => {
    const count = result._runtime_candidates?.length || 0;
    const candidates = candidateArtifacts.slice(offset, offset + count);
    offset += count;
    const artifact = result.ok
      ? buildSuccessfulChunkArtifact({ tenderId: packet.tender_id, chunk: result._chunk, diagnostics: result.diagnostic, candidates })
      : result._failed_artifact;
    return {
      ...artifact,
      execution_id: result.execution_id,
      request_hash: result.request_hash,
      tender_id: packet.tender_id,
      source_chunk_id: result.source_chunk_id,
      started_at: result.started_at,
      finished_at: result.finished_at,
      ok: result.ok,
      provider_chain_verified: result.provider_chain_verified,
      candidate_count: result.candidate_count,
      schema_pass: result.schema_pass,
      source_resolution_pass: result.source_resolution_pass,
      backend_ingestion_pass: result.backend_ingestion_pass,
      unresolved_ref_count: result.unresolved_ref_count,
      duplicate_ref_failure_count: result.duplicate_ref_failure_count,
      non_contiguous_ref_failure_count: result.non_contiguous_ref_failure_count,
      runtime_ms: result.runtime_ms,
      diagnostic: result.diagnostic,
      raw_model_output: result.raw_model_output || null,
      first_failure_stage: result.first_failure_stage,
      first_failure_code: result.first_failure_code,
      failure_family: result.failure_family,
      error_code: result.error_code || null,
      error_message: result.error_message || null,
      candidate_ids: candidates.map((candidate) => candidate.candidate_id)
    };
  });
  const candidateRecords = rawCandidates.map((entry, index) => ({
    ...candidateArtifacts[index],
    chunk_number: entry.chunk_number,
    source_excerpt: entry.source_excerpt,
    source_verified: entry.source_verified,
    source_match_type: entry.source_match_type,
    source_start_offset: entry.source_start_offset,
    source_end_offset: entry.source_end_offset
  }));
  return {
    tender_id: packet.tender_id,
    source_file: packet.source_file,
    source_file_sha256: packet.source_file_sha256,
    production_chunk_count: chunks.length,
    chunk_character_sizes: chunks.map((chunk) => chunk.character_count),
    chunk_span_counts: chunks.map((chunk) => chunk.segments.length),
    provider_request_count: results.filter((result) => result.diagnostic?.provider_adapter_invoked === true || result.diagnostic?.fetch_invoked === true || Number.isInteger(result.provider_http_status)).length,
    retry_count: 0,
    fallback_count: 0,
    table_annotation: prepared.table_annotation,
    chunk_results: chunkResults,
    candidates: candidateArtifacts,
    _candidate_records: candidateRecords,
    _raw_results: results
  };
}

function rangeContext(packet, prepared) {
  const flat = prepared.chunks.flatMap((chunk) => chunk.segments);
  const currentIndex = buildStableProvenanceIndex(flat);
  const historicalSpans = packet.windows.flatMap((window) => window.spans);
  const historicalIndex = buildStableProvenanceIndex(historicalSpans);
  const chunk = new Map();
  for (const currentChunk of prepared.chunks) {
    for (const span of currentChunk.segments) {
      const record = currentIndex.byRef.get(span.source_ref);
      if (record) chunk.set(record.key, currentChunk.chunk_number);
    }
  }
  const routedSpans = Array.isArray(prepared.routed_sections)
    ? prepared.routed_sections.flatMap((section) => Array.isArray(section?.paragraphs) ? section.paragraphs : [])
    : [];
  const selectedSpans = Array.isArray(prepared.selected_paragraphs) ? prepared.selected_paragraphs : [];
  return {
    flat,
    currentIndex,
    historicalIndex,
    chunk,
    // Controlled-window selections expose only raw text/page metadata.  The
    // routed paragraphs are the canonical current source view because they
    // retain offsets, routing role, and the parser's source identity needed
    // for stable historical-to-current projection.
    allCurrentSpans: routedSpans.length ? routedSpans : (selectedSpans.length ? selectedSpans : flat)
  };
}

export function buildEvaluationRangeContext(packet, prepared) {
  return rangeContext(packet, prepared);
}

function excerpt(prepared, startRef, endRef) {
  const flat = prepared.chunks.flatMap((chunk) => chunk.segments);
  const start = flat.findIndex((span) => span.source_ref === startRef);
  const end = flat.findIndex((span) => span.source_ref === endRef);
  return start >= 0 && end >= start ? flat.slice(start, end + 1).map((span) => span.text).join('\n') : null;
}

function providerChunks(prepared, startRef, endRef) {
  const flat = prepared.chunks.flatMap((chunk) => chunk.segments);
  const start = flat.findIndex((span) => span.source_ref === startRef);
  const end = flat.findIndex((span) => span.source_ref === endRef);
  if (start < 0 || end < start) return [];
  const refs = new Set(flat.slice(start, end + 1).map((span) => span.source_ref));
  return prepared.chunks
    .filter((chunk) => chunk.segments.some((span) => refs.has(span.source_ref)))
    .map((chunk) => ({
      chunk_number: chunk.chunk_number,
      source_refs: chunk.segments.map((span) => span.source_ref),
      provider_input_text: resolveRequirementExtractionProviderInput({
        chunk,
        fallbackText: chunk.text
      })
    }));
}

export function evaluateTender(packet, run, prepared) {
  const {
    flat,
    currentIndex,
    historicalIndex,
    chunk,
    allCurrentSpans
  } = rangeContext(packet, prepared);
  const gold = packet.gold_requirements.map((item) => {
    const projectedRange = projectStableRangeToRetained({
      range: item.source_range,
      historicalSpans: historicalIndex.records.map((record) => record.span),
      retainedSpans: flat,
      allCurrentSpans,
      isExcluded: (span) => !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(span?.routing_role)
    });
    const startKey = projectedRange?.start_key || null;
    const endKey = projectedRange?.end_key || null;
    const start = currentIndex.byKey.get(startKey);
    const end = currentIndex.byKey.get(endKey);
    return {
      ...item,
      start_ref: projectedRange?.start_ref || start?.ref || null,
      end_ref: projectedRange?.end_ref || end?.ref || null,
      start_key: startKey, end_key: endKey, start: start?.position, end: end?.position,
      cross_chunk: start && end ? chunk.get(start.key) !== chunk.get(end.key) : false
    };
  });
  const candidates = run._candidate_records.map((item) => {
    const stableRange = resolveStableRange(item.source_range, currentIndex);
    return {
      ...item, start_key: stableRange?.start_key, end_key: stableRange?.end_key,
      start: stableRange?.start_position, end: stableRange?.end_position,
      source_range_valid: Boolean(stableRange)
    };
  });
  const exactByGold = new Map();
  // recall/precision/f1 and TP/FP/FN below are SOURCE-RANGE ALIGNMENT
  // DIAGNOSTICS only. They are not semantic quality metrics and must never
  // be used as Freeze/release thresholds; those require Gold adjudication.
  for (const candidate of candidates) if (candidate.source_range_valid) for (const item of gold) if (candidate.start === item.start && candidate.end === item.end) exactByGold.set(item.gold_id, [...(exactByGold.get(item.gold_id) || []), candidate]);
  const matched = new Set();
  const tpGold = new Set();
  const tpCandidates = new Set();
  const duplicates = new Set();
  const overSplitGold = new Set();
  const boundaryGold = new Set();
  const wrongMergeGold = new Set();
  const wrongMerges = [];
  const manualReview = [];
  const automaticMatches = [];
  const fieldErrors = { category: 0, mandatory_observed: 0, requires_confirmation: 0 };
  for (const item of gold) {
    const exact = exactByGold.get(item.gold_id) || [];
    if (exact.length) {
      const [primary, ...extra] = exact;
      tpGold.add(item.gold_id); tpCandidates.add(primary.candidate_id); matched.add(primary.candidate_id); extra.forEach((candidate) => { duplicates.add(candidate.candidate_id); matched.add(candidate.candidate_id); });
      if (extra.length) overSplitGold.add(item.gold_id);
      if (primary.category !== item.category) fieldErrors.category += 1;
      if (primary.mandatory_observed !== item.mandatory_observed) fieldErrors.mandatory_observed += 1;
      if (primary.requires_confirmation !== item.requires_confirmation) fieldErrors.requires_confirmation += 1;
      automaticMatches.push({ gold_id: item.gold_id, candidate_ids: exact.map((candidate) => candidate.candidate_id), verdict: extra.length ? 'EXACT_RANGE_DUPLICATE' : 'EXACT_RANGE', reason: 'candidate range equals Gold range', matcher_evidence: { exact: true, stable_source_range: { start_key: item.start_key, end_key: item.end_key }, candidate_ranges: exact.map((candidate) => candidate.source_range) } });
      continue;
    }
    const inside = candidates.filter((candidate) => candidate.source_range_valid && candidate.start >= item.start && candidate.end <= item.end).sort((a, b) => a.start - b.start || a.end - b.end);
    let cursor = item.start; const covering = [];
    for (const candidate of inside) { if (candidate.start !== cursor) continue; covering.push(candidate); cursor = candidate.end + 1; if (cursor > item.end) break; }
    if (covering.length > 1 && cursor === item.end + 1) {
      tpGold.add(item.gold_id); tpCandidates.add(covering[0].candidate_id); covering.forEach((candidate) => matched.add(candidate.candidate_id)); covering.slice(1).forEach((candidate) => duplicates.add(candidate.candidate_id)); overSplitGold.add(item.gold_id); if (item.cross_chunk) boundaryGold.add(item.gold_id);
      automaticMatches.push({ gold_id: item.gold_id, candidate_ids: covering.map((candidate) => candidate.candidate_id), verdict: 'CONTIGUOUS_COVERAGE', reason: 'contiguous candidate ranges cover Gold range', matcher_evidence: { contiguous: true, stable_source_range: { start_key: item.start_key, end_key: item.end_key }, candidate_ranges: covering.map((candidate) => candidate.source_range) } });
      continue;
    }
    const overlaps = candidates.filter((candidate) => candidate.source_range_valid && candidate.start <= item.end && candidate.end >= item.start);
    if (overlaps.length) { overlaps.forEach((candidate) => matched.add(candidate.candidate_id)); const review = { gold_id: item.gold_id, candidate_ids: overlaps.map((candidate) => candidate.candidate_id), reason: 'PARTIAL_OR_NON_EXACT_SOURCE_RANGE' }; manualReview.push(review); automaticMatches.push({ ...review, verdict: 'PARTIAL_OVERLAP', matcher_evidence: { overlap: true, stable_source_range: { start_key: item.start_key, end_key: item.end_key }, candidate_ranges: overlaps.map((candidate) => candidate.source_range) } }); }
    else automaticMatches.push({ gold_id: item.gold_id, candidate_ids: [], verdict: 'UNMATCHED', reason: 'no candidate source range overlap', matcher_evidence: { overlap: false } });
  }
  for (const candidate of candidates) {
    if (matched.has(candidate.candidate_id)) continue;
    const overlaps = gold.filter((item) => candidate.source_range_valid && candidate.start <= item.end && candidate.end >= item.start);
    if (overlaps.length > 1) { overlaps.forEach((item) => wrongMergeGold.add(item.gold_id)); wrongMerges.push({ candidate_id: candidate.candidate_id, gold_ids: overlaps.map((item) => item.gold_id) }); matched.add(candidate.candidate_id); manualReview.push({ gold_id: overlaps.map((item) => item.gold_id), candidate_ids: [candidate.candidate_id], reason: 'CANDIDATE_SPANS_MULTIPLE_GOLD_ITEMS' }); }
  }
  const falseCandidates = candidates.filter((candidate) => !matched.has(candidate.candidate_id));
  const unmatchedIds = new Set([...falseCandidates.map((candidate) => candidate.candidate_id), ...duplicates, ...manualReview.flatMap((item) => item.candidate_ids || []), ...wrongMerges.map((item) => item.candidate_id)]);
  const tp = tpGold.size; const extracted = candidates.length; const fp = falseCandidates.length + duplicates.size; const tpCandidateCount = tpCandidates.size; const reviewCandidateCount = new Set(manualReview.flatMap((item) => item.candidate_ids || [])).size; const fn = gold.length - tp;
  const automatic = buildMappingEvidence({
    goldItems: packet.gold_requirements,
    candidates: run.candidates,
    automaticMatches,
    falsePositiveIds: [...new Set([...falseCandidates.map((candidate) => candidate.candidate_id), ...duplicates])],
    wrongMerges
  });
  const errors = [...falseCandidates.map((candidate) => ({ type: 'D_MODEL_EXTRACTION_FAILURE', subtype: 'FALSE_REQUIREMENT', candidate_id: candidate.candidate_id })), ...[...duplicates].map((candidate_id) => ({ type: 'D_MODEL_EXTRACTION_FAILURE', subtype: 'OVER_SPLIT', candidate_id })), ...gold.filter((item) => !tpGold.has(item.gold_id)).map((item) => ({ type: 'D_MODEL_EXTRACTION_FAILURE', subtype: 'MISSED_REQUIREMENT', gold_id: item.gold_id })), ...manualReview.map((item) => ({ type: 'C_USER_REVIEW_REQUIRED', subtype: item.reason, ...item }))];
  return {
    tender_id: packet.tender_id, gold_count: gold.length, extracted_count: extracted, tp, fp, fn,
    tp_candidate_count: tpCandidateCount, scored_candidate_count: tpCandidateCount + fp, review_candidate_count: reviewCandidateCount,
    recall: gold.length ? tp / gold.length : 0, precision: calculateEvaluationPrecision({ tp_candidate_count: tpCandidateCount, false_positive_count: fp }),
    f1: tp && (tpCandidateCount + fp) ? (2 * (calculateEvaluationPrecision({ tp_candidate_count: tpCandidateCount, false_positive_count: fp }) * (tp / gold.length))) / (calculateEvaluationPrecision({ tp_candidate_count: tpCandidateCount, false_positive_count: fp }) + (tp / gold.length)) : 0,
    source_verified_rate: extracted ? candidates.filter((candidate) => candidate.source_verified).length / extracted : 0,
    source_range_exact_rate: tpCandidates.size ? tpCandidates.size / tpCandidates.size : 0,
    duplicate_rate: extracted ? duplicates.size / extracted : 0,
    over_split_count: overSplitGold.size, wrong_merge_count: wrongMergeGold.size, chunk_boundary_split_count: boundaryGold.size,
    category_accuracy: tp ? (tp - fieldErrors.category) / tp : 0, mandatory_observed_accuracy: tp ? (tp - fieldErrors.mandatory_observed) / tp : 0, requires_confirmation_accuracy: tp ? (tp - fieldErrors.requires_confirmation) / tp : 0,
    manual_adjudication_count: manualReview.length, errors, mapping_evidence: automatic, automatic_matches: automaticMatches, manual_review: manualReview,
    _gold: gold, _candidates: candidates, _tp_candidate_ids: [...tpCandidates], _unmatched_candidate_ids: [...unmatchedIds]
  };
}

export function adjudicationItems(packet, metric, prepared) {
  const matches = new Map(metric.automatic_matches.filter((item) => typeof item.gold_id === 'string').map((item) => [item.gold_id, item]));
  const candidates = new Map(metric._candidates.map((item) => [item.candidate_id, item]));
  return metric._gold.map((gold) => {
    const automatic = matches.get(gold.gold_id) || { candidate_ids: [], verdict: 'UNMATCHED', reason: null, matcher_evidence: null };
    const chunks = providerChunks(prepared, gold.start_ref, gold.end_ref);
    return {
      tender_id: packet.tender_id,
      gold_id: gold.gold_id,
      gold_text: gold.text,
      gold_source_range: clone(gold.source_range),
      mandatory: gold.mandatory_observed,
      provider_chunks: chunks,
      provider_input_excerpt: chunks.map((chunk) => `[chunk ${chunk.chunk_number}]\n${chunk.provider_input_text}`).join('\n\n'),
      candidate_matches: (automatic.candidate_ids || []).map((id) => candidates.get(id)).filter(Boolean).map((candidate) => ({
        candidate_id: candidate.candidate_id,
        candidate_text: candidate.text,
        category: candidate.category,
        source_range: clone(candidate.source_range),
        mandatory_observed: candidate.mandatory_observed,
        requires_confirmation: candidate.requires_confirmation
      })),
      automatic_verdict: automatic.verdict,
      automatic_reason: automatic.reason || null,
      automatic_overlap_evidence: clone(automatic.matcher_evidence || null)
    };
  });
}

function unmatchedCandidates(runs, metrics) {
  const output = [];
  runs.forEach((run, index) => {
    const metric = metrics[index]; const wanted = new Set(metric._unmatched_candidate_ids); const reasons = new Map();
    const links = new Map();
    metric.automatic_matches.forEach((match) => {
      (match.candidate_ids || []).forEach((id) => {
        const goldIds = Array.isArray(match.gold_id) ? match.gold_id : [match.gold_id];
        links.set(id, [...(links.get(id) || []), ...goldIds]);
      });
    });
    metric.manual_review.forEach((review) => (review.candidate_ids || []).forEach((id) => {
      reasons.set(id, [...(reasons.get(id) || []), review.reason]);
      links.set(id, [...(links.get(id) || []), ...(Array.isArray(review.gold_id) ? review.gold_id : [review.gold_id])]);
    }));
    run._candidate_records.forEach((candidate) => { if (!wanted.has(candidate.candidate_id)) return; output.push({ tender_id: run.tender_id, candidate_id: candidate.candidate_id, candidate_text: candidate.text, category: candidate.category, source_range: clone(candidate.source_range), mandatory_observed: candidate.mandatory_observed, requires_confirmation: candidate.requires_confirmation, automatic_classification: (reasons.get(candidate.candidate_id) || ['UNMATCHED_OR_NON_EXACT'])[0], candidate_gold_links: [...new Set((links.get(candidate.candidate_id) || []).filter(Boolean))], automatic_reason: (reasons.get(candidate.candidate_id) || ['No exact Gold range match']).join('; ') }); });
  });
  return output;
}

function validateArtifacts(report, adjudication, unmatched, certification, sourceCaptureRunId) {
  if (report.source_capture_run_id !== sourceCaptureRunId
    || adjudication.source_capture_run_id !== sourceCaptureRunId
    || unmatched.source_capture_run_id !== sourceCaptureRunId) {
    throw new Error('ADJUDICATION_ARTIFACT_INVALID: source capture identity mismatch');
  }
  if (!report.evaluation_run_id
    || adjudication.evaluation_run_id !== report.evaluation_run_id
    || unmatched.evaluation_run_id !== report.evaluation_run_id) {
    throw new Error('ADJUDICATION_ARTIFACT_INVALID: evaluation identity mismatch');
  }
  if (certification?.freeze_valid === true && certification.certification_status !== 'SEMANTIC_CERTIFIED') {
    throw new Error('ADJUDICATION_ARTIFACT_INVALID: invalid certification state');
  }
  if (!Array.isArray(adjudication.items) || adjudication.items.length !== expectedGoldCount) throw new Error('ADJUDICATION_ARTIFACT_INVALID: Gold count mismatch');
  const goldIds = new Set(adjudication.items.map((item) => item.gold_id)); if (goldIds.size !== expectedGoldCount) throw new Error('ADJUDICATION_ARTIFACT_INVALID: duplicate Gold IDs');
  adjudication.items.forEach((item) => {
    if (!item.gold_text || !item.gold_source_range?.start_ref || !item.gold_source_range?.end_ref) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: incomplete Gold ${item.gold_id}`);
    (item.candidate_matches || []).forEach((candidate) => {
      if (typeof candidate.candidate_text !== 'string' || !candidate.candidate_text.length) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: missing candidate text ${candidate.candidate_id}`);
      if (!candidate.source_range?.start_ref || !candidate.source_range?.end_ref) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: missing candidate range ${candidate.candidate_id}`);
    });
  });
  report.runs.forEach((run) => (run.candidates || []).forEach((candidate) => { if (typeof candidate.text !== 'string' || !candidate.text.length) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: missing candidate text ${candidate.candidate_id}`); }));
  const unmatchedIds = new Set((unmatched.candidates || []).map((candidate) => `${candidate.tender_id}:${candidate.candidate_id}`));
  unmatched.candidates.forEach((candidate) => { if (typeof candidate.candidate_text !== 'string' || !candidate.candidate_text.length) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: unmatched candidate text missing ${candidate.candidate_id}`); });
  const tpIds = new Set(report.runs.flatMap((run) => (run.true_positive_candidate_ids || []).map((id) => `${run.tender_id}:${id}`)));
  report.runs.forEach((run) => (run.candidates || []).forEach((candidate) => { const key = `${run.tender_id}:${candidate.candidate_id}`; if (!tpIds.has(key) && !unmatchedIds.has(key)) throw new Error(`ADJUDICATION_ARTIFACT_INVALID: unclassified candidate ${key}`); }));
  return {
    gold_count: adjudication.items.length,
    unique_gold_ids: goldIds.size,
    candidate_text_missing: 0,
    unmatched_candidate_count: unmatched.candidates.length,
    source_capture_run_id: report.source_capture_run_id,
    evaluation_run_id: report.evaluation_run_id,
    certification_status: certification?.certification_status || 'PROVISIONAL_NOT_CERTIFIED',
    freeze_valid: certification?.freeze_valid === true
  };
}

export async function loadPackets() {
  const packets = [];
  for (const id of ids) { const packet = JSON.parse(await readFile(resolve(packetDirectory, `${id}.json`), 'utf8')); if (packet.annotation_status !== 'GPT_SOURCE_AUDITED_SEMANTIC_BOUNDARY_V1_1_FROZEN') throw new Error(`${id}: Gold not frozen`); if (packet.gold_requirements.length !== expectedGoldCounts[id]) throw new Error(`${id}: Gold count mismatch`); packets.push(packet); }
  if (packets.reduce((sum, packet) => sum + packet.gold_requirements.length, 0) !== expectedGoldCount) throw new Error('unexpected total Gold count');
  return packets;
}

export async function runEvaluation({
  outputReportPath = reportPath,
  outputAdjudicationPath = adjudicationPath,
  outputUnmatchedPath = unmatchedPath,
  evaluationRunId = `reqx-v311-evaluation-${Date.now()}`
} = {}) {
  const packets = await loadPackets(); const env = loadBackendEnvironment(); const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' }); const gateway = createRequirementExtractionGateway(client); const runs = []; const metrics = []; const prepared = [];
  for (const packet of packets) { const path = await buildAnnotatedPath(packet, env); const run = await runTender(packet, path, gateway); runs.push(run); prepared.push(path); metrics.push(evaluateTender(packet, run, path)); }
  const aggregate = metrics.reduce((total, item) => { for (const key of ['gold_count', 'extracted_count', 'tp', 'fp', 'fn', 'tp_candidate_count', 'scored_candidate_count', 'review_candidate_count', 'over_split_count', 'wrong_merge_count', 'chunk_boundary_split_count', 'manual_adjudication_count']) total[key] += item[key]; total.duplicate_count += Math.round(item.duplicate_rate * item.extracted_count); return total; }, { gold_count: 0, extracted_count: 0, tp: 0, fp: 0, fn: 0, tp_candidate_count: 0, scored_candidate_count: 0, review_candidate_count: 0, over_split_count: 0, wrong_merge_count: 0, chunk_boundary_split_count: 0, manual_adjudication_count: 0, duplicate_count: 0 });
  aggregate.recall = aggregate.gold_count ? aggregate.tp / aggregate.gold_count : 0; aggregate.precision = calculateEvaluationPrecision({ tp_candidate_count: aggregate.tp_candidate_count, false_positive_count: aggregate.fp }); aggregate.f1 = aggregate.precision + aggregate.recall ? (2 * aggregate.precision * aggregate.recall) / (aggregate.precision + aggregate.recall) : 0;
  const reportRuns = runs.map((run, index) => ({ tender_id: run.tender_id, source_file: run.source_file, source_file_sha256: run.source_file_sha256, production_chunk_count: run.production_chunk_count, chunk_character_sizes: run.chunk_character_sizes, chunk_span_counts: run.chunk_span_counts, provider_request_count: run.provider_request_count, table_annotation: run.table_annotation, chunk_results: run.chunk_results, candidates: run.candidates, true_positive_candidate_ids: metrics[index]._tp_candidate_ids, mapping_evidence: metrics[index].mapping_evidence }));
  const model = runs.flatMap((run) => run.chunk_results).map((chunk) => chunk.diagnostic?.response_model).find(Boolean) || null;
  const legacyRuntimeDetails = buildProductionRuntimeIdentity({ env, gatewayEnv: env, info: { model } });
  const identity = {
    source_capture_run_id: runId,
    dataset_version: datasetVersion,
    prompt_contract: requirementContract.contract_version,
    prompt_instruction_hash: requirementContract.instruction_hash,
    candidate_contract: '4.3-requirement-candidate-v3',
    candidate_schema_hash: '1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba',
    model,
    production_runtime_identity: stableRuntimeIdentity(legacyRuntimeDetails),
    provenance_capture_identity: buildProvenanceCaptureIdentity(prepared),
    evaluation_contract_version: EVALUATION_CONTRACT_VERSION,
    evaluator_revision: EVALUATOR_REVISION
  };
  const report = {
    report_schema: 'reqx-v3-real-tender-evaluation-report-v2',
    source_capture_run_id: runId,
    evaluation_run_id: evaluationRunId,
    previous_run: 'DETERMINISTIC_PRE_ADJUDICATION_INCOMPLETE_TEXT_CAPTURE',
    capture_status: 'FULL_CANDIDATE_TEXT_CAPTURE',
    generated_at: new Date().toISOString(),
    ...identity,
    expected_gold_count: expectedGoldCount,
    gold_frozen: true,
    provider: 'semantic_gateway',
    generation_constraints: { concurrency: 2, retry_count: 0, fallback_count: 0 },
    provider_request_count: runs.reduce((sum, run) => sum + run.provider_request_count, 0),
    dify_call_count: 0,
    benchmark_live_call_count: 0,
    runs: reportRuns,
    metrics: metrics.map(({ _gold, _candidates, _tp_candidate_ids, _unmatched_candidate_ids, ...item }) => item),
    aggregate
  };
  const adjudication = {
    packet_schema: 'reqx-v3-adjudication-packet-199-v1',
    source_capture_run_id: runId,
    evaluation_run_id: evaluationRunId,
    dataset_version: datasetVersion,
    prompt_contract: identity.prompt_contract,
    prompt_instruction_hash: identity.prompt_instruction_hash,
    candidate_contract: identity.candidate_contract,
    candidate_schema_hash: identity.candidate_schema_hash,
    model: identity.model,
    production_runtime_identity: identity.production_runtime_identity,
    provenance_capture_identity: identity.provenance_capture_identity,
    evaluation_contract_version: identity.evaluation_contract_version,
    evaluator_revision: identity.evaluator_revision,
    gold_count: expectedGoldCount,
    items: packets.flatMap((packet, index) => adjudicationItems(packet, metrics[index], prepared[index]))
  };
  const unmatched = {
    packet_schema: 'reqx-v3-unmatched-candidates-v1',
    source_capture_run_id: runId,
    evaluation_run_id: evaluationRunId,
    dataset_version: datasetVersion,
    prompt_contract: identity.prompt_contract,
    prompt_instruction_hash: identity.prompt_instruction_hash,
    candidate_contract: identity.candidate_contract,
    candidate_schema_hash: identity.candidate_schema_hash,
    model: identity.model,
    production_runtime_identity: identity.production_runtime_identity,
    provenance_capture_identity: identity.provenance_capture_identity,
    evaluation_contract_version: identity.evaluation_contract_version,
    evaluator_revision: identity.evaluator_revision,
    candidates: unmatchedCandidates(runs, metrics)
  };
  const identityCheck = validateEvaluationArtifactIdentity({
    capture: report,
    gold: { dataset_version: datasetVersion },
    adjudication,
    metrics: unmatched
  });
  const certification = certifyEvaluation({
    identity: identityCheck,
    stableProvenanceResolved: false,
    structuralAdjudicationComplete: false,
    goldCount: expectedGoldCount,
    semanticAdjudicationComplete: false
  });
  report.identity_validation = identityCheck;
  report.certification = certification;
  adjudication.identity_validation = identityCheck;
  adjudication.certification = certification;
  unmatched.identity_validation = identityCheck;
  unmatched.certification = certification;
  report.metrics = report.metrics.map((item) => ({
    ...item,
    certification_status: certification.certification_status,
    freeze_valid: certification.freeze_valid,
    metric_semantics: certification.metric_semantics
  }));
  report.aggregate = {
    ...report.aggregate,
    certification_status: certification.certification_status,
    freeze_valid: certification.freeze_valid,
    metric_semantics: certification.metric_semantics
  };
  report.provisional_metrics = { ...aggregate, certification_status: certification.certification_status, freeze_valid: certification.freeze_valid, metric_semantics: certification.metric_semantics };
  report.artifact_validation = validateArtifacts(report, adjudication, unmatched, certification, runId);
  await mkdir(reportDirectory, { recursive: true }); await writeFile(outputReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); await writeFile(outputAdjudicationPath, `${JSON.stringify(adjudication, null, 2)}\n`, 'utf8'); await writeFile(outputUnmatchedPath, `${JSON.stringify(unmatched, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ source_capture_run_id: runId, evaluation_run_id: evaluationRunId, report_path: outputReportPath, adjudication_path: outputAdjudicationPath, unmatched_path: outputUnmatchedPath, provider_request_count: report.provider_request_count, gold_count: expectedGoldCount, candidate_count: aggregate.extracted_count, candidate_text_available_count: aggregate.extracted_count, candidate_text_missing_count: 0, manual_review_count: metrics.reduce((sum, item) => sum + item.manual_adjudication_count, 0), dify_call_count: 0, benchmark_live_call_count: 0, certification, artifact_validation: report.artifact_validation, metrics: metrics.map(({ _gold, _candidates, _tp_candidate_ids, _unmatched_candidate_ids, ...item }) => ({ ...item, mapping_evidence: undefined })) }, null, 2));
  return { report, adjudication, unmatched };
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entrypoint && import.meta.url === entrypoint) runEvaluation().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
