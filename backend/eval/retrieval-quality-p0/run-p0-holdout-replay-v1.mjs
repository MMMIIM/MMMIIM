import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createEmbeddingClientFromEnv,
  createEmbeddingFetchFromEnv,
  parseEmbeddingConfig
} from '../../src/pipeline/embedding-client.js';
import { buildEvidenceNeedProfile } from '../../src/evidence-need-profile-builder.js';
import { loadFrozenChengchuanEvidenceSources } from '../real-e2e/chengchuan-evidence-source-loader.mjs';
import {
  buildK0Amendment,
  FROZEN_GOLD_ARTIFACT_TYPE,
  FROZEN_GOLD_SHA256
} from './k0-contract-v1.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../');
const GOLD_PATH = path.join(HERE, 'GPT_SEMANTIC_GOLD_V1.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const CHUNKS_PATH = path.join(REPO_ROOT, 'backend/eval/rag-pilot/results/all_package_chunks.jsonl');
const REQUIREMENTS_PATH = path.join(REPO_ROOT, 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const ROUTER_PATH = path.join(REPO_ROOT, 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const BASELINE_REPLAY_PATH = path.join(HERE, 'results/V43_RAG_RETRIEVAL_P0_BASELINE_REPLAY_V1.json');
const OUTPUT_DIR = path.join(HERE, 'results');
const BATCH_FREEZE_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P0_HOLDOUT_BATCH_FREEZE_V1.json');
const SUPPLEMENT_PATH = path.join(OUTPUT_DIR, 'V43_RAG_RETRIEVAL_P0_HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1.json');
const CHECKPOINT_DIR = path.join(REPO_ROOT, 'docs/handoff/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_AND_K0_V2');
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.json');
const CHECKPOINT_MD_PATH = path.join(CHECKPOINT_DIR, 'V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.md');
const BACKEND_ENV_PATH = path.join(REPO_ROOT, 'backend/.env');

const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const AUTHORITY = 'SYNTHETIC_EVAL_ONLY';
const PRODUCTION_AUTHORITY = 'NONE';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const EXPECTED_SNAPSHOT_FILE_SHA256 = '5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578';
const EXPECTED_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EXPECTED_VERSION = '1';
const EXPECTED_DIMENSION = 1024;
const EXPECTED_PROVIDER_HOST = 'api.siliconflow.cn';
const K_VALUES = Object.freeze([1, 3, 5, 8, 20]);
const HOLDOUT_CASE_IDS = Object.freeze([
  'RAG-P0-HOLD-JY-001-REQ-027',
  'RAG-P0-HOLD-JY-001-REQ-077',
  'RAG-P0-HOLD-JY-001-REQ-051',
  'RAG-P0-HOLD-TB-003-REQ-119',
  'RAG-P0-HOLD-TB-003-REQ-170',
  'RAG-P0-HOLD-TB-006-REQ-037',
  'RAG-P0-HOLD-JY-001-REQ-148'
]);

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256Text = value => sha256(Buffer.from(String(value), 'utf8'));
const sha256File = file => sha256(fs.readFileSync(file));
const number = value => Number(Number(value).toFixed(12));
const text = value => String(value ?? '').trim();
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const relative = file => path.relative(REPO_ROOT, file).replaceAll('\\', '/');
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });

function assert(condition, message, details = {}) {
  if (!condition) throw fail(message, details);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function deterministicContentHash(value, excludedKeys = []) {
  const clone = JSON.parse(JSON.stringify(value));
  for (const key of excludedKeys) delete clone[key];
  return sha256Text(JSON.stringify(canonicalize(clone)));
}

const EVIDENCE_MATCHER_VERSION = 'EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE';
const EVIDENCE_MATCHER_CONTRACT = Object.freeze({
  candidate_unit: 'snapshot material_id + chunk_id + chunk_hash',
  accepted_match: 'candidate chunk identity equals a frozen Gold evidence item accepted span_ref chunk identity',
  alternative_match: 'any frozen Gold evidence item span_ref listed for the atom is acceptable; no semantic expansion is permitted',
  relevance_source: 'frozen Gold evidence item grade only',
  precision_relevant_grade: 'grade >= 2',
  ndcg_grades: [3, 2, 1, 0],
  atom_recall_source: 'frozen Gold evidence atom acceptable_span_refs only',
  post_hoc_rules: false
});
const EVIDENCE_MATCHER_HASH = deterministicContentHash(EVIDENCE_MATCHER_CONTRACT);

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json(value), 'utf8');
}

