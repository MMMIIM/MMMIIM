import { SemanticGatewayError } from './semantic-gateway-client.js';
import {
  getSemanticTaskContract,
  resolveSemanticTaskInstruction,
  validateTaskData
} from '../../../packages/semantic-contracts/index.js';

export const REQUIREMENT_EXTRACTION_TASK_TYPE = 'requirement_extraction';
export const REQUIREMENT_EXTRACTION_CONTRACT_VERSION = getSemanticTaskContract(
  REQUIREMENT_EXTRACTION_TASK_TYPE
).contract_version;

function contractError(audit, detail) {
  return new SemanticGatewayError(
    'GATEWAY_REQUIREMENTS_INVALID',
    `候选需求输出契约无效：${detail}`,
    audit,
    422
  );
}

function normalizeWarnings(warnings, audit) {
  if (!Array.isArray(warnings)) throw contractError(audit, 'warnings 必须为数组。');
  return warnings.map((warning) => {
    if (typeof warning === 'string' && warning.trim()) {
      return { code: 'GATEWAY_WARNING', message: warning.trim().slice(0, 500) };
    }
    if (warning && typeof warning === 'object' && !Array.isArray(warning)
      && typeof warning.message === 'string' && warning.message.trim()) {
      return {
        code: typeof warning.code === 'string' && warning.code.trim()
          ? warning.code.trim().slice(0, 80)
          : 'GATEWAY_WARNING',
        message: warning.message.trim().slice(0, 500)
      };
    }
    throw contractError(audit, 'warnings 项格式无效。');
  });
}

export function validateRequirementExtractionEnvelope(gatewayResponse) {
  const { envelope, audit } = gatewayResponse;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw contractError(audit, '网关 envelope 必须为对象。');
  }
  if (envelope.schema_version !== REQUIREMENT_EXTRACTION_CONTRACT_VERSION
    || envelope.task_type !== REQUIREMENT_EXTRACTION_TASK_TYPE) {
    throw contractError(audit, 'schema_version 或 task_type 与需求抽取契约不一致。');
  }
  if (envelope.status !== 'success') {
    throw new SemanticGatewayError(
      'GATEWAY_TASK_FAILED',
      '语义网关未能完成候选需求提取。',
      audit,
      502
    );
  }
  try {
    validateTaskData(REQUIREMENT_EXTRACTION_TASK_TYPE, envelope.data);
  } catch (error) {
    throw contractError(audit, `data 不符合 Candidate 契约：${error.message}`);
  }

  const candidates = envelope.data.requirements.map((candidate) => {
    const text = candidate.text.trim();
    return {
      text: text.trim(),
      category: candidate.category,
      source_range: {
        start_ref: candidate.source_range.start_ref,
        end_ref: candidate.source_range.end_ref
      },
      mandatory_observed: candidate.mandatory_observed,
      requires_confirmation: candidate.requires_confirmation
    };
  });

  return {
    candidates,
    warnings: normalizeWarnings(envelope.warnings, audit),
    audit
  };
}

export function buildRequirementExtractionPayload({
  projectName,
  sectionName,
  chunkIndex,
  chunkCount,
  chunkText
} = {}) {
  return {
    project_name: String(projectName || ''),
    section_name: String(sectionName || ''),
    chunk_index: Number.isInteger(chunkIndex) && chunkIndex > 0 ? chunkIndex : 1,
    chunk_count: Number.isInteger(chunkCount) && chunkCount > 0 ? chunkCount : 1,
    chunk_text: String(chunkText || '')
  };
}

/**
 * Resolve the single provider-facing Requirement Extraction input owned by the
 * production path.  Evaluation and verification callers must compare against
 * this value instead of reconstructing model_text selection independently.
 */
export function resolveRequirementExtractionProviderInput({ chunk, fallbackText } = {}) {
  return chunk?.model_text || String(fallbackText || '');
}

export function assertRequirementExtractionProviderInputParity({
  chunk,
  fallbackText,
  actualInput
} = {}) {
  const canonicalInput = resolveRequirementExtractionProviderInput({ chunk, fallbackText });
  if (actualInput !== canonicalInput) {
    throw Object.assign(new Error('Production-like evaluation input differs from the canonical Requirement Extraction input.'), {
      code: 'PRODUCTION_PARITY_VIOLATION'
    });
  }
  return canonicalInput;
}

export function createRequirementExtractionGateway(client) {
  return {
    async extract({
      fileName,
      text,
      paragraphs = [],
      chunk,
      projectName,
      sectionName,
      chunkCount,
      diagnosticMode = null
    }) {
      const providerInput = resolveRequirementExtractionProviderInput({
        chunk,
        fallbackText: text
      });
      const gatewayResponse = await client.run({
        task_type: REQUIREMENT_EXTRACTION_TASK_TYPE,
        // The transport field is required by the legacy HTTP envelope, but its
        // value is always resolved from the canonical semantic contract.
        task_instruction: resolveSemanticTaskInstruction(REQUIREMENT_EXTRACTION_TASK_TYPE),
        task_payload_json: JSON.stringify(buildRequirementExtractionPayload({
          projectName: projectName || fileName,
          sectionName: sectionName || chunk?.segments?.[0]?.source_section,
          chunkIndex: chunk?.chunk_number,
          chunkCount,
          chunkText: providerInput
        }))
      }, { diagnosticMode });
      return validateRequirementExtractionEnvelope(gatewayResponse);
    }
  };
}
