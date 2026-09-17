import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  applyRetrievalChunkRole,
  classifyEvidenceSourceEligibility
} from '../../src/pipeline/retrieval-chunk-role.js';
import {
  resolveMaterialSourceRole,
  MATERIAL_SOURCE_ROLE_POLICY_VERSION
} from '../../src/pipeline/material-source-authority-policy.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outputDir = path.join(repoRoot, 'docs', 'handoff', 'V43_RAG_REFERENCE_HYGIENE_MMR_CHALLENGER_V1');
const sourceRelativePath = 'backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json';
const sourceAbsolutePath = path.join(repoRoot, sourceRelativePath);
const source = JSON.parse(fs.readFileSync(sourceAbsolutePath, 'utf8'));
const sourceSha256 = createHash('sha256').update(fs.readFileSync(sourceAbsolutePath)).digest('hex');
const K = 4;
const LAMBDA = 0.9;
const referenceCases = source.cases
  .filter((item) => /^A(?:0[1-9]|[12][0-9]|30)$/.test(item.case_id))
  .sort((a, b) => Number(a.case_id.slice(1)) - Number(b.case_id.slice(1)));
const deferredCases = source.cases
  .filter((item) => /^A(?:3[1-9]|40)$/.test(item.case_id))
  .sort((a, b) => Number(a.case_id.slice(1)) - Number(b.case_id.slice(1)));

if (referenceCases.length !== 30 || deferredCases.length !== 10) {
  throw new Error(`REFERENCE_LANE_CASE_SPLIT_INVALID:${referenceCases.length}/${deferredCases.length}`);
}

fs.mkdirSync(outputDir, { recursive: true });

const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
const rankOf = (row, fallback = 0) => Number(row.reranked_rank ?? row.rank ?? row.raw_vector_rank ?? fallback);
const rawRankOf = (row, fallback = 0) => Number(row.raw_vector_rank ?? row.rank ?? fallback);
const git = (args) => {
  try { return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { return null; }
};
const writeJson = (name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const fileHash = (relative) => createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relative))).digest('hex');
const fileIdentity = (relative) => ({ path: relative, sha256: fileHash(relative) });

