# V43 P0 Remediation and Writer V2 Pre-implementation Checkpoint

Status: `V43_P0_REMEDIATION_AND_WRITER_V2_PREIMPLEMENTATION_CHECKPOINT`

## Baseline

- Source checkpoint: `06_global_engineering_quality_audit_checkpoint.md`
- Source SHA-256: `4aeb53ec2f1d7ace41f730b7769b4fab141aef2e892fbb2ccd0cee33d950c3e7` (`PASS`)
- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD at task start: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Mapping producer: `MAPPING_BLOCKED` (the default evaluator remains `null`)
- Large live: `LARGE_EVIDENCE_CHAIN_LIVE_NOT_EXECUTED`

## 1. P0 summary

| Finding | Result | Executable evidence |
| --- | --- | --- |
| AUTH-001 formal mutation project authorization | `FIXED` | `formal-mutation-authorization.test.js` (`5/5`) plus affected HTTP fixtures |
| DATA-001 Canonical Fact set/edit atomicity | `FIXED` | `FACT-TX01..FACT-TX05` |
| DATA-002 Canonical Mapping replacement atomicity | `FIXED` | `MAP-TX01..MAP-TX04` |
| SEC-001 repository/log exposure | no tracked token and no explicit production key logging found | tracked-source and logging-path scans |
| SEC-001 credential rotation | `PROVIDER_CREDENTIAL_ROTATION = MANUAL_REQUIRED` | repository contains no authorized rotation API |

P0 implementation files:

- `backend/src/app.js`
- `backend/src/db.js`
- `backend/src/evidence-source-fact-service.js`
- `backend/src/requirement-evidence-fact-mapping-service.js`
- `backend/test/canonical-persistence-atomicity.test.js`
- `backend/test/formal-mutation-authorization.test.js`
- `backend/integration/postgres.integration.js`
- `backend/integration/sem-p1-004-entry-matrix.integration.js`
- affected authorization fixtures in `agent-actions`, `agent-foundation`, `document-delivery`, `mapping-to-claim-entrypoint`, `p0-framework-remediation`, `review-center`, `sem-p1-004-canonical-entrypoint`, `tender-parse`, and `fixtures/stage13-material-acceptance` tests.

No migration, DB schema, Prompt, Semantic Schema, Canonical Fact Contract, Mapping Contract, Requirement Contract, Source Hash rule, or Claim Gate rule changed.

Credential rotation must be performed manually: revoke/rotate in the Provider console; write the replacement only to the active Gateway secret environment (`services/semantic-gateway/.env`, ignored; variable `SEMANTIC_GATEWAY_PROVIDER_API_KEY`); restart the Gateway; verify health/ready; never paste the key into chat, logs, fixtures, or audit artifacts. Full secret values printed by this task: `0`.

## 2. Authorization matrix

One shared HTTP boundary in `backend/src/app.js` calls `ProjectAuthorizationService.assertProjectAccess()` before authority-bearing writes. Project-scoped routes use `:projectId`; ID-only routes resolve the owning project first. Canonical Review-to-Fact extraction is deliberately skipped by the shared middleware because `EvidenceSourceFactService.extract()` already owns the trusted actor/project check.

Project creation is the one pre-membership exception: `POST /api/projects` validates the trusted server actor and calls `createProjectWithOwner()` atomically, establishing the new project and its owner membership. It cannot assert access to a project that does not exist yet. Subsequent tender-file mutation is project-authorized.

