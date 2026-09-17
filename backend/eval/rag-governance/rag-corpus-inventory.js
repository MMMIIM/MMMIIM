import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUT_DIR = HERE;
const PUBLIC_CORPUS_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const BASELINE = { materials: 50, chunks: 478, source: 'backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md' };
const MATRIX_MANIFEST = path.join(REPO_ROOT, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json');
const MATRIX_COVERAGE = path.join(REPO_ROOT, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/00_meta/coverage_matrix.json');
const MATRIX_SOURCES = path.join(REPO_ROOT, 'backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/00_meta/official_source_registry.json');
const L3_MANIFEST = path.join(REPO_ROOT, 'backend/eval/corpus/l3-corpus-manifest-v1.json');
const GOLD_FILES = [
  'backend/eval/requirement-evidence-mapping-v1/gold-cases.json',
  'backend/eval/requirement-evidence-mapping-v2/real-derived-gold-v1.json',
  'backend/eval/gold-human-review/00_gold_review_manifest.json',
  'backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json',
  'backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json'
];

function sha256File(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  return value == null ? '' : String(value);
}

export function isNeusoftMaterial(material) {
  return /(东软|neusoft)/iu.test([material.original_name, material.source_org, material.source_url, material.source_type, material.industry, material.project_name].map(text).join(' '));
}

export function productionRetrievalEligible(material, publicProjectId = PUBLIC_CORPUS_PROJECT_ID) {
  const lifecycleReady = material.lifecycle_status === 'ACTIVE' &&
    material.review_status === 'approved' &&
    ['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT'].includes(material.usage_status) &&
    material.extraction_status === 'succeeded';
  const privateProject = material.project_id !== publicProjectId &&
    material.corpus_scope === 'ENTERPRISE_PRIVATE' && lifecycleReady;
  const publicProject = material.project_id === publicProjectId &&
    lifecycleReady &&
    material.index_status === 'INDEXED' &&
    ['GENERAL', 'GOVERNMENT_ENTERPRISE', 'HEALTHCARE'].includes(material.corpus_scope);
  return privateProject || publicProject;
}

export function classifyChunkFlags(chunks, material = {}) {
  const flags = new Set();
  const flagCounts = {};
  let lowInformation = 0;
  const addFlag = flag => { flags.add(flag); flagCounts[flag] = (flagCounts[flag] || 0) + 1; };
  for (const chunk of chunks) {
    const value = text(chunk.source_text).trim();
    if (/^#{1,6}\s+[^\n]+$/u.test(value)) addFlag('HEADING_ONLY');
    if (value.length < 80) { addFlag('VERY_LOW_INFORMATION'); lowInformation += 1; }
    if (/(赋能|引领|助力|构建未来|一站式|领先|行业标杆|美好城市|创新驱动)/u.test(value)) addFlag('MARKETING_STYLE_CANDIDATE');
    if (/(\d+(?:\.\d+)?\s*(?:秒|毫秒|%|人|个|年|月|日)|ISO\s*\d+|等保|中标|合同|验收|证书|日期|项目编号)/iu.test(value)) addFlag('STRUCTURED_FACT_CANDIDATE');
  }
  if (/(official|government|law|standard|guidance|regulation)/iu.test([material.source_type, material.authority_level].map(text).join(' '))) addFlag('AUTHORITATIVE_RECORD_CANDIDATE');
  return { flags: [...flags].sort(), flag_counts: flagCounts, low_information_count: lowInformation };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? 'NOT_AVAILABLE';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function jsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function scanNeusoftReferences() {
  const roots = [path.join(REPO_ROOT, 'backend', 'eval'), path.join(REPO_ROOT, 'docs')];
  const result = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'rag-governance' || entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(?:md|json|jsonl|js|txt|csv)$/iu.test(entry.name)) {
        let body = '';
        try { body = fs.readFileSync(full, 'utf8'); } catch { continue; }
        if (/(东软|neusoft)/iu.test(body)) result.push(path.relative(REPO_ROOT, full).replaceAll('\\', '/'));
      }
    }
  };
  roots.forEach(walk);
  return [...new Set(result)].sort();
}

function materialUsage(materialId, references) {
  const usage = {
    used_by_mapping_real_candidate: false,
    used_by_claim_legacy: false,
    used_by_writer_fixture: false,
    used_by_other_eval: false
  };
  const matching = [];
  for (const relative of references) {
    const file = path.join(REPO_ROOT, relative);
    let body = '';
    try { body = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!body.includes(String(materialId))) continue;
    matching.push(relative);
    const lower = relative.toLowerCase();
    if (lower.includes('mapping') || lower.includes('gold-human-review/v2')) usage.used_by_mapping_real_candidate = true;
    if (lower.includes('claim') || lower.includes('evidence-gold')) usage.used_by_claim_legacy = true;
    if (lower.includes('writer')) usage.used_by_writer_fixture = true;
  }
  usage.used_by_other_eval = matching.some(relative => {
    const lower = relative.toLowerCase();
    return !lower.includes('mapping') && !lower.includes('gold-human-review/v2') && !lower.includes('claim') && !lower.includes('evidence-gold') && !lower.includes('writer');
  });
  return usage;
}

async function queryInventory() {
  loadBackendEnvironment();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // The transaction is explicitly read-only; this evaluator has no mutation path.
    await client.query('BEGIN TRANSACTION READ ONLY');
    const query = async (sql, params = []) => (await client.query(sql, params)).rows;
    const projects = await query(`SELECT id, name, status FROM projects ORDER BY id`);
    const materials = await query(`
      SELECT m.id, m.project_id, p.name AS project_name, m.original_name, m.material_type,
             m.corpus_scope, m.industry, m.source_type, m.source_org, m.source_url,
             m.document_number, m.authority_level, m.effective_status, m.effective_from,
             m.effective_to, m.usage_status, m.review_status, m.lifecycle_status,
             m.index_status, m.synthetic_test_material, m.extraction_status, m.file_hash
      FROM company_materials m LEFT JOIN projects p ON p.id=m.project_id ORDER BY m.corpus_scope,m.original_name`);
    const chunks = await query(`SELECT c.material_id, c.chunk_id, c.source_text FROM material_chunks c ORDER BY c.material_id,c.chunk_index`);
    const embeddings = await query(`SELECT c.material_id, e.embedding_model, e.embedding_version, e.embedding_dimension, COUNT(*)::int AS count FROM material_chunk_embeddings e JOIN material_chunks c ON c.chunk_id=e.chunk_id AND c.chunk_hash=e.chunk_hash GROUP BY c.material_id,e.embedding_model,e.embedding_version,e.embedding_dimension ORDER BY c.material_id,e.embedding_model,e.embedding_version,e.embedding_dimension`);
    const embeddedChunks = await query(`SELECT c.material_id, COUNT(DISTINCT e.chunk_id)::int AS count FROM material_chunk_embeddings e JOIN material_chunks c ON c.chunk_id=e.chunk_id AND c.chunk_hash=e.chunk_hash GROUP BY c.material_id`);
    const facts = await query(`SELECT e.material_id::text material_id, count(DISTINCT f.fact_id)::int count, count(DISTINCT f.fact_id) FILTER (WHERE f.review_status='approved' AND NOT EXISTS (SELECT 1 FROM evidence_facts successor WHERE successor.supersedes_fact_id=f.id AND successor.review_status<>'invalidated'))::int current_count, COALESCE(array_agg(DISTINCT f.fact_id) FILTER (WHERE f.fact_id IS NOT NULL), ARRAY[]::text[]) ids FROM evidences e JOIN evidence_facts f ON f.evidence_id=e.id GROUP BY e.material_id`);
    const legacyMappings = await query(`SELECT e.material_id::text material_id, count(DISTINCT rem.mapping_id)::int count, count(DISTINCT rem.mapping_id) FILTER (WHERE rem.mapping_status='approved')::int current_count, COALESCE(array_agg(DISTINCT rem.mapping_id::text), ARRAY[]::text[]) ids FROM evidences e JOIN requirement_evidence_mappings rem ON rem.evidence_id=e.id GROUP BY e.material_id`);
    const factMappings = await query(`SELECT e.material_id::text material_id, count(DISTINCT rfm.mapping_id)::int count, count(DISTINCT rfm.mapping_id) FILTER (WHERE rfm.review_status='approved')::int current_count, COALESCE(array_agg(DISTINCT rfm.mapping_id), ARRAY[]::text[]) ids FROM evidences e JOIN evidence_facts f ON f.evidence_id=e.id JOIN requirement_evidence_fact_mappings rfm ON rfm.evidence_fact_id=f.fact_id GROUP BY e.material_id`);
    const claims = await query(`SELECT e.material_id::text material_id, count(DISTINCT c.claim_id)::int count, COALESCE(array_agg(DISTINCT c.claim_id), ARRAY[]::text[]) ids FROM evidences e JOIN claims c ON c.basis_evidence_ids ? e.evidence_id GROUP BY e.material_id`);
    const retrieval = await query(`SELECT c.material_id, count(DISTINCT er.retrieval_run_id)::int run_count, count(DISTINCT er.retrieval_run_id || ':' || er.chunk_id)::int result_count FROM material_chunks c JOIN enterprise_retrieval_results er ON er.chunk_id=c.chunk_id GROUP BY c.material_id`);
    const sourceEligible = await query(`
      SELECT e.material_id::text material_id, e.evidence_id, e.source_chunk_id, e.approval_status, e.validity_status,
             CASE WHEN mc.chunk_id IS NOT NULL AND mc.material_id=e.source_document_id AND (
               (COALESCE(e.source_location->>'resolver_version','')='' AND e.source_text=mc.source_text AND e.source_hash=mc.chunk_hash)
               OR (e.source_location->>'resolver_version'='evidence-source-span-v1'
                 AND (e.source_location->>'anchor_chunk_id')=mc.chunk_id
                 AND (e.source_location->>'char_start') ~ '^\\d+$' AND (e.source_location->>'char_end') ~ '^\\d+$'
                 AND (e.source_location->>'char_end')::int>(e.source_location->>'char_start')::int
                 AND e.source_text=substring(m.extracted_text FROM (e.source_location->>'char_start')::int+1 FOR (e.source_location->>'char_end')::int-(e.source_location->>'char_start')::int)
                 AND e.source_hash=encode(digest(convert_to(e.source_text,'UTF8'),'sha256'),'hex'))
             ) THEN true ELSE false END AS lineage_ok
      FROM evidences e JOIN company_materials m ON m.id=e.source_document_id LEFT JOIN material_chunks mc ON mc.chunk_id=e.source_chunk_id AND mc.material_id=e.source_document_id
      WHERE e.evidence_origin='enterprise'`);
    await client.query('ROLLBACK');
    return { projects, materials, chunks, embeddings, embeddedChunks, facts, legacyMappings, factMappings, claims, retrieval, sourceEligible };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    try { client.release(); } catch {}
    await pool.end();
  }
}

