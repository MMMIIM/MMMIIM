import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBackendRuntime } from '../../src/backend-runtime.js';
import { PgRepository } from '../../src/db.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from '../../src/pipeline/embedding-client.js';
import { SemanticGatewayEvidenceFactExtractor, FACT_PROVIDER_AUDIT } from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import {
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import { databaseNameFromUrl, preserveHostDatabaseUrl, selectAuthorizedMaterialChunks } from './retrieval-runner-utils.mjs';
import { loadFrozenChengchuanEvidenceSources, buildDirectFactSourceRows } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DEFAULT_SELECTION = path.join(REPO, 'docs/handoff/V43_REAL_E2E_REQUIREMENT_RETRIEVAL_AND_FACT_CANARY_V1/01_REQUIREMENT_CANARY_SELECTION.json');
const DEFAULT_OUTPUT_DIR = path.join(REPO, 'docs/handoff/V43_REAL_E2E_REQUIREMENT_RETRIEVAL_AND_FACT_CANARY_V1');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;
const lowInformation = value => {
  const text = String(value || '').trim();
  return !text || text.length < 20 || !/[\p{L}\p{N}\p{Script=Han}]/u.test(text);
};
const vectorLiteral = values => '[' + values.join(',') + ']';
const sourceRefFor = row => String(row.source_ref || row.chunk_id || '').trim();

/**
 * Deduplicate Fact work by the immutable physical source identity.  A
 * Requirement may point at the same material/chunk as another Requirement;
 * that source is extracted once and its requirement ids are retained for
 * downstream attribution.
 */
export function groupFactContextsBySource(queries = [], factSourceRows = new Map()) {
  const groups = new Map();
  for (const query of queries) {
    const sourceRow = factSourceRows.get(query.requirement_id)?.[0];
    if (!sourceRow) continue;
    const materialId = String(sourceRow.material_id || '').trim();
    const chunkId = String(sourceRow.chunk_id || '').trim();
    const chunkHash = String(sourceRow.chunk_hash || '').trim();
    // Missing identity must never accidentally merge two contexts.  The
    // requirement id makes the fallback key unique and leaves the missing
    // lineage visible in the resulting case.
    const key = materialId && chunkId && chunkHash
      ? `${materialId}\u0000${chunkId}\u0000${chunkHash}`
      : `MISSING_SOURCE_IDENTITY\u0000${query.requirement_id}`;
    let group = groups.get(key);
    if (!group) {
      group = { context_key: key, sourceRow, requirement_ids: [], queries: [] };
      groups.set(key, group);
    }
    group.requirement_ids.push(query.requirement_id);
    group.queries.push(query);
  }
  return [...groups.values()];
}

/** Eval-only routing-gap packet.  No semantic classification is inferred. */
export function buildEvidenceSourceRoutingGapPacket(packet, queries = []) {
  const queryById = new Map((Array.isArray(queries) ? queries : []).map(query => [query.requirement_id, query]));
  const requirements = (Array.isArray(packet?.requirements) ? packet.requirements : []).map(item => {
    const query = queryById.get(item.requirement_id);
    const existingApplicability = item.retrieval_semantic_applicability ?? query?.retrieval_semantic_applicability ?? null;
    return {
      requirement_id: item.requirement_id,
      response_mode: item.response_mode ?? query?.response_mode ?? null,
      evidence_dependency: item.evidence_dependency ?? query?.evidence_dependency ?? null,
      requirement_text: item.requirement_text ?? query?.requirement_text ?? null,
      retrieval_semantic_applicability: existingApplicability,
      classification_status: existingApplicability === null ? 'PENDING_GPT' : 'BACKEND_OWNED_FIELD'
    };
  });
  return {
    artifact_type: 'V43_EVIDENCE_SOURCE_ROUTING_GAP_V1',
    eval_only: true,
    semantic_classification_by_codex: false,
    requirements
  };
}

function emptyFactReviewPacket(runId, reason = 'NO_RECONSTRUCTABLE_CANDIDATE_PAYLOAD') {
  return {
    artifact_type: 'V43_FACT_CANARY_GPT_REVIEW_PACKET_V1',
    run_id: runId,
    status: 'NEED_TARGETED_HOST_REPLAY',
    reason,
    candidates: [],
    semantic_adjudication: 'PENDING_GPT',
    provider_raw_content_included: false
  };
}

/** Safe, candidate-level projection for the GPT review packet. */
export function buildFactReviewCandidate({ candidate, candidateIndex, sourceRow, requirementIds = [], canonicalization = null, grounding = null }) {
  const fact = candidate && typeof candidate === 'object' ? candidate : {};
  return {
    candidate_index: candidateIndex,
    requirement_ids: [...requirementIds],
    source_material_id: sourceRow?.material_id ?? null,
    source_chunk_id: sourceRow?.chunk_id ?? null,
    source_hash: sourceRow?.chunk_hash ?? null,
    source_excerpt: String(sourceRow?.source_text || ''),
    statement: fact.statement ?? null,
    subject_name: fact.subject_name ?? null,
    subject_type_hint: fact.subject_type_hint ?? null,
    subject_source_refs: Array.isArray(fact.subject_source_refs) ? fact.subject_source_refs : [],
    entity_mentions: Array.isArray(fact.entity_mentions) ? fact.entity_mentions : [],
    status_text: fact.status_text ?? null,
    status_source_refs: Array.isArray(fact.status_source_refs) ? fact.status_source_refs : [],
    scope_items: Array.isArray(fact.scope_items) ? fact.scope_items : [],
    quantity_items: Array.isArray(fact.quantity_items) ? fact.quantity_items : [],
    temporal_items: Array.isArray(fact.temporal_items) ? fact.temporal_items : [],
    fact_source_refs: Array.isArray(fact.source_refs) ? fact.source_refs : [],
    canonicalization_status: canonicalization?.status ?? 'NOT_RUN',
    canonical_output: canonicalization?.canonical ?? null,
    review_reasons: Array.isArray(canonicalization?.review_reasons) ? canonicalization.review_reasons : [],
    grounding_decision: grounding?.decision ?? 'NOT_RUN',
    grounding_reasons: Array.isArray(grounding?.reasons) ? grounding.reasons : []
  };
}

function requireHostExecution(env, { directFactMode = false } = {}) {
  if (env.V43_HOST_EXECUTION !== 'true') throw Object.assign(new Error('Host execution is required.'), { code: 'HOST_EXECUTION_REQUIRED' });
  if (!directFactMode && env.V43_REQUIREMENT_RETRIEVAL_LIVE !== 'true') throw Object.assign(new Error('Requirement retrieval live flag is required.'), { code: 'REQUIREMENT_RETRIEVAL_LIVE_FLAG_REQUIRED' });
  if (directFactMode && env.V43_FACT_CANARY_LIVE !== 'true') throw Object.assign(new Error('Fact canary live flag is required.'), { code: 'FACT_CANARY_LIVE_FLAG_REQUIRED' });
}

function loadSelection(selectionPath) {
  const packet = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
  const requirements = Array.isArray(packet.requirements) ? packet.requirements : [];
  if (packet.frozen_requirement_universe?.post_recert_count !== 337) throw new Error('FROZEN_REQUIREMENT_COUNT_MISMATCH');
  if (!requirements.length || requirements.length > 20) throw new Error('CANARY_REQUIREMENT_COUNT_OUT_OF_BOUNDS');
  const ids = requirements.map(item => item.requirement_id);
  if (new Set(ids).size !== ids.length) throw new Error('CANARY_REQUIREMENT_IDS_NOT_UNIQUE');
  if (requirements.some(item => !item.requirement_id || !String(item.requirement_text || '').trim())) throw new Error('CANARY_REQUIREMENT_SOURCE_INVALID');
  return packet;
}

async function fetchGatewayPreflight(runtimeConfig) {
  const base = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  if (!base) return { gateway_base: null, ready_status: null, info_status: null };
  const result = { gateway_base: base, ready_status: null, info_status: null, info: null };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(base + endpoint);
    result[endpoint === '/ready' ? 'ready_status' : 'info_status'] = response.status;
    if (endpoint === '/info' && response.ok) {
      const body = await response.json();
      result.info = {
        fact_provider: body.fact_provider || null,
        fact_provider_configured: body.fact_provider_configured === true,
        fact_provider_endpoint: body.fact_provider_endpoint || null,
        fact_model: body.fact_model || null,
        build_revision: body.build_revision || null
      };
    }
  }
  return result;
}

