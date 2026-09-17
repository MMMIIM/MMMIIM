import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStructuralOnlyEvidenceText } from '../../src/evidence-search-orchestrator.js';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const SNAPSHOT_DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.json`);
const JSON_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.corpus-quality-audit.json`);
const MD_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.corpus-quality-audit.md`);
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const ULTRA_SHORT_MAX = 24;

const text = value => String(value ?? '');
const normalized = value => text(value).normalize('NFKC').replace(/\r\n?/g, '\n').trim();
const lines = value => normalized(value).split('\n').map(line => line.trim()).filter(Boolean);
const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const keyOf = item => `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
const referenceMarker = /(?:https?:\/\/|\b(?:OFF|REF|SRC|DOC)[-_]?[A-Z]?\d{1,4}\b|来源(?:单位|组织)?|发布单位|发布日期|最后核验|有效期|文号|出处|状态\s*[:：`]|实施\s*[:：`])/iu;
const metadataMarker = /^(?:representative_synthetic|synthetic_test_material|not_real_customer_data|subject|source_type|source_org|license_or_usage_status|material_id|scope|corpus_scope|industry|material_type|review_status|project_name|owner|document_id|chunk_id)\s*[:=]/iu;
const evidencePredicate = /(?:\b(?:is|are|was|were|has|have|supports?|provides?|delivers?|completed?|deployed?|uses?|meets?|includes?|contains?|runs?|passed?|certified?|approved?|registered?|active|available|verified|recorded|accepted|responsible|requires?|ensures?|achieves?|achieved)\b|(?:具有|具备|拥有|支持|提供|完成|通过|采用|满足|包含|包括|达到|部署|负责|承担|实现|可以|能够|使用|配置|运行|记录|验收|签订|获得|认证|注册)|(?:项目主体|产品型号|系统版本|测试结果|实施期|合同)|\d+(?:\.\d+)?\s*(?:秒|毫秒|次|人|年|月|天|个|%|万元)?)/iu;

function sourceIdentityHash(sources) {
  const rows = sources.flatMap(source => source.chunks.map(chunk => ({
    material_id: chunk.material_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash
  })));
  return sha256(JSON.stringify(rows));
}

function isHeading(value) {
  return /^#{1,6}\s+\S.*$/u.test(value);
}

function isUrl(value) {
  return /^https?:\/\/\S+$/iu.test(value);
}

function isOnlyMetadataUrlsHeadings(value) {
  const valueLines = lines(value);
  return valueLines.length > 0 && valueLines.every(line => isHeading(line) || isUrl(line) || metadataMarker.test(line) || /^-{3,}$/u.test(line));
}

function headingEntries(source) {
  return lines(source).flatMap(line => {
    const match = line.match(/^#{1,6}\s+(.+)$/u);
    return match ? [{ heading: normalized(match[1]).toLocaleLowerCase(), raw: match[1] }] : [];
  });
}

function isMixedEvidenceReference(value) {
  const valueLines = lines(value);
  const referenceLines = valueLines.filter(line => referenceMarker.test(line));
  const evidenceLines = valueLines.filter(line => !isHeading(line) && !metadataMarker.test(line) && !referenceMarker.test(line) && evidencePredicate.test(line));
  return referenceLines.length > 0 && evidenceLines.length > 0;
}

function lengthStats(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = ratio => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] : 0;
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    min: sorted[0] || 0,
    p25: percentile(0.25),
    median: percentile(0.5),
    p75: percentile(0.75),
    max: sorted.at(-1) || 0,
    mean: sorted.length ? Number((total / sorted.length).toFixed(2)) : 0,
    buckets: {
      '0-24': sorted.filter(value => value <= 24).length,
      '25-119': sorted.filter(value => value >= 25 && value <= 119).length,
      '120-599': sorted.filter(value => value >= 120 && value <= 599).length,
      '600-1199': sorted.filter(value => value >= 600 && value <= 1199).length,
      '1200+': sorted.filter(value => value >= 1200).length
    }
  };
}

function summarizeChunk(chunk, source) {
  return {
    material_id: source.material_id,
    material_com_id: source.doc_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash,
    content_length: text(chunk.source_text).length,
    source_span: `${chunk.chunk_id}:FULL`,
    source_text: text(chunk.source_text)
  };
}

