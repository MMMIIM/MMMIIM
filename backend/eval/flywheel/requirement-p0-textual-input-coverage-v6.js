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

const { Pool } = pg;
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const SOURCE_RENDERING_PATH = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-semantic-reconstruction', 'P0_487_GPT_REVIEW_BUNDLE.jsonl');
const SOURCE_FIDELITY_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'V43_P0_SOURCE_FIDELITY_EVIDENCE.json');
const V2_PACKET_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
const V4_REPORT_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json');
const V4_CHECKPOINT_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT.json');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const OUT_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6.json');
const CHECKPOINT_JSON_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6_CHECKPOINT.md');

const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const HISTORICAL_15_IDS = new Set([
  'FAST-01-P0-0009', 'FAST-01-P0-0010', 'FAST-01-P0-0011', 'FAST-01-P0-0012', 'FAST-01-P0-0013',
  'FAST-01-P0-0014', 'FAST-01-P0-0015', 'FAST-01-P0-0016', 'FAST-01-P0-0017', 'FAST-01-P0-0018',
  'FAST-01-P0-0019', 'TB-003-P0-0006', 'TB-003-P0-0023', 'TB-003-P0-0024', 'TB-003-P0-0025'
]);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function stripSha(value) { return String(value || '').replace(/^sha256:/i, ''); }
function normalizeLexical(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
}
function contains(haystack, needle) {
  const h = normalizeLexical(haystack);
  const n = normalizeLexical(needle);
  return { present: Boolean(n) && h.includes(n), haystack_chars: h.length, needle_chars: n.length };
}
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }

/**
 * Resolve source evidence from the frozen Source Truth rendering only.
 * The atomic_requirement is deliberately not used as textual evidence.
 */
function resolveFrozenSourceEvidence(atom, renderedById, v2ById = new Map()) {
  const rendered = renderedById.get(atom.atom_id);
  const renderedTruth = rendered?.source_truth || null;
  const v2 = v2ById.get(atom.atom_id);
  const excerpt = nonEmpty(renderedTruth?.source_excerpt)
    ? renderedTruth.source_excerpt
    : (nonEmpty(atom.source_excerpt) ? atom.source_excerpt : null);
  const renderedHash = stripSha(renderedTruth?.source_truth_sha256);
  const page = renderedTruth?.page ?? atom.page ?? v2?.source_truth?.page ?? null;
  const paragraphStart = v2?.source_truth?.matched_paragraph_start ?? null;
  const paragraphEnd = v2?.source_truth?.matched_paragraph_end ?? null;
  return {
    source_excerpt: excerpt,
    source_excerpt_sha256: excerpt ? sha256(excerpt) : null,
    source_excerpt_chars: excerpt ? excerpt.length : 0,
    source_excerpt_status: excerpt ? 'AVAILABLE' : 'SOURCE_EXCERPT_NOT_PRESENT_IN_FROZEN_SOURCE_TRUTH',
    source_excerpt_origin: excerpt
      ? (renderedTruth?.source_excerpt ? 'FROZEN_SOURCE_TRUTH_RENDERING' : 'FROZEN_SOURCE_TRUTH_ATOM')
      : null,
    source_truth_rendering_sha256: renderedHash || null,
    page,
    paragraph_start: paragraphStart,
    paragraph_end: paragraphEnd,
    atomic_requirement_descriptor: atom.atomic_requirement || null
  };
}

function lineageForAtom(atomId, fidelityById) {
  const fidelity = fidelityById.get(atomId);
  return (fidelity?.production_lineage_evidence || []).map((evidence) => ({
    source_refs: Array.isArray(evidence.source_refs) ? [...evidence.source_refs] : [],
    source_chunk_id: evidence.source_chunk_id || null,
    source_hash: evidence.source_hash || null,
    source_start_offset: evidence.source_start_offset ?? null,
    source_end_offset: evidence.source_end_offset ?? null,
    source_page_start: evidence.source_page_start ?? evidence.source_page ?? null,
    source_page_end: evidence.source_page_end ?? evidence.source_page ?? null
  }));
}

