import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateRequirementCandidates,
  mapRequirementCandidateToCanonicalInput,
  chunkExtractedText,
  isTitleBoundary,
  resolveRequirementChunkBudget
} from '../src/pipeline/requirement-chunker.js';
import { RequirementParseService } from '../src/requirement-parse-service.js';
import {
  SemanticGatewayError,
  createSemanticGatewayClientFromEnv,
  parseSemanticGatewayConfig
} from '../src/pipeline/semantic-gateway-client.js';

function extractionFor(paragraphTexts) {
  return {
    text: paragraphTexts.join('\n'),
    paragraphs: paragraphTexts.map((text, index) => ({
      paragraph: index + 1, page: Math.floor(index / 2) + 1, text
    })),
    pages: [],
    warnings: []
  };
}

function extractionWithParagraphs(paragraphs) {
  return {
    text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
    paragraphs: paragraphs.map((paragraph, index) => ({
      paragraph: index + 1, page: paragraph.page || 1, ...paragraph
    })),
    pages: [],
    warnings: []
  };
}

function createRepository() {
  const state = { chunks: [], completedChunks: [], failedChunks: [], completedJob: null, failedJob: null };
  return {
    state,
    getProject: async () => ({ id: 'project-1' }),
    getRequirementBaseline: async () => null,
    getTenderFile: async () => ({
      id: 'file-1', project_id: 'project-1', storage_key: 'project-1/tender.txt',
      original_name: 'tender.txt', mime_type: 'text/plain'
    }),
    createParseJob: async () => ({ id: 'parse-1', status: 'queued' }),
    updateParseJob: async (_id, status, options) => ({ id: 'parse-1', status, phase: options.phase }),
    updateParseJobProgress: async (value) => { state.progress = value; },
    saveParseDocumentAnalysis: async (value) => { state.documentAnalysis = value; },
    initializeParseChunks: async (_id, chunks) => { state.chunks = chunks; },
    startParseChunk: async () => {},
    completeParseChunk: async (value) => { state.completedChunks.push(value); },
    failParseChunk: async (value) => { state.failedChunks.push(value); },
    completeParseJob: async (value) => {
      state.completedJob = value;
      return { id: value.jobId, status: 'succeeded', phase: 'succeeded', candidates: value.candidates };
    },
    failParseJob: async (value) => { state.failedJob = value; return value; }
  };
}

function serviceFor({ extraction, gateway, chunkBudget, scopeValidator }) {
  const repository = createRepository();
  return {
    repository,
    service: new RequirementParseService({
      repository,
      storage: { read: async () => Buffer.from('test') },
      textExtractor: async () => extraction,
      extractionGateway: gateway,
      chunkBudget,
      scopeValidator,
      logger: { error: () => {} }
    })
  };
}

test('短文件稳定形成单片并保留页码、段落和 source offsets', () => {
  const extraction = extractionFor(['第一章 范围', '系统应提供审计日志。']);
  const chunks = chunkExtractedText({
    ...extraction, characterBudget: 200, tokenBudget: 200
  });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].source_start_page, 1);
  assert.equal(chunks[0].source_end_paragraph, 2);
  assert.equal(chunks[0].source_start_offset, 0);
  assert.equal(chunks[0].source_end_offset, extraction.text.length);
});

test('长文件按预算形成多片且每片不超字符与 token 预算', () => {
  const extraction = extractionFor(Array.from({ length: 8 }, (_, index) => `要求${index + 1}：${'安全审计'.repeat(8)}`));
  const chunks = chunkExtractedText({
    ...extraction, singleCallThreshold: 1, characterBudget: 55, tokenBudget: 55
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 55));
  assert.ok(chunks.every((chunk) => chunk.estimated_token_count <= 55));
});

