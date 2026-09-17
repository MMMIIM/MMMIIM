import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import pg from 'pg';

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, 'docs', 'handoff', 'V43_OVERNIGHT_REAL_E2E_MASTER_V1');
const DB_URL = process.env.EVAL_DATABASE_URL || 'postgresql://bid_user:bid_password@127.0.0.1:5432/bid_platform_flow_audit_test';
const RUN_ID = 'V43-OVERNIGHT-REAL-E2E-CASE-01-20260914';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const writeJson = async (name, value) => writeFile(join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const now = new Date().toISOString();

await mkdir(OUT, { recursive: true });

const parseReport = await readJson(join(OUT, '04_TENDER_PARSE_REPORT.json'));
const caseManifest = await readJson(join(OUT, '02_CASE_MANIFEST.json'));
const frozenRequirementPath = join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'TB-006.production-requirements.json');
const frozenRequirement = await readJson(frozenRequirementPath);
const routerFreeze = await readJson(join(ROOT, 'docs', 'V43_RESPONSE_ROUTER_V2_2_3_FREEZE_CHECKPOINT.json'));
const routerRecert = await readJson(join(ROOT, 'docs', 'V43_RESPONSE_ROUTER_V2_2_3_EXECUTION_LAYER_RECERT.json'));
const huaweiManifest = await readJson(join(ROOT, 'data', 'eval', 'real-enterprise-upload-test-v1', '01_REAL_DOCUMENT_MANIFEST.json'));

const pool = new pg.Pool({ connectionString: DB_URL });
let materialRows = [];
let indexRows = [];
try {
  const materials = await pool.query(`
    SELECT m.id, m.project_id, m.original_name, m.file_hash, m.index_status,
           m.extraction_status, m.corpus_scope, m.authority_level, m.review_status,
           m.lifecycle_status, m.usage_status,
           COUNT(DISTINCT c.chunk_id)::int AS chunk_count,
           COUNT(DISTINCT e.embedding_id)::int AS embedding_count
    FROM company_materials m
    LEFT JOIN material_chunks c ON c.material_id = m.id
    LEFT JOIN material_chunk_embeddings e ON e.chunk_id = c.chunk_id
    WHERE m.original_name LIKE 'HW-%'
    GROUP BY m.id, m.project_id, m.original_name, m.file_hash, m.index_status,
             m.extraction_status, m.corpus_scope, m.authority_level, m.review_status,
             m.lifecycle_status, m.usage_status
    ORDER BY m.original_name`);
  materialRows = materials.rows;
  indexRows = materialRows.map((r) => ({
    material_id: r.id,
    file_name: r.original_name,
    lifecycle: r.lifecycle_status,
    extraction_status: r.extraction_status,
    chunk_count: r.chunk_count,
    embedding_count: r.embedding_count,
    index_status: r.index_status,
    authority_level: r.authority_level,
    review_status: r.review_status,
    corpus_scope: r.corpus_scope,
    usage_status: r.usage_status,
  }));
} finally {
  await pool.end();
}

const huaweiFirstSix = huaweiManifest.documents.filter((d) => /^HW-00[1-6]$/.test(d.id));
const huaweiSourceRows = huaweiFirstSix.map((d) => {
  const row = materialRows.find((m) => m.original_name === `${d.id}.pdf`);
  return {
    source_id: d.id,
    title: d.title,
    type: d.type,
    authority: d.authority,
    source_role: 'REAL_PUBLIC_FIRST_PARTY',
    project_id: row?.project_id ?? null,
    material_id: row?.id ?? null,
    source_hash: row?.file_hash ?? null,
    lifecycle_status: row?.lifecycle_status ?? null,
    extraction_status: row?.extraction_status ?? null,
    index_status: row?.index_status ?? null,
    chunk_count: row?.chunk_count ?? 0,
    embedding_count: row?.embedding_count ?? 0,
    eligible_for_retrieval: Boolean(row && row.lifecycle_status === 'ACTIVE' && row.extraction_status === 'succeeded'),
    note: 'Existing isolated Eval DB material; no production writes performed by this run.'
  };
});

