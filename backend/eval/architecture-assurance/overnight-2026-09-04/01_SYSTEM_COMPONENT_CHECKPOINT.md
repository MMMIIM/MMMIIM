# Phase 01 — System Component Inventory Checkpoint

**PHASE:** 01  
**OBJECTIVE:** Inventory current component owners and classify whether each is formally wired, legacy, eval-only, or missing.

## Files inspected

`backend/src/app.js`, `server.js`, `backend-runtime.js`, `db.js`, `requirement-parse-service.js`, `requirement-source-service.js`, `pipeline/canonical-requirements.js`, `company-material-service.js`, `pipeline/enterprise-material-chunker.js`, `pipeline/embedding-client.js`, `pipeline/enterprise-retrieval-service.js`, evidence/fact/review services, mapping/claim services and contracts, writer/generation/document delivery modules, Agent modules, `services/semantic-gateway/src/*`, `packages/semantic-contracts/index.js`, relevant migrations and tests.

## Code paths confirmed

| Component | Owner / main path | Status | Persistence / dependency |
|---|---|---|---|
| Frontend / HTTP API | `frontend/src/main.jsx`; `backend/src/app.js` | FORMAL_ACTIVE | React calls JSON API; Express sends `{ok,data}` |
| Project / tender upload | `app.js` project and `tender-files` routes; `PgRepository` | FORMAL_ACTIVE | `projects`, `tender_files`, storage |
| Tender parse / extraction | `RequirementParseService`; `requirement-extraction.js`; `requirement-chunker.js` | FORMAL_ACTIVE | `tender_parse_jobs`, `tender_parse_chunks`, candidates; canonical task gateway |
| Canonical Requirement | `pipeline/canonical-requirements.js`, `requirement-source-service.js` | FORMAL_ACTIVE | `requirements`, `requirement_candidates`, baseline/source audit; deterministic IDs/dedup |
| Company Material | `CompanyMaterialService`; `enterprise-material-chunker.js` | FORMAL_ACTIVE | `company_materials`, `material_chunks` |
| Embedding / Retrieval | `embedding-client.js`; `EnterpriseRetrievalService`; `semantic-retrieval-reranker.js` | FORMAL_ACTIVE (live config dependent) | `material_chunk_embeddings`, `enterprise_retrieval_runs/results`; no Evidence side effect by service contract |
| Evidence Candidate / Span | `evidence-service.js`, `evidence-review-service.js`, `evidence-source-span-service.js` | FORMAL_ACTIVE | `evidences`, `evidence_candidate_reviews`, `evidence_source_spans` |
| Evidence Fact | `evidence-source-fact-service.js`, `evidence-fact-service.js`, fact contracts | FORMAL_ACTIVE | `evidence_source_facts`, legacy `evidence_facts`; semantic extractor may be configured |
| Requirement–Evidence Mapping | `requirement-evidence-fact-mapping-service.js`; mapping contract/evaluator | FORMAL_ACTIVE but external semantic availability dependent | `requirement_evidence_fact_mappings`, legacy `requirement_evidence_mappings` |
| Readiness / Sufficiency | `evidence-readiness-service.js`, mapping policy | FORMAL_ACTIVE | derived from mapping/review status; not authority itself |
| Project Fact | `project-fact-control-service.js`, propagation contract | FORMAL_ACTIVE | `project_facts`, propagation plans/bindings/contexts |
| Claim / Claim Gate | `production-beta-service.js`; `claim-gate-service.js`; v2 contract/input adapter | FORMAL_ACTIVE with legacy compatibility reads | `claims`, `claim_decisions`, `claim_gate_evaluations`; deterministic requirement claims and evidence-gated paths |
| Response Plan | `deterministic-response-plan-builder.js`, `ProductionBetaService` | DETERMINISTIC_BACKEND | `response_plans`; old semantic provider code retained as compatibility/experimental |
| Writer authorization / safe context | `writer-input-authorization-service.js`, `writer-authorization-snapshot.js`, `writer-input-authorization-v1.js` | FORMAL_ACTIVE | `writer_safe_contexts`, fact mention ledger, authorization hashes |
| Writer / Generation | `writer-execution-service.js`; `document-generation-service.js`; writer provider | FORMAL_ACTIVE (provider/config dependent) | `document_generations`, tasks, writer outputs, document versions |
| Sanitizer / Validator / Coverage | `document-sanitizer.js`, `document-validator.js`, `coverage-validator.js`, structure validator | FORMAL_ACTIVE | finalization gates before version persistence |
| Revision | `document-generation-service.js` / writer provider revision path | PARTIALLY_WIRED | only invoked for revision-required branches; must preserve final validation |
| DOCX / delivery | `bid-document-model.js`, `docx-renderer.js`, `document-delivery-service.js` | FORMAL_ACTIVE | `document_exports`, storage; Word-specific validation |
| Agent / Copilot | `agent-context-resolver.js`, `agent-tools.js`, `bid-copilot-orchestrator.js`, action service/executor/policy | FORMAL_ACTIVE for bounded actions | `agent_execution_audits`, `agent_action_previews/audits`; formal authority actions remain human-gated |
| Semantic Gateway / provider adapters | `semantic-gateway-client.js`; `services/semantic-gateway/src/gateway.js`, `task-router.js`, provider adapters | FORMAL_ACTIVE | task contracts own prompt/schema; provider is adapter |
| Dify legacy client | `backend/src/dify.js`, legacy generation flag | LEGACY_REQUIRED / opt-in | `DIFY_*`; canonical 4.3 paths do not use it by default |
| Audit / version / snapshot / hash | `audit.js`, generation audit, source/fact/mapping/writer identity helpers | FORMAL_ACTIVE but coverage varies | audit columns/json and identity indexes |
| Eval / Gold | `backend/eval/**`, `backend/test/**` | EVAL_ONLY / TEST_ONLY | files/manifests; must not create formal business authority |
| PostgreSQL | `db.js`, migrations `001`–`051` | FORMAL_ACTIVE | replay-style migrations; constraints and indexes are authority backstop |

