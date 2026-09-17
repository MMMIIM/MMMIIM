import { SemanticGatewayError } from './semantic-gateway-client.js';
import {
  EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION,
  EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE
} from './semantic-gateway-task-registry.js';
import {
  EVIDENCE_SUPPORT_OBSERVATION_TYPES,
  EVIDENCE_SUPPORT_REASON_CODES,
  getEvidenceSupportInvariantViolation
} from './evidence-support-assessment-contract-v1.js';
import {
  EVIDENCE_CAPABILITY,
  EVIDENCE_SUPPORT_LEVEL,
  REVIEW_DIMENSION_VALUES,
  REVIEW_DIMENSIONS,
  SEMANTIC_RELEVANCE
} from './evidence-review-contract.js';
import { MAPPING_RELATIONSHIPS } from './requirement-evidence-mapping-contract-v1.js';
import { resolveSemanticTaskInstruction } from '../../../packages/semantic-contracts/index.js';
import { hashSource } from './source-location-resolver.js';

export { EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION, EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE };

export const EVIDENCE_SUPPORT_GATEWAY_INSTRUCTION = resolveSemanticTaskInstruction(
  EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE
);

const SHA256 = /^[0-9a-f]{64}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const exactSourceText = value => typeof value === 'string' ? value : String(value ?? '');
const hash = hashSource;
const unique = values => [...new Set(values)];

function contractError(code, message, audit = {}) {
  return new SemanticGatewayError(code, message, { ...audit, error_classification: code }, 422);
}

function exactKeys(value, allowed, name, audit) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw contractError('SCHEMA_INVALID', `${name} 字段不符合严格契约。`, audit);
  }
}

function requiredText(value, name, audit) {
  const result = text(value);
  if (!result) throw contractError('SCHEMA_INVALID', `${name} 不能为空。`, audit);
  return result;
}

function oneOf(value, allowed, name, audit) {
  if (!allowed.includes(value)) throw contractError('SCHEMA_INVALID', `${name} 枚举值无效。`, audit);
  return value;
}

function reasonCodes(value, name, audit) {
  if (!Array.isArray(value)) throw contractError('SCHEMA_INVALID', `${name} 必须是数组。`, audit);
  const codes = unique(value.map(code => requiredText(code, `${name}[]`, audit)));
  for (const code of codes) {
    if (!EVIDENCE_SUPPORT_REASON_CODES.includes(code)) {
      throw contractError('SCHEMA_INVALID', `${name} 包含未注册 reason code。`, audit);
    }
  }
  return codes;
}

function normalizedRequirement(requirement, audit) {
  if (!object(requirement)) throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', 'requirement 必须是对象。', audit);
  return {
    requirement_id: requiredText(requirement.requirement_id ?? requirement.req_id, 'requirement.requirement_id', audit),
    requirement_text: requiredText(requirement.requirement_text ?? requirement.text, 'requirement.requirement_text', audit)
  };
}

function sourceTextFromAdapter(sourceRecord) {
  return sourceRecord?._source_text
    || sourceRecord?.source_text
    || sourceRecord?.source?.source_text
    || '';
}

function normalizedSource(sourceRecord, index, audit) {
  const source = sourceRecord?.source || sourceRecord;
  if (!object(source)) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', `sources[${index}] 必须是对象。`, audit);
  }
  const sourceText = exactSourceText(sourceTextFromAdapter(sourceRecord));
  if (!sourceText.trim()) throw contractError('SCHEMA_INVALID', `sources[${index}].source_text 不能为空。`, audit);
  const sourceId = requiredText(source.source_id, `sources[${index}].source_id`, audit);
  const sourceSpanId = requiredText(source.source_span_id, `sources[${index}].source_span_id`, audit);
  const sourceKind = oneOf(source.source_kind, ['retrieval_candidate', 'evidence_fact'], `sources[${index}].source_kind`, audit);
  const actualHash = hash(sourceText);
  if (source.source_text_hash && (!SHA256.test(String(source.source_text_hash)) || source.source_text_hash !== actualHash)) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', `sources[${index}] source_text_hash 不一致。`, audit);
  }
  const material = object(source.material) ? source.material : (object(sourceRecord.material) ? sourceRecord.material : {});
  const lineage = object(source.lineage) ? source.lineage : (object(sourceRecord.lineage) ? sourceRecord.lineage : {});
  return {
    source_id: sourceId,
    source_kind: sourceKind,
    source_span_id: sourceSpanId,
    source_text: sourceText,
    source_text_hash: actualHash,
    material_type: source.material_type ?? material.material_type ?? null,
    content_role: source.content_role ?? material.content_role ?? null,
    lineage: structuredClone(lineage)
  };
}

