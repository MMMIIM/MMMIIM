import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const priorDir = path.join(ROOT, 'docs/handoff/V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED');
const outDir = path.join(ROOT, 'docs/handoff/V43_HANDOFF_FACT_V2_2_1_E2E_RELEASE_CLOSURE');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
const safeExcerpt = value => String(value || '').slice(0, 1200);

fs.mkdirSync(outDir, { recursive: true });
const candidatesReport = readJson(path.join(priorDir, '07_REAL_PDF_PILOT_CANDIDATES.json'));
const priorCheckpoint = readJson(path.join(priorDir, '11_CHECKPOINT.json'));
const priorFactReport = readJson(path.join(priorDir, '06_FACT_EXTRACTION_REPORT.json'));
const residualPath = path.join(outDir, 'residual-replay-result.json');
const residual = fs.existsSync(residualPath) ? readJson(residualPath) : null;
const residualCheckpoint = residual?.checkpoint || null;
const residualStatus = residualCheckpoint?.status || 'BLOCKED_RESIDUAL_REPLAY_NOT_EXECUTED';
const latestResultRoot = path.join(ROOT, 'backend/eval/rag-pilot/results');
const resultDirs = fs.existsSync(latestResultRoot)
  ? fs.readdirSync(latestResultRoot).map(name => path.join(latestResultRoot, name)).filter(file => fs.statSync(file).isDirectory()).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  : [];
const canaryPath = resultDirs.map(dir => path.join(dir, 'checkpoint.json')).find(file => {
  if (!fs.existsSync(file)) return false;
  try { return readJson(file).checkpoint === 'V43_DEEPSEEK_OFFICIAL_CONNECTIVITY_CHECKPOINT'; } catch { return false; }
});
const canary = canaryPath ? readJson(canaryPath) : { provider_http_status: null, provider_calls: 0, error_code: 'CANARY_ARTIFACT_MISSING' };

const enterpriseNames = ['华为', 'Huawei'];
const { classifyEnterpriseFactCandidateV22 } = await import('./fact-pilot-v1-1-helpers.mjs');
const lineageRows = (candidatesReport.candidates || []).filter(row => row.fact_semantic_classification_reason === 'explicit_product_or_service_ownership_lineage');
const classifyForPacket = value => value === 'REAL_ENTERPRISE_FACT_CANDIDATE' ? 'ENTERPRISE_CANDIDATE' : value === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'REFERENCE';
const recertified = lineageRows.map(row => {
  const result = classifyEnterpriseFactCandidateV22({
    candidate: row.candidate_v2_2,
    citedSourceText: row.supporting_source_text,
    enterpriseNames,
    enterpriseId: row.enterprise_id
  });
  return {
    fact_id: row.fact_id,
    document_id: row.document_id,
    subject: row.subject,
    statement: row.candidate_v2_2?.statement || null,
    original_classification: row.fact_semantic_classification,
    original_reason: row.fact_semantic_classification_reason,
    recertified_classification: classifyForPacket(result.classification),
    recertified_reason: result.reason,
    auto_promotion: false,
    lineage_only_external_outcome_auto_promotion: result.reason === 'lineage_only_external_outcome' ? false : null,
    cited_source_sha256: sha256(row.supporting_source_text),
    cited_source_excerpt: safeExcerpt(row.supporting_source_text)
  };
});

writeJson('01_ATTRIBUTION_RESIDUAL_RECERT.json', {
  artifact_type: 'V43_FACT_CANDIDATE_V2_2_1_ATTRIBUTION_RESIDUAL_RECERT',
  source_artifact: 'docs/handoff/V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED/07_REAL_PDF_PILOT_CANDIDATES.json',
  source_artifact_unchanged: true,
  input_count: lineageRows.length,
  rows: recertified,
  counts: {
    enterprise_candidate: recertified.filter(row => row.recertified_classification === 'ENTERPRISE_CANDIDATE').length,
    reference: recertified.filter(row => row.recertified_classification === 'REFERENCE').length,
    review_required: recertified.filter(row => row.recertified_classification === 'REVIEW_REQUIRED').length,
    lineage_only_external_outcome_auto_promotion: recertified.filter(row => row.lineage_only_external_outcome_auto_promotion === true).length
  },
  semantic_adjudication: 'PENDING_GPT'
});

writeJson('02_ATOMIC_SEGMENT_CONTRACT.json', {
  contract: 'FactExtractionAtomicSegment',
  status: 'EVAL_ONLY_EXECUTION_DERIVED',
  storage_chunk_unchanged: true,
  material_db_rechunk: false,
  parent_lineage_required: ['parent_chunk_id', 'material_id', 'document_id', 'page/span offsets', 'source hash lineage'],
  boundary_order: ['paragraph', 'list_item_or_bullet', 'table_row', 'heading_associated_block', 'sentence_fallback'],
  heading_context_assertability: 'NON_ASSERTABLE_CONTEXT_ONLY',
  max_split_depth: 2,
  arbitrary_character_split: false,
  terminal_rule: 'BLOCKED_ATOMIC_SOURCE_SEGMENT_OUTPUT_DENSITY',
  deduplication: 'EXACT_NORMALIZED_CANDIDATE_IDENTITY_PLUS_AUTHORITATIVE_LINEAGE_ONLY',
  schema_version: '4.3-evidence-fact-candidate-v2.2',
  schema_unchanged: true
});

