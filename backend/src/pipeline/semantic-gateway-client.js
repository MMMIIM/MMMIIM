import { getSemanticGatewayTask } from './semantic-gateway-task-registry.js';
import { SEMANTIC_GATEWAY_ERROR_CODES } from '../../../packages/semantic-contracts/index.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const VALID_GATEWAY_STATUSES = new Set(['success', 'failed']);
const CONTROLLED_GATEWAY_ERROR_CODES = new Set(SEMANTIC_GATEWAY_ERROR_CODES);
const PROBE_DIAGNOSTIC_MODE = 'probe-v1';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function positiveTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseSemanticGatewayConfig(env = {}, { taskType = null } = {}) {
  const canonicalTask = taskType === 'evidence_support_assessment' || taskType === 'requirement_extraction';
  const canonicalEvidenceSupport = taskType === 'evidence_support_assessment';
  const canonicalRequirementExtraction = taskType === 'requirement_extraction';
  const canonicalRuntime = readSemanticGatewayRuntimeConfig(env);
  const timeoutMs = positiveTimeout(
    canonicalEvidenceSupport
      ? (env.SEMANTIC_GATEWAY_EVIDENCE_SUPPORT_TIMEOUT_MS || env.SEMANTIC_GATEWAY_TIMEOUT_MS)
      : canonicalRequirementExtraction
        ? (env.SEMANTIC_GATEWAY_REQUIREMENT_EXTRACTION_TIMEOUT_MS || env.SEMANTIC_GATEWAY_TIMEOUT_MS)
      : env.V43_GATEWAY_TIMEOUT_MS,
    canonicalEvidenceSupport ? 120_000 : canonicalRequirementExtraction ? 300_000 : 30_000
  );
  return Object.freeze({
    apiBase: normalizeBaseUrl(canonicalTask ? canonicalRuntime.gatewayApiBase : env.V43_GATEWAY_API_BASE),
    apiKey: String(canonicalTask ? canonicalRuntime.serviceApiKey : env.V43_GATEWAY_API_KEY || '').trim(),
    user: String(canonicalTask ? (env.SEMANTIC_GATEWAY_USER || env.V43_GATEWAY_USER) : env.V43_GATEWAY_USER || '').trim(),
    timeoutMs,
    configuredTaskType: canonicalTask ? taskType : null,
    config_source: canonicalTask ? 'canonical_semantic_gateway' : 'legacy_v43_gateway',
    taskTimeouts: Object.freeze({
      healthcheck: positiveTimeout(
        canonicalTask ? env.SEMANTIC_GATEWAY_HEALTHCHECK_TIMEOUT_MS : env.V43_GATEWAY_HEALTHCHECK_TIMEOUT_MS,
        15_000
      ),
      requirement_extraction: positiveTimeout(
        canonicalTask
          ? env.SEMANTIC_GATEWAY_REQUIREMENT_EXTRACTION_TIMEOUT_MS
          : env.V43_GATEWAY_REQUIREMENT_EXTRACTION_TIMEOUT_MS,
        300_000
      )
    })
  });
}

function safeGatewayTarget(apiBase) {
  try {
    const target = new URL(apiBase);
    return {
      gateway_host: target.hostname,
      gateway_port: target.port || (target.protocol === 'https:' ? '443' : '80')
    };
  } catch (_error) {
    return { gateway_host: 'invalid', gateway_port: 'unknown' };
  }
}

function auditFor(taskType, extras = {}) {
  return { provider: 'semantic_gateway', task_type: taskType, ...extras };
}

function safeContentType(response) {
  const contentType = String(response?.headers?.get?.('content-type') || '').toLowerCase();
  return contentType.startsWith('application/json') || contentType.startsWith('application/problem+json');
}

