import fs from 'node:fs';
import path from 'node:path';
import { hashJson } from './contract.js';

export const BASELINE_CLASSIFICATIONS = Object.freeze(['KNOWN_BASELINE_FAILURE', 'NEW_TASK_REGRESSION', 'FLAKY', 'ENVIRONMENT', 'UNKNOWN']);

export function buildFailureSignature({ testId, errorCode = null, message = null, command = null } = {}) {
  return `sig:${hashJson({ test_id: testId, error_code: errorCode, message: message || null, command: command || null }).slice(-32)}`;
}

export function recordBaselineFailure(input, registry = { failures: [] }) {
  const classification = input.classification || 'UNKNOWN';
  if (!BASELINE_CLASSIFICATIONS.includes(classification)) throw Object.assign(new Error('Baseline failure classification is invalid.'), { code: 'INVALID_BASELINE_CLASSIFICATION' });
  if (!input.test_id || !input.failure_signature) throw Object.assign(new Error('test_id and failure_signature are required.'), { code: 'INVALID_BASELINE_FAILURE' });
  const row = {
    test_id: String(input.test_id),
    failure_signature: String(input.failure_signature),
    classification,
    first_seen: input.first_seen || new Date().toISOString(),
    evidence_ref: input.evidence_ref || null,
    status: input.status || 'OPEN'
  };
  const existing = registry.failures.find((item) => item.test_id === row.test_id && item.failure_signature === row.failure_signature);
  if (!existing) registry.failures.push(row);
  return { record: existing || row, created: !existing, registry };
}

export function classifyFailure(observation, registry = { failures: [] }) {
  const signature = observation.failure_signature || buildFailureSignature(observation);
  const exact = registry.failures.find((row) => row.test_id === observation.test_id && row.failure_signature === signature);
  if (exact) return exact.classification;
  if (observation.transient === true) return 'FLAKY';
  if (observation.environmental === true) return 'ENVIRONMENT';
  return 'NEW_TASK_REGRESSION';
}

export function loadBaselineFailures(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { artifact_type: 'V43_KNOWN_BASELINE_FAILURE_REGISTRY', artifact_version: 'v1', failures: [] };
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function persistBaselineFailures(registry, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ artifact_type: 'V43_KNOWN_BASELINE_FAILURE_REGISTRY', artifact_version: 'v1', failures: registry.failures || [] }, null, 2)}\n`, 'utf8');
  return filePath;
}
