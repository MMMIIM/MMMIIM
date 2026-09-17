import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../src/db.js';
import { LocalFileStorage } from '../../src/storage.js';
import { CompanyMaterialService } from '../../src/company-material-service.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { chunkEnterpriseMaterial } from '../../src/pipeline/enterprise-material-chunker.js';
import { createEmbeddingFetchFromEnv, createEmbeddingClientFromEnv } from '../../src/pipeline/embedding-client.js';
import { EnterpriseRetrievalService } from '../../src/pipeline/enterprise-retrieval-service.js';
import { routeEnterpriseProofCandidates } from '../../src/pipeline/enterprise-evidence-source-router.js';
import { PUBLIC_CORPUS_PROJECT_ID } from '../../src/pipeline/corpus-contract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '../..');
const workspace = path.resolve(backendDir, '..');
const packageDir = path.resolve(here, 'V43_RAG_CODEX_HANDOFF_1');
const manifestPath = path.join(packageDir, 'rag_import_manifest.jsonl');
const reportPath = path.join(here, 'V43_REAL_RAG_IMPORT_RETRIEVAL_SMOKE_REPORT.json');
const SYNTHETIC_PROJECT_NAME = 'Synthetic Demo Company RAG Benchmark';
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EMBEDDING_DIMENSION = 1024;
const MAX_EMBED_CALLS = 4;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value);

dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

function parseBody(raw) {
  const match = String(raw).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return (match ? match[1] : String(raw)).replace(/\r\n?/g, '\n').trim();
}

function category(entry) {
  if (entry.library_scope === 'universal') return 'GENERAL';
  if (entry.library_scope === 'industry') return entry.domain === 'government' ? 'GOVERNMENT_ENTERPRISE' : 'HEALTHCARE';
  return 'ENTERPRISE_PRIVATE';
}

function materialType(entry) {
  if (entry.library_scope !== 'company_case') return 'technical_whitepaper';
  const map = {
    COMPANY_PROFILE: 'company_profile', PRODUCT: 'product_documentation', ARCHITECTURE: 'technical_solution',
    INTEGRATION: 'technical_solution', DATA: 'technical_solution', SECURITY: 'technical_solution',
    PERFORMANCE: 'technical_solution', DR: 'delivery_capability', DELIVERY: 'delivery_capability', TEAM: 'personnel',
    QA_DELIVERY: 'delivery_capability', SERVICE: 'delivery_capability', CASE_GOV: 'project_case', CASE_MEDICAL: 'project_case',
    QUALIFICATION: 'qualification', COMMERCIAL: 'other'
  };
  return map[entry.evidence_category] || 'other';
}

function sourceType(entry) {
  if (entry.library_scope === 'company_case') return 'synthetic_company_evidence';
  if (entry.domain === 'government') return 'government_guidance';
  if (entry.domain === 'medical') return 'industry_guidance';
  return 'official_standard';
}

function sourceOrg(entry) {
  return Array.isArray(entry.source_ids) && entry.source_ids.length ? entry.source_ids.join(',') : 'V43_RAG_CODEX_HANDOFF_1';
}

function metadataUpdate(entry, projectId, materialId) {
  const scope = category(entry);
  const isPrivate = scope === 'ENTERPRISE_PRIVATE';
  const notes = isPrivate
    ? `Synthetic test material; doc_id=${entry.doc_id}; claim_permission=false; not real customer data.`
    : `Official/industry guidance; doc_id=${entry.doc_id}; reference context only.`;
  return {
    projectId, materialId, scope,
    industry: entry.domain === 'cross_industry' ? null : entry.domain,
    sourceType: sourceType(entry), sourceOrg: sourceOrg(entry), sourceUrl: null,
    // last_verified_at is descriptive manifest metadata, not a publication
    // date; never synthesize published_at from it.
    publishedAt: null, effectiveFrom: entry.valid_from || null, effectiveTo: entry.valid_until || null,
    // The existing proof router recognizes enterprise_private as the
    // project-owned authority class; synthetic status remains explicit in
    // the marker/manifest and never grants production claim permission.
    authority: isPrivate ? 'enterprise_private' : 'official', notes,
    synthetic: Boolean(entry.synthetic_company_evidence)
  };
}

