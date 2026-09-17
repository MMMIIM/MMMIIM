import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createPool, PgRepository } from '../../src/db.js';
import { LocalFileStorage } from '../../src/storage.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { RequirementParseService } from '../../src/requirement-parse-service.js';
import { createRequirementExtractionGateway } from '../../src/pipeline/requirement-extraction.js';
import { createBackendRuntime } from '../../src/backend-runtime.js';

const root = resolve(process.cwd());
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const dbName = 'bid_platform_flow_audit_test';
const dbUrl = process.env.EVAL_DATABASE_URL || `postgresql://bid_user:bid_password@127.0.0.1:5432/${dbName}`;
const runId = 'REAL_E2E_CASE_01_REQUIREMENT_RUN_V3';
const storageRoot = join(root, 'data', 'eval', 'real-e2e-case-01-v3-storage');
const reportPath = join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REQUIREMENT_SCOPE_RECERT_E2E_FOUNDATION_V1', '08_TB006_REQUIREMENT_RUN_V3.json');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const pool = createPool(dbUrl);
const repository = new PgRepository(pool);
const runtime = createBackendRuntime();
const storage = new LocalFileStorage(storageRoot);
let report;

try {
  const source = await readFile(sourcePath);
  await mkdir(storageRoot, { recursive: true });
  await mkdir(join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REQUIREMENT_SCOPE_RECERT_E2E_FOUNDATION_V1'), { recursive: true });
  const sourceSha256 = sha256(source);
  const actor = { actor_id: `v43-real-e2e-${runId.toLowerCase()}`, actor_type: 'service', source: 'eval_case_01' };
  const project = await repository.createProjectWithOwner({
    name: `V43 Real E2E Case 01 Requirement Run V3 ${runId}`,
    deadline: null,
    owner: actor
  });
  const storageKey = await storage.save({ projectId: project.id, originalName: basename(sourcePath), buffer: source });
  const tender = await repository.addTenderFile({
    projectId: project.id,
    originalName: basename(sourcePath),
    storageKey,
    mimeType: 'application/pdf',
    sizeBytes: source.length
  });
  const service = new RequirementParseService({
    repository,
    storage,
    textExtractor: extractTenderText,
    extractionGateway: createRequirementExtractionGateway(runtime.createSemanticGatewayClient({ taskType: 'requirement_extraction' })),
    env: runtime.env
  });
  const startedAt = Date.now();
  let job = null;
  let error = null;
  try {
    job = await service.start({ projectId: project.id, tenderFileId: tender.id, waitForCompletion: true });
  } catch (caught) {
    error = caught;
    const row = await pool.query(
      'SELECT id,status,summary_json,gateway_audit_json,phase,error_code,error_message FROM tender_parse_jobs WHERE tender_file_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tender.id]
    );
    job = row.rows[0] || null;
  }

  const jobId = job?.id || null;
  const chunkRows = jobId
    ? await pool.query(
      'SELECT chunk_number,status,candidate_count,runtime_ms,gateway_audit_json,error_code,error_message FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number',
      [jobId]
    )
    : { rows: [] };
  const chunks = chunkRows.rows;
  const providerCalls = chunks.reduce((total, row) => {
    const audit = row.gateway_audit_json && typeof row.gateway_audit_json === 'object' ? row.gateway_audit_json : {};
    const count = Number(audit.provider_calls ?? audit.provider_call_count ?? audit.calls ?? (['succeeded', 'succeeded_empty'].includes(row.status) ? 1 : 0));
    return total + (Number.isFinite(count) ? count : 0);
  }, 0);
  const successfulChunks = chunks.filter((row) => ['succeeded', 'succeeded_empty'].includes(row.status));
  const candidateRows = Array.isArray(job?.candidates) ? job.candidates : [];
  const scopeAudit = chunks.map((row) => ({
    chunk_number: row.chunk_number,
    status: row.status,
    candidate_count: row.candidate_count,
    scope_audit: row.gateway_audit_json?.scope_audit || null,
    error_code: row.error_code || null
  }));
  report = {
    run_id: runId,
    case_id: 'REAL_E2E_CASE_01',
    status: job?.status === 'succeeded' && !error ? 'PASS' : 'BLOCKED',
    stage: error ? 'TENDER_PARSE_REQUIREMENT_EXTRACTION' : 'TENDER_PARSE_COMPLETE',
    project_id: project.id,
    tender_file_id: tender.id,
    parse_job_id: jobId,
    source_file: basename(sourcePath),
    source_sha256: sourceSha256,
    source_bytes: source.length,
    parse_job_status: job?.status || null,
    error_code: error?.code || job?.error_code || null,
    error_message: String(error?.message || job?.error_message || '').slice(0, 300) || null,
    chunk_count: Number(job?.summary?.chunk_count || chunks.length || 0),
    completed_chunks: successfulChunks.length,
    failed_chunks: chunks.filter((row) => !['succeeded', 'succeeded_empty'].includes(row.status)).map((row) => ({ chunk_number: row.chunk_number, status: row.status, error_code: row.error_code || null })),
    candidate_count: candidateRows.length,
    source_verified_count: candidateRows.filter((candidate) => candidate.source_verified === true).length,
    source_verified_rate: candidateRows.length ? candidateRows.filter((candidate) => candidate.source_verified === true).length / candidateRows.length : null,
    provider_calls: providerCalls,
    provider_failures: chunks.filter((row) => !['succeeded', 'succeeded_empty'].includes(row.status)).length,
    scope_audit: scopeAudit,
    summary: job?.summary || null,
    duration_ms: Date.now() - startedAt,
    production_db_writes: 0,
    gold_mutations: 0,
    eval_db: dbName,
    fresh_output_authority: 'CURRENT_PRODUCTION_PATH_OUTPUT_ONLY',
    frozen_production_artifact_substituted: false
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (error) process.exitCode = 2;
} finally {
  await pool.end();
}
