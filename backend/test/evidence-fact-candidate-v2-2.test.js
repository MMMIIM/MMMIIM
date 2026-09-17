import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
  getSemanticTaskInstructionMetadata,
  getSemanticTaskContract,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import {
  SemanticGatewayEvidenceFactExtractor
} from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { parseSemanticGatewayConfig } from '../src/pipeline/semantic-gateway-client.js';
import {
  classifyEnterpriseFactCandidateV22,
  splitSemanticWindowIntoIndividualChunks,
  splitProductionChunkIntoAtomicSegments,
  buildAtomicFactExtractionWindow,
  deduplicateExactAtomicCandidates
} from '../eval/real-enterprise-upload-test-v1/fact-pilot-v1-1-helpers.mjs';

const sourceSnapshot = {
  snapshot_id: 'SNAP-V22',
  segments: [{ source_ref: 'snapshot://m/w/chunk-001', text: 'Huawei Cloud provides a storage service.' }]
};

const candidate = {
  statement: 'Huawei Cloud provides a storage service.',
  source_refs: ['S001'],
  subject_name: 'Huawei Cloud',
  subject_type_hint: 'service',
  subject_source_refs: ['S001'],
  entity_mentions: [{ name: 'Huawei Cloud', type_hint: 'service', source_refs: ['S001'] }],
  status_text: '',
  status_source_refs: [],
  scope_items: [],
  quantity_items: [],
  temporal_items: []
};

test('Candidate V2.2 is an opt-in enterprise-evidence contract with the V2.1 schema', () => {
  assert.equal(EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION, '4.3-evidence-fact-candidate-v2.2');
  assert.equal(EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION, '4.3-evidence-fact-candidate-v2.2-prompt-v1');
  assert.strictEqual(EVIDENCE_FACT_CANDIDATE_V22_SCHEMA, EVIDENCE_FACT_CANDIDATE_V21_SCHEMA);
  assert.equal(EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256, EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256);
  assert.equal(getSemanticTaskContract('evidence_fact_candidate_v2_2').eval_only, true);
  assert.equal(getSemanticTaskContract('evidence_fact_candidate_v2_2').opt_in_only, true);
  assert.match(getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_2').instruction, /企业证据事实/);
});

test('Candidate V2.2 strict transport remains fixed-shape and rejects unknown fields', () => {
  assert.deepEqual(validateTaskData('evidence_fact_candidate_v2_2', { facts: [candidate] }), { facts: [candidate] });
  const invalid = structuredClone(candidate);
  invalid.unknown_field_xyz = 'provider-noise';
  assert.throws(() => validateTaskData('evidence_fact_candidate_v2_2', { facts: [invalid] }), /additional|unsupported|unknown/i);
});

test('Candidate V2.2 extractor dispatches its own task and preserves provider-off metadata', async () => {
  const calls = [];
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run(input) {
        calls.push(input);
        return { envelope: { data: { facts: [candidate] } }, audit: { probe_diagnostics: { provider: 'deepseek_official', model: 'deepseek-v4-pro' } } };
      }
    }
  });
  const facts = await extractor.extractCandidateV22({
    project_id: 'p1', review_id: 'r1', review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1',
    source_span_id: 'span-1', material_id: 'm1', material_type: 'product_documentation',
    source_text: sourceSnapshot.segments[0].text,
    source_text_hash: createHash('sha256').update(sourceSnapshot.segments[0].text).digest('hex'),
    current_source_text_hash: createHash('sha256').update(sourceSnapshot.segments[0].text).digest('hex')
  }, { sourceSnapshot });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].task_type, 'evidence_fact_candidate_v2_2');
  assert.equal(facts.length, 1);
});

