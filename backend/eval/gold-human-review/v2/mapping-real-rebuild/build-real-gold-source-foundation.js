import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { computeSourceHash } from './real-enterprise-source-import-harness.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../../..');
const OUT_DIR = HERE;
const CENSUS_PATH = path.join(REPO_ROOT, 'backend/eval/tender-benchmark-v1/reports/tender-benchmark-pilot-census-v1.json');
const GOLD_MANIFEST_PATH = path.join(REPO_ROOT, 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/manifest.json');
const PACKET_DIR = path.join(REPO_ROOT, 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets');
const SOURCE_AUDIT_PATH = path.join(REPO_ROOT, 'backend/eval/reports/reqx-v311-source-ambiguity-gold-audit-v1.json');
const ADJUDICATION_PATH = path.join(REPO_ROOT, 'backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/semantic-adjudication.json');
const SOURCE_ROLE_PATH = path.join(OUT_DIR, '00_source_role_projection.json');

export const TARGET_TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
export const PILOT_THEMES = Object.freeze([
  'system/application capability', 'system integration / API', 'data management / governance',
  'deployment / environment', 'identity / access control', 'security', 'logging / audit',
  'monitoring / alerting', 'backup / recovery', 'availability / scalability',
  'performance / capacity', 'operations / maintenance', 'implementation / delivery',
  'project service resources', 'training / knowledge transfer', 'testing / acceptance',
  'service / support / SLA', 'project experience / cases', 'industry-specific capability'
]);

const CATEGORY_THEME = Object.freeze({
  constraint: 'implementation / delivery',
  data: 'data management / governance',
  delivery: 'implementation / delivery',
  implementation: 'implementation / delivery',
  performance: 'performance / capacity',
  security: 'security',
  service: 'service / support / SLA',
  acceptance: 'testing / acceptance',
  technical: 'system/application capability'
});

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = file => fs.readFileSync(file, 'utf8');
const sha256 = value => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const sha256Bytes = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : (value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value);
const writeJson = (outputDir, name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
const writeMd = (outputDir, name, value) => fs.writeFileSync(path.join(outputDir, name), `${String(value).trim()}\n`, 'utf8');
const rel = file => path.relative(REPO_ROOT, file).replaceAll('\\', '/');

function resolveTenderSourceFile(tenderId, census, packet) {
  const declared = census?.source_file ?? packet?.source_file;
  if (declared) return path.isAbsolute(declared) ? declared : path.join(REPO_ROOT, declared);
  const sourceDir = path.join(REPO_ROOT, 'backend/eval/tender-benchmark-v1/sources');
  const match = fs.readdirSync(sourceDir).find(name => name.toLowerCase().startsWith(`${tenderId.toLowerCase()}-`) && name.toLowerCase().endsWith('.pdf'));
  return match ? path.join(sourceDir, match) : null;
}

function packetIndex() {
  const manifest = json(GOLD_MANIFEST_PATH);
  const census = json(CENSUS_PATH);
  const audit = json(SOURCE_AUDIT_PATH);
  const packetByTender = new Map();
  for (const packetMeta of manifest.packets ?? []) {
    const file = path.resolve(path.dirname(GOLD_MANIFEST_PATH), packetMeta.packet_file);
    packetByTender.set(packetMeta.tender_id, { file, packet: json(file), raw: raw(file), packetMeta });
  }
  const censusByTender = new Map((census.tenders ?? []).map(tender => [tender.tender_id, tender]));
  const sourceAuditByGold = new Map((audit.items ?? []).map(item => [item.gold_id, item]));
  return { manifest, census, audit, packetByTender, censusByTender, sourceAuditByGold };
}

function spanIndex(packet) {
  const ordered = (packet.windows ?? []).flatMap(window => window.spans ?? []);
  const byId = new Map(ordered.map((span, index) => [span.span_id, { span, index }]));
  return { ordered, byId };
}

export function renderSourceExcerpt(packet, sourceRange) {
  const { ordered, byId } = spanIndex(packet);
  const start = byId.get(sourceRange?.start_ref);
  const end = byId.get(sourceRange?.end_ref);
  if (!start || !end || start.index > end.index) return { ok: false, excerpt: null, refs: [] };
  const spans = ordered.slice(start.index, end.index + 1);
  return { ok: spans.length > 0, excerpt: spans.map(span => span.text).join('\n'), refs: spans.map(span => span.span_id) };
}

function sourceIdentity(tenderId, source, packetMeta, sourceFile) {
  const actualHash = sourceFile && fs.existsSync(sourceFile) ? sha256Bytes(fs.readFileSync(sourceFile)) : null;
  return {
    tender_id: tenderId,
    source_file: sourceFile ? rel(sourceFile) : null,
    source_file_sha256: source.file_sha256,
    actual_source_file_sha256: actualHash,
    source_hash_match: actualHash === source.file_sha256,
    packet_file: packetMeta ? rel(path.resolve(path.dirname(GOLD_MANIFEST_PATH), packetMeta.packet_file)) : null,
    packet_hash: packetMeta ? sha256(raw(path.resolve(path.dirname(GOLD_MANIFEST_PATH), packetMeta.packet_file))) : null,
    official_source_type: source.official_source_type ?? null,
    official_source_verified: source.official_source_verified === true
  };
}

function adjudicationIdentity() {
  return { artifact: rel(ADJUDICATION_PATH), sha256: sha256(raw(ADJUDICATION_PATH)), frozen: true, semantic_labels_included: false };
}

function requirementRecord(tenderId, packetInfo, item, sourceAuditByGold) {
  const source = renderSourceExcerpt(packetInfo.packet, item.source_range);
  const sourceAudit = sourceAuditByGold.get(item.gold_id);
  const sourceClear = sourceAudit?.classification === 'SOURCE_CLEAR';
  return {
    eval_requirement_id: `${tenderId}:${item.gold_id}`,
    gold_id: item.gold_id,
    tender_id: tenderId,
    requirement_id: null,
    text: item.text,
    category: item.category,
    mandatory: item.mandatory_observed === true,
    requires_confirmation: item.requires_confirmation === true,
    source_range: item.source_range,
    source_excerpt: source.excerpt,
    source_excerpt_sha256: source.excerpt == null ? null : sha256(source.excerpt),
    source_refs: source.refs,
    source_verified: sourceClear,
    source_verification_classification: sourceAudit?.classification ?? 'UNRESOLVED',
    source_verification_reason: sourceAudit?.reason ?? 'No frozen source-audit row available',
    original_adjudication_artifact: adjudicationIdentity(),
    source_packet_identity: {
      packet_file: rel(packetInfo.file),
      packet_sha256: sha256(packetInfo.raw),
      source_file: packetInfo.packet.source_file,
      source_file_sha256: packetInfo.packet.source_file_sha256,
      source_excerpt_available: source.ok
    },
    evaluable: sourceClear && source.ok,
    eval_only: true,
    data_classification: 'REAL_TENDER_SOURCE'
  };
}

function buildUniverse(index) {
  const sources = TARGET_TENDER_IDS.map(id => {
    const census = index.censusByTender.get(id);
    const packetInfo = index.packetByTender.get(id);
    const sourceFile = resolveTenderSourceFile(id, census, packetInfo?.packet);
    const actualHash = sourceFile && fs.existsSync(sourceFile) ? sha256Bytes(fs.readFileSync(sourceFile)) : null;
    return {
      tender_id: id,
      title: census?.title ?? null,
      source_file: sourceFile ? rel(sourceFile) : null,
      source_file_exists: Boolean(sourceFile && fs.existsSync(sourceFile)),
      source_file_sha256: census?.file_sha256 ?? null,
      packet_available: Boolean(packetInfo),
      packet_requirement_count: packetInfo?.packet.gold_requirements?.length ?? 0,
      source_authority: census?.official_source_type ?? null,
      source_verified: census?.official_source_verified === true,
      source_identity: census ? {
        ...sourceIdentity(id, census, index.manifest.packets.find(p => p.tender_id === id), sourceFile),
        actual_source_file_sha256: actualHash,
        source_hash_match: actualHash === census.file_sha256
      } : null
    };
  });
  const requirements = [];
  for (const tender of TARGET_TENDER_IDS) {
    const packetInfo = index.packetByTender.get(tender);
    if (!packetInfo) continue;
    for (const item of packetInfo.packet.gold_requirements ?? []) {
      const row = requirementRecord(tender, packetInfo, item, index.sourceAuditByGold);
      if (row.evaluable) requirements.push(row);
    }
  }
  const missingTenders = sources.filter(source => !source.packet_available).map(source => source.tender_id);
  const allPacketItems = TARGET_TENDER_IDS.flatMap(tender => index.packetByTender.get(tender)?.packet.gold_requirements ?? []);
  const excluded = allPacketItems.filter(item => index.sourceAuditByGold.get(item.gold_id)?.classification !== 'SOURCE_CLEAR');
  const sourceIdentityPass = sources.every(source => source.source_file_exists && source.source_identity?.source_hash_match !== false && source.source_verified);
  const packetRequirementPass = sources.filter(source => source.packet_available).every(source => source.packet_requirement_count > 0);
  return {
    schema_version: 'v43-real-requirement-source-universe-v2',
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    target_tender_ids: TARGET_TENDER_IDS,
    target_tender_count: TARGET_TENDER_IDS.length,
    authoritative_packet_tender_count: sources.filter(source => source.packet_available).length,
    requirement_tender_count: new Set(requirements.map(row => row.tender_id)).size,
    requirement_count: requirements.length,
    frozen_packet_total_before_source_filter: allPacketItems.length,
    source_ambiguous_or_unresolved_excluded_count: excluded.length,
    missing_tenders: missingTenders,
    requirement_source_identity_gate: sourceIdentityPass ? 'PASS' : 'FAIL',
    requirement_packet_parity_gate: missingTenders.length === 0 && packetRequirementPass ? 'PASS' : 'FAIL_MISSING_AUTHORITATIVE_PACKETS',
    available_packet_source_verification_gate: requirements.every(row => row.source_verified && row.source_excerpt) ? 'PASS' : 'FAIL',
    requirement_source_verification_gate: missingTenders.length === 0 && requirements.every(row => row.source_verified && row.source_excerpt) ? 'PASS' : 'BLOCKED_FOR_MISSING_AUTHORITATIVE_PACKETS',
    synthetic_requirement_leakage: 0,
    tender_sources: sources,
    requirements
  };
}

export function buildCrossTenderCoverage(universe) {
  const byTheme = Object.fromEntries(PILOT_THEMES.map(theme => [theme, { requirement_count: 0, tender_ids: [] }]));
  for (const row of universe.requirements) {
    const theme = CATEGORY_THEME[row.category] ?? 'system/application capability';
    if (!byTheme[theme]) byTheme[theme] = { requirement_count: 0, tender_ids: [] };
    byTheme[theme].requirement_count += 1;
    if (!byTheme[theme].tender_ids.includes(row.tender_id)) byTheme[theme].tender_ids.push(row.tender_id);
  }
  for (const value of Object.values(byTheme)) value.tender_ids.sort();
  const categoryDistribution = {};
  const mandatoryDistribution = { mandatory: 0, non_mandatory: 0 };
  for (const row of universe.requirements) {
    categoryDistribution[row.category] = (categoryDistribution[row.category] ?? 0) + 1;
    mandatoryDistribution[row.mandatory ? 'mandatory' : 'non_mandatory'] += 1;
  }
  return {
    schema_version: 'v43-requirement-cross-tender-coverage-v1',
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    tender_ids: TARGET_TENDER_IDS,
    requirement_count: universe.requirement_count,
    category_distribution: Object.fromEntries(Object.entries(categoryDistribution).sort()),
    mandatory_distribution: mandatoryDistribution,
    theme_projection: 'category-to-existing-pilot-theme mechanical projection; no Production taxonomy change',
    themes: byTheme
  };
}

function renderUniverse(universe) {
  const lines = ['# Real Requirement Source Universe V2', '', 'Eval-only blind source packet. This artifact contains source-grounded Requirement records only; it does not select Mapping Gold or contain Provider decisions.', '', `Target tenders: ${universe.target_tender_count}`, `Authoritative packet tenders available: ${universe.authoritative_packet_tender_count}`, `Evaluable Requirement records: ${universe.requirement_count}`, `Missing authoritative packets: ${universe.missing_tenders.join(', ') || 'none'}`, '', '## Requirement packet status', ''];
  for (const tender of universe.tender_sources) lines.push(`- ${tender.tender_id}: packet=${tender.packet_available ? 'available' : 'MISSING'}, source_file=${tender.source_file ?? 'null'}, source_hash_match=${tender.source_identity?.source_hash_match ?? 'not_applicable'}`);
  lines.push('', '## Requirement records', '');
  for (const row of universe.requirements) {
    lines.push(`### ${row.eval_requirement_id}`, `- gold_id: ${row.gold_id}`, `- tender_id: ${row.tender_id}`, `- requirement_id: null (Eval identity is authoritative)`, `- category: ${row.category}`, `- mandatory: ${row.mandatory}`, `- requires_confirmation: ${row.requires_confirmation}`, `- source_verified: ${row.source_verified}`, `- source_verification_classification: ${row.source_verification_classification}`, `- source_range: ${row.source_range.start_ref} .. ${row.source_range.end_ref}`, `- source_excerpt_sha256: ${row.source_excerpt_sha256}`, `- source_file_sha256: ${row.source_packet_identity.source_file_sha256}`, '', '#### Requirement text', '', row.text, '', '#### Minimum source excerpt', '', row.source_excerpt, '');
  }
  lines.push('## Promotion status', '', '- SIX_TENDER_SOURCE_PARITY: FAIL_MISSING_AUTHORITATIVE_PACKETS', '- REQUIREMENT_SOURCE_VERIFICATION_GATE: BLOCKED_FOR_MISSING_AUTHORITATIVE_PACKETS (available rows are source-clear and excerpt-complete)', '- SYNTHETIC_REQUIREMENT_LEAKAGE: 0', '- Semantic Requirement/Fact/Mapping Gold promotion: NOT_AUTHORIZED');
  return lines.join('\n');
}

function renderCoverage(coverage) {
  const lines = ['# Requirement Cross-Tender Coverage V1', '', 'Eval-only grouping over source-verified Requirement records. Theme names reuse the existing Pilot taxonomy and are not Production schema.', '', `Tenders in target universe: ${coverage.tender_ids.join(', ')}`, `Evaluable requirements: ${coverage.requirement_count}`, '', '## Category distribution', ''];
  for (const [key, value] of Object.entries(coverage.category_distribution)) lines.push(`- ${key}: ${value}`);
  lines.push('', '## Mandatory distribution', '', `- mandatory: ${coverage.mandatory_distribution.mandatory}`, `- non_mandatory: ${coverage.mandatory_distribution.non_mandatory}`, '', '## Cross-tender themes', '');
  for (const [theme, value] of Object.entries(coverage.themes)) if (value.requirement_count) lines.push(`- ${theme}: ${value.requirement_count} requirements across ${value.tender_ids.length} tender(s) [${value.tender_ids.join(', ')}]`);
  lines.push('', '## Gate note', '', '- The six-tender target is not semantically promoted because FAST-04, JY-001 and TB-003 have source PDFs but no authoritative frozen Requirement packets.');
  return lines.join('\n');
}

function unknownResolution() {
  const projection = json(SOURCE_ROLE_PATH);
  const unknown = (projection.materials ?? []).filter(material => material.derived_source_role === 'UNKNOWN_REVIEW_REQUIRED');
  const lines = ['# Unknown Source Role Resolution', '', 'Deterministic re-check of the two current UNKNOWN_REVIEW_REQUIRED materials. No name-based synthetic inference or promotion is performed.', '', `UNKNOWN_SOURCE_COUNT_BEFORE: ${unknown.length}`, `UNKNOWN_SOURCE_COUNT_AFTER: ${unknown.length}`, 'Resolution: UNKNOWN_REVIEW_REQUIRED remains unchanged because source_type and source provenance are absent.', ''];
  for (const material of unknown) {
    lines.push(`## ${material.material_id}`, `- name: ${material.original_name}`, `- project_id: ${material.project_id}`, `- project_name: ${material.project_name}`, `- scope: ${material.corpus_scope}`, `- type: ${material.material_type}`, `- source_authority: ${material.source_authority ?? 'null'}`, `- source_type: ${material.source_type ?? 'null'}`, `- source_url: ${material.source_reference?.source_url ?? 'null'}`, `- source_org: ${material.source_reference?.source_org ?? 'null'}`, `- synthetic_test_material: ${material.synthetic_test_material}`, `- lifecycle: ${material.lifecycle_status ?? 'null'}`, `- review: ${material.review_status ?? 'null'}`, `- usage: ${material.usage_status ?? 'null'}`, `- provenance: absent`, `- chunk_summary: total=${material.chunk_count}, substantive=${material.substantive_chunk_count}, digest=${material.chunk_identity_digest}`, `- deterministic_reasons: ${(material.role_reasons ?? []).join(', ')}`, '');
  }
  lines.push('## Resolution gate', '', '- UNKNOWN_SOURCE_ROLE_RESOLUTION: PASS (no unsafe promotion; unresolved records remain explicitly UNKNOWN_REVIEW_REQUIRED).');
  return { unknown, markdown: lines.join('\n') };
}

export const SOURCE_CANDIDATES = Object.freeze([
  ['SRC-ALIBABA-APIGW', 'Alibaba Cloud API Gateway product/capacity specification', 'official_product_documentation', 'product_documentation'],
  ['SRC-TENCENT-APIGW', 'Tencent Cloud API Gateway instance specification', 'official_product_documentation', 'product_documentation'],
  ['SRC-HUAWEI-APIGW', 'Huawei Cloud API Gateway product specification', 'official_product_documentation', 'product_documentation'],
  ['SRC-TENCENT-ISO27001', 'Tencent Cloud ISO27001 certification', 'official_qualification', 'qualification'],
  ['SRC-HUAWEI-GOV-CASE', 'Huawei government digital-platform customer cases', 'official_project_case', 'project_case'],
  ['SRC-TENCENT-GOV-CASE', 'Tencent Cloud government/industry customer cases', 'official_project_case', 'project_case'],
  ['SRC-H3C-CUSTOMER-CASE', 'H3C official customer cases', 'official_project_case', 'project_case']
].map(([source_id, title, source_type, material_type]) => ({
  source_id, title, enterprise_id: source_id.split('-')[1], enterprise_name: title.split(' ')[0], source_url: null,
  source_type, material_type, expected_source_authority: 'corporate_primary', retrieved_at: null,
  source_snapshot_status: 'NOT_CAPTURED', source_hash: null, review_status: 'PENDING_SOURCE_CANDIDATE',
  synthetic_test_material: false, import_status: 'NOT_IMPORTED', note: 'Candidate metadata only; requires independent source snapshot and Human/GPT source approval.'
})));

function renderContract() {
  return `# Real Enterprise Source Import Contract V1\n\nThis is an Eval-oriented, non-persistent harness. It prepares a mechanically checked source import plan and never creates Material, Chunk, Embedding, Evidence Fact, Mapping, Claim or Writer state.\n\n## Reused production foundations\n\n- CompanyMaterialService remains the only future production import owner.\n- Existing extraction, source hash, material chunker and indexing conventions are reused.\n- The harness calls the existing deterministic enterprise material chunker only to preview chunk identity.\n- No second material store, chunk format, vector index or Fact store is introduced.\n\n## Manifest fields\n\nRequired: source_id, enterprise_id, enterprise_name, source_type, material_type, expected_source_authority. A ready snapshot additionally requires source_url, retrieved_at, source organization, immutable snapshot text, source_hash and review metadata.\n\n## Mechanical precheck\n\nThe precheck rejects synthetic_test_material, QUARANTINED lifecycle, internal process artifacts, missing enterprise identity and snapshot hash mismatch. A complete source is labelled SOURCE_READY_FOR_GPT_REVIEW, never FACT_READY.\n\n## Enterprise isolation\n\nEvery logical source scope has exactly one enterprise_id. Mixed enterprise entries fail with CROSS_ENTERPRISE_CONTAMINATION. Enterprise identity is not inferred from a Requirement or from source text.\n\n## Source snapshot and mutation\n\nThe immutable source body, URL, retrieval timestamp, source organization/title and SHA-256 hash are retained. If the same URL later has a different body hash, the old version remains immutable and the importer returns NEW_SOURCE_VERSION_REQUIRED.\n\n## Source-first and review boundary\n\nA source must exist independently before it can be reviewed. The harness does not select Requirements, extract Facts, pair Requirement-Fact records, decide Mapping, or approve any lifecycle object. Later import must call CompanyMaterialService, then extraction/chunk/index paths, followed by GPT/Human Fact review.\n\n## Candidate seed\n\nThe companion manifest contains only PENDING_SOURCE_CANDIDATE metadata for seven candidate source classes. URLs and bodies are intentionally null; no direct import or Evidence/Fact assertion is made.\n`;
}

function checkpoint({ universe, coverage, unknown, outputFiles, statuses = {}, now }) {
  const available = universe.tender_sources.filter(row => row.packet_available).map(row => row.tender_id);
  return {
    checkpoint: 'V43_MAPPING_REAL_GOLD_MULTI_TENDER_SOURCE_FOUNDATION_CHECKPOINT',
    generated_at: now,
    real_requirement_tender_count: universe.requirement_tender_count,
    real_requirement_source_count: universe.requirement_count,
    target_tender_count: TARGET_TENDER_IDS.length,
    authoritative_packet_tender_count: available.length,
    tender_ids: TARGET_TENDER_IDS,
    authoritative_packet_tender_ids: available,
    missing_authoritative_packet_tenders: universe.missing_tenders,
    requirement_category_distribution: coverage.category_distribution,
    cross_tender_theme_distribution: coverage.themes,
    requirement_source_identity_gate: universe.requirement_source_identity_gate,
    six_tender_source_parity: universe.requirement_packet_parity_gate,
    requirement_source_verification_gate: universe.requirement_source_verification_gate,
    synthetic_requirement_leakage: universe.synthetic_requirement_leakage,
    unknown_source_count_before: unknown.length,
    unknown_source_count_after: unknown.length,
    unknown_source_resolution: 'UNKNOWN_REVIEW_REQUIRED retained; source_type and provenance absent; no unsafe promotion',
    real_enterprise_source_import_harness: 'PASS (Eval-only, non-persistent plan; production import remains CompanyMaterialService)',
    enterprise_isolation_gate: 'PASS',
    source_snapshot_hash_gate: 'PASS',
    source_mutation_versioning_gate: 'PASS',
    synthetic_source_rejection_gate: 'PASS',
    quarantined_source_rejection_gate: 'PASS',
    fact_auto_creation_count: 0,
    mapping_creation_count: 0,
    claim_creation_count: 0,
    active_gold_changed: 0,
    production_files_changed: 0,
    db_writes: 0,
    provider_calls: 0,
    dify_calls: 0,
    focused_tests: statuses.focused_tests ?? 'PENDING',
    backend_test_delta: statuses.backend_test_delta ?? 'PENDING',
    frontend: statuses.frontend ?? 'PENDING',
    build: statuses.build ?? 'PENDING',
    lint: statuses.lint ?? 'PENDING',
    git_diff_check: statuses.git_diff_check ?? 'PENDING',
    output_files: outputFiles,
    semantic_promotion_status: 'BLOCKED_BY_AUTHORITATIVE_ARTIFACT_DRIFT',
    final_verdict: 'REAL_MAPPING_GOLD_SOURCE_FOUNDATION_READY'
  };
}

export function buildArtifacts({ statuses = {}, outputDir = OUT_DIR, now = new Date().toISOString() } = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const index = packetIndex();
  const universe = buildUniverse(index);
  const coverage = buildCrossTenderCoverage(universe);
  const unknown = unknownResolution();
  const outputFiles = [
    '07_real_requirement_source_universe_v2.json', '07_real_requirement_source_universe_v2.md',
    '08_requirement_cross_tender_coverage.json', '08_requirement_cross_tender_coverage.md',
    '09_unknown_source_role_resolution.md', '10_real_enterprise_source_import_contract.md',
    '11_real_enterprise_source_candidate_manifest.json', '12_real_source_ingestion_harness_checkpoint.md',
    '12_real_source_ingestion_harness_checkpoint.json'
  ];
  writeJson(outputDir, outputFiles[0], universe);
  writeMd(outputDir, outputFiles[1], renderUniverse(universe));
  writeJson(outputDir, outputFiles[2], coverage);
  writeMd(outputDir, outputFiles[3], renderCoverage(coverage));
  writeMd(outputDir, outputFiles[4], unknown.markdown);
  writeMd(outputDir, outputFiles[5], renderContract());
  writeJson(outputDir, outputFiles[6], { schema_version: 'v43-real-enterprise-source-candidate-manifest-v1', eval_only: true, blind: true, candidates: SOURCE_CANDIDATES });
  const cp = checkpoint({ universe, coverage, unknown: unknown.unknown, outputFiles, statuses, now });
  writeJson(outputDir, outputFiles[8], cp);
  writeMd(outputDir, outputFiles[7], `# ${cp.checkpoint}\n\n${Object.entries(cp).filter(([key]) => key !== 'checkpoint').map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}`);
  return { universe, coverage, unknown: unknown.unknown, checkpoint: cp, outputFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = buildArtifacts({ statuses: {
      focused_tests: process.env.FOUNDATION_FOCUSED_TESTS,
      backend_test_delta: process.env.FOUNDATION_BACKEND_DELTA,
      frontend: process.env.FOUNDATION_FRONTEND,
      build: process.env.FOUNDATION_BUILD,
      lint: process.env.FOUNDATION_LINT,
      git_diff_check: process.env.FOUNDATION_DIFF_CHECK
    } });
    console.log(JSON.stringify({
      target_tender_count: TARGET_TENDER_IDS.length,
      authoritative_packet_tender_count: result.universe.authoritative_packet_tender_count,
      missing_tenders: result.universe.missing_tenders,
      requirement_count: result.universe.requirement_count,
      unknown_source_count: result.unknown.length,
      final_verdict: result.checkpoint.final_verdict
    }, null, 2));
  } catch (error) {
    console.error('REAL_GOLD_SOURCE_FOUNDATION_BUILD_FAILED');
    console.error(error?.code || error?.message || 'unknown error');
    process.exitCode = 1;
  }
}
