import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  projectRequirementResponse,
  buildComplianceMatrixRow,
  RESPONSE_PROJECTION_VERSION,
  RESPONSE_ROLES,
  RESPONSE_MODES,
  RISK_TIERS,
  SCORING_PRIORITIES
} from '../src/pipeline/requirement-response-router.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const OUTPUT_ROOT = path.join(DOCS, 'V43_BID_COPILOT_WAVE1_RESPONSE_PROJECTIONS');
const CANONICAL = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const HOLDOUT_V1 = path.join(ROOT, 'backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/canonical-requirements.json');
const HOLDOUT_V2 = path.join(ROOT, 'backend/eval/requirement-unseen-holdout-v2/results/unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50/canonical-requirements.json');

const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const hashJson = (value) => sha256(stable(value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };
const countBy = (rows, key) => rows.reduce((out, row) => { const value = row[key] || 'NONE'; out[value] = (out[value] || 0) + 1; return out; }, {});
const pct = (n, d) => d ? Number((n / d).toFixed(4)) : 0;
const sourceIdentity = (item) => ({ source_refs: Array.isArray(item.source_refs) ? item.source_refs : [], source_hash: item.source_hash || null, source_span: item.source_span || null });

function loadCohort(name, file, idField = 'canonical_requirement_id', textField = 'requirement_text') {
  if (!fs.existsSync(file)) return { name, status: 'NOT_AVAILABLE', source_file: path.relative(ROOT, file), rows: [] };
  const raw = readJson(file);
  const rows = Array.isArray(raw) ? raw : (raw.requirements || raw.canonical_requirements || []);
  return { name, status: 'LOADED', source_file: path.relative(ROOT, file), source_sha256: sha256(fs.readFileSync(file)), rows: rows.map((item, index) => ({
    ...item,
    canonical_requirement_id: item.canonical_requirement_id || item[idField] || `${name}-${String(index + 1).padStart(4, '0')}`,
    requirement_text: item.requirement_text || item[textField] || '',
    tender_id: item.tender_id || item.holdout_tender_id || name
  })) };
}

function projectRow(item, cohort) {
  const projection = projectRequirementResponse(item, { projection_version: RESPONSE_PROJECTION_VERSION });
  return {
    cohort,
    tender_id: item.tender_id || item.holdout_tender_id || null,
    requirement_id: projection.requirement_id,
    requirement_text: item.requirement_text || '',
    source_excerpt: item.source_excerpt || item.resolved_source_context || null,
    category: item.category || null,
    requirement_category: item.requirement_category || null,
    mandatory_input: item.mandatory === true,
    mandatory: item.mandatory === true || item.mandatory_observed === true,
    mandatory_observed: item.mandatory_observed === true,
    requires_confirmation: item.requires_confirmation === true,
    risk_flags: Array.isArray(item.risk_flags) ? [...item.risk_flags] : [],
    ...sourceIdentity(item),
    projection,
    compliance_matrix: buildComplianceMatrixRow(item, projection),
    eval_only: true,
    data_classification: cohort === 'CORE6' ? (item.data_classification || 'REAL_TENDER_SOURCE') : 'DEVELOPMENT_HOLDOUT',
    human_adjudication_status: 'PENDING_GPT_RESPONSE_PROJECTION_ADJUDICATION'
  };
}

function summarize(rows, cohort, sourceFile, sourceSha) {
  const total = rows.length;
  const role = countBy(rows.map((row) => row.projection), 'response_role');
  const mode = countBy(rows.map((row) => row.projection), 'response_mode');
  const risk = countBy(rows.map((row) => row.projection), 'risk_tier');
  const scoring = rows.filter((row) => row.projection.is_scoring_related).length;
  const deep = rows.filter((row) => row.projection.deep_chain_required).length;
  const review = rows.filter((row) => row.projection.response_mode === 'NEED_REVIEW').length;
  const p0 = rows.filter((row) => row.projection.risk_tier === 'P0').length;
  const high = rows.filter((row) => row.projection.risk_tier === 'HIGH').length;
  const commitment = rows.filter((row) => row.projection.response_mode === 'COMMITMENT').length;
  return { cohort, source_file: sourceFile, source_sha256: sourceSha, total_requirements: total, response_role_distribution: role, response_mode_distribution: mode, risk_tier_distribution: risk, scoring_related_count: scoring, deep_chain_required_count: deep, deep_chain_required_rate: pct(deep, total), deep_chain_avoidable_count: Math.max(0, total - deep), deep_chain_avoidable_rate: pct(Math.max(0, total - deep), total), need_review_count: review, p0_count: p0, high_risk_count: high, project_commitment_count: commitment, role_coverage_complete: Object.keys(role).every((key) => RESPONSE_ROLES.includes(key)), mode_coverage_complete: Object.keys(mode).every((key) => RESPONSE_MODES.includes(key)), risk_coverage_complete: Object.keys(risk).every((key) => RISK_TIERS.includes(key)), scoring_priority_values_valid: rows.every((row) => SCORING_PRIORITIES.includes(row.projection.scoring_priority)) };
}

function representativeCases(rows) {
  const out = {};
  for (const mode of RESPONSE_MODES) {
    out[mode] = rows.filter((row) => row.projection.response_mode === mode).sort((a, b) => String(a.requirement_id).localeCompare(String(b.requirement_id))).slice(0, 20).map((row) => ({ requirement_id: row.requirement_id, tender_id: row.tender_id, requirement_text: row.requirement_text, source_excerpt: row.source_excerpt, source_refs: row.source_refs, response_role: row.projection.response_role, response_mode: row.projection.response_mode, risk_tier: row.projection.risk_tier, routing_reasons: row.projection.routing_reasons }));
  }
  return out;
}

function deterministicSample(rows, limit, seedPrefix) {
  return [...rows].sort((a, b) => sha256(`${seedPrefix}:${a.requirement_id}`).localeCompare(sha256(`${seedPrefix}:${b.requirement_id}`))).slice(0, limit);
}

function buildCalibration(rows) {
  const needsReview = rows.filter((row) => row.projection.response_mode === 'NEED_REVIEW');
  const samples = ['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE'].flatMap((mode) => deterministicSample(rows.filter((row) => row.projection.response_mode === mode), 20, `mode:${mode}`));
  const seen = new Set();
  const cases = [...needsReview, ...samples].filter((row) => { if (seen.has(row.requirement_id)) return false; seen.add(row.requirement_id); return true; }).map((row) => ({
    calibration_case_id: `RESPONSE-${row.cohort}-${row.requirement_id}`,
    cohort: row.cohort,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    requirement_text: row.requirement_text,
    source_refs: row.source_refs,
    source_excerpt: row.source_excerpt,
    source_hash: row.source_hash,
    source_span: row.source_span,
    input_category: row.category,
    input_requirement_category: row.requirement_category,
    mandatory_observed: row.mandatory_observed,
    requires_confirmation: row.requires_confirmation,
    deterministic_projection: row.projection,
    codex_verdict: null,
    recommended_gold: null,
    human_decision: null,
    adjudication_status: 'PENDING_GPT_RESPONSE_PROJECTION_ADJUDICATION'
  }));
  return { artifact_type: 'V43_RESPONSE_PROJECTION_GPT_CALIBRATION_PACKET', artifact_version: 'v1', data_classification: 'DEVELOPMENT_CALIBRATION_ONLY', human_gold: false, production_authority: false, provider_calls: 0, cases, case_count: cases.length, needs_review_count: needsReview.length, sampled_case_count: cases.length - needsReview.length, sample_policy: 'deterministic hash order; up to 20 per mode; no verdict or gold label included' };
}

function main() {
  const coreRaw = readJson(CANONICAL);
  const coreRows = Array.isArray(coreRaw) ? coreRaw : coreRaw.requirements;
  const cohorts = [
    loadCohort('CORE6', CANONICAL),
    loadCohort('HOLDOUT_V1', HOLDOUT_V1, 'canonical_requirement_id', 'canonical_requirement_text'),
    loadCohort('HOLDOUT_V2', HOLDOUT_V2, 'canonical_requirement_id', 'requirement_text')
  ];
  // The CORE6 loader is authoritative; preserve the manifest's exact count.
  cohorts[0].rows = coreRows.map((item, index) => ({ ...item, canonical_requirement_id: item.canonical_requirement_id || `CORE6-${index + 1}`, requirement_text: item.requirement_text || '', tender_id: item.tender_id }));
  const sourceRowsByCohort = new Map(cohorts.map((cohort) => [cohort.name, cohort.rows]));
  const projected = cohorts.map((cohort) => ({ ...cohort, rows: cohort.rows.map((item) => projectRow(item, cohort.name)) }));
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const cohortSummaries = projected.map((cohort) => {
    const file = path.join(OUTPUT_ROOT, `${cohort.name.toLowerCase().replace(/_/g, '-')}.json`);
    const artifact = { artifact_type: 'V43_BID_COPILOT_WAVE1_RESPONSE_PROJECTION', artifact_version: 'v1', projection_version: RESPONSE_PROJECTION_VERSION, cohort: cohort.name, source_file: cohort.source_file, source_sha256: cohort.source_sha256 || null, row_count: cohort.rows.length, rows: cohort.rows, representatives: representativeCases(cohort.rows), provider_calls: 0, production_db_writes: 0, gold_mutations: 0 };
    writeJson(file, artifact);
    return summarize(cohort.rows, cohort.name, cohort.source_file, cohort.source_sha256 || null);
  });
  const allRows = projected.flatMap((cohort) => cohort.rows);
  const noRequirementMutation = projected.every((cohort) => {
    const sourceById = new Map((sourceRowsByCohort.get(cohort.name) || []).map((item) => [item.canonical_requirement_id, item.requirement_text]));
    return cohort.rows.every((row) => sourceById.get(row.requirement_id) === row.requirement_text);
  });
  const repeat = allRows.map((row) => projectRow({ canonical_requirement_id: row.requirement_id, requirement_text: row.requirement_text, source_refs: row.source_refs, source_hash: row.source_hash, source_span: row.source_span, tender_id: row.tender_id, category: row.category, requirement_category: row.requirement_category, mandatory: row.mandatory_input, mandatory_observed: row.mandatory_observed, requires_confirmation: row.requires_confirmation, risk_flags: row.risk_flags }, row.cohort));
  const idempotencePass = hashJson(allRows.map((row) => row.projection)) === hashJson(repeat.map((row) => row.projection));
  const calibration = buildCalibration(allRows);
  writeJson(path.join(DOCS, 'V43_RESPONSE_PROJECTION_GPT_CALIBRATION_PACKET.json'), calibration);
  const totalSummary = summarize(allRows, 'ALL_COHORTS', 'multiple', null);
  const checkpoint = {
    artifact_type: 'V43_BID_COPILOT_WAVE1_RESPONSE_PROJECTION_CHECKPOINT', artifact_version: 'v1', generated_at: new Date().toISOString(), projection_version: RESPONSE_PROJECTION_VERSION, input_artifact: path.relative(ROOT, CANONICAL), input_sha256: sha256(fs.readFileSync(CANONICAL)), cohorts: cohortSummaries, corpus_counts: Object.fromEntries(cohortSummaries.map((row) => [row.cohort, row.total_requirements])), response_role_distribution: totalSummary.response_role_distribution, response_mode_distribution: totalSummary.response_mode_distribution, risk_tier_distribution: totalSummary.risk_tier_distribution, scoring_related_count: totalSummary.scoring_related_count, deep_chain_required_count: totalSummary.deep_chain_required_count, deep_chain_required_rate: totalSummary.deep_chain_required_rate, deep_chain_avoidable_count: totalSummary.deep_chain_avoidable_count, deep_chain_avoidable_rate: totalSummary.deep_chain_avoidable_rate, need_review_count: totalSummary.need_review_count, p0_count: totalSummary.p0_count, high_risk_count: totalSummary.high_risk_count, project_commitment_count: totalSummary.project_commitment_count, representative_case_counts: Object.fromEntries(Object.entries(representativeCases(allRows)).map(([key, value]) => [key, value.length])), calibration_packet: { file: 'docs/V43_RESPONSE_PROJECTION_GPT_CALIBRATION_PACKET.json', case_count: calibration.case_count, no_verdict_or_gold: calibration.cases.every((row) => row.codex_verdict === null && row.recommended_gold === null) }, read_model_contract: { current_evidence_status: 'NOT_EVALUATED', response_decision_status: 'NOT_EVALUATED', allowed_response_decisions: ['READY', 'READY_WITH_EVIDENCE', 'PLAN_RESPONSE', 'NEED_CONFIRMATION', 'NO_EVIDENCE', 'CONFLICT', 'DO_NOT_ASSERT', 'NOT_EVALUATED'] }, deterministic_controls: { idempotence_pass: idempotencePass, no_requirement_mutation: noRequirementMutation, provider_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, production_routing_change: 0, llm_calls: 0 }, status: idempotencePass && noRequirementMutation ? 'READY_FOR_GPT_RESPONSE_PROJECTION_WAVE1_ADJUDICATION' : 'BLOCKED_PROJECTION_INTEGRITY_FAILURE' };
  writeJson(path.join(DOCS, 'V43_BID_COPILOT_WAVE1_RESPONSE_PROJECTION_CHECKPOINT.json'), checkpoint);
  const gap = `# V43 Bid Copilot Wave 1 — AS-IS to Target Gap\n\n## Scope\nOffline response projection only; no production cutover.\n\n## AS-IS\n- Canonical Requirements, source refs, categories, mandatory flags, confirmation flags and risk flags already exist.\n- Existing Fact, Mapping, Claim and Writer authority services remain unchanged.\n- Existing read models do not expose a persisted response projection or Compliance Matrix response decision.\n\n## Reuse\n- Canonical Requirement artifacts and source lineage.\n- Existing authority-bearing services and safety contracts; this wave only derives a read projection.\n\n## Wave 1 addition\n- Deterministic runtime/Eval requirement-response-router.js.\n- Eval-only per-cohort projection artifacts and a blind GPT calibration packet.\n- Compliance Matrix DTO serializer with explicit NOT_EVALUATED downstream fields.\n\n## Deferred\n- Production routing, schema/migration changes, Fact/Mapping/Claim/Writer changes, human approval UI, and provider evaluation.\n`;
  const impact = `# V43 Bid Copilot Wave 1 — Product Impact\n\nThis is a workload proxy, not a user-time or accuracy claim.\n\n- Corpus counts and deep-chain reduction are recorded in the response projection checkpoint.\n- EVIDENCE and evidence-dependent COMMITMENT remain on the existing strict authority chain.\n- SOLUTION may be planned without asserting enterprise facts.\n- COMPLIANCE remains deterministic/Human-controlled, with P0 precedence.\n- NEED_REVIEW, P0, HIGH risk and project commitments are the first Human Gate workload proxies.\n- No downstream response decision is guessed; unavailable domain state remains NOT_EVALUATED.\n`;
  fs.writeFileSync(path.join(DOCS, 'V43_BID_COPILOT_AS_IS_TO_TARGET_GAP.md'), gap);
  fs.writeFileSync(path.join(DOCS, 'V43_BID_COPILOT_WAVE1_PRODUCT_IMPACT.md'), impact);
  const md = `# V43 Bid Copilot Wave 1 Response Projection Checkpoint\n\n- Status: **${checkpoint.status}**\n- Projection version: ${checkpoint.projection_version}\n- Corpus counts: ${JSON.stringify(checkpoint.corpus_counts)}\n- Response roles: ${JSON.stringify(checkpoint.response_role_distribution)}\n- Response modes: ${JSON.stringify(checkpoint.response_mode_distribution)}\n- Risk tiers: ${JSON.stringify(checkpoint.risk_tier_distribution)}\n- Scoring related: ${checkpoint.scoring_related_count}\n- Deep chain required: ${checkpoint.deep_chain_required_count} (${checkpoint.deep_chain_required_rate})\n- Deep chain avoidable: ${checkpoint.deep_chain_avoidable_count} (${checkpoint.deep_chain_avoidable_rate})\n- NEED_REVIEW: ${checkpoint.need_review_count}; P0: ${checkpoint.p0_count}; commitments: ${checkpoint.project_commitment_count}\n- Calibration cases: ${checkpoint.calibration_packet.case_count} (no verdict/gold labels)\n- Idempotence: ${checkpoint.deterministic_controls.idempotence_pass ? 'PASS' : 'FAIL'}\n- Provider calls: 0; production DB writes: 0; Gold mutations: 0; production routing change: 0\n\nThis checkpoint is an offline development foundation and is not a production-readiness or Gold decision.\n`;
  fs.writeFileSync(path.join(DOCS, 'V43_BID_COPILOT_WAVE1_RESPONSE_PROJECTION_CHECKPOINT.md'), md);
  console.log(JSON.stringify({ status: checkpoint.status, corpus_counts: checkpoint.corpus_counts, response_modes: checkpoint.response_mode_distribution, deep_chain_required_count: checkpoint.deep_chain_required_count, need_review_count: checkpoint.need_review_count, p0_count: checkpoint.p0_count, commitment_count: checkpoint.project_commitment_count, calibration_case_count: calibration.case_count, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, idempotence_pass: idempotencePass }, null, 2));
}

main();
