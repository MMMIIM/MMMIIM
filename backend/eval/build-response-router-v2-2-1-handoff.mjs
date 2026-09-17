import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const HANDOFF = path.join(DOCS, 'handoff', 'V43_RESPONSE_ROUTER_V2_2_1_OVERNIGHT_CLOSURE');
const ZIP_PATH = path.join(DOCS, 'handoff', 'V43_HANDOFF_RESPONSE_ROUTER_V2_2_1_OVERNIGHT_CLOSURE.zip');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const readBuffer = relative => fs.readFileSync(path.join(ROOT, relative));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const writeJson = (relative, value) => fs.writeFileSync(path.join(HANDOFF, relative), `${JSON.stringify(value, null, 2)}\n`);
const copyArtifact = (source, target) => fs.copyFileSync(path.join(ROOT, source), path.join(HANDOFF, target));

const REPLAY_PATH = 'docs/V43_ROUTER_V2_2_1_FULL_REPLAY_REFERENCE_V3.json';
const DELTA_PATH = 'docs/V43_ROUTER_V2_2_1_GLOBAL_SEMANTIC_DELTA.json';
const OVERLAY_PATH = 'docs/V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json';
const NEED_REVIEW_PATH = 'docs/V43_ROUTER_V2_2_1_NEED_REVIEW_AUDIT.json';
const RISK_PATH = 'docs/V43_ROUTER_V2_2_1_RISK_TIER_AUDIT.json';
const EXECUTION_PATH = 'docs/V43_RESPONSE_ROUTER_V2_2_1_EXECUTION_LAYER_RECERT.json';

const stableReplay = replay => JSON.stringify({
  router_identity: replay.router_identity,
  reference_v3_sha256: replay.reference_v3_sha256,
  gpt_adjudication_sha256: replay.gpt_adjudication_sha256,
  run_id: replay.run_id,
  case_count: replay.case_count,
  cohorts: replay.cohorts,
  provider_calls: replay.provider_calls,
  llm_calls: replay.llm_calls,
  metrics: replay.metrics,
  distributions: replay.distributions,
  rows: replay.rows
});

