import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');

const SOURCE_ARTIFACTS = Object.freeze({
  CORE6: 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json',
  HOLDOUT_V1: 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/canonical-requirements.json',
  HOLDOUT_V2: 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/canonical-requirements.json'
});

const SOURCE_SIDE_ARTIFACTS = Object.freeze({
  'HOLDOUT-REQ-01': 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/source-side-blind-review-packets/HOLDOUT-REQ-01.json',
  'HOLDOUT-REQ-02': 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/source-side-blind-review-packets/HOLDOUT-REQ-02.json',
  'HOLDOUT-REQ-V2-01': 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/source-side-blind-review-packets/HOLDOUT-REQ-V2-01.json',
  'HOLDOUT-REQ-V2-02': 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/source-side-blind-review-packets/HOLDOUT-REQ-V2-02.json'
});

const EXPECTED_COUNTS = Object.freeze({ CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 });
const V2_REFERENCE_PATH = 'docs/V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V2_2178.json';
const V2_REFERENCE_SHA256 = 'b6faf37c1ed33e5d8c26d830d6cf9d25f139b4bafeb4f78ac9294f13acb40507';
const ROUTER_EVAL_PATH = 'docs/V43_RESPONSE_ROUTER_V2_DEV_CORPUS_EVAL.json';
const FAILURE_FAMILIES_PATH = 'docs/V43_RESPONSE_ROUTER_V2_FAILURE_FAMILIES.json';

const V3_FIELDS = Object.freeze([
  'v3_semantic_primary_mode', 'v3_semantic_status', 'v3_expected_router_mode',
  'v3_risk_tier', 'v3_secondary_dependencies', 'v3_evidence_dependency',
  'v3_human_required', 'v3_response_required', 'v3_scoring_related',
  'v3_scoring_priority', 'v3_reason'
]);

const FORBIDDEN_FIELDS = Object.freeze([
  'response_role', 'response_mode', 'risk_tier', 'is_scoring_related',
  'scoring_priority', 'routing_reasons', 'secondary_dependencies',
  'evidence_dependency', 'deep_chain_required', 'human_required',
  'deterministic_projection', 'rule_path_trace', 'implementation_id',
  'projection_version', 'current_router', 'codex_verdict', 'recommended_gold',
  'provider_result', 'model_result', 'failure_family', 'agreement_state',
  'current_agreement', 'previous_gpt_adjudication'
]);

const REFERENCE_PROJECTION_FIELDS = Object.freeze([
  'response_required', 'primary_response_mode', 'secondary_dependencies',
  'risk_tier', 'scoring_related', 'scoring_priority', 'evidence_dependency',
  'human_required', 'taxonomy_fit', 'routing_reason_family', 'confidence',
  'semantic_notes', 'adjudication_status'
]);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readRaw = relative => fs.readFileSync(path.join(ROOT, relative));
const readJson = relative => JSON.parse(readRaw(relative));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const valueOrNull = (row, keys) => {
  for (const key of keys) if (hasOwn(row, key)) return clone(row[key]);
  return null;
};
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

