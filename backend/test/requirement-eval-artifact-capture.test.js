import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RAW_PROVIDER_TEXT_UNAVAILABLE,
  assignCandidateIds,
  buildCandidateArtifact,
  buildChunkArtifact,
  buildFailedChunkArtifact,
  buildMappingEvidence,
  beginLiveRunArtifact,
  beginCertifiedCaptureArtifact,
  persistCertifiedRequestArtifact,
  persistCertifiedResponseArtifact,
  persistCertifiedArtifactFile,
  persistLiveResponseArtifact,
  readLiveResponseArtifact
} from '../eval/requirement-extraction-real-tender-pilot-v1/evaluation-artifact.js';
import { evaluateTargets } from '../eval/requirement-extraction-real-tender-pilot-v1/run-targeted-live-worker.js';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chunk = {
  chunk_number: 2,
  id: 'FAST-01-chunk-2',
  text: '原始分片文本',
  model_text: '[C002-S001] 表格行：一级 | 立即 原始分片文本',
  segments: [
    { source_ref: 'C002-S001', text: '原始分片文本', semantic_unit_type: 'TABLE_ROW' },
    { source_ref: 'C002-S002', text: '第二段' }
  ],
  table_units: [{ row_id: 'row-1', source_ref: 'C002-S001', cells: ['一级', '立即'] }]
};

const candidate = {
  text: '系统必须在30分钟内响应。',
  category: 'performance',
  source_range: { start_ref: 'C002-S001', end_ref: 'C002-S001' },
  mandatory_observed: true,
  requires_confirmation: false
};

test('provider-ready chunk artifact preserves exact input, refs, and table presentation', () => {
  const artifact = buildChunkArtifact({ tenderId: 'FAST-01', chunk });
  assert.equal(artifact.tender_id, 'FAST-01');
  assert.equal(artifact.chunk_id, 'FAST-01-chunk-2');
  assert.equal(artifact.chunk_number, 2);
  assert.equal(artifact.provider_ready_input_text, chunk.model_text);
  assert.deepEqual(artifact.source_refs, ['C002-S001', 'C002-S002']);
  assert.deepEqual(artifact.table_semantic_presentation, chunk.table_units);
});

