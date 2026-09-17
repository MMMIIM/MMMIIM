import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  buildAnnotatedPath,
  adjudicationItems,
  evaluateTender
} from './run-live-eval.js';
import {
  buildStableProvenanceIndex,
  resolveStableRange
} from './evaluation-matching.js';
import {
  EVALUATION_CONTRACT_VERSION,
  EVALUATOR_REVISION,
  certifyEvaluation,
  validateEvaluationArtifactIdentity
} from './evaluation-certification.js';

const here = dirname(fileURLToPath(import.meta.url));
const reportDirectory = resolve(here, '../reports');
const sourceReportPath = resolve(reportDirectory, 'reqx-v3-real-tender-eval-capture-v2.json');
const outputPath = resolve(reportDirectory, 'reqx-v311-stable-provenance-adjudication-199.json');
const metricsPath = resolve(reportDirectory, 'reqx-v311-stable-provenance-metrics-v1.json');
const packetDirectory = resolve(here, 'semantic-boundary-v1.1', 'packets');
const tenderIds = ['FAST-01', 'FAST-WATER-01', 'TB-006'];
const expectedGoldCounts = { 'FAST-01': 39, 'FAST-WATER-01': 114, 'TB-006': 46 };
const expectedGoldCount = Object.values(expectedGoldCounts).reduce((sum, count) => sum + count, 0);
const defaultEvaluationRunId = `reqx-v311-stable-provenance-${EVALUATOR_REVISION.slice(-12)}`;

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function sourceExcerpt(prepared, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;
  const spans = prepared.chunks.flatMap((chunk) => chunk.segments);
  return spans.slice(start, end + 1).map((span) => span.text).join('\n');
}

function coverageOf(verdict) {
  if (verdict === 'EXACT_RANGE' || verdict === 'EXACT_RANGE_DUPLICATE' || verdict === 'CONTIGUOUS_COVERAGE') return 'FULL';
  if (verdict === 'PARTIAL_OVERLAP') return 'PARTIAL';
  return 'MISS';
}

function groupingHint(verdict, candidateIds) {
  if (!candidateIds.length) return null;
  if (verdict === 'CONTIGUOUS_COVERAGE' && candidateIds.length > 1) return 'ACCEPTABLE_GROUP_CANDIDATE';
  if (candidateIds.length === 1) return 'ATOMIC_CANDIDATE';
  return 'GROUPING_REVIEW_REQUIRED';
}

function currentCandidateEvidence({ candidates, currentIndex, prepared } = {}) {
  return candidates.map((candidate) => {
    const range = resolveStableRange(candidate.source_range, currentIndex);
    return {
      candidate_id: candidate.candidate_id,
      text: candidate.text,
      category: candidate.category,
      mandatory_observed: candidate.mandatory_observed,
      requires_confirmation: candidate.requires_confirmation,
      source_range: clone(candidate.source_range),
      source_verified: candidate.source_verified === true,
      current_resolved_range: range ? {
        start_ref: prepared.chunks.flatMap((chunk) => chunk.segments)[range.start_position]?.source_ref || null,
        end_ref: prepared.chunks.flatMap((chunk) => chunk.segments)[range.end_position]?.source_ref || null
      } : null,
      source_excerpt: range ? sourceExcerpt(prepared, range.start_position, range.end_position) : null
    };
  });
}