function rowsFromArtifact(artifact) {
  if (Array.isArray(artifact)) return artifact;
  for (const key of ['requirements', 'canonical_requirements', 'rows']) {
    if (Array.isArray(artifact?.[key])) return artifact[key];
  }
  throw new Error('INPUT_SHAPE_INVALID');
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function loadSourceSideIndex() {
  const index = new Map();
  for (const [tenderId, relative] of Object.entries(SOURCE_SIDE_ARTIFACTS)) {
    if (!fs.existsSync(path.join(ROOT, relative))) continue;
    const packet = readJson(relative);
    const entries = Array.isArray(packet.entries) ? packet.entries : [];
    index.set(tenderId, entries.map((entry, i) => ({ ...clone(entry), _index: i })));
  }
  return index;
}

function contextFromEntries(tenderId, row, sourceSideIndex) {
  const entries = sourceSideIndex.get(tenderId) || [];
  const refs = Array.isArray(row.source_refs) ? row.source_refs.filter(value => typeof value === 'string') : [];
  let matches = [];
  if (refs.length) {
    matches = entries.filter(entry => refs.includes(entry.source_ref)
      || (Array.isArray(entry.source_refs) && entry.source_refs.some(ref => refs.includes(ref))));
  }
  const excerpt = typeof row.source_excerpt === 'string' ? row.source_excerpt : '';
  if (!matches.length && excerpt) {
    const needle = normalizeSpace(excerpt);
    matches = entries.filter(entry => normalizeSpace(entry.text).includes(needle) || needle.includes(normalizeSpace(entry.text)));
  }
  const first = matches[0];
  const before = first && first._index > 0 ? entries[first._index - 1] : null;
  const after = first && first._index + 1 < entries.length ? entries[first._index + 1] : null;
  const render = entry => entry ? {
    page: Number.isInteger(entry.page) ? entry.page : null,
    paragraph: Number.isInteger(entry.paragraph) ? entry.paragraph : null,
    source_ref: typeof entry.source_ref === 'string' ? entry.source_ref : null,
    text: typeof entry.text === 'string' ? entry.text : null
  } : null;
  return {
    exact_source_excerpt: nonEmpty(excerpt) ? excerpt : null,
    context_before: render(before),
    context_after: render(after),
    matched_source_entries: matches.slice(0, 20).map(render),
    source_context_match: entries.length ? matches.length > 0 : null,
    source_context_basis: entries.length ? 'canonical_plus_source_side_packet' : 'canonical_requirement_artifact'
  };
}

function normalizeRow(row, cohort, sourceSideIndex) {
  const requirementId = valueOrNull(row, ['canonical_requirement_id', 'requirement_id']);
  const tenderId = valueOrNull(row, ['tender_id', 'holdout_tender_id']);
  const requirementText = valueOrNull(row, ['requirement_text', 'canonical_requirement_text', 'text']);
  if (!requirementId || !tenderId || !nonEmpty(requirementText)) {
    throw new Error(`${cohort}:MISSING_UPSTREAM_IDENTITY`);
  }
  const sourceExcerpt = valueOrNull(row, ['source_excerpt', 'resolved_source_context', 'natural_parent_context']);
  const sourceRefs = valueOrNull(row, ['source_refs']) || [];
  const sourceSpan = valueOrNull(row, ['source_span']);
  const sourceHash = valueOrNull(row, ['source_hash']);
  const sourceVerified = hasOwn(row, 'source_verified')
    ? clone(row.source_verified)
    : hasOwn(row, 'source_location_verified') ? clone(row.source_location_verified) : null;
  const out = {
    case_id: `${cohort}:${tenderId}:${requirementId}`,
    cohort,
    tender_id: tenderId,
    requirement_id: requirementId,
    requirement_text: requirementText,
    category: valueOrNull(row, ['category']),
    requirement_category: valueOrNull(row, ['requirement_category']),
    mandatory_observed: valueOrNull(row, ['mandatory_observed']),
    requires_confirmation: valueOrNull(row, ['requires_confirmation']),
    confirmation_reasons: valueOrNull(row, ['confirmation_reasons']),
    risk_flags: valueOrNull(row, ['risk_flags']),
    source_refs: sourceRefs,
    source_excerpt: sourceExcerpt,
    source_span: sourceSpan,
    source_hash: sourceHash,
    source_verified: sourceVerified,
    writer_eligible: valueOrNull(row, ['writer_eligible']),
    source_context: contextFromEntries(tenderId, { ...row, source_excerpt: sourceExcerpt, source_refs: sourceRefs }, sourceSideIndex),
    v3_semantic_primary_mode: null,
    v3_semantic_status: null,
    v3_expected_router_mode: null,
    v3_risk_tier: null,
    v3_secondary_dependencies: null,
    v3_evidence_dependency: null,
    v3_human_required: null,
    v3_response_required: null,
    v3_scoring_related: null,
    v3_scoring_priority: null,
    v3_reason: null
  };
  return out;
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
    for (const key of V3_FIELDS) if (row[key] !== null) violations.push(`${row.case_id}:${key}:NON_NULL`);
  }
  return [...new Set(violations)];
}