| Formal mutation endpoint | App handler / project resolution | Owning service | Repository write boundary | Negative evidence |
| --- | --- | --- | --- | --- |
| `POST /api/projects` | trusted actor resolver (pre-membership creation) | app creation handler | `createProjectWithOwner`, optional `addTenderFile` | request-body actor cannot replace trusted actor |
| `POST /api/projects/:projectId/tender-files` | project-scoped middleware | app upload handler/storage | `addTenderFile` | non-member blocked before storage/repository mutation |
| `POST /api/projects/:projectId/requirements/:requirementId/evidence-reviews` | project-scoped middleware | `EvidenceReviewService.propose` | `upsertEvidenceCandidateReview` | non-member blocked before handler |
| `POST /api/evidence-reviews/:reviewId/:decision` | `getEvidenceReviewProject` | `EvidenceReviewService.decide` | invalidate/decide review | ID-route denial covered |
| `POST /api/projects/:projectId/evidence-reviews/:reviewId/facts` and ID-only equivalent | owning-service authorization; ID route resolves review project | `EvidenceSourceFactService.extract` | `upsertEvidenceSourceFactsAtomic` | cross-project and missing auth context fail closed |
| `POST /api/evidence-source-facts/:factId/:decision` | `getEvidenceSourceFactCurrent` | `EvidenceSourceFactService.decide` | fact review decision | ID-route denial covered |
| `POST /api/projects/:projectId/requirement-evidence-fact-mappings` | project-scoped middleware | `RequirementEvidenceFactMappingService.propose` | `replaceRequirementEvidenceFactMappingAtomic` | AUTH-T02, AUTH-T03, MAP-TX04 |
| `POST /api/requirement-evidence-fact-mappings/:mappingId/:decision` | `getRequirementEvidenceFactMappingCurrent` | mapping service `decide` | mapping review decision | ID-route denial covered |
| `POST /api/project-facts/:factId/:decision` and `/edit` | `getProjectFactCurrent` | `ProjectFactControlService` | decide/invalidate/upsert plus propagation invalidation | ID-route denial covered |
| `POST /api/projects/:projectId/response-plans/generate`, `PATCH .../:requirementId` | project-scoped middleware | `ProductionBetaService` | replace/edit response plans | non-member blocked before service |
| `POST /api/projects/:projectId/claims/generate` | project-scoped middleware | `ProductionBetaService.generateClaims` | replace claims and coverage | non-member blocked before service |
| `POST /api/claims/:claimId/approve|reject` | `getClaimProject` | `ProductionBetaService.decideClaim` | decide claim and replace coverage | AUTH-T04 revoked membership |
| `POST /api/projects/:projectId/document-generations` | project-scoped middleware | `DocumentGenerationService.generate` | generation/tasks/version writes | non-member blocked before generation |
| `POST /api/document-generations/:generationId/retry-batches` | `getDocumentGeneration` | `DocumentGenerationService.retry` | reset/finish tasks and version writes | ID-route denial covered |
| `POST /api/document-versions/:versionId/confirm`, chapter regenerate | `getPipelineDocumentVersion` | generation/document generation services | confirmation/regenerated version writes | ID-route denial covered |
| `GET .../export-word` (audit-producing operation) | project-scoped export-write branch | `DocumentDeliveryService.exportWord` | `createDocumentExport` | project authorization required |
| legacy Evidence create/decide/validity/mapping/fact endpoints | project middleware or `getEvidenceRecord`, `getRequirementEvidenceMappingProject`, `getEvidenceFactByIdentifier` | `EvidenceService` / `EvidenceFactService` | legacy Evidence/Mapping/Fact writes | ID-route denial plus staging negative controls |
| Tender parse/confirm/provisional and Requirement Candidate decisions | project middleware, `getParseJob`, or candidate-to-parse-job resolver | parse/source services | parse/baseline/candidate writes | candidate resolver uses `sourceReview.candidate.parse_job_id`; ID-route denial covered |
| retrieval materialization and company material upload | project-scoped middleware or Requirement resolver | retrieval/material services | material, retrieval run, staging candidate writes | project authorization required |
| Copilot action execution and document review decisions | project-scoped or version resolver | agent/generation services | delegated formal writes | affected HTTP fixture regressions pass |

Authorization behavior:

- AUTH-T01 trusted member: `PASS`.
- AUTH-T02 trusted non-member: 403 before formal write, `PASS`.
- AUTH-T03 Project A member mutating Project B: 403 and zero writes, `PASS`.
- AUTH-T04 revoked membership: 403 before Claim write, `PASS`.
- AUTH-T05 request-body actor spoofing cannot replace the trusted server actor, `PASS`.

## 3. Transaction matrix

