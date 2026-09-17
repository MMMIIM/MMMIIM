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

test('evidence fact extraction dispatch uses the canonical strict Fact candidate schema', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { facts: [] }, provider_audit: {} };
      }
    }
  });
  await router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} });
  const contract = getSemanticTaskContract('evidence_fact_extraction');
  assert.equal(invocation.response_format.type, 'json_schema');
  assert.equal(invocation.response_format.json_schema.name, 'evidence_fact_extraction_data');
  assert.equal(invocation.response_format.json_schema.strict, true);
  assert.equal(invocation.response_format.json_schema.schema, contract.data_schema);
});

test('evidence fact corrective feedback is bounded and appended only for the Fact task', async () => {
  let factInvocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        if (input.taskType === 'evidence_fact_extraction') factInvocation = input;
        return { data: { facts: [] }, provider_audit: {} };
      }
    }
  });
  await router.dispatch({
    taskType: 'evidence_fact_extraction',
    payload: {
      validation_feedback: {
        path: 'data.facts[0].entities',
        keyword: 'type',
        expected: 'array',
        actual_type: 'string',
        additional_property: 'ignored?\nno',
        arbitrary_instruction: 'must not be included'
      }
    }
  });
  assert.match(factInvocation.instruction, /data\.facts\[0\]\.entities/);
  assert.match(factInvocation.instruction, /expected=array/);
  assert.doesNotMatch(factInvocation.instruction, /arbitrary_instruction|must not be included/);
  assert.equal(factInvocation.response_format.type, 'json_schema');
  assert.equal(factInvocation.response_format.json_schema.strict, true);
  assert.equal(Object.hasOwn(factInvocation.payload.validation_feedback, 'arbitrary_instruction'), false);
});

test('unrelated task ignores fact corrective feedback', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { response_plans: [] }, provider_audit: {} };
      }
    }
  });
  await router.dispatch({
    taskType: 'response_planning',
    payload: {
      validation_feedback: {
        path: 'data.facts[0].entities', keyword: 'type', expected: 'array', actual_type: 'string'
      }
    }
  });
  assert.doesNotMatch(invocation.instruction, /previous Fact extraction response/);
});

test('evidence fact extraction rejects unknown top-level candidate fields and records a safe diagnostic', async () => {
  const fact = {
    subject_type: 'product',
    subject_name: '平台',
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {},
    explanation: 'non-authoritative rationale'
  };
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        return { data: { facts: [fact] }, provider_audit: { provider: 'fixture' } };
      }
    }
  });

  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID'
      && error.additionalProperty === 'explanation'
      && error.provider_audit.fact_semantic_diagnostic.diagnostic === 'FACT_SEMANTIC_UNKNOWN_FIELDS_REJECTED'
  );
});

test('evidence fact validation exposes the exact rejected top-level field', async () => {
  const fact = {
    subject_type: 'product',
    subject_name: '平台',
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {},
    explanation: 'not authoritative'
  };
  const router = createSemanticTaskRouter({
    provider: { async invoke() { return { data: { facts: [fact] }, provider_audit: {} }; } }
  });

  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID'
      && error.additionalProperty === 'explanation'
      && error.validation_diagnostics?.some(item => item.additional_property === 'explanation')
  );
});

test('evidence fact extraction rejects legacy and unexpected fields instead of silently projecting them', async () => {
  const baseFact = {
    subject_type: 'product',
    subject_name: '平台',
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {}
  };
  for (const [field, value] of [
    ['entity_type', 'service'],
    ['valid_to', '2030-01-01'],
    ['subject', { type: 'product', name: '平台' }],
    ['explanation', 'not authoritative']
  ]) {
    const router = createSemanticTaskRouter({
      provider: { async invoke() { return { data: { facts: [{ ...baseFact, [field]: value }] }, provider_audit: {} }; } }
    });
    await assert.rejects(
      () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
      error => error.code === 'OUTPUT_SCHEMA_INVALID'
        && error.validation_diagnostics?.some(item => item.keyword === 'additionalProperties'),
      field
    );
  }
});

test('nested subject is not accepted as a compatibility input', async () => {
  const legacyFact = {
    subject: { type: 'product', name: '平台' },
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {}
  };
  const router = createSemanticTaskRouter({
    provider: { async invoke() { return { data: { facts: [legacyFact] }, provider_audit: {} }; } }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID'
      && error.additionalProperty === 'subject'
      && error.validation_diagnostics?.some(item => item.path === 'data.facts[0]' && item.additional_property === 'subject')
  );
});

test('evidence fact extraction rejects malformed semantic candidates before persistence boundary', async () => {
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        return { data: { facts: [{ subject_type: '', subject_name: '平台', entities: [], status: 'unknown', scopes: [], quantities: [], validity: { status: 'unknown' }, domain_metadata: {} }] }, provider_audit: {} };
      }
    }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID'
  );
});

test('evidence fact schema failures expose safe field-level diagnostics', async () => {
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        return {
            data: {
            facts: [{
              subject_type: 'product',
              subject_name: '平台',
              entities: '平台',
              status: 'unknown',
              scopes: [],
              quantities: [],
              validity: { status: 'unknown' },
              domain_metadata: {}
            }]
          },
          provider_audit: {}
        };
      }
    }
  });

  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => {
      assert.equal(error.code, 'OUTPUT_SCHEMA_INVALID');
      const [diagnostic] = error.validation_diagnostics;
      assert.deepEqual({
        path: diagnostic.path,
        keyword: diagnostic.keyword,
        expected: diagnostic.expected,
        actual_type: diagnostic.actual_type
      }, {
        path: 'data.facts[0].entities',
        keyword: 'type',
        expected: 'array',
        actual_type: 'string'
      });
      return true;
    }
  );
});

test('evidence fact projection never repairs known type, missing field, or metadata failures', async () => {
  const baseFact = {
    subject_type: 'product',
    subject_name: '平台',
    entities: [],
    status: 'unknown',
    scopes: [],
    quantities: [],
    validity: { status: 'unknown' },
    domain_metadata: {}
  };
  const cases = [
    {
      name: 'known type',
      fact: { ...baseFact, entities: '平台' },
      path: 'data.facts[0].entities'
    },
    {
      name: 'missing required',
      fact: (() => { const value = { ...baseFact }; delete value.subject_type; return value; })(),
      path: 'data.facts[0].subject_type'
    },
    {
      name: 'invalid metadata',
      fact: { ...baseFact, domain_metadata: { capability: 'RBAC' } },
      path: 'data.facts[0].domain_metadata'
    }
  ];
  for (const invalidCase of cases) {
    const router = createSemanticTaskRouter({
      provider: { async invoke() { return { data: { facts: [invalidCase.fact] }, provider_audit: {} }; } }
    });
    await assert.rejects(
      () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
      error => error.code === 'OUTPUT_SCHEMA_INVALID'
        && error.validation_diagnostics?.some(item => item.path === invalidCase.path),
      invalidCase.name
    );
  }
});
