import { randomUUID } from 'node:crypto';
import http from 'node:http';
import {
  SEMANTIC_TASK_TYPES,
  SEMANTIC_TASK_CONTRACTS,
  SEMANTIC_GATEWAY_ERROR_CODES,
  getSemanticTaskContract,
  createGatewayEnvelope,
  REQUIREMENT_CANDIDATE_SCHEMA,
  REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
  REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
  schemaSha256
} from '../../../packages/semantic-contracts/index.js';
import { createMockProvider } from './provider/mock-provider.js';
import { OpenAICompatibleProvider } from './provider/openai-compatible-provider.js';
import { createSemanticTaskRouter } from './task-router.js';
import {
  readSemanticGatewayRuntimeConfig,
  safeSemanticGatewayRuntimeSummary,
  validateSemanticGatewayRuntimeConfig
} from '../../../packages/semantic-contracts/runtime-config.js';

const safeErrorCodes = new Set(SEMANTIC_GATEWAY_ERROR_CODES);
const semanticOutputErrorCodes = new Set([
  'OUTPUT_SCHEMA_INVALID',
  'MAPPING_OUTPUT_SCHEMA_INVALID',
  'MAPPING_SEMANTIC_INCONSISTENT',
  'SUPPORT_SPAN_INVALID'
]);

function parseBooleanEnv(value, fallback) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function parseFiniteEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function generationConfigFromEnv(env = process.env) {
  return {
    enable_thinking: parseBooleanEnv(env.SEMANTIC_GATEWAY_ENABLE_THINKING, false),
    temperature: parseFiniteEnv(env.SEMANTIC_GATEWAY_TEMPERATURE, 0.1),
    top_p: parseFiniteEnv(env.SEMANTIC_GATEWAY_TOP_P, 0.9),
    top_k: parsePositiveIntegerEnv(env.SEMANTIC_GATEWAY_TOP_K, 20),
    frequency_penalty: parseFiniteEnv(env.SEMANTIC_GATEWAY_FREQUENCY_PENALTY, 0),
    max_tokens: parsePositiveIntegerEnv(env.SEMANTIC_GATEWAY_MAX_TOKENS, 4800),
    stream: parseBooleanEnv(env.SEMANTIC_GATEWAY_STREAM, false),
    n: parsePositiveIntegerEnv(env.SEMANTIC_GATEWAY_N, 1)
  };
}

function configFromEnv(env = process.env) {
  const runtime = readSemanticGatewayRuntimeConfig(env);
  const providerName = runtime.provider;
  const timeoutMs = runtime.timeoutMs;
  const generationConfig = generationConfigFromEnv(env);
  const runtimeValidation = validateSemanticGatewayRuntimeConfig(env, {
    requireProvider: providerName === 'openai_compatible'
  });
  const provider = providerName === 'mock'
    ? createMockProvider({ model: runtime.model })
    : new OpenAICompatibleProvider({
      baseUrl: runtime.providerApiBase,
      apiKey: runtime.providerApiKey,
      model: runtime.model,
      timeoutMs,
      generationConfig,
      logger: console
    });
  const deepseekOfficialProvider = new OpenAICompatibleProvider({
    baseUrl: runtime.deepseekOfficialApiBase,
    apiKey: runtime.deepseekOfficialApiKey,
    model: runtime.deepseekOfficialFactModel,
    timeoutMs,
    endpointPath: '/responses',
    protocol: 'responses',
    providerName: 'deepseek_official',
    generationConfig: {
      ...generationConfig,
      enable_thinking: false
    },
    logger: console
  });
  const deepseekConfigured = Boolean(
    runtime.deepseekOfficialApiBase
      && runtime.deepseekOfficialApiKey
      && runtime.deepseekOfficialFactModel
  );
  // Fact extraction and Candidate V2 share the same explicitly configured
  // Official DeepSeek boundary.  Candidate V2 is intentionally mapped even
  // when the Official provider is not configured so the router fails closed
  // through the adapter instead of falling back to the default provider.
  const taskProviders = Object.freeze({
    ...(providerName === 'mock' && !deepseekConfigured ? {} : {
      evidence_fact_extraction: deepseekOfficialProvider
    }),
    evidence_fact_candidate_v2: deepseekOfficialProvider,
    evidence_fact_candidate_v2_1: deepseekOfficialProvider,
    evidence_fact_candidate_v2_2: deepseekOfficialProvider
  });
  return {
    providerName,
    apiKey: runtime.serviceApiKey,
    provider,
    generationConfig,
    taskProviders,
    deepseekOfficialProvider,
    timeoutMs,
    runtimeValidation,
    runtimeSummary: {
      ...safeSemanticGatewayRuntimeSummary(runtime),
      fact_provider: 'deepseek_official',
      fact_provider_configured: deepseekConfigured,
      fact_provider_endpoint: '/responses'
    }
  };
}

