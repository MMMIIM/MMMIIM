import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deduplicateRankedEvidenceCandidates,
  isStructuralOnlyEvidenceText,
  profileAwareHierarchicalProjection
} from '../../src/evidence-search-orchestrator.js';
import { buildEvidenceNeedProfile } from '../../src/evidence-need-profile-builder.js';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SNAPSHOT_DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.json`);
const PACKET_JSON_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.profile-aware-review-packet.json`);
const PACKET_MD_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.profile-aware-review-packet.md`);
const ROUTER_PATH = path.join(REPO, 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const AUTHORITY = 'SYNTHETIC_EVAL_ONLY';
const PRODUCTION_AUTHORITY = 'NONE';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const EXPECTED_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EXPECTED_VERSION = '1';
const EXPECTED_DIMENSION = 1024;
const REQUIREMENT_IDS = Object.freeze(['JY-001:REQ-057', 'FAST-01:REQ-005', 'FAST-04:REQ-004']);
const TOP_K = 5;

const LITERAL_TERMS = Object.freeze({
  'JY-001:REQ-057': ['事件', '标准化', '标准库', '字段', '规则匹配', '联动', '接口', '接口规范'],
  'FAST-01:REQ-005': ['性能', '性能降低', '响应', '延迟', '吞吐', '容量', '优化', '处理变慢'],
  'FAST-04:REQ-004': ['项目经理', '技术负责人', '本科', '10年', '5年', '信息系统项目管理师', '系统集成项目管理工程师', 'CISP', '系统规划与管理师', '系统架构设计师', 'CCRC']
});

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const text = value => String(value ?? '').trim();
const json = value => JSON.stringify(value, null, 2) + '\n';
const keyOf = item => `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });
const semanticScore = item => Number(item.similarity_score ?? item.semantic_score ?? item.score ?? item.similarity ?? 0);

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function sourceIdentityHash(sources) {
  const rows = sources.flatMap(source => source.chunks.map(chunk => ({
    material_id: chunk.material_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash
  })));
  return sha256(JSON.stringify(rows));
}

function assertVector(vector, label) {
  if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMENSION || vector.some(value => !Number.isFinite(value))) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_INVALID', { label, observed_dimension: Array.isArray(vector) ? vector.length : null });
  }
}

function assertSnapshot(snapshot) {
  const manifest = snapshot?.manifest;
  if (manifest?.snapshot_id !== SNAPSHOT_ID
    || manifest?.enterprise_id !== ENTERPRISE_ID
    || manifest?.authority !== AUTHORITY
    || manifest?.production_authority !== PRODUCTION_AUTHORITY
    || manifest?.material_count !== 9
    || manifest?.chunk_count !== 94
    || manifest?.identity_hash !== EXPECTED_IDENTITY_HASH
    || manifest?.embedding_model !== EXPECTED_MODEL
    || String(manifest?.embedding_version) !== EXPECTED_VERSION
    || Number(manifest?.vector_dimension) !== EXPECTED_DIMENSION
    || !Array.isArray(snapshot?.vectors) || snapshot.vectors.length !== 94
    || !Array.isArray(snapshot?.query_vectors) || snapshot.query_vectors.length !== 3) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_SNAPSHOT_INVALID', {
      snapshot_id: manifest?.snapshot_id || null,
      identity_hash: manifest?.identity_hash || null,
      vector_count: snapshot?.vectors?.length || 0,
      query_vector_count: snapshot?.query_vectors?.length || 0
    });
  }
  for (const row of snapshot.vectors) {
    if (row.enterprise_id !== ENTERPRISE_ID || row.source_role !== 'EVIDENCE_CANDIDATE' || row.authority !== AUTHORITY || row.production_authority !== PRODUCTION_AUTHORITY
      || row.embedding_model !== EXPECTED_MODEL || String(row.embedding_version) !== EXPECTED_VERSION || Number(row.vector_dimension) !== EXPECTED_DIMENSION) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_IDENTITY_INVALID', { chunk_id: row.chunk_id });
    }
    assertVector(row.vector, `chunk:${row.chunk_id}`);
  }
  for (const row of snapshot.query_vectors) {
    if (!REQUIREMENT_IDS.includes(row.requirement_id) || row.snapshot_id !== SNAPSHOT_ID || row.embedding_model !== EXPECTED_MODEL
      || String(row.embedding_version) !== EXPECTED_VERSION || Number(row.vector_dimension) !== EXPECTED_DIMENSION) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_QUERY_VECTOR_IDENTITY_INVALID', { requirement_id: row.requirement_id || null });
    }
    assertVector(row.vector, `query:${row.requirement_id}`);
  }
}