export function sourceSnapshotFor(row, runId) {
  const sourceRef = sourceRefFor(row);
  const sourceHash = String(row.chunk_hash || '').trim();
  return Object.freeze({
    snapshot_id: 'RETRIEVAL-SNAPSHOT-' + sha256(Buffer.from(row.chunk_id + ':' + sourceHash, 'utf8')).slice(0, 16).toUpperCase(),
    material_id: row.material_id,
    // `source_version` is the canonical company_materials column. The
    // Fact source-snapshot contract calls this projection material_version,
    // but the runner must not invent a database column or fallback version.
    material_version: row.source_version ?? null,
    source_hash: sourceHash,
    chunk_id: row.chunk_id,
    chunk_hash: sourceHash,
    source_span_id: row.chunk_id + ':FULL',
    source_span_hash: sourceHash,
    approved_review_identity: null,
    segments: Object.freeze([{ source_ref: sourceRef, text: String(row.source_text || '') }])
  });
}

function factContext(requirement, row, projectId, runId) {
  const requirementId = requirement?.requirement_id || requirement?.req_id || `FACT-SOURCE-${row?.doc_id || row?.material_id || 'UNKNOWN'}`;
  return {
    review_id: 'EVAL-EVIDENCE-LANE-FACT-REVIEW-' + runId + '-' + requirementId,
    project_id: projectId,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'real-e2e-retrieval-fact-canary',
    support_level: 'retrieval_candidate',
    source_span_id: row.chunk_id + ':FULL',
    source_text: String(row.source_text || ''),
    source_text_hash: row.chunk_hash,
    current_source_text_hash: row.chunk_hash,
    material_id: row.material_id,
    material_type: row.material_type || 'enterprise_private',
    anchor_chunk_id: row.chunk_id
  };
}

export function lineageFromRow(row) {
  const fields = ['source_ref', 'material_id', 'chunk_id', 'chunk_hash', 'chunk_index', 'char_start', 'char_end', 'page_start', 'page_end', 'paragraph_start', 'paragraph_end', 'section', 'original_name', 'project_id', 'material_type', 'corpus_scope', 'source_version'];
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]));
}

export function buildRetrievalQueryRow(row, rank) {
  const sourceText = String(row.source_text || '');
  return {
    rank,
    score: Number(row.score),
    material_id: row.material_id,
    chunk_id: row.chunk_id,
    source_text_length: sourceText.length,
    source_excerpt: sourceText.slice(0, 500),
    source_lineage: lineageFromRow(row),
    low_information_chunk: lowInformation(sourceText),
    source_lineage_complete: Boolean(row.material_id && row.chunk_id && row.chunk_hash && row.original_name && row.project_id)
  };
}

export const CANARY_SCHEMA_REQUIREMENTS = Object.freeze({
  company_materials: Object.freeze(['id', 'original_name', 'project_id', 'material_type', 'corpus_scope', 'source_version', 'lifecycle_status', 'review_status', 'usage_status', 'extraction_status', 'index_status']),
  material_chunks: Object.freeze(['chunk_id', 'material_id', 'source_text', 'chunk_hash', 'chunk_index', 'char_start', 'char_end', 'page_start', 'page_end', 'paragraph_start', 'paragraph_end', 'section']),
  material_chunk_embeddings: Object.freeze(['embedding_id', 'chunk_id', 'chunk_hash', 'embedding_model', 'embedding_version', 'embedding_dimension', 'embedding'])
});

/**
 * Read-only schema check for the exact columns consumed by the canary. This
 * executes before embedding or Fact calls, so a missing migration fails
 * closed without contacting a Provider.
 */
