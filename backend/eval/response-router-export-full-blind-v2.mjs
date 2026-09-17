import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CWD = path.resolve(process.cwd());
const ROOT = fs.existsSync(path.join(CWD, 'docs')) ? CWD : path.resolve(CWD, '..');
const DOCS = path.join(ROOT, 'docs');

export const SOURCE_ARTIFACTS = Object.freeze({
  CORE6: 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json',
  HOLDOUT_V1: 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/canonical-requirements.json',
  HOLDOUT_V2: 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/canonical-requirements.json'
});

export const EXPECTED_COUNTS = Object.freeze({ CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 });
export const SEMANTIC_CONTRACT_VERSION = 'V43_RESPONSE_ROUTER_GPT_SEMANTIC_CONTRACT_V2';
export const FORBIDDEN_FIELDS = Object.freeze([
  'response_role', 'response_mode', 'risk_tier', 'is_scoring_related',
  'scoring_priority', 'routing_reasons', 'secondary_dependencies',
  'evidence_dependency', 'deep_chain_required', 'human_required',
  'deterministic_projection', 'rule_path_trace', 'current_router',
  'codex_verdict', 'recommended_gold', 'provider_result', 'model_result'
]);
export const GPT_FIELDS = Object.freeze([
  'gpt_response_required', 'gpt_primary_response_mode', 'gpt_secondary_dependencies',
  'gpt_risk_tier', 'gpt_scoring_related', 'gpt_scoring_priority',
  'gpt_evidence_dependency', 'gpt_human_required', 'gpt_taxonomy_fit',
  'gpt_routing_reason_family', 'gpt_confidence', 'gpt_semantic_notes',
  'gpt_adjudication_status'
]);
export const INCLUDED_FIELDS = Object.freeze([
  'case_id', 'cohort', 'tender_id', 'requirement_id', 'requirement_text',
  'category', 'requirement_category', 'writer_eligible', 'mandatory',
  'mandatory_observed', 'requires_confirmation', 'confirmation_reasons',
  'risk_flags', 'source_refs', 'source_excerpt', 'source_span', 'source_hash',
  'source_verified', 'source_location', 'requirement_hash', ...GPT_FIELDS
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readRaw = (relative) => fs.readFileSync(path.join(ROOT, relative));
const readJson = (relative) => JSON.parse(readRaw(relative));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

function rowsFromArtifact(artifact) {
  if (Array.isArray(artifact)) return artifact;
  for (const key of ['requirements', 'canonical_requirements', 'cases', 'data']) {
    if (Array.isArray(artifact?.[key])) return artifact[key];
  }
  throw new Error('INPUT_SHAPE_INVALID');
}

function valueOrNull(row, keys) {
  for (const key of keys) if (hasOwn(row, key)) return clone(row[key]);
  return null;
}

function normalizeRow(row, cohort, index) {
  const requirementId = valueOrNull(row, ['canonical_requirement_id', 'requirement_id']);
  if (!requirementId) throw new Error(`${cohort}:MISSING_REQUIREMENT_ID:${index}`);
  const tenderId = valueOrNull(row, ['tender_id', 'holdout_tender_id']);
  const requirementText = valueOrNull(row, ['requirement_text', 'text', 'canonical_requirement_text']);
  const sourceVerified = hasOwn(row, 'source_verified')
    ? clone(row.source_verified)
    : (hasOwn(row, 'source_location_verified') ? clone(row.source_location_verified) : null);
  const out = {
    case_id: `${cohort}:${tenderId ?? 'UNKNOWN_TENDER'}:${requirementId}`,
    cohort,
    tender_id: tenderId,
    requirement_id: requirementId,
    requirement_text: requirementText,
    category: valueOrNull(row, ['category']),
    requirement_category: valueOrNull(row, ['requirement_category']),
    writer_eligible: valueOrNull(row, ['writer_eligible']),
    mandatory: valueOrNull(row, ['mandatory']),
    mandatory_observed: valueOrNull(row, ['mandatory_observed']),
    requires_confirmation: valueOrNull(row, ['requires_confirmation']),
    confirmation_reasons: valueOrNull(row, ['confirmation_reasons']),
    risk_flags: valueOrNull(row, ['risk_flags']),
    source_refs: valueOrNull(row, ['source_refs']),
    source_excerpt: valueOrNull(row, ['source_excerpt']),
    source_span: valueOrNull(row, ['source_span']),
    source_hash: valueOrNull(row, ['source_hash']),
    source_verified: sourceVerified,
    source_location: valueOrNull(row, ['source_location']),
    requirement_hash: valueOrNull(row, ['requirement_hash']),
    gpt_response_required: null,
    gpt_primary_response_mode: null,
    gpt_secondary_dependencies: null,
    gpt_risk_tier: null,
    gpt_scoring_related: null,
    gpt_scoring_priority: null,
    gpt_evidence_dependency: null,
    gpt_human_required: null,
    gpt_taxonomy_fit: null,
    gpt_routing_reason_family: null,
    gpt_confidence: null,
    gpt_semantic_notes: null,
    gpt_adjudication_status: null
  };
  return { out, row };
}

function recursivelyFindKeys(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) recursivelyFindKeys(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_FIELDS.includes(key)) found.push(key);
      recursivelyFindKeys(child, found);
    }
  }
  return found;
}

