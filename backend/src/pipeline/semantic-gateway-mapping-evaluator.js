import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
import {
  getSemanticTaskInstructionMetadata,
  getSemanticTaskContract,
  validateTaskData,
  REQUIREMENT_EVIDENCE_MAPPING_TRANSPORT_SCHEMA
} from '../../../packages/semantic-contracts/index.js';
import {
  applyMappingDecisionPolicy,
  applyDeterministicMappingOverrides,
  projectMappingTransportResult,
  MAPPING_DECISION_POLICY_VERSION
} from './mapping-decision-policy-v1.js';
import { createMappingRequirementView } from './mapping-candidate-builder.js';
import { REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION } from './requirement-evidence-mapping-contract-v1.js';

export { projectMappingTransportResult as projectMappingResult } from './mapping-decision-policy-v1.js';

export const MAPPING_TASK_TYPE = 'requirement_evidence_mapping';
export const MAPPING_TASK_CONTRACT_VERSION = '4.3-requirement-evidence-mapping-v1';

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const mappingTask = getSemanticTaskContract(MAPPING_TASK_TYPE);
const mappingInstruction = getSemanticTaskInstructionMetadata(MAPPING_TASK_TYPE);
const mappingTransportSchemaHash = sha256(JSON.stringify(REQUIREMENT_EVIDENCE_MAPPING_TRANSPORT_SCHEMA));
export const MAPPING_SEMANTIC_EVALUATOR_IDENTITY = `mapping-semantic-evaluator-v1:${sha256(JSON.stringify({
  task_contract_version: mappingTask?.contract_version || MAPPING_TASK_CONTRACT_VERSION,
  instruction_hash: mappingInstruction?.instruction_hash || null,
  transport_schema_hash: mappingTransportSchemaHash,
  canonical_mapping_contract_version: REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION,
  decision_policy_version: MAPPING_DECISION_POLICY_VERSION,
  applicability_projection_version: 'evidence-need-profile-v1'
}))}`;

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function requiredIdentity(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('MAPPING_INPUT_INVALID', `Mapping input 缺少 ${label}。`, 422);
  }
  return value;
}

function safeDiagnosticScalar(value, maxLength = 240) {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

function boundedGatewayDiagnostics(audit) {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return null;
  return {
    gateway_http_status: Number.isInteger(audit.gateway_http_status)
      ? audit.gateway_http_status : Number.isInteger(audit.http_status) ? audit.http_status : null,
    gateway_error_code: safeDiagnosticScalar(audit.gateway_error_code, 120),
    semantic_error_code: safeDiagnosticScalar(audit.semantic_error_code, 120),
    request_id: safeDiagnosticScalar(audit.request_id, 128),
    probe_diagnostics: audit.probe_diagnostics && typeof audit.probe_diagnostics === 'object'
      && !Array.isArray(audit.probe_diagnostics) ? audit.probe_diagnostics : null
  };
}

/**
 * Canonical model-facing Mapping input.  Production and live Gold adapters
 * must use this single projection so identity fields cannot disappear at the
 * semantic Gateway boundary.
 */
function profileProjection(requirement, evidenceNeedProfile) {
  if (!evidenceNeedProfile) return null;
  const requirementId = requirement?.requirement_id || requirement?.req_id;
  const applicability = evidenceNeedProfile?.dimension_applicability;
  const expected = ['subject', 'scope', 'status', 'quantity', 'entity', 'validity'];
  if (evidenceNeedProfile.requirement_id !== requirementId
    || !/^[a-f0-9]{64}$/i.test(String(evidenceNeedProfile.profile_hash || ''))
    || !applicability || expected.some(name => !['REQUIRED', 'CONDITIONAL', 'NOT_APPLICABLE'].includes(applicability[name]))) {
    throw new AppError('EVIDENCE_NEED_PROFILE_INVALID', 'EvidenceNeedProfile 与 Canonical Requirement identity 或维度契约不一致。', 422);
  }
  return Object.freeze({
    profile_hash: evidenceNeedProfile.profile_hash,
    dimension_applicability: Object.fromEntries(expected.map(name => [name, applicability[name]]))
  });
}

export function buildMappingInput(requirement, facts, evidenceNeedProfile = null) {
  if (!requirement || typeof requirement !== 'object' || Array.isArray(requirement)) {
    throw new AppError('MAPPING_INPUT_INVALID', 'Mapping input Requirement 无效。', 422);
  }
  if (!Array.isArray(facts)) {
    throw new AppError('MAPPING_INPUT_INVALID', 'Mapping input Facts 必须是数组。', 422);
  }
  // Repository contexts expose the canonical text as requirement_text while
  // the production candidate builder exposes it as text. Normalize that
  // storage alias before applying the shared projection; this is an identity
  // normalization, not a semantic/result-field fallback.
  const canonicalRequirement = typeof requirement.text === 'string' && requirement.text.trim()
    ? requirement
    : { ...requirement, text: requirement.requirement_text };
  requiredIdentity(canonicalRequirement.requirement_id, 'requirement_id');
  requiredIdentity(canonicalRequirement.text, 'requirement_text');
  requiredIdentity(canonicalRequirement.requirement_hash, 'requirement_hash');
  for (const [index, fact] of facts.entries()) {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) {
      throw new AppError('MAPPING_INPUT_INVALID', `Mapping input Fact[${index}] 无效。`, 422);
    }
    requiredIdentity(fact.fact_id, `facts[${index}].fact_ref`);
  }
  const view = createMappingRequirementView(canonicalRequirement, facts);
  // The shared candidate view is intentionally flat for candidate-builder
  // consumers. The semantic evaluator transport remains nested under
  // `requirement`, so wrap the same projected values without rebuilding them.
  const input = {
    requirement: {
      requirement_id: view.requirement_id,
      requirement_text: view.requirement_text,
    requirement_hash: view.requirement_hash,
    ...(profileProjection(canonicalRequirement, evidenceNeedProfile)
      ? { evidence_need_profile: profileProjection(canonicalRequirement, evidenceNeedProfile) }
      : {})
    },
    facts: view.facts
  };
  if (!input.requirement.requirement_id || !input.requirement.requirement_text
    || !input.requirement.requirement_hash || input.facts.some(fact => !fact.fact_ref)) {
    throw new AppError('MAPPING_INPUT_INVALID', 'Mapping input 缺少 Canonical identity。', 422);
  }
  return input;
}

