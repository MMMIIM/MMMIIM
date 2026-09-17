import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Deterministic, Provider=0 governance primitives for Gold V2.
 *
 * This module is intentionally under backend/eval and has no production
 * imports. It validates evaluation artifacts; it never creates or mutates
 * production Requirement, Fact, Mapping, Claim, or Writer state.
 */

export const GOVERNANCE_HARNESS_VERSION = 'gold-governance-harness-v1';

/** Eval-only gate for parent/supplemental real-source identity comparison. */
export const REAL_GOLD_NOVELTY_GATE = 'REAL_GOLD_NOVELTY_GATE';

export const REVIEW_STATUSES = Object.freeze([
  'ACCEPTED',
  'REVISED_AND_ACCEPTED',
  'DISPUTED',
  'REJECTED'
]);

export const GOLD_CLASSIFICATIONS = Object.freeze([
  'REAL_DERIVED_GOLD',
  'SYNTHETIC_BOUNDARY_GOLD',
  'ENGINEERING_FIXTURE',
  'DISPUTED_CASE'
]);

export const DELTA_CLASSES = Object.freeze([
  'UNCHANGED',
  'GOLD_EXPECTATION_CHANGED',
  'ADDED_CASE',
  'REMOVED_FROM_SCORING',
  'DISPUTED'
]);

const VOLATILE_KEYS = new Set([
  'generated_at',
  'created_at',
  'updated_at',
  'run_id',
  'random_id',
  'absolute_path',
  'db_order'
]);

const BLIND_FORBIDDEN_KEYS = new Set([
  'expected_decision',
  'expected_dimensions',
  'suggested_decision',
  'production_mapping_decision',
  'provider_result',
  'model_result',
  'semantic_gateway_result',
  'historical_pass',
  'historical_fail'
]);

const BLIND_FORBIDDEN_TEXT = /(?:expected[_ ](?:decision|dimensions)|suggested[_ ]decision|production[_ ]mapping[_ ]decision|provider[_ ]result|model[_ ]result|semantic[_ ]gateway[_ ]result|historical[_ ](?:pass|fail))/i;

function canonicalize(value, { omitVolatile = false } = {}) {
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => canonicalize(item, { omitVolatile }));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (omitVolatile && VOLATILE_KEYS.has(key)) continue;
    if (typeof value[key] === 'undefined') continue;
    result[key] = canonicalize(value[key], { omitVolatile });
  }
  return result;
}

export function stableSerialize(value) {
  return JSON.stringify(canonicalize(value));
}

export function stableSemanticSerialize(value) {
  return JSON.stringify(canonicalize(value, { omitVolatile: true }));
}

export function sha256(value) {
  const bytes = typeof value === 'string' ? value : stableSerialize(value);
  return crypto.createHash('sha256').update(bytes, 'utf8').digest('hex');
}

export function stableSemanticHash(value) {
  return crypto.createHash('sha256').update(stableSemanticSerialize(value), 'utf8').digest('hex');
}

function fail(code, details = {}) {
  return { ok: false, code, ...details };
}

export function validateDatasetIdentity(actual, expected) {
  const mismatches = [];
  for (const key of ['dataset_id', 'dataset_version', 'path', 'sha256']) {
    if (expected?.[key] !== undefined && actual?.[key] !== expected[key]) {
      mismatches.push({ field: key, expected: expected[key], actual: actual?.[key] ?? null });
    }
  }
  if (mismatches.length) return fail('GOLD_DATASET_IDENTITY_INVALID', { mismatches });
  return { ok: true, code: 'DATASET_IDENTITY_PASS' };
}

export function validateReviewStatus(status) {
  if (!REVIEW_STATUSES.includes(status)) return fail('GOLD_REVIEW_STATUS_INVALID', { status: status ?? null });
  const scored = status === 'ACCEPTED' || status === 'REVISED_AND_ACCEPTED';
  return { ok: true, status, scored, code: scored ? 'REVIEW_ACCEPTED' : 'REVIEW_NOT_SCORED' };
}

export function validateClassification(classification) {
  if (!GOLD_CLASSIFICATIONS.includes(classification)) {
    return fail('GOLD_CLASSIFICATION_INVALID', { classification: classification ?? null });
  }
  const scored = classification === 'REAL_DERIVED_GOLD' || classification === 'SYNTHETIC_BOUNDARY_GOLD';
  return { ok: true, classification, scored, code: scored ? 'CLASSIFICATION_SCORED' : 'CLASSIFICATION_EXCLUDED' };
}