function buildRemappedItem({ packet, prepared, metric, baseItem, currentIndex, historicalIndex } = {}) {
  const projected = metric._gold.find((item) => item.gold_id === baseItem.gold_id);
  const goldDefinition = packet.gold_requirements.find((item) => item.gold_id === baseItem.gold_id) || {};
  const automatic = metric.automatic_matches.find((item) => item.gold_id === baseItem.gold_id)
    || { candidate_ids: [], verdict: 'UNMATCHED', reason: 'no candidate source range overlap', matcher_evidence: null };
  const candidateById = new Map(metric._candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const candidates = (automatic.candidate_ids || []).map((id) => candidateById.get(id)).filter(Boolean);
  const historicalRange = resolveStableRange(goldDefinition.source_range, historicalIndex);
  const currentResolved = projected?.start_ref && projected?.end_ref && Number.isInteger(projected.start) && Number.isInteger(projected.end)
    ? {
      start_ref: projected.start_ref,
      end_ref: projected.end_ref,
      start_key: projected.start_key,
      end_key: projected.end_key,
      start_position: projected.start,
      end_position: projected.end
    }
    : null;
  const coverage = coverageOf(automatic.verdict);
  const candidateEvidence = currentCandidateEvidence({ candidates, currentIndex, prepared });
  return {
    tender_id: packet.tender_id,
    gold_id: baseItem.gold_id,
    gold_text: goldDefinition.text,
    category: goldDefinition.category,
    mandatory_observed: goldDefinition.mandatory_observed,
    requires_confirmation: goldDefinition.requires_confirmation,
    historical_gold_range: clone(goldDefinition.source_range),
    stable_provenance: {
      historical_start_key: historicalRange?.start_key || null,
      historical_end_key: historicalRange?.end_key || null,
      current_source_resolved: Boolean(currentResolved),
      remap_status: currentResolved ? 'RESOLVED' : 'PROVENANCE_REMAP_UNRESOLVED'
    },
    current_resolved_range: currentResolved,
    current_source_excerpt: currentResolved ? sourceExcerpt(prepared, currentResolved.start_position, currentResolved.end_position) : null,
    provider_chunks: clone(baseItem.provider_chunks || []),
    candidate_matches: candidateEvidence,
    coverage,
    coverage_basis: 'SOURCE_RANGE_OVERLAP_ONLY',
    meaning_completeness: 'PENDING_SEMANTIC_ADJUDICATION',
    material_omission: null,
    critical_material_omission: null,
    criticality: 'PENDING_SEMANTIC_ADJUDICATION',
    grouping: 'PENDING_SEMANTIC_ADJUDICATION',
    structural_grouping_hint: groupingHint(automatic.verdict, automatic.candidate_ids || []),
    automatic_verdict: automatic.verdict,
    automatic_reason: automatic.reason || null,
    matcher_evidence: clone(automatic.matcher_evidence || null),
    failure_layer: coverage === 'MISS'
      ? (currentResolved ? 'MODEL' : 'EVAL')
      : coverage === 'PARTIAL' ? 'SEMANTIC_ADJUDICATION_REQUIRED' : null,
    adjudication: null,
    notes: null
  };
}

async function loadPackets() {
  const packets = [];
  for (const tenderId of tenderIds) {
    const packet = JSON.parse(await readFile(resolve(packetDirectory, `${tenderId}.json`), 'utf8'));
    if (packet.gold_requirements.length !== expectedGoldCounts[tenderId]) throw new Error(`${tenderId}: Gold count mismatch`);
    packets.push(packet);
  }
  return packets;
}

export async function runStableProvenanceRemap({
  sourcePath = sourceReportPath,
  adjudicationOutputPath = outputPath,
  metricsOutputPath = metricsPath,
  evaluationRunId = defaultEvaluationRunId
} = {}) {
  const sourceReport = JSON.parse(await readFile(sourcePath, 'utf8'));
  if (sourceReport.capture_status !== 'FULL_CANDIDATE_TEXT_CAPTURE') throw new Error('FINAL_CAPTURE_NOT_FULL_TEXT');
  const sourceCaptureRunId = sourceReport.source_capture_run_id || sourceReport.run_id || null;
  if (!sourceCaptureRunId) throw new Error('SOURCE_CAPTURE_RUN_ID_REQUIRED');
  const packets = await loadPackets();
  const env = loadBackendEnvironment();
  const items = [];
  const tenderMetrics = [];
  for (const packet of packets) {
    const prepared = await buildAnnotatedPath(packet, env);
    const sourceRun = sourceReport.runs.find((run) => run.tender_id === packet.tender_id);
    if (!sourceRun) throw new Error(`${packet.tender_id}: final capture run missing`);
    const run = {
      tender_id: packet.tender_id,
      candidates: sourceRun.candidates,
      _candidate_records: sourceRun.candidates
    };
    const metric = evaluateTender(packet, run, prepared);
    const historicalIndex = buildStableProvenanceIndex(packet.windows.flatMap((window) => window.spans));
    const currentIndex = buildStableProvenanceIndex(prepared.chunks.flatMap((chunk) => chunk.segments));
    const baseItems = adjudicationItems(packet, metric, prepared);
    const remapped = baseItems.map((item) => buildRemappedItem({
      packet,
      prepared,
      metric,
      baseItem: item,
      currentIndex,
      historicalIndex
    }));
    items.push(...remapped);
    const full = remapped.filter((item) => item.coverage === 'FULL').length;
    const partial = remapped.filter((item) => item.coverage === 'PARTIAL').length;
    const miss = remapped.filter((item) => item.coverage === 'MISS').length;
    const remapResolved = remapped.filter((item) => item.stable_provenance.remap_status === 'RESOLVED').length;
    const overlaps = remapped.filter((item) => item.candidate_matches.length > 0).length;
    const duplicateCount = Math.round(metric.duplicate_rate * metric.extracted_count);
    const sourceSpans = prepared.chunks.flatMap((chunk) => chunk.segments);
    const excludedRoles = new Set(['SCORING', 'QUALIFICATION', 'COMMERCIAL', 'PROCUREMENT', 'LEGAL']);
    const scopeLeakage = metric._candidates.filter((candidate) => (
      candidate.source_range_valid
      && sourceSpans.slice(candidate.start, candidate.end + 1).length > 0
      && sourceSpans.slice(candidate.start, candidate.end + 1).every((span) => excludedRoles.has(span.routing_role))
    )).length;
    tenderMetrics.push({
      tender_id: packet.tender_id,
      gold_count: remapped.length,
      stable_provenance_resolved: remapResolved,
      stable_provenance_unresolved: remapped.length - remapResolved,
      current_source_resolved: remapResolved,
      candidate_source_overlap: overlaps,
      no_candidate_source_overlap: remapped.length - overlaps,
      full,
      partial,
      miss,
      structural_coverage: (full + partial) / remapped.length,
      semantic_adjudication: 'PENDING',
      automatic_duplicate_count: duplicateCount,
      automatic_wrong_merge_count: metric.wrong_merge_count,
      automatic_false_positive_count: Math.max(0, metric.fp - duplicateCount),
      scope_leakage_count: scopeLeakage
    });
  }
  const coverage = {
    full: items.filter((item) => item.coverage === 'FULL').length,
    partial: items.filter((item) => item.coverage === 'PARTIAL').length,
    miss: items.filter((item) => item.coverage === 'MISS').length
  };
  const stableResolved = items.filter((item) => item.stable_provenance.remap_status === 'RESOLVED').length;
  const candidateOverlap = items.filter((item) => item.candidate_matches.length > 0).length;
  const metrics = {
    report_schema: 'reqx-v311-stable-provenance-metrics-v1',
    source_capture: sourcePath.split(/[\\/]/).at(-1),
    source_capture_run_id: sourceCaptureRunId,
    evaluation_run_id: evaluationRunId,
    dataset_version: sourceReport.dataset_version,
    prompt_contract: sourceReport.prompt_contract || null,
    prompt_instruction_hash: sourceReport.prompt_instruction_hash || null,
    candidate_contract: sourceReport.candidate_contract || null,
    candidate_schema_hash: sourceReport.candidate_schema_hash || null,
    model: sourceReport.model || null,
    production_runtime_identity: sourceReport.production_runtime_identity || null,
    provenance_capture_identity: sourceReport.provenance_capture_identity || null,
    evaluation_contract_version: EVALUATION_CONTRACT_VERSION,
    evaluator_revision: EVALUATOR_REVISION,
    gold_count: expectedGoldCount,
    final_candidate_count: sourceReport.runs.reduce((sum, run) => sum + run.candidates.length, 0),
    provider_request_count: sourceReport.provider_request_count,
    stable_provenance: {
      resolved: stableResolved,
      unresolved: expectedGoldCount - stableResolved,
      current_source_resolved: stableResolved,
      candidate_source_overlap: candidateOverlap,
      no_candidate_source_overlap: expectedGoldCount - candidateOverlap,
      unresolved_code: 'PROVENANCE_REMAP_UNRESOLVED'
    },
    coverage,
    coverage_basis: 'SOURCE_RANGE_OVERLAP_ONLY',
    structural_coverage: (coverage.full + coverage.partial) / expectedGoldCount,
    semantic_adjudication_status: 'PENDING_SEMANTIC_ADJUDICATION',
    meaning_completeness: null,
    mandatory: {
      total: items.filter((item) => item.mandatory_observed === true).length,
      structural_miss: items.filter((item) => item.mandatory_observed === true && item.coverage === 'MISS').length,
      mandatory_critical_miss: null
    },
    grouping: {
      harmful_merge: null,
      critical_harmful_merge: null
    },
    leakage: {
      false_positive_candidates: tenderMetrics.reduce((sum, item) => sum + item.automatic_false_positive_count, 0),
      scope_leakage: tenderMetrics.reduce((sum, item) => sum + item.scope_leakage_count, 0),
      duplicate_candidates: tenderMetrics.reduce((sum, item) => sum + item.automatic_duplicate_count, 0)
    },
    tender_metrics: tenderMetrics
  };
  const adjudication = {
    packet_schema: 'reqx-v311-stable-provenance-adjudication-199-v1',
    source_capture_run_id: sourceCaptureRunId,
    evaluation_run_id: evaluationRunId,
    dataset_version: sourceReport.dataset_version,
    source_capture: sourcePath.split(/[\\/]/).at(-1),
    prompt_contract: metrics.prompt_contract,
    prompt_instruction_hash: metrics.prompt_instruction_hash,
    candidate_contract: metrics.candidate_contract,
    candidate_schema_hash: metrics.candidate_schema_hash,
    model: metrics.model,
    production_runtime_identity: metrics.production_runtime_identity,
    provenance_capture_identity: metrics.provenance_capture_identity,
    evaluation_contract_version: EVALUATION_CONTRACT_VERSION,
    evaluator_revision: EVALUATOR_REVISION,
    gold_count: items.length,
    final_candidate_count: metrics.final_candidate_count,
    provider_request_count: sourceReport.provider_request_count,
    stable_provenance_unresolved: metrics.stable_provenance.unresolved,
    items
  };
  const identityCheck = validateEvaluationArtifactIdentity({
    capture: {
      source_capture_run_id: sourceCaptureRunId,
      dataset_version: sourceReport.dataset_version,
      prompt_contract: metrics.prompt_contract,
      prompt_instruction_hash: metrics.prompt_instruction_hash,
      candidate_contract: metrics.candidate_contract,
      candidate_schema_hash: metrics.candidate_schema_hash,
      model: metrics.model,
      production_runtime_identity: metrics.production_runtime_identity,
      provenance_capture_identity: metrics.provenance_capture_identity
    },
    gold: { dataset_version: sourceReport.dataset_version },
    adjudication,
    metrics
  });
  const certification = certifyEvaluation({
    identity: identityCheck,
    stableProvenanceResolved: metrics.stable_provenance.unresolved === 0,
    structuralAdjudicationComplete: items.length === expectedGoldCount,
    goldCount: expectedGoldCount,
    semanticAdjudicationComplete: false
  });
  metrics.identity_validation = identityCheck;
  metrics.certification = certification;
  metrics.provisional_metrics = {
    coverage,
    structural_coverage: metrics.structural_coverage,
    certification_status: certification.certification_status,
    freeze_valid: certification.freeze_valid,
    metric_semantics: certification.metric_semantics
  };
  adjudication.identity_validation = identityCheck;
  adjudication.certification = certification;
  if (items.length !== expectedGoldCount) throw new Error('ADJUDICATION_GOLD_COUNT_MISMATCH');
  if (!Number.isInteger(metrics.final_candidate_count) || metrics.final_candidate_count <= 0) throw new Error('FINAL_CAPTURE_CANDIDATE_COUNT_MISMATCH');
  await mkdir(dirname(adjudicationOutputPath), { recursive: true });
  await writeFile(adjudicationOutputPath, `${JSON.stringify(adjudication, null, 2)}\n`, 'utf8');
  await writeFile(metricsOutputPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
  return { adjudication, metrics };
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entrypoint && import.meta.url === entrypoint) {
  runStableProvenanceRemap().then(({ metrics }) => console.log(JSON.stringify({
    status: metrics.certification?.certification_status || 'PROVISIONAL_NOT_CERTIFIED',
    source_capture: metrics.source_capture,
    source_capture_run_id: metrics.source_capture_run_id,
    evaluation_run_id: metrics.evaluation_run_id,
    gold_count: metrics.gold_count,
    final_candidate_count: metrics.final_candidate_count,
    provider_request_count: metrics.provider_request_count,
    stable_provenance: metrics.stable_provenance,
    coverage: metrics.coverage,
    semantic_adjudication_status: metrics.semantic_adjudication_status,
    freeze_valid: metrics.certification?.freeze_valid === true,
    metric_semantics: metrics.certification?.metric_semantics || 'SOURCE_RANGE_STRUCTURAL_ONLY'
  }, null, 2))).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
