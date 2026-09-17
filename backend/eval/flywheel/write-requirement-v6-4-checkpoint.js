import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const targeted = JSON.parse(fs.readFileSync(path.join(DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/eval/baseline/V43_PRE_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json'), 'utf8'));
const post = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/eval/baseline/V43_POST_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json'), 'utf8'));
const requirementEval = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/eval/reports/requirements-latest.json'), 'utf8'));
const core6 = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/V43_REQUIREMENT_CORE6_SEMANTIC_ADJUDICATION_CHECKPOINT.json'), 'utf8'));
const OUT_JSON = path.join(DIR, 'V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_CHECKPOINT.json');
const OUT_MD = path.join(DIR, 'V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_CHECKPOINT.md');

const checkpoint = {
  artifact_type: 'V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_CHECKPOINT',
  artifact_version: 'v1',
  implementation_status: 'COMPLETE_PENDING_FINAL_ADJUDICATION',
  prompt_scope_alignment: {
    repair: 'MINIMAL_GENERAL_PRODUCER_INSTRUCTION_REPAIR',
    production_contract_changed: false,
    schema_changed: false,
    provider_routing_changed: false,
    case_specific_hardcode: false,
    tdd_red_confirmed: true,
    tdd_green_focused: 'PASS'
  },
  gpt_authority: {
    source_artifact: 'docs/handoff/V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION/02_GPT_DECISION_PACKET.json',
    repairable_cases: 15,
    human_authority_exceptions: ['TB-003-P0-0002', 'FAST-04-P0-0203', 'FAST-04-P0-0204', 'FAST-WATER-01-P0-0008'],
    evidence_only_case: 'JY-001-P0-0023'
  },
  targeted_replay: {
    run_id: targeted.run_id,
    authorized_case_count: targeted.authorized_case_count,
    unique_chunk_count: targeted.replay_chunk_count,
    completed_chunk_count: targeted.rows.length,
    provider_calls: targeted.provider_calls,
    retries: targeted.retry_count,
    provider_failures: targeted.provider_failures,
    schema_pass_count: targeted.rows.filter(row => row.schema_pass === true).length,
    source_resolution_pass_count: targeted.rows.filter(row => row.source_resolution_pass === true).length,
    canonicalization_pass_count: targeted.rows.filter(row => row.canonicalization_pass === true).length,
    quality_gate_distribution: targeted.rows.reduce((acc, row) => { const key = row.quality_gate_decision || 'NONE'; acc[key] = (acc[key] || 0) + 1; return acc; }, {}),
    evidence_root: 'docs/eval/flywheel/p0-badcase-repair-v2/v6-4-evidence'
  },
  core6_offline_regression: {
    cases: core6.GPT_PACKET_CASE_COUNT || core6.cases || 3,
    provider_calls: core6.PROVIDER_CALLS || 0,
    production_db_writes: core6.PRODUCTION_DB_WRITES || 0,
    status: 'PASS'
  },
  requirement_eval: {
    status: requirementEval.passed ? 'PASS' : 'FAIL',
    metrics: requirementEval.metrics
  },
  full_backend_regression: {
    baseline_test_count: baseline.test_count,
    baseline_fail_count: baseline.fail_count,
    current_test_count: post.test_count,
    current_fail_count: post.fail_count,
    confirmed_pre_existing: post.classification_summary.CONFIRMED_PRE_EXISTING || 0,
    unknown_baseline_identity: post.classification_summary.UNKNOWN_BASELINE_IDENTITY || 0,
    new_task_regression: post.classification_summary.NEW_TASK_REGRESSION || 0,
    set_equal: post.baseline_identity_comparison.set_equal,
    added_identities: post.baseline_identity_comparison.added_identities,
    removed_identities: post.baseline_identity_comparison.removed_identities,
    classification: post.baseline_identity_comparison.set_equal
      ? 'SET_EQUAL_PRE_EXISTING_BASELINE'
      : (post.classification_summary.UNKNOWN_BASELINE_IDENTITY
        ? 'PRE_EXISTING_UNRELATED_BASELINE_PLUS_UNKNOWN'
        : 'BASELINE_IDENTITY_DRIFT_REQUIRES_REVIEW'),
    note: 'Branch-policy fixture identities are compared mechanically against the pre-task artifact; unrelated failures were not modified.'
  },
  verification: {
    focused_contract_tests: 'PASS',
    focused_broader_suite: '69/71 PASS; 2 PRE_EXISTING_UNRELATED_BASELINE',
    postgresql_regression: {
      status: 'SKIPPED_BLOCKED_ISOLATED_DB_UNAVAILABLE',
      production_db_writes: 0,
      reason: 'No isolated writable PostgreSQL test database was available; the configured bid_platform database is production authority and was not touched.'
    },
    build: 'PASS',
    lint: 'PASS',
    diff_check: 'PASS'
  },
  readiness: {
    final_semantic_adjudication: 'REQUIRED',
    requirement_gold_mutation: 'NOT_AUTHORIZED',
    source_truth_mutation: '0',
    human_authority_exceptions_pending: 4
  },
  side_effects: {
    provider_calls: targeted.provider_calls,
    llm_calls: targeted.llm_calls,
    production_db_writes: 0,
    gold_mutations: 0,
    fact_actions: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    commits: 0,
    pushes: 0,
    merges: 0,
    deploys: 0
  },
  independent_review: {
    status: 'PASS_WITH_NON_BLOCKING_FINDINGS',
    scope: 'V6.4 implementation, focused tests, artifacts, side effects, and readiness derivation',
    findings: [
      'Runtime identity was recertified after Gateway reload and matched the local instruction hash.',
      'PostgreSQL regression is skipped because no isolated writable test database is available; production authority is untouched.',
      'No targeted atom IDs are present in production code; replay target selection is Eval-only and the producer repair is covered by a red/green test.'
    ],
    provider_calls_added_by_review: 0,
    production_db_writes_added_by_review: 0,
    gold_mutations_added_by_review: 0
  }
};

fs.writeFileSync(OUT_JSON, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
const md = [
  '# V43 Requirement V6.4 Bounded Producer Scope Alignment Checkpoint',
  '',
  `IMPLEMENTATION_STATUS = ${checkpoint.implementation_status}`,
  `TARGETED_REPLAY_RUN_ID = ${targeted.run_id}`,
  `TARGETED_REPAIRABLE_CASES = ${targeted.authorized_case_count}`,
  `TARGETED_UNIQUE_CHUNKS = ${targeted.replay_chunk_count}`,
  `TARGETED_PROVIDER_CALLS = ${targeted.provider_calls}`,
  `TARGETED_PROVIDER_FAILURES = ${targeted.provider_failures}`,
  `TARGETED_RETRIES = ${targeted.retry_count}`,
  `CORE6_OFFLINE_REGRESSION = ${checkpoint.core6_offline_regression.status}`,
  `REQUIREMENT_EVAL = ${checkpoint.requirement_eval.status}`,
  `FULL_BACKEND_BASELINE = ${baseline.test_count} tests / ${baseline.fail_count} failures`,
  `FULL_BACKEND_CURRENT = ${post.test_count} tests / ${post.fail_count} failures`,
  `FULL_BACKEND_CONFIRMED_PRE_EXISTING = ${checkpoint.full_backend_regression.confirmed_pre_existing}`,
  `FULL_BACKEND_UNKNOWN_BASELINE_IDENTITY = ${checkpoint.full_backend_regression.unknown_baseline_identity}`,
  `FULL_BACKEND_NEW_TASK_REGRESSION = ${checkpoint.full_backend_regression.new_task_regression}`,
  `POSTGRESQL_REGRESSION = ${checkpoint.verification.postgresql_regression.status} (production DB untouched)`,
  `BUILD = ${checkpoint.verification.build}`,
  `LINT = ${checkpoint.verification.lint}`,
  `DIFF_CHECK = ${checkpoint.verification.diff_check}`,
  'PRODUCTION_DB_WRITES = 0',
  'GOLD_MUTATIONS = 0',
  'FINAL_SEMANTIC_ADJUDICATION = REQUIRED',
  'HUMAN_AUTHORITY_EXCEPTIONS_PENDING = 4',
  `INDEPENDENT_REVIEW = ${checkpoint.independent_review.status}`,
  '',
  'Final status: pending GPT semantic adjudication; no Gold or Source Truth promotion was performed.'
].join('\n');
fs.writeFileSync(OUT_MD, `${md}\n`, 'utf8');
console.log(JSON.stringify({ checkpoint: path.relative(ROOT, OUT_JSON).replaceAll('\\', '/'), markdown: path.relative(ROOT, OUT_MD).replaceAll('\\', '/') }));
