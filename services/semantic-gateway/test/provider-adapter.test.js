import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleProvider } from '../src/provider/openai-compatible-provider.js';
import { getSemanticTaskContract, SEMANTIC_TASK_TYPES, validateTaskData } from '../../../packages/semantic-contracts/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA } from '../../../backend/src/pipeline/evidence-support-assessment-gateway-contract-v1.js';
import { gatewayConfigFromEnv } from '../src/gateway.js';

test('shared task registry exposes one canonical contract set', () => {
  assert.deepEqual(SEMANTIC_TASK_TYPES.filter(task => task !== 'draft_sections'), [
    'requirement_extraction', 'response_planning', 'claim_generation',
    'section_drafting', 'targeted_revision', 'evidence_support_assessment'
  ]);
  assert.equal(getSemanticTaskContract('requirement_extraction').contract_version, '4.3-requirement-extraction-v3');
  assert.equal(getSemanticTaskContract('evidence_support_assessment').contract_version, '4.3-evidence-support-assessment-v1');
});

test('OpenAI-compatible adapter posts the canonical request exactly once', async () => {
  let request;
  let fetchCount = 0;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async (url, options) => {
      fetchCount += 1;
      request = { url, options };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 });
    },
    logger: { warn() {} }
  });
  const result = await provider.invoke({ instruction: 'instruction', payload: { value: 1 } });
  assert.deepEqual(result.data, { ok: true });
  assert.equal(fetchCount, 1);
  assert.equal(request.url, 'https://provider.invalid/v1/chat/completions');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-test-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'mock-model');
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'instruction' },
    { role: 'user', content: '{"value":1}' }
  ]);
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.max_tokens, 3200);
  assert.equal(body.temperature, 0.1);
  assert.equal(body.top_p, 0.9);
  assert.equal(body.top_k, 20);
  assert.equal(body.frequency_penalty, 0);
  assert.equal(body.stream, false);
  assert.equal(result.provider_audit.provider_adapter_invoked, true);
  assert.equal(result.provider_audit.fetch_invoked, true);
  assert.equal(result.provider_audit.provider_http_reached, true);
  assert.equal(result.provider_audit.current_stage, 'MODEL_CONTENT_EXTRACTED');
  assert.equal(result.provider_audit.finish_reason, null);
  assert.equal(result.provider_audit.model_content_length_chars, 11);
  assert.equal(result.provider_audit.generation_config.max_tokens, 3200);
  assert.equal(result.provider_audit.outbound_prompt_diagnostics.contamination, false);
});

test('eval-only json_schema override is forwarded while default remains json_object', async () => {
  let request;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    generationConfig: {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'evidence_support_assessment_v1', strict: true, schema: EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA }
      }
    },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }), { status: 200 });
    }
  });
  await provider.invoke({ instruction: 'instruction', payload: {} });
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.name, 'evidence_support_assessment_v1');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.deepEqual(request.response_format.json_schema.schema, EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA);
  assert.equal(request.stream, false);
});

test('DeepSeek Flash generation controls include non-thinking mode and single completion', async () => {
  let request;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'deepseek-ai/DeepSeek-V4-Flash',
    generationConfig: {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'requirement_extraction_data', strict: true, schema: { type: 'object' } }
      },
      enable_thinking: false,
      temperature: 0.1,
      top_p: 1,
      top_k: 50,
      frequency_penalty: 0,
      max_tokens: 3200,
      stream: false,
      n: 1
    },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"requirements":[]}' } }] }), { status: 200 });
    }
  });

  const result = await provider.invoke({ instruction: 'instruction', payload: {} });
  assert.equal(request.model, 'deepseek-ai/DeepSeek-V4-Flash');
  assert.equal(request.enable_thinking, false);
  assert.equal(request.temperature, 0.1);
  assert.equal(request.top_p, 1);
  assert.equal(request.top_k, 50);
  assert.equal(request.frequency_penalty, 0);
  assert.equal(request.max_tokens, 3200);
  assert.equal(request.stream, false);
  assert.equal(request.n, 1);
  assert.equal(Object.hasOwn(request, 'thinking_budget'), false);
  assert.equal(Object.hasOwn(request, 'reasoning_effort'), false);
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(result.provider_audit.generation_config.enable_thinking, false);
  assert.equal(result.provider_audit.generation_config.n, 1);
});