function hasRequirementIdentity(item) {
  const requirement = item?.requirement || {};
  return Boolean(
    item?.requirement_id
      || requirement.requirement_id
      || requirement.id
      || requirement.text
      || requirement.requirement_text
  );
}

function hasExpected(item) {
  const expected = item?.expected;
  return Boolean(expected && typeof expected === 'object' && expected.decision && expected.dimensions && typeof expected.dimensions === 'object');
}

function factRefs(item) {
  if (!Array.isArray(item?.facts)) return [];
  return item.facts.map(fact => fact?.fact_ref || fact?.id).filter(Boolean).sort();
}

function requirementIdentity(item) {
  const requirement = item?.requirement || {};
  return item?.requirement_id
    || requirement.requirement_id
    || requirement.id
    || requirement.text
    || requirement.requirement_text
    || '';
}

export function semanticIdentity(item) {
  return `${requirementIdentity(item)}::${factRefs(item).join(',')}`;
}

export function validateSemanticCase(item, { semanticRequired = true } = {}) {
  if (!item || typeof item !== 'object' || !item.case_id) {
    return fail('GOLD_SEMANTIC_EXPECTATION_MISSING', { field: 'case_id' });
  }
  const review = validateReviewStatus(item.review_status);
  if (!review.ok) return review;
  const classification = validateClassification(item.classification);
  if (!classification.ok) return classification;
  const scored = review.scored && classification.scored;
  if (semanticRequired && scored) {
    const missing = [];
    if (!hasRequirementIdentity(item)) missing.push('requirement_identity');
    if (!factRefs(item).length) missing.push('fact_refs');
    if (!hasExpected(item)) missing.push('expected');
    if (missing.length) return fail('GOLD_SEMANTIC_EXPECTATION_MISSING', { case_id: item.case_id, missing });
  }
  return { ok: true, case_id: item.case_id, scored, review_status: review.status, classification: classification.classification };
}

export function validateCaseSet(cases, { semanticRequired = true } = {}) {
  if (!Array.isArray(cases)) return fail('GOLD_SEMANTIC_EXPECTATION_MISSING', { field: 'cases' });
  const errors = [];
  const seenIds = new Set();
  const identities = new Map();
  const scoredCases = [];
  for (const item of cases) {
    const result = validateSemanticCase(item, { semanticRequired });
    if (!result.ok) errors.push({ case_id: item?.case_id ?? null, code: result.code, missing: result.missing, status: result.status });
    if (item?.case_id && seenIds.has(item.case_id)) errors.push({ case_id: item.case_id, code: 'GOLD_CASE_ID_DUPLICATE' });
    if (item?.case_id) seenIds.add(item.case_id);
    if (result.ok && result.scored) {
      const identity = semanticIdentity(item);
      const prior = identities.get(identity);
      if (prior && stableSerialize(prior.expected) !== stableSerialize(item.expected)) {
        errors.push({ case_id: item.case_id, code: 'GOLD_SEMANTIC_CONSISTENCY_REVIEW_REQUIRED', identity });
      } else if (!prior) {
        identities.set(identity, item);
      }
      scoredCases.push(item);
    }
  }
  return { ok: errors.length === 0, errors, scored_cases: scoredCases, case_count: cases.length, scored_count: scoredCases.length };
}

