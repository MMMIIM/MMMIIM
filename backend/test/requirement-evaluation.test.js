import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentCapabilityDetector } from '../src/pipeline/document-capability-detector.js';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';
import { loadEvaluationCases, RequirementExtractionEvaluator } from '../src/eval/requirement-extraction-evaluator.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';
import { loadBackendEnvironment } from '../src/backend-runtime.js';
import { buildRealProductionPath } from '../eval/requirement-extraction-real-tender-pilot-v1/production-path.js';
import {
  buildEvaluationRangeContext,
  buildAnnotatedPath,
  evaluateTender
} from '../eval/requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import {
  buildStableProvenanceIndex,
  calculateEvaluationPrecision,
  projectStableRangeToRetained,
  resolveStableRange
} from '../eval/requirement-extraction-real-tender-pilot-v1/evaluation-matching.js';

const evalDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../eval');
const extraction = (values) => ({ text: values.join('\n'), paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: index + 1 })), pages: [], warnings: [] });

test('DocumentCapabilityDetector 分类支持、加密、扫描和低质量文档', () => {
  const detector = new DocumentCapabilityDetector();
  assert.equal(detector.detect({ fileName: 'a.docx', mimeType: '', buffer: Buffer.from('x'), extraction: extraction(['技术要求', '系统应支持审计']) }).supported, true);
  assert.equal(detector.detect({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF /Encrypt') }).unsupported_reason, 'ENCRYPTED_DOCUMENT');
  assert.equal(detector.detect({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF'), extractionError: { code: 'TENDER_TEXT_EMPTY' } }).unsupported_reason, 'OCR_REQUIRED');
  assert.equal(detector.detect({ fileName: 'a.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') }).unsupported_reason, 'UNSUPPORTED_DOCUMENT');
  assert.equal(detector.detect({ fileName: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x'), extraction: extraction(['�'.repeat(100)]) }).unsupported_reason, 'EXTRACTION_QUALITY_TOO_LOW');
});

test('不支持文档在文本提取和Gateway之前阻断且不创建基线', async () => {
  let extracted = 0; let gatewayCalls = 0;
  const repository = {
    getProject: async () => ({ id: 'p' }), getRequirementBaseline: async () => null,
    getTenderFile: async () => ({ id: 'f', project_id: 'p', original_name: 'scan.pdf', mime_type: 'application/pdf', storage_key: 'x' }),
    createParseJob: async () => ({ id: 'j' }), updateParseJob: async () => ({ id: 'j' }), claimParseJob: async () => ({ id: 'j' }),
    failParseJob: async () => null
  };
  const service = new RequirementParseService({ repository, storage: { read: async () => Buffer.from('%PDF /Encrypt') }, textExtractor: async () => { extracted += 1; }, extractionGateway: { extract: async () => { gatewayCalls += 1; } } });
  await assert.rejects(() => service.start({ projectId: 'p', tenderFileId: 'f', waitForCompletion: true }), (error) => error.code === 'ENCRYPTED_DOCUMENT');
  assert.equal(extracted, 0); assert.equal(gatewayCalls, 0);
});

test('技术需求可从多个动态章节合并，不依赖固定章节号或标题', () => {
  const analysis = classifyTenderSections(extraction([
    '第一章 采购公告', '公告内容',
    '第三章 应用功能需求', '3.1 系统应支持统一登录。',
    '第七章 运维服务要求', '7.2 应提供告警通知。',
    '第九章 评审办法', '评分内容'
  ]));
  assert.equal(analysis.usedFullTextFallback, false);
  assert.deepEqual(analysis.technicalSection.chapter_numbers, [3, 7]);
  assert.match(analysis.technicalSection.content_text, /统一登录/);
  assert.match(analysis.technicalSection.content_text, /告警通知/);
});

test('无技术需求章节返回 NO_TECHNICAL_REQUIREMENTS_FOUND 而非全文误抽取', () => {
  const analysis = classifyTenderSections(extraction(['第一章 采购公告', '开标地点另行通知', '第二章 联系方式', '联系人信息']));
  assert.equal(analysis.technicalSection, null);
  assert.equal(analysis.warnings[0].code, 'NO_TECHNICAL_REQUIREMENTS_FOUND');
});

test('六案例离线CI评测达到固定Beta门槛且不访问网络', async () => {
  const cases = await loadEvaluationCases(evalDirectory);
  assert.deepEqual(cases.map((item) => item.id), ['E2E-R01', 'E2E-R02', 'E2E-R03', 'E2E-R04', 'E2E-R05', 'E2E-R06']);
  const report = new RequirementExtractionEvaluator().evaluate(cases);
  assert.equal(report.passed, true);
  assert.ok(Object.values(report.checks).every((item) => item.pass));
});

test('source range matching uses stable provenance when chunk refs are renumbered', () => {
  const current = buildStableProvenanceIndex([
    { source_ref: 'C001-S007', paragraph: 500, text: '服务期限为一年。', source_start_offset: 100, source_end_offset: 109 }
  ]);
  const historical = buildStableProvenanceIndex([
    { span_id: 'C099-S003', paragraph: 500, text: '服务期限为一年。', source_start_offset: 100, source_end_offset: 109 }
  ]);
  const currentRange = resolveStableRange({ start_ref: 'C001-S007', end_ref: 'C001-S007' }, current);
  const historicalRange = resolveStableRange({ start_ref: 'C099-S003', end_ref: 'C099-S003' }, historical);
  assert.ok(currentRange && historicalRange);
  assert.equal(currentRange.start_key, historicalRange.start_key);
  assert.equal(currentRange.end_key, historicalRange.end_key);
  assert.equal(currentRange.start_position, 0);
  assert.equal(historicalRange.start_position, 0);
});

test('FAST-01 G021-G024 remain matchable after chunk-relative ref renumbering', () => {
  const currentSpans = ['响应时间不超过2小时。', '解决时间不超过4小时。', '重大故障须立即响应。', '恢复服务不得超过24小时。']
    .map((text, index) => ({
      source_ref: `C00${index + 1}-S001`, paragraph: 600 + index, text,
      source_start_offset: 100 + index * 30, source_end_offset: 119 + index * 30
    }));
  const historicalSpans = currentSpans.map((span, index) => ({
    span_id: `C90${index + 1}-S007`, paragraph: span.paragraph, text: span.text,
    source_start_offset: span.source_start_offset, source_end_offset: span.source_end_offset
  }));
  const current = buildStableProvenanceIndex(currentSpans);
  const historical = buildStableProvenanceIndex(historicalSpans);
  for (let index = 0; index < currentSpans.length; index += 1) {
    const currentRange = resolveStableRange({ start_ref: currentSpans[index].source_ref, end_ref: currentSpans[index].source_ref }, current);
    const historicalRange = resolveStableRange({ start_ref: historicalSpans[index].span_id, end_ref: historicalSpans[index].span_id }, historical);
    assert.ok(currentRange && historicalRange);
    assert.equal(currentRange.start_key, historicalRange.start_key);
    assert.equal(currentRange.end_key, historicalRange.end_key);
  }
});

test('duplicate fallback provenance fails closed instead of choosing an arbitrary span', () => {
  const index = buildStableProvenanceIndex([
    { span_id: 'C001-S001', paragraph: 12, page: 3, text: '同一短条款。' },
    { span_id: 'C001-S002', paragraph: 12, page: 3, text: '同一短条款。' }
  ]);
  assert.equal(index.ambiguousKeys.size, 1);
  assert.equal(resolveStableRange({ start_ref: 'C001-S001', end_ref: 'C001-S001' }, index), null);
  assert.equal(resolveStableRange({ start_ref: 'C001-S002', end_ref: 'C001-S002' }, index), null);

  const repeatedPages = buildStableProvenanceIndex([
    { span_id: 'C002-S001', paragraph: 1, page: 4, text: '重复标题。' },
    { span_id: 'C003-S001', paragraph: 1, page: 5, text: '重复标题。' }
  ]);
  assert.equal(repeatedPages.ambiguousKeys.size, 0);
  assert.notEqual(repeatedPages.records[0].key, repeatedPages.records[1].key);
  assert.ok(resolveStableRange({ start_ref: 'C002-S001', end_ref: 'C002-S001' }, repeatedPages));
  assert.ok(resolveStableRange({ start_ref: 'C003-S001', end_ref: 'C003-S001' }, repeatedPages));
});

test('stable provenance projects excluded spans and preserves combined candidate coverage', () => {
  const historicalSpans = [
    { span_id: 'H-001', paragraph: 10, text: '迁移部署并保证系统运行。', source_start_offset: 100, source_end_offset: 110 },
    { span_id: 'H-002', paragraph: 11, text: '七日内完成迁移。', source_start_offset: 111, source_end_offset: 119 },
    { span_id: 'H-003', paragraph: 12, text: '不得改变原有功能。', source_start_offset: 120, source_end_offset: 129 },
    { span_id: 'H-004', paragraph: 13, text: '违约金按合同约定。', source_start_offset: 130, source_end_offset: 139 }
  ];
  const allCurrentSpans = [
    { source_ref: 'C-001', paragraph: 10, text: '迁移部署并保证系统运行。', source_start_offset: 1000, source_end_offset: 1010, routing_role: 'REQUIREMENT_ELIGIBLE' },
    { source_ref: 'C-002', paragraph: 11, text: '七日内完成迁移。', source_start_offset: 1011, source_end_offset: 1019, routing_role: 'REQUIREMENT_ELIGIBLE' },
    { source_ref: 'C-003', paragraph: 12, text: '不得改变原有功能。', source_start_offset: 1020, source_end_offset: 1029, routing_role: 'UNKNOWN' },
    { source_ref: 'C-004', paragraph: 13, text: '违约金按合同约定。', source_start_offset: 1030, source_end_offset: 1039, routing_role: 'COMMERCIAL' }
  ];
  const retainedSpans = allCurrentSpans.filter((span) => span.routing_role !== 'COMMERCIAL');
  const projected = projectStableRangeToRetained({
    range: { start_ref: 'H-001', end_ref: 'H-004' },
    historicalSpans,
    retainedSpans,
    allCurrentSpans,
    isExcluded: (span) => span.routing_role === 'COMMERCIAL'
  });
  assert.deepEqual(projected && { start_ref: projected.start_ref, end_ref: projected.end_ref }, { start_ref: 'C-001', end_ref: 'C-003' });
  assert.equal(projected?.excluded_count, 1);

  const candidateRanges = [
    { start_ref: 'C-001', end_ref: 'C-002' },
    { start_ref: 'C-003', end_ref: 'C-003' }
  ].map((range) => resolveStableRange(range, buildStableProvenanceIndex(retainedSpans)));
  assert.equal(candidateRanges.every(Boolean), true);
  assert.equal(candidateRanges[0].start_position, projected?.start_position);
  assert.equal(candidateRanges[1].end_position, projected?.end_position);
});

test('TB-006 G032 stable provenance recognizes contiguous candidate coverage after chunk renumbering', async () => {
  const packet = JSON.parse(await readFile(
    resolve(evalDirectory, 'requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/TB-006.json'), 'utf8'
  ));
  const prepared = await buildRealProductionPath(packet, loadBackendEnvironment());
  const projected = projectStableRangeToRetained({
    range: packet.gold_requirements.find((item) => item.gold_id === 'TB-006-G032').source_range,
    historicalSpans: packet.windows.flatMap((window) => window.spans),
    retainedSpans: prepared.chunks.flatMap((chunk) => chunk.segments),
    allCurrentSpans: prepared.selected_paragraphs,
    isExcluded: (span) => !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(span?.routing_role)
  });
  const currentIndex = buildStableProvenanceIndex(prepared.chunks.flatMap((chunk) => chunk.segments));
  assert.ok(projected);
  const currentSegments = prepared.chunks
    .flatMap((chunk) => chunk.segments)
    .slice(projected.start_position, projected.end_position + 1);
  assert.ok(currentSegments.length >= 2);
  const split = Math.max(1, Math.floor(currentSegments.length / 2));
  const candidateRanges = [
    { start_ref: currentSegments[0].source_ref, end_ref: currentSegments[split - 1].source_ref },
    { start_ref: currentSegments[split].source_ref, end_ref: currentSegments.at(-1).source_ref }
  ].map((range) => resolveStableRange(range, currentIndex));
  assert.equal(candidateRanges.every(Boolean), true);
  assert.equal(candidateRanges[0].start_position, projected?.start_position);
  assert.equal(candidateRanges[1].end_position, projected?.end_position);
  assert.equal(candidateRanges[0].end_position + 1, candidateRanges[1].start_position);
});

test('stable provenance projection fails closed on ambiguous current locations', () => {
  const historicalSpans = [
    { span_id: 'H-001', paragraph: 1, text: '重复定位。', source_start_offset: 10, source_end_offset: 14 }
  ];
  const currentSpans = [
    { source_ref: 'C-001', paragraph: 1, text: '重复定位。', source_start_offset: 100, source_end_offset: 104, routing_role: 'REQUIREMENT_ELIGIBLE' },
    { source_ref: 'C-002', paragraph: 1, text: '重复定位。', source_start_offset: 200, source_end_offset: 204, routing_role: 'REQUIREMENT_ELIGIBLE' }
  ];
  assert.equal(projectStableRangeToRetained({
    range: { start_ref: 'H-001', end_ref: 'H-001' },
    historicalSpans,
    retainedSpans: currentSpans,
    allCurrentSpans: currentSpans,
    isExcluded: () => false
  }), null);
});

test('final evaluator remaps controlled-window refs through enriched routed spans', () => {
  const historical = [
    { span_id: 'C001-S032', paragraph: 500, text: '服务期限为一年。', source_start_offset: 100, source_end_offset: 109 },
    { span_id: 'C001-S033', paragraph: 501, text: '服务时间为全年。', source_start_offset: 110, source_end_offset: 119 }
  ];
  const retained = [
    { source_ref: 'C001-S031', paragraph: 500, text: '服务期限为一年。', source_start_offset: 100, source_end_offset: 109, routing_role: 'UNKNOWN' },
    { source_ref: 'C001-S032', paragraph: 501, text: '服务时间为全年。', source_start_offset: 110, source_end_offset: 119, routing_role: 'UNKNOWN' }
  ];
  const context = buildEvaluationRangeContext({ windows: [{ spans: historical }] }, {
    selected_paragraphs: retained.map(({ source_start_offset, source_end_offset, paragraph, text }) => ({ paragraph, text })),
    routed_sections: [{ paragraphs: retained }],
    chunks: [{ chunk_number: 1, segments: retained }]
  });
  const projected = projectStableRangeToRetained({
    range: { start_ref: 'C001-S032', end_ref: 'C001-S033' },
    historicalSpans: historical,
    retainedSpans: retained,
    allCurrentSpans: context.allCurrentSpans,
    isExcluded: () => false
  });
  assert.deepEqual(projected && { start_ref: projected.start_ref, end_ref: projected.end_ref }, { start_ref: 'C001-S031', end_ref: 'C001-S032' });
});

test('final evaluator remaps refs across larger chunk and span renumbering', () => {
  const historical = [
    { span_id: 'C003-S042', paragraph: 900, text: '迁移部署。', source_start_offset: 500, source_end_offset: 505 },
    { span_id: 'C003-S043', paragraph: 901, text: '七日内完成。', source_start_offset: 506, source_end_offset: 511 }
  ];
  const retained = [
    { source_ref: 'C002-S017', paragraph: 900, text: '迁移部署。', source_start_offset: 500, source_end_offset: 505, routing_role: 'REQUIREMENT_ELIGIBLE' },
    { source_ref: 'C002-S018', paragraph: 901, text: '七日内完成。', source_start_offset: 506, source_end_offset: 511, routing_role: 'REQUIREMENT_ELIGIBLE' }
  ];
  const context = buildEvaluationRangeContext({ windows: [{ spans: historical }] }, {
    selected_paragraphs: retained.map(({ paragraph, text }) => ({ paragraph, text })),
    routed_sections: [{ paragraphs: retained }],
    chunks: [{ chunk_number: 1, segments: retained }]
  });
  const projected = projectStableRangeToRetained({
    range: { start_ref: 'C003-S042', end_ref: 'C003-S043' },
    historicalSpans: historical,
    retainedSpans: retained,
    allCurrentSpans: context.allCurrentSpans,
    isExcluded: () => false
  });
  assert.deepEqual(projected && { start_ref: projected.start_ref, end_ref: projected.end_ref }, { start_ref: 'C002-S017', end_ref: 'C002-S018' });
});

test('final evaluator keeps true miss unmatched after successful provenance remap', () => {
  const historical = [{ span_id: 'H-001', paragraph: 10, text: '必须完成迁移。', source_start_offset: 700, source_end_offset: 707 }];
  const retained = [{ source_ref: 'C004-S001', paragraph: 10, text: '必须完成迁移。', source_start_offset: 700, source_end_offset: 707, routing_role: 'REQUIREMENT_ELIGIBLE' }];
  const context = buildEvaluationRangeContext({ windows: [{ spans: historical }] }, {
    selected_paragraphs: [{ paragraph: 10, text: '必须完成迁移。' }],
    routed_sections: [{ paragraphs: retained }],
    chunks: [{ chunk_number: 1, segments: retained }]
  });
  const projected = projectStableRangeToRetained({
    range: { start_ref: 'H-001', end_ref: 'H-001' },
    historicalSpans: historical,
    retainedSpans: retained,
    allCurrentSpans: context.allCurrentSpans,
    isExcluded: () => false
  });
  assert.ok(projected);
  const candidateIndex = buildStableProvenanceIndex([
    { source_ref: 'C004-S009', paragraph: 20, text: '另一个要求。', source_start_offset: 800, source_end_offset: 806 }
  ]);
  const candidateRange = resolveStableRange({ start_ref: 'C004-S009', end_ref: 'C004-S009' }, candidateIndex);
  assert.ok(candidateRange);
  assert.notEqual(candidateRange.start_key, projected.start_key);
  assert.equal(candidateRange.start_key, 'offset:800:806');
  assert.equal(projected.start_key, 'offset:700:707');
});

test('final capture evaluator remaps all FAST-01 Gold ranges before matching candidates', async () => {
  const packet = JSON.parse(await readFile(
    resolve(evalDirectory, 'requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json'), 'utf8'
  ));
  const report = JSON.parse(await readFile(
    resolve(evalDirectory, 'reports/reqx-v3-real-tender-eval-capture-v2.json'), 'utf8'
  ));
  const prepared = await buildAnnotatedPath(packet, loadBackendEnvironment());
  const sourceRun = report.runs.find((run) => run.tender_id === 'FAST-01');
  const metric = evaluateTender(packet, { candidates: sourceRun.candidates, _candidate_records: sourceRun.candidates }, prepared);
  assert.equal(metric._gold.filter((item) => item.start_ref && item.end_ref).length, 39);
  assert.equal(metric.automatic_matches.filter((item) => item.verdict === 'UNMATCHED').length, 0);
  assert.equal(metric.manual_review.length, 18);
  assert.equal(metric._candidates.length, 32);
});

test('evaluation precision denominator is TP candidates plus automatic FP candidates', () => {
  assert.equal(calculateEvaluationPrecision({ tp_candidate_count: 3, false_positive_count: 2 }), 0.6);
  assert.equal(calculateEvaluationPrecision({ tp_candidate_count: 3, false_positive_count: 2, manual_review_count: 8 }), 0.6);
  assert.equal(calculateEvaluationPrecision({ tp_candidate_count: 0, false_positive_count: 0 }), 1);
});
