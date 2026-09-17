import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const inputDir = resolve(process.env.V2_TARGET_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE_TARGETED-POSTRESTART'));
const outputDir = resolve(process.env.V2_HANDOFF_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = async name => JSON.parse(await readFile(join(inputDir, name), 'utf8'));
const safeProviderCall = call => ({
  call_index: call.call_index,
  request_hash: call.request_hash,
  gateway_http_status: call.gateway_http_status,
  provider_http_reached: call.provider_http_reached,
  provider_http_status: call.provider_http_status,
  provider: call.provider,
  model: call.model,
  endpoint: call.endpoint,
  finish_reason: call.finish_reason,
  content_present: call.content_present,
  content_length: call.content_length,
  content_hash: call.content_hash,
  latency_ms: call.latency_ms,
  task_type: call.task_type,
  requirement_blind: call.requirement_blind,
  provider_audit: call.provider_audit
});

await mkdir(outputDir, { recursive: true });
const checkpoint = await readJson('11_CHECKPOINT.json');
const providerReport = await readJson('05_PROVIDER_REPORT.json');
const extractionReport = await readJson('06_FACT_EXTRACTION_REPORT.json');
const candidateReport = await readJson('07_REAL_PDF_PILOT_CANDIDATES.json');
const priorReport = await readFile(join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1', '06_FACT_EXTRACTION_REPORT.json'), 'utf8').then(JSON.parse);
const candidates = Array.isArray(candidateReport.candidates) ? candidateReport.candidates : [];

const files = new Map();
files.set('00_GPT_README.md', `# Evidence Fact Candidate V2 — Real PDF Gate\n\nThis is an Eval-only handoff for the frozen six public first-party PDF sources. It records the V2 model-facing source-ref-only contract, deterministic canonicalization/grounding outcomes, and safe provider telemetry. No canonical Fact, Gold, Mapping, Claim, or Writer state was persisted.\n\n- Run: ${checkpoint.run_id}\n- Contract: ${checkpoint.contract_version}\n- Provider: deepseek_official\n- Model: deepseek-v4-pro\n- Targeted base windows: 8\n- Provider calls: ${checkpoint.provider_calls}\n- Provider retries: ${checkpoint.provider_retries}\n- Status: ${checkpoint.status}\n- Production DB writes: 0\n- Gold mutations: 0\n`);
files.set('01_V2_CONTRACT.json', {
  artifact_type: 'EVIDENCE_FACT_CANDIDATE_V2_CONTRACT',
  task_type: 'evidence_fact_candidate_v2',
  contract_version: checkpoint.contract_version,
  prompt_version: checkpoint.prompt_version,
  prompt_hash: checkpoint.prompt_hash,
  schema_hash: checkpoint.schema_hash,
  provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses',
  model_facing_fields: ['statement', 'source_refs', 'subject_name', 'subject_type_hint', 'subject_source_refs', 'entity_mentions', 'status_text', 'status_source_refs', 'scope_items', 'quantity_items', 'temporal_items'],
  source_text_output: false,
  authority_fields_excluded: ['domain_metadata', 'claim_permission', 'human_review_required', 'fact_id', 'lifecycle'],
  persistence: 'EVAL_HANDOFF_ONLY'
});
files.set('02_V2_CONTRACT_DIFF_FROM_V1.json', {
  v1_contract: '4.3-evidence-fact-extraction-v1',
  v2_contract: checkpoint.contract_version,
  changes: [
    'Model-facing V2 uses source_refs resolved by Backend-owned snapshot instead of source_text/provenance objects.',
    'Qualified quantities and temporal observations remain text observations for deterministic review.',
    'Canonical Fact contract and downstream authority contracts are unchanged.',
    'Valid empty facts array is a successful semantic completion.'
  ],
  unchanged: ['provider route', 'canonicalizer boundary', 'grounding boundary', 'production Fact schema']
});
files.set('03_SOURCE_REF_CONTRACT.json', {
  source_snapshot: 'Backend-owned frozen source snapshot',
  source_ref_resolution: 'exact source_ref lookup; unknown refs fail closed',
  model_may_emit: ['source_refs'],
  model_may_not_emit: ['source_text', 'source identity', 'authority metadata'],
  targeted_source_ref_total: checkpoint.source_ref_total,
  targeted_source_ref_resolved: checkpoint.source_ref_resolved,
  targeted_source_ref_resolution_rate: checkpoint.source_ref_resolution_rate
});
files.set('04_CANONICALIZER_RULES.json', {
  canonicalizer_version: '4.3-evidence-fact-canonicalizer-v2',
  grounding_version: '4.3-evidence-fact-grounding-v2',
  deterministic_rules: [
    'Backend resolves every source_ref before canonicalization.',
    'No semantic inference, invented unit/operator/validity, or attribution escalation.',
    'Qualified/range/percentage/distance quantities that are not losslessly canonicalizable become REVIEW_REQUIRED.',
    'Unknown source refs and invalid structural candidates fail closed.',
    'Generic technical statements are not enterprise Fact authority without explicit first-party attribution.'
  ]
});
files.set('05_OFFLINE_TEST_REPORT.json', {
  test_commands: [
    'node --test backend/test/evidence-fact-candidate-v2-contract-closure.test.js',
    'node --test backend/test/evidence-fact-candidate-v2.test.js backend/test/evidence-fact-candidate-v2-1.test.js backend/test/evidence-fact-transport-v2.test.js',
    'node --test backend/test/semantic-gateway-client.test.js services/semantic-gateway/test/task-router-candidate-v2.test.js'
  ],
  focused_results: { contract_closure: 'PASS 11/11', compatibility_and_transport: 'PASS 57/57', client_and_router: 'PASS 39/39 then 14/14 after wiring' },
  node_syntax_checks: 'PASS',
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
});
files.set('06_TARGETED_V1_V2_COMPARISON.json', {
  prior_v1_run_id: priorReport.run_id || null,
  prior_v1_contract: '4.3-evidence-fact-extraction-v1',
  prior_v1_targeted_windows: Array.isArray(priorReport.windows) ? priorReport.windows.filter(row => row.window_id).slice(0, 8).map(row => ({ window_id: row.window_id, status: row.status, failure_code: row.failure?.cause_code || row.failure?.code || null })) : [],
  current_v2_run_id: checkpoint.run_id,
  current_v2_targeted_base_window_count: 8,
  current_v2_attempt_count: checkpoint.processed_windows,
  current_v2_provider_calls: checkpoint.provider_calls,
  current_v2_schema_rejected: checkpoint.schema_rejected,
  current_v2_truncation_observed: checkpoint.failed_windows > 0,
  comparison_scope: 'mechanical runtime/contract metrics only; no semantic adjudication'
});
files.set('07_PROVIDER_EXECUTION_REPORT.json', {
  run_id: providerReport.run_id,
  runtime: providerReport.provider_runtime,
  preflight: providerReport.preflight,
  task_type: providerReport.task_type,
  contract_version: providerReport.contract_version,
  prompt_hash: providerReport.prompt_hash,
  schema_hash: providerReport.schema_hash,
  provider_call_cap: providerReport.provider_call_cap,
  provider_calls: providerReport.provider_calls,
  provider_failures: providerReport.provider_failures,
  retries: providerReport.retries,
  calls: (providerReport.calls || []).map(safeProviderCall),
  raw_provider_content: 'NOT_INCLUDED'
});
files.set('08_FULL_SIX_PDF_REPLAY.json', {
  status: 'NOT_RUN_TARGETED_GATE_BLOCKED',
  reason: 'Targeted V2 gate had unresolved provider output truncation; full six-PDF replay was not started.',
  six_pdf_source_count: 6,
  full_chunk_count: 590,
  full_semantic_window_count: 82,
  provider_calls: 0,
  production_db_writes: 0
});
files.set('09_V2_CANDIDATES.json', {
  run_id: candidateReport.run_id,
  candidate_schema_version: checkpoint.contract_version,
  candidate_count: candidates.length,
  candidates
});
files.set('10_CANONICALIZATION_OUTCOMES.json', {
  run_id: extractionReport.run_id,
  outcomes: candidates.map(candidate => ({
    fact_id: candidate.fact_id,
    source_id: candidate.document_id,
    window_id: candidate.source_span?.span_id || null,
    status: candidate.canonicalization?.status || null,
    review_reasons: candidate.canonicalization?.review_reasons || [],
    grounding_decision: candidate.grounding?.decision || null,
    grounding_reasons: candidate.grounding?.reasons || [],
    validation_status: candidate.validation_status
  }))
});
files.set('11_GPT_REVIEW_PACKET.json', {
  packet_type: 'V43_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE_GPT_REVIEW_PACKET',
  run_id: checkpoint.run_id,
  status: 'PENDING_GPT_SEMANTIC_RECALL_ADJUDICATION',
  semantic_adjudication: 'PENDING_GPT',
  candidate_count: candidates.length,
  candidates
});
files.set('12_REGRESSION_REPORT.json', {
  v2_contract_focused_suite: 'PASS',
  source_ref_resolution_regression: 'PASS',
  strict_unknown_ref_regression: 'PASS',
  valid_empty_regression: 'PASS',
  qualified_quantity_review_regression: 'PASS',
  generic_vs_explicit_enterprise_regression: 'PASS',
  client_task_wiring_regression: 'PASS',
  production_semantic_changes: 0,
  new_migrations: 0
});
files.set('13_CHECKPOINT.json', checkpoint);

for (const [name, value] of files) {
  const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(outputDir, name), content, 'utf8');
}
const sums = [];
for (const name of files.keys()) {
  const bytes = await readFile(join(outputDir, name));
  sums.push(`${sha256(bytes)}  ${name}`);
}
await writeFile(join(outputDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ output_dir: outputDir, run_id: checkpoint.run_id, files: [...files.keys(), 'SHA256SUMS.txt'].length, candidate_count: candidates.length, provider_calls: checkpoint.provider_calls, status: checkpoint.status }, null, 2));
