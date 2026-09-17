import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAICompatibleProvider } from '../src/provider/openai-compatible-provider.js';
import { createSemanticTaskRouter } from '../src/task-router.js';
import {
  EVIDENCE_FACT_TRANSPORT_SCHEMA,
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  resolveSemanticTaskInstruction,
  validateTaskData
} from '../../../packages/semantic-contracts/index.js';
import { createEvidenceFactContract } from '../../../backend/src/pipeline/evidence-fact-contract-v1.js';
import { EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA } from '../../../backend/src/pipeline/evidence-support-assessment-gateway-contract-v1.js';

const assessmentContract = getSemanticTaskContract('evidence_support_assessment');
const factContract = getSemanticTaskContract('evidence_fact_extraction');

function legacyOutputKeys(text) {
  const legacy = [
    'predicate', 'object_type', 'object_name', 'entity_type',
    'source_span_id', 'source_text_hash', 'confidence', 'notes'
  ];
  return legacy.filter(key => new RegExp(`(?:["'])${key}(?:["'])\\s*:`).test(text));
}

function validFactCandidate() {
  return {
    subject_type: 'product',
    subject_name: '平台',
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {}
  };
}

test('assessment task declares the existing contract version and strict schema transport', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { assessments: [], conflict_observations: [] }, provider_audit: {} };
      }
    }
  });

  await router.dispatch({ taskType: 'evidence_support_assessment', payload: {} });

  assert.equal(assessmentContract.contract_version, '4.3-evidence-support-assessment-v1');
  assert.ok(assessmentContract.data_schema, 'assessment contract must own a data_schema');
  assert.equal(invocation.response_format.type, 'json_schema');
  assert.equal(invocation.response_format.json_schema.name, 'evidence_support_assessment_data');
  assert.equal(invocation.response_format.json_schema.strict, true);
  assert.equal(invocation.response_format.json_schema.schema, assessmentContract.data_schema);
});

test('assessment provider schema is identical to the existing Gateway validator schema', () => {
  assert.deepEqual(assessmentContract.data_schema, EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA);
});

test('assessment schema parity catches a missing required field in a drift fixture', () => {
  const drifted = structuredClone(EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA);
  drifted.properties.assessments.items.required = drifted.properties.assessments.items.required
    .filter(field => field !== 'support_level');
  assert.throws(() => assert.deepEqual(drifted, EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA), assert.AssertionError);
});

test('assessment schema parity catches an injected legacy field in a drift fixture', () => {
  const drifted = structuredClone(EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA);
  drifted.properties.assessments.items.properties.entity_type = { type: 'string' };
  assert.throws(() => assert.deepEqual(drifted, EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA), assert.AssertionError);
});

test('Provider request body uses assessment json_schema without exposing schema contents in audit', async () => {
  let request;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1',
    apiKey: 'secret-test-key',
    model: 'mock-model',
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: '{"assessments":[],"conflict_observations":[]}' } }]
      }), { status: 200 });
    }
  });

  const result = await provider.invoke({
    taskType: 'evidence_support_assessment',
    instruction: 'instruction',
    payload: {},
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'evidence_support_assessment_data',
        strict: true,
        schema: assessmentContract.data_schema
      }
    }
  });

  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.deepEqual(request.response_format.json_schema.schema, EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA);
  assert.equal(result.provider_audit.response_format_type, 'json_schema');
  assert.equal(Object.hasOwn(result.provider_audit, 'response_format_schema'), false);
});

test('Fact schema, Router transport, and Backend canonical contract remain aligned', () => {
  const candidate = validFactCandidate();
  validateTaskData('evidence_fact_extraction', { facts: [candidate] });

  const responseFormat = {
    type: 'json_schema',
    json_schema: { name: 'evidence_fact_extraction_data', strict: true, schema: factContract.data_schema }
  };
  assert.equal(responseFormat.type, 'json_schema');
  assert.equal(responseFormat.json_schema.strict, true);
  assert.equal(responseFormat.json_schema.schema, factContract.data_schema);
  assert.deepEqual(
    factContract.data_schema.properties.facts.items.properties,
    EVIDENCE_FACT_TRANSPORT_SCHEMA.properties
  );

  const fact = createEvidenceFactContract({
    project_id: 'project-1',
    review_id: 'review-1',
    source_span_id: 'span-1',
    material_id: 'material-1',
    anchor_chunk_id: 'chunk-1',
    source_text: '平台提供服务。',
    source_text_hash: '0'.repeat(64)
  }, {
    subject: { type: candidate.subject_type, name: candidate.subject_name },
    entities: candidate.entities,
    status: candidate.status,
    scopes: candidate.scopes,
    quantities: candidate.quantities,
    validity: candidate.validity,
    domain_metadata: candidate.domain_metadata
  });
  assert.deepEqual(fact.subject, { type: 'product', name: '平台' });
});

test('Fact retry guidance keeps the same contract identity and strict response format', async () => {
  const invocations = [];
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocations.push(input);
        return { data: { facts: [] }, provider_audit: {} };
      }
    }
  });

  await router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} });
  await router.dispatch({
    taskType: 'evidence_fact_extraction',
    payload: { validation_feedback: { path: 'data.facts[0].entities', keyword: 'type', expected: 'array', actual_type: 'string' } }
  });

  assert.equal(getSemanticTaskContract('evidence_fact_extraction').contract_version, '4.3-evidence-fact-extraction-v1');
  assert.equal(invocations.length, 2);
  assert.deepEqual(invocations[0].response_format, invocations[1].response_format);
  assert.equal(invocations[1].response_format.type, 'json_schema');
  assert.equal(invocations[1].response_format.json_schema.strict, true);
});

test('Fact production instruction has no stale legacy JSON output keys while natural language mentions remain harmless', () => {
  const metadata = getSemanticTaskInstructionMetadata('evidence_fact_extraction');
  const instruction = resolveSemanticTaskInstruction('evidence_fact_extraction');
  assert.equal(metadata.contract_version, factContract.contract_version);
  assert.equal(metadata.instruction, instruction);
  assert.deepEqual(legacyOutputKeys(instruction), []);
  assert.deepEqual(legacyOutputKeys('The word "confidence" may appear in source prose.'), []);
  assert.deepEqual(legacyOutputKeys('{"confidence":0}'), ['confidence']);
});
