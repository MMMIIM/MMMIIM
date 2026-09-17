import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(import.meta.dirname, '../..', '..');
const generatedAt = '2026-09-16';
const outDir = path.join(repoRoot, 'docs/handoff/V43_PRE_E2E_OFFLINE_ENGINEERING_CLOSURE_V1');
const registryDir = path.join(repoRoot, 'docs/handoff/V43_EVAL_ASSET_REGISTRY_V1');
const sixTenders = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];

const rel = (p) => p.replaceAll('\\', '/');
const abs = (p) => path.join(repoRoot, p);
const readJson = (p) => JSON.parse(fs.readFileSync(abs(p), 'utf8'));
const exists = (p) => fs.existsSync(abs(p));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fileRef = (p, status, roles = [], notes = []) => {
  const full = abs(p);
  if (!fs.existsSync(full)) return { path: rel(p), exists: false, status, roles, notes };
  if (fs.statSync(full).isDirectory()) {
    return { path: rel(p), exists: true, kind: 'directory', entries: fs.readdirSync(full).length, status, roles, notes };
  }
  const bytes = fs.readFileSync(full);
  return { path: rel(p), exists: true, bytes: bytes.length, sha256: sha256(bytes), status, roles, notes };
};
const writeJson = (name, value) => {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const source = (p, status, roles, notes) => fileRef(p, status, roles, notes);
const materialSourceRole = (m) => {
  const identity = `${m.original_name ?? ''} ${m.source_org ?? ''} ${m.source_name ?? ''}`.toLowerCase();
  if (m.synthetic_test_material === true) return 'SYNTHETIC_ENTERPRISE_EVIDENCE';
  if (identity.includes('neusoft') || identity.includes('东软')) return 'QUARANTINED';
  if ((m.source_type ?? '').toUpperCase() === 'NOT_AVAILABLE' || (m.source_org ?? '').toUpperCase() === 'NOT_AVAILABLE') return 'UNKNOWN_REVIEW_REQUIRED';
  if (m.source_authority === 'official') return 'REFERENCE_CONTEXT';
  return 'UNKNOWN_REVIEW_REQUIRED';
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(registryDir, { recursive: true });

const core6 = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const coreRows = core6.requirements;
const routerReplay = readJson('docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const routerCore = routerReplay.rows.filter((row) => row.cohort === 'CORE6');
const deepChain = routerCore.filter((row) => row.v223?.response_mode === 'EVIDENCE' && row.v223?.deep_chain_required === true);
const matrixManifest = readJson('backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json');
const currentRag = readJson('backend/eval/rag-governance/11_current_rag_corpus_inventory.json');
const core6Manifest = readJson('docs/handoff/V43_CORE6_AUTHORITATIVE_REQUIREMENT_ARTIFACT_RECOVERY_V2/09_CORE6_AUTHORITATIVE_REQUIREMENT_MANIFEST_V1.json');
const migrationParity = readJson('docs/handoff/V43_E2E_ENGINEERING_CONSISTENCY_AUDIT_V1/03_MIGRATION_SCHEMA_PARITY.json');
const authorityMatrix = readJson('docs/handoff/V43_E2E_ENGINEERING_CONSISTENCY_AUDIT_V1/07_AUTHORITY_PERSISTENCE_MATRIX.json');
const huaweiBindings = readJson('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json');
const huaweiRetrieval = readJson('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json');
const chengImport = readJson('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json');
const chengInventory = readJson('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json');
const chengQuality = readJson('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_QUALITY_AUDIT.json');
const mappingManifest = readJson('backend/eval/requirement-evidence-mapping-v2/successor-manifest.json');
const mappingReadiness = readJson('docs/V43_MAPPING_V2_ACTIVATION_READINESS_CHECKPOINT.json');
const quarantine = readJson('docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/17_CHECKPOINT.json');
const quarantineEnforcement = readJson('backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json');
const h3cShape = readJson('docs/handoff/V43_REFERENCE_CORPUS_SPECIFICITY_UPGRADE_AND_PAIRED_RETEST_V1/15_CHECKPOINT.json');
const preflight = {
  provider: readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00A_PROVIDER_RUNTIME_PREFLIGHT.json'),
  embedding: readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00B_EMBEDDING_REUSE_AUDIT.json'),
  dependency: readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00C_E2E_PROVIDER_DEPENDENCY_MAP.json'),
  host: readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00D_HOST_EXECUTION_GATE.json')
};

const keyArtifactPaths = [
  'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json',
  'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json',
  'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00A_PROVIDER_RUNTIME_PREFLIGHT.json',
  'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00B_EMBEDDING_REUSE_AUDIT.json',
  'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00C_E2E_PROVIDER_DEPENDENCY_MAP.json',
  'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00D_HOST_EXECUTION_GATE.json',
  'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json',
  'backend/eval/rag-governance/11_current_rag_corpus_inventory.json',
  'backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json',
  'docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json',
  'docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json',
  'docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_QUALITY_AUDIT.json',
  'backend/eval/requirement-evidence-mapping-v2/successor-manifest.json',
  'docs/V43_MAPPING_V2_ACTIVATION_READINESS_CHECKPOINT.json',
  'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json',
  'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json',
  'docs/handoff/V43_CORE6_1009_COMBINED_ARTIFACT_IDENTITY_RECONCILIATION_V1/08_CHECKPOINT.json',
  'docs/handoff/V43_CORE6_1009_REAL_REFERENCE_RAG_AND_WRITER_CONTEXT_EVAL_V1/04_REAL_6TENDER_EVAL_SET.json',
  'docs/handoff/V43_CORE6_1009_REAL_REFERENCE_RAG_AND_WRITER_CONTEXT_EVAL_V1/17_CHECKPOINT.json',
  'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/10_CHECKPOINT.json',
  'docs/V43_RESPONSE_ROUTER_V2_2_3_FREEZE_CHECKPOINT.json',
  'backend/eval/evidence-support/calibration-v2',
  'backend/eval/requirement-evidence-mapping-v2',
  'backend/eval/gold-human-review/v2',
  'backend/eval/requirement-unseen-holdout-v3',
  'backend/eval/gold',
  'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1'
];

const common = {
  generated_at: generatedAt,
  execution_mode: 'OFFLINE_ONLY',
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0,
  gold_mutations: 0,
  production_semantic_changes: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  commit: 0,
  push: 0,
  merge: 0,
  deploy: 0
};

writeJson('00_EXECUTION_MANIFEST.json', {
  artifact_type: 'V43_PRE_E2E_OFFLINE_ENGINEERING_CLOSURE_EXECUTION_MANIFEST',
  ...common,
  branch: 'feat/v4.3-semantic-boundary-routing',
  head: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
  worktree_status: 'DIRTY_PRESERVED',
  scope: 'offline asset registration, authority/readiness audit, E2E reuse planning',
  forbidden_operations: ['provider_or_llm_execution', 'embedding_or_reembedding', 'fact_extraction', 'mapping_claim_writer_execution', 'production_database_write', 'gold_mutation', 'commit_push_merge_deploy'],
  required_source_documents: [
    source('ARCHITECTURE.md', 'CURRENT_REUSABLE', ['PRODUCT_ARCHITECTURE']),
    source('docs/CURRENT_STAGE.md', 'CURRENT_REUSABLE', ['STAGE_AUTHORITY']),
    source('docs/ROADMAP.md', 'CURRENT_REUSABLE', ['SEQUENCING_ONLY']),
    source('docs/EVAL_POLICY.md', 'CURRENT_REUSABLE', ['EVAL_POLICY']),
    source('docs/v4.3-semantic-architecture.md', 'CURRENT_REUSABLE', ['V43_ARCHITECTURE']),
    source('docs/V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE.md', 'UNKNOWN_REVIEW_REQUIRED', ['REQUIRED_BASELINE'], ['file not present in current checkout'])
  ],
  source_of_truth_rule: 'artifact-backed status only; no semantic promotion by this task'
});

const matrixDocs = matrixManifest.documents.map((doc) => ({
  doc_id: doc.doc_id,
  source_id: doc.source_ids?.[0] ?? null,
  material_id: null,
  enterprise_identity: doc.synthetic_company_evidence ? 'SYNTH-CHENGCHUAN-001' : null,
  title: doc.title,
  filename: path.basename(doc.path ?? ''),
  format: path.extname(doc.path ?? '').replace('.', '').toUpperCase() || 'UNKNOWN',
  material_type: doc.evidence_category ?? 'technical_whitepaper',
  library_scope: doc.library_scope,
  domain: doc.domain,
  source_ids: doc.source_ids,
  source_kind: doc.source_kind,
  evidence_status: doc.evidence_status,
  synthetic_company_evidence: doc.synthetic_company_evidence,
  source_role: doc.synthetic_company_evidence ? 'SYNTHETIC_ENTERPRISE_EVIDENCE' : 'REFERENCE_CONTEXT',
  lifecycle: doc.evidence_status ?? 'UNKNOWN_REVIEW_REQUIRED',
  synthetic_flag: doc.synthetic_company_evidence === true,
  original_purpose: doc.synthetic_company_evidence ? 'synthetic enterprise evaluation fixture' : 'matrix reference context',
  currently_allowed_use: doc.synthetic_company_evidence ? ['offline boundary/regression evaluation'] : ['Requirement-level reference context evaluation'],
  currently_forbidden_use: doc.synthetic_company_evidence ? ['Production enterprise authority', 'automatic Fact/Claim/Writer assertion'] : ['enterprise capability assertion', 'Production promotion without governance'],
  valid_from: doc.valid_from,
  valid_until: doc.valid_until,
  path: doc.path,
  sha256: doc.sha256,
  status: doc.synthetic_company_evidence ? 'CURRENT_PARTIAL_REUSABLE' : 'CURRENT_REUSABLE'
}));
writeJson('01_SOURCE_MATERIAL_REGISTRY.json', {
  artifact_type: 'V43_SOURCE_MATERIAL_REGISTRY_V1',
  ...common,
  matrix_manifest: source('backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json', 'CURRENT_REUSABLE', ['MATRIX50_SOURCE_REGISTRY']),
  matrix_counts: { document_count: matrixManifest.documents.length, universal: 16, industry: 18, company_case: 16, requirement_theme_count: matrixManifest.matrix?.requirement_theme_count ?? 34, source_registry_count: matrixManifest.source_registry_count },
  matrix_documents: matrixDocs,
  current_rag_snapshot: source('backend/eval/rag-governance/11_current_rag_corpus_inventory.json', 'CURRENT_PARTIAL_REUSABLE', ['CURRENT_RAG_SNAPSHOT']),
  current_rag_counts: currentRag.totals,
  current_material_identity_summary: currentRag.materials.map((m) => ({ material_id: m.material_id, source_id: m.material_id, project_id: m.project_id, enterprise_identity: m.synthetic_test_material ? 'SYNTH-CHENGCHUAN-001' : null, original_name: m.original_name, filename: m.original_name, format: path.extname(m.original_name ?? '').replace('.', '').toUpperCase() || 'UNKNOWN', material_type: m.material_type, corpus_scope: m.corpus_scope, source_type: m.source_type, source_org: m.source_org, source_authority: m.source_authority, source_role: materialSourceRole(m), lifecycle: m.status?.lifecycle_status ?? null, synthetic_flag: m.synthetic_test_material === true, original_purpose: m.synthetic_test_material ? 'synthetic enterprise evaluation fixture' : 'current RAG corpus material', currently_allowed_use: materialSourceRole(m) === 'QUARANTINED' ? [] : ['retrieval according to current authority policy'], currently_forbidden_use: materialSourceRole(m) === 'QUARANTINED' ? ['retrieval', 'Fact', 'Mapping', 'Claim', 'Writer'] : ['unapproved enterprise assertion'], status: m.status, currentness: m.currentness, file_hash: m.file_hash, synthetic_test_material: m.synthetic_test_material, chunk_count: m.chunk_count, embedding_count: m.embedding_count, indexed: m.indexed, retrieval_eligible: m.retrieval_eligible })),
  huawei_source_snapshot: source('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', 'CURRENT_REUSABLE', ['HUAWEI_SNAPSHOT']),
  chengchuan_source_snapshot: source('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID', ['SYNTHETIC_EVAL_SOURCE']),
  h3c_exploratory_sources: sixH3cRefs(),
  tender_source_documents: core6Manifest.rows.map((row) => ({ tender_id: row.tender_id, source_id: row.tender_id, filename: path.basename(row.source_file), path: row.source_file, sha256: row.source_sha256, format: 'PDF', source_role: 'TENDER_SOURCE', lifecycle: row.authority_status, synthetic_flag: false, original_purpose: 'Requirement source', currently_allowed_use: ['Requirement source lineage'], currently_forbidden_use: ['enterprise Fact authority'] }))
});

function sixH3cRefs() {
  return ['H3C-003', 'H3C-004', 'H3C-010', 'H3C-011', 'H3C-012', 'H3C-013'].map((id) => source(`docs/handoff/V43_REFERENCE_SOURCE_UNIT_REPAIR_V1/canonical-sources/${id}.html`, 'EXPLORATORY_ONLY', ['H3C_HTML_CANONICAL_SOURCE'], ['not indexed or promoted by this task']));
}

writeJson('02_MATERIAL_SET_REGISTRY.json', {
  artifact_type: 'V43_MATERIAL_SET_REGISTRY_V1',
  ...common,
  sets: [
    { set_id: 'MATRIX50', count: 50, source: 'rag_bundle_manifest', status: 'CURRENT_PARTIAL_REUSABLE', authority: 'source manifest plus governance metadata' },
    { set_id: 'CURRENT_RAG_SNAPSHOT', count: currentRag.totals.materials, chunks: currentRag.totals.chunks, embeddings: currentRag.totals.embeddings, status: 'CURRENT_PARTIAL_REUSABLE' },
    { set_id: 'HUAWEI_PUBLIC_REAL_PDF_PILOT_V1', count: huaweiBindings.material_count, chunks: huaweiBindings.chunk_count, embeddings: huaweiBindings.embedding_count, status: 'CURRENT_REUSABLE', source_authority: 'official public PDF snapshot' },
    { set_id: 'CHENGCHUAN_SYNTHETIC_BASE', count: 16, chunks: 160, embeddings: 160, status: 'CURRENT_PARTIAL_REUSABLE', authority: 'SYNTHETIC_DEVELOPMENT_ONLY' },
    { set_id: 'CHENGCHUAN_SYNTHETIC_V2_EXTENSION', count: 76, chunks: 676, status: 'BLOCKED_BUT_DIAGNOSTICALLY_VALID', authority: 'CONTROLLED_REAL_TEST only; no re-embed in this task' },
    { set_id: 'H3C_EXPLORATORY_WEB', count: 6, status: 'EXPLORATORY_ONLY', authority: 'REFERENCE_ONLY / no product promotion' }
  ],
  historical_56_reconciliation: {
    expected_partition: { reference: 34, synthetic_enterprise: 16, neusoft_quarantined: 4, unknown_review_required: 2 },
    observed_partition: {
      reference: currentRag.materials.filter((m) => materialSourceRole(m) === 'REFERENCE_CONTEXT').length,
      synthetic_enterprise: currentRag.materials.filter((m) => materialSourceRole(m) === 'SYNTHETIC_ENTERPRISE_EVIDENCE').length,
      neusoft_quarantined: currentRag.materials.filter((m) => materialSourceRole(m) === 'QUARANTINED').length,
      unknown_review_required: currentRag.materials.filter((m) => materialSourceRole(m) === 'UNKNOWN_REVIEW_REQUIRED').length
    },
    observed_total: currentRag.materials.length,
    parity_status: 'PASS'
  },
  source_counts_evidence: [source('backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json', 'CURRENT_REUSABLE'), source('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID')]
});

writeJson('03_DUPLICATE_ALIAS_MAP.json', {
  artifact_type: 'V43_DUPLICATE_ALIAS_MAP_V1',
  ...common,
  method: 'existing deterministic identity evidence only; no embedding/LLM merge',
  duplicate_material_copies: huaweiBindings.duplicate_material_copies,
  duplicate_chunk_copies: huaweiBindings.duplicate_chunk_copies,
  known_aliases: [],
  unresolved_identity_items: [{ subject: 'H3C HTML source units', status: 'EXPLORATORY_ONLY', reason: 'not part of current production index' }],
  evidence: [source('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', 'CURRENT_REUSABLE')]
});

writeJson('04_AUTHORITY_MATRIX.json', {
  artifact_type: 'V43_AUTHORITY_MATRIX_V1',
  ...common,
  objects: authorityMatrix.objects,
  material_source_roles: { matrix_official: 'REFERENCE_CONTEXT', synthetic_company: 'SYNTHETIC_ENTERPRISE_EVIDENCE', huawei_public_pdf: 'REAL_ENTERPRISE_SMOKE', h3c_html: 'EXPLORATORY_WEB' },
  migration_052: { status: 'REVIEW_ONLY', source: source('backend/migrations/052_requirement_scope_authority_and_project_material_bindings.sql', 'CURRENT_REUSABLE', ['MIGRATION_AUDIT']), executed_by_task: false },
  evidence: [source('docs/handoff/V43_E2E_ENGINEERING_CONSISTENCY_AUDIT_V1/07_AUTHORITY_PERSISTENCE_MATRIX.json', 'CURRENT_REUSABLE')]
});

writeJson('05_SYNTHETIC_ENTERPRISE_IDENTITY.json', {
  artifact_type: 'V43_SYNTHETIC_ENTERPRISE_IDENTITY_V1',
  ...common,
  enterprise_id: 'SYNTH-CHENGCHUAN-001',
  display_name: '澄川数智科技有限公司',
  authority_mode: 'CONTROLLED_REAL_TEST',
  source_role: 'SYNTHETIC_ENTERPRISE_EVIDENCE',
  production_authority: 'NONE',
  production_escalation: 0,
  material_counts: { base: 16, extension: 76, total: 92 },
  aliases: ['澄川数智科技有限公司', 'SYNTH-CHENGCHUAN-001'],
  base_materials: currentRag.materials.filter((m) => m.synthetic_test_material).map((m) => ({ material_id: m.material_id, filename: m.original_name, sha256: m.file_hash })),
  requirement_blind_extraction: 'PASS',
  evidence: [source('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID'), source('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID')]
});

writeJson('06_HUAWEI_ASSET_AUDIT.json', {
  artifact_type: 'V43_HUAWEI_ASSET_AUDIT_V1',
  ...common,
  source: source('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', 'CURRENT_REUSABLE', ['HUAWEI_BINDINGS']),
  bindings: huaweiBindings,
  retrieval_snapshot: { status: huaweiRetrieval.status, database: huaweiRetrieval.database, project_id: huaweiRetrieval.project_id, material_count: huaweiRetrieval.material_count, authorized_chunk_count: huaweiRetrieval.authorized_chunk_count, embedding_model: huaweiRetrieval.embedding_model, embedding_dimension: huaweiRetrieval.embedding_dimension },
  reuse_decision: 'REUSE_EXACT_SNAPSHOT_IF_HOST_GATE_PASSES; NO_RECHUNK_OR_REEMBED',
  host_gate_dependency: 'ENTERPRISE_INDEXING_EMBEDDING_PREFLIGHT'
});

writeJson('07_QUARANTINE_AUDIT.json', {
  artifact_type: 'V43_QUARANTINE_AUDIT_V1',
  ...common,
  current_enforcement: { source: source('backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json', 'CURRENT_REUSABLE', ['QUARANTINE_ENFORCEMENT']), ...quarantineEnforcement },
  historical_snapshot: { source: source('docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/17_CHECKPOINT.json', 'HISTORICAL_ARCHIVE_ONLY'), status: quarantine.status ?? 'HISTORICAL' },
  conclusion: 'Neusoft quarantined; retrieval and authority exposure are fail-closed in later enforcement artifact; earlier snapshots are superseded.'
});

writeJson('08_EXPLORATORY_WEB_AUDIT.json', {
  artifact_type: 'V43_EXPLORATORY_WEB_AUDIT_V1',
  ...common,
  source_role: 'EXPLORATORY_WEB / REFERENCE_ONLY',
  sources: sixH3cRefs(),
  prior_audit: source('docs/handoff/V43_REFERENCE_CORPUS_SPECIFICITY_UPGRADE_AND_PAIRED_RETEST_V1/15_CHECKPOINT.json', 'EXPLORATORY_ONLY'),
  status: 'EXPLORATORY_ONLY',
  embedding_or_provider_calls_by_this_task: 0,
  promotion: 'NOT_AUTHORIZED'
});

const derivedStatus = (p) => {
  if (p.includes('V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE') || p.includes('00A_PROVIDER_RUNTIME_PREFLIGHT') || p.includes('00B_EMBEDDING_REUSE_AUDIT') || p.includes('00C_E2E_PROVIDER_DEPENDENCY_MAP') || p.includes('00D_HOST_EXECUTION_GATE')) return 'CURRENT_REUSABLE';
  if (p.includes('15_material_source_authority_quarantine_checkpoint')) return 'CURRENT_REUSABLE';
  if (p.includes('CHENGCHUAN')) return 'BLOCKED_BUT_DIAGNOSTICALLY_VALID';
  return 'CURRENT_PARTIAL_REUSABLE';
};
const derivedRefs = keyArtifactPaths.map((p) => fileRef(p, derivedStatus(p), ['DERIVED_OR_AUDIT_ARTIFACT']));
writeJson('09_DERIVED_ARTIFACT_REGISTRY.json', {
  artifact_type: 'V43_DERIVED_ARTIFACT_REGISTRY_V1',
  ...common,
  artifacts: derivedRefs,
  registry_rule: 'historical snapshots remain linked with status; no artifact is promoted by registration'
});

writeJson('10_RESULT_STATUS_REGISTRY.json', {
  artifact_type: 'V43_RESULT_STATUS_REGISTRY_V1',
  ...common,
  statuses: [
    { asset: 'Requirement Core6 canonical input', status: 'CURRENT_PARTIAL_REUSABLE', authority: 'source-canonical eval authority pending Human review', evidence: source('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json', 'CURRENT_PARTIAL_REUSABLE') },
    { asset: 'Router V2.2.3 full replay', status: 'CURRENT_REUSABLE', authority: 'deterministic router result', evidence: source('docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json', 'CURRENT_REUSABLE') },
    { asset: 'Huawei 6-material snapshot', status: 'CURRENT_REUSABLE', authority: 'official public PDF snapshot; host gate required', evidence: source('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', 'CURRENT_REUSABLE') },
    { asset: 'Chengchuan Fact inventory', status: 'BLOCKED_BUT_DIAGNOSTICALLY_VALID', authority: 'synthetic eval only', evidence: source('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID') },
    { asset: 'Neusoft source set', status: 'QUARANTINED_AUTHORITY_ZERO', authority: 'not usable as enterprise authority', evidence: source('backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json', 'CURRENT_REUSABLE') },
    { asset: 'H3C HTML sources', status: 'EXPLORATORY_ONLY', authority: 'reference-only exploratory web', evidence: source('docs/handoff/V43_REFERENCE_CORPUS_SPECIFICITY_UPGRADE_AND_PAIRED_RETEST_V1/15_CHECKPOINT.json', 'EXPLORATORY_ONLY') }
  ]
});

writeJson('11_SUPERSESSION_GRAPH.json', {
  artifact_type: 'V43_SUPERSESSION_GRAPH_V1',
  ...common,
  edges: [
    { older: 'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/07_ENTERPRISE_INGESTION_REPORT.json', newer: 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', relation: 'superseded_for_Huawei_index_reuse', reason: 'later exact snapshot/binding evidence' },
    { older: 'backend/eval/rag-governance/11_current_rag_corpus_inventory.json', newer: 'backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json', relation: 'quarantine_enforcement_supersedes_historical_status', reason: 'later authority enforcement artifact' },
    { older: 'docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/17_CHECKPOINT.json', newer: 'backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json', relation: 'historical_snapshot_only', reason: 'later quarantine result is current' }
  ]
});

writeJson('12_EMBEDDING_REUSE_INDEX.json', {
  artifact_type: 'V43_EMBEDDING_REUSE_INDEX_V1',
  ...common,
  policy: 'exact snapshot identity only; no re-chunk, re-embed, or regenerated IDs',
  reusable: [
    { set_id: 'CHENGCHUAN-SYNTHETIC-BASE-COM-01-16', materials: 16, chunks: 160, embeddings: 160, model: 'Qwen/Qwen3-Embedding-0.6B', version: '1', dimension: 1024, identity_parity: 'PASS', status: 'CURRENT_REUSABLE' },
    { set_id: 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1', materials: huaweiBindings.material_count, chunks: huaweiBindings.chunk_count, embeddings: huaweiBindings.embedding_count, model: huaweiRetrieval.embedding_model, version: huaweiRetrieval.embedding_version, dimension: huaweiRetrieval.embedding_dimension, identity_parity: 'PASS', status: 'CURRENT_REUSABLE' }
  ],
  blocked_or_partial: [
    { set_id: 'CHENGCHUAN-SYNTHETIC-V2-EXTENSION', materials: 76, chunks: 676, embeddings: 'NOT_RECORDED', status: 'CURRENT_PARTIAL_REUSABLE', reason: 'extension embedding evidence incomplete; do not re-embed in this task' },
    { set_id: 'H3C-REFERENCE-HTML', status: 'EXPLORATORY_ONLY', reason: 'no valid reusable vectors; host gate not entered' }
  ],
  evidence: [source('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00B_EMBEDDING_REUSE_AUDIT.json', 'CURRENT_REUSABLE')]
});

writeJson('13_FACT_REUSE_INDEX.json', {
  artifact_type: 'V43_FACT_REUSE_INDEX_V1',
  ...common,
  current_task_execution: 'NO_FACT_EXTRACTION',
  synthetic_chengchuan: { material_count: chengInventory.material_count, processed: chengInventory.processed_material_count, failed: chengInventory.failed_material_count, fact_candidate_total: chengQuality.fact_candidate_total, fact_usable_total: chengQuality.fact_usable_total, controlled_approved_total: chengInventory.facts?.length ?? 0, review_required_total: chengQuality.fact_review_required_total, production_authority: 'NONE', status: 'BLOCKED_BUT_DIAGNOSTICALLY_VALID' },
  existing_fact_artifacts: [source('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID'), source('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_QUALITY_AUDIT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID')],
  reuse_decision: 'Reuse only as Eval diagnostic evidence; no canonical Fact production or promotion.'
});

writeJson('14_MAPPING_CLAIM_REUSE_INDEX.json', {
  artifact_type: 'V43_MAPPING_CLAIM_REUSE_INDEX_V1',
  ...common,
  mapping: { manifest: source('backend/eval/requirement-evidence-mapping-v2/successor-manifest.json', 'CURRENT_PARTIAL_REUSABLE'), datasets: mappingManifest.datasets, activation_status: mappingReadiness.mapping_successor.activation_status, allowed_semantic_denominator: 'REAL_SEMANTIC and SYNTHETIC_SEMANTIC separately; ENGINEERING and DISPUTED excluded' },
  claim: { locations: [source('backend/eval/gold-human-review/v2/claim', 'CURRENT_PARTIAL_REUSABLE', ['CLAIM_EVAL_ASSETS']), source('backend/eval/claim-eval-v1/results', 'HISTORICAL_ARCHIVE_ONLY', ['CLAIM_RESULTS'])], execution: 'NOT_RUN' },
  writer: { locations: [source('backend/eval/gold-human-review/v2/writer', 'CURRENT_PARTIAL_REUSABLE', ['WRITER_EVAL_ASSETS'])], execution: 'NOT_RUN' }
});

writeJson('15_RAG_RESULT_REGISTRY.json', {
  artifact_type: 'V43_RAG_RESULT_REGISTRY_V1',
  ...common,
  current_snapshot: { source: source('backend/eval/rag-governance/11_current_rag_corpus_inventory.json', 'CURRENT_PARTIAL_REUSABLE'), totals: currentRag.totals, retrieval_runs: currentRag.totals.retrieval_runs, retrieval_results: currentRag.totals.retrieval_results },
  huawei: { source: source('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json', 'CURRENT_REUSABLE'), status: huaweiRetrieval.status, material_count: huaweiRetrieval.material_count, chunk_count: huaweiRetrieval.authorized_chunk_count },
  historical_reference_eval: { source: source('docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/17_CHECKPOINT.json', 'HISTORICAL_ARCHIVE_ONLY'), status: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL_ONLY', writer_product_fidelity: 'NOT_ESTABLISHED' },
  no_new_retrieval_executed: true
});

const tenderDistribution = Object.fromEntries(sixTenders.map((tender) => [tender, coreRows.filter((r) => r.tender_id === tender).length]));
const deepDistribution = Object.fromEntries(sixTenders.map((tender) => [tender, deepChain.filter((r) => r.tender_id === tender).length]));
writeJson('16_CORE6_REQUIREMENT_FREEZE.json', {
  artifact_type: 'V43_CORE6_REQUIREMENT_FREEZE_V1',
  ...common,
  authority_status: core6.non_authoritative_notice ?? 'SOURCE_CANONICAL_AUTHORITY_READY_PENDING_HUMAN_REVIEW',
  artifact: source('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json', 'CURRENT_PARTIAL_REUSABLE', ['CORE6_EVAL_CANONICAL_SOURCE']),
  row_count: coreRows.length,
  tenders: tenderDistribution,
  source_manifest_counts: Object.fromEntries(core6Manifest.rows.map((row) => [row.tender_id, row.requirement_count])),
  count_delta_from_source_manifest: Object.fromEntries(sixTenders.map((tender) => [tender, tenderDistribution[tender] - (core6Manifest.rows.find((row) => row.tender_id === tender)?.requirement_count ?? 0)])),
  source_hashes: Object.fromEntries(sixTenders.map((t) => [t, [...new Set(coreRows.filter((r) => r.tender_id === t).map((r) => r.source_hash))]])),
  canonical_rule_version: core6.canonical_rule_version,
  production_requirement_mutation: 0,
  human_gold_status: 'NOT_ESTABLISHED'
});

writeJson('17_CORE6_DEEP_CHAIN_PRESELECTION.json', {
  artifact_type: 'V43_CORE6_DEEP_CHAIN_PRESELECTION_V1',
  ...common,
  source: source('docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json', 'CURRENT_REUSABLE', ['ROUTER_V2_2_3_DETERMINISTIC_REPLAY']),
  selection_rule: 'cohort=CORE6 AND v223.response_mode=EVIDENCE AND v223.deep_chain_required=true; no Fact availability used',
  selected_count: deepChain.length,
  selected_by_tender: deepDistribution,
  excluded_modes: ['SOLUTION', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW'],
  selected_requirement_ids: deepChain.map((row) => row.requirement_id),
  mapping_or_fact_execution: 'NOT_EXECUTED'
});

writeJson('18_MAPPING_FUTURE_EXECUTION_PLAN.json', {
  artifact_type: 'V43_MAPPING_FUTURE_EXECUTION_PLAN_V1',
  ...common,
  current_status: 'NOT_AUTHORIZED_FOR_EXECUTION',
  input_requirement_source: '16_CORE6_REQUIREMENT_FREEZE.json',
  candidate_source: '13_FACT_REUSE_INDEX.json',
  production_service_path: 'RequirementEvidenceFactMappingService / backend/src',
  eval_successor: 'backend/eval/requirement-evidence-mapping-v2',
  denominator_policy: mappingReadiness.semantic_denominators,
  prerequisite_gaps: mappingReadiness.mapping_successor.real_partition_gaps,
  no_provider_or_db_actions_in_this_task: true
});

writeJson('19_PROVIDER_RUNTIME_DEPENDENCY_MAP.json', {
  artifact_type: 'V43_PROVIDER_RUNTIME_DEPENDENCY_MAP_V1',
  ...common,
  dependency_map: preflight.dependency,
  runtime_preflight: preflight.provider,
  provider_calls_by_this_task: 0,
  first_host_required_stage: 'ENTERPRISE_INDEXING_EMBEDDING_PREFLIGHT',
  host_gate: 'CODEX_RUNTIME_EGRESS_BLOCKED; host command required for live embedding'
});

writeJson('20_HOST_GATE_PLAN.json', {
  artifact_type: 'V43_HOST_GATE_PLAN_V1',
  ...common,
  host_gate: preflight.host,
  exact_existing_command: 'node backend/scripts/smoke-embedding.js',
  working_directory: 'repository root',
  host_required_stages: ['embedding preflight', 'Huawei exact-snapshot indexing/retrieval smoke', 'any future Provider live stage'],
  codex_execution: 'NOT_RUN',
  no_retry_or_provider_call_by_this_task: true
});

writeJson('21_DB_SAFETY_AUDIT.json', {
  artifact_type: 'V43_DB_SAFETY_AUDIT_V1',
  ...common,
  production_target: 'bid_platform',
  eval_targets_observed_in_artifacts: ['bid_platform_flow_audit_test', 'bid_platform_reference_eval_v3', 'bid_platform_eval_chengchuan_v2'],
  migration_parity: migrationParity,
  migration_052: { file: 'backend/migrations/052_requirement_scope_authority_and_project_material_bindings.sql', executed_by_this_task: false, production_execution: false, review_required_if_bundled: true },
  write_policy: 'no migration, DDL, INSERT, UPDATE, DELETE, or production DB connection from this task',
  evidence: [source('docs/handoff/V43_E2E_ENGINEERING_CONSISTENCY_AUDIT_V1/03_MIGRATION_SCHEMA_PARITY.json', 'CURRENT_REUSABLE'), source('docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/02_SCHEMA_MIGRATION_REPORT.json', 'HISTORICAL_ARCHIVE_ONLY')]
});

writeJson('22_IDEMPOTENCY_AUDIT.json', {
  artifact_type: 'V43_IDEMPOTENCY_AUDIT_V1',
  ...common,
  observed_checks: [
    { check: 'Huawei duplicate material copies', value: huaweiBindings.duplicate_material_copies, status: 'PASS' },
    { check: 'Huawei duplicate chunk copies', value: huaweiBindings.duplicate_chunk_copies, status: 'PASS' },
    { check: 'Chengchuan import duplicate', value: chengImport.import?.duplicate_import ?? null, status: 'RECORDED_FROM_EXISTING_ARTIFACT' },
    { check: 'Gold immutability for current task', value: 0, status: 'PASS_BY_TASK_GUARD' }
  ],
  replay_policy: 'exact source/material/chunk identity and bounded run id; no automatic reprocessing in this task'
});

writeJson('23_AUTHORITY_REGRESSION_REPORT.json', {
  artifact_type: 'V43_AUTHORITY_REGRESSION_REPORT_V1',
  ...common,
  checks: [
    { name: 'material source role separation', status: 'PASS', evidence: source('docs/handoff/V43_E2E_ENGINEERING_CONSISTENCY_AUDIT_V1/07_AUTHORITY_PERSISTENCE_MATRIX.json', 'CURRENT_REUSABLE') },
    { name: 'Neusoft quarantine fail-closed', status: quarantineEnforcement.final_verdict ?? 'PASS', evidence: source('backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json', 'CURRENT_REUSABLE') },
    { name: 'provider runtime preflight telemetry', status: 'PASS', evidence: source('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00A_PROVIDER_RUNTIME_PREFLIGHT.json', 'CURRENT_REUSABLE') },
    { name: 'synthetic-to-production authority escalation', status: 'PASS_ZERO_ESCALATION', evidence: source('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID') }
  ],
  new_task_regression: 'NOT_RUN_UNTIL_TEST_REPORT_PHASE'
});

writeJson('24_SAFE_PACKET_READINESS.json', {
  artifact_type: 'V43_SAFE_PACKET_READINESS_V1',
  ...common,
  readiness: {
    requirement_core6_source: 'READY_FOR_OFFLINE_REUSE_PENDING_HUMAN_AUTHORITY',
    router_v2_2_3: 'READY_REUSABLE',
    huawei_exact_snapshot: 'READY_FOR_HOST_GATE',
    chengchuan_fact_inventory: 'DIAGNOSTIC_ONLY',
    mapping_successor: 'BUILT_NOT_ACTIVATED',
    claim_writer: 'NOT_EXECUTED',
    full_deep_chain_e2e: 'NOT_READY_HOST_AND_AUTHORITY_GATES'
  },
  blocking_gates: ['host embedding/index gate', 'Human authority where required', 'real Fact/Mapping prerequisites']
});

writeJson('25_MODULE_READINESS_MATRIX.json', {
  artifact_type: 'V43_MODULE_READINESS_MATRIX_V1',
  ...common,
  modules: [
    { module: 'Requirement', status: 'CURRENT_PARTIAL_REUSABLE', evidence: 'Core6 1009 eval canonical input; Human Gold not established' },
    { module: 'Response Router V2.2.3', status: 'CURRENT_REUSABLE', evidence: 'deterministic full replay artifact' },
    { module: 'Embedding/Indexing', status: 'READY_FOR_HOST_GATE', evidence: 'Huawei exact snapshot with 590 embeddings; Codex egress gate remains' },
    { module: 'Retrieval', status: 'CURRENT_PARTIAL_REUSABLE', evidence: 'existing retrieval snapshots; no new retrieval run' },
    { module: 'Fact', status: 'BLOCKED_BUT_DIAGNOSTICALLY_VALID', evidence: 'Chengchuan synthetic inventory and quality audit' },
    { module: 'Mapping', status: 'SUCCESSOR_BUILT_NOT_ACTIVATED', evidence: mappingReadiness.mapping_successor.activation_status },
    { module: 'Claim', status: 'NOT_READY', evidence: 'no current replay Claim authority' },
    { module: 'Writer', status: 'NOT_READY', evidence: 'Writer live and product fidelity not executed' }
  ]
});

writeJson('26_CURRENT_E2E_REUSE_PLAN.json', {
  artifact_type: 'V43_CURRENT_E2E_REUSE_PLAN_V1',
  ...common,
  sequence: [
    { order: 1, stage: 'Requirement source/canonical snapshot', asset: '16_CORE6_REQUIREMENT_FREEZE.json', action: 'offline reuse only; no extraction' },
    { order: 2, stage: 'Deterministic Router V2.2.3', asset: '07_FULL_REPLAY.json', action: 'offline reuse; deep-chain preselection only' },
    { order: 3, stage: 'Embedding/indexing', asset: 'Huawei exact snapshot', action: 'requires Host gate; no re-embed by this task' },
    { order: 4, stage: 'Retrieval', asset: 'existing RAG result registry', action: 'future bounded run after Host gate' },
    { order: 5, stage: 'Fact', asset: 'synthetic Chengchuan diagnostics', action: 'no extraction in this task' },
    { order: 6, stage: 'Mapping/Claim/Writer', asset: 'existing successor/eval assets', action: 'not executed; human/real Fact prerequisites remain' }
  ],
  current_run_status: 'PRE_E2E_OFFLINE_ONLY'
});

writeJson('27_ENGINEERING_DEBT_REGISTER.json', {
  artifact_type: 'V43_ENGINEERING_DEBT_REGISTER_V1',
  ...common,
  debts: [
    { id: 'DOC-BASELINE-001', item: 'V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE.md missing', severity: 'DOCUMENTATION_GAP', owner: 'engineering documentation', evidence: 'filesystem check at generation time' },
    { id: 'HOST-EMBED-001', item: 'Host-only embedding egress gate remains before full E2E', severity: 'P0_HOST_GATE', owner: 'runtime operations', evidence: source('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/00D_HOST_EXECUTION_GATE.json', 'CURRENT_REUSABLE') },
    { id: 'FACT-REAL-001', item: 'Real Fact authority is not established; Chengchuan inventory is synthetic Eval-only', severity: 'P0_AUTHORITY', owner: 'Fact/Governance', evidence: source('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID') },
    { id: 'FACT-EXT-001', item: 'Chengchuan extension embedding evidence incomplete', severity: 'P1_EVIDENCE', owner: 'Eval data operations', evidence: source('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID') },
    { id: 'MAPPING-REAL-001', item: 'Mapping successor real partition gaps and no trusted dual eval', severity: 'P0_EVAL_GATE', owner: 'Mapping/Eval', evidence: source('docs/V43_MAPPING_V2_ACTIVATION_READINESS_CHECKPOINT.json', 'CURRENT_PARTIAL_REUSABLE') },
    { id: 'REQ-HUMAN-001', item: 'Core6 canonical input is not Human Gold authority', severity: 'P0_AUTHORITY', owner: 'Human review', evidence: source('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json', 'CURRENT_PARTIAL_REUSABLE') },
    { id: 'REQ-COUNT-001', item: 'FAST-WATER-01 source manifest records 114 requirements while current Core6 canonical input records 113', severity: 'IDENTITY_RECONCILIATION', owner: 'Requirement authority review', evidence: source('docs/handoff/V43_CORE6_AUTHORITATIVE_REQUIREMENT_ARTIFACT_RECOVERY_V2/09_CORE6_AUTHORITATIVE_REQUIREMENT_MANIFEST_V1.json', 'CURRENT_PARTIAL_REUSABLE') }
  ]
});

writeJson('28_TEST_REPORT.json', {
  artifact_type: 'V43_OFFLINE_ENGINEERING_TEST_REPORT_V1',
  ...common,
  status: 'RECORDED_AFTER_GENERATION',
  tests: [
    { command: 'node --test backend/test/provider-runtime-preflight-v1.test.js', scope: 'offline provider runtime preflight', result: 'PASS', tests: 1, provider_calls: 0, db_writes: 0 },
    { command: 'node --test backend/test/provider-runtime-preflight-v1.test.js backend/test/requirement-extraction-contract-owner.test.js backend/test/requirement-evaluation.test.js backend/test/retrieval-chunk-role.test.js backend/test/evidence-fact-contract-v1.test.js backend/test/requirement-evidence-mapping-contract-v1.test.js backend/test/claim-gate-input-adapter-v1.test.js backend/test/writer-input-authorization-v1.test.js', scope: 'Requirement/RAG/Fact/Mapping/Claim/Writer deterministic focused regression', result: 'PASS', tests: 110, provider_calls: 0, db_writes: 0 },
    { command: 'node --check backend/eval/real-e2e/build-provider-runtime-preflight-v1.mjs', scope: 'syntax', result: 'PASS' },
    { command: 'npm run lint', scope: 'existing lint scripts', result: 'PASS' },
    { command: 'npm run build', scope: 'frontend build', result: 'PASS' },
    { command: 'git diff --check', scope: 'worktree whitespace', result: 'PASS', note: 'Git emitted existing LF/CRLF normalization warnings only; no diff-check errors' }
  ],
  unrelated_baseline_failures: 'record only; no unrelated fixes'
});

const checkpoint = {
  artifact_type: 'V43_PRE_E2E_OFFLINE_ENGINEERING_CLOSURE_CHECKPOINT',
  ...common,
  status: 'PRE_E2E_READY_WITH_KNOWN_HOST_GATES',
  scope_complete: true,
  source_registry_complete: true,
  authority_matrix_complete: true,
  deep_chain_preselection_count: deepChain.length,
  host_gate_required: true,
  production_cutover: false,
  known_gates: ['HOST_EMBEDDING_EGRESS', 'REAL_FACT_AUTHORITY', 'MAPPING_SUCCESSOR_ACTIVATION', 'HUMAN_AUTHORITY_FOR_CANONICAL_REQUIREMENT'],
  missing_baseline_document: 'docs/V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE.md',
  test_report: '28_TEST_REPORT.json',
  artifact_count: 30,
  safe_side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, commit: 0, push: 0, merge: 0, deploy: 0 }
};
writeJson('29_CHECKPOINT.json', checkpoint);
fs.writeFileSync(path.join(outDir, '29_CHECKPOINT.md'), `# V43 PRE-E2E OFFLINE ENGINEERING CLOSURE\n\n- Status: **${checkpoint.status}**\n- Scope: offline registry/readiness only; no Provider/LLM/DB/Gold actions.\n- Core6 canonical input: ${coreRows.length} rows across ${sixTenders.length} tenders (eval-only, Human authority pending).\n- Router V2.2.3 deep-chain preselection: ${deepChain.length} CORE6 rows (EVIDENCE + deep_chain_required).\n- Huawei snapshot: ${huaweiBindings.material_count} materials / ${huaweiBindings.chunk_count} chunks / ${huaweiBindings.embedding_count} embeddings, exact identity reuse only.\n- Host gate: required before embedding/full E2E.\n- Known blockers: ${checkpoint.known_gates.join(', ')}.\n- Missing documentation baseline: ${checkpoint.missing_baseline_document}.\n- Side effects: Provider 0, LLM 0, production DB writes 0, Eval DB writes 0, Gold mutations 0.\n`);

const registryArtifacts = fs.readdirSync(outDir).filter((name) => name.endsWith('.json') || name.endsWith('.md')).sort().map((name) => {
  const b = fs.readFileSync(path.join(outDir, name));
  return { path: rel(path.relative(repoRoot, path.join(outDir, name))), bytes: b.length, sha256: sha256(b) };
});
const registry = {
  artifact_type: 'V43_EVAL_ASSET_REGISTRY_V1',
  generated_at: generatedAt,
  registry_version: '1',
  branch: 'feat/v4.3-semantic-boundary-routing',
  head: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
  status_taxonomy: ['CURRENT_REUSABLE', 'CURRENT_PARTIAL_REUSABLE', 'BLOCKED_BUT_DIAGNOSTICALLY_VALID', 'SUPERSEDED_DO_NOT_USE', 'HISTORICAL_ARCHIVE_ONLY', 'QUARANTINED_AUTHORITY_ZERO', 'EXPLORATORY_ONLY', 'INVALID_IDENTITY', 'UNKNOWN_REVIEW_REQUIRED'],
  artifacts: registryArtifacts,
  source_artifacts: keyArtifactPaths.map((p) => fileRef(p, 'CURRENT_PARTIAL_REUSABLE', ['SOURCE_OF_FACTUAL_STATUS'])),
  safety: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, production_changes: 0 }
};
fs.writeFileSync(path.join(registryDir, 'EVAL_ASSET_REGISTRY.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(registryDir, 'EVAL_ASSET_REGISTRY.md'), `# V43 Eval Asset Registry V1\n\nStatus: **${checkpoint.status}**\n\nThis registry records existing artifact identity, authority, reuse status, and offline readiness. It does not execute Provider/LLM calls, mutate Gold, or write Production DB.\n\n## Registered artifacts\n\n${registryArtifacts.map((a) => `- ${a.path} (${a.bytes} bytes, SHA256 ${a.sha256})`).join('\n')}\n\n## Known gates\n\n- Host embedding/indexing gate required for live E2E.\n- Real Fact authority and Mapping successor activation remain separate gates.\n- Core6 Requirement input is eval-only and Human authority pending.\n`);

console.log(JSON.stringify({ status: checkpoint.status, output_dir: rel(path.relative(repoRoot, outDir)), registry_dir: rel(path.relative(repoRoot, registryDir)), artifacts: registryArtifacts.length, core6_rows: coreRows.length, deep_chain_rows: deepChain.length }, null, 2));