await writeJson('03_FIRST_BASELINE_CHECKPOINT.json', {
  checkpoint: 'V43_OVERNIGHT_REAL_E2E_MASTER_V1_FIRST_BASELINE',
  run_id: RUN_ID,
  status: 'DEEP_SAFE_ENDPOINT_ESTABLISHED',
  phase: 'TENDER_PARSE_AND_ENTERPRISE_INGESTION_INVENTORY',
  generated_at: now,
  eval_database: { database: 'bid_platform_flow_audit_test', connectivity: 'PASS', writes: 0 },
  provider_calls: parseReport.provider_calls_before_failure,
  llm_calls: parseReport.provider_calls_before_failure,
  production_db_writes: 0,
  production_fact_persistence: 0,
  gold_mutations: 0,
  first_unresolved_blocker: {
    stage: parseReport.first_failure_stage,
    error_code: parseReport.error_code,
    classification: parseReport.classification,
  }
});

await writeJson('05_REQUIREMENT_REPORT.json', {
  report: 'TB-006 requirement production-shaped execution',
  run_id: RUN_ID,
  fresh_execution: {
    source_sha256: parseReport.source_sha256,
    parser_status: parseReport.parser_status,
    chunk_count: parseReport.chunk_count,
    chunk_coverage: parseReport.chunk_coverage,
    gateway_path: 'createRequirementExtractionGateway → Semantic Gateway',
    completed_chunks: parseReport.completed_chunks,
    failed_chunk: parseReport.failed_chunk,
    provider_calls: parseReport.provider_calls_before_failure,
    status: 'BLOCKED_FAIL_CLOSED',
    error_code: parseReport.error_code,
    first_failure_stage: parseReport.first_failure_stage,
    failure_reason: parseReport.error_message,
    semantic_contract_change: 0,
    prompt_change: 0,
    schema_change: 0
  },
  frozen_auxiliary_reference: {
    path: 'docs/eval/requirement-production-core6-20260911/TB-006.production-requirements.json',
    run_id: frozenRequirement.run_id,
    status: frozenRequirement.status,
    candidate_count: frozenRequirement.candidate_count,
    canonical_count: frozenRequirement.canonical_count,
    source_verified_count: frozenRequirement.source_verified_count,
    provider_calls_observed: frozenRequirement.provider_calls_observed,
    used_as_fresh_output: false,
    note: 'Read-only auxiliary identity only; not substituted for this run.'
  },
  authority_status: 'NO_NEW_CONFIRMED_REQUIREMENT_BASELINE_CREATED',
  production_db_writes: 0,
  gold_mutations: 0
});

await writeJson('06_ROUTER_REPORT.json', {
  router_identity: {
    version: routerFreeze.router_version,
    implementation_id: routerFreeze.implementation_id,
    implementation_path: routerFreeze.implementation_path,
    implementation_sha256: routerFreeze.implementation_sha256,
    reference_v3_sha256: routerFreeze.reference_v3_sha256,
    freeze_status: routerFreeze.status
  },
  current_case_status: 'NOT_EXECUTED_UPSTREAM_REQUIREMENT_AUTHORITY_BLOCKED',
  frozen_recert_summary: {
    recert_artifact: 'docs/V43_RESPONSE_ROUTER_V2_2_3_EXECUTION_LAYER_RECERT.json',
    canonical_input_count: routerRecert.canonical_input?.count ?? null,
    response_decision_coverage_rate: routerRecert.execution?.response_decision_coverage_rate ?? null,
    no_authority_created: routerRecert.execution?.no_authority_created ?? null
  },
  provider_calls: 0,
  production_db_writes: 0,
  note: 'Frozen Router identity preserved; no new Router evaluation was run after the upstream parse stop.'
});

await writeJson('07_ENTERPRISE_INGESTION_REPORT.json', {
  corpus_id: caseManifest.enterprise_corpus.corpus_id,
  source_role: caseManifest.enterprise_corpus.source_role,
  bidder_identity_claim: false,
  database: 'bid_platform_flow_audit_test',
  project_id: materialRows[0]?.project_id ?? null,
  source_count_expected: 6,
  source_count_present: huaweiSourceRows.length,
  sources: huaweiSourceRows,
  all_materials_active: huaweiSourceRows.every((r) => r.lifecycle_status === 'ACTIVE'),
  parse_complete: huaweiSourceRows.every((r) => r.extraction_status === 'succeeded'),
  index_complete: huaweiSourceRows.every((r) => r.index_status === 'INDEXED'),
  embedding_complete: huaweiSourceRows.every((r) => r.embedding_count > 0),
  status: 'PARTIAL_INGESTION_INDEX_NOT_EXECUTED',
  blocker: 'ENTERPRISE_INDEX_AND_EMBEDDING_NOT_EXECUTED_IN_THIS_BASELINE',
  provider_calls: 0,
  eval_db_writes: 0,
  production_db_writes: 0
});

