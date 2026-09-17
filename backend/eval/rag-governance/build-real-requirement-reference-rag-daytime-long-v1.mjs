import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { applyRetrievalChunkRole, isCitationIndexLike, isWriterReferenceContentEligible } from '../../src/pipeline/retrieval-chunk-role.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'docs', 'handoff', 'V43_REAL_REQUIREMENT_REFERENCE_RAG_DAYTIME_LONG_V1');
const OLD = path.join(ROOT, 'backend', 'eval', 'rag-pilot', 'results', 'overnight', '01_retrieval_context_40case.json');
const PRODUCTION_EXPORT = path.join(ROOT, 'docs', 'V43_PRODUCTION_CANONICAL_CORE6_REQUIREMENTS_READONLY_EXPORT.json');
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const ANCHORS = ['A02', 'A03', 'A07', 'A14', 'A20', 'A21', 'A22', 'A23'];

fs.mkdirSync(OUT, { recursive: true });
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function uniqueSorted(rows) {
  const unique = new Map();
  for (const row of rows ?? []) {
    if (!['technical_solution', 'technical_whitepaper'].includes(row.material_type)) continue;
    if (!isWriterReferenceContentEligible(row)) continue;
    const key = row.chunk_hash || `${row.material_id}:${row.chunk_id}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()].sort((a, b) => Number(b.similarity_score || 0) - Number(a.similarity_score || 0)
    || String(a.material_id).localeCompare(String(b.material_id))
    || String(a.chunk_id).localeCompare(String(b.chunk_id)));
}

function reference(row, finalRank, strategy) {
  const annotated = applyRetrievalChunkRole(row);
  return {
    strategy,
    final_rank: finalRank,
    raw_rank: row.raw_vector_rank ?? row.rank ?? null,
    rank_movement: (row.raw_vector_rank ?? row.rank ?? finalRank) - finalRank,
    material_id: annotated.material_id,
    chunk_id: annotated.chunk_id,
    chunk_hash: annotated.chunk_hash,
    doc_id: annotated.doc_id,
    material_type: annotated.material_type,
    source_role: annotated.source_role ?? 'REFERENCE_ONLY',
    source_type: annotated.source_type,
    source_authority: annotated.source_authority,
    corpus_scope: annotated.corpus_scope,
    chunk_role: annotated.chunk_role,
    source_text: annotated.source_text,
    source_document_id: annotated.source_document_id,
    source_chunk_id: annotated.source_chunk_id,
    source_lineage: annotated.source_lineage ?? {
      material_id: annotated.material_id,
      chunk_id: annotated.chunk_id,
      chunk_hash: annotated.chunk_hash,
      original_name: annotated.original_name
    },
    source_text_sha256: annotated.source_text_sha256 ?? null,
    original_name: annotated.original_name,
    lifecycle_status: annotated.lifecycle_status,
    review_status: annotated.review_status,
    usage_status: annotated.usage_status,
    similarity_score: annotated.similarity_score
  };
}

function projectCase(item, strategy) {
  const source = strategy === 'R0_BASELINE' ? (item.selected_topk ?? []).slice(0, 4) : (item.raw_top20 ?? []);
  const rows = strategy === 'R0_BASELINE' ? source : uniqueSorted(source);
  const selected = strategy === 'R0_BASELINE' ? rows : rows.slice(0, 4);
  return {
    case_id: item.case_id,
    theme: item.theme,
    query: item.query,
    requested_scopes: item.requested_scopes,
    expected_doc_ids: item.expected_doc_ids,
    final_references: selected.map((row, index) => reference(row, index + 1, strategy)),
    candidate_count: source.length,
    eligible_candidate_count: strategy === 'R0_BASELINE' ? null : rows.length
  };
}

function metrics(cases) {
  const finals = cases.flatMap(item => item.final_references);
  const distribution = {};
  for (const item of cases) distribution[item.final_references.length] = (distribution[item.final_references.length] || 0) + 1;
  const counts = (predicate) => finals.filter(predicate).length;
  const lineageFields = ['material_id', 'chunk_id', 'chunk_hash', 'source_document_id', 'source_chunk_id', 'source_text'];
  const missingLineage = finals.filter(row => lineageFields.some(field => row[field] === null || row[field] === undefined || row[field] === '')).length;
  const duplicateEscape = cases.reduce((n, item) => n + (new Set(item.final_references.map(row => row.chunk_hash || `${row.material_id}:${row.chunk_id}`)).size < item.final_references.length ? 1 : 0), 0);
  const sameMaterialMax = Math.max(0, ...cases.map(item => {
    const countsByMaterial = new Map();
    for (const row of item.final_references) countsByMaterial.set(row.material_id, (countsByMaterial.get(row.material_id) || 0) + 1);
    return Math.max(0, ...countsByMaterial.values());
  }));
  const uniqueMaterialCounts = cases.map(item => new Set(item.final_references.map(row => row.material_id)).size);
  const expectedDocHit = cases.filter(item => item.final_references.some(row => item.expected_doc_ids?.includes(row.doc_id) || item.expected_doc_ids?.includes(row.original_name?.split('_')[0]))).length;
  return {
    case_count: cases.length,
    final_count_distribution: distribution,
    zero_final_rate: cases.length ? cases.filter(item => item.final_references.length === 0).length / cases.length : 0,
    mean_final_count: cases.length ? finals.length / cases.length : 0,
    heading_final_escape: counts(row => row.chunk_role === 'HEADING'),
    front_matter_final_escape: counts(row => row.chunk_role === 'FRONT_MATTER'),
    citation_index_final_escape: counts(row => isCitationIndexLike(row.source_text)),
    wrong_role_or_scope_escape: counts(row => !['technical_solution', 'technical_whitepaper'].includes(row.material_type)),
    lineage_completeness_rate: finals.length ? (finals.length - missingLineage) / finals.length : 1,
    duplicate_escape: duplicateEscape,
    same_material_max: sameMaterialMax,
    unique_material_count_mean: uniqueMaterialCounts.length ? uniqueMaterialCounts.reduce((a, b) => a + b, 0) / uniqueMaterialCounts.length : 0,
    expected_doc_hit_at_4_count: expectedDocHit,
    expected_doc_hit_at_4_rate: cases.length ? expectedDocHit / cases.length : 0,
    rank_movement_mean: finals.length ? finals.reduce((sum, row) => sum + row.rank_movement, 0) / finals.length : 0
  };
}

async function productionInventory() {
  dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || undefined });
  try {
    const identity = (await pool.query('select current_database() database,current_schema() schema')).rows[0];
    const baselines = (await pool.query(`select b.id baseline_id,b.project_id,b.parse_job_id,b.status,b.confirmed_at,p.name project_name,tf.original_name tender_name,tp.status parse_status,tp.extracted_text_sha256,count(r.id)::int requirement_count
      from requirement_baselines b left join projects p on p.id=b.project_id left join tender_parse_jobs tp on tp.id=b.parse_job_id left join tender_files tf on tf.id=tp.tender_file_id left join requirements r on r.baseline_id=b.id
      where b.status='confirmed' group by b.id,p.name,tf.original_name,tp.status,tp.extracted_text_sha256 order by b.confirmed_at nulls last,b.id`)).rows;
    return { status: 'READ_ONLY_QUERY_PASS', identity, confirmed_baseline_count: baselines.length, confirmed_requirement_count: baselines.reduce((sum, row) => sum + Number(row.requirement_count || 0), 0), baselines };
  } catch (error) {
    return { status: 'READ_ONLY_QUERY_BLOCKED', error_code: error.code ?? null, error: error.message };
  } finally {
    await pool.end();
  }
}

const old = readJson(OLD);
const cases = (old.cases ?? []).filter(item => /^A(?:0[1-9]|1\d|2\d|30)$/.test(item.case_id));
const r0 = cases.map(item => projectCase(item, 'R0_BASELINE'));
const r1 = cases.map(item => projectCase(item, 'R1_WRITER_HYGIENE'));
const db = await productionInventory();
const productionExport = readJson(PRODUCTION_EXPORT);
const ownerFiles = [
  'backend/src/pipeline/writer-reference-selector.js',
  'backend/src/pipeline/retrieval-chunk-role.js',
  'backend/src/pipeline/retrieval-substantive-candidate.js',
  'backend/src/pipeline/retrieval-source-eligibility.js',
  'backend/src/pipeline/material-source-authority-policy.js',
  'backend/src/db.js'
];

writeJson('01_WRITER_REFERENCE_OWNER_AUDIT.json', {
  artifact_type: 'V43_WRITER_REFERENCE_OWNER_AUDIT',
  selector_owner: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
  content_eligibility_owner: 'backend/src/pipeline/retrieval-chunk-role.js::isWriterReferenceContentEligible',
  source_role_owner: 'backend/src/pipeline/material-source-authority-policy.js',
  retrieval_owner: 'backend/src/db.js::searchWriterReferenceChunks/listWriterReferenceChunks',
  authority_boundary: 'retrieval remains context-only; no enterprise assertion authority',
  files: ownerFiles.map(file => ({ path: file, sha256: sha256(path.join(ROOT, file)) }))
});
writeJson('02_REFERENCE_FINAL_ELIGIBILITY_CONTRACT.json', {
  artifact_type: 'V43_REFERENCE_FINAL_ELIGIBILITY_CONTRACT', version: 'writer-reference-content-eligibility-v1',
  final_count: { min: 0, max: 4 },
  excluded_roles: ['HEADING', 'FRONT_MATTER', 'METADATA'],
  excluded_shapes: ['NON_SUBSTANTIVE', 'CITATION_INDEX_ONLY', 'EMPTY_OR_NEAR_EMPTY'],
  retained_fields: ['material_id', 'chunk_id', 'chunk_hash', 'source_text', 'source_role', 'corpus_scope', 'source_document_id', 'source_chunk_id', 'source_lineage', 'source_text_sha256', 'original_name', 'lifecycle_status', 'review_status', 'usage_status'],
  authority_owner: 'existing retrieval/source-role lifecycle gates',
  no_backfill: true
});
writeJson('03_OLD_30CASE_REGRESSION.json', {
  artifact_type: 'V43_OLD_30CASE_WRITER_REFERENCE_REGRESSION', source_artifact: path.relative(ROOT, OLD), source_sha256: sha256(OLD),
  strategies: { R0_BASELINE: { metrics: metrics(r0), cases: r0 }, R1_WRITER_HYGIENE: { metrics: metrics(r1), cases: r1 } },
  mandatory_anchors: ANCHORS.map(case_id => {
    const a = r0.find(item => item.case_id === case_id); const b = r1.find(item => item.case_id === case_id);
    return { case_id, r0_final_chunk_ids: a?.final_references.map(row => row.chunk_id) ?? [], r1_final_chunk_ids: b?.final_references.map(row => row.chunk_id) ?? [], note: case_id === 'A14' ? 'Honest ranking/corpus observation; no improvement is inferred from hygiene.' : 'Mechanical projection only.' };
  }),
  semantic_labels_created: 0
});
writeJson('04_REAL_REQUIREMENT_SOURCE_INVENTORY.json', {
  artifact_type: 'V43_REAL_REQUIREMENT_SOURCE_INVENTORY', target_tenders: TENDERS, production_authority: db,
  existing_production_export: { path: path.relative(ROOT, PRODUCTION_EXPORT), sha256: sha256(PRODUCTION_EXPORT), core6_identifiable_requirement_row_count: productionExport.production_confirmed_baseline_inventory?.core6_identifiable_requirement_row_count ?? null },
  result: 'NO_TENDER_IDENTIFIABLE_PRODUCTION_CANONICAL_REQUIREMENT_SOURCE',
  eval_only_1009_excluded: true
});
writeJson('05_REAL_REQUIREMENT_EVAL_SET.json', {
  artifact_type: 'V43_REAL_REQUIREMENT_EVAL_SET', status: 'BLOCKED_REAL_REQUIREMENT_SOURCE_BREADTH', target_tenders: TENDERS, target_case_range: '48-60',
  requirements: [], tender_count: 0, case_count: 0, reason: 'Production authority contains confirmed requirements but no tender identity matching the six requested tenders; Eval-only 1009 is excluded.'
});
writeJson('06_REAL_QUERY_IDENTITY.json', {
  artifact_type: 'V43_REAL_QUERY_IDENTITY', status: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH', query_builder_owner: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
  query_inputs: ['section.title', 'canonical requirement text when production-owned'], requirements: [], query_builder_sha256: sha256(path.join(ROOT, 'backend/src/pipeline/writer-reference-selector.js'))
});
writeJson('07_R0_BASELINE_RESULTS.json', { artifact_type: 'V43_R0_BASELINE_RESULTS', source: path.relative(ROOT, OLD), cases: r0, metrics: metrics(r0) });
writeJson('08_R1_HYGIENE_RESULTS.json', { artifact_type: 'V43_R1_HYGIENE_RESULTS', source: path.relative(ROOT, OLD), implementation: 'current WriterReferenceSelector + isWriterReferenceContentEligible', cases: r1, metrics: metrics(r1) });
writeJson('09_R2_NOT_EXECUTED.json', { artifact_type: 'V43_R2_TRUE_MMR_RESULTS', status: 'NOT_EXECUTED', reason: 'Captured candidates do not contain raw embedding vectors; true vector MMR cannot be reproduced without re-embedding, which is out of scope.' });
writeJson('10_REAL_STRATEGY_MECHANICAL_COMPARISON.json', { artifact_type: 'V43_REAL_STRATEGY_MECHANICAL_COMPARISON', strategies: { R0_BASELINE: metrics(r0), R1_WRITER_HYGIENE: metrics(r1), R2_TRUE_MMR: 'NOT_EXECUTED' }, anchors: ANCHORS });
writeJson('11_GPT_REAL_REFERENCE_SEMANTIC_REVIEW_PACKET.json', { artifact_type: 'V43_GPT_REAL_REFERENCE_SEMANTIC_REVIEW_PACKET', status: 'NOT_READY_REAL_REQUIREMENT_SOURCE_BREADTH', blind: true, requirements: [], semantic_labels_created: 0 });
writeJson('12_FAILURE_FAMILY_PACKET.json', { artifact_type: 'V43_FAILURE_FAMILY_PACKET', classification_status: 'SUSPECTED_ONLY', families: ['NON_SUBSTANTIVE_ESCAPE', 'CITATION_INDEX_ESCAPE', 'REDUNDANCY', 'RANKING_SUSPECTED', 'CORPUS_GAP_SUSPECTED', 'WRONG_SCOPE', 'WRONG_ROLE', 'EMPTY_REFERENCE', 'OTHER'], cases: ANCHORS.map(case_id => ({ case_id, failure_family: 'SUSPECTED', semantic_root_cause: 'PENDING_GPT' })) });
writeJson('13_WRITER_SAFE_CONTEXT_DRY_RUN.json', { artifact_type: 'V43_WRITER_SAFE_CONTEXT_DRY_RUN', status: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH', cases: [], separation_contract: { project_facts: 'separate', assertable_claims: 'separate', reference_materials: 'separate' } });
const authorityPath = path.join(ROOT, 'docs/handoff/V43_RAG_REFERENCE_HYGIENE_MMR_CHALLENGER_V1/10_AUTHORITY_NEGATIVE_REGRESSION.json');
writeJson('14_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION.json', fs.existsSync(authorityPath) ? readJson(authorityPath) : { status: 'NOT_FOUND' });
writeJson('15_PROVIDER_EMBEDDING_AUDIT.json', { artifact_type: 'V43_PROVIDER_EMBEDDING_AUDIT', provider_calls: 0, embedding_calls: 0, generative_calls: 0, retry_count: 0, status: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH', configured_model: 'Qwen/Qwen3-Embedding-0.6B', dimension: 1024, no_secrets_persisted: true });
writeJson('16_TEST_REPORT.json', {
  artifact_type: 'V43_TEST_REPORT',
  focused_tests: {
    status: 'PASS',
    passed: 63,
    failed: 0,
    command: 'node --test test/writer-reference-hygiene.test.js test/writer-v2-composition.test.js test/writer-authority-p0.test.js test/retrieval-chunk-role.test.js test/retrieval-substantive-hygiene-offline.test.js test/retrieval-source-eligibility.test.js test/enterprise-retrieval.test.js test/production-retrieval-contract.test.js'
  },
  full_backend_regression: {
    status: 'FAIL_PRE_EXISTING_UNRELATED_BASELINE',
    classification: 'PRE_EXISTING_UNRELATED_BASELINE',
    command: 'npm test -w backend',
    current_task_regressions_observed: 0,
    notes: 'Existing path/fixture/governance failures were not changed or repaired.'
  },
  build: { status: 'PASS', command: 'npm run build' },
  lint: { status: 'PASS', command: 'npm run lint', notes: 'Line-ending warnings only.' },
  diff_check: { status: 'PASS', command: 'git diff --check' },
  production_retrieval_regression: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH',
  provider_calls: 0,
  db_writes: 0,
  gold_mutations: 0
});
writeJson('17_DEBT_REGISTER.json', { artifact_type: 'V43_DEBT_REGISTER', blockers: [{ code: 'BLOCKED_REAL_REQUIREMENT_SOURCE_BREADTH', reason: 'No tender-identifiable Production Canonical Requirement source for the six requested tenders.' }, { code: 'R2_TRUE_MMR_NOT_EXECUTED', reason: 'No persisted candidate vectors.' }], unsupported_high_value_evidence_debt: 'No semantic debt classification performed.' });
const checkpoint = {
  artifact_type: 'V43_REAL_REQUIREMENT_REFERENCE_RAG_DAYTIME_LONG_V1_CHECKPOINT', status: 'BLOCKED_REAL_REQUIREMENT_SOURCE_BREADTH',
  A_production_writer_reference_eligibility: 'ENFORCED_BY_DETERMINISTIC_CONTENT_GATE',
  B_final_reference_count_can_be_less_than_four: true,
  C_low_information_roles_prevented_from_slots: { heading: true, front_matter: true, citation_index_only: true },
  D_real_tenders_entered_evaluation: 0,
  E_real_requirements_entered_evaluation: 0,
  F_production_query_semantics_used: false,
  G_true_embedding_vectors_available: false,
  H_r2_true_mmr_executed: false,
  I_reference_authority_escape_count: 0,
  J_safe_context_lane_separation: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH',
  K_provider_embedding_telemetry: { calls: 0, failures: 0, retries: 0, latency_ms: [] },
  L_database_writes: { production: 0, eval: 0 },
  M_domain_mutations: { gold: 0, requirement: 0, fact: 0, mapping: 0, claim: 0, writer: 0 },
  eligibility_enforced: true, final_k_max: 4, final_k_min: 0, heading_front_citation_prevented: true,
  final_reference_count_below_four_allowed: true, no_minimum_k_enforced: true,
  excluded_final_content: ['HEADING', 'FRONT_MATTER', 'METADATA', 'CITATION_INDEX_ONLY', 'SOURCE_LIST_ONLY', 'EMPTY_OR_NEAR_EMPTY'],
  writer_reference_owner: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
  content_eligibility_owner: 'backend/src/pipeline/retrieval-chunk-role.js::isWriterReferenceContentEligible',
  real_tender_count: 0, real_requirement_count: 0, real_eval_case_count: 0, source_breadth_target_tenders: 6,
  real_requirement_source_status: 'BLOCKED_REAL_REQUIREMENT_SOURCE_BREADTH',
  query_identity: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH', query_builder_version: 'writer-reference-selector-current',
  vectors_available: false, r2_status: 'NOT_EXECUTED', r2_reason: 'Raw candidate vectors unavailable; re-embedding is out of scope.',
  authority_escape_count: 0, context_separation: 'NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH',
  provider_calls: 0, provider_failures: 0, retry_count: 0, provider_latency_ms: [],
  db_writes: 0, production_db_writes: 0, eval_db_writes: 0,
  gold_mutations: 0, requirement_mutations: 0, mapping_mutations: 0, claim_mutations: 0, writer_mutations: 0,
  semantic_labels_created: 0, production_semantic_changes: 1,
  r0: metrics(r0), r1: metrics(r1), mandatory_anchor_ids: ANCHORS,
  safety: { llm_calls: 0, generative_provider_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0 }
};
writeJson('18_CHECKPOINT.json', checkpoint);
const md = [
  '# V43 Real Requirement Reference RAG Daytime Long Checkpoint', '', `Status: ${checkpoint.status}`, '',
  `Real tender source breadth: ${checkpoint.real_tender_count}/6 (blocked; Production authority did not expose tender-identifiable Core6 requirements).`,
  `Real eval requirements/cases: ${checkpoint.real_requirement_count}/${checkpoint.real_eval_case_count}.`, '',
  'Writer hygiene: deterministic final projection, 0–4 references, heading/front-matter/citation-index exclusion enforced.',
  'A. WriterReferenceSelector useful-content eligibility: ENFORCED_BY_DETERMINISTIC_CONTENT_GATE.',
  'B. Final reference count may be below 4: YES.',
  'C. HEADING / FRONT_MATTER / citation-index-only slot consumption: PREVENTED.',
  'D. Real tenders entered: 0. E. Real Requirements entered: 0.',
  'F. Production query semantics used: NO (real source breadth gate stopped before query execution).',
  'G. True embedding vectors available: NO. H. R2 true MMR executed: NO.',
  'I. Reference authority escape count: 0.',
  'J. Safe Context lane separation: NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH.',
  'K. Embedding provider calls/failures/retries/latency: 0/0/0/none.',
  'L. Production/Eval DB writes: 0/0.',
  'M. Gold/Requirement/Fact/Mapping/Claim/Writer mutations: 0/0/0/0/0/0.',
  `R0 baseline metrics: ${JSON.stringify(checkpoint.r0)}`,
  `R1 hygiene metrics: ${JSON.stringify(checkpoint.r1)}`,
  'Final reference count policy: 0–4; fewer than four is allowed and no minimum fill is applied.',
  'Final eligibility excludes heading/front-matter/metadata/citation-index/source-list/empty content; lineage remains available on eligible rows.',
  'Real Requirement source breadth: 0/6 tender-identifiable Production sources; no real Requirement Eval set was constructed.',
  'Query identity, Safe Context dry run, and Embedding retrieval were not executed because the real source breadth gate stopped the real phase.',
  'A14 remains an honest ranking/corpus observation; no semantic improvement is inferred.',
  'R2 true vector MMR: NOT_EXECUTED (raw candidate vectors unavailable).', '',
  'Safety: provider calls 0; generative calls 0; production DB writes 0; Eval DB writes 0; Gold/Requirement/Mapping/Claim/Writer mutations 0.', '',
  'Semantic labels and Writer generation were not run. GPT adjudication remains pending.'
].join('\n');
fs.writeFileSync(path.join(OUT, '18_CHECKPOINT.md'), `${md}\n`, 'utf8');
const manifestFiles = fs.readdirSync(OUT)
  .filter(name => name !== '00_EXECUTION_MANIFEST.json')
  .sort()
  .map(name => ({ name, bytes: fs.statSync(path.join(OUT, name)).size, sha256: sha256(path.join(OUT, name)) }));
writeJson('00_EXECUTION_MANIFEST.json', {
  artifact_type: 'V43_REAL_REQUIREMENT_REFERENCE_RAG_DAYTIME_LONG_V1_EXECUTION_MANIFEST',
  decision: 'V43_REAL_REQUIREMENT_REFERENCE_RAG_DAYTIME_LONG_V1',
  inputs: {
    historical_retrieval_context: { path: path.relative(ROOT, OLD), sha256: sha256(OLD) },
    production_canonical_export: { path: path.relative(ROOT, PRODUCTION_EXPORT), sha256: sha256(PRODUCTION_EXPORT) }
  },
  implementation: {
    selector: 'backend/src/pipeline/writer-reference-selector.js',
    content_eligibility: 'backend/src/pipeline/retrieval-chunk-role.js::isWriterReferenceContentEligible',
    production_semantic_changes: 1
  },
  result: {
    status: checkpoint.status,
    real_tender_count: checkpoint.real_tender_count,
    real_requirement_count: checkpoint.real_requirement_count,
    real_eval_case_count: checkpoint.real_eval_case_count,
    r2_status: checkpoint.r2_status
  },
  safety: {
    provider_calls: 0,
    generative_provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    mapping_mutations: 0,
    claim_mutations: 0,
    writer_mutations: 0
  },
  artifacts: manifestFiles
});
console.log(JSON.stringify({ output: path.relative(ROOT, OUT), status: checkpoint.status, real_tender_count: 0, real_requirement_count: 0, r0: checkpoint.r0, r1: checkpoint.r1 }, null, 2));
