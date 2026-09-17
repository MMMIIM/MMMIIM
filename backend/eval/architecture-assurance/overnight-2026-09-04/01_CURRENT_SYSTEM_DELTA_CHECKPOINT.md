# Phase 01 — Current System Delta Checkpoint (V2)

**PHASE:** 01  
**OBJECTIVE:** Verify the high-confidence engineering handoff against the current local code without changing runtime behavior.

**BASELINE:** branch `feat/v4.3-semantic-boundary-routing`; `HEAD=f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`; Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`. Current status delta is audit-owned files only; branch/HEAD are unchanged.

## Files inspected

- `backend/src/server.js`, `backend/src/app.js`
- `backend/src/evidence-source-fact-service.js`
- `backend/src/pipeline/{semantic-gateway-evidence-fact-extractor,requirement-evidence-fact-mapping-service,semantic-gateway-mapping-evaluator,evidence-support-review-evaluator,evidence-readiness-service,production-beta-service}.js`
- `backend/src/pipeline/{claim-gate-input-adapter-v1,writer-input-authorization-v1,document-generation-service,writer-generation-batch-builder-v2}.js`
- `backend/src/pipeline/semantic-gateway-task-registry.js`, `packages/semantic-contracts/index.js`
- related migrations 019–051 and focused regression tests.

## MATCH

| Handoff statement | Current code evidence |
|---|---|
| Canonical Fact is `EvidenceSourceFactService → evidence_source_facts` | Service is injected by `server.js`; review/source/hash/currentness checks persist through repository methods. |
| Canonical Mapping is `RequirementEvidenceFactMappingService → requirement_evidence_fact_mappings` | Service is injected and canonical routes call `produceForRequirement`/`decide`; atomic replacement and hash lineage are present. |
| Approved Fact Mapping feeds deterministic claims and Claim Gate V2 | `ProductionBetaService.generateClaims` reads approved current fact support, creates deterministic claims and gate evaluations. |
| Writer path is authorization service → safe context → `DocumentGenerationService(writerV2=true)` | `server.js` enables `writerV2`; writer authorization and snapshot are used before provider input. |
| Evidence support ambiguity fails closed | `EvidenceSupportReviewEvaluator` has no production semantic adjudicator wired; ambiguous path returns `ASSESSMENT_UNAVAILABLE`. |
| Legacy production-beta is compatibility-gated | `V43_LEGACY_GENERATION_COMPAT` gates legacy mutation/generation routes. |

## DRIFT

1. Handoff said `evidence_fact_extraction` was not registered; current registry contains `4.3-evidence-fact-extraction-v1` and `server.js` wires `SemanticGatewayEvidenceFactExtractor`.
2. Handoff said Mapping producer was not established; current server wires `SemanticGatewayMappingEvaluator` for the production route. It is available in code, but no Real Gold/provider certification was found.
3. The registry also contains `evidence_support_assessment`; `sufficiency_assessment` is not registered. This differs from the abbreviated handoff matrix, not from the fail-closed behavior.
4. Legacy `evidence_facts`/`requirement_evidence_mappings` APIs remain reachable for compatibility, so “canonical only” is not a complete route-level statement.

## NOT PROVEN

- Real provider fidelity or semantic quality for Fact/Mapping producers.
- Complete removal of legacy authority-bearing writes under every environment flag.
- Clean committed baseline (worktree is intentionally dirty).

## Gate

`HANDOFF_LOCAL_CODE_PARITY = PARTIAL` — canonical wiring matches, but producer registration and legacy reachability contradict the handoff summary. No evidence of authority corruption was observed.

**SAFE_TO_CONTINUE:** YES for read-only phases; no production/Git/DB/provider operation was performed.

## Required fields

**TABLES_CONFIRMED:** `evidence_source_facts`, `requirement_evidence_fact_mappings`, `claims`, `claim_gate_evaluations`, `writer_safe_contexts`, `document_generations`.  
**TESTS_INSPECTED:** semantic gateway registry, Fact lifecycle/atomicity, Mapping authority/atomicity, Claim Gate input, Writer authorization/snapshot, generation identity.  
**CONFIRMED_FACTS:** canonical services are wired; production Fact/Mapping semantic seams exist; support ambiguity fails closed.  
**CONFLICTING_FACTS:** handoff producer status vs current wiring; legacy dual surfaces.  
**UNKNOWN_AREAS:** real provider certification, flag-on legacy deployment behavior.  
**LOCAL_ONLY_FACTS:** all findings are against dirty local `HEAD`.  
**P0_RISKS:** P0-BASELINE-001 (dirty/diverged baseline).  
**P1_RISKS:** P1-PRODUCER-001/002 (available but uncertified producers), P1-LEGACY-001 (dual writable surfaces).  
**P2_RISKS:** documentation/task-registry drift.  
**TECH_DEBT:** no single route manifest for canonical vs legacy.  
**ARCHITECTURE_DRIFT:** AD-01-001 through AD-01-004 above.  
**NEXT_DEPENDENCY:** Phase 02 reachability trace.
