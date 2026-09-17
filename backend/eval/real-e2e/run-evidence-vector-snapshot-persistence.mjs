import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmbeddingClientFromEnv } from '../../src/pipeline/embedding-client.js';
import { buildEvidenceNeedProfile } from '../../src/evidence-need-profile-builder.js';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SNAPSHOT_DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const ROUTER_PATH = path.join(REPO, 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const AUTHORITY = 'SYNTHETIC_EVAL_ONLY';
const PRODUCTION_AUTHORITY = 'NONE';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const EXPECTED_MATERIALS = Object.freeze(['COM-02', 'COM-03', 'COM-04', 'COM-06', 'COM-07', 'COM-08', 'COM-13', 'COM-14', 'COM-15']);
const REQUIREMENT_IDS = Object.freeze(['JY-001:REQ-057', 'FAST-01:REQ-005', 'FAST-04:REQ-004']);
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EMBEDDING_VERSION = '1';
const EMBEDDING_DIMENSION = 1024;
const EMBEDDING_CALL_CAP = 4;
const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const text = value => String(value ?? '').trim();
const keyOf = item => `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
const json = value => JSON.stringify(value, null, 2) + '\n';
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });

function sourceIdentityHash(sources) {
  const rows = sources.flatMap(source => source.chunks.map(chunk => ({
    material_id: chunk.material_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash
  })));
  return sha256(JSON.stringify(rows));
}

function validateFrozenSources(sources) {
  const chunks = sources.flatMap(source => source.chunks.map(chunk => ({
    ...chunk,
    enterprise_id: source.enterprise_id,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    corpus_scope: source.corpus_scope,
    semantic_review_status: source.semantic_review_status,
    doc_id: source.doc_id
  })));
  const identityHash = sourceIdentityHash(sources);
  const uniqueKeys = new Set(chunks.map(keyOf));
  const referenceOnlyEscape = chunks.filter(item => item.source_role !== 'EVIDENCE_CANDIDATE').length;
  const crossEnterpriseEscape = chunks.filter(item => item.enterprise_id !== ENTERPRISE_ID).length;
  const quarantineEscape = chunks.filter(item => text(item.semantic_review_status).toUpperCase() === 'QUARANTINED').length;
  const observedMaterials = sources.map(source => source.doc_id);
  const valid = sources.length === 9
    && chunks.length === 94
    && JSON.stringify(observedMaterials) === JSON.stringify(EXPECTED_MATERIALS)
    && identityHash === EXPECTED_IDENTITY_HASH
    && uniqueKeys.size === 94
    && sources.every(source => source.source_role === 'EVIDENCE_CANDIDATE')
    && sources.every(source => source.authority === AUTHORITY)
    && sources.every(source => source.production_authority === PRODUCTION_AUTHORITY)
    && chunks.every(item => item.corpus_scope === 'ENTERPRISE_PRIVATE')
    && referenceOnlyEscape === 0
    && crossEnterpriseEscape === 0
    && quarantineEscape === 0
    && chunks.every(item => text(item.source_text));
  if (!valid) throw fail('EVIDENCE_VECTOR_SOURCE_IDENTITY_PARITY', {
    material_count: sources.length,
    chunk_count: chunks.length,
    observed_materials: observedMaterials,
    identity_hash: identityHash,
    expected_identity_hash: EXPECTED_IDENTITY_HASH,
    unique_chunk_id_count: uniqueKeys.size,
    reference_only_escape: referenceOnlyEscape,
    cross_enterprise_escape: crossEnterpriseEscape,
    quarantine_escape: quarantineEscape
  });
  return { chunks, identityHash, referenceOnlyEscape, crossEnterpriseEscape, quarantineEscape };
}

function loadQuerySpecifications(sources) {
  const router = JSON.parse(readFileSync(ROUTER_PATH, 'utf8'));
  const projectId = sources[0]?.project_id || null;
  return REQUIREMENT_IDS.map(requirementId => {
    const row = (router.rows || []).find(item => item.requirement_id === requirementId);
    if (!row) throw fail('EVIDENCE_VECTOR_REQUIREMENT_NOT_FOUND', { requirement_id: requirementId });
    const requirement = {
      requirement_id: requirementId,
      text: row.requirement_text,
      project_id: projectId
    };
    const profile = buildEvidenceNeedProfile({
      requirement,
      responseDecision: {
        response_mode: row.v223?.response_mode || 'NEED_REVIEW',
        risk_tier: row.v223?.risk_tier || 'HIGH',
        response_required: row.v223?.response_required
      },
      enterpriseId: ENTERPRISE_ID
    });
    return {
      requirement_id: requirementId,
      query_text: row.requirement_text,
      query_hash: sha256(row.requirement_text),
      profile_hash: profile.profile_hash,
      profile_class: profile.evidence_need_class
    };
  });
}

function vectorIdentityProjection(rows) {
  return rows.map(row => ({
    storage_identity: row.storage_identity,
    enterprise_id: row.enterprise_id,
    material_id: row.material_id,
    chunk_id: row.chunk_id,
    chunk_hash: row.chunk_hash,
    source_role: row.source_role,
    embedding_provider: row.embedding_provider,
    embedding_model: row.embedding_model,
    embedding_version: row.embedding_version,
    vector_dimension: row.vector_dimension
  }));
}

function vectorIdentityHash(rows) {
  return sha256(JSON.stringify(vectorIdentityProjection(rows)));
}

function vectorArtifactHash(rows) {
  return sha256(JSON.stringify(rows));
}

function queryArtifactHash(rows) {
  return sha256(JSON.stringify(rows));
}

function assertVector(vector, dimension, code, details = {}) {
  if (!Array.isArray(vector) || vector.length !== dimension || vector.some(value => !Number.isFinite(value))) {
    throw fail(code, { ...details, observed_dimension: Array.isArray(vector) ? vector.length : null, expected_dimension: dimension });
  }
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
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function endpointIdentity(apiBase) {
  try {
    const endpoint = new URL(apiBase);
    return {
      endpoint_host: endpoint.hostname,
      endpoint_path: endpoint.pathname,
      endpoint_fingerprint: sha256(`${endpoint.protocol}//${endpoint.host}${endpoint.pathname}`)
    };
  } catch {
    return { endpoint_host: null, endpoint_path: null, endpoint_fingerprint: null };
  }
}

