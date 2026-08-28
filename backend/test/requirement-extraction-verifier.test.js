import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH,
  FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION,
  FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH,
  FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
  mapValidatedCandidatesToCanonicalInput,
  runRequirementExtractionAccept,
  runRequirementExtractionDoctor,
  runRequirementExtractionLive
} from '../src/verification/requirement-extraction-verifier.js';
import { createRequirementExtractionGateway } from '../src/pipeline/requirement-extraction.js';
import { getSemanticTaskContract } from '../../packages/semantic-contracts/index.js';
import {
  VERIFICATION_REPORT_SCHEMA_VERSION,
  sanitizeVerificationReport
} from '../src/verification/requirement-extraction-report.js';

const env = {
  SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
  SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
  SEMANTIC_GATEWAY_API_KEY: 'service-test-key',
  SEMANTIC_GATEWAY_USER: 'verification-test',
  SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.invalid/v1',
  SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'provider-test-key',
  SEMANTIC_GATEWAY_MODEL: 'test-model'
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function healthyInfo(overrides = {}) {
  return {
    service: 'semantic-gateway',
    service_version: '0.1.0',
    build_revision: '6c7cae1',
    task_registry_loaded: true,
    task_types: ['requirement_extraction', 'response_planning', 'claim_generation', 'section_drafting', 'targeted_revision'],
    requirement_extraction_contract_version: FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION,
    requirement_extraction_prompt_hash: FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH,
    candidate_schema_contract_version: FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
    candidate_schema_sha256: FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH,
    ...overrides
  };
}

function healthyFetch(overrides = {}) {
  return async (url) => {
    if (url.endsWith('/api/health')) return response({ ok: true, database: 'connected' });
    if (url.endsWith('/health')) return response({ status: 'ok', service: 'semantic-gateway' });
    if (url.endsWith('/ready')) return response({ status: 'ready', provider_configured: true });
    if (url.endsWith('/info')) return response(healthyInfo(overrides.info));
    throw new Error(`unexpected url ${url}`);
  };
}

function gitInfo() {
  return { branch: 'feat/v4.3-semantic-boundary-routing', revision: '782a40c', tracked_clean: true };
}

test('doctor passes all offline-injected checks and uses the shared contracts', async () => {
  const result = await runRequirementExtractionDoctor({ env, fetchImpl: healthyFetch(), gitInfo: gitInfo(), writeReport: false });
  assert.equal(result.ok, true);
  assert.equal(result.report.verdict, 'READY_FOR_ACCEPTANCE');
  assert.deepEqual(result.report.contract.payload_keys, ['project_name', 'section_name', 'chunk_index', 'chunk_count', 'chunk_text']);
  assert.deepEqual(result.report.blockers, []);
  assert.equal(result.report.runtime.routing.legacy_18080_fallback, 'ABSENT');
  assert.equal(result.report.runtime.routing.legacy_only_resolved_target, null);
  assert.equal(result.report.runtime.routing.legacy_only_client_target, null);
  assert.doesNotMatch(JSON.stringify(result.report), /service-test-key|provider-test-key|chunk_text.*verification-only/);
});

test('doctor reports contract, revision, provider and routing blockers without calling a model', async () => {
  const result = await runRequirementExtractionDoctor({
    env: { ...env, SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18080' },
    fetchImpl: healthyFetch({ info: { requirement_extraction_prompt_hash: 'stale' } }),
    gitInfo: gitInfo(),
    expectedRevision: 'deadbee',
    writeReport: false
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.blockers.includes('ROUTING_DRIFT'));
  assert.ok(result.report.blockers.includes('PROMPT_HASH_MISMATCH'));
  assert.ok(result.report.blockers.includes('REVISION_MISMATCH'));

  const unavailable = await runRequirementExtractionDoctor({
    env,
    fetchImpl: healthyFetch({ info: healthyInfo }),
    gitInfo: gitInfo(),
    writeReport: false
  });
  assert.equal(unavailable.report.live.provider_request_count, 0);
});

test('missing observed Candidate schema identity cannot fall back to the expected value', async () => {
  const result = await runRequirementExtractionDoctor({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    candidateSchemaVersion: null,
    candidateSchemaHash: null,
    writeReport: false
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.blockers.includes('CANDIDATE_SCHEMA_MISMATCH'));
  assert.equal(result.report.contract.candidate_schema_version, null);
  assert.equal(result.report.contract.candidate_schema_hash, null);
});

test('doctor classifies backend/gateway reachability and readiness failures', async () => {
  const backendDown = await runRequirementExtractionDoctor({
    env,
    fetchImpl: async (url) => {
      if (url.endsWith('/api/health')) throw new Error('offline');
      return healthyFetch()(url);
    },
    gitInfo: gitInfo(),
    writeReport: false
  });
  assert.ok(backendDown.report.blockers.includes('BACKEND_UNREACHABLE'));

  const gatewayDown = await runRequirementExtractionDoctor({
    env,
    fetchImpl: async (url) => {
      if (url.endsWith('/health')) throw new Error('offline');
      if (url.endsWith('/ready') || url.endsWith('/info')) return healthyFetch()(url);
      return response({ ok: true });
    },
    gitInfo: gitInfo(),
    writeReport: false
  });
  assert.ok(gatewayDown.report.blockers.includes('GATEWAY_UNREACHABLE'));

  const notReady = await runRequirementExtractionDoctor({
    env,
    fetchImpl: async (url) => {
      if (url.endsWith('/ready')) return response({ status: 'not_ready', provider_configured: false }, 503);
      return healthyFetch()(url);
    },
    gitInfo: gitInfo(),
    writeReport: false
  });
  assert.ok(notReady.report.blockers.includes('GATEWAY_NOT_READY'));
  assert.ok(notReady.report.blockers.includes('PROVIDER_NOT_CONFIGURED'));
});

test('accept stops after a blocked doctor and runs all safe checks only after a pass', async () => {
  let commands = 0;
  const blocked = await runRequirementExtractionAccept({
    env,
    fetchImpl: healthyFetch({ info: { candidate_schema_sha256: 'stale' } }),
    gitInfo: gitInfo(),
    commandRunner: () => { commands += 1; return { exit_code: 0, duration_ms: 1 }; },
    writeReport: false
  });
  assert.equal(blocked.ok, false);
  assert.equal(commands, 0);

  const accepted = await runRequirementExtractionAccept({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    commandRunner: () => ({ exit_code: 0, duration_ms: 2 }),
    writeReport: false
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.report.verdict, 'READY_FOR_LIVE');
  assert.equal(accepted.report.tests.length, 8);
  assert.ok(accepted.report.tests.every((item) => item.status === 'PASS'));
});

test('live requires explicit confirmation and hard preflight before any executor call', async () => {
  let calls = 0;
  const noConfirmation = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    liveExecutor: async () => { calls += 1; return { executed: true, provider_request_count: 1, schema_pass: true, backend_ingestion_pass: true }; },
    writeReport: false
  });
  assert.equal(noConfirmation.ok, false);
  assert.equal(noConfirmation.report.verdict, 'BLOCKED');
  assert.ok(noConfirmation.report.blockers.includes('LIVE_CONFIRMATION_REQUIRED'));
  assert.equal(calls, 0);

  const legacyConfirmation = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmOneLiveCall: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => { calls += 1; return { executed: true, provider_request_count: 1, schema_pass: true, backend_ingestion_pass: true }; },
    writeReport: false
  });
  assert.equal(legacyConfirmation.ok, false);
  assert.ok(legacyConfirmation.report.blockers.includes('LIVE_CONFIRMATION_REQUIRED'));
  assert.equal(calls, 0);

  const preflight = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch({ info: { requirement_extraction_prompt_hash: 'stale' } }),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => { calls += 1; return { executed: true, provider_request_count: 1, schema_pass: true, backend_ingestion_pass: true }; },
    writeReport: false
  });
  assert.equal(preflight.ok, false);
  assert.equal(calls, 0);
});