export function createEvidenceSupportGatewayInput({ requirement, adapters, sources } = {}) {
  const sourceRecords = Array.isArray(adapters) && adapters.length ? adapters : sources;
  const audit = { provider: 'semantic_gateway', task_type: EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE };
  if (!Array.isArray(sourceRecords) || sourceRecords.length < 1) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', '至少需要一个 Source。', audit);
  }
  const normalizedSources = sourceRecords.map((sourceRecord, index) => normalizedSource(sourceRecord, index, audit));
  if (new Set(normalizedSources.map(source => source.source_id)).size !== normalizedSources.length) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', 'source_id 必须唯一。', audit);
  }
  if (new Set(normalizedSources.map(source => source.source_span_id)).size !== normalizedSources.length) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', 'source_span_id 必须唯一。', audit);
  }
  const normalizedReq = normalizedRequirement(
    requirement || sourceRecords[0]?.requirement,
    audit
  );
  for (const sourceRecord of sourceRecords.slice(1)) {
    const sourceRequirement = sourceRecord?.requirement;
    if (sourceRequirement && (
      sourceRequirement.requirement_id !== normalizedReq.requirement_id
      || (sourceRequirement.text ?? sourceRequirement.requirement_text) !== normalizedReq.requirement_text
    )) {
      throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', '所有 Source 必须绑定同一 Requirement。', audit);
    }
  }
  return {
    contract_version: EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION,
    requirement: normalizedReq,
    sources: normalizedSources
  };
}

export function serializeEvidenceSupportGatewayInput(input) {
  if (!object(input) || input.contract_version !== EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', '输入不是当前 Evidence Support Gateway Contract。');
  }
  return JSON.stringify(input);
}

function validateDimensions(value, audit) {
  if (!object(value) || Object.keys(value).length !== REVIEW_DIMENSIONS.length
    || REVIEW_DIMENSIONS.some(name => !Object.prototype.hasOwnProperty.call(value, name))) {
    throw contractError('SCHEMA_INVALID', 'review_dimensions 必须完整且不能含未知字段。', audit);
  }
  return Object.fromEntries(REVIEW_DIMENSIONS.map(name => [
    name,
    oneOf(value[name], REVIEW_DIMENSION_VALUES, `review_dimensions.${name}`, audit)
  ]));
}

function sourceFor(sourceId, sourceSpanId, input, name, audit) {
  const source = input.sources.find(item => item.source_id === sourceId);
  if (!source) throw contractError('SCHEMA_INVALID', `${name}.source_id 不属于本次输入。`, audit);
  if (source.source_span_id !== sourceSpanId) {
    throw contractError('SCHEMA_INVALID', `${name}.source_span_id 与 source_id 不匹配。`, audit);
  }
  return source;
}

function validateSupportObservation(value, parentSource, input, name, audit) {
  exactKeys(value, ['source_id', 'source_span_id', 'support_excerpt', 'observation_type', 'reason_codes'], name, audit);
  if (value.source_id !== parentSource.source_id || value.source_span_id !== parentSource.source_span_id) {
    throw contractError('SUPPORT_SPAN_INVALID', `${name} 不能引用当前 assessment 之外的 Source。`, audit);
  }
  const source = sourceFor(value.source_id, value.source_span_id, input, name, audit);
  const excerpt = requiredText(value.support_excerpt, `${name}.support_excerpt`, audit);
  if (!source.source_text.includes(excerpt)) {
    throw contractError('SUPPORT_SPAN_INVALID', `${name}.support_excerpt 不在 source_text 中。`, audit);
  }
  oneOf(value.observation_type, EVIDENCE_SUPPORT_OBSERVATION_TYPES, `${name}.observation_type`, audit);
  reasonCodes(value.reason_codes, `${name}.reason_codes`, audit);
  return { ...value, support_excerpt: excerpt };
}

const assessmentKeys = [
  'source_id', 'source_span_id', 'semantic_relevance', 'evidence_capability',
  'support_level', 'semantic_relationship', 'review_dimensions', 'reason_codes',
  'support_observations'
];

