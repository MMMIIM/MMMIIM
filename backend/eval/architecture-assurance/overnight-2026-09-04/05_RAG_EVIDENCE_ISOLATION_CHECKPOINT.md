# Phase 05 — RAG / Material / Evidence Isolation Checkpoint

**PHASE:** 05  
**OBJECTIVE:** Verify that Material, Chunk, Retrieval, Evidence and Fact lanes remain separate and that source roles cannot silently launder authority.

## Files inspected

`company-material-service.js`, `enterprise-material-chunker.js`, `embedding-client.js`, `enterprise-retrieval-service.js`, `material-source-authority-policy.js`, `enterprise-evidence-source-router.js`, retrieval hygiene/source-eligibility modules, Evidence/Fact services, migrations `019`, `020`, `041`, `044`, `051`, and artifacts `backend/eval/rag-governance/11_current_rag_corpus_inventory.json`, `15_material_source_authority_quarantine_checkpoint.json`, `backend/eval/gold-human-review/v2/mapping-real-rebuild/06_source_role_projection_checkpoint.json`.

## Corpus facts (artifact-backed)

- **CONFIRMED_BY_RUNTIME_ARTIFACT / LOCAL_ONLY:** 56 materials, 561 chunks, 625 embeddings, 17 retrieval runs and 129 retrieval results were recorded by the read-only corpus inventory (`11_current_rag_corpus_inventory.json`).
- Scope totals: ENTERPRISE_PRIVATE 22 materials/243 chunks/243 embeddings; GENERAL 16/162/162; GOVERNMENT_ENTERPRISE 8/64/128; HEALTHCARE 10/92/92.
- The 64 extra embeddings are explained by the 8 GOVERNMENT_ENTERPRISE materials each having both `local-deterministic-corpus/v1/64` and `Qwen/Qwen3-Embedding-0.6B/v1/1024` identities (8×8 extra vectors). This is **CONFIRMED_BY_RUNTIME_ARTIFACT**, not inferred; retrieval filters model/version/dimension in `EnterpriseRetrievalService`.
- Source-role projection reports: QUARANTINED 4, SYNTHETIC_ENTERPRISE_EVIDENCE 16, REFERENCE_CONTEXT_ONLY 34, REAL_ENTERPRISE_EVIDENCE_CANDIDATE 0, UNKNOWN_REVIEW_REQUIRED 2; real Requirement source count 221 (one tender), no unsafe promotion.
- Neusoft/reference material is not current enterprise authority; official/reference content is routed as context/reference, not enterprise proof. Synthetic corpus remains Eval-only and not Real Gold.

## Code paths confirmed

Material upload → extraction → deterministic chunking → material authority policy → embedding identity filter → retrieval run/results. Retrieval returns candidates only; Evidence creation requires a separate Evidence service/review/span path; Facts, Mapping, Claim Gate and Writer consume approved/current lineage only.

## Tables confirmed

`company_materials`, `material_chunks`, `material_chunk_embeddings`, `enterprise_retrieval_runs`, `enterprise_retrieval_results`, `evidences`, `evidence_source_spans`, `evidence_source_facts`, and downstream Mapping/Claim tables.

## Tests inspected

`material-source-authority-policy.test.js`, `company-material-evidence.test.js`, retrieval hygiene/source-eligibility tests, corpus L3 integration and source-role/quarantine governance tests. Prior focused source-role suite was 40/40 PASS; no provider or DB writes were run in this phase.

## CONFIRMED_FACTS

- **CONFIRMED_BY_CODE:** `materialAuthorityStatus` requires corpus provenance, ACTIVE lifecycle, approved review, active usage and succeeded extraction; retrieval additionally requires INDEXED for public scopes.
- **CONFIRMED_BY_CODE:** `enterprise-evidence-source-router` rejects historical bids for proof, routes generic/reference sources to reference context, and requires authority/capability/subject/entity/scope compatibility.
- **CONFIRMED_BY_CODE:** Retrieval does not create Evidence, Fact, Mapping or Claim; those are separate endpoints/services.
- **CONFIRMED_BY_CODE/SCHEMA:** vector rows are uniquely keyed by chunk hash + embedding identity and dimension checked by `vector_dims`; HNSW index is dimension-specific (1536 in migration 020).
- **CONFIRMED_BY_ARTIFACT:** four quarantined materials remain auditable; two UNKNOWN materials have missing provenance fields and are not promoted.

## CONFLICTING_FACTS

- **CONFLICTING:** corpus inventory labels all 56 materials retrieval-eligible at an inventory snapshot, while source-role governance labels many as reference/synthetic and zero as real enterprise proof candidates. These are different gates (retrieval eligibility versus enterprise proof authority), not interchangeable PASS signals.
- **CONFLICTING:** runtime supports 1024 Qwen vectors, but migration 020's HNSW index targets 1536; current query can still use vector operations without that index. Performance readiness is therefore not equivalent to semantic/authority readiness.

## UNKNOWN_AREAS

- Whether all 625 vectors are present in the same live database now; inventory is a local artifact, not a live query in this phase.
- Exact provenance of every historical material outside the two explicitly UNKNOWN rows.

## LOCAL_ONLY_FACTS

- All counts and role distributions are local audit artifacts; no real customer material was sent or changed.

## P0_RISKS

- **P0-RAG-001:** zero REAL_ENTERPRISE_EVIDENCE_CANDIDATE materials means real enterprise proof readiness is absent even though retrieval infrastructure is populated.

## P1_RISKS

- **P1-RAG-002:** 1536-only HNSW index versus 1024 production embeddings is a performance/operability risk.
- **P1-RAG-003:** dual embedding identities per chunk require strict current identity filtering; any query omission can mix incompatible vectors.

## P2_RISKS

- **P2-RAG-004:** source-role metadata is distributed across artifacts and material columns rather than a single enforced registry.

## TECH_DEBT

- Legacy and synthetic corpus rows remain readable for regression but need clear lifecycle dashboards.

## ARCHITECTURE_DRIFT

- **AD-05-001:** retrieval foundation is broad and active, while enterprise-proof corpus is intentionally empty; product documentation must keep these scopes visibly distinct.

## NEXT_DEPENDENCY

Phase 06 semantic gateway boundary and task registry audit.

## SAFE_TO_CONTINUE

**YES** — isolation controls are evidenced; no source-role promotion or external call occurred.
