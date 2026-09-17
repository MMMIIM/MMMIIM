import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticTaskRouter, resolveTaskGenerationConfig } from '../src/task-router.js';
import { OpenAICompatibleProvider } from '../src/provider/openai-compatible-provider.js';
import { createStandaloneGatewayServer } from '../src/gateway.js';

const BASE_CONFIG = {
  max_tokens: 4800,
  temperature: 0.1,
  top_p: 0.9,
  top_k: 20,
  frequency_penalty: 0,
  stream: false,
  n: 1,
  enable_thinking: false,
  response_format: { type: 'json_object' }
};

test('task generation config resolves requirement extraction to 9600 without changing the shared default', () => {
  assert.equal(resolveTaskGenerationConfig('requirement_extraction', BASE_CONFIG).max_tokens, 9600);
  for (const taskType of ['default', 'evidence_fact_extraction', 'requirement_evidence_mapping', 'claim_generation', 'section_drafting']) {
    assert.equal(resolveTaskGenerationConfig(taskType, BASE_CONFIG).max_tokens, 4800, taskType);
  }
});

test('task-owned requirement budget wins over a non-default configured base while unknown tasks retain that base', () => {
  const configured = { ...BASE_CONFIG, max_tokens: 6400 };
  assert.equal(resolveTaskGenerationConfig('requirement_extraction', configured).max_tokens, 9600);
  assert.equal(resolveTaskGenerationConfig('unknown_task', configured).max_tokens, 6400);
});

test('resolved task generation config reaches the provider and is exposed in safe audit metadata', async () => {
  let requestBody;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1',
    apiKey: 'secret-test-key',
    model: 'mock-model',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"requirements":[]}' } }] }), { status: 200 });
    },
    logger: { warn() {} }
  });
  const router = createSemanticTaskRouter({ provider, generationConfig: BASE_CONFIG });
  const result = await router.dispatch({ taskType: 'requirement_extraction', payload: {} });

  assert.equal(requestBody.max_tokens, 9600);
  assert.equal(result.provider_audit.task_type, 'requirement_extraction');
  assert.equal(result.provider_audit.configured_default_max_tokens, 4800);
  assert.equal(result.provider_audit.task_override_applied, true);
  assert.equal(result.provider_audit.resolved_max_output_tokens, 9600);
});

test('an unaffected task keeps the provider default and records no task override', async () => {
  let requestBody;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1',
    apiKey: 'secret-test-key',
    model: 'mock-model',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"response_plans":[]}' } }] }), { status: 200 });
    },
    logger: { warn() {} }
  });
  const router = createSemanticTaskRouter({ provider, generationConfig: BASE_CONFIG });
  const result = await router.dispatch({ taskType: 'response_planning', payload: {} });

  assert.equal(requestBody.max_tokens, 4800);
  assert.equal(result.provider_audit.task_type, 'response_planning');
  assert.equal(result.provider_audit.configured_default_max_tokens, 4800);
  assert.equal(result.provider_audit.task_override_applied, false);
  assert.equal(result.provider_audit.resolved_max_output_tokens, 4800);
});

test('gateway diagnostic projection preserves task budget audit without exposing secrets', async () => {
  const key = 'gateway-budget-test-key';
  const provider = {
    async invoke(input) {
      return {
        data: { requirements: [] },
        provider_audit: {
          provider: 'fixture',
          model: 'fixture-model',
          generation_config: input.generation_config
        }
      };
    }
  };
  const server = createStandaloneGatewayServer({
    config: { apiKey: key, providerName: 'mock', provider }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'x-semantic-gateway-diagnostic': 'probe-v1'
      },
      body: JSON.stringify({
        inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' }
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.probe_diagnostics.task_type, 'requirement_extraction');
    assert.equal(body.probe_diagnostics.configured_default_max_tokens, 4800);
    assert.equal(body.probe_diagnostics.task_override_applied, true);
    assert.equal(body.probe_diagnostics.resolved_max_output_tokens, 9600);
    assert.equal(body.probe_diagnostics.generation_config.max_tokens, 9600);
    assert.equal(Object.hasOwn(body.probe_diagnostics, 'api_key'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