function assertBlind(rows) {
  const violations = [];
  for (const row of rows) {
    for (const key of recursivelyFindKeys(row)) violations.push(`${row.case_id}:${key}`);
    for (const key of GPT_FIELDS) if (row[key] !== null) violations.push(`${row.case_id}:${key}:NON_NULL`);
  }
  return [...new Set(violations)];
}

function comparePreservedFields(source, out) {
  const checks = [
    ['requirement_id', valueOrNull(source, ['canonical_requirement_id', 'requirement_id'])],
    ['tender_id', valueOrNull(source, ['tender_id', 'holdout_tender_id'])],
    ['requirement_text', valueOrNull(source, ['requirement_text', 'text', 'canonical_requirement_text'])],
    ['category', valueOrNull(source, ['category'])],
    ['requirement_category', valueOrNull(source, ['requirement_category'])],
    ['writer_eligible', valueOrNull(source, ['writer_eligible'])],
    ['mandatory', valueOrNull(source, ['mandatory'])],
    ['mandatory_observed', valueOrNull(source, ['mandatory_observed'])],
    ['requires_confirmation', valueOrNull(source, ['requires_confirmation'])],
    ['confirmation_reasons', valueOrNull(source, ['confirmation_reasons'])],
    ['risk_flags', valueOrNull(source, ['risk_flags'])],
    ['source_refs', valueOrNull(source, ['source_refs'])],
    ['source_excerpt', valueOrNull(source, ['source_excerpt'])],
    ['source_span', valueOrNull(source, ['source_span'])],
    ['source_hash', valueOrNull(source, ['source_hash'])],
    ['source_verified', hasOwn(source, 'source_verified') ? source.source_verified : (hasOwn(source, 'source_location_verified') ? source.source_location_verified : null)],
    ['source_location', valueOrNull(source, ['source_location'])],
    ['requirement_hash', valueOrNull(source, ['requirement_hash'])]
  ];
  return checks.filter(([key, expected]) => JSON.stringify(out[key]) !== JSON.stringify(expected));
}

function gitStatus() {
  try {
    const short = execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' });
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    return { dirty: short.trim().length > 0, status_entry_count: short.trim() ? short.trim().split(/\r?\n/).length : 0, status_sha256: sha256(short), branch, head };
  } catch {
    return { dirty: null, status_entry_count: null, status_sha256: null, branch: null, head: null };
  }
}

