# Phase 04 — Data Lineage & Invalidation Checkpoint

**PHASE:** 04  
**OBJECTIVE:** Verify source/hash/currentness links and identify propagation gaps without mutating data.

## Files inspected

Migrations `003`, `010`, `017`, `019`, `020`, `025`–`031`, `048`–`051`; canonical, source, material, retrieval, evidence/review/fact, mapping, claim-gate identity, project-fact propagation, writer authorization/snapshot and generation identity code; targeted lineage/invalidation tests.

## CODE_PATHS_CONFIRMED

- Tender File → Parse Job (`tender_parse_jobs.tender_file_id`) → chunks (`tender_parse_chunks`) → Candidate (`parse_job_id`) → baseline (`parse_job_id`) → Requirement (`baseline_id`, project and source hashes/json).
- Material → Chunk (`material_chunks.material_id`, chunk hash/version) → Embedding (`material_chunk_embeddings.chunk_id`, chunk hash/model/version/dimension) → Retrieval Run/Result (requirement, chunk, embedding FKs and ranks).
- Retrieval Result → Source Span (`retrieval_run_id + retrieval_candidate_id` FK, anchor chunk/material) → Evidence Review (Requirement/source hashes) → Evidence Source Fact (review/span/material FKs, payload hash/version/supersedes) → Mapping (Requirement/Fact FKs and requirement/fact hashes/contracts) → Claim/Gate (JSON IDs plus persisted gate identity) → Writer Safe Context / Mention Ledger (snapshot hash and claim/gate IDs) → Generation (input snapshot + authorization snapshot hash) → Version.

## TABLES_CONFIRMED

`tender_files`, `tender_parse_jobs`, `tender_parse_chunks`, `requirement_candidates`, `requirement_baselines`, `requirements`, `company_materials`, `material_chunks`, `material_chunk_embeddings`, `enterprise_retrieval_runs/results`, `evidence_source_spans`, `evidence_candidate_reviews`, `evidence_source_facts`, `requirement_evidence_fact_mappings`, `claim_gate_evaluations`, `writer_safe_contexts`, `fact_mention_ledger`, `document_generations/tasks`, `document_versions`.

## TESTS_INSPECTED

`canonical-persistence-atomicity.test.js`, `mapping-producer-v1.test.js`, `mapping-to-claim-canonical.test.js`, `claim-gate-targeted-remediation.test.js`, `project-fact-propagation-v1.test.js`, `writer-input-authorization-v1.test.js`, `writer-execution-pre-v1.test.js`, and PostgreSQL integration suites.

## CONFIRMED_FACTS

- **CONFIRMED_BY_SCHEMA:** Requirements, source spans, facts and mappings carry hashes/contracts and explicit project/material/Requirement FKs; confirmed Requirements and reviewed Facts are protected by database triggers.
- **CONFIRMED_BY_CODE:** mapping candidate builder requires current fact and explicit source-lineage proof; Claim support query requires approved/current mapping, approved/current fact and material authority eligibility.
- **CONFIRMED_BY_CODE:** writer authorization hashes safe context and claim/gate identity; current allow claims require matching assertion hash, gate result ID, input snapshot and `lineage_current=true`.
- **CONFIRMED_BY_CODE/TEST:** project-fact edits create superseding versions and propagation plans identify claim revalidation and writer-context impacts; stale previews/actions are blocked by Agent tests.

## LINEAGE_GAPS

- **LG-001 (P1):** `requirements` retains source excerpt/hash/json but does not have a direct FK to a tender paragraph/chunk; source verification is application-level.
- **LG-002 (P1):** `claims.basis_*` and `claim_gate_evaluations.evidence_ids/mapping_ids` are JSON arrays without relational FKs; identity checks are application-level.
- **LG-003 (P1):** `writer_safe_contexts` and generation snapshots embed requirement/claim/fact data rather than FK-linking every item; stale detection depends on snapshot/hash reload.
- **LG-004 (P2):** legacy Evidence/Mapping tables do not carry the full Fact lineage contract and must remain quarantined from canonical Claim support.

## INVALIDATION_FINDINGS

- Material quarantine/lifecycle and source-lineage checks are consumed by retrieval, mapping and Claim Gate; no code path inspected auto-promotes an invalid source.
- Fact supersession invalidates predecessor and mapping candidate currentness; propagation helpers can mark downstream revalidation, but global asynchronous fan-out is not present.
- Requirement baseline immutability prevents in-place mutation after confirmation; new baseline identity is the safe change boundary.
- Generation identity includes writer authorization snapshot hash, but historical generations may remain readable and require explicit currentness checks before reuse.

## CONFLICTING_FACTS

- **CONFLICTING:** some old tables and JSON snapshots preserve historical data by design, while current contracts expect canonical relational lineage; this is compatibility, not proof that old rows are safe for new claims.

## UNKNOWN_AREAS

- Actual DB trigger/index state in the current environment was not queried.
- Whether all invalidation updates are transactionally atomic across every downstream table.

## LOCAL_ONLY_FACTS

- Matrix reflects local source/migrations; no production DB mutation or provider call occurred.

## P0_RISKS

- None newly proven beyond Phase 03 authority-convergence risk; no direct bypass was executed.

## P1_RISKS

- **P1-LINEAGE-001:** application-level JSON lineage and no universal fan-out can permit stale artifacts if any sibling path forgets to check hashes/currentness.
- **P1-LINEAGE-002:** requirement source evidence is verified in code but not always relationally anchored to a source row.

## P2_RISKS

- **P2-LINEAGE-003:** snapshot duplication increases storage and reconciliation complexity.

## TECH_DEBT

- A future canonical lineage index/service could centralize invalidation without rewriting frozen contracts.

## ARCHITECTURE_DRIFT

- **AD-04-001:** lineage is strong at Fact/Mapping boundaries but weaker at Requirement and Claim JSON projections.

## NEXT_DEPENDENCY

Phase 05 must validate material/RAG/evidence source-role isolation and explain the observed corpus counts without conflating retrieval with proof.

## SAFE_TO_CONTINUE

**YES** — lineage gaps are recorded and no unsafe promotion occurred.
