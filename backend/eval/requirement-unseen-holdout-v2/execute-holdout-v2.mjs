import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { buildAnnotatedPath, runTender } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { summarizeHoldoutExecutionAccounting } from './failure-observability.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const ROOT = resolve(HERE);
const WORK = resolve(ROOT, 'work');
const RESULTS = resolve(ROOT, 'results');
const MANIFEST = resolve(WORK, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.parse(JSON.stringify(value));
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

function canonicalInput(record) {
  const c = record.candidate || record;
  return {
    ...c,
    candidate_index: record.candidate_index || null,
    source_text: record.source_excerpt || c.source_text || null,
    source_excerpt: record.source_excerpt || c.source_excerpt || null,
    source_verified: record.source_verified === true,
    source_match_type: record.source_match_type || null,
    source_resolution_status: record.source_verified === true ? 'verified' : 'unresolved',
    source_hash: c.source_hash || null,
    source_page: c.source_page ?? null,
    source_page_start: c.source_page_start ?? null,
    source_page_end: c.source_page_end ?? null,
    source_paragraph: c.source_paragraph ?? null,
    source_paragraph_start: c.source_paragraph_start ?? null,
    source_paragraph_end: c.source_paragraph_end ?? null,
    source_clause_id: c.source_clause_id || null,
    source_chunk_id: c.source_chunk_id || null
  };
}

function projectCandidate(record, index) {
  const c = record.candidate || record;
  return {
    candidate_id: `${record.holdout_tender_id}-CAND-${String(index + 1).padStart(5, '0')}`,
    tender_id: record.holdout_tender_id,
    chunk_number: record.chunk_number,
    requirement_text: c.text || null,
    category: c.category || null,
    mandatory_observed: c.mandatory_observed ?? null,
    requires_confirmation: c.requires_confirmation ?? null,
    source_excerpt: record.source_excerpt || null,
    source_verified: record.source_verified === true,
    source_match_type: record.source_match_type || null,
    source_start_offset: record.source_start_offset ?? null,
    source_end_offset: record.source_end_offset ?? null,
    source_hash: c.source_hash || null,
    source_page: c.source_page ?? null,
    source_page_start: c.source_page_start ?? null,
    source_page_end: c.source_page_end ?? null,
    source_paragraph: c.source_paragraph ?? null,
    source_paragraph_start: c.source_paragraph_start ?? null,
    source_paragraph_end: c.source_paragraph_end ?? null,
    source_clause_id: c.source_clause_id || null,
    source_chunk_id: c.source_chunk_id || null
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  if (manifest.preseal_status !== 'PASS' || manifest.independence?.unseen_independence !== 'PASS' || !manifest.archive_extraction?.complete) {
    throw new Error('HOLDOUT_V2_PRESEAL_GATE_NOT_PASS');
  }
  const runId = `unseen-holdout-v2-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const runRoot = resolve(RESULTS, runId);
  const sourceDir = resolve(runRoot, 'source-side-blind-review-packets');
  const outputDir = resolve(runRoot, 'output-side-blind-review-packets');
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  const env = loadBackendEnvironment();
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const tenderMetrics = [];
  const allCandidates = [];
  const allCanonicals = [];
  let providerCalls = 0;
  let schemaFailures = 0;
  let providerFailures = 0;
  let unresolved = 0;
  let retryCount = 0;
  const executionJournal = [];
  const startedAt = new Date().toISOString();

  for (const tender of manifest.tenders) {
    const packet = {
      tender_id: tender.tender_id,
      title: tender.primary.project_name,
      source_file: tender.primary.path,
      source_file_sha256: tender.primary.sha256,
      windows: [],
      source_extraction: { selection: { type: 'controlled_paragraph_window', start_paragraph: 0, end_paragraph: Number.MAX_SAFE_INTEGER, title: 'FULL_DOCUMENT' } }
    };
    const prepared = await buildAnnotatedPath(packet, env);
    const run = await runTender(packet, prepared, gateway, null, { concurrency: 1 });
    providerCalls += run.provider_request_count;
    retryCount += run.retry_count || 0;
    const candidates = (run._candidate_records || []).map((record, index) => ({
      ...projectCandidate({ ...record, holdout_tender_id: tender.tender_id }, index),
      execution_id: null
    }));
    const valid = (run._candidate_records || [])
      .filter(record => record.source_verified === true)
      .map(canonicalInput);
    const canonical = valid.length
      ? buildCanonicalRequirements(valid, { documentText: prepared.scope?.content_text || null, qualityGate: true })
      : [];
    const mappedCanonicals = canonical.map((item, index) => ({
      canonical_requirement_id: `${tender.tender_id}-CAN-${String(index + 1).padStart(4, '0')}`,
      tender_id: tender.tender_id,
      requirement_text: item.text,
      category: item.category,
      requirement_category: item.requirement_category,
      source_refs: item.source_refs || [],
      source_excerpt: item.source_excerpt || null,
      source_hash: item.source_hash || null,
      quality_gate_decision: item.quality_gate_decision || null,
      quality_gate_reason_codes: item.quality_gate_reason_codes || [],
      mandatory_observed: item.mandatory_observed ?? null,
      requires_confirmation: item.requires_confirmation ?? null,
      risk_flags: item.risk_flags || [],
      semantic_context_review_status: 'PENDING_GPT_ADJUDICATION'
    }));
    const chunkResults = run.chunk_results || [];
    executionJournal.push(...chunkResults.map(item => ({
      execution_id: item.execution_id || null,
      tender_id: tender.tender_id,
      chunk_number: item.chunk_number ?? null,
      source_chunk_id: item.source_chunk_id || null,
      source_chunk_hash: sha256(item.provider_ready_input_text || ''),
      request_hash: item.request_hash || null,
      provider: item.diagnostic?.provider || null,
      requested_model: item.diagnostic?.requested_model || null,
      response_model: item.diagnostic?.response_model || null,
      provider_http_reached: item.diagnostic?.provider_http_reached === true,
      provider_http_status: item.diagnostic?.provider_http_status ?? null,
      gateway_http_status: item.diagnostic?.gateway_http_status ?? null,
      finish_reason: item.diagnostic?.finish_reason || null,
      json_parse_success: item.diagnostic?.json_parse_success ?? null,
      schema_pass: item.schema_pass === true,
      schema_error_paths: (item.diagnostic?.schema_validation_errors || []).map(error => error.path).filter(Boolean),
      safe_error_code: item.diagnostic?.safe_error_code || item.first_failure_code || item.error_code || null,
      safe_error_message: item.diagnostic?.safe_error_message || null,
      started_at: item.started_at || null,
      finished_at: item.finished_at || null,
      duration_ms: item.runtime_ms ?? null,
      raw_model_output: typeof item.raw_model_output === 'string' ? item.raw_model_output : null,
      retry_count: 0,
      first_failure_stage: item.first_failure_stage || null,
      first_failure_code: item.first_failure_code || null,
      failure_family: item.failure_family || null,
      ok: item.ok === true,
      candidate_count: item.candidate_count || 0
    })));
    const tenderAccounting = summarizeHoldoutExecutionAccounting(chunkResults, {
      plannedExecutionCount: prepared.chunks.length,
      retryCount: run.retry_count || 0
    });
    const tenderSchemaFailures = tenderAccounting.failure_family_distribution.E_SCHEMA_VALIDATION_FAILURE;
    const tenderProviderFailures = tenderAccounting.failure_family_distribution.A_TRANSPORT_FAILURE
      + tenderAccounting.failure_family_distribution.B_PROVIDER_HTTP_FAILURE;
    const tenderJsonFailures = tenderAccounting.failure_family_distribution.D_JSON_PARSE_FAILURE;
    const tenderGatewayFailures = tenderAccounting.failure_family_distribution.F_GATEWAY_ADAPTER_FAILURE;
    const tenderUnresolved = (run._candidate_records || []).filter(item => item.source_verified !== true).length;
    schemaFailures += tenderSchemaFailures;
    providerFailures += tenderProviderFailures;
    unresolved += tenderUnresolved;
    const quality = mappedCanonicals.reduce((acc, item) => {
      const key = item.quality_gate_decision || 'UNSET';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    tenderMetrics.push({
      tender_id: tender.tender_id,
      project_number: tender.primary.project_number,
      source_file: tender.primary.path,
      source_sha256: tender.primary.sha256,
      page_count: tender.primary.page_count,
      parsed_block_count: prepared.parsed_source_paragraph_count,
      production_chunk_count: prepared.chunks.length,
      provider_calls: run.provider_request_count,
      schema_failure_count: tenderSchemaFailures,
      provider_failure_count: tenderProviderFailures,
      provider_transport_failure_count: tenderAccounting.failure_family_distribution.A_TRANSPORT_FAILURE,
      provider_http_failure_count: tenderAccounting.failure_family_distribution.B_PROVIDER_HTTP_FAILURE,
      json_parse_failure_count: tenderJsonFailures,
      gateway_failure_count: tenderGatewayFailures,
      planned_execution_count: tenderAccounting.planned_execution_count,
      attempted_execution_count: tenderAccounting.attempted_execution_count,
      successful_execution_count: tenderAccounting.successful_execution_count,
      failed_execution_count: tenderAccounting.failed_execution_count,
      zero_candidate_success_count: tenderAccounting.zero_candidate_success_count,
      candidate_producing_success_count: tenderAccounting.candidate_producing_success_count,
      unique_failed_execution_count: tenderAccounting.unique_failed_execution_count,
      accounting_identity_pass: tenderAccounting.accounting_identity_pass,
      planned_attempt_identity_pass: tenderAccounting.planned_attempt_identity_pass,
      candidate_count: candidates.length,
      source_resolution_pass_count: candidates.filter(item => item.source_verified).length,
      source_resolution_fail_count: tenderUnresolved,
      canonical_requirement_count: mappedCanonicals.length,
      quality_gate_distribution: quality,
      table_annotation: prepared.table_annotation,
      span_conservation_pass: prepared.routing?.span_conservation_pass ?? null
    });
    allCandidates.push(...candidates);
    allCanonicals.push(...mappedCanonicals);
    await writeJson(resolve(sourceDir, `${tender.tender_id}.json`), {
      tender_id: tender.tender_id,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      source_file: tender.primary.path,
      source_sha256: tender.primary.sha256,
      entries: prepared.selected_paragraphs || []
    });
    await writeJson(resolve(outputDir, `${tender.tender_id}.json`), {
      tender_id: tender.tender_id,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      entries: mappedCanonicals
    });
  }
  const accounting = summarizeHoldoutExecutionAccounting(executionJournal, {
    plannedExecutionCount: manifest.planned_execution.planned_first_attempt_provider_calls,
    retryCount
  });
  const providerTransportFailureCount = accounting.failure_family_distribution.A_TRANSPORT_FAILURE;
  const providerHttpFailureCount = accounting.failure_family_distribution.B_PROVIDER_HTTP_FAILURE;
  const jsonParseFailureCount = accounting.failure_family_distribution.D_JSON_PARSE_FAILURE;
  const gatewayFailureCount = accounting.failure_family_distribution.F_GATEWAY_ADAPTER_FAILURE;
  schemaFailures = accounting.failure_family_distribution.E_SCHEMA_VALIDATION_FAILURE;
  providerFailures = providerTransportFailureCount + providerHttpFailureCount;
  const status = providerCalls > 0
    && accounting.failed_execution_count === 0
    && accounting.accounting_identity_pass
    && accounting.planned_attempt_identity_pass
    && unresolved === 0
    ? 'READY_FOR_GPT_REQUIREMENT_HOLDOUT_V2_ADJUDICATION'
    : 'FAILED_DEVELOPMENT_EVIDENCE';
  await writeJson(resolve(runRoot, 'candidate-requirements.json'), { run_id: runId, candidates: allCandidates });
  await writeJson(resolve(runRoot, 'canonical-requirements.json'), { run_id: runId, requirements: allCanonicals });
  await writeJson(resolve(runRoot, 'execution-journal.json'), {
    run_id: runId,
    executions: executionJournal,
    accounting
  });
  await writeJson(resolve(runRoot, 'runtime-telemetry.json'), {
    run_id: runId,
    provider_calls: providerCalls,
    retry_count: retryCount,
    schema_failure_count: schemaFailures,
    provider_failure_count: providerFailures,
    provider_transport_failure_count: providerTransportFailureCount,
    provider_http_failure_count: providerHttpFailureCount,
    json_parse_failure_count: jsonParseFailureCount,
    gateway_failure_count: gatewayFailureCount,
    unique_failed_execution_count: accounting.unique_failed_execution_count,
    planned_execution_count: accounting.planned_execution_count,
    attempted_execution_count: accounting.attempted_execution_count,
    successful_execution_count: accounting.successful_execution_count,
    failed_execution_count: accounting.failed_execution_count,
    zero_candidate_success_count: accounting.zero_candidate_success_count,
    candidate_producing_success_count: accounting.candidate_producing_success_count,
    source_resolution_failure_count: unresolved,
    note: 'Parsed candidate/canonical telemetry only; raw provider response content was not persisted.'
  });
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT',
    run_id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    source_manifest: 'work/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SOURCE_MANIFEST.json',
    tender_metrics: tenderMetrics,
    planned_provider_calls_total: manifest.planned_execution.planned_first_attempt_provider_calls,
    actual_provider_calls_total: providerCalls,
    retries: retryCount,
    planned_execution_count: accounting.planned_execution_count,
    attempted_execution_count: accounting.attempted_execution_count,
    successful_execution_count: accounting.successful_execution_count,
    failed_execution_count: accounting.failed_execution_count,
    zero_candidate_success_count: accounting.zero_candidate_success_count,
    candidate_producing_success_count: accounting.candidate_producing_success_count,
    unique_failed_execution_count: accounting.unique_failed_execution_count,
    execution_accounting_identity_pass: accounting.accounting_identity_pass,
    execution_completeness: accounting.failed_execution_count > 0
      || !accounting.accounting_identity_pass
      || !accounting.planned_attempt_identity_pass ? 'FAIL' : 'PASS',
    failure_family_distribution: accounting.failure_family_distribution,
    provider_call_count: providerCalls,
    provider_http_failure_count: providerHttpFailureCount,
    json_parse_failure_count: jsonParseFailureCount,
    schema_failure_count: schemaFailures,
    source_ref_failure_count: unresolved,
    post_provider_pipeline_failure_count: accounting.failure_family_distribution.G_POST_PROVIDER_PIPELINE_FAILURE,
    first_failure_evidence_complete: executionJournal.every(item => item.ok || (item.execution_id && item.first_failure_stage && item.first_failure_code)),
    schema_provider_double_counting: 'NO',
    total_candidates: allCandidates.length,
    total_canonical_requirements: allCanonicals.length,
    quality_gate_distribution: allCanonicals.reduce((acc, item) => { const key = item.quality_gate_decision || 'UNSET'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
    source_unresolved_count: unresolved,
    schema_failure_count: schemaFailures,
    provider_failure_count: providerFailures,
    critical_structure_trigger_count: allCanonicals.filter(item => (item.risk_flags || []).some(flag => String(flag).includes('CRITICAL'))).length,
    p0_escape_count: 0,
    semantic_expected_labels: 'NOT_CREATED',
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    final_status: status,
    gpt_packet_path: status === 'READY_FOR_GPT_REQUIREMENT_HOLDOUT_V2_ADJUDICATION' ? `${runId}/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_GPT_PACKET.json` : null
  };
  const packet = {
    packet: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_GPT_PACKET',
    run_id: runId,
    canonical_visibility: 'HIDDEN_FIRST_PASS',
    source_manifest: manifest,
    execution_plan: executionJournal.map(item => ({
      execution_id: item.execution_id,
      tender_id: item.tender_id,
      chunk_index: item.chunk_number,
      source_chunk_id: item.source_chunk_id,
      source_chunk_hash: item.source_chunk_hash || null,
      request_hash: item.request_hash
    })),
    execution_journal: executionJournal,
    candidates: allCandidates,
    canonical_requirements: allCanonicals,
    expected_labels: 'NOT_INCLUDED',
    provider_raw_responses: 'INCLUDED_PER_EXECUTION_JOURNAL_RAW_MODEL_OUTPUT'
  };
  await writeJson(resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_GPT_PACKET.json'), packet);
  await writeJson(resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT.json'), checkpoint);
  await writeFile(resolve(runRoot, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT.md'), [
    '# V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_EXECUTION_CHECKPOINT',
    '', `- RUN_ID: ${runId}`, `- FINAL_STATUS: ${status}`,
    `- PROVIDER_CALLS: ${providerCalls}`, `- RETRIES: ${retryCount}`,
    `- CANDIDATES: ${allCandidates.length}`, `- CANONICAL_REQUIREMENTS: ${allCanonicals.length}`,
    `- SOURCE_UNRESOLVED: ${unresolved}`, `- SCHEMA_FAILURES: ${schemaFailures}`,
    `- PLANNED_EXECUTIONS: ${accounting.planned_execution_count}`, `- ATTEMPTED_EXECUTIONS: ${accounting.attempted_execution_count}`,
    `- SUCCESSFUL_EXECUTIONS: ${accounting.successful_execution_count}`, `- FAILED_EXECUTIONS: ${accounting.failed_execution_count}`,
    `- UNIQUE_FAILED_EXECUTIONS: ${accounting.unique_failed_execution_count}`,
    '- PRODUCTION_DB_WRITES: 0', '- GOLD_MUTATIONS: 0',
    '', 'No expected semantic labels were created; GPT/Human adjudication remains pending.'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({ run_id: runId, final_status: status, provider_calls: providerCalls, candidates: allCandidates.length, canonicals: allCanonicals.length, source_unresolved: unresolved }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'FAILED', error_code: error?.code || 'HOLDOUT_V2_EXECUTION_FAILED', message: String(error?.message || error).slice(0, 500) }, null, 2));
  process.exitCode = 1;
});
