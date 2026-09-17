import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVALUATION_CONTRACT_VERSION,
  certifyEvaluation,
  validateEvaluationArtifactIdentity
} from '../eval/requirement-extraction-real-tender-pilot-v1/evaluation-certification.js';
import {
  buildProductionRuntimeIdentity,
  buildProvenanceCaptureIdentity
} from '../eval/requirement-extraction-real-tender-pilot-v1/run-live-eval.js';

const identity = {
  source_capture_run_id: 'capture-a',
  dataset_version: 'dataset-v1',
  prompt_contract: 'prompt-v3.1.1',
  prompt_instruction_hash: 'prompt-hash',
  candidate_contract: 'candidate-v3',
  candidate_schema_hash: 'candidate-hash',
  model: 'DeepSeek-V4-Flash',
  production_runtime_identity: 'runtime-a',
  provenance_capture_identity: 'provenance-a',
  evaluation_contract_version: EVALUATION_CONTRACT_VERSION,
  evaluator_revision: 'evaluator-a'
};

function artifacts(overrides = {}) {
  const capture = { ...identity };
  const gold = { ...identity };
  const adjudication = { ...identity, evaluation_run_id: 'eval-a' };
  const metrics = { ...identity, evaluation_run_id: 'eval-a' };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'capture') Object.assign(capture, value);
    if (key === 'gold') Object.assign(gold, value);
    if (key === 'adjudication') Object.assign(adjudication, value);
    if (key === 'metrics') Object.assign(metrics, value);
  }
  return { capture, gold, adjudication, metrics };
}

test('mixed source captures are uncertified and never freeze-valid', () => {
  const result = validateEvaluationArtifactIdentity(artifacts({ adjudication: { source_capture_run_id: 'capture-b' } }));
  assert.equal(result.valid, false);
  const certification = certifyEvaluation({ identity: result, stableProvenanceResolved: true, goldCount: 199, semanticAdjudicationComplete: true });
  assert.equal(certification.certification_status, 'PROVISIONAL_NOT_CERTIFIED');
  assert.equal(certification.freeze_valid, false);
  assert.equal(certification.code, 'EVALUATOR_NOT_CERTIFIED');
});

test('dataset and prompt/candidate mismatches are rejected before certification', () => {
  const dataset = validateEvaluationArtifactIdentity(artifacts({ gold: { dataset_version: 'dataset-v2' } }));
  const prompt = validateEvaluationArtifactIdentity(artifacts({ metrics: { prompt_instruction_hash: 'other' } }));
  assert.equal(dataset.valid, false);
  assert.equal(prompt.valid, false);
  assert.ok(dataset.mismatches.includes('dataset_version'));
  assert.ok(prompt.mismatches.includes('prompt_instruction_hash'));
});

test('unresolved provenance remains provisional while semantic pending is structural-only', () => {
  const valid = validateEvaluationArtifactIdentity(artifacts());
  const unresolved = certifyEvaluation({ identity: valid, stableProvenanceResolved: false, goldCount: 199, semanticAdjudicationComplete: false });
  assert.equal(unresolved.certification_status, 'PROVISIONAL_NOT_CERTIFIED');
  assert.equal(unresolved.freeze_valid, false);
  const pending = certifyEvaluation({ identity: valid, stableProvenanceResolved: true, goldCount: 199, semanticAdjudicationComplete: false });
  assert.equal(pending.certification_status, 'STRUCTURAL_CERTIFIED');
  assert.equal(pending.semantic_certified, false);
  assert.equal(pending.freeze_valid, false);
  assert.equal(pending.metric_semantics, 'SOURCE_RANGE_STRUCTURAL_ONLY');
});

test('fully certified identity and semantic adjudication are freeze-valid', () => {
  const valid = validateEvaluationArtifactIdentity(artifacts());
  const certification = certifyEvaluation({ identity: valid, stableProvenanceResolved: true, goldCount: 199, semanticAdjudicationComplete: true, manualReviewRequired: 0, criticalityAdjudicated: true, groupingAdjudicated: true });
  assert.equal(certification.certification_status, 'SEMANTIC_CERTIFIED');
  assert.equal(certification.semantic_certified, true);
  assert.equal(certification.freeze_valid, true);
});

test('certified runtime identity is complete and secret-free', () => {
  const identity = buildProductionRuntimeIdentity({
    env: {
      SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
      SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
      SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://api.siliconflow.cn/v1',
      SEMANTIC_GATEWAY_MODEL: 'deepseek-ai/DeepSeek-V4-Flash',
      SEMANTIC_GATEWAY_MAX_TOKENS: '4800',
      SEMANTIC_GATEWAY_TEMPERATURE: '0.1',
      SEMANTIC_GATEWAY_TOP_P: '1',
      SEMANTIC_GATEWAY_TOP_K: '50',
      SEMANTIC_GATEWAY_FREQUENCY_PENALTY: '0',
      SEMANTIC_GATEWAY_ENABLE_THINKING: 'false',
      SEMANTIC_GATEWAY_STREAM: 'false',
      SEMANTIC_GATEWAY_N: '1'
    },
    info: { build_revision: 'f509514', requirement_extraction_contract_version: '4.3-requirement-extraction-v3.1.1' },
    providerTimeoutMs: 120000
  });
  assert.equal(identity.model, 'deepseek-ai/DeepSeek-V4-Flash');
  assert.equal(identity.generation.max_tokens, 4800);
  assert.equal(identity.generation.response_format.type, 'json_schema');
  assert.equal(identity.generation.response_format.strict, true);
  assert.equal(identity.provider_key_present, false);
  assert.equal(Object.keys(identity).some((key) => /key|secret|authorization/i.test(key)
    && !['provider_key_present', 'service_key_present'].includes(key)), false);
});

test('provenance capture identity is deterministic and mutation-sensitive', () => {
  const paths = [{ tender_id: 'FAST-01', source_file_sha256: 'source-a', chunks: [{ id: 'c1', chunk_number: 1, model_text: 'input', segments: [{ source_ref: 'C001-S001' }], table_units: [] }] }];
  const first = buildProvenanceCaptureIdentity(paths);
  const second = buildProvenanceCaptureIdentity(JSON.parse(JSON.stringify(paths)));
  const changed = buildProvenanceCaptureIdentity([{ ...paths[0], chunks: [{ ...paths[0].chunks[0], model_text: 'changed' }] }]);
  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
});
