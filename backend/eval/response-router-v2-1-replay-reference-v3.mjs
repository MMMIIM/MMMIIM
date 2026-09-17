import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { projectRequirementResponseV21, RESPONSE_ROUTER_V21_VERSION, RESPONSE_ROUTER_V21_IMPLEMENTATION_ID } from '../../backend/src/pipeline/requirement-response-router-v2-1.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const REFERENCE_FILE = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json');
const REFERENCE_PACKAGE = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip');
const REFERENCE_ENTRY = 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json';
const V2_FILE = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V2_2178.json');
const SEALED_KEY_FILE = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_V3_SEALED_KEY.json');
const ROUTER_FILE = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-1.js');
const EXPECTED_REFERENCE_SHA = '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744';
const EXPECTED_V2_SHA = 'b6faf37c1ed33e5d8c26d830d6cf9d25f139b4bafeb4f78ac9294f13acb40507';
const EXPECTED_COHORTS = Object.freeze({ CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 });
const MODES = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW']);
const RISKS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'P0']);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const hashJson = value => sha256(Buffer.from(stable(value), 'utf8'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const textOf = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const countBy = (rows, selector) => rows.reduce((out, row) => {
  const key = String(selector(row) ?? 'null');
  out[key] = (out[key] || 0) + 1;
  return out;
}, {});
const sortedObject = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

function readZipEntry(zipPath, targetName) {
  const buffer = fs.readFileSync(zipPath);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('REFERENCE_PACKAGE_EOCD_MISSING');
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  let offset = centralOffset;
  const end = centralOffset + centralSize;
  while (offset < end && buffer.readUInt32LE(offset) === 0x02014b50) {
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === targetName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('REFERENCE_PACKAGE_LOCAL_HEADER_MISSING');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compression === 0) return compressed;
      if (compression === 8) return zlib.inflateRawSync(compressed);
      throw new Error(`REFERENCE_PACKAGE_COMPRESSION_UNSUPPORTED:${compression}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`REFERENCE_PACKAGE_ENTRY_MISSING:${targetName}`);
}

function loadReference() {
  if (fs.existsSync(REFERENCE_FILE)) {
    const raw = fs.readFileSync(REFERENCE_FILE);
    return { raw, value: JSON.parse(raw.toString('utf8')), locator: path.relative(ROOT, REFERENCE_FILE) };
  }
  const raw = readZipEntry(REFERENCE_PACKAGE, REFERENCE_ENTRY);
  return { raw, value: JSON.parse(raw.toString('utf8')), locator: `${path.relative(ROOT, REFERENCE_PACKAGE)}#${REFERENCE_ENTRY}` };
}

function gitInfo() {
  try {
    const status = execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' });
    return {
      branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      dirty: Boolean(status.trim()),
      status_entry_count: status.trim() ? status.trim().split(/\r?\n/).length : 0,
      status_sha256: sha256(status)
    };
  } catch { return { branch: null, head: null, dirty: null, status_entry_count: null, status_sha256: null }; }
}

function confusionMatrix(rows, actual, expected, labels) {
  const matrix = Object.fromEntries(labels.map(label => [label, Object.fromEntries(labels.map(other => [other, 0]))]));
  for (const row of rows) {
    const a = String(actual(row) ?? 'null');
    const e = String(expected(row) ?? 'null');
    if (!matrix[a]) matrix[a] = {};
    matrix[a][e] = (matrix[a][e] || 0) + 1;
  }
  return matrix;
}

function perModeMetrics(rows, actual, expected) {
  return Object.fromEntries(MODES.map(mode => {
    const tp = rows.filter(row => actual(row) === mode && expected(row) === mode).length;
    const fp = rows.filter(row => actual(row) === mode && expected(row) !== mode).length;
    const fn = rows.filter(row => actual(row) !== mode && expected(row) === mode).length;
    return [mode, { true_positive: tp, false_positive: fp, false_negative: fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn) }];
  }));
}

function agreement(rows, left, right) {
  const count = rows.filter(row => left(row) === right(row)).length;
  return { count, rate: pct(count, rows.length) };
}

function v3Mode(row) {
  return row.v3_expected_router_mode || (row.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : row.v3_semantic_primary_mode);
}

function buildRows(reference, v2, sealedKey) {
  const v2ByCase = new Map(v2.requirements.map(row => [row.case_id, row]));
  const sealedByCase = new Map(sealedKey.cases.map(row => [row.case_id, row]));
  return reference.requirements.map(requirement => {
    const router = projectRequirementResponseV21(requirement, { projection_version: RESPONSE_ROUTER_V21_VERSION });
    const historical = v2ByCase.get(requirement.case_id);
    const sealed = sealedByCase.get(requirement.case_id);
    const expectedMode = v3Mode(requirement);
    const expected = {
      primary_response_mode: expectedMode,
      semantic_primary_mode: requirement.v3_semantic_primary_mode || null,
      semantic_status: requirement.v3_semantic_status || null,
      risk_tier: requirement.v3_risk_tier,
      response_required: requirement.v3_response_required,
      evidence_dependency: requirement.v3_evidence_dependency,
      human_required: requirement.v3_human_required,
      scoring_related: requirement.v3_scoring_related,
      scoring_priority: requirement.v3_scoring_priority ?? null,
      secondary_dependencies: requirement.v3_secondary_dependencies || [],
      reason: requirement.v3_reason || null
    };
    const disagreementDimensions = [];
    if (router.response_mode !== expected.primary_response_mode) disagreementDimensions.push('primary_response_mode');
    if (router.risk_tier !== expected.risk_tier) disagreementDimensions.push('risk_tier');
    if (router.response_required !== expected.response_required) disagreementDimensions.push('response_required');
    if (router.evidence_dependency !== expected.evidence_dependency) disagreementDimensions.push('evidence_dependency');
    if (router.human_required !== expected.human_required) disagreementDimensions.push('human_required');
    if (router.is_scoring_related !== expected.scoring_related) disagreementDimensions.push('scoring_related');
    return {
      case_id: requirement.case_id,
      cohort: requirement.cohort,
      tender_id: requirement.tender_id,
      requirement_id: requirement.requirement_id,
      requirement_text: requirement.requirement_text,
      category: requirement.category,
      requirement_category: requirement.requirement_category,
      v3: expected,
      router,
      v2: historical ? {
        primary_response_mode: historical.gpt_primary_response_mode,
        risk_tier: historical.gpt_risk_tier,
        response_required: historical.gpt_response_required,
        evidence_dependency: historical.gpt_evidence_dependency,
        human_required: historical.gpt_human_required,
        scoring_related: historical.gpt_scoring_related
      } : null,
      sealed_router_projection_match: Boolean(sealed?.router_v2_projection && hashJson(sealed.router_v2_projection) === hashJson(router)),
      disagreement_dimensions: disagreementDimensions,
      disagrees: disagreementDimensions.length > 0
    };
  });
}

function failureFamilyRows(rows) {
  const families = [
    ['PRODUCT_AS_PROJECT_SOLUTION', row => row.v3.primary_response_mode === 'EVIDENCE' && row.router.response_mode === 'SOLUTION' && (row.v3.secondary_dependencies.includes('ENTERPRISE_EVIDENCE') || /PRODUCT|ENTERPRISE|CAPABILITY|产品|企业|能力/i.test(String(row.v3.reason || '')))],
    ['PROJECT_SOLUTION_AS_ENTERPRISE_EVIDENCE', row => row.v3.primary_response_mode === 'SOLUTION' && row.router.response_mode === 'EVIDENCE'],
    ['POST_AWARD_COMMITMENT_AS_EVIDENCE', row => row.v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'EVIDENCE'],
    ['POST_AWARD_COMMITMENT_AS_COMPLIANCE', row => row.v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'COMPLIANCE'],
    ['PRE_AWARD_COMPLIANCE_AS_COMMITMENT', row => row.v3.primary_response_mode === 'COMPLIANCE' && row.router.response_mode === 'COMMITMENT'],
    ['P0_CONSEQUENCE_TARGET_ERROR', row => row.v3.risk_tier === 'P0' && (row.router.risk_tier !== 'P0' || !['COMPLIANCE', 'NEED_REVIEW'].includes(row.router.response_mode))],
    ['PROOF_DOCUMENT_PRIMARY_MODE_ERROR', row => row.v3.primary_response_mode === 'EVIDENCE' && row.v3.secondary_dependencies.includes('PROOF_DOCUMENT') && row.router.response_mode !== 'EVIDENCE'],
    ['PERSONNEL_EVIDENCE_VS_STAFFING_COMMITMENT', row => ((row.v3.primary_response_mode === 'EVIDENCE' && row.router.response_mode === 'COMMITMENT') || (row.v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'EVIDENCE')) && (row.v3.secondary_dependencies.some(dep => /PERSONNEL|STAFF|人员|负责人|从业/i.test(String(dep))) || /PERSONNEL|STAFF|人员|负责人|从业/i.test(String(row.v3.reason || '')))],
    ['RESPONSE_REQUIRED_ERROR', row => row.router.response_required !== row.v3.response_required],
    ['RISK_TIER_ERROR', row => row.router.risk_tier !== row.v3.risk_tier],
    ['ABSTENTION_ERROR', row => (row.router.response_mode === 'NEED_REVIEW') !== (row.v3.primary_response_mode === 'NEED_REVIEW')]
  ];
  const assigned = new Set();
  const out = [];
  for (const [id, predicate] of families) {
    const matches = rows.filter(row => !assigned.has(row.case_id) && predicate(row));
    matches.forEach(row => assigned.add(row.case_id));
    out.push({ id, count: matches.length, rate: pct(matches.length, rows.length), case_ids: matches.map(row => row.case_id) });
  }
  const other = rows.filter(row => row.disagrees && !assigned.has(row.case_id));
  out.push({ id: 'OTHER', count: other.length, rate: pct(other.length, rows.length), case_ids: other.map(row => row.case_id) });
  return out;
}

function drift(v2, v3Rows) {
  const v3ByCase = new Map(v3Rows.map(row => [row.case_id, row]));
  const rows = v2.requirements.map(old => {
    const newer = v3ByCase.get(old.case_id);
    return {
      case_id: old.case_id,
      cohort: old.cohort,
      v2: {
        primary_response_mode: old.gpt_primary_response_mode,
        risk_tier: old.gpt_risk_tier,
        response_required: old.gpt_response_required,
        evidence_dependency: old.gpt_evidence_dependency,
        human_required: old.gpt_human_required
      },
      v3: newer ? {
        primary_response_mode: newer.v3.primary_response_mode,
        risk_tier: newer.v3.risk_tier,
        response_required: newer.v3.response_required,
        evidence_dependency: newer.v3.evidence_dependency,
        human_required: newer.v3.human_required
      } : null
    };
  });
  const transitions = countBy(rows, row => `${row.v2.primary_response_mode}->${row.v3?.primary_response_mode || 'MISSING'}`);
  const fieldChanges = Object.fromEntries(['risk_tier', 'response_required', 'evidence_dependency', 'human_required'].map(field => {
    const changed = rows.filter(row => row.v3 && row.v2[field] !== row.v3[field]);
    return [field, { changed_count: changed.length, unchanged_count: rows.length - changed.length, changes: countBy(changed, row => `${row.v2[field]}->${row.v3[field]}`) }];
  }));
  return { case_count: rows.length, primary_mode_transitions: sortedObject(transitions), field_changes: fieldChanges, rows };
}

function main() {
  const reference = loadReference();
  const referenceSha = sha256(reference.raw);
  if (referenceSha !== EXPECTED_REFERENCE_SHA) throw new Error('BLOCKED_REFERENCE_V3_IDENTITY_MISMATCH');
  const v2Raw = fs.readFileSync(V2_FILE); const v2 = JSON.parse(v2Raw); const v2Sha = sha256(v2Raw);
  if (v2Sha !== EXPECTED_V2_SHA) throw new Error('REFERENCE_V2_IDENTITY_MISMATCH');
  const sealedKey = readJson(SEALED_KEY_FILE);
  if (sealedKey.case_count !== 2178 || sealedKey.source_reference_v2_sha256 !== v2Sha) throw new Error('SEALED_KEY_IDENTITY_MISMATCH');
  const requirements = reference.value.requirements;
  if (!Array.isArray(requirements) || requirements.length !== 2178 || new Set(requirements.map(row => row.case_id)).size !== 2178) throw new Error('REFERENCE_V3_ROW_IDENTITY_MISMATCH');
  for (const [cohort, expected] of Object.entries(EXPECTED_COHORTS)) if (requirements.filter(row => row.cohort === cohort).length !== expected) throw new Error(`REFERENCE_V3_COHORT_MISMATCH:${cohort}`);
  for (const row of requirements) if (!row.v3_expected_router_mode || !row.v3_risk_tier || row.v3_response_required === null || row.v3_evidence_dependency === null || row.v3_human_required === null || row.v3_scoring_related === null) throw new Error(`REFERENCE_V3_LABEL_MISSING:${row.case_id}`);
  const rows = buildRows(reference.value, v2, sealedKey);
  const expectedMode = row => row.v3.primary_response_mode; const actualMode = row => row.router.response_mode;
  const modeDisagreements = rows.filter(row => row.disagrees);
  const p0Compliance = rows.filter(row => row.v3.primary_response_mode === 'COMPLIANCE' && row.v3.risk_tier === 'P0' && !['COMPLIANCE', 'NEED_REVIEW'].includes(row.router.response_mode));
  const highRiskEvidence = rows.filter(row => row.v3.evidence_dependency === true && ['HIGH', 'P0'].includes(row.v3.risk_tier) && row.router.evidence_dependency !== true);
  const v3Ambiguous = rows.filter(row => row.v3.semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY');
  const routerNeedReview = rows.filter(row => row.router.response_mode === 'NEED_REVIEW');
  const falseAbstention = routerNeedReview.filter(row => expectedMode(row) !== 'NEED_REVIEW');
  const missedAbstention = v3Ambiguous.filter(row => actualMode(row) !== 'NEED_REVIEW');
  const fieldAgreements = Object.fromEntries([
    ['risk_tier', row => row.router.risk_tier, row => row.v3.risk_tier],
    ['response_required', row => row.router.response_required, row => row.v3.response_required],
    ['evidence_dependency', row => row.router.evidence_dependency, row => row.v3.evidence_dependency],
    ['human_required', row => row.router.human_required, row => row.v3.human_required],
    ['scoring_related', row => row.router.is_scoring_related, row => row.v3.scoring_related]
  ].map(([key, left, right]) => [key, agreement(rows, left, right)]));
  const failureFamilies = failureFamilyRows(rows);
  const generatedAt = new Date().toISOString();
  const runId = `V43-RR-V2_1-V3-REPLAY-${sha256(`${referenceSha}:${sha256(fs.readFileSync(ROUTER_FILE))}:${RESPONSE_ROUTER_V21_VERSION}`).slice(0, 16)}`;
  const routerSha = sha256(fs.readFileSync(ROUTER_FILE));
  const sealedMatchCount = rows.filter(row => row.sealed_router_projection_match).length;
  const full = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_FULL_CORPUS_EVAL', artifact_version: 'v3-replay', run_id: runId, generated_at: generatedAt,
    deterministic: true, provider_calls: 0, llm_calls: 0,
    reference_v3: { locator: reference.locator, sha256: referenceSha, row_count: requirements.length, cohort_counts: EXPECTED_COHORTS, expected_mode_field: 'v3_expected_router_mode', semantic_primary_mode_field: 'v3_semantic_primary_mode', genuine_ambiguous_count: v3Ambiguous.length },
    reference_v2: { path: path.relative(ROOT, V2_FILE), sha256: v2Sha, row_count: v2.requirements.length },
    sealed_key: { path: path.relative(ROOT, SEALED_KEY_FILE), case_count: sealedKey.case_count, router_projection_match_count: sealedMatchCount },
    router_identity: { path: path.relative(ROOT, ROUTER_FILE), sha256: routerSha, projection_version: RESPONSE_ROUTER_V21_VERSION, implementation_id: RESPONSE_ROUTER_V21_IMPLEMENTATION_ID },
    case_count: rows.length, overall_primary_mode: { agreement_count: rows.filter(row => expectedMode(row) === actualMode(row)).length, agreement_rate: pct(rows.filter(row => expectedMode(row) === actualMode(row)).length, rows.length), per_mode_precision_recall: perModeMetrics(rows, actualMode, expectedMode), confusion_matrix: confusionMatrix(rows, actualMode, expectedMode, MODES) },
    safety_boundaries: { true_p0_compliance_escape: { count: p0Compliance.length, case_ids: p0Compliance.map(row => row.case_id) }, high_risk_evidence_false_negative: { count: highRiskEvidence.length, case_ids: highRiskEvidence.map(row => row.case_id) }, future_commitment_as_existing_evidence: rows.filter(row => row.v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'EVIDENCE').map(row => row.case_id), project_solution_as_enterprise_evidence: rows.filter(row => row.v3.primary_response_mode === 'SOLUTION' && row.router.response_mode === 'EVIDENCE').map(row => row.case_id), evidence_as_solution: rows.filter(row => row.v3.primary_response_mode === 'EVIDENCE' && row.router.response_mode === 'SOLUTION').map(row => row.case_id), commitment_as_compliance: rows.filter(row => row.v3.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'COMPLIANCE').map(row => row.case_id), compliance_as_commitment: rows.filter(row => row.v3.primary_response_mode === 'COMPLIANCE' && row.router.response_mode === 'COMMITMENT').map(row => row.case_id) },
    cross_cutting: fieldAgreements,
    abstention: { reference_genuine_ambiguous_count: v3Ambiguous.length, router_need_review_total: routerNeedReview.length, false_abstention_count: falseAbstention.length, false_abstention_case_ids: falseAbstention.map(row => row.case_id), missed_abstention_count: missedAbstention.length, missed_abstention_case_ids: missedAbstention.map(row => row.case_id) },
    disagreements: modeDisagreements.map(row => ({ case_id: row.case_id, cohort: row.cohort, tender_id: row.tender_id, requirement_id: row.requirement_id, expected_mode: row.v3.primary_response_mode, router_mode: row.router.response_mode, expected_risk_tier: row.v3.risk_tier, router_risk_tier: row.router.risk_tier, disagreement_dimensions: row.disagreement_dimensions }))
  };
  const confusion = { artifact_type: 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_CONFUSION_MATRIX', artifact_version: 'v3-replay', run_id: runId, reference_v3_sha256: referenceSha, router_sha256: routerSha, case_count: rows.length, primary_response_mode: full.overall_primary_mode, risk_tier: { labels: RISKS, matrix_router_rows_reference_columns: confusionMatrix(rows, row => row.router.risk_tier, row => row.v3.risk_tier, RISKS), agreement: fieldAgreements.risk_tier }, cross_cutting: fieldAgreements };
  const failureArtifact = { artifact_type: 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_FAILURES', artifact_version: 'v3-replay', run_id: runId, reference_v3_sha256: referenceSha, router_sha256: routerSha, case_count: rows.length, families: failureFamilies, disagreement_count: modeDisagreements.length, disagreement_case_ids: modeDisagreements.map(row => row.case_id) };
  const v2Drift = drift(v2, rows); v2Drift.artifact_type = 'V43_RESPONSE_REFERENCE_V2_1_TO_V3_DRIFT'; v2Drift.artifact_version = 'v2-to-v3'; v2Drift.run_id = runId; v2Drift.reference_v2_sha256 = v2Sha; v2Drift.reference_v3_sha256 = referenceSha;
  const checkpoint = { checkpoint: 'V43_RESPONSE_ROUTER_V2_1_CHECKPOINT', run_id: runId, generated_at: generatedAt, reference_v3_identity: { locator: reference.locator, sha256: referenceSha, rows: requirements.length, unique_case_ids: new Set(requirements.map(row => row.case_id)).size, cohort_counts: EXPECTED_COHORTS }, router_v2_1_identity: { path: path.relative(ROOT, ROUTER_FILE), sha256: routerSha, projection_version: RESPONSE_ROUTER_V21_VERSION, implementation_id: RESPONSE_ROUTER_V21_IMPLEMENTATION_ID, sealed_projection_match_count: sealedMatchCount, sealed_projection_match_rate: pct(sealedMatchCount, rows.length) }, metrics: { overall_primary_mode_agreement: full.overall_primary_mode, cross_cutting: fieldAgreements, abstention: full.abstention, disagreement_count: modeDisagreements.length, failure_families: failureFamilies.map(({ id, count, rate }) => ({ id, count, rate })), v2_to_v3_primary_mode_transitions: v2Drift.primary_mode_transitions }, development_targets: { hard_safety: { true_p0_compliance_escape: { target: 0, actual: p0Compliance.length, pass: p0Compliance.length === 0 }, high_risk_p0_evidence_dependency_false_negative: { target: 0, actual: highRiskEvidence.length, pass: highRiskEvidence.length === 0 }, post_award_commitment_as_evidence: { target: 0, actual: full.safety_boundaries.future_commitment_as_existing_evidence.length, pass: full.safety_boundaries.future_commitment_as_existing_evidence.length === 0 } }, note: 'Development targets are reported from the deterministic replay; misses remain evidence for GPT adjudication and do not trigger case-specific patching.' }, side_effects: { PROVIDER_CALLS: 0, LLM_CALLS: 0, PRODUCTION_DB_WRITES: 0, REFERENCE_V2_MUTATIONS: 0, REFERENCE_V3_MUTATIONS: 0, ROUTER_V2_1_MUTATIONS: 0, ROUTER_V2_MUTATIONS: 0, REQUIREMENT_MUTATIONS: 0, FACT_MUTATIONS: 0, MAPPING: 0, CLAIM: 0, WRITER: 0, COMMIT: 0, PUSH: 0, MERGE: 0, DEPLOY: 0 }, status: 'READY_FOR_GPT_RESPONSE_ROUTER_V2_1_ADJUDICATION' };
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_FULL_CORPUS_EVAL.json'), `${JSON.stringify({ ...full, rows }, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_CONFUSION_MATRIX.json'), `${JSON.stringify(confusion, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_FAILURES.json'), `${JSON.stringify(failureArtifact, null, 2)}\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_REFERENCE_V2_1_TO_V3_DRIFT.json'), `${JSON.stringify(v2Drift, null, 2)}\n`);
  const md = [
    '# V43 Response Router V2.1 vs Frozen Reference V3', '', `- run_id: ${runId}`, `- reference_v3: ${reference.locator}`, `- reference_v3_sha256: ${referenceSha}`, `- cases: ${rows.length}`, `- Router V2.1: ${path.relative(ROOT, ROUTER_FILE)}`, `- router_sha256: ${routerSha}`, `- primary agreement: ${full.overall_primary_mode.agreement_count}/${rows.length} (${full.overall_primary_mode.agreement_rate})`, `- disagreements: ${modeDisagreements.length}`, `- genuine ambiguous reference cases: ${v3Ambiguous.length}`, `- Router NEED_REVIEW: ${routerNeedReview.length}`, '', '## Per-mode metrics', '', ...Object.entries(full.overall_primary_mode.per_mode_precision_recall).map(([mode, m]) => `- ${mode}: precision=${m.precision}, recall=${m.recall}, TP=${m.true_positive}, FP=${m.false_positive}, FN=${m.false_negative}`), '', '## Safety boundaries', '', `- P0 compliance escape: ${p0Compliance.length}`, `- high-risk evidence false negative: ${highRiskEvidence.length}`, `- future commitment → evidence: ${full.safety_boundaries.future_commitment_as_existing_evidence.length}`, `- project solution → evidence: ${full.safety_boundaries.project_solution_as_enterprise_evidence.length}`, `- evidence → solution: ${full.safety_boundaries.evidence_as_solution.length}`, `- commitment → compliance: ${full.safety_boundaries.commitment_as_compliance.length}`, `- compliance → commitment: ${full.safety_boundaries.compliance_as_commitment.length}`, '', '## Development targets', '', `- Hard P0 compliance escape: ${p0Compliance.length === 0 ? 'PASS' : 'FAIL'} (${p0Compliance.length})`, `- High-risk/P0 evidence dependency false negative: ${highRiskEvidence.length === 0 ? 'PASS' : 'FAIL'} (${highRiskEvidence.length})`, `- Post-award commitment → evidence: ${full.safety_boundaries.future_commitment_as_existing_evidence.length === 0 ? 'PASS' : 'FAIL'} (${full.safety_boundaries.future_commitment_as_existing_evidence.length})`, `- Genuine ambiguous recall: ${v3Ambiguous.length - missedAbstention.length}/${v3Ambiguous.length}`, `- False abstention: ${falseAbstention.length}`, '', '## Side effects', '', '- Provider calls: 0', '- LLM calls: 0', '- Production DB writes: 0', '- Reference V2/V3 mutations: 0', '- Router V1/V2 mutations: 0', '- Commit/push/merge/deploy: 0', '', 'Failure families are mechanically assigned from frozen V3 labels and Router output; no semantic truth was inferred by Codex.'
  ].join('\n');
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_1_CHECKPOINT.md'), `${md}\n`);
  console.log(JSON.stringify({ status: checkpoint.status, run_id: runId, cases: rows.length, agreement: full.overall_primary_mode.agreement_rate, disagreements: modeDisagreements.length, p0_escape: p0Compliance.length, high_risk_evidence_false_negative: highRiskEvidence.length, router_need_review: routerNeedReview.length, sealed_projection_match_rate: pct(sealedMatchCount, rows.length), provider_calls: 0, llm_calls: 0 }, null, 2));
}

try { main(); } catch (error) { console.error(error?.message || String(error)); process.exitCode = 1; }