function buildMarkdown(audit) {
  const linesOut = [
    '# V43 Evidence Candidate Corpus Quality Audit',
    '',
    `Status: ${audit.status}`,
    `Snapshot: ${audit.snapshot_id}`,
    `Enterprise: ${audit.enterprise_id}`,
    `Identity hash: ${audit.identity_hash}`,
    '',
    'This is a deterministic corpus-shape audit. It assigns no semantic support, Fact truth, Mapping relationship, Claim eligibility, or Gold label.',
    '',
    `Materials: ${audit.material_count}; chunks: ${audit.chunk_count}`,
    `Structural-only: ${audit.structural_only_count}; substantive: ${audit.substantive_count}`,
    `Exact duplicate chunk groups: ${audit.exact_duplicate_chunk_hash_groups.length}; duplicate ratio: ${audit.duplicate_ratio}`,
    `Ultra-short threshold: <= ${audit.ultra_short_threshold} characters; count: ${audit.ultra_short_chunks.length}`,
    `Metadata/URL/heading-only count: ${audit.metadata_url_heading_only_count}`,
    `Mixed evidence + reference-style count: ${audit.mixed_evidence_reference_style_count}`,
    '',
    '## Chunk count by material',
    '',
    '| COM-ID | Material ID | Type | Chunks |',
    '| --- | --- | --- | --- |',
    ...audit.chunk_count_by_material.map(row => `| ${row.material_com_id} | ${row.material_id} | ${row.material_type} | ${row.chunk_count} |`),
    '',
    '## Length distribution',
    '',
    `Count=${audit.length_distribution.count}; min=${audit.length_distribution.min}; p25=${audit.length_distribution.p25}; median=${audit.length_distribution.median}; p75=${audit.length_distribution.p75}; max=${audit.length_distribution.max}; mean=${audit.length_distribution.mean}`,
    '',
    '| Bucket | Count |',
    '| --- | --- |',
    ...Object.entries(audit.length_distribution.buckets).map(([bucket, count]) => `| ${bucket} | ${count} |`),
    '',
    '## Duplicate headings across materials',
    '',
    ...(audit.duplicated_headings_across_materials.length ? audit.duplicated_headings_across_materials.map(row => `- ${row.heading}: ${row.material_com_ids.join(', ')}`) : ['- none']),
    '',
    '## Exact duplicate chunk_hash groups',
    '',
    ...(audit.exact_duplicate_chunk_hash_groups.length ? audit.exact_duplicate_chunk_hash_groups.map(group => `- ${group.chunk_hash}: ${group.occurrence_count} occurrences across ${group.material_com_ids.join(', ')}`) : ['- none']),
    '',
    '## Chunk-quality rule',
    '',
    '- `STRUCTURAL_ONLY`: empty text or every non-empty line is a Markdown heading, empty bullet marker, or horizontal rule.',
    '- `SUBSTANTIVE_TEXT`: all other non-empty source text; this is a shape classification, not a semantic support judgment.',
    '- Standalone headings may remain as navigation/discovery chunks, but the Evidence-span Top-K gate excludes them.',
    '',
    '## Side effects',
    '',
    'Provider calls 0; Embedding calls 0; Fact/Mapping/Claim/Writer calls 0; Production DB writes 0; Gold mutations 0.'
  ];
  return linesOut.join('\n') + '\n';
}