test('Candidate V2.2 uses the canonical Semantic Gateway task configuration path', () => {
  const config = parseSemanticGatewayConfig({
    SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
    SEMANTIC_GATEWAY_API_KEY: 'service-key',
    SEMANTIC_GATEWAY_USER: 'eval-user',
    SEMANTIC_GATEWAY_EVIDENCE_FACT_TIMEOUT_MS: '120000'
  }, { taskType: 'evidence_fact_candidate_v2_2' });
  assert.equal(config.configuredTaskType, 'evidence_fact_candidate_v2_2');
  assert.equal(config.config_source, 'canonical_semantic_gateway');
  assert.equal(config.taskTimeouts.evidence_fact_candidate_v2_2, 120000);
});

test('V2.2 attribution accepts explicit enterprise relation from the cited span', () => {
  const result = classifyEnterpriseFactCandidateV22({ candidate, citedSourceText: sourceSnapshot.segments[0].text, enterpriseNames: ['Huawei'], enterpriseId: 'H1' });
  assert.equal(result.classification, 'REAL_ENTERPRISE_FACT_CANDIDATE');
  assert.equal(result.enterprise_id, 'H1');
});

test('V2.2 attribution rejects generic/reference knowledge and foreign identity promotion', () => {
  const generic = classifyEnterpriseFactCandidateV22({
    candidate: { ...candidate, statement: 'A layered architecture improves resilience.', subject_name: 'architecture' },
    citedSourceText: 'A layered architecture improves resilience.', enterpriseNames: ['Huawei']
  });
  assert.equal(generic.classification, 'REFERENCE_KNOWLEDGE_REJECTED');

  const foreign = classifyEnterpriseFactCandidateV22({
    candidate: { ...candidate, statement: '我司提供该服务。', subject_name: '该服务' },
    citedSourceText: 'Foreign Corp provides this service.', enterpriseNames: ['Huawei']
  });
  assert.equal(foreign.classification, 'REFERENCE_KNOWLEDGE_REJECTED');
});

test('V2.2 ambiguous ownership and unsupported strong facts remain review/rejected', () => {
  const ambiguous = classifyEnterpriseFactCandidateV22({
    candidate: { ...candidate, statement: 'Huawei SLA is 99.99%.', subject_name: 'SLA' },
    citedSourceText: 'Huawei technical context mentions an SLA of 99.99%.', enterpriseNames: ['Huawei']
  });
  assert.equal(ambiguous.classification, 'REFERENCE_KNOWLEDGE_REJECTED');

  const unsupported = classifyEnterpriseFactCandidateV22({
    candidate: { ...candidate, statement: 'Huawei provides a product.' }, citedSourceText: 'The product is described here without the vendor name.', enterpriseNames: ['Huawei']
  });
  assert.equal(unsupported.classification, 'REVIEW_REQUIRED');
});

test('V2.2 blocks lineage-only external outcomes without rejecting owned product facts', () => {
  const externalCommunity = classifyEnterpriseFactCandidateV22({
    candidate: {
      ...candidate,
      statement: '在巴西一个偏远社区，开通网络后，3,000多名居民开始享受在线医疗和教育服务。',
      subject_name: '巴西一个偏远社区',
      subject_type_hint: '社区',
      entity_mentions: [{ name: '巴西一个偏远社区', type_hint: '社区', source_refs: ['S001'] }]
    },
    citedSourceText: '华为提供网络连接和服务，帮助巴西一个偏远社区改善公共服务。',
    enterpriseNames: ['华为']
  });
  assert.equal(externalCommunity.classification, 'REFERENCE_KNOWLEDGE_REJECTED');
  assert.equal(externalCommunity.reason, 'lineage_only_external_outcome');

  const ownedProduct = classifyEnterpriseFactCandidateV22({
    candidate: {
      ...candidate,
      statement: '鸿蒙开发者超过720万，生态设备超10亿台。',
      subject_name: '鸿蒙',
      subject_type_hint: '产品',
      entity_mentions: [{ name: '鸿蒙', type_hint: '产品', source_refs: ['S001'] }]
    },
    citedSourceText: '华为持续建设鸿蒙生态，鸿蒙开发者超过720万，生态设备超10亿台。',
    enterpriseNames: ['华为']
  });
  assert.equal(ownedProduct.classification, 'REAL_ENTERPRISE_FACT_CANDIDATE');
});

