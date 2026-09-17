import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleProvider } from '../src/provider/openai-compatible-provider.js';
import { createSemanticTaskRouter } from '../src/task-router.js';
import { gatewayConfigFromEnv } from '../src/gateway.js';
import { getSemanticTaskContract } from '../../../packages/semantic-contracts/index.js';

const factContract = getSemanticTaskContract('evidence_fact_extraction');

function responseBody() {
  return {
    id: 'response-1',
    object: 'response',
    status: 'completed',
    model: 'deepseek-v4-pro',
    output: [{
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify({ facts: [] }) }]
    }],
    usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 }
  };
}

test('DeepSeek official Responses adapter uses the frozen Fact schema and disables thinking', async () => {
  let requestUrl;
  let requestBody;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'secret-test-key',
    model: 'deepseek-v4-pro',
    endpointPath: '/responses',
    protocol: 'responses',
    providerName: 'deepseek_official',
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify(responseBody()), { status: 200, headers: { 'x-request-id': 'response-1' } });
    }
  });

  const result = await provider.invoke({
    instruction: 'frozen instruction',
    payload: { source_text: 'bounded source text' },
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'evidence_fact_extraction_data',
        strict: true,
        schema: factContract.data_schema
      }
    }
  });

  assert.equal(requestUrl, 'https://api.deepseek.com/responses');
  assert.equal(requestBody.model, 'deepseek-v4-pro');
  assert.equal(requestBody.instructions, 'frozen instruction');
  assert.equal(requestBody.input, JSON.stringify({ source_text: 'bounded source text' }));
  assert.deepEqual(requestBody.reasoning, { effort: 'none' });
  assert.equal(requestBody.max_output_tokens, 4800);
  assert.equal(requestBody.stream, false);
  assert.deepEqual(requestBody.text.format, {
    type: 'json_schema',
    name: 'evidence_fact_extraction_data',
    schema: factContract.data_schema
  });
  assert.equal(Object.hasOwn(requestBody, 'enable_thinking'), false);
  assert.equal(Object.hasOwn(requestBody, 'response_format'), false);
  assert.deepEqual(result.data, { facts: [] });
  assert.equal(result.provider_audit.provider, 'deepseek_official');
  assert.equal(result.provider_audit.protocol, 'responses');
  assert.equal(result.provider_audit.model, 'deepseek-v4-pro');
  assert.equal(result.provider_audit.generation_config.enable_thinking, false);
});

test('task router selects DeepSeek for Fact extraction and Candidate V2 while preserving default provider', async () => {
  const calls = [];
  const defaultProvider = {
    async invoke(input) {
      calls.push(['default', input.taskType]);
      return { data: { requirements: [] }, provider_audit: { provider: 'siliconflow' } };
    }
  };
  const deepSeekProvider = {
    async invoke(input) {
      calls.push(['deepseek', input.taskType]);
      return { data: { facts: [] }, provider_audit: { provider: 'deepseek_official' } };
    }
  };
  const router = createSemanticTaskRouter({
    provider: defaultProvider,
    providers: {
      evidence_fact_extraction: deepSeekProvider,
      evidence_fact_candidate_v2: deepSeekProvider,
      evidence_fact_candidate_v2_1: deepSeekProvider,
      evidence_fact_candidate_v2_2: deepSeekProvider
    }
  });

  await router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} });
  await router.dispatch({ taskType: 'evidence_fact_candidate_v2', payload: {} });
  await router.dispatch({ taskType: 'evidence_fact_candidate_v2_1', payload: {} });
  await router.dispatch({ taskType: 'evidence_fact_candidate_v2_2', payload: {} });
  await router.dispatch({ taskType: 'requirement_extraction', payload: {} });
  assert.deepEqual(calls, [
    ['deepseek', 'evidence_fact_extraction'],
    ['deepseek', 'evidence_fact_candidate_v2'],
    ['deepseek', 'evidence_fact_candidate_v2_1'],
    ['deepseek', 'evidence_fact_candidate_v2_2'],
    ['default', 'requirement_extraction']
  ]);
});

