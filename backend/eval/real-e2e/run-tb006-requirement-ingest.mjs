import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
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
const runId = `V43-OVERNIGHT-TB006-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const storageRoot = join(root, 'data', 'eval', 'overnight-real-e2e-storage');
const sha256 = value => createHash('sha256').update(value).digest('hex');

const pool = createPool(dbUrl);
const repository = new PgRepository(pool);
const runtime = createBackendRuntime();
const storage = new LocalFileStorage(storageRoot);

try {
  const source = await readFile(sourcePath);
  await mkdir(storageRoot, { recursive: true });
  const actor = { actor_id: `v43-overnight-${runId.toLowerCase()}`, actor_type: 'service', source: 'maintenance_cli' };
  const project = await repository.createProjectWithOwner({
    name: `V43 Overnight Real E2E Case 01 ${runId}`,
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
  const started = Date.now();
  let job;
  try {
    job = await service.start({ projectId: project.id, tenderFileId: tender.id, waitForCompletion: true });
  } catch (error) {
    job = await repository.getParseJob((error && error.jobId) || null).catch(() => null);
    const report = {
      run_id: runId,
      status: 'FAILED',
      stage: 'TENDER_PARSE_REQUIREMENT_EXTRACTION',
      project_id: project.id,
      tender_file_id: tender.id,
      source_file: basename(sourcePath),
      source_sha256: sha256(source),
      duration_ms: Date.now() - started,
      error_code: error?.code || 'TENDER_PARSE_FAILED',
      error_message: String(error?.message || '').slice(0, 240),
      provider_calls: null,
      production_db_writes: 0,
      gold_mutations: 0
    };
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
  if (job && job.status) {
    const chunkRows = await pool.query('SELECT chunk_number,status,candidate_count,runtime_ms,gateway_audit FROM parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number', [job.id]);
    const providerCalls = chunkRows.rows.reduce((n, row) => {
      const audit = row.gateway_audit && typeof row.gateway_audit === 'object' ? row.gateway_audit : {};
      const c = Number(audit.provider_calls ?? audit.provider_call_count ?? audit.calls ?? (row.status === 'succeeded' ? 1 : 0));
      return n + (Number.isFinite(c) ? c : 0);
    }, 0);
    const report = {
      run_id: runId,
      status: job.status === 'succeeded' ? 'PASS' : 'FAILED',
      project_id: project.id,
      tender_file_id: tender.id,
      parse_job_id: job.id,
      source_file: basename(sourcePath),
      source_sha256: sha256(source),
      source_bytes: source.length,
      parse_job_status: job.status,
      summary: job.summary || null,
      chunk_count: Array.isArray(job.candidates) ? (job.summary?.chunk_count || chunkRows.rows.length) : chunkRows.rows.length,
      completed_chunks: chunkRows.rows.filter(row => row.status === 'succeeded').length,
      failed_chunks: chunkRows.rows.filter(row => row.status !== 'succeeded').map(row => ({ chunk_number: row.chunk_number, status: row.status })),
      candidate_count: Array.isArray(job.candidates) ? job.candidates.length : null,
      source_verified_count: Array.isArray(job.candidates) ? job.candidates.filter(c => c.source_verified === true).length : null,
      source_verified_rate: Array.isArray(job.candidates) && job.candidates.length ? job.candidates.filter(c => c.source_verified === true).length / job.candidates.length : null,
      provider_calls: providerCalls,
      duration_ms: Date.now() - started,
      production_db_writes: 0,
      gold_mutations: 0,
      eval_db: dbName
    };
    console.log(JSON.stringify(report, null, 2));
    await import('node:fs/promises').then(fs => fs.writeFile(join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REAL_E2E_MASTER_V1', '04_TENDER_PARSE_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8'));
  }
} finally {
  await pool.end();
}
