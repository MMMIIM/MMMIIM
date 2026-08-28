import net from 'node:net';

const BACKEND_HEALTH_URL = 'http://127.0.0.1:3001/api/health';
const GATEWAY_HEALTH_URL = 'http://127.0.0.1:18082/health';
const GATEWAY_READY_URL = 'http://127.0.0.1:18082/ready';

async function checkHttp(url, { fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch (_error) { /* HTTP status is sufficient for health. */ }
    return { ok: response.ok, status: response.status, body };
  } catch (_error) {
    return { ok: false, status: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}

export function checkTcp({ host = '127.0.0.1', port = 5432, timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

export async function runtimeHealth({ fetchImpl = fetch, tcpCheck = checkTcp } = {}) {
  const [backend, gatewayHealth, gatewayReady, postgres] = await Promise.all([
    checkHttp(BACKEND_HEALTH_URL, { fetchImpl }),
    checkHttp(GATEWAY_HEALTH_URL, { fetchImpl }),
    checkHttp(GATEWAY_READY_URL, { fetchImpl }),
    tcpCheck()
  ]);
  const backendStatus = backend.ok ? 'READY' : 'UNAVAILABLE';
  const gatewayStatus = gatewayHealth.ok && gatewayReady.ok && gatewayReady.body?.status === 'ready'
    ? 'READY' : 'UNAVAILABLE';
  const postgresStatus = postgres ? 'READY' : 'UNAVAILABLE';
  const ready = backendStatus === 'READY' && gatewayStatus === 'READY' && postgresStatus === 'READY';
  return {
    runtime: ready ? 'READY' : 'UNAVAILABLE',
    backend: backendStatus,
    semantic_gateway: gatewayStatus,
    postgres: postgresStatus
  };
}

export async function waitForRuntimeHealth({ attempts = 30, delayMs = 2000, healthFn = runtimeHealth } = {}) {
  let latest;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await healthFn();
    if (latest.runtime === 'READY') return latest;
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return latest || { runtime: 'UNAVAILABLE', backend: 'UNAVAILABLE', semantic_gateway: 'UNAVAILABLE', postgres: 'UNAVAILABLE' };
}

async function main() {
  const result = process.argv.includes('--wait') ? await waitForRuntimeHealth() : await runtimeHealth();
  console.log(JSON.stringify(result));
  process.exitCode = result.runtime === 'READY' ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('runtime-health.js')) await main();