## Tables confirmed

Core tables identified in migrations include `projects`, `tender_files`, `tender_parse_jobs`, `tender_parse_chunks`, `requirement_candidates`, `requirement_baselines`, `requirements`, `tender_document_sections/paragraphs`, `requirement_source_reconciliations`, `requirement_source_decision_audits`, `company_materials`, `material_chunks`, `material_chunk_embeddings`, `enterprise_retrieval_runs`, `enterprise_retrieval_results`, `evidences`, `evidence_candidate_reviews`, `evidence_source_spans`, `evidence_source_facts`, `evidence_facts`, `requirement_evidence_mappings`, `requirement_evidence_fact_mappings`, `claim_gate_evaluations`, `claims`, `claim_decisions`, `response_plans`, `requirement_coverages`, `requirement_constraint_records`, `project_facts`, propagation tables, `writer_safe_contexts`, `writer_execution_tasks`, `writer_outputs`, `fact_mention_ledger`, `document_generations`, `document_generation_tasks`, `document_versions`, `external_writer_call_audits`, `document_exports`, Agent audit/preview tables, and membership/review tables.

## Tests inspected

- HTTP route and service tests under `backend/test/*`.
- PostgreSQL integration suites under `backend/integration/*`.
- Semantic gateway tests under `services/semantic-gateway/test/*`.
- Frontend component/API tests under `frontend/src/*.test.jsx`.
- Eval scripts under `backend/eval/**`.

## Confirmed facts

- **CONFIRMED_BY_CODE:** `server.js` constructs one dependency graph: repository → parse/extraction, materials → retrieval, evidence/fact/review → mapping → production beta/claim → document generation/delivery, plus Agent tools over formal services.
- **CONFIRMED_BY_CODE:** `app.js` exposes both canonical endpoints and explicit compatibility routes guarded by `legacyGenerationCompat`.
- **CONFIRMED_BY_CODE:** Production requirement, response-plan and claim creation are separate from LLM provider adapters; `ProductionBetaService` is injected independently of semantic gateway.
- **CONFIRMED_BY_CODE:** Retrieval, evidence review, fact extraction, mapping, claim gate, writer authorization and Agent actions each have named owner modules; no component is inferred solely from docs.
- **CONFIRMED_BY_SCHEMA:** migrations create separate tables for Requirement, Material/Chunk/Embedding, Retrieval, Evidence, Fact, Mapping, Claim, Writer and Agent lifecycles.

## Conflicting facts

- **CONFLICTING / LOCAL_ONLY:** app wiring includes both current canonical paths and older compatibility paths; exact production enablement depends on environment (`V43_LEGACY_GENERATION_COMPAT`, provider settings) not captured by source alone.
- **CONFLICTING:** several dirty local modifications touch frozen modules and tests; source inventory reflects current files, not a clean committed release.

## Unknown areas

- Whether every listed endpoint is enabled in the running process and whether the current database has all 51 migrations applied.
- Whether mapping/evidence semantic Gateway instances are reachable in the current environment.
- Whether all legacy read paths are unreachable from normal UI paths.

## LOCAL_ONLY facts

- This inventory is from the local dirty worktree at the Phase 00 fingerprint; it is not a remote or deployed runtime inventory.

## P0 risks

- **P0-AUTH-INV-001:** multiple formal object families and legacy tables coexist; authority convergence must be proven by call graph and negative controls.

## P1 risks

- **P1-WIRING-001:** provider-dependent stages can be configured independently; runtime contract/identity needs explicit verification.
- **P1-RUNTIME-002:** compatibility route flags may expose alternate generation semantics if enabled.

## P2 risks

- **P2-INVENTORY-001:** broad module surface and repeated stage artifacts increase maintenance and audit cost.

## Tech debt

- Legacy `evidence_facts`/`requirement_evidence_mappings` and Dify generation compatibility remain for historical reads.

## Architecture drift

- **AD-01-001:** `docs/CURRENT_STAGE.md` and Roadmap describe frozen/re-entry stages while local source has later Agent, corpus, mapping and writer governance surfaces; Phase 13 must reconcile.

## Next dependency

Phase 02 must follow the production runtime call graph from `server.js`/`app.js` into each service and persistence boundary.

## SAFE_TO_CONTINUE

**YES** — component inventory is sufficiently evidenced for read-only call-graph tracing; no business mutation performed.
