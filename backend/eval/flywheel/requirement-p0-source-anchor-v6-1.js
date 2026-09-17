import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import { combineRequirementExtractionSections } from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';
import {
  buildRequirementExtractionPayload,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { normalizeLexical, contains } from './requirement-p0-textual-input-coverage-v6.js';

const { Pool } = pg;
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const SOURCE_TRUTH_RENDERING_PATH = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-semantic-reconstruction', 'P0_487_GPT_REVIEW_BUNDLE.jsonl');
const SEMANTIC_V2_PATH = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-semantic-adjudication-v2', 'V43_P0_487_SEMANTIC_ADJUDICATION_V2.json');
const SOURCE_FIDELITY_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'V43_P0_SOURCE_FIDELITY_EVIDENCE.json');
const V2_REPLAY_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json');
const CORE6_MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const REPORT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_ARTIFACT_CENSUS_V6_1.json');
const ANCHOR_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_V6_1.json');
const GPT_PACKET_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_ANCHOR_GPT_PACKET_V6_1.json');
const REPLAY_PLAN_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_CORRECTED_REPLAY_PLAN_V6_1.json');
const CHECKPOINT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_ANCHOR_V6_1_CHECKPOINT.md');
const CHECKPOINT_JSON_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_SOURCE_ANCHOR_V6_1_CHECKPOINT.json');

const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const ALLOWED_AUTHORITY = new Set([
  'HISTORICAL_EXACT',
  'DETERMINISTIC_VERBATIM',
  'GPT_SEMANTIC_ANCHOR_REQUIRED',
  'SOURCE_CONFLICT',
  'UNRESOLVED'
]);
const ALLOWED_CANDIDATE_ORIGINS = new Set([
  'ORIGINAL_SOURCE_TRUTH_PACKET',
  'FROZEN_SOURCE_SNAPSHOT',
  'HISTORICAL_ADJUDICATION',
  'CURRENT_TENDER_EXTRACTION'
]);
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function stripSha(value) { return String(value || '').replace(/^sha256:/i, ''); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function textTokens(value) {
  const normalized = normalizeLexical(value);
  if (!normalized) return [];
  const width = normalized.length >= 2 ? 2 : 1;
  const result = [];
  for (let i = 0; i + width <= normalized.length; i += 1) result.push(normalized.slice(i, i + width));
  return [...new Set(result)];
}
function overlapScore(query, candidate) {
  const q = new Set(textTokens(query));
  const c = new Set(textTokens(candidate));
  if (!q.size || !c.size) return { score: 0, overlap: 0, ratio: 0 };
  let overlap = 0;
  for (const token of q) if (c.has(token)) overlap += 1;
  return { score: overlap / q.size, overlap, ratio: overlap / q.size };
}
function sourceIdentity({ source_document_sha256, page, paragraph_start, paragraph_end, source_start_offset, source_end_offset, raw_source_text_sha256 }) {
  return sha256(JSON.stringify({ source_document_sha256, page, paragraph_start, paragraph_end, source_start_offset, source_end_offset, raw_source_text_sha256 }));
}
function rawCandidateIdentity(anchor) {
  return `SRC-CAND-${sha256(`${anchor.source_document_sha256}|${anchor.page}|${anchor.paragraph_start}|${anchor.paragraph_end}|${anchor.raw_source_text_sha256}`).slice(0, 16)}`;
}
function sourceRefOnlyCannotEstablishAnchor({ raw_source_text, source_refs }) {
  const refsPresent = Array.isArray(source_refs) ? source_refs.length > 0 : nonEmpty(source_refs);
  return !nonEmpty(raw_source_text) && refsPresent;
}

function productionScope(extraction) {
  const analysis = classifyTenderSections(extraction);
  const scope = analysis.technicalSection
    ? combineRequirementExtractionSections(analysis.sections, { includeNonScoringSections: true })
      || analysis.requirementExtractionSections?.find((section) => section.section_key === 'technical_requirements')
      || analysis.technicalSection
    : null;
  return { analysis, scope };
}

function annotateParagraphs(extraction) {
  let cursor = 0;
  return extraction.paragraphs.map((paragraph) => {
    let start = extraction.text.indexOf(paragraph.text, cursor);
    if (start < 0) start = cursor;
    const end = start + paragraph.text.length;
    cursor = end;
    return { ...paragraph, source_start_offset: start, source_end_offset: end };
  });
}

function sourceWindow(state, startIndex, endIndex) {
  const paragraphs = state.paragraphs.slice(startIndex, endIndex + 1);
  const first = paragraphs[0];
  const last = paragraphs[paragraphs.length - 1];
  const raw = paragraphs.map((paragraph) => paragraph.text).join('\n');
  return {
    source_document_sha256: state.source_sha256,
    page: first.page,
    paragraph_start: first.paragraph,
    paragraph_end: last.paragraph,
    source_start_offset: first.source_start_offset,
    source_end_offset: last.source_end_offset,
    raw_source_text: raw,
    raw_source_text_sha256: sha256(raw),
    source_page_start: first.page,
    source_page_end: last.page
  };
}

function findContainingWindows(state, hint, pageHint, { maxWindows = 3, maxParagraphs = 10 } = {}) {
  if (!nonEmpty(hint)) return [];
  const target = normalizeLexical(hint);
  const pageCandidates = state.paragraphs
    .map((paragraph, index) => ({ paragraph, index, distance: Math.abs(Number(paragraph.page || 0) - Number(pageHint || paragraph.page || 0)) }))
    .filter(({ distance }) => distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  const windows = [];
  for (const start of pageCandidates.map((entry) => entry.index)) {
    let joined = '';
    for (let end = start; end < Math.min(state.paragraphs.length, start + maxParagraphs); end += 1) {
      joined += state.paragraphs[end].text;
      if (normalizeLexical(joined).includes(target)) {
        const begin = Math.max(0, start - 1);
        const finish = Math.min(state.paragraphs.length - 1, end + 1);
        windows.push({ ...sourceWindow(state, begin, finish), match_type: 'NORMALIZED_HINT_CONTAINMENT', hint });
        break;
      }
      if (normalizeLexical(joined).length > target.length * 3 + 1000) break;
    }
    if (windows.length >= maxWindows) break;
  }
  const unique = new Map(windows.map((window) => [window.raw_source_text_sha256, window]));
  return [...unique.values()];
}

function rankedPageWindows(state, query, pageHint, { maxWindows = 5, radius = 3 } = {}) {
  const candidates = [];
  state.paragraphs.forEach((paragraph, index) => {
    const distance = Math.abs(Number(paragraph.page || 0) - Number(pageHint || paragraph.page || 0));
    if (distance > radius) return;
    const score = overlapScore(query, paragraph.text);
    if (score.overlap < 2) return;
    const begin = Math.max(0, index - 2);
    const finish = Math.min(state.paragraphs.length - 1, index + 2);
    const window = sourceWindow(state, begin, finish);
    candidates.push({ ...window, match_type: 'PAGE_LOCAL_TOKEN_OVERLAP', match_score: score.score, token_overlap: score.overlap, page_distance: distance });
  });
  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => b.match_score - a.match_score || a.page_distance - b.page_distance || a.paragraph_start - b.paragraph_start)) {
    if (!unique.has(candidate.raw_source_text_sha256)) unique.set(candidate.raw_source_text_sha256, candidate);
    if (unique.size >= maxWindows) break;
  }
  return [...unique.values()];
}

