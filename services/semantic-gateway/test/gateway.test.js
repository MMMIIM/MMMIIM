import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandaloneGatewayServer } from '../src/gateway.js';
import { SemanticGatewayClient } from '../../../backend/src/pipeline/semantic-gateway-client.js';
import { adaptRetrievalCandidate, aggregateEvidenceSufficiency } from '../../../backend/src/pipeline/evidence-support-assessment-contract-v1.js';
import { SemanticGatewayEvidenceSupportEvaluator } from '../../../backend/src/pipeline/semantic-gateway-evidence-support-evaluator.js';
import { REQUIREMENT_CANDIDATE_SCHEMA_SHA256, REQUIREMENT_CANDIDATE_SCHEMA_VERSION } from '../../../packages/semantic-contracts/index.js';

async function withGateway(fn, { provider = 'mock', key = 'gateway-test-key' } = {}) {
  const server = createStandaloneGatewayServer({
    env: { SEMANTIC_GATEWAY_PROVIDER: provider, SEMANTIC_GATEWAY_API_KEY: key, SEMANTIC_GATEWAY_MODEL: 'mock-semantic-v1' }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try { return await fn({ port, key }); } finally { await new Promise(resolve => server.close(resolve)); }
}

function client(port, key = 'gateway-test-key') {
  return new SemanticGatewayClient({
    apiBase: `http://127.0.0.1:${port}`,
    apiKey: key,
    user: 'standalone-test',
    timeoutMs: 5000
  });
}

test('standalone gateway health/readiness/auth are explicit', async () => {
  await withGateway(async ({ port, key }) => {
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const ready = await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).provider, 'mock');
    const unauthorized = await fetch(`http://127.0.0.1:${port}/workflows/run`, { method: 'POST', body: '{}' });
    assert.equal(unauthorized.status, 401);
    const authorized = await fetch(`http://127.0.0.1:${port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'ignored by resolver', task_payload_json: '{}' } })
    });
    assert.equal(authorized.status, 200);
  });
});

test('standalone gateway /info exposes safe runtime and contract diagnostics', async () => {
  await withGateway(async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/info`);
    assert.equal(response.status, 200);
    const info = await response.json();
    assert.equal(info.service, 'semantic-gateway');
    assert.equal(info.gateway_schema_version, 'semantic-gateway-envelope-v1');
    assert.equal(info.requirement_extraction_contract_version, '4.3-requirement-extraction-v3');
    assert.equal(info.requirement_extraction_prompt_version, '4.3-requirement-extraction-v3');
    assert.match(info.requirement_extraction_instruction_hash, /^[a-f0-9]{64}$/);
    assert.equal(info.requirement_extraction_prompt_hash, info.requirement_extraction_instruction_hash);
    assert.equal(info.candidate_schema_contract_version, REQUIREMENT_CANDIDATE_SCHEMA_VERSION);
    assert.equal(info.candidate_schema_sha256, REQUIREMENT_CANDIDATE_SCHEMA_SHA256);
    assert.equal(info.service_version, '0.1.0');
    assert.equal(info.build_revision, 'dev-working-tree');
    assert.ok(Array.isArray(info.task_types));
    assert.equal(Object.hasOwn(info, 'api_key'), false);
    assert.equal(Object.hasOwn(info, 'provider_api_key'), false);
  });
});

