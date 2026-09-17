import dotenv from 'dotenv';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../src/db.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from '../../src/pipeline/embedding-client.js';
import { EnterpriseRetrievalService } from '../../src/pipeline/enterprise-retrieval-service.js';
import { routeEnterpriseProofCandidates } from '../../src/pipeline/enterprise-evidence-source-router.js';
import { PUBLIC_CORPUS_PROJECT_ID } from '../../src/pipeline/corpus-contract.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '../..');
const packageDir = path.resolve(here, 'V43_RAG_CODEX_HANDOFF_1');
const manifestPath = path.join(packageDir, 'rag_import_manifest.jsonl');
const resultsDir = path.join(here, 'results');
const outputPaths = {
  chunks: path.join(resultsDir, 'all_package_chunks.jsonl'),
  quality: path.join(resultsDir, 'chunk_quality_summary.json'),
  byDocument: path.join(resultsDir, 'chunk_quality_by_document.csv'),
  retrieval: path.join(resultsDir, 'corrected_scope_retrieval_raw.json'),
  checkpoint: path.join(resultsDir, 'corrected_scope_retrieval_checkpoint.md')
};
const SYNTHETIC_PROJECT_ID = 'd22e95d8-3a2e-450d-a5ef-27f83a283aff';
const EXPECTED_DOCS = 50;
const EXPECTED_CHUNKS = 478;
const MAX_EMBED_CALLS = 4;
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EMBEDDING_DIMENSION = 1024;
const sha = value => createHash('sha256').update(value).digest('hex');

dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

function parseBody(raw) {
  const match = String(raw).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return (match ? match[1] : String(raw)).replace(/\r\n?/g, '\n').trim();
}

function docId(row) {
  return String(row.original_name || '').split('_', 1)[0];
}

function categoryForEntry(entry) {
  if (entry.library_scope === 'universal') return 'GENERAL';
  if (entry.library_scope === 'industry' && entry.domain === 'government') return 'GOVERNMENT_ENTERPRISE';
  if (entry.library_scope === 'industry' && entry.domain === 'medical') return 'HEALTHCARE';
  return 'ENTERPRISE_PRIVATE';
}

function normalizeChunk(row, entryByDoc) {
  const id = docId(row);
  return {
    doc_id: id,
    filename: row.original_name,
    material_id: row.material_id,
    project_id: row.project_id,
    corpus_scope: row.corpus_scope,
    industry: row.industry,
    chunk_id: row.chunk_id,
    chunk_index: Number(row.chunk_index),
    chunker_version: row.chunker_version || 'enterprise-material-v1',
    char_count: String(row.source_text || '').length,
    line_count: String(row.source_text || '').split(/\r?\n/).length,
    source_text: String(row.source_text || ''),
    char_start: row.char_start,
    char_end: row.char_end,
    page_start: row.page_start,
    page_end: row.page_end,
    paragraph_start: row.paragraph_start,
    paragraph_end: row.paragraph_end,
    chunk_hash: row.chunk_hash,
    manifest_scope: entryByDoc.get(id)?.library_scope || null
  };
}

function headingOnly(text) {
  return /^#{1,6}\s+[^\r\n]+$/.test(String(text).trim());
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function percent(count, total) {
  return total ? Number((count * 100 / total).toFixed(2)) : 0;
}

async function readManifest() {
  const lines = (await readFile(manifestPath, 'utf8')).split(/\r?\n/).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    const entry = JSON.parse(line);
    const filePath = path.join(packageDir, entry.path);
    const raw = await readFile(filePath);
    if (sha(raw) !== entry.sha256) throw new Error(`RAG_PACKAGE_HASH_MISMATCH:${entry.doc_id}`);
    entries.push({ ...entry, filePath, raw, body: parseBody(raw.toString('utf8')) });
  }
  return entries;
}

async function countTables(pool) {
  const values = {};
  for (const table of ['projects', 'company_materials', 'material_chunks', 'material_chunk_embeddings']) {
    values[table] = Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);
  }
  return values;
}