function collectHistoricalHints(atom, fidelityRow, v2Row, renderedRow) {
  const hints = [];
  for (const evidence of fidelityRow?.production_lineage_evidence || []) {
    for (const field of ['source_text', 'source_excerpt']) {
      if (nonEmpty(evidence[field])) hints.push({ text: evidence[field], origin: 'HISTORICAL_ADJUDICATION', artifact: 'V43_P0_SOURCE_FIDELITY_EVIDENCE.json', source_refs: evidence.source_refs || [], page: evidence.source_page_start || evidence.source_page || atom.page, source_hash: evidence.source_hash || null });
    }
  }
  for (const row of [v2Row, renderedRow]) {
    const truth = row?.source_truth || null;
    if (!truth) continue;
    for (const field of ['source_excerpt', 'source_text']) {
      if (nonEmpty(truth[field]) && normalizeLexical(truth[field]) !== normalizeLexical(atom.atomic_requirement)) {
        hints.push({ text: truth[field], origin: 'HISTORICAL_ADJUDICATION', artifact: row === v2Row ? 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json' : 'P0_487_GPT_REVIEW_BUNDLE.jsonl', source_refs: truth.source_refs || [], page: truth.page || atom.page, source_hash: truth.source_hash || null });
      }
    }
  }
  const unique = new Map();
  for (const hint of hints) {
    const key = `${normalizeLexical(hint.text)}|${hint.page}|${hint.origin}`;
    if (!unique.has(key)) unique.set(key, hint);
  }
  return [...unique.values()];
}

function makeAnchor(state, window, candidateOrigin, evidence = {}) {
  const base = { ...window };
  const identity = sourceIdentity(base);
  return {
    ...base,
    candidate_origin: candidateOrigin,
    mechanical_identity_evidence: {
      source_document_sha256: state.source_sha256,
      tender_id: state.tender_id,
      source_sha256_matches_frozen_tender: state.source_sha256_matches_frozen_tender,
      source_window_identity: identity,
      source_page_verified: Number(base.page) >= 1,
      paragraph_metadata_present: Number.isInteger(base.paragraph_start) && Number.isInteger(base.paragraph_end),
      offsets_present: Number.isInteger(base.source_start_offset) && Number.isInteger(base.source_end_offset),
      raw_text_hash_present: nonEmpty(base.raw_source_text_sha256),
      ...evidence
    }
  };
}

function classifyAuthority(atom, anchors, historicalExactCount) {
  if (atom.atom_id === 'FAST-WATER-01-P0-0072') return 'SOURCE_CONFLICT';
  if (!anchors.length) return 'UNRESOLVED';
  if (historicalExactCount > 0) return 'HISTORICAL_EXACT';
  if (atom.source_mode === 'VERBATIM_LOCAL_SOURCE_EXCERPT' && anchors.length === 1 && anchors[0].mechanical_identity_evidence.verbatim_unique_alignment === true) return 'DETERMINISTIC_VERBATIM';
  return 'GPT_SEMANTIC_ANCHOR_REQUIRED';
}

function mapAnchorToProduction(state, anchor) {
  const target = normalizeLexical(anchor.raw_source_text);
  const directChunks = state.chunks.filter((chunk) => normalizeLexical(chunk.text).includes(target));
  if (directChunks.length) {
    const chunkRows = directChunks.map((chunk) => ({
      chunk_id: chunk.id,
      chunk_number: chunk.chunk_number,
      content_sha256: chunk.content_sha256,
      provider_payload_chunk_text_sha256: chunk.provider_payload_chunk_text_sha256,
      source_start_page: chunk.source_start_page,
      source_end_page: chunk.source_end_page
    }));
    return { status: 'PRODUCTION_INPUT_VISIBLE', parse_chunks: chunkRows, cross_chunk_semantic_split: false, provider_input_visible: directChunks.some((chunk) => normalizeLexical(chunk.provider_payload_chunk_text).includes(target)) };
  }
  for (let start = 0; start < state.chunks.length; start += 1) {
    let joined = '';
    for (let end = start; end < state.chunks.length; end += 1) {
      joined += state.chunks[end].text;
      if (normalizeLexical(joined).includes(target)) {
        const selected = state.chunks.slice(start, end + 1);
        return {
          status: 'CROSS_CHUNK_SEMANTIC_SPLIT',
          parse_chunks: selected.map((chunk) => ({ chunk_id: chunk.id, chunk_number: chunk.chunk_number, content_sha256: chunk.content_sha256, provider_payload_chunk_text_sha256: chunk.provider_payload_chunk_text_sha256 })),
          cross_chunk_semantic_split: end > start,
          provider_input_visible: selected.some((chunk) => normalizeLexical(chunk.provider_payload_chunk_text).includes(target))
        };
      }
      if (normalizeLexical(joined).length > target.length * 3 + 1000) break;
    }
  }
  const scopeContains = normalizeLexical(state.scope.content_text).includes(target);
  return { status: scopeContains ? 'PAYLOAD_COVERAGE_LOSS' : 'SOURCE_SCOPE_LOSS', parse_chunks: [], cross_chunk_semantic_split: false, provider_input_visible: false };
}

function scanTextArtifacts(roots, targetIds) {
  const extensions = new Set(['.json', '.jsonl', '.md', '.txt', '.csv']);
  const artifacts = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(filePath); continue; }
      if (!extensions.has(path.extname(entry.name).toLowerCase())) continue;
      let content;
      try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }
      const atomIds = [...targetIds].filter((id) => content.includes(id));
      if (!atomIds.length) continue;
      let parsed = null;
      if (filePath.endsWith('.json')) { try { parsed = JSON.parse(content); } catch { parsed = null; } }
      const artifactType = parsed?.artifact_type || parsed?.artifactType || (filePath.includes('review-packet') ? 'REVIEW_PACKET' : 'TEXT_ARTIFACT');
      artifacts.push({
        artifact_path: path.relative(ROOT, filePath).replace(/\\/g, '/'),
        artifact_sha256: sha256(content),
        artifact_bytes: Buffer.byteLength(content),
        artifact_type: artifactType,
        atom_coverage_count: atomIds.length,
        atom_ids: atomIds,
        contains_raw_text: /raw_source_text|source_text|source_excerpt|source_context_text/i.test(content),
        contains_page: /"page"|source_page/i.test(content),
        contains_paragraph: /paragraph/i.test(content),
        contains_offsets: /offset/i.test(content),
        contains_source_refs: /source_refs|source_ref/i.test(content),
        contains_tender_sha: /source_document_sha256|source_sha256|source_truth_sha256/i.test(content),
        authority_role: filePath.includes('p0-semantic-reconstruction') || filePath.includes('p0-recall') ? 'SOURCE_TRUTH_OR_SOURCE_FIDELITY_RELATED' : 'EVAL_HISTORY_OR_REPLAY_OBSERVABILITY'
      });
    }
  }
  for (const root of roots) {
    if (fs.existsSync(root)) walk(root);
  }
  return artifacts.sort((a, b) => a.artifact_path.localeCompare(b.artifact_path));
}

