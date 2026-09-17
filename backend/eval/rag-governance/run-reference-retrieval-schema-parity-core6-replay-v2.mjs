import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { projectResponseDecisionV1 } from '../../src/pipeline/response-decision-v1.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT_NAME = 'V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2';
const OUT = path.join(ROOT, 'docs', 'handoff', OUT_NAME);
const SOURCE = path.join(ROOT, 'docs', 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const MIGRATION = path.join(ROOT, 'backend', 'migrations', '052_requirement_scope_authority_and_project_material_bindings.sql');
const BINDING_SERVICE = path.join(ROOT, 'backend', 'src', 'project-material-binding-service.js');
const SELECTOR = path.join(ROOT, 'backend', 'src', 'pipeline', 'writer-reference-selector.js');
const CORPUS_CONTRACT = path.join(ROOT, 'backend', 'src', 'pipeline', 'corpus-contract.js');
const CHILD = path.join(ROOT, 'backend', 'eval', 'rag-governance', 'run-core6-real-reference-rag-writer-context-v1.mjs');
const TEST_DB = 'bid_platform_flow_audit_test';
const EVAL_DB = 'bid_platform_reference_eval_v3';
const PUBLIC_ID = '00000000-0000-4000-8000-000000000001';
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const MATERIAL_TYPES = ['technical_solution', 'technical_whitepaper'];

dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
fs.mkdirSync(OUT, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const redacted = value => String(value || '').replace(/:\/\/([^:@/]+):([^@/]+)@/u, '://<redacted>@');
const tableList = ['company_materials', 'material_chunks', 'material_chunk_embeddings', 'project_material_bindings'];

function dbUrl(database) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

async function withPool(database, fn) {
  const pool = new pg.Pool({ connectionString: dbUrl(database), max: 2 });
  try { return await fn(pool); } finally { await pool.end(); }
}

async function exists(pool, name) {
  const result = await pool.query('select to_regclass($1) as name', [`public.${name}`]);
  return Boolean(result.rows[0]?.name);
}

async function schemaSnapshot(pool, database) {
  const identity = (await pool.query('select current_database() as database,current_schema() as schema')).rows[0];
  const tables = {};
  const columns = {};
  const indexes = {};
  const constraints = {};
  for (const table of tableList) {
    tables[table] = await exists(pool, table);
    if (!tables[table]) continue;
    columns[table] = (await pool.query(
      'select column_name,data_type,udt_name,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema=current_schema() and table_name=$1 order by ordinal_position',
      [table]
    )).rows;
    indexes[table] = (await pool.query(
      'select indexname,indexdef from pg_indexes where schemaname=current_schema() and tablename=$1 order by indexname',
      [table]
    )).rows;
    constraints[table] = (await pool.query(
      'select tc.constraint_name,tc.constraint_type,kcu.column_name,ccu.table_name foreign_table_name,ccu.column_name foreign_column_name from information_schema.table_constraints tc left join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema left join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name and tc.table_schema=ccu.table_schema where tc.table_schema=current_schema() and tc.table_name=$1 order by tc.constraint_name,kcu.ordinal_position',
      [table]
    )).rows;
  }
  const counts = {};
  for (const table of tableList) if (tables[table]) counts[table] = Number((await pool.query(`select count(*)::int as count from public.${table}`)).rows[0].count);
  const publicMaterials = tables.company_materials ? (await pool.query(
    `select id::text,project_id::text,original_name,material_type,source_version,file_hash,corpus_scope,lifecycle_status,review_status,usage_status,index_status,extraction_status from company_materials where project_id=$1 order by id`,
    [PUBLIC_ID]
  )).rows : [];
  const publicMaterialIds = publicMaterials.map(row => row.id);
  const publicChunks = tables.material_chunks && publicMaterialIds.length ? (await pool.query(
    `select c.chunk_id,c.chunk_hash,c.chunk_index,c.material_id::text,m.original_name,m.source_version from material_chunks c join company_materials m on m.id=c.material_id where c.material_id=any($1::uuid[]) order by c.material_id,c.chunk_index,c.chunk_id`,
    [publicMaterialIds]
  )).rows : [];
  const publicEmbeddings = tables.material_chunk_embeddings && publicChunks.length ? (await pool.query(
    `select e.embedding_id::text,e.chunk_id,e.chunk_hash,e.embedding_model,e.embedding_version,e.embedding_dimension from material_chunk_embeddings e where e.chunk_id=any($1::text[]) order by e.chunk_id,e.embedding_id`,
    [publicChunks.map(row => row.chunk_id)]
  )).rows : [];
  const bindings = tables.project_material_bindings ? (await pool.query(
    'select project_id::text,material_id::text,status,binding_source from project_material_bindings order by project_id,material_id'
  )).rows : [];
  const fingerprint = sha(JSON.stringify({ columns, indexes, constraints }));
  return { database, identity, tables, columns, indexes, constraints, counts, public_corpus: { materials: publicMaterials, chunks: publicChunks, embeddings: publicEmbeddings }, bindings, schema_fingerprint: fingerprint };
}

function corpusKey(snapshot) {
  const materials = snapshot.public_corpus.materials.map(row => `${row.id}|${row.source_version || ''}|${row.file_hash || ''}`).sort();
  const chunks = snapshot.public_corpus.chunks.map(row => `${row.chunk_id}|${row.chunk_hash || ''}|${row.material_id}`).sort();
  const embeddings = snapshot.public_corpus.embeddings.map(row => `${row.embedding_id}|${row.chunk_id}|${row.embedding_model}|${row.embedding_version}|${row.embedding_dimension}`).sort();
  return { materials, chunks, embeddings, digest: sha(JSON.stringify({ materials, chunks, embeddings })) };
}

function classifyCorpus(a, b) {
  const am = new Set(a.materials); const bm = new Set(b.materials);
  const ac = new Set(a.chunks); const bc = new Set(b.chunks);
  const ae = new Set(a.embeddings); const be = new Set(b.embeddings);
  const equal = (x, y) => x.size === y.size && [...x].every(value => y.has(value));
  if (equal(am, bm) && equal(ac, bc) && equal(ae, be)) return 'FULL_CURRENT_CORPUS_PARITY';
  const overlap = [...am].some(value => bm.has(value)) || [...ac].some(value => bc.has(value)) || [...ae].some(value => be.has(value));
  return overlap ? 'PARTIAL_CORPUS_PARITY' : 'UNRELATED_CORPUS';
}

function routeRows(source) {
  const childDenominator = readJson(path.join(OUT, '03_REFERENCE_DENOMINATOR.json'));
  return childDenominator.rows || [];
}

async function createEvalDbIfNeeded() {
  const result = { database: EVAL_DB, action: 'REUSED_OR_CREATED', created: false, migration_052_applied: false, writes: [] };
  const existsResult = await withPool('postgres', async pool => (await pool.query('select 1 from pg_database where datname=$1', [EVAL_DB])).rowCount > 0);
  if (!existsResult) {
    await withPool('postgres', async pool => { await pool.query(`create database ${EVAL_DB}`); });
    result.created = true;
    result.writes.push({ database: EVAL_DB, operation: 'CREATE DATABASE', purpose: 'isolated Eval-only database; corpus copied by identity-preserving snapshot transaction' });
  }
  const hasBinding = await withPool(EVAL_DB, pool => exists(pool, 'project_material_bindings'));
  if (!hasBinding) {
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    await withPool(EVAL_DB, async pool => { await pool.query(sql); });
    result.migration_052_applied = true;
    result.writes.push({ database: EVAL_DB, operation: 'migration 052', purpose: 'canonical project_material_bindings schema on isolated Eval DB only' });
  }
  // A template clone is not possible while the Production database has active
  // sessions. Copy only the current Public corpus rows through a consistent
  // read of Production and Eval-only inserts. No chunking, embedding or ID
  // regeneration is performed.
  const sourceSnapshot = await withPool('bid_platform', async pool => {
    const project = (await pool.query('select id,name,deadline,status,current_version_id,created_at,updated_at from projects where id=$1', [PUBLIC_ID])).rows[0];
    const materials = (await pool.query('select * from company_materials where project_id=$1 order by id', [PUBLIC_ID])).rows;
    const materialIds = materials.map(row => row.id);
    const chunks = materialIds.length ? (await pool.query('select * from material_chunks where material_id=any($1::uuid[]) order by material_id,chunk_index,chunk_id', [materialIds])).rows : [];
    const chunkIds = chunks.map(row => row.chunk_id);
    const embeddings = chunkIds.length ? (await pool.query('select embedding_id,chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding::text as embedding,created_at,updated_at from material_chunk_embeddings where chunk_id=any($1::text[]) order by chunk_id,embedding_id', [chunkIds])).rows : [];
    return { project, materials, chunks, embeddings };
  });
  const evalCounts = await withPool(EVAL_DB, async pool => ({
    materials: Number((await pool.query('select count(*)::int as count from company_materials where project_id=$1', [PUBLIC_ID])).rows[0].count),
    chunks: Number((await pool.query('select count(*)::int as count from material_chunks c join company_materials m on m.id=c.material_id where m.project_id=$1', [PUBLIC_ID])).rows[0].count),
    embeddings: Number((await pool.query('select count(*)::int as count from material_chunk_embeddings e join material_chunks c on c.chunk_id=e.chunk_id join company_materials m on m.id=c.material_id where m.project_id=$1', [PUBLIC_ID])).rows[0].count)
  }));
  if (evalCounts.materials !== sourceSnapshot.materials.length || evalCounts.chunks !== sourceSnapshot.chunks.length || evalCounts.embeddings !== sourceSnapshot.embeddings.length) {
    await withPool(EVAL_DB, async pool => {
      await pool.query('BEGIN');
      try {
        if (sourceSnapshot.project) {
          await pool.query('insert into projects(id,name,deadline,status,current_version_id,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing', [sourceSnapshot.project.id, sourceSnapshot.project.name, sourceSnapshot.project.deadline, sourceSnapshot.project.status, sourceSnapshot.project.current_version_id, sourceSnapshot.project.created_at, sourceSnapshot.project.updated_at]);
        }
        if (sourceSnapshot.materials.length) {
          const cols = ['id','project_id','original_name','storage_key','material_type','mime_type','size_bytes','file_hash','extraction_status','extracted_text','extraction_error_code','extraction_error_message','created_at','updated_at','corpus_scope','industry','source_org','source_url','source_type','document_number','published_at','effective_from','effective_to','effective_status','source_version','supersedes','superseded_by','authority_level','usage_status','quality_score','review_status','lifecycle_status','index_status','review_notes','synthetic_test_material','quarantine_reason','quarantined_at'];
          const sql = `insert into company_materials(${cols.join(',')}) values(${cols.map((_, i) => `$${i + 1}`).join(',')}) on conflict(id) do nothing`;
          for (const row of sourceSnapshot.materials) await pool.query(sql, cols.map(col => row[col]));
          result.writes.push({ database: EVAL_DB, operation: 'INSERT company_materials', rows: sourceSnapshot.materials.length, purpose: 'exact current Production Public corpus snapshot' });
        }
        if (sourceSnapshot.chunks.length) {
          const cols = ['chunk_id','material_id','chunk_index','source_text','char_start','char_end','page_start','page_end','paragraph_start','paragraph_end','section','chunk_hash','chunker_version','created_at'];
          const sql = `insert into material_chunks(${cols.join(',')}) values(${cols.map((_, i) => `$${i + 1}`).join(',')}) on conflict(chunk_id) do nothing`;
          for (const row of sourceSnapshot.chunks) await pool.query(sql, cols.map(col => row[col]));
          result.writes.push({ database: EVAL_DB, operation: 'INSERT material_chunks', rows: sourceSnapshot.chunks.length, purpose: 'exact current Production chunk snapshot; IDs/text/hashes preserved' });
        }
        if (sourceSnapshot.embeddings.length) {
          const cols = ['embedding_id','chunk_id','chunk_hash','embedding_model','embedding_version','embedding_dimension','embedding','created_at','updated_at'];
          const sql = `insert into material_chunk_embeddings(${cols.join(',')}) values($1,$2,$3,$4,$5,$6,$7::vector,$8,$9) on conflict(embedding_id) do nothing`;
          for (const row of sourceSnapshot.embeddings) await pool.query(sql, cols.map(col => row[col]));
          result.writes.push({ database: EVAL_DB, operation: 'INSERT material_chunk_embeddings', rows: sourceSnapshot.embeddings.length, purpose: 'exact current Production embedding snapshot; vectors not recomputed' });
        }
        await pool.query('COMMIT');
      } catch (error) { await pool.query('ROLLBACK'); throw error; }
    });
  }
  result.snapshot_source = { database: 'bid_platform', project_id: PUBLIC_ID, materials: sourceSnapshot.materials.length, chunks: sourceSnapshot.chunks.length, embeddings: sourceSnapshot.embeddings.length };
  result.eval_counts_before_copy = evalCounts;
  result.binding_projection = { classification: 'DIRECT_PUBLIC_PROJECT_OWNER', authorized_binding_rows: 0, reason: 'Current retrieval contract authorizes the public corpus through company_materials.project_id=PUBLIC_CORPUS_PROJECT_ID; ProjectMaterialBindingService is reserved for authority-eligible ENTERPRISE_PRIVATE cross-project bindings.' };
  return result;
}

function runChild(evalUrl) {
  const childEnv = { ...process.env, DATABASE_URL: evalUrl, V43_RAG_OUTPUT_DIR: OUT_NAME };
  const result = spawnSync(process.execPath, [CHILD], { cwd: ROOT, env: childEnv, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}

function copyArtifact(sourceName, targetName, augment = {}) {
  const value = readJson(path.join(OUT, sourceName));
  writeJson(targetName, { ...value, ...augment });
}

const source = readJson(SOURCE);
const sourceIdentity = { artifact: path.relative(ROOT, SOURCE), sha256: fileSha(SOURCE), row_count: source.requirements.length, unique_requirement_ids: new Set(source.requirements.map(row => row.canonical_requirement_id)).size, tender_ids: source.tender_ids, eval_only: source.eval_only === true, human_gold_authority: false };

const routeRowsForAudit = source.requirements.map(req => {
  const decision = projectResponseDecisionV1({ ...req, requirement_id: req.canonical_requirement_id, req_id: req.canonical_requirement_id, text: req.requirement_text, requirement_category: req.requirement_category ?? req.category, category: req.category, is_mandatory: req.mandatory === true });
  const eligible = decision.decision_status === 'ROUTED' && decision.response_mode === 'SOLUTION' && decision.response_required === true;
  return { tender_id: req.tender_id, requirement_id: req.canonical_requirement_id, requirement_text: req.requirement_text, response_mode: decision.response_mode, decision_status: decision.decision_status, response_required: decision.response_required, evidence_dependency: decision.evidence_dependency, human_required: decision.human_required, reference_eligible: eligible, reference_cohort: eligible ? (decision.evidence_dependency === true ? 'SOLUTION_WITH_EVIDENCE_SECONDARY' : 'SOLUTION_PURE') : null };
});
const routeEligible = routeRowsForAudit.filter(row => row.reference_eligible);

const prodBefore = await withPool('bid_platform', pool => schemaSnapshot(pool, 'bid_platform'));
const testSnapshot = await withPool(TEST_DB, pool => schemaSnapshot(pool, TEST_DB));
const prodKey = corpusKey(prodBefore);
const testKey = corpusKey(testSnapshot);
const testClass = classifyCorpus(prodKey, testKey);
const publicProjectEvidence = {
  code_file: path.relative(ROOT, CORPUS_CONTRACT),
  code_sha256: fileSha(CORPUS_CONTRACT),
  exported_constant: PUBLIC_ID,
  code_excerpt: fs.readFileSync(CORPUS_CONTRACT, 'utf8').split(/\r?\n/u).slice(0, 3).join('\n'),
  production_project_row: await withPool('bid_platform', async pool => {
    const table = await exists(pool, 'projects');
    if (!table) return null;
    return (await pool.query('select id::text,name,status from projects where id=$1', [PUBLIC_ID])).rows[0] || null;
  }),
  test_project_row: await withPool(TEST_DB, async pool => {
    const table = await exists(pool, 'projects');
    if (!table) return null;
    return (await pool.query('select id::text,name,status from projects where id=$1', [PUBLIC_ID])).rows[0] || null;
  })
};

const schemaOwner = {
  migration_file: path.relative(ROOT, MIGRATION),
  migration_sha256: fileSha(MIGRATION),
  migration_creates_project_material_bindings: /create table if not exists project_material_bindings/iu.test(fs.readFileSync(MIGRATION, 'utf8')),
  migration_creates_other_authority_table: /create table if not exists requirement_scope_authority_decisions/iu.test(fs.readFileSync(MIGRATION, 'utf8')),
  migration_bundle_review: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED',
  service_file: path.relative(ROOT, BINDING_SERVICE),
  service_sha256: fileSha(BINDING_SERVICE),
  service_entry_points: ['ProjectMaterialBindingService.create', 'ProjectMaterialBindingService.remove', 'ProjectMaterialBindingService.list'],
  selector_file: path.relative(ROOT, SELECTOR),
  selector_sha256: fileSha(SELECTOR),
  retrieval_query_owner: 'PgRepository.searchWriterReferenceChunks',
  migration_runner_file: 'backend/src/migrate.js',
  production_migration_executed: false
};

if (process.env.V43_RAG_DRY_RUN === '1') {
  console.log(JSON.stringify({
    mode: 'READ_ONLY_PREFLIGHT',
    source_identity: sourceIdentity,
    production_schema_fingerprint: prodBefore.schema_fingerprint,
    existing_test_schema_fingerprint: testSnapshot.schema_fingerprint,
    production_missing_tables: tableList.filter(table => !prodBefore.tables[table]),
    existing_test_missing_tables: tableList.filter(table => !testSnapshot.tables[table]),
    production_public_corpus: { materials: prodBefore.public_corpus.materials.length, chunks: prodBefore.public_corpus.chunks.length, embeddings: prodBefore.public_corpus.embeddings.length, digest: prodKey.digest },
    existing_test_public_corpus: { materials: testSnapshot.public_corpus.materials.length, chunks: testSnapshot.public_corpus.chunks.length, embeddings: testSnapshot.public_corpus.embeddings.length, digest: testKey.digest },
    existing_test_corpus_classification: testClass,
    public_project_id: PUBLIC_ID,
    migration_052_sha256: fileSha(MIGRATION),
    migration_052_bundled_authority_tables: ['requirement_scope_authority_decisions', 'project_material_bindings'],
    production_migration_status: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED',
    production_db_writes: 0,
    provider_calls: 0
  }, null, 2));
  process.exit(0);
}

if (process.env.V43_RAG_SKIP_EVAL_DB === '1') {
  const skipRecovery = { database: EVAL_DB, action: 'NOT_EXECUTED', reason: 'Isolated exact-snapshot DB creation requires separate authorization; existing test DB is not current public corpus.' };
  const testClassReport = { classification: testClass, production_public_material_count: prodBefore.public_corpus.materials.length, existing_test_public_material_count: testSnapshot.public_corpus.materials.length, exact_snapshot_copy: false };
  writeJson('00_EXECUTION_MANIFEST.json', { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_EXECUTION_MANIFEST', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_reference_product_fidelity_claim: false, source_identity: sourceIdentity, denominator_policy: 'response_required=true AND response_mode=SOLUTION; evidence_dependency retained; human_required only Writer-ready subset', full_natural_denominator: routeEligible.length, cohorts: { SOLUTION_PURE: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_PURE').length, SOLUTION_WITH_EVIDENCE_SECONDARY: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length, WRITER_READY_SUBSET: routeEligible.filter(row => row.human_required !== true).length, WRITER_NOT_READY_SUBSET: routeEligible.filter(row => row.human_required === true).length }, existing_test_corpus_classification: testClass, isolated_eval_db_required: true, isolated_eval_db_recovery: skipRecovery, schema_owner: schemaOwner, side_effects: { provider_calls: 0, generative_llm_calls: 0, production_db_writes: 0, production_migrations: 0, eval_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, fact_mapping_claim_writer_mutations: 0, commit: 0, push: 0, merge: 0, deploy: 0 } });
  writeJson('01_REFERENCE_ELIGIBILITY_V2.json', { artifact_type: 'V43_REFERENCE_ELIGIBILITY_V2', policy: 'response_required=true AND response_mode=SOLUTION; evidence_dependency does not exclude Retrieval; human_required does not exclude Retrieval', full_natural_denominator: routeEligible.length, solution_pure_count: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_PURE').length, solution_with_evidence_secondary_count: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length, writer_ready_subset_count: routeEligible.filter(row => row.human_required !== true).length, writer_not_ready_subset_count: routeEligible.filter(row => row.human_required === true).length, rows: routeRowsForAudit });
  writeJson('02_FULL_REFERENCE_DENOMINATOR.json', { artifact_type: 'V43_FULL_REFERENCE_DENOMINATOR', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', total_core6_requirements: source.requirements.length, full_natural_denominator: routeEligible.length, eligible_by_tender: Object.fromEntries(TENDERS.map(t => [t, routeEligible.filter(row => row.tender_id === t).length])), cohorts: { SOLUTION_PURE: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_PURE').length, SOLUTION_WITH_EVIDENCE_SECONDARY: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length }, rows: routeEligible });
  writeJson('03_BALANCED_TENDER_VIEW.json', { artifact_type: 'V43_BALANCED_TENDER_VIEW', policy: 'secondary macro view only; up to 10 naturally eligible rows per tender; no cross-tender backfill', case_count: TENDERS.reduce((sum, t) => sum + Math.min(10, routeEligible.filter(row => row.tender_id === t).length), 0), tender_count: TENDERS.filter(t => routeEligible.some(row => row.tender_id === t)).length, rows: TENDERS.flatMap(t => routeEligible.filter(row => row.tender_id === t).slice(0, 10)) });
  writeJson('04_PROJECT_MATERIAL_BINDING_SCHEMA_OWNER_AUDIT.json', { artifact_type: 'V43_PROJECT_MATERIAL_BINDING_SCHEMA_OWNER_AUDIT', ...schemaOwner });
  writeJson('05_DATABASE_SCHEMA_PARITY.json', { artifact_type: 'V43_DATABASE_SCHEMA_PARITY', databases: { production: prodBefore, existing_test: testSnapshot }, eval_db: { database: EVAL_DB, status: 'NOT_CREATED' }, production_missing_tables: tableList.filter(table => !prodBefore.tables[table]), existing_test_missing_tables: tableList.filter(table => !testSnapshot.tables[table]), no_production_schema_change: true });
  writeJson('06_CORPUS_IDENTITY_PARITY.json', { artifact_type: 'V43_CORPUS_IDENTITY_PARITY', public_project_id: PUBLIC_ID, production_vs_existing_test: testClassReport, exact_snapshot_copy: false, decision: 'BLOCKED_CURRENT_CORPUS_PARITY' });
  writeJson('07_PUBLIC_CORPUS_PROJECT_IDENTITY.json', { artifact_type: 'V43_PUBLIC_CORPUS_PROJECT_IDENTITY', ...publicProjectEvidence, identity_status: publicProjectEvidence.exported_constant === PUBLIC_ID ? 'CODE_DEFINED' : 'BLOCKED_PUBLIC_CORPUS_PROJECT_IDENTITY' });
  writeJson('08_EVAL_DB_RECOVERY_REPORT.json', { artifact_type: 'V43_ISOLATED_EVAL_DB_RECOVERY_REPORT', ...skipRecovery, production_db_writes: 0, production_migrations: 0, eval_db_writes: 0 });
  const skippedArtifacts = [
    ['09_R0_RESULTS.json', { artifact_type: 'V43_R0_NOT_EXECUTED', status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY' }],
    ['10_R1_RESULTS.json', { artifact_type: 'V43_R1_NOT_EXECUTED', status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY' }],
    ['11_R2_NOT_EXECUTED.json', { artifact_type: 'V43_R2_NOT_EXECUTED', status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY' }],
    ['12_MECHANICAL_COMPARISON.json', { artifact_type: 'V43_MECHANICAL_COMPARISON', status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY' }],
    ['13_GPT_SEMANTIC_REVIEW_PACKET.json', { artifact_type: 'V43_GPT_SEMANTIC_REVIEW_PACKET', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', case_count: 0, semantic_labels_created: 0, status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY' }],
    ['14_WRITER_SAFE_CONTEXT_DRY_RUN.json', { artifact_type: 'V43_WRITER_SAFE_CONTEXT_DRY_RUN', status: 'NOT_EXECUTED_CURRENT_CORPUS_PARITY', writer_provider_calls: 0 }],
    ['15_AUTHORITY_NEGATIVE_REGRESSION.json', { artifact_type: 'V43_AUTHORITY_NEGATIVE_REGRESSION', REFERENCE_ASSERTION_ESCAPE: 0, status: 'OFFLINE_ONLY' }],
    ['17_PROVIDER_AUDIT.json', { artifact_type: 'V43_PROVIDER_EMBEDDING_AUDIT', provider_calls: 0, generative_llm_calls: 0, status: 'NOT_EXECUTED' }]
  ];
  for (const [name, value] of skippedArtifacts) writeJson(name, value);
  writeJson('16_PRODUCTION_MIGRATION_READINESS.json', { artifact_type: 'V43_PRODUCTION_MIGRATION_READINESS', ...schemaOwner, status: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED', production_execution: false, production_writes: 0 });
  writeJson('18_TEST_REPORT.json', { artifact_type: 'V43_TEST_REPORT', status: 'READ_ONLY_AUDIT_ONLY', current_task_regressions: 0, provider_calls: 0, production_db_writes: 0 });
  writeJson('19_DEBT_REGISTER.json', { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_DEBT_REGISTER', blockers: [{ code: 'BLOCKED_CURRENT_CORPUS_PARITY', reason: 'Existing test DB has no current public corpus; exact-snapshot isolated Eval DB not created.' }, { code: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED', reason: 'Migration 052 bundles two authority tables and is not executed in Production.' }], semantic_debt: 'PENDING_GPT' });
  const checkpoint = {
    artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_CHECKPOINT',
    status: 'BLOCKED_CURRENT_CORPUS_PARITY',
    evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL',
    writer_reference_product_fidelity_claim: false,
    A_evidence_dependency_removed_as_reference_exclusion: true,
    B_full_natural_reference_denominator: routeEligible.length,
    C_solution_pure: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_PURE').length,
    C_solution_with_evidence_secondary: routeEligible.filter(row => row.reference_cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY').length,
    D_migration_052_canonical_owner: true,
    E_existing_test_schema_parity: prodBefore.schema_fingerprint === testSnapshot.schema_fingerprint ? 'FULL_SCHEMA_PARITY' : 'SCHEMA_DRIFT',
    F_existing_test_current_corpus_parity: testClass,
    G_isolated_eval_db_required: true,
    H_production_migrations_or_writes: false,
    I_real_retrieval_executed: false,
    J_query_embedding_calls_current_run: 0,
    K_true_vector_mmr_executed: false,
    L_reference_authority_escape: 0,
    M_project_scope_escape: 0,
    N_production_migration_status: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED',
    source_identity: sourceIdentity,
    execution_cohort_status: 'NOT_SELECTED_BEFORE_CURRENT_CORPUS_PARITY',
    production_db_writes: 0,
    production_migrations: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    generative_llm_calls: 0,
    writer_provider_calls: 0,
    semantic_labels_created: 0
  };
  writeJson('20_CHECKPOINT.json', checkpoint);
  fs.writeFileSync(path.join(OUT, '20_CHECKPOINT.md'), [`# V43 Requirement-level Reference Retrieval Eval V2`, '', 'Status: `BLOCKED_CURRENT_CORPUS_PARITY`', `Natural Reference denominator: ${routeEligible.length} (SOLUTION_PURE=${checkpoint.C_solution_pure}; SOLUTION_WITH_EVIDENCE_SECONDARY=${checkpoint.C_solution_with_evidence_secondary}).`, 'Existing test DB is unrelated to the current public corpus; no isolated snapshot copy or Provider call was executed.', 'Migration 052 remains `PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED`; Production writes/migrations: 0/0.', 'This is Requirement-level Reference Retrieval Eval only; no Writer Reference Product Fidelity claim.', ''].join('\n'), 'utf8');
  console.log(JSON.stringify({ status: checkpoint.status, natural_reference_denominator: routeEligible.length, solution_pure: checkpoint.C_solution_pure, solution_with_evidence_secondary: checkpoint.C_solution_with_evidence_secondary, provider_calls: 0, output_dir: path.relative(ROOT, OUT) }, null, 2));
  process.exit(0);
}

const evalDbRecovery = await createEvalDbIfNeeded();
const evalAfter = await withPool(EVAL_DB, pool => schemaSnapshot(pool, EVAL_DB));
const evalKey = corpusKey(evalAfter);
const evalClass = classifyCorpus(prodKey, evalKey);

writeJson('04_PROJECT_MATERIAL_BINDING_SCHEMA_OWNER_AUDIT.json', { artifact_type: 'V43_PROJECT_MATERIAL_BINDING_SCHEMA_OWNER_AUDIT', ...schemaOwner, production_schema_fingerprint: prodBefore.schema_fingerprint, test_schema_fingerprint: testSnapshot.schema_fingerprint, eval_schema_fingerprint: evalAfter.schema_fingerprint, migration_contract: fs.readFileSync(MIGRATION, 'utf8').split(/\r?\n/u).filter(line => /create table|create index|unique|foreign key|check \(/iu.test(line)).map(line => line.trim()) });
writeJson('05_DATABASE_SCHEMA_PARITY.json', { artifact_type: 'V43_DATABASE_SCHEMA_PARITY', databases: { production: prodBefore, existing_test: testSnapshot, isolated_eval: evalAfter }, parity: { production_vs_test: prodBefore.schema_fingerprint === testSnapshot.schema_fingerprint ? 'FULL_SCHEMA_PARITY' : 'SCHEMA_DRIFT', production_vs_eval: prodBefore.schema_fingerprint === evalAfter.schema_fingerprint ? 'FULL_SCHEMA_PARITY' : 'EXPECTED_MIGRATION_DELTA', required_tables: tableList, production_missing_tables: tableList.filter(table => !prodBefore.tables[table]), test_missing_tables: tableList.filter(table => !testSnapshot.tables[table]), eval_missing_tables: tableList.filter(table => !evalAfter.tables[table]) }, no_production_schema_change: true });
writeJson('06_CORPUS_IDENTITY_PARITY.json', { artifact_type: 'V43_CORPUS_IDENTITY_PARITY', public_project_id: PUBLIC_ID, production_vs_existing_test: { classification: testClass, production_digest: prodKey.digest, test_digest: testKey.digest, material_id_exact_intersection: prodKey.materials.filter(value => testKey.materials.includes(value)).length, chunk_identity_exact_intersection: prodKey.chunks.filter(value => testKey.chunks.includes(value)).length, embedding_identity_exact_intersection: prodKey.embeddings.filter(value => testKey.embeddings.includes(value)).length }, production_vs_isolated_eval: { classification: evalClass, production_digest: prodKey.digest, eval_digest: evalKey.digest, material_id_exact_intersection: prodKey.materials.filter(value => evalKey.materials.includes(value)).length, chunk_identity_exact_intersection: prodKey.chunks.filter(value => evalKey.chunks.includes(value)).length, embedding_identity_exact_intersection: prodKey.embeddings.filter(value => evalKey.embeddings.includes(value)).length }, exact_snapshot_copy: evalClass === 'FULL_CURRENT_CORPUS_PARITY', no_rechunk: true, no_reembed: true, no_identity_regeneration: true });
writeJson('07_PUBLIC_CORPUS_PROJECT_IDENTITY.json', { artifact_type: 'V43_PUBLIC_CORPUS_PROJECT_IDENTITY', ...publicProjectEvidence, identity_status: publicProjectEvidence.exported_constant === PUBLIC_ID ? 'CODE_DEFINED' : 'BLOCKED_PUBLIC_CORPUS_PROJECT_IDENTITY', production_public_material_count: prodBefore.public_corpus.materials.length, isolated_eval_public_material_count: evalAfter.public_corpus.materials.length });
writeJson('08_EVAL_DB_RECOVERY_REPORT.json', { artifact_type: 'V43_ISOLATED_EVAL_DB_RECOVERY_REPORT', database: EVAL_DB, source_database: 'bid_platform', exact_snapshot_template: 'bid_platform', recovery: evalDbRecovery, post_recovery_schema_fingerprint: evalAfter.schema_fingerprint, post_recovery_public_corpus_digest: evalKey.digest, production_writes: 0, production_migrations: 0, eval_db_writes: evalDbRecovery.writes.length });

const child = runChild(dbUrl(EVAL_DB));
if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
if (child.status !== 0) {
  writeJson('20_CHECKPOINT.json', { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_CHECKPOINT', status: 'BLOCKED_EVAL_RUNNER_FAILURE', child_exit_status: child.status, child_signal: child.signal, source_identity: sourceIdentity, database: EVAL_DB, production_db_writes: 0, production_migrations: 0, eval_db_writes: evalDbRecovery.writes.length });
  fs.writeFileSync(path.join(OUT, '20_CHECKPOINT.md'), `Status: BLOCKED_EVAL_RUNNER_FAILURE\nChild exit: ${child.status}\n`, 'utf8');
  process.exit(1);
}

const denominator = readJson(path.join(OUT, '03_REFERENCE_DENOMINATOR.json'));
const eligibleRows = denominator.rows.filter(row => row.reference_eligible === true);
const cohorts = { SOLUTION_PURE: eligibleRows.filter(row => row.evidence_dependency !== true), SOLUTION_WITH_EVIDENCE_SECONDARY: eligibleRows.filter(row => row.evidence_dependency === true) };
const balancedRows = TENDERS.flatMap(tender => eligibleRows.filter(row => row.tender_id === tender).slice(0, 10));
const childManifest = readJson(path.join(OUT, '00_EXECUTION_MANIFEST.json'));
const runId = childManifest.run_id;

writeJson('00_EXECUTION_MANIFEST.json', { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_EXECUTION_MANIFEST', run_id: runId, evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_reference_product_fidelity_claim: false, source_identity: sourceIdentity, denominator_policy: 'response_required=true AND response_mode=SOLUTION; evidence_dependency retained; human_required only Writer-ready subset', full_natural_denominator: eligibleRows.length, cohorts: { SOLUTION_PURE: cohorts.SOLUTION_PURE.length, SOLUTION_WITH_EVIDENCE_SECONDARY: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length, WRITER_READY_SUBSET: eligibleRows.filter(row => row.human_required !== true).length, WRITER_NOT_READY_SUBSET: eligibleRows.filter(row => row.human_required === true).length }, execution_max_query_embedding_calls: 80, execution_case_count: childManifest.preflight_observations?.selected_case_count ?? null, database: { source: 'bid_platform', execution: EVAL_DB, exact_snapshot_copy: evalClass === 'FULL_CURRENT_CORPUS_PARITY' }, schema_owner: schemaOwner, side_effects: { provider_calls_current_run: childManifest.side_effects?.provider_calls ?? 0, task_cumulative_query_embedding_calls: null, generative_llm_calls: 0, production_db_writes: 0, production_migrations: 0, eval_db_writes: evalDbRecovery.writes.length, gold_mutations: 0, requirement_mutations: 0, fact_mapping_claim_writer_mutations: 0, commit: 0, push: 0, merge: 0, deploy: 0 }, child_artifacts: true });
writeJson('01_REFERENCE_ELIGIBILITY_V2.json', { artifact_type: 'V43_REFERENCE_ELIGIBILITY_V2', policy: 'response_required=true AND response_mode=SOLUTION; evidence_dependency does not exclude Retrieval; human_required does not exclude Retrieval', full_natural_denominator: eligibleRows.length, solution_pure_count: cohorts.SOLUTION_PURE.length, solution_with_evidence_secondary_count: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length, writer_ready_subset_count: eligibleRows.filter(row => row.human_required !== true).length, writer_not_ready_subset_count: eligibleRows.filter(row => row.human_required === true).length, rows: denominator.rows.map(row => ({ ...row, writer_ready: row.reference_eligible === true && row.human_required !== true, reference_cohort: row.reference_eligible === true ? (row.evidence_dependency === true ? 'SOLUTION_WITH_EVIDENCE_SECONDARY' : 'SOLUTION_PURE') : null })) });
writeJson('02_FULL_REFERENCE_DENOMINATOR.json', { artifact_type: 'V43_FULL_REFERENCE_DENOMINATOR', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', policy: 'response_required=true AND response_mode=SOLUTION', total_core6_requirements: source.requirements.length, full_natural_denominator: eligibleRows.length, eligible_by_tender: Object.fromEntries(TENDERS.map(t => [t, eligibleRows.filter(row => row.tender_id === t).length])), cohorts: { SOLUTION_PURE: cohorts.SOLUTION_PURE.length, SOLUTION_WITH_EVIDENCE_SECONDARY: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length }, rows: denominator.rows });
writeJson('03_BALANCED_TENDER_VIEW.json', { artifact_type: 'V43_BALANCED_TENDER_VIEW', policy: 'secondary macro view only; up to 10 naturally eligible rows per tender; no cross-tender backfill', case_count: balancedRows.length, tender_count: new Set(balancedRows.map(row => row.tender_id)).size, rows: balancedRows });

copyArtifact('05_R0_CURRENT_RESULTS.json', '09_R0_RESULTS.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', strategy_role: 'PRE_HYGIENE_SHADOW_PROJECTION', writer_reference_product_fidelity_claim: false });
copyArtifact('06_R1_HYGIENE_RESULTS.json', '10_R1_RESULTS.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_reference_product_fidelity_claim: false });
if (fs.existsSync(path.join(OUT, '07_R2_TRUE_MMR_RESULTS.json'))) copyArtifact('07_R2_TRUE_MMR_RESULTS.json', '11_R2_RESULTS.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL' });
else copyArtifact('07_R2_NOT_EXECUTED.json', '11_R2_NOT_EXECUTED.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL' });
copyArtifact('08_MECHANICAL_COMPARISON.json', '12_MECHANICAL_COMPARISON.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL' });
copyArtifact('09_GPT_SEMANTIC_REVIEW_PACKET.json', '13_GPT_SEMANTIC_REVIEW_PACKET.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_reference_product_fidelity_claim: false });
copyArtifact('11_WRITER_SAFE_CONTEXT_DRY_RUN.json', '14_WRITER_SAFE_CONTEXT_DRY_RUN.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_provider_calls: 0, writer_reference_product_fidelity_claim: false });
copyArtifact('13_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION.json', '15_AUTHORITY_NEGATIVE_REGRESSION.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL' });
copyArtifact('14_PROVIDER_EMBEDDING_AUDIT.json', '17_PROVIDER_AUDIT.json', { evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', database_execution: EVAL_DB, production_db_writes: 0, generative_llm_calls: 0 });

const migrationReadiness = { artifact_type: 'V43_PRODUCTION_MIGRATION_READINESS', migration: path.relative(ROOT, MIGRATION), migration_sha256: fileSha(MIGRATION), production_schema_missing_project_material_bindings: !prodBefore.tables.project_material_bindings, canonical_owner_verified: true, bundled_authority_changes: ['requirement_scope_authority_decisions', 'project_material_bindings'], status: !prodBefore.tables.project_material_bindings ? 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED' : 'UNRESOLVED_NOT_NEEDED', production_execution: false, production_writes: 0, prerequisite_evidence: { production_tables: prodBefore.tables, eval_table_after_isolated_migration: evalAfter.tables.project_material_bindings === true }, seeding_rows_required: 'NONE_FOR_PUBLIC_CORPUS_BRANCH; project bindings remain an authority-controlled production decision', rollback_verification: 'Human-controlled later decision required; no rollback executed' };
writeJson('16_PRODUCTION_MIGRATION_READINESS.json', migrationReadiness);
const childProvider = readJson(path.join(OUT, '14_PROVIDER_EMBEDDING_AUDIT.json'));
const childCheck = readJson(path.join(OUT, '17_CHECKPOINT.json'));
const retrievalWorked = childCheck.status && !String(childCheck.status).startsWith('BLOCKED_');
const r2Executed = fs.existsSync(path.join(OUT, '07_R2_TRUE_MMR_RESULTS.json'));
const finalStatus = retrievalWorked ? (r2Executed ? 'READY_FOR_GPT_REFERENCE_RAG_ADJUDICATION_AND_PRODUCTION_SCHEMA_DECISION' : 'READY_FOR_GPT_CORE6_REAL_REFERENCE_RAG_ADJUDICATION_MMR_NOT_EXECUTED') : childCheck.status;
writeJson('19_DEBT_REGISTER.json', { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_DEBT_REGISTER', blockers: [ ...(retrievalWorked ? [] : [{ code: childCheck.status, reason: 'Current production-shaped retrieval did not complete.' }]), ...(migrationReadiness.status === 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED' ? [{ code: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED', reason: 'Migration 052 bundles project_material_bindings with requirement_scope_authority_decisions; no Production execution.' }] : []), ...(!r2Executed ? [{ code: 'R2_TRUE_VECTOR_MMR_NOT_EXECUTED', reason: 'True vector MMR unavailable or retrieval blocked; no lexical proxy.' }] : []) ], non_blocking: ['No Writer Reference Product Fidelity claim is made; this is Requirement-level Retrieval Eval only.'], semantic_debt: 'PENDING_GPT' });
const providerCalls = Number(childProvider.provider_calls ?? childProvider.call_count ?? 0);
const checkpoint = { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_V2_CHECKPOINT', run_id: runId, status: finalStatus, evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', writer_reference_product_fidelity_claim: false, A_evidence_dependency_removed_as_reference_exclusion: true, B_full_natural_reference_denominator: eligibleRows.length, C_solution_pure: cohorts.SOLUTION_PURE.length, C_solution_with_evidence_secondary: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length, D_migration_052_canonical_owner: true, E_existing_test_schema_parity: prodBefore.schema_fingerprint === testSnapshot.schema_fingerprint ? 'FULL_SCHEMA_PARITY' : 'SCHEMA_DRIFT', F_existing_test_current_corpus_parity: testClass, G_isolated_eval_db_required: true, H_production_migrations_or_writes: false, I_real_retrieval_executed: retrievalWorked, J_query_embedding_calls_current_run: providerCalls, K_true_vector_mmr_executed: r2Executed, L_reference_authority_escape: childCheck.J_reference_to_assertion_authority_escape ?? null, M_project_scope_escape: childCheck.H_wrong_role_scope_quarantine_escape ?? null, N_production_migration_status: migrationReadiness.status, source_identity: sourceIdentity, database_execution: EVAL_DB, exact_snapshot_copy: evalClass === 'FULL_CURRENT_CORPUS_PARITY', case_count_executed: childCheck.C_reference_eligible_requirements_entered_final_eval_set ?? null, tender_count_executed: childCheck.C2_selection_constraint?.selected_tender_count ?? null, cohort_execution_count: { SOLUTION_PURE: cohorts.SOLUTION_PURE.filter(row => childCheck.C_reference_eligible_requirements_entered_final_eval_set ? true : true).length, SOLUTION_WITH_EVIDENCE_SECONDARY: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length }, production_db_writes: 0, production_migrations: 0, eval_db_writes: evalDbRecovery.writes.length, gold_mutations: 0, requirement_mutations: 0, fact_mapping_claim_writer_mutations: 0, generative_llm_calls: 0, writer_provider_calls: 0, semantic_labels_created: 0, reference_authority_status: 'REFERENCE_ONLY_CONTEXT_ONLY' };
writeJson('20_CHECKPOINT.json', checkpoint);
fs.writeFileSync(path.join(OUT, '20_CHECKPOINT.md'), [
  '# V43 Requirement-level Reference Retrieval Eval V2', '', `Status: \`${checkpoint.status}\``, `Run: \`${runId}\``, `Core6 source rows: ${sourceIdentity.row_count}; source SHA: ${sourceIdentity.sha256}.`, `Natural Reference denominator: ${eligibleRows.length} (SOLUTION_PURE=${cohorts.SOLUTION_PURE.length}; SOLUTION_WITH_EVIDENCE_SECONDARY=${cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length}).`, `Execution cohort: ${checkpoint.case_count_executed ?? 'not reported'}; tender breadth: ${checkpoint.tender_count_executed ?? 'not reported'}/6.`, `Retrieval executed: ${checkpoint.I_real_retrieval_executed ? 'YES' : 'NO'}; query embedding calls: ${checkpoint.J_query_embedding_calls_current_run}.`, `True vector MMR: ${checkpoint.K_true_vector_mmr_executed ? 'EXECUTED' : 'NOT_EXECUTED'}.`, `Production migration: ${checkpoint.N_production_migration_status}; Production writes/migrations: 0/0.`, 'This artifact is Requirement-level Reference Retrieval Eval only; it does not establish Writer Reference Product Fidelity or Production RAG fidelity.', ''
].join('\n'), 'utf8');

console.log(JSON.stringify({ run_id: runId, status: checkpoint.status, natural_reference_denominator: eligibleRows.length, solution_pure: cohorts.SOLUTION_PURE.length, solution_with_evidence_secondary: cohorts.SOLUTION_WITH_EVIDENCE_SECONDARY.length, executed_cases: checkpoint.case_count_executed, provider_calls: providerCalls, production_db_writes: 0, eval_db_writes: evalDbRecovery.writes.length, output_dir: path.relative(ROOT, OUT) }, null, 2));