function safeDiagnosticScalar(value, maxLength = 240) {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function safeValidationDiagnostics(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map(item => ({
    path: safeDiagnosticScalar(item?.path, 200),
    validator_code: safeDiagnosticScalar(item?.validator_code, 80),
    expected: safeDiagnosticScalar(item?.expected, 240),
    observed_category: safeDiagnosticScalar(item?.observed_category, 80),
    message: safeDiagnosticScalar(item?.message, 240)
  }));
}

function safeStructuralSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { available: false };
  }
  const candidateSummaries = Array.isArray(value.candidate_summaries)
    ? value.candidate_summaries.slice(0, 200).map(candidate => ({
      candidate_index: Number.isInteger(candidate?.candidate_index) ? candidate.candidate_index : null,
      keys: Array.isArray(candidate?.keys) ? candidate.keys.filter(key => typeof key === 'string').slice(0, 40).map(key => key.slice(0, 80)) : [],
      missing_keys: Array.isArray(candidate?.missing_keys) ? candidate.missing_keys.filter(key => typeof key === 'string').slice(0, 20).map(key => key.slice(0, 80)) : [],
      extra_keys: Array.isArray(candidate?.extra_keys) ? candidate.extra_keys.filter(key => typeof key === 'string').slice(0, 20).map(key => key.slice(0, 80)) : [],
      text_type: safeDiagnosticScalar(candidate?.text_type, 40),
      text_empty: typeof candidate?.text_empty === 'boolean' ? candidate.text_empty : null,
      category_type: safeDiagnosticScalar(candidate?.category_type, 40),
      category_value: safeDiagnosticScalar(candidate?.category_value, 80),
      source_range_type: safeDiagnosticScalar(candidate?.source_range_type, 40),
      source_range_keys: Array.isArray(candidate?.source_range_keys)
        ? candidate.source_range_keys.filter(key => typeof key === 'string').slice(0, 10).map(key => key.slice(0, 80)) : [],
      source_range_start_ref_type: safeDiagnosticScalar(candidate?.source_range_start_ref_type, 40),
      source_range_end_ref_type: safeDiagnosticScalar(candidate?.source_range_end_ref_type, 40),
      mandatory_observed_type: safeDiagnosticScalar(candidate?.mandatory_observed_type, 40),
      requires_confirmation_type: safeDiagnosticScalar(candidate?.requires_confirmation_type, 40)
    }))
    : [];
  return {
    available: value.available === true,
    top_level_type: safeDiagnosticScalar(value.top_level_type, 40),
    top_level_keys: Array.isArray(value.top_level_keys)
      ? value.top_level_keys.filter(key => typeof key === 'string').slice(0, 40).map(key => key.slice(0, 80))
      : [],
    requirements_present: typeof value.requirements_present === 'boolean' ? value.requirements_present : null,
    requirements_type: safeDiagnosticScalar(value.requirements_type, 40),
    requirements_count: Number.isInteger(value.requirements_count) ? value.requirements_count : null,
    candidate_summaries: candidateSummaries,
    candidate_summaries_truncated: value.candidate_summaries_truncated === true
  };
}

function safeProbeDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const safe = {
    json_parse_success: typeof value.json_parse_success === 'boolean' ? value.json_parse_success : null,
    markdown_fence_present: typeof value.markdown_fence_present === 'boolean' ? value.markdown_fence_present : null,
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    provider_http_reached: value.provider_http_reached === true,
    current_stage: safeDiagnosticScalar(value.current_stage, 80),
    failure_stage: safeDiagnosticScalar(value.failure_stage, 80),
    error_name: safeDiagnosticScalar(value.error_name, 80),
    safe_error_code: safeDiagnosticScalar(value.safe_error_code, 80),
    safe_error_message: safeDiagnosticScalar(value.safe_error_message, 240),
    cause_name: safeDiagnosticScalar(value.cause_name, 80),
    cause_code: safeDiagnosticScalar(value.cause_code, 80),
    cause_message: safeDiagnosticScalar(value.cause_message, 240),
    finish_reason: safeDiagnosticScalar(value.finish_reason, 40),
    prompt_tokens: Number.isInteger(value.prompt_tokens) ? value.prompt_tokens : null,
    completion_tokens: Number.isInteger(value.completion_tokens) ? value.completion_tokens : null,
    total_tokens: Number.isInteger(value.total_tokens) ? value.total_tokens : null,
    response_model: safeDiagnosticScalar(value.response_model, 120),
    response_id: safeDiagnosticScalar(value.response_id, 128),
    provider_trace_id: safeDiagnosticScalar(value.provider_trace_id, 128),
    model_content_length_chars: Number.isInteger(value.model_content_length_chars) ? value.model_content_length_chars : null,
    output_truncated: value.output_truncated === true,
    response_format_type: value.response_format_type === 'json_schema' || value.response_format_type === 'json_object'
      ? value.response_format_type : null,
    generation_config: value.generation_config && typeof value.generation_config === 'object'
      ? {
        response_format: value.generation_config.response_format?.type === 'json_schema'
          ? {
            type: 'json_schema',
            name: safeDiagnosticScalar(value.generation_config.response_format.name, 120),
            strict: value.generation_config.response_format.strict === true
          }
          : value.generation_config.response_format?.type === 'json_object'
            ? { type: 'json_object' } : null,
        enable_thinking: value.generation_config.enable_thinking === true,
        max_tokens: Number.isInteger(value.generation_config.max_tokens) ? value.generation_config.max_tokens : null,
        temperature: Number.isFinite(value.generation_config.temperature) ? value.generation_config.temperature : null,
        top_p: Number.isFinite(value.generation_config.top_p) ? value.generation_config.top_p : null,
        top_k: Number.isInteger(value.generation_config.top_k) ? value.generation_config.top_k : null,
        frequency_penalty: Number.isFinite(value.generation_config.frequency_penalty) ? value.generation_config.frequency_penalty : null,
        stream: value.generation_config.stream === true,
        n: Number.isInteger(value.generation_config.n) ? value.generation_config.n : null
      } : null,
    json_parse_error_offset: Number.isInteger(value.json_parse_error_offset) ? value.json_parse_error_offset : null,
    schema_validation_errors: safeValidationDiagnostics(value.schema_validation_errors),
    envelope_validation_errors: safeValidationDiagnostics(value.envelope_validation_errors),
    legacy_schema_detected: value.legacy_schema_detected === true,
    structural_summary: safeStructuralSummary(value.structural_summary)
  };
  return safe;
}

async function parseStructuredGatewayError(response, { diagnosticMode = null } = {}) {
  if (!safeContentType(response)) return null;
  let body;
  try {
    body = await response.json();
  } catch (_error) {
    return null;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !CONTROLLED_GATEWAY_ERROR_CODES.has(body.error_code)) return null;
  const audit = { http_status: response.status, gateway_error_code: body.error_code };
  if (typeof body.request_id === 'string' && body.request_id.length > 0 && body.request_id.length <= 128) {
    audit.request_id = body.request_id;
  }
  if (diagnosticMode === PROBE_DIAGNOSTIC_MODE) {
    const diagnostics = safeProbeDiagnostics(body.probe_diagnostics);
    if (diagnostics) audit.probe_diagnostics = diagnostics;
  }
  return { code: body.error_code, audit };
}

export class SemanticGatewayError extends Error {
  constructor(code, message, audit = {}, status = 502) {
    super(message);
    this.name = 'SemanticGatewayError';
    this.code = code;
    this.status = status;
    this.audit = { ...audit, error_code: code };
  }
}

