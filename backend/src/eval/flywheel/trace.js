import { randomUUID } from 'node:crypto';
import { hashJson, validateTraceStage } from './contract.js';

export const TRACE_STAGE_ORDER = Object.freeze([
  'Tender Source', 'Section', 'Chunk', 'Provider Input', 'Raw Candidate',
  'Normalization', 'Source Resolution', 'Canonical Requirement'
]);

function stageStatus(value) {
  if (value === null || value === undefined) return 'EVIDENCE_NOT_PERSISTED';
  if (value?.status && ['PRESENT', 'ABSENT', 'NOT_REACHED', 'EVIDENCE_NOT_PERSISTED'].includes(value.status)) return value.status;
  return 'PRESENT';
}

const DETAIL_KEYS = Object.freeze([
  'covered', 'reconstructable', 'source_span_valid', 'source_hash', 'source_refs',
  'source_verified', 'output_truncated', 'schema_valid', 'canonical_requirement_id',
  'canonical_requirement_ids', 'canonical_link_count', 'linked_artifacts',
  'requirement_id', 'project_id', 'project_id_count', 'chunk_number', 'chunk_numbers',
  'chunk_count', 'source_ref', 'source_page_start', 'source_page_end',
  'source_resolution_status', 'failure_code', 'mechanical_link_methods',
  'mechanical_link_method_counts'
]);

function safeDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => DETAIL_KEYS.includes(key)));
}

export function makeTraceStage({ stageType, ordinal, value, artifactRef = null, identity = {}, details = null } = {}) {
  const stage = validateTraceStage({
    stage_id: `stage:${hashJson({ stageType, ordinal, identity }).slice(-20)}`,
    stage_type: stageType,
    ordinal,
    status: stageStatus(value),
    artifact_ref: artifactRef,
    identity,
    details: details ?? safeDetails(value)
  });
  return stage;
}

export function buildTrace({ module, evalRunId, caseId, source = null, expected = null, actual = null, stages = [], observations = [] } = {}) {
  if (!module || !evalRunId || !caseId) throw Object.assign(new Error('Trace module, EvalRun and case ID are required.'), { code: 'INVALID_TRACE_IDENTITY' });
  const normalizedStages = [...stages]
    .map((stage, index) => validateTraceStage({ ...stage, ordinal: Number.isInteger(stage.ordinal) ? stage.ordinal : index }))
    .sort((a, b) => a.ordinal - b.ordinal);
  const ordinals = normalizedStages.map((stage) => stage.ordinal);
  if (new Set(ordinals).size !== ordinals.length) throw Object.assign(new Error('Trace stage ordinals must be unique.'), { code: 'TRACE_STAGE_ORDER_INVALID' });
  return {
    trace_id: `trace:${hashJson({ module, evalRunId, caseId }).slice(-24)}`,
    module,
    eval_run_id: evalRunId,
    case_id: caseId,
    source: source || null,
    expected: expected || null,
    actual: actual || null,
    stages: normalizedStages,
    observations: [...observations],
    evidence_gaps: normalizedStages.filter((stage) => stage.status === 'EVIDENCE_NOT_PERSISTED').map((stage) => ({ stage: stage.stage_type, code: 'EVIDENCE_NOT_PERSISTED' })),
    identity_hash: hashJson({ module, evalRunId, caseId, stages: normalizedStages, source, expected, actual })
  };
}

export function appendTraceStage(trace, stage) {
  const next = buildTrace({
    module: trace.module,
    evalRunId: trace.eval_run_id || trace.evalRunId,
    caseId: trace.case_id || trace.caseId,
    source: trace.source,
    expected: trace.expected,
    actual: trace.actual,
    observations: trace.observations,
    stages: [...trace.stages, stage]
  });
  return next;
}

export function listEvidenceGaps(trace) {
  return (trace?.evidence_gaps || []).map((gap) => ({ ...gap }));
}