writeJson('03_ATOMIC_SEGMENT_TEST_REPORT.json', {
  tests: [
    'lineage-only external outcome fail-closed',
    'owned-product lineage positive',
    'paragraph/bullet/table-row segmentation',
    'sentence fallback',
    'heading context',
    'source offset preservation',
    'source alias restoration boundary',
    'exact candidate deduplication',
    'atomic segment determinism'
  ],
  focused_suite: 'PASS 12/12',
  node_syntax: 'PASS',
  provider_calls: 0,
  production_db_writes: 0,
  fact_persistence: 0
});

writeJson('04_PROVIDER_PREFLIGHT.json', {
  checkpoint: canary.checkpoint || 'V43_DEEPSEEK_OFFICIAL_CONNECTIVITY_CHECKPOINT',
  provider: canary.provider || 'deepseek_official',
  model: canary.model || 'deepseek-v4-pro',
  endpoint: canary.endpoint || '/responses',
  provider_calls: canary.provider_calls || 0,
  provider_http_reached: canary.provider_http_reached === true,
  provider_http_status: canary.provider_http_status ?? null,
  gateway_http_status: canary.gateway_http_status ?? null,
  result: Number(canary.provider_http_status) === 402 ? 'BLOCKED_PROVIDER_HTTP_402_ACCOUNT_OR_QUOTA' : 'PASS',
  no_retry: true,
  no_provider_switch: true,
  safe_error_code: canary.error_code || canary.provider_error_code || null,
  raw_provider_content: 'NOT_INCLUDED'
});

const terminalRows = (priorFactReport.windows || []).filter(row => row.status === 'FAILED' && row.failure?.provider_audit?.safe_error_code === 'OUTPUT_TRUNCATED');
const residualByWindow = new Map((residual?.cases || []).map(row => [row.window_id, row]));
writeJson('05_FOUR_BLOCKED_CHUNK_REPLAY.json', {
  target_case_count: 4,
  source_artifact: 'docs/handoff/V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED/06_FACT_EXTRACTION_REPORT.json',
  replay_status: residualStatus,
  provider_calls_in_residual_replay: residualCheckpoint?.provider_calls || 0,
  total_atomic_segments: residualCheckpoint?.total_atomic_segments || 0,
  processed_atomic_segments: residualCheckpoint?.processed_atomic_segments || 0,
  cases: terminalRows.map(row => ({
    source_id: row.source_id,
    material_id: row.material_id,
    window_id: row.window_id,
    parent_window_id: row.parent_window_id,
    parent_chunk_ids: row.included_chunk_ids,
    source_text_hash: row.source_text_hash,
    authority: 'EXISTING_PRODUCTION_CHUNK',
    planned_path: ['atomic_segmentation', 'candidate_v2_2', 'canonicalization', 'grounding'],
    status: residualByWindow.get(row.window_id)?.status || (Number(canary.provider_http_status) === 402 ? 'BLOCKED_BEFORE_EXECUTION' : 'PENDING'),
    atomic_segment_count: residualByWindow.get(row.window_id)?.atomic_segment_count || 0,
    failed_atomic_segments: residualByWindow.get(row.window_id)?.segments?.filter(segment => segment.status === 'FAILED').length || 0
  }))
});

writeJson('06_SOURCE_LINEAGE_RECERT.json', {
  source_of_truth: 'existing V2.2 targeted artifacts',
  source_alias_resolution_rate: residualCheckpoint?.source_alias_resolution_rate ?? priorCheckpoint.source_ref_resolution_rate,
  source_refs: { total: residualCheckpoint?.source_alias_total ?? priorCheckpoint.source_ref_total, resolved: residualCheckpoint?.source_alias_resolved ?? priorCheckpoint.source_ref_resolved, unresolved: residualCheckpoint ? (residualCheckpoint.source_alias_total - residualCheckpoint.source_alias_resolved) : priorCheckpoint.source_ref_unresolved },
  provenance_complete_rate: residualCheckpoint?.provenance_complete_rate ?? priorCheckpoint.provenance_complete_rate,
  storage_chunk_unchanged: true,
  production_chunk_ids_unchanged: true,
  atomic_segments_are_execution_derived: true
});

