import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  getSemanticTaskContract,
  resolveSemanticTaskInstruction,
  REQUIREMENT_CANDIDATE_SCHEMA,
  REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
  REQUIREMENT_CANDIDATE_SCHEMA_SHA256
} from '../../../packages/semantic-contracts/index.js';
import { SEMANTIC_GATEWAY_RUNTIME_ENV_NAMES } from '../../../packages/semantic-contracts/runtime-config.js';
import {
  buildRequirementExtractionPayload,
  assertRequirementExtractionProviderInputParity,
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput,
  validateRequirementExtractionEnvelope
} from '../pipeline/requirement-extraction.js';
import { mapRequirementCandidateToCanonicalInput } from '../pipeline/requirement-chunker.js';
import { SourceLocationResolver } from '../pipeline/source-location-resolver.js';
import { validateCandidateSourceScope } from '../pipeline/requirement-scope-router.js';
import {
  createSemanticGatewayClientFromEnv,
  parseSemanticGatewayConfig
} from '../pipeline/semantic-gateway-client.js';
import {
  DEFAULT_REQUIREMENT_EXTRACTION_REPORT_PATH,
  VERIFICATION_REPORT_SCHEMA_VERSION,
  sanitizeVerificationReport,
  writeVerificationReport
} from './requirement-extraction-report.js';
import {
  BRANCH_ROLES,
  assertLiveBranch,
  classifyBranch,
  loadBranchPolicy
} from './branch-policy.js';

const ACTIVE_REQUIREMENT_EXTRACTION_CONTRACT = getSemanticTaskContract('requirement_extraction');
export const FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION = ACTIVE_REQUIREMENT_EXTRACTION_CONTRACT.contract_version;
export const FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH = ACTIVE_REQUIREMENT_EXTRACTION_CONTRACT.instruction_hash;
export const FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION = REQUIREMENT_CANDIDATE_SCHEMA_VERSION;
export const FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH = REQUIREMENT_CANDIDATE_SCHEMA_SHA256;

export const REQUIREMENT_EXTRACTION_BLOCKERS = Object.freeze([
  'CONTRACT_DRIFT',
  'PROMPT_HASH_MISMATCH',
  'CANDIDATE_SCHEMA_MISMATCH',
  'PAYLOAD_CONTRACT_DRIFT',
  'BACKEND_UNREACHABLE',
  'GATEWAY_UNREACHABLE',
  'GATEWAY_NOT_READY',
  'REVISION_MISMATCH',
  'ROUTING_DRIFT',
  'PROVIDER_NOT_CONFIGURED',
  'TEST_FAILURE',
  'BUILD_FAILURE',
  'LINT_FAILURE',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'PROVIDER_HTTP_FAILURE',
  'PROVIDER_OUTPUT_INVALID',
  'OUTPUT_SCHEMA_INVALID',
  'BACKEND_INGESTION_FAILED',
  'DIAGNOSTIC_INSUFFICIENT',
  'LIVE_CONFIRMATION_REQUIRED',
  'LIVE_PAYLOAD_REQUIRED',
  'PRODUCTION_PARITY_VIOLATION',
  'BRANCH_DRIFT',
  'BRANCH_LINEAGE_DRIFT'
]);

const EXPECTED_PAYLOAD_KEYS = Object.freeze([
  'project_name',
  'section_name',
  'chunk_index',
  'chunk_count',
  'chunk_text'
]);
const EXPECTED_CANDIDATE_KEYS = Object.freeze([...REQUIREMENT_CANDIDATE_SCHEMA.required]);
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:3001';
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18082';

function nowValue(now) {
  return typeof now === 'function' ? now() : Date.now();
}

function hash(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function gateName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);
}

function safeError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code.slice(0, 80) : 'UNKNOWN',
    status: Number.isInteger(error?.status) ? error.status : null
  };
}

function safeUrl(value) {
  try {
    const target = new URL(value);
    return {
      url: `${target.protocol}//${target.hostname}${target.port ? `:${target.port}` : ''}`,
      host: target.hostname,
      port: target.port || (target.protocol === 'https:' ? '443' : '80')
    };
  } catch (_error) {
    return { url: null, host: null, port: null };
  }
}

function compareShaPrefix(expected, actual) {
  const left = String(expected || '').trim().toLowerCase();
  const right = String(actual || '').trim().toLowerCase();
  return Boolean(left && right && (left.startsWith(right) || right.startsWith(left)));
}

function isAllowedBenchmarkUntracked(line) {
  const normalized = String(line || '').replace(/\\/g, '/');
  return normalized.startsWith('?? backend/eval/tender-benchmark-v1/');
}