function loadQuerySpecifications(sources) {
  const router = JSON.parse(readFileSync(ROUTER_PATH, 'utf8'));
  const projectId = sources[0]?.project_id || null;
  return REQUIREMENT_IDS.map(requirementId => {
    const row = (router.rows || []).find(item => item.requirement_id === requirementId);
    if (!row || !text(row.requirement_text)) throw fail('EVIDENCE_SEARCH_CANONICAL_REQUIREMENT_NOT_FOUND', { requirement_id: requirementId });
    const requirement = { requirement_id: requirementId, text: row.requirement_text, project_id: projectId };
    const profile = buildEvidenceNeedProfile({
      requirement,
      responseDecision: {
        response_mode: row.v223?.response_mode || 'NEED_REVIEW',
        risk_tier: row.v223?.risk_tier || 'HIGH',
        response_required: row.v223?.response_required
      },
      enterpriseId: ENTERPRISE_ID
    });
    return { requirement, profile, query_text: row.requirement_text, query_hash: sha256(row.requirement_text) };
  });
}

function sourceIndex(sources) {
  return new Map(sources.flatMap(source => source.chunks.map(chunk => [keyOf({
    material_id: chunk.material_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash
  }), {
    ...chunk,
    doc_id: source.doc_id,
    original_name: source.original_name,
    source_file: source.source_file,
    material_type: source.material_type,
    source_role: source.source_role,
    enterprise_id: source.enterprise_id,
    semantic_review_status: source.semantic_review_status
  }])));
}

function sourceFor(sourceByKey, row) {
  const source = sourceByKey.get(keyOf(row));
  if (!source) throw fail('BLOCKED_EVIDENCE_SEARCH_SOURCE_LINEAGE_MISSING', { chunk_id: row.chunk_id, chunk_hash: row.chunk_hash });
  return source;
}

function candidate(sourceByKey, row, requirementId, profileHash, searchRunId, rank, similarity = row.similarity) {
  const source = sourceFor(sourceByKey, row);
  return {
    requirement_id: requirementId,
    rank,
    semantic_score: Number(similarity.toFixed(12)),
    similarity: Number(similarity.toFixed(12)),
    profile_rerank_contribution: row.profile_rerank_contribution || null,
    rerank_score: row.rerank_score ?? null,
    material_id: row.material_id,
    material_logical_identity: { com_id: source.doc_id, original_name: source.original_name, source_file: source.source_file },
    material_type: source.material_type,
    discovery_anchor_chunk_id: row.discovery_anchor_chunk_id || null,
    final_evidence_chunk_id: row.final_evidence_chunk_id || row.chunk_id,
    chunk_id: row.chunk_id,
    chunk_hash: row.chunk_hash,
    source_role: row.source_role,
    enterprise_id: row.enterprise_id,
    source_span: `${row.chunk_id}:FULL`,
    exact_substantive_source_text: source.source_text,
    search_run_id: searchRunId,
    profile_hash: profileHash
  };
}