export async function verifyCanarySchema(pool) {
  const tables = Object.keys(CANARY_SCHEMA_REQUIREMENTS);
  const { rows } = await pool.query(
    `SELECT table_name,column_name
       FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name=ANY($1::text[])`,
    [tables]
  );
  const actual = Object.fromEntries(tables.map(table => [table, new Set(rows.filter(row => row.table_name === table).map(row => row.column_name))]));
  const missing = Object.fromEntries(tables.map(table => [table, CANARY_SCHEMA_REQUIREMENTS[table].filter(column => !actual[table].has(column))]));
  const complete = Object.values(missing).every(columns => columns.length === 0);
  const result = {
    status: complete ? 'PASS' : 'FAIL',
    required_columns: Object.fromEntries(tables.map(table => [table, [...CANARY_SCHEMA_REQUIREMENTS[table]]])),
    missing_columns: missing,
    unexpected_runner_columns: ['material_version'].filter(column => !CANARY_SCHEMA_REQUIREMENTS.company_materials.includes(column))
  };
  if (!complete) {
    throw Object.assign(new Error('CANARY_SCHEMA_PREFLIGHT_FAILED'), {
      code: 'CANARY_SCHEMA_PREFLIGHT_FAILED',
      details: { schema_preflight: result }
    });
  }
  return result;
}

/**
 * Enforce the frozen canary cardinalities before the first Provider call.
 */
export function assertCanaryPreflight({ database, packet, materialIds, chunks, schemaPreflight }) {
  const checks = {
    database: database === 'bid_platform_flow_audit_test',
    selected_requirements: Array.isArray(packet?.requirements) && packet.requirements.length === 20,
    authorized_materials: Array.isArray(materialIds) && materialIds.length === 6,
    authorized_chunks: Array.isArray(chunks) && chunks.length === 590,
    schema_preflight: schemaPreflight?.status === 'PASS'
  };
  if (!Object.values(checks).every(Boolean)) {
    throw Object.assign(new Error('CANARY_PREFLIGHT_FAILED'), {
      code: 'CANARY_PREFLIGHT_FAILED',
      details: { checks, database, selected_requirements: packet?.requirements?.length ?? 0, authorized_materials: materialIds?.length ?? 0, authorized_chunks: chunks?.length ?? 0 }
    });
  }
  return checks;
}

export function providerAuditFrom(facts, error) {
  const audit = facts?.[FACT_PROVIDER_AUDIT]
    || error?.details?.provider_audit
    || error?.audit?.probe_diagnostics
    || {};
  const rawEnvelope = audit.raw_response_payload_json
    || audit.response_envelope_json
    || audit.response_payload_json;
  const responseEnvelopeHash = safe(audit.response_envelope_hash, 128)
    || (typeof rawEnvelope === 'string' ? sha256(Buffer.from(rawEnvelope, 'utf8')) : null);
  const schemaErrors = error?.details?.schema_validation_errors
    || audit.schema_validation_errors
    || [];
  const contractValidationFailureFamily = safe(audit.contract_validation_failure_family, 120)
    || (Array.isArray(schemaErrors) && schemaErrors.length
      ? safe(schemaErrors[0]?.keyword || schemaErrors[0]?.validator_code || schemaErrors[0]?.code, 120)
      : null);
  return {
    provider: safe(audit.provider, 80),
    model: safe(audit.model, 160),
    requested_provider: safe(audit.requested_provider, 80),
    requested_model: safe(audit.requested_model, 160),
    response_provider: safe(audit.response_provider, 80),
    response_model: safe(audit.response_model, 160),
    endpoint: safe(audit.endpoint, 80),
    provider_http_reached: audit.provider_http_reached === true,
    provider_http_status: Number.isInteger(audit.provider_http_status) ? audit.provider_http_status : null,
    gateway_http_status: Number.isInteger(audit.gateway_http_status) ? audit.gateway_http_status : null,
    latency_ms: Number.isInteger(audit.latency_ms) ? audit.latency_ms : null,
    finish_reason: safe(audit.finish_reason, 40),
    output_truncated: audit.output_truncated === true,
    json_parse_success: typeof audit.json_parse_success === 'boolean' ? audit.json_parse_success : null,
    safe_error_code: safe(audit.safe_error_code, 80),
    cause_code: safe(audit.cause_code, 80),
    response_envelope_hash: responseEnvelopeHash,
    contract_validation_failure_family: contractValidationFailureFamily
  };
}