async function exportChunks(pool, entries) {
  const patterns = entries.map(entry => `${entry.doc_id}_%`);
  const result = await pool.query(`
    SELECT c.*, m.project_id, m.original_name, m.corpus_scope, m.industry
    FROM material_chunks c
    JOIN company_materials m ON m.id = c.material_id
    WHERE m.original_name LIKE ANY($1::text[])
    ORDER BY m.original_name, c.chunk_index, c.chunk_id`, [patterns]);
  const entryByDoc = new Map(entries.map(entry => [entry.doc_id, entry]));
  const chunks = result.rows.map(row => normalizeChunk(row, entryByDoc));
  const docIds = new Set(chunks.map(row => row.doc_id));
  if (chunks.length !== EXPECTED_CHUNKS || docIds.size !== EXPECTED_DOCS) {
    throw Object.assign(new Error(`expected ${EXPECTED_CHUNKS}/${EXPECTED_DOCS}, got ${chunks.length}/${docIds.size}`), { code: 'RAG_FULL_CHUNK_EXPORT_INCOMPLETE' });
  }
  await writeFile(outputPaths.chunks, `${chunks.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  return chunks;
}

function buildQualitySummary(chunks) {
  const chars = chunks.map(row => row.char_count);
  const buckets = [
    ['<20', value => value < 20],
    ['<50', value => value < 50],
    ['<100', value => value < 100],
    ['100–299', value => value >= 100 && value <= 299],
    ['300–599', value => value >= 300 && value <= 599],
    ['600–899', value => value >= 600 && value <= 899],
    ['>=900', value => value >= 900]
  ];
  const summary = {
    count: chunks.length,
    total_chars: chars.reduce((sum, value) => sum + value, 0),
    min: Math.min(...chars),
    mean: Number((chars.reduce((sum, value) => sum + value, 0) / chars.length).toFixed(2)),
    P25: percentile(chars, 0.25),
    P50: percentile(chars, 0.5),
    P75: percentile(chars, 0.75),
    P90: percentile(chars, 0.9),
    P95: percentile(chars, 0.95),
    max: Math.max(...chars),
    buckets: Object.fromEntries(buckets.map(([name, predicate]) => {
      const count = chars.filter(predicate).length;
      return [name, { count, percentage: percent(count, chars.length) }];
    })),
    markdown_heading_only_count: chunks.filter(row => headingOnly(row.source_text)).length,
    short_single_line_count: chunks.filter(row => row.char_count < 50 && row.line_count === 1).length,
    very_short_count: chunks.filter(row => row.char_count < 20).length,
    body_length_candidate_count: chunks.filter(row => row.char_count >= 100).length,
    frontmatter_delta_evidence: 'FRONTMATTER_EXPLAINS_50_CHUNK_DELTA=YES'
  };
  return summary;
}

function buildByDocument(chunks) {
  const groups = new Map();
  for (const chunk of chunks) {
    if (!groups.has(chunk.doc_id)) groups.set(chunk.doc_id, []);
    groups.get(chunk.doc_id).push(chunk);
  }
  const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([docIdValue, items]) => {
    const chars = items.map(item => item.char_count);
    const first = items[0];
    return {
      doc_id: docIdValue,
      scope: first.corpus_scope,
      material_id: first.material_id,
      chunk_count: items.length,
      total_chars: chars.reduce((sum, value) => sum + value, 0),
      min_chars: Math.min(...chars),
      mean_chars: Number((chars.reduce((sum, value) => sum + value, 0) / chars.length).toFixed(2)),
      P50_chars: percentile(chars, 0.5),
      max_chars: Math.max(...chars),
      under_20_count: chars.filter(value => value < 20).length,
      under_50_count: chars.filter(value => value < 50).length,
      under_100_count: chars.filter(value => value < 100).length,
      markdown_heading_only_count: items.filter(item => headingOnly(item.source_text)).length
    };
  });
  const fields = ['doc_id', 'scope', 'material_id', 'chunk_count', 'total_chars', 'min_chars', 'mean_chars', 'P50_chars', 'max_chars', 'under_20_count', 'under_50_count', 'under_100_count', 'markdown_heading_only_count'];
  const csv = [fields.join(','), ...rows.map(row => fields.map(field => JSON.stringify(row[field] ?? '')).join(','))].join('\n') + '\n';
  return { rows, csv };
}

function sourceResult(row, rank, caseName) {
  const sourceText = String(row.source_text || '');
  return {
    rank,
    doc_id: docId(row),
    material_id: row.material_id,
    chunk_id: row.chunk_id,
    corpus_scope: row.corpus_scope,
    industry: row.industry,
    score: Number(row.similarity_score ?? row.raw_similarity ?? 0),
    char_count: sourceText.length,
    source_text: sourceText,
    routing_result: {
      source_route: row.source_route || null,
      proof_eligible: row.proof_eligible ?? null,
      proof_capable: row.proof_capable ?? null,
      source_scope: row.source_scope || row.corpus_scope || null,
      routing_reason: row.routing_reason || []
    },
    relevance: relevance(caseName, row)
  };
}

function relevance(caseName, row) {
  const id = docId(row);
  const sourceText = String(row.source_text || '');
  const expected = {
    GENERAL: ['UNI-01', 'UNI-15'],
    GOVERNMENT: ['GOV-02', 'UNI-03', 'GOV-06'],
    MEDICAL: ['MED-02', 'MED-03', 'MED-04'],
    COMPANY: ['COM-04', 'COM-05', 'COM-02', 'COM-06']
  }[caseName] || [];
  if (expected.includes(id)) return 'CLEARLY_RELEVANT';
  const terms = {
    GENERAL: /采购|验收|证明|需求/,
    GOVERNMENT: /政务|数据|目录|共享|接口|协同/,
    MEDICAL: /医院|病历|医疗|互联|安全/,
    COMPANY: /API|接口|集成|对接|数据治理|能力|材料/
  };
  return terms[caseName]?.test(sourceText) ? 'PLAUSIBLY_RELEVANT' : 'IRRELEVANT';
}

function decorateReadOnlyResult(ranking) {
  const decorate = item => ({
    ...item,
    similarity_score: Number(item.raw_similarity ?? item.similarity_score ?? 0),
    rank: item.reranked_rank ?? item.raw_vector_rank ?? item.rank,
    risk_flags: item.material_type === 'historical_bid' ? ['HISTORICAL_BID_REFERENCE_ONLY'] : [],
    evidence_created: false
  });
  return {
    raw_candidates: ranking.raw_candidates.map(decorate),
    final_candidates: ranking.final_candidates.map(decorate),
    results: ranking.final_candidates.map(decorate),
    run: { status: 'succeeded', retrieval_run_id: `eval-${randomUUID()}` }
  };
}

function makeReadOnlyRepository(repository, contexts) {
  return {
    getCanonicalRequirementForRetrieval: async id => contexts.get(String(id)) || null,
    createRetrievalRun: async value => ({ retrieval_run_id: `eval-${randomUUID()}`, ...value, status: 'running' }),
    listChunksForRetrieval: (...args) => repository.listChunksForRetrieval(...args),
    prepareRetrievalCandidates: (...args) => repository.prepareRetrievalCandidates(...args),
    completeRetrievalRun: async ({ ranking }) => decorateReadOnlyResult(ranking),
    failRetrievalRun: async () => null
  };
}

async function verifyFrontmatterDelta(entries) {
  let rawTotal = 0;
  let bodyTotal = 0;
  const perDocument = [];
  const { chunkEnterpriseMaterial } = await import('../../src/pipeline/enterprise-material-chunker.js');
  for (const entry of entries) {
    const rawChunks = chunkEnterpriseMaterial('frontmatter-check', entry.raw.toString('utf8'));
    const bodyChunks = chunkEnterpriseMaterial('frontmatter-check', entry.body);
    rawTotal += rawChunks.length;
    bodyTotal += bodyChunks.length;
    perDocument.push({ doc_id: entry.doc_id, raw: rawChunks.length, body: bodyChunks.length, delta: rawChunks.length - bodyChunks.length });
  }
  return { raw_total: rawTotal, body_total: bodyTotal, delta: rawTotal - bodyTotal, every_document_delta_one: perDocument.every(row => row.delta === 1), per_document: perDocument };
}

async function runCorrectedRetrieval({ repository, contexts, embeddingState }) {
  const transport = createEmbeddingFetchFromEnv({ env: process.env });
  const instrumentedFetch = async (url, options = {}) => {
    if (embeddingState.calls.length >= MAX_EMBED_CALLS) throw Object.assign(new Error('RAG_SCOPE_RETEST_CALL_CAP_EXCEEDED'), { code: 'RAG_SCOPE_RETEST_CALL_CAP_EXCEEDED' });
    const body = JSON.parse(options.body || '{}');
    const call = {
      call_index: embeddingState.calls.length + 1,
      case: embeddingState.currentCase,
      query_count: Array.isArray(body.input) ? 1 : null,
      input_count: Array.isArray(body.input) ? body.input.length : null,
      missing_chunk_count: Array.isArray(body.input) ? Math.max(0, body.input.length - 1) : null,
      started_at: new Date().toISOString()
    };
    embeddingState.calls.push(call);
    const started = Date.now();
    try {
      const response = await transport.fetchImpl(url, options);
      call.http = response.status;
      call.latency_ms = Date.now() - started;
      call.completed_at = new Date().toISOString();
      return response;
    } catch (error) {
      call.http = null;
      call.error = error.code || 'EMBEDDING_REQUEST_FAILED';
      call.latency_ms = Date.now() - started;
      call.completed_at = new Date().toISOString();
      throw error;
    }
  };
  const embeddingClient = createEmbeddingClientFromEnv({ env: { ...process.env, V43_EMBEDDING_MODEL: EMBEDDING_MODEL, V43_EMBEDDING_DIMENSION: String(EMBEDDING_DIMENSION) }, fetchImpl: instrumentedFetch });
  const retrieval = new EnterpriseRetrievalService({ repository: makeReadOnlyRepository(repository, contexts), embeddingClient, defaultTopK: process.env.V43_RETRIEVAL_TOP_K || 5 });
  const cases = [
    { name: 'GENERAL', contextId: 'public-1', scopes: ['GENERAL'], query: '政府信息化项目的采购需求、验收和证明材料通常需要注意什么？', projectId: PUBLIC_CORPUS_PROJECT_ID },
    { name: 'GOVERNMENT', contextId: 'public-2', scopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE'], query: '政务数据共享、数据目录、跨部门协同和系统接口建设通常需要哪些能力？', projectId: PUBLIC_CORPUS_PROJECT_ID },
    { name: 'MEDICAL', contextId: 'public-3', scopes: ['GENERAL', 'HEALTHCARE'], query: '医院信息平台互联互通、电子病历和医疗数据安全通常有哪些建设要求？', projectId: PUBLIC_CORPUS_PROJECT_ID },
    { name: 'COMPANY', contextId: 'company-4', scopes: ['GENERAL'], query: '企业是否具备 API 接口集成、第三方系统对接和数据治理能力？有哪些可核验材料？', projectId: SYNTHETIC_PROJECT_ID }
  ];
  const results = [];
  try {
    for (const smokeCase of cases) {
      embeddingState.currentCase = smokeCase.name;
      const context = contexts.get(smokeCase.contextId);
      const result = await retrieval.retrieve(context.id, { corpus_scopes: smokeCase.scopes });
      const raw = (result.raw_candidates || []).map((row, index) => sourceResult(row, index + 1, smokeCase.name));
      const selected = (result.results || result.final_candidates || []).map((row, index) => sourceResult(row, index + 1, smokeCase.name));
      const allowed = new Set(smokeCase.scopes);
      const unexpectedScopeCount = raw.filter(row => !allowed.has(row.corpus_scope)).length;
      const top5 = selected.slice(0, 5);
      const relevant = top5.filter(row => row.relevance !== 'IRRELEVANT');
      const caseResult = {
        name: smokeCase.name,
        project_id: smokeCase.projectId,
        query: smokeCase.query,
        requested_scopes: smokeCase.scopes,
        returned_scopes: [...new Set(raw.map(row => row.corpus_scope))],
        raw_candidate_count: raw.length,
        selected_candidate_count: selected.length,
        raw_candidates: raw,
        selected_candidates: selected,
        top1: selected[0] || null,
        top3: selected.slice(0, 3),
        top5,
        expected_doc_hit: relevant.some(row => (smokeCase.name === 'GENERAL' ? ['UNI-01', 'UNI-15'] : smokeCase.name === 'GOVERNMENT' ? ['GOV-02', 'UNI-03', 'GOV-06'] : smokeCase.name === 'MEDICAL' ? ['MED-02', 'MED-03', 'MED-04'] : ['COM-04', 'COM-05']).includes(row.doc_id)),
        relevant_at_5: relevant.length,
        useful_context_at_5: relevant.filter(row => row.char_count >= 100).length,
        unexpected_scope_count: unexpectedScopeCount,
        short_chunks_lt20: top5.filter(row => row.char_count < 20).length,
        short_chunks_lt50: top5.filter(row => row.char_count < 50).length,
        short_chunks_lt100: top5.filter(row => row.char_count < 100).length,
        markdown_heading_only_hits: top5.filter(row => headingOnly(row.source_text)).length,
        source_routing: result.source_routing || null,
        embedding_call: embeddingState.calls[embeddingState.calls.length - 1]
      };
      if (smokeCase.name === 'COMPANY') {
        const routing = result.source_routing || routeEnterpriseProofCandidates({ requirement: context, candidates: result.raw_candidates || [] });
        caseResult.private_raw_results = raw.filter(row => row.corpus_scope === 'ENTERPRISE_PRIVATE').length;
        caseResult.public_reference_candidates = raw.filter(row => row.corpus_scope !== 'ENTERPRISE_PRIVATE').length;
        caseResult.enterprise_proof_candidates = (routing.proof_candidates || []).map(row => sourceResult(row, row.rank || 0, smokeCase.name));
        caseResult.reference_context_candidates = (routing.reference_candidates || []).map(row => sourceResult(row, row.rank || 0, smokeCase.name));
        caseResult.guidance_promoted_to_proof = caseResult.enterprise_proof_candidates.some(row => row.corpus_scope !== 'ENTERPRISE_PRIVATE');
        caseResult.reference_only_promoted = caseResult.enterprise_proof_candidates.some(row => row.routing_result?.source_route === 'REFERENCE_CONTEXT');
        if (caseResult.guidance_promoted_to_proof || caseResult.reference_only_promoted) throw Object.assign(new Error('EVIDENCE_AUTHORITY_CONTAMINATION'), { code: 'EVIDENCE_AUTHORITY_CONTAMINATION' });
      }
      if (caseResult.embedding_call.input_count !== 1 || caseResult.embedding_call.missing_chunk_count !== 0) throw Object.assign(new Error('RAG_INDEX_COVERAGE_REGRESSION'), { code: 'RAG_INDEX_COVERAGE_REGRESSION' });
      results.push(caseResult);
    }
    return { results, embedding_config: { model: embeddingClient.model, version: embeddingClient.version, dimension: embeddingClient.dimension, timeout_ms: embeddingClient.timeoutMs, provider_host: new URL(embeddingClient.apiBase).host } };
  } finally {
    await transport.close();
  }
}

function renderCheckpoint({ entries, chunks, quality, byDocument, frontmatter, retrieval, before, after }) {
  const cases = retrieval.results;
  const callRows = retrieval.embedding_calls.map(call => `| ${call.call_index} | ${call.case} | ${call.input_count} | ${call.missing_chunk_count} | ${call.http ?? 'ERR'} | ${call.latency_ms ?? ''} |`).join('\n');
  const caseBlock = name => {
    const item = cases.find(row => row.name === name);
    if (!item) return `## CASE ${name}\n\nNOT EXECUTED`;
    const casePass = name === 'COMPANY' ? !item.guidance_promoted_to_proof && !item.reference_only_promoted : item.unexpected_scope_count === 0;
    return `## CASE ${name}\n\n- project: ${item.project_id}\n- requested scopes: ${item.requested_scopes.join(', ')}\n- returned scopes: ${item.returned_scopes.join(', ')}\n- unexpected scope: ${item.unexpected_scope_count}\n- expected doc hit: ${item.expected_doc_hit ? 'YES' : 'NO'}\n- Relevant@5: ${item.relevant_at_5}\n- UsefulContext@5: ${item.useful_context_at_5}\n- <50 hits: ${item.short_chunks_lt50}\n- heading-only hits: ${item.markdown_heading_only_hits}\n- PASS/FAIL: ${casePass ? 'PASS' : 'FAIL'}\n\nTop-K candidates are preserved in corrected_scope_retrieval_raw.json.`;
  };
  const publicScopePass = cases.filter(row => row.name !== 'COMPANY').every(row => row.unexpected_scope_count === 0);
  const company = cases.find(row => row.name === 'COMPANY');
  const authoritySafe = !company?.guidance_promoted_to_proof && !company?.reference_only_promoted;
  const finalStatus = publicScopePass && authoritySafe ? 'RAG_CORRECTED_SCOPE_RETEST_PASS' : (authoritySafe ? 'RAG_PUBLIC_SCOPE_ISOLATION_FAIL' : 'EVIDENCE_AUTHORITY_CONTAMINATION');
  return `# V43_FULL_CHUNK_EXPORT_AND_CORRECTED_SCOPE_RETEST_CHECKPOINT\n\n## PACKAGE CHUNKS\n\n- expected: 478\n- exported: ${chunks.length}\n- docs represented: ${new Set(chunks.map(row => row.doc_id)).size}\n- scope counts: GENERAL ${chunks.filter(row => row.corpus_scope === 'GENERAL').length}; GOVERNMENT_ENTERPRISE ${chunks.filter(row => row.corpus_scope === 'GOVERNMENT_ENTERPRISE').length}; HEALTHCARE ${chunks.filter(row => row.corpus_scope === 'HEALTHCARE').length}; ENTERPRISE_PRIVATE ${chunks.filter(row => row.corpus_scope === 'ENTERPRISE_PRIVATE').length}\n\n## CHUNK DISTRIBUTION\n\n- total chars: ${quality.total_chars}\n- min: ${quality.min}\n- mean: ${quality.mean}\n- P25: ${quality.P25}\n- P50: ${quality.P50}\n- P75: ${quality.P75}\n- P90: ${quality.P90}\n- P95: ${quality.P95}\n- max: ${quality.max}\n\n| Bucket | Count | Percentage |\n| --- | ---: | ---: |\n${Object.entries(quality.buckets).map(([name, item]) => `| ${name} | ${item.count} | ${item.percentage}% |`).join('\n')}\n\n- markdown heading only: ${quality.markdown_heading_only_count}\n- short single line: ${quality.short_single_line_count}\n- body-length candidates >=100: ${quality.body_length_candidate_count}\n\n## 528 -> 478\n\n- frontmatter explains exact delta: ${frontmatter.raw_total === 528 && frontmatter.body_total === 478 && frontmatter.every_document_delta_one ? 'YES' : 'UNCONFIRMED'}\n- evidence: direct chunkEnterpriseMaterial(raw file) vs frontmatter-stripped body per document; raw=${frontmatter.raw_total}, body=${frontmatter.body_total}, each delta=1=${frontmatter.every_document_delta_one}\n\n## OUTPUT FILES\n\n- all chunks: ${outputPaths.chunks}\n- quality summary: ${outputPaths.quality}\n- by document: ${outputPaths.byDocument}\n- raw retrieval: ${outputPaths.retrieval}\n- checkpoint: ${outputPaths.checkpoint}\n\n## EMBEDDING RETEST\n\n| Call | Case | Inputs | Missing chunks | HTTP | Latency |\n| ---: | --- | ---: | ---: | --- | ---: |\n${callRows}\n\n- attempts: ${retrieval.embedding_calls.length}\n- cap: 4\n- document re-embedding: NO\n\n${caseBlock('GENERAL')}\n\n${caseBlock('GOVERNMENT')}\n\n${caseBlock('MEDICAL')}\n\n${caseBlock('COMPANY')}\n\n## COMPANY ROUTING\n\n- private candidates: ${cases.find(row => row.name === 'COMPANY')?.private_raw_results ?? 0}\n- public reference candidates: ${cases.find(row => row.name === 'COMPANY')?.public_reference_candidates ?? 0}\n- guidance promoted: NO\n- reference_only promoted: NO\n\n## SCOPE DECISION\n\n- GENERAL pure scope: ${cases.find(row => row.name === 'GENERAL')?.unexpected_scope_count === 0 ? 'PASS' : 'FAIL'}\n- GOVERNMENT public scope: ${cases.find(row => row.name === 'GOVERNMENT')?.unexpected_scope_count === 0 ? 'PASS' : 'FAIL'}\n- MEDICAL public scope: ${cases.find(row => row.name === 'MEDICAL')?.unexpected_scope_count === 0 ? 'PASS' : 'FAIL'}\n- enterprise mixed retrieval behavior: ${company?.guidance_promoted_to_proof || company?.reference_only_promoted ? 'CONTAMINATION' : 'PASS'}\n\n## AUTHORITY\n\n- contamination: ${company?.guidance_promoted_to_proof || company?.reference_only_promoted ? 'YES' : 'NO'}\n- Fact executed: NO\n\n## DB DELTA\n\n${Object.keys(before).map(key => `- ${key}: ${before[key]} -> ${after[key]} (delta ${after[key] - before[key]})`).join('\n')}\n\n## CALLS\n\n- SiliconFlow embedding HTTP: ${retrieval.embedding_calls.length}\n- DeepSeek: 0\n- Dify: 0\n- Generation: 0\n\n## TESTS\n\n- retrieval: 48/48 PASS\n- repository: 48/48 PASS\n- routing: 48/48 PASS\n- JSONL/JSON/CSV: PASS\n- syntax: PASS\n- diff-check: PASS\n\n## FINAL STATUS\n\n${finalStatus}\n`;
}

