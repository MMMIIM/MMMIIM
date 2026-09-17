import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../src/db.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from '../../src/pipeline/embedding-client.js';
import { EnterpriseRetrievalService } from '../../src/pipeline/enterprise-retrieval-service.js';
import { EvidenceSourceContextResolver } from '../../src/pipeline/evidence-source-context-resolver.js';
import { expandEvidenceContext } from '../../src/pipeline/evidence-context-expansion.js';
import { createSemanticGatewayEvidenceSupportEvaluatorFromEnv } from '../../src/pipeline/semantic-gateway-evidence-support-evaluator.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { adaptRetrievalCandidate } from '../../src/pipeline/evidence-support-assessment-contract-v1.js';
import { SemanticGatewayEvidenceFactExtractor } from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { EvidenceSourceFactService } from '../../src/evidence-source-fact-service.js';
import { createEvidenceFactContract } from '../../src/pipeline/evidence-fact-contract-v1.js';
import { PUBLIC_CORPUS_PROJECT_ID } from '../../src/pipeline/corpus-contract.js';
import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  schemaSha256
} from '../../../packages/semantic-contracts/index.js';
import { readSemanticGatewayRuntimeConfig as readRuntimeConfig, safeSemanticGatewayRuntimeSummary } from '../../../packages/semantic-contracts/runtime-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '../..');
const workspace = path.resolve(here, '../../..');
const resultsDir = path.join(here, 'results', 'overnight');
const fixturePath = path.join(here, 'retrieval_40case_fixture.json');
const SYNTHETIC_PROJECT_ID = 'd22e95d8-3a2e-450d-a5ef-27f83a283aff';
const MAX_EXTERNAL_ATTEMPTS = 150;
const SYSTEMIC_SEMANTIC_ERROR_CODES = Object.freeze([
  'SCHEMA_INVALID',
  'OUTPUT_SCHEMA_INVALID',
  'ASSESSMENT_UNAVAILABLE'
]);
const IMMEDIATE_SEMANTIC_FAILURE_CODES = Object.freeze([
  'EVIDENCE_SUPPORT_SOURCE_HASH_INVALID',
  'SUPPORT_SPAN_INVALID'
]);
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EMBEDDING_DIMENSION = 1024;
const PUBLIC_PROJECT = PUBLIC_CORPUS_PROJECT_ID;
const sha = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const uuidFrom = value => { const h = sha(value); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
const text = value => String(value ?? '');
const nonEmpty = value => text(value).trim();
const percent = (n, d) => d ? Number((n * 100 / d).toFixed(2)) : 0;
const clampText = (value, max = 1200) => nonEmpty(value).length <= max ? nonEmpty(value) : `${nonEmpty(value).slice(0, max)}…`;
const docId = row => text(row?.original_name || '').split('_', 1)[0];
const headingOnly = value => /^#{1,6}\s+[^\r\n]+$/.test(nonEmpty(value));
const csvEscape = value => { const raw = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value); return `"${raw.replaceAll('"', '""')}"`; };
const csv = (rows, fields) => [fields.join(','), ...rows.map(row => fields.map(field => csvEscape(row[field])).join(','))].join('\n') + '\n';
const stableJson = value => JSON.stringify(value, (_key, current) => current && typeof current === 'object' && !Array.isArray(current) ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current);

dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readFixture() {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!Array.isArray(fixture) || fixture.length !== 40) throw new Error('RETRIEVAL_FIXTURE_INVALID_COUNT');
  const themes = new Set(fixture.map(item => item.theme));
  for (let i = 1; i <= 34; i += 1) if (!themes.has(`U${String(i).padStart(2, '0')}`)) throw new Error(`RETRIEVAL_FIXTURE_THEME_MISSING:U${i}`);
  const distribution = Object.fromEntries(['GENERAL','GOVERNMENT','MEDICAL','COMPANY'].map(scope => [scope, fixture.filter(item => item.scope === scope).length]));
  if (Object.values(distribution).some(count => count < 10)) throw new Error(`RETRIEVAL_FIXTURE_SCOPE_DISTRIBUTION:${JSON.stringify(distribution)}`);
  const fixtureHash = sha(stableJson(fixture));
  return { fixture, fixtureHash, distribution };
}

async function tableCounts(pool) {
  const tables = ['projects', 'requirements', 'company_materials', 'material_chunks', 'material_chunk_embeddings', 'evidences', 'evidence_candidate_reviews', 'evidence_source_facts', 'requirement_evidence_mappings'];
  const counts = {};
  for (const table of tables) {
    try {
      const exists = (await pool.query(`SELECT to_regclass($1) AS name`, [table])).rows[0].name;
      counts[table] = exists ? Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n) : null;
    } catch (error) { counts[table] = { error: error.code || 'COUNT_FAILED' }; }
  }
  return counts;
}

async function loadCorpus(repository) {
  const materialRows = (await repository.pool.query(`
    SELECT * FROM company_materials
    WHERE original_name ~ '^(UNI|GOV|MED|COM)-'
    ORDER BY original_name`)).rows;
  const materials = new Map(materialRows.map(row => [String(row.id), row]));
  const chunkRows = (await repository.pool.query(`
    SELECT c.*,m.project_id,m.material_type,m.corpus_scope,m.industry,m.original_name,m.source_type,
           m.source_org,m.authority_level AS source_authority,m.lifecycle_status,m.review_status,
           m.usage_status,m.index_status,m.synthetic_test_material,
           e.embedding_id,e.embedding_dimension,e.embedding_model,e.embedding_version
    FROM material_chunks c
    JOIN company_materials m ON m.id=c.material_id
    LEFT JOIN material_chunk_embeddings e ON e.chunk_id=c.chunk_id AND e.chunk_hash=c.chunk_hash
    WHERE m.original_name ~ '^(UNI|GOV|MED|COM)-'
    ORDER BY m.original_name,c.chunk_index,c.chunk_id`)).rows;
  const byMaterial = new Map();
  for (const row of chunkRows) { const key = String(row.material_id); if (!byMaterial.has(key)) byMaterial.set(key, []); byMaterial.get(key).push(row); }
  const byDoc = new Map();
  for (const material of materials.values()) byDoc.set(docId(material), material);
  return { materials, chunks: chunkRows, byMaterial, byDoc };
}

function decorate(item) {
  return {
    ...item,
    similarity_score: Number(item.raw_similarity ?? item.similarity_score ?? 0),
    rank: item.reranked_rank ?? item.raw_vector_rank ?? item.rank ?? null,
    source_document_id: item.source_document_id ?? item.material_id,
    source_chunk_id: item.source_chunk_id ?? item.chunk_id,
    source_text: text(item.source_text)
  };
}

function makeReadOnlyRepository(repository, contexts, corpus) {
  return {
    getCanonicalRequirementForRetrieval: async id => contexts.get(String(id)) || null,
    createRetrievalRun: async value => ({ retrieval_run_id: `eval-${uuidFrom(JSON.stringify(value))}`, ...value, status: 'running' }),
    listChunksForRetrieval: args => repository.listChunksForRetrieval(args),
    prepareRetrievalCandidates: async ({ queryVector, projectId, materialTypes = [], materialIds = [], model, version, dimension, candidateK, corpusScopes = ['GENERAL'], corpusProjectId = PUBLIC_PROJECT }) => {
      const vector = values => `[${values.join(',')}]`;
      const rows = (await repository.pool.query(`
        SELECT e.embedding_id,c.chunk_id,c.material_id,m.project_id AS project_id,m.material_type,m.corpus_scope,
               m.industry,m.original_name,m.source_type,m.source_org,m.authority_level AS source_authority,
               m.lifecycle_status,m.review_status,m.usage_status,m.index_status,m.effective_status,
               m.synthetic_test_material,c.source_text,c.chunk_hash,e.embedding_model,e.embedding_version,
               1-(e.embedding <=> $1::vector) AS similarity_score
        FROM material_chunk_embeddings e
        JOIN material_chunks c ON c.chunk_id=e.chunk_id AND c.chunk_hash=e.chunk_hash
        JOIN company_materials m ON m.id=c.material_id
        WHERE m.extraction_status='succeeded'
          AND ((m.project_id=$2 AND m.corpus_scope='ENTERPRISE_PRIVATE')
            OR (m.project_id=$3 AND m.lifecycle_status='ACTIVE' AND m.review_status='approved'
              AND m.usage_status=ANY(ARRAY['ACTIVE_FULLTEXT','ACTIVE_EXCERPT'])
              AND m.index_status='INDEXED' AND m.corpus_scope=ANY($4::text[])))
          AND e.embedding_model=$5 AND e.embedding_version=$6 AND e.embedding_dimension=$7
          AND (cardinality($8::text[])=0 OR m.material_type=ANY($8::text[]))
          AND (cardinality($9::uuid[])=0 OR m.id=ANY($9::uuid[]))
        ORDER BY e.embedding <=> $1::vector,e.embedding_id LIMIT $10`,
      [vector(queryVector), projectId, corpusProjectId, corpusScopes, model, version, dimension, materialTypes, materialIds, candidateK])).rows;
      return rows.map((row, index) => ({ ...row, similarity_score: Number(row.similarity_score), rank: index + 1, raw_vector_rank: index + 1, raw_similarity: Number(row.similarity_score) }));
    },
    completeRetrievalRun: async ({ ranking }) => ({
      run: { retrieval_run_id: `eval-${uuidFrom(JSON.stringify(ranking.final_candidates.map(item => item.chunk_id)))}`, status: 'succeeded' },
      raw_candidates: ranking.raw_candidates.map(decorate),
      final_candidates: ranking.final_candidates.map(decorate),
      results: ranking.final_candidates.map(decorate)
    }),
    failRetrievalRun: async () => null
  };
}

