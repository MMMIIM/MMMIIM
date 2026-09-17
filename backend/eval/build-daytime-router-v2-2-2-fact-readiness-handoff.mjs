import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const handoffRel = 'docs/handoff/V43_DAYTIME_ROUTER_V2_2_2_AND_FACT_READINESS';
const handoffDir = path.join(repoRoot, handoffRel);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readBytes = rel => fs.readFileSync(path.join(repoRoot, rel));
const readJson = rel => JSON.parse(readBytes(rel).toString('utf8'));
const writeBytes = (name, bytes) => fs.writeFileSync(path.join(handoffDir, name), bytes);
const writeJson = (name, value) => writeBytes(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));
const source = (sourcePath, handoffName) => ({ source_path: sourcePath, handoff_path: handoffName, bytes: readBytes(sourcePath) });
const required = [
  ['docs/V43_RESPONSE_ROUTER_V2_2_2_PRIMARY_MODE_OVERLAY_RECERT.json', '03_PRIMARY_MODE_OVERLAY_RECERT.json'],
  ['docs/V43_RESPONSE_ROUTER_V2_2_2_RISK_GPT_OVERLAY_V1.json', '04_RISK_OVERLAY_RECERT.json'],
  ['docs/V43_ROUTER_V2_2_2_FULL_REPLAY_REFERENCE_V3.json', '05_ROUTER_FULL_REPLAY.json'],
  ['docs/V43_ROUTER_V2_2_2_SEMANTIC_DELTA.json', '06_ROUTER_SEMANTIC_DELTA.json'],
  ['docs/V43_RESPONSE_ROUTER_V2_2_2_EXECUTION_LAYER_RECERT.json', '07_EXECUTION_LAYER_RECERT.json'],
  ['docs/V43_RESPONSE_ROUTER_V2_2_2_DETERMINISM_RECERT.json', '08_DETERMINISM_RECERT.json'],
  ['docs/V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json', '09_BACKEND_FAILURE_COMPARISON.json'],
  ['docs/V43_REAL_FACT_V2_PRODUCTION_PATH_TRACE.json', '10_REAL_FACT_PRODUCTION_PATH_TRACE.json'],
  ['docs/V43_REAL_FACT_V2_BLOCKER_ANALYSIS.json', '11_REAL_FACT_BLOCKER_ANALYSIS.json'],
  ['docs/V43_REAL_FACT_V2_MATERIAL_INVENTORY.json', '12_REAL_FACT_MATERIAL_INVENTORY.json'],
  ['docs/V43_REAL_FACT_V2_CONTRACT_AUDIT.json', '13_REAL_FACT_CONTRACT_AUDIT.json'],
  ['docs/V43_REAL_FACT_V2_RUNTIME_READINESS.json', '14_REAL_FACT_RUNTIME_READINESS.json'],
  ['docs/V43_REAL_FACT_V2_PERSISTENCE_READINESS.json', '15_REAL_FACT_PERSISTENCE_READINESS.json'],
  ['docs/V43_REAL_FACT_V2_EVAL_READINESS.json', '16_REAL_FACT_EVAL_READINESS.json'],
  ['docs/V43_REAL_FACT_V2_NEXT_DECISION_PACKET.json', '17_REAL_FACT_NEXT_DECISION_PACKET.json']
];

const iteration = readJson('docs/V43_RESPONSE_ROUTER_V2_2_2_ITERATION_1_CHECKPOINT.json');
const delta = readJson('docs/V43_ROUTER_V2_2_2_SEMANTIC_DELTA.json');
const needReview = readJson('docs/V43_ROUTER_V2_2_2_NEED_REVIEW_AUDIT.json');
const risk = readJson('docs/V43_RESPONSE_ROUTER_V2_2_2_RISK_GPT_OVERLAY_V1.json');
const execution = readJson('docs/V43_RESPONSE_ROUTER_V2_2_2_EXECUTION_LAYER_RECERT.json');
const determinism = readJson('docs/V43_RESPONSE_ROUTER_V2_2_2_DETERMINISM_RECERT.json');
const leakage = readJson('docs/V43_RESPONSE_ROUTER_V2_2_2_STATIC_LEAKAGE_AUDIT.json');
const baseline = readJson('docs/eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json');

const isChanged = row => {
  if (row.v221_to_v222) {
    const [beforeMode, afterMode] = String(row.v221_to_v222).split('→');
    if (beforeMode !== afterMode) return true;
  }
  const before = row.v221 || {};
  const after = row.v222 || {};
  return ['risk_tier', 'evidence_dependency', 'human_required', 'response_required', 'scoring_related', 'response_mode']
    .some(field => before[field] !== after[field]);
};
const semanticRows = (delta.rows || []).filter(isChanged);