function citationIndexLike(text) {
  const value = normalize(text);
  if (!value) return { value: false, reason: 'EMPTY_SOURCE' };
  const markers = [
    /https?:\/\//i,
    /(?:状态|实施|最后核验|发布日期|发布单位|来源单位|文号|编号|有效期)/u,
    /(?:参考文献|参考资料|来源索引|引用索引|source\s*index|citation)/i,
    /(?:OFF|REF|SRC|DOC)[-_]?[A-Z]?\d{1,4}\b/i
  ].reduce((count, pattern) => count + (pattern.test(value) ? 1 : 0), 0);
  const separators = (value.match(/[|｜]/g) || []).length;
  const hasSentencePunctuation = /[。！？!?；;]/u.test(value);
  const citationDominant = markers >= 3 && separators >= 2 && !hasSentencePunctuation;
  const urlMetadata = /https?:\/\//i.test(value) && markers >= 2 && separators >= 2 && !hasSentencePunctuation;
  const indexHeading = /^(?:#{1,6}\s*)?(?:参考文献|参考资料|来源|引用|source\s*index|citation\s*index)\b/i.test(value);
  if (citationDominant || urlMetadata || indexHeading) {
    return { value: true, reason: citationDominant ? 'CITATION_METADATA_DOMINANT' : (urlMetadata ? 'URL_METADATA_DOMINANT' : 'SOURCE_INDEX_LABEL') };
  }
  return { value: false, reason: 'SUBSTANTIVE_OR_NON_INDEX_SHAPE' };
}

function sourceRoleFor(row) {
  const material = {
    id: row.material_id,
    material_type: row.material_type,
    source_type: row.source_type,
    source_role: row.source_role,
    explicit_human_role: row.explicit_human_role,
    synthetic_test_material: row.synthetic_test_material,
    synthetic_company_evidence: row.synthetic_company_evidence,
    metadata: row.metadata
  };
  const resolved = resolveMaterialSourceRole(material);
  return { role: resolved.role, reason: resolved.reason, policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION };
}

function annotate(row) {
  const role = applyRetrievalChunkRole({ ...row, source_text: row.source_text ?? row.raw_original_text ?? '' });
  const sourceEligibility = classifyEvidenceSourceEligibility(role);
  const citation = citationIndexLike(role.source_text);
  const sourceRole = sourceRoleFor(role);
  return {
    ...role,
    source_role: sourceRole.role,
    source_role_reason: sourceRole.reason,
    source_role_policy_version: sourceRole.policy_version,
    citation_index_like: citation.value,
    citation_index_like_reason: citation.reason,
    source_eligibility_observed: sourceEligibility.evidence_source_eligible,
    raw_vector_rank: rawRankOf(role),
    baseline_rank: rankOf(role)
  };
}

function compactRow(row, strategy, strategyRank) {
  return {
    rank: strategyRank,
    raw_vector_rank: row.raw_vector_rank,
    baseline_rank: row.baseline_rank,
    material_id: row.material_id,
    chunk_id: row.chunk_id,
    original_name: row.original_name,
    material_type: row.material_type,
    corpus_scope: row.corpus_scope,
    chunk_role: row.chunk_role,
    source_role: row.source_role,
    source_role_reason: row.source_role_reason,
    citation_index_like: row.citation_index_like,
    substantive_candidate: row.substantive_candidate,
    source_excerpt: row.source_text ?? '',
    similarity: Number(row.similarity_score ?? row.raw_similarity ?? 0),
    source_lineage: {
      project_id: row.project_id,
      source_document_id: row.source_document_id,
      source_chunk_id: row.source_chunk_id,
      chunk_hash: row.chunk_hash,
      embedding_model: row.embedding_model,
      embedding_version: row.embedding_version,
      chunk_role_version: row.chunk_role_version,
      lifecycle_status: row.lifecycle_status,
      review_status: row.review_status,
      usage_status: row.usage_status,
      index_status: row.index_status
    },
    strategy
  };
}

function diagnostics(rows) {
  const materials = rows.map((row) => row.material_id).filter(Boolean);
  const counts = new Map();
  for (const material of materials) counts.set(material, (counts.get(material) || 0) + 1);
  return {
    top4_count: rows.length,
    heading_count_top4: rows.filter((row) => row.chunk_role === 'HEADING').length,
    citation_index_like_count_top4: rows.filter((row) => row.citation_index_like).length,
    same_material_max_count: counts.size ? Math.max(...counts.values()) : 0,
    unique_material_count: counts.size,
    substantive_count_top4: rows.filter((row) => row.substantive_candidate).length
  };
}

function sortedRows(rows) {
  return rows.slice().sort((a, b) => rawRankOf(a) - rawRankOf(b) || String(a.chunk_id).localeCompare(String(b.chunk_id)));
}

function hygieneCandidates(rawRows) {
  const annotated = sortedRows(rawRows.map(annotate));
  const substantive = annotated.filter((row) => row.substantive_candidate && !['HEADING', 'METADATA', 'FRONT_MATTER'].includes(row.chunk_role) && !row.citation_index_like);
  // Keep substantive candidates ahead of context-only fallbacks.  When the
  // captured pool has fewer than K substantive rows, fill the remaining
  // positions from the original rank order; this preserves a Top4 shape
  // without allowing context to outrank available substantive content.
  const fallback = annotated.filter((row) => !substantive.includes(row));
  const selectedPool = substantive.length ? [...substantive, ...fallback] : annotated;
  const excludedPool = substantive.length >= K ? fallback : [];
  return {
    annotated,
    substantivePool: substantive,
    selectedPool,
    excluded: excludedPool.map((row) => ({
      chunk_id: row.chunk_id,
      material_id: row.material_id,
      chunk_role: row.chunk_role,
      substantive_candidate: row.substantive_candidate,
      citation_index_like: row.citation_index_like,
      exclusion_reason: !row.substantive_candidate ? row.substantive_reason : (['HEADING', 'METADATA', 'FRONT_MATTER'].includes(row.chunk_role) ? 'CONTEXT_ROLE' : 'CITATION_INDEX_LIKE')
    }))
  };
}

function boundedMaterialDiversity(rows, limit = K, maxPerMaterial = 2) {
  const selected = [];
  const selectedIds = new Set();
  const counts = new Map();
  for (const row of rows) {
    if (selected.length >= limit) break;
    const count = counts.get(row.material_id) || 0;
    if (count >= maxPerMaterial) continue;
    selected.push(row);
    selectedIds.add(row.chunk_id);
    counts.set(row.material_id, count + 1);
  }
  if (selected.length < limit) {
    for (const row of rows) {
      if (selected.length >= limit) break;
      if (selectedIds.has(row.chunk_id)) continue;
      selected.push(row);
      selectedIds.add(row.chunk_id);
    }
  }
  return selected;
}

function tokens(text) {
  return new Set(normalize(text).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1));
}

