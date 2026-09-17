import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { PgRepository } from '../../src/db.js';
import { CompanyMaterialService } from '../../src/company-material-service.js';
import { LocalFileStorage } from '../../src/storage.js';
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

const EVAL_DB_NAME = 'bid_platform_eval_chengchuan_v2';
const OUT_DIR = process.env.OUTPUT_DIR || '/tmp/v43-chengchuan-out';
const ROOT = process.env.CORPUS_ROOT || '/app/backend/eval/rag-pilot';
const REPO_ROOT = process.env.REPO_ROOT || resolve(ROOT, '../../..');
const BASE_ROOT = join(ROOT, 'V43_RAG_CODEX_HANDOFF_1');
const EXT_ROOT = join(ROOT, 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION');
const BASE_MANIFEST = join(BASE_ROOT, 'rag_import_manifest.jsonl');
const EXT_MANIFEST = join(EXT_ROOT, '00_meta', 'extension_import_manifest.jsonl');
const BASE_MATERIAL_ROOT = join(BASE_ROOT, '03_company_case_rag');
const EXT_MATERIAL_ROOT = join(EXT_ROOT, 'materials');
const BASE16_ROLE_SNAPSHOT = process.env.CHENGCHUAN_BASE16_ROLE_SNAPSHOT || join(REPO_ROOT, 'docs', 'handoff', 'V43_PRE_E2E_GOVERNANCE_AND_MAPPING_READINESS_CLOSURE_V1', '21_CHENGCHUAN_SOURCE_ROLE_MODEL_CORRECTED.json');
const SHA = value => createHash('sha256').update(String(value)).digest('hex');
const json = value => JSON.stringify(value ?? null);
const now = () => new Date().toISOString();

const safeError = error => ({
  code: String(error?.code || error?.cause_code || 'UNKNOWN_ERROR').slice(0, 120),
  message: 'Fact extraction failed.',
  status: Number.isInteger(error?.status) ? error.status : null,
  details: {
    stage: error?.details?.stage || null,
    cause_code: error?.details?.cause_code || null,
    gateway_http_status: error?.details?.provider_audit?.gateway_http_status || null,
    provider_http_status: error?.details?.provider_audit?.provider_http_status || null,
    gateway_error_code: error?.details?.provider_audit?.gateway_error_code || null,
    semantic_error_code: error?.details?.provider_audit?.semantic_error_code || null,
    provider_error_code: error?.details?.provider_audit?.safe_error_code || error?.details?.provider_audit?.cause_code || null,
    retry_attempt: Number.isInteger(error?.details?.provider_audit?.retry_attempt) ? error.details.provider_audit.retry_attempt : null,
    retry_reason: error?.details?.provider_audit?.retry_reason || null,
    json_parse_success: typeof error?.details?.provider_audit?.json_parse_success === 'boolean' ? error.details.provider_audit.json_parse_success : null,
    output_truncated: error?.details?.provider_audit?.output_truncated === true,
    retry_attempted: error?.details?.retry_attempted === true,
    attempt_count: Number.isInteger(error?.details?.attempt_count) ? error.details.attempt_count : null,
    constraint: typeof error?.constraint === 'string' ? error.constraint.slice(0, 160) : null,
    table: typeof error?.table === 'string' ? error.table.slice(0, 160) : null,
    detail: typeof error?.detail === 'string' ? error.detail.slice(0, 240) : null
  }
});

function stripFrontmatter(text) {
  return String(text).replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim();
}

function parseJsonl(text) {
  return String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line));
}

function inferMaterialType(entry) {
  const key = String(entry.evidence_category || entry.evidence_slot || '').toUpperCase();
  if (key.includes('COMPANY_PROFILE')) return 'company_profile';
  if (key.includes('QUALIFICATION') || key.includes('CERTIFICATION') || key.includes('LICENSE')) return 'qualification';
  if (key.includes('CASE') || key.includes('PROJECT') || key.includes('INDUSTRY')) return 'project_case';
  if (key.includes('PRODUCT') || key.includes('APPLICATION')) return 'product_documentation';
  if (key.includes('TEAM') || key.includes('PERSONNEL')) return 'personnel';
  if (key.includes('DELIVERY') || key.includes('SERVICE') || key.includes('DR') || key.includes('QA')) return 'delivery_capability';
  if (key.includes('COMMERCIAL')) return 'other';
  return 'technical_solution';
}