function validateAssessment(value, input, index, audit) {
  const name = `data.assessments[${index}]`;
  exactKeys(value, assessmentKeys, name, audit);
  const source = sourceFor(value.source_id, value.source_span_id, input, name, audit);
  const relevance = oneOf(value.semantic_relevance, SEMANTIC_RELEVANCE, `${name}.semantic_relevance`, audit);
  const capability = oneOf(value.evidence_capability, EVIDENCE_CAPABILITY, `${name}.evidence_capability`, audit);
  const support = oneOf(value.support_level, EVIDENCE_SUPPORT_LEVEL, `${name}.support_level`, audit);
  const relationship = oneOf(value.semantic_relationship, MAPPING_RELATIONSHIPS, `${name}.semantic_relationship`, audit);
  if (!Array.isArray(value.support_observations)) {
    throw contractError('SCHEMA_INVALID', `${name}.support_observations 必须是数组。`, audit);
  }
  // Cross-field business invariant. Do not relax independently from the
  // canonical assessment factory. See ADR-020.
  const invariantViolation = getEvidenceSupportInvariantViolation({
    semanticRelevance: relevance,
    evidenceCapability: capability,
    supportLevel: support,
    semanticRelationship: relationship
  });
  if (invariantViolation) throw contractError('SCHEMA_INVALID', `${name} ${invariantViolation}。`, audit);
  return {
    ...value,
    source_id: source.source_id,
    source_span_id: source.source_span_id,
    review_dimensions: validateDimensions(value.review_dimensions, audit),
    reason_codes: reasonCodes(value.reason_codes, `${name}.reason_codes`, audit),
    support_observations: value.support_observations.map((item, itemIndex) => validateSupportObservation(
      item, source, input, `${name}.support_observations[${itemIndex}]`, audit
    ))
  };
}

const conflictKeys = ['conflict_group_id', 'dimension', 'sources', 'reason_codes'];
const conflictSourceKeys = ['source_id', 'source_span_id', 'observed_value', 'support_excerpt'];

/**
 * Canonical provider-facing JSON Schema for the Evidence Support task.
 *
 * This is derived from the same enums and field lists used by the strict
 * Gateway validator below.  It is intentionally a transport schema only:
 * the Task Router remains authoritative and still validates every response.
 */
export function deriveEvidenceSupportProviderSchema() {
  const stringEnum = values => ({ type: 'string', enum: [...values] });
  const supportObservation = {
    type: 'object',
    additionalProperties: false,
    required: ['source_id', 'source_span_id', 'support_excerpt', 'observation_type', 'reason_codes'],
    properties: {
      source_id: { type: 'string' },
      source_span_id: { type: 'string' },
      support_excerpt: { type: 'string' },
      observation_type: stringEnum(EVIDENCE_SUPPORT_OBSERVATION_TYPES),
      reason_codes: { type: 'array', items: stringEnum(EVIDENCE_SUPPORT_REASON_CODES) }
    }
  };
  const assessment = {
    type: 'object',
    additionalProperties: false,
    required: assessmentKeys,
    properties: {
      source_id: { type: 'string' },
      source_span_id: { type: 'string' },
      semantic_relevance: stringEnum(SEMANTIC_RELEVANCE),
      evidence_capability: stringEnum(EVIDENCE_CAPABILITY),
      support_level: stringEnum(EVIDENCE_SUPPORT_LEVEL),
      semantic_relationship: stringEnum(MAPPING_RELATIONSHIPS),
      review_dimensions: {
        type: 'object',
        additionalProperties: false,
        required: [...REVIEW_DIMENSIONS],
        properties: Object.fromEntries(REVIEW_DIMENSIONS.map(name => [name, stringEnum(REVIEW_DIMENSION_VALUES)]))
      },
      reason_codes: { type: 'array', items: stringEnum(EVIDENCE_SUPPORT_REASON_CODES) },
      support_observations: { type: 'array', items: supportObservation }
    }
  };
  const conflictSource = {
    type: 'object',
    additionalProperties: false,
    required: conflictSourceKeys,
    properties: {
      source_id: { type: 'string' },
      source_span_id: { type: 'string' },
      observed_value: {},
      support_excerpt: { type: 'string' }
    }
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['assessments', 'conflict_observations'],
    properties: {
      assessments: { type: 'array', items: assessment },
      conflict_observations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: conflictKeys,
          properties: {
            conflict_group_id: { type: 'string' },
            dimension: { type: 'string' },
            sources: { type: 'array', minItems: 2, items: conflictSource },
            reason_codes: { type: 'array', items: stringEnum(EVIDENCE_SUPPORT_REASON_CODES) }
          }
        }
      }
    }
  };
}

