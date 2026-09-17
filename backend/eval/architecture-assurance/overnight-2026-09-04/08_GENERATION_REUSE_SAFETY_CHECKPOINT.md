# Phase 08 — Generation Identity / Reuse Safety Checkpoint

**PHASE:** 08  
**OBJECTIVE:** Verify that authorization and source-context changes prevent silent reuse of finalized generation output.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; static/test inspection only.

## Confirmed current

- `generationInputIdentity` includes requirement, plan, claim, evidence, rule versions and `writer_authorization_snapshot` projections/hashes.
- V2 generation computes and persists the authorization snapshot/hash in `document_generations.input_snapshot_hash` and rules; repository identity lookup is project + generation type + snapshot hash.
- `writer-authorization-snapshot.test.js` proves changed authorization identity yields a different generation identity and prevents reuse; PostgreSQL idempotency tests prove same identity reuses one generation and changed identity creates a new one.
- Claim/gate, source fact and project-fact invalidation helpers target safe contexts/tasks/outputs/mentions. Regeneration V2 reuses frozen chapter task/safe-context references rather than silently re-retrieving a new evidence environment.

## Limitations

Reference projection changes are represented through the same input snapshot, but no single test covers every possible reference metadata mutation. JSON claim/gate identities also rely on hashes rather than universal relational FKs. These are P1/P2 engineering debts, not observed reuse bypasses.

## Verdict

`GENERATION_REUSE_SAFETY = STRONG_WITH_DEBT`; historical P1-001/P1-002 protections are present in code/tests.

## Required fields

**FILES_INSPECTED:** `document-generation-service.js`, repository generation identity methods, writer snapshot, invalidation helpers, regeneration path, migrations 049–050.  
**CODE_PATHS_CONFIRMED:** identity creation, lookup/reuse, invalidation, regeneration snapshot references.  
**TABLES_CONFIRMED:** `document_generations`, `document_versions`, `writer_safe_contexts`, writer tasks/outputs/mentions, claim/gate tables.  
**TESTS_INSPECTED:** writer authorization snapshot, targeted remediation, deterministic integration and PostgreSQL idempotency tests.  
**CONFIRMED_FACTS:** authorization snapshot participates in reuse lookup; changed input identity prevents silent reuse.  
**CONFLICTING_FACTS:** none in current code/tests.  
**UNKNOWN_AREAS:** exhaustive reference projection mutation coverage.  
**LOCAL_ONLY_FACTS:** no live generation.  
**P0_RISKS:** none.  
**P1_RISKS:** P1-REUSE-001 incomplete all-reference mutation matrix; P1-LINEAGE-001 hash identity without universal FK.  
**P2_RISKS:** retained invalidated generations need clear operator UI semantics.  
**TECH_DEBT:** no central identity schema registry.  
**ARCHITECTURE_DRIFT:** none material.  
**NEXT_DEPENDENCY:** Phase 09 Eval ruler trust.

**SAFE_TO_CONTINUE:** YES.
