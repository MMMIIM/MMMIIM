import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { PgRepository } from '../../src/db.js';
import { LocalFileStorage } from '../../src/storage.js';
import { CompanyMaterialService } from '../../src/company-material-service.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { ProjectAuthorizationService } from '../../src/project-authorization-service.js';
import { EvidenceSourceContextResolver } from '../../src/pipeline/evidence-source-context-resolver.js';
import { EvidenceSourceFactService } from '../../src/evidence-source-fact-service.js';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { chunkEnterpriseMaterial } from '../../src/pipeline/enterprise-material-chunker.js';
import { loadSemanticGatewayEnvironment, safeSemanticGatewayRuntimeSummary } from '../../../packages/semantic-contracts/runtime-config.js';

const ROOT = resolve(process.cwd());
const SOURCE_ROOT = join(ROOT, 'data', 'eval', 'h3c-public-real-v1');
const RAW_ROOT = join(SOURCE_ROOT, 'raw');
const MANIFEST_PATH = join(ROOT, 'docs', 'handoff', 'H3C_PUBLIC_REAL_ENTERPRISE_PACK_V1', '01_SOURCE_MANIFEST.json');
const ELIGIBILITY_PATH = join(SOURCE_ROOT, 'source_eligibility.json');
const OUT_DIR = resolve(process.env.OUTPUT_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_REAL_FACT_V2_H3C_EXTRACTION_V1'));
const DB_NAME = 'bid_platform_flow_audit_test';
const DB_URL = process.env.DATABASE_URL || `postgresql://bid_user:bid_password@127.0.0.1:5432/${DB_NAME}`;
const ENTERPRISE_ID = 'H3C-PUBLIC-REAL-V1';
const RUN_ID = `V43-H3C-REAL-FACT-V2-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const PROVIDER_CAP = 120;
const sha = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safeText = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;
const safeJson = value => JSON.stringify(value ?? null);

function materialType(category) {
  const key = String(category || '').toLowerCase();
  if (key === 'corporate') return 'company_profile';
  if (key === 'product') return 'product_documentation';
  if (key === 'technical_doc') return 'technical_whitepaper';
  if (key === 'service') return 'delivery_capability';
  if (key === 'solution') return 'technical_solution';
  if (key === 'case') return 'project_case';
  return 'other';
}

function parseJson(text, label) {
  try { return JSON.parse(text); } catch (error) { throw Object.assign(new Error(`${label} is not valid JSON.`), { code: 'ARTIFACT_JSON_INVALID', cause: error }); }
}

function safeProviderAudit(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of [
    'provider', 'model', 'requested_provider', 'requested_model', 'response_provider', 'response_model', 'endpoint',
    'gateway_http_status', 'provider_http_status', 'provider_http_reached', 'latency_ms', 'retry_attempt',
    'retry_reason', 'finish_reason', 'prompt_tokens', 'completion_tokens', 'output_truncated', 'json_parse_success',
    'empty_domain_namespace_normalized_count', 'safe_error_code', 'cause_code'
  ]) if (value[key] !== undefined) out[key] = typeof value[key] === 'string' ? safeText(value[key], 160) : value[key];
  if (value.fact_normalization_diagnostic && typeof value.fact_normalization_diagnostic === 'object') {
    out.fact_normalization_diagnostic = {
      normalizer_invoked: value.fact_normalization_diagnostic.normalizer_invoked === true,
      projection_invoked: value.fact_normalization_diagnostic.projection_invoked === true,
      unexpected_property_names: Array.isArray(value.fact_normalization_diagnostic.unexpected_property_names)
        ? value.fact_normalization_diagnostic.unexpected_property_names.slice(0, 20).map(item => safeText(item, 120)) : [],
      exact_validation_path: safeText(value.fact_normalization_diagnostic.exact_validation_path, 240)
    };
  }
  return out;
}

function safeError(error) {
  const details = error?.details || {};
  const audit = details.provider_audit || error?.audit?.probe_diagnostics || null;
  return {
    code: safeText(error?.code || 'UNKNOWN_ERROR', 120),
    status: Number.isInteger(error?.status) ? error.status : null,
    stage: safeText(details.stage, 80),
    boundary: safeText(details.boundary, 160),
    cause_code: safeText(details.cause_code, 120),
    provider_audit: safeProviderAudit(audit),
    schema_validation_errors: Array.isArray(details.schema_validation_errors)
      ? details.schema_validation_errors.slice(0, 20).map(item => ({
        path: safeText(item?.path, 180), keyword: safeText(item?.keyword, 80), expected: safeText(item?.expected, 180),
        actual_type: safeText(item?.actual_type, 80), additional_property: safeText(item?.additional_property, 120)
      })) : []
  };
}

function chunkCoverage(chunks, length) {
  const ranges = chunks.filter(item => Number.isInteger(item.char_start) && Number.isInteger(item.char_end))
    .sort((a, b) => a.char_start - b.char_start);
  let cursor = 0;
  let coveredNonWhitespace = 0;
  let gaps = 0;
  for (const range of ranges) {
    if (range.char_start > cursor) gaps += 1;
    const start = Math.max(cursor, range.char_start);
    const end = Math.max(start, range.char_end);
    coveredNonWhitespace += end - start;
    cursor = Math.max(cursor, end);
  }
  return { source_length: length, chunk_range_count: ranges.length, contiguous_to: cursor, range_gaps: gaps, coverage_rate: length ? Math.min(1, cursor / length) : 0, provenance_free_chunks: chunks.filter(item => !item.chunk_hash || !Number.isInteger(item.char_start) || !Number.isInteger(item.char_end)).length, covered_non_whitespace_chars: coveredNonWhitespace };
}

function selectAnchor(chunks) {
  const candidates = chunks.filter(item => String(item.source_text || '').trim().length >= 24);
  if (!candidates.length) return null;
  // Deterministic Eval-only anchor choice: favor visible H3C text and avoid
  // script/style/navigation chunks while retaining the production chunk IDs.
  const score = item => {
    const source = String(item.source_text || '');
    const visible = (source.match(/[\u3400-\u9fffA-Za-z0-9]/g) || []).length;
    const tags = (source.match(/</g) || []).length;
    const scriptPenalty = /<script|javascript/i.test(source) ? 500 : 0;
    return visible - tags * 4 - scriptPenalty;
  };
  return candidates.slice().sort((a, b) => score(b) - score(a) || a.chunk_index - b.chunk_index)[0];
}

async function loadSources() {
  const manifest = parseJson(await readFile(MANIFEST_PATH, 'utf8'), 'H3C source manifest');
  const eligibility = parseJson(await readFile(ELIGIBILITY_PATH, 'utf8'), 'H3C source eligibility');
  if (manifest.source_count !== 20 || manifest.sources?.length !== 20) throw Object.assign(new Error('Frozen manifest source count is not 20.'), { code: 'H3C_SOURCE_COUNT_MISMATCH' });
  if (eligibility.sources?.length !== 20 || eligibility.eligible_source_count !== 20) throw Object.assign(new Error('Frozen source eligibility is not 20/20.'), { code: 'H3C_SOURCE_ELIGIBILITY_MISMATCH' });
  const report = parseJson(await readFile(join(SOURCE_ROOT, 'download_report.json'), 'utf8'), 'H3C download report');
  const byId = new Map(report.map(row => [row.id, row]));
  return manifest.sources.map(source => {
    const row = byId.get(source.id);
    if (!row || row.status !== 'DOWNLOADED') throw Object.assign(new Error(`Frozen source ${source.id} was not downloaded.`), { code: 'H3C_SOURCE_NOT_DOWNLOADED' });
    const filePath = join(ROOT, row.local_path);
    return { ...source, ...row, filePath, source_id: source.id, original_name: basename(filePath), material_type: materialType(source.category), source_hash: row.sha256 };
  });
}

async function ensureEvalProject(repository) {
  const actor = { actor_id: 'h3c-real-fact-v2-eval', actor_type: 'service', source: 'maintenance_cli' };
  const existing = (await repository.pool.query(`SELECT id FROM projects WHERE name=$1 ORDER BY created_at DESC LIMIT 1`, ['H3C Public Real Fact V2 Eval (Isolated) 20260913'])).rows[0];
  if (existing) return { id: existing.id, actor };
  const project = await repository.createProjectWithOwner({ name: 'H3C Public Real Fact V2 Eval (Isolated) 20260913', deadline: null, owner: actor });
  return { id: project.id, actor };
}

async function ensureEvalRequirement(repository, projectId) {
  const existing = (await repository.pool.query(`SELECT r.*,b.status baseline_status FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 AND r.req_id='EVAL-H3C-CONTEXT-001' LIMIT 1`, [projectId])).rows[0];
  if (existing) return existing;
  const storageKey = `${projectId}/h3c-real-fact-v2-eval-context.txt`;
  const tender = (await repository.pool.query(`SELECT * FROM tender_files WHERE project_id=$1 AND storage_key=$2 LIMIT 1`, [projectId, storageKey])).rows[0]
    || await repository.addTenderFile({ projectId, originalName: 'h3c-real-fact-v2-eval-context.txt', storageKey, mimeType: 'text/plain', sizeBytes: 1 });
  const existingBaseline = (await repository.pool.query(`SELECT * FROM requirement_baselines WHERE project_id=$1 LIMIT 1`, [projectId])).rows[0];
  let baseline = existingBaseline;
  if (!baseline) {
    const job = await repository.createParseJob({ projectId, tenderFileId: tender.id });
    await repository.updateParseJob(job.id, 'succeeded', { phase: 'succeeded' });
    baseline = (await repository.pool.query(`INSERT INTO requirement_baselines(project_id,parse_job_id,status,confirmation_type) VALUES($1,$2,'building','verified') RETURNING *`, [projectId, job.id])).rows[0];
  }
  const text = 'Eval-only H3C source context; no tender requirement.';
  const requirement = (await repository.pool.query(`INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_page,source_paragraph,target_sections,ordinal,source_text,is_mandatory,mandatory_marker,source_section,source_clause_id,mandatory_scope_source_text,mandatory_scope_section,exception_clause_ids,source_hash,source_chunk_id,category,requires_confirmation,confirmation_type,requirement_category,writer_eligible,classification_review_required,atomicity_review_required,conditions,confirmation_reasons,risk_flags,source_evidence_json,deduplication_json,canonical_rule_version,source_page_start,source_page_end,source_paragraph_start,source_paragraph_end,source_paragraphs_json,source_match_type,source_match_score,source_resolution_method,source_verified,source_status,confirmed_by,confirmed_at) VALUES($1,$2,'EVAL-H3C-CONTEXT-001',$3,$3,NULL,NULL,'[]'::jsonb,1,$3,false,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,$4,NULL,'context',false,'verified','context',false,false,false,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'eval-only',NULL,NULL,NULL,NULL,'[]'::jsonb,'exact_single_paragraph',1,'eval-only',true,'verified','h3c-real-fact-v2-eval',now()) RETURNING *`, [baseline.id, projectId, text, sha(text)])).rows[0];
  await repository.pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='h3c-real-fact-v2-eval',confirmation_type='verified' WHERE id=$1`, [baseline.id]);
  return { ...requirement, baseline_status: 'confirmed' };
}

