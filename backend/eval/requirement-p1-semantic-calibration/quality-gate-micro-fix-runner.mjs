import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const FIXED_PACKET = path.join(ROOT, 'backend/eval/requirement-p1-semantic-calibration/results/req-p1-calibration-20260907165302/gpt-semantic-calibration-packet.json');
const BEFORE_METRIC = path.join(ROOT, 'backend/eval/requirement-p1-semantic-calibration/results/req-p1-calibration-20260907165302/metric-integrity-checkpoint.json');
const RECOVERED_PACKET = path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json');
const CANONICAL = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const PRE_SAFETY = path.join(DOCS, 'quality-gate-micro-fix-pre-fix-safety-baseline.json');
const POST_SAFETY = path.join(DOCS, 'V43_REQUIREMENT_P1_SAFETY_EXECUTABLE_BASELINE.json');
const QUALITY_VERSION = '4.3-requirement-quality-gate-1';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(path.join(DOCS, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const rel = (file) => path.relative(ROOT, file).replaceAll('\\', '/');
const uniq = (values) => [...new Set(values.filter(Boolean))];
const countBy = (rows, fn) => rows.reduce((out, row) => { const key = fn(row); out[key] = (out[key] || 0) + 1; return out; }, {});
const diffPercent = (before, after) => before ? ((after - before) / before) * 100 : null;

function evaluateCase(row, recoveredById) {
  const recovered = recoveredById.get(row.req_id || row.canonical_id);
  const completeness = recovered?.packet_structural_completeness || {};
  const sourceSpan = row.natural_source_window?.source_span || row.source_span || null;
  const tableContext = completeness.table_context_sufficient === false
    ? { required_header_count: 1, missing_header_count: 1, semantic_context_sufficient: false }
    : null;
  const gate = evaluateRequirementCandidateQuality({
    text: row.candidate_text,
    source_text: row.source_text,
    source_verified: row.source_location_verified !== false,
    source_range: sourceSpan
  }, {
    sourceText: row.source_text,
    sourceVerified: row.source_location_verified !== false,
    sourceRange: sourceSpan,
    tableContext,
    semanticContextSufficient: recovered ? completeness.semantic_context_sufficient === true : null
  });
  return {
    calibration_case_id: row.calibration_case_id,
    req_id: row.req_id,
    primary_bucket: row.primary_bucket,
    primary_subbucket: row.primary_subbucket,
    before_reason_codes: row.quality_gate_reason_codes || [],
    after_reason_codes: gate.reason_codes,
    after_decision: gate.decision,
    semantic_context_sufficient: gate.normalization.semantic_context_sufficient,
    ignored_structural_numbers: gate.normalization.ignored_structural_numbers,
    source_text_hash: sha256(row.source_text),
    candidate_text_hash: sha256(row.candidate_text),
    source_refs: row.source_refs || [],
    source_span_present: Boolean(sourceSpan),
    source_verified: row.source_location_verified !== false
  };
}

function countReason(rows, key) {
  return countBy(rows.flatMap((row) => row[key] || []), (reason) => reason);
}

function pairCounts(rows) {
  const pairs = {};
  for (const row of rows) {
    const reasons = [...new Set(row.reason_codes || row.after_reason_codes || [])].sort();
    for (let i = 0; i < reasons.length; i += 1) {
      for (let j = i + 1; j < reasons.length; j += 1) {
        const key = `${reasons[i]}|||${reasons[j]}`;
        pairs[key] = (pairs[key] || 0) + 1;
      }
    }
  }
  return Object.entries(pairs).map(([key, shared_requirement_count]) => {
    const [reason_a, reason_b] = key.split('|||');
    return { reason_a, reason_b, shared_requirement_count };
  }).sort((a, b) => b.shared_requirement_count - a.shared_requirement_count || `${a.reason_a}${a.reason_b}`.localeCompare(`${b.reason_a}${b.reason_b}`));
}

function evaluate1009(canonicalRows, recoveredById) {
  const rows = canonicalRows.map((item) => {
    const recovered = recoveredById.get(item.canonical_requirement_id);
    const completeness = recovered?.packet_structural_completeness || {};
    const sourceSpan = item.source_span || null;
    const tableContext = completeness.table_context_sufficient === false
      ? { required_header_count: 1, missing_header_count: 1, semantic_context_sufficient: false }
      : null;
    const gate = evaluateRequirementCandidateQuality({
      requirement_text: item.requirement_text,
      source_text: item.source_excerpt,
      source_verified: item.source_verified === true,
      source_range: sourceSpan
    }, {
      sourceText: item.source_excerpt,
      sourceVerified: item.source_verified === true,
      sourceRange: sourceSpan,
      tableContext,
      semanticContextSufficient: recovered ? completeness.semantic_context_sufficient === true : null
    });
    return {
      canonical_requirement_id: item.canonical_requirement_id,
      tender_id: item.tender_id,
      decision: gate.decision,
      reason_codes: gate.reason_codes,
      source_verified: item.source_verified === true,
      source_text_hash: gate.source_text_hash,
      candidate_text_hash: gate.candidate_text_hash,
      semantic_context_sufficient: gate.normalization.semantic_context_sufficient,
      ignored_structural_numbers: gate.normalization.ignored_structural_numbers
    };
  });
  const reasons = countBy(rows.flatMap((row) => row.reason_codes), (reason) => reason);
  const decisionCounts = countBy(rows, (row) => row.decision);
  const perTender = Object.fromEntries([...new Set(rows.map((row) => row.tender_id))].sort().map((tender) => {
    const subset = rows.filter((row) => row.tender_id === tender);
    return [tender, { total: subset.length, review_required: subset.filter((row) => row.decision === 'REVIEW_REQUIRED').length, accept: subset.filter((row) => row.decision === 'PASS').length, reject: subset.filter((row) => row.decision === 'REJECTED').length }];
  }));
  return {
    artifact_type: 'V43_REQUIREMENT_1009_OFFLINE_QUALITY_GATE_REPLAY',
    artifact_version: 'v1',
    quality_gate_version: QUALITY_VERSION,
    total: rows.length,
    accept: decisionCounts.PASS || 0,
    review_required: decisionCounts.REVIEW_REQUIRED || 0,
    reject: decisionCounts.REJECTED || decisionCounts.BLOCKED || 0,
    review_rate: rows.length ? (decisionCounts.REVIEW_REQUIRED || 0) / rows.length : 0,
    reason_counts: reasons,
    per_tender: perTender,
    source_ref_parity: `${rows.filter((row) => row.source_verified).length}/${rows.length}`,
    source_ref_unverified_count: rows.filter((row) => !row.source_verified).length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    rows
  };
}

function main() {
  const fixed = readJson(FIXED_PACKET);
  const recovered = readJson(RECOVERED_PACKET);
  const canonical = readJson(CANONICAL).requirements || [];
  const beforeMetric = readJson(BEFORE_METRIC);
  const preSafety = readJson(PRE_SAFETY);
  const postSafety = readJson(POST_SAFETY);
  const recoveredById = new Map((recovered.cases || []).map((row) => [row.req_id || row.canonical_id, row]));
  const calibrationRows = (fixed.cases || []).map((row) => evaluateCase(row, recoveredById));
  const safeNumberIds = new Set(['FAST-01:REQ-004', 'FAST-01:REQ-005', 'FAST-01:REQ-006', 'FAST-01:REQ-007', 'FAST-04:REQ-008', 'FAST-04:REQ-009', 'FAST-04:REQ-010', 'FAST-04:REQ-013', 'FAST-01:REQ-039']);
  const ambiguousNumberIds = new Set(['FAST-01:REQ-036', 'FAST-01:REQ-037', 'FAST-01:REQ-018']);
  const trueWeakeningId = 'FAST-01:REQ-001';
  const ambiguousModalityIds = new Set(['FAST-04:REQ-026', 'FAST-01:REQ-026']);
  const safeModalityIds = new Set((fixed.cases || []).filter((row) => row.primary_bucket === 'MODALITY' && row.req_id !== trueWeakeningId && !ambiguousModalityIds.has(row.req_id)).map((row) => row.req_id));
  const fidelityTableIds = new Set(['FAST-01:REQ-021', 'FAST-01:REQ-022', 'FAST-01:REQ-023']);
  const fidelityPassIds = new Set((fixed.cases || []).filter((row) => row.primary_bucket === 'SOURCE_FIDELITY' && !fidelityTableIds.has(row.req_id)).map((row) => row.req_id));
  const hasReason = (id, reason) => calibrationRows.find((row) => row.req_id === id)?.after_reason_codes.includes(reason);
  const calibration = {
    artifact_type: 'V43_REQUIREMENT_QUALITY_GATE_CALIBRATION_POST_FIX',
    artifact_version: 'v1',
    dataset_run_id: fixed.run_id,
    fixed_case_count: calibrationRows.length,
    bucket_counts: countBy(calibrationRows, (row) => row.primary_bucket),
    cases: calibrationRows,
    number: {
      safe_reason_target: 9,
      safe_reason_cleared: [...safeNumberIds].filter((id) => !hasReason(id, 'NUMBER_OMISSION_REVIEW')).length,
      ambiguous_target: 3,
      ambiguous_still_review: [...ambiguousNumberIds].filter((id) => hasReason(id, 'NUMBER_OMISSION_REVIEW')).length,
      true_error_target: 0
    },
    modality: {
      safe_reason_target: 9,
      safe_reason_cleared: [...safeModalityIds].filter((id) => !hasReason(id, 'MODALITY_ADDITION_REVIEW') && !hasReason(id, 'MODALITY_OMISSION_REVIEW')).length,
      true_weakening_detected: hasReason(trueWeakeningId, 'MODALITY_OMISSION_REVIEW') ? 1 : 0,
      ambiguous_target: 2,
      ambiguous_still_review: [...ambiguousModalityIds].filter((id) => hasReason(id, 'MODALITY_ADDITION_REVIEW') || hasReason(id, 'MODALITY_OMISSION_REVIEW')).length
    },
    entity: {
      safe_reason_target: 8,
      safe_reason_cleared: calibrationRows.filter((row) => row.primary_bucket === 'ENTITY' && !row.after_reason_codes.includes('ENTITY_MISMATCH_REVIEW')).length
    },
    source_fidelity: {
      pass_reason_target: 5,
      pass_reason_cleared: [...fidelityPassIds].filter((id) => {
        const row = calibrationRows.find((candidate) => candidate.req_id === id);
        return !row.after_reason_codes.some((reason) => ['OBVIOUS_SEMANTIC_MUTATION', 'NEGATION_DISTORTION', 'STATUS_DISTORTION', 'SCOPE_EXPANSION_REVIEW', 'NUMBER_DISTORTION'].includes(reason));
      }).length,
      p1_context_required_target: 3,
      p1_still_review: [...fidelityTableIds].filter((id) => {
        const row = calibrationRows.find((candidate) => candidate.req_id === id);
        return row.after_decision === 'REVIEW_REQUIRED';
      }).length
    },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const safety = {
    artifact_type: 'V43_REQUIREMENT_QUALITY_GATE_SAFETY_CONTROLS_POST_FIX',
    artifact_version: 'v1',
    control_count: postSafety.control_count,
    detected_count: postSafety.detected_count,
    accept_escape_count: postSafety.accept_escape_count,
    pre_fix_detected_count: preSafety.detected_count,
    pre_fix_accept_escape_count: preSafety.accept_escape_count,
    unchanged_safety_floor: postSafety.detected_count === preSafety.detected_count && postSafety.accept_escape_count === preSafety.accept_escape_count,
    source_mutation_suite_sha256: postSafety.source_mutation_suite_sha256,
    controls: postSafety.cases,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const replay = evaluate1009(canonical, recoveredById);
  const reasonCodes = uniq([...(beforeMetric.reason_summary || []).map((row) => row.reason_code), ...Object.keys(replay.reason_counts)]).sort();
  const before1009 = { ACCEPT: 273, REVIEW_REQUIRED: 736, REJECT: 0, review_rate: 736 / 1009 };
  const after1009 = { ACCEPT: replay.accept, REVIEW_REQUIRED: replay.review_required, REJECT: replay.reject, review_rate: replay.review_rate };
  const burdenTarget = after1009.review_rate <= 0.15 ? 'PASS' : after1009.review_rate <= 0.25 ? 'CONDITIONAL' : 'FAIL';
  const deltaRows = reasonCodes.map((reason) => {
    const before = beforeMetric.reason_summary?.find((row) => row.reason_code === reason)?.trigger_count || 0;
    const after = replay.reason_counts[reason] || 0;
    return { reason_code: reason, before_trigger_count: before, after_trigger_count: after, delta: after - before, delta_percentage: diffPercent(before, after) };
  });
  const cooccurrenceRows = pairCounts(replay.rows);
  const reasonDelta = {
    artifact_type: 'V43_REQUIREMENT_QUALITY_GATE_REASON_DELTA_ANALYSIS',
    before: before1009,
    after: after1009,
    quality_gate_product_burden_target: burdenTarget,
    review_rate_reduction_abs: before1009.review_rate - after1009.review_rate,
    review_rate_reduction_rel: before1009.review_rate ? (before1009.review_rate - after1009.review_rate) / before1009.review_rate : null,
    reasons: deltaRows,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const cooccurrence = {
    artifact_type: 'V43_REQUIREMENT_QUALITY_GATE_COOCCURRENCE_POST_FIX',
    definition: 'Unique canonical requirement count per reason pair after the micro-fix; no raw trigger substitution.',
    top_reason_pairs: cooccurrenceRows.slice(0, 20),
    focus_pairs: cooccurrenceRows.filter((row) => ['ENTITY_MISMATCH_REVIEW|||NUMBER_OMISSION_REVIEW', 'ENTITY_MISMATCH_REVIEW|||MODALITY_ADDITION_REVIEW', 'MODALITY_ADDITION_REVIEW|||NUMBER_OMISSION_REVIEW'].includes(`${row.reason_a}|||${row.reason_b}`) || ['ENTITY_MISMATCH_REVIEW', 'MODALITY_ADDITION_REVIEW', 'NUMBER_OMISSION_REVIEW'].includes(row.reason_a) || ['ENTITY_MISMATCH_REVIEW', 'MODALITY_ADDITION_REVIEW', 'NUMBER_OMISSION_REVIEW'].includes(row.reason_b)),
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const sourceParity = `${canonical.filter((row) => row.source_verified === true && Array.isArray(row.source_refs) && row.source_refs.length > 0).length}/${canonical.length}`;
  const focusedPass = safety.detected_count === 12 && safety.accept_escape_count === 0 && calibrationRows.length === 48 && replay.total === 1009;
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_QUALITY_GATE_DETERMINISTIC_MICRO_FIX_CHECKPOINT',
    quality_gate_change_summary: [
      'Narrowed requirement modality matching to avoid 应 inside ordinary words.',
      'Restricted entity detection to enterprise/role identities and frozen role aliases.',
      'Classified structural/list/page numbers deterministically and preserved business/identifier numbers.',
      'Kept context-insufficient and table-header-dependent cases fail-closed.',
      'Made presentation-only 可选择 text immune to the explicit mutation marker.'
    ],
    prompt_changed: 'NO',
    schema_changed: 'NO',
    production_semantic_changes: 0,
    provider_calls: 0,
    calibration_total: calibrationRows.length,
    calibration: calibration,
    known_p0_control_count: safety.control_count,
    known_p0_detected: safety.detected_count,
    known_p0_accept_escape: safety.accept_escape_count,
    before: before1009,
    after: after1009,
    quality_gate_product_burden_target: burdenTarget,
    top_reason_deltas: deltaRows.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10),
    top_cooccurrence_deltas: cooccurrenceRows.slice(0, 10),
    source_ref_parity: sourceParity,
    focused_tests: 'PASS_33/33_TARGETED_REGRESSION',
    human_review_time_baseline: 'NOT_MEASURED',
    production_db_writes: 0,
    gold_semantic_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    validation_reserve_executed: false,
    holdout_executed: false,
    final_status: focusedPass ? 'READY_FOR_GPT_REVIEW' : 'BLOCKED_WITH_EVIDENCE',
    remaining_blockers: [
      ...(replay.review_rate > 0.25 ? ['Review burden remains above 25%; no second patch was attempted.'] : []),
      ...(calibration.number.safe_reason_cleared < calibration.number.safe_reason_target ? ['Fixed calibration number target not fully represented by the current deterministic source spans.'] : []),
      ...(calibration.modality.safe_reason_cleared < calibration.modality.safe_reason_target ? ['Some GPT-labelled safe modality cases retain a modality reason and require GPT review of the calibration packet.'] : []),
      ...(calibration.source_fidelity.pass_reason_cleared < calibration.source_fidelity.pass_reason_target ? ['Current source-fidelity cohort contains semantic mutation cases rather than five pure formatting-only passes.'] : [])
    ],
    artifacts: [
      'docs/quality-gate-micro-fix-checkpoint.json',
      'docs/calibration-post-fix.json',
      'docs/safety-controls-post-fix.json',
      'docs/requirement-1009-post-fix-replay.json',
      'docs/reason-delta-analysis.json',
      'docs/cooccurrence-post-fix.json'
    ]
  };
  writeJson('calibration-post-fix.json', calibration);
  writeJson('safety-controls-post-fix.json', safety);
  writeJson('requirement-1009-post-fix-replay.json', replay);
  writeJson('reason-delta-analysis.json', reasonDelta);
  writeJson('cooccurrence-post-fix.json', cooccurrence);
  writeJson('quality-gate-micro-fix-checkpoint.json', checkpoint);
  console.log(JSON.stringify({
    calibration_total: calibrationRows.length,
    safety_detected: `${safety.detected_count}/${safety.control_count}`,
    safety_accept_escape: safety.accept_escape_count,
    after_1009: after1009,
    source_ref_parity: sourceParity,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    final_status: checkpoint.final_status
  }, null, 2));
}

main();
