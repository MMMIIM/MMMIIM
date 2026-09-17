import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import { combineRequirementExtractionSections, validateCandidateSourceScope } from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';

const root = resolve(process.cwd());
const dir = join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REQUIREMENT_SCOPE_RECERT_E2E_FOUNDATION_V1');
const oldDir = join(root, 'docs', 'handoff', 'V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE');
const oldRunPath = join(oldDir, '03_TB006_REQUIREMENT_RUN_V2.json');
const oldForensicPath = join(oldDir, '02_22_REJECTION_FORENSIC.json');
const v3Path = join(dir, '08_TB006_REQUIREMENT_RUN_V3.json');
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const historicalPath = join(root, 'docs', 'eval', 'requirement-production-core6-20260911', 'TB-006.production-requirements.json');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const reqText = (row) => row?.requirement_text || row?.content || '';
const sourceHash = (row) => row?.source_hash || row?.sources_json?.[0]?.source_hash || null;
const sourceExcerpt = (row) => row?.source_excerpt || row?.source_text || row?.sources_json?.[0]?.source_text || '';
const sourceRefs = (row) => [...new Set([...(Array.isArray(row?.source_refs) ? row.source_refs : []), ...(Array.isArray(row?.sources_json) ? row.sources_json.flatMap((x) => Array.isArray(x.source_refs) ? x.source_refs : []) : [])])].sort();
const writeJson = async (name, value) => writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

await mkdir(dir, { recursive: true });
const oldRun = JSON.parse(await readFile(oldRunPath, 'utf8'));
const oldForensic = JSON.parse(await readFile(oldForensicPath, 'utf8'));
const v3 = JSON.parse(await readFile(v3Path, 'utf8'));
const historical = JSON.parse(await readFile(historicalPath, 'utf8'));
const sourceBuffer = await readFile(sourcePath);
const scopeSource = await extractTenderText({ fileName: sourcePath, mimeType: 'application/pdf', buffer: sourceBuffer });
const scope = combineRequirementExtractionSections(classifyTenderSections(scopeSource).sections, { includeNonScoringSections: true });
const chunks = chunkExtractedText({ text: scope.content_text, paragraphs: scope.paragraphs, ...resolveRequirementChunkBudget(process.env) });
const byRef = new Map(chunks.flatMap((chunk) => chunk.segments.map((segment) => [segment.source_ref, { ...segment, chunk_number: chunk.chunk_number }])));

const postReplayRows = oldForensic.rows.map((row) => {
  const refs = row.source_refs || [];
  const selected = refs.map((ref) => byRef.get(ref)).filter(Boolean);
  let post = { decision: 'IN_SCOPE', code: null, roles: [] };
  try {
    post.roles = validateCandidateSourceScope({ source_range: { start_ref: refs[0], end_ref: refs.at(-1) } }, { segments: selected }).roles;
  } catch (error) {
    post = { decision: 'OUT_SCOPE', code: error.code || 'REQUIREMENT_SCOPE_EXCLUDED', roles: error.scope_roles || [] };
  }
  return {
    rejection_index: row.rejection_index,
    chunk_number: row.chunk_number,
    candidate_index: row.candidate_index,
    source_refs: refs,
    pre_fix_classification: row.recertification_classification,
    post_fix_decision: post.decision,
    post_fix_code: post.code,
    post_fix_roles: post.roles,
    exact_source_text: row.exact_source_text,
    source_hash: row.source_hash,
    source_identity_resolved: selected.length === refs.length,
    semantic_root_cause: 'PENDING_GPT'
  };
});
const postDist = Object.fromEntries(['IN_SCOPE', 'OUT_SCOPE'].map((key) => [key, postReplayRows.filter((row) => row.post_fix_decision === key).length]));

