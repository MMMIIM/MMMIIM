import {
  validateEvidenceFactCandidateV21Data,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256
} from '../../../packages/semantic-contracts/index.js';
import {
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2
} from './evidence-fact-candidate-v2.js';

export const EVIDENCE_FACT_CANDIDATE_V21_VERSION = EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION;
export const EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION = '4.3-evidence-fact-canonicalizer-v2.1';
export const EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION = '4.3-evidence-fact-grounding-v2.1';
// facts -> observation array -> observation object -> source_refs array -> ref
export const MODEL_FACING_MAX_NESTING_V21 = 6;
const SOURCE_ALIAS_PATTERN = /^S\d{3,}$/;

function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Build a deterministic, window-local model alias table.  The authoritative
 * source refs never leave the Backend-owned table; only S001/S002/... are
 * serialized into the provider input.
 */
export function createEvidenceFactCandidateV21SourceAliasTable(sourceSnapshot) {
  if (!sourceSnapshot || !Array.isArray(sourceSnapshot.segments)) {
    throw new Error('source snapshot segments are required');
  }
  const aliasToSourceRef = new Map();
  const sourceRefToAlias = new Map();
  const segments = sourceSnapshot.segments.map((segment, index) => {
    if (!segment || typeof segment.source_ref !== 'string' || !segment.source_ref.trim()) {
      throw new Error(`source segment ${index} has no authoritative source_ref`);
    }
    if (typeof segment.text !== 'string' || !segment.text) {
      throw new Error(`source_ref ${segment.source_ref} has no source text`);
    }
    if (sourceRefToAlias.has(segment.source_ref)) {
      throw new Error(`duplicate source_ref ${segment.source_ref}`);
    }
    const alias = `S${String(index + 1).padStart(3, '0')}`;
    aliasToSourceRef.set(alias, segment.source_ref);
    sourceRefToAlias.set(segment.source_ref, alias);
    return Object.freeze({ source_ref: alias, text: segment.text });
  });
  return Object.freeze({
    snapshot_id: sourceSnapshot.snapshot_id || null,
    segments: Object.freeze(segments),
    aliasToSourceRef,
    sourceRefToAlias
  });
}

function unknownAlias(ref, label) {
  const error = new Error(`unknown source alias ${String(ref)} at ${label}`);
  error.code = 'UNKNOWN_SOURCE_ALIAS';
  error.details = { label, alias: typeof ref === 'string' ? ref.slice(0, 80) : null };
  return error;
}

function resolveRefs(refs, aliasTable, label) {
  if (!Array.isArray(refs) || refs.length === 0) throw unknownAlias('', label);
  const authoritativeRefs = [];
  const texts = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !SOURCE_ALIAS_PATTERN.test(ref) || !aliasTable.aliasToSourceRef.has(ref)) {
      throw unknownAlias(ref, label);
    }
    const authoritativeRef = aliasTable.aliasToSourceRef.get(ref);
    authoritativeRefs.push(authoritativeRef);
    const segment = aliasTable.segments.find(item => item.source_ref === ref);
    texts.push(segment.text);
  }
  return {
    aliases: [...refs],
    source_refs: authoritativeRefs,
    source_text: [...new Set(texts)].join('\n')
  };
}

/** Resolve model references against the Backend-owned immutable snapshot. */
export function resolveEvidenceFactCandidateV21SourceRefs(candidate, sourceSnapshot) {
  validateEvidenceFactCandidateV21Data({ facts: [candidate] });
  const aliasTable = createEvidenceFactCandidateV21SourceAliasTable(sourceSnapshot);
  const statement = resolveRefs(candidate.source_refs, aliasTable, 'statement.source_refs');
  const subject = candidate.subject_source_refs.length
    ? resolveRefs(candidate.subject_source_refs, aliasTable, 'subject_source_refs')
    : { aliases: [], source_refs: [], source_text: '' };
  const status = candidate.status_source_refs.length
    ? resolveRefs(candidate.status_source_refs, aliasTable, 'status_source_refs')
    : { aliases: [], source_refs: [], source_text: '' };
  const resolveObservation = (items, field) => items.map((item, i) => resolveRefs(item.source_refs, aliasTable, `${field}[${i}].source_refs`));
  const scope = resolveObservation(candidate.scope_items, 'scope_items');
  const quantity = resolveObservation(candidate.quantity_items, 'quantity_items');
  const temporal = resolveObservation(candidate.temporal_items, 'temporal_items');
  const entity = resolveObservation(candidate.entity_mentions, 'entity_mentions');
  const allRefs = [
    ...statement.source_refs,
    ...subject.source_refs,
    ...status.source_refs,
    ...entity.flatMap(item => item.source_refs),
    ...scope.flatMap(item => item.source_refs),
    ...quantity.flatMap(item => item.source_refs),
    ...temporal.flatMap(item => item.source_refs)
  ];
  const total = [
    candidate.source_refs,
    candidate.subject_source_refs,
    candidate.status_source_refs,
    ...candidate.entity_mentions.map(item => item.source_refs),
    ...candidate.scope_items.map(item => item.source_refs),
    ...candidate.quantity_items.map(item => item.source_refs),
    ...candidate.temporal_items.map(item => item.source_refs)
  ].reduce((sum, refs) => sum + refs.length, 0);
  const observationSourceTexts = {
    statement: statement.source_text,
    subject_name: subject.source_text,
    status_text: status.source_text
  };
  return {
    fact_source_text: observationSourceTexts.statement,
    grounding_source_text: [...new Set(allRefs)].map(ref => {
      const alias = aliasTable.sourceRefToAlias.get(ref);
      return aliasTable.segments.find(item => item.source_ref === alias).text;
    }).filter(Boolean).join('\n'),
    observation_source_texts: observationSourceTexts,
    entity_source_texts: entity.map(item => item.source_text),
    scope_source_texts: scope.map(item => item.source_text),
    quantity_source_texts: quantity.map(item => item.source_text),
    temporal_source_texts: temporal.map(item => item.source_text),
    authoritative_source_refs: [...new Set(allRefs)],
    source_alias_resolution: { total, resolved: total, unresolved: 0, rate: 1 },
    source_aliases: {
      statement: statement.aliases,
      subject: subject.aliases,
      status: status.aliases,
      entity: entity.map(item => item.aliases),
      scope: scope.map(item => item.aliases),
      quantity: quantity.map(item => item.aliases),
      temporal: temporal.map(item => item.aliases)
    }
  };
}

