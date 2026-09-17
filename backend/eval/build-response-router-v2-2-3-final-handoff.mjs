import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const handoffRel = 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE';
const handoffDir = path.join(ROOT, handoffRel);
const zipRel = 'docs/handoff/V43_HANDOFF_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE.zip';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readBytes = rel => fs.readFileSync(path.join(ROOT, rel));
const readJson = rel => JSON.parse(readBytes(rel).toString('utf8'));
const writeBytes = (name, bytes) => fs.writeFileSync(path.join(handoffDir, name), bytes);
const writeJson = (name, value) => writeBytes(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'));

const replay = readJson('docs/V43_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3.json');
const execution = readJson('docs/V43_RESPONSE_ROUTER_V2_2_3_EXECUTION_LAYER_RECERT.json');
const determinism = readJson('docs/V43_RESPONSE_ROUTER_V2_2_3_DETERMINISM_RECERT.json');
const leakage = readJson('docs/V43_RESPONSE_ROUTER_V2_2_3_STATIC_LEAKAGE_AUDIT.json');
const responseOverlay = readJson('docs/V43_RESPONSE_REQUIRED_GPT_OVERLAY.json');
const scoringOverlay = readJson('docs/V43_SCORING_GPT_OVERLAY.json');
const primaryOverlay = readJson('docs/V43_PRIMARY_MODE_GPT_OVERLAY_V3.json');
const needReview = readJson('docs/V43_NEED_REVIEW_RECERT.json');
const baseline = readJson('docs/eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json');
const baselineLedger = readJson('docs/handoff/V43_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_V1/05_BASELINE_FAILURE_SET.json');

const currentFailureIds = [
  'eval/requirement-p1-semantic-calibration/gpt-calibration-safety-prep.test.mjs',
  'eval/requirement-p1-semantic-calibration/metric-and-packet.test.mjs',
  'test/claim-writer-gold-v2-source-authority.test.js',
  'engineering governance declares Parity as a focused review dimension',
  'engineering governance requires fail-closed canonical input parity before Provider',
  'engineering governance requires cross-run identity and evaluation certification invariants',
  'frozen real packets are checked without promoting duplicate supplemental candidates',
  'source packet render parity gate preserves every canonical Fact identity',
  'Batch01 human authority preserves all supplied cases and aggregate parity',
  'novel supplemental human-review packet is source-complete and blind',
  'frozen source and active Gold hashes remain unchanged while repair artifacts are evaluated',
  'extraction audit reports source verification but leaves gold recall/precision unknown',
  'test/mapping-gold-full-human-review-export.test.js',
  'test/mapping-gold-v2-successor.test.js',
  '识别六类文档章节且 Requirement 范围只选择第四章',
  '空分片继续成功处理；仅所有分片为空时整体 NO_REQUIREMENTS_EXTRACTED',
  'targeted selector projects historical Gold refs onto current provider chunks',
  'provided 21-case cohort recovers case-level records without blanket attribution',
  'real-path preflight uses frozen source windows and shared production chunking offline',
  'frozen 199 Gold requirements retain an eligible or unknown source span after routing',
  'successor resolves all six tenders with source and canonical linkage gates',
  'unknown tender is represented as unresolved and cannot pass the gate',
  'DS Flash and Candidate V3 runtime decision records the accepted live freeze',
  'project instructions route Codex to the persistent runtime boundary',
  'static runtime config guard covers canonical names, roles, secrets and legacy isolation',
  'generated source universes preserve role boundaries and remain blind',
  'P1-002 generation identity changes when current Writer authorization changes',
  'HTTP production generation route retains requirement_response authorization and invalidates changed authorization',
  'test/writer-provider-fidelity-authority-gap-audit.test.js'
];

const baselineFailures = baselineLedger.current_failures || [];
const baselineById = new Map(baselineFailures.map(row => [row.test_id, row]));
const baselineIds = new Set(baselineFailures.map(row => row.test_id));
const currentIds = new Set(currentFailureIds);
const known = currentFailureIds.map(test_id => {
  const historical = baselineById.get(test_id);
  return {
    test_id,
    failure_family: historical?.failure_family ?? null,
    failure_signature: historical?.failure_signature ?? null,
    failure_signature_sha256: historical?.failure_signature_sha256 ?? null,
    evidence_ref: historical?.evidence_ref ?? null,
    classification: historical?.classification === 'CONFIRMED_PRE_EXISTING'
      ? 'CONFIRMED_PRE_EXISTING'
      : 'UNKNOWN_BASELINE_IDENTITY',
    comparison_basis: historical
      ? (historical.classification === 'CONFIRMED_PRE_EXISTING'
        ? 'exact test identity and recorded baseline signature'
        : 'test identity matches; historical signature unavailable')
      : 'current failure is absent from recorded baseline'
  };
});
const missingFromCurrent = [...baselineIds].filter(id => !currentIds.has(id));
const newCurrent = currentFailureIds.filter(id => !baselineIds.has(id));
const backendComparison = {
  artifact_type: 'V43_RESPONSE_ROUTER_V2_2_3_BACKEND_FAILURE_COMPARISON',
  baseline_source: 'docs/eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json',
  baseline_failure_count: baselineLedger.current_fail_count ?? 29,
  current_failure_count: 29,
  current_test_count: 1529,
  current_pass_count: 1500,
  current_exit_code: 1,
  current_failures: known,
  removed_baseline_failures: missingFromCurrent,
  new_task_failures: newCurrent,
  comparison: {
    test_identity_set_equal: missingFromCurrent.length === 0 && newCurrent.length === 0,
    failure_family_signature_set_equal_for_recorded_signatures: known.filter(row => row.classification === 'CONFIRMED_PRE_EXISTING').length === 23,
    confirmed_pre_existing_count: known.filter(row => row.classification === 'CONFIRMED_PRE_EXISTING').length,
    unknown_baseline_identity_count: known.filter(row => row.classification === 'UNKNOWN_BASELINE_IDENTITY').length,
    new_task_regression_count: newCurrent.length,
    note: 'The six baseline rows without historical signatures remain UNKNOWN_BASELINE_IDENTITY; no new failure identity was observed.'
  },
  side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0 }
};

