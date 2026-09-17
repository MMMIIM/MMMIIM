import { createHash } from 'node:crypto';
import { adaptHtmlToSourceText } from './reference-eval-html-adapter.js';

/**
 * Eval-only canonical source-unit preparation for the six frozen H3C HTML
 * snapshots. Selector rules are structural (DOM id/class/tag only); no
 * requirement, tender, query, or semantic relevance signal is used.
 */
export const CANONICAL_HTML_SOURCE_UNIT_VERSION = 'canonical-html-source-unit-v1';

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TAG_TOKEN_RE = /<!--[\s\S]*?-->|<\s*\/?\s*[A-Za-z][^>]*>/g;
const HASH = value => createHash('sha256').update(value).digest('hex');

export const H3C_SOURCE_UNIT_RULES = Object.freeze({
  'H3C-003': { selector: '#documentContent', match: { tag: 'div', id: 'documentContent' }, excludes: [{ tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }] },
  'H3C-004': { selector: '#documentContent', match: { tag: 'div', id: 'documentContent' }, excludes: [{ tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }] },
  'H3C-010': { selector: '#ns-page-body', match: { tag: 'div', id: 'ns-page-body' }, excludes: [
    { id: 'secondMenu' }, { classes: ['ns-breadcrumb'] }, { tag: 'a', classes: ['ns-btn'] },
    { tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }
  ] },
  'H3C-011': { selector: '.detailBody', match: { tag: 'div', classes: ['detailBody'] }, excludes: [{ tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }] },
  'H3C-012': { selector: '.detailBody', match: { tag: 'div', classes: ['detailBody'] }, excludes: [{ tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }] },
  'H3C-013': { selector: '.content > .main.pd', match: { tag: 'div', classes: ['main', 'pd'], parent: { tag: 'div', classes: ['content'] } }, excludes: [
    { classes: ['video-box'] }, { classes: ['download-box'] }, { tag: 'video' }, { tag: 'img' },
    { tag: 'style' }, { tag: 'script' }, { tag: 'noscript' }, { tag: 'template' }, { tag: 'svg' }
  ] }
});

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
  return { closing, name, attrs: closing ? {} : parseAttributes(token), selfClosing: /\/\s*>\s*$/u.test(token) || VOID_TAGS.has(name) };
}

function classes(attrs) {
  return new Set(String(attrs.class || '').split(/\s+/u).map(value => value.trim()).filter(Boolean));
}

function matches(record, rule) {
  if (rule.tag && record.name !== String(rule.tag).toLowerCase()) return false;
  if (rule.id && String(record.attrs.id || '') !== String(rule.id)) return false;
  const wanted = rule.classes || [];
  const actual = classes(record.attrs);
  return wanted.every(value => actual.has(value));
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
      let index = stack.length - 1;
      while (index >= 0 && records[stack[index]].name !== parsed.name) index -= 1;
      if (index < 0) continue;
      const recordIndex = stack[index];
      records[recordIndex].end = end;
      stack.splice(index, 1);
      continue;
    }
    const parent = stack.length ? stack[stack.length - 1] : null;
    const record = { name: parsed.name, attrs: parsed.attrs, start, openEnd: end, end: parsed.selfClosing ? end : null, parent };
    const recordIndex = records.push(record) - 1;
    if (!parsed.selfClosing) stack.push(recordIndex);
  }
  return records;
}

function parentMatches(record, records, parentRule) {
  if (!parentRule) return true;
  const parent = record.parent == null ? null : records[record.parent];
  return Boolean(parent && matches(parent, parentRule));
}

function selectUnique(html, rule) {
  const records = makeElementRecords(html);
  const candidates = records.filter(record => record.end != null && matches(record, rule.match) && parentMatches(record, records, rule.match.parent));
  if (candidates.length !== 1) {
    const error = new Error('Canonical source selector ' + rule.selector + ' matched ' + candidates.length + ' elements.');
    error.code = candidates.length ? 'SOURCE_UNIT_SELECTOR_AMBIGUOUS' : 'SOURCE_UNIT_SELECTOR_NOT_FOUND';
    throw error;
  }
  return { record: candidates[0] };
}

function removeExcluded(fragment, excludes) {
  const records = makeElementRecords(fragment);
  const ranges = records
    .filter(record => record.end != null && excludes.some(rule => matches(record, rule)))
    .filter((record, _, all) => !all.some(parent => parent !== record && parent.start <= record.start && parent.end >= record.end));
  let output = fragment;
  for (const record of ranges.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, record.start) + output.slice(record.end);
  }
  return { html: output, removed_count: ranges.length, removed_tags: ranges.map(record => record.name).sort() };
}

export function prepareCanonicalHtmlSource({ sourceId, rawHtml }) {
  const id = String(sourceId || '');
  const rule = H3C_SOURCE_UNIT_RULES[id];
  if (!rule) throw Object.assign(new Error('No frozen source-unit rule for ' + id + '.'), { code: 'SOURCE_UNIT_RULE_NOT_DEFINED' });
  const input = String(rawHtml ?? '');
  if (!input) throw Object.assign(new Error('Empty HTML snapshot for ' + id + '.'), { code: 'SOURCE_HTML_EMPTY' });
  const selected = selectUnique(input, rule);
  const selectedHtml = input.slice(selected.record.start, selected.record.end);
  const removed = removeExcluded(selectedHtml, rule.excludes);
  const text = adaptHtmlToSourceText(removed.html);
  const selectedBytesBefore = Buffer.byteLength(input.slice(0, selected.record.start), 'utf8');
  const selectedBytes = Buffer.byteLength(selectedHtml, 'utf8');
  return Object.freeze({
    source_id: id,
    preparation_version: CANONICAL_HTML_SOURCE_UNIT_VERSION,
    selector: rule.selector,
    selection: {
      tag: selected.record.name,
      id: selected.record.attrs.id || null,
      classes: [...classes(selected.record.attrs)].sort(),
      source_char_start: selected.record.start,
      source_char_end: selected.record.end,
      source_byte_start: selectedBytesBefore,
      source_byte_end: selectedBytesBefore + selectedBytes,
      selected_html_sha256: HASH(selectedHtml),
      selected_html_chars: selectedHtml.length
    },
    exclusions: {
      mechanical_only: true,
      rules: rule.excludes,
      removed_element_count: removed.removed_count,
      removed_tags: removed.removed_tags
    },
    canonical_html_sha256: HASH(removed.html),
    canonical_text_sha256: HASH(text),
    canonical_text_chars: text.length,
    canonical_source_unit: 'ONE_DETERMINISTIC_MAIN_CONTENT_CONTAINER',
    ambiguity: null,
    source_text: text,
    canonical_html: removed.html
  });
}

export function sourceUnitRuleSummary() {
  return Object.fromEntries(Object.entries(H3C_SOURCE_UNIT_RULES).map(([sourceId, rule]) => [sourceId, {
    selector: rule.selector,
    match: rule.match,
    exclusions: rule.excludes,
    semantic_selection_used: false,
    requirement_query_used: false,
    tender_id_used: false
  }]));
}
