import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  validateTaskData,
  REQUIREMENT_CANDIDATE_SCHEMA,
  REQUIREMENT_CANDIDATE_CATEGORIES,
  REQUIREMENT_EVIDENCE_MAPPING_TRANSPORT_DIMENSIONS
} from '../../../packages/semantic-contracts/index.js';
import { createHash } from 'node:crypto';
import { DEFAULT_GENERATION_CONFIG } from './provider/openai-compatible-provider.js';
import { normalizeEvidenceFactTransportData } from '../../../packages/semantic-contracts/fact-transport-normalizer.js';

const instructionHash = value => createHash('sha256').update(String(value), 'utf8').digest('hex');

function observedCategory(value) {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function mappingSemanticDiagnostic(error, data) {
  if (error?.code !== 'MAPPING_SEMANTIC_INCONSISTENT'
    || !data || typeof data !== 'object' || !Array.isArray(data.results)) return null;
  const path = typeof error.path === 'string' ? error.path : null;
  const match = path?.match(/^data\.results\[(\d+)\]\.decision$/);
  const resultIndex = match ? Number(match[1]) : null;
  const result = Number.isInteger(resultIndex) ? data.results[resultIndex] : null;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const dimensions = Object.fromEntries(REQUIREMENT_EVIDENCE_MAPPING_TRANSPORT_DIMENSIONS.map(name => [
    name,
    typeof result.dimensions?.[name] === 'string' ? result.dimensions[name].slice(0, 40) : null
  ]));
  return {
    result_index: Number.isInteger(resultIndex) ? resultIndex : null,
    response_keys: Object.keys(result).slice(0, 20).map(key => key.slice(0, 80)),
    parsed_semantic_fields: {
      decision: typeof result.decision === 'string' ? result.decision.slice(0, 40) : null,
      dimensions
    },
    exact_failure_path: path,
    consistency_rule: typeof error.consistency_rule === 'string' ? error.consistency_rule : null
  };
}

const REQUIREMENT_CANDIDATE_FIELDS = Object.freeze([...REQUIREMENT_CANDIDATE_SCHEMA.required]);
const REQUIREMENT_CATEGORIES = REQUIREMENT_CANDIDATE_CATEGORIES;
const EVIDENCE_FACT_CANDIDATE_FIELDS = Object.freeze(Object.keys(
  getSemanticTaskContract('evidence_fact_extraction')?.data_schema?.properties?.facts?.items?.properties || {}
));
const DOMAIN_METADATA_NAMESPACE_PATTERN = /^[a-z][a-z0-9_]*$/;

// Task-specific generation budgets are owned by the Gateway task
// configuration path. The Provider remains a generic transport adapter and
// keeps the shared/default budget unchanged.
export const TASK_GENERATION_CONFIG = Object.freeze({
  requirement_extraction: Object.freeze({ max_tokens: 9600 })
});

function positiveMaxTokens(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Resolve one task's generation config from the shared config and its
 * centrally-owned task override. */
export function resolveTaskGenerationConfig(
  taskType,
  configuredGenerationConfig = DEFAULT_GENERATION_CONFIG,
  taskGenerationConfig = TASK_GENERATION_CONFIG
) {
  const configured = configuredGenerationConfig && typeof configuredGenerationConfig === 'object'
    && !Array.isArray(configuredGenerationConfig)
    ? configuredGenerationConfig
    : DEFAULT_GENERATION_CONFIG;
  const resolved = {
    ...DEFAULT_GENERATION_CONFIG,
    ...configured,
    max_tokens: positiveMaxTokens(configured.max_tokens, DEFAULT_GENERATION_CONFIG.max_tokens)
  };
  const override = taskGenerationConfig && typeof taskGenerationConfig === 'object'
    ? taskGenerationConfig[taskType]
    : null;
  if (override && typeof override === 'object' && !Array.isArray(override)) {
    Object.assign(resolved, override);
    resolved.max_tokens = positiveMaxTokens(resolved.max_tokens, DEFAULT_GENERATION_CONFIG.max_tokens);
  }
  return Object.freeze(resolved);
}

function isEmptyPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.keys(value).length === 0;
}

/**
 * Normalize only the provider's information-free Fact namespaces before the
 * shared strict Contract validator runs.  This is intentionally bounded:
 * invalid namespace names and invalid namespace values remain untouched and
 * therefore fail closed in the validator.
 */
export function normalizeEvidenceFactDomainMetadata(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.facts)) {
    return {
      data,
      empty_namespace_count: 0,
      normalizer_invoked: false,
      pre_normalization_fact_keys: [],
      post_normalization_fact_keys: [],
      removed_property_names: [],
      numeric_coercion_count: 0
    };
  }

  let emptyNamespaceCount = 0;
  const preNormalizationFactKeys = data.facts.map(fact => (
    fact && typeof fact === 'object' && !Array.isArray(fact) ? Object.keys(fact).sort() : []
  ));
  const removedPropertyNames = [];
  const facts = data.facts.map((fact) => {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)
      || !fact.domain_metadata || typeof fact.domain_metadata !== 'object'
      || Array.isArray(fact.domain_metadata)) return fact;

    const normalized = {};
    let removedFromFact = 0;
    for (const [namespace, value] of Object.entries(fact.domain_metadata)) {
      if (DOMAIN_METADATA_NAMESPACE_PATTERN.test(namespace) && isEmptyPlainObject(value)) {
        removedFromFact += 1;
        emptyNamespaceCount += 1;
        if (!removedPropertyNames.includes(namespace)) removedPropertyNames.push(namespace);
      } else {
        normalized[namespace] = value;
      }
    }
    return removedFromFact > 0 ? { ...fact, domain_metadata: normalized } : fact;
  });

  const domainNormalizedData = emptyNamespaceCount > 0 ? { ...data, facts } : data;
  const transportNormalized = normalizeEvidenceFactTransportData(domainNormalizedData);
  const normalizedData = transportNormalized.data;
  return {
    data: normalizedData,
    empty_namespace_count: emptyNamespaceCount,
    normalizer_invoked: true,
    pre_normalization_fact_keys: preNormalizationFactKeys,
    post_normalization_fact_keys: normalizedData.facts.map(fact => (
      fact && typeof fact === 'object' && !Array.isArray(fact) ? Object.keys(fact).sort() : []
    )),
    removed_property_names: [...new Set([
      ...removedPropertyNames,
      ...(transportNormalized.removed_property_names || [])
    ])].sort(),
    numeric_coercion_count: transportNormalized.numeric_coercion_count || 0
  };
}

function safeCorrectiveFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const required = ['path', 'keyword', 'expected', 'actual_type'];
  if (required.some(key => typeof value[key] !== 'string' || !value[key].trim())) return null;
  const feedback = Object.fromEntries(required.map(key => [key, value[key].slice(0, 200)]));
  for (const key of ['additional_property', 'missing_property', 'pattern']) {
    if (typeof value[key] === 'string' && value[key].trim()) feedback[key] = value[key].slice(0, 200);
  }
  return feedback;
}

export function buildCorrectiveSchemaGuidance(value) {
  const feedback = safeCorrectiveFeedback(value);
  if (!feedback) return null;
  const details = [
    `path=${feedback.path}`,
    `keyword=${feedback.keyword}`,
    `expected=${feedback.expected}`,
    `actual_type=${feedback.actual_type}`
  ];
  for (const key of ['additional_property', 'missing_property', 'pattern']) {
    if (feedback[key]) details.push(`${key}=${feedback[key]}`);
  }
  return `\n\nThe previous Fact extraction response failed strict validation. Correct only the reported schema issue (${details.join(', ')}), then return the complete evidence_fact_extraction JSON object. Preserve every grounded fact and do not add unsupported fields.`;
}

/**
 * Derive a provider response format from the task contract when that contract
 * owns a canonical data schema.  The schema itself remains owned by
 * packages/semantic-contracts; this helper only adapts it to the generic
 * OpenAI-compatible transport shape.
 */
export function deriveTaskResponseFormat(taskType) {
  const contract = getSemanticTaskContract(taskType);
  if (!contract?.data_schema) return undefined;
  const schemaName = `${String(taskType).replace(/[^A-Za-z0-9_-]/g, '_')}_data`;
  return {
    type: 'json_schema',
    json_schema: {
      name: schemaName,
      strict: true,
      schema: contract.data_schema
    }
  };
}

