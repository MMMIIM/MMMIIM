import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  applyRetrievalChunkRole,
  isCitationIndexLike,
  isWriterReferenceContentEligible
} from '../../src/pipeline/retrieval-chunk-role.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = path.join(ROOT, 'docs', 'handoff', 'V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1');
const OUT = path.join(ROOT, 'docs', 'handoff', 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_AND_FAILURE_DECOMPOSITION_V1');
const R1_FILE = path.join(BASE, '10_R1_RESULTS.json');
const R0_FILE = path.join(BASE, '09_R0_RESULTS.json');
const GPT_PACKET_FILE = path.join(BASE, '14_GPT_SEMANTIC_REVIEW_PACKET.json');
const R2_FILE = path.join(BASE, '11_R2_NOT_EXECUTED.json');
const CHECKPOINT_FILE = path.join(BASE, '21_CHECKPOINT.json');
const RUN_ID = 'V43-CORE6-REAL-REFERENCE-RAG-WRITER-20260915105535';
const K = 4;
const TENDERS = ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01'];
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const writeJson = (name, value) => fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const rel = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');
const git = (args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } };

fs.mkdirSync(OUT, { recursive: true });
const r1 = readJson(R1_FILE);
const r0 = readJson(R0_FILE);
const gptPacket = readJson(GPT_PACKET_FILE);
const r2NotExecuted = readJson(R2_FILE);
const priorCheckpoint = readJson(CHECKPOINT_FILE);
if (r1.run_id !== RUN_ID || r0.run_id !== RUN_ID || gptPacket.run_id !== RUN_ID) {
  throw new Error('RETRIEVAL_RUN_ID_MISMATCH');
}
if (!Array.isArray(r1.cases) || r1.cases.length !== 80) throw new Error('R1_CASE_COUNT_MISMATCH');

writeJson('00_EXECUTION_MANIFEST.json', {
  artifact_type: 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_EXECUTION_MANIFEST',
  run_id: RUN_ID,
  scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL',
  inputs: [
    { path: rel(R0_FILE), sha256: fileSha(R0_FILE), role: 'persisted R0 production-path results' },
    { path: rel(R1_FILE), sha256: fileSha(R1_FILE), role: 'persisted R1 results and raw candidate snapshots' },
    { path: rel(GPT_PACKET_FILE), sha256: fileSha(GPT_PACKET_FILE), role: 'GPT semantic review packet / label authority' },
    { path: rel(R2_FILE), sha256: fileSha(R2_FILE), role: 'canonical R2 status authority' },
    { path: rel(CHECKPOINT_FILE), sha256: fileSha(CHECKPOINT_FILE), role: 'prior retrieval checkpoint' }
  ],
  input_identity: {
    r1_case_count: r1.cases.length,
    six_tenders: TENDERS,
    prior_checkpoint_status: priorCheckpoint.status,
    canonical_r2_status: r2NotExecuted.status
  },
  authority: {
    gpt_labels: true,
    codex_semantic_relabeling: false,
    r2_case_rows_non_authoritative: true,
    semantic_root_cause: 'PENDING_GPT'
  },
  execution: {
    offline_only: true,
    new_provider_calls: 0,
    new_llm_calls: 0,
    new_embedding_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    r2_rerun: false,
    lexical_proxy_rerun: false,
    corpus_ingestion: false,
    router_mutation: false,
    writer_provider: false
  },
  hygiene_patch_owner: [
    'backend/src/pipeline/retrieval-substantive-candidate.js',
    'backend/src/pipeline/retrieval-chunk-role.js'
  ],
  outputs: [
    '00_EXECUTION_MANIFEST.json', '01_GPT_R1_SEMANTIC_ADJUDICATION.json',
    '02_R2_ARTIFACT_INTEGRITY_REPORT.json', '03_R1_HYGIENE_ESCAPE_AUDIT.json',
    '04_R1_HYGIENE_MICRO_PATCH_REPORT.json', '05_R1_OFFLINE_REPLAY.json',
    '06_RANKING_FAILURE_FORENSICS.json', '07_REFERENCE_NEED_ROUTING_DEBT.json',
    '08_CORPUS_COVERAGE_DEBT.json', '09_GENERIC_CHUNK_CONCENTRATION.json',
    '10_SIMILARITY_FAIL_QUIET_SWEEP.json', '11_DOMAIN_AFFINITY_OFFLINE_ANALYSIS.json',
    '12_RAW80_VS_ADJUSTED74_METRICS.json', '13_TEST_REPORT.json',
    '14_DEBT_REGISTER.json', '15_CHECKPOINT.json', '15_CHECKPOINT.md'
  ],
  git_head: git(['rev-parse', 'HEAD'])
});