function productionScope(extraction) {
  const analysis = classifyTenderSections(extraction);
  const scope = analysis.technicalSection
    ? combineRequirementExtractionSections(analysis.sections)
      || analysis.requirementExtractionSections?.find((section) => section.section_key === 'technical_requirements')
      || analysis.technicalSection
    : null;
  return { analysis, scope };
}

async function loadProductionStates(pool, manifest) {
  const manifestTenders = new Map((manifest.tenders || []).map((item) => [item.tender, item]));
  const budget = resolveRequirementChunkBudget(process.env);
  const byTender = new Map();
  const reconstruction = [];
  for (const tender of TENDER_ORDER) {
    const expected = manifestTenders.get(tender);
    if (!expected) throw new Error(`Missing manifest entry: ${tender}`);
    const dbJob = (await pool.query(
      `SELECT j.id,j.tender_file_id,j.extracted_text_sha256,f.original_name,f.storage_key
       FROM tender_parse_jobs j JOIN tender_files f ON f.id=j.tender_file_id WHERE j.id=$1`,
      [expected.parse_job_id]
    )).rows[0];
    if (!dbJob) throw new Error(`Missing parse job: ${expected.parse_job_id}`);
    const sourcePath = path.join(ROOT, 'uploads', ...String(dbJob.storage_key).split(/[\\/]+/));
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing source file: ${sourcePath}`);
    const sourceSha = sha256File(sourcePath);
    if (sourceSha !== expected.source_sha256) throw new Error(`Source SHA mismatch: ${tender}`);
    const extraction = await extractTenderText({
      fileName: dbJob.original_name,
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(sourcePath)
    });
    const { analysis, scope } = productionScope(extraction);
    if (!scope) throw new Error(`Production extraction scope missing: ${tender}`);
    const chunks = chunkExtractedText({ text: scope.content_text, paragraphs: scope.paragraphs, ...budget })
      .map((chunk) => ({ ...chunk, content_sha256: sha256(chunk.text) }));
    const dbChunks = (await pool.query(
      `SELECT id,parse_job_id,chunk_number,status,character_count,source_start_offset,source_end_offset,
              source_start_page,source_end_page,source_start_paragraph,source_end_paragraph,content_sha256
       FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number`,
      [expected.parse_job_id]
    )).rows;
    if (chunks.length !== dbChunks.length) throw new Error(`Chunk count mismatch: ${tender}`);
    const rows = chunks.map((chunk, index) => {
      const persisted = dbChunks[index];
      const hashAligned = persisted.content_sha256 === chunk.content_sha256
        && Number(persisted.character_count) === chunk.character_count;
      if (!hashAligned) throw new Error(`Chunk hash mismatch: ${tender}#${persisted.chunk_number}`);
      return {
        id: persisted.id,
        tender_id: tender,
        parse_job_id: persisted.parse_job_id,
        chunk_number: persisted.chunk_number,
        status: persisted.status,
        text: chunk.text,
        model_text: chunk.model_text,
        segments: Array.isArray(chunk.segments) ? chunk.segments : [],
        content_sha256: persisted.content_sha256,
        character_count: Number(persisted.character_count),
        source_start_offset: persisted.source_start_offset,
        source_end_offset: persisted.source_end_offset,
        source_start_page: persisted.source_start_page,
        source_end_page: persisted.source_end_page,
        source_start_paragraph: persisted.source_start_paragraph,
        source_end_paragraph: persisted.source_end_paragraph
      };
    });
    byTender.set(tender, {
      tender,
      parse_job_id: expected.parse_job_id,
      source_file: dbJob.original_name,
      source_path: sourcePath,
      source_sha256: sourceSha,
      extracted_text_sha256: sha256(extraction.text),
      extracted_text: extraction.text,
      extraction,
      analysis,
      scope,
      chunks: rows,
      hash_aligned: true
    });
    reconstruction.push({
      tender_id: tender,
      parse_job_id: expected.parse_job_id,
      source_file: dbJob.original_name,
      source_sha256: sourceSha,
      extracted_text_sha256: sha256(extraction.text),
      section_count: analysis.sections.length,
      scope_section_keys: scope.source_sections || [],
      chunk_count: rows.length,
      persisted_chunk_count: dbChunks.length,
      hash_alignment: true
    });
  }
  return { byTender, reconstruction };
}

