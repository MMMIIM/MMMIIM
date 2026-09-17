import { createHash, randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import {
  materialAuthorityAllowedForMode,
  materialAuthorityStatus
} from './pipeline/material-source-authority-policy.js';
import { classifyEnterpriseChunkQuality } from './pipeline/enterprise-material-chunker.js';

export const EVIDENCE_SEARCH_ORCHESTRATOR_VERSION = 'evidence-search-orchestrator-v1';

const text = value => String(value ?? '').trim();
const sha = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
export const EVIDENCE_PROFILE_CLASSES = Object.freeze(['PRODUCT_CAPABILITY', 'PERFORMANCE', 'QUALIFICATION', 'PERSONNEL', 'PROJECT_CASE', 'SERVICE_CAPABILITY', 'OTHER_EVIDENCE']);
const PROFILE_CLASSES = new Set(EVIDENCE_PROFILE_CLASSES);
export const EVIDENCE_PROFILE_CLASS_PRIOR_TYPES = Object.freeze({
  PRODUCT_CAPABILITY: ['product', 'documentation', 'project_case', 'technical', 'integration', 'delivery'],
  PERFORMANCE: ['performance', 'test', 'capacity', 'benchmark', 'delivery'],
  QUALIFICATION: ['qualification', 'credential', 'certificate', 'personnel', 'license'],
  PERSONNEL: ['personnel', 'qualification', 'credential', 'certificate'],
  PROJECT_CASE: ['project_case', 'case', 'delivery'],
  SERVICE_CAPABILITY: ['service', 'delivery', 'support', 'maintenance'],
  OTHER_EVIDENCE: []
});
// Fixed bounded supplements: semantic similarity remains the primary signal;
// these values are not a threshold and are not tuned to a particular case.
const PROFILE_CLASS_WEIGHT = 0.02;
const PROFILE_LITERAL_WEIGHT = 0.005;
const PROFILE_SIGNAL_WEIGHT = 0.002;
export const EVIDENCE_PROFILE_RERANK_WEIGHTS = Object.freeze({ class: PROFILE_CLASS_WEIGHT, critical_literal: PROFILE_LITERAL_WEIGHT, search_signal: PROFILE_SIGNAL_WEIGHT });
const uniqueByIdentity = values => {
  const seen = new Set();
  return values.filter(item => {
    const key = `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function isStructuralOnlyEvidenceText(value) {
  return classifyEnterpriseChunkQuality(value).chunk_role === 'STRUCTURAL_ONLY';
}

function contains(source, value) {
  return Boolean(text(value) && text(source).toLocaleLowerCase().includes(text(value).toLocaleLowerCase()));
}

export function calculateEvidenceProfileRerankContribution(item = {}, profile = {}) {
  const evidenceClass = text(profile.evidence_need_class || profile.class).toUpperCase();
  const materialType = text(item.material_type).toLowerCase();
  const preferredTypes = EVIDENCE_PROFILE_CLASS_PRIOR_TYPES[evidenceClass] || [];
  const materialTypePrior = preferredTypes.some(type => materialType.includes(type)) ? PROFILE_CLASS_WEIGHT : 0;
  const criticalLiterals = [...new Set((profile.critical_literals || []).map(text).filter(Boolean))];
  const searchSignals = [...new Set((profile.search_signals || []).map(text).filter(signal => signal && !PROFILE_CLASSES.has(signal.toUpperCase()) && !criticalLiterals.includes(signal)))];
  const matchedCriticalLiterals = criticalLiterals.filter(literal => contains(item.source_text, literal));
  const matchedSearchSignals = searchSignals.filter(signal => contains(item.source_text, signal));
  const criticalLiteralMatch = Math.min(0.03, matchedCriticalLiterals.length * PROFILE_LITERAL_WEIGHT);
  const searchSignalMatch = Math.min(0.01, matchedSearchSignals.length * PROFILE_SIGNAL_WEIGHT);
  const total = Number((materialTypePrior + criticalLiteralMatch + searchSignalMatch).toFixed(6));
  return {
    material_type_prior: Number(materialTypePrior.toFixed(6)),
    critical_literal_match: Number(criticalLiteralMatch.toFixed(6)),
    search_signal_match: Number(searchSignalMatch.toFixed(6)),
    total,
    matched_critical_literals: matchedCriticalLiterals,
    matched_search_signals: matchedSearchSignals
  };
}

function semanticScore(item) {
  return Number(item.similarity_score ?? item.semantic_score ?? item.score ?? item.similarity ?? 0);
}

function stableScoreOrder(left, right) {
  return right.rerank_score - left.rerank_score
    || semanticScore(right) - semanticScore(left)
    || `${left.material_id}|${left.chunk_id}|${left.chunk_hash}`.localeCompare(`${right.material_id}|${right.chunk_id}|${right.chunk_hash}`)
    || left._source_order - right._source_order;
}

/**
 * Hierarchical Eval projection. Structural rows can discover a material but
 * only substantive sibling rows are returned as evidence-span candidates.
 */
export function profileAwareHierarchicalProjection(values = [], profile = {}, { limit = 5 } = {}) {
  const scored = (Array.isArray(values) ? values : []).map((item, index) => {
    const contribution = calculateEvidenceProfileRerankContribution(item, profile);
    return {
      ...item,
      semantic_score: semanticScore(item),
      profile_rerank_contribution: contribution,
      rerank_score: Number((semanticScore(item) + contribution.total).toFixed(6)),
      structural_only: isStructuralOnlyEvidenceText(item.source_text),
      _source_order: index
    };
  });
  const materials = new Map();
  for (const row of scored) {
    const materialKey = text(row.material_id);
    if (!materials.has(materialKey)) materials.set(materialKey, []);
    materials.get(materialKey).push(row);
  }
  const discovery = [...materials.entries()].map(([materialId, rows]) => {
    const ordered = [...rows].sort(stableScoreOrder);
    const anchor = ordered[0];
    const substantive = ordered.filter(row => !row.structural_only);
    return {
      material_id: materialId,
      discovery_anchor_chunk_id: anchor?.chunk_id || null,
      discovery_anchor_structural_only: Boolean(anchor?.structural_only),
      discovery_anchor_semantic_score: anchor ? semanticScore(anchor) : null,
      discovery_anchor_rerank_score: anchor?.rerank_score ?? null,
      substantive_chunk_count: substantive.length,
      rows: substantive.sort(stableScoreOrder)
    };
  }).filter(item => item.rows.length > 0).sort((left, right) => right.discovery_anchor_rerank_score - left.discovery_anchor_rerank_score
    || String(left.material_id).localeCompare(String(right.material_id)));

  // Round-robin within discovery order preserves material breadth while still
  // selecting each material's best substantive chunk first.
  const projected = [];
  const maxRows = Math.max(0, ...discovery.map(item => item.rows.length));
  for (let offset = 0; offset < maxRows; offset += 1) {
    for (const material of discovery) {
      const row = material.rows[offset];
      if (!row) continue;
      projected.push({
        ...row,
        discovery_anchor_chunk_id: material.discovery_anchor_structural_only && material.discovery_anchor_chunk_id !== row.chunk_id
          ? material.discovery_anchor_chunk_id : null,
        final_evidence_chunk_id: row.chunk_id
      });
    }
  }
  return {
    projected,
    material_discovery: discovery.map(item => ({
      material_id: item.material_id,
      discovery_anchor_chunk_id: item.discovery_anchor_chunk_id,
      discovery_anchor_structural_only: item.discovery_anchor_structural_only,
      discovery_anchor_semantic_score: item.discovery_anchor_semantic_score,
      discovery_anchor_rerank_score: item.discovery_anchor_rerank_score,
      substantive_chunk_count: item.substantive_chunk_count
    })),
    structural_only_count: scored.filter(item => item.structural_only).length,
    substantive_count: scored.filter(item => !item.structural_only).length
  };
}

/**
 * Keep the repository's ranked order and collapse only exact canonical
 * content duplicates. The first row for a chunk_hash is the highest-ranked
 * row because the repository owns ranking and deterministic tie ordering.
 */
export function deduplicateRankedEvidenceCandidates(values = []) {
  const candidates = Array.isArray(values) ? values : [];
  const retained = [];
  const groups = new Map();
  for (const item of candidates) {
    const chunkHash = text(item?.chunk_hash);
    if (!chunkHash) {
      retained.push(item);
      continue;
    }
    const group = groups.get(chunkHash);
    if (group) {
      group.removed_candidates.push(item);
      continue;
    }
    groups.set(chunkHash, {
      chunk_hash: chunkHash,
      retained_candidate: item,
      removed_candidates: []
    });
    retained.push(item);
  }
  return {
    retained,
    duplicate_groups: [...groups.values()]
      .filter(group => group.removed_candidates.length > 0)
      .map(group => ({
        chunk_hash: group.chunk_hash,
        retained_candidate: group.retained_candidate,
        removed_candidates: group.removed_candidates,
        removed_count: group.removed_candidates.length
      }))
  };
}

function evidenceGap(status, extra = {}) {
  return {
    status,
    derived_only: true,
    creates_authority: false,
    means: status === 'NO_EVIDENCE_FOUND' ? 'NO_SUFFICIENT_EVIDENCE_FOUND' : null,
    means_enterprise_lacks_capability: false,
    ...extra
  };
}

function validIdentity(item) {
  return Boolean(text(item?.material_id) && text(item?.chunk_id) && /^[a-f0-9]{64}$/iu.test(text(item?.chunk_hash)));
}

function isEligible(item, { enterpriseId, projectId }) {
  if (!validIdentity(item)) return false;
  if (text(item.enterprise_id) !== text(enterpriseId) || text(item.project_id) !== text(projectId)) return false;
  if (text(item.source_role).toUpperCase() !== 'EVIDENCE_CANDIDATE') return false;
  if (text(item.corpus_scope).toUpperCase() !== 'ENTERPRISE_PRIVATE') return false;
  // Retrieval rows identify the material as material_id while the shared
  // authority policy consumes id. This is identity normalization only.
  const material = { ...item, id: item.id || item.material_id };
  if (materialAuthorityStatus(material, { retrieval: true }).eligible !== true) return false;
  return materialAuthorityAllowedForMode(material, { authorityMode: 'SYNTHETIC_EVAL_ONLY' });
}

/**
 * One bounded Evidence Search pass. The repository is deliberately an
 * isolated Eval adapter: its vector rows are an eval snapshot, never the
 * production retrieval or formal Evidence/Fact/Mapping persistence path.
 */
export class EvidenceSearchOrchestrator {
  constructor({ repository, embeddingClient, clock = () => Date.now() } = {}) {
    this.repository = repository;
    this.embeddingClient = embeddingClient;
    this.clock = clock;
  }

  async search({ requirement = {}, profile = {}, enterpriseId = null, maxCandidates = 5 } = {}) {
    if (this.repository?.isolation_mode !== 'ISOLATED_EVAL') {
      throw new AppError('EVIDENCE_SEARCH_ISOLATED_EVAL_REQUIRED', 'Evidence Search 仅允许使用隔离 Eval repository。', 409);
    }
    if (typeof this.repository.listEvidenceCandidateChunks !== 'function'
      || typeof this.repository.upsertEvalEmbeddings !== 'function'
      || typeof this.repository.rankEvidenceCandidateChunks !== 'function') {
      throw new AppError('EVIDENCE_SEARCH_REPOSITORY_CONTRACT_REQUIRED', 'Evidence Search 缺少隔离 Eval retrieval contract。', 503);
    }
    const requirementId = text(requirement.requirement_id || requirement.req_id);
    const requirementText = text(requirement.text || requirement.requirement_text);
    const projectId = text(requirement.project_id || profile?.source_constraints?.project_id);
    const scopedEnterpriseId = text(enterpriseId || profile?.source_constraints?.enterprise_id);
    if (!requirementId || !requirementText || !projectId || !scopedEnterpriseId || text(profile.requirement_id) !== requirementId || !text(profile.profile_hash)) {
      throw new AppError('EVIDENCE_SEARCH_SCOPE_INVALID', 'Evidence Search 缺少当前 Requirement、enterprise 或 profile identity。', 422);
    }
    const cap = Math.max(0, Math.min(5, Number.isInteger(maxCandidates) ? maxCandidates : 5));
    const rows = await this.repository.listEvidenceCandidateChunks({ projectId, enterpriseId: scopedEnterpriseId, profileHash: profile.profile_hash });
    const eligible = uniqueByIdentity((Array.isArray(rows) ? rows : [])
      .filter(item => isEligible(item, { enterpriseId: scopedEnterpriseId, projectId }))
      .sort((left, right) => `${left.material_id}|${left.chunk_id}`.localeCompare(`${right.material_id}|${right.chunk_id}`)));
    if (!eligible.length || cap === 0) {
      return {
        orchestrator_version: EVIDENCE_SEARCH_ORCHESTRATOR_VERSION,
        search_run_id: `ESEARCH-${randomUUID().toUpperCase()}`,
        requirement_id: requirementId, profile_hash: profile.profile_hash,
        candidates: [], eval_embedding_rows: 0,
        evidence_gap: evidenceGap('NO_EVIDENCE_FOUND')
      };
    }
    if (!this.embeddingClient || typeof this.embeddingClient.embed !== 'function') {
      throw new AppError('EVIDENCE_SEARCH_EMBEDDING_REQUIRED', 'Evidence Search 缺少现有 Embedding client。', 503);
    }
    for (const item of eligible) {
      if (!Array.isArray(item.eval_embedding)) continue;
      if (item.eval_embedding_model !== this.embeddingClient.model
        || item.eval_embedding_version !== this.embeddingClient.version
        || Number(item.eval_embedding_dimension) !== Number(this.embeddingClient.dimension)
        || item.eval_embedding.length !== this.embeddingClient.dimension) {
        throw new AppError('EVIDENCE_SEARCH_EMBEDDING_IDENTITY_MISMATCH', 'Frozen Eval vector 的 material/chunk/hash/model/version/dimension identity 不一致。', 409);
      }
    }
    const missing = eligible.filter(item => !Array.isArray(item.eval_embedding));
    const vectors = await this.embeddingClient.embed([requirementText, ...missing.map(item => item.source_text)]);
    if (!Array.isArray(vectors) || vectors.length !== missing.length + 1
      || vectors.some(vector => !Array.isArray(vector) || vector.length !== this.embeddingClient.dimension)) {
      throw new AppError('EVIDENCE_SEARCH_EMBEDDING_IDENTITY_MISMATCH', 'Eval Embedding 返回的数量或维度与 frozen Chunk 不一致。', 409);
    }
    const snapshotRows = missing.map((item, index) => ({
      material_id: item.material_id,
      chunk_id: item.chunk_id,
      chunk_hash: item.chunk_hash,
      embedding_model: this.embeddingClient.model,
      embedding_version: this.embeddingClient.version,
      embedding_dimension: this.embeddingClient.dimension,
      embedding: vectors[index + 1]
    }));
    if (snapshotRows.length) await this.repository.upsertEvalEmbeddings(snapshotRows);
    const ranked = await this.repository.rankEvidenceCandidateChunks({
      projectId, enterpriseId: scopedEnterpriseId, profileHash: profile.profile_hash,
      // Rank the bounded eligible pool before applying content deduplication;
      // otherwise duplicate rows in the raw Top-K would permanently consume
      // final slots and lower-ranked unique content could not be recovered.
      queryVector: vectors[0], candidates: eligible, limit: eligible.length,
      embeddingModel: this.embeddingClient.model,
      embeddingVersion: this.embeddingClient.version,
      embeddingDimension: this.embeddingClient.dimension
    });
    const rankedEligible = uniqueByIdentity(Array.isArray(ranked) ? ranked : [])
      .filter(item => isEligible(item, { enterpriseId: scopedEnterpriseId, projectId }));
    const rawTopK = rankedEligible.slice(0, cap);
    const hierarchical = profileAwareHierarchicalProjection(rankedEligible, profile, { limit: cap });
    const contentDedup = deduplicateRankedEvidenceCandidates(hierarchical.projected);
    // A retrieval run owns one lineage identity. Candidates from that run must
    // not manufacture per-slot run IDs, otherwise downstream audit joins can
    // interpret one search as several unrelated executions.
    const searchRunId = `ESEARCH-${sha(`${requirementId}|${profile.profile_hash}|${this.clock()}`).slice(0, 24).toUpperCase()}`;
    const candidates = contentDedup.retained
      .slice(0, cap)
      .map((item, index) => ({
        requirement_id: requirementId,
        search_run_id: searchRunId,
        material_id: item.material_id,
        chunk_id: item.chunk_id,
        source_span_id: `${item.chunk_id}:FULL`,
        source_hash: item.chunk_hash,
        source_role: 'EVIDENCE_CANDIDATE',
        enterprise_id: scopedEnterpriseId,
        project_id: projectId,
        score: semanticScore(item),
        semantic_score: semanticScore(item),
        rerank_score: item.rerank_score,
        profile_rerank_contribution: item.profile_rerank_contribution,
        discovery_anchor_chunk_id: item.discovery_anchor_chunk_id,
        final_evidence_chunk_id: item.final_evidence_chunk_id || item.chunk_id,
        rank: index + 1,
        profile_hash: profile.profile_hash,
        authority: 'SYNTHETIC_EVAL_ONLY',
        production_authority: 'NONE',
        creates_fact_authority: false,
        creates_claim_authority: false
      }));
    const rawTopKHashCount = new Set(rawTopK.map(item => text(item.chunk_hash)).filter(Boolean)).size;
    const duplicateCandidatesRemovedTotal = contentDedup.duplicate_groups.reduce((sum, group) => sum + group.removed_count, 0);
    const finalDuplicateCandidateCount = candidates.length - new Set(candidates.map(item => item.source_hash)).size;
    return {
      orchestrator_version: EVIDENCE_SEARCH_ORCHESTRATOR_VERSION,
      search_run_id: searchRunId,
      requirement_id: requirementId, profile_hash: profile.profile_hash,
      candidates, eval_embedding_rows: snapshotRows.length,
      retrieval_diagnostics: {
        profile_consumption: 'PARTIAL',
        structural_only_count: hierarchical.structural_only_count,
        substantive_count: hierarchical.substantive_count,
        material_discovery: hierarchical.material_discovery,
        raw_candidate_count: rankedEligible.length,
        raw_top_k: rawTopK.map(item => ({
          material_id: item.material_id,
          chunk_id: item.chunk_id,
          chunk_hash: item.chunk_hash,
          similarity: Number(item.similarity_score ?? item.score ?? 0)
        })),
        content_duplicate_groups: contentDedup.duplicate_groups.map(group => ({
          chunk_hash: group.chunk_hash,
          retained_candidate: {
            material_id: group.retained_candidate.material_id,
            chunk_id: group.retained_candidate.chunk_id,
            similarity: Number(group.retained_candidate.similarity_score ?? group.retained_candidate.score ?? 0)
          },
          removed_candidates: group.removed_candidates.map(item => ({
            material_id: item.material_id,
            chunk_id: item.chunk_id,
            similarity: Number(item.similarity_score ?? item.score ?? 0)
          })),
          removed_count: group.removed_count
        })),
        deduplicated_candidate_count: contentDedup.retained.length,
        final_top_k_count: candidates.length,
        slots_recovered_by_content_dedup: Math.max(0, candidates.length - rawTopKHashCount),
        duplicate_candidates_removed_total: duplicateCandidatesRemovedTotal,
        final_duplicate_candidate_count: finalDuplicateCandidateCount
      },
      evidence_gap: candidates.length ? evidenceGap('FACT_REVIEW_REQUIRED') : evidenceGap('NO_EVIDENCE_FOUND')
    };
  }
}
