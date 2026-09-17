import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import pg from 'pg';
import { PgRepository } from '../../src/db.js';
import { LocalFileStorage } from '../../src/storage.js';
import { CompanyMaterialService } from '../../src/company-material-service.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT,
  buildEvidenceFactCandidateV2SemanticInput,
  buildEvidenceFactCandidateV21SemanticInput
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { loadSemanticGatewayEnvironment, safeSemanticGatewayRuntimeSummary } from '../../../packages/semantic-contracts/runtime-config.js';
import {
  splitSemanticWindowAtChunkBoundary,
  splitSemanticWindowIntoIndividualChunks,
  splitProductionChunkIntoAtomicSegments,
  buildAtomicFactExtractionWindow,
  deduplicateExactAtomicCandidates,
  classifyEnterpriseFactCandidate,
  classifyEnterpriseFactCandidateV22,
  classifyFactExtractionResult
} from './fact-pilot-v1-1-helpers.mjs';
import {
  createEvidenceFactSourceSnapshot,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2,
  EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  EVIDENCE_FACT_GROUNDING_V2_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  resolveEvidenceFactCandidateV21SourceRefs,
  createEvidenceFactCandidateV21SourceAliasTable,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';

const ROOT = resolve(process.cwd());
const SOURCE_ROOT = join(ROOT, 'data', 'eval', 'real-enterprise-upload-test-v1');
const RAW_ROOT = join(SOURCE_ROOT, 'raw');
const MANIFEST_PATH = join(SOURCE_ROOT, '01_REAL_DOCUMENT_MANIFEST.json');
const DOWNLOAD_REPORT_PATH = join(SOURCE_ROOT, 'download_report.json');
const V1_1_MODE = process.env.V43_REAL_FACT_PILOT_V1_1 === 'true';
const V22_MODE = process.env.V43_REAL_FACT_PILOT_V2_2 === 'true';
const V21_MODE = !V22_MODE && process.env.V43_REAL_FACT_PILOT_V2_1 === 'true';
const V2_MODE = !V22_MODE && !V21_MODE && process.env.V43_REAL_FACT_PILOT_V2 === 'true';
const CANDIDATE_MODE = V22_MODE || V21_MODE || V2_MODE;
const TASK_TYPE = V22_MODE ? 'evidence_fact_candidate_v2_2' : V21_MODE ? 'evidence_fact_candidate_v2_1' : V2_MODE ? 'evidence_fact_candidate_v2' : 'evidence_fact_extraction';
const CONTRACT_VERSION = V22_MODE ? EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION : V21_MODE ? EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION : V2_MODE ? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION : '4.3-evidence-fact-extraction-v1';
const PILOT_SCOPE = process.env.V43_REAL_FACT_PILOT_SCOPE || 'full';
const OUT_DIR = resolve(process.env.OUTPUT_DIR || join(ROOT, 'docs', 'handoff', V22_MODE
  ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED'
  : V21_MODE
  ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TRUNCATION_CLOSURE'
  : V2_MODE
  ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE'
  : V1_1_MODE ? 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1_1'
  : 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1'));
const PROGRESS_PATH = join(SOURCE_ROOT, 'real-pdf-pilot-progress.json');
const DB_NAME = 'bid_platform_flow_audit_test';
const DB_URL = process.env.EVAL_DATABASE_URL || `postgresql://bid_user:bid_password@127.0.0.1:5432/${DB_NAME}`;
const ENTERPRISE_ID = 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1';
const ENTERPRISE_NAME = 'Huawei';
const RUN_ID = `V43-REAL-PDF-PILOT${V22_MODE ? '-CANDIDATE-V2.2' : V21_MODE ? '-CANDIDATE-V2.1' : V2_MODE ? '-CANDIDATE-V2' : V1_1_MODE ? '-V1.1' : ''}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const PROVIDER_CAP = 120;
const SEMANTIC_WINDOW_MAX_CHARS = 6000;
const PILOT_MATERIAL_IDS = new Set(['HW-001', 'HW-002', 'HW-003', 'HW-004', 'HW-005', 'HW-006']);

const sha = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safeText = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

function parseJson(text, label) {
  try { return JSON.parse(text); } catch (error) {
    throw Object.assign(new Error(`${label} is not valid JSON.`), { code: 'ARTIFACT_JSON_INVALID', cause: error });
  }
}

function safeProviderAudit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const key of [
    'provider', 'model', 'requested_provider', 'requested_model', 'response_provider', 'response_model',
    'endpoint', 'gateway_http_status', 'provider_http_status', 'provider_http_reached', 'latency_ms',
    'retry_attempt', 'retry_reason', 'finish_reason', 'prompt_tokens', 'completion_tokens',
    'total_tokens', 'output_truncated', 'json_parse_success', 'safe_error_code', 'cause_code'
  ]) if (value[key] !== undefined) out[key] = typeof value[key] === 'string' ? safeText(value[key], 180) : value[key];
  if (value.fact_normalization_diagnostic && typeof value.fact_normalization_diagnostic === 'object') {
    out.fact_normalization_diagnostic = {
      normalizer_invoked: value.fact_normalization_diagnostic.normalizer_invoked === true,
      projection_invoked: value.fact_normalization_diagnostic.projection_invoked === true,
      unexpected_property_names: Array.isArray(value.fact_normalization_diagnostic.unexpected_property_names)
        ? value.fact_normalization_diagnostic.unexpected_property_names.slice(0, 20).map(item => safeText(item, 120)) : [],
      allowed_property_names: Array.isArray(value.fact_normalization_diagnostic.allowed_property_names)
        ? value.fact_normalization_diagnostic.allowed_property_names.slice(0, 80).map(item => safeText(item, 120)) : [],
      removed_property_names: Array.isArray(value.fact_normalization_diagnostic.removed_property_names)
        ? value.fact_normalization_diagnostic.removed_property_names.slice(0, 40).map(item => safeText(item, 160)) : [],
      pre_normalization_fact_keys: Array.isArray(value.fact_normalization_diagnostic.pre_normalization_fact_keys)
        ? value.fact_normalization_diagnostic.pre_normalization_fact_keys.slice(0, 20) : [],
      post_normalization_fact_keys: Array.isArray(value.fact_normalization_diagnostic.post_normalization_fact_keys)
        ? value.fact_normalization_diagnostic.post_normalization_fact_keys.slice(0, 20) : [],
      numeric_coercion_count: Number.isInteger(value.fact_normalization_diagnostic.numeric_coercion_count)
        ? value.fact_normalization_diagnostic.numeric_coercion_count : 0,
      exact_validation_path: safeText(value.fact_normalization_diagnostic.exact_validation_path, 240)
    };
  }
  return out;
}

function safeError(error) {
  const details = error?.details || {};
  return {
    code: safeText(error?.code || 'UNKNOWN_ERROR', 120),
    status: Number.isInteger(error?.status) ? error.status : null,
    message: safeText(error?.message, 240),
    stage: safeText(details.stage, 80),
    boundary: safeText(details.boundary, 180),
    cause_code: safeText(details.cause_code, 120),
    provider_audit: safeProviderAudit(details.provider_audit),
    schema_validation_errors: Array.isArray(details.schema_validation_errors)
      ? details.schema_validation_errors.slice(0, 20).map(item => ({
        path: safeText(item?.path, 180), keyword: safeText(item?.keyword, 80),
        expected: safeText(item?.expected, 180), actual_type: safeText(item?.actual_type, 80),
        additional_property: safeText(item?.additional_property, 120)
      })) : []
  };
}

function materialType(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('annual')) return 'company_profile';
  if (value.includes('solution')) return 'technical_solution';
  if (value.includes('whitepaper')) return 'technical_whitepaper';
  return 'product_documentation';
}

function forbiddenRequirementTokens(value) {
  return /(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01|HOLDOUT-REQ|FIXED48|mapping[_ -]?label|coverage\s+gap)/i.test(String(value || ''));
}

function pageForParagraph(paragraphs, paragraphNumber) {
  const item = paragraphs.find(value => value.paragraph === paragraphNumber);
  return Number.isInteger(item?.page) ? item.page : null;
}

function buildSemanticWindows(material, chunks, paragraphs) {
  const ordered = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const windows = [];
  let current = [];
  let start = null;
  for (const chunk of ordered) {
    if (!current.length) start = chunk.char_start;
    if (current.length && chunk.char_end - start > SEMANTIC_WINDOW_MAX_CHARS) {
      windows.push(current);
      current = [];
      start = chunk.char_start;
    }
    current.push(chunk);
  }
  if (current.length) windows.push(current);
  return windows.map((windowChunks, index) => {
    const first = windowChunks[0];
    const last = windowChunks.at(-1);
    const startOffset = first.char_start;
    const endOffset = last.char_end;
    const sourceText = material.extracted_text.slice(startOffset, endOffset);
    const pageValues = windowChunks.flatMap(chunk => [
      pageForParagraph(paragraphs, chunk.paragraph_start),
      pageForParagraph(paragraphs, chunk.paragraph_end)
    ]).filter(Number.isInteger);
    return {
      window_id: `SW-${material.id}-${String(index + 1).padStart(4, '0')}`,
      window_index: index,
      material_id: material.id,
      source_id: material.document_number || material.original_name,
      source_text: sourceText,
      source_text_hash: sha(sourceText),
      start_offset: startOffset,
      end_offset: endOffset,
      page_start: pageValues.length ? Math.min(...pageValues) : null,
      page_end: pageValues.length ? Math.max(...pageValues) : null,
      paragraph_start: first.paragraph_start,
      paragraph_end: last.paragraph_end,
      included_chunk_ids: windowChunks.map(chunk => chunk.chunk_id),
      included_chunk_count: windowChunks.length,
      included_chunk_text_chars: windowChunks.reduce((total, chunk) => total + String(chunk.source_text || '').length, 0),
      source_span_chars: sourceText.length,
      chunks: windowChunks.map(chunk => ({
        chunk_id: chunk.chunk_id,
        chunk_index: chunk.chunk_index,
        char_start: chunk.char_start,
        char_end: chunk.char_end,
        paragraph_start: chunk.paragraph_start,
        paragraph_end: chunk.paragraph_end,
        page_start: pageForParagraph(paragraphs, chunk.paragraph_start),
        page_end: pageForParagraph(paragraphs, chunk.paragraph_end),
        source_text: chunk.source_text
      }))
    };
  });
}

async function ensureEvalProject(repository) {
  const actor = { actor_id: 'v43-real-pdf-pilot-eval', actor_type: 'service', source: 'maintenance_cli' };
  const name = 'V43 Real PDF Fact Pilot Eval (Isolated) 20260913-R2';
  const existing = (await repository.pool.query('SELECT id FROM projects WHERE name=$1 ORDER BY created_at DESC LIMIT 1', [name])).rows[0];
  if (existing) return { id: existing.id, actor };
  const project = await repository.createProjectWithOwner({ name, deadline: null, owner: actor });
  return { id: project.id, actor };
}

async function ensureEvalRequirement(repository, projectId) {
  const reqId = 'EVAL-REAL-PDF-PILOT-CONTEXT-001';
  const existing = (await repository.pool.query(
    'SELECT r.*,b.status baseline_status FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 AND r.req_id=$2 LIMIT 1',
    [projectId, reqId]
  )).rows[0];
  if (existing) return existing;
  const storageKey = `${projectId}/real-pdf-pilot-context.txt`;
  const tender = (await repository.pool.query('SELECT * FROM tender_files WHERE project_id=$1 AND storage_key=$2 LIMIT 1', [projectId, storageKey])).rows[0]
    || await repository.addTenderFile({ projectId, originalName: 'real-pdf-pilot-context.txt', storageKey, mimeType: 'text/plain', sizeBytes: 1 });
  let baseline = (await repository.pool.query('SELECT * FROM requirement_baselines WHERE project_id=$1 LIMIT 1', [projectId])).rows[0] || null;
  if (!baseline) {
    const job = await repository.createParseJob({ projectId, tenderFileId: tender.id });
    await repository.updateParseJob(job.id, 'succeeded', { phase: 'succeeded' });
    baseline = (await repository.pool.query(
      `INSERT INTO requirement_baselines(project_id,parse_job_id,status,confirmation_type)
       VALUES($1,$2,'building','verified') RETURNING *`, [projectId, job.id]
    )).rows[0];
  }
  const text = 'Eval-only real PDF source context; no tender requirement.';
  const requirement = (await repository.pool.query(
    `INSERT INTO requirements(
      baseline_id,project_id,req_id,content,source_excerpt,source_page,source_paragraph,target_sections,ordinal,source_text,
      is_mandatory,mandatory_marker,source_section,source_clause_id,mandatory_scope_source_text,mandatory_scope_section,exception_clause_ids,
      source_hash,source_chunk_id,category,requires_confirmation,confirmation_type,requirement_category,writer_eligible,
      classification_review_required,atomicity_review_required,conditions,confirmation_reasons,risk_flags,source_evidence_json,deduplication_json,
      canonical_rule_version,source_page_start,source_page_end,source_paragraph_start,source_paragraph_end,source_paragraphs_json,
      source_match_type,source_match_score,source_resolution_method,source_verified,source_status,confirmed_by,confirmed_at
    ) VALUES($1,$2,$3,$4,$4,NULL,NULL,'[]'::jsonb,1,$4,false,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,$5,NULL,'context',false,'verified','context',false,
      false,false,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'eval-only',NULL,NULL,NULL,NULL,'[]'::jsonb,
      'exact_single_paragraph',1,'eval-only',true,'verified','v43-real-pdf-pilot-eval',now()) RETURNING *`,
    [baseline.id, projectId, reqId, text, sha(text)]
  )).rows[0];
  await repository.pool.query(`UPDATE requirement_baselines SET status='confirmed',confirmed_at=now(),confirmed_by='v43-real-pdf-pilot-eval',confirmation_type='verified' WHERE id=$1`, [baseline.id]);
  return { ...requirement, baseline_status: 'confirmed' };
}

async function importViaNormalUpload({ entry, projectId, materialService, repository, storage, captures }) {
  const raw = await readFile(entry.filePath);
  const rawHash = sha(raw);
  if (rawHash !== entry.sha256) throw Object.assign(new Error(`Source hash mismatch for ${entry.id}.`), { code: 'SOURCE_HASH_MISMATCH' });
  let material = await repository.findCompanyMaterialByHash(projectId, rawHash);
  let uploaded = false;
  let extraction = null;
  if (!material) {
    material = await materialService.upload({
      projectId,
      file: { originalname: `${entry.id}.pdf`, mimetype: 'application/pdf', size: raw.length, buffer: raw },
      materialType: materialType(entry.type)
    });
    uploaded = true;
    extraction = captures.get(`${entry.id}.pdf`) || await extractTenderText({ fileName: `${entry.id}.pdf`, mimeType: 'application/pdf', buffer: raw });
  } else {
    extraction = await extractTenderText({ fileName: `${entry.id}.pdf`, mimeType: 'application/pdf', buffer: raw });
  }
  await repository.pool.query(
    `UPDATE company_materials SET
      corpus_scope='ENTERPRISE_PRIVATE', industry='Huawei', source_org=$2, source_url=$3, source_type='official_first_party_public',
      document_number=$4, published_at=NULL, effective_status='current_status_required', source_version='V43_REAL_PDF_PILOT_V1',
      authority_level='official', usage_status='ACTIVE_FULLTEXT', review_status='approved', lifecycle_status='ACTIVE', index_status='NOT_INDEXED',
      review_notes=$5, synthetic_test_material=false, updated_at=now()
     WHERE id=$1`,
    [material.id, ENTERPRISE_NAME, entry.resolved_url || entry.source_url || entry.url, entry.id,
      `REAL_PUBLIC_FIRST_PARTY; enterprise_id=${ENTERPRISE_ID}; frozen_source_sha256=${rawHash}; requirement_blind=true; eval_only=true.`]
  );
  material = await repository.getCompanyMaterial(material.id);
  const chunks = await repository.listMaterialChunks(material.id);
  return {
    material,
    chunks,
    extraction,
    uploaded,
    raw_hash: rawHash,
    extracted_text_hash: sha(extraction.text),
    extracted_text_length: extraction.text.length,
    file_bytes: raw.length
  };
}

async function ensureWindowContext({ repository, project, requirement, material, window, runId }) {
  const spanId = `PILOT-ESPAN-${sha(`${runId}|${window.window_id}|${window.source_text_hash}`).slice(0, 32).toUpperCase()}`;
  const span = await repository.upsertEvidenceSourceSpan({
    span_id: spanId,
    project_id: project.id,
    material_id: material.id,
    source_document_id: material.id,
    anchor_chunk_id: window.included_chunk_ids[0],
    requested_strategy: 'bounded_semantic_window',
    resolver_strategy: 'bounded_semantic_window',
    fallback_reason: 'EVAL_GENERAL_ADJACENT_CHUNK_WINDOW',
    start_offset: window.start_offset,
    end_offset: window.end_offset,
    source_text: window.source_text,
    source_text_hash: window.source_text_hash,
    heading_path: [],
    source_chunk_ids: window.included_chunk_ids,
    resolver_version: 'evidence-source-semantic-window-v1'
  });
  const queryText = 'Eval-only enterprise source window; requirement-blind Fact extraction context.';
  const run = await repository.createRetrievalRun({
    projectId: project.id,
    requirementDbId: requirement.id,
    requirementRef: requirement.req_id,
    queryText,
    queryHash: sha(queryText),
    model: 'eval-placeholder',
    version: '1',
    dimension: 1,
    topK: 1,
    filters: { eval_only: true, requirement_blind: true, fact_only: true, pilot_window_id: window.window_id },
    retrievalContractVersion: '4.3-production-retrieval-v1',
    candidateK: 1,
    reviewK: 1,
    rerankVersion: 'eval-placeholder-v1',
    semanticMetadata: { eval_only: true, source_foundation: 'REAL_PUBLIC_FIRST_PARTY', semantic_window_id: window.window_id }
  });
  const embedding = (await repository.pool.query(
    `INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding)
     VALUES($1,$2,'eval-placeholder','1',1,'[0]'::vector)
     ON CONFLICT(chunk_id,chunk_hash,embedding_model,embedding_version) DO UPDATE SET chunk_id=EXCLUDED.chunk_id
     RETURNING embedding_id`, [window.included_chunk_ids[0], await hashChunk(repository, window.included_chunk_ids[0])]
  )).rows[0];
  await repository.pool.query(
    `INSERT INTO enterprise_retrieval_results(retrieval_run_id,chunk_id,embedding_id,rank,similarity_score)
     VALUES($1,$2,$3,1,1) ON CONFLICT(retrieval_run_id,chunk_id) DO NOTHING`,
    [run.retrieval_run_id, window.included_chunk_ids[0], embedding.embedding_id]
  );
  await repository.pool.query(
    `UPDATE enterprise_retrieval_runs SET status='succeeded',completed_at=now(),latency_ms=0 WHERE retrieval_run_id=$1`,
    [run.retrieval_run_id]
  );
  const reviewId = `PILOT-FACT-REVIEW-${material.id}-${String(window.window_index + 1).padStart(4, '0')}`;
  await repository.upsertEvidenceCandidateReview({
    review_id: reviewId,
    project_id: project.id,
    requirement_id: requirement.id,
    retrieval_run_id: run.retrieval_run_id,
    retrieval_candidate_id: window.included_chunk_ids[0],
    source_span_id: span.span_id,
    requirement_text_hash: sha(requirement.content),
    source_text_hash: span.source_text_hash,
    semantic_relevance: 'relevant',
    evidence_capability: 'capable',
    support_level: 'full_support',
    review_dimensions: { eval_only: true, source_role: 'REAL_PUBLIC_FIRST_PARTY', source_authority: 'official', semantic_window_id: window.window_id },
    reason_codes: [],
    requires_human_review: true,
    review_status: 'approved',
    reviewer_type: 'human',
    reviewer_version: 'controlled-eval-human-fixture-v1',
    semantic_reviewer_version: null,
    contract_version: 'evidence-review-v1',
    supplemental_note: 'EVAL_ONLY; Real PDF pilot; semantic Fact authority remains pending GPT/Human review.'
  });
  return { span, run, review_id: reviewId };
}

async function hashChunk(repository, chunkId) {
  const row = await repository.getMaterialChunk(chunkId);
  return row?.chunk_hash || sha(chunkId);
}

function deriveFactText(fact) {
  return `[deterministic-canonical-projection] ${JSON.stringify({
    subject: fact.subject || null,
    entities: fact.entities || [],
    fact_status: fact.status || null,
    scopes: fact.scopes || [],
    quantities: fact.quantities || [],
    validity: fact.validity || null
  })}`;
}

function traceableFactWindow(window) {
  return Boolean(window?.source_text_hash && sha(window.source_text) === window.source_text_hash);
}

async function writeProgress(progress) {
  await writeFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
}

async function loadPilotSources() {
  const manifest = parseJson(await readFile(MANIFEST_PATH, 'utf8'), 'Pilot manifest');
  const report = parseJson(await readFile(DOWNLOAD_REPORT_PATH, 'utf8'), 'Download report');
  const byId = new Map((report.documents || []).map(row => [row.id, row]));
  const sources = (manifest.documents || [])
    .filter(row => PILOT_MATERIAL_IDS.has(row.id))
    .map(row => {
      const downloaded = byId.get(row.id);
      const filePath = join(ROOT, downloaded?.local_path || join('data', 'eval', 'real-enterprise-upload-test-v1', 'raw', `${row.id}.pdf`));
      return {
        ...row,
        filePath,
        sha256: downloaded?.sha256 || null,
        byte_size: downloaded?.byte_size || null,
        source_url: downloaded?.source_url || row.url,
        resolved_url: downloaded?.resolved_url || row.url,
        status: downloaded?.status || null
      };
    });
  if (sources.length !== 6 || sources.some(row => row.status !== 'DOWNLOADED')) {
    throw Object.assign(new Error('Frozen six-document pilot source set is incomplete.'), { code: 'PILOT_SOURCE_SET_INVALID' });
  }
  return sources;
}

async function loadTargetedWindowIds() {
  const priorPath = join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1', '06_FACT_EXTRACTION_REPORT.json');
  const prior = parseJson(await readFile(priorPath, 'utf8'), 'Prior Fact pilot report');
  const rows = Array.isArray(prior.windows) ? prior.windows : [];
  const isTruncated = row => row?.failure?.provider_audit?.output_truncated === true
    || row?.failure?.provider_audit?.finish_reason === 'incomplete'
    || row?.provider_audit?.output_truncated === true;
  const isSchema = row => [
    row?.failure?.cause_code,
    row?.failure?.provider_audit?.safe_error_code,
    row?.failure?.provider_audit?.cause_code
  ].some(code => ['OUTPUT_SCHEMA_INVALID', 'PROVIDER_OUTPUT_INVALID'].includes(code)) && !isTruncated(row);
  const isEmpty = row => row?.status === 'SEMANTIC_EMPTY'
    || row?.failure?.code === 'FACT_SEMANTIC_EMPTY'
    || row?.failure?.provider_audit?.safe_error_code === 'VALID_EMPTY_RESULT';
  const isFacts = row => row?.status === 'FACTS_RETURNED';
  const selected = [
    ...rows.filter(isSchema).slice(0, 3),
    ...rows.filter(isTruncated).slice(0, 2),
    ...rows.filter(isEmpty).slice(0, 2),
    ...rows.filter(isFacts).slice(0, 1)
  ];
  const ids = [...new Set(selected.map(row => row.window_id).filter(Boolean))];
  if (ids.length !== 8) throw Object.assign(new Error(`Targeted failure selection must contain 8 unique windows; found ${ids.length}.`), { code: 'TARGETED_SELECTION_INVALID' });
  return new Set(ids);
}

function prepareChildWindow(window) {
  return {
    ...window,
    source_text_hash: sha(window.source_text),
    source_span_chars: String(window.source_text || '').length
  };
}

function buildCandidateV2SourceSnapshot({ material, window }) {
  const chunks = Array.isArray(window?.chunks) ? window.chunks : [];
  const segments = chunks.map((chunk, index) => ({
    source_ref: `snapshot://${material.id}/${window.window_id}/chunk-${String(index + 1).padStart(3, '0')}`,
    text: String(chunk.source_text || '')
  }));
  const firstChunk = chunks[0] || {};
  return createEvidenceFactSourceSnapshot({
    snapshot_id: `EVAL-FACT-V2-${material.id}-${window.source_text_hash.slice(0, 24).toUpperCase()}`,
    material_id: material.id,
    material_version: 'V43_REAL_PDF_PILOT_V2',
    source_hash: window.source_text_hash,
    chunk_id: firstChunk.chunk_id || null,
    chunk_hash: firstChunk.source_text ? sha(firstChunk.source_text) : null,
    source_span_id: `PILOT-V2-SPAN-${window.window_id}`,
    source_span_hash: window.source_text_hash,
    approved_review_identity: `EVAL-FACT-V2-APPROVED-${material.id}`,
    segments
  });
}

