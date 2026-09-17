import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MAPPING_EVAL_DATASET_VERSION = 'requirement-evidence-mapping-v1-gold-2026-09-02';
export const MAPPING_FAILURE_TAXONOMY = Object.freeze([
  'FALSE_FULL', 'FALSE_PARTIAL', 'FALSE_SUPPORT', 'MISSED_CONFLICT', 'RELATED_AS_SUPPORT',
  'QUANTITY_CONFUSION', 'STATUS_CONFUSION', 'SCOPE_CONFUSION', 'ENTITY_CONFUSION', 'VALIDITY_CONFUSION',
  'NA_MISUSE', 'UNKNOWN_OVERUSE', 'SCHEMA_FAILURE', 'ALIAS_FAILURE', 'OUTPUT_INCOMPLETE',
  'AUTHORITY_ESCALATION', 'UNAUTHORIZED_CLAIM_ALLOW', 'WRITER_AUTHORITY_BYPASS'
]);

const DECISIONS = new Set([
  'direct_full', 'partial_support', 'related_reference', 'related_insufficient',
  'conflict', 'unrelated', 'unknown'
]);
const DIMENSIONS = ['subject', 'scope', 'status', 'quantity', 'entity', 'validity'];
const DIMENSION_VALUES = new Set(['match', 'mismatch', 'unknown', 'not_applicable']);
const DIMENSION_FAILURE = {
  subject: 'ENTITY_CONFUSION',
  scope: 'SCOPE_CONFUSION',
  status: 'STATUS_CONFUSION',
  quantity: 'QUANTITY_CONFUSION',
  entity: 'ENTITY_CONFUSION',
  validity: 'VALIDITY_CONFUSION'
};

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_GOLD_PATH = path.resolve(here, '../requirement-evidence-mapping-v1/gold-cases.json');

const sha256 = value => createHash('sha256').update(value).digest('hex');
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function loadMappingGold(file = DEFAULT_GOLD_PATH, { fsImpl = fs } = {}) {
  const raw = fsImpl.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  Object.defineProperty(data, '__gold_file', { value: file, enumerable: false });
  Object.defineProperty(data, '__gold_hash', { value: sha256(Buffer.from(raw, 'utf8')), enumerable: false });
  return data;
}

export function validateMappingGold(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) errors.push('dataset_not_object');
  if (data?.dataset_version !== MAPPING_EVAL_DATASET_VERSION) errors.push('dataset_version');
  if (data?.contract_version !== 'requirement-evidence-mapping-v1.1') errors.push('contract_version');
  if (data?.authorship !== 'human-authored-static') errors.push('authorship');
  if (!Array.isArray(data?.cases)) errors.push('cases_not_array');
  const ids = new Set();
  for (const [index, item] of (data?.cases || []).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`case_${index}_invalid`);
      continue;
    }
    if (!item.case_id || ids.has(item.case_id)) errors.push(`duplicate_case_id:${item.case_id || index}`);
    ids.add(item.case_id);
    if (!item.requirement || typeof item.requirement !== 'object') errors.push(`requirement:${item.case_id}`);
    if (!Array.isArray(item.facts)) errors.push(`facts:${item.case_id}`);
    const expected = item.expected;
    // The batch-split case has a distinct, deterministic expectation rather
    // than a single mapping decision/dimension vector.
    if (Array.isArray(expected?.batch_sizes) && expected?.all_fact_refs_required === true) {
      if (expected.batch_sizes.length === 0 || expected.batch_sizes.some(size => !Number.isInteger(size) || size <= 0)) {
        errors.push(`batch_sizes:${item.case_id}`);
      }
    } else {
      if (!expected || !DECISIONS.has(expected.decision)) errors.push(`expected_decision:${item.case_id}`);
      if (!expected?.dimensions || typeof expected.dimensions !== 'object' || Array.isArray(expected.dimensions)) {
        errors.push(`expected_dimensions:${item.case_id}`);
      } else {
        for (const dimension of DIMENSIONS) {
          if (!DIMENSION_VALUES.has(expected.dimensions[dimension])) errors.push(`dimension:${item.case_id}:${dimension}`);
        }
      }
    }
  }
  if (data?.cases?.length !== 36) errors.push(`case_count:${data?.cases?.length ?? 0}`);
  return {
    ok: errors.length === 0,
    errors,
    gold_hash: data?.__gold_hash || sha256(Buffer.from(JSON.stringify(data || {}), 'utf8')),
    case_count: Array.isArray(data?.cases) ? data.cases.length : 0
  };
}

function actualDecision(actual) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return null;
  return DECISIONS.has(actual.decision) ? actual.decision : null;
}

function addTag(tags, tag) {
  if (MAPPING_FAILURE_TAXONOMY.includes(tag) && !tags.includes(tag)) tags.push(tag);
}

