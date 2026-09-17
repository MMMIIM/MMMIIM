import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  projectRequirementResponseV2,
  RESPONSE_ROUTER_V2_VERSION,
  RESPONSE_ROUTER_V2_IMPLEMENTATION_ID
} from '../../backend/src/pipeline/requirement-response-router-v2.js';

const CWD = path.resolve(process.cwd());
const ROOT = fs.existsSync(path.join(CWD, 'docs')) ? CWD : path.resolve(CWD, '..');
const DOCS = path.join(ROOT, 'docs');
const REFERENCE_RELATIVE = 'docs/V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V2_2178.json';
const ROUTER_RELATIVE = 'backend/src/pipeline/requirement-response-router-v2.js';
const REQUIRED_COUNTS = Object.freeze({ CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 });
const MODES = Object.freeze(['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW']);
const RISKS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'P0']);
const REQUIRED_GPT_FIELDS = Object.freeze([
  'gpt_response_required', 'gpt_primary_response_mode', 'gpt_secondary_dependencies',
  'gpt_risk_tier', 'gpt_scoring_related', 'gpt_scoring_priority',
  'gpt_evidence_dependency', 'gpt_human_required', 'gpt_taxonomy_fit',
  'gpt_routing_reason_family', 'gpt_confidence', 'gpt_adjudication_status'
]);
const PRE_V2_BASELINE_COUNTS = Object.freeze({ SOLUTION: 124, EVIDENCE: 534, COMMITMENT: 62, COMPLIANCE: 380, NEED_REVIEW: 1078 });

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const hashJson = (value) => sha256(stable(value));
const readRaw = (relative) => fs.readFileSync(path.join(ROOT, relative));
const readJson = (relative) => JSON.parse(readRaw(relative));
const writeJson = (relative, value) => {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`);
};
const textOf = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const increment = (map, key) => { const normalized = String(key ?? 'null'); map[normalized] = (map[normalized] || 0) + 1; };
const countBy = (rows, selector) => rows.reduce((out, row) => { increment(out, selector(row)); return out; }, {});
const sortedObject = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const boolAgreement = (rows, left, right) => rows.filter((row) => Boolean(left(row)) === Boolean(right(row))).length;
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;

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
  } catch {
    return { branch: null, head: null, dirty: null, status_entry_count: null, status_sha256: null };
  }
}

function confusionMatrix(rows, actualSelector, expectedSelector, labels) {
  const matrix = Object.fromEntries(labels.map((label) => [label, Object.fromEntries(labels.map((other) => [other, 0]))]));
  for (const row of rows) {
    const actual = String(actualSelector(row) ?? 'null');
    const expected = String(expectedSelector(row) ?? 'null');
    if (!matrix[actual]) matrix[actual] = {};
    matrix[actual][expected] = (matrix[actual][expected] || 0) + 1;
  }
  return matrix;
}

function perClassMetrics(rows, actualSelector, expectedSelector, labels) {
  return Object.fromEntries(labels.map((label) => {
    const tp = rows.filter((row) => actualSelector(row) === label && expectedSelector(row) === label).length;
    const fp = rows.filter((row) => actualSelector(row) === label && expectedSelector(row) !== label).length;
    const fn = rows.filter((row) => actualSelector(row) !== label && expectedSelector(row) === label).length;
    return [label, {
      true_positive: tp,
      false_positive: fp,
      false_negative: fn,
      precision: pct(tp, tp + fp),
      recall: pct(tp, tp + fn)
    }];
  }));
}

function failureFamily(rows, id, definition, predicate) {
  const matches = rows.filter(predicate);
  return {
    id,
    definition,
    count: matches.length,
    rate: pct(matches.length, rows.length),
    case_ids: matches.map((row) => row.case_id)
  };
}

function buildComparison(reference) {
  const requirements = Array.isArray(reference.requirements) ? reference.requirements : [];
  if (requirements.length !== 2178) throw new Error(`REFERENCE_CASE_COUNT_MISMATCH:${requirements.length}`);
  for (const [cohort, expected] of Object.entries(REQUIRED_COUNTS)) {
    const actual = requirements.filter((row) => row.cohort === cohort).length;
    if (actual !== expected) throw new Error(`REFERENCE_COHORT_COUNT_MISMATCH:${cohort}:${actual}:${expected}`);
  }
  const caseIds = requirements.map((row) => row.case_id);
  if (caseIds.some((id) => !id) || new Set(caseIds).size !== caseIds.length) throw new Error('REFERENCE_CASE_ID_NOT_UNIQUE');
  for (const row of requirements) {
    for (const field of REQUIRED_GPT_FIELDS) {
      if (row[field] === null || row[field] === undefined) throw new Error(`REFERENCE_GPT_LABEL_MISSING:${row.case_id}:${field}`);
    }
  }
  const rows = requirements.map((requirement) => {
    const projection = projectRequirementResponseV2(requirement, { projection_version: RESPONSE_ROUTER_V2_VERSION });
    const routerResponseRequired = projection.response_required;
    return {
      case_id: requirement.case_id,
      cohort: requirement.cohort,
      tender_id: requirement.tender_id,
      requirement_id: requirement.requirement_id,
      requirement_hash: requirement.requirement_hash || null,
      source_hash: requirement.source_hash || null,
      router: projection,
      router_response_required: routerResponseRequired,
      gpt: {
        response_required: requirement.gpt_response_required,
        primary_response_mode: requirement.gpt_primary_response_mode,
        secondary_dependencies: requirement.gpt_secondary_dependencies,
        risk_tier: requirement.gpt_risk_tier,
        scoring_related: requirement.gpt_scoring_related,
        scoring_priority: requirement.gpt_scoring_priority,
        evidence_dependency: requirement.gpt_evidence_dependency,
        human_required: requirement.gpt_human_required,
        taxonomy_fit: requirement.gpt_taxonomy_fit,
        routing_reason_family: requirement.gpt_routing_reason_family,
        confidence: requirement.gpt_confidence,
        adjudication_status: requirement.gpt_adjudication_status
      },
      agreements: {
        primary_response_mode: projection.response_mode === requirement.gpt_primary_response_mode,
        risk_tier: projection.risk_tier === requirement.gpt_risk_tier,
        response_required: routerResponseRequired === requirement.gpt_response_required,
        scoring_related: projection.is_scoring_related === requirement.gpt_scoring_related,
        evidence_dependency: projection.evidence_dependency === requirement.gpt_evidence_dependency,
        human_required: projection.human_required === requirement.gpt_human_required
      }
    };
  });
  return rows.sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function buildArtifacts() {
  const referenceRaw = readRaw(REFERENCE_RELATIVE);
  const reference = JSON.parse(referenceRaw);
  const rows = buildComparison(reference);
  const referenceSha = sha256(referenceRaw);
  const routerRaw = readRaw(ROUTER_RELATIVE);
  const routerSha = sha256(routerRaw);
  const generatedAt = new Date().toISOString();
  const runId = `V43-RR-V2-DEV-${sha256(`${referenceSha}:${routerSha}:${RESPONSE_ROUTER_V2_VERSION}`).slice(0, 16)}`;
  const routerMode = (row) => row.router.response_mode;
  const gptMode = (row) => row.gpt.primary_response_mode;
  const routerRisk = (row) => row.router.risk_tier;
  const gptRisk = (row) => row.gpt.risk_tier;
  const modes = [...new Set([...MODES, ...rows.map(routerMode), ...rows.map(gptMode)])];
  const risks = [...new Set([...RISKS, ...rows.map(routerRisk), ...rows.map(gptRisk)])];
  const p0Rows = rows.filter((row) => row.gpt.risk_tier === 'P0');
  const trueP0ComplianceRows = rows.filter((row) => row.gpt.primary_response_mode === 'COMPLIANCE' && row.gpt.risk_tier === 'P0');
  const evidenceHighRows = rows.filter((row) => row.gpt.evidence_dependency === true && ['HIGH', 'P0'].includes(row.gpt.risk_tier));
  const needReviewRows = rows.filter((row) => row.router.response_mode === 'NEED_REVIEW');
  const primaryModeDisagreements = rows.filter((row) => !row.agreements.primary_response_mode);
  const failureFamilies = [
    failureFamily(rows, 'P0_COMPLIANCE_ESCAPE', 'GPT primary mode COMPLIANCE and GPT risk_tier P0, while Router primary mode is neither COMPLIANCE nor NEED_REVIEW.', (row) => row.gpt.primary_response_mode === 'COMPLIANCE' && row.gpt.risk_tier === 'P0' && !['COMPLIANCE', 'NEED_REVIEW'].includes(row.router.response_mode)),
    failureFamily(rows, 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE', 'GPT evidence_dependency=true with risk_tier HIGH/P0, while Router does not retain evidence_dependency or HIGH/P0 risk.', (row) => evidenceHighRows.includes(row) && (row.router.evidence_dependency !== true || !['HIGH', 'P0'].includes(row.router.risk_tier))),
    failureFamily(rows, 'FUTURE_COMMITMENT_AS_EXISTING_FACT', 'GPT primary mode COMMITMENT but Router primary mode EVIDENCE.', (row) => row.gpt.primary_response_mode === 'COMMITMENT' && row.router.response_mode === 'EVIDENCE'),
    failureFamily(rows, 'PROJECT_DESIGN_AS_ENTERPRISE_FACT', 'GPT SOLUTION without evidence dependency but Router primary mode EVIDENCE.', (row) => row.gpt.primary_response_mode === 'SOLUTION' && row.gpt.evidence_dependency === false && row.router.response_mode === 'EVIDENCE'),
    failureFamily(rows, 'UNNECESSARY_WRITER_RESPONSE', 'GPT response_required=false while Router explicit response_required=true.', (row) => row.gpt.response_required === false && row.router.response_required === true),
    failureFamily(rows, 'UNNECESSARY_HUMAN_REVIEW', 'GPT human_required=false but Router human_required=true; this is workload inflation, not authority escalation.', (row) => row.gpt.human_required === false && row.router.human_required === true)
  ];
  const perCohort = Object.fromEntries(['CORE6', 'HOLDOUT_V1', 'HOLDOUT_V2'].map((cohort) => {
    const cohortRows = rows.filter((row) => row.cohort === cohort);
    return [cohort, {
      case_count: cohortRows.length,
      primary_mode_agreement: cohortRows.filter((row) => row.agreements.primary_response_mode).length,
      primary_mode_agreement_rate: pct(cohortRows.filter((row) => row.agreements.primary_response_mode).length, cohortRows.length),
      risk_tier_agreement: cohortRows.filter((row) => row.agreements.risk_tier).length,
      response_required_agreement: cohortRows.filter((row) => row.agreements.response_required).length,
      scoring_agreement: cohortRows.filter((row) => row.agreements.scoring_related).length,
      evidence_dependency_agreement: cohortRows.filter((row) => row.agreements.evidence_dependency).length,
      human_required_agreement: cohortRows.filter((row) => row.agreements.human_required).length,
      need_review_count: cohortRows.filter((row) => row.router.response_mode === 'NEED_REVIEW').length
    }];
  }));
  const git = gitInfo();
  const confusion = confusionMatrix(rows, routerMode, gptMode, modes);
  const perMode = perClassMetrics(rows, routerMode, gptMode, modes);
  const riskConfusion = confusionMatrix(rows, routerRisk, gptRisk, risks);
  const primaryModeAgreementRate = pct(rows.filter((row) => row.agreements.primary_response_mode).length, rows.length);
  const p0Disagreements = p0Rows.filter((row) => !row.agreements.primary_response_mode || !row.agreements.risk_tier || !row.agreements.response_required).map((row) => row.case_id);
  const highEvidenceFalseNegatives = failureFamily(rows, 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE', 'GPT evidence_dependency=true with risk_tier HIGH/P0, while Router does not retain evidence_dependency or HIGH/P0 risk.', (row) => evidenceHighRows.includes(row) && (row.router.evidence_dependency !== true || !['HIGH', 'P0'].includes(row.router.risk_tier)));
  const p0ComplianceEscape = failureFamilies.find((family) => family.id === 'P0_COMPLIANCE_ESCAPE');
  const trueP0ComplianceRecall = pct(trueP0ComplianceRows.filter((row) => ['COMPLIANCE', 'NEED_REVIEW'].includes(row.router.response_mode)).length, trueP0ComplianceRows.length);
  const developmentGates = {
    overall_primary_mode_agreement: { threshold: 0.9, actual: primaryModeAgreementRate, status: primaryModeAgreementRate >= 0.9 ? 'PASS' : 'FAIL' },
    per_mode_recall: Object.fromEntries(Object.entries(perMode).filter(([mode]) => mode !== 'NEED_REVIEW').map(([mode, value]) => [mode, { threshold: 0.85, actual: value.recall, status: value.recall >= 0.85 ? 'PASS' : 'FAIL' }])),
    evidence_dependency_recall: { threshold: 0.95, actual: pct(rows.filter((row) => row.gpt.evidence_dependency === true && row.router.evidence_dependency === true).length, rows.filter((row) => row.gpt.evidence_dependency === true).length), status: pct(rows.filter((row) => row.gpt.evidence_dependency === true && row.router.evidence_dependency === true).length, rows.filter((row) => row.gpt.evidence_dependency === true).length) >= 0.95 ? 'PASS' : 'FAIL' },
    true_p0_compliance_recall: { threshold: 1, actual: trueP0ComplianceRecall, status: trueP0ComplianceRecall === 1 ? 'PASS' : 'FAIL' },
    p0_compliance_escape: { threshold: 0, actual: p0ComplianceEscape.count, status: p0ComplianceEscape.count === 0 ? 'PASS' : 'FAIL' },
    high_risk_evidence_false_negative: { threshold: 0, actual: highEvidenceFalseNegatives.count, status: highEvidenceFalseNegatives.count === 0 ? 'PASS' : 'FAIL' },
    future_commitment_as_existing_fact: { threshold: 0, actual: failureFamilies.find((family) => family.id === 'FUTURE_COMMITMENT_AS_EXISTING_FACT').count, status: failureFamilies.find((family) => family.id === 'FUTURE_COMMITMENT_AS_EXISTING_FACT').count === 0 ? 'PASS' : 'FAIL' },
    project_design_as_enterprise_fact: { threshold: 0, actual: failureFamilies.find((family) => family.id === 'PROJECT_DESIGN_AS_ENTERPRISE_FACT').count, status: failureFamilies.find((family) => family.id === 'PROJECT_DESIGN_AS_ENTERPRISE_FACT').count === 0 ? 'PASS' : 'FAIL' }
  };
  const developmentGatePass = Object.entries(developmentGates).every(([key, gate]) => key === 'per_mode_recall' ? Object.values(gate).every((nested) => nested.status === 'PASS') : gate.status === 'PASS');
  const comparison = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_DEV_CORPUS_EVAL',
    artifact_version: 'v2',
    run_id: runId,
    generated_at: generatedAt,
    deterministic: true,
    provider_calls: 0,
    llm_calls: 0,
    reference_artifact: {
      path: REFERENCE_RELATIVE,
      sha256: referenceSha,
      artifact_type: reference.artifact_type,
      corpus: reference.corpus,
      calibration: reference.calibration
    },
    router_identity: {
      path: ROUTER_RELATIVE,
      sha256: routerSha,
      projection_version: RESPONSE_ROUTER_V2_VERSION,
      implementation_id: RESPONSE_ROUTER_V2_IMPLEMENTATION_ID,
      evaluator_import: ROUTER_RELATIVE,
      root_cause_closed: 'A_ROUTER_V2_NEVER_IMPLEMENTED'
    },
    execution_identity: { ...git, run_id: runId },
    case_count: rows.length,
    pre_v2_baseline_counts: PRE_V2_BASELINE_COUNTS,
    development_gates: developmentGates,
    cohort_counts: countBy(rows, (row) => row.cohort),
    rows
  };
  const confusionArtifact = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_CONFUSION_MATRIX',
    artifact_version: 'v2',
    run_id: runId,
    reference_sha256: referenceSha,
    router_sha256: routerSha,
    case_count: rows.length,
    primary_response_mode: {
      label_order: modes,
      matrix_router_rows_gpt_columns: confusion,
      per_mode_precision_recall: perMode,
      agreement_count: rows.filter((row) => row.agreements.primary_response_mode).length,
      agreement_rate: pct(rows.filter((row) => row.agreements.primary_response_mode).length, rows.length)
    },
    risk_tier: {
      label_order: risks,
      matrix_router_rows_gpt_columns: riskConfusion,
      agreement_count: rows.filter((row) => row.agreements.risk_tier).length,
      agreement_rate: pct(rows.filter((row) => row.agreements.risk_tier).length, rows.length),
      p0_recall: pct(p0Rows.filter((row) => row.router.risk_tier === 'P0').length, p0Rows.length)
    },
    per_cohort: perCohort
  };
  const failureArtifact = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_FAILURE_FAMILIES',
    artifact_version: 'v2',
    run_id: runId,
    reference_sha256: referenceSha,
    router_sha256: routerSha,
    case_count: rows.length,
    families: failureFamilies,
    p0_disagreements: { count: p0Disagreements.length, case_ids: p0Disagreements },
    high_or_p0_evidence_false_negatives: highEvidenceFalseNegatives,
    representative_primary_mode_disagreements: primaryModeDisagreements.slice(0, 50).map((row) => ({
      case_id: row.case_id,
      cohort: row.cohort,
      router_mode: row.router.response_mode,
      gpt_mode: row.gpt.primary_response_mode,
      router_risk: row.router.risk_tier,
      gpt_risk: row.gpt.risk_tier
    })),
    need_review_semantic_family_distribution: {
      by_gpt_primary_response_mode: sortedObject(countBy(needReviewRows, (row) => row.gpt.primary_response_mode)),
      by_gpt_risk_tier: sortedObject(countBy(needReviewRows, (row) => row.gpt.risk_tier)),
      by_gpt_taxonomy_fit: sortedObject(countBy(needReviewRows, (row) => row.gpt.taxonomy_fit)),
      router_reason_family: sortedObject(countBy(needReviewRows, (row) => row.router.routing_reasons.join('|')))
    }
  };
  const packet = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_GPT_PACKET',
    artifact_version: 'v2',
    run_id: runId,
    generated_at: generatedAt,
    development_reference_only: true,
    semantic_adjudication_by_codex: false,
    case_count: rows.length,
    reference_artifact_sha256: referenceSha,
    router_projection_version: RESPONSE_ROUTER_V2_VERSION,
    router_implementation_id: RESPONSE_ROUTER_V2_IMPLEMENTATION_ID,
    implementation_identity: {
      root_cause: 'A_ROUTER_V2_NEVER_IMPLEMENTED',
      actual_router_module: ROUTER_RELATIVE,
      actual_router_export: 'projectRequirementResponseV2',
      distinct_v2_implemented: true,
      evaluator_reaches_v2: true,
      v1_module_retained_for_legacy_regression: 'backend/src/pipeline/requirement-response-router.js',
      v1_projection_version_not_used_by_this_evaluator: true
    },
    pre_v2_baseline_counts: PRE_V2_BASELINE_COUNTS,
    metric_definitions: {
      p0_compliance_escape: 'GPT primary mode COMPLIANCE and GPT risk P0, while Router primary mode is neither COMPLIANCE nor NEED_REVIEW.',
      response_required: 'Router explicit response_required field; never derived from response_mode.',
      unnecessary_human_review: 'GPT human_required=false and Router human_required=true; not an authority escalation.'
    },
    overall_primary_mode_agreement: confusionArtifact.primary_response_mode,
    per_mode_precision: Object.fromEntries(Object.entries(perMode).map(([mode, value]) => [mode, value.precision])),
    per_mode_recall: Object.fromEntries(Object.entries(perMode).map(([mode, value]) => [mode, value.recall])),
    confusion_matrix: confusionArtifact.primary_response_mode.matrix_router_rows_gpt_columns,
    risk_tier_agreement: confusionArtifact.risk_tier,
    p0_recall: confusionArtifact.risk_tier.p0_recall,
    response_required_agreement: {
      count: rows.filter((row) => row.agreements.response_required).length,
      rate: pct(rows.filter((row) => row.agreements.response_required).length, rows.length),
      router_definition: 'explicit projection.response_required; independent from response_mode'
    },
    scoring_agreement: {
      count: rows.filter((row) => row.agreements.scoring_related).length,
      rate: pct(rows.filter((row) => row.agreements.scoring_related).length, rows.length)
    },
    evidence_dependency_agreement: {
      count: rows.filter((row) => row.agreements.evidence_dependency).length,
      rate: pct(rows.filter((row) => row.agreements.evidence_dependency).length, rows.length)
    },
    human_required_agreement: {
      count: rows.filter((row) => row.agreements.human_required).length,
      rate: pct(rows.filter((row) => row.agreements.human_required).length, rows.length)
    },
    need_review: {
      count: needReviewRows.length,
      rate: pct(needReviewRows.length, rows.length),
      semantic_family_distribution: failureArtifact.need_review_semantic_family_distribution
    },
    failure_families: failureFamilies,
    p0_disagreements: failureArtifact.p0_disagreements,
    high_or_p0_evidence_false_negatives: highEvidenceFalseNegatives,
    representative_primary_mode_disagreements: failureArtifact.representative_primary_mode_disagreements,
    development_pass_targets: {
      reference_case_count_2178: rows.length === 2178 ? 'PASS' : 'FAIL',
      cohort_counts: REQUIRED_COUNTS,
      gpt_labels_complete: rows.every((row) => row.gpt.primary_response_mode && row.gpt.risk_tier && row.gpt.adjudication_status) ? 'PASS' : 'FAIL',
      router_projection_complete: rows.every((row) => row.router.projection_version === RESPONSE_ROUTER_V2_VERSION && row.router.implementation_id === RESPONSE_ROUTER_V2_IMPLEMENTATION_ID) ? 'PASS' : 'FAIL',
      deterministic_comparison: 'PASS',
      semantic_quality_decision: developmentGatePass ? 'PENDING_GPT_REVIEW' : 'BLOCKED_ROUTER_V2_SEMANTIC_GATES_NOT_MET',
      frozen_development_gates: developmentGates
    },
    tests_and_regressions: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      production_routing_changes: 0,
      test_execution: 'Deterministic aggregation only; no Provider/LLM invocation.'
    },
    side_effects: {
      PROVIDER_CALLS: 0,
      LLM_CALLS: 0,
      PRODUCTION_DB_WRITES: 0,
      GOLD_MUTATIONS: 0,
      SEMANTIC_REFERENCE_MUTATIONS: 0,
      ROUTER_SEMANTIC_CHANGES: 0,
      PRODUCTION_ROUTING_CHANGE: 0,
      MAPPING: 0,
      CLAIM: 0,
      WRITER: 0,
      COMMIT: 0,
      PUSH: 0,
      MERGE: 0,
      DEPLOY: 0
    },
    status: developmentGatePass ? 'READY_FOR_GPT_RESPONSE_ROUTER_V2_DEV_ADJUDICATION_V2_VERIFIED' : 'BLOCKED_ROUTER_V2_SEMANTIC_GATES_NOT_MET'
  };
  const markdown = [
    '# V43 Response Router V2 Dev Corpus Evaluation',
    '',
    `- run_id: ${runId}`,
    `- generated_at: ${generatedAt}`,
    `- reference_sha256: ${referenceSha}`,
    `- router_projection_version: ${RESPONSE_ROUTER_V2_VERSION}`,
    `- case_count: ${rows.length}`,
    `- primary_mode_agreement: ${confusionArtifact.primary_response_mode.agreement_count}/${rows.length} (${confusionArtifact.primary_response_mode.agreement_rate})`,
    `- risk_tier_agreement: ${confusionArtifact.risk_tier.agreement_count}/${rows.length} (${confusionArtifact.risk_tier.agreement_rate})`,
    `- p0_recall: ${confusionArtifact.risk_tier.p0_recall}`,
    `- response_required_agreement: ${packet.response_required_agreement.count}/${rows.length} (${packet.response_required_agreement.rate})`,
    `- scoring_agreement: ${packet.scoring_agreement.count}/${rows.length} (${packet.scoring_agreement.rate})`,
    `- evidence_dependency_agreement: ${packet.evidence_dependency_agreement.count}/${rows.length} (${packet.evidence_dependency_agreement.rate})`,
    `- human_required_agreement: ${packet.human_required_agreement.count}/${rows.length} (${packet.human_required_agreement.rate})`,
    `- NEED_REVIEW: ${needReviewRows.length}/${rows.length} (${pct(needReviewRows.length, rows.length)})`,
    '',
    '## Development status',
    '',
    `- deterministic comparison: ${developmentGatePass ? 'PASS' : 'PASS_WITH_SEMANTIC_GATES_NOT_MET'}`,
    `- semantic adjudication: ${developmentGatePass ? 'PENDING_GPT_REVIEW' : 'BLOCKED_ROUTER_V2_SEMANTIC_GATES_NOT_MET'}`,
    '- Provider/LLM calls: 0',
    '- production DB writes: 0',
    '- Gold mutations: 0',
    '',
    'Failure-family counts are mechanical label deltas defined in the JSON artifact; they are not Codex semantic judgments.',
    ...failureFamilies.map((family) => `- ${family.id}: ${family.count} (${family.rate})`),
    ''
  ].join('\n');
  return { comparison, confusionArtifact, failureArtifact, packet, markdown };
}

export function run() {
  const { comparison, confusionArtifact, failureArtifact, packet, markdown } = buildArtifacts();
  writeJson('docs/V43_RESPONSE_ROUTER_V2_DEV_CORPUS_EVAL.json', comparison);
  fs.writeFileSync(path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_V2_DEV_CORPUS_EVAL.md'), markdown);
  writeJson('docs/V43_RESPONSE_ROUTER_V2_CONFUSION_MATRIX.json', confusionArtifact);
  writeJson('docs/V43_RESPONSE_ROUTER_V2_FAILURE_FAMILIES.json', failureArtifact);
  writeJson('docs/V43_RESPONSE_ROUTER_V2_GPT_PACKET.json', packet);
  return {
    status: packet.status,
    run_id: packet.run_id,
    case_count: packet.case_count,
    provider_calls: packet.side_effects.PROVIDER_CALLS,
    llm_calls: packet.side_effects.LLM_CALLS
  };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) console.log(JSON.stringify(run(), null, 2));
