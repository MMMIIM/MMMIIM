import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const RAW_PROVIDER_TEXT_UNAVAILABLE = 'RAW_PROVIDER_TEXT_UNAVAILABLE';

function artifactPath(artifactRoot, runId, suffix) {
  if (typeof artifactRoot !== 'string' || !artifactRoot.trim()) {
    throw Object.assign(new Error('artifactRoot is required.'), { code: 'LIVE_ARTIFACT_ROOT_REQUIRED' });
  }
  if (typeof runId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw Object.assign(new Error('runId is invalid.'), { code: 'LIVE_ARTIFACT_RUN_ID_INVALID' });
  }
  const fileName = suffix === 'run' ? 'run.json' : suffix === 'response' ? 'response.json' : 'evaluation.json';
  return join(artifactRoot, runId, fileName);
}

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonAtomically(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    await rename(temporaryPath, path);
  } catch (error) {
    try { await rename(temporaryPath, `${temporaryPath}.abandoned`); } catch (_cleanupError) { /* best effort */ }
    throw error;
  }
}

const CERTIFIED_CAPTURE_FILES = new Set([
  'certified-live-manifest.json',
  'production-runtime-identity.json',
  'provenance-capture-identity.json',
  'structural-adjudication.json',
  'certification.json',
  'source-capture.json',
  'adjudication.json',
  'unmatched-candidates.json',
  'metrics.json'
]);

function certifiedRunDirectory(artifactRoot, sourceCaptureRunId) {
  if (typeof artifactRoot !== 'string' || !artifactRoot.trim()) {
    throw Object.assign(new Error('artifactRoot is required.'), { code: 'CERTIFIED_CAPTURE_ROOT_REQUIRED' });
  }
  if (typeof sourceCaptureRunId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(sourceCaptureRunId)) {
    throw Object.assign(new Error('sourceCaptureRunId is invalid.'), { code: 'CERTIFIED_CAPTURE_RUN_ID_INVALID' });
  }
  return join(artifactRoot, sourceCaptureRunId);
}

function assertSafeCertifiedValue(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeCertifiedValue(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:api[_-]?key|authorization|bearer|secret|password|private[_-]?key)$/iu.test(key)) {
      throw Object.assign(new Error(`Sensitive field is not allowed in certified artifact: ${path}.${key}`), {
        code: 'CERTIFIED_CAPTURE_SECRET_FIELD'
      });
    }
    assertSafeCertifiedValue(child, `${path}.${key}`);
  }
}

function certifiedFilePath({ artifactRoot, sourceCaptureRunId, fileName }) {
  const directory = certifiedRunDirectory(artifactRoot, sourceCaptureRunId);
  if (typeof fileName !== 'string' || !CERTIFIED_CAPTURE_FILES.has(fileName)) {
    throw Object.assign(new Error('Certified artifact file name is not allowed.'), { code: 'CERTIFIED_CAPTURE_FILE_INVALID' });
  }
  return join(directory, fileName);
}

function certifiedRequestPath({ artifactRoot, sourceCaptureRunId, tenderId, chunkNumber, kind }) {
  const directory = certifiedRunDirectory(artifactRoot, sourceCaptureRunId);
  if (typeof tenderId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(tenderId)) {
    throw Object.assign(new Error('tenderId is invalid.'), { code: 'CERTIFIED_CAPTURE_TENDER_ID_INVALID' });
  }
  if (!Number.isInteger(chunkNumber) || chunkNumber < 1) {
    throw Object.assign(new Error('chunkNumber is invalid.'), { code: 'CERTIFIED_CAPTURE_CHUNK_NUMBER_INVALID' });
  }
  if (kind !== 'requests' && kind !== 'responses') throw new Error('Certified artifact kind is invalid.');
  return join(directory, kind, tenderId, `chunk-${String(chunkNumber).padStart(3, '0')}.json`);
}

