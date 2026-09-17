/**
 * V6.4 bounded replay for the 15 GPT-authorized semantic-omission cases.
 *
 * This is Eval-only. It deliberately consumes the already verified V6.3
 * production-shaped chunks, filters only the GPT-authorized repair scope, and
 * writes to V6.4-named artifacts so V6.3 evidence remains immutable.
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
import { loadStates, readJson, sha256, TENDER_ORDER } from './requirement-p0-scope-v1-1-repair-v6-3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const PLAN_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const GPT_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION', '02_GPT_DECISION_PACKET.json');
const OUT_RESULT = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
const OUT_CHECKPOINT = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY_CHECKPOINT.json');
const OUT_PACKET = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_GPT_SEMANTIC_REVIEW_PACKET.json');
const OUT_TRACE = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ROOT_CAUSE_TRACE.json');
const RUN_ID = `V43-REQUIREMENT-V6.4-TARGETED-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

// Mechanical target selection transcribed from the approved V6.3 GPT
// decision artifact. This list is an Eval replay boundary, not a production
// semantic rule; no case-specific behavior is implemented by the producer.
const GPT_AUTHORIZED_ATOMS = [
  'JY-001-P0-0013', 'JY-001-P0-0015', 'JY-001-P0-0016', 'JY-001-P0-0019',
  'JY-001-P0-0020', 'JY-001-P0-0022', 'TB-003-P0-0001', 'TB-003-P0-0006',
  'TB-003-P0-0023', 'TB-003-P0-0024', 'TB-003-P0-0025', 'TB-006-P0-0014',
  'FAST-01-P0-0019', 'FAST-01-P0-0022', 'FAST-WATER-01-P0-0097'
];

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function read(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }
function safeString(value, max = 240) { return typeof value === 'string' ? value.slice(0, max) : null; }
function sourceRefs(chunk) { return (chunk.segments || []).map((segment) => segment.source_ref).filter(Boolean); }
function sourceHashes(chunk) { return [...new Set((chunk.segments || []).map((segment) => segment.source_hash).filter(Boolean))]; }
function safeProbe(audit = {}) {
  const probe = audit?.probe_diagnostics && typeof audit.probe_diagnostics === 'object' ? audit.probe_diagnostics : {};
  const fields = ['provider', 'model', 'configured_provider', 'configured_model', 'requested_provider', 'requested_model', 'response_provider', 'response_model', 'endpoint', 'finish_reason', 'safe_error_code', 'safe_error_message', 'gateway_error_code', 'provider_error_code', 'semantic_error_code', 'error_name', 'cause_name', 'cause_code', 'current_stage', 'failure_stage', 'response_id', 'provider_trace_id', 'response_format_type', 'exact_validation_path', 'json_parse_success', 'provider_adapter_invoked', 'fetch_invoked', 'provider_http_reached', 'output_truncated', 'task_override_applied'];
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
      max_tokens: Number.isInteger(probe.generation_config.max_tokens) ? probe.generation_config.max_tokens : null,
      temperature: typeof probe.generation_config.temperature === 'number' ? probe.generation_config.temperature : null,
      top_p: typeof probe.generation_config.top_p === 'number' ? probe.generation_config.top_p : null,
      top_k: Number.isInteger(probe.generation_config.top_k) ? probe.generation_config.top_k : null
    };
  }
  return output;
}
function chunkMap(states) {
  const map = new Map();
  for (const tender of TENDER_ORDER) for (const chunk of states.get(tender).chunks) map.set(`${tender}:reconstructed:${chunk.chunk_number}`, chunk);
  return map;
}
function classifyError(error, probe) {
  return error?.code || probe.safe_error_code || probe.gateway_error_code || 'LIVE_PROVIDER_FAILURE';
}
async function capture(sink, stage, value) {
  if (value == null) return null;
  if (!isEvidenceSinkSafe(value)) throw new Error(`UNSAFE_EVIDENCE:${stage}`);
  const result = await sink.capture(stage, value);
  return result.artifact_ref ? { path: result.artifact_ref.path_or_key || null, sha256: result.artifact_ref.sha256 || null } : null;
}

async function main() {
  const plan = read(PLAN_PATH);
  const gpt = read(GPT_PATH);
  const authorizedAtoms = new Set(GPT_AUTHORIZED_ATOMS);
  if (authorizedAtoms.size !== 15) throw new Error(`EXPECTED_15_AUTHORIZED_ATOMS:${authorizedAtoms.size}`);
  const planned = (plan.unique_production_provider_chunks || []).filter((chunk) => (chunk.atom_ids || []).some((atom) => authorizedAtoms.has(atom)));
  if (planned.length !== 9) throw new Error(`EXPECTED_9_TARGET_CHUNKS:${planned.length}`);
  const states = await loadStates(read(MANIFEST_PATH));
  const chunks = chunkMap(states);
  const sinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-requirement-v64-replay-'));
  const sink = createEvalEvidenceSink({ mode: 'restricted', rootDir: sinkRoot, evalRunId: RUN_ID });
  const env = loadBackendEnvironment();
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const rows = [];
  for (const entry of planned) {
    const chunk = chunks.get(entry.chunk_id);
    if (!chunk) throw new Error(`TARGET_CHUNK_NOT_FOUND:${entry.chunk_id}`);
    const tender = entry.chunk_id.split(':')[0];
    const state = states.get(tender);
    const input = chunk.model_text;
    const refs = sourceRefs(chunk);
    const hashes = sourceHashes(chunk);
    if (sha256(chunk.text) !== entry.content_sha256 || sha256(chunk.provider_payload_chunk_text) !== entry.provider_payload_chunk_text_sha256) throw new Error(`TARGET_CHUNK_IDENTITY_MISMATCH:${entry.chunk_id}`);
    const evidenceRefs = [];
    let result = null;
    let error = null;
    const started = Date.now();
    try {
      evidenceRefs.push(await capture(sink, 'PROVIDER_INPUT_SNAPSHOT', { run_id: RUN_ID, task_type: 'requirement_extraction', source_chunk_id: entry.chunk_id, source_refs: refs, source_hashes: hashes, input_sha256: `sha256:${sha256(input)}`, input_length: input.length, model_text: input }));
      result = await gateway.extract({ fileName: state.source_file, text: input, paragraphs: chunk.segments, chunk, projectName: state.source_file, sectionName: state.scope.title, chunkIndex: chunk.chunk_number, chunkCount: state.chunks.length, diagnosticMode: 'probe-v1' });
      evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', { run_id: RUN_ID, source_chunk_id: entry.chunk_id, response_payload_json: result.audit?.raw_response_payload_json || null }));
      evidenceRefs.push(await capture(sink, 'RAW_CANDIDATE_SNAPSHOT', result.envelope?.data || null));
    } catch (caught) {
      error = caught;
      evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', { run_id: RUN_ID, source_chunk_id: entry.chunk_id, error_code: caught?.code || null, audit: safeProbe(caught?.audit || {}) }));
    }
    const probe = safeProbe(result?.audit || error?.audit || {});
    let evaluation = null;
    if (result) {
      evaluation = evaluateCandidatePayload({ candidates: result.candidates, chunk, qualityGate: true });
      evidenceRefs.push(await capture(sink, 'NORMALIZED_CANDIDATE_SNAPSHOT', { candidate_count: result.candidates.length, candidates: result.candidates }));
      evidenceRefs.push(await capture(sink, 'CANONICALIZATION_DECISION_SNAPSHOT', evaluation));
      evidenceRefs.push(await capture(sink, 'SOURCE_RESOLUTION_SNAPSHOT', { source_resolution_success: evaluation.source_resolution_success, source_resolution_failure_code: evaluation.source_resolution_failure_code, source_refs: refs, source_hashes: hashes }));
      evidenceRefs.push(await capture(sink, 'CANONICAL_OUTPUT_SNAPSHOT', { quality_gate_decision: evaluation.quality_gate_decision, canonical_count: evaluation.canonical_count || 0, canonicalization_failure_code: evaluation.canonicalization_failure_code }));
    }
    const finished = Date.now();
    rows.push({ replay_key: entry.chunk_id, run_id: RUN_ID, tender_id: tender, chunk_id: entry.chunk_id, atom_ids: entry.atom_ids.filter((atom) => authorizedAtoms.has(atom)), replay_input_authority_level: 'LEVEL3_DETERMINISTIC_PARSE_RECONSTRUCTION', source_refs: refs, source_hashes: hashes, input_sha256: `sha256:${sha256(input)}`, input_length: input.length, status: result ? 'RESPONSE_RECEIVED' : 'FAILED', provider_call: 1, retries: 0, started_at: new Date(started).toISOString(), finished_at: new Date(finished).toISOString(), duration_ms: finished - started, provider_http_status: probe.provider_http_status || null, gateway_http_status: probe.gateway_http_status || error?.audit?.gateway_http_status || null, provider_chain_reached: probe.provider_adapter_invoked === true && probe.fetch_invoked === true && probe.provider_http_reached === true, provider: probe.provider || null, requested_provider: probe.requested_provider || null, model: probe.model || null, requested_model: probe.requested_model || null, response_model: probe.response_model || null, endpoint: probe.endpoint || null, finish_reason: probe.finish_reason || null, schema_pass: Boolean(result), candidate_count: result ? result.candidates.length : null, source_resolution_pass: evaluation?.source_resolution_success === true, source_resolution_failure_code: evaluation?.source_resolution_failure_code || null, canonicalization_pass: evaluation?.canonicalization_success === true, canonicalization_failure_code: evaluation?.canonicalization_failure_code || null, quality_gate_decision: evaluation?.quality_gate_decision || null, error_code: error?.code || evaluation?.source_resolution_failure_code || evaluation?.canonicalization_failure_code || null, error_class: error ? classifyError(error, probe) : evaluation?.failure_stage || null, probe_audit: probe, restricted_evidence_refs: evidenceRefs.filter(Boolean), semantic_root_cause: 'PENDING_GPT' });
    writeJson(OUT_CHECKPOINT, { artifact_type: 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY_CHECKPOINT', run_id: RUN_ID, source_truth_sha256: SOURCE_TRUTH_SHA, authorized_case_count: 15, target_chunk_count: planned.length, completed_chunk_count: rows.length, provider_calls: rows.length, provider_failures: rows.filter((row) => row.status !== 'RESPONSE_RECEIVED').length, retry_count: 0, rows: rows.map((row) => ({ replay_key: row.replay_key, status: row.status, provider_http_status: row.provider_http_status, gateway_http_status: row.gateway_http_status, error_class: row.error_class })), production_db_writes: 0, gold_mutations: 0, prompt_changes: 0, schema_changes: 0 });
    process.stdout.write(`${rows.length}/${planned.length} ${entry.chunk_id} ${result ? 'RESPONSE_RECEIVED' : 'FAILED'}\n`);
  }
  const output = { artifact_type: 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY', artifact_version: 'v6.4', run_id: RUN_ID, source_truth_sha256: SOURCE_TRUTH_SHA, authorized_case_count: 15, replay_chunk_count: rows.length, provider_calls: rows.length, retry_count: 0, provider_failures: rows.filter((row) => row.status !== 'RESPONSE_RECEIVED').length, llm_calls: rows.length, restricted_evidence_root: sinkRoot, rows };
  writeJson(OUT_RESULT, output);
  writeJson(OUT_PACKET, { artifact_type: 'V43_REQUIREMENT_V6_4_GPT_SEMANTIC_REVIEW_PACKET', run_id: RUN_ID, source_truth_sha256: SOURCE_TRUTH_SHA, semantic_root_cause: 'PENDING_GPT', rows });
  writeJson(OUT_TRACE, { artifact_type: 'V43_REQUIREMENT_V6_4_ROOT_CAUSE_TRACE', run_id: RUN_ID, source_truth_sha256: SOURCE_TRUTH_SHA, gpt_authority_source: rel(GPT_PATH), repairable_case_count: 15, rows: rows.map((row) => ({ atom_ids: row.atom_ids, chunk_id: row.chunk_id, input_sha256: row.input_sha256, source_refs: row.source_refs, production_provider_input_visible: true, raw_provider_response_observed: row.status === 'RESPONSE_RECEIVED', schema_pass: row.schema_pass, source_resolution_pass: row.source_resolution_pass, canonicalization_pass: row.canonicalization_pass, mechanical_failure_stage: row.error_class || row.quality_gate_decision || null, semantic_root_cause: 'PENDING_GPT' })), evidence_root: sinkRoot, production_db_writes: 0, gold_mutations: 0 });
  process.stdout.write(`${JSON.stringify({ run_id: RUN_ID, target_chunks: rows.length, provider_calls: output.provider_calls, result_path: rel(OUT_RESULT), checkpoint_path: rel(OUT_CHECKPOINT), evidence_root: sinkRoot })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${error?.code || error?.message || error}\n`); process.exitCode = 1; });

export { main };
