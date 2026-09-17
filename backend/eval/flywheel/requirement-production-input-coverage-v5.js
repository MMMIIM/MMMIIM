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
const V2_PACKET_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
const V4_REPORT_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json');
const V4_CHECKPOINT_PATH = path.join(REPORT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT.json');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const SOURCE_FIDELITY_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'V43_P0_SOURCE_FIDELITY_EVIDENCE.json');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const OUT_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_PRODUCTION_INPUT_COVERAGE_ROOT_CAUSE_V5.json');
const CHECKPOINT_JSON_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_PRODUCTION_INPUT_COVERAGE_V5_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(REPORT_DIR, 'V43_REQUIREMENT_PRODUCTION_INPUT_COVERAGE_V5_CHECKPOINT.md');

const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const ALLOWED_EARLIEST_STAGES = new Set([
  'SECTION_CLASSIFIER', 'SCOPE_ROUTER', 'CHUNK_BUILDER', 'PERSISTENCE', 'OTHER', 'UNRESOLVED'
]);

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function stripSha(value) { return String(value || '').replace(/^sha256:/i, ''); }
function normalizeLexical(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, '');
}
function contains(haystack, needle) {
  const h = normalizeLexical(haystack);
  const n = normalizeLexical(needle);
  return { contains: Boolean(n) && h.includes(n), haystack_chars: h.length, needle_chars: n.length };
}
function sourceExcerpt(row) {
  return row.source_truth?.source_excerpt || row.source_truth?.atomic_requirement || row.atomic_requirement || '';
}
function sourcePage(row) {
  return row.source_truth?.page ?? row.page ?? null;
}
function sourceAnchorsForAtom(atom, fidelityById) {
  const fidelity = fidelityById.get(atom.atom_id);
  const lineage = fidelity?.production_lineage_evidence || [];
  const anchors = lineage.flatMap((evidence) => [evidence.source_text, evidence.source_excerpt])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return [...new Set(anchors)];
}
function sourceLineageForAtom(atom, fidelityById) {
  const fidelity = fidelityById.get(atom.atom_id);
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
function anyContains(haystack, anchors) {
  const values = (anchors || []).filter(Boolean);
  const hits = values.filter((anchor) => contains(haystack, anchor).contains);
  return {
    present: hits.length > 0,
    matched_anchor_count: hits.length,
    anchor_count: values.length,
    matched_anchor_sha256: hits.map((anchor) => sha256(anchor))
  };
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

async function loadProductionStates(pool, manifest) {
  const manifestTenders = new Map((manifest.tenders || []).map((item) => [item.tender, item]));
  const budget = resolveRequirementChunkBudget(process.env);
  const byTender = new Map();
  const byChunkId = new Map();
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
      const row = {
        id: persisted.id,
        tender_id: tender,
        parse_job_id: persisted.parse_job_id,
        chunk_number: persisted.chunk_number,
        status: persisted.status,
        text: chunk.text,
        model_text: chunk.model_text,
        content_sha256: persisted.content_sha256,
        character_count: Number(persisted.character_count),
        source_start_offset: persisted.source_start_offset,
        source_end_offset: persisted.source_end_offset,
        source_start_page: persisted.source_start_page,
        source_end_page: persisted.source_end_page,
        source_start_paragraph: persisted.source_start_paragraph,
        source_end_paragraph: persisted.source_end_paragraph
      };
      byChunkId.set(row.id, row);
      return row;
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
  return { byTender, byChunkId, reconstruction };
}

function sectionDecision(state, anchors) {
  const values = Array.isArray(anchors) ? anchors : [anchors];
  const hits = (state.analysis.sections || []).filter((section) => values.some((anchor) => contains(section.content_text, anchor).contains));
  if (hits.length) {
    return {
      section_identity: hits.map((section) => section.section_key),
      section_role: hits.map((section) => section.archive_role || section.routing_role || null),
      include_decision: 'PRESENT_IN_CLASSIFIED_SECTION',
      reason: 'Source evidence is present in the section classifier output.'
    };
  }
  return {
    section_identity: [],
    section_role: [],
    include_decision: 'NOT_PRESENT_IN_CLASSIFIED_SECTION',
    reason: 'No supplied source anchor is contained in any classified section.'
  };
}

function scopeDecision(state, anchors) {
  const values = Array.isArray(anchors) ? anchors : [anchors];
  const present = values.some((anchor) => contains(state.scope.content_text, anchor).contains);
  return {
    include_decision: present ? 'IN_SCOPE' : 'OUT_OF_SCOPE',
    reason: present
      ? 'Source evidence is present in the combined Requirement Extraction scope.'
      : 'No supplied source anchor is contained in the combined Requirement Extraction scope.'
  };
}

function chunkDecision(state, anchors) {
  const values = Array.isArray(anchors) ? anchors : [anchors];
  const containing = state.chunks.filter((chunk) => values.some((anchor) => contains(chunk.text, anchor).contains));
  if (containing.length) {
    return {
      candidate_span: containing.map((chunk) => ({
        chunk_id: chunk.id,
        chunk_number: chunk.chunk_number,
        source_start_page: chunk.source_start_page,
        source_end_page: chunk.source_end_page,
        source_start_paragraph: chunk.source_start_paragraph,
        source_end_paragraph: chunk.source_end_paragraph
      })),
      emitted: true,
      reason: 'Source evidence is contained in one or more emitted chunk texts.',
      cross_chunk_semantic_split: false
    };
  }
  for (let i = 0; i < state.chunks.length - 1; i += 1) {
    const joined = `${state.chunks[i].text}\n${state.chunks[i + 1].text}`;
    if (values.some((anchor) => contains(joined, anchor).contains)) {
      return {
        candidate_span: [
          { chunk_id: state.chunks[i].id, chunk_number: state.chunks[i].chunk_number },
          { chunk_id: state.chunks[i + 1].id, chunk_number: state.chunks[i + 1].chunk_number }
        ],
        emitted: true,
        reason: 'Source evidence crosses an emitted chunk boundary; no single chunk exposes the complete excerpt.',
        cross_chunk_semantic_split: true
      };
    }
  }
  return {
    candidate_span: [],
    emitted: false,
    reason: 'No supplied source anchor is contained in any emitted chunk text.',
    cross_chunk_semantic_split: false
  };
}

function persistenceDecision(state, anchors) {
  const values = Array.isArray(anchors) ? anchors : [anchors];
  const hits = state.chunks.filter((chunk) => values.some((anchor) => contains(chunk.text, anchor).contains));
  return {
    present: hits.length > 0,
    chunk_ids: hits.map((chunk) => chunk.id),
    reason: state.hash_aligned
      ? 'Persisted chunk hashes and character counts match deterministic Production chunk reconstruction.'
      : 'Persisted chunk hash alignment is not established.'
  };
}

function providerPayloadDecision(state, anchors, lineage = []) {
  const values = Array.isArray(anchors) ? anchors : [anchors];
  const payloads = state.chunks.map((chunk) => {
    const providerText = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
    const payload = buildRequirementExtractionPayload({
      projectName: state.source_file,
      sectionName: state.scope.title,
      chunkIndex: chunk.chunk_number,
      chunkCount: state.chunks.length,
      chunkText: providerText
    });
    return {
      parse_chunk_id: chunk.id,
      chunk_number: chunk.chunk_number,
      parse_chunk_text_sha256: sha256(chunk.text),
      parse_chunk_char_count: chunk.text.length,
      task_payload_chunk_text_sha256: sha256(payload.chunk_text),
      task_payload_chunk_text_char_count: payload.chunk_text.length,
      source_evidence_present_in_parse_chunk: anyContains(chunk.text, values).present,
      source_evidence_present_in_provider_payload: anyContains(payload.chunk_text, values).present
        || lineage.some((evidence) => evidence.source_chunk_id === chunk.id
          && evidence.source_refs.length > 0
          && evidence.source_refs.every((sourceRef) => payload.chunk_text.includes(`[${sourceRef}]`))),
      source_ref_match_count: lineage.filter((evidence) => evidence.source_chunk_id === chunk.id
        && evidence.source_refs.length > 0
        && evidence.source_refs.every((sourceRef) => payload.chunk_text.includes(`[${sourceRef}]`))).length,
      transformation: payload.chunk_text === chunk.text ? 'IDENTITY' : 'EXPECTED_DETERMINISTIC_TRANSFORMATION',
      provider_payload_input: payload
    };
  });
  const present = payloads.filter((item) => item.source_evidence_present_in_provider_payload);
  return {
    source_evidence_present: present.length > 0,
    payloads: payloads.map(({ provider_payload_input: _payload, ...safe }) => safe),
    transformation_summary: [...new Set(payloads.map((item) => item.transformation))],
    reason: present.length
      ? 'Current production payload builder preserves the source evidence in at least one task payload.'
      : 'Current production payload builder emits no task payload containing the complete source evidence.'
  };
}

function earliestLoss(stageResults) {
  if (!stageResults.full_extraction_present) return 'UNRESOLVED';
  if (stageResults.section_classifier.include_decision !== 'PRESENT_IN_CLASSIFIED_SECTION') return 'SECTION_CLASSIFIER';
  if (stageResults.scope_router.include_decision !== 'IN_SCOPE') return 'SCOPE_ROUTER';
  if (!stageResults.chunk_builder.emitted) return 'CHUNK_BUILDER';
  if (!stageResults.persistence.present) return 'PERSISTENCE';
  if (!stageResults.provider_payload.source_evidence_present) return 'OTHER';
  return 'NONE';
}

function diagnoseAtom(row, state) {
  const excerpt = sourceExcerpt(row);
  const anchors = row.source_anchors || [excerpt];
  const lineage = row.source_lineage || [];
  const fullMatch = anyContains(state.extracted_text, anchors);
  const full = fullMatch.present;
  const section = sectionDecision(state, anchors);
  const scope = scopeDecision(state, anchors);
  const chunk = chunkDecision(state, anchors);
  const persistence = persistenceDecision(state, anchors);
  const providerPayload = providerPayloadDecision(state, anchors, lineage);
  const stageResults = {
    full_extraction_present: full,
    section_classifier: section,
    scope_router: scope,
    chunk_builder: chunk,
    persistence,
    provider_payload: providerPayload
  };
  const earliest = earliestLoss(stageResults);
  if (!ALLOWED_EARLIEST_STAGES.has(earliest) && earliest !== 'NONE') throw new Error(`Unexpected earliest stage: ${earliest}`);
  return {
    atom_id: row.atom_id,
    tender_id: row.tender_id || row.tender,
    source_page: sourcePage(row),
    source_paragraph_start: row.source_truth?.matched_paragraph_start ?? null,
    source_paragraph_end: row.source_truth?.matched_paragraph_end ?? null,
    source_excerpt: excerpt,
    source_excerpt_sha256: sha256(excerpt),
    source_anchor_count: anchors.length,
    source_anchor_sha256s: anchors.map((anchor) => sha256(anchor)),
    source_lineage_count: lineage.length,
    source_lineage_available: lineage.length > 0,
    unresolved_reason: lineage.length === 0
      ? 'FROZEN_SOURCE_FIDELITY_HAS_NO_PRODUCTION_LINEAGE_EVIDENCE'
      : null,
    prior_v4_authority_status: row.prior_v4_authority_status || null,
    full_extraction_present: full,
    section_classifier: section,
    scope_router: scope,
    chunk_builder: chunk,
    persisted_parse_chunk: persistence,
    provider_payload: providerPayload,
    earliest_loss_stage: earliest,
    source_truth_family: row.source_truth?.family || row.family || null,
    p0_basis: row.source_truth?.p0_basis || row.p0_basis || null
  };
}

function coverageForAtom(atom, state) {
  const excerpt = sourceExcerpt(atom);
  const anchors = atom.source_anchors || [excerpt];
  const lineage = atom.source_lineage || [];
  const full = anyContains(state.extracted_text, anchors).present;
  const section = sectionDecision(state, anchors);
  const scope = scopeDecision(state, anchors);
  const chunk = chunkDecision(state, anchors);
  const persistence = persistenceDecision(state, anchors);
  const provider = providerPayloadDecision(state, anchors, lineage);
  return {
    atom_id: atom.atom_id,
    tender_id: atom.tender || atom.tender_id,
    full_extraction_present: full,
    selected_sections_present: section.include_decision === 'PRESENT_IN_CLASSIFIED_SECTION',
    parse_chunk_present: persistence.present,
    provider_payload_present: provider.source_evidence_present,
    cross_chunk_semantic_split: chunk.cross_chunk_semantic_split,
    source_anchor_count: anchors.length,
    source_anchor_sha256s: anchors.map((anchor) => sha256(anchor)),
    source_lineage_count: lineage.length,
    source_fidelity_found: atom.source_fidelity_found ?? null,
    source_page: atom.page ?? null,
    source_excerpt_sha256: sha256(excerpt)
  };
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key] || 'NONE';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function buildCheckpoint(report) {
  const coverage = report.full_p0_487_coverage;
  const stageCounts = countBy(report.badcase_31_diagnostics, 'earliest_loss_stage');
  return {
    artifact_type: 'V43_REQUIREMENT_PRODUCTION_INPUT_COVERAGE_V5_CHECKPOINT',
    artifact_version: 'v5',
    production_run_id: report.production_run_id,
    source_truth_id: report.source_truth_id,
    source_truth_sha256: report.source_truth_sha256,
    source_fidelity_evidence: report.source_fidelity_evidence,
    production_parse_chunk_unique_count: report.denominator_reconciliation.production_parse_chunk_unique_count,
    hash_comparison_record_count: report.denominator_reconciliation.hash_comparison_record_count,
    duplicate_or_auxiliary_record_count: report.denominator_reconciliation.duplicate_or_auxiliary_record_count,
    reason_for_197_vs_204: report.denominator_reconciliation.reason_for_197_vs_204,
    badcase_31_count: report.badcase_31_diagnostics.length,
    badcase_31_earliest_loss_counts: stageCounts,
    p0_source_to_provider_input_coverage: {
      total_atoms: coverage.total_atoms,
      source_found_in_full_extraction: coverage.source_found_in_full_extraction,
      source_covered_by_selected_sections: coverage.source_covered_by_selected_sections,
      source_covered_by_parse_chunks: coverage.source_covered_by_parse_chunks,
      source_covered_by_provider_payload: coverage.source_covered_by_provider_payload,
      cross_chunk_semantic_splits: coverage.cross_chunk_semantic_splits,
      unresolved: coverage.unresolved,
      gate: coverage.gate
    },
    systemic_scope_hypothesis: report.systemic_scope_hypothesis,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    normalizer_changes: 0,
    canonicalizer_changes: 0,
    production_repair_applied: false,
    semantic_adjudication_performed: false,
    final_status: report.final_status
  };
}

function writeMarkdown(checkpoint) {
  const lines = [
    '# V43 Requirement Production Input Coverage V5 Checkpoint',
    '',
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- PRODUCTION_PARSE_CHUNK_UNIQUE_COUNT: ${checkpoint.production_parse_chunk_unique_count}`,
    `- HASH_COMPARISON_RECORD_COUNT: ${checkpoint.hash_comparison_record_count}`,
    `- DUPLICATE_OR_AUXILIARY_RECORD_COUNT: ${checkpoint.duplicate_or_auxiliary_record_count}`,
    `- REASON_FOR_197_VS_204: ${checkpoint.reason_for_197_vs_204}`,
    `- BADCASE_31_COUNT: ${checkpoint.badcase_31_count}`,
    `- BADCASE_31_EARLIEST_LOSS_COUNTS: ${JSON.stringify(checkpoint.badcase_31_earliest_loss_counts)}`,
    `- P0_SOURCE_TO_PROVIDER_INPUT_COVERAGE: ${JSON.stringify(checkpoint.p0_source_to_provider_input_coverage)}`,
    `- SYSTEMIC_SCOPE_HYPOTHESIS: ${JSON.stringify(checkpoint.systemic_scope_hypothesis)}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- LLM_CALLS: ${checkpoint.llm_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- PRODUCTION_REPAIR_APPLIED: ${checkpoint.production_repair_applied}`,
    '',
    'All evidence is deterministic and offline. No semantic adjudication or Provider call was performed.'
  ];
  fs.writeFileSync(CHECKPOINT_MD_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
  dotenv.config({ path: path.join(ROOT, '.env') });
  const v2 = readJson(V2_PACKET_PATH);
  const v4 = readJson(V4_REPORT_PATH);
  const v4Checkpoint = readJson(V4_CHECKPOINT_PATH);
  const sourceTruth = readJson(SOURCE_TRUTH_PATH);
  const sourceFidelity = readJson(SOURCE_FIDELITY_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const sourceAtoms = Array.isArray(sourceTruth) ? sourceTruth : sourceTruth.atoms;
  if (sourceAtoms.length !== 487) throw new Error(`Frozen P0 source truth must contain 487 atoms; got ${sourceAtoms.length}`);
  const sourceTruthFileSha256 = sha256File(SOURCE_TRUTH_PATH);
  const fidelitySourceTruthSha256 = sourceFidelity.frozen_source_truth_sha256 || sourceFidelity.source_truth_sha256;
  if (fidelitySourceTruthSha256 !== sourceTruthFileSha256) {
    throw new Error('Source fidelity evidence does not match frozen source truth SHA.');
  }
  if (sourceFidelity.atom_count !== 487 || !Array.isArray(sourceFidelity.atoms) || sourceFidelity.atoms.length !== 487) {
    throw new Error('Source fidelity evidence must contain 487 atoms.');
  }
  if (v4.rows?.length !== 44 || v2.rows?.length !== 44) throw new Error('Expected 44-row V2/V4 badcase artifacts.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const states = await loadProductionStates(pool, manifest);
    const productionChunkCount = [...states.byTender.values()].reduce((sum, state) => sum + state.chunks.length, 0);
    const badcaseIds = new Set(v4Checkpoint.production_parse_coverage_loss_case_ids || []);
    const v2ById = new Map(v2.rows.map((row) => [row.atom_id, row]));
    const badcaseRows = [...badcaseIds].map((id) => v2ById.get(id)).filter(Boolean);
    if (badcaseRows.length !== 31) throw new Error(`Expected 31 frozen parse-coverage badcases; got ${badcaseRows.length}`);
    const fidelityById = new Map(sourceFidelity.atoms.map((atom) => [atom.atom_id, atom]));
    const rowsWithAnchors = sourceAtoms.map((atom) => ({
      ...atom,
      source_anchors: sourceAnchorsForAtom(atom, fidelityById),
      source_fidelity_found: fidelityById.get(atom.atom_id)?.production_source_text_found ?? null
    }));
    const allBadcaseRowsWithAnchors = (v4.rows || []).map((row) => ({
      ...row,
      source_anchors: sourceAnchorsForAtom({ atom_id: row.atom_id }, fidelityById),
      source_lineage: sourceLineageForAtom({ atom_id: row.atom_id }, fidelityById),
      prior_v4_authority_status: row.authority_status || null
    }));
    const badcaseRowsWithAnchors = badcaseRows.map((row) => ({
      ...row,
      source_anchors: sourceAnchorsForAtom({ atom_id: row.atom_id }, fidelityById),
      source_lineage: sourceLineageForAtom({ atom_id: row.atom_id }, fidelityById),
      prior_v4_authority_status: v4.rows.find((candidate) => candidate.atom_id === row.atom_id)?.authority_status || null
    }));
    rowsWithAnchors.forEach((atom) => { atom.source_lineage = sourceLineageForAtom(atom, fidelityById); });
    const badcaseDiagnostics = badcaseRowsWithAnchors.map((row) => diagnoseAtom(row, states.byTender.get(row.tender_id)));
    const allBadcaseProviderPayloadAudit = allBadcaseRowsWithAnchors.map((row) => {
      const state = states.byTender.get(row.tender_id);
      const payloadAudit = providerPayloadDecision(state, row.source_anchors.length ? row.source_anchors : [sourceExcerpt(row)], row.source_lineage);
      return {
        atom_id: row.atom_id,
        tender_id: row.tender_id,
        source_anchor_count: row.source_anchors.length,
        source_anchor_sha256s: row.source_anchors.map((anchor) => sha256(anchor)),
        ...payloadAudit
      };
    });
    const coverageRows = rowsWithAnchors.map((atom) => coverageForAtom(atom, states.byTender.get(atom.tender || atom.tender_id)));
    const coverage = {
      total_atoms: coverageRows.length,
      source_found_in_full_extraction: coverageRows.filter((row) => row.full_extraction_present).length,
      source_covered_by_selected_sections: coverageRows.filter((row) => row.selected_sections_present).length,
      source_covered_by_parse_chunks: coverageRows.filter((row) => row.parse_chunk_present).length,
      source_covered_by_provider_payload: coverageRows.filter((row) => row.provider_payload_present).length,
      cross_chunk_semantic_splits: coverageRows.filter((row) => row.cross_chunk_semantic_split).length,
      unresolved: coverageRows.filter((row) => !row.full_extraction_present).map((row) => row.atom_id),
      gate: 'FAIL'
    };
    coverageRows.sort((a, b) => TENDER_ORDER.indexOf(a.tender_id) - TENDER_ORDER.indexOf(b.tender_id)
      || String(a.atom_id).localeCompare(String(b.atom_id), undefined, { numeric: true }));
    const scopeRoles = [...states.byTender.values()].flatMap((state) => state.analysis.sections || [])
      .map((section) => section.archive_role || section.routing_role || section.section_key);
    const excludedRoles = [...new Set(scopeRoles.filter((role) => !['requirement_extraction', 'requirement_extraction_routed_view', 'unknown_section'].includes(role)))];
    const report = {
      artifact_type: 'V43_REQUIREMENT_PRODUCTION_INPUT_COVERAGE_ROOT_CAUSE_V5',
      artifact_version: 'v5',
      status: 'MECHANICAL_DIAGNOSTIC_ONLY',
      production_run_id: manifest.run_id,
      source_truth_id: sourceTruth.artifact_type === 'GPT_SOURCE_TRUTH_P0_CORE6_V1' ? sourceTruth.artifact_type : 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
      source_truth_sha256: sourceTruthFileSha256,
      source_fidelity_evidence: {
        path: path.relative(ROOT, SOURCE_FIDELITY_PATH),
        sha256: sha256File(SOURCE_FIDELITY_PATH),
        atom_count: sourceFidelity.atom_count,
        production_source_text_found: sourceFidelity.counts?.production_source_text_found ?? null,
        production_source_text_not_found: sourceFidelity.counts?.production_source_text_not_found ?? null,
        semantic_interpretation: sourceFidelity.semantic_interpretation || 'NOT_PERFORMED'
      },
      chain: {
        stages: ['FULL_EXTRACTION', 'SECTION_CLASSIFIER', 'REQUIREMENT_SCOPE_ROUTER', 'CHUNK_BUILDER', 'PERSISTED_PARSE_CHUNK', 'PRODUCTION_PROVIDER_PAYLOAD_BUILDER'],
        authority: 'CURRENT_PRODUCTION_CODE_AND_FROZEN_PRODUCTION_PARSE_CHUNK_HASHES',
        provider_calls: 0,
        llm_calls: 0
      },
      denominator_reconciliation: {
        production_parse_chunk_unique_count: productionChunkCount,
        hash_comparison_record_count: productionChunkCount,
        duplicate_or_auxiliary_record_count: 0,
        reported_204_value: 204,
        reason_for_197_vs_204: '204 is the FAST-01 Requirement candidate/source-verified count recorded by docs/e2e/FAST01_V3/E2E_CHECKPOINT.md and is not a Parse Chunk hash-record count. The frozen Core6 Production run has 197 unique persisted Parse Chunks (28+33+32+26+51+27), with 197 deterministic hash comparisons.',
        manifest_chunk_counts: Object.fromEntries([...states.byTender.values()].map((state) => [state.tender, state.chunks.length]))
      },
      production_parse_reconstruction: states.reconstruction,
      badcase_31_diagnostics: badcaseDiagnostics,
      implicated_chunk_provider_payload_audit: allBadcaseProviderPayloadAudit.flatMap((row) => row.payloads.map((payload) => ({
        atom_id: row.atom_id,
        tender_id: row.tender_id,
        ...payload
      }))),
      implicated_chunk_provider_payload_audit_case_count: allBadcaseProviderPayloadAudit.length,
      full_p0_487_coverage: coverage,
      full_p0_487_coverage_rows: coverageRows,
      systemic_scope_hypothesis: {
        status: 'OBSERVED_SCOPE_BOUNDARY_RISK',
        excluded_section_roles_observed: excludedRoles,
        hypothesis_targets: ['qualification requirements', 'invalidity conditions', 'bid document composition', 'pricing / quotation constraints', 'payment obligations', 'procedural conformity obligations'],
        case_specific_keyword_patch_applied: false,
        full_tender_to_llm_fallback: false,
        semantic_contract_redefined: false,
        interpretation: 'The current scope routing contract explicitly routes several non-technical sections away from Requirement Extraction. The diagnostic records the observed boundary; it does not promote this observation to a semantic root cause or alter routing.'
      },
      v4_authority_status_counts: v4Checkpoint.authority_status_counts,
      v4_artifact_sha256: sha256File(V4_REPORT_PATH),
      final_status: 'BLOCKED_PRODUCTION_INPUT_COVERAGE_ROOT_CAUSE_UNRESOLVED',
      production_repair_applied: false,
      production_db_writes: 0,
      gold_mutations: 0,
      prompt_changes: 0,
      schema_changes: 0,
      normalizer_changes: 0,
      canonicalizer_changes: 0,
      semantic_adjudication_performed: false
    };
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    const checkpoint = buildCheckpoint(report);
    fs.writeFileSync(CHECKPOINT_JSON_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
    writeMarkdown(checkpoint);
    console.log(JSON.stringify({
      report: OUT_PATH,
      checkpoint_json: CHECKPOINT_JSON_PATH,
      checkpoint_md: CHECKPOINT_MD_PATH,
      production_parse_chunk_unique_count: productionChunkCount,
      badcase_31_count: badcaseDiagnostics.length,
      badcase_31_earliest_loss_counts: countBy(badcaseDiagnostics, 'earliest_loss_stage'),
      full_p0_487_coverage: coverage,
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
  earliestLoss,
  diagnoseAtom,
  ALLOWED_EARLIEST_STAGES
};
