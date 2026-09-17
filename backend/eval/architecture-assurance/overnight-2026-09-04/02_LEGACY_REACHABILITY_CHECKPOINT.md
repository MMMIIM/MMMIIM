# Phase 02 — Canonical vs Legacy Reachability Checkpoint

**PHASE:** 02  
**OBJECTIVE:** Determine whether legacy routes can still change authority-bearing state.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; branch/HEAD unchanged; only audit artifacts were added.

## Legacy reachability matrix

| Surface | Route/caller | Writes/reads | Classification | Authority conclusion |
|---|---|---|---|---|
| Legacy Fact | `EvidenceFactService`, `/api/evidence-facts/:factId...` | `evidence_facts`; legacy evidence service reads/writes | `WRITE_COMPAT_FENCED` | Not read by canonical `ProductionBetaService` Claim path; remains a writable compatibility surface when route is enabled. |
| Canonical Fact | `EvidenceSourceFactService`, `/api/evidence-source-facts/:factId/:decision`, review fact routes | `evidence_source_facts` | `WRITE_ACTIVE_DANGEROUS` only if bypassing review (not observed); normal route is service-owned | Canonical Claim path consumes only approved/current source facts and mappings. |
| Legacy Mapping | `/api/projects/:projectId/evidence-mappings`, `/api/evidence-mappings/:mappingId/*` | `requirement_evidence_mappings` | `WRITE_COMPAT_FENCED` | No route or query was found that converts legacy rows into canonical approved Fact Mapping. |
| Canonical Mapping | `/api/projects/:projectId/requirement-evidence-fact-mappings`, `/api/.../produce`, decision route | `requirement_evidence_fact_mappings` | `WRITE_ACTIVE` with service/authorization checks | Required for enterprise support and Claim Gate V2. |
| Canonical claims | `POST /api/projects/:projectId/claims/generate` | deterministic claims, coverage, gate evaluation | `WRITE_ACTIVE` | Reads canonical approved fact support; requirement-response path has explicit deterministic approval identity. |
| Legacy production beta | `POST /api/projects/:projectId/production-beta` | legacy ProductionBetaService/result tables | `LEGACY_ONLY` | Route is guarded by `V43_LEGACY_GENERATION_COMPAT`; not the default canonical claims/generation path. |
| Dify client | runtime construction and legacy generation adapter | provider calls only when corresponding route/config invoked | `REACHABLE` / `LEGACY_ONLY` by task | Canonical extraction/Fact/Mapping use Semantic Gateway adapters; no result/text/answer fallback observed. |

## Key findings

- A legacy Mapping row cannot authorize a canonical Claim: `generateClaims` queries approved canonical Fact support, and the Claim Gate adapter requires canonical mapping/fact lineage.
- Legacy production-beta and canonical `claims/generate` are separate route contracts despite sharing `ProductionBetaService` naming.
- Dify remains instantiated and legacy compatibility remains reachable. This is bounded by configuration, but a deployment with the flag enabled has a larger authority surface.
- Legacy Fact/Mapping tables are not inert; they are compatibility writes. The risk is isolation/operational configuration, not observed current authority escalation.

## Required fields

**FILES_INSPECTED:** `backend/src/app.js`, `production-beta-service.js`, `evidence-service.js`, `evidence-fact-service.js`, `claim-gate-input-adapter-v1.js`, `writer-input-authorization-v1.js`, `backend/src/server.js`.  
**CODE_PATHS_CONFIRMED:** canonical vs legacy route guards and repository queries.  
**TABLES_CONFIRMED:** `evidence_facts`, `evidence_source_facts`, `requirement_evidence_mappings`, `requirement_evidence_fact_mappings`, claim/gate tables.  
**TESTS_INSPECTED:** legacy compatibility, mapping authority, claim gate bridge, route authorization tests.  
**CONFIRMED_FACTS:** legacy surfaces remain reachable but canonical Claim path rejects reliance on them.  
**CONFLICTING_FACTS:** “legacy compatibility” is sometimes documented as retired while code keeps routes.  
**UNKNOWN_AREAS:** production environment flag distribution and all downstream consumers outside this repository.  
**LOCAL_ONLY_FACTS:** no live route was invoked.  
**P0_RISKS:** none newly observed; baseline P0 remains.  
**P1_RISKS:** P1-LEGACY-001 dual writable Fact/Mapping APIs; P1-DIFY-001 legacy provider reachability.  
**P2_RISKS:** duplicate table terminology and inactive/active confusion.  
**TECH_DEBT:** route manifest and migration ledger absent.  
**ARCHITECTURE_DRIFT:** AD-02-001 legacy API still reachable; AD-02-002 Dify adapter construction exceeds frozen canonical matrix.  
**NEXT_DEPENDENCY:** Phase 03 invalidation negative-control review.

**SAFE_TO_CONTINUE:** YES, read-only.
