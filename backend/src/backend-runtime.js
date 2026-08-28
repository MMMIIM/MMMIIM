import dotenv from 'dotenv';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSemanticGatewayClientFromEnv } from './pipeline/semantic-gateway-client.js';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
export const BACKEND_ENV_PATH = resolve(sourceDirectory, '../.env');

export function loadBackendEnvironment({
  env = process.env,
  envPath = BACKEND_ENV_PATH,
  dotenvConfig = dotenv.config
} = {}) {
  if (!isAbsolute(envPath)) throw new Error('backend env path must be absolute');
  // Local development keeps the historical backend/.env precedence.  The
  // persistent Compose runtime injects container-only host/database/gateway
  // endpoints, so its process environment must remain authoritative even
  // though the same file is mounted for local configuration parity.
  const override = env.BACKEND_RUNTIME_MODE !== 'container';
  const result = dotenvConfig({ path: envPath, processEnv: env, override });
  if (result?.error) {
    throw Object.assign(new Error('backend/.env 加载失败。'), { code: 'BACKEND_ENV_LOAD_FAILED' });
  }
  return env;
}

export function createBackendRuntime({
  env = process.env,
  envPath = BACKEND_ENV_PATH,
  dotenvConfig,
  loadEnvironment = true
} = {}) {
  const runtimeEnv = loadEnvironment
    ? loadBackendEnvironment({ env, envPath, dotenvConfig })
    : env;
  return {
    env: runtimeEnv,
    envPath,
    createSemanticGatewayClient({ fetchImpl = fetch, timeoutMs, logger = console, taskType = null } = {}) {
      return createSemanticGatewayClientFromEnv({
        env: runtimeEnv,
        fetchImpl,
        timeoutMs,
        logger,
        taskType
      });
    }
  };
}
