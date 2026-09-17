import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { projectRequirementResponseV21 } from '../src/pipeline/requirement-response-router-v2-1.js';
import { projectRequirementResponseV22, RESPONSE_ROUTER_V22_IMPLEMENTATION_ID, RESPONSE_ROUTER_V22_VERSION } from '../src/pipeline/requirement-response-router-v2-2.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const canonical = value => JSON.stringify(value);

const main = () => {
  const v21 = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_1_VS_REFERENCE_V3_FULL_CORPUS_EVAL.json'));
  const v22 = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FULL_CORPUS_EVAL.json'));
  const baselineFailures = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json'));
  const execution = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_EXECUTION_LAYER_RECERT.json'));
  const overlay = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json'));
  const requirementFreeze = readJson(path.join(DOCS, 'V43_REQUIREMENT_V6_4_FREEZE_CHECKPOINT.json'));
  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const dirtyEntries = status.trim() ? status.trim().split(/\r?\n/) : [];
  const primaryAgreement = (rows, expected = row => row.expected_view?.primary_response_mode ?? row.v3?.semantic_primary_mode) => {
    const total = rows.length;
    const matched = rows.filter(row => {
      const exp = expected(row);
      const actual = row.router?.response_mode;
      return actual === exp;
    }).length;
    return { matched, total, rate: total ? matched / total : 0 };
  };
  const allV22Rows = v22.rows;
  const overlayMismatches = allV22Rows.filter(row => row.gpt_adjudication && row.gpt_adjudication.verdict === 'REFERENCE_V3_SEMANTIC_DEBT' && row.disagrees).map(row => ({
    case_id: row.case_id,
    disagreement_dimensions: row.disagreement_dimensions,
    router: { mode: row.router.response_mode, evidence_dependency: row.router.evidence_dependency, risk_tier: row.router.risk_tier, human_required: row.router.human_required },
    gpt: row.gpt_adjudication
  }));
  const expectedByCase = new Map(allV22Rows.map(row => [row.case_id, row.expected_view?.primary_response_mode]));
  const metrics = {
    full_replay_count: allV22Rows.length,
    primary_mode_agreement_v21: primaryAgreement(v21.rows, row => expectedByCase.get(row.case_id)),
    primary_mode_agreement_v22: primaryAgreement(allV22Rows),
    mode_distribution_v22: v22.distributions?.actual_mode ?? {},
    risk_distribution_v22: v22.distributions?.actual_risk ?? {},
    evidence_dependency_distribution_v22: v22.distributions?.actual_evidence_dependency ?? {},
    need_review_count_v22: v22.distributions?.need_review ?? allV22Rows.filter(row => row.router.response_mode === 'NEED_REVIEW').length,
    safety_metrics_v22: v22.safety_metrics,
    overlay_mismatches: overlayMismatches,
    overlay_mismatch_count: overlayMismatches.length
  };
  const out = {
    artifact_type: 'V43_PRE_ROUTER_V2_2_1_OVERNIGHT_BASELINE',
    generated_at: new Date().toISOString(),
    git: {
      branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty_file_count: dirtyEntries.length,
      status_sha256: sha256(status)
    },
    frozen_requirement: {
      version: requirementFreeze.requirement_version,
      runtime_contract: requirementFreeze.runtime_contract,
      instruction_sha256: requirementFreeze.instruction_sha256,
      source_truth_sha256: requirementFreeze.source_truth_sha256,
      status: requirementFreeze.status
    },
    router_v21_identity: v21.router_identity,
    router_v22_identity: {
      ...v22.router_identity,
      expected_version: RESPONSE_ROUTER_V22_VERSION,
      expected_implementation_id: RESPONSE_ROUTER_V22_IMPLEMENTATION_ID
    },
    reference_v3: v22.reference_v3,
    gpt_overlay: { artifact: 'docs/V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json', sha256: sha256(fs.readFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json')),), row_count: overlay.row_count },
    replay_metrics: metrics,
    backend_failure_identity: baselineFailures,
    execution_layer_recert: execution,
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, source_truth_mutations: 0, requirement_mutations: 0, reference_v3_mutations: 0 },
    baseline_validity: 'PRE_MUTATION_SNAPSHOT'
  };
  const outPath = path.join(DOCS, 'eval', 'baseline', 'V43_PRE_ROUTER_V2_2_1_OVERNIGHT_BASELINE.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ path: path.relative(ROOT, outPath), dirty_file_count: dirtyEntries.length, replay: metrics, execution_status: execution.status }, null, 2));
};

main();