function sectionDecision(state, excerpt) {
  if (!excerpt) return { status: 'UNAVAILABLE', section_identity: [], section_role: [] };
  const hits = (state.analysis.sections || []).filter((section) => contains(section.content_text, excerpt).present);
  return {
    status: hits.length ? 'PRESENT_IN_CLASSIFIED_SECTION' : 'NOT_PRESENT_IN_CLASSIFIED_SECTION',
    section_identity: hits.map((section) => section.section_key),
    section_role: hits.map((section) => section.archive_role || section.routing_role || null)
  };
}

function scopeDecision(state, excerpt) {
  if (!excerpt) return { status: 'UNAVAILABLE' };
  return { status: contains(state.scope.content_text, excerpt).present ? 'IN_SCOPE' : 'OUT_OF_SCOPE' };
}

function chunkDecision(state, excerpt) {
  if (!excerpt) return { status: 'UNAVAILABLE', candidate_span: [], cross_chunk_semantic_split: false };
  const single = state.chunks.filter((chunk) => contains(chunk.text, excerpt).present);
  if (single.length) {
    return {
      status: 'PRESENT_IN_SINGLE_PARSE_CHUNK',
      candidate_span: single.map((chunk) => ({
        chunk_id: chunk.id,
        chunk_number: chunk.chunk_number,
        source_start_page: chunk.source_start_page,
        source_end_page: chunk.source_end_page,
        source_start_paragraph: chunk.source_start_paragraph,
        source_end_paragraph: chunk.source_end_paragraph
      })),
      cross_chunk_semantic_split: false
    };
  }
  for (let start = 0; start < state.chunks.length; start += 1) {
    let joined = '';
    for (let end = start; end < state.chunks.length; end += 1) {
      joined += `${end === start ? '' : '\n'}${state.chunks[end].text}`;
      if (contains(joined, excerpt).present) {
        return {
          status: 'PRESENT_ACROSS_PARSE_CHUNKS',
          candidate_span: state.chunks.slice(start, end + 1).map((chunk) => ({
            chunk_id: chunk.id,
            chunk_number: chunk.chunk_number,
            source_start_page: chunk.source_start_page,
            source_end_page: chunk.source_end_page
          })),
          cross_chunk_semantic_split: end > start
        };
      }
      if (normalizeLexical(joined).length > normalizeLexical(excerpt).length * 3 + 500) break;
    }
  }
  return { status: 'NOT_PRESENT_IN_PARSE_CHUNKS', candidate_span: [], cross_chunk_semantic_split: false };
}

function providerPayloadAudit(state, excerpt, lineage) {
  if (!excerpt) return {
    status: 'UNAVAILABLE',
    source_evidence_present: null,
    source_text_present: null,
    source_ref_present: false,
    payloads: []
  };
  const payloads = state.chunks.map((chunk) => {
    const providerText = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
    const payload = buildRequirementExtractionPayload({
      projectName: state.source_file,
      sectionName: state.scope.title,
      chunkIndex: chunk.chunk_number,
      chunkCount: state.chunks.length,
      chunkText: providerText
    });
    const direct = contains(payload.chunk_text, excerpt).present;
    const sourceInChunk = contains(chunk.text, excerpt).present;
    const segmentTexts = chunk.segments.map((segment) => segment.text).filter(nonEmpty);
    const allSegmentsReachPayload = segmentTexts.every((segmentText) => contains(payload.chunk_text, segmentText).present);
    const bounded = !direct && sourceInChunk && allSegmentsReachPayload && payload.chunk_text === chunk.model_text;
    const matchingRefs = lineage.filter((evidence) => evidence.source_chunk_id === chunk.id
      && evidence.source_refs.length > 0
      && evidence.source_refs.every((sourceRef) => payload.chunk_text.includes(`[${sourceRef}]`)));
    return {
      parse_chunk_id: chunk.id,
      chunk_number: chunk.chunk_number,
      parse_chunk_text_sha256: sha256(chunk.text),
      parse_chunk_char_count: chunk.text.length,
      task_payload_chunk_text_sha256: sha256(payload.chunk_text),
      task_payload_chunk_text_char_count: payload.chunk_text.length,
      source_text_present_in_parse_chunk: sourceInChunk,
      source_text_present_directly_in_provider_payload: direct,
      bounded_textual_reconstruction: bounded,
      source_ref_present_in_provider_payload: matchingRefs.length > 0,
      source_ref_match_count: matchingRefs.length,
      transformation: payload.chunk_text === chunk.text ? 'IDENTITY' : 'EXPECTED_DETERMINISTIC_TRANSFORMATION'
    };
  });
  const textHits = payloads.filter((item) => item.source_text_present_directly_in_provider_payload || item.bounded_textual_reconstruction);
  return {
    status: textHits.length ? 'TEXT_PRESENT_IN_PROVIDER_PAYLOAD' : 'TEXT_NOT_PRESENT_IN_SINGLE_PROVIDER_PAYLOAD',
    source_evidence_present: textHits.length > 0,
    source_text_present: textHits.length > 0,
    source_ref_present: payloads.some((item) => item.source_ref_present_in_provider_payload),
    payloads
  };
}