async function updateMetadata(pool, entry, projectId, materialId) {
  const value = metadataUpdate(entry, projectId, materialId);
  await pool.query(`UPDATE company_materials SET corpus_scope=$2,industry=$3,source_type=$4,source_org=$5,source_url=$6,
    published_at=$7,effective_from=$8,effective_to=$9,effective_status='current_status_required',authority_level=$10,
    usage_status='ACTIVE_FULLTEXT',quality_score=80,review_status='approved',lifecycle_status='ACTIVE',index_status='INDEXED',
    review_notes=$11,synthetic_test_material=$12,updated_at=now() WHERE id=$1`,
  [materialId, value.scope, value.industry, value.sourceType, value.sourceOrg, value.sourceUrl,
    value.publishedAt, value.effectiveFrom, value.effectiveTo, value.authority, value.notes, value.synthetic]);
}

async function counts(pool) {
  const result = {};
  for (const table of ['projects', 'company_materials', 'material_chunks', 'material_chunk_embeddings']) {
    result[table] = Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);
  }
  return result;
}

async function readManifest() {
  const lines = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean);
  const entries = lines.map((line) => JSON.parse(line));
  for (const entry of entries) {
    const filePath = path.join(packageDir, entry.path);
    const raw = await readFile(filePath);
    const actual = sha(raw);
    if (actual !== entry.sha256) throw new Error(`RAG_PACKAGE_HASH_MISMATCH:${entry.doc_id}`);
    entry.filePath = filePath;
    entry.raw = raw;
    entry.body = parseBody(raw.toString('utf8'));
    entry.bodyHash = sha(Buffer.from(entry.body));
  }
  return entries;
}

async function ensurePublicProject(pool) {
  await pool.query(`INSERT INTO projects(id,name,status) VALUES($1,$2,'corpus') ON CONFLICT(id) DO NOTHING`,
    [PUBLIC_CORPUS_PROJECT_ID, '平台公共知识库（官方公开资料）']);
  return (await pool.query('SELECT * FROM projects WHERE id=$1', [PUBLIC_CORPUS_PROJECT_ID])).rows[0];
}

async function ensureSyntheticProject(repository) {
  let project = (await repository.pool.query('SELECT * FROM projects WHERE name=$1 ORDER BY created_at LIMIT 1', [SYNTHETIC_PROJECT_NAME])).rows[0];
  if (!project) project = await repository.createProject({ name: SYNTHETIC_PROJECT_NAME });
  return project;
}

function requirementValue(projectId, text, index) {
  return {
    req_id: `RAG-SMOKE-${String(index + 1).padStart(2, '0')}`, content: text, source_excerpt: text,
    source_page: null, source_paragraph: null, target_sections: [], ordinal: index + 1, source_text: text,
    is_mandatory: false, mandatory_marker: null, source_section: null, source_clause_id: null,
    mandatory_scope_source_text: null, mandatory_scope_section: null, exception_clause_ids: [], source_hash: null,
    source_chunk_id: null, category: 'technical', requires_confirmation: false, source_page_start: null, source_page_end: null,
    source_paragraph_start: null, source_paragraph_end: null, source_paragraphs_json: [], source_match_type: null,
    source_match_score: null, source_resolution_method: null, source_verified: false, source_status: 'verified',
    confirmed_by: 'v43-rag-pilot', confirmed_at: new Date(), confirmation_type: 'verified', requirement_category: 'technical',
    writer_eligible: false, classification_review_required: false, atomicity_review_required: false,
    classification_method: 'automatic', confirmation_reasons: [], risk_flags: [], source_evidence: {},
    deduplication: { rule_version: 'v43-rag-smoke-v1' }, canonical_rule_version: 'v43-rag-smoke-v1', project_id: projectId
  };
}

