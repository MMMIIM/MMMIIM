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

const { Pool } = pg;
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const V2_PACKET_PATH = path.join(DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const OUT_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4.json');
const CHECKPOINT_MD_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT.md');
const CHECKPOINT_JSON_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT.json');

const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const ALLOWED_AUTHORITY_STATUS = new Set([
  'VALID_PROVIDER_INPUT',
  'EVAL_REPLAY_JOIN_MISALIGNMENT',
  'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS',
  'MULTI_CHUNK_BOUNDARY_LOSS',
  'LEVEL3_RECONSTRUCTION',
  'UNRESOLVED'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function stripSha(value) {
  return String(value || '').replace(/^sha256:/i, '');
}

function normalizeLexical(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function containment(haystack, needle) {
  const normalizedHaystack = normalizeLexical(haystack);
  const normalizedNeedle = normalizeLexical(needle);
  return {
    target_normalized_char_count: normalizedNeedle.length,
    haystack_normalized_char_count: normalizedHaystack.length,
    contains: Boolean(normalizedNeedle) && normalizedHaystack.includes(normalizedNeedle)
  };
}

function parseSnapshotRef(ref) {
  const snapshotPath = ref?.path;
  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    return { ok: false, path: snapshotPath || null, error: 'RESTRICTED_EVIDENCE_MISSING' };
  }
  const actualSha = sha256File(snapshotPath);
  const expectedSha = stripSha(ref.sha256);
  if (expectedSha && actualSha !== expectedSha) {
    return { ok: false, path: snapshotPath, error: 'RESTRICTED_EVIDENCE_SHA_MISMATCH' };
  }
  const envelope = readJson(snapshotPath);
  return { ok: true, path: snapshotPath, sha256: actualSha, envelope };
}

function loadProviderInputs(row) {
  const refs = row.replay_evidence?.restricted_evidence_refs || [];
  const inputs = [];
  const errors = [];
  for (const ref of refs) {
    if (!String(ref?.path || '').includes('PROVIDER_INPUT_SNAPSHOT')) continue;
    const snapshot = parseSnapshotRef(ref);
    if (!snapshot.ok) {
      errors.push({ path: snapshot.path, error: snapshot.error });
      continue;
    }
    const evidence = snapshot.envelope?.evidence || {};
    inputs.push({
      snapshot_id: path.basename(snapshot.path),
      snapshot_path: snapshot.path,
      snapshot_sha256: snapshot.sha256,
      task_type: evidence.task_type || null,
      source_chunk_id: evidence.source_chunk_id || null,
      source_refs: Array.isArray(evidence.source_refs) ? evidence.source_refs : [],
      input_length: Number.isInteger(evidence.input_length) ? evidence.input_length : null,
      input_sha256: stripSha(evidence.input_sha256),
      chunk_text: typeof evidence.model_text === 'string' ? evidence.model_text : null
    });
  }
  return { inputs, errors };
}

function extractionScope(extraction) {
  const analysis = classifyTenderSections(extraction);
  return analysis.technicalSection
    ? combineRequirementExtractionSections(analysis.sections)
      || analysis.requirementExtractionSections?.find((section) => section.section_key === 'technical_requirements')
      || analysis.technicalSection
    : null;
}

async function loadProductionChunks(pool, manifest) {
  const manifestTenders = new Map((manifest.tenders || []).map((item) => [item.tender, item]));
  const budget = resolveRequirementChunkBudget(process.env);
  const byId = new Map();
  const byTender = new Map();
  const byTenderText = new Map();
  const reconstruction = [];
  for (const tender of TENDER_ORDER) {
    const expected = manifestTenders.get(tender);
    if (!expected) throw new Error(`CORE6 manifest entry missing: ${tender}`);
    const dbJob = (await pool.query(
      `SELECT j.id,j.tender_file_id,f.original_name,f.storage_key,j.extracted_text_sha256
       FROM tender_parse_jobs j JOIN tender_files f ON f.id=j.tender_file_id WHERE j.id=$1`,
      [expected.parse_job_id]
    )).rows[0];
    if (!dbJob) throw new Error(`Production parse job missing: ${expected.parse_job_id}`);
    const sourcePath = path.join(ROOT, 'uploads', ...String(dbJob.storage_key).split(/[\\/]+/));
    if (!fs.existsSync(sourcePath)) throw new Error(`Production tender source missing: ${sourcePath}`);
    const sourceSha = sha256File(sourcePath);
    if (sourceSha !== expected.source_sha256) {
      throw new Error(`Production tender source SHA mismatch: ${tender}`);
    }
    const extraction = await extractTenderText({
      fileName: dbJob.original_name,
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(sourcePath)
    });
    byTenderText.set(tender, extraction.text);
    const scope = extractionScope(extraction);
    if (!scope) throw new Error(`Production extraction scope missing: ${tender}`);
    const chunks = chunkExtractedText({
      text: scope.content_text,
      paragraphs: scope.paragraphs,
      ...budget
    }).map((chunk) => ({ ...chunk, content_sha256: sha256(chunk.text) }));
    const dbChunks = (await pool.query(
      `SELECT id,parse_job_id,chunk_number,status,character_count,source_start_offset,source_end_offset,
              source_start_page,source_end_page,source_start_paragraph,source_end_paragraph,content_sha256
       FROM tender_parse_chunks WHERE parse_job_id=$1 ORDER BY chunk_number`,
      [expected.parse_job_id]
    )).rows;
    if (chunks.length !== dbChunks.length) throw new Error(`Production chunk count mismatch: ${tender}`);
    const rows = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const computed = chunks[i];
      const persisted = dbChunks[i];
      if (persisted.content_sha256 !== computed.content_sha256 || persisted.character_count !== computed.character_count) {
        throw new Error(`Production chunk text/hash mismatch: ${tender}#${persisted.chunk_number}`);
      }
      const row = {
        chunk_id: persisted.id,
        tender_id: tender,
        parse_job_id: persisted.parse_job_id,
        chunk_number: persisted.chunk_number,
        status: persisted.status,
        persisted_text: computed.text,
        persisted_model_text: computed.text,
        persisted_text_char_count: computed.text.length,
        persisted_text_sha256: persisted.content_sha256,
        source_start_offset: persisted.source_start_offset,
        source_end_offset: persisted.source_end_offset,
        source_start_page: persisted.source_start_page,
        source_end_page: persisted.source_end_page,
        source_start_paragraph: persisted.source_start_paragraph,
        source_end_paragraph: persisted.source_end_paragraph
      };
      byId.set(row.chunk_id, row);
      rows.push(row);
    }
    byTender.set(tender, rows);
    reconstruction.push({
      tender_id: tender,
      parse_job_id: expected.parse_job_id,
      source_file: dbJob.original_name,
      source_sha256: sourceSha,
      chunk_count: rows.length,
      persisted_chunk_hash_alignment: true
    });
  }
  return { byId, byTender, byTenderText, reconstruction };
}

function chunkIdentityList(row) {
  const identities = row.authoritative_replay_input?.chunk_identity;
  if (Array.isArray(identities) && identities.length) return identities;
  const a = row.authoritative_replay_input || {};
  if (a.source_chunk_id) return [{
    authoritative_source_chunk_id: a.source_chunk_id,
    replay_input_authority_level: a.replay_input_authority_level,
    chunk_number: a.chunk_number,
    source_refs: a.source_refs || [],
    source_page_start: a.source_page_start,
    source_page_end: a.source_page_end,
    source_paragraph_start: a.source_paragraph_start,
    source_paragraph_end: a.source_paragraph_end,
    replay_chunk_chars: a.replay_chunk_chars,
    replay_chunk_sha256: a.replay_chunk_sha256
  }];
  return [];
}

function rowAuthorityStatus({ identities, providerInputs, chunkDetails, sourceTruthLocation }) {
  if (!identities.length || !providerInputs.length) return 'UNRESOLVED';
  if (identities.some((item) => Number(item.replay_input_authority_level) === 3
    || String(item.authoritative_source_chunk_id || '').startsWith('reconstructed:'))) {
    return 'LEVEL3_RECONSTRUCTION';
  }
  if (!sourceTruthLocation.found) {
    if (chunkDetails.some((item) => item.source_excerpt_present_in_provider_input)) {
      return 'EVAL_REPLAY_JOIN_MISALIGNMENT';
    }
    return sourceTruthLocation.full_extraction_contains
      ? 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS'
      : 'UNRESOLVED';
  }
  if (sourceTruthLocation.chunk_ids.join('|') !== identities.map((item) => item.authoritative_source_chunk_id).join('|')) {
    return 'EVAL_REPLAY_JOIN_MISALIGNMENT';
  }
  if (identities.length > providerInputs.length) return 'MULTI_CHUNK_BOUNDARY_LOSS';
  if (chunkDetails.some((item) => item.provider_input_source_chunk_id !== item.chunk_id)) return 'EVAL_REPLAY_JOIN_MISALIGNMENT';
  if (chunkDetails.some((item) => !item.source_excerpt_present_in_provider_input)) return 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS';
  if (chunkDetails.every((item) => item.provider_text_matches_persisted_chunk
    && item.source_excerpt_present_in_parse_chunk
    && item.source_excerpt_present_in_provider_input)) return 'VALID_PROVIDER_INPUT';
  return 'EVAL_REPLAY_JOIN_MISALIGNMENT';
}

function locateSourceTruth(sourceExcerpt, tenderChunks, fullExtractionText) {
  const single = tenderChunks.filter((chunk) => containment(chunk.persisted_text, sourceExcerpt).contains);
  if (single.length) {
    return {
      found: true,
      full_extraction_contains: true,
      method: 'SINGLE_CHUNK_CONTAINMENT',
      chunk_ids: single.map((chunk) => chunk.chunk_id),
      chunk_numbers: single.map((chunk) => chunk.chunk_number)
    };
  }
  for (let index = 0; index < tenderChunks.length - 1; index += 1) {
    const left = tenderChunks[index];
    const right = tenderChunks[index + 1];
    if (containment(`${left.persisted_text}\n${right.persisted_text}`, sourceExcerpt).contains) {
      return {
        found: true,
        full_extraction_contains: true,
        method: 'ADJACENT_CHUNK_CONCATENATION',
        chunk_ids: [left.chunk_id, right.chunk_id],
        chunk_numbers: [left.chunk_number, right.chunk_number]
      };
    }
  }
  return {
    found: false,
    full_extraction_contains: containment(fullExtractionText, sourceExcerpt).contains,
    method: 'NOT_FOUND_IN_PERSISTED_PARSE_CHUNKS',
    chunk_ids: [],
    chunk_numbers: []
  };
}

function buildRow(row, productionChunks) {
  const sourceExcerpt = row.source_truth?.source_excerpt || '';
  const identities = chunkIdentityList(row);
  const inputResult = loadProviderInputs(row);
  const providerInputs = inputResult.inputs;
  const tenderChunks = productionChunks.byTender.get(row.tender_id) || [];
  const sourceTruthLocation = locateSourceTruth(
    sourceExcerpt,
    tenderChunks,
    productionChunks.byTenderText.get(row.tender_id) || ''
  );
  const chunkDetails = identities.map((identity) => {
    const chunkId = identity.authoritative_source_chunk_id;
    const persisted = productionChunks.byId.get(chunkId);
    const providerInput = providerInputs.find((input) => input.source_chunk_id === chunkId) || providerInputs[0] || null;
    const providerText = providerInput?.chunk_text || '';
    const parseContainment = containment(persisted?.persisted_text || '', sourceExcerpt);
    const providerContainment = containment(providerText, sourceExcerpt);
    const providerTextSha = providerText ? sha256(providerText) : null;
    const providerTextMatchesPersisted = Boolean(persisted && providerText
      && providerText.length === persisted.persisted_text_char_count
      && providerTextSha === persisted.persisted_text_sha256);
    let authorityStatus = 'UNRESOLVED';
    if (String(chunkId || '').startsWith('reconstructed:') || Number(identity.replay_input_authority_level) === 3) {
      authorityStatus = 'LEVEL3_RECONSTRUCTION';
    } else if (!persisted) {
      authorityStatus = 'UNRESOLVED';
    } else if (!providerInput) {
      authorityStatus = 'UNRESOLVED';
    } else if (providerInput.source_chunk_id !== chunkId) {
      authorityStatus = 'EVAL_REPLAY_JOIN_MISALIGNMENT';
    } else if (!providerContainment.contains) {
      authorityStatus = 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS';
    } else if (!providerTextMatchesPersisted) {
      authorityStatus = 'EVAL_REPLAY_JOIN_MISALIGNMENT';
    } else if (!parseContainment.contains) {
      authorityStatus = 'UNRESOLVED';
    } else {
      authorityStatus = 'VALID_PROVIDER_INPUT';
    }
    return {
      chunk_id: chunkId,
      chunk_number: identity.chunk_number ?? persisted?.chunk_number ?? null,
      replay_input_authority_level: identity.replay_input_authority_level ?? null,
      persisted_parse_chunk_present: Boolean(persisted),
      persisted_chunk_text_char_count: persisted?.persisted_text_char_count ?? null,
      persisted_chunk_text_sha256: persisted?.persisted_text_sha256 ?? null,
      persisted_source_start_page: persisted?.source_start_page ?? null,
      persisted_source_end_page: persisted?.source_end_page ?? null,
      persisted_source_start_paragraph: persisted?.source_start_paragraph ?? null,
      persisted_source_end_paragraph: persisted?.source_end_paragraph ?? null,
      provider_input_snapshot_id: providerInput?.snapshot_id ?? null,
      provider_input_snapshot_sha256: providerInput?.snapshot_sha256 ?? null,
      provider_input_source_chunk_id: providerInput?.source_chunk_id ?? null,
      provider_input_task_type: providerInput?.task_type ?? null,
      provider_task_payload_chunk_text_char_count: providerText ? providerText.length : null,
      provider_task_payload_chunk_text_sha256: providerTextSha,
      provider_input_declared_char_count: providerInput?.input_length ?? null,
      provider_input_declared_sha256: providerInput?.input_sha256 || null,
      source_excerpt_present_in_parse_chunk: parseContainment.contains,
      source_excerpt_present_in_provider_input: providerContainment.contains,
      normalized_lexical_containment_evidence: {
        parse_chunk: parseContainment,
        provider_input: providerContainment
      },
      provider_text_matches_persisted_chunk: providerTextMatchesPersisted,
      authority_status: authorityStatus
    };
  });
  const authorityStatus = rowAuthorityStatus({ identities, providerInputs, chunkDetails, sourceTruthLocation });
  if (!ALLOWED_AUTHORITY_STATUS.has(authorityStatus)) throw new Error(`Invalid authority status: ${authorityStatus}`);
  return {
    atom_id: row.atom_id,
    tender_id: row.tender_id,
    frozen_semantic_label: row.frozen_semantic_label || null,
    frozen_semantic_label_provenance: 'V2_HISTORICAL_INPUT_NOT_NEW_ADJUDICATION',
    source_truth: {
      page: row.source_truth?.page ?? null,
      source_excerpt: sourceExcerpt,
      source_excerpt_sha256: sha256(sourceExcerpt),
      atomic_requirement: row.source_truth?.atomic_requirement || null,
      p0_basis: row.source_truth?.p0_basis || null,
      family: row.source_truth?.family || null
    },
    source_truth_located_parse_chunk_ids: sourceTruthLocation.chunk_ids,
    source_truth_located_parse_chunk_numbers: sourceTruthLocation.chunk_numbers,
    source_truth_location_method: sourceTruthLocation.method,
    source_truth_present_in_full_extraction: sourceTruthLocation.full_extraction_contains,
    source_excerpt_present_in_persisted_parse_chunk_set: sourceTruthLocation.found,
    source_excerpt_present_in_provider_input_set: chunkDetails.some((item) => item.source_excerpt_present_in_provider_input),
    production_parse_chunk_ids: sourceTruthLocation.chunk_ids,
    replay_selected_parse_chunk_ids: identities.map((item) => item.authoritative_source_chunk_id),
    provider_input_snapshot_ids: providerInputs.map((input) => input.snapshot_id),
    chunks: chunkDetails,
    authority_status: authorityStatus,
    authority_reason: authorityStatus === 'VALID_PROVIDER_INPUT'
      ? 'Frozen Source Truth excerpt is contained in the persisted Production Parse Chunk and in the matching provider input, with exact persisted text SHA/length equality.'
      : 'Mechanical authority gate did not establish that the frozen Source Truth excerpt was present in the matching actual provider input; no semantic conclusion is made.',
    source_identity_authority: 'BACKEND_PRODUCTION_PARSE_CHUNK',
    replay_input_authority_level: Math.max(...identities.map((item) => Number(item.replay_input_authority_level) || 0), 0),
    restricted_evidence_errors: inputResult.errors
  };
}

function sortRows(rows) {
  const rank = new Map(TENDER_ORDER.map((tender, index) => [tender, index]));
  return rows.sort((a, b) => (rank.get(a.tender_id) ?? 999) - (rank.get(b.tender_id) ?? 999)
    || a.atom_id.localeCompare(b.atom_id, undefined, { numeric: true }));
}

function buildCheckpoint(report, productionChunks) {
  const counts = Object.fromEntries([...ALLOWED_AUTHORITY_STATUS].map((status) => [status, 0]));
  for (const row of report.rows) counts[row.authority_status] += 1;
  const chunkCounts = report.rows.flatMap((row) => row.chunks);
  const validRows = report.rows.filter((row) => row.authority_status === 'VALID_PROVIDER_INPUT').length;
  const unresolved = report.rows.filter((row) => row.authority_status === 'UNRESOLVED').map((row) => row.atom_id);
  const coverageLoss = report.rows.filter((row) => row.authority_status === 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS').map((row) => row.atom_id);
  const productionParseCoverageLoss = report.rows
    .filter((row) => row.source_truth_location_method === 'NOT_FOUND_IN_PERSISTED_PARSE_CHUNKS'
      && row.source_truth_present_in_full_extraction === true)
    .map((row) => row.atom_id);
  const misalignment = report.rows.filter((row) => row.authority_status === 'EVAL_REPLAY_JOIN_MISALIGNMENT').map((row) => row.atom_id);
  const multi = report.rows.filter((row) => row.authority_status === 'MULTI_CHUNK_BOUNDARY_LOSS').map((row) => row.atom_id);
  const level3 = report.rows.filter((row) => row.authority_status === 'LEVEL3_RECONSTRUCTION').map((row) => row.atom_id);
  const gatePass = report.rows.length === 44 && validRows === 44;
  return {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4_CHECKPOINT',
    artifact_version: 'v4',
    source_truth_id: report.source_truth_id,
    source_truth_sha256: report.source_truth_sha256,
    production_run_id: report.production_run_id,
    replay_run_id: report.replay_run_id,
    target_source_evidence_in_provider_input: gatePass ? 'PASS' : 'FAIL',
    case_count: report.rows.length,
    authority_status_counts: counts,
    valid_provider_input_case_count: validRows,
    parse_chunk_reconstruction: productionChunks.reconstruction,
    chunk_evidence_row_count: chunkCounts.length,
    multi_chunk_case_ids: multi,
    level3_reconstruction_case_ids: level3,
    eval_replay_join_misalignment_case_ids: misalignment,
    parse_to_provider_input_coverage_loss_case_ids: coverageLoss,
    production_parse_coverage_loss_case_ids: productionParseCoverageLoss,
    production_parse_to_provider_input_coverage_loss_confirmed: productionParseCoverageLoss.length > 0,
    unresolved_case_ids: unresolved,
    corrected_provider_replays_required: gatePass ? 0 : null,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    semantic_adjudication_performed: false,
    final_status: productionParseCoverageLoss.length > 0
      ? 'PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS_CONFIRMED'
      : (gatePass
        ? 'READY_FOR_GPT_P0_44_SEMANTIC_ROOT_CAUSE_ADJUDICATION_V4'
        : 'BLOCKED_REPLAY_INPUT_AUTHORITY_UNRESOLVED')
  };
}

function writeCheckpointMarkdown(checkpoint) {
  const lines = [
    '# V43 P0 Badcase 44 Replay Input Authority V4 Checkpoint',
    '',
    `- TARGET_SOURCE_EVIDENCE_IN_PROVIDER_INPUT: ${checkpoint.target_source_evidence_in_provider_input}`,
    `- CASE_COUNT: ${checkpoint.case_count}`,
    `- VALID_PROVIDER_INPUT_CASE_COUNT: ${checkpoint.valid_provider_input_case_count}`,
    `- AUTHORITY_STATUS_COUNTS: ${JSON.stringify(checkpoint.authority_status_counts)}`,
    `- MULTI_CHUNK_CASE_IDS: ${JSON.stringify(checkpoint.multi_chunk_case_ids)}`,
    `- LEVEL3_RECONSTRUCTION_CASE_IDS: ${JSON.stringify(checkpoint.level3_reconstruction_case_ids)}`,
    `- EVAL_REPLAY_JOIN_MISALIGNMENT_CASE_IDS: ${JSON.stringify(checkpoint.eval_replay_join_misalignment_case_ids)}`,
    `- PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS_CASE_IDS: ${JSON.stringify(checkpoint.parse_to_provider_input_coverage_loss_case_ids)}`,
    `- PRODUCTION_PARSE_COVERAGE_LOSS_CASE_IDS: ${JSON.stringify(checkpoint.production_parse_coverage_loss_case_ids)}`,
    `- PRODUCTION_PARSE_TO_PROVIDER_INPUT_COVERAGE_LOSS_CONFIRMED: ${checkpoint.production_parse_to_provider_input_coverage_loss_confirmed}`,
    `- UNRESOLVED_CASE_IDS: ${JSON.stringify(checkpoint.unresolved_case_ids)}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- SEMANTIC_ADJUDICATION_PERFORMED: ${checkpoint.semantic_adjudication_performed}`,
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    '',
    'All comparisons are mechanical. No semantic root cause, failure-family membership, or post-repair label was inferred.'
  ];
  fs.writeFileSync(CHECKPOINT_MD_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  dotenv.config({ path: path.join(ROOT, 'backend', '.env') });
  dotenv.config({ path: path.join(ROOT, '.env') });
  const packet = readJson(V2_PACKET_PATH);
  const manifest = readJson(MANIFEST_PATH);
  if (packet.rows?.length !== 44) throw new Error(`V2 packet must contain 44 rows; got ${packet.rows?.length}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const productionChunks = await loadProductionChunks(pool, manifest);
    const rows = sortRows(packet.rows.map((row) => buildRow(row, productionChunks)));
    const report = {
      artifact_type: 'V43_P0_BADCASE_44_REPLAY_INPUT_AUTHORITY_V4',
      artifact_version: 'v4',
      source_truth_id: packet.source_truth_id || 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
      source_truth_sha256: packet.source_truth_sha256,
      production_run_id: packet.production_run_id || manifest.run_id,
      replay_run_id: packet.replay_run_id || 'V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V2',
      replay_input_authority: 'ORIGINAL_PROVIDER_INPUT > ORIGINAL_PRODUCTION_PARSE_CHUNK > DETERMINISTIC_PARSE_RECONSTRUCTION',
      forbidden_authority_sources: ['R3 mechanical output lineage', 'same_page_span_only', 'shared-ngram output linkage', 'Canonical Requirement source excerpt'],
      target_source_evidence_in_provider_input_gate: 'REQUIRED',
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      semantic_adjudication_performed: false,
      rows
    };
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    const checkpoint = buildCheckpoint(report, productionChunks);
    fs.writeFileSync(CHECKPOINT_JSON_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
    writeCheckpointMarkdown(checkpoint);
    console.log(JSON.stringify({
      output: OUT_PATH,
      checkpoint: CHECKPOINT_MD_PATH,
      checkpoint_json: CHECKPOINT_JSON_PATH,
      case_count: rows.length,
      authority_status_counts: checkpoint.authority_status_counts,
      final_status: checkpoint.final_status,
      provider_calls: 0,
      production_db_writes: 0
    }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

export {
  normalizeLexical,
  containment,
  chunkIdentityList,
  rowAuthorityStatus,
  ALLOWED_AUTHORITY_STATUS
};
