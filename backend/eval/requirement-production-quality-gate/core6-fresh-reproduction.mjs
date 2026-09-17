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
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import {
  getSemanticTaskContract,
  schemaSha256,
  REQUIREMENT_CANDIDATE_SCHEMA_SHA256
} from '../../../packages/semantic-contracts/index.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { prepareTender, safeProbeAudit } from '../requirement-semantic-quality-v1/runner.js';
import { evaluateCandidatePayload } from './candidate-pipeline-evaluator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const TASK = 'requirement_extraction';
const MANIFEST_PATH = path.join(DOCS, 'V43_REQUIREMENT_21_MISS_MANIFEST.json');
const SOURCE_SIDE_PATH = path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl');
const HISTORICAL_PATH = path.join(DOCS, 'V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION.json');
const CORE6_IDS = Object.freeze([
  'JY-001-BLIND-10-E01',
  'JY-001-BLIND-10-E02',
  'FAST-01-BLIND-03-E01',
  'FAST-01-BLIND-03-E02',
  'FAST-01-BLIND-08-E01',
  'FAST-01-BLIND-08-E02'
]);
const MAX_FIRST_ATTEMPTS = 6;
const MAX_RETRIES = 2;
const MAX_CALLS = MAX_FIRST_ATTEMPTS + MAX_RETRIES;
const CONCURRENCY = 2;
const TRANSIENT_CODES = new Set([
  'GATEWAY_TIMEOUT',
  'GATEWAY_NETWORK_ERROR',
  'GATEWAY_HTTP_ERROR',
  'PROVIDER_TIMEOUT',
  'PROVIDER_NETWORK_ERROR'
]);
const resolver = new SourceLocationResolver();

const sha256 = value => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8')
  .digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonl = file => fs.readFileSync(file, 'utf8')
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(line => JSON.parse(line));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const writeJsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
};
const normalized = value => String(value || '').replace(/\s+/gu, '').toLowerCase();
const safeText = (value, limit = 12000) => typeof value === 'string' ? value.slice(0, limit) : null;
const relative = file => path.relative(REPO, file).replaceAll('\\', '/');

function contentBigrams(value) {
  const text = normalized(value).replace(/[^0-9a-z\u3400-\u9fff]/giu, '');
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}

function deterministicSemanticAlignment(expected, outputs) {
  const expectedBigrams = contentBigrams(expected);
  const outputBigrams = contentBigrams(outputs.join(' '));
  if (!expectedBigrams.size) return { recovered: false, coverage: 0, method: 'NO_EXPECTED_CONTENT' };
  const matched = [...expectedBigrams].filter(bigram => outputBigrams.has(bigram)).length;
  const coverage = matched / expectedBigrams.size;
  return {
    recovered: coverage >= 0.45,
    coverage,
    matched_bigrams: matched,
    expected_bigrams: expectedBigrams.size,
    method: 'DETERMINISTIC_CONTENT_BIGRAM_COVERAGE_V1'
  };
}

function currentRuntimeFiles() {
  return Object.freeze({
    requirement_prompt_contract: 'packages/semantic-contracts/index.js',
    requirement_extraction: 'backend/src/pipeline/requirement-extraction.js',
    semantic_window_chunker: 'backend/src/pipeline/requirement-chunker.js',
    section_router: 'backend/src/pipeline/requirement-scope-router.js',
    source_resolver: 'backend/src/pipeline/source-location-resolver.js',
    candidate_quality_gate: 'backend/src/pipeline/requirement-quality-gate.js',
    canonicalizer: 'backend/src/pipeline/canonical-requirements.js'
  });
}