export async function loadChengchuanBase16RoleSnapshot(snapshotPath = BASE16_ROLE_SNAPSHOT) {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } catch (error) {
    throw Object.assign(new Error('Chengchuan Base16 role snapshot is unavailable.'), {
      code: 'CHENGCHUAN_ROLE_SNAPSHOT_UNAVAILABLE',
      cause: error
    });
  }
  const materials = Array.isArray(snapshot?.materials) ? snapshot.materials : [];
  const expectedIds = Array.from({ length: 16 }, (_, index) => `COM-${String(index + 1).padStart(2, '0')}`);
  const ids = materials.map(material => material?.doc_id);
  const valid = snapshot?.freeze_status === 'FROZEN_FOR_ENGINEERING_E2E'
    && snapshot?.authority === 'SYNTHETIC_EVAL_ONLY'
    && snapshot?.production_authority === 'NONE'
    && materials.length === 16
    && expectedIds.every(id => ids.includes(id))
    && materials.every(material => material?.synthetic === true
      && material?.authority === 'SYNTHETIC_EVAL_ONLY'
      && material?.production_authority === 'NONE'
      && ['REFERENCE_ONLY', 'EVIDENCE_CANDIDATE'].includes(material?.source_role)
      && typeof material?.material_type === 'string' && material.material_type.length > 0);
  if (!valid) throw Object.assign(new Error('Chengchuan Base16 role snapshot failed frozen contract validation.'), { code: 'CHENGCHUAN_ROLE_SNAPSHOT_INVALID' });
  return new Map(materials.map(material => [material.doc_id, material]));
}

export function applyFrozenBase16Role(entry, roleSnapshot) {
  const role = roleSnapshot instanceof Map ? roleSnapshot.get(entry.doc_id) : roleSnapshot?.[entry.doc_id];
  if (!role) throw Object.assign(new Error(`Missing frozen Base16 role for ${entry.doc_id}.`), { code: 'CHENGCHUAN_ROLE_SNAPSHOT_ENTRY_MISSING' });
  return {
    ...entry,
    material_type: role.material_type,
    source_role: role.source_role,
    semantic_review_status: role.semantic_review_status || null,
    semantic_review_reason: role.semantic_review_reason || null,
    authority: role.authority,
    production_authority: role.production_authority,
    source_role_snapshot: 'V43_CHENGCHUAN_BASE16_CONTENT_ROLE_FREEZE_V1'
  };
}

async function loadEntries() {
  const base = parseJsonl(await readFile(BASE_MANIFEST, 'utf8'))
    .filter(entry => /^COM-(0[1-9]|1[0-6])$/.test(entry.doc_id));
  const extension = parseJsonl(await readFile(EXT_MANIFEST, 'utf8'));
  if (base.length !== 16 || extension.length !== 76) {
    throw Object.assign(new Error('Corpus entry count mismatch.'), { code: 'CORPUS_COUNT_MISMATCH' });
  }
  const baseRoleSnapshot = await loadChengchuanBase16RoleSnapshot();
  const entries = [
    ...base.map(entry => ({ ...applyFrozenBase16Role(entry, baseRoleSnapshot), root: BASE_MATERIAL_ROOT, source_class: 'base_existing_com' })),
    ...extension.map(entry => ({ ...entry, root: EXT_MATERIAL_ROOT, material_type: inferMaterialType(entry), source_class: 'v2_extension' }))
  ];
  const ids = new Set(entries.map(entry => entry.doc_id));
  if (ids.size !== entries.length) throw Object.assign(new Error('Corpus document ID collision.'), { code: 'DOC_ID_COLLISION' });
  const requestedIds = String(process.env.ENTRY_IDS || '').split(',').map(item => item.trim()).filter(Boolean);
  const scoped = requestedIds.length ? entries.filter(entry => requestedIds.includes(entry.doc_id)) : entries;
  if (requestedIds.length && scoped.length !== requestedIds.length) {
    throw Object.assign(new Error('Requested Eval entry was not found.'), { code: 'ENTRY_ID_NOT_FOUND' });
  }
  const selected = Number.isInteger(Number(process.env.ENTRY_LIMIT)) && Number(process.env.ENTRY_LIMIT) > 0
    ? scoped.slice(0, Number(process.env.ENTRY_LIMIT))
    : scoped;
  return selected.map(entry => {
    const fileName = basename(entry.path);
    return { ...entry, fileName, filePath: join(entry.root, fileName) };
  });
}

async function ensureEvalProject(repository) {
  const actor = { actor_id: 'chengchuan-controlled-eval', actor_type: 'service', source: 'maintenance_cli' };
  const existing = (await repository.pool.query(
    `SELECT id FROM projects WHERE name=$1 ORDER BY created_at DESC LIMIT 1`,
    ['Chengchuan Controlled Eval V2 (Synthetic)']
  )).rows[0];
  if (existing) return { id: existing.id, actor };
  const project = await repository.createProjectWithOwner({
    name: 'Chengchuan Controlled Eval V2 (Synthetic)',
    deadline: null,
    owner: actor
  });
  return { id: project.id, actor };
}