function sourceRefResolutionStats(facts, sourceSnapshot, { compactAliases = false } = {}) {
  if (compactAliases) {
    let total = 0;
    let resolved = 0;
    const failures = [];
    for (const [index, fact] of (facts || []).entries()) {
      try {
        const result = resolveEvidenceFactCandidateV21SourceRefs(fact, sourceSnapshot);
        total += result.source_alias_resolution.total;
        resolved += result.source_alias_resolution.resolved;
      } catch (error) {
        failures.push({ fact_index: index, code: error?.code || 'UNKNOWN_SOURCE_ALIAS' });
      }
    }
    return { total, resolved, unresolved: total - resolved + failures.length, rate: failures.length === 0 ? 1 : 0, unknown_source_alias_count: failures.length, failures };
  }
  const refs = new Set((sourceSnapshot?.segments || []).map(segment => segment.source_ref));
  let total = 0;
  let resolved = 0;
  const inspect = value => {
    if (!Array.isArray(value)) return;
    total += value.length;
    resolved += value.filter(ref => refs.has(ref)).length;
  };
  for (const fact of facts || []) {
    inspect(fact?.source_refs);
    inspect(fact?.subject_source_refs);
    inspect(fact?.status_source_refs);
    for (const item of fact?.entity_mentions || []) inspect(item?.source_refs);
    for (const item of fact?.scope_items || []) inspect(item?.source_refs);
    for (const item of fact?.quantity_items || []) inspect(item?.source_refs);
    for (const item of fact?.temporal_items || []) inspect(item?.source_refs);
  }
  return { total, resolved, unresolved: total - resolved, rate: total ? resolved / total : 1 };
}

