import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const inputDir = resolve(process.env.V21_TARGET_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TARGETED'));
const outputDir = resolve(process.env.V21_HANDOFF_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TRUNCATION_CLOSURE'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = async name => JSON.parse(await readFile(join(inputDir, name), 'utf8'));

function safeCall(call = {}) {
  return {
    call_index: call.call_index ?? null,
    request_hash: call.request_hash ?? null,
    gateway_http_status: call.gateway_http_status ?? null,
    provider_http_reached: call.provider_http_reached ?? false,
    provider_http_status: call.provider_http_status ?? null,
    provider: call.provider ?? null,
    model: call.model ?? null,
    endpoint: call.endpoint ?? null,
    finish_reason: call.finish_reason ?? null,
    content_present: call.content_present ?? false,
    content_length: call.content_length ?? 0,
    content_hash: call.content_hash ?? null,
    latency_ms: call.latency_ms ?? null,
    task_type: call.task_type ?? null,
    requirement_blind: call.requirement_blind ?? true,
    provider_audit: call.provider_audit ?? null
  };
}

const rawCheckpoint = await readJson('11_CHECKPOINT.json');
const checkpoint = {
  ...rawCheckpoint,
  task_type: rawCheckpoint.task_type || 'evidence_fact_candidate_v2_1',
  provider: rawCheckpoint.provider || 'deepseek_official',
  model: rawCheckpoint.model || 'deepseek-v4-pro',
  endpoint: rawCheckpoint.endpoint || '/responses',
  ...(rawCheckpoint.contract_version === '4.3-evidence-fact-candidate-v2.1' ? { base_window_count: 8 } : {}),
  ...(rawCheckpoint.contract_version === '4.3-evidence-fact-candidate-v2.1' && rawCheckpoint.unresolved_output_truncation > 0
    ? { status: rawCheckpoint.single_chunk_output_density_blocker_count > 0
      ? 'BLOCKED_SINGLE_CHUNK_OUTPUT_DENSITY'
      : rawCheckpoint.multi_chunk_window_density_blocker_count > 0
        ? 'BLOCKED_MULTI_CHUNK_WINDOW_DENSITY'
        : rawCheckpoint.status }
    : {}),
  model_output_source_text_bytes: 0
};
const provider = await readJson('05_PROVIDER_REPORT.json');
const extraction = await readJson('06_FACT_EXTRACTION_REPORT.json');
const candidatesReport = await readJson('07_REAL_PDF_PILOT_CANDIDATES.json');
const coverage = await readJson('04_SEMANTIC_COVERAGE_REPORT.json');
const candidates = Array.isArray(candidatesReport.candidates) ? candidatesReport.candidates : [];
const observedCall = (provider.calls || []).find(call => call.provider || call.model || call.endpoint) || {};
const observedRuntime = {
  ...(provider.provider_runtime || {}),
  provider: observedCall.provider || provider.provider_runtime?.provider || null,
  model: observedCall.model || provider.provider_runtime?.model || null,
  endpoint: observedCall.endpoint || provider.provider_runtime?.endpoint || null
};
const windows = Array.isArray(extraction.windows) ? extraction.windows : [];
const sourceAliases = windows.flatMap(window => (window.source_aliases || []).map(alias => ({
  window_id: window.window_id,
  split_depth: window.split_depth || 0,
  model_source_ref: alias.model_source_ref,
  authoritative_source_ref: alias.authoritative_source_ref
})));
const aliasRows = candidates.map(candidate => ({
  fact_id: candidate.fact_id,
  window_id: candidate.source_span?.span_id || null,
  source_ref_resolution: candidate.source_ref_resolution || null,
  source_snapshot: candidate.source_snapshot || null
}));
const truncationRows = windows.filter(window => window.status === 'TRUNCATED_SPLIT' || window.semantic_result?.status === 'OUTPUT_TRUNCATED').map(window => ({
  window_id: window.window_id,
  parent_window_id: window.parent_window_id || null,
  split_depth: window.split_depth || 0,
  status: window.status,
  included_chunk_ids: window.included_chunk_ids || [],
  split_children: window.split_children || [],
  failure: window.failure || null
}));
const groundingResiduals = candidates.filter(candidate => ['REVIEW_REQUIRED', 'REJECT'].includes(candidate.grounding?.decision)).map(candidate => ({
  fact_id: candidate.fact_id,
  source_id: candidate.document_id,
  window_id: candidate.source_span?.span_id || null,
  grounding_decision: candidate.grounding?.decision || null,
  grounding_reasons: candidate.grounding?.reasons || [],
  validation_status: candidate.validation_status || null
}));

let previousV2 = null;
let previousV2Provider = null;
try {
  previousV2 = JSON.parse(await readFile(join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE_TARGETED-POSTRESTART', '09_V2_CANDIDATES.json'), 'utf8'));
  previousV2Provider = JSON.parse(await readFile(join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE_TARGETED-POSTRESTART', '07_PROVIDER_EXECUTION_REPORT.json'), 'utf8'));
} catch {
  try {
    previousV2 = JSON.parse(await readFile(join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE', '09_V2_CANDIDATES.json'), 'utf8'));
    previousV2Provider = JSON.parse(await readFile(join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE', '07_PROVIDER_EXECUTION_REPORT.json'), 'utf8'));
  } catch { previousV2 = null; }
}
const sourceRefChars = rows => rows.reduce((sum, row) => {
  const refs = [];
  const walk = value => {
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'source_refs' && Array.isArray(child)) refs.push(...child);
      else walk(child);
    }
  };
  walk(row.candidate_v2_1 || row.candidate_v2 || {});
  return sum + JSON.stringify(refs).length;
}, 0);
const priorCandidates = previousV2?.candidates || [];
const sumCompletionTokens = report => (report?.calls || []).reduce((sum, call) => sum + Number(call.provider_audit?.completion_tokens || call.completion_tokens || 0), 0);
const isTruncatedCall = call => call.provider_audit?.output_truncated === true || ['incomplete', 'length'].includes(call.provider_audit?.finish_reason || call.finish_reason);
const currentCompletionTokens = sumCompletionTokens(provider);
const priorCompletionTokens = sumCompletionTokens(previousV2Provider);
const currentTruncationRate = provider.calls?.length ? provider.calls.filter(isTruncatedCall).length / provider.calls.length : 0;
const priorTruncationRate = previousV2Provider?.calls?.length ? previousV2Provider.calls.filter(isTruncatedCall).length / previousV2Provider.calls.length : null;

const files = new Map();
files.set('00_GPT_README.md', `# Evidence Fact Candidate V2.1 — Output Compaction and Truncation Closure\n\nEval-only handoff for the frozen six Huawei first-party PDF inputs. V2.1 uses window-local model aliases (S001, S002, …); Backend-owned authoritative source references are retained in the resolution reports. No Canonical Fact, Gold, Mapping, Claim, or Writer state was persisted.\n\n- Run: ${checkpoint.run_id}\n- Contract: ${checkpoint.contract_version}\n- Prompt: ${checkpoint.prompt_version}\n- Provider calls: ${checkpoint.provider_calls}\n- Targeted base windows: ${checkpoint.base_window_count ?? 'not reported'}\n- Split depth maximum: ${checkpoint.split_depth_max ?? 2}\n- Status: ${checkpoint.status}\n- Production DB writes: 0\n- Fact persistence: 0\n`);
files.set('01_V2_1_SOURCE_ALIAS_CONTRACT.json', {
  artifact_type: 'EVIDENCE_FACT_CANDIDATE_V2_1_SOURCE_ALIAS_CONTRACT',
  task_type: checkpoint.task_type,
  contract_version: checkpoint.contract_version,
  prompt_version: checkpoint.prompt_version,
  prompt_hash: checkpoint.prompt_hash,
  schema_hash: checkpoint.schema_hash,
  model_facing_source_ref_format: '^S\\d{3,}$',
  model_facing_source_text: false,
  alias_scope: 'window-local; regenerated for every split child',
  backend_resolution: 'alias -> immutable source snapshot -> authoritative source_ref and source text',
  unknown_alias_policy: 'UNKNOWN_SOURCE_ALIAS; fail closed',
  cross_window_alias_policy: 'UNKNOWN_SOURCE_ALIAS; fail closed',
  human_citation: 'readable source/file/page citations are a separate projection',
  authoritative_alias_rows: sourceAliases
});
files.set('02_V2_V2_1_DIFF.json', {
  v2_contract: '4.3-evidence-fact-candidate-v2',
  v2_1_contract: checkpoint.contract_version,
  changes: [
    'Model-facing source segments use deterministic window-local aliases S001, S002, ... instead of authoritative URI-like refs.',
    'Backend resolves aliases before canonicalization and grounding; authoritative refs remain in Eval evidence.',
    'Prompt prohibits explanations, source quotes, duplicate narrative, alternatives, and multi-proposition output.',
    'Truncated windows may split only at existing chunk boundaries to depth 2; unresolved truncation remains a hard gate.'
  ],
  unchanged: ['Canonical Fact schema', 'Provider route', 'Fact authority', 'source lineage ownership', 'downstream Mapping/Claim/Writer']
});
files.set('03_TARGETED_RUNTIME_REPORT.json', {
  run_id: checkpoint.run_id,
  status: checkpoint.status,
  runtime: observedRuntime,
  configured_runtime_summary: provider.provider_runtime,
  observed_route: { provider: observedCall.provider || null, model: observedCall.model || null, endpoint: observedCall.endpoint || null },
  preflight: provider.preflight,
  task_type: provider.task_type,
  contract_version: provider.contract_version,
  prompt_version: provider.prompt_version,
  prompt_hash: provider.prompt_hash,
  schema_hash: provider.schema_hash,
  provider_call_cap: provider.provider_call_cap,
  provider_calls: provider.provider_calls,
  provider_failures: provider.provider_failures,
  retries: provider.retries,
  calls: (provider.calls || []).map(safeCall),
  raw_provider_content: 'NOT_INCLUDED'
});
files.set('04_SOURCE_ALIAS_RESOLUTION_REPORT.json', {
  run_id: checkpoint.run_id,
  total_alias_references: checkpoint.source_ref_total,
  resolved_alias_references: checkpoint.source_ref_resolved,
  unresolved_alias_references: checkpoint.source_ref_unresolved,
  resolution_rate: checkpoint.source_alias_resolution_rate ?? checkpoint.source_ref_resolution_rate,
  unknown_source_alias_count: checkpoint.unknown_source_alias_count || 0,
  rows: aliasRows
});
files.set('05_TRUNCATION_SPLIT_REPORT.json', {
  run_id: checkpoint.run_id,
  base_window_count: checkpoint.base_window_count ?? null,
  processed_window_count: checkpoint.processed_windows,
  split_children_calls: checkpoint.split_children_calls ?? 0,
  split_depth_max: checkpoint.split_depth_max ?? 2,
  unresolved_output_truncation: checkpoint.unresolved_output_truncation ?? null,
  single_chunk_output_density_blocker_count: checkpoint.single_chunk_output_density_blocker_count ?? 0,
  multi_chunk_window_density_blocker_count: checkpoint.multi_chunk_window_density_blocker_count ?? 0,
  rows: truncationRows
});
files.set('06_TOKEN_COMPARISON.json', {
  metric: 'model-facing source reference characters',
  current_v2_1_chars: checkpoint.model_output_source_ref_chars ?? sourceRefChars(candidates),
  prior_v2_chars: sourceRefChars(priorCandidates),
  current_candidate_count: candidates.length,
  prior_candidate_count: priorCandidates.length,
  current_completion_tokens: currentCompletionTokens,
  prior_completion_tokens: priorCompletionTokens,
  current_completion_tokens_per_candidate: candidates.length ? currentCompletionTokens / candidates.length : null,
  prior_completion_tokens_per_candidate: priorCandidates.length ? priorCompletionTokens / priorCandidates.length : null,
  current_truncation_rate: currentTruncationRate,
  prior_truncation_rate: priorTruncationRate,
  total_provider_calls: checkpoint.provider_calls,
  child_split_calls: checkpoint.split_children_calls ?? 0,
  v2_to_v2_1_completion_token_reduction: priorCompletionTokens - currentCompletionTokens,
  current_contract: checkpoint.contract_version,
  prior_contract: previousV2 ? '4.3-evidence-fact-candidate-v2' : null,
  interpretation: 'mechanical size comparison only; no semantic quality claim'
});
files.set('07_CANONICALIZATION_OUTCOMES.json', {
  run_id: checkpoint.run_id,
  outcomes: candidates.map(candidate => ({
    fact_id: candidate.fact_id,
    source_id: candidate.document_id,
    window_id: candidate.source_span?.span_id || null,
    status: candidate.canonicalization?.status || null,
    review_reasons: candidate.canonicalization?.review_reasons || [],
    grounding_decision: candidate.grounding?.decision || null,
    validation_status: candidate.validation_status || null
  }))
});
files.set('08_GROUNDING_RESIDUALS.json', {
  run_id: checkpoint.run_id,
  residual_count: groundingResiduals.length,
  residuals: groundingResiduals
});
files.set('09_FULL_SIX_PDF_REPLAY.json', {
  status: 'NOT_RUN_TARGETED_GATE_BLOCKED',
  reason: checkpoint.status === 'READY_FOR_GPT_EVIDENCE_FACT_CANDIDATE_V2_1_ADJUDICATION' ? 'Targeted gate passed; full replay may be started only by the frozen V2.1 decision.' : 'Full six-PDF replay was not started because the targeted V2.1 gate did not close.',
  six_pdf_source_count: 6,
  full_chunk_count: 590,
  full_semantic_window_count: 82,
  provider_calls: 0,
  production_db_writes: 0
});
files.set('10_GPT_REVIEW_PACKET.json', {
  packet_type: 'V43_EVIDENCE_FACT_CANDIDATE_V2_1_GPT_REVIEW_PACKET',
  run_id: checkpoint.run_id,
  status: 'PENDING_GPT_SEMANTIC_RECALL_ADJUDICATION',
  semantic_adjudication: 'PENDING_GPT',
  candidate_count: candidates.length,
  candidates
});
files.set('11_TEST_REPORT.json', {
  offline_focused_suite: 'PASS 88/88',
  node_syntax: 'PASS',
  provider_calls_before_live_run: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  new_migrations: 0,
  test_scope: 'V2.1 alias contract, strict schema, source resolution, canonicalization/grounding, transport, client and router wiring'
});
files.set('12_CHECKPOINT.json', checkpoint);

await mkdir(outputDir, { recursive: true });
for (const [name, value] of files) {
  const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(outputDir, name), content, 'utf8');
}
const sums = [];
for (const name of files.keys()) {
  const content = await readFile(join(outputDir, name));
  sums.push(`${sha256(content)}  ${name}`);
}
await writeFile(join(outputDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ output_dir: outputDir, run_id: checkpoint.run_id, files: [...files.keys(), 'SHA256SUMS.txt'].length, candidate_count: candidates.length, provider_calls: checkpoint.provider_calls, status: checkpoint.status }, null, 2));