| Mutation | Preparation boundary | Transaction owner | Atomic sequence | Rollback proof |
| --- | --- | --- | --- | --- |
| Fact create set | `EvidenceSourceFactService.extract` creates and validates the complete canonical set in memory | `PgRepository.upsertEvidenceSourceFactsAtomic` | `BEGIN` -> insert complete set -> `COMMIT` | later canonical failure gives 0 writes; second insert failure rolls back all (`FACT-TX02/03`) |
| Fact edit | service prepares replacement and lifecycle inputs before persistence | `PgRepository.replaceEvidenceSourceFactAtomic` | `BEGIN` -> invalidate predecessor -> insert successor -> `COMMIT` | insert failure restores predecessor currentness (`FACT-TX04`); success lifecycle preserved (`FACT-TX05`) |
| Mapping replace | evaluator/canonical mapping preparation remains outside the transaction | `PgRepository.replaceRequirementEvidenceFactMappingAtomic` | `BEGIN` -> invalidate obsolete current -> upsert replacement -> `COMMIT` | insert failure leaves old mapping current and Claim/Readiness cannot observe half-state (`MAP-TX02/03`) |

Owning services have no per-row/split-write compatibility fallback. Missing atomic repository capability fails with `FACT_ATOMIC_PERSISTENCE_REQUIRED` or `MAPPING_ATOMIC_PERSISTENCE_REQUIRED`.

## 4. Test results

| Test scope | Result |
| --- | --- |
| Final focused authorization/atomicity/Fact/Mapping/Claim replay | `19/19 PASS` |
| Earlier combined focused P0/downstream set | `103/103 PASS` |
| Additional affected HTTP fixture suites | `53/53 PASS` |
| PostgreSQL integrations | `52/52 PASS` |
| Backend full suite | `1008/1015 PASS` |
| Lint | `PASS` |
| Frontend production build | `PASS` |
| Syntax checks | `PASS` |
| `git diff --check` | `PASS` (line-ending warnings only) |

The seven full-suite failures are pre-existing dirty-worktree assertions outside this P0 patch: three Governance wording checks, two Requirement evaluation/Gold checks, and two Requirement Extraction decision/runtime wording checks. No P0 executable authorization or transaction behavior regressed; per task instruction the Markdown wording assertions were not modified merely to obtain green output.

## 5. Writer current composition

`CURRENT_PRODUCTION_WRITER_PATH`:

```text
POST /api/projects/:projectId/document-generations
-> DocumentGenerationService.gate()
-> PgRepository.getDocumentGenerationInput()
-> buildWriterBatches() using chapterConfig / routed approved Claims
-> routeBatchGeneration()
-> deterministic template OR WriterProvider.section_drafting
-> mergeWriterSections()
-> inline sanitizeDocument()/validateDocument()
-> optional WriterProvider.targeted_revision
-> createPipelineDocumentVersion()
-> bid-document-model -> document-structure-validator -> docx-renderer
```

`backend/src/server.js` constructs only this `DocumentGenerationService`. It does not construct `WriterInputAuthorizationService` or `WriterExecutionService`.

Component classification:

| Component | Classification | Evidence / disposition |
| --- | --- | --- |
| `pipeline/document-generation-service.js` | `ACTIVE_PRODUCTION`, then `REPLACE_IN_PLACE` | active server composition and persistence shell; retain the service entrypoint/lifecycle while replacing its input/batch/guard internals |
| `pipeline/document-generation.js` | `ACTIVE_PRODUCTION`, `RETIRE_AFTER_V2` in current composition role | current chapter batches plus duplicate inline sanitizer/validator |
| `pipeline/writer-provider.js` | `ACTIVE_PRODUCTION`, `REUSE` | existing Semantic Gateway drafting/revision adapter |
| `pipeline/batch-generation-router.js` | `ACTIVE_PRODUCTION`, `REVIEW/RETIRE_AFTER_V2` | current deterministic/simple-vs-semantic routing belongs to old batch composition |
| `pipeline/chapter-config.js`, `chapter-router.js` | `ACTIVE_PRODUCTION`, later fallback only | current fixed structure authority; demote to default technical-bid template/router |
| `pipeline/deterministic-response-plan-builder.js` | `ACTIVE_PRODUCTION`, `REUSE` for requirement intent | already assigns Requirement-to-section targets; adapt to DocumentPlan IDs rather than create a second planner |
| `pipeline/bid-document-model.js`, `document-structure-validator.js`, `docx-renderer.js`, `document-delivery-service.js` | `ACTIVE_PRODUCTION`, `REUSE` | delivery projection/validation/rendering, not a competing writing-plan authority |
| `pipeline/writer-input-authorization-v1.js`, `writer-input-authorization-service.js` | `CANDIDATE_V2` | existing Project Fact/Claim safe-context authority boundary |
| `pipeline/writer-execution-contract-v1.js`, `writer-execution-service.js` | `CANDIDATE_V2` | Critical Assertion Guard, Mention Ledger, exact reference and propagation verification |
| `pipeline/external-writer-preflight-v1.js`, `external-writer-execution-lifecycle.js` | `TEST_ONLY` / `CANDIDATE_V2 evidence` | used by tests and eval runners, not server composition; reuse its proven contracts, not its synthetic/eval execution shell |
| `pipeline/document-sanitizer.js`, `document-validator.js`, `generation-audit.js` | `ACTIVE_SHARED` | used by the older generation/audit path and tests; converge with the inline document-generation validators rather than retain duplicates |
| `pipeline/coverage-validator.js` | `ACTIVE_PRODUCTION`, `REUSE` | ProductionBeta gate before Writer |

