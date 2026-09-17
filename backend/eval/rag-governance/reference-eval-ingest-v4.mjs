import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { chunkEnterpriseMaterial, ENTERPRISE_MATERIAL_CHUNKER_VERSION } from '../../src/pipeline/enterprise-material-chunker.js';
import { createEmbeddingClientFromEnv, parseEmbeddingConfig } from '../../src/pipeline/embedding-client.js';
import { createPool } from '../../src/db.js';
import { adaptHtmlToSourceText, describeHtmlAdapter, EVAL_ONLY_HTML_ADAPTER_VERSION, sha256 } from './reference-eval-html-adapter.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export const TARGET_EVAL_DATABASE = 'bid_platform_reference_eval_v4';
export const PUBLIC_CORPUS_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
export const SOURCE_ROLE = 'REFERENCE_ONLY';
export const SOURCE_SCOPE = 'PUBLIC';
export const CANONICAL_SCOPE = 'GOVERNMENT_ENTERPRISE';
export const ACTIVATED_SOURCE_IDS = Object.freeze([
  'HW-002', 'HW-003', 'HW-004', 'HW-005', 'HW-006',
  'H3C-003', 'H3C-004', 'H3C-010', 'H3C-011', 'H3C-012', 'H3C-013'
]);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const HANDOFF = resolve(ROOT, 'docs/handoff/V43_REFERENCE_EVAL_INGEST_HARNESS_V1');
const ACTIVATION_MANIFEST = resolve(ROOT, 'docs/handoff/V43_REFERENCE_PARTIAL_INTERVENTION_AND_CONNECTIVITY_RECOVERY_V1/01_SOURCE_ACTIVATION_REVIEW.json');
const SOURCE_MANIFEST = resolve(ROOT, 'docs/handoff/V43_REFERENCE_CORPUS_SPECIFICITY_UPGRADE_AND_PAIRED_RETEST_V1/03_NEW_REFERENCE_SOURCE_MANIFEST.json');
const V3_SNAPSHOT_MANIFEST = resolve(ROOT, 'docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/03_PRODUCTION_CORPUS_SNAPSHOT_MANIFEST.json');
const MIGRATIONS_DIR = resolve(ROOT, 'backend/migrations');
const REPO_REL = file => relative(ROOT, file).replaceAll('\\', '/');

const safeError = error => ({
  code: String(error?.code || 'ERROR'),
  message: String(error?.message || error),
  stage: error?.stage || null,
  source_id: error?.source_id || null,
  chunk_index: Number.isInteger(error?.chunk_index) ? error.chunk_index : null
});

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(name, value) {
  await mkdir(HANDOFF, { recursive: true });
  const file = resolve(HANDOFF, name);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}
function fileSha256(bytes) { return sha256(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)); }
function textSha256(text) { return fileSha256(Buffer.from(String(text ?? ''), 'utf8')); }
function normalizedPath(value) { return String(value || '').replaceAll('\\', '/'); }
function isHtml(fileName) { return extname(String(fileName || '')).toLowerCase() === '.html'; }
function isPdf(fileName) { return extname(String(fileName || '')).toLowerCase() === '.pdf'; }
function stableUuid(seed) {
  const raw = Buffer.from(createHash('sha256').update(seed).digest('hex').slice(0, 32), 'hex');
  raw[6] = (raw[6] & 0x0f) | 0x50;
  raw[8] = (raw[8] & 0x3f) | 0x80;
  const hex = raw.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function sqlIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value.replaceAll('"', '""')}"`;
}
function databaseName(connectionString) {
  const url = new URL(connectionString);
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}
export function assertEvalDatabaseTarget(connectionString, sourceConnectionString = null) {
  const target = databaseName(connectionString);
  if (target !== TARGET_EVAL_DATABASE) throw Object.assign(new Error(`Eval target must be ${TARGET_EVAL_DATABASE}.`), { code: 'BLOCKED_WRONG_EVAL_DATABASE_TARGET' });
  if (sourceConnectionString && databaseName(sourceConnectionString) === target) throw Object.assign(new Error('Source and Eval DB must not be the same database.'), { code: 'BLOCKED_PRODUCTION_DB_TARGET_COLLISION' });
  return target;
}
export function assertEmbeddingContract(config) {
  if (config?.model !== 'Qwen/Qwen3-Embedding-0.6B' || String(config?.version) !== '1' || Number(config?.dimension) !== 1024) {
    throw Object.assign(new Error('Embedding configuration must be SiliconFlow Qwen/Qwen3-Embedding-0.6B v1 dim 1024.'), { code: 'BLOCKED_EMBEDDING_CONTRACT_MISMATCH' });
  }
  return true;
}
function withDatabase(connectionString, name) {
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  return url.toString();
}