test('candidate artifact preserves exact text and all Candidate V3 fields through JSON serialization', () => {
  const roundTrip = JSON.parse(JSON.stringify(buildCandidateArtifact({ tenderId: 'FAST-01', candidateIndex: 0, candidate })));
  assert.deepEqual(roundTrip, {
    candidate_id: 'FAST-01-C001',
    text: candidate.text,
    category: 'performance',
    source_range: { start_ref: 'C002-S001', end_ref: 'C002-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  });
});

test('candidate IDs are stable and deterministic within one report', () => {
  const input = [candidate, { ...candidate, text: '第二个要求。' }];
  const first = assignCandidateIds('FAST-01', input);
  const second = assignCandidateIds('FAST-01', input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((item) => item.candidate_id), ['FAST-01-C001', 'FAST-01-C002']);
});

test('Gold-to-Candidate mapping is reconstructable from the report alone', () => {
  const candidates = assignCandidateIds('FAST-01', [candidate, { ...candidate, text: '未匹配要求。', source_range: { start_ref: 'C002-S002', end_ref: 'C002-S002' } }]);
  const evidence = buildMappingEvidence({
    goldItems: [{ gold_id: 'FAST-01-G001', text: '系统必须在30分钟内响应。', source_range: candidate.source_range, mandatory_observed: true }],
    candidates,
    automaticMatches: [{ gold_id: 'FAST-01-G001', candidate_ids: ['FAST-01-C001'], verdict: 'EXACT_RANGE', matcher_evidence: { exact: true } }],
    falsePositiveIds: ['FAST-01-C002'],
    wrongMerges: []
  });
  const reportOnly = JSON.parse(JSON.stringify({ candidates, mapping_evidence: evidence }));
  assert.equal(reportOnly.mapping_evidence.gold_mappings[0].candidate_ids[0], 'FAST-01-C001');
  assert.equal(reportOnly.mapping_evidence.false_positive_candidates[0].text, '未匹配要求。');
});

test('FP and wrong-merge mapping evidence contains exact Candidate text', () => {
  const candidates = assignCandidateIds('TB-006', [
    { ...candidate, text: '错误候选。' },
    { ...candidate, text: '合并两个义务。', source_range: { start_ref: 'C002-S001', end_ref: 'C002-S002' } }
  ]);
  const evidence = buildMappingEvidence({
    goldItems: [
      { gold_id: 'TB-006-G001', text: '义务一。', source_range: candidate.source_range, mandatory_observed: false },
      { gold_id: 'TB-006-G002', text: '义务二。', source_range: { start_ref: 'C002-S002', end_ref: 'C002-S002' }, mandatory_observed: false }
    ],
    candidates,
    automaticMatches: [],
    falsePositiveIds: ['TB-006-C001'],
    wrongMerges: [{ candidate_id: 'TB-006-C002', gold_ids: ['TB-006-G001', 'TB-006-G002'] }]
  });
  assert.equal(evidence.false_positive_candidates[0].text, '错误候选。');
  assert.equal(evidence.wrong_merge_candidates[0].text, '合并两个义务。');
  assert.deepEqual(evidence.wrong_merge_candidates[0].gold_ids, ['TB-006-G001', 'TB-006-G002']);
});

test('truncated chunk artifact retains diagnostics or explicit unavailable marker', () => {
  const artifact = buildFailedChunkArtifact({
    tenderId: 'FAST-WATER-01',
    chunk: { chunk_number: 3, id: 'water-3', text: 'input', model_text: 'model input', segments: [] },
    diagnostics: { finish_reason: 'length', completion_tokens: 3200, output_truncated: true },
    error: new Error('schema invalid')
  });
  assert.equal(artifact.finish_reason, 'length');
  assert.equal(artifact.completion_tokens, 3200);
  assert.equal(artifact.output_truncated, true);
  assert.equal(artifact.schema_error, 'schema invalid');
  assert.equal(artifact.raw_provider_text, RAW_PROVIDER_TEXT_UNAVAILABLE);
});

test('capture helper is evaluation-only', () => {
  assert.match(new URL('../eval/requirement-extraction-real-tender-pilot-v1/evaluation-artifact.js', import.meta.url).pathname, /backend\/eval\//);
});

const g013Selection = {
  targets: [{
    gold_id: 'TB-006-G013',
    current_source_range: { start_ref: 'C002-S008', end_ref: 'C002-S012' }
  }]
};

test('G013 treats pricing unit 1账号 plus quantity 4 as four-account semantic coverage', () => {
  const result = evaluateTargets({
    selection: g013Selection,
    response: {
      candidates: [{
        candidate_id: 'TB-006-C003',
        text: '提供远程接入服务，数量为4个账号，服务期限为10个月。',
        source_range: { start_ref: 'C002-S008', end_ref: 'C002-S008' }
      }]
    }
  });
  assert.equal(result['TB-006-G013'].result, 'PASS');
});

test('G013 rejects an incorrect quantity even when duration is retained', () => {
  const result = evaluateTargets({
    selection: g013Selection,
    response: {
      candidates: [{
        candidate_id: 'TB-006-C003',
        text: '提供远程接入服务，数量为1个账号，服务期限为10个月。',
        source_range: { start_ref: 'C002-S008', end_ref: 'C002-S008' }
      }]
    }
  });
  assert.equal(result['TB-006-G013'].result, 'FAIL');
});

test('G013 rejects a candidate that omits the ten-month duration', () => {
  const result = evaluateTargets({
    selection: g013Selection,
    response: {
      candidates: [{
        candidate_id: 'TB-006-C003',
        text: '提供远程接入服务，数量为4个账号。',
        source_range: { start_ref: 'C002-S008', end_ref: 'C002-S008' }
      }]
    }
  });
  assert.equal(result['TB-006-G013'].result, 'FAIL');
});

test('live worker persists response artifact immediately after Provider response', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'reqx-live-artifact-'));
  const runId = 'reqx-v311-test-a';
  const started = await beginLiveRunArtifact({ artifactRoot, runId });
  assert.deepEqual(started, { run_id: runId, status: 'started', provider_calls: 0 });

  const response = {
    run_id: runId,
    status: 'provider_response_received',
    selected_chunk: { chunk_number: 2 },
    provider_input_source: 'model_text',
    provider_input_length: 2543,
    provider_calls: 1,
    http_status: 200,
    finish_reason: 'stop',
    prompt_tokens: 10,
    completion_tokens: 20,
    output_truncated: false,
    raw_response: '{"requirements":[]}',
    candidates: [],
    schema_pass: true,
    source_pass: true,
    backend_pass: true,
    error: null
  };
  await persistLiveResponseArtifact({ artifactRoot, runId, response });
  assert.deepEqual(await readLiveResponseArtifact({ artifactRoot, runId }), response);
});

test('semantic evaluation can read a persisted response without invoking Provider', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'reqx-live-artifact-'));
  const runId = 'reqx-v311-test-b';
  await beginLiveRunArtifact({ artifactRoot, runId });
  await persistLiveResponseArtifact({
    artifactRoot,
    runId,
    response: { run_id: runId, status: 'provider_response_received', provider_calls: 1, candidates: [{ text: 'exact' }] }
  });
  let providerInvoked = false;
  const artifact = await readLiveResponseArtifact({ artifactRoot, runId });
  assert.equal(providerInvoked, false);
  assert.equal(artifact.candidates[0].text, 'exact');
});