test('标题边界确定性开启新分片', () => {
  assert.equal(isTitleBoundary('第二章 技术要求'), true);
  const extraction = extractionFor([
    '第一章 范围', '范围说明。'.repeat(16), '第二章 安全要求', '需记录审计日志。'
  ]);
  const chunks = chunkExtractedText({
    ...extraction, singleCallThreshold: 1, characterBudget: 100, tokenBudget: 100
  });
  assert.equal(chunks.length, 2);
  assert.match(chunks[0].text, /^第一章/);
  assert.match(chunks[1].text, /^第二章/);
  assert.equal(chunks[1].starts_at_title_boundary, true);
});

test('Candidate 到 Canonical Requirement 的字段映射是显式且单向的', () => {
  const mapped = mapRequirementCandidateToCanonicalInput({
    text: '提供审计日志。',
    category: 'technical',
    source_refs: ['C001-S001'],
    source_text: '系统应提供审计日志。',
    source_clause_id: '5.1',
    mandatory_observed: true,
    requires_confirmation: false
  }, 1, { allowBackendProvenance: true });
  assert.equal(mapped.content, '提供审计日志。');
  assert.equal(mapped.source_excerpt, '系统应提供审计日志。');
  assert.equal(mapped.source_clause_id, '5.1');
  assert.equal(Object.hasOwn(mapped, 'candidate'), false);
  assert.equal(Object.hasOwn(mapped, 'candidate_index'), false);
  assert.equal(Object.hasOwn(mapped, 'text'), false);
  assert.equal(mapRequirementCandidateToCanonicalInput({
    text: '旧别名', source_refs: ['C001-S001'], source_text: '旧来源',
    category: 'technical', mandatory_observed: false, requires_confirmation: false
  }, 1), null);
});

test('汇总在分配 REQ-ID 前只合并完全重复候选', () => {
  const candidates = aggregateRequirementCandidates([
    { chunk_number: 1, candidates: [
      { text: '', source_refs: ['C001-S001'], category: 'technical', mandatory_observed: false, requires_confirmation: false },
      { text: '提供审计日志。', source_refs: ['C001-S002'], source_text: '来源一', category: 'technical', source_clause_id: null, mandatory_observed: false, requires_confirmation: false, source_page: 1, source_paragraph: 2 }
    ] },
    { chunk_number: 2, candidates: [
      { text: ' 提供审计日志。 ', source_refs: ['C002-S001'], source_text: '来源二', category: 'technical', source_clause_id: null, mandatory_observed: false, requires_confirmation: false, source_page: 2, source_paragraph: 5 },
      { text: '支持标准接口。', source_refs: ['C002-S002'], source_text: '来源三', category: 'technical', source_clause_id: null, mandatory_observed: false, requires_confirmation: false, source_page: 2, source_paragraph: 6 }
    ] }
  ]);
  assert.deepEqual(candidates.map(({ req_id, content }) => ({ req_id, content })), [
    { req_id: 'REQ-001', content: '提供审计日志。' },
    { req_id: 'REQ-002', content: '提供审计日志。' },
    { req_id: 'REQ-003', content: '支持标准接口。' }
  ]);
  assert.equal(candidates[0].sources.length, 1);
  assert.equal(candidates[1].sources.length, 1);
});

test('所有候选均为空时汇总失败', () => {
  assert.throws(
    () => aggregateRequirementCandidates([{ chunk_number: 1, candidates: [{ text: '', source_refs: ['C001-S001'], category: 'technical', mandatory_observed: false, requires_confirmation: false }] }]),
    (error) => error.code === 'NO_REQUIREMENTS_EXTRACTED'
  );
});

