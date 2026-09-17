import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandaloneGatewayServer } from '../../services/semantic-gateway/src/gateway.js';
import {
  SemanticGatewayClient
} from '../src/pipeline/semantic-gateway-client.js';
import * as mappingEvaluator from '../src/pipeline/semantic-gateway-mapping-evaluator.js';
import { buildCanonicalFact } from '../eval/real-e2e/run-chengchuan-evidence-lane-downstream.mjs';

const HASH = 'a'.repeat(64);
const requirement = {
  requirement_id: 'REQ-G002',
  text: '系统应支持统一认证。',
  requirement_hash: HASH
};
const fact = {
  fact_id: 'EFACT-G002-1',
  subject: { type: 'project', name: '示范项目' },
  entities: [],
  fact_status: 'completed',
  scopes: [],
  quantities: [],
  validity: { status: 'unknown' }
};
const dimensions = {
  subject: 'match',
  scope: 'not_applicable',
  status: 'not_applicable',
  quantity: 'not_applicable',
  entity: 'not_applicable',
  validity: 'not_applicable'
};

function startGateway(config) {
  const server = createStandaloneGatewayServer({ config });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function closeGateway(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function mappingRequest(key = 'mapping-diagnostic-test-key') {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      inputs: {
        task_type: 'requirement_evidence_mapping',
        task_instruction: 'ignored by gateway task authority',
        task_payload_json: JSON.stringify({ facts: [{ fact_ref: fact.fact_id }], requirement: { requirement_id: requirement.requirement_id } })
      }
    })
  };
}

test('Gold fixture must pass the production Mapping input builder with deterministic identities', () => {
  assert.equal(typeof mappingEvaluator.buildMappingInput, 'function');
  const input = mappingEvaluator.buildMappingInput(requirement, [fact]);
  assert.equal(input.requirement.requirement_id, requirement.requirement_id);
  assert.equal(input.requirement.requirement_hash, requirement.requirement_hash);
  assert.equal(input.facts[0].fact_ref, fact.fact_id);
  assert.ok(input.facts.every(item => item.fact_ref));
  assert.doesNotThrow(() => JSON.stringify(input));
  assert.equal(Object.values(input).some(value => JSON.stringify(value).includes('undefined')), false);
});

test('Chengchuan Mapping fixture derives the frozen Evidence Fact identity from the anchor hash', () => {
  const materialId = '7dc70fee-13e0-4b7d-b95f-202665c241d0';
  const chunkId = 'MCH-369C7BBCDB79203D29F37E8A524E41D5';
  const chunkHash = '644ec25fde2d5afb4a7d6b59720c4e643f933e9bfa267417a52a565cf998b084';
  const fact = buildCanonicalFact({
    factReport: {
      cases: [{
        source_chunk_id: chunkId,
        canonicalization: [{
          grounding_decision: 'ACCEPT',
          canonical_output: {
            subject: { type: '产品', name: 'Synthetic产品' },
            entities: [{ type: '产品', name: 'Synthetic产品' }],
            status: 'unknown',
            scopes: ['接口'],
            quantities: [],
            validity: { status: 'unknown' }
          }
        }]
      }]
    },
    candidate: { source_chunk_id: chunkId, source_material_id: materialId, statement: 'fixture' },
    source: {
      material_id: materialId,
      material_type: 'product_documentation',
      original_name: 'fixture.md',
      source_hash: 'c9a0c64ef292dc57f753071c362147dd2e50b17be104815405a8507eeab3a120',
      anchor: { chunk_id: chunkId, chunk_hash: chunkHash, source_text: 'fixture' }
    }
  });
  assert.equal(fact.fact_id, 'EFACT-EVAL-30FE5146FFEF789D0D728A62A6C34DA6');
});

test('Gold production request is byte-equivalent to the evaluator request payload', async () => {
  const payloads = [];
  const evaluator = new mappingEvaluator.SemanticGatewayMappingEvaluator({
    client: {
      run: async request => {
        payloads.push(JSON.parse(request.task_payload_json));
        return {
          envelope: {
            data: {
              results: [{ fact_ref: fact.fact_id, decision: 'direct_full', dimensions }]
            }
          }
        };
      }
    }
  });
  await evaluator.evaluate({ requirement, facts: [fact] });
  assert.deepEqual(payloads, [mappingEvaluator.buildMappingInput(requirement, [fact])]);
});

test('Gateway preserves controlled Mapping semantic inconsistency code', async () => {
  const key = 'mapping-diagnostic-test-key';
  const server = await startGateway({
    apiKey: key,
    providerName: 'mock',
    provider: { model: 'fixture', async invoke() { throw Object.assign(new Error('known mapping semantic failure'), { code: 'MAPPING_SEMANTIC_INCONSISTENT' }); } }
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, mappingRequest(key));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error_code, 'MAPPING_SEMANTIC_INCONSISTENT');
    assert.doesNotMatch(JSON.stringify(body), /known mapping semantic failure/);
  } finally {
    await closeGateway(server);
  }
});

test('Provider HTTP success with invalid Mapping data returns controlled schema code without raw output', async () => {
  const key = 'mapping-schema-test-key';
  const server = await startGateway({
    apiKey: key,
    providerName: 'mock',
    provider: {
      model: 'fixture',
      async invoke() {
        return { data: { results: [{ fact_ref: fact.fact_id, decision: 'direct_full', dimensions: { ...dimensions, validity: undefined } }] } };
      }
    }
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, mappingRequest(key));
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.error_code, 'MAPPING_OUTPUT_SCHEMA_INVALID');
    assert.doesNotMatch(JSON.stringify(body), /fact_ref|fixture/);
  } finally {
    await closeGateway(server);
  }
});

