# Phase 13 — RAG Source Authority Regression Checkpoint

**PHASE:** 13  
**OBJECTIVE:** Verify separation of tender/reference/synthetic/enterprise authority and explain current corpus counts.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; read-only inventory inspection.

## Current inventory

The local inventory records **56 materials / 561 chunks / 625 embeddings / 17 retrieval runs / 129 retrieval results**. Scope totals are ENTERPRISE_PRIVATE 22/243/243, GENERAL 16/162/162, GOVERNMENT_ENTERPRISE 8/64/128, HEALTHCARE 10/92/92. The extra 64 embeddings are explicitly explained by eight Government materials carrying both local-deterministic 64-dimension identity and Qwen 1024 identity; retrieval filters model/version/dimension.

## Authority invariants

- Source-role projection is Eval-only; it is not a production DB authority enum.
- Synthetic Enterprise Evidence is separated from Real Enterprise Evidence; current real enterprise candidate count is **0**.
- Reference Context is context-only and cannot become enterprise proof.
- Unknown source role remains `UNKNOWN_REVIEW_REQUIRED`; it is not upgraded to Real.
- Official/public source authority does not automatically grant enterprise capability authority.

## Regression finding — Neusoft quarantine

The source-role checkpoint marks four Neusoft materials as quarantined in governance, but also records `future_retrieval_excluded=NOT_ENFORCED`, `future_evidence_fact_excluded=NOT_ENFORCED` and `future_mapping_candidate_excluded=NOT_ENFORCED`; derived authority leakage is recorded as `YES`. Therefore the invariant “Neusoft quarantined ⇒ non-retrievable/non-authority” is **not enforced by current production lifecycle**. This is P0-RAG-001 and blocks Real Enterprise source readiness. No quarantine or data mutation was attempted.

## Required fields

**FILES_INSPECTED:** `backend/eval/rag-governance/11_current_rag_corpus_inventory.json`, source-role projection checkpoint/manifests, material quarantine service/schema and retrieval filters.  
**CODE_PATHS_CONFIRMED:** retrieval eligibility/project/model filters; source-role projection and quarantine lifecycle seam.  
**TABLES_CONFIRMED:** `company_materials`, `material_chunks`, `material_chunk_embeddings`, retrieval runs/results, derived fact/mapping references in inventory.  
**TESTS_INSPECTED:** material-source-authority quarantine integration and RAG/source-role governance tests.  
**CONFIRMED_FACTS:** counts and identity explanation; real enterprise candidate count 0; role projection Eval-only; quarantine future exclusion not enforced.  
**CONFLICTING_FACTS:** governance says quarantined while lifecycle enum/production queries do not enforce exclusion.  
**UNKNOWN_AREAS:** live DB drift since inventory generation; external corpus consumers.  
**LOCAL_ONLY_FACTS:** inventory generated read-only at recorded timestamp.  
**P0_RISKS:** **P0-RAG-001** synthetic/reference/quarantined material can remain retrieval-eligible or leak into derived authority without lifecycle decision.  
**P1_RISKS:** P1-RAG-002 dual embedding identity/index dimensions; P1-RAG-003 unknown-source materials.  
**P2_RISKS:** low-information/heading-only chunks and duplicate corpus artifacts.  
**TECH_DEBT:** source role is projection rather than persisted authority state.  
**ARCHITECTURE_DRIFT:** quarantine checkpoint intent exceeds production enforcement.  
**NEXT_DEPENDENCY:** Phase 14 Agent/DOCX threat audit.

**SAFE_TO_CONTINUE:** YES for audit; no RAG change authorized.