test('Gateway maps explicit runtime generation controls into the generic Provider adapter', () => {
  const config = gatewayConfigFromEnv({
    SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
    SEMANTIC_GATEWAY_API_KEY: 'service-key',
    SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.invalid/v1',
    SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'provider-key',
    SEMANTIC_GATEWAY_MODEL: 'deepseek-ai/DeepSeek-V4-Flash',
    SEMANTIC_GATEWAY_ENABLE_THINKING: 'false',
    SEMANTIC_GATEWAY_TEMPERATURE: '0.1',
    SEMANTIC_GATEWAY_TOP_P: '1',
    SEMANTIC_GATEWAY_TOP_K: '50',
    SEMANTIC_GATEWAY_FREQUENCY_PENALTY: '0',
    SEMANTIC_GATEWAY_MAX_TOKENS: '3200',
    SEMANTIC_GATEWAY_STREAM: 'false',
    SEMANTIC_GATEWAY_N: '1'
  });
  assert.equal(config.provider.generationConfig.enable_thinking, false);
  assert.equal(config.provider.generationConfig.temperature, 0.1);
  assert.equal(config.provider.generationConfig.top_p, 1);
  assert.equal(config.provider.generationConfig.top_k, 50);
  assert.equal(config.provider.generationConfig.frequency_penalty, 0);
  assert.equal(config.provider.generationConfig.max_tokens, 3200);
  assert.equal(config.provider.generationConfig.stream, false);
  assert.equal(config.provider.generationConfig.n, 1);
});

test('OpenAI-compatible adapter preserves HTTP 400/401 status after one request', async () => {
  for (const status of [400, 401]) {
    let fetchCount = 0;
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response('{}', { status });
      },
      logger: { warn() {} }
    });
    await assert.rejects(
      () => provider.invoke({ instruction: 'instruction', payload: {} }),
      error => error.code === 'PROVIDER_HTTP_FAILURE'
        && error.httpStatus === status
        && error.provider_audit.provider_http_reached === true
        && error.provider_audit.http_status === status
        && error.provider_audit.safe_error_code === 'PROVIDER_HTTP_ERROR'
    );
    assert.equal(fetchCount, 1);
  }
});

test('request serialization failure is captured before fetch without changing public error code', async () => {
  let fetchCount = 0;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response('{}', { status: 200 });
    },
    logger: { warn() {} }
  });
  await assert.rejects(
    () => provider.invoke({ instruction: 1n, payload: {} }),
    error => error.code === 'PROVIDER_UNAVAILABLE'
      && error.provider_audit.failure_stage === 'REQUEST_BODY_SERIALIZED'
      && error.provider_audit.safe_error_code === 'REQUEST_SERIALIZATION_FAILED'
      && error.provider_audit.fetch_invoked === false
  );
  assert.equal(fetchCount, 0);
});

test('fetch rejection preserves a safe low-level cause and distinguishes HTTP reachability', async () => {
  const cause = Object.assign(new Error('socket reset while connecting'), { code: 'ECONNRESET' });
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause });
    },
    logger: { warn() {} }
  });
  await assert.rejects(
    () => provider.invoke({ instruction: 'instruction', payload: {} }),
    error => error.code === 'PROVIDER_UNAVAILABLE'
      && error.provider_audit.provider_adapter_invoked === true
      && error.provider_audit.fetch_invoked === true
      && error.provider_audit.provider_http_reached === false
      && error.provider_audit.failure_stage === 'FETCH_INVOKED'
      && error.provider_audit.safe_error_code === 'FETCH_FAILED'
      && error.provider_audit.cause_code === 'ECONNRESET'
  );
});

test('OpenAI-compatible adapter preserves safe model-content diagnostics', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"ok"}' } }] }), { status: 200 })
  });
  const result = await provider.invoke({ instruction: 'instruction', payload: {} });
  assert.equal(result.provider_audit.json_parse_success, true);
  assert.equal(result.provider_audit.model_content, '{"status":"ok"}');
  assert.deepEqual(result.provider_audit.parsed_json, { status: 'ok' });
});

