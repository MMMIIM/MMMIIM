import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';
import { aggregateRequirementCandidates, chunkExtractedText } from '../src/pipeline/requirement-chunker.js';
import { detectMandatoryScopeRules } from '../src/pipeline/mandatory-requirement.js';
import { validateRequirementExtractionEnvelope } from '../src/pipeline/requirement-extraction.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';

function extractionFromParagraphs(values) {
  const paragraphs = values.map((value, index) => ({
    paragraph: index + 1,
    page: Math.floor(index / 35) + 1,
    text: typeof value === 'string' ? value : value.text
  }));
  const text = paragraphs.map((paragraph) => paragraph.text).join('\n');
  return { text, paragraphs, pages: [], warnings: [] };
}

function chapterFixture(technicalParagraphs = []) {
  return extractionFromParagraphs([
    '目录',
    '第一章 投标邀请', '邀请内容。',
    '第二章 投标人须知前附表', '须知前附表。',
    '第三章 投标人须知', '须知正文。',
    '第四章 项目要求和有关说明',
    '以下除5.2.6外，其余均为实质性要求。',
    ...technicalParagraphs,
    '第五章 评标方法和评标标准', '评标内容。',
    '第六章 合同书（格式）', '合同内容。',
    '第七章 投标文件的组成和格式', '格式内容。'
  ]);
}

test('识别六类文档章节且 Requirement 范围只选择第四章', () => {
  const analysis = classifyTenderSections(chapterFixture(['5.2.1 技术要求。', '5.2.6 例外要求。']));
  assert.deepEqual(analysis.sections.map((section) => section.section_key), [
    'tender_invitation', 'bidder_instructions', 'technical_requirements',
    'evaluation_method', 'contract', 'bid_document_format'
  ]);
  assert.equal(analysis.technicalSection.title, '项目要求和有关说明');
  assert.match(analysis.technicalSection.content_text, /5\.2\.1 技术要求/);
  assert.doesNotMatch(analysis.technicalSection.content_text, /评标内容/);
  assert.equal(analysis.usedFullTextFallback, false);
  assert.deepEqual(analysis.warnings, []);
});

test('找不到第四章标题时使用受控全文回退并产生 warning', () => {
  const analysis = classifyTenderSections(extractionFromParagraphs(['无明确章节标题', '技术要求。']));
  assert.equal(analysis.usedFullTextFallback, true);
  assert.equal(analysis.technicalSection.section_key, 'controlled_fulltext_fallback');
  assert.equal(analysis.warnings[0].code, 'TECHNICAL_SECTION_FALLBACK');
});

test('识别用户需求书的结构化章节标题变体为技术需求范围', () => {
  for (const heading of ['第三章 用户需求书', '第三章　用户需求书', '3 用户需求书', '用户需求书']) {
    const analysis = classifyTenderSections(extractionFromParagraphs([heading, '系统应提供运维服务。']));
    assert.equal(analysis.technicalSection?.section_key, 'technical_requirements', heading);
    assert.equal(analysis.technicalSection?.routing_role, 'REQUIREMENT_ELIGIBLE', heading);
  }
});

test('合同章节正文中的项目需求引用不会被提升为技术需求章节', () => {
  const analysis = classifyTenderSections(extractionFromParagraphs([
    '第五章 合同条款及格式',
    '（仅供参考，具体以项目需求及采购结果为准）'
  ]));
  assert.equal(analysis.technicalSection, null);
  assert.equal(analysis.sections.find((section) => section.section_key === 'contract')?.routing_role, 'LEGAL');
});

test('约46k字符短段落同时受字符与来源段预算约束，不产生微型 chunk', () => {
  const values = Array.from({ length: 1400 }, (_, index) => (
    `${Math.floor(index / 20) + 1}.${(index % 20) + 1} ${'技术要求与验收说明'.repeat(3)}`
  ));
  const extraction = extractionFromParagraphs(values);
  assert.ok(extraction.text.length > 46000);
  const chunks = chunkExtractedText({
    ...extraction, singleCallThreshold: 8000, characterBudget: 8000, tokenBudget: 8000
  });
  assert.equal(chunks.length, 14);
  assert.ok(chunks.every((chunk) => chunk.segments.length <= 100));
  assert.ok(chunks.every((chunk) => chunk.character_count > 1000));
});