function enrichGitInfo(gitInfo, repoRoot) {
  const policy = loadBranchPolicy({ repoRoot });
  const branchInfo = classifyBranch({
    branch: gitInfo?.branch || null,
    policy,
    repoRoot
  });
  return { ...gitInfo, ...branchInfo };
}

function defaultGitInfo(repoRoot = process.cwd()) {
  const read = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  try {
    const status = read(['status', '--short']);
    const lines = status ? status.split(/\r?\n/).filter(Boolean) : [];
    const trackedLines = lines.filter((line) => !isAllowedBenchmarkUntracked(line));
    return enrichGitInfo({
      branch: read(['branch', '--show-current']),
      revision: read(['rev-parse', '--short', 'HEAD']),
      tracked_clean: trackedLines.length === 0,
      allowed_untracked_benchmark: lines.some(isAllowedBenchmarkUntracked)
    }, repoRoot);
  } catch (_error) {
    return { branch: null, revision: null, tracked_clean: false, allowed_untracked_benchmark: false };
  }
}

function defaultCommandRunner({ command, args, cwd = process.cwd() }) {
  const started = Date.now();
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const windowsNpm = process.platform === 'win32' && command === 'npm';
  const spawnExecutable = windowsNpm ? (process.env.ComSpec || 'cmd.exe') : executable;
  const spawnArgs = windowsNpm
    ? ['/d', '/c', [executable, ...args].map((value) => {
      const text = String(value);
      return /[\s\"]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
    }).join(' ')]
    : args;
  const result = spawnSync(spawnExecutable, spawnArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15 * 60 * 1000,
    windowsHide: true
  });
  return {
    command: [command, ...args].join(' '),
    exit_code: Number.isInteger(result.status) ? result.status : 1,
    duration_ms: Math.max(0, Date.now() - started),
    timed_out: result.error?.code === 'ETIMEDOUT'
  };
}