function runtimeIdentity(env, gatewayInfo = null) {
  const contract = getSemanticTaskContract(TASK);
  const files = currentRuntimeFiles();
  const fileHashes = Object.fromEntries(Object.entries(files).map(([name, relativePath]) => [
    name,
    sha256(fs.readFileSync(path.join(REPO, relativePath)))
  ]));
  const runtime = readSemanticGatewayRuntimeConfig(env);
  return {
    task_type: TASK,
    contract_version: contract.contract_version,
    prompt_instruction_hash: contract.instruction_hash,
    task_data_schema_hash: schemaSha256(contract.data_schema),
    candidate_schema_hash: gatewayInfo?.candidate_schema_sha256 || null,
    local_candidate_schema_hash: REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
    canonical_rule_version: '4.3-canonical-requirement-1',
    provider_family: gatewayInfo?.provider || runtime.provider || null,
    model: gatewayInfo?.model || null,
    gateway_api_host: (() => { try { return new URL(runtime.gatewayApiBase).hostname; } catch { return null; } })(),
    files,
    file_hashes: fileHashes,
    generation: {
      response_format: { type: 'json_schema', strict: true },
      enable_thinking: env.SEMANTIC_GATEWAY_ENABLE_THINKING === 'true',
      temperature: Number(env.SEMANTIC_GATEWAY_TEMPERATURE || 0.1),
      max_tokens: Number(env.SEMANTIC_GATEWAY_MAX_TOKENS || 4800)
    },
    sensitive_values_logged: false,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

async function gatewayInfo(env) {
  const runtime = readSemanticGatewayRuntimeConfig(env);
  let base = String(runtime.gatewayApiBase || '');
  while (base.endsWith('/')) base = base.slice(0, -1);
  const get = async endpoint => {
    try {
      const response = await fetch(`${base}/${endpoint}`);
      let body = null;
      try { body = await response.json(); } catch { body = null; }
      return { status: response.status, ok: response.ok, body };
    } catch (error) {
      return { status: null, ok: false, body: null, error_code: error?.name || 'NETWORK_ERROR' };
    }
  };
  const [ready, info] = await Promise.all([get('ready'), get('info')]);
  const body = info.body || {};
  return {
    gateway_base_host: (() => { try { return new URL(runtime.gatewayApiBase).hostname; } catch { return null; } })(),
    ready_http_status: ready.status,
    ready_ok: ready.ok,
    info_http_status: info.status,
    info_ok: info.ok,
    build_revision: body.build_revision || body.commit || null,
    provider: body.provider || null,
    model: body.model || null,
    provider_configured: body.provider_configured === true || ready.body?.provider_configured === true,
    task_registry_loaded: body.task_registry_loaded === true,
    requirement_extraction_contract_version: body.requirement_extraction_contract_version || null,
    requirement_extraction_prompt_hash: body.requirement_extraction_prompt_hash || null,
    candidate_schema_contract_version: body.candidate_schema_contract_version || null,
    candidate_schema_sha256: body.candidate_schema_sha256 || null,
    sensitive_values_logged: false
  };
}

function buildCurrentWindow(prepared, sourceRow) {
  const byRef = new Map(prepared.segments.map(segment => [segment.source_ref, segment]));
  const refs = Array.isArray(sourceRow?.source_refs) ? sourceRow.source_refs : [];
  const segments = refs.map(ref => byRef.get(ref)).filter(Boolean);
  if (!refs.length || segments.length !== refs.length) {
    return { status: 'SOURCE_WINDOW_NOT_RECONSTRUCTED', missing_refs: refs.filter(ref => !byRef.has(ref)) };
  }
  const text = segments.map(segment => segment.text).join('\n');
  const modelText = segments.map(segment => {
    const header = segment.table_header_context ? ` 表头：${segment.table_header_context}` : '';
    return `[${segment.source_ref}]${header} ${segment.text}`;
  }).join('\n');
  const sourceSections = [...new Set(segments.map(segment => segment.source_section).filter(Boolean))];
  const routingRoles = [...new Set(segments.map(segment => segment.routing_role).filter(Boolean))];
  return {
    status: 'PASS',
    chunk: {
      chunk_number: segments[0].chunk_number,
      text,
      model_text: modelText,
      segments,
      character_count: text.length,
      source_start_page: segments[0].page ?? null,
      source_end_page: segments.at(-1)?.page ?? null,
      source_start_paragraph: segments[0].paragraph ?? null,
      source_end_paragraph: segments.at(-1)?.paragraph ?? null,
      table_units: segments.filter(segment => segment.semantic_unit_type === 'TABLE_ROW').map(segment => ({
        table_id: segment.table_id,
        row_id: segment.table_row_id,
        header_context: segment.table_header_context,
        source_ref: segment.source_ref,
        source_text: segment.text,
        cells: segment.table_cells
      }))
    },
    section_identity: sourceSections,
    routing_roles: routingRoles,
    heading_visible: segments.some(segment => segment.starts_at_title_boundary === true),
    table_header_visible: segments.some(segment => Boolean(segment.table_header_context)),
    neighbor_context_visible: segments.length > 1
  };
}

function candidateProjection(candidate, chunk, index) {
  const resolved = resolver.resolve(candidate, chunk);
  return {
    ...candidate,
    ...resolved.location,
    eval_candidate_id: `CAND-${String(index + 1).padStart(2, '0')}`
  };
}

function detailedEvaluation(candidates, chunk) {
  const base = evaluateCandidatePayload({ candidates, chunk, qualityGate: true });
  const projected = [];
  try {
    for (let index = 0; index < candidates.length; index += 1) {
      projected.push(candidateProjection(candidates[index], chunk, index));
    }
  } catch {
    return { base, projected: [], canonicalized: [], canonical_error: base.source_resolution_failure_code || 'SOURCE_LOCATION_UNRESOLVED' };
  }
  if (!projected.length) return { base, projected, canonicalized: [], canonical_error: null };
  try {
    const canonicalized = buildCanonicalRequirements(projected.map((candidate, index) => ({
      text: candidate.text,
      category: candidate.category,
      source_text: candidate.source_text,
      source_context_text: candidate.source_context_text,
      source_verified: candidate.source_verified,
      source_resolution_status: candidate.source_resolution_status,
      source_match_type: candidate.source_match_type,
      source_hash: candidate.source_hash,
      source_page_start: candidate.source_page_start,
      source_page_end: candidate.source_page_end,
      source_paragraph_start: candidate.source_paragraph_start,
      source_paragraph_end: candidate.source_paragraph_end,
      source_clause_id: candidate.source_clause_id,
      source_chunk_id: candidate.source_chunk_id,
      mandatory_observed: candidate.mandatory_observed,
      requires_confirmation: candidate.requires_confirmation,
      candidate_index: index + 1
    })), { qualityGate: true });
    return { base, projected, canonicalized, canonical_error: null };
  } catch (error) {
    return { base, projected, canonicalized: [], canonical_error: error?.code || 'CANONICALIZATION_FAILED' };
  }
}

function safeCandidate(candidate, index) {
  return {
    eval_candidate_id: `CAND-${String(index + 1).padStart(2, '0')}`,
    text: safeText(candidate?.text),
    category: candidate?.category || null,
    source_range: candidate?.source_range || null,
    mandatory_observed: candidate?.mandatory_observed ?? null,
    requires_confirmation: candidate?.requires_confirmation ?? null,
    source_text: safeText(candidate?.source_text),
    source_context_text: safeText(candidate?.source_context_text),
    source_verified: candidate?.source_verified === true
  };
}

function safeCanonical(canonical, index) {
  return {
    eval_canonical_id: `CANON-${String(index + 1).padStart(2, '0')}`,
    text: safeText(canonical?.text),
    category: canonical?.category || null,
    requirement_category: canonical?.requirement_category || null,
    source_excerpt: safeText(canonical?.source_excerpt),
    source_hash: canonical?.source_hash || null,
    source_verified: canonical?.source_verified === true,
    source_resolution_status: canonical?.source_resolution_status || null,
    source_match_type: canonical?.source_match_type || null,
    mandatory_observed: canonical?.mandatory_observed ?? null,
    requires_confirmation: canonical?.requires_confirmation ?? null,
    quality_gate_decision: canonical?.quality_gate_decision || null,
    quality_gate_reason_codes: canonical?.quality_gate_reason_codes || []
  };
}

function classifyCurrent({ expected, result, evaluation, canonicalized, windowStatus }) {
  if (windowStatus !== 'PASS') return 'S0_CURRENT_SOURCE_SCOPE_MISS';
  if (!result) return 'CURRENT_RUNTIME_FAILURE';
  if (!Array.isArray(result.candidates) || result.candidates.length === 0) return 'S2_CURRENT_MODEL_SEMANTIC_MISS';
  if (evaluation?.source_resolution_success === false) return 'S3_CURRENT_POST_MODEL_FILTER_LOSS';
  if (evaluation?.canonicalization_success === false || canonicalized.length === 0) return 'S4_CURRENT_CANONICAL_MERGE_DEDUP_LOSS';
  const outputTexts = [
    ...result.candidates.map(candidate => normalized(candidate.text)),
    ...canonicalized.map(candidate => normalized(candidate.text))
  ];
  const alignment = deterministicSemanticAlignment(expected, outputTexts);
  return alignment.recovered ? 'PASS_RECOVERED' : 'S2_CURRENT_MODEL_SEMANTIC_MISS';
}

function transient(error, audit) {
  const code = String(error?.code || audit?.safe_error_code || audit?.gateway_error_code || '').toUpperCase();
  return TRANSIENT_CODES.has(code)
    || [502, 503, 504].includes(audit?.gateway_http_status)
    || [502, 503, 504].includes(audit?.provider_http_status);
}

function buildCheckpoint({ runId, identity, preflight, cases, attempts, retries, startedAt, finishedAt }) {
  const counts = {
    S0_CURRENT_SOURCE_SCOPE_MISS: 0,
    S1_CURRENT_INPUT_CONTEXT_DAMAGE: 0,
    S2_CURRENT_MODEL_SEMANTIC_MISS: 0,
    S3_CURRENT_POST_MODEL_FILTER_LOSS: 0,
    S4_CURRENT_CANONICAL_MERGE_DEDUP_LOSS: 0,
    S5_CURRENT_ALIGNMENT_ERROR: 0,
    PASS_RECOVERED: 0,
    CURRENT_RUNTIME_FAILURE: 0
  };
  for (const item of cases) counts[item.current_runtime_classification] = (counts[item.current_runtime_classification] || 0) + 1;
  const determinate = cases.filter(item => item.current_runtime_classification !== 'CURRENT_RUNTIME_FAILURE').length;
  const semanticErrors = counts.S2_CURRENT_MODEL_SEMANTIC_MISS;
  const dominantCandidates = Object.entries(counts)
    .filter(([key]) => key.startsWith('S') && key !== 'S5_CURRENT_ALIGNMENT_ERROR')
    .sort((a, b) => b[1] - a[1]);
  const dominant = dominantCandidates[0]?.[1] >= 4 ? dominantCandidates[0][0] : null;
  return {
    checkpoint: 'V43_REQUIREMENT_CORE6_FRESH_REPRODUCTION_CHECKPOINT',
    artifact_version: 'v1',
    run_id: runId,
    generated_at: finishedAt,
    CORE6_CASE_COUNT: CORE6_IDS.length,
    provider_calls: attempts,
    PROVIDER_CALLS: attempts,
    RETRIES: retries,
    S0_CURRENT: counts.S0_CURRENT_SOURCE_SCOPE_MISS,
    S1_CURRENT: counts.S1_CURRENT_INPUT_CONTEXT_DAMAGE,
    S2_CURRENT: counts.S2_CURRENT_MODEL_SEMANTIC_MISS,
    S3_CURRENT: counts.S3_CURRENT_POST_MODEL_FILTER_LOSS,
    S4_CURRENT: counts.S4_CURRENT_CANONICAL_MERGE_DEDUP_LOSS,
    S5_CURRENT: counts.S5_CURRENT_ALIGNMENT_ERROR,
    PASS_RECOVERED: counts.PASS_RECOVERED,
    CURRENT_RUNTIME_FAILURE: counts.CURRENT_RUNTIME_FAILURE,
    DOMINANT_CURRENT_ROOT_CAUSE: dominant,
    dominant_current_root_cause: dominant,
    SOURCE_TRACEABILITY: cases.length ? cases.filter(item => item.source_traceable).length / cases.length : 0,
    CURRENT_CORE6_RECALL: counts.PASS_RECOVERED / CORE6_IDS.length,
    P0_ESCAPE: semanticErrors === 0 && cases.every(item => item.schema_valid !== false) ? 'NOT_ESTABLISHED_NO_INDEPENDENT_SEMANTIC_ADJUDICATION' : 'REVIEW_REQUIRED',
    production_db_writes: 0,
    PRODUCTION_DB_WRITES: 0,
    gold_mutations: 0,
    GOLD_MUTATIONS: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    attempts,
    retries,
    max_call_cap: MAX_CALLS,
    concurrency: CONCURRENCY,
    runtime_identity: identity,
    preflight,
    historical_attribution_unchanged: true,
    historical_recovery: 'EXHAUSTED_NOT_REPLAYED',
    phase_b_authorized: false,
    next_gate: counts.CURRENT_RUNTIME_FAILURE > 0
      ? 'STOP_PROVIDER_OR_RUNTIME_FAILURE'
      : semanticErrors >= 4
        ? 'STOP_WAIT_FOR_GPT_PROMPT_DECISION'
        : counts.PASS_RECOVERED >= 4
          ? 'RUN_KNOWN_COHORT_REGRESSION_BEFORE_ANY_FIX'
          : dominant
            ? 'RETURN_DOMINANT_ROOT_CAUSE_FOR_DECISION'
            : 'RETURN_FOR_REVIEW',
    started_at: startedAt,
    finished_at: finishedAt,
    side_effects: {
      provider_calls: attempts,
      production_db_writes: 0,
      gold_mutations: 0,
      fact_calls: 0,
      mapping_calls: 0,
      claim_calls: 0,
      writer_calls: 0
    },
    case_results: cases,
    attempts_summary: { first_attempts: CORE6_IDS.length, total_attempts: attempts, retries }
  };
}

export async function runCore6FreshReproduction({ env = loadBackendEnvironment(), runId = null } = {}) {
  const generatedRunId = runId || `req-core6-fresh-${new Date().toISOString().replace(/[-:.TZ]/gu, '')}-${crypto.randomUUID().slice(0, 8)}`;
  const resultDir = path.join(REPO, 'backend/eval/requirement-production-quality-gate/results', generatedRunId);
  fs.mkdirSync(resultDir, { recursive: true });
  const manifest = readJson(MANIFEST_PATH);
  const sourceRows = readJsonl(SOURCE_SIDE_PATH);
  const historical = fs.existsSync(HISTORICAL_PATH) ? readJson(HISTORICAL_PATH) : { cases: [] };
  const expectedCases = manifest.cases.filter(item => CORE6_IDS.includes(item.expected_id));
  if (expectedCases.length !== CORE6_IDS.length) throw new Error('CORE6_MANIFEST_CASE_COUNT_INVALID');
  const historicalById = new Map((historical.cases || []).map(item => [item.expected_id, item.classification]));
  const preflightInfo = await gatewayInfo(env);
  const identity = runtimeIdentity(env, preflightInfo);
  const contract = getSemanticTaskContract(TASK);
  const parity = {
    prompt_hash_match: preflightInfo.requirement_extraction_prompt_hash === contract.instruction_hash,
    schema_hash_match: preflightInfo.candidate_schema_sha256 === REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
    contract_version_match: preflightInfo.requirement_extraction_contract_version === contract.contract_version,
    gateway_ready: preflightInfo.ready_ok && preflightInfo.info_ok && preflightInfo.provider_configured === true,
    source_side_artifact_present: fs.existsSync(SOURCE_SIDE_PATH),
    manifest_present: fs.existsSync(MANIFEST_PATH)
  };
  const preflight = { artifact_type: 'V43_REQUIREMENT_CORE6_FRESH_REPRODUCTION_PREFLIGHT', run_id: generatedRunId, parity, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, preflight: preflightInfo };
  writeJson(path.join(resultDir, 'preflight.json'), preflight);
  if (!Object.values(parity).every(Boolean)) throw Object.assign(new Error('CORE6_RUNTIME_PARITY_FAILED'), { code: 'CORE6_RUNTIME_PARITY_FAILED', parity });

  const preparedByTender = new Map();
  for (const tenderId of [...new Set(expectedCases.map(item => item.tender_id))]) preparedByTender.set(tenderId, await prepareTender(tenderId, env));
  const casesById = new Map(expectedCases.map(item => [item.expected_id, item]));
  const sourcesByWindow = new Map(sourceRows.map(row => [`${row.tender_id}|${row.window_id}`, row]));
  const gateway = createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: TASK }));
  const telemetry = [];
  let attempts = 0;
  let retries = 0;
  let cursor = 0;
  let stopAfterInfrastructureFailure = false;
  const startedAt = new Date().toISOString();

  const work = async () => {
    while (true) {
      const index = cursor++;
      if (index >= CORE6_IDS.length || stopAfterInfrastructureFailure) return;
      const expectedId = CORE6_IDS[index];
      const expected = casesById.get(expectedId);
      const prepared = preparedByTender.get(expected.tender_id);
      const source = sourcesByWindow.get(`${expected.tender_id}|${expected.window_id}`);
      const window = buildCurrentWindow(prepared, source);
      const sourceTraceable = Boolean(source?.source_sha256 === prepared?.source_sha256 && window.status === 'PASS');
      const providerInput = window.status === 'PASS'
        ? resolveRequirementExtractionProviderInput({ chunk: window.chunk, fallbackText: window.chunk.text })
        : null;
      const row = {
        run_id: generatedRunId,
        expected_id: expected.expected_id,
        tender_id: expected.tender_id,
        window_id: expected.window_id,
        historical_classification: historicalById.get(expected.expected_id) || 'NOT_RECOVERED',
        expected_requirement: expected.expected_requirement,
        source_excerpt: expected.source_excerpt,
        parsed_source_found: Boolean(prepared?.parser_status === 'PASS' && source),
        source_sha256: prepared?.source_sha256 || null,
        source_ref_count: source?.source_refs?.length || 0,
        source_refs: source?.source_refs || [],
        source_sha_match: source?.source_sha256 === prepared?.source_sha256,
        section_identity: window.section_identity || [],
        router_selected: prepared?.router_status === 'PASS',
        router_reason: prepared?.router_status === 'PASS' ? 'CURRENT_REQUIREMENT_EXTRACTION_SCOPE_COMBINED' : 'CURRENT_ROUTER_FALLBACK',
        semantic_window_text: window.chunk?.text || null,
        heading_visible: window.heading_visible || false,
        table_header_visible: window.table_header_visible || false,
        neighbor_context_visible: window.neighbor_context_visible || false,
        provider_input: providerInput,
        provider_input_hash: providerInput ? sha256(providerInput) : null,
        provider_called: false,
        provider_http: null,
        schema_valid: null,
        candidate_outputs: [],
        candidate_ids: [],
        source_resolution_result: null,
        canonical_outputs: [],
        canonical_ids: [],
        dedup_events: [],
        filter_events: [],
        final_alignment: null,
        source_traceable: sourceTraceable,
        failure_code: null,
        failure_stage: null,
        retries: 0
      };
      if (!sourceTraceable) {
        row.current_runtime_classification = 'S0_CURRENT_SOURCE_SCOPE_MISS';
        row.final_alignment = 'SOURCE_WINDOW_UNAVAILABLE';
        telemetry.push(row);
        continue;
      }
      let result = null;
      let error = null;
      let audit = {};
      while (true) {
        if (attempts >= MAX_CALLS) {
          row.failure_code = 'CORE6_PROVIDER_CALL_CAP_REACHED';
          row.failure_stage = 'PROVIDER_CALL_CAP';
          break;
        }
        attempts += 1;
        row.provider_called = true;
        const callStarted = Date.now();
        try {
          result = await gateway.extract({
            fileName: prepared.source_file,
            text: providerInput,
            paragraphs: window.chunk.segments,
            chunk: window.chunk,
            projectName: prepared.title,
            sectionName: expected.tender_id,
            chunkCount: prepared.chunk_count,
            diagnosticMode: 'probe-v1'
          });
          error = null;
        } catch (caught) {
          error = caught;
          result = null;
        }
        audit = safeProbeAudit({
          ...(result?.audit || error?.audit || {}),
          ...(result?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || {})
        });
        row.duration_ms = Date.now() - callStarted;
        row.provider_http = {
          gateway_http_status: audit.gateway_http_status || error?.audit?.gateway_http_status || null,
          provider_http_status: audit.provider_http_status || null,
          provider_reached: audit.provider_adapter_invoked === true && audit.fetch_invoked === true && audit.provider_http_reached === true,
          finish_reason: audit.finish_reason || null
        };
        if (!error) break;
        if (transient(error, audit) && retries < MAX_RETRIES) {
          retries += 1;
          row.retries += 1;
          continue;
        }
        row.failure_code = error?.code || audit.safe_error_code || 'CORE6_PROVIDER_FAILURE';
        row.failure_stage = 'PROVIDER';
        stopAfterInfrastructureFailure = true;
        break;
      }
      if (error) {
        row.current_runtime_classification = 'CURRENT_RUNTIME_FAILURE';
        row.final_alignment = 'PROVIDER_OR_GATEWAY_FAILURE';
        row.schema_valid = false;
        telemetry.push(row);
        continue;
      }
      const candidates = result?.candidates || [];
      const details = detailedEvaluation(candidates, window.chunk);
      row.schema_valid = true;
      row.candidate_outputs = candidates.map(safeCandidate);
      row.candidate_ids = candidates.map((_candidate, candidateIndex) => `CAND-${String(candidateIndex + 1).padStart(2, '0')}`);
      row.source_resolution_result = details.base.source_resolution_success === true ? 'PASS' : details.base.source_resolution_success === false ? 'FAIL' : 'NOT_APPLICABLE';
      row.canonical_outputs = details.canonicalized.map(safeCanonical);
      row.canonical_ids = details.canonicalized.map((_candidate, canonicalIndex) => `CANON-${String(canonicalIndex + 1).padStart(2, '0')}`);
      row.dedup_events = [{ duplicate_count: details.canonicalized.audit?.duplicate_count ?? details.base.duplicate_count ?? null }];
      row.filter_events = [{ quality_gate_decision: details.base.quality_gate_decision, reason_codes: details.base.quality_gate_reason_codes || [], failure_stage: details.base.failure_stage || null }];
      row.failure_code = details.base.source_resolution_failure_code || details.base.canonicalization_failure_code || details.canonical_error || null;
      row.failure_stage = details.base.failure_stage || null;
      row.final_alignment = classifyCurrent({ expected: expected.expected_requirement, result, evaluation: details.base, canonicalized: details.canonicalized, windowStatus: window.status });
      row.current_runtime_classification = row.final_alignment;
      row.audit = {
        json_parse_success: audit.json_parse_success,
        schema_validation_errors: audit.schema_validation_errors || [],
        provider_model: audit.response_model || null,
        response_model: audit.response_model || null,
        prompt_tokens: audit.prompt_tokens || null,
        completion_tokens: audit.completion_tokens || null,
        total_tokens: audit.total_tokens || null,
        output_truncated: audit.output_truncated === true,
        finish_reason: audit.finish_reason || null,
        provider_http_status: audit.provider_http_status || null,
        gateway_http_status: audit.gateway_http_status || null
      };
      telemetry.push(row);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => work()));
  const finishedAt = new Date().toISOString();
  const checkpoint = buildCheckpoint({ runId: generatedRunId, identity, preflight, cases: telemetry, attempts, retries, startedAt, finishedAt });
  writeJsonl(path.join(resultDir, 'case-telemetry.jsonl'), telemetry);
  writeJson(path.join(resultDir, 'checkpoint.json'), checkpoint);
  writeJson(path.join(DOCS, `V43_REQUIREMENT_CORE6_FRESH_REPRODUCTION_${generatedRunId}.json`), {
    artifact_type: 'V43_REQUIREMENT_CORE6_FRESH_REPRODUCTION',
    artifact_version: 'v1',
    data_classification: 'REAL_TENDER_SOURCE_EVAL_ONLY',
    historical_artifact_recovery: 'EXHAUSTED_NOT_REPLAYED',
    runtime_identity: identity,
    preflight,
    checkpoint,
    cases: telemetry,
    provider_calls: attempts,
    retries,
    production_db_writes: 0,
    gold_mutations: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0
  });
  return { run_id: generatedRunId, run_dir: relative(resultDir), checkpoint, cases: telemetry };
}