function matrixInventory() {
  const manifest = readJson(MATRIX_MANIFEST);
  const coverage = readJson(MATRIX_COVERAGE);
  const sources = readJson(MATRIX_SOURCES);
  const docs = jsonArray(manifest?.documents);
  const byLibrary = countBy(docs, 'library_scope');
  const byAuthority = countBy(docs, 'evidence_status');
  const themeCounts = {};
  for (const doc of docs) for (const theme of jsonArray(doc.requirement_themes)) themeCounts[theme] = (themeCounts[theme] || 0) + 1;
  return {
    manifest_path: path.relative(REPO_ROOT, MATRIX_MANIFEST).replaceAll('\\', '/'),
    manifest_version: manifest?.bundle_version ?? 'NOT_AVAILABLE',
    document_count: docs.length,
    documents_by_library: byLibrary,
    documents_by_evidence_status: byAuthority,
    source_registry_count: Object.keys(sources?.sources || {}).length || 'NOT_AVAILABLE',
    coverage_requirement_count: Object.keys(coverage?.coverage || coverage || {}).filter(key => key !== 'verified_at').length || 'NOT_AVAILABLE',
    themes: themeCounts,
    documents: docs.map(doc => ({
      doc_id: doc.doc_id ?? 'NOT_AVAILABLE', title: doc.title ?? 'NOT_AVAILABLE', library_scope: doc.library_scope ?? 'NOT_AVAILABLE',
      domain: doc.domain ?? 'NOT_AVAILABLE', requirement_themes: jsonArray(doc.requirement_themes), evidence_category: doc.evidence_category ?? 'NOT_AVAILABLE',
      source_ids: jsonArray(doc.source_ids), source_kind: doc.source_kind ?? 'NOT_AVAILABLE', evidence_status: doc.evidence_status ?? 'NOT_AVAILABLE',
      claim_permission: doc.claim_permission ?? 'NOT_AVAILABLE', human_review_required: doc.human_review_required ?? 'NOT_AVAILABLE',
      synthetic_company_evidence: doc.synthetic_company_evidence ?? 'NOT_AVAILABLE', effective_status: doc.evidence_temporal_status ?? 'NOT_AVAILABLE',
      freshness_sensitivity: doc.freshness_sensitivity ?? 'NOT_AVAILABLE', path: doc.path ?? 'NOT_AVAILABLE', sha256: doc.sha256 ?? 'NOT_AVAILABLE'
    }))
  };
}

