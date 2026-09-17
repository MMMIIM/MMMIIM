import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptHtmlToSourceText } from './reference-eval-html-adapter.js';

// Eval-only diagnostic.  It consumes the frozen source-unit/chunk-plan
// artifacts and never changes the production parser, chunker, or source.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPAIR_HANDOFF = resolve(ROOT, 'docs/handoff/V43_REFERENCE_SOURCE_UNIT_REPAIR_V1');
const OUT = resolve(ROOT, 'docs/handoff/V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1');
const TARGETS = Object.freeze(['H3C-003', 'H3C-004', 'H3C-010', 'H3C-013']);
const BUCKETS = Object.freeze([
  { id: 'UNDER_30', label: '<30', test: length => length < 30, limit: 10 },
  { id: 'FROM_30_TO_99', label: '30-99', test: length => length >= 30 && length < 100, limit: 10 },
  { id: 'AT_LEAST_100', label: '>=100', test: length => length >= 100, limit: 5 }
]);
const TAG_TOKEN_RE = /<!--[\s\S]*?-->|<\s*\/?\s*[A-Za-z][^>]*>/g;
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const STRUCTURAL_PARENT_TAGS = new Set(['html', 'body', 'main', 'article', 'section', 'header', 'footer', 'aside', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'ul', 'ol', 'dl', 'div']);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const rel = value => relative(ROOT, value).replaceAll('\\', '/');
const excerpt = (value, max = 300) => String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);

function duplicateReport(rows) {
  const groups = new Map();
  for (const row of rows) groups.set(row.chunk_hash, [...(groups.get(row.chunk_hash) || []), row]);
  const duplicateGroups = [...groups.values()].filter(group => group.length > 1);
  const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
  const crossSourceGroups = duplicateGroups.filter(group => new Set(group.map(row => row.source_id)).size > 1);
  const crossSourceCount = crossSourceGroups.reduce((sum, group) => sum + group.length - 1, 0);
  return {
    exact_duplicate_rate: rows.length ? Number((duplicateCount / rows.length).toFixed(6)) : 0,
    cross_source_duplicate_rate: rows.length ? Number((crossSourceCount / rows.length).toFixed(6)) : 0
  };
}