function providerReady(config) {
  return Boolean(config.apiKey)
    && (config.providerName === 'mock' || Boolean(config.provider?.configured));
}

function errorCode(error) {
  if (safeErrorCodes.has(error?.code)) return error.code;
  if (error?.message === 'source excerpt is not source-bound' || error?.message === 'support excerpt is not source-bound' || error?.message === 'conflict excerpt is not source-bound') return 'SUPPORT_SPAN_INVALID';
  if (error?.message === 'TASK_UNSUPPORTED') return 'TASK_UNSUPPORTED';
  return 'INTERNAL_GATEWAY_ERROR';
}

function statusFor(code) {
  if (code === 'AUTH_INVALID') return 401;
  if (code === 'TASK_UNSUPPORTED' || code === 'SEMANTIC_CONTRACT_DRIFT' || code === 'INPUT_SCHEMA_INVALID'
    || code === 'OUTPUT_SCHEMA_INVALID' || code === 'MAPPING_OUTPUT_SCHEMA_INVALID'
    || code === 'MAPPING_SEMANTIC_INCONSISTENT' || code === 'SUPPORT_SPAN_INVALID') return 422;
  if (code === 'PROVIDER_TIMEOUT') return 504;
  if (code === 'PROVIDER_HTTP_FAILURE' || code === 'PROVIDER_UNAVAILABLE' || code === 'PROVIDER_OUTPUT_INVALID') return 502;
  return 500;
}

function safeMessage(code) {
  return {
    AUTH_INVALID: 'Gateway authentication failed.',
    TASK_UNSUPPORTED: 'The requested semantic task is not registered.',
    SEMANTIC_CONTRACT_DRIFT: 'Semantic task contract metadata is inconsistent.',
    INPUT_SCHEMA_INVALID: 'Gateway input does not match the task contract.',
    PROVIDER_UNAVAILABLE: 'Semantic provider is unavailable.',
    PROVIDER_TIMEOUT: 'Semantic provider request timed out.',
    PROVIDER_HTTP_FAILURE: 'Semantic provider returned an HTTP failure.',
    PROVIDER_OUTPUT_INVALID: 'Semantic provider output failed strict JSON validation.',
    OUTPUT_SCHEMA_INVALID: 'Semantic output failed the task schema.',
    MAPPING_OUTPUT_SCHEMA_INVALID: 'Mapping semantic output failed the task schema.',
    MAPPING_SEMANTIC_INCONSISTENT: 'Mapping semantic output is internally inconsistent.',
    SUPPORT_SPAN_INVALID: 'Semantic support span is not source-bound.',
    INTERNAL_GATEWAY_ERROR: 'Semantic gateway internal error.'
  }[code] || 'Semantic gateway error.';
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) throw Object.assign(new Error('empty body'), { code: 'INPUT_SCHEMA_INVALID' });
  try { return JSON.parse(raw); } catch (_error) { throw Object.assign(new Error('invalid JSON body'), { code: 'INPUT_SCHEMA_INVALID' }); }
}

function writeJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

function probeDiagnosticsRequested(request) {
  return String(request.headers['x-semantic-gateway-diagnostic'] || '') === 'probe-v1';
}

function legacySchemaDetected(value, observedTokens = []) {
  if (Array.isArray(observedTokens) && observedTokens.length > 0) return true;
  const assessments = Array.isArray(value?.data?.assessments)
    ? value.data.assessments
    : Array.isArray(value?.assessments) ? value.assessments : [];
  return assessments.length > 0 && assessments.some(item => (
    item && typeof item === 'object'
    && ['confidence', 'evidence_type', 'notes'].some(key => Object.prototype.hasOwnProperty.call(item, key))
    && !['semantic_relevance', 'evidence_capability', 'semantic_relationship', 'review_dimensions', 'reason_codes', 'support_observations']
      .some(key => Object.prototype.hasOwnProperty.call(item, key))
  ));
}

const REQUIREMENT_CANDIDATE_FIELDS = Object.freeze([...REQUIREMENT_CANDIDATE_SCHEMA.required]);

function candidateSchemaForContract(contract) {
  const properties = contract?.data_schema?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null;
  const arrayProperty = Object.values(properties).find(property => (
    property && property.type === 'array' && property.items
      && property.items.type === 'object'
  ));
  return arrayProperty?.items || null;
}

