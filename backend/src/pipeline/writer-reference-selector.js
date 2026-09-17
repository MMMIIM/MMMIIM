import { applyRetrievalChunkRole, isWriterReferenceContentEligible } from './retrieval-chunk-role.js';

export const WRITER_REFERENCE_MATERIAL_TYPES = Object.freeze(['technical_solution', 'technical_whitepaper']);

function clampTopK(value, fallback = 4) {
  const requested = value === undefined || value === null ? fallback : Number(value);
  const resolved = Number.isFinite(requested) ? requested : fallback;
  return Math.max(0, Math.min(4, resolved));
}

function projectWriterReference(row) {
  const annotated = applyRetrievalChunkRole(row);
  return {
    material_id: annotated.material_id,
    chunk_id: annotated.chunk_id,
    chunk_hash: annotated.chunk_hash,
    material_type: annotated.material_type,
    source_text: annotated.source_text,
    similarity_score: annotated.similarity_score,
    project_id: annotated.project_id,
    original_name: annotated.original_name,
    corpus_scope: annotated.corpus_scope,
    source_role: annotated.source_role,
    chunk_role: annotated.chunk_role,
    source_document_id: annotated.source_document_id,
    source_chunk_id: annotated.source_chunk_id,
    source_lineage: annotated.source_lineage,
    source_text_sha256: annotated.source_text_sha256,
    lifecycle_status: annotated.lifecycle_status,
    review_status: annotated.review_status,
    usage_status: annotated.usage_status,
    candidate_eligibility: annotated.candidate_eligibility,
    candidate_exclusion_reason: annotated.candidate_exclusion_reason
  };
}

export class WriterReferenceSelector {
  constructor({ repository, embeddingClient = null, topK = 4 } = {}) {
    this.repository = repository;
    this.embeddingClient = embeddingClient;
    this.topK = clampTopK(topK, 4);
  }

  async select({ projectId, section, requirements = [], topK = this.topK } = {}) {
    const queryText = [section?.title, ...requirements.map((item) => item.text)].filter(Boolean).join('\n');
    const limit = clampTopK(topK, this.topK);
    if (limit === 0) return [];
    const candidateLimit = Math.max(16, limit * 4);
    let rows = [];
    if (this.embeddingClient?.embed && this.embeddingClient.apiBase && this.embeddingClient.apiKey && this.repository?.searchWriterReferenceChunks) {
      const [queryVector] = await this.embeddingClient.embed([queryText || '技术方案']);
      rows = await this.repository.searchWriterReferenceChunks({ projectId, queryVector, model: this.embeddingClient.model, version: this.embeddingClient.version, dimension: this.embeddingClient.dimension, materialTypes: WRITER_REFERENCE_MATERIAL_TYPES, limit: candidateLimit });
    } else if (this.repository?.listWriterReferenceChunks) {
      rows = await this.repository.listWriterReferenceChunks({ projectId, queryText, materialTypes: WRITER_REFERENCE_MATERIAL_TYPES, limit: candidateLimit });
    }
    const unique = new Map();
    for (const row of rows || []) {
      if (!WRITER_REFERENCE_MATERIAL_TYPES.includes(row.material_type)) continue;
      if (!isWriterReferenceContentEligible(row)) continue;
      const key = row.chunk_hash || `${row.material_id}:${row.chunk_id}`;
      if (!unique.has(key)) unique.set(key, row);
    }
    return [...unique.values()]
      .sort((a, b) => Number(b.similarity_score || 0) - Number(a.similarity_score || 0) || String(a.material_id).localeCompare(String(b.material_id)) || String(a.chunk_id).localeCompare(String(b.chunk_id)))
      .slice(0, limit)
      .map(projectWriterReference);
  }
}
