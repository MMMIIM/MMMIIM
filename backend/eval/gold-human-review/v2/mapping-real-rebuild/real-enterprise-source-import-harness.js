import crypto from 'node:crypto';
import { chunkEnterpriseMaterial } from '../../../../src/pipeline/enterprise-material-chunker.js';

/**
 * Eval-only source import planning. This module never persists materials,
 * chunks, embeddings, Facts, Mappings, Claims, or production state.
 */
export const HARNESS_SCHEMA_VERSION = 'v43-real-enterprise-source-import-harness-v1';

const text = value => value == null ? '' : String(value);

export function computeSourceHash(value) {
  return crypto.createHash('sha256').update(text(value), 'utf8').digest('hex');
}

function rejection(code, message) {
  return { ready: false, status: 'REJECTED', code, message };
}

/**
 * Perform only mechanical checks. A ready source is still pending GPT/Human
 * Fact review and is therefore labelled SOURCE_READY_FOR_GPT_REVIEW.
 */
export function validateSourceManifest(entry = {}, { snapshotText } = {}) {
  const required = ['source_id', 'enterprise_id', 'enterprise_name', 'source_type', 'material_type', 'expected_source_authority'];
  const missing = required.filter(key => !text(entry[key]).trim());
  if (missing.length) return rejection('SOURCE_MANIFEST_INVALID', `missing required fields: ${missing.join(',')}`);
  if (entry.synthetic_test_material === true) return rejection('SYNTHETIC_SOURCE_REJECTED', 'synthetic source cannot enter the real source import plan');
  if (entry.lifecycle_status === 'QUARANTINED' || entry.lifecycle === 'QUARANTINED') return rejection('QUARANTINED_SOURCE_REJECTED', 'quarantined source cannot enter the import plan');
  if (entry.internal_process_artifact === true) return rejection('INTERNAL_SOURCE_REJECTED', 'internal process artifact cannot enter the import plan');

  const hasSnapshot = snapshotText !== undefined && snapshotText !== null;
  const computedHash = hasSnapshot ? computeSourceHash(snapshotText) : null;
  if (hasSnapshot && entry.source_hash && entry.source_hash !== computedHash) {
    return rejection('SOURCE_SNAPSHOT_HASH_MISMATCH', 'source snapshot hash does not match the manifest');
  }

  const complete = Boolean(
    text(entry.source_url).trim() &&
    text(entry.retrieved_at).trim() &&
    text(entry.source_org || entry.source_organization).trim() &&
    hasSnapshot &&
    computedHash &&
    text(entry.review_status).trim()
  );
  if (!complete) {
    return {
      ready: false,
      status: 'PENDING_SOURCE_CANDIDATE',
      code: 'SOURCE_SNAPSHOT_INCOMPLETE',
      message: 'URL, retrieval metadata, immutable snapshot, hash and review metadata are required before GPT review preparation',
      computed_hash: computedHash
    };
  }
  return {
    ready: true,
    status: 'SOURCE_READY_FOR_GPT_REVIEW',
    code: null,
    source_hash: computedHash,
    review_status: entry.review_status,
    fact_ready: false
  };
}

export function assertEnterpriseIsolation(entries = []) {
  const ids = [...new Set(entries.map(entry => text(entry.enterprise_id).trim()).filter(Boolean))];
  if (ids.length > 1) {
    const error = new Error('one logical source scope may contain only one enterprise identity');
    error.code = 'CROSS_ENTERPRISE_CONTAMINATION';
    error.enterprise_ids = ids;
    throw error;
  }
  if (entries.some(entry => !text(entry.enterprise_id).trim())) {
    const error = new Error('enterprise identity is required for every source');
    error.code = 'ENTERPRISE_IDENTITY_REQUIRED';
    throw error;
  }
  return { ok: true, enterprise_id: ids[0] ?? null };
}

export function detectSourceMutation(previous = {}, current = {}) {
  const sameUrl = text(previous.source_url).trim() && text(previous.source_url).trim() === text(current.source_url).trim();
  const previousHash = text(previous.source_hash).trim();
  const currentHash = text(current.source_hash).trim();
  if (sameUrl && previousHash && currentHash && previousHash !== currentHash) {
    return { mutated: true, code: 'NEW_SOURCE_VERSION_REQUIRED', preserve_previous: true };
  }
  return { mutated: false, code: null, preserve_previous: true };
}

/** Build a non-persistent plan using the production enterprise chunker. */
export function buildImportPlan(entry, { snapshotText } = {}) {
  const validation = validateSourceManifest(entry, { snapshotText });
  if (!validation.ready) return { validation, db_writes: 0, fact_writes: 0, mapping_writes: 0, claim_writes: 0 };
  assertEnterpriseIsolation([entry]);
  const chunks = chunkEnterpriseMaterial(`source:${entry.source_id}`, snapshotText);
  return {
    schema_version: HARNESS_SCHEMA_VERSION,
    source_id: entry.source_id,
    enterprise_id: entry.enterprise_id,
    material_type: entry.material_type,
    source_hash: validation.source_hash,
    chunker_version: chunks[0]?.chunker_version ?? 'enterprise-material-v1',
    chunk_count: chunks.length,
    chunk_identity: chunks.map(chunk => ({ chunk_id: chunk.chunk_id, chunk_hash: chunk.chunk_hash })),
    validation,
    status: 'SOURCE_READY_FOR_GPT_REVIEW',
    fact_ready: false,
    db_writes: 0,
    fact_writes: 0,
    mapping_writes: 0,
    claim_writes: 0
  };
}

