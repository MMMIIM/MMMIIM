import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import {
  buildEvidenceFactCandidateV2SemanticInput,
  SemanticGatewayEvidenceFactExtractor
} from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  createEvidenceFactSourceSnapshot,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2
} from '../src/pipeline/evidence-fact-candidate-v2.js';
import { classifyEnterpriseFactCandidate } from '../eval/real-enterprise-upload-test-v1/fact-pilot-v1-1-helpers.mjs';

const sourceText = '澄川平台支持不少于100个用户，约在2026年底完成部署。';
const sourceRef = 'S001';
const snapshot = createEvidenceFactSourceSnapshot({
  snapshot_id: 'snap-1',
  material_id: 'm1',
  material_version: 'v1',
  source_hash: 'source-sha',
  chunk_id: 'c1',
  chunk_hash: 'chunk-sha',
  source_span_id: 'span-1',
  source_span_hash: 'span-sha',
  segments: [{ source_ref: sourceRef, text: sourceText }]
});
const baseFact = {
  statement: sourceText,
  source_refs: [sourceRef],
  subject_name: '澄川平台',
  subject_type_hint: 'product',
  subject_source_refs: [sourceRef],
  entity_mentions: [{ name: '澄川平台', type_hint: 'product', source_refs: [sourceRef] }],
  status_text: '',
  status_source_refs: [],
  scope_items: [],
  quantity_items: [{ name: '用户数', value_text: '不少于100', unit_text: '用户', condition_text: '', source_refs: [sourceRef] }],
  temporal_items: [{ value_text: '2026年底', event_text: '完成部署', source_refs: [sourceRef] }]
};

function context() {
  const hash = createHash('sha256').update(sourceText).digest('hex');
  return {
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    source_text: sourceText,
    source_text_hash: hash,
    current_source_text_hash: hash,
    project_id: 'p1', review_id: 'r1', source_span_id: 'span-1', material_id: 'm1'
  };
}

test('Candidate V2 model-facing schema is fixed-shape source-ref-only', () => {
  assert.equal(EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION, '4.3-evidence-fact-candidate-v2');
  const properties = EVIDENCE_FACT_CANDIDATE_V2_SCHEMA.properties.facts.items.properties;
  assert.equal(Object.hasOwn(properties, 'source_text'), false);
  assert.equal(Object.hasOwn(properties, 'domain_metadata'), false);
  assert.deepEqual(properties.quantity_items.items.required, ['name', 'value_text', 'unit_text', 'condition_text', 'source_refs']);
  assert.deepEqual(properties.temporal_items.items.required, ['value_text', 'event_text', 'source_refs']);
});

test('Candidate V2 uses a numbered snapshot in its semantic input', () => {
  const payload = buildEvidenceFactCandidateV2SemanticInput(context(), { sourceSnapshot: snapshot });
  assert.deepEqual(Object.keys(payload).sort(), ['material', 'source_segments', 'source_snapshot_id']);
  assert.equal(payload.source_segments[0].source_ref, sourceRef);
  assert.equal(payload.source_segments[0].text, sourceText);
});

for (const value of ['不少于100', '3-5', '约100', '99.99%', '>1000公里']) {
  test(`qualified quantity ${value} remains valid Candidate V2 text`, () => {
    const candidate = structuredClone(baseFact);
    candidate.quantity_items[0].value_text = value;
    assert.doesNotThrow(() => validateTaskData('evidence_fact_candidate_v2', { facts: [candidate] }));
    const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceSnapshot: snapshot });
    assert.ok(['CANONICALIZED', 'CANONICALIZATION_REVIEW_REQUIRED'].includes(result.status));
  });
}

test('unknown and foreign source refs fail closed before canonicalization', () => {
  const unknown = structuredClone(baseFact);
  unknown.source_refs = ['S999'];
  const unknownResult = canonicalizeEvidenceFactCandidateV2(unknown, { sourceSnapshot: snapshot });
  assert.equal(unknownResult.status, 'REJECTED');
  assert.match(unknownResult.review_reasons[0], /unknown source_ref/);

  const foreign = structuredClone(baseFact);
  foreign.entity_mentions[0].source_refs = ['S002'];
  const foreignResult = canonicalizeEvidenceFactCandidateV2(foreign, { sourceSnapshot: snapshot });
  assert.equal(foreignResult.status, 'REJECTED');
});

test('generic technical knowledge is not enterprise Fact while explicit attribution is candidate-eligible', () => {
  const generic = classifyEnterpriseFactCandidate({
    sourceText: 'Raft协议通过多数派实现一致性。',
    candidate: { statement: 'Raft协议通过多数派实现一致性。', subject: { name: 'Raft协议' } }
  });
  assert.notEqual(generic.classification, 'ENTERPRISE_FACT_CANDIDATE');
  const explicit = classifyEnterpriseFactCandidate({
    sourceText: '我司平台支持统一身份认证。',
    candidate: { statement: '我司平台支持统一身份认证。', subject: { name: '我司平台' } }
  });
  assert.equal(explicit.classification, 'REAL_ENTERPRISE_FACT_CANDIDATE');
});

test('valid facts=[] is successful Candidate V2 extraction with no retry', async () => {
  let calls = 0;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { async run() { calls += 1; return { envelope: { data: { facts: [] } }, audit: { probe_diagnostics: {} } }; } }
  });
  const facts = await extractor.extractCandidateV2(context(), { sourceSnapshot: snapshot });
  assert.deepEqual(facts, []);
  assert.equal(calls, 1);
});

test('source-ref Candidate V2 canonicalizes through Backend snapshot and grounding', () => {
  const candidate = structuredClone(baseFact);
  candidate.quantity_items[0].value_text = '100';
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceSnapshot: snapshot });
  assert.ok(['CANONICALIZED', 'CANONICALIZATION_REVIEW_REQUIRED'].includes(result.status));
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText });
  assert.notEqual(grounded.decision, 'REJECT');
  assert.equal(result.canonical.quantities[0].metric, '用户数');
});