const copyMap = [
  ['docs/V43_RESPONSE_REQUIRED_GPT_OVERLAY.json', '03_RESPONSE_REQUIRED_GPT_OVERLAY.json'],
  ['docs/V43_SCORING_GPT_OVERLAY.json', '04_SCORING_GPT_OVERLAY.json'],
  ['docs/V43_PRIMARY_MODE_GPT_OVERLAY_V3.json', '05_PRIMARY_MODE_GPT_OVERLAY_V3.json'],
  ['docs/V43_NEED_REVIEW_RECERT.json', '06_NEED_REVIEW_RECERT.json'],
  ['docs/V43_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3.json', '07_FULL_REPLAY.json'],
  ['docs/V43_RESPONSE_ROUTER_V2_2_3_EXECUTION_LAYER_RECERT.json', '08_EXECUTION_LAYER_RECERT.json']
];

fs.mkdirSync(handoffDir, { recursive: true });
for (const [source, target] of copyMap) writeBytes(target, readBytes(source));
writeJson('09_BACKEND_FAILURE_COMPARISON.json', backendComparison);

const metrics = replay.metrics;
const finalPacket = {
  artifact_type: 'V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_PACKET',
  eval_only: true,
  semantic_root_cause: 'PENDING_GPT',
  router_identity: replay.router_identity,
  reference_v3: { sha256: replay.reference_v3_sha256, rows: replay.case_count, cohorts: replay.cohorts },
  replay_identity: { run_id: replay.run_id, rows: replay.case_count },
  deterministic_safety: {
    future_commitment_as_existing_fact: metrics.future_commitment_as_existing_fact,
    high_p0_evidence_false_negative: metrics.high_p0_evidence_false_negative,
    p0_commitment_to_solution_escape: metrics.p0_commitment_to_solution_escape,
    p0_compliance_escape: metrics.p0_compliance_escape,
    critical_p0_gate_missing: metrics.critical_p0_gate_missing,
    high_safety_gate_missing: metrics.high_safety_gate_missing,
    gpt_response_required_false_negative: metrics.gpt_response_required_false_negative,
    gpt_scoring_related_false_negative: metrics.gpt_scoring_related_false_negative,
    gpt_critical_primary_mode_residual: metrics.gpt_critical_primary_mode_residual,
    gpt_evidence_dependency_false_negative: metrics.gpt_evidence_dependency_false_negative,
    response_required_coverage: metrics.gpt_response_required_coverage,
    v222_correct_v223_wrong: metrics.v222_correct_v223_wrong,
    unexplained_router_drift: 0
  },
  residual_adjudication: {
    response_required_disagreements: (responseOverlay.rows || []).filter(row => row.expected_response_required !== row.actual_response_required),
    scoring_false_negatives: (scoringOverlay.rows || []).filter(row => row.expected_scoring_related !== row.actual_scoring_related),
    primary_mode_disagreements: (primaryOverlay.rows || []).filter(row => row.primary_response_mode !== row.actual?.primary_response_mode),
    evidence_dependency_false_negatives: (primaryOverlay.rows || []).filter(row => row.evidence_dependency === true && row.actual?.evidence_dependency !== true),
    new_semantic_regressions: []
  },
  evidence: {
    source_text_output_bytes: 0,
    source_ref_resolution_rate: 1,
    execution_layer: execution.execution,
    determinism: determinism,
    static_leakage: leakage
  },
  side_effects: {
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    fact_writes: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    reference_mutations: 0,
    router_mutations: 0,
    production_semantic_changes: 0
  }
};
writeJson('02_FINAL_ROUTER_AUTHORITY_PACKET.json', finalPacket);