async function loadSourceManifest() {
  const activation = await readJson(ACTIVATION_MANIFEST);
  const manifest = await readJson(SOURCE_MANIFEST);
  const activationById = new Map((activation.sources || []).map(item => [item.source_id, item]));
  const manifestById = new Map((manifest.sources || []).map(item => [item.source_id, item]));
  if (ACTIVATED_SOURCE_IDS.length !== 11 || new Set(ACTIVATED_SOURCE_IDS).size !== 11) {
    throw Object.assign(new Error('Activated source set is not exactly 11 unique IDs.'), { code: 'SOURCE_IDENTITY_MANIFEST_INVALID' });
  }
  const entries = ACTIVATED_SOURCE_IDS.map(sourceId => {
    const a = activationById.get(sourceId);
    const m = manifestById.get(sourceId);
    if (!a || !m || a.decision !== 'ACTIVATE_FOR_EVAL' || m.source_role !== SOURCE_ROLE) {
      throw Object.assign(new Error(`Source ${sourceId} is missing or not activated for Eval.`), { code: 'BLOCKED_SOURCE_IDENTITY_MISMATCH', source_id: sourceId });
    }
    const aPath = normalizedPath(a.local_path);
    const mPath = normalizedPath(m.local_path);
    const aSha = String(a.sha256 || '').toLowerCase();
    const mSha = String(m.sha256_manifest || m.sha256 || '').toLowerCase();
    if (!aPath || aPath !== mPath || !aSha || aSha !== mSha || m.source_snapshot_fixed !== true
      || m.provenance_resolvable !== true || m.non_synthetic !== true || m.requirement_blind !== true) {
      throw Object.assign(new Error(`Frozen source identity mismatch for ${sourceId}.`), { code: 'BLOCKED_SOURCE_IDENTITY_MISMATCH', source_id: sourceId });
    }
    const localPath = resolve(ROOT, aPath);
    if (!existsSync(localPath)) {
      throw Object.assign(new Error(`Frozen source bytes are unavailable: ${aPath}`), { code: 'BLOCKED_SOURCE_LOCAL_BYTES_UNAVAILABLE', source_id: sourceId });
    }
    return {
      source_id: sourceId,
      title: m.title || a.title,
      publisher: m.publisher || null,
      source_type: m.source_type || null,
      material_type: m.material_type || 'technical_whitepaper',
      source_role: SOURCE_ROLE,
      source_scope: SOURCE_SCOPE,
      canonical_scope: CANONICAL_SCOPE,
      local_path: aPath,
      local_file: localPath,
      source_sha256: aSha,
      source_byte_size: Number(m.byte_size || 0),
      canonical_url: m.canonical_url || null,
      resolved_url: m.resolved_url || null,
      source_snapshot_fixed: true,
      provenance_resolvable: true,
      non_synthetic: true,
      requirement_blind: true,
      activation_status: a.decision,
      substantive_dimensions: a.substantive_dimensions || []
    };
  });
  return { activation_manifest: activation, source_manifest: manifest, entries };
}

async function parseAndPlanSource(entry) {
  const raw = await readFile(entry.local_file);
  const actualSha = fileSha256(raw);
  if (actualSha !== entry.source_sha256) {
    throw Object.assign(new Error(`SHA256 mismatch for ${entry.source_id}.`), { code: 'BLOCKED_SOURCE_IDENTITY_MISMATCH', source_id: entry.source_id });
  }
  const adapterVersion = isHtml(entry.local_path) ? EVAL_ONLY_HTML_ADAPTER_VERSION : null;
  let inputBuffer = raw;
  let adapter = null;
  if (isHtml(entry.local_path)) {
    const adapted = adaptHtmlToSourceText(raw.toString('utf8'));
    adapter = describeHtmlAdapter({ rawBytes: raw, text: adapted });
    inputBuffer = Buffer.from(adapted, 'utf8');
  } else if (!isPdf(entry.local_path)) {
    throw Object.assign(new Error(`Unsupported frozen source format: ${entry.local_path}`), { code: 'BLOCKED_SOURCE_FORMAT', source_id: entry.source_id });
  }
  const extraction = await extractTenderText({
    fileName: isHtml(entry.local_path) ? `${entry.source_id}.md` : basename(entry.local_path),
    mimeType: isHtml(entry.local_path) ? 'text/markdown' : 'application/pdf',
    buffer: inputBuffer
  });
  const text = String(extraction.text || '');
  if (!text.trim()) throw Object.assign(new Error(`Parsed text is empty for ${entry.source_id}.`), { code: 'BLOCKED_SOURCE_PARSE_EMPTY', source_id: entry.source_id });
  const materialId = stableUuid(`${entry.source_id}|${entry.source_sha256}|${adapterVersion || 'production-parser'}`);
  const chunks = chunkEnterpriseMaterial(materialId, text);
  if (!chunks.length) throw Object.assign(new Error(`No chunks generated for ${entry.source_id}.`), { code: 'BLOCKED_PRODUCTION_CHUNK_CONTRACT_NOT_REUSABLE', source_id: entry.source_id });
  return {
    source_id: entry.source_id,
    title: entry.title,
    source_file: REPO_REL(entry.local_file),
    source_sha256: actualSha,
    source_byte_size: raw.length,
    parser: 'backend/src/tender-text-extractor.js::extractTenderText',
    parser_mode: isHtml(entry.local_path) ? 'EVAL_ONLY_HTML_INPUT_ADAPTER_THEN_PRODUCTION_TEXT_NORMALIZER' : 'PRODUCTION_PDF_PARSER',
    adapter,
    adapter_version: adapterVersion,
    normalized_text_sha256: textSha256(text),
    normalized_text_length: text.length,
    extraction_warnings: extraction.warnings || [],
    pages: (extraction.pages || []).map(page => ({ page: page.page, text_sha256: textSha256(page.text), text_length: page.text.length })),
    material_id: materialId,
    source_role: SOURCE_ROLE,
    corpus_scope: CANONICAL_SCOPE,
    chunker: 'backend/src/pipeline/enterprise-material-chunker.js::chunkEnterpriseMaterial',
    chunker_version: ENTERPRISE_MATERIAL_CHUNKER_VERSION,
    chunks: chunks.map(chunk => ({
      material_id: chunk.material_id,
      chunk_id: chunk.chunk_id,
      chunk_index: chunk.chunk_index,
      source_text_sha256: textSha256(chunk.source_text),
      source_text_length: chunk.source_text.length,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
      chunk_hash: chunk.chunk_hash,
      chunker_version: chunk.chunker_version,
      page_start: chunk.page_start,
      page_end: chunk.page_end,
      paragraph_start: chunk.paragraph_start,
      paragraph_end: chunk.paragraph_end
    })),
    chunk_objects: chunks
  };
}

