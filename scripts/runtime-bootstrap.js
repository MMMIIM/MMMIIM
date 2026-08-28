import { spawnSync } from 'node:child_process';
import { waitForRuntimeHealth } from './runtime-health.js';
import { applyRuntimeSourceIdentity } from './runtime-source-identity.js';

applyRuntimeSourceIdentity();

// Reuse the repository's existing bid-platform Compose project so the
// persistent PostgreSQL container remains the single database owner.
export const COMPOSE_PROJECT = 'bid-platform';

export function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

export function dockerDaemonAvailable(run = runCommand) {
  const result = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  return {
    ok: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : null,
    error: result.status === 0 ? null : String(result.stderr || 'docker daemon unavailable').trim().slice(0, 240)
  };
}

export function composeArgs(...args) {
  return ['compose', '-p', COMPOSE_PROJECT, ...args];
}

/**
 * Recreate only the development application services from images already
 * present on the host. This path never builds, pulls, or touches PostgreSQL.
 */
export async function recreateRuntime({
  run = runCommand,
  waitForHealth = () => waitForRuntimeHealth()
} = {}) {
  const daemon = dockerDaemonAvailable(run);
  if (!daemon.ok) return { status: 'HOST_DOCKER_UNAVAILABLE', daemon };

  const config = run('docker', composeArgs('config', '--quiet'));
  if (config.status !== 0) {
    return { status: 'BLOCKED_RUNTIME_RECREATE', daemon, error: String(config.stderr || 'Compose config failed').trim().slice(0, 240) };
  }

  const up = run('docker', composeArgs(
    'up', '-d', '--no-build', '--pull', 'never', '--force-recreate', '--no-deps',
    'semantic-gateway', 'backend'
  ));
  if (up.status !== 0) {
    return { status: 'BLOCKED_RUNTIME_RECREATE', daemon, error: String(up.stderr || 'Compose recreate failed').trim().slice(0, 240) };
  }

  const health = await waitForHealth();
  return health?.runtime === 'READY'
    ? { status: 'READY', daemon, health }
    : { status: 'BLOCKED_RUNTIME_RECREATE', daemon, health };
}

/**
 * Bootstrap is intentionally fail-fast. No host process or port is touched
 * until Docker daemon access and Compose configuration have both passed.
 */
export async function bootstrapRuntime({
  run = runCommand,
  cleanupPorts = async () => ({ ok: true, terminated: [] }),
  waitForHealth = () => waitForRuntimeHealth(),
  refresh = false
} = {}) {
  const daemon = dockerDaemonAvailable(run);
  if (!daemon.ok) return { status: 'HOST_DOCKER_UNAVAILABLE', daemon };

  const config = run('docker', composeArgs('config', '--quiet'));
  if (config.status !== 0) {
    return { status: 'BLOCKED_CONTAINER_BUILD', daemon, error: String(config.stderr || 'Compose config failed').trim().slice(0, 240) };
  }

  const ports = await cleanupPorts();
  if (!ports?.ok) return { status: 'PORT_CONFLICT', daemon, ports };

  const upArgs = refresh
    ? composeArgs('up', '-d', '--build', '--force-recreate', 'semantic-gateway', 'backend')
    : composeArgs('up', '-d', '--build', 'postgres', 'semantic-gateway', 'backend');
  const up = run('docker', upArgs);
  if (up.status !== 0) {
    return { status: 'BLOCKED_CONTAINER_BUILD', daemon, error: String(up.stderr || 'Compose startup failed').trim().slice(0, 240) };
  }
  const health = await waitForHealth();
  return health?.runtime === 'READY'
    ? { status: 'READY', daemon, health, ports }
    : { status: 'BLOCKED_CONTAINER_BUILD', daemon, health, ports };
}

async function main() {
  const result = await bootstrapRuntime({ refresh: process.argv.includes('--refresh') });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === 'READY' ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('runtime-bootstrap.js')) await main();