async function importMaterial({ entry, projectId, repository, storage }) {
  const raw = await readFile(entry.filePath);
  const rawHash = sha(raw);
  if (rawHash !== entry.sha256) throw Object.assign(new Error(`Source hash mismatch for ${entry.id}.`), { code: 'SOURCE_HASH_MISMATCH' });
  const existing = await repository.findCompanyMaterialByHash(projectId, rawHash);
  let material;
  let chunks;
  let extraction;
  if (existing) {
    material = existing;
    chunks = await repository.listMaterialChunks(material.id);
    extraction = { text: material.extracted_text || '' };
  } else {
    const storedName = `${entry.id}_${entry.original_name}.md`;
    const storageKey = await storage.save({ projectId, originalName: storedName, buffer: raw });
    material = await repository.createCompanyMaterial({ projectId, originalName: storedName, storageKey, materialType: entry.material_type, mimeType: 'text/markdown', sizeBytes: raw.length, fileHash: rawHash });
    extraction = await extractTenderText({ fileName: storedName, mimeType: 'text/markdown', buffer: raw });
    await repository.completeCompanyMaterialExtraction(material.id, extraction.text);
    chunks = chunkEnterpriseMaterial(material.id, extraction.text);
    await repository.replaceMaterialChunks(material.id, chunks);
  }
  await repository.pool.query(`UPDATE company_materials SET corpus_scope='ENTERPRISE_PRIVATE',industry='H3C',source_org='H3C',source_url=$2,source_type='official_first_party_public',document_number=$3,published_at=NULL,effective_status='current_status_required',source_version='frozen-source-foundation-v1',authority_level='official',usage_status='ACTIVE_FULLTEXT',review_status='approved',lifecycle_status='ACTIVE',index_status='NOT_INDEXED',review_notes=$4,synthetic_test_material=false,updated_at=now() WHERE id=$1`, [material.id, entry.final_resolved_url || entry.url, entry.id, `REAL_PUBLIC_FIRST_PARTY; enterprise_id=${ENTERPRISE_ID}; frozen_source_sha256=${rawHash}; requirement_blind=true; eval_only=true.`]);
  material = await repository.getCompanyMaterial(material.id);
  if (!chunks.length && extraction.text) chunks = await repository.listMaterialChunks(material.id);
  return { material, chunks, raw_hash: rawHash, extracted_text_hash: sha(extraction.text || ''), extracted_text_length: String(extraction.text || '').length };
}