test('仅被范围排除的候选会审计并以 succeeded_empty 完成分片', async () => {
  const { service, repository } = serviceFor({
    extraction: extractionFor(['第一章 技术要求', '系统应提供审计日志。']),
    chunkBudget: { singleCallThreshold: 1, characterBudget: 200, tokenBudget: 200 },
    scopeValidator: () => {
      throw Object.assign(new Error('候选来源范围仅包含非需求范围内容。'), {
        code: 'REQUIREMENT_SCOPE_EXCLUDED', status: 422, scope_roles: ['SCORING']
      });
    },
    gateway: {
      extract: async () => ({
        candidates: [{ text: '评分项', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }],
        warnings: [], audit: { provider: 'semantic_gateway' }
      })
    }
  });
  await assert.rejects(
    () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
    (error) => error.code === 'NO_REQUIREMENTS_EXTRACTED'
  );
  assert.equal(repository.state.completedChunks.length, 1);
  assert.equal(repository.state.completedChunks[0].candidateCount, 0);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.scope_rejected, 1);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.outcome, 'SUCCESS_EMPTY_AFTER_SCOPE_FILTER');
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.rejections[0].scope_decision, 'OUT_OF_SCOPE');
  assert.equal(repository.state.failedJob.errorCode, 'NO_REQUIREMENTS_EXTRACTED');
});

test('混合范围候选只保留可接受候选并记录范围拒绝', async () => {
  const { service, repository } = serviceFor({
    extraction: extractionFor(['第一章 技术要求', '系统应提供审计日志。', '系统应保留操作记录。']),
    chunkBudget: { singleCallThreshold: 1, characterBudget: 200, tokenBudget: 200 },
    scopeValidator: (candidate) => {
      if (candidate.text === '评分项') {
        throw Object.assign(new Error('候选来源范围仅包含非需求范围内容。'), {
          code: 'REQUIREMENT_SCOPE_EXCLUDED', status: 422, scope_roles: ['SCORING']
        });
      }
      return { eligible: true, roles: ['REQUIREMENT_ELIGIBLE'] };
    },
    gateway: {
      extract: async () => ({
        candidates: [
          { text: '提供审计日志。', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, category: 'technical', mandatory_observed: false, requires_confirmation: false },
          { text: '评分项', source_range: { start_ref: 'C001-S003', end_ref: 'C001-S003' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }
        ], warnings: [], audit: { provider: 'semantic_gateway' }
      })
    }
  });
  const result = await service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true });
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.candidates.map((candidate) => candidate.content), ['提供审计日志。']);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.raw_candidates, 2);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.scope_accepted, 1);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.scope_rejected, 1);
});

test('模型返回空候选时以 SUCCESS_EMPTY 完成分片并继续后续分片', async () => {
  const { service, repository } = serviceFor({
    extraction: extractionFor(['第一章 技术要求', '没有可抽取的需求。', '系统应提供审计日志。', '系统应保留操作记录。']),
    chunkBudget: { singleCallThreshold: 1, characterBudget: 35, tokenBudget: 35 },
    gateway: { extract: async ({ chunk }) => ({
      candidates: chunk.chunk_number === 1 ? [] : [{
        text: '保留操作记录。', source_range: { start_ref: chunk.segments.at(-1).source_ref, end_ref: chunk.segments.at(-1).source_ref },
        category: 'technical', mandatory_observed: false, requires_confirmation: false
      }], warnings: [], audit: { provider: 'semantic_gateway' }
    }) }
  });
  const result = await service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true });
  assert.equal(result.status, 'succeeded');
  assert.ok(repository.state.chunks.length > 1);
  assert.equal(repository.state.completedChunks[0].gatewayAudit.scope_audit.outcome, 'SUCCESS_EMPTY');
  assert.ok(repository.state.completedChunks.some((item) => item.candidateCount > 0));
  assert.equal(repository.state.failedJob, null);
});

