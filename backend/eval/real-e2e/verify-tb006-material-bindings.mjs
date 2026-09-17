import pg from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBackendRuntime } from '../../src/backend-runtime.js';
import { PgRepository } from '../../src/db.js';

const out = resolve(process.cwd(), process.env.BINDING_DIAGNOSTIC_OUTPUT || 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/binding-authorization-diagnostic.json');
const runtime = createBackendRuntime();
const env = runtime.env;
const tb006ProjectId = String(env.TB006_PROJECT_ID || '').trim();
const controlProjectId = String(env.BINDING_CONTROL_PROJECT_ID || '').trim();
if (!tb006ProjectId || !controlProjectId) throw new Error('TB006_PROJECT_ID and BINDING_CONTROL_PROJECT_ID are required');
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const repository = new PgRepository(pool);
try {
  const materials = (await pool.query(`SELECT id,project_id FROM company_materials WHERE original_name LIKE $1 ORDER BY original_name`, [`${String(env.RETRIEVAL_MATERIAL_NAME_PREFIX || 'HW-')}%`])).rows;
  const [allowed, denied] = await Promise.all([
    repository.listChunksForRetrieval({ projectId: tb006ProjectId, materialTypes: [], materialIds: materials.map(row => row.id), model: env.V43_EMBEDDING_MODEL || 'text-embedding-3-small', version: env.V43_EMBEDDING_VERSION || '1', corpusScopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE'] }),
    repository.listChunksForRetrieval({ projectId: controlProjectId, materialTypes: [], materialIds: materials.map(row => row.id), model: env.V43_EMBEDDING_MODEL || 'text-embedding-3-small', version: env.V43_EMBEDDING_VERSION || '1', corpusScopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE'] })
  ]);
  const report = { status: allowed.length === 590 && denied.length === 0 ? 'PASS' : 'BLOCKED', tb006_project_id: tb006ProjectId, control_project_id: controlProjectId, binding_count: Number((await pool.query(`SELECT count(*)::int AS count FROM project_material_bindings WHERE project_id=$1 AND status='ACTIVE'`, [tb006ProjectId])).rows[0].count), material_count: materials.length, allowed_chunk_count: allowed.length, denied_chunk_count: denied.length, provider_calls: 0, production_db_writes: 0, db_writes: 0 };
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
} finally { await pool.end(); }