function gitIdentity() {
  const run = args => {
    try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
  };
  const status = run(['status', '--short']) || '';
  return {
    branch: run(['branch', '--show-current']),
    head: run(['rev-parse', 'HEAD']),
    worktree_dirty: status.length > 0,
    status_entry_count: status ? status.split(/\r?\n/).length : 0,
    status_sha256: sha256(status)
  };
}

function buildSealedKey(reference, routerEval, failureFamilies) {
  const routerByCase = new Map((routerEval.rows || []).map(row => [row.case_id, row]));
  const referenceByCase = new Map((reference.requirements || []).map(row => [row.case_id, row]));
  const familyByCase = new Map();
  for (const family of failureFamilies.families || []) {
    for (const caseId of family.case_ids || []) {
      const list = familyByCase.get(caseId) || [];
      list.push(family.id);
      familyByCase.set(caseId, list);
    }
  }
  const cases = [];
  for (const [caseId, routerRow] of routerByCase.entries()) {
    const referenceRow = referenceByCase.get(caseId);
    if (!referenceRow) throw new Error(`REFERENCE_CASE_MISSING:${caseId}`);
    const referenceProjection = Object.fromEntries(REFERENCE_PROJECTION_FIELDS.map(field => [
      field,
      clone(referenceRow[`gpt_${field}`])
    ]));
    cases.push({
      case_id: caseId,
      reference_v2_projection: referenceProjection,
      router_v2_projection: clone(routerRow.router),
      current_agreement_fields: clone(routerRow.agreements),
      old_failure_family_membership: [...(familyByCase.get(caseId) || [])].sort()
    });
  }
  if (cases.length !== 2178) throw new Error(`SEALED_CASE_COUNT_MISMATCH:${cases.length}`);
  return {
    artifact_type: 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_SEALED_COMPARISON_KEY',
    artifact_version: 'v3',
    generated_at: new Date().toISOString(),
    sealed_for_later_comparison_only: true,
    source_reference_v2_sha256: V2_REFERENCE_SHA256,
    router_v2_eval_run_id: routerEval.run_id,
    case_count: cases.length,
    cases
  };
}