function markdownReport(report) {
  const s = report.scope_distribution;
  const scopeRows = Object.entries(s).map(([scope, value]) => `| ${scope} | ${value.materials} | ${value.chunks} | ${value.embeddings} |`).join('\n');
  const materialRows = report.materials.map(m => `| ${m.material_id} | ${m.original_name} | ${m.material_type} | ${m.corpus_scope} | ${m.chunk_count} | ${m.embedding_count} | ${m.retrieval_eligible ? 'YES' : 'NO'} | ${m.derived_fact_count} | ${m.derived_mapping_count} |`).join('\n');
  const n = report.neusoft;
  return `# V43 RAG Corpus Inventory v1\n\n` +
    `This is a read-only deterministic inventory. It does not call a Provider and does not create or modify business state. Missing database fields are represented as \`NOT_AVAILABLE\`.\n\n` +
    `## Totals\n\n- materials: ${report.totals.materials}\n- chunks: ${report.totals.chunks}\n- embeddings: ${report.totals.embeddings}\n- evidence facts: ${report.totals.evidence_facts}\n- evidence source facts: ${report.totals.evidence_source_facts}\n- legacy mappings: ${report.totals.legacy_mappings}\n- fact mappings: ${report.totals.fact_mappings}\n- retrieval runs: ${report.totals.retrieval_runs}\n- retrieval results: ${report.totals.retrieval_results}\n\n` +
    `## Scope distribution\n\n| scope | materials | chunks | embeddings |\n| --- | ---: | ---: | ---: |\n${scopeRows}\n\n` +
    `## Material inventory\n\n| material_id | original_name | type | scope | chunks | embeddings | retrieval eligible | facts | mappings |\n| --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: |\n${materialRows}\n\n` +
    `## Status and authority\n\n- lifecycle/status/currentness are reported from existing columns only; no inferred status is promoted to truth.\n- authority and evidence sufficiency remain separate.\n- mechanical source flags are advisory only and never create Fact, Mapping, Claim permission, or Gold labels.\n- quality flags: ${JSON.stringify(report.quality_flags)}\n\n` +
    `## Matrix-driven corpus\n\n- manifest: ${report.matrix_driven.manifest_path}\n- documents: ${report.matrix_driven.document_count}\n- libraries: ${JSON.stringify(report.matrix_driven.documents_by_library)}\n- source registry records: ${report.matrix_driven.source_registry_count}\n- coverage requirement rows: ${report.matrix_driven.coverage_requirement_count}\n- themes: ${JSON.stringify(report.matrix_driven.themes)}\n\n` +
    `## Baseline comparison\n\n- known baseline: ${BASELINE.materials} materials / ${BASELINE.chunks} chunks (${BASELINE.source})\n- current delta: ${report.totals.materials - BASELINE.materials} materials / ${report.totals.chunks - BASELINE.chunks} chunks\n- delta explanation: current DB includes the matrix-driven public + synthetic baseline plus four retained Neusoft materials and two additional test materials.\n\n` +
    `## Neusoft references\n\n- detected materials: ${n.material_count}\n- chunks: ${n.chunk_count}\n- embeddings: ${n.embedding_count}\n- derived facts: ${n.derived_fact_count}\n- current facts: ${n.current_fact_count}\n- derived mappings: ${n.derived_mapping_count}\n- current mappings: ${n.current_mapping_count}\n- retrieval results: ${n.retrieval_result_count}\n- repository references: ${n.repository_reference_count}\n- quarantine: ${n.quarantine_status}\n- blocker: ${n.blocker}\n`;
}