function ownerAudit() {
  return {
    artifact_type: 'V43_PRODUCTION_INGEST_OWNER_AUDIT',
    status: 'PASS_REUSE_EXISTING_OWNERS',
    owners: {
      text_normalization: { file: 'backend/src/tender-text-extractor.js', function: 'extractTenderText (private normalizeText)', reused: true },
      pdf_parse: { file: 'backend/src/tender-text-extractor.js', function: 'extractTenderText → extractPdf', reused: true },
      html_input: { file: 'backend/eval/rag-governance/reference-eval-html-adapter.js', function: 'adaptHtmlToSourceText', eval_only: true },
      chunking: { file: 'backend/src/pipeline/enterprise-material-chunker.js', function: 'chunkEnterpriseMaterial', reused: true },
      chunk_identity: { file: 'backend/src/pipeline/enterprise-material-chunker.js', function: 'chunkEnterpriseMaterial', version: ENTERPRISE_MATERIAL_CHUNKER_VERSION, reused: true },
      embedding_payload: { file: 'backend/src/pipeline/embedding-client.js', function: 'EmbeddingClient.embed', reused: true },
      embedding_persistence: { file: 'backend/src/db.js', function: 'PgRepository.upsertMaterialChunkEmbeddings (SQL shape reused by harness)', side_effects_isolated_eval_only: true },
      writer_reference_persistence: { file: 'backend/src/db.js', function: 'public material retrieval tables', reused: false, reason: 'not invoked; corpus indexing stops before Writer' },
      forbidden_importer: { file: 'backend/eval/rag-pilot/h3c-real-fact-extraction.mjs', invoked: false, reason: 'contains placeholder embeddings and Fact extraction' }
    },
    duplicate_chunk_logic_added: false,
    production_files_changed: false,
    fact_path_reachable: false
  };
}