test('mock live pass and failures preserve one-call/no-retry/fallback invariants', async () => {
  let calls = 0;
  const liveRequest = { text: 'synthetic', projectName: 'test', sectionName: 'section', chunkCount: 1 };
  const pass = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest,
    liveExecutor: async () => {
      calls += 1;
      return {
        executed: true,
        provider_request_count: 1,
        provider_adapter_invoked: true,
        fetch_invoked: true,
        provider_http_reached: true,
        provider_http_status: 200,
        provider_chain_verified: true,
        schema_pass: true,
        backend_ingestion_pass: true
      };
    },
    writeReport: false
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.report.verdict, 'LIVE_VERIFIED');
  assert.equal(calls, 1);
  assert.equal(pass.report.live.retry_count, 0);
  assert.equal(pass.report.live.fallback_count, 0);

  const network = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest,
    liveExecutor: async () => { calls += 1; return { executed: true, provider_request_count: 1, technical_error_code: 'PROVIDER_UNAVAILABLE', schema_pass: false, backend_ingestion_pass: false }; },
    writeReport: false
  });
  assert.equal(network.ok, false);
  assert.equal(network.report.verdict, 'BLOCKED');
  assert.equal(calls, 2);
  assert.equal(network.report.live.provider_request_count, 1);
  assert.ok(network.report.blockers.includes('PROVIDER_UNAVAILABLE'));
});