export function normalizeGatewayTransport(raw, { mode = 'legacy_deterministic' } = {}) {
  if (typeof raw !== 'string') {
    throw new SemanticGatewayError(
      'GATEWAY_ENVELOPE_INVALID',
      'response_payload_json 必须是字符串。'
    );
  }
  let normalized = raw.replace(/^\uFEFF/, '').trim();
  if (mode !== 'strict' && normalized.startsWith('<think>')) {
    const closingIndex = normalized.indexOf('</think>', '<think>'.length);
    if (closingIndex !== -1) {
      normalized = normalized.slice(closingIndex + '</think>'.length).trim();
    }
  }
  if (mode !== 'strict') {
    const fence = normalized.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*)\r?\n```$/i);
    if (fence) normalized = fence[1].trim();
  }
  return normalized;
}

function jsonStructureIsTruncated(value) {
  const stack = [];
  let inString = false;
  let escaped = false;
  for (const character of value) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') stack.push(character);
    else if (character === '}' || character === ']') stack.pop();
  }
  return inString || stack.length > 0 || /:\s*$|,\s*$/.test(value);
}

export function classifyGatewayPayload(raw, normalized = raw) {
  const source = typeof raw === 'string' ? raw.replace(/^\uFEFF/, '').trim() : '';
  if (source.startsWith('<think>')) return 'think_wrapper';
  if (/^```(?:json)?(?:\s|$)/i.test(source)) return 'markdown_fence';
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalized)) return 'invalid_control_character';
  if (jsonStructureIsTruncated(normalized)) return 'truncated_json';
  return 'extra_commentary';
}

function validateGatewayEnvelope(value, requestedTaskType, taskSpec = getSemanticGatewayTask(requestedTaskType)) {
  // Keep provider/model output out of ordinary error audits. The raw payload is
  // retained only on successful return values, where the existing pipeline can
  // apply its normal audit sanitizer before persistence.
  const audit = auditFor(requestedTaskType);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SemanticGatewayError('GATEWAY_ENVELOPE_INVALID', '网关 envelope 必须是对象。', audit);
  }
  const expectedSchemaVersion = taskSpec?.schema_version;
  if (!expectedSchemaVersion) {
    throw new SemanticGatewayError(
      'TASK_UNSUPPORTED',
      'Semantic Gateway task_type 未注册。',
      audit,
      422
    );
  }
  if (value.schema_version !== expectedSchemaVersion) {
    throw new SemanticGatewayError('GATEWAY_ENVELOPE_INVALID', '网关 schema_version 无效。', audit);
  }
  if (value.task_type !== requestedTaskType) {
    throw new SemanticGatewayError('GATEWAY_TASK_TYPE_MISMATCH', '网关 task_type 与请求不一致。', {
      ...audit,
      received_task_type: typeof value.task_type === 'string' ? value.task_type : null
    });
  }
  if (!VALID_GATEWAY_STATUSES.has(value.status)) {
    throw new SemanticGatewayError('GATEWAY_ENVELOPE_INVALID', '网关 status 无效。', audit);
  }
  if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw new SemanticGatewayError('GATEWAY_ENVELOPE_INVALID', '网关 data 必须是对象。', audit);
  }
  if (!Array.isArray(value.warnings)) {
    throw new SemanticGatewayError('GATEWAY_ENVELOPE_INVALID', '网关 warnings 必须是数组。', audit);
  }
  return value;
}

export class SemanticGatewayClient {
  constructor({
    apiBase,
    apiKey,
    user,
    fetchImpl = fetch,
    timeoutMs = 30000,
    taskTimeouts = {},
    logger = null,
    configuredTaskType = null,
    configSource = null
  }) {
    this.apiBase = normalizeBaseUrl(apiBase);
    this.apiKey = String(apiKey || '').trim();
    this.user = String(user || '').trim();
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.taskTimeouts = { ...taskTimeouts };
    this.configuredTaskType = configuredTaskType;
    this.configSource = configSource;
    this.logger = logger;
    this.gatewayTarget = safeGatewayTarget(this.apiBase);
  }

