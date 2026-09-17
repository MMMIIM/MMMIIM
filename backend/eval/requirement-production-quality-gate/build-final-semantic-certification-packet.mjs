import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');

export const INPUTS = Object.freeze({
  outputReview: path.join(DOCS, 'V43_REQUIREMENT_OUTPUT_SIDE_REVIEW.jsonl'),
  sourceBlind: path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl'),
  canonical: path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
  fixed48Runtime: path.join(DOCS, 'V43_REQUIREMENT_FIXED_48_RUNTIME_RUN.json'),
  fixed48Certification: path.join(
    DOCS,
    'V43_REQUIREMENT_FIXED48_LIVE_CERTIFICATION_RUN_req-fixed48-live-20260907080143328-71904882.json'
  )
});

export const OUTPUTS = Object.freeze({
  outputPacket: path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET.jsonl'),
  sourceManifest: path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_SOURCE_PACKET_MANIFEST.json'),
  checkpoint: path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PREPARATION_CHECKPOINT.json'),
  checkpointMd: path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PREPARATION_CHECKPOINT.md')
});

const sha256 = value => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function relative(file) {
  return path.relative(REPO, file).replaceAll('\\', '/');
}

function canonicalIndex(canonicalRows) {
  return new Map(canonicalRows.map(row => [
    `${row.tender_id}|${row.canonical_requirement_id}`,
    row
  ]));
}

function fixed48QualityIndex(runtime) {
  // Fixed-48 rows use case/chunk identities rather than canonical requirement
  // identities. They are therefore not joinable to the 239 output-side rows.
  // This index is retained only to prove that no unsafe join was attempted.
  return new Map((runtime.cases || [])
    .filter(row => typeof row.canonical_requirement_id === 'string')
    .map(row => [row.canonical_requirement_id, row.quality_gate_decision]));
}

export function buildOutputPacket({ outputRows, canonicalRows, fixed48Runtime }) {
  const canonical = canonicalIndex(canonicalRows);
  const fixed48 = fixed48QualityIndex(fixed48Runtime);
  const rows = outputRows.map((row, index) => {
    const key = `${row.tender_id}|${row.canonical_requirement_id}`;
    const canonicalRow = canonical.get(key);
    const persistedQualityGateDecision = fixed48.get(row.canonical_requirement_id) || null;
    return {
      case_id: `OUTPUT-SIDE-${String(index + 1).padStart(3, '0')}`,
      run_id: row.run_id,
      tender_id: row.tender_id,
      canonical_requirement_id: row.canonical_requirement_id,
      canonical_requirement_text: row.requirement_text,
      exact_source_excerpt: row.source_excerpt,
      previous_context: null,
      next_context: null,
      table_header_context: null,
      context_availability: 'NOT_PERSISTED_IN_FROZEN_OUTPUT_ASSET',
      category: row.features?.CATEGORY ?? canonicalRow?.category ?? null,
      mandatory_observed: row.features?.MANDATORY_OBSERVED ?? canonicalRow?.mandatory_observed ?? null,
      requires_confirmation: row.features?.REQUIRES_CONFIRMATION ?? canonicalRow?.requires_confirmation ?? null,
      risk_flags: Array.isArray(row.features?.RISK_FLAGS) ? [...row.features.RISK_FLAGS] : [],
      source_refs: Array.isArray(canonicalRow?.source_refs) ? [...canonicalRow.source_refs] : [],
      source_span: row.source_span ?? canonicalRow?.source_span ?? null,
      source_hash: row.source_hash ?? canonicalRow?.source_hash ?? null,
      current_quality_gate_decision: persistedQualityGateDecision || 'NOT_PERSISTED_IN_OUTPUT_SIDE_ASSET',
      quality_gate_decision_source: persistedQualityGateDecision
        ? 'EXACT_CANONICAL_ID_JOIN_TO_FROZEN_RUNTIME'
        : 'NO_SAFE_JOIN_AVAILABLE',
      label_status: 'PENDING_INDEPENDENT_ADJUDICATION',
      gold_label_exposed: false,
      producer_label_exposed: false
    };
  });
  return {
    rows,
    canonical_join_count: rows.filter(row => row.quality_gate_decision_source.startsWith('EXACT_')).length,
    quality_gate_decision_persisted_count: rows.filter(row => row.current_quality_gate_decision !== 'NOT_PERSISTED_IN_OUTPUT_SIDE_ASSET').length,
    source_asset_sha256: sha256(fs.readFileSync(INPUTS.outputReview, 'utf8'))
  };
}