There are currently two composition families: active `DocumentGenerationService`, and the unconnected but tested Safe Context/Writer Execution family. V2 is allowed only as their convergence; creating a third endpoint/service/persistence flow is forbidden.

## 6. Writer V2 target

`TARGET_WRITER_V2_PATH`:

```text
existing document-generation HTTP entry and lifecycle shell
-> DocumentPlan (single structure plan)
-> existing WriterInputAuthorizationService as SectionContextBuilder authority boundary
-> thin read-only WriterReferenceSelector over current chunks/embeddings
-> budget-aware GenerationBatchBuilder (2-4 related sections only when within the existing estimator cap)
-> existing WriterProvider
-> existing WriterExecution Contract: output validation + Critical Assertion Guard + Mention Ledger + propagation verification
-> existing sanitizer / coverage / structure validators
-> existing version persistence
-> existing bid-document-model / DOCX renderer
```

Backend chooses structure, authorized facts/claims, references, and restrictions. The LLM only drafts expression. Reference snippets stay context-only and cannot become Evidence, Fact, Mapping, approved Claim, or Project Fact.

## 7. Reuse / replace / retire

Reuse:

- `writer-input-authorization-v1.js` and `writer-input-authorization-service.js` for `SectionContext.project_facts` and assertable Claim authorization.
- `writer-execution-contract-v1.js` and `writer-execution-service.js` for exact reference validation, Critical Assertion Guard, Mention Ledger, propagation verification, and writer output lifecycle.
- `writer-provider.js` for the existing Semantic Gateway adapter.
- `coverage-validator.js`, `document-sanitizer.js`, `document-validator.js`, `document-structure-validator.js`, `bid-document-model.js`, `docx-renderer.js`.
- Existing `company_materials`, `material_chunks`, `material_chunk_embeddings`, and their material-type/project/scope filters.

Replace in place:

- `DocumentGenerationService.gate/buildWriterBatches/runBatches` composition, while retaining the public service entry, generation/task/version lifecycle, regeneration, and repository persistence shell.
- Fixed chapter assignment as primary structure authority with DocumentPlan.

Retire/demote after V2 parity is executable:

- `document-generation.js` current batch composition and duplicate inline validator ownership.
- `batch-generation-router.js` where it duplicates the V2 GenerationBatch decision.
- `chapter-config.js` and `chapter-router.js` as primary authority; retain only as `DEFAULT_TECHNICAL_BID_TEMPLATE`/fallback.
- Eval-only external Writer orchestration must not be promoted as a separate production path.

## 8. Document plan findings

1. The current eleven chapters are created by `chapter-config.js` (`4.3-chapters-1`) and assigned by `chapter-router.js` / `DeterministicResponsePlanBuilder`.
2. They are the current production structure source, but no formal contract requires those IDs to remain the sole authority; they can be a default/fallback template.
3. Tender parsing exposes section/clause/title signals (`source_section`, `detected_section_title`, `source_clause_id`) and table layout metadata, but no persisted canonical parent-child Tender TOC is available. V1 must therefore use available titles where reliable and fall back deterministically; it must not claim full Tender hierarchy recovery.
4. DOCX rendering needs ordered sections with stable `section_id`, title/order, and content blocks. It does not require the fixed eleven IDs.
5. Minimal DocumentPlan `{section_id,parent_id,title,role,requirement_ids}` can be the unique structure plan and be projected into existing `sections_json`/`bid-document-v1`; no second Document Model is required.
6. `chapter-config.js` and `chapter-router.js` can become `DEFAULT_TECHNICAL_BID_TEMPLATE` and fallback routing.

