import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRANCH_ROLES,
  assertLiveBranch,
  checkFastForwardSync,
  classifyBranch,
  evaluateFastForwardSync,
  loadBranchPolicy
} from '../src/verification/branch-policy.js';
import {
  runRequirementExtractionAccept,
  runRequirementExtractionDoctor,
  runRequirementExtractionLive
} from '../src/verification/requirement-extraction-verifier.js';

const repoRoot = process.cwd();
const policy = loadBranchPolicy({ repoRoot });
const env = {
  SEMANTIC_GATEWAY_PROVIDER: 'openai_compatible',
  SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
  SEMANTIC_GATEWAY_API_KEY: 'service-test-key',
  SEMANTIC_GATEWAY_USER: 'branch-policy-test',
  SEMANTIC_GATEWAY_PROVIDER_API_BASE: 'https://provider.test/v1',
  SEMANTIC_GATEWAY_PROVIDER_API_KEY: 'provider-test-key',
  SEMANTIC_GATEWAY_MODEL: 'test-model'
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function healthyFetch(url) {
  if (url.endsWith('/api/health')) return response({ ok: true, database: 'connected' });
  if (url.endsWith('/health')) return response({ status: 'ok', service: 'semantic-gateway' });
  if (url.endsWith('/ready')) return response({ status: 'ready', provider_configured: true });
  if (url.endsWith('/info')) return response({
    service: 'semantic-gateway',
    task_registry_loaded: true,
    task_types: ['requirement_extraction'],
    requirement_extraction_contract_version: '4.3-requirement-extraction-v3',
    requirement_extraction_prompt_hash: 'de424ed7fa81a476c2021f35b6c63babd654c32e48bf3d42ec0380356fd4c589',
    candidate_schema_contract_version: '4.3-requirement-candidate-v3',
    candidate_schema_sha256: '1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba'
  });
  throw new Error(`unexpected url ${url}`);
}

const gitInfo = (branch) => ({ branch, revision: 'test', tracked_clean: true });

test('branch policy is machine-readable and forbids dangerous automatic Git repair', () => {
  assert.equal(policy.authoritative_branch, 'feat/v4.3-semantic-boundary-routing');
  assert.deepEqual(policy.historical_branches, ['feat/v4.3-production-beta']);
  assert.equal(policy.production_sync_policy, 'ff-preferred-stop-on-divergence');
  assert.equal(policy.force_push_allowed, false);
  assert.equal(policy.automatic_reset_allowed, false);
  assert.equal(Object.hasOwn(policy, 'sha'), false);
});

test('authoritative, valid fix/feat, historical and unrelated branches have explicit roles', () => {
  const authoritative = classifyBranch({
    branch: 'feat/v4.3-semantic-boundary-routing', policy, repoRoot
  });
  const fixFeature = classifyBranch({
    branch: 'fix/v4.3-requirement-extraction-live-harness-closure', policy, repoRoot
  });
  const featFeature = classifyBranch({
    branch: 'feat/v4.3-semantic-gateway-client', policy, repoRoot
  });
  const historical = classifyBranch({ branch: 'feat/v4.3-production-beta', policy, repoRoot });
  const unrelated = classifyBranch({ branch: 'main', policy, repoRoot });

  assert.equal(authoritative.branch_role, BRANCH_ROLES.AUTHORITATIVE);
  assert.equal(authoritative.production_eligible, true);
  assert.equal(authoritative.lineage_verified, true);
  assert.equal(fixFeature.branch_role, BRANCH_ROLES.FEATURE);
  assert.equal(fixFeature.lineage_verified, true);
  assert.equal(featFeature.branch_role, BRANCH_ROLES.FEATURE);
  assert.equal(featFeature.lineage_verified, true);
  assert.equal(historical.branch_role, BRANCH_ROLES.HISTORICAL);
  assert.equal(historical.production_eligible, false);
  assert.equal(historical.blocker, null);
  assert.equal(unrelated.branch_role, BRANCH_ROLES.UNRELATED);
  assert.equal(unrelated.blocker, 'BRANCH_LINEAGE_DRIFT');
});

test('live branch guard allows only the exact authoritative role', () => {
  assert.deepEqual(assertLiveBranch({
    branchInfo: { branch_role: BRANCH_ROLES.AUTHORITATIVE }
  }), { allowed: true, blocker: null });
  assert.deepEqual(assertLiveBranch({
    branchInfo: { branch_role: BRANCH_ROLES.FEATURE }
  }), { allowed: false, blocker: 'BRANCH_DRIFT' });
  assert.deepEqual(assertLiveBranch({
    branchInfo: { branch_role: BRANCH_ROLES.HISTORICAL }
  }), { allowed: false, blocker: 'BRANCH_DRIFT' });
});

test('authoritative branch identity is not pinned to a historical SHA', () => {
  const before = classifyBranch({
    branch: policy.authoritative_branch,
    policy,
    repoRoot,
    headRef: 'deadbeef'
  });
  const after = classifyBranch({
    branch: policy.authoritative_branch,
    policy,
    repoRoot,
    headRef: 'another-tip'
  });
  assert.equal(before.branch_role, BRANCH_ROLES.AUTHORITATIVE);
  assert.equal(after.branch_role, BRANCH_ROLES.AUTHORITATIVE);
  assert.equal(before.blocker, null);
  assert.equal(after.blocker, null);
});

test('ff-only sync permits an ancestor or equal tip and stops on divergence', () => {
  assert.deepEqual(evaluateFastForwardSync({
    authoritativeHead: 'a', featureHead: 'b', authoritativeIsAncestor: true
  }), { allowed: true, status: 'FAST_FORWARD_ALLOWED' });
  assert.deepEqual(evaluateFastForwardSync({
    authoritativeHead: 'a', featureHead: 'a', authoritativeIsAncestor: false
  }), { allowed: true, status: 'ALREADY_SYNCED' });
  assert.deepEqual(evaluateFastForwardSync({
    authoritativeHead: 'a', featureHead: 'b', authoritativeIsAncestor: false
  }), { allowed: false, status: 'BRANCH_LINEAGE_DIVERGED' });
});

test('real authoritative ref resolution is read-only and topology-stable', () => {
  const result = checkFastForwardSync({
    repoRoot,
    authoritativeBranch: policy.authoritative_branch,
    featureBranch: policy.authoritative_branch
  });
  assert.equal(result.allowed, true);
  assert.equal(result.status, 'ALREADY_SYNCED');
  assert.ok(result.authoritative_head);
  assert.ok(result.feature_head);
  assert.equal(result.authoritative_head, result.feature_head);
  assert.equal(result.authoritative_branch, policy.authoritative_branch);
  assert.equal(result.feature_branch, policy.authoritative_branch);
});

test('doctor passes a valid feature and historical branch remains non-production eligible', async () => {
  const feature = await runRequirementExtractionDoctor({
    env, fetchImpl: healthyFetch, gitInfo: gitInfo('fix/v4.3-branch-policy-guard'), writeReport: false, repoRoot
  });
  assert.equal(feature.ok, true);
  assert.equal(feature.report.git.branch_role, BRANCH_ROLES.FEATURE);
  assert.equal(feature.report.git.branch_name, 'fix/v4.3-branch-policy-guard');
  assert.equal(feature.report.git.production_eligible, false);

  const historical = await runRequirementExtractionDoctor({
    env, fetchImpl: healthyFetch, gitInfo: gitInfo('feat/v4.3-production-beta'), writeReport: false, repoRoot
  });
  assert.equal(historical.ok, true);
  assert.equal(historical.report.git.branch_role, BRANCH_ROLES.HISTORICAL);
  assert.equal(historical.report.git.production_eligible, false);
});

test('doctor blocks unrelated lineage and historical accept never becomes live-ready', async () => {
  const unrelated = await runRequirementExtractionDoctor({
    env, fetchImpl: healthyFetch, gitInfo: gitInfo('main'), writeReport: false, repoRoot
  });
  assert.equal(unrelated.ok, false);
  assert.ok(unrelated.report.blockers.includes('BRANCH_LINEAGE_DRIFT'));

  const historical = await runRequirementExtractionAccept({
    env,
    fetchImpl: healthyFetch,
    gitInfo: gitInfo('feat/v4.3-production-beta'),
    commandRunner: () => ({ exit_code: 0, duration_ms: 1 }),
    writeReport: false,
    repoRoot
  });
  assert.equal(historical.ok, false);
  assert.equal(historical.report.verdict, 'READY_FOR_ACCEPTANCE');
  assert.equal(historical.report.git.production_eligible, false);
});

test('live on a non-authoritative branch is blocked before executor invocation', async () => {
  let calls = 0;
  const result = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch,
    gitInfo: gitInfo('fix/v4.3-branch-policy-guard'),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
    liveExecutor: async () => { calls += 1; return {}; },
    writeReport: false,
    repoRoot
  });
  assert.equal(result.ok, false);
  assert.ok(result.report.blockers.includes('BRANCH_DRIFT'));
  assert.equal(calls, 0);
});

test('live on the authoritative branch may invoke only the injected executor', async () => {
  let calls = 0;
  const result = await runRequirementExtractionLive({
    env,
    fetchImpl: healthyFetch,
    gitInfo: gitInfo('feat/v4.3-semantic-boundary-routing'),
    confirmLiveRun: true,
    liveRequest: { text: 'synthetic' },
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
        source_resolution_pass: true,
        backend_ingestion_pass: true
      };
    },
    writeReport: false,
    repoRoot
  });
  assert.equal(result.ok, true);
  assert.equal(result.report.verdict, 'LIVE_VERIFIED');
  assert.equal(calls, 1);
  assert.equal(result.report.git.production_eligible, true);
});
