# V43 Production-Shaped Flow Completion Gap Inventory

## Scope and authority

This is a read-only inventory of the current dirty worktree. It does not run a
Provider/LLM, write the production database, alter Gold, or modify production
code. The target flow is read from
`docs/architecture/V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE.md`; current
code and tests are the AS-IS authority.

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Worktree: dirty before this inventory; many pre-existing tracked and
  untracked changes are preserved.
- Provider calls: `0`
- Production DB writes: `0`
- Production semantic changes: `0`
- Runtime smoke: not executed; local backend/PostgreSQL ports were not
  available to this sandbox.

## Current production-shaped nodes

| Node | Status | Entry API / caller | Owner and persistence | Identity in/out | Next consumer | Blocker |
|---|---|---|---|---|---|---|
| Project Create | EXISTS_AND_WIRED | `POST /api/projects` → `createProjectWithOwner` | `PgRepository`; `projects`, membership | project identity in/out | Tender Upload | none observed |
| Tender Upload | EXISTS_AND_WIRED | `POST /api/projects/:projectId/tender-files` | `LocalFileStorage` + `tender_files` | project/file/storage key | Parse | none observed |
| Parse | EXISTS_AND_WIRED | `POST /api/projects/:projectId/tender-parse-jobs` → `RequirementParseService` | parse jobs/chunks/candidates | project, tender file, parse job, chunk | Canonical Requirement | provider/runtime availability can fail the job |
| Canonical Requirement | EXISTS_AND_WIRED | parse confirmation → baseline repository methods | `RequirementSourceService`; `requirements`, `requirement_baselines` | requirement ID, source status, source refs | current response planning; Router is not called | Router edge absent |
| Response Router | EXISTS_NOT_WIRED | no production HTTP caller found | read-only modules `requirement-response-router*.js`; Eval tests | projection has requirement ID; no persisted production route | intended four response lanes | no `ResponseRouterService` integration |
| SOLUTION lane | PARTIAL | no router lane; deterministic ResponsePlan/Writer chapter routing is separate | `ProductionBetaService`, `chapter-router` | requirement/plan identity | Writer through old path | no Safe Response Packet |
| EVIDENCE lane | PARTIAL | retrieval/review routes are independently callable | Retrieval, Evidence Review, Fact, Mapping, Claim services | project/requirement/material/chunk/fact/mapping IDs | Claim Gate/Writer | not router-selected |
| COMMITMENT lane | PARTIAL | project-fact routes | `ProjectFactControlService`; project fact tables | project fact/version/provenance | writer authorization when applicable | no router decision projection |
| COMPLIANCE lane | PARTIAL | RiskReview/document validator and review center | `document-validator`, `ReviewCenterService` | project/version/requirement IDs | human confirmation | no ComplianceMatrixProjection |
| Retrieval | EXISTS_AND_WIRED | `POST /api/requirements/:requirementId/enterprise-retrieval` | `EnterpriseRetrievalService`; retrieval runs/results | requirement/project/run/chunk | Evidence Review | none observed in code path |
| Evidence Review | EXISTS_AND_WIRED | evidence-review GET/proposal/decision routes | `EvidenceReviewService`; review records | review, requirement, retrieval, source span | Fact | no unified Gate A view |
| Approved Evidence Fact | EXISTS_AND_WIRED | `POST /api/evidence-reviews/:reviewId/facts` + decision routes | `EvidenceSourceFactService`; `evidence_source_facts` | fact/review/span/material/project | canonical Mapping | source authority gate is enforced |
| Requirement↔Fact Mapping | EXISTS_AND_WIRED | canonical mapping produce/decision routes | `RequirementEvidenceFactMappingService`; canonical mapping table | mapping/requirement/fact/project | Claim Gate | legacy mapping routes also remain; target must use canonical route |
| Claim / authorization | EXISTS_AND_WIRED | `/claims/generate`, claim decision routes | `ProductionBetaService` + `ClaimGateService`; claims/decisions/evaluations | claim/gate/input/source hashes | Writer Authorization | no Router input |
| Project/Human Decision | PARTIAL | project-fact approve/reject/edit and ReviewCenter impact | `ProjectFactControlService` | project fact/version/provenance | Writer context | no explicit commitment decision projection |
| Safe Response Packet | MISSING | no production builder/endpoint found | no packet persistence or packet hash found | no packet identity | intended Writer input | target contract not wired |
| Writer | EXISTS_AND_WIRED | `POST /api/projects/:projectId/document-generations` | `DocumentGenerationService`, Writer Authorization/Safe Context, provider adapter | generation/task/chapter/safe-context hash | Draft persistence | consumes legacy generation snapshots, not Safe Packet |
| Draft persistence | EXISTS_AND_WIRED | generation tasks and versions | `document_generations`, `document_generation_tasks`, `document_versions` | generation/task/version/chapter | Pre-check | none observed |
| Pre-check / deterministic validation | EXISTS_AND_WIRED | finalize/retry paths | Writer guard, sanitizer, `document-validator`, coverage validator | validation/rule-version/snapshot | final reconciliation | no dedicated packet-level check |
| Final Requirement Reconciliation | PARTIAL | coverage validator + version risk review | `CoverageValidator`, `document-validator` | requirement IDs and coverage snapshots | Human/Bid Pilot review | no explicit final reconciliation artifact/API |
| Review Findings / Bid Pilot | PARTIAL | review-center and copilot routes/UI | `ReviewCenterService`, `BidCopilotOrchestrator`, action audits | project/action/preview IDs | Human confirmation | read-only projection exists; unified finding bundle absent |
| Human confirmation | EXISTS_AND_WIRED | `POST /api/document-versions/:versionId/confirm` and review-decisions | `GenerationService.confirmVersion` | version/project/actor | final version | no unified Gate A confirmation UI |
| Final document/version persistence | EXISTS_AND_WIRED | atomic finalize, version confirm, Word export | `PgRepository`, `DocumentDeliveryService` | project/version/export IDs | delivery | none observed |