test('standalone gateway /info exposes injected build revision without secrets', async () => {
  const server = createStandaloneGatewayServer({
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'mock',
      SEMANTIC_GATEWAY_API_KEY: 'service-only',
      SEMANTIC_GATEWAY_BUILD_VERSION: '0.1.0-test',
      SEMANTIC_GATEWAY_COMMIT: 'fixture-revision-123',
      SEMANTIC_GATEWAY_WORKTREE_DIRTY: 'true'
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const info = await (await fetch(`http://127.0.0.1:${server.address().port}/info`)).json();
    assert.equal(info.service_version, '0.1.0-test');
    assert.equal(info.build_revision, 'fixture-revision-123');
    assert.equal(info.working_tree_dirty, true);
    assert.equal(Object.hasOwn(info, 'api_key'), false);
    assert.equal(Object.hasOwn(info, 'provider_api_key'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Gateway service auth is independent from Provider auth', async () => {
  const server = createStandaloneGatewayServer({
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
      SEMANTIC_GATEWAY_API_KEY: 'service-key',
      SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.invalid/v1',
      SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'provider-key',
      SEMANTIC_GATEWAY_MODEL: 'Qwen/Qwen2.5-7B-Instruct'
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const body = JSON.stringify({ inputs: { task_type: '__preflight__', task_instruction: 'preflight', task_payload_json: '{}' } });
    const headers = { 'content-type': 'application/json' };
    const missing = await fetch(`${base}/workflows/run`, { method: 'POST', headers, body });
    assert.equal(missing.status, 401);
    const wrong = await fetch(`${base}/workflows/run`, { method: 'POST', headers: { ...headers, authorization: 'Bearer provider-key' }, body });
    assert.equal(wrong.status, 401);
    const correct = await fetch(`${base}/workflows/run`, { method: 'POST', headers: { ...headers, authorization: 'Bearer service-key' }, body });
    assert.equal(correct.status, 422);
    assert.equal((await correct.json()).error_code, 'TASK_UNSUPPORTED');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('OpenAI-compatible readiness fails closed when Provider key is missing', async () => {
  const server = createStandaloneGatewayServer({
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
      SEMANTIC_GATEWAY_API_KEY: 'service-key',
      SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.invalid/v1',
      SEMANTIC_GATEWAY_MODEL: 'Qwen/Qwen2.5-7B-Instruct'
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const ready = await fetch(`http://127.0.0.1:${server.address().port}/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).provider_configured, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('backend SemanticGatewayClient uses the same /workflows/run transport contract', async () => {
  await withGateway(async ({ port, key }) => {
    const result = await client(port, key).run({ task_type: 'requirement_extraction', task_instruction: 'backend instruction', task_payload_json: '{}' });
    assert.equal(result.envelope.schema_version, '4.3-requirement-extraction-v3');
    assert.equal(result.envelope.task_type, 'requirement_extraction');
    assert.deepEqual(result.envelope.data, { requirements: [] });
  });
});

test('all existing formal tasks dispatch through the same mock provider contract', async () => {
  await withGateway(async ({ port, key }) => {
    const cases = [
      ['requirement_extraction', {}, '4.3-requirement-extraction-v3', data => Array.isArray(data.requirements)],
      ['response_planning', { requirements: [{ req_id: 'REQ-001' }] }, '4.3-response-planning', data => Array.isArray(data.response_plans)],
      ['claim_generation', { plans: [{ requirement_id: 'REQ-001', response_summary: 'x' }] }, '4.3-claim-generation', data => Array.isArray(data.claims)],
      ['section_drafting', { chapter_id: 'chapter-1' }, '4.3-section-drafting', data => typeof data.content_markdown === 'string'],
      ['targeted_revision', { paragraph: '待修订文本' }, '4.3-targeted-revision', data => typeof data.revised_text === 'string']
    ];
    for (const [taskType, payload, version, predicate] of cases) {
      const result = await client(port, key).run({ task_type: taskType, task_instruction: 'formal instruction', task_payload_json: JSON.stringify(payload) });
      assert.equal(result.envelope.schema_version, version);
      assert.equal(result.envelope.task_type, taskType);
      assert.equal(predicate(result.envelope.data), true);
    }
  });
});

test('evidence support Top5 integrates through standalone gateway and deterministic aggregation', async () => {
  await withGateway(async ({ port, key }) => {
    const requirement = { req_id: 'REQ-001', text: '系统应支持统一身份认证。' };
    const texts = [
      '系统应支持统一身份认证。',
      '系统提供统一身份认证能力。[[partial]]',
      '这是背景介绍。[[unrelated]]',
      '状态为已上线。[[conflict:approved]]',
      '状态为建设中。[[conflict:rejected]]'
    ];
    const adapters = texts.map((sourceText, index) => adaptRetrievalCandidate({
      requirement,
      candidate: { candidate_id: `C-${index + 1}` },
      sourceSpan: { source_span_id: `SPAN-${index + 1}`, source_text: sourceText },
      material: { material_type: 'technical_solution', source_origin: 'enterprise_private' },
      lineage: { material_id: `MAT-${index + 1}`, chunk_id: `CHUNK-${index + 1}` }
    }));
    const evaluator = new SemanticGatewayEvidenceSupportEvaluator({ client: client(port, key) });
    const result = await evaluator.assess({ requirement, adapters });
    assert.equal(result.assessments.length, 5);
    assert.ok(result.assessments.some(item => item.semantic_relationship === 'direct'));
    assert.ok(result.assessments.some(item => item.semantic_relationship === 'partial'));
    assert.ok(result.assessments.some(item => item.semantic_relationship === 'unrelated'));
    assert.ok(result.assessments.every(item => item.support_observations[0].support_excerpt.length > 0));
    const aggregate = aggregateEvidenceSufficiency(result.assessments);
    assert.equal(aggregate.status, 'CONFLICTING_EVIDENCE');
    assert.equal(result.audit.task_type, 'evidence_support_assessment');
  });
});

test('unknown semantic observation remains unknown and does not become a business allow', async () => {
  await withGateway(async ({ port, key }) => {
    const requirement = { req_id: 'REQ-002', text: '系统应支持日志审计。' };
    const adapter = adaptRetrievalCandidate({
      requirement,
      candidate: { candidate_id: 'C-UNKNOWN' },
      sourceSpan: { source_span_id: 'SPAN-UNKNOWN', source_text: '无法判断。[[unknown]]' },
      material: { material_type: 'technical_solution', source_origin: 'enterprise_private' }
    });
    const result = await new SemanticGatewayEvidenceSupportEvaluator({ client: client(port, key) }).assess({ requirement, adapters: [adapter] });
    assert.equal(result.assessments[0].semantic_relationship, 'unknown');
    assert.equal(aggregateEvidenceSufficiency(result.assessments).status, 'ASSESSMENT_UNAVAILABLE');
  });
});

test('strict output validation rejects unsupported gateway fields', async () => {
  await withGateway(async ({ port, key }) => {
    const response = await fetch(`http://127.0.0.1:${port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: { task_type: 'not_registered', task_instruction: 'x', task_payload_json: '{}' } })
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error_code, 'TASK_UNSUPPORTED');
  });
});

test('provider schema violations are classified as OUTPUT_SCHEMA_INVALID', async () => {
  const key = 'gateway-schema-key';
  const server = createStandaloneGatewayServer({
    config: {
      apiKey: key,
      providerName: 'mock',
      provider: {
        model: 'fixture-invalid',
        async invoke() { return { data: { requirements: 'not-an-array' } }; }
      }
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error_code, 'OUTPUT_SCHEMA_INVALID');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('requirement candidate schema is strict at the Gateway boundary', async () => {
  const key = 'gateway-requirement-schema-key';
  const candidate = {
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  };
  for (const invalid of [
    { ...candidate, content: candidate.text },
    { ...candidate, mandatory_observed: 'true' },
    { ...candidate, source_text: candidate.text },
    (() => { const copy = { ...candidate }; delete copy.source_range; return copy; })()
  ]) {
    const server = createStandaloneGatewayServer({
      config: {
        apiKey: key,
        providerName: 'mock',
        provider: { model: 'fixture', async invoke() { return { data: { requirements: [invalid] } }; } }
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
      });
      assert.equal(response.status, 422);
      assert.equal((await response.json()).error_code, 'OUTPUT_SCHEMA_INVALID');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});

test('Gateway preserves only the five canonical Candidate v3 fields', async () => {
  const key = 'gateway-canonical-candidate-key';
  const candidate = {
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  };
  const server = createStandaloneGatewayServer({
    config: {
      apiKey: key,
      providerName: 'mock',
      provider: { model: 'fixture', async invoke() { return { data: { requirements: [candidate] } }; } }
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'ignored', task_payload_json: '{}' } })
    });
    assert.equal(response.status, 200);
    const envelope = JSON.parse((await response.json()).data.outputs.response_payload_json);
    assert.deepEqual(Object.keys(envelope.data.requirements[0]).sort(), [
      'category', 'mandatory_observed', 'requires_confirmation', 'source_range', 'text'
    ]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('probe-only diagnostics expose safe structure and validator details without raw content', async () => {
  const key = 'gateway-diagnostic-key';
  const provider = {
    model: 'fixture-invalid',
    async invoke() {
      const parsed = {
        requirements: [{
          text: '系统应提供审计日志。',
          category: 'technical',
          source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
          mandatory_observed: true,
          requires_confirmation: false,
          extra: 'must not be echoed'
        }]
      };
      return {
        data: parsed,
        provider_audit: {
          model: 'fixture-invalid',
          http_status: 200,
          json_parse_success: true,
          markdown_fence_present: false,
          provider_adapter_invoked: true,
          fetch_invoked: true,
          provider_http_reached: false,
          failure_stage: 'FETCH_INVOKED',
          safe_error_code: 'FETCH_FAILED',
          parsed_json: parsed
        }
      };
    }
  };
  const server = createStandaloneGatewayServer({ config: { apiKey: key, providerName: 'mock', provider } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-semantic-gateway-diagnostic': 'probe-v1' },
      body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
    });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error_code, 'OUTPUT_SCHEMA_INVALID');
    assert.equal(body.probe_diagnostics.json_parse_success, true);
    assert.equal(Object.hasOwn(body.probe_diagnostics, 'model_content'), false);
    assert.equal(Object.hasOwn(body.probe_diagnostics, 'parsed_json'), false);
    assert.equal(body.probe_diagnostics.structural_summary.available, true);
    assert.equal(body.probe_diagnostics.structural_summary.top_level_type, 'object');
    assert.deepEqual(body.probe_diagnostics.structural_summary.top_level_keys, ['requirements']);
    assert.equal(body.probe_diagnostics.structural_summary.requirements_present, true);
    assert.equal(body.probe_diagnostics.structural_summary.requirements_type, 'array');
    assert.equal(body.probe_diagnostics.structural_summary.requirements_count, 1);
    assert.deepEqual(body.probe_diagnostics.structural_summary.candidate_summaries[0].extra_keys, ['extra']);
    assert.equal(body.probe_diagnostics.structural_summary.candidate_summaries[0].text_empty, false);
    assert.equal(body.probe_diagnostics.schema_validation_errors.length, 1);
    assert.equal(body.probe_diagnostics.schema_validation_errors[0].validator_code, 'additionalProperties');
    assert.equal(body.probe_diagnostics.provider_adapter_invoked, true);
    assert.equal(body.probe_diagnostics.fetch_invoked, true);
    assert.equal(body.probe_diagnostics.provider_http_reached, false);
    assert.equal(body.probe_diagnostics.failure_stage, 'FETCH_INVOKED');
    assert.equal(body.probe_diagnostics.safe_error_code, 'FETCH_FAILED');
    assert.doesNotMatch(JSON.stringify(body), /must not be echoed|系统应提供审计日志/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Requirement Extraction probe diagnostics distinguish candidate schema failures safely', async () => {
  const key = 'gateway-requirement-diagnostic-key';
  const candidate = {
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  };
  const invalidCases = [
    {
      name: 'extra field',
      candidate: { ...candidate, content: candidate.text },
      validator: 'additionalProperties',
      path: 'data.requirements[0].content'
    },
    {
      name: 'missing field',
      candidate: (() => { const value = { ...candidate }; delete value.source_range; return value; })(),
      validator: 'required',
      path: 'data.requirements[0].source_range'
    },
    {
      name: 'wrong enum',
      candidate: { ...candidate, category: 'not-canonical' },
      validator: 'enum',
      path: 'data.requirements[0].category'
    },
    {
      name: 'wrong boolean',
      candidate: { ...candidate, mandatory_observed: 'true' },
      validator: 'type',
      path: 'data.requirements[0].mandatory_observed'
    },
    {
      name: 'legacy source clause field',
      candidate: { ...candidate, source_clause: 12 },
      validator: 'additionalProperties',
      path: 'data.requirements[0].source_clause'
    },
    {
      name: 'superseded source_refs field',
      candidate: { ...candidate, source_refs: ['C001-S001'] },
      validator: 'additionalProperties',
      path: 'data.requirements[0].source_refs'
    }
  ];
  for (const invalidCase of invalidCases) {
    const server = createStandaloneGatewayServer({
      config: {
        apiKey: key,
        providerName: 'mock',
        provider: { model: 'fixture', async invoke() { return { data: { requirements: [invalidCase.candidate] }, provider_audit: { parsed_json: { requirements: [invalidCase.candidate] } } }; } }
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-semantic-gateway-diagnostic': 'probe-v1' },
        body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
      });
      assert.equal(response.status, 422, invalidCase.name);
      const body = await response.json();
      const diagnostic = body.probe_diagnostics;
      assert.equal(body.error_code, 'OUTPUT_SCHEMA_INVALID', invalidCase.name);
      assert.equal(diagnostic.structural_summary.available, true, invalidCase.name);
      assert.equal(diagnostic.structural_summary.requirements_count, 1, invalidCase.name);
      assert.equal(diagnostic.schema_validation_errors.some(error => error.validator_code === invalidCase.validator && error.path === invalidCase.path), true, invalidCase.name);
      assert.doesNotMatch(JSON.stringify(diagnostic), /系统应提供审计日志|content代替/);
      assert.equal(Object.hasOwn(diagnostic, 'model_content'), false, invalidCase.name);
      assert.equal(Object.hasOwn(diagnostic, 'parsed_json'), false, invalidCase.name);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});

test('probe diagnostics explicitly mark structural summary unavailable when JSON is absent', async () => {
  const key = 'gateway-unavailable-structure-key';
  const server = createStandaloneGatewayServer({
    config: {
      apiKey: key,
      providerName: 'mock',
      provider: { model: 'fixture', async invoke() { throw Object.assign(new Error('invalid output'), { code: 'PROVIDER_OUTPUT_INVALID', provider_audit: { json_parse_success: false } }); } }
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-semantic-gateway-diagnostic': 'probe-v1' },
      body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
    });
    const body = await response.json();
    assert.equal(body.probe_diagnostics.structural_summary.available, false);
    assert.deepEqual(body.probe_diagnostics.structural_summary.candidate_summaries, []);
    assert.equal(Object.hasOwn(body.probe_diagnostics, 'model_content'), false);
    assert.equal(Object.hasOwn(body.probe_diagnostics, 'parsed_json'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('provider technical errors keep the controlled Gateway error code', async () => {
  const cases = [
    ['PROVIDER_UNAVAILABLE', 502],
    ['PROVIDER_TIMEOUT', 504],
    ['PROVIDER_OUTPUT_INVALID', 502],
    ['INTERNAL_GATEWAY_ERROR', 500]
  ];
  for (const [code, expectedStatus] of cases) {
    const key = `gateway-${code.toLowerCase()}`;
    const server = createStandaloneGatewayServer({
      config: {
        apiKey: key,
        providerName: 'mock',
        provider: {
          model: 'fixture-error',
          async invoke() { throw Object.assign(new Error('fixture provider failure'), { code }); }
        }
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ inputs: { task_type: 'requirement_extraction', task_instruction: 'x', task_payload_json: '{}' } })
      });
      assert.equal(response.status, expectedStatus);
      assert.equal((await response.json()).error_code, code);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }
});
