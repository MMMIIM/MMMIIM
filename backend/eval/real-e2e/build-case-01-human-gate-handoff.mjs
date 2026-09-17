import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import JSZip from 'jszip';

const root = resolve(process.cwd());
const handoffDir = join(root, 'docs', 'handoff', 'V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE');
const freshPath = join(handoffDir, '03_TB006_REQUIREMENT_RUN_V2.json');
const frozenPath = join(root, 'docs', 'eval', 'requirement-production-core6-20260911', 'TB-006.production-requirements.json');
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const baselineDir = join(root, 'docs', 'handoff', 'V43_OVERNIGHT_REAL_E2E_MASTER_V1');
const hash = value => createHash('sha256').update(value).digest('hex');
const hashFile = async path => hash(await readFile(path));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const array = value => Array.isArray(value) ? value : [];

function sourceRefs(candidate = {}) {
  return [...new Set([
    ...array(candidate.source_refs),
    ...array(candidate.sources_json).flatMap(source => array(source.source_refs))
  ])].sort();
}

function sourceHash(candidate = {}) {
  return candidate.source_hash || candidate.source_evidence?.source_hash
    || array(candidate.sources_json)[0]?.source_hash || null;
}

function normalize(candidate = {}) {
  return {
    id: candidate.requirement_id || candidate.req_id || candidate.id || null,
    text: candidate.requirement_text ?? candidate.content ?? '',
    category: candidate.requirement_category ?? candidate.category ?? null,
    source_hash: sourceHash(candidate),
    source_refs: sourceRefs(candidate),
    page_start: candidate.source_page_start ?? candidate.source_page ?? null,
    page_end: candidate.source_page_end ?? candidate.source_page ?? null,
    paragraph_start: candidate.source_paragraph_start ?? candidate.source_paragraph ?? null,
    paragraph_end: candidate.source_paragraph_end ?? candidate.source_paragraph ?? null,
    source_excerpt: candidate.source_excerpt ?? candidate.source_text ?? null,
    source_context: candidate.source_evidence?.context_text
      || array(candidate.sources_json)[0]?.source_context_text || null,
    source_verified: candidate.source_verified ?? candidate.source_resolution_status === 'verified',
    raw: candidate
  };
}

function keyStrict(item) {
  return JSON.stringify({
    text: item.text,
    category: item.category,
    source_hash: item.source_hash,
    source_refs: item.source_refs,
    page_start: item.page_start,
    page_end: item.page_end,
    paragraph_start: item.paragraph_start,
    paragraph_end: item.paragraph_end
  });
}

function keyContentCategoryHash(item) {
  return JSON.stringify([item.text, item.category, item.source_hash]);
}

function keyContentHash(item) {
  return JSON.stringify([item.text, item.source_hash]);
}

function keyHash(item) {
  return item.source_hash || `NO_SOURCE_HASH:${item.id}`;
}

function makeQueues(items, keyFn) {
  const queues = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(item);
  }
  return queues;
}

function takeMatch(queueMap, item, keyFn) {
  const queue = queueMap.get(keyFn(item));
  return queue && queue.length ? queue.shift() : null;
}

function safeCandidate(item) {
  return {
    id: item.id,
    text: item.text,
    category: item.category,
    source_hash: item.source_hash,
    source_refs: item.source_refs,
    source_page_start: item.page_start,
    source_page_end: item.page_end,
    source_paragraph_start: item.paragraph_start,
    source_paragraph_end: item.paragraph_end,
    source_excerpt: item.source_excerpt,
    source_context: item.source_context,
    source_verified: item.source_verified
  };
}