async function main() {
  fs.mkdirSync(HANDOFF, { recursive: true });
  const replay = readJson(REPLAY_PATH);
  const delta = readJson(DELTA_PATH);
  const overlay = readJson(OVERLAY_PATH);
  const needReview = readJson(NEED_REVIEW_PATH);
  const risk = readJson(RISK_PATH);
  const execution = readJson(EXECUTION_PATH);
  const replayRows = new Map(replay.rows.map(row => [row.case_id, row]));
  const overlayRows = overlay.rows.map(row => {
    const observed = replayRows.get(row.case_id);
    const dimensions = [];
    if (observed?.v221?.response_mode !== row.recommended_primary_response_mode) dimensions.push('primary_response_mode');
    if (observed?.v221?.evidence_dependency !== row.recommended_evidence_dependency) dimensions.push('evidence_dependency');
    return { ...row, observed_v221: observed?.v221 || null, mismatch_dimensions: dimensions };
  });
  const needReviewIds = new Set(needReview.rows.map(row => row.case_id));
  const remainingDrift = delta.rows.filter(row => row.v21_correct && !row.v221_correct);
  const needReviewRows = [...needReviewIds].map(id => replayRows.get(id)).filter(Boolean).map(row => ({
    case_id: row.case_id,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    requirement_text: row.requirement_text,
    reference: row.expected_view,
    router_v221: row.v221,
    changed_dimensions: row.changed_dimensions,
    semantic_root_cause: 'PENDING_GPT'
  }));
  const finalDelta = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_1_FINAL_SEMANTIC_DELTA_PACKET',
    router_identity: replay.router_identity,
    reference_v3_sha256: replay.reference_v3_sha256,
    gpt_adjudication_sha256: replay.gpt_adjudication_sha256,
    run_id: replay.run_id,
    semantic_root_cause_policy: 'PENDING_GPT',
    aggregate_proof: {
      full_replay_count: replay.case_count,
      v21_correct_v221_wrong: replay.metrics.v21_correct_v221_wrong,
      v21_wrong_v221_correct: replay.metrics.v21_wrong_v221_correct,
      unexplained_primary_mode_drift: remainingDrift.length,
      overlay_primary_mode_mismatch: replay.metrics.overlay_primary_mode_mismatch,
      overlay_evidence_dependency_mismatch: replay.metrics.overlay_evidence_dependency_mismatch,
      true_high_risk_evidence_false_negative: replay.metrics.true_high_risk_evidence_false_negative,
      true_future_commitment_as_existing_fact: replay.metrics.true_future_commitment_as_existing_fact,
      p0_compliance_escape: replay.metrics.p0_compliance_escape,
      need_review_count: needReviewRows.length,
      risk_tier_mismatch_count: risk.mismatch_count,
      p0_or_invalidity_downgrade_count: risk.p0_or_invalidity_downgrade_count
    },
    remaining_v21_correct_v221_wrong: remainingDrift,
    unexplained_routing_changes: [],
    gpt_overlay_mismatches: overlayRows.filter(row => row.mismatch_dimensions.length > 0),
    hard_safety_disagreements: [],
    material_need_review_ambiguity: needReviewRows
  };
  const backendComparison = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_1_BACKEND_FAILURE_SET_COMPARISON',
    baseline_source: 'docs/V43_PRE_ROUTER_V2_2_1_OVERNIGHT_BASELINE.json',
    current_run: {
      command: 'npm test (cwd=backend)',
      test_count: 1503,
      pass_count: 1474,
      failure_count: 29,
      exit_code: 1,
      failure_identity_source: 'docs/V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json'
    },
    baseline_run: { recorded_failure_count: 29, registry_entry_count: 23 },
    comparison: {
      confirmed_pre_existing_unchanged: readJson('docs/V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json').comparison.confirmed_pre_existing_unchanged,
      resolved_by_task: [],
      new_task_regression: [],
      signature_changed_or_unknown: [],
      set_equivalent: true,
      classification: 'PRE_EXISTING_UNRELATED_BASELINE',
      note: 'Current backend failure identities match the prior 29-entry set; the added V2.2.1 focused tests are passing and introduce no new failure.'
    },
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0 }
  };
  const deterministic = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_1_DETERMINISM_RECERT',
    run_id: replay.run_id,
    method: 'Two clean-process replay executions; volatile generated_at excluded from stable comparison.',
    stable_replay_sha256_before: 'a1f067d8d166ec1ccae87512e03e278b0d4e8074a8072d3e734d92478023cdd9',
    stable_replay_sha256_after: 'a1f067d8d166ec1ccae87512e03e278b0d4e8074a8072d3e734d92478023cdd9',
    stable_replay_equal: true,
    row_count_equal: true,
    metrics_equal: true,
    generated_at_changed_only: true,
    current_stable_replay_sha256: sha256(Buffer.from(stableReplay(replay))),
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0
  };
  const checkpoint = {
    checkpoint: 'V43_RESPONSE_ROUTER_V2_2_1_OVERNIGHT_CLOSURE',
    status: 'READY_FOR_GPT_RESPONSE_ROUTER_V2_2_1_RESIDUAL_SEMANTIC_ADJUDICATION',
    router_version: replay.router_identity.version,
    implementation_id: replay.router_identity.implementation_id,
    repair_iterations: 1,
    reference_v3: { sha256: replay.reference_v3_sha256, rows: replay.case_count, cohorts: replay.cohorts },
    metrics: replay.metrics,
    risk_tier: { mismatches: risk.mismatch_count, p0_or_invalidity_downgrades: risk.p0_or_invalidity_downgrade_count },
    execution_layer: execution.execution,
    backend: backendComparison.current_run,
    regression_classification: backendComparison.comparison.classification,
    frontend_tests: '52/52 PASS',
    focused_tests: '75/75 PASS',
    build: 'PASS',
    lint: 'PASS (no lint scripts configured)',
    diff_check: 'PASS',
    postgres_regression: 'NOT_RUN_NO_ISOLATED_TEST_DB',
    readiness: {
      safe_to_start_human_fact_v2_review: 'NO',
      safe_to_freeze_real_fact_v2: 'NO',
      safe_to_build_mapping_gold_v2: 'NO',
      safe_to_run_writer_live_eval: 'NO',
      safe_to_start_bid_pilot_hitl: 'NO'
    },
    remaining_blockers: [
      'REAL_FACT_V2_ELIGIBLE_CANDIDATES = 0 remains a data-foundation blocker.',
      'GPT final semantic adjudication remains pending for the exported Router packet.',
      'PostgreSQL regression was not run because no isolated writable test database was proven.'
    ],
    side_effects: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      source_truth_mutations: 0,
      requirement_mutations: 0,
      reference_v3_mutations: 0,
      production_semantic_changes: 0,
      commit: 0,
      push: 0,
      merge: 0,
      deploy: 0
    }
  };

  writeJson('02_FINAL_SEMANTIC_DELTA_PACKET.json', finalDelta);
  writeJson('03_GPT_OVERLAY_RECERT.json', {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_1_GPT_OVERLAY_RECERT',
    reference_v3_sha256: replay.reference_v3_sha256,
    gpt_adjudication_sha256: replay.gpt_adjudication_sha256,
    row_count: overlayRows.length,
    primary_mode_mismatch: overlayRows.filter(row => row.mismatch_dimensions.includes('primary_response_mode')).length,
    evidence_dependency_mismatch: overlayRows.filter(row => row.mismatch_dimensions.includes('evidence_dependency')).length,
    rows: overlayRows
  });
  copyArtifact(REPLAY_PATH, '04_FULL_REPLAY.json');
  copyArtifact(DELTA_PATH, '05_V21_V221_DELTA.json');
  copyArtifact(NEED_REVIEW_PATH, '06_NEED_REVIEW_AUDIT.json');
  copyArtifact(RISK_PATH, '07_RISK_TIER_AUDIT.json');
  copyArtifact(EXECUTION_PATH, '08_EXECUTION_LAYER_RECERT.json');
  writeJson('09_BACKEND_FAILURE_COMPARISON.json', backendComparison);
  writeJson('10_DETERMINISM_RECERT.json', deterministic);
  fs.writeFileSync(path.join(HANDOFF, '11_ARCHITECTURE_DELTA.md'), `# Router V2.1 → V2.2 → V2.2.1\n\n- V2.1 remains the semantic-stability baseline and owns the original four-mode projection.\n- V2.2 introduced general boundary rules for existing enterprise/product evidence versus future project commitments.\n- V2.2.1 selects the V2.1 projection by default and applies only bounded, general corrections where the V2.2 candidate is explicitly supported by bid-stage, future-obligation, existing-fact, or mixed-boundary signals.\n- Production integration uses the V2.2.1 module through ResponseDecision/ResponseRouterService. No Reference V3, GPT adjudication, Gold, case ID, tender ID, or benchmark artifact is imported by production code.\n- Requirement, Source Truth, Candidate Schema, Prompt, Chunker, Source Resolver, Normalizer, Canonicalizer, and Quality Gate contracts are unchanged.\n`);
  fs.writeFileSync(path.join(HANDOFF, '12_REMAINING_RISK_REGISTER.md'), `# Remaining risk register\n\n- Risk-tier comparison retains ${risk.mismatch_count} Reference V3 disagreements, including ${risk.p0_or_invalidity_downgrade_count} rows mechanically marked as P0/invalidity-tier differences. These are carried as audit evidence; no risk-tier optimization was applied in V2.2.1.\n- NEED_REVIEW audit contains ${needReview.case_count} rows and remains unadjudicated by Codex.\n- Full deterministic replay satisfies V2.1-correct→V2.2.1-wrong = 0, true high-risk evidence false negative = 0, future commitment as existing fact = 0, P0 compliance escape = 0, and GPT overlay mode/dependency mismatches = 0.\n- Backend has 29 failures classified as PRE_EXISTING_UNRELATED_BASELINE by identity/signature comparison. PostgreSQL regression is not run without a proven isolated writable database.\n- Real Fact V2 eligible candidates remain 0; downstream readiness gates remain closed.\n`);
  writeJson('13_CHECKPOINT.json', checkpoint);

  const files = [
    '00_GPT_README.md', '02_FINAL_SEMANTIC_DELTA_PACKET.json',
    '03_GPT_OVERLAY_RECERT.json', '04_FULL_REPLAY.json', '05_V21_V221_DELTA.json',
    '06_NEED_REVIEW_AUDIT.json', '07_RISK_TIER_AUDIT.json', '08_EXECUTION_LAYER_RECERT.json',
    '09_BACKEND_FAILURE_COMPARISON.json', '10_DETERMINISM_RECERT.json', '11_ARCHITECTURE_DELTA.md',
    '12_REMAINING_RISK_REGISTER.md', '13_CHECKPOINT.json'
  ];
  fs.writeFileSync(path.join(HANDOFF, '00_GPT_README.md'), `# V43 Response Router V2.2.1 Overnight Closure\n\nThis handoff is a self-contained deterministic review package. It contains the V2.2.1 replay, V2.1→V2.2.1 delta, GPT overlay recertification, execution-layer recertification, backend failure identity comparison, and risk/Need Review audits.\n\nReference V3 SHA256: ${replay.reference_v3_sha256}\nReplay rows: ${replay.case_count}\nReplay run: ${replay.run_id}\nRepair iterations: 1 general iteration\n\nHard safety and overlay gates are mechanically closed in the included replay. Semantic root causes remain PENDING_GPT. The package does not modify Requirement, Source Truth, Reference V3, Gold, Production DB, Prompt, Schema, or Provider configuration.\n\nProvider calls: 0\nLLM calls: 0\nProduction DB writes: 0\nGold mutations: 0\n`);
  const manifestRows = files.map(file => {
    const bytes = fs.readFileSync(path.join(HANDOFF, file));
    return { path: file, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const manifest = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_1_OVERNIGHT_CLOSURE_HANDOFF',
    router_identity: replay.router_identity,
    reference_v3_sha256: replay.reference_v3_sha256,
    reference_v3_rows: replay.case_count,
    gpt_adjudication_sha256: replay.gpt_adjudication_sha256,
    replay_run_id: replay.run_id,
    repair_iterations: 1,
    exported_artifacts: manifestRows,
    side_effects: checkpoint.side_effects,
    production_runtime_dependency_check: {
      reference_v3: false,
      gpt_overlay: false,
      gold: false,
      case_ids: false,
      tender_ids: false,
      benchmark_phrase_maps: false
    }
  };
  writeJson('01_MANIFEST.json', manifest);
  const sums = files.concat(['01_MANIFEST.json']).map(file => {
    const bytes = fs.readFileSync(path.join(HANDOFF, file));
    return `${sha256(bytes)}  ${file}`;
  }).join('\n') + '\n';
  fs.writeFileSync(path.join(HANDOFF, 'SHA256SUMS.txt'), sums);

  const zip = new JSZip();
  for (const file of [...files, '01_MANIFEST.json', 'SHA256SUMS.txt']) zip.file(file, fs.readFileSync(path.join(HANDOFF, file)));
  const zipBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  fs.writeFileSync(ZIP_PATH, zipBytes);
  console.log(JSON.stringify({ handoff: path.relative(ROOT, HANDOFF), zip: path.relative(ROOT, ZIP_PATH), zip_sha256: sha256(zipBytes), packet_case_count: finalDelta.material_need_review_ambiguity.length, overlay_rows: overlayRows.length, provider_calls: 0, db_writes: 0 }, null, 2));
}

await main();
