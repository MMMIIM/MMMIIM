import { AppError } from '../errors.js';
import {
  getSemanticTaskInstructionMetadata,
  validateTaskData,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256
} from '../../../packages/semantic-contracts/index.js';
import { hashSource } from './source-location-resolver.js';
import { createEvidenceFactCandidateV21SourceAliasTable } from './evidence-fact-candidate-v2-1.js';

export const EVIDENCE_FACT_EXTRACTION_TASK_TYPE = 'evidence_fact_extraction';
export const EVIDENCE_FACT_EXTRACTION_CONTRACT_VERSION = '4.3-evidence-fact-extraction-v1';
export const EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE = 'evidence_fact_candidate_v2';
export const EVIDENCE_FACT_CANDIDATE_V2_CONTRACT_VERSION = EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION;
export const EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE = 'evidence_fact_candidate_v2_1';
export const EVIDENCE_FACT_CANDIDATE_V21_CONTRACT_VERSION = EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION;
export const EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE = 'evidence_fact_candidate_v2_2';
export const EVIDENCE_FACT_CANDIDATE_V22_CONTRACT_VERSION = EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION;
export const FACT_CANDIDATE_V2_AUDIT = Symbol('fact-candidate-v2-audit');
// Non-enumerable metadata lets the owning service propagate safe execution
// evidence without changing the Semantic Fact Candidate array contract.
export const FACT_PROVIDER_AUDIT = Symbol('fact-provider-audit');

const sha256 = hashSource;

function requiredText(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new AppError('FACT_SEMANTIC_INPUT_INVALID', `${name} is required.`, 422, { stage: 'FACT' });
  return text;
}

function requiredSourceText(value, name) {
  const sourceText = String(value ?? '');
  if (!sourceText.trim()) throw new AppError('FACT_SEMANTIC_INPUT_INVALID', `${name} is required.`, 422, { stage: 'FACT' });
  return sourceText;
}

function safeScalar(value, maxLength = 160) {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

/**
 * Keep corrective feedback a bounded diagnostic projection.  It is never
 * treated as caller-authored instruction and is only accepted for the
 * fact-extraction retry path.
 */
export function buildCorrectiveSchemaGuidance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const required = ['path', 'keyword', 'expected', 'actual_type'];
  if (required.some(key => typeof value[key] !== 'string' || !value[key].trim())) return null;
  const feedback = Object.fromEntries(required.map(key => [key, value[key].slice(0, 200)]));
  for (const key of ['additional_property', 'missing_property', 'pattern']) {
    if (typeof value[key] === 'string' && value[key].trim()) feedback[key] = value[key].slice(0, 200);
  }
  return Object.freeze(feedback);
}

