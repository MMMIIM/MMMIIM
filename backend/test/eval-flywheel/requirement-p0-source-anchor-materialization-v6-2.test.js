import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCorrectedPlan,
  findHeadingListHint,
  materializeHint
} from '../../eval/flywheel/requirement-p0-source-anchor-materialization-v6-2.js';

function stateFromParagraphs(paragraphs) {
  return {
    source_sha256: 'a'.repeat(64),
    source_sha256_matches_frozen_tender: true,
    extracted_text: paragraphs.map((item) => item.text).join(''),
    paragraphs: paragraphs.map((item, index) => ({ ...item, paragraph: item.paragraph ?? index + 1, source_start_offset: index * 20, source_end_offset: index * 20 + item.text.length })),
    chunks: []
  };
}

test('materialization uses source PDF text and preserves source identity metadata', () => {
  const text = '投标文件须在规定时间内完成电子解密，因非系统原因导致解密失败的，视为投标无效。';
  const state = stateFromParagraphs([{ page: 20, text }]);
  const result = materializeHint(state, '18.2：投标人应在规定时间内对投标文件进行解密；因非系统原因导致的解密失败，视为投标无效。', [20]);
  assert.ok(result);
  assert.equal(result.raw_source_text, text);
  assert.equal(result.page, 20);
  assert.equal(result.source_document_sha256, state.source_sha256);
  assert.ok(result.raw_source_text_sha256);
});

test('technical-standards hint expands the deterministic heading/list block', () => {
  const state = stateFromParagraphs([
    { page: 17, text: '3.2 技术标准' },
    { page: 17, text: '《信息技术软件生存周期过程》' },
    { page: 17, text: '《计算机软件文档编制规范》' },
    { page: 18, text: '《政府热线服务规范》' },
    { page: 18, text: '四、建设内容' }
  ]);
  const result = findHeadingListHint(state, '3.2 技术标准及其后列举的技术标准清单。', [16, 17, 18]);
  assert.ok(result);
  assert.equal(result.match_type, 'DETERMINISTIC_HEADING_LIST_EXPANSION');
  assert.match(result.raw_source_text, /3\.2 技术标准/);
  assert.doesNotMatch(result.raw_source_text, /四、建设内容/);
});

test('multi-span materialization keeps each GPT-approved raw semantic signal separate', () => {
  const paragraphs = [{ page: 2, text: '不同投标供应商投标文件“文件制作机器码”一致。' }];
  for (let index = 0; index < 10; index += 1) paragraphs.push({ page: 20, text: `独立背景段落 ${index}` });
  paragraphs.push({ page: 43, text: '32.2 投标人若有一条审查不通过则按投标无效处理。' });
  const state = stateFromParagraphs(paragraphs);
  const first = materializeHint(state, '符合性审查表第9项：不同投标供应商投标文件“文件制作机器码”一致。', [2, 43]);
  const second = materializeHint(state, '32.2：符合性审查任一条审查不通过则按投标无效处理。', [2, 43]);
  assert.ok(first && second);
  assert.notEqual(first.raw_source_text_sha256, second.raw_source_text_sha256);
});

test('corrected replay plan excludes retained source conflicts from replay eligibility', () => {
  const rows = [
    { atom_id: 'A', anchor_decision: 'GPT_SEMANTIC_ANCHOR_APPROVED', anchors: [{}], production_input_visibility: [{ status: 'PRODUCTION_INPUT_VISIBLE', provider_input_visible: true, cross_chunk_semantic_split: false, parse_chunks: [{ chunk_id: 'c1', chunk_number: 1 }] }] },
    { atom_id: 'B', anchor_decision: 'SOURCE_CONFLICT_RETAINED', anchors: [{}], production_input_visibility: [{ status: 'PRODUCTION_INPUT_VISIBLE', provider_input_visible: true, cross_chunk_semantic_split: false, parse_chunks: [{ chunk_id: 'c2', chunk_number: 2 }] }] }
  ];
  const plan = buildCorrectedPlan(rows);
  assert.equal(plan.target_case_count, 43);
  assert.equal(plan.replay_eligible_case_count, 1);
  assert.deepEqual(plan.unique_production_provider_chunks.map((chunk) => chunk.chunk_id), ['c1']);
  assert.equal(plan.provider_replay_authorized, false);
});
