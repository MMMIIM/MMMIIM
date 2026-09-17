# Phase 15 — Architecture Drift / Historical Regression Checkpoint

**PHASE:** 15  
**OBJECTIVE:** Reconcile current local code, schema, tests, handoff and architecture artifacts without changing any of them.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; audit artifacts are the only additions.

## Architecture Drift Register

| ID | Drift | Evidence | Impact |
|---|---|---|---|
| AD-15-001 | Handoff calls Fact producer unregistered; registry/server wire `evidence_fact_extraction` Semantic Gateway | registry, `server.js`, Fact extractor | Producer status must be PARTIAL/AVAILABLE_NOT_CERTIFIED, not “absent”. |
| AD-15-002 | Handoff calls Mapping producer absent; server wires Semantic Gateway evaluator | mapping evaluator/server | Certification still missing. |
| AD-15-003 | Legacy Fact/Mapping/production-beta routes remain reachable | `app.js`, legacy services | Dual authority surface; canonical Claim path remains fenced. |
| AD-15-004 | Quarantine governance intent exceeds production enforcement | RAG/source-role checkpoints | P0 RAG authority risk. |
| AD-15-005 | `sufficiency_assessment` not registered while support semantic adapter/task is present | registry/support wiring | Availability terminology can be misunderstood; fail-closed behavior remains. |
| AD-15-006 | Migration runner replays all SQL with no ledger | `migrate.js` | Replay compatibility is ongoing debt. |
| AD-15-007 | Architecture/current-stage docs describe older frozen stage than dirty local governance artifacts | docs vs eval checkpoints | Readiness claims need local artifact citation. |
| AD-15-008 | Six-tender source universe references missing authoritative packets | source-foundation checkpoint | Real source verification/promotion blocked. |

## Historical Fixed Regression Register

| Bug | Status | Regression evidence |
|---|---|---|
| BUG-01 formal mutation authorization | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | project authorization middleware and entrypoint tests |
| BUG-02 Fact create/edit atomicity | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | Fact contract + atomicity tests |
| BUG-03 Mapping replacement atomicity | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | canonical persistence atomicity + mapping producer tests |
| BUG-04 Mapping no-escalation | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | Claim Gate input adapter and mapping authority tests |
| BUG-05 Material quarantine leakage | `REGRESSED / OPEN` | current source-role checkpoint explicitly records future retrieval/fact/mapping exclusion NOT_ENFORCED and derived leakage YES |
| BUG-06 Gate identity loss | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | claim gate identity/targeted remediation tests |
| BUG-07 Generation reuse identity | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | writer snapshot/idempotency tests |
| BUG-08 Writer enterprise Fact bypass | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | writer authorization/execution/overnight tests |
| BUG-09 Eval provenance/chunk targeting | `FIX_PRESENT / REGRESSION_TEST_PRESENT` | source parity/chunk-targeting governance tests; unrelated missing-artifact failures remain |

BUG-05 is not a claim that all historical protections vanished; it records a concrete current regression of the quarantine enforcement invariant and is already captured as P0-RAG-001. No repair was attempted.

## Required fields

**FILES_INSPECTED:** all V2 checkpoints 01–14, handoff/architecture/current-stage docs, registry/server/app, source-role and source-foundation artifacts, focused regression tests.  
**CODE_PATHS_CONFIRMED:** producer wiring, legacy routes, quarantine seam, migration runner, historical fixes.  
**TABLES_CONFIRMED:** authority and retrieval tables referenced in prior phases.  
**TESTS_INSPECTED:** governance, source parity, quarantine, Fact/Mapping/Claim/Writer identity tests.  
**CONFIRMED_FACTS:** eight drift items; eight historical fixes remain covered; quarantine enforcement is currently open/regressed.  
**CONFLICTING_FACTS:** handoff/docs versus runtime registry and source-role checkpoints.  
**UNKNOWN_AREAS:** whether a future branch already contains remediation outside this local HEAD.  
**LOCAL_ONLY_FACTS:** no branch synchronization performed.  
**P0_RISKS:** P0-BASELINE-001, P0-RAG-001, P0-REQ-001 (promotion/source recovery).  
**P1_RISKS:** P1-LEGACY-001, P1-PRODUCER-001/002, P1-SUPPORT-001, P1-MIG-001, P1-EVAL-001, P1-WRITER-001, P1-RAG-002.  
**P2_RISKS:** docs/terminology/path drift.  
**TECH_DEBT:** distributed architecture status and no central drift registry.  
**ARCHITECTURE_DRIFT:** AD-15-001..008.  
**NEXT_DEPENDENCY:** Phase 16 engineering health/readiness.

**SAFE_TO_CONTINUE:** YES; no fix is authorized in this audit.
