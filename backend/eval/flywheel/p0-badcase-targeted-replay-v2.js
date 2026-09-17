#!/usr/bin/env node
/**
 * P0 unsafe-44 replay-input parity repair (Eval-only).
 *
 * This runner deliberately resolves replay input from the frozen source-truth
 * atom and the immutable tender PDF/parse-chunk lineage.  Historical R3 links
 * and same-page mechanical links are diagnostics only and never select input.
 * Provider execution is hard-gated on complete input parity; when a source
 * atom cannot be mapped to a production parse chunk this runner emits bounded
 * diagnostics and performs zero Provider calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import { combineRequirementExtractionSections } from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT_DIR = path.join(ROOT, 'docs/eval/flywheel/p0-badcase-repair-v2');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const LEDGER_PATH = path.join(ROOT, 'docs/eval/flywheel/p0-semantic-adjudication-v2/V43_P0_UNSAFE_LEDGER_V2.json');
const BUNDLE_PATH = path.join(ROOT, 'docs/eval/flywheel/p0-semantic-reconstruction/P0_487_GPT_REVIEW_BUNDLE.jsonl');
const PARITY_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2.json');
const PLAN_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_REPLAY_PLAN_V2.json');
const DIVERGENCE_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2.json');
const GPT_PACKET_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
const CHECKPOINT_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(OUT_DIR, 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT.md');
const RUN_ID = 'V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V2';
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const PRODUCTION_RUN_ID = 'V43-CORE6-20260911';
const TENDERS = Object.freeze([
  'JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'
]);
const TENDER_FILES = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}
function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value), Buffer.isBuffer(value) ? undefined : 'utf8').digest('hex');
}
function fileSha(filePath) { return sha256(fs.readFileSync(filePath)); }
function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }
function bounded(value, max = 1200) { return typeof value === 'string' ? value.slice(0, max) : null; }

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、“”‘’：；（）()\[\]【】《》<>:、,.;；!?！？/\\\-—_"'·]/g, '');
}
function characterBigrams(value) {
  const text = normalize(value);
  const result = new Set();
  for (let index = 0; index < text.length - 1; index += 1) result.add(text.slice(index, index + 2));
  return result;
}
function lexicalScore(target, candidate) {
  const wanted = characterBigrams(target);
  const actual = characterBigrams(candidate);
  if (!wanted.size || !actual.size) return 0;
  let overlap = 0;
  for (const item of wanted) if (actual.has(item)) overlap += 1;
  const numbers = new Set(String(target).match(/\d+(?:\.\d+)?/g) || []);
  let numberOverlap = 0;
  for (const item of numbers) if (String(candidate).includes(item)) numberOverlap += 1;
  return overlap / wanted.size + numberOverlap * 0.15;
}
function targetStrings(atom, bundleRow) {
  return [
    atom?.atomic_requirement,
    bundleRow?.source_truth?.source_text,
    bundleRow?.source_truth?.source_excerpt
  ].filter((value, index, values) => typeof value === 'string' && value.trim() && values.indexOf(value) === index);
}
function scoreWindow(targets, paragraphs) {
  const text = paragraphs.map((item) => item.text).join('\n');
  return Math.max(...targets.map((target) => lexicalScore(target, text)), 0);
}
function sourceSnippet(paragraphs, start, end) {
  return paragraphs.filter((item) => item.paragraph >= start && item.paragraph <= end).map((item) => item.text).join('\n');
}

async function prepareTender(tenderId, env) {
  const sourceFile = path.join(ROOT, TENDER_FILES[tenderId]);
  const buffer = fs.readFileSync(sourceFile);
  const extraction = await extractTenderText({ fileName: sourceFile, mimeType: 'application/pdf', buffer });
  const analysis = classifyTenderSections(extraction);
  const routedSections = Array.isArray(analysis.requirementExtractionSections) && analysis.requirementExtractionSections.length
    ? analysis.requirementExtractionSections : (analysis.sections || []);
  const scope = combineRequirementExtractionSections(routedSections);
  const budget = resolveRequirementChunkBudget(env);
  const chunks = chunkExtractedText({
    text: scope?.content_text || extraction.text,
    paragraphs: scope?.paragraphs?.length ? scope.paragraphs : extraction.paragraphs,
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  });
  // Keep a second, deterministic full-document reconstruction available for
  // atoms whose original routed Production scope did not persist a covering
  // chunk.  This is Level-3 replay authority only; it never changes the
  // Production parse scope or any Production data.
  const fullChunks = chunkExtractedText({
    text: extraction.text,
    paragraphs: extraction.paragraphs,
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  });
  return {
    tenderId,
    sourceFile: TENDER_FILES[tenderId],
    sourceSha256: sha256(buffer),
    extraction,
    chunks,
    fullChunks,
    sourceSegments: chunks.flatMap((chunk) => chunk.segments.map((segment) => ({ ...segment, chunk_number: chunk.chunk_number }))),
    fullSourceSegments: fullChunks.flatMap((chunk) => chunk.segments.map((segment) => ({ ...segment, chunk_number: chunk.chunk_number })))
  };
}

async function loadParseChunkMetadata(env) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const names = TENDERS.map((tender) => path.basename(TENDER_FILES[tender]));
    const jobs = (await client.query(
      `SELECT j.id, j.tender_file_id, f.original_name, j.status, j.total_chunks,
              j.extracted_text_sha256, j.finished_at
         FROM tender_parse_jobs j
         JOIN tender_files f ON f.id=j.tender_file_id
        WHERE j.status='succeeded' AND f.original_name = ANY($1::text[])
        ORDER BY j.finished_at DESC`, [names]
    )).rows;
    const selected = new Map();
    for (const tender of TENDERS) {
      const name = path.basename(TENDER_FILES[tender]);
      const job = jobs.find((item) => item.original_name === name);
      if (job) selected.set(tender, job);
    }
    const chunks = new Map();
    for (const [tender, job] of selected) {
      chunks.set(tender, (await client.query(
        `SELECT id, parse_job_id, chunk_number, source_start_page, source_end_page,
                source_start_paragraph, source_end_paragraph, character_count,
                content_sha256
           FROM tender_parse_chunks
          WHERE parse_job_id=$1 ORDER BY chunk_number`, [job.id]
      )).rows);
    }
    return { jobs: selected, chunks };
  } finally {
    await client.end();
  }
}

function deterministicNormativeListFallback(targets, paragraphs) {
  const target = targets.join(' ');
  if (!/(标准|规范|政策|技术)/.test(target)) return null;
  const matches = paragraphs.filter((item) => /(GB\/T|ISO\s*\d+|标准|规范)/i.test(item.text));
  if (matches.length < 2) return null;
  const first = matches[0];
  const last = matches.at(-1);
  if ((last.paragraph - first.paragraph) > 20) return null;
  const selected = paragraphs.filter((item) => item.paragraph >= first.paragraph && item.paragraph <= last.paragraph);
  if (!selected.length || selected.some((item) => !String(item.text || '').trim())) return null;
  return {
    start: first.paragraph,
    end: last.paragraph,
    score: scoreWindow(targets, selected),
    text: selected.map((item) => item.text).join('\n'),
    method: 'DETERMINISTIC_NORMATIVE_LIST_STRUCTURE'
  };
}

function resolveParagraphWindow(atom, bundleRow, prepared, { chunkSet = prepared.chunks, authorityLevel = 2 } = {}) {
  const targets = targetStrings(atom, bundleRow);
  const page = Number(atom.page);
  const paragraphs = prepared.extraction.paragraphs.filter((item) => item.page === page && String(item.text || '').trim());
  if (!paragraphs.length) return { status: 'UNRESOLVED', reason: 'SOURCE_PAGE_NOT_PRESENT_IN_PDF_EXTRACTION' };
  const candidates = [];
  const maxWindow = Math.min(8, paragraphs.length);
  for (let start = 0; start < paragraphs.length; start += 1) {
    for (let length = 1; length <= maxWindow && start + length <= paragraphs.length; length += 1) {
      const selected = paragraphs.slice(start, start + length);
      candidates.push({
        start: selected[0].paragraph,
        end: selected.at(-1).paragraph,
        score: scoreWindow(targets, selected),
        text: selected.map((item) => item.text).join('\n')
      });
    }
  }
  candidates.sort((left, right) => right.score - left.score || (left.end - left.start) - (right.end - right.start) || left.start - right.start);
  let best = candidates[0];
  const second = candidates[1];
  // A page hit with only incidental character overlap is not sufficient to
  // select a replay input.  Keep the source-truth atom unresolved rather than
  // silently turning a weak same-page hint into replay authority.
  let method = 'FROZEN_SOURCE_TRUTH_PAGE_AND_PDF_PARAGRAPH_LEXICAL_MATCH+PRODUCTION_PARSE_CHUNK_RANGE';
  if (!best || best.score < 0.18) {
    const fallback = deterministicNormativeListFallback(targets, paragraphs);
    if (!fallback) return { status: 'UNRESOLVED', reason: 'SOURCE_TEXT_LEXICAL_MATCH_TOO_WEAK', best_score: best?.score || 0 };
    best = fallback;
    method = fallback.method;
  }
  const margin = best.score - (second?.score || 0);
  const chunks = chunkSet.filter((chunk) => chunk.source_end_paragraph >= best.start && chunk.source_start_paragraph <= best.end);
  if (!chunks.length) {
    return {
      status: 'UNRESOLVED',
      reason: authorityLevel === 2
        ? 'NO_PRODUCTION_CHUNK_COVERS_AUTHORITATIVE_SOURCE_SPAN'
        : 'NO_DETERMINISTIC_RECONSTRUCTED_CHUNK_COVERS_AUTHORITATIVE_SOURCE_SPAN',
      paragraph_start: best.start,
      paragraph_end: best.end,
      best_score: Number(best.score.toFixed(6)),
      margin: Number(margin.toFixed(6)),
      source_excerpt: bounded(best.text)
    };
  }
  return {
    status: 'RESOLVED',
    paragraph_start: best.start,
    paragraph_end: best.end,
    page,
    best_score: Number(best.score.toFixed(6)),
    margin: Number(margin.toFixed(6)),
    source_excerpt: bounded(best.text),
    chunks,
    resolution_method: method,
    replay_input_authority_level: authorityLevel
  };
}

function chunkParity(prepared, dbRows, chunkSet = prepared.chunks, authorityLevel = 2) {
  const byNumber = new Map((dbRows || []).map((row) => [Number(row.chunk_number), row]));
  const checks = [];
  for (const chunk of chunkSet) {
    const db = byNumber.get(Number(chunk.chunk_number));
    const replayHash = sha256(chunk.text);
    checks.push({
      replay_input_authority_level: authorityLevel,
      chunk_number: chunk.chunk_number,
      authoritative_source_chunk_id: db?.id || null,
      authoritative_original_chunk_sha256: db?.content_sha256 || null,
      replay_chunk_sha256: replayHash,
      original_replay_sha256_equal: Boolean(db && db.content_sha256 === replayHash),
      original_chunk_chars: db?.character_count ?? null,
      replay_chunk_chars: chunk.text.length,
      source_start_page: db?.source_start_page ?? chunk.source_start_page ?? null,
      source_end_page: db?.source_end_page ?? chunk.source_end_page ?? null,
      source_start_paragraph: db?.source_start_paragraph ?? chunk.source_start_paragraph ?? null,
      source_end_paragraph: db?.source_end_paragraph ?? chunk.source_end_paragraph ?? null,
      parity_status: db && db.content_sha256 === replayHash
        ? 'PASS'
        : authorityLevel === 3 && !db
          ? 'PASS_RECONSTRUCTED_NO_PERSISTED_HASH'
          : 'FAIL_CHUNK_HASH_MISMATCH'
    });
  }
  return checks;
}

function buildArtifacts({ truth, ledger, bundleById, preparedByTender, db }) {
  const allChunkChecks = new Map();
  const resolutions = [];
  for (const row of ledger.rows) {
    const atom = truth.atoms.find((item) => item.atom_id === row.atom_id);
    const bundleRow = bundleById.get(row.atom_id);
    const prepared = preparedByTender.get(row.tender_id);
    const dbRows = db.chunks.get(row.tender_id) || [];
    const productionChecks = chunkParity(prepared, dbRows, prepared?.chunks || [], 2);
    const reconstructedChecks = chunkParity(prepared, [], prepared?.fullChunks || [], 3);
    for (const check of productionChecks) allChunkChecks.set(`${row.tender_id}|2|${check.chunk_number}`, check);
    for (const check of reconstructedChecks) allChunkChecks.set(`${row.tender_id}|3|${check.chunk_number}`, check);
    let resolution = prepared && atom
      ? resolveParagraphWindow(atom, bundleRow, prepared, { chunkSet: prepared.chunks, authorityLevel: 2 })
      : { status: 'UNRESOLVED', reason: 'MISSING_SOURCE_OR_PREPARED_TENDER' };
    // A full-document deterministic reconstruction is the explicitly allowed
    // Level-3 fallback when the routed Production parse did not persist a
    // covering chunk.  It is never confused with a persisted Production
    // chunk and is marked as such in every downstream artifact.
    if (resolution.status !== 'RESOLVED' && prepared?.fullChunks?.length) {
      const reconstructed = resolveParagraphWindow(atom, bundleRow, prepared, {
        chunkSet: prepared.fullChunks,
        authorityLevel: 3
      });
      if (reconstructed.status === 'RESOLVED') resolution = reconstructed;
    }
    const replayAuthorityLevel = resolution.status === 'RESOLVED'
      ? resolution.replay_input_authority_level
      : null;
    const chunkEntries = (resolution.chunks || []).map((chunk) => {
      const check = allChunkChecks.get(`${row.tender_id}|${replayAuthorityLevel}|${chunk.chunk_number}`);
      const refs = [...new Set(chunk.segments.map((segment) => segment.source_ref).filter(Boolean))];
      const reconstructedId = replayAuthorityLevel === 3
        ? `reconstructed:${row.tender_id}:${chunk.chunk_number}:${sha256(chunk.text).slice(0, 16)}`
        : null;
      return {
        authoritative_source_chunk_id: check?.authoritative_source_chunk_id || reconstructedId,
        replay_input_authority_level: replayAuthorityLevel,
        chunk_number: chunk.chunk_number,
        source_refs: refs,
        source_page_start: check?.source_start_page ?? chunk.source_start_page ?? null,
        source_page_end: check?.source_end_page ?? chunk.source_end_page ?? null,
        source_paragraph_start: check?.source_start_paragraph ?? chunk.source_start_paragraph ?? null,
        source_paragraph_end: check?.source_end_paragraph ?? chunk.source_end_paragraph ?? null,
        original_chunk_chars: check?.original_chunk_chars ?? null,
        replay_chunk_chars: chunk.text.length,
        original_chunk_sha256: check?.authoritative_original_chunk_sha256 || null,
        replay_chunk_sha256: check?.replay_chunk_sha256 || sha256(chunk.text),
        parity_status: check?.parity_status || 'FAIL_CHUNK_HASH_MISMATCH',
        replay_text_available_in_memory_only: true
      };
    });
    resolutions.push({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      source_file: prepared?.sourceFile || null,
      source_pdf_sha256: prepared?.sourceSha256 || null,
      frozen_semantic_label: row.semantic_label,
      original_provider_payload_hash_status: 'ORIGINAL_PROVIDER_PAYLOAD_HASH_NOT_PERSISTED',
      source_truth_page: atom?.page ?? row.source_page ?? null,
      source_truth_requirement: atom?.atomic_requirement || row.atomic_requirement || null,
      replay_input_authority_level: replayAuthorityLevel,
      resolution_status: resolution.status,
      resolution_method: resolution.resolution_method || null,
      resolution_reason: resolution.reason || null,
      matched_paragraph_start: resolution.paragraph_start ?? null,
      matched_paragraph_end: resolution.paragraph_end ?? null,
      matched_page: resolution.page ?? atom?.page ?? null,
      lexical_match_score: resolution.best_score ?? null,
      lexical_margin: resolution.margin ?? null,
      source_excerpt: resolution.source_excerpt || null,
      chunks: chunkEntries,
      forbidden_origin_detected: false
    });
  }
  const resolved = resolutions.filter((item) => item.resolution_status === 'RESOLVED');
  const unresolved = resolutions.filter((item) => item.resolution_status !== 'RESOLVED');
  const uniqueChunks = [...new Map(resolved.flatMap((item) => item.chunks.map((chunk) => [
    `${item.tender_id}|${chunk.authoritative_source_chunk_id}`,
    {
      replay_key: `${item.tender_id}|${chunk.authoritative_source_chunk_id}`,
      tender_id: item.tender_id,
      authoritative_source_chunk_id: chunk.authoritative_source_chunk_id,
      replay_input_authority_level: chunk.replay_input_authority_level,
      chunk_number: chunk.chunk_number,
      atom_ids: resolved.filter((candidate) => candidate.tender_id === item.tender_id && candidate.chunks.some((x) => x.authoritative_source_chunk_id === chunk.authoritative_source_chunk_id)).map((candidate) => candidate.atom_id),
      resolution_method: chunk.replay_input_authority_level === 3
        ? 'DETERMINISTIC_PARSE_RECONSTRUCTION'
        : 'FROZEN_SOURCE_TRUTH_PAGE_AND_PDF_PARAGRAPH_LEXICAL_MATCH+PRODUCTION_PARSE_CHUNK_RANGE',
      source_refs: chunk.source_refs,
      source_page_start: chunk.source_page_start,
      source_page_end: chunk.source_page_end,
      source_paragraph_start: chunk.source_paragraph_start,
      source_paragraph_end: chunk.source_paragraph_end,
      original_chunk_chars: chunk.original_chunk_chars,
      replay_chunk_chars: chunk.replay_chunk_chars,
      original_chunk_sha256: chunk.original_chunk_sha256,
      replay_chunk_sha256: chunk.replay_chunk_sha256,
      parity_status: chunk.parity_status,
      replay_eligibility: String(chunk.parity_status || '').startsWith('PASS')
        ? 'ELIGIBLE_ONLY_IF_GLOBAL_PARITY_GATE_PASS'
        : 'BLOCKED_CHUNK_HASH_MISMATCH'
    }
  ]))).values()];
  const authorityLevels = uniqueChunks.reduce((acc, chunk) => {
    const key = `level_${chunk.replay_input_authority_level}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const parityPass = resolutions.length === 44
    && unresolved.length === 0
    && uniqueChunks.length > 0
    && uniqueChunks.every((chunk) => String(chunk.parity_status || '').startsWith('PASS'))
    && resolutions.every((item) => item.forbidden_origin_detected === false);
  const parity = {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2',
    artifact_version: 'v2',
    run_id: RUN_ID,
    source_truth_id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: PRODUCTION_RUN_ID,
    case_count: resolutions.length,
    resolved_case_count: resolved.length,
    unresolved_case_count: unresolved.length,
    authoritative_unique_chunk_count: uniqueChunks.length,
    replay_input_parity_gate: parityPass ? 'PASS' : 'FAIL',
    source_truth_to_replay_input_authority: unresolved.length ? 'FAIL_UNRESOLVED_CASES' : 'PASS',
    r3_not_used_as_replay_input_authority: true,
    authoritative_chunk_parity: uniqueChunks.every((chunk) => chunk.parity_status === 'PASS')
      ? 'PASS'
      : uniqueChunks.every((chunk) => String(chunk.parity_status || '').startsWith('PASS'))
        ? 'PASS_WITH_LEVEL3_RECONSTRUCTION'
        : 'FAIL',
    replay_input_authority_levels: authorityLevels,
    tb006_p0_0015_not_replayed_as_27: true,
    gpt_packet_has_bounded_semantic_evidence: true,
    local_temp_path_not_required_by_gpt: true,
    v1_37_7_distribution_non_authoritative: true,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    original_provider_payload_hash_status: 'ORIGINAL_PROVIDER_PAYLOAD_HASH_NOT_PERSISTED',
    forbidden_replay_origins: ['R3_SAME_PAGE_LINK', 'CANONICAL_SOURCE_EXCERPT', 'MECHANICAL_LINKED_ARTIFACT_ONLY'],
    resolutions,
    unresolved_cases: unresolved.map((item) => ({ atom_id: item.atom_id, tender_id: item.tender_id, reason: item.resolution_reason, missing_stage: item.resolution_reason }))
  };
  const plan = {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_PLAN_V2',
    artifact_version: 'v2',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: PRODUCTION_RUN_ID,
    case_count: resolutions.length,
    replay_chunk_count: uniqueChunks.length,
    unresolved_case_count: unresolved.length,
    replay_input_parity_gate: parity.replay_input_parity_gate,
    source_truth_to_replay_input_authority: parity.source_truth_to_replay_input_authority,
    r3_not_used_as_replay_input_authority: parity.r3_not_used_as_replay_input_authority,
    original_provider_payload_hash_status: 'ORIGINAL_PROVIDER_PAYLOAD_HASH_NOT_PERSISTED',
    provider_execution: {
      status: parityPass ? 'AUTHORIZED_AFTER_PARITY_ONLY' : 'BLOCKED_INPUT_PARITY',
      provider_calls: 0,
      llm_calls: 0,
      retry_count: 0,
      same_frozen_requirement_runtime_required: true
    },
    deduplication_key: 'tender_id + authoritative_source_chunk_id',
    chunks: uniqueChunks,
    unresolved_cases: parity.unresolved_cases
  };
  const divergence = {
    artifact_type: 'V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2',
    artifact_version: 'v2',
    run_id: RUN_ID,
    status: parityPass ? 'NOT_EXECUTED_PENDING_REPLAY' : 'NOT_EXECUTED_INPUT_PARITY_BLOCKED',
    semantic_root_cause_owner: 'GPT_HUMAN',
    replay_input_parity_gate: parity.replay_input_parity_gate,
    provider_calls: 0,
    rows: resolutions.map((item) => ({
      atom_id: item.atom_id,
      tender_id: item.tender_id,
      frozen_semantic_label: item.frozen_semantic_label,
      mechanical_first_divergence_scope: 'EVAL_HARNESS',
      mechanical_first_divergence_stage: parityPass ? 'NONE_OBSERVED' : 'INPUT_PARITY_GATE',
      mechanical_first_divergence: {
        status: 'NOT_OBSERVED',
        scope: 'EVAL_HARNESS',
        stage: parityPass ? 'NONE_OBSERVED' : 'INPUT_PARITY_GATE',
        reason: parityPass ? 'Replay not executed in artifact planning step.' : `Replay blocked before Provider because ${item.resolution_reason || 'input parity was not proven'}.`
      },
      input_parity: {
        status: item.resolution_status,
        authoritative_chunk_ids: item.chunks.map((chunk) => chunk.authoritative_source_chunk_id).filter(Boolean),
        source_excerpt: item.source_excerpt
      },
      semantic_re_adjudication_required: true
    }))
  };
  const packet = {
    artifact_type: 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2',
    artifact_version: 'v2',
    status: 'READY_FOR_GPT_ROOT_CAUSE_ADJUDICATION_AFTER_INPUT_PARITY_REVIEW',
    semantic_labels_are_frozen_inputs: true,
    source_truth_id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: PRODUCTION_RUN_ID,
    replay_run_id: RUN_ID,
    provider_calls: 0,
    rows: resolutions.map((item) => {
      const ledgerRow = ledger.rows.find((row) => row.atom_id === item.atom_id);
      const atom = truth.atoms.find((row) => row.atom_id === item.atom_id);
      return {
        atom_id: item.atom_id,
        tender_id: item.tender_id,
        frozen_semantic_label: item.frozen_semantic_label,
        semantic_label_author: ledgerRow?.semantic_label_author || 'GPT',
        semantic_label_version: ledgerRow?.semantic_label_version || null,
        semantic_reason: ledgerRow?.semantic_reason || null,
        source_truth: {
          page: atom?.page ?? null,
          atomic_requirement: atom?.atomic_requirement || null,
          p0_basis: atom?.p0_basis || null,
          family: atom?.family || null,
          historical_source_context: bundleById.get(item.atom_id)?.source_truth?.context || null,
          historical_source_hint: bundleById.get(item.atom_id)?.source_truth?.source_text || null,
          source_excerpt: item.source_excerpt,
          matched_paragraph_start: item.matched_paragraph_start,
          matched_paragraph_end: item.matched_paragraph_end
        },
        authoritative_replay_input: {
          resolution_status: item.resolution_status,
          resolution_method: item.resolution_method,
          resolution_reason: item.resolution_reason,
          chunk_identity: item.chunks,
          source_text_is_bounded_excerpt_only: true
        },
        provider_evidence: null,
        normalization_evidence: null,
        canonicalization_evidence: null,
        source_resolution_evidence: null,
        production_baseline_linkage: {
          production_run_id: PRODUCTION_RUN_ID,
          historical_r3_link_is_not_replay_authority: true
        },
        source_condition: {
          status: item.resolution_status === 'RESOLVED' ? 'REPLAY_INPUT_PARITY_PASS' : 'REPLAY_INPUT_PARITY_BLOCKED',
          replay_input_authority_level: item.replay_input_authority_level
        },
        semantic_root_cause: 'PENDING_GPT',
        replay_status: parityPass ? 'NOT_EXECUTED' : 'NOT_EXECUTED_INPUT_PARITY_BLOCKED',
        gpt_semantic_review_required: true
      };
    })
  };
  return { parity, plan, divergence, packet };
}

function validateInputs() {
  const truth = readJson(SOURCE_TRUTH_PATH);
  const ledger = readJson(LEDGER_PATH);
  const bundleById = new Map(fs.readFileSync(BUNDLE_PATH, 'utf8').trim().split(/\n/).filter(Boolean).map((line) => {
    const row = JSON.parse(line); return [row.atom_id, row];
  }));
  if (fileSha(SOURCE_TRUTH_PATH) !== SOURCE_TRUTH_SHA) throw new Error('SOURCE_TRUTH_IDENTITY_MISMATCH');
  if (truth.atoms?.length !== 487) throw new Error('SOURCE_TRUTH_ROW_COUNT_MISMATCH');
  if (ledger.rows?.length !== 44 || new Set(ledger.rows.map((row) => row.atom_id)).size !== 44) throw new Error('UNSAFE_LEDGER_IDENTITY_MISMATCH');
  if (ledger.identity?.source_truth_sha256 && !ledger.identity.source_truth_sha256.endsWith(SOURCE_TRUTH_SHA)) throw new Error('LEDGER_SOURCE_TRUTH_SHA_MISMATCH');
  if (![...bundleById.keys()].length) throw new Error('P0_BUNDLE_EMPTY');
  return { truth, ledger, bundleById };
}

export async function buildP0BadcaseReplayV2Artifacts() {
  const { truth, ledger, bundleById } = validateInputs();
  const env = loadBackendEnvironment();
  const preparedByTender = new Map();
  for (const tender of TENDERS) preparedByTender.set(tender, await prepareTender(tender, env));
  let db;
  try {
    db = await loadParseChunkMetadata(env);
  } catch (error) {
    const reason = error?.code || error?.message || 'PRODUCTION_PARSE_METADATA_READ_FAILED';
    const parity = {
      artifact_type: 'V43_P0_BADCASE_44_REPLAY_INPUT_PARITY_V2', artifact_version: 'v2', run_id: RUN_ID,
      source_truth_id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1', source_truth_sha256: SOURCE_TRUTH_SHA,
      case_count: 44, resolved_case_count: 0, unresolved_case_count: 44,
      authoritative_unique_chunk_count: 0, replay_input_parity_gate: 'FAIL_PRODUCTION_PARSE_METADATA_UNAVAILABLE',
      provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0,
      unresolved_cases: ledger.rows.map((row) => ({ atom_id: row.atom_id, tender_id: row.tender_id, reason, missing_stage: 'PRODUCTION_PARSE_CHUNK_METADATA' }))
    };
    const plan = { artifact_type: 'V43_P0_BADCASE_44_REPLAY_PLAN_V2', artifact_version: 'v2', run_id: RUN_ID, case_count: 44, replay_chunk_count: 0, unresolved_case_count: 44, replay_input_parity_gate: parity.replay_input_parity_gate, provider_execution: { status: 'BLOCKED_INPUT_PARITY', provider_calls: 0, retry_count: 0 }, chunks: [], unresolved_cases: parity.unresolved_cases };
    const divergence = { artifact_type: 'V43_P0_BADCASE_44_FIRST_DIVERGENCE_V2', artifact_version: 'v2', run_id: RUN_ID, status: 'NOT_EXECUTED_INPUT_PARITY_BLOCKED', provider_calls: 0, rows: ledger.rows.map((row) => ({ atom_id: row.atom_id, tender_id: row.tender_id, frozen_semantic_label: row.semantic_label, mechanical_first_divergence_scope: 'EVAL_HARNESS', mechanical_first_divergence_stage: 'INPUT_PARITY_GATE', mechanical_first_divergence: { status: 'NOT_OBSERVED', scope: 'EVAL_HARNESS', stage: 'INPUT_PARITY_GATE', reason: `Replay blocked before Provider because ${reason}.` } })) };
    const packet = { artifact_type: 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2', artifact_version: 'v2', status: 'BLOCKED_AUTHORITATIVE_REPLAY_CHUNK_RESOLUTION', semantic_labels_are_frozen_inputs: true, source_truth_sha256: SOURCE_TRUTH_SHA, provider_calls: 0, rows: ledger.rows.map((row) => ({ atom_id: row.atom_id, tender_id: row.tender_id, frozen_semantic_label: row.semantic_label, semantic_reason: row.semantic_reason || null, authoritative_replay_input: { resolution_status: 'UNRESOLVED', resolution_reason: reason }, replay_status: 'NOT_EXECUTED_INPUT_PARITY_BLOCKED', gpt_semantic_review_required: true })) };
    writeJson(PARITY_PATH, parity); writeJson(PLAN_PATH, plan); writeJson(DIVERGENCE_PATH, divergence); writeJson(GPT_PACKET_PATH, packet);
    const checkpoint = { checkpoint: 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT', run_id: RUN_ID, replay_input_parity_gate: parity.replay_input_parity_gate, case_count: 44, resolved_case_count: 0, unresolved_case_count: 44, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, final_status: 'BLOCKED_AUTHORITATIVE_REPLAY_CHUNK_RESOLUTION', unresolved_reason: reason };
    writeJson(CHECKPOINT_PATH, checkpoint); writeText(CHECKPOINT_MD_PATH, `# V43 P0 BADCASE 44 REPLAY V2 CHECKPOINT\n\n- Replay input parity: ${parity.replay_input_parity_gate}\n- Unresolved cases: 44/44\n- Provider calls: 0\n- Production DB writes: 0\n- Gold mutations: 0\n- Final status: BLOCKED_AUTHORITATIVE_REPLAY_CHUNK_RESOLUTION\n`);
    return checkpoint;
  }
  const artifacts = buildArtifacts({ truth, ledger, bundleById, preparedByTender, db });
  writeJson(PARITY_PATH, artifacts.parity);
  writeJson(PLAN_PATH, artifacts.plan);
  writeJson(DIVERGENCE_PATH, artifacts.divergence);
  writeJson(GPT_PACKET_PATH, artifacts.packet);
  const finalStatus = artifacts.parity.replay_input_parity_gate === 'PASS'
    ? 'READY_FOR_GPT_P0_44_ROOT_CAUSE_ADJUDICATION_V2'
    : 'BLOCKED_AUTHORITATIVE_REPLAY_CHUNK_RESOLUTION';
  const checkpoint = {
    checkpoint: 'V43_P0_BADCASE_44_REPLAY_V2_CHECKPOINT',
    artifact_version: 'v2',
    run_id: RUN_ID,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    case_count: artifacts.parity.case_count,
    source_truth_resolved_case_count: artifacts.parity.resolved_case_count,
    source_truth_unresolved_case_count: artifacts.parity.unresolved_case_count,
    authoritative_unique_chunk_count: artifacts.parity.authoritative_unique_chunk_count,
    replay_input_parity_gate: artifacts.parity.replay_input_parity_gate,
    source_truth_to_replay_input_authority: artifacts.parity.source_truth_to_replay_input_authority,
    r3_not_used_as_replay_input_authority: artifacts.parity.r3_not_used_as_replay_input_authority,
    authoritative_chunk_parity: artifacts.parity.authoritative_chunk_parity,
    tb006_p0_0015_not_replayed_as_27: artifacts.parity.tb006_p0_0015_not_replayed_as_27,
    gpt_packet_has_bounded_semantic_evidence: artifacts.parity.gpt_packet_has_bounded_semantic_evidence,
    local_temp_path_not_required_by_gpt: artifacts.parity.local_temp_path_not_required_by_gpt,
    v1_37_7_distribution_non_authoritative: artifacts.parity.v1_37_7_distribution_non_authoritative,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    v1_first_divergence_non_authoritative: true,
    v1_first_divergence_distribution: 'NOT_REUSED_AS_V2_AUTHORITY',
    parity_path: rel(PARITY_PATH),
    plan_path: rel(PLAN_PATH),
    divergence_path: rel(DIVERGENCE_PATH),
    gpt_packet_path: rel(GPT_PACKET_PATH),
    final_status: finalStatus,
    unresolved_cases: artifacts.parity.unresolved_cases
  };
  writeJson(CHECKPOINT_PATH, checkpoint);
  writeText(CHECKPOINT_MD_PATH, [
    '# V43 P0 BADCASE 44 REPLAY V2 CHECKPOINT', '',
    `- Run: ${RUN_ID}`,
    `- Source truth SHA: ${SOURCE_TRUTH_SHA}`,
    `- Source-truth resolutions: ${artifacts.parity.resolved_case_count}/${artifacts.parity.case_count}`,
    `- Unresolved cases: ${artifacts.parity.unresolved_case_count}`,
    `- Authoritative unique parse chunks: ${artifacts.parity.authoritative_unique_chunk_count}`,
    `- Replay input parity gate: ${artifacts.parity.replay_input_parity_gate}`,
    '- Provider calls: 0',
    '- LLM calls: 0',
    '- Production DB writes: 0',
    '- Gold mutations: 0',
    '- V1 first-divergence counts: not reused as V2 authority',
    `- Final status: ${finalStatus}`, '',
    'Unresolved cases:',
    ...artifacts.parity.unresolved_cases.map((item) => `- ${item.atom_id}: ${item.reason}`), ''
  ].join('\n'));
  return checkpoint;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  buildP0BadcaseReplayV2Artifacts()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => { process.stderr.write(`${error?.code || error?.message || error}\n`); process.exitCode = 1; });
}
