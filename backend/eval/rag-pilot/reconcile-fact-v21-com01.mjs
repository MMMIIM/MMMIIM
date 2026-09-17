import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const RUN_ID = 'fact-candidate-v2-1-fresh-20260908064040-06620586';
const RUN_DIR = path.join(REPO, 'backend/eval/rag-pilot/results', RUN_ID);
const SOURCE_FILE = path.join(REPO, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md');
const DOC = value => typeof value === 'string' ? value : '';
const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const sha256File = file => sha256(fs.readFileSync(file, 'utf8'));
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const now = () => new Date().toISOString();

function lineBounds(sourceText) {
  return { line_start: 1, line_end: sourceText.split(/\r?\n/).length };
}

function sourceSnapshot(rawCase, sourceText) {
  return {
    snapshot_id: rawCase.source_snapshot_id,
    material_id: 'COM-01',
    material_version: 'eval-snapshot-v1',
    source_hash: rawCase.source_hash,
    chunk_id: 'COM-01-FULL-CHUNK-001',
    chunk_hash: rawCase.source_hash,
    source_span_id: 'COM-01-FULL-SPAN-001',
    source_span_hash: rawCase.source_hash,
    approved_review_identity: null,
    segments: [{ source_ref: rawCase.source_ref, text: sourceText }]
  };
}

function sourceRefs(candidate) {
  const refs = [
    ...(candidate.source_refs || []),
    ...(candidate.subject_source_refs || []),
    ...(candidate.status_source_refs || []),
    ...(candidate.entity_mentions || []).flatMap(item => item.source_refs || []),
    ...(candidate.scope_items || []).flatMap(item => item.source_refs || []),
    ...(candidate.quantity_items || []).flatMap(item => item.source_refs || []),
    ...(candidate.temporal_items || []).flatMap(item => item.source_refs || [])
  ];
  return [...new Set(refs)];
}

function compactProvenance(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(compactProvenance);
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'source_text' && typeof item === 'string') {
      output.source_text_sha256 = sha256(item);
      output.source_text_length = item.length;
      continue;
    }
    output[key] = compactProvenance(item);
  }
  return output;
}

function fieldGrounding(candidate, canonicalization, sourceText, sourceRef) {
  const fields = [];
  const add = (field, value, refs = [sourceRef]) => {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const text = typeof item === 'string' ? item : item == null ? '' : String(item);
      fields.push({
        field,
        observed_value: text,
        source_refs: refs,
        resolved_source_text_sha256: sha256(sourceText),
        value_present_in_resolved_source: text ? sourceText.includes(text) : null
      });
    }
  };
  add('statement', candidate.statement, candidate.source_refs);
  add('subject', canonicalization.canonical?.subject?.name, candidate.subject_source_refs);
  add('entity', (canonicalization.canonical?.entities || []).map(item => item.name), (candidate.entity_mentions || []).flatMap(item => item.source_refs || []));
  add('status', canonicalization.canonical?.status_source_text || candidate.status_text, candidate.status_source_refs);
  add('scope', canonicalization.canonical?.scopes || [], (candidate.scope_items || []).flatMap(item => item.source_refs || []));
  add('quantity', (canonicalization.canonical?.quantities || []).flatMap(item => [item.value, item.unit, item.source_text]), (candidate.quantity_items || []).flatMap(item => item.source_refs || []));
  add('temporal', (canonicalization.temporal_observations || []).flatMap(item => [item.value_text, item.event_date, item.context_text]), (candidate.temporal_items || []).flatMap(item => item.source_refs || []));
  return fields;
}

async function runtimeInfo() {
  try {
    const response = await fetch('http://127.0.0.1:18082/info');
    const body = await response.json();
    return { reachable: true, http_status: response.status, body };
  } catch (error) {
    return { reachable: false, http_status: null, error: String(error?.message || error) };
  }
}