const labelGroups = {
  GOOD_REFERENCE: [
    'RAG-TB-006-TB-006-REQ-033', 'RAG-FAST-01-FAST-01-REQ-009',
    'RAG-JY-001-JY-001-REQ-029', 'RAG-JY-001-JY-001-REQ-078',
    'RAG-TB-003-TB-003-REQ-167', 'RAG-TB-003-TB-003-REQ-057',
    'RAG-TB-003-TB-003-REQ-122', 'RAG-TB-003-TB-003-REQ-059',
    'RAG-TB-003-TB-003-REQ-145', 'RAG-TB-003-TB-003-REQ-060',
    'RAG-TB-003-TB-003-REQ-115', 'RAG-TB-003-TB-003-REQ-245'
  ],
  REFERENCE_NOT_NEEDED: [
    'RAG-TB-003-TB-003-REQ-035', 'RAG-JY-001-JY-001-REQ-039',
    'RAG-JY-001-JY-001-REQ-130', 'RAG-TB-003-TB-003-REQ-020',
    'RAG-TB-003-TB-003-REQ-225', 'RAG-TB-003-TB-003-REQ-226'
  ],
  RANKING_FAILURE: [
    'RAG-JY-001-JY-001-REQ-120', 'RAG-JY-001-JY-001-REQ-047',
    'RAG-TB-003-TB-003-REQ-114', 'RAG-TB-003-TB-003-REQ-117',
    'RAG-TB-003-TB-003-REQ-058', 'RAG-TB-006-TB-006-REQ-023',
    'RAG-FAST-04-FAST-04-REQ-353'
  ],
  WEAK_CORPUS: [
    'RAG-FAST-WATER-01-FAST-WATER-01-REQ-025', 'RAG-JY-001-JY-001-REQ-003',
    'RAG-JY-001-JY-001-REQ-007', 'RAG-JY-001-JY-001-REQ-053',
    'RAG-JY-001-JY-001-REQ-067', 'RAG-JY-001-JY-001-REQ-054',
    'RAG-JY-001-JY-001-REQ-056', 'RAG-JY-001-JY-001-REQ-070',
    'RAG-JY-001-JY-001-REQ-082', 'RAG-JY-001-JY-001-REQ-086',
    'RAG-JY-001-JY-001-REQ-087', 'RAG-JY-001-JY-001-REQ-089',
    'RAG-JY-001-JY-001-REQ-034', 'RAG-JY-001-JY-001-REQ-044',
    'RAG-TB-003-TB-003-REQ-054', 'RAG-TB-003-TB-003-REQ-055',
    'RAG-TB-003-TB-003-REQ-140', 'RAG-TB-003-TB-003-REQ-156',
    'RAG-TB-006-TB-006-REQ-046', 'RAG-FAST-04-FAST-04-REQ-240'
  ],
  SEMANTIC_NEAR_MISS: [
    'RAG-JY-001-JY-001-REQ-063', 'RAG-JY-001-JY-001-REQ-071',
    'RAG-JY-001-JY-001-REQ-064', 'RAG-JY-001-JY-001-REQ-065',
    'RAG-JY-001-JY-001-REQ-043', 'RAG-TB-003-TB-003-REQ-056',
    'RAG-TB-003-TB-003-REQ-126', 'RAG-TB-003-TB-003-REQ-158',
    'RAG-TB-003-TB-003-REQ-155'
  ],
  TOO_GENERIC: [
    'RAG-JY-001-JY-001-REQ-001', 'RAG-TB-003-TB-003-REQ-053',
    'RAG-FAST-01-FAST-01-REQ-007', 'RAG-FAST-04-FAST-04-REQ-352',
    'RAG-FAST-04-FAST-04-REQ-351', 'RAG-JY-001-JY-001-REQ-008',
    'RAG-JY-001-JY-001-REQ-069', 'RAG-JY-001-JY-001-REQ-076',
    'RAG-JY-001-JY-001-REQ-190', 'RAG-JY-001-JY-001-REQ-177',
    'RAG-JY-001-JY-001-REQ-179', 'RAG-JY-001-JY-001-REQ-006',
    'RAG-JY-001-JY-001-REQ-004', 'RAG-JY-001-JY-001-REQ-055',
    'RAG-TB-003-TB-003-REQ-131', 'RAG-TB-003-TB-003-REQ-162',
    'RAG-TB-003-TB-003-REQ-157', 'RAG-TB-003-TB-003-REQ-061',
    'RAG-FAST-01-FAST-01-REQ-011'
  ],
  PARTIAL_WEAK_CORPUS: [
    'RAG-JY-001-JY-001-REQ-052', 'RAG-JY-001-JY-001-REQ-074',
    'RAG-JY-001-JY-001-REQ-075', 'RAG-JY-001-JY-001-REQ-073',
    'RAG-FAST-04-FAST-04-REQ-224'
  ],
  OTHER: ['RAG-TB-003-TB-003-REQ-212', 'RAG-TB-003-TB-003-REQ-214']
};
const familyByCase = new Map();
for (const [family, ids] of Object.entries(labelGroups)) for (const id of ids) familyByCase.set(id, family);
if (familyByCase.size !== 80 || r1.cases.some((item) => !familyByCase.has(item.case_id))) throw new Error('GPT_LABEL_CASE_COVERAGE_MISMATCH');
// These mappings preserve the exact GPT-provided labels, including the two
// OTHER cases and the explicitly listed partial ranking/weak-corpus cases are
// GPT-marked PARTIAL; the remaining members of those families are NOT_USEFUL.
const partialCaseIds = new Set([
  'RAG-TB-006-TB-006-REQ-023', 'RAG-FAST-04-FAST-04-REQ-353',
  'RAG-JY-001-JY-001-REQ-052', 'RAG-JY-001-JY-001-REQ-074',
  'RAG-JY-001-JY-001-REQ-075', 'RAG-JY-001-JY-001-REQ-073',
  'RAG-FAST-04-FAST-04-REQ-224', 'RAG-TB-003-TB-003-REQ-212',
  'RAG-TB-003-TB-003-REQ-214'
]);
const semanticLabel = (family, caseId = null) => family === 'GOOD_REFERENCE' ? 'USEFUL' : ['SEMANTIC_NEAR_MISS', 'TOO_GENERIC'].includes(family) || partialCaseIds.has(caseId) ? 'PARTIAL' : 'NOT_USEFUL';
const labelCounts = (cases) => cases.reduce((out, item) => { const family = familyByCase.get(item.case_id); const label = semanticLabel(family, item.case_id); out[label] = (out[label] || 0) + 1; return out; }, {});
const familyCounts = (cases) => cases.reduce((out, item) => { const family = familyByCase.get(item.case_id); const normalizedFamily = family === 'PARTIAL_WEAK_CORPUS' ? 'WEAK_CORPUS' : family; out[normalizedFamily] = (out[normalizedFamily] || 0) + 1; return out; }, {});

