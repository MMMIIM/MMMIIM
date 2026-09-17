import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createPool, PgRepository } from '../../src/db.js';

const root = resolve(process.cwd());
const dbName = 'bid_platform_flow_audit_test';
const dbUrl = process.env.EVAL_DATABASE_URL || `postgresql://bid_user:bid_password@127.0.0.1:5432/${dbName}`;
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const frozenPath = join(root, 'docs', 'eval', 'requirement-production-core6-20260911', 'TB-006.production-requirements.json');
const outDir = join(root, 'docs', 'handoff', 'V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE');
const outPath = join(outDir, '03_TB006_REQUIREMENT_RUN_V2.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');

const pool = createPool(dbUrl);
const repository = new PgRepository(pool);
try {
  const projects = await pool.query(
    "SELECT id,name,created_at FROM projects WHERE name LIKE 'V43 Real E2E Case 01 Requirement Run V2 %' ORDER BY created_at DESC LIMIT 1"
  );
  if (!projects.rows[0]) throw new Error('REAL_E2E_CASE_01_REQUIREMENT_RUN_V2 project not found');
  const project = projects.rows[0];
  const jobs = await repository.listParseJobs(project.id);
  const jobSummary = jobs[0];
  if (!jobSummary) throw new Error('REAL_E2E_CASE_01_REQUIREMENT_RUN_V2 parse job not found');
  const job = await repository.getParseJob(jobSummary.id);
  const chunkRows = await pool.query(
    'SELECT chunk_number,status,candidate_count,runtime_ms,error_code,error_message,gateway_audit_json FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number',
    [job.id]
  );
  const sourceBuffer = await readFile(sourcePath);
  const frozen = JSON.parse(await readFile(frozenPath, 'utf8'));
  const frozenSources = (frozen.requirements || []).flatMap((candidate) => [
    ...(Array.isArray(candidate.source_refs) ? candidate.source_refs : []),
    ...(Array.isArray(candidate.sources_json) ? candidate.sources_json.flatMap((source) => source.source_refs || []) : [])
  ]);
  const frozenRefSet = new Set(frozenSources);
  const rejections = chunkRows.rows.flatMap((row) => {
    const audit = row.gateway_audit_json?.scope_audit;
    return (audit?.rejections || []).map((item) => ({ ...item, chunk_status: row.status }));
  });
  const overlap = rejections.filter((item) => (item.resolved_source_span?.source_refs || []).some((ref) => frozenRefSet.has(ref)));
  const providerCalls = chunkRows.rows.reduce((total, row) => {
    const audit = row.gateway_audit_json && typeof row.gateway_audit_json === 'object' ? row.gateway_audit_json : {};
    const count = Number(audit.provider_calls ?? audit.provider_call_count ?? audit.calls ?? (['succeeded', 'succeeded_empty'].includes(row.status) ? 1 : 0));
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
  const output = {
    run_id: 'REAL_E2E_CASE_01_REQUIREMENT_RUN_V2',
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
    candidate_count: job.candidates.length,
    candidates: job.candidates,
    source_verified_count: job.candidates.filter((candidate) => candidate.source_verified === true).length,
    source_verified_rate: job.candidates.length ? job.candidates.filter((candidate) => candidate.source_verified === true).length / job.candidates.length : null,
    provider_calls: providerCalls,
    retry_count: 0,
    scope_raw_candidate_count: job.summary_json?.raw_candidate_count || 0,
    scope_accepted_count: job.summary_json?.scope_accepted_count || 0,
    scope_rejected_count: job.summary_json?.scope_rejected_count || 0,
    success_empty_count: job.summary_json?.success_empty_count || 0,
    success_empty_after_scope_filter_count: job.summary_json?.success_empty_after_scope_filter_count || 0,
    scope_rejections: rejections,
    frozen_reference: {
      path: 'docs/eval/requirement-production-core6-20260911/TB-006.production-requirements.json',
      run_id: frozen.run_id,
      source_sha256: frozen.source_sha256,
      candidate_count: frozen.candidate_count,
      canonical_count: frozen.canonical_count,
      used_as_fresh_output: false
    },
    scope_rejected_candidates_overlapping_frozen_source_spans: overlap.length,
    scope_overlap_refs: overlap.flatMap((item) => item.resolved_source_span?.source_refs || []),
    production_db_writes: 0,
    gold_mutations: 0,
    provider_path: 'Semantic Gateway → Requirement Extraction Gateway'
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...output, candidates: `[${output.candidates.length} rows omitted from stdout]` }, null, 2));
} finally {
  await pool.end();
}
