import { hashJson } from './contract.js';

const CHECKS = Object.freeze([
  'SECTION_COVERAGE', 'CHUNK_SOURCE_SPAN_VALID', 'SOURCE_SPAN_RECONSTRUCTABLE',
  'SOURCE_HASH_MATCH', 'SCHEMA_VALID', 'OUTPUT_TRUNCATION',
  'SOURCE_RESOLUTION_PRESENT', 'SOURCE_VERIFIED_FLAG', 'DUPLICATE_CANONICAL_ID',
  'MISSING_SOURCE_REFS', 'CROSS_PROJECT_CONTAMINATION'
]);
const RISK_SIGNALS = Object.freeze([
  'NEGATION_TOKEN_CHANGED', 'NUMERIC_TOKEN_CHANGED', 'TABLE_INDEX_TOKEN_RISK', 'SOURCE_CANONICAL_LOW_LEXICAL_ALIGNMENT'
]);

function stage(trace, name) { return trace?.stages?.find((item) => item.stage_type === name) || null; }
function noMechanicalLink(value) { return value?.status === 'ABSENT' && value?.details?.failure_code === 'NO_MECHANICAL_LINK_FOUND'; }
function observation(checkId, result, details = {}, evidenceRefs = []) {
  return {
    observation_id: `observation:${hashJson({ checkId, result, details }).slice(-24)}`,
    evaluator_id: 'v43-flywheel-deterministic-v1',
    check_id: checkId,
    result,
    severity: result === 'FAIL' ? 'HIGH' : result === 'REVIEW_REQUIRED' ? 'MEDIUM' : 'INFO',
    mechanical_first_divergence: null,
    risk_signals: [],
    evidence_refs: evidenceRefs,
    details
  };
}

function numericTokens(value) { return String(value || '').match(/\d+(?:\.\d+)?(?:\s*[A-Za-z%％]+)?/g) || []; }
function negationTokens(value) { return String(value || '').match(/不|无|未|禁止|不得|不能|仅限|排除|否/g) || []; }

export function findFirstMechanicalDivergence(trace) {
  const ordered = [...(trace?.stages || [])].sort((a, b) => a.ordinal - b.ordinal);
  const first = ordered.find((item) => item.status !== 'PRESENT');
  return first ? { stage: first.stage_type, reason: first.status } : null;
}

export function evaluateRiskSignals(trace) {
  const source = trace?.source?.text || trace?.source?.excerpt || '';
  const actual = trace?.actual?.text || trace?.actual?.requirement_text || '';
  const signals = [];
  if (source && actual && JSON.stringify(negationTokens(source)) !== JSON.stringify(negationTokens(actual))) signals.push({ signal: 'NEGATION_TOKEN_CHANGED', result: 'REVIEW_REQUIRED' });
  if (source && actual && JSON.stringify(numericTokens(source)) !== JSON.stringify(numericTokens(actual))) signals.push({ signal: 'NUMERIC_TOKEN_CHANGED', result: 'REVIEW_REQUIRED' });
  if (/[（(]?\d+[）)]?/.test(String(actual)) && /表|序号|ODBC|JDBC|单位|列|行/.test(String(actual))) signals.push({ signal: 'TABLE_INDEX_TOKEN_RISK', result: 'REVIEW_REQUIRED' });
  if (source && actual && !String(actual).includes(String(source).slice(0, Math.min(12, String(source).length)))) signals.push({ signal: 'SOURCE_CANONICAL_LOW_LEXICAL_ALIGNMENT', result: 'REVIEW_REQUIRED' });
  return signals.filter((item) => RISK_SIGNALS.includes(item.signal));
}