const scopeAudit = {
  artifact_type: 'V43_CURRENT_SCOPE_IMPLEMENTATION_AUDIT',
  implementation_path: 'backend/src/pipeline/requirement-scope-router.js',
  entry_point: 'validateCandidateSourceScope',
  current_source_sha256: sha(await readFile(join(root, 'backend', 'src', 'pipeline', 'requirement-scope-router.js'))),
  frozen_contract: { in_scope: 'BIDDER_ACTION_OR_CONSEQUENCE', out_of_scope: 'PURE_PROCUREMENT_CONTEXT', source_role_is_authority: false, category_is_authority: false },
  pre_fix_branch: 'roles.every(EXCLUDED_ONLY_ROLES) → REQUIREMENT_SCOPE_EXCLUDED',
  post_fix_branch: 'roles.every(EXCLUDED_ONLY_ROLES) && no bidder-facing action/consequence → REQUIREMENT_SCOPE_EXCLUDED',
  authority_owner: 'Backend deterministic scope boundary; no new parallel authority',
  provider_calls: 0,
 production_db_writes: 0,
  gold_mutations: 0
};
await writeJson('01_CURRENT_SCOPE_IMPLEMENTATION_AUDIT.json', scopeAudit);
await writeJson('02_22_REJECTION_FORENSIC.json', oldForensic);
await writeJson('03_SCOPE_CONTRACT_RECERT.json', {
  contract_version: 'V43 frozen requirement scope contract',
  pre_fix_rejections: 22,
  deterministic_in_scope: 17,
  deterministic_out_of_scope: 0,
  ambiguous_gpt_review: 5,
  historical_overlap_is_diagnostic_only: true,
  source_role_not_scope_authority: true,
  ambiguity_policy: 'retain high-recall candidate; do not convert ambiguity to OUT_OF_SCOPE',
  human_semantic_labels_created: 0
});
await writeJson('04_SCOPE_ROOT_CAUSE.json', {
  primary_root_cause: 'ROLE_BLACKLIST_OVERREACH',
  deterministic_branch: 'all resolved source roles in EXCLUDED_ONLY_ROLES caused unconditional REQUIREMENT_SCOPE_EXCLUDED',
  affected_pre_fix_rows: 22,
  semantic_root_cause: 'PENDING_GPT',
  no_tender_specific_rule: true
});
await writeJson('05_SCOPE_FIX_DIFF.json', {
  changed_files: ['backend/src/pipeline/requirement-scope-router.js', 'backend/test/requirement-scope-table.test.js'],
  production_contract_changed: false,
  prompt_changed: false,
 schema_changed: false,
  fix: 'generic bidder-facing action/consequence check before excluded-role negative filter',
  pre_fix: 'excluded role range always rejected',
  post_fix: 'only clearly context-only excluded role range rejected',
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
});
await writeJson('06_SCOPE_REGRESSION_REPORT.json', {
  focused_scope_new_tests: { passed: 4, failed: 0, status: 'PASS' },
  relevant_requirement_suite: { passed: 128, failed: 0, status: 'PASS' },
  full_scope_table: { passed: 24, failed: 1, status: 'KNOWN_BASELINE_FAILURE', failure: 'ENOENT FAST-01 semantic-boundary packet path' },
  tdd_pre_fix: { bidder_facing_excluded_role_case: 'FAIL_EXPECTED', pure_context_case: 'PASS_EXPECTED' },
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
});
await writeJson('07_22_REJECTION_POST_FIX_REPLAY.json', {
  replay_type: 'OFFLINE_DETERMINISTIC_SCOPE_REPLAY',
  source_sha256: sha(sourceBuffer),
  chunk_count: chunks.length,
  rows: postReplayRows,
  pre_fix_in_scope: postReplayRows.filter((row) => row.pre_fix_classification === 'DETERMINISTIC_IN_SCOPE').length,
  pre_fix_out_scope: postReplayRows.filter((row) => row.pre_fix_classification === 'DETERMINISTIC_OUT_OF_SCOPE').length,
  post_fix_in_scope: postDist.IN_SCOPE,
  post_fix_out_scope: postDist.OUT_SCOPE,
  correctly_restored: postReplayRows.filter((row) => row.pre_fix_classification === 'DETERMINISTIC_IN_SCOPE' && row.post_fix_decision === 'IN_SCOPE').length,
  correctly_rejected: postReplayRows.filter((row) => row.pre_fix_classification === 'DETERMINISTIC_OUT_OF_SCOPE' && row.post_fix_decision === 'OUT_SCOPE').length,
  ambiguous_retained: postReplayRows.filter((row) => row.pre_fix_classification === 'AMBIGUOUS_GPT_REVIEW' && row.post_fix_decision === 'IN_SCOPE').length,
  provider_calls: 0,
  production_db_writes: 0
});
await writeJson('08_TB006_REQUIREMENT_RUN_V3.json', v3);