function safeFactProviderAudit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    provider: safeScalar(value.provider, 80),
    model: safeScalar(value.model, 160),
    requested_provider: safeScalar(value.requested_provider, 80),
    requested_model: safeScalar(value.requested_model, 160),
    response_provider: safeScalar(value.response_provider, 80),
    response_model: safeScalar(value.response_model, 160),
    endpoint: safeScalar(value.endpoint, 80),
    latency_ms: Number.isInteger(value.latency_ms) && value.latency_ms >= 0 ? value.latency_ms : null,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    provider_http_reached: value.provider_http_reached === true,
    empty_domain_namespace_normalized_count: Number.isInteger(value.empty_domain_namespace_normalized_count)
      && value.empty_domain_namespace_normalized_count >= 0
      ? value.empty_domain_namespace_normalized_count : 0,
    fact_normalization_diagnostic: value.fact_normalization_diagnostic && typeof value.fact_normalization_diagnostic === 'object'
      ? {
        projection_invoked: value.fact_normalization_diagnostic.projection_invoked === true,
        normalizer_invoked: value.fact_normalization_diagnostic.normalizer_invoked === true,
        pre_normalization_fact_keys: Array.isArray(value.fact_normalization_diagnostic.pre_normalization_fact_keys)
          ? value.fact_normalization_diagnostic.pre_normalization_fact_keys.slice(0, 100).map(keys => Array.isArray(keys)
            ? keys.filter(key => typeof key === 'string').slice(0, 80).map(key => key.slice(0, 120)) : []) : [],
        post_normalization_fact_keys: Array.isArray(value.fact_normalization_diagnostic.post_normalization_fact_keys)
          ? value.fact_normalization_diagnostic.post_normalization_fact_keys.slice(0, 100).map(keys => Array.isArray(keys)
            ? keys.filter(key => typeof key === 'string').slice(0, 80).map(key => key.slice(0, 120)) : []) : [],
        unexpected_property_names: Array.isArray(value.fact_normalization_diagnostic.unexpected_property_names)
          ? value.fact_normalization_diagnostic.unexpected_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        allowed_property_names: Array.isArray(value.fact_normalization_diagnostic.allowed_property_names)
          ? value.fact_normalization_diagnostic.allowed_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        removed_property_names: Array.isArray(value.fact_normalization_diagnostic.removed_property_names)
          ? value.fact_normalization_diagnostic.removed_property_names.filter(key => typeof key === 'string').slice(0, 100).map(key => key.slice(0, 120)) : [],
        numeric_coercion_count: Number.isInteger(value.fact_normalization_diagnostic.numeric_coercion_count)
          ? value.fact_normalization_diagnostic.numeric_coercion_count : 0,
        exact_validation_path: safeScalar(value.fact_normalization_diagnostic.exact_validation_path, 240)
      } : null,
    gateway_http_status: Number.isInteger(value.gateway_http_status) ? value.gateway_http_status : null,
    gateway_error_code: safeScalar(value.gateway_error_code, 120),
    semantic_error_code: safeScalar(value.semantic_error_code, 120),
    provider_error_code: safeScalar(value.provider_error_code, 120),
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    retry_attempt: Number.isInteger(value.retry_attempt) && value.retry_attempt >= 0 ? value.retry_attempt : null,
    retry_reason: safeScalar(value.retry_reason, 120),
    finish_reason: safeScalar(value.finish_reason, 40),
    prompt_tokens: Number.isInteger(value.prompt_tokens) ? value.prompt_tokens : null,
    completion_tokens: Number.isInteger(value.completion_tokens) ? value.completion_tokens : null,
    output_truncated: value.output_truncated === true,
    json_parse_success: typeof value.json_parse_success === 'boolean' ? value.json_parse_success : null,
    safe_error_code: safeScalar(value.safe_error_code, 80),
    cause_code: safeScalar(value.cause_code, 80)
  };
}

function attachProviderAudit(facts, audit) {
  if (!audit) return facts;
  Object.defineProperty(facts, FACT_PROVIDER_AUDIT, {
    configurable: false,
    enumerable: false,
    value: audit,
    writable: false
  });
  return facts;
}

function attachCandidateV2Audit(facts, audit) {
  if (!audit) return facts;
  Object.defineProperty(facts, FACT_CANDIDATE_V2_AUDIT, {
    configurable: false,
    enumerable: false,
    value: Object.freeze(audit),
    writable: false
  });
  return facts;
}

function safeCandidateV2Snapshot(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(keys.map(key => {
    const raw = value[key];
    if (typeof raw === 'string') return [key, raw.slice(0, key === 'approved_review_identity' ? 160 : 200)];
    if (typeof raw === 'number' || typeof raw === 'boolean' || raw === null || raw === undefined) return [key, raw ?? null];
    return [key, null];
  }));
}

/**
 * Validate and retain the Backend-owned authorization/provenance context.
 * This object is never serialized as the model-facing semantic input.
 */