export function runDeterministicEvaluators(trace, context = {}) {
  if (!trace || !Array.isArray(trace.stages)) throw Object.assign(new Error('Trace is required.'), { code: 'INVALID_TRACE_FOR_EVALUATION' });
  const results = [];
  const source = stage(trace, 'Tender Source');
  const section = stage(trace, 'Section');
  const chunk = stage(trace, 'Chunk');
  const providerInput = stage(trace, 'Provider Input');
  const rawCandidate = stage(trace, 'Raw Candidate');
  const normalization = stage(trace, 'Normalization');
  const resolution = stage(trace, 'Source Resolution');
  const canonical = stage(trace, 'Canonical Requirement');
  results.push(observation('SECTION_COVERAGE', section?.details?.covered === false ? 'FAIL' : section ? 'PASS' : 'NOT_EVALUATED', { stage_status: section?.status || 'EVIDENCE_NOT_PERSISTED' }));
  results.push(observation('CHUNK_SOURCE_SPAN_VALID', chunk?.details?.source_span_valid === false ? 'FAIL' : noMechanicalLink(chunk) ? 'NOT_EVALUATED' : chunk?.status === 'PRESENT' ? 'PASS' : 'NOT_EVALUATED', { stage_status: chunk?.status || 'EVIDENCE_NOT_PERSISTED', failure_code: chunk?.details?.failure_code || null }));
  results.push(observation('SOURCE_SPAN_RECONSTRUCTABLE', chunk?.details?.reconstructable === false ? 'FAIL' : noMechanicalLink(chunk) ? 'NOT_EVALUATED' : chunk?.status === 'PRESENT' ? 'PASS' : 'NOT_EVALUATED', { stage_status: chunk?.status || 'EVIDENCE_NOT_PERSISTED', failure_code: chunk?.details?.failure_code || null }));
  const expectedHash = context.source_hash || context.expected_source_hash;
  const actualHash = source?.identity?.source_hash || source?.details?.source_hash;
  results.push(observation('SOURCE_HASH_MATCH', expectedHash ? (actualHash === expectedHash ? 'PASS' : 'FAIL') : 'NOT_EVALUATED', { expected_present: Boolean(expectedHash), actual_present: Boolean(actualHash) }));
  const schemaResult = rawCandidate?.details?.schema_valid ?? normalization?.details?.schema_valid ?? canonical?.details?.schema_valid;
  results.push(observation('SCHEMA_VALID', typeof schemaResult === 'boolean' ? (schemaResult ? 'PASS' : 'FAIL') : rawCandidate ? 'NOT_EVALUATED' : 'NOT_EVALUATED', { observed: schemaResult ?? null }));
  const truncation = providerInput?.details?.output_truncated ?? rawCandidate?.details?.output_truncated;
  results.push(observation('OUTPUT_TRUNCATION', truncation === true ? 'FAIL' : typeof truncation === 'boolean' ? 'PASS' : 'NOT_EVALUATED', { output_truncated: truncation ?? null }));
  results.push(observation('SOURCE_RESOLUTION_PRESENT', resolution?.status === 'PRESENT' ? 'PASS' : noMechanicalLink(resolution) ? 'NOT_EVALUATED' : resolution?.status === 'ABSENT' ? 'FAIL' : 'NOT_EVALUATED', { status: resolution?.status || 'EVIDENCE_NOT_PERSISTED', failure_code: resolution?.details?.failure_code || null }));
  const verified = resolution?.details?.source_verified ?? canonical?.details?.source_verified;
  results.push(observation('SOURCE_VERIFIED_FLAG', noMechanicalLink(resolution) ? 'NOT_EVALUATED' : typeof verified === 'boolean' ? (verified ? 'PASS' : 'FAIL') : 'NOT_EVALUATED', { source_verified: verified ?? null }));
  const canonicalId = canonical?.identity?.canonical_requirement_id || canonical?.details?.canonical_requirement_id;
  const duplicate = context.duplicate_canonical_ids instanceof Set && context.duplicate_canonical_ids.has(canonicalId);
  results.push(observation('DUPLICATE_CANONICAL_ID', duplicate ? 'FAIL' : noMechanicalLink(canonical) ? 'NOT_EVALUATED' : canonicalId ? 'PASS' : 'NOT_EVALUATED', { canonical_requirement_id_present: Boolean(canonicalId) }));
  const refs = resolution?.details?.source_refs || canonical?.details?.source_refs;
  results.push(observation('MISSING_SOURCE_REFS', noMechanicalLink(resolution) ? 'NOT_EVALUATED' : Array.isArray(refs) ? (refs.length ? 'PASS' : 'FAIL') : 'NOT_EVALUATED', { source_ref_count: Array.isArray(refs) ? refs.length : null }));
  const projectIds = [source, section, chunk, providerInput, rawCandidate, normalization, resolution, canonical]
    .map((item) => item?.identity?.project_id || item?.details?.project_id).filter(Boolean);
  const projectSet = new Set(projectIds);
  results.push(observation('CROSS_PROJECT_CONTAMINATION', projectSet.size > 1 ? 'FAIL' : projectIds.length ? 'PASS' : 'NOT_EVALUATED', { project_id_count: projectSet.size }));
  const riskSignals = evaluateRiskSignals(trace);
  const first = findFirstMechanicalDivergence(trace);
  for (const row of results) {
    row.mechanical_first_divergence = first;
    row.risk_signals = riskSignals.map((signal) => signal.signal);
  }
  return results.filter((row) => CHECKS.includes(row.check_id));
}

export { CHECKS, RISK_SIGNALS };
