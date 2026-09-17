# Phase 11 — DB Authority / Direct Write / Migration Checkpoint

**PHASE:** 11  
**OBJECTIVE:** Inspect authority-critical tables, sanctioned writers, direct-write bypasses and replay behavior.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; migration commands were not run because the audit is read-only.

## Authority-critical table review

| Table | Primary sanctioned writer | Constraints / lineage | Alternate writes observed |
|---|---|---|---|
| `evidence_candidate_reviews` | Evidence Review service/repository | review status, requirement/source hashes, version | test fixtures/direct SQL only |
| `evidence_source_facts` | EvidenceSourceFactService | source span/review/hash/currentness/FK | test fixtures/direct SQL only |
| `requirement_evidence_fact_mappings` | RequirementEvidenceFactMappingService | approved/current Fact, requirement/fact hashes, contract | integration negative controls only |
| `claims` / `claim_decisions` | ProductionBetaService + Claim Gate | canonical mapping/authorization identity | test fixtures |
| `claim_gate_evaluations` | Claim Gate service | assertion/gate/input hashes and currentness | test fixtures |
| `requirement_coverages` | deterministic claim generation | requirement/coverage identity | test fixtures |
| `writer_safe_contexts` | WriterInputAuthorizationService | authorization snapshot/currentness | invalidation helpers; test setup |
| `document_versions` | atomic generation finalizer | project/version/status, pending_review gate | no production bypass found |
| `company_materials` | CompanyMaterialService/quarantine | lifecycle/authority/check constraints | tests and legacy compatibility service |

## Direct write assessment

Production repositories own formal writes and transaction boundaries for Fact/Mapping/generation. Several integration tests use direct SQL to set invalidated/stale rows as negative controls; these are test-only and not production routes. Legacy `EvidenceService`/`EvidenceFactService` can write legacy tables when compatibility routes are enabled, so legacy isolation remains a P1 operational risk.

`backend/src/migrate.js` executes every sorted SQL migration on each run and records no ledger: `MIGRATION_LEDGER = NO`. Historical migrations have replay-compatibility fixes, but full replay remains a design risk if future schema/data invalidates an older constraint.

## Verdict

`DB_AUTHORITY = STRONG_WITH_DEBT`; no current cross-project or direct production bypass was observed. `MIGRATION_HEALTH = PARTIAL` because runner replay has no execution ledger.

## Required fields

**FILES_INSPECTED:** `backend/src/db.js`, `backend/src/migrate.js`, migrations 003–051 (authority-critical subset), service/repository write methods and integration fixtures.  
**CODE_PATHS_CONFIRMED:** service-owned writes, atomic replacement/finalization, FK/hash/status constraints, direct test SQL.  
**TABLES_CONFIRMED:** all nine authority-critical groups listed above.  
**TESTS_INSPECTED:** PostgreSQL integration, canonical atomicity, claim identity, writer idempotency, quarantine tests.  
**CONFIRMED_FACTS:** sanctioned writers and core FK/hash/status constraints exist; migration runner has no ledger; direct SQL found is test fixture or legacy compatibility.  
**CONFLICTING_FACTS:** “all migrations replay-safe” is historical intent, not a ledger-backed guarantee.  
**UNKNOWN_AREAS:** deployment-specific extensions/permissions and external SQL clients.  
**LOCAL_ONLY_FACTS:** no DB command executed.  
**P0_RISKS:** none newly observed.  
**P1_RISKS:** P1-MIG-001 no ledger; P1-LEGACY-001 legacy writes; P1-LINEAGE-001 JSON identity FKs.  
**P2_RISKS:** direct test SQL can confuse static audits.  
**TECH_DEBT:** migration ledger and authority-write inventory.  
**ARCHITECTURE_DRIFT:** replay model differs from modern migration expectations.  
**NEXT_DEPENDENCY:** Phase 12 tender artifact drift.

**SAFE_TO_CONTINUE:** YES.