test('OpenAI-compatible adapter classifies invalid provider JSON', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{' } }] }), { status: 200 })
  });
  await assert.rejects(() => provider.invoke({ instruction: 'instruction', payload: {} }), error => error.code === 'PROVIDER_OUTPUT_INVALID');
});

test('provider metadata captures finish reason, usage, response identity and truncation without repairing output', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => new Response(JSON.stringify({
      id: 'response-1', model: 'mock-model',
      choices: [{ finish_reason: 'length', message: { content: '{"status":"ok"' } }],
      usage: { prompt_tokens: 10, completion_tokens: 3200, total_tokens: 3210 }
    }), { status: 200, headers: { 'x-siliconcloud-trace-id': 'trace-1' } })
  });
  await assert.rejects(
    () => provider.invoke({ instruction: 'instruction', payload: {} }),
    error => error.code === 'PROVIDER_OUTPUT_INVALID'
      && error.provider_audit.finish_reason === 'length'
      && error.provider_audit.prompt_tokens === 10
      && error.provider_audit.completion_tokens === 3200
      && error.provider_audit.total_tokens === 3210
      && error.provider_audit.response_model === 'mock-model'
      && error.provider_audit.response_id === 'response-1'
      && error.provider_audit.provider_trace_id === 'trace-1'
      && error.provider_audit.model_content_length_chars === 14
      && error.provider_audit.output_truncated === true
      && error.provider_audit.safe_error_code === 'OUTPUT_TRUNCATED'
  );
});

test('malformed model content gets token diagnostics without JSON repair', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"support_level":"full_support","evidence_bearing":true,"support__observations":[' } }]
    }), { status: 200 })
  });
  await assert.rejects(
    () => provider.invoke({ instruction: 'instruction', payload: {} }),
    error => error.code === 'PROVIDER_OUTPUT_INVALID'
      && error.provider_audit.json_parse_success === false
      && error.provider_audit.legacy_schema_tokens_observed.includes('evidence_bearing')
      && error.provider_audit.legacy_schema_tokens_observed.includes('support__observations')
      && error.provider_audit.model_content.endsWith('[')
  );
});

test('outbound prompt diagnostics are metadata-only and do not flag forbidden-token mentions as contamination', async () => {
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://provider.invalid/v1', apiKey: 'secret-test-key', model: 'mock-model',
    fetchImpl: async (_url, options) => {
      assert.equal(options.body.includes('secret-test-key'), false);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }), { status: 200 });
    }
  });
  const result = await provider.invoke({ instruction: '禁止输出 confidence、evidence_type、notes。', payload: { source_text: 'private source' } });
  assert.equal(result.provider_audit.outbound_prompt_diagnostics.contamination, false);
  assert.equal(typeof result.provider_audit.outbound_prompt_diagnostics.instruction_sha256, 'string');
  assert.equal(Object.hasOwn(result.provider_audit.outbound_prompt_diagnostics, 'instruction'), false);
});

test('shared schema validator rejects extra fields', () => {
  assert.throws(() => validateTaskData('section_drafting', { chapter_id: 'c', content_markdown: 'x', extra: true }), /unsupported fields/);
});

test('real legacy evidence-support response shape is rejected without repair', () => {
  const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../backend/test/fixtures/evidence-support-real-legacy-output.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.throws(() => validateTaskData('evidence_support_assessment', fixture.data, {
    sources: fixture.data.assessments.map(item => ({ source_id: item.source_id, source_span_id: `span-${item.source_id}` }))
  }), /unsupported fields/);
});

test('evidence-support prompt forbids envelope and legacy-only output', async () => {
  const { resolveSemanticTaskInstruction } = await import('../../../packages/semantic-contracts/index.js');
  const instruction = resolveSemanticTaskInstruction('evidence_support_assessment');
  assert.match(instruction, /绝对不要输出 schema_version、task_type、status、data、warnings/);
  assert.match(instruction, /confidence、evidence_type、notes/);
  assert.match(instruction, /semantic_relevance、evidence_capability、support_level、semantic_relationship/);
});