export function buildEvidenceFactAuthorizationContext(context = {}) {
  if (context.review_status !== 'approved') {
    throw new AppError('FACT_SEMANTIC_INPUT_INVALID', 'Fact extraction requires an approved Evidence Review.', 409, { stage: 'FACT' });
  }
  if (context.evidence_review_contract_version !== 'evidence-review-v1') {
    throw new AppError('FACT_SEMANTIC_INPUT_INVALID', 'Evidence Review contract is not current.', 409, { stage: 'FACT' });
  }
  const sourceText = requiredSourceText(context.source_text, 'source_text');
  const sourceHash = requiredText(context.current_source_text_hash || context.source_text_hash, 'source_text_hash');
  if (sha256(sourceText) !== sourceHash) {
    throw new AppError('FACT_SEMANTIC_SOURCE_INVALID', 'Source Span hash does not match its text.', 422, { stage: 'FACT' });
  }
  const projectId = requiredText(context.project_id, 'project_id');
  const reviewId = requiredText(context.review_id, 'review_id');
  const sourceSpanId = requiredText(context.source_span_id, 'source_span_id');
  const materialId = requiredText(context.material_id, 'material_id');
  return Object.freeze({
    review: Object.freeze({
      review_id: reviewId,
      project_id: projectId,
      review_status: context.review_status,
      contract_version: context.evidence_review_contract_version,
      evidence_capability: context.evidence_capability || null,
      support_level: context.support_level || null
    }),
    source_span: Object.freeze({
      source_span_id: sourceSpanId,
      anchor_chunk_id: context.anchor_chunk_id || null,
      source_text_hash: sourceHash,
      source_text: sourceText
    }),
    material: Object.freeze({
      material_id: materialId,
      material_type: context.material_type || null
    }),
    source_text: sourceText
  });
}

/**
 * Build the single model-facing semantic projection for Fact extraction.
 * Review support metadata remains available to Backend authorization/audit,
 * but is deliberately excluded from this projection. See ADR-021.
 */
export function buildEvidenceFactSemanticInput(context = {}, { correctiveFeedback = null } = {}) {
  const authorization = buildEvidenceFactAuthorizationContext(context);
  const safeFeedback = buildCorrectiveSchemaGuidance(correctiveFeedback);
  return Object.freeze({
    source_text: authorization.source_text,
    material: Object.freeze({ material_type: authorization.material.material_type }),
    ...(safeFeedback ? { validation_feedback: safeFeedback } : {})
  });
}

// Keep the existing internal builder name while making its sole output the
// canonical semantic projection; no second payload definition is introduced.
export function buildEvidenceFactExtractionPayload(context = {}, options = {}) {
  return buildEvidenceFactSemanticInput(context, options);
}

/**
 * Candidate V2 keeps the same Backend-owned approved source boundary as the
 * legacy extractor, while removing canonical lifecycle/authority fields from
 * the model surface.  Source snapshot and review identity stay outside this
 * payload and are supplied to the deterministic post-processor.
 */
export function buildEvidenceFactCandidateV2SemanticInput(context = {}, { sourceSnapshot = null } = {}) {
  const authorization = buildEvidenceFactAuthorizationContext(context);
  if (sourceSnapshot) {
    if (!sourceSnapshot.snapshot_id || !Array.isArray(sourceSnapshot.segments)) {
      throw new AppError('FACT_SEMANTIC_INPUT_INVALID', 'Candidate V2 requires a frozen source snapshot.', 422, { stage: 'FACT' });
    }
    const sourceSegments = sourceSnapshot.segments.map(segment => ({
      source_ref: String(segment.source_ref || '').trim(),
      text: String(segment.text || '')
    }));
    if (sourceSegments.some(segment => !segment.source_ref || !segment.text)) {
      throw new AppError('FACT_SEMANTIC_SOURCE_INVALID', 'Candidate V2 source segments are invalid.', 422, { stage: 'FACT' });
    }
    return Object.freeze({
      source_snapshot_id: sourceSnapshot.snapshot_id,
      source_segments: Object.freeze(sourceSegments),
      material: Object.freeze({ material_type: authorization.material.material_type })
    });
  }
  return Object.freeze({
    source_text: authorization.source_text,
    material: Object.freeze({ material_type: authorization.material.material_type })
  });
}

/** Model-facing V2.1 input: numbered source segments, never a source snapshot identity payload. */
export function buildEvidenceFactCandidateV21SemanticInput(context = {}, { sourceSnapshot = null } = {}) {
  const authorization = buildEvidenceFactAuthorizationContext(context);
  if (!sourceSnapshot || !Array.isArray(sourceSnapshot.segments) || !sourceSnapshot.snapshot_id) {
    throw new AppError('FACT_SEMANTIC_INPUT_INVALID', 'Candidate V2.1 requires a frozen source snapshot.', 422, { stage: 'FACT' });
  }
  const aliasTable = createEvidenceFactCandidateV21SourceAliasTable(sourceSnapshot);
  const sourceSegments = aliasTable.segments.map(segment => ({
    source_ref: segment.source_ref,
    text: segment.text
  }));
  return Object.freeze({
    source_snapshot_id: sourceSnapshot.snapshot_id,
    source_segments: Object.freeze(sourceSegments),
    material: Object.freeze({ material_type: authorization.material.material_type })
  });
}

