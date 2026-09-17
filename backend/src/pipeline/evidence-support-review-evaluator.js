import { createHash } from 'node:crypto';
import { AppError } from '../errors.js';
import {
  assembleEvidenceSupportAssessment,
  EVIDENCE_SUPPORT_ROUTING_VERSION,
  runDeterministicEvidenceChecks
} from './evidence-support-responsibility.js';
import {
  EVIDENCE_SUPPORT_REASON_CODES,
  toEvidenceReviewAssessment
} from './evidence-support-assessment-contract-v1.js';
import { EVIDENCE_SUPPORT_ADAPTER_VERSION } from './evidence-support-assessment-contract-v1.js';
import {
  EVIDENCE_CAPABILITY,
  EVIDENCE_SUPPORT_LEVEL,
  REVIEW_DIMENSIONS,
  REVIEW_DIMENSION_VALUES,
  SEMANTIC_RELEVANCE
} from './evidence-review-contract.js';
import { MAPPING_RELATIONSHIPS } from './requirement-evidence-mapping-contract-v1.js';

const ADAPTER_VERSION = EVIDENCE_SUPPORT_ADAPTER_VERSION;
export const SEMANTIC_ADJUDICATION_FRAGMENT_KEYS = Object.freeze([
  'semantic_relevance',
  'evidence_capability',
  'support_level',
  'semantic_relationship',
  'review_dimensions',
  'reason_codes',
  'support_observations',
  'conflict_observations'
]);
const FRAGMENT_KEYS = new Set(SEMANTIC_ADJUDICATION_FRAGMENT_KEYS);

const enumSchema = values => Object.freeze({ type: 'string', enum: [...values] });

/**
 * The narrow SemanticAdjudicationFragment transport schema is derived from
 * the same canonical enums and field allow-list used by the production
 * evaluator.  It intentionally has no business IDs or lifecycle fields.
 */
export function deriveSemanticAdjudicationFragmentSchema() {
  const supportObservation = {
    type: 'object',
    additionalProperties: false,
    properties: {
      source_id: { type: 'string' },
      source_span_id: { type: 'string' },
      support_excerpt: { type: 'string' },
      observation_type: enumSchema(['direct_support', 'partial_support', 'context', 'contradiction']),
      reason_codes: { type: 'array', items: enumSchema(EVIDENCE_SUPPORT_REASON_CODES) }
    }
  };
  const conflictObservation = {
    type: 'object',
    additionalProperties: false,
    properties: {
      conflict_group_id: { type: 'string' },
      dimension: { type: 'string' },
      observed_value: {},
      source_id: { type: 'string' },
      source_span_id: { type: 'string' },
      support_excerpt: { type: 'string' },
      reason_codes: { type: 'array', items: enumSchema(EVIDENCE_SUPPORT_REASON_CODES) }
    }
  };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      semantic_relevance: enumSchema(SEMANTIC_RELEVANCE),
      evidence_capability: enumSchema(EVIDENCE_CAPABILITY),
      support_level: enumSchema(EVIDENCE_SUPPORT_LEVEL),
      semantic_relationship: enumSchema(MAPPING_RELATIONSHIPS),
      review_dimensions: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(REVIEW_DIMENSIONS.map(name => [name, enumSchema(REVIEW_DIMENSION_VALUES)]))
      },
      reason_codes: { type: 'array', items: enumSchema(EVIDENCE_SUPPORT_REASON_CODES) },
      support_observations: { type: 'array', items: supportObservation },
      conflict_observations: { type: 'array', items: conflictObservation }
    }
  };
}

export const SEMANTIC_ADJUDICATION_FRAGMENT_SCHEMA = deriveSemanticAdjudicationFragmentSchema();

const asText = value => String(value ?? '').trim();
const asSourceText = value => String(value ?? '');

function technicalUnavailable(message = 'Evidence Support 语义评估当前不可用。', details = {}) {
  return new AppError('ASSESSMENT_UNAVAILABLE', message, 503, {
    technical_error_code: 'SEMANTIC_ADJUDICATION_UNAVAILABLE',
    ...details
  });
}

/**
 * Convert the trusted Retrieval/Evidence Review context into the official
 * candidate adapter.  Source text and lineage are copied from the backend
 * context; no client or model field is trusted as a canonical identity.
 */