/**
 * Project the actual registered semantic task contracts into safe runtime
 * identity metadata.  This is an observer projection only; it never mutates
 * or replaces the registry and intentionally exposes no schema bodies.
 */
export function buildSemanticTaskIdentities(taskRegistry = SEMANTIC_TASK_CONTRACTS) {
  return Object.fromEntries(Object.entries(taskRegistry || {}).map(([taskType, contract]) => {
    const candidateSchema = candidateSchemaForContract(contract);
    return [taskType, {
      task_type: contract?.task_type || taskType,
      contract_version: contract?.contract_version || null,
      candidate_schema_sha256: candidateSchema ? schemaSha256(candidateSchema) : null,
      task_data_schema_sha256: contract?.data_schema ? schemaSha256(contract.data_schema) : null,
      instruction_hash: typeof contract?.instruction_hash === 'string'
        ? contract.instruction_hash : 'NOT_AVAILABLE'
    }];
  }));
}

function observedType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function safeStructuralKey(value) {
  return typeof value === 'string' ? value.slice(0, 80) : String(value).slice(0, 80);
}

function safeStructuralCandidate(candidate, index) {
  const objectCandidate = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate : null;
  const keys = objectCandidate ? Object.keys(objectCandidate).map(safeStructuralKey) : [];
  const missingKeys = objectCandidate
    ? REQUIREMENT_CANDIDATE_FIELDS.filter(key => !Object.prototype.hasOwnProperty.call(objectCandidate, key))
    : [...REQUIREMENT_CANDIDATE_FIELDS];
  const extraKeys = objectCandidate
    ? Object.keys(objectCandidate).filter(key => !REQUIREMENT_CANDIDATE_FIELDS.includes(key)).map(safeStructuralKey)
    : [];
  const text = objectCandidate?.text;
  const sourceRange = objectCandidate?.source_range;
  return {
    candidate_index: index,
    keys,
    missing_keys: missingKeys,
    extra_keys: extraKeys,
    text_type: observedType(text),
    text_empty: typeof text === 'string' ? text.trim().length === 0 : null,
    category_type: observedType(objectCandidate?.category),
    category_value: typeof objectCandidate?.category === 'string' ? objectCandidate.category.slice(0, 80) : null,
    source_range_type: observedType(sourceRange),
    source_range_keys: sourceRange && typeof sourceRange === 'object' && !Array.isArray(sourceRange)
      ? Object.keys(sourceRange).map(safeStructuralKey) : [],
    source_range_start_ref_type: observedType(sourceRange?.start_ref),
    source_range_end_ref_type: observedType(sourceRange?.end_ref),
    mandatory_observed_type: observedType(objectCandidate?.mandatory_observed),
    requires_confirmation_type: observedType(objectCandidate?.requires_confirmation)
  };
}

function safeRequirementStructureSummary(parsedJson) {
  if (!parsedJson || typeof parsedJson !== 'object') {
    return {
      available: false,
      top_level_type: parsedJson === null ? 'null' : observedType(parsedJson),
      top_level_keys: [],
      requirements_present: false,
      requirements_type: null,
      requirements_count: null,
      candidate_summaries: []
    };
  }
  const topLevelKeys = Object.keys(parsedJson).map(safeStructuralKey);
  const data = parsedJson.schema_version && parsedJson.data && typeof parsedJson.data === 'object'
    && !Array.isArray(parsedJson.data) ? parsedJson.data : parsedJson;
  const hasRequirements = Object.prototype.hasOwnProperty.call(data, 'requirements');
  const requirements = data.requirements;
  return {
    available: true,
    top_level_type: observedType(parsedJson),
    top_level_keys: topLevelKeys,
    requirements_present: hasRequirements,
    requirements_type: hasRequirements ? observedType(requirements) : null,
    requirements_count: Array.isArray(requirements) ? requirements.length : null,
    candidate_summaries: Array.isArray(requirements)
      ? requirements.slice(0, 200).map((candidate, index) => safeStructuralCandidate(candidate, index))
      : [],
    candidate_summaries_truncated: Array.isArray(requirements) && requirements.length > 200
  };
}

function unavailableStructureSummary() {
  return {
    available: false,
    top_level_type: null,
    top_level_keys: [],
    requirements_present: null,
    requirements_type: null,
    requirements_count: null,
    candidate_summaries: []
  };
}

