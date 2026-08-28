import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  validateTaskData,
  REQUIREMENT_CANDIDATE_SCHEMA,
  REQUIREMENT_CANDIDATE_CATEGORIES
} from '../../../packages/semantic-contracts/index.js';
import { createHash } from 'node:crypto';

const instructionHash = value => createHash('sha256').update(String(value), 'utf8').digest('hex');

function observedCategory(value) {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

const REQUIREMENT_CANDIDATE_FIELDS = Object.freeze([...REQUIREMENT_CANDIDATE_SCHEMA.required]);
const REQUIREMENT_CATEGORIES = REQUIREMENT_CANDIDATE_CATEGORIES;

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

function validationDiagnostics(error, data, taskType) {
  if (taskType === 'requirement_extraction') return requirementValidationDiagnostics(data);
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
  return [{
    path: pathMatch?.[1] || 'data',
    expected: 'canonical task data',
    observed_category: observedCategory(data),
    validator_code: 'OUTPUT_SCHEMA_INVALID',
    message: 'Canonical task data failed strict validation.'
  }];
}

/**
 * The task router is the only place where a semantic task is dispatched to a
 * provider. It deliberately ignores caller-supplied instructions: prompts are
 * gateway-owned and task-specific source text is data, not executable policy.
 */
export function createSemanticTaskRouter({ provider } = {}) {
  if (!provider || typeof provider.invoke !== 'function') {
    throw new Error('Semantic task router requires a provider adapter.');
  }
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
      const response_format = deriveTaskResponseFormat(taskType);
      const invocation = { taskType, instruction, payload };
      if (response_format) invocation.response_format = response_format;
      const providerResult = await provider.invoke(invocation);
      let data;
      try {
        data = validateTaskData(taskType, providerResult?.data, payload);
      } catch (error) {
        error.provider_audit = providerResult?.provider_audit || null;
        error.validation_diagnostics = validationDiagnostics(error, providerResult?.data, taskType);
        if (!error.code) {
          error.code = error.message.includes('source-bound')
            ? 'SUPPORT_SPAN_INVALID'
            : 'OUTPUT_SCHEMA_INVALID';
        }
        throw error;
      }
      return {
        data,
        provider_audit: {
          ...(providerResult?.provider_audit || {}),
          semantic_contract_version: contract.contract_version,
          instruction_sha256: instructionMetadata.instruction_hash
        }
      };
    }
  };
}
