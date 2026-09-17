import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import {
  combineRequirementExtractionSections,
  isBidderFacingRequirementParagraph
} from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, estimateTokenCount, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';
import {
  buildRequirementExtractionPayload,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const ANCHOR_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_FROZEN_V6_2.json');
const OLD_VISIBILITY_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_2.json');
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const OUT_SUPPORT = path.join(OUT_DIR, 'V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3.json');
const OUT_VISIBILITY = path.join(OUT_DIR, 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_3.json');
const OUT_PLAN = path.join(OUT_DIR, 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
const OUT_SCOPE = path.join(ROOT, 'docs', 'V43_CANONICAL_REQUIREMENT_SCOPE_V1_1.md');
const OUT_REGRESSION = path.join(ROOT, 'docs', 'V43_REQUIREMENT_SCOPE_V1_1_CORE6_REGRESSION.json');
const OUT_CHECKPOINT = path.join(OUT_DIR, 'V43_P0_BADCASE_44_V6_3_CHECKPOINT.md');
const OUT_CHECKPOINT_JSON = path.join(OUT_DIR, 'V43_P0_BADCASE_44_V6_3_CHECKPOINT.json');

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function textOf(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function normalized(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, ''); }
function has(value, needle) { const n = normalized(needle); return Boolean(n) && normalized(value).includes(n); }

// The production chunker decorates each source paragraph in model_text with a
// deterministic source-ref/table-header prefix.  A multi-paragraph support
// span therefore is not always a contiguous substring of the provider input,
// even though every source paragraph is present.  Coverage must account for
// those mechanical markers without treating them as source loss.
function providerInputContainsSupportSpan(state, span, payloadText) {
  if (has(payloadText, span.raw_source_text)) return true;
  const start = Number(span.paragraph_start);
  const end = Number(span.paragraph_end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const sourceParagraphs = state.paragraphs.filter((paragraph) => (
    Number(paragraph.paragraph) >= start && Number(paragraph.paragraph) <= end
  ));
  if (!sourceParagraphs.length) return false;
  const payload = normalized(payloadText);
  let cursor = 0;
  for (const paragraph of sourceParagraphs) {
    const fragment = normalized(paragraph.text);
    if (!fragment) continue;
    const index = payload.indexOf(fragment, cursor);
    if (index < 0) return false;
    cursor = index + fragment.length;
  }
  return true;
}

function annotateParagraphs(extraction) {
  let cursor = 0;
  return (extraction.paragraphs || []).map((paragraph) => {
    const text = String(paragraph.text || '');
    let start = extraction.text.indexOf(text, cursor);
    if (start < 0) start = cursor;
    const end = start + text.length;
    cursor = end;
    return { ...paragraph, source_start_offset: start, source_end_offset: end };
  });
}

function sourceWindow(state, startIndex, endIndex) {
  const paragraphs = state.paragraphs.slice(startIndex, endIndex + 1);
  const first = paragraphs[0];
  const last = paragraphs.at(-1);
  const raw = paragraphs.map((paragraph) => paragraph.text).join('\n');
  return {
    source_document_sha256: state.source_sha256,
    page: first?.page ?? null,
    paragraph_start: first?.paragraph ?? null,
    paragraph_end: last?.paragraph ?? null,
    source_start_offset: first?.source_start_offset ?? null,
    source_end_offset: last?.source_end_offset ?? null,
    raw_source_text: raw,
    raw_source_text_sha256: sha256(raw),
    source_page_start: first?.page ?? null,
    source_page_end: last?.page ?? null
  };
}

function paragraphBounds(state, anchor) {
  const start = Number(anchor.paragraph_start);
  const end = Number(anchor.paragraph_end);
  const inRange = state.paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => Number.isFinite(start) && Number.isFinite(end)
      ? paragraph.paragraph >= start && paragraph.paragraph <= end
      : paragraph.page >= Number(anchor.page || 0) - 1 && paragraph.page <= Number(anchor.page || 0) + 1);
  return inRange.length ? inRange : state.paragraphs.map((paragraph, index) => ({ paragraph, index }));
}

function queryFragments(query) {
  return String(query || '').split(/[\n；;。:：，,（）()、]/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 4)
    .sort((a, b) => b.length - a.length);
}

function queryTokens(query) {
  const runs = String(query || '').normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) || [];
  const tokens = [];
  for (const run of runs) {
    const value = normalized(run);
    if (value.length <= 8) tokens.push(value);
    for (let index = 0; index + 4 <= value.length; index += 4) tokens.push(value.slice(index, Math.min(value.length, index + 8)));
  }
  return [...new Set(tokens.filter((value) => value.length >= 2))];
}

function exactParagraphWindow(state, entries, query) {
  if (!query) return null;
  const target = normalized(query);
  const exact = entries.find(({ paragraph }) => normalized(paragraph.text).includes(target));
  if (exact) return { start: exact.index, end: exact.index, method: 'MINIMUM_EXACT_QUERY_PARAGRAPH' };
  for (const fragment of queryFragments(query)) {
    const hit = entries.find(({ paragraph }) => normalized(paragraph.text).includes(normalized(fragment)));
    if (hit) return { start: hit.index, end: hit.index, method: 'MINIMUM_QUERY_FRAGMENT_PARAGRAPH' };
  }
  return null;
}

function headingListWindow(state, entries, query) {
  const match = String(query || '').match(/(\d+(?:\.\d+)*)\s*([^，。；;\n]{2,30})/);
  if (!match) return null;
  const headingTitle = match[2].replace(/及其后.*$/u, '').slice(0, 10);
  const prefix = normalized(`${match[1]} ${headingTitle}`);
  const heading = entries.find(({ paragraph }) => normalized(paragraph.text).includes(prefix));
  if (!heading) return null;
  let end = heading.index;
  for (let index = heading.index + 1; index < state.paragraphs.length && index <= heading.index + 20; index += 1) {
    const value = textOf(state.paragraphs[index].text);
    if (/^\d+(?:\.\d+)*\s+\S+/.test(value) || /^第\s*[一二三四五六七八九十百千万\d]+\s*章/.test(value)) break;
    if (/^[•·]/.test(value) || /[《》]|GB\/?T|标准|规范|条例/.test(value)) end = index;
    else if (index === heading.index + 1) end = index;
  }
  return { start: heading.index, end, method: 'MINIMUM_HEADING_AND_LIST_CONTEXT' };
}

function tokenWindow(state, entries, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return null;
  let best = null;
  for (let width = 1; width <= Math.min(5, entries.length); width += 1) {
    for (let offset = 0; offset + width <= entries.length; offset += 1) {
      const start = entries[offset].index;
      const end = entries[offset + width - 1].index;
      const value = normalized(state.paragraphs.slice(start, end + 1).map((paragraph) => paragraph.text).join('\n'));
      const score = tokens.filter((token) => value.includes(token)).length;
      const candidate = { start, end, score, method: 'MINIMUM_QUERY_TOKEN_WINDOW' };
      if (!best || score > best.score || (score === best.score && width < best.end - best.start + 1)) best = candidate;
    }
  }
  return best && best.score >= 1 ? best : null;
}

function bidderFacingFallbackWindow(state, entries) {
  const flagged = entries.filter(({ paragraph }) => {
    const section = state.analysis.sections.find((candidate) => candidate.paragraphs.some((item) => item.paragraph === paragraph.paragraph));
    if (paragraph.routing_role === 'SCORING') return false;
    if (/^\d+(?:\.\d+)+\s+/.test(textOf(paragraph.text))) return false;
    if (/^(?:第\s*[一二三四五六七八九十百千万\d]+\s*章|评标委员会|评审委员会)/.test(textOf(paragraph.text))) return false;
    return isBidderFacingRequirementParagraph(paragraph, { sectionRole: section?.routing_role || 'UNKNOWN' });
  });
  if (!flagged.length) return null;
  let best = null;
  let run = [flagged[0]];
  const consider = (candidate) => {
    if (!best || candidate.length > best.length) best = candidate;
  };
  for (let index = 1; index < flagged.length; index += 1) {
    if (flagged[index].index === flagged[index - 1].index + 1) run.push(flagged[index]);
    else { consider(run); run = [flagged[index]]; }
  }
  consider(run);
  const start = best[0].index;
  const end = best.at(-1).index;
  return { start, end, method: 'MINIMUM_BIDDER_FACING_PARAGRAPH_WINDOW' };
}

function materializeMinimumSpan(state, row, anchor, anchorIndex) {
  const entries = paragraphBounds(state, anchor);
  const query = anchor.hint || anchor.required_raw_semantics || row.required_raw_semantics?.[anchorIndex] || null;
  let selected = query && anchor.materialization?.method === 'DETERMINISTIC_HEADING_LIST_EXPANSION'
    ? headingListWindow(state, entries, query) : exactParagraphWindow(state, entries, query);
  if (!selected && query) selected = headingListWindow(state, entries, query);
  if (!selected && query) selected = tokenWindow(state, entries, query);
  if (!selected && !query) selected = bidderFacingFallbackWindow(state, entries);
  if (!selected && !query) selected = tokenWindow(state, entries, anchor.raw_source_text);
  if (!selected) {
    selected = {
      start: entries[0].index,
      end: entries.at(-1).index,
      method: query ? 'APPROVED_ANCHOR_CONTEXT_FALLBACK' : 'FROZEN_ANCHOR_CONTEXT_FALLBACK'
    };
  }
  const window = sourceWindow(state, selected.start, selected.end);
  return {
    ...window,
    support_span_id: `SUPPORT-${row.atom_id}-${anchorIndex + 1}`,
    support_method: selected.method,
    approved_anchor_source_candidate_id: anchor.source_candidate_id || null,
    query_hint_present: Boolean(query),
    query_hint_sha256: query ? sha256(query) : null,
    source_pages: anchor.source_pages || row.source_pages || [window.page],
    source_document_sha256: state.source_sha256
  };
}

function currentPayloadChunks(state, manifestEntry) {
  const budget = resolveRequirementChunkBudget(process.env);
  const chunks = chunkExtractedText({ text: state.scope.content_text, paragraphs: state.scope.paragraphs, ...budget });
  return chunks.map((chunk) => {
    const providerInput = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
    const payload = buildRequirementExtractionPayload({
      projectName: manifestEntry.source_file,
      sectionName: state.scope.title,
      chunkIndex: chunk.chunk_number,
      chunkCount: chunks.length,
      chunkText: providerInput
    });
    return {
      ...chunk,
      id: `${state.tender_id}:reconstructed:${chunk.chunk_number}`,
      content_sha256: sha256(chunk.text),
      provider_payload_chunk_text: payload.chunk_text,
      provider_payload_chunk_text_sha256: sha256(payload.chunk_text),
      persisted_identity: 'NOT_RELOADED_RECONSTRUCTED_OFFLINE'
    };
  });
}

async function loadStates(manifest) {
  const states = new Map();
  const entries = new Map((manifest.tenders || []).map((item) => [item.tender, item]));
  for (const tender of TENDER_ORDER) {
    const entry = entries.get(tender);
    if (!entry) throw new Error(`Missing manifest tender: ${tender}`);
    const sourcePath = path.join(ROOT, 'backend', 'eval', 'tender-benchmark-v1', 'sources', entry.source_file);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing frozen source: ${sourcePath}`);
    const sourceSha = sha256File(sourcePath);
    if (sourceSha !== entry.source_sha256) throw new Error(`Source SHA mismatch: ${tender}`);
    const extraction = await extractTenderText({ fileName: entry.source_file, mimeType: 'application/pdf', buffer: fs.readFileSync(sourcePath) });
    const analysis = classifyTenderSections(extraction);
    const scope = combineRequirementExtractionSections(analysis.sections, { includeNonScoringSections: true });
    if (!scope) throw new Error(`Missing current scope: ${tender}`);
    const state = {
      tender_id: tender,
      source_file: entry.source_file,
      source_sha256: sourceSha,
      extracted_text: extraction.text,
      extracted_text_sha256: sha256(extraction.text),
      paragraphs: annotateParagraphs(extraction),
      analysis,
      scope
    };
    state.chunks = currentPayloadChunks(state, entry);
    states.set(tender, state);
  }
  return states;
}

function visibilityForSpan(state, span) {
  const inDocument = has(state.extracted_text, span.raw_source_text);
  const inScope = has(state.scope.content_text, span.raw_source_text);
  const parseChunks = state.chunks.filter((chunk) => has(chunk.text, span.raw_source_text));
  if (parseChunks.length) {
    const payloadChunks = parseChunks.filter((chunk) => providerInputContainsSupportSpan(state, span, chunk.provider_payload_chunk_text));
    if (payloadChunks.length) return {
      status: 'SOURCE_IN_PROVIDER_INPUT', first_loss_stage: null, provider_input_visible: true,
      cross_chunk_semantic_split: false, source_in_scope: true, source_in_parse_chunk: true,
      parse_chunks: payloadChunks.map(chunkIdentity)
    };
    return {
      status: 'SOURCE_IN_PARSE_CHUNK', first_loss_stage: 'PAYLOAD_BUILDER', provider_input_visible: false,
      cross_chunk_semantic_split: false, source_in_scope: true, source_in_parse_chunk: true,
      parse_chunks: parseChunks.map(chunkIdentity)
    };
  }
  for (let index = 0; index < state.chunks.length - 1; index += 1) {
    const joined = `${state.chunks[index].text}\n${state.chunks[index + 1].text}`;
    if (has(joined, span.raw_source_text)) return {
      status: 'CROSS_CHUNK_SEMANTIC_SPLIT', first_loss_stage: 'CHUNK_BUILDER', provider_input_visible: false,
      cross_chunk_semantic_split: true, source_in_scope: inScope, source_in_parse_chunk: false,
      parse_chunks: [chunkIdentity(state.chunks[index]), chunkIdentity(state.chunks[index + 1])]
    };
  }
  if (inScope) return {
    status: 'PAYLOAD_COVERAGE_LOSS', first_loss_stage: 'CHUNK_BUILDER', provider_input_visible: false,
    cross_chunk_semantic_split: false, source_in_scope: true, source_in_parse_chunk: false, parse_chunks: []
  };
  return {
    status: 'SOURCE_SCOPE_LOSS', first_loss_stage: inDocument ? 'SCOPE_ROUTER' : 'SECTION_CLASSIFIER', provider_input_visible: false,
    cross_chunk_semantic_split: false, source_in_scope: false, source_in_parse_chunk: false, parse_chunks: []
  };
}

function chunkIdentity(chunk) {
  return {
    chunk_id: chunk.id,
    chunk_number: chunk.chunk_number,
    content_sha256: chunk.content_sha256,
    provider_payload_chunk_text_sha256: chunk.provider_payload_chunk_text_sha256,
    source_start_page: chunk.source_start_page,
    source_end_page: chunk.source_end_page,
    source_start_paragraph: chunk.source_start_paragraph,
    source_end_paragraph: chunk.source_end_paragraph
  };
}

function deriveNegativeLeakage(text) {
  const patterns = {
    buyer_contacts: /(?:采购人|招标人).{0,16}(?:联系人|电话|地址|邮箱)/g,
    evaluation_scheduling: /(?:评审委员会|评标委员会).{0,20}(?:评审时间|开标时间|组织评审|日程)/g,
    pure_definitions: /(?:本文件|本项目|以下简称|定义).{0,24}(?:是指|系指|指的是)/g,
    buyer_administration: /(?:采购代理机构|招标代理机构).{0,20}(?:地址|电话|联系人|负责)/g
  };
  return Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, [...String(text || '').matchAll(pattern)].length]));
}

function buildScopeRegression(states, manifest) {
  const rows = [];
  const byTender = new Map((manifest.tenders || []).map((item) => [item.tender, item]));
  for (const tender of TENDER_ORDER) {
    const state = states.get(tender);
    const old = byTender.get(tender);
    const previousChars = old?.summary?.extraction_section_character_count ?? null;
    const previousChunks = old?.chunk_count_persisted ?? null;
    const roleCounts = {};
    for (const section of state.analysis.sections) roleCounts[section.routing_role] = (roleCounts[section.routing_role] || 0) + section.paragraphs.length;
    rows.push({
      tender_id: tender,
      source_file: state.source_file,
      source_sha256: state.source_sha256,
      parser_sections: state.analysis.sections.length,
      scope_sections: state.scope.source_sections,
      scope_character_count: state.scope.character_count,
      scope_estimated_token_count: estimateTokenCount(state.scope.content_text),
      scope_chunk_count: state.chunks.length,
      previous_persisted_character_count: previousChars,
      previous_persisted_chunk_count: previousChunks,
      character_delta: previousChars == null ? null : state.scope.character_count - Number(previousChars),
      chunk_delta: previousChunks == null ? null : state.chunks.length - Number(previousChunks),
      role_distribution: roleCounts,
      negative_leakage: deriveNegativeLeakage(state.scope.content_text),
      persistence_identity: 'CURRENT_RECONSTRUCTION_ONLY_NO_DB_WRITE'
    });
  }
  return {
    artifact_type: 'V43_REQUIREMENT_SCOPE_V1_1_CORE6_REGRESSION',
    scope_contract: 'CANONICAL_REQUIREMENT_SCOPE_V1_1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    tender_count: rows.length,
    rows,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0
  };
}

function writeScopeDoc(regression) {
  const lines = [
    '# Canonical Requirement Scope v1.1',
    '',
    'This document records the frozen bidder-facing scope boundary used by the V6.3 offline coverage repair.',
    '',
    '- Substantive bidder obligations affecting eligibility, validity, compliance, response, scoring, technical/service performance, proof, project commitments, or contractual performance are in scope.',
    '- Buyer-only administration, internal evaluation procedure, contacts/scheduling, background, and pure definitions remain out of scope unless they contain a bidder action or consequence.',
    '- Scoring-only criteria remain excluded; bidder-facing conformity/invalidity obligations inside a scoring-labelled container are retained by the same deterministic paragraph rule.',
    '- Source authority remains the frozen Tender source and backend-owned parser/chunk identity. No semantic labels or Gold answers are changed.',
    '',
    `Core6 tenders reconstructed: ${regression.tender_count}`,
    `Provider calls: ${regression.provider_calls}`,
    `Production DB writes: ${regression.production_db_writes}`,
    ''
  ];
  for (const row of regression.rows) lines.push(`- ${row.tender_id}: ${row.scope_character_count} chars, ${row.scope_chunk_count} reconstructed chunks, source ${row.source_sha256}`);
  fs.writeFileSync(OUT_SCOPE, `${lines.join('\n')}\n`);
}

function buildCheckpoint({ anchorArtifact, supportRows, visibilityArtifact, plan, regression }) {
  const nonConflict = supportRows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED');
  const supportSpans = nonConflict.flatMap((row) => row.minimum_support_spans);
  const visibility = nonConflict.flatMap((row) => row.minimum_support_spans.map((span) => span.visibility));
  const counts = Object.fromEntries(['SOURCE_IN_SCOPE', 'SOURCE_IN_PARSE_CHUNK', 'SOURCE_IN_PROVIDER_INPUT', 'CROSS_CHUNK_SEMANTIC_SPLIT', 'SOURCE_SCOPE_LOSS', 'PAYLOAD_COVERAGE_LOSS'].map((status) => [status, visibility.filter((item) => item.status === status).length]));
  const providerVisibleRows = nonConflict.filter((row) => row.minimum_support_spans.length > 0 && row.minimum_support_spans.every((span) => span.visibility.status === 'SOURCE_IN_PROVIDER_INPUT')).length;
  const checkpoint = {
    artifact_type: 'V43_P0_BADCASE_44_V6_3_CHECKPOINT',
    final_status: providerVisibleRows === 43 && counts.CROSS_CHUNK_SEMANTIC_SPLIT === 0 && counts.SOURCE_SCOPE_LOSS === 0 && counts.PAYLOAD_COVERAGE_LOSS === 0
      ? 'READY_FOR_CORRECTED_REPLAY'
      : 'BLOCKED_AUTHORITATIVE_SOURCE_TO_PROVIDER_INPUT_VISIBILITY',
    scope_contract: 'CANONICAL_REQUIREMENT_SCOPE_V1_1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    anchor_case_count: anchorArtifact.rows.length,
    non_conflict_case_count: nonConflict.length,
    minimum_support_span_count: supportSpans.length,
    old_v6_2_visibility_distribution: (() => {
      if (!fs.existsSync(OLD_VISIBILITY_PATH)) return {};
      const old = readJson(OLD_VISIBILITY_PATH);
      return (old.rows || []).flatMap((row) => row.anchors || []).reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    })(),
    corrected_visibility_distribution: counts,
    corrected_provider_visible_case_count: providerVisibleRows,
    source_scope_losses_repaired: 0,
    payload_coverage_losses_repaired: 0,
    cross_chunk_repairs: 0,
    core6_regression: regression.rows.map((row) => ({ tender_id: row.tender_id, character_delta: row.character_delta, chunk_delta: row.chunk_delta, scope_chunk_count: row.scope_chunk_count })),
    corrected_replay_plan_status: plan.authoritative_source_to_provider_input_visible,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    production_semantic_changes: 0,
    source_truth_mutations: 0,
    gold_labels_reinterpreted: false,
    tests: { provider_calls: 0, production_db_writes: 0, gold_mutations: 0 },
    block_reason: providerVisibleRows === 43 ? null : 'One or more approved minimum support spans are not in the current reconstructed provider input.'
  };
  return checkpoint;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = readJson(MANIFEST_PATH);
  const anchorArtifact = readJson(ANCHOR_PATH);
  if (sha256File(path.join(ROOT, 'docs', 'eval', 'p0-recall', 'GPT_SOURCE_TRUTH_P0_CORE6_V1.json')) !== SOURCE_TRUTH_SHA) throw new Error('Frozen Source Truth SHA mismatch');
  if (anchorArtifact.rows?.length !== 44) throw new Error('Expected 44 source-anchor rows');
  const states = await loadStates(manifest);
  const supportRows = anchorArtifact.rows.map((row) => {
    const state = states.get(row.tender_id);
    const spans = (row.anchors || []).map((anchor, index) => {
      const span = materializeMinimumSpan(state, row, anchor, index);
      return { ...span, visibility: visibilityForSpan(state, span) };
    });
    return { atom_id: row.atom_id, tender_id: row.tender_id, anchor_decision: row.anchor_decision, source_anchor_authority: row.source_anchor_authority, minimum_support_spans: spans };
  });
  const visibilityRows = supportRows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED').map((row) => ({
    atom_id: row.atom_id,
    tender_id: row.tender_id,
    replay_eligible: true,
    minimum_support_spans: row.minimum_support_spans.map((span) => ({
      support_span_id: span.support_span_id,
      source_document_sha256: span.source_document_sha256,
      page: span.page,
      paragraph_start: span.paragraph_start,
      paragraph_end: span.paragraph_end,
      raw_source_text_sha256: span.raw_source_text_sha256,
      support_method: span.support_method,
      status: span.visibility.status,
      first_loss_stage: span.visibility.first_loss_stage,
      provider_input_visible: span.visibility.provider_input_visible,
      source_in_scope: span.visibility.source_in_scope,
      source_in_parse_chunk: span.visibility.source_in_parse_chunk,
      cross_chunk_semantic_split: span.visibility.cross_chunk_semantic_split,
      parse_chunks: span.visibility.parse_chunks
    }))
  }));
  const visibilityArtifact = {
    artifact_type: 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_3',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    target_case_count: visibilityRows.length,
    rows: visibilityRows,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    semantic_root_cause: 'PENDING_GPT'
  };
  const chunks = new Map();
  for (const row of visibilityRows) for (const span of row.minimum_support_spans) for (const chunk of span.parse_chunks || []) {
    if (!chunks.has(chunk.chunk_id)) chunks.set(chunk.chunk_id, { ...chunk, atom_ids: new Set() });
    chunks.get(chunk.chunk_id).atom_ids.add(row.atom_id);
  }
  const planGate = visibilityRows.length === 43 && visibilityRows.every((row) => row.minimum_support_spans.length > 0 && row.minimum_support_spans.every((span) => span.status === 'SOURCE_IN_PROVIDER_INPUT' && !span.cross_chunk_semantic_split));
  const plan = {
    artifact_type: 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    replay_eligible_case_count: visibilityRows.length,
    authoritative_source_to_provider_input_visible: planGate ? 'PASS' : 'FAIL',
    cross_chunk_semantic_split_count: visibilityRows.flatMap((row) => row.minimum_support_spans).filter((span) => span.cross_chunk_semantic_split).length,
    source_scope_loss_count: visibilityRows.flatMap((row) => row.minimum_support_spans).filter((span) => span.status === 'SOURCE_SCOPE_LOSS').length,
    payload_coverage_loss_count: visibilityRows.flatMap((row) => row.minimum_support_spans).filter((span) => span.status === 'PAYLOAD_COVERAGE_LOSS').length,
    unique_production_provider_chunks: [...chunks.values()].map((chunk) => ({ ...chunk, atom_ids: [...chunk.atom_ids].sort() })),
    unique_production_provider_chunk_count: chunks.size,
    cases_per_chunk: [...chunks.values()].map((chunk) => ({ chunk_id: chunk.chunk_id, atom_ids: [...chunk.atom_ids].sort(), count: chunk.atom_ids.size })),
    multi_span_cases: supportRows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED' && row.minimum_support_spans.length > 1).map((row) => row.atom_id),
    provider_call_count_if_gate_pass: planGate ? chunks.size : 0,
    provider_replay_authorized: planGate,
    provider_calls_executed: 0,
    semantic_root_cause: 'PENDING_GPT'
  };
  const regression = buildScopeRegression(states, manifest);
  const checkpoint = buildCheckpoint({ anchorArtifact, supportRows, visibilityArtifact, plan, regression });
  fs.writeFileSync(OUT_SUPPORT, `${JSON.stringify({ artifact_type: 'V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3', source_truth_sha256: SOURCE_TRUTH_SHA, target_case_count: 43, rows: supportRows, semantic_adjudication_reinterpreted: false, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2)}\n`);
  fs.writeFileSync(OUT_VISIBILITY, `${JSON.stringify(visibilityArtifact, null, 2)}\n`);
  fs.writeFileSync(OUT_PLAN, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(OUT_REGRESSION, `${JSON.stringify(regression, null, 2)}\n`);
  writeScopeDoc(regression);
  fs.writeFileSync(OUT_CHECKPOINT_JSON, `${JSON.stringify(checkpoint, null, 2)}\n`);
  const lines = [
    '# V43 P0 BadCase 44 Scope v1.1 / V6.3 Checkpoint', '',
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- SOURCE_TRUTH_SHA256: ${SOURCE_TRUTH_SHA}`,
    `- NON_CONFLICT_CASES: ${checkpoint.non_conflict_case_count}`,
    `- MINIMUM_SUPPORT_SPANS: ${checkpoint.minimum_support_span_count}`,
    `- OLD_V6_2_VISIBILITY: ${JSON.stringify(checkpoint.old_v6_2_visibility_distribution)}`,
    `- CORRECTED_VISIBILITY: ${JSON.stringify(checkpoint.corrected_visibility_distribution)}`,
    `- PROVIDER_VISIBLE_CASES: ${checkpoint.corrected_provider_visible_case_count}`,
    `- CORRECTED_REPLAY_PLAN: ${plan.authoritative_source_to_provider_input_visible}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- PROMPT_CHANGES: ${checkpoint.prompt_changes}`,
    `- SCHEMA_CHANGES: ${checkpoint.schema_changes}`,
    `- BLOCK_REASON: ${checkpoint.block_reason || 'NONE'}`,
    '', 'Scope repair is deterministic and offline; semantic labels remain pending GPT.'
  ];
  fs.writeFileSync(OUT_CHECKPOINT, `${lines.join('\n')}\n`);
  console.log(JSON.stringify({ support: path.relative(ROOT, OUT_SUPPORT), visibility: path.relative(ROOT, OUT_VISIBILITY), plan: path.relative(ROOT, OUT_PLAN), regression: path.relative(ROOT, OUT_REGRESSION), checkpoint: path.relative(ROOT, OUT_CHECKPOINT), final_status: checkpoint.final_status, corrected_visibility: checkpoint.corrected_visibility_distribution, provider_visible_cases: checkpoint.corrected_provider_visible_case_count, provider_calls: 0 }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
}

export {
  annotateParagraphs,
  loadStates,
  readJson,
  sha256,
  sha256File,
  TENDER_ORDER,
  MANIFEST_PATH,
  materializeMinimumSpan,
  visibilityForSpan,
  buildScopeRegression,
  deriveNegativeLeakage
};
