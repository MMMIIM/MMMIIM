import { buildCanonicalRequirements } from './canonical-requirements.js';

const DEFAULT_SINGLE_CALL_THRESHOLD = 2_000;
const DEFAULT_CHARACTER_BUDGET = 2_000;
const DEFAULT_TOKEN_BUDGET = 8_000;
const DEFAULT_SOURCE_SPAN_BUDGET = 100;
const MAX_BOUNDARY_LOOKBACK = 64;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const CHILD_ENUMERATION_PATTERN = /^(?:[（(]\s*[一二三四五六七八九十百千万\d]+\s*[)）]|[一二三四五六七八九十百千万]+[、.．]|\d+[、.)．])/;
const INDEPENDENT_CLAUSE_PATTERN = /^(?:#{1,6}\s+|第[一二三四五六七八九十百千万\d]+[章节部分]|\d+(?:\.\d+){0,3}[、.．\s]|[一二三四五六七八九十百千万]+、)/;

function isParentEnumerationIntro(text) {
  return /[：:]\s*$/.test(String(text || '').trim());
}

function isNumberedChild(text) {
  return CHILD_ENUMERATION_PATTERN.test(String(text || '').trim());
}

function isIndependentNumberedClause(text) {
  const value = String(text || '').trim();
  // PDF extractors commonly expose page counters as standalone spans such as
  // "18 / 56". They are not section boundaries or response obligations.
  if (/^\d+\s*\/\s*\d+$/.test(value)) return false;
  return INDEPENDENT_CLAUSE_PATTERN.test(value);
}

function isClearlyHighLevelClause(text) {
  const value = String(text || '').trim();
  return /^(?:#{1,6}\s+|第[一二三四五六七八九十百千万\d]+[章节部分]|[一二三四五六七八九十百千万]+、|\d+(?:\.\d+){1,3}[、.．\s])/.test(value);
}

function isCompleteStatement(text) {
  return /[。！？；;.!?》）)】]$/.test(String(text || '').trim());
}

function tableObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Preserve table metadata only when an upstream extractor actually provides
 * it. Plain PDF/text extraction remains on the existing paragraph path and
 * receives no guessed table structure.
 */
export function normalizeTableSemanticMetadata(paragraph = {}) {
  const table = tableObject(paragraph.table);
  const tableId = paragraph.table_id ?? paragraph.tableId ?? table?.table_id ?? table?.id ?? null;
  const rowId = paragraph.table_row_id ?? paragraph.row_id ?? paragraph.rowId
    ?? table?.table_row_id ?? table?.row_id ?? table?.rowId ?? null;
  if (tableId == null && rowId == null && !paragraph.table_header_context && !table?.header_context
    && !Array.isArray(paragraph.table_cells) && !Array.isArray(table?.cells)) return null;
  const headerContext = paragraph.table_header_context ?? paragraph.header_context ?? table?.header_context ?? null;
  const cells = paragraph.table_cells ?? paragraph.cells ?? table?.cells ?? null;
  return {
    semantic_unit_type: 'TABLE_ROW',
    table_id: tableId == null ? null : String(tableId),
    table_row_id: rowId == null ? null : String(rowId),
    table_header_context: headerContext == null ? null : String(headerContext),
    table_cells: Array.isArray(cells) ? cells.map((cell) => String(cell ?? '')) : null
  };
}

export function annotateTableSemanticUnits(paragraphs = []) {
  return (Array.isArray(paragraphs) ? paragraphs : []).map((paragraph) => ({
    ...paragraph,
    ...(normalizeTableSemanticMetadata(paragraph) || { semantic_unit_type: 'PARAGRAPH' })
  }));
}

/**
 * Classify the boundary between two source spans without consulting a model.
 * The result is intentionally small and deterministic so packing policy can
 * be tested independently from chunk construction.
 */
export function classifyBoundary(previousUnit, nextUnit) {
  const previous = previousUnit || {};
  const next = nextUnit || {};
  const sameClause = previous.source_clause_id != null
    && next.source_clause_id != null
    && String(previous.source_clause_id) === String(next.source_clause_id);

  if (isParentEnumerationIntro(previous.text) && isNumberedChild(next.text)) {
    return { classification: 'UNSAFE', reason: 'PARENT_ENUMERATION' };
  }
  // A PDF line break can leave the previous span incomplete even though the
  // next span starts a new numbered obligation. Treat that marker as the
  // nearest safe cut so the hard span cap does not split the obligation.
  // A shared clause id is sufficient structural evidence when the previous
  // span is complete (for example, a numbered subheading in one clause).
  if (isNumberedChild(next.text) && !isParentEnumerationIntro(previous.text)
    && (sameClause || !isCompleteStatement(previous.text))) {
    return {
      classification: 'MEDIUM',
      reason: sameClause ? 'NUMBERED_CLAUSE_WITHIN_SOURCE' : 'NUMBERED_CHILD_BOUNDARY'
    };
  }
  const sameTable = previous.table_id != null && next.table_id != null
    && String(previous.table_id) === String(next.table_id);
  if (sameTable) {
    const sameRow = previous.table_row_id != null && next.table_row_id != null
      && String(previous.table_row_id) === String(next.table_row_id);
    if (sameRow) return { classification: 'UNSAFE', reason: 'SAME_TABLE_ROW' };
    if (previous.table_row_id != null && next.table_row_id != null) {
      return { classification: 'STRONG', reason: 'TABLE_ROW_CHANGE' };
    }
    return { classification: 'UNSAFE', reason: 'SAME_TABLE' };
  }
  if (sameClause) {
    return { classification: 'UNSAFE', reason: 'SAME_SOURCE_CLAUSE' };
  }

  if (previous.source_section != null && next.source_section != null
    && String(previous.source_section) !== String(next.source_section)) {
    return { classification: 'STRONG', reason: 'SOURCE_SECTION_CHANGE' };
  }
  if (previous.source_clause_id != null && next.source_clause_id != null
    && String(previous.source_clause_id) !== String(next.source_clause_id)) {
    return { classification: 'STRONG', reason: 'SOURCE_CLAUSE_CHANGE' };
  }
  const pageChanged = Number.isInteger(previous.page) && Number.isInteger(next.page)
    && previous.page !== next.page;
  const nextIsIndependent = isIndependentNumberedClause(next.text);
  if (pageChanged && isCompleteStatement(previous.text) && nextIsIndependent) {
    return { classification: 'MEDIUM', reason: 'PAGE_AND_INDEPENDENT_CLAUSE' };
  }
  // An unannotated numeric heading is strong only after a completed unit.
  // This avoids treating every numbered list line in dense extracted text as
  // an independent chapter while still recognizing a clear new heading.
  if (isClearlyHighLevelClause(next.text) && isCompleteStatement(previous.text)) {
    return { classification: 'STRONG', reason: 'INDEPENDENT_CLAUSE' };
  }
  if (isCompleteStatement(previous.text) && nextIsIndependent) {
    return { classification: 'MEDIUM', reason: 'INDEPENDENT_CLAUSE_AFTER_COMPLETE' };
  }
  if (pageChanged && isCompleteStatement(previous.text)) {
    return { classification: 'MEDIUM', reason: 'PAGE_AFTER_COMPLETE' };
  }
  if (pageChanged) return { classification: 'UNSAFE', reason: 'PAGE_CONTINUATION' };
  return { classification: 'UNSAFE', reason: 'CONTINUATION' };
}

export function resolveRequirementChunkBudget(env = {}) {
  return Object.freeze({
    singleCallThreshold: positiveInteger(
      env.REQUIREMENT_SINGLE_CALL_CHAR_THRESHOLD,
      DEFAULT_SINGLE_CALL_THRESHOLD
    ),
    characterBudget: positiveInteger(env.REQUIREMENT_CHUNK_CHAR_BUDGET, DEFAULT_CHARACTER_BUDGET),
    tokenBudget: positiveInteger(env.REQUIREMENT_CHUNK_TOKEN_BUDGET, DEFAULT_TOKEN_BUDGET),
    sourceSpanBudget: positiveInteger(env.REQUIREMENT_CHUNK_SOURCE_SPAN_BUDGET, DEFAULT_SOURCE_SPAN_BUDGET)
  });
}

export function estimateTokenCount(text) {
  const value = String(text || '');
  const cjkCount = (value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const nonCjk = value.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
  const latinTokens = (nonCjk.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) || [])
    .reduce((count, token) => count + (/^[A-Za-z0-9_]+$/.test(token) ? Math.ceil(token.length / 4) : 1), 0);
  return Math.max(1, cjkCount + latinTokens);
}

export function isTitleBoundary(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 80) return false;
  if (/^\d+\s*\/\s*\d+$/.test(value)) return false;
  return /^(?:#{1,6}\s+|第[一二三四五六七八九十百\d]+[章节部分]|[一二三四五六七八九十]+[、.．]|[（(]\s*[一二三四五六七八九十\d]+\s*[)）]|\d+(?:\.\d+){0,3}[、.．\s])/.test(value);
}

function locateParagraphs(text, paragraphs) {
  let cursor = 0;
  const located = paragraphs.filter((paragraph) => String(paragraph?.text || '').trim()).map((paragraph) => {
    const value = String(paragraph.text).trim();
    let start = Number.isInteger(paragraph.source_start_offset)
      ? paragraph.source_start_offset
      : text.indexOf(value, cursor);
    if (start < 0) start = cursor;
    const end = Number.isInteger(paragraph.source_end_offset)
      ? paragraph.source_end_offset
      : start + value.length;
    cursor = end;
    return {
      ...paragraph,
      text: value,
      page: paragraph.page ?? null,
      paragraph: paragraph.paragraph ?? null,
      source_section: paragraph.source_section ?? null,
      source_clause_id: paragraph.source_clause_id ?? null,
      source_start_offset: start,
      source_end_offset: end,
      starts_at_title_boundary: isTitleBoundary(value)
    };
  });
  return annotateTableSemanticUnits(located);
}

function assertSourceSpanFitsBudget(unit, characterBudget, tokenBudget) {
  if (unit.text.length > characterBudget || estimateTokenCount(unit.text) > tokenBudget) {
    throw Object.assign(new Error('单个原文段落超过需求提取分片预算，已停止切断来源范围。'), {
      code: 'REQUIREMENT_SOURCE_SPAN_EXCEEDS_BUDGET'
    });
  }
  return unit;
}

function buildChunk(units, chunkNumber) {
  const text = units.map((unit) => unit.text).join('\n');
  const segments = units.map((unit, index) => ({
    ...unit,
    source_ref: `C${String(chunkNumber).padStart(3, '0')}-S${String(index + 1).padStart(3, '0')}`
  }));
  // The model receives deterministic span labels and, for parser-provided
  // tables, the original header context. `text` remains the exact extracted
  // content used for hashes, offsets, and persistence.
  const modelText = segments.map((unit) => {
    const header = unit.table_header_context ? ` 表头：${unit.table_header_context}` : '';
    return `[${unit.source_ref}]${header} ${unit.text}`;
  }).join('\n');
  const pages = units.map((unit) => unit.page).filter(Number.isInteger);
  const paragraphs = units.map((unit) => unit.paragraph).filter(Number.isInteger);
  return {
    chunk_number: chunkNumber,
    text,
    model_text: modelText,
    segments,
    character_count: text.length,
    estimated_token_count: estimateTokenCount(text),
    source_start_offset: units[0].source_start_offset,
    source_end_offset: units.at(-1).source_end_offset,
    source_start_page: pages.length ? Math.min(...pages) : null,
    source_end_page: pages.length ? Math.max(...pages) : null,
    source_start_paragraph: paragraphs.length ? Math.min(...paragraphs) : null,
    source_end_paragraph: paragraphs.length ? Math.max(...paragraphs) : null,
    starts_at_title_boundary: units[0].starts_at_title_boundary,
    table_units: segments.filter((unit) => unit.semantic_unit_type === 'TABLE_ROW').map((unit) => ({
      table_id: unit.table_id,
      row_id: unit.table_row_id,
      header_context: unit.table_header_context,
      source_ref: unit.source_ref,
      source_text: unit.text,
      cells: unit.table_cells
    }))
  };
}

function chunkText(units) {
  return units.map((unit) => unit.text).join('\n');
}

function exceedsBudget(units, characterBudget, tokenBudget, sourceSpanBudget) {
  if (!units.length) return false;
  const text = chunkText(units);
  return text.length > characterBudget
    || estimateTokenCount(text) > tokenBudget
    || units.length > sourceSpanBudget;
}

function meaningfulChunk(units, characterBudget) {
  const textLength = chunkText(units).length;
  return textLength >= Math.min(300, Math.max(40, Math.floor(characterBudget * 0.15)));
}

/**
 * Find a bounded, safe lookback cut. Semantic boundaries are remembered as
 * possible cut locations while a window is packed. When hard-budget pressure
 * arrives, the nearest suitable STRONG boundary wins over every MEDIUM
 * boundary; MEDIUM is considered only when no suitable STRONG cut exists.
 * The caller falls back to an atomic paragraph cut when null.
 */
function findSafeBoundary(units, characterBudget, tokenBudget, sourceSpanBudget) {
  const lookback = Math.min(MAX_BOUNDARY_LOOKBACK, Math.max(2, sourceSpanBudget));
  const firstIndex = Math.max(1, units.length - lookback);
  const suitable = (index, classification) => {
    const boundary = classifyBoundary(units[index - 1], units[index]);
    if (boundary.classification !== classification) return false;
    const prefix = units.slice(0, index);
    if (!meaningfulChunk(prefix, characterBudget) && prefix.length < 3) return false;
    return !exceedsBudget(prefix, characterBudget, tokenBudget, sourceSpanBudget);
  };
  for (const classification of ['STRONG', 'MEDIUM']) {
    for (let index = units.length - 1; index >= firstIndex; index -= 1) {
      if (suitable(index, classification)) return index;
    }
  }
  return null;
}

export function chunkExtractedText({
  text,
  paragraphs,
  singleCallThreshold,
  characterBudget,
  tokenBudget,
  sourceSpanBudget
}) {
  const content = String(text || '');
  const singleCallLimit = positiveInteger(singleCallThreshold, DEFAULT_SINGLE_CALL_THRESHOLD);
  const charLimit = positiveInteger(characterBudget, DEFAULT_CHARACTER_BUDGET);
  const tokenLimit = positiveInteger(tokenBudget, DEFAULT_TOKEN_BUDGET);
  const spanLimit = positiveInteger(sourceSpanBudget, DEFAULT_SOURCE_SPAN_BUDGET);
  const located = locateParagraphs(content, Array.isArray(paragraphs) ? paragraphs : []);
  if (!located.length) throw Object.assign(new Error('提取文本没有可分片段落。'), { code: 'REQUIREMENT_CHUNKING_FAILED' });
  // A single request must satisfy both the character and token hard caps.
  // When either limit is exceeded, use the same paragraph-aware splitter as
  // large documents rather than allowing an oversized one-shot request. A
  // semantic boundary alone is not a reason to fragment an otherwise fitting
  // request; it is retained as a possible late cut if a hard budget is hit.
  if (content.length <= singleCallLimit
    && content.length <= charLimit
    && estimateTokenCount(content) <= tokenLimit
    && located.length <= spanLimit) {
    return [buildChunk(located, 1)];
  }
  const units = located.map((unit) => assertSourceSpanFitsBudget(unit, charLimit, tokenLimit));
  const chunks = [];
  let current = [];
  const flush = (units = current) => {
    if (!units.length) return;
    chunks.push(buildChunk(units, chunks.length + 1));
  };
  const reset = () => {
    current = [];
  };
  const flushCurrent = () => {
    if (!current.length) return;
    flush(current);
    reset();
  };
  for (const unit of units) {
    // Keep packing across safe boundaries. `findSafeBoundary` evaluates these
    // candidate locations only when the next append puts the window over a
    // hard budget, so independent sections can share one model request.
    current.push(unit);
    while (exceedsBudget(current, charLimit, tokenLimit, spanLimit)) {
      const cut = findSafeBoundary(current, charLimit, tokenLimit, spanLimit);
      if (cut != null) {
        flush(current.slice(0, cut));
        current = current.slice(cut);
        continue;
      }
      // No safe semantic boundary exists in the bounded lookback window.
      // Preserve the existing atomic source-span fallback and never cut text.
      const last = current.pop();
      flushCurrent();
      current = [last];
      break;
    }
  }
  flushCurrent();
  return chunks;
}

/**
 * Explicitly projects a validated model Candidate into the Canonical
 * Requirement input shape.  `content` and `source_excerpt` are domain fields;
 * they are never accepted as aliases on the model-facing Candidate object.
 */
export function mapRequirementCandidateToCanonicalInput(candidate, chunkNumber, { allowBackendProvenance = false } = {}) {
  const content = String(candidate?.text || '').trim();
  const sourceRefs = Array.isArray(candidate?.source_refs)
    ? candidate.source_refs.filter((value) => typeof value === 'string' && value.trim())
    : [];
  if (!content || !sourceRefs.length) return null;
  // Model candidates are never allowed to provide canonical provenance. Only
  // the post-resolver projection may carry backend-derived source fields.
  if (!allowBackendProvenance && (Object.hasOwn(candidate, 'source_text')
    || Object.hasOwn(candidate, 'source_clause')
    || Object.hasOwn(candidate, 'source_excerpt')
    || Object.hasOwn(candidate, 'content'))) return null;
  const sourceText = allowBackendProvenance && typeof candidate.source_text === 'string'
    ? candidate.source_text.trim() : null;
  const source = {
        source_excerpt: sourceText,
        source_text: sourceText,
        source_page: candidate.source_page ?? null,
        source_paragraph: candidate.source_paragraph ?? null,
        source_section: candidate.source_section ?? null,
        source_clause_id: candidate.source_clause_id ?? null,
        source_hash: candidate.source_hash ?? null,
        source_chunk_id: candidate.source_chunk_id ?? null,
        source_context_text: candidate.source_context_text ?? null,
        source_verified: candidate.source_verified === true,
        source_resolution_status: candidate.source_resolution_status ?? 'unresolved',
        source_resolution_method: candidate.source_resolution_method ?? null,
        source_match_type: candidate.source_match_type ?? null,
        source_match_score: candidate.source_match_score ?? null,
        source_page_start: candidate.source_page_start ?? candidate.source_page ?? null,
        source_page_end: candidate.source_page_end ?? candidate.source_page ?? null,
        source_paragraph_start: candidate.source_paragraph_start ?? candidate.source_paragraph ?? null,
        source_paragraph_end: candidate.source_paragraph_end ?? candidate.source_paragraph ?? null,
        source_paragraphs_json: candidate.source_paragraphs_json ?? [],
        category: candidate.category ?? null,
        mandatory_observed: candidate.mandatory_observed,
        requires_confirmation: candidate.requires_confirmation,
        source_start_offset: candidate.source_start_offset ?? null,
        source_end_offset: candidate.source_end_offset ?? null,
        chunk_number: chunkNumber,
        source_refs: [...sourceRefs]
      };
  return { content, ...source, sources: [source] };
}

export function aggregateRequirementCandidates(chunkResults, { mandatoryScopeRules = [], documentText = null } = {}) {
  const candidates = [];
  for (const chunkResult of chunkResults) {
    for (const candidate of chunkResult.candidates || []) {
      const mapped = mapRequirementCandidateToCanonicalInput(candidate, chunkResult.chunk_number, { allowBackendProvenance: true });
      if (mapped) candidates.push(mapped);
    }
  }
  if (!candidates.length) {
    throw Object.assign(new Error('所有可处理分片均未提取到候选需求。'), {
      code: 'NO_REQUIREMENTS_EXTRACTED',
      status: 422
    });
  }
  return buildCanonicalRequirements(candidates, { mandatoryScopeRules, documentText, qualityGate: true });
}