async function loadProductionStates(manifest) {
  dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
  dotenv.config({ path: path.join(ROOT, '.env') });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const states = new Map();
  try {
    for (const tender of TENDER_ORDER) {
      const expected = (manifest.tenders || []).find((item) => item.tender === tender);
      if (!expected) throw new Error(`Missing CORE6 manifest entry: ${tender}`);
      const sourceFile = path.join(ROOT, 'backend', 'eval', 'tender-benchmark-v1', 'sources', expected.source_file);
      if (!fs.existsSync(sourceFile)) throw new Error(`Missing frozen Tender source: ${sourceFile}`);
      const sourceSha = sha256File(sourceFile);
      if (sourceSha !== expected.source_sha256) throw new Error(`Tender SHA mismatch: ${tender}`);
      const extraction = await extractTenderText({ fileName: expected.source_file, mimeType: 'application/pdf', buffer: fs.readFileSync(sourceFile) });
      const { analysis, scope } = productionScope(extraction);
      if (!scope) throw new Error(`Missing production requirement scope: ${tender}`);
      const annotated = annotateParagraphs(extraction);
      const budget = resolveRequirementChunkBudget(process.env);
      const chunks = chunkExtractedText({ text: scope.content_text, paragraphs: scope.paragraphs, ...budget });
      const persisted = (await pool.query(
        `SELECT id,chunk_number,character_count,content_sha256,source_start_page,source_end_page,source_start_paragraph,source_end_paragraph
         FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number`,
        [expected.parse_job_id]
      )).rows;
      if (persisted.length !== chunks.length) throw new Error(`Production chunk count mismatch: ${tender}`);
      const materialized = chunks.map((chunk, index) => {
        const row = persisted[index];
        const contentSha = sha256(chunk.text);
        if (row.content_sha256 !== contentSha || Number(row.character_count) !== chunk.character_count) throw new Error(`Production chunk hash mismatch: ${tender}#${row.chunk_number}`);
        const providerText = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
        const payload = buildRequirementExtractionPayload({ projectName: expected.source_file, sectionName: scope.title, chunkIndex: row.chunk_number, chunkCount: chunks.length, chunkText: providerText });
        return { ...chunk, id: row.id, chunk_number: row.chunk_number, content_sha256: row.content_sha256, source_start_page: row.source_start_page, source_end_page: row.source_end_page, source_start_paragraph: row.source_start_paragraph, source_end_paragraph: row.source_end_paragraph, provider_payload_chunk_text: payload.chunk_text, provider_payload_chunk_text_sha256: sha256(payload.chunk_text) };
      });
      states.set(tender, { tender_id: tender, source_file: expected.source_file, source_sha256: sourceSha, source_sha256_matches_frozen_tender: true, extracted_text: extraction.text, paragraphs: annotated, analysis, scope, chunks: materialized });
    }
  } finally {
    await pool.end();
  }
  return states;
}

