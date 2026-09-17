import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractTenderText } from '../src/tender-text-extractor.js';
import {
  annotatePdfTableLayout,
  collectPdfLayout,
  applyTableAnnotationsToChunks,
  applyTableAnnotationsToParagraphs,
  normalizeLayoutText
} from '../src/pipeline/pdf-table-layout-annotator.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../src/pipeline/requirement-chunker.js';

const ROOT = new URL('../eval/tender-benchmark-v1/sources/', import.meta.url);
const FAST = new URL('FAST-01-dapeng-healthcare.pdf', ROOT);

function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}

function paragraph(text, paragraph, page = 1) {
  return { paragraph, page, text, source_start_offset: paragraph * 10, source_end_offset: paragraph * 10 + text.length };
}

test('layout collector exposes text geometry and stroked edges without changing text extraction', async () => {
  const buffer = await readFile(FAST);
  const layout = await collectPdfLayout(buffer, { pages: [15] });
  assert.equal(layout.pages.length, 1);
  assert.ok(layout.pages[0].text_items.length > 0);
  assert.ok(layout.pages[0].text_items.every((item) => (
    typeof item.text === 'string'
      && Number.isFinite(item.bbox.x)
      && Number.isFinite(item.bbox.y)
      && Number.isFinite(item.bbox.width)
      && Number.isFinite(item.bbox.height)
      && Number.isInteger(item.order)
  )));
  assert.ok(layout.pages[0].edges.some((edge) => edge.orientation === 'v'));
  assert.ok(layout.pages[0].edges.some((edge) => edge.orientation === 'h'));
  const extraction = await extractTenderText({
    fileName: 'FAST-01-dapeng-healthcare.pdf', mimeType: 'application/pdf', buffer
  });
  assert.equal(typeof extraction.text, 'string');
  assert.equal(extraction.layout, undefined);
});

test('grid plus text annotation creates confirmed rows only with safe paragraph alignment', () => {
  const paragraphs = [
    paragraph('一级故障。', 1),
    paragraph('立即完成。', 2),
    paragraph('二级故障。', 3)
  ];
  const layout = {
    pages: [{
      page: 1,
      text_items: [
        { text: '一级', bbox: { x: 12, y: 12, width: 10, height: 10 }, order: 1 },
        { text: '故障。', bbox: { x: 32, y: 12, width: 20, height: 10 }, order: 2 },
        { text: '立即', bbox: { x: 62, y: 42, width: 20, height: 10 }, order: 3 },
        { text: '完成。', bbox: { x: 12, y: 42, width: 20, height: 10 }, order: 4 }
      ],
      edges: [
        { orientation: 'v', x1: 0, y1: 0, x2: 0, y2: 80 },
        { orientation: 'v', x1: 30, y1: 0, x2: 30, y2: 80 },
        { orientation: 'v', x1: 60, y1: 0, x2: 60, y2: 80 },
        { orientation: 'v', x1: 100, y1: 0, x2: 100, y2: 80 },
        { orientation: 'h', x1: 0, y1: 0, x2: 100, y2: 0 },
        { orientation: 'h', x1: 0, y1: 30, x2: 100, y2: 30 },
        { orientation: 'h', x1: 0, y1: 60, x2: 100, y2: 60 },
        { orientation: 'h', x1: 0, y1: 80, x2: 100, y2: 80 }
      ]
    }]
  };
  const result = annotatePdfTableLayout({ paragraphs, layout });
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((row) => row.confidence === 'GRID_CONFIRMED'));
  assert.deepEqual(result.rows[0].paragraph_numbers, [1]);
  assert.deepEqual(result.rows[1].paragraph_numbers, [2]);
  const enriched = applyTableAnnotationsToParagraphs(paragraphs, result.rows);
  assert.equal(enriched[0].table.semantic_unit_type, 'TABLE_ROW');
  assert.equal(enriched[0].table.row_id, result.rows[0].row_id);
  assert.equal(enriched[1].table.row_id, result.rows[1].row_id);
});

