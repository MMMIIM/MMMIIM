import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

import {
  stableSemanticHash,
  stableSemanticSerialize,
  validateBlindPacket,
  validateProductionImportGuard,
  assertNoProductionSideEffects
} from './gold-governance-harness-v1.js';

/**
 * Eval-only source export. It renders source material for human review and
 * keeps current authority in a separate overlay. It never imports Production
 * services, calls a Provider, writes a database, or changes Gold.
 */

export const MAPPING_FULL_HUMAN_REVIEW_EXPORT_VERSION = 'mapping-full-human-review-export-v1';
export const HUMAN_REVIEW_EXPORT_PARITY_GATE = 'HUMAN_REVIEW_EXPORT_PARITY_GATE';

const backendRoot = fs.existsSync('backend/eval') ? 'backend' : '.';
const repoPath = relative => path.join(backendRoot, relative);
const readJson = relative => JSON.parse(fs.readFileSync(repoPath(relative), 'utf8'));
const sha256File = relative => crypto.createHash('sha256').update(fs.readFileSync(repoPath(relative))).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (left, right) => stableSemanticSerialize(left) === stableSemanticSerialize(right);

const parentPath = 'eval/gold-human-review/v2/01_mapping_real_source_packet.json';
const supplementalPath = 'eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json';
const supplementalReviewPath = 'eval/gold-human-review/v2/05_mapping_real_supplemental_human_review_packet.json';
const batchAuthorityPath = 'eval/gold-human-review/v2/02_mapping_batch01_human_adjudication.json';
const supplementalAuthorityPath = 'eval/gold-human-review/v2/06_mapping_supplemental_human_adjudication.json';
const oldGoldPath = 'eval/requirement-evidence-mapping-v1/gold-cases.json';
const syntheticPath = 'eval/requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json';
const correctionPath = 'eval/requirement-evidence-mapping-v2/synthetic-corrections-v1.json';
const engineeringPath = 'eval/requirement-evidence-mapping-v2/engineering-fixtures-v2.json';
const disputedPath = 'eval/requirement-evidence-mapping-v2/disputed-cases-v2.json';
const successorPath = 'eval/requirement-evidence-mapping-v2/successor-manifest.json';

const parent = readJson(parentPath);
const supplemental = readJson(supplementalPath);
const supplementalReview = readJson(supplementalReviewPath);
const batchAuthority = readJson(batchAuthorityPath);
const supplementalAuthority = readJson(supplementalAuthorityPath);
const oldGold = readJson(oldGoldPath);
const synthetic = readJson(syntheticPath);
const corrections = readJson(correctionPath);
const engineering = readJson(engineeringPath);
const disputed = readJson(disputedPath);
const successor = readJson(successorPath);

function sorted(values) {
  return [...values].map(value => String(value ?? '')).sort();
}

/** Canonical source identity for real Requirement + complete Fact provenance. */
export function realSourceIdentity(candidate = {}) {
  const requirement = candidate.requirement || {};
  return {
    candidate_id: candidate.candidate_id || null,
    requirement_id: requirement.requirement_id || null,
    requirement_source_hash: requirement.source_hash || null,
    fact_id_set: sorted((candidate.facts || []).map(fact => fact.fact_id || null).filter(Boolean)),
    fact_ref_set: sorted((candidate.facts || []).map(fact => fact.fact_ref || null).filter(Boolean)),
    fact_source_hash_set: sorted((candidate.facts || []).map(fact => fact.source_hash || null).filter(Boolean)),
    fact_source_excerpt_hash_set: sorted((candidate.facts || []).map(fact => fact.source_excerpt ? stableSemanticHash({ excerpt: fact.source_excerpt }) : null).filter(Boolean)),
    fact_count: Array.isArray(candidate.facts) ? candidate.facts.length : 0
  };
}

/**
 * Identity used only for parent/supplemental exact-pair comparison.  Pair
 * novelty is semantic (canonical Requirement plus sorted Fact refs); source
 * hashes remain part of the full source identity/parity gate below.
 */