await writeJson('08_RETRIEVAL_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_REQUIREMENT_AUTHORITY_BLOCKED',
  retrieval_service: 'backend/src/pipeline/enterprise-retrieval-service.js',
  canonical_entrypoint: 'EnterpriseRetrievalService.retrieve',
  source_materials_available: huaweiSourceRows.length,
  indexed_materials: huaweiSourceRows.filter((r) => r.index_status === 'INDEXED').length,
  retrieval_runs: 0,
  embedding_provider_calls: 0,
  reason: 'No new confirmed canonical Requirement was available after the TB-006 parse fail-closed stop; no retrieval query was issued.'
});

await writeJson('09_FACT_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_RETRIEVAL_BLOCKED',
  contract: '4.3-evidence-fact-candidate-v2.2',
  candidate_extraction_runs: 0,
  fact_candidates: 0,
  canonical_facts: 0,
  grounding_runs: 0,
  provider_calls: 0,
  persistence: 0,
  reason: 'Fact V2.2 is authorized only on retrieved contexts; retrieval was not reached.'
});

await writeJson('10_MAPPING_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_FACT_AUTHORITY_BLOCKED',
  service: 'RequirementEvidenceFactMappingService',
  canonical_mapping_writes: 0,
  mapping_evaluations: 0,
  human_approval_simulation: false,
  reason: 'No authorized Fact context was produced.'
});

await writeJson('11_SUFFICIENCY_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_MAPPING_BLOCKED',
  canonical_sufficiency_evaluations: 0,
  reason: 'Mapping stage was not reached.'
});

await writeJson('12_CLAIM_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_AUTHORITY_BLOCKED',
  claim_gate_evaluations: 0,
  claims_created: 0,
  authority_escalations: 0,
  reason: 'No Mapping/Fact authority existed for this run.'
});

await writeJson('13_WRITER_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_AUTHORITY_BLOCKED',
  writer_runs: 0,
  authorization_checks: 0,
  safe_contexts: 0,
  reason: 'Writer was not invoked because Claim authority was not available.'
});

await writeJson('14_VALIDATOR_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_WRITER_BLOCKED',
  validator_runs: 0,
  critical_assertion_escapes: 0,
  reason: 'No Writer output was produced.'
});

await writeJson('15_EXPORT_REPORT.json', {
  status: 'NOT_EXECUTED_UPSTREAM_VALIDATOR_BLOCKED',
  exports: 0,
  docx_exports: 0,
  reason: 'Export stage was not reached.'
});

await writeJson('16_LINEAGE_REPORT.json', {
  run_id: RUN_ID,
  case_id: 'REAL_E2E_CASE_01',
  tender: {
    tender_id: 'TB-006',
    source_file: caseManifest.tender.source_file,
    source_sha256: parseReport.source_sha256,
    parse_job_id: 'd931d540-2e47-4587-adf3-dec54ce3e078',
    parse_chunk_count: parseReport.chunk_count,
    parse_first_failed_chunk: parseReport.failed_chunk
  },
  enterprise: {
    project_id: materialRows[0]?.project_id ?? null,
    source_rows: huaweiSourceRows.map((r) => ({ source_id: r.source_id, material_id: r.material_id, source_hash: r.source_hash }))
  },
  downstream: {
    requirement_snapshot: 'NOT_CREATED_FOR_THIS_RUN',
    retrieval_run: 'NOT_CREATED',
    fact_run: 'NOT_CREATED',
    mapping_run: 'NOT_CREATED',
    claim_run: 'NOT_CREATED',
    writer_run: 'NOT_CREATED',
    export_run: 'NOT_CREATED'
  },
  lineage_complete_through: 'TENDER_PARSE_SOURCE_SCOPE_VALIDATION'
});