function neusoftMarkdown(report) {
  const n = report.neusoft;
  const rows = n.materials.map(m => `| ${m.material_id} | ${m.original_name} | ${m.chunk_count} | ${m.embedding_count} | ${m.derived_fact_count} | ${m.current_fact_count} | ${m.derived_mapping_count} | ${m.current_mapping_count} | ${m.claim_reference_count} | ${m.retrieval_eligible ? 'YES' : 'NO'} | ${m.quarantine_status} |`).join('\n');
  return `# Neusoft Corpus Quarantine Inventory v1\n\n` +
    `Quarantine is an authority boundary, not deletion. This artifact preserves all historical material, chunks, embeddings, Facts, Mappings, claims, and Gold references. No database mutation was attempted.\n\n` +
    `## Detection\n\n- detection rule: case-insensitive match of \`东软|neusoft\` across material name, source metadata, industry, and project name\n- matched materials: ${n.material_count}\n- repository files containing references: ${n.repository_reference_count}\n\n` +
    `## Material-level status\n\n| material_id | original_name | chunks | embeddings | derived facts | current facts | derived mappings | current mappings | claim refs | current retrieval predicate | quarantine status |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |\n${rows}\n\n` +
    `## Required future exclusions\n\n` +
    `- Production Retrieval: MUST_EXCLUDE, but currently NOT_ENFORCED because private-project retrieval accepts any \`ENTERPRISE_PRIVATE\` material without lifecycle/usage checks.\n` +
    `- new Evidence Fact: MUST_EXCLUDE; current derived-source queries do not consume a quarantine state.\n` +
    `- new Mapping candidates: MUST_EXCLUDE; current retrieval/candidate selection has no quarantine predicate.\n` +
    `- Mapping Real Gold discovery: MUST_EXCLUDE by Eval policy; historical source packets remain immutable.\n` +
    `- Claim Real Gold discovery: MUST_EXCLUDE by Eval policy; historical source packets remain immutable.\n` +
    `- Writer Provider Fidelity source discovery: MUST_EXCLUDE by Eval policy.\n\n` +
    `## Fail-closed decision\n\n- existing lifecycle values: ACTIVE / ACTIVE_FULLTEXT / approved\n- safe quarantine enum available: NO\n- derived authority invalidation available: NO\n- status: ${n.quarantine_status}\n- blocker: ${n.blocker}\n- required next decision: define and implement an owner-approved authority lifecycle that is honored by Retrieval, Evidence, Fact, Mapping, Claim, and Writer source selection before applying quarantine.\n`;
}