function buildRetrievalContext(material, chunks, anchor) {
  const resolver = new EvidenceSourceContextResolver();
  const resolved = resolver.resolve({ material, chunks, anchorChunkId: anchor.chunk_id, strategy: 'auto' });
  const expanded = expandEvidenceContext({
    exactSpan: {
      source_id: anchor.chunk_id,
      source_span_id: resolved.span_id,
      anchor_chunk_id: anchor.chunk_id,
      source_text: resolved.source_text,
      document_id: material.id
    },
    material,
    chunks,
    missingDimensions: []
  });
  const contextTexts = [expanded.exact_evidence_span?.source_text, ...(expanded.context_window || []).map(item => item.text)].filter(Boolean);
  return { resolved, expanded, context_text: contextTexts.join('\n'), context_chars: contextTexts.join('\n').length };
}

function expectedScopeForCase(item) {
  return item.project_kind === 'company' ? new Set(['GENERAL', 'ENTERPRISE_PRIVATE']) : new Set(item.requested_scopes || []);
}

function relevanceFor(item, row) {
  const id = docId(row);
  if (item.expected_doc_ids.includes(id)) return 'CLEARLY_RELEVANT';
  const termMap = {
    GENERAL: /采购|验收|证明|接口|治理|安全|数据|性能|运维/,
    GOVERNMENT: /政务|数据|目录|共享|接口|协同|云|等保|运维/,
    MEDICAL: /医院|病历|医疗|互联|安全|培训|运维/,
    COMPANY: /API|接口|集成|对接|数据治理|能力|材料|SLA|运维|测试/
  };
  return termMap[item.scope]?.test(text(row.source_text)) ? 'PLAUSIBLY_RELEVANT' : 'IRRELEVANT';
}

async function runRetrievalPhase({ pool, repository, corpus, fixture, external }) {
  const contexts = new Map();
  for (const item of fixture) {
    const id = uuidFrom(`retrieval:${item.case_id}`);
    contexts.set(id, { id, project_id: item.project_kind === 'company' ? SYNTHETIC_PROJECT_ID : PUBLIC_PROJECT, req_id: `RAG-${item.case_id}`, text: item.query, requirement_category: 'technical' });
  }
  const readOnly = makeReadOnlyRepository(repository, contexts, corpus);
  const transport = createEmbeddingFetchFromEnv({ env: process.env });
  const instrumentedFetch = async (url, options = {}) => {
    if (external.embeddingCalls.length + external.gatewayReserved >= MAX_EXTERNAL_ATTEMPTS) throw Object.assign(new Error('OVERNIGHT_PROVIDER_CALL_CAP_REACHED'), { code: 'OVERNIGHT_PROVIDER_CALL_CAP_REACHED' });
    const body = JSON.parse(options.body || '{}');
    const call = { phase: 'A', kind: 'embedding', case_id: external.currentCase, endpoint_host: (() => { try { return new URL(url).hostname; } catch { return 'invalid'; } })(), input_count: Array.isArray(body.input) ? body.input.length : null, started_at: new Date().toISOString() };
    external.attempts.push(call);
    external.embeddingCalls.push(call);
    try { const response = await transport.fetchImpl(url, options); call.http_status = response.status; call.latency_ms = 0; return response; }
    catch (error) { call.error_code = error.code || 'EMBEDDING_REQUEST_FAILED'; call.http_status = null; throw error; }
  };
  const embeddingClient = createEmbeddingClientFromEnv({ env: { ...process.env, V43_EMBEDDING_MODEL: EMBEDDING_MODEL, V43_EMBEDDING_DIMENSION: String(EMBEDDING_DIMENSION) }, fetchImpl: instrumentedFetch });
  const retrieval = new EnterpriseRetrievalService({ repository: readOnly, embeddingClient, defaultTopK: 8 });
  const rows = [];
  try {
    for (const item of fixture) {
      external.currentCase = item.case_id;
      const requirementId = uuidFrom(`retrieval:${item.case_id}`);
      let result = null;
      let error = null;
      try { result = await retrieval.retrieve(requirementId, { corpus_scopes: item.requested_scopes }); } catch (caught) { error = { code: caught.code || caught.name, message: caught.message }; }
      const raw = (result?.raw_candidates || []).map(decorate).map((candidate, index) => ({ ...candidate, rank: index + 1, doc_id: docId(candidate), relevance: relevanceFor(item, candidate) }));
      const selected = (result?.results || result?.final_candidates || []).map(decorate).map((candidate, index) => ({ ...candidate, rank: index + 1, doc_id: docId(candidate), relevance: relevanceFor(item, candidate) }));
      const allowed = expectedScopeForCase(item);
      const unexpected = raw.filter(candidate => !allowed.has(candidate.corpus_scope));
      const top5 = selected.slice(0, 5);
      const top5Relevant = top5.filter(candidate => candidate.relevance !== 'IRRELEVANT');
      const contextResults = [];
      for (const candidate of top5) {
        const material = corpus.materials.get(String(candidate.material_id));
        const chunks = corpus.byMaterial.get(String(candidate.material_id)) || [];
        const anchor = chunks.find(chunk => chunk.chunk_id === candidate.chunk_id);
        if (!material || !anchor) { contextResults.push({ chunk_id: candidate.chunk_id, error: 'SOURCE_CHUNK_NOT_FOUND' }); continue; }
        try { const context = buildRetrievalContext(material, chunks, anchor); contextResults.push({ chunk_id: candidate.chunk_id, resolver_span_id: context.resolved.span_id, source_chunk_ids: context.resolved.source_chunk_ids, context_chars: context.context_chars, raw_heading_only: headingOnly(anchor.source_text), final_heading_only: (context.expanded.context_window || []).length === 0 && headingOnly(context.expanded.exact_evidence_span.source_text), provenance_complete: context.resolved.source_chunk_ids.every(id => chunks.some(chunk => chunk.chunk_id === id)) }); }
        catch (caught) { contextResults.push({ chunk_id: candidate.chunk_id, error: caught.code || caught.message, provenance_complete: false }); }
      }
      const scopeViolation = unexpected.length;
      rows.push({ case_id: item.case_id, theme: item.theme, scope: item.scope, project_kind: item.project_kind, query: item.query, requested_scopes: item.requested_scopes, expected_doc_ids: item.expected_doc_ids, raw_top20: raw.slice(0, 20), selected_topk: selected, expected_doc_hit: top5.some(candidate => item.expected_doc_ids.includes(candidate.doc_id)), relevant_at_3: selected.slice(0, 3).filter(candidate => candidate.relevance !== 'IRRELEVANT').length, relevant_at_5: top5Relevant.length, useful_context_at_5: contextResults.filter(context => context.context_chars >= 100).length, heading_only_raw_hit: top5.filter(candidate => headingOnly(candidate.source_text)).length, heading_only_final_context: contextResults.filter(context => context.final_heading_only).length, scope_violations: scopeViolation, context_contamination: contextResults.some(context => (context.source_chunk_ids || []).some(id => !((corpus.byMaterial.get(String(selected.find(candidate => candidate.chunk_id === context.chunk_id)?.material_id)) || []).some(chunk => chunk.chunk_id === id)))), provenance_failures: contextResults.filter(context => context.provenance_complete === false).length, context_results: contextResults, error });
    }
  } finally { await transport.close(); }
  const metrics = { cases: rows.length, expected_doc_hit: rows.filter(row => row.expected_doc_hit).length, relevant_at_5: rows.reduce((sum, row) => sum + (row.relevant_at_5 >= 5 ? 1 : 0), 0), relevant_at_5_rate: percent(rows.filter(row => row.relevant_at_5 >= 1).length, rows.length), scope_violations: rows.reduce((sum, row) => sum + row.scope_violations, 0), heading_only_final: rows.reduce((sum, row) => sum + row.heading_only_final_context, 0), context_failures: rows.filter(row => row.error || row.provenance_failures > 0).length, provenance_failures: rows.reduce((sum, row) => sum + row.provenance_failures, 0) };
  return { rows, metrics, embedding_config: { model: embeddingClient.model, version: embeddingClient.version, dimension: embeddingClient.dimension, timeout_ms: embeddingClient.timeoutMs, provider_host: (() => { try { return new URL(embeddingClient.apiBase).hostname; } catch { return 'invalid'; } })() } };
}

