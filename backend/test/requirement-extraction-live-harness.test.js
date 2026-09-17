import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRequirementExtractionLiveRequest
} from '../src/verification/requirement-extraction-live-input.js';
import {
  chunkExtractedText,
  resolveRequirementChunkBudget
} from '../src/pipeline/requirement-chunker.js';
import { combineRequirementExtractionSections } from '../src/pipeline/requirement-scope-router.js';
import {
  defaultLiveExecutor,
  FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH,
  FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH,
  runRequirementExtractionLive
} from '../src/verification/requirement-extraction-verifier.js';
import { sanitizeVerificationReport } from '../src/verification/requirement-extraction-report.js';

const env = {
  SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
  SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
  SEMANTIC_GATEWAY_API_KEY: 'service-test-key',
  SEMANTIC_GATEWAY_USER: 'verification-test',
  SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.test/v1',
  SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'provider-test-key',
  SEMANTIC_GATEWAY_MODEL: 'test-model'
};

function gatewayResponse(candidate, diagnosticOverrides = {}) {
  return new Response(JSON.stringify({
    data: {
      outputs: {
        response_payload_json: JSON.stringify({
          schema_version: '4.3-requirement-extraction-v3.1.1',
          task_type: 'requirement_extraction',
          status: 'success',
          data: { requirements: [candidate] },
          warnings: []
        })
      }
    },
    probe_diagnostics: {
      provider_adapter_invoked: true,
      fetch_invoked: true,
      provider_http_reached: true,
      provider_http_status: 200,
      finish_reason: 'stop',
      output_truncated: false,
      completion_tokens: 12,
      ...diagnosticOverrides
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function fetchFor(candidate) {
  return async (url, options) => {
    assert.match(url, /\/workflows\/run$/);
    assert.equal(options.method, 'POST');
    return gatewayResponse(candidate);
  };
}

function healthyFetch(url) {
  if (url.endsWith('/api/health')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  if (url.endsWith('/health')) return new Response(JSON.stringify({ service: 'semantic-gateway' }), { status: 200 });
  if (url.endsWith('/ready')) return new Response(JSON.stringify({ status: 'ready', provider_configured: true }), { status: 200 });
  if (url.endsWith('/info')) return new Response(JSON.stringify({
    service: 'semantic-gateway', task_registry_loaded: true,
    task_types: ['requirement_extraction'],
    requirement_extraction_contract_version: '4.3-requirement-extraction-v3.1.1',
    requirement_extraction_prompt_hash: FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH,
    candidate_schema_contract_version: '4.3-requirement-candidate-v3',
    candidate_schema_sha256: FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH
  }), { status: 200 });
  throw new Error(`unexpected url ${url}`);
}

function candidate(sourceRange = { start_ref: 'C001-S001', end_ref: 'C001-S001' }) {
  return {
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: sourceRange,
    mandatory_observed: true,
    requires_confirmation: false
  };
}

test('missing live payload is rejected without an executor call', async () => {
  let calls = 0;
  const result = await runRequirementExtractionLive({
    env,
    confirmLiveRun: true,
    gitInfo: { branch: 'feat/v4.3-semantic-boundary-routing', revision: 'test', tracked_clean: true },
    fetchImpl: healthyFetch,
    liveExecutor: async () => { calls += 1; return {}; },
    writeReport: false
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.blockers.includes('LIVE_PAYLOAD_REQUIRED'));
  assert.equal(calls, 0);
});

test('raw FAST-01-like input uses the production multi-chunk budget and preserves spans', () => {
  const text = Array.from({ length: 255 }, (_, index) => `第${index + 1}条${'中'.repeat(15)}`).join('\n');
  const request = buildRequirementExtractionLiveRequest({ text });
  const repeated = buildRequirementExtractionLiveRequest({ text });
  assert.ok(request.chunkCount > 1);
  assert.deepEqual(repeated.chunks, request.chunks);
  assert.equal(request.chunk, null);
  assert.equal(request.chunks.length, request.chunkCount);
  assert.ok(request.chunks.every((chunk) => chunk.character_count <= 2_000));
  assert.ok(request.chunks.every((chunk) => chunk.segments.length <= 100));
  const refs = request.chunks.flatMap((chunk) => chunk.segments.map((segment) => segment.source_ref));
  assert.equal(refs.length, 255);
  assert.equal(new Set(refs).size, refs.length);
  assert.deepEqual(refs.slice(0, 3), ['C001-S001', 'C001-S002', 'C001-S003']);
  assert.equal(refs.at(-1), `C${String(request.chunkCount).padStart(3, '0')}-S${String(request.chunks.at(-1).segments.length).padStart(3, '0')}`);
  assert.match(request.chunks[0].model_text, /^\[C001-S001\] /);
});

test('combined requirement scope preserves document-order absolute offsets across overlapping sections', () => {
  const documentText = `${'前置内容。'.repeat(24)}第一段要求。\n第二段要求。\n第三段要求。`;
  const firstStart = documentText.indexOf('第一段要求。');
  const secondStart = documentText.indexOf('第二段要求。');
  const thirdStart = documentText.indexOf('第三段要求。');
  const paragraph = (text, start, number) => ({
    text, paragraph: number, source_start_offset: start,
    source_end_offset: start + text.length
  });
  const sections = [
    {
      section_key: 'technical_requirements',
      title: '技术要求',
      archive_role: 'requirement_extraction',
      source_start_offset: firstStart,
      paragraphs: [paragraph('第一段要求。', firstStart, 1), paragraph('第三段要求。', thirdStart, 3)]
    },
    {
      section_key: 'unknown_section_1',
      title: '补充要求',
      archive_role: 'unknown_section',
      source_start_offset: secondStart,
      paragraphs: [paragraph('第二段要求。', secondStart, 2)]
    }
  ];
  const scope = combineRequirementExtractionSections(sections);
  assert.deepEqual(scope.paragraphs.map((item) => item.text), ['第一段要求。', '第二段要求。', '第三段要求。']);
  const chunks = chunkExtractedText({
    text: scope.content_text,
    paragraphs: scope.paragraphs,
    singleCallThreshold: 1,
    characterBudget: 10,
    tokenBudget: 100,
    sourceSpanBudget: 2
  });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.source_start_offset >= 0
    && chunk.source_end_offset > chunk.source_start_offset
    && chunk.source_end_offset <= documentText.length));
  assert.deepEqual(chunks, chunkExtractedText({
    text: scope.content_text,
    paragraphs: scope.paragraphs,
    singleCallThreshold: 1,
    characterBudget: 10,
    tokenBudget: 100,
    sourceSpanBudget: 2
  }));
});

test('live harness chunk output is identical to the production chunker for the same window', () => {
  const text = Array.from({ length: 255 }, (_, index) => `第${index + 1}条${'中'.repeat(15)}`).join('\n');
  const request = buildRequirementExtractionLiveRequest({ text });
  const productionChunks = chunkExtractedText({
    text,
    paragraphs: request.paragraphs,
    ...resolveRequirementChunkBudget({})
  });
  assert.deepEqual(request.chunks, productionChunks);
});

test('production-like evaluation blocks an input drift before Provider invocation', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const canonicalChunk = liveRequest.chunks[0];
  const evalInput = canonicalChunk.text;
  const driftedLiveRequest = {
    ...liveRequest,
    chunks: [{ ...canonicalChunk, provider_input_text: evalInput }]
  };
  let providerCalls = 0;
  const result = await defaultLiveExecutor({
    env,
    liveRequest: driftedLiveRequest,
    fetchImpl: async () => {
      providerCalls += 1;
      return gatewayResponse(candidate());
    }
  });
  assert.equal(providerCalls, 0);
  assert.equal(result.provider_request_count, 0);
  assert.equal(result.technical_error_code, 'PRODUCTION_PARITY_VIOLATION');
  assert.equal(result.final_probe_status, 'BLOCKED');
});

test('production-like evaluation allows an input equal to the canonical production resolver', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const canonicalChunk = liveRequest.chunks[0];
  const parityLiveRequest = {
    ...liveRequest,
    chunks: [{ ...canonicalChunk, provider_input_text: canonicalChunk.model_text }]
  };
  let providerCalls = 0;
  const result = await defaultLiveExecutor({
    env,
    liveRequest: parityLiveRequest,
    fetchImpl: async (_url, options) => {
      providerCalls += 1;
      const request = JSON.parse(options.body);
      const payload = JSON.parse(request.inputs.task_payload_json);
      assert.equal(payload.chunk_text, canonicalChunk.model_text);
      assert.notEqual(payload.chunk_text, canonicalChunk.text);
      return gatewayResponse(candidate());
    }
  });
  assert.equal(providerCalls, 1);
  assert.equal(result.provider_request_count, 1);
  assert.equal(result.final_probe_status, 'PASS');
});

test('parity gate uses the canonical raw-text fallback when model_text is absent', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const canonicalChunk = liveRequest.chunks[0];
  const fallbackChunk = { ...canonicalChunk, model_text: '', provider_input_text: canonicalChunk.text };
  let providerCalls = 0;
  const result = await defaultLiveExecutor({
    env,
    liveRequest: { ...liveRequest, chunks: [fallbackChunk] },
    fetchImpl: async () => {
      providerCalls += 1;
      return gatewayResponse(candidate());
    }
  });
  assert.equal(providerCalls, 1);
  assert.equal(result.provider_request_count, 1);
  assert.equal(result.final_probe_status, 'PASS');
});

test('multi-chunk executor uses bounded concurrency and resolves each candidate in its own chunk', async () => {
  const text = Array.from({ length: 255 }, (_, index) => `第${index + 1}条${'中'.repeat(15)}`).join('\n');
  const liveRequest = buildRequirementExtractionLiveRequest({ text });
  let active = 0;
  let maximumActive = 0;
  const seenChunks = [];
  const fetchImpl = async (url, options) => {
    assert.match(url, /\/workflows\/run$/);
    const body = JSON.parse(options.body);
    const payload = JSON.parse(body.inputs.task_payload_json);
    seenChunks.push(payload.chunk_index);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    const ref = `C${String(payload.chunk_index).padStart(3, '0')}-S001`;
    return gatewayResponse(candidate({ start_ref: ref, end_ref: ref }));
  };
  const result = await defaultLiveExecutor({ env, liveRequest, fetchImpl });
  assert.equal(result.verification_run_count, 1);
  assert.equal(result.production_chunk_count, liveRequest.chunkCount);
  assert.equal(result.provider_request_count, liveRequest.chunkCount);
  assert.equal(result.concurrency_limit, 2);
  assert.ok(maximumActive <= 2);
  assert.deepEqual([...seenChunks].sort((a, b) => a - b), Array.from({ length: liveRequest.chunkCount }, (_, i) => i + 1));
  assert.equal(result.total_candidate_count, liveRequest.chunkCount);
  assert.equal(result.source_resolution_pass, true);
  assert.equal(result.backend_ingestion_pass, true);
  assert.equal(result.schema_pass, true);
  assert.equal(result.final_probe_status, 'PASS');
  assert.equal(result.chunk_results.length, liveRequest.chunkCount);
  assert.doesNotMatch(JSON.stringify(result), /第1条/);
});

test('one failed chunk blocks the run and stops scheduling remaining chunks', async () => {
  const text = Array.from({ length: 255 }, (_, index) => `第${index + 1}条${'中'.repeat(15)}`).join('\n');
  const liveRequest = buildRequirementExtractionLiveRequest({ text });
  const started = [];
  const fetchImpl = async (_url, options) => {
    const payload = JSON.parse(JSON.parse(options.body).inputs.task_payload_json);
    started.push(payload.chunk_index);
    await new Promise((resolve) => setTimeout(resolve, payload.chunk_index === 1 ? 30 : 5));
    const ref = `C${String(payload.chunk_index).padStart(3, '0')}-S001`;
    const range = payload.chunk_index === 2
      ? { start_ref: 'C002-S999', end_ref: 'C002-S999' }
      : { start_ref: ref, end_ref: ref };
    return gatewayResponse(candidate(range));
  };
  const result = await defaultLiveExecutor({ env, liveRequest, fetchImpl });
  assert.equal(result.final_probe_status, 'BLOCKED');
  assert.equal(result.source_resolution_pass, false);
  assert.equal(result.backend_ingestion_pass, false);
  assert.equal(result.provider_request_count, 2);
  assert.deepEqual(started.sort((a, b) => a - b), [1, 2]);
  assert.equal(result.retry_count, 0);
  assert.equal(result.fallback_count, 0);
});

test('a truncated chunk fails the complete bounded run', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const result = await defaultLiveExecutor({
    env,
    liveRequest,
    fetchImpl: async (url, options) => {
      assert.match(url, /\/workflows\/run$/);
      assert.equal(options.method, 'POST');
      return gatewayResponse(candidate(), { finish_reason: 'length', output_truncated: true });
    }
  });
  assert.equal(result.provider_request_count, 1);
  assert.equal(result.chunk_results[0].finish_reason, 'length');
  assert.equal(result.chunk_results[0].output_truncated, true);
  assert.equal(result.final_probe_status, 'BLOCKED');
  assert.equal(result.schema_pass, false);
});

test('default live executor resolves valid refs before Canonical ingestion', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const result = await defaultLiveExecutor({
    env,
    liveRequest,
    fetchImpl: fetchFor(candidate())
  });
  assert.equal(result.source_resolution_pass, true);
  assert.equal(result.backend_ingestion_pass, true);
  assert.equal(result.schema_pass, true);
  assert.equal(result.candidate_count, 1);
});

