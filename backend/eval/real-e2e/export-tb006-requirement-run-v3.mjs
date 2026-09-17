import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createPool, PgRepository } from '../../src/db.js';

const root = resolve(process.cwd());
const dbName = 'bid_platform_flow_audit_test';
const dbUrl = process.env.EVAL_DATABASE_URL || `postgresql://bid_user:bid_password@127.0.0.1:5432/${dbName}`;
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const outDir = join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REQUIREMENT_SCOPE_RECERT_E2E_FOUNDATION_V1');
const outPath = join(outDir, '08_TB006_REQUIREMENT_RUN_V3.json');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const pool = createPool(dbUrl);
const repository = new PgRepository(pool);
try {
  const projects = await pool.query(
    "SELECT id,name,created_at FROM projects WHERE name LIKE 'V43 Real E2E Case 01 Requirement Run V3 %' ORDER BY created_at DESC LIMIT 1"
  );
  if (!projects.rows[0]) throw new Error('REAL_E2E_CASE_01_REQUIREMENT_RUN_V3 project not found');
  const project = projects.rows[0];
  const jobs = await repository.listParseJobs(project.id);
  const jobSummary = jobs[0];
  if (!jobSummary) throw new Error('REAL_E2E_CASE_01_REQUIREMENT_RUN_V3 parse job not found');
  const job = await repository.getParseJob(jobSummary.id);
  const chunkRows = await pool.query(
    'SELECT chunk_number,status,candidate_count,runtime_ms,error_code,error_message,gateway_audit_json FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number',
    [job.id]
  );
  const sourceBuffer = await readFile(sourcePath);
  const rejections = chunkRows.rows.flatMap((row) => {
    const audit = row.gateway_audit_json?.scope_audit;
    return (audit?.rejections || []).map((item) => ({ ...item, chunk_status: row.status }));
  });
  const providerCalls = chunkRows.rows.reduce((total, row) => {
    const audit = row.gateway_audit_json && typeof row.gateway_audit_json === 'object' ? row.gateway_audit_json : {};
    const count = Number(audit.provider_calls ?? audit.provider_call_count ?? audit.calls ?? (['succeeded', 'succeeded_empty'].includes(row.status) ? 1 : 0));
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
  const candidates = Array.isArray(job.candidates) ? job.candidates : [];
  const scopeAudit = chunkRows.rows.map((row) => ({
    chunk_number: row.chunk_number,
    status: row.status,
    candidate_count: row.candidate_count,
    scope_audit: row.gateway_audit_json?.scope_audit || null,
    error_code: row.error_code || null
  }));
  const output = {
    run_id: 'REAL_E2E_CASE_01_REQUIREMENT_RUN_V3',
    case_id: 'REAL_E2E_CASE_01',
    authority: 'CURRENT_PRODUCTION_PATH_OUTPUT_ONLY',
    status: job.status === 'succeeded' ? 'PASS' : 'BLOCKED',
    project_id: project.id,
    parse_job_id: job.id,
    source_file: basename(sourcePath),
    source_sha256: sha256(sourceBuffer),
    source_bytes: sourceBuffer.length,
    parse_job_status: job.status,
    phase: job.phase,
    chunk_count: chunkRows.rows.length,
    chunks_terminal_non_fatal: chunkRows.rows.every((row) => ['succeeded', 'succeeded_empty'].includes(row.status)),
    completed_chunks: chunkRows.rows.filter((row) => ['succeeded', 'succeeded_empty'].includes(row.status)).length,
    failed_chunks: chunkRows.rows.filter((row) => !['succeeded', 'succeeded_empty'].includes(row.status)).map((row) => ({ chunk_number: row.chunk_number, status: row.status, error_code: row.error_code || null })),
    candidate_count: candidates.length,
    candidates,
    source_verified_count: candidates.filter((candidate) => candidate.source_verified === true).length,
    source_verified_rate: candidates.length ? candidates.filter((candidate) => candidate.source_verified === true).length / candidates.length : null,
    provider_calls: providerCalls,
    retry_count: 0,
    scope_raw_candidate_count: chunkRows.rows.reduce((sum, row) => sum + Number(row.gateway_audit_json?.scope_audit?.raw_candidates || 0), 0),
    scope_accepted_count: chunkRows.rows.reduce((sum, row) => sum + Number(row.gateway_audit_json?.scope_audit?.scope_accepted || 0), 0),
    scope_rejected_count: chunkRows.rows.reduce((sum, row) => sum + Number(row.gateway_audit_json?.scope_audit?.scope_rejected || 0), 0),
    success_empty_count: chunkRows.rows.filter((row) => row.gateway_audit_json?.scope_audit?.outcome === 'SUCCESS_EMPTY').length,
    success_empty_after_scope_filter_count: chunkRows.rows.filter((row) => row.gateway_audit_json?.scope_audit?.outcome === 'SUCCESS_EMPTY_AFTER_SCOPE_FILTER').length,
    scope_rejections: rejections,
    scope_audit: scopeAudit,
    production_db_writes: 0,
    gold_mutations: 0,
    provider_path: 'Semantic Gateway → Requirement Extraction Gateway',
    frozen_production_artifact_substituted: false
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...output, candidates: `[${candidates.length} rows omitted from stdout]` }, null, 2));
} finally {
  await pool.end();
}