export function buildSourceManifest({ sourceRows }) {
  const statuses = Object.fromEntries(
    [...new Set(sourceRows.map(row => row.status))].sort().map(status => [
      status,
      sourceRows.filter(row => row.status === status).length
    ])
  );
  return {
    artifact_type: 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_SOURCE_PACKET_MANIFEST',
    artifact_version: 'v1',
    source_packet: relative(INPUTS.sourceBlind),
    source_packet_sha256: sha256(fs.readFileSync(INPUTS.sourceBlind, 'utf8')),
    case_count: sourceRows.length,
    canonical_visibility: 'HIDDEN_FIRST_PASS',
    expected_substantive_requirements_persisted: false,
    statuses,
    label_status: 'PENDING_BLIND_INDEPENDENT_ADJUDICATION',
    alignment_status: 'DEFERRED_UNTIL_EXPECTED_REQUIREMENTS_ARE_FROZEN',
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

function zeroCandidateCases(runtime) {
  return (runtime.cases || [])
    .filter(row => Number(row.candidate_count) === 0)
    .map(row => ({
      case_id: row.case_id,
      tender_id: row.tender_id,
      chunk_number: row.chunk_number,
      quality_gate_decision: row.quality_gate_decision,
      interpretation: 'REQUIRES_INDEPENDENT_SOURCE_REVIEW; NOT_CLASSIFIED_BY_CODEX'
    }));
}

export function buildCheckpoint({ outputPacket, sourceManifest, fixed48Runtime, fixed48Certification, generatedAt }) {
  const outputRows = outputPacket.rows;
  const zeroCandidates = zeroCandidateCases(fixed48Runtime);
  const outputReviewCount = outputRows.length;
  const sourceCount = sourceManifest.case_count;
  return {
    checkpoint: 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PREPARATION_CHECKPOINT',
    artifact_version: 'v1',
    generated_at: generatedAt,
    fixed48_runtime_gate: 'PASS',
    fixed48_evidence: {
      artifact: relative(INPUTS.fixed48Certification),
      finalized_cases: fixed48Certification.FIXED48_FINALIZED_CASES,
      provider_calls_existing_run: fixed48Certification.PROVIDER_CALLS,
      retries_existing_run: fixed48Certification.RETRIES,
      schema_valid_rate_existing_run: fixed48Certification.SCHEMA_VALID_RATE,
      telemetry_debt: 'NON_BLOCKING_EVAL_TELEMETRY_DEBT'
    },
    output_side: {
      frozen_asset: relative(INPUTS.outputReview),
      case_count: outputReviewCount,
      packet: relative(OUTPUTS.outputPacket),
      packet_case_count: outputRows.length,
      packet_status: outputRows.length === 239 ? 'READY_FOR_INDEPENDENT_ADJUDICATION' : 'INVALID_COUNT',
      label_status: 'PENDING_INDEPENDENT_ADJUDICATION',
      quality_gate_decision_persisted_count: outputPacket.quality_gate_decision_persisted_count,
      quality_gate_decision_unavailable_count: outputRows.filter(row => row.current_quality_gate_decision === 'NOT_PERSISTED_IN_OUTPUT_SIDE_ASSET').length,
      quality_gate_telemetry_note: 'The output-side asset has no per-case quality_gate_decision; Fixed-48 rows are not safely joinable by canonical requirement ID.'
    },
    source_side: {
      frozen_asset: relative(INPUTS.sourceBlind),
      case_count: sourceCount,
      manifest: relative(OUTPUTS.sourceManifest),
      packet_status: sourceCount === 72 ? 'FROZEN_BLIND_INPUT' : 'INVALID_COUNT',
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      alignment_status: 'DEFERRED_UNTIL_EXPECTED_REQUIREMENTS_ARE_FROZEN'
    },
    zero_candidate_special_review: {
      decision_reference_cases: ['FIXED48-20', 'FIXED48-26', 'FIXED48-41'],
      cases: zeroCandidates,
      count: zeroCandidates.length,
      decision_reference_matches_artifact: zeroCandidates.map(row => row.case_id).join('|') === 'FIXED48-20|FIXED48-26|FIXED48-41',
      discrepancy_note: 'The frozen runtime artifact is authoritative for counts; the Decision reference list is retained for audit and is not used to classify cases.',
      semantic_classification: 'PENDING_INDEPENDENT_SOURCE_REVIEW'
    },
    semantic_certification: 'PENDING_INDEPENDENT_ADJUDICATION',
    human_packet: {
      status: 'NOT_YET_SELECTED; SELECT ONLY AFTER INDEPENDENT ADJUDICATION',
      target_max_cases: 30
    },
    readiness: {
      requirement_producer_runtime: 'PASS',
      requirement_engineering_quality: 'PASS',
      requirement_semantic_quality: 'PENDING_INDEPENDENT_ADJUDICATION',
      requirement_performance: 'CONDITIONAL_PROVIDER_IDENTITY',
      requirement_review_burden: 'PENDING_INDEPENDENT_ADJUDICATION',
      requirement_extraction_production_readiness: 'NOT_CERTIFIED',
      requirement_mapping_input_ready: 'NO'
    },
    side_effects_this_task: {
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      production_semantic_changes: 0
    },
    next_authority: 'INDEPENDENT_GPT_ADJUDICATION_THEN_LIMITED_HUMAN_PACKET',
    blockers: [
      '239 output-side cases require independent semantic adjudication before metrics or human triage.',
      '72 source-side windows require blind expected-requirement adjudication before canonical alignment.',
      'Fixed-48 per-case provider identity/truncation/tender telemetry remains a non-blocking evaluation debt.',
      'No semantic Gold promotion or Mapping input activation is authorized by this preparation artifact.'
    ],
    input_asset_hashes: {
      output_side_review_sha256: outputPacket.source_asset_sha256,
      source_side_blind_sha256: sourceManifest.source_packet_sha256,
      fixed48_runtime_sha256: sha256(fs.readFileSync(INPUTS.fixed48Runtime, 'utf8'))
    },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

export function buildArtifacts({ generatedAt = new Date().toISOString() } = {}) {
  const outputRows = readJsonl(INPUTS.outputReview);
  const sourceRows = readJsonl(INPUTS.sourceBlind);
  const canonicalRows = readJson(INPUTS.canonical).requirements || [];
  const fixed48Runtime = readJson(INPUTS.fixed48Runtime);
  const fixed48Certification = readJson(INPUTS.fixed48Certification);
  const outputPacket = buildOutputPacket({ outputRows, canonicalRows, fixed48Runtime });
  const sourceManifest = buildSourceManifest({ sourceRows });
  const checkpoint = buildCheckpoint({ outputPacket, sourceManifest, fixed48Runtime, fixed48Certification, generatedAt });
  return { outputPacket, sourceManifest, checkpoint };
}

export function writeArtifacts({ generatedAt = new Date().toISOString(), overwrite = false } = {}) {
  for (const file of Object.values(OUTPUTS)) {
    if (fs.existsSync(file) && !overwrite) {
      throw new Error(`REFUSE_OVERWRITE_EXISTING_EVAL_ARTIFACT:${relative(file)}`);
    }
  }
  const { outputPacket, sourceManifest, checkpoint } = buildArtifacts({ generatedAt });
  writeJsonl(OUTPUTS.outputPacket, outputPacket.rows);
  writeJson(OUTPUTS.sourceManifest, sourceManifest);
  writeJson(OUTPUTS.checkpoint, checkpoint);
  const markdown = [
    '# V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_PREPARATION_CHECKPOINT',
    '',
    `- FIXED48_RUNTIME_GATE: ${checkpoint.fixed48_runtime_gate}`,
    `- OUTPUT_SIDE_CASES: ${checkpoint.output_side.packet_case_count}`,
    `- SOURCE_SIDE_CASES: ${checkpoint.source_side.case_count}`,
    `- OUTPUT_LABEL_STATUS: ${checkpoint.output_side.label_status}`,
    `- SOURCE_LABEL_STATUS: ${checkpoint.source_side.manifest ? checkpoint.source_side.packet_status : 'NOT_AVAILABLE'}`,
    `- QUALITY_GATE_DECISION_PERSISTED: ${checkpoint.output_side.quality_gate_decision_persisted_count}/${checkpoint.output_side.packet_case_count}`,
    `- SEMANTIC_CERTIFICATION: ${checkpoint.semantic_certification}`,
    `- REQUIREMENT_EXTRACTION_PRODUCTION_READINESS: ${checkpoint.readiness.requirement_extraction_production_readiness}`,
    `- REQUIREMENT_MAPPING_INPUT_READY: ${checkpoint.readiness.requirement_mapping_input_ready}`,
    `- PROVIDER_CALLS_THIS_TASK: ${checkpoint.side_effects_this_task.provider_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.side_effects_this_task.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.side_effects_this_task.gold_mutations}`,
    '',
    '## Blockers',
    '',
    ...checkpoint.blockers.map(item => `- ${item}`),
    '',
    'This is an Eval-only preparation artifact. It contains no semantic labels and does not promote Gold or authorize Mapping.'
  ].join('\n');
  fs.writeFileSync(OUTPUTS.checkpointMd, `${markdown}\n`, 'utf8');
  return { outputPacket, sourceManifest, checkpoint, outputs: OUTPUTS };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = writeArtifacts();
  process.stdout.write(`${JSON.stringify({
    checkpoint: result.checkpoint.checkpoint,
    output_side_cases: result.checkpoint.output_side.packet_case_count,
    source_side_cases: result.checkpoint.source_side.case_count,
    provider_calls: result.checkpoint.provider_calls,
    production_db_writes: result.checkpoint.production_db_writes,
    gold_mutations: result.checkpoint.gold_mutations
  }, null, 2)}\n`);
}