const TRANSPORT_DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

function transportFailure(message, details = {}) {
  throw new AppError('FACT_SEMANTIC_TRANSPORT_INVALID', message, 422, { stage: 'FACT', ...details });
}

function normalizeTransportDecimal(value, label) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      transportFailure(`${label} must be a finite safe decimal number.`);
    }
    const text = String(value);
    if (!TRANSPORT_DECIMAL.test(text)) transportFailure(`${label} must use decimal notation.`);
    return text;
  }
  if (typeof value !== 'string' || !TRANSPORT_DECIMAL.test(value)) {
    transportFailure(`${label} must be exact decimal text or a safe decimal number.`);
  }
  return value;
}

function assertTransportQuote(quote, sourceText, label) {
  if (typeof quote !== 'string' || !quote.trim()) transportFailure(`${label} must be non-empty.`);
  if (typeof sourceText === 'string' && !sourceText.includes(quote)) {
    transportFailure(`${label} must be grounded in source_text.`);
  }
}

/**
 * Project the deliberately small provider transport into the existing
 * Canonical Fact candidate shape.  This is deterministic representation
 * assembly only; it does not infer semantics, authorize a Fact, or persist.
 */
export function projectEvidenceFactTransportCandidate(transportCandidate = {}, { sourceText = '' } = {}) {
  if (!transportCandidate || typeof transportCandidate !== 'object' || Array.isArray(transportCandidate)) {
    transportFailure('Fact transport candidate must be an object.');
  }
  const candidate = transportCandidate;
  const scopes = [];
  const scopeSourceTexts = {};
  for (const [index, scope] of (candidate.scopes || []).entries()) {
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) transportFailure(`scopes[${index}] must be an object.`);
    const value = String(scope.value ?? '').trim();
    if (!value) transportFailure(`scopes[${index}].value must be non-empty.`);
    const scopeQuote = typeof scope.source_text === 'string' && scope.source_text.trim()
      ? scope.source_text
      : sourceText;
    assertTransportQuote(scopeQuote, sourceText, `scopes[${index}].source_text`);
    if (Object.prototype.hasOwnProperty.call(scopeSourceTexts, value)) {
      if (scopeSourceTexts[value] !== scopeQuote) {
        transportFailure(`scopes[${index}] conflicts with an earlier scope value.`, { field: 'scopes' });
      }
      continue;
    }
    scopes.push(value);
    scopeSourceTexts[value] = scopeQuote;
  }

  const quantities = (candidate.quantities || []).map((quantity, index) => {
    if (!quantity || typeof quantity !== 'object' || Array.isArray(quantity)) transportFailure(`quantities[${index}] must be an object.`);
    const metric = String(quantity.metric ?? '').trim();
    const unit = String(quantity.unit ?? '').trim();
    if (!metric) transportFailure(`quantities[${index}].metric is required.`);
    if (!unit) transportFailure(`quantities[${index}].unit is required.`);
    const quantityQuote = typeof quantity.source_text === 'string' && quantity.source_text.trim()
      ? quantity.source_text
      : sourceText;
    assertTransportQuote(quantityQuote, sourceText, `quantities[${index}].source_text`);
    const projected = {
      metric,
      value: normalizeTransportDecimal(quantity.value, `quantities[${index}].value`),
      unit
    };
    if (quantity.operator !== undefined && quantity.operator !== null) projected.operator = String(quantity.operator);
    if (quantity.sample_size !== undefined && quantity.sample_size !== null) {
      projected.sample_size = normalizeTransportDecimal(quantity.sample_size, `quantities[${index}].sample_size`);
    }
    if (quantity.conditions !== undefined) {
      if (!Array.isArray(quantity.conditions)) transportFailure(`quantities[${index}].conditions must be an array.`);
      const conditions = {};
      for (const [conditionIndex, condition] of quantity.conditions.entries()) {
        if (!condition || typeof condition !== 'object' || Array.isArray(condition)) transportFailure(`quantities[${index}].conditions[${conditionIndex}] must be an object.`);
        const name = String(condition.name ?? '').trim();
        if (!name) transportFailure(`quantities[${index}].conditions[${conditionIndex}].name is required.`);
        const value = normalizeTransportDecimal(condition.value, `quantities[${index}].conditions[${conditionIndex}].value`);
        if (Object.prototype.hasOwnProperty.call(conditions, name)) {
          if (conditions[name] !== value) transportFailure(`quantities[${index}].conditions has conflicting ${name}.`);
          continue;
        }
        conditions[name] = value;
      }
      projected.conditions = conditions;
    }
    return projected;
  });

  return {
    subject: { type: candidate.subject_type, name: candidate.subject_name },
    entities: candidate.entities || [],
    status: candidate.status,
    ...(candidate.status_source_text !== undefined ? { status_source_text: candidate.status_source_text } : {}),
    scopes,
    scope_source_texts: scopeSourceTexts,
    quantities,
    validity: candidate.validity,
    domain_metadata: candidate.domain_metadata || {}
  };
}

