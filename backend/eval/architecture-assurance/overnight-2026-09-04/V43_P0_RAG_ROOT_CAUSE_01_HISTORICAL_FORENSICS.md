# V43 P0 RAG Root Cause — Historical Forensics

**Mode:** READ-ONLY / TARGETED / CURRENT-WORKTREE  
**Recorded:** 2026-09-04  
**Branch:** `feat/v4.3-semantic-boundary-routing`  
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`

## Baseline integrity

The pre-audit Phase 00 checkpoint records fingerprint
`318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`,
436 existing porcelain entries, no staged changes, and an unchanged branch/HEAD.
The current worktree is intentionally dirty and contains a large pre-existing
engineering/evaluation delta. This audit adds only checkpoint artifacts in this
directory. No Provider, Dify, LLM, production database or business-state write
was performed.

## Historical chain inspected

| Evidence | What it introduced | Classification |
|---|---|---|
| `cff0981 feat: add corpus l3 governance and public corpus` | Migration 041, corpus L3/public material foundation and retrieval base | `PRODUCTION_ENFORCEMENT` + corpus governance |
| `8eca08b fix: gate retrieval by evidence source eligibility` | Retrieval-source eligibility and associated tests | `PRODUCTION_ENFORCEMENT` |
| `7242539 feat: harden enterprise retrieval product path` | Production retrieval hardening | `PRODUCTION_ENFORCEMENT` |
| `ef5bb89 fix: route retrieval evidence through review UI` | Retrieval-to-review routing | `PRODUCTION_ENFORCEMENT` |
| `282076d fix: enforce canonical evidence review entry` | Canonical review entry/lifecycle boundary | `PRODUCTION_ENFORCEMENT` |
| `528ec38 fix: close review to fact authorization` | Canonical review-to-fact authorization and matrix tests | `PRODUCTION_ENFORCEMENT` + `TEST_ONLY` |
| `f3b584f fix: converge claim support on canonical fact mappings` | Canonical Mapping support as Claim input | `PRODUCTION_ENFORCEMENT` |
| Current dirty `041` diff, `051_material_source_authority_quarantine.sql`, `material-source-authority-policy.js`, service/repository changes and quarantine integration tests | `QUARANTINED` lifecycle, central policy, current SQL projections and tests | `MIXED`; present in worktree, not in HEAD |

The quarantine-specific implementation is therefore not an already committed
historical remediation at this HEAD. The current worktree contains the
remediation seam, while the prior V2 checkpoint describes a broader historical
state as if every downstream consumer had already enforced it.

## What the prior audit did and did not prove

`13_RAG_AUTHORITY_REGRESSION_CHECKPOINT.md` correctly separated the Eval-only
source-role projection from production lifecycle and correctly recorded four
Neusoft materials as quarantined in the governance projection. Its statements
`future_retrieval_excluded=NOT_ENFORCED`,
`future_evidence_fact_excluded=NOT_ENFORCED`, and
`future_mapping_candidate_excluded=NOT_ENFORCED` were not a complete current
runtime trace: current SQL now has a shared active-material predicate for new
retrieval and canonical support paths. Conversely, the current code still has
historical-read and legacy-write gaps documented in the companion runtime trace.

This is a **scope conflict plus a real partial-enforcement gap**, not evidence
that the source-role projection itself is a production lifecycle enum.

## Forensic conclusion

`HISTORICAL_REMEDIATION_EXISTED = PARTIAL`  
`HISTORICAL_REMEDIATION_SCOPE = MIXED`

The durable production owner is the material lifecycle plus the shared
`material-source-authority-v1` policy. The historical record overstates the
scope of that owner, because several stale read and legacy mutation surfaces do
not call the same predicate.