function jaccard(a, b) {
  const left = tokens(a.source_text);
  const right = tokens(b.source_text);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection || 1);
}

function mmrProxy(rows, limit = K, lambda = LAMBDA) {
  const remaining = rows.slice();
  const selected = [];
  const hygieneEligible = (row) => row.substantive_candidate && !['HEADING', 'METADATA', 'FRONT_MATTER'].includes(row.chunk_role) && !row.citation_index_like;
  const primaryCount = remaining.filter(hygieneEligible).length;
  while (selected.length < limit && remaining.length) {
    const constrained = selected.length < Math.min(limit, primaryCount)
      ? remaining.filter(hygieneEligible)
      : remaining;
    if (!constrained.length) break;
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const row of constrained) {
      const redundancy = selected.length ? Math.max(...selected.map((item) => jaccard(row, item))) : 0;
      const score = lambda * Number(row.similarity_score ?? row.raw_similarity ?? 0) - (1 - lambda) * redundancy;
      const currentBest = remaining[bestIndex];
      if (score > bestScore || (score === bestScore && (rawRankOf(row) < rawRankOf(currentBest) || (rawRankOf(row) === rawRankOf(currentBest) && String(row.chunk_id).localeCompare(String(currentBest.chunk_id)) < 0)))) {
        bestIndex = remaining.indexOf(row);
        bestScore = score;
      }
    }
    const [winner] = remaining.splice(bestIndex, 1);
    selected.push(winner);
  }
  return selected;
}

function strategyResult(caseRecord, strategy, rows, meta = {}) {
  const compact = rows.slice(0, K).map((row, index) => compactRow(row, strategy, index + 1));
  return {
    case_id: caseRecord.case_id,
    query: caseRecord.query,
    section: { theme: caseRecord.theme, scope: caseRecord.scope, project_kind: caseRecord.project_kind },
    expected_doc_ids_for_mechanical_audit: caseRecord.expected_doc_ids,
    strategy,
    candidate_pool_count: caseRecord.raw_top20.length,
    top4: compact,
    diagnostics: diagnostics(rows.slice(0, K)),
    ...meta
  };
}

const caseRuns = referenceCases.map((caseRecord) => {
  const raw = sortedRows(caseRecord.raw_top20 || []);
  const current = (caseRecord.selected_topk || []).slice().sort((a, b) => rankOf(a) - rankOf(b) || String(a.chunk_id).localeCompare(String(b.chunk_id))).map(annotate);
  const hygiene = hygieneCandidates(raw);
  const A = strategyResult(caseRecord, 'A_CURRENT_BASELINE', current, { baseline_source: 'captured selected_topk' });
  const B = strategyResult(caseRecord, 'B_HYGIENE_ONLY', hygiene.selectedPool, {
    hygiene_version: 'retrieval-chunk-role-v1 + retrieval-substantive-v1 + deterministic citation-index-shape overlay',
    excluded_count: hygiene.excluded.length,
    excluded: hygiene.excluded
  });
  const C = strategyResult(caseRecord, 'C_HYGIENE_PLUS_BOUNDED_MATERIAL_DIVERSITY', boundedMaterialDiversity(hygiene.selectedPool), {
    hygiene_version: 'retrieval-chunk-role-v1 + retrieval-substantive-v1 + deterministic citation-index-shape overlay',
    material_concentration_cap: 2,
    diversity_is_challenger_only: true
  });
  const D = strategyResult(caseRecord, 'D_HYGIENE_PLUS_MMR_0_9', mmrProxy(hygiene.selectedPool), {
    hygiene_version: 'retrieval-chunk-role-v1 + retrieval-substantive-v1 + deterministic citation-index-shape overlay',
    mmr_lambda: LAMBDA,
    mmr_replay_mode: 'LEXICAL_REDUNDANCY_PROXY',
    true_vector_mmr_reproducible: false,
    limitation: 'Historical raw embedding vectors were not saved; this is a deterministic challenger proxy using persisted query similarity and token Jaccard redundancy. No production behavior changed.'
  });
  return { case_id: caseRecord.case_id, query: caseRecord.query, section: A.section, strategies: { A, B, C, D } };
});

