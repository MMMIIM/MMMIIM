import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildBidDocumentModel, normalizeHeadingHierarchy, normalizeHeadingText, validateHeadingHierarchy } from '../src/pipeline/bid-document-model.js';
import { DocumentDeliveryService } from '../src/pipeline/document-delivery-service.js';
import { renderBidDocument, tableCellMarginForPolicy, tableWidthForPolicy } from '../src/pipeline/docx-renderer.js';
import { getDocumentFormatPolicy, getFirstLineIndentTwips, getUsableBodyWidth } from '../src/pipeline/document-format-policy.js';
import { projectFactsForDocument, projectNameForDocument } from '../src/pipeline/document-projection-policy.js';
import { createApp } from '../src/app.js';

const project = { id: 'project-word-1', name: '示例投标项目' };
const version = {
  id: 'version-word-1', project_id: project.id, generation_id: 'generation-word-1', version_number: 2,
  title: '技术响应 V2', status: 'confirmed', risk_status: 'pass', final_text: '# 总体方案\n\n正文。',
  sections_json: [{ chapter_id: 'chapter-01', title: '总体方案', order: 1, content_markdown: '## 实施路径\n\n第一段。\n\n| 项目 | 说明 |\n| --- | --- |\n| 范围 | 全部 |\n\n[[PAGE_BREAK]]\n\n第二段。' }]
};

test('Bid Document Model 保留稳定章节、标题、表格和分页内容块', () => {
  const model = buildBidDocumentModel({ project, version, approvedProjectFacts: [{ key: '投标人', value: '示例公司', review_status: 'approved' }] });
  assert.equal(model.model_version, 'bid-document-v1');
  assert.equal(model.sections[0].section_id, 'chapter-01');
  assert.deepEqual(model.sections[0].content_blocks.map((block) => block.kind), ['heading', 'paragraph', 'table', 'page_break', 'paragraph']);
  assert.equal(model.source.final_text_length, version.final_text.length);
  assert.deepEqual(model.approved_project_facts, [{ field: 'bidder', label: '投标人', value: '示例公司' }]);
  assert.equal(model.project.name, '示例投标项目');
});

test('Stage16-R1.2 H1→H3 确定性归一化为 H1→H2，不伪造父标题', () => {
  const raw = [{ section_id: 'chapter-01', content_blocks: [
    { kind: 'heading', level: 3, text: '建设目标' },
    { kind: 'heading', level: 4, text: '建设原则' }
  ] }];
  assert.equal(validateHeadingHierarchy(raw, { throwOnError: false }).valid, false);
  const normalized = normalizeHeadingHierarchy(raw);
  assert.deepEqual(normalized[0].content_blocks.map((block) => block.level), [2, 3]);
  assert.equal(validateHeadingHierarchy(normalized).valid, true);
  assert.deepEqual(normalized[0].content_blocks.map((block) => block.text), ['建设目标', '建设原则']);
});

test('Stage16-R1.2 原始同级深标题保持同级，不因前一项归一化而伪造子级', () => {
  const normalized = normalizeHeadingHierarchy([{ section_id: 'chapter-01', content_blocks: [
    { kind: 'heading', level: 3, text: '建设目标' },
    { kind: 'heading', level: 3, text: '建设原则' }
  ] }]);
  assert.deepEqual(normalized[0].content_blocks.map((block) => block.level), [2, 2]);
});

test('Stage16-R1.2 合法 H1→H2→H3 与同级 H2 保持不变', () => {
  const raw = [{ section_id: 'chapter-01', content_blocks: [
    { kind: 'heading', level: 2, text: '建设目标' },
    { kind: 'heading', level: 3, text: '建设原则' },
    { kind: 'heading', level: 2, text: '实施路径' }
  ] }];
  const normalized = normalizeHeadingHierarchy(raw);
  assert.deepEqual(normalized[0].content_blocks.map((block) => block.level), [2, 3, 2]);
  assert.equal(validateHeadingHierarchy(normalized).valid, true);
});

test('Stage16-R1.2 文档模型在渲染前修正缺失父级，保留标题正文', () => {
  const hierarchyVersion = {
    ...version,
    sections_json: [{ chapter_id: 'chapter-01', title: '项目理解', order: 1, content_markdown: '### 建设目标\n\n目标说明。' },
      { chapter_id: 'chapter-02', title: '实施方案', order: 2, content_markdown: '### 质量保证\n\n质量说明。' }]
  };
  const model = buildBidDocumentModel({ project, version: hierarchyVersion });
  assert.deepEqual(model.sections.map((section) => section.content_blocks.map((block) => block.level).filter(Boolean)), [[2], [2]]);
  assert.deepEqual(model.sections.map((section) => section.content_blocks.find((block) => block.kind === 'heading').text), ['建设目标', '质量保证']);
  assert.doesNotMatch(JSON.stringify(model), /fake|synthetic_parent|空标题/);
});

