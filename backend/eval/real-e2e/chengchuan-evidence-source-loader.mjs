import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE16_DOC_IDS = Object.freeze([
  'COM-01', 'COM-02', 'COM-03', 'COM-04', 'COM-05', 'COM-06', 'COM-07', 'COM-08',
  'COM-09', 'COM-10', 'COM-11', 'COM-12', 'COM-13', 'COM-14', 'COM-15', 'COM-16'
]);
const EVIDENCE_DOC_IDS = Object.freeze([
  'COM-02', 'COM-03', 'COM-04', 'COM-06', 'COM-07', 'COM-08', 'COM-13', 'COM-14', 'COM-15'
]);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonl = text => String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line));
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });

function isSubstantive(row) {
  const text = String(row?.source_text || '').trim();
  if (!text || /^#{1,6}\s+/.test(text)) return false;
  if (/Synthetic Company Evidence/.test(text) && /仅用于/.test(text)) return false;
  return text.length >= 24 && /[\p{L}\p{N}\p{Script=Han}]/u.test(text);
}

function normalizeDocId(value) {
  const match = String(value || '').match(/^(COM-(?:0[1-9]|1[0-6]))(?:_|$)/);
  return match?.[1] || null;
}

async function readRoleSnapshot(snapshotPath) {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } catch (error) {
    throw fail('CHENGCHUAN_ROLE_SNAPSHOT_UNAVAILABLE', { path: snapshotPath, cause: String(error?.code || error) });
  }
  if (snapshot?.freeze_status !== 'FROZEN_FOR_ENGINEERING_E2E'
    || snapshot?.authority !== 'SYNTHETIC_EVAL_ONLY'
    || snapshot?.production_authority !== 'NONE'
    || snapshot?.enterprise_id !== 'SYNTH-CHENGCHUAN-001'
    || !Array.isArray(snapshot?.materials)
    || snapshot.materials.length !== 16) {
    throw fail('CHENGCHUAN_ROLE_SNAPSHOT_INVALID', { path: snapshotPath });
  }
  const roles = new Map(snapshot.materials.map(item => [item.doc_id, item]));
  if (BASE16_DOC_IDS.some(id => !roles.has(id))) throw fail('CHENGCHUAN_ROLE_SNAPSHOT_ENTRY_MISSING');
  return { snapshot, roles };
}

/**
 * Load the exact Base16 source/chunk snapshot and apply the frozen role
 * snapshot.  This is an Eval-only source boundary: it never consults
 * retrieval results, embeddings, or Requirement text.
 */