export function buildFullBlindExport() {
  const cohorts = {};
  const allRows = [];
  const sourceMeta = [];
  let semanticMutationCount = 0;
  let sourceHashPresent = 0;
  let sourceHashMissing = 0;
  for (const [cohort, relative] of Object.entries(SOURCE_ARTIFACTS)) {
    const raw = readRaw(relative);
    const source = JSON.parse(raw);
    const rows = rowsFromArtifact(source);
    const expected = EXPECTED_COUNTS[cohort];
    if (rows.length !== expected) throw new Error(`${cohort}:COUNT_MISMATCH:${rows.length}:${expected}`);
    const normalized = rows.map((row, index) => normalizeRow(row, cohort, index));
    const outputRows = normalized.map(({ out, row }) => {
      const mismatches = comparePreservedFields(row, out);
      semanticMutationCount += mismatches.length;
      if (out.source_hash == null) sourceHashMissing += 1; else sourceHashPresent += 1;
      return out;
    });
    const ids = outputRows.map((row) => row.requirement_id);
    if (new Set(ids).size !== ids.length) throw new Error(`${cohort}:DUPLICATE_REQUIREMENT_ID`);
    cohorts[cohort] = outputRows;
    allRows.push(...outputRows);
    sourceMeta.push({
      cohort,
      path: relative,
      sha256: sha256(raw),
      row_count: rows.length,
      source_hash_present_count: outputRows.filter((row) => row.source_hash != null).length,
      source_hash_missing_count: outputRows.filter((row) => row.source_hash == null).length,
      source_hash_preservation: 'PRESERVED_WHEN_PRESENT'
    });
  }
  const combinedKeys = allRows.map((row) => `${row.cohort}\u0000${row.tender_id ?? ''}\u0000${row.requirement_id}`);
  if (new Set(combinedKeys).size !== combinedKeys.length) throw new Error('COMBINED_COHORT_TENDER_REQUIREMENT_ID_COLLISION');
  const blindViolations = assertBlind(allRows);
  if (blindViolations.length) throw new Error(`BLINDNESS_VIOLATION:${blindViolations.slice(0, 5).join('|')}`);
  if (semanticMutationCount !== 0) throw new Error(`SEMANTIC_MUTATION:${semanticMutationCount}`);
  const status = gitStatus();
  const artifact = {
    artifact_type: 'V43_RESPONSE_ROUTER_GPT_BLIND_FULL_CORPUS_INPUT',
    artifact_version: 'v2',
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    blind: true,
    generated_at: new Date().toISOString(),
    branch: status.branch,
    head: status.head,
    worktree: { dirty: status.dirty, status_entry_count: status.status_entry_count, status_sha256: status.status_sha256 },
    source_artifacts: sourceMeta,
    cohort_counts: Object.fromEntries(Object.entries(cohorts).map(([key, rows]) => [key, rows.length])),
    total_count: allRows.length,
    field_inclusion_list: INCLUDED_FIELDS,
    field_exclusion_list: FORBIDDEN_FIELDS,
    gpt_fields: GPT_FIELDS,
    requirements: allRows
  };
  const rawIds = allRows.map((row) => row.requirement_id);
  const checkpoint = {
    artifact_type: 'V43_RESPONSE_ROUTER_GPT_BLIND_FULL_CORPUS_CHECKPOINT',
    artifact_version: 'v2',
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    FULL_CORPUS_COUNT: allRows.length,
    EXPECTED_FULL_CORPUS_COUNT: 2178,
    CORE6_COUNT: cohorts.CORE6.length,
    HOLDOUT_V1_COUNT: cohorts.HOLDOUT_V1.length,
    HOLDOUT_V2_COUNT: cohorts.HOLDOUT_V2.length,
    CORE6_EXPECTED_COUNT: EXPECTED_COUNTS.CORE6,
    HOLDOUT_V1_EXPECTED_COUNT: EXPECTED_COUNTS.HOLDOUT_V1,
    HOLDOUT_V2_EXPECTED_COUNT: EXPECTED_COUNTS.HOLDOUT_V2,
    COHORT_COUNTS_PASS: allRows.length === 2178,
    IDS_UNIQUE_WITHIN_COHORT: Object.fromEntries(Object.entries(cohorts).map(([key, rows]) => [key, new Set(rows.map((row) => row.requirement_id)).size === rows.length])),
    COMBINED_COHORT_TENDER_REQUIREMENT_IDS_UNIQUE: new Set(combinedKeys).size === combinedKeys.length,
    CROSS_COHORT_RAW_REQUIREMENT_ID_OVERLAP_COUNT: rawIds.length - new Set(rawIds).size,
    ROW_LOSS_OR_ADDITION_COUNT: 0,
    SOURCE_HASH_PRESENT_COUNT: sourceHashPresent,
    SOURCE_HASH_MISSING_COUNT: sourceHashMissing,
    SOURCE_HASH_PRESERVATION: 'PRESERVED_WHEN_PRESENT',
    SEMANTIC_MUTATION_COUNT: semanticMutationCount,
    DETERMINISTIC_ROUTER_FIELDS_PRESENT: false,
    BLINDNESS_VIOLATION_COUNT: blindViolations.length,
    GPT_LABELS_PRESENT: 0,
    GPT_FIELDS_ALL_NULL: true,
    PROVIDER_CALLS: 0,
    LLM_CALLS: 0,
    PRODUCTION_DB_WRITES: 0,
    FACT_PERSISTENCE: 0,
    GOLD_MUTATIONS: 0,
    MAPPING_ACTIONS: 0,
    CLAIM_ACTIONS: 0,
    WRITER_ACTIONS: 0,
    PRODUCTION_ROUTING_CHANGES: 0,
    COMMIT: 0,
    PUSH: 0,
    MERGE: 0,
    DEPLOY: 0,
    status: 'READY_FOR_GPT_FULL_CORPUS_SEMANTIC_REFERENCE_V2'
  };
  return { artifact, checkpoint };
}

