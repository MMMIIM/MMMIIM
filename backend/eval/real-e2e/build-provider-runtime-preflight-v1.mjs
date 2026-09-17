import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(SCRIPT_DIR, '../../..');
export const E2E_DIR = join(REPO, 'docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1');

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const repoPath = value => relative(REPO, value).replaceAll('\\', '/');
const safeJson = value => JSON.stringify(value, null, 2) + '\n';

function parseEnvText(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    let value = match[2];
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

const SECRET_KEY = /(KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL|BEARER|DATABASE_URL)/i;
function envProfile(file, values) {
  const source = existsSync(file) ? values : {};
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key,
    SECRET_KEY.test(key)
      ? { present: Boolean(String(value).trim()), value: '<REDACTED>' }
      : { present: Boolean(String(value).trim()), value: String(value).length > 180 ? `${String(value).slice(0, 180)}…` : String(value) }
  ]));
}

function gitOutput(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; }
}

async function readJson(relativePath) {
  const full = join(REPO, relativePath);
  if (!existsSync(full)) return null;
  try { return JSON.parse(await readFile(full, 'utf8')); } catch { return null; }
}

function artifactEvidence(relativePath, value) {
  return { path: relativePath, exists: value !== null, sha256: value === null ? null : sha256(JSON.stringify(value)) };
}

function providerOwners({ backendEnv, gatewayEnv }) {
  const gatewayProvider = gatewayEnv.SEMANTIC_GATEWAY_PROVIDER || null;
  const gatewayModel = gatewayEnv.SEMANTIC_GATEWAY_MODEL || null;
  const gatewayBase = gatewayEnv.SEMANTIC_GATEWAY_PROVIDER_API_BASE || null;
  const deepseekBase = gatewayEnv.DEEPSEEK_OFFICIAL_API_BASE || null;
  const deepseekModel = gatewayEnv.DEEPSEEK_OFFICIAL_FACT_MODEL || null;
  const generationProvider = backendEnv.GENERATION_PROVIDER || null;
  return [
    {
      stage: 'Embedding',
      owner_module: 'backend/src/pipeline/embedding-client.js',
      service_consumer: 'backend/src/pipeline/enterprise-retrieval-service.js',
      provider: 'siliconflow',
      model: backendEnv.V43_EMBEDDING_MODEL || null,
      api_base_source: 'backend/.env:V43_EMBEDDING_API_BASE',
      api_base_host: (() => { try { return new URL(backendEnv.V43_EMBEDDING_API_BASE).hostname; } catch { return null; } })(),
      endpoint: '/embeddings',
      network_required: true,
      current_execution_environment: 'backend process / Host required for live external HTTPS in this task',
      transport_from_current_backend_env: backendEnv.EMBEDDING_PROXY_URL ? 'SOCKS5_PROXY' : 'DIRECT_HTTPS',
      offline_or_replay_path: 'backend/scripts/smoke-embedding.js; backend/eval/real-e2e/run-retrieval-smoke-utf8.mjs',
      host_execution_script: 'backend/scripts/smoke-embedding.js',
      reusable_stored_artifacts: [
        'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json',
        'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json'
      ]
    },
    {
      stage: 'Fact semantic extraction',
      owner_module: 'backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js',
      service_consumer: 'backend/src/evidence-source-fact-service.js',
      provider: 'deepseek_official (task-specific gateway provider)',
      model: deepseekModel,
      api_base_source: 'services/semantic-gateway/.env:DEEPSEEK_OFFICIAL_API_BASE',
      api_base_host: (() => { try { return new URL(deepseekBase).hostname; } catch { return null; } })(),
      endpoint: '/responses',
      network_required: true,
      current_execution_environment: 'semantic-gateway task provider',
      gateway_default_provider: gatewayProvider,
      gateway_default_model: gatewayModel,
      offline_or_replay_path: 'backend/eval/rag-pilot/fact-candidate-v2-1-fixed12-runner.mjs; backend/test/evidence-fact-candidate-v2-2.test.js',
      host_execution_script: 'backend/eval/rag-pilot/deepseek-official-fact3-runner.mjs',
      reusable_stored_artifacts: ['docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json', 'docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_QUALITY_AUDIT.json']
    },
    {
      stage: 'Mapping semantic evaluation',
      owner_module: 'backend/src/pipeline/semantic-gateway-mapping-evaluator.js',
      service_consumer: 'backend/src/requirement-evidence-fact-mapping-service.js',
      provider: gatewayProvider || 'semantic_gateway',
      model: gatewayModel,
      api_base_source: 'services/semantic-gateway/.env:SEMANTIC_GATEWAY_PROVIDER_API_BASE',
      api_base_host: (() => { try { return new URL(gatewayBase).hostname; } catch { return null; } })(),
      endpoint: 'semantic gateway task requirement_evidence_mapping',
      network_required: true,
      current_execution_environment: 'backend semantic gateway client',
      offline_or_replay_path: 'backend/eval/mapping-benchmark-v1/mapping-eval-runner.js; backend/test/mapping-eval-v1.test.js',
      host_execution_script: null,
      reusable_stored_artifacts: ['backend/eval/mapping-benchmark-v1/results']
    },
    {
      stage: 'Claim generation and gate',
      owner_module: 'backend/src/pipeline/production-task-provider.js; backend/src/pipeline/claim-gate-service.js',
      service_consumer: 'backend/src/pipeline/claim-gate-service.js',
      provider: generationProvider === 'semantic_gateway' ? 'semantic_gateway' : (generationProvider || 'mock'),
      model: null,
      api_base_source: generationProvider === 'semantic_gateway' ? 'backend/.env:V43_CLAIM_GATEWAY_API_BASE (if configured)' : null,
      api_base_host: null,
      endpoint: 'semantic gateway task claim_generation; deterministic claim gate after response',
      network_required: generationProvider === 'semantic_gateway',
      current_execution_environment: 'backend production-task provider plus deterministic Claim Gate',
      offline_or_replay_path: 'backend/test/claim-gate-targeted-remediation.test.js; backend/eval/claim-eval-v1/runner.js',
      host_execution_script: null,
      reusable_stored_artifacts: ['backend/eval/claim-eval-v1/results']
    },
    {
      stage: 'Writer',
      owner_module: 'backend/src/pipeline/writer-provider.js; backend/src/writer-execution-service.js',
      service_consumer: 'backend/src/pipeline/document-generation-service.js',
      provider: generationProvider === 'semantic_gateway' ? 'semantic_gateway' : (generationProvider || 'mock'),
      model: null,
      api_base_source: generationProvider === 'semantic_gateway' ? 'backend/.env:V43_WRITER_GATEWAY_API_BASE / V43_REVISION_GATEWAY_API_BASE' : null,
      api_base_host: null,
      endpoint: 'semantic gateway tasks section_drafting / targeted_revision',
      network_required: generationProvider === 'semantic_gateway',
      current_execution_environment: 'backend document generation service',
      offline_or_replay_path: 'backend/src/writer-execution-service.js deterministic path; backend/test/writer-eval-provider-off-foundation.test.js',
      host_execution_script: null,
      reusable_stored_artifacts: ['backend/eval/gold-human-review/v2/writer']
    }
  ];
}

