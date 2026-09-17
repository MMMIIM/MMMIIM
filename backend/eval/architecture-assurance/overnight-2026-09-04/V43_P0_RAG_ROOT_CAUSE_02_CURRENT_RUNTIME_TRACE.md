# V43 P0 RAG Root Cause — Current Runtime Trace

**Branch/HEAD:** `feat/v4.3-semantic-boundary-routing` /
`f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`  
**Execution:** static source inspection only; Provider calls and database writes: 0.

## Canonical material owner and policy

`CompanyMaterialService.quarantine()` validates the material and delegates to
`PgRepository.quarantineCompanyMaterial`, which updates the existing row to
`lifecycle_status='QUARANTINED'`, retains chunks and records
`quarantine_reason`/`quarantined_at`. This is a soft lifecycle transition, not a
delete. `material-source-authority-policy.js` is the canonical deterministic
projection: material id/corpus scope, lifecycle `ACTIVE`, approved review,
active usage (`ACTIVE_FULLTEXT`/`ACTIVE_EXCERPT`) and successful extraction are
required; retrieval additionally requires an indexed non-private source.

The current dirty migration 041 accepts `QUARANTINED`, and untracked migration
051 adds the reason/timestamp and quarantine-state checks. These files are
current-worktree evidence, not committed history at the known HEAD.

## Layer trace

| Layer | Current code path | Lifecycle gate | Result |
|---|---|---|---|
| Material | `CompanyMaterialService.quarantine` → `quarantineCompanyMaterial` | Owning-service transition to `QUARANTINED`; row/chunks retained | **ENFORCED** |
| New Retrieval | `listChunksForRetrieval`, `prepareRetrievalCandidates`, `searchWriterReferenceChunks` in `db.js` | SQL `MATERIAL_AUTHORITY_SQL` for enterprise-private; public branch also checks active/indexed | **ENFORCED for new search** |
| Retrieval reload | `getRetrievalRun` | Joins result/chunk/material but does not reapply lifecycle predicate | **BYPASS CANDIDATE** |
| Review proposal/context | `getEvidenceReviewCandidate`, `getEvidenceReviewContext`, `EvidenceReviewService.propose` | Project/lineage checks; no material authority predicate | **NOT ENFORCED for stale historical candidate** |
| Review decision | `EvidenceReviewService.decide` | Contract/source hash staleness only; no lifecycle check | **NOT ENFORCED** |
| Formal Evidence from retrieval | `EvidenceService.createFromRetrieval` → `EvidenceService.create` | `materialAuthorityAllows` rejects a complete non-active projection | **FAIL-CLOSED on this path** |
| Canonical Fact extraction | `EvidenceSourceFactService.extract` | Approved review/staleness checked; material lifecycle not checked before candidate upsert | **PARTIAL; draft can be produced from stale approved review** |
| Canonical Fact approval | `EvidenceSourceFactService.decide` + `getEvidenceSourceFactCurrent` | Authority projection false causes `MATERIAL_SOURCE_NOT_AUTHORIZED` on approve | **FAIL-CLOSED for approval** |
| Canonical Mapping proposal/decision | `RequirementEvidenceFactMappingService` and V1.1 repository projections | Proposal rejects non-authoritative source; `isStale` includes source authority; active prototype override also projects authority/current claim authority | **FAIL-CLOSED** |
| Canonical Claim support | active `PgRepository.prototype.getApprovedRequirementFactSupport` → `ProductionBetaService.generateClaims` → Claim Gate V2 | Shared predicate, lineage and usable-for-claims checks; quarantined support is filtered/rejected | **FAIL-CLOSED** |
| Writer safe context | `listClaims` authority projection → `buildSectionContext` → `WriterInputAuthorizationService` | current allow + writer eligibility + lineage identity; reference chunks use lifecycle-aware SQL | **ZERO canonical enterprise exposure** |

## Important runtime parity detail

`db.js` contains older class methods and later `PgRepository.prototype.*`
assignments. The active runtime uses the later V1.1 overrides for
`listRequirementEvidenceFactMappings` and
`getApprovedRequirementFactSupport`; those overrides include
`MATERIAL_AUTHORITY_SQL`. The older class method text must not be treated as the
active Claim-support contract.

## Legacy surfaces reachable from current app

| Surface | Classification | Evidence |
|---|---|---|
| `EvidenceFactService.create` → `evidence_facts` | `WRITE_REACHABLE_AUTHORITY_RISK` | `getEvidenceFactSource` exposes authority projection but service only asserts formal lineage/approval and does not consume the projection. |
| `EvidenceFactService.decide` → `decideEvidenceFact` | `WRITE_REACHABLE_AUTHORITY_RISK` | `UPDATE evidence_facts` SQL checks Evidence approval and lineage but omits `MATERIAL_AUTHORITY_SQL`. |
| `EvidenceService.decideMapping` → legacy `requirement_evidence_mappings` | `WRITE_REACHABLE_AUTHORITY_RISK` | Decision service/repository update does not revalidate source material lifecycle; proposal path does. |
| `/api/projects/:projectId/production-beta` | `INERT` by default; `READ/WRITE` only with explicit `legacyGenerationCompat` | `app.js` conditionally registers the mutation. Canonical `/claims/generate` is the normal path. |
| Canonical Claim/Writer | `INERT` to legacy fact/mapping rows | Production Claim generation requires canonical V1.1 fact mappings; writer context requires current allow/lineage. |

Legacy rows can remain readable for audit, but these legacy mutation paths are
not a safe substitute for the canonical material-authority owner.

## Runtime status summary

`MATERIAL_LIFECYCLE_ENFORCEMENT = ENFORCED` (state transition)  
`RETRIEVAL_QUARANTINE_GATE = BYPASS_FOUND` (new search is gated; stale reload is not)  
`REVIEW_QUARANTINE_GATE = NOT_ENFORCED`  
`FACT_QUARANTINE_AUTHORITY = PARTIAL`  
`MAPPING_QUARANTINE_AUTHORITY = FAIL_CLOSED` (canonical owner)  
`CLAIM_QUARANTINE_AUTHORITY = FAIL_CLOSED` (canonical owner)  
`WRITER_QUARANTINE_EXPOSURE = ZERO` (canonical assertable enterprise claims)