test('DOCX renderer 产生真实 Heading、目录字段、页眉页脚与正文', async () => {
  const buffer = await renderBidDocument(buildBidDocumentModel({ project, version, approvedProjectFacts: [{ key: '投标人', value: '示例公司' }] }));
  assert.ok(buffer.length > 1000);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const settingsXml = await zip.file('word/settings.xml').async('string');
  const numberingXml = await zip.file('word/numbering.xml').async('string');
  const footerFiles = Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/.test(name));
  const footerXmls = await Promise.all(footerFiles.map((name) => zip.file(name).async('string')));
  const pageFooterXmls = footerXmls.filter((xml) => /instrText[^>]*>PAGE/.test(xml));
  const footerXml = pageFooterXmls[0];
  const coverFooterXml = await zip.file('word/footer1.xml').async('string');
  assert.match(documentXml, /w:val="Heading1"/);
  assert.match(documentXml, /目 录/);
  assert.doesNotMatch(documentXml, /目录页码将在 Word\/WPS 中更新目录后显示/);
  assert.match(documentXml, /TOC/);
  assert.ok((documentXml.match(/w:sectPr/g) || []).length >= 3);
  assert.match(documentXml, /示例投标项目/);
  assert.match(documentXml, /示例公司/);
  assert.match(documentXml, /SimSun/);
  assert.match(documentXml, /SimHei/);
  assert.match(documentXml, /w:sz w:val="32"/);
  assert.match(documentXml, /w:sz w:val="28"/);
  assert.match(documentXml, /w:sz w:val="24"/);
  assert.match(documentXml, /w:firstLine="480"/);
  assert.match(documentXml, /w:spacing w:after="0" w:before="0" w:line="360"/);
  assert.match(numberingXml, /w:suff w:val="space"/);
  assert.doesNotMatch(numberingXml, /w:suff w:val="tab"/);
  assert.match(numberingXml, /w:ind w:left="360" w:hanging="180"/);
  assert.match(numberingXml, /w:ind w:left="720" w:hanging="180"/);
  assert.match(numberingXml, /w:ind w:left="1080" w:hanging="180"/);
  assert.doesNotMatch(documentXml, /项目统一信息/);
  assert.doesNotMatch(documentXml, /data_classification|synthetic|DocumentVersion|generation-word-1/);
  assert.match(documentXml, /w:tbl/);
  assert.match(documentXml, /w:tcMar/);
  assert.match(settingsXml, /updateFields/);
  assert.doesNotMatch(coverFooterXml, /PAGE/);
  assert.ok(pageFooterXmls.length >= 2, 'TOC and body must both expose the visible page field');
  assert.match(footerXml, /instrText[^>]*>PAGE/);
});

test('Stage16-R1.3 默认不强制所有章节换页，且不渲染独立分页符', async () => {
  const paginationVersion = {
    ...version,
    sections_json: [
      { chapter_id: 'chapter-01', title: '项目理解', order: 1, content_markdown: '正文内容。\n\n[[PAGE_BREAK]]\n\n后续实施安排。' },
      { chapter_id: 'chapter-02', title: '实施方案', order: 2, content_markdown: '### 质量保证\n\n质量说明。' }
    ]
  };
  const buffer = await renderBidDocument(buildBidDocumentModel({ project, version: paginationVersion }));
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  assert.doesNotMatch(documentXml, /w:pageBreakBefore/);
  assert.doesNotMatch(documentXml, /w:br w:type="page"/);
  assert.match(documentXml, /w:widowControl/);
  assert.ok(documentXml.indexOf('后续实施安排。') < documentXml.lastIndexOf('实施方案'));
});

test('Stage16-R1 文档投影只允许正式字段并拒绝技术/对象值', () => {
  assert.equal(projectNameForDocument({ name: 'E2E-PROJECT [data_classification=synthetic]' }), '');
  assert.deepEqual(projectFactsForDocument([
    { key: 'bidder_name', value: '示例公司' },
    { key: 'e2e.internal_id', value: 'PFACT-1' },
    { key: 'debug_hash', value: 'abc' },
    { key: 'project_name', value: { raw: '不应输出' } },
    { key: 'unknown_field', value: '不应输出' }
  ]), [{ field: 'bidder', label: '投标人', value: '示例公司' }]);
});

test('Stage16-R1 默认表格宽度不超过正文可用宽度且保留内边距', () => {
  const policy = getDocumentFormatPolicy();
  assert.equal(tableWidthForPolicy(policy), getUsableBodyWidth(policy));
  assert.ok(tableWidthForPolicy(policy) <= policy.page.width_dxa - policy.page.margin_dxa.left - policy.page.margin_dxa.right);
  assert.deepEqual(tableCellMarginForPolicy(policy), { top: 80, bottom: 80, left: 180, right: 180 });
});