test('ambiguous or prose-only geometry fails closed to ordinary paragraphs', () => {
  const paragraphs = [paragraph('普通段落。', 1), paragraph('另一行。', 2)];
  const proseLayout = {
    pages: [{
      page: 1,
      text_items: [
        { text: '普通段落。', bbox: { x: 10, y: 10, width: 70, height: 10 }, order: 1 },
        { text: '另一行。', bbox: { x: 10, y: 30, width: 50, height: 10 }, order: 2 }
      ],
      edges: []
    }]
  };
  const result = annotatePdfTableLayout({ paragraphs, layout: proseLayout });
  assert.equal(result.rows.length, 0);
  assert.equal(result.ambiguous_rows, 0);
  assert.deepEqual(applyTableAnnotationsToParagraphs(paragraphs, result.rows), paragraphs);
  assert.equal(normalizeLayoutText('Ａ  B\nC'), 'A B C');
});

test('negative layout controls never promote prose, excluded text, or incomplete grids', () => {
  const negativeTexts = [
    '普通段落包装文字。', '标题\n正文要求。', '（一）列表项要求。',
    '评分标准：满足条件得分。', '商务报价及付款条款。', '合同违约责任。',
    '左栏内容与右栏内容只是双栏排版。'
  ];
  for (const text of negativeTexts) {
    const paragraphs = [{ paragraph: 1, page: 1, text }];
    const result = annotatePdfTableLayout({ paragraphs, layout: {
      pages: [{ page: 1, text_items: [{ text, bbox: { x: 10, y: 10, width: 100, height: 10 }, order: 1 }], edges: [] }]
    }});
    assert.equal(result.rows.length, 0, text);
  }
  const malformed = annotatePdfTableLayout({
    paragraphs: [{ paragraph: 1, page: 1, text: '表格内容。' }],
    layout: { pages: [{ page: 1, text_items: [{ text: '表格内容。', bbox: { x: 12, y: 12, width: 70, height: 10 }, order: 1 }], edges: [
      { orientation: 'v', x1: 0, y1: 0, x2: 0, y2: 60 },
      { orientation: 'v', x1: 30, y1: 0, x2: 30, y2: 60 },
      { orientation: 'v', x1: 60, y1: 0, x2: 60, y2: 60 },
      { orientation: 'v', x1: 100, y1: 0, x2: 100, y2: 60 },
      { orientation: 'h', x1: 0, y1: 0, x2: 100, y2: 0 }
    ] }] }
  });
  assert.equal(malformed.rows.length, 0);

  const ambiguous = annotatePdfTableLayout({
    paragraphs: [
      { paragraph: 1, page: 1, text: '甲乙内容。' },
      { paragraph: 2, page: 1, text: '甲丙内容。' }
    ],
    layout: { pages: [{ page: 1, text_items: [{ text: '甲', bbox: { x: 12, y: 12, width: 10, height: 10 }, order: 1 }], edges: [
      { orientation: 'v', x1: 0, y1: 0, x2: 0, y2: 60 },
      { orientation: 'v', x1: 30, y1: 0, x2: 30, y2: 60 },
      { orientation: 'v', x1: 60, y1: 0, x2: 60, y2: 60 },
      { orientation: 'v', x1: 100, y1: 0, x2: 100, y2: 60 },
      { orientation: 'h', x1: 0, y1: 0, x2: 100, y2: 0 },
      { orientation: 'h', x1: 0, y1: 30, x2: 100, y2: 30 },
      { orientation: 'h', x1: 0, y1: 60, x2: 100, y2: 60 }
    ] }] }
  });
  assert.equal(ambiguous.rows.length, 0);
  assert.equal(ambiguous.ambiguous_rows, 0);
});

