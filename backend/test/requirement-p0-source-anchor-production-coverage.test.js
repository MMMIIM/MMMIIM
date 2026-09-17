import test from 'node:test';
import assert from 'node:assert/strict';
import { combineRequirementExtractionSections } from '../src/pipeline/requirement-scope-router.js';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';

function section(section_key, routing_role, paragraphs) {
  const content_text = paragraphs.map((item) => item.text).join('\n');
  return { section_key, title: section_key, routing_role, archive_role: routing_role, content_text, paragraphs };
}

test('production source coverage can retain non-scoring compliance sections for authoritative raw anchors', () => {
  const sections = [
    section('technical_requirements', 'REQUIREMENT_ELIGIBLE', [{ paragraph: 1, page: 1, text: '系统应提供统一服务。', source_start_offset: 0, source_end_offset: 9 }]),
    section('bidder_instructions', 'QUALIFICATION', [{ paragraph: 2, page: 2, text: '投标文件存在不符合项的，投标无效。', routing_role: 'QUALIFICATION', source_start_offset: 10, source_end_offset: 27 }])
  ];
  const productionScope = combineRequirementExtractionSections(sections, { includeNonScoringSections: true });
  assert.match(productionScope.content_text, /投标文件存在不符合项/);
  assert.deepEqual(productionScope.source_sections, ['technical_requirements', 'bidder_instructions']);
});

test('default scope remains backward-compatible and excludes scoring-only sections', () => {
  const sections = [
    section('technical_requirements', 'REQUIREMENT_ELIGIBLE', [{ paragraph: 1, page: 1, text: '系统应提供统一服务。' }]),
    section('evaluation_method', 'SCORING', [{ paragraph: 2, page: 2, text: '评分标准。' }])
  ];
  const defaultScope = combineRequirementExtractionSections(sections);
  assert.doesNotMatch(defaultScope.content_text, /评分标准/);
});

test('expanded production scope keeps bidder obligations and excludes buyer-only administrative text', () => {
  const sections = [
    section('bidder_instructions', '投标人须知', [
      { paragraph: 1, page: 1, text: '投标人须提供营业执照和资格证书。', routing_role: 'QUALIFICATION' },
      { paragraph: 2, page: 1, text: '投标文件未按要求签署盖章的，投标无效。', routing_role: 'PROCUREMENT' },
      { paragraph: 3, page: 1, text: '采购人联系人：张三，联系电话：010-12345678。', routing_role: 'PROCUREMENT' },
      { paragraph: 4, page: 1, text: '评审委员会将在2026年12月1日组织评审。', routing_role: 'SCORING' },
      { paragraph: 5, page: 1, text: '本文件所称“供应商”是指参与采购活动的法人。', routing_role: 'QUALIFICATION' }
    ])
  ];
  const productionScope = combineRequirementExtractionSections(sections, { includeNonScoringSections: true });
  assert.match(productionScope.content_text, /投标人须提供营业执照/);
  assert.match(productionScope.content_text, /投标文件未按要求签署盖章/);
  assert.doesNotMatch(productionScope.content_text, /采购人联系人/);
  assert.doesNotMatch(productionScope.content_text, /评审委员会/);
  assert.doesNotMatch(productionScope.content_text, /本文件所称/);
});

test('production scope preserves bidder-facing preamble paragraphs before the first chapter heading', () => {
  const values = [
    '符合性审查表',
    '序号 内容',
    '1 不得将一个包的内容拆开投标；',
    '2 分项报价不得高于最高限价；',
    '第一章 项目技术要求',
    '系统应提供审计日志。'
  ];
  const extraction = {
    text: values.join('\n'),
    paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: 1 })),
    pages: [], warnings: []
  };
  const analysis = classifyTenderSections(extraction);
  const productionScope = combineRequirementExtractionSections(analysis.sections, { includeNonScoringSections: true });
  assert.match(productionScope.content_text, /不得将一个包的内容拆开投标/);
  assert.match(productionScope.content_text, /分项报价不得高于最高限价/);
  assert.match(productionScope.content_text, /系统应提供审计日志/);
});

test('buyer object in a supplier service obligation is retained while standalone definitions are excluded', () => {
  const productionScope = combineRequirementExtractionSections([
    section('contract', 'LEGAL', [
      { paragraph: 1, page: 1, text: '中标人应当为采购人提供7×12小时技术服务电话。', routing_role: 'LEGAL' },
      { paragraph: 2, page: 1, text: '企业定义：是指由司法部认定的企业。', routing_role: 'UNKNOWN' },
      { paragraph: 3, page: 1, text: '采购人联系人：张三，联系电话：010-12345678。', routing_role: 'PROCUREMENT' }
    ])
  ], { includeNonScoringSections: true });
  assert.match(productionScope.content_text, /7×12小时技术服务电话/);
  assert.doesNotMatch(productionScope.content_text, /企业定义/);
  assert.doesNotMatch(productionScope.content_text, /采购人联系人/);
});