function aggregate(strategyId) {
  const records = caseRuns.map((item) => item.strategies[strategyId]);
  const sum = (key) => records.reduce((total, item) => total + Number(item.diagnostics[key] || 0), 0);
  const expectedHit = records.filter((item) => item.top4.some((row) => item.expected_doc_ids_for_mechanical_audit.includes(row.original_name?.split('_')[0]) || item.expected_doc_ids_for_mechanical_audit.includes(row.original_name?.replace(/\.[^.]+$/, '')) || item.expected_doc_ids_for_mechanical_audit.includes(row.material_id))).length;
  const concentration = records.map((item) => item.diagnostics.same_material_max_count);
  const uniqueMaterials = records.map((item) => item.diagnostics.unique_material_count);
  return {
    case_count: records.length,
    top4_rows: sum('top4_count'),
    heading_count_top4: sum('heading_count_top4'),
    citation_index_like_count_top4: sum('citation_index_like_count_top4'),
    substantive_count_top4: sum('substantive_count_top4'),
    expected_doc_hit_at_4_count: expectedHit,
    expected_doc_hit_at_4_rate: expectedHit / records.length,
    max_same_material_count: concentration.length ? Math.max(...concentration) : 0,
    mean_same_material_max_count: concentration.reduce((a, b) => a + b, 0) / records.length,
    mean_unique_material_count: uniqueMaterials.reduce((a, b) => a + b, 0) / records.length,
    semantic_labels_created: 0
  };
}

const runtimeFiles = [
  'backend/src/pipeline/writer-reference-selector.js',
  'backend/src/pipeline/retrieval-chunk-role.js',
  'backend/src/pipeline/retrieval-substantive-candidate.js',
  'backend/src/pipeline/retrieval-source-eligibility.js',
  'backend/src/pipeline/material-source-authority-policy.js',
  'backend/src/db.js'
];

writeJson('01_REFERENCE_LANE_DENOMINATOR.json', {
  artifact_type: 'V43_REFERENCE_LANE_DENOMINATOR',
  audit_mode: 'OFFLINE_CAPTURED_RESULTS_OVERLAY',
  source_artifact: sourceRelativePath,
  source_sha256: sourceSha256,
  reference_case_ids: referenceCases.map((item) => item.case_id),
  reference_case_count: referenceCases.length,
  deferred_case_ids: deferredCases.map((item) => item.case_id),
  deferred_case_count: deferredCases.length,
  deferred_lane: 'EVIDENCE_RETRIEVAL_LANE',
  reference_denominator_policy: 'A01-A30 only; A31-A40 excluded from Reference usefulness/off-topic/redundancy denominator',
  requirement_field_status: 'NOT_CAPTURED_AS_SEPARATE_FIELD',
  semantic_labels_created: 0,
  provider_calls: 0,
  llm_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0
});

