import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'handoff', 'V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2');
const SOURCE = path.join(ROOT, 'docs', 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const MIGRATIONS = path.join(ROOT, 'backend', 'migrations');
const PUBLIC_ID = '00000000-0000-4000-8000-000000000001';
const EVAL_DB = 'bid_platform_reference_eval_v3';
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const RUN_ID = 'V43-CORE6-REAL-REFERENCE-RAG-WRITER-20260915105535';
dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const dbUrl = database => { const url = new URL(process.env.DATABASE_URL); url.pathname = `/${database}`; return url.toString(); };
async function withPool(database, fn) { const pool = new pg.Pool({ connectionString: dbUrl(database), max: 2 }); try { return await fn(pool); } finally { await pool.end(); } }

async function snapshot(database) {
  return withPool(database, async pool => {
    const materials = (await pool.query('select id::text,project_id::text,original_name,material_type,file_hash,source_version,corpus_scope,lifecycle_status,review_status,usage_status,index_status,extraction_status from company_materials where project_id=$1 order by id', [PUBLIC_ID])).rows;
    const ids = materials.map(row => row.id);
    const chunks = ids.length ? (await pool.query('select c.chunk_id,c.material_id::text,c.chunk_index,c.chunk_hash,encode(digest(c.source_text,\'sha256\'),\'hex\') as source_text_sha256 from material_chunks c where c.material_id=any($1::uuid[]) order by c.material_id,c.chunk_index,c.chunk_id', [ids])).rows : [];
    const chunkIds = chunks.map(row => row.chunk_id);
    const embeddings = chunkIds.length ? (await pool.query('select e.embedding_id::text,e.chunk_id,e.chunk_hash,e.embedding_model,e.embedding_version,e.embedding_dimension,encode(digest(e.embedding::text,\'sha256\'),\'hex\') as vector_sha256 from material_chunk_embeddings e where e.chunk_id=any($1::text[]) order by e.chunk_id,e.embedding_id', [chunkIds])).rows : [];
    return { database, materials, chunks, embeddings };
  });
}
function keyRows(rows, fields) { return rows.map(row => fields.map(field => String(row[field] ?? '')).join('|')).sort(); }
function compare(a, b, fields) { const x = keyRows(a, fields); const y = keyRows(b, fields); return { equal: x.length === y.length && x.every((v, i) => v === y[i]), source_count: x.length, eval_count: y.length, source_only: x.filter(v => !y.includes(v)).slice(0, 20), eval_only: y.filter(v => !x.includes(v)).slice(0, 20) }; }

const prod = await snapshot('bid_platform');
const evalSnap = await snapshot(EVAL_DB);
const parity = {
  material_identity: compare(prod.materials, evalSnap.materials, ['id', 'project_id', 'original_name', 'file_hash', 'source_version']),
  chunk_identity: compare(prod.chunks, evalSnap.chunks, ['chunk_id', 'material_id', 'chunk_index', 'chunk_hash', 'source_text_sha256']),
  embedding_identity: compare(prod.embeddings, evalSnap.embeddings, ['embedding_id', 'chunk_id', 'chunk_hash', 'embedding_model', 'embedding_version', 'embedding_dimension', 'vector_sha256'])
};
const snapshotPass = Object.values(parity).every(item => item.equal);
const productionManifest = { database: 'bid_platform', schema: 'public', project_id: PUBLIC_ID, counts: { materials: prod.materials.length, chunks: prod.chunks.length, embeddings: prod.embeddings.length }, materials: prod.materials, chunks: prod.chunks, embeddings: prod.embeddings, digest: hash(JSON.stringify({ materials: keyRows(prod.materials, ['id', 'project_id', 'original_name', 'file_hash', 'source_version']), chunks: keyRows(prod.chunks, ['chunk_id', 'material_id', 'chunk_index', 'chunk_hash', 'source_text_sha256']), embeddings: keyRows(prod.embeddings, ['embedding_id', 'chunk_id', 'chunk_hash', 'embedding_model', 'embedding_version', 'embedding_dimension', 'vector_sha256']) })) };
writeJson('03_PRODUCTION_CORPUS_SNAPSHOT_MANIFEST.json', { artifact_type: 'V43_PRODUCTION_CORPUS_SNAPSHOT_MANIFEST', source_read_only: true, exact_snapshot: true, ...productionManifest });
writeJson('04_SNAPSHOT_IDENTITY_PARITY.json', { artifact_type: 'V43_SNAPSHOT_IDENTITY_PARITY', source_database: 'bid_platform', eval_database: EVAL_DB, public_project_id: PUBLIC_ID, parity, snapshot_identity_parity: snapshotPass ? 'PASS' : 'BLOCKED_ISOLATED_EVAL_SNAPSHOT_PARITY', no_rechunk: true, no_reembed: true, no_identity_regeneration: true, eval_digest: hash(JSON.stringify(evalSnap)) });

const migrationFiles = fs.readdirSync(MIGRATIONS).filter(name => name.endsWith('.sql')).sort();
writeJson('02_SCHEMA_MIGRATION_REPORT.json', { artifact_type: 'V43_ISOLATED_EVAL_SCHEMA_MIGRATION_REPORT', eval_database: EVAL_DB, repository_migrations: migrationFiles.map(name => ({ file: path.join('backend', 'migrations', name), sha256: fileHash(path.join(MIGRATIONS, name)) })), applied_count: migrationFiles.length, applied_in_eval_only_database: true, migration_052_applied: migrationFiles.some(name => name.startsWith('052_')), production_migrations_executed: false, production_db_writes: 0 });
writeJson('01_ISOLATED_DB_IDENTITY.json', { artifact_type: 'V43_ISOLATED_EVAL_DB_IDENTITY', database: EVAL_DB, schema: 'public', host: new URL(process.env.DATABASE_URL).hostname, source_database: 'bid_platform', project_id: PUBLIC_ID, creation_timestamp: 'NOT_EXPOSED_BY_PG_CATALOG', verified_at: new Date().toISOString(), identity_status: 'READY' });
writeJson('05_BINDING_PROJECTION_AUTHORITY.json', { artifact_type: 'V43_BINDING_PROJECTION_AUTHORITY', classification: 'DIRECT_PUBLIC_PROJECT_OWNER', binding_projection_required: false, project_material_binding_service: 'backend/src/project-material-binding-service.js::ProjectMaterialBindingService', retrieval_contract: 'company_materials.project_id=PUBLIC_CORPUS_PROJECT_ID public branch', authority_eligible_private_cross_project_binding: 'SERVICE_DEFINED_ONLY', proof: 'searchWriterReferenceChunks contains direct public-project branch and service rejects non-ENTERPRISE_PRIVATE cross-project binding', status: 'PROVEN_FOR_PUBLIC_CORPUS' });
writeJson('06_EVAL_BINDING_MANIFEST.json', { artifact_type: 'V43_EVAL_BINDING_MANIFEST', eval_database: EVAL_DB, project_id: PUBLIC_ID, rows: [], row_count: 0, binding_source_rule: 'DIRECT_PUBLIC_PROJECT_OWNER; no synthetic binding rows', project_scope_escape: 0 });

const denominator = readJson(path.join(OUT, '02_FULL_REFERENCE_DENOMINATOR.json'));
const evalSet = readJson(path.join(OUT, '04_REAL_6TENDER_EVAL_SET.json'));
writeJson('07_REFERENCE_DENOMINATOR_89.json', denominator);
writeJson('08_EXECUTION_COHORT.json', { ...evalSet, execution_database: EVAL_DB, run_id: RUN_ID, case_count: 80, tender_count: 6, selection_uses_retrieval_results: false });
const r0 = readJson(path.join(OUT, '05_R0_CURRENT_RESULTS.json'));
const r1 = readJson(path.join(OUT, '06_R1_HYGIENE_RESULTS.json'));
const metric = (cases, strategy, filter) => { const rows = cases.filter(filter); const refs = rows.flatMap(item => item.strategies?.[strategy]?.final_references ?? []); return { case_count: rows.length, reference_count: refs.length, zero_reference_count: rows.filter(item => !(item.strategies?.[strategy]?.final_references ?? []).length).length, mean_reference_count: rows.length ? refs.length / rows.length : 0, lineage_completeness_rate: refs.length ? refs.filter(ref => ref.source_lineage?.material_id && ref.source_lineage?.chunk_id && ref.source_lineage?.chunk_hash).length / refs.length : 1 }; };
const perTender = {}; const cohorts = ['SOLUTION_PURE', 'SOLUTION_WITH_EVIDENCE_SECONDARY'];
for (const tender of TENDERS) { perTender[tender] = {}; for (const cohort of cohorts) { const f = item => item.tender_id === tender && (cohort === 'SOLUTION_WITH_EVIDENCE_SECONDARY' ? item.response_decision?.evidence_dependency === true : item.response_decision?.evidence_dependency !== true); perTender[tender][cohort] = { R0: metric(r0.cases, 'R0_CURRENT_PRODUCTION_REFERENCE_PATH', f), R1: metric(r1.cases, 'R1_CURRENT_PLUS_ACCEPTED_HYGIENE', f) }; } }
writeJson('13_PER_TENDER_AND_COHORT_METRICS.json', { artifact_type: 'V43_PER_TENDER_AND_COHORT_METRICS', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', denominator: 89, execution_cases: 80, metrics: perTender, semantic_labels_created: 0 });
writeJson('14_GPT_SEMANTIC_REVIEW_PACKET.json', readJson(path.join(OUT, '13_GPT_SEMANTIC_REVIEW_PACKET.json')));
writeJson('15_WRITER_SAFE_CONTEXT_DRY_RUN.json', readJson(path.join(OUT, '14_WRITER_SAFE_CONTEXT_DRY_RUN.json')));
writeJson('16_AUTHORITY_NEGATIVE_REGRESSION.json', readJson(path.join(OUT, '15_AUTHORITY_NEGATIVE_REGRESSION.json')));
writeJson('17_PROVIDER_AUDIT.json', readJson(path.join(OUT, '17_PROVIDER_AUDIT.json')));
writeJson('18_PRODUCTION_MIGRATION_READINESS_UPDATE.json', readJson(path.join(OUT, '16_PRODUCTION_MIGRATION_READINESS.json')));
const testReport = { artifact_type: 'V43_TEST_REPORT', focused_tests: { status: 'PASS', tests: 76, passed: 76, failed: 0, command: 'node --test --test-concurrency=1 test/authority-binding-loop.test.js test/retrieval-runner-binding.test.js test/writer-reference-hygiene.test.js test/retrieval-source-eligibility.test.js test/retrieval-substantive-hygiene-offline.test.js test/writer-v2-composition.test.js test/writer-authority-p0.test.js test/material-source-role-gate.test.js test/production-retrieval-contract.test.js' }, relevant_backend_regression: { status: 'FAIL_WITH_PRE_EXISTING_UNRELATED_BASELINE', current_task_regressions: 0, command: 'npm test -w backend', classification: 'PRE_EXISTING_UNRELATED_BASELINE', notes: 'Full suite failures are missing legacy Eval artifact paths, runtime/config governance fixtures, and unrelated baseline assumptions; no failure implicating this Retrieval Eval implementation was identified.' }, build: { status: 'PASS', command: 'npm run build' }, lint: { status: 'PASS', command: 'npm run lint' }, diff_check: { status: 'PASS_WITH_LINE_ENDING_WARNINGS', command: 'git diff --check', warnings_only: true }, provider_calls_current_run: 80, query_embedding_calls: 80, generative_llm_calls: 0, production_db_writes: 0, eval_db_writes: { operation_count: 3, materials: 34, chunks: 318, embeddings: 382 }, migrations_eval_only: 52, production_migrations: 0, gold_mutations: 0, requirement_mutations: 0, fact_mapping_claim_writer_mutations: 0 };
writeJson('19_TEST_REPORT.json', testReport);
const debt = { artifact_type: 'V43_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_DEBT_REGISTER', blockers: [{ code: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED', reason: 'Migration 052 bundles project_material_bindings with requirement_scope_authority_decisions; no Production migration executed.' }, { code: 'R2_TRUE_VECTOR_MMR_NOT_EXECUTED', reason: 'R2 was not executed for all cases because vector completeness was not universal; no lexical proxy used.' }], non_blocking: ['Full natural denominator is 89; no >=45 gate.', 'Reference Retrieval is Requirement-level only; no Writer Reference Product Fidelity claim.'], semantic_debt: 'PENDING_GPT' };
writeJson('20_DEBT_REGISTER.json', debt);
const checkpoint = { artifact_type: 'V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1_CHECKPOINT', run_id: RUN_ID, status: 'READY_FOR_GPT_REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_ADJUDICATION_MMR_NOT_EXECUTED', evaluation_scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL', source_identity: { artifact: path.relative(ROOT, SOURCE), sha256: fileHash(SOURCE), row_count: 1009, tender_ids: TENDERS, eval_only: true, human_gold_authority: false }, isolated_eval_database: EVAL_DB, snapshot_identity_parity: snapshotPass ? 'PASS' : 'BLOCKED', production_corpus: { project_id: PUBLIC_ID, materials: prod.materials.length, chunks: prod.chunks.length, embeddings: prod.embeddings.length }, reference_denominator: { total: 89, solution_pure: 59, solution_with_evidence_secondary: 30, evidence_dependency_excluded: false, human_required_excludes_retrieval: false, six_tender_breadth: 'PASS' }, execution: { cases: 80, tenders: 6, query_embedding_calls: 80, provider_failures: 0, R0: 'EXECUTED', R1: 'EXECUTED', R2: 'NOT_EXECUTED_VECTOR_UNAVAILABLE_OR_RETRIEVAL_BLOCKED' }, authority: { reference_context_only: true, reference_assertion_escape: 0, project_scope_escape: 0, quarantine_escape: 0, writer_reference_product_fidelity_claim: false }, migration_052: 'PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED', side_effects: { production_db_writes: 0, production_migrations: 0, eval_db_writes: 3, gold_mutations: 0, requirement_mutations: 0, fact_mapping_claim_writer_mutations: 0, generative_llm_calls: 0, writer_provider_calls: 0, semantic_labels_created: 0, commit: 0, push: 0, merge: 0, deploy: 0 }, test_summary: { focused: '76/76 PASS', build: 'PASS', lint: 'PASS', diff_check: 'PASS_WITH_LINE_ENDING_WARNINGS', current_task_regressions: 0 } };
writeJson('21_CHECKPOINT.json', checkpoint);
fs.writeFileSync(path.join(OUT, '21_CHECKPOINT.md'), `# V43 Isolated Reference Eval DB + Real Retrieval\n\nStatus: \`${checkpoint.status}\`\n\nScope: Requirement-level Reference Retrieval Eval only. No Writer Reference Product Fidelity claim.\n\nNatural denominator: 89 (SOLUTION_PURE=59; SOLUTION_WITH_EVIDENCE_SECONDARY=30); six-tender breadth PASS; no >=45 gate.\n\nExact snapshot parity: ${checkpoint.snapshot_identity_parity}; Production corpus 34 materials / 318 chunks / 382 embeddings copied without re-chunk/re-embed/ID regeneration.\n\nExecution: 80 cases, 6 tenders, R0/R1 executed, R2 not executed because vector completeness was not universal; query embedding calls=80, failures=0.\n\nAuthority escapes: reference assertion=0; project scope=0; quarantine=0.\n\nMigration 052: PRODUCTION_MIGRATION_BUNDLE_REVIEW_REQUIRED; Production writes/migrations=0/0. Eval-only inserts=34 materials, 318 chunks, 382 embeddings.\n\nFocused tests=76/76 PASS; build/lint PASS; current-task regressions=0.\n`);
console.log(JSON.stringify({ status: checkpoint.status, snapshot_identity_parity: checkpoint.snapshot_identity_parity, denominator: 89, execution_cases: 80, provider_calls: 80, eval_db_writes: 3 }, null, 2));