export function writeFullBlindExport() {
  const { artifact, checkpoint } = buildFullBlindExport();
  const generatedAt = artifact.generated_at;
  for (const cohort of Object.keys(EXPECTED_COUNTS)) {
    const source = artifact.source_artifacts.find((item) => item.cohort === cohort);
    writeJson(path.join(DOCS, `V43_RESPONSE_ROUTER_BLIND_GPT_V2_${cohort}_${EXPECTED_COUNTS[cohort]}.json`), {
      artifact_type: `V43_RESPONSE_ROUTER_BLIND_GPT_V2_${cohort}_INPUT`,
      artifact_version: 'v2',
      semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
      blind: true,
      generated_at: generatedAt,
      cohort,
      source_artifact: source.path,
      source_artifact_sha256: source.sha256,
      count: artifact.cohort_counts[cohort],
      field_inclusion_list: INCLUDED_FIELDS,
      field_exclusion_list: FORBIDDEN_FIELDS,
      requirements: artifact.requirements.filter((row) => row.cohort === cohort)
    });
  }
  writeJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_BLIND_GPT_V2_MANIFEST.json'), {
    artifact_type: 'V43_RESPONSE_ROUTER_BLIND_GPT_V2_MANIFEST',
    artifact_version: 'v2',
    semantic_contract_version: SEMANTIC_CONTRACT_VERSION,
    blind: true,
    generated_at: generatedAt,
    branch: artifact.branch,
    head: artifact.head,
    worktree: artifact.worktree,
    source_artifacts: artifact.source_artifacts,
    cohort_counts: artifact.cohort_counts,
    total_count: artifact.total_count,
    field_inclusion_list: INCLUDED_FIELDS,
    field_exclusion_list: FORBIDDEN_FIELDS,
    duplicate_id_checks: { within_cohort: checkpoint.IDS_UNIQUE_WITHIN_COHORT },
    cross_cohort_collision_checks: {
      combined_cohort_tender_requirement_id_unique: checkpoint.COMBINED_COHORT_TENDER_REQUIREMENT_IDS_UNIQUE,
      raw_requirement_id_overlap_count: checkpoint.CROSS_COHORT_RAW_REQUIREMENT_ID_OVERLAP_COUNT
    },
    source_hash_preservation: {
      status: checkpoint.SOURCE_HASH_PRESERVATION,
      present_count: checkpoint.SOURCE_HASH_PRESENT_COUNT,
      missing_count: checkpoint.SOURCE_HASH_MISSING_COUNT
    },
    semantic_mutation_count: checkpoint.SEMANTIC_MUTATION_COUNT,
    GPT_LABELS_PRESENT: checkpoint.GPT_LABELS_PRESENT,
    side_effects: {
      PROVIDER_CALLS: checkpoint.PROVIDER_CALLS,
      LLM_CALLS: checkpoint.LLM_CALLS,
      PRODUCTION_DB_WRITES: checkpoint.PRODUCTION_DB_WRITES,
      FACT_PERSISTENCE: checkpoint.FACT_PERSISTENCE,
      GOLD_MUTATIONS: checkpoint.GOLD_MUTATIONS,
      MAPPING_ACTIONS: checkpoint.MAPPING_ACTIONS,
      CLAIM_ACTIONS: checkpoint.CLAIM_ACTIONS,
      WRITER_ACTIONS: checkpoint.WRITER_ACTIONS,
      PRODUCTION_ROUTING_CHANGES: checkpoint.PRODUCTION_ROUTING_CHANGES,
      COMMIT: checkpoint.COMMIT,
      PUSH: checkpoint.PUSH,
      MERGE: checkpoint.MERGE,
      DEPLOY: checkpoint.DEPLOY
    },
    status: checkpoint.status
  });
  writeJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_BLIND_GPT_V2_CHECKPOINT.json'), checkpoint);
  return { artifact, checkpoint };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const { checkpoint } = writeFullBlindExport();
  console.log(JSON.stringify({
    status: checkpoint.status,
    counts: { CORE6: checkpoint.CORE6_COUNT, HOLDOUT_V1: checkpoint.HOLDOUT_V1_COUNT, HOLDOUT_V2: checkpoint.HOLDOUT_V2_COUNT, total: checkpoint.FULL_CORPUS_COUNT },
    ids_unique_within_cohort: checkpoint.IDS_UNIQUE_WITHIN_COHORT,
    combined_ids_unique: checkpoint.COMBINED_COHORT_TENDER_REQUIREMENT_IDS_UNIQUE,
    semantic_mutation_count: checkpoint.SEMANTIC_MUTATION_COUNT,
    gpt_labels_present: checkpoint.GPT_LABELS_PRESENT,
    provider_calls: checkpoint.PROVIDER_CALLS,
    production_db_writes: checkpoint.PRODUCTION_DB_WRITES
  }, null, 2));
}