test('live success requires provider-chain diagnostics and uses the production canonical mapper', async () => {
  const mapped = mapValidatedCandidatesToCanonicalInput([{
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  }], { resolutions: [{ location: { source_refs: ['C001-S001'], source_verified: true } }] });
  assert.equal(mapped[0].content, '系统应提供审计日志。');
  assert.deepEqual(mapped[0].sources[0].source_refs, ['C001-S001']);
  assert.throws(
    () => mapValidatedCandidatesToCanonicalInput([{
      content: 'legacy',
      source_excerpt: 'legacy'
    }]),
    error => error.code === 'BACKEND_INGESTION_FAILED'
  );

  let calls = 0;
  const withoutDiagnostics = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => {
      calls += 1;
      return { executed: true, provider_request_count: 1, schema_pass: true, backend_ingestion_pass: true };
    },
    writeReport: false
  });
  assert.equal(calls, 1);
  assert.equal(withoutDiagnostics.ok, false);
  assert.ok(withoutDiagnostics.report.blockers.includes('DIAGNOSTIC_INSUFFICIENT'));

  const ingestionFailure = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => ({
      executed: true,
      provider_request_count: 1,
      provider_chain_verified: true,
      schema_pass: true,
      backend_ingestion_pass: false,
      technical_error_code: 'BACKEND_INGESTION_FAILED'
    }),
    writeReport: false
  });
  assert.equal(ingestionFailure.ok, false);
  assert.ok(ingestionFailure.report.blockers.includes('BACKEND_INGESTION_FAILED'));
});

test('422 probe diagnostics are retained only as safe structural metadata', async () => {
  const diagnostics = {
    provider_http_status: 200,
    schema_validation_errors: [{ path: 'data.requirements[0].extra', validator_code: 'additionalProperties', expected: 'no additional properties', observed_category: 'string', message: 'Unsupported candidate field.' }],
    structural_summary: { available: true, top_level_type: 'object', top_level_keys: ['requirements'], requirements_present: true, requirements_type: 'array', requirements_count: 1, candidate_summaries: [{ candidate_index: 0, keys: ['text', 'extra'], extra_keys: ['extra'], text_type: 'string', text_empty: false, source_range_type: 'object', source_range_keys: ['start_ref', 'end_ref'], source_range_start_ref_type: 'string', source_range_end_ref_type: 'string' }] },
    model_content: 'PRIVATE_MODEL_OUTPUT',
    parsed_json: { secret: 'PRIVATE_MODEL_OUTPUT' }
  };
  let calls = 0;
  const report = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch(),
    gitInfo: gitInfo(),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => { calls += 1; return { executed: true, provider_request_count: 1, technical_error_code: 'OUTPUT_SCHEMA_INVALID', schema_pass: false, backend_ingestion_pass: false, diagnostics }; },
    writeReport: false
  });
  const serialized = JSON.stringify(report.report);
  assert.equal(calls, 1);
  assert.doesNotMatch(serialized, /PRIVATE_MODEL_OUTPUT|"parsed_json"|"model_content"/);
  assert.equal(report.report.live.diagnostics.schema_validation_errors[0].validator_code, 'additionalProperties');
});

test('report sanitizer omits secret/content-bearing fields while retaining safe metadata', () => {
  const sanitized = sanitizeVerificationReport({
    text: 'private',
    source_text: 'private',
    chunk_text: 'private',
    model_content: 'private',
    parsed_json: { private: true },
    keys: ['text', 'source_text'],
    category: 'technical',
    latency_ms: 4
  });
  assert.equal(Object.hasOwn(sanitized, 'text'), false);
  assert.equal(Object.hasOwn(sanitized, 'source_text'), false);
  assert.equal(Object.hasOwn(sanitized, 'chunk_text'), false);
  assert.equal(Object.hasOwn(sanitized, 'model_content'), false);
  assert.equal(Object.hasOwn(sanitized, 'parsed_json'), false);
  assert.deepEqual(sanitized.keys, ['text', 'source_text']);
  assert.equal(sanitized.category, 'technical');
});

test('Requirement Extraction verification contract uses canonical names only', async () => {
  const result = await runRequirementExtractionLive({
    env,
    confirmLiveRun: true,
    gitInfo: gitInfo(),
    liveRequest: { text: 'synthetic' },
    fetchImpl: healthyFetch(),
    liveExecutor: async () => ({
      executed: true,
      provider_request_count: 1,
      schema_pass: true,
      backend_ingestion_pass: true,
      provider_chain_verified: true
    }),
    writeReport: false
  });
  assert.equal(VERIFICATION_REPORT_SCHEMA_VERSION, 'requirement-extraction-verification-report-v2');
  assert.equal(result.ok, true);
  assert.equal(result.report.live.provider_request_count, 1);
  assert.equal(Object.hasOwn(result.report.live, 'request_count'), false);
});