function requirementValidationDiagnostics(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [{
      path: 'data',
      expected: 'object',
      observed_category: observedCategory(data),
      validator_code: 'type',
      message: 'Task data must be an object.'
    }];
  }
  const dataKeys = Object.keys(data);
  for (const key of dataKeys.filter(key => key !== 'requirements')) {
    errors.push({
      path: `data.${key}`,
      expected: 'no additional properties',
      observed_category: observedCategory(data[key]),
      validator_code: 'additionalProperties',
      message: 'Unsupported task data field.'
    });
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'requirements')) {
    errors.push({
      path: 'data.requirements',
      expected: 'required field',
      observed_category: 'missing',
      validator_code: 'required',
      message: 'Required canonical field is missing.'
    });
    return errors;
  }
  if (!Array.isArray(data.requirements)) {
    errors.push({
      path: 'data.requirements',
      expected: 'array',
      observed_category: observedCategory(data.requirements),
      validator_code: 'type',
      message: 'Requirements must be an array.'
    });
    return errors;
  }
  data.requirements.forEach((candidate, index) => {
    const path = `data.requirements[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push({
        path,
        expected: 'object',
        observed_category: observedCategory(candidate),
        validator_code: 'type',
        message: 'Requirement candidate must be an object.'
      });
      return;
    }
    for (const key of Object.keys(candidate).filter(key => !REQUIREMENT_CANDIDATE_FIELDS.includes(key))) {
      errors.push({
        path: `${path}.${key}`,
        expected: 'no additional properties',
        observed_category: observedCategory(candidate[key]),
        validator_code: 'additionalProperties',
        message: 'Unsupported candidate field.'
      });
    }
    for (const key of REQUIREMENT_CANDIDATE_FIELDS.filter(key => !Object.prototype.hasOwnProperty.call(candidate, key))) {
      errors.push({
        path: `${path}.${key}`,
        expected: 'required field',
        observed_category: 'missing',
        validator_code: 'required',
        message: 'Required candidate field is missing.'
      });
    }
    if (typeof candidate.text !== 'string' || !candidate.text.trim()) {
      errors.push({
        path: `${path}.text`,
        expected: 'non-empty string',
        observed_category: observedCategory(candidate.text),
        validator_code: typeof candidate.text === 'string' ? 'minLength' : 'type',
        message: 'Candidate text must be non-empty text.'
      });
    }
    const sourceRange = candidate.source_range;
    if (!sourceRange || typeof sourceRange !== 'object' || Array.isArray(sourceRange)) {
      errors.push({
        path: `${path}.source_range`,
        expected: 'object with start_ref and end_ref',
        observed_category: observedCategory(sourceRange),
        validator_code: 'type',
        message: 'Candidate source_range must be an object.'
      });
    } else {
      for (const key of Object.keys(sourceRange).filter(key => !['start_ref', 'end_ref'].includes(key))) {
        errors.push({
          path: `${path}.source_range.${key}`, expected: 'no additional properties', observed_category: observedCategory(sourceRange[key]),
          validator_code: 'additionalProperties', message: 'Unsupported source_range field.'
        });
      }
      for (const key of ['start_ref', 'end_ref']) {
        if (!Object.prototype.hasOwnProperty.call(sourceRange, key)) {
          errors.push({
            path: `${path}.source_range.${key}`,
            expected: 'required field', observed_category: 'missing',
            validator_code: 'required', message: 'Candidate source_range endpoint is required.'
          });
        } else if (typeof sourceRange[key] !== 'string' || !/^C\d{3}-S\d{3}$/.test(sourceRange[key])) {
          errors.push({
            path: `${path}.source_range.${key}`,
            expected: 'Cxxx-Sxxx string', observed_category: observedCategory(sourceRange[key]),
            validator_code: 'pattern', message: 'Candidate source_range endpoint is not a deterministic span reference.'
          });
        }
      }
    }
    if (typeof candidate.category !== 'string' || !REQUIREMENT_CATEGORIES.includes(candidate.category)) {
      errors.push({
        path: `${path}.category`,
        expected: `one of: ${REQUIREMENT_CATEGORIES.join(', ')}`,
        observed_category: observedCategory(candidate.category),
        validator_code: 'enum',
        message: 'Candidate category is not a canonical enum value.'
      });
    }
    for (const key of ['mandatory_observed', 'requires_confirmation']) {
      if (typeof candidate[key] !== 'boolean') {
        errors.push({
          path: `${path}.${key}`,
          expected: 'boolean',
          observed_category: observedCategory(candidate[key]),
          validator_code: 'type',
          message: `Candidate ${key} must be boolean.`
        });
      }
    }
  });
  return errors;
}

function valueAtPath(data, path) {
  const tokens = String(path || '')
    .replace(/^data\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current = data;
  for (const token of tokens) {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(Object(current), token)) return undefined;
    current = current[token];
  }
  return current;
}

function projectEvidenceFactData(data) {
  const normalized = normalizeEvidenceFactDomainMetadata(data);
  const normalizedData = normalized.data;
  if (!normalizedData || typeof normalizedData !== 'object' || Array.isArray(normalizedData) || !Array.isArray(normalizedData.facts)) {
    return {
      data: normalizedData,
      unknownFields: [],
      emptyNamespaceCount: normalized.empty_namespace_count,
      normalizerInvoked: normalized.normalizer_invoked,
      preNormalizationFactKeys: normalized.pre_normalization_fact_keys,
      postNormalizationFactKeys: normalized.post_normalization_fact_keys,
      removedPropertyNames: normalized.removed_property_names,
      numericCoercionCount: normalized.numeric_coercion_count || 0
    };
  }
  const unknownFields = [];
  normalizedData.facts.forEach(fact => {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return fact;
    for (const [key] of Object.entries(fact)) {
      if (EVIDENCE_FACT_CANDIDATE_FIELDS.includes(key)) continue;
      else if (!unknownFields.includes(key)) unknownFields.push(key);
    }
  });
  // Strict Fact output must be validated as returned.  Do not silently drop
  // unknown fields: doing so would turn legacy/contaminated output into a
  // different candidate than the Provider emitted.
  return {
    data: normalizedData,
    unknownFields,
    emptyNamespaceCount: normalized.empty_namespace_count,
    normalizerInvoked: normalized.normalizer_invoked,
    preNormalizationFactKeys: normalized.pre_normalization_fact_keys,
    postNormalizationFactKeys: normalized.post_normalization_fact_keys,
    removedPropertyNames: normalized.removed_property_names,
    numericCoercionCount: normalized.numeric_coercion_count || 0
  };
}

function factValidationDiagnostics(error, data) {
  const message = String(error?.message || '');
  const path = message.match(/^(?:missing )?(data\.[^ ]+)/)?.[1] || 'data';
  const actual = valueAtPath(data, path);
  const actualType = actual === undefined ? 'missing' : observedCategory(actual);
  let keyword = 'OUTPUT_SCHEMA_INVALID';
  let expected = 'canonical task data';

  if (/missing data\./.test(message)) {
    keyword = 'required';
    expected = 'required field';
  } else if (/contains unsupported fields/.test(message)) {
    keyword = 'additionalProperties';
    expected = 'no additional properties';
  } else if (/must be an object/.test(message)) {
    keyword = 'type';
    expected = 'object';
  } else if (/must be an array/.test(message)) {
    keyword = 'type';
    expected = 'array';
  } else if (/must be non-empty text/.test(message)) {
    keyword = actualType === 'string' ? 'minLength' : 'type';
    expected = 'non-empty string';
  } else if (/must be a canonical Evidence Fact status|status invalid|enum invalid/.test(message)) {
    keyword = 'enum';
    expected = 'canonical enum value';
  } else if (/must be exact decimal text|invalid$/.test(message)) {
    keyword = 'pattern';
    expected = 'canonical value format';
  } else if (/must use non-empty object namespaces/.test(message)) {
    keyword = 'shape';
    expected = 'non-empty object namespaces';
  }

  return [{
    stage: 'FACT',
    path,
    keyword,
    expected,
    actual_type: actualType,
    additional_property: typeof error?.additionalProperty === 'string' ? error.additionalProperty : null,
    message: 'Semantic Fact candidate failed the canonical task schema.'
  }];
}

function validationDiagnostics(error, data, taskType) {
  if (taskType === 'requirement_extraction') return requirementValidationDiagnostics(data);
  if (taskType === 'evidence_fact_extraction') return factValidationDiagnostics(error, data);
  if (taskType === 'requirement_evidence_mapping' && error?.code === 'MAPPING_SEMANTIC_INCONSISTENT') {
    const path = typeof error.path === 'string' ? error.path : 'data';
    const actual = valueAtPath(data, path);
    const actualType = observedCategory(actual);
    return [{
      stage: 'MAPPING',
      path,
      expected: typeof error.consistency_rule === 'string' ? error.consistency_rule : 'frozen mapping consistency rule',
      observed_category: actualType,
      actual_type: actualType,
      keyword: error.keyword || 'semanticConsistency',
      validator_code: error.code,
      message: 'Mapping semantic output failed a frozen consistency rule.'
    }];
  }
  const message = String(error?.message || 'schema validation failed');
  const envelopeLike = data && typeof data === 'object' && !Array.isArray(data)
    && Object.prototype.hasOwnProperty.call(data, 'schema_version')
    && Object.prototype.hasOwnProperty.call(data, 'task_type')
    && Object.prototype.hasOwnProperty.call(data, 'data');
  if (envelopeLike) {
    return [{
      path: 'provider.data',
      expected: 'object containing assessments and conflict_observations',
      observed_category: 'gateway_envelope',
      validator_code: 'ENVELOPE_ERROR',
      message: 'Provider returned a Gateway envelope where task data was required.'
    }];
  }
  const missing = message.match(/^missing (data\.[A-Za-z0-9_.\[\]-]+)/);
  if (missing) return [{
    path: missing[1],
    expected: 'required field',
    observed_category: 'missing',
    validator_code: 'required',
    message: 'Required canonical field is missing.'
  }];
  const pathMatch = message.match(/^(data\.[^ ]+)/);
  const path = pathMatch?.[1] || 'data';
  const actual = valueAtPath(data, path);
  const actualType = observedCategory(actual);
  let keyword = 'OUTPUT_SCHEMA_INVALID';
  let expected = 'canonical task data';
  if (/contains unsupported fields|unsupported fields|additional/i.test(message)) {
    keyword = 'additionalProperties';
    expected = 'no additional properties';
  } else if (/must be an array/.test(message)) {
    keyword = 'type';
    expected = 'array';
  } else if (/must be a string/.test(message)) {
    keyword = 'type';
    expected = 'string';
  } else if (/must be non-empty text/.test(message)) {
    keyword = 'minLength';
    expected = 'non-empty string';
  } else if (/must not be empty/.test(message)) {
    keyword = 'minItems';
    expected = 'non-empty array';
  }
  return [{
    path,
    expected,
    observed_category: actualType,
    actual_type: actualType,
    keyword,
    validator_code: keyword,
    safe_offending_fragment: actual && typeof actual === 'object'
      ? JSON.stringify(Array.isArray(actual) ? { type: 'array', length: actual.length } : { keys: Object.keys(actual).slice(0, 20) })
      : actual === undefined ? 'missing' : String(actual).slice(0, 160),
    message: 'Canonical task data failed strict validation.'
  }];
}

/**
 * The task router is the only place where a semantic task is dispatched to a
 * provider. It deliberately ignores caller-supplied instructions: prompts are
 * gateway-owned and task-specific source text is data, not executable policy.
 */
export function createSemanticTaskRouter({
  provider,
  providers = null,
  generationConfig = DEFAULT_GENERATION_CONFIG,
  taskGenerationConfig = TASK_GENERATION_CONFIG
} = {}) {
  if (!provider || typeof provider.invoke !== 'function') {
    throw new Error('Semantic task router requires a provider adapter.');
  }
  const providerForTask = taskType => {
    const taskProvider = providers && typeof providers === 'object'
      ? providers[taskType]
      : null;
    return taskProvider && typeof taskProvider.invoke === 'function'
      ? taskProvider
      : provider;
  };
  return {
    async dispatch({ taskType, payload, contractVersion = null, instructionHash: requestedInstructionHash = null }) {
      const contract = getSemanticTaskContract(taskType);
      if (!contract) throw Object.assign(new Error('task unsupported'), { code: 'TASK_UNSUPPORTED' });
      const instructionMetadata = getSemanticTaskInstructionMetadata(taskType);
      const instruction = instructionMetadata?.instruction;
      if (!instruction || !instructionMetadata?.instruction_hash || instructionHash(instruction) !== instructionMetadata.instruction_hash) {
        throw Object.assign(new Error('semantic task contract instruction hash mismatch'), { code: 'SEMANTIC_CONTRACT_DRIFT' });
      }
      if ((contractVersion && contractVersion !== contract.contract_version)
        || (requestedInstructionHash && requestedInstructionHash !== instructionMetadata.instruction_hash)) {
        throw Object.assign(new Error('semantic task contract metadata mismatch'), { code: 'SEMANTIC_CONTRACT_DRIFT' });
      }
      const resolvedGenerationConfig = resolveTaskGenerationConfig(
        taskType,
        generationConfig,
        taskGenerationConfig
      );
      const configuredDefaultMaxTokens = positiveMaxTokens(
        generationConfig?.max_tokens,
        DEFAULT_GENERATION_CONFIG.max_tokens
      );
      const taskOverrideApplied = Boolean(
        taskGenerationConfig
        && typeof taskGenerationConfig === 'object'
        && Object.prototype.hasOwnProperty.call(taskGenerationConfig, taskType)
      );
      const response_format = deriveTaskResponseFormat(taskType);
      const correctiveGuidance = taskType === 'evidence_fact_extraction'
        ? buildCorrectiveSchemaGuidance(payload?.validation_feedback)
        : null;
      const effectiveInstruction = correctiveGuidance ? `${instruction}${correctiveGuidance}` : instruction;
      const invocationPayload = taskType === 'evidence_fact_extraction'
        && payload && typeof payload === 'object' && !Array.isArray(payload)
        ? {
          ...payload,
          ...(correctiveGuidance
            ? { validation_feedback: safeCorrectiveFeedback(payload.validation_feedback) }
            : {})
        }
        : payload;
      if (taskType === 'evidence_fact_extraction' && invocationPayload && !correctiveGuidance) {
        delete invocationPayload.validation_feedback;
      }
      const invocation = {
        taskType,
        instruction: effectiveInstruction,
        payload: invocationPayload,
        generation_config: resolvedGenerationConfig
      };
      if (response_format) invocation.response_format = response_format;
      const taskProvider = providerForTask(taskType);
      const providerResult = await taskProvider.invoke(invocation);
      const projection = taskType === 'evidence_fact_extraction'
        ? projectEvidenceFactData(providerResult?.data)
        : { data: providerResult?.data, unknownFields: [] };
      const providerAudit = {
        ...(providerResult?.provider_audit || {}),
        task_type: taskType,
        configured_default_max_tokens: configuredDefaultMaxTokens,
        task_override_applied: taskOverrideApplied,
        resolved_max_output_tokens: resolvedGenerationConfig.max_tokens,
        ...(correctiveGuidance ? { corrective_feedback_applied: true } : {}),
        ...(taskType === 'evidence_fact_extraction'
          ? {
            empty_domain_namespace_normalized_count: projection.emptyNamespaceCount,
            fact_normalization_diagnostic: {
              projection_invoked: true,
              normalizer_invoked: projection.normalizerInvoked === true,
              pre_normalization_fact_keys: projection.preNormalizationFactKeys,
              post_normalization_fact_keys: projection.postNormalizationFactKeys,
              unexpected_property_names: projection.unknownFields,
              allowed_property_names: EVIDENCE_FACT_CANDIDATE_FIELDS,
              removed_property_names: projection.removedPropertyNames,
              numeric_coercion_count: projection.numericCoercionCount,
              exact_validation_path: null
            }
          }
          : {}),
        ...(projection.unknownFields.length > 0 ? {
          fact_semantic_diagnostic: {
            stage: 'FACT',
            diagnostic: 'FACT_SEMANTIC_UNKNOWN_FIELDS_REJECTED',
            unknown_fields: projection.unknownFields.slice(0, 100)
          }
        } : {})
      };
      let data;
      try {
        data = validateTaskData(taskType, projection.data, invocationPayload);
      } catch (error) {
        error.provider_audit = providerAudit;
        const mappingDiagnostic = mappingSemanticDiagnostic(error, projection.data);
        if (mappingDiagnostic) providerAudit.mapping_semantic_diagnostic = mappingDiagnostic;
        error.validation_diagnostics = validationDiagnostics(error, projection.data, taskType);
        if (taskType === 'evidence_fact_extraction' && providerAudit.fact_normalization_diagnostic) {
          providerAudit.fact_normalization_diagnostic.exact_validation_path = error.validation_diagnostics?.[0]?.path || null;
        }
        if (!error.code) {
          error.code = error.message.includes('source-bound')
            ? 'SUPPORT_SPAN_INVALID'
            : taskType === 'requirement_evidence_mapping'
              ? 'MAPPING_OUTPUT_SCHEMA_INVALID'
              : 'OUTPUT_SCHEMA_INVALID';
        }
        throw error;
      }
      return {
        data,
        provider_audit: {
          ...providerAudit,
          semantic_contract_version: contract.contract_version,
          instruction_sha256: instructionMetadata.instruction_hash,
          ...(correctiveGuidance ? { corrective_feedback_applied: true } : {})
        }
      };
    }
  };
}