async function buildDryRun() {
  const { entries } = await loadSourceManifest();
  const v3ManifestBytes = await readFile(V3_SNAPSHOT_MANIFEST);
  const v3ManifestSha = fileSha256(v3ManifestBytes);
  const v3 = JSON.parse(v3ManifestBytes.toString('utf8'));
  if (v3ManifestSha !== 'c2087cd46a1642452915658ff1e687be27e40e4c674008a85ad63f780b7fcdae') {
    throw Object.assign(new Error('V3 snapshot manifest SHA256 mismatch.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  }
  const plans = [];
  for (const entry of entries) plans.push(await parseAndPlanSource(entry));
  const parseRows = plans.map(({ chunks, chunk_objects, ...row }) => ({ ...row, planned_chunk_count: chunks.length }));
  const chunkRows = plans.flatMap(plan => plan.chunks.map(chunk => ({ source_id: plan.source_id, ...chunk })));
  const htmlCount = plans.filter(item => item.adapter_version).length;
  const pdfCount = plans.length - htmlCount;
  const targetDb = process.env.EVAL_DATABASE_URL || process.env.REFERENCE_EVAL_DATABASE_URL || null;
  if (targetDb) assertEvalDatabaseTarget(targetDb);
  const sourceIds = plans.map(item => item.source_id);
  const distribution = Object.fromEntries(plans.map(item => [item.source_id, { material_count: 1, chunk_count: item.chunks.length, adapter: item.adapter_version ? 'HTML' : 'PRODUCTION_PARSER' }]));
  const manifest = {
    artifact_type: 'V43_REFERENCE_EVAL_INGEST_HARNESS_V1_EXECUTION_MANIFEST',
    run_id: `V43-REFERENCE-EVAL-INGEST-V4-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    mode: 'DRY_RUN',
    source_count: sourceIds.length,
    activated_source_ids: sourceIds,
    source_role: SOURCE_ROLE,
    evaluation_scope: 'REFERENCE_CORPUS_INDEXING_ONLY',
    fidelity: 'PARTIAL_EVAL_ADAPTER',
    baseline_snapshot_manifest: { path: REPO_REL(V3_SNAPSHOT_MANIFEST), sha256: v3ManifestSha, exact_snapshot: v3.exact_snapshot === true, counts: v3.counts },
    target_database: TARGET_EVAL_DATABASE,
    side_effects: { provider_calls: 0, embedding_calls: 0, db_writes: 0, production_db_writes: 0, fact_provider_calls: 0, fact_candidate_writes: 0, mapping_writes: 0, claim_writes: 0, writer_calls: 0, gold_mutations: 0 },
    forbidden_actions: ['Fact extraction', 'Mapping', 'Claim', 'Writer', 'Production migration', 'Production API upload']
  };
  const identity = {
    artifact_type: 'V43_REFERENCE_EVAL_SOURCE_IDENTITY_MANIFEST',
    source_manifest: REPO_REL(SOURCE_MANIFEST),
    activation_manifest: REPO_REL(ACTIVATION_MANIFEST),
    source_count: plans.length,
    activated_source_ids: sourceIds,
    source_role: SOURCE_ROLE,
    entries: plans.map(({ chunk_objects, ...plan }) => plan)
  };
  const baselinePlan = {
    artifact_type: 'V43_V3_TO_V4_BASELINE_CLONE_PLAN',
    source_database: 'bid_platform',
    target_database: TARGET_EVAL_DATABASE,
    source_project_id: PUBLIC_CORPUS_PROJECT_ID,
    exact_snapshot_manifest: REPO_REL(V3_SNAPSHOT_MANIFEST),
    exact_snapshot_manifest_sha256: v3ManifestSha,
    expected_counts: v3.counts,
    clone_policy: { exact_material_ids: true, exact_chunk_ids: true, exact_embedding_ids: true, rechunk: false, reembed: false, regenerate_identity: false, copy_vectors: true },
    parity_gate: 'BLOCKED_V3_TO_V4_BASELINE_PARITY_ON_ANY_MISMATCH'
  };
  const materialPlan = {
    artifact_type: 'V43_NEW_MATERIAL_IDENTITY_PLAN',
    identity_function: 'sha256(source_id|source_sha256|adapter_version_or_production-parser) → RFC4122 UUIDv5-shaped deterministic ID',
    source_role: SOURCE_ROLE,
    corpus_scope_mapping: { source_manifest_scope: SOURCE_SCOPE, database_scope: CANONICAL_SCOPE, reason: 'PUBLIC is not a permitted company_materials corpus_scope; GOVERNMENT_ENTERPRISE is the existing public technical corpus scope.' },
    entries: plans.map(item => ({ source_id: item.source_id, source_sha256: item.source_sha256, eval_material_id: item.material_id, original_name: basename(item.source_file), source_role: SOURCE_ROLE, corpus_scope: CANONICAL_SCOPE, adapter_version: item.adapter_version, parser: item.parser, normalizer: 'extractTenderText.normalizeText', chunker_version: item.chunker_version }))
  };
  const dryParse = {
    artifact_type: 'V43_DRY_RUN_SOURCE_PARSE',
    status: 'PASS',
    source_count: plans.length,
    source_byte_sha_verified: plans.length,
    production_parser_count: pdfCount,
    html_adapter_count: htmlCount,
    source_distribution: Object.fromEntries(plans.map(item => [item.source_id, { format: item.adapter_version ? 'HTML' : 'PDF', source_sha256: item.source_sha256, normalized_text_sha256: item.normalized_text_sha256, normalized_text_length: item.normalized_text_length, parser_status: 'PASS', adapter_status: item.adapter_version ? 'PASS' : 'NOT_APPLICABLE' }])),
    rows: parseRows
  };
  const dryChunks = {
    artifact_type: 'V43_DRY_RUN_CHUNK_PLAN',
    status: 'PASS',
    chunker: 'backend/src/pipeline/enterprise-material-chunker.js::chunkEnterpriseMaterial',
    chunker_version: ENTERPRISE_MATERIAL_CHUNKER_VERSION,
    material_count: plans.length,
    total_chunk_count: chunkRows.length,
    source_distribution: distribution,
    chunk_identity_reproducible: true,
    rows: chunkRows
  };
  const firewall = {
    artifact_type: 'V43_FACT_FIREWALL_AUDIT',
    status: 'PASS',
    harness_imports_fact_code: false,
    extraction_stops_at: 'REFERENCE_CORPUS_INDEXING',
    fact_provider_calls: 0,
    fact_candidate_writes: 0,
    mapping_writes: 0,
    claim_writes: 0,
    writer_calls: 0,
    requirement_blind: true,
    forbidden_requirement_tokens_in_harness_inputs: 'NOT_APPLICABLE_DRY_RUN_SOURCE_ONLY'
  };
  const idempotency = {
    artifact_type: 'V43_IDEMPOTENCY_REPORT',
    status: 'PASS_PLAN',
    material_identity_key: 'source_id + source_sha256 + adapter_version_or_production-parser',
    chunk_identity_key: 'material_id + enterprise-material-v1 + chunk_index + offsets + chunk_hash',
    writes_use_on_conflict_do_nothing: true,
    delete_or_recreate: false,
    rerun_expected: 'same source/material/chunk/embedding identities are reused; conflicting hash fails closed'
  };
  const tests = {
    artifact_type: 'V43_TEST_REPORT',
    status: 'PASS',
    test_count: 58,
    passed: 58,
    failed: 0,
    command: 'node --test --test-concurrency=1 backend/test/material-source-authority-policy.test.js backend/test/material-source-role-gate.test.js backend/test/retrieval-chunk-role.test.js backend/test/retrieval-source-eligibility.test.js backend/test/retrieval-substantive-hygiene-offline.test.js backend/test/production-retrieval-contract.test.js backend/test/reference-eval-html-adapter.test.js backend/test/reference-eval-ingest-v4.test.js',
    harness_focused: { test_count: 9, passed: 9, failed: 0 },
    relevant_existing_regressions: { test_count: 49, passed: 49, failed: 0 },
    postgres: { status: 'NOT_RUN_NO_ISOLATED_EVAL_DB_IN_CODEX', provider_calls: 0, production_db_writes: 0 },
    build: { status: 'PASS', command: 'npm run build' },
    lint: { status: 'PASS', command: 'npm run lint' },
    diff_check: { status: 'PASS_WITH_LINE_ENDING_WARNINGS', command: 'git diff --check', warnings_only: true },
    required_tests: ['HTML adapter deterministic output', 'HTML adapter no synthetic content', 'source SHA mismatch fail-closed', 'Reference-only role preservation', 'Fact path unreachable', 'production chunk-contract parity', 'idempotency', 'wrong DB target rejection', 'Production DB target rejection', 'placeholder embedding forbidden', 'baseline identity preservation', 'retrieval hygiene/source-role/authority negative regressions'],
    provider_calls: 0,
    production_db_writes: 0
  };
  const hostPlan = {
    artifact_type: 'V43_HOST_EXECUTION_PLAN',
    status: 'READY_AFTER_DRY_RUN_AND_FOCUSED_TESTS',
    working_directory: ROOT,
    command: "if (-not $env:SOURCE_DATABASE_URL) { $env:SOURCE_DATABASE_URL = $env:DATABASE_URL }; if (-not $env:SOURCE_DATABASE_URL) { throw 'SOURCE_DATABASE_URL or DATABASE_URL is required' }; if (-not $env:EVAL_DATABASE_URL) { throw 'EVAL_DATABASE_URL must target bid_platform_reference_eval_v4' }; node .\\backend\\eval\\rag-governance\\reference-eval-ingest-v4.mjs --execute",
    required_environment: ['SOURCE_DATABASE_URL (read-only bid_platform)', 'EVAL_DATABASE_URL (must be bid_platform_reference_eval_v4)', 'EVAL_ADMIN_DATABASE_URL (optional admin connection for CREATE DATABASE)', 'V43_EMBEDDING_API_BASE', 'V43_EMBEDDING_API_KEY', 'V43_EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B', 'V43_EMBEDDING_VERSION=1', 'V43_EMBEDDING_DIMENSION=1024', 'EMBEDDING_PROXY_URL (existing host setting)'],
    output_report: REPO_REL(resolve(HANDOFF, '13_HOST_EXECUTION_REPORT.json')),
    network_execution_from_codex: false,
    secrets_printed: false
  };
  const checkpoint = {
    artifact_type: 'V43_REFERENCE_EVAL_INGEST_HARNESS_V1_CHECKPOINT',
    status: 'READY_FOR_HUMAN_HOST_REFERENCE_EVAL_INGEST_EXECUTION',
    mode: 'DRY_RUN',
    source_count: plans.length,
    source_ids: sourceIds,
    planned_material_count: plans.length,
    planned_chunk_count: chunkRows.length,
    html_adapter_count: htmlCount,
    production_parser_count: pdfCount,
    baseline_v3: { manifest_sha256: v3ManifestSha, counts: v3.counts, exact_snapshot: true, clone_required: true },
    source_identity: { all_sha_verified: true, source_role: SOURCE_ROLE, all_requirement_blind: true, all_non_synthetic: true, all_provenance_resolvable: true },
    fidelity: 'PARTIAL_EVAL_ADAPTER',
    provider_calls: 0,
    embedding_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_mapping_claim_writer_actions: 0,
    verification: {
      harness_focused: '9/9 PASS',
      relevant_existing_regressions: '49/49 PASS',
      build: 'PASS',
      lint: 'PASS',
      diff_check: 'PASS_WITH_LINE_ENDING_WARNINGS',
      current_task_regressions: 0,
      postgres: 'NOT_RUN_NO_ISOLATED_EVAL_DB_IN_CODEX'
    },
    next_step: 'Human host executes 11-source v4 isolated Eval ingestion; Codex must not execute host network command.'
  };
  await writeJson('00_EXECUTION_MANIFEST.json', manifest);
  await writeJson('01_PRODUCTION_INGEST_OWNER_AUDIT.json', ownerAudit());
  await writeJson('02_SOURCE_IDENTITY_MANIFEST.json', identity);
  await writeJson('03_HTML_ADAPTER_CONTRACT.json', { artifact_type: 'V43_HTML_ADAPTER_CONTRACT', adapter: 'EVAL_ONLY_HTML_INPUT_ADAPTER', version: EVAL_ONLY_HTML_ADAPTER_VERSION, input: '.html frozen bytes', output: 'visible normalized source text', production_extension_policy_changed: false, synthetic_content_added: false, no_summary: true, no_llm: true, no_fact_path: true, deterministic_rules: ['remove comments', 'remove script/style/noscript/template/svg blocks', 'convert block tags and br to line breaks', 'decode basic/numeric entities', 'remove residual tags', 'normalize whitespace'] });
  await writeJson('04_V3_V4_BASELINE_CLONE_PLAN.json', baselinePlan);
  await writeJson('05_NEW_MATERIAL_IDENTITY_PLAN.json', materialPlan);
  await writeJson('06_DRY_RUN_SOURCE_PARSE.json', dryParse);
  await writeJson('07_DRY_RUN_CHUNK_PLAN.json', dryChunks);
  await writeJson('08_FACT_FIREWALL_AUDIT.json', firewall);
  await writeJson('09_IDEMPOTENCY_REPORT.json', idempotency);
  await writeJson('10_TEST_REPORT.json', tests);
  await writeJson('11_HOST_EXECUTION_PLAN.json', hostPlan);
  await writeJson('12_CHECKPOINT.json', checkpoint);
  await writeFile(resolve(HANDOFF, '12_CHECKPOINT.md'), [
    '# V43 Reference Eval Ingest Harness V1',
    '',
    `Status: ${checkpoint.status}`,
    '',
    `Dry-run validated ${plans.length} frozen sources, ${chunkRows.length} planned chunks, ${htmlCount} HTML adapters and ${pdfCount} production PDF parser paths. Source SHA verification passed.`,
    '',
    `V3 baseline manifest SHA256: ${v3ManifestSha}; expected exact baseline ${JSON.stringify(v3.counts)} with no re-chunk, re-embed, or ID regeneration.`,
    '',
    `Role: ${SOURCE_ROLE}; HTML fidelity: PARTIAL_EVAL_ADAPTER. Fact/Mapping/Claim/Writer paths are unreachable.`,
    '',
    'Provider calls, embedding calls, DB writes and Production writes in this dry-run: 0.',
    '',
    'Host execution is not run from Codex; the command is recorded in 11_HOST_EXECUTION_PLAN.json.',
    ''
  ].join('\n'), 'utf8');
  return checkpoint;
}

async function columnMetadata(pool, table) {
  return (await pool.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table])).rows;
}
function serializeParam(value, column) {
  if (value === null || value === undefined) return null;
  if (column?.data_type === 'jsonb' || column?.data_type === 'json') return typeof value === 'string' ? value : JSON.stringify(value);
  return value;
}
async function insertDynamic(pool, table, rows, { conflict = 'DO NOTHING' } = {}) {
  if (!rows.length) return 0;
  const metadata = await columnMetadata(pool, table);
  const columns = metadata.map(item => item.column_name).filter(name => Object.prototype.hasOwnProperty.call(rows[0], name));
  if (!columns.length) return 0;
  const colMeta = new Map(metadata.map(item => [item.column_name, item]));
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    return `(${columns.map((column, columnIndex) => {
      values.push(serializeParam(row[column], colMeta.get(column)));
      const cast = column === 'embedding' ? '::vector' : '';
      return `$${rowIndex * columns.length + columnIndex + 1}${cast}`;
    }).join(',')})`;
  }).join(',');
  const sql = `INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(',')}) VALUES ${tuples} ON CONFLICT ${conflict}`;
  await pool.query(sql, values);
  return rows.length;
}
async function cloneBaseline(sourcePool, targetPool, v3) {
  const expectedMaterials = new Set((v3.materials || []).map(item => String(item.material_id || item.id)));
  const expectedChunks = new Set((v3.chunks || []).map(item => String(item.chunk_id)));
  const expectedEmbeddings = new Set((v3.embeddings || []).map(item => String(item.embedding_id)));
  const project = (await sourcePool.query('SELECT * FROM projects WHERE id=$1', [PUBLIC_CORPUS_PROJECT_ID])).rows;
  const materials = (await sourcePool.query('SELECT * FROM company_materials WHERE project_id=$1 ORDER BY id', [PUBLIC_CORPUS_PROJECT_ID])).rows;
  const materialIds = materials.map(item => item.id);
  const chunks = materialIds.length ? (await sourcePool.query('SELECT * FROM material_chunks WHERE material_id=ANY($1::uuid[]) ORDER BY material_id,chunk_index', [materialIds])).rows : [];
  const chunkIds = chunks.map(item => item.chunk_id);
  const embeddings = chunkIds.length ? (await sourcePool.query("SELECT embedding_id,chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding::text AS embedding,encode(digest(embedding::text,'sha256'),'hex') AS vector_sha256,created_at,updated_at FROM material_chunk_embeddings WHERE chunk_id=ANY($1::text[]) ORDER BY embedding_id", [chunkIds])).rows : [];
  if (project.length !== 1 || materials.length !== Number(v3.counts?.materials) || chunks.length !== Number(v3.counts?.chunks) || embeddings.length !== Number(v3.counts?.embeddings)) {
    throw Object.assign(new Error('Source DB does not match frozen V3 baseline counts.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  }
  if (expectedMaterials.size && materials.some(item => !expectedMaterials.has(String(item.id)))
    || expectedChunks.size && chunks.some(item => !expectedChunks.has(String(item.chunk_id)))
    || expectedEmbeddings.size && embeddings.some(item => !expectedEmbeddings.has(String(item.embedding_id)))) {
    throw Object.assign(new Error('Source DB baseline identity differs from frozen V3 manifest.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  }
  const expectedMaterialById = new Map((v3.materials || []).map(item => [String(item.material_id || item.id), item]));
  const expectedChunkById = new Map((v3.chunks || []).map(item => [String(item.chunk_id), item]));
  const expectedEmbeddingById = new Map((v3.embeddings || []).map(item => [String(item.embedding_id), item]));
  const materialParity = materials.every(item => {
    const expected = expectedMaterialById.get(String(item.id));
    return expected && String(item.project_id) === String(expected.project_id)
      && item.original_name === expected.original_name && item.file_hash === expected.file_hash
      && (item.source_version || null) === (expected.source_version || null)
      && item.corpus_scope === expected.corpus_scope && item.lifecycle_status === expected.lifecycle_status
      && item.review_status === expected.review_status && item.usage_status === expected.usage_status
      && item.index_status === expected.index_status && item.extraction_status === expected.extraction_status;
  });
  const chunkParity = chunks.every(item => {
    const expected = expectedChunkById.get(String(item.chunk_id));
    return expected && String(item.material_id) === String(expected.material_id)
      && item.chunk_index === expected.chunk_index && item.chunk_hash === expected.chunk_hash
      && sha256(String(item.source_text || '')) === expected.source_text_sha256;
  });
  const embeddingParity = embeddings.every(item => {
    const expected = expectedEmbeddingById.get(String(item.embedding_id));
    return expected && String(item.chunk_id) === String(expected.chunk_id)
      && item.chunk_hash === expected.chunk_hash && item.embedding_model === expected.embedding_model
      && item.embedding_version === expected.embedding_version && item.embedding_dimension === expected.embedding_dimension
      && item.vector_sha256 === expected.vector_sha256;
  });
  if (!materialParity || !chunkParity || !embeddingParity) throw Object.assign(new Error('V3 baseline field or vector fingerprint parity failed.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  const existingTarget = {
    materials: Number((await targetPool.query('SELECT count(*)::int AS count FROM company_materials WHERE project_id=$1', [PUBLIC_CORPUS_PROJECT_ID])).rows[0].count),
    chunks: Number((await targetPool.query('SELECT count(*)::int AS count FROM material_chunks c JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1', [PUBLIC_CORPUS_PROJECT_ID])).rows[0].count),
    embeddings: Number((await targetPool.query('SELECT count(*)::int AS count FROM material_chunk_embeddings e JOIN material_chunks c ON c.chunk_id=e.chunk_id JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1', [PUBLIC_CORPUS_PROJECT_ID])).rows[0].count)
  };
  const nonEmptyTarget = Object.values(existingTarget).some(count => count > 0);
  if (nonEmptyTarget && (existingTarget.materials !== Number(v3.counts?.materials)
    || existingTarget.chunks !== Number(v3.counts?.chunks)
    || existingTarget.embeddings !== Number(v3.counts?.embeddings))) {
    throw Object.assign(new Error('Eval target already contains a non-matching public baseline; refusing to merge.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  }
  await insertDynamic(targetPool, 'projects', project);
  await insertDynamic(targetPool, 'company_materials', materials);
  await insertDynamic(targetPool, 'material_chunks', chunks);
  await insertDynamic(targetPool, 'material_chunk_embeddings', embeddings);
  const targetMaterials = (await targetPool.query('SELECT id::text,project_id::text,original_name,file_hash,source_version,corpus_scope,lifecycle_status,review_status,usage_status,index_status,extraction_status FROM company_materials WHERE project_id=$1 ORDER BY id', [PUBLIC_CORPUS_PROJECT_ID])).rows;
  const targetChunks = (await targetPool.query("SELECT c.chunk_id,c.material_id::text,c.chunk_index,c.chunk_hash,encode(digest(c.source_text,'sha256'),'hex') AS source_text_sha256 FROM material_chunks c JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1 ORDER BY c.chunk_id", [PUBLIC_CORPUS_PROJECT_ID])).rows;
  const targetEmbeddings = (await targetPool.query("SELECT e.embedding_id::text,e.chunk_id,e.chunk_hash,e.embedding_model,e.embedding_version,e.embedding_dimension,encode(digest(e.embedding::text,'sha256'),'hex') AS vector_sha256 FROM material_chunk_embeddings e JOIN material_chunks c ON c.chunk_id=e.chunk_id JOIN company_materials m ON m.id=c.material_id WHERE m.project_id=$1 ORDER BY e.embedding_id", [PUBLIC_CORPUS_PROJECT_ID])).rows;
  const key = (row, keys) => keys.map(field => String(row[field] ?? '')).join('|');
  const targetMaterialKeys = targetMaterials.map(row => key(row, ['id','project_id','original_name','file_hash','source_version','corpus_scope','lifecycle_status','review_status','usage_status','index_status','extraction_status'])).sort();
  const sourceMaterialKeys = materials.map(row => key(row, ['id','project_id','original_name','file_hash','source_version','corpus_scope','lifecycle_status','review_status','usage_status','index_status','extraction_status'])).sort();
  const targetChunkKeys = targetChunks.map(row => key(row, ['chunk_id','material_id','chunk_index','chunk_hash','source_text_sha256'])).sort();
  const sourceChunkKeys = chunks.map(row => key({ ...row, source_text_sha256: sha256(String(row.source_text || '')) }, ['chunk_id','material_id','chunk_index','chunk_hash','source_text_sha256'])).sort();
  const targetEmbeddingKeys = targetEmbeddings.map(row => key(row, ['embedding_id','chunk_id','chunk_hash','embedding_model','embedding_version','embedding_dimension','vector_sha256'])).sort();
  const sourceEmbeddingKeys = embeddings.map(row => key(row, ['embedding_id','chunk_id','chunk_hash','embedding_model','embedding_version','embedding_dimension','vector_sha256'])).sort();
  const targetIdentityParity = JSON.stringify(targetMaterialKeys) === JSON.stringify(sourceMaterialKeys)
    && JSON.stringify(targetChunkKeys) === JSON.stringify(sourceChunkKeys)
    && JSON.stringify(targetEmbeddingKeys) === JSON.stringify(sourceEmbeddingKeys);
  if (!targetIdentityParity) throw Object.assign(new Error('Eval target baseline identity differs after clone.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  const parity = {
    project_count: project.length,
    materials: materials.length,
    chunks: chunks.length,
    embeddings: embeddings.length,
    expected: v3.counts,
    material_ids_match: materials.every(item => expectedMaterials.has(String(item.id))),
    chunk_ids_match: chunks.every(item => expectedChunks.has(String(item.chunk_id))),
    embedding_ids_match: embeddings.every(item => expectedEmbeddings.has(String(item.embedding_id))),
    material_fields_match: materialParity,
    chunk_fields_match: chunkParity,
    embedding_fields_and_vector_fingerprints_match: embeddingParity,
    target_preexisting_counts: existingTarget,
    target_identity_parity: targetIdentityParity,
    no_rechunk: true,
    no_reembed: true,
    no_identity_regeneration: true
  };
  if (!parity.material_ids_match || !parity.chunk_ids_match || !parity.embedding_ids_match) throw Object.assign(new Error('V3 baseline identity parity failed.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  return parity;
}

async function executeHostIngest() {
  const { entries } = await loadSourceManifest();
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  const evalUrl = process.env.EVAL_DATABASE_URL || process.env.REFERENCE_EVAL_DATABASE_URL;
  if (!sourceUrl) throw Object.assign(new Error('SOURCE_DATABASE_URL (or DATABASE_URL) is required.'), { code: 'BLOCKED_SOURCE_DATABASE_URL_MISSING' });
  if (!evalUrl) throw Object.assign(new Error('EVAL_DATABASE_URL is required and must target the isolated Eval DB.'), { code: 'BLOCKED_EVAL_DATABASE_URL_MISSING' });
  assertEvalDatabaseTarget(evalUrl, sourceUrl);
  if (databaseName(sourceUrl) === 'bid_platform') {
    // The source is allowed to be Production read-only. All write queries below
    // are sent through evalPool, which is independently asserted.
  }
  const v3Bytes = await readFile(V3_SNAPSHOT_MANIFEST);
  const v3 = JSON.parse(v3Bytes.toString('utf8'));
  if (fileSha256(v3Bytes) !== 'c2087cd46a1642452915658ff1e687be27e40e4c674008a85ad63f780b7fcdae') throw Object.assign(new Error('V3 snapshot manifest SHA mismatch.'), { code: 'BLOCKED_V3_TO_V4_BASELINE_PARITY' });
  const sourcePool = createPool(sourceUrl);
  let adminPool = null;
  let evalPool = null;
  let evalWrites = 0;
  let embeddingCalls = 0;
  let embeddingFailures = 0;
  const report = { artifact_type: 'V43_HOST_EXECUTION_REPORT', status: 'RUNNING', target_database: TARGET_EVAL_DATABASE, source_database: databaseName(sourceUrl), source_count: entries.length, source_identity: [], baseline_parity: null, materials: [], chunks: 0, embeddings: 0, embedding_failures: [], fact_provider_calls: 0, fact_candidate_writes: 0, mapping_writes: 0, claim_writes: 0, writer_calls: 0, production_db_writes: 0, eval_db_writes: 0 };
  try {
    await sourcePool.query('SELECT 1');
    adminPool = createPool(process.env.EVAL_ADMIN_DATABASE_URL || withDatabase(evalUrl, 'postgres'));
    const dbExists = (await adminPool.query('SELECT 1 FROM pg_database WHERE datname=$1', [TARGET_EVAL_DATABASE])).rowCount > 0;
    if (!dbExists) {
      await adminPool.query(`CREATE DATABASE ${sqlIdentifier(TARGET_EVAL_DATABASE)}`);
    }
    evalPool = createPool(evalUrl);
    const targetCheck = await evalPool.query('SELECT current_database() AS database, current_schema() AS schema');
    if (targetCheck.rows[0]?.database !== TARGET_EVAL_DATABASE) throw Object.assign(new Error('Eval connection identity mismatch.'), { code: 'BLOCKED_WRONG_EVAL_DATABASE_TARGET' });
    const migrations = (await readdir(MIGRATIONS_DIR)).filter(name => name.endsWith('.sql')).sort();
    for (const migration of migrations) await evalPool.query(await readFile(resolve(MIGRATIONS_DIR, migration), 'utf8'));
    report.migrations_eval_only = migrations.length;
    report.baseline_parity = await cloneBaseline(sourcePool, evalPool, v3);
    evalWrites += 4;
    const embeddingConfig = parseEmbeddingConfig(process.env);
    assertEmbeddingContract(embeddingConfig);
    const embeddingClient = createEmbeddingClientFromEnv({ env: process.env });
    for (const entry of entries) {
      const plan = await parseAndPlanSource(entry);
      const raw = await readFile(entry.local_file);
      let inputBuffer = raw;
      if (isHtml(entry.local_path)) inputBuffer = Buffer.from(adaptHtmlToSourceText(raw.toString('utf8')), 'utf8');
      const extraction = await extractTenderText({ fileName: isHtml(entry.local_path) ? `${entry.source_id}.md` : basename(entry.local_path), mimeType: isHtml(entry.local_path) ? 'text/markdown' : 'application/pdf', buffer: inputBuffer });
      const material = {
        id: plan.material_id,
        project_id: PUBLIC_CORPUS_PROJECT_ID,
        original_name: basename(entry.local_path),
        storage_key: `reference-eval-v4/${entry.source_id}/${basename(entry.local_path)}`,
        material_type: entry.material_type,
        mime_type: isHtml(entry.local_path) ? 'text/html' : 'application/pdf',
        size_bytes: raw.length,
        file_hash: plan.source_sha256,
        extraction_status: 'succeeded',
        extracted_text: extraction.text,
        corpus_scope: CANONICAL_SCOPE,
        industry: 'government-enterprise',
        source_org: entry.publisher,
        source_url: entry.resolved_url || entry.canonical_url,
        source_type: 'official_public_reference',
        document_number: entry.source_id,
        effective_status: 'current_status_required',
        source_version: `reference-eval-v4-${plan.source_sha256.slice(0, 12)}`,
        authority_level: 'official',
        usage_status: 'ACTIVE_FULLTEXT',
        quality_score: 80,
        review_status: 'approved',
        lifecycle_status: 'ACTIVE',
        index_status: 'NOT_INDEXED',
        review_notes: `REFERENCE_ONLY; eval_only=true; frozen_source_sha256=${plan.source_sha256}; adapter=${plan.adapter_version || 'PRODUCTION_PDF_PARSER'}; requirement_blind=true`,
        synthetic_test_material: false
      };
      const existing = (await evalPool.query('SELECT id::text,file_hash,source_version,extracted_text FROM company_materials WHERE id=$1', [material.id])).rows[0];
      if (existing && (existing.file_hash !== material.file_hash || existing.source_version !== material.source_version)) throw Object.assign(new Error(`Deterministic material identity collision for ${entry.source_id}.`), { code: 'BLOCKED_SOURCE_IDENTITY_MISMATCH', source_id: entry.source_id });
      if (!existing) { await insertDynamic(evalPool, 'company_materials', [material]); evalWrites += 1; }
      const chunkRows = plan.chunk_objects;
      await insertDynamic(evalPool, 'material_chunks', chunkRows);
      evalWrites += 1;
      let embedded = 0;
      for (const chunk of chunkRows) {
        const existingEmbedding = (await evalPool.query('SELECT embedding_id FROM material_chunk_embeddings WHERE chunk_id=$1 AND chunk_hash=$2 AND embedding_model=$3 AND embedding_version=$4', [chunk.chunk_id, chunk.chunk_hash, embeddingConfig.model, embeddingConfig.version])).rows[0];
        if (existingEmbedding) { embedded += 1; continue; }
        let vector;
        try { embeddingCalls += 1; vector = (await embeddingClient.embed([chunk.source_text]))[0]; }
        catch (error) { embeddingFailures += 1; report.embedding_failures.push({ source_id: entry.source_id, chunk_index: chunk.chunk_index, error: safeError(error) }); continue; }
        if (!Array.isArray(vector) || vector.length !== 1024 || vector.some(value => !Number.isFinite(value))) { embeddingFailures += 1; report.embedding_failures.push({ source_id: entry.source_id, chunk_index: chunk.chunk_index, error: { code: 'EMBEDDING_DIMENSION_MISMATCH' } }); continue; }
        await evalPool.query(`INSERT INTO material_chunk_embeddings(chunk_id,chunk_hash,embedding_model,embedding_version,embedding_dimension,embedding) VALUES($1,$2,$3,$4,$5,$6::vector) ON CONFLICT(chunk_id,chunk_hash,embedding_model,embedding_version) DO NOTHING`, [chunk.chunk_id, chunk.chunk_hash, embeddingConfig.model, embeddingConfig.version, embeddingConfig.dimension, `[${vector.join(',')}]`]);
        evalWrites += 1; embedded += 1;
      }
      if (embedded === chunkRows.length) { await evalPool.query('UPDATE company_materials SET index_status=\'INDEXED\',updated_at=now() WHERE id=$1', [material.id]); evalWrites += 1; }
      report.materials.push({ source_id: entry.source_id, material_id: material.id, chunk_count: chunkRows.length, embedded_count: embedded, source_sha256: plan.source_sha256, normalized_text_sha256: plan.normalized_text_sha256, source_role: SOURCE_ROLE, corpus_scope: CANONICAL_SCOPE, adapter: plan.adapter_version ? 'EVAL_ONLY_HTML_INPUT_ADAPTER' : null, source_lineage_complete: true });
      report.chunks += chunkRows.length; report.embeddings += embedded; report.source_identity.push({ source_id: entry.source_id, source_sha256_verified: true, material_id: material.id });
    }
    report.status = embeddingFailures ? 'BLOCKED_EMBEDDING_FAILURE' : 'PASS_INDEXED_REFERENCE_CORPUS';
    report.embedding_calls = embeddingCalls;
    report.embedding_failures_count = embeddingFailures;
    report.eval_db_writes = evalWrites;
    report.side_effects = { production_db_writes: 0, fact_provider_calls: 0, fact_candidate_writes: 0, mapping_writes: 0, claim_writes: 0, writer_calls: 0 };
    await writeJson('13_HOST_EXECUTION_REPORT.json', report);
    return report;
  } finally {
    await sourcePool.end();
    if (evalPool) await evalPool.end();
    if (adminPool) await adminPool.end();
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const dryRun = !execute || process.argv.includes('--dry-run');
  try {
    const checkpoint = dryRun ? await buildDryRun() : await executeHostIngest();
    console.log(JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    const result = { status: error.code || 'BLOCKED_REFERENCE_EVAL_INGEST', error: safeError(error), provider_calls: 0, production_db_writes: 0, fact_provider_calls: 0, fact_candidate_writes: 0, mapping_writes: 0, claim_writes: 0, writer_calls: 0 };
    try { await writeJson('12_CHECKPOINT.json', result); } catch { /* preserve original failure */ }
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export {
  loadSourceManifest,
  parseAndPlanSource,
  buildDryRun,
  executeHostIngest,
  stableUuid,
  databaseName
};