test('章节级 mandatory scope 传播到第四章候选但排除5.2.6', () => {
  const analysis = classifyTenderSections(chapterFixture([
    '5.2.1 应提供审计能力。',
    '5.2.6 可选扩展能力。',
    '5.2.7 应提供接口能力。'
  ]));
  const rules = detectMandatoryScopeRules(analysis.technicalSection);
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0].exception_clause_ids, ['5.2.6']);
  const candidates = aggregateRequirementCandidates([{ chunk_number: 1, candidates: [
    {
      text: '提供审计能力。', source_refs: ['C001-S001'], source_text: '5.2.1 应提供审计能力。',
      category: 'technical', source_clause_id: '5.2.1', mandatory_observed: true,
      requires_confirmation: false, source_section: '项目要求和有关说明',
      source_clause_id: '5.2.1', source_page: 10, source_paragraph: 20
    },
    {
      text: '可选扩展能力。', source_refs: ['C001-S002'], source_text: '5.2.6 可选扩展能力。',
      category: 'technical', source_clause_id: '5.2.6', mandatory_observed: false,
      requires_confirmation: false, source_section: '项目要求和有关说明',
      source_clause_id: '5.2.6', source_page: 10, source_paragraph: 21
    }
  ] }], { mandatoryScopeRules: rules });
  assert.equal(candidates[0].is_mandatory, true);
  assert.equal(candidates[0].mandatory_marker, null);
  assert.equal(candidates[0].mandatory_scope_section, '项目要求和有关说明');
  assert.match(candidates[0].mandatory_scope_source_text, /5\.2\.6/);
  assert.equal(candidates[1].is_mandatory, false);
  assert.equal(candidates[1].source_clause_id, '5.2.6');
});

test('网关 requirements 空数组是合法成功，非数组和多余字段仍失败', () => {
  const result = validateRequirementExtractionEnvelope({
    envelope: {
      schema_version: '4.3-requirement-extraction-v3.1.1', task_type: 'requirement_extraction',
      status: 'success', data: { requirements: [] }, warnings: []
    },
    audit: { provider: 'semantic_gateway' }
  });
  assert.deepEqual(result.candidates, []);
  for (const data of [{ requirements: 'invalid' }, { requirements: [], extra: true }, {}]) {
    assert.throws(() => validateRequirementExtractionEnvelope({
      envelope: {
      schema_version: '4.3-requirement-extraction-v3.1.1', task_type: 'requirement_extraction',
        status: 'success', data, warnings: []
      }, audit: {}
    }), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  }
});

function repositoryForEmptyChunkTest() {
  const state = { completed: [], failed: null, saved: null };
  return {
    state,
    getProject: async () => ({ id: 'project-1' }),
    getRequirementBaseline: async () => null,
    getTenderFile: async () => ({
      id: 'file-1', project_id: 'project-1', storage_key: 'file.txt',
      original_name: 'file.txt', mime_type: 'text/plain'
    }),
    createParseJob: async () => ({ id: 'job-1' }),
    updateParseJob: async () => ({ id: 'job-1', status: 'running' }),
    updateParseJobProgress: async () => {},
    saveParseDocumentAnalysis: async () => {},
    initializeParseChunks: async (_id, chunks) => { state.chunks = chunks; },
    startParseChunk: async () => {},
    completeParseChunk: async (value) => { state.completed.push(value); },
    failParseChunk: async () => { throw new Error('must not fail chunk'); },
    completeParseJob: async (value) => { state.saved = value; return { status: 'succeeded', candidates: value.candidates }; },
    failParseJob: async (value) => { state.failed = value; }
  };
}

test('空分片继续成功处理；仅所有分片为空时整体 NO_REQUIREMENTS_EXTRACTED', async () => {
  const extraction = chapterFixture([
    '5.2.1 ' + '技术要求。'.repeat(20),
    '5.2.2 ' + '接口要求。'.repeat(20)
  ]);
  for (const allEmpty of [false, true]) {
    const repository = repositoryForEmptyChunkTest();
    let call = 0;
    const service = new RequirementParseService({
      repository,
      storage: { read: async () => Buffer.from('fixture') },
      textExtractor: async () => extraction,
      chunkBudget: { singleCallThreshold: 1, characterBudget: 120, tokenBudget: 120 },
      extractionGateway: {
        extract: async ({ chunk }) => {
          call += 1;
          if (allEmpty || call === 1) return { candidates: [], warnings: [], audit: {} };
          return {
            candidates: [{
              text: '接口要求。', category: 'technical',
              source_range: { start_ref: chunk.segments[0].source_ref, end_ref: chunk.segments[0].source_ref },
              mandatory_observed: false, requires_confirmation: false
            }], warnings: [], audit: {}
          };
        }
      },
      logger: { error: () => {} }
    });
    if (allEmpty) {
      await assert.rejects(
        () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
        (error) => error.code === 'NO_REQUIREMENTS_EXTRACTED'
      );
      assert.equal(repository.state.saved, null);
      assert.equal(repository.state.failed.errorCode, 'NO_REQUIREMENTS_EXTRACTED');
    } else {
      const result = await service.start({
        projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true
      });
      assert.equal(result.status, 'succeeded');
      assert.ok(repository.state.completed.some((chunk) => chunk.candidateCount === 0));
      assert.equal(repository.state.failed, null);
    }
  }
});