function safeMappingSemanticDiagnostic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const dimensions = value.parsed_semantic_fields?.dimensions;
  return {
    result_index: Number.isInteger(value.result_index) ? value.result_index : null,
    response_keys: Array.isArray(value.response_keys)
      ? value.response_keys.filter(key => typeof key === 'string').slice(0, 20).map(key => key.slice(0, 80))
      : [],
    parsed_semantic_fields: {
      decision: typeof value.parsed_semantic_fields?.decision === 'string'
        ? value.parsed_semantic_fields.decision.slice(0, 40) : null,
      dimensions: dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)
        ? Object.fromEntries(Object.entries(dimensions).slice(0, 20).map(([key, item]) => [
          key.slice(0, 80), typeof item === 'string' ? item.slice(0, 40) : null
        ]))
        : {}
    },
    exact_failure_path: typeof value.exact_failure_path === 'string'
      ? value.exact_failure_path.slice(0, 240) : null,
    consistency_rule: typeof value.consistency_rule === 'string'
      ? value.consistency_rule.slice(0, 120) : null
  };
}

function safeValidationErrors(errors) {
  return Array.isArray(errors) ? errors.slice(0, 100).map(error => ({
    stage: typeof error?.stage === 'string' ? error.stage.slice(0, 40) : null,
    path: typeof error?.path === 'string' ? error.path.slice(0, 200) : null,
    keyword: typeof error?.keyword === 'string'
      ? error.keyword.slice(0, 80)
      : typeof error?.validator_code === 'string' ? error.validator_code.slice(0, 80) : null,
    actual_type: typeof error?.actual_type === 'string'
      ? error.actual_type.slice(0, 80)
      : typeof error?.observed_category === 'string' ? error.observed_category.slice(0, 80) : null,
    validator_code: typeof error?.validator_code === 'string'
      ? error.validator_code.slice(0, 80)
      : typeof error?.keyword === 'string' ? error.keyword.slice(0, 80) : null,
    expected: typeof error?.expected === 'string' ? error.expected.slice(0, 240) : null,
    ...(typeof error?.additional_property === 'string' ? {
      additional_property: error.additional_property.slice(0, 120)
    } : {}),
    observed_category: typeof error?.observed_category === 'string'
      ? error.observed_category.slice(0, 80)
      : typeof error?.actual_type === 'string' ? error.actual_type.slice(0, 80) : null,
    ...(typeof error?.safe_offending_fragment === 'string'
      ? { safe_offending_fragment: error.safe_offending_fragment.slice(0, 240) } : {}),
    message: typeof error?.message === 'string' ? error.message.slice(0, 240) : null
  })) : [];
}