function loadChunks() {
  return fs.readFileSync(CHUNKS_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function sourceKey(item) {
  return `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
}

function snapshotIdentityRows(snapshot) {
  return snapshot.vectors.map(row => ({
    material_id: row.material_id,
    chunk_id: row.chunk_id,
    chunk_hash: row.chunk_hash
  }));
}

function assertVector(vector, label) {
  assert(Array.isArray(vector) && vector.length === EXPECTED_DIMENSION && vector.every(Number.isFinite), `VECTOR_INVALID_${label}`, {
    observed_dimension: Array.isArray(vector) ? vector.length : null,
    expected_dimension: EXPECTED_DIMENSION
  });
}

function validateGold(gold, chunks) {
  assert(gold.artifact_type === FROZEN_GOLD_ARTIFACT_TYPE, 'GOLD_ARTIFACT_TYPE_DRIFT');
  assert(gold.status === 'FROZEN_DEVELOPMENT_EVAL', 'GOLD_NOT_FROZEN');
  assert(gold.authority === 'DEVELOPMENT_EVAL_ONLY', 'GOLD_AUTHORITY_DRIFT');
  assert(gold.blindness?.created_before_baseline_replay === true, 'GOLD_BLINDNESS_DRIFT');
  const chunkById = new Map(chunks.map(row => [row.chunk_id, row]));
  for (const [spanRef, span] of Object.entries(gold.source_spans || {})) {
    const chunk = chunkById.get(span.chunk_id);
    assert(chunk, `GOLD_SPAN_CHUNK_MISSING_${spanRef}`);
    assert(chunk.material_id === span.material_id, `GOLD_SPAN_MATERIAL_MISMATCH_${spanRef}`);
    assert(chunk.chunk_hash === span.chunk_hash, `GOLD_SPAN_HASH_MISMATCH_${spanRef}`);
    assert(chunk.source_text === span.source_text, `GOLD_SPAN_TEXT_MISMATCH_${spanRef}`);
    assert(sha256Text(span.source_text) === span.chunk_hash, `GOLD_SPAN_TEXT_HASH_MISMATCH_${spanRef}`);
    for (const key of ['char_start', 'char_end', 'paragraph_start', 'paragraph_end']) {
      assert(chunk[key] === span[key], `GOLD_SPAN_OFFSET_MISMATCH_${spanRef}_${key}`);
    }
    const sourceFile = path.join(REPO_ROOT, span.source_file);
    assert(fs.existsSync(sourceFile), `GOLD_SOURCE_FILE_MISSING_${spanRef}`);
    assert(sha256File(sourceFile).toUpperCase() === String(span.source_file_sha256).toUpperCase(), `GOLD_SOURCE_FILE_HASH_MISMATCH_${spanRef}`);
  }
  const ids = new Set();
  for (const item of gold.cases) {
    assert(!ids.has(item.case_id), `GOLD_DUPLICATE_CASE_${item.case_id}`);
    ids.add(item.case_id);
    assert(item.split === 'CALIBRATION_SET' || item.split === 'UNTOUCHED_HOLDOUT_SET', `GOLD_SPLIT_INVALID_${item.case_id}`);
    for (const evidenceItem of item.evidence_items || []) {
      assert(gold.source_spans[evidenceItem.span_ref], `GOLD_EVIDENCE_SPAN_MISSING_${item.case_id}`);
      assert(Number.isInteger(evidenceItem.grade) && evidenceItem.grade >= 0 && evidenceItem.grade <= 3, `GOLD_GRADE_INVALID_${item.case_id}`);
    }
    for (const atom of item.evidence_atoms || []) {
      for (const ref of atom.acceptable_span_refs || []) assert(gold.source_spans[ref], `GOLD_ATOM_SPAN_MISSING_${item.case_id}`);
    }
  }
  assert(gold.splits.holdout_case_ids.length === HOLDOUT_CASE_IDS.length, 'GOLD_HOLDOUT_COUNT_DRIFT');
  assert(JSON.stringify(gold.splits.holdout_case_ids) === JSON.stringify(HOLDOUT_CASE_IDS), 'GOLD_HOLDOUT_ORDER_OR_IDENTITY_DRIFT');
}

function validateRequirementProvenance(gold, requirementPool) {
  const requirements = new Map(requirementPool.requirements.map(row => [row.canonical_requirement_id, row]));
  for (const item of gold.cases) {
    const row = requirements.get(item.requirement_id);
    assert(row, `REQUIREMENT_POOL_MISSING_${item.requirement_id}`);
    assert(row.requirement_hash === item.requirement_hash, `REQUIREMENT_HASH_MISMATCH_${item.requirement_id}`);
    assert(row.requirement_text === item.query_text, `REQUIREMENT_TEXT_MISMATCH_${item.requirement_id}`);
  }
  assert(sha256File(REQUIREMENTS_PATH).toUpperCase() === String(gold.requirement_pool.sha256).toUpperCase(), 'REQUIREMENT_POOL_FILE_HASH_MISMATCH');
}

function validateSnapshot(snapshot, sources) {
  const manifest = snapshot?.manifest || {};
  assert(manifest.snapshot_id === SNAPSHOT_ID, 'SNAPSHOT_ID_DRIFT');
  assert(manifest.enterprise_id === ENTERPRISE_ID, 'SNAPSHOT_ENTERPRISE_DRIFT');
  assert(manifest.authority === AUTHORITY, 'SNAPSHOT_AUTHORITY_DRIFT');
  assert(manifest.production_authority === PRODUCTION_AUTHORITY, 'SNAPSHOT_PRODUCTION_AUTHORITY_DRIFT');
  assert(manifest.material_count === 9, 'SNAPSHOT_MATERIAL_COUNT_DRIFT');
  assert(manifest.chunk_count === 94, 'SNAPSHOT_CHUNK_COUNT_DRIFT');
  assert(manifest.identity_hash === EXPECTED_IDENTITY_HASH, 'SNAPSHOT_IDENTITY_HASH_DRIFT', { observed: manifest.identity_hash });
  assert(manifest.embedding_provider === EXPECTED_PROVIDER_HOST, 'SNAPSHOT_PROVIDER_DRIFT');
  assert(manifest.embedding_model === EXPECTED_MODEL, 'SNAPSHOT_MODEL_DRIFT');
  assert(String(manifest.embedding_version) === EXPECTED_VERSION, 'SNAPSHOT_VERSION_DRIFT');
  assert(Number(manifest.vector_dimension) === EXPECTED_DIMENSION, 'SNAPSHOT_DIMENSION_DRIFT');
  assert(Array.isArray(snapshot.vectors) && snapshot.vectors.length === 94, 'SNAPSHOT_VECTOR_COUNT_DRIFT');

  const sourceRows = sources.flatMap(source => source.chunks.map(chunk => ({
    ...chunk,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    enterprise_id: source.enterprise_id,
    material_type: source.material_type,
    doc_id: source.doc_id,
    original_name: source.original_name,
    source_file: source.source_file
  })));
  assert(sourceRows.length === 94, 'SOURCE_EVIDENCE_CHUNK_COUNT_DRIFT');
  assert(sha256Text(JSON.stringify(sourceRows.map(row => ({ material_id: row.material_id, chunk_id: row.chunk_id, chunk_hash: row.chunk_hash })))) === EXPECTED_IDENTITY_HASH, 'SOURCE_IDENTITY_HASH_DRIFT');
  const sourceKeys = new Set(sourceRows.map(sourceKey));
  const snapshotKeys = new Set();
  let referenceOnlyEscape = 0;
  let crossEnterpriseEscape = 0;
  let quarantineEscape = 0;
  for (const row of snapshot.vectors) {
    assert(!snapshotKeys.has(sourceKey(row)), `SNAPSHOT_DUPLICATE_VECTOR_${row.chunk_id}`);
    snapshotKeys.add(sourceKey(row));
    assert(sourceKeys.has(sourceKey(row)), `SNAPSHOT_SOURCE_IDENTITY_MISSING_${row.chunk_id}`);
    if (row.source_role === 'REFERENCE_ONLY') referenceOnlyEscape += 1;
    if (row.enterprise_id !== ENTERPRISE_ID) crossEnterpriseEscape += 1;
    if (row.quarantined === true || row.source_role === 'QUARANTINE') quarantineEscape += 1;
    assert(row.source_role === 'EVIDENCE_CANDIDATE', `SNAPSHOT_SOURCE_ROLE_ESCAPE_${row.chunk_id}`);
    assert(row.enterprise_id === ENTERPRISE_ID, `SNAPSHOT_CROSS_ENTERPRISE_${row.chunk_id}`);
    assert(row.authority === AUTHORITY && row.production_authority === PRODUCTION_AUTHORITY, `SNAPSHOT_SCOPE_ESCAPE_${row.chunk_id}`);
    assert(row.embedding_provider === EXPECTED_PROVIDER_HOST && row.embedding_model === EXPECTED_MODEL, `SNAPSHOT_EMBEDDING_IDENTITY_DRIFT_${row.chunk_id}`);
    assert(String(row.embedding_version) === EXPECTED_VERSION && Number(row.vector_dimension) === EXPECTED_DIMENSION, `SNAPSHOT_VECTOR_METADATA_DRIFT_${row.chunk_id}`);
    assertVector(row.vector, `chunk_${row.chunk_id}`);
  }
  assert(sourceKeys.size === snapshotKeys.size && [...sourceKeys].every(key => snapshotKeys.has(key)), 'SNAPSHOT_SOURCE_SET_PARITY_DRIFT');
  assert(referenceOnlyEscape === 0, 'SNAPSHOT_REFERENCE_ONLY_ESCAPE');
  assert(crossEnterpriseEscape === 0, 'SNAPSHOT_CROSS_ENTERPRISE_ESCAPE');
  assert(quarantineEscape === 0, 'SNAPSHOT_QUARANTINE_ESCAPE');
  return { sourceRows, referenceOnlyEscape, crossEnterpriseEscape, quarantineEscape };
}

function loadHoldoutSpecifications(gold, requirementPool, router) {
  const requirementById = new Map(requirementPool.requirements.map(row => [row.canonical_requirement_id, row]));
  const routerById = new Map((router.rows || []).map(row => [row.requirement_id, row]));
  return HOLDOUT_CASE_IDS.map(caseId => {
    const caseGold = gold.cases.find(item => item.case_id === caseId);
    assert(caseGold, `HOLDOUT_CASE_MISSING_${caseId}`);
    const requirement = requirementById.get(caseGold.requirement_id);
    const routerRow = routerById.get(caseGold.requirement_id);
    assert(requirement && routerRow, `HOLDOUT_REQUIREMENT_AUTHORITY_MISSING_${caseGold.requirement_id}`);
    assert(requirement.requirement_text === caseGold.query_text, `HOLDOUT_CANONICAL_TEXT_DRIFT_${caseGold.requirement_id}`);
    assert(sha256Text(caseGold.query_text) === caseGold.query_hash, `HOLDOUT_QUERY_HASH_DRIFT_${caseGold.requirement_id}`);
    const profile = buildEvidenceNeedProfile({
      requirement: { requirement_id: caseGold.requirement_id, text: caseGold.query_text },
      responseDecision: {
        response_mode: routerRow.v223?.response_mode || 'NEED_REVIEW',
        risk_tier: routerRow.v223?.risk_tier || 'HIGH',
        response_required: routerRow.v223?.response_required
      },
      enterpriseId: ENTERPRISE_ID
    });
    return { caseGold, requirement, profile, routerRow };
  });
}

function buildHoldoutBatchFreeze(context, { replayExisting = false } = {}) {
  const freeze = {
    artifact_type: 'V43_RAG_RETRIEVAL_P0_HOLDOUT_BATCH_FREEZE_V1',
    artifact_version: 'v1',
    status: replayExisting
      ? 'REPLAY_EXISTING_SUPPLEMENT_BATCH_CONTRACT_VERIFIED'
      : 'FROZEN_BEFORE_PROVIDER_CALL',
    execution_mode: replayExisting
      ? 'REPLAY_EXISTING_SUPPLEMENT_NO_PROVIDER_CALL'
      : 'ONE_FROZEN_BATCH_PROVIDER_CALL_SEQUENCE',
    gold: {
      path: relative(GOLD_PATH),
      file_sha256: context.goldFileSha256,
      gold_projection_version: context.amendment.artifact_type,
      k0_projection_artifact_type: context.amendment.artifact_type,
      k0_projection_content_hash: context.amendment.amendment_content_hash
    },
    baseline_snapshot: {
      snapshot_id: SNAPSHOT_ID,
      file_sha256: context.snapshotFileSha256,
      identity_hash: EXPECTED_IDENTITY_HASH
    },
    case_order: context.specifications.map((specification, index) => ({
      ordinal: index + 1,
      case_id: specification.caseGold.case_id,
      requirement_id: specification.caseGold.requirement_id,
      query_text: specification.caseGold.query_text,
      query_hash: specification.caseGold.query_hash,
      profile_class: specification.caseGold.profile_class,
      expected_retrieval_k0: context.amendment.projections.find(item => item.case_id === specification.caseGold.case_id).expected_retrieval_k0,
      expected_no_sufficient_evidence: context.amendment.projections.find(item => item.case_id === specification.caseGold.case_id).expected_no_sufficient_evidence
    })),
    metric_contract: {
      k_values: K_VALUES,
      mrr_variant: 'MRR_FULL',
      evidence_matcher_version: EVIDENCE_MATCHER_VERSION,
      evidence_matcher_hash: EVIDENCE_MATCHER_HASH,
      evidence_matcher_contract: EVIDENCE_MATCHER_CONTRACT
    },
    provider_contract: {
      provider: EXPECTED_PROVIDER_HOST,
      model: EXPECTED_MODEL,
      version: EXPECTED_VERSION,
      dimension: EXPECTED_DIMENSION,
      query_embeddings_only: true,
      corpus_re_embedding: false,
      llm_calls: false
    },
    provider_call_order_is_frozen: true,
    all_query_embeddings_generated_before_retrieval_inspection: true,
    results_inspection_before_all_embeddings: false,
    deterministic_content_hash: null
  };
  freeze.deterministic_content_hash = deterministicContentHash(freeze, ['deterministic_content_hash']);
  return freeze;
}

function preflight({ allowExistingSupplement = false } = {}) {
  assert(fs.existsSync(GOLD_PATH), 'GOLD_FILE_MISSING');
  assert(fs.existsSync(SNAPSHOT_PATH), 'SNAPSHOT_FILE_MISSING');
  assert(fs.existsSync(CHUNKS_PATH), 'CHUNK_ARTIFACT_MISSING');
  const goldSha = sha256File(GOLD_PATH).toUpperCase();
  const snapshotSha = sha256File(SNAPSHOT_PATH).toUpperCase();
  assert(goldSha === FROZEN_GOLD_SHA256, 'FROZEN_GOLD_FILE_SHA_MISMATCH', { expected: FROZEN_GOLD_SHA256, observed: goldSha });
  assert(snapshotSha === EXPECTED_SNAPSHOT_FILE_SHA256, 'FROZEN_SNAPSHOT_FILE_SHA_MISMATCH', { expected: EXPECTED_SNAPSHOT_FILE_SHA256, observed: snapshotSha });
  const goldText = fs.readFileSync(GOLD_PATH, 'utf8');
  const snapshotText = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  const gold = JSON.parse(goldText);
  const snapshot = JSON.parse(snapshotText);
  const chunks = loadChunks();
  const requirementPool = readJson(REQUIREMENTS_PATH);
  const router = readJson(ROUTER_PATH);
  validateGold(gold, chunks);
  validateRequirementProvenance(gold, requirementPool);
  return loadFrozenChengchuanEvidenceSources({ repoRoot: REPO_ROOT }).then(sources => {
    const snapshotAudit = validateSnapshot(snapshot, sources);
    const specifications = loadHoldoutSpecifications(gold, requirementPool, router);
    const amendment = buildK0Amendment({ gold, goldFileSha256: goldSha });
    const config = parseEmbeddingConfig({ ...process.env });
    let endpoint;
    try { endpoint = new URL(config.apiBase); } catch { throw fail('EMBEDDING_ENDPOINT_INVALID'); }
    assert(endpoint.hostname === EXPECTED_PROVIDER_HOST, 'EMBEDDING_PROVIDER_HOST_MISMATCH', { expected: EXPECTED_PROVIDER_HOST, observed: endpoint.hostname });
    assert(config.model === EXPECTED_MODEL, 'EMBEDDING_MODEL_MISMATCH', { expected: EXPECTED_MODEL, observed: config.model });
    assert(String(config.version) === EXPECTED_VERSION, 'EMBEDDING_VERSION_MISMATCH', { expected: EXPECTED_VERSION, observed: config.version });
    assert(Number(config.dimension) === EXPECTED_DIMENSION, 'EMBEDDING_DIMENSION_MISMATCH', { expected: EXPECTED_DIMENSION, observed: config.dimension });
    assert(Boolean(config.apiKey), 'EMBEDDING_API_KEY_NOT_CONFIGURED');
    if (!allowExistingSupplement) assert(!fs.existsSync(SUPPLEMENT_PATH), 'HOLDOUT_QUERY_SUPPLEMENT_ALREADY_EXISTS_NO_REPEAT_CALL');
    return {
      gold,
      snapshot,
      chunks,
      sources,
      sourceRows: snapshotAudit.sourceRows,
      specifications,
      amendment,
      config,
      goldFileSha256: goldSha,
      snapshotFileSha256: snapshotSha,
      goldContentHash: deterministicContentHash(gold),
      snapshotContentHash: deterministicContentHash(snapshot),
      chunkContentHash: deterministicContentHash(chunks),
      requirementPoolContentHash: deterministicContentHash(requirementPool)
    };
  });
}

function buildObservedEmbeddingClient(env) {
  const transport = createEmbeddingFetchFromEnv({ env });
  const observations = [];
  const fetchImpl = async (url, options) => {
    try {
      const response = await transport.fetchImpl(url, options);
      const observation = {
        provider_http_status: response.status,
        response_envelope_keys: null,
        response_json_valid: false
      };
      try {
        const body = await response.clone().json();
        observation.response_envelope_keys = body && typeof body === 'object' ? Object.keys(body).sort() : [];
        observation.response_json_valid = true;
      } catch {
        observation.response_json_valid = false;
      }
      observations.push(observation);
      return response;
    } catch (error) {
      observations.push({ provider_http_status: null, response_envelope_keys: null, response_json_valid: false, transport_error_code: error?.code || error?.name || 'UNKNOWN' });
      throw error;
    }
  };
  return { client: createEmbeddingClientFromEnv({ env, fetchImpl }), transport, observations };
}

async function generateHoldoutSupplement(context, batchFreeze) {
  const env = { ...process.env };
  dotenv.config({ path: BACKEND_ENV_PATH, override: false, quiet: true, processEnv: env });
  const config = parseEmbeddingConfig(env);
  assert(config.apiBase === context.config.apiBase, 'EMBEDDING_CONFIG_CHANGED_AFTER_PREFLIGHT');
  const { client, transport, observations } = buildObservedEmbeddingClient(env);
  const queryVectors = [];
  try {
    for (let index = 0; index < context.specifications.length; index += 1) {
      const specification = context.specifications[index];
      const caseGold = specification.caseGold;
      const requestPayload = { model: config.model, input: [caseGold.query_text], dimensions: config.dimension };
      const requestPayloadHash = sha256Text(JSON.stringify(requestPayload));
      let vector;
      try {
        vector = (await client.embed([caseGold.query_text]))[0];
      } catch (error) {
        const observation = observations[index] || {};
        throw fail(`BLOCKED_RAG_P0_HOLDOUT_QUERY_EMBEDDING_CALL_${index + 1}_${error.code || 'UNKNOWN'}`, {
          call_ordinal: index + 1,
          provider_http_status: observation.provider_http_status ?? null,
          response_envelope_keys: observation.response_envelope_keys || null,
          response_json_valid: observation.response_json_valid ?? false,
          transport_error_code: observation.transport_error_code || null,
          retry_count: 0,
          provider_calls_completed: index + 1,
          provider_calls_remaining_not_sent: context.specifications.length - index - 1
        });
      }
      assertVector(vector, `holdout_query_${caseGold.requirement_id}`);
      const observation = observations[index] || {};
      queryVectors.push({
        case_id: caseGold.case_id,
        requirement_id: caseGold.requirement_id,
        query_text: caseGold.query_text,
        query_hash: caseGold.query_hash,
        profile_hash: specification.profile.profile_hash,
        request_payload_hash: requestPayloadHash,
        embedding_provider: EXPECTED_PROVIDER_HOST,
        embedding_model: config.model,
        embedding_version: String(config.version),
        vector_dimension: Number(config.dimension),
        vector_hash: sha256Text(JSON.stringify(vector)),
        vector,
        provider_call_ordinal: index + 1,
        retry_count: 0,
        provider_http_status: observation.provider_http_status ?? null,
        response_envelope_keys: observation.response_envelope_keys || null,
        response_json_valid: observation.response_json_valid ?? false,
        response_data_count: 1,
        snapshot_id: SNAPSHOT_ID
      });
    }
  } finally {
    await transport.close();
  }
  const supplement = {
    artifact_type: 'HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1',
    artifact_version: 'v1',
    status: 'FROZEN_AFTER_PROVIDER_GENERATION',
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    created_at: new Date().toISOString(),
    snapshot_id: SNAPSHOT_ID,
    snapshot_identity_hash: EXPECTED_IDENTITY_HASH,
    provider: EXPECTED_PROVIDER_HOST,
    endpoint_host: EXPECTED_PROVIDER_HOST,
    endpoint_path: new URL(config.apiBase).pathname,
    endpoint_fingerprint: sha256Text(`${new URL(config.apiBase).hostname}${new URL(config.apiBase).pathname}`),
    embedding_model: config.model,
    embedding_version: String(config.version),
    vector_dimension: Number(config.dimension),
    query_count: queryVectors.length,
    provider_call_count: queryVectors.length,
    retry_count: 0,
    concurrency: 1,
    batch_freeze_content_hash: batchFreeze.deterministic_content_hash,
    evidence_matcher_version: EVIDENCE_MATCHER_VERSION,
    evidence_matcher_hash: EVIDENCE_MATCHER_HASH,
    query_vectors: queryVectors,
    deterministic_content_hash: null
  };
  supplement.deterministic_content_hash = deterministicContentHash(supplement, ['deterministic_content_hash', 'artifact_file_sha256']);
  writeJson(SUPPLEMENT_PATH, supplement);
  return {
    supplement,
    supplementFileSha256: sha256File(SUPPLEMENT_PATH).toUpperCase(),
    supplementContentHash: supplement.deterministic_content_hash
  };
}

function validateReloadedSupplement(supplement, specifications) {
  assert(supplement.artifact_type === 'HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1', 'SUPPLEMENT_ARTIFACT_TYPE_DRIFT');
  assert(supplement.authority === AUTHORITY && supplement.production_authority === PRODUCTION_AUTHORITY, 'SUPPLEMENT_AUTHORITY_DRIFT');
  assert(supplement.snapshot_id === SNAPSHOT_ID && supplement.snapshot_identity_hash === EXPECTED_IDENTITY_HASH, 'SUPPLEMENT_SNAPSHOT_BINDING_DRIFT');
  assert(supplement.provider === EXPECTED_PROVIDER_HOST && supplement.embedding_model === EXPECTED_MODEL, 'SUPPLEMENT_PROVIDER_IDENTITY_DRIFT');
  assert(String(supplement.embedding_version) === EXPECTED_VERSION && Number(supplement.vector_dimension) === EXPECTED_DIMENSION, 'SUPPLEMENT_VECTOR_METADATA_DRIFT');
  assert(supplement.provider_call_count === 7 && supplement.query_count === 7, 'SUPPLEMENT_QUERY_COUNT_DRIFT');
  if (supplement.evidence_matcher_version !== undefined) assert(supplement.evidence_matcher_version === EVIDENCE_MATCHER_VERSION, 'SUPPLEMENT_MATCHER_VERSION_DRIFT');
  if (supplement.evidence_matcher_hash !== undefined) assert(supplement.evidence_matcher_hash === EVIDENCE_MATCHER_HASH, 'SUPPLEMENT_MATCHER_HASH_DRIFT');
  assert(deterministicContentHash(supplement, ['deterministic_content_hash', 'artifact_file_sha256']) === supplement.deterministic_content_hash, 'SUPPLEMENT_CONTENT_HASH_MISMATCH');
  const expected = new Map(specifications.map(specification => [specification.caseGold.requirement_id, specification]));
  const seen = new Set();
  for (const row of supplement.query_vectors) {
    assert(!seen.has(row.requirement_id), `SUPPLEMENT_DUPLICATE_QUERY_${row.requirement_id}`);
    seen.add(row.requirement_id);
    const specification = expected.get(row.requirement_id);
    assert(specification, `SUPPLEMENT_UNEXPECTED_QUERY_${row.requirement_id}`);
    assert(row.query_hash === specification.caseGold.query_hash, `SUPPLEMENT_QUERY_HASH_DRIFT_${row.requirement_id}`);
    assert(row.profile_hash === specification.profile.profile_hash, `SUPPLEMENT_PROFILE_HASH_DRIFT_${row.requirement_id}`);
    assert(row.query_text === specification.caseGold.query_text, `SUPPLEMENT_QUERY_TEXT_DRIFT_${row.requirement_id}`);
    assert(row.provider_call_ordinal >= 1 && row.provider_call_ordinal <= 7 && row.retry_count === 0, `SUPPLEMENT_CALL_POLICY_DRIFT_${row.requirement_id}`);
    assert(row.provider_http_status === 200 && row.response_json_valid === true && row.response_data_count === 1, `SUPPLEMENT_PROVIDER_RESPONSE_INVALID_${row.requirement_id}`);
    assertVector(row.vector, `reloaded_query_${row.requirement_id}`);
    assert(sha256Text(JSON.stringify(row.vector)) === row.vector_hash, `SUPPLEMENT_VECTOR_HASH_MISMATCH_${row.requirement_id}`);
  }
  assert(seen.size === 7, 'SUPPLEMENT_QUERY_SET_PARITY_DRIFT');
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function sourceIndex(sources) {
  return new Map(sources.flatMap(source => source.chunks.map(chunk => [sourceKey({ material_id: source.material_id, chunk_id: chunk.chunk_id, chunk_hash: chunk.chunk_hash }), {
    ...chunk,
    doc_id: source.doc_id,
    original_name: source.original_name,
    source_file: source.source_file,
    material_type: source.material_type,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    enterprise_id: source.enterprise_id
  }])));
}

function rankSnapshotQuery(snapshot, queryVector, sourceByKey, caseGold, spanByRef) {
  return snapshot.vectors.map(row => {
    const source = sourceByKey.get(sourceKey(row));
    assert(source, `REPLAY_SOURCE_LINEAGE_MISSING_${row.chunk_id}`);
    const itemMatches = (caseGold.evidence_items || []).filter(item => {
      const span = spanByRef[item.span_ref];
      return span && span.chunk_id === row.chunk_id && span.material_id === row.material_id;
    });
    const grade = itemMatches.reduce((max, item) => Math.max(max, Number(item.grade)), 0);
    return {
      material_id: row.material_id,
      material_logical_identity: { com_id: source.doc_id, original_name: source.original_name, source_file: source.source_file },
      material_type: source.material_type,
      chunk_id: row.chunk_id,
      chunk_hash: row.chunk_hash,
      source_role: row.source_role,
      enterprise_id: row.enterprise_id,
      source_span: `${row.chunk_id}:FULL`,
      exact_candidate_source_text: source.source_text,
      similarity: number(cosine(queryVector, row.vector)),
      gold_grade: grade,
      gold_item_ids: itemMatches.map(item => item.evidence_item_id)
    };
  }).sort((left, right) => right.similarity - left.similarity || `${left.material_id}|${left.chunk_id}`.localeCompare(`${right.material_id}|${right.chunk_id}`))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function metricAtK(caseGold, ranked, k, spanByRef, expectedK0Projection) {
  const top = ranked.slice(0, k);
  const topKeys = new Set(top.map(row => `${row.material_id}|${row.chunk_id}`));
  const matchableAtoms = (caseGold.evidence_atoms || []).filter(atom => (atom.acceptable_span_refs || []).length > 0);
  const coveredAtoms = matchableAtoms.filter(atom => (atom.acceptable_span_refs || []).some(ref => {
    const span = spanByRef[ref];
    return span && topKeys.has(`${span.material_id}|${span.chunk_id}`);
  }));
  const relevantCount = top.filter(row => row.gold_grade >= 2).length;
  const idealGrades = (caseGold.evidence_items || []).map(item => Number(item.grade)).sort((a, b) => b - a).slice(0, k);
  const dcg = top.reduce((sum, row, index) => sum + ((2 ** row.gold_grade) - 1) / Math.log2(index + 2), 0);
  const idealDcg = idealGrades.reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const firstEvidence = ranked.find(row => row.gold_grade >= 2);
  const returnedK0 = top.length === 0;
  return {
    evidence_atom_recall: matchableAtoms.length ? number(coveredAtoms.length / matchableAtoms.length) : null,
    candidate_precision: number(relevantCount / k),
    ndcg: idealDcg ? number(dcg / idealDcg) : null,
    mrr_full: firstEvidence ? number(1 / firstEvidence.rank) : null,
    expected_retrieval_k0: expectedK0Projection.expected_retrieval_k0,
    expected_no_sufficient_evidence: expectedK0Projection.expected_no_sufficient_evidence,
    returned_k0: returnedK0,
    false_positive_retrieval_candidate: expectedK0Projection.expected_retrieval_k0 && top.some(row => row.gold_grade >= 2),
    false_negative_retrieval_k0: !expectedK0Projection.expected_retrieval_k0 && returnedK0,
    no_grade_gte_2_in_top_k: !top.some(row => row.gold_grade >= 2)
  };
}

function failureFamily(caseGold, ranked, expectedK0Projection) {
  const top = ranked[0];
  const top20 = ranked.slice(0, 20);
  if (expectedK0Projection.expected_retrieval_k0 && top20.every(row => row.gold_grade < 2)) return 'EXPECTED_K0_NO_GRADE_GE_2_EVIDENCE';
  if (top?.gold_grade >= 2) return 'GRADE_GE_2_EVIDENCE_AT_RANK_1';
  if (top?.gold_grade === 1) return 'RELEVANT_ONLY_AT_RANK_1';
  if (top20.some(row => row.gold_grade >= 2)) return 'LOW_RANK_GRADE_GE_2_EVIDENCE';
  return caseGold.evidence_items?.length ? 'RETRIEVAL_MISS_OR_RELEVANT_ONLY' : 'NO_GRADE_GE_2_EVIDENCE';
}

function replayOnce(context, supplement) {
  const sourceByKey = sourceIndex(context.sources);
  const queryById = new Map(supplement.query_vectors.map(row => [row.requirement_id, row]));
  const cases = context.specifications.map(specification => {
    const { caseGold, profile } = specification;
    const query = queryById.get(caseGold.requirement_id);
    assert(query, `REPLAY_QUERY_VECTOR_MISSING_${caseGold.requirement_id}`);
    const k0Projection = context.amendment.projections.find(item => item.case_id === caseGold.case_id);
    const ranked = rankSnapshotQuery(context.snapshot, query.vector, sourceByKey, caseGold, context.gold.source_spans);
    const metrics = Object.fromEntries(K_VALUES.map(k => [String(k), metricAtK(caseGold, ranked, k, context.gold.source_spans, k0Projection)]));
    return {
      case_id: caseGold.case_id,
      requirement_id: caseGold.requirement_id,
      canonical_requirement_text: caseGold.query_text,
      case_class: caseGold.case_class,
      frozen_gold_profile_class: caseGold.profile_class,
      evidence_need_profile: {
        class: profile.evidence_need_class,
        required_dimensions: profile.required_dimensions,
        conditional_dimensions: profile.conditional_dimensions,
        search_signals: profile.search_signals,
        critical_literals: profile.critical_literals,
        profile_hash: profile.profile_hash
      },
      query_text: caseGold.query_text,
      query_hash: caseGold.query_hash,
      expected_retrieval_k0: k0Projection.expected_retrieval_k0,
      expected_no_sufficient_evidence: k0Projection.expected_no_sufficient_evidence,
      query_vector_present: true,
      raw_candidate_count: ranked.length,
      metrics,
      first_failure_family: failureFamily(caseGold, ranked, k0Projection),
      top20: ranked.slice(0, 20)
    };
  });
  const aggregateAtK = k => {
    const values = cases.map(item => item.metrics[String(k)]);
    const average = key => {
      const eligible = values.map(item => item[key]).filter(value => value !== null);
      return eligible.length ? number(eligible.reduce((sum, value) => sum + value, 0) / eligible.length) : null;
    };
    const expectedK0 = values.filter(item => item.expected_retrieval_k0);
    const expectedNonK0 = values.filter(item => !item.expected_retrieval_k0);
    const noSufficient = values.filter(item => item.expected_no_sufficient_evidence);
    return {
      case_count: values.length,
      evidence_atom_recall: average('evidence_atom_recall'),
      evidence_atom_recall_denominator_cases: values.filter(item => item.evidence_atom_recall !== null).length,
      candidate_precision: average('candidate_precision'),
      ndcg: average('ndcg'),
      ndcg_denominator_cases: values.filter(item => item.ndcg !== null).length,
      mrr_full: average('mrr_full'),
      mrr_full_denominator_cases: values.filter(item => item.mrr_full !== null).length,
      expected_retrieval_k0_count: expectedK0.length,
      expected_no_sufficient_evidence_count: noSufficient.length,
      false_positive_retrieval_candidate_rate: expectedK0.length ? number(expectedK0.filter(item => item.false_positive_retrieval_candidate).length / expectedK0.length) : null,
      false_negative_retrieval_k0_rate: expectedNonK0.length ? number(expectedNonK0.filter(item => item.false_negative_retrieval_k0).length / expectedNonK0.length) : null,
      returned_k0_count: values.filter(item => item.returned_k0).length,
      no_grade_gte_2_in_top_k_count: values.filter(item => item.no_grade_gte_2_in_top_k).length
    };
  };
  const metricsAtK = Object.fromEntries(K_VALUES.map(k => [String(k), aggregateAtK(k)]));
  const byProfile = {};
  for (const profileClass of [...new Set(cases.map(item => item.frozen_gold_profile_class))].sort()) {
    const scoped = cases.filter(item => item.frozen_gold_profile_class === profileClass);
    byProfile[profileClass] = {
      case_count: scoped.length,
      metrics_at_k: Object.fromEntries(K_VALUES.map(k => {
        const values = scoped.map(item => item.metrics[String(k)]);
        const average = key => {
          const eligible = values.map(item => item[key]).filter(value => value !== null);
          return eligible.length ? number(eligible.reduce((sum, value) => sum + value, 0) / eligible.length) : null;
        };
        return [String(k), { evidence_atom_recall: average('evidence_atom_recall'), candidate_precision: average('candidate_precision'), ndcg: average('ndcg'), mrr_full: average('mrr_full'), case_count: values.length }];
      }))
    };
  }
  const failureFamilies = {};
  for (const item of cases) failureFamilies[item.first_failure_family] = (failureFamilies[item.first_failure_family] || 0) + 1;
  return {
    case_count: cases.length,
    cases,
    aggregate_metrics_at_k: metricsAtK,
    metrics_by_profile_class: byProfile,
    failure_family_distribution: failureFamilies,
    k0_diagnostics: {
      definition: 'K0 diagnostics use expected_retrieval_k0 from the additive amendment; expected_no_sufficient_evidence is reported independently.',
      expected_retrieval_k0_count: cases.filter(item => item.expected_retrieval_k0).length,
      expected_retrieval_k0_case_ids: cases.filter(item => item.expected_retrieval_k0).map(item => item.case_id),
      expected_no_sufficient_evidence_count: cases.filter(item => item.expected_no_sufficient_evidence).length,
      expected_no_sufficient_evidence_case_ids: cases.filter(item => item.expected_no_sufficient_evidence).map(item => item.case_id),
      partial_cases_are_not_false_positive_retrieval: true,
      at_k: metricsAtK
    }
  };
}

function chooseRecommendation(replay) {
  const k0 = replay.k0_diagnostics.at_k;
  if (K_VALUES.some(k => (k0[String(k)].false_positive_retrieval_candidate_rate || 0) > 0 || (k0[String(k)].false_negative_retrieval_k0_rate || 0) > 0)) return {
    recommendation: 'P4_K0',
    basis: 'A corrected K0 diagnostic rate is non-zero; K0 behavior warrants a separately authorized intervention review.'
  };
  const product = replay.metrics_by_profile_class.PRODUCT_CAPABILITY?.metrics_at_k?.['5']?.evidence_atom_recall;
  const nonProductProfiles = Object.entries(replay.metrics_by_profile_class)
    .filter(([profileClass]) => profileClass !== 'PRODUCT_CAPABILITY')
    .map(([, value]) => value.metrics_at_k?.['5']?.evidence_atom_recall)
    .filter(value => value !== null && value !== undefined);
  if (product !== null && product !== undefined && nonProductProfiles.some(value => value < product)) return {
    recommendation: 'P3_PROFILE_LEXICAL',
    basis: 'At Top-5, the frozen replay shows a profile-sliced retrieval gap outside PRODUCT_CAPABILITY; the recommendation is to review profile/lexical handling only, without implementing query or ranking changes in this checkpoint.'
  };
  return {
    recommendation: 'NO_CHANGE_YET',
    basis: 'Corrected K0 false-positive and false-negative diagnostic rates are zero in this frozen replay; no intervention is implemented before GPT semantic review.'
  };
}

function buildCheckpoint(context, batchFreeze, supplementInfo, replay, replayHash1, replayHash2, baselineFileShaBefore) {
  const goldAfter = sha256File(GOLD_PATH).toUpperCase();
  const snapshotAfter = sha256File(SNAPSHOT_PATH).toUpperCase();
  const baselineFileShaAfter = fs.existsSync(BASELINE_REPLAY_PATH) ? sha256File(BASELINE_REPLAY_PATH).toUpperCase() : null;
  const recommendation = chooseRecommendation(replay);
  const artifact = {
    artifact_type: 'V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2',
    artifact_version: 'v2',
    status: 'P0_HOLDOUT_REPLAY_COMPLETE_GPT_SEMANTIC_REVIEW_PENDING',
    execution_mode: 'EVAL_ONLY_CONTRACT_CORRECTION',
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    contract_amendment: {
      artifact_type: context.amendment.artifact_type,
      path: relative(path.join(HERE, 'V43_RAG_RETRIEVAL_P0_K0_CONTRACT_AMENDMENT_V1.json')),
      file_sha256: sha256File(path.join(HERE, 'V43_RAG_RETRIEVAL_P0_K0_CONTRACT_AMENDMENT_V1.json')).toUpperCase(),
      deterministic_content_hash: context.amendment.amendment_content_hash,
      original_gold_unchanged: true
    },
    holdout_batch_freeze: {
      path: relative(BATCH_FREEZE_PATH),
      file_sha256: sha256File(BATCH_FREEZE_PATH).toUpperCase(),
      deterministic_content_hash: batchFreeze.deterministic_content_hash,
      status: batchFreeze.status,
      execution_mode: batchFreeze.execution_mode,
      case_order_frozen: batchFreeze.case_order.map(item => item.case_id),
      query_text_hashes_frozen: batchFreeze.case_order.map(item => ({ case_id: item.case_id, query_hash: item.query_hash })),
      all_query_embeddings_generated_before_retrieval_inspection: batchFreeze.all_query_embeddings_generated_before_retrieval_inspection,
      results_inspection_before_all_embeddings: batchFreeze.results_inspection_before_all_embeddings
    },
    evidence_matcher: {
      version: EVIDENCE_MATCHER_VERSION,
      hash: EVIDENCE_MATCHER_HASH,
      contract: EVIDENCE_MATCHER_CONTRACT
    },
    original_gold_unchanged_proof: {
      path: relative(GOLD_PATH),
      file_sha256_before: context.goldFileSha256,
      file_sha256_after: goldAfter,
      frozen_sha256: FROZEN_GOLD_SHA256,
      file_sha256_parity: context.goldFileSha256 === goldAfter && goldAfter === FROZEN_GOLD_SHA256,
      deterministic_content_hash_before: context.goldContentHash,
      deterministic_content_hash_after: deterministicContentHash(readJson(GOLD_PATH)),
      spans_and_atoms_mutated: false
    },
    holdout_query_vector_artifact: {
      artifact_type: supplementInfo.supplement.artifact_type,
      path: relative(SUPPLEMENT_PATH),
      file_sha256: supplementInfo.supplementFileSha256,
      deterministic_content_hash: supplementInfo.supplementContentHash,
      query_count: supplementInfo.supplement.query_count,
      provider: supplementInfo.supplement.provider,
      model: supplementInfo.supplement.embedding_model,
      version: supplementInfo.supplement.embedding_version,
      vector_dimension: supplementInfo.supplement.vector_dimension,
      provider_call_count: supplementInfo.supplement.provider_call_count,
      retry_count: supplementInfo.supplement.retry_count
    },
    provider_call_count: 7,
    provider_call_scope: 'HOLDOUT_QUERY_VECTOR_SUPPLEMENT_GENERATION',
    new_provider_calls_during_v2_replay: 0,
    corpus_snapshot_unchanged_proof: {
      path: relative(SNAPSHOT_PATH),
      snapshot_id: SNAPSHOT_ID,
      identity_hash: EXPECTED_IDENTITY_HASH,
      file_sha256_before: context.snapshotFileSha256,
      file_sha256_after: snapshotAfter,
      frozen_file_sha256: EXPECTED_SNAPSHOT_FILE_SHA256,
      file_sha256_parity: context.snapshotFileSha256 === snapshotAfter && snapshotAfter === EXPECTED_SNAPSHOT_FILE_SHA256,
      deterministic_content_hash_before: context.snapshotContentHash,
      deterministic_content_hash_after: deterministicContentHash(readJson(SNAPSHOT_PATH)),
      material_count: 9,
      chunk_count: 94,
      reference_only_escape_count: 0,
      cross_enterprise_escape_count: 0,
      quarantine_escape_count: 0
    },
    governance: {
      before_replay_split: 'UNTOUCHED_HOLDOUT_SET',
      after_results_inspected_split: 'DEVELOPMENT_VALIDATION_SET',
      fresh_final_release_holdout_eligible: false,
      gold_semantic_labels_created_by_codex: false
    },
    metric_definitions: {
      evidence_atom_recall_at_k: 'Matchable Gold evidence atoms covered by a Top-K candidate, divided by matchable atoms; atoms without acceptable spans are excluded and remain visible as corpus gaps.',
      candidate_precision_at_k: 'Top-K candidates with Gold evidence grade >= 2 divided by K.',
      ndcg_at_k: 'Graded nDCG over Gold evidence items with grades 3/2/1/0.',
      mrr_full: 'Mean reciprocal rank over cases whose full frozen ranking contains a grade >= 2 evidence candidate; cases without one are excluded from the denominator.',
      expected_retrieval_k0: 'True only when no frozen Gold evidence item has grade >= 2.',
      expected_no_sufficient_evidence: 'Independent true/false projection of full Requirement sufficiency; partial cases may have false retrieval K0 and true no-sufficient-evidence.',
      false_positive_retrieval_candidate_rate: 'Among expected_retrieval_k0 cases, the rate with a grade >= 2 candidate in the evaluated Top-K.',
      false_negative_retrieval_k0_rate: 'Among expected_retrieval_k0=false cases, the rate for which the replay returns zero candidates.'
    },
    holdout_replay: replay,
    deterministic_replay_parity: {
      replay_input_content_hashes: {
        gold: context.goldContentHash,
        snapshot: context.snapshotContentHash,
        chunk_artifact: context.chunkContentHash,
        requirement_pool: context.requirementPoolContentHash,
        query_supplement: supplementInfo.supplementContentHash
      },
      replay_run_count: 2,
      first_replay_deterministic_content_hash: replayHash1,
      second_replay_deterministic_content_hash: replayHash2,
      same_input_same_output: replayHash1 === replayHash2,
      old_baseline_artifact_file_sha256_before: baselineFileShaBefore,
      old_baseline_artifact_file_sha256_after: baselineFileShaAfter,
      old_baseline_artifact_unchanged: baselineFileShaBefore === baselineFileShaAfter,
      old_baseline_pending_marker_not_authoritative_for_this_checkpoint: true
    },
    safety_metrics: {
      provider_calls: 7,
      embedding_calls: 7,
      llm_calls: 0,
      fact_calls: 0,
      mapping_calls: 0,
      claim_calls: 0,
      writer_calls: 0,
      production_db_writes: 0,
      eval_db_writes: 0,
      gold_mutations: 0,
      corpus_mutations: 0,
      production_retrieval_changes: 0,
      production_authority_promotions: 0,
      commits: 0,
      pushes: 0,
      merges: 0,
      deploys: 0
    },
    next_intervention_recommendation: recommendation
  };
  artifact.deterministic_content_hash = deterministicContentHash(artifact, ['deterministic_content_hash', 'file_sha256']);
  return artifact;
}

function writeCheckpointMarkdown(checkpoint) {
  const lines = [
    '# V43 RAG Retrieval P0 Holdout Replay Checkpoint',
    '',
    `- Status: **${checkpoint.status}**`,
    `- Gold: \`${checkpoint.original_gold_unchanged_proof.file_sha256_after}\` unchanged`,
    `- Corpus snapshot: \`${checkpoint.corpus_snapshot_unchanged_proof.snapshot_id}\`, 94 vectors, unchanged`,
    `- Holdout query vector calls: **${checkpoint.provider_call_count}**`,
    `- Replay parity: **${checkpoint.deterministic_replay_parity.same_input_same_output ? 'PASS' : 'FAIL'}** (2 offline runs)`,
    `- Corrected expected retrieval K0 cases: **${checkpoint.holdout_replay.k0_diagnostics.expected_retrieval_k0_count}**`,
    `- Expected no-sufficient-evidence cases: **${checkpoint.holdout_replay.k0_diagnostics.expected_no_sufficient_evidence_count}**`,
    `- Recommendation: **${checkpoint.next_intervention_recommendation.recommendation}**`,
    '',
    'The seven-case holdout is now logically DEVELOPMENT_VALIDATION_SET after inspection and is not a fresh final-release holdout.',
    '',
    'No Fact, Mapping, Claim, Writer, database, Gold, Production Retrieval, commit, push, merge, or deploy action was performed.',
    '',
    '**V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2**',
    ''
  ];
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT_MD_PATH, lines.join('\n'), 'utf8');
}