await writeJson('17_REAL_E2E_BASELINE_METRICS.json', {
  run_id: RUN_ID,
  case_id: 'REAL_E2E_CASE_01',
  status: 'DEEP_SAFE_ENDPOINT_ESTABLISHED',
  stage_reached: 'TENDER_PARSE_SOURCE_SCOPE_VALIDATION',
  metrics: {
    tender_parser: 'PASS',
    tender_chunk_coverage: 1,
    requirement_gateway_completed_chunks: parseReport.completed_chunks,
    requirement_gateway_total_chunks: parseReport.chunk_count,
    requirement_gateway_first_failure: parseReport.error_code,
    enterprise_materials_expected: 6,
    enterprise_materials_present: huaweiSourceRows.length,
    enterprise_material_chunks: huaweiSourceRows.reduce((n, r) => n + r.chunk_count, 0),
    enterprise_embeddings: huaweiSourceRows.reduce((n, r) => n + r.embedding_count, 0),
    provider_calls_total: parseReport.provider_calls_before_failure,
    requirement_provider_calls: parseReport.provider_calls_before_failure,
    fact_provider_calls: 0,
    mapping_provider_calls: 0,
    claim_provider_calls: 0,
    writer_provider_calls: 0,
    production_db_writes: 0,
    production_fact_persistence: 0,
    gold_mutations: 0,
    p0_hard_safety_escape: 0,
    requirement_tender_leakage: 0,
    synthetic_enterprise_mixed: 0
  },
  quality_vs_hard_gate: {
    hard_stop: false,
    deterministic_product_gap: true,
    semantic_adjudication: 'PENDING_GPT'
  }
});

await writeJson('18_FAILURE_REGISTER.json', {
  run_id: RUN_ID,
  failures: [
    {
      failure_id: 'E2E-REQ-001',
      stage: 'REQUIREMENT_PARSE_SOURCE_SCOPE_VALIDATION',
      severity: 'P1_PRODUCT_GAP',
      error_code: parseReport.error_code,
      signature: parseReport.error_message,
      first_failed_chunk: parseReport.failed_chunk,
      classification: parseReport.classification,
      scope: 'PRODUCTION_SHAPED_REQUIREMENT_PATH',
      semantic_root_cause: 'PENDING_GPT',
      repair_applied: false
    },
    {
      failure_id: 'E2E-RAG-001',
      stage: 'ENTERPRISE_INDEXING',
      severity: 'P1_PRODUCT_GAP',
      error_code: 'ENTERPRISE_INDEX_NOT_EXECUTED',
      signature: 'HW-001..HW-006 index_status=NOT_INDEXED and embedding_count=0',
      classification: 'UPSTREAM_STAGE_NOT_EXECUTED',
      repair_applied: false
    },
    {
      failure_id: 'E2E-DOWNSTREAM-001',
      stage: 'MAPPING_CLAIM_WRITER',
      severity: 'EXPECTED_BLOCKED',
      error_code: 'UPSTREAM_AUTHORITY_UNAVAILABLE',
      signature: 'No new confirmed Requirement/Fact/Mapping authority after parse stop',
      classification: 'AUTHORITY_SAFE_STOP',
      repair_applied: false
    }
  ]
});

await writeJson('19_PRODUCT_GAPS.json', {
  gaps: [
    { gap_id: 'GAP-01', stage: 'RequirementParseService', description: 'Candidate range containing only excluded scope fails the complete parse job instead of yielding a completed run.', owner: 'Requirement / source-scope boundary', evidence: '04_TENDER_PARSE_REPORT.json' },
    { gap_id: 'GAP-02', stage: 'EnterpriseRetrievalService', description: 'Existing Huawei Eval materials are parsed/chunked but not indexed or embedded in this baseline.', owner: 'RAG ingestion/indexing', evidence: '07_ENTERPRISE_INGESTION_REPORT.json' },
    { gap_id: 'GAP-03', stage: 'CanonicalFact', description: 'Fact V2.2 cannot start without retrieval-driven contexts and therefore remains unexecuted.', owner: 'Fact pipeline', evidence: '08_RETRIEVAL_REPORT.json / 09_FACT_REPORT.json' },
    { gap_id: 'GAP-04', stage: 'Downstream authority', description: 'Mapping, Claim, Writer and export remain safely blocked without authorized upstream state.', owner: 'Cross-domain authority', evidence: '10_MAPPING_REPORT.json..15_EXPORT_REPORT.json' }
  ]
});