function diagnoseAtom(atom, state, evidence, lineage, sourceDocumentSha256 = null) {
  if (!evidence.source_excerpt) {
    return {
      atom_id: atom.atom_id,
      tender_id: atom.tender || atom.tender_id,
      source_page: evidence.page,
      source_excerpt: null,
      source_excerpt_sha256: null,
      source_document_sha256: sourceDocumentSha256,
      source_excerpt_status: evidence.source_excerpt_status,
      source_excerpt_origin: null,
      atomic_requirement_descriptor: evidence.atomic_requirement_descriptor,
      production_lineage_available: lineage.length > 0,
      lineage_status: lineage.length > 0 ? 'AVAILABLE' : 'MECHANICAL_LINEAGE_NOT_PERSISTED',
      source_lineage_count: lineage.length,
      source_text_present_in_full_extraction: null,
      source_text_present_in_selected_scope: null,
      source_text_present_in_parse_chunk: null,
      source_text_present_in_provider_payload: null,
      source_ref_present_in_provider_payload: null,
      cross_chunk_semantic_split: false,
      mechanical_status: 'UNRESOLVED',
      unresolved_reason: 'SOURCE_EXCERPT_NOT_PRESENT_IN_FROZEN_SOURCE_TRUTH',
      unresolved_reasons: ['SOURCE_EXCERPT_NOT_PRESENT_IN_FROZEN_SOURCE_TRUTH', ...(lineage.length ? [] : ['MECHANICAL_LINEAGE_NOT_PERSISTED'])]
    };
  }
  const full = contains(state.extracted_text, evidence.source_excerpt).present;
  const section = sectionDecision(state, evidence.source_excerpt);
  const scope = scopeDecision(state, evidence.source_excerpt);
  const chunk = chunkDecision(state, evidence.source_excerpt);
  const provider = providerPayloadAudit(state, evidence.source_excerpt, lineage);
  let mechanicalStatus = 'PRODUCTION_INPUT_VALID';
  if (!full) mechanicalStatus = 'UNRESOLVED';
  else if (scope.status !== 'IN_SCOPE') mechanicalStatus = 'SOURCE_SCOPE_LOSS';
  else if (chunk.status === 'NOT_PRESENT_IN_PARSE_CHUNKS') mechanicalStatus = 'CHUNK_COVERAGE_LOSS';
  else if (chunk.cross_chunk_semantic_split) mechanicalStatus = 'CROSS_CHUNK_SEMANTIC_SPLIT';
  else if (!provider.source_evidence_present) mechanicalStatus = 'PAYLOAD_TEXT_COVERAGE_LOSS';
  return {
    atom_id: atom.atom_id,
    tender_id: atom.tender || atom.tender_id,
    source_page: evidence.page,
    source_paragraph_start: evidence.paragraph_start,
    source_paragraph_end: evidence.paragraph_end,
    source_excerpt: evidence.source_excerpt,
    source_excerpt_sha256: evidence.source_excerpt_sha256,
    source_document_sha256: sourceDocumentSha256,
    source_excerpt_status: evidence.source_excerpt_status,
    source_excerpt_origin: evidence.source_excerpt_origin,
    atomic_requirement_descriptor: evidence.atomic_requirement_descriptor,
    production_lineage_available: lineage.length > 0,
    lineage_status: lineage.length > 0 ? 'AVAILABLE' : 'MECHANICAL_LINEAGE_NOT_PERSISTED',
    source_lineage_count: lineage.length,
    source_text_present_in_full_extraction: full,
    source_text_present_in_selected_scope: scope.status === 'IN_SCOPE',
    source_text_present_in_parse_chunk: chunk.status === 'PRESENT_IN_SINGLE_PARSE_CHUNK',
    source_text_present_in_provider_payload: provider.source_evidence_present,
    source_ref_present_in_provider_payload: provider.source_ref_present,
    cross_chunk_semantic_split: chunk.cross_chunk_semantic_split,
    section_classifier: section,
    scope_router: scope,
    parse_chunk: chunk,
    provider_payload: provider,
    mechanical_status: mechanicalStatus,
    unresolved_reason: !full
      ? 'SOURCE_TRUTH_TEXT_NOT_PRESENT_IN_CURRENT_PRODUCTION_EXTRACTION'
      : (lineage.length === 0 ? 'MECHANICAL_LINEAGE_NOT_PERSISTED' : null),
    unresolved_reasons: [
      ...(!full ? ['SOURCE_TRUTH_TEXT_NOT_PRESENT_IN_CURRENT_PRODUCTION_EXTRACTION'] : []),
      ...(lineage.length === 0 ? ['MECHANICAL_LINEAGE_NOT_PERSISTED'] : [])
    ]
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'UNRESOLVED';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildCheckpoint(report) {
  const coverage = report.coverage;
  return {
    artifact_type: 'V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6_CHECKPOINT',
    artifact_version: 'v6',
    production_run_id: report.production_run_id,
    source_truth_id: report.source_truth_id,
    source_truth_sha256: report.source_truth_sha256,
    source_evidence_rendering: report.source_evidence_rendering,
    production_parse_chunk_unique_count: report.denominator_reconciliation.production_parse_chunk_unique_count,
    denominator_reconciliation: report.denominator_reconciliation,
    p0_source_to_provider_input_coverage: {
      total_atoms: coverage.total_atoms,
      source_truth_text_present_in_full_extraction: coverage.source_truth_text_present_in_full_extraction,
      source_truth_text_present_in_selected_scope: coverage.source_truth_text_present_in_selected_scope,
      source_truth_text_present_in_parse_chunk: coverage.source_truth_text_present_in_parse_chunk,
      source_truth_text_present_in_provider_payload: coverage.source_truth_text_present_in_provider_payload,
      source_ref_present_in_provider_payload: coverage.source_ref_present_in_provider_payload,
      production_lineage_available: coverage.production_lineage_available,
      cross_chunk_semantic_splits: coverage.cross_chunk_semantic_splits,
      unresolved_source_evidence: coverage.unresolved_source_evidence,
      gate: coverage.gate
    },
    historical_15_audit_count: report.historical_15_audit.length,
    badcase_44_mechanical_status_counts: report.badcase_44_mechanical_status_counts,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_repair_applied: false,
    semantic_adjudication_performed: false,
    final_status: report.final_status
  };
}

function writeMarkdown(checkpoint) {
  const c = checkpoint.p0_source_to_provider_input_coverage;
  const lines = [
    '# V43 Requirement P0 487 Textual Input Coverage V6 Checkpoint',
    '',
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- SOURCE_TRUTH_SHA256: ${checkpoint.source_truth_sha256}`,
    `- PRODUCTION_PARSE_CHUNK_UNIQUE_COUNT: ${checkpoint.production_parse_chunk_unique_count}`,
    `- P0_SOURCE_TO_PROVIDER_INPUT_COVERAGE: ${JSON.stringify(c)}`,
    `- BADCASE_44_MECHANICAL_STATUS_COUNTS: ${JSON.stringify(checkpoint.badcase_44_mechanical_status_counts)}`,
    `- HISTORICAL_15_AUDIT_COUNT: ${checkpoint.historical_15_audit_count}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- LLM_CALLS: ${checkpoint.llm_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- PRODUCTION_REPAIR_APPLIED: ${checkpoint.production_repair_applied}`,
    '',
    'Mechanical offline diagnostic only. No Provider call, semantic adjudication, or production repair was performed.'
  ];
  fs.writeFileSync(CHECKPOINT_MD_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
  dotenv.config({ path: path.join(ROOT, '.env') });
  const sourceTruth = readJson(SOURCE_TRUTH_PATH);
  const renderedRows = readJsonl(SOURCE_RENDERING_PATH);
  const sourceFidelity = readJson(SOURCE_FIDELITY_PATH);
  const v2 = readJson(V2_PACKET_PATH);
  const v4 = readJson(V4_REPORT_PATH);
  const v4Checkpoint = readJson(V4_CHECKPOINT_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const sourceAtoms = Array.isArray(sourceTruth) ? sourceTruth : sourceTruth.atoms;
  if (sourceAtoms.length !== 487) throw new Error(`Frozen Source Truth must contain 487 atoms; got ${sourceAtoms.length}`);
  const sourceTruthFileSha256 = sha256File(SOURCE_TRUTH_PATH);
  if (sourceTruthFileSha256 !== '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0') {
    throw new Error('Frozen Source Truth SHA mismatch.');
  }
  if (renderedRows.length !== 487) throw new Error(`Frozen Source Truth rendering must contain 487 rows; got ${renderedRows.length}`);
  const renderedById = new Map(renderedRows.map((row) => [row.atom_id, row]));
  if (renderedById.size !== 487) throw new Error('Frozen Source Truth rendering atom IDs are not unique.');
  const badRendering = renderedRows.filter((row) => stripSha(row.source_truth?.source_truth_sha256) !== sourceTruthFileSha256);
  if (badRendering.length) throw new Error(`Frozen Source Truth rendering SHA mismatch for ${badRendering.length} rows.`);
  if (sourceFidelity.atom_count !== 487 || sourceFidelity.atoms.length !== 487) throw new Error('Source fidelity evidence must contain 487 atoms.');
  if (stripSha(sourceFidelity.frozen_source_truth_sha256 || sourceFidelity.source_truth_sha256) !== sourceTruthFileSha256) throw new Error('Source fidelity SHA mismatch.');
  if (v2.rows?.length !== 44 || v4.rows?.length !== 44) throw new Error('Expected 44-row badcase artifacts.');
  const v2ById = new Map(v2.rows.map((row) => [row.atom_id, row]));
  const fidelityById = new Map(sourceFidelity.atoms.map((row) => [row.atom_id, row]));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const states = await loadProductionStates(pool, manifest);
    const productionChunkCount = [...states.byTender.values()].reduce((sum, state) => sum + state.chunks.length, 0);
    const diagnostics = sourceAtoms.map((atom) => {
      const evidence = resolveFrozenSourceEvidence(atom, renderedById, v2ById);
      return diagnoseAtom(
        atom,
        states.byTender.get(atom.tender),
        evidence,
        lineageForAtom(atom.atom_id, fidelityById),
        fidelityById.get(atom.atom_id)?.source_document_sha256 || null
      );
    });
    const coverage = {
      total_atoms: diagnostics.length,
      source_truth_text_present_in_full_extraction: diagnostics.filter((row) => row.source_text_present_in_full_extraction === true).length,
      source_truth_text_present_in_selected_scope: diagnostics.filter((row) => row.source_text_present_in_selected_scope === true).length,
      source_truth_text_present_in_parse_chunk: diagnostics.filter((row) => row.source_text_present_in_parse_chunk === true).length,
      source_truth_text_present_in_provider_payload: diagnostics.filter((row) => row.source_text_present_in_provider_payload === true).length,
      source_ref_present_in_provider_payload: diagnostics.filter((row) => row.source_ref_present_in_provider_payload === true).length,
      production_lineage_available: diagnostics.filter((row) => row.production_lineage_available === true).length,
      cross_chunk_semantic_splits: diagnostics.filter((row) => row.cross_chunk_semantic_split === true).length,
      unresolved_source_evidence: diagnostics.filter((row) => row.source_excerpt_status !== 'AVAILABLE').map((row) => row.atom_id),
      missing_full_extraction_ids: diagnostics.filter((row) => row.source_text_present_in_full_extraction === false).map((row) => row.atom_id),
      missing_selected_scope_ids: diagnostics.filter((row) => row.source_text_present_in_selected_scope === false).map((row) => row.atom_id),
      missing_parse_chunk_ids: diagnostics.filter((row) => row.source_text_present_in_parse_chunk === false).map((row) => row.atom_id),
      missing_provider_payload_ids: diagnostics.filter((row) => row.source_text_present_in_provider_payload === false).map((row) => row.atom_id),
      cross_chunk_semantic_split_ids: diagnostics.filter((row) => row.cross_chunk_semantic_split).map((row) => row.atom_id),
      gate: diagnostics.every((row) => row.source_text_present_in_provider_payload === true && !row.cross_chunk_semantic_split) ? 'PASS' : 'FAIL'
    };
    const historical15 = diagnostics.filter((row) => HISTORICAL_15_IDS.has(row.atom_id)).map((row) => ({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      source_excerpt_sha256: row.source_excerpt_sha256,
      source_document_sha256: row.source_document_sha256,
      source_excerpt_chars: row.source_excerpt ? row.source_excerpt.length : 0,
      source_text_present_in_full_extraction: row.source_text_present_in_full_extraction,
      source_text_present_in_selected_scope: row.source_text_present_in_selected_scope,
      source_text_present_in_parse_chunk: row.source_text_present_in_parse_chunk,
      source_text_present_in_provider_payload: row.source_text_present_in_provider_payload,
      source_ref_present_in_provider_payload: row.source_ref_present_in_provider_payload,
      production_lineage_available: row.production_lineage_available,
      production_lineage_count: row.source_lineage_count,
      cross_chunk_semantic_split: row.cross_chunk_semantic_split,
      mechanical_status: row.mechanical_status,
      unresolved_reason: row.unresolved_reason
    }));
    const badcase44 = v4.rows.map((row) => {
      const diagnostic = diagnostics.find((candidate) => candidate.atom_id === row.atom_id);
      return {
        atom_id: row.atom_id,
        tender_id: row.tender_id,
        source_excerpt_sha256: diagnostic?.source_excerpt_sha256 || null,
        source_text_present_in_full_extraction: diagnostic?.source_text_present_in_full_extraction ?? null,
        source_text_present_in_selected_scope: diagnostic?.source_text_present_in_selected_scope ?? null,
        source_text_present_in_parse_chunk: diagnostic?.source_text_present_in_parse_chunk ?? null,
        source_text_present_in_provider_payload: diagnostic?.source_text_present_in_provider_payload ?? null,
        source_ref_present_in_provider_payload: diagnostic?.source_ref_present_in_provider_payload ?? null,
        production_lineage_available: diagnostic?.production_lineage_available ?? false,
        cross_chunk_semantic_split: diagnostic?.cross_chunk_semantic_split ?? false,
        mechanical_status: diagnostic?.mechanical_status || 'UNRESOLVED'
      };
    });
    const report = {
      artifact_type: 'V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6',
      artifact_version: 'v6',
      status: 'MECHANICAL_DIAGNOSTIC_ONLY',
      production_run_id: manifest.run_id,
      source_truth_id: sourceTruth.artifact_type || 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
      source_truth_sha256: sourceTruthFileSha256,
      source_truth_atom_count: sourceAtoms.length,
      source_evidence_rendering: {
        path: path.relative(ROOT, SOURCE_RENDERING_PATH),
        sha256: sha256File(SOURCE_RENDERING_PATH),
        row_count: renderedRows.length,
        authority: 'FROZEN_SOURCE_TRUTH_RENDERING_ONLY',
        candidate_lineage_used_for_source_selection: false
      },
      chain: {
        stages: ['FROZEN_SOURCE_TRUTH_EVIDENCE', 'FULL_EXTRACTION', 'SECTION_CLASSIFIER', 'REQUIREMENT_SCOPE_ROUTER', 'PARSE_CHUNK', 'PRODUCTION_PROVIDER_PAYLOAD'],
        authority: 'FROZEN_SOURCE_TRUTH_SOURCE_EXCERPT_PLUS_CURRENT_PRODUCTION_RECONSTRUCTION',
        provider_calls: 0,
        llm_calls: 0
      },
      denominator_reconciliation: {
        production_parse_chunk_unique_count: productionChunkCount,
        hash_comparison_record_count: productionChunkCount,
        duplicate_or_auxiliary_record_count: 0,
        reported_204_value: 204,
        reason_for_197_vs_204: '204 is the historical FAST-01 candidate/source-verified count, not a Parse Chunk count; current frozen Production run has 197 unique persisted Parse Chunks (28+33+32+26+51+27).',
        manifest_chunk_counts: Object.fromEntries([...states.byTender.values()].map((state) => [state.tender, state.chunks.length]))
      },
      production_parse_reconstruction: states.reconstruction,
      historical_15_audit: historical15,
      badcase_44_mechanical_input_audit: badcase44,
      badcase_44_mechanical_status_counts: countBy(badcase44, 'mechanical_status'),
      coverage,
      diagnostics,
      source_fidelity_observability: {
        path: path.relative(ROOT, SOURCE_FIDELITY_PATH),
        sha256: sha256File(SOURCE_FIDELITY_PATH),
        production_source_text_found: sourceFidelity.counts?.production_source_text_found ?? null,
        production_source_text_not_found: sourceFidelity.counts?.production_source_text_not_found ?? null,
        interpretation: 'SECONDARY_OBSERVABILITY_ONLY; missing lineage is MECHANICAL_LINEAGE_NOT_PERSISTED, never source text absence'
      },
      v4_badcase_observability: {
        path: path.relative(ROOT, V4_REPORT_PATH),
        sha256: sha256File(V4_REPORT_PATH),
        checkpoint_path: path.relative(ROOT, V4_CHECKPOINT_PATH),
        checkpoint_sha256: sha256File(V4_CHECKPOINT_PATH),
        historical_parse_coverage_case_count: (v4Checkpoint.production_parse_coverage_loss_case_ids || []).length,
        semantic_labels_reinterpreted: false
      },
      side_effects: {
        provider_calls: 0,
        llm_calls: 0,
        production_db_writes: 0,
        gold_mutations: 0,
        production_repair_applied: false,
        semantic_adjudication_performed: false,
        prompts_changed: false,
        schemas_changed: false
      },
      final_status: coverage.gate === 'PASS'
        ? 'READY_FOR_GPT_P0_44_CORRECTED_REPLAY_DECISION'
        : 'READY_FOR_GPT_REQUIREMENT_REAL_COVERAGE_DEFECT_REVIEW'
    };
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    const checkpoint = buildCheckpoint(report);
    fs.writeFileSync(CHECKPOINT_JSON_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
    writeMarkdown(checkpoint);
    console.log(JSON.stringify({
      report: path.relative(ROOT, OUT_PATH),
      checkpoint_json: path.relative(ROOT, CHECKPOINT_JSON_PATH),
      checkpoint_md: path.relative(ROOT, CHECKPOINT_MD_PATH),
      total_atoms: coverage.total_atoms,
      provider_text_coverage: coverage.source_truth_text_present_in_provider_payload,
      full_extraction_coverage: coverage.source_truth_text_present_in_full_extraction,
      selected_scope_coverage: coverage.source_truth_text_present_in_selected_scope,
      parse_chunk_coverage: coverage.source_truth_text_present_in_parse_chunk,
      cross_chunk_semantic_splits: coverage.cross_chunk_semantic_splits,
      unresolved_source_evidence_count: coverage.unresolved_source_evidence.length,
      badcase_44_mechanical_status_counts: report.badcase_44_mechanical_status_counts,
      final_status: report.final_status,
      provider_calls: 0,
      production_db_writes: 0
    }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
}

export {
  normalizeLexical,
  contains,
  resolveFrozenSourceEvidence,
  chunkDecision,
  providerPayloadAudit,
  diagnoseAtom
};