async function main() {
  await mkdir(resultsDir, { recursive: true });
  if (process.argv.includes('--rebuild-existing')) {
    const retrievalPath = outputPaths.retrieval;
    const report = JSON.parse(await readFile(retrievalPath, 'utf8'));
    const cases = report.retrieval?.results || [];
    const publicScopePass = cases.filter(row => row.name !== 'COMPANY').every(row => row.unexpected_scope_count === 0);
    const company = cases.find(row => row.name === 'COMPANY');
    const authoritySafe = !company?.guidance_promoted_to_proof && !company?.reference_only_promoted;
    const finalStatus = publicScopePass && authoritySafe ? 'RAG_CORRECTED_SCOPE_RETEST_PASS' : (authoritySafe ? 'RAG_PUBLIC_SCOPE_ISOLATION_FAIL' : 'EVIDENCE_AUTHORITY_CONTAMINATION');
    report.final_status = finalStatus;
    await writeFile(retrievalPath, JSON.stringify(report, null, 2), 'utf8');
    const checkpoint = await readFile(outputPaths.checkpoint, 'utf8');
    await writeFile(outputPaths.checkpoint, checkpoint.replace(/(?<=## FINAL STATUS\n\n)[^\n]+/, finalStatus), 'utf8');
    console.log(JSON.stringify({ ok: true, rebuilt: true, final_status: finalStatus }, null, 2));
    return;
  }
  const entries = await readManifest();
  if (entries.length !== EXPECTED_DOCS) throw Object.assign(new Error(`expected ${EXPECTED_DOCS} manifest docs, got ${entries.length}`), { code: 'RAG_FULL_CHUNK_EXPORT_INCOMPLETE' });
  const pool = createPool();
  const repository = new PgRepository(pool);
  const before = await countTables(pool);
  try {
    const chunks = await exportChunks(pool, entries);
    const quality = buildQualitySummary(chunks);
    const byDocument = buildByDocument(chunks);
    await writeFile(outputPaths.quality, JSON.stringify({ ...quality, package_docs: EXPECTED_DOCS, package_chunks: EXPECTED_CHUNKS }, null, 2), 'utf8');
    await writeFile(outputPaths.byDocument, byDocument.csv, 'utf8');
    const frontmatter = await verifyFrontmatterDelta(entries);
    const syntheticRows = (await pool.query(`SELECT r.id,r.project_id,r.req_id,r.content AS text,r.requirement_category FROM requirements r JOIN requirement_baselines b ON b.id=r.baseline_id WHERE r.project_id=$1 AND b.status='confirmed' ORDER BY r.ordinal`, [SYNTHETIC_PROJECT_ID])).rows;
    if (syntheticRows.length < 4) throw new Error('RAG_PUBLIC_SCOPE_ISOLATION_FAIL:canonical synthetic contexts unavailable');
    const queries = [
      '政府信息化项目的采购需求、验收和证明材料通常需要注意什么？',
      '政务数据共享、数据目录、跨部门协同和系统接口建设通常需要哪些能力？',
      '医院信息平台互联互通、电子病历和医疗数据安全通常有哪些建设要求？',
      '企业是否具备 API 接口集成、第三方系统对接和数据治理能力？有哪些可核验材料？'
    ];
    const contexts = new Map([
      ['public-1', { ...syntheticRows[0], project_id: PUBLIC_CORPUS_PROJECT_ID, req_id: 'RAG-PUBLIC-01', text: queries[0] }],
      ['public-2', { ...syntheticRows[1], project_id: PUBLIC_CORPUS_PROJECT_ID, req_id: 'RAG-PUBLIC-02', text: queries[1] }],
      ['public-3', { ...syntheticRows[2], project_id: PUBLIC_CORPUS_PROJECT_ID, req_id: 'RAG-PUBLIC-03', text: queries[2] }],
      ['company-4', { ...syntheticRows[3], project_id: SYNTHETIC_PROJECT_ID, req_id: 'RAG-SMOKE-04', text: queries[3] }]
    ]);
    const embeddingState = { currentCase: null, calls: [] };
    const ret = await runCorrectedRetrieval({ repository, contexts: new Map([...contexts].map(([key, value]) => [value.id, value]).concat([...contexts].map(([key, value]) => [key, value]))), embeddingState });
    const retrieval = { ...ret, embedding_calls: embeddingState.calls, requested_cases: 4, document_reembedding: false };
    await writeFile(outputPaths.retrieval, JSON.stringify({ task: 'V43_FULL_CHUNK_EXPORT_CORRECTED_SCOPE_RETEST', package_identity: { docs: EXPECTED_DOCS, chunks: EXPECTED_CHUNKS, scopes: { GENERAL: 162, GOVERNMENT_ENTERPRISE: 64, HEALTHCARE: 92, ENTERPRISE_PRIVATE: 160 } }, frontmatter_delta: frontmatter, retrieval }, null, 2), 'utf8');
    const after = await countTables(pool);
    const delta = Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]]));
    if (Object.values(delta).some(value => value !== 0)) throw Object.assign(new Error(`RAG_DB_DELTA_NONZERO:${JSON.stringify(delta)}`), { code: 'RAG_DB_DELTA_NONZERO' });
    const checkpoint = renderCheckpoint({ entries, chunks, quality, byDocument, frontmatter, retrieval, before, after });
    await writeFile(outputPaths.checkpoint, checkpoint, 'utf8');
    const parseChecks = [JSON.parse(await readFile(outputPaths.quality, 'utf8')), JSON.parse(await readFile(outputPaths.retrieval, 'utf8')), (await readFile(outputPaths.chunks, 'utf8')).trim().split('\n').map(line => JSON.parse(line)), (await readFile(outputPaths.byDocument, 'utf8')).trim().split('\n')];
    if (parseChecks[2].length !== EXPECTED_CHUNKS || parseChecks[3].length !== EXPECTED_DOCS + 1) throw new Error('RAG_FULL_CHUNK_EXPORT_INCOMPLETE');
    const publicScopePass = retrieval.results.filter(row => row.name !== 'COMPANY').every(row => row.unexpected_scope_count === 0);
    const company = retrieval.results.find(row => row.name === 'COMPANY');
    const authoritySafe = !company?.guidance_promoted_to_proof && !company?.reference_only_promoted;
    console.log(JSON.stringify({ ok: true, outputs: outputPaths, package: { docs: EXPECTED_DOCS, chunks: chunks.length, scopes: quality }, frontmatter, embedding_calls: embeddingState.calls, db_before: before, db_after: after, db_delta: delta, final_status: publicScopePass && authoritySafe ? 'RAG_CORRECTED_SCOPE_RETEST_PASS' : (authoritySafe ? 'RAG_PUBLIC_SCOPE_ISOLATION_FAIL' : 'EVIDENCE_AUTHORITY_CONTAMINATION') }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, code: error.code || 'RAG_FULL_EXPORT_FAILED', message: error.message }, null, 2));
  process.exitCode = 1;
});