export async function loadFrozenChengchuanEvidenceSources({
  repoRoot,
  chunksPath = null,
  roleSnapshotPath = null,
  sourceRoot = null
} = {}) {
  const root = repoRoot || path.resolve(import.meta.dirname, '../../..');
  const resolvedChunksPath = chunksPath || path.join(root, 'backend/eval/rag-pilot/results/all_package_chunks.jsonl');
  const resolvedRolePath = roleSnapshotPath || path.join(root, 'docs/handoff/V43_PRE_E2E_GOVERNANCE_AND_MAPPING_READINESS_CLOSURE_V1/21_CHENGCHUAN_SOURCE_ROLE_MODEL_CORRECTED.json');
  const resolvedSourceRoot = sourceRoot || path.join(root, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/03_company_case_rag');
  let rows;
  try {
    rows = jsonl(await readFile(resolvedChunksPath, 'utf8'))
      .map(row => ({ ...row, doc_id: row.doc_id || normalizeDocId(row.filename) }))
      .filter(row => BASE16_DOC_IDS.includes(row.doc_id));
  } catch (error) {
    throw fail('CHENGCHUAN_BASE16_CHUNK_SNAPSHOT_UNAVAILABLE', { path: resolvedChunksPath, cause: String(error?.code || error) });
  }
  if (rows.length !== 160) throw fail('CHENGCHUAN_BASE16_CHUNK_COUNT_MISMATCH', { actual: rows.length, expected: 160 });
  const { snapshot, roles } = await readRoleSnapshot(resolvedRolePath);
  const files = await readdir(resolvedSourceRoot);
  const materials = [];
  for (const docId of BASE16_DOC_IDS) {
    const role = roles.get(docId);
    const chunks = rows.filter(row => row.doc_id === docId).sort((a, b) => Number(a.chunk_index) - Number(b.chunk_index));
    if (!chunks.length) throw fail('CHENGCHUAN_BASE16_MATERIAL_CHUNKS_MISSING', { doc_id: docId });
    if (role.source_role !== 'EVIDENCE_CANDIDATE') continue;
    if (!role.material_id || chunks.some(row => row.material_id !== role.material_id)) {
      throw fail('CHENGCHUAN_BASE16_MATERIAL_IDENTITY_MISMATCH', { doc_id: docId, expected: role.material_id, observed: [...new Set(chunks.map(row => row.material_id))] });
    }
    const sourceName = files.find(name => normalizeDocId(name) === docId);
    if (!sourceName) throw fail('CHENGCHUAN_BASE16_SOURCE_FILE_MISSING', { doc_id: docId });
    const sourcePath = path.join(resolvedSourceRoot, sourceName);
    const sourceBytes = await readFile(sourcePath);
    const sourceHash = sha256(sourceBytes);
    if (role.sha256 && role.sha256 !== sourceHash) {
      throw fail('CHENGCHUAN_BASE16_SOURCE_HASH_MISMATCH', { doc_id: docId, expected: role.sha256, observed: sourceHash });
    }
    for (const chunk of chunks) {
      const text = String(chunk.source_text || '');
      if (chunk.chunk_hash !== sha256(Buffer.from(text, 'utf8'))) {
        throw fail('CHENGCHUAN_BASE16_CHUNK_HASH_MISMATCH', { doc_id: docId, chunk_id: chunk.chunk_id });
      }
    }
    const anchor = chunks.find(isSubstantive) || chunks.find(row => String(row.source_text || '').trim());
    if (!anchor) throw fail('CHENGCHUAN_BASE16_SUBSTANTIVE_CHUNK_MISSING', { doc_id: docId });
    materials.push({
      doc_id: docId,
      material_id: role.material_id,
      original_name: role.filename || sourceName,
      source_file: sourceName,
      source_path: sourcePath,
      source_hash: sourceHash,
      project_id: chunks[0].project_id || null,
      corpus_scope: chunks[0].corpus_scope || 'ENTERPRISE_PRIVATE',
      material_type: role.material_type,
      source_role: role.source_role,
      semantic_review_status: role.semantic_review_status || null,
      authority: role.authority,
      production_authority: role.production_authority,
      enterprise_id: snapshot.enterprise_id,
      synthetic: role.synthetic === true,
      source_role_snapshot: 'V43_CHENGCHUAN_BASE16_CONTENT_ROLE_FREEZE_V1',
      chunks,
      anchor
    });
  }
  if (materials.length !== EVIDENCE_DOC_IDS.length || materials.some(item => !EVIDENCE_DOC_IDS.includes(item.doc_id))) {
    throw fail('CHENGCHUAN_EVIDENCE_MATERIAL_SET_MISMATCH', { expected: EVIDENCE_DOC_IDS, observed: materials.map(item => item.doc_id) });
  }
  return materials;
}

/** Build Fact inputs directly from frozen source rows, without Retrieval. */
export function buildDirectFactSourceRows(sources = []) {
  const queries = [];
  const factSourceRows = new Map();
  for (const source of sources) {
    if (!EVIDENCE_DOC_IDS.includes(source?.doc_id) || source?.source_role !== 'EVIDENCE_CANDIDATE') {
      throw fail('CHENGCHUAN_REFERENCE_MATERIAL_NOT_ELIGIBLE_FOR_FACT', { doc_id: source?.doc_id || null });
    }
    const row = {
      ...source.anchor,
      material_id: source.material_id,
      original_name: source.original_name,
      source_hash: source.source_hash,
      source_role: source.source_role,
      material_type: source.material_type,
      authority: source.authority,
      production_authority: source.production_authority,
      enterprise_id: source.enterprise_id,
      source_role_snapshot: source.source_role_snapshot,
      reference_retrieval_dependency: false
    };
    const requirementId = `FACT-SOURCE-${source.doc_id}`;
    queries.push({
      requirement_id: requirementId,
      requirement_text: null,
      source_material_id: source.material_id,
      source_doc_id: source.doc_id,
      source_role: source.source_role,
      enterprise_id: source.enterprise_id,
      reference_retrieval_dependency: false,
      raw_top_k: [],
      shadow_usable_top_k: []
    });
    factSourceRows.set(requirementId, [row]);
  }
  return { queries, factSourceRows };
}

export const CHENGCHUAN_BASE16_EVIDENCE_DOC_IDS = EVIDENCE_DOC_IDS;