  diagnose(errorCode) {
    this.logger?.warn?.('Semantic Gateway transport diagnostic', {
      provider: 'semantic_gateway',
      ...this.gatewayTarget,
      error_classification: errorCode
    });
  }

  async run({ task_type: taskType, task_instruction: taskInstruction, task_payload_json: taskPayloadJson } = {}, { diagnosticMode = null } = {}) {
    if (this.configuredTaskType && taskType !== this.configuredTaskType) {
      throw new SemanticGatewayError(
        'TASK_UNSUPPORTED',
        '该 Semantic Gateway Client 仅允许访问其绑定的 canonical task_type。',
        auditFor(taskType, { configured_task_type: this.configuredTaskType, config_source: this.configSource }),
        422
      );
    }
    if (!this.apiBase || !this.apiKey || !this.user) {
      throw new SemanticGatewayError(
        'GATEWAY_NOT_CONFIGURED',
        'Semantic Gateway 环境变量未完整配置。',
        auditFor(taskType),
        500
      );
    }
    if (typeof taskType !== 'string' || !taskType.trim()
      || typeof taskInstruction !== 'string' || !taskInstruction.trim()
      || typeof taskPayloadJson !== 'string') {
      throw new SemanticGatewayError(
        'GATEWAY_REQUEST_INVALID',
        'Semantic Gateway 请求字段无效。',
        auditFor(taskType),
        400
      );
    }
    const taskSpec = getSemanticGatewayTask(taskType);
    if (!taskSpec) {
      throw new SemanticGatewayError(
        'TASK_UNSUPPORTED',
        'Semantic Gateway task_type 未注册。',
        auditFor(taskType),
        422
      );
    }

    const controller = new AbortController();
    const requestTimeoutMs = this.taskTimeouts[taskType] || this.timeoutMs;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);

