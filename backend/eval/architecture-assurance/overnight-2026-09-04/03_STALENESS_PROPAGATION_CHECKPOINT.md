# Phase 03 — Authority Propagation / Staleness Checkpoint

**PHASE:** 03  
**OBJECTIVE:** Verify fail-closed invalidation across material, requirement, fact, mapping, claim, writer and generation identities using existing tests/schema only.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; no production DB was mutated.

## Authority invalidation matrix

| Mutation | Upstream row retained? | Authority invalidated? | Downstream physically changed? | Eligibility fails? | Snapshot changes? | Reuse prevented? | Evidence |
|---|---|---|---|---|---|---|---|
| Material quarantined | Yes, lineage retained | Yes (`lifecycle_status=QUARANTINED`) | Retrieval excludes; dependent checks reject | Yes, source authority unusable | On reload, source/authorization hashes change | Yes when current snapshot is rebuilt | `material-source-authority-quarantine.integration.js` |
| Source chunk/hash changes | Yes | Span/fact current-source checks invalidate | Review/fact/mapping cannot approve stale lineage | Yes | Yes through hashes | Yes by writer/generation identity | migrations 025–028; source-fact tests |
| Requirement mutation | Historical row is immutable; new baseline is separate | Currentness/hash mismatch | Mapping/gate rows can remain for audit | Yes | Requirement projection hash changes | Yes | canonical persistence + claim-gate identity tests |
| Fact edit/supersede | Predecessor retained and invalidated; replacement is new version | Yes | Old fact/mapping/gate eligibility fails; replacement is draft | Yes until replacement approval | Fact/source hashes change | Yes | `evidence-fact-contract-v1`, atomicity tests |
| Mapping replacement | Old mapping retained/invalidated | Yes | Atomic set replacement changes current rows | Yes for old mapping | Mapping/gate identity changes | Yes | `canonical-persistence-atomicity`, mapping producer tests |
| Claim/gate identity change | Claim/gate rows retained | Yes by identity/currentness checks | Writer contexts/mentions may be invalidated | Yes | Auth snapshot changes | Yes | `claim-gate-input-adapter-v1`, targeted remediation tests |
| Project Fact update | Old fact retained/superseded | Yes through propagation plan | Affected writer tasks/outputs/mentions invalidated | Yes until new safe context | Project-fact context hash changes | Yes | deterministic integration tests, writer snapshot tests |

## Verdict

`GENERIC_CLAIM_STALE_PROPAGATION = AUTHORITY_FAIL_CLOSED_ONLY`.

The code and negative-control tests establish that stale rows cannot authorize current Claim/Writer use. They do not prove that every downstream row is eagerly physically deleted; many are deliberately retained for audit and marked invalidated/stale. Cross-service end-to-end propagation remains `PARTIAL` because no single isolated test covers every object in one transaction.

## Required fields

**FILES_INSPECTED:** evidence/source/fact/mapping services, Claim Gate adapter, writer authorization/snapshot, document generation, material quarantine service, migrations 025–031/048–051.  
**CODE_PATHS_CONFIRMED:** currentness/hash gates, atomic replacement, writer invalidation helpers, generation identity lookup.  
**TABLES_CONFIRMED:** `evidence_candidate_reviews`, `evidence_source_facts`, `requirement_evidence_fact_mappings`, `claims`, `claim_gate_evaluations`, `writer_safe_contexts`, `writer_execution_tasks`, `writer_execution_outputs`, `fact_mention_ledger`, `document_generations`.  
**TESTS_INSPECTED:** `sem-p1-004-entry-matrix`, `canonical-persistence-atomicity`, `mapping-producer-v1`, `claim-gate-input-adapter-v1`, writer authorization/snapshot and deterministic integration tests.  
**CONFIRMED_FACTS:** quarantine, stale hashes, supersession, mapping replacement and auth snapshot changes fail closed.  
**CONFLICTING_FACTS:** matrix describes “invalidated” while retained rows remain queryable for audit.  
**UNKNOWN_AREAS:** one-transaction full-chain propagation and any consumers outside tested repositories.  
**LOCAL_ONLY_FACTS:** test evidence is repository-local; no production mutation.  
**P0_RISKS:** none newly observed.  
**P1_RISKS:** P1-STALE-001 propagation is fail-closed but not fully end-to-end proven; P1-LINEAGE-001 JSON identities lack universal FK enforcement.  
**P2_RISKS:** duplicate audit rows and physical-vs-logical invalidation terminology.  
**TECH_DEBT:** no global invalidation event/ledger.  
**ARCHITECTURE_DRIFT:** invalidation is distributed across services rather than a single canonical state machine.  
**NEXT_DEPENDENCY:** Phase 04 Fact producer readiness.

**SAFE_TO_CONTINUE:** YES, read-only.