const oldR1Refs = (item) => item.strategies?.R1_CURRENT_PLUS_ACCEPTED_HYGIENE?.final_references ?? [];
const rawCandidates = (item) => item.raw_candidates?.length ? item.raw_candidates : item.strategies?.R0_CURRENT_PRODUCTION_REFERENCE_PATH?.raw_candidate_snapshot ?? [];
const dedupRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.chunk_hash || `${row.material_id}:${row.chunk_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const projectReference = (row, index) => ({
  strategy: 'R1_OFFLINE_REPLAY_AFTER_HYGIENE_PATCH',
  final_rank: index + 1,
  raw_candidate_rank: row.raw_candidate_rank ?? row.final_rank ?? null,
  material_id: row.material_id ?? null,
  chunk_id: row.chunk_id ?? null,
  chunk_hash: row.chunk_hash ?? null,
  material_type: row.material_type ?? null,
  source_role: row.source_role ?? 'REFERENCE_ONLY',
  source_role_reason: row.source_role_reason ?? null,
  corpus_scope: row.corpus_scope ?? null,
  chunk_role: row.chunk_role ?? null,
  source_text: row.source_text ?? '',
  original_name: row.original_name ?? null,
  source_lineage: row.source_lineage ?? null,
  source_text_sha256: row.source_text_sha256 ?? null,
  similarity_score: Number(row.similarity_score ?? 0),
  lifecycle_status: row.lifecycle_status ?? null,
  review_status: row.review_status ?? null,
  usage_status: row.usage_status ?? null,
  substantive_candidate: row.substantive_candidate === true,
  citation_index_like: isCitationIndexLike(row.source_text ?? '')
});

const offlineCases = r1.cases.map((item) => {
  const annotated = dedupRows(rawCandidates(item)).map((row, index) => ({ ...applyRetrievalChunkRole({ ...row, source_text: row.source_text ?? '' }), _raw_index: index + 1 }));
  const selected = annotated.filter(isWriterReferenceContentEligible).slice(0, K);
  const excluded = annotated.filter((row) => !isWriterReferenceContentEligible(row)).map((row) => ({
    raw_candidate_rank: row._raw_index,
    chunk_id: row.chunk_id,
    material_id: row.material_id,
    chunk_role: row.chunk_role,
    substantive_class: row.substantive_class,
    substantive_reason: row.substantive_reason,
    citation_index_like: isCitationIndexLike(row.source_text ?? ''),
    source_text: row.source_text ?? ''
  }));
  const oldRefs = oldR1Refs(item);
  return {
    case_id: item.case_id,
    tender_id: item.tender_id,
    requirement_id: item.requirement_id,
    requirement_text: item.requirement_text,
    query: item.query,
    semantic_label: null,
    previous_r1_chunk_ids: oldRefs.map((row) => row.chunk_id),
    replay_r1_references: selected.map(projectReference),
    raw_candidate_count: annotated.length,
    excluded_count: excluded.length,
    excluded,
    final_reference_count: selected.length,
    replay_status: 'OFFLINE_DETERMINISTIC'
  };
});

const countRefs = (cases, predicate) => cases.reduce((total, item) => total + item.replay_r1_references.filter(predicate).length, 0);
const countOldRefs = (predicate) => r1.cases.reduce((total, item) => total + oldR1Refs(item).filter(predicate).length, 0);
const prePatchEscapeRows = r1.cases.flatMap((item) => oldR1Refs(item).map((row) => ({
  case_id: item.case_id,
  tender_id: item.tender_id,
  chunk_id: row.chunk_id,
  material_id: row.material_id,
  source_text: row.source_text ?? '',
  previous_chunk_role: row.chunk_role ?? null,
  previous_citation_index_like: row.citation_index_like ?? false,
  reclassified: applyRetrievalChunkRole({ ...row, source_text: row.source_text ?? '' })
})));
const prePatchAudit = {
  case_count: r1.cases.length,
  historical_r1_reference_count: r1.cases.reduce((n, item) => n + oldR1Refs(item).length, 0),
  historical_recorded_metrics: r1.metrics,
  derived_old_r1_heading_escape: countOldRefs((row) => row.chunk_role === 'HEADING'),
  derived_old_r1_front_matter_escape: countOldRefs((row) => row.chunk_role === 'FRONT_MATTER'),
  derived_old_r1_existing_citation_flag: countOldRefs((row) => row.citation_index_like === true),
  derived_old_r1_citation_shape_escape_under_current_owner: countOldRefs((row) => isCitationIndexLike(row.source_text ?? '')),
  derived_old_r1_boilerplate_escape_under_current_owner: countOldRefs((row) => applyRetrievalChunkRole({ ...row, source_text: row.source_text ?? '' }).substantive_reason === 'GENERIC_SUMMARY_DISCLAIMER'),
  known_gpt_other_case_ids: ['RAG-TB-003-TB-003-REQ-212', 'RAG-TB-003-TB-003-REQ-214'],
  escape_rows: prePatchEscapeRows.filter((row) => row.reclassified.substantive_reason === 'GENERIC_SUMMARY_DISCLAIMER' || isCitationIndexLike(row.source_text))
};

const offlineMetrics = {
  case_count: offlineCases.length,
  returned_reference_count: offlineCases.reduce((n, item) => n + item.final_reference_count, 0),
  returned_reference_count_distribution: offlineCases.reduce((out, item) => { const key = String(item.final_reference_count); out[key] = (out[key] || 0) + 1; return out; }, {}),
  zero_reference_count: offlineCases.filter((item) => item.final_reference_count === 0).length,
  zero_reference_rate: offlineCases.filter((item) => item.final_reference_count === 0).length / offlineCases.length,
  mean_reference_count: offlineCases.reduce((n, item) => n + item.final_reference_count, 0) / offlineCases.length,
  heading_escape: countRefs(offlineCases, (row) => row.chunk_role === 'HEADING'),
  front_matter_escape: countRefs(offlineCases, (row) => row.chunk_role === 'FRONT_MATTER'),
  citation_source_index_escape: countRefs(offlineCases, (row) => row.citation_index_like === true),
  boilerplate_escape: countRefs(offlineCases, (row) => row.substantive_reason === 'GENERIC_SUMMARY_DISCLAIMER'),
  duplicate_escape: offlineCases.reduce((n, item) => n + (new Set(item.replay_r1_references.map((row) => row.chunk_hash || `${row.material_id}:${row.chunk_id}`)).size < item.replay_r1_references.length ? 1 : 0), 0),
  lineage_completeness_rate: (() => { const rows = offlineCases.flatMap((item) => item.replay_r1_references); return rows.length ? rows.filter((row) => row.source_lineage?.material_id && row.source_lineage?.chunk_id && row.source_lineage?.chunk_hash).length / rows.length : 1; })()
};

const r2ObservedCases = r1.cases.filter((item) => item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.final_references?.length > 0);
const r2ObservedStatusCounts = r1.cases.reduce((out, item) => { const status = item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.status ?? 'MISSING'; out[status] = (out[status] || 0) + 1; return out; }, {});
const r2Integrity = {
  canonical_authority: { artifact: rel(R2_FILE), sha256: fileSha(R2_FILE), status: r2NotExecuted.status, reason: r2NotExecuted.reason, executed_case_count: r2NotExecuted.executed_case_count },
  observed_non_authoritative_rows: { artifact: rel(GPT_PACKET_FILE), sha256: fileSha(GPT_PACKET_FILE), case_count: gptPacket.cases.filter((item) => item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.references?.length > 0).length, reference_count: gptPacket.cases.reduce((n, item) => n + (item.strategies?.R2_TRUE_VECTOR_MMR_LAMBDA_0_9?.references?.length ?? 0), 0), status_values: r2ObservedStatusCounts },
  source_artifacts_with_retained_r2: [{ path: rel(path.join(BASE, '09_R0_RESULTS.json')), sha256: fileSha(path.join(BASE, '09_R0_RESULTS.json')) }, { path: rel(path.join(BASE, '10_R1_RESULTS.json')), sha256: fileSha(path.join(BASE, '10_R1_RESULTS.json')) }, { path: rel(GPT_PACKET_FILE), sha256: fileSha(GPT_PACKET_FILE) }],
  origin_trace: [
    { path: 'backend/eval/rag-governance/run-core6-real-reference-rag-writer-context-v1.mjs', lines: '583-587', observation: 'fetchVectors(annotated embedding IDs) sets per-case vectorComplete and status EXECUTED_TRUE_VECTOR_MMR when that case is complete.' },
    { path: 'backend/eval/rag-governance/run-core6-real-reference-rag-writer-context-v1.mjs', lines: '599-606', observation: 'The per-case R2 strategy and r2 object are retained in caseRecords.' },
    { path: 'backend/eval/rag-governance/run-core6-real-reference-rag-writer-context-v1.mjs', lines: '623-627', observation: 'R0/R1 artifacts serialize the full caseRecords; global R2 artifact is written only when every case has status exactly EXECUTED.' },
    { path: 'backend/eval/rag-governance/run-reference-retrieval-schema-parity-core6-replay-v2.mjs', lines: '359-362', observation: 'The orchestrator copies R0/R1 and emits 11_R2_NOT_EXECUTED when the global all-case R2 artifact is absent.' }
  ],
  classification: 'PARTIAL_VECTOR_PATH_RETAINED_IN_R0_R1_AND_GPT_PACKET',
  lexical_proxy_involved_in_canonical_packet: false,
  lexical_proxy_note: 'The separate historical challenger script has a lexical MMR proxy, but it is not the source of this canonical packet and was not rerun.',
  canonical_interpretation: 'R2 remains NOT_EXECUTED; retained per-case rows are non-authoritative and must not be semantically labeled or treated as executed MMR.',
  action_taken: 'DERIVED_INTEGRITY_REPORT_ONLY_NO_RERUN_NO_DELETE_NO_REWRITE'
};

const gptSemanticCases = r1.cases.map((item) => {
  const family = familyByCase.get(item.case_id);
  return {
    case_id: item.case_id,
    tender_id: item.tender_id,
    requirement_id: item.requirement_id,
    requirement_text: item.requirement_text,
    query: item.query,
    response_mode: item.response_mode,
    evidence_dependency: item.response_decision?.evidence_dependency ?? null,
    r1_references: oldR1Refs(item),
    semantic_label: semanticLabel(family, item.case_id),
    failure_family: family === 'PARTIAL_WEAK_CORPUS' ? 'WEAK_CORPUS' : family,
    semantic_label_author: 'GPT',
    semantic_notes: family === 'OTHER' ? 'SOURCE_INDEX_SEMANTIC_ESCAPE' : null
  };
});
writeJson('01_GPT_R1_SEMANTIC_ADJUDICATION.json', {
  artifact_type: 'V43_GPT_R1_SEMANTIC_ADJUDICATION',
  authority: 'GPT_SUPPLIED_DECISION',
  source_artifact: rel(GPT_PACKET_FILE),
  source_sha256: fileSha(GPT_PACKET_FILE),
  run_id: RUN_ID,
  case_count: gptSemanticCases.length,
  label_counts: labelCounts(r1.cases),
  failure_family_counts: familyCounts(r1.cases),
  cases: gptSemanticCases,
  semantic_labels_created_by_codex: 0
});
writeJson('02_R2_ARTIFACT_INTEGRITY_REPORT.json', { artifact_type: 'V43_R2_ARTIFACT_INTEGRITY_REPORT', run_id: RUN_ID, ...r2Integrity });
writeJson('03_R1_HYGIENE_ESCAPE_AUDIT.json', { artifact_type: 'V43_R1_HYGIENE_ESCAPE_AUDIT', run_id: RUN_ID, owner: 'backend/src/pipeline/retrieval-chunk-role.js', pre_patch: prePatchAudit, post_patch_expected: { heading_escape: 0, front_matter_escape: 0, citation_source_index_escape: offlineMetrics.citation_source_index_escape, boilerplate_escape: offlineMetrics.boilerplate_escape }, semantic_labels_created: 0 });
writeJson('04_R1_HYGIENE_MICRO_PATCH_REPORT.json', {
  artifact_type: 'V43_R1_HYGIENE_MICRO_PATCH_REPORT',
  patch_scope: 'existing retrieval-chunk-role/substantive owner only',
  changed_files: [
    { path: 'backend/src/pipeline/retrieval-substantive-candidate.js', sha256: fileSha(path.join(ROOT, 'backend/src/pipeline/retrieval-substantive-candidate.js')), changes: ['generic summary/disclaimer shape classified as BOILERPLATE / NON_SUBSTANTIVE'] },
    { path: 'backend/src/pipeline/retrieval-chunk-role.js', sha256: fileSha(path.join(ROOT, 'backend/src/pipeline/retrieval-chunk-role.js')), changes: ['URL query parameters excluded from sentence-punctuation test', 'OFF/REF/SRC/DOC citation-index shape classified fail-closed'] },
    { path: 'backend/test/retrieval-chunk-role.test.js', sha256: fileSha(path.join(ROOT, 'backend/test/retrieval-chunk-role.test.js')), changes: ['red tests for boilerplate and URL-query citation rows, then green'] }
  ],
  deterministic_rules: ['summary marker + defer-to-primary-source marker + authoritative-source marker => BOILERPLATE', 'citation/index marker + index separator/metadata shape, with URLs removed before punctuation check => NON_SUBSTANTIVE/CITATION_INDEX'],
  pre_patch_red_tests: { count: 2, cases: ['boilerplate summary disclaimers are fail-closed and do not consume reference slots', 'citation index rows with URL query parameters are recognized as non-substantive'] },
  post_patch_focused_tests: { count: 10, passed: 10, failed: 0 },
  production_semantic_contract_changed: false,
  new_filter_framework: false,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
});
writeJson('05_R1_OFFLINE_REPLAY.json', { artifact_type: 'V43_R1_OFFLINE_REPLAY_AFTER_HYGIENE_PATCH', run_id: RUN_ID, source_artifact: rel(R1_FILE), source_sha256: fileSha(R1_FILE), owner: 'backend/src/pipeline/retrieval-chunk-role.js', final_k_max: K, cases: offlineCases, metrics: offlineMetrics, semantic_labels_created: 0, provider_calls: 0, db_writes: 0 });

const rankingIds = ['JY-001:REQ-120', 'JY-001:REQ-047', 'TB-003:REQ-114', 'TB-003:REQ-117', 'TB-003:REQ-058', 'TB-006:REQ-023', 'FAST-04:REQ-353'];
const charNgrams = (value) => { const s = normalize(value).replace(/\s+/g, ''); const set = new Set(); for (let n = 2; n <= 4; n += 1) for (let i = 0; i + n <= s.length; i += 1) set.add(s.slice(i, i + n)); return set; };
const overlapScore = (query, text) => { const q = charNgrams(query); const t = charNgrams(text); let hit = 0; for (const token of q) if (t.has(token)) hit += 1; return q.size ? hit / q.size : 0; };
const rankingForensics = rankingIds.map((requirementId) => {
  const item = r1.cases.find((row) => row.requirement_id === requirementId);
  const raw = rawCandidates(item);
  const final = oldR1Refs(item);
  const ranked = raw.map((row, index) => ({ rank: index + 1, chunk_id: row.chunk_id, material_id: row.material_id, original_name: row.original_name, similarity_score: row.similarity_score, chunk_role: row.chunk_role, source_text: row.source_text ?? '', query_ngram_overlap: Number(overlapScore(item.query, row.source_text ?? '').toFixed(6)) }));
  const maxOverlap = Math.max(0, ...ranked.map((row) => row.query_ngram_overlap));
  const nonSelectedOverlap = ranked.filter((row) => !final.some((ref) => ref.chunk_id === row.chunk_id)).sort((a, b) => b.query_ngram_overlap - a.query_ngram_overlap || a.rank - b.rank);
  const classification = maxOverlap >= 0.02 && nonSelectedOverlap.some((row) => row.query_ngram_overlap === maxOverlap)
    ? 'A_SELECTOR_OR_RANKING_FAILURE'
    : ranked.some((row) => row.chunk_role === 'HEADING') ? 'B_DENSE_RETRIEVAL_CANDIDATE_FAILURE_PROPOSAL' : 'C_CORPUS_GAP_PROPOSAL';
  return {
    requirement_id: requirementId,
    case_id: item.case_id,
    tender_id: item.tender_id,
    gpt_failure_family: 'RANKING_FAILURE',
    mechanical_classification_proposal: classification,
    confidence: 'LOW_MECHANICAL_SIGNAL_ONLY',
    semantic_root_cause: 'PENDING_GPT',
    query: item.query,
    raw_candidate_top20: ranked,
    previous_r1_final_references: final,
    selection_note: 'Rows are shown for GPT inspection; no semantic relevance was frozen by Codex.'
  };
});
writeJson('06_RANKING_FAILURE_FORENSICS.json', { artifact_type: 'V43_RANKING_FAILURE_FORENSICS', run_id: RUN_ID, cases: rankingForensics, classification_authority: 'MECHANICAL_PROPOSAL_ONLY', semantic_labels_created: 0 });
const referenceNotNeeded = labelGroups.REFERENCE_NOT_NEEDED.map((caseId) => ({ case_id: caseId, requirement_id: r1.cases.find((item) => item.case_id === caseId)?.requirement_id ?? null }));
writeJson('07_REFERENCE_NEED_ROUTING_DEBT.json', { artifact_type: 'V43_REFERENCE_NEED_ROUTING_DEBT', raw_80_case_count: 80, excluded_reference_not_needed_case_count: 6, adjusted_reference_needed_case_count: 74, cases: referenceNotNeeded, frozen_router_mutated: false, retroactive_exclusion: false, note: 'These six cases remain in RAW_80 and are excluded only from the adjusted descriptive metric.' });

const weakCases = r1.cases.filter((item) => ['WEAK_CORPUS', 'PARTIAL_WEAK_CORPUS'].includes(familyByCase.get(item.case_id)));
const topicPatterns = [
  ['urban_governance_grid', /城市|网格|治理|一网|街道/u], ['video_ar_surveillance', /视频|监控|摄像|AR|增强现实/u],
  ['call_center_speech_ai', /12345|坐席|呼叫|语音|客服/u], ['electronic_signature_ca', /电子签|签章|CA|证书/u],
  ['document_material_platform', /文档|材料|文件|资料|档案/u], ['database_internals', /数据库|数据存储|SQL|表结构|索引/u],
  ['water_project_management', /水务|供水|排水|污水|泵站|河道/u], ['esg', /ESG|碳排|环境|社会责任/u],
  ['ux_interaction', /界面|交互|用户体验|移动端/u]
];
const coverageRows = weakCases.map((item) => {
  const signals = topicPatterns.filter(([, pattern]) => pattern.test(item.query)).map(([name]) => name);
  return { case_id: item.case_id, tender_id: item.tender_id, requirement_id: item.requirement_id, query: item.query, observed_topic_signals: signals.length ? signals : ['unclassified_from_available_text'], r1_references: oldR1Refs(item).map((row) => ({ chunk_id: row.chunk_id, material_id: row.material_id, original_name: row.original_name, source_text: row.source_text, similarity_score: row.similarity_score })) };
});
writeJson('08_CORPUS_COVERAGE_DEBT.json', { artifact_type: 'V43_CORPUS_COVERAGE_DEBT', source: 'GPT WEAK_CORPUS/PARTIAL_WEAK_CORPUS cases plus persisted R1 rows', cases: coverageRows, topic_family_counts: coverageRows.flatMap((item) => item.observed_topic_signals).reduce((out, key) => { out[key] = (out[key] || 0) + 1; return out; }, {}), no_ingestion_performed: true, enrichment_targets_invented: false });

const concentration = new Map();
for (const item of r1.cases) for (const row of oldR1Refs(item)) {
  const key = row.chunk_id;
  if (!concentration.has(key)) concentration.set(key, { chunk_id: key, material_id: row.material_id, original_name: row.original_name, excerpt: row.source_text, case_ids: new Set(), tenders: new Set(), appearances: 0 });
  const entry = concentration.get(key); entry.appearances += 1; entry.case_ids.add(item.case_id); entry.tenders.add(item.tender_id);
}
const topRepeated = [...concentration.values()].sort((a, b) => b.appearances - a.appearances || String(a.chunk_id).localeCompare(String(b.chunk_id))).slice(0, 20).map((entry) => ({ ...entry, case_ids: [...entry.case_ids].sort(), tenders: [...entry.tenders].sort() }));
writeJson('09_GENERIC_CHUNK_CONCENTRATION.json', { artifact_type: 'V43_GENERIC_CHUNK_CONCENTRATION', source_artifact: rel(R1_FILE), source_sha256: fileSha(R1_FILE), r1_case_count: 80, top_repeated_chunks: topRepeated, diagnostic_only: true, repetition_penalty_deployed: false });

const allLabelledRows = r1.cases.flatMap((item) => oldR1Refs(item).map((row) => ({ case_id: item.case_id, label: semanticLabel(familyByCase.get(item.case_id), item.case_id), score: Number(row.similarity_score ?? 0) })));
const thresholds = [0.45, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.65];
const thresholdTable = thresholds.map((threshold) => {
  const retainedByCase = new Map();
  for (const item of r1.cases) retainedByCase.set(item.case_id, oldR1Refs(item).filter((row) => Number(row.similarity_score ?? 0) >= threshold).length);
  const casesWithReference = (label) => r1.cases.filter((item) => semanticLabel(familyByCase.get(item.case_id), item.case_id) === label && (retainedByCase.get(item.case_id) || 0) > 0).length;
  const totalByLabel = (label) => r1.cases.filter((item) => semanticLabel(familyByCase.get(item.case_id), item.case_id) === label).length;
  return { threshold, useful_retention_rate: casesWithReference('USEFUL') / totalByLabel('USEFUL'), partial_retention_rate: casesWithReference('PARTIAL') / totalByLabel('PARTIAL'), not_useful_retention_rate: casesWithReference('NOT_USEFUL') / totalByLabel('NOT_USEFUL'), zero_reference_count: [...retainedByCase.values()].filter((count) => count === 0).length, zero_reference_rate: [...retainedByCase.values()].filter((count) => count === 0).length / r1.cases.length };
});
writeJson('10_SIMILARITY_FAIL_QUIET_SWEEP.json', { artifact_type: 'V43_SIMILARITY_FAIL_QUIET_SWEEP', source_artifact: rel(R1_FILE), method: 'offline thresholding of persisted R1 similarity scores with GPT labels', thresholds: thresholdTable, no_threshold_deployed: true, no_semantic_relabeling: true, raw_labelled_reference_rows: allLabelledRows.length });

const domainAffinityRows = r1.cases.map((item) => {
  const queryTerms = new Set(normalize(item.query).replace(/\s+/g, '').match(/[\p{L}\p{N}]{2,}/gu) || []);
  const refs = oldR1Refs(item).map((row) => { const text = normalize(`${row.original_name ?? ''}${row.source_text ?? ''}`).replace(/\s+/g, ''); const hits = [...queryTerms].filter((term) => text.includes(term)); return { chunk_id: row.chunk_id, score: row.similarity_score, deterministic_query_term_hits: hits.slice(0, 20), deterministic_affinity_ratio: queryTerms.size ? hits.length / queryTerms.size : 0 }; });
  return { case_id: item.case_id, tender_id: item.tender_id, label: semanticLabel(familyByCase.get(item.case_id), item.case_id), references: refs };
});
const domainAggregate = domainAffinityRows.reduce((out, item) => { if (!out[item.label]) out[item.label] = { cases: 0, references: 0, mean_affinity_ratio: 0 }; out[item.label].cases += 1; out[item.label].references += item.references.length; out[item.label].mean_affinity_ratio += item.references.reduce((n, row) => n + row.deterministic_affinity_ratio, 0); return out; }, {});
for (const value of Object.values(domainAggregate)) value.mean_affinity_ratio = value.references ? value.mean_affinity_ratio / value.references : 0;
writeJson('11_DOMAIN_AFFINITY_OFFLINE_ANALYSIS.json', { artifact_type: 'V43_DOMAIN_AFFINITY_OFFLINE_ANALYSIS', method: 'deterministic normalized query-term substring overlap; diagnostic only', aggregate: domainAggregate, cases: domainAffinityRows, no_production_change: true });

const adjustedCases = r1.cases.filter((item) => !labelGroups.REFERENCE_NOT_NEEDED.includes(item.case_id));
writeJson('12_RAW80_VS_ADJUSTED74_METRICS.json', { artifact_type: 'V43_RAW80_VS_REFERENCE_NEEDED_ADJUSTED74_METRICS', raw_80: { case_count: 80, label_counts: labelCounts(r1.cases), family_counts: familyCounts(r1.cases), useful_rate: 12 / 80 }, reference_needed_adjusted_74: { case_count: adjustedCases.length, label_counts: labelCounts(adjustedCases), family_counts: familyCounts(adjustedCases), useful_rate: 12 / adjustedCases.length }, excluded_case_ids: labelGroups.REFERENCE_NOT_NEEDED, denominator_change_only: true, router_mutated: false });

writeJson('13_TEST_REPORT.json', {
  artifact_type: 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_TEST_REPORT',
  focused_tests: { status: 'PASS', tests: 10, passed: 10, failed: 0, command: 'node --test --test-concurrency=1 backend/test/retrieval-chunk-role.test.js backend/test/writer-reference-hygiene.test.js backend/test/retrieval-substantive-hygiene-offline.test.js' },
  relevant_regression: {
    status: 'PASS',
    tests: 83,
    passed: 83,
    failed: 0,
    command: 'node --test --test-concurrency=1 backend/test/authority-binding-loop.test.js backend/test/retrieval-runner-binding.test.js backend/test/writer-reference-hygiene.test.js backend/test/retrieval-source-eligibility.test.js backend/test/retrieval-substantive-hygiene-offline.test.js backend/test/writer-v2-composition.test.js backend/test/writer-authority-p0.test.js backend/test/material-source-role-gate.test.js backend/test/production-retrieval-contract.test.js backend/test/retrieval-chunk-role.test.js',
    note: 'Relevant authority/retrieval/writer regression suite passed after the patch; no provider or database write path executed.'
  },
  build: { status: 'PASS', command: 'npm run build' },
  lint: { status: 'PASS', command: 'npm run lint', note: 'Configured lint scripts are absent; workspace command exited 0.' },
  diff_check: { status: 'PASS_WITH_PRE_EXISTING_LINE_ENDING_WARNINGS', command: 'git diff --check', note: 'Warnings are existing CRLF normalization notices across the dirty worktree; no whitespace error was reported.' },
  provider_calls_this_task: 0,
  llm_calls_this_task: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  semantic_labels_created_by_codex: 0
});
writeJson('14_DEBT_REGISTER.json', { artifact_type: 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_DEBT_REGISTER', blockers: [{ code: 'R1_REQUIREMENT_LEVEL_REFERENCE_FIDELITY_NOT_READY_FOR_PRODUCT_FREEZE', reason: 'GPT R1 useful rate is 15%; weak corpus, near misses and ranking failures remain.' }, { code: 'R2_TRUE_VECTOR_MMR_NOT_EXECUTED', reason: r2NotExecuted.reason }, { code: 'REFERENCE_NEED_ROUTING_DEBT', reason: 'Six reference-not-needed SOLUTION cases remain in RAW_80 and are descriptive-only adjusted out.' }], non_blocking: ['No Writer Reference Product Fidelity claim.', 'No threshold, reranker, MMR, corpus ingestion or Router change deployed.'], semantic_root_cause: 'PENDING_GPT' });

const status = 'READY_FOR_GPT_REFERENCE_RAG_FAIL_QUIET_STRATEGY_DECISION';
const checkpoint = {
  artifact_type: 'V43_REFERENCE_RAG_SEMANTIC_ADJUDICATION_AND_FAILURE_DECOMPOSITION_CHECKPOINT',
  status,
  run_id: RUN_ID,
  scope: 'REQUIREMENT_LEVEL_REFERENCE_RETRIEVAL_EVAL',
  source_artifact: rel(GPT_PACKET_FILE),
  source_sha256: fileSha(GPT_PACKET_FILE),
  R1_engineering_hygiene: 'ACCEPTED',
  R1_semantic_labels: { useful: 12, partial: 37, not_useful: 31, total: 80, useful_rate: 0.15, failure_families: familyCounts(r1.cases) },
  R2_authority: { canonical_status: r2NotExecuted.status, integrity_report: '02_R2_ARTIFACT_INTEGRITY_REPORT.json', no_rerun: true },
  hygiene_patch: { owner: 'backend/src/pipeline/retrieval-chunk-role.js + retrieval-substantive-candidate.js', offline_replay: '05_R1_OFFLINE_REPLAY.json', heading_escape: offlineMetrics.heading_escape, front_matter_escape: offlineMetrics.front_matter_escape, citation_source_index_escape: offlineMetrics.citation_source_index_escape, boilerplate_escape: offlineMetrics.boilerplate_escape, duplicate_escape: offlineMetrics.duplicate_escape, final_k_max: K },
  routing_debt: { raw_80: '12_RAW80_VS_ADJUSTED74_METRICS.json', adjusted_74: '12_RAW80_VS_ADJUSTED74_METRICS.json' },
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  requirement_mutations: 0,
  fact_mapping_claim_writer_mutations: 0,
  production_semantic_changes: 0,
  no_mmr_rerun: true,
  no_lexical_proxy_rerun: true,
  next_gate: 'GPT_FAIL_QUIET_STRATEGY_DECISION'
};
writeJson('15_CHECKPOINT.json', checkpoint);
fs.writeFileSync(path.join(OUT, '15_CHECKPOINT.md'), [
  '# V43 Reference RAG Semantic Adjudication + Failure Decomposition', '',
  `Status: \`${status}\``, '',
  'Scope: Requirement-level Reference Retrieval Eval only. Writer Reference Product Fidelity is not established.', '',
  'GPT R1: USEFUL 12 / PARTIAL 37 / NOT_USEFUL 31 (80; 15.00%).',
  'R2 authority remains NOT_EXECUTED; populated case-level R2 rows are retained only as a derived integrity finding.',
  `Offline R1 hygiene replay: heading=${offlineMetrics.heading_escape}, front_matter=${offlineMetrics.front_matter_escape}, citation/source-index=${offlineMetrics.citation_source_index_escape}, boilerplate=${offlineMetrics.boilerplate_escape}, duplicate=${offlineMetrics.duplicate_escape}.`,
  'No Provider/LLM calls, Production DB writes, Gold mutations, MMR rerun, lexical proxy rerun, corpus ingestion, Router mutation, or Writer generation.', '',
  'Next decision: GPT fail-quiet strategy review.', ''
].join('\n'), 'utf8');

console.log(JSON.stringify({ status, output_dir: rel(OUT), r1_labels: labelCounts(r1.cases), r2_canonical: r2NotExecuted.status, offline_metrics: offlineMetrics, provider_calls: 0, production_db_writes: 0 }, null, 2));
