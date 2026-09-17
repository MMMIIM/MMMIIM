/**
 * Corrected V6.3 replay for the 43 non-conflict P0 source anchors.
 *
 * This runner consumes only the offline V6.3 plan and current reconstructed
 * Production-shaped chunks. It deliberately does not alter Gold, Production
 * state, Prompt, Schema, or the V6.2 historical artifacts. Provider payload
 * and response snapshots are captured through the restricted evidence sink;
 * repository artifacts contain only bounded diagnostics and snapshot refs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { evaluateCandidatePayload } from '../requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { createEvalEvidenceSink, isEvidenceSinkSafe } from '../../src/eval/flywheel/evidence-sink.js';
import {
  loadStates,
  readJson,
  sha256,
  sha256File,
  TENDER_ORDER
} from './requirement-p0-scope-v1-1-repair-v6-3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const PLAN_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
const VISIBILITY_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_3.json');
const SUPPORT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3.json');
const CHECKPOINT_JSON_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_V6_3_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_V6_3_CHECKPOINT.md');
const RESULT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_REPLAY_RESULTS_V6_3.json');
const RUNTIME_CHECKPOINT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_REPLAY_RUNTIME_CHECKPOINT_V6_3.json');
const DIVERGENCE_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_FIRST_DIVERGENCE_V6_3.json');
const FAILURE_FAMILY_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_FAILURE_FAMILY_PROPOSALS_V6_3.json');
const PACKET_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3.json');
const RUN_ID = `V43-FLYWHEEL-P0-43-CORRECTED-V6.3-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeString(value, max = 240) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function safeInt(value) { return Number.isInteger(value) ? value : null; }

function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }

function safeProbe(audit = {}) {
  const probe = audit?.probe_diagnostics && typeof audit.probe_diagnostics === 'object'
    ? audit.probe_diagnostics : {};
  const fields = [
    'provider', 'model', 'configured_provider', 'configured_model', 'requested_provider',
    'requested_model', 'response_provider', 'response_model', 'endpoint', 'finish_reason',
    'safe_error_code', 'safe_error_message', 'gateway_error_code', 'provider_error_code',
    'semantic_error_code', 'error_name', 'cause_name', 'cause_code', 'current_stage',
    'failure_stage', 'response_id', 'provider_trace_id', 'response_format_type',
    'exact_validation_path', 'json_parse_success', 'provider_adapter_invoked',
    'fetch_invoked', 'provider_http_reached', 'output_truncated', 'task_override_applied'
  ];
  const output = {};
  for (const field of fields) {
    const value = probe[field] ?? audit[field];
    if (typeof value === 'boolean' || Number.isInteger(value)) output[field] = value;
    else if (typeof value === 'string') output[field] = safeString(value, field.includes('message') ? 240 : 160);
  }
  for (const field of ['gateway_http_status', 'provider_http_status', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'latency_ms', 'model_content_length_chars']) {
    const value = probe[field] ?? audit[field];
    if (Number.isInteger(value)) output[field] = value;
  }
  if (probe.generation_config && typeof probe.generation_config === 'object') {
    output.generation_config = {
      response_format: probe.generation_config.response_format?.type || null,
      strict: probe.generation_config.response_format?.strict === true,
      enable_thinking: probe.generation_config.enable_thinking === true,
      max_tokens: safeInt(probe.generation_config.max_tokens),
      temperature: typeof probe.generation_config.temperature === 'number' ? probe.generation_config.temperature : null,
      top_p: typeof probe.generation_config.top_p === 'number' ? probe.generation_config.top_p : null,
      top_k: safeInt(probe.generation_config.top_k)
    };
  }
  return output;
}

function classifyProviderError(error, probe) {
  const code = error?.code || probe.safe_error_code || probe.gateway_error_code || null;
  const providerStatus = probe.provider_http_status;
  if (code === 'GATEWAY_TIMEOUT' || code === 'PROVIDER_TIMEOUT') return 'PROVIDER_TIMEOUT';
  if (code === 'GATEWAY_NETWORK_ERROR' || code === 'PROVIDER_NETWORK_ERROR') return 'PROVIDER_NETWORK';
  if (Number.isInteger(providerStatus) && providerStatus >= 500) return 'PROVIDER_5XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 400) return 'PROVIDER_4XX';
  if (code === 'GATEWAY_TRUNCATED_JSON') return 'TRUNCATED_JSON';
  if (code === 'GATEWAY_INVALID_JSON') return 'INVALID_JSON';
  return code || 'LIVE_PROVIDER_FAILURE';
}

function divergence({ error, probe, evaluation }) {
  if (error) return {
    status: 'DETERMINED',
    scope: 'PRODUCTION',
    stage: probe.provider_http_reached ? 'PROVIDER_OUTPUT' : 'PROVIDER_INPUT',
    reason: `Corrected replay failed at ${classifyProviderError(error, probe)}; no semantic conclusion inferred.`,
    failure_code: error.code || probe.safe_error_code || null
  };
  if (!evaluation) return {
    status: 'DETERMINED', scope: 'PRODUCTION', stage: 'PROVIDER_OUTPUT',
    reason: 'No deterministic evaluation result was returned.', failure_code: null
  };
  if (evaluation.failure_stage === 'SOURCE_RESOLUTION') return {
    status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'SOURCE_RESOLUTION',
    reason: 'Eval source resolver rejected a provider candidate.',
    failure_code: evaluation.source_resolution_failure_code
  };
  if (evaluation.failure_stage === 'CANONICALIZATION') return {
    status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'CANONICALIZATION',
    reason: 'Eval canonicalization boundary rejected a provider candidate.',
    failure_code: evaluation.canonicalization_failure_code
  };
  if (evaluation.failure_stage === 'QUALITY_GATE' || evaluation.quality_gate_decision === 'REVIEW_REQUIRED_OR_EMPTY') return {
    status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'QUALITY_GATE',
    reason: 'Eval quality gate did not produce an unconditional PASS.',
    failure_code: 'QUALITY_GATE_NOT_PASS'
  };
  return { status: 'NOT_OBSERVED', scope: 'EVAL_HARNESS', stage: 'NONE_OBSERVED', reason: 'No deterministic divergence observed.', failure_code: null };
}

async function capture(sink, stage, value) {
  if (value == null) return null;
  if (!isEvidenceSinkSafe(value)) throw new Error(`UNSAFE_EVIDENCE:${stage}`);
  const result = await sink.capture(stage, value);
  return result.artifact_ref ? {
    path: result.artifact_ref.path_or_key || null,
    sha256: result.artifact_ref.sha256 || null
  } : null;
}

function chunkMap(states) {
  const map = new Map();
  for (const tender of TENDER_ORDER) {
    for (const chunk of states.get(tender).chunks) map.set(`${tender}:reconstructed:${chunk.chunk_number}`, chunk);
  }
  return map;
}

function sourceRefs(chunk) {
  return (chunk.segments || []).map((segment) => segment.source_ref).filter(Boolean);
}

function sourceHashes(chunk) {
  return [...new Set((chunk.segments || []).map((segment) => segment.source_hash).filter(Boolean))];
}

function updateCheckpoint({ plan, result, statuses, sinkRoot }) {
  const checkpoint = fs.existsSync(CHECKPOINT_JSON_PATH) ? readJson(CHECKPOINT_JSON_PATH) : {};
  const completed = result.rows.filter((row) => row.status !== 'NOT_EXECUTED');
  const statusCounts = Object.fromEntries([...new Set(statuses)].map((status) => [status, statuses.filter((item) => item === status).length]));
  const finalStatus = completed.length === plan.unique_production_provider_chunk_count
    ? 'READY_FOR_GPT_P0_43_SEMANTIC_ROOT_CAUSE_ADJUDICATION_V6_3'
    : 'BLOCKED_CORRECTED_REPLAY_INCOMPLETE';
  const next = {
    ...checkpoint,
    final_status: finalStatus,
    replay_run_id: RUN_ID,
    replay_status: completed.length === plan.unique_production_provider_chunk_count ? 'COMPLETED' : 'INCOMPLETE',
    replay_unique_chunk_count: plan.unique_production_provider_chunk_count,
    replay_completed_chunk_count: completed.length,
    replay_provider_calls: result.provider_calls,
    replay_provider_failures: result.provider_failures,
    replay_schema_pass_count: result.rows.filter((row) => row.schema_pass === true).length,
    replay_source_resolution_pass_count: result.rows.filter((row) => row.source_resolution_pass === true).length,
    replay_canonicalization_pass_count: result.rows.filter((row) => row.canonicalization_pass === true).length,
    replay_status_distribution: statusCounts,
    replay_restricted_evidence_root: sinkRoot,
    semantic_root_cause: 'PENDING_GPT'
  };
  writeJson(CHECKPOINT_JSON_PATH, next);
  const lines = [
    '# V43 P0 BadCase 44 Scope v1.1 / V6.3 Checkpoint', '',
    `- FINAL_STATUS: ${next.final_status}`,
    `- SOURCE_TRUTH_SHA256: ${SOURCE_TRUTH_SHA}`,
    `- NON_CONFLICT_CASES: ${next.non_conflict_case_count || 43}`,
    `- MINIMUM_SUPPORT_SPANS: ${next.minimum_support_span_count || 47}`,
    `- CORRECTED_REPLAY_PLAN: ${next.corrected_replay_plan || 'PASS'}`,
    `- REPLAY_RUN_ID: ${RUN_ID}`,
    `- REPLAY_CHUNKS: ${completed.length}/${plan.unique_production_provider_chunk_count}`,
    `- PROVIDER_CALLS: ${result.provider_calls}`,
    `- PROVIDER_FAILURES: ${result.provider_failures}`,
    '- RETRIES: 0',
    `- REPLAY_STATUS_DISTRIBUTION: ${JSON.stringify(statusCounts)}`,
    '- LLM_CALLS: 0',
    '- PRODUCTION_DB_WRITES: 0',
    '- GOLD_MUTATIONS: 0',
    '- PROMPT_CHANGES: 0',
    '- SCHEMA_CHANGES: 0',
    '- SEMANTIC_ROOT_CAUSE: PENDING_GPT', ''
  ];
  fs.writeFileSync(CHECKPOINT_MD_PATH, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const plan = readJson(PLAN_PATH);
  if (plan.source_truth_sha256 !== SOURCE_TRUTH_SHA
    || plan.authoritative_source_to_provider_input_visible !== 'PASS'
    || plan.replay_eligible_case_count !== 43
    || plan.provider_replay_authorized !== true) {
    throw new Error('CORRECTED_REPLAY_GATE_NOT_PASS');
  }
  const visibility = readJson(VISIBILITY_PATH);
  if (visibility.target_case_count !== 43) throw new Error('VISIBILITY_CASE_COUNT_MISMATCH');
  const support = readJson(SUPPORT_PATH);
  if (support.source_truth_sha256 !== SOURCE_TRUTH_SHA) throw new Error('SUPPORT_SOURCE_TRUTH_MISMATCH');
  const states = await loadStates(readJson(path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json')));
  const chunks = chunkMap(states);
  const sinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-p0-v63-replay-'));
  const sink = createEvalEvidenceSink({ mode: 'restricted', rootDir: sinkRoot, evalRunId: RUN_ID });
  const env = loadBackendEnvironment();
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const supportByAtom = new Map((support.rows || []).map((row) => [row.atom_id, row]));
  const rows = [];
  for (const planned of plan.unique_production_provider_chunks) {
    const chunk = chunks.get(planned.chunk_id);
    if (!chunk) throw new Error(`RECONSTRUCTED_CHUNK_NOT_FOUND:${planned.chunk_id}`);
    if (sha256(chunk.text) !== planned.content_sha256 || sha256(chunk.provider_payload_chunk_text) !== planned.provider_payload_chunk_text_sha256) {
      throw new Error(`REPLAY_CHUNK_IDENTITY_MISMATCH:${planned.chunk_id}`);
    }
    const tender = planned.chunk_id.split(':')[0];
    const state = states.get(tender);
    const input = chunk.model_text;
    const started = Date.now();
    let gatewayResult = null;
    let error = null;
    const evidenceRefs = [];
    const refs = sourceRefs(chunk);
    const hashes = sourceHashes(chunk);
    try {
      evidenceRefs.push(await capture(sink, 'PROVIDER_INPUT_SNAPSHOT', {
        run_id: RUN_ID,
        task_type: 'requirement_extraction',
        source_chunk_id: planned.chunk_id,
        source_refs: refs,
        source_hashes: hashes,
        input_sha256: `sha256:${sha256(input)}`,
        input_length: input.length,
        model_text: input
      }));
      gatewayResult = await gateway.extract({
        fileName: state.source_file,
        text: input,
        paragraphs: chunk.segments,
        chunk,
        projectName: state.source_file,
        sectionName: state.scope.title,
        chunkCount: state.chunks.length,
        diagnosticMode: 'probe-v1'
      });
      evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
        run_id: RUN_ID,
        source_chunk_id: planned.chunk_id,
        response_payload_json: gatewayResult.audit?.raw_response_payload_json || null
      }));
      evidenceRefs.push(await capture(sink, 'RAW_CANDIDATE_SNAPSHOT', gatewayResult.envelope?.data || null));
    } catch (caught) {
      error = caught;
      evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
        run_id: RUN_ID,
        source_chunk_id: planned.chunk_id,
        error_code: caught?.code || null,
        audit: safeProbe(caught?.audit || {})
      }));
    }
    const probe = safeProbe(gatewayResult?.audit || error?.audit || {});
    let evaluation = null;
    if (gatewayResult) {
      evaluation = evaluateCandidatePayload({ candidates: gatewayResult.candidates, chunk, qualityGate: true });
      evidenceRefs.push(await capture(sink, 'NORMALIZED_CANDIDATE_SNAPSHOT', {
        candidate_count: gatewayResult.candidates.length,
        candidates: gatewayResult.candidates
      }));
      evidenceRefs.push(await capture(sink, 'CANONICALIZATION_DECISION_SNAPSHOT', evaluation));
      evidenceRefs.push(await capture(sink, 'SOURCE_RESOLUTION_SNAPSHOT', {
        source_resolution_success: evaluation.source_resolution_success,
        source_resolution_failure_code: evaluation.source_resolution_failure_code,
        source_refs: refs,
        source_hashes: hashes
      }));
      evidenceRefs.push(await capture(sink, 'CANONICAL_OUTPUT_SNAPSHOT', {
        quality_gate_decision: evaluation.quality_gate_decision,
        canonical_count: evaluation.canonical_count || 0,
        canonicalization_failure_code: evaluation.canonicalization_failure_code
      }));
    }
    const finished = Date.now();
    const atomRows = (planned.atom_ids || []).map((atomId) => supportByAtom.get(atomId)).filter(Boolean);
    rows.push({
      replay_key: planned.chunk_id,
      run_id: RUN_ID,
      tender_id: tender,
      chunk_id: planned.chunk_id,
      chunk_number: planned.chunk_number,
      atom_ids: planned.atom_ids || [],
      authoritative_source_anchor_ids: atomRows.flatMap((row) => row.minimum_support_spans || []).map((span) => span.support_span_id),
      replay_input_authority_level: 'LEVEL3_DETERMINISTIC_PARSE_RECONSTRUCTION',
      source_refs: refs,
      source_hashes: hashes,
      input_sha256: `sha256:${sha256(input)}`,
      input_length: input.length,
      status: gatewayResult ? 'RESPONSE_RECEIVED' : 'FAILED',
      provider_call: 1,
      retries: 0,
      started_at: new Date(started).toISOString(),
      finished_at: new Date(finished).toISOString(),
      duration_ms: finished - started,
      provider_http_status: probe.provider_http_status || null,
      gateway_http_status: probe.gateway_http_status || error?.audit?.gateway_http_status || null,
      provider_chain_reached: probe.provider_adapter_invoked === true && probe.fetch_invoked === true && probe.provider_http_reached === true,
      provider: probe.provider || null,
      requested_provider: probe.requested_provider || null,
      model: probe.model || null,
      requested_model: probe.requested_model || null,
      response_model: probe.response_model || null,
      endpoint: probe.endpoint || null,
      finish_reason: probe.finish_reason || null,
      schema_pass: Boolean(gatewayResult),
      candidate_count: gatewayResult ? gatewayResult.candidates.length : null,
      source_resolution_pass: evaluation?.source_resolution_success === true,
      source_resolution_failure_code: evaluation?.source_resolution_failure_code || null,
      canonicalization_pass: evaluation?.canonicalization_success === true,
      canonicalization_failure_code: evaluation?.canonicalization_failure_code || null,
      quality_gate_decision: evaluation?.quality_gate_decision || null,
      error_code: error?.code || evaluation?.source_resolution_failure_code || evaluation?.canonicalization_failure_code || null,
      error_class: error ? classifyProviderError(error, probe) : evaluation?.failure_stage || null,
      probe_audit: probe,
      restricted_evidence_refs: evidenceRefs.filter(Boolean),
      divergence: divergence({ error, probe, evaluation }),
      semantic_root_cause: 'PENDING_GPT'
    });
    writeJson(RUNTIME_CHECKPOINT_PATH, {
      artifact_type: 'V43_P0_BADCASE_43_REPLAY_RUNTIME_CHECKPOINT_V6_3',
      run_id: RUN_ID,
      source_truth_sha256: SOURCE_TRUTH_SHA,
      replay_chunk_count: plan.unique_production_provider_chunk_count,
      status: 'RUNNING',
      provider_calls: rows.length,
      retry_count: 0,
      completed_count: rows.length,
      results: rows.map((row) => ({ replay_key: row.replay_key, status: row.status, provider_http_status: row.provider_http_status, gateway_http_status: row.gateway_http_status, error_class: row.error_class, duration_ms: row.duration_ms }))
    });
    process.stdout.write(`${rows.length}/${plan.unique_production_provider_chunk_count} ${planned.chunk_id} ${gatewayResult ? 'RESPONSE_RECEIVED' : 'FAILED'}\n`);
  }
  const result = {
    artifact_type: 'V43_P0_BADCASE_43_REPLAY_RESULTS_V6_3',
    artifact_version: 'v6.3',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    status: rows.length === plan.unique_production_provider_chunk_count ? 'COMPLETED' : 'INCOMPLETE',
    replay_eligible_case_count: 43,
    replay_chunk_count: rows.length,
    provider_calls: rows.length,
    retry_count: 0,
    provider_failures: rows.filter((row) => row.status !== 'RESPONSE_RECEIVED').length,
    llm_calls: rows.length,
    restricted_evidence_root: sinkRoot,
    rows
  };
  writeJson(RESULT_PATH, result);
  writeJson(RUNTIME_CHECKPOINT_PATH, {
    artifact_type: 'V43_P0_BADCASE_43_REPLAY_RUNTIME_CHECKPOINT_V6_3',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    replay_chunk_count: plan.unique_production_provider_chunk_count,
    status: result.status,
    provider_calls: result.provider_calls,
    retry_count: 0,
    completed_count: rows.length,
    results: rows.map((row) => ({ replay_key: row.replay_key, status: row.status, provider_http_status: row.provider_http_status, gateway_http_status: row.gateway_http_status, error_class: row.error_class, duration_ms: row.duration_ms }))
  });
  const divergenceRows = rows.map((row) => ({
    replay_key: row.replay_key,
    tender_id: row.tender_id,
    atom_ids: row.atom_ids,
    frozen_semantic_label: 'NOT_REPORTED_IN_V6_3_PACKET',
    mechanical_first_divergence: row.divergence,
    mechanical_first_divergence_scope: row.divergence.scope,
    mechanical_first_divergence_stage: row.divergence.stage,
    current_replay_failure_mechanism: row.error_class || row.quality_gate_decision || null,
    semantic_root_cause: 'PENDING_GPT'
  }));
  writeJson(DIVERGENCE_PATH, {
    artifact_type: 'V43_P0_BADCASE_43_FIRST_DIVERGENCE_V6_3',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    provider_calls: result.provider_calls,
    rows: divergenceRows
  });
  writeJson(FAILURE_FAMILY_PATH, {
    artifact_type: 'V43_P0_BADCASE_43_FAILURE_FAMILY_PROPOSALS_V6_3',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    semantic_root_cause: 'PENDING_GPT',
    proposals: rows.map((row) => ({ replay_key: row.replay_key, atom_ids: row.atom_ids, failure_family_proposal: row.error_class || row.quality_gate_decision || 'NONE_OBSERVED', confidence: row.error_class ? 'MECHANICAL' : 'NONE', suspected_failure_mechanism: row.divergence.reason }))
  });
  writeJson(PACKET_PATH, {
    artifact_type: 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    semantic_labels_are_frozen_inputs: true,
    semantic_root_cause: 'PENDING_GPT',
    rows: rows.map((row) => ({
      atom_ids: row.atom_ids,
      tender_id: row.tender_id,
      authoritative_source_anchor_ids: row.authoritative_source_anchor_ids,
      provider_input: { chunk_id: row.chunk_id, input_sha256: row.input_sha256, source_refs: row.source_refs, restricted_evidence_refs: row.restricted_evidence_refs.filter((ref) => ref?.path?.includes('PROVIDER_INPUT_SNAPSHOT')) },
      raw_candidate_snapshot: row.restricted_evidence_refs.find((ref) => ref?.path?.includes('RAW_CANDIDATE_SNAPSHOT')) || null,
      normalized_candidate_snapshot: row.restricted_evidence_refs.find((ref) => ref?.path?.includes('NORMALIZED_CANDIDATE_SNAPSHOT')) || null,
      canonicalization_decision_snapshot: row.restricted_evidence_refs.find((ref) => ref?.path?.includes('CANONICALIZATION_DECISION_SNAPSHOT')) || null,
      source_resolution_snapshot: row.restricted_evidence_refs.find((ref) => ref?.path?.includes('SOURCE_RESOLUTION_SNAPSHOT')) || null,
      canonical_output_snapshot: row.restricted_evidence_refs.find((ref) => ref?.path?.includes('CANONICAL_OUTPUT_SNAPSHOT')) || null,
      mechanical_first_divergence: row.divergence,
      current_replay_failure_mechanism: row.error_class || row.quality_gate_decision || null,
      semantic_root_cause: 'PENDING_GPT'
    }))
  });
  updateCheckpoint({ plan, result, statuses: rows.map((row) => row.status), sinkRoot });
  process.stdout.write(`${JSON.stringify({ run_id: RUN_ID, replay_chunk_count: rows.length, provider_calls: result.provider_calls, provider_failures: result.provider_failures, result_path: rel(RESULT_PATH), packet_path: rel(PACKET_PATH), restricted_evidence_root: sinkRoot })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { process.stderr.write(`${error?.code || error?.message || error}\n`); process.exitCode = 1; });
}

export { main };
