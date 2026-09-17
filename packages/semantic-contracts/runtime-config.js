import fs from 'node:fs';

export const SEMANTIC_GATEWAY_RUNTIME_ENV_NAMES = Object.freeze([
  'SEMANTIC_GATEWAY_PROVIDER',
  'SEMANTIC_GATEWAY_API_BASE',
  'SEMANTIC_GATEWAY_API_KEY',
  'SEMANTIC_GATEWAY_PROVIDER_API_BASE',
  'SEMANTIC_GATEWAY_PROVIDER_API_KEY',
  'SEMANTIC_GATEWAY_MODEL',
  'SEMANTIC_GATEWAY_TIMEOUT_MS',
  'DEEPSEEK_OFFICIAL_API_KEY',
  'DEEPSEEK_OFFICIAL_API_BASE',
  'DEEPSEEK_OFFICIAL_FACT_MODEL'
]);

export const SEMANTIC_GATEWAY_DEFAULT_TIMEOUT_MS = 120_000;

function stringValue(value) {
  return String(value ?? '').trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseEnvLine(line) {
  const match = String(line).match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  let value = match[2].trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

/**
 * Load only explicit KEY=VALUE entries from the gateway-owned local env file.
 * Existing process values win, so deployment/runtime injection remains the
 * canonical override. No values are logged by this helper.
 */
export function loadSemanticGatewayEnvironment({ env = process.env, envFile = null, fsImpl = fs } = {}) {
  const runtimeEnv = { ...env };
  if (!envFile || !fsImpl.existsSync(envFile)) return runtimeEnv;
  for (const line of fsImpl.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (runtimeEnv[key] == null || runtimeEnv[key] === '') runtimeEnv[key] = value;
  }
  return runtimeEnv;
}

export function readSemanticGatewayRuntimeConfig(env = {}) {
  return Object.freeze({
    provider: stringValue(env.SEMANTIC_GATEWAY_PROVIDER || 'mock'),
    gatewayApiBase: stringValue(env.SEMANTIC_GATEWAY_API_BASE),
    serviceApiKey: stringValue(env.SEMANTIC_GATEWAY_API_KEY),
    providerApiBase: stringValue(env.SEMANTIC_GATEWAY_PROVIDER_API_BASE),
    providerApiKey: stringValue(env.SEMANTIC_GATEWAY_PROVIDER_API_KEY),
    model: stringValue(env.SEMANTIC_GATEWAY_MODEL || 'mock-semantic-v1'),
    deepseekOfficialApiBase: stringValue(env.DEEPSEEK_OFFICIAL_API_BASE),
    deepseekOfficialApiKey: stringValue(env.DEEPSEEK_OFFICIAL_API_KEY),
    deepseekOfficialFactModel: stringValue(env.DEEPSEEK_OFFICIAL_FACT_MODEL),
    timeoutMs: positiveInteger(env.SEMANTIC_GATEWAY_TIMEOUT_MS, SEMANTIC_GATEWAY_DEFAULT_TIMEOUT_MS)
  });
}

export function validateSemanticGatewayRuntimeConfig(env = {}, { requireProvider = true } = {}) {
  const config = readSemanticGatewayRuntimeConfig(env);
  const errors = [];
  if (!config.serviceApiKey) errors.push('MISSING_SERVICE_KEY');
  if (!['mock', 'openai_compatible'].includes(config.provider)) errors.push('UNSUPPORTED_PROVIDER');
  if (requireProvider && config.provider === 'openai_compatible') {
    if (!config.providerApiBase) errors.push('MISSING_PROVIDER_BASE');
    if (!config.providerApiKey) errors.push('MISSING_PROVIDER_KEY');
    if (!config.model) errors.push('MISSING_MODEL');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), config });
}

/**
 * Validate the explicit configuration required by a live canonical probe.
 * Developer/test mock configuration intentionally remains supported by
 * validateSemanticGatewayRuntimeConfig; this guard is the fail-fast boundary
 * for evidence_support_assessment live execution.
 */
export function validateSemanticGatewayLiveConfig(env = {}) {
  const config = readSemanticGatewayRuntimeConfig(env);
  const errors = [];
  const provider = stringValue(env.SEMANTIC_GATEWAY_PROVIDER);
  const model = stringValue(env.SEMANTIC_GATEWAY_MODEL);

  if (!provider) errors.push('MISSING_PROVIDER');
  else if (provider === 'mock') errors.push('LIVE_PROVIDER_MOCK_FORBIDDEN');
  else if (provider !== 'openai_compatible') errors.push('UNSUPPORTED_PROVIDER');

  if (!config.gatewayApiBase) errors.push('MISSING_GATEWAY_BASE');
  if (!config.serviceApiKey) errors.push('MISSING_SERVICE_KEY');
  if (!config.providerApiBase) errors.push('MISSING_PROVIDER_BASE');
  if (!config.providerApiKey) errors.push('MISSING_PROVIDER_KEY');
  if (!model) errors.push('MISSING_MODEL');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), config });
}

export function safeSemanticGatewayRuntimeSummary(configOrEnv = {}) {
  const config = configOrEnv.provider && Object.hasOwn(configOrEnv, 'serviceApiKey')
    ? configOrEnv
    : readSemanticGatewayRuntimeConfig(configOrEnv);
  let providerHost = null;
  let providerPort = null;
  try {
    const target = new URL(config.providerApiBase);
    providerHost = target.hostname;
    providerPort = target.port || (target.protocol === 'https:' ? '443' : target.protocol === 'http:' ? '80' : null);
  } catch (_error) {
    providerHost = config.providerApiBase ? 'invalid' : null;
  }
  return {
    provider: config.provider,
    gateway_base_url: config.gatewayApiBase || null,
    provider_base_url: config.providerApiBase || null,
    provider_host: providerHost,
    provider_port: providerPort,
    model: config.model || null,
    service_key_present: Boolean(config.serviceApiKey),
    provider_key_present: Boolean(config.providerApiKey),
    deepseek_official_api_base: config.deepseekOfficialApiBase || null,
    deepseek_official_fact_model: config.deepseekOfficialFactModel || null,
    deepseek_official_key_present: Boolean(config.deepseekOfficialApiKey),
    timeout_ms: config.timeoutMs
  };
}