await writeJson('20_MECHANICAL_REPAIR_LOG.json', {
  run_id: RUN_ID,
  repairs_applied: 0,
  production_code_changes: 0,
  semantic_contract_changes: 0,
  prompt_changes: 0,
  schema_changes: 0,
  provider_switches: 0,
  note: 'No mechanical repair was applied; the current run stopped at a deterministic scope boundary.'
});

await writeJson('21_REGRESSION_REPORT.json', {
  run_id: RUN_ID,
  status: 'COMPLETE',
  suites: [
    {
      name: 'focused requirement/fact/router regression',
      command: 'node --test test/requirement-scope-table.test.js test/requirement-production-quality-gate.test.js test/requirement-extraction-contract-owner.test.js test/requirement-resilience.test.js test/response-router-v2-2-3.test.js test/evidence-fact-candidate-v2-2.test.js test/real-pdf-fact-pilot-v1-1-contract.test.js',
      passed: 75,
      failed: 1,
      status: 'PASS_WITH_PRE_EXISTING_UNRELATED_BASELINE',
      failure: {
        test: 'frozen 199 Gold requirements retain an eligible or unknown source span after routing',
        family: 'PATH_FIXTURE_AVAILABILITY',
        signature: 'ENOENT backend/backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json',
        classification: 'PRE_EXISTING_UNRELATED_BASELINE'
      }
    },
    {
      name: 'isolated PostgreSQL integration',
      command: 'DATABASE_URL=<isolated-eval-db-redacted> node --test --test-concurrency=1 integration/postgres.integration.js',
      passed: 27,
      failed: 0,
      status: 'PASS',
      database: 'bid_platform_flow_audit_test',
      writes_scoped_to_isolated_eval_db: true
    },
    { name: 'frontend build', command: 'npm run build', status: 'PASS' },
    { name: 'lint', command: 'npm run lint', status: 'PASS' },
    { name: 'git diff check', command: 'git diff --check', status: 'PASS_WITH_LINE_ENDING_WARNINGS_ONLY' }
  ],
  baseline_policy: 'Known unrelated failures are recorded only; no unrelated repair is authorized.',
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  new_task_regressions: 0
});

await writeJson('22_TOP_10_NEXT_ACTIONS.json', [
  'Review REQUIREMENT_SCOPE_EXCLUDED behavior at the generic source-scope boundary.',
  'Add isolated entry-point regression for an excluded-only candidate range before any repair.',
  'Decide whether excluded-only chunks should be skipped or represented as an explained non-requirement outcome.',
  'Complete Eval-only indexing/embedding for HW-001..HW-006 using the existing retrieval service.',
  'Re-run retrieval only after a confirmed Requirement authority exists for the E2E case.',
  'Run Fact V2.2 only on retrieved contexts and retain full source lineage.',
  'Run canonical Mapping only after Fact authority is available.',
  'Run Sufficiency and Claim only through their canonical gates.',
  'Run Writer only if authorized claims exist; otherwise preserve the upstream-blocked result.',
  'Submit the complete handoff packet for GPT adjudication before any semantic or production change.'
]);

await writeJson('23_GPT_REVIEW_PACKET.json', {
  packet_type: 'V43_OVERNIGHT_REAL_E2E_MASTER_V1_GPT_REVIEW_PACKET',
  run_id: RUN_ID,
  case_id: 'REAL_E2E_CASE_01',
  decision_request: 'Review the deepest authority-safe E2E endpoint and classified product gaps; no semantic conclusion is assigned by Codex.',
  reached_stage: 'TENDER_PARSE_SOURCE_SCOPE_VALIDATION',
  tender_source: { tender_id: 'TB-006', source_sha256: parseReport.source_sha256, parser: 'PASS', chunks: parseReport.chunk_count, first_failure: parseReport.error_code },
  enterprise_sources: huaweiSourceRows,
  router_identity: routerFreeze,
  downstream_status: {
    retrieval: 'NOT_EXECUTED_UPSTREAM_BLOCKED',
    fact: 'NOT_EXECUTED_UPSTREAM_BLOCKED',
    mapping: 'NOT_EXECUTED_UPSTREAM_BLOCKED',
    claim: 'NOT_EXECUTED_UPSTREAM_BLOCKED',
    writer: 'NOT_EXECUTED_UPSTREAM_BLOCKED',
    export: 'NOT_EXECUTED_UPSTREAM_BLOCKED'
  },
  first_failure: {
    stage: parseReport.first_failure_stage,
    error_code: parseReport.error_code,
    classification: parseReport.classification,
    semantic_root_cause: 'PENDING_GPT'
  },
  safety: { provider_calls: parseReport.provider_calls_before_failure, production_db_writes: 0, gold_mutations: 0, production_semantic_changes: 0 }
});