export class SemanticGatewayEvidenceFactExtractor {
  constructor({ client, version = EVIDENCE_FACT_EXTRACTION_CONTRACT_VERSION } = {}) {
    this.client = client;
    this.version = version;
  }

  async extract(context = {}, { correctiveFeedback = null } = {}) {
    if (!this.client || typeof this.client.run !== 'function') {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact semantic worker is not configured.', 503, { stage: 'FACT' });
    }
    const payload = buildEvidenceFactSemanticInput(context, { correctiveFeedback });
    const instruction = getSemanticTaskInstructionMetadata(EVIDENCE_FACT_EXTRACTION_TASK_TYPE)?.instruction;
    if (!instruction) {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact semantic task contract is unavailable.', 503, { stage: 'FACT' });
    }
    let result;
    try {
      result = await this.client.run({
        task_type: EVIDENCE_FACT_EXTRACTION_TASK_TYPE,
        task_instruction: instruction,
        task_payload_json: JSON.stringify(payload)
      }, { diagnosticMode: 'probe-v1' });
    } catch (error) {
      if (String(error?.code || '').startsWith('FACT_')) throw error;
      const schemaValidationErrors = error?.audit?.probe_diagnostics?.schema_validation_errors;
      const details = {
        stage: 'FACT',
        boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient',
        cause_code: error?.code || null
      };
      if (Array.isArray(schemaValidationErrors) && schemaValidationErrors.length > 0) {
        details.schema_validation_errors = schemaValidationErrors.slice(0, 100);
      }
      const providerAudit = safeFactProviderAudit(error?.audit?.probe_diagnostics);
      if (providerAudit) details.provider_audit = providerAudit;
      if (providerAudit && !providerAudit.provider_adapter_invoked && !providerAudit.fetch_invoked) {
        details.provider_invocation = 'PROVIDER_NOT_INVOKED';
      }
      throw new AppError('FACT_SEMANTIC_EXTRACTION_FAILED', 'Fact semantic extraction failed.', 502, {
        ...details
      });
    }
    const data = result?.envelope?.data;
    const providerAudit = safeFactProviderAudit(result?.audit?.probe_diagnostics);
    try {
      validateTaskData(EVIDENCE_FACT_EXTRACTION_TASK_TYPE, data, payload);
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_SCHEMA_INVALID', 'Fact semantic output failed strict schema validation.', 422, {
        stage: 'FACT',
        boundary: 'SemanticGatewayEvidenceFactExtractor -> validateTaskData',
        cause_code: error?.code || 'OUTPUT_SCHEMA_INVALID',
        ...(providerAudit ? { provider_audit: providerAudit } : {})
      });
    }
    const facts = data.facts.map(candidate => projectEvidenceFactTransportCandidate(candidate, {
      sourceText: payload.source_text
    }));
    // A strict, valid empty result is a successful semantic completion.  The
    // owning service may decide that a source has no enterprise facts only
    // after every eligible window completes; it must not convert this into a
    // transport failure or trigger a retry.
    return attachProviderAudit(facts, providerAudit);
  }

  /**
   * Offline/opt-in Candidate V2 path.  The existing extract() method and its
   * frozen production task remain unchanged until a separate live gate.
   */
  async extractCandidateV2(context = {}, { sourceSnapshot = null, producerVersion = null, diagnosticMode = 'candidate-v2-offline' } = {}) {
    if (!this.client || typeof this.client.run !== 'function') {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact semantic worker is not configured.', 503, { stage: 'FACT' });
    }
    const payload = buildEvidenceFactCandidateV2SemanticInput(context, { sourceSnapshot });
    const instruction = getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE)?.instruction;
    if (!instruction) {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact Candidate V2 task contract is unavailable.', 503, { stage: 'FACT' });
    }
    let result;
    try {
      result = await this.client.run({
        task_type: EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE,
        task_instruction: instruction,
        task_payload_json: JSON.stringify(payload)
      }, { diagnosticMode });
    } catch (error) {
      if (String(error?.code || '').startsWith('FACT_')) throw error;
      throw new AppError('FACT_SEMANTIC_EXTRACTION_FAILED', 'Fact Candidate V2 extraction failed.', 502, {
        stage: 'FACT',
        boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient',
        cause_code: error?.code || null,
        ...(safeFactProviderAudit(error?.audit?.probe_diagnostics)
          ? { provider_audit: safeFactProviderAudit(error?.audit?.probe_diagnostics) } : {})
      });
    }
    const data = result?.envelope?.data;
    const providerAudit = safeFactProviderAudit(result?.audit?.probe_diagnostics);
    try {
      validateTaskData(EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE, data, payload);
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_SCHEMA_INVALID', 'Fact Candidate V2 output failed strict schema validation.', 422, {
        stage: 'FACT',
        boundary: 'SemanticGatewayEvidenceFactExtractor -> validateTaskData',
        cause_code: error?.code || 'OUTPUT_SCHEMA_INVALID',
        ...(providerAudit ? { provider_audit: providerAudit } : {})
      });
    }
    // A valid empty Candidate V2 response is a successful semantic
    // completion. Document-level no-fact conclusions belong to the owning
    // window orchestrator after all eligible windows finish.
    const candidateAudit = {
      task_type: EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V2_TASK_TYPE).instruction_hash,
      schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
      schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
      source_snapshot: safeCandidateV2Snapshot(sourceSnapshot, [
        'material_id', 'material_version', 'source_hash', 'chunk_id', 'chunk_hash',
        'source_span_id', 'source_span_hash', 'approved_review_identity'
      ]),
      producer_version: safeCandidateV2Snapshot(producerVersion, [
        'provider', 'model', 'endpoint', 'protocol', 'thinking', 'reasoning',
        'temperature', 'top_p', 'top_k', 'seed', 'max_output_tokens',
        'prompt_version', 'prompt_hash', 'candidate_schema_version',
        'candidate_schema_hash', 'canonicalizer_version', 'grounding_version'
      ]),
      auto_reextraction: false,
      semantic_empty_retry: 0,
      schema_retry: 0
    };
    return attachCandidateV2Audit(attachProviderAudit(data.facts, providerAudit), candidateAudit);
  }

  /** Opt-in Eval/Canary Candidate V2.1 path; production Fact extraction is unchanged. */
  async extractCandidateV21(context = {}, { sourceSnapshot = null, producerVersion = null, diagnosticMode = 'candidate-v2.1-offline' } = {}) {
    if (!this.client || typeof this.client.run !== 'function') {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact semantic worker is not configured.', 503, { stage: 'FACT' });
    }
    const payload = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot });
    const instruction = getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE)?.instruction;
    if (!instruction) throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact Candidate V2.1 task contract is unavailable.', 503, { stage: 'FACT' });
    let result;
    try {
      result = await this.client.run({
        task_type: EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE,
        task_instruction: instruction,
        task_payload_json: JSON.stringify(payload)
      }, { diagnosticMode });
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_EXTRACTION_FAILED', 'Fact Candidate V2.1 extraction failed.', 502, {
        stage: 'FACT', boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient', cause_code: error?.code || null,
        ...(safeFactProviderAudit(error?.audit?.probe_diagnostics) ? { provider_audit: safeFactProviderAudit(error?.audit?.probe_diagnostics) } : {})
      });
    }
    const data = result?.envelope?.data;
    const providerAudit = safeFactProviderAudit(result?.audit?.probe_diagnostics);
    try {
      validateTaskData(EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE, data);
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_SCHEMA_INVALID', 'Fact Candidate V2.1 output failed strict schema validation.', 422, {
        stage: 'FACT', boundary: 'SemanticGatewayEvidenceFactExtractor -> validateTaskData', cause_code: error?.code || 'OUTPUT_SCHEMA_INVALID',
        ...(providerAudit ? { provider_audit: providerAudit } : {})
      });
    }
    const candidateAudit = {
      task_type: EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V21_TASK_TYPE).instruction_hash,
      schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
      schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
      source_snapshot_id: sourceSnapshot.snapshot_id,
      source_alias_count: Array.isArray(sourceSnapshot.segments) ? sourceSnapshot.segments.length : 0,
      producer_version: safeCandidateV2Snapshot(producerVersion, ['provider', 'model', 'endpoint', 'protocol', 'thinking', 'reasoning', 'temperature', 'top_p', 'top_k', 'seed', 'max_output_tokens']),
      auto_reextraction: false,
      semantic_empty_retry: 0,
      schema_retry: 0
    };
    return attachCandidateV2Audit(attachProviderAudit(data.facts, providerAudit), candidateAudit);
  }

  /** Opt-in Eval Candidate V2.2 path; the existing production Fact contract remains unchanged. */
  async extractCandidateV22(context = {}, { sourceSnapshot = null, producerVersion = null, diagnosticMode = 'candidate-v2.2-offline' } = {}) {
    if (!this.client || typeof this.client.run !== 'function') {
      throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact semantic worker is not configured.', 503, { stage: 'FACT' });
    }
    const payload = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot });
    const instruction = getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE)?.instruction;
    if (!instruction) throw new AppError('FACT_SEMANTIC_UNAVAILABLE', 'Fact Candidate V2.2 task contract is unavailable.', 503, { stage: 'FACT' });
    let result;
    try {
      result = await this.client.run({
        task_type: EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE,
        task_instruction: instruction,
        task_payload_json: JSON.stringify(payload)
      }, { diagnosticMode });
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_EXTRACTION_FAILED', 'Fact Candidate V2.2 extraction failed.', 502, {
        stage: 'FACT', boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient', cause_code: error?.code || null,
        ...(safeFactProviderAudit(error?.audit?.probe_diagnostics) ? { provider_audit: safeFactProviderAudit(error?.audit?.probe_diagnostics) } : {})
      });
    }
    const data = result?.envelope?.data;
    const providerAudit = safeFactProviderAudit(result?.audit?.probe_diagnostics);
    try {
      validateTaskData(EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE, data);
    } catch (error) {
      throw new AppError('FACT_SEMANTIC_SCHEMA_INVALID', 'Fact Candidate V2.2 output failed strict schema validation.', 422, {
        stage: 'FACT', boundary: 'SemanticGatewayEvidenceFactExtractor -> validateTaskData', cause_code: error?.code || 'OUTPUT_SCHEMA_INVALID',
        ...(providerAudit ? { provider_audit: providerAudit } : {})
      });
    }
    const candidateAudit = {
      task_type: EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata(EVIDENCE_FACT_CANDIDATE_V22_TASK_TYPE).instruction_hash,
      schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
      schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
      source_snapshot_id: sourceSnapshot.snapshot_id,
      source_alias_count: Array.isArray(sourceSnapshot.segments) ? sourceSnapshot.segments.length : 0,
      producer_version: safeCandidateV2Snapshot(producerVersion, ['provider', 'model', 'endpoint', 'protocol', 'thinking', 'reasoning', 'temperature', 'top_p', 'top_k', 'seed', 'max_output_tokens']),
      auto_reextraction: false,
      semantic_empty_retry: 0,
      schema_retry: 0
    };
    return attachCandidateV2Audit(attachProviderAudit(data.facts, providerAudit), candidateAudit);
  }
}