function literalPresenceAudit(sources) {
  return Object.fromEntries(REQUIREMENT_IDS.map(requirementId => {
    const terms = LITERAL_TERMS[requirementId];
    const termResults = terms.map(term => {
      const hits = [];
      const normalizedTerm = term.toLocaleLowerCase();
      for (const source of sources) {
        for (const chunk of source.chunks) {
          const sourceText = String(chunk.source_text || '');
          const normalizedSource = sourceText.toLocaleLowerCase();
          let offset = normalizedSource.indexOf(normalizedTerm);
          while (offset >= 0) {
            const start = Math.max(0, offset - 80);
            const end = Math.min(sourceText.length, offset + term.length + 80);
            hits.push({
              material_id: source.material_id,
              material_com_id: source.doc_id,
              chunk_id: chunk.chunk_id,
              chunk_hash: chunk.chunk_hash,
              source_span: `${chunk.chunk_id}:FULL`,
              hit_offset: offset,
              exact_source_excerpt: sourceText.slice(start, end)
            });
            offset = normalizedSource.indexOf(normalizedTerm, offset + normalizedTerm.length);
          }
        }
      }
      return { literal: term, hit_count: hits.length, hits };
    });
    return [requirementId, { terms: termResults, any_hit_count: termResults.reduce((sum, item) => sum + item.hit_count, 0) }];
  }));
}

function baselineRankedRows(rows, queryVector) {
  return rows
    .map(row => ({ ...row, similarity: cosine(queryVector, row.vector) }))
    .sort((left, right) => right.similarity - left.similarity || keyOf(left).localeCompare(keyOf(right)));
}

function buildMarkdown(packet) {
  const lines = [
    '# V43 Evidence Search Profile-Aware Hierarchical Retrieval Review Packet',
    '',
    `Status: ${packet.status}`,
    `Snapshot: ${packet.snapshot_id}`,
    `Mode: ${packet.retrieval_mode}`,
    '',
    'This is a mechanical retrieval review packet. It assigns no Fact truth, Mapping relationship, Claim eligibility, support label, or Gold label.',
    '',
    `Phase A profile consumption before fix: ${packet.phase_a.profile_consumption}`,
    `Phase B profile consumption after fix: ${packet.phase_b.profile_consumption}`,
    `Frozen structural-only chunks: ${packet.phase_a.structural_chunk_audit.total.structural_only_count}; substantive chunks: ${packet.phase_a.structural_chunk_audit.total.substantive_count}`,
    ''
  ];
  for (const result of packet.requirements) {
    const profile = result.evidence_need_profile;
    lines.push(`## ${result.requirement_id}`, '', `Canonical Requirement: ${result.canonical_requirement_text}`, '');
    lines.push(`EvidenceNeedProfile: ${profile.class}; required=${profile.required_dimensions.join(', ') || 'none'}; conditional=${profile.conditional_dimensions.join(', ') || 'none'}`);
    lines.push(`Search signals: ${profile.search_signals.join(', ') || 'none'}`);
    lines.push(`Critical literals: ${profile.critical_literals.join(', ') || 'none'}`);
    lines.push(`Profile hash: ${profile.profile_hash}`, `Search query: ${result.search_query_text}`, `Search query hash: ${result.search_query_hash}`, '');
    lines.push(`Raw candidates: ${result.raw_candidate_count}; raw Top-K: ${result.raw_top_k.length}; duplicate groups: ${result.content_duplicate_groups.length}; final duplicate candidates: ${result.final_duplicate_candidate_count}; final Top-K: ${result.final_top_k.length}`);
    lines.push(`Structural-only raw/final(post-fix): ${result.structural_only_raw_top_k_count}/${result.structural_only_final_top_k_count}`, `Duplicate removals: ${result.duplicate_candidates_removed_total}; recovered slots: ${result.slots_recovered_by_chunk_hash_dedup}; material diversity: ${result.material_diversity}`, '');
    lines.push('Final Top-K:');
    for (const row of result.final_top_k) {
      lines.push(`- ${row.rank}. ${row.material_logical_identity.com_id}/${row.material_id} ${row.chunk_id} semantic=${row.semantic_score} rerank=${row.rerank_score} anchor=${row.discovery_anchor_chunk_id || 'none'} hash=${row.chunk_hash}`);
      lines.push(`  Exact substantive source: ${row.exact_substantive_source_text}`);
    }
    lines.push('');
  }
  lines.push('## Safety gates', '', `Reference-only escape: ${packet.reference_only_escape}`, `Cross-enterprise escape: ${packet.cross_enterprise_escape}`, `Quarantine escape: ${packet.quarantine_escape}`, `K=0 count: ${packet.k0_count}`, `Search-run lineage complete: ${packet.search_run_lineage_complete}`, '', 'Side effects: Provider 0; Embedding 0; Fact 0; Mapping 0; Claim 0; Writer 0; Production DB writes 0; Eval DB writes 0; Gold mutations 0.');
  return lines.join('\n') + '\n';
}