test('Valid Mapping response passes the strict Gateway contract', async () => {
  const key = 'mapping-valid-test-key';
  const server = await startGateway({
    apiKey: key,
    providerName: 'mock',
    provider: {
      model: 'fixture',
      async invoke() {
        return { data: { results: [{ fact_ref: fact.fact_id, decision: 'direct_full', dimensions }] } };
      }
    }
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, mappingRequest(key));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(typeof body.data?.outputs?.response_payload_json, 'string');
    assert.doesNotMatch(JSON.stringify(body), /fixture|mapping-valid-test-key/);
  } finally {
    await closeGateway(server);
  }
});

test('Unknown Gateway exception remains INTERNAL_GATEWAY_ERROR', async () => {
  const key = 'mapping-unknown-test-key';
  const server = await startGateway({
    apiKey: key,
    providerName: 'mock',
    provider: { model: 'fixture', async invoke() { throw new Error('uncontrolled internal detail'); } }
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, mappingRequest(key));
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.error_code, 'INTERNAL_GATEWAY_ERROR');
    assert.doesNotMatch(JSON.stringify(body), /uncontrolled internal detail/);
  } finally {
    await closeGateway(server);
  }
});

test('Backend evaluator keeps the controlled Gateway cause_code', async () => {
  const client = new SemanticGatewayClient({
    apiBase: 'http://gateway.invalid',
    apiKey: 'test-only',
    user: 'mapping-diagnostic-test',
    fetchImpl: async () => new Response(JSON.stringify({
      error_code: 'MAPPING_SEMANTIC_INCONSISTENT',
      message: 'safe',
      request_id: 'mapping-cause-1'
    }), { status: 422, headers: { 'content-type': 'application/json' } })
  });
  const evaluator = new mappingEvaluator.SemanticGatewayMappingEvaluator({ client });
  await assert.rejects(
    () => evaluator.evaluate({ requirement, facts: [fact] }),
    error => error.code === 'MAPPING_SEMANTIC_FAILED'
      && error.details?.cause_code === 'MAPPING_SEMANTIC_INCONSISTENT'
  );
});

test('Mapping evaluator preserves bounded semantic consistency diagnostics from the Gateway', async () => {
  const key = 'mapping-probe-propagation-key';
  const inconsistentDimensions = {
    subject: 'match',
    scope: 'unknown',
    status: 'not_applicable',
    quantity: 'not_applicable',
    entity: 'not_applicable',
    validity: 'not_applicable'
  };
  const server = await startGateway({
    apiKey: key,
    providerName: 'mock',
    provider: {
      model: 'fixture',
      async invoke() {
        return {
          data: {
            results: [{
              fact_ref: fact.fact_id,
              decision: 'direct_full',
              dimensions: inconsistentDimensions
            }]
          },
          provider_audit: {
            model: 'fixture',
            outbound_prompt_diagnostics: {
              instruction_sha256: 'i'.repeat(64),
              instruction_char_count: 12,
              payload_sha256: 'p'.repeat(64),
              payload_char_count: 24,
              legacy_schema_tokens_observed: [],
              legacy_schema_positive_schema_context: false,
              contamination: false
            }
          }
        };
      }
    }
  });
  try {
    const client = new SemanticGatewayClient({
      apiBase: `http://127.0.0.1:${server.address().port}`,
      apiKey: key,
      user: 'mapping-probe-propagation-test'
    });
    const evaluator = new mappingEvaluator.SemanticGatewayMappingEvaluator({
      client,
      diagnosticMode: 'probe-v1'
    });
    await assert.rejects(
      () => evaluator.evaluate({ requirement, facts: [fact] }),
      error => {
        assert.equal(error.code, 'MAPPING_SEMANTIC_FAILED');
        assert.equal(error.details?.cause_code, 'MAPPING_SEMANTIC_INCONSISTENT');
        assert.equal(error.details?.provider_diagnostics?.gateway_http_status, 422);
        assert.equal(error.details?.provider_diagnostics?.semantic_error_code, 'MAPPING_SEMANTIC_INCONSISTENT');
        const probe = error.details?.provider_diagnostics?.probe_diagnostics;
        assert.equal(probe?.outbound_prompt_diagnostics?.payload_sha256, 'p'.repeat(64));
        assert.equal(probe?.schema_validation_errors?.[0]?.path, 'data.results[0].decision');
        assert.equal(probe?.schema_validation_errors?.[0]?.keyword, 'semanticConsistency');
        assert.deepEqual(probe?.mapping_semantic_diagnostic, {
          result_index: 0,
          response_keys: ['fact_ref', 'decision', 'dimensions'],
          parsed_semantic_fields: {
            decision: 'direct_full',
            dimensions: inconsistentDimensions
          },
          exact_failure_path: 'data.results[0].decision',
          consistency_rule: 'direct_full_requires_no_mismatch_or_unknown_dimension'
        });
        return true;
      }
    );
  } finally {
    await closeGateway(server);
  }
});

test('Mapping evaluator honors a one-call canary cap', async () => {
  let calls = 0;
  const client = {
    async run() {
      calls += 1;
      return {
        envelope: {
          data: {
            results: [{
              fact_ref: fact.fact_id,
              decision: 'direct_full',
              dimensions: { ...dimensions, scope: 'unknown' }
            }]
          }
        }
      };
    }
  };
  const evaluator = new mappingEvaluator.SemanticGatewayMappingEvaluator({
    client,
    maxAttempts: 1
  });
  await assert.rejects(
    () => evaluator.evaluate({ requirement, facts: [fact] }),
    error => error.code === 'MAPPING_SEMANTIC_INCONSISTENT'
  );
  assert.equal(calls, 1);
});