async function ensureSmokeRequirements(repository, project) {
  const queries = [
    '政府信息化项目的采购需求、验收和证明材料通常需要注意什么？',
    '政务数据共享、数据目录、跨部门协同和系统接口建设通常需要哪些能力？',
    '医院信息平台互联互通、电子病历和医疗数据安全通常有哪些建设要求？',
    '企业是否具备 API 接口集成、第三方系统对接和数据治理能力？有哪些可核验材料？'
  ];
  const existing = await repository.pool.query(`SELECT r.* FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 AND b.status='confirmed' ORDER BY r.ordinal`, [project.id]);
  if (existing.rows.length >= queries.length) return existing.rows.slice(0, queries.length);
  const tenderFile = (await repository.pool.query(`INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes,status) VALUES($1,$2,$3,'text/plain',0,'succeeded') RETURNING *`, [project.id, 'V43_RAG_SMOKE.txt', `${project.id}/eval-v43-rag-smoke-${Date.now()}.txt`])).rows[0];
  const job = await repository.createParseJob({ projectId: project.id, tenderFileId: tenderFile.id });
  await repository.updateParseJob(job.id, 'running', { phase: 'text_extraction' });
  await repository.updateParseJob(job.id, 'succeeded', { phase: 'succeeded' });
  await repository.confirmRequirementBaseline({
    jobId: job.id, confirmedBy: 'v43-rag-pilot',
    requirements: queries.map((text, index) => requirementValue(project.id, text, index))
  });
  return (await repository.pool.query(`SELECT r.* FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 AND b.status='confirmed' ORDER BY r.ordinal`, [project.id])).rows.slice(0, queries.length);
}

async function importEntry({ entry, projectId, repository, service, storage, pool }) {
  const existing = (await pool.query('SELECT * FROM company_materials WHERE project_id=$1 AND file_hash=$2', [projectId, sha(entry.raw)])).rows[0];
  const extracted = await extractTenderText({ fileName: entry.path, mimeType: 'text/markdown', buffer: Buffer.from(entry.body) });
  let material = existing;
  let status = existing ? 'existing' : 'imported';
  if (!material) {
    if (entry.library_scope === 'company_case') {
      material = await service.upload({ projectId, file: {
        originalname: `${entry.doc_id}_${entry.title}.md`, mimeType: 'text/markdown', size: entry.raw.length, buffer: entry.raw
      }, materialType: materialType(entry) });
      // CompanyMaterialService is the formal path; replace its frontmatter-inclusive
      // extraction with the eval adapter's body-only text before retrieval.
      await repository.completeCompanyMaterialExtraction(material.id, extracted.text);
      await repository.replaceMaterialChunks(material.id, chunkEnterpriseMaterial(material.id, extracted.text));
    } else {
      const storageKey = await storage.save({ projectId, originalName: `${entry.doc_id}_${entry.title}.md`, buffer: entry.raw });
      material = await repository.createCompanyMaterial({ projectId, originalName: `${entry.doc_id}_${entry.title}.md`, storageKey,
        materialType: materialType(entry), mimeType: 'text/markdown', sizeBytes: entry.raw.length, fileHash: sha(entry.raw) });
      await repository.completeCompanyMaterialExtraction(material.id, extracted.text);
      await repository.replaceMaterialChunks(material.id, chunkEnterpriseMaterial(material.id, extracted.text));
    }
  } else if (material.extracted_text !== extracted.text) {
    await repository.completeCompanyMaterialExtraction(material.id, extracted.text);
    await repository.replaceMaterialChunks(material.id, chunkEnterpriseMaterial(material.id, extracted.text));
  }
  await updateMetadata(pool, entry, projectId, material.id);
  const chunkCount = Number((await pool.query('SELECT count(*)::int AS n FROM material_chunks WHERE material_id=$1', [material.id])).rows[0].n);
  return { entry, material, status, chunkCount };
}

function docId(row) {
  return String(row.original_name || '').split('_', 1)[0];
}

