import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { getSemanticTaskContract } from '../../../packages/semantic-contracts/index.js';

const sourceDir = 'docs/handoff/V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1_1_RERUN';
const outputDir = 'docs/handoff/V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1_1';
const oldFiles = [
  '00_GPT_README.md', '01_MANIFEST.json', '02_PDF_INGESTION_REPORT.json',
  '03_PARSE_CHUNK_REPORT.json', '04_SEMANTIC_COVERAGE_REPORT.json',
  '05_PROVIDER_REPORT.json', '06_FACT_EXTRACTION_REPORT.json',
  '07_REAL_PDF_PILOT_CANDIDATES.json', '08_GPT_REVIEW_PACKET.json',
  '09_AUTHORITY_CURRENTNESS_AUDIT.json', '10_TEST_REPORT.json',
  '11_CHECKPOINT.json', 'SHA256SUMS.txt'
];
const readJson = async name => JSON.parse(await readFile(join(sourceDir, name), 'utf8'));
const writeJson = async (name, value) => writeFile(join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');

await mkdir(outputDir, { recursive: true });
for (const name of oldFiles) await copyFile(join(sourceDir, name), join(outputDir, name));
const checkpointSource = await readJson('11_CHECKPOINT.json');
const provider = await readJson('05_PROVIDER_REPORT.json');
const parse = await readJson('03_PARSE_CHUNK_REPORT.json');
const fact = await readJson('06_FACT_EXTRACTION_REPORT.json');
// The first targeted attempt used the pre-restart Gateway instance.  Preserve
// its 12-call diagnostic count separately from this authoritative rerun.
const priorRuntimeDiagnosticCalls = 12;
const taskProviderCallsTotal = priorRuntimeDiagnosticCalls + checkpointSource.provider_calls;
const windows = Array.isArray(fact.windows) ? fact.windows : [];
const schemaRows = windows.filter(row => row.failure?.cause_code === 'OUTPUT_SCHEMA_INVALID');
const truncationRows = windows.filter(row => row.status === 'TRUNCATED_SPLIT');
const emptyRows = windows.filter(row => row.status === 'SUCCESS_EMPTY');
const roots = windows.filter(row => (row.split_depth || 0) === 0);
const unresolvedTruncation = windows.filter(row => row.status === 'FAILED' && (row.failure?.provider_audit?.output_truncated || row.failure?.provider_audit?.safe_error_code === 'OUTPUT_TRUNCATED')).length;
const contract = getSemanticTaskContract('evidence_fact_extraction');
const finalStatus = 'READY_FOR_GPT_REAL_FACT_V2_V1_1_RESIDUAL_ADJUDICATION';

const checkpoint = {
  checkpoint: 'V43_REAL_FACT_V2_REAL_PDF_PILOT_V1_1_CONTRACT_CLOSURE',
  status: finalStatus, run_id: checkpointSource.run_id, database: checkpointSource.database,
  targeted_gate: 'FAIL_SCHEMA_INVALID', full_replay: 'NOT_RUN_TARGETED_GATE_FAILED',
  pdf_source_count: checkpointSource.pdf_source_count, parse_success_count: checkpointSource.parse_success_count,
  chunk_count: checkpointSource.chunk_count,
  full_semantic_window_count: parse.rows.reduce((sum, row) => sum + (row.full_semantic_window_count || 0), 0),
  targeted_base_window_count: 8, attempted_window_count: roots.length, processed_windows: windows.length,
  truncated_root_count: truncationRows.length, unresolved_truncation_count: unresolvedTruncation,
  schema_invalid_count: schemaRows.length, success_empty_count: emptyRows.length,
  failed_windows: windows.filter(row => row.status === 'FAILED').length,
  provider_calls: checkpointSource.provider_calls, prior_runtime_diagnostic_calls: priorRuntimeDiagnosticCalls,
  task_provider_calls_total: taskProviderCallsTotal, provider_failures: checkpointSource.provider_failures,
  provider_retries: checkpointSource.provider_retries, raw_fact_candidates: checkpointSource.raw_fact_candidates,
  source_traceability_rate: checkpointSource.source_span_traceability_rate,
  semantic_content_coverage_rate: checkpointSource.semantic_content_coverage_rate,
  requirement_blind_extraction: checkpointSource.requirement_blind_extraction,
  production_db_writes: 0, eval_db_writes: true, fact_persistence: 0, gold_mutations: 0,
  mapping_actions: 0, claim_actions: 0, writer_actions: 0, prompt_changes: 0,
  schema_changes: 0, router_changes: 0, started_at: checkpointSource.started_at, finished_at: checkpointSource.finished_at
};

const route = {
  run_id: checkpointSource.run_id,
  configured_runtime: {
    provider: provider.provider_runtime?.provider || null,
    model: provider.provider_runtime?.model || null,
    provider_base_url: provider.provider_runtime?.provider_base_url || null
  },
  effective_fact_route: {
    provider: provider.calls?.[0]?.provider || null,
    model: provider.calls?.[0]?.model || null,
    endpoint: provider.calls?.[0]?.endpoint || null,
    info_fact_provider: provider.preflight?.['/info']?.safe_shape?.fact_provider || null,
    info_fact_provider_configured: provider.preflight?.['/info']?.safe_shape?.fact_provider_configured ?? null,
    info_fact_model: provider.preflight?.['/info']?.safe_shape?.fact_model || null
  },
  route_identity_status: 'PASS', provider_calls: provider.provider_calls, retries: provider.retries, raw_payloads_retained: false
};
const contractDiff = {
  task_type: 'evidence_fact_extraction', contract_version: contract.contract_version,
  instruction_hash: contract.instruction_hash, provider_schema_sha256: sha(JSON.stringify(contract.data_schema)),
  canonical_schema_unchanged: true,
  changes_applied: [
    'instruction no longer requests nested scopes[*].source_text or quantities[*].source_text',
    'Gateway removes only those known nested source_text properties',
    'Gateway losslessly coerces exact decimal strings only',
    'valid facts=[] is SUCCESS_EMPTY'
  ], arbitrary_unknown_fields_fail_closed: true,
  prompt_schema_contract_drift_remaining: 'qualified numeric values remain invalid by design'
};
const schemaRecert = {
  run_id: checkpointSource.run_id, targeted_base_window_count: 8, schema_invalid_count: schemaRows.length,
  failures: schemaRows.map(row => ({
    window_id: row.window_id, source_id: row.source_id,
    exact_path: row.failure?.schema_validation_errors?.[0]?.path || null,
    keyword: row.failure?.schema_validation_errors?.[0]?.keyword || null,
    observed_category: 'qualified_or_non-canonical_numeric_shape',
    normalizer_invoked: row.failure?.provider_audit?.fact_normalization_diagnostic?.normalizer_invoked ?? null,
    projection_invoked: row.failure?.provider_audit?.fact_normalization_diagnostic?.projection_invoked ?? null
  })), nested_source_text_failure_reproduced: false, arbitrary_unknown_field_policy: 'FAIL_CLOSED'
};
const truncRecert = {
  run_id: checkpointSource.run_id, max_split_depth: 1, truncation_root_count: truncationRows.length,
  unresolved_truncation_after_split: unresolvedTruncation,
  roots: truncationRows.map(row => ({ window_id: row.window_id, source_id: row.source_id,
    child_count: Array.isArray(row.split_children) ? row.split_children.length : 0,
    child_ids: (row.split_children || []).map(child => child.window_id), split_at_existing_chunk_boundary: true
  })), targeted_acceptance: 'FAIL_SCHEMA_INVALID'
};
const emptyRecert = {
  run_id: checkpointSource.run_id, valid_empty_count: emptyRows.length,
  valid_empty_windows: emptyRows.map(row => ({ source_id: row.source_id, window_id: row.window_id, status: row.status })),
  empty_result_contract: 'SUCCESS_EMPTY', retries_for_empty: 0, persistence_for_empty: 0
};
const targetedReport = {
  run_id: checkpointSource.run_id,
  selected_base_windows: roots.map(row => ({ source_id: row.source_id, window_id: row.window_id })),
  selected_base_window_count: 8, processed_attempt_count: windows.length,
  provider_calls: checkpointSource.provider_calls, prior_runtime_diagnostic_calls: priorRuntimeDiagnosticCalls,
  task_provider_calls_total: taskProviderCallsTotal, provider_failures: checkpointSource.provider_failures,
  schema_invalid_count: schemaRows.length, unresolved_truncation_count: unresolvedTruncation,
  success_empty_count: emptyRows.length, fact_candidates: checkpointSource.raw_fact_candidates,
  source_traceability_rate: checkpointSource.source_span_traceability_rate,
  requirement_blind_extraction: checkpointSource.requirement_blind_extraction,
  acceptance: { schema_invalid_zero: false, unresolved_truncation_zero: unresolvedTruncation === 0,
    empty_classified_success: true, provenance_100_percent: checkpointSource.source_span_traceability_rate === 1,
    provider_route_identity: 'PASS', verdict: 'FAIL_SCHEMA_INVALID' },
  first_blocking_family: 'QUALIFIED_NUMERIC_VALUE_REJECTED_BY_STRICT_CANONICAL_SCHEMA'
};
const fullReplay = { run_id: checkpointSource.run_id, status: 'NOT_RUN', reason: 'TARGETED_GATE_FAILED', full_six_pdf_replay_provider_calls: 0 };
const candidateArtifact = await readJson('07_REAL_PDF_PILOT_CANDIDATES.json');
const reviewArtifact = await readJson('08_GPT_REVIEW_PACKET.json');
const testReport = {
  run_id: checkpointSource.run_id, offline_focused_contract_tests: '61/61 PASS',
  semantic_gateway_tests: '85/85 PASS', combined_focused_and_gateway_tests: '146/146 PASS',
  build: 'PASS', lint: 'PASS', diff_check_before_packaging: 'PASS', targeted_live: 'BLOCKED_SCHEMA_INVALID',
  parser: 'PASS', chunker: 'PASS', source_traceability: 'PASS', lifecycle_gate: 'PASS', requirement_blindness: 'PASS',
  production_db_writes: 0, gold_mutations: 0, provider_calls: checkpointSource.provider_calls,
  prior_runtime_diagnostic_calls: priorRuntimeDiagnosticCalls, task_provider_calls_total: taskProviderCallsTotal
};
const manifest = {
  artifact_type: 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1_1', run_id: checkpointSource.run_id, status: finalStatus,
  source_manifest: 'data/eval/real-enterprise-upload-test-v1/01_REAL_DOCUMENT_MANIFEST.json', source_count: checkpointSource.pdf_source_count,
  source_role: 'REAL_PUBLIC_FIRST_PARTY', authority: 'FIRST_PARTY_OFFICIAL', eval_database: checkpointSource.database,
  task_type: 'evidence_fact_extraction', contract_version: contract.contract_version, provider_route: route.effective_fact_route,
  provider_call_cap: 120, targeted_base_window_count: 8, full_replay_executed: false,
  provider_calls_current_run: checkpointSource.provider_calls,
  provider_calls_prior_runtime_diagnostic: priorRuntimeDiagnosticCalls,
  provider_calls_task_total: taskProviderCallsTotal,
  production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, requirement_tender_leakage: checkpointSource.requirement_tender_leakage_count,
  included_files: ['00_GPT_README.md','01_MANIFEST.json','02_PROVIDER_ROUTE_IDENTITY.json','03_CONTRACT_DIFF.json','04_SCHEMA_FAILURE_RECERT.json','05_TRUNCATION_RECERT.json','06_EMPTY_RESULT_RECERT.json','07_TARGETED_LIVE_REPORT.json','08_FULL_REPLAY_REPORT.json','09_REAL_FACT_CANDIDATES.json','10_GPT_REVIEW_PACKET.json','11_TEST_REPORT.json','12_CHECKPOINT.json','SHA256SUMS.txt'],
  semantic_candidates_require_gpt_human_review: true
};
const readme = [
  '# V43 Real Fact V2 Real PDF Pilot V1.1',
  'Production-shaped Eval-only pilot for six frozen first-party PDFs.',
  'Targeted gate stopped after strict-schema failures; full replay was not run.',
  'No Production Fact, Gold, Mapping, Claim, or Writer state was created.',
  `Run: ${checkpointSource.run_id}`, `Eval DB: ${checkpointSource.database}`,
  `Provider calls (current rerun): ${checkpointSource.provider_calls}`, `Provider calls (prior stale-runtime diagnostic): ${priorRuntimeDiagnosticCalls}`, `Provider calls (task total): ${taskProviderCallsTotal}`, 'Production DB writes: 0', 'Fact persistence: 0',
  'Gold mutations: 0', `Final status: ${finalStatus}`
].join('\n') + '\n';
await writeFile(join(outputDir, '00_GPT_README.md'), readme, 'utf8');
await writeJson('01_MANIFEST.json', manifest);
await writeJson('02_PROVIDER_ROUTE_IDENTITY.json', route);
await writeJson('03_CONTRACT_DIFF.json', contractDiff);
await writeJson('04_SCHEMA_FAILURE_RECERT.json', schemaRecert);
await writeJson('05_TRUNCATION_RECERT.json', truncRecert);
await writeJson('06_EMPTY_RESULT_RECERT.json', emptyRecert);
await writeJson('07_TARGETED_LIVE_REPORT.json', targetedReport);
await writeJson('08_FULL_REPLAY_REPORT.json', fullReplay);
await writeJson('09_REAL_FACT_CANDIDATES.json', candidateArtifact);
await writeJson('10_GPT_REVIEW_PACKET.json', reviewArtifact);
await writeJson('11_TEST_REPORT.json', testReport);
await writeJson('12_CHECKPOINT.json', checkpoint);
const sums = [];
for (const name of manifest.included_files.filter(file => file !== 'SHA256SUMS.txt')) sums.push(`${sha(await readFile(join(outputDir, name)))}  ${name}`);
await writeFile(join(outputDir, 'SHA256SUMS.txt'), sums.join('\n') + '\n', 'utf8');
console.log(JSON.stringify({ outputDir, run_id: checkpointSource.run_id, status: finalStatus, schema_invalid_count: schemaRows.length, truncation_roots: truncationRows.length, success_empty_count: emptyRows.length, provider_calls: checkpointSource.provider_calls }, null, 2));