No DocumentPlan stop condition was found: the renderer is compatible and no Canonical Requirement, Source Hash, Fact, Mapping, or Claim Gate contract needs to change.

## 9. Reference retrieval findings

- Existing storage supports `technical_solution` and `technical_whitepaper` material types.
- `material_chunks` and `material_chunk_embeddings` already carry stable chunk/hash/embedding identity.
- Repository retrieval SQL already filters project/corpus scope and `material_type`, and orders vector similarity.
- Therefore a V1 `WriterReferenceSelector` can be a thin read-only consumer using `section title + requirement text`, current embeddings, `material_type IN ('technical_solution','technical_whitepaper')`, similarity, deterministic dedup, and Top 2-4.
- It requires no DB migration, new index, re-chunk, re-embedding, Source Hash change, Evidence Retrieval contract change, Evidence Review write, or Fact write.
- `EnterpriseRetrievalService.retrieve()` itself is not suitable as the Writer selector because it requires a canonical Requirement UUID and persists retrieval runs/results and missing embeddings. Reuse the storage/query semantics through a small read-only repository query rather than calling that side-effecting service.
- `material_role` is not needed.

Authority guard: Writer references are inspiration/context only. They cannot be added to `assertable_claims`; otherwise enterprise-claim leakage would bypass Evidence/Fact/Mapping/Claim Gate.

## 10. Project Fact findings

- `ProjectFactControlService` is active production authority and persists reviewed/versioned Project Facts with provenance and propagation invalidation.
- Current drafting input from `getDocumentGenerationInput()` contains project, baseline, requirements, plans, claims, evidence, and coverage, but no Project Facts or Writer Safe Context.
- Approved Project Facts currently enter only the delivery projection for document fields/cover through `DocumentDeliveryService.prepareExport()` -> `buildBidDocumentModel()`; they do not govern draft generation.
- The tested Writer PRE path can project approved, non-conflicting Project Facts into `createWriterSafeContext()`, but it is not composed in `server.js`.
- Therefore the current production Writer bypasses Project Fact control during drafting. V2 must make `SectionContext.project_facts` a runtime projection owned by the existing Writer Input Authorization service, not a new `LockedFacts` authority.
- Direct duplicate Claim/Evidence projection in the old batch input should be removed only as the V2 path replaces it and after parity tests prove the new production entrypoint uses Safe Context.

## 11. Validator findings

| Capability | Existing owner | Production active | V2 action |
| --- | --- | --- | --- |
| numeric/date/SLA/person/qualification assertions | `guardCriticalAssertions` | PRE/tested, not active generation | reuse and wire into active path; light regex/domain extension only with executable evidence |
| Requirement coverage | `CoverageValidator`, final document validator | yes | reuse |
| Project Fact conflict/currentness | `ProjectFactControlService`, Writer Input Authorization | authority active; Writer projection inactive | reuse, wire Safe Context |
| reference-to-enterprise-claim leakage | Claim Gate plus Safe Context assertable claims | authority exists | enforce by keeping reference items context-only; no new claim authority |
| structure markers/hierarchy | `document-structure-validator` and `bid-document-model` | delivery active | reuse |
| exact output references | Writer Execution contract | PRE/tested | reuse |
| mention/provenance/propagation | Mention Ledger and propagation verification | PRE/tested | reuse |
| commercial/third-party/fixed-commitment sanitation | `document-sanitizer` / `document-validator` and inline generation validator | active but duplicated | converge ownership, do not add `writer-validator-v2` |
| revision | `WriterProvider.revise`, regeneration preview/apply | active | retain, but validate through the same consolidated guard stack |
| cross-section consistency | Project Fact propagation + mentions provide partial coverage | partial | real gap: add only an assembly-level check over existing stable fact/claim identities; no new semantic authority |

