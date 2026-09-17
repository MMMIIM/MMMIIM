import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { prepareTender } from '../requirement-semantic-quality-v1/runner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const INPUT = path.join(DOCS, 'V43_REQUIREMENT_OUTPUT_SIDE_REVIEW.jsonl');
const CANONICAL = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const SOURCE_BLIND = path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl');
const SOURCE_MANIFEST = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_SOURCE_PACKET_MANIFEST.json');
const OUTPUT = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET_V2.jsonl');
const CHECKPOINT = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PACKET_V2_CHECKPOINT.json');
const CHECKPOINT_MD = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PACKET_V2_CHECKPOINT.md');

const TARGET_SOURCE_SHA = 'ca1581455882b441ee755d5af32c537c8ba454baf28847e7ef4408dcc7b88dea';
const TENDERS = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});
const TABLE_HEADER_TOKENS = [
  '序号', '编号', '名称', '项目', '类别', '类型', '参数', '指标', '规格', '型号',
  '数量', '单位', '响应时间', '解决时间', '故障', '级别', '服务内容', '要求', '条件'
];

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonl = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeJsonl = (file, rows) => fs.writeFileSync(file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
const relative = file => path.relative(REPO, file).replaceAll('\\', '/');

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[，。；：、“”‘’（）()、【】\[\]…·]/g, '');
}

function sourceSegments(raw, prepared) {
  const refByKey = new Map();
  for (const segment of prepared.segments || []) {
    const key = `${segment.page}|${normalizeForMatch(segment.text)}`;
    if (segment.source_ref && !refByKey.has(key)) refByKey.set(key, segment.source_ref);
  }
  return (raw.paragraphs || []).map((paragraph, index) => ({
    index,
    page: paragraph.page ?? null,
    paragraph: paragraph.paragraph ?? index + 1,
    text: String(paragraph.text || ''),
    source_ref: refByKey.get(`${paragraph.page}|${normalizeForMatch(paragraph.text)}`) || null
  }));
}

function findBySourceRefs(row, preparedSegments) {
  const startRef = row.source_span?.start_ref;
  const endRef = row.source_span?.end_ref || startRef;
  if (!startRef) return null;
  const start = preparedSegments.findIndex(segment => segment.source_ref === startRef);
  const end = preparedSegments.findIndex(segment => segment.source_ref === endRef);
  if (start < 0) return null;
  return { start, end: end >= start ? end : start, method: 'SOURCE_REF' };
}

function findByParagraph(row, segments) {
  const startParagraph = Number(row.source_span?.paragraph_start);
  const endParagraph = Number(row.source_span?.paragraph_end);
  if (!Number.isInteger(startParagraph) || !Number.isInteger(endParagraph)) return null;
  const start = segments.findIndex(segment => segment.paragraph === startParagraph);
  const end = segments.findIndex(segment => segment.paragraph === endParagraph);
  if (start < 0) return null;
  return { start, end: end >= start ? end : start, method: 'PARAGRAPH_RANGE' };
}

function findByExcerpt(row, segments) {
  const rawExcerpt = String(row.source_excerpt || '').trim();
  const lines = rawExcerpt.split(/\r?\n/).map(line => line.trim()).filter(line => normalizeForMatch(line).length >= 12);
  const anchors = [...new Set(lines.sort((a, b) => b.length - a.length).slice(0, 8))];
  for (const anchor of anchors) {
    const needle = normalizeForMatch(anchor);
    const index = segments.findIndex(segment => normalizeForMatch(segment.text).includes(needle));
    if (index >= 0) {
      const lineCount = Math.max(1, Math.min(12, lines.length));
      const samePageEnd = Math.min(segments.length - 1, index + lineCount - 1);
      const end = segments.slice(index, samePageEnd + 1).findLastIndex(segment => segment.page === segments[index].page) + index;
      return { start: index, end: end >= index ? end : index, method: 'EXCERPT_ANCHOR' };
    }
  }
  return null;
}

function contextSegment(segment) {
  return {
    page: segment.page,
    paragraph: segment.paragraph,
    source_ref: segment.source_ref,
    source_text: segment.text
  };
}

function buildContext(segments, range, direction) {
  if (!range) {
    return {
      status: 'NOT_DETERMINABLE_FROM_FROZEN_SOURCE_ASSETS',
      source_segments: [],
      derivation: 'DETERMINISTIC_PDF_EXTRACTION_ONLY'
    };
  }
  const index = direction === 'previous' ? range.start - 1 : range.end + 1;
  const item = segments[index];
  if (!item) {
    return {
      status: 'BOUNDARY_NO_ADJACENT_SEGMENT',
      source_segments: [],
      derivation: 'DETERMINISTIC_PDF_EXTRACTION_ONLY'
    };
  }
  return {
    status: 'RECOVERED',
    source_segments: [contextSegment(item)],
    derivation: 'DETERMINISTIC_PDF_EXTRACTION_ONLY'
  };
}