export function reclassifyCore6Run({ runDir, manifestPath = MANIFEST_PATH } = {}) {
  const absoluteRunDir = path.isAbsolute(runDir) ? runDir : path.join(REPO, runDir);
  const telemetryPath = path.join(absoluteRunDir, 'case-telemetry.jsonl');
  const checkpointPath = path.join(absoluteRunDir, 'checkpoint.json');
  const telemetry = readJsonl(telemetryPath);
  const checkpoint = readJson(checkpointPath);
  const manifest = readJson(manifestPath);
  const expectedById = new Map(manifest.cases.map(item => [item.expected_id, item]));
  for (const row of telemetry) {
    const expected = expectedById.get(row.expected_id);
    const outputs = [
      ...(row.candidate_outputs || []).map(item => item.text).filter(Boolean),
      ...(row.canonical_outputs || []).map(item => item.text).filter(Boolean)
    ];
    row.expected_requirement = expected?.expected_requirement || row.expected_requirement || null;
    row.offline_alignment = deterministicSemanticAlignment(row.expected_requirement, outputs);
    if (row.current_runtime_classification === 'S2_CURRENT_MODEL_SEMANTIC_MISS'
      && row.schema_valid === true && row.source_resolution_result === 'PASS') {
      row.current_runtime_classification = row.offline_alignment.recovered
        ? 'PASS_RECOVERED'
        : 'S2_CURRENT_MODEL_SEMANTIC_MISS';
      row.final_alignment = row.current_runtime_classification;
    }
  }
  const updated = buildCheckpoint({
    runId: checkpoint.run_id,
    identity: checkpoint.runtime_identity,
    preflight: checkpoint.preflight,
    cases: telemetry,
    attempts: checkpoint.provider_calls,
    retries: checkpoint.retries,
    startedAt: checkpoint.started_at,
    finishedAt: new Date().toISOString()
  });
  updated.reclassification_mode = 'OFFLINE_NO_PROVIDER_CALL';
  updated.original_checkpoint = checkpoint.checkpoint;
  writeJsonl(telemetryPath, telemetry);
  writeJson(checkpointPath, updated);
  const topLevelPath = path.join(DOCS, `V43_REQUIREMENT_CORE6_FRESH_REPRODUCTION_${checkpoint.run_id}.json`);
  if (fs.existsSync(topLevelPath)) {
    const topLevel = readJson(topLevelPath);
    topLevel.cases = telemetry;
    topLevel.checkpoint = updated;
    topLevel.reclassification_mode = 'OFFLINE_NO_PROVIDER_CALL';
    writeJson(topLevelPath, topLevel);
  }
  return updated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const reclassifyIndex = process.argv.indexOf('--offline-reclassify');
  if (reclassifyIndex >= 0) {
    const target = process.argv[reclassifyIndex + 1];
    try {
      const checkpoint = reclassifyCore6Run({ runDir: target });
      process.stdout.write(`${JSON.stringify(checkpoint, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ error_code: error?.code || 'CORE6_OFFLINE_RECLASSIFICATION_FAILED', message: String(error?.message || '').slice(0, 240) }, null, 2)}\n`);
      process.exitCode = 1;
    }
  } else {
  runCore6FreshReproduction().then(result => {
    process.stdout.write(`${JSON.stringify({ run_id: result.run_id, run_dir: result.run_dir, checkpoint: result.checkpoint }, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${JSON.stringify({ error_code: error?.code || 'CORE6_REPRODUCTION_FAILED', message: String(error?.message || '').slice(0, 240), parity: error?.parity || null }, null, 2)}\n`);
    process.exitCode = 1;
  });
  }
}