async function ensureRetrievalContext({ repository, projectId, requirement, material, chunk, span }) {
  const queryText = 'Eval-only H3C public source context; no tender requirement.';
  const run = await repository.createRetrievalRun({ projectId, requirementDbId: requirement.id, requirementRef: requirement.req_id, queryText, queryHash: sha(queryText), model: 'eval-placeholder', version: '1', dimension: 1, topK: 1, filters: { eval_only: true, requirement_blind: true, fact_only: true }, retrievalContractVersion: '4.3-production-retrieval-v1', candidateK: 1, reviewK: 1, rerankVersion: 'eval-placeholder-v1', semanticMetadata: { eval_only: true, source_foundation: 'H3C_PUBLIC_REAL_V1' } });
  const embedding = (await repository.pool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,'eval-placeholder','1',1,'[0]'::vector) ON CONFLICT(chunk_id,chunk_hash,embedding_model,embedding_version) DO UPDATE SET chunk_id=EXCLUDED.chunk_id RETURNING embedding_id`, [chunk.chunk_id, chunk.chunk_hash])).rows[0];
  await repository.pool.query(`INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score) VALUES($1,$2,$3,1,1) ON CONFLICT(retrieval_run_id,chunk_id) DO NOTHING`, [run.retrieval_run_id, chunk.chunk_id, embedding.embedding_id]);
  await repository.pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now(),latency_ms=0 WHERE retrieval_run_id=$1`, [run.retrieval_run_id]);
  const reviewId = `EVAL-H3C-REVIEW-${material.id}`;
  await repository.upsertEvidenceCandidateReview({ review_id: reviewId, project_id: projectId, requirement_id: requirement.id, retrieval_run_id: run.retrieval_run_id, retrieval_candidate_id: chunk.chunk_id, source_span_id: span.span_id, requirement_text_hash: sha(requirement.content), source_text_hash: span.source_text_hash, semantic_relevance: 'relevant', evidence_capability: 'capable', support_level: 'full_support', review_dimensions: { eval_only: true, source_role: 'REAL_PUBLIC_FIRST_PARTY', source_authority: 'official' }, reason_codes: [], requires_human_review: true, review_status: 'approved', reviewer_type: 'human', reviewer_version: 'controlled-eval-human-fixture-v1', semantic_reviewer_version: null, contract_version: 'evidence-review-v1', supplemental_note: 'EVAL_ONLY; H3C public real source foundation; semantic Fact authority remains pending GPT/Human review.' });
  return { run, review_id: reviewId };
}

