import { createHash } from 'node:crypto';

const PUBLIC_PROVIDER_ERROR_CODES = new Set([
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'PROVIDER_HTTP_FAILURE',
  'PROVIDER_OUTPUT_INVALID'
]);

const PROVIDER_STAGES = Object.freeze({
  CONFIG_RESOLVED: 'CONFIG_RESOLVED',
  REQUEST_URL_BUILT: 'REQUEST_URL_BUILT',
  REQUEST_BODY_BUILT: 'REQUEST_BODY_BUILT',
  REQUEST_BODY_SERIALIZED: 'REQUEST_BODY_SERIALIZED',
  FETCH_INVOKED: 'FETCH_INVOKED',
  HTTP_RESPONSE_RECEIVED: 'HTTP_RESPONSE_RECEIVED',
  RESPONSE_BODY_READ: 'RESPONSE_BODY_READ',
  MODEL_CONTENT_EXTRACTED: 'MODEL_CONTENT_EXTRACTED'
});

// Keep the transport generation controls explicit.  The canonical semantic
// contract remains the source of truth for the response shape; these values
// only bound and stabilize the provider request.
export const DEFAULT_GENERATION_CONFIG = Object.freeze({
  response_format: Object.freeze({ type: 'json_object' }),
  enable_thinking: false,
  max_tokens: 3200,
  temperature: 0.1,
  top_p: 0.9,
  top_k: 20,
  frequency_penalty: 0,
  stream: false,
  n: 1
});

const LEGACY_SCHEMA_DIAGNOSTIC_TOKENS = Object.freeze([
  'confidence',
  'evidence_type',
  'notes',
  'evidence_bearing',
  'reason_code',
  'support__observations'
]);

function boundedString(value, max = 160) {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;
}

function boundedInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function safeFinishReason(value) {
  return typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value) ? value : null;
}

function tokenOccurrences(text) {
  const source = typeof text === 'string' ? text : '';
  return LEGACY_SCHEMA_DIAGNOSTIC_TOKENS.filter(token => {
    const pattern = new RegExp(`(?:^|[^a-z0-9_])${token.replace('_', '[ _]')}(?:$|[^a-z0-9_])`, 'i');
    return pattern.test(source);
  });
}