test('terminal V2.2 partition keeps exact production chunk boundaries', () => {
  const window = {
    window_id: 'SW-1', split_depth: 2, start_offset: 0, end_offset: 6, source_text: 'abcdef',
    chunks: [
      { chunk_id: 'c1', char_start: 0, char_end: 2, source_text: 'ab' },
      { chunk_id: 'c2', char_start: 2, char_end: 4, source_text: 'cd' },
      { chunk_id: 'c3', char_start: 4, char_end: 6, source_text: 'ef' }
    ], included_chunk_ids: ['c1', 'c2', 'c3']
  };
  const children = splitSemanticWindowIntoIndividualChunks(window);
  assert.deepEqual(children.map(child => child.included_chunk_ids), [['c1'], ['c2'], ['c3']]);
  assert.deepEqual(children.map(child => child.source_text), ['ab', 'cd', 'ef']);
  assert.ok(children.every(child => child.terminal_single_chunk === true && child.split_depth === 2));
});

test('atomic segmenter preserves paragraph, bullet, table, heading context and offsets', () => {
  const text = '能力说明\n\n- 支持统一认证\n- 支持审计\n\n指标\n名称|值\n吞吐|1000';
  const chunk = { chunk_id: 'parent-1', material_id: 'm1', document_id: 'd1', char_start: 100, source_text: text, page_start: 3, page_end: 3, source_hash: 'h' };
  const segments = splitProductionChunkIntoAtomicSegments(chunk);
  assert.ok(segments.some(segment => segment.boundary_type === 'bullet'));
  assert.ok(segments.some(segment => segment.boundary_type === 'table_row'));
  assert.ok(segments.some(segment => segment.heading_context === '指标'));
  assert.equal(segments[0].start_offset, 100);
  assert.ok(segments.every(segment => segment.end_offset > segment.start_offset));
});

test('atomic segment window retains parent chunk lineage and deterministic source alias boundary', () => {
  const window = {
    window_id: 'SW-ATOMIC', split_depth: 2, source_text: '标题\n正文。', start_offset: 0, end_offset: 9,
    chunks: [{ chunk_id: 'parent-1', material_id: 'm1', document_id: 'd1', char_start: 50, char_end: 59, source_text: '标题\n正文。', page_start: 2, page_end: 2 }],
    included_chunk_ids: ['parent-1']
  };
  const segment = splitProductionChunkIntoAtomicSegments(window.chunks[0])[0];
  const child = buildAtomicFactExtractionWindow(window, segment, 0);
  assert.equal(child.chunks[0].parent_chunk_id, 'parent-1');
  assert.deepEqual(child.included_chunk_ids, ['parent-1']);
  assert.equal(child.terminal_atomic_segment, true);
  assert.equal(child.start_offset, segment.start_offset);
});

test('atomic segmentation is deterministic and exact duplicate removal is lineage-scoped', () => {
  const chunk = { chunk_id: 'parent-1', char_start: 0, source_text: '同一事实。', source_hash: 'h' };
  const first = splitProductionChunkIntoAtomicSegments(chunk);
  const second = splitProductionChunkIntoAtomicSegments(chunk);
  assert.deepEqual(first, second);
  const row = {
    candidate_v2_2: { statement: '华为提供服务。', subject_name: '华为', entity_mentions: [], source_refs: ['S001'] },
    source_span: { atomic_segment: true, anchor_chunk_id: 'parent-1' }
  };
  const dedup = deduplicateExactAtomicCandidates([row, structuredClone(row)]);
  assert.equal(dedup.removed_count, 1);
  assert.equal(dedup.rows.length, 1);
  const nonAtomic = deduplicateExactAtomicCandidates([{ ...row, source_span: { atomic_segment: false } }, { ...row, source_span: { atomic_segment: false } }]);
  assert.equal(nonAtomic.removed_count, 0);
});