test('多分片中的仅范围排除分片不会阻断后续有效分片', async () => {
  const paragraphs = [
    { text: '第一章 技术要求' },
    ...Array.from({ length: 8 }, (_, index) => ({ text: `系统应提供审计日志${index + 1}。` }))
  ];
  const { service, repository } = serviceFor({
    extraction: extractionWithParagraphs(paragraphs),
    chunkBudget: { singleCallThreshold: 1, characterBudget: 35, tokenBudget: 35 },
    scopeValidator: (_candidate, chunk) => {
      if (chunk.chunk_number === 1) {
        throw Object.assign(new Error('候选来源范围仅包含非需求范围内容。'), {
          code: 'REQUIREMENT_SCOPE_EXCLUDED', status: 422, scope_roles: ['SCORING']
        });
      }
      return { eligible: true, roles: ['REQUIREMENT_ELIGIBLE'] };
    },
    gateway: {
      extract: async ({ chunk }) => {
        const ref = chunk.segments[0].source_ref;
        return {
          candidates: [{ text: `有效候选${chunk.chunk_number}`, source_range: { start_ref: ref, end_ref: ref }, category: 'technical', mandatory_observed: false, requires_confirmation: false }],
          warnings: [], audit: { provider: 'semantic_gateway' }
        };
      }
    }
  });
  const result = await service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true });
  assert.ok(repository.state.chunks.length > 1);
  assert.equal(result.status, 'succeeded');
  assert.ok(result.candidates.length > 0);
  assert.equal(repository.state.failedJob, null);
  assert.equal(repository.state.completedChunks.length, repository.state.chunks.length);
  assert.ok(repository.state.completedChunks.some((item) => item.gatewayAudit.scope_audit.outcome === 'SUCCESS_EMPTY_AFTER_SCOPE_FILTER'));
});

test('长文件以最多 2 个并发处理且按 chunk_number 稳定汇总', async () => {
  const extraction = extractionFor([
    '第一章 技术要求', '系统应提供审计日志。',
    '第二章 服务接口需求', '系统应提供审计日志。', '支持标准接口。'
  ]);
  let active = 0;
  let maxActive = 0;
  let gatewayCalls = 0;
  const { service, repository } = serviceFor({
    extraction,
    chunkBudget: { singleCallThreshold: 1, characterBudget: 35, tokenBudget: 35 },
    gateway: {
      extract: async ({ chunk }) => {
        gatewayCalls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, chunk.chunk_number === 1 ? 20 : 5));
        active -= 1;
        return {
          candidates: chunk.chunk_number === 1
            ? [{ text: '提供审计日志。', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }]
            : [
              { text: '提供审计日志。', source_range: { start_ref: 'C002-S001', end_ref: 'C002-S001' }, category: 'technical', mandatory_observed: false, requires_confirmation: false },
              { text: '支持标准接口。', source_range: { start_ref: 'C002-S002', end_ref: 'C002-S002' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }
            ],
          warnings: [], audit: { provider: 'semantic_gateway' }
        };
      }
    }
  });
  const result = await service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true });
  assert.ok(maxActive <= 2);
  assert.equal(maxActive, 2);
  assert.ok(repository.state.chunks.length >= 2);
  assert.equal(gatewayCalls, repository.state.chunks.length);
  assert.deepEqual(result.candidates.map((candidate) => candidate.content), ['提供审计日志。', '支持标准接口。']);
  assert.deepEqual(result.candidates.map((candidate) => candidate.req_id), ['REQ-001', 'REQ-002']);
  assert.equal(result.candidates[0].deduplication.merged_candidate_count, 2);
  assert.equal(repository.state.completedChunks.length, repository.state.chunks.length);
  assert.equal(repository.state.failedJob, null);
});

test('unknown 或反向 source_range 使当前 chunk 失败且不完成解析基线', async () => {
  const cases = [
    ['C001-S999', 'C001-S999'],
    ['C001-S003', 'C001-S001']
  ];
  for (const sourceRefs of cases) {
    const { service, repository } = serviceFor({
      extraction: extractionFor([
        '第一章 技术要求', '系统应提供审计日志。', '系统应保留操作记录。', '系统应支持审计查询。'
      ]),
      chunkBudget: { singleCallThreshold: 1, characterBudget: 200, tokenBudget: 200 },
      gateway: {
        extract: async () => ({
          candidates: [{
            text: '提供审计日志。', category: 'technical',
            source_range: { start_ref: sourceRefs[0], end_ref: sourceRefs.at(-1) },
            mandatory_observed: true, requires_confirmation: false
          }], warnings: [], audit: {}
        })
      }
    });
    await assert.rejects(
      () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
      (error) => error.code === 'SOURCE_LOCATION_UNRESOLVED'
    );
    assert.equal(repository.state.completedJob, null);
    assert.ok(repository.state.failedJob);
    assert.equal(repository.state.failedJob.failedChunkNumber, 1);
  }
});