Node summary: 14 `EXISTS_AND_WIRED`, 7 `PARTIAL`, 1
`EXISTS_NOT_WIRED`, 1 `MISSING` (the Safe Response Packet), and 0 nodes with
an observed authority-sensitive fail-open path. The Router/Safe Packet gaps are
flow blockers, not semantic contract findings.

## Authority and boundary audit

| Invariant | Current evidence | Result |
|---|---|---|
| LLM output becomes authority automatically | Requirement confirmation, Evidence review, Fact decision, Mapping decision and Claim Gate are separate routes/services. | NOT_OBSERVED |
| Unapproved Fact reaches Writer | Writer input authorization and Safe Context require current authorized lineage; document generation consumes approved snapshots. | NOT_OBSERVED; entry-point regression exists in writer tests |
| Mapping approval equals Claim approval | `ProductionBetaService.generateClaims` invokes Claim Gate and persists gate evaluations separately. | NOT_OBSERVED |
| Claim allow automatically grants Writer visibility | Writer authorization snapshot/current gate identity and task validation are separate checks. | NOT_OBSERVED |
| Reference material becomes enterprise authority | Material/source-role and evidence lineage gates are used before formal evidence/fact paths. | NOT_OBSERVED |
| Historical enterprise Fact becomes Commitment | Project Fact control requires project-scoped provenance/version; no automatic promotion path found. | NOT_OBSERVED |
| Bid Pilot approval writes authority directly | Copilot action execution routes through existing services and supports human approval/preview/audit. | NOT_OBSERVED |
| Downstream expands upstream authority | Existing canonical Claim/Writer checks retain current source/gate identities. | NOT_OBSERVED |

The inventory therefore does not classify the current state as
`BLOCKED_FLOW_COMPLETION_AUTHORITY_CONFLICT`. The missing orchestration still
has to preserve these boundaries when implemented.

## Frontend user-action coverage