test('FAST-01 layout produces the four SLA rows from raw geometry, without Gold constants', async () => {
  const buffer = await readFile(FAST);
  const extraction = await extractTenderText({
    fileName: 'FAST-01-dapeng-healthcare.pdf', mimeType: 'application/pdf', buffer
  });
  const layout = await collectPdfLayout(buffer, { pages: [15, 16] });
  const sourceParagraphs = extraction.paragraphs.filter((item) => item.page === 15 || item.page === 16);
  const result = annotatePdfTableLayout({ paragraphs: sourceParagraphs, layout });
  assert.ok(result.rows.length >= 4);
  assert.ok(result.rows.filter((row) => row.confidence === 'GRID_CONFIRMED').length >= 4);
  assert.ok(result.rows.some((row) => row.cells.some((cell) => /一级/.test(cell.display_text))));
  assert.ok(result.rows.some((row) => row.cells.some((cell) => /二级/.test(cell.display_text))));
  assert.ok(result.rows.some((row) => row.cells.some((cell) => /三级/.test(cell.display_text))));
  assert.ok(result.rows.some((row) => row.cells.some((cell) => /四级/.test(cell.display_text))));
  const slaRows = result.rows.filter((row) => row.cells[0]?.display_text && /^(一级|二级|三级|四级)$/.test(row.cells[0].display_text));
  assert.equal(slaRows.length, 4);
  const expectedRows = [
    ['一级', /数据库、应用信息系统等故障/, ['立即', '立即', '≦30分钟']],
    ['二级', /信息系统故障/, ['立即', '≦10分钟', '≦50分钟']],
    ['三级', /信息系统故障/, ['≦10分钟', '≦30分钟', '≦2小时']],
    ['四级', /信息系统故障/, ['≦20分钟', '≦1小时', '≦24小时']]
  ];
  for (const [index, [level, description, timings]] of expectedRows.entries()) {
    const cells = slaRows[index].cells;
    assert.equal(cells[0].display_text, level);
    assert.match(cells[1].display_text, description);
    assert.deepEqual(cells.slice(2, 5).map((cell) => cell.display_text), timings);
  }
});

test('RequirementParseService consumes confirmed PDF table rows before chunking without changing canonical text', async () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const tenderFileId = '22222222-2222-4222-8222-222222222222';
  const parseJobId = '33333333-3333-4333-8333-333333333333';
  let gatewayChunk;
  let persisted;
  const extraction = {
    text: '第一章 技术要求\n系统应提供审计日志。',
    paragraphs: [
      { paragraph: 1, page: 1, text: '第一章 技术要求' },
      { paragraph: 2, page: 1, text: '系统应提供审计日志。' }
    ],
    pages: [{ page: 1, text: '第一章 技术要求\n系统应提供审计日志。' }],
    warnings: []
  };
  const layout = {
    pages: [{
      page: 1,
      text_items: [{ text: '系统应提供审计日志。', bbox: { x: 12, y: 12, width: 76, height: 10 }, order: 1 }],
      edges: [
        { orientation: 'v', x1: 0, y1: 0, x2: 0, y2: 40 },
        { orientation: 'v', x1: 30, y1: 0, x2: 30, y2: 40 },
        { orientation: 'v', x1: 60, y1: 0, x2: 60, y2: 40 },
        { orientation: 'v', x1: 100, y1: 0, x2: 100, y2: 40 },
        { orientation: 'h', x1: 0, y1: 0, x2: 100, y2: 0 },
        { orientation: 'h', x1: 0, y1: 40, x2: 100, y2: 40 }
      ]
    }]
  };
  const repository = {
    getProject: async () => ({ id: projectId, name: '测试项目' }),
    getRequirementBaseline: async () => null,
    getTenderFile: async () => ({
      id: tenderFileId, project_id: projectId, storage_key: 'test.pdf',
      original_name: 'test.pdf', mime_type: 'application/pdf'
    }),
    createParseJob: async () => ({ id: parseJobId }),
    updateParseJob: async (job) => job,
    updateParseJobProgress: async () => {},
    saveParseDocumentAnalysis: async () => {},
    initializeParseChunks: async () => [],
    startParseChunk: async () => {},
    completeParseChunk: async () => {},
    failParseChunk: async () => {},
    completeParseJob: async (value) => {
      persisted = value;
      return { id: parseJobId, status: 'succeeded', candidates: value.candidates };
    },
    failParseJob: async (value) => { throw new Error(`unexpected parse failure: ${value.errorCode}`); }
  };
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('%PDF synthetic') },
    textExtractor: async () => extraction,
    extractionGateway: {
      extract: async ({ chunk }) => {
        gatewayChunk = chunk;
        const segment = chunk.segments.find((item) => item.paragraph === 2);
        return {
          candidates: [{
            text: segment.text, category: 'technical',
            source_range: { start_ref: segment.source_ref, end_ref: segment.source_ref },
            mandatory_observed: true, requires_confirmation: false
          }],
          warnings: [], audit: {}
        };
      }
    },
    capabilityDetector: { detect: () => ({}), assertSupported: () => ({ supported: true }) },
    pdfLayoutCollector: async () => layout
  });

  const result = await service.start({ projectId, tenderFileId, waitForCompletion: true });
  assert.equal(result.status, 'succeeded');
  assert.equal(gatewayChunk.segments.find((item) => item.paragraph === 2).semantic_unit_type, 'TABLE_ROW');
  assert.equal(gatewayChunk.table_units.length, 1);
  assert.match(gatewayChunk.model_text, /表格行：/);
  assert.equal(persisted.candidates[0].source_verified, true);
  assert.equal(persisted.candidates[0].source_text, '系统应提供审计日志。');
  assert.equal(persisted.summary.character_count, extraction.text.length);
});

