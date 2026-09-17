# Phase 02 — Production Runtime Call Graph Checkpoint

**PHASE:** 02  
**OBJECTIVE:** Trace the formal HTTP-to-service-to-persistence paths without executing mutation or external calls.

## Files inspected

- `backend/src/app.js` route definitions and error handler.
- `backend/src/server.js` dependency construction.
- `backend/src/requirement-parse-service.js`, `requirement-source-service.js`.
- Material, retrieval, evidence/review/fact, mapping, claim, writer, generation, delivery and Agent services.
- `backend/src/pipeline/semantic-gateway-client.js` and task registry.

## CODE_PATHS_CONFIRMED

| Flow | Confirmed path | Status |
|---|---|---|
| FLOW-01 Create Project | `POST /api/projects` → trusted actor/project authorization → `repository.createProjectWithOwner` → `projects`/membership | CONFIRMED |
| FLOW-02 Upload Tender | `POST /api/projects/:projectId/tender-files` (or multipart create) → storage → `repository.addTenderFile` → `tender_files` | CONFIRMED |
| FLOW-03 Parse Tender | `POST /api/projects/:projectId/tender-parse-jobs` → `RequirementParseService.start` → parse job state machine → text extractor/chunks | CONFIRMED |
| FLOW-04 Requirement Extraction | parse service text/section/chunk preparation → canonical `requirement_extraction` gateway adapter → strict task envelope → candidate persistence/audit | CONFIRMED (provider-dependent) |
| FLOW-05 Canonical Requirement | source confirmation endpoints → `RequirementParseService.confirm` / `RequirementSourceService` → `buildCanonicalRequirements` + deterministic dedup/REQ IDs → `requirements`/baseline | CONFIRMED |
| FLOW-06 Material Ingest / Chunk / Embedding | company-material upload → extraction → `chunkEnterpriseMaterial` → `material_chunks`; retrieval lazily embeds missing chunks through embedding client and persists vectors | PARTIAL: embedding is coupled to retrieval, not an independent ingest job |
| FLOW-07 Requirement Retrieval | `POST /api/requirements/:requirementId/enterprise-retrieval` → `EnterpriseRetrievalService.retrieve` → canonical Requirement lookup → embedding → vector candidate preparation → rerank/hygiene → `enterprise_retrieval_runs/results` | CONFIRMED (provider/network dependent) |
| FLOW-08 Evidence Support / Review / Fact | retrieval candidate/source span → evidence review proposal endpoint → `EvidenceReviewService` + deterministic support evaluator; approved review → evidence/fact services; fact extraction may call semantic gateway | PARTIAL: multiple review/fact generations coexist |
| FLOW-09 Requirement + Fact → Mapping | mapping proposal/produce routes → `RequirementEvidenceFactMappingService` → canonical candidate builder → evaluator (provider-neutral or semantic) → mapping persistence | CONFIRMED; evaluator mode is runtime/config dependent |
| FLOW-10 Mapping → Claim Gate | `POST /claims/generate` → `ProductionBetaService.generateClaims` → approved fact-support bindings → deterministic ClaimBuilder + ClaimGateService + enterprise v2 evaluator → claims/decisions/coverage | CONFIRMED |
| FLOW-11 Claim → Writer Authorization | generation service builds section context → `WriterInputAuthorizationService` and authorization snapshot from approved/current claims, facts and bindings → persisted safe context | CONFIRMED |
| FLOW-12 Writer / Generation | `POST /document-generations` → document plan/contexts/batches → deterministic template or writer provider → task persistence → finalization | CONFIRMED; semantic writer only for non-template batches |
| FLOW-13 Validation / Revision | generation finalization → sanitizer/structure/document/coverage/critical guards; legacy path can call provider revision when sanitizer marks revision required; final sanitization/validation follows | PARTIAL: V2 and legacy finalizers coexist |
| FLOW-14 DOCX | `GET .../export-word` → `DocumentDeliveryService` → product-owned document model + DOCX renderer → export audit/storage | CONFIRMED |
| FLOW-15 Regeneration | `POST /document-versions/:versionId/chapters/:chapterId/regenerate` → generation service → parent/version/task identity checks → new version path | CONFIRMED by route; mutation persistence not run here |
| FLOW-16 Agent/Copilot | Copilot context/read/action routes → `AgentContextResolver`/`AgentToolLayer` → action policy/executor → formal services + action audit | CONFIRMED bounded path; authority bypass requires negative-test verification |