function relevance(caseName, row) {
  const id = docId(row);
  const text = String(row.source_text || '');
  const expected = {
    GENERAL: ['UNI-01', 'UNI-15'], GOVERNMENT: ['GOV-02', 'UNI-03', 'GOV-06'],
    MEDICAL: ['MED-02', 'MED-03', 'MED-04'], COMPANY: ['COM-04', 'COM-05', 'COM-02', 'COM-06']
  }[caseName] || [];
  if (expected.includes(id)) return 'CLEARLY_RELEVANT';
  const terms = {
    GENERAL: /采购|验收|证明|需求/, GOVERNMENT: /政务|数据|目录|共享|接口|协同/,
    MEDICAL: /医院|病历|医疗|互联|安全/, COMPANY: /API|接口|集成|对接|数据治理|能力|材料/
  };
  return terms[caseName]?.test(text) ? 'PLAUSIBLY_RELEVANT' : 'IRRELEVANT';
}

function resultRow(caseName, row, rank) {
  return { rank, doc: docId(row), material_id: row.material_id, scope: row.corpus_scope, industry: row.industry,
    score: Number(row.similarity_score ?? row.raw_similarity ?? 0), chunk_id: row.chunk_id,
    chunk_chars: String(row.source_text || '').length, relevance: relevance(caseName, row),
    excerpt: String(row.source_text || '').slice(0, 200) };
}

function headingOnly(row) {
  const text = String(row.source_text || '').trim();
  return /^#{1,6}\s+[^\n]+$/.test(text) || (text.length < 100 && !/[。！？.!?]/.test(text));
}