export function createEvidenceSupportReviewAdapter(context = {}) {
  const sourceText = asSourceText(context.source_text);
  return {
    adapter_version: ADAPTER_VERSION,
    input_kind: 'retrieval_candidate',
    requirement: {
      requirement_id: asText(context.requirement_id),
      text: asText(context.requirement_text),
      text_hash: context.requirement_text_hash
        || createSha256(context.requirement_text)
    },
    source: {
      source_id: asText(context.retrieval_candidate_id),
      source_span_id: asText(context.source_span_id),
      source_kind: 'retrieval_candidate',
      source_text: sourceText,
      source_text_hash: context.source_text_hash || undefined,
      material_type: context.material_type || null,
      content_role: context.content_role || null,
      material: {
        material_type: context.material_type || null,
        content_role: context.content_role || null
      },
      lineage: {
        project_id: context.project_id || null,
        requirement_id: context.requirement_id || null,
        retrieval_run_id: context.retrieval_run_id || null,
        material_id: context.material_id || null,
        source_material: context.source_material || null
      }
    },
    _source_text: sourceText,
    candidate_metadata: {
      proof_eligibility: context.proof_eligibility
        || (String(context.candidate_eligibility || '').toUpperCase() === 'OUT_OF_SCOPE' ? 'OUT_OF_SCOPE' : undefined),
      source_origin: context.source_origin,
      source_type: context.source_type,
      evidence_source_eligible: context.evidence_source_eligible,
      evidence_source_class: context.evidence_source_class,
      material_type: context.material_type,
      deterministic_dimensions: context.deterministic_dimensions || context.review_dimensions,
      deterministic_reason_codes: context.deterministic_reason_codes
    }
  };
}

export function validateSemanticAdjudicationFragment(fragment) {
  if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) {
    throw technicalUnavailable('Semantic adjudication 返回了无效片段。', {
      technical_error_code: 'SEMANTIC_ADJUDICATION_FRAGMENT_INVALID'
    });
  }
  const unexpected = Object.keys(fragment).filter(key => !FRAGMENT_KEYS.has(key));
  if (unexpected.length) {
    throw technicalUnavailable('Semantic adjudication 片段包含未授权字段。', {
      technical_error_code: 'SEMANTIC_ADJUDICATION_FRAGMENT_INVALID'
    });
  }
  return fragment;
}

const validateFragment = validateSemanticAdjudicationFragment;

/**
 * Production entry-point evaluator.  It owns no formal persistence and never
 * calls the old evidence_support_assessment task.  Until a separately
 * published semantic_adjudication_v1 port is injected, ambiguous inputs fail
 * closed as a technical unavailability.
 */
export class EvidenceSupportReviewEvaluator {
  constructor({ semanticAdjudicator = null, evaluatorVersion = EVIDENCE_SUPPORT_ROUTING_VERSION } = {}) {
    this.semanticAdjudicator = semanticAdjudicator;
    this.evaluatorVersion = evaluatorVersion;
  }

  async assess({ context } = {}) {
    const adapter = createEvidenceSupportReviewAdapter(context);
    const check = runDeterministicEvidenceChecks({
      requirement: adapter.requirement,
      adapter
    });
    if (check.decision === 'DETERMINISTIC_RESOLUTION') {
      const assessment = assembleEvidenceSupportAssessment({
        adapter,
        deterministicCheck: check,
        evaluatorVersion: this.evaluatorVersion
      });
      return {
        assessment,
        routing: {
          routing_version: EVIDENCE_SUPPORT_ROUTING_VERSION,
          decision: check.decision,
          semantic_adjudicator_call_count: 0,
          gateway_call_count: 0
        }
      };
    }

    if (!this.semanticAdjudicator || typeof this.semanticAdjudicator.adjudicate !== 'function') {
      throw technicalUnavailable(undefined, {
        routing_decision: check.decision,
        semantic_adjudicator_call_count: 0,
        gateway_call_count: 0
      });
    }

    let fragment;
    try {
      fragment = await this.semanticAdjudicator.adjudicate({
        requirement: structuredClone(adapter.requirement),
        evidence: structuredClone(adapter.source),
        deterministic_findings: structuredClone(check),
        unresolved_dimensions: [...check.unresolved_dimensions]
      });
    } catch (error) {
      if (error?.code === 'ASSESSMENT_UNAVAILABLE') throw error;
      throw technicalUnavailable(undefined, {
        routing_decision: check.decision,
        semantic_adjudicator_call_count: 1,
        gateway_call_count: 0
      });
    }

    const validatedFragment = validateFragment(fragment);
    const assessment = assembleEvidenceSupportAssessment({
      adapter,
      deterministicCheck: check,
      semanticObservation: validatedFragment,
      evaluatorVersion: this.evaluatorVersion
    });
    return {
      assessment,
      routing: {
        routing_version: EVIDENCE_SUPPORT_ROUTING_VERSION,
        decision: check.decision,
        semantic_adjudicator_call_count: 1,
        gateway_call_count: 0
      }
    };
  }

  async evaluate(input) {
    return this.assess(input);
  }

  async review({ context } = {}) {
    const result = await this.assess({ context });
    return toEvidenceReviewAssessment(result.assessment);
  }
}

export const EVIDENCE_SUPPORT_REVIEW_ADAPTER_VERSION = ADAPTER_VERSION;

function createSha256(value) {
  // Kept local so the entry adapter never trusts a client-supplied identity.
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}