    let response;
    try {
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      if (diagnosticMode === PROBE_DIAGNOSTIC_MODE) headers['x-semantic-gateway-diagnostic'] = PROBE_DIAGNOSTIC_MODE;
      response = await this.fetchImpl(`${this.apiBase}/workflows/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: {
            task_type: taskType,
            task_instruction: taskInstruction,
            task_payload_json: taskPayloadJson
          },
          response_mode: 'blocking',
          user: this.user
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (timedOut || error?.name === 'AbortError') {
        this.diagnose('GATEWAY_TIMEOUT');
        throw new SemanticGatewayError(
          'GATEWAY_TIMEOUT',
          'Semantic Gateway 请求超时。',
          auditFor(taskType, { timeout_ms: requestTimeoutMs }),
          504
        );
      }
      this.diagnose('GATEWAY_NETWORK_ERROR');
      throw new SemanticGatewayError('GATEWAY_NETWORK_ERROR', 'Semantic Gateway 网络请求失败。', auditFor(taskType));
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const structuredError = await parseStructuredGatewayError(response, { diagnosticMode });
      this.diagnose(structuredError?.code || 'GATEWAY_HTTP_ERROR');
      if (structuredError) {
        throw new SemanticGatewayError(
          structuredError.code,
          `Semantic Gateway request failed: ${structuredError.code}.`,
          auditFor(taskType, structuredError.audit),
          response.status >= 500 ? 502 : 400
        );
      }
      throw new SemanticGatewayError(
        'GATEWAY_HTTP_ERROR',
        'Semantic Gateway 返回非成功 HTTP 状态。',
        auditFor(taskType, { http_status: response.status }),
        response.status >= 500 ? 502 : 400
      );
    }

    let outerPayload;
    try {
      outerPayload = await response.json();
    } catch (_error) {
      throw new SemanticGatewayError(
        'GATEWAY_ENVELOPE_INVALID',
        'Semantic Gateway 外层响应不是合法 JSON。',
        auditFor(taskType)
      );
    }

    const outputs = outerPayload?.data?.outputs;
    const hasAllowedField = outputs
      && typeof outputs === 'object'
      && Object.prototype.hasOwnProperty.call(outputs, 'response_payload_json');
    if (!hasAllowedField) {
      throw new SemanticGatewayError(
        'GATEWAY_RESPONSE_PAYLOAD_MISSING',
        'Semantic Gateway 缺少 response_payload_json。',
        auditFor(taskType)
      );
    }

    const rawResponsePayloadJson = outputs.response_payload_json;
    const audit = auditFor(taskType, { raw_response_payload_json: rawResponsePayloadJson });
    if (diagnosticMode === PROBE_DIAGNOSTIC_MODE) {
      const diagnostics = safeProbeDiagnostics(outerPayload.probe_diagnostics);
      if (diagnostics) audit.probe_diagnostics = diagnostics;
    }
    const errorAudit = auditFor(taskType);
    let normalized;
    try {
      normalized = normalizeGatewayTransport(rawResponsePayloadJson, {
        mode: taskSpec.transport_normalization
      });
    } catch (error) {
      if (error instanceof SemanticGatewayError) {
        error.audit = { ...errorAudit, error_code: error.code };
        throw error;
      }
      throw error;
    }

    let envelope;
    try {
      envelope = JSON.parse(normalized);
    } catch (_error) {
      const responseClassification = classifyGatewayPayload(rawResponsePayloadJson, normalized);
      throw new SemanticGatewayError(
        responseClassification === 'truncated_json' ? 'GATEWAY_TRUNCATED_JSON' : 'GATEWAY_INVALID_JSON',
        responseClassification === 'truncated_json'
          ? 'response_payload_json 在完整 JSON 结束前被截断。'
          : 'response_payload_json 不是可整体解析的 JSON。',
        { ...errorAudit, response_classification: responseClassification }
      );
    }
    try {
      validateGatewayEnvelope(envelope, taskType, taskSpec);
    } catch (error) {
      if (error instanceof SemanticGatewayError) {
        error.audit = { ...error.audit, response_classification: 'wrong_schema' };
      }
      throw error;
    }
    return { envelope, audit };
  }
}

export function createSemanticGatewayClientFromEnv({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs,
  logger,
  taskType = null
} = {}) {
  const config = parseSemanticGatewayConfig(env, { taskType });
  return new SemanticGatewayClient({
    ...config,
    fetchImpl,
    timeoutMs: timeoutMs ?? config.timeoutMs,
    configuredTaskType: config.configuredTaskType,
    configSource: config.config_source,
    logger
  });
}

export function createSemanticGatewayWriter(client) {
  return {
    async write(context) {
      const gatewayResponse = await client.run({
        task_type: 'draft_sections',
        task_instruction: '仅根据后端提供的 canonical requirements 与章节计划生成章节草稿。',
        task_payload_json: JSON.stringify(context)
      });
      if (gatewayResponse.envelope.status !== 'success' || !Array.isArray(gatewayResponse.envelope.data.sections)) {
        throw new SemanticGatewayError(
          'GATEWAY_ENVELOPE_INVALID',
          'draft_sections 网关响应缺少 data.sections。',
          gatewayResponse.audit
        );
      }
      return {
        sections: gatewayResponse.envelope.data.sections,
        provider_audit: gatewayResponse.audit
      };
    }
  };
}

export function createGenerationProvider({
  provider,
  mockWriter,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const selectedProvider = provider || env.GENERATION_PROVIDER || 'mock';
  if (selectedProvider === 'mock') {
    if (!mockWriter?.write) throw new Error('mock provider requires mockWriter');
    return mockWriter;
  }
  if (selectedProvider === 'semantic_gateway') {
    return createSemanticGatewayWriter(createSemanticGatewayClientFromEnv({ env, fetchImpl, timeoutMs }));
  }
  throw Object.assign(new Error(`不支持的 GENERATION_PROVIDER：${selectedProvider}`), { code: 'GENERATION_PROVIDER_INVALID' });
}