export function realPairIdentity(candidate = {}) {
  const requirement = candidate.requirement || {};
  return {
    requirement_identity: requirement.requirement_id
      || requirement.id
      || requirement.text
      || requirement.requirement_text
      || null,
    fact_identity_set: sorted((candidate.facts || [])
      .map(fact => fact?.fact_ref || fact?.fact_id || null)
      .filter(Boolean))
  };
}

export function syntheticSourceIdentity(candidate = {}) {
  return {
    case_id: candidate.case_id || null,
    requirement: clone(candidate.requirement || {}),
    facts: clone(candidate.facts || []),
    fixture_input: clone(candidate.fixture_input || {})
  };
}

function userReviewTemplate() {
  return {
    USER_SOURCE_QUALITY: { options: ['PASS', 'FAIL', 'DISPUTED'], selected: null },
    USER_MAPPING_DECISION: { options: ['direct_full', 'partial_support', 'related_reference', 'related_insufficient', 'conflict', 'unrelated', 'unknown', 'NOT_SUITABLE_FOR_GOLD'], selected: null },
    USER_DIMENSIONS: { subject: null, scope: null, status: null, quantity: null, entity: null, validity: null },
    USER_SCORE_ELIGIBILITY: { options: ['SCORED', 'RESERVE', 'DISPUTED', 'REMOVE'], selected: null },
    USER_CONFIDENCE: null,
    USER_RATIONALE: ''
  };
}

function mapFact(fact = {}) {
  const metadata = fact.source_metadata || {};
  return {
    ...clone(fact),
    source_quality_review: 'UNREVIEWED_BY_USER',
    currentness: fact.currentness ?? fact.is_current ?? fact.fact_current ?? null,
    source_reference: fact.source_reference ?? fact.source_ref ?? null,
    material_identity: metadata.material_id ?? null,
    material_type: metadata.material_type ?? null,
    source_authority: metadata.source_authority ?? null,
    source_org: metadata.source_org ?? null,
    source_name: metadata.source_name ?? null,
    source_url: metadata.source_url ?? null,
    minimum_source_excerpt: fact.source_excerpt ?? null
  };
}

function mapRealCandidate(candidate, sourceOrigin) {
  const requirement = candidate.requirement || {};
  const mapped = {
    candidate_id: candidate.candidate_id,
    mapping_evaluation_unit: candidate.mapping_evaluation_unit || null,
    source_origin: sourceOrigin,
    requirement: {
      requirement_id: requirement.requirement_id || null,
      requirement_category: requirement.category ?? null,
      requirement_text: requirement.text ?? null,
      requirement_excerpt: requirement.source_excerpt ?? null,
      source_reference: requirement.source_ref ?? null,
      source_hash: requirement.source_hash ?? null,
      source_location: requirement.source_range ?? null,
      mapping_eligibility: requirement.mapping_eligibility ?? null,
      atomicity_status: requirement.atomicity_status ?? null,
      scope_status: requirement.scope_status ?? null,
      project_or_tender_identity: requirement.project_or_tender_identity ?? null
    },
    facts: (candidate.facts || []).map(mapFact),
    source_identity: realSourceIdentity(candidate),
    user_review_template: userReviewTemplate()
  };
  return mapped;
}