async function main() {
  dotenv.config({ path: BACKEND_ENV_PATH, override: false, quiet: true });
  const replayExisting = process.argv.includes('--replay-existing');
  const context = await preflight({ allowExistingSupplement: replayExisting });
  writeJson(path.join(HERE, 'V43_RAG_RETRIEVAL_P0_K0_CONTRACT_AMENDMENT_V1.json'), context.amendment);
  const batchFreeze = buildHoldoutBatchFreeze(context, { replayExisting });
  writeJson(BATCH_FREEZE_PATH, batchFreeze);
  if (process.argv.includes('--preflight')) {
    console.log(JSON.stringify({
      status: 'P0_HOLDOUT_REPLAY_PREFLIGHT_PASS',
      gold_file_sha256: context.goldFileSha256,
      snapshot_file_sha256: context.snapshotFileSha256,
      snapshot_identity_hash: EXPECTED_IDENTITY_HASH,
      material_count: 9,
      chunk_count: 94,
      holdout_count: context.specifications.length,
      expected_retrieval_k0_count: context.amendment.expected_retrieval_k0_count,
      expected_no_sufficient_evidence_count: context.amendment.expected_no_sufficient_evidence_count,
      evidence_matcher_version: EVIDENCE_MATCHER_VERSION,
      evidence_matcher_hash: EVIDENCE_MATCHER_HASH,
      batch_freeze_content_hash: batchFreeze.deterministic_content_hash,
      provider_host: context.config.apiBase ? new URL(context.config.apiBase).hostname : null,
      provider_calls: 0,
      retrieval_executed: false
    }, null, 2));
    return;
  }
  const baselineFileShaBefore = fs.existsSync(BASELINE_REPLAY_PATH) ? sha256File(BASELINE_REPLAY_PATH).toUpperCase() : null;
  const supplementInfo = replayExisting
    ? {
      supplement: readJson(SUPPLEMENT_PATH),
      supplementFileSha256: sha256File(SUPPLEMENT_PATH).toUpperCase(),
      supplementContentHash: null
    }
    : await generateHoldoutSupplement(context, batchFreeze);
  supplementInfo.supplementContentHash = supplementInfo.supplementContentHash || supplementInfo.supplement.deterministic_content_hash;
  const reloadedSupplement = readJson(SUPPLEMENT_PATH);
  validateReloadedSupplement(reloadedSupplement, context.specifications);
  const replay1 = replayOnce(context, reloadedSupplement);
  const replayHash1 = deterministicContentHash(replay1);
  const replay2 = replayOnce(context, reloadedSupplement);
  const replayHash2 = deterministicContentHash(replay2);
  assert(replayHash1 === replayHash2, 'BLOCKED_RAG_P0_DETERMINISTIC_REPLAY_PARITY');
  const checkpoint = buildCheckpoint(context, batchFreeze, { ...supplementInfo, supplement: reloadedSupplement }, replay2, replayHash1, replayHash2, baselineFileShaBefore);
  writeJson(CHECKPOINT_PATH, checkpoint);
  writeCheckpointMarkdown(checkpoint);
  console.log(JSON.stringify({
    status: 'V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2',
    checkpoint: relative(CHECKPOINT_PATH),
    checkpoint_file_sha256: sha256File(CHECKPOINT_PATH).toUpperCase(),
    supplement: relative(SUPPLEMENT_PATH),
    supplement_file_sha256: supplementInfo.supplementFileSha256,
    supplement_content_hash: supplementInfo.supplementContentHash,
    provider_calls: 7,
    holdout_cases: replay2.case_count,
    replay_parity: replayHash1 === replayHash2,
    recommendation: checkpoint.next_intervention_recommendation.recommendation,
    safety: checkpoint.safety_metrics
  }, null, 2));
}

try {
  await main();
} catch (error) {
  const details = error.details || {};
  console.error(JSON.stringify({
    status: error.code || 'BLOCKED_RAG_P0_HOLDOUT_REPLAY',
    reason: error.message,
    details: {
      ...details,
      api_key_exposed: false,
      authorization_header_logged: false
    }
  }, null, 2));
  process.exitCode = 1;
}