function looksLikeTableHeader(text) {
  const value = String(text || '');
  const tokenHits = TABLE_HEADER_TOKENS.filter(token => value.includes(token)).length;
  return tokenHits >= 2 || (tokenHits >= 1 && (value.includes('\t') || value.length <= 60));
}

function buildTableContext(segments, range) {
  if (!range) {
    return {
      status: 'NOT_DETERMINABLE_FROM_FROZEN_SOURCE_ASSETS',
      table_header_segments: [],
      row_segments: [],
      column_semantic_segments: [],
      derivation: 'DETERMINISTIC_NEIGHBOR_CAPTURE_ONLY'
    };
  }
  const rowSegments = segments.slice(range.start, range.end + 1);
  const before = segments.slice(Math.max(0, range.start - 8), range.start);
  const headerSegments = before.filter(segment => looksLikeTableHeader(segment.text)).slice(-3);
  return {
    status: headerSegments.length ? 'RECOVERED' : 'HEADER_NOT_DETERMINABLE_FROM_SOURCE',
    table_header_segments: headerSegments.map(contextSegment),
    row_segments: rowSegments.map(contextSegment),
    column_semantic_segments: headerSegments.map(contextSegment),
    derivation: 'DETERMINISTIC_NEIGHBOR_CAPTURE_ONLY'
  };
}

async function prepareSources() {
  const prepared = {};
  for (const [tenderId, relativeSource] of Object.entries(TENDERS)) {
    const sourceFile = path.join(REPO, relativeSource);
    const buffer = fs.readFileSync(sourceFile);
    const extraction = await extractTenderText({ fileName: sourceFile, mimeType: 'application/pdf', buffer });
    const routed = await prepareTender(tenderId, {});
    prepared[tenderId] = {
      source_file: relativeSource,
      source_sha256: sha256(buffer),
      segments: sourceSegments(extraction, routed),
      prepared_segments: routed.segments || [],
      parser_status: extraction.text ? 'PASS' : 'FAIL'
    };
  }
  return prepared;
}

function buildPacketRow(row, canonicalRow, index, source) {
  const refRange = findBySourceRefs(row, source.prepared_segments);
  const paragraphRange = findByParagraph(row, source.segments);
  const excerptRange = findByExcerpt(row, source.segments);
  const resolved = paragraphRange || excerptRange || refRange;
  const sourceRange = resolved && (paragraphRange || excerptRange) ? resolved : null;
  const tableDependency = Array.isArray(row.features?.RISK_FLAGS) && row.features.RISK_FLAGS.includes('TABLE_HEADER_DEPENDENCY');
  const rowContext = buildContext(source.segments, sourceRange, 'previous');
  const nextContext = buildContext(source.segments, sourceRange, 'next');
  const tableContext = tableDependency
    ? buildTableContext(source.segments, sourceRange)
    : null;
  return {
    case_id: `OUTPUT-SIDE-${String(index + 1).padStart(3, '0')}`,
    run_id: row.run_id,
    tender_id: row.tender_id,
    canonical_requirement_id: row.canonical_requirement_id,
    canonical_requirement_text: row.requirement_text,
    exact_source_excerpt: row.source_excerpt,
    previous_context: rowContext,
    next_context: nextContext,
    table_header_context: tableContext,
    row_column_semantic_context: tableContext
      ? {
          status: tableContext.status,
          row_segments: tableContext.row_segments,
          column_semantic_segments: tableContext.column_semantic_segments,
          derivation: tableContext.derivation
        }
      : null,
    context_availability: resolved ? (tableDependency && tableContext.status !== 'RECOVERED' ? 'PARTIAL_TABLE_HEADER_CONTEXT' : 'RECOVERED') : 'NOT_DETERMINABLE_FROM_FROZEN_SOURCE_ASSETS',
    context_resolution: {
      method: resolved?.method || 'NONE',
      source_file: source.source_file,
      source_sha256: source.source_sha256,
      parser_status: source.parser_status,
      source_ref_range_available: Boolean(refRange),
      paragraph_range_available: Boolean(paragraphRange),
      excerpt_anchor_available: Boolean(excerptRange)
    },
    category: row.features?.CATEGORY ?? canonicalRow?.category ?? null,
    mandatory_observed: row.features?.MANDATORY_OBSERVED ?? canonicalRow?.mandatory_observed ?? null,
    requires_confirmation: row.features?.REQUIRES_CONFIRMATION ?? canonicalRow?.requires_confirmation ?? null,
    risk_flags: Array.isArray(row.features?.RISK_FLAGS) ? [...row.features.RISK_FLAGS] : [],
    source_refs: Array.isArray(canonicalRow?.source_refs) ? [...canonicalRow.source_refs] : [],
    source_span: row.source_span ?? canonicalRow?.source_span ?? null,
    source_hash: row.source_hash ?? canonicalRow?.source_hash ?? null,
    label_status: 'PENDING_INDEPENDENT_ADJUDICATION',
    gold_label_exposed: false,
    producer_label_exposed: false
  };
}