function ensureBatchResults(data, facts) {
  const expected = new Set(facts.map(fact => fact.fact_id));
  const seen = new Set();
  for (const result of data.results) {
    if (!expected.has(result.fact_ref) || seen.has(result.fact_ref)) {
      throw new AppError('MAPPING_RESULT_SET_INVALID', 'Mapping semantic results contain an unexpected or duplicate fact_ref.', 422);
    }
    seen.add(result.fact_ref);
  }
  if (seen.size !== expected.size) throw new AppError('MAPPING_RESULT_SET_INVALID', 'Mapping semantic results do not cover every fact.', 422);
}

function hasStructuredValue(value) {
  return value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)
    && !(typeof value === 'string' && value.trim() === '');
}

function knownRequirementDimension(requirement, dimension) {
  if (dimension === 'quantity') return hasStructuredValue(requirement?.quantities || requirement?.quantity);
  if (dimension === 'status') return hasStructuredValue(requirement?.status) && requirement.status !== 'unknown';
  if (dimension === 'validity') return Boolean(requirement?.validity && typeof requirement.validity === 'object'
    && requirement.validity.status && requirement.validity.status !== 'unknown');
  if (dimension === 'scope') return hasStructuredValue(requirement?.scopes || requirement?.scope);
  if (dimension === 'entity') return hasStructuredValue(requirement?.entities || requirement?.entity);
  return false;
}

/**
 * The profile is Backend-owned applicability metadata. It never enters the
 * frozen Provider payload. Only a Provider `unknown` for a dimension proven
 * irrelevant by the Requirement may become `not_applicable`; match/mismatch
 * and all conditional/required dimensions remain untouched.
 */
export function applyEvidenceNeedProfileToMappingData(data, requirement, evidenceNeedProfile = null) {
  if (!evidenceNeedProfile) return data;
  const requirementId = requirement?.requirement_id || requirement?.req_id;
  if (!evidenceNeedProfile || evidenceNeedProfile.requirement_id !== requirementId
    || !evidenceNeedProfile.profile_hash || !evidenceNeedProfile.dimension_applicability) {
    throw new AppError('EVIDENCE_NEED_PROFILE_INVALID', 'EvidenceNeedProfile 与 Canonical Requirement identity 不一致。', 422);
  }
  const applicability = evidenceNeedProfile.dimension_applicability;
  for (const dimension of ['quantity', 'status', 'validity', 'scope', 'entity']) {
    if (applicability[dimension] === 'NOT_APPLICABLE' && knownRequirementDimension(requirement, dimension)) {
      throw new AppError('EVIDENCE_NEED_PROFILE_CONTRADICTS_REQUIREMENT', 'EvidenceNeedProfile 不得将已知 Requirement 维度标记为不适用。', 422, {
        stage: 'MAPPING', dimension, profile_hash: evidenceNeedProfile.profile_hash
      });
    }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.results)) return data;
  return {
    ...data,
    results: data.results.map(result => ({
      ...result,
      dimensions: Object.fromEntries(Object.entries(result.dimensions || {}).map(([dimension, value]) => [
        dimension,
        applicability[dimension] === 'NOT_APPLICABLE' && value === 'unknown' ? 'not_applicable' : value
      ]))
    }))
  };
}