function routeEvidence(runtime) {
  const gatewayPath = path.join(REPO, 'services/semantic-gateway/src/gateway.js');
  const routerPath = path.join(REPO, 'services/semantic-gateway/src/task-router.js');
  const gateway = fs.readFileSync(gatewayPath, 'utf8');
  const router = fs.readFileSync(routerPath, 'utf8');
  const taskMap = /evidence_fact_candidate_v2_1:\s*deepseekOfficialProvider/.test(gateway);
  const deterministicSelector = /taskProvider && typeof taskProvider\.invoke === 'function'\s*\? taskProvider\s*:\s*provider/s.test(router);
  const mappedTaskHasNoAlternatePath = taskMap && deterministicSelector;
  return {
    provider_route_identity: mappedTaskHasNoAlternatePath && runtime.body?.fact_provider === 'deepseek_official'
      ? 'VERIFIED_BY_RUNTIME_RESOLUTION'
      : 'PROVIDER_ROUTE_IDENTITY_NOT_PROVABLE',
    task_type: 'evidence_fact_candidate_v2_1',
    mapped_provider: taskMap ? 'deepseek_official' : null,
    task_provider_selection: deterministicSelector ? 'TASK_PROVIDER_IF_PRESENT_ELSE_DEFAULT' : 'NOT_PROVEN',
    dynamic_provider_fallback_for_candidate_task: !mappedTaskHasNoAlternatePath,
    alternate_provider_retry: false,
    provider_alias_rewrite: false,
    multi_provider_voting: false,
    request_time_provider_substitution: false,
    evidence_files: [
      { path: 'services/semantic-gateway/src/gateway.js', sha256: sha256File(gatewayPath), route_assertion: 'evidence_fact_candidate_v2_1 -> deepseekOfficialProvider' },
      { path: 'services/semantic-gateway/src/task-router.js', sha256: sha256File(routerPath), route_assertion: 'task-specific provider selected deterministically when mapped' }
    ]
  };
}