test('legacy live confirmation identifiers are absent from active verification surfaces', () => {
  const activeSurfaces = [
    '../src/verification/requirement-extraction-verifier.js',
    '../scripts/requirement-extraction-verify.js',
    '../src/verification/requirement-extraction-report.js'
  ];
  for (const relativePath of activeSurfaces) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /confirmOneLiveCall/);
    assert.doesNotMatch(source, /--confirm-one-live-call/);
    assert.doesNotMatch(source, /\brequest_count\b/);
  }
  const cliSource = readFileSync(new URL('../scripts/requirement-extraction-verify.js', import.meta.url), 'utf8');
  assert.match(cliSource, /--confirm-live-run/);
});

test('live input derives chunk budget from the production resolver only', () => {
  const source = readFileSync(new URL('../src/verification/requirement-extraction-live-input.js', import.meta.url), 'utf8');
  assert.match(source, /resolveRequirementChunkBudget/);
  assert.doesNotMatch(source, /SINGLE_CALL_THRESHOLD|CHARACTER_BUDGET|TOKEN_BUDGET/);
  assert.doesNotMatch(source, /\b(?:2000|3000|50)\b/);
});

test('legacy request_count input cannot authorize or populate the live report', async () => {
  const result = await runRequirementExtractionLive({
    env,
    confirmLiveRun: true,
    gitInfo: gitInfo(),
    liveRequest: { text: 'synthetic' },
    fetchImpl: healthyFetch(),
    liveExecutor: async () => ({
      executed: true,
      request_count: 1,
      schema_pass: true,
      backend_ingestion_pass: true,
      provider_chain_verified: true
    }),
    writeReport: false
  });
  assert.equal(result.ok, false);
  assert.equal(result.report.live.provider_request_count, 0);
  assert.equal(Object.hasOwn(result.report.live, 'request_count'), false);
  assert.ok(result.report.blockers.includes('DIAGNOSTIC_INSUFFICIENT'));
});

test('frozen prompt and candidate schema identities remain exact', () => {
  const contract = getSemanticTaskContract('requirement_extraction');
  assert.equal(contract.contract_version, FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION);
  assert.equal(contract.instruction_hash, FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH);
  assert.equal(FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION, '4.3-requirement-candidate-v3');
  assert.match(FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH, /^[a-f0-9]{64}$/);
});

test('verification and consolidated development commands are registered', () => {
  const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const backendPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(rootPackage.scripts['dev:full'], 'node scripts/dev-full.js');
  const devFull = readFileSync(new URL('../../scripts/dev-full.js', import.meta.url), 'utf8');
  assert.doesNotMatch(devFull, /semantic-gateway:start|run', 'dev', '-w', 'backend/);
  assert.equal(rootPackage.scripts['reqx:doctor'], 'npm run reqx:doctor -w backend');
  assert.equal(rootPackage.scripts['reqx:accept'], 'npm run reqx:accept -w backend');
  assert.equal(rootPackage.scripts['reqx:live'], 'npm run reqx:live -w backend --');
  assert.equal(backendPackage.scripts['reqx:doctor'], 'node scripts/requirement-extraction-verify.js doctor');
  assert.equal(backendPackage.scripts['reqx:accept'], 'node scripts/requirement-extraction-verify.js accept');
  assert.equal(backendPackage.scripts['reqx:live'], 'node scripts/requirement-extraction-verify.js live');
});

test('production Requirement Extraction adapter forwards probe-v1 and the canonical payload only', async () => {
  let captured;
  const gateway = createRequirementExtractionGateway({
    async run(request, options) {
      captured = { request, options };
      return {
        envelope: {
          schema_version: FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION,
          task_type: 'requirement_extraction',
          status: 'success',
          data: { requirements: [] },
          warnings: []
        },
        audit: {}
      };
    }
  });
  await gateway.extract({
    fileName: 'synthetic.docx',
    text: 'synthetic chunk',
    projectName: 'synthetic project',
    sectionName: 'technical',
    chunkCount: 1,
    chunk: { chunk_number: 1, segments: [] },
    diagnosticMode: 'probe-v1'
  });
  assert.equal(captured.options.diagnosticMode, 'probe-v1');
  assert.deepEqual(Object.keys(JSON.parse(captured.request.task_payload_json)).sort(), [
    'chunk_count', 'chunk_index', 'chunk_text', 'project_name', 'section_name'
  ]);
});