export async function buildArtifacts() {
  const inputRows = readJsonl(INPUT);
  const canonicalRows = readJson(CANONICAL).requirements || [];
  const canonicalByKey = new Map(canonicalRows.map(row => [`${row.tender_id}|${row.canonical_requirement_id}`, row]));
  const sources = await prepareSources();
  const rows = inputRows.map((row, index) => buildPacketRow(
    row,
    canonicalByKey.get(`${row.tender_id}|${row.canonical_requirement_id}`),
    index,
    sources[row.tender_id]
  ));
  const sourceBytes = fs.readFileSync(SOURCE_BLIND);
  const sourceHash = sha256(sourceBytes);
  const manifest = readJson(SOURCE_MANIFEST);
  if (sourceHash !== TARGET_SOURCE_SHA || manifest.source_packet_sha256 !== TARGET_SOURCE_SHA) {
    throw new Error(`SOURCE_SIDE_SHA_MISMATCH:${sourceHash}:${manifest.source_packet_sha256}`);
  }
  if (rows.length !== 239) throw new Error(`OUTPUT_SIDE_COUNT_MISMATCH:${rows.length}`);
  const tableRows = rows.filter(row => row.risk_flags.includes('TABLE_HEADER_DEPENDENCY'));
  const recoveredContextCount = rows.filter(row => row.context_availability === 'RECOVERED').length;
  const resolvedContextCount = rows.filter(row => row.context_resolution.method !== 'NONE').length;
  const tableHeaderRecoveredCount = tableRows.filter(row => row.table_header_context?.status === 'RECOVERED').length;
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_SEMANTIC_PACKET_COMPLETENESS_RECOVERY_CHECKPOINT',
    packet: relative(OUTPUT),
    output_side_case_count: rows.length,
    source_side_packet: relative(SOURCE_BLIND),
    source_side_case_count: sourceBytes.toString('utf8').split(/\r?\n/).filter(Boolean).length,
    source_side_sha256: sourceHash,
    source_manifest_sha256: manifest.source_packet_sha256,
    source_side_canonical_visibility: 'HIDDEN_FIRST_PASS',
    context_resolved_count: resolvedContextCount,
    context_recovered_count: recoveredContextCount,
    table_header_dependency_count: tableRows.length,
    table_header_context_recovered_count: tableHeaderRecoveredCount,
    table_header_context_not_determinable_count: tableRows.length - tableHeaderRecoveredCount,
    zero_candidate_authoritative_list: ['FIXED48-26', 'FIXED48-28', 'FIXED48-41'],
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_semantic_changes: 0,
    answer_fields_modified: false,
    forbidden_labels_included: false,
    status: 'READY_FOR_INDEPENDENT_ADJUDICATION'
  };
  return { rows, checkpoint };
}

export async function writeArtifacts({ overwrite = false } = {}) {
  if (fs.existsSync(OUTPUT) && !overwrite) throw new Error(`REFUSE_OVERWRITE_EXISTING_EVAL_ARTIFACT:${relative(OUTPUT)}`);
  const { rows, checkpoint } = await buildArtifacts();
  writeJsonl(OUTPUT, rows);
  writeJson(CHECKPOINT, checkpoint);
  const markdown = [
    '# V43_REQUIREMENT_SEMANTIC_PACKET_COMPLETENESS_RECOVERY_CHECKPOINT',
    '',
    `- OUTPUT_SIDE_CASES: ${checkpoint.output_side_case_count}`,
    `- CONTEXT_RESOLVED: ${checkpoint.context_resolved_count}/${checkpoint.output_side_case_count}`,
    `- CONTEXT_RECOVERED_FULL: ${checkpoint.context_recovered_count}/${checkpoint.output_side_case_count}`,
    `- TABLE_HEADER_DEPENDENCY: ${checkpoint.table_header_context_recovered_count}/${checkpoint.table_header_dependency_count} deterministically recovered`,
    `- SOURCE_SIDE_SHA256: ${checkpoint.source_side_sha256}`,
    `- SOURCE_SIDE_CANONICAL_VISIBILITY: ${checkpoint.source_side_canonical_visibility}`,
    `- ZERO_CANDIDATE_AUTHORITATIVE_LIST: ${checkpoint.zero_candidate_authoritative_list.join(', ')}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- ANSWER_FIELDS_MODIFIED: ${checkpoint.answer_fields_modified}`,
    '',
    'This Eval-only packet adds deterministic source context and does not expose semantic answers or promote Gold.'
  ].join('\n');
  fs.writeFileSync(CHECKPOINT_MD, `${markdown}\n`, 'utf8');
  return { output: OUTPUT, checkpoint: CHECKPOINT, checkpointMd: CHECKPOINT_MD, ...checkpoint };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeArtifacts().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => {
    process.stderr.write(`${JSON.stringify({ error_code: error.code || 'PACKET_V2_BUILD_FAILED', message: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