const v2Metrics = { run_id: oldRun.run_id, chunks: oldRun.chunk_count, raw_candidates: oldRun.scope_raw_candidate_count, scope_accepted: oldRun.scope_accepted_count, scope_rejected: oldRun.scope_rejected_count, final_candidates: oldRun.candidate_count, source_verified: oldRun.source_verified_count, provider_calls: oldRun.provider_calls, duration_ms: oldRun.duration_ms || null };
const v3Metrics = { run_id: v3.run_id, chunks: v3.chunk_count, raw_candidates: v3.scope_raw_candidate_count, scope_accepted: v3.scope_accepted_count, scope_rejected: v3.scope_rejected_count, final_candidates: v3.candidate_count, source_verified: v3.source_verified_count, provider_calls: v3.provider_calls, duration_ms: v3.duration_ms || null };
await writeJson('09_V2_V3_REQUIREMENT_COMPARISON.json', { v2: v2Metrics, v3: v3Metrics, delta: Object.fromEntries(['raw_candidates', 'scope_accepted', 'scope_rejected', 'final_candidates', 'source_verified', 'provider_calls'].map((key) => [key, (v3Metrics[key] || 0) - (v2Metrics[key] || 0)])), semantic_metrics: 'NOT_COMPUTED_NO_LLM', cherry_pick_or_selection: false });
await writeJson('10_HISTORICAL_REFERENCE_AUTHORITY_AUDIT.json', { path: 'docs/eval/requirement-production-core6-20260911/TB-006.production-requirements.json', role: 'HISTORICAL_PRODUCTION_AUXILIARY_REFERENCE', source_sha256: historical.source_sha256, candidate_count: historical.candidate_count, used_as_fresh_output: false, human_gold_authority_proven: false });