function safeProbeDiagnostics({ providerAudit = null, gatewayHttpStatus = null, gatewayErrorCode = null, validationErrors = [], envelopeErrors = [], parsedJson = null, taskType = null, configuredProvider = null, configuredModel = null } = {}) {
  const audit = providerAudit && typeof providerAudit === 'object' ? providerAudit : {};
  const semanticErrorCode = typeof audit.semantic_error_code === 'string'
    ? audit.semantic_error_code
    : semanticOutputErrorCodes.has(gatewayErrorCode) ? gatewayErrorCode : null;
  const parsed = audit.parsed_json ?? parsedJson;
  return {
    task_type: typeof taskType === 'string' ? taskType.slice(0, 80) : null,
    json_parse_success: typeof audit.json_parse_success === 'boolean' ? audit.json_parse_success : null,
    markdown_fence_present: typeof audit.markdown_fence_present === 'boolean' ? audit.markdown_fence_present : null,
    gateway_http_status: Number.isInteger(gatewayHttpStatus) ? gatewayHttpStatus : null,
    gateway_error_code: typeof gatewayErrorCode === 'string' ? gatewayErrorCode.slice(0, 120) : null,
    semantic_error_code: typeof semanticErrorCode === 'string' ? semanticErrorCode.slice(0, 120) : null,
    provider_error_code: typeof audit.provider_error_code === 'string'
      ? audit.provider_error_code.slice(0, 120)
      : typeof audit.safe_error_code === 'string' ? audit.safe_error_code.slice(0, 120) : null,
    provider_http_status: Number.isInteger(audit.http_status) ? audit.http_status : null,
    latency_ms: Number.isInteger(audit.latency_ms) && audit.latency_ms >= 0 ? audit.latency_ms : null,
    provider: typeof audit.provider === 'string' ? audit.provider : null,
    model: typeof audit.model === 'string' ? audit.model : null,
    configured_provider: typeof configuredProvider === 'string' ? configuredProvider : null,
    configured_model: typeof configuredModel === 'string' ? configuredModel : null,
    requested_provider: typeof audit.requested_provider === 'string' ? audit.requested_provider : (typeof audit.provider === 'string' ? audit.provider : null),
    requested_model: typeof audit.requested_model === 'string' ? audit.requested_model : (typeof audit.model === 'string' ? audit.model : null),
    response_provider: typeof audit.response_provider === 'string' ? audit.response_provider : null,
    response_model: typeof audit.response_model === 'string' ? audit.response_model : null,
    endpoint: typeof audit.endpoint === 'string' ? audit.endpoint : null,
    configured_default_max_tokens: Number.isInteger(audit.configured_default_max_tokens)
      ? audit.configured_default_max_tokens : null,
    task_override_applied: typeof audit.task_override_applied === 'boolean' ? audit.task_override_applied : null,
    resolved_max_output_tokens: Number.isInteger(audit.resolved_max_output_tokens)
      ? audit.resolved_max_output_tokens : null,
    provider_adapter_invoked: audit.provider_adapter_invoked === true,
    fetch_invoked: audit.fetch_invoked === true,
    provider_http_reached: audit.provider_http_reached === true,
    empty_domain_namespace_normalized_count: Number.isInteger(audit.empty_domain_namespace_normalized_count)
      && audit.empty_domain_namespace_normalized_count >= 0
      ? audit.empty_domain_namespace_normalized_count : 0,
    retry_attempt: Number.isInteger(audit.retry_attempt) && audit.retry_attempt >= 0 ? audit.retry_attempt : null,
    retry_reason: typeof audit.retry_reason === 'string' ? audit.retry_reason.slice(0, 120) : null,
    current_stage: typeof audit.current_stage === 'string' ? audit.current_stage : null,
    failure_stage: typeof audit.failure_stage === 'string' ? audit.failure_stage : null,
    error_name: typeof audit.error_name === 'string' ? audit.error_name : null,
    safe_error_code: typeof audit.safe_error_code === 'string' ? audit.safe_error_code : null,
    safe_error_message: typeof audit.safe_error_message === 'string' ? audit.safe_error_message : null,
    cause_name: typeof audit.cause_name === 'string' ? audit.cause_name : null,
    cause_code: typeof audit.cause_code === 'string' ? audit.cause_code : null,
    cause_message: typeof audit.cause_message === 'string' ? audit.cause_message : null,
    finish_reason: typeof audit.finish_reason === 'string' ? audit.finish_reason : null,
    prompt_tokens: Number.isInteger(audit.prompt_tokens) ? audit.prompt_tokens : null,
    completion_tokens: Number.isInteger(audit.completion_tokens) ? audit.completion_tokens : null,
    total_tokens: Number.isInteger(audit.total_tokens) ? audit.total_tokens : null,
    response_id: typeof audit.response_id === 'string' ? audit.response_id : null,
    provider_trace_id: typeof audit.provider_trace_id === 'string' ? audit.provider_trace_id : null,
    semantic_contract_version: typeof audit.semantic_contract_version === 'string' ? audit.semantic_contract_version : null,
    instruction_sha256: typeof audit.instruction_sha256 === 'string' ? audit.instruction_sha256 : null,
    model_content_length_chars: Number.isInteger(audit.model_content_length_chars) ? audit.model_content_length_chars : null,
    output_truncated: audit.output_truncated === true,
    response_format_type: audit.response_format_type === 'json_schema' || audit.response_format_type === 'json_object'
      ? audit.response_format_type : null,
    json_parse_error_offset: Number.isInteger(audit.json_parse_error_offset) ? audit.json_parse_error_offset : null,
    legacy_schema_tokens_observed: Array.isArray(audit.legacy_schema_tokens_observed)
      ? audit.legacy_schema_tokens_observed.filter(token => typeof token === 'string').slice(0, 20)
      : [],
    generation_config: audit.generation_config && typeof audit.generation_config === 'object'
      ? {
        response_format: audit.generation_config.response_format?.type === 'json_object'
          ? { type: 'json_object' }
          : audit.generation_config.response_format?.type === 'json_schema'
            ? {
              type: 'json_schema',
              name: typeof audit.generation_config.response_format.json_schema?.name === 'string'
                ? audit.generation_config.response_format.json_schema.name : null,
              strict: audit.generation_config.response_format.json_schema?.strict === true
            }
            : null,
        max_tokens: Number.isInteger(audit.generation_config.max_tokens) ? audit.generation_config.max_tokens : null,
        temperature: Number.isFinite(audit.generation_config.temperature) ? audit.generation_config.temperature : null,
        top_p: Number.isFinite(audit.generation_config.top_p) ? audit.generation_config.top_p : null,
        top_k: Number.isInteger(audit.generation_config.top_k) ? audit.generation_config.top_k : null,
        frequency_penalty: Number.isFinite(audit.generation_config.frequency_penalty) ? audit.generation_config.frequency_penalty : null,
        stream: audit.generation_config.stream === true,
        enable_thinking: audit.generation_config.enable_thinking === true,
        n: Number.isInteger(audit.generation_config.n) ? audit.generation_config.n : null
      }
      : null,
    outbound_prompt_diagnostics: audit.outbound_prompt_diagnostics && typeof audit.outbound_prompt_diagnostics === 'object'
      ? {
        instruction_sha256: typeof audit.outbound_prompt_diagnostics.instruction_sha256 === 'string' ? audit.outbound_prompt_diagnostics.instruction_sha256 : null,
        instruction_char_count: Number.isInteger(audit.outbound_prompt_diagnostics.instruction_char_count) ? audit.outbound_prompt_diagnostics.instruction_char_count : null,
        payload_sha256: typeof audit.outbound_prompt_diagnostics.payload_sha256 === 'string' ? audit.outbound_prompt_diagnostics.payload_sha256 : null,
        payload_char_count: Number.isInteger(audit.outbound_prompt_diagnostics.payload_char_count) ? audit.outbound_prompt_diagnostics.payload_char_count : null,
        legacy_schema_tokens_observed: Array.isArray(audit.outbound_prompt_diagnostics.legacy_schema_tokens_observed)
          ? audit.outbound_prompt_diagnostics.legacy_schema_tokens_observed.filter(token => typeof token === 'string').slice(0, 20)
          : [],
        legacy_schema_positive_schema_context: audit.outbound_prompt_diagnostics.legacy_schema_positive_schema_context === true,
        contamination: audit.outbound_prompt_diagnostics.contamination === true
      }
      : null,
    schema_validation_errors: safeValidationErrors(validationErrors),
    fact_semantic_diagnostic: audit.fact_semantic_diagnostic && typeof audit.fact_semantic_diagnostic === 'object'
      ? {
        stage: audit.fact_semantic_diagnostic.stage === 'FACT' ? 'FACT' : null,
        diagnostic: audit.fact_semantic_diagnostic.diagnostic === 'FACT_SEMANTIC_UNKNOWN_FIELDS_REJECTED'
          ? 'FACT_SEMANTIC_UNKNOWN_FIELDS_REJECTED' : null,
        unknown_fields: Array.isArray(audit.fact_semantic_diagnostic.unknown_fields)
          ? audit.fact_semantic_diagnostic.unknown_fields
            .filter(field => typeof field === 'string').slice(0, 100).map(field => field.slice(0, 120))
          : []
      }
      : null,
    fact_normalization_diagnostic: audit.fact_normalization_diagnostic && typeof audit.fact_normalization_diagnostic === 'object'
      ? {
        projection_invoked: audit.fact_normalization_diagnostic.projection_invoked === true,
        normalizer_invoked: audit.fact_normalization_diagnostic.normalizer_invoked === true,
        pre_normalization_fact_keys: Array.isArray(audit.fact_normalization_diagnostic.pre_normalization_fact_keys)
          ? audit.fact_normalization_diagnostic.pre_normalization_fact_keys.slice(0, 100).map(keys => Array.isArray(keys)
            ? keys.filter(key => typeof key === 'string').slice(0, 80).map(key => key.slice(0, 120)) : []) : [],
        post_normalization_fact_keys: Array.isArray(audit.fact_normalization_diagnostic.post_normalization_fact_keys)
          ? audit.fact_normalization_diagnostic.post_normalization_fact_keys.slice(0, 100).map(keys => Array.isArray(keys)
            ? keys.filter(key => typeof key === 'string').slice(0, 80).map(key => key.slice(0, 120)) : []) : [],
        unexpected_property_names: Array.isArray(audit.fact_normalization_diagnostic.unexpected_property_names)
          ? audit.fact_normalization_diagnostic.unexpected_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        allowed_property_names: Array.isArray(audit.fact_normalization_diagnostic.allowed_property_names)
          ? audit.fact_normalization_diagnostic.allowed_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        removed_property_names: Array.isArray(audit.fact_normalization_diagnostic.removed_property_names)
          ? audit.fact_normalization_diagnostic.removed_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        exact_validation_path: typeof audit.fact_normalization_diagnostic.exact_validation_path === 'string'
          ? audit.fact_normalization_diagnostic.exact_validation_path.slice(0, 240) : null
      } : null,
    mapping_semantic_diagnostic: safeMappingSemanticDiagnostic(audit.mapping_semantic_diagnostic),
    envelope_validation_errors: safeValidationErrors(envelopeErrors),
    legacy_schema_detected: legacySchemaDetected(parsed, audit.legacy_schema_tokens_observed),
    structural_summary: taskType === 'requirement_extraction'
      ? (parsed && typeof parsed === 'object' ? safeRequirementStructureSummary(parsed) : unavailableStructureSummary())
      : unavailableStructureSummary()
  };
}

