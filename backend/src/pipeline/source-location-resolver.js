import { createHash } from 'node:crypto';

const PUNCTUATION = new Map([
  ['，', ','], ['。', '.'], ['：', ':'], ['；', ';'], ['！', '!'], ['？', '?'],
  ['（', '('], ['）', ')'], ['【', '['], ['】', ']'], ['“', '"'], ['”', '"'],
  ['‘', "'"], ['’', "'"], ['、', ',']
]);

export const SOURCE_MATCH_TYPES = Object.freeze({
  EXACT_SINGLE: 'exact_single_paragraph', NORMALIZED_SINGLE: 'normalized_single_paragraph',
  EXACT_MULTI: 'exact_multi_paragraph_span', NORMALIZED_MULTI: 'normalized_multi_paragraph_span',
  AMBIGUOUS: 'ambiguous', SUGGESTED: 'suggested', UNRESOLVED: 'unresolved'
});

export function normalizeSourceText(value) {
  return String(value || '').normalize('NFKC').replace(/\r\n?/g, '\n').split('')
    .map((character) => PUNCTUATION.get(character) || character).join('')
    .replace(/([\u3400-\u9fff])\n(?=[\u3400-\u9fff])/g, '$1').replace(/\s+/g, '').trim();
}

export function hashSource(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

const raw = (value) => String(value || '').replace(/\r\n?/g, '\n').trim();

function location(match, chunk, matchType, score = 1, sourceRefs = []) {
  const first = match.segments[0];
  const last = match.segments.at(-1);
  const pages = match.segments.map((item) => item.page).filter(Number.isInteger);
  const original = match.segments.map((item) => item.text).join('\n');
  const clauseIds = [...new Set(match.segments.map((item) => item.source_clause_id).filter(Boolean))];
  const contextSegments = clauseIds.length === 1
    ? (chunk.segments || []).filter((item) => item.source_clause_id === clauseIds[0])
    : match.segments;
  return {
    source_context_text: contextSegments.map((item) => item.text).join('\n'),
    source_page: pages[0] ?? null, source_paragraph: first.paragraph ?? null,
    source_page_start: pages[0] ?? null, source_page_end: pages.at(-1) ?? null,
    source_paragraph_start: first.paragraph ?? null, source_paragraph_end: last.paragraph ?? null,
    source_paragraphs_json: match.segments.map((item) => ({ paragraph: item.paragraph, page: item.page ?? null, text_hash: hashSource(item.text) })),
    source_hash: hashSource(original), source_start_offset: first.source_start_offset ?? chunk.source_start_offset ?? null,
    source_end_offset: last.source_end_offset ?? chunk.source_end_offset ?? null,
    source_section: first.source_section || null, source_clause_id: first.source_clause_id || null,
    source_chunk_id: chunk.id || chunk.chunk_id || null, source_match_type: matchType,
    source_match_score: score, source_resolution_status: 'verified',
    source_resolution_method: 'automatic', source_verified: true,
    source_refs: [...sourceRefs]
  };
}

export class SourceLocationResolver {
  constructor() {}

  resolve(candidate, chunk) {
    const sourceRange = candidate?.source_range;
    const segments = (chunk?.segments || []).filter((item) => raw(item.text));
    const byRef = new Map(segments.map((item, index) => [item.source_ref || item.span_id, { item, index }]));
    if (!sourceRange || typeof sourceRange !== 'object' || Array.isArray(sourceRange)
      || Object.keys(sourceRange).some((key) => !['start_ref', 'end_ref'].includes(key))
      || typeof sourceRange.start_ref !== 'string'
      || typeof sourceRange.end_ref !== 'string'
      || !/^C\d{3}-S\d{3}$/.test(sourceRange.start_ref)
      || !/^C\d{3}-S\d{3}$/.test(sourceRange.end_ref)) {
      throw Object.assign(new Error('候选需求必须提供有效 source_range。'), { code: 'GATEWAY_REQUIREMENTS_INVALID' });
    }
    const start = byRef.get(sourceRange.start_ref);
    const end = byRef.get(sourceRange.end_ref);
    if (!start || !end) {
      throw Object.assign(new Error('来源范围端点不在当前分片窗口内，无法确定性定位。'), { code: 'SOURCE_LOCATION_UNRESOLVED' });
    }
    if (start.index > end.index) {
      throw Object.assign(new Error('来源范围端点顺序无效，无法确定性定位。'), { code: 'SOURCE_LOCATION_UNRESOLVED' });
    }
    const ordered = segments.slice(start.index, end.index + 1);
    const sourceRefs = ordered.map((segment) => segment.source_ref || segment.span_id);
    const match = { segments: ordered };
    const matchType = match.segments.length === 1 ? SOURCE_MATCH_TYPES.EXACT_SINGLE : SOURCE_MATCH_TYPES.EXACT_MULTI;
    return { location: { source_text: match.segments.map((item) => item.text).join('\n'), ...location(match, chunk, matchType, 1, sourceRefs) }, warning: null };
  }
}

export function parseSourceHint(value) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    if (Number.isInteger(item) && item >= 0) return { hint: item, warning: null };
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (/^\d+$/.test(trimmed)) return { hint: Number(trimmed), warning: null };
      const numbered = trimmed.match(/^第\s*(\d+)\s*段$/);
      if (numbered) return { hint: Number(numbered[1]), warning: null };
    }
  }
  return value === null || value === undefined ? { hint: null, warning: null }
    : { hint: null, warning: { code: 'SOURCE_HINT_IGNORED', message: '模型返回的来源段落提示格式无效，已忽略。' } };
}
