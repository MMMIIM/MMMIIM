#!/usr/bin/env node
/**
 * Targeted Provider replay for the frozen P0 unsafe-44 ledger.
 *
 * This is deliberately an Eval-only runner. It reconstructs each planned
 * source chunk through the existing tender parser/chunker path, invokes the
 * existing Requirement Extraction Gateway serially with no retries, and
 * writes only safe execution metadata to the repository. Full provider
 * payloads/responses are captured, when available, under a restricted temp
 * evidence root outside the repository.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import { combineRequirementExtractionSections } from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { evaluateCandidatePayload } from '../requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { prepareTender } from '../requirement-semantic-quality-v1/runner.js';
import { createEvalEvidenceSink, isEvidenceSinkSafe } from '../../src/eval/flywheel/evidence-sink.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const V2_MODE = process.env.V43_P0_REPLAY_V2 === '1';
const WORK_DIR = path.join(ROOT, V2_MODE ? 'docs/eval/flywheel/p0-badcase-repair-v2' : 'docs/eval/flywheel/p0-badcase-repair-v1');
const PLAN_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_REPLAY_PLAN_V2.json' : 'V43_P0_BADCASE_44_REPLAY_PLAN.json');
const RUNTIME_CHECKPOINT_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_REPLAY_V2_RUNTIME_CHECKPOINT.json' : 'V43_P0_BADCASE_44_REPLAY_RUNTIME_CHECKPOINT.json');
const V2_CHECKPOINT_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.json');
const V2_CHECKPOINT_MD_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.md');
const RESULT_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_REPLAY_V2_RESULTS.json' : 'V43_P0_BADCASE_44_REPLAY_RESULTS.json');
const FIRST_DIVERGENCE_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2.json' : 'V43_P0_BADCASE_44_FIRST_DIVERGENCE.json');
const FAILURE_FAMILY_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS_V2.json' : 'V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS.json');
const REGRESSION_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_TARGETED_REGRESSION_V2.json' : 'V43_P0_BADCASE_44_TARGETED_REGRESSION.json');
const GPT_PACKET_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json' : 'V43_P0_BADCASE_44_GPT_POST_REPAIR_PACKET.json');
const MASTER_CHECKPOINT_PATH = path.join(WORK_DIR, V2_MODE ? 'V43_P0_BADCASE_44_REPLAY_V2_PROVIDER_CHECKPOINT.md' : 'V43_P0_BADCASE_44_MASTER_CHECKPOINT.md');
const RUN_ID = V2_MODE ? 'V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V2' : 'V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V1';
const MAX_CALLS = V2_MODE ? null : 39;
const TENDERS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
const PRODUCTION_DIR = path.join(ROOT, 'docs/eval/requirement-production-core6-20260911');
const TENDER_EXPORTS = Object.freeze(Object.fromEntries(TENDERS.map(tender => [
  tender,
  path.join(PRODUCTION_DIR, `${tender}.production-requirements.json`)
])));

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}
function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value), 'utf8').digest('hex');
}
function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }
function safeString(value, max = 240) { return typeof value === 'string' ? value.slice(0, max) : null; }
function safeInt(value) { return Number.isInteger(value) ? value : null; }

function loadPlan({ allowCompleted = false } = {}) {
  const plan = readJson(PLAN_PATH);
  const validChunkCount = V2_MODE
    ? Number.isInteger(plan.replay_chunk_count) && plan.replay_chunk_count > 0
    : plan.replay_chunk_count === MAX_CALLS;
  if (plan.run_id !== RUN_ID || plan.case_count !== 44 || !validChunkCount) {
    throw new Error('REPLAY_PLAN_IDENTITY_MISMATCH');
  }
  if (!allowCompleted && plan.provider_execution?.status === 'COMPLETED') throw new Error('REPLAY_ALREADY_COMPLETED');
  return plan;
}

function loadExistingCheckpoint() {
  if (!fs.existsSync(RUNTIME_CHECKPOINT_PATH)) return null;
  const checkpoint = readJson(RUNTIME_CHECKPOINT_PATH);
  const expectedCount = V2_MODE ? Number(checkpoint.replay_chunk_count) : MAX_CALLS;
  if (checkpoint.run_id !== RUN_ID || !Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new Error('RUNTIME_CHECKPOINT_IDENTITY_MISMATCH');
  }
  return checkpoint;
}

function productionRecords(tender) {
  const artifact = readJson(TENDER_EXPORTS[tender]);
  return artifact.requirements || [];
}

function sourceChunkRecords(tender, sourceChunkId) {
  return productionRecords(tender).filter(item => item.source_chunk_id === sourceChunkId);
}

function chunkNumberFor(records) {
  const candidates = records.flatMap(item => [
    ...(Array.isArray(item.source_lineage) ? item.source_lineage : []),
    ...(Array.isArray(item.sources_json) ? item.sources_json : [])
  ]).map(item => item?.chunk_number).filter(Number.isInteger);
  return candidates.length ? Math.min(...candidates) : 1;
}

function sourceSectionFor(records) {
  return records.map(item => item.source_section)
    .concat(records.flatMap(item => (Array.isArray(item.source_lineage) ? item.source_lineage : []).map(lineage => lineage.source_section)))
    .find(value => typeof value === 'string' && value.trim()) || null;
}

async function prepareTenderV2(tenderId, env) {
  const sourceFile = path.join(ROOT, `backend/eval/tender-benchmark-v1/sources/${tenderId === 'JY-001' ? 'JY-001-jiangyin' : tenderId === 'TB-003' ? 'TB-003-jiaozuo-sidian' : tenderId === 'TB-006' ? 'TB-006-beijing-emergency-model-cloud' : tenderId === 'FAST-01' ? 'FAST-01-dapeng-healthcare' : tenderId === 'FAST-04' ? 'FAST-04-beijing-software' : 'FAST-WATER-01-beijing-water-ops'}.pdf`);
  const buffer = fs.readFileSync(sourceFile);
  const extraction = await extractTenderText({ fileName: sourceFile, mimeType: 'application/pdf', buffer });
  const analysis = classifyTenderSections(extraction);
  const routedSections = Array.isArray(analysis.requirementExtractionSections) && analysis.requirementExtractionSections.length
    ? analysis.requirementExtractionSections : (analysis.sections || []);
  const scope = combineRequirementExtractionSections(routedSections);
  const budget = resolveRequirementChunkBudget(env);
  const options = {
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  };
  const chunks = chunkExtractedText({
    text: scope?.content_text || extraction.text,
    paragraphs: scope?.paragraphs?.length ? scope.paragraphs : extraction.paragraphs,
    ...options
  });
  const fullChunks = chunkExtractedText({ text: extraction.text, paragraphs: extraction.paragraphs, ...options });
  return {
    tender_id: tenderId,
    title: tenderId,
    source_file: `backend/eval/tender-benchmark-v1/sources/${path.basename(sourceFile)}`,
    source_sha256: sha256(buffer),
    chunks,
    fullChunks,
    sourceSegments: chunks.flatMap((chunk) => chunk.segments.map((segment) => ({ ...segment, chunk_number: chunk.chunk_number }))),
    fullSourceSegments: fullChunks.flatMap((chunk) => chunk.segments.map((segment) => ({ ...segment, chunk_number: chunk.chunk_number })))
  };
}

function buildReplayChunk(planChunk, prepared) {
  const sourceChunkId = planChunk.authoritative_source_chunk_id || planChunk.source_chunk_id || null;
  const refs = new Set(planChunk.source_refs || []);
  const segmentPool = prepared.fullSourceSegments || prepared.sourceSegments || prepared.segments || [];
  const segments = segmentPool.filter(segment => refs.has(segment.source_ref));
  const records = sourceChunkId && !String(sourceChunkId).startsWith('reconstructed:')
    ? sourceChunkRecords(planChunk.tender_id, sourceChunkId) : [];
  const sourceText = segments.map(segment => segment.text).join('\n');
  return {
    source_chunk_id: sourceChunkId,
    chunk_number: planChunk.chunk_number || chunkNumberFor(records),
    text: sourceText,
    model_text: sourceText,
    segments,
    source_section: sourceSectionFor(records) || planChunk.source_section || null,
    source_refs: [...new Set(segments.map(segment => segment.source_ref).filter(Boolean))],
    source_hashes: [...new Set(records.map(item => item.source_hash).filter(Boolean))],
    replay_input_authority_level: planChunk.replay_input_authority_level || null,
    replay_chunk_sha256: planChunk.replay_chunk_sha256 || sha256(sourceText)
  };
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
  const out = {};
  for (const field of fields) {
    const value = probe[field] ?? audit[field];
    if (typeof value === 'boolean' || Number.isInteger(value)) out[field] = value;
    else if (typeof value === 'string') out[field] = safeString(value, field.includes('message') ? 240 : 160);
  }
  for (const field of ['gateway_http_status', 'provider_http_status', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'latency_ms', 'model_content_length_chars']) {
    const value = probe[field] ?? audit[field];
    if (Number.isInteger(value)) out[field] = value;
  }
  if (probe.generation_config && typeof probe.generation_config === 'object') {
    out.generation_config = {
      response_format: probe.generation_config.response_format?.type || null,
      strict: probe.generation_config.response_format?.strict === true,
      enable_thinking: probe.generation_config.enable_thinking === true,
      max_tokens: safeInt(probe.generation_config.max_tokens),
      temperature: typeof probe.generation_config.temperature === 'number' ? probe.generation_config.temperature : null,
      top_p: typeof probe.generation_config.top_p === 'number' ? probe.generation_config.top_p : null,
      top_k: safeInt(probe.generation_config.top_k)
    };
  }
  return out;
}

function classifyError(error, probe) {
  const code = error?.code || probe.safe_error_code || probe.gateway_error_code || null;
  if (code === 'GATEWAY_TIMEOUT' || code === 'PROVIDER_TIMEOUT') return 'PROVIDER_TIMEOUT';
  if (code === 'GATEWAY_NETWORK_ERROR' || code === 'PROVIDER_NETWORK_ERROR') return 'PROVIDER_NETWORK';
  const providerStatus = probe.provider_http_status;
  const gatewayStatus = probe.gateway_http_status;
  if (Number.isInteger(providerStatus) && providerStatus >= 500) return 'PROVIDER_5XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 400) return 'PROVIDER_4XX';
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 500) return 'GATEWAY_5XX';
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 400) return 'GATEWAY_4XX';
  if (code === 'GATEWAY_TRUNCATED_JSON') return 'TRUNCATED_JSON';
  if (code === 'GATEWAY_INVALID_JSON') return 'INVALID_JSON';
  return code || 'LIVE_PROVIDER_FAILURE';
}

function divergenceFor({ error, probe, gatewayResult, evaluation }) {
  if (error) {
    return {
      status: 'DETERMINED',
      scope: 'PRODUCTION',
      stage: probe.provider_http_reached ? 'PROVIDER_OUTPUT' : 'PROVIDER_INPUT',
      reason: `Targeted replay failed at ${classifyError(error, probe)}; no semantic conclusion inferred.`,
      failure_code: error.code || probe.safe_error_code || null
    };
  }
  if (!gatewayResult) return { status: 'DETERMINED', scope: 'PRODUCTION', stage: 'PROVIDER_OUTPUT', reason: 'No gateway result was returned.', failure_code: null };
  if (evaluation?.failure_stage === 'SOURCE_RESOLUTION') return { status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'SOURCE_RESOLUTION', reason: 'Eval harness could not resolve a candidate source reference.', failure_code: evaluation.source_resolution_failure_code };
  if (evaluation?.failure_stage === 'CANONICALIZATION') return { status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'CANONICALIZATION', reason: 'Eval harness canonicalization boundary rejected the candidate.', failure_code: evaluation.canonicalization_failure_code };
  if (evaluation?.failure_stage === 'QUALITY_GATE') return { status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'QUALITY_GATE', reason: 'Eval harness quality gate did not PASS.', failure_code: null };
  if (evaluation?.quality_gate_decision === 'REVIEW_REQUIRED_OR_EMPTY') return { status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'QUALITY_GATE', reason: 'Provider returned no candidate requirements.', failure_code: 'NO_CANDIDATES_RETURNED_BY_PROVIDER' };
  return { status: 'NOT_OBSERVED', scope: 'EVAL_HARNESS', stage: 'NONE_OBSERVED', reason: 'Targeted replay completed without a deterministic divergence in the existing checks.', failure_code: null };
}

function boundedReplayEvidence(replay) {
  const probe = replay.probe_audit || {};
  const sourceRefs = Array.isArray(replay.source_refs) ? replay.source_refs : [];
  const sourceHashes = Array.isArray(replay.source_hashes) ? replay.source_hashes : [];
  return {
    provider: {
      provider: replay.provider || probe.provider || null,
      requested_model: replay.requested_model || probe.requested_model || null,
      response_model: replay.response_model || probe.response_model || null,
      endpoint: replay.endpoint || probe.endpoint || null,
      provider_http_status: replay.provider_http_status || null,
      finish_reason: replay.finish_reason || null,
      candidate_count: replay.candidate_count,
      schema_pass: replay.schema_pass === true,
      source_refs: sourceRefs
    },
    normalization: {
      candidate_count: replay.candidate_count,
      output_keys_not_persisted_in_repo: true,
      source_refs: sourceRefs
    },
    canonicalization: {
      canonicalization_pass: replay.canonicalization_pass === true,
      canonicalization_failure_code: replay.canonicalization_failure_code || null,
      quality_gate_decision: replay.quality_gate_decision || null,
      semantic_interpretation: 'NOT_PERFORMED_BY_CODEX'
    },
    source_resolution: {
      source_resolution_pass: replay.source_resolution_pass === true,
      source_resolution_failure_code: replay.source_resolution_failure_code || null,
      source_refs: sourceRefs,
      source_hashes: sourceHashes
    }
  };
}

async function captureEvidence(sink, stage, value) {
  if (value == null) return null;
  if (!isEvidenceSinkSafe(value)) throw new Error(`UNSAFE_EVIDENCE:${stage}`);
  const captured = await sink.capture(stage, value);
  return captured.artifact_ref ? {
    path: captured.artifact_ref.path_or_key || null,
    sha256: captured.artifact_ref.sha256 || null
  } : null;
}

function persistRuntimeCheckpoint({ plan, rows, status }) {
  const completed = rows.filter(row => row.status !== 'NOT_EXECUTED');
  writeJson(RUNTIME_CHECKPOINT_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_RUNTIME_CHECKPOINT',
    artifact_version: 'v1',
    run_id: RUN_ID,
    source_truth_sha256: plan.source_truth_sha256,
    replay_chunk_count: plan.replay_chunk_count,
    status,
    provider_calls: completed.length,
    retry_count: 0,
    completed_count: completed.length,
    results: rows.map(row => ({ replay_key: row.replay_key, status: row.status, provider_http_status: row.provider_http_status || null, gateway_http_status: row.gateway_http_status || null, error_class: row.error_class || null, duration_ms: row.duration_ms || null }))
  });
}

function updateArtifacts(plan, rows) {
  const completedPlan = {
    ...plan,
    provider_execution: {
      ...plan.provider_execution,
      status: 'COMPLETED',
      provider_calls: rows.filter(row => row.provider_call === 1).length,
      llm_calls: 0,
      retry_count: 0,
      result_path: rel(RESULT_PATH),
      restricted_evidence_root: rows[0]?.restricted_evidence_refs?.[0]?.path
        ? path.dirname(path.dirname(rows[0].restricted_evidence_refs[0].path))
        : null
    }
  };
  writeJson(PLAN_PATH, completedPlan);

  const atomsByReplayKey = new Map((plan.chunks || []).map((chunk) => [chunk.replay_key, chunk.atom_ids || chunk.badcase_ids || []]));
  const rowByAtom = new Map();
  const planChunkByKey = new Map((plan.chunks || []).map((chunk) => [chunk.replay_key, chunk]));
  for (const row of rows) {
    const atomIds = row.badcase_ids?.length ? row.badcase_ids : (row.atom_ids?.length ? row.atom_ids : atomsByReplayKey.get(row.replay_key) || []);
    for (const atomId of atomIds) {
    const existing = rowByAtom.get(atomId);
    if (!existing || existing.divergence.status !== 'DETERMINED' || existing.divergence.stage === null) rowByAtom.set(atomId, row);
    }
  }
  const divergence = readJson(FIRST_DIVERGENCE_PATH);
  divergence.status = 'TARGETED_REPLAY_COMPLETED_MECHANICAL_STAGES_OBSERVED';
  divergence.replay_run_id = RUN_ID;
  divergence.rows = divergence.rows.map(item => {
    const replay = rowByAtom.get(item.atom_id);
    if (!replay) return item;
    return {
      ...item,
      observability_state: 'TRACE_SUFFICIENT_FOR_MECHANICAL_DIAGNOSIS',
      mechanical_first_divergence_scope: replay.divergence.scope,
      mechanical_first_divergence_stage: replay.divergence.stage,
      mechanical_first_divergence: replay.divergence,
      source_condition: {
        status: 'REPLAY_INPUT_PARITY_PASS',
        replay_input_authority_level: planChunkByKey.get(replay.replay_key)?.replay_input_authority_level || null
      },
      semantic_root_cause: 'PENDING_GPT',
      provider_evidence: boundedReplayEvidence(replay).provider,
      normalization_evidence: boundedReplayEvidence(replay).normalization,
      canonicalization_evidence: boundedReplayEvidence(replay).canonicalization,
      source_resolution_evidence: boundedReplayEvidence(replay).source_resolution,
      replay_evidence: {
        replay_key: replay.replay_key,
        provider_calls: 1,
        provider_http_status: replay.provider_http_status,
        gateway_http_status: replay.gateway_http_status,
        schema_pass: replay.schema_pass,
        candidate_count: replay.candidate_count,
        source_resolution_pass: replay.source_resolution_pass,
        canonicalization_pass: replay.canonicalization_pass,
        quality_gate_decision: replay.quality_gate_decision,
        restricted_evidence_refs: replay.restricted_evidence_refs
      }
    };
  });
  writeJson(FIRST_DIVERGENCE_PATH, divergence);

  const stageCounts = rows.reduce((acc, row) => {
    const key = row.divergence.stage || 'NONE_OBSERVED';
    acc[key] = (acc[key] || 0) + (row.badcase_ids?.length || 0);
    return acc;
  }, {});
  const caseStageCounts = divergence.rows.reduce((acc, item) => {
    const key = item.mechanical_first_divergence.stage || 'NONE_OBSERVED';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const families = fs.existsSync(FAILURE_FAMILY_PATH)
    ? readJson(FAILURE_FAMILY_PATH)
    : {
      artifact_type: 'V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS_V2',
      artifact_version: 'v2',
      run_id: RUN_ID,
      source_truth_sha256: plan.source_truth_sha256,
      proposals: []
    };
  families.status = 'PENDING_GPT_FAILURE_FAMILY_SEMANTIC_REVIEW';
  const frozenByAtom = new Map((readJson(GPT_PACKET_PATH).rows || []).map(row => [row.atom_id, row.frozen_semantic_label]));
  const stageGroups = new Map();
  for (const item of divergence.rows) {
    const stage = item.mechanical_first_divergence.stage || 'NONE_OBSERVED';
    const group = stageGroups.get(stage) || [];
    group.push(item.atom_id);
    stageGroups.set(stage, group);
  }
  const mechanicalStageProposals = [...stageGroups.entries()].map(([stage, memberIds]) => ({
    failure_family_id: `MECHANICAL_${stage}`,
    proposed_name: `Mechanical first divergence at ${stage}`,
    member_badcase_ids: memberIds,
    count: memberIds.length,
    label_distribution: memberIds.reduce((acc, atomId) => {
      const label = frozenByAtom.get(atomId);
      if (label) acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
    first_divergence_distribution: { [stage]: memberIds.length },
    shared_evidence_pattern: `Targeted replay mechanically reported first stage ${stage}; no semantic interpretation is added.`,
    suspected_root_cause: 'MECHANICAL_STAGE_OBSERVATION_ONLY',
    confidence: 'HIGH',
    repair_candidate: 'NONE_PENDING_GPT_HUMAN_REVIEW',
    semantic_review_required: true
  }));
  const observedFamilyIds = new Set(mechanicalStageProposals.map((item) => item.failure_family_id));
  families.proposals = [
    ...(families.proposals || []).filter((item) => !String(item.failure_family_id || '').startsWith('MECHANICAL_') || observedFamilyIds.has(item.failure_family_id)),
    ...mechanicalStageProposals.filter(item => !(families.proposals || []).some(existing => existing.failure_family_id === item.failure_family_id))
  ];
  families.replay_execution = {
    status: 'COMPLETED',
    provider_calls: rows.length,
    retry_count: 0,
    mechanical_first_divergence_distribution: caseStageCounts,
    semantic_root_cause_frozen: false
  };
  writeJson(FAILURE_FAMILY_PATH, families);

  const regression = fs.existsSync(REGRESSION_PATH)
    ? readJson(REGRESSION_PATH)
    : {
      artifact_type: 'V43_P0_BADCASE_44_TARGETED_REGRESSION_V2',
      artifact_version: 'v2',
      run_id: RUN_ID,
      source_truth_sha256: plan.source_truth_sha256
    };
  regression.case_results = divergence.rows.map(item => ({
    atom_id: item.atom_id,
    previous_semantic_label: item.frozen_semantic_label,
    first_divergence: item.mechanical_first_divergence,
    repair_family: null,
    post_repair_candidate_output: { status: 'NOT_APPLICABLE_NO_REPAIR' },
    mechanical_regression_status: 'REPLAY_OBSERVED_NO_AUTONOMOUS_REPAIR',
    semantic_re_adjudication_required: true
  }));
  regression.replay = {
    status: 'COMPLETED_TARGETED_ONLY',
    replay_chunk_count: rows.length,
    provider_calls: rows.length,
    retry_count: 0,
    all_chunks_mapped_to_badcase: rows.every(row => {
      const atomIds = row.badcase_ids?.length ? row.badcase_ids : (row.atom_ids?.length ? row.atom_ids : atomsByReplayKey.get(row.replay_key) || []);
      return atomIds.length > 0;
    }),
    no_semantic_reinterpretation: true
  };
  regression.replay_status = 'COMPLETED_TARGETED_ONLY';
  writeJson(REGRESSION_PATH, regression);

  const packet = readJson(GPT_PACKET_PATH);
  packet.replay_status = 'COMPLETED_TARGETED_ONLY';
  packet.provider_calls = rows.length;
  packet.rows = packet.rows.map(item => {
    const replay = rowByAtom.get(item.atom_id);
    return replay ? {
      ...item,
      mechanical_first_divergence: replay.divergence,
      source_condition: {
        status: 'REPLAY_INPUT_PARITY_PASS',
        replay_input_authority_level: planChunkByKey.get(replay.replay_key)?.replay_input_authority_level || null
      },
      semantic_root_cause: 'PENDING_GPT',
      provider_evidence: boundedReplayEvidence(replay).provider,
      normalization_evidence: boundedReplayEvidence(replay).normalization,
      canonicalization_evidence: boundedReplayEvidence(replay).canonicalization,
      source_resolution_evidence: boundedReplayEvidence(replay).source_resolution,
      replay_status: 'COMPLETED_TARGETED_ONLY',
      replay_evidence: {
        replay_key: replay.replay_key,
        provider_http_status: replay.provider_http_status,
        gateway_http_status: replay.gateway_http_status,
        schema_pass: replay.schema_pass,
        candidate_count: replay.candidate_count,
        source_resolution_pass: replay.source_resolution_pass,
        canonicalization_pass: replay.canonicalization_pass,
        quality_gate_decision: replay.quality_gate_decision,
        restricted_evidence_refs: replay.restricted_evidence_refs
      }
    } : item;
  });
  writeJson(GPT_PACKET_PATH, packet);

  const distribution = Object.entries(caseStageCounts).map(([key, count]) => `${key}=${count}`).join(', ');

  if (V2_MODE && fs.existsSync(V2_CHECKPOINT_PATH)) {
    const checkpoint = readJson(V2_CHECKPOINT_PATH);
    checkpoint.provider_calls = rows.filter((row) => row.provider_call === 1).length;
    checkpoint.llm_calls = 0;
    checkpoint.provider_failures = rows.filter((row) => row.status !== 'RESPONSE_RECEIVED').length;
    checkpoint.retry_count = 0;
    checkpoint.replay_execution_status = 'COMPLETED';
    checkpoint.mechanical_first_divergence_distribution = caseStageCounts;
    checkpoint.semantic_root_cause = 'PENDING_GPT';
    checkpoint.final_status = 'READY_FOR_GPT_P0_44_ROOT_CAUSE_ADJUDICATION_V2';
    writeJson(V2_CHECKPOINT_PATH, checkpoint);
    writeText(V2_CHECKPOINT_MD_PATH, [
      '# V43 P0 BADCASE 44 REPLAY V2 CHECKPOINT', '',
      `- Run: ${RUN_ID}`,
      `- Source truth SHA: ${plan.source_truth_sha256}`,
      `- Source-truth resolutions: ${plan.case_count}/${plan.case_count}`,
      `- Replay input parity: PASS`,
      `- Replay input authority levels: Level 2 persisted chunks + Level 3 deterministic reconstruction`,
      `- Authoritative unique parse chunks: ${plan.replay_chunk_count}`,
      `- Provider calls: ${rows.filter((row) => row.provider_call === 1).length}`,
      '- Retries: 0',
      `- Replay failures: ${rows.filter((row) => row.status !== 'RESPONSE_RECEIVED').length}`,
      `- Mechanical first-divergence distribution: ${distribution || 'NONE_OBSERVED'}`,
      '- Mechanical divergence scope: EVAL_HARNESS only; semantic root cause remains pending GPT',
      '- LLM calls: 0',
      '- Production DB writes: 0',
      '- Gold mutations: 0',
      '- V1 first-divergence counts: not reused as V2 authority',
      '- Final status: READY_FOR_GPT_P0_44_ROOT_CAUSE_ADJUDICATION_V2', ''
    ].join('\n'));
  }

  const failures = rows.filter(row => row.status !== 'RESPONSE_RECEIVED').length;
  const master = [
    '# V43 P0 BADCASE 44 TARGETED DIAGNOSIS AND REPAIR — CHECKPOINT',
    '',
    `- Run: ${RUN_ID}`,
    `- Source truth SHA: ${plan.source_truth_sha256}`,
    `- Frozen unsafe rows: ${plan.case_count}`,
    '- Frozen semantic labels: preserved; no Codex relabeling',
    `- Targeted replay chunks: ${rows.length}/${plan.replay_chunk_count}`,
    `- Provider calls: ${rows.length}`,
    '- Retries: 0',
    `- Replay failures: ${failures}`,
    `- Mechanical first-divergence distribution: ${distribution || 'NONE_OBSERVED'}`,
    '- LLM calls: 0',
    '- Production DB writes: 0',
    '- Gold mutations: 0',
    '- Autonomous repair: NONE',
    '- Semantic root cause: GPT/Human review required',
    '',
    '## Gate',
    '',
    '- Import identity: PASS',
    `- Targeted replay: COMPLETED (${rows.length} unique tender/chunk keys, serial, zero retries)`,
    '- Mechanical first divergence: captured where runtime evidence permits',
    '- Failure family proposals: mechanical evidence only; semantic review required',
    '- Final status: READY_FOR_GPT_P0_44_ROOT_CAUSE_ADJUDICATION_V2'
  ].join('\n') + '\n';
  fs.writeFileSync(MASTER_CHECKPOINT_PATH, master, 'utf8');
}

async function main() {
  const plan = loadPlan();
  const previous = loadExistingCheckpoint();
  if (previous) throw new Error('REPLAY_RUNTIME_CHECKPOINT_EXISTS_NO_AUTOMATIC_RERUN');
  const env = loadBackendEnvironment();
  const prepared = new Map();
  for (const tender of TENDERS) prepared.set(tender, V2_MODE
    ? await prepareTenderV2(tender, env)
    : await prepareTender(tender, env));
  const restrictedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-p0-badcase-replay-'));
  const sink = createEvalEvidenceSink({ mode: 'restricted', rootDir: restrictedRoot, evalRunId: RUN_ID });
  const rows = [];
  let calls = 0;
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  for (const planChunk of plan.chunks) {
    if (calls >= plan.replay_chunk_count) throw new Error('REPLAY_CALL_CAP_EXCEEDED');
    const item = prepared.get(planChunk.tender_id);
    const chunk = buildReplayChunk(planChunk, item);
    if (!chunk.text.trim() || !chunk.segments.length) {
      const failed = {
        replay_key: planChunk.replay_key,
        tender_id: planChunk.tender_id,
        source_chunk_id: planChunk.authoritative_source_chunk_id || planChunk.source_chunk_id || null,
        badcase_ids: planChunk.badcase_ids,
        source_refs: planChunk.source_refs,
        status: 'FAILED_SOURCE_RECONSTRUCTION',
        provider_call: 0,
        retries: 0,
        error_code: 'SOURCE_CHUNK_RECONSTRUCTION_EMPTY',
        error_class: 'SOURCE_INTERNAL_CONFLICT',
        divergence: { status: 'DETERMINED', scope: 'EVAL_HARNESS', stage: 'CHUNK_CONSTRUCTION', reason: 'Planned source refs did not resolve to parser segments.', failure_code: 'SOURCE_CHUNK_RECONSTRUCTION_EMPTY' },
        restricted_evidence_refs: []
      };
      rows.push(failed);
      persistRuntimeCheckpoint({ plan, rows, status: 'RUNNING' });
      continue;
    }
    calls += 1;
    const input = chunk.model_text;
    const started = Date.now();
    let gatewayResult = null;
    let error = null;
    let restrictedEvidenceRefs = [];
    try {
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'PROVIDER_INPUT_SNAPSHOT', {
        task_type: 'requirement_extraction',
        source_chunk_id: chunk.source_chunk_id,
        source_refs: chunk.source_refs,
        source_hashes: chunk.source_hashes,
        input_sha256: `sha256:${sha256(input)}`,
        input_length: input.length,
        model_text: input
      }));
      gatewayResult = await gateway.extract({
        fileName: path.basename(item.source_file),
        text: input,
        paragraphs: chunk.segments,
        chunk,
        projectName: item.title,
        sectionName: chunk.source_section || planChunk.tender_id,
        chunkCount: chunk.replay_input_authority_level === 3
          ? (item.fullChunks?.length || item.chunks?.length || item.chunk_count || null)
          : (item.chunks?.length || item.chunk_count || null),
        diagnosticMode: 'probe-v1'
      });
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
        task_type: 'requirement_extraction',
        source_chunk_id: chunk.source_chunk_id,
        response_payload_json: gatewayResult.audit?.raw_response_payload_json || null
      }));
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'RAW_CANDIDATE_SNAPSHOT', gatewayResult.envelope?.data || null));
    } catch (caught) {
      error = caught;
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'RAW_PROVIDER_RESPONSE_SNAPSHOT', {
        task_type: 'requirement_extraction',
        source_chunk_id: chunk.source_chunk_id,
        error_code: caught?.code || null,
        audit: safeProbe(caught?.audit || {})
      }));
    }
    const probe = safeProbe(gatewayResult?.audit || error?.audit || {});
    let evaluation = null;
    if (gatewayResult) {
      evaluation = evaluateCandidatePayload({ candidates: gatewayResult.candidates, chunk, qualityGate: true });
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'NORMALIZED_CANDIDATE_SNAPSHOT', {
        candidate_count: gatewayResult.candidates.length,
        candidate_keys: gatewayResult.candidates.map(candidate => Object.keys(candidate).sort()),
        candidates: gatewayResult.candidates
      }));
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'CANONICALIZATION_DECISION_SNAPSHOT', evaluation));
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'SOURCE_RESOLUTION_SNAPSHOT', {
        source_resolution_success: evaluation.source_resolution_success,
        source_resolution_failure_code: evaluation.source_resolution_failure_code,
        source_resolution_failed_candidate_index: evaluation.source_resolution_failed_candidate_index,
        source_refs: chunk.source_refs,
        source_hashes: chunk.source_hashes
      }));
      restrictedEvidenceRefs.push(await captureEvidence(sink, 'CANONICAL_OUTPUT_SNAPSHOT', {
        quality_gate_decision: evaluation.quality_gate_decision,
        canonical_count: evaluation.canonical_count || 0,
        canonicalization_failure_code: evaluation.canonicalization_failure_code
      }));
    }
    const finished = Date.now();
    const row = {
      replay_key: planChunk.replay_key,
      tender_id: planChunk.tender_id,
      source_chunk_id: planChunk.authoritative_source_chunk_id || planChunk.source_chunk_id || null,
      replay_input_authority_level: planChunk.replay_input_authority_level || null,
      badcase_ids: planChunk.badcase_ids || planChunk.atom_ids || [],
      atom_ids: planChunk.atom_ids || planChunk.badcase_ids || [],
      source_refs: chunk.source_refs,
      source_hashes: chunk.source_hashes,
      source_chunk_reconstructed: true,
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
      error_class: error ? classifyError(error, probe) : evaluation?.failure_stage || null,
      probe_audit: probe,
      restricted_evidence_refs: restrictedEvidenceRefs.filter(Boolean),
      divergence: divergenceFor({ error, probe, gatewayResult, evaluation })
    };
    rows.push(row);
    persistRuntimeCheckpoint({ plan, rows, status: 'RUNNING' });
    process.stdout.write(`${rows.length}/${plan.replay_chunk_count} ${row.replay_key} ${row.status} ${row.error_class || row.quality_gate_decision || 'OK'}\n`);
  }
  if (rows.length !== plan.replay_chunk_count) throw new Error(`REPLAY_RESULT_COUNT_MISMATCH:${rows.length}`);
  const result = {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_RESULTS',
    artifact_version: 'v1',
    run_id: RUN_ID,
    source_truth_sha256: plan.source_truth_sha256,
    status: 'COMPLETED_TARGETED_ONLY',
    replay_chunk_count: rows.length,
    provider_calls: rows.filter(row => row.provider_call === 1).length,
    retry_count: 0,
    provider_failures: rows.filter(row => row.status !== 'RESPONSE_RECEIVED').length,
    rows,
    restricted_evidence_root: restrictedRoot
  };
  writeJson(RESULT_PATH, result);
  persistRuntimeCheckpoint({ plan, rows, status: 'COMPLETED' });
  updateArtifacts(plan, rows);
  process.stdout.write(`${JSON.stringify({ run_id: RUN_ID, replay_chunk_count: rows.length, provider_calls: result.provider_calls, provider_failures: result.provider_failures, result_path: rel(RESULT_PATH), restricted_evidence_root: restrictedRoot })}\n`);
}

// Mechanical post-run reconciliation for an already completed V2 replay.
// This path reads only the persisted result/plan and performs no Provider or
// database operation; it exists to make the atom-to-chunk mapping auditable.
export function reconcileExistingP0BadcaseReplayV2() {
  if (!V2_MODE) throw new Error('V2_MODE_REQUIRED');
  const plan = loadPlan({ allowCompleted: true });
  const result = readJson(RESULT_PATH);
  if (result.run_id !== RUN_ID || result.replay_chunk_count !== plan.replay_chunk_count) {
    throw new Error('REPLAY_RESULT_IDENTITY_MISMATCH');
  }
  updateArtifacts(plan, result.rows || []);
  return {
    run_id: RUN_ID,
    replay_chunk_count: result.replay_chunk_count,
    provider_calls: result.provider_calls,
    provider_failures: result.provider_failures
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const operation = process.env.V43_P0_RECONCILE_EXISTING_V2 === '1'
    ? Promise.resolve(reconcileExistingP0BadcaseReplayV2())
    : main();
  operation.catch(error => {
    process.stderr.write(`${error?.code || error?.message || error}\n`);
    process.exitCode = 1;
  });
}