## TABLES_CONFIRMED

The route graph reaches tables listed in Phase 01: project/tender/parse/canonical Requirement, material/chunk/vector/retrieval, evidence/review/span/fact, mapping, claims/gates/coverage, writer safe context/execution, generations/versions/exports and Agent audit/previews.

## TESTS_INSPECTED

Route contracts and service tests under `backend/test`; PostgreSQL integration entry points in `backend/integration`; no live HTTP request was issued by this phase.

## CONFIRMED_FACTS

- **CONFIRMED_BY_CODE:** `server.js` creates one app with all formal services injected; no second server graph is visible in the inspected source.
- **CONFIRMED_BY_CODE:** `app.js` has a catch-all `/api` 404 JSON response and a sanitized error handler; formal routes call owning services rather than embedding business logic in frontend.
- **CONFIRMED_BY_CODE:** Requirement extraction is the only identified mandatory LLM parse stage; Response Plan and Claim generation are deterministic backend services in the current path.
- **CONFIRMED_BY_CODE:** `EnterpriseRetrievalService.retrieve` takes Requirement text from repository (`getCanonicalRequirementForRetrieval`) and persists run/result audit before returning.
- **CONFIRMED_BY_CODE:** Writer V2 finalization builds `final_text`, `sections_json`, validation and a DocumentVersion; explicit confirm is a separate route.

## CONFLICTING_FACTS

- **CONFLICTING:** legacy generation/revision methods remain in the same service files beside V2 paths; source alone cannot prove the legacy flag is off in every deployed runtime.
- **CONFLICTING:** mapping route uses `SemanticGatewayMappingEvaluator` in `server.js`, while service defaults to a provider-neutral evaluator when constructed elsewhere; tests/fixtures may exercise both.

## UNKNOWN_AREAS

- Current running process and DB migration version; no runtime calls were made.
- Whether lazy embedding has been completed for every material chunk in current DB.
- Whether all finalizer/revision branches execute identical sanitizer/validator order under every configuration.

## LOCAL_ONLY_FACTS

- Call graph is derived from the dirty local source at the Phase 00 fingerprint; no production deployment claim.

## P0_RISKS

- **P0-RUNTIME-001:** dual finalization and evaluator construction modes require a runtime configuration proof before any production readiness claim.

## P1_RISKS

- **P1-RUNTIME-002:** lazy embedding means retrieval is both query and ingest boundary; partial failures can leave chunks without vectors.
- **P1-RUNTIME-003:** semantic mapping/fact extraction depend on external Gateway availability and strict envelope validity.

## P2_RISKS

- **P2-RUNTIME-004:** route registration is concentrated in a large `app.js`, increasing drift risk between endpoint and service contracts.

## TECH_DEBT

- Legacy generation API remains opt-in compatibility; V2 and legacy generation/revision paths should converge only under a separately authorized task.

## ARCHITECTURE_DRIFT

- **AD-02-001:** documented “single pipeline” intent coexists with legacy route/service branches and multiple mapping/evidence generations.

## NEXT_DEPENDENCY

Phase 03 authority audit must inspect object creators, reviewer fields, final authorities and whether adapter outputs can create authority without prior approval.

## SAFE_TO_CONTINUE

**YES** — graph is sufficiently traced for authority analysis; no provider, DB or business mutation performed.
