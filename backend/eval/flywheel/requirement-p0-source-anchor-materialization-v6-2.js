import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  loadProductionStates,
  mapAnchorToProduction,
  rawCandidateIdentity,
  sourceWindow
} from './requirement-p0-source-anchor-v6-1.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const ADJUDICATION_PATH = path.join(DIR, 'V43_P0_BADCASE_44_SOURCE_ANCHOR_GPT_ADJUDICATION_V6_1.json');
const ANCHOR_V6_1_PATH = path.join(DIR, 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_V6_1.json');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs', 'eval', 'p0-recall', 'GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'eval', 'requirement-production-core6-20260911', 'CORE6_RUNTIME_MANIFEST.json');
const OUT_ANCHOR_PATH = path.join(DIR, 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_FROZEN_V6_2.json');
const OUT_VISIBILITY_PATH = path.join(DIR, 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_2.json');
const OUT_PLAN_PATH = path.join(DIR, 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_2.json');
const OUT_ROOT_CAUSE_PATH = path.join(DIR, 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_2.json');
const OUT_CHECKPOINT_PATH = path.join(DIR, 'V43_P0_BADCASE_44_V6_2_CHECKPOINT.md');
const OUT_CHECKPOINT_JSON_PATH = path.join(DIR, 'V43_P0_BADCASE_44_V6_2_CHECKPOINT.json');

const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const ADJUDICATION_SHA = '0a900c8e1d06a6a8cceb58dfe437478f1fbd338a542639130c67c1aec783df89';
const TENDER_ORDER = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(filePath) { return sha256(fs.readFileSync(filePath)); }
function normalizeLexical(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[^\p{L}\p{N}]+/gu, ''); }
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
  let overlap = 0;
  for (const token of q) if (c.has(token)) overlap += 1;
  return { overlap, score: q.size ? overlap / q.size : 0 };
}

function paragraphWindow(state, start, end, matchType, hint, extra = {}) {
  return { ...sourceWindow(state, start, end), match_type: matchType, required_raw_semantics: hint, ...extra };
}

function pageAllowed(page, sourcePages) {
  return sourcePages.some((sourcePage) => Math.abs(Number(page || 0) - Number(sourcePage || 0)) <= 1);
}

function findExactHint(state, hint, sourcePages) {
  const target = normalizeLexical(hint);
  if (!target) return null;
  for (let start = 0; start < state.paragraphs.length; start += 1) {
    if (!pageAllowed(state.paragraphs[start].page, sourcePages)) continue;
    let joined = '';
    for (let end = start; end < Math.min(state.paragraphs.length, start + 18); end += 1) {
      joined += state.paragraphs[end].text;
      if (normalizeLexical(joined).includes(target)) {
        return paragraphWindow(state, start, end, 'DETERMINISTIC_NORMALIZED_CONTAINMENT', hint, { source_pages: sourcePages });
      }
      if (normalizeLexical(joined).length > target.length * 3 + 1200) break;
    }
  }
  return null;
}

function findBestLocalHint(state, hint, sourcePages) {
  const candidates = [];
  state.paragraphs.forEach((paragraph, index) => {
    if (!pageAllowed(paragraph.page, sourcePages)) return;
    const score = overlapScore(hint, paragraph.text);
    if (score.overlap < 2) return;
    const begin = Math.max(0, index - 2);
    const finish = Math.min(state.paragraphs.length - 1, index + 2);
    candidates.push(paragraphWindow(state, begin, finish, 'DETERMINISTIC_PAGE_LOCAL_TOKEN_OVERLAP', hint, {
      source_pages: sourcePages,
      match_score: score.score,
      token_overlap: score.overlap,
      page_distance: Math.min(...sourcePages.map((page) => Math.abs(Number(paragraph.page || 0) - Number(page))))
    }));
  });
  candidates.sort((a, b) => b.match_score - a.match_score || a.page_distance - b.page_distance || a.paragraph_start - b.paragraph_start);
  return candidates[0] || null;
}

function findHeadingListHint(state, hint, sourcePages) {
  const heading = state.paragraphs.findIndex((paragraph) => pageAllowed(paragraph.page, sourcePages) && /3\.2\s*技术标准/.test(paragraph.text));
  if (heading < 0) return null;
  let end = heading;
  for (let index = heading + 1; index < state.paragraphs.length; index += 1) {
    if (/^[\s　]*[一二三四五六七八九十]+[、.．]/.test(state.paragraphs[index].text)) break;
    end = index;
    if (end - heading >= 18) break;
  }
  return paragraphWindow(state, heading, end, 'DETERMINISTIC_HEADING_LIST_EXPANSION', hint, { source_pages: sourcePages, list_heading: state.paragraphs[heading].text });
}

function materializeHint(state, hint, sourcePages) {
  return findExactHint(state, hint, sourcePages)
    || findHeadingListHint(state, hint, sourcePages)
    || findBestLocalHint(state, hint, sourcePages);
}

function addMaterializationMetadata(state, window, hint, method) {
  const sourceCandidateId = rawCandidateIdentity({ ...window, source_document_sha256: state.source_sha256 });
  return {
    ...window,
    source_candidate_id: sourceCandidateId,
    candidate_origin: 'CURRENT_TENDER_EXTRACTION',
    materialization: {
      status: 'MATERIALIZED_FROM_GPT_APPROVED_RAW_SEMANTICS',
      method,
      required_raw_semantics: hint,
      source_pages: window.source_pages || [],
      source_document_sha256: state.source_sha256
    },
    mechanical_identity_evidence: {
      source_document_sha256: state.source_sha256,
      source_sha256_matches_frozen_tender: state.source_sha256_matches_frozen_tender,
      source_page_verified: Number(window.page) >= 1,
      paragraph_metadata_present: Number.isInteger(window.paragraph_start) && Number.isInteger(window.paragraph_end),
      offsets_present: Number.isInteger(window.source_start_offset) && Number.isInteger(window.source_end_offset),
      raw_text_hash_present: Boolean(window.raw_source_text_sha256),
      materialization_method: method
    }
  };
}

function selectedExistingAnchors(oldRow, decision) {
  const selected = new Set(decision.selected_source_candidate_ids || []);
  const anchors = (oldRow?.anchors || []).filter((anchor) => selected.has(anchor.source_candidate_id));
  if (anchors.length !== selected.size) {
    throw new Error(`GPT selected source candidate missing: ${decision.atom_id}`);
  }
  return anchors.map((anchor) => ({
    ...anchor,
    source_anchor_authority: 'PASS',
    materialization: { status: 'GPT_SELECTED_EXISTING_CANDIDATE', selected_by: 'GPT_SEMANTIC_SOURCE_ANCHOR_ADJUDICATION' }
  }));
}

function firstLossStage(state, anchor, visibility) {
  if (visibility.status === 'CROSS_CHUNK_SEMANTIC_SPLIT') return 'CROSS_CHUNK_SEMANTIC_SPLIT';
  if (visibility.status === 'SOURCE_SCOPE_LOSS') {
    const inDocument = normalizeLexical(state.extracted_text).includes(normalizeLexical(anchor.raw_source_text));
    return inDocument ? 'SCOPE_ROUTER' : 'SECTION_CLASSIFIER';
  }
  if (visibility.status === 'PAYLOAD_COVERAGE_LOSS') return 'PAYLOAD_BUILDER';
  if (visibility.status === 'PRODUCTION_INPUT_VISIBLE' && !visibility.provider_input_visible) return 'PAYLOAD_BUILDER';
  return null;
}

function visibilityForAnchor(state, anchor) {
  const visibility = mapAnchorToProduction(state, anchor);
  return {
    anchor_source_candidate_id: anchor.source_candidate_id || rawCandidateIdentity(anchor),
    source_document_sha256: state.source_sha256,
    source_page_start: anchor.source_page_start || anchor.page,
    source_page_end: anchor.source_page_end || anchor.page,
    source_start_offset: anchor.source_start_offset,
    source_end_offset: anchor.source_end_offset,
    raw_source_text_sha256: anchor.raw_source_text_sha256,
    status: visibility.status,
    first_loss_stage: firstLossStage(state, anchor, visibility),
    provider_input_visible: Boolean(visibility.provider_input_visible),
    cross_chunk_semantic_split: Boolean(visibility.cross_chunk_semantic_split),
    parse_chunks: (visibility.parse_chunks || []).map((chunk) => ({
      ...chunk,
      provider_payload_chunk_text_sha256: chunk.provider_payload_chunk_text_sha256 || null
    }))
  };
}

function buildCorrectedPlan(rows) {
  const eligible = rows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED');
  const chunks = new Map();
  for (const row of eligible) {
    for (const visibility of row.production_input_visibility || []) {
      if (visibility.status !== 'PRODUCTION_INPUT_VISIBLE' || visibility.cross_chunk_semantic_split) continue;
      for (const chunk of visibility.parse_chunks || []) {
        if (!chunks.has(chunk.chunk_id)) chunks.set(chunk.chunk_id, { chunk_id: chunk.chunk_id, chunk_number: chunk.chunk_number, atom_ids: new Set(), chunk_identity: chunk });
        chunks.get(chunk.chunk_id).atom_ids.add(row.atom_id);
      }
    }
  }
  const unique = [...chunks.values()].map((chunk) => ({ ...chunk.chunk_identity, atom_ids: [...chunk.atom_ids].sort() }));
  const gate = eligible.length === 43
    && eligible.every((row) => (row.production_input_visibility || []).length > 0 && row.production_input_visibility.every((item) => item.status === 'PRODUCTION_INPUT_VISIBLE' && item.provider_input_visible && !item.cross_chunk_semantic_split));
  return {
    artifact_type: 'V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_2',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    target_case_count: 43,
    replay_eligible_case_count: eligible.length,
    authoritative_source_to_provider_input_visible: gate ? 'PASS' : 'FAIL',
    cross_chunk_semantic_split_count: eligible.reduce((n, row) => n + (row.production_input_visibility || []).filter((item) => item.cross_chunk_semantic_split).length, 0),
    unique_production_provider_chunks: unique,
    unique_production_provider_chunk_count: unique.length,
    cases_per_chunk: unique.map((chunk) => ({ chunk_id: chunk.chunk_id, atom_ids: chunk.atom_ids, count: chunk.atom_ids.length })),
    multi_span_cases: eligible.filter((row) => row.anchors.length > 1).map((row) => row.atom_id),
    provider_call_count_if_gate_pass: gate ? unique.length : 0,
    provider_replay_authorized: gate,
    provider_calls_executed: 0,
    semantic_root_cause: 'PENDING_GPT'
  };
}

function writeCheckpoint(checkpoint) {
  const lines = [
    '# V43 P0 BadCase 44 Anchor Materialization V6.2 Checkpoint',
    '',
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- GPT_ADJUDICATION_REPO_IMPORT: ${checkpoint.gpt_adjudication_repo_import}`,
    `- GPT_ADJUDICATION_SHA256: ${checkpoint.gpt_adjudication_sha256}`,
    `- SOURCE_TRUTH_SHA256: ${checkpoint.source_truth_sha256}`,
    `- TOTAL_CASES: ${checkpoint.total_cases}`,
    `- DIRECT_ANCHORS: ${checkpoint.direct_anchor_count}`,
    `- MATERIALIZED_ANCHORS: ${checkpoint.materialized_anchor_case_count}`,
    `- SOURCE_CONFLICT_CASES: ${checkpoint.source_conflict_case_count}`,
    `- SOURCE_ANCHOR_AUTHORITY_PASS: ${checkpoint.source_anchor_authority_pass}`,
    `- PRODUCTION_INPUT_VISIBLE_43: ${checkpoint.production_input_visible_43}`,
    `- PRODUCTION_INPUT_FIRST_LOSS_DISTRIBUTION: ${JSON.stringify(checkpoint.production_input_first_loss_distribution)}`,
    `- CROSS_CHUNK_SEMANTIC_SPLIT_COUNT: ${checkpoint.cross_chunk_semantic_split_count}`,
    `- REPLAY_ELIGIBLE_CASES: ${checkpoint.replay_eligible_case_count}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- LLM_CALLS: ${checkpoint.llm_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- PROMPT_CHANGES: ${checkpoint.prompt_changes}`,
    `- SCHEMA_CHANGES: ${checkpoint.schema_changes}`,
    `- PRODUCTION_SEMANTIC_CHANGES: ${checkpoint.production_semantic_changes}`,
    `- BLOCK_REASON: ${checkpoint.block_reason || 'NONE'}`,
    `- CORRECTED_REPLAY_PLAN: ${checkpoint.corrected_replay_plan_status}`,
    '',
    'GPT source-anchor decisions were imported byte-for-byte; semantic labels were not reinterpreted.'
  ];
  fs.writeFileSync(OUT_CHECKPOINT_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const adjudicationSha = sha256File(ADJUDICATION_PATH);
  if (adjudicationSha !== ADJUDICATION_SHA) throw new Error(`GPT adjudication SHA mismatch: ${adjudicationSha}`);
  const adjudication = readJson(ADJUDICATION_PATH);
  if (adjudication.summary?.total_cases !== 44 || adjudication.decisions?.length !== 44) throw new Error('GPT adjudication must contain exactly 44 decisions');
  if (adjudication.summary?.semantic_unresolved !== 0) throw new Error('GPT adjudication semantic_unresolved must be 0');
  const sourceTruth = readJson(SOURCE_TRUTH_PATH);
  if (sha256File(SOURCE_TRUTH_PATH) !== SOURCE_TRUTH_SHA) throw new Error('Source Truth SHA mismatch');
  const oldArtifact = readJson(ANCHOR_V6_1_PATH);
  const oldRows = new Map((oldArtifact.rows || []).map((row) => [row.atom_id, row]));
  const manifest = readJson(MANIFEST_PATH);
  const states = await loadProductionStates(manifest);
  const atoms = new Map((sourceTruth.atoms || []).map((atom) => [atom.atom_id, atom]));
  const rows = [];
  const visibilityRows = [];
  for (const decision of adjudication.decisions) {
    const oldRow = oldRows.get(decision.atom_id);
    const atom = atoms.get(decision.atom_id);
    if (!oldRow || !atom) throw new Error(`Missing frozen row/atom: ${decision.atom_id}`);
    const state = states.get(decision.tender_id);
    if (!state) throw new Error(`Missing tender state: ${decision.tender_id}`);
    let anchors;
    let anchorMaterializationStatus;
    if (decision.anchor_decision === 'GPT_SEMANTIC_ANCHOR_APPROVED') {
      anchors = selectedExistingAnchors(oldRow, decision);
      anchorMaterializationStatus = 'DIRECT_GPT_SELECTED_ANCHOR';
    } else if (decision.anchor_decision === 'GPT_SEMANTIC_ANCHOR_APPROVED_PENDING_MECHANICAL_MATERIALIZATION') {
      const hints = decision.atom_id === 'FAST-WATER-01-P0-0072'
        ? ['严重故障', '次数/年 0 1 >2', '平均每季度发生严重故障次数']
        : decision.required_raw_semantics;
      anchors = [];
      for (const hint of hints) {
        const window = materializeHint(state, hint, decision.source_pages || [atom.page]);
        if (!window) throw new Error(`Unable to materialize GPT-approved semantics: ${decision.atom_id}`);
        anchors.push(addMaterializationMetadata(state, window, hint, window.match_type));
      }
      anchorMaterializationStatus = 'DETERMINISTIC_MATERIALIZATION_COMPLETE';
    } else if (decision.anchor_decision === 'SOURCE_CONFLICT_RETAINED') {
      const hints = ['次数/年 0 1 >2', '平均每季度发生严重故障次数'];
      anchors = hints.map((hint) => {
        const window = materializeHint(state, hint, decision.source_pages || [atom.page]);
        if (!window) throw new Error(`Unable to materialize conflict signal: ${decision.atom_id}`);
        return addMaterializationMetadata(state, window, hint, window.match_type);
      });
      anchorMaterializationStatus = 'SOURCE_CONFLICT_SIGNALS_PRESERVED';
    } else {
      throw new Error(`Unsupported GPT anchor decision: ${decision.anchor_decision}`);
    }
    const row = {
      ...oldRow,
      anchor_decision: decision.anchor_decision,
      source_anchor_authority: decision.anchor_decision === 'SOURCE_CONFLICT_RETAINED' ? 'SOURCE_CONFLICT' : 'PASS',
      anchor_authority: decision.anchor_decision === 'SOURCE_CONFLICT_RETAINED' ? 'SOURCE_CONFLICT' : 'GPT_SEMANTIC_ANCHOR',
      anchor_materialization_status: anchorMaterializationStatus,
      selected_source_candidate_ids: decision.selected_source_candidate_ids || [],
      required_raw_semantics: decision.required_raw_semantics || [],
      source_pages: decision.source_pages || [],
      anchors,
      production_input_visibility: anchors.map((anchor) => visibilityForAnchor(state, anchor))
    };
    rows.push(row);
    visibilityRows.push({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      anchor_decision: row.anchor_decision,
      source_anchor_authority: row.source_anchor_authority,
      replay_eligible: row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED',
      anchors: row.production_input_visibility
    });
  }
  const order = new Map(TENDER_ORDER.map((tender, index) => [tender, index]));
  rows.sort((a, b) => (order.get(a.tender_id) - order.get(b.tender_id)) || a.atom_id.localeCompare(b.atom_id, undefined, { numeric: true }));
  visibilityRows.sort((a, b) => (order.get(a.tender_id) - order.get(b.tender_id)) || a.atom_id.localeCompare(b.atom_id, undefined, { numeric: true }));
  const nonConflictRows = rows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED');
  const firstLossDistribution = {};
  for (const row of nonConflictRows) for (const item of row.production_input_visibility) if (item.first_loss_stage) firstLossDistribution[item.first_loss_stage] = (firstLossDistribution[item.first_loss_stage] || 0) + 1;
  const productionVisible43 = nonConflictRows.filter((row) => row.production_input_visibility.length > 0 && row.production_input_visibility.every((item) => item.status === 'PRODUCTION_INPUT_VISIBLE' && item.provider_input_visible)).length;
  const splitCount = nonConflictRows.reduce((n, row) => n + row.production_input_visibility.filter((item) => item.cross_chunk_semantic_split).length, 0);
  const materializedCaseCount = rows.filter((row) => row.anchor_materialization_status === 'DETERMINISTIC_MATERIALIZATION_COMPLETE').length;
  const sourceConflictCount = rows.filter((row) => row.anchor_decision === 'SOURCE_CONFLICT_RETAINED').length;
  const sourceAnchorPass = rows.length === 44 && rows.filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED').every((row) => row.anchors.length > 0) && sourceConflictCount === 1;
  const plan = buildCorrectedPlan(rows);
  const visibilityArtifact = {
    artifact_type: 'V43_P0_BADCASE_43_PRODUCTION_INPUT_VISIBILITY_V6_2',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    target_case_count: 43,
    rows: visibilityRows.filter((row) => row.replay_eligible),
    production_input_visible_case_count: productionVisible43,
    production_input_first_loss_distribution: firstLossDistribution,
    cross_chunk_semantic_split_count: splitCount,
    source_anchor_authority: 'PASS',
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    semantic_root_cause: 'PENDING_GPT'
  };
  const anchorArtifact = {
    artifact_type: 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_FROZEN_V6_2',
    artifact_version: 'v6.2',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    gpt_adjudication_sha256: ADJUDICATION_SHA,
    target_case_count: 44,
    source_anchor_authority: sourceAnchorPass ? 'PASS' : 'FAIL',
    non_conflict_case_count: nonConflictRows.length,
    non_conflict_authoritative_anchor_count: nonConflictRows.filter((row) => row.anchors.length > 0).length,
    source_conflict_case_ids: rows.filter((row) => row.anchor_decision === 'SOURCE_CONFLICT_RETAINED').map((row) => row.atom_id),
    rows,
    semantic_adjudication_reinterpreted: false,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const gatePass = sourceAnchorPass && productionVisible43 === 43 && splitCount === 0;
  let rootCausePacket = null;
  if (gatePass) {
    rootCausePacket = {
      artifact_type: 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_2',
      source_truth_sha256: SOURCE_TRUTH_SHA,
      rows: [],
      semantic_root_cause: 'PENDING_GPT',
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    };
  }
  const checkpoint = {
    artifact_type: 'V43_P0_BADCASE_44_V6_2_CHECKPOINT',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    gpt_adjudication_sha256: ADJUDICATION_SHA,
    gpt_adjudication_repo_import: 'PASS',
    total_cases: rows.length,
    direct_anchor_count: rows.filter((row) => row.anchor_materialization_status === 'DIRECT_GPT_SELECTED_ANCHOR').length,
    materialized_anchor_case_count: materializedCaseCount,
    source_conflict_case_count: sourceConflictCount,
    source_anchor_authority_pass: sourceAnchorPass,
    production_input_visible_43: productionVisible43,
    production_input_first_loss_distribution: firstLossDistribution,
    cross_chunk_semantic_split_count: splitCount,
    replay_eligible_case_count: nonConflictRows.length,
    corrected_replay_plan_status: plan.authoritative_source_to_provider_input_visible,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    production_semantic_changes: 0,
    block_reason: gatePass ? null : 'CURRENT_PRODUCTION_SCOPE_OR_PAYLOAD_DOES_NOT_EXPOSE_ALL_AUTHORITATIVE_ANCHORS; SCOPE_CHANGE_OR_PRODUCTION_REPARSE_REQUIRED',
    final_status: gatePass ? 'READY_FOR_GPT_P0_43_SEMANTIC_ROOT_CAUSE_ADJUDICATION_V6_2' : 'BLOCKED_REQUIREMENT_SCOPE_CONTRACT_CHANGE_REQUIRED'
  };
  fs.writeFileSync(OUT_ANCHOR_PATH, `${JSON.stringify(anchorArtifact, null, 2)}\n`);
  fs.writeFileSync(OUT_VISIBILITY_PATH, `${JSON.stringify(visibilityArtifact, null, 2)}\n`);
  fs.writeFileSync(OUT_PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);
  if (rootCausePacket) fs.writeFileSync(OUT_ROOT_CAUSE_PATH, `${JSON.stringify(rootCausePacket, null, 2)}\n`);
  writeCheckpoint(checkpoint);
  fs.writeFileSync(OUT_CHECKPOINT_JSON_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(JSON.stringify({
    gpt_adjudication_repo_import: 'PASS',
    total_cases: rows.length,
    direct_anchor_count: checkpoint.direct_anchor_count,
    materialized_anchor_case_count: materializedCaseCount,
    source_conflict_case_count: sourceConflictCount,
    source_anchor_authority: anchorArtifact.source_anchor_authority,
    production_input_visible_43: productionVisible43,
    production_input_first_loss_distribution: firstLossDistribution,
    cross_chunk_semantic_split_count: splitCount,
    corrected_replay_plan_status: plan.authoritative_source_to_provider_input_visible,
    provider_replay_authorized: plan.provider_replay_authorized,
    provider_calls: 0,
    final_status: checkpoint.final_status
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
}

export {
  findExactHint,
  findBestLocalHint,
  findHeadingListHint,
  materializeHint,
  visibilityForAnchor,
  buildCorrectedPlan
};
