import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRetrievalChunkRole,
  classifySubstantiveCandidate,
  isCitationIndexLike,
  isFormalEvidenceChunkEligible,
  partitionRetrievalCandidates
} from '../src/pipeline/retrieval-chunk-role.js';

test('deterministic chunk roles keep headings and metadata available for context', () => {
  assert.equal(classifyRetrievalChunkRole({ source_text: '# ISO 27001 受控记录' }).role, 'HEADING');
  assert.equal(classifyRetrievalChunkRole({ source_text: 'material_id: MAT-1\ndocument_id: DOC-1' }).role, 'METADATA');
  assert.equal(classifyRetrievalChunkRole({ source_text: '| 参数 | 结果 |\n|---|---|\n| P95 | 1.9 秒 |' }).role, 'TABLE_ROW');
  assert.equal(classifyRetrievalChunkRole({ source_text: '状态：active\n有效至：2027-11-30' }).role, 'BUSINESS_CONTENT');
});

test('formal evidence lane excludes non-evidence roles unless requirement asks for metadata', () => {
  const requirement = { text: '企业应提供 ISO/IEC 27001 认证信息。', requirement_category: 'qualification' };
  assert.equal(isFormalEvidenceChunkEligible({ requirement, candidate: { chunk_role: 'HEADING' } }), false);
  assert.equal(isFormalEvidenceChunkEligible({ requirement, candidate: { chunk_role: 'METADATA' } }), false);
  assert.equal(isFormalEvidenceChunkEligible({ requirement: { text: '请提供文件编号。', requirement_category: 'metadata' }, candidate: { chunk_role: 'METADATA', source_text: 'document_id: DOC-1', material_type: 'company_profile' } }), false);
});

test('candidate partition preserves business order and marks excluded context', () => {
  const requirement = { text: '企业应提供性能测试记录。', requirement_category: 'technical' };
  const result = partitionRetrievalCandidates({ requirement, candidates: [
    { chunk_id: 'heading', source_text: '# 性能测试记录', similarity_score: 0.99, version: 'embedding-v1' },
    { chunk_id: 'business', source_text: '结果：平均 1.4 秒，P95 1.9 秒。', material_type: 'product_documentation', similarity_score: 0.8 },
    { chunk_id: 'front', source_text: '目录\n投标邀请', similarity_score: 0.7 }
  ] });
  assert.deepEqual(result.eligible_candidates.map((item) => item.chunk_id), ['business']);
  assert.deepEqual(result.excluded_candidates.map((item) => item.chunk_id), ['heading', 'front']);
  assert.equal(result.internal_candidate_pool_size, 3);
  assert.equal(result.eligible_candidate_pool_size, 1);
  assert.equal(result.all_candidates[0].candidate_eligibility, 'CONTEXT_ONLY');
  assert.equal(result.all_candidates[0].version, 'embedding-v1');
});

test('known fragments and labels are non-substantive while factual rows remain substantive', () => {
  for (const source of ['信息分：', 'I. Required Documents', '必须明确：', '用户界面优先回答：', '记录已经验证的核心原则：', '可控\n可追溯\n可审核\n可修改\n可交付']) {
    assert.equal(classifySubstantiveCandidate({ source_text: source }).substantive_candidate, false, source);
  }
  assert.equal(classifySubstantiveCandidate({ source_text: 'P95 = 1.9 秒' }).substantive_candidate, true);
  assert.equal(classifySubstantiveCandidate({ source_text: '名称：ISO/IEC 27001\n编号：CM-Q-27001-2024\n状态：active' }).substantive_candidate, true);
  assert.equal(classifySubstantiveCandidate({ source_text: '鲲鹏 + 麒麟 + 达梦：partially_tested（未完成压力测试）' }).substantive_candidate, true);
});

test('substantive hygiene excludes noise but keeps legitimate topic-only business text', () => {
  const result = partitionRetrievalCandidates({ requirement: { text: '企业应提供兼容性说明。', requirement_category: 'technical' }, candidates: [
    { chunk_id: 'label', source_text: '必须包含：', similarity_score: 0.99 },
    { chunk_id: 'topic', source_text: '企业软件基础能力，安全、够用。', material_type: 'company_profile', similarity_score: 0.8 },
    { chunk_id: 'fact', source_text: '鲲鹏 + 麒麟 + 达梦：partially_tested（未完成压力测试）', material_type: 'technical_solution', similarity_score: 0.7 }
  ] });
  assert.deepEqual(result.eligible_candidates.map((item) => item.chunk_id), ['fact']);
  assert.equal(result.all_candidates.find((item) => item.chunk_id === 'label').substantive_class, 'LABEL_ONLY');
  assert.equal(result.all_candidates.find((item) => item.chunk_id === 'topic').substantive_candidate, true);
  assert.equal(result.all_candidates.find((item) => item.chunk_id === 'topic').evidence_source_class, 'NON_AUDITABLE_CLAIM');
});

test('boilerplate summary disclaimers are fail-closed and do not consume reference slots', () => {
  const source = '官方资料结构化摘要。正式投标与合规判断需回到原始法律、标准、政策或项目文件核验。';
  const classified = classifySubstantiveCandidate({ source_text: source });
  assert.equal(classified.substantive_candidate, false);
  assert.equal(classified.substantive_class, 'BOILERPLATE');
});

test('citation index rows with URL query parameters are recognized as non-substantive', () => {
  const source = '- **OFF-U08｜GB/T 22239-2019**｜国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2019-12-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=ABC123';
  assert.equal(isCitationIndexLike(source), true);
  const result = partitionRetrievalCandidates({ requirement: { text: '企业应提供安全设计。' }, candidates: [
    { chunk_id: 'citation', source_text: source, material_type: 'technical_whitepaper' },
    { chunk_id: 'business', source_text: '系统支持安全设计并保留审计记录。', material_type: 'technical_whitepaper' }
  ] });
  assert.deepEqual(result.eligible_candidates.map((item) => item.chunk_id), ['business']);
  assert.equal(result.all_candidates.find((item) => item.chunk_id === 'citation').substantive_candidate, false);
});