function pairRows(fresh, frozen) {
  const freshRemaining = [...fresh];
  const frozenRemaining = [...frozen];
  const pairs = [];
  const pairAt = (keyFn, classification) => {
    const frozenQueues = makeQueues(frozenRemaining, keyFn);
    for (let i = freshRemaining.length - 1; i >= 0; i -= 1) {
      const matched = takeMatch(frozenQueues, freshRemaining[i], keyFn);
      if (!matched) continue;
      const freshItem = freshRemaining.splice(i, 1)[0];
      const frozenIndex = frozenRemaining.indexOf(matched);
      if (frozenIndex >= 0) frozenRemaining.splice(frozenIndex, 1);
      pairs.push({ classification, fresh: freshItem, frozen: matched });
    }
  };
  pairAt(keyStrict, 'EXACT_AUTHORITY_REPLAY_ELIGIBLE');
  pairAt(keyContentCategoryHash, 'EXACT_AUTHORITY_REPLAY_ELIGIBLE');
  pairAt(keyContentHash, 'SEMANTIC_OR_SOURCE_DELTA');
  pairAt(keyHash, 'SEMANTIC_OR_SOURCE_DELTA');
  pairs.push(...freshRemaining.map(freshItem => ({ classification: 'NEW_CANDIDATE', fresh: freshItem, frozen: null })));
  pairs.push(...frozenRemaining.map(frozenItem => ({ classification: 'MISSING_FROM_FRESH_RUN', fresh: null, frozen: frozenItem })));
  return pairs;
}