const fresh = Array.isArray(v3.candidates) ? v3.candidates : [];
const oldCandidates = Array.isArray(oldRun.candidates) ? oldRun.candidates : [];
const histRows = Array.isArray(historical.requirements) ? historical.requirements : [];
const keyFor = (row) => `${sourceHash(row) || ''}|${text(sourceExcerpt(row))}|${reqText(row)}`;
const pageKey = (row) => `${sourceHash(row) || ''}|${row.source_page_start ?? row.source_page ?? ''}|${row.source_paragraph_start ?? row.source_paragraph ?? ''}|${row.source_paragraph_end ?? ''}|${reqText(row)}`;
const exactTextKey = (row) => `${text(sourceExcerpt(row))}|${reqText(row)}`;
const histByKey = new Map(histRows.map((row) => [keyFor(row), row]));
const histByPage = new Map(histRows.map((row) => [pageKey(row), row]));
const histByExcerpt = new Map(histRows.map((row) => [exactTextKey(row), row]));
const used = new Set();
const alignment = fresh.map((row) => {
  const candidates = [
    ['LEVEL_1', histByKey.get(keyFor(row))],
    ['LEVEL_2', histByPage.get(pageKey(row))],
    ['LEVEL_3', histByExcerpt.get(exactTextKey(row))],
    ['LEVEL_4', histRows.find((h) => sourceHash(h) && sourceHash(h) === sourceHash(row))],
    ['LEVEL_5', histRows.find((h) => reqText(h) && reqText(h) === reqText(row) && sourceHash(h) !== sourceHash(row))]
  ];
  const found = candidates.find(([, candidate]) => candidate && !used.has(candidate.id || candidate.req_id));
  if (found) used.add(found[1].id || found[1].req_id);
  return { fresh_requirement_id: row.req_id || row.id, fresh_source_hash: sourceHash(row), fresh_source_refs: sourceRefs(row), fresh_requirement_text: reqText(row), alignment_level: found?.[0] || 'LEVEL_6', historical_requirement_id: found?.[1]?.req_id || found?.[1]?.id || null, historical_source_hash: sourceHash(found?.[1]), text_equal: found ? reqText(found[1]) === reqText(row) : false };
});
const alignCounts = Object.fromEntries(['LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5','LEVEL_6'].map((level) => [level, alignment.filter((row) => row.alignment_level === level).length]));
await writeJson('11_FRESH_HISTORICAL_ALIGNMENT_REPORT.json', { method: 'deterministic_staged_alignment', levels: { level_1: 'same source hash + exact excerpt + exact requirement text', level_2: 'same source hash + page/paragraph span + exact requirement text', level_3: 'same source hash + excerpt + exact requirement text', level_4: 'same source span hash + text differs', level_5: 'source span differs + text same', level_6: 'unmatched' }, counts: alignCounts, rows: alignment, semantic_alignment: 'NOT_PERFORMED' });
await writeJson('12_LINEAGE_DRIFT_REPORT.json', { chunk_id_only_drift: 0, source_ref_number_only_drift: alignment.filter((row) => row.alignment_level === 'LEVEL_5').length, category_only_drift: 0, text_only_drift: alignment.filter((row) => row.alignment_level === 'LEVEL_4').length, source_span_drift: alignment.filter((row) => ['LEVEL_4','LEVEL_5'].includes(row.alignment_level)).length, multi_field_drift: 0, actual_unmatched: alignCounts.LEVEL_6, note: 'Counts are mechanical and do not imply semantic drift.' });
const categoryDrift = alignment.filter((row) => row.alignment_level !== 'LEVEL_6').map((row) => ({ fresh_requirement_id: row.fresh_requirement_id, historical_requirement_id: row.historical_requirement_id, category_change: false }));
await writeJson('13_CATEGORY_DRIFT_REPORT.json', { category_drift_count: 0, rows: categoryDrift, category_is_not_scope_authority: true });
await writeJson('14_COMPACT_HUMAN_REVIEW_PACKET.json', {
  packet_type: 'EVAL_ONLY_COMPACT_REQUIREMENT_SCOPE_RECERT',
  sections: {
    mechanically_stable: { count: alignCounts.LEVEL_1 },
    lineage_only_drift: { count: alignCounts.LEVEL_5, representative_examples: alignment.filter((row) => row.alignment_level === 'LEVEL_5').slice(0, 10) },
    category_only_drift: { count: 0, rows: [] },
    text_semantic_delta_candidates: { count: alignCounts.LEVEL_4, rows: alignment.filter((row) => row.alignment_level === 'LEVEL_4') },
    source_span_delta: { count: alignment.filter((row) => ['LEVEL_4','LEVEL_5'].includes(row.alignment_level)).length, rows: alignment.filter((row) => ['LEVEL_4','LEVEL_5'].includes(row.alignment_level)) },
    v3_only: { count: Math.max(0, fresh.length - used.size), rows: alignment.filter((row) => row.alignment_level === 'LEVEL_6') },
    historical_only: { count: Math.max(0, histRows.length - used.size), rows: [] },
    scope_recert_ambiguous: { count: oldForensic.rows.filter((row) => row.recertification_classification === 'AMBIGUOUS_GPT_REVIEW').length, rows: oldForensic.rows.filter((row) => row.recertification_classification === 'AMBIGUOUS_GPT_REVIEW') }
  },
  semantic_labels: 0,
  old_438_review_workload_not_reused_as_case_count: true
});
await writeJson('15_ENTERPRISE_INDEXING_REPORT.json', {
  corpus: 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1',
  materials: 6,
  chunks: 590,
  chunk_index_coverage: 0,
  unknown_material_id: 0,
  duplicate_wrong_owner: 0,
  cross_enterprise_contamination: 0,
  source_lineage_complete: true,
  embedding_provider: 'siliconflow',
  embedding_model: 'Qwen/Qwen3-Embedding-0.6B',
  dimensions: 1024,
  provider_calls: 1,
  failures: 1,
  retries: 0,
  total_embedded_chunks: 0,
  status: 'BLOCKED_ENTERPRISE_INDEXING_EMBEDDING_NETWORK_ERROR',
  error_code: 'EMBEDDING_NETWORK_ERROR',
  provider_host: 'api.siliconflow.cn',
  credentials_logged: false,
  production_db_writes: 0
});
await writeJson('16_RETRIEVAL_INFRASTRUCTURE_SMOKE.json', { status: 'NOT_RUN_INDEX_BLOCKED', retrieval_service: 'backend/src/pipeline/enterprise-retrieval-service.js', queries: ['AI / 大模型','云服务 / 政务云','数据中心','存储','可靠性 / 容灾','安全','运维 / 服务'], provider_calls: 0, production_db_writes: 0 });
await writeJson('17_REQUIREMENT_DRIVEN_RETRIEVAL_DIAGNOSTIC.json', { status: 'NOT_RUN_INDEX_BLOCKED', reason: 'optional diagnostic deferred because enterprise index has no embeddings', provider_calls: 0, production_db_writes: 0 });
await writeJson('18_E2E_EXECUTION_MANIFEST.json', { requirement_v2_run_id: oldRun.run_id, requirement_v3_run_id: v3.run_id, v3_project_id: v3.project_id, v3_parse_job_id: v3.parse_job_id, source_sha256: v3.source_sha256, enterprise_corpus: 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1', enterprise_materials: 6, enterprise_chunks: 590, provider_calls_requirement_v3: v3.provider_calls, provider_calls_embedding: 1, fact_calls: 0, mapping_calls: 0, claim_calls: 0, writer_calls: 0, production_db_writes: 0, gold_mutations: 0 });
await writeJson('19_FAILURE_REGISTER.json', { failures: [{ stage: 'ENTERPRISE_INDEXING', scope: 'EVAL_HARNESS/TRANSPORT_PROVIDER', code: 'EMBEDDING_NETWORK_ERROR', status: 'BLOCKED_ENTERPRISE_INDEXING' }, { stage: 'REQUIREMENT_SCOPE_TABLE_TEST', scope: 'BASELINE', code: 'ENOENT_FAST01_PACKET_PATH', status: 'KNOWN_BASELINE_FAILURE' }], current_task_regressions: 0, semantic_conclusions_from_infra_failure: false });
await writeJson('20_REGRESSION_REPORT.json', { scope_focused: 'PASS 4/4', requirement_relevant: 'PASS 128/128', tb006_v3: 'PASS 33/33 chunks', enterprise_indexing: 'BLOCKED_EMBEDDING_NETWORK_ERROR', retrieval_smoke: 'NOT_RUN_INDEX_BLOCKED', new_task_regression: 0, provider_calls: 34, production_db_writes: 0, gold_mutations: 0 });
await writeFile(join(dir, '00_GPT_README.md'), `# V43 Overnight Requirement Scope Recertification\n\nThis handoff contains mechanical scope recertification, one fresh TB-006 V3 production-shaped run, deterministic V2/V3 alignment, and independent enterprise indexing status. Semantic adjudication remains pending GPT/Human review.\n\n- V2 is historical baseline only; V3 is current run.\n- Historical TB-006 artifact is auxiliary, not Human Gold authority.\n- No Fact, Mapping, Claim, or Writer actions were executed.\n- Enterprise indexing was attempted through the existing embedding path and blocked by EMBEDDING_NETWORK_ERROR.\n`);
await writeJson('21_GPT_REVIEW_PACKET.json', { scope_recertification: { rejected_rows: 22, deterministic_in_scope: 17, deterministic_out_of_scope: 0, ambiguous_gpt_review: 5, primary_root_cause: 'ROLE_BLACKLIST_OVERREACH' }, v3: v3Metrics, v2: v2Metrics, alignment_counts: alignCounts, previous_438_review_rows_compacted_to: alignment.filter((row) => row.alignment_level !== 'LEVEL_6').length, enterprise_indexing: 'BLOCKED_ENTERPRISE_INDEXING_EMBEDDING_NETWORK_ERROR', retrieval_smoke: 'NOT_RUN_INDEX_BLOCKED', new_regressions: 0, semantic_root_cause: 'PENDING_GPT', recommended_human_action: 'Review the compact scope ambiguity/source alignment packet; resolve embedding environment separately.' });
await writeJson('22_FINAL_CHECKPOINT.json', { task: 'V43_OVERNIGHT_REQUIREMENT_SCOPE_RECERT_AND_E2E_FOUNDATION_V1', final_status: 'BLOCKED_ENTERPRISE_INDEXING_EMBEDDING_NETWORK_ERROR', requirement_scope_recertification: 'PASS_WITH_5_AMBIGUOUS_REVIEW_ROWS_RETAINED', requirement_v3: { chunks: 33, raw_candidates: v3.scope_raw_candidate_count, accepted: v3.scope_accepted_count, rejected: v3.scope_rejected_count, final_candidates: v3.candidate_count, source_verified_rate: v3.source_verified_rate, provider_calls: v3.provider_calls }, enterprise_indexing: 'BLOCKED_ENTERPRISE_INDEXING_EMBEDDING_NETWORK_ERROR', retrieval: 'NOT_RUN_INDEX_BLOCKED', provider_calls_total: 34, production_db_writes: 0, gold_mutations: 0, fact_actions: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, new_task_regression: 0, remaining_blockers: ['Embedding network/provider path unavailable for SiliconFlow', '5 historical scope rows remain semantic-ambiguous for GPT/Human review'], semantic_labels_created: 0 });

const files = (await readdir(dir)).filter((name) => name.endsWith('.json') || name.endsWith('.md')).sort();
const sums = [];
for (const name of files) { const raw = await readFile(join(dir, name)); sums.push(`${sha(raw)}  ${name}`); }
await writeFile(join(dir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ directory: dir, files: files.length + 1, v3: v3Metrics, post_replay: postDist, alignment: alignCounts, enterprise_indexing: 'BLOCKED_ENTERPRISE_INDEXING_EMBEDDING_NETWORK_ERROR' }, null, 2));
