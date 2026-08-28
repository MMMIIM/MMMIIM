import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapRuntime, dockerDaemonAvailable, recreateRuntime } from '../../scripts/runtime-bootstrap.js';
import { runtimeHealth } from '../../scripts/runtime-health.js';
import { readRuntimeSourceIdentity } from '../../scripts/runtime-source-identity.js';

test('Docker-unavailable bootstrap fails before any port cleanup', async () => {
  const calls = [];
  let cleanupCalled = false;
  const result = await bootstrapRuntime({
    run: (command, args) => {
      calls.push([command, args]);
      return { status: 1, stdout: '', stderr: 'docker_engine permission denied' };
    },
    cleanupPorts: () => { cleanupCalled = true; return { ok: true }; },
    waitForHealth: async () => ({ ok: true })
  });
  assert.equal(result.status, 'HOST_DOCKER_UNAVAILABLE');
  assert.equal(cleanupCalled, false);
  assert.deepEqual(calls.map(([command]) => command), ['docker']);
});

test('Docker daemon preflight is a read-only first gate', () => {
  const result = dockerDaemonAvailable((command, args) => ({
    command,
    args,
    status: 0,
    stdout: '27.0.0',
    stderr: ''
  }));
  assert.equal(result.ok, true);
  assert.equal(result.version, '27.0.0');
});

test('no-build runtime recreate touches only Gateway and Backend', async () => {
  const calls = [];
  const result = await recreateRuntime({
    run: (command, args) => {
      calls.push([command, args]);
      return { status: 0, stdout: command === 'docker' && args[1] === 'info' ? '29.7.2' : '', stderr: '' };
    },
    waitForHealth: async () => ({ runtime: 'READY', backend: 'READY', semantic_gateway: 'READY', postgres: 'READY' })
  });
  assert.equal(result.status, 'READY');
  const upArgs = calls.find(([, args]) => args.includes('up'))?.[1] || [];
  assert.ok(upArgs.includes('--no-build'));
  assert.ok(upArgs.includes('--pull'));
  assert.ok(upArgs.includes('never'));
  assert.ok(upArgs.includes('--force-recreate'));
  assert.ok(upArgs.includes('--no-deps'));
  assert.deepEqual(upArgs.slice(-2), ['semantic-gateway', 'backend']);
  assert.equal(upArgs.includes('--build'), false);
  assert.equal(upArgs.includes('postgres'), false);
});

test('runtime source identity is derived without exposing secrets', () => {
  const calls = [];
  const identity = readRuntimeSourceIdentity((args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return { status: 0, stdout: '8a5b721\n', stderr: '' };
    return { status: 0, stdout: ' M services/semantic-gateway/src/gateway.js\n', stderr: '' };
  });
  assert.deepEqual(identity, { revision: '8a5b721', workingTreeDirty: true });
  assert.deepEqual(calls, [['rev-parse', '--short', 'HEAD'], ['status', '--porcelain']]);
});

test('runtime health checks use localhost HTTP/TCP only', async () => {
  const requested = [];
  const result = await runtimeHealth({
    fetchImpl: async (url) => {
      requested.push(url);
      return new Response(JSON.stringify({ status: url.endsWith('/ready') ? 'ready' : 'ok' }), { status: 200 });
    },
    tcpCheck: async () => true
  });
  assert.deepEqual(result, {
    runtime: 'READY',
    backend: 'READY',
    semantic_gateway: 'READY',
    postgres: 'READY'
  });
  assert.deepEqual(requested, [
    'http://127.0.0.1:3001/api/health',
    'http://127.0.0.1:18082/health',
    'http://127.0.0.1:18082/ready'
  ]);
});