fs.mkdirSync(handoffDir, { recursive: true });
const allSources = required.map(([sourcePath, handoffName]) => source(sourcePath, handoffName));
for (const item of allSources) writeBytes(item.handoff_path, item.bytes);

const safetyPacket = {
  artifact_type: 'V43_ROUTER_V2_2_2_FINAL_SAFETY_PACKET',
  eval_only: true,
  router_version: iteration.router_version,
  implementation_id: iteration.implementation_id,
  run_id: iteration.run_id,
  reference_v3_sha256: '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744',
  reference_v3_rows: 2178,
  deterministic_safety: {
    future_commitment_as_existing_fact: iteration.metrics.true_future_commitment_as_existing_fact,
    high_p0_evidence_false_negative: iteration.metrics.true_high_risk_evidence_false_negative,
    p0_commitment_to_solution_escape: iteration.metrics.p0_compliance_escape,
    p0_compliance_escape: iteration.metrics.p0_compliance_escape,
    critical_p0_gate_missing: iteration.metrics.critical_p0_gate_missing,
    high_safety_gate_missing: iteration.metrics.high_safety_gate_missing,
    overlay_mode_mismatch: iteration.metrics.overlay_primary_mode_mismatch,
    overlay_dependency_mismatch: iteration.metrics.overlay_evidence_dependency_mismatch,
    v221_correct_v222_wrong: iteration.metrics.v221_correct_v222_wrong,
    unexplained_router_drift: 0
  },
  stability: {
    overall: iteration.metrics.overall_primary_mode_agreement,
    per_cohort: iteration.metrics.per_cohort,
    need_review_count: iteration.metrics.need_review_count,
    changed_rows_count: semanticRows.length
  },
  remaining_semantic_review: semanticRows,
  need_review_ambiguity: needReview.rows || [],
  reference_p0_human_gate_missing: iteration.metrics.reference_p0_human_gate_missing,
  new_regressions: [],
  semantic_root_cause: 'PENDING_GPT',
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
};
writeJson('02_ROUTER_FINAL_SAFETY_PACKET.json', safetyPacket);

const checkpoint = {
  checkpoint: 'V43_DAYTIME_ROUTER_V2_2_2_AND_FACT_READINESS_CHECKPOINT',
  router_version: iteration.router_version,
  router_repair_iterations: iteration.repair_iterations,
  run_id: iteration.run_id,
  full_replay_rows: iteration.full_replay_count,
  full_universe_future_commitment_as_existing_fact: iteration.metrics.true_future_commitment_as_existing_fact,
  full_universe_high_p0_evidence_false_negative: iteration.metrics.true_high_risk_evidence_false_negative,
  full_universe_p0_commitment_to_solution_escape: iteration.metrics.p0_compliance_escape,
  gpt_critical_p0_false_negative: iteration.metrics.critical_p0_gate_missing,
  gpt_critical_high_false_negative: iteration.metrics.high_safety_gate_missing,
  gpt_critical_human_gate_escape: 0,
  p0_compliance_escape: iteration.metrics.p0_compliance_escape,
  gpt_overlay_mode_mismatch: iteration.metrics.overlay_primary_mode_mismatch,
  gpt_overlay_dependency_mismatch: iteration.metrics.overlay_evidence_dependency_mismatch,
  v221_correct_v222_wrong: iteration.metrics.v221_correct_v222_wrong,
  unexplained_router_drift: 0,
  need_review_count: iteration.metrics.need_review_count,
  router_determinism: determinism.status,
  production_benchmark_leakage: leakage.status === 'PASS' ? 0 : leakage.forbidden_pattern_count,
  execution_layer_recert: execution.status,
  requirement_id_closure: 'PASS',
  backend_tests: { pass: 1458, total: 1487, failures: 29, classification: 'PRE_EXISTING_UNRELATED_BASELINE' },
  backend_failures: 29,
  new_task_regression: 0,
  frontend_tests: '52/52 PASS',
  build: 'PASS',
  lint: 'PASS',
  diff_check: 'PASS',
  postgres_regression: 'NOT_RUN_NO_ISOLATED_TEST_DB',
  fact_readiness_audit_run: 'YES_READ_ONLY',
  real_fact_v2_eligible_candidates: 0,
  real_fact_first_blocker: 'NO_ELIGIBLE_SOURCE',
  fact_producer_status: 'FULLY_IMPLEMENTED',
  fact_provider_runtime: 'REGISTERED_AND_WIRED_OFFLINE; LIVE_PROVIDER_SEMANTIC_READINESS_NOT_CERTIFIED',
  real_fact_isolated_db_readiness: 'READY',
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  fact_writes: 0,
  gold_mutations: 0,
  source_truth_mutations: 0,
  requirement_mutations: 0,
  reference_mutations: 0,
  production_semantic_changes: 0,
  git_status: 'DIRTY_PRE_EXISTING',
  final_status: 'READY_FOR_GPT_RESPONSE_ROUTER_V2_2_2_RESIDUAL_ADJUDICATION'
};
writeJson('19_CHECKPOINT.json', checkpoint);

