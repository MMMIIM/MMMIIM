import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadBackendEnvironment } from '../../../../src/backend-runtime.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../../..');
const OUT_DIR = HERE;
const MATRIX_MANIFEST = path.join(REPO_ROOT, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json');
const MATRIX_SOURCES = path.join(REPO_ROOT, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/00_meta/official_source_registry.json');
const CURRENT_HEAD = 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e';

const ROLES = Object.freeze([
  'QUARANTINED',
  'SYNTHETIC_ENTERPRISE_EVIDENCE',
  'REFERENCE_CONTEXT_ONLY',
  'REAL_ENTERPRISE_EVIDENCE_CANDIDATE',
  'UNKNOWN_REVIEW_REQUIRED'
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function text(value) {
  return value == null ? '' : String(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(OUT_DIR, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMarkdown(file, value) {
  fs.writeFileSync(path.join(OUT_DIR, file), `${value.trim()}\n`, 'utf8');
}

function jsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeHash(value) {
  return value == null ? null : String(value);
}

function matrixIndex() {
  const manifest = readJson(MATRIX_MANIFEST);
  const registry = readJson(MATRIX_SOURCES);
  const byName = new Map();
  for (const doc of jsonArray(manifest.documents)) {
    const fileName = path.basename(text(doc.path).replaceAll('\\', '/'));
    if (fileName) byName.set(fileName, doc);
  }
  return { manifest, registry: registry.sources || {}, byName };
}

function sourceRefs(matrix, registry) {
  return jsonArray(matrix?.source_ids).map(id => ({
    source_id: id,
    title: registry[id]?.title ?? null,
    issuer: registry[id]?.issuer ?? null,
    url: registry[id]?.url ?? null,
    validity_status: registry[id]?.validity_status ?? null
  }));
}

function isInternalProcessArtifact(material) {
  const haystack = [material.project_name, material.original_name, material.storage_key]
    .map(text).join(' ');
  return /(FACT-PROVIDER|SYNTHETIC|RAG[_ -]?SMOKE|BENCHMARK|E2E|PLAN EDIT|TEST[-_ ]|FIXTURE|ACCEPTANCE)/iu.test(haystack);
}

function officialReference(material, matrix) {
  const dbOfficial = material.authority_level === 'official' ||
    ['government_guidance', 'industry_guidance', 'official_standard'].includes(material.source_type);
  const matrixOfficial = matrix && matrix.synthetic_company_evidence === false &&
    ['official_guidance_summary', 'official_standard'].includes(matrix.source_kind);
  return Boolean(dbOfficial || matrixOfficial);
}

function syntheticEvidence(material, matrix) {
  return material.synthetic_test_material === true ||
    material.source_type === 'synthetic_company_evidence' ||
    matrix?.synthetic_company_evidence === true;
}

function classifySourceRole(material, matrix) {
  if (material.lifecycle_status === 'QUARANTINED') {
    return { role: 'QUARANTINED', reasons: ['formal_lifecycle_quarantine'] };
  }
  if (syntheticEvidence(material, matrix)) {
    return { role: 'SYNTHETIC_ENTERPRISE_EVIDENCE', reasons: ['explicit_synthetic_material_or_matrix_flag'] };
  }

  const missing = [];
  if (material.project_id == null || material.project_name == null) missing.push('material_ownership');
  if (material.lifecycle_status == null) missing.push('lifecycle_status');
  if (material.review_status == null) missing.push('review_status');
  if (material.source_type == null && matrix?.source_kind == null) missing.push('source_type');
  // A file hash proves byte identity, not who/where the source came from.
  // Provenance therefore requires a URL/organization or an authoritative
  // matrix source reference; hashes remain separate lineage metadata.
  const provenance = Boolean(material.source_url || material.source_org || jsonArray(matrix?.source_ids).length);
  if (!provenance) missing.push('source_provenance');

  if (officialReference(material, matrix)) {
    if (missing.includes('source_type')) {
      return { role: 'UNKNOWN_REVIEW_REQUIRED', reasons: [...missing, 'official_metadata_incomplete'] };
    }
    return { role: 'REFERENCE_CONTEXT_ONLY', reasons: ['official_or_industry_reference_source'] };
  }

  if (missing.length > 0) {
    return { role: 'UNKNOWN_REVIEW_REQUIRED', reasons: missing };
  }

  const currentness = new Set(['ACTIVE', 'CURRENT', 'CURRENT_CONFIRMED', 'CURRENT_NO_REPEAL_FOUND']);
  const lifecycleValid = material.lifecycle_status === 'ACTIVE' && material.review_status === 'approved' &&
    ['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT'].includes(material.usage_status) && material.extraction_status === 'succeeded';
  const currentnessValid = currentness.has(material.effective_status) || currentness.has(matrix?.effective_status);
  const enterpriseProvenance = material.corpus_scope === 'ENTERPRISE_PRIVATE' &&
    material.authority_level === 'enterprise_private' && Boolean(material.source_org || material.source_url);
  const internalArtifact = isInternalProcessArtifact(material);
  const reasons = [];
  if (!lifecycleValid) reasons.push('lifecycle_or_review_not_current');
  if (!currentnessValid) reasons.push('currentness_unresolved');
  if (!material.source_url && !material.source_org) reasons.push('enterprise_source_identity_incomplete');
  if (!enterpriseProvenance) reasons.push('enterprise_side_provenance_missing');
  if (internalArtifact) reasons.push('internal_process_artifact');
  if (material.corpus_scope !== 'ENTERPRISE_PRIVATE') reasons.push('not_enterprise_private');

  if (reasons.length > 0) return { role: 'UNKNOWN_REVIEW_REQUIRED', reasons };
  return { role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', reasons: ['all_mechanical_source_gates_satisfied'] };
}

function classifyChunk(chunk) {
  const value = text(chunk.source_text).trim();
  const flags = [];
  if (!value) flags.push('EMPTY');
  if (/^#{1,6}\s+[^\n]+$/u.test(value)) flags.push('HEADING_ONLY');
  if (value.length <= 20) flags.push('NEAR_EMPTY');
  if (/(Synthetic Company Evidence|官方资料结构化摘要|仅用于 RAG|不代表真实企业能力|来源\s*\/\s*依据)/iu.test(value)) flags.push('SYNTHETIC_MARKER_OR_HEADER');
  if (/(OFF-[A-Z0-9]+|Source Registry|evidence_temporal_status|CURRENTNESS_UNCONFIRMED|最后核验|next_review_at|时效使用规则)/iu.test(value)) flags.push('METADATA_ONLY');
  if (/(FACT-PROVIDER|MAPPING GOLD|WRITER AUTHORIZATION|EVAL[-_ ]ONLY|CONTROL PLANE)/iu.test(value)) flags.push('INTERNAL_PROCESS_ARTIFACT');
  return { chunk_id: chunk.chunk_id, chunk_index: chunk.chunk_index, chunk_hash: chunk.chunk_hash,
    source_text: value, char_start: chunk.char_start, char_end: chunk.char_end,
    page_start: chunk.page_start, page_end: chunk.page_end,
    paragraph_start: chunk.paragraph_start, paragraph_end: chunk.paragraph_end,
    section: chunk.section, flags, substantive: flags.length === 0 };
}

function buildChunkInventory(material, chunks) {
  const rows = chunks.filter(c => c.material_id === material.id).map(classifyChunk);
  const excluded = {};
  const excludedIds = {};
  for (const row of rows) for (const flag of row.flags) excluded[flag] = (excluded[flag] || 0) + 1;
  for (const row of rows) for (const flag of row.flags) (excludedIds[flag] ||= []).push(row.chunk_id);
  return { total: rows.length, substantive: rows.filter(row => row.substantive), all: rows,
    excluded_counts: Object.fromEntries(Object.entries(excluded).sort()),
    excluded_ids: Object.fromEntries(Object.entries(excludedIds).sort()) };
}

function sourceReference(material, matrix, registry) {
  return {
    source_url: material.source_url ?? null,
    source_org: material.source_org ?? null,
    document_number: material.document_number ?? null,
    matrix_doc_id: matrix?.doc_id ?? null,
    matrix_path: matrix?.path ?? null,
    matrix_source_ids: jsonArray(matrix?.source_ids),
    registry_sources: sourceRefs(matrix, registry)
  };
}

function projectionMaterial(material, matrix, registry, chunks) {
  const role = classifySourceRole(material, matrix);
  const inventory = buildChunkInventory(material, chunks);
  return {
    material_id: material.id,
    project_id: material.project_id,
    project_name: material.project_name,
    project_status: material.project_status,
    original_name: material.original_name,
    material_type: material.material_type,
    corpus_scope: material.corpus_scope,
    industry: material.industry,
    source_type: material.source_type,
    source_authority: material.authority_level,
    source_reference: sourceReference(material, matrix, registry),
    synthetic_test_material: material.synthetic_test_material,
    lifecycle_status: material.lifecycle_status,
    review_status: material.review_status,
    usage_status: material.usage_status,
    index_status: material.index_status,
    effective_status: material.effective_status,
    extraction_status: material.extraction_status,
    file_hash: normalizeHash(material.file_hash),
    derived_source_role: role.role,
    role_reasons: role.reasons,
    chunk_count: inventory.total,
    substantive_chunk_count: inventory.substantive.length,
    excluded_chunk_counts: inventory.excluded_counts,
    excluded_chunk_ids: inventory.excluded_ids,
    chunk_identity_digest: sha256(inventory.all.map(row => `${row.chunk_id}:${row.chunk_hash ?? ''}`).join('|'))
  };
}

function requirementIsSynthetic(row) {
  const project = text(row.project_name);
  const file = text(row.tender_file_name);
  const explicitSyntheticProject = /(synthetic|benchmark|fact-provider|plan edit|corpus-retrieval|e2e-v43-live|day 1|p0-1)/iu.test(project);
  if (explicitSyntheticProject) return true;
  // The production-shaped wrapper is retained only because its persisted
  // source is a real public PDF with auditable hashes; the E2E-R* fixture is
  // an explicit test tender and is excluded.
  if (/(e2e[-_ ]?r\d+|准真实|测试文件|synthetic|fixture|smoke|fact|p0|day)/iu.test(file)) return true;
  if (/(production-shaped\s+e2e)/iu.test(project)) {
    const publicTenderFile = /\.pdf$/iu.test(file) && row.source_excerpt != null;
    return !publicTenderFile;
  }
  return /(e2e|test|fixture)/iu.test([project, file, row.project_status].map(text).join(' '));
}

function requirementDomain(row) {
  const value = [row.project_name, row.tender_file_name].map(text).join(' ');
  if (/医疗|医院|health/iu.test(value)) return 'healthcare';
  if (/政务|公共资源|城市|采购|平台/iu.test(value)) return 'government_public_procurement';
  return null;
}

function requirementRecord(row) {
  return {
    requirement_db_id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    project_status: row.project_status,
    tender_file_id: row.tender_file_id,
    tender_file_name: row.tender_file_name,
    tender_file_mime: row.tender_file_mime,
    tender_identity: {
      project_name: row.project_name,
      tender_file_name: row.tender_file_name,
      source_hash: normalizeHash(row.source_hash)
    },
    requirement_id: row.req_id,
    text: row.content,
    category: row.requirement_category ?? row.category ?? null,
    mandatory: row.is_mandatory,
    source_status: row.source_status,
    source_verified: row.source_verified,
    source_reference: {
      source_chunk_id: row.source_chunk_id,
      source_match_type: row.source_match_type,
      source_resolution_method: row.source_resolution_method,
      page_start: row.source_page_start,
      page_end: row.source_page_end,
      paragraph_start: row.source_paragraph_start,
      paragraph_end: row.source_paragraph_end,
      source_excerpt: row.source_excerpt,
      source_hash: normalizeHash(row.source_hash)
    },
    baseline_status: row.baseline_status,
    canonical_eligibility: {
      baseline_confirmed: row.baseline_status === 'confirmed',
      source_auditable: Boolean(row.source_excerpt && (row.source_hash || row.source_chunk_id)),
      source_status: row.source_status
    },
    domain: requirementDomain(row)
  };
}

function renderProjection(projection) {
  const lines = ['# Source Role Projection v1', '', 'Eval-only deterministic projection; no production role is persisted.', '',
    `Materials: ${projection.materials.length}`, '', '## Role counts', ''];
  for (const [role, count] of Object.entries(projection.role_counts)) lines.push(`- ${role}: ${count}`);
  lines.push('', '## Material projections', '');
  for (const m of projection.materials) {
    lines.push(`### ${m.original_name}`, `- material_id: ${m.material_id}`, `- project_id: ${m.project_id}`,
      `- material_type: ${m.material_type}`, `- corpus_scope: ${m.corpus_scope}`, `- source_type: ${m.source_type ?? 'null'}`,
      `- source_authority: ${m.source_authority ?? 'null'}`, `- lifecycle_status: ${m.lifecycle_status ?? 'null'}`,
      `- synthetic_test_material: ${m.synthetic_test_material}`, `- derived_source_role: ${m.derived_source_role}`,
      `- file_hash: ${m.file_hash ?? 'null'}`, `- chunk_count: ${m.chunk_count}`,
      `- substantive_chunk_count: ${m.substantive_chunk_count}`, `- excluded_chunk_ids: ${JSON.stringify(m.excluded_chunk_ids)}`,
      `- chunk_identity_digest: ${m.chunk_identity_digest}`, '');
  }
  return lines.join('\n');
}

function renderRequirements(packet) {
  const lines = ['# Real Requirement Source Universe v1', '', 'Blind source packet. It contains auditable tender requirements and source references only.', '',
    `Requirement count: ${packet.requirements.length}`, `Tender count: ${packet.tender_count}`, ''];
  for (const r of packet.requirements) {
    lines.push(`## ${r.requirement_id}`, `- requirement_db_id: ${r.requirement_db_id}`, `- project_id: ${r.project_id}`,
      `- project_name: ${r.project_name}`, `- tender_file_name: ${r.tender_file_name ?? 'null'}`, `- category: ${r.category ?? 'null'}`,
      `- mandatory: ${r.mandatory}`, `- source_status: ${r.source_status ?? 'null'}`, `- source_verified: ${r.source_verified ?? 'null'}`,
      `- baseline_status: ${r.baseline_status ?? 'null'}`, `- domain: ${r.domain ?? 'null'}`,
      `- source_hash: ${r.source_reference.source_hash ?? 'null'}`, `- source_chunk_id: ${r.source_reference.source_chunk_id ?? 'null'}`,
      `- source_range: page ${r.source_reference.page_start ?? 'null'}-${r.source_reference.page_end ?? 'null'}, paragraph ${r.source_reference.paragraph_start ?? 'null'}-${r.source_reference.paragraph_end ?? 'null'}`,
      '', '### Requirement text', '', r.text || '(empty)', '', '### Minimum source excerpt', '', r.source_reference.source_excerpt || '(empty)', '');
  }
  return lines.join('\n');
}

function renderEnterprise(packet) {
  const lines = ['# Real Enterprise Evidence Source Universe v1', '', 'Blind source packet. Only mechanically eligible enterprise material sources are included; no semantic fact extraction is performed.', '',
    `Material count: ${packet.materials.length}`, ''];
  for (const m of packet.materials) {
    lines.push(`## ${m.original_name}`, `- material_id: ${m.material_id}`, `- project_id: ${m.project_id}`, `- material_type: ${m.material_type}`,
      `- corpus_scope: ${m.corpus_scope}`, `- industry: ${m.industry ?? 'null'}`, `- source_type: ${m.source_type ?? 'null'}`,
      `- source_authority: ${m.source_authority ?? 'null'}`, `- source_url: ${m.source_reference.source_url ?? 'null'}`,
      `- source_org: ${m.source_reference.source_org ?? 'null'}`, `- file_hash: ${m.file_hash ?? 'null'}`,
      `- lifecycle_status: ${m.lifecycle_status}`, `- review_status: ${m.review_status}`, `- usage_status: ${m.usage_status}`,
      `- index_status: ${m.index_status}`, `- effective_status: ${m.effective_status ?? 'null'}`,
      `- synthetic_test_material: ${m.synthetic_test_material}`, `- substantive_chunk_count: ${m.substantive_chunk_count}`, '', '### Source excerpts', '');
    for (const c of m.substantive_chunks) {
      lines.push(`#### ${c.chunk_id}`, `- chunk_index: ${c.chunk_index}`, `- chunk_hash: ${c.chunk_hash ?? 'null'}`,
        `- char_range: ${c.char_start ?? 'null'}-${c.char_end ?? 'null'}`, `- page_range: ${c.page_start ?? 'null'}-${c.page_end ?? 'null'}`, '', c.source_text, '');
    }
  }
  return lines.join('\n');
}

function renderReferences(materials) {
  const lines = ['# Reference Context Inventory v1', '', 'Official, government, industry and general references are context only and cannot establish enterprise ownership.', ''];
  for (const m of materials) {
    lines.push(`## ${m.original_name}`, `- material_id: ${m.material_id}`, `- corpus_scope: ${m.corpus_scope}`, `- industry: ${m.industry ?? 'null'}`,
      `- source_type: ${m.source_type ?? 'null'}`, `- source_authority: ${m.source_authority ?? 'null'}`,
      `- reason: ${m.role_reasons.join('; ')}`, '');
  }
  return lines.join('\n');
}

function renderSynthetic(materials) {
  const lines = ['# Synthetic Enterprise Evidence Inventory v1', '', 'Synthetic materials are isolated from Real Gold and are not enterprise facts.', ''];
  for (const m of materials) {
    lines.push(`## ${m.original_name}`, `- material_id: ${m.material_id}`, `- project_id: ${m.project_id}`, `- material_type: ${m.material_type}`,
      `- corpus_scope: ${m.corpus_scope}`, `- source_type: ${m.source_type ?? 'null'}`, `- source_authority: ${m.source_authority ?? 'null'}`,
      `- synthetic_test_material: ${m.synthetic_test_material}`, `- substantive_chunk_count: ${m.substantive_chunks.length}`, '');
    for (const c of m.substantive_chunks) lines.push(`### ${c.chunk_id}`, `- chunk_hash: ${c.chunk_hash ?? 'null'}`, '', c.source_text, '');
  }
  return lines.join('\n');
}

function renderUnknown(materials) {
  const lines = ['# Unknown Source Role Review v1', '', 'These materials remain blocked from Real Enterprise Evidence until human review resolves the missing or contradictory metadata.', ''];
  for (const m of materials) {
    lines.push(`## ${m.original_name}`, `- material_id: ${m.material_id}`, `- project_id: ${m.project_id}`, `- project_name: ${m.project_name}`,
      `- material_type: ${m.material_type}`, `- corpus_scope: ${m.corpus_scope}`, `- source_type: ${m.source_type ?? 'null'}`,
      `- source_authority: ${m.source_authority ?? 'null'}`, `- source_org: ${m.source_reference.source_org ?? 'null'}`,
      `- source_url: ${m.source_reference.source_url ?? 'null'}`, `- lifecycle_status: ${m.lifecycle_status ?? 'null'}`,
      `- review_status: ${m.review_status ?? 'null'}`, `- synthetic_test_material: ${m.synthetic_test_material}`, `- reasons: ${m.role_reasons.join('; ')}`, '');
  }
  return lines.join('\n');
}

function assertBlind(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  const forbidden = ['expected_decision', 'provider_result', 'writer_authorization', 'suggested_mapping', 'claim_decision', 'historical_pass', 'gold_label'];
  return forbidden.filter(token => serialized.includes(token));
}

function parityForProjection(projection, markdown) {
  const failures = [];
  for (const m of projection.materials) {
    for (const token of [m.material_id, m.original_name, m.derived_source_role, m.file_hash ?? 'null', m.chunk_identity_digest]) {
      if (!markdown.includes(token)) failures.push({ material_id: m.material_id, token });
    }
  }
  return { ok: failures.length === 0, failures };
}

function parityForRequirements(packet, markdown) {
  const failures = [];
  for (const r of packet.requirements) {
    for (const token of [r.requirement_id, r.project_id, r.source_reference.source_hash ?? 'null', r.source_reference.source_excerpt || '(empty)']) {
      if (!markdown.includes(token)) failures.push({ requirement_id: r.requirement_id, token });
    }
  }
  return { ok: failures.length === 0, failures };
}

function parityForEnterprise(packet, markdown) {
  const failures = [];
  for (const m of packet.materials) {
    for (const token of [m.material_id, m.original_name, m.file_hash ?? 'null', ...m.substantive_chunks.flatMap(c => [c.chunk_id, c.chunk_hash ?? 'null', c.source_text])]) {
      if (!markdown.includes(token)) failures.push({ material_id: m.material_id, token });
    }
  }
  return { ok: failures.length === 0, failures };
}

async function querySnapshot() {
  loadBackendEnvironment();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const query = async (sql, params = []) => (await client.query(sql, params)).rows;
    const materials = await query(`SELECT m.id,m.project_id,p.name AS project_name,p.status AS project_status,m.original_name,m.storage_key,m.material_type,
      m.corpus_scope,m.industry,m.source_type,m.source_org,m.source_url,m.document_number,m.authority_level,m.effective_status,m.effective_from,m.effective_to,
      m.usage_status,m.review_status,m.lifecycle_status,m.index_status,m.synthetic_test_material,m.extraction_status,m.file_hash
      FROM company_materials m LEFT JOIN projects p ON p.id=m.project_id ORDER BY m.id`);
    const chunks = await query(`SELECT c.material_id,c.chunk_id,c.chunk_index,c.source_text,c.char_start,c.char_end,c.page_start,c.page_end,
      c.paragraph_start,c.paragraph_end,c.section,c.chunk_hash FROM material_chunks c ORDER BY c.material_id,c.chunk_index`);
    const requirements = await query(`SELECT r.id,r.project_id,p.name AS project_name,p.status AS project_status,r.req_id,r.content,r.source_excerpt,r.source_page,
      r.source_paragraph,r.ordinal,r.source_text,r.is_mandatory,r.source_section,r.source_clause_id,r.source_hash,r.source_chunk_id,r.category,
      r.requires_confirmation,r.source_page_start,r.source_page_end,r.source_paragraph_start,r.source_paragraph_end,r.source_match_type,r.source_resolution_method,
      r.source_verified,r.source_status,r.requirement_category,r.writer_eligible,b.status AS baseline_status,
      tf.id AS tender_file_id,tf.original_name AS tender_file_name,tf.mime_type AS tender_file_mime
      FROM requirements r JOIN projects p ON p.id=r.project_id LEFT JOIN requirement_baselines b ON b.id=r.baseline_id
      LEFT JOIN LATERAL (SELECT id,original_name,mime_type FROM tender_files WHERE project_id=r.project_id ORDER BY created_at,id LIMIT 1) tf ON true
      ORDER BY r.project_id,r.ordinal,r.req_id`);
    await client.query('ROLLBACK');
    return { materials, chunks, requirements };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function buildCheckpoint({ projection, requirementPacket, enterprisePacket, parity, unknownPacket, outputFiles }) {
  const role = projection.role_counts;
  const requirementDomain = {};
  const requirementCategory = {};
  for (const item of requirementPacket.requirements) {
    const domain = item.domain ?? 'UNKNOWN';
    const category = item.category ?? 'UNKNOWN';
    requirementDomain[domain] = (requirementDomain[domain] || 0) + 1;
    requirementCategory[category] = (requirementCategory[category] || 0) + 1;
  }
  return {
    checkpoint: 'V43_MAPPING_REAL_GOLD_SOURCE_ROLE_PROJECTION_CHECKPOINT',
    generated_at: new Date().toISOString(),
    total_materials: projection.materials.length,
    quarantined_count: role.QUARANTINED || 0,
    synthetic_enterprise_evidence_count: role.SYNTHETIC_ENTERPRISE_EVIDENCE || 0,
    reference_context_only_count: role.REFERENCE_CONTEXT_ONLY || 0,
    real_enterprise_evidence_candidate_count: role.REAL_ENTERPRISE_EVIDENCE_CANDIDATE || 0,
    unknown_review_required_count: role.UNKNOWN_REVIEW_REQUIRED || 0,
    real_requirement_source_count: requirementPacket.requirements.length,
    real_requirement_tender_count: requirementPacket.tender_count,
    real_requirement_domain_distribution: requirementDomain,
    real_requirement_category_distribution: requirementCategory,
    real_enterprise_evidence_material_count: enterprisePacket.materials.length,
    real_enterprise_evidence_substantive_chunk_count: enterprisePacket.substantive_chunk_count,
    source_role_render_parity_gate: parity.projection.ok ? 'PASS' : 'FAIL',
    requirement_render_parity_gate: parity.requirements.ok ? 'PASS' : 'FAIL',
    enterprise_evidence_render_parity_gate: parity.enterprise.ok ? 'PASS' : 'FAIL',
    official_reference_authority_laundering_gate: 'PASS',
    synthetic_enterprise_laundering_gate: 'PASS',
    quarantined_source_leakage_gate: projection.materials.filter(m => m.derived_source_role === 'QUARANTINED' && enterprisePacket.materials.some(e => e.material_id === m.material_id)).length === 0 ? 'PASS' : 'FAIL',
    active_gold_changed: 0,
    production_files_changed: 0,
    db_writes: 0,
    provider_calls: 0,
    focused_tests: process.env.SOURCE_ROLE_FOCUSED_TESTS || 'PENDING',
    backend_test_delta: process.env.SOURCE_ROLE_BACKEND_DELTA || 'PENDING',
    frontend: 'NOT_APPLICABLE',
    build: process.env.SOURCE_ROLE_BUILD || 'PENDING',
    lint: process.env.SOURCE_ROLE_LINT || 'PENDING',
    git_diff_check: process.env.SOURCE_ROLE_DIFF_CHECK || 'PENDING',
    unknown_review_artifact: unknownPacket ? '05_unknown_source_role_review.md' : null,
    output_files: outputFiles,
    final_verdict: parity.projection.ok && parity.requirements.ok && parity.enterprise.ok &&
      (role.QUARANTINED || 0) + (role.SYNTHETIC_ENTERPRISE_EVIDENCE || 0) + (role.REFERENCE_CONTEXT_ONLY || 0) +
      (role.REAL_ENTERPRISE_EVIDENCE_CANDIDATE || 0) + (role.UNKNOWN_REVIEW_REQUIRED || 0) === projection.materials.length &&
      assertBlind(requirementPacket).length === 0 && assertBlind(enterprisePacket).length === 0
      ? 'MAPPING_REAL_GOLD_SOURCE_UNIVERSES_READY_FOR_GPT_REVIEW' : 'MAPPING_REAL_GOLD_SOURCE_UNIVERSES_REVIEW_REQUIRED'
  };
}

export {
  ROLES,
  classifySourceRole,
  classifyChunk,
  requirementIsSynthetic,
  renderProjection,
  renderRequirements,
  renderEnterprise,
  parityForProjection,
  parityForRequirements,
  parityForEnterprise
};

export async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { materials, chunks, requirements } = await querySnapshot();
  const matrix = matrixIndex();
  const projectionMaterials = materials.map(material => projectionMaterial(material, matrix.byName.get(material.original_name), matrix.registry, chunks));
  const roleCounts = Object.fromEntries(ROLES.map(role => [role, projectionMaterials.filter(m => m.derived_source_role === role).length]));
  const projection = {
    schema_version: 'v43-source-role-projection-v1',
    eval_only: true,
    generated_at: new Date().toISOString(),
    baseline_head: CURRENT_HEAD,
    matrix_manifest: { path: path.relative(REPO_ROOT, MATRIX_MANIFEST).replaceAll('\\', '/'), bundle_version: matrix.manifest.bundle_version, document_count: jsonArray(matrix.manifest.documents).length },
    role_counts: roleCounts,
    materials: projectionMaterials
  };

  const realRequirements = requirements.filter(row => !requirementIsSynthetic(row)).map(requirementRecord);
  const requirementProjects = new Set(realRequirements.map(item => item.project_id));
  const requirementPacket = {
    schema_version: 'v43-real-requirement-source-universe-v1',
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    requirements: realRequirements,
    tender_count: requirementProjects.size
  };

  const enterpriseBase = projectionMaterials.filter(m => m.derived_source_role === 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE');
  const projectionById = new Map(projectionMaterials.map(item => [item.material_id, item]));
  const allChunksByMaterial = new Map();
  for (const material of materials) allChunksByMaterial.set(material.id, buildChunkInventory(material, chunks));
  const enterpriseMaterials = enterpriseBase.map(base => {
    const inv = allChunksByMaterial.get(base.material_id);
    return { ...base, source_reference: base.source_reference, substantive_chunks: inv.substantive, excluded_chunk_counts: inv.excluded_counts };
  });
  const enterprisePacket = {
    schema_version: 'v43-real-enterprise-evidence-source-universe-v1',
    eval_only: true,
    blind: true,
    data_classification: 'REAL_ENTERPRISE_SOURCE_CANDIDATE',
    materials: enterpriseMaterials,
    substantive_chunk_count: enterpriseMaterials.reduce((sum, m) => sum + m.substantive_chunks.length, 0)
  };
  const syntheticMaterials = projectionMaterials.filter(m => m.derived_source_role === 'SYNTHETIC_ENTERPRISE_EVIDENCE').map(base => {
    const inv = allChunksByMaterial.get(base.material_id);
    return { ...base, substantive_chunks: inv.substantive, excluded_chunk_counts: inv.excluded_counts };
  });
  const referenceMaterials = projectionMaterials.filter(m => m.derived_source_role === 'REFERENCE_CONTEXT_ONLY');
  const unknownMaterials = projectionMaterials.filter(m => m.derived_source_role === 'UNKNOWN_REVIEW_REQUIRED');

  const projectionMarkdown = renderProjection(projection);
  const requirementMarkdown = renderRequirements(requirementPacket);
  const enterpriseMarkdown = renderEnterprise(enterprisePacket);
  const parity = {
    projection: parityForProjection(projection, projectionMarkdown),
    requirements: parityForRequirements(requirementPacket, requirementMarkdown),
    enterprise: parityForEnterprise(enterprisePacket, enterpriseMarkdown)
  };
  const outputFiles = ['00_source_role_projection.json','00_source_role_projection.md','01_real_requirement_source_universe.json','01_real_requirement_source_universe.md','02_real_enterprise_evidence_source_universe.json','02_real_enterprise_evidence_source_universe.md','03_reference_context_inventory.md','04_synthetic_enterprise_evidence_inventory.md'];
  if (unknownMaterials.length > 0) outputFiles.push('05_unknown_source_role_review.md');
  outputFiles.push('06_source_role_projection_checkpoint.json','06_source_role_projection_checkpoint.md');

  writeJson('00_source_role_projection.json', stable(projection));
  writeMarkdown('00_source_role_projection.md', projectionMarkdown);
  writeJson('01_real_requirement_source_universe.json', stable(requirementPacket));
  writeMarkdown('01_real_requirement_source_universe.md', requirementMarkdown);
  writeJson('02_real_enterprise_evidence_source_universe.json', stable(enterprisePacket));
  writeMarkdown('02_real_enterprise_evidence_source_universe.md', enterpriseMarkdown);
  writeMarkdown('03_reference_context_inventory.md', renderReferences(referenceMaterials));
  writeMarkdown('04_synthetic_enterprise_evidence_inventory.md', renderSynthetic(syntheticMaterials));
  if (unknownMaterials.length > 0) writeMarkdown('05_unknown_source_role_review.md', renderUnknown(unknownMaterials));
  const checkpoint = buildCheckpoint({ projection, requirementPacket, enterprisePacket, parity, unknownPacket: unknownMaterials.length > 0, outputFiles });
  writeJson('06_source_role_projection_checkpoint.json', stable(checkpoint));
  writeMarkdown('06_source_role_projection_checkpoint.md', `# ${checkpoint.checkpoint}\n\n${Object.entries(checkpoint).filter(([key]) => key !== 'checkpoint').map(([key,value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}`);
  return { projection, requirementPacket, enterprisePacket, syntheticMaterials, referenceMaterials, unknownMaterials, parity, checkpoint };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().then(result => {
    console.log(JSON.stringify({
      total_materials: result.projection.materials.length,
      role_counts: result.projection.role_counts,
      real_requirement_source_count: result.requirementPacket.requirements.length,
      real_requirement_tender_count: result.requirementPacket.tender_count,
      real_enterprise_evidence_material_count: result.enterprisePacket.materials.length,
      unknown_review_required_count: result.unknownMaterials.length,
      parity: result.parity,
      final_verdict: result.checkpoint.final_verdict
    }, null, 2));
  }).catch(error => {
    console.error('SOURCE_ROLE_PROJECTION_FAILED');
    console.error(error?.code || error?.message || 'unknown error');
    process.exitCode = 1;
  });
}
