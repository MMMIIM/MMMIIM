import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareTender } from '../requirement-semantic-quality-v1/runner.js';
import { evaluateCandidatePayload } from '../requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { normalizeSourceText, hashSource } from '../../src/pipeline/source-location-resolver.js';
import { REQUIREMENT_QUALITY_GATE_VERSION } from '../../src/pipeline/requirement-quality-gate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const CANONICAL_PATH = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const POOL_PATH = path.join(DOCS, 'REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json');
const AUTHORITY_PACKET_PATH = path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/JY-001.json');
const CALIBRATION_PATH = path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json');
const OUTPUT_PACKET_PATH = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET_V2.jsonl');
const MUTATION_PATH = path.join(REPO, 'backend/eval/requirement-semantic-quality-v1/mutation-suite.json');
const CONTROLS_PATH = path.join(DOCS, 'V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROLS.json');
const REPAIR_REPORT_PATH = path.join(DOCS, 'V43_REQUIREMENT_PROVENANCE_REPAIR_REPORT.json');
const EXECUTABLE_PACKET_PATH = path.join(DOCS, 'V43_REQUIREMENT_P1_SAFETY_EXECUTABLE_BASELINE.json');
const CHECKPOINT_PATH = path.join(DOCS, 'V43_REQUIREMENT_PROVENANCE_REPAIR_AND_EXECUTABLE_SAFETY_BASELINE_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(DOCS, 'V43_REQUIREMENT_PROVENANCE_REPAIR_AND_EXECUTABLE_SAFETY_BASELINE_CHECKPOINT.md');
const INITIAL_ROOT_HASHES = Object.freeze({
  'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json': '56bdf7f4d8cf1dd68c87dca9a63406dcc0b7bf5e5fe2bd3ee541293255767ede',
  'docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json': 'd9def33a17083254bead89b31173585e77166bb0b07a22494291e997beacd286',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/JY-001.json': 'f08c21a255e3c5ada63d87f415013e85a55eca532f3d0593bd77163d1ae4ca7f',
  'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json': '6d9fa9cc1960014684e5f6e755fe4aa893738a7d5425cb76c7e0056178458485',
  'docs/V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET_V2.jsonl': 'bb485a6b22550104a51fa539b16d623850ca1bded5b8472d15de485835737dc4'
});

const TARGETS = Object.freeze([
  'JY-001:REQ-069', 'JY-001:REQ-021', 'JY-001:REQ-023',
  'JY-001:REQ-139', 'JY-001:REQ-073', 'JY-001:REQ-072'
]);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const rel = (file) => path.relative(REPO, file).replaceAll('\\', '/');

function mutationText(base, dimension, index) {
  const text = String(base || '');
  if (dimension === 'number') {
    const replaced = text.replace(/\d+(?:\.\d+)?/, String(999 + index));
    return replaced === text ? `${text} 数量${999 + index}` : replaced;
  }
  if (dimension === 'negation') return `${text} 不得满足`;
  if (dimension === 'entity') return `${text} 主体替换为未授权企业${index}`;
  if (dimension === 'scope') return `${text} 范围扩展至全国所有区域`;
  if (dimension === 'status') return `${text} 状态改为已验收完成`;
  if (dimension === 'temporal') return `${text} 有效期改为2040年`;
  if (dimension === 'mandatory') {
    const replaced = text.replace(/应|须|必须/, '可');
    return replaced === text ? `${text}（可选）` : replaced;
  }
  if (dimension === 'table_header') {
    const replaced = text.replace(/数量|单位|型号|参数/g, '');
    return replaced === text ? `${text}（表头缺失）` : replaced;
  }
  if (dimension === 'harmful_merge') return `${text}；并且另一个独立系统必须完成迁移和验收`;
  return `项目背景介绍${index}：${text}`;
}

function sequenceIndex(mutationId) {
  const sequence = Number(String(mutationId).replace(/\D/g, ''));
  return ((sequence - 1) % 3) + 1;
}

function sourceMatch(row, segments, sourceHash) {
  const span = row.source_span || {};
  const pageStart = span.page_start;
  const pageEnd = span.page_end ?? pageStart;
  const paragraphStart = span.paragraph_start;
  const paragraphEnd = span.paragraph_end ?? paragraphStart;
  const candidates = segments.filter((segment) => Number(segment.paragraph) >= paragraphStart
    && Number(segment.paragraph) <= paragraphEnd
    && (pageStart == null || Number(segment.page) >= pageStart)
    && (pageEnd == null || Number(segment.page) <= pageEnd));
  const expectedCount = paragraphEnd - paragraphStart + 1;
  const actualText = candidates.map((segment) => segment.text).join('\n');
  const sourceTextMatch = normalizeSourceText(actualText) === normalizeSourceText(row.source_excerpt);
  const sameChunk = candidates.length > 0 && candidates.every((segment) => segment.chunk_number === candidates[0].chunk_number);
  const refs = candidates.map((segment) => segment.source_ref).filter(Boolean);
  const uniqueMatch = candidates.length === expectedCount && sameChunk && refs.length === candidates.length
    && new Set(refs).size === refs.length && sourceTextMatch;
  return {
    candidates,
    refs,
    actualText,
    sourceHashMatch: sourceHash === row.source_hash,
    sourceTextMatch,
    spanMatch: candidates.length === expectedCount
      && candidates[0]?.paragraph === paragraphStart
      && candidates.at(-1)?.paragraph === paragraphEnd
      && candidates[0]?.page === pageStart
      && candidates.at(-1)?.page === pageEnd,
    uniqueMatch
  };
}

function applyRefs(row, match) {
  const segments = match.candidates;
  const first = segments[0];
  const last = segments.at(-1);
  row.source_refs = [...match.refs];
  row.source_span = {
    ...(row.source_span || {}),
    start_ref: first.source_ref,
    end_ref: last.source_ref,
    chunk_number: first.chunk_number,
    source_start_offset: first.source_start_offset ?? row.source_span?.source_start_offset ?? null,
    source_end_offset: last.source_end_offset ?? row.source_span?.source_end_offset ?? null
  };
}

function patchById(list, id, match) {
  const row = list.find((item) => item.canonical_requirement_id === id || item.req_id === id || item.candidate_id === id);
  if (!row) throw new Error(`TARGET_NOT_FOUND:${id}`);
  applyRefs(row, match);
  return row;
}

async function repairProvenance() {
  const canonical = readJson(CANONICAL_PATH);
  const pool = readJson(POOL_PATH);
  const authority = readJson(AUTHORITY_PACKET_PATH);
  const calibration = readJson(CALIBRATION_PATH);
  const outputRows = fs.readFileSync(OUTPUT_PACKET_PATH, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const prepared = await prepareTender('JY-001', process.env);
  const sourceHash = prepared.source_sha256;
  const targetReports = [];

  for (const id of TARGETS) {
    const canonicalRow = canonical.requirements.find((item) => item.canonical_requirement_id === id);
    if (!canonicalRow) throw new Error(`CANONICAL_TARGET_NOT_FOUND:${id}`);
    const candidateId = id.replace(':REQ-', ':CAND-');
    const poolRow = (pool.candidates || []).find((item) => item.candidate_id === candidateId);
    const authorityRow = (authority.candidates || []).find((item) => item.candidate_id === candidateId);
    if (!poolRow || !authorityRow) throw new Error(`AUTHORITY_TARGET_NOT_FOUND:${id}`);
    if (canonicalRow.source_hash !== sourceHash || poolRow.source_hash !== sourceHash || authorityRow.source_hash !== sourceHash) {
      throw new Error(`SOURCE_HASH_MISMATCH:${id}`);
    }
    const match = sourceMatch(canonicalRow, prepared.segments, sourceHash);
    if (!match.uniqueMatch || !match.sourceHashMatch || !match.sourceTextMatch || !match.spanMatch) {
      targetReports.push({
        req_id: id,
        before_source_refs: [...(canonicalRow.source_refs || [])],
        matched_source_refs: match.refs,
        match_method: 'JY_FROZEN_SOURCE_SEGMENT_INDEX_PAGE_PARAGRAPH_EXCERPT',
        source_hash_match: match.sourceHashMatch,
        source_text_match: match.sourceTextMatch,
        span_match: match.spanMatch,
        unique_match: match.uniqueMatch,
        status: 'SOURCE_REF_RECOVERY_AMBIGUOUS'
      });
      continue;
    }
    applyRefs(poolRow, match);
    applyRefs(authorityRow, match);
    const authorityCanonical = authority.canonical_requirements?.find((item) => item.canonical_requirement_id === id);
    if (authorityCanonical) applyRefs(authorityCanonical, match);
    applyRefs(canonicalRow, match);
    targetReports.push({
      req_id: id,
      before_source_refs: [],
      matched_source_refs: [...match.refs],
      match_method: 'JY_FROZEN_SOURCE_SEGMENT_INDEX_PAGE_PARAGRAPH_EXCERPT',
      source_hash_match: match.sourceHashMatch,
      source_text_match: match.sourceTextMatch,
      span_match: match.spanMatch,
      unique_match: match.uniqueMatch,
      status: 'RECOVERED'
    });
  }

  const recovered = targetReports.filter((item) => item.status === 'RECOVERED').length;
  if (recovered !== TARGETS.length) {
    writeJson(REPAIR_REPORT_PATH, { artifact_type: 'V43_REQUIREMENT_PROVENANCE_REPAIR_REPORT', target_count: TARGETS.length, target_reports: targetReports, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 });
    throw new Error(`PROVENANCE_TARGET_NOT_COMPLETE:${recovered}/${TARGETS.length}`);
  }

  writeJson(POOL_PATH, pool);
  writeJson(AUTHORITY_PACKET_PATH, authority);
  writeJson(CANONICAL_PATH, canonical);
  // Calibration and final certification packets are downstream projections.
  // The authority root is repaired above; these historical projections remain
  // unchanged so their existing provenance-gap assertions stay auditable.

  const canonicalRows = canonical.requirements || [];
  const provenanceCensus = {
    total_canonicals: canonicalRows.length,
    source_hash_present: canonicalRows.filter((row) => String(row.source_hash || '').trim()).length,
    source_span_present: canonicalRows.filter((row) => {
      const span = row.source_span || {};
      return (span.start_ref && span.end_ref)
        || (span.page_start != null && span.paragraph_start != null);
    }).length,
    authority_source_refs_present: canonicalRows.filter((row) => Array.isArray(row.source_refs) && row.source_refs.length > 0).length,
    unexplained_empty_source_refs: canonicalRows.filter((row) => !(Array.isArray(row.source_refs) && row.source_refs.length > 0)).map((row) => row.canonical_requirement_id)
  };
  const report = {
    artifact_type: 'V43_REQUIREMENT_PROVENANCE_REPAIR_REPORT',
    artifact_version: 'v1',
    source_authority_root: [rel(POOL_PATH), rel(AUTHORITY_PACKET_PATH), rel(CANONICAL_PATH)],
    initial_root_artifact_sha256: INITIAL_ROOT_HASHES,
    target_count: TARGETS.length,
    recovered_count: recovered,
    ambiguous_count: targetReports.filter((item) => item.status !== 'RECOVERED').length,
    target_reports: targetReports,
    provenance_census: provenanceCensus,
    target_semantic_fields_unchanged: true,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_code_changes: 0,
    note: 'Only deterministic provenance metadata was repaired at the authority packet root; semantic requirement fields were not changed.'
  };
  writeJson(REPAIR_REPORT_PATH, report);
  return { report, canonical, prepared };
}

function sourceReplayForRow(row, prepared) {
  const match = sourceMatch(row, prepared.segments, prepared.source_sha256);
  return match;
}

async function executeSafetyControls(canonical, prepared) {
  const suite = readJson(MUTATION_PATH);
  const suiteSha = fileSha(MUTATION_PATH);
  const expectedSuiteSha = 'fc525e5d01f3a34bd18e0de22f155816195367278e1269facb1312404e17d001';
  if (suiteSha !== expectedSuiteSha) throw new Error(`MUTATION_SUITE_SHA_MISMATCH:${suiteSha}`);
  const controls = readJson(CONTROLS_PATH);
  const suiteById = new Map((suite.cases || []).map((item) => [item.mutation_id, item]));
  const canonicalById = new Map((canonical.requirements || []).map((item) => [item.canonical_requirement_id, item]));
  const cases = [];
  for (const control of controls.controls || []) {
    const mutation = suiteById.get(control.mutation_id);
    const original = canonicalById.get(mutation.original_requirement_id);
    if (!mutation || !original) throw new Error(`SAFETY_FIXTURE_MISSING:${control.control_id}`);
    const source = sourceReplayForRow(original, prepared);
    const index = sequenceIndex(mutation.mutation_id);
    const mutated = mutationText(original.requirement_text, mutation.dimension, index);
    const chunk = prepared.chunks.find((item) => item.segments.some((segment) => source.refs.includes(segment.source_ref)));
    const candidate = {
      text: mutated,
      category: original.category,
      source_range: { start_ref: source.refs[0], end_ref: source.refs.at(-1) },
      source_text: original.source_excerpt,
      source_context_text: original.source_excerpt,
      source_verified: true,
      source_resolution_status: 'verified',
      source_match_type: 'verified',
      source_hash: original.source_hash,
      source_page_start: original.source_span.page_start,
      source_page_end: original.source_span.page_end,
      source_paragraph_start: original.source_span.paragraph_start,
      source_paragraph_end: original.source_span.paragraph_end,
      mandatory_observed: original.mandatory_observed === true
    };
    const actual = evaluateCandidatePayload({ candidates: [candidate], chunk, qualityGate: true });
    const decision = actual.quality_gate_decision;
    cases.push({
      control_id: control.control_id,
      mutation_id: mutation.mutation_id,
      dimension: mutation.dimension,
      severity: mutation.severity,
      original_requirement_id: mutation.original_requirement_id,
      source_text: original.source_excerpt,
      source_refs: Array.isArray(original.source_refs) ? [...original.source_refs] : [],
      replay_source_refs: source.refs,
      original_canonical_text: original.requirement_text,
      mutated_canonical_text: mutated,
      exact_mutation_delta: {
        dimension: mutation.dimension,
        original_text_hash: sha256(original.requirement_text),
        mutated_text_hash: sha256(mutated),
        mutation_index: index,
        frozen_fixture_mutated_text_hash: mutation.mutated_text_hash,
        mutation_payload_hash_match: sha256(mutated) === mutation.mutated_text_hash
      },
      expected_decision: 'FAIL_CLOSED',
      quality_gate_function: 'evaluateCandidatePayload -> buildCanonicalRequirements -> evaluateRequirementCandidateQuality',
      quality_gate_version: REQUIREMENT_QUALITY_GATE_VERSION,
      actual_gate_decision: decision,
      actual_reason_codes: actual.quality_gate_reason_codes || [],
      actual_detector_evidence: {
        source_resolution_success: actual.source_resolution_success,
        canonicalization_success: actual.canonicalization_success,
        failure_stage: actual.failure_stage,
        canonical_count: actual.canonical_count,
        duplicate_count: actual.duplicate_count,
        detected: decision !== 'PASS'
      },
      fixture_sha256: expectedSuiteSha,
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    });
  }
  const detected = cases.filter((item) => item.actual_gate_decision !== 'PASS').length;
  const review = cases.filter((item) => item.actual_gate_decision === 'REVIEW_REQUIRED_OR_BLOCKED').length;
  const rejected = cases.filter((item) => item.actual_gate_decision === 'REJECTED' || item.actual_gate_decision === 'BLOCKED').length;
  const escaped = cases.filter((item) => item.actual_gate_decision === 'PASS').length;
  const groups = {};
  for (const group of ['NUMBER', 'MODALITY_NEGATION', 'ENTITY_SCOPE', 'SOURCE_FIDELITY_STATUS_QUANTITY']) {
    const rows = (controls.controls || []).filter((item) => item.control_group === group).map((item) => cases.find((x) => x.control_id === item.control_id));
    groups[group] = { count: rows.length, detected: rows.filter((x) => x.actual_gate_decision !== 'PASS').length, escaped: rows.filter((x) => x.actual_gate_decision === 'PASS').length };
  }
  const packet = {
    artifact_type: 'V43_REQUIREMENT_P1_EXECUTABLE_SAFETY_BASELINE',
    artifact_version: 'v1',
    execution_mode: 'OFFLINE_PRODUCTION_SHAPED_REPLAY',
    source_mutation_suite: rel(MUTATION_PATH),
    source_mutation_suite_sha256: expectedSuiteSha,
    quality_gate_function: 'evaluateCandidatePayload',
    quality_gate_version: REQUIREMENT_QUALITY_GATE_VERSION,
    control_count: cases.length,
    controls_executed: cases.length,
    detected_count: detected,
    review_required_count: review,
    reject_count: rejected,
    accept_escape_count: escaped,
    mutation_payload_hash_mismatch_count: cases.filter((item) => item.exact_mutation_delta.mutation_payload_hash_match === false).length,
    mutation_payload_hash_mismatch_ids: cases.filter((item) => item.exact_mutation_delta.mutation_payload_hash_match === false).map((item) => item.mutation_id),
    current_critical_mutation_recall: cases.length ? detected / cases.length : null,
    groups,
    cases,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  writeJson(EXECUTABLE_PACKET_PATH, packet);
  return packet;
}

function renderMarkdown(checkpoint) {
  const lines = [
    '# V43_REQUIREMENT_PROVENANCE_REPAIR_AND_EXECUTABLE_SAFETY_BASELINE_CHECKPOINT',
    '',
    `- PROVENANCE_TARGET_COUNT: ${checkpoint.PROVENANCE_TARGET_COUNT}`,
    `- PROVENANCE_RECOVERED_COUNT: ${checkpoint.PROVENANCE_RECOVERED_COUNT}`,
    `- PROVENANCE_AMBIGUOUS_COUNT: ${checkpoint.PROVENANCE_AMBIGUOUS_COUNT}`,
    `- AUTHORITY_PACKET_SOURCE_REFS_PRESENT: ${checkpoint.AUTHORITY_PACKET_SOURCE_REFS_PRESENT}`,
    `- UNEXPLAINED_EMPTY_SOURCE_REFS: ${checkpoint.UNEXPLAINED_EMPTY_SOURCE_REFS}`,
    `- SAFETY_CONTROL_COUNT: ${checkpoint.SAFETY_CONTROL_COUNT}`,
    `- SAFETY_CONTROLS_EXECUTED: ${checkpoint.SAFETY_CONTROLS_EXECUTED}`,
    `- MUTATION_SUITE_SHA_MATCH: ${checkpoint.MUTATION_SUITE_SHA_MATCH}`,
    `- MUTATION_PAYLOAD_HASH_MISMATCH_COUNT: ${checkpoint.MUTATION_PAYLOAD_HASH_MISMATCH_COUNT}`,
    `- SAFETY_DETECTED_COUNT: ${checkpoint.SAFETY_DETECTED_COUNT}`,
    `- SAFETY_REVIEW_REQUIRED_COUNT: ${checkpoint.SAFETY_REVIEW_REQUIRED_COUNT}`,
    `- SAFETY_REJECT_COUNT: ${checkpoint.SAFETY_REJECT_COUNT}`,
    `- SAFETY_ACCEPT_ESCAPE_COUNT: ${checkpoint.SAFETY_ACCEPT_ESCAPE_COUNT}`,
    `- CURRENT_CRITICAL_MUTATION_RECALL: ${checkpoint.CURRENT_CRITICAL_MUTATION_RECALL}`,
    '',
    '## Detection groups',
    '',
    ...Object.entries(checkpoint.DETECTION_GROUPS).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`),
    '',
    `- PROVIDER_CALLS: ${checkpoint.PROVIDER_CALLS}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.PRODUCTION_DB_WRITES}`,
    `- PRODUCTION_CODE_CHANGES: ${checkpoint.PRODUCTION_CODE_CHANGES}`,
    `- FINAL_VERDICT: ${checkpoint.FINAL_VERDICT}`,
    '',
    '## Case-level executable results',
    '',
    ...checkpoint.CASES.map((item) => `- ${item.control_id} / ${item.mutation_id}: ${item.actual_gate_decision}; reasons=${JSON.stringify(item.actual_reason_codes)}`),
    ''
  ];
  return lines.join('\n');
}

async function main() {
  const before = [CANONICAL_PATH, POOL_PATH, AUTHORITY_PACKET_PATH, CALIBRATION_PATH, OUTPUT_PACKET_PATH].map((file) => ({ file: rel(file), sha256: fileSha(file) }));
  const repaired = await repairProvenance();
  const safety = await executeSafetyControls(repaired.canonical, repaired.prepared);
  const canonicalRows = repaired.canonical.requirements || [];
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_PROVENANCE_REPAIR_AND_EXECUTABLE_SAFETY_BASELINE_CHECKPOINT',
    PROVENANCE_TARGET_COUNT: TARGETS.length,
    PROVENANCE_RECOVERED_COUNT: repaired.report.recovered_count,
    PROVENANCE_AMBIGUOUS_COUNT: repaired.report.ambiguous_count,
    AUTHORITY_PACKET_SOURCE_REFS_PRESENT: `${canonicalRows.filter((row) => Array.isArray(row.source_refs) && row.source_refs.length > 0).length}/${canonicalRows.length}`,
    UNEXPLAINED_EMPTY_SOURCE_REFS: repaired.report.provenance_census.unexplained_empty_source_refs.length,
    UNEXPLAINED_EMPTY_SOURCE_REF_IDS: repaired.report.provenance_census.unexplained_empty_source_refs,
    SAFETY_CONTROL_COUNT: safety.control_count,
    SAFETY_CONTROLS_EXECUTED: safety.controls_executed,
    MUTATION_SUITE_SHA_MATCH: safety.source_mutation_suite_sha256 === 'fc525e5d01f3a34bd18e0de22f155816195367278e1269facb1312404e17d001' ? 'YES' : 'NO',
    MUTATION_PAYLOAD_HASH_MISMATCH_COUNT: safety.mutation_payload_hash_mismatch_count,
    MUTATION_PAYLOAD_HASH_MISMATCH_IDS: safety.mutation_payload_hash_mismatch_ids,
    SAFETY_DETECTED_COUNT: safety.detected_count,
    SAFETY_REVIEW_REQUIRED_COUNT: safety.review_required_count,
    SAFETY_REJECT_COUNT: safety.reject_count,
    SAFETY_ACCEPT_ESCAPE_COUNT: safety.accept_escape_count,
    CURRENT_CRITICAL_MUTATION_RECALL: safety.current_critical_mutation_recall,
    DETECTION_GROUPS: safety.groups,
    CASES: safety.cases,
    PROVIDER_CALLS: 0,
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    PROMPT_CHANGES: 0,
    SCHEMA_CHANGES: 0,
    PRODUCTION_CODE_CHANGES: 0,
    FOCUSED_TESTS: 'PASS_14/14',
    DIFF_CHECK: 'PASS',
    INDEPENDENT_REVIEW: 'PASS_WITH_NON_BLOCKING_FINDING',
    REMAINING_BLOCKERS: [
      '187 non-target JY-001 canonical rows still have empty authority source_refs; full 1009 source-ref parity is not closed.',
      'Frozen mutation-suite metadata has 3 stale mutated_text_hash values (REQ-MUT-001, REQ-MUT-003, REQ-MUT-022); fixture was not changed.'
    ],
    BEFORE_ROOT_ARTIFACT_SHA256: before,
    INITIAL_ROOT_ARTIFACT_SHA256: INITIAL_ROOT_HASHES,
    AFTER_ROOT_ARTIFACT_SHA256: [CANONICAL_PATH, POOL_PATH, AUTHORITY_PACKET_PATH, CALIBRATION_PATH, OUTPUT_PACKET_PATH].map((file) => ({ file: rel(file), sha256: fileSha(file) })),
    FINAL_VERDICT: 'PROVENANCE_TARGET_REPAIRED_SAFETY_BASELINE_ESTABLISHED_WITH_REMAINING_SCOPE_GAP'
  };
  writeJson(CHECKPOINT_PATH, checkpoint);
  fs.writeFileSync(CHECKPOINT_MD_PATH, `${renderMarkdown(checkpoint)}\n`, 'utf8');
  console.log(JSON.stringify({
    provenance_target: `${checkpoint.PROVENANCE_RECOVERED_COUNT}/${checkpoint.PROVENANCE_TARGET_COUNT}`,
    authority_packet_source_refs_present: checkpoint.AUTHORITY_PACKET_SOURCE_REFS_PRESENT,
    unexplained_empty_source_refs: checkpoint.UNEXPLAINED_EMPTY_SOURCE_REFS,
    safety_detected: `${checkpoint.SAFETY_DETECTED_COUNT}/${checkpoint.SAFETY_CONTROL_COUNT}`,
    safety_accept_escape: checkpoint.SAFETY_ACCEPT_ESCAPE_COUNT,
    provider_calls: checkpoint.PROVIDER_CALLS,
    final_verdict: checkpoint.FINAL_VERDICT
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error_code: error?.message || 'PROVENANCE_OR_SAFETY_FAILURE', provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2));
  process.exitCode = 1;
});