async function build() {
  if (!existsSync(freshPath)) throw new Error(`missing fresh artifact: ${freshPath}`);
  const [freshReport, frozenPacket] = await Promise.all([readJson(freshPath), readJson(frozenPath)]);
  const fresh = array(freshReport.candidates).map(normalize);
  const frozen = array(frozenPacket.requirements).map(normalize);
  const pairs = pairRows(fresh, frozen);
  const strictFresh = new Set(fresh.map(keyStrict));
  const strictFrozen = new Set(frozen.map(keyStrict));
  const strictIntersection = [...strictFresh].filter(key => strictFrozen.has(key)).length;
  const contentCategoryFresh = new Set(fresh.map(keyContentCategoryHash));
  const contentCategoryFrozen = new Set(frozen.map(keyContentCategoryHash));
  const contentCategoryIntersection = [...contentCategoryFresh].filter(key => contentCategoryFrozen.has(key)).length;
  const contentHashQueuesFresh = makeQueues(fresh, keyContentHash);
  const contentHashQueuesFrozen = makeQueues(frozen, keyContentHash);
  const contentHashKeys = [...contentHashQueuesFresh.keys()].filter(key => contentHashQueuesFrozen.has(key));
  const contentHashMultisetMatches = contentHashKeys.reduce((total, key) => total + Math.min(contentHashQueuesFresh.get(key).length, contentHashQueuesFrozen.get(key).length), 0);
  const hashFresh = new Set(fresh.map(keyHash));
  const hashFrozen = new Set(frozen.map(keyHash));
  const hashIntersection = [...hashFresh].filter(key => hashFrozen.has(key)).length;
  const rejectionRecords = array(freshReport.scope_rejections);
  const overlap = rejectionRecords.filter(item => array(item.resolved_source_span?.source_refs).some(ref => array(freshReport.scope_overlap_refs).includes(ref)));
  const counts = Object.fromEntries(['EXACT_AUTHORITY_REPLAY_ELIGIBLE', 'SEMANTIC_OR_SOURCE_DELTA', 'NEW_CANDIDATE', 'MISSING_FROM_FRESH_RUN'].map(label => [label, pairs.filter(pair => pair.classification === label).length]));
  const changedPairs = pairs.filter(pair => pair.classification !== 'EXACT_AUTHORITY_REPLAY_ELIGIBLE');

  const comparison = {
    artifact_type: 'V43_REAL_E2E_CASE_01_REQUIREMENT_MECHANICAL_COMPARISON',
    run_id: freshReport.run_id,
    fresh_artifact: 'docs/handoff/V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE/03_TB006_REQUIREMENT_RUN_V2.json',
    frozen_auxiliary_reference: 'docs/eval/requirement-production-core6-20260911/TB-006.production-requirements.json',
    fresh_candidate_count: fresh.length,
    frozen_candidate_count: frozen.length,
    strict_identity: { fresh_unique: strictFresh.size, frozen_unique: strictFrozen.size, exact_intersection: strictIntersection },
    content_category_source_hash_identity: { fresh_unique: contentCategoryFresh.size, frozen_unique: contentCategoryFrozen.size, exact_intersection: contentCategoryIntersection },
    content_source_hash_identity: { exact_multiset_matches: contentHashMultisetMatches },
    source_hash_identity: { fresh_unique: hashFresh.size, frozen_unique: hashFrozen.size, unique_intersection: hashIntersection, multiset_overlap: pairs.filter(pair => pair.classification !== 'NEW_CANDIDATE' && pair.classification !== 'MISSING_FROM_FRESH_RUN').length },
    mechanically_new_fresh_rows: counts.NEW_CANDIDATE,
    mechanically_missing_frozen_rows: counts.MISSING_FROM_FRESH_RUN,
    semantic_metrics: 'NOT_COMPUTED_NO_LLM',
    semantic_labels: 0,
    mechanical_note: 'This comparison does not assign or infer MATCH/PARTIAL/DISTORTED/MISS.'
  };

  const scopeControlDiff = {
    artifact_type: 'V43_SCOPE_CONTROL_FLOW_DIFF',
    owner: 'backend/src/requirement-parse-service.js',
    pre_fix_behavior: 'Any REQUIREMENT_SCOPE_EXCLUDED raised from candidate processing aborted the parse job and was not candidate-scoped.',
    post_fix_behavior: 'Each candidate is resolved then validated; REQUIREMENT_SCOPE_EXCLUDED is rejected and audited while the chunk completes. Other resolver/scope errors remain fatal.',
    allowed_scope: 'Candidate-level source scope filtering only; no semantic, prompt, schema, Gold, Requirement, or Provider contract change.',
    audit_fields: ['chunk_id', 'chunk_number', 'candidate_index', 'candidate_identity', 'resolved_source_span', 'source_role', 'scope_decision', 'rejection_reason', 'source_hash'],
    counters: ['raw_candidate_count', 'scope_accepted_count', 'scope_rejected_count', 'success_empty_count', 'success_empty_after_scope_filter_count'],
    changed_files: ['backend/src/requirement-parse-service.js', 'backend/test/requirement-resilience.test.js'],
    regression_proof: { focused_requirement_resilience: '19/19 PASS', relevant_requirement_suites: '128/128 PASS', provider_calls_during_tests: 0, production_db_writes: 0, gold_mutations: 0 }
  };

  const regressionReport = {
    artifact_type: 'V43_CASE_01_REGRESSION_REPORT',
    new_task_regressions: 0,
    focused_tests: { command: 'npm test -- test/requirement-resilience.test.js test/requirement-chunker-v2.test.js test/requirement-extraction-contract-owner.test.js test/requirement-extraction-live-harness.test.js test/requirement-evaluation-integrity.test.js test/requirement-quality-gate.test.js test/requirement-production-quality-gate.test.js test/requirement-production-readiness-recovery.test.js test/requirement-source-provenance.test.js test/tender-parse.test.js', passed: 128, failed: 0, status: 'PASS' },
    isolated_postgresql: { status: 'PASS', passed: 27, failed: 0, database: 'bid_platform_flow_audit_test', writes_scoped_to_isolated_eval_db: true },
    build: 'PASS (existing overnight verification)',
    lint: 'PASS (existing overnight verification)',
    diff_check: 'PASS_WITH_LINE_ENDING_WARNINGS_ONLY (existing overnight verification)',
    known_unrelated_baselines: [
      { test: 'frozen 199 Gold requirements retain an eligible or unknown source span after routing', family: 'PATH_FIXTURE_AVAILABILITY', signature: 'ENOENT backend/backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json', classification: 'PRE_EXISTING_UNRELATED_BASELINE' },
      { test: 'requirement source parity', family: 'FIXTURE_COVERAGE', signature: 'existing 5/6 or 5/7 source parity baseline', classification: 'PRE_EXISTING_UNRELATED_BASELINE' }
    ],
    provider_calls_for_regression: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };

  const authorityReplay = {
    artifact_type: 'V43_CASE_01_AUTHORITY_REPLAY_ANALYSIS',
    authority_note: 'Frozen packet is read-only auxiliary reference; fresh production-shaped output is not promoted or labeled semantically.',
    classifications: counts,
    rows: pairs.map(pair => ({ classification: pair.classification, fresh: pair.fresh ? safeCandidate(pair.fresh) : null, frozen: pair.frozen ? safeCandidate(pair.frozen) : null }))
  };

  const humanPacket = {
    artifact_type: 'V43_CASE_01_HUMAN_REQUIREMENT_REVIEW_PACKET',
    blind: true,
    authority: 'HUMAN_REVIEW_REQUIRED',
    semantic_labels: 0,
    instructions: 'Review only mechanical fresh-vs-frozen source/candidate deltas. Do not infer or promote semantic labels automatically.',
    changed_case_count: changedPairs.length,
    rows: changedPairs.map(pair => ({
      classification: pair.classification,
      fresh_candidate: pair.fresh ? safeCandidate(pair.fresh) : null,
      frozen_reference: pair.frozen ? safeCandidate(pair.frozen) : null,
      difference_reason: pair.classification === 'NEW_CANDIDATE' ? 'No mechanically paired frozen row' : pair.classification === 'MISSING_FROM_FRESH_RUN' ? 'No mechanically paired fresh row' : 'Source hash/content/category or current chunk lineage differs; semantic meaning not adjudicated'
    }))
  };

  const indexingReport = { artifact_type: 'V43_CASE_01_ENTERPRISE_INDEXING_REPORT', status: 'NOT_RUN_BLOCKED_BY_SCOPE_FILTER_FALSE_EXCLUSION', blocker: '13 scope rejections overlap frozen Human-authoritative TB-006 source refs', provider_calls: 0, eval_db_writes: 0 };
  const retrievalReport = { artifact_type: 'V43_CASE_01_RETRIEVAL_SMOKE_REPORT', status: 'NOT_RUN_BLOCKED_BY_SCOPE_FILTER_FALSE_EXCLUSION', blocker: 'Enterprise indexing is not authorized after source-scope false-exclusion hard stop', provider_calls: 0, eval_db_writes: 0 };
  const readiness = {
    artifact_type: 'V43_CASE_01_READINESS',
    requirement_run: 'PASS_33_OF_33_CHUNKS_TERMINAL_NON_FATAL',
    production_input_scope_gate: 'FAIL_SCOPE_FILTER_FALSE_EXCLUSION',
    scope_rejection_overlap_count: overlap.length,
    enterprise_indexing: 'NOT_RUN',
    retrieval_smoke: 'NOT_RUN',
    readiness: { human_requirement_review: 'NO_PENDING_FALSE_EXCLUSION', enterprise_indexing: 'NO', retrieval_smoke: 'NO', final: 'BLOCKED_SCOPE_FILTER_FALSE_EXCLUSION' },
    semantic_adjudication: 'PENDING_HUMAN'
  };
  const checkpoint = {
    checkpoint: 'V43_REAL_E2E_CASE_01_REQUIREMENT_SCOPE_CLOSURE_AND_HUMAN_GATE',
    run_id: freshReport.run_id,
    tender_id: 'TB-006',
    source_sha256: freshReport.source_sha256,
    chunk_count: freshReport.chunk_count,
    completed_chunks: freshReport.completed_chunks,
    candidates: freshReport.candidate_count,
    raw_candidates: freshReport.scope_raw_candidate_count,
    scope_accepted: freshReport.scope_accepted_count,
    scope_rejected: freshReport.scope_rejected_count,
    scope_rejection_overlap_with_frozen_authority: overlap.length,
    false_exclusion_hard_stop: true,
    provider_calls: freshReport.provider_calls,
    llm_calls: freshReport.provider_calls,
    production_db_writes: 0,
    eval_db_writes: 'fresh requirement run only; isolated eval DB',
    gold_mutations: 0,
    enterprise_indexing_calls: 0,
    retrieval_calls: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    semantic_root_cause: 'PENDING_GPT',
    final_status: 'BLOCKED_SCOPE_FILTER_FALSE_EXCLUSION'
  };

  const files = [
    ['00_GPT_README.md', `# V43 Real E2E Case 01\n\nStatus: BLOCKED_SCOPE_FILTER_FALSE_EXCLUSION.\n\nA fresh production-shaped TB-006 run completed 33/33 chunks with 341 candidates. The candidate-level scope control-flow fix is covered by focused tests, but 13 rejected candidates mechanically overlap frozen Human-authoritative source refs. Per the decision, enterprise indexing and retrieval were not run. No semantic labels are assigned here; semantic root cause remains PENDING_GPT.\n`],
    ['01_SCOPE_CONTROL_FLOW_DIFF.json', scopeControlDiff],
    ['02_SCOPE_REGRESSION_REPORT.json', regressionReport],
    ['03_TB006_REQUIREMENT_RUN_V2.json', freshReport],
    ['04_REQUIREMENT_GOLD_COMPARISON.json', comparison],
    ['05_SCOPE_REJECTION_AUDIT.json', { artifact_type: 'V43_SCOPE_REJECTION_AUDIT', run_id: freshReport.run_id, total: rejectionRecords.length, overlap_count: overlap.length, overlap_refs: array(freshReport.scope_overlap_refs), rejections: rejectionRecords }],
    ['06_AUTHORITY_REPLAY_ANALYSIS.json', authorityReplay],
    ['07_HUMAN_REQUIREMENT_REVIEW_PACKET.json', humanPacket],
    ['08_ENTERPRISE_INDEXING_REPORT.json', indexingReport],
    ['09_RETRIEVAL_SMOKE_REPORT.json', retrievalReport],
    ['10_REGRESSION_REPORT.json', regressionReport],
    ['11_E2E_READINESS.json', readiness],
    ['12_CHECKPOINT.json', checkpoint]
  ];
  await mkdir(handoffDir, { recursive: true });
  for (const [name, value] of files) {
    const path = join(handoffDir, name);
    if (typeof value === 'string') await writeFile(path, value, 'utf8');
    else await writeJson(path, value);
  }
  const shaLines = [];
  for (const [name] of files) shaLines.push(`${await hashFile(join(handoffDir, name))}  ${name}`);
  await writeFile(join(handoffDir, 'SHA256SUMS.txt'), `${shaLines.join('\n')}\n`, 'utf8');
  const zip = new JSZip();
  for (const [name] of files) zip.file(name, await readFile(join(handoffDir, name)));
  zip.file('SHA256SUMS.txt', await readFile(join(handoffDir, 'SHA256SUMS.txt')));
  const zipPath = join(handoffDir, 'V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE.zip');
  await writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  const manifest = {
    artifact_type: 'V43_REAL_E2E_CASE_01_HANDOFF_MANIFEST',
    run_id: freshReport.run_id,
    final_status: 'BLOCKED_SCOPE_FILTER_FALSE_EXCLUSION',
    files: Object.fromEntries(files.map(([name]) => [name, { path: `docs/handoff/V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE/${name}`, sha256: null }])),
    zip: { path: `docs/handoff/V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE/${relative(handoffDir, zipPath).replaceAll('\\', '/')}`, sha256: await hashFile(zipPath) },
    mechanical_summary: { chunk_count: freshReport.chunk_count, completed_chunks: freshReport.completed_chunks, candidate_count: freshReport.candidate_count, scope_rejected: rejectionRecords.length, overlap_with_frozen_authority: overlap.length, classification_counts: counts },
    side_effects: { provider_calls_total_for_fresh_run: freshReport.provider_calls, provider_calls_added_by_handoff: 0, production_db_writes: 0, gold_mutations: 0, enterprise_indexing_calls: 0, retrieval_calls: 0, semantic_labels_created: 0 }
  };
  for (const [name] of files) manifest.files[name].sha256 = await hashFile(join(handoffDir, name));
  await writeJson(join(handoffDir, '13_HANDOFF_MANIFEST.json'), manifest);
  const allForZip = new JSZip();
  // Keep the portable ZIP free of the external manifest's self-referential
  // archive hash; the standalone manifest remains beside the ZIP.
  for (const name of [...files.map(([name]) => name), 'SHA256SUMS.txt']) allForZip.file(name, await readFile(join(handoffDir, name)));
  await writeFile(zipPath, await allForZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  manifest.zip.sha256 = await hashFile(zipPath);
  await writeJson(join(handoffDir, '13_HANDOFF_MANIFEST.json'), manifest);
  console.log(JSON.stringify({ final_status: manifest.final_status, handoff_dir: handoffDir, zip_path: zipPath, zip_sha256: manifest.zip.sha256, scope_rejections: rejectionRecords.length, overlap_with_frozen_authority: overlap.length, classification_counts: counts }, null, 2));
}

await build();