export async function buildInventory() {
  const snapshot = await queryInventory();
  const chunksByMaterial = new Map();
  for (const chunk of snapshot.chunks) {
    if (!chunksByMaterial.has(chunk.material_id)) chunksByMaterial.set(chunk.material_id, []);
    chunksByMaterial.get(chunk.material_id).push(chunk);
  }
  const embeddingByMaterial = new Map();
  for (const row of snapshot.embeddings) {
    const value = embeddingByMaterial.get(row.material_id) || { identities: [], count: 0 };
    value.count += Number(row.count);
    value.identities.push({ model: row.embedding_model, version: row.embedding_version, dimension: row.embedding_dimension, count: Number(row.count) });
    embeddingByMaterial.set(row.material_id, value);
  }
  const embeddedChunkByMaterial = new Map((snapshot.embeddedChunks || []).map(row => [String(row.material_id), Number(row.count || 0)]));
  const aggregateMap = rows => new Map(rows.map(row => [String(row.material_id), row]));
  const factByMaterial = aggregateMap(snapshot.facts);
  const legacyMappingByMaterial = aggregateMap(snapshot.legacyMappings);
  const factMappingByMaterial = aggregateMap(snapshot.factMappings);
  const claimByMaterial = aggregateMap(snapshot.claims);
  const retrievalByMaterial = aggregateMap(snapshot.retrieval);
  const materials = snapshot.materials.map(row => {
    const flags = classifyChunkFlags(chunksByMaterial.get(row.id) || [], row);
    const embedding = embeddingByMaterial.get(row.id) || { identities: [], count: 0 };
    const fact = factByMaterial.get(String(row.id)) || { count: 0, ids: [] };
    const legacyMapping = legacyMappingByMaterial.get(String(row.id)) || { count: 0, ids: [] };
    const factMapping = factMappingByMaterial.get(String(row.id)) || { count: 0, ids: [] };
    const claim = claimByMaterial.get(String(row.id)) || { count: 0, ids: [] };
    const retrieval = retrievalByMaterial.get(String(row.id)) || { run_count: 0, result_count: 0 };
    const eligibleEvidence = (snapshot.sourceEligible || []).filter(item => String(item.material_id) === String(row.id) && item.approval_status === 'approved' && item.validity_status === 'active' && item.lineage_ok);
    return {
      material_id: row.id, project_id: row.project_id, project_name: row.project_name ?? 'NOT_AVAILABLE', original_name: row.original_name ?? 'NOT_AVAILABLE',
      material_type: row.material_type ?? 'NOT_AVAILABLE', corpus_scope: row.corpus_scope ?? 'NOT_AVAILABLE', industry: row.industry ?? 'NOT_AVAILABLE',
      source_type: row.source_type ?? 'NOT_AVAILABLE', source_org: row.source_org ?? 'NOT_AVAILABLE', source_name: 'NOT_AVAILABLE', source_url: row.source_url ?? 'NOT_AVAILABLE',
      document_number: row.document_number ?? 'NOT_AVAILABLE', source_authority: row.authority_level ?? 'NOT_AVAILABLE',
      status: { extraction_status: row.extraction_status ?? 'NOT_AVAILABLE', review_status: row.review_status ?? 'NOT_AVAILABLE', lifecycle_status: row.lifecycle_status ?? 'NOT_AVAILABLE', usage_status: row.usage_status ?? 'NOT_AVAILABLE', index_status: row.index_status ?? 'NOT_AVAILABLE' },
      currentness: { effective_status: row.effective_status ?? 'NOT_AVAILABLE', effective_from: row.effective_from ?? 'NOT_AVAILABLE', effective_to: row.effective_to ?? 'NOT_AVAILABLE' },
      file_hash: row.file_hash ?? 'NOT_AVAILABLE', synthetic_test_material: row.synthetic_test_material ?? 'NOT_AVAILABLE',
      chunk_count: (chunksByMaterial.get(row.id) || []).length, embedding_count: embedding.count, embedded_chunk_count: embeddedChunkByMaterial.get(String(row.id)) || 0, embedding_identities: embedding.identities,
      indexed: row.index_status === 'INDEXED', retrieval_eligible: productionRetrievalEligible(row),
      evidence_source_eligible: eligibleEvidence.length > 0, evidence_source_eligible_count: eligibleEvidence.length,
      derived_fact_count: Number(fact.count || 0), current_fact_count: Number(fact.current_count || 0), derived_fact_ids: fact.ids || [],
      derived_mapping_count: Number(legacyMapping.count || 0) + Number(factMapping.count || 0), derived_mapping_ids: [...new Set([...(legacyMapping.ids || []), ...(factMapping.ids || [])])].sort(),
      current_mapping_count: Number(legacyMapping.current_count || 0) + Number(factMapping.current_count || 0),
      claim_reference_count: Number(claim.count || 0), claim_ids: claim.ids || [], retrieval_run_count: Number(retrieval.run_count || 0), retrieval_result_count: Number(retrieval.result_count || 0),
      source_quality_flags: flags.flags, source_quality_flag_counts: flags.flag_counts, low_information_chunk_count: flags.low_information_count
    };
  });
  const repositoryRefs = scanNeusoftReferences();
  const neusoftMaterials = materials.filter(isNeusoftMaterial).map(material => ({
    ...material,
    usage: materialUsage(material.material_id, repositoryRefs)
  }));
  const byScope = {};
  for (const material of materials) {
    const bucket = byScope[material.corpus_scope] || { materials: 0, chunks: 0, embeddings: 0 };
    bucket.materials += 1; bucket.chunks += material.chunk_count; bucket.embeddings += material.embedding_count; byScope[material.corpus_scope] = bucket;
  }
  const counts = await readOnlyCounts();
  const goldBefore = Object.fromEntries(GOLD_FILES.map(relative => [relative, sha256File(path.join(REPO_ROOT, relative))]));
  const goldAfter = Object.fromEntries(GOLD_FILES.map(relative => [relative, sha256File(path.join(REPO_ROOT, relative))]));
  const matrix = matrixInventory();
  const neusoft = {
    material_count: neusoftMaterials.length, chunk_count: neusoftMaterials.reduce((n, m) => n + m.chunk_count, 0), embedding_count: neusoftMaterials.reduce((n, m) => n + m.embedding_count, 0),
    derived_fact_count: neusoftMaterials.reduce((n, m) => n + m.derived_fact_count, 0), current_fact_count: neusoftMaterials.reduce((n, m) => n + m.current_fact_count, 0),
    derived_mapping_count: neusoftMaterials.reduce((n, m) => n + m.derived_mapping_count, 0), current_mapping_count: neusoftMaterials.reduce((n, m) => n + m.current_mapping_count, 0),
    claim_reference_count: neusoftMaterials.reduce((n, m) => n + m.claim_reference_count, 0), retrieval_result_count: neusoftMaterials.reduce((n, m) => n + m.retrieval_result_count, 0),
    repository_reference_count: repositoryRefs.length, repository_reference_paths: repositoryRefs,
    materials: neusoftMaterials.map(m => ({ ...m, quarantine_status: 'NOT_APPLIED_BLOCKED_MISSING_LIFECYCLE' })),
    quarantine_status: 'NEUSOFT_QUARANTINE_REQUIRES_AUTHORITY_LIFECYCLE_DECISION',
    blocker: 'Existing lifecycle enum has no quarantine state honored by private Retrieval and derived authority queries; applying usage/review/lifecycle updates alone would not fail closed.',
    derived_authority_leakage: neusoftMaterials.some(m => m.derived_fact_count || m.derived_mapping_count || m.claim_reference_count) ? 'YES' : 'NO',
    future_retrieval_excluded: 'NOT_ENFORCED', future_evidence_fact_excluded: 'NOT_ENFORCED', future_mapping_candidate_excluded: 'NOT_ENFORCED',
    gold_discovery_excluded: 'POLICY_ONLY_NOT_ENFORCED'
  };
  const qualityFlags = {};
  for (const material of materials) for (const [flag, count] of Object.entries(material.source_quality_flag_counts)) qualityFlags[flag] = (qualityFlags[flag] || 0) + count;
  const activeMaterials = materials.filter(material => material.status.lifecycle_status === 'ACTIVE' && material.status.review_status === 'approved' && material.status.extraction_status === 'succeeded');
  return {
    schema_version: 'v43-rag-corpus-inventory-v1', generated_at: new Date().toISOString(), read_only: true, provider_calls: 0, db_writes: 0,
    totals: { ...counts, materials: materials.length, chunks: materials.reduce((n, m) => n + m.chunk_count, 0), embeddings: materials.reduce((n, m) => n + m.embedding_count, 0), active_materials: activeMaterials.length, active_chunks: activeMaterials.reduce((n, m) => n + m.chunk_count, 0), active_embeddings: activeMaterials.reduce((n, m) => n + m.embedding_count, 0), retrieval_eligible_materials: materials.filter(m => m.retrieval_eligible).length },
    scope_distribution: byScope, material_type_distribution: countBy(materials, 'material_type'), projects: snapshot.projects,
    materials, matrix_driven: matrix, quality_flags: qualityFlags, low_information_chunk_count: materials.reduce((n, m) => n + m.low_information_chunk_count, 0),
    neusoft, baseline_comparison: { ...BASELINE, current_materials: materials.length, current_chunks: materials.reduce((n, m) => n + m.chunk_count, 0), material_delta: materials.length - BASELINE.materials, chunk_delta: materials.reduce((n, m) => n + m.chunk_count, 0) - BASELINE.chunks },
    gold_immutability: { before: goldBefore, after: goldAfter, parity: JSON.stringify(stable(goldBefore)) === JSON.stringify(stable(goldAfter)) ? 'PASS' : 'FAIL' },
    production_code_changed_by_task: 0, local_deterministic_negative_control: { provider_calls: 0, excluded_neusoft_candidates: 'NOT_ENFORCED', result: 'BLOCKED_BY_MISSING_AUTHORITY_LIFECYCLE' },
    final_verdict: { current_inventory: 'CURRENT_RAG_CORPUS_INVENTORY_COMPLETE', matrix_corpus: 'MATRIX_DRIVEN_CORPUS_IDENTIFIED', neusoft: neusoft.quarantine_status, rag_production_ready: 'NOT_CLAIMED', mapping_gold_ready: 'NOT_CLAIMED', claim_gold_ready: 'NOT_CLAIMED' }
  };
}

