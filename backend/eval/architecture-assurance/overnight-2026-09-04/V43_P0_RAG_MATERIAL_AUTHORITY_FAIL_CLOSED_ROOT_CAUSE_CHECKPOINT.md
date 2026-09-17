# V43_P0_RAG_MATERIAL_AUTHORITY_FAIL_CLOSED_ROOT_CAUSE_CHECKPOINT

**Terminal status:** `V43_P0_RAG_ROOT_CAUSE_CONFIRMED`

| Field | Value |
|---|---|
| `BRANCH` | `feat/v4.3-semantic-boundary-routing` |
| `HEAD` | `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e` |
| `BASELINE_DRIFT` | `NO` — only this audit's checkpoint artifacts were added; pre-existing dirty baseline preserved |
| `HISTORICAL_REMEDIATION_EXISTED` | `PARTIAL` |
| `HISTORICAL_REMEDIATION_SCOPE` | `MIXED` |
| `MATERIAL_LIFECYCLE_ENFORCEMENT` | `ENFORCED` for the owning quarantine transition; downstream propagation is partial |
| `RETRIEVAL_QUARANTINE_GATE` | `BYPASS_FOUND` — new retrieval is gated, historical `getRetrievalRun` reload is not |
| `REVIEW_QUARANTINE_GATE` | `NOT_ENFORCED` for stale historical candidate proposal/decision |
| `FACT_QUARANTINE_AUTHORITY` | `PARTIAL` — canonical approval fail-closed; draft/legacy paths remain open |
| `MAPPING_QUARANTINE_AUTHORITY` | `FAIL_CLOSED` for canonical V1.1 owner; legacy decision path is a separate bypass |
| `CLAIM_QUARANTINE_AUTHORITY` | `FAIL_CLOSED` for canonical Claim support and Claim Gate |
| `WRITER_QUARANTINE_EXPOSURE` | `ZERO` for canonical assertable enterprise claims |
| `LEGACY_AUTHORITY_BYPASS` | `FOUND` — legacy `evidence_facts` and `requirement_evidence_mappings` writes omit the shared predicate |
| `NC01` | `PROVEN` (new retrieval 0; isolated PostgreSQL integration evidence) |
| `NC02` | `PARTIAL / NOT_PROVEN` (projection and canonical approval guard; no transition E2E) |
| `NC03` | `PARTIAL / NOT_PROVEN` (projection and canonical staleness guard; legacy SQL gap) |
| `NC04` | `PARTIAL / NOT_PROVEN` (current Claim projection fail-closed; no transition E2E) |
| `NC05` | `PARTIAL / NOT_PROVEN` (section/safe-context unit evidence; no full generation transition) |
| `SOURCE_ROLE_VS_PRODUCTION_LIFECYCLE` | `CONFLICTING` — Eval role projection and production lifecycle are different projections; prior scope was broader than current runtime proof |
| `PRIMARY_ROOT_CAUSE` | `D — PARTIAL_PRODUCTION_ENFORCEMENT` |
| `P0_RAG_001_FINAL_CLASSIFICATION` | `P1_GOVERNANCE_GAP` |
| `REMEDIATION_REQUIRED` | `YES` |
| `SAFE_TO_PROCEED_TO_REMEDIATION` | `YES` |
| `SAFE_TO_REOPEN_REAL_FACT_GOLD` | `NO` |
| `SAFE_TO_REOPEN_REAL_MAPPING_GOLD` | `NO` |
| `PROVIDER_CALLS` | `0` |
| `PRODUCTION_DB_WRITES` | `0` |
| `PRODUCTION_FILES_CHANGED_BY_THIS_AUDIT` | `0` |
| `GIT_OPERATIONS` | No commit, push, merge, deploy, reset, clean, stash, restore, rebase or checkout |

## Final determination

The current worktree does not support a blanket statement that quarantined
material is fail-closed across every historical read and legacy write. It does
support a narrower statement: the current canonical Retrieval/Mapping/Claim /
Writer authority path uses the centralized active-material predicate and does
not re-authorize quarantined enterprise evidence. The remaining stale-review,
Fact-draft and legacy-write surfaces are confirmed remediation targets. Keep
real Fact/Mapping Gold closed until those transition controls and the independent
source-parity gate are restored.

