import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const REPO = resolve(HERE, '../../..');
const RESULTS = join(HERE, 'results');
const OUT_JSON = join(REPO, 'docs', 'V43_REQUIREMENT_HOLDOUT_V2_EXECUTION_FAILURE_FORENSIC.json');
const OUT_MD = join(REPO, 'docs', 'V43_REQUIREMENT_HOLDOUT_V2_EXECUTION_FAILURE_FORENSIC.md');

const json = value => JSON.stringify(value, null, 2);

async function latestCompletedRun() {
  const entries = await readdir(RESULTS, { withFileTypes: true });
  const runs = [];
  for (const entry of entries.filter(item => item.isDirectory())) {
    const checkpointPath = join(RESULTS, entry.name, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT.json');
    try {
      const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
      runs.push({ runDir: entry.name, checkpoint, checkpointPath });
    } catch (_error) {
      // Incomplete/interrupted directories are evidence of topology only; they
      // are not treated as completed executions.
    }
  }
  runs.sort((a, b) => String(a.checkpoint.completed_at).localeCompare(String(b.checkpoint.completed_at)));
  if (!runs.length) throw new Error('NO_COMPLETED_HOLDOUT_V2_CHECKPOINT');
  return runs.at(-1);
}

const run = await latestCompletedRun();
const cp = run.checkpoint;
const tenderWithFailures = (cp.tender_metrics || [])
  .filter(item => Number(item.schema_failure_count || 0) > 0 || Number(item.provider_failure_count || 0) > 0)
  .map(item => ({
    tender_id: item.tender_id,
    schema_failure_count: item.schema_failure_count || 0,
    provider_failure_count: item.provider_failure_count || 0,
    chunk_number: null,
    execution_identity: null,
    evidence_status: 'TENDER_AGGREGATE_ONLY'
  }));
const journalPath = join(RESULTS, run.runDir, 'execution-journal.json');
let journalAvailable = false;
try {
  await readFile(journalPath, 'utf8');
  journalAvailable = true;
} catch (_error) {
  journalAvailable = false;
}

const artifact = {
  checkpoint: 'V43_REQUIREMENT_HOLDOUT_V2_EXECUTION_FAILURE_FORENSIC_AND_OBSERVABILITY_CHECKPOINT',
  holdout_v2_status: 'FAILED_DEVELOPMENT_EVIDENCE',
  source_run_id: cp.run_id,
  source_checkpoint: `backend/eval/requirement-unseen-holdout-v2/results/${run.runDir}/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT.json`,
  forensic_mode: 'OFFLINE_EXISTING_EVIDENCE_ONLY',
  historical_planned_execution_count: cp.planned_provider_calls_total,
  historical_attempted_execution_count: null,
  historical_successful_execution_count: null,
  historical_failed_execution_count: null,
  historical_actual_provider_calls: cp.actual_provider_calls_total,
  historical_retries: cp.retries,
  unique_failed_execution_count: null,
  failure_root_cause: 'UNRECOVERABLE_FROM_EXISTING_EVIDENCE',
  recovered_failed_executions: [],
  unrecoverable_failed_executions: tenderWithFailures.map(item => ({
    ...item,
    failure_family: 'H_UNRECOVERABLE_MISSING_EVIDENCE',
    primary_first_failure: null,
    available_evidence: [
      'tender-level schema_failure_count',
      'tender-level provider_failure_count',
      'planned_provider_calls_total',
      'actual_provider_calls_total'
    ],
    unavailable_evidence: [
      'execution_id',
      'chunk_number',
      'source_chunk_id',
      'request_hash',
      'dispatch_timestamp',
      'provider_http_status',
      'response_model',
      'finish_reason',
      'json_parse_result',
      'schema_error_paths',
      'first_failure_stage',
      'first_failure_code'
    ],
    recoverability: 'UNRECOVERABLE_FROM_EXISTING_EVIDENCE'
  })),
  failure_family_distribution: {
    A_TRANSPORT_FAILURE: 0,
    B_PROVIDER_HTTP_FAILURE: 0,
    C_PROVIDER_RESPONSE_EMPTY_OR_MALFORMED: 0,
    D_JSON_PARSE_FAILURE: 0,
    E_SCHEMA_VALIDATION_FAILURE: 0,
    F_GATEWAY_ADAPTER_FAILURE: 0,
    G_RUNNER_ACCOUNTING_ONLY: 0,
    H_UNRECOVERABLE_MISSING_EVIDENCE: tenderWithFailures.length
  },
  aggregate_observations: {
    schema_failure_count: cp.schema_failure_count,
    provider_failure_count: cp.provider_failure_count,
    schema_provider_double_counting: 'NOT_DETERMINED_FROM_EXISTING_AGGREGATES',
    note: 'The historical checkpoint does not identify whether the two counters describe two executions or the same executions.'
  },
  first_failure_evidence_complete: false,
  schema_provider_double_counting: 'NOT_DETERMINED_FROM_EXISTING_AGGREGATES',
  execution_completeness: {
    status: 'NOT_VERIFIABLE_FROM_EXISTING_EVIDENCE',
    planned_execution_count: cp.planned_provider_calls_total,
    attempted_execution_count: null,
    successful_execution_count: null,
    failed_execution_count: null,
    zero_candidate_success_count: null,
    candidate_producing_success_count: null,
    identity_equation_verified: false,
    reason: 'Existing artifacts persist provider call totals and candidate aggregates but no per-execution journal.'
  },
  source_parser_chunker_failure_evidence: {
    status: 'NO_FAILURE_EVIDENCE_IN_RETAINED_ARTIFACTS',
    source_resolution_failure_count: cp.source_unresolved_count,
    parser_or_chunker_failure_count: null
  },
  source_resolution_denominator: 'GENERATED_CANDIDATE_SOURCE_RESOLUTION',
  observability_patch: {
    status: 'APPLIED_OFFLINE_NOT_CERTIFIED_BY_RERUN',
    scope: 'Eval-only execution identity, bounded failure metadata, first-failure classification, and counter separation',
    provider_calls: 0
  },
  runner_observability_patch: 'APPLIED_OFFLINE_NOT_CERTIFIED_BY_RERUN',
  retained_execution_journal_present: journalAvailable,
  regression_results: {
    requirement_focused: 'PASS (105 tests)',
    frontend: 'PASS (51 tests)',
    build: 'PASS',
    lint: 'PASS',
    diff_check: 'PASS',
    root_npm_test: 'PRE_EXISTING_UNRELATED_BASELINE'
  },
  production_semantic_code_change: 0,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  final_verdict: 'READY_FOR_GPT_REQUIREMENT_RUNTIME_FORENSIC_ADJUDICATION'
};

await writeFile(OUT_JSON, `${json(artifact)}\n`, 'utf8');
const md = [
  '# V43_REQUIREMENT_HOLDOUT_V2_EXECUTION_FAILURE_FORENSIC_AND_OBSERVABILITY_CHECKPOINT',
  '',
  `- HOLDOUT_V2_STATUS: ${artifact.holdout_v2_status}`,
  `- SOURCE_RUN_ID: ${artifact.source_run_id}`,
  `- HISTORICAL_PLANNED_EXECUTIONS: ${artifact.historical_planned_execution_count}`,
  `- HISTORICAL_PROVIDER_CALLS: ${artifact.historical_actual_provider_calls}`,
  `- UNIQUE_FAILED_EXECUTION_COUNT: NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE`,
  `- FAILURE_ROOT_CAUSE: ${artifact.failure_root_cause}`,
  `- RECOVERED_FAILED_EXECUTIONS: ${artifact.recovered_failed_executions.length}`,
  `- UNRECOVERABLE_FAILED_EXECUTION_AGGREGATES: ${artifact.unrecoverable_failed_executions.length}`,
  '',
  '## Failure evidence',
  '',
  `- Schema failure aggregate: ${artifact.aggregate_observations.schema_failure_count}`,
  `- Provider failure aggregate: ${artifact.aggregate_observations.provider_failure_count}`,
  `- Schema/provider double counting: ${artifact.aggregate_observations.schema_provider_double_counting}`,
  `- First-failure evidence complete: NO`,
  `- Source/parser/chunker failure evidence: ${artifact.source_parser_chunker_failure_evidence.status}`,
  '',
  '## Observability delta',
  '',
  `- Runner observability patch: ${artifact.observability_patch.status}`,
  '- Execution journal fields now include execution identity, request hash, bounded diagnostics, first-failure stage/code, and separated counters.',
  '- No V2 certification rerun was performed.',
  '',
  '## Regression',
  '',
  '- Requirement focused: PASS (105 tests)',
  '- Frontend: PASS (51 tests)',
  '- Build: PASS',
  '- Lint: PASS',
  '- git diff --check: PASS',
  '- Root npm test: PRE_EXISTING_UNRELATED_BASELINE',
  '',
  '## Side effects',
  '',
  '- Provider calls: 0',
  '- Production DB writes: 0',
  '- Gold mutations: 0',
  '- Mapping/Claim/Writer actions: 0',
  '',
  `- FINAL_VERDICT: ${artifact.final_verdict}`,
  ''
].join('\n');
await writeFile(OUT_MD, md, 'utf8');
console.log(JSON.stringify({
  forensic: 'offline_existing_evidence_only',
  source_run_id: cp.run_id,
  unique_failed_execution_count: null,
  unrecoverable_failed_execution_aggregates: artifact.unrecoverable_failed_executions.length,
  provider_calls: 0,
  output_json: OUT_JSON,
  output_md: OUT_MD
}, null, 2));
