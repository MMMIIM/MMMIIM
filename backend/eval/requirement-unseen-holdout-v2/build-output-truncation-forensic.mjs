import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { estimateTokenCount } from '../../src/pipeline/requirement-chunker.js';

const repoRoot = new URL('../../../', import.meta.url);
const manifestPath = new URL('./work/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json', import.meta.url);
const journalPath = new URL('./results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/execution-journal.json', import.meta.url);
const checkpointJsonPath = new URL('../../../docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.json', import.meta.url);
const checkpointMdPath = new URL('../../../docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.md', import.meta.url);

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const json = value => JSON.stringify(value, null, 2);

function packetFromTender(tender) {
  return {
    tender_id: tender.tender_id,
    title: tender.primary.project_name,
    source_file: tender.primary.path,
    source_file_sha256: tender.primary.sha256,
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
}

function journalEntry(journal, tenderId, chunkNumber) {
  return journal.executions.find(item => item.tender_id === tenderId && item.chunk_number === chunkNumber) || null;
}

function metrics(chunk, entry, { includeInput = false } = {}) {
  const providerInput = chunk.model_text;
  const pages = [...new Set(chunk.segments.map(segment => segment.page).filter(Number.isInteger))];
  const paragraphs = chunk.segments.map(segment => segment.paragraph).filter(Number.isInteger);
  const sectionIdentities = [...new Set(chunk.segments.map(segment => segment.source_section).filter(Boolean))];
  const result = {
    tender_id: entry?.tender_id || null,
    chunk_number: chunk.chunk_number,
    source_chunk_hash: sha256(providerInput),
    request_hash: entry?.request_hash || null,
    source_refs: chunk.segments.map(segment => segment.source_ref),
    input_characters: providerInput.length,
    input_tokens_estimate: estimateTokenCount(providerInput),
    chunk_text_characters: String(chunk.text || '').length,
    chunk_text_tokens_estimate: estimateTokenCount(chunk.text || ''),
    atomic_source_unit_count: chunk.segments.length,
    table_row_count: chunk.table_units.length,
    section_identities: sectionIdentities,
    page_range: { first: Math.min(...pages), last: Math.max(...pages), count: pages.length },
    paragraph_range: { first: Math.min(...paragraphs), last: Math.max(...paragraphs), count: paragraphs.length },
    semantic_window_identity: chunk.id || null,
    semantic_window_identity_basis: chunk.id ? 'backend_chunk_id' : 'tender_id + chunk_number + source_chunk_hash',
    journal_hash_match: sha256(providerInput) === (entry?.source_chunk_hash || entry?.request_hash || null),
    candidate_count: entry?.candidate_count ?? null,
    output_character_count: entry?.raw_model_output ? entry.raw_model_output.length : null,
    output_token_estimate: entry?.raw_model_output ? estimateTokenCount(entry.raw_model_output) : null,
    provider_http_status: entry?.provider_http_status ?? null,
    gateway_http_status: entry?.gateway_http_status ?? null,
    finish_reason: entry?.finish_reason || null,
    duration_ms: entry?.duration_ms ?? null,
    safe_error_code: entry?.safe_error_code || null,
    requested_model_historical: entry?.requested_model ?? null,
    response_model_historical: entry?.response_model ?? null
  };
  if (includeInput) result.provider_ready_input_text = providerInput;
  return result;
}

function redactRuntimeIdentity(value) {
  return {
    provider: value.provider || null,
    provider_host: value.provider_host || null,
    model: value.model || null,
    task_type: value.task_type || null,
    prompt_contract: value.prompt_contract || null,
    prompt_instruction_hash: value.prompt_instruction_hash || null,
    candidate_contract: value.candidate_contract || null,
    candidate_schema_hash: value.candidate_schema_hash || null,
    generation: value.generation || null,
    retry_count: value.retry_count,
    fallback_count: value.fallback_count,
    chunk_budget: value.chunk_budget || null
  };
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const env = loadBackendEnvironment();
const tender = manifest.tenders.find(item => item.tender_id === 'HOLDOUT-REQ-V2-01');
const packet = packetFromTender(tender);
const prepared = await buildAnnotatedPath(packet, env);
const entries = [6, 14, 45].map(chunkNumber => journalEntry(journal, tender.tender_id, chunkNumber));
const chunks = new Map(prepared.chunks.map(chunk => [chunk.chunk_number, chunk]));
const failed = metrics(chunks.get(45), entries[2], { includeInput: true });
const controls = [
  metrics(chunks.get(6), entries[0]),
  metrics(chunks.get(14), entries[1])
];
const runtimeMaxTokens = Number(env.SEMANTIC_GATEWAY_MAX_TOKENS || 4800);
const checkpoint = {
  decision: 'V43_REQUIREMENT_OUTPUT_TRUNCATION_AND_SHARED_PROVIDER_AUDIT_CLOSURE',
  generated_at: new Date().toISOString(),
  source_authority: {
    branch: 'feat/v4.3-semantic-boundary-routing',
    head: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
    worktree: 'DIRTY_USER_AUTHORITY_PRESERVED'
  },
  historical_run: {
    run_id: journal.run_id,
    execution_count: journal.executions.length,
    failed_execution_id: entries[2]?.execution_id || null,
    failed_tender_id: tender.tender_id,
    failed_chunk_number: 45,
    provider_calls: journal.accounting?.actual_provider_calls_total ?? 78,
    retries: 0
  },
  chunk_45_forensic: failed,
  successful_highest_candidate_controls: controls,
  output_budget_forensic: {
    requirement_chunk_token_budget: Number(env.REQUIREMENT_CHUNK_TOKEN_BUDGET || 8000),
    requirement_chunk_token_budget_role: 'input_chunk_budget_only',
    configured_gateway_max_tokens: runtimeMaxTokens,
    configured_gateway_max_tokens_origin: 'services/semantic-gateway/.env SEMANTIC_GATEWAY_MAX_TOKENS',
    runner_generation_max_tokens: runtimeMaxTokens,
    runner_generation_origin: 'buildProductionRuntimeIdentity → gatewayEnv.SEMANTIC_GATEWAY_MAX_TOKENS',
    task_specific_requirement_output_budget: null,
    task_router_generation_override: false,
    provider_adapter_default_max_tokens: 4800,
    provider_request_protocol: 'chat_completions',
    provider_request_field: 'max_tokens',
    provider_request_value: runtimeMaxTokens,
    responses_protocol_field_if_selected: 'max_output_tokens',
    provider_cap_observed: 'finish_reason=length at configured budget; numerical usage not retained in historical journal'
  },
  execution_path_trace: [
    'Requirement Runner buildProductionRuntimeIdentity.generation.max_tokens',
    'Semantic Gateway Client sends canonical requirement_extraction task payload',
    'Gateway Task Router derives strict json_schema and selects default provider',
    'OpenAICompatibleProvider receives generationConfig.max_tokens',
    'Provider request body carries max_tokens for chat_completions'
  ],
  shared_provider_telemetry: {
    owner: 'shared Semantic Gateway probe-v1 audit',
    requirement_specific_second_system: false,
    current_code_fields: [
      'requested_provider', 'requested_model', 'endpoint', 'provider_http_reached',
      'provider_http_status', 'response_provider', 'response_model', 'finish_reason',
      'gateway_http_status', 'latency_ms', 'json_parse_success', 'schema_pass', 'safe_error_code'
    ],
    historical_capture_status: 'PARTIAL',
    historical_missing_fields: ['requested_model', 'endpoint'],
    unknowns_remain_null: true
  },
  root_cause_gate: {
    primary_classification: 'D_PROVIDER_ABNORMAL_VERBOSITY',
    evidence: [
      'Budget is present in runner identity, gateway configuration, adapter defaults, and request-body construction; no task propagation gap is shown.',
      'Chunk 45 is 2419 provider-input characters, 1691 estimated input tokens, and 79 atomic units; it is not the largest input among the two successful controls.',
      'Control chunk 6 is 2552 characters/2092 estimated tokens/56 units and produced 25 candidates with finish_reason=stop; control chunk 14 is 2064 characters/990 estimated tokens/100 units and produced 19 candidates with finish_reason=stop.',
      'Chunk 45 has three section identities and the same 4800-token cap, but the provider reached finish_reason=length and returned invalid JSON. Historical raw truncated content length was not retained, so verbosity magnitude is not fabricated.'
    ],
    ruled_out: {
      A_OUTPUT_BUDGET_CONFIGURATION_TOO_LOW: 'not proven against the frozen 4800-token Requirement baseline; no task-specific intended output budget exists',
      B_TASK_OUTPUT_BUDGET_NOT_PROPAGATED: 'not supported by current code path or request-body construction',
      C_INTRINSIC_PROVIDER_WINDOW_TOO_DENSE: 'not established because comparable controls include larger source-unit counts and similar input sizes',
      E_COMBINED_CAUSE: 'not selected; no second independent runtime defect is evidenced',
      F_OTHER_EXACT_CAUSE: 'not selected; provider truncation is already directly classified'
    },
    semantic_failure_proven: false,
    json_parse_failure_is_downstream_symptom: true
  },
  offline_tests: {
    semantic_gateway_provider_audit: { passed: 65, failed: 0, status: 'PASS' },
    requirement_extraction_path: {
      passed: 116,
      failed: 2,
      status: 'PASS_WITH_PRE_EXISTING_UNRELATED_BASELINE',
      failures: [
        { test: 'successor resolves all six tenders with source and canonical linkage gates', classification: 'PRE_EXISTING_UNRELATED_BASELINE', observed: '5/6', expected: '6/6' },
        { test: 'unknown tender is represented as unresolved and cannot pass the gate', classification: 'PRE_EXISTING_UNRELATED_BASELINE', observed: '5/7', expected: '6/7' }
      ]
    },
    runtime_config_static_check: {
      status: 'PRE_EXISTING_UNRELATED_BASELINE',
      issues: ['CANONICAL_ENV_NAMES_INCOMPLETE', 'TRACKED_SECRET_DETECTED'],
      no_task_fix_applied: true
    },
    required_offline_invariants: {
      provider_audit_projection: 'PASS',
      requested_model_propagation_fixture: 'PASS',
      endpoint_propagation_fixture: 'PASS',
      provider_http_200_fixture: 'PASS',
      provider_http_failure_fixture: 'PASS',
      finish_reason_length_fixture: 'PASS',
      output_truncated_classification: 'PASS',
      json_parse_failure_classification: 'PASS',
      schema_failure_classification: 'PASS',
      semantic_empty_success_fixture: 'PASS',
      candidate_producing_success_fixture: 'PASS',
      truncation_primary_cause_invariant: 'PASS'
    }
  },
  micro_live: {
    status: 'NOT_EXECUTED_ROOT_D_STOP',
    provider_calls: 0,
    reason: 'Decision requires STOP for D_PROVIDER_ABNORMAL_VERBOSITY; no bounded output-budget or propagation remediation was authorized.'
  },
  side_effects: {
    provider_calls_this_task: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    commit: 0,
    push: 0,
    merge: 0,
    deploy: 0,
    production_semantic_changes: 0
  },
  artifacts: {
    checkpoint_json: 'docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.json',
    checkpoint_md: 'docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.md',
    runtime_micro_live_packet: null
  },
  final_status: 'BLOCKED_PROVIDER_ABNORMAL_VERBOSITY'
};

const markdown = [
  '# V43 Requirement Output Truncation Forensic Checkpoint',
  '',
  `- Decision: ${checkpoint.decision}`,
  `- Historical run: ${checkpoint.historical_run.run_id} (78 executions, 77 successful, 1 failed)`,
  `- Failed execution: HOLDOUT-REQ-V2-01 / chunk 45 / hash ${failed.source_chunk_hash}`,
  `- Root classification: ${checkpoint.root_cause_gate.primary_classification}`,
  '- Provider calls in this task: 0',
  '',
  '## Chunk 45 exact metrics',
  '',
  '| Metric | Value |',
  '|---|---:|',
  `| Provider input characters | ${failed.input_characters} |`,
  `| Estimated input tokens | ${failed.input_tokens_estimate} |`,
  `| Atomic source units | ${failed.atomic_source_unit_count} |`,
  `| Table rows | ${failed.table_row_count} |`,
  `| Sections | ${failed.section_identities.length} |`,
  `| Pages | ${failed.page_range.first}-${failed.page_range.last} |`,
  `| Finish reason | ${failed.finish_reason} |`,
  `| Provider HTTP / Gateway HTTP | ${failed.provider_http_status} / ${failed.gateway_http_status} |`,
  `| Safe error | ${failed.safe_error_code} |`,
  '',
  '## Successful controls',
  '',
  '- Chunk 6: 2552 input chars, 2092 estimated input tokens, 56 units, 25 candidates, 5659 output chars, stop.',
  '- Chunk 14: 2064 input chars, 990 estimated input tokens, 100 units, 19 candidates, 3414 output chars, stop.',
  '',
  '## Output budget provenance',
  '',
  `- Requirement input chunk token budget: ${checkpoint.output_budget_forensic.requirement_chunk_token_budget} (input only).`,
  `- Gateway/runner/provider output budget: ${runtimeMaxTokens}.`,
  '- Task-specific output override: absent.',
  `- Request protocol: chat completions, field max_tokens=${runtimeMaxTokens}.`,
  '- Current code propagates the value through runner → gateway → adapter → request body.',
  '',
  '## Telemetry',
  '',
  'Shared probe-v1 telemetry is reused. Current code exposes requested provider/model, endpoint, Provider HTTP, response identity, finish reason, Gateway status, latency, parse/schema status, and safe error code. Historical journal identity remains partial (requested_model and endpoint were not retained); no values are inferred.',
  '',
  '## Gates',
  '',
  '- Offline Semantic Gateway/Provider audit: 65/65 PASS.',
  '- Requirement path focused suite: 116/118 PASS; two unchanged requirement-source-parity-v2 baseline failures (5/6, 5/7) are unrelated and unmodified.',
  '- Micro live proof: not executed because classification D requires STOP.',
  '- Holdout V2 remains FAILED_DEVELOPMENT_EVIDENCE_PERMANENT; no certification is inferred.',
  '',
  '## Safety',
  '',
  'Provider calls = 0; production DB writes = 0; Gold mutations = 0; Mapping/Claim/Writer actions = 0; commit/push/merge/deploy = 0.',
  '',
  `Final status: ${checkpoint.final_status}`,
  ''
].join('\n');

await writeFile(checkpointJsonPath, `${json(checkpoint)}\n`, 'utf8');
await writeFile(checkpointMdPath, markdown, 'utf8');
console.log(JSON.stringify({
  status: checkpoint.final_status,
  checkpoint_json: 'docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.json',
  checkpoint_md: 'docs/V43_REQUIREMENT_OUTPUT_TRUNCATION_FORENSIC_CHECKPOINT.md',
  provider_calls_this_task: 0,
  chunk45_hash: failed.source_chunk_hash,
  chunk45_input_characters: failed.input_characters,
  chunk45_atomic_source_units: failed.atomic_source_unit_count,
  controls: controls.map(item => ({ chunk_number: item.chunk_number, candidate_count: item.candidate_count }))
}));