function scanBlind(value, pathName = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanBlind(child, `${pathName}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && BLIND_FORBIDDEN_TEXT.test(value)) findings.push({ path: pathName, kind: 'forbidden_text' });
    return findings;
  }
  for (const [key, child] of Object.entries(value)) {
    if (BLIND_FORBIDDEN_KEYS.has(key)) findings.push({ path: `${pathName}.${key}`, kind: 'forbidden_key' });
    scanBlind(child, `${pathName}.${key}`, findings);
  }
  return findings;
}

export function validateBlindPacket(packet) {
  const findings = scanBlind(packet);
  return findings.length
    ? fail('GOLD_BLIND_PACKET_CONTAMINATED', { findings })
    : { ok: true, code: 'BLIND_PACKET_CLEAN' };
}

/**
 * Eval-only gate proving that the human-facing source rendering preserves the
 * canonical Requirement and Fact identities from the JSON source packet.
 * Expected/provider/production fields are intentionally outside this gate.
 */
export const SOURCE_PACKET_RENDER_PARITY_GATE = 'SOURCE_PACKET_RENDER_PARITY_GATE';

function parseSourcePacketRendering(markdown = '') {
  const headings = [...String(markdown).matchAll(/^### (REAL-MAP-CAND-\d{3})\s*$/gm)];
  const candidates = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : markdown.length;
    const body = markdown.slice(start, end);
    const field = name => {
      const match = body.match(new RegExp(`^- ${name}: (.*)$`, 'm'));
      return match ? match[1].trim().replaceAll('`', '') : null;
    };
    const facts = [];
    const factBlocks = body.split(/^#### Fact \d+\s*$/gm).slice(1);
    for (const factBody of factBlocks) {
      const factField = name => {
        const match = factBody.match(new RegExp(`^- ${name}: (.*)$`, 'm'));
        return match ? match[1].trim().replaceAll('`', '') : null;
      };
      facts.push({
        fact_id: factField('fact_id'),
        fact_ref: factField('fact_ref'),
        source_hash: factField('fact_source_hash')
      });
    }
    candidates.push({
      candidate_id: heading[1],
      requirement_id: field('requirement_id'),
      requirement_source_hash: field('requirement_source_hash'),
      facts
    });
  }
  return candidates;
}

export function validateSourcePacketRenderParity({ packet, markdown } = {}) {
  const expectedCandidates = Array.isArray(packet?.candidates) ? packet.candidates : [];
  const renderedCandidates = parseSourcePacketRendering(markdown);
  const renderedById = new Map(renderedCandidates.map(candidate => [candidate.candidate_id, candidate]));
  const mismatches = [];
  const sorted = values => [...values].sort();
  for (const expected of expectedCandidates) {
    const rendered = renderedById.get(expected.candidate_id);
    const expectedRequirement = expected.requirement || {};
    const expectedFacts = Array.isArray(expected.facts) ? expected.facts : [];
    const expectedFactIds = sorted(expectedFacts.map(fact => fact?.fact_id || null).filter(Boolean));
    const expectedFactRefs = sorted(expectedFacts.map(fact => fact?.fact_ref || null).filter(Boolean));
    const expectedFactHashes = sorted(expectedFacts.map(fact => fact?.source_hash || null).filter(Boolean));
    const actualFactIds = sorted((rendered?.facts || []).map(fact => fact?.fact_id || null).filter(Boolean));
    const actualFactRefs = sorted((rendered?.facts || []).map(fact => fact?.fact_ref || null).filter(Boolean));
    const actualFactHashes = sorted((rendered?.facts || []).map(fact => fact?.source_hash || null).filter(Boolean));
    const equal = (left, right) => stableSerialize(left) === stableSerialize(right);
    const row = {
      candidate_id: expected.candidate_id,
      requirement_id: { expected: expectedRequirement.requirement_id || null, actual: rendered?.requirement_id || null },
      requirement_source_hash: { expected: expectedRequirement.source_hash || null, actual: rendered?.requirement_source_hash || null },
      fact_id_set: { expected: expectedFactIds, actual: actualFactIds },
      fact_ref_set: { expected: expectedFactRefs, actual: actualFactRefs },
      fact_source_hash_set: { expected: expectedFactHashes, actual: actualFactHashes }
    };
    if (
      row.requirement_id.expected !== row.requirement_id.actual
      || row.requirement_source_hash.expected !== row.requirement_source_hash.actual
      || !equal(expectedFactIds, actualFactIds)
      || !equal(expectedFactRefs, actualFactRefs)
      || !equal(expectedFactHashes, actualFactHashes)
    ) mismatches.push(row);
  }
  for (const rendered of renderedCandidates) {
    if (!expectedCandidates.some(candidate => candidate.candidate_id === rendered.candidate_id)) {
      mismatches.push({ candidate_id: rendered.candidate_id, code: 'UNEXPECTED_RENDERED_CANDIDATE' });
    }
  }
  return mismatches.length
    ? fail('SOURCE_PACKET_RENDER_PARITY_MISMATCH', {
      gate: SOURCE_PACKET_RENDER_PARITY_GATE,
      total_cases: expectedCandidates.length,
      parity_pass_count: expectedCandidates.length - mismatches.filter(row => row.code === undefined).length,
      parity_fail_count: mismatches.filter(row => row.code === undefined).length,
      mismatches
    })
    : {
      ok: true,
      code: 'SOURCE_PACKET_RENDER_PARITY_PASS',
      gate: SOURCE_PACKET_RENDER_PARITY_GATE,
      total_cases: expectedCandidates.length,
      parity_pass_count: expectedCandidates.length,
      parity_fail_count: 0,
      mismatches: []
    };
}

