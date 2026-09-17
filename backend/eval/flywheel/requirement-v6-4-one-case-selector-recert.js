/**
 * V6.4 final one-case selector recertification.
 *
 * Eval-only orchestration for FAST-01-P0-0019. The selector is derived from
 * the prior GPT-authorized V6.3 provider-input identity; it is not a
 * production semantic rule and does not alter the frozen Requirement data.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { getSemanticTaskContract, resolveSemanticTaskInstruction } from '../../../packages/semantic-contracts/index.js';
import { evaluateCandidatePayload } from '../requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { createEvalEvidenceSink, isEvidenceSinkSafe } from '../../src/eval/flywheel/evidence-sink.js';
import { loadStates, readJson, sha256, TENDER_ORDER } from './requirement-p0-scope-v1-1-repair-v6-3.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const EVIDENCE_DIR = path.join(OUT_DIR, 'v6-4-one-case-evidence-20260913');
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const ATOM_ID = 'FAST-01-P0-0019';
const TENDER_ID = 'FAST-01';
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const SUPPORT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3.json');
const PLAN_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
const GPT_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION', '02_GPT_DECISION_PACKET.json');
const OLD_REPLAY_PATH = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
const OUT_CORRECTION = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CORRECTION.json');
const OUT_REPLAY = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_REPLAY.json');
const OUT_CHECKPOINT = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CHECKPOINT.json');
const OUT_PACKET = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_GPT_SEMANTIC_REVIEW_PACKET.json');
const RUN_ID = `V43-REQUIREMENT-V6.4-ONE-CASE-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const CONTRACT = getSemanticTaskContract('requirement_extraction');
const INSTRUCTION_HASH = createHash('sha256').update(resolveSemanticTaskInstruction('requirement_extraction'), 'utf8').digest('hex');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }
function safeString(value, max = 240) { return typeof value === 'string' ? value.slice(0, max) : null; }
function sourceRefs(chunk) { return (chunk.segments || []).map((segment) => segment.source_ref).filter(Boolean); }
function sourceHashes(chunk) { return [...new Set((chunk.segments || []).map((segment) => segment.source_hash).filter(Boolean))]; }
function chunkMap(states) {
  const map = new Map();
  for (const tender of TENDER_ORDER) {
    for (const chunk of states.get(tender).chunks) map.set(`${tender}:reconstructed:${chunk.chunk_number}`, chunk);
  }
  return map;
}
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
      max_tokens: Number.isInteger(probe.generation_config.max_tokens) ? probe.generation_config.max_tokens : null,
      temperature: typeof probe.generation_config.temperature === 'number' ? probe.generation_config.temperature : null,
      top_p: typeof probe.generation_config.top_p === 'number' ? probe.generation_config.top_p : null,
      top_k: Number.isInteger(probe.generation_config.top_k) ? probe.generation_config.top_k : null
    };
  }
  return output;
}
async function capture(sink, stage, value) {
  if (value == null) return null;
  if (!isEvidenceSinkSafe(value)) throw new Error(`UNSAFE_EVIDENCE:${stage}`);
  const result = await sink.capture(stage, value);
  return result.artifact_ref ? { path: result.artifact_ref.path_or_key || null, sha256: result.artifact_ref.sha256 || null } : null;
}

/** Select one corrected Eval chunk from GPT-authorized V6.3 identity. */
function selectOneCaseChunk({ atomId, supportRow, plan, gptPacket } = {}) {
  if (atomId !== ATOM_ID) throw new Error(`UNSUPPORTED_ONE_CASE:${atomId}`);
  const gptRow = (gptPacket?.rows || []).find((row) => row.atom_id === atomId);
  const correctedChunkId = gptRow?.relevant_provider_input?.chunk_id;
  if (correctedChunkId !== 'FAST-01:reconstructed:1') throw new Error(`EXPECTED_CORRECTED_CHUNK:FAST-01:reconstructed:1:${correctedChunkId}`);
  const planned = (plan?.unique_production_provider_chunks || []).find((row) => row.chunk_id === correctedChunkId && row.atom_ids?.includes(atomId));
  if (!planned) throw new Error(`AUTHORIZED_CHUNK_NOT_IN_PLAN:${correctedChunkId}`);
  const previousWrong = (readJson(OLD_REPLAY_PATH).rows || []).find((row) => row.atom_ids?.includes(atomId) && row.chunk_id === 'FAST-01:reconstructed:23');
  if (!previousWrong) throw new Error('PREVIOUS_WRONG_CHUNK_NOT_FOUND:FAST-01:reconstructed:23');
  const anchors = supportRow?.minimum_support_spans || [];
  const selected = anchors.find((anchor) => anchor.page === 2 && anchor.paragraph_start === 35);
  if (!selected) throw new Error('AUTHORITATIVE_SUPPORT_SPAN_NOT_FOUND:FAST-01-P0-0019:page2:paragraph35');
  return {
    atom_id: atomId,
    tender_id: TENDER_ID,
    previous_wrong_chunk_id: previousWrong.chunk_id,
    corrected_chunk_id: correctedChunkId,
    resolution_method: 'V6_3_GPT_AUTHORIZED_PROVIDER_INPUT_IDENTITY',
    authority_source: 'V6_3_GPT_RELEVANT_PROVIDER_INPUT',
    authoritative_source_span: anchors.map((anchor) => ({
      support_span_id: anchor.support_span_id,
      source_document_sha256: anchor.source_document_sha256,
      page: anchor.page,
      paragraph_start: anchor.paragraph_start,
      paragraph_end: anchor.paragraph_end,
      source_start_offset: anchor.source_start_offset,
      source_end_offset: anchor.source_end_offset,
      raw_source_text_sha256: anchor.raw_source_text_sha256
    })),
    authoritative_support_span_count: anchors.length,
    selected_support_span_present: true,
    selected_support_span: {
      page: selected.page,
      paragraph_start: selected.paragraph_start,
      paragraph_end: selected.paragraph_end,
      raw_source_text_sha256: selected.raw_source_text_sha256
    },
    expected_provider_payload_chunk_text_sha256: planned.provider_payload_chunk_text_sha256,
    expected_content_sha256: planned.content_sha256
  };
}

