import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_QUALITY_GATE_VERSION,
  classifyEnterpriseChunkQuality,
  chunkEnterpriseMaterial
} from '../src/pipeline/enterprise-material-chunker.js';

test('Chunk Quality Gate classifies standalone headings as structural-only with additive metadata', () => {
  const quality = classifyEnterpriseChunkQuality('# 性能与容量测试报告');
  assert.deepEqual(quality, {
    chunk_role: 'STRUCTURAL_ONLY',
    parent_section_id: null,
    heading_path: [],
    content_length: 11,
    content_hash: 'd4b5cdfb5102e49f82ba62b89d657e721e4069d45198057f27e9a74c374bd48e',
    chunk_quality_gate_version: CHUNK_QUALITY_GATE_VERSION
  });
});

test('Chunk Quality Gate preserves substantive evidence text and exact content hash', () => {
  const source = '系统性能测试结果显示，响应时间满足当前测试条件。';
  const quality = classifyEnterpriseChunkQuality(source, { parentSectionId: 'section-1', headingPath: ['性能'] });
  assert.equal(quality.chunk_role, 'SUBSTANTIVE_TEXT');
  assert.equal(quality.parent_section_id, 'section-1');
  assert.deepEqual(quality.heading_path, ['性能']);
  assert.equal(quality.content_length, source.length);
  assert.match(quality.content_hash, /^[a-f0-9]{64}$/);
});

test('material chunking retains heading chunks for hierarchy but exposes the quality gate', () => {
  const chunks = chunkEnterpriseMaterial('00000000-0000-4000-8000-000000000001', '# 案例\n\n项目已完成接口联调。');
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].chunk_role, 'STRUCTURAL_ONLY');
  assert.equal(chunks[1].chunk_role, 'SUBSTANTIVE_TEXT');
  assert.equal(chunks[0].content_hash, chunks[0].chunk_hash);
  assert.equal(chunks[1].content_hash, chunks[1].chunk_hash);
  assert.equal(chunks[0].chunk_quality_gate_version, CHUNK_QUALITY_GATE_VERSION);
});