writeJson('02_WRITER_REFERENCE_PATH_AUDIT.json', {
  artifact_type: 'V43_WRITER_REFERENCE_PATH_AUDIT',
  audit_mode: 'READ_ONLY_CURRENT_DIRTY_WORKTREE',
  identity: {
    writer_entrypoint: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
    repository_entrypoint: 'backend/src/db.js::searchWriterReferenceChunks/listWriterReferenceChunks',
    source_role_owner: 'backend/src/pipeline/material-source-authority-policy.js',
    source_role_policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION,
    code_identities: Object.fromEntries(runtimeFiles.map((file) => [file, fileIdentity(file)]))
  },
  observed_reuse: {
    writer_material_type_filter: { status: 'REUSED', evidence: 'WriterReferenceSelector.WRITER_REFERENCE_MATERIAL_TYPES = technical_solution, technical_whitepaper' },
    writer_exact_chunk_hash_dedup: { status: 'REUSED', evidence: 'WriterReferenceSelector deduplicates rows by chunk_hash or material_id:chunk_id' },
    retrieval_chunk_role_eligibility: { status: 'NOT_REUSED_DIRECTLY', evidence: 'WriterReferenceSelector does not call retrieval-chunk-role.js; repository reference query does not expose a chunk-role filter' },
    substantive_content_filter: { status: 'NOT_REUSED_DIRECTLY', evidence: 'WriterReferenceSelector does not call retrieval-substantive-candidate.js' },
    source_role_policy: { status: 'INDIRECT_LIFECYCLE_ONLY', evidence: 'searchWriterReferenceChunks applies lifecycle/approval/usage/index predicates; explicit source-role projection is not performed in WriterReferenceSelector' },
    embedding_path: { status: 'REUSED', evidence: 'WriterReferenceSelector uses EmbeddingClient.embed then repository.searchWriterReferenceChunks when configured' }
  },
  authority_boundary: {
    reference_only: 'CONTEXT_ONLY',
    enterprise_assertion_authority: 'not granted by retrieval or WriterReferenceSelector',
    no_production_change: true
  },
  path_identity: 'CONFIRMED'
});

writeJson('03_REFERENCE_HYGIENE_POLICY.json', {
  artifact_type: 'V43_REFERENCE_HYGIENE_POLICY',
  authority: 'Eval-only challenger overlay; production owners remain unchanged',
  existing_owners: {
    chunk_role: 'backend/src/pipeline/retrieval-chunk-role.js::applyRetrievalChunkRole',
    substantive: 'backend/src/pipeline/retrieval-substantive-candidate.js::classifySubstantiveCandidate',
    source_eligibility: 'backend/src/pipeline/retrieval-source-eligibility.js::classifyEvidenceSourceEligibility',
    source_role: 'backend/src/pipeline/material-source-authority-policy.js::resolveMaterialSourceRole'
  },
  challenger_rules: [
    'Annotate captured raw_top20 candidates with the existing retrieval chunk-role/substantive/source-eligibility functions.',
    'When substantive candidates exist, exclude standalone HEADING, METADATA, FRONT_MATTER, non-substantive, and deterministic citation/index-shape candidates from the formal Top4 challenger pool while retaining their source lineage in the excluded audit.',
    'The citation/index-shape overlay is lexical content-shape telemetry only; it is not a semantic classifier and does not change source role or authority.',
    'Bounded material diversity challenger caps a material at two Top4 entries when alternatives exist; it falls back to the captured rank order to fill K.',
    'MMR 0.9 challenger uses persisted query similarity plus token-Jaccard redundancy proxy because raw embedding vectors are not present in the captured artifact.'
  ],
  production_mutations: 0,
  provider_calls: 0,
  db_writes: 0
});

for (const [filename, strategyId] of [['04_CURRENT_BASELINE_TOP4.json', 'A'], ['05_HYGIENE_ONLY_TOP4.json', 'B'], ['06_DIVERSITY_CHALLENGER_TOP4.json', 'C'], ['07_MMR_09_CHALLENGER_TOP4.json', 'D']]) {
  const metadata = strategyId === 'D' ? {
    challenger_only: true,
    mmr_lambda: LAMBDA,
    replay_mode: 'LEXICAL_REDUNDANCY_PROXY',
    true_vector_mmr_reproducible: false
  } : { challenger_only: strategyId !== 'A' };
  writeJson(filename, {
    artifact_type: `V43_REFERENCE_STRATEGY_${strategyId}_TOP4`,
    strategy_id: strategyId,
    final_k: K,
    source_artifact: sourceRelativePath,
    source_sha256: sourceSha256,
    reference_case_count: referenceCases.length,
    cases: caseRuns.map((item) => item.strategies[strategyId]),
    semantic_labels_created: 0,
    provider_calls: 0,
    db_writes: 0,
    ...metadata
  });
}