function dependencyMap() {
  return [
    { stage: 'Requirement', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'OFFLINE_REUSE_READY_HOST_FOR_LIVE', evidence: ['docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/05_REQUIREMENT_REPORT.json', 'backend/src/pipeline/requirement-extraction.js'] },
    { stage: 'Router', network_required: false, can_run_in_codex: true, can_reuse_artifact: true, host_required: false, status: 'DETERMINISTIC_OFFLINE_READY', evidence: ['backend/src/pipeline/requirement-response-router-v2-2-3.js', 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_HANDOFF'] },
    { stage: 'Evidence retrieval', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'REUSE_VECTORS_FOR_EXISTING_CORPUS_HOST_FOR_QUERY_OR_INDEX', evidence: ['backend/src/pipeline/embedding-client.js', 'backend/src/pipeline/enterprise-retrieval-service.js', 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json'] },
    { stage: 'Fact', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'OFFLINE_VALIDATION_READY_HOST_FOR_PROVIDER', evidence: ['backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js', 'services/semantic-gateway/src/gateway.js'] },
    { stage: 'Mapping', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'DETERMINISTIC_PREP_READY_SEMANTIC_GATEWAY_HOST_FOR_LIVE', evidence: ['backend/src/pipeline/semantic-gateway-mapping-evaluator.js', 'backend/eval/mapping-benchmark-v1'] },
    { stage: 'Sufficiency', network_required: false, can_run_in_codex: true, can_reuse_artifact: true, host_required: false, status: 'DETERMINISTIC_OFFLINE_READY', evidence: ['backend/src/evidence-readiness-service.js', 'backend/test/evidence-support-assessment.test.js'] },
    { stage: 'Claim', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'GATE_OFFLINE_READY_GENERATION_HOST_IF_SEMANTIC_PROVIDER', evidence: ['backend/src/pipeline/production-task-provider.js', 'backend/src/pipeline/claim-gate-service.js'] },
    { stage: 'Reference Retrieval', network_required: true, can_run_in_codex: true, can_reuse_artifact: false, host_required: true, status: 'NOT_RUN_INDEX_BLOCKED_NO_VALID_H3C_VECTORS', evidence: ['backend/src/pipeline/embedding-client.js', 'docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/14_PROVIDER_EMBEDDING_AUDIT.json'] },
    { stage: 'Safe Packet', network_required: false, can_run_in_codex: true, can_reuse_artifact: true, host_required: false, status: 'DETERMINISTIC_OFFLINE_READY', evidence: ['backend/src/pipeline/safe-response-packet-builder.js', 'backend/src/pipeline/writer-input-authorization-v1.js'] },
    { stage: 'Writer', network_required: true, can_run_in_codex: true, can_reuse_artifact: true, host_required: true, status: 'DRY_RUN_READY_HOST_FOR_LIVE', evidence: ['backend/src/pipeline/writer-provider.js', 'backend/src/writer-execution-service.js'] },
    { stage: 'Validator', network_required: false, can_run_in_codex: true, can_reuse_artifact: true, host_required: false, status: 'DETERMINISTIC_OFFLINE_READY', evidence: ['backend/src/pipeline/coverage-validator.js', 'backend/src/pipeline/document-validator.js'] }
  ];
}

function buildHostGate({ runtime, embedding, dependency }) {
  return {
    artifact_type: 'V43_E2E_PROVIDER_RUNTIME_HOST_EXECUTION_GATE',
    status: 'PROVIDER_RUNTIME_READY_WITH_HOST_GATE',
    first_host_required_stage: 'ENTERPRISE_INDEXING_EMBEDDING_PREFLIGHT',
    host_required: true,
    codex_network_classification: 'CODEX_RUNTIME_EGRESS_BLOCKED',
    network_probe_this_run: { attempted: false, provider_calls: 0, reason: 'No provider or embedding call was authorized in this preflight.' },
    host_evidence: {
      historical_host_success: 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json',
      historical_host_success_status: 'PASS',
      historical_sandbox_failure: 'docs/handoff/V43_DAYTIME_REAL_E2E_FOUNDATION_AND_HUMAN_GATE_MASTER_V1/15_E2E_RESUME_MANIFEST.json',
      historical_sandbox_failure_classification: 'BLOCKED_ENVIRONMENT_SANDBOX_NETWORK_EACCES',
      interpretation: 'Host/provider path is available in stored evidence; Codex sandbox egress is not a provider/model/config diagnosis.'
    },
    exact_next_host_command: {
      working_directory: 'D:\\AI工作\\AI\\标书平台\\标书平台',
      command: 'node backend/scripts/smoke-embedding.js',
      output: 'stdout/stderr JSON from the existing embedding smoke script; no repository artifact path is forced by this script',
      secrets_in_command: false,
      repo_owned_script: 'backend/scripts/smoke-embedding.js'
    },
    offline_continuation: {
      completed_in_this_preflight: ['provider owner/config inventory', 'embedding reuse audit', 'provider dependency map'],
      main_e2e_started: false,
      stop_at_first_host_boundary: true,
      no_provider_calls: true,
      no_db_writes: true
    },
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, production_semantic_changes: 0 }
  };
}

export async function buildProviderRuntimePreflight({ repo = REPO } = {}) {
  const backendEnvFile = join(repo, 'backend/.env');
  const gatewayEnvFile = join(repo, 'services/semantic-gateway/.env');
  const backendEnv = existsSync(backendEnvFile) ? parseEnvText(await readFile(backendEnvFile, 'utf8')) : {};
  const gatewayEnv = existsSync(gatewayEnvFile) ? parseEnvText(await readFile(gatewayEnvFile, 'utf8')) : {};
  const git = { branch: gitOutput(['branch', '--show-current']), head: gitOutput(['rev-parse', 'HEAD']) };
  const statusLines = gitOutput(['status', '--short'])?.split(/\r?\n/).filter(Boolean) || [];
  const runtime = await readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/01_E2E_PATH_INVENTORY.json');
  const hostRetrieval = await readJson('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json');
  const huaweiBindings = await readJson('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json');
  const chengchuanAudit = await readJson('docs/V43_CHENGCHUAN_REAL_FACT_ZERO_AUDIT.json');
  const chengchuanImport = await readJson('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json');
  const chengchuanInventory = await readJson('docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json');
  const huaweiIngestion = await readJson('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/07_ENTERPRISE_INGESTION_REPORT.json');
  const syntheticSummaries = Array.isArray(chengchuanInventory?.material_summaries) ? chengchuanInventory.material_summaries : [];
  const syntheticChunkCount = syntheticSummaries.reduce((total, row) => total + Number(row.chunk_count || 0), 0);
  const embeddingOwners = providerOwners({ backendEnv, gatewayEnv });
  const deps = dependencyMap();
  const preflight = {
    artifact_type: 'V43_E2E_PROVIDER_RUNTIME_PREFLIGHT',
    version: 'v1',
    status: 'PROVIDER_RUNTIME_READY_WITH_HOST_GATE',
    generated_at: new Date().toISOString(),
    fresh_read: { git, dirty: statusLines.length > 0, status_entry_count: statusLines.length, env_files_read: [repoPath(backendEnvFile), repoPath(gatewayEnvFile)] },
    runtime_observed_from_stored_artifacts: {
      backend_health: runtime?.runtime?.backend_health || null,
      semantic_gateway_ready: runtime?.runtime?.semantic_gateway_ready || null,
      semantic_gateway_info: runtime?.runtime?.semantic_gateway_info || null,
      database: runtime?.runtime?.database || null
    },
    environment_profiles: { backend_env: envProfile(backendEnvFile, backendEnv), semantic_gateway_env: envProfile(gatewayEnvFile, gatewayEnv) },
    provider_owners: embeddingOwners,
    network: {
      attempted_this_run: false,
      provider_calls_this_run: 0,
      classification: 'CODEX_RUNTIME_EGRESS_BLOCKED',
      classification_basis: [
        'docs/handoff/V43_DAYTIME_REAL_E2E_FOUNDATION_AND_HUMAN_GATE_MASTER_V1/15_E2E_RESUME_MANIFEST.json',
        'docs/handoff/V43_REFERENCE_CORPUS_SPECIFICITY_UPGRADE_AND_PAIRED_RETEST_V1/05_NEW_CHUNK_EMBEDDING_AUDIT.json'
      ],
      host_direct_success_basis: 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json',
      provider_model_config_failure_not_inferred: true
    },
    evidence: [artifactEvidence('docs/handoff/V43_OVERNIGHT_REAL_E2E_MASTER_V1/01_E2E_PATH_INVENTORY.json', runtime), artifactEvidence('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json', hostRetrieval), artifactEvidence('docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', huaweiBindings), artifactEvidence('docs/V43_CHENGCHUAN_REAL_FACT_ZERO_AUDIT.json', chengchuanAudit), artifactEvidence('docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', chengchuanImport)],
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, production_semantic_changes: 0 }
  };
  const embeddingAudit = {
    artifact_type: 'V43_E2E_EMBEDDING_REUSE_AUDIT',
    version: 'v1',
    generated_at: preflight.generated_at,
    reuse_policy: 'Reuse only vectors whose source/chunk/model/version/dimension identity is already evidenced; do not re-embed in preflight.',
    corpora: [
      {
        corpus_id: 'CHENGCHUAN-SYNTHETIC-BASE-COM-01-16',
        source_classification: 'SYNTHETIC_ENTERPRISE_EVIDENCE',
        material_count: 16,
        chunk_count: 160,
        embedding_row_count: 160,
        embedding_model: 'Qwen/Qwen3-Embedding-0.6B',
        embedding_version: '1',
        dimension: 1024,
        source_chunk_identity_parity: 'PASS',
        valid_vector_reuse: true,
        evidence: ['docs/V43_CHENGCHUAN_REAL_FACT_ZERO_AUDIT.md', 'backend/eval/rag-pilot/V43_REAL_RAG_IMPORT_RETRIEVAL_SMOKE_REPORT.json']
      },
      {
        corpus_id: 'CHENGCHUAN-SYNTHETIC-V2-EXTENSION',
        source_classification: 'SYNTHETIC_ENTERPRISE_EVIDENCE',
        material_count: Number(chengchuanImport?.source?.post_import_synthetic_enterprise_docs || chengchuanInventory?.material_count || 0),
        chunk_count: syntheticChunkCount,
        embedding_row_count: null,
        embedding_rows_recorded: false,
        embedding_model: null,
        embedding_version: null,
        dimension: null,
        source_chunk_identity_parity: 'SOURCE_AND_CHUNK_IDENTITY_PRESENT; VECTOR_ROWS_NOT_RECORDED_IN_IMPORT_ARTIFACT',
        valid_vector_reuse: false,
        evidence: ['docs/V43_CHENGCHUAN_V2_IMPORT_CHECKPOINT.json', 'docs/V43_CHENGCHUAN_CONTROLLED_REAL_FACT_INVENTORY.json']
      },
      {
        corpus_id: 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1',
        source_classification: 'REAL_PUBLIC_FIRST_PARTY',
        material_count: Number(huaweiBindings?.material_count || huaweiIngestion?.source_count_present || 0),
        chunk_count: Number(huaweiBindings?.chunk_count || 0),
        embedding_row_count: Number(huaweiBindings?.embedding_count || 0),
        embedding_model: hostRetrieval?.embedding_model || null,
        embedding_version: hostRetrieval?.embedding_version || null,
        dimension: hostRetrieval?.embedding_dimension || null,
        source_chunk_identity_parity: 'PASS_IN_STORED_BINDING_AND_HOST_RETRIEVAL_ARTIFACTS',
        valid_vector_reuse: true,
        evidence: ['docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/04_TB006_HUAWEI_BINDINGS.json', 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json']
      },
      {
        corpus_id: 'H3C-REFERENCE-CORPUS',
        source_classification: 'REFERENCE_ONLY',
        material_count: null,
        chunk_count: null,
        embedding_row_count: 0,
        embedding_model: 'Qwen/Qwen3-Embedding-0.6B',
        embedding_version: '1',
        dimension: 1024,
        source_chunk_identity_parity: 'NOT_APPLICABLE_TO_REUSE; NO_VALID_REFERENCE_VECTORS_RECORDED',
        valid_vector_reuse: false,
        evidence: ['docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/14_PROVIDER_EMBEDDING_AUDIT.json']
      }
    ],
    synthetic_evidence_embedding_reuse: { decision: 'PARTIAL', reason: 'COM-01..COM-16 base vectors are evidenced and reusable; V2 extension vector rows are not evidenced and are not reused.', reembed_performed: false },
    reference_embedding_reuse: { decision: 'NO_VALID_REFERENCE_VECTORS', reason: 'Existing reference embedding audit records no valid reusable H3C vectors.', reembed_performed: false },
    provider_calls: 0,
    db_writes: 0
  };
  const dependencyArtifact = { artifact_type: 'V43_E2E_PROVIDER_DEPENDENCY_MAP', version: 'v1', generated_at: preflight.generated_at, entries: deps, policy: 'Complete offline/replay-capable phases first; stop at the first live provider/embedding boundary unavailable to Codex.' };
  const hostGate = buildHostGate({ runtime: preflight, embedding: embeddingAudit, dependency: dependencyArtifact });
  return { preflight, embeddingAudit, dependencyArtifact, hostGate };
}

async function main() {
  const result = await buildProviderRuntimePreflight();
  await mkdir(E2E_DIR, { recursive: true });
  const outputs = [
    ['00A_PROVIDER_RUNTIME_PREFLIGHT.json', result.preflight],
    ['00B_EMBEDDING_REUSE_AUDIT.json', result.embeddingAudit],
    ['00C_E2E_PROVIDER_DEPENDENCY_MAP.json', result.dependencyArtifact],
    ['00D_HOST_EXECUTION_GATE.json', result.hostGate]
  ];
  for (const [name, value] of outputs) await writeFile(join(E2E_DIR, name), safeJson(value), 'utf8');
  console.log(JSON.stringify({ status: result.hostGate.status, artifacts: outputs.map(([name]) => repoPath(join(E2E_DIR, name))), provider_calls: 0, db_writes: 0 }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
