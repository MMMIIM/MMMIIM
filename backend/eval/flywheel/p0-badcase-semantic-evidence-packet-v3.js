import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  getSemanticTaskContract,
  REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
  REQUIREMENT_CANDIDATE_SCHEMA_SHA256
} from '@bid/semantic-contracts';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const V2_PACKET_PATH = path.join(DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V2.json');
const RESULTS_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_V2_RESULTS.json');
const PLAN_PATH = path.join(DIR, 'V43_P0_BADCASE_44_REPLAY_PLAN_V2.json');
const OUT_PATH = path.join(DIR, 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V3.json');

const ALLOWED_HISTORICAL_DIVERGENCE = new Set([
  'PROVABLE',
  'NOT_PERSISTED',
  'PARTIALLY_RECONSTRUCTED',
  'NOT_PERSISTED_OR_RECONSTRUCTED'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stripSha(value) {
  return String(value || '').replace(/^sha256:/i, '');
}

function boundedText(value, max = 8000) {
  const text = typeof value === 'string' ? value : '';
  return {
    text: text.length > max ? `${text.slice(0, max)}…` : text,
    truncated: text.length > max,
    original_length: text.length
  };
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function candidateSafeCopy(candidate) {
  const blocked = /api[_-]?key|authorization|bearer|secret|credential|response_payload_json|prompt/i;
  const result = {};
  for (const [key, value] of Object.entries(candidate || {})) {
    if (blocked.test(key)) continue;
    result[key] = value;
  }
  return result;
}

function parseRef(ref) {
  const match = /^C(\d{3})-S(\d{3})$/.exec(String(ref || ''));
  return match ? { container: Number(match[1]), segment: Number(match[2]) } : null;
}

function refsFromRange(range, inputRefs) {
  if (!range || !Array.isArray(inputRefs)) return [];
  const start = parseRef(range.start_ref);
  const end = parseRef(range.end_ref);
  if (!start || !end || start.container !== end.container || start.segment > end.segment) return [];
  return inputRefs.filter((ref) => {
    const parsed = parseRef(ref);
    return parsed && parsed.container === start.container
      && parsed.segment >= start.segment && parsed.segment <= end.segment;
  });
}

function stageEvidence(ref) {
  const actualPath = ref.path;
  if (!fs.existsSync(actualPath)) {
    throw new Error(`restricted evidence missing: ${actualPath}`);
  }
  const actualSha = sha256File(actualPath);
  const expectedSha = stripSha(ref.sha256);
  if (actualSha !== expectedSha) {
    throw new Error(`restricted evidence SHA mismatch: ${actualPath}`);
  }
  const envelope = readJson(actualPath);
  return { envelope, actualSha, path: actualPath };
}

function loadSnapshots(row) {
  const stages = {};
  const snapshotHashes = [];
  for (const ref of row.replay_evidence?.restricted_evidence_refs || []) {
    const snapshot = stageEvidence(ref);
    const stage = snapshot.envelope.stage;
    stages[stage] = snapshot.envelope.evidence || {};
    snapshotHashes.push({ stage, path: snapshot.path, sha256: snapshot.actualSha });
  }

  const input = stages.PROVIDER_INPUT_SNAPSHOT || {};
  const rawEvidence = stages.RAW_PROVIDER_RESPONSE_SNAPSHOT || {};
  let rawCandidates = [];
  if (typeof rawEvidence.response_payload_json === 'string') {
    const payload = JSON.parse(rawEvidence.response_payload_json);
    rawCandidates = Array.isArray(payload?.data?.requirements) ? payload.data.requirements : [];
  }
  const normalizedEvidence = stages.NORMALIZED_CANDIDATE_SNAPSHOT || {};
  const normalizedCandidates = Array.isArray(normalizedEvidence.candidates)
    ? normalizedEvidence.candidates
    : [];
  return {
    stages,
    snapshotHashes,
    input,
    rawCandidates,
    normalizedCandidates,
    sourceResolution: stages.SOURCE_RESOLUTION_SNAPSHOT || {},
    canonicalization: stages.CANONICALIZATION_DECISION_SNAPSHOT || {},
    canonicalOutput: stages.CANONICAL_OUTPUT_SNAPSHOT || {}
  };
}

function candidateSourceExcerpt(candidate, modelText) {
  const text = typeof candidate?.text === 'string' ? candidate.text : '';
  if (!text || typeof modelText !== 'string') {
    return { text: null, match_status: 'NOT_AVAILABLE' };
  }
  const index = modelText.indexOf(text);
  if (index < 0) return { text: null, match_status: 'NOT_FOUND_IN_CAPTURED_INPUT' };
  const start = Math.max(0, index - 240);
  const end = Math.min(modelText.length, index + text.length + 240);
  return {
    text: modelText.slice(start, end),
    match_status: 'EXACT_SUBSTRING_MATCH',
    start_offset: index,
    end_offset: index + text.length
  };
}

function buildNormalizationTrace(rawCandidate, normalizedCandidate, index, inputRefs) {
  const raw = candidateSafeCopy(rawCandidate);
  const normalized = candidateSafeCopy(normalizedCandidate);
  const rawKeys = Object.keys(raw);
  const normalizedKeys = Object.keys(normalized);
  const fieldsDropped = rawKeys.filter((key) => !Object.prototype.hasOwnProperty.call(normalized, key));
  const fieldsChanged = rawKeys.filter((key) => Object.prototype.hasOwnProperty.call(normalized, key)
    && !deepEqual(raw[key], normalized[key]));
  return {
    raw_candidate_index: index + 1,
    normalized_text: normalized.text ?? null,
    normalized_category: normalized.category ?? null,
    normalized_source_refs: refsFromRange(normalized.source_range, inputRefs),
    fields_changed: fieldsChanged,
    fields_dropped: fieldsDropped,
    decision: deepEqual(raw, normalized) ? 'NO_OBSERVED_CHANGE' : 'OBSERVED_CHANGE',
    reason: 'Mechanical comparison of captured raw and normalized candidate snapshots; no semantic inference.'
  };
}

function sourceResolutionForCandidate(index, normalizedCandidate, snapshot) {
  const summary = snapshot.sourceResolution || {};
  if (summary.source_resolution_success === true) {
    return {
      status: 'RESOLVED',
      failure_code: null,
      refs: refsFromRange(normalizedCandidate?.source_range, snapshot.input.source_refs),
      evidence: 'Aggregate source-resolution snapshot reports success; per-candidate resolved location was not separately persisted.'
    };
  }
  if (summary.source_resolution_success === false) {
    return {
      status: 'NOT_PERSISTED_PER_CANDIDATE',
      failure_code: summary.source_resolution_failure_code || 'SOURCE_RESOLUTION_FAILED_WITHOUT_CANDIDATE_INDEX',
      failed_candidate_index: summary.source_resolution_failed_candidate_index ?? null,
      refs: refsFromRange(normalizedCandidate?.source_range, snapshot.input.source_refs),
      evidence: 'Aggregate failure is persisted, but the per-candidate failure index is not persisted; no candidate-level attribution is inferred.'
    };
  }
  return {
    status: 'NOT_PERSISTED_AFTER_AGGREGATE_EMPTY_OR_UNAVAILABLE',
    failure_code: null,
    failed_candidate_index: null,
    refs: refsFromRange(normalizedCandidate?.source_range, snapshot.input.source_refs),
    evidence: 'No candidate-level source-resolution result was persisted for this execution.'
  };
}

function canonicalizationForCandidate(index, snapshot) {
  const summary = snapshot.canonicalization || {};
  return {
    decision: 'OTHER',
    rule: 'PER_CANDIDATE_DECISION_NOT_PERSISTED',
    resulting_requirement_id: null,
    resulting_requirement_text: null,
    quality_gate_decision: summary.quality_gate_decision ?? snapshot.canonicalOutput?.quality_gate_decision ?? null,
    reason: 'Only aggregate canonicalization evidence was persisted; Codex does not infer inclusion, exclusion, merge, or deduplication for candidate index '
      + (index + 1) + '.',
    aggregate_failure_code: summary.canonicalization_failure_code ?? snapshot.canonicalOutput?.canonicalization_failure_code ?? null
  };
}

function reconstructCanonicalOutputs(snapshot) {
  if (!snapshot.normalizedCandidates.length) {
    return {
      status: 'NOT_APPLICABLE_NO_CANDIDATES',
      resulting_canonical_requirements: [],
      aggregate_output_snapshot: snapshot.canonicalOutput,
      reason: 'No normalized candidates were captured.'
    };
  }
  if (snapshot.sourceResolution.source_resolution_success !== true) {
    return {
      status: 'NOT_RECONSTRUCTED_SOURCE_RESOLUTION_NOT_PASS',
      resulting_canonical_requirements: [],
      aggregate_output_snapshot: snapshot.canonicalOutput,
      reason: 'Current deterministic reconstruction is limited to executions whose persisted aggregate source-resolution result passed.'
    };
  }
  try {
    const capturedSource = typeof snapshot.input.model_text === 'string' ? snapshot.input.model_text : '';
    const candidatesWithCapturedSource = snapshot.normalizedCandidates.map((candidate) => ({
      ...candidate,
      // This is the exact captured replay input, not a generated excerpt. It
      // enables the existing deterministic canonicalizer to run without
      // inventing a per-candidate source span that V2 did not persist.
      source_text: capturedSource,
      source_verified: Boolean(capturedSource),
      source_resolution_status: capturedSource ? 'verified' : 'unresolved',
      source_match_type: null,
      source_hash: null,
      source_chunk_id: snapshot.input.source_chunk_id || null
    }));
    const canonical = buildCanonicalRequirements(candidatesWithCapturedSource, { qualityGate: true });
    return {
      status: 'CURRENT_DETERMINISTIC_REPLAY_RECONSTRUCTION',
      resulting_canonical_requirements: canonical.map((item) => {
        const sourceCandidateIndex = item.deduplication?.merged_candidate_refs?.[0];
        const sourceCandidate = Number.isInteger(sourceCandidateIndex)
          ? snapshot.normalizedCandidates[sourceCandidateIndex - 1]
          : null;
        return {
        req_id: item.req_id,
        text: item.text,
        content: item.content,
        category: item.category,
        requirement_category: item.requirement_category,
        writer_eligible: item.writer_eligible,
        requires_confirmation: item.requires_confirmation,
        confirmation_reasons: item.confirmation_reasons,
        risk_flags: item.risk_flags,
        source_range: sourceCandidate?.source_range || null,
        source_refs: refsFromRange(sourceCandidate?.source_range, snapshot.input.source_refs),
        source_verified: item.source_verified,
        source_resolution_status: item.source_resolution_status,
        deduplication: item.deduplication
        };
      }),
      aggregate_output_snapshot: snapshot.canonicalOutput,
      reason: 'Derived only by invoking the existing deterministic canonicalizer on captured normalized candidates; this is not a semantic adjudication or historical output claim.'
    };
  } catch (error) {
    return {
      status: 'RECONSTRUCTION_FAILED',
      resulting_canonical_requirements: [],
      aggregate_output_snapshot: snapshot.canonicalOutput,
      reason: 'Existing deterministic canonicalizer could not reconstruct a bounded output from the captured candidates.',
      error_code: error?.code || error?.name || 'ERROR'
    };
  }
}

function buildCandidateEvidence(snapshot) {
  const normalized = snapshot.normalizedCandidates;
  const raw = snapshot.rawCandidates;
  return normalized.map((normalizedCandidate, index) => {
    const rawCandidate = raw[index] || {};
    return {
      candidate_index: index + 1,
      provider_output: candidateSafeCopy(rawCandidate),
      normalized_output: candidateSafeCopy(normalizedCandidate),
      source_refs_or_hints: {
        raw_source_range: rawCandidate.source_range || null,
        normalized_source_range: normalizedCandidate.source_range || null,
        derived_input_refs: refsFromRange(normalizedCandidate.source_range, snapshot.input.source_refs)
      },
      source_excerpt_match: candidateSourceExcerpt(normalizedCandidate, snapshot.input.model_text),
      normalization_trace: buildNormalizationTrace(rawCandidate, normalizedCandidate, index, snapshot.input.source_refs),
      source_resolution: sourceResolutionForCandidate(index, normalizedCandidate, snapshot),
      canonicalization: canonicalizationForCandidate(index, snapshot)
    };
  });
}

function currentRuntimeFingerprint(resultsRows) {
  const contract = getSemanticTaskContract('requirement_extraction');
  const audits = resultsRows.map((row) => row.probe_audit || {});
  const unique = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))];
  const providers = unique(resultsRows.map((row) => row.provider));
  const models = unique(resultsRows.map((row) => row.model));
  const endpoints = unique(resultsRows.map((row) => row.endpoint));
  const generationConfigs = unique(audits.map((audit) => JSON.stringify(audit.generation_config || {})))
    .map((value) => JSON.parse(value));
  return {
    task_type: 'requirement_extraction',
    requirement_prompt_version: contract.contract_version,
    requirement_prompt_sha256: contract.instruction_hash,
    task_instruction_sha256: contract.instruction_hash,
    provider: providers.length === 1 ? providers[0] : providers,
    model: models.length === 1 ? models[0] : models,
    endpoint: endpoints.length === 1 ? endpoints[0] : endpoints,
    generation_config: generationConfigs.length === 1 ? generationConfigs[0] : generationConfigs,
    candidate_schema_version: REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
    candidate_schema_sha256: REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
    normalizer_version: { value: null, status: 'NOT_PERSISTED_IN_V2_REPLAY' },
    canonicalizer_version: { value: '4.3-canonical-requirement-1', status: 'CURRENT_CODE_IDENTITY_ONLY' },
    source_resolver_version: { value: null, status: 'MODULE_NOT_VERSIONED' },
    historical_values_source: 'V2 replay artifacts; historical exact prompt/schema pairing was not persisted.'
  };
}

function historicalDivergence(row) {
  const level = row.authoritative_replay_input?.chunk_identity?.[0]?.replay_input_authority_level
    ?? row.source_condition?.replay_input_authority_level;
  if (level === 3) return 'NOT_PERSISTED_OR_RECONSTRUCTED';
  return 'NOT_PERSISTED';
}

function buildRow(v2Row, resultRow, planChunk, snapshot) {
  const inputExcerpt = boundedText(snapshot.input.model_text, 8000);
  const chunkIdentity = v2Row.authoritative_replay_input?.chunk_identity?.[0] || {};
  const candidateCount = Number(v2Row.provider_evidence?.candidate_count || 0);
  const caseRow = {
    atom_id: v2Row.atom_id,
    tender_id: v2Row.tender_id,
    frozen_semantic_label: v2Row.frozen_semantic_label,
    frozen_semantic_label_provenance: 'V2_HISTORICAL_INPUT_NOT_NEW_ADJUDICATION',
    historical_semantic_reason: v2Row.semantic_reason ?? null,
    source_truth: v2Row.source_truth,
    authoritative_replay_input: {
      resolution_status: v2Row.authoritative_replay_input?.resolution_status ?? null,
      resolution_method: v2Row.authoritative_replay_input?.resolution_method ?? null,
      replay_input_authority_level: chunkIdentity.replay_input_authority_level
        ?? v2Row.source_condition?.replay_input_authority_level
        ?? null,
      source_chunk_id: v2Row.replay_evidence?.replay_key?.split('|').slice(1).join('|')
        ?? resultRow?.source_chunk_id
        ?? null,
      source_refs: snapshot.input.source_refs || resultRow?.source_refs || [],
      source_hashes: snapshot.input.source_hashes || resultRow?.source_hashes || [],
      input_sha256: snapshot.input.input_sha256 || resultRow?.input_sha256 || null,
      source_page_start: chunkIdentity.source_page_start ?? planChunk?.source_page_start ?? null,
      source_page_end: chunkIdentity.source_page_end ?? planChunk?.source_page_end ?? null,
      source_paragraph_start: chunkIdentity.source_paragraph_start ?? planChunk?.source_paragraph_start ?? null,
      source_paragraph_end: chunkIdentity.source_paragraph_end ?? planChunk?.source_paragraph_end ?? null,
      replay_text_excerpt: inputExcerpt.text,
      replay_text_excerpt_truncated: inputExcerpt.truncated,
      replay_text_length: inputExcerpt.original_length
    },
    current_provider_output: {
      candidate_count: candidateCount,
      candidate_semantic_contents_available: snapshot.rawCandidates.length === candidateCount
        && snapshot.normalizedCandidates.length === candidateCount,
      candidates: buildCandidateEvidence(snapshot),
      candidate_zero_evidence: candidateCount === 0
        ? {
          raw_provider_response_status: 'success',
          normalized_candidate_count: 0,
          explicit_quality_gate_reason_codes: snapshot.canonicalization.quality_gate_reason_codes || [],
          evidence: 'Captured raw and normalized snapshots both contain an empty requirements array.'
        }
        : null
    },
    normalization_summary: {
      candidate_count: snapshot.normalizedCandidates.length,
      candidate_keys: snapshot.stages.NORMALIZED_CANDIDATE_SNAPSHOT?.candidate_keys || [],
      per_candidate_trace_available: snapshot.normalizedCandidates.length > 0,
      output_fields_not_persisted_in_v2: Boolean(snapshot.stages.NORMALIZED_CANDIDATE_SNAPSHOT?.output_keys_not_persisted_in_repo)
    },
    source_resolution_summary: snapshot.sourceResolution,
    canonicalization_summary: snapshot.canonicalization,
    bounded_canonical_outputs: reconstructCanonicalOutputs(snapshot),
    restricted_evidence: {
      snapshot_count: snapshot.snapshotHashes.length,
      snapshot_hashes: snapshot.snapshotHashes,
      all_references_verified: true
    },
    divergence_boundaries: {
      historical_exact_first_divergence: historicalDivergence(v2Row),
      current_replay_failure_mechanism: 'PENDING_GPT',
      mechanical_first_divergence: {
        scope: v2Row.mechanical_first_divergence?.scope ?? v2Row.replay_evidence?.divergence?.scope ?? null,
        stage: v2Row.mechanical_first_divergence?.stage ?? v2Row.replay_evidence?.divergence?.stage ?? null,
        status: v2Row.mechanical_first_divergence?.status ?? v2Row.replay_evidence?.divergence?.status ?? null,
        reason: v2Row.mechanical_first_divergence?.reason ?? v2Row.replay_evidence?.divergence?.reason ?? null
      },
      semantic_root_cause: 'PENDING_GPT'
    },
    explicit_case_flags: {
      table_row_index_pollution: v2Row.atom_id === 'FAST-04-P0-0203' || v2Row.atom_id === 'FAST-04-P0-0204'
        ? 'OBSERVED_PHENOMENON_ONLY_NO_PIPELINE_ORIGIN_ASSIGNED' : null,
      source_internal_conflict: v2Row.atom_id === 'FAST-WATER-01-P0-0072'
        ? 'SOURCE_INTERNAL_CONFLICT_NO_AUTO_REPAIR' : null,
      level_3_reconstruction: ['FAST-01-P0-0011', 'FAST-01-P0-0017', 'FAST-01-P0-0018', 'FAST-01-P0-0019'].includes(v2Row.atom_id)
        ? 'HISTORICAL_EXACT_DIVERGENCE_NOT_PERSISTED_OR_RECONSTRUCTED' : null
    }
  };
  return caseRow;
}

function validatePacket(packet, snapshotsReused) {
  if (packet.rows.length !== 44) throw new Error(`expected 44 rows, got ${packet.rows.length}`);
  const ids = packet.rows.map((row) => row.atom_id);
  if (new Set(ids).size !== 44) throw new Error('atom ids are not unique');
  const labels = packet.rows.map((row) => row.frozen_semantic_label);
  const counts = Object.fromEntries([...new Set(labels)].map((label) => [label, labels.filter((value) => value === label).length]));
  if (counts.MISS !== 31 || counts.PARTIAL !== 7 || counts.DISTORTED !== 6) throw new Error(`frozen label counts mismatch: ${JSON.stringify(counts)}`);
  for (const row of packet.rows) {
    if (!ALLOWED_HISTORICAL_DIVERGENCE.has(row.divergence_boundaries.historical_exact_first_divergence)) throw new Error(`invalid historical divergence for ${row.atom_id}`);
    if (row.divergence_boundaries.current_replay_failure_mechanism !== 'PENDING_GPT') throw new Error(`semantic status not pending for ${row.atom_id}`);
    const count = row.current_provider_output.candidate_count;
    if (count > 0 && !row.current_provider_output.candidate_semantic_contents_available) throw new Error(`candidate evidence incomplete for ${row.atom_id}`);
    if (count === 0 && !row.current_provider_output.candidate_zero_evidence) throw new Error(`zero-candidate evidence missing for ${row.atom_id}`);
    const serialized = JSON.stringify(row);
    if (/response_payload_json|api[_-]?key|authorization|bearer|secret|credential/i.test(serialized)) throw new Error(`restricted content leaked for ${row.atom_id}`);
  }
  if (snapshotsReused !== 100) throw new Error(`expected 100 unique snapshots reused, got ${snapshotsReused}`);
  return { counts, unique_atom_ids: ids.length };
}

function main() {
  const v2 = readJson(V2_PACKET_PATH);
  const results = readJson(RESULTS_PATH);
  const plan = readJson(PLAN_PATH);
  const resultByKey = new Map((results.rows || []).map((row) => [row.replay_key, row]));
  const planByKey = new Map((plan.chunks || []).map((chunk) => [chunk.replay_key, chunk]));
  const rows = [];
  const uniqueSnapshotPaths = new Set();
  for (const v2Row of v2.rows || []) {
    const replayKey = v2Row.replay_evidence?.replay_key;
    const resultRow = resultByKey.get(replayKey) || {};
    const planChunk = planByKey.get(replayKey) || {};
    const snapshot = loadSnapshots(v2Row);
    for (const entry of snapshot.snapshotHashes) uniqueSnapshotPaths.add(entry.path);
    rows.push(buildRow(v2Row, resultRow, planChunk, snapshot));
  }
  const order = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
  rows.sort((a, b) => order.indexOf(a.tender_id) - order.indexOf(b.tender_id)
    || a.atom_id.localeCompare(b.atom_id, undefined, { numeric: true }));
  const packet = {
    artifact_type: 'V43_P0_BADCASE_44_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V3',
    artifact_version: 'v3',
    status: 'READY_FOR_GPT_P0_44_SEMANTIC_ROOT_CAUSE_ADJUDICATION_V3',
    source_truth_id: v2.source_truth_id,
    source_truth_sha256: v2.source_truth_sha256,
    production_run_id: v2.production_run_id,
    replay_run_id: v2.replay_run_id,
    replay_status: v2.replay_status,
    provider_calls: results.provider_calls,
    provider_rerun_calls: 0,
    existing_restricted_snapshots_reused_count: 100,
    unique_restricted_snapshots_reused_count: uniqueSnapshotPaths.size,
    current_runtime_fingerprint: currentRuntimeFingerprint(results.rows || []),
    historical_runtime_parity: 'PARTIAL',
    semantic_labels_are_frozen_inputs: true,
    semantic_root_cause_authority: 'GPT_ONLY',
    rows
  };
  const validation = validatePacket(packet, uniqueSnapshotPaths.size);
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const outputSha = sha256File(OUT_PATH);
  process.stdout.write(JSON.stringify({
    output_path: OUT_PATH,
    output_sha256: outputSha,
    row_count: packet.rows.length,
    label_counts: validation.counts,
    unique_snapshot_count: uniqueSnapshotPaths.size,
    provider_rerun_calls: 0,
    historical_runtime_parity: packet.historical_runtime_parity
  }, null, 2) + '\n');
}

main();