export const EVIDENCE_SUPPORT_PROVIDER_JSON_SCHEMA = deriveEvidenceSupportProviderSchema();

function validateConflict(value, input, index, audit) {
  const name = `data.conflict_observations[${index}]`;
  exactKeys(value, conflictKeys, name, audit);
  requiredText(value.conflict_group_id, `${name}.conflict_group_id`, audit);
  requiredText(value.dimension, `${name}.dimension`, audit);
  reasonCodes(value.reason_codes, `${name}.reason_codes`, audit);
  if (!Array.isArray(value.sources) || value.sources.length < 2) {
    throw contractError('SCHEMA_INVALID', `${name}.sources 至少需要两个 Source。`, audit);
  }
  const seen = new Set();
  const observed = [];
  const sources = value.sources.map((item, sourceIndex) => {
    const sourceName = `${name}.sources[${sourceIndex}]`;
    exactKeys(item, conflictSourceKeys, sourceName, audit);
    const source = sourceFor(item.source_id, item.source_span_id, input, sourceName, audit);
    if (seen.has(source.source_id)) throw contractError('SCHEMA_INVALID', `${name} 不能重复同一 Source。`, audit);
    seen.add(source.source_id);
    if (!Object.prototype.hasOwnProperty.call(item, 'observed_value')) {
      throw contractError('SCHEMA_INVALID', `${sourceName}.observed_value 必须存在。`, audit);
    }
    const excerpt = requiredText(item.support_excerpt, `${sourceName}.support_excerpt`, audit);
    if (!source.source_text.includes(excerpt)) {
      throw contractError('SUPPORT_SPAN_INVALID', `${sourceName}.support_excerpt 不在 source_text 中。`, audit);
    }
    observed.push(JSON.stringify(item.observed_value));
    return { ...item, support_excerpt: excerpt };
  });
  if (new Set(observed).size < 2) {
    throw contractError('SCHEMA_INVALID', `${name} 必须表达至少两个不同观察值。`, audit);
  }
  return { ...value, sources };
}

export function validateEvidenceSupportGatewayResponse(gatewayResponse, input) {
  const envelope = gatewayResponse?.envelope;
  const audit = gatewayResponse?.audit || { provider: 'semantic_gateway', task_type: EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE };
  if (!object(envelope) || envelope.schema_version !== EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION
    || envelope.task_type !== EVIDENCE_SUPPORT_GATEWAY_TASK_TYPE) {
    throw contractError('ENVELOPE_INVALID', 'Evidence Support Gateway envelope 不符合正式版本。', audit);
  }
  if (envelope.status !== 'success') {
    throw new SemanticGatewayError('PROVIDER_FAILURE', 'Evidence Support Gateway provider 返回失败状态。', {
      ...audit,
      error_classification: 'PROVIDER_FAILURE'
    }, 502);
  }
  if (!object(input) || input.contract_version !== EVIDENCE_SUPPORT_GATEWAY_CONTRACT_VERSION) {
    throw contractError('EVIDENCE_SUPPORT_INPUT_INVALID', '缺少对应的 Gateway 输入快照。', audit);
  }
  const data = envelope.data;
  if (!object(data) || Object.keys(data).some(key => !['assessments', 'conflict_observations'].includes(key))
    || !Array.isArray(data.assessments) || !Array.isArray(data.conflict_observations)) {
    throw contractError('SCHEMA_INVALID', 'data 只能包含 assessments 和 conflict_observations 数组。', audit);
  }
  if (data.assessments.length !== input.sources.length) {
    throw contractError('SCHEMA_INVALID', '每个输入 Source 必须且只能有一个 assessment。', audit);
  }
  const assessmentIds = new Set();
  const assessments = data.assessments.map((item, index) => {
    const result = validateAssessment(item, input, index, audit);
    if (assessmentIds.has(result.source_id)) throw contractError('SCHEMA_INVALID', 'assessment source_id 重复。', audit);
    assessmentIds.add(result.source_id);
    return result;
  });
  if (assessmentIds.size !== input.sources.length
    || input.sources.some(source => !assessmentIds.has(source.source_id))) {
    throw contractError('SCHEMA_INVALID', 'assessment 未覆盖全部输入 Source。', audit);
  }
  const conflictObservations = data.conflict_observations.map((item, index) => validateConflict(item, input, index, audit));
  return { assessments, conflict_observations: conflictObservations, warnings: envelope.warnings, audit };
}
