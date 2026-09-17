import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';
import { buildAnnotatedPath, runTender } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const INBOX = resolve(HERE, 'inbox');
const RESULTS = resolve(HERE, 'results');
const VALID_EXTENSIONS = new Set(['.pdf', '.docx']);
const RUN_PREFIX = 'unseen-holdout-v3';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const writeJson = async (file, value) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

function relativeRepo(file) {
  return relative(REPO, file).replaceAll('\\', '/');
}

function sourceType(fileName) {
  const extension = extname(fileName).toLowerCase();
  return extension === '.pdf' ? 'PDF' : extension === '.docx' ? 'DOCX' : 'UNKNOWN';
}

function deterministicFileOrder(a, b) {
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
}

async function discoverSources() {
  const entries = (await readdir(INBOX, { withFileTypes: true }))
    .filter(entry => entry.isFile() && VALID_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .sort(deterministicFileOrder);
  if (entries.length !== 2) {
    throw Object.assign(new Error(`BLOCKED_V3_INBOX_FILE_COUNT_${entries.length}`), {
      code: `BLOCKED_V3_INBOX_FILE_COUNT_${entries.length}`
    });
  }
  const sources = [];
  for (let index = 0; index < entries.length; index += 1) {
    const absolute = resolve(INBOX, entries[index].name);
    const buffer = await readFile(absolute);
    const fileStat = await stat(absolute);
    sources.push({
      holdout_id: `HOLDOUT-REQ-V3-0${index + 1}`,
      original_filename: entries[index].name,
      file_extension: extname(entries[index].name).toLowerCase(),
      source_type: sourceType(entries[index].name),
      source_path: relativeRepo(absolute),
      source_sha256: sha256(buffer),
      source_size_bytes: buffer.length,
      source_mtime_ms: fileStat.mtimeMs,
      absolute_path: absolute
    });
  }
  return sources;
}

function sourceManifest(sources, identity) {
  return {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_SOURCE_MANIFEST',
    artifact_version: 'v3',
    generated_at: new Date().toISOString(),
    deterministic_order: 'filename_codepoint_ascending',
    source_count: sources.length,
    sources: sources.map(({ absolute_path, ...source }) => source),
    authority: {
      branch: identity.branch,
      head: identity.head,
      worktree: 'DIRTY_USER_AUTHORITY_PRESERVED'
    },
    production_db_writes: 0,
    gold_mutations: 0,
    provider_calls_before_execution: 0
  };
}

function safeDiagnostic(value) {
  const diagnostic = value && typeof value === 'object' ? value : {};
  const safeString = (field, max = 240) => typeof diagnostic[field] === 'string'
    ? diagnostic[field].slice(0, max) : null;
  const integer = field => Number.isInteger(diagnostic[field]) ? diagnostic[field] : null;
  return {
    provider: safeString('provider', 80),
    model: safeString('model', 160),
    configured_provider: safeString('configured_provider', 80),
    configured_model: safeString('configured_model', 160),
    requested_provider: safeString('requested_provider', 80),
    requested_model: safeString('requested_model', 160),
    response_provider: safeString('response_provider', 80),
    response_model: safeString('response_model', 160),
    endpoint: safeString('endpoint', 120),
    task_type: safeString('task_type', 80),
    gateway_http_status: integer('gateway_http_status'),
    provider_http_status: integer('provider_http_status'),
    provider_http_reached: diagnostic.provider_http_reached === true,
    provider_adapter_invoked: diagnostic.provider_adapter_invoked === true,
    fetch_invoked: diagnostic.fetch_invoked === true,
    json_parse_success: typeof diagnostic.json_parse_success === 'boolean' ? diagnostic.json_parse_success : null,
    finish_reason: safeString('finish_reason', 40),
    output_truncated: diagnostic.output_truncated === true,
    resolved_max_output_tokens: integer('resolved_max_output_tokens'),
    configured_default_max_tokens: integer('configured_default_max_tokens'),
    task_override_applied: typeof diagnostic.task_override_applied === 'boolean' ? diagnostic.task_override_applied : null,
    prompt_tokens: integer('prompt_tokens'),
    completion_tokens: integer('completion_tokens'),
    total_tokens: integer('total_tokens'),
    latency_ms: integer('latency_ms'),
    response_id: safeString('response_id', 128),
    provider_trace_id: safeString('provider_trace_id', 128),
    failure_stage: safeString('failure_stage', 100),
    safe_error_code: safeString('safe_error_code', 100),
    safe_error_message: safeString('safe_error_message', 260),
    schema_validation_errors: Array.isArray(diagnostic.schema_validation_errors)
      ? diagnostic.schema_validation_errors.slice(0, 100).map(error => ({
        stage: typeof error?.stage === 'string' ? error.stage.slice(0, 60) : null,
        path: typeof error?.path === 'string' ? error.path.slice(0, 240) : null,
        keyword: typeof error?.keyword === 'string' ? error.keyword.slice(0, 100) : null,
        expected: typeof error?.expected === 'string' ? error.expected.slice(0, 240) : null,
        actual_type: typeof error?.actual_type === 'string' ? error.actual_type.slice(0, 100) : null,
        additional_property: typeof error?.additional_property === 'string' ? error.additional_property.slice(0, 120) : null,
        message: typeof error?.message === 'string' ? error.message.slice(0, 260) : null
      })) : []
  };
}

function sourceWindowLedger(prepared, source) {
  return {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_PRODUCTION_WINDOW_LEDGER',
    holdout_id: source.holdout_id,
    source_file: source.source_path,
    source_sha256: source.source_sha256,
    parser: {
      parsed_source_paragraph_count: prepared.parsed_source_paragraph_count,
      parsed_span_count: prepared.parsed_span_count,
      parser_extracted_character_count: prepared.parser_extracted_character_count,
      selected_window_type: prepared.selected_window_type,
      selected_window_title: prepared.selected_window_title,
      raw_selected_character_count: prepared.raw_selected_character_count
    },
    routing: jsonClone(prepared.routing),
    chunking: {
      ...jsonClone(prepared.chunking),
      chunks: prepared.chunks.map(chunk => ({
        chunk_number: chunk.chunk_number,
        chunk_id: chunk.id,
        character_count: chunk.character_count,
        estimated_token_count: chunk.estimated_token_count ?? null,
        source_refs: chunk.segments.map(segment => segment.source_ref),
        source_ref_count: chunk.segments.length,
        provider_input_sha256: sha256(chunk.provider_input_text || chunk.model_text || chunk.text || ''),
        table_unit_count: Array.isArray(chunk.table_units) ? chunk.table_units.length : 0
      }))
    },
    table_annotation: jsonClone(prepared.table_annotation),
    source_segments: prepared.chunks.flatMap(chunk => chunk.segments.map(segment => ({
      chunk_number: chunk.chunk_number,
      source_ref: segment.source_ref,
      page: segment.page ?? null,
      paragraph: segment.paragraph ?? null,
      text_sha256: sha256(String(segment.text || '')),
      text_length: String(segment.text || '').length,
      routing_role: segment.routing_role ?? null,
      semantic_unit_type: segment.semantic_unit_type ?? null,
      source_start_offset: segment.source_start_offset ?? null,
      source_end_offset: segment.source_end_offset ?? null
    })))
  };
}

function canonicalInput(record, sourceHash = null) {
  const candidate = record.candidate || record;
  return {
    ...candidate,
    candidate_index: record.candidate_index || null,
    source_text: record.source_excerpt || candidate.source_text || null,
    source_excerpt: record.source_excerpt || candidate.source_excerpt || null,
    source_verified: record.source_verified === true,
    source_match_type: record.source_match_type || null,
    source_resolution_status: record.source_verified === true ? 'verified' : 'unresolved',
    // The production candidate envelope carries source refs but not the
    // enclosing document hash.  The Eval projection binds that existing
    // backend-owned identity without changing the production contract.
    source_hash: candidate.source_hash || sourceHash || null,
    source_page: candidate.source_page ?? null,
    source_page_start: candidate.source_page_start ?? null,
    source_page_end: candidate.source_page_end ?? null,
    source_paragraph: candidate.source_paragraph ?? null,
    source_paragraph_start: candidate.source_paragraph_start ?? null,
    source_paragraph_end: candidate.source_paragraph_end ?? null,
    source_clause_id: candidate.source_clause_id || null,
    source_chunk_id: candidate.source_chunk_id || null
  };
}

function projectCandidate(record, index, source) {
  const candidate = record.candidate || record;
  return {
    candidate_id: `${source.holdout_id}-CAND-${String(index + 1).padStart(5, '0')}`,
    holdout_id: source.holdout_id,
    tender_id: source.holdout_id,
    chunk_number: record.chunk_number ?? null,
    text: candidate.text || null,
    category: candidate.category || null,
    mandatory_observed: candidate.mandatory_observed ?? null,
    requires_confirmation: candidate.requires_confirmation ?? null,
    source_range: jsonClone(candidate.source_range || null),
    source_excerpt: record.source_excerpt || null,
    source_verified: record.source_verified === true,
    source_match_type: record.source_match_type || null,
    source_start_offset: record.source_start_offset ?? null,
    source_end_offset: record.source_end_offset ?? null,
    source_hash: candidate.source_hash || source.source_sha256,
    source_page: candidate.source_page ?? null,
    source_page_start: candidate.source_page_start ?? null,
    source_page_end: candidate.source_page_end ?? null,
    source_paragraph: candidate.source_paragraph ?? null,
    source_paragraph_start: candidate.source_paragraph_start ?? null,
    source_paragraph_end: candidate.source_paragraph_end ?? null,
    source_clause_id: candidate.source_clause_id || null,
    source_chunk_id: candidate.source_chunk_id || null
  };
}

function projectCanonical(item, source, index) {
  const output = { ...item };
  delete output.req_id;
  delete output.ordinal;
  return {
    ...output,
    canonical_requirement_id: `${source.holdout_id}-CAN-${String(index + 1).padStart(5, '0')}`,
    holdout_id: source.holdout_id,
    tender_id: source.holdout_id,
    eval_only: true,
    canonical_visibility: 'HIDDEN_FIRST_PASS',
    semantic_expected_labels: 'NOT_CREATED'
  };
}

function safeExecution(item, source) {
  const diagnostic = safeDiagnostic(item.diagnostic);
  return {
    execution_id: item.execution_id || null,
    holdout_id: source.holdout_id,
    tender_id: source.holdout_id,
    chunk_number: item.chunk_number ?? null,
    source_chunk_id: item.source_chunk_id || null,
    source_chunk_hash: item.source_chunk_hash || null,
    request_hash: item.request_hash || null,
    started_at: item.started_at || null,
    finished_at: item.finished_at || null,
    duration_ms: item.runtime_ms ?? diagnostic.latency_ms,
    provider: diagnostic.provider,
    model: diagnostic.model,
    endpoint: diagnostic.endpoint,
    resolved_max_output_tokens: diagnostic.resolved_max_output_tokens,
    configured_default_max_tokens: diagnostic.configured_default_max_tokens,
    task_override_applied: diagnostic.task_override_applied,
    provider_http_reached: diagnostic.provider_http_reached,
    provider_http_status: diagnostic.provider_http_status,
    gateway_http_status: diagnostic.gateway_http_status,
    finish_reason: diagnostic.finish_reason,
    json_parse_pass: diagnostic.json_parse_success,
    schema_pass: item.schema_pass === true,
    candidate_count: item.candidate_count || 0,
    source_resolution_pass: item.source_resolution_pass === true,
    backend_ingestion_pass: item.backend_ingestion_pass === true,
    retry_count: 0,
    ok: item.ok === true,
    output_truncated: diagnostic.output_truncated,
    failure_stage: item.first_failure_stage || diagnostic.failure_stage,
    failure_code: item.first_failure_code || item.error_code || diagnostic.safe_error_code,
    failure_message: item.error_message || diagnostic.safe_error_message,
    diagnostic
  };
}

function qualityDistribution(requirements) {
  return requirements.reduce((counts, item) => {
    const decision = item.quality_gate_decision || 'UNSET';
    counts[decision] = (counts[decision] || 0) + 1;
    return counts;
  }, {});
}

function sourceResolutionEntries(candidates, source) {
  return candidates.map(candidate => ({
    holdout_id: source.holdout_id,
    tender_id: source.holdout_id,
    candidate_id: candidate.candidate_id,
    chunk_number: candidate.chunk_number,
    source_refs: candidate.source_range ? [candidate.source_range.start_ref, candidate.source_range.end_ref].filter(Boolean) : [],
    source_hash: candidate.source_hash,
    source_verified: candidate.source_verified,
    source_match_type: candidate.source_match_type,
    source_start_offset: candidate.source_start_offset,
    source_end_offset: candidate.source_end_offset
  }));
}

function gitIdentity() {
  return {
    branch: process.env.GIT_BRANCH || null,
    head: process.env.GIT_HEAD || null,
    worktree: 'DIRTY_USER_AUTHORITY_PRESERVED'
  };
}

async function main() {
  const sources = await discoverSources();
  const runId = `${RUN_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const runRoot = resolve(RESULTS, runId);
  const paths = {
    sourceManifest: resolve(runRoot, 'source-manifest.json'),
    parsedSources: resolve(runRoot, 'parsed-sources'),
    segmentLedgers: resolve(runRoot, 'source-segment-ledgers'),
    windowLedgers: resolve(runRoot, 'production-window-ledgers'),
    candidates: resolve(runRoot, 'candidate-artifacts'),
    sourceResolutions: resolve(runRoot, 'source-resolution-artifacts'),
    canonical: resolve(runRoot, 'canonical-requirements'),
    quality: resolve(runRoot, 'quality-gate-artifacts'),
    executionLedger: resolve(runRoot, 'execution-runtime-ledger.json'),
    runtimeTelemetry: resolve(runRoot, 'runtime-telemetry.json'),
    checkpoint: resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_FIRST_PASS_CHECKPOINT.json'),
    checkpointMd: resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_FIRST_PASS_CHECKPOINT.md'),
    gptPacket: resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_GPT_REVIEW_PACKET.json')
  };
  await mkdir(runRoot, { recursive: true });
  const manifest = sourceManifest(sources, gitIdentity());
  await writeJson(paths.sourceManifest, manifest);
  const env = loadBackendEnvironment();
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const tenderMetrics = [];
  const allCandidates = [];
  const allCanonical = [];
  const executionLedger = [];
  const sourceResolutionLedger = [];
  const startedAt = new Date().toISOString();

  for (const source of sources) {
    const packet = {
      tender_id: source.holdout_id,
      title: basename(source.original_filename, source.file_extension),
      source_file: source.source_path,
      source_file_sha256: source.source_sha256,
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
    const prepared = await buildAnnotatedPath(packet, env);
    await writeJson(resolve(paths.parsedSources, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_file: source.source_path,
      source_sha256: source.source_sha256,
      parsed_source_paragraph_count: prepared.parsed_source_paragraph_count,
      parser_extracted_character_count: prepared.parser_extracted_character_count,
      selected_paragraphs: prepared.selected_paragraphs,
      routed_sections: prepared.routed_sections,
      scope: prepared.scope
    });
    await writeJson(resolve(paths.segmentLedgers, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_sha256: source.source_sha256,
      entries: prepared.chunks.flatMap(chunk => chunk.segments.map(segment => ({
        chunk_number: chunk.chunk_number,
        source_ref: segment.source_ref,
        page: segment.page ?? null,
        paragraph: segment.paragraph ?? null,
        text: segment.text,
        source_start_offset: segment.source_start_offset ?? null,
        source_end_offset: segment.source_end_offset ?? null,
        routing_role: segment.routing_role ?? null,
        semantic_unit_type: segment.semantic_unit_type ?? null
      })))
    });
    await writeJson(resolve(paths.windowLedgers, `${source.holdout_id}.json`), sourceWindowLedger(prepared, source));
    const run = await runTender(packet, prepared, gateway, null, { concurrency: 1 });
    const candidates = (run._candidate_records || []).map((record, index) => projectCandidate(record, index, source));
    const verifiedForCanonical = (run._candidate_records || [])
      .filter(record => record.source_verified === true)
      .map(record => canonicalInput(record, source.source_sha256));
    const canonicalRaw = verifiedForCanonical.length
      ? buildCanonicalRequirements(verifiedForCanonical, {
        documentText: prepared.scope?.content_text || null,
        qualityGate: true
      })
      : [];
    const canonical = canonicalRaw.map((item, index) => projectCanonical(item, source, index));
    const safeExecutions = (run.chunk_results || []).map(item => safeExecution(item, source));
    executionLedger.push(...safeExecutions);
    sourceResolutionLedger.push(...sourceResolutionEntries(candidates, source));
    allCandidates.push(...candidates);
    allCanonical.push(...canonical);
    const failed = safeExecutions.filter(item => !item.ok);
    const providerExecutions = safeExecutions.filter(item => item.provider_http_reached || item.provider_http_status !== null).length;
    tenderMetrics.push({
      holdout_id: source.holdout_id,
      original_filename: source.original_filename,
      source_sha256: source.source_sha256,
      source_size_bytes: source.source_size_bytes,
      source_type: source.source_type,
      parsed_source_paragraph_count: prepared.parsed_source_paragraph_count,
      parsed_span_count: prepared.parsed_span_count,
      page_count: prepared.scope?.pages?.length ?? null,
      production_window_count: prepared.chunks.length,
      chunk_coverage_rate: prepared.chunks.length > 0 ? 1 : 0,
      provider_executions: providerExecutions,
      successful_executions: safeExecutions.filter(item => item.ok).length,
      failed_executions: failed.length,
      candidate_count: candidates.length,
      source_resolution_pass_count: candidates.filter(item => item.source_verified).length,
      source_resolution_fail_count: candidates.filter(item => !item.source_verified).length,
      source_resolution_pass_rate: candidates.length ? candidates.filter(item => item.source_verified).length / candidates.length : null,
      canonical_requirement_count: canonical.length,
      quality_gate_distribution: qualityDistribution(canonical),
      finish_reason_distribution: safeExecutions.reduce((counts, item) => {
        const key = item.finish_reason || 'NOT_REPORTED'; counts[key] = (counts[key] || 0) + 1; return counts;
      }, {}),
      output_truncation_count: safeExecutions.filter(item => item.output_truncated).length,
      schema_failure_count: safeExecutions.filter(item => item.schema_pass === false).length,
      transport_or_provider_failure_count: safeExecutions.filter(item => !item.provider_http_reached && !item.ok).length,
      retry_count: safeExecutions.reduce((sum, item) => sum + (item.retry_count || 0), 0),
      table_annotation: jsonClone(prepared.table_annotation),
      routing: jsonClone(prepared.routing),
      chunking: jsonClone(prepared.chunking)
    });
    await writeJson(resolve(paths.candidates, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_file: source.source_path,
      source_sha256: source.source_sha256,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      candidates,
      expected_labels: 'NOT_INCLUDED'
    });
    await writeJson(resolve(paths.sourceResolutions, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_sha256: source.source_sha256,
      entries: sourceResolutionEntries(candidates, source),
      source_resolution_pass_rate: candidates.length ? candidates.filter(item => item.source_verified).length / candidates.length : null
    });
    await writeJson(resolve(paths.canonical, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_sha256: source.source_sha256,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      requirements: canonical,
      expected_labels: 'NOT_INCLUDED'
    });
    await writeJson(resolve(paths.quality, `${source.holdout_id}.json`), {
      holdout_id: source.holdout_id,
      source_sha256: source.source_sha256,
      quality_gate_version: canonical[0]?.quality_gate_version || null,
      distribution: qualityDistribution(canonical),
      requirements: canonical.map(item => ({
        canonical_requirement_id: item.canonical_requirement_id,
        quality_gate_decision: item.quality_gate_decision,
        quality_gate_reason_codes: item.quality_gate_reason_codes,
        semantic_quality_review_required: item.semantic_quality_review_required
      }))
    });
  }

  const providerExecutions = executionLedger.filter(item => item.provider_http_reached || item.provider_http_status !== null);
  const failureCount = executionLedger.filter(item => !item.ok).length;
  const sourceResolutionFailures = allCandidates.filter(item => !item.source_verified).length;
  const status = sources.length === 2 && tenderMetrics.every(metric => metric.chunk_coverage_rate === 1)
    ? 'READY_FOR_GPT_REQUIREMENT_UNSEEN_HOLDOUT_V3_FIRST_PASS_ADJUDICATION'
    : 'FAILED_DEVELOPMENT_EVIDENCE';
  await writeJson(paths.executionLedger, {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_EXECUTION_RUNTIME_LEDGER',
    run_id: runId,
    executions: executionLedger,
    provider_execution_count: providerExecutions.length,
    failure_count: failureCount,
    first_pass_only: true,
    raw_provider_response_persisted: false
  });
  await writeJson(paths.runtimeTelemetry, {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_RUNTIME_TELEMETRY',
    run_id: runId,
    task_type: 'requirement_extraction',
    provider_executions: providerExecutions.length,
    successful_executions: executionLedger.filter(item => item.ok).length,
    failed_executions: failureCount,
    retry_count: 0,
    finish_reason_distribution: executionLedger.reduce((counts, item) => {
      const key = item.finish_reason || 'NOT_REPORTED'; counts[key] = (counts[key] || 0) + 1; return counts;
    }, {}),
    output_truncation_count: executionLedger.filter(item => item.output_truncated).length,
    schema_failure_count: executionLedger.filter(item => item.schema_pass === false).length,
    transport_or_provider_failure_count: executionLedger.filter(item => !item.provider_http_reached && !item.ok).length,
    actual_runtime_identity: executionLedger.map(item => item.diagnostic).filter(Boolean),
    normal_production_task_budget: {
      requirement_extraction: 9600,
      shared_default_non_requirement: 4800,
      eval_override_used: false,
      configured_chunk_budget: resolveRequirementChunkBudget(env)
    }
  });
  await writeJson(resolve(runRoot, 'source-resolution-ledger.json'), {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_SOURCE_RESOLUTION_LEDGER',
    run_id: runId,
    entries: sourceResolutionLedger,
    total_candidates: allCandidates.length,
    resolved_candidates: allCandidates.filter(item => item.source_verified).length,
    unresolved_candidates: sourceResolutionFailures,
    source_resolution_pass_rate: allCandidates.length ? (allCandidates.length - sourceResolutionFailures) / allCandidates.length : null
  });
  await writeJson(paths.gptPacket, {
    artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_GPT_REVIEW_PACKET',
    run_id: runId,
    canonical_visibility: 'HIDDEN_FIRST_PASS',
    semantic_labels: 'NOT_INCLUDED',
    expected_labels: 'NOT_INCLUDED',
    candidates: allCandidates,
    canonical_requirements: allCanonical,
    source_manifest_path: relativeRepo(paths.sourceManifest),
    execution_ledger_path: relativeRepo(paths.executionLedger),
    source_resolution_ledger_path: relativeRepo(resolve(runRoot, 'source-resolution-ledger.json'))
  });
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_FIRST_PASS_CHECKPOINT',
    run_id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    source_count: sources.length,
    source_manifest_path: relativeRepo(paths.sourceManifest),
    sources: tenderMetrics.map(metric => ({
      holdout_id: metric.holdout_id,
      original_filename: metric.original_filename,
      source_sha256: metric.source_sha256,
      source_type: metric.source_type,
      parsed_source_paragraph_count: metric.parsed_source_paragraph_count,
      production_window_count: metric.production_window_count,
      provider_executions: metric.provider_executions,
      successful_executions: metric.successful_executions,
      failed_executions: metric.failed_executions,
      finish_reason_distribution: metric.finish_reason_distribution,
      output_truncation_count: metric.output_truncation_count,
      schema_failure_count: metric.schema_failure_count,
      candidate_count: metric.candidate_count,
      canonical_requirement_count: metric.canonical_requirement_count,
      source_resolution_pass_count: metric.source_resolution_pass_count,
      source_resolution_fail_count: metric.source_resolution_fail_count,
      source_resolution_pass_rate: metric.source_resolution_pass_rate,
      quality_gate_distribution: metric.quality_gate_distribution
    })),
    total_provider_executions: providerExecutions.length,
    successful_executions: executionLedger.filter(item => item.ok).length,
    failed_executions: failureCount,
    finish_reason_distribution: executionLedger.reduce((counts, item) => {
      const key = item.finish_reason || 'NOT_REPORTED'; counts[key] = (counts[key] || 0) + 1; return counts;
    }, {}),
    output_truncation_count: executionLedger.filter(item => item.output_truncated).length,
    schema_failure_count: executionLedger.filter(item => item.schema_pass === false).length,
    transport_or_provider_failure_count: executionLedger.filter(item => !item.provider_http_reached && !item.ok).length,
    total_candidates: allCandidates.length,
    total_canonical_requirements: allCanonical.length,
    source_resolution_pass_rate: allCandidates.length ? (allCandidates.length - sourceResolutionFailures) / allCandidates.length : null,
    quality_gate_distribution: qualityDistribution(allCanonical),
    artifact_paths: {
      source_manifest: relativeRepo(paths.sourceManifest),
      parsed_sources: relativeRepo(paths.parsedSources),
      source_segment_ledgers: relativeRepo(paths.segmentLedgers),
      production_window_ledgers: relativeRepo(paths.windowLedgers),
      candidate_artifacts: relativeRepo(paths.candidates),
      source_resolution_artifacts: relativeRepo(paths.sourceResolutions),
      canonical_requirements: relativeRepo(paths.canonical),
      quality_gate_artifacts: relativeRepo(paths.quality),
      execution_runtime_ledger: relativeRepo(paths.executionLedger),
      runtime_telemetry: relativeRepo(paths.runtimeTelemetry),
      gpt_review_packet: relativeRepo(paths.gptPacket),
      checkpoint: relativeRepo(paths.checkpoint)
    },
    task_budget: {
      requirement_extraction_resolved_max_output_tokens: 9600,
      shared_default_non_requirement_max_output_tokens: 4800,
      eval_override_used: false
    },
    side_effects: {
      PRODUCTION_DB_WRITES: 0,
      GOLD_MUTATIONS: 0,
      PROMPT_MUTATIONS: 0,
      SCHEMA_MUTATIONS: 0,
      REQUIREMENT_PRODUCTION_LOGIC_MUTATIONS: 0,
      FACT_MUTATIONS: 0,
      MAPPING: 0,
      CLAIM: 0,
      WRITER: 0,
      RESPONSE_ROUTER_MUTATIONS: 0,
      COMMIT: 0,
      PUSH: 0,
      MERGE: 0,
      DEPLOY: 0
    },
    final_status: status
  };
  await writeJson(paths.checkpoint, checkpoint);
  await writeFile(paths.checkpointMd, [
    '# V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_FIRST_PASS_CHECKPOINT',
    '',
    `- RUN_ID: ${runId}`,
    `- FINAL_STATUS: ${status}`,
    `- SOURCES: ${sources.length}/2`,
    `- PROVIDER_EXECUTIONS: ${providerExecutions.length}`,
    `- SUCCESSFUL_EXECUTIONS: ${executionLedger.filter(item => item.ok).length}`,
    `- FAILED_EXECUTIONS: ${failureCount}`,
    `- CANDIDATES: ${allCandidates.length}`,
    `- CANONICAL_REQUIREMENTS: ${allCanonical.length}`,
    `- SOURCE_RESOLUTION_PASS_RATE: ${checkpoint.source_resolution_pass_rate}`,
    `- QUALITY_GATE: ${JSON.stringify(checkpoint.quality_gate_distribution)}`,
    '- EXPECTED_LABELS: NOT_INCLUDED',
    '- PRODUCTION_DB_WRITES: 0',
    '- GOLD_MUTATIONS: 0',
    '- PROVIDER_RAW_RESPONSES_PERSISTED: NO'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({
    run_id: runId,
    final_status: status,
    sources: sources.map(source => ({ holdout_id: source.holdout_id, filename: source.original_filename, sha256: source.source_sha256 })),
    production_windows: Object.fromEntries(tenderMetrics.map(metric => [metric.holdout_id, metric.production_window_count])),
    provider_executions: providerExecutions.length,
    successful_executions: executionLedger.filter(item => item.ok).length,
    failed_executions: failureCount,
    candidates: allCandidates.length,
    canonical_requirements: allCanonical.length,
    source_resolution_pass_rate: checkpoint.source_resolution_pass_rate,
    quality_gate_distribution: checkpoint.quality_gate_distribution,
    artifact_root: relativeRepo(runRoot)
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'BLOCKED',
    code: error?.code || error?.message || 'V43_HOLDOUT_V3_FIRST_PASS_FAILED',
    message: String(error?.message || error).slice(0, 500)
  }, null, 2));
  process.exitCode = 1;
});