function renderValue(value) {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderUserTemplate() {
  return [
    '#### USER REVIEW (blank)',
    '- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED',
    '- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD',
    '- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =',
    '- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE',
    '- USER_CONFIDENCE:',
    '- USER_RATIONALE:'
  ].join('\n');
}

function renderRealCandidate(candidate) {
  const req = candidate.requirement || {};
  const factBlocks = (candidate.facts || []).map((fact, index) => [
    `#### Fact ${index + 1}`,
    ...Object.entries(fact).map(([key, value]) => `- ${key}: ${renderValue(value)}`)
  ].join('\n')).join('\n\n');
  return [
    `### ${candidate.candidate_id}`,
    `- source_origin: ${candidate.source_origin}`,
    `- mapping_evaluation_unit: ${candidate.mapping_evaluation_unit}`,
    '',
    '#### Requirement',
    ...Object.entries(req).map(([key, value]) => `- ${key}: ${renderValue(value)}`),
    '',
    factBlocks || '#### Fact 0\n- no_fact: true',
    '',
    renderUserTemplate()
  ].join('\n');
}

function stripSyntheticForBlind(item) {
  const fixtureInput = {};
  for (const [key, value] of Object.entries(item)) {
    if (['case_id', 'requirement', 'facts', 'label', 'expected', 'classification', 'review_status', 'scored', 'exclusion_reason'].includes(key)) continue;
    fixtureInput[key] = clone(value);
  }
  return {
    case_id: item.case_id,
    requirement: clone(item.requirement || {}),
    facts: clone(item.facts || []),
    fixture_input: fixtureInput,
    source_identity: syntheticSourceIdentity({ ...item, fixture_input: fixtureInput }),
    user_review_template: userReviewTemplate()
  };
}

function renderSyntheticCandidate(candidate) {
  const facts = (candidate.facts || []).map((fact, index) => [
    `#### Fact ${index + 1}`,
    ...Object.entries(fact).map(([key, value]) => `- ${key}: ${renderValue(value)}`)
  ].join('\n')).join('\n\n');
  return [
    `### ${candidate.case_id}`,
    '#### Requirement',
    `- text: ${renderValue(candidate.requirement?.text)}`,
    `- structured_fields: ${renderValue(Object.fromEntries(Object.entries(candidate.requirement || {}).filter(([key]) => key !== 'text')))}`,
    '',
    facts || '#### Fact 0\n- no_fact: true',
    '',
    `#### Fixture input metadata\n- ${renderValue(candidate.fixture_input)}`,
    '',
    renderUserTemplate()
  ].join('\n');
}

function stripExpectedForEngineering(item) {
  const fixtureInput = {};
  for (const [key, value] of Object.entries(item)) {
    if (['label', 'expected', 'classification', 'review_status', 'scored', 'exclusion_reason'].includes(key)) continue;
    fixtureInput[key] = clone(value);
  }
  return {
    case_id: item.case_id,
    current_classification: item.classification,
    fixture_input: fixtureInput,
    deterministic_behavior_tested: item.governance_purpose,
    semantic_expected_decision: item.expected?.decision ?? 'ABSENT',
    excluded_from_semantic_denominator: true,
    exclusion_reason: item.exclusion_reason || (item.classification === 'DISPUTED_CASE' ? 'DISPUTED_HUMAN_REVIEW' : 'ENGINEERING_REGRESSION')
  };
}

function realOverlayRows(realCandidates) {
  const authority = new Map([
    ...(batchAuthority.case_level_adjudications || []),
    ...(supplementalAuthority.records || [])
  ].map(item => [item.candidate_id, item]));
  return realCandidates.map(candidate => {
    const row = authority.get(candidate.candidate_id) || {};
    const successorCase = (readJson('eval/requirement-evidence-mapping-v2/real-derived-gold-v1.json').cases || []).find(item => item.case_id === candidate.candidate_id);
    return {
      candidate_id: candidate.candidate_id,
      existing_pool_status: row.pool_status ?? successorCase?.human_authority?.pool_status ?? null,
      existing_scored: row.scored ?? successorCase?.scored ?? null,
      existing_expected_decision: row.expected_decision ?? successorCase?.expected?.decision ?? null,
      existing_expected_dimensions: row.expected_dimensions ?? successorCase?.expected?.dimensions ?? null,
      existing_human_rationale: row.human_rationale ?? null,
      existing_confidence: row.confidence ?? successorCase?.human_authority?.confidence ?? null
    };
  });
}

function markdownOverlay(rows) {
  const body = rows.map(row => [
    `### ${row.candidate_id}`,
    `- existing_pool_status: ${renderValue(row.existing_pool_status)}`,
    `- existing_scored: ${renderValue(row.existing_scored)}`,
    `- existing_expected_decision: ${renderValue(row.existing_expected_decision)}`,
    `- existing_expected_dimensions: ${renderValue(row.existing_expected_dimensions)}`,
    `- existing_human_rationale: ${renderValue(row.existing_human_rationale)}`,
    `- existing_confidence: ${renderValue(row.existing_confidence)}`
  ].join('\n')).join('\n\n');
  return [
    '# Mapping Real Current Authority Overlay',
    '',
    'This file is a post-blind-review comparison overlay. It is intentionally separate from the blind packet.',
    '',
    body
  ].join('\n');
}

function markdownSyntheticOverlay(rows) {
  const body = rows.map(row => [
    `### ${row.case_id}`,
    `- old_expected_decision: ${renderValue(row.old_expected?.decision)}`,
    `- old_expected_dimensions: ${renderValue(row.old_expected?.dimensions)}`,
    `- successor_expected_decision: ${renderValue(row.successor_expected?.decision)}`,
    `- successor_expected_dimensions: ${renderValue(row.successor_expected?.dimensions)}`,
    `- changed: ${row.changed}`,
    `- change_authority: ${renderValue(row.change_authority)}`,
    `- rationale: ${renderValue(row.rationale)}`
  ].join('\n')).join('\n\n');
  return [
    '# Mapping Synthetic Boundary Current Expected Overlay',
    '',
    'This file is a post-blind-review comparison overlay. It is intentionally separate from the blind packet.',
    '',
    body
  ].join('\n');
}

function compareRealParity(parentCandidates, supplementalCandidates, renderedCandidates) {
  const canonical = [...parentCandidates, ...supplementalCandidates].map(realSourceIdentity).sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const rendered = renderedCandidates.map(item => item.source_identity).sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const details = {
    candidate_identity: canonical.map(item => item.candidate_id).join('|') === rendered.map(item => item.candidate_id).join('|'),
    requirement_identity_hash: equal(canonical.map(item => [item.candidate_id, item.requirement_id, item.requirement_source_hash]), rendered.map(item => [item.candidate_id, item.requirement_id, item.requirement_source_hash])),
    sorted_fact_ids: equal(canonical.map(item => [item.candidate_id, item.fact_id_set]), rendered.map(item => [item.candidate_id, item.fact_id_set])),
    sorted_fact_refs: equal(canonical.map(item => [item.candidate_id, item.fact_ref_set]), rendered.map(item => [item.candidate_id, item.fact_ref_set])),
    sorted_fact_source_hashes: equal(canonical.map(item => [item.candidate_id, item.fact_source_hash_set]), rendered.map(item => [item.candidate_id, item.fact_source_hash_set])),
    fact_counts: equal(canonical.map(item => [item.candidate_id, item.fact_count]), rendered.map(item => [item.candidate_id, item.fact_count])),
    source_excerpts: equal(canonical.map(item => [item.candidate_id, item.fact_source_excerpt_hash_set]), rendered.map(item => [item.candidate_id, item.fact_source_excerpt_hash_set]))
  };
  return { gate: HUMAN_REVIEW_EXPORT_PARITY_GATE, ok: Object.values(details).every(Boolean), details };
}

function compareSyntheticParity(sourceCases, renderedCases) {
  const canonical = sourceCases.map(stripSyntheticForBlind).map(syntheticSourceIdentity).sort((a, b) => a.case_id.localeCompare(b.case_id));
  const rendered = renderedCases.map(item => item.source_identity).sort((a, b) => a.case_id.localeCompare(b.case_id));
  return { gate: HUMAN_REVIEW_EXPORT_PARITY_GATE, ok: equal(canonical, rendered), count: canonical.length };
}

function writeJson(relative, value) {
  fs.writeFileSync(repoPath(relative), JSON.stringify(value, null, 2) + '\n');
}

function writeText(relative, value) {
  fs.writeFileSync(repoPath(relative), value.endsWith('\n') ? value : value + '\n');
}

export function buildMappingGoldFullHumanReviewExport({ writeArtifacts = true } = {}) {
  const parentCandidates = parent.candidates || [];
  const allSupplemental = supplemental.candidates || [];
  const reviewSupplementalIds = new Set((supplementalReview.candidates || []).map(item => item.candidate_id));
  const selectedSupplemental = allSupplemental.filter(item => reviewSupplementalIds.has(item.candidate_id));
  const parentIdentityMap = new Map(parentCandidates.map(item => [stableSemanticSerialize(realPairIdentity(item)), item.candidate_id]));
  const duplicateRelationships = [];
  for (const candidate of allSupplemental) {
    const parentId = parentIdentityMap.get(stableSemanticSerialize(realPairIdentity(candidate)));
    if (parentId) duplicateRelationships.push({ candidate_id: candidate.candidate_id, parent_candidate_id: parentId, identity_hash: stableSemanticHash(realPairIdentity(candidate)) });
  }

  const realBlindCandidates = [
    ...parentCandidates.map(item => mapRealCandidate(item, 'PARENT_PACKET')),
    ...selectedSupplemental.map(item => mapRealCandidate(item, 'SUPPLEMENTAL_UNIQUE_REVIEW'))
  ];
  const realBlind = {
    artifact_type: 'mapping_real_full_human_review_blind',
    artifact_version: MAPPING_FULL_HUMAN_REVIEW_EXPORT_VERSION,
    data_classification: 'REAL_DERIVED_SOURCE_ONLY',
    source_packet: 'mapping-real-source-packet-v1',
    parent_case_count: parentCandidates.length,
    supplemental_unique_review_count: selectedSupplemental.length,
    duplicate_excluded_count: duplicateRelationships.length,
    duplicate_relationships: duplicateRelationships,
    source_candidate_count: realBlindCandidates.length,
    candidates: realBlindCandidates
  };
  const realOverlay = realOverlayRows(realBlindCandidates);

  const semanticCases = (synthetic.cases || []).filter(item => item.classification === 'SYNTHETIC_BOUNDARY_GOLD' && item.scored === true);
  const syntheticBlindCandidates = semanticCases.map(stripSyntheticForBlind);
  const syntheticBlind = {
    artifact_type: 'mapping_synthetic_boundary_human_review_blind',
    artifact_version: MAPPING_FULL_HUMAN_REVIEW_EXPORT_VERSION,
    data_classification: synthetic.data_classification || 'EVAL_SYNTHETIC',
    dataset_id: synthetic.dataset_id,
    dataset_version: synthetic.dataset_version,
    source_dataset: synthetic.source_dataset,
    source_case_count: semanticCases.length,
    candidates: syntheticBlindCandidates
  };
  const oldById = new Map((oldGold.cases || []).map(item => [item.case_id, item]));
  const correctionById = new Map((corrections.corrections || []).map(item => [item.case_id, item]));
  const syntheticOverlay = semanticCases.map(item => {
    const correction = correctionById.get(item.case_id);
    const old = oldById.get(item.case_id);
    return {
      case_id: item.case_id,
      old_expected: correction?.old_expected ?? old?.expected ?? null,
      successor_expected: correction?.new_expected ?? item.expected ?? null,
      changed: Boolean(correction) || !equal(old?.expected ?? null, item.expected ?? null),
      change_authority: correction?.change_type ?? 'UNCHANGED_FROZEN_SUCCESSOR_INPUT',
      rationale: correction?.human_rationale ?? 'No correction record; successor expected input retained.'
    };
  });

  const engineeringCases = (engineering.cases || []).map(stripExpectedForEngineering);
  const disputedCases = (disputed.cases || []).map(stripExpectedForEngineering);
  const engineeringDisputed = {
    artifact_type: 'mapping_engineering_and_disputed_review',
    artifact_version: MAPPING_FULL_HUMAN_REVIEW_EXPORT_VERSION,
    semantic_gold: false,
    engineering: engineeringCases,
    disputed: disputedCases
  };

  const realParity = compareRealParity(parentCandidates, selectedSupplemental, realBlindCandidates);
  const syntheticParity = compareSyntheticParity(semanticCases, syntheticBlindCandidates);
  const realBlindGate = validateBlindPacket(realBlind);
  const syntheticBlindGate = validateBlindPacket(syntheticBlind);
  const sideEffects = assertNoProductionSideEffects({ providerCalls: 0, dbWrites: 0 });
  const productionGuard = validateProductionImportGuard({ repoRoot: backendRoot === 'backend' ? path.resolve('..') : process.cwd() });
  const oldGoldSha = sha256File(oldGoldPath);
  const currentBranch = (() => { try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
  const currentHead = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();

  const result = {
    checkpoint: 'V43_MAPPING_GOLD_FULL_HUMAN_REVIEW_EXPORT_CHECKPOINT',
    task: 'V43_MAPPING_GOLD_FULL_HUMAN_REVIEW_EXPORT',
    branch: currentBranch,
    head: currentHead,
    real_review_packet_ready: realBlindGate.ok && realParity.ok,
    real_review_case_count: realBlindCandidates.length,
    real_parent_case_count: parentCandidates.length,
    real_supplemental_unique_review_count: selectedSupplemental.length,
    real_total_human_review_count: realBlindCandidates.length,
    real_duplicate_excluded_count: duplicateRelationships.length,
    synthetic_review_packet_ready: syntheticBlindGate.ok && syntheticParity.ok,
    synthetic_review_case_count: semanticCases.length,
    engineering_disputed_packet_ready: engineeringCases.length + disputedCases.length > 0,
    engineering_count: engineeringCases.length,
    disputed_count: disputedCases.length,
    real_render_parity: realParity.ok ? 'PASS' : 'FAIL',
    real_render_parity_details: realParity.details,
    synthetic_render_parity: syntheticParity.ok ? 'PASS' : 'FAIL',
    expected_label_leakage_in_blind_packets: realBlindGate.ok && syntheticBlindGate.ok ? 'NONE' : 'PRESENT',
    old_gold_sha_before: oldGoldSha,
    old_gold_sha_after: sha256File(oldGoldPath),
    old_gold_sha_parity: oldGoldSha === sha256File(oldGoldPath) ? 'PASS' : 'FAIL',
    active_gold_changed: 0,
    production_files_changed: 0,
    provider_calls: 0,
    dify_calls: 0,
    embedding_calls: 0,
    db_writes: 0,
    focused_tests: 'PENDING',
    lint: 'PENDING',
    git_diff_check: 'PENDING',
    immutable_input_hashes: {
      parent_packet: sha256File(parentPath),
      supplemental_packet: sha256File(supplementalPath),
      active_mapping_gold: oldGoldSha
    },
    duplicate_relationships: duplicateRelationships,
    output_files: [
      'backend/eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.json',
      'backend/eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.md',
      'backend/eval/gold-human-review/v2/11b_mapping_real_current_authority_overlay.md',
      'backend/eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.json',
      'backend/eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.md',
      'backend/eval/gold-human-review/v2/12b_mapping_synthetic_current_expected_overlay.md',
      'backend/eval/gold-human-review/v2/13_mapping_engineering_disputed_review.md',
      'backend/eval/gold-human-review/v2/10_mapping_full_human_review_index.md',
      'backend/eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.json',
      'backend/eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.md'
    ],
    gates: {
      [HUMAN_REVIEW_EXPORT_PARITY_GATE]: realParity.ok && syntheticParity.ok ? 'PASS' : 'FAIL',
      blind_contamination: realBlindGate.ok && syntheticBlindGate.ok ? 'PASS' : 'FAIL',
      production_import_guard: productionGuard.ok ? 'PASS' : 'FAIL',
      side_effect_gate: sideEffects.ok ? 'PASS' : 'FAIL'
    },
    final_verdict: realBlindGate.ok && syntheticBlindGate.ok && realParity.ok && syntheticParity.ok && productionGuard.ok && sideEffects.ok
      ? 'MAPPING_FULL_HUMAN_REVIEW_PACKETS_READY'
      : 'MAPPING_FULL_HUMAN_REVIEW_EXPORT_REMEDIATION_REQUIRED',
    not_claimed: ['MAPPING_GOLD_V2_FROZEN', 'MAPPING_SEMANTIC_LIVE_PASS', 'MAPPING_PRODUCTION_READY']
  };

  if (writeArtifacts) {
    const realMd = [
      '# Mapping Real Derived Full Human Review — Blind',
      '',
      '- source-only packet; review the source before opening the current authority overlay',
      `- parent cases: ${parentCandidates.length}`,
      `- supplemental unique review cases: ${selectedSupplemental.length}`,
      `- exact parent duplicates excluded from rendering: ${duplicateRelationships.length}`,
      '',
      ...realBlindCandidates.map(renderRealCandidate)
    ].join('\n\n');
    const syntheticMd = [
      '# Mapping Synthetic Boundary Full Human Review — Blind',
      '',
      '- source-only packet; engineering/disputed cases are exported separately',
      `- semantic boundary cases: ${semanticCases.length}`,
      '',
      ...syntheticBlindCandidates.map(renderSyntheticCandidate)
    ].join('\n\n');
    const engineeringBody = [...engineeringCases, ...disputedCases].map(item => [
      `### ${item.case_id}`,
      `- current_classification: ${item.current_classification}`,
      `- fixture_input: ${renderValue(item.fixture_input)}`,
      `- deterministic_behavior_tested: ${renderValue(item.deterministic_behavior_tested)}`,
      `- semantic_expected_decision: ${item.semantic_expected_decision}`,
      `- excluded_from_semantic_denominator: ${item.excluded_from_semantic_denominator}`,
      `- exclusion_reason: ${item.exclusion_reason}`
    ].join('\n')).join('\n\n');
    const engineeringMd = [
      '# Mapping Engineering + Disputed Review',
      '',
      '- This surface is not Semantic Gold and is excluded from the semantic denominator.',
      '',
      engineeringBody
    ].join('\n');
    const indexMd = [
      '# V43 Mapping Gold Full Human Review Export',
      '',
      'Review the blind packets first. Open the authority overlays only after independent review is complete.',
      '',
      '## A — Real Derived Blind Review',
      '',
      '- `11_mapping_real_full_human_review_blind.json`',
      '- `11_mapping_real_full_human_review_blind.md`',
      '',
      '## A2 — Real Current Authority Overlay',
      '',
      '- `11b_mapping_real_current_authority_overlay.md`',
      '',
      '## B — Synthetic Boundary Blind Review',
      '',
      '- `12_mapping_synthetic_boundary_human_review_blind.json`',
      '- `12_mapping_synthetic_boundary_human_review_blind.md`',
      '',
      '## B2 — Synthetic Current Expected Overlay',
      '',
      '- `12b_mapping_synthetic_current_expected_overlay.md`',
      '',
      '## C — Engineering + Disputed Review',
      '',
      '- `13_mapping_engineering_disputed_review.md`',
      '- C is not Semantic Gold.'
    ].join('\n');
    writeJson('eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.json', realBlind);
    writeText('eval/gold-human-review/v2/11_mapping_real_full_human_review_blind.md', realMd);
    writeText('eval/gold-human-review/v2/11b_mapping_real_current_authority_overlay.md', markdownOverlay(realOverlay));
    writeJson('eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.json', syntheticBlind);
    writeText('eval/gold-human-review/v2/12_mapping_synthetic_boundary_human_review_blind.md', syntheticMd);
    writeText('eval/gold-human-review/v2/12b_mapping_synthetic_current_expected_overlay.md', markdownSyntheticOverlay(syntheticOverlay));
    writeText('eval/gold-human-review/v2/13_mapping_engineering_disputed_review.md', engineeringMd);
    writeText('eval/gold-human-review/v2/10_mapping_full_human_review_index.md', indexMd);
    writeJson('eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.json', result);
    writeText('eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.md', [
      '# V43_MAPPING_GOLD_FULL_HUMAN_REVIEW_EXPORT_CHECKPOINT',
      '',
      ...Object.entries(result).map(([key, value]) => `- ${key.toUpperCase()}: ${typeof value === 'object' ? JSON.stringify(value) : value}`),
      '',
      'Blind packets contain no expected/provider/production answers. Authority overlays are separate by design.'
    ].join('\n'));
  }
  return { result, realBlind, syntheticBlind, engineeringDisputed, realOverlay, syntheticOverlay };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  const { result } = buildMappingGoldFullHumanReviewExport();
  process.stdout.write(JSON.stringify({
    real_review_packet_ready: result.real_review_packet_ready,
    real_review_case_count: result.real_review_case_count,
    real_duplicate_excluded_count: result.real_duplicate_excluded_count,
    synthetic_review_packet_ready: result.synthetic_review_packet_ready,
    synthetic_review_case_count: result.synthetic_review_case_count,
    engineering_count: result.engineering_count,
    disputed_count: result.disputed_count,
    gates: result.gates,
    provider_calls: result.provider_calls,
    db_writes: result.db_writes,
    final_verdict: result.final_verdict
  }, null, 2) + '\n');
}