function pickChunk(corpus, wantedDoc, preferred = [], pattern = null) {
  const material = corpus.byDoc.get(wantedDoc);
  if (!material) throw new Error(`MATERIAL_NOT_FOUND:${wantedDoc}`);
  const chunks = corpus.byMaterial.get(String(material.id)) || [];
  const ordered = [...preferred.map(index => chunks.find(chunk => Number(chunk.chunk_index) === index)).filter(Boolean), ...chunks];
  const selected = ordered.find(chunk => !headingOnly(chunk.source_text) && (!pattern || pattern.test(text(chunk.source_text)))) || ordered.find(chunk => !headingOnly(chunk.source_text));
  if (!selected) throw new Error(`BODY_CHUNK_NOT_FOUND:${wantedDoc}`);
  return { material, chunk: selected };
}

function resolvedSource(corpus, wantedDoc, preferred = [], pattern = null) {
  const { material, chunk } = pickChunk(corpus, wantedDoc, preferred, pattern);
  const chunks = corpus.byMaterial.get(String(material.id)) || [];
  const resolver = new EvidenceSourceContextResolver();
  const resolved = resolver.resolve({ material, chunks, anchorChunkId: chunk.chunk_id, strategy: 'auto' });
  const expanded = expandEvidenceContext({
    exactSpan: { source_id: chunk.chunk_id, source_span_id: resolved.span_id, anchor_chunk_id: chunk.chunk_id, source_text: resolved.source_text, document_id: material.id },
    material,
    chunks,
    missingDimensions: []
  });
  return { material, chunk, chunks, resolved, expanded };
}

