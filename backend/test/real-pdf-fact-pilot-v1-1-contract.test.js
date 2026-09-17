import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFactTransportCandidate,
  splitSemanticWindowAtChunkBoundary,
  classifyEnterpriseFactCandidate,
  classifyFactExtractionResult
} from '../eval/real-enterprise-upload-test-v1/fact-pilot-v1-1-helpers.mjs';
import { createSemanticTaskRouter } from '../../services/semantic-gateway/src/task-router.js';

const SOURCE = '华为平台支持 100 用户并提供统一架构指导。';

function transportFact(overrides = {}) {
  return {
    subject_type: 'service',
    subject_name: '华为平台',
    entities: [],
    status: 'unknown',
    scopes: [{ value: '平台', source_text: '平台' }],
    quantities: [{ metric: 'users', value: '100', unit: '用户', source_text: '100 用户' }],
    validity: { status: 'unknown', valid_from: null, valid_until: null },
    domain_metadata: {},
    ...overrides
  };
}

test('nested provider source_text is removed from the transport projection, while arbitrary fields remain visible', () => {
  const result = normalizeFactTransportCandidate(transportFact({
    scopes: [{ value: '平台', source_text: '平台' }],
    quantities: [{ metric: 'users', value: '100', unit: '用户', source_text: '100 用户' }]
  }));
  assert.equal(result.candidate.scopes[0].source_text, undefined);
  assert.equal(result.candidate.quantities[0].source_text, undefined);
  assert.deepEqual(result.removed_property_names, ['quantities[0].source_text', 'scopes[0].source_text']);
  const unknown = normalizeFactTransportCandidate(transportFact({ provider_noise: true }));
  assert.equal(unknown.candidate.provider_noise, true);
});

test('pure numeric strings are safely normalized without changing their value', () => {
  const result = normalizeFactTransportCandidate(transportFact());
  assert.equal(result.candidate.quantities[0].value, 100);
});

test('qualified numeric strings are never coerced to bare numbers', () => {
  assert.throws(() => normalizeFactTransportCandidate(transportFact({
    quantities: [{ metric: 'users', value: '不少于100', unit: '用户' }]
  })), /qualified|decimal|quantity/i);
});

test('empty optional quantity units are rejected rather than fabricated', () => {
  assert.throws(() => normalizeFactTransportCandidate(transportFact({
    quantities: [{ metric: 'users', value: 100, unit: '' }]
  })), /unit/i);
});

test('valid facts=[] is classified as successful empty completion', () => {
  assert.deepEqual(classifyFactExtractionResult({ facts: [] }), {
    status: 'SUCCESS_EMPTY',
    fact_count: 0
  });
});

test('generic technical guidance is not an enterprise fact', () => {
  assert.equal(classifyEnterpriseFactCandidate({
    sourceText: '本白皮书介绍云平台的通用架构、容灾方法和行业最佳实践。',
    candidate: { subject: { type: 'capability', name: '云平台' } }
  }).classification, 'REFERENCE_KNOWLEDGE_REJECTED');
});

test('explicit enterprise capability attribution is an enterprise fact candidate', () => {
  assert.equal(classifyEnterpriseFactCandidate({
    sourceText: '华为云为客户提供统一身份认证服务，支持 LDAP 接入。',
    candidate: { subject: { type: 'capability', name: '统一身份认证服务' } }
  }).classification, 'REAL_ENTERPRISE_FACT_CANDIDATE');
});

test('truncated semantic windows split exactly at existing chunk boundaries', () => {
  const window = {
    window_id: 'SW-1',
    split_depth: 0,
    source_text: 'abcdef',
    included_chunk_ids: ['c1', 'c2', 'c3'],
    chunks: [
      { chunk_id: 'c1', char_start: 0, char_end: 2, source_text: 'ab' },
      { chunk_id: 'c2', char_start: 2, char_end: 4, source_text: 'cd' },
      { chunk_id: 'c3', char_start: 4, char_end: 6, source_text: 'ef' }
    ]
  };
  const children = splitSemanticWindowAtChunkBoundary(window);
  assert.equal(children.length, 2);
  assert.deepEqual(children.map(child => child.source_text), ['abcd', 'ef']);
  assert.deepEqual(children.map(child => child.included_chunk_ids), [['c1', 'c2'], ['c3']]);
  assert.deepEqual(children.map(child => child.split_depth), [1, 1]);
});

test('Gateway strips only known nested quote metadata before strict validation', async () => {
  const router = createSemanticTaskRouter({
    provider: { invoke: async () => ({ data: { facts: [transportFact()] } }) }
  });
  const result = await router.dispatch({ taskType: 'evidence_fact_extraction', payload: { source_text: SOURCE } });
  assert.equal(result.data.facts[0].scopes[0].source_text, undefined);
  assert.equal(result.data.facts[0].quantities[0].source_text, undefined);
  assert.deepEqual(result.provider_audit.fact_normalization_diagnostic.removed_property_names, [
    'quantities[0].source_text', 'scopes[0].source_text'
  ]);
});

test('Gateway keeps arbitrary unknown fields fail-closed', async () => {
  const router = createSemanticTaskRouter({
    provider: { invoke: async () => ({ data: { facts: [transportFact({ provider_noise: true })] } }) }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_extraction', payload: { source_text: SOURCE } }),
    error => error.provider_audit?.fact_semantic_diagnostic?.unknown_fields?.includes('provider_noise')
  );
});