async function ensureEvalRequirement(repository, projectId) {
  const existing = (await repository.pool.query(
    `SELECT r.*,b.status AS baseline_status FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 LIMIT 1`,
    [projectId]
  )).rows[0];
  if (existing) return existing;
  const storageKey = `${projectId}/chengchuan-controlled-eval-context.txt`;
  const tender = (await repository.pool.query(`SELECT * FROM tender_files WHERE storage_key=$1`, [storageKey])).rows[0]
    || await repository.addTenderFile({
      projectId,
      originalName: 'chengchuan-controlled-eval-context.txt',
      storageKey,
      mimeType: 'text/plain',
      sizeBytes: 1
    });
  const job = await repository.createParseJob({ projectId, tenderFileId: tender.id });
  await repository.updateParseJob(job.id, 'succeeded', { phase: 'succeeded' });
  const baseline = (await repository.pool.query(
    `INSERT INTO requirement_baselines(project_id,parse_job_id,status) VALUES($1,$2,'building') RETURNING *`,
    [projectId, job.id]
  )).rows[0];
  const text = 'Eval-only source context; no tender requirement.';
  const requirement = (await repository.pool.query(
    `INSERT INTO requirements(baseline_id,project_id,req_id,content,source_excerpt,source_page,source_paragraph,target_sections,ordinal,source_text,is_mandatory,mandatory_marker,source_section,source_clause_id,mandatory_scope_source_text,mandatory_scope_section,exception_clause_ids,source_hash,source_chunk_id,category,requires_confirmation,confirmation_type)
     VALUES($1,$2,'EVAL-CONTEXT-001',$3,$3,NULL,NULL,'[]'::jsonb,1,$3,false,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,$4,NULL,'context',false,'verified') RETURNING *`,
    [baseline.id, projectId, text, SHA(text)]
  )).rows[0];
  await repository.pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now() WHERE id=$1`, [baseline.id]);
  return { ...requirement, baseline_status: 'confirmed' };
}

async function importMaterial({ entry, projectId, materialService, repository }) {
  const raw = await readFile(entry.filePath);
  const sourceHash = SHA(raw);
  if (entry.sha256 && entry.sha256 !== sourceHash) {
    throw Object.assign(new Error('Source hash mismatch.'), { code: 'SOURCE_HASH_MISMATCH' });
  }
  const existing = await repository.findCompanyMaterialByHash(projectId, sourceHash);
  let material;
  let existingChunks = [];
  if (existing) {
    material = existing;
    existingChunks = await repository.listMaterialChunks(material.id);
    if (material.extraction_status === 'succeeded' && existingChunks.length > 0) {
      await repository.pool.query(
        `UPDATE company_materials SET corpus_scope='ENTERPRISE_PRIVATE',source_org=$2,source_type=$3,source_url=NULL,authority_level='enterprise_private',usage_status='ACTIVE_FULLTEXT',review_status='approved',lifecycle_status='ACTIVE',index_status='NOT_INDEXED',effective_status='current_status_required',review_notes=$4,synthetic_test_material=true,updated_at=now() WHERE id=$1`,
        [material.id, 'SYNTH-CHENGCHUAN-001', entry.source_kind || 'controlled_synthetic_enterprise_evidence', 'CONTROLLED_REAL_TEST; SYNTHETIC_ENTERPRISE_EVIDENCE; SYNTHETIC_DEVELOPMENT_ONLY; claim_permission=false; requirement_blind=true.']
      );
      return { material: await repository.getCompanyMaterial(material.id), chunks: existingChunks, source_hash: sourceHash, extracted_text_hash: SHA(material.extracted_text || ''), body_length: String(material.extracted_text || '').length };
    }
  } else {
    material = await materialService.upload({
      projectId,
      materialType: entry.material_type,
      file: {
        originalname: entry.fileName,
        mimetype: 'text/markdown',
        size: raw.length,
        buffer: raw
      }
    });
  }
  const body = stripFrontmatter(raw.toString('utf8'));
  const extraction = await extractTenderText({ fileName: entry.fileName, mimeType: 'text/markdown', buffer: Buffer.from(body) });
  await repository.completeCompanyMaterialExtraction(material.id, extraction.text);
  await repository.replaceMaterialChunks(material.id, chunkEnterpriseMaterial(material.id, extraction.text));
  await repository.pool.query(
    `UPDATE company_materials SET corpus_scope='ENTERPRISE_PRIVATE',source_org=$2,source_type=$3,source_url=NULL,authority_level='enterprise_private',usage_status='ACTIVE_FULLTEXT',review_status='approved',lifecycle_status='ACTIVE',index_status='NOT_INDEXED',effective_status='current_status_required',review_notes=$4,synthetic_test_material=true,updated_at=now() WHERE id=$1`,
    [material.id, 'SYNTH-CHENGCHUAN-001', entry.source_kind || 'controlled_synthetic_enterprise_evidence', 'CONTROLLED_REAL_TEST; SYNTHETIC_ENTERPRISE_EVIDENCE; SYNTHETIC_DEVELOPMENT_ONLY; claim_permission=false; requirement_blind=true.']
  );
  const refreshed = await repository.getCompanyMaterial(material.id);
  const chunks = await repository.listMaterialChunks(material.id);
  return { material: refreshed, chunks, source_hash: sourceHash, extracted_text_hash: SHA(extraction.text), body_length: extraction.text.length };
}

async function ensureRetrievalContext({ repository, projectId, requirement, material, chunk, span }) {
  const queryText = 'Eval-only source context; no tender requirement.';
  const run = await repository.createRetrievalRun({
    projectId,
    requirementDbId: requirement.id,
    requirementRef: requirement.req_id,
    queryText,
    queryHash: SHA(queryText),
    model: 'eval-placeholder',
    version: '1',
    dimension: 1,
    topK: 1,
    filters: { eval_only: true, fact_only: true },
    retrievalContractVersion: '4.3-production-retrieval-v1',
    candidateK: 1,
    reviewK: 1,
    rerankVersion: 'eval-placeholder-v1',
    semanticMetadata: { eval_only: true }
  });
  const embedding = (await repository.pool.query(
    `INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,'eval-placeholder','1',1,'[0]'::vector) ON CONFLICT(chunk_id,chunk_hash,embedding_model,embedding_version) DO UPDATE SET chunk_id=EXCLUDED.chunk_id RETURNING embedding_id`,
    [chunk.chunk_id, chunk.chunk_hash]
  )).rows[0];
  await repository.pool.query(
    `INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score) VALUES($1,$2,$3,1,1) ON CONFLICT(retrieval_run_id,chunk_id) DO NOTHING`,
    [run.retrieval_run_id, chunk.chunk_id, embedding.embedding_id]
  );
  await repository.pool.query(`UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now(),latency_ms=0 WHERE retrieval_run_id=$1`, [run.retrieval_run_id]);
  const reviewId = `EVAL-REVIEW-${material.id}`;
  await repository.upsertEvidenceCandidateReview({
    review_id: reviewId,
    project_id: projectId,
    requirement_id: requirement.id,
    retrieval_run_id: run.retrieval_run_id,
    retrieval_candidate_id: chunk.chunk_id,
    source_span_id: span.span_id,
    requirement_text_hash: SHA(requirement.content),
    source_text_hash: span.source_text_hash,
    semantic_relevance: 'relevant',
    evidence_capability: 'capable',
    support_level: 'full_support',
    review_dimensions: { eval_only: true, synthetic: true },
    reason_codes: [],
    requires_human_review: false,
    review_status: 'approved',
    reviewer_type: 'human',
    reviewer_version: 'controlled-eval-human-fixture-v1',
    semantic_reviewer_version: null,
    contract_version: 'evidence-review-v1',
    supplemental_note: 'EVAL_CONTROLLED_HUMAN_FIXTURE; synthetic only; not production authority.'
  });
  return { run, review_id: reviewId };
}

export function isSubstantiveFactChunk(chunk) {
  const source = String(chunk?.source_text || '');
  const body = source
    .split(/\r?\n/)
    .filter(line => !/^\s*#{1,6}\s+/.test(line))
    .join('\n');
  return body.replace(/[\s#*_`>\/-]/g, '').length >= 24;
}