function assertApplicableDimensions(data, requirement) {
  const applicable = [];
  if (hasStructuredValue(requirement?.quantities || requirement?.quantity)) applicable.push('quantity');
  if (hasStructuredValue(requirement?.status) && requirement.status !== 'unknown') applicable.push('status');
  if (requirement?.validity && typeof requirement.validity === 'object'
    && requirement.validity.status && requirement.validity.status !== 'unknown') applicable.push('validity');
  if (hasStructuredValue(requirement?.scopes || requirement?.scope)) applicable.push('scope');
  if (hasStructuredValue(requirement?.entities || requirement?.entity)) applicable.push('entity');
  for (const [index, result] of data.results.entries()) {
    for (const dimension of applicable) {
      if (result.dimensions?.[dimension] === 'not_applicable') {
        const error = new AppError('MAPPING_SEMANTIC_INCONSISTENT', 'Semantic Mapping 将已知适用维度标记为 not_applicable。', 422, {
          stage: 'MAPPING', path: `data.results[${index}].dimensions.${dimension}`, keyword: 'applicability', expected: 'match|mismatch|unknown'
        });
        throw error;
      }
    }
  }
}

function retryableMappingError(error) {
  return ['MAPPING_SEMANTIC_SCHEMA_INVALID', 'MAPPING_RESULT_SET_INVALID', 'MAPPING_SEMANTIC_INCONSISTENT'].includes(error?.code);
}

export class SemanticGatewayMappingEvaluator {
  constructor({ client, version = MAPPING_SEMANTIC_EVALUATOR_IDENTITY, batchSize = 6, diagnosticMode = null, maxAttempts = 2 } = {}) {
    this.client = client;
    this.version = version;
    this.batchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 6;
    this.diagnosticMode = diagnosticMode;
    this.maxAttempts = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 2;
  }

  async evaluate({ requirement = {}, facts = [], upstream_support_level = null, upstream_allows_full = true, evidenceNeedProfile = null } = {}) {
    if (!this.client || typeof this.client.run !== 'function') {
      throw new AppError('MAPPING_SEMANTIC_UNAVAILABLE', 'Mapping semantic worker is not configured.', 503);
    }
    if (!Array.isArray(facts)) throw new AppError('MAPPING_INPUT_INVALID', 'Mapping facts must be an array.', 422);
    if (facts.length === 0) return [];
    const instruction = getSemanticTaskInstructionMetadata(MAPPING_TASK_TYPE)?.instruction;
    if (!instruction) throw new AppError('MAPPING_SEMANTIC_UNAVAILABLE', 'Mapping semantic task contract is unavailable.', 503);
    const byId = new Map(facts.map(fact => [fact.fact_id, fact]));
    const outputs = [];
    for (const batch of chunk(facts, this.batchSize)) {
      const payload = buildMappingInput(requirement, batch, evidenceNeedProfile);
      let data;
      let lastValidationError;
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        let response;
        try {
            response = await this.client.run({
              task_type: MAPPING_TASK_TYPE,
              task_instruction: instruction,
              task_payload_json: JSON.stringify(payload)
            }, {
              attempt,
              retry_reason: attempt > 1 ? lastValidationError?.code || 'MAPPING_VALIDATION_FAILURE' : null,
              ...(this.diagnosticMode ? { diagnosticMode: this.diagnosticMode } : {})
            });
          } catch (error) {
            const providerDiagnostics = boundedGatewayDiagnostics(error?.audit);
            throw new AppError('MAPPING_SEMANTIC_FAILED', 'Mapping semantic worker request failed.', 502, {
              stage: 'MAPPING',
              cause_code: error?.code || null,
              attempt_count: attempt,
              ...(providerDiagnostics ? { provider_diagnostics: providerDiagnostics } : {})
            });
        }
        const candidateData = response?.envelope?.data;
        try {
          const profileAppliedData = applyEvidenceNeedProfileToMappingData(candidateData, requirement, evidenceNeedProfile);
          validateTaskData(MAPPING_TASK_TYPE, profileAppliedData, payload);
          assertApplicableDimensions(profileAppliedData, requirement);
          ensureBatchResults(profileAppliedData, batch);
          data = profileAppliedData;
          break;
        } catch (error) {
          if (error instanceof AppError) {
            lastValidationError = error;
          } else if (error?.code === 'MAPPING_SEMANTIC_INCONSISTENT') {
            lastValidationError = new AppError('MAPPING_SEMANTIC_INCONSISTENT', 'Mapping semantic output contains a contradictory decision/dimension combination.', 422, {
              stage: 'MAPPING', path: error.path || null, keyword: error.keyword || null
            });
          } else {
            lastValidationError = new AppError('MAPPING_SEMANTIC_SCHEMA_INVALID', 'Mapping semantic output failed strict schema validation.', 422, {
              stage: 'MAPPING', cause_code: error?.code || 'OUTPUT_SCHEMA_INVALID', attempt_count: attempt
            });
          }
          if (!retryableMappingError(lastValidationError) || attempt === this.maxAttempts) throw lastValidationError;
        }
      }
      if (!data) throw lastValidationError || new AppError('MAPPING_SEMANTIC_SCHEMA_INVALID', 'Mapping semantic output failed strict schema validation.', 422);
      for (const result of data.results) {
        const fact = byId.get(result.fact_ref);
        const projected = applyDeterministicMappingOverrides(
          projectMappingTransportResult(result, fact),
          { requirement, fact }
        );
        outputs.push(applyMappingDecisionPolicy(projected, {
          requirement,
          upstream_support_level,
          upstream_allows_full
        }));
      }
    }
    return outputs;
  }
}