| User action | Status | Current surface | Smallest missing action |
|---|---|---|---|
| Create/open project | EXISTS | `CreateProject`, `ProjectList`, `Workspace` | none |
| Upload tender | EXISTS | `TenderFiles`, project create/upload APIs | none |
| Observe parse state | EXISTS | `RequirementParsing`, parse job polling | none |
| Review/confirm Requirement state | EXISTS | candidate source review and baseline confirmation | unified decision summary is optional |
| Trigger/observe Response Router | MISSING | no route, API method, or UI projection | add read-only route action showing response mode/risk/next action |
| Resolve human decisions | PARTIAL | `EvidenceReview`, `ReviewWorkbench`, `RiskReview` | one project-scoped Gate A task list linking existing decisions |
| Select enterprise materials | EXISTS | `CompanyMaterials`, `EvidenceReview`, material processing | none |
| Trigger generation | EXISTS | `BidDocument` → document generations | none |
| View pre-check | PARTIAL | chapter preview, warnings, `RiskReview` | expose deterministic pre-check summary before confirmation |
| Final requirement reconciliation | MISSING | coverage/risk data exists but no dedicated view/API | show requirement coverage/findings with source IDs and status |
| Finalize/save document version | EXISTS | confirm version and versions tab | none |
| Review findings / Bid Pilot read-only | PARTIAL | `ReviewWorkbench`, `BidCopilot` and previews | expose final finding bundle/read-only packet |

## Failure and recovery inventory

| Failure point | Current behavior | Classification | Authority-sensitive fail-open |
|---|---|---|---|
| Parse failure/provider timeout | parse chunk/job failure is persisted with error code and job becomes failed; user can re-run parse | FAIL_CLOSED + RECOVERABLE | NO |
| Partial generation failure | failed task/generation state is persisted; bounded retry-batches exists | FAIL_CLOSED + RECOVERABLE | NO |
| Retrieval empty | run/results can be empty; no Evidence is auto-created | FAIL_CLOSED + RECOVERABLE | NO |
| Fact not approved | Fact decision is separate; mapping/claim support queries require approved/current records | FAIL_CLOSED | NO |
| Mapping not approved | Claim generation filters for approved canonical support and re-evaluates Claim Gate | FAIL_CLOSED | NO |
| Claim not allowed | Claim Gate decision is persisted and Writer authorization blocks invalid lineage/assertions | FAIL_CLOSED | NO |
| Project decision missing | project-fact controls expose pending/conflict state; no router-level commitment projection exists | FAIL_CLOSED at existing fact/writer boundary; routing behavior UNKNOWN | NO observed |
| Safe Packet incomplete | no Safe Packet runtime object exists, so packet-level behavior is not implemented | UNKNOWN / NOT_IMPLEMENTED | Not an observed fail-open; flow blocker |
| Writer failure | task/generation failure is stored, with bounded manual retry | FAIL_CLOSED + RECOVERABLE | NO |
| Deterministic validation failure | critical validation marks generation/version critical and blocks confirmation/export | FAIL_CLOSED + RECOVERABLE | NO |
| Final reconciliation finding | coverage/risk findings persist and affect confirmation; no dedicated final reconciliation API | FAIL_CLOSED for current risk gate; target-level behavior PARTIAL | NO |

## P0/P1/P2 gaps

### P0 flow blockers

1. Canonical Requirement has no production Response Router invocation. The
   existing `requirement-response-router-v2-1.js` is an Eval/read-model module.
2. Safe Response Packet is absent as a production orchestration boundary. The
   current Writer path consumes generation snapshots and Writer Safe Context,
   not the target packet identity.
3. The four lanes are not unified into one project/requirement flow. Evidence
   and Project Fact services are callable independently, while SOLUTION and
   COMPLIANCE have no target-lane handoff.
4. There is no final requirement reconciliation artifact/API that joins
   requirement coverage, validation findings, unresolved decisions and final
   version identity for the Bid Pilot/Human step.

### P1 flow blockers

1. No project-scoped Response Decision read model/endpoint for the frontend.
2. No unified Gate A decision task list; decisions are spread across Evidence
   Review, Review Center, Project Fact and Risk Review.
3. No Compliance Matrix projection/interaction surface; current risk review is
   version-centric.
4. Bid Pilot can explain/preview existing actions, but is not fed a final
   requirement/reconciliation packet.

### P2 after first E2E

1. End-to-end idempotency/retry evidence across the new orchestration edges.
2. Unified audit correlation across router → packet → writer → reconciliation.
3. Runtime smoke/contract tests for all lane transitions and environment
   availability.

## Required safety decision

The gaps are additive orchestration/read-model gaps. This inventory found no
need to change Requirement, Evidence, Fact, Mapping, Claim, Writer, or source
authority semantics. The next decision can therefore be an implementation
decision for minimal flow glue, subject to preserving the existing authority
tests and adding real entry-point tests.

## Final inventory status

`READY_FOR_GPT_FLOW_COMPLETION_IMPLEMENTATION_DECISION`