async function run() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  assertSnapshot(snapshot);
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  if (sources.length !== 9 || sourceIdentityHash(sources) !== EXPECTED_IDENTITY_HASH) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_SOURCE_IDENTITY_PARITY', { material_count: sources.length, identity_hash: sourceIdentityHash(sources) });
  }
  const sourceByKey = sourceIndex(sources);
  const queries = loadQuerySpecifications(sources);
  const eligibleRows = snapshot.vectors.filter(row => sourceByKey.has(keyOf(row)) && row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID && text(sourceByKey.get(keyOf(row)).semantic_review_status).toUpperCase() !== 'QUARANTINED');
  const totalStructuralOnly = eligibleRows.filter(row => isStructuralOnlyEvidenceText(sourceByKey.get(keyOf(row)).source_text)).length;
  const totalSubstantive = eligibleRows.length - totalStructuralOnly;
  const literalAudit = literalPresenceAudit(sources);
  const requirements = [];
  for (const query of queries) {
    const queryRow = snapshot.query_vectors.find(row => row.requirement_id === query.requirement.requirement_id);
    if (!queryRow || queryRow.query_hash !== query.query_hash || queryRow.profile_hash !== query.profile.profile_hash) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_QUERY_VECTOR_METADATA_MISMATCH', { requirement_id: query.requirement.requirement_id });
    }
    const semanticRanked = baselineRankedRows(eligibleRows, queryRow.vector);
    const rawTopK = semanticRanked.slice(0, TOP_K).map((row, index) => candidate(sourceByKey, row, query.requirement.requirement_id, query.profile.profile_hash, 'BASELINE-SEMANTIC', index + 1));
    const baselineContentDedup = deduplicateRankedEvidenceCandidates(semanticRanked);
    const baselineFinal = baselineContentDedup.retained.slice(0, TOP_K).map((row, index) => candidate(sourceByKey, row, query.requirement.requirement_id, query.profile.profile_hash, 'BASELINE-CONTENT-DEDUP', index + 1));
    const hierarchical = profileAwareHierarchicalProjection(semanticRanked.map(row => ({
      ...row,
      semantic_score: row.similarity,
      source_text: sourceByKey.get(keyOf(row)).source_text,
      material_type: sourceByKey.get(keyOf(row)).material_type
    })), query.profile, { limit: TOP_K });
    const profileContentDedup = deduplicateRankedEvidenceCandidates(hierarchical.projected);
    const searchRunId = `ESEARCH-${sha256(`${SNAPSHOT_ID}|${query.requirement.requirement_id}|${query.profile.profile_hash}|PROFILE_AWARE_HIERARCHICAL`).slice(0, 24).toUpperCase()}`;
    const finalTopK = profileContentDedup.retained.slice(0, TOP_K).map((row, index) => candidate(sourceByKey, row, query.requirement.requirement_id, query.profile.profile_hash, searchRunId, index + 1, semanticScore(row)));
    const rawTopKUniqueContentCount = new Set(rawTopK.map(row => row.chunk_hash)).size;
    const finalDuplicateCandidateCount = finalTopK.length - new Set(finalTopK.map(row => row.chunk_hash)).size;
    const duplicateCandidatesRemovedTotal = profileContentDedup.duplicate_groups.reduce((sum, group) => sum + group.removed_count, 0);
    const materialDiversity = new Set(finalTopK.map(row => row.material_id)).size;
    requirements.push({
      requirement_id: query.requirement.requirement_id,
      canonical_requirement_text: query.requirement.text,
      evidence_need_profile: {
        class: query.profile.evidence_need_class,
        required_dimensions: query.profile.required_dimensions,
        conditional_dimensions: query.profile.conditional_dimensions,
        search_signals: query.profile.search_signals,
        critical_literals: query.profile.critical_literals,
        profile_hash: query.profile.profile_hash
      },
      profile_consumption_trace: {
        class_used_in_material_type_prior: true,
        required_dimensions_used_for_ranking: false,
        conditional_dimensions_used_for_ranking: false,
        search_signals_used_for_literal_supplement: true,
        critical_literals_used_for_literal_supplement: true,
        query_text_remains_canonical_requirement_text: true
      },
      search_query_text: query.query_text,
      search_query_hash: query.query_hash,
      search_run_id: searchRunId,
      raw_candidate_count: semanticRanked.length,
      raw_top_k: rawTopK,
      baseline_content_dedup_final_top_k: baselineFinal,
      content_duplicate_groups: profileContentDedup.duplicate_groups.map(group => ({
        chunk_hash: group.chunk_hash,
        retained_candidate: candidate(sourceByKey, group.retained_candidate, query.requirement.requirement_id, query.profile.profile_hash, searchRunId, null, semanticScore(group.retained_candidate)),
        removed_candidates: group.removed_candidates.map(row => candidate(sourceByKey, row, query.requirement.requirement_id, query.profile.profile_hash, searchRunId, null, semanticScore(row))),
        removed_count: group.removed_count
      })),
      material_discovery: hierarchical.material_discovery,
      profile_projected_candidate_count: hierarchical.projected.length,
      deduplicated_candidate_count: profileContentDedup.retained.length,
      final_top_k: finalTopK,
      candidate_count: semanticRanked.length,
      structural_candidate_count: hierarchical.structural_only_count,
      substantive_candidate_count: hierarchical.substantive_count,
      structural_only_raw_top_k_count: rawTopK.filter(row => isStructuralOnlyEvidenceText(row.exact_substantive_source_text)).length,
      structural_only_baseline_final_top_k_count: baselineFinal.filter(row => isStructuralOnlyEvidenceText(row.exact_substantive_source_text)).length,
      structural_only_final_top_k_count: finalTopK.filter(row => isStructuralOnlyEvidenceText(row.exact_substantive_source_text)).length,
      duplicate_candidates_removed_total: duplicateCandidatesRemovedTotal,
      final_duplicate_candidate_count: finalDuplicateCandidateCount,
      duplicate_removed_count: duplicateCandidatesRemovedTotal,
      final_duplicate_count: finalDuplicateCandidateCount,
      material_diversity: materialDiversity,
      top_k_material_ids: finalTopK.map(row => row.material_id),
      top_k_chunk_ids: finalTopK.map(row => row.chunk_id),
      similarity_scores: finalTopK.map(row => row.similarity),
      profile_rerank_contributions: finalTopK.map(row => row.profile_rerank_contribution),
      raw_top_k_unique_content_count: rawTopKUniqueContentCount,
      slots_recovered_by_chunk_hash_dedup: Math.max(0, finalTopK.length - rawTopKUniqueContentCount),
      k0: finalTopK.length === 0,
      search_run_lineage_complete: finalTopK.every(row => row.requirement_id && Number.isInteger(row.rank) && Number.isFinite(row.semantic_score) && Number.isFinite(row.rerank_score) && row.material_id && row.material_logical_identity?.com_id && row.material_type && row.discovery_anchor_chunk_id !== undefined && row.final_evidence_chunk_id && row.chunk_id && row.chunk_hash && row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID && row.source_span && row.exact_substantive_source_text && row.search_run_id && row.profile_hash)
    });
  }
  const packet = {
    status: 'EVIDENCE_SEARCH_PROFILE_AWARE_HIERARCHICAL_RETRIEVAL_READY',
    packet_type: 'V43_EVIDENCE_SEARCH_PROFILE_AWARE_HIERARCHICAL_RETRIEVAL_V1',
    snapshot_id: SNAPSHOT_ID,
    snapshot_path: SNAPSHOT_PATH,
    packet_json_path: PACKET_JSON_PATH,
    packet_markdown_path: PACKET_MD_PATH,
    retrieval_mode: 'LOCAL_PERSISTED_FROZEN_VECTOR_SNAPSHOT_PROFILE_AWARE_HIERARCHICAL',
    top_k_limit: TOP_K,
    profile_consumption: 'PARTIAL',
    semantic_labels_assigned: false,
    phase_a: {
      profile_consumption: 'METADATA_ONLY',
      profile_consumption_trace: {
        builder_fields_created: ['class', 'required_dimensions', 'conditional_dimensions', 'search_signals', 'critical_literals', 'profile_hash'],
        query_construction: 'search_query_text equals canonical_requirement_text',
        ranking_consumption_before_fix: ['profile_hash identity validation only'],
        unused_for_ranking_before_fix: ['class', 'required_dimensions', 'conditional_dimensions', 'search_signals', 'critical_literals']
      },
      structural_chunk_audit: {
        total: { total: eligibleRows.length, structural_only_count: totalStructuralOnly, substantive_count: totalSubstantive },
        per_requirement: Object.fromEntries(requirements.map(result => [result.requirement_id, {
          raw_top_k_structural_only_count: result.structural_only_raw_top_k_count,
          baseline_content_dedup_final_top_k_structural_only_count: result.structural_only_baseline_final_top_k_count,
          post_fix_final_top_k_structural_only_count: result.structural_only_final_top_k_count
        }]))
      },
      literal_presence_audit: literalAudit
    },
    phase_b: {
      profile_consumption: 'PARTIAL',
      ranking_policy: {
        semantic_similarity_primary: true,
        soft_material_type_prior: true,
        bounded_critical_literal_supplement: true,
        structural_chunks_discover_material_only: true,
        substantive_chunks_only_in_final_top_k: true,
        similarity_threshold_added: false,
        llm_reranker_added: false
      }
    },
    requirements,
    k0_count: requirements.filter(result => result.k0).length,
    duplicate_candidates_removed_total: requirements.reduce((sum, result) => sum + result.duplicate_candidates_removed_total, 0),
    final_duplicate_candidate_count: requirements.reduce((sum, result) => sum + result.final_duplicate_candidate_count, 0),
    reference_only_escape: snapshot.vectors.filter(row => row.source_role !== 'EVIDENCE_CANDIDATE').length,
    cross_enterprise_escape: snapshot.vectors.filter(row => row.enterprise_id !== ENTERPRISE_ID).length,
    quarantine_escape: snapshot.vectors.filter(row => text(sourceByKey.get(keyOf(row))?.semantic_review_status).toUpperCase() === 'QUARANTINED').length,
    search_run_lineage_complete: requirements.every(result => result.search_run_lineage_complete),
    embedding_calls: 0,
    provider_calls: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0
  };
  await writeFile(PACKET_JSON_PATH, json(packet), 'utf8');
  await writeFile(PACKET_MD_PATH, buildMarkdown(packet), 'utf8');
  console.log(JSON.stringify(packet, null, 2));
}

run().catch(error => {
  console.log(JSON.stringify({
    status: error.code || 'BLOCKED_EVIDENCE_SEARCH_PROFILE_AWARE_REPLAY',
    details: error.details || { message: error.message || 'UNKNOWN_LOCAL_REPLAY_ERROR' },
    embedding_calls: 0,
    provider_calls: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
  process.exitCode = 1;
});
