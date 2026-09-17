import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChunkFlags, isNeusoftMaterial, productionRetrievalEligible } from './rag-corpus-inventory.js';

test('Neusoft detection is metadata based and case insensitive', () => {
  assert.equal(isNeusoftMaterial({ original_name: 'neusoft-system-integration.md' }), true);
  assert.equal(isNeusoftMaterial({ original_name: 'unrelated.md', source_org: '东软集团' }), true);
  assert.equal(isNeusoftMaterial({ original_name: 'COM-01.md', source_org: '示范企业' }), false);
});

test('private retrieval predicate requires current lifecycle authority', () => {
  const active = { project_id: 'private-project', corpus_scope: 'ENTERPRISE_PRIVATE', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded', index_status: 'NOT_INDEXED' };
  assert.equal(productionRetrievalEligible(active), true);
  assert.equal(productionRetrievalEligible({ ...active, lifecycle_status: 'QUARANTINED' }), false);
  assert.equal(productionRetrievalEligible({ project_id: 'public-project', corpus_scope: 'GENERAL', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded', index_status: 'INDEXED' }, 'public-project'), true);
  assert.equal(productionRetrievalEligible({ project_id: 'public-project', corpus_scope: 'GENERAL', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'REFERENCE_ONLY', extraction_status: 'succeeded', index_status: 'INDEXED' }, 'public-project'), false);
});

test('quality flags are mechanical and do not create semantic authority', () => {
  const result = classifyChunkFlags([
    { source_text: '# Heading' },
    { source_text: '公司以创新驱动，赋能客户构建领先平台。' },
    { source_text: 'ISO 27001，2025-01-01，中标项目，响应时间3秒。' }
  ], { source_type: 'official', authority_level: 'official' });
  assert.deepEqual(result.flags, ['AUTHORITATIVE_RECORD_CANDIDATE', 'HEADING_ONLY', 'MARKETING_STYLE_CANDIDATE', 'STRUCTURED_FACT_CANDIDATE', 'VERY_LOW_INFORMATION']);
  assert.deepEqual(result.flag_counts, { HEADING_ONLY: 1, VERY_LOW_INFORMATION: 3, MARKETING_STYLE_CANDIDATE: 1, STRUCTURED_FACT_CANDIDATE: 1, AUTHORITATIVE_RECORD_CANDIDATE: 1 });
  assert.equal(result.low_information_count, 3);
});

test('missing inventory fields remain explicit rather than inferred', () => {
  const result = classifyChunkFlags([], { source_type: null, authority_level: null });
  assert.deepEqual(result, { flags: [], flag_counts: {}, low_information_count: 0 });
});