function classifyCase(gold, actual) {
  const tags = [];
  const expectedDecision = gold?.expected?.decision;
  const decision = actualDecision(actual);
  if (!decision) {
    addTag(tags, 'SCHEMA_FAILURE');
    return { primary: 'SCHEMA_FAILURE', secondary: tags.slice(1), tags };
  }
  if (expectedDecision !== 'direct_full' && decision === 'direct_full') {
    addTag(tags, 'FALSE_FULL');
    addTag(tags, 'AUTHORITY_ESCALATION');
  } else if (expectedDecision === 'conflict' && decision !== 'conflict') {
    addTag(tags, 'MISSED_CONFLICT');
  } else if (['related_reference', 'related_insufficient', 'unrelated'].includes(expectedDecision)
    && ['direct_full', 'partial_support'].includes(decision)) {
    addTag(tags, 'RELATED_AS_SUPPORT');
    addTag(tags, decision === 'direct_full' ? 'FALSE_FULL' : 'FALSE_SUPPORT');
  } else if (expectedDecision === 'direct_full' && decision === 'partial_support') {
    addTag(tags, 'FALSE_PARTIAL');
  } else if (expectedDecision === 'direct_full' && decision !== 'direct_full') {
    addTag(tags, 'OUTPUT_INCOMPLETE');
  }
  for (const dimension of DIMENSIONS) {
    if (gold?.expected?.dimensions?.[dimension] !== actual?.dimensions?.[dimension]) {
      addTag(tags, DIMENSION_FAILURE[dimension]);
      if (actual?.dimensions?.[dimension] === 'not_applicable' && gold?.expected?.dimensions?.[dimension] !== 'not_applicable') addTag(tags, 'NA_MISUSE');
      if (actual?.dimensions?.[dimension] === 'unknown' && gold?.expected?.dimensions?.[dimension] !== 'unknown') addTag(tags, 'UNKNOWN_OVERUSE');
    }
  }
  return { primary: tags[0] || null, secondary: tags.slice(1), tags };
}

export function scoreMappingCases(cases = [], { qualityMeasured = false } = {}) {
  const rows = [];
  const primary = Object.fromEntries(MAPPING_FAILURE_TAXONOMY.map(tag => [tag, 0]));
  const secondary = Object.fromEntries(MAPPING_FAILURE_TAXONOMY.map(tag => [tag, 0]));
  let decisionCorrect = 0;
  let dimensionMatches = 0;
  let dimensionTotal = 0;
  const dimensionMatchesByName = Object.fromEntries(DIMENSIONS.map(name => [name, 0]));
  let schemaValid = 0;
  let falsePositive = 0;
  let falseFull = 0;
  let conflictGold = 0;
  let detectedConflict = 0;
  let fullOrPartialCorrect = 0;
  let fullOrPartialTotal = 0;
  let trueGapCorrect = 0;
  let trueGapTotal = 0;
  for (const entry of cases) {
    const gold = entry.gold || {};
    const actual = entry.actual;
    const decision = actualDecision(actual);
    const valid = Boolean(decision && actual?.dimensions && DIMENSIONS.every(name => DIMENSION_VALUES.has(actual.dimensions[name])));
    if (valid) schemaValid += 1;
    if (decision === gold.expected?.decision) decisionCorrect += 1;
    for (const dimension of DIMENSIONS) {
      dimensionTotal += 1;
      if (actual?.dimensions?.[dimension] === gold.expected?.dimensions?.[dimension]) {
        dimensionMatches += 1;
        dimensionMatchesByName[dimension] += 1;
      }
    }
    if (['related_reference', 'related_insufficient', 'conflict', 'unrelated', 'unknown'].includes(gold.expected?.decision)
      && ['direct_full', 'partial_support'].includes(decision)) falsePositive += 1;
    if (gold.expected?.decision !== 'direct_full' && decision === 'direct_full') falseFull += 1;
    if (gold.expected?.decision === 'conflict') {
      conflictGold += 1;
      if (decision === 'conflict') detectedConflict += 1;
    }
    if (['direct_full', 'partial_support'].includes(gold.expected?.decision)) {
      fullOrPartialTotal += 1;
      if (decision === gold.expected.decision) fullOrPartialCorrect += 1;
    }
    if (['related_insufficient', 'unrelated', 'unknown'].includes(gold.expected?.decision)) {
      trueGapTotal += 1;
      if (decision === gold.expected.decision) trueGapCorrect += 1;
    }
    const classification = classifyCase(gold, actual);
    if (classification.primary) primary[classification.primary] += 1;
    for (const tag of classification.secondary) secondary[tag] += 1;
    rows.push({
      gold_id: gold.case_id || null,
      expected_decision: gold.expected?.decision || null,
      actual_decision: decision,
      schema_valid: valid,
      decision_correct: decision === gold.expected?.decision,
      dimension_accuracy: DIMENSIONS.filter(name => actual?.dimensions?.[name] === gold.expected?.dimensions?.[name]).length / DIMENSIONS.length,
      primary_failure: classification.primary,
      secondary_failures: classification.secondary
    });
  }
  return {
    metrics: {
      cases: cases.length,
      schema_validity: ratio(schemaValid, cases.length),
      decision_accuracy: ratio(decisionCorrect, cases.length),
      dimension_accuracy: ratio(dimensionMatches, dimensionTotal),
      ...Object.fromEntries(DIMENSIONS.map(name => [`${name}_accuracy`, ratio(dimensionMatchesByName[name], cases.length)])),
      final_mapping_accuracy: ratio(decisionCorrect, cases.length),
      false_positive_count: falsePositive,
      false_positive_rate: ratio(falsePositive, cases.length),
      false_full_count: falseFull,
      false_full_rate: ratio(falseFull, cases.length),
      conflict_recall: ratio(detectedConflict, conflictGold),
      gold_conflicts: conflictGold,
      detected_conflicts: detectedConflict,
      missed_conflict_count: conflictGold - detectedConflict,
      full_partial_accuracy: ratio(fullOrPartialCorrect, fullOrPartialTotal),
      true_gap_accuracy: ratio(trueGapCorrect, trueGapTotal)
    },
    taxonomy: { primary, secondary },
    case_results: rows,
    semantic_model_quality: qualityMeasured ? 'MEASURED' : 'NOT_MEASURED'
  };
}

export function goldIdentity(gold) {
  const validation = validateMappingGold(gold);
  return {
    dataset_version: gold?.dataset_version || null,
    contract_version: gold?.contract_version || null,
    authorship: gold?.authorship || null,
    case_count: validation.case_count,
    gold_hash: validation.gold_hash,
    validation
  };
}

export { equal };