test('table model text presents real header-to-value semantics for each data cell', () => {
  const header = {
    table_id: 'synthetic-table',
    row_id: 'synthetic-table-r1',
    paragraph_numbers: [1],
    cells: [
      { display_text: 'A' }, { display_text: 'B' }, { display_text: 'C' },
      { display_text: 'D' }, { display_text: 'E' }, { display_text: 'F' }
    ],
    confidence: 'GRID_CONFIRMED'
  };
  const data = {
    table_id: 'synthetic-table',
    row_id: 'synthetic-table-r2',
    paragraph_numbers: [2],
    cells: [
      { display_text: 'v1' }, { display_text: 'v2' }, { display_text: '100 GB' },
      { display_text: '元/月' }, { display_text: '68' }, { display_text: '10' }
    ],
    confidence: 'GRID_CONFIRMED'
  };
  const paragraphs = [
    paragraph('A B C D E F', 1),
    paragraph('v1 v2 100 GB 元/月 68 10', 2)
  ];
  const annotated = applyTableAnnotationsToParagraphs(paragraphs, [data], [header]);
  const result = applyTableAnnotationsToChunks([{
    chunk_number: 1,
    segments: [{ paragraph: 2, source_ref: 'C001-S002', text: paragraphs[1].text }]
  }], annotated);
  assert.match(result[0].model_text, /A=v1/);
  assert.match(result[0].model_text, /C=100 GB/);
  assert.match(result[0].model_text, /F=10/);
  assert.doesNotMatch(result[0].model_text, /表格行：v1 \| v2 \| 100 GB \| 元\/月 \| 68 \| 10/);
});

test('table header context survives when the header is in a prior chunk', () => {
  const header = {
    table_id: 'cross-chunk-table',
    row_id: 'cross-chunk-table-r1',
    paragraph_numbers: [1],
    cells: [{ display_text: '服务项' }, { display_text: '期限（月）' }],
    confidence: 'GRID_CONFIRMED'
  };
  const data = {
    table_id: 'cross-chunk-table',
    row_id: 'cross-chunk-table-r2',
    paragraph_numbers: [2],
    cells: [{ display_text: '本地备份服务' }, { display_text: '10' }],
    confidence: 'GRID_CONFIRMED'
  };
  const paragraphs = [paragraph('服务项 期限（月）', 1), paragraph('本地备份服务 10', 2)];
  const annotated = applyTableAnnotationsToParagraphs(paragraphs, [data], [header]);
  const result = applyTableAnnotationsToChunks([{
    chunk_number: 2,
    segments: [{ paragraph: 2, source_ref: 'C002-S002', text: paragraphs[1].text }]
  }], annotated);
  assert.match(result[0].model_text, /服务项=本地备份服务/);
  assert.match(result[0].model_text, /期限(?:（|\()月(?:）|\))=10/);
});