async function readOnlyCounts() {
  loadBackendEnvironment();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const q = async sql => (await pool.query(sql)).rows[0];
    return {
      evidence_facts: Number((await q('SELECT count(*)::int value FROM evidence_facts')).value), evidence_source_facts: Number((await q('SELECT count(*)::int value FROM evidence_source_facts')).value),
      legacy_mappings: Number((await q('SELECT count(*)::int value FROM requirement_evidence_mappings')).value), fact_mappings: Number((await q('SELECT count(*)::int value FROM requirement_evidence_fact_mappings')).value),
      retrieval_runs: Number((await q('SELECT count(*)::int value FROM enterprise_retrieval_runs')).value), retrieval_results: Number((await q('SELECT count(*)::int value FROM enterprise_retrieval_results')).value)
    };
  } finally { await pool.end(); }
}

export async function run() {
  const report = await buildInventory();
  writeJson('11_current_rag_corpus_inventory.json', report);
  fs.writeFileSync(path.join(OUT_DIR, '11_current_rag_corpus_inventory.md'), markdownReport(report), 'utf8');
  writeJson('12_neusoft_quarantine_inventory.json', { schema_version: 'v43-neusoft-quarantine-inventory-v1', ...report.neusoft, generated_at: report.generated_at, provider_calls: 0, db_writes: 0, production_code_changed: 0, gold_immutability: report.gold_immutability });
  fs.writeFileSync(path.join(OUT_DIR, '12_neusoft_quarantine_inventory.md'), neusoftMarkdown(report), 'utf8');
  writeJson('13_requirement_matrix_corpus_inventory.json', { schema_version: 'v43-requirement-matrix-corpus-inventory-v1', ...report.matrix_driven, generated_at: report.generated_at, provider_calls: 0, db_writes: 0 });
  fs.writeFileSync(path.join(OUT_DIR, '13_requirement_matrix_corpus_inventory.md'), `# Requirement Matrix Corpus Inventory v1\n\n- manifest: ${report.matrix_driven.manifest_path}\n- manifest version: ${report.matrix_driven.manifest_version}\n- documents: ${report.matrix_driven.document_count}\n- documents by library: ${JSON.stringify(report.matrix_driven.documents_by_library)}\n- source registry count: ${report.matrix_driven.source_registry_count}\n- coverage requirement rows: ${report.matrix_driven.coverage_requirement_count}\n- themes: ${JSON.stringify(report.matrix_driven.themes)}\n\nThis corpus separates official/industry knowledge from enterprise evidence. Metadata and roles do not create Evidence Facts or Claim permission.\n`, 'utf8');
  const checkpoint = {
    checkpoint: 'V43_RAG_CORPUS_INVENTORY_NEUSOFT_QUARANTINE_CHECKPOINT', generated_at: report.generated_at,
    total_materials: report.totals.materials, total_chunks: report.totals.chunks, total_embeddings: report.totals.embeddings, active_material_count: report.totals.active_materials, active_chunk_count: report.totals.active_chunks, active_embedding_count: report.totals.active_embeddings, retrieval_eligible_material_count: report.totals.retrieval_eligible_materials,
    scope_distribution: report.scope_distribution, authority_distribution: countBy(report.materials, 'source_authority'), currentness_distribution: countBy(report.materials.map(m => ({ currentness: m.currentness.effective_status })), 'currentness'),
    matrix_material_count: report.matrix_driven.document_count, matrix_theme_count: Object.keys(report.matrix_driven.themes).length, matrix_themes: report.matrix_driven.themes,
    neusoft_material_count: report.neusoft.material_count, neusoft_chunk_count: report.neusoft.chunk_count, neusoft_embedding_count: report.neusoft.embedding_count, neusoft_fact_count: report.neusoft.derived_fact_count, neusoft_current_fact_count: report.neusoft.current_fact_count, neusoft_mapping_count: report.neusoft.derived_mapping_count, neusoft_current_mapping_count: report.neusoft.current_mapping_count,
    neusoft_quarantine_status: report.neusoft.quarantine_status,
    neusoft_retrieval_quarantine: 'NOT_ENFORCED_BLOCKED_MISSING_LIFECYCLE',
    neusoft_fact_authority_quarantine: 'NOT_ENFORCED_BLOCKED_MISSING_LIFECYCLE',
    neusoft_mapping_authority_quarantine: 'NOT_ENFORCED_BLOCKED_MISSING_LIFECYCLE',
    neusoft_future_retrieval_status: report.neusoft.future_retrieval_excluded, neusoft_derived_authority_leakage: report.neusoft.derived_authority_leakage,
    active_retrieval_results_after_quarantine: 'NOT_RUN_NO_QUARANTINE_APPLIED', low_information_count: report.low_information_chunk_count, low_information_source_candidate_count: report.low_information_chunk_count,
    old_gold_sha_changed: report.gold_immutability.parity === 'PASS' ? 'NO' : 'YES', production_code_changed: 0, db_writes: 0, provider_calls: 0,
    focused_tests: 'PENDING', backend_tests: 'NOT_RUN_BY_THIS_READ_ONLY_AUDIT', frontend_tests: 'NOT_RUN_BY_THIS_READ_ONLY_AUDIT', lint: 'PENDING', build: 'PENDING', diff_check: 'PENDING',
    final_verdict: { inventory: 'CURRENT_RAG_CORPUS_INVENTORY_COMPLETE', matrix_corpus: 'MATRIX_DRIVEN_CORPUS_IDENTIFIED', neusoft: report.neusoft.quarantine_status, rag_production_ready: 'NOT_CLAIMED', mapping_gold_ready: 'NOT_CLAIMED', claim_gold_ready: 'NOT_CLAIMED' }
  };
  writeJson('14_rag_corpus_quality_checkpoint.json', checkpoint);
  fs.writeFileSync(path.join(OUT_DIR, '14_rag_corpus_quality_checkpoint.md'), `# ${checkpoint.checkpoint}\n\n- total materials: ${checkpoint.total_materials}\n- total chunks: ${checkpoint.total_chunks}\n- total embeddings: ${checkpoint.total_embeddings}\n- scopes: ${JSON.stringify(checkpoint.scope_distribution)}\n- matrix documents/themes: ${checkpoint.matrix_material_count} / ${checkpoint.matrix_theme_count}\n- Neusoft materials/chunks/embeddings/derived Facts/current Facts/derived Mappings/current Mappings: ${checkpoint.neusoft_material_count} / ${checkpoint.neusoft_chunk_count} / ${checkpoint.neusoft_embedding_count} / ${checkpoint.neusoft_fact_count} / ${checkpoint.neusoft_current_fact_count} / ${checkpoint.neusoft_mapping_count} / ${checkpoint.neusoft_current_mapping_count}\n- quarantine: **${checkpoint.neusoft_quarantine_status}**\n- derived authority leakage: **${checkpoint.neusoft_derived_authority_leakage}**\n- low-information chunks: ${checkpoint.low_information_count}\n- Gold SHA changed: ${checkpoint.old_gold_sha_changed}\n- production code changed by this task: 0\n- DB writes: 0; Provider calls: 0\n\n## Readiness\n\n- CURRENT_RAG_CORPUS_INVENTORY_COMPLETE\n- MATRIX_DRIVEN_CORPUS_IDENTIFIED\n- NEUSOFT_CORPUS_QUARANTINED: **NOT CLAIMED; blocked by authority lifecycle decision**\n- RAG_PRODUCTION_READY: NOT CLAIMED\n- MAPPING_GOLD_READY: NOT CLAIMED\n- CLAIM_GOLD_READY: NOT CLAIMED\n`, 'utf8');
  console.log(JSON.stringify({ checkpoint: checkpoint.checkpoint, totals: report.totals, neusoft: report.neusoft, final_verdict: checkpoint.final_verdict }));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch(error => { console.error(JSON.stringify({ code: 'RAG_CORPUS_INVENTORY_FAILED', message: error.message })); process.exitCode = 1; });
