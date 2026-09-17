# Phase 04 — Fact Producer Readiness Checkpoint

**PHASE:** 04  
**OBJECTIVE:** Separate Fact lifecycle infrastructure from semantic Fact producer readiness.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; read-only inspection only.

## Findings

### Infrastructure — READY_WITH_DEBT

`EvidenceSourceFactService` requires an approved Evidence Review, validates source/review/currentness and material authority, creates draft Facts, supports human approve/reject, edit/supersede, version/hash lineage and atomic replacement into `evidence_source_facts`. Migrations 025–027 provide source span/review/fact constraints. Existing unit/integration tests cover review gate, stale invalidation and atomicity.

### Semantic producer — AVAILABLE_NOT_CERTIFIED

The default `ProviderNeutralEvidenceFactExtractor` intentionally returns no facts (non-producing stub). However, `server.js` injects `SemanticGatewayEvidenceFactExtractor` using task `evidence_fact_extraction`; the task is registered as `4.3-evidence-fact-extraction-v1`, strict envelope/data validation is applied, and no legacy result/text/answer fallback exists. This is a real production route seam, not a certified producer: no approved Real Fact Gold, provider-fidelity run, or live semantic acceptance was found in the local evidence.

`EvidenceSourceFactService` permits up to two corrective extraction attempts. This is existing code behavior; no provider call was made by this audit.

### Minimal contract seam already present

`extract(review, approved evidence context) → validated {facts}` → deterministic contract projection → draft persistence → human decision. Future certification must bind provider/model/instruction/schema identity and source lineage to the persisted Fact; it must not bypass the service or make an automatic approval decision.

## Required fields

**FILES_INSPECTED:** `evidence-source-fact-service.js`, `semantic-gateway-evidence-fact-extractor.js`, `server.js`, registry/contracts, Fact/review migrations and producer tests.  
**CODE_PATHS_CONFIRMED:** constructor injection, runtime wiring, strict gateway adapter, draft/decision/supersede persistence.  
**TABLES_CONFIRMED:** `evidence_candidate_reviews`, `evidence_source_spans`, `evidence_source_facts`.  
**TESTS_INSPECTED:** `evidence-fact-producer-v1`, `evidence-fact-contract-v1`, review contract, source-span/entrypoint and atomicity tests.  
**CONFIRMED_FACTS:** lifecycle is service-owned; default provider-neutral extractor is non-producing; semantic gateway extractor is wired and strict.  
**CONFLICTING_FACTS:** handoff labels producer NOT_ESTABLISHED while code has a wired producer seam.  
**UNKNOWN_AREAS:** semantic fidelity, provider acceptance, Real Fact Gold.  
**LOCAL_ONLY_FACTS:** no live extraction.  
**P0_RISKS:** none newly observed.  
**P1_RISKS:** P1-PRODUCER-001 certification absent; P1-FACT-GOLD-001 no Real Fact Gold.  
**P2_RISKS:** default stub and runtime implementation can be confused by tests/fixtures.  
**TECH_DEBT:** no explicit producer certification flag in readiness registry.  
**ARCHITECTURE_DRIFT:** registered task contradicts abbreviated handoff matrix.  
**NEXT_DEPENDENCY:** Phase 05 Mapping producer readiness.

**SAFE_TO_CONTINUE:** YES, no implementation authorized.