test('单片超时保存失败分片与耗时，不完成任务或创建部分基线', async () => {
  const extraction = extractionFor(['第一章 技术要求', '要求一。', '第二章 安全需求', '要求二。']);
  const { service, repository } = serviceFor({
    extraction,
    chunkBudget: { singleCallThreshold: 1, characterBudget: 40, tokenBudget: 40 },
    gateway: {
      extract: async ({ chunk }) => {
        throw new SemanticGatewayError('GATEWAY_TIMEOUT', 'Semantic Gateway 请求超时。', {
          provider: 'semantic_gateway', timeout_ms: 120000
        }, 504);
      }
    }
  });
  await assert.rejects(
    () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
    (error) => error.code === 'GATEWAY_TIMEOUT'
  );
  assert.equal(repository.state.completedJob, null);
  assert.equal(repository.state.failedChunks[0].chunkNumber, 1);
  assert.equal(repository.state.failedJob.errorCode, 'GATEWAY_TIMEOUT');
  assert.equal(repository.state.failedJob.failedChunkNumber, 1);
  assert.match(repository.state.failedJob.errorMessage, /分片 1\//);
});

test('非法分片输出或汇总失败均不得完成任务', async () => {
  for (const error of [
    new SemanticGatewayError('GATEWAY_REQUIREMENTS_INVALID', '候选需求输出契约无效。', {}, 422),
    null
  ]) {
    const { service, repository } = serviceFor({
      extraction: extractionFor(['技术要求：系统应提供能力。']),
      chunkBudget: { singleCallThreshold: 1, characterBudget: 100, tokenBudget: 100 },
      gateway: {
        extract: async () => {
          if (error) throw error;
          return { candidates: [{ text: '', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }], warnings: [], audit: {} };
        }
      }
    });
    await assert.rejects(
      () => service.start({ projectId: 'project-1', tenderFileId: 'file-1', waitForCompletion: true }),
      (caught) => caught.code === (error ? 'GATEWAY_REQUIREMENTS_INVALID' : 'NO_REQUIREMENTS_EXTRACTED')
    );
    assert.equal(repository.state.completedJob, null);
    assert.ok(repository.state.failedJob);
  }
});

test('解析 API 默认立即返回 running，后台任务由调度器接管', async () => {
  let scheduled;
  const repository = createRepository();
  const service = new RequirementParseService({
    repository,
    scheduler: (task) => { scheduled = task; },
    storage: { read: async () => Buffer.from('test') },
    textExtractor: async () => extractionFor(['要求一。']),
    extractionGateway: { extract: async () => ({ candidates: [], warnings: [], audit: {} }) }
  });
  const result = await service.start({ projectId: 'project-1', tenderFileId: 'file-1' });
  assert.equal(result.status, 'running');
  assert.equal(result.phase, 'text_extraction');
  assert.equal(typeof scheduled, 'function');
  assert.equal(repository.state.completedJob, null);
});

test('5,610 中文字符与 134 段按来源段预算形成稳定分片', () => {
  const paragraphTexts = [
    ...Array.from({ length: 133 }, () => '中'.repeat(40)),
    '中'.repeat(157)
  ];
  const extraction = extractionFor(paragraphTexts);
  assert.equal(extraction.text.length, 5610);
  assert.equal(extraction.paragraphs.length, 134);
  const chunks = chunkExtractedText({
    ...extraction,
    singleCallThreshold: 8000,
    characterBudget: 8000,
    tokenBudget: 8000
  });
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 8000));
  assert.ok(chunks.every((chunk) => chunk.segments.length <= 100));
});