The real implementation gaps are wiring, validator convergence, context-only reference enforcement, and a light cross-section consistency check. Evidence does not justify a second full validator.

## 12. Performance estimate

Offline workload: frozen semantic-boundary Gold packets (`FAST-01`, `FAST-WATER-01`, `TB-006`), 199 Gold total. Category mapping yields 185 Writer-eligible Requirements; 14 `constraint` items are excluded by the current Writer category gate. One approved Claim and one deterministic response plan were synthesized per eligible Gold solely to exercise the existing pure batch builder; no Provider or DB call occurred.

`CURRENT_WRITER_ESTIMATE`:

- Requirements: `185` eligible / `199` total.
- Active chapters: `6` (`chapter-04` through `chapter-09` where routed content exists).
- Current batches/calls: `6`.
- Existing `estimated_tokens` sum: `43,775` (current `JSON length / 2` estimator at claim/plan grouping boundary).
- Serialized batch inputs: `94,888` chars, `47,444` char/2 tokens.
- Repeated serialized Claim content: `53,442` chars vs `48,734` unique Claim chars; duplicate routed Claim payload: `4,708` chars.
- Per-chapter estimator: `7,253 / 7,130 / 3,156 / 7,269 / 18,286 / 681`.
- The repository has no calibrated expected-output-token estimator; expected output tokens are therefore `NOT_INSTRUMENTED` and are not invented here.

Naive `WRITER_V2_ESTIMATE` with three related current chapters per batch:

- Sections: `6`; batches/calls: `2`; nominal call reduction: `66.67%`.
- Serialized inputs after sharing only the project envelope: `94,690` chars / `47,345` char/2 tokens; proven input reduction only `0.21%`.
- Group 1 (`04/05/06`): `38,601` chars, 67 unique Requirements.
- Group 2 (`07/08/09`): `56,089` chars, 122 unique Requirements.
- This naive grouping creates an oversized second batch relative to the existing 20,000 estimator budget; it is not an acceptable implementation.

Safe V2 interpretation:

- Call reduction from section grouping is plausible, but token reduction is not proven until SectionContext deduplication and Top 2-4 reference selection are implemented and measured.
- GenerationBatchBuilder must enforce the existing token budget first. The “2-4 related sections” target applies only when the combined batch fits; dense service content must be split into smaller DocumentPlan sections/batches.
- Output volume is expected to remain driven by document content, not call count; only call/envelope overhead is reduced. No cost claim is made without runtime token telemetry.

## 13. Writer implementation gate

`WRITER_V2_IMPLEMENTATION_READY`

The architecture is implementable without changing Canonical Requirement, Source Hash, Canonical Fact, Canonical Mapping, Claim Gate, DB schema, or DOCX model. Readiness is conditional on these executable implementation constraints:

1. Converge the two existing composition families through the active `DocumentGenerationService`; do not add a third path.
2. Reuse Writer Input Authorization and Writer Execution contracts as the active SectionContext/guard owners.
3. Make DocumentPlan the single generated structure plan; use the eleven chapters only as fallback.
4. Keep Writer references read-only/context-only and reuse current embeddings/material types without Evidence/Fact writes.
5. Enforce estimator budget before the 2-4 section grouping preference.
6. Add production-entrypoint parity tests proving the active server path uses Safe Context, Critical Assertion Guard, Mention Ledger, and consolidated validators before retiring old composition code.

## 14. Mapping status

`MAPPING_BLOCKED`

The default Mapping evaluator/producer remains `null`. P0 transaction and authorization repairs do not implement Mapping production and do not make the evidence chain ready.

## 15. Large live status

`LARGE_EVIDENCE_CHAIN_LIVE_NOT_EXECUTED`

## 16. Safety report

- Provider calls: `0`
- DeepSeek calls: `0`
- Dify calls: `0`
- Large live calls: `0`
- Direct production/user-data writes: `0`
- PostgreSQL writes: integration-test fixture/transaction writes only; no production API mutation was executed by this task
- Git commit/push/merge/deploy: `0`
- reset/clean/stash/destructive checkout: `0`
- migrations/schema changes: `0`
- full secret values printed: `0`
- `backend/eval/tender-benchmark-v1/`: preserved
- `backend/eval/rag-pilot/`: preserved
- dirty worktree: preserved
