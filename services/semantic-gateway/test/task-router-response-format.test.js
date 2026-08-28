import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleProvider } from '../src/provider/openai-compatible-provider.js';
import { createSemanticTaskRouter } from '../src/task-router.js';
import {
  getSemanticTaskContract,
  validateTaskData
} from '../../../packages/semantic-contracts/index.js';

const candidate = {
  text: '系统应提供审计日志。',
  category: 'technical',
  source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
  mandatory_observed: true,
  requires_confirmation: false
};

test('requirement extraction dispatch derives strict json_schema from canonical task data_schema', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { requirements: [] }, provider_audit: {} };
      }
    }
  });

  await router.dispatch({ taskType: 'requirement_extraction', payload: {} });
  const canonicalSchema = getSemanticTaskContract('requirement_extraction').data_schema;
  assert.equal(invocation.response_format.type, 'json_schema');
  assert.equal(invocation.response_format.json_schema.strict, true);
  assert.equal(invocation.response_format.json_schema.name, 'requirement_extraction_data');
  assert.equal(invocation.response_format.json_schema.schema, canonicalSchema);
  assert.deepEqual(invocation.response_format.json_schema.schema, canonicalSchema);
});

test('canonical requirement extraction schema keeps requirements-only top-level and exact Candidate v3 fields', () => {
  const schema = getSemanticTaskContract('requirement_extraction').data_schema;
  assert.deepEqual(Object.keys(schema.properties), ['requirements']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.requirements.items.required, [
    'text', 'category', 'source_range', 'mandatory_observed', 'requires_confirmation'
  ]);
  assert.equal(schema.properties.requirements.items.additionalProperties, false);
  assert.deepEqual(validateTaskData('requirement_extraction', { requirements: [candidate] }), { requirements: [candidate] });
});

test('Provider request body uses explicit requirement json_schema and reports only its type', async () => {
  let request;
  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'requirement_extraction_data',
      strict: true,
      schema: getSemanticTaskContract('requirement_extraction').data_schema
    }
  };
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1',
    apiKey: 'secret-test-key',
    model: 'mock-model',
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"requirements":[]}' } }] }), { status: 200 });
    }
  });

  const result = await provider.invoke({ instruction: 'instruction', payload: {}, response_format: responseFormat });
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.deepEqual(request.response_format.json_schema.schema, responseFormat.json_schema.schema);
  assert.equal(result.provider_audit.response_format_type, 'json_schema');
  assert.equal(Object.hasOwn(result.provider_audit, 'response_format_schema'), false);
});

test('explicit json_schema rejection fails closed without json_object downgrade or retry', async () => {
  let request;
  let fetchCount = 0;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1',
    apiKey: 'secret-test-key',
    model: 'mock-model',
    fetchImpl: async (_url, options) => {
      fetchCount += 1;
      request = JSON.parse(options.body);
      return new Response('{"error":"schema unsupported"}', { status: 422 });
    }
  });

  await assert.rejects(
    () => provider.invoke({
      instruction: 'instruction',
      payload: {},
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'requirement_extraction_data', strict: true, schema: { type: 'object' } }
      }
    }),
    error => error.code === 'PROVIDER_HTTP_FAILURE'
      && error.provider_audit.response_format_type === 'json_schema'
  );
  assert.equal(fetchCount, 1);
  assert.equal(request.response_format.type, 'json_schema');
});

test('malformed requirement extraction data still fails strict Gateway validation', async () => {
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        return {
          data: { requirements: [{ ...candidate, extra: true }] },
          provider_audit: {}
        };
      }
    }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'requirement_extraction', payload: {} }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID'
      && error.validation_diagnostics?.some(item => item.validator_code === 'additionalProperties')
  );
});

test('tasks without canonical data_schema keep their existing provider format behavior', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { response_plans: [] }, provider_audit: {} };
      }
    }
  });
  await router.dispatch({ taskType: 'response_planning', payload: {} });
  assert.equal(Object.hasOwn(invocation, 'response_format'), false);
});
