# V43 Current Production RAG / Fact Call Graph

## Ingest and Retrieval

`CompanyMaterialService.upload/import` → `tender-text-extractor.js` (or material
text extraction) → `enterprise-material-chunker.js` → `material_chunks` →
`EmbeddingClient.embed()` → `material_chunk_embeddings` →
`EnterpriseRetrievalService.retrieve()` → `db.listChunksForRetrieval()`
(Material Authority SQL + scope/index filters) → pgvector candidate query
(`candidate_k=20`) → retrieval hygiene/source eligibility → deterministic
`semantic-retrieval-reranker` → `review_k` final candidates →
`enterprise_retrieval_runs/results` audit.

Owner boundaries: Material lifecycle is owned by
`material-source-authority-policy.js`; vector transport is owned by
`embedding-client.js`; candidate ordering is owned by
`EnterpriseRetrievalService` and reranker. Retrieval creates no Evidence, Fact,
Mapping, Claim or Writer permission.

## Evidence → Fact

Approved Evidence Review / source span →
`EvidenceSourceFactService.extract()` →
`SemanticGatewayEvidenceFactExtractor` → `SemanticGatewayClient.run()` → local
`/workflows/run` compatibility transport → task router registry for
`evidence_fact_extraction` → OpenAI-compatible Provider Adapter → configured
provider/model → strict response envelope and task-data validation → canonical
candidate projection → `evidence-fact-contract-v1.js` grounding/lineage checks →
`EvidenceSourceFactService` review/decision → atomic
`evidence_source_facts` persistence.

Technical failures remain typed (`GATEWAY_NETWORK_ERROR`,
`OUTPUT_SCHEMA_INVALID`, `FACT_SEMANTIC_EMPTY`, grounding failures) and do not
become business truth. Provider/model never approves a Fact.

## Current wiring facts

- `server.js` injects `SemanticGatewayEvidenceFactExtractor`; the default
  provider-neutral extractor is not the production runtime when the server is
  wired normally.
- The Gateway is strict: it accepts only
  `data.outputs.response_payload_json`; no `result/text/answer` fallback.
- `EvidenceSourceFactService` may retry only the existing bounded recovery path
  (schema-invalid / expected-empty). This is not a license to expand retries.
- All formal writes in this graph are guarded by the owning service. The current
  audit itself performed no production write.