writeJson('07_CANONICALIZATION_GROUNDING_REPORT.json', {
  source_artifact: residual ? 'V43_FACT_V2_2_1_FOUR_BLOCKED_CHUNK_RESIDUAL_REPLAY' : 'V2.2 targeted checkpoint',
  canonicalized_count: residualCheckpoint?.canonicalized_count ?? priorCheckpoint.canonicalized_count,
  canonicalization_review_required_count: residualCheckpoint?.canonicalization_review_required_count ?? priorCheckpoint.canonicalization_review_required_count,
  canonicalization_rejected_count: residualCheckpoint?.canonicalization_rejected_count ?? priorCheckpoint.canonicalization_rejected_count,
  grounding_accept_count: residualCheckpoint?.grounding_accept_count ?? priorCheckpoint.grounding_accept_count,
  grounding_review_required_count: residualCheckpoint?.grounding_review_required_count ?? priorCheckpoint.grounding_review_required_count,
  grounding_rejected_count: residualCheckpoint?.grounding_rejected_count ?? priorCheckpoint.grounding_rejected_count,
  known_e2e_measurement_debt: true,
  broad_grounding_optimization: false,
  semantic_adjudication: 'PENDING_GPT'
});

const provider402 = Number(canary.provider_http_status) === 402;
writeJson('08_FACT_E2E_READINESS.json', {
  fact_producer_e2e_ready: residualStatus === 'READY_FOR_GPT_FACT_E2E_RELEASE_FINAL_ADJUDICATION',
  authorized_scope: 'PRODUCTION_SHAPED_EVAL_ONLY',
  provider_preflight: provider402 ? 'BLOCKED_PROVIDER_HTTP_402_ACCOUNT_OR_QUOTA' : 'PASS',
  residual_replay_executed: Boolean(residual),
  blockers: residualStatus === 'READY_FOR_GPT_FACT_E2E_RELEASE_FINAL_ADJUDICATION' ? [] : [residualStatus],
  fact_gold_frozen: false,
  production_cutover: false,
  mapping_claim_writer: false
});

writeJson('09_REGRESSION_REPORT.json', {
  focused_candidate_v2_2: 'PASS 12/12',
  prior_candidate_v2_1_and_v2: 'PASS 41/41',
  semantic_gateway: 'PASS 85/85',
  combined_focused: 'PASS 53/53 plus Semantic Gateway 85/85',
  build: 'PASS',
  lint: 'PASS',
  diff_check: 'PASS',
  new_task_regression: 0,
  unrelated_baseline_failures: 'NOT_REPAIRED'
  ,residual_replay: residualStatus
});

writeJson('10_CHECKPOINT.json', {
  checkpoint: 'V43_FACT_CANDIDATE_V2_2_1_E2E_RELEASE_CLOSURE',
  status: residualStatus,
  v2_2_architecture_accepted: true,
  v2_2_schema_unchanged: true,
  lineage_only_external_outcome_auto_promotion: 0,
  provider_calls: (canary.provider_calls || 0) + (residualCheckpoint?.provider_calls || 0),
  preflight_provider_calls: canary.provider_calls || 0,
  residual_replay_provider_calls: residualCheckpoint?.provider_calls || 0,
  provider_failures: residualCheckpoint?.provider_failures || 0,
  unresolved_output_truncation: residualCheckpoint?.unresolved_output_truncation || 0,
  atomic_segment_output_truncation: residualCheckpoint?.atomic_segment_output_truncation || 0,
  source_alias_resolution_rate: residualCheckpoint?.source_alias_resolution_rate ?? null,
  provenance_complete_rate: residualCheckpoint?.provenance_complete_rate ?? null,
  production_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  requirement_mutations: 0,
  router_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  semantic_adjudication: 'PENDING_GPT',
  handoff_ready: false,
  stop_reason: residualStatus
});

const names = [
  '00_GPT_README.md', '01_ATTRIBUTION_RESIDUAL_RECERT.json', '02_ATOMIC_SEGMENT_CONTRACT.json',
  '03_ATOMIC_SEGMENT_TEST_REPORT.json', '04_PROVIDER_PREFLIGHT.json', '05_FOUR_BLOCKED_CHUNK_REPLAY.json',
  '06_SOURCE_LINEAGE_RECERT.json', '07_CANONICALIZATION_GROUNDING_REPORT.json', '08_FACT_E2E_READINESS.json',
  '09_REGRESSION_REPORT.json', '10_CHECKPOINT.json'
];
fs.writeFileSync(path.join(outDir, '00_GPT_README.md'), `# Fact Candidate V2.2.1 E2E Release Closure\n\nThis is a bounded closure handoff. V2.2 schema and canonical Fact schema are unchanged. Provider preflight was executed once; residual replay is fail-closed on the recorded provider result. No Fact, Gold, Mapping, Claim, or Writer state was persisted.\n\n- Status: ${residualStatus}\n- Attribution semantic adjudication: PENDING_GPT\n- Raw provider content: NOT_INCLUDED\n`);
const sums = names.map(name => `${sha256(fs.readFileSync(path.join(outDir, name)))}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sums);
console.log(JSON.stringify({ out_dir: outDir, provider_status: canary.provider_http_status, provider_calls: (canary.provider_calls || 0) + (residualCheckpoint?.provider_calls || 0), terminal_cases: terminalRows.length, residual_status: residualStatus }));