/**
 * Compares a supplemental packet with its parent packet using only canonical
 * Requirement identity and sorted Fact identity. A matching pair is not
 * counted as a new Gold candidate until a human explicitly resolves it.
 *
 * The result is deliberately more detailed than a boolean gate: duplicates
 * remain auditable, while a changed Fact set is kept eligible for a new human
 * review packet and is never silently treated as an exact duplicate.
 */
export function comparePacketNovelty({ parentCandidates = [], supplementalCandidates = [] } = {}) {
  const identityToParent = new Map();
  const requirementToParents = new Map();
  const candidateIdentity = candidate => candidate?.candidate_id || candidate?.case_id || null;
  for (const candidate of parentCandidates) {
    const identity = semanticIdentity(candidate);
    const candidateId = candidateIdentity(candidate);
    identityToParent.set(identity, candidateId);
    const reqIdentity = requirementIdentity(candidate);
    const group = requirementToParents.get(reqIdentity) || [];
    group.push({ candidate_id: candidateId, identity, fact_identity: factRefs(candidate).join(',') });
    requirementToParents.set(reqIdentity, group);
  }
  const duplicate_pairs = [];
  const novel_candidates = [];
  const fact_set_changed_candidates = [];
  const classifications = [];
  const seenSupplemental = new Map();
  for (const candidate of supplementalCandidates) {
    const identity = semanticIdentity(candidate);
    const candidateId = candidateIdentity(candidate);
    const parentCandidateId = identityToParent.get(identity);
    if (parentCandidateId) {
      const duplicate = {
        candidate_id: candidateId,
        parent_candidate_id: parentCandidateId,
        identity,
        classification: 'DUPLICATE_PARENT_PAIR',
        duplicate_scope: 'parent_packet'
      };
      duplicate_pairs.push(duplicate);
      classifications.push(duplicate);
    } else if (seenSupplemental.has(identity)) {
      const duplicate = {
        candidate_id: candidateId,
        parent_candidate_id: seenSupplemental.get(identity),
        identity,
        classification: 'DUPLICATE_PARENT_PAIR',
        duplicate_scope: 'supplemental_packet'
      };
      duplicate_pairs.push(duplicate);
      classifications.push(duplicate);
    } else {
      const reqIdentity = requirementIdentity(candidate);
      const parentPairs = requirementToParents.get(reqIdentity) || [];
      if (parentPairs.length) {
        const changed = {
          candidate_id: candidateId,
          identity,
          requirement_identity: reqIdentity,
          parent_candidate_ids: parentPairs.map(pair => pair.candidate_id),
          classification: 'FACT_SET_CHANGED'
        };
        fact_set_changed_candidates.push(candidateId);
        classifications.push(changed);
      } else {
        novel_candidates.push(candidateId);
        classifications.push({ candidate_id: candidateId, identity, classification: 'NOVEL' });
      }
      seenSupplemental.set(identity, candidateId);
    }
  }
  const reviewRequired = duplicate_pairs.length > 0 || fact_set_changed_candidates.length > 0;
  return {
    ok: !reviewRequired,
    code: reviewRequired ? 'SUPPLEMENTAL_NOVELTY_REVIEW_REQUIRED' : 'SUPPLEMENTAL_NOVELTY_PASS',
    gate: REAL_GOLD_NOVELTY_GATE,
    duplicate_pairs,
    novel_candidates,
    fact_set_changed_candidates,
    classifications,
    eligible_new_count: novel_candidates.length + fact_set_changed_candidates.length
  };
}

const REVIEW_PACKET_FORBIDDEN_KEYS = new Set([
  'expected_decision',
  'expected_dimensions',
  'suggested_decision',
  'production_mapping_decision',
  'provider_result',
  'model_result',
  'historical_pass',
  'historical_fail'
]);