function buildAnchorForAtom(atom, semanticRow, state, fidelityRow, v2Row, renderedRow) {
  const historicalHints = collectHistoricalHints(atom, fidelityRow, v2Row, renderedRow);
  const windows = [];
  let historicalExactCount = 0;
  for (const hint of historicalHints) {
    const matches = findContainingWindows(state, hint.text, hint.page, { maxWindows: 2 });
    for (const match of matches) {
      const exactHash = hint.source_hash && stripSha(hint.source_hash) === match.raw_source_text_sha256;
      if (exactHash) historicalExactCount += 1;
      windows.push(makeAnchor(state, match, hint.origin, { hint_artifact: hint.artifact, hint_source_refs: hint.source_refs, hint_source_hash: hint.source_hash, hint_match_type: match.match_type, historical_exact_hash_match: exactHash }));
    }
  }
  for (const match of rankedPageWindows(state, atom.atomic_requirement, atom.page, { maxWindows: 5 })) {
    if (normalizeLexical(match.raw_source_text) === normalizeLexical(atom.atomic_requirement)) continue;
    windows.push(makeAnchor(state, match, 'CURRENT_TENDER_EXTRACTION', { hint_match_type: match.match_type, match_score: match.match_score, token_overlap: match.token_overlap, page_distance: match.page_distance }));
  }
  const unique = new Map(windows.map((window) => [rawCandidateIdentity(window), window]));
  const selected = [...unique.values()].slice(0, 5).map((window) => {
    const verbatimUniqueAlignment = atom.source_mode === 'VERBATIM_LOCAL_SOURCE_EXCERPT'
      && contains(window.raw_source_text, atom.atomic_requirement).present;
    return { ...window, mechanical_identity_evidence: { ...window.mechanical_identity_evidence, verbatim_unique_alignment: verbatimUniqueAlignment } };
  });
  const authority = classifyAuthority(atom, selected, historicalExactCount);
  const sourceCondition = semanticRow?.source_internal_conflict ? 'SOURCE_INTERNAL_CONFLICT' : 'NONE_OBSERVED';
  const productionVisibility = selected.map((anchor) => ({ source_candidate_id: rawCandidateIdentity(anchor), ...mapAnchorToProduction(state, anchor) }));
  return { authority, sourceCondition, anchors: selected, productionVisibility, historicalHintCount: historicalHints.length, historicalExactCount };
}