export function createStandaloneGatewayHandler({ env = process.env, config = configFromEnv(env), logger = console, taskRegistry = SEMANTIC_TASK_CONTRACTS } = {}) {
  const router = config.taskRouter || createSemanticTaskRouter({
    provider: config.provider,
    providers: config.taskProviders,
    generationConfig: config.generationConfig
  });
  return async function handle(request, response) {
    const requestId = randomUUID();
    const started = Date.now();
    const diagnosticsRequested = probeDiagnosticsRequested(request);
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { status: 'ok', service: 'semantic-gateway', request_id: requestId });
      return;
    }
    if (request.method === 'GET' && request.url === '/ready') {
      const ready = providerReady(config);
      writeJson(response, ready ? 200 : 503, {
        status: ready ? 'ready' : 'not_ready',
        provider: config.providerName,
        task_registry_loaded: SEMANTIC_TASK_TYPES.length > 0,
        provider_configured: ready
      });
      return;
    }
    if (request.method === 'GET' && request.url === '/info') {
      const requirementContract = getSemanticTaskContract('requirement_extraction');
      const semanticTasks = buildSemanticTaskIdentities(taskRegistry);
      const runtimeTaskTypes = Object.keys(taskRegistry || {});
      const serviceVersion = String(env.SEMANTIC_GATEWAY_BUILD_VERSION || env.SEMANTIC_GATEWAY_VERSION || '0.1.0');
      const buildRevision = String(env.SEMANTIC_GATEWAY_COMMIT || env.GIT_COMMIT || 'dev-working-tree');
      const workingTreeDirty = env.SEMANTIC_GATEWAY_WORKTREE_DIRTY === 'true'
        ? true : env.SEMANTIC_GATEWAY_WORKTREE_DIRTY === 'false' ? false : null;
      const promptVersion = requirementContract?.contract_version || null;
      const promptHash = requirementContract?.instruction_hash || null;
      writeJson(response, 200, {
        service: 'semantic-gateway',
        service_version: serviceVersion,
        build_revision: buildRevision,
        working_tree_dirty: workingTreeDirty,
        // Keep the original aliases for existing diagnostic consumers.
        version: serviceVersion,
        commit: buildRevision,
        gateway_schema_version: 'semantic-gateway-envelope-v1',
        task_registry_loaded: runtimeTaskTypes.length > 0,
        task_types: runtimeTaskTypes,
        requirement_extraction_contract_version: requirementContract?.contract_version || null,
        requirement_extraction_prompt_version: promptVersion,
        requirement_extraction_prompt_hash: promptHash,
        // Historical field name retained as a read-only alias.
        requirement_extraction_instruction_hash: promptHash,
        candidate_schema_contract_version: REQUIREMENT_CANDIDATE_SCHEMA_VERSION,
        candidate_schema_sha256: REQUIREMENT_CANDIDATE_SCHEMA_SHA256,
        semantic_tasks: semanticTasks,
        fact_provider: config.runtimeSummary.fact_provider,
        fact_provider_configured: config.runtimeSummary.fact_provider_configured,
        fact_provider_endpoint: config.runtimeSummary.fact_provider_endpoint,
        fact_model: config.runtimeSummary.deepseek_official_fact_model
      });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/workflows/run') {
      writeJson(response, 404, { error_code: 'NOT_FOUND', message: 'Not found.' });
      return;
    }
    const expectedKey = config.apiKey;
    const authorization = String(request.headers.authorization || '');
    if (!expectedKey || authorization !== `Bearer ${expectedKey}`) {
      writeJson(response, 401, { error_code: 'AUTH_INVALID', message: safeMessage('AUTH_INVALID'), request_id: requestId });
      return;
    }
    let taskType;
    try {
      const body = await readJson(request);
      const inputs = body?.inputs;
      taskType = inputs?.task_type;
      const contract = getSemanticTaskContract(taskType);
      if (!contract || typeof inputs?.task_instruction !== 'string' || !inputs.task_instruction.trim() || typeof inputs?.task_payload_json !== 'string') {
        throw Object.assign(new Error('task input invalid'), { code: contract ? 'INPUT_SCHEMA_INVALID' : 'TASK_UNSUPPORTED' });
      }
      let payload;
      try { payload = JSON.parse(inputs.task_payload_json); } catch (_error) { throw Object.assign(new Error('task_payload_json invalid'), { code: 'INPUT_SCHEMA_INVALID' }); }
      const routed = await router.dispatch({ taskType, payload });
      const { data } = routed;
      const envelope = createGatewayEnvelope({ taskType, data, warnings: [] });
      const elapsed = Date.now() - started;
      logger?.info?.('Semantic gateway request', {
        request_id: requestId,
        task_type: taskType,
        contract_version: contract.contract_version,
        provider: routed.provider_audit?.provider || config.providerName,
        model: routed.provider_audit?.model || config.provider?.model || 'mock-semantic-v1',
        requested_provider: routed.provider_audit?.requested_provider || routed.provider_audit?.provider || config.providerName,
        requested_model: routed.provider_audit?.requested_model || routed.provider_audit?.model || config.provider?.model || 'mock-semantic-v1',
        response_model: routed.provider_audit?.response_model || null,
        endpoint: routed.provider_audit?.endpoint || null,
        configured_default_max_tokens: routed.provider_audit?.configured_default_max_tokens ?? null,
        task_override_applied: routed.provider_audit?.task_override_applied ?? null,
        resolved_max_output_tokens: routed.provider_audit?.resolved_max_output_tokens ?? null,
        latency_ms: elapsed,
        http_status: 200,
        input_bytes: Buffer.byteLength(inputs.task_payload_json),
        output_bytes: Buffer.byteLength(JSON.stringify(envelope))
      });
      const result = { data: { outputs: { response_payload_json: JSON.stringify(envelope) } } };
      if (diagnosticsRequested) {
        result.probe_diagnostics = safeProbeDiagnostics({
          providerAudit: routed.provider_audit,
          gatewayHttpStatus: 200,
          taskType,
          configuredProvider: taskType.startsWith('evidence_fact_') ? 'deepseek_official' : config.providerName,
          configuredModel: taskType.startsWith('evidence_fact_') ? config.runtimeSummary?.deepseek_official_fact_model || null : config.provider?.model
        });
      }
      writeJson(response, 200, result);
    } catch (error) {
      const code = errorCode(error);
      const elapsed = Date.now() - started;
      logger?.warn?.('Semantic gateway request failed', {
        request_id: requestId,
        task_type: taskType || null,
        provider: error?.provider_audit?.provider || config.providerName,
        requested_provider: error?.provider_audit?.requested_provider || error?.provider_audit?.provider || config.providerName,
        requested_model: error?.provider_audit?.requested_model || error?.provider_audit?.model || null,
        response_model: error?.provider_audit?.response_model || null,
        endpoint: error?.provider_audit?.endpoint || null,
        configured_default_max_tokens: error?.provider_audit?.configured_default_max_tokens ?? null,
        task_override_applied: error?.provider_audit?.task_override_applied ?? null,
        resolved_max_output_tokens: error?.provider_audit?.resolved_max_output_tokens ?? null,
        latency_ms: elapsed,
        error_classification: code
      });
      const result = { error_code: code, message: safeMessage(code), request_id: requestId };
      if (diagnosticsRequested) {
        result.probe_diagnostics = safeProbeDiagnostics({
          providerAudit: error?.provider_audit,
          gatewayHttpStatus: statusFor(code),
          gatewayErrorCode: code,
          validationErrors: error?.validation_diagnostics,
          envelopeErrors: error?.envelope_validation_diagnostics,
          taskType,
          configuredProvider: taskType?.startsWith('evidence_fact_') ? 'deepseek_official' : config.providerName,
          configuredModel: taskType?.startsWith('evidence_fact_') ? config.runtimeSummary?.deepseek_official_fact_model || null : config.provider?.model
        });
      }
      writeJson(response, statusFor(code), result);
    }
  };
}

export function createStandaloneGatewayServer(options = {}) {
  return http.createServer(createStandaloneGatewayHandler(options));
}

export function gatewayConfigFromEnv(env = process.env) {
  return configFromEnv(env);
}

export function validateGatewayRuntimeConfig(env = process.env) {
  const config = configFromEnv(env);
  return {
    ...config.runtimeValidation,
    summary: config.runtimeSummary
  };
}