test('超过 8,000 字符才启用 8,000 字符确定性分片', () => {
  const below = extractionFor(['中'.repeat(8000)]);
  const above = extractionFor(['中'.repeat(6000), '中'.repeat(6001)]);
  assert.equal(chunkExtractedText({
    ...below, singleCallThreshold: 8000, characterBudget: 8000, tokenBudget: 8000
  }).length, 1);
  const chunks = chunkExtractedText({
    ...above, singleCallThreshold: 8000, characterBudget: 8000, tokenBudget: 8000
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.character_count <= 8000));
});

test('requirement_extraction 默认 300 秒、healthcheck 15 秒且配置传入 Client', () => {
  const config = parseSemanticGatewayConfig({
    V43_GATEWAY_TIMEOUT_MS: '30000'
  });
  assert.equal(config.taskTimeouts.healthcheck, 15000);
  assert.equal(config.taskTimeouts.requirement_extraction, 300000);
  assert.notEqual(config.taskTimeouts.healthcheck, config.taskTimeouts.requirement_extraction);
  const client = createSemanticGatewayClientFromEnv({
    env: {
      V43_GATEWAY_API_BASE: 'http://127.0.0.1:18080/v1',
      V43_GATEWAY_API_KEY: 'test-only',
      V43_GATEWAY_USER: 'test-user',
      V43_GATEWAY_HEALTHCHECK_TIMEOUT_MS: '15000',
      V43_GATEWAY_REQUIREMENT_EXTRACTION_TIMEOUT_MS: '300000'
    },
    fetchImpl: async () => { throw new Error('must not call'); }
  });
  assert.equal(client.taskTimeouts.healthcheck, 15000);
  assert.equal(client.taskTimeouts.requirement_extraction, 300000);
  assert.deepEqual(resolveRequirementChunkBudget({
    REQUIREMENT_SINGLE_CALL_CHAR_THRESHOLD: '8000',
    REQUIREMENT_CHUNK_CHAR_BUDGET: '8000', REQUIREMENT_CHUNK_TOKEN_BUDGET: '8000'
  }), { singleCallThreshold: 8000, characterBudget: 8000, tokenBudget: 8000, sourceSpanBudget: 100 });
});

test('数据库任务领取锁保证同一 job/chunk 不会被重复调用', async () => {
  let gatewayCalls = 0;
  const { service, repository } = serviceFor({
    extraction: extractionFor(['第四章 项目要求和有关说明', '系统应记录审计日志。']),
    chunkBudget: { singleCallThreshold: 8000, characterBudget: 8000, tokenBudget: 8000 },
    gateway: { extract: async () => { gatewayCalls += 1; await Promise.resolve(); return { candidates: [{ text: '记录审计日志。', source_range: { start_ref: 'C001-S002', end_ref: 'C001-S002' }, category: 'technical', mandatory_observed: false, requires_confirmation: false }], warnings: [], audit: {} }; } }
  });
  let claimed = false;
  repository.claimParseJob = async () => {
    if (claimed) return null;
    claimed = true;
    return { id: 'parse-1', status: 'running', phase: 'section_classification' };
  };
  repository.getParseJob = async () => ({ id: 'parse-1', status: 'running', phase: 'section_classification' });
  const job = { id: 'parse-1', status: 'running', phase: 'text_extraction' };
  const tenderFile = await repository.getTenderFile();
  const [first, duplicate] = await Promise.all([
    service.processJob({ job, tenderFile }),
    service.processJob({ job, tenderFile })
  ]);
  assert.equal(first.status, 'succeeded');
  assert.equal(duplicate.status, 'running');
  assert.equal(gatewayCalls, 1);
});