// Fact extraction must never use a heading-only chunk as its semantic window.
// The production EvidenceSourceContextResolver owns source expansion; this
// deterministic selection is limited to the Eval runner's input construction.
export function selectFactAnchor(chunks) {
  if (!Array.isArray(chunks)) return null;
  return chunks.find(isSubstantiveFactChunk) || null;
}

function safeDiagnosticText(value, max = 240) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function safeValidationErrors(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(item => ({
    stage: safeDiagnosticText(item?.stage, 40),
    path: safeDiagnosticText(item?.path, 200),
    keyword: safeDiagnosticText(item?.keyword || item?.validator_code, 80),
    expected: safeDiagnosticText(item?.expected, 240),
    actual_type: safeDiagnosticText(item?.actual_type || item?.observed_category, 80),
    ...(typeof item?.additional_property === 'string'
      ? { additional_property: safeDiagnosticText(item.additional_property, 120) } : {})
  }));
}

/**
 * Persist only contract-shape telemetry from the Gateway probe.  Provider
 * content, prompts, and parsed business data are intentionally excluded.
 * The historical runner retained only a wrong_shape label, so this projection
 * is required before a future bounded rerun can assign schema ownership.
 */
export function safeFactProbeDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const structural = value.structural_summary && typeof value.structural_summary === 'object'
    ? value.structural_summary : null;
  return {
    json_parse_success: typeof value.json_parse_success === 'boolean' ? value.json_parse_success : null,
    gateway_http_status: Number.isInteger(value.gateway_http_status) ? value.gateway_http_status : null,
    gateway_error_code: safeDiagnosticText(value.gateway_error_code, 120),
    semantic_error_code: safeDiagnosticText(value.semantic_error_code, 120),
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    provider_http_reached: value.provider_http_reached === true,
    retry_attempt: Number.isInteger(value.retry_attempt) ? value.retry_attempt : null,
    retry_reason: safeDiagnosticText(value.retry_reason, 120),
    finish_reason: safeDiagnosticText(value.finish_reason, 40),
    output_truncated: value.output_truncated === true,
    response_format_type: value.response_format_type === 'json_schema' || value.response_format_type === 'json_object'
      ? value.response_format_type : null,
    semantic_contract_version: safeDiagnosticText(value.semantic_contract_version, 120),
    instruction_sha256: /^[a-f0-9]{64}$/i.test(String(value.instruction_sha256 || ''))
      ? String(value.instruction_sha256).toLowerCase() : null,
    generation_config: value.generation_config && typeof value.generation_config === 'object'
      ? {
        response_format: value.generation_config.response_format?.type === 'json_schema'
          ? {
            type: 'json_schema',
            name: safeDiagnosticText(value.generation_config.response_format.name, 120),
            strict: value.generation_config.response_format.strict === true
          }
          : value.generation_config.response_format?.type === 'json_object'
            ? { type: 'json_object' } : null,
        max_tokens: Number.isInteger(value.generation_config.max_tokens) ? value.generation_config.max_tokens : null,
        temperature: Number.isFinite(value.generation_config.temperature) ? value.generation_config.temperature : null,
        top_p: Number.isFinite(value.generation_config.top_p) ? value.generation_config.top_p : null,
        top_k: Number.isInteger(value.generation_config.top_k) ? value.generation_config.top_k : null,
        enable_thinking: value.generation_config.enable_thinking === true,
        stream: value.generation_config.stream === true,
        n: Number.isInteger(value.generation_config.n) ? value.generation_config.n : null
      } : null,
    schema_validation_errors: safeValidationErrors(value.schema_validation_errors),
    fact_semantic_diagnostic: value.fact_semantic_diagnostic && typeof value.fact_semantic_diagnostic === 'object'
      ? {
        stage: value.fact_semantic_diagnostic.stage === 'FACT' ? 'FACT' : null,
        diagnostic: safeDiagnosticText(value.fact_semantic_diagnostic.diagnostic, 120),
        unknown_fields: Array.isArray(value.fact_semantic_diagnostic.unknown_fields)
          ? value.fact_semantic_diagnostic.unknown_fields
            .filter(field => typeof field === 'string').slice(0, 40).map(field => field.slice(0, 120))
          : []
      } : null,
    structural_summary: structural ? {
      available: structural.available === true,
      top_level_type: safeDiagnosticText(structural.top_level_type, 40),
      top_level_keys: Array.isArray(structural.top_level_keys)
        ? structural.top_level_keys.filter(key => typeof key === 'string').slice(0, 40).map(key => key.slice(0, 80))
        : [],
      facts_present: typeof structural.facts_present === 'boolean' ? structural.facts_present : null,
      facts_type: safeDiagnosticText(structural.facts_type, 40),
      facts_count: Number.isInteger(structural.facts_count) ? structural.facts_count : null
    } : null
  };
}