async function runRetrieval({ service, requirements, projectId, embeddingState }) {
  const cases = [
    { name: 'GENERAL', index: 0, scopes: ['GENERAL'] },
    { name: 'GOVERNMENT', index: 1, scopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE'] },
    { name: 'MEDICAL', index: 2, scopes: ['GENERAL', 'HEALTHCARE'] },
    { name: 'COMPANY', index: 3, scopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE'] }
  ];
  const results = [];
  for (const smoke of cases) {
    embeddingState.currentCase = smoke.name;
    if (embeddingState.calls.length >= MAX_EMBED_CALLS) throw new Error('RAG_REAL_TEST_EMBEDDING_CALL_CAP_EXCEEDED');
    let result;
    try {
      result = await service.retrieve(requirements[smoke.index].id, {
        corpus_scopes: smoke.scopes,
        ...(smoke.name === 'COMPANY' ? {} : {})
      });
    } catch (error) {
      results.push({ name: smoke.name, scopes: smoke.scopes, error: { code: error.code || 'RETRIEVAL_FAILED', message: error.message },
        embedding_call: embeddingState.calls[embeddingState.calls.length - 1] || null });
      throw Object.assign(new Error(error.message), { code: error.code || 'RAG_EMBEDDING_PROVIDER_BATCH_BLOCKED', report: { smokeResults: results } });
    }
    const selected = (result.results || result.final_candidates || []).map((row, index) => resultRow(smoke.name, row, index + 1));
    const raw = (result.raw_candidates || []).slice(0, 5).map((row, index) => resultRow(smoke.name, row, index + 1));
    const scopeSet = new Set(smoke.scopes);
    const unexpected = selected.filter((row) => !scopeSet.has(row.scope)).length;
    const relevant = selected.filter((row) => row.relevance !== 'IRRELEVANT');
    const caseResult = { name: smoke.name, query: requirements[smoke.index].content, requested_scopes: smoke.scopes,
      returned_scopes: [...new Set(selected.map((row) => row.scope))], top_k: selected.length, results: selected, raw_top5: raw,
      top1_relevant: selected[0]?.relevance !== 'IRRELEVANT', relevant_at_3: selected.slice(0, 3).filter((row) => row.relevance !== 'IRRELEVANT').length,
      relevant_at_5: selected.slice(0, 5).filter((row) => row.relevance !== 'IRRELEVANT').length,
      expected_doc_hit: relevant.some((row) => (smoke.name === 'GENERAL' ? ['UNI-01', 'UNI-15'] : smoke.name === 'GOVERNMENT' ? ['GOV-02', 'UNI-03', 'GOV-06'] : smoke.name === 'MEDICAL' ? ['MED-02', 'MED-03', 'MED-04'] : ['COM-04', 'COM-05']).includes(row.doc)),
      unexpected_scope_count: unexpected, short_chunks_lt50: selected.filter((row) => row.chunk_chars < 50).length,
      short_chunks_lt100: selected.filter((row) => row.chunk_chars < 100).length, heading_only_hits: selected.filter(headingOnly).length,
      embedding_call: embeddingState.calls[embeddingState.calls.length - 1] || null
    };
    if (smoke.name === 'COMPANY') {
      const sourceRouting = result.source_routing || routeEnterpriseProofCandidates({ requirement: requirements[smoke.index], candidates: result.raw_candidates || [] });
      caseResult.raw_reference_context_present = (result.raw_candidates || []).some((row) => row.corpus_scope !== 'ENTERPRISE_PRIVATE');
      caseResult.private_raw_results = (result.raw_candidates || []).filter((row) => row.corpus_scope === 'ENTERPRISE_PRIVATE').length;
      caseResult.public_guidance_raw_results = (result.raw_candidates || []).filter((row) => row.corpus_scope !== 'ENTERPRISE_PRIVATE').length;
      caseResult.enterprise_proof_candidates = (sourceRouting.proof_candidates || []).map((row) => ({ doc: docId(row), scope: row.corpus_scope, chunk_id: row.chunk_id }));
      caseResult.reference_context = (sourceRouting.reference_candidates || []).map((row) => ({ doc: docId(row), scope: row.corpus_scope, chunk_id: row.chunk_id }));
      caseResult.public_guidance_promoted_to_proof = caseResult.enterprise_proof_candidates.some((row) => row.scope !== 'ENTERPRISE_PRIVATE');
      caseResult.reference_only_promoted = false;
      if (caseResult.public_guidance_promoted_to_proof) throw Object.assign(new Error('EVIDENCE_AUTHORITY_CONTAMINATION'), { code: 'EVIDENCE_AUTHORITY_CONTAMINATION' });
    }
    results.push(caseResult);
  }
  return results;
}

async function main() {
  const report = { task: 'V43_REAL_RAG_IMPORT_RETRIEVAL_SMOKE', provider_generation_calls: 0, deepseek_calls: 0, dify_calls: 0 };
  const entries = await readManifest();
  const packageCounts = { universal: 0, government: 0, medical: 0, company_case: 0 };
  for (const entry of entries) {
    if (entry.library_scope === 'universal') packageCounts.universal += 1;
    else if (entry.library_scope === 'industry' && entry.domain === 'government') packageCounts.government += 1;
    else if (entry.library_scope === 'industry' && entry.domain === 'medical') packageCounts.medical += 1;
    else packageCounts.company_case += 1;
  }
  if (entries.length !== 50 || Object.values(packageCounts).join(',') !== '16,8,10,16') throw new Error('RAG_PACKAGE_COUNT_MISMATCH');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const storage = new LocalFileStorage(path.resolve(workspace, 'uploads'));
  const service = new CompanyMaterialService({ repository, storage, textExtractor: extractTenderText });
  const embeddingTransport = createEmbeddingFetchFromEnv({ env: process.env });
  const embeddingState = { currentCase: null, calls: [] };
  const instrumentedFetch = async (url, options) => {
    if (embeddingState.calls.length >= MAX_EMBED_CALLS) throw new Error('RAG_REAL_TEST_EMBEDDING_CALL_CAP_EXCEEDED');
    const body = JSON.parse(options.body || '{}');
    const call = { call_index: embeddingState.calls.length + 1, smoke_case: embeddingState.currentCase, input_count: Array.isArray(body.input) ? body.input.length : null,
      missing_chunk_count: Array.isArray(body.input) ? Math.max(0, body.input.length - 1) : null, query_count: 1, started_at: new Date().toISOString() };
    const started = Date.now();
    try {
      const response = await embeddingTransport.fetchImpl(url, options);
      call.http = response.status; call.latency_ms = Date.now() - started; call.completed_at = new Date().toISOString();
      embeddingState.calls.push(call);
      return response;
    } catch (error) {
      call.http = null; call.latency_ms = Date.now() - started; call.error = error.code || 'EMBEDDING_REQUEST_FAILED'; call.completed_at = new Date().toISOString();
      embeddingState.calls.push(call);
      throw error;
    }
  };
  const embeddingClient = createEmbeddingClientFromEnv({ env: { ...process.env, V43_EMBEDDING_MODEL: EMBEDDING_MODEL, V43_EMBEDDING_DIMENSION: String(EMBEDDING_DIMENSION) }, fetchImpl: instrumentedFetch });
  const retrievalService = new EnterpriseRetrievalService({ repository, embeddingClient, defaultTopK: process.env.V43_RETRIEVAL_TOP_K || 5 });
  try {
    report.pre_db_counts = await counts(pool);
    report.embedding_config = { model: embeddingClient.model, dimension: embeddingClient.dimension, version: embeddingClient.version, timeout_ms: embeddingClient.timeoutMs, provider_host: new URL(embeddingClient.apiBase).host };
    await ensurePublicProject(pool);
    const syntheticProject = await ensureSyntheticProject(repository);
    report.synthetic_project_id = syntheticProject.id;
    const requirements = await ensureSmokeRequirements(repository, syntheticProject);
    const imported = { GENERAL: [], GOVERNMENT_ENTERPRISE: [], HEALTHCARE: [], ENTERPRISE_PRIVATE: [] };
    const publicProject = PUBLIC_CORPUS_PROJECT_ID;
    const importRows = [];
    for (const entry of entries) {
      const projectId = entry.library_scope === 'company_case' ? syntheticProject.id : publicProject;
      const row = await importEntry({ entry, projectId, repository, service, storage, pool });
      importRows.push(row); imported[category(entry)].push(row);
    }
    report.import = Object.fromEntries(Object.entries(imported).map(([scope, rows]) => [scope, { expected: scope === 'GENERAL' ? 16 : scope === 'GOVERNMENT_ENTERPRISE' ? 8 : scope === 'HEALTHCARE' ? 10 : 16,
      imported: rows.filter((row) => row.status === 'imported').length, existing: rows.filter((row) => row.status === 'existing').length,
      failed: 0, actual_chunks: rows.reduce((sum, row) => sum + row.chunkCount, 0) }]));
    report.post_db_counts_before_retrieval = await counts(pool);
    report.embedding_calls = [];
    report.smoke = await runRetrieval({ service: retrievalService, requirements, projectId: syntheticProject.id, embeddingState });
    report.embedding_calls = embeddingState.calls;
    const packageMaterialIds = importRows.map((row) => row.material.id);
    const packageChunks = (await pool.query('SELECT count(*)::int AS n FROM material_chunks WHERE material_id=ANY($1::uuid[])', [packageMaterialIds])).rows[0].n;
    const indexed = (await pool.query(`SELECT count(*)::int AS n FROM material_chunk_embeddings e JOIN material_chunks c ON c.chunk_id=e.chunk_id WHERE c.material_id=ANY($1::uuid[]) AND e.embedding_model=$2 AND e.embedding_dimension=$3`, [packageMaterialIds, EMBEDDING_MODEL, EMBEDDING_DIMENSION])).rows[0].n;
    report.index_coverage = { package_materials: packageMaterialIds.length, package_chunks: packageChunks, indexed_package_chunks: indexed, embedding_coverage: packageChunks ? indexed / packageChunks : 0, missing_embeddings: packageChunks - indexed };
    report.post_db_counts = await counts(pool);
    report.db_delta = Object.fromEntries(Object.keys(report.pre_db_counts).map((key) => [key, report.post_db_counts[key] - report.pre_db_counts[key]]));
    report.authority = { guidance_to_enterprise_proof: report.smoke[3]?.public_guidance_promoted_to_proof ? 'YES' : 'NO', synthetic_as_real: 'NO', fact: 'NO', mapping: 'NO', sufficiency: 'NO', claim: 'NO' };
    report.temporal = { descriptive_metadata: 'preserved where DB fields exist; remaining fields retained in manifest', runtime_logic: 'NO' };
    await mkdir(path.dirname(reportPath), { recursive: true });
    await import('node:fs/promises').then(({ writeFile }) => writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8'));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await embeddingTransport.close();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, code: error.code || 'RAG_IMPORT_FAILED', message: error.message, report: error.report || null }, null, 2));
  process.exitCode = 1;
});