writeJson('08_STRATEGY_DELTA_MECHANICAL.json', {
  artifact_type: 'V43_REFERENCE_STRATEGY_DELTA_MECHANICAL',
  source_artifact: sourceRelativePath,
  source_sha256: sourceSha256,
  same_candidate_universe: true,
  final_k: K,
  strategies: {
    A_CURRENT_BASELINE: aggregate('A'),
    B_HYGIENE_ONLY: aggregate('B'),
    C_HYGIENE_PLUS_BOUNDED_MATERIAL_DIVERSITY: aggregate('C'),
    D_HYGIENE_PLUS_MMR_0_9: aggregate('D')
  },
  per_case: caseRuns.map((item) => {
    const out = { case_id: item.case_id };
    for (const strategy of ['A', 'B', 'C', 'D']) out[strategy] = item.strategies[strategy].diagnostics;
    return out;
  }),
  interpretation_boundary: 'Mechanical candidate-shape/rank deltas only; no semantic usefulness labels or strategy promotion.'
});

const anchorIds = ['A02', 'A03', 'A07', 'A14', 'A20', 'A21', 'A22', 'A23'];
writeJson('09_GPT_SEMANTIC_AB_REVIEW_PACKET.json', {
  artifact_type: 'V43_GPT_REFERENCE_STRATEGY_AB_REVIEW_PACKET',
  blind_to_semantic_labels: true,
  lane: 'REFERENCE_ONLY_A01_A30',
  final_k: K,
  case_count: referenceCases.length,
  regression_anchor_case_ids: anchorIds,
  review_instructions: [
    'Review only Reference Retrieval usefulness for strategies A/B/C/D using the supplied query, section context and Top4 source evidence.',
    'Do not treat Reference-only material as Enterprise Assertion Authority.',
    'Distinguish search failure from corpus absence and keep uncertain judgments as REVIEW_REQUIRED.',
    'The mechanical diagnostics are not semantic labels; do not infer a strategy winner from rank or similarity alone.'
  ],
  cases: caseRuns.map((item) => ({
    case_id: item.case_id,
    query: item.query,
    section: item.section,
    strategies: Object.fromEntries(Object.entries(item.strategies).map(([key, strategy]) => [key, {
      strategy: strategy.strategy,
      top4: strategy.top4,
      diagnostics: strategy.diagnostics,
      semantic_review: {
        useful_at_4: null,
        off_topic_rate: null,
        redundancy_rate: null,
        wrong_scope_rate: null,
        wrong_role_rate: null,
        corpus_gap: null,
        notes: null
      }
    }]))
  })),
  semantic_labels_created: 0,
  provider_calls: 0,
  db_writes: 0
});

const writerBoundaryPath = 'backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json';
const writerBoundary = JSON.parse(fs.readFileSync(path.join(repoRoot, writerBoundaryPath), 'utf8'));
writeJson('10_AUTHORITY_NEGATIVE_REGRESSION.json', {
  artifact_type: 'V43_REFERENCE_AUTHORITY_NEGATIVE_REGRESSION',
  source_role_owner: 'backend/src/pipeline/material-source-authority-policy.js',
  source_role_policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION,
  reference_context_rule: 'REFERENCE_ONLY remains context-only and cannot become Enterprise Assertion Authority.',
  inherited_existing_boundary_evidence: {
    artifact: writerBoundaryPath,
    artifact_sha256: fileHash(writerBoundaryPath),
    source_role_boundary: writerBoundary.source_role_boundary || null
  },
  checks: [
    { check_id: 'REFERENCE_ONLY_CONTEXT_ONLY', expected: 'PASS', status: 'INHERITED_EXISTING_ENGINEERING_REGRESSION' },
    { check_id: 'REFERENCE_TO_ENTERPRISE_ASSERTION', expected: 'FAIL_CLOSED', status: 'INHERITED_EXISTING_ENGINEERING_REGRESSION' },
    { check_id: 'FOREIGN_ENTERPRISE_CONTAMINATION', expected: 'FAIL_CLOSED', status: 'INHERITED_EXISTING_ENGINEERING_REGRESSION' },
    { check_id: 'REFERENCE_STRONG_FACT_PROMOTION', expected: 'FAIL_CLOSED', status: 'INHERITED_EXISTING_ENGINEERING_REGRESSION' }
  ],
  reference_to_enterprise_assertion_escape_count: 0,
  foreign_enterprise_contamination_escape_count: 0,
  note: 'This challenger performs no Writer generation; zero escape counts mean no authority-bearing conversion was executed or introduced by this Eval overlay.',
  provider_calls: 0,
  db_writes: 0,
  production_mutations: 0
});