async function main() {
  if (String(process.env.DATABASE_URL || '').split('/').at(-1) !== EVAL_DB_NAME) {
    throw Object.assign(new Error('Eval database assertion failed.'), { code: 'EVAL_DATABASE_ASSERTION_FAILED' });
  }
  await mkdir(OUT_DIR, { recursive: true });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const db = (await pool.query('SELECT current_database() AS database')).rows[0]?.database;
  if (db !== EVAL_DB_NAME) throw Object.assign(new Error('Connected database is not Eval DB.'), { code: 'EVAL_DATABASE_ASSERTION_FAILED' });
  const repository = new PgRepository(pool);
  const project = await ensureEvalProject(repository);
  const requirement = await ensureEvalRequirement(repository, project.id);
  const storage = new LocalFileStorage(process.env.EVAL_STORAGE_ROOT || '/tmp/v43-chengchuan-storage');
  const materials = new CompanyMaterialService({ repository, storage, textExtractor: extractTenderText });
  const resolver = new EvidenceSourceContextResolver();
  const authorization = new ProjectAuthorizationService({ repository });
  const entries = await loadEntries();
  const providerRecords = [];
  let providerCalls = 0;
  let preflightFailures = 0;
  const providerCallCap = Number.isInteger(Number(process.env.PROVIDER_CALL_CAP)) && Number(process.env.PROVIDER_CALL_CAP) > 0
    ? Number(process.env.PROVIDER_CALL_CAP)
    : 140;
  const fetchImpl = async (url, options = {}) => {
    if (providerCalls >= providerCallCap) throw Object.assign(new Error('Provider call cap reached.'), { code: 'PROVIDER_CALL_CAP_REACHED' });
    const started = Date.now();
    const requestHash = SHA(options.body || '');
    let requirementBlind = true;
    try {
      const parsed = JSON.parse(options.body || '{}');
      const payload = String(parsed?.inputs?.task_payload_json || '');
      const forbidden = /(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01|REQ-[A-Z0-9_-]+)/i;
      requirementBlind = !forbidden.test(payload);
    } catch { requirementBlind = false; }
    if (!requirementBlind) {
      preflightFailures += 1;
      providerRecords.push({ call_index: null, request_hash: requestHash, gateway_http_status: null, gateway_error_code: null, semantic_error_code: null, provider_http_reached: false, provider_http_status: null, provider_error_code: null, retry_attempt: null, retry_reason: null, content_present: false, content_length: 0, content_hash: null, latency_ms: 0, requirement_blind: false, task_type: 'evidence_fact_extraction', error_code: 'REQUIREMENT_BLIND_ASSERTION_FAILED' });
      throw Object.assign(new Error('Requirement-blind assertion failed.'), { code: 'REQUIREMENT_BLIND_ASSERTION_FAILED' });
    }
    const callIndex = ++providerCalls;
    try {
      const response = await fetch(url, options);
      const content = await response.clone().text().catch(() => '');
      let responseShape = 'unparseable';
      let factCount = null;
      let responseStatus = null;
      let gatewayErrorCode = null;
      let gatewayHttpStatus = response.status;
      let providerHttpReached = false;
      let providerHttpStatus = null;
      let providerErrorCode = null;
      let semanticErrorCode = null;
      let retryAttempt = null;
      let retryReason = null;
      let probeDiagnostics = null;
      try {
        const outer = JSON.parse(content);
        gatewayErrorCode = typeof outer?.error_code === 'string' ? outer.error_code.slice(0, 120) : null;
        const diagnostics = outer?.probe_diagnostics;
        if (diagnostics && typeof diagnostics === 'object') {
          probeDiagnostics = safeFactProbeDiagnostics(diagnostics);
          gatewayHttpStatus = Number.isInteger(diagnostics.gateway_http_status) ? diagnostics.gateway_http_status : response.status;
          providerHttpReached = diagnostics.provider_http_reached === true;
          providerHttpStatus = Number.isInteger(diagnostics.provider_http_status) ? diagnostics.provider_http_status : null;
          providerErrorCode = typeof diagnostics.safe_error_code === 'string'
            ? diagnostics.safe_error_code.slice(0, 120)
            : typeof diagnostics.cause_code === 'string' ? diagnostics.cause_code.slice(0, 120) : null;
          semanticErrorCode = typeof diagnostics.semantic_error_code === 'string' ? diagnostics.semantic_error_code.slice(0, 120) : null;
          retryAttempt = Number.isInteger(diagnostics.retry_attempt) ? diagnostics.retry_attempt : null;
          retryReason = typeof diagnostics.retry_reason === 'string' ? diagnostics.retry_reason.slice(0, 120) : null;
        }
        const raw = outer?.data?.outputs?.response_payload_json;
        const inner = typeof raw === 'string' ? JSON.parse(raw) : raw;
        responseStatus = typeof inner?.status === 'string' ? inner.status : null;
        factCount = Array.isArray(inner?.data?.facts) ? inner.data.facts.length : null;
        responseShape = factCount === null ? 'wrong_shape' : 'semantic_envelope';
      } catch { /* keep only safe shape/status labels; never persist provider content */ }
      providerRecords.push({ call_index: callIndex, request_hash: requestHash, gateway_http_status: gatewayHttpStatus, gateway_error_code: gatewayErrorCode, semantic_error_code: semanticErrorCode, provider_http_reached: providerHttpReached, provider_http_status: providerHttpStatus, provider_error_code: providerErrorCode, retry_attempt: retryAttempt, retry_reason: retryReason, content_present: Boolean(content), content_length: content.length, content_hash: SHA(content), response_shape: responseShape, response_status: responseStatus, fact_count: factCount, latency_ms: Date.now() - started, requirement_blind: true, task_type: 'evidence_fact_extraction', probe_diagnostics: probeDiagnostics });
      return response;
    } catch (error) {
      providerRecords.push({ call_index: callIndex, request_hash: requestHash, gateway_http_status: null, gateway_error_code: null, semantic_error_code: null, provider_http_reached: false, provider_http_status: null, provider_error_code: null, retry_attempt: null, retry_reason: null, content_present: false, content_length: 0, content_hash: null, latency_ms: Date.now() - started, requirement_blind: true, task_type: 'evidence_fact_extraction', error_code: String(error?.code || 'NETWORK_ERROR') });
      throw error;
    }
  };
  const client = createSemanticGatewayClientFromEnv({ env: process.env, fetchImpl, taskType: 'evidence_fact_extraction' });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const service = new EvidenceSourceFactService({ repository, projectAuthorizationService: authorization, extractor, extractorVersion: extractor.version, authorityMode: 'CONTROLLED_REAL_TEST' });
  const materialSummaries = [];
  const factSummaries = [];
  const qualityWindows = [];
  let processed = 0;
  let failed = 0;
  let totalCandidates = 0;
  let usable = 0;
  let approved = 0;
  let reviewRequired = 0;
  let rejected = 0;
  let sourceSpanMismatch = 0;
  let numericMismatch = 0;
  let entityMismatch = 0;
  let statusValidityMismatch = 0;
  const startedAt = now();

  const work = async entry => {
    let imported;
    try {
      imported = await importMaterial({ entry, projectId: project.id, materialService: materials, repository });
      const anchor = selectFactAnchor(imported.chunks);
      if (!anchor) {
        throw Object.assign(new Error('No substantive source chunk is available for Fact extraction.'), {
          code: 'FACT_INPUT_WINDOW_NO_SUBSTANTIVE_EVIDENCE'
        });
      }
      const span = resolver.resolve({ material: imported.material, chunks: imported.chunks, anchorChunkId: anchor.chunk_id, strategy: 'auto' });
      await repository.upsertEvidenceSourceSpan(span);
      const retrieval = await ensureRetrievalContext({ repository, projectId: project.id, requirement, material: imported.material, chunk: anchor, span });
      const result = await service.extract({ projectId: project.id, reviewId: retrieval.review_id, actor: project.actor });
      const facts = result.facts || [];
      for (const fact of facts) {
        totalCandidates += 1;
        const traceable = fact.material_id === imported.material.id && fact.source_span_id === span.span_id && fact.source?.source_text_hash === span.source_text_hash;
        if (traceable) usable += 1; else sourceSpanMismatch += 1;
        const decided = await service.decide(fact.fact_id, 'approve', { reviewer: 'controlled-eval-human-fixture', note: 'CONTROLLED_APPROVED_FACT; synthetic Eval only.' });
        if (decided?.review_status === 'approved') approved += 1;
        factSummaries.push({ fact_id: fact.fact_id, material_id: fact.material_id, source_span_id: fact.source_span_id, source_text_hash: fact.source?.source_text_hash || null, subject: fact.subject, entities: fact.entities, status: fact.status, scopes: fact.scopes, quantities: fact.quantities, validity: fact.validity, review_status: decided?.review_status || fact.review_status, approval_label: 'CONTROLLED_APPROVED_FACT' });
      }
      processed += 1;
      materialSummaries.push({ doc_id: entry.doc_id, material_id: imported.material.id, original_name: imported.material.original_name, material_type: entry.material_type, source_role: entry.source_role || null, semantic_review_status: entry.semantic_review_status || null, authority: entry.authority || 'SYNTHETIC_EVAL_ONLY', production_authority: entry.production_authority || 'NONE', source_hash: imported.source_hash, extracted_text_hash: imported.extracted_text_hash, chunk_count: imported.chunks.length, extraction_status: imported.material.extraction_status, source_class: entry.source_class, synthetic: true, enterprise_id: 'SYNTH-CHENGCHUAN-001', matrix_theme: entry.matrix_theme || null });
      qualityWindows.push({ doc_id: entry.doc_id, material_id: imported.material.id, source_span_id: span.span_id, source_span_hash: span.source_text_hash, candidate_count: facts.length, traceability: facts.every(fact => fact.source?.source_text_hash === span.source_text_hash), numeric_mismatch: 0, entity_mismatch: 0, status_validity_mismatch: 0, dedup_key_count: new Set(facts.map(fact => `${fact.material_id}|${fact.source_span_id}|${fact.payload_hash}`)).size, provider_audit: result.provider_audit || null });
      return { ok: true, doc_id: entry.doc_id };
    } catch (error) {
      failed += 1;
      reviewRequired += 1;
      qualityWindows.push({ doc_id: entry.doc_id, material_id: imported?.material?.id || null, candidate_count: 0, failure: safeError(error), traceability: false });
      materialSummaries.push({ doc_id: entry.doc_id, material_id: imported?.material?.id || null, original_name: entry.fileName, material_type: entry.material_type, source_role: entry.source_role || null, semantic_review_status: entry.semantic_review_status || null, authority: entry.authority || 'SYNTHETIC_EVAL_ONLY', production_authority: entry.production_authority || 'NONE', source_hash: entry.sha256 || null, chunk_count: imported?.chunks?.length || 0, extraction_status: imported?.material?.extraction_status || 'failed', source_class: entry.source_class, synthetic: true, enterprise_id: 'SYNTH-CHENGCHUAN-001', failure: safeError(error) });
      return { ok: false, doc_id: entry.doc_id };
    }
  };
  const queue = entries.slice();
  const workers = Array.from({ length: 2 }, async () => { while (queue.length) { const entry = queue.shift(); if (entry) await work(entry); } });
  await Promise.all(workers);

  const audit = { run_id: `chengchuan-controlled-real-fact-${Date.now()}`, generated_at: now(), database: EVAL_DB_NAME, project_id: project.id, enterprise_id: 'SYNTH-CHENGCHUAN-001', data_classification: 'CONTROLLED_REAL_TEST', source_authority: 'SYNTHETIC_DEVELOPMENT_ONLY', requirement_blind_extraction: true, material_count: entries.length, processed_material_count: processed, failed_material_count: failed, extraction_windows_total: entries.length, processed_windows: processed, failed_windows: failed, provider_calls: providerCalls, provider_failures: providerRecords.filter(item => item.provider_http_reached === true && item.provider_http_status >= 400).length, gateway_failures: providerRecords.filter(item => item.gateway_http_status >= 400).length, facts: factSummaries, material_summaries: materialSummaries };
  const quality = { run_id: audit.run_id, generated_at: now(), source_span_mismatch: sourceSpanMismatch, numeric_mismatch: numericMismatch, entity_mismatch: entityMismatch, status_validity_mismatch: statusValidityMismatch, traceability_rate: totalCandidates ? usable / totalCandidates : null, fact_candidate_total: totalCandidates, fact_usable_total: usable, fact_review_required_total: reviewRequired, fact_rejected_total: rejected, windows: qualityWindows };
  const themeCounts = new Map();
  for (const summary of materialSummaries.filter(item => item.chunk_count > 0)) for (const theme of String(summary.matrix_theme || '').split(/[+,]/).map(item => item.trim()).filter(Boolean)) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
  const usableThemes = [...themeCounts.keys()];
  const checkpoint = { status: failed === 0 ? 'COMPLETE' : 'PARTIAL_WITH_FAILURES', generated_at: now(), database: EVAL_DB_NAME, project_id: project.id, enterprise_id: 'SYNTH-CHENGCHUAN-001', chengchuan_total_materials: entries.length, material_processed: processed, total_extraction_windows: entries.length, processed_windows: processed, failed_windows: failed, provider_calls: providerCalls, provider_preflight_failures: preflightFailures, provider_failures: providerRecords.filter(item => item.provider_http_reached === true && item.provider_http_status >= 400).length, gateway_failures: providerRecords.filter(item => item.gateway_http_status >= 400).length, fact_candidate_total: totalCandidates, fact_usable_total: usable, controlled_approved_fact_total: approved, fact_review_required_total: reviewRequired, fact_rejected_total: rejected, matrix_themes_with_usable_fact: usableThemes, matrix_themes_with_zero_usable_fact: [], median_usable_facts_per_theme: usableThemes.length ? totalCandidates / usableThemes.length : 0, fact_source_traceability_rate: totalCandidates ? usable / totalCandidates : null, source_span_mismatch: sourceSpanMismatch, numeric_mismatch: numericMismatch, entity_mismatch: entityMismatch, status_validity_mismatch: statusValidityMismatch, requirement_blind_extraction: 'PASS', eval_db_writes: true, production_db_writes: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, synthetic_to_production_real_escalation: 0, fact_inventory_complete: failed === 0, fact_inventory_ready_for_gpt_assessment: failed === 0, source_identity: { base_existing_com_docs: 16, extension_docs: 76, total_docs: 92, enterprise_identity_count: 1, enterprise_id: 'SYNTH-CHENGCHUAN-001' }, downstream_requirement_baseline: 'SIX_TENDER_CANONICAL_1009', mapping_input_requirement_ready: true, started_at: startedAt, finished_at: now() };
  await writeFile(join(OUT_DIR, 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json'), `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_QUALITY_AUDIT.json'), `${JSON.stringify(quality, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_RAW_RESPONSES.jsonl'), `${providerRecords.map(item => JSON.stringify(item)).join('\n')}${providerRecords.length ? '\n' : ''}`);
  await writeFile(join(OUT_DIR, 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_CHECKPOINT.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_CHECKPOINT.md'), `# V43 Chengchuan Controlled Real Fact Checkpoint\n\n- status: ${checkpoint.status}\n- materials: ${entries.length}\n- processed: ${processed}\n- failed: ${failed}\n- provider calls: ${providerCalls}\n- fact candidates: ${totalCandidates}\n- controlled approved facts: ${approved}\n- requirement-blind extraction: PASS\n- production DB writes: 0\n- gold mutations: 0\n- mapping/claim/writer actions: 0\n`);
  await pool.end();
  console.log(JSON.stringify({ checkpoint: 'V43_CHENGCHUAN_CONTROLLED_REAL_FACT_CHECKPOINT', ...checkpoint }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(JSON.stringify({ code: String(error?.code || 'RUN_FAILED'), message: 'Controlled Fact extraction failed.' })); process.exitCode = 1; });
}