function projectReviewFact(fact = {}) {
  return {
    fact_id: fact.fact_id || fact.id || null,
    fact_ref: fact.fact_ref || fact.id || null,
    fact_type: fact.fact_type || null,
    subject: fact.subject || null,
    entities: fact.entities || [],
    status: fact.fact_status ?? fact.status ?? null,
    scopes: fact.scopes || [],
    quantities: fact.quantities || [],
    validity: fact.validity || null,
    currentness: fact.is_current ?? fact.currentness ?? null,
    source_reference: fact.source_ref || null,
    source_hash: fact.source_hash || null,
    source_location: fact.source_location || null,
    source_excerpt: fact.source_excerpt || null,
    source_metadata: fact.source_metadata || null
  };
}

function projectReviewCandidate(candidate, classification) {
  const requirement = candidate?.requirement || {};
  return {
    candidate_id: candidate?.candidate_id || candidate?.case_id || null,
    novelty_classification: classification,
    requirement: {
      requirement_id: requirement.requirement_id || requirement.id || null,
      text: requirement.text || requirement.requirement_text || null,
      category: requirement.category || null,
      source_reference: requirement.source_ref || null,
      source_hash: requirement.source_hash || null,
      source_location: requirement.source_range || requirement.source_location || null,
      source_excerpt: requirement.source_excerpt || null,
      project_or_tender_identity: requirement.project_or_tender_identity || null
    },
    facts: Array.isArray(candidate?.facts) ? candidate.facts.map(projectReviewFact) : []
  };
}

/**
 * Creates a blind, source-complete packet for only NOVEL/FACT_SET_CHANGED
 * supplemental identities. No expected or model-derived fields are copied.
 */
export function buildSupplementalHumanReviewPacket({ parentCandidates = [], supplementalCandidates = [] } = {}) {
  const novelty = comparePacketNovelty({ parentCandidates, supplementalCandidates });
  const classificationById = new Map(
    novelty.classifications.map(row => [row.candidate_id, row.classification])
  );
  const eligible = supplementalCandidates
    .filter(candidate => ['NOVEL', 'FACT_SET_CHANGED'].includes(classificationById.get(candidate?.candidate_id || candidate?.case_id)))
    .map(candidate => projectReviewCandidate(candidate, classificationById.get(candidate?.candidate_id || candidate?.case_id)));
  return {
    artifact_type: 'supplemental_human_review_packet',
    artifact_version: 'mapping-real-supplemental-human-review-v1',
    novelty_gate: REAL_GOLD_NOVELTY_GATE,
    selection_rule: 'NOVEL_OR_FACT_SET_CHANGED_ONLY',
    source_candidate_count: supplementalCandidates.length,
    duplicate_parent_pair_count: novelty.duplicate_pairs.filter(row => row.duplicate_scope === 'parent_packet').length,
    novel_count: novelty.novel_candidates.length,
    fact_set_changed_count: novelty.fact_set_changed_candidates.length,
    candidates: eligible
  };
}

