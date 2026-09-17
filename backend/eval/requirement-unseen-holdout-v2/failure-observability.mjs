import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');

export const HOLDOUT_FAILURE_FAMILIES = Object.freeze([
  'A_TRANSPORT_FAILURE',
  'B_PROVIDER_HTTP_FAILURE',
  'C_PROVIDER_RESPONSE_EMPTY_OR_MALFORMED',
  'D_JSON_PARSE_FAILURE',
  'E_SCHEMA_VALIDATION_FAILURE',
  'F_GATEWAY_ADAPTER_FAILURE',
  'G_RUNNER_ACCOUNTING_ONLY',
  'H_UNRECOVERABLE_MISSING_EVIDENCE'
]);

const stringValue = value => typeof value === 'string' && value.length > 0 ? value : null;

function diagnosticValue(diagnostic, key) {
  return diagnostic && typeof diagnostic === 'object' ? diagnostic[key] : null;
}

/**
 * Classify only the first mechanically evidenced failure.  This is Eval-only
 * accounting metadata; it never changes Requirement semantics or quality-gate
 * decisions.
 */
export function classifyHoldoutFirstFailure({ errorCode = null, diagnostic = null, schemaPass = null, ok = false } = {}) {
  if (ok === true && schemaPass === true) return {
    family: null,
    first_failure_stage: null,
    first_failure_code: null
  };
  const code = stringValue(errorCode)
    || stringValue(diagnosticValue(diagnostic, 'safe_error_code'))
    || stringValue(diagnosticValue(diagnostic, 'gateway_error_code'));
  const providerStatus = Number.isInteger(diagnosticValue(diagnostic, 'provider_http_status'))
    ? diagnosticValue(diagnostic, 'provider_http_status') : null;
  const providerReached = diagnosticValue(diagnostic, 'provider_http_reached') === true
    || Number.isInteger(providerStatus);
  const jsonParsed = diagnosticValue(diagnostic, 'json_parse_success');
  const schemaErrors = Array.isArray(diagnosticValue(diagnostic, 'schema_validation_errors'))
    ? diagnosticValue(diagnostic, 'schema_validation_errors') : [];
  if (!providerReached && ['GATEWAY_NETWORK_ERROR', 'GATEWAY_TIMEOUT', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK'].includes(code)) {
    return { family: 'A_TRANSPORT_FAILURE', first_failure_stage: 'PROVIDER_TRANSPORT', first_failure_code: code };
  }
  if (providerStatus !== null && providerStatus >= 400) {
    return { family: 'B_PROVIDER_HTTP_FAILURE', first_failure_stage: 'PROVIDER_HTTP', first_failure_code: code || `HTTP_${providerStatus}` };
  }
  if (jsonParsed === false || ['GATEWAY_INVALID_JSON', 'GATEWAY_TRUNCATED_JSON', 'PROVIDER_RESPONSE_MALFORMED'].includes(code)) {
    return { family: 'D_JSON_PARSE_FAILURE', first_failure_stage: 'JSON_PARSE', first_failure_code: code || 'JSON_PARSE_FAILURE' };
  }
  if (schemaPass === false || schemaErrors.length > 0 || ['GATEWAY_REQUIREMENTS_INVALID', 'OUTPUT_SCHEMA_INVALID', 'GATEWAY_ENVELOPE_INVALID'].includes(code)) {
    return { family: 'E_SCHEMA_VALIDATION_FAILURE', first_failure_stage: 'SCHEMA_VALIDATION', first_failure_code: code || 'SCHEMA_VALIDATION_FAILURE' };
  }
  if (code) {
    return { family: 'F_GATEWAY_ADAPTER_FAILURE', first_failure_stage: 'GATEWAY_ADAPTER', first_failure_code: code };
  }
  return { family: 'H_UNRECOVERABLE_MISSING_EVIDENCE', first_failure_stage: 'UNKNOWN', first_failure_code: 'NO_SAFE_FAILURE_EVIDENCE' };
}

export function buildHoldoutExecutionIdentity({ tenderId, chunkNumber, sourceChunkId = null, requestHash } = {}) {
  const canonicalRequestHash = stringValue(requestHash) || sha256(`${tenderId || ''}:${chunkNumber || ''}`);
  const executionHash = sha256(JSON.stringify({ tender_id: tenderId || null, chunk_number: chunkNumber ?? null, source_chunk_id: sourceChunkId || null, request_hash: canonicalRequestHash }));
  return {
    execution_id: `holdout-v2-exec-${executionHash.slice(0, 24)}`,
    request_hash: canonicalRequestHash,
    tender_id: tenderId || null,
    chunk_number: Number.isInteger(chunkNumber) ? chunkNumber : null,
    source_chunk_id: sourceChunkId || null
  };
}

export function summarizeHoldoutExecutionAccounting(results = [], { plannedExecutionCount = null, retryCount = 0 } = {}) {
  const entries = Array.isArray(results) ? results : [];
  const attempted = entries.length;
  const successful = entries.filter(item => item?.ok === true).length;
  const failed = entries.filter(item => item?.ok !== true).length;
  const zeroCandidateSuccess = entries.filter(item => item?.ok === true && item?.candidate_count === 0).length;
  const candidateProducingSuccess = entries.filter(item => item?.ok === true && Number(item?.candidate_count) > 0).length;
  const uniqueFailed = new Set(entries.filter(item => item?.ok !== true && item?.execution_id).map(item => item.execution_id));
  const familyDistribution = Object.fromEntries(HOLDOUT_FAILURE_FAMILIES.map(family => [family, 0]));
  for (const entry of entries.filter(item => item?.ok !== true)) {
    if (entry.failure_family && Object.hasOwn(familyDistribution, entry.failure_family)) familyDistribution[entry.failure_family] += 1;
  }
  const planned = Number.isInteger(plannedExecutionCount) ? plannedExecutionCount : attempted;
  return {
    planned_execution_count: planned,
    attempted_execution_count: attempted,
    successful_execution_count: successful,
    failed_execution_count: failed,
    zero_candidate_success_count: zeroCandidateSuccess,
    candidate_producing_success_count: candidateProducingSuccess,
    unique_failed_execution_count: uniqueFailed.size,
    retry_count: Number.isInteger(retryCount) ? retryCount : 0,
    accounting_identity_pass: successful + failed === attempted,
    planned_attempt_identity_pass: (retryCount === 0 ? attempted === planned : true),
    failure_family_distribution: familyDistribution
  };
}