export async function beginCertifiedCaptureArtifact({ artifactRoot, sourceCaptureRunId, manifest } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw Object.assign(new Error('Certified capture manifest must be an object.'), { code: 'CERTIFIED_CAPTURE_MANIFEST_INVALID' });
  }
  if (manifest.source_capture_run_id !== sourceCaptureRunId) {
    throw Object.assign(new Error('Certified capture manifest run identity does not match.'), { code: 'CERTIFIED_CAPTURE_RUN_ID_MISMATCH' });
  }
  assertSafeCertifiedValue(manifest);
  const path = certifiedFilePath({ artifactRoot, sourceCaptureRunId, fileName: 'certified-live-manifest.json' });
  const existing = await readJsonIfPresent(path);
  if (existing) {
    throw Object.assign(new Error('Certified capture manifest already exists; run identity must be unique.'), { code: 'CERTIFIED_CAPTURE_ALREADY_EXISTS' });
  }
  await writeJsonAtomically(path, manifest);
  return path;
}

export async function persistCertifiedArtifactFile({ artifactRoot, sourceCaptureRunId, fileName, value } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Certified artifact must be an object.'), { code: 'CERTIFIED_CAPTURE_ARTIFACT_INVALID' });
  }
  assertSafeCertifiedValue(value);
  const path = certifiedFilePath({ artifactRoot, sourceCaptureRunId, fileName });
  await writeJsonAtomically(path, value);
  return path;
}

export async function persistCertifiedRequestArtifact({ artifactRoot, sourceCaptureRunId, tenderId, chunkNumber, request } = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw Object.assign(new Error('Certified request artifact must be an object.'), { code: 'CERTIFIED_CAPTURE_REQUEST_INVALID' });
  }
  if (request.tender_id !== tenderId || request.chunk_number !== chunkNumber) {
    throw Object.assign(new Error('Certified request identity does not match path.'), { code: 'CERTIFIED_CAPTURE_REQUEST_ID_MISMATCH' });
  }
  assertSafeCertifiedValue(request);
  const path = certifiedRequestPath({ artifactRoot, sourceCaptureRunId, tenderId, chunkNumber, kind: 'requests' });
  await writeJsonAtomically(path, request);
  return path;
}

export async function persistCertifiedResponseArtifact({ artifactRoot, sourceCaptureRunId, tenderId, chunkNumber, response } = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw Object.assign(new Error('Certified response artifact must be an object.'), { code: 'CERTIFIED_CAPTURE_RESPONSE_INVALID' });
  }
  if (response.tender_id !== tenderId || response.chunk_number !== chunkNumber) {
    throw Object.assign(new Error('Certified response identity does not match path.'), { code: 'CERTIFIED_CAPTURE_RESPONSE_ID_MISMATCH' });
  }
  assertSafeCertifiedValue(response);
  const path = certifiedRequestPath({ artifactRoot, sourceCaptureRunId, tenderId, chunkNumber, kind: 'responses' });
  await writeJsonAtomically(path, response);
  return path;
}

export async function beginLiveRunArtifact({ artifactRoot, runId } = {}) {
  const runPath = artifactPath(artifactRoot, runId, 'run');
  const responsePath = artifactPath(artifactRoot, runId, 'response');
  const [existingRun, existingResponse] = await Promise.all([
    readJsonIfPresent(runPath),
    readJsonIfPresent(responsePath)
  ]);
  if (Number(existingRun?.provider_calls) > 0 || Number(existingResponse?.provider_calls) > 0) {
    throw Object.assign(new Error('A live run with a Provider call already exists; retry is forbidden.'), {
      code: 'LIVE_RUN_ALREADY_HAS_PROVIDER_CALLS'
    });
  }
  const value = { run_id: runId, status: 'started', provider_calls: 0 };
  await writeJsonAtomically(runPath, value);
  return value;
}

export async function markLiveProviderCallStarted({ artifactRoot, runId } = {}) {
  const runPath = artifactPath(artifactRoot, runId, 'run');
  const current = await readJsonIfPresent(runPath);
  if (!current || current.run_id !== runId) {
    throw Object.assign(new Error('Live run artifact is missing.'), { code: 'LIVE_RUN_ARTIFACT_MISSING' });
  }
  if (Number(current.provider_calls) > 0) {
    throw Object.assign(new Error('Provider call already recorded; retry is forbidden.'), {
      code: 'LIVE_RUN_ALREADY_HAS_PROVIDER_CALLS'
    });
  }
  const value = { ...current, status: 'provider_call_started', provider_calls: 1 };
  await writeJsonAtomically(runPath, value);
  return value;
}