async function run() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  const allChunks = sources.flatMap(source => source.chunks.map(chunk => ({ chunk, source })));
  const identityHash = sourceIdentityHash(sources);
  if (sources.length !== 9 || allChunks.length !== 94 || identityHash !== EXPECTED_IDENTITY_HASH || snapshot?.manifest?.snapshot_id !== SNAPSHOT_ID) {
    throw Object.assign(new Error('BLOCKED_EVIDENCE_CORPUS_QUALITY_AUDIT_IDENTITY_PARITY'), { details: { material_count: sources.length, chunk_count: allChunks.length, identity_hash: identityHash } });
  }

  const hashGroups = new Map();
  const headingGroups = new Map();
  for (const { chunk, source } of allChunks) {
    const key = text(chunk.chunk_hash);
    if (!hashGroups.has(key)) hashGroups.set(key, []);
    hashGroups.get(key).push(summarizeChunk(chunk, source));
    for (const entry of headingEntries(chunk.source_text)) {
      if (!headingGroups.has(entry.heading)) headingGroups.set(entry.heading, new Map());
      const materialMap = headingGroups.get(entry.heading);
      if (!materialMap.has(source.doc_id)) materialMap.set(source.doc_id, { doc_id: source.doc_id, material_id: source.material_id, raw_headings: [] });
      materialMap.get(source.doc_id).raw_headings.push(entry.raw);
    }
  }

  const exactDuplicateGroups = [...hashGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([chunkHash, rows]) => ({
      chunk_hash: chunkHash,
      occurrence_count: rows.length,
      duplicate_occurrence_count: rows.length - 1,
      material_com_ids: [...new Set(rows.map(row => row.material_com_id))].sort(),
      rows
    }))
    .sort((left, right) => left.chunk_hash.localeCompare(right.chunk_hash));
  const duplicateChunkCount = exactDuplicateGroups.reduce((sum, group) => sum + group.duplicate_occurrence_count, 0);
  const duplicatedHeadings = [...headingGroups.entries()]
    .filter(([, materials]) => materials.size > 1)
    .map(([heading, materials]) => ({ heading, material_com_ids: [...materials.keys()].sort(), materials: [...materials.values()] }))
    .sort((left, right) => left.heading.localeCompare(right.heading));

  const lengths = allChunks.map(({ chunk }) => text(chunk.source_text).length);
  const structural = allChunks.filter(({ chunk }) => isStructuralOnlyEvidenceText(chunk.source_text));
  const substantive = allChunks.filter(({ chunk }) => !isStructuralOnlyEvidenceText(chunk.source_text));
  const ultraShort = allChunks.filter(({ chunk }) => text(chunk.source_text).length <= ULTRA_SHORT_MAX);
  const metadataOnly = allChunks.filter(({ chunk }) => isOnlyMetadataUrlsHeadings(chunk.source_text));
  const mixed = allChunks.filter(({ chunk }) => isMixedEvidenceReference(chunk.source_text));
  const chunkCountByMaterial = sources.map(source => ({
    material_com_id: source.doc_id,
    material_id: source.material_id,
    material_type: source.material_type,
    source_role: source.source_role,
    chunk_count: source.chunks.length,
    structural_only_count: source.chunks.filter(chunk => isStructuralOnlyEvidenceText(chunk.source_text)).length,
    substantive_count: source.chunks.filter(chunk => !isStructuralOnlyEvidenceText(chunk.source_text)).length
  }));
  const audit = {
    status: 'EVIDENCE_CORPUS_QUALITY_AUDIT_V1',
    audit_version: 'evidence-corpus-quality-audit-v1',
    snapshot_id: SNAPSHOT_ID,
    snapshot_path: SNAPSHOT_PATH,
    enterprise_id: ENTERPRISE_ID,
    authority: 'SYNTHETIC_EVAL_ONLY',
    production_authority: 'NONE',
    source_role_scope: 'EVIDENCE_CANDIDATE',
    material_count: sources.length,
    chunk_count: allChunks.length,
    identity_hash: identityHash,
    chunk_count_by_material: chunkCountByMaterial,
    length_distribution: lengthStats(lengths),
    structural_only_count: structural.length,
    substantive_count: substantive.length,
    exact_duplicate_chunk_hash_groups: exactDuplicateGroups,
    duplicate_unique_hash_count: hashGroups.size,
    duplicate_chunk_count: duplicateChunkCount,
    duplicate_ratio: Number((duplicateChunkCount / allChunks.length).toFixed(6)),
    duplicated_headings_across_materials: duplicatedHeadings,
    ultra_short_threshold: ULTRA_SHORT_MAX,
    ultra_short_chunks: ultraShort.map(({ chunk, source }) => summarizeChunk(chunk, source)),
    metadata_url_heading_only_count: metadataOnly.length,
    metadata_url_heading_only_chunks: metadataOnly.map(({ chunk, source }) => summarizeChunk(chunk, source)),
    mixed_evidence_reference_style_count: mixed.length,
    mixed_evidence_reference_style_chunks: mixed.map(({ chunk, source }) => summarizeChunk(chunk, source)),
    rules: {
      structural_only: 'empty text or every non-empty line is a Markdown heading, empty bullet marker, or horizontal rule',
      ultra_short: `content_length <= ${ULTRA_SHORT_MAX}`,
      metadata_url_heading_only: 'every non-empty line is a heading, URL, recognized metadata key/value, or horizontal rule',
      mixed_evidence_reference_style: 'at least one reference-style line and at least one non-heading/non-metadata/non-reference line in the same chunk'
    },
    side_effects: { provider_calls: 0, embedding_calls: 0, fact_calls: 0, mapping_calls: 0, claim_calls: 0, writer_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0 }
  };
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(JSON_PATH, JSON.stringify({ ...audit, json_path: JSON_PATH, markdown_path: MD_PATH }, null, 2) + '\n', 'utf8');
  await writeFile(MD_PATH, buildMarkdown(audit), 'utf8');
  console.log(JSON.stringify({ ...audit, json_path: JSON_PATH, markdown_path: MD_PATH }, null, 2));
}

run().catch(error => {
  console.error(JSON.stringify({ status: 'BLOCKED', code: error.code || 'EVIDENCE_CORPUS_QUALITY_AUDIT_FAILED', details: error.details || null }));
  process.exitCode = 1;
});