/**
 * Deterministically project V2.1 observations into the existing Candidate V2
 * canonicalizer input.  All source text comes from the Backend snapshot; no
 * model-provided text is accepted as provenance.
 */
export function projectEvidenceFactCandidateV21(candidate, sourceSnapshot) {
  validateEvidenceFactCandidateV21Data({ facts: [candidate] });
  const aliasTable = createEvidenceFactCandidateV21SourceAliasTable(sourceSnapshot);
  const statement = resolveRefs(candidate.source_refs, aliasTable, 'statement.source_refs');
  const subject = candidate.subject_source_refs.length ? resolveRefs(candidate.subject_source_refs, aliasTable, 'subject_source_refs') : null;
  const status = candidate.status_source_refs.length ? resolveRefs(candidate.status_source_refs, aliasTable, 'status_source_refs') : null;
  const expanded = (refs, label) => resolveRefs(refs, aliasTable, label).source_refs;
  const projected = {
    statement: text(candidate.statement),
    subject_name: candidate.subject_name || null,
    subject_type_hint: candidate.subject_type_hint || null,
    entity_mentions: candidate.entity_mentions.map((entity, i) => ({
      value: entity.name,
      type_hint: entity.type_hint || null,
      provenance: { source_text: resolveRefs(entity.source_refs, aliasTable, `entity_mentions[${i}].source_refs`).source_text, source_refs: expanded(entity.source_refs, `entity_mentions[${i}].source_refs`) }
    })),
    status_text: candidate.status_text || null,
    scope_items: candidate.scope_items.map((scope, i) => ({
      value: scope.text,
      provenance: { source_text: resolveRefs(scope.source_refs, aliasTable, `scope_items[${i}].source_refs`).source_text, source_refs: expanded(scope.source_refs, `scope_items[${i}].source_refs`) }
    })),
    quantity_items: candidate.quantity_items.map((quantity, i) => ({
      name: quantity.name,
      value_text: quantity.value_text || null,
      unit_text: quantity.unit_text || null,
      condition_text: quantity.condition_text || null,
      provenance: { source_text: resolveRefs(quantity.source_refs, aliasTable, `quantity_items[${i}].source_refs`).source_text, source_refs: expanded(quantity.source_refs, `quantity_items[${i}].source_refs`) }
    })),
    temporal_items: candidate.temporal_items.map((temporal, i) => ({
      value_text: temporal.value_text,
      context_text: temporal.event_text || null,
      provenance: { source_text: resolveRefs(temporal.source_refs, aliasTable, `temporal_items[${i}].source_refs`).source_text, source_refs: expanded(temporal.source_refs, `temporal_items[${i}].source_refs`) }
    }))
  };
  return projected;
}

export function canonicalizeEvidenceFactCandidateV21(candidate, sourceSnapshot, options = {}) {
  const resolved = resolveEvidenceFactCandidateV21SourceRefs(candidate, sourceSnapshot);
  const projected = projectEvidenceFactCandidateV21(candidate, sourceSnapshot);
  return canonicalizeEvidenceFactCandidateV2(projected, { sourceText: resolved.grounding_source_text, ...options });
}

export function canonicalizeAndGroundEvidenceFactCandidateV21(candidate, sourceSnapshot, options = {}) {
  const canonicalization = canonicalizeEvidenceFactCandidateV21(candidate, sourceSnapshot, options);
  const resolved = resolveEvidenceFactCandidateV21SourceRefs(candidate, sourceSnapshot);
  const grounding = groundCanonicalEvidenceFactCandidateV2(canonicalization, { sourceText: resolved.grounding_source_text, ...options });
  return { canonicalization, grounding };
}

export const EVIDENCE_FACT_CANDIDATE_V21_CONTRACT = Object.freeze({
  schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  model_source_text: false,
  backend_source_resolution: true
});