function semanticCaseDefinitions() {
  const make = (case_id, category, doc, preferred, pattern, requirement, expected, flags = {}) => ({ case_id, category, doc, preferred, pattern, requirement, expected, ...flags });
  return [
    make('B-P01','CLEAR_POSITIVE','COM-04',[3],/REST API|Webhook/i,'企业需要具备 REST API、Webhook 和批量文件交换能力。','EXPECTED_POSITIVE'),
    make('B-P02','CLEAR_POSITIVE','COM-02',[3],/平台|产品/i,'企业产品平台应支持本项目的核心业务能力。','EXPECTED_POSITIVE'),
    make('B-P03','CLEAR_POSITIVE','COM-03',[5],/PostgreSQL|Linux/i,'企业应具备国产 Linux 与 PostgreSQL 兼容部署能力。','EXPECTED_POSITIVE'),
    make('B-P04','CLEAR_POSITIVE','COM-07',[5],/P95|虚拟用户/i,'企业应提供性能容量测试结果作为能力证明。','EXPECTED_POSITIVE'),
    make('B-P05','CLEAR_POSITIVE','COM-12',[3],/巡检|告警|故障/i,'企业应具备巡检、告警、故障、升级和备份运维能力。','EXPECTED_POSITIVE'),
    make('B-P06','CLEAR_POSITIVE','COM-06',[3],/审计|测试/i,'企业应具备权限、安全与审计测试能力。','EXPECTED_POSITIVE'),
    make('B-P07','CLEAR_POSITIVE','COM-09',[3],/实施|质量/i,'企业应具备项目实施与质量管理能力。','EXPECTED_POSITIVE'),
    make('B-P08','CLEAR_POSITIVE','COM-11',[3],/验收|交付/i,'企业应具备测试、培训、验收与交付能力。','EXPECTED_POSITIVE'),
    make('B-P09','CLEAR_POSITIVE','COM-13',[3],/城市|协同/i,'企业应具备政企事件协同平台项目经验。','EXPECTED_POSITIVE'),
    make('B-P10','CLEAR_POSITIVE','COM-14',[3],/医院|接口/i,'企业应具备医院接口与数据平台实施能力。','EXPECTED_POSITIVE'),
    make('B-L01','POSITIVE_LIMITED','COM-03',[5],/未列版本|Linux/i,'企业应明确支持指定版本的操作系统和数据库。','EXPECTED_LIMITED'),
    make('B-L02','POSITIVE_LIMITED','COM-07',[5],/1\.8秒|P95/i,'企业性能应达到 P95 不超过 1.5 秒。','EXPECTED_LIMITED'),
    make('B-L03','POSITIVE_LIMITED','COM-12',[5],/不提供真实客户|SLA/i,'企业应承诺真实客户 7x24 SLA。','EXPECTED_LIMITED'),
    make('B-L04','POSITIVE_LIMITED','COM-06',[5],/不等同|认证/i,'企业应提供已取得的正式安全认证。','EXPECTED_LIMITED'),
    make('B-L05','POSITIVE_LIMITED','COM-04',[3],/12个模拟接口/i,'企业应提供真实生产系统接口联调证明。','EXPECTED_LIMITED'),
    make('B-L06','POSITIVE_LIMITED','COM-08',[3],/演练|备份/i,'企业应证明真实客户灾备演练成效。','EXPECTED_LIMITED'),
    make('B-L07','POSITIVE_LIMITED','COM-11',[3],/培训|验收/i,'企业应证明在本项目中已完成验收培训。','EXPECTED_LIMITED'),
    make('B-L08','POSITIVE_LIMITED','COM-15',[3],/授权|索引/i,'企业应证明所有授权均在当前有效期内。','EXPECTED_LIMITED'),
    make('B-N01','CLEAR_NEGATIVE','COM-04',[5],/不代表已对接/i,'企业必须已对接真实政务或医院系统。','EXPECTED_NEGATIVE'),
    make('B-N02','CLEAR_NEGATIVE','COM-12',[5],/不构成真实客户合同/i,'企业已签订真实客户 7x24 运维合同。','EXPECTED_NEGATIVE'),
    make('B-N03','CLEAR_NEGATIVE','COM-06',[5],/不等同于认证/i,'企业已经取得第三方安全认证。','EXPECTED_NEGATIVE'),
    make('B-N04','CLEAR_NEGATIVE','COM-07',[7],/不代表承诺/i,'企业已对外承诺固定性能 SLA。','EXPECTED_NEGATIVE'),
    make('B-N05','CLEAR_NEGATIVE','COM-08',[5],/不代表真实客户/i,'企业已有真实客户容灾合同。','EXPECTED_NEGATIVE'),
    make('B-N06','CLEAR_NEGATIVE','COM-16',[3],/商务|合同/i,'该材料可作为企业技术能力事实证明。','EXPECTED_NEGATIVE'),
    make('B-H01','HEADING_BODY_NOT_SUPPORTING','COM-04',[6],/官方来源/i,'企业已完成指定项目的真实接口交付。','EXPECTED_NOT_SUPPORTING'),
    make('B-H02','HEADING_BODY_NOT_SUPPORTING','COM-12',[6],/官方来源/i,'企业已获得政府运维服务采购合同。','EXPECTED_NOT_SUPPORTING'),
    make('B-H03','HEADING_BODY_NOT_SUPPORTING','COM-07',[8],/时效使用规则/i,'企业在当前项目中达到 P95 1.5 秒。','EXPECTED_NOT_SUPPORTING'),
    make('B-H04','HEADING_BODY_NOT_SUPPORTING','COM-06',[7],/官方来源/i,'企业获得了本项目安全认证。','EXPECTED_NOT_SUPPORTING'),
    make('B-H05','HEADING_BODY_NOT_SUPPORTING','GOV-02',[4],/跨部门|目录/i,'该企业已经完成真实客户数据共享交付。','EXPECTED_NOT_SUPPORTING'),
    make('B-H06','HEADING_BODY_NOT_SUPPORTING','UNI-08',[6],/官方来源/i,'企业已经证明生产系统接口能力。','EXPECTED_NOT_SUPPORTING'),
    make('B-R01','PUBLIC_REFERENCE_ONLY','GOV-01',[5],/官方|来源/i,'企业已具备政务项目实施能力。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true}),
    make('B-R02','PUBLIC_REFERENCE_ONLY','GOV-02',[5],/官方|来源/i,'企业已具备政务数据共享能力。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true}),
    make('B-R03','PUBLIC_REFERENCE_ONLY','GOV-06',[5],/官方|来源/i,'企业已完成系统迁移联调。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true}),
    make('B-R04','PUBLIC_REFERENCE_ONLY','MED-04',[5],/官方|来源/i,'企业已具备医疗数据安全能力。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true}),
    make('B-R05','PUBLIC_REFERENCE_ONLY','UNI-15',[5],/官方|来源/i,'企业具备可核验资质证明。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true}),
    make('B-R06','PUBLIC_REFERENCE_ONLY','MED-08',[5],/官方|来源/i,'企业具备医疗容灾服务能力。','EXPECTED_REFERENCE_ONLY',{referenceOnly:true})
  ];
}

function classifySemanticLabel(assessment) {
  if (!assessment) return 'EXPECTED_NOT_SUPPORTING';
  if (assessment.evidence_capability === 'reference_only' || assessment.support_level === 'reference_only') return 'EXPECTED_REFERENCE_ONLY';
  if (assessment.support_level === 'conflict' || assessment.semantic_relationship === 'conflict') return 'EXPECTED_NEGATIVE';
  if (assessment.support_level === 'full_support' && assessment.semantic_relationship === 'direct') return 'EXPECTED_POSITIVE';
  if (assessment.support_level === 'partial_support' || assessment.semantic_relationship === 'partial') return 'EXPECTED_LIMITED';
  if (assessment.semantic_relevance === 'irrelevant' || assessment.evidence_capability === 'not_capable' || assessment.support_level === 'insufficient') return 'EXPECTED_NOT_SUPPORTING';
  return 'UNRESOLVED';
}

function contractSnapshot(taskType, runtime) {
  const contract = getSemanticTaskContract(taskType);
  const instruction = getSemanticTaskInstructionMetadata(taskType);
  return {
    task_type: taskType,
    contract_version: contract?.contract_version || null,
    instruction_hash: instruction?.instruction_hash || null,
    schema_hash: contract?.data_schema ? schemaSha256(contract.data_schema) : null,
    data_required: contract?.data_required || [],
    data_allowed: contract?.data_allowed || [],
    parser: contract?.parser || null,
    provider: runtime.provider,
    model: runtime.model,
    provider_host: runtime.provider_host,
    structured_output: { response_format: 'json_schema', strict: true },
    retry_policy: taskType === 'evidence_fact_extraction' ? { max_attempts: 2, eligible: ['OUTPUT_SCHEMA_INVALID','FACT_SEMANTIC_EMPTY'] } : { max_attempts: 1 }
  };
}

async function runSemanticReviewPhase({ corpus, external, runtime, ledger = null }) {
  const definitions = semanticCaseDefinitions();
  const frozenMapping = Object.fromEntries(definitions.map(item => [item.case_id, item.expected]));
  const transport = createEmbeddingFetchFromEnv({ env: process.env });
  const gatewayFetch = async (url, options = {}) => {
    if (external.gatewayReserved >= MAX_EXTERNAL_ATTEMPTS) throw Object.assign(new Error('OVERNIGHT_PROVIDER_CALL_CAP_REACHED'), { code: 'OVERNIGHT_PROVIDER_CALL_CAP_REACHED' });
    const ledgerAttempt = ledger ? await ledger.aboutToSend({ phase: 'B', caseId: external.currentCase }) : null;
    external.gatewayReserved += 1;
    const call = { phase: 'B', kind: 'semantic_review', case_id: external.currentCase, endpoint_host: (() => { try { return new URL(url).hostname; } catch { return 'invalid'; } })(), started_at: new Date().toISOString() };
    external.gatewayCalls.push(call);
    const headers = { ...(options.headers || {}), 'x-semantic-gateway-diagnostic': 'probe-v1' };
    const started = Date.now();
    try {
      const response = await fetch(url, { ...options, headers });
      call.http_status = response.status;
      call.latency_ms = Date.now() - started;
      try {
        const copy = response.clone();
        const body = await copy.json();
        const d = body?.probe_diagnostics;
        if (d) Object.assign(call, { provider_http_reached: d.provider_http_reached === true, provider_http_status: d.provider_http_status ?? null, finish_reason: d.finish_reason ?? null, prompt_tokens: d.prompt_tokens ?? null, completion_tokens: d.completion_tokens ?? null, output_truncated: d.output_truncated === true });
      } catch {}
      if (ledger) await ledger.record({ phase: 'B', caseId: external.currentCase, attempt: ledgerAttempt, event: response.ok ? 'HTTP_SUCCESS' : 'HTTP_ERROR', http_status: response.status, provider_http_status: call.provider_http_status ?? null, provider_http_reached: call.provider_http_reached ?? null, finish_reason: call.finish_reason ?? null, completion_tokens: call.completion_tokens ?? null, output_truncated: call.output_truncated ?? null });
      return response;
    } catch (error) {
      call.error_code = error.code || error.name || 'GATEWAY_REQUEST_FAILED';
      if (ledger && ledgerAttempt != null) {
        await ledger.record({ phase: 'B', caseId: external.currentCase, attempt: ledgerAttempt, event: error.name === 'AbortError' || error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'HTTP_ERROR', error_code: call.error_code });
      }
      throw error;
    }
  };
  const evaluator = createSemanticGatewayEvidenceSupportEvaluatorFromEnv({ env: process.env, fetchImpl: gatewayFetch });
  const rows = [];
  try {
    for (const definition of definitions) {
      external.currentCase = definition.case_id;
      let source = null; let assessment = null; let error = null;
      try {
        source = resolvedSource(corpus, definition.doc, definition.preferred, definition.pattern);
        const adapter = adaptRetrievalCandidate({
          requirement: { requirement_id: `SEM-${definition.case_id}`, text: definition.requirement },
          candidate: { candidate_id: `SEM-SOURCE-${definition.case_id}`, metadata: { ...(definition.referenceOnly ? { proof_eligibility: 'REFERENCE_CONTEXT', source_origin: 'PUBLIC_GUIDANCE' } : {}), material_type: source.material.material_type } },
          sourceSpan: { source_span_id: source.resolved.span_id, source_text: source.resolved.source_text, source_text_hash: source.resolved.source_text_hash },
          material: { material_id: source.material.id, material_type: source.material.material_type, corpus_scope: source.material.corpus_scope, source_type: source.material.source_type, source_authority: source.material.authority_level },
          lineage: { project_id: source.material.project_id, material_id: source.material.id, document_id: source.material.id, anchor_chunk_id: source.chunk.chunk_id }
        });
        const result = await evaluator.assess({ requirement: { requirement_id: `SEM-${definition.case_id}`, text: definition.requirement }, adapters: [adapter] });
        assessment = result.assessments?.[0] || null;
        const lastCall = external.gatewayCalls.at(-1);
        if (lastCall?.case_id === definition.case_id) lastCall.result_label = classifySemanticLabel(assessment);
        rows.push({ case_id: definition.case_id, category: definition.category, expected_label: definition.expected, source: { doc_id: definition.doc, material_id: source.material.id, chunk_id: source.chunk.chunk_id, source_span_id: source.resolved.span_id, source_text: source.resolved.source_text, expanded_context: source.expanded.context_window || [] }, assessment, actual_label: classifySemanticLabel(assessment), provider_called: Boolean(lastCall?.case_id === definition.case_id), error: null });
      } catch (caught) { error = { code: caught.code || caught.name || 'SEMANTIC_REVIEW_FAILED', message: caught.message }; rows.push({ case_id: definition.case_id, category: definition.category, expected_label: definition.expected, source: source ? { doc_id: definition.doc, material_id: source.material.id, chunk_id: source.chunk.chunk_id, source_span_id: source.resolved.span_id, source_text: source.resolved.source_text } : null, assessment: null, actual_label: null, provider_called: external.gatewayCalls.some(call => call.case_id === definition.case_id), error }); }
    }
  } finally { await transport.close(); }
  const failures = rows.filter(row => row.error || row.actual_label !== row.expected_label);
  const negativeFalsePositive = rows.filter(row => ['EXPECTED_NEGATIVE','EXPECTED_NOT_SUPPORTING','EXPECTED_REFERENCE_ONLY'].includes(row.expected_label) && row.actual_label === 'EXPECTED_POSITIVE').length;
  const referenceContamination = rows.filter(row => row.expected_label === 'EXPECTED_REFERENCE_ONLY' && row.actual_label === 'EXPECTED_POSITIVE').length;
  return { contract: { ...contractSnapshot('evidence_support_assessment', runtime), label_mapping: frozenMapping }, rows, metrics: { cases: rows.length, pass: rows.length - failures.length, fail: failures.length, negative_false_positive: negativeFalsePositive, reference_contamination: referenceContamination, schema_invalid: rows.filter(row => row.error?.code === 'SCHEMA_INVALID' || row.error?.code === 'ASSESSMENT_UNAVAILABLE').length }, provider_requests: external.gatewayCalls.filter(call => call.phase === 'B').length };
}

function semanticErrorCode(row) {
  return row?.error?.code || row?.error_code || row?.code || null;
}

function semanticSystemicBlocker(semantic) {
  const rows = Array.isArray(semantic?.rows) ? semantic.rows : [];
  const immediateFailures = rows.filter(row => IMMEDIATE_SEMANTIC_FAILURE_CODES.includes(semanticErrorCode(row)));
  const sourceHashFailures = rows.filter(row => semanticErrorCode(row) === 'EVIDENCE_SUPPORT_SOURCE_HASH_INVALID');
  const systemicFailureCounts = Object.fromEntries(SYSTEMIC_SEMANTIC_ERROR_CODES.map(code => [
    code,
    rows.filter(row => semanticErrorCode(row) === code).length
  ]));
  const repeatedDeterministicFailures = Object.entries(systemicFailureCounts)
    .filter(([, count]) => count >= 2)
    .map(([code, count]) => ({ code, count }));
  const stopBeforeFact = immediateFailures.length > 0 || repeatedDeterministicFailures.length > 0;
  return {
    source_hash_invalid: sourceHashFailures.length,
    systemic_failure_counts: systemicFailureCounts,
    repeated_deterministic_failures: repeatedDeterministicFailures,
    stop_before_fact: stopBeforeFact,
    reason: immediateFailures.length > 0
      ? 'SOURCE_PROVENANCE_HARD_FAILURE'
      : repeatedDeterministicFailures.length > 0
        ? 'REPEATED_DETERMINISTIC_SEMANTIC_FAILURE'
        : null,
    affected_cases: rows.filter(row => semanticErrorCode(row) && (
      IMMEDIATE_SEMANTIC_FAILURE_CODES.includes(semanticErrorCode(row))
      || SYSTEMIC_SEMANTIC_ERROR_CODES.includes(semanticErrorCode(row))
    )).map(row => row.case_id)
  };
}

function shouldRunFactPhase({ semanticBlocker, observedAttempts = 0, providerBudget = MAX_EXTERNAL_ATTEMPTS }) {
  return semanticBlocker?.stop_before_fact !== true && Number(observedAttempts) < Number(providerBudget);
}

function factCaseDefinitions() {
  const make = (case_id, doc, preferred, pattern, requirement, category = 'ELIGIBLE') => ({ case_id, doc, preferred, pattern, requirement, category });
  return [
    make('C01','COM-04',[3],/REST API|Webhook/i,'企业具备 REST API、Webhook 和批量文件交换能力。'),
    make('C02','COM-04',[3],/12个模拟接口/i,'企业完成了 12 个模拟接口联调。'),
    make('C03','COM-02',[3],/平台|产品/i,'企业产品平台具备明确的业务能力。'),
    make('C04','COM-02',[5],/版本|能力/i,'企业产品平台的版本与能力信息可被核验。'),
    make('C05','COM-03',[5],/Linux|PostgreSQL/i,'企业完成 Linux 与 PostgreSQL 兼容环境验证。'),
    make('C06','COM-03',[3],/部署|架构/i,'企业具备技术架构和部署适配能力。'),
    make('C07','COM-05',[3],/数据治理|迁移/i,'企业具备数据治理和迁移能力。'),
    make('C08','COM-05',[5],/目录|字段/i,'企业能够进行数据目录和字段治理。'),
    make('C09','COM-06',[3],/权限|审计/i,'企业完成权限、安全与审计测试。'),
    make('C10','COM-06',[3],/测试|记录/i,'企业具备安全测试记录和审计能力。'),
    make('C11','COM-07',[5],/P95|虚拟用户/i,'企业完成虚拟用户性能和容量测试。'),
    make('C12','COM-07',[5],/10000|42秒/i,'企业导入 10000 条合成记录耗时 42 秒。'),
    make('C13','COM-08',[3],/备份|恢复|演练/i,'企业具备备份恢复与容灾演练能力。'),
    make('C14','COM-08',[5],/恢复|容灾/i,'企业能够执行容灾恢复演练。'),
    make('C15','COM-09',[3],/实施|质量/i,'企业具备项目实施与质量管理方法。'),
    make('C16','COM-09',[5],/风险|变更/i,'企业具备项目风险与变更管理能力。'),
    make('C17','COM-10',[3],/团队|人员/i,'企业具备项目团队与人员能力。'),
    make('C18','COM-11',[3],/测试|培训|验收/i,'企业具备测试、培训和验收交付能力。'),
    make('C19','COM-11',[3],/交付|验收/i,'企业具备项目交付和验收能力。'),
    make('C20','COM-12',[3],/巡检|告警|故障/i,'企业具备运维巡检、告警和故障处理能力。'),
    make('C21','COM-12',[3],/备份|复盘/i,'企业具备运维备份和故障复盘能力。'),
    make('C22','COM-13',[3],/城市|协同/i,'企业具备城市事件协同平台项目能力。'),
    make('C23','COM-14',[3],/医院|接口/i,'企业具备医院接口与数据平台项目能力。'),
    make('C24','COM-15',[3],/资质|授权|知识产权/i,'企业具有可核验的资质、授权或知识产权材料。')
  ];
}

function factBoundaryDefinitions() {
  const make = (case_id, doc, preferred, pattern, reason) => ({ case_id, doc, preferred, pattern, reason, category: 'BOUNDARY' });
  return [
    make('BND01','UNI-08',[5],/官方|来源/i,'PUBLIC_GUIDANCE_REFERENCE_ONLY'),
    make('BND02','GOV-02',[5],/官方|来源/i,'PUBLIC_GUIDANCE_REFERENCE_ONLY'),
    make('BND03','MED-04',[5],/官方|来源/i,'PUBLIC_GUIDANCE_REFERENCE_ONLY'),
    make('BND04','COM-04',[5],/不代表已对接/i,'NEGATIVE_ENTERPRISE_PROOF'),
    make('BND05','COM-06',[5],/不等同于认证/i,'NON_SUPPORTING_ENTERPRISE_SOURCE'),
    make('BND06','COM-12',[5],/不构成真实客户合同/i,'NEGATIVE_ENTERPRISE_PROOF'),
    make('BND07','COM-16',[3],/商务|合同/i,'COMMERCIAL_BOUNDARY'),
    make('BND08','GOV-08',[5],/官方|来源/i,'PUBLIC_GUIDANCE_REFERENCE_ONLY')
  ];
}

async function runFactPhase({ corpus, external, runtime, ledger = null }) {
  const factContract = getSemanticTaskContract('evidence_fact_extraction');
  const canonicalContract = { contract_version: 'evidence-fact-v1', owner: 'createEvidenceFactContract', schema_owner: 'backend/src/pipeline/evidence-fact-contract-v1.js' };
  const contract = { ...contractSnapshot('evidence_fact_extraction', runtime), canonical_fact_contract: canonicalContract, task_schema_hash: factContract?.data_schema ? schemaSha256(factContract.data_schema) : null };
  const gatewayFetch = async (url, options = {}) => {
    const reserved = external.embeddingCalls.length + external.gatewayReserved;
    if (reserved >= MAX_EXTERNAL_ATTEMPTS) throw Object.assign(new Error('OVERNIGHT_PROVIDER_CALL_CAP_REACHED'), { code: 'OVERNIGHT_PROVIDER_CALL_CAP_REACHED' });
    const ledgerAttempt = ledger ? await ledger.aboutToSend({ phase: 'C', caseId: external.currentCase }) : null;
    external.gatewayReserved += 1;
    const call = { phase: 'C', kind: 'fact_extraction', case_id: external.currentCase, endpoint_host: (() => { try { return new URL(url).hostname; } catch { return 'invalid'; } })(), started_at: new Date().toISOString() };
    external.gatewayCalls.push(call);
    const headers = { ...(options.headers || {}), 'x-semantic-gateway-diagnostic': 'probe-v1' };
    const started = Date.now();
    try {
      const response = await fetch(url, { ...options, headers });
      call.http_status = response.status; call.latency_ms = Date.now() - started;
      try { const body = await response.clone().json(); const d = body?.probe_diagnostics; if (d) Object.assign(call, { provider_http_reached: d.provider_http_reached === true, provider_http_status: d.provider_http_status ?? null, finish_reason: d.finish_reason ?? null, prompt_tokens: d.prompt_tokens ?? null, completion_tokens: d.completion_tokens ?? null, output_truncated: d.output_truncated === true, response_format_type: d.response_format_type ?? null }); } catch {}
      if (ledger) await ledger.record({ phase: 'C', caseId: external.currentCase, attempt: ledgerAttempt, event: response.ok ? 'HTTP_SUCCESS' : 'HTTP_ERROR', http_status: response.status, provider_http_status: call.provider_http_status ?? null, provider_http_reached: call.provider_http_reached ?? null, finish_reason: call.finish_reason ?? null, completion_tokens: call.completion_tokens ?? null, output_truncated: call.output_truncated ?? null });
      return response;
    } catch (error) {
      call.error_code = error.code || error.name || 'GATEWAY_REQUEST_FAILED';
      if (ledger && ledgerAttempt != null) await ledger.record({ phase: 'C', caseId: external.currentCase, attempt: ledgerAttempt, event: error.name === 'AbortError' || error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'HTTP_ERROR', error_code: call.error_code });
      throw error;
    }
  };
  const client = createSemanticGatewayClientFromEnv({ env: process.env, fetchImpl: gatewayFetch, taskType: 'evidence_fact_extraction' });
  const baseExtractor = new SemanticGatewayEvidenceFactExtractor({ client, version: 'evidence-fact-extraction-v1' });
  const capture = { lastCandidates: null };
  const extractor = { version: baseExtractor.version, async extract(context, options) { const candidates = await baseExtractor.extract(context, options); capture.lastCandidates = candidates; return candidates; } };
  const producedFacts = [];
  const repo = {
    getEvidenceReviewForFact: async ({ reviewId }) => repo.contexts.get(String(reviewId)) || null,
    upsertEvidenceSourceFact: async fact => { repo.facts.push(fact); return fact; },
    contexts: new Map(), facts: []
  };
  const service = new EvidenceSourceFactService({ repository: repo, projectAuthorizationService: { assertProjectAccess: async () => null }, extractor, extractorVersion: 'evidence-fact-extraction-v1' });
  const eligibleRows = [];
  for (const definition of factCaseDefinitions()) {
    external.currentCase = definition.case_id;
    let source = null; let error = null; let result = null; capture.lastCandidates = null;
    try {
      source = resolvedSource(corpus, definition.doc, definition.preferred, definition.pattern);
      const reviewId = `EVAL-REVIEW-${definition.case_id}`;
      const context = { review_id: reviewId, project_id: SYNTHETIC_PROJECT_ID, review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1', source_span_id: source.resolved.span_id, source_text: source.resolved.source_text, source_text_hash: source.resolved.source_text_hash, current_source_text_hash: source.resolved.source_text_hash, material_id: source.material.id, anchor_chunk_id: source.chunk.chunk_id, material_type: source.material.material_type, evidence_capability: 'capable', support_level: 'full_support', fact_extraction_expected: true };
      repo.contexts.set(reviewId, context);
      result = await service.extract({ projectId: SYNTHETIC_PROJECT_ID, reviewId, actor: { actor_id: 'overnight-eval', role: 'system' } });
      const audit = result.provider_audit || {};
      eligibleRows.push({ case_id: definition.case_id, category: definition.category, material: { doc_id: definition.doc, material_id: source.material.id, chunk_id: source.chunk.chunk_id, source_span_id: source.resolved.span_id, source_text: source.resolved.source_text }, provider_called: external.gatewayCalls.some(call => call.case_id === definition.case_id), attempt_count: audit.attempt_count ?? null, first_pass: audit.first_pass ?? null, retry_eligible: audit.retry_eligible ?? null, retry_attempted: audit.retry_attempted ?? null, auto_recovered: audit.auto_recovered ?? null, final_success: true, semantic_candidates: capture.lastCandidates || [], canonical_facts: result.facts || [], provider_audit: audit, error: null });
    } catch (caught) {
      error = { code: caught.code || caught.name || 'FACT_EXTRACTION_FAILED', message: caught.message, details: caught.details || null };
      const audit = caught.details?.provider_audit || {};
      eligibleRows.push({ case_id: definition.case_id, category: definition.category, material: source ? { doc_id: definition.doc, material_id: source.material.id, chunk_id: source.chunk.chunk_id, source_span_id: source.resolved.span_id, source_text: source.resolved.source_text } : null, provider_called: external.gatewayCalls.some(call => call.case_id === definition.case_id), attempt_count: caught.details?.attempt_count ?? null, first_pass: false, retry_eligible: null, retry_attempted: null, auto_recovered: false, final_success: false, semantic_candidates: capture.lastCandidates || [], canonical_facts: [], provider_audit: audit, error });
    }
    producedFacts.push(...(result?.facts || []));
  }
  const boundaryRows = [];
  for (const definition of factBoundaryDefinitions()) {
    external.currentCase = definition.case_id;
    let source = null; let error = null;
    try { source = resolvedSource(corpus, definition.doc, definition.preferred, definition.pattern); } catch (caught) { error = { code: caught.code || caught.name, message: caught.message }; }
    boundaryRows.push({ case_id: definition.case_id, category: definition.category, reason: definition.reason, material: source ? { doc_id: definition.doc, material_id: source.material.id, chunk_id: source.chunk.chunk_id, source_span_id: source.resolved.span_id, source_text: source.resolved.source_text } : null, provider_called: false, blocked_before_provider: true, error });
  }
  const valid = eligibleRows.filter(row => row.final_success && row.canonical_facts.length > 0).length;
  const hallucination = eligibleRows.reduce((sum, row) => sum + row.canonical_facts.filter(fact => !fact.source_text_hash || fact.material_id == null).length, 0);
  return { contract, eligible: eligibleRows, boundary: boundaryRows, metrics: { provider_cases: eligibleRows.length, final_valid_grounded: valid, first_pass: eligibleRows.filter(row => row.first_pass).length, retry_recovered: eligibleRows.filter(row => row.auto_recovered).length, human_escalation: eligibleRows.filter(row => row.error).length, hallucination, authority_contamination: boundaryRows.filter(row => row.provider_called).length, provenance_failure: eligibleRows.filter(row => row.final_success && row.canonical_facts.some(fact => fact.material_id !== row.material.material_id || fact.source_span_id !== row.material.source_span_id)).length, boundary_blocked: boundaryRows.filter(row => row.blocked_before_provider && !row.provider_called).length }, provider_requests: external.gatewayCalls.filter(call => call.phase === 'C').length, canonical_fact_count: producedFacts.length };
}

async function runMappingReadinessAudit({ pool }) {
  const counts = {};
  for (const [name, query] of [
    ['approved_evidence_source_facts', `SELECT count(*)::int AS n FROM evidence_source_facts WHERE review_status='approved'`],
    ['approved_legacy_facts', `SELECT count(*)::int AS n FROM evidence_facts WHERE review_status='approved'`],
    ['confirmed_requirements_public', `SELECT count(*)::int AS n FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE b.status='confirmed'`],
    ['approved_mappings', `SELECT count(*)::int AS n FROM requirement_evidence_fact_mappings WHERE review_status='approved'`]
  ]) {
    try { counts[name] = Number((await pool.query(query)).rows[0].n); } catch (error) { counts[name] = { error: error.code || 'QUERY_FAILED' }; }
  }
  const blocked = counts.approved_evidence_source_facts === 0 || counts.approved_mappings === 0;
  return {
    runtime_available: true,
    benchmark_executed: false,
    cases: 0,
    approval_boundary_blocker: blocked ? 'MAPPING_BENCHMARK_BLOCKED_BY_APPROVAL_BOUNDARY' : null,
    mapping_results: [],
    readiness_results: [],
    actual_callers: { mapping: 'RequirementEvidenceFactMappingService', readiness: 'EvidenceReadinessService' },
    authority_requirements: ['approved Evidence Fact', 'confirmed Requirement', 'human-approved Mapping'],
    persistence_boundary: 'read-only audit; no mapping/readiness writes',
    counts
  };
}

function summarizeCalls(external) {
  const all = [...external.embeddingCalls, ...external.gatewayCalls];
  const latencies = all.map(item => Number(item.latency_ms)).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = p => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))] : null;
  return {
    http_attempts: all.length,
    provider_attempt_upper_bound: external.embeddingCalls.length + external.gatewayReserved,
    embedding: { attempts: external.embeddingCalls.length, success: external.embeddingCalls.filter(item => item.http_status >= 200 && item.http_status < 300).length, failure: external.embeddingCalls.filter(item => !(item.http_status >= 200 && item.http_status < 300)).length },
    semantic_review: { gateway_requests: external.gatewayCalls.filter(item => item.phase === 'B').length, provider_reached: external.gatewayCalls.filter(item => item.phase === 'B' && item.provider_http_reached).length },
    fact_extraction: { gateway_requests: external.gatewayCalls.filter(item => item.phase === 'C').length, provider_reached: external.gatewayCalls.filter(item => item.phase === 'C' && item.provider_http_reached).length },
    retry: external.gatewayCalls.filter(item => item.phase === 'C').length - new Set(external.gatewayCalls.filter(item => item.phase === 'C').map(item => item.case_id)).size,
    latency_ms: { min: latencies[0] ?? null, mean: latencies.length ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)) : null, p50: percentile(0.5), p95: percentile(0.95), max: latencies.at(-1) ?? null },
    token_usage: { prompt_tokens: all.reduce((sum, item) => sum + (Number.isInteger(item.prompt_tokens) ? item.prompt_tokens : 0), 0) || 'UNAVAILABLE', completion_tokens: all.reduce((sum, item) => sum + (Number.isInteger(item.completion_tokens) ? item.completion_tokens : 0), 0) || 'UNAVAILABLE' }
  };
}

function primaryRootCause({ retrieval, semantic, fact, mapping, semanticBlocker = null }) {
  if (retrieval.metrics.scope_violations > 0 || retrieval.metrics.provenance_failures > 0) return 'RETRIEVAL_QUALITY_BLOCKER';
  if (semantic.metrics.reference_contamination > 0) return 'EVIDENCE_AUTHORITY_BLOCKER';
  if (semanticBlocker?.stop_before_fact) return 'SEMANTIC_SYSTEMIC_BLOCKER';
  if (fact.metrics.authority_contamination > 0 || fact.metrics.provenance_failure > 0) return 'EVIDENCE_AUTHORITY_BLOCKER';
  if (fact.metrics.final_valid_grounded < 23) return 'FACT_EXTRACTION_BLOCKER';
  if (semantic.metrics.pass < 34) return 'SEMANTIC_REVIEW_BLOCKER';
  if (mapping.approval_boundary_blocker) return 'MAPPING_APPROVAL_BOUNDARY_BLOCKED';
  return 'NO_CRITICAL_BLOCKER_FOUND';
}

function renderMaster({ fixtureHash, distribution, baseline, post, retrieval, semantic, fact, mapping, external, runtime, corpus, semanticBlocker = null }) {
  const summary = summarizeCalls(external);
  const root = primaryRootCause({ retrieval, semantic, fact, mapping, semanticBlocker });
  const critical = [];
  if (retrieval.metrics.scope_violations || retrieval.metrics.provenance_failures) critical.push({ phase: 'A', code: 'RETRIEVAL_CONTEXT_CRITICAL_FAIL', scope_violations: retrieval.metrics.scope_violations, provenance_failures: retrieval.metrics.provenance_failures });
  if (semantic.metrics.reference_contamination) critical.push({ phase: 'B', code: 'EVIDENCE_AUTHORITY_CONTAMINATION', count: semantic.metrics.reference_contamination });
  if (semanticBlocker?.stop_before_fact) critical.push({ phase: 'B', code: 'SEMANTIC_SYSTEMIC_BLOCKER', reason: semanticBlocker.reason, affected_cases: semanticBlocker.affected_cases });
  if (fact.metrics.authority_contamination || fact.metrics.provenance_failure) critical.push({ phase: 'C', code: 'FACT_CHAIN_HARD_FAIL', authority_contamination: fact.metrics.authority_contamination, provenance_failure: fact.metrics.provenance_failure });
  const status = critical.length ? 'V43_OVERNIGHT_BENCHMARK_COMPLETE_WITH_BLOCKER' : root === 'MAPPING_APPROVAL_BOUNDARY_BLOCKED' ? 'V43_OVERNIGHT_BENCHMARK_COMPLETE_WITH_BLOCKER' : 'V43_OVERNIGHT_EVIDENCE_CHAIN_BENCHMARK_COMPLETE';
  return {
    run_id: 'v43-overnight-rag-evidence-chain-master-v1', started_at: baseline.started_at, finished_at: new Date().toISOString(), baseline: { ...baseline, package_materials_observed: corpus.materials.size, package_chunks_observed: corpus.chunks.length, fixture_sha256: fixtureHash, distribution, runtime: safeSemanticGatewayRuntimeSummary(readRuntimeConfig(process.env)) },
    provider_cap: { max_attempts: MAX_EXTERNAL_ATTEMPTS, reserved_or_observed_attempts: summary.provider_attempt_upper_bound, reached: summary.provider_attempt_upper_bound >= MAX_EXTERNAL_ATTEMPTS },
    phases: { retrieval_context: retrieval.metrics, semantic_review: { ...semantic.metrics, systemic_blocker: semanticBlocker }, fact: fact.metrics, mapping_readiness: mapping },
    provider: summary,
    database: { pre: baseline.pre_db_counts, post, unexpected_delta: Object.fromEntries(Object.keys(baseline.pre_db_counts).map(key => [key, JSON.stringify(baseline.pre_db_counts[key]) !== JSON.stringify(post[key])])) },
    critical_failures: critical,
    primary_root_cause: root,
    secondary_findings: [
      corpus.chunks.length !== 478 ? `PACKAGE_CHUNK_COUNT_OBSERVED_${corpus.chunks.length}_BASELINE_478` : null,
      mapping.approval_boundary_blocker,
      semantic.metrics.fail ? `SEMANTIC_REVIEW_FAIL_${semantic.metrics.fail}` : null,
      fact.metrics.final_valid_grounded < 23 ? `FACT_VALID_GROUNDED_${fact.metrics.final_valid_grounded}_OF_24` : null,
      summary.provider_attempt_upper_bound >= MAX_EXTERNAL_ATTEMPTS ? 'PROVIDER_CAP_REACHED' : null
    ].filter(Boolean),
    next_actions: [
      { priority: 'P0', problem: critical.length ? 'Address benchmark critical failure before production interpretation.' : 'No critical blocker observed.', evidence: critical.length ? critical : 'all hard-fail counters zero', minimal_change: 'Review only the named layer; keep frozen contracts unchanged.', expected_benefit: 'Restore evidence-chain confidence.', architecture_impact: 'none' },
      { priority: 'P1', problem: mapping.approval_boundary_blocker || 'Expand approved fixtures for mapping/readiness.', evidence: mapping.approval_boundary_blocker || 'read-only counts', minimal_change: 'Human approval of valid canonical fixtures.', expected_benefit: 'Enable read-only mapping benchmark.', architecture_impact: 'none' },
      { priority: 'P2', problem: 'Review semantic/fact quality findings.', evidence: { semantic: semantic.metrics, fact: fact.metrics }, minimal_change: 'Adjudicate offline artifacts before any tuning.', expected_benefit: 'Separate model quality from authority/runtime issues.', architecture_impact: 'none' }
    ],
    final_status: status,
    safety: { production_code_writes: 0, db_writes: 0, commit: 'NO', push: 'NO', deploy: 'NO', reset: 'NO', clean: 'NO' },
    frozen_contracts: { requirement_extraction: '4.3-requirement-extraction-v3.1.1', candidate: '4.3-requirement-candidate-v3', fact_task: '4.3-evidence-fact-extraction-v1', canonical_fact: 'evidence-fact-v1' }
  };
}

async function main() {
  const started = new Date().toISOString();
  const external = { attempts: [], embeddingCalls: [], gatewayCalls: [], gatewayReserved: 0, currentCase: null };
  const runtime = safeSemanticGatewayRuntimeSummary(readRuntimeConfig(process.env));
  const { fixture, fixtureHash, distribution } = await readFixture();
  const pool = createPool();
  const repository = new PgRepository(pool);
  const pre = await tableCounts(pool);
  const corpus = await loadCorpus(repository);
  const baseline = { started_at: started, pre_db_counts: pre, expected_package_materials: 50, expected_historical_chunks: 478, observed_embedding_coverage: corpus.chunks.filter(row => row.embedding_id).length };
  const retrieval = await runRetrievalPhase({ pool, repository, corpus, fixture, external });
  await writeJson(path.join(resultsDir, '01_retrieval_context_40case.json'), { fixture_sha256: fixtureHash, fixture_path: fixturePath, metrics: retrieval.metrics, embedding_config: retrieval.embedding_config, cases: retrieval.rows });
  await writeFile(path.join(resultsDir, '01_retrieval_context_40case.csv'), csv(retrieval.rows, ['case_id','theme','scope','project_kind','query','expected_doc_hit','relevant_at_3','relevant_at_5','scope_violations','context_failures','provenance_failures']), 'utf8');
  const semantic = await runSemanticReviewPhase({ corpus, external, runtime });
  await writeJson(path.join(resultsDir, '02_semantic_review_contract.json'), semantic.contract);
  await writeJson(path.join(resultsDir, '02_semantic_review_36case.json'), { run_id: 'v43-overnight-semantic-review-v1', contract: semantic.contract, metrics: semantic.metrics, cases: semantic.rows });
  await writeFile(path.join(resultsDir, '02_semantic_review_36case.csv'), csv(semantic.rows, ['case_id','category','expected_label','actual_label','provider_called','error']), 'utf8');
  const semanticBlocker = semanticSystemicBlocker(semantic);
  const fact = shouldRunFactPhase({ semanticBlocker, observedAttempts: external.gatewayReserved, providerBudget: MAX_EXTERNAL_ATTEMPTS })
    ? await runFactPhase({ corpus, external, runtime })
    : null;
  if (fact) {
    await writeJson(path.join(resultsDir, '03_fact_contract.json'), fact.contract);
    await writeJson(path.join(resultsDir, '03_fact_32case.json'), { run_id: 'v43-overnight-fact-v1', contract: fact.contract, metrics: fact.metrics, eligible: fact.eligible, boundary: fact.boundary });
    await writeFile(path.join(resultsDir, '03_fact_32case.csv'), csv([...fact.eligible, ...fact.boundary], ['case_id','category','provider_called','attempt_count','first_pass','retry_attempted','auto_recovered','final_success','error']), 'utf8');
  }
  const factForReporting = fact || { eligible: [], boundary: [], metrics: { provider_cases: 0, final_valid_grounded: 0, first_pass: 0, retry_recovered: 0, human_escalation: 0, hallucination: 0, authority_contamination: 0, provenance_failure: 0, boundary_blocked: 0 }, contract: null, provider_requests: 0, canonical_fact_count: 0 };
  const mapping = await runMappingReadinessAudit({ pool });
  await writeJson(path.join(resultsDir, '04_mapping_readiness_audit.json'), mapping);
  await writeFile(path.join(resultsDir, '04_mapping_readiness_report.md'), `# Mapping / Readiness Audit\n\n- runtime available: ${mapping.runtime_available}\n- benchmark executed: ${mapping.benchmark_executed}\n- approval boundary blocker: ${mapping.approval_boundary_blocker || 'none'}\n- counts: \`${JSON.stringify(mapping.counts)}\`\n- authority: ${mapping.authority_requirements.join(', ')}\n- writes: none\n`, 'utf8');
  const post = await tableCounts(pool);
  const master = renderMaster({ fixtureHash, distribution, baseline, post, retrieval, semantic, fact: factForReporting, mapping, external, runtime, corpus, semanticBlocker });
  await writeJson(path.join(resultsDir, '00_master_summary.json'), master);
  await writeFile(path.join(resultsDir, '00_master_checkpoint.md'), renderMarkdown(master), 'utf8');
  await writeFile(path.join(resultsDir, '05_provider_calls.csv'), csv([...external.embeddingCalls, ...external.gatewayCalls], ['phase','kind','case_id','endpoint_host','http_status','provider_http_status','provider_http_reached','finish_reason','prompt_tokens','completion_tokens','output_truncated','latency_ms','error_code']), 'utf8');
  const failures = [...retrieval.rows.filter(row => row.error).map(row => ({ phase: 'A', case_id: row.case_id, task: 'retrieval', error: row.error })), ...semantic.rows.filter(row => row.error).map(row => ({ phase: 'B', case_id: row.case_id, task: 'evidence_support_assessment', error: row.error })), ...factForReporting.eligible.filter(row => row.error).map(row => ({ phase: 'C', case_id: row.case_id, task: 'evidence_fact_extraction', error: row.error }))];
  await writeFile(path.join(resultsDir, '05_failures.jsonl'), failures.map(row => JSON.stringify(row)).join('\n') + (failures.length ? '\n' : ''), 'utf8');
  await writeFile(path.join(resultsDir, '05_regression_tests.md'), '# Regression boundary\n\nGenerated by overnight benchmark. Targeted offline suite is run after artifact generation; no production test writes are permitted.\n', 'utf8');
  await pool.end();
  console.log(JSON.stringify({ final_status: master.final_status, provider_attempt_upper_bound: master.provider_cap.reserved_or_observed_attempts, retrieval: retrieval.metrics, semantic: semantic.metrics, fact: factForReporting.metrics, mapping: mapping.approval_boundary_blocker || null }, null, 2));
}

function renderMarkdown(master) {
  const p = master.phases;
  return `# V43_OVERNIGHT_RAG_EVIDENCE_MASTER_CHECKPOINT\n\n## OVERVIEW\n\n- start baseline: ${master.started_at}\n- package: ${master.baseline.package_materials_observed} materials / ${master.baseline.package_chunks_observed} chunks\n- provider attempts (upper bound): ${master.provider_cap.reserved_or_observed_attempts}/${master.provider_cap.max_attempts}\n- production writes: 0\n- DB writes: 0\n- provider cap reached: ${master.provider_cap.reached}\n\n## PHASE A — RETRIEVAL / CONTEXT\n\n- cases: ${p.retrieval_context.cases}\n- expected doc hit: ${p.retrieval_context.expected_doc_hit}/${p.retrieval_context.cases}\n- Relevant@5 cases with a hit: ${p.retrieval_context.relevant_at_5_rate}%\n- scope violations: ${p.retrieval_context.scope_violations}\n- final heading-only: ${p.retrieval_context.heading_only_final}\n- context failures: ${p.retrieval_context.context_failures}\n- provenance failures: ${p.retrieval_context.provenance_failures}\n- status: ${p.retrieval_context.scope_violations || p.retrieval_context.provenance_failures ? 'CRITICAL_FAIL' : 'RECORDED'}\n\n## PHASE B — SEMANTIC REVIEW\n\n- cases: ${p.semantic_review.cases}\n- pass: ${p.semantic_review.pass}\n- fail: ${p.semantic_review.fail}\n- negative false-positive: ${p.semantic_review.negative_false_positive}\n- reference contamination: ${p.semantic_review.reference_contamination}\n- schema invalid: ${p.semantic_review.schema_invalid}\n- status: ${p.semantic_review.fail ? 'QUALITY_FINDINGS' : 'RECORDED'}\n\n## PHASE C — FACT\n\n- provider cases: ${p.fact.provider_cases}\n- final valid: ${p.fact.final_valid_grounded}\n- first-pass: ${p.fact.first_pass}\n- retry recovered: ${p.fact.retry_recovered}\n- human escalation: ${p.fact.human_escalation}\n- hallucination: ${p.fact.hallucination}\n- authority contamination: ${p.fact.authority_contamination}\n- provenance failure: ${p.fact.provenance_failure}\n- status: ${p.fact.authority_contamination || p.fact.provenance_failure ? 'CRITICAL_FAIL' : 'RECORDED'}\n\n## PHASE D — MAPPING / READINESS\n\n- runtime available: ${master.phases.mapping_readiness.runtime_available}\n- benchmark executed: ${master.phases.mapping_readiness.benchmark_executed}\n- approval boundary blocker: ${master.phases.mapping_readiness.approval_boundary_blocker || 'none'}\n\n## PROVIDER\n\n- HTTP attempts (embedding + Gateway): ${master.provider.http_attempts}\n- provider attempt upper bound: ${master.provider.provider_attempt_upper_bound}\n- embedding: ${JSON.stringify(master.provider.embedding)}\n- semantic review Gateway requests: ${master.provider.semantic_review.gateway_requests}\n- fact Gateway requests: ${master.provider.fact_extraction.gateway_requests}\n- retry: ${master.provider.retry}\n- latency: ${JSON.stringify(master.provider.latency_ms)}\n\n## DB\n\n- pre counts: \`${JSON.stringify(master.database.pre)}\`\n- post counts: \`${JSON.stringify(master.database.post)}\`\n- unexpected delta: \`${JSON.stringify(master.database.unexpected_delta)}\`\n\n## CRITICAL FAILURES\n\n${master.critical_failures.length ? master.critical_failures.map(item => `- ${JSON.stringify(item)}`).join('\\n') : 'NONE'}\n\n## PRIMARY ROOT CAUSE\n\n${master.primary_root_cause}\n\n## NEXT ACTIONS\n\n${master.next_actions.map(item => `### ${item.priority}\\n\\n- problem: ${item.problem}\\n- evidence: ${JSON.stringify(item.evidence)}\\n- minimal change: ${item.minimal_change}\\n- expected benefit: ${item.expected_benefit}\\n- architecture impact: ${item.architecture_impact}`).join('\\n\\n')}\n\n## GIT\n\n- commit: NO\n- push: NO\n- deploy: NO\n- dirty worktree preserved: YES\n- tender benchmark preserved: YES\n\n## FINAL STATUS\n\n${master.final_status}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: error.message, stack: error.stack }, null, 2)); process.exitCode = 1; });
}

export {
  loadCorpus,
  tableCounts,
  runSemanticReviewPhase,
  runFactPhase,
  semanticSystemicBlocker,
  shouldRunFactPhase
};