function normalizePlainText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .replace(/[\t ]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function normalizeForMatch(value) {
  return normalizePlainText(value).replace(/\s+/gu, ' ').trim();
}

function parseAttributes(openTag) {
  const attrs = {};
  const body = openTag.replace(/^<\s*[A-Za-z][\w:-]*/u, '').replace(/>\s*$/u, '');
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  for (const match of body.matchAll(re)) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return attrs;
}

function parseTag(token) {
  if (token.startsWith('<!--')) return { comment: true };
  const closing = /^<\s*\//u.test(token);
  const name = token.match(/^<\s*\/?\s*([A-Za-z][\w:-]*)/u)?.[1]?.toLowerCase();
  if (!name) return { comment: true };
  return {
    closing,
    name,
    attrs: closing ? {} : parseAttributes(token),
    selfClosing: /\/\s*>\s*$/u.test(token) || VOID_TAGS.has(name)
  };
}

function classSet(attrs) {
  return new Set(String(attrs?.class || '').split(/\s+/u).map(value => value.trim()).filter(Boolean));
}

function makeElementRecords(html) {
  const records = [];
  const stack = [];
  for (const match of html.matchAll(TAG_TOKEN_RE)) {
    const token = match[0];
    const parsed = parseTag(token);
    if (parsed.comment) continue;
    const start = match.index;
    const end = start + token.length;
    if (parsed.closing) {
      let stackIndex = stack.length - 1;
      while (stackIndex >= 0 && records[stack[stackIndex]].name !== parsed.name) stackIndex -= 1;
      if (stackIndex < 0) continue;
      const recordIndex = stack[stackIndex];
      records[recordIndex].end = end;
      stack.splice(stackIndex, 1);
      continue;
    }
    const parent = stack.length ? stack[stack.length - 1] : null;
    const record = { name: parsed.name, attrs: parsed.attrs, start, open_end: end, end: parsed.selfClosing ? end : null, parent };
    const recordIndex = records.push(record) - 1;
    if (!parsed.selfClosing) stack.push(recordIndex);
  }
  return records;
}

function recordLabel(record) {
  if (!record) return null;
  const attrs = record.attrs || {};
  const id = attrs.id ? `#${attrs.id}` : '';
  const classes = [...classSet(attrs)].sort();
  return `${record.name}${id}${classes.length ? `.${classes.join('.')}` : ''}`;
}

function visibleRecordText(html, record) {
  if (!record || record.end == null) return '';
  try {
    return normalizePlainText(adaptHtmlToSourceText(html.slice(record.start, record.end)));
  } catch {
    return '';
  }
}

function isCandidateRecord(record) {
  if (!record || record.end == null) return false;
  const classes = classSet(record.attrs);
  if (/^h[1-6]$/u.test(record.name) || ['p', 'li', 'td', 'th'].includes(record.name)) return true;
  if (['a', 'button'].includes(record.name) && [...classes].some(value => /^(?:ns-btn|ns-red-next-arrow)$/u.test(value))) return true;
  if (['div', 'span'].includes(record.name)) {
    return [...classes].some(value => /^(?:p1-title|p1-t\d+|ic-txt|ns-master-banner-content|ns-btn-wrap|ns-red-next-arrow)$/u.test(value));
  }
  return false;
}

function classifyRecord(record, recordText = '') {
  if (!record) return 'MECHANICAL_FRAGMENT';
  const classes = classSet(record.attrs);
  if ([...classes].some(value => /^(?:ns-btn|ns-btn-wrap|ns-red-next-arrow)$/u.test(value)) || ['a', 'button'].includes(record.name)) return 'MECHANICAL_FRAGMENT';
  if (/^h[1-6]$/u.test(record.name)) return 'HEADING';
  if (record.name === 'li') return 'LIST_ITEM';
  if (record.name === 'td' || record.name === 'th') return 'TABLE_CELL';
  if (record.name === 'p') {
    if ([...classes].some(value => /^(?:TOC|MsoToc\d*|p1-title(?:-c\d*)?)$/u.test(value))) return 'HEADING';
    if (/^[●•·▪◦]$/u.test(normalizeForMatch(recordText))) return 'LIST_ITEM';
    return 'PARAGRAPH';
  }
  if ([...classes].some(value => /^p1-title(?:-c\d*)?$/u.test(value))) return 'HEADING';
  if ([...classes].some(value => /^(?:p1-t\d+|ic-txt|ns-master-banner-content)$/u.test(value))) return 'PARAGRAPH';
  return 'UNKNOWN';
}

function nearestStructuralParent(record, records) {
  let parentIndex = record?.parent ?? null;
  while (parentIndex != null) {
    const parent = records[parentIndex];
    if (parent && STRUCTURAL_PARENT_TAGS.has(parent.name)) return recordLabel(parent);
    parentIndex = parent?.parent ?? null;
  }
  return null;
}

function mapChunkToDom(chunkText, html, records) {
  const needle = normalizeForMatch(chunkText);
  if (!needle) return { record: null, method: 'NO_NONWHITESPACE_TEXT' };
  const candidates = records
    .filter(isCandidateRecord)
    .map(record => ({ record, text: normalizeForMatch(visibleRecordText(html, record)) }))
    .filter(item => item.text && (item.text === needle || item.text.includes(needle)));
  if (!candidates.length) return { record: null, method: 'NO_STRUCTURAL_RECORD_MATCH', mechanical_fragment_reason: 'NO_STRUCTURAL_RECORD_MATCH' };
  candidates.sort((a, b) => {
    const exactDelta = Number(b.text === needle) - Number(a.text === needle);
    if (exactDelta) return exactDelta;
    const lengthDelta = a.text.length - b.text.length;
    if (lengthDelta) return lengthDelta;
    return a.record.start - b.record.start;
  });
  const record = candidates[0].record;
  const classes = classSet(record.attrs);
  const mechanical = [...classes].some(value => /^(?:ns-btn|ns-btn-wrap|ns-red-next-arrow)$/u.test(value)) || ['a', 'button'].includes(record.name);
  return {
    record,
    method: candidates[0].text === needle ? 'STRUCTURAL_TEXT_EXACT' : 'STRUCTURAL_TEXT_CONTAINS',
    mechanical_fragment_reason: mechanical ? 'PAGE_CHROME' : null
  };
}

function causeFromRows(rows, sourceStats) {
  const counts = Object.fromEntries(['HEADING', 'PARAGRAPH', 'LIST_ITEM', 'TABLE_CELL', 'MECHANICAL_FRAGMENT', 'UNKNOWN'].map(key => [key, 0]));
  for (const row of rows) counts[row.classification] = (counts[row.classification] || 0) + 1;
  const structural = counts.HEADING + counts.PARAGRAPH + counts.LIST_ITEM + counts.TABLE_CELL;
  const chrome = rows.filter(row => row.classification === 'MECHANICAL_FRAGMENT' && row.mechanical_fragment_reason === 'PAGE_CHROME').length;
  const unmapped = counts.MECHANICAL_FRAGMENT - chrome;
  const mechanicalCauses = [];
  if (counts.HEADING + counts.PARAGRAPH > 0) mechanicalCauses.push('A_LEGITIMATE_SHORT_SEMANTIC_UNITS');
  if (counts.TABLE_CELL + counts.LIST_ITEM > 0) mechanicalCauses.push('C_TABLE_LIST_STRUCTURAL_LOSS');
  if (unmapped > 0) mechanicalCauses.push('B_HTML_DOM_SERIALIZATION_FRAGMENTATION');
  if (chrome > 0) mechanicalCauses.push('D_RESIDUAL_PAGE_CHROME');
  const uniqueCauses = mechanicalCauses.filter((key, index, all) => all.indexOf(key) === index);
  const primary_cause = uniqueCauses.length === 1 ? uniqueCauses[0] : (uniqueCauses.length > 1 ? 'E_MIXED_CAUSES' : 'UNKNOWN');
  const classes = Object.entries(counts).filter(([, count]) => count > 0).map(([key]) => key);
  const cause_set = primary_cause === 'E_MIXED_CAUSES'
    ? classes.filter((key, index, all) => key !== 'UNKNOWN' && all.indexOf(key) === index).flatMap(key => key === 'MECHANICAL_FRAGMENT'
      ? (chrome ? ['D_RESIDUAL_PAGE_CHROME'] : ['B_HTML_DOM_SERIALIZATION_FRAGMENTATION'])
      : (['LIST_ITEM', 'TABLE_CELL'].includes(key) ? ['C_TABLE_LIST_STRUCTURAL_LOSS'] : ['A_LEGITIMATE_SHORT_SEMANTIC_UNITS']))
      .filter((key, index, all) => all.indexOf(key) === index)
    : uniqueCauses.length ? uniqueCauses : [primary_cause];
  return { primary_cause, contributing_causes: cause_set, sampled_classification_counts: counts, page_chrome_sample_count: chrome, unmapped_fragment_sample_count: unmapped, explanation_basis: 'Mechanical DOM record match and chunk length statistics only; no semantic relevance or requirement signal used.' };
}

function repairOption(sourceStats, alternatives) {
  if (alternatives.length) return 'REPLACE_WITH_CLEAN_SOURCE';
  if (sourceStats.under_100_char_share >= 0.8 || sourceStats.median_chunk_length < 100) return 'STRUCTURAL_TEXT_RECONSTRUCTION';
  return 'KEEP_AS_IS';
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function walkFiles(root, output = []) {
  let entries = [];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const file = join(root, entry.name);
    if (entry.isDirectory()) await walkFiles(file, output);
    else output.push(file);
  }
  return output;
}

async function findAlternativeSources(sourceId, sourceFile) {
  const sourceBase = basename(sourceFile, extname(sourceFile)).replace(/^H3C-\d+[_-]?/u, '').toLowerCase();
  const files = await walkFiles(resolve(ROOT, 'data'));
  return files
    .filter(file => file !== sourceFile && /\.(pdf|docx|md|txt)$/iu.test(file))
    .filter(file => {
      const name = basename(file).toLowerCase();
      return name.includes(sourceId.toLowerCase()) || (sourceBase.length >= 8 && name.includes(sourceBase.slice(0, 24)));
    })
    .map(file => ({ path: rel(file), file_name: basename(file), extension: extname(file).slice(1).toLowerCase() }));
}

async function build() {
  const unit = await readJson(resolve(REPAIR_HANDOFF, '01_SOURCE_UNIT_RESOLUTION.json'));
  const plan = await readJson(resolve(REPAIR_HANDOFF, '03_CANONICAL_CHUNK_PLAN.json'));
  const preflight = await readJson(resolve(REPAIR_HANDOFF, '06_POST_REPAIR_CHUNK_MASS_PREFLIGHT.json'));
  const unitById = new Map(unit.rows.filter(row => TARGETS.includes(row.source_id)).map(row => [row.source_id, row]));
  const preflightById = new Map(preflight.per_source.filter(row => TARGETS.includes(row.source_id)).map(row => [row.source_id, row]));
  const sampled = [];
  const sourceReports = [];
  for (const sourceId of TARGETS) {
    const unitRow = unitById.get(sourceId);
    const stats = preflightById.get(sourceId);
    if (!unitRow || !stats) throw new Error(`Missing frozen source-unit evidence for ${sourceId}`);
    const htmlPath = resolve(ROOT, 'docs/handoff/V43_REFERENCE_SOURCE_UNIT_REPAIR_V1/canonical-sources', `${sourceId}.html`);
    const textPath = resolve(ROOT, 'docs/handoff/V43_REFERENCE_SOURCE_UNIT_REPAIR_V1/canonical-sources', `${sourceId}.txt`);
    const html = await readFile(htmlPath, 'utf8');
    const sourceText = normalizePlainText(await readFile(textPath, 'utf8'));
    const records = makeElementRecords(html);
    const chunks = plan.rows.filter(row => row.source_id === sourceId).sort((a, b) => a.chunk_index - b.chunk_index).map(row => ({
      ...row,
      chunk_text: sourceText.slice(row.char_start, row.char_end)
    }));
    if (sha256(sourceText) !== stats.normalized_text_sha256) throw new Error(`Frozen normalized source SHA mismatch for ${sourceId}`);
    for (const chunk of chunks) {
      if (sha256(chunk.chunk_text) !== chunk.chunk_hash) throw new Error(`Frozen chunk text/hash mismatch for ${sourceId}:${chunk.chunk_index}`);
    }
    const selected = [];
    for (const bucket of BUCKETS) {
      const rows = chunks.filter(row => bucket.test(row.source_text_length)).slice(0, bucket.limit);
      for (const chunk of rows) {
        const mapped = mapChunkToDom(chunk.chunk_text, html, records);
        const record = mapped.record;
        const previous = chunks.find(row => row.chunk_index === chunk.chunk_index - 1);
        const next = chunks.find(row => row.chunk_index === chunk.chunk_index + 1);
        const item = {
          source_id: sourceId,
          chunk_index: chunk.chunk_index,
          bucket: bucket.id,
          chunk_hash: chunk.chunk_hash,
          chunker_version: chunk.chunker_version,
          char_start: chunk.char_start,
          char_end: chunk.char_end,
          source_text_length: chunk.source_text_length,
          chunk_text: chunk.chunk_text,
          previous_chunk_text: previous?.chunk_text || null,
          next_chunk_text: next?.chunk_text || null,
          source_dom_tag: record?.name || null,
          source_dom_id: record?.attrs?.id || null,
          source_dom_classes: record ? [...classSet(record.attrs)].sort() : [],
          nearest_structural_parent: nearestStructuralParent(record, records),
          classification: classifyRecord(record, record ? visibleRecordText(html, record) : ''),
          dom_match_method: mapped.method,
          mechanical_fragment_reason: mapped.mechanical_fragment_reason || null,
          dom_source_text_excerpt: record ? excerpt(visibleRecordText(html, record)) : null
        };
        selected.push(item);
        sampled.push(item);
      }
    }
    const alternatives = await findAlternativeSources(sourceId, resolve(ROOT, unitRow.source_file));
    const cause = causeFromRows(selected, stats);
    sourceReports.push({
      source_id: sourceId,
      source_file: unitRow.source_file,
      source_sha256: unitRow.source_sha256,
      canonical_source_unit: unitRow.canonical_source_unit,
      selector: unitRow.selector,
      parsed_substantive_chars: stats.parsed_substantive_chars,
      planned_chunks: stats.planned_chunks,
      median_chunk_length: stats.median_chunk_length,
      p95_chunk_length: stats.p95_chunk_length,
      under_100_char_share: stats.under_100_char_share,
      exact_duplicate_rate: duplicateReport(chunks.map(chunk => ({ source_id: sourceId, chunk_hash: chunk.chunk_hash }))).exact_duplicate_rate,
      cross_source_duplicate_rate_reference_corpus: preflight.cross_source_duplicate_rate,
      html_fragment_share: stats.planned_chunks ? Number((chunks.filter(chunk => chunk.source_text_length < 100).length / stats.planned_chunks).toFixed(6)) : 0,
      input_unit_parity: preflight.input_unit_parity,
      sample_counts: Object.fromEntries(BUCKETS.map(bucket => [bucket.id, selected.filter(row => row.bucket === bucket.id).length])),
      sample_classification_counts: cause.sampled_classification_counts,
      cause_analysis: cause,
      structural_text_reconstruction_before_unchanged_chunker: {
        mechanically_plausible: cause.primary_cause !== 'D_RESIDUAL_PAGE_CHROME',
        expected_effect: cause.primary_cause === 'B_HTML_DOM_SERIALIZATION_FRAGMENTATION' || cause.primary_cause === 'C_TABLE_LIST_STRUCTURAL_LOSS' ? 'COULD_REDUCE_FRAGMENTATION_IF_BLOCKS_ARE_GROUPED_BY_EXISTING_DOM_STRUCTURE' : 'WOULD_NOT_BY_ITSELF_MERGE_ALL_LEGITIMATE_SHORT_UNITS',
        semantic_decision_used: false
      },
      alternative_source_audit: {
        clean_local_pdf_docx_article_body_found: alternatives.length > 0,
        candidates: alternatives,
        search_scope: 'Local data/ tree; filename/source-id mechanical match only.'
      },
      minimal_repair_option: repairOption(stats, alternatives)
    });
  }
  const allSamplesBySource = Object.fromEntries(TARGETS.map(id => [id, sampled.filter(row => row.source_id === id)]));
  const manifest = {
    artifact_type: 'V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1_EXECUTION_MANIFEST',
    diagnostic_only: true,
    source_unit_artifact: rel(resolve(REPAIR_HANDOFF, '01_SOURCE_UNIT_RESOLUTION.json')),
    chunk_plan_artifact: rel(resolve(REPAIR_HANDOFF, '03_CANONICAL_CHUNK_PLAN.json')),
    preflight_artifact: rel(resolve(REPAIR_HANDOFF, '06_POST_REPAIR_CHUNK_MASS_PREFLIGHT.json')),
    target_sources: TARGETS,
    sampling: BUCKETS.map(bucket => ({ bucket: bucket.id, label: bucket.label, deterministic_order: 'ascending chunk_index', limit: bucket.limit })),
    side_effects: { provider_calls: 0, embedding_calls: 0, db_writes: 0, production_db_writes: 0, source_mutations: 0, chunker_mutations: 0, semantic_labels_created: 0 },
    next_gate: 'GPT_REVIEW_BEFORE_HOST_EMBEDDING'
  };
  const alternatives = sourceReports.flatMap(row => row.alternative_source_audit.candidates);
  const causes = Object.fromEntries(sourceReports.map(row => [row.source_id, row.cause_analysis]));
  const checkpoint = {
    artifact_type: 'V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1_CHECKPOINT',
    status: 'BLOCKED_REFERENCE_HTML_TEXT_GRANULARITY_NOT_RETRIEVAL_READY',
    review_status: 'READY_FOR_GPT_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_REVIEW',
    target_source_count: TARGETS.length,
    sample_row_count: sampled.length,
    existing_corpus_snapshot: {
      total_planned_chunks: preflight.total_planned_chunks,
      html_planned_chunks: preflight.per_source.filter(row => row.format === 'HTML').reduce((sum, row) => sum + row.planned_chunks, 0),
      html_fragment_share: preflight.html_fragment_share,
      exact_duplicate_rate: preflight.exact_duplicate_rate,
      cross_source_duplicate_rate: preflight.cross_source_duplicate_rate,
      input_unit_parity: preflight.input_unit_parity
    },
    sample_counts_by_source: Object.fromEntries(sourceReports.map(row => [row.source_id, row.sample_counts])),
    questions: {
      short_chunk_primary_cause: 'PER_SOURCE_MECHANICAL_ANALYSIS_IN_02_CAUSE_ANALYSIS',
      deterministic_structural_reconstruction: 'SOURCE_LEVEL_MECHANICAL_PLAUSIBILITY_ONLY; NO PRODUCTION CHANGE',
      clean_alternative_sources: alternatives.length > 0 ? 'FOUND_LOCAL_FILENAME_MATCHES' : 'NONE_FOUND_IN_LOCAL_DATA_TREE',
      minimal_repair_option: 'SOURCE_LEVEL_RECOMMENDATIONS_IN_02_CAUSE_ANALYSIS'
    },
    per_source: sourceReports,
    side_effects: manifest.side_effects,
    forbidden_actions_observed: ['no production chunker modification', 'no embedding/provider', 'no database writes', 'no semantic requirement filtering', 'no commit/push/merge/deploy']
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, '00_EXECUTION_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(resolve(OUT, '01_SAMPLED_CHUNKS.json'), JSON.stringify({ artifact_type: 'V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1_SAMPLES', rows: sampled, by_source: allSamplesBySource }, null, 2) + '\n', 'utf8');
  await writeFile(resolve(OUT, '02_CAUSE_ANALYSIS.json'), JSON.stringify({ artifact_type: 'V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1_CAUSE_ANALYSIS', analysis_basis: 'deterministic DOM/tag/parent mapping and existing chunk statistics', per_source: causes }, null, 2) + '\n', 'utf8');
  await writeFile(resolve(OUT, '03_ALTERNATIVE_SOURCE_AUDIT.json'), JSON.stringify({ artifact_type: 'V43_REFERENCE_HTML_TEXT_SHAPE_DIAGNOSTIC_V1_ALTERNATIVE_SOURCE_AUDIT', per_source: Object.fromEntries(sourceReports.map(row => [row.source_id, row.alternative_source_audit])), total_candidates: alternatives.length }, null, 2) + '\n', 'utf8');
  await writeFile(resolve(OUT, '04_CHECKPOINT.json'), JSON.stringify(checkpoint, null, 2) + '\n', 'utf8');
  const lines = [
    '# V43 Reference HTML Text Shape Diagnostic V1',
    '',
    `Status: ${checkpoint.status}`,
    `Sample rows: ${sampled.length}`,
    '',
    '| source | <30 | 30-99 | >=100 | median | <100 share | exact dup | corpus cross-source dup | input parity | primary cause | repair option |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|',
    ...sourceReports.map(row => `| ${row.source_id} | ${row.sample_counts.UNDER_30} | ${row.sample_counts.FROM_30_TO_99} | ${row.sample_counts.AT_LEAST_100} | ${row.median_chunk_length} | ${row.under_100_char_share} | ${row.exact_duplicate_rate} | ${row.cross_source_duplicate_rate_reference_corpus} | ${row.input_unit_parity.input_unit_parity} | ${row.cause_analysis.primary_cause} | ${row.minimal_repair_option} |`),
    '',
    'No embedding/provider/database or production changes were performed.',
    'This is a diagnostic artifact; no retrieval/product-fidelity claim is made.'
  ];
  await writeFile(resolve(OUT, '04_CHECKPOINT.md'), lines.join('\n') + '\n', 'utf8');
  return checkpoint;
}

export { build as runDiagnostic };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkpoint = await build();
  console.log(JSON.stringify({ status: checkpoint.status, output: rel(OUT), sample_row_count: checkpoint.sample_row_count, target_sources: TARGETS }, null, 2));
}