async function run() {
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  const frozen = validateFrozenSources(sources);
  const queries = loadQuerySpecifications(sources);
  const providerCalls = [];
  let providerCallCount = 0;
  const fetchImpl = async (url, options = {}) => {
    if (providerCallCount >= EMBEDDING_CALL_CAP) throw fail('EMBEDDING_PROVIDER_CALL_CAP_EXCEEDED');
    providerCallCount += 1;
    const call = {
      call_number: providerCallCount,
      request_payload_hash: sha256(options.body || ''),
      provider_http_status: null,
      response_envelope_keys: null,
      response_data_count: null,
      response_json_valid: null,
      transport_error: null
    };
    providerCalls.push(call);
    try {
      const response = await fetch(url, options);
      call.provider_http_status = response.status;
      try {
        const payload = await response.clone().json();
        call.response_envelope_keys = Object.keys(payload || {}).sort();
        call.response_data_count = Array.isArray(payload?.data) ? payload.data.length : null;
        call.response_json_valid = true;
      } catch {
        call.response_json_valid = false;
      }
      return response;
    } catch (error) {
      call.transport_error = error?.code || error?.name || 'UNKNOWN_TRANSPORT_ERROR';
      throw error;
    }
  };
  const client = createEmbeddingClientFromEnv({
    env: { ...process.env, EMBEDDING_PROXY_URL: '' },
    fetchImpl
  });
  if (client.model !== EMBEDDING_MODEL || client.version !== EMBEDDING_VERSION || Number(client.dimension) !== EMBEDDING_DIMENSION) {
    throw fail('EVIDENCE_VECTOR_EMBEDDING_CONFIG_MISMATCH', {
      model: client.model,
      version: client.version,
      dimension: client.dimension
    });
  }
  const provider = endpointIdentity(client.apiBase).endpoint_host || 'configured_embedding_provider';
  const embedOne = async (label, input, metadata = {}) => {
    if (providerCallCount >= EMBEDDING_CALL_CAP) throw fail('EMBEDDING_PROVIDER_CALL_CAP_EXCEEDED');
    const before = providerCallCount;
    try {
      const vectors = await client.embed(input);
      const call = providerCalls[providerCalls.length - 1] || {};
      return {
        status: 'PASS',
        label,
        provider_calls: providerCallCount - before,
        vector_count: vectors.length,
        vector_dimension: vectors[0]?.length || null,
        request_payload_hash: call.request_payload_hash || null,
        provider_http_status: call.provider_http_status,
        response_envelope_keys: call.response_envelope_keys,
        response_data_count: call.response_data_count,
        response_json_valid: call.response_json_valid,
        ...metadata,
        vectors
      };
    } catch (error) {
      const call = providerCalls[providerCalls.length - 1] || {};
      throw fail(error?.code || 'EVIDENCE_VECTOR_EMBEDDING_CALL_FAILED', {
        label,
        provider_calls: providerCallCount - before,
        request_payload_hash: call.request_payload_hash || null,
        provider_http_status: call.provider_http_status,
        response_envelope_keys: call.response_envelope_keys,
        response_data_count: call.response_data_count,
        response_json_valid: call.response_json_valid,
        transport_error: call.transport_error,
        ...metadata
      });
    }
  };

  const batch = await embedOne('frozen_94_chunk_batch', frozen.chunks.map(item => item.source_text), {
    material_count: 9,
    chunk_count: 94,
    identity_hash: frozen.identityHash
  });
  if (batch.provider_calls !== 1 || batch.vector_count !== 94) {
    throw fail('EVIDENCE_VECTOR_BATCH_RESPONSE_INVALID', {
      provider_calls: providerCallCount,
      batch: { ...batch, vectors: undefined }
    });
  }
  batch.vectors.forEach((vector, index) => assertVector(vector, EMBEDDING_DIMENSION, 'EVIDENCE_VECTOR_BATCH_DIMENSION_MISMATCH', { index }));

  const queryResults = [];
  for (const query of queries) {
    const result = await embedOne('requirement_query_vector', [query.query_text], {
      requirement_id: query.requirement_id,
      query_hash: query.query_hash,
      profile_hash: query.profile_hash
    });
    if (result.provider_calls !== 1 || result.vector_count !== 1) {
      throw fail('EVIDENCE_VECTOR_QUERY_RESPONSE_INVALID', {
        provider_calls: providerCallCount,
        requirement_id: query.requirement_id
      });
    }
    assertVector(result.vectors[0], EMBEDDING_DIMENSION, 'EVIDENCE_VECTOR_QUERY_DIMENSION_MISMATCH', { requirement_id: query.requirement_id });
    queryResults.push({
      requirement_id: query.requirement_id,
      query_hash: query.query_hash,
      profile_hash: query.profile_hash,
      vector: result.vectors[0],
      request_payload_hash: result.request_payload_hash,
      provider_http_status: result.provider_http_status,
      response_envelope_keys: result.response_envelope_keys,
      response_data_count: result.response_data_count,
      response_json_valid: result.response_json_valid
    });
  }
  if (providerCallCount !== 4) throw fail('EVIDENCE_VECTOR_PROVIDER_CALL_COUNT_MISMATCH', { provider_calls: providerCallCount });

  const snapshotId = `EVSNAP-${randomUUID().toUpperCase()}`;
  const vectorRows = frozen.chunks.map((item, index) => ({
    storage_identity: `EVEC-${sha256(`${snapshotId}|${keyOf(item)}`).slice(0, 32).toUpperCase()}`,
    enterprise_id: item.enterprise_id,
    material_id: item.material_id,
    chunk_id: item.chunk_id,
    chunk_hash: item.chunk_hash,
    source_role: item.source_role,
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    embedding_provider: provider,
    embedding_model: client.model,
    embedding_version: client.version,
    vector_dimension: client.dimension,
    vector: batch.vectors[index]
  }));
  const queryRows = queryResults.map(query => ({
    ...query,
    snapshot_id: snapshotId,
    embedding_provider: provider,
    embedding_model: client.model,
    embedding_version: client.version,
    vector_dimension: client.dimension
  }));
  const endpoint = endpointIdentity(client.apiBase);
  const manifest = {
    snapshot_id: snapshotId,
    enterprise_id: ENTERPRISE_ID,
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    material_count: 9,
    chunk_count: 94,
    identity_hash: frozen.identityHash,
    embedding_provider: provider,
    ...endpoint,
    embedding_model: client.model,
    embedding_version: client.version,
    vector_dimension: client.dimension,
    generated_at: new Date().toISOString(),
    retry_policy: '0',
    concurrency: 1,
    existing_vector_reused_count: 0,
    new_vector_generated_count: 94,
    vector_identity_fields: ['enterprise_id', 'material_id', 'chunk_id', 'chunk_hash', 'source_role', 'embedding_provider', 'embedding_model', 'embedding_version', 'vector_dimension'],
    vector_identity_hash: vectorIdentityHash(vectorRows),
    vector_artifact_hash: vectorArtifactHash(vectorRows),
    query_artifact_hash: queryArtifactHash(queryRows.map(row => ({ ...row, vector: undefined }))),
    provider_calls: providerCallCount,
    request_payload_hashes: providerCalls.map(call => call.request_payload_hash)
  };
  let snapshot = {
    artifact_type: 'V43_EVIDENCE_VECTOR_SNAPSHOT_PERSISTENCE_V1',
    manifest,
    vectors: vectorRows,
    query_vectors: queryRows
  };
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const snapshotPath = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
  await writeFile(snapshotPath, json(snapshot), 'utf8');

  batch.vectors = null;
  queryResults.forEach(query => { query.vector = null; });
  queryRows.forEach(query => { query.vector = null; });
  vectorRows.forEach(row => { row.vector = null; });
  snapshot = null;
  const reloaded = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const reloadedSources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  const reloadedFrozen = validateFrozenSources(reloadedSources);
  const expectedKeys = new Set(reloadedFrozen.chunks.map(keyOf));
  const reloadedKeys = new Set((reloaded.vectors || []).map(keyOf));
  const reloadVectorRows = reloaded.vectors || [];
  const reloadQueryRows = reloaded.query_vectors || [];
  const reloadProviderExact = reloadVectorRows.every(row => row.embedding_provider === provider)
    && reloadQueryRows.every(row => row.embedding_provider === provider);
  const reloadModelExact = reloadVectorRows.every(row => row.embedding_model === client.model && row.embedding_version === client.version && Number(row.vector_dimension) === EMBEDDING_DIMENSION)
    && reloadQueryRows.every(row => row.embedding_model === client.model && row.embedding_version === client.version && Number(row.vector_dimension) === EMBEDDING_DIMENSION);
  const reloadVectorsValid = reloadVectorRows.every(row => assertVector(row.vector, EMBEDDING_DIMENSION, 'EVIDENCE_VECTOR_SNAPSHOT_RELOAD_VECTOR_INVALID', { chunk_id: row.chunk_id }) === undefined);
  const reloadQueriesValid = reloadQueryRows.every(row => assertVector(row.vector, EMBEDDING_DIMENSION, 'EVIDENCE_VECTOR_SNAPSHOT_RELOAD_QUERY_INVALID', { requirement_id: row.requirement_id }) === undefined);
  const reloadParity = {
    chunk_vectors: reloadVectorRows.length === 94 && reloadedKeys.size === 94 && [...expectedKeys].every(key => reloadedKeys.has(key)),
    materials: new Set(reloadVectorRows.map(row => row.material_id)).size === 9,
    identity_hash: reloaded.manifest?.identity_hash === EXPECTED_IDENTITY_HASH && reloadedFrozen.identityHash === EXPECTED_IDENTITY_HASH,
    provider_identity: reloadProviderExact && reloaded.manifest?.embedding_provider === provider,
    model_version_dimension: reloadModelExact && reloaded.manifest?.embedding_model === client.model && reloaded.manifest?.embedding_version === client.version && Number(reloaded.manifest?.vector_dimension) === EMBEDDING_DIMENSION,
    vector_identity_hash: reloaded.manifest?.vector_identity_hash === vectorIdentityHash(reloadVectorRows),
    vector_artifact_hash: reloaded.manifest?.vector_artifact_hash === vectorArtifactHash(reloadVectorRows),
    query_vectors: reloadQueryRows.length === 3 && REQUIREMENT_IDS.every(id => reloadQueryRows.some(row => row.requirement_id === id)),
    query_metadata: reloadQueryRows.every(row => queries.some(query => query.requirement_id === row.requirement_id && query.query_hash === row.query_hash && query.profile_hash === row.profile_hash)),
    query_vectors_valid: reloadQueriesValid,
    vectors_valid: reloadVectorsValid
  };
  if (Object.values(reloadParity).some(value => value !== true)) {
    throw fail('BLOCKED_EVIDENCE_VECTOR_SNAPSHOT_RELOAD_PARITY', { snapshot_path: snapshotPath, reload_parity: reloadParity });
  }

  const sourceByKey = new Map(reloadedSources.flatMap(source => source.chunks.map(chunk => [keyOf({ material_id: chunk.material_id, chunk_id: chunk.chunk_id, chunk_hash: chunk.chunk_hash }), {
    ...chunk,
    enterprise_id: source.enterprise_id,
    source_role: source.source_role,
    authority: source.authority,
    production_authority: source.production_authority,
    semantic_review_status: source.semantic_review_status,
    doc_id: source.doc_id
  }])));
  const isolation = {
    reference_only_escape: reloadVectorRows.filter(row => row.source_role !== 'EVIDENCE_CANDIDATE').length,
    cross_enterprise_escape: reloadVectorRows.filter(row => row.enterprise_id !== ENTERPRISE_ID).length,
    quarantine_escape: reloadVectorRows.filter(row => text(sourceByKey.get(keyOf(row))?.semantic_review_status).toUpperCase() === 'QUARANTINED').length
  };
  if (Object.values(isolation).some(value => value !== 0)) throw fail('EVIDENCE_SEARCH_SOURCE_ISOLATION_FAILURE', isolation);

  const searchResults = queries.map(query => {
    const queryRow = reloadQueryRows.find(row => row.requirement_id === query.requirement_id);
    const candidates = reloadVectorRows
      .filter(row => sourceByKey.has(keyOf(row)) && row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID)
      .map(row => ({ row, similarity: cosine(queryRow.vector, row.vector) }))
      .sort((left, right) => right.similarity - left.similarity || keyOf(left.row).localeCompare(keyOf(right.row)))
      .slice(0, 5);
    const searchRunId = `ESEARCH-${sha256(`${snapshotId}|${query.requirement_id}|${query.profile_hash}`).slice(0, 24).toUpperCase()}`;
    const topCandidates = candidates.map((item, index) => ({
      requirement_id: query.requirement_id,
      rank: index + 1,
      similarity: Number(item.similarity.toFixed(12)),
      material_id: item.row.material_id,
      chunk_id: item.row.chunk_id,
      chunk_hash: item.row.chunk_hash,
      source_span: `${item.row.chunk_id}:FULL`,
      source_role: item.row.source_role,
      enterprise_id: item.row.enterprise_id,
      search_run_id: searchRunId,
      profile_hash: query.profile_hash
    }));
    return {
      requirement_id: query.requirement_id,
      evidence_need_profile_class: query.profile_class,
      search_query_hash: query.query_hash,
      candidate_count: topCandidates.length,
      top_k: topCandidates,
      duplicate_candidate_count: topCandidates.length - new Set(topCandidates.map(keyOf)).size,
      search_run_lineage_complete: topCandidates.every(row => row.requirement_id && Number.isInteger(row.rank) && Number.isFinite(row.similarity) && row.material_id && row.chunk_id && row.chunk_hash && row.source_span && row.source_role && row.enterprise_id && row.search_run_id && row.profile_hash)
    };
  });
  const duplicateCount = searchResults.reduce((total, result) => total + result.duplicate_candidate_count, 0);
  const k0Count = searchResults.filter(result => result.candidate_count === 0).length;
  const retrievalReport = {
    status: 'EVIDENCE_VECTOR_SNAPSHOT_PERSISTENCE_AND_RETRIEVAL_PASS',
    snapshot_id: snapshotId,
    snapshot_path: snapshotPath,
    snapshot_type: 'LOCAL_EVAL_JSON_ARTIFACT',
    embedding_calls: providerCallCount,
    existing_exact_vectors_reused: 0,
    new_chunk_vectors_generated: 94,
    chunk_material_count: 9,
    chunk_count: 94,
    identity_hash: EXPECTED_IDENTITY_HASH,
    provider_identity: { provider, ...endpoint },
    model: client.model,
    version: client.version,
    dimension: EMBEDDING_DIMENSION,
    reload_parity: reloadParity,
    requirements: searchResults,
    k0_count: k0Count,
    duplicate_candidate_count: duplicateCount,
    ...isolation,
    search_run_lineage_complete: searchResults.every(result => result.search_run_lineage_complete),
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    retrieval_provider_calls: 0
  };
  const reportPath = path.join(SNAPSHOT_DIR, `${snapshotId}.retrieval-report.json`);
  await writeFile(reportPath, json(retrievalReport), 'utf8');
  console.log(JSON.stringify({ ...retrievalReport, report_path: reportPath }, null, 2));
}

run().catch(error => {
  console.log(JSON.stringify({
    status: error.code || 'BLOCKED_EVIDENCE_VECTOR_SNAPSHOT_EXECUTION',
    details: error.details || {},
    provider_calls: error.details?.provider_calls || 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0
  }, null, 2));
  process.exitCode = 1;
});