export async function persistLiveResponseArtifact({ artifactRoot, runId, response } = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw Object.assign(new Error('Live response artifact must be an object.'), { code: 'LIVE_RESPONSE_ARTIFACT_INVALID' });
  }
  if (response.run_id !== runId) {
    throw Object.assign(new Error('Live response run_id does not match.'), { code: 'LIVE_RESPONSE_RUN_ID_MISMATCH' });
  }
  const responsePath = artifactPath(artifactRoot, runId, 'response');
  await writeJsonAtomically(responsePath, response);
  return response;
}

export async function readLiveResponseArtifact({ artifactRoot, runId } = {}) {
  const responsePath = artifactPath(artifactRoot, runId, 'response');
  const response = await readJsonIfPresent(responsePath);
  if (!response) {
    throw Object.assign(new Error('Live response artifact is unavailable.'), { code: 'LIVE_RESPONSE_ARTIFACT_MISSING' });
  }
  if (response.run_id !== runId) {
    throw Object.assign(new Error('Live response run_id does not match.'), { code: 'LIVE_RESPONSE_RUN_ID_MISMATCH' });
  }
  return response;
}

export async function persistLiveEvaluationArtifact({ artifactRoot, runId, evaluation } = {}) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    throw Object.assign(new Error('Live evaluation artifact must be an object.'), { code: 'LIVE_EVALUATION_ARTIFACT_INVALID' });
  }
  if (evaluation.run_id !== runId) {
    throw Object.assign(new Error('Live evaluation run_id does not match.'), { code: 'LIVE_EVALUATION_RUN_ID_MISMATCH' });
  }
  const evaluationPath = artifactPath(artifactRoot, runId, 'evaluation');
  await writeJsonAtomically(evaluationPath, evaluation);
  return evaluation;
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function candidateId(tenderId, index) {
  return `${String(tenderId)}-C${String(index + 1).padStart(3, '0')}`;
}

function rangeOf(candidate) {
  return {
    start_ref: candidate?.source_range?.start_ref ?? null,
    end_ref: candidate?.source_range?.end_ref ?? null
  };
}

export function buildChunkArtifact({ tenderId, chunk } = {}) {
  const segments = Array.isArray(chunk?.segments) ? chunk.segments : [];
  const tableUnits = Array.isArray(chunk?.table_units) ? chunk.table_units : [];
  return {
    tender_id: String(tenderId ?? ''),
    chunk_id: String(chunk?.id ?? chunk?.chunk_id ?? `chunk-${chunk?.chunk_number ?? ''}`),
    chunk_number: Number.isInteger(chunk?.chunk_number) ? chunk.chunk_number : null,
    provider_ready_input_text: typeof chunk?.model_text === 'string' ? chunk.model_text : String(chunk?.text ?? ''),
    source_refs: segments.map((segment) => segment.source_ref ?? segment.span_id ?? null),
    table_semantic_presentation: tableUnits.length ? clone(tableUnits) : []
  };
}

export function buildCandidateArtifact({ tenderId, candidateIndex, candidate } = {}) {
  return {
    candidate_id: candidateId(tenderId, candidateIndex),
    text: candidate?.text,
    category: candidate?.category,
    source_range: rangeOf(candidate),
    mandatory_observed: candidate?.mandatory_observed,
    requires_confirmation: candidate?.requires_confirmation
  };
}

export function assignCandidateIds(tenderId, candidates = []) {
  return (Array.isArray(candidates) ? candidates : []).map((candidate, index) => (
    buildCandidateArtifact({ tenderId, candidateIndex: index, candidate })
  ));
}

function candidateById(candidates) {
  return new Map((Array.isArray(candidates) ? candidates : []).map((candidate) => [candidate.candidate_id, candidate]));
}