test('Candidate V2 never falls back to the default provider when Official DeepSeek is unconfigured', async () => {
  const calls = [];
  const config = gatewayConfigFromEnv({
    SEMANTIC_GATEWAY_PROVIDER: 'mock',
    SEMANTIC_GATEWAY_API_KEY: 'gateway-key',
    SEMANTIC_GATEWAY_MODEL: 'mock-model'
  });
  const defaultProvider = {
    async invoke(input) {
      calls.push(['default', input.taskType]);
      return { data: { facts: [] }, provider_audit: { provider: 'mock' } };
    }
  };
  const router = createSemanticTaskRouter({ provider: defaultProvider, providers: config.taskProviders });

  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_candidate_v2', payload: {} }),
    error => error.code === 'PROVIDER_UNAVAILABLE'
  );
  assert.deepEqual(calls, []);
});

test('Candidate V2 resolves its own Official DeepSeek endpoint, model and contract', () => {
  const config = gatewayConfigFromEnv({
    SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
    SEMANTIC_GATEWAY_API_KEY: 'gateway-key',
    SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://api.siliconflow.cn/v1',
    SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'siliconflow-key',
    SEMANTIC_GATEWAY_MODEL: 'deepseek-ai/DeepSeek-V4-Flash',
    DEEPSEEK_OFFICIAL_API_BASE: 'https://api.deepseek.com',
    DEEPSEEK_OFFICIAL_API_KEY: 'deepseek-key',
    DEEPSEEK_OFFICIAL_FACT_MODEL: 'deepseek-v4-pro'
  });
  const candidateProvider = config.taskProviders.evidence_fact_candidate_v2;

  assert.equal(candidateProvider.providerName, 'deepseek_official');
  assert.equal(candidateProvider.endpointPath, '/responses');
  assert.equal(candidateProvider.protocol, 'responses');
  assert.equal(candidateProvider.model, 'deepseek-v4-pro');
  assert.equal(candidateProvider.generationConfig.enable_thinking, false);
  assert.equal(getSemanticTaskContract('evidence_fact_candidate_v2').contract_version, '4.3-evidence-fact-candidate-v2');
});

test('gateway config keeps SiliconFlow default and wires official DeepSeek Fact route', () => {
  const config = gatewayConfigFromEnv({
    SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
    SEMANTIC_GATEWAY_API_KEY: 'gateway-key',
    SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://api.siliconflow.cn/v1',
    SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'siliconflow-key',
    SEMANTIC_GATEWAY_MODEL: 'deepseek-ai/DeepSeek-V4-Flash',
    DEEPSEEK_OFFICIAL_API_BASE: 'https://api.deepseek.com',
    DEEPSEEK_OFFICIAL_API_KEY: 'deepseek-key',
    DEEPSEEK_OFFICIAL_FACT_MODEL: 'deepseek-v4-pro',
    SEMANTIC_GATEWAY_ENABLE_THINKING: 'true'
  });

  assert.equal(config.provider.model, 'deepseek-ai/DeepSeek-V4-Flash');
  assert.equal(config.taskProviders.evidence_fact_extraction.model, 'deepseek-v4-pro');
  assert.equal(config.taskProviders.evidence_fact_extraction.endpointPath, '/responses');
  assert.equal(config.taskProviders.evidence_fact_extraction.protocol, 'responses');
  assert.equal(config.taskProviders.evidence_fact_extraction.generationConfig.enable_thinking, false);
  assert.equal(config.runtimeSummary.fact_provider, 'deepseek_official');
  assert.equal(config.runtimeSummary.fact_provider_configured, true);
  assert.equal(config.runtimeSummary.deepseek_official_key_present, true);
  assert.equal(Object.hasOwn(config.runtimeSummary, 'deepseek_official_api_key'), false);
});
