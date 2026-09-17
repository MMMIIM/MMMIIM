import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_FACT_TRANSPORT_SCHEMA,
  EVIDENCE_FACT_TRANSPORT_SCHEMA_SHA256,
  getSemanticTaskContract,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import { createEvidenceFactContract } from '../src/pipeline/evidence-fact-contract-v1.js';
import { projectEvidenceFactTransportCandidate } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';

const SOURCE = '系统覆盖6238名用户，范围包括核心平台，服务有效期至2027-12-31。';
const CONTEXT = {
  project_id: '11111111-1111-4111-8111-111111111111',
  review_id: 'EREVIEW-TRANSPORT-1',
  source_span_id: 'ESPAN-TRANSPORT-1',
  material_id: '22222222-2222-4222-8222-222222222222',
  anchor_chunk_id: 'MCH-TRANSPORT-1',
  source_text: SOURCE,
  source_text_hash: createHash('sha256').update(SOURCE).digest('hex')
};

const validTransportFact = () => ({
  subject_type: 'system',
  subject_name: '系统',
  entities: [{ type: 'system', name: '系统', identifier: null }],
  status: 'unknown',
  status_source_text: null,
  scopes: [{ value: 'core_platform', source_text: '核心平台' }],
  quantities: [{
    metric: 'user_count',
    value: 6238,
    unit: '用户',
    source_text: '覆盖6238名用户',
    conditions: [{ name: 'scope', value: '6238' }]
  }],
  validity: { status: 'known', valid_from: null, valid_until: '2027-12-31' },
  domain_metadata: {}
});

test('transport schema is the registered Fact provider schema', () => {
  const contract = getSemanticTaskContract('evidence_fact_extraction');
  assert.equal(contract.data_schema.properties.facts.items, EVIDENCE_FACT_TRANSPORT_SCHEMA);
  assert.match(EVIDENCE_FACT_TRANSPORT_SCHEMA_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(EVIDENCE_FACT_TRANSPORT_SCHEMA.additionalProperties, false);
});

test('ST-01 numeric quantity projects to canonical exact decimal text', () => {
  const transport = validTransportFact();
  const validated = validateTaskData('evidence_fact_extraction', { facts: [transport] }, { source_text: SOURCE });
  const candidate = projectEvidenceFactTransportCandidate(validated.facts[0], { sourceText: SOURCE });
  const fact = createEvidenceFactContract(CONTEXT, candidate, { extractorVersion: 'transport-v2' });
  assert.equal(fact.quantities[0].value, '6238');
  assert.deepEqual(fact.scopes, ['core_platform']);
  assert.deepEqual(fact.scope_source_texts, undefined);
});

test('ST-02 missing metric is rejected without guessing', () => {
  const transport = validTransportFact();
  delete transport.quantities[0].metric;
  assert.throws(() => validateTaskData('evidence_fact_extraction', { facts: [transport] }, { source_text: SOURCE }), /metric/);
});

test('ST-03 legacy context alias and ST-07 valid_to are rejected', () => {
  const transport = validTransportFact();
  transport.quantities[0].context = 'user_count';
  assert.throws(() => validateTaskData('evidence_fact_extraction', { facts: [transport] }, { source_text: SOURCE }), /unsupported fields|context/);
  const withoutContext = validTransportFact();
  withoutContext.validity.valid_to = '2027-12-31';
  assert.throws(() => validateTaskData('evidence_fact_extraction', { facts: [withoutContext] }, { source_text: SOURCE }), /unsupported fields|valid_to/);
});

test('ST-04 inline scopes project with source quotes and ST-05 conflicts fail closed', () => {
  const transport = validTransportFact();
  const candidate = projectEvidenceFactTransportCandidate(transport, { sourceText: SOURCE });
  assert.deepEqual(candidate.scopes, ['core_platform']);
  assert.deepEqual(candidate.scope_source_texts, { core_platform: '核心平台' });
  const conflict = validTransportFact();
  conflict.scopes.push({ value: 'core_platform', source_text: '系统' });
  assert.throws(() => projectEvidenceFactTransportCandidate(conflict, { sourceText: SOURCE }), /duplicate|conflict/i);
});

test('ST-06 known status requires grounded non-empty status quote', () => {
  const transport = validTransportFact();
  transport.status = 'verified';
  transport.status_source_text = '系统已验证';
  const statusSource = `${SOURCE}系统已验证。`;
  const statusHash = createHash('sha256').update(statusSource).digest('hex');
  const statusContext = { ...CONTEXT, source_text: statusSource, source_text_hash: statusHash };
  assert.doesNotThrow(() => createEvidenceFactContract(statusContext, projectEvidenceFactTransportCandidate(transport, { sourceText: statusSource }), { extractorVersion: 'transport-v2' }));
  const emptyQuote = { ...transport, status_source_text: '' };
  assert.throws(() => createEvidenceFactContract(statusContext, projectEvidenceFactTransportCandidate(emptyQuote, { sourceText: statusSource }), { extractorVersion: 'transport-v2' }), /status_source_text/);
});

test('ST-08 entities remain object-shaped and string entities are rejected', () => {
  const transport = validTransportFact();
  transport.entities = ['系统'];
  assert.throws(() => validateTaskData('evidence_fact_extraction', { facts: [transport] }), /object|entities/);
  const valid = validTransportFact();
  assert.doesNotThrow(() => validateTaskData('evidence_fact_extraction', { facts: [valid] }, { source_text: SOURCE }));
});

test('canonical Fact shape remains subject object with unchanged lifecycle', () => {
  const candidate = projectEvidenceFactTransportCandidate(validTransportFact(), { sourceText: SOURCE });
  const fact = createEvidenceFactContract(CONTEXT, candidate, { extractorVersion: 'transport-v2' });
  assert.deepEqual(fact.subject, { type: 'system', name: '系统' });
  assert.equal(fact.review_status, 'draft');
  assert.equal(fact.extractor_type, 'machine');
  assert.equal(fact.source_span_id, CONTEXT.source_span_id);
  assert.equal(fact.material_id, CONTEXT.material_id);
});