test('canonical extraction invariance baseline remains unchanged for the three real tenders', async () => {
  const expected = {
    'FAST-01-dapeng-healthcare.pdf': {
      text: '80d9f5af62e4502ac8c92fd189dc42f3b3d9f2e75b4402261fcfafb4729a319f',
      paragraphs: 2402,
      paragraph_sequence: '11dfbe0407e411986fcfc34eea7b6bed412b4dc29d242010d7554f6c7bad718b',
      pages: 'c72965bc7f73b8721a2fb4c63e973136214a6d19cca5fb6fc59f14157d3f95aa'
    },
    'FAST-WATER-01-beijing-water-ops.pdf': {
      text: '6d1e5b75ba4fa05767df18573b6558b677834d7c7a041cac8f7c56cce482d1a1',
      paragraphs: 2690,
      paragraph_sequence: '5ea643a53ce44e4f0aaa46e25db66e4cc92b08be648dbb8a63e3d3f45459f271',
      pages: '2aafc3defd028074739358fff59161045c44cf41350afbf4a773366f5aff7521'
    },
    'TB-006-beijing-emergency-model-cloud.pdf': {
      text: '9a1d0ea2e050b3878539e9d5f9d90f9e05505ede288ebb56aa8632f27b1a34b8',
      paragraphs: 2750,
      paragraph_sequence: '0f0a8b7763bea29e4f9ab5087dafdc1b4e433088d0fbaebb7e568c33c64b44e9',
      pages: '6da404c195f28e405c121dee32c1a2d53aaa662ddc7d63f8dee62a3140150c57'
    }
  };
  for (const [file, baseline] of Object.entries(expected)) {
    const buffer = await readFile(new URL(file, ROOT));
    const extraction = await extractTenderText({ fileName: file, mimeType: 'application/pdf', buffer });
    assert.equal(sha(extraction.text), baseline.text, file);
    assert.equal(extraction.paragraphs.length, baseline.paragraphs, file);
    assert.equal(sha(JSON.stringify(extraction.paragraphs.map((item) => sha(item.text)))), baseline.paragraph_sequence, file);
    assert.equal(sha(JSON.stringify(extraction.paragraphs.map((item) => item.page))), baseline.pages, file);
    const budget = resolveRequirementChunkBudget({});
    const canonicalChunks = chunkExtractedText({
      text: extraction.text, paragraphs: extraction.paragraphs, ...budget
    });
    const layout = await collectPdfLayout(buffer);
    const tableAnnotations = annotatePdfTableLayout({ paragraphs: extraction.paragraphs, layout });
    const unchangedParagraphs = applyTableAnnotationsToParagraphs(extraction.paragraphs, tableAnnotations.rows);
    const decoratedChunks = applyTableAnnotationsToChunks(canonicalChunks, unchangedParagraphs);
    assert.deepEqual(
      unchangedParagraphs.map(({ paragraph, page, text: value }) => ({ paragraph, page, text: value })),
      extraction.paragraphs.map(({ paragraph, page, text: value }) => ({ paragraph, page, text: value })),
      `${file}: canonical paragraphs`
    );
    assert.deepEqual(
      decoratedChunks.map((chunk) => ({
        source_start_offset: chunk.source_start_offset,
        source_end_offset: chunk.source_end_offset,
        refs: chunk.segments.map((segment) => segment.source_ref),
        hashes: chunk.segments.map((segment) => sha(segment.text))
      })),
      canonicalChunks.map((chunk) => ({
        source_start_offset: chunk.source_start_offset,
        source_end_offset: chunk.source_end_offset,
        refs: chunk.segments.map((segment) => segment.source_ref),
        hashes: chunk.segments.map((segment) => sha(segment.text))
      })),
      `${file}: source refs/offsets/hashes`
    );
  }
});