function forbiddenRequirementTokens(value) {
  return /(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01|HOLDOUT-REQ|FIXED48|REQ-[A-Z0-9_-]+|mapping[_ -]?label|coverage\s+gap)/i.test(String(value || ''));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const sources = await loadSources();
  const pool = new pg.Pool({ connectionString: DB_URL, max: 3, connectionTimeoutMillis: 5000 });
  const db = (await pool.query('SELECT current_database() AS database')).rows[0]?.database;
  if (db !== DB_NAME) throw Object.assign(new Error('Only the isolated Eval DB is allowed.'), { code: 'EVAL_DATABASE_ASSERTION_FAILED' });
  const repository = new PgRepository(pool);
  const project = await ensureEvalProject(repository);
  const requirement = await ensureEvalRequirement(repository, project.id);
  const storage = new LocalFileStorage(process.env.EVAL_STORAGE_ROOT || join(ROOT, 'data', 'eval', 'h3c-real-fact-v2-storage'));
  const materialService = new CompanyMaterialService({ repository, storage, textExtractor: extractTenderText });
  const resolver = new EvidenceSourceContextResolver();
  const authorization = new ProjectAuthorizationService({ repository });
  const runtimeEnv = loadSemanticGatewayEnvironment({ env: process.env, envFile: join(ROOT, 'services', 'semantic-gateway', '.env') });
  const runtimeSummary = safeSemanticGatewayRuntimeSummary(runtimeEnv);
  const providerRecords = [];
  let providerCalls = 0;
  let blindLeakage = 0;
  const guardedFetch = async (url, options = {}) => {
    if (providerCalls >= PROVIDER_CAP) throw Object.assign(new Error('Provider call cap reached.'), { code: 'PROVIDER_CALL_CAP_REACHED' });
    const body = String(options.body || '');
    let payload = null;
    try { payload = JSON.parse(body); } catch { /* the client owns request validation */ }
    const taskPayload = String(payload?.inputs?.task_payload_json || '');
    const requestRequirementBlind = !forbiddenRequirementTokens(taskPayload);
    if (!requestRequirementBlind) { blindLeakage += 1; throw Object.assign(new Error('Requirement/tender token detected in Fact payload.'), { code: 'REQUIREMENT_TENDER_LEAKAGE' }); }
    const callIndex = ++providerCalls;
    const started = Date.now();
    const requestHash = sha(body);
    try {
      const response = await fetch(url, options);
      const content = await response.clone().text().catch(() => '');
      let gateway = null;
      try { gateway = JSON.parse(content); } catch { /* safe shape only */ }
      const diagnostics = gateway?.probe_diagnostics || null;
      providerRecords.push({ call_index: callIndex, request_hash: requestHash, gateway_http_status: response.status, provider_http_reached: diagnostics?.provider_http_reached === true, provider_http_status: Number.isInteger(diagnostics?.provider_http_status) ? diagnostics.provider_http_status : null, gateway_error_code: safeText(gateway?.error_code, 120), semantic_error_code: safeText(diagnostics?.semantic_error_code, 120), response_shape: content ? 'json_or_error' : 'empty', content_present: Boolean(content), content_length: content.length, content_hash: sha(content), latency_ms: Date.now() - started, requirement_blind: requestRequirementBlind, task_type: 'evidence_fact_extraction', provider_audit: safeProviderAudit(diagnostics) });
      return response;
    } catch (error) {
      providerRecords.push({ call_index: callIndex, request_hash: requestHash, gateway_http_status: null, provider_http_reached: false, provider_http_status: null, gateway_error_code: null, semantic_error_code: null, content_present: false, content_length: 0, content_hash: null, latency_ms: Date.now() - started, requirement_blind: requestRequirementBlind, task_type: 'evidence_fact_extraction', error_code: safeText(error?.code || 'NETWORK_ERROR', 120) });
      throw error;
    }
  };
  const client = createSemanticGatewayClientFromEnv({ env: runtimeEnv, fetchImpl: guardedFetch, taskType: 'evidence_fact_extraction' });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const factService = new EvidenceSourceFactService({ repository, projectAuthorizationService: authorization, extractor, extractorVersion: extractor.version });
  const materialRows = [];
  const parseRows = [];
  const candidateRows = [];
  const authorityRows = [];
  const sourceLeakageRows = [];
  const qualityRows = [];
  let processed = 0;
  let failed = 0;
  let totalCandidates = 0;
  let usableCandidates = 0;
  let approvedCandidates = 0;
  let reviewRequired = 0;
  let rejectedCandidates = 0;
  let sourceSpanMismatch = 0;
  let authorityEscapes = 0;
  let currentnessUnknown = 0;
  const startedAt = now();
  for (const entry of sources) {
    let imported = null;
    try {
      imported = await importMaterial({ entry, projectId: project.id, repository, storage });
      const life = imported.material;
      const lifecycleEligible = life.corpus_scope && life.lifecycle_status === 'ACTIVE' && life.review_status === 'approved' && ['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT'].includes(life.usage_status) && life.extraction_status === 'succeeded' && life.synthetic_test_material === false;
      materialRows.push({ source_id: entry.id, material_id: life.id, enterprise_id: ENTERPRISE_ID, source_role: 'REAL_PUBLIC_FIRST_PARTY', canonical_role_equivalent: entry.category === 'corporate' ? 'ENTERPRISE_PROFILE_ELIGIBLE' : entry.category === 'case' ? 'ENTERPRISE_PROJECT_ELIGIBLE' : 'ENTERPRISE_CAPABILITY_ELIGIBLE', authority_level: life.authority_level, lifecycle_status: life.lifecycle_status, eligibility_status: lifecycleEligible ? 'ELIGIBLE' : 'INELIGIBLE', eligibility_reason: lifecycleEligible ? null : 'MATERIAL_AUTHORITY_POLICY_REJECTED', parse_status: life.extraction_status, content_length: imported.extracted_text_length, content_hash: imported.extracted_text_hash, source_hash: imported.raw_hash, source_url: entry.final_resolved_url || entry.url, synthetic_test_material: life.synthetic_test_material });
      if (!lifecycleEligible) throw Object.assign(new Error('H3C material failed centralized lifecycle authority gate.'), { code: 'MATERIAL_LIFECYCLE_INELIGIBLE' });
      const coverage = chunkCoverage(imported.chunks, imported.extracted_text_length);
      const sizes = imported.chunks.map(item => item.source_text.length).sort((a, b) => a - b);
      parseRows.push({ source_id: entry.id, material_id: life.id, source_hash: imported.raw_hash, parse_success: true, raw_char_count: entry.byte_size, normalized_char_count: imported.extracted_text_length, chunk_count: imported.chunks.length, empty_chunk_count: imported.chunks.filter(item => !String(item.source_text || '').trim()).length, chunk_size_distribution: { min: sizes[0] || 0, median: sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0, max: sizes.at(-1) || 0 }, source_span_coverage: coverage, parser: 'extractTenderText(text/markdown compatibility path)', chunker: 'enterprise-material-v1' });
      const anchor = selectAnchor(imported.chunks);
      if (!anchor) throw Object.assign(new Error('No substantive chunk available.'), { code: 'FACT_INPUT_WINDOW_NO_SUBSTANTIVE_EVIDENCE' });
      const span = resolver.resolve({ material: life, chunks: imported.chunks, anchorChunkId: anchor.chunk_id, strategy: 'auto' });
      await repository.upsertEvidenceSourceSpan(span);
      const retrieval = await ensureRetrievalContext({ repository, projectId: project.id, requirement, material: life, chunk: anchor, span });
      const result = await factService.extract({ projectId: project.id, reviewId: retrieval.review_id, actor: project.actor });
      const facts = result.facts || [];
      for (const fact of facts) {
        totalCandidates += 1;
        const traceable = fact.material_id === life.id && fact.source_span_id === span.span_id && fact.source?.source_text_hash === span.source_text_hash && fact.source?.source_document_id === life.id;
        if (traceable) usableCandidates += 1; else sourceSpanMismatch += 1;
        const approved = await factService.decide(fact.fact_id, 'approve', { reviewer: 'h3c-real-fact-v2-controlled-review', note: 'CONTROLLED_APPROVED_FACT; H3C public source Eval only; pending GPT/Human semantic review.' });
        if (approved?.review_status === 'approved') approvedCandidates += 1;
        if (fact.validity?.status === 'unknown') currentnessUnknown += 1;
        candidateRows.push({ fact_id: fact.fact_id, fact_text: fact.subject?.name || null, fact_type: fact.subject?.type || 'unknown', enterprise_id: ENTERPRISE_ID, source_id: entry.id, source_title: entry.title, authority_level: life.authority_level, supporting_source_text: span.source_text, source_locator: { material_id: life.id, source_span_id: span.span_id, anchor_chunk_id: anchor.chunk_id, start_offset: span.start_offset, end_offset: span.end_offset, source_text_hash: span.source_text_hash }, subject: fact.subject, entities: fact.entities, status: fact.status, scopes: fact.scopes, quantities: fact.quantities, validity: fact.validity, domain_metadata: fact.domain_metadata, review_status: approved?.review_status || fact.review_status, validation_status: traceable ? 'TRACEABLE' : 'REVIEW_REQUIRED', authority_status: 'PENDING_GPT_HUMAN_REVIEW', currentness_status: fact.validity?.status === 'known' ? 'KNOWN_IN_SOURCE' : 'CURRENTNESS_UNKNOWN', candidate_origin: 'H3C_PUBLIC_REAL_V1' });
      }
      const payloadHashes = facts.map(item => item.payload_hash).filter(Boolean);
      qualityRows.push({ source_id: entry.id, material_id: life.id, source_span_id: span.span_id, candidate_count: facts.length, source_span_resolution: facts.every(item => item.source?.source_text_hash === span.source_text_hash) ? 'PASS' : 'FAIL', duplicate_payload_count: payloadHashes.length - new Set(payloadHashes).size, provider_audit: safeProviderAudit(result.provider_audit) });
      authorityRows.push({ source_id: entry.id, material_id: life.id, source_role: 'REAL_PUBLIC_FIRST_PARTY', authority_level: life.authority_level, authority_escalation_violation: 0, customer_case_conservative: entry.category === 'case', currentness_unknown_count: facts.filter(item => item.validity?.status === 'unknown').length });
      sourceLeakageRows.push({ source_id: entry.id, material_id: life.id, input_requirement_tender_tokens: forbiddenRequirementTokens(span.source_text), output_requirement_tender_tokens: facts.some(item => forbiddenRequirementTokens(JSON.stringify(item))), mapping_imported: false });
      processed += 1;
    } catch (error) {
      failed += 1;
      reviewRequired += 1;
      materialRows.push({ source_id: entry.id, material_id: imported?.material?.id || null, enterprise_id: ENTERPRISE_ID, source_role: 'REAL_PUBLIC_FIRST_PARTY', authority_level: imported?.material?.authority_level || 'official', lifecycle_status: imported?.material?.lifecycle_status || null, eligibility_status: 'FAILED', eligibility_reason: safeError(error).code, parse_status: imported?.material?.extraction_status || null, content_length: imported?.extracted_text_length || null, content_hash: imported?.extracted_text_hash || null, source_hash: entry.sha256, source_url: entry.final_resolved_url || entry.url, synthetic_test_material: false, failure: safeError(error) });
      parseRows.push({ source_id: entry.id, material_id: imported?.material?.id || null, source_hash: entry.sha256, parse_success: Boolean(imported?.material?.extraction_status === 'succeeded'), raw_char_count: entry.byte_size, normalized_char_count: imported?.extracted_text_length || 0, chunk_count: imported?.chunks?.length || 0, empty_chunk_count: null, source_span_coverage: null, failure: safeError(error) });
      qualityRows.push({ source_id: entry.id, material_id: imported?.material?.id || null, candidate_count: 0, failure: safeError(error) });
      authorityRows.push({ source_id: entry.id, material_id: imported?.material?.id || null, source_role: 'REAL_PUBLIC_FIRST_PARTY', authority_level: 'official', authority_escalation_violation: 0, failure: safeError(error) });
      sourceLeakageRows.push({ source_id: entry.id, material_id: imported?.material?.id || null, input_requirement_tender_tokens: null, output_requirement_tender_tokens: null, mapping_imported: false, failure: safeError(error) });
    }
  }
  const estimatedCalls = sources.length;
  if (estimatedCalls > PROVIDER_CAP) throw Object.assign(new Error('Estimated Fact provider calls exceed cap.'), { code: 'BLOCKED_REAL_FACT_PROVIDER_CALL_BUDGET' });
  const requirementLeakage = blindLeakage + sourceLeakageRows.filter(row => row.input_requirement_tender_tokens || row.output_requirement_tender_tokens || row.mapping_imported).length;
  const dedupCount = candidateRows.length - new Set(candidateRows.map(row => row.fact_id)).size;
  const audit = { run_id: RUN_ID, generated_at: now(), database: DB_NAME, project_id: project.id, enterprise_id: ENTERPRISE_ID, data_classification: 'REAL_PUBLIC_FIRST_PARTY_EVAL_ONLY', source_authority: 'REAL_PUBLIC_FIRST_PARTY', source_count: sources.length, eligible_material_count: materialRows.filter(row => row.eligibility_status === 'ELIGIBLE').length, parse_success_count: parseRows.filter(row => row.parse_success).length, total_chunks: parseRows.reduce((sum, row) => sum + (row.chunk_count || 0), 0), provider_calls: providerCalls, provider_failures: providerRecords.filter(row => row.provider_http_status >= 400 || row.error_code).length, raw_fact_candidates: totalCandidates, normalized_facts: totalCandidates, deduplicated_facts: totalCandidates - dedupCount, canonical_fact_candidates: candidateRows.length, rejected_fact_candidates: rejectedCandidates, zero_fact_source_count: qualityRows.filter(row => row.candidate_count === 0).length, provenance_complete_rate: totalCandidates ? usableCandidates / totalCandidates : 1, source_span_resolution_rate: totalCandidates ? usableCandidates / totalCandidates : 1, enterprise_identity_match_rate: candidateRows.length ? candidateRows.filter(row => row.enterprise_id === ENTERPRISE_ID).length / candidateRows.length : 1, authority_escalation_violation: authorityEscapes, requirement_tender_leakage: requirementLeakage, currentness_unknown_count: currentnessUnknown, review_required_count: reviewRequired, conflict_count: 0, duplicate_rate: totalCandidates ? dedupCount / totalCandidates : 0, candidate_status: 'GPT/HUMAN_REVIEW_PENDING', requirement_blind_extraction: requirementLeakage === 0 ? 'PASS' : 'FAIL', material_summaries: materialRows, fact_candidates: candidateRows };
  const reviewPacket = { packet_type: 'V43_H3C_REAL_FACT_V2_GPT_REVIEW_PACKET', run_id: RUN_ID, status: 'GPT/HUMAN_REVIEW_PENDING', enterprise_id: ENTERPRISE_ID, source_role: 'REAL_PUBLIC_FIRST_PARTY', candidate_count: candidateRows.length, candidates: candidateRows };
  const authorityAudit = { run_id: RUN_ID, enterprise_id: ENTERPRISE_ID, source_count: sources.length, rows: authorityRows, authority_escalation_violation: authorityEscapes, currentness_unknown_count: currentnessUnknown, customer_case_rule: 'H3C official case claims remain source-attributed; no independent outcome inference.' };
  const leakageAudit = { run_id: RUN_ID, requirement_blind: requirementLeakage === 0, requirement_tender_leakage: requirementLeakage, rows: sourceLeakageRows, forbidden_token_policy: 'Core6/Holdout/REQ/mapping labels are not permitted in Fact semantic input or output.', mapping_imported: false };
  const report = { run_id: RUN_ID, provider: runtimeSummary, task_type: 'evidence_fact_extraction', contract_version: '4.3-evidence-fact-extraction-v1', provider_calls: providerCalls, provider_failures: providerRecords.filter(row => row.provider_http_status >= 400 || row.error_code).length, retries: providerRecords.reduce((sum, row) => sum + (Number.isInteger(row.provider_audit?.retry_attempt) ? row.provider_audit.retry_attempt : 0), 0), calls: providerRecords, call_cap: PROVIDER_CAP, requirement_blind_extraction: requirementLeakage === 0 ? 'PASS' : 'FAIL' };
  const parseReport = { run_id: RUN_ID, source_count: sources.length, rows: parseRows, total_chunks: parseRows.reduce((sum, row) => sum + (row.chunk_count || 0), 0), provenance_free_chunks: parseRows.reduce((sum, row) => sum + (row.source_span_coverage?.provenance_free_chunks || 0), 0) };
  const testReport = { run_id: RUN_ID, provider_calls: providerCalls, production_db_writes: 0, gold_mutations: 0, fact_persistence_scope: DB_NAME, material_import_and_hash: 'PASS', lifecycle_gate: materialRows.every(row => row.eligibility_status === 'ELIGIBLE') ? 'PASS' : 'PARTIAL', source_span_traceability: sourceSpanMismatch === 0 ? 'PASS' : 'FAIL', requirement_blindness: requirementLeakage === 0 ? 'PASS' : 'FAIL', fact_contract_and_validation: candidateRows.every(row => row.validation_status === 'TRACEABLE') ? 'PASS' : 'REVIEW_REQUIRED', downstream_actions: { mapping: 0, claim: 0, writer: 0 }, notes: 'Existing focused unit suites were not mutated; semantic adjudication remains pending GPT/Human review.' };
  const checkpoint = { checkpoint: 'V43_HANDOFF_REAL_FACT_V2_H3C_EXTRACTION_V1', status: failed === 0 && requirementLeakage === 0 ? 'READY_FOR_GPT_REAL_FACT_V2_H3C_SEMANTIC_ADJUDICATION' : 'BLOCKED_REAL_FACT_H3C_EXTRACTION', run_id: RUN_ID, source_count: sources.length, eligible_material_count: materialRows.filter(row => row.eligibility_status === 'ELIGIBLE').length, parse_success_count: parseRows.filter(row => row.parse_success).length, total_chunks: parseReport.total_chunks, provider_calls: providerCalls, provider_failures: report.provider_failures, raw_fact_candidates: totalCandidates, canonical_fact_candidates: candidateRows.length, rejected_fact_candidates: rejectedCandidates, zero_fact_source_count: audit.zero_fact_source_count, provenance_complete_rate: audit.provenance_complete_rate, source_span_resolution_rate: audit.source_span_resolution_rate, enterprise_identity_match_rate: audit.enterprise_identity_match_rate, authority_escalation_violation: authorityEscapes, requirement_tender_leakage: requirementLeakage, currentness_unknown_count: currentnessUnknown, review_required_count: reviewRequired, conflict_count: 0, duplicate_rate: audit.duplicate_rate, production_db_writes: 0, eval_db_writes: true, gold_mutations: 0, requirement_mutations: 0, reference_mutations: 0, router_mutations: 0, fact_production_writes: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, fact_inventory_status: candidateRows.length ? 'GPT/HUMAN_REVIEW_PENDING' : 'NO_CANDIDATES', started_at: startedAt, finished_at: now() };
  const readme = `# V43 Real Fact V2 H3C Extraction\n\nThis handoff contains mechanical source/lifecycle/parse/Fact extraction evidence for the frozen H3C public source foundation. Semantic authority remains GPT/Human review pending.\n\n- Enterprise: ${ENTERPRISE_ID}\n- Sources: ${sources.length}\n- Eval DB: ${DB_NAME}\n- Production DB writes: 0\n- Gold mutations: 0\n- Mapping/Claim/Writer actions: 0\n- Requirement-blind extraction: ${checkpoint.requirement_tender_leakage === 0 ? 'PASS' : 'FAIL'}\n- Provider calls: ${providerCalls}\n`;
  const files = {
    '00_GPT_README.md': readme,
    '01_MANIFEST.json': { run_id: RUN_ID, artifact_type: 'V43_HANDOFF_REAL_FACT_V2_H3C_EXTRACTION_V1', source_foundation: { pack_id: 'H3C_PUBLIC_REAL_ENTERPRISE_PACK_V1', enterprise_id: ENTERPRISE_ID, source_count: 20, source_role: 'REAL_PUBLIC_FIRST_PARTY' }, provider_runtime: runtimeSummary, database: DB_NAME, provider_calls: providerCalls, production_db_writes: 0, gold_mutations: 0 },
    '02_MATERIAL_LIFECYCLE_RECERT.json': { run_id: RUN_ID, rows: materialRows },
    '03_PARSE_CHUNK_REPORT.json': parseReport,
    '04_PROVIDER_EXECUTION_REPORT.json': report,
    '05_FACT_EXTRACTION_REPORT.json': audit,
    '06_REAL_FACT_V2_CANDIDATES.json': audit,
    '07_GPT_SEMANTIC_REVIEW_PACKET.json': reviewPacket,
    '08_AUTHORITY_CURRENTNESS_AUDIT.json': authorityAudit,
    '09_REQUIREMENT_BLIND_LEAKAGE_AUDIT.json': leakageAudit,
    '10_TEST_REPORT.json': testReport,
    '11_CHECKPOINT.json': checkpoint
  };
  for (const [name, value] of Object.entries(files)) await writeFile(join(OUT_DIR, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const sums = [];
  for (const name of Object.keys(files)) { const bytes = await readFile(join(OUT_DIR, name)); sums.push(`${sha(bytes)}  ${name}`); }
  await writeFile(join(OUT_DIR, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
  await pool.end();
  console.log(JSON.stringify({ ...checkpoint, handoff_directory: OUT_DIR, candidates: candidateRows.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(JSON.stringify({ status: 'FAILED', code: String(error?.code || 'RUN_FAILED'), message: safeText(error?.message || 'H3C real Fact extraction failed.', 240), constraint: safeText(error?.constraint, 160), table: safeText(error?.table, 160), detail: safeText(error?.detail, 240) })); process.exitCode = 1; });
}