function buildReplayPlan(anchorRows) {
  const authoritative = anchorRows.filter((row) => row.anchor_authority === 'HISTORICAL_EXACT' || row.anchor_authority === 'DETERMINISTIC_VERBATIM');
  const ready = anchorRows.filter((row) => row.anchor_authority === 'HISTORICAL_EXACT' || row.anchor_authority === 'DETERMINISTIC_VERBATIM');
  const waiting = anchorRows.filter((row) => row.anchor_authority === 'GPT_SEMANTIC_ANCHOR_REQUIRED');
  const conflict = anchorRows.filter((row) => row.anchor_authority === 'SOURCE_CONFLICT');
  const unresolved = anchorRows.filter((row) => row.anchor_authority === 'UNRESOLVED');
  const chunkMap = new Map();
  for (const row of authoritative) {
    for (const visibility of row.production_input_visibility || []) {
      for (const chunk of visibility.parse_chunks || []) {
        if (!chunkMap.has(chunk.chunk_id)) chunkMap.set(chunk.chunk_id, []);
        chunkMap.get(chunk.chunk_id).push(row.atom_id);
      }
    }
  }
  return {
    artifact_type: 'V43_P0_BADCASE_44_CORRECTED_REPLAY_PLAN_V6_1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    target_case_count: anchorRows.length,
    anchor_authoritative_case_count: authoritative.length,
    unique_provider_chunks: [...chunkMap.entries()].map(([chunk_id, atom_ids]) => ({ chunk_id, atom_ids: [...new Set(atom_ids)] })),
    cases_per_chunk: [...chunkMap.entries()].map(([chunk_id, atom_ids]) => ({ chunk_id, atom_ids: [...new Set(atom_ids)], count: new Set(atom_ids).size })),
    multi_span_cases: anchorRows.filter((row) => row.anchors.length > 1).map((row) => row.atom_id),
    expected_provider_call_count: authoritative.length === anchorRows.length ? chunkMap.size : 0,
    partitions: { READY_FOR_REPLAY: ready.map((row) => row.atom_id), WAITING_GPT_SOURCE_ANCHOR: waiting.map((row) => row.atom_id), SOURCE_CONFLICT: conflict.map((row) => row.atom_id), UNRESOLVED: unresolved.map((row) => row.atom_id) },
    provider_calls_authorized: authoritative.length === anchorRows.length && unresolved.length === 0 && waiting.length === 0 && conflict.length === 0
  };
}