test('unknown source ref blocks live before Canonical ingestion', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '系统应提供审计日志。' });
  const result = await defaultLiveExecutor({
    env,
    liveRequest,
    fetchImpl: fetchFor(candidate({ start_ref: 'C001-S999', end_ref: 'C001-S999' }))
  });
  assert.equal(result.source_resolution_pass, false);
  assert.equal(result.backend_ingestion_pass, false);
  assert.equal(result.technical_error_code, 'SOURCE_LOCATION_UNRESOLVED');
});

test('excluded-only Candidate provenance is rejected before Canonical ingestion', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '价格条款原文。' });
  liveRequest.chunks[0].segments[0].routing_role = 'COMMERCIAL';
  const result = await defaultLiveExecutor({
    env,
    liveRequest,
    fetchImpl: fetchFor(candidate())
  });
  assert.equal(result.source_resolution_pass, false);
  assert.equal(result.backend_ingestion_pass, false);
  assert.equal(result.technical_error_code, 'REQUIREMENT_SCOPE_EXCLUDED');
});

test('reversed source range blocks live before Canonical ingestion', async () => {
  const liveRequest = buildRequirementExtractionLiveRequest({ text: '第一段。\n第二段。\n第三段。' });
  const result = await defaultLiveExecutor({
    env,
    liveRequest,
    fetchImpl: fetchFor(candidate({ start_ref: 'C001-S003', end_ref: 'C001-S001' }))
  });
  assert.equal(result.source_resolution_pass, false);
  assert.equal(result.backend_ingestion_pass, false);
  assert.equal(result.technical_error_code, 'SOURCE_LOCATION_UNRESOLVED');
});