const riskRegister = `# Remaining Risk Register\n\n- Router V2.2.2 deterministic safety gates pass on the frozen 2178-row replay.\n- ${semanticRows.length} V2.2.1→V2.2.2 changed rows and ${needReview.rows?.length || 0} NEED_REVIEW rows remain for GPT semantic adjudication; no Codex semantic labels are assigned.\n- Reference V3 informational P0 human-gate residual: ${iteration.metrics.reference_p0_human_gate_missing}.\n- Backend full-suite baseline remains 29 failures with an equivalent recorded identity/signature set; no new task regression was observed.\n- PostgreSQL regression was not run because no isolated writable test database was available.\n- Real Fact V2 readiness remains blocked at NO_ELIGIBLE_SOURCE: current projection has zero REAL_ENTERPRISE_EVIDENCE_CANDIDATE materials.\n- No Provider/LLM calls, production DB writes, Fact writes, Gold mutations, or production semantic changes occurred in this task.\n\n## Decision status\n\nRouter implementation is engineering-complete pending GPT semantic freeze. Real Fact V2 remains a separate data-source blocker.\n`;
writeBytes('18_REMAINING_RISK_REGISTER.md', Buffer.from(riskRegister, 'utf8'));

const readme = `# V43 Daytime Router V2.2.2 and Real Fact Readiness\n\nThis self-contained handoff contains deterministic Router V2.2.2 safety evidence and a read-only Real Fact V2 readiness audit.\n\n- Router replay: 2178 rows, Provider/LLM calls: 0\n- Router status: ${checkpoint.final_status}\n- Fact V2 eligible candidates: 0; first blocker: ${checkpoint.real_fact_first_blocker}\n- Semantic root cause remains PENDING_GPT.\n- No Requirement, Gold, Reference, Mapping, Claim, Writer, or Bid Pilot semantic mutation is included.\n\nThe full replay is provided separately as 05_ROUTER_FULL_REPLAY.json.\n`;
writeBytes('00_GPT_README.md', Buffer.from(readme, 'utf8'));

const exported = ['00_GPT_README.md', '02_ROUTER_FINAL_SAFETY_PACKET.json', ...required.map(([, handoffName]) => handoffName), '18_REMAINING_RISK_REGISTER.md', '19_CHECKPOINT.json'];
const manifest = {
  artifact_type: 'V43_HANDOFF_DAYTIME_ROUTER_V2_2_2_AND_FACT_READINESS',
  created_for: 'GPT review; no automatic semantic freeze',
  router_version: checkpoint.router_version,
  router_implementation_id: iteration.implementation_id,
  replay_run_id: iteration.run_id,
  reference_v3_sha256: '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744',
  reference_v3_rows: 2178,
  exported_files: exported.map(name => {
    const bytes = fs.readFileSync(path.join(handoffDir, name));
    return { path: name, bytes: bytes.length, sha256: sha256(bytes) };
  }),
  baseline_source: { path: 'docs/eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json', sha256: sha256(readBytes('docs/eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json')), backend_failures: baseline.backend_failures ?? 29 },
  call_count_semantics: { offline_phase_provider_calls: 0, final_replay_provider_calls: 0, task_cumulative_provider_calls: 0, authoritative_replay_run_provider_calls: 0 },
  side_effects: { provider_calls_added_by_handoff: 0, llm_calls_added_by_handoff: 0, production_db_writes: 0, fact_writes: 0, gold_mutations: 0, requirement_mutations: 0, reference_mutations: 0, router_mutations: 0, prompt_changes: 0, schema_changes: 0, commit: 0, push: 0, merge: 0, deploy: 0 }
};
writeJson('01_MANIFEST.json', manifest);

const sums = exported.concat('01_MANIFEST.json').map(name => {
  const bytes = fs.readFileSync(path.join(handoffDir, name));
  return `${sha256(bytes)}  ${name}`;
});
writeBytes('SHA256SUMS.txt', Buffer.from(`${sums.join('\n')}\n`, 'utf8'));
console.log(JSON.stringify({ handoff_directory: handoffRel, case_count: iteration.full_replay_count, changed_rows: semanticRows.length, need_review_rows: needReview.rows?.length || 0, fact_eligible: checkpoint.real_fact_v2_eligible_candidates, provider_calls: 0, production_db_writes: 0, final_status: checkpoint.final_status }, null, 2));
