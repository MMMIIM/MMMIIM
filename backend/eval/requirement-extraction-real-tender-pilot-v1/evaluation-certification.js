import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EVALUATION_CONTRACT_VERSION = 'reqx-v311-evaluation-contract-v1';
export const CERTIFICATION_STATUS = Object.freeze({
  PROVISIONAL: 'PROVISIONAL_NOT_CERTIFIED',
  STRUCTURAL: 'STRUCTURAL_CERTIFIED',
  SEMANTIC: 'SEMANTIC_CERTIFIED'
});

const identityKeys = [
  'source_capture_run_id',
  'dataset_version',
  'prompt_contract',
  'prompt_instruction_hash',
  'candidate_contract',
  'candidate_schema_hash',
  'model',
  'production_runtime_identity',
  'provenance_capture_identity',
  'evaluation_contract_version',
  'evaluator_revision'
];

const evaluationIdentityKeys = [...identityKeys, 'evaluation_run_id'];
const captureIdentityKeys = identityKeys.filter((key) => !['evaluation_contract_version', 'evaluator_revision'].includes(key));

function valuePresent(value) {
  return typeof value === 'string' ? value.length > 0 : value != null;
}

function sourceRevision() {
  const source = readFileSync(fileURLToPath(import.meta.url));
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

export const EVALUATOR_REVISION = sourceRevision();

function addMismatch(mismatches, key) {
  if (!mismatches.includes(key)) mismatches.push(key);
}

/**
 * Compare the capture, Gold, adjudication and metrics metadata without
 * treating a run-local locator as cross-run identity.
 */
export function validateEvaluationArtifactIdentity({ capture, gold, adjudication, metrics } = {}) {
  const artifacts = { capture, gold, adjudication, metrics };
  const mismatches = [];
  const required = {
    capture: captureIdentityKeys,
    gold: ['dataset_version'],
    adjudication: evaluationIdentityKeys,
    metrics: evaluationIdentityKeys
  };
  const baseline = capture && typeof capture === 'object' ? capture : null;

  for (const [name, value] of Object.entries(artifacts)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      for (const key of required[name]) addMismatch(mismatches, key);
      continue;
    }
    for (const key of required[name]) if (!valuePresent(value[key])) addMismatch(mismatches, key);
  }

  for (const key of identityKeys) {
    const expected = baseline?.[key];
    if (!valuePresent(expected)) continue;
    for (const [name, value] of Object.entries(artifacts)) {
      if (!valuePresent(value?.[key])) continue;
      if (value[key] !== expected) addMismatch(mismatches, key);
    }
  }
  const evaluationRunIds = [adjudication?.evaluation_run_id, metrics?.evaluation_run_id].filter(valuePresent);
  if (evaluationRunIds.length === 2 && evaluationRunIds[0] !== evaluationRunIds[1]) addMismatch(mismatches, 'evaluation_run_id');

  return {
    valid: mismatches.length === 0,
    mismatches,
    identity: baseline ? Object.fromEntries(identityKeys.map((key) => [key, baseline[key] ?? null])) : null
  };
}

export function certifyEvaluation({
  identity,
  stableProvenanceResolved = false,
  artifactLineageValid = identity?.valid === true,
  structuralAdjudicationComplete = true,
  goldCount,
  semanticAdjudicationComplete = false,
  meaningCompletenessAdjudicated = semanticAdjudicationComplete,
  criticalityAdjudicated = false,
  groupingAdjudicated = false,
  manualReviewRequired = null
} = {}) {
  const identityValid = identity?.valid === true;
  const structuralReady = identityValid
    && artifactLineageValid === true
    && stableProvenanceResolved === true
    && structuralAdjudicationComplete === true
    && Number.isInteger(goldCount)
    && goldCount > 0;

  if (!structuralReady) {
    return {
      certification_status: CERTIFICATION_STATUS.PROVISIONAL,
      semantic_certified: false,
      freeze_valid: false,
      metric_semantics: 'SOURCE_RANGE_STRUCTURAL_ONLY',
      code: 'EVALUATOR_NOT_CERTIFIED'
    };
  }

  const semanticReady = semanticAdjudicationComplete === true
    && meaningCompletenessAdjudicated === true
    && criticalityAdjudicated === true
    && groupingAdjudicated === true
    && manualReviewRequired === 0;
  if (!semanticReady) {
    return {
      certification_status: CERTIFICATION_STATUS.STRUCTURAL,
      semantic_certified: false,
      freeze_valid: false,
      metric_semantics: 'SOURCE_RANGE_STRUCTURAL_ONLY',
      code: null
    };
  }

  return {
    certification_status: CERTIFICATION_STATUS.SEMANTIC,
    semantic_certified: true,
    freeze_valid: true,
    metric_semantics: 'SEMANTIC_ADJUDICATED',
    code: null
  };
}