test('Stage16-R1.1 格式策略集中表达正式标书语义', () => {
  const policy = getDocumentFormatPolicy();
  assert.equal(policy.profile_id, 'SYSTEM_DEFAULT_TECHNICAL_BID_V1');
  assert.equal(policy.profile_type, 'SYSTEM_DEFAULT');
  assert.deepEqual(policy.page.margins_cm, { top: 2.5, right: 2.5, bottom: 2.5, left: 3 });
  assert.equal(policy.body.size_pt, 12);
  assert.equal(policy.body.firstLineIndentChars, 2);
  assert.equal(policy.body.paragraph_before_pt, 0);
  assert.equal(policy.body.paragraph_after_pt, 0);
  assert.equal(policy.body.line_spacing.value, 1.5);
  assert.equal(policy.headings[1].size_pt, 16);
  assert.equal(policy.headings[2].size_pt, 14);
  assert.notEqual(policy.headings[2].size_pt, 13);
  assert.equal(policy.headings[3].size_pt, 12);
  assert.equal(policy.table.size_pt, 10.5);
  assert.equal(policy.table.width_policy, 'usable_body_width');
  assert.equal(policy.toc.updateable, true);
  assert.equal(policy.sections.toc.page_number_start, 1);
  assert.equal(policy.sections.body.page_number_start, null);
  assert.equal(getFirstLineIndentTwips(policy), 480);
});

test('Stage16-R1.1 首行缩进随正文有效字号确定性适配', async () => {
  const base = getDocumentFormatPolicy();
  const policy = { ...base, body: { ...base.body, size_pt: 14, size_half_points: 28 } };
  const buffer = await renderBidDocument(buildBidDocumentModel({ project, version }), { policy });
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  assert.equal(getFirstLineIndentTwips(policy), 560);
  assert.match(documentXml, /w:firstLine="560"/);
});

test('Stage16-R1 标题编号由后端统一生成，源标题编号不会重复', () => {
  assert.equal(normalizeHeadingText('1 项目理解'), '项目理解');
  assert.equal(normalizeHeadingText('1.1 项目背景'), '项目背景');
  assert.equal(normalizeHeadingText('第一章 项目概况'), '项目概况');
  assert.equal(normalizeHeadingText('建设目标'), '建设目标');
});

test('Word export 复用版本风险门禁并记录审计，不接受严重风险版本', async () => {
  const saved = [];
  const repository = {
    async getProject() { return project; },
    async getPipelineDocumentVersion() { return version; },
    async createDocumentExport(value) { saved.push(value); return { id: 'export-1', ...value }; }
  };
  const storage = { async save({ originalName }) { return `project-word-1/${originalName}`; } };
  const service = new DocumentDeliveryService({ repository, storage, renderer: async () => Buffer.from('docx-fixture') });
  const result = await service.exportWord({ projectId: project.id, versionId: version.id });
  assert.equal(result.fileName, '示例投标项目-技术标-V2.docx');
  assert.equal(saved[0].versionId, version.id);
  repository.getPipelineDocumentVersion = async () => ({ ...version, risk_status: 'critical' });
  await assert.rejects(() => service.exportWord({ projectId: project.id, versionId: version.id }), (error) => error.code === 'CRITICAL_RISK');
});

test('Word export 文件名移除已知内部项目标记', async () => {
  const saved = [];
  const repository = {
    async getProject() { return { ...project, name: 'E2E-DEMO [data_classification=synthetic]' }; },
    async getPipelineDocumentVersion() { return version; },
    async createDocumentExport(value) { saved.push(value); return { id: 'export-safe-name', ...value }; }
  };
  const storage = { async save({ originalName }) { return originalName; } };
  const service = new DocumentDeliveryService({ repository, storage, renderer: async () => Buffer.from('docx-fixture') });
  const result = await service.exportWord({ projectId: project.id, versionId: version.id });
  assert.equal(result.fileName, '技术标-V2.docx');
  assert.equal(saved[0].fileName, result.fileName);
});

test('Stage 4 export route returns downloadable DOCX with audit header', async () => {
  const app = createApp({ documentDeliveryService: { async exportWord() { return { buffer: Buffer.from('docx'), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: '示例-技术标-V1.docx', audit: { id: 'export-route-1' } }; } }, projectAuthorizationService: { assertProjectAccess: async () => {} }, actorResolver: () => ({ actor_id: 'delivery-test', actor_type: 'test', source: 'test' }) });
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/p1/document-versions/v1/export-word`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(response.headers.get('x-document-export-id'), 'export-route-1');
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'docx');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