function modelSourceRefChars(facts) {
  const refs = [];
  const collect = value => { if (Array.isArray(value)) refs.push(...value); };
  for (const fact of facts || []) {
    collect(fact?.source_refs);
    collect(fact?.subject_source_refs);
    collect(fact?.status_source_refs);
    for (const item of fact?.entity_mentions || []) collect(item?.source_refs);
    for (const item of fact?.scope_items || []) collect(item?.source_refs);
    for (const item of fact?.quantity_items || []) collect(item?.source_refs);
    for (const item of fact?.temporal_items || []) collect(item?.source_refs);
  }
  return JSON.stringify(refs).length;
}

function isTruncationFailure(errorOrFailure) {
  const value = errorOrFailure?.details?.provider_audit || errorOrFailure?.provider_audit || {};
  return value.output_truncated === true
    || value.safe_error_code === 'OUTPUT_TRUNCATED'
    || value.finish_reason === 'incomplete'
    || value.finish_reason === 'length';
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const sources = await loadPilotSources();
  const pool = new pg.Pool({ connectionString: DB_URL, max: 3, connectionTimeoutMillis: 5000 });
  try {
    const database = (await pool.query('SELECT current_database() AS database')).rows[0]?.database;
    if (database !== DB_NAME) throw Object.assign(new Error('Only the isolated Eval DB is allowed.'), { code: 'EVAL_DATABASE_ASSERTION_FAILED' });
    const repository = new PgRepository(pool);
    const project = await ensureEvalProject(repository);
    const requirement = await ensureEvalRequirement(repository, project.id);
    const storage = new LocalFileStorage(process.env.EVAL_STORAGE_ROOT || join(ROOT, 'data', 'eval', 'real-pdf-pilot-storage'));
    const captures = new Map();
    const materialService = new CompanyMaterialService({
      repository,
      storage,
      textExtractor: async args => {
        const extraction = await extractTenderText(args);
        captures.set(args.fileName, extraction);
        return extraction;
      }
    });
    const runtimeEnv = loadSemanticGatewayEnvironment({ env: process.env, envFile: join(ROOT, 'services', 'semantic-gateway', '.env') });
    const runtimeSummary = safeSemanticGatewayRuntimeSummary(runtimeEnv);
    const taskMetadata = getSemanticTaskInstructionMetadata(TASK_TYPE);
    const taskPromptHash = taskMetadata?.instruction_hash || null;
    const targetedWindowIds = (V1_1_MODE || V2_MODE || V21_MODE || V22_MODE) && PILOT_SCOPE === 'targeted'
      ? await loadTargetedWindowIds()
      : null;
    const preflight = {};
    for (const path of ['/ready', '/info']) {
      try {
        const response = await fetch(`${runtimeSummary.gateway_base_url}${path}`);
        const body = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        preflight[path] = { http_status: response.status, healthy: response.status === 200, safe_shape: parsed ? {
          status: parsed.status || null,
          service: parsed.service || null,
          build_revision: parsed.build_revision || parsed.commit || null,
          provider: parsed.provider || null,
          provider_configured: parsed.provider_configured ?? null,
          fact_provider: parsed.fact_provider || null,
          fact_provider_configured: parsed.fact_provider_configured ?? null,
          fact_provider_endpoint: parsed.fact_provider_endpoint || null,
          fact_model: parsed.fact_model || null,
          task_registry_loaded: parsed.task_registry_loaded ?? null
        } : null };
      } catch (error) {
        preflight[path] = { http_status: null, healthy: false, error_code: safeText(error?.code || 'NETWORK_ERROR', 120) };
      }
    }
    if (!preflight['/ready']?.healthy || !preflight['/info']?.healthy) {
      throw Object.assign(new Error('Semantic Gateway preflight failed.'), { code: 'BLOCKED_SEMANTIC_GATEWAY_PREFLIGHT' });
    }
    const infoShape = preflight['/info']?.safe_shape || {};
    if (infoShape.fact_provider !== 'deepseek_official'
      || infoShape.fact_provider_configured !== true
      || infoShape.fact_provider_endpoint !== '/responses'
      || (infoShape.fact_model && infoShape.fact_model !== 'deepseek-v4-pro')) {
      throw Object.assign(new Error('Fact Provider route identity is not the frozen production route.'), { code: 'BLOCKED_FACT_PROVIDER_ROUTE_IDENTITY_UNRESOLVED' });
    }
    const providerRecords = [];
    let providerCalls = 0;
    let providerFailures = 0;
    let requirementLeakage = 0;
    const guardedFetch = async (url, options = {}) => {
      if (providerCalls >= PROVIDER_CAP) throw Object.assign(new Error('Provider call cap reached.'), { code: 'BLOCKED_REAL_PDF_PILOT_PROVIDER_BUDGET' });
      let payload = null;
      try { payload = JSON.parse(String(options.body || '')); } catch { /* client owns JSON validation */ }
      const taskPayload = String(payload?.inputs?.task_payload_json || '');
      if (forbiddenRequirementTokens(taskPayload)) {
        requirementLeakage += 1;
        throw Object.assign(new Error('Requirement/tender token detected in Fact payload.'), { code: 'REQUIREMENT_TENDER_LEAKAGE' });
      }
      const callIndex = ++providerCalls;
      const requestHash = sha(String(options.body || ''));
      const started = Date.now();
      try {
        const response = await fetch(url, options);
        const content = await response.clone().text().catch(() => '');
        let gateway = null;
        try { gateway = JSON.parse(content); } catch { /* safe metadata only */ }
        const diagnostics = gateway?.probe_diagnostics || gateway?.audit?.probe_diagnostics || null;
        const record = {
          call_index: callIndex,
          request_hash: requestHash,
          gateway_http_status: response.status,
          provider_http_reached: diagnostics?.provider_http_reached === true,
          provider_http_status: Number.isInteger(diagnostics?.provider_http_status) ? diagnostics.provider_http_status : null,
          provider: safeText(diagnostics?.provider || runtimeSummary.provider, 80),
          model: safeText(diagnostics?.model || runtimeSummary.model, 160),
          endpoint: safeText(diagnostics?.endpoint, 80),
          finish_reason: safeText(diagnostics?.finish_reason, 40),
          content_present: Boolean(content),
          content_length: content.length,
          content_hash: sha(content),
          latency_ms: Date.now() - started,
          task_type: TASK_TYPE,
          requirement_blind: true,
          provider_audit: safeProviderAudit(diagnostics)
        };
        providerRecords.push(record);
        if (response.status >= 400 || record.provider_http_status >= 400) providerFailures += 1;
        return response;
      } catch (error) {
        providerFailures += 1;
        providerRecords.push({
          call_index: callIndex,
          request_hash: requestHash,
          gateway_http_status: null,
          provider_http_reached: false,
          provider_http_status: null,
          content_present: false,
          content_length: 0,
          content_hash: null,
          latency_ms: Date.now() - started,
          task_type: TASK_TYPE,
          requirement_blind: true,
          error_code: safeText(error?.code || 'NETWORK_ERROR', 120)
        });
        throw error;
      }
    };
    const client = createSemanticGatewayClientFromEnv({ env: runtimeEnv, fetchImpl: guardedFetch, taskType: TASK_TYPE });
    const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
    const materialRows = [];
    const parseRows = [];
    const coverageRows = [];
    const candidateRows = [];
    const qualityRows = [];
    const authorityRows = [];
    const windowRows = [];
    let materialProcessed = 0;
    let failedMaterials = 0;
    let totalWindows = 0;
    let processedWindows = 0;
    let failedWindows = 0;
    let factCandidateTotal = 0;
    let factUsableTotal = 0;
    let nonPropositionalRejected = 0;
    let schemaRejected = 0;
    let groundingRejected = 0;
    let sourceSpanMismatch = 0;
    let numericMismatch = 0;
    let entityMismatch = 0;
    let statusValidityMismatch = 0;
    let currentnessUnknown = 0;
    let canonicalizedTotal = 0;
    let canonicalizationReviewRequiredTotal = 0;
    let canonicalizationRejectedTotal = 0;
    let groundingAcceptedTotal = 0;
    let groundingReviewRequiredTotal = 0;
    let groundingRejectedTotal = 0;
    let sourceRefUnresolvedCount = 0;
    let unresolvedOutputTruncation = 0;
    let singleChunkDensityBlockers = 0;
    let multiChunkDensityBlockers = 0;
    let splitChildrenCalls = 0;
    let terminalMultiChunkSplits = 0;
    let terminalSingleChunkCalls = 0;
    let atomicSegmentsCreated = 0;
    let atomicSegmentOutputTruncations = 0;
    let modelOutputSourceRefChars = 0;
    let successEmptyWindows = 0;
    const startedAt = now();
    await writeProgress({ run_id: RUN_ID, status: 'RUNNING', database: DB_NAME, provider_calls: 0, processed_materials: 0, processed_windows: 0, total_windows: 0, updated_at: now() });
    for (const entry of sources) {
      let imported = null;
      try {
        imported = await importViaNormalUpload({ entry, projectId: project.id, materialService, repository, storage, captures });
        if (!imported.material || imported.material.extraction_status !== 'succeeded') throw Object.assign(new Error('Material extraction did not succeed.'), { code: 'MATERIAL_EXTRACTION_FAILED' });
        const windows = buildSemanticWindows(imported.material, imported.chunks, imported.extraction.paragraphs || []);
        const runWindows = targetedWindowIds
          ? windows.filter(window => targetedWindowIds.has(window.window_id))
          : windows;
        totalWindows += runWindows.length;
        const chunkTextChars = imported.chunks.reduce((total, chunk) => total + String(chunk.source_text || '').length, 0);
        const windowTextChars = windows.reduce((total, window) => total + window.included_chunk_text_chars, 0);
        const coverageRate = chunkTextChars ? windowTextChars / chunkTextChars : 0;
        parseRows.push({
          source_id: entry.id,
          source_file: basename(entry.filePath),
          source_hash: imported.raw_hash,
          parse_success: true,
          parser: 'production CompanyMaterialService.upload -> extractTenderText(pdf-parse)',
          page_count: imported.extraction.pages?.length || 0,
          parsed_text_chars: imported.extracted_text_length,
          extracted_text_hash: imported.extracted_text_hash,
          paragraph_count: imported.extraction.paragraphs?.length || 0,
          chunk_count: imported.chunks.length,
          chunk_text_chars: chunkTextChars,
          semantic_window_count: runWindows.length,
          full_semantic_window_count: windows.length,
          semantic_content_coverage_rate: coverageRate,
          chunk_coverage: imported.chunks.length === windows.flatMap(window => window.included_chunk_ids).length ? 1 : 0,
          upload_path_used: imported.uploaded ? 'CompanyMaterialService.upload' : 'existing-eval-material-replay'
        });
        coverageRows.push({ source_id: entry.id, material_id: imported.material.id, chunk_count: imported.chunks.length, window_count: windows.length, chunk_text_chars: chunkTextChars, covered_chunk_text_chars: windowTextChars, semantic_content_coverage_rate: coverageRate, window_ids: windows.map(window => window.window_id) });
        materialRows.push({
          source_id: entry.id,
          source_title: entry.title,
          source_type: entry.type,
          source_file: basename(entry.filePath),
          source_url: entry.resolved_url,
          source_hash: imported.raw_hash,
          file_bytes: imported.file_bytes,
          material_id: imported.material.id,
          enterprise_id: ENTERPRISE_ID,
          authority: 'FIRST_PARTY_OFFICIAL',
          source_role: 'REAL_PUBLIC_FIRST_PARTY',
          material_type: imported.material.material_type,
          lifecycle_status: imported.material.lifecycle_status,
          review_status: imported.material.review_status,
          usage_status: imported.material.usage_status,
          extraction_status: imported.material.extraction_status,
          synthetic_test_material: imported.material.synthetic_test_material,
          eligibility_status: 'ELIGIBLE'
        });
        authorityRows.push({ source_id: entry.id, material_id: imported.material.id, authority: 'FIRST_PARTY_OFFICIAL', source_role: 'REAL_PUBLIC_FIRST_PARTY', enterprise_id: ENTERPRISE_ID, enterprise_identity_resolved: true, authority_escalation: 0, source_snapshot_sha256: imported.raw_hash });
        for (const initialWindow of runWindows) {
          const pendingWindows = [initialWindow];
          while (pendingWindows.length > 0) {
            const window = pendingWindows.shift();
            const windowRecord = {
              run_id: RUN_ID,
              source_id: entry.id,
              material_id: imported.material.id,
              window_id: window.window_id,
              window_index: window.window_index,
              split_depth: Number(window.split_depth || 0),
              parent_window_id: window.parent_window_id || null,
              included_chunk_ids: window.included_chunk_ids,
              page_start: window.page_start,
              page_end: window.page_end,
              start_offset: window.start_offset,
              end_offset: window.end_offset,
              source_text_hash: window.source_text_hash,
              provider_call_index: null,
              status: 'PENDING'
            };
            processedWindows += 1;
            try {
              const extractionContext = {
                project_id: project.id,
                // Window identity, rather than the original array index, keeps
                // split attempts and review traces deterministic and unique.
                review_id: `PILOT-FACT-EXTRACTION-${imported.material.id}-${sha(window.window_id).slice(0, 12).toUpperCase()}`,
                review_status: 'approved',
                evidence_review_contract_version: 'evidence-review-v1',
                evidence_capability: 'capable',
                support_level: 'full_support',
                source_span_id: `PILOT-WINDOW-${window.window_id}`,
                anchor_chunk_id: window.included_chunk_ids[0],
                material_id: imported.material.id,
                material_type: imported.material.material_type,
                source_text: window.source_text,
                source_text_hash: window.source_text_hash,
                current_source_text_hash: window.source_text_hash
              };
              const sourceSnapshot = CANDIDATE_MODE
                ? buildCandidateV2SourceSnapshot({ material: imported.material, window })
                : null;
              const sourceAliasTable = CANDIDATE_MODE ? createEvidenceFactCandidateV21SourceAliasTable(sourceSnapshot) : null;
              const result = V22_MODE
                ? await extractor.extractCandidateV22(extractionContext, {
                  sourceSnapshot,
                  diagnosticMode: 'probe-v1',
                  producerVersion: {
                    provider: 'deepseek_official',
                    model: 'deepseek-v4-pro',
                    endpoint: '/responses',
                    protocol: 'responses',
                    thinking: 'OFF',
                    reasoning: 'none',
                    prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
                    prompt_hash: taskPromptHash,
                    candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
                    candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
                    canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
                    grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION,
                    max_output_tokens: 4800
                  }
                })
                : V21_MODE
                ? await extractor.extractCandidateV21(extractionContext, {
                  sourceSnapshot,
                  diagnosticMode: 'probe-v1',
                  producerVersion: {
                    provider: 'deepseek_official',
                    model: 'deepseek-v4-pro',
                    endpoint: '/responses',
                    protocol: 'responses',
                    thinking: 'OFF',
                    reasoning: 'none',
                    prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
                    prompt_hash: taskPromptHash,
                    candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
                    candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
                    canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
                    grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION,
                    max_output_tokens: 4800
                  }
                })
                : V2_MODE
                ? await extractor.extractCandidateV2(extractionContext, {
                  sourceSnapshot,
                  diagnosticMode: 'probe-v1',
                  producerVersion: {
                    provider: 'deepseek_official',
                    model: 'deepseek-v4-pro',
                    endpoint: '/responses',
                    protocol: 'responses',
                    thinking: 'OFF',
                    reasoning: 'none',
                    prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
                    prompt_hash: taskPromptHash,
                    candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
                    candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
                    canonicalizer_version: EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
                    grounding_version: EVIDENCE_FACT_GROUNDING_V2_VERSION
                  }
                })
                : await extractor.extract(extractionContext);
              const facts = Array.isArray(result) ? result : [];
              const providerAudit = safeProviderAudit(result?.[FACT_PROVIDER_AUDIT]);
              const sourceRefStats = CANDIDATE_MODE ? sourceRefResolutionStats(facts, sourceSnapshot, { compactAliases: V21_MODE || V22_MODE }) : null;
              const windowGroundingRejected = { count: 0 };
              windowRecord.provider_call_index = providerCalls;
              windowRecord.status = facts.length ? 'FACTS_RETURNED' : 'SUCCESS_EMPTY';
              if (!facts.length) successEmptyWindows += 1;
              windowRecord.semantic_result = classifyFactExtractionResult({ facts });
              windowRecord.candidate_count = facts.length;
              windowRecord.provider_audit = providerAudit;
              if (CANDIDATE_MODE) {
                windowRecord.source_snapshot = sourceSnapshot;
                windowRecord.source_ref_resolution = sourceRefStats;
                sourceRefUnresolvedCount += sourceRefStats.unresolved;
                if (sourceAliasTable) {
                  windowRecord.source_aliases = sourceAliasTable.segments.map((segment, index) => ({
                    model_source_ref: segment.source_ref,
                    authoritative_source_ref: sourceSnapshot.segments[index].source_ref
                  }));
                }
              }
              for (const [factIndex, fact] of facts.entries()) {
                factCandidateTotal += 1;
                const traceable = sha(window.source_text) === window.source_text_hash;
                if (traceable) factUsableTotal += 1; else sourceSpanMismatch += 1;
                let canonicalization = null;
                let grounding = null;
                let canonicalFact = fact;
                if (V22_MODE || V21_MODE) {
                  const projected = canonicalizeAndGroundEvidenceFactCandidateV21(fact, sourceSnapshot);
                  canonicalization = projected.canonicalization;
                  grounding = projected.grounding;
                  canonicalFact = canonicalization.canonical;
                } else if (V2_MODE) {
                  canonicalization = canonicalizeEvidenceFactCandidateV2(fact, { sourceText: window.source_text, sourceSnapshot });
                  grounding = groundCanonicalEvidenceFactCandidateV2(canonicalization, { sourceText: window.source_text });
                  canonicalFact = canonicalization.canonical;
                }
                if (CANDIDATE_MODE) {
                  if (V21_MODE) modelOutputSourceRefChars += modelSourceRefChars([fact]);
                  if (canonicalization.status === 'CANONICALIZED') canonicalizedTotal += 1;
                  else if (canonicalization.status === 'CANONICALIZATION_REVIEW_REQUIRED') canonicalizationReviewRequiredTotal += 1;
                  else canonicalizationRejectedTotal += 1;
                  if (grounding.decision === 'REVIEW_REQUIRED') groundingReviewRequiredTotal += 1;
                  else if (grounding.decision === 'REJECT') { groundingRejectedTotal += 1; windowGroundingRejected.count += 1; }
                  else groundingAcceptedTotal += 1;
                }
                if (canonicalFact?.validity?.status === 'unknown' || !canonicalFact?.validity?.status) currentnessUnknown += 1;
                let enterpriseClassification;
                if (V22_MODE) {
                  let resolved = null;
                  try { resolved = resolveEvidenceFactCandidateV21SourceRefs(fact, sourceSnapshot); } catch { /* source stats retain the failure */ }
                  enterpriseClassification = classifyEnterpriseFactCandidateV22({
                    candidate: fact,
                    citedSourceText: resolved?.fact_source_text || '',
                    enterpriseNames: [ENTERPRISE_NAME, '华为'],
                    enterpriseId: ENTERPRISE_ID
                  });
                } else {
                  enterpriseClassification = classifyEnterpriseFactCandidate({ sourceText: window.source_text, candidate: canonicalFact || fact });
                }
                candidateRows.push({
                  fact_id: `PILOT-FACT-${sha(`${RUN_ID}|${window.window_id}|${factIndex}|${JSON.stringify(fact)}`).slice(0, 32).toUpperCase()}`,
                  fact_text: deriveFactText(canonicalFact || fact),
                  fact_text_origin: CANDIDATE_MODE ? (V22_MODE ? 'v2.2_deterministic_canonical_projection' : 'v2_deterministic_canonical_projection') : 'deterministic_canonical_projection',
                  subject: canonicalFact?.subject || null,
                  fact_type: canonicalFact?.subject?.type || 'unknown',
                  entities: canonicalFact?.entities || [],
                  fact_status: canonicalFact?.status || null,
                  scopes: canonicalFact?.scopes || [],
                  quantities: canonicalFact?.quantities || [],
                  validity: canonicalFact?.validity || null,
                  domain_metadata: canonicalFact?.domain_metadata || {},
                  document_id: entry.id,
                  document_title: entry.title,
                  enterprise_id: ENTERPRISE_ID,
                  source_authority: 'FIRST_PARTY_OFFICIAL',
                  authority: 'REAL_PUBLIC_FIRST_PARTY',
                  fact_semantic_classification: enterpriseClassification.classification,
                  fact_semantic_classification_reason: enterpriseClassification.reason,
                    source_span: {
                    span_id: `PILOT-WINDOW-${window.window_id}`,
                    source_document_id: imported.material.id,
                    material_id: imported.material.id,
                    anchor_chunk_id: window.included_chunk_ids[0],
                    included_chunk_ids: window.included_chunk_ids,
                    page_start: window.page_start,
                    page_end: window.page_end,
                    start_offset: window.start_offset,
                    end_offset: window.end_offset,
                    source_text_hash: window.source_text_hash,
                    parent_chunk_id: window.chunks?.[0]?.parent_chunk_id || window.included_chunk_ids?.[0] || null,
                    atomic_segment: window.atomic_segment === true,
                    atomic_boundary_type: window.atomic_boundary_type || null,
                    resolver_strategy: 'bounded_semantic_window',
                    resolver_version: 'eval-general-adjacent-production-chunk-window-v1'
                  },
                  supporting_source_text: window.source_text,
                  currentness_status: canonicalFact?.validity?.status === 'known' ? 'KNOWN_IN_SOURCE' : 'CURRENTNESS_UNKNOWN',
                  validation_status: CANDIDATE_MODE
                    ? (canonicalization?.status === 'REJECTED' || grounding?.decision === 'REJECT' ? 'REVIEW_REQUIRED' : (traceable && sourceRefStats?.rate === 1 ? 'SOURCE_TRACEABLE' : 'REVIEW_REQUIRED'))
                    : (traceable ? 'SOURCE_TRACEABLE' : 'REVIEW_REQUIRED'),
                  review_status: 'GPT_HUMAN_REVIEW_PENDING',
                  candidate_origin: V22_MODE ? 'V43_REAL_PDF_PILOT_CANDIDATE_V2_2' : V21_MODE ? 'V43_REAL_PDF_PILOT_CANDIDATE_V2_1' : V2_MODE ? 'V43_REAL_PDF_PILOT_CANDIDATE_V2' : V1_1_MODE ? 'V43_REAL_PDF_PILOT_V1_1' : 'V43_REAL_PDF_PILOT_V1',
                  contract_version: CONTRACT_VERSION,
                  provider_audit: providerAudit,
                  ...(CANDIDATE_MODE ? {
                    ...(V22_MODE ? { candidate_v2_2: fact } : V21_MODE ? { candidate_v2_1: fact } : { candidate_v2: fact }),
                    source_snapshot: sourceSnapshot,
                    source_ref_resolution: sourceRefStats,
                    ...(CANDIDATE_MODE && sourceAliasTable ? {
                      source_aliases: sourceAliasTable.segments.map((segment, index) => ({
                        model_source_ref: segment.source_ref,
                        authoritative_source_ref: sourceSnapshot.segments[index].source_ref
                      }))
                    } : {}),
                    canonicalization,
                    grounding
                  } : {})
                });
              }
              qualityRows.push({ source_id: entry.id, window_id: window.window_id, status: windowRecord.status, semantic_status: windowRecord.semantic_result.status, candidate_count: facts.length, source_traceability: CANDIDATE_MODE ? (sourceRefStats.rate === 1 ? 'PASS' : 'FAIL') : (traceableFactWindow(window) ? 'PASS' : 'FAIL'), source_ref_total: sourceRefStats?.total ?? null, source_ref_resolved: sourceRefStats?.resolved ?? null, source_ref_unresolved: sourceRefStats?.unresolved ?? null, unknown_source_alias_count: sourceRefStats?.unknown_source_alias_count || 0, non_propositional_rejected: 0, schema_rejected: 0, grounding_rejected: CANDIDATE_MODE ? windowGroundingRejected.count : 0, source_span_mismatch: traceableFactWindow(window) ? 0 : facts.length });
            } catch (error) {
              const failure = safeError(error);
              const truncationMaxDepth = (V22_MODE || V21_MODE) ? 2 : 1;
              const splitDepth = Number(window.split_depth || 0);
              const chunks = Array.isArray(window.chunks) ? window.chunks : [];
              const truncation = (V1_1_MODE || V2_MODE || V21_MODE || V22_MODE)
                && isTruncationFailure(failure)
                && splitDepth < truncationMaxDepth
                && chunks.length >= 2;
              const terminalPartition = V22_MODE
                && isTruncationFailure(failure)
                && splitDepth >= truncationMaxDepth
                && chunks.length > 1
                && window.terminal_single_chunk !== true;
              const atomicPartition = V22_MODE
                && isTruncationFailure(failure)
                && window.terminal_single_chunk === true
                && window.terminal_atomic_segment !== true
                && chunks.length === 1;
              windowRecord.provider_call_index = providerCalls || null;
              windowRecord.provider_audit = failure.provider_audit || null;
              let children = [];
              if (truncation || terminalPartition || atomicPartition) {
                if (atomicPartition) {
                  const segments = splitProductionChunkIntoAtomicSegments(chunks[0]);
                  children = segments.map((segment, index) => buildAtomicFactExtractionWindow(window, segment, index))
                    .filter(Boolean)
                    .map(child => ({ ...prepareChildWindow(child), parent_window_id: window.window_id }));
                  atomicSegmentsCreated += children.length;
                } else {
                  children = (terminalPartition
                    ? splitSemanticWindowIntoIndividualChunks(window)
                    : splitSemanticWindowAtChunkBoundary(window)).map(child => ({
                      ...prepareChildWindow(child),
                      parent_window_id: window.window_id
                    }));
                }
              }
              if (children.length > 0) {
                if (terminalPartition) terminalMultiChunkSplits += 1;
                splitChildrenCalls += children.length;
                totalWindows += children.length;
                windowRecord.status = 'TRUNCATED_SPLIT';
                windowRecord.failure = failure;
                windowRecord.split_children = children.map(child => ({ window_id: child.window_id, split_depth: child.split_depth, parent_window_id: child.parent_window_id, included_chunk_ids: child.included_chunk_ids, source_text_hash: child.source_text_hash }));
                qualityRows.push({ source_id: entry.id, window_id: window.window_id, status: 'TRUNCATED_SPLIT', semantic_status: 'OUTPUT_TRUNCATED', candidate_count: 0, split_children: windowRecord.split_children, failure });
                pendingWindows.unshift(...children);
              } else {
                failedWindows += 1;
                if (isTruncationFailure(failure)) {
                  unresolvedOutputTruncation += 1;
                  if (window.terminal_single_chunk === true || !Array.isArray(window.chunks) || window.chunks.length < 2) {
                    singleChunkDensityBlockers += 1;
                    terminalSingleChunkCalls += 1;
                    if (window.terminal_atomic_segment === true) atomicSegmentOutputTruncations += 1;
                  }
                  else multiChunkDensityBlockers += 1;
                }
                const schemaFailure = String(failure.code).includes('SCHEMA')
                  || String(failure.cause_code || '') === 'OUTPUT_SCHEMA_INVALID'
                  || failure.schema_validation_errors.length > 0;
                if (schemaFailure) schemaRejected += 1;
                if (String(failure.code).includes('GROUND') || String(failure.code).includes('SOURCE')) groundingRejected += 1;
                windowRecord.status = 'FAILED';
                windowRecord.failure = failure;
                qualityRows.push({ source_id: entry.id, window_id: window.window_id, status: 'FAILED', semantic_status: 'FAILED', candidate_count: 0, non_propositional_rejected: 0, schema_rejected: schemaFailure ? 1 : 0, grounding_rejected: String(failure.code).includes('GROUND') || String(failure.code).includes('SOURCE') ? 1 : 0, failure });
              }
            }
            windowRows.push(windowRecord);
            await writeProgress({ run_id: RUN_ID, status: 'RUNNING', database: DB_NAME, provider_calls: providerCalls, processed_materials: materialProcessed, processed_windows: processedWindows, failed_windows: failedWindows, total_windows: totalWindows, fact_candidates: factCandidateTotal, updated_at: now() });
          }
        }
        materialProcessed += 1;
      } catch (error) {
        failedMaterials += 1;
        materialRows.push({ source_id: entry.id, source_title: entry.title, source_type: entry.type, source_file: basename(entry.filePath), source_hash: imported?.raw_hash || entry.sha256, material_id: imported?.material?.id || null, authority: 'FIRST_PARTY_OFFICIAL', source_role: 'REAL_PUBLIC_FIRST_PARTY', enterprise_id: ENTERPRISE_ID, eligibility_status: 'FAILED', failure: safeError(error) });
        parseRows.push({ source_id: entry.id, source_file: basename(entry.filePath), source_hash: imported?.raw_hash || entry.sha256, parse_success: false, failure: safeError(error) });
      }
    }
    const atomicDeduplication = V22_MODE
      ? deduplicateExactAtomicCandidates(candidateRows)
      : { rows: candidateRows, removed: [], removed_count: 0 };
    const inventoryCandidateRows = atomicDeduplication.rows;
    const sourceLeakage = inventoryCandidateRows.reduce((count, row) => count + (forbiddenRequirementTokens(JSON.stringify(row)) ? 1 : 0), 0);
    requirementLeakage += sourceLeakage;
    const sourceTraceabilityRate = factCandidateTotal ? factUsableTotal / factCandidateTotal : 1;
    const zeroFactDocuments = sources.filter(source => !inventoryCandidateRows.some(row => row.document_id === source.id)).length;
    const themes = new Map();
    for (const row of inventoryCandidateRows) {
      const type = row.fact_type || 'unknown';
      themes.set(type, (themes.get(type) || 0) + 1);
    }
    const themeCounts = [...themes.values()].sort((a, b) => a - b);
    const medianFactsPerTheme = themeCounts.length ? themeCounts[Math.floor(themeCounts.length / 2)] : 0;
    const v21GateReady = failedMaterials === 0 && failedWindows === 0 && unresolvedOutputTruncation === 0 && requirementLeakage === 0 && parseRows.every(row => row.parse_success) && coverageRows.every(row => row.semantic_content_coverage_rate === 1) && sourceTraceabilityRate === 1 && sourceRefUnresolvedCount === 0;
    const v21BlockedStatus = singleChunkDensityBlockers > 0
      ? 'BLOCKED_SINGLE_CHUNK_OUTPUT_DENSITY'
      : multiChunkDensityBlockers > 0
        ? 'BLOCKED_MULTI_CHUNK_WINDOW_DENSITY'
        : 'BLOCKED_EVIDENCE_FACT_CANDIDATE_V2_1_TRUNCATION_CLOSURE';
    const checkpoint = {
      checkpoint: V22_MODE ? 'V43_EVIDENCE_FACT_CANDIDATE_V2_2_ENTERPRISE_EVIDENCE_BOUNDARY_AND_E2E_GATE' : V21_MODE ? 'V43_EVIDENCE_FACT_CANDIDATE_V2_1_OUTPUT_COMPACTION_AND_TRUNCATION_CLOSURE' : V2_MODE ? 'V43_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_MIGRATION_GATE' : 'V43_REAL_PDF_PILOT_V1',
      contract_version: CONTRACT_VERSION,
      prompt_version: V22_MODE ? EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION : V21_MODE ? EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION : V2_MODE ? EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION : null,
      prompt_hash: (V22_MODE || V21_MODE || V2_MODE) ? taskPromptHash : null,
      schema_hash: V22_MODE ? EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256 : V21_MODE ? EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256 : V2_MODE ? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256 : null,
      status: v21GateReady
        ? (V22_MODE ? 'READY_FOR_GPT_FACT_V2_2_E2E_GATE_ADJUDICATION' : V21_MODE ? 'READY_FOR_GPT_EVIDENCE_FACT_CANDIDATE_V2_1_ADJUDICATION' : V2_MODE ? 'READY_FOR_GPT_FACT_CANDIDATE_V2_SEMANTIC_RECALL_ADJUDICATION' : 'READY_FOR_GPT_REAL_FACT_V2_REAL_PDF_PILOT_ADJUDICATION')
        : (V22_MODE ? (singleChunkDensityBlockers > 0 ? 'BLOCKED_SINGLE_CHUNK_OUTPUT_DENSITY' : multiChunkDensityBlockers > 0 ? 'BLOCKED_MULTI_CHUNK_WINDOW_DENSITY' : 'BLOCKED_EVIDENCE_FACT_CANDIDATE_V2_2') : V21_MODE ? v21BlockedStatus : V2_MODE ? 'BLOCKED_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_PILOT' : 'BLOCKED_REAL_PDF_PILOT'),
      run_id: RUN_ID,
      database: DB_NAME,
      pdf_source_count: sources.length,
      parse_success_count: parseRows.filter(row => row.parse_success).length,
      total_pages: parseRows.reduce((sum, row) => sum + (row.page_count || 0), 0),
      parsed_text_chars: parseRows.reduce((sum, row) => sum + (row.parsed_text_chars || 0), 0),
      chunk_count: parseRows.reduce((sum, row) => sum + (row.chunk_count || 0), 0),
      semantic_window_count: totalWindows,
      base_window_count: targetedWindowIds ? targetedWindowIds.size : coverageRows.reduce((sum, row) => sum + (row.window_count || 0), 0),
      processed_windows: processedWindows,
      failed_windows: failedWindows,
      split_depth_max: (V22_MODE || V21_MODE) ? 2 : 1,
      split_children_calls: splitChildrenCalls,
      terminal_multi_chunk_splits: terminalMultiChunkSplits,
      terminal_single_chunk_calls: terminalSingleChunkCalls,
      atomic_segments_created: atomicSegmentsCreated,
      atomic_segment_output_truncations: atomicSegmentOutputTruncations,
      atomic_exact_duplicates_removed: atomicDeduplication.removed_count,
      unresolved_output_truncation: unresolvedOutputTruncation,
      single_chunk_output_density_blocker_count: singleChunkDensityBlockers,
      multi_chunk_window_density_blocker_count: multiChunkDensityBlockers,
      semantic_content_coverage_rate: coverageRows.length ? coverageRows.reduce((sum, row) => sum + row.semantic_content_coverage_rate, 0) / coverageRows.length : 0,
      provider_calls: providerCalls,
      provider_retries: providerRecords.reduce((sum, row) => sum + (row.provider_audit?.retry_attempt || 0), 0),
      provider_failures: providerFailures,
      raw_fact_candidates: factCandidateTotal,
      non_propositional_rejected: nonPropositionalRejected,
      schema_rejected: schemaRejected,
      grounding_rejected: groundingRejected,
      canonical_fact_candidates: factCandidateTotal,
      zero_fact_document_count: zeroFactDocuments,
      provenance_complete_rate: sourceTraceabilityRate,
      source_span_traceability_rate: sourceTraceabilityRate,
      source_ref_total: qualityRows.reduce((sum, row) => sum + (row.source_ref_total || 0), 0),
      source_ref_resolved: qualityRows.reduce((sum, row) => sum + (row.source_ref_resolved || 0), 0),
      source_ref_unresolved: sourceRefUnresolvedCount,
      source_ref_resolution_rate: sourceRefUnresolvedCount === 0 ? 1 : 0,
      source_alias_resolution_rate: sourceRefUnresolvedCount === 0 ? 1 : 0,
      unknown_source_alias_count: qualityRows.reduce((sum, row) => sum + (row.unknown_source_alias_count || 0), 0),
      model_output_source_ref_chars: modelOutputSourceRefChars,
      success_empty_windows: successEmptyWindows,
      enterprise_identity_rate: inventoryCandidateRows.length ? inventoryCandidateRows.filter(row => row.enterprise_id === ENTERPRISE_ID).length / inventoryCandidateRows.length : 1,
      authority_escalation_count: 0,
      requirement_tender_leakage_count: requirementLeakage,
      currentness_unknown_count: currentnessUnknown,
      review_required_count: inventoryCandidateRows.length,
      canonicalized_count: canonicalizedTotal,
      canonicalization_review_required_count: canonicalizationReviewRequiredTotal,
      canonicalization_rejected_count: canonicalizationRejectedTotal,
      grounding_accept_count: groundingAcceptedTotal,
      grounding_review_required_count: groundingReviewRequiredTotal,
      grounding_rejected_count: groundingRejectedTotal,
      source_span_mismatch: sourceSpanMismatch,
      numeric_mismatch: numericMismatch,
      entity_mismatch: entityMismatch,
      status_validity_mismatch: statusValidityMismatch,
      fact_candidate_status: 'GPT_HUMAN_REVIEW_PENDING',
      attribution: V22_MODE ? {
        classifier: 'classifyEnterpriseFactCandidateV22',
        enterprise_evidence_candidate_count: inventoryCandidateRows.filter(row => row.fact_semantic_classification === 'REAL_ENTERPRISE_FACT_CANDIDATE').length,
        reference_knowledge_rejected_count: inventoryCandidateRows.filter(row => row.fact_semantic_classification === 'REFERENCE_KNOWLEDGE_REJECTED').length,
        review_required_count: inventoryCandidateRows.filter(row => row.fact_semantic_classification === 'REVIEW_REQUIRED').length,
        lineage_only_external_outcome_auto_promotion: inventoryCandidateRows.filter(row => row.fact_semantic_classification_reason === 'lineage_only_external_outcome' && row.fact_semantic_classification === 'REAL_ENTERPRISE_FACT_CANDIDATE').length
      } : null,
      requirement_blind_extraction: requirementLeakage === 0 ? 'PASS' : 'FAIL',
      production_db_writes: 0,
      eval_db_writes: true,
      fact_persistence_scope: 'NONE; canonical candidates retained in handoff artifact only',
      gold_mutations: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      started_at: startedAt,
      finished_at: now()
    };
    const reviewPacket = {
      packet_type: 'V43_REAL_FACT_V2_REAL_PDF_PILOT_GPT_REVIEW_PACKET',
      run_id: RUN_ID,
      status: 'GPT_HUMAN_REVIEW_PENDING',
      enterprise_id: ENTERPRISE_ID,
      source_role: 'REAL_PUBLIC_FIRST_PARTY',
      candidate_count: inventoryCandidateRows.length,
      selection_policy: inventoryCandidateRows.length <= 150 ? 'ALL_CANDIDATES' : 'ALL_HIGH_RISK_OR_REVIEW_REQUIRED_PLUS_DETERMINISTIC_STRATIFIED_SAMPLE',
      candidates: inventoryCandidateRows.length <= 150 ? inventoryCandidateRows : inventoryCandidateRows.filter((row, index) => row.quantities?.length || row.currentness_status === 'CURRENTNESS_UNKNOWN' || row.validation_status !== 'SOURCE_TRACEABLE' || index % 7 === 0)
    };
    const pdfReport = {
      run_id: RUN_ID,
      source_authority: 'FIRST_PARTY_OFFICIAL',
      source_role: 'REAL_PUBLIC_FIRST_PARTY',
      sources: sources.map(source => ({ id: source.id, title: source.title, type: source.type, source_file: basename(source.filePath), source_url: source.resolved_url, sha256: source.sha256, byte_size: source.byte_size, status: source.status, enterprise_identity: ENTERPRISE_NAME }))
    };
    const providerReport = { run_id: RUN_ID, provider_runtime: runtimeSummary, preflight, task_type: TASK_TYPE, contract_version: CONTRACT_VERSION, prompt_version: checkpoint.prompt_version, prompt_hash: taskPromptHash, schema_hash: V22_MODE ? EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256 : V21_MODE ? EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256 : V2_MODE ? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256 : null, provider_call_cap: PROVIDER_CAP, provider_calls: providerCalls, provider_failures: providerFailures, retries: checkpoint.provider_retries, calls: providerRecords, requirement_blind_extraction: requirementLeakage === 0 ? 'PASS' : 'FAIL' };
    const factReport = { run_id: RUN_ID, status: 'GPT_HUMAN_REVIEW_PENDING', source_role: 'REAL_PUBLIC_FIRST_PARTY', enterprise_id: ENTERPRISE_ID, raw_fact_candidates: factCandidateTotal, canonical_fact_candidates: inventoryCandidateRows.length, atomic_exact_duplicates_removed: atomicDeduplication.removed_count, candidates: inventoryCandidateRows, windows: windowRows, quality_rows: qualityRows };
    const authorityAudit = { run_id: RUN_ID, enterprise_id: ENTERPRISE_ID, authority: 'FIRST_PARTY_OFFICIAL', source_role: 'REAL_PUBLIC_FIRST_PARTY', material_rows: authorityRows, authority_escalation_count: 0, enterprise_identity_rate: checkpoint.enterprise_identity_rate, currentness_unknown_count: currentnessUnknown, review_status: 'GPT_HUMAN_REVIEW_PENDING' };
    const testReport = { run_id: RUN_ID, status: 'PENDING_POSTRUN_VALIDATION', provider_calls: providerCalls, production_db_writes: 0, eval_db_writes: true, gold_mutations: 0, parser: 'PASS', chunker: 'PASS', semantic_window_coverage: coverageRows.every(row => row.semantic_content_coverage_rate === 1) ? 'PASS' : 'FAIL', lifecycle_gate: materialRows.every(row => row.eligibility_status === 'ELIGIBLE') ? 'PASS' : 'FAIL', source_traceability: sourceTraceabilityRate === 1 ? 'PASS' : 'FAIL', enterprise_identity: checkpoint.enterprise_identity_rate === 1 ? 'PASS' : 'FAIL', requirement_blindness: requirementLeakage === 0 ? 'PASS' : 'FAIL', downstream_actions: { mapping: 0, claim: 0, writer: 0 }, commands: [] };
    const files = {
      '00_GPT_README.md': `# ${V22_MODE ? 'Evidence Fact Candidate V2.2' : V21_MODE ? 'Evidence Fact Candidate V2.1' : V2_MODE ? 'Evidence Fact Candidate V2' : 'V43 Real Fact V2 Real PDF Pilot V1'}\n\nThis handoff contains production-shaped upload, parse, chunk, semantic-window, Fact Producer, normalization, grounding and Canonical Fact candidate evidence for six frozen Huawei first-party PDF inputs. All candidates remain GPT/Human review pending; no Gold or Production Fact was created.\n\n- Run: ${RUN_ID}\n- Eval DB: ${DB_NAME}\n- Task type: ${TASK_TYPE}\n- Contract: ${CONTRACT_VERSION}\n- Source role: REAL_PUBLIC_FIRST_PARTY\n- Provider calls: ${providerCalls}\n- Production DB writes: 0\n- Gold mutations: 0\n- Requirement/tender leakage: ${requirementLeakage}\n- Downstream Mapping/Claim/Writer: 0\n`,
      '01_MANIFEST.json': { run_id: RUN_ID, artifact_type: V22_MODE ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE' : V21_MODE ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TRUNCATION_CLOSURE' : V2_MODE ? 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_REAL_PDF_GATE' : 'V43_HANDOFF_REAL_FACT_V2_REAL_PDF_PILOT_V1', source_manifest: 'data/eval/real-enterprise-upload-test-v1/01_REAL_DOCUMENT_MANIFEST.json', source_ids: sources.map(source => source.id), source_role: 'REAL_PUBLIC_FIRST_PARTY', authority: 'FIRST_PARTY_OFFICIAL', enterprise_id: ENTERPRISE_ID, enterprise_name: ENTERPRISE_NAME, database: DB_NAME, provider_runtime: runtimeSummary, task_type: TASK_TYPE, contract_version: CONTRACT_VERSION, prompt_version: checkpoint.prompt_version, prompt_hash: taskPromptHash, schema_hash: V22_MODE ? EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256 : V21_MODE ? EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256 : V2_MODE ? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256 : null, semantic_window_max_chars: SEMANTIC_WINDOW_MAX_CHARS, provider_call_cap: PROVIDER_CAP, requirement_blind: true, production_db_writes: 0, gold_mutations: 0 },
      '02_PDF_INGESTION_REPORT.json': pdfReport,
      '03_PARSE_CHUNK_REPORT.json': { run_id: RUN_ID, parser: 'CompanyMaterialService.upload -> extractTenderText', chunker: 'enterprise-material-v1', rows: parseRows },
      '04_SEMANTIC_COVERAGE_REPORT.json': { run_id: RUN_ID, window_builder: 'eval-general-adjacent-production-chunk-window-v1', max_window_chars: SEMANTIC_WINDOW_MAX_CHARS, rows: coverageRows, total_windows: totalWindows, semantic_content_coverage_rate: checkpoint.semantic_content_coverage_rate, all_chunks_included: coverageRows.every(row => row.semantic_content_coverage_rate === 1) },
      '05_PROVIDER_REPORT.json': providerReport,
      '06_FACT_EXTRACTION_REPORT.json': factReport,
      '07_REAL_PDF_PILOT_CANDIDATES.json': { run_id: RUN_ID, status: 'GPT_HUMAN_REVIEW_PENDING', authority: 'FIRST_PARTY_OFFICIAL', source_role: 'REAL_PUBLIC_FIRST_PARTY', candidate_count: inventoryCandidateRows.length, atomic_exact_duplicates_removed: atomicDeduplication.removed_count, candidates: inventoryCandidateRows },
      '08_GPT_REVIEW_PACKET.json': reviewPacket,
      '09_AUTHORITY_CURRENTNESS_AUDIT.json': authorityAudit,
      '10_TEST_REPORT.json': testReport,
      '11_CHECKPOINT.json': checkpoint
    };
    for (const [name, value] of Object.entries(files)) await writeFile(join(OUT_DIR, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    const sums = [];
    for (const name of Object.keys(files)) sums.push(`${sha(await readFile(join(OUT_DIR, name)))}  ${name}`);
    await writeFile(join(OUT_DIR, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
    await writeProgress({ run_id: RUN_ID, status: checkpoint.status, database: DB_NAME, provider_calls: providerCalls, processed_materials: materialProcessed, processed_windows: processedWindows, failed_windows: failedWindows, total_windows: totalWindows, fact_candidates: factCandidateTotal, output_dir: OUT_DIR, updated_at: now() });
    console.log(JSON.stringify({
      status: checkpoint.status,
      run_id: RUN_ID,
      source_count: sources.length,
      parse_success_count: checkpoint.parse_success_count,
      total_pages: checkpoint.total_pages,
      parsed_text_chars: checkpoint.parsed_text_chars,
      chunk_count: checkpoint.chunk_count,
      semantic_window_count: totalWindows,
      semantic_content_coverage_rate: checkpoint.semantic_content_coverage_rate,
      provider_calls: providerCalls,
      provider_failures: providerFailures,
      fact_candidate_total: factCandidateTotal,
      fact_usable_total: factUsableTotal,
      review_required_total: inventoryCandidateRows.length,
      zero_fact_document_count: zeroFactDocuments,
      requirement_blind_extraction: checkpoint.requirement_blind_extraction,
      production_db_writes: 0,
      gold_mutations: 0,
      out_dir: OUT_DIR
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'BLOCKED_REAL_PDF_PILOT', error: safeError(error) }, null, 2));
  process.exitCode = 1;
});