async function main() {
  const support = readJson(SUPPORT_PATH);
  const plan = readJson(PLAN_PATH);
  const gptPacket = readJson(GPT_PATH);
  const selection = selectOneCaseChunk({ atomId: ATOM_ID, supportRow: support.rows.find((row) => row.atom_id === ATOM_ID), plan, gptPacket });
  const runtimeManifest = readJson(MANIFEST_PATH);
  const states = await loadStates(runtimeManifest);
  const chunks = chunkMap(states);
  const chunk = chunks.get(selection.corrected_chunk_id);
  const state = states.get(TENDER_ID);
  if (!chunk) throw new Error(`TARGET_CHUNK_NOT_FOUND:${selection.corrected_chunk_id}`);
  if (sha256(chunk.text) !== selection.expected_content_sha256 || sha256(chunk.provider_payload_chunk_text) !== selection.expected_provider_payload_chunk_text_sha256) {
    throw new Error(`TARGET_CHUNK_IDENTITY_MISMATCH:${selection.corrected_chunk_id}`);
  }
  const selectedSegment = chunk.segments.find((segment) => segment.page === 2 && segment.paragraph === 35);
  if (!selectedSegment || !chunk.model_text.includes(selectedSegment.text)) throw new Error('SELECTED_CHUNK_MISSING_AUTHORITATIVE_SUPPORT_TEXT');
  const input = chunk.model_text;
  selection.input_sha256 = `sha256:${sha256(input)}`;
  selection.input_length = input.length;
  selection.source_refs = sourceRefs(chunk);
  selection.source_hashes = sourceHashes(chunk);
  writeJson(OUT_CORRECTION, {
    artifact_type: 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CORRECTION',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    ...selection,
    production_selector_modified: false,
    production_db_writes: 0,
    gold_mutations: 0
  });

  const env = loadBackendEnvironment();
  const runtimeStart = Date.now();
  let readyStatus = null;
  let infoStatus = null;
  try {
    const runtimeBase = String(env.SEMANTIC_GATEWAY_API_BASE || env.V43_GATEWAY_API_BASE || 'http://127.0.0.1:18082').replace(/\/+$/u, '');
    const ready = await fetch(`${runtimeBase}/ready`);
    readyStatus = ready.status;
    const info = await fetch(`${runtimeBase}/info`);
    infoStatus = info.status;
  } catch (_error) {
    readyStatus = null;
    infoStatus = null;
  }
  if (readyStatus !== 200 || infoStatus !== 200) throw new Error(`RUNTIME_NOT_READY:${readyStatus}:${infoStatus}`);
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const sinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-requirement-v64-one-case-'));
  const sink = createEvalEvidenceSink({ mode: 'restricted', rootDir: sinkRoot, evalRunId: RUN_ID });
  const refs = selection.source_refs;
  const hashes = selection.source_hashes;
  const started = Date.now();
  let result = null;
  let error = null;
  const evidenceRefs = [];
  try {
    evidenceRefs.push(await capture(sink, 'PROVIDER_INPUT_SNAPSHOT', {
      run_id: RUN_ID,
      task_type: 'requirement_extraction',
      source_chunk_id: selection.corrected_chunk_id,
      source_refs: refs,
      source_hashes: hashes,
      input_sha256: selection.input_sha256,
      input_length: input.length,
      model_text: input
    }));
    result = await gateway.extract({
      fileName: state.source_file,
      text: input,
      paragraphs: chunk.segments,
      chunk,
      projectName: state.source_file,
      sectionName: state.scope.title,
      chunkIndex: chunk.chunk_number,
      chunkCount: state.chunks.length,
      diagnosticMode: 'probe-v1'
    });
    evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
      run_id: RUN_ID,
      source_chunk_id: selection.corrected_chunk_id,
      response_payload_json: result.audit?.raw_response_payload_json || null
    }));
    evidenceRefs.push(await capture(sink, 'RAW_CANDIDATE_SNAPSHOT', result.envelope?.data || null));
  } catch (caught) {
    error = caught;
    evidenceRefs.push(await capture(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
      run_id: RUN_ID,
      source_chunk_id: selection.corrected_chunk_id,
      error_code: caught?.code || null,
      audit: safeProbe(caught?.audit || {})
    }));
  }
  const probe = safeProbe(result?.audit || error?.audit || {});
  let evaluation = null;
  if (result) {
    evaluation = evaluateCandidatePayload({ candidates: result.candidates, chunk, qualityGate: true });
    evidenceRefs.push(await capture(sink, 'NORMALIZED_CANDIDATE_SNAPSHOT', { candidate_count: result.candidates.length, candidates: result.candidates }));
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
  const evidenceTarget = path.join(EVIDENCE_DIR, RUN_ID);
  if (fs.existsSync(evidenceTarget)) throw new Error(`EVIDENCE_DESTINATION_EXISTS:${evidenceTarget}`);
  const tempEvidenceRun = path.join(sinkRoot, RUN_ID);
  if (fs.existsSync(tempEvidenceRun)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.cpSync(tempEvidenceRun, evidenceTarget, { recursive: true, errorOnExist: true });
  }
  const relocatedEvidenceRefs = evidenceRefs.filter(Boolean).map((ref) => ({
    ...ref,
    path: ref.path ? rel(path.join(evidenceTarget, 'restricted-evidence', path.basename(ref.path))) : null
  }));
  const row = {
    atom_id: ATOM_ID,
    tender_id: TENDER_ID,
    run_id: RUN_ID,
    execution_id: `${RUN_ID}:FAST-01-P0-0019`,
    chunk_id: selection.corrected_chunk_id,
    previous_wrong_chunk_id: selection.previous_wrong_chunk_id,
    replay_input_authority_level: 'LEVEL3_DETERMINISTIC_PARSE_RECONSTRUCTION',
    source_refs: refs,
    source_hashes: hashes,
    input_sha256: selection.input_sha256,
    input_length: input.length,
    status: result ? 'RESPONSE_RECEIVED' : 'FAILED',
    provider_calls: 1,
    retries: 0,
    started_at: new Date(started).toISOString(),
    finished_at: new Date(finished).toISOString(),
    duration_ms: finished - started,
    provider_http_status: probe.provider_http_status || null,
    gateway_http_status: probe.gateway_http_status || null,
    provider_chain_reached: probe.provider_adapter_invoked === true && probe.fetch_invoked === true && probe.provider_http_reached === true,
    provider: probe.provider || null,
    requested_provider: probe.requested_provider || null,
    model: probe.model || null,
    requested_model: probe.requested_model || null,
    response_model: probe.response_model || null,
    endpoint: probe.endpoint || null,
    finish_reason: probe.finish_reason || null,
    schema_pass: Boolean(result),
    candidate_count: result ? result.candidates.length : null,
    source_resolution_pass: evaluation?.source_resolution_success === true,
    source_resolution_failure_code: evaluation?.source_resolution_failure_code || null,
    canonicalization_pass: evaluation?.canonicalization_success === true,
    canonicalization_failure_code: evaluation?.canonicalization_failure_code || null,
    quality_gate_decision: evaluation?.quality_gate_decision || null,
    error_code: error?.code || evaluation?.source_resolution_failure_code || evaluation?.canonicalization_failure_code || null,
    error_class: error?.code || evaluation?.failure_stage || null,
    probe_audit: probe,
    restricted_evidence_refs: relocatedEvidenceRefs,
    semantic_root_cause: 'PENDING_GPT'
  };
  const runtimeIdentity = {
    contract_version: CONTRACT.contract_version,
    instruction_hash: INSTRUCTION_HASH,
    candidate_schema_hash: runtimeManifest.schema_hash || null,
    ready_http_status: readyStatus,
    info_http_status: infoStatus,
    runtime_preflight_duration_ms: Date.now() - runtimeStart,
    production_semantic_changes: 0
  };
  const output = {
    artifact_type: 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_REPLAY',
    artifact_version: 'v6.4-one-case',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    authorized_case_count: 1,
    replay_chunk_count: 1,
    provider_calls: 1,
    retry_count: 0,
    provider_failures: row.status === 'FAILED' ? 1 : 0,
    rows: [row],
    selector_correction: selection,
    runtime_identity: runtimeIdentity,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    provider_call_cap: 1
  };
  writeJson(OUT_REPLAY, output);
  writeJson(OUT_PACKET, {
    artifact_type: 'V43_REQUIREMENT_V6_4_ONE_CASE_GPT_SEMANTIC_REVIEW_PACKET',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    semantic_adjudication: 'PENDING_GPT',
    rows: [{
      atom_id: ATOM_ID,
      tender_id: TENDER_ID,
      frozen_stage1_gpt_context: {
        frozen_anchor_decision: gptPacket.rows.find((x) => x.atom_id === ATOM_ID)?.frozen_anchor_decision || null,
        frozen_semantic_label: gptPacket.rows.find((x) => x.atom_id === ATOM_ID)?.frozen_semantic_label || null,
        frozen_semantic_reason: gptPacket.rows.find((x) => x.atom_id === ATOM_ID)?.frozen_semantic_reason || null,
        authoritative_source_anchors: gptPacket.rows.find((x) => x.atom_id === ATOM_ID)?.authoritative_source_anchors || []
      },
      selector_correction: selection,
      production_provider_input: { task_type: 'requirement_extraction', chunk_id: row.chunk_id, input_sha256: row.input_sha256, source_refs: refs, input_length: input.length, relevant_provider_input_excerpt: input.slice(0, 1200) },
      current_replay: {
        raw_candidate_snapshot: row.restricted_evidence_refs.find((ref) => ref.path.includes('RAW_CANDIDATE')) || null,
        normalized_candidate_snapshot: row.restricted_evidence_refs.find((ref) => ref.path.includes('NORMALIZED_CANDIDATE')) || null,
        canonicalization_decision_snapshot: row.restricted_evidence_refs.find((ref) => ref.path.includes('CANONICALIZATION_DECISION')) || null,
        source_resolution_snapshot: row.restricted_evidence_refs.find((ref) => ref.path.includes('SOURCE_RESOLUTION')) || null,
        canonical_output_snapshot: row.restricted_evidence_refs.find((ref) => ref.path.includes('CANONICAL_OUTPUT')) || null,
        runtime_observation: { ...runtimeIdentity, ...row.probe_audit, finish_reason: row.finish_reason, candidate_count: row.candidate_count, schema_pass: row.schema_pass, source_resolution_pass: row.source_resolution_pass, canonicalization_pass: row.canonicalization_pass, quality_gate_decision: row.quality_gate_decision }
      },
      semantic_root_cause: 'PENDING_GPT'
    }]
  });
  writeJson(OUT_CHECKPOINT, {
    artifact_type: 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CHECKPOINT',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    selector_correction: { atom_id: ATOM_ID, previous_wrong_chunk_id: selection.previous_wrong_chunk_id, corrected_chunk_id: selection.corrected_chunk_id, resolution_method: selection.resolution_method, input_sha256: selection.input_sha256, authoritative_source_span: selection.authoritative_source_span },
    runtime_identity: runtimeIdentity,
    provider_calls: 1,
    retries: 0,
    provider_http_status: row.provider_http_status,
    gateway_http_status: row.gateway_http_status,
    provider_request_reached: row.provider_chain_reached,
    finish_reason: row.finish_reason,
    schema_validation: row.schema_pass ? 'PASS' : 'FAIL',
    source_resolution: row.source_resolution_pass ? 'PASS' : 'FAIL',
    canonicalization: row.canonicalization_pass ? 'PASS' : 'FAIL',
    quality_gate_decision: row.quality_gate_decision,
    production_db_writes: 0,
    gold_mutations: 0,
    production_semantic_changes: 0,
    final_status: row.status === 'RESPONSE_RECEIVED' ? 'READY_FOR_GPT_REQUIREMENT_V6_4_FINAL_ONE_CASE_ADJUDICATION' : 'BLOCKED_ONE_CASE_PROVIDER_OR_GATEWAY_FAILURE',
    evidence_root: rel(evidenceTarget)
  });
  process.stdout.write(`${JSON.stringify({ run_id: RUN_ID, atom_id: ATOM_ID, chunk_id: row.chunk_id, previous_wrong_chunk_id: row.previous_wrong_chunk_id, provider_calls: 1, provider_http_status: row.provider_http_status, gateway_http_status: row.gateway_http_status, finish_reason: row.finish_reason, schema_pass: row.schema_pass, source_resolution_pass: row.source_resolution_pass, canonicalization_pass: row.canonicalization_pass, quality_gate_decision: row.quality_gate_decision, replay_path: rel(OUT_REPLAY), checkpoint_path: rel(OUT_CHECKPOINT), packet_path: rel(OUT_PACKET), correction_path: rel(OUT_CORRECTION), evidence_root: rel(EVIDENCE_DIR) })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { process.stderr.write(`${error?.code || error?.message || error}\n`); process.exitCode = 1; });
}

export { main, selectOneCaseChunk };