await writeJson('24_FINAL_CHECKPOINT.json', {
  checkpoint: 'V43_OVERNIGHT_REAL_E2E_MASTER_V1_FINAL',
  run_id: RUN_ID,
  final_status: 'READY_FOR_GPT_REAL_E2E_CASE_01_ADJUDICATION',
  final_stage_reached: 'TENDER_PARSE_SOURCE_SCOPE_VALIDATION',
  deepest_safe_endpoint: 'Tender upload → parser → section classifier → chunker → Requirement Gateway (partial; fail-closed at source scope validation)',
  case_count: 1,
  tender: { tender_id: 'TB-006', source_sha256: parseReport.source_sha256, parser: 'PASS', chunk_count: parseReport.chunk_count, coverage: parseReport.chunk_coverage },
  enterprise: { corpus_id: caseManifest.enterprise_corpus.corpus_id, source_count: huaweiSourceRows.length, parsed: huaweiSourceRows.every((r) => r.extraction_status === 'succeeded'), indexed: huaweiSourceRows.every((r) => r.index_status === 'INDEXED') },
  first_unresolved_blocker: { stage: parseReport.first_failure_stage, error_code: parseReport.error_code, classification: parseReport.classification },
  provider_calls: parseReport.provider_calls_before_failure,
  production_db_writes: 0,
  production_fact_persistence: 0,
  gold_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  semantic_root_cause: 'PENDING_GPT',
  next_gate: 'GPT adjudication of REAL_E2E_CASE_01 handoff',
  baseline_drift: 'PRE_EXISTING_UNRELATED_BASELINE_ONLY',
  regression_summary: {
    focused_unit: '75/76 (one pre-existing path-fixture failure)',
    isolated_postgres: '27/27',
    build: 'PASS',
    lint: 'PASS',
    diff_check: 'PASS_WITH_LINE_ENDING_WARNINGS_ONLY'
  },
  git: {
    branch: 'feat/v4.3-semantic-boundary-routing',
    head: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
    dirty: true,
    status_entries_observed: 677,
    modified_entries_observed: 97,
    untracked_entries_observed: 580
  }
});

const readme = `# V43 Overnight Real E2E Master V1\n\nThis handoff records the deepest authority-safe endpoint reached for REAL_E2E_CASE_01.\n\n- Tender: TB-006\n- Enterprise corpus: HUAWEI-PUBLIC-REAL-PDF-PILOT-V1 (HW-001..HW-006)\n- Fresh Requirement path: parser/chunker PASS; fail-closed at REQUIREMENT_SCOPE_EXCLUDED on chunk 6\n- Downstream Fact/Mapping/Claim/Writer stages were not invoked without authorized upstream state.\n- This packet contains no semantic adjudication and no production writes.\n- semantic_root_cause remains PENDING_GPT.\n\nSee 24_FINAL_CHECKPOINT.json for the authoritative status.\n`;
await writeFile(join(OUT, '00_GPT_README.md'), readme, 'utf8');

const entries = (await readdir(OUT)).filter((n) => n !== 'SHA256SUMS.txt' && n !== 'V43_HANDOFF_OVERNIGHT_REAL_E2E_MASTER_V1.zip').sort();
const sums = [];
for (const name of entries) {
  const data = await readFile(join(OUT, name));
  sums.push(`${sha256(data)}  ${name}`);
}
await writeFile(join(OUT, 'SHA256SUMS.txt'), sums.join('\n') + '\n', 'utf8');

console.log(JSON.stringify({ out: OUT, run_id: RUN_ID, artifact_count: entries.length + 1, huawei_sources: huaweiSourceRows.length, parse_failure: parseReport.error_code, provider_calls: parseReport.provider_calls_before_failure }, null, 2));