export function validateSupplementalHumanReviewPacket(packet) {
  if (!packet || packet.artifact_type !== 'supplemental_human_review_packet') {
    return fail('HUMAN_REVIEW_PACKET_INVALID', { field: 'artifact_type' });
  }
  const forbidden = [];
  const walkPacket = (value, currentPath = '$') => {
    if (Array.isArray(value)) return value.forEach((item, index) => walkPacket(item, `${currentPath}[${index}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (REVIEW_PACKET_FORBIDDEN_KEYS.has(key)) forbidden.push(`${currentPath}.${key}`);
      walkPacket(child, `${currentPath}.${key}`);
    }
  };
  walkPacket(packet);
  if (forbidden.length) return fail('GOLD_BLIND_PACKET_CONTAMINATED', { findings: forbidden });
  const missing = [];
  for (const candidate of packet.candidates || []) {
    if (!candidate.candidate_id) missing.push({ candidate_id: null, field: 'candidate_id' });
    if (!['NOVEL', 'FACT_SET_CHANGED'].includes(candidate.novelty_classification)) {
      missing.push({ candidate_id: candidate.candidate_id, field: 'novelty_classification' });
    }
    const requirement = candidate.requirement || {};
    for (const field of ['requirement_id', 'text', 'category', 'source_reference', 'source_hash', 'source_excerpt']) {
      if (requirement[field] === null || requirement[field] === undefined || requirement[field] === '') {
        missing.push({ candidate_id: candidate.candidate_id, field: `requirement.${field}` });
      }
    }
    if (!Array.isArray(candidate.facts) || candidate.facts.length === 0) {
      missing.push({ candidate_id: candidate.candidate_id, field: 'facts' });
    }
    for (const fact of candidate.facts || []) {
      for (const field of ['fact_id', 'fact_ref', 'fact_type', 'source_reference', 'source_hash', 'source_excerpt']) {
        if (fact[field] === null || fact[field] === undefined || fact[field] === '') {
          missing.push({ candidate_id: candidate.candidate_id, field: `facts.${field}` });
        }
      }
    }
  }
  return missing.length
    ? fail('HUMAN_REVIEW_PACKET_SOURCE_FIELDS_MISSING', { missing })
    : { ok: true, code: 'HUMAN_REVIEW_PACKET_SOURCE_COMPLETE', candidate_count: packet.candidates?.length || 0 };
}

export function validateBatch01CaseAuthority(records, { expectedCount = 24 } = {}) {
  if (!Array.isArray(records) || records.length !== expectedCount) {
    return fail('HUMAN_AUTHORITY_COMPLETENESS_GAP', {
      expected_count: expectedCount,
      actual_count: Array.isArray(records) ? records.length : 0
    });
  }
  const required = ['candidate_id', 'pool_status', 'review_status', 'expected_decision', 'expected_dimensions', 'human_rationale', 'confidence'];
  const missing = [];
  const seen = new Set();
  for (const row of records) {
    if (row?.candidate_id && seen.has(row.candidate_id)) missing.push({ candidate_id: row.candidate_id, field: 'candidate_id.duplicate' });
    if (row?.candidate_id) seen.add(row.candidate_id);
    for (const field of required) {
      if (row?.[field] === undefined) missing.push({ candidate_id: row?.candidate_id || null, field });
    }
    if (row?.review_status !== undefined && !validateReviewStatus(row.review_status).ok) {
      missing.push({ candidate_id: row?.candidate_id || null, field: 'review_status.invalid' });
    }
    const isScoredPool = row?.pool_status === 'ACCEPT_FOR_GOLD_POOL';
    if (isScoredPool && (row?.expected_decision === null || row?.expected_dimensions === null)) {
      missing.push({ candidate_id: row?.candidate_id || null, field: 'scored_expected' });
    }
    if (!isScoredPool && (row?.expected_decision !== null || row?.expected_dimensions !== null)) {
      missing.push({ candidate_id: row?.candidate_id || null, field: 'unscored_expected_must_be_null' });
    }
  }
  return missing.length
    ? fail('HUMAN_AUTHORITY_COMPLETENESS_GAP', { expected_count: expectedCount, actual_count: records.length, missing })
    : { ok: true, code: 'CASE_LEVEL_HUMAN_AUTHORITY_PASS', case_count: records.length };
}

export function aggregateBatch01Authority(records = []) {
  const classification_counts = {};
  const accepted_distribution = {
    direct_full: 0,
    partial_support: 0,
    related_reference: 0,
    related_insufficient: 0,
    conflict: 0,
    unrelated: 0,
    unknown: 0
  };
  for (const row of records) {
    classification_counts[row?.pool_status || 'UNKNOWN'] = (classification_counts[row?.pool_status || 'UNKNOWN'] || 0) + 1;
    if (row?.pool_status === 'ACCEPT_FOR_GOLD_POOL') {
      const decision = row?.expected_decision || 'unknown';
      if (Object.hasOwn(accepted_distribution, decision)) accepted_distribution[decision] += 1;
      else accepted_distribution.unknown += 1;
    }
  }
  return { classification_counts, accepted_distribution };
}

export function validateBatch01AggregateParity(records, expected) {
  const actual = aggregateBatch01Authority(records);
  if (stableSerialize(actual) !== stableSerialize(expected || {})) {
    return fail('BATCH01_HUMAN_AUTHORITY_AGGREGATE_MISMATCH', { expected: expected || null, actual });
  }
  return { ok: true, code: 'BATCH01_AGGREGATE_PARITY_PASS', actual };
}

function walk(directory, fsImpl, found = []) {
  if (!fsImpl.existsSync(directory)) return found;
  for (const entry of fsImpl.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, fsImpl, found);
    else if (entry.isFile() && /\.(?:js|mjs|cjs|ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

export function validateProductionImportGuard({ productionRoot, repoRoot = process.cwd(), fsImpl = fs } = {}) {
  const root = productionRoot || path.join(repoRoot, 'backend', 'src');
  const offending_files = [];
  for (const file of walk(root, fsImpl)) {
    const source = fsImpl.readFileSync(file, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/(?:import\s+(?:[^'";]+?\s+from\s+)?|require\(\s*)['"]([^'"]+)['"]/);
      if (match && /(?:^|[\\/])eval(?:[\\/]|$)|gold-human-review|gold-governance/i.test(match[1])) {
        offending_files.push(path.relative(repoRoot, file).replaceAll('\\', '/'));
        break;
      }
    }
  }
  return offending_files.length
    ? fail('PRODUCTION_EVAL_CONTAMINATION', { offending_files })
    : { ok: true, code: 'PRODUCTION_IMPORT_GUARD_PASS', offending_files: [] };
}

export function mutationSensitivity({ item, prediction }) {
  const baselinePass = hasExpected(item) && stableSerialize(item.expected) === stableSerialize(prediction);
  const mutated = JSON.parse(JSON.stringify(item.expected || {}));
  mutated.decision = mutated.decision === 'direct_full' ? 'unrelated' : 'direct_full';
  const mutatedPass = stableSerialize(mutated) === stableSerialize(prediction);
  return { ok: baselinePass && !mutatedPass, baseline_pass: baselinePass, mutated_pass: mutatedPass };
}

function isScored(item) {
  const review = validateReviewStatus(item?.review_status);
  const classification = validateClassification(item?.classification);
  return review.ok && classification.ok && review.scored && classification.scored && hasExpected(item);
}

function expectedFor(item) {
  return item?.expected || null;
}

function predictionPass(item, prediction) {
  if (!isScored(item) || !prediction) return null;
  return stableSerialize(expectedFor(item)) === stableSerialize(prediction);
}

export function dualEvaluate({ predictions = [], oldGold = [], newGold = [] } = {}) {
  const predictionMap = new Map(predictions.map(item => [item.case_id, item.prediction ?? item.actual ?? null]));
  const oldMap = new Map(oldGold.map(item => [item.case_id, item]));
  const newMap = new Map(newGold.map(item => [item.case_id, item]));
  const ids = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort();
  return ids.map(case_id => {
    const oldItem = oldMap.get(case_id);
    const newItem = newMap.get(case_id);
    const prediction = predictionMap.get(case_id) || null;
    const oldScored = isScored(oldItem);
    const newScored = isScored(newItem);
    let delta_class = 'UNCHANGED';
    if (oldItem && !newItem) delta_class = 'REMOVED_FROM_SCORING';
    else if (!oldItem && newItem) delta_class = newScored ? 'ADDED_CASE' : 'DISPUTED';
    else if ((newItem && ['DISPUTED', 'REJECTED'].includes(newItem.review_status)) || (oldItem && ['DISPUTED', 'REJECTED'].includes(oldItem.review_status))) delta_class = 'DISPUTED';
    else if (oldItem && newItem && stableSerialize(oldItem.expected) !== stableSerialize(newItem.expected)) delta_class = 'GOLD_EXPECTATION_CHANGED';
    return {
      case_id,
      old_expected: oldItem?.expected ?? null,
      new_expected: newItem?.expected ?? null,
      prediction,
      old_pass: oldScored ? predictionPass(oldItem, prediction) : null,
      new_pass: newScored ? predictionPass(newItem, prediction) : null,
      delta_class
    };
  });
}

export function assertNoProductionSideEffects({ providerCalls = 0, dbWrites = 0, evidenceWrites = 0, mappingWrites = 0, claimWrites = 0 } = {}) {
  const values = { providerCalls, dbWrites, evidenceWrites, mappingWrites, claimWrites };
  const violations = Object.entries(values).filter(([, value]) => value !== 0);
  return violations.length ? fail('GOLD_GOVERNANCE_SIDE_EFFECT_DETECTED', { violations }) : { ok: true, code: 'SIDE_EFFECTS_ZERO' };
}