function writeCheckpoint(checkpoint) {
  const lines = [
    '# V43 P0 BadCase 44 Source Anchor V6.1 Checkpoint',
    '',
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- SOURCE_TRUTH_SHA256: ${checkpoint.source_truth_sha256}`,
    `- TOTAL_CASES: ${checkpoint.total_cases}`,
    `- SOURCE_MODE_DISTRIBUTION: ${JSON.stringify(checkpoint.source_mode_distribution)}`,
    `- AUTHORITY_DISTRIBUTION: ${JSON.stringify(checkpoint.authority_distribution)}`,
    `- MULTI_SPAN_CASE_COUNT: ${checkpoint.multi_span_case_count}`,
    `- UNIQUE_RAW_SOURCE_CANDIDATE_BLOCKS: ${checkpoint.unique_raw_source_candidate_blocks}`,
    `- MECHANICALLY_AUTHORITATIVE_PRODUCTION_INPUT_VISIBLE: ${checkpoint.mechanically_authoritative_production_input_visible}`,
    `- CORRECTED_UNIQUE_REPLAY_CHUNKS: ${checkpoint.corrected_unique_replay_chunks}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- LLM_CALLS: ${checkpoint.llm_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- PROMPT_CHANGES: ${checkpoint.prompt_changes}`,
    `- SCHEMA_CHANGES: ${checkpoint.schema_changes}`,
    `- PRODUCTION_SEMANTIC_CHANGES: ${checkpoint.production_semantic_changes}`,
    `- V4_STATUS: ${checkpoint.historical_diagnostic_statuses.V4}`,
    `- V5_STATUS: ${checkpoint.historical_diagnostic_statuses.V5}`,
    `- V6_STATUS: ${checkpoint.historical_diagnostic_statuses.V6}`,
    '',
    'Mechanical source-anchor preparation only. Frozen semantic labels were not reinterpreted.'
  ];
  fs.writeFileSync(CHECKPOINT_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sourceTruth = readJson(SOURCE_TRUTH_PATH);
  const sourceTruthAtoms = sourceTruth.atoms || sourceTruth;
  const semantic = readJson(SEMANTIC_V2_PATH);
  const semanticRows = semantic.rows;
  const frozenRows = semanticRows.filter((row) => row.semantic_label !== 'MATCH');
  if (frozenRows.length !== 44) throw new Error(`Expected 44 unsafe rows, got ${frozenRows.length}`);
  if (sha256File(SOURCE_TRUTH_PATH) !== SOURCE_TRUTH_SHA) throw new Error('Frozen Source Truth SHA mismatch');
  const sourceTruthById = new Map(sourceTruthAtoms.map((row) => [row.atom_id, row]));
  const semanticById = new Map(semanticRows.map((row) => [row.atom_id, row]));
  const renderedRows = readJsonl(SOURCE_TRUTH_RENDERING_PATH);
  const renderedById = new Map(renderedRows.map((row) => [row.atom_id, row]));
  const fidelity = readJson(SOURCE_FIDELITY_PATH);
  const fidelityById = new Map((fidelity.atoms || []).map((row) => [row.atom_id, row]));
  const v2Replay = readJson(V2_REPLAY_PATH);
  const v2ById = new Map((v2Replay.rows || []).map((row) => [row.atom_id, row]));
  const targetIds = new Set(frozenRows.map((row) => row.atom_id));
  const census = scanTextArtifacts([path.join(ROOT, 'docs', 'eval'), path.join(ROOT, 'backend', 'eval')], targetIds);
  const manifest = readJson(CORE6_MANIFEST_PATH);
  const states = await loadProductionStates(manifest);
  const anchorRows = [];
  for (const semanticRow of frozenRows) {
    const atom = sourceTruthById.get(semanticRow.atom_id);
    if (!atom) throw new Error(`Missing Source Truth atom: ${semanticRow.atom_id}`);
    const state = states.get(atom.tender);
    if (!state) throw new Error(`Missing Tender state: ${atom.tender}`);
    const result = buildAnchorForAtom(atom, semanticRow, state, fidelityById.get(atom.atom_id), v2ById.get(atom.atom_id), renderedById.get(atom.atom_id));
    if (!ALLOWED_AUTHORITY.has(result.authority)) throw new Error(`Invalid anchor authority: ${result.authority}`);
    anchorRows.push({
      atom_id: atom.atom_id,
      tender_id: atom.tender,
      source_mode: atom.source_mode,
      frozen_semantic_label: semanticRow.semantic_label,
      atomic_requirement: atom.atomic_requirement,
      p0_basis: atom.p0_basis,
      family: atom.family,
      source_page: atom.page,
      anchor_authority: result.authority,
      source_condition: result.sourceCondition,
      historical_hint_count: result.historicalHintCount,
      historical_exact_count: result.historicalExactCount,
      anchors: result.anchors.map((anchor) => ({ ...anchor, source_candidate_id: rawCandidateIdentity(anchor) })),
      production_input_visibility: result.productionVisibility
    });
  }
  const anchorOrder = new Map(TENDER_ORDER.map((tender, index) => [tender, index]));
  anchorRows.sort((a, b) => (anchorOrder.get(a.tender_id) - anchorOrder.get(b.tender_id)) || a.atom_id.localeCompare(b.atom_id, undefined, { numeric: true }));
  const authorityDistribution = anchorRows.reduce((acc, row) => { acc[row.anchor_authority] = (acc[row.anchor_authority] || 0) + 1; return acc; }, {});
  const sourceModeDistribution = anchorRows.reduce((acc, row) => { acc[row.source_mode] = (acc[row.source_mode] || 0) + 1; return acc; }, {});
  const allCandidateBlocks = new Map();
  for (const row of anchorRows) for (const anchor of row.anchors) allCandidateBlocks.set(anchor.source_candidate_id, anchor);
  const gptRows = anchorRows.filter((row) => ['GPT_SEMANTIC_ANCHOR_REQUIRED', 'SOURCE_CONFLICT', 'UNRESOLVED'].includes(row.anchor_authority));
  const sharedBlocks = [...allCandidateBlocks.values()].reduce((acc, anchor) => { acc[anchor.source_candidate_id] = (acc[anchor.source_candidate_id] || 0) + 1; return acc; }, {});
  const replayPlan = buildReplayPlan(anchorRows);
  const checkpoint = {
    artifact_type: 'V43_P0_BADCASE_44_SOURCE_ANCHOR_V6_1_CHECKPOINT',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    total_cases: anchorRows.length,
    source_mode_distribution: sourceModeDistribution,
    authority_distribution: authorityDistribution,
    multi_span_case_count: anchorRows.filter((row) => row.anchors.length > 1).length,
    unique_raw_source_candidate_blocks: allCandidateBlocks.size,
    multi_atom_shared_blocks: Object.values(sharedBlocks).filter((count) => count > 1).length,
    mechanically_authoritative_production_input_visible: anchorRows.filter((row) => ['HISTORICAL_EXACT', 'DETERMINISTIC_VERBATIM'].includes(row.anchor_authority) && row.production_input_visibility.some((item) => item.status === 'PRODUCTION_INPUT_VISIBLE' && item.provider_input_visible)).length,
    corrected_unique_replay_chunks: replayPlan.unique_provider_chunks.length,
    historical_diagnostic_statuses: { V4: 'NON_AUTHORITATIVE_REPLAY_INPUT_DIAGNOSTIC', V5: 'NON_AUTHORITATIVE_COVERAGE_DIAGNOSTIC', V6: 'INVALID_LITERAL_SEMANTIC_ATOM_COVERAGE_METRIC' },
    production_run_id: manifest.run_id,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    production_semantic_changes: 0,
    source_truth_bytes_immutable: true,
    external_freeze_manifest_required: true,
    final_status: authorityDistribution.UNRESOLVED > 0 ? 'BLOCKED_P0_SOURCE_EVIDENCE_AUTHORITY_UNRESOLVED' : (authorityDistribution.GPT_SEMANTIC_ANCHOR_REQUIRED || authorityDistribution.SOURCE_CONFLICT ? 'READY_FOR_GPT_P0_44_SOURCE_ANCHOR_ADJUDICATION' : 'READY_FOR_GPT_P0_44_SEMANTIC_ROOT_CAUSE_ADJUDICATION_V6_1')
  };
  const censusArtifact = {
    artifact_type: 'V43_P0_BADCASE_44_SOURCE_ARTIFACT_CENSUS_V6_1',
    source_truth_id: sourceTruth.artifact_type || 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    target_case_count: 44,
    target_atom_ids: anchorRows.map((row) => row.atom_id),
    historical_artifacts: census,
    authority_policy: { preferred_order: ['ORIGINAL_FROZEN_SOURCE_SIDE_CENSUS', 'ORIGINAL_RAW_SOURCE_SNAPSHOT', 'HISTORICAL_BLIND_SOURCE_TRUTH_PACKET', 'HISTORICAL_ADJUDICATION_EVIDENCE', 'CURRENT_TENDER_EXTRACTION'], forbidden_as_source_authority: ['PRODUCTION_CANONICAL_REQUIREMENT', 'R3_LINEAGE', 'PRODUCTION_SOURCE_REFS'] },
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, prompt_changes: 0, schema_changes: 0, production_semantic_changes: 0 }
  };
  const gptPacket = {
    artifact_type: 'V43_P0_BADCASE_44_SOURCE_ANCHOR_GPT_PACKET_V6_1',
    blind_to_production_semantics: true,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    review_question: 'Which bounded raw Tender source span(s) support this already-frozen semantic atom?',
    cases: gptRows.map((row) => ({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      source_mode: row.source_mode,
      atomic_requirement: row.atomic_requirement,
      p0_basis: row.p0_basis,
      family: row.family,
      frozen_semantic_label: row.frozen_semantic_label,
      tender_source_page: row.source_page,
      source_condition: row.source_condition,
      raw_source_candidates: row.anchors.slice(0, 5).map((anchor) => ({ source_candidate_id: anchor.source_candidate_id, raw_source_text: anchor.raw_source_text, page: anchor.page, paragraph_start: anchor.paragraph_start, paragraph_end: anchor.paragraph_end, source_start_offset: anchor.source_start_offset, source_end_offset: anchor.source_end_offset, raw_source_text_sha256: anchor.raw_source_text_sha256, candidate_origin: anchor.candidate_origin, mechanical_identity_evidence: anchor.mechanical_identity_evidence })),
      mechanical_hints: { historical_hint_count: row.historical_hint_count, anchor_authority: row.anchor_authority }
    })),
    excluded_from_packet: { production_semantic_output: true, raw_provider_candidate: true, canonical_requirement: true, post_hoc_semantic_labels: true },
    provider_calls: 0,
    gold_mutations: 0
  };
  const anchorArtifact = {
    artifact_type: 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_V6_1',
    artifact_version: 'v6.1',
    source_truth_id: censusArtifact.source_truth_id,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: manifest.run_id,
    target_case_count: 44,
    authority_taxonomy: [...ALLOWED_AUTHORITY],
    candidate_origin_taxonomy: [...ALLOWED_CANDIDATE_ORIGINS],
    rows: anchorRows,
    source_truth_status_invariant: 'IMMUTABLE_ARTIFACT_STATUS + EXTERNAL_FREEZE_MANIFEST = CURRENT_AUTHORITY',
    semantic_adjudication_performed: false,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(censusArtifact, null, 2)}\n`);
  fs.writeFileSync(ANCHOR_PATH, `${JSON.stringify(anchorArtifact, null, 2)}\n`);
  fs.writeFileSync(GPT_PACKET_PATH, `${JSON.stringify(gptPacket, null, 2)}\n`);
  fs.writeFileSync(REPLAY_PLAN_PATH, `${JSON.stringify(replayPlan, null, 2)}\n`);
  writeCheckpoint(checkpoint);
  fs.writeFileSync(CHECKPOINT_JSON_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(JSON.stringify({
    census: path.relative(ROOT, REPORT_PATH),
    anchors: path.relative(ROOT, ANCHOR_PATH),
    gpt_packet: path.relative(ROOT, GPT_PACKET_PATH),
    replay_plan: path.relative(ROOT, REPLAY_PLAN_PATH),
    checkpoint: path.relative(ROOT, CHECKPOINT_PATH),
    total_cases: checkpoint.total_cases,
    source_mode_distribution: checkpoint.source_mode_distribution,
    authority_distribution: checkpoint.authority_distribution,
    multi_span_case_count: checkpoint.multi_span_case_count,
    unique_raw_source_candidate_blocks: checkpoint.unique_raw_source_candidate_blocks,
    production_input_visible: checkpoint.mechanically_authoritative_production_input_visible,
    corrected_unique_replay_chunks: checkpoint.corrected_unique_replay_chunks,
    provider_calls: 0,
    final_status: checkpoint.final_status
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
}

export {
  sourceIdentity,
  rawCandidateIdentity,
  sourceRefOnlyCannotEstablishAnchor,
  sourceWindow,
  findContainingWindows,
  rankedPageWindows,
  classifyAuthority,
  mapAnchorToProduction,
  collectHistoricalHints,
  buildAnchorForAtom,
  loadProductionStates
};