function hashText(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function outboundPromptDiagnostics(instruction, payload) {
  const instructionText = typeof instruction === 'string' ? instruction : '';
  let payloadText;
  try {
    payloadText = JSON.stringify(payload);
  } catch (_error) {
    payloadText = '[UNSERIALIZABLE_PAYLOAD]';
  }
  const observedTokens = tokenOccurrences(instructionText);
  const positiveSchemaTokens = observedTokens.filter(token => !new RegExp(
    `(?:不得|禁止|不要|旧版|cannot|must\\s+not|do\\s+not|legacy)[^。；\\n]{0,80}${token.replace('_', '[ _]')}`,
    'i'
  ).test(instructionText));
  // These are metadata only.  The actual instruction and source text are
  // deliberately never placed in the provider audit.
  return {
    instruction_sha256: hashText(instructionText),
    instruction_char_count: instructionText.length,
    payload_sha256: hashText(payloadText),
    payload_char_count: payloadText.length,
    legacy_schema_tokens_observed: observedTokens,
    // The frozen contract intentionally mentions its compatibility
    // `support_level` field.  It is not classified as a legacy token here.
    legacy_schema_tokens_in_instruction: observedTokens,
    legacy_schema_positive_schema_context: positiveSchemaTokens.length > 0,
    contamination: positiveSchemaTokens.length > 0
  };
}

function parseErrorOffset(error) {
  const match = String(error?.message || '').match(/(?:position|at position)\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function safeCode(value) {
  const candidate = String(value || '').trim();
  return /^[A-Z0-9_:-]{1,80}$/.test(candidate) ? candidate : null;
}

function safeMessage(value) {
  return String(value || '')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization|api[_-]?key|token)\s*[:=]\s*[^\s,;}]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s"']+/gi, '[URL_REDACTED]')
    .slice(0, 240);
}

function safeCause(error) {
  const cause = error?.cause || error;
  return {
    cause_name: safeCode(cause?.name) || (cause?.name ? String(cause.name).slice(0, 80) : null),
    cause_code: safeCode(cause?.code),
    cause_message: cause?.message ? safeMessage(cause.message) : null
  };
}

function normalizedResponseFormat(value, { allowDefault = true } = {}) {
  if (value && typeof value === 'object' && value.type === 'json_schema'
    && value.json_schema && typeof value.json_schema === 'object'
    && typeof value.json_schema.name === 'string'
    && value.json_schema.schema && typeof value.json_schema.schema === 'object') {
    return {
      type: 'json_schema',
      json_schema: {
        name: value.json_schema.name.slice(0, 80),
        strict: value.json_schema.strict !== false,
        schema: structuredClone(value.json_schema.schema)
      }
    };
  }
  if (value && typeof value === 'object' && value.type === 'json_object') {
    return { type: 'json_object' };
  }
  if (allowDefault) return { type: 'json_object' };
  throw Object.assign(new Error('Invalid explicit provider response format'), { code: 'PROVIDER_OUTPUT_INVALID' });
}

function createAudit(model, started, generationConfig, promptDiagnostics) {
  return {
    provider: 'openai_compatible',
    model,
    http_status: null,
    latency_ms: null,
    provider_adapter_invoked: true,
    fetch_invoked: false,
    provider_http_reached: false,
    current_stage: null,
    failure_stage: null,
    error_name: null,
    safe_error_code: null,
    safe_error_message: null,
    cause_name: null,
    cause_code: null,
    cause_message: null,
    finish_reason: null,
    prompt_tokens: null,
    completion_tokens: null,
    total_tokens: null,
    response_model: null,
    response_id: null,
    provider_trace_id: null,
    model_content_length_chars: null,
    output_truncated: false,
    response_format_type: generationConfig.response_format?.type === 'json_schema'
      ? 'json_schema' : 'json_object',
    json_parse_error_offset: null,
    legacy_schema_tokens_observed: [],
    generation_config: generationConfig,
    outbound_prompt_diagnostics: promptDiagnostics,
    started_at_ms: started
  };
}

function finalizeAudit(audit, started) {
  const finalized = { ...audit, latency_ms: Math.max(0, Date.now() - started) };
  delete finalized.started_at_ms;
  return finalized;
}

function attachAudit(error, audit, started, {
  safeErrorCode = null,
  safeErrorMessage = null,
  failureStage = audit.failure_stage || audit.current_stage,
  cause = error
} = {}) {
  const details = safeCause(cause);
  error.provider_audit = finalizeAudit({
    ...audit,
    failure_stage: failureStage || null,
    error_name: error?.name ? String(error.name).slice(0, 80) : null,
    safe_error_code: safeCode(safeErrorCode),
    safe_error_message: safeErrorMessage ? safeMessage(safeErrorMessage) : null,
    ...details
  }, started);
  return error;
}

export class OpenAICompatibleProvider {
  constructor({
    baseUrl,
    apiKey,
    model,
    timeoutMs = 120000,
    fetchImpl = fetch,
    logger = console,
    generationConfig = {}
  } = {}) {
    this.baseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
    this.apiKey = String(apiKey || '').trim();
    this.model = String(model || '').trim();
    this.timeoutMs = Number.isInteger(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 120000;
    this.fetchImpl = fetchImpl;
    this.logger = logger;
    this.generationConfig = Object.freeze({
      response_format: normalizedResponseFormat(generationConfig.response_format),
      enable_thinking: generationConfig.enable_thinking === true,
      max_tokens: Number.isInteger(Number(generationConfig.max_tokens)) && Number(generationConfig.max_tokens) > 0
        ? Number(generationConfig.max_tokens) : DEFAULT_GENERATION_CONFIG.max_tokens,
      temperature: Number.isFinite(Number(generationConfig.temperature))
        ? Number(generationConfig.temperature) : DEFAULT_GENERATION_CONFIG.temperature,
      top_p: Number.isFinite(Number(generationConfig.top_p))
        ? Number(generationConfig.top_p) : DEFAULT_GENERATION_CONFIG.top_p,
      top_k: Number.isInteger(Number(generationConfig.top_k)) && Number(generationConfig.top_k) > 0
        ? Number(generationConfig.top_k) : DEFAULT_GENERATION_CONFIG.top_k,
      frequency_penalty: Number.isFinite(Number(generationConfig.frequency_penalty))
        ? Number(generationConfig.frequency_penalty) : DEFAULT_GENERATION_CONFIG.frequency_penalty,
      stream: generationConfig.stream === true,
      n: Number.isInteger(Number(generationConfig.n)) && Number(generationConfig.n) > 0
        ? Number(generationConfig.n) : DEFAULT_GENERATION_CONFIG.n
    });
  }

  get configured() {
    return Boolean(this.baseUrl && this.apiKey && this.model);
  }

  async invoke({ instruction, payload, response_format: requestedResponseFormat }) {
    const started = Date.now();
    let responseFormat;
    try {
      responseFormat = requestedResponseFormat === undefined
        ? this.generationConfig.response_format
        : normalizedResponseFormat(requestedResponseFormat, { allowDefault: false });
    } catch (error) {
      const audit = createAudit(this.model, started, this.generationConfig, outboundPromptDiagnostics(instruction, payload));
      audit.current_stage = PROVIDER_STAGES.CONFIG_RESOLVED;
      throw attachAudit(error, audit, started, {
        safeErrorCode: 'INVALID_RESPONSE_FORMAT',
        safeErrorMessage: 'Explicit provider response format is invalid.',
        failureStage: PROVIDER_STAGES.CONFIG_RESOLVED
      });
    }
    const generationConfig = Object.freeze({ ...this.generationConfig, response_format: responseFormat });
    const audit = createAudit(this.model, started, generationConfig, outboundPromptDiagnostics(instruction, payload));
    if (!this.configured) {
      audit.current_stage = PROVIDER_STAGES.CONFIG_RESOLVED;
      throw attachAudit(
        Object.assign(new Error('Provider is not configured'), { code: 'PROVIDER_UNAVAILABLE' }),
        audit,
        started,
        { safeErrorCode: 'CONFIG_MISSING', safeErrorMessage: 'Provider configuration is incomplete.' }
      );
    }
    audit.current_stage = PROVIDER_STAGES.CONFIG_RESOLVED;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let requestUrl;
      try {
        requestUrl = `${this.baseUrl}/chat/completions`;
        new URL(requestUrl);
        audit.current_stage = PROVIDER_STAGES.REQUEST_URL_BUILT;
      } catch (error) {
        audit.current_stage = PROVIDER_STAGES.REQUEST_URL_BUILT;
        throw attachAudit(
          Object.assign(new Error('Provider request URL could not be built'), { code: 'PROVIDER_UNAVAILABLE' }),
          audit,
          started,
          { safeErrorCode: 'REQUEST_BUILD_FAILED', safeErrorMessage: 'Provider request URL construction failed.', cause: error }
        );
      }

      let requestBody;
      try {
        requestBody = {
          model: this.model,
          messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: JSON.stringify(payload) }
          ],
          response_format: generationConfig.response_format,
          enable_thinking: generationConfig.enable_thinking,
          max_tokens: generationConfig.max_tokens,
          temperature: generationConfig.temperature,
          top_p: generationConfig.top_p,
          top_k: generationConfig.top_k,
          frequency_penalty: generationConfig.frequency_penalty,
          stream: generationConfig.stream,
          n: generationConfig.n
        };
        audit.current_stage = PROVIDER_STAGES.REQUEST_BODY_BUILT;
      } catch (error) {
        audit.current_stage = PROVIDER_STAGES.REQUEST_BODY_BUILT;
        throw attachAudit(
          Object.assign(new Error('Provider request body could not be built'), { code: 'PROVIDER_UNAVAILABLE' }),
          audit,
          started,
          { safeErrorCode: 'REQUEST_BUILD_FAILED', safeErrorMessage: 'Provider request body construction failed.', cause: error }
        );
      }

      let serializedBody;
      try {
        serializedBody = JSON.stringify(requestBody);
        audit.current_stage = PROVIDER_STAGES.REQUEST_BODY_SERIALIZED;
      } catch (error) {
        audit.current_stage = PROVIDER_STAGES.REQUEST_BODY_SERIALIZED;
        throw attachAudit(
          Object.assign(new Error('Provider request body could not be serialized'), { code: 'PROVIDER_UNAVAILABLE' }),
          audit,
          started,
          { safeErrorCode: 'REQUEST_SERIALIZATION_FAILED', safeErrorMessage: 'Provider request body serialization failed.', cause: error }
        );
      }

      audit.fetch_invoked = true;
      audit.current_stage = PROVIDER_STAGES.FETCH_INVOKED;
      const response = await this.fetchImpl(requestUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: serializedBody,
        signal: controller.signal
      });
      audit.provider_http_reached = true;
      audit.current_stage = PROVIDER_STAGES.HTTP_RESPONSE_RECEIVED;
      const providerAudit = {
        ...audit,
        http_status: response.status,
        latency_ms: Date.now() - started
      };
      if (!response.ok) {
        throw attachAudit(
          Object.assign(new Error('Provider returned a non-success status'), { code: 'PROVIDER_HTTP_FAILURE', httpStatus: response.status }),
          providerAudit,
          started,
          { safeErrorCode: 'PROVIDER_HTTP_ERROR', safeErrorMessage: 'Provider returned a non-success HTTP status.', failureStage: PROVIDER_STAGES.HTTP_RESPONSE_RECEIVED }
        );
      }
      let body;
      try {
        body = await response.json();
        audit.current_stage = PROVIDER_STAGES.RESPONSE_BODY_READ;
      } catch (error) {
        throw attachAudit(
          Object.assign(new Error('Provider response body could not be read'), { code: 'PROVIDER_OUTPUT_INVALID' }),
          { ...audit, http_status: response.status },
          started,
          { safeErrorCode: 'RESPONSE_READ_FAILED', safeErrorMessage: 'Provider response body could not be read.', failureStage: PROVIDER_STAGES.RESPONSE_BODY_READ, cause: error }
        );
      }
      const choice = body?.choices?.[0];
      const usage = body?.usage;
      const responseTraceId = response.headers?.get?.('x-siliconcloud-trace-id')
        || response.headers?.get?.('x-request-id');
      audit.finish_reason = safeFinishReason(choice?.finish_reason);
      audit.prompt_tokens = boundedInteger(usage?.prompt_tokens);
      audit.completion_tokens = boundedInteger(usage?.completion_tokens);
      audit.total_tokens = boundedInteger(usage?.total_tokens);
      audit.response_model = boundedString(body?.model);
      audit.response_id = boundedString(body?.id);
      audit.provider_trace_id = boundedString(responseTraceId);
      const content = choice?.message?.content;
      audit.current_stage = PROVIDER_STAGES.MODEL_CONTENT_EXTRACTED;
      if (typeof content !== 'string') {
        throw attachAudit(
          Object.assign(new Error('Provider output is not text'), { code: 'PROVIDER_OUTPUT_INVALID' }),
          { ...audit, http_status: response.status, json_parse_success: false, model_content: null },
          started,
          { safeErrorCode: 'PROVIDER_OUTPUT_INVALID', safeErrorMessage: 'Provider response did not contain text content.', failureStage: PROVIDER_STAGES.MODEL_CONTENT_EXTRACTED }
        );
      }
      audit.model_content_length_chars = content.length;
      audit.legacy_schema_tokens_observed = tokenOccurrences(content);
      audit.output_truncated = audit.finish_reason === 'length';
      if (audit.output_truncated) {
        throw attachAudit(
          Object.assign(new Error('Provider output reached the configured token limit'), { code: 'PROVIDER_OUTPUT_INVALID' }),
          { ...audit, http_status: response.status, json_parse_success: false },
          started,
          { safeErrorCode: 'OUTPUT_TRUNCATED', safeErrorMessage: 'Provider output reached the configured token limit.', failureStage: PROVIDER_STAGES.MODEL_CONTENT_EXTRACTED }
        );
      }
      try {
        const data = JSON.parse(content);
        return {
          data,
          provider_audit: {
            ...finalizeAudit({ ...audit, http_status: response.status, current_stage: PROVIDER_STAGES.MODEL_CONTENT_EXTRACTED }, started),
            json_parse_success: true,
            markdown_fence_present: /^```(?:json)?(?:\s|$)/i.test(content.trim()),
            model_content: content,
            model_content_length_chars: content.length,
            parsed_json: data
          }
        };
      } catch (_error) {
        throw attachAudit(
          Object.assign(new Error('Provider output is not valid JSON'), { code: 'PROVIDER_OUTPUT_INVALID' }),
          {
            ...audit,
            http_status: response.status,
            json_parse_success: false,
            markdown_fence_present: /^```(?:json)?(?:\s|$)/i.test(content.trim()),
            model_content: content,
            model_content_length_chars: content.length,
            json_parse_error_offset: parseErrorOffset(_error),
            parsed_json: null
          },
          started,
          { safeErrorCode: 'PROVIDER_OUTPUT_INVALID', safeErrorMessage: 'Provider response content was not valid JSON.', failureStage: PROVIDER_STAGES.MODEL_CONTENT_EXTRACTED }
        );
      }
    } catch (error) {
      if (error?.code === 'PROVIDER_TIMEOUT') throw error;
      if (error?.name === 'AbortError') {
        throw attachAudit(
          Object.assign(new Error('Provider request timed out'), { code: 'PROVIDER_TIMEOUT' }),
          error.provider_audit || audit,
          started,
          { safeErrorCode: 'TIMEOUT', safeErrorMessage: 'Provider request timed out.', failureStage: PROVIDER_STAGES.FETCH_INVOKED, cause: error }
        );
      }
      this.logger?.warn?.('Semantic provider diagnostic', { provider: 'openai_compatible', model: this.model, error_classification: error?.code || 'PROVIDER_FAILURE' });
      if (PUBLIC_PROVIDER_ERROR_CODES.has(error?.code)) throw error;
      throw attachAudit(
        Object.assign(new Error('Provider request failed'), { code: 'PROVIDER_UNAVAILABLE' }),
        error.provider_audit || audit,
        started,
        {
          safeErrorCode: error?.provider_audit?.safe_error_code || 'FETCH_FAILED',
          safeErrorMessage: error?.provider_audit?.safe_error_message || 'Provider request failed before an HTTP response.',
          failureStage: error?.provider_audit?.failure_stage || PROVIDER_STAGES.FETCH_INVOKED,
          cause: error
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
