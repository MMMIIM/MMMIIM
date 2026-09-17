import pg from 'pg';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBackendRuntime } from '../../src/backend-runtime.js';
import { PgRepository } from '../../src/db.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from '../../src/pipeline/embedding-client.js';
import { databaseNameFromUrl, preserveHostDatabaseUrl, selectAuthorizedMaterialChunks } from './retrieval-runner-utils.mjs';

const OUT = process.env.RETRIEVAL_SMOKE_OUTPUT || 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json';
const TOP_K = Math.max(1, Math.min(20, Number(process.env.RETRIEVAL_TOP_K || 5)));
const QUERIES = [
  [0x5927, 0x6a21, 0x578b],
  [0x653f, 0x52a1, 0x4e91],
  [0x6570, 0x636e, 0x4e2d, 0x5fc3],
  [0x6570, 0x636e, 0x5b58, 0x50a8],
  [0x53ef, 0x9760, 0x6027],
  [0x5bb9, 0x707e],
  [0x5b89, 0x5168],
  [0x8fd0, 0x7ef4, 0x670d, 0x52a1]
].map(codePoints => ({ query: String.fromCodePoint(...codePoints), codePoints }));

const sha256 = value => createHash('sha256').update(value).digest('hex');
const vectorLiteral = values => `[${values.join(',')}]`;
const lowInformation = value => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (text.length < 20) return true;
  return !/[\p{L}\p{N}\p{Script=Han}]/u.test(text);
};
const assertUtf8 = ({ query, codePoints }) => {
  const bytes = Buffer.byteLength(query, 'utf8');
  if (!bytes || query.includes('\uFFFD') || query.includes('?') || /^[\x00-\x7F]+$/u.test(query)) {
    throw new Error(`UTF8_QUERY_INVALID:${JSON.stringify({ query, codePoints, bytes })}`);
  }
  return { query, code_points: codePoints, utf8_byte_length: bytes, query_hash: sha256(query) };
};

const hostDatabaseUrl = process.env.DATABASE_URL;
const runtime = createBackendRuntime({ env: { ...process.env } });
const env = preserveHostDatabaseUrl({ hostDatabaseUrl, runtimeEnv: runtime.env });
const projectId = String(env.RETRIEVAL_PROJECT_ID || '').trim();
if (!projectId) throw new Error('RETRIEVAL_PROJECT_ID is required');
const materialNames = String(env.RETRIEVAL_MATERIAL_NAME_PREFIX || 'HW-').trim();
const embeddingTransport = createEmbeddingFetchFromEnv({ env });
if (embeddingTransport.proxyUrl) throw new Error('DIRECT_HTTPS_REQUIRED_PROXY_CONFIGURED');
const embeddingClient = createEmbeddingClientFromEnv({ env, fetchImpl: embeddingTransport.fetchImpl });
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const repository = new PgRepository(pool);
const started = Date.now();
let providerCalls = 0;
try {
  const authorizedRows = await repository.listChunksForRetrieval({
    projectId,
    materialTypes: [],
    materialIds: [],
    model: embeddingClient.model,
    version: embeddingClient.version,
    corpusScopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE']
  });
  const { materialIds, chunks } = selectAuthorizedMaterialChunks(authorizedRows, materialNames);
  const startup = {
    database: databaseNameFromUrl(env.DATABASE_URL),
    consuming_project_id: projectId,
    material_selector: materialNames,
    authorized_material_count: materialIds.length,
    authorized_chunk_count: chunks.length
  };
  console.log(JSON.stringify({ event: 'retrieval_preflight', ...startup }));
  if (materialIds.length !== 6) throw new Error(`HUAWEI_MATERIAL_COUNT_MISMATCH:${materialIds.length}`);
  if (chunks.length !== 590) throw new Error(`AUTHORIZED_RETRIEVAL_CHUNK_COUNT_MISMATCH:${chunks.length}`);
  const queryMeta = QUERIES.map(assertUtf8);
  const vectors = await embeddingClient.embed(queryMeta.map(item => item.query));
  providerCalls = 1;
  const queries = [];
  for (let index = 0; index < queryMeta.length; index += 1) {
    const rows = (await pool.query(`
      SELECT e.embedding_id,c.chunk_id,c.material_id,c.source_text,c.chunk_hash,c.chunk_index,
             c.char_start,c.char_end,c.page_start,c.page_end,c.paragraph_start,c.paragraph_end,c.section,
             m.original_name,m.project_id,m.material_type,m.corpus_scope,
             1-(e.embedding <=> $1::vector) AS score
      FROM material_chunk_embeddings e
      JOIN material_chunks c ON c.chunk_id=e.chunk_id AND c.chunk_hash=e.chunk_hash
      JOIN company_materials m ON m.id=c.material_id
      WHERE c.chunk_id=ANY($2::text[])
        AND e.embedding_model=$3 AND e.embedding_version=$4 AND e.embedding_dimension=$5
      ORDER BY e.embedding <=> $1::vector,e.embedding_id
      LIMIT $6`, [vectorLiteral(vectors[index]), chunks.map(item => item.chunk_id), embeddingClient.model, embeddingClient.version, embeddingClient.dimension, TOP_K])).rows;
    queries.push({
      ...queryMeta[index],
      rows: rows.map((row, rank) => ({
        rank: rank + 1,
        score: Number(row.score),
        material_id: row.material_id,
        chunk_id: row.chunk_id,
        source_text_length: String(row.source_text || '').length,
        source_excerpt: String(row.source_text || '').slice(0, 500),
        source_lineage: {
          original_name: row.original_name,
          project_id: row.project_id,
          material_type: row.material_type,
          corpus_scope: row.corpus_scope,
          chunk_index: row.chunk_index,
          chunk_hash: row.chunk_hash,
          char_start: row.char_start,
          char_end: row.char_end,
          page_start: row.page_start,
          page_end: row.page_end,
          paragraph_start: row.paragraph_start,
          paragraph_end: row.paragraph_end,
          section: row.section
        },
        low_information_chunk: lowInformation(row.source_text)
      }))
    });
  }
  const allRows = queries.flatMap(item => item.rows);
  const lowCount = allRows.filter(item => item.low_information_chunk).length;
  const report = {
    status: 'PASS',
    transport: 'DIRECT_HTTPS',
    database: databaseNameFromUrl(env.DATABASE_URL),
    project_id: projectId,
    material_selector: materialNames,
    material_count: materialIds.length,
    authorized_chunk_count: chunks.length,
    embedding_model: embeddingClient.model,
    embedding_version: embeddingClient.version,
    embedding_dimension: embeddingClient.dimension,
    queries,
    total_returned: allRows.length,
    low_information_returned: lowCount,
    low_information_rate: allRows.length ? lowCount / allRows.length : 0,
    non_empty_semantic_text_returned: allRows.filter(item => item.source_text_length > 0 && !item.low_information_chunk).length,
    provider_calls: providerCalls,
    production_db_writes: 0,
    db_writes: 0,
    latency_ms: Date.now() - started
  };
  const outputPath = resolve(process.cwd(), OUT);
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
} finally {
  await embeddingTransport.close();
  await pool.end();
}