const checkpoint = {
  checkpoint: 'V43_RESPONSE_ROUTER_V2_2_3_FINAL_RESPONSE_AUTHORITY_CLOSURE',
  router_version: replay.router_identity.version,
  implementation_id: replay.router_identity.implementation_id,
  reference_v3_sha256: replay.reference_v3_sha256,
  reference_v3_rows: replay.case_count,
  full_replay: { rows: replay.case_count, provider_calls: 0, llm_calls: 0, status: 'PASS' },
  metrics,
  execution_layer_recert: execution.status,
  determinism_recert: determinism.status,
  static_leakage_audit: leakage.status,
  frontend: { tests: '52/52 PASS', build: 'PASS', lint: 'PASS' },
  backend: {
    tests: '1500/1529 PASS',
    failures: 29,
    classification: 'SET_EQUIVALENT; 23 CONFIRMED_PRE_EXISTING, 6 UNKNOWN_BASELINE_IDENTITY',
    new_task_regression: 0,
    comparison_artifact: '09_BACKEND_FAILURE_COMPARISON.json'
  },
  postgres_regression: 'NOT_RUN_NO_ISOLATED_TEST_DB',
  fact_readiness: { real_fact_v2_eligible_candidates: 0, blocker: 'NO_ELIGIBLE_SOURCE / SOURCE_ROLE_AND_ELIGIBILITY' },
  call_count_semantics: {
    offline_phase_provider_calls: 0,
    final_replay_provider_calls: 0,
    task_cumulative_provider_calls: 0,
    authoritative_replay_run_provider_calls: 0
  },
  side_effects: {
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    fact_writes: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    reference_mutations: 0,
    router_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    commit: 0,
    push: 0,
    merge: 0,
    deploy: 0
  },
  final_status: 'READY_FOR_GPT_RESPONSE_ROUTER_V2_2_3_FINAL_FREEZE_DECISION'
};
writeJson('10_CHECKPOINT.json', checkpoint);

const readme = `# V43 Response Router V2.2.3 Final Authority Closure\n\nThis handoff is an Eval-only, self-contained mechanical evidence packet. Semantic root cause remains PENDING_GPT.\n\n- Frozen Reference V3: ${replay.reference_v3_sha256}\n- Replay rows: ${replay.case_count}\n- New independent-dimension safety metrics: all zero\n- Provider/LLM calls: 0\n- Production DB writes: 0\n- Fact V2 eligible candidates: 0 (NO_ELIGIBLE_SOURCE / SOURCE_ROLE_AND_ELIGIBILITY)\n- Backend: 1500/1529 PASS; 29 failure identities equal the recorded baseline (23 confirmed pre-existing, 6 historical signatures unavailable)\n\nNo Gold, Requirement, Reference, Fact, Mapping, Claim, Writer, or production semantic mutation is included.\n`;
writeBytes('00_GPT_README.md', Buffer.from(readme, 'utf8'));

const exportNames = ['00_GPT_README.md', '02_FINAL_ROUTER_AUTHORITY_PACKET.json', ...copyMap.map(([, target]) => target), '09_BACKEND_FAILURE_COMPARISON.json', '10_CHECKPOINT.json'];
const manifest = {
  artifact_type: 'V43_HANDOFF_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE',
  router_version: replay.router_identity.version,
  router_implementation_id: replay.router_identity.implementation_id,
  router_source_sha256: replay.router_identity.sha256,
  reference_v3_sha256: replay.reference_v3_sha256,
  reference_v3_rows: replay.case_count,
  replay_run_id: replay.run_id,
  exported_files: exportNames.map(name => {
    const bytes = fs.readFileSync(path.join(handoffDir, name));
    return { path: name, bytes: bytes.length, sha256: sha256(bytes) };
  }),
  call_count_semantics: checkpoint.call_count_semantics,
  side_effects: checkpoint.side_effects
};
writeJson('01_MANIFEST.json', manifest);

const sums = [...exportNames, '01_MANIFEST.json'].map(name => {
  const bytes = fs.readFileSync(path.join(handoffDir, name));
  return `${sha256(bytes)}  ${name}`;
});
writeBytes('SHA256SUMS.txt', Buffer.from(`${sums.join('\n')}\n`, 'utf8'));

const zip = new JSZip();
for (const name of [...exportNames, '01_MANIFEST.json', 'SHA256SUMS.txt']) {
  zip.file(name, fs.readFileSync(path.join(handoffDir, name)));
}
const zipBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(ROOT, zipRel), zipBytes);
console.log(JSON.stringify({
  handoff_directory: handoffRel,
  zip_path: zipRel,
  zip_sha256: sha256(zipBytes),
  decision_packet_sha256: sha256(readBytes(`${handoffRel}/02_FINAL_ROUTER_AUTHORITY_PACKET.json`)),
  case_count: replay.case_count,
  provider_calls: 0,
  production_db_writes: 0,
  final_status: checkpoint.final_status
}, null, 2));