test('a run with provider_calls=1 cannot be started again or retried', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'reqx-live-artifact-'));
  const runId = 'reqx-v311-test-c';
  await mkdir(join(artifactRoot, runId), { recursive: true });
  await writeFile(join(artifactRoot, runId, 'run.json'), JSON.stringify({
    run_id: runId,
    status: 'provider_response_received',
    provider_calls: 1
  }));
  await assert.rejects(
    beginLiveRunArtifact({ artifactRoot, runId }),
    (error) => error.code === 'LIVE_RUN_ALREADY_HAS_PROVIDER_CALLS'
  );
});

test('certified capture persists request before response with exact input and candidates', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'reqx-certified-artifact-'));
  const sourceCaptureRunId = 'reqx-v311-certified-test-a';
  const manifest = { source_capture_run_id: sourceCaptureRunId, provider_request_count: 0 };
  await beginCertifiedCaptureArtifact({ artifactRoot, sourceCaptureRunId, manifest });
  const request = {
    tender_id: 'FAST-01',
    chunk_number: 1,
    provider_ready_input_text: 'exact model input',
    source_refs: ['C001-S001'],
    request_started_at: '2026-08-29T00:00:00.000Z'
  };
  const requestPath = await persistCertifiedRequestArtifact({ artifactRoot, sourceCaptureRunId, tenderId: 'FAST-01', chunkNumber: 1, request });
  const response = {
    tender_id: 'FAST-01',
    chunk_number: 1,
    provider_http_status: 200,
    finish_reason: 'stop',
    completion_tokens: 17,
    output_truncated: false,
    raw_provider_text: '{"requirements":[]}',
    candidates: [{ ...candidate, text: 'model exact text' }]
  };
  const responsePath = await persistCertifiedResponseArtifact({ artifactRoot, sourceCaptureRunId, tenderId: 'FAST-01', chunkNumber: 1, response });
  const persistedRequest = JSON.parse(await readFile(requestPath, 'utf8'));
  const persistedResponse = JSON.parse(await readFile(responsePath, 'utf8'));
  assert.equal(persistedRequest.provider_ready_input_text, request.provider_ready_input_text);
  assert.equal(persistedResponse.candidates[0].text, 'model exact text');
  assert.deepEqual(Object.keys(persistedResponse.candidates[0]).sort(), [
    'category', 'mandatory_observed', 'requires_confirmation', 'source_range', 'text'
  ].sort());
});

test('certified capture writes named identity artifacts atomically', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'reqx-certified-artifact-'));
  const sourceCaptureRunId = 'reqx-v311-certified-test-b';
  await beginCertifiedCaptureArtifact({ artifactRoot, sourceCaptureRunId, manifest: { source_capture_run_id: sourceCaptureRunId } });
  await assert.rejects(
    persistCertifiedArtifactFile({
      artifactRoot,
      sourceCaptureRunId,
      fileName: 'production-runtime-identity.json',
      value: { model: 'deepseek-ai/DeepSeek-V4-Flash', api_key: 'redacted' }
    }),
    (error) => error.code === 'CERTIFIED_CAPTURE_SECRET_FIELD'
  );
  const path = await persistCertifiedArtifactFile({ artifactRoot, sourceCaptureRunId, fileName: 'production-runtime-identity.json', value: { model: 'deepseek-ai/DeepSeek-V4-Flash' } });
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { model: 'deepseek-ai/DeepSeek-V4-Flash' });
});
