import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extractTenderText } from '../src/tender-text-extractor.js';
import {
  createRequirementExtractionGateway,
  validateRequirementExtractionEnvelope
} from '../src/pipeline/requirement-extraction.js';
import { SemanticGatewayClient, SemanticGatewayError } from '../src/pipeline/semantic-gateway-client.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';
import { createApp } from '../src/app.js';
import { AppError } from '../src/errors.js';
import { normalizeUtf8FileName } from '../src/file-name.js';
import { createBackendRuntime } from '../src/backend-runtime.js';

async function createDocx(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
    </w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function createTextPdf(text) {
  const escaped = text.replace(/([\\()])/g, '\\$1');
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function gatewayResponse(raw, extraOutputs = {}) {
  return new Response(JSON.stringify({
    data: { outputs: { ...extraOutputs, response_payload_json: raw } }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function semanticClient(fetchImpl) {
  return new SemanticGatewayClient({
    apiBase: 'https://gateway.invalid/v1',
    apiKey: 'test-only',
    user: 'requirement-test',
    fetchImpl,
    timeoutMs: 100
  });
}

test('正常中文文件名保持不变，Latin-1 乱码文件名恢复为 UTF-8 中文', () => {
  const chineseName = '综合极限回归测试招标文件.docx';
  const mojibakeName = Buffer.from(chineseName, 'utf8').toString('latin1');
  assert.equal(normalizeUtf8FileName(chineseName), chineseName);
  assert.equal(normalizeUtf8FileName(mojibakeName), chineseName);
  assert.equal(normalizeUtf8FileName('tender-café.docx'), 'tender-café.docx');
});

test('真实提取器支持 DOCX、文本型 PDF 和纯文本，且不修改输入 Buffer', async () => {
  const docx = await createDocx('Support security audit logs.');
  const docxCopy = Buffer.from(docx);
  const docxResult = await extractTenderText({ fileName: 'tender.docx', mimeType: '', buffer: docx });
  assert.match(docxResult.text, /security audit logs/);
  assert.deepEqual(docx, docxCopy);

  const pdf = createTextPdf('Tender requires standard API integration.');
  const pdfResult = await extractTenderText({ fileName: 'tender.pdf', mimeType: 'application/pdf', buffer: pdf });
  assert.match(pdfResult.text, /standard API integration/);
  assert.equal(pdfResult.pages[0].page, 1);

  const text = await extractTenderText({
    fileName: 'tender.txt', mimeType: 'text/plain', buffer: Buffer.from('Requirement A\nRequirement B')
  });
  assert.equal(text.paragraphs.length, 2);
});

test('无法提取、损坏文件和不支持类型返回可读错误码', async () => {
  await assert.rejects(
    () => extractTenderText({ fileName: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('   ') }),
    (error) => error.code === 'TENDER_TEXT_EMPTY' && error.status === 422
  );
  await assert.rejects(
    () => extractTenderText({ fileName: 'broken.docx', mimeType: '', buffer: Buffer.from('broken') }),
    (error) => error.code === 'TENDER_TEXT_EXTRACTION_FAILED'
  );
  await assert.rejects(
    () => extractTenderText({ fileName: 'scan.png', mimeType: 'image/png', buffer: Buffer.from('image') }),
    (error) => error.code === 'TENDER_FILE_TYPE_UNSUPPORTED' && error.status === 415
  );
});

test('requirement_extraction 通过 think transport 且模型候选不包含 REQ-ID', async () => {
  let inputs;
  const envelope = {
    schema_version: '4.3-requirement-extraction-v3',
    task_type: 'requirement_extraction',
    status: 'success',
    data: {
      requirements: [
        { text: '提供审计日志。', category: 'technical', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }, mandatory_observed: true, requires_confirmation: false },
        { text: '支持标准接口。', category: 'technical', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, mandatory_observed: true, requires_confirmation: false }
      ]
    },
    warnings: ['页码来自文本型 PDF。']
  };
  const raw = `<think>transport-only</think>\n${JSON.stringify(envelope)}`;
  const gateway = createRequirementExtractionGateway(semanticClient(async (_url, options) => {
    inputs = JSON.parse(options.body).inputs;
    return gatewayResponse(raw);
  }));

  const result = await gateway.extract({
    fileName: 'tender.pdf',
    text: '支持标准 API 接入。\n系统应提供审计日志。',
    paragraphs: [{ paragraph: 3, page: 1, text: '支持标准 API 接入。' }]
  });

  assert.equal(inputs.task_type, 'requirement_extraction');
  assert.equal(typeof inputs.task_payload_json, 'string');
  const modelPayload = JSON.parse(inputs.task_payload_json);
  assert.deepEqual(Object.keys(modelPayload).sort(), [
    'chunk_count', 'chunk_index', 'chunk_text', 'project_name', 'section_name'
  ]);
  assert.equal(modelPayload.chunk_text, '支持标准 API 接入。\n系统应提供审计日志。');
  assert.deepEqual(result.candidates.map(({ text }) => text), [
    '提供审计日志。', '支持标准接口。'
  ]);
  assert.deepEqual(Object.keys(result.candidates[0]).sort(), [
    'category', 'mandatory_observed', 'requires_confirmation', 'source_range', 'text'
  ]);
  assert.equal(result.candidates.some((candidate) => 'req_id' in candidate), false);
  assert.equal(result.audit.raw_response_payload_json, raw);
});

test('缺失唯一允许字段时不读取 result/text/answer', async () => {
  const forbidden = JSON.stringify({
    schema_version: '4.3-requirement-extraction-v3', task_type: 'requirement_extraction', status: 'success',
    data: { requirements: [] }, warnings: []
  });
  const response = new Response(JSON.stringify({
    data: { outputs: { result: forbidden, text: forbidden, answer: forbidden } }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const gateway = createRequirementExtractionGateway(semanticClient(async () => response));
  await assert.rejects(
    () => gateway.extract({ fileName: 'a.txt', text: 'a', paragraphs: [] }),
    (error) => error.code === 'GATEWAY_RESPONSE_PAYLOAD_MISSING'
  );
});

test('非法网关候选拒绝缺失字段、空 source_text 和模型生成 REQ-ID', () => {
  const invalidData = [
    {},
    { requirements: [{ req_id: 'REQ-999', content: 'content', source_excerpt: 'source' }] },
    { requirements: [{ text: 'content', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' } }] }
  ];
  invalidData.forEach((data) => {
    assert.throws(() => validateRequirementExtractionEnvelope({
      envelope: {
        schema_version: '4.3-requirement-extraction-v3', task_type: 'requirement_extraction',
        status: 'success', data, warnings: []
      },
      audit: { provider: 'semantic_gateway' }
    }), (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID');
  });
  const validForAggregation = validateRequirementExtractionEnvelope({
    envelope: {
        schema_version: '4.3-requirement-extraction-v3', task_type: 'requirement_extraction', status: 'success',
      data: { requirements: [
        { text: 'same', category: 'technical', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }, mandatory_observed: false, requires_confirmation: false },
        { text: ' same ', category: 'technical', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, mandatory_observed: false, requires_confirmation: false }
      ] }, warnings: []
    },
    audit: { provider: 'semantic_gateway' }
  });
  assert.equal(validForAggregation.candidates.length, 2);
});

test('解析失败落审计且绝不创建或确认 Requirement 基线', async () => {
  let failedAudit;
  let completed = false;
  let confirmed = false;
  const repository = {
    getProject: async () => ({ id: 'project-1' }),
    getRequirementBaseline: async () => null,
    getTenderFile: async () => ({
      id: 'file-1', project_id: 'project-1', storage_key: 'project-1/file.txt',
      original_name: 'file.txt', mime_type: 'text/plain'
    }),
    createParseJob: async () => ({ id: 'parse-1' }),
    updateParseJob: async () => {},
    updateParseJobProgress: async () => {},
    saveParseDocumentAnalysis: async () => {},
    initializeParseChunks: async () => {},
    startParseChunk: async () => {},
    completeParseChunk: async () => {},
    failParseChunk: async () => {},
    completeParseJob: async () => { completed = true; },
    failParseJob: async (audit) => { failedAudit = audit; },
    confirmRequirementBaseline: async () => { confirmed = true; }
  };
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('技术要求：系统应提供审计日志。') },
    textExtractor: extractTenderText,
    extractionGateway: {
      extract: async () => { throw new SemanticGatewayError('GATEWAY_REQUIREMENTS_INVALID', 'invalid', { raw_response_payload_json: '{bad' }, 422); }
    },
    logger: { error: () => {} }
  });

  await assert.rejects(
    () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
    (error) => error.code === 'GATEWAY_REQUIREMENTS_INVALID'
  );
  assert.equal(completed, false);
  assert.equal(confirmed, false);
  assert.equal(failedAudit.errorCode, 'GATEWAY_REQUIREMENTS_INVALID');
  assert.match(failedAudit.gatewayAudit.raw_response_payload_json, /^\[redacted:/);
});

test('确认服务只消费成功候选并由后端路由，已冻结基线拒绝替换', async () => {
  const parseJobId = '11111111-1111-4111-8111-111111111111';
  let persisted;
  const repository = {
    getParseJob: async () => ({
      id: parseJobId, status: 'succeeded', candidates: [{
        req_id: 'REQ-001', content: '系统应提供安全审计日志。', source_excerpt: '提供安全审计日志。',
        source_text: '提供安全审计日志。', is_mandatory: false, mandatory_marker: null,
        source_section: null, source_clause_id: null,
        mandatory_scope_source_text: null, mandatory_scope_section: null, exception_clause_ids: [],
        source_page: 1, source_paragraph: 2, ordinal: 1
      }]
    }),
    confirmRequirementBaseline: async (value) => { persisted = value; return { baseline: { status: 'confirmed' }, requirements: value.requirements }; }
  };
  const service = new RequirementParseService({ repository });
  const result = await service.confirm(parseJobId, { confirmed_by: 'baseline-owner' });
  assert.equal(result.baseline.status, 'confirmed');
  assert.deepEqual(persisted.requirements[0].target_sections, ['solution-design', 'security-compliance']);

  repository.confirmRequirementBaseline = async () => { throw Object.assign(new Error('frozen'), { code: 'REQUIREMENT_BASELINE_FROZEN' }); };
  await assert.rejects(
    () => service.confirm(parseJobId, { confirmed_by: 'baseline-owner' }),
    (error) => error.code === 'REQUIREMENT_BASELINE_FROZEN' && error.status === 409
  );
});

test('解析、状态查询和基线确认 API 使用解析服务且不暴露内部审计', async () => {
  const calls = [];
  const requirementParseService = {
    start: async (value) => {
      calls.push(['start', value]);
      return { id: 'parse-1', status: 'succeeded', candidates: [] };
    },
    get: async (id) => {
      calls.push(['get', id]);
      return { id, status: 'succeeded', candidates: [], gateway_audit_json: undefined };
    },
    confirm: async (id) => {
      calls.push(['confirm', id]);
      return { baseline: { id: 'baseline-1', status: 'confirmed' }, requirements: [] };
    }
  };
  const app = createApp({
    repository: {}, storage: {}, generationService: {}, requirementParseService,
    actorResolver: () => ({ actor_id: 'tender-parse-test', actor_type: 'test', source: 'test' })
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const started = await fetch(`${base}/api/projects/project-1/tender-parse-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tender_file_id: 'file-1' })
    });
    assert.equal(started.status, 201);
    const startedPayload = await started.json();
    assert.equal(startedPayload.ok, true);
    assert.equal(startedPayload.job.id, 'parse-1');

    const queried = await fetch(`${base}/api/tender-parse-jobs/parse-1`);
    const queryPayload = await queried.json();
    assert.equal(queried.status, 200);
    assert.equal(queryPayload.ok, true);
    assert.equal(queryPayload.data.job.id, 'parse-1');
    assert.equal('gateway_audit_json' in queryPayload.data.job, false);

    const confirmed = await fetch(`${base}/api/tender-parse-jobs/parse-1/confirm`, { method: 'POST' });
    assert.equal(confirmed.status, 201);
    const confirmedPayload = await confirmed.json();
    assert.equal(confirmedPayload.ok, true);
    assert.equal(confirmedPayload.data.baseline.status, 'confirmed');

    const missing = await fetch(`${base}/api/not-a-real-route`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), {
      ok: false,
      error: { code: 'API_NOT_FOUND', message: '请求的 API 不存在，请确认前后端版本一致。' }
    });
    assert.deepEqual(calls, [
      ['start', { projectId: 'project-1', tenderFileId: 'file-1' }],
      ['get', 'parse-1'],
      ['confirm', 'parse-1']
    ]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('解析 API 合法失败统一返回安全 JSON error 契约', async () => {
  const app = createApp({
    repository: {},
    storage: {},
    generationService: {},
    requirementParseService: {
      start: async () => {
        throw new AppError('GATEWAY_INVALID_JSON', '需求提取服务返回格式无效。', 422, {
          raw_response_payload_json: 'never expose this raw response'
        });
      }
    }
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/projects/project-1/tender-parse-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tender_file_id: 'file-1' })
    });
    const payload = await response.json();
    assert.equal(response.status, 422);
    assert.deepEqual(payload, {
      ok: false,
      error: { code: 'GATEWAY_INVALID_JSON', message: '需求提取服务返回格式无效。' }
    });
    assert.doesNotMatch(JSON.stringify(payload), /raw response|stack|prompt/i);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('完整 tender parse service 使用 V43 网关地址且忽略旧 DIFY 配置', async () => {
  const projectId = '22222222-2222-4222-8222-222222222222';
  const tenderFileId = '33333333-3333-4333-8333-333333333333';
  const parseJobId = '44444444-4444-4444-8444-444444444444';
  let requestedUrl;
  let persisted;
  const raw = JSON.stringify({
    schema_version: '4.3-requirement-extraction-v3',
    task_type: 'requirement_extraction',
    status: 'success',
    data: {
      requirements: [{
        text: '系统应提供审计日志。',
        category: 'technical',
        source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
        mandatory_observed: true,
        requires_confirmation: false
      }]
    },
    warnings: []
  });
  const runtime = createBackendRuntime({
    loadEnvironment: false,
    env: {
      V43_GATEWAY_API_BASE: 'http://127.0.0.1:18080/v1',
      V43_GATEWAY_API_KEY: 'v43-test-key',
      V43_GATEWAY_USER: 'v43-test-user',
      SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
      SEMANTIC_GATEWAY_API_KEY: 'standalone-test-key',
      SEMANTIC_GATEWAY_USER: 'standalone-test-user',
      DIFY_API_BASE: 'https://api.dify.invalid/v1',
      DIFY_API_KEY: 'legacy-test-key'
    }
  });
  const gatewayClient = runtime.createSemanticGatewayClient({
    taskType: 'requirement_extraction',
    fetchImpl: async (url) => {
      requestedUrl = url;
      return gatewayResponse(raw);
    },
    logger: { warn: () => {} }
  });
  const repository = {
    getProject: async () => ({ id: projectId }),
    getRequirementBaseline: async () => null,
    getTenderFile: async () => ({
      id: tenderFileId,
      project_id: projectId,
      storage_key: `${projectId}/tender.txt`,
      original_name: 'tender.txt',
      mime_type: 'text/plain'
    }),
    createParseJob: async () => ({ id: parseJobId }),
    updateParseJob: async () => {},
    updateParseJobProgress: async () => {},
    saveParseDocumentAnalysis: async () => {},
    initializeParseChunks: async () => {},
    startParseChunk: async () => {},
    completeParseChunk: async () => {},
    failParseChunk: async () => {},
    completeParseJob: async (value) => {
      persisted = value;
      return { id: parseJobId, status: 'succeeded', candidates: value.candidates };
    },
    failParseJob: async () => { throw new Error('must not fail'); }
  };
  const service = new RequirementParseService({
    repository,
    storage: { read: async () => Buffer.from('系统应提供审计日志。') },
    textExtractor: async () => ({
      text: '系统应提供审计日志。',
      paragraphs: [{ paragraph: 1, page: 1, text: '系统应提供审计日志。' }],
      pages: [{ page: 1, text: '系统应提供审计日志。' }],
      warnings: []
    }),
    extractionGateway: createRequirementExtractionGateway(gatewayClient)
  });

  const result = await service.start({ projectId, tenderFileId, waitForCompletion: true });
  assert.equal(result.status, 'succeeded');
  assert.equal(requestedUrl, 'http://127.0.0.1:18082/workflows/run');
  assert.doesNotMatch(requestedUrl, /api\.dify\.invalid/);
  assert.equal(persisted.candidates[0].req_id, 'REQ-001');
});

test('非法 tender parse job id 返回 400 INVALID_JOB_ID 且不访问数据库', async () => {
  let repositoryCalled = false;
  const service = new RequirementParseService({
    repository: {
      getParseJob: async () => { repositoryCalled = true; return null; }
    }
  });
  await assert.rejects(
    () => service.get('not-a-uuid'),
    (error) => error.code === 'INVALID_JOB_ID' && error.status === 400
  );
  await assert.rejects(
    () => service.confirm('also-invalid'),
    (error) => error.code === 'INVALID_JOB_ID' && error.status === 400
  );
  assert.equal(repositoryCalled, false);

  const app = createApp({
    repository: {},
    storage: {},
    generationService: {},
    requirementParseService: service
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/tender-parse-jobs/not-a-uuid`);
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_JOB_ID');
    assert.equal(payload.error.message, '需求解析任务 ID 格式无效。');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
