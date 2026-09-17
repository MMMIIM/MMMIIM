# V43 P0 RAG Root Cause — Reconciliation

## Root-cause matrix

| Layer | Historical claim | Current code | Current test evidence | Enforcement owner | Gap |
|---|---|---|---|---|---|
| Material lifecycle | Quarantine intended and recorded in governance | Service transition persists `QUARANTINED`; central policy requires `ACTIVE` | Unit + PostgreSQL quarantine test | `CompanyMaterialService` + material authority policy | No gap in transition; downstream propagation is uneven |
| Retrieval | Quarantined source should be excluded | New vector/chunk SQL excludes it; `getRetrievalRun` reload omits predicate | NC-01 proves new search only | `PgRepository` shared SQL projection | Historical run reload can expose quarantined chunks |
| Review | Retrieval candidate enters review with provenance | Direct proposal/decision checks project, span and hashes only | Entry matrix has no quarantine transition | `EvidenceReviewService` / repository | Stale quarantined candidate can be proposed/approved |
| Fact | Approved current Fact must have current source | Canonical approve rejects false authority; extraction/edit do not | Projection/approval unit evidence | `EvidenceSourceFactService` | Draft candidate and legacy Fact approval can bypass lifecycle |
| Mapping | Approved Mapping must remain current | Canonical proposal, staleness and V1.1 Claim support are authority-aware | Neusoft projection + canonical tests | `RequirementEvidenceFactMappingService` | Legacy mapping decision SQL is not authority-aware |
| Claim | Quarantined enterprise support cannot authorize | Active V1.1 support query, Claim Gate and `listClaims` reproject authority | Unit/integration projections | `ProductionBetaService` + Claim Gate V2 | No canonical Claim re-allow found; transition E2E still absent |
| Writer | Only current allow/lineage enters safe context | Section context, safe context and reference retrieval are gated | Unit safe-context tests | Writer authorization service | Canonical exposure zero; historical coverage remains audit data |

## Classification

**PRIMARY_ROOT_CAUSE = D — PARTIAL_PRODUCTION_ENFORCEMENT**  
**SECONDARY = B — HISTORICAL_OVERCLAIM; C — EVAL_PRODUCTION_SCOPE_MISMATCH**

The current worktree has a real production lifecycle gate, but the gate is not
applied at every stale read and legacy mutation boundary. The previous audit
also used an Eval/source-role statement (`NOT_ENFORCED`) as a broader production
claim. Both facts are true in their respective scopes; neither supports a
blanket “all layers fail-closed” assertion.

## P0 severity reconciliation

`P0_RAG_001_FINAL_CLASSIFICATION = P1_GOVERNANCE_GAP`.

The canonical Production Retrieval → canonical Fact approval → canonical
Mapping → canonical Claim → Writer path is fail-closed at the authority-bearing
decision points. The confirmed gaps are still security/authority debt:
historical retrieval/review can expose stale candidates, canonical Fact
drafting is not stopped early, and legacy Fact/Mapping mutation paths can write
authority-looking rows without the shared lifecycle predicate. Because those
legacy rows are not consumed by the canonical Claim/Writer path in the current
runtime, the evidence does not justify `CONFIRMED_P0`; it does justify a P1
governance gate before reopening any corpus or Gold.

## Minimum remediation recommendation (not executed)

`REMEDIATION_REQUIRED = YES`  
`SAFE_TO_PROCEED_TO_REMEDIATION = YES`

Recommended owner-level sequence:

1. Add the shared material authority predicate to stale Retrieval reload and
   Review candidate/context reads, and revalidate lifecycle in Review decision.
2. Make canonical Fact extraction/edit and legacy Fact/Mapping writes fail closed
   against the same predicate (or explicitly quarantine those legacy endpoints
   from authority-bearing use).
3. Add isolated PostgreSQL transition tests for NC-02–NC-05, then rerun only the
   affected current paths.

No new quarantine taxonomy, migration, backfill, or historical-row mutation is
required by this audit conclusion. A migration is only needed if the owner
chooses to enforce an additional schema invariant; the existing dirty 051
schema already records quarantine reason/timestamp.

## Governance locks

`SAFE_TO_REOPEN_REAL_FACT_GOLD = NO`  
`SAFE_TO_REOPEN_REAL_MAPPING_GOLD = NO`  
The separate six-tender source parity gate remains unresolved, independently
of this P0 reconciliation.