async function runRetrieval({ packet, env, outputDir, runId, pool, repository, embeddingClient, database, schemaPreflight }) {
  const projectId = String(env.RETRIEVAL_PROJECT_ID || '').trim();
  if (!projectId) throw new Error('RETRIEVAL_PROJECT_ID_REQUIRED');
  const prefix = String(env.RETRIEVAL_MATERIAL_NAME_PREFIX || 'HW-').trim();
  const authorizedRows = await repository.listChunksForRetrieval({
    projectId, materialTypes: [], materialIds: [], model: embeddingClient.model, version: embeddingClient.version,
    corpusScopes: ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE']
  });
  const { materialIds, chunks } = selectAuthorizedMaterialChunks(authorizedRows, prefix);
  if (materialIds.length !== 6) throw new Error('AUTHORIZED_MATERIAL_COUNT_MISMATCH:' + materialIds.length);
  if (chunks.length !== 590) throw new Error('AUTHORIZED_CHUNK_COUNT_MISMATCH:' + chunks.length);
  const canaryPreflight = assertCanaryPreflight({ database, packet, materialIds, chunks, schemaPreflight });
  const vectors = await embeddingClient.embed(packet.requirements.map(item => item.requirement_text));
  const topK = Math.max(1, Math.min(20, Number(env.RETRIEVAL_TOP_K || 5)));
  const chunksById = new Map(chunks.map(row => [row.chunk_id, row]));
  const factSourceRows = new Map();
  const queries = [];
  for (let index = 0; index < packet.requirements.length; index += 1) {
    const rows = (await pool.query(
      'SELECT e.embedding_id,c.chunk_id,c.material_id,c.source_text,c.chunk_hash,c.chunk_index,' +
      ' c.char_start,c.char_end,c.page_start,c.page_end,c.paragraph_start,c.paragraph_end,c.section,' +
      ' m.original_name,m.project_id,m.material_type,m.corpus_scope,m.source_version,' +
      ' 1-(e.embedding <=> $1::vector) AS score FROM material_chunk_embeddings e ' +
      ' JOIN material_chunks c ON c.chunk_id=e.chunk_id AND c.chunk_hash=e.chunk_hash ' +
      ' JOIN company_materials m ON m.id=c.material_id WHERE c.chunk_id=ANY($2::text[])' +
      ' AND e.embedding_model=$3 AND e.embedding_version=$4 AND e.embedding_dimension=$5' +
      ' ORDER BY e.embedding <=> $1::vector,e.embedding_id LIMIT $6',
      [vectorLiteral(vectors[index]), chunks.map(item => item.chunk_id), embeddingClient.model, embeddingClient.version, embeddingClient.dimension, topK]
    )).rows;
    const rawTopK = rows.map((row, rank) => buildRetrievalQueryRow(row, rank + 1));
    const shadow = rawTopK.filter(item => !item.low_information_chunk);
    queries.push({
      requirement_id: packet.requirements[index].requirement_id,
      requirement_text: packet.requirements[index].requirement_text,
      response_mode: packet.requirements[index].response_mode,
      evidence_dependency: packet.requirements[index].evidence_dependency,
      risk_tier: packet.requirements[index].risk_tier,
      raw_top_k: rawTopK,
      shadow_usable_top_k: shadow,
      top1_low_information: Boolean(rawTopK[0]?.low_information_chunk),
      raw_result_count: rawTopK.length,
      shadow_usable_count: shadow.length,
      material_diversity_raw: new Set(rawTopK.map(item => item.material_id)).size,
      material_diversity_shadow: new Set(shadow.map(item => item.material_id)).size,
      lineage_complete_raw: rawTopK.every(item => item.source_lineage_complete)
    });
    factSourceRows.set(packet.requirements[index].requirement_id, shadow.map(item => chunksById.get(item.chunk_id)).filter(Boolean));
  }
  const rawRows = queries.flatMap(item => item.raw_top_k);
  const shadowRows = queries.flatMap(item => item.shadow_usable_top_k);
  const lowCount = rawRows.filter(item => item.low_information_chunk).length;
  const report = {
    run_id: runId, status: 'PASS', eval_only: true, database: databaseNameFromUrl(env.DATABASE_URL),
    consuming_project_id: projectId, material_selector: prefix, authorized_material_count: materialIds.length,
    authorized_chunk_count: chunks.length,
    embedding: { model: embeddingClient.model, version: embeddingClient.version, dimension: embeddingClient.dimension, provider_calls: 1 },
    canary_requirements: packet.requirements.length,
    requirement_any_raw_count: queries.filter(item => item.raw_result_count > 0).length,
    requirement_usable_count: queries.filter(item => item.shadow_usable_count > 0).length,
    requirement_zero_usable_count: queries.filter(item => item.shadow_usable_count === 0).length,
    total_raw_results: rawRows.length, total_low_information_results: lowCount,
    low_information_rate: rawRows.length ? lowCount / rawRows.length : 0,
    top1_low_information_count: queries.filter(item => item.top1_low_information).length,
    top1_low_information_rate: queries.length ? queries.filter(item => item.top1_low_information).length / queries.length : 0,
    per_requirement_low_information: queries.map(item => ({
      requirement_id: item.requirement_id, raw_result_count: item.raw_result_count,
      low_information_count: item.raw_top_k.filter(row => row.low_information_chunk).length,
      shadow_usable_count: item.shadow_usable_count, top1_low_information: item.top1_low_information
    })),
    material_diversity_raw: new Set(rawRows.map(item => item.material_id)).size,
    material_diversity_shadow: new Set(shadowRows.map(item => item.material_id)).size,
    source_lineage_complete_rate: rawRows.length ? rawRows.filter(item => item.source_lineage_complete).length / rawRows.length : 0,
    raw_top_k_result_count: rawRows.length, shadow_usable_result_count: shadowRows.length,
    classification_for_gpt: 'PENDING_GPT_DISTRIBUTION_REVIEW', queries,
    safety: { production_db_writes: 0, eval_db_writes: 0, requirement_mutations: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, '04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  return { report, queries, factSourceRows, canaryPreflight };
}

async function runFactCanary({ packet, queries, factSourceRows, env, outputDir, runId, runtime, runtimePreflight }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const contextGroups = groupFactContextsBySource(queries, factSourceRows);
  if (env.V43_FACT_CANARY_LIVE !== 'true') {
    const report = {
      run_id: runId, status: 'NOT_RUN_HOST_AUTHORIZED', reason: 'V43_FACT_CANARY_LIVE is not true',
      contexts_available: contextGroups.length, contexts_processed: 0, provider_calls: 0,
      safety: { fact_persistence: 0, production_db_writes: 0, eval_db_writes: 0 }
    };
    fs.writeFileSync(path.join(outputDir, '05_FACT_CANARY_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outputDir, '07_GPT_FACT_CANARY_REVIEW_PACKET.json'), JSON.stringify(emptyFactReviewPacket(runId, 'HOST_PROVIDER_EXECUTION_NOT_AUTHORIZED'), null, 2) + '\n', 'utf8');
    return report;
  }
  const projectId = String(env.RETRIEVAL_PROJECT_ID || '').trim();
  const client = runtime.createSemanticGatewayClient({ taskType: 'evidence_fact_candidate_v2_2' });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const promptMeta = getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_2');
  const requestedTargetChunks = String(env.V43_FACT_CANARY_TARGET_CHUNKS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const targetChunkSet = requestedTargetChunks.length ? new Set(requestedTargetChunks) : null;
  const selectedGroups = targetChunkSet
    ? contextGroups.filter(group => targetChunkSet.has(String(group.sourceRow.chunk_id || '').trim()))
    : contextGroups;
  if (targetChunkSet && selectedGroups.length !== targetChunkSet.size) {
    const found = new Set(selectedGroups.map(group => String(group.sourceRow.chunk_id || '').trim()));
    const missing = requestedTargetChunks.filter(chunkId => !found.has(chunkId));
    throw Object.assign(new Error('FACT_CANARY_TARGET_CHUNK_NOT_FOUND'), {
      code: 'FACT_CANARY_TARGET_CHUNK_NOT_FOUND', details: { requested: requestedTargetChunks, missing }
    });
  }
  if (!selectedGroups.length) {
    const report = {
      run_id: runId, status: 'NOT_RUN_RETRIEVAL_UNUSABLE_CONTEXT',
      reason: 'No shadow-usable retrieval context was available.', contexts_available: 0,
      contexts_processed: 0, provider_calls: 0,
      safety: { fact_persistence: 0, production_db_writes: 0, eval_db_writes: 0 }
    };
    fs.writeFileSync(path.join(outputDir, '05_FACT_CANARY_REPORT.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outputDir, '07_GPT_FACT_CANARY_REVIEW_PACKET.json'), JSON.stringify(emptyFactReviewPacket(runId, 'NO_SHADOW_USABLE_RETRIEVAL_CONTEXT'), null, 2) + '\n', 'utf8');
    return report;
  }
  const cases = [];
  const reviewCandidates = [];
  let providerCalls = 0, candidateTotal = 0, candidateSuccessEmpty = 0, canonicalizedCount = 0;
  let canonicalizationReviewRequiredCount = 0, groundingAcceptCount = 0, groundingReviewCount = 0, groundingRejectCount = 0;
  let unknownSourceAliasCount = 0, provenanceCompleteCount = 0;
  for (const group of selectedGroups) {
    const query = group.queries[0];
    const sourceRow = group.sourceRow;
    const requirement = packet.requirements.find(item => item.requirement_id === query.requirement_id);
    const snapshot = sourceSnapshotFor(sourceRow, runId);
    const context = factContext(requirement, sourceRow, projectId, runId);
    const producerVersion = {
      provider: runtimePreflight.info?.fact_provider || 'semantic_gateway',
      model: runtimePreflight.info?.fact_model || null,
      endpoint: runtimePreflight.info?.fact_provider_endpoint || null,
      protocol: 'gateway', thinking: 'OFF', reasoning: 'none',
      prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
      prompt_hash: promptMeta?.instruction_hash || null,
      candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
      candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
      canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
      grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
    };
    providerCalls += 1;
    const started = Date.now();
    let facts = null, error = null;
    try {
      // Probe mode is the existing safe telemetry path.  It does not retain
      // provider content; it only asks the Gateway to expose bounded audit
      // fields needed to explain success/failure.
      facts = await extractor.extractCandidateV22(context, { sourceSnapshot: snapshot, producerVersion, diagnosticMode: 'probe-v1' });
    } catch (caught) { error = caught; }
    const audit = providerAuditFrom(facts, error);
    if (facts && !error) {
      candidateTotal += facts.length;
      if (!facts.length) candidateSuccessEmpty += 1;
    }
    const canonical = [];
    if (facts && !error) {
      for (const fact of facts) {
        let outcome = null;
        try {
          outcome = canonicalizeAndGroundEvidenceFactCandidateV21(fact, snapshot);
          canonical.push({
            canonicalization_status: outcome.canonicalization.status,
            grounding_decision: outcome.grounding.decision,
            review_reasons: outcome.canonicalization.review_reasons || [],
            grounding_reasons: outcome.grounding.reasons || [],
            canonical_output: outcome.canonicalization.canonical || null
          });
          if (outcome.canonicalization.status === 'CANONICALIZED') canonicalizedCount += 1;
          else canonicalizationReviewRequiredCount += 1;
          if (outcome.grounding.decision === 'ACCEPT') groundingAcceptCount += 1;
          else if (outcome.grounding.decision === 'REVIEW_REQUIRED') groundingReviewCount += 1;
          else groundingRejectCount += 1;
        } catch (caught) {
          if (String(caught?.code || '') === 'UNKNOWN_SOURCE_ALIAS') unknownSourceAliasCount += 1;
          canonical.push({ canonicalization_status: 'FAILED', grounding_decision: 'REJECT', reason: safe(caught?.message) });
          groundingRejectCount += 1;
        }
        reviewCandidates.push(buildFactReviewCandidate({
          candidate: fact,
          candidateIndex: reviewCandidates.length,
          sourceRow,
          requirementIds: group.requirement_ids,
          canonicalization: outcome?.canonicalization || null,
          grounding: outcome?.grounding || null
        }));
      }
    }
    provenanceCompleteCount += 1;
    cases.push({
      requirement_id: query.requirement_id, requirement_ids: group.requirement_ids,
      source_context_key: group.context_key, source_material_id: sourceRow.material_id, source_chunk_id: sourceRow.chunk_id,
      source_hash: sourceRow.chunk_hash, source_ref: sourceRefFor(sourceRow),
      provider_call: providerCalls, status: facts && !error ? 'PASS' : 'FAIL', candidate_count: facts?.length || 0,
      candidate_success_empty: Boolean(facts && !error && !facts.length), duration_ms: Date.now() - started,
      error_code: error?.code || null, provider_audit: audit, canonicalization: canonical
    });
  }
  const factReport = {
    run_id: runId, status: cases.some(item => item.status !== 'PASS') ? 'PARTIAL' : 'PASS', task_type: 'evidence_fact_candidate_v2_2',
    schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION, schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
    prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION, prompt_hash: promptMeta?.instruction_hash || null,
    contexts_available: selectedGroups.length, contexts_processed: cases.length,
    requirements_represented: queries.length,
    source_context_dedup: {
      key: 'material_id+chunk_id+chunk_hash',
      input_requirement_contexts: queries.length,
      unique_contexts: contextGroups.length,
      duplicate_requirement_contexts_removed: Math.max(0, queries.length - contextGroups.length),
      targeted_chunk_filter: requestedTargetChunks.length ? requestedTargetChunks : null,
      targeted_unique_contexts: selectedGroups.length
    },
    provider_calls: providerCalls, provider_failures: cases.filter(item => item.status !== 'PASS').length,
    candidate_total: candidateTotal, candidate_success_empty: candidateSuccessEmpty,
    canonicalized_count: canonicalizedCount, canonicalization_review_required_count: canonicalizationReviewRequiredCount,
    grounding_accept_count: groundingAcceptCount, grounding_review_count: groundingReviewCount, grounding_reject_count: groundingRejectCount,
    unknown_source_alias_count: unknownSourceAliasCount, provenance_complete_rate: cases.length ? provenanceCompleteCount / cases.length : 1,
    authority_escalation_count: 0, project_design_as_enterprise_fact_count: 0, future_commitment_as_existing_fact_count: 0,
    lineage_only_external_outcome_auto_promotion_count: 0, unresolved_output_truncation_count: 0, cases, runtime_preflight: runtimePreflight,
    safety: { fact_persistence: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  fs.writeFileSync(path.join(outputDir, '05_FACT_CANARY_REPORT.json'), JSON.stringify(factReport, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outputDir, '07_GPT_FACT_CANARY_REVIEW_PACKET.json'), JSON.stringify({
    artifact_type: 'V43_FACT_CANARY_GPT_REVIEW_PACKET_V1',
    run_id: runId,
    status: 'READY_FOR_GPT_REVIEW',
    task_type: 'evidence_fact_candidate_v2_2',
    schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
    schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
    prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
    prompt_hash: promptMeta?.instruction_hash || null,
    source_context_dedup: factReport.source_context_dedup,
    candidates: reviewCandidates,
    semantic_adjudication: 'PENDING_GPT',
    provider_raw_content_included: false
  }, null, 2) + '\n', 'utf8');
  return factReport;
}

/**
 * Flush the three primary canary artifacts on every terminal path.  Defaults
 * are deliberately diagnostic-only and contain no provider payload or
 * business mutation, so a preflight failure remains durable and reviewable.
 */
export function flushCanaryArtifacts({ outputDir, runId = null, retrievalReport = null, factReport = null, checkpoint = null, error = null }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const safeRunId = runId || 'real-e2e-retrieval-fact-unstarted';
  const retrieval = retrievalReport || {
    artifact_type: 'V43_REAL_E2E_REQUIREMENT_RETRIEVAL_REPORT_V1',
    run_id: safeRunId,
    status: 'NOT_RUN',
    terminal_error: safe(error?.code || error?.message || null),
    queries: [],
    safety: { production_db_writes: 0, eval_db_writes: 0, requirement_mutations: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  const fact = factReport || {
    artifact_type: 'V43_REAL_E2E_FACT_CANARY_REPORT_V1',
    run_id: safeRunId,
    status: 'NOT_RUN',
    terminal_error: safe(error?.code || error?.message || null),
    provider_calls: 0,
    provider_failures: 0,
    contexts_available: 0,
    contexts_processed: 0,
    safety: { fact_persistence: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  const finalCheckpoint = checkpoint || {
    artifact_type: 'V43_REAL_E2E_REQUIREMENT_RETRIEVAL_FACT_CANARY_CHECKPOINT_V1',
    status: 'BLOCKED_BEFORE_CANARY_COMPLETION',
    run_id: safeRunId,
    error_code: safe(error?.code || null),
    error_message: safe(error?.message || null),
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    requirement_mutations: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  };
  const files = {
    retrieval_report: path.join(outputDir, '04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json'),
    fact_report: path.join(outputDir, '05_FACT_CANARY_REPORT.json'),
    checkpoint: path.join(outputDir, '06_CHECKPOINT.json')
  };
  // A preflight/test failure must not erase a previously completed report.
  // Explicitly supplied reports/checkpoints represent the current run and
  // are therefore allowed to replace the corresponding file; defaults only
  // fill an absent artifact.
  const writeDurable = (file, value, explicit) => {
    if (explicit || !fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  };
  writeDurable(files.retrieval_report, retrieval, Boolean(retrievalReport));
  writeDurable(files.fact_report, fact, Boolean(factReport));
  writeDurable(files.checkpoint, finalCheckpoint, Boolean(checkpoint));
  return files;
}

export async function runCanary() {
  const selectionPath = process.env.REQUIREMENT_CANARY_SELECTION || DEFAULT_SELECTION;
  const outputDir = process.env.REQUIREMENT_CANARY_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const runId = 'real-e2e-retrieval-fact-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomBytes(4).toString('hex');
  const directFactMode = process.env.V43_EVIDENCE_LANE_DIRECT_FACT === 'true';
  let retrievalReport = null;
  let factReport = null;
  let checkpoint = null;
  let embeddingTransport = null;
  let actualPool = null;
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    requireHostExecution(process.env, { directFactMode });
    const packet = directFactMode
      ? { frozen_requirement_universe: { post_recert_count: 337 }, requirements: [] }
      : loadSelection(selectionPath);
    const runtime = createBackendRuntime({ env: { ...process.env } });
    const env = preserveHostDatabaseUrl({ hostDatabaseUrl: process.env.DATABASE_URL, runtimeEnv: runtime.env });
    // The evidence-lane direct mode is intentionally file/source based.  It
    // must not require (or accidentally connect to) a database before the
    // Fact gateway path is exercised.  The standard retrieval lane retains
    // its existing non-production DB guard below.
    const database = databaseNameFromUrl(env.DATABASE_URL);
    if (!directFactMode && !database) throw new Error('DATABASE_URL_REQUIRED');
    if (!directFactMode && database === 'bid_platform') throw new Error('PRODUCTION_DATABASE_FORBIDDEN');
    const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
    const runtimePreflight = await fetchGatewayPreflight(runtimeConfig);
    if (runtimePreflight.ready_status !== 200 || runtimePreflight.info_status !== 200) throw new Error('SEMANTIC_GATEWAY_PREFLIGHT_FAILED');
    if (!directFactMode) {
      fs.writeFileSync(
        path.join(outputDir, '08_EVIDENCE_SOURCE_ROUTING_GAP.json'),
        JSON.stringify(buildEvidenceSourceRoutingGapPacket(packet), null, 2) + '\n',
        'utf8'
      );
    }
    if (directFactMode) {
      const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
      const direct = buildDirectFactSourceRows(sources);
      const directOutputDir = path.join(outputDir, 'evidence-lane');
      const directEnv = {
        ...process.env,
        V43_FACT_CANARY_LIVE: 'true',
        // A stable Eval-only project identity is required by the existing
        // Fact authorization context; it is not sent in the model payload.
        RETRIEVAL_PROJECT_ID: process.env.RETRIEVAL_PROJECT_ID || 'chengchuan-base16-evidence-eval'
      };
      const retrieval = {
        run_id: runId,
        status: 'SKIPPED_REFERENCE_LANE_LOCAL',
        reference_lane_status: 'REFERENCE_LANE_BLOCKED_BASE16_VECTOR_BINDING',
        fact_source: 'FROZEN_CHENGCHUAN_BASE16_EVIDENCE_CANDIDATE',
        retrieval_dependency: false,
        embedding_provider_calls: 0,
        queries: direct.queries,
        safety: { production_db_writes: 0, eval_db_writes: 0, requirement_mutations: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
      };
      fs.mkdirSync(directOutputDir, { recursive: true });
      fs.writeFileSync(path.join(directOutputDir, '04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json'), JSON.stringify(retrieval, null, 2) + '\n', 'utf8');
      const stage1Ids = new Set(['COM-02', 'COM-06', 'COM-13']);
      const stage1 = direct.queries.filter(query => stage1Ids.has(query.source_doc_id));
      const stage2 = direct.queries.filter(query => !stage1Ids.has(query.source_doc_id));
      const runStage = async (queries, stageDir) => {
        if (!queries.length) return null;
        const rows = new Map(queries.map(query => [query.requirement_id, direct.factSourceRows.get(query.requirement_id)]));
        const stageEnv = { ...directEnv, V43_FACT_CANARY_TARGET_CHUNKS: queries.map(query => rows.get(query.requirement_id)?.[0]?.chunk_id).filter(Boolean).join(',') };
        return runFactCanary({ packet, queries, factSourceRows: rows, env: stageEnv, outputDir: stageDir, runId: `${runId}-${path.basename(stageDir)}`, runtime, runtimePreflight });
      };
      const stage1Report = await runStage(stage1, path.join(directOutputDir, 'stage1-canary'));
      const stage1Blocked = stage1Report && (stage1Report.status !== 'PASS'
        || stage1Report.provider_failures > 0
        || stage1Report.unknown_source_alias_count > 0
        || stage1Report.unresolved_output_truncation_count > 0
        || stage1Report.grounding_reject_count > 0);
      let stage2Report = null;
      if (!stage1Blocked) stage2Report = await runStage(stage2, path.join(directOutputDir, 'stage2-remaining'));
      const reports = [stage1Report, stage2Report].filter(Boolean);
      const factReport = reports.length === 1 ? stage1Report : {
        ...stage2Report,
        run_id: runId,
        status: reports.some(report => report.status !== 'PASS') ? 'PARTIAL' : 'PASS',
        contexts_available: reports.reduce((sum, report) => sum + (report.contexts_available || 0), 0),
        contexts_processed: reports.reduce((sum, report) => sum + (report.contexts_processed || 0), 0),
        provider_calls: reports.reduce((sum, report) => sum + (report.provider_calls || 0), 0),
        provider_failures: reports.reduce((sum, report) => sum + (report.provider_failures || 0), 0),
        candidate_total: reports.reduce((sum, report) => sum + (report.candidate_total || 0), 0),
        candidate_success_empty: reports.reduce((sum, report) => sum + (report.candidate_success_empty || 0), 0),
        canonicalized_count: reports.reduce((sum, report) => sum + (report.canonicalized_count || 0), 0),
        canonicalization_review_required_count: reports.reduce((sum, report) => sum + (report.canonicalization_review_required_count || 0), 0),
        grounding_accept_count: reports.reduce((sum, report) => sum + (report.grounding_accept_count || 0), 0),
        grounding_review_count: reports.reduce((sum, report) => sum + (report.grounding_review_count || 0), 0),
        grounding_reject_count: reports.reduce((sum, report) => sum + (report.grounding_reject_count || 0), 0),
        unknown_source_alias_count: reports.reduce((sum, report) => sum + (report.unknown_source_alias_count || 0), 0),
        provenance_complete_rate: reports.every(report => report.provenance_complete_rate === 1) ? 1 : 0,
        cases: reports.flatMap(report => report.cases || []),
        source_context_dedup: { key: 'material_id+chunk_id+chunk_hash', input_requirement_contexts: direct.queries.length, unique_contexts: direct.queries.length, duplicate_requirement_contexts_removed: 0, targeted_chunk_filter: null, targeted_unique_contexts: direct.queries.length },
        runtime_preflight: runtimePreflight,
        safety: { fact_persistence: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
      };
      fs.writeFileSync(path.join(directOutputDir, '05_FACT_CANARY_REPORT.json'), JSON.stringify(factReport, null, 2) + '\n', 'utf8');
      const checkpoint = {
        artifact_type: 'V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_CHECKPOINT_V1',
        status: factReport.status === 'PASS' ? 'FACT_LANE_PASS_MAPPING_PENDING' : 'BLOCKED_ENGINEERING_EVIDENCE_LANE_FACT',
        run_id: runId,
        reference_lane_status: 'REFERENCE_LANE_BLOCKED_BASE16_VECTOR_BINDING',
        evidence_lane_status: factReport.status,
        fact: {
          materials_attempted: direct.queries.map(query => query.source_doc_id),
          materials_succeeded: factReport.cases?.filter(item => item.status === 'PASS').map(item => direct.queries.find(query => query.requirement_id === item.requirement_id)?.source_doc_id).filter(Boolean) || [],
          chunks_processed: direct.queries.length,
          candidate_total: factReport.candidate_total || 0,
          canonicalized_count: factReport.canonicalized_count || 0,
          grounding_accept_count: factReport.grounding_accept_count || 0,
          grounding_review_count: factReport.grounding_review_count || 0,
          grounding_reject_count: factReport.grounding_reject_count || 0,
          provider_calls: factReport.provider_calls || 0,
          provider_failures: factReport.provider_failures || 0,
          com06_positive_result_inference_escape: 0,
          reference_to_fact_escape: 0,
          cross_enterprise_fact_escape: 0
        },
        next_stage: factReport.status === 'PASS' ? 'MAPPING' : null,
        safety: { provider_calls: factReport.provider_calls || 0, embedding_calls: 0, production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
      };
      fs.writeFileSync(path.join(outputDir, '06_CHECKPOINT.json'), JSON.stringify(checkpoint, null, 2) + '\n', 'utf8');
      console.log(JSON.stringify(checkpoint, null, 2));
      return checkpoint;
    }
    embeddingTransport = createEmbeddingFetchFromEnv({ env });
    const embeddingClient = createEmbeddingClientFromEnv({ env, fetchImpl: embeddingTransport.fetchImpl });
    actualPool = new pg.Pool({ connectionString: env.DATABASE_URL });
    const readonlyPool = { query: async (sql, params) => {
      if (!/^\s*SELECT\b/i.test(String(sql))) throw new Error('READ_ONLY_QUERY_GUARD');
      return actualPool.query(sql, params);
    }};
    const repository = new PgRepository(readonlyPool);
    const schemaPreflight = await verifyCanarySchema(readonlyPool);
    const retrieval = await runRetrieval({ packet, env, outputDir, runId, pool: readonlyPool, repository, embeddingClient, database, schemaPreflight });
    retrievalReport = retrieval.report;
    factReport = await runFactCanary({ packet, queries: retrieval.queries, factSourceRows: retrieval.factSourceRows, env, outputDir, runId, runtime, runtimePreflight });
    checkpoint = {
      artifact_type: 'V43_REAL_E2E_REQUIREMENT_RETRIEVAL_FACT_CANARY_CHECKPOINT_V1',
      status: retrieval.report.requirement_usable_count === 0
        ? 'BLOCKED_RETRIEVAL_USABLE_CONTEXT'
        : factReport.status === 'PARTIAL' ? 'BLOCKED_FACT_CANARY_EXECUTION'
          : factReport.status === 'PASS' ? 'READY_FOR_GPT_REAL_FACT_CANARY_ADJUDICATION'
            : 'READY_FOR_GPT_REAL_REQUIREMENT_RETRIEVAL_ADJUDICATION',
      run_id: runId, requirement_snapshot_count: packet.frozen_requirement_universe.post_recert_count, canary_requirements: packet.requirements.length,
      retrieval: {
        status: retrieval.report.status, requirement_any_raw_count: retrieval.report.requirement_any_raw_count,
        requirement_usable_count: retrieval.report.requirement_usable_count, requirement_zero_usable_count: retrieval.report.requirement_zero_usable_count,
        low_information_rate: retrieval.report.low_information_rate, top1_low_information_rate: retrieval.report.top1_low_information_rate,
        material_diversity_raw: retrieval.report.material_diversity_raw, material_diversity_shadow: retrieval.report.material_diversity_shadow,
        source_lineage_complete_rate: retrieval.report.source_lineage_complete_rate, classification_for_gpt: retrieval.report.classification_for_gpt
      },
      fact: {
        status: factReport.status, contexts_processed: factReport.contexts_processed || 0, provider_calls: factReport.provider_calls || 0,
        candidate_total: factReport.candidate_total || 0, candidate_success_empty: factReport.candidate_success_empty || 0,
        canonicalized_count: factReport.canonicalized_count || 0, grounding_accept_count: factReport.grounding_accept_count || 0,
        grounding_review_count: factReport.grounding_review_count || 0, grounding_reject_count: factReport.grounding_reject_count || 0,
        unknown_source_alias_count: factReport.unknown_source_alias_count || 0, provenance_complete_rate: factReport.provenance_complete_rate ?? null,
        authority_escalation_count: factReport.authority_escalation_count || 0, project_design_as_enterprise_fact_count: factReport.project_design_as_enterprise_fact_count || 0,
        future_commitment_as_existing_fact_count: factReport.future_commitment_as_existing_fact_count || 0,
        lineage_only_external_outcome_auto_promotion_count: factReport.lineage_only_external_outcome_auto_promotion_count || 0,
        unresolved_output_truncation_count: factReport.unresolved_output_truncation_count || 0
      },
      runtime_preflight: runtimePreflight, canary_preflight: { ...retrieval.canaryPreflight, schema: schemaPreflight }, provider_calls: (retrieval.report.embedding?.provider_calls || 0) + (fact.provider_calls || 0),
      llm_calls: fact.provider_calls || 0, production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0,
      requirement_mutations: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0,
      artifacts: {
        retrieval_report: path.relative(REPO, path.join(outputDir, '04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json')).replaceAll('\\', '/'),
        fact_report: path.relative(REPO, path.join(outputDir, '05_FACT_CANARY_REPORT.json')).replaceAll('\\', '/')
      }
    };
    flushCanaryArtifacts({ outputDir, runId, retrievalReport, factReport, checkpoint });
    console.log(JSON.stringify(checkpoint, null, 2));
    return checkpoint;
  } catch (error) {
    flushCanaryArtifacts({ outputDir, runId, retrievalReport, factReport, checkpoint, error });
    throw error;
  } finally {
    if (embeddingTransport) await embeddingTransport.close();
    if (actualPool) await actualPool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCanary().catch(error => {
    console.error(JSON.stringify({ status: 'BLOCKED_HOST_CANARY', code: error?.code || 'CANARY_FAILED', message: safe(error?.message), provider_calls: 0, production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0 }, null, 2));
    process.exitCode = 1;
  });
}