async function fetchJson(fetchImpl, url, { timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    let body = null;
    try { body = await response.json(); } catch (_error) { body = null; }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: null, body: null, error: safeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

function baseReport(mode, startedAt, gitInfo) {
  return {
    schema_version: VERIFICATION_REPORT_SCHEMA_VERSION,
    run_id: randomUUID(),
    mode,
    started_at: new Date(startedAt).toISOString(),
    completed_at: null,
    duration_ms: null,
    git: {
      branch: gitInfo?.branch || null,
      branch_name: gitInfo?.branch_name || gitInfo?.branch || null,
      revision: gitInfo?.revision || null,
      tracked_clean: gitInfo?.tracked_clean === true,
      branch_role: gitInfo?.branch_role || null,
      authoritative_branch: gitInfo?.authoritative_branch || null,
      production_eligible: gitInfo?.production_eligible === true,
      lineage_verified: gitInfo?.lineage_verified === true
    },
    contract: {
      prompt_version: null,
      prompt_hash: null,
      candidate_schema_version: null,
      candidate_schema_hash: null,
      payload_keys: []
    },
    runtime: {
      backend: null,
      gateway: null,
      gateway_build_revision: null,
      routing: null,
      provider_configured: null
    },
    gates: [],
    tests: [],
    live: {
      executed: false,
      verification_run_count: 0,
      production_chunk_count: 0,
      expected_chunk_count: 0,
      provider_request_count: 0,
      max_provider_request_count: 0,
      concurrency_limit: 0,
      retry_count: 0,
      fallback_count: 0,
      dify_call_count: 0,
      embedding_call_count: 0,
      gateway_http_status: null,
      provider_http_status: null,
      candidate_count: null,
      total_candidate_count: null,
      schema_pass: null,
      source_resolution_pass: null,
      backend_ingestion_pass: null,
      chunk_character_sizes: [],
      chunk_results: [],
      final_probe_status: null,
      diagnostics: null
    },
    verdict: null,
    blockers: []
  };
}

function finishReport(report, startedAt, now = Date.now) {
  const endedAt = nowValue(now);
  report.completed_at = new Date(endedAt).toISOString();
  report.duration_ms = Math.max(0, endedAt - startedAt);
  report.blockers = unique(report.blockers);
  return sanitizeVerificationReport(report);
}

function addGate(report, name, passed, blockerCode = null, reason = null, details = {}) {
  const gate = {
    name: gateName(name),
    status: passed ? 'PASS' : 'FAIL',
    blocker_code: passed ? null : blockerCode,
    reason: reason ? String(reason).slice(0, 240) : null,
    ...details
  };
  report.gates.push(gate);
  if (!passed && blockerCode) report.blockers.push(blockerCode);
  return passed;
}

function contractChecks(
  report,
  {
    candidateSchemaVersion = REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
    candidateSchemaHash = REQUIREMENT_CANDIDATE_SCHEMA_SHA256
  } = {}
) {
  const contract = getSemanticTaskContract('requirement_extraction');
  const instruction = resolveSemanticTaskInstruction('requirement_extraction');
  const promptVersionPass = contract?.contract_version === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION;
  const promptHashPass = contract?.instruction_hash === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH
    && hash(instruction) === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH;
  const candidateVersion = candidateSchemaVersion;
  const candidateHash = candidateSchemaHash;
  report.contract = {
    prompt_version: contract?.contract_version || null,
    prompt_hash: contract?.instruction_hash || null,
    candidate_schema_version: candidateVersion,
    candidate_schema_hash: candidateHash,
    payload_keys: []
  };
  addGate(report, 'contract.prompt_version', promptVersionPass, 'CONTRACT_DRIFT', 'Prompt contract version differs from the frozen contract.');
  addGate(report, 'contract.prompt_hash', promptHashPass, 'PROMPT_HASH_MISMATCH', 'Prompt hash differs from the frozen contract.');

  const required = Array.isArray(REQUIREMENT_CANDIDATE_SCHEMA.required)
    && [...REQUIREMENT_CANDIDATE_SCHEMA.required].sort().join('|') === [...EXPECTED_CANDIDATE_KEYS].sort().join('|');
  const properties = Object.keys(REQUIREMENT_CANDIDATE_SCHEMA.properties || {}).sort().join('|')
    === [...EXPECTED_CANDIDATE_KEYS].sort().join('|');
  const strict = REQUIREMENT_CANDIDATE_SCHEMA.additionalProperties === false;
  const candidatePass = candidateVersion === FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION
    && candidateHash === FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH
    && required && properties && strict;
  addGate(report, 'contract.candidate_schema', candidatePass, 'CANDIDATE_SCHEMA_MISMATCH', 'Candidate schema/version/hash or strictness differs from the frozen contract.');

  const payload = buildRequirementExtractionPayload({
    projectName: 'verification-project',
    sectionName: 'verification-section',
    chunkIndex: 1,
    chunkCount: 1,
    chunkText: 'verification-only synthetic text'
  });
  report.contract.payload_keys = Object.keys(payload);
  const payloadPass = [...Object.keys(payload)].sort().join('|') === [...EXPECTED_PAYLOAD_KEYS].sort().join('|');
  addGate(report, 'contract.model_payload', payloadPass, 'PAYLOAD_CONTRACT_DRIFT', 'Model-facing payload keys differ from the canonical builder.');
  return { contract, payload };
}

function routeChecks(report, env, gatewayUrl) {
  const config = parseSemanticGatewayConfig(env, { taskType: 'requirement_extraction' });
  const configured = safeUrl(config.apiBase);
  const legacyOnlyEnv = { ...env };
  for (const key of SEMANTIC_GATEWAY_RUNTIME_ENV_NAMES) delete legacyOnlyEnv[key];
  legacyOnlyEnv.V43_GATEWAY_API_BASE = 'http://127.0.0.1:18080/v1';
  legacyOnlyEnv.V43_GATEWAY_API_KEY = 'verification-only-legacy-key';
  legacyOnlyEnv.V43_GATEWAY_USER = 'verification-only';
  const legacyOnlyConfig = parseSemanticGatewayConfig(legacyOnlyEnv, { taskType: 'requirement_extraction' });
  const legacyOnlyClient = createSemanticGatewayClientFromEnv({ env: legacyOnlyEnv, taskType: 'requirement_extraction' });
  const legacyFallbackAbsent = !legacyOnlyConfig.apiBase
    && !legacyOnlyClient.apiBase
    && legacyOnlyConfig.config_source === 'canonical_semantic_gateway';
  const routePass = Boolean(config.apiBase)
    && config.config_source === 'canonical_semantic_gateway'
    && configured.host === '127.0.0.1'
    && String(configured.port) === '18082'
    && legacyFallbackAbsent;
  report.runtime.routing = {
    requirement_extraction_target: configured.url,
    config_source: config.config_source,
    legacy_18080_fallback: legacyFallbackAbsent ? 'ABSENT' : legacyOnlyConfig.apiBase ? 'PRESENT' : 'UNPROVEN',
    legacy_only_resolved_target: safeUrl(legacyOnlyConfig.apiBase).url,
    legacy_only_client_target: safeUrl(legacyOnlyClient.apiBase).url
  };
  addGate(report, 'routing.requirement_extraction', routePass, 'ROUTING_DRIFT', 'Requirement Extraction must use the standalone :18082 Gateway.');
  return config;
}

async function doctorInternal({
  env = process.env,
  fetchImpl = fetch,
  gitInfo = null,
  expectedRevision = null,
  candidateSchemaVersion = REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
  candidateSchemaHash = REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
  backendUrl = DEFAULT_BACKEND_URL,
  gatewayUrl = DEFAULT_GATEWAY_URL,
  now = Date.now,
  repoRoot = process.cwd()
} = {}) {
  const startedAt = nowValue(now);
  const resolvedGit = enrichGitInfo(gitInfo || defaultGitInfo(repoRoot), repoRoot);
  const report = baseReport('doctor', startedAt, resolvedGit);
  const branchPass = resolvedGit.branch_role !== BRANCH_ROLES.UNRELATED
    && resolvedGit.lineage_verified === true;
  addGate(report, 'git.branch_policy', branchPass, 'BRANCH_LINEAGE_DRIFT',
    '当前分支无法根据 branch-policy.json 证明与权威分支的有效 lineage。', {
      branch_role: resolvedGit.branch_role,
      production_eligible: resolvedGit.production_eligible,
      lineage_verified: resolvedGit.lineage_verified
    });
  const { payload } = contractChecks(report, { candidateSchemaVersion, candidateSchemaHash });
  const config = routeChecks(report, env, gatewayUrl);

  const backend = await fetchJson(fetchImpl, `${String(backendUrl).replace(/\/+$/, '')}/api/health`);
  report.runtime.backend = { url: safeUrl(backendUrl).url, http_status: backend.status, reachable: backend.ok };
  addGate(report, 'runtime.backend', backend.ok, 'BACKEND_UNREACHABLE', 'Backend health endpoint is not reachable.', { http_status: backend.status });

  const gatewayBase = String(config.apiBase || gatewayUrl).replace(/\/+$/, '');
  const health = await fetchJson(fetchImpl, `${gatewayBase}/health`);
  if (!health.ok) addGate(report, 'runtime.gateway.health', false, 'GATEWAY_UNREACHABLE', 'Gateway health endpoint is not reachable.', { http_status: health.status });
  else addGate(report, 'runtime.gateway.health', health.body?.service === 'semantic-gateway', 'GATEWAY_UNREACHABLE', 'Gateway health response is not the expected service.');

  const ready = await fetchJson(fetchImpl, `${gatewayBase}/ready`);
  const readyPass = ready.ok && ready.body?.status === 'ready';
  report.runtime.provider_configured = ready.body?.provider_configured === true;
  addGate(report, 'runtime.gateway.ready', readyPass, 'GATEWAY_NOT_READY', 'Gateway is not ready.', { http_status: ready.status });
  addGate(report, 'runtime.provider_configured', report.runtime.provider_configured, 'PROVIDER_NOT_CONFIGURED', 'Gateway does not report a configured provider.');

  const info = await fetchJson(fetchImpl, `${gatewayBase}/info`);
  const body = info.body || {};
  report.runtime.gateway = { url: safeUrl(gatewayBase).url, http_status: info.status, reachable: info.ok };
  report.runtime.gateway_build_revision = typeof body.build_revision === 'string' ? body.build_revision : null;
  const infoReachable = info.ok && body.service === 'semantic-gateway';
  addGate(report, 'runtime.gateway.info', infoReachable, 'GATEWAY_UNREACHABLE', 'Gateway info endpoint is not reachable or identifies another service.', { http_status: info.status });
  addGate(report, 'runtime.gateway.task_registry', body.task_registry_loaded === true
    && Array.isArray(body.task_types) && body.task_types.includes('requirement_extraction'), 'CONTRACT_DRIFT', 'Requirement Extraction is not present in the loaded task registry.');
  addGate(report, 'runtime.gateway.contract_version', body.requirement_extraction_contract_version === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_VERSION, 'CONTRACT_DRIFT', 'Running Gateway reports a different Requirement Extraction contract version.');
  addGate(report, 'runtime.gateway.prompt_hash', body.requirement_extraction_prompt_hash === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH
    || body.requirement_extraction_instruction_hash === FROZEN_REQUIREMENT_EXTRACTION_PROMPT_HASH, 'PROMPT_HASH_MISMATCH', 'Running Gateway reports a different Requirement Extraction instruction hash.');
  addGate(report, 'runtime.gateway.candidate_schema', body.candidate_schema_contract_version === FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_VERSION
    && body.candidate_schema_sha256 === FROZEN_REQUIREMENT_CANDIDATE_SCHEMA_HASH, 'CANDIDATE_SCHEMA_MISMATCH', 'Running Gateway reports a different Candidate Schema.');

  if (expectedRevision) {
    addGate(report, 'runtime.gateway.revision', compareShaPrefix(expectedRevision, report.runtime.gateway_build_revision), 'REVISION_MISMATCH', 'Gateway build revision does not match the requested revision.');
  }
  report.verdict = report.blockers.length ? 'BLOCKED' : 'READY_FOR_ACCEPTANCE';
  return finishReport(report, startedAt, now);
}

export async function runRequirementExtractionDoctor(options = {}) {
  const report = await doctorInternal(options);
  if (options.writeReport !== false) await writeVerificationReport(report, options.reportPath || DEFAULT_REQUIREMENT_EXTRACTION_REPORT_PATH);
  return { ok: report.verdict === 'READY_FOR_ACCEPTANCE', report };
}

const ACCEPT_COMMANDS = Object.freeze([
  { label: 'backend', command: 'npm', args: ['test', '-w', 'backend'] },
  { label: 'frontend', command: 'npm', args: ['test', '-w', 'frontend'] },
  { label: 'postgresql', command: 'npm', args: ['run', 'test:postgres', '-w', 'backend'] },
  { label: 'semantic_gateway', command: 'npm', args: ['test', '-w', 'semantic-gateway'] },
  { label: 'requirement_extraction_targeted', command: 'node', args: ['--test', 'backend/test/tender-parse.test.js', 'backend/test/semantic-gateway-client.test.js'] },
  { label: 'build', command: 'npm', args: ['run', 'build'] },
  { label: 'lint', command: 'npm', args: ['run', 'lint'] },
  { label: 'git_diff_check', command: 'git', args: ['diff', '--check'] }
]);

export async function runRequirementExtractionAccept({
  commandRunner = defaultCommandRunner,
  now = Date.now,
  reportPath = DEFAULT_REQUIREMENT_EXTRACTION_REPORT_PATH,
  ...doctorOptions
} = {}) {
  const doctor = await doctorInternal({ ...doctorOptions, now, writeReport: false });
  const startedAt = Date.parse(doctor.started_at);
  const report = { ...doctor, mode: 'accept', tests: [], live: { ...doctor.live } };
  const commandCwd = doctorOptions.repoRoot || process.cwd();
  if (report.verdict === 'READY_FOR_ACCEPTANCE') {
    for (const item of ACCEPT_COMMANDS) {
      let result;
      try {
        result = commandRunner({ ...item, cwd: commandCwd });
      } catch (_error) {
        result = { exit_code: 1, duration_ms: null };
      }
      const passed = Number(result?.exit_code) === 0;
      report.tests.push({
        name: item.label,
        command: item.command,
        exit_code: Number.isInteger(result?.exit_code) ? result.exit_code : 1,
        duration_ms: Number.isInteger(result?.duration_ms) ? result.duration_ms : null,
        status: passed ? 'PASS' : 'FAIL'
      });
      if (!passed) {
        const blocker = item.label === 'build' ? 'BUILD_FAILURE' : item.label === 'lint' ? 'LINT_FAILURE' : 'TEST_FAILURE';
        report.blockers.push(blocker);
      }
    }
  }
  report.verdict = report.blockers.length
    ? 'BLOCKED'
    : report.git.branch_role === BRANCH_ROLES.HISTORICAL
      ? 'READY_FOR_ACCEPTANCE'
      : 'READY_FOR_LIVE';
  const finished = finishReport(report, startedAt, now);
  if (doctorOptions.writeReport !== false) await writeVerificationReport(finished, reportPath);
  return { ok: finished.verdict === 'READY_FOR_LIVE', report: finished };
}

function safeLiveResult(value = {}) {
  const providerRequestCount = Number.isInteger(value.provider_request_count)
    ? value.provider_request_count : 0;
  const executed = value.executed === true;
  const verificationRunCount = Number.isInteger(value.verification_run_count)
    ? value.verification_run_count
    : executed ? 1 : 0;
  return sanitizeVerificationReport({
    executed,
    verification_run_count: verificationRunCount,
    production_chunk_count: Number.isInteger(value.production_chunk_count) ? value.production_chunk_count : 0,
    expected_chunk_count: Number.isInteger(value.expected_chunk_count) ? value.expected_chunk_count : 0,
    provider_request_count: providerRequestCount,
    max_provider_request_count: Number.isInteger(value.max_provider_request_count)
      ? value.max_provider_request_count : providerRequestCount,
    concurrency_limit: Number.isInteger(value.concurrency_limit) ? value.concurrency_limit : 0,
    retry_count: Number.isInteger(value.retry_count) ? value.retry_count : 0,
    fallback_count: Number.isInteger(value.fallback_count) ? value.fallback_count : 0,
    dify_call_count: Number.isInteger(value.dify_call_count) ? value.dify_call_count : 0,
    embedding_call_count: Number.isInteger(value.embedding_call_count) ? value.embedding_call_count : 0,
    gateway_http_status: Number.isInteger(value.gateway_http_status) ? value.gateway_http_status : null,
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    provider_http_reached: value.provider_http_reached === true,
    provider_chain_verified: value.provider_chain_verified === true,
    candidate_count: Number.isInteger(value.candidate_count) ? value.candidate_count : null,
    total_candidate_count: Number.isInteger(value.total_candidate_count) ? value.total_candidate_count : null,
    schema_pass: typeof value.schema_pass === 'boolean' ? value.schema_pass : null,
    source_resolution_pass: typeof value.source_resolution_pass === 'boolean' ? value.source_resolution_pass : null,
    backend_ingestion_pass: typeof value.backend_ingestion_pass === 'boolean' ? value.backend_ingestion_pass : null,
    chunk_character_sizes: Array.isArray(value.chunk_character_sizes)
      ? value.chunk_character_sizes.filter(Number.isInteger).slice(0, 1000) : [],
    chunk_results: Array.isArray(value.chunk_results) ? value.chunk_results.slice(0, 1000) : [],
    final_probe_status: typeof value.final_probe_status === 'string' ? value.final_probe_status : null,
    diagnostics: value.diagnostics || null,
    technical_error_code: typeof value.technical_error_code === 'string' ? value.technical_error_code : null
  });
}

/**
 * Reuse the production Candidate → Canonical projection for the live harness.
 * The verifier only validates the in-memory projection; it never persists a
 * Requirement or mutates formal business state.
 */
export function mapValidatedCandidatesToCanonicalInput(candidates, { resolutions = null } = {}) {
  if (!Array.isArray(candidates)) {
    throw Object.assign(new Error('Candidate list is invalid.'), { code: 'BACKEND_INGESTION_FAILED' });
  }
  return candidates.map((candidate, index) => {
    const resolution = Array.isArray(resolutions) ? resolutions[index] : null;
    const resolvedCandidate = resolution?.location
      ? { ...candidate, ...resolution.location }
      : candidate;
    const mapped = mapRequirementCandidateToCanonicalInput(
      resolvedCandidate,
      index + 1,
      { allowBackendProvenance: Boolean(resolution?.location) }
    );
    const candidateText = typeof candidate?.text === 'string' ? candidate.text.trim() : null;
    if (!mapped
      || mapped.content !== candidateText
      || !Array.isArray(mapped.sources?.[0]?.source_refs)
      || JSON.stringify(mapped.sources[0].source_refs)
        !== JSON.stringify(resolvedCandidate?.source_refs)
      || Object.hasOwn(candidate, 'content')
      || Object.hasOwn(candidate, 'source_excerpt')
      || Object.hasOwn(candidate, 'source_text')
      || Object.hasOwn(candidate, 'source_clause')
      || Object.hasOwn(candidate, 'source_refs')) {
      throw Object.assign(new Error('Candidate canonical mapping failed.'), { code: 'BACKEND_INGESTION_FAILED' });
    }
    return mapped;
  });
}

export async function defaultLiveExecutor({ env, liveRequest, fetchImpl = fetch }) {
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction', fetchImpl });
  const gateway = createRequirementExtractionGateway(client);
  const sourceLocationResolver = new SourceLocationResolver();
  const chunks = Array.isArray(liveRequest?.chunks) && liveRequest.chunks.length
    ? liveRequest.chunks
    : liveRequest?.chunk ? [liveRequest.chunk] : [];
  if (!chunks.length) {
    return safeLiveResult({
      executed: false,
      verification_run_count: 0,
      production_chunk_count: 0,
      expected_chunk_count: 0,
      technical_error_code: 'LIVE_PAYLOAD_REQUIRED',
      final_probe_status: 'BLOCKED'
    });
  }

  // A production-like verifier may carry the exact input it intends to send
  // as provider_input_text.  Compare it with the production resolver before
  // any worker is scheduled; drift is a hard stop and cannot reach Provider.
  const parityMismatch = chunks.find((chunk) => {
    if (!Object.hasOwn(chunk, 'provider_input_text')) return false;
    try {
      assertRequirementExtractionProviderInputParity({
        chunk,
        fallbackText: chunk.text,
        actualInput: chunk.provider_input_text
      });
      return false;
    } catch (error) {
      return error?.code === 'PRODUCTION_PARITY_VIOLATION';
    }
  });
  if (parityMismatch) {
    return safeLiveResult({
      executed: false,
      verification_run_count: 0,
      production_chunk_count: chunks.length,
      expected_chunk_count: chunks.length,
      provider_request_count: 0,
      max_provider_request_count: chunks.length,
      concurrency_limit: Math.min(2, chunks.length),
      schema_pass: false,
      source_resolution_pass: false,
      backend_ingestion_pass: false,
      technical_error_code: 'PRODUCTION_PARITY_VIOLATION',
      final_probe_status: 'BLOCKED'
    });
  }

  const concurrencyLimit = Math.min(2, chunks.length);
  const chunkResults = new Array(chunks.length);
  let nextIndex = 0;
  let providerRequestCount = 0;
  let firstFailure = null;

  const executeChunk = async (chunk, index) => {
    let gatewayResult = null;
    let schemaPass = false;
    let candidateCount = null;
    try {
      gatewayResult = await gateway.extract({
        ...liveRequest,
        chunk,
        text: resolveRequirementExtractionProviderInput({
          chunk,
          fallbackText: chunk.text
        }),
        chunkCount: chunks.length,
        diagnosticMode: 'probe-v1'
      });
      schemaPass = true;
      candidateCount = gatewayResult.candidates.length;
      const diagnostics = gatewayResult.audit?.probe_diagnostics || null;
      // Resolve every Candidate against this exact production chunk window
      // before invoking the production Candidate → Canonical projection.
      const resolutions = gatewayResult.candidates.map((candidate) => {
        const resolution = sourceLocationResolver.resolve(candidate, chunk);
        validateCandidateSourceScope(candidate, chunk);
        return resolution;
      });
      const mappedCandidates = mapValidatedCandidatesToCanonicalInput(gatewayResult.candidates, { resolutions });
      const providerChainVerified = diagnostics?.provider_adapter_invoked === true
        && diagnostics?.fetch_invoked === true
        && diagnostics?.provider_http_reached === true
        && diagnostics?.provider_http_status === 200;
      return {
        ok: true,
        chunk_number: chunk.chunk_number || index + 1,
        character_count: chunk.character_count,
        gateway_http_status: 200,
        provider_http_status: diagnostics?.provider_http_status || null,
        finish_reason: diagnostics?.finish_reason || null,
        prompt_tokens: diagnostics?.prompt_tokens ?? null,
        completion_tokens: diagnostics?.completion_tokens ?? null,
        output_truncated: diagnostics?.output_truncated === true,
        provider_chain_verified: providerChainVerified,
        candidate_count: mappedCandidates.length,
        schema_pass: true,
        source_resolution_pass: true,
        backend_ingestion_pass: true,
        unresolved_ref_count: 0,
        duplicate_ref_failure_count: 0,
        non_contiguous_ref_failure_count: 0,
        diagnostics
      };
    } catch (error) {
      const diagnostics = gatewayResult?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || null;
      const providerChainVerified = diagnostics?.provider_adapter_invoked === true
        && diagnostics?.fetch_invoked === true
        && diagnostics?.provider_http_reached === true
        && diagnostics?.provider_http_status === 200;
      const sourceResolutionFailure = error?.code === 'SOURCE_LOCATION_UNRESOLVED'
        || error?.code === 'GATEWAY_REQUIREMENTS_INVALID';
      const nonContiguous = sourceResolutionFailure && /连续段落/.test(error?.message || '');
      const duplicate = sourceResolutionFailure && /重复引用/.test(error?.message || '');
      return {
        ok: false,
        chunk_number: chunk.chunk_number || index + 1,
        character_count: chunk.character_count,
        gateway_http_status: gatewayResult ? 200 : Number.isInteger(error?.audit?.http_status) ? error.audit.http_status : null,
        provider_http_status: diagnostics?.provider_http_status || null,
        finish_reason: diagnostics?.finish_reason || null,
        prompt_tokens: diagnostics?.prompt_tokens ?? null,
        completion_tokens: diagnostics?.completion_tokens ?? null,
        output_truncated: diagnostics?.output_truncated === true,
        provider_chain_verified: providerChainVerified,
        candidate_count: candidateCount,
        schema_pass: schemaPass,
        source_resolution_pass: sourceResolutionFailure ? false : null,
        backend_ingestion_pass: false,
        unresolved_ref_count: sourceResolutionFailure && !nonContiguous && !duplicate ? 1 : 0,
        duplicate_ref_failure_count: duplicate ? 1 : 0,
        non_contiguous_ref_failure_count: nonContiguous ? 1 : 0,
        technical_error_code: error?.code || 'PROVIDER_OUTPUT_INVALID',
        diagnostics
      };
    }
  };

  const worker = async () => {
    while (true) {
      if (firstFailure) return;
      const index = nextIndex++;
      if (index >= chunks.length) return;
      providerRequestCount += 1;
      const result = await executeChunk(chunks[index], index);
      chunkResults[index] = result;
      if (!result.ok && !firstFailure) firstFailure = result;
    }
  };
  await Promise.all(Array.from({ length: concurrencyLimit }, () => worker()));

  const completedResults = chunkResults.filter(Boolean);
  const totalCandidateCount = completedResults.reduce(
    (count, result) => count + (Number.isInteger(result.candidate_count) ? result.candidate_count : 0), 0
  );
  const allSucceeded = completedResults.length === chunks.length
    && completedResults.every((result) => result.ok && result.schema_pass === true
      && result.source_resolution_pass === true && result.backend_ingestion_pass === true
      && result.provider_chain_verified === true
      && result.finish_reason !== 'length'
      && result.output_truncated !== true);
  const diagnostics = completedResults.length === 1
    ? completedResults[0].diagnostics || null
    : completedResults.map((result) => result.diagnostics || null);
  const first = completedResults[0] || {};
  return safeLiveResult({
    executed: providerRequestCount > 0,
    verification_run_count: 1,
    production_chunk_count: chunks.length,
    expected_chunk_count: chunks.length,
    provider_request_count: providerRequestCount,
    max_provider_request_count: chunks.length,
    concurrency_limit: concurrencyLimit,
    gateway_http_status: first.gateway_http_status,
    provider_http_status: first.provider_http_status,
    provider_chain_verified: allSucceeded,
    candidate_count: totalCandidateCount,
    total_candidate_count: totalCandidateCount,
    schema_pass: allSucceeded,
    source_resolution_pass: allSucceeded,
    backend_ingestion_pass: allSucceeded,
    chunk_character_sizes: chunks.map((chunk) => chunk.character_count),
    chunk_results: completedResults,
    diagnostics,
    technical_error_code: firstFailure?.technical_error_code || null,
    final_probe_status: allSucceeded ? 'PASS' : 'BLOCKED'
  });
}

export async function runRequirementExtractionLive({
  // One explicit confirmation covers the bounded verification run, which may
  // contain one provider request per production chunk.
  confirmLiveRun = false,
  liveRequest = null,
  liveExecutor = defaultLiveExecutor,
  liveRequestError = null,
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  reportPath = DEFAULT_REQUIREMENT_EXTRACTION_REPORT_PATH,
  ...doctorOptions
} = {}) {
  const doctor = await doctorInternal({ ...doctorOptions, env, fetchImpl, now, writeReport: false });
  const startedAt = Date.parse(doctor.started_at);
  const report = { ...doctor, mode: 'live', live: { ...doctor.live } };
  if (!assertLiveBranch({ branchInfo: report.git }).allowed) report.blockers.push('BRANCH_DRIFT');
  if (!confirmLiveRun) report.blockers.push('LIVE_CONFIRMATION_REQUIRED');
  else if (report.blockers.length === 0 && !liveRequest) {
    report.blockers.push(typeof liveRequestError === 'string' && liveRequestError
      ? liveRequestError
      : 'LIVE_PAYLOAD_REQUIRED');
  }
  else if (report.blockers.length === 0) {
    let live;
    try {
      live = safeLiveResult(await liveExecutor({ env, liveRequest, fetchImpl }));
    } catch (error) {
      live = safeLiveResult({
        executed: true,
        provider_request_count: 0,
        technical_error_code: error?.code || 'PROVIDER_OUTPUT_INVALID',
        schema_pass: false,
        backend_ingestion_pass: false
      });
    }
    report.live = live;
    const expectedChunkCount = Array.isArray(liveRequest?.chunks) && liveRequest.chunks.length
      ? liveRequest.chunks.length
      : liveRequest ? 1 : 0;
    if (live.verification_run_count !== 1
      || live.provider_request_count > expectedChunkCount
      || live.max_provider_request_count !== expectedChunkCount
      || live.retry_count !== 0
      || live.fallback_count !== 0) report.blockers.push('DIAGNOSTIC_INSUFFICIENT');
    if (live.provider_chain_verified !== true) report.blockers.push('DIAGNOSTIC_INSUFFICIENT');
    if (live.schema_pass !== true) report.blockers.push(live.technical_error_code || 'PROVIDER_OUTPUT_INVALID');
    if (live.source_resolution_pass === false) report.blockers.push(live.technical_error_code || 'SOURCE_LOCATION_UNRESOLVED');
    if (live.backend_ingestion_pass === false) report.blockers.push('BACKEND_INGESTION_FAILED');
  }
  report.verdict = report.blockers.length ? 'BLOCKED' : 'LIVE_VERIFIED';
  const finished = finishReport(report, startedAt, now);
  if (doctorOptions.writeReport !== false) await writeVerificationReport(finished, reportPath);
  return { ok: finished.verdict === 'LIVE_VERIFIED', report: finished };
}

export { ACCEPT_COMMANDS, EXPECTED_PAYLOAD_KEYS, EXPECTED_CANDIDATE_KEYS, defaultCommandRunner };