const checkpoint = {
  artifact_type: 'V43_RAG_REFERENCE_HYGIENE_MMR_CHALLENGER_CHECKPOINT',
  status: 'READY_FOR_GPT_REFERENCE_STRATEGY_AB_ADJUDICATION',
  source_artifact: sourceRelativePath,
  source_sha256: sourceSha256,
  reference_denominator: { A01_A30: 30, deferred_A31_A40: 10, deferred_lane: 'EVIDENCE_RETRIEVAL_LANE' },
  strategies: { A: aggregate('A'), B: aggregate('B'), C: aggregate('C'), D: aggregate('D') },
  mmr: { lambda: LAMBDA, challenger_only: true, true_vector_reproducible: false, proxy: 'token_jaccard_redundancy_with_persisted_similarity' },
  semantic_review: { packet: '09_GPT_SEMANTIC_AB_REVIEW_PACKET.json', labels_created: 0, status: 'PENDING_GPT_HUMAN_REVIEW' },
  authority_boundary: { reference_to_enterprise_assertion_escape_count: 0, inherited_regression: '10_AUTHORITY_NEGATIVE_REGRESSION.json' },
  implementation: { production_changes: 0, production_strategy_promotion: 0, new_schema: 0, new_migration: 0 },
  side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, fact: 0, mapping: 0, claim: 0, writer_generation: 0, gold_mutations: 0 }
};
writeJson('11_CHECKPOINT.json', checkpoint);

const markdown = [
  '# V43 RAG Reference Hygiene + MMR Challenger V1',
  '',
  `- Status: \`${checkpoint.status}\``,
  `- Reference denominator: A01-A30 (30); A31-A40 deferred to Evidence Retrieval lane.`,
  `- Captured source: ${sourceRelativePath} (${sourceSha256})`,
  `- Strategies: A current baseline, B hygiene-only, C bounded material diversity, D MMR 0.9 challenger.`,
  `- MMR note: raw embedding vectors are not stored; D is a deterministic lexical redundancy proxy, not a production MMR implementation.`,
  `- GPT packet: 30 cases, semantic labels created: 0.`,
  `- Side effects: Provider/LLM/DB/Gold/Fact/Mapping/Claim/Writer actions all 0.`,
  '',
  '## Mechanical strategy aggregates',
  '',
  '```json',
  JSON.stringify(checkpoint.strategies, null, 2),
  '```',
  '',
  '## Boundary',
  '',
  'Reference-only material remains context-only. No strategy was promoted and no production behavior changed.',
  '',
  'READY_FOR_GPT_REFERENCE_STRATEGY_AB_ADJUDICATION',
  ''
].join('\n');
fs.writeFileSync(path.join(outputDir, '11_CHECKPOINT.md'), markdown, 'utf8');

console.log(JSON.stringify({
  outputDir,
  reference_cases: referenceCases.length,
  deferred_cases: deferredCases.length,
  top4_rows_by_strategy: Object.fromEntries(Object.entries(checkpoint.strategies).map(([key, value]) => [key, value.top4_rows])),
  semantic_labels_created: 0,
  provider_calls: 0,
  db_writes: 0,
  status: checkpoint.status
}, null, 2));
