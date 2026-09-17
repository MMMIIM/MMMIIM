# Phase 06 — Evidence Support / Readiness Fail-Closed Checkpoint

**PHASE:** 06  
**OBJECTIVE:** Verify that support ambiguity/unavailability cannot become formal approval or readiness.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; no provider or DB calls.

## Confirmed behavior

- `runDeterministicEvidenceChecks` and `routeEvidenceSupport` resolve only deterministic cases; ambiguous cases remain unresolved.
- `EvidenceSupportReviewEvaluator` is production-wired without a semantic adjudicator. Ambiguous evaluation throws/returns `ASSESSMENT_UNAVAILABLE`; it never calls the legacy `evidence_support_assessment` task as a hidden fallback.
- `aggregateEvidenceSufficiency` projects unavailable/unknown/technical failure to `ASSESSMENT_UNAVAILABLE`, not `SUPPORTED`, `PARTIAL`, `INSUFFICIENT` or `READY`.
- `EvidenceReadinessService` exposes pending/unknown as `NEEDS_REVIEW`; no path observed that converts unavailable/unknown into ready.
- `support_level` on a Mapping and derived `support_sufficiency`/readiness are distinct fields/owners. Approved Mapping is not itself a semantic sufficiency approval.

## Risk assessment

`EVIDENCE_SUPPORT_GATE = FAIL_CLOSED` for the inspected paths. The semantic support evaluator class exists as an isolated adapter, but is not wired; therefore ambiguous support is unavailable rather than silently accepted. This is a safety-preserving availability gap, not a truth-approval path.

## Required fields

**FILES_INSPECTED:** `evidence-support-review-evaluator.js`, `evidence-support-responsibility.js`, `evidence-readiness-service.js`, semantic support evaluator adapter, server wiring, support tests.  
**CODE_PATHS_CONFIRMED:** deterministic route, unavailable branch, readiness projection and Claim Gate input boundary.  
**TABLES_CONFIRMED:** review/mapping/fact/readiness projection tables (derived readiness is not a new authority table).  
**TESTS_INSPECTED:** support assessment deterministic/gateway contract, evidence review entrypoint adoption, mapping/claim authority tests.  
**CONFIRMED_FACTS:** unavailable/unknown cannot become supported/ready; no old-task fallback.  
**CONFLICTING_FACTS:** adapter exists but runtime does not inject it; handoff wording may call this “registered semantic seam”.  
**UNKNOWN_AREAS:** future semantic adjudicator quality and provider availability.  
**LOCAL_ONLY_FACTS:** no support evaluation was run.  
**P0_RISKS:** none newly observed.  
**P1_RISKS:** P1-SUPPORT-001 semantic ambiguity is unavailable; P1-SUPPORT-002 future wiring must retain fail-closed policy.  
**P2_RISKS:** naming overlap between support level and sufficiency.  
**TECH_DEBT:** no explicit capability/readiness flag for adjudicator availability.  
**ARCHITECTURE_DRIFT:** registered task/adapter does not mean active authority.  
**NEXT_DEPENDENCY:** Phase 07 Writer authorization bypass.

**SAFE_TO_CONTINUE:** YES.