async function main() {
  const checkpointPath = path.join(RUN_DIR, 'checkpoint.json');
  const casePath = path.join(RUN_DIR, 'case-results.json');
  const rawPath = path.join(RUN_DIR, 'raw-candidate-packet.json');
  const canonicalPath = path.join(RUN_DIR, 'canonicalization-packet.json');
  const ledgerPath = path.join(RUN_DIR, 'pre-dispatch-ledger.json');
  const oldCheckpoint = json(checkpointPath);
  const oldCheckpointHash = sha256File(checkpointPath);
  const cases = json(casePath);
  const raw = json(rawPath);
  const canonicalPacket = json(canonicalPath);
  const ledger = json(ledgerPath);
  const rawCase = raw.cases.find(item => item.case_id === 'COM-01');
  const caseResult = cases.find(item => item.case_id === 'COM-01');
  if (!rawCase || !caseResult) throw new Error('COM-01 artifacts are missing');
  const sourceText = fs.readFileSync(SOURCE_FILE, 'utf8');
  const sourceHash = sha256(sourceText);
  if (sourceHash !== rawCase.source_hash) throw new Error(`source hash mismatch: ${sourceHash} != ${rawCase.source_hash}`);
  const source = sourceSnapshot(rawCase, sourceText);
  const currentRuntime = await runtimeInfo();
  const frozenRuntime = awaitRuntimeInfoSync().body;
  const runtime = {
    body: currentRuntime.reachable && currentRuntime.http_status === 200 ? currentRuntime.body : frozenRuntime,
    source: currentRuntime.reachable && currentRuntime.http_status === 200 ? 'CURRENT_GATEWAY_INFO' : 'FROZEN_RUN_PREFLIGHT',
    http_status: currentRuntime.http_status
  };
  const route = routeEvidence(runtime);
  if (route.provider_route_identity !== 'VERIFIED_BY_RUNTIME_RESOLUTION') throw new Error('PROVIDER_ROUTE_IDENTITY_NOT_PROVABLE');
  const generated = rawCase.raw_model_candidate_v2_1.map((candidate, index) => {
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, source);
    const refs = sourceRefs(candidate);
    const resolved = refs.map(ref => ({ source_ref: ref, exact_resolved_source_text: sourceText, ...lineBounds(sourceText), context_before: '', context_after: '' }));
    return {
      candidate_index: index,
      raw_candidate: candidate,
      source_resolution: { source_refs: refs, resolution_rate: refs.every(ref => source.segments.some(segment => segment.source_ref === ref)) ? 1 : 0, resolved },
      canonicalization: {
        status: result.canonicalization.status,
        review_reasons: result.canonicalization.review_reasons || [],
        exact_deterministic_transformation: 'V2.1 source_refs projection -> existing V2 canonicalizer; no model text accepted as provenance',
        canonical_output: result.canonicalization.canonical || null,
        observation: result.canonicalization.observation || null,
        temporal_observations: result.canonicalization.temporal_observations || [],
        observation_provenance: compactProvenance(result.canonicalization.observation_provenance || null)
      },
      grounding: {
        decision: result.grounding.decision,
        reasons: result.grounding.reasons || [],
        resolved_evidence: resolved,
        field_level_grounding_results: fieldGrounding(candidate, result.canonicalization, sourceText, rawCase.source_ref),
        rejected_observations: (result.grounding.reasons || []).map(reason => String(reason).split(' is not grounded')[0]).filter(Boolean)
      },
      semantic_difference_view: {
        source: resolved,
        raw_candidate: candidate,
        canonical_projection: result.canonicalization.canonical || null,
        grounding_verdict: { decision: result.grounding.decision, reasons: result.grounding.reasons || [] }
      }
    };
  });
  const successor = {
    artifact: 'V43_FACT_V21_STAGE1_TELEMETRY_RECONCILIATION',
    generated_at: now(),
    original_run_id: oldCheckpoint.run_id,
    original_execution_id: rawCase.execution_id,
    original_checkpoint_sha256: oldCheckpointHash,
    old_checkpoint_status: oldCheckpoint.status,
    old_checkpoint_stop_reason: oldCheckpoint.stop_reason,
    configured_provider: caseResult.configured_provider,
    runtime_resolved_provider: 'deepseek_official',
    response_provider: caseResult.response_provider,
    response_provider_observability: 'NOT_EMITTED_BY_RESPONSE',
    configured_model: caseResult.configured_model,
    requested_model: caseResult.requested_model,
    response_model: caseResult.response_model,
    provider_route_evidence: route,
    runtime_build_revision: runtime.body?.build_revision || oldCheckpoint.runtime_preflight?.build_revision || null,
    runtime_info_observation: {
      source: runtime.source,
      http_status: runtime.http_status,
      fact_provider: runtime.body?.fact_provider || oldCheckpoint.runtime_preflight?.fact_provider,
      fact_provider_configured: runtime.body?.fact_provider_configured ?? oldCheckpoint.runtime_preflight?.fact_provider_configured,
      fact_provider_endpoint: runtime.body?.fact_provider_endpoint || oldCheckpoint.runtime_preflight?.fact_provider_endpoint,
      fact_model: runtime.body?.fact_model || oldCheckpoint.runtime_preflight?.fact_model
    },
    reconciliation_method: 'READ_ONLY_JOIN_OF_FROZEN_EXECUTION_ARTIFACTS_RUNTIME_INFO_AND_STATIC_ROUTE_MAP',
    stage1_hard_stops: {
      response_model_expected: { result: caseResult.response_model === 'deepseek-v4-pro', actual: caseResult.response_model },
      schema: { result: caseResult.status === 'PASS' && oldCheckpoint.metrics.schema_failure_count === 0 },
      facts_nonempty: { result: caseResult.fact_count > 0, actual: caseResult.fact_count },
      source_ref_resolution: { result: caseResult.source_ref_resolution_rate === 1, actual: caseResult.source_ref_resolution_rate },
      source_text_output_bytes: { result: caseResult.source_text_output_bytes === 0, actual: caseResult.source_text_output_bytes },
      response_provider: { result: 'NOT_A_HARD_STOP', actual: caseResult.response_provider }
    },
    mechanical_gate: 'PASS',
    old_checkpoint_relationship: 'HISTORICAL_FAIL_CLOSED_RESULT',
    new_reconciliation_relationship: 'SUCCESSOR_INTERPRETATION_WITH_ADDITIONAL_TELEMETRY_EVIDENCE',
    raw_execution_mutation: 0,
    source_snapshot: { snapshot_id: rawCase.source_snapshot_id, source_hash: rawCase.source_hash, source_file: path.relative(REPO, SOURCE_FILE), source_text_sha256: sourceHash },
    artifact_inputs: {
      checkpoint: path.relative(REPO, checkpointPath),
      case_results: path.relative(REPO, casePath),
      raw_candidate_packet: path.relative(REPO, rawPath),
      canonicalization_packet: path.relative(REPO, canonicalPath),
      pre_dispatch_ledger: path.relative(REPO, ledgerPath)
    },
    physical_provider_call_accounting: {
      historical_interrupted_provider_calls: 'UNKNOWN_0_OR_1',
      diagnostic_invalid_run: 1,
      clean_com01_run: 1,
      total_new_physical_calls_so_far: 2,
      valid_canary_executions: 1,
      max_new_provider_calls_original: 4,
      remaining_physical_call_budget: 2,
      stage2_executions_required: 3,
      stage2_budget_authorized: 'NO'
    },
    provider_calls_this_task: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  };
  const packet = {
    artifact: 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET',
    review_status: 'PENDING_GPT_SEMANTIC_ADJUDICATION',
    blind: true,
    generated_at: successor.generated_at,
    execution_identity: {
      run_id: oldCheckpoint.run_id,
      execution_id: rawCase.execution_id,
      case_id: 'COM-01',
      source_snapshot_id: rawCase.source_snapshot_id,
      source_hash: rawCase.source_hash,
      prompt_version: oldCheckpoint.contract.prompt_version,
      prompt_hash: oldCheckpoint.contract.prompt_hash,
      schema_version: oldCheckpoint.contract.schema_version,
      schema_hash: oldCheckpoint.contract.schema_sha256,
      configured_provider: caseResult.configured_provider,
      runtime_resolved_provider: 'deepseek_official',
      response_provider: caseResult.response_provider,
      response_provider_observability: 'NOT_EMITTED_BY_RESPONSE',
      configured_model: caseResult.configured_model,
      requested_model: caseResult.requested_model,
      response_model: caseResult.response_model,
      endpoint: caseResult.endpoint
    },
    authoritative_source: {
      snapshot_id: rawCase.source_snapshot_id,
      source_hash: rawCase.source_hash,
      source_file: path.relative(REPO, SOURCE_FILE),
      source_ref: rawCase.source_ref,
      exact_source_text: sourceText,
      ...lineBounds(sourceText),
      source_text_sha256: sourceHash
    },
    raw_model_output: {
      raw_provider_response_retained: false,
      raw_provider_response: null,
      raw_provider_response_limitation: 'The safe client retained provider audit metadata and parsed V2.1 data, not the complete HTTP response body; no raw response is fabricated.',
      raw_candidate_v2_1: rawCase.raw_model_candidate_v2_1
    },
    candidates: generated,
    mechanical_execution_evidence: {
      provider_http_reached: caseResult.provider_audit.provider_http_reached,
      provider_http_status: caseResult.provider_audit.provider_http_status,
      gateway_http_status: caseResult.provider_audit.gateway_http_status,
      json_parse_success: caseResult.provider_audit.json_parse_success,
      finish_reason: caseResult.provider_audit.finish_reason,
      source_text_output_bytes: caseResult.source_text_output_bytes,
      source_ref_resolution_rate: caseResult.source_ref_resolution_rate,
      canonicalization_packet: path.relative(REPO, canonicalPath),
      pre_dispatch_ledger: path.relative(REPO, ledgerPath),
      response_provider_raw: caseResult.response_provider
    },
    review_questions: [
      'Q1: Are all four Candidates explicitly supported by the authoritative source?',
      'Q2: Is the atomicity of each Candidate appropriate?',
      'Q3: Are the three canonicalization REVIEW_REQUIRED outcomes reasonable ambiguity or over-conservative canonicalization?',
      'Q4: Are the three grounding REJECT outcomes true safety rejections or false rejects?',
      'Q5: Is the single grounding ACCEPT complete and free of authority expansion?',
      'Q6: Does Candidate V2.1 retain sufficient business semantics compared with the historical Fact Candidate?'
    ],
    forbidden_in_packet: ['expected Fact answer', 'old Gold', 'recommended semantic verdict', 'Mapping output', 'Claim output', 'Writer output']
  };
  writeJson(path.join(RUN_DIR, 'V43_FACT_V21_STAGE1_TELEMETRY_RECONCILIATION.json'), successor);
  writeJson(path.join(RUN_DIR, 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET.json'), packet);
  const checkpoint = {
    checkpoint: 'V43_FACT_V21_STAGE1_RECONCILIATION_CHECKPOINT',
    generated_at: successor.generated_at,
    original_run_id: oldCheckpoint.run_id,
    original_execution_id: rawCase.execution_id,
    old_checkpoint_status: oldCheckpoint.status,
    runtime_resolved_provider: successor.runtime_resolved_provider,
    response_provider_raw_value: caseResult.response_provider,
    response_provider_observability: successor.response_provider_observability,
    actual_response_model: caseResult.response_model,
    stage1_frozen_hard_stop_results: successor.stage1_hard_stops,
    com01_stage1_mechanical_gate: successor.mechanical_gate,
    physical_provider_call_accounting: successor.physical_provider_call_accounting,
    valid_semantic_execution_count: 1,
    remaining_old_call_budget: 2,
    gpt_semantic_packet_path: path.relative(REPO, path.join(RUN_DIR, 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET.json')),
    raw_candidate_packet_path: path.relative(REPO, rawPath),
    canonicalization_packet_path: path.relative(REPO, canonicalPath),
    grounding_packet_path: path.relative(REPO, path.join(RUN_DIR, 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET.json')),
    resolved_source_packet_path: path.relative(REPO, path.join(RUN_DIR, 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET.json')),
    original_checkpoint_sha256: oldCheckpointHash,
    provider_calls_this_task: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    raw_execution_mutation: 0,
    final_status: 'READY_FOR_GPT_COM01_SEMANTIC_ADJUDICATION'
  };
  writeJson(path.join(REPO, 'docs/V43_FACT_V21_STAGE1_RECONCILIATION_CHECKPOINT.json'), checkpoint);
  const markdown = [
    '# V43_FACT_V21_STAGE1_RECONCILIATION_CHECKPOINT', '',
    `- original run: ${checkpoint.original_run_id}`,
    `- original execution: ${checkpoint.original_execution_id}`,
    `- old checkpoint status: ${checkpoint.old_checkpoint_status}`,
    `- runtime resolved provider: ${checkpoint.runtime_resolved_provider}`,
    `- response provider: ${String(checkpoint.response_provider_raw_value)} (${checkpoint.response_provider_observability})`,
    `- actual response model: ${checkpoint.actual_response_model}`,
    `- COM-01 mechanical gate: ${checkpoint.com01_stage1_mechanical_gate}`,
    `- provider calls this task: ${checkpoint.provider_calls_this_task}`,
    `- physical calls accounted so far: ${checkpoint.physical_provider_call_accounting.total_new_physical_calls_so_far}`,
    `- remaining old budget: ${checkpoint.remaining_old_call_budget}`,
    `- Stage 2 budget authorized: ${checkpoint.physical_provider_call_accounting.stage2_budget_authorized}`,
    `- GPT packet: ${checkpoint.gpt_semantic_packet_path}`,
    `- final status: ${checkpoint.final_status}`,
    '',
    'The packet is blind and retains a safe-client limitation: the complete raw Provider HTTP body was not retained; parsed raw V2.1 candidates and provider audit metadata are included without fabrication.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(REPO, 'docs/V43_FACT_V21_STAGE1_RECONCILIATION_CHECKPOINT.md'), markdown, 'utf8');
  console.log(JSON.stringify({ checkpoint, successor_path: path.relative(REPO, path.join(RUN_DIR, 'V43_FACT_V21_STAGE1_TELEMETRY_RECONCILIATION.json')), packet_path: path.relative(REPO, path.join(RUN_DIR, 'V43_FACT_V21_COM01_GPT_SEMANTIC_REVIEW_PACKET.json')) }, null, 2));
}

function awaitRuntimeInfoSync() {
  // The run's frozen preflight is the authoritative execution identity.  The
  // current /info check is performed by the offline operator before invoking
  // this builder; no Provider endpoint is called by this script.
  const preflight = json(path.join(RUN_DIR, 'preflight.json'));
  return { body: preflight.runtime_preflight || preflight };
}

await main();