test('live report retains only safe booleans/counts and never source or model text', () => {
  const report = sanitizeVerificationReport({
    source_resolution_pass: true,
    candidate_count: 1,
    schema_pass: true,
    backend_ingestion_pass: true,
    source_text: 'private source',
    model_content: 'private model',
    chunk_text: 'private chunk'
  });
  assert.deepEqual(report, {
    source_resolution_pass: true,
    candidate_count: 1,
    schema_pass: true,
    backend_ingestion_pass: true
  });
});

test('source resolution failure is surfaced as BLOCKED with no retry or fallback', async () => {
  const result = await runRequirementExtractionLive({
    env,
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    gitInfo: { branch: 'feat/v4.3-semantic-boundary-routing', revision: 'test', tracked_clean: true },
    fetchImpl: healthyFetch,
    liveExecutor: async () => ({
      executed: true,
      provider_request_count: 1,
      retry_count: 0,
      fallback_count: 0,
      provider_chain_verified: true,
      schema_pass: true,
      source_resolution_pass: false,
      backend_ingestion_pass: false,
      technical_error_code: 'SOURCE_LOCATION_UNRESOLVED'
    }),
    writeReport: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.report.verdict, 'BLOCKED');
  assert.ok(result.report.blockers.includes('SOURCE_LOCATION_UNRESOLVED'));
  assert.equal(result.report.live.retry_count, 0);
  assert.equal(result.report.live.fallback_count, 0);
});