export function buildMappingEvidence({
  goldItems = [],
  candidates = [],
  automaticMatches = [],
  falsePositiveIds = [],
  wrongMerges = []
} = {}) {
  const byId = candidateById(candidates);
  const matchByGold = new Map((Array.isArray(automaticMatches) ? automaticMatches : [])
    .map((match) => [match.gold_id, match]));
  const goldMappings = (Array.isArray(goldItems) ? goldItems : []).map((gold) => {
    const match = matchByGold.get(gold.gold_id) || {};
    return {
      gold_id: gold.gold_id,
      gold_text: gold.text,
      gold_source_range: clone(gold.source_range),
      mandatory: gold.mandatory_observed ?? gold.mandatory ?? false,
      candidate_ids: Array.isArray(match.candidate_ids) ? [...match.candidate_ids] : [],
      automatic_verdict: match.verdict ?? 'UNMATCHED',
      automatic_reason: match.reason ?? null,
      automatic_overlap_evidence: clone(match.matcher_evidence ?? match.overlap ?? null)
    };
  });
  const falsePositiveCandidates = (Array.isArray(falsePositiveIds) ? falsePositiveIds : [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((candidate) => ({
      candidate_id: candidate.candidate_id,
      text: candidate.text,
      source_range: clone(candidate.source_range),
      category: candidate.category,
      mandatory_observed: candidate.mandatory_observed,
      requires_confirmation: candidate.requires_confirmation,
      reason: 'FALSE_POSITIVE'
    }));
  const wrongMergeCandidates = (Array.isArray(wrongMerges) ? wrongMerges : [])
    .map((merge) => {
      const candidate = byId.get(merge.candidate_id);
      if (!candidate) return null;
      return {
        candidate_id: candidate.candidate_id,
        text: candidate.text,
        source_range: clone(candidate.source_range),
        category: candidate.category,
        mandatory_observed: candidate.mandatory_observed,
        requires_confirmation: candidate.requires_confirmation,
        gold_ids: Array.isArray(merge.gold_ids) ? [...merge.gold_ids] : []
      };
    })
    .filter(Boolean);
  return { gold_mappings: goldMappings, false_positive_candidates: falsePositiveCandidates, wrong_merge_candidates: wrongMergeCandidates };
}

function rawProviderText({ diagnostics, error } = {}) {
  const value = diagnostics?.raw_provider_text
    ?? diagnostics?.raw_response_payload_json
    ?? error?.audit?.raw_provider_text
    ?? error?.audit?.raw_response_payload_json;
  return typeof value === 'string' && value.length ? value : RAW_PROVIDER_TEXT_UNAVAILABLE;
}

export function buildFailedChunkArtifact({ tenderId, chunk, diagnostics = null, error = null } = {}) {
  return {
    ...buildChunkArtifact({ tenderId, chunk }),
    provider_http_status: Number.isInteger(diagnostics?.provider_http_status)
      ? diagnostics.provider_http_status : Number.isInteger(error?.audit?.http_status) ? error.audit.http_status : null,
    finish_reason: typeof diagnostics?.finish_reason === 'string' ? diagnostics.finish_reason : null,
    completion_tokens: Number.isInteger(diagnostics?.completion_tokens) ? diagnostics.completion_tokens : null,
    output_truncated: diagnostics?.output_truncated === true,
    schema_pass: false,
    parse_pass: false,
    schema_error: error?.message ?? null,
    raw_provider_text: rawProviderText({ diagnostics, error })
  };
}

export function buildSuccessfulChunkArtifact({ tenderId, chunk, diagnostics = null, candidates = [] } = {}) {
  return {
    ...buildChunkArtifact({ tenderId, chunk }),
    provider_http_status: Number.isInteger(diagnostics?.provider_http_status) ? diagnostics.provider_http_status : null,
    finish_reason: typeof diagnostics?.finish_reason === 'string' ? diagnostics.finish_reason : null,
    completion_tokens: Number.isInteger(diagnostics?.completion_tokens) ? diagnostics.completion_tokens : null,
    output_truncated: diagnostics?.output_truncated === true,
    schema_pass: true,
    parse_pass: true,
    candidates: clone(candidates)
  };
}