function build() {
  const referenceRaw = readRaw(V2_REFERENCE_PATH);
  const referenceSha = sha256(referenceRaw);
  if (referenceSha !== V2_REFERENCE_SHA256) throw new Error(`REFERENCE_V2_SHA_MISMATCH:${referenceSha}`);
  const sourceSideIndex = loadSourceSideIndex();
  const allRows = [];
  const sourceMeta = [];
  const cohortCounts = {};
  for (const [cohort, relative] of Object.entries(SOURCE_ARTIFACTS)) {
    const raw = readRaw(relative);
    const rows = rowsFromArtifact(JSON.parse(raw));
    if (rows.length !== EXPECTED_COUNTS[cohort]) throw new Error(`${cohort}:COUNT_MISMATCH:${rows.length}`);
    const normalized = rows.map(row => normalizeRow(row, cohort, sourceSideIndex));
    const ids = normalized.map(row => row.requirement_id);
    if (new Set(ids).size !== ids.length) throw new Error(`${cohort}:DUPLICATE_REQUIREMENT_ID`);
    allRows.push(...normalized);
    cohortCounts[cohort] = normalized.length;
    sourceMeta.push({ cohort, path: relative, sha256: sha256(raw), row_count: rows.length });
  }
  if (allRows.length !== 2178) throw new Error(`FULL_COUNT_MISMATCH:${allRows.length}`);
  const caseIds = allRows.map(row => row.case_id);
  if (new Set(caseIds).size !== caseIds.length) throw new Error('CASE_ID_DUPLICATE');
  const sourceContextMissing = allRows.filter(row => !nonEmpty(row.source_context?.exact_source_excerpt));
  if (sourceContextMissing.length) throw new Error(`SOURCE_CONTEXT_INCOMPLETE:${sourceContextMissing.map(row => row.case_id).join(',')}`);
  const blindViolations = assertBlind(allRows);
  if (blindViolations.length) throw new Error(`BLINDNESS_VIOLATION:${blindViolations.slice(0, 10).join('|')}`);
  const routerEval = readJson(ROUTER_EVAL_PATH);
  const failureFamilies = readJson(FAILURE_FAMILIES_PATH);
  const sealed = buildSealedKey(readJson(V2_REFERENCE_PATH), routerEval, failureFamilies);
  const identity = gitIdentity();
  const generatedAt = new Date().toISOString();
  const packet = {
    artifact_type: 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_BLIND_PACKET',
    artifact_version: 'v3',
    semantic_contract_version: 'V43_RESPONSE_ROUTER_GPT_SEMANTIC_CONTRACT_V3',
    blind: true,
    generated_at: generatedAt,
    branch: identity.branch,
    head: identity.head,
    worktree: identity,
    source_artifacts: sourceMeta,
    cohort_counts: cohortCounts,
    total_count: allRows.length,
    source_context_gate: {
      missing_source_context_count: sourceContextMissing.length,
      source_context_sufficient_for_semantic_adjudication: sourceContextMissing.length === 0
    },
    v3_audit_fields: V3_FIELDS,
    audit_fields_null: true,
    requirements: allRows
  };
  const manifest = {
    artifact_type: 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_BLIND_MANIFEST',
    artifact_version: 'v3',
    semantic_contract_version: packet.semantic_contract_version,
    blind: true,
    generated_at: generatedAt,
    total_rows: allRows.length,
    unique_case_ids: new Set(caseIds).size,
    CORE6_count: cohortCounts.CORE6,
    HOLDOUT_V1_count: cohortCounts.HOLDOUT_V1,
    HOLDOUT_V2_count: cohortCounts.HOLDOUT_V2,
    missing_source_context_count: sourceContextMissing.length,
    blind_key_violation_count: blindViolations.length,
    audit_fields_null: true,
    v3_audit_fields: V3_FIELDS,
    reference_v2_sha256: referenceSha,
    router_v2_eval_run_id: routerEval.run_id,
    source_artifacts: sourceMeta,
    side_effects: {
      PROVIDER_CALLS: 0, LLM_CALLS: 0, PRODUCTION_DB_WRITES: 0, GOLD_MUTATIONS: 0,
      REFERENCE_V2_MUTATIONS: 0, ROUTER_V1_MUTATIONS: 0, ROUTER_V2_MUTATIONS: 0,
      REQUIREMENT_MUTATIONS: 0, FACT_MUTATIONS: 0, MAPPING: 0, CLAIM: 0,
      WRITER: 0, PRODUCTION_ROUTING_CHANGE: 0, COMMIT: 0, PUSH: 0, MERGE: 0, DEPLOY: 0
    },
    status: 'READY_FOR_GPT_RESPONSE_ROUTER_FULL_CORPUS_V3_SEMANTIC_ADJUDICATION'
  };
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_BLIND_PACKET_2178.json'), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_SEALED_KEY.json'), `${JSON.stringify(sealed, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_BLIND_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { packet, sealed, manifest };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const { packet, sealed, manifest } = build();
    console.log(JSON.stringify({
      status: manifest.status,
      total: packet.total_count,
      cohorts: packet.cohort_counts,
      missing_source_context: manifest.missing_source_context_count,
      blind_key_violations: manifest.blind_key_violation_count,
      sealed_cases: sealed.case_count,
      provider_calls: manifest.side_effects.PROVIDER_CALLS,
      llm_calls: manifest.side_effects.LLM_CALLS
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', code: error?.message || String(error) }, null, 2));
    process.exitCode = 1;
  }
}

export { build };
