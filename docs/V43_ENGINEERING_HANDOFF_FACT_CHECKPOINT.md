# V43 Engineering Handoff Fact Checkpoint

- Checkpoint: `V43_ENGINEERING_HANDOFF_FACT_CHECKPOINT`
- Generated (UTC): `2026-09-05T11:35:55.094Z`
- Mode: **READ_ONLY**
- Scope: factual inventory of the current local worktree; no business or production changes.

## 1. Git

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Dirty: **YES**
- Pre-artifact `git status --short`: 87 modified tracked entries, 92 untracked entries (179 total); no deletes observed.
- Existing worktree changes were preserved. The two handoff files created by this operation are additional intended artifacts.
- Branch policy file: `config/branch-policy.json`; its authoritative Requirement Extraction branch is `feat/v4.3-semantic-boundary-routing`.

## 2. Production architecture

### Entrypoints and ownership

| Path | Entry point / owner | Authority-bearing |
|---|---|---|
| `backend/src/server.js` | Runtime composition; creates repository, gateways, services and listener | No |
| `backend/src/app.js` | Express control-plane API under `/api` | Yes |
| `backend/src/db.js` | PostgreSQL repository and persistence boundaries | Yes |
| `services/semantic-gateway/src/gateway.js` | Standalone Semantic Gateway | No |
| `services/semantic-gateway/src/task-router.js` | Task-specific provider routing | No |

Representative HTTP surfaces in `backend/src/app.js`: health; projects/tender files; tender parse jobs and candidate review; company materials/chunks; evidence/review/facts/mappings; enterprise retrieval; response plans/claims/coverage; document generation/versions/export; copilot actions. The route list is source code, not a separate contract.

### Frozen chain

`Canonical Requirement → Retrieval Intent/Evidence Scope → Retrieval Candidate → Evidence-Bearing Chunk → Exact Evidence Span → Bounded Context → Evidence Span Qualification → EvidenceSupportAssessment → Human Evidence Review → Approved Evidence Fact → Requirement↔Evidence Fact Mapping → Claim Gate → Writer Authorization → Generated Response → grounding/bid checks`.

### Pipeline module groups

- **requirement**
- backend/src/requirement-parse-service.js
- backend/src/pipeline/requirement-extraction.js
- backend/src/pipeline/requirement-chunker.js
- backend/src/pipeline/canonical-requirements.js
- backend/src/pipeline/source-location-resolver.js
- backend/src/pipeline/mandatory-requirement.js
- backend/src/pipeline/requirement-source-status.js
- backend/src/pipeline/requirement-scope-router.js
- **retrieval**
- backend/src/pipeline/embedding-client.js
- backend/src/pipeline/enterprise-retrieval-service.js
- backend/src/pipeline/semantic-retrieval-reranker.js
- backend/src/pipeline/retrieval-source-eligibility.js
- backend/src/pipeline/material-source-authority-policy.js
- backend/src/pipeline/enterprise-evidence-source-router.js
- **evidence_review_fact_mapping**
- backend/src/evidence-review-service.js
- backend/src/evidence-source-fact-service.js
- backend/src/evidence-fact-service.js
- backend/src/evidence-service.js
- backend/src/requirement-evidence-fact-mapping-service.js
- backend/src/pipeline/evidence-review-contract.js
- backend/src/pipeline/evidence-fact-contract-v1.js
- backend/src/pipeline/requirement-evidence-mapping-contract-v1.js
- **claim**
- backend/src/pipeline/claim-assertion-contract-v1.js
- backend/src/pipeline/claim-gate.js
- backend/src/pipeline/claim-gate-service.js
- backend/src/pipeline/claim-gate-input-adapter-v1.js
- backend/src/pipeline/claim-gate-v2-contract.js
- backend/src/pipeline/enterprise-claim-gate-v2.js
- **writer_document**
- backend/src/pipeline/writer-input-authorization-v1.js
- backend/src/pipeline/writer-authorization-snapshot.js
- backend/src/pipeline/writer-provider.js
- backend/src/pipeline/document-generation-service.js
- backend/src/pipeline/document-sanitizer.js
- backend/src/pipeline/document-validator.js
- backend/src/pipeline/document-structure-validator.js
- backend/src/pipeline/writer-execution-contract-v1.js
- **agent_and_copilot**
- backend/src/pipeline/agent-tools.js
- backend/src/pipeline/agent-action-policy.js
- backend/src/pipeline/agent-action-service.js
- backend/src/pipeline/bid-copilot-orchestrator.js

### State machine

- **tender_parse_job:** queued → running → succeeded|failed; phase queued|text_extraction|chunking|extracting|aggregating|succeeded|failed; parse chunks queued|running|succeeded|failed
- **requirement_baseline:** requirement_candidates candidate|confirmed; requirement_baselines building|confirmed; project status values are service-controlled (for example draft, requirements_confirmed, failed, confirmed)
- **company_material:** extraction pending|succeeded|failed|ocr_required; lifecycle DISCOVERED|SCREENED|APPROVED_FOR_PROCESSING|PROCESSED|EVAL_PASSED|ACTIVE|QUARANTINED; review pending|approved|rejected; usage ACTIVE_FULLTEXT|ACTIVE_EXCERPT|METADATA_ONLY|REFERENCE_ONLY|REJECTED|PENDING_REVIEW; index NOT_INDEXED|INDEXED|FAILED
- **retrieval:** enterprise_retrieval_runs running|succeeded|failed
- **evidence_review:** proposed|needs_review|approved|rejected|invalidated; semantic relevance relevant|weakly_relevant|irrelevant|unknown; capability capable|reference_only|not_capable|unknown; support full_support|partial_support|conflict|insufficient|reference_only|unknown
- **evidence_source_fact:** review draft|approved|rejected|invalidated; fact_status award|selected|contracted|participated|in_progress|completed|accepted|verified|registered|certified|unknown
- **canonical_mapping:** review proposed|approved|rejected|invalidated; relationship direct|partial|related|conflict|unrelated|unknown; support full_support|partial_support|conflict|insufficient|reference_only|unknown
- **claim_gate:** allow|restrict|reject|needs_review; persisted claim_gate_evaluations retain identity, snapshot, source and lineage fields
- **writer:** safe contexts active|invalidated; writer tasks current|regenerate_required|invalidated; writer outputs generated|validated|rejected|invalidated|finalized
- **document_generation:** created|queued|running|succeeded|failed|merged|sanitized|validated|revision_required|revised|finalized; modern pipeline document_versions use pending_review before confirmation

### PostgreSQL tables

`agent_action_audits`, `agent_action_previews`, `agent_execution_audits`, `claim_decisions`, `claim_gate_evaluations`, `claims`, `company_materials`, `document_exports`, `document_generation_tasks`, `document_generations`, `document_versions`, `enterprise_retrieval_results`, `enterprise_retrieval_runs`, `evidence_candidate_reviews`, `evidence_facts`, `evidence_source_facts`, `evidence_source_spans`, `evidences`, `external_writer_call_audits`, `fact_mention_ledger`, `generation_jobs`, `generations`, `material_chunk_embeddings`, `material_chunks`, `production_beta_runs`, `project_fact_propagation_bindings`, `project_fact_propagation_plans`, `project_fact_writer_contexts`, `project_facts`, `project_memberships`, `projects`, `requirement_baselines`, `requirement_candidates`, `requirement_constraint_records`, `requirement_coverages`, `requirement_evidence_fact_mappings`, `requirement_evidence_mappings`, `requirement_source_decision_audits`, `requirement_source_reconciliations`, `requirements`, `response_plan_edit_audits`, `response_plans`, `review_decisions`, `tender_document_paragraphs`, `tender_document_sections`, `tender_files`, `tender_mandatory_scope_rules`, `tender_parse_chunks`, `tender_parse_jobs`, `writer_execution_tasks`, `writer_outputs`, `writer_safe_contexts`.

## 3. Requirement

### Files and evaluator

- backend/src/pipeline/requirement-extraction.js
- backend/src/pipeline/canonical-requirements.js
- backend/src/requirement-parse-service.js
- backend/src/pipeline/requirement-chunker.js
- backend/src/pipeline/source-location-resolver.js
- backend/src/pipeline/mandatory-requirement.js
- backend/src/pipeline/requirement-source-status.js
- backend/src/pipeline/requirement-scope-router.js
- packages/semantic-contracts/index.js
- backend/src/eval/requirement-extraction-evaluator.js
- backend/src/verification/requirement-extraction-verifier.js
- backend/src/verification/requirement-extraction-live-input.js
- backend/scripts/eval-requirements.js

- Offline evaluator: `backend/src/eval/requirement-extraction-evaluator.js`
- Verifier: `backend/src/verification/requirement-extraction-verifier.js`
- Live input adapter: `backend/src/verification/requirement-extraction-live-input.js`
- Real-tender pilot directory: `backend/eval/requirement-extraction-real-tender-pilot-v1`
- CLI: `backend/scripts/eval-requirements.js`

### Contract facts

- Task type: `requirement_extraction`.
- Contract owner: `packages/semantic-contracts/index.js`.
- Envelope validation is strict; `data.requirements` is an array.
- Candidate projection fields: `text`, `source_range.start_ref`, `source_range.end_ref`, `mandatory_observed`, `requires_confirmation`, `warnings`.
- Provider input uses `chunk.model_text` when present and a deterministic fallback otherwise.
- Canonical rule version: `4.3-canonical-requirement-1`.
- Canonical invariants: exact deduplication before REQ-ID allocation; deterministic sequential REQ-001… identifiers; source evidence verification/resolution; risk flags separate from confirmation; writer eligibility and downstream category routing; raw source text/hash preserved; unresolved source is not fabricated.
- Current source status: three authoritative packets (FAST-01, TB-006, FAST-WATER-01) and three human-reconstruction candidates (JY-001, TB-003, FAST-04); Requirement Gold V2 is not frozen.

Frozen Requirement decisions:
- `docs/decisions/015-source-ambiguity-must-not-be-silently-resolved.md`
- `docs/decisions/016-source-ambiguous-cases-are-not-evaluable-gold.md`
- `docs/decisions/023-requirement-extraction-and-canonical-authority.md`
- `docs/decisions/024-requirement-gold-v1-1-known-annotation-debt.md`

## 4. RAG / Enterprise material

- Material upload/extraction: `backend/src/company-material-service.js`.
- Deterministic chunker: `backend/src/pipeline/enterprise-material-chunker.js`.
- Tables: `company_materials`, `material_chunks`, `material_chunk_embeddings`, `enterprise_retrieval_runs`, `enterprise_retrieval_results`.
- Single authority policy: `backend/src/pipeline/material-source-authority-policy.js`, version `material-source-authority-v1`; predicates `isAuthorityEligible`, `isEvidenceSourceEligible`, `isRetrievalEligible`.
- Eligibility facts: id; corpus_scope; lifecycle_status=ACTIVE; review_status=approved; usage_status=ACTIVE_FULLTEXT or ACTIVE_EXCERPT; extraction_status=succeeded; retrieval additionally requires index_status=INDEXED except ENTERPRISE_PRIVATE.
- Lifecycle: DISCOVERED → SCREENED → APPROVED_FOR_PROCESSING → PROCESSED → EVAL_PASSED → ACTIVE; QUARANTINED and non-active usage states are denied authority while retained for audit/readability.
- Quarantine: backend/migrations/051_material_source_authority_quarantine.sql adds quarantine_reason/quarantined_at and enforces QUARANTINED lifecycle; policy denies authority for quarantined rows.
- Source roles: `ORIGINAL_BUSINESS_FACT`, `ORIGINAL_TECHNICAL_FACT`, `ORIGINAL_PROJECT_FACT`, `ORIGINAL_QUALIFICATION_FACT`, `AUTHORITATIVE_REFERENCE_FACT`, `INTERNAL_PROCESS_ARTIFACT`, `SYSTEM_DERIVED_ARTIFACT`, `EVAL_ARTIFACT`, `CONTROL_PLANE_ARTIFACT`, `NON_AUDITABLE_CLAIM`, `UNKNOWN`.
- Retrieval path: Canonical Requirement → EnterpriseRetrievalService.retrieve() → EmbeddingClient/query + persisted chunk vectors → PostgreSQL vector search → hygiene/source eligibility → enterprise source routing → semantic-retrieval-reranker → Top-K audit persistence; GET reload reapplies authority SQL.
- Retrieval does not create Evidence, Mapping, Claim or Writer state.
- Current recorded RAG blockers: Stage20 formal evidence-sufficiency live validation remains blocked/partial; Corpus L3 completion remains in progress; Real Fact V2 eligible immutable enterprise sources currently 0.

## 5. Mapping

- Service: `backend/src/requirement-evidence-fact-mapping-service.js`.
- Routes: `POST /api/projects/:projectId/requirement-evidence-fact-mappings`; `POST /api/projects/:projectId/requirements/:requirementId/requirement-evidence-fact-mappings/produce`; `POST /api/requirement-evidence-fact-mappings/:mappingId/:decision(approve|reject)`.
- Default evaluator: ProviderNeutralMappingEvaluator in RequirementEvidenceFactMappingService; semantic evaluator: `backend/src/pipeline/semantic-gateway-mapping-evaluator.js`.
- Contract: backend/src/pipeline/requirement-evidence-mapping-contract-v1.js; frozen task contract requirement-evidence-mapping-v1 with migration 048 table v1.1 identity.
- Labels:
  - semantic relationship: direct, partial, related, conflict, unrelated, unknown
  - support level: full_support, partial_support, conflict, insufficient, reference_only, unknown
  - review status: proposed, approved, rejected, invalidated
  - source type: manual, retrieval, system_proposed
- Gold locations:
  - Active V1: `backend/eval/requirement-evidence-mapping-v1/gold-cases.json`
  - V2: `backend/eval/requirement-evidence-mapping-v2/real-derived-gold-v1.json`, `backend/eval/requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json`, `backend/eval/requirement-evidence-mapping-v2/disputed-cases-v2.json`, `backend/eval/requirement-evidence-mapping-v2/successor-manifest.json`
  - Human packets: `backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json`, `backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json`, `backend/eval/gold-human-review/v2/05_mapping_real_supplemental_human_review_packet.json`
  - Governance: `backend/eval/gold-governance`
- Mapping Gold V2 is not frozen.

## 6. Claim

- Schema: `backend/src/pipeline/claim-assertion-contract-v1.js; version claim-assertion-v1`.
- Fields: `text`, `assertions[].subject`, `assertions[].entities`, `assertions[].status`, `assertions[].scopes`, `assertions[].quantities`, `assertions[].validity`, `referenced_fact_ids`, `referenced_mapping_ids`, `assertion_hash`.
- Gate paths: `backend/src/pipeline/claim-gate.js`, `backend/src/pipeline/claim-gate-service.js`, `backend/src/pipeline/claim-gate-v2-contract.js`, `backend/src/pipeline/enterprise-claim-gate-v2.js`.
- Input adapter: `backend/src/pipeline/claim-gate-input-adapter-v1.js`.
- Authorization flow: approved/current Claim Gate evaluation → persisted claim_gate_evaluations identity and lineage fields → WriterInputAuthorizationService/createWriterSafeContext; current allow, matching identity, current lineage and writer eligibility are required.
- Decisions: allow, restrict, reject, needs_review.
- Enterprise no-escalation fact: Enterprise v2 requires approved Mapping/Evidence/lineage; historical_bid and reference_only are excluded; v2 does not fall back to v1..

## 7. Writer

- Production entry: POST /api/projects/:projectId/document-generations → DocumentGenerationService.generate() (server composes writerV2 path).
- Safe Context: backend/src/pipeline/writer-input-authorization-v1.js:createWriterSafeContext; separates assertable_claims, context_items, blocked_items and pending_items and enforces current gate/lineage identity.
- Authorization snapshot: backend/src/pipeline/writer-authorization-snapshot.js; writer-authorization-snapshot-v1; hashes project/requirements/plans/claims/evidence/section contexts.
- Generation identity: backend/src/pipeline/document-generation-service.js builds authorization snapshot/hash and generation input identity for reuse; persistence uses document_generations and document_versions.
- Provider adapter: backend/src/pipeline/writer-provider.js; section_drafting and targeted_revision use task-specific V43_WRITER_GATEWAY_* and V43_REVISION_GATEWAY_* configuration with no cross-fallback.
- Sanitizer: backend/src/pipeline/document-sanitizer.js and backend/src/pipeline/document-generation.js; removes internal IDs, commercial content and unsupported assertions; flags revision.
- Validators/guards: `backend/src/pipeline/document-validator.js`, `backend/src/pipeline/document-structure-validator.js`, `backend/src/pipeline/document-generation.js::validateDocument`, `backend/src/pipeline/writer-execution-contract-v1.js::guardCriticalAssertions`.
- Output lifecycle: sanitize → validate → critical guard → pending_review document version; no automatic final confirmation.
- Boundaries: Writer reads only safe authorized context; no result/text/answer fallback; reference_materials may support design/context but are not enterprise assertion authority; Provider is replaceable and cannot create formal business state.

## 8. Evaluation inventory

The following arrays are generated from the current local tree (not inferred from historical text).

### Eval folders (110)

- backend/eval/agent-eval
- backend/eval/agent-eval-v2
- backend/eval/architecture-assurance
- backend/eval/candidate-rerank
- backend/eval/claim-eval-v1
- backend/eval/corpus
- backend/eval/evidence-gold
- backend/eval/evidence-support
- backend/eval/fixtures
- backend/eval/gold
- backend/eval/gold-governance
- backend/eval/gold-human-review
- backend/eval/jiangyin-ambiguity-prevalence-v1
- backend/eval/jiangyin-full-requirement-rag-fitness-v1
- backend/eval/manifests
- backend/eval/mapping-benchmark-v1
- backend/eval/production-retrieval-contract
- backend/eval/production-retrieval-e2e
- backend/eval/rag-governance
- backend/eval/rag-pilot
- backend/eval/reports
- backend/eval/requirement-evidence-mapping-v1
- backend/eval/requirement-evidence-mapping-v2
- backend/eval/requirement-extraction-real-tender-pilot-v1
- backend/eval/retrieval-baseline
- backend/eval/retrieval-eval
- backend/eval/scale-stress
- backend/eval/semantic-adjudication-value-v1
- backend/eval/semantic-boundary
- backend/eval/stage20
- backend/eval/sufficiency
- backend/eval/tender-benchmark-v1
- backend/eval/architecture-assurance/overnight-2026-09-04
- backend/eval/claim-eval-v1/results
- backend/eval/corpus/l3-synthetic-enterprise
- backend/eval/corpus/real-public
- backend/eval/corpus/real-public-authoritative
- backend/eval/corpus/representative-sme
- backend/eval/corpus/synthetic-fixtures
- backend/eval/evidence-gold/review
- backend/eval/evidence-support/calibration-v2
- backend/eval/gold-governance/v43-gold-v2-foundation
- backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication
- backend/eval/gold-governance/v43-real-gold-v2-source-and-fact-closure
- backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure
- backend/eval/gold-human-review/v2
- backend/eval/gold-human-review/v2/claim
- backend/eval/gold-human-review/v2/mapping-real-rebuild
- backend/eval/gold-human-review/v2/writer
- backend/eval/mapping-benchmark-v1/results
- backend/eval/rag-pilot/post-hash-fix
- backend/eval/rag-pilot/results
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1
- backend/eval/rag-pilot/results/overnight
- backend/eval/rag-pilot/results/post-hash-fix
- backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01
- backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02
- backend/eval/rag-pilot/results/structured-output-isolated-canary-01
- backend/eval/rag-pilot/results/structured-output-shared-canary-03
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/00_meta
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/01_universal_rag
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/02_industry_rag
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/03_company_case_rag
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/02_industry_rag/government
- backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/02_industry_rag/medical
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live
- backend/eval/reports/reqx-v311-certified-live
- backend/eval/reports/reqx-v311-gold-eligibility-final-recertification-v1
- backend/eval/reports/reqx-v311-live
- backend/eval/reports/reqx-v311-post-fix-certified-live
- backend/eval/reports/stage20-model-bakeoff-v1
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/requests
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/responses
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/requests/FAST-01
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/requests/FAST-WATER-01
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/requests/TB-006
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/responses/FAST-01
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/responses/FAST-WATER-01
- backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/responses/TB-006
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/requests
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/responses
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/requests/FAST-01
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/requests/FAST-WATER-01
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/requests/TB-006
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/responses/FAST-01
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/responses/FAST-WATER-01
- backend/eval/reports/reqx-v311-certified-live/reqx-v311-certified-live-1788008474459-b2806da0/responses/TB-006
- backend/eval/reports/reqx-v311-live/reqx-v311-20260829-182056
- backend/eval/reports/reqx-v311-live/reqx-v311-header-context-20260829-183517
- backend/eval/reports/reqx-v311-live/reqx-v311-header-context-chunk1-20260829-184000
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/requests
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/responses
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/requests/FAST-01
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/requests/FAST-WATER-01
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/requests/TB-006
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/responses/FAST-01
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/responses/FAST-WATER-01
- backend/eval/reports/reqx-v311-post-fix-certified-live/reqx-v311-post-fix-certified-live-1788025510484-ba6e1352/responses/TB-006
- backend/eval/requirement-extraction-real-tender-pilot-v1/gpt-audit-v1
- backend/eval/requirement-extraction-real-tender-pilot-v1/gpt-reviewed
- backend/eval/requirement-extraction-real-tender-pilot-v1/packets
- backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1
- backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets
- backend/eval/scale-stress/corpus
- backend/eval/stage20/fixtures
- backend/eval/tender-benchmark-v1/reports
- backend/eval/tender-benchmark-v1/sources

### Gold datasets and governed Gold packets

- backend/eval/gold/E2E-R01.json
- backend/eval/gold/E2E-R02.json
- backend/eval/gold/E2E-R03.json
- backend/eval/gold/E2E-R04.json
- backend/eval/gold/E2E-R05.json
- backend/eval/gold/E2E-R06.json
- backend/eval/evidence-gold/gold-candidates.json
- backend/eval/evidence-gold/review/gold-reviews.json
- backend/eval/evidence-gold/review/human-review-template.json
- backend/eval/evidence-gold/review/review-progress.json
- backend/eval/requirement-evidence-mapping-v1/gold-cases.json
- backend/eval/requirement-evidence-mapping-v2/real-derived-gold-v1.json
- backend/eval/requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json
- backend/eval/requirement-evidence-mapping-v2/disputed-cases-v2.json
- backend/eval/requirement-evidence-mapping-v2/successor-manifest.json
- backend/eval/corpus/l3-corpus-manifest-v1.json
- backend/eval/corpus/l3-gold-questions-v1.json
- backend/eval/corpus/l3-gold-questions-v2.json
- backend/eval/corpus/l3-synthetic-enterprise/manifest.json
- backend/eval/corpus/real-public-authoritative/manifest.json
- backend/eval/corpus/representative-sme/representative-sme-corpus-manifest-v1.json
- backend/eval/manifests/requirements.json
- backend/eval/semantic-adjudication-value-v1/cases.json
- backend/eval/reports/current-gold-candidate-review.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/manifest.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/gpt-reviewed/FAST-01.gold-reviewed.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/gpt-reviewed/FAST-WATER-01.gold-reviewed.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/gpt-reviewed/TB-006.gold-reviewed.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/manifest.json
- backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/gold-change-log.json
- backend/eval/gold-human-review/00_gold_review_manifest.json
- backend/eval/gold-human-review/01_mapping_gold_full_review.json
- backend/eval/gold-human-review/02_claim_gold_full_review.json
- backend/eval/gold-human-review/03_writer_gold_full_review.json
- backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json
- backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json
- backend/eval/gold-human-review/v2/05_mapping_real_supplemental_human_review_packet.json
- backend/eval/gold-human-review/v2/claim/02_claim_real_source_packet.json
- backend/eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json
- backend/eval/gold-human-review/v2/mapping-real-rebuild/11_real_enterprise_source_candidate_manifest.json
- backend/eval/gold-governance/production-boundary-manifest.json
- backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.json
- backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json
- backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json
- backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/REQUIREMENT_HUMAN_AUTHORITY_PACKET.json
- backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/ENTERPRISE_SOURCE_AUTHORITY_BLIND_REVIEW_PACKET.json
- backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-real-enterprise-source-manifest.json
- backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-real-fact-v2-blind-human-review-packet.json

### Checkpoint files (108)

- backend/eval/architecture-assurance/overnight-2026-09-04/00_FORENSIC_BASELINE_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/01_CURRENT_SYSTEM_DELTA_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/01_CURRENT_SYSTEM_DELTA_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/01_SYSTEM_COMPONENT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/02_LEGACY_REACHABILITY_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/02_LEGACY_REACHABILITY_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/02_RUNTIME_CALL_GRAPH_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/03_AUTHORITY_OBJECT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/03_STALENESS_PROPAGATION_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/03_STALENESS_PROPAGATION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/04_FACT_PRODUCER_READINESS_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/04_FACT_PRODUCER_READINESS_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/04_LINEAGE_INVALIDATION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/05_MAPPING_PRODUCER_READINESS_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/05_MAPPING_PRODUCER_READINESS_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/05_RAG_EVIDENCE_ISOLATION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/06_EVIDENCE_SUPPORT_FAIL_CLOSED_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/06_EVIDENCE_SUPPORT_FAIL_CLOSED_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/07_WRITER_AUTHORIZATION_BYPASS_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/07_WRITER_AUTHORIZATION_BYPASS_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/08_GENERATION_REUSE_SAFETY_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/08_GENERATION_REUSE_SAFETY_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/09_EVAL_RULER_TRUST_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/09_EVAL_RULER_TRUST_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/10_GOLD_GOVERNANCE_ENFORCEMENT_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/10_GOLD_GOVERNANCE_ENFORCEMENT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/11_DB_AUTHORITY_MIGRATION_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/11_DB_AUTHORITY_MIGRATION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/12_TENDER_ARTIFACT_DRIFT_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/12_TENDER_ARTIFACT_DRIFT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/13_RAG_AUTHORITY_REGRESSION_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/13_RAG_AUTHORITY_REGRESSION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/14_AGENT_DOCX_THREAT_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/14_AGENT_DOCX_THREAT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/15_DRIFT_AND_REGRESSION_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/15_DRIFT_AND_REGRESSION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/16_ENGINEERING_HEALTH_READINESS_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/16_ENGINEERING_HEALTH_READINESS_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/RESUME_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_ENGINEERING_AND_ARCHITECTURE_ASSURANCE_MASTER_CHECKPOINT_V2.json
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_ENGINEERING_AND_ARCHITECTURE_ASSURANCE_MASTER_CHECKPOINT_V2.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_P0_RAG_MATERIAL_AUTHORITY_FAIL_CLOSED_ROOT_CAUSE_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_P0_RAG_MATERIAL_AUTHORITY_FAIL_CLOSED_ROOT_CAUSE_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_01_AUTHORITATIVE_PACKET_CONTRACT_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_02_KNOWN_GOOD_POSITIVE_CONTROL_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_03_JY001_RECOVERY_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_04_TB003_RECOVERY_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_05_FAST04_RECOVERY_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_06_SIX_TENDER_RECONCILIATION_CHECKPOINT.md
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_SIX_TENDER_AUTHORITATIVE_ARTIFACT_RECOVERY_MASTER_CHECKPOINT.json
- backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_B_SIX_TENDER_AUTHORITATIVE_ARTIFACT_RECOVERY_MASTER_CHECKPOINT.md
- backend/eval/gold-governance/00_gold_v2_governance_checkpoint.json
- backend/eval/gold-governance/00_gold_v2_governance_checkpoint.md
- backend/eval/gold-governance/05_gold_v2_governance_harness_mapping_supplemental_checkpoint.json
- backend/eval/gold-governance/05_gold_v2_governance_harness_mapping_supplemental_checkpoint.md
- backend/eval/gold-governance/06_mapping_gold_v2_human_authority_novelty_repair_checkpoint.json
- backend/eval/gold-governance/06_mapping_gold_v2_human_authority_novelty_repair_checkpoint.md
- backend/eval/gold-governance/07_mapping_batch01_human_review_source_parity_checkpoint.json
- backend/eval/gold-governance/07_mapping_batch01_human_review_source_parity_checkpoint.md
- backend/eval/gold-governance/08_mapping_gold_v2_successor_build_checkpoint.json
- backend/eval/gold-governance/08_mapping_gold_v2_successor_build_checkpoint.md
- backend/eval/gold-governance/09_claim_writer_gold_v2_source_authority_checkpoint.json
- backend/eval/gold-governance/09_claim_writer_gold_v2_source_authority_checkpoint.md
- backend/eval/gold-governance/10_writer_provider_fidelity_authority_gap_audit_checkpoint.json
- backend/eval/gold-governance/10_writer_provider_fidelity_authority_gap_audit_checkpoint.md
- backend/eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.json
- backend/eval/gold-governance/11_mapping_gold_full_human_review_export_checkpoint.md
- backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_CHECKPOINT.json
- backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_CHECKPOINT.md
- backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.json
- backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.md
- backend/eval/gold-governance/v43-gold-v2-foundation/V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json
- backend/eval/gold-governance/v43-gold-v2-foundation/V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.md
- backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json
- backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md
- backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.json
- backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.md
- backend/eval/gold-governance/v43-real-gold-v2-source-and-fact-closure/V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.json
- backend/eval/gold-governance/v43-real-gold-v2-source-and-fact-closure/V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.md
- backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-source-fact-closure-checkpoint.json
- backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-source-fact-closure-checkpoint.md
- backend/eval/gold-human-review/v2/mapping-real-rebuild/06_source_role_projection_checkpoint.json
- backend/eval/gold-human-review/v2/mapping-real-rebuild/06_source_role_projection_checkpoint.md
- backend/eval/gold-human-review/v2/mapping-real-rebuild/12_real_source_ingestion_harness_checkpoint.json
- backend/eval/gold-human-review/v2/mapping-real-rebuild/12_real_source_ingestion_harness_checkpoint.md
- backend/eval/rag-governance/14_rag_corpus_quality_checkpoint.json
- backend/eval/rag-governance/14_rag_corpus_quality_checkpoint.md
- backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.json
- backend/eval/rag-governance/15_material_source_authority_quarantine_checkpoint.md
- backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md
- backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md
- backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md
- backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md
- backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md
- backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md
- backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md
- backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md
- backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md
- backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md
- backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md
- backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md
- backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md
- backend/eval/rag-pilot/results/overnight/11_writer_authorization_snapshot_remediation_checkpoint.json
- backend/eval/rag-pilot/results/overnight/11_writer_authorization_snapshot_remediation_checkpoint.md
- backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json
- backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md

## 9. Current blockers

- **STAGE20_EVIDENCE_SUFFICIENCY_LIVE** — CURRENT_STAGE records Stage20 as PARTIAL/BLOCKED pending formal live Evidence Sufficiency validation; offline V3.1 is accepted but is not the full stage.
  - Files: docs/CURRENT_STAGE.md, docs/decisions/010-evidence-support-assessment-boundary.md
  - Owner recorded: no
- **CORPUS_L3_INCOMPLETE** — Corpus L3 remains IN_PROGRESS in CURRENT_STAGE; no completed production corpus-level evidence is recorded.
  - Files: docs/CURRENT_STAGE.md, backend/eval/corpus/l3-corpus-manifest-v1.json, backend/eval/corpus/l3-gold-questions-v1.json, backend/eval/corpus/l3-gold-questions-v2.json
  - Owner recorded: no
- **REQUIREMENT_GOLD_V2_AUTHORITY** — Current authority adjudication checkpoint records JY-001 as BLOCKED_PROVIDER_OR_CONTRACT and TB-003/FAST-04 as NOT_ATTEMPTED_AFTER_FIRST_FAILURE; human authority packet has zero extracted candidates. Three other tenders have recovered authoritative packets, so six-tender parity is not complete.
  - Files: backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.json, backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.json
  - Owner recorded: no
- **REAL_FACT_V2_NO_ELIGIBLE_SOURCE** — Current foundation/closure checkpoints record four enterprise sources quarantined or pending human source authority and REAL_FACT_V2_ELIGIBLE_CANDIDATES=0; no frozen Real Fact Gold exists.
  - Files: backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.json, backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json, backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-source-fact-closure-checkpoint.json
  - Owner recorded: no
- **PRE_EXISTING_UNRELATED_UNIT_FAILURES** — Track A closure artifact records 14 unrelated dirty-worktree unit failures (governance wording, missing/relocated Gold/source-packet fixtures, extraction-audit expectations and runtime decision assertions); no remediation was attempted.
  - Files: backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json
  - Owner recorded: no

Owner fields are **not recorded** in the cited repository artifacts; no human owner is inferred.

## 10. Frozen decisions and future-development boundaries

### ADR files

- docs/decisions/001-ai-control-plane.md — # 001 — AI and Control Plane
- docs/decisions/002-evidence-fact-claim-boundary.md — # 002 — Evidence, Fact, and Claim Boundaries
- docs/decisions/003-writer-control.md — # 003 — Writer Control
- docs/decisions/004-provider-decoupling.md — # 004 — Provider Decoupling
- docs/decisions/005-open-source-reuse.md — # 005 — Open Source Reuse
- docs/decisions/006-agent-as-orchestration-layer.md — # ADR 006 — Agent as an orchestration layer
- docs/decisions/007-document-model-docx-renderer.md — # ADR 007：文档模型与 DOCX 渲染器分离
- docs/decisions/008-curated-corpus-governance.md — # ADR 008：Curated Corpus Scope and Governance
- docs/decisions/009-runtime-connectivity-foundation.md — # ADR 009: Stage21-A Runtime Connectivity Foundation
- docs/decisions/010-evidence-support-assessment-boundary.md — # ADR 010: Evidence Support Assessment Boundary
- docs/decisions/011-standalone-semantic-gateway-runtime.md — # ADR 011: Standalone Semantic Gateway Runtime
- docs/decisions/012-stage20-direct-provider-runtime.md — # ADR 012: Stage20 Direct Provider Runtime
- docs/decisions/013-evaluation-metric-authority-and-namespace.md — # ADR 013: Evaluation Metric Authority and Semantic Namespace
- docs/decisions/014-canonical-production-path-and-isolated-test-instances.md — # ADR 014: Canonical Production Path and Isolated Test Instances
- docs/decisions/015-source-ambiguity-must-not-be-silently-resolved.md — # ADR 015: Source Ambiguity Must Not Be Silently Resolved
- docs/decisions/016-source-ambiguous-cases-are-not-evaluable-gold.md — # ADR 016: Source-Ambiguous Cases Are Not Evaluable Gold
- docs/decisions/017-canonical-requirement-evidence-fact-mapping-authority.md — # ADR-017: Canonical Requirement–Evidence Fact–Mapping Authority
- docs/decisions/018-fact-subject-semantic-representation-flat.md — # ADR-018: Fact Subject Semantic Representation (Flat)
- docs/decisions/019-semantic-dependent-field-logic-review.md — # ADR-019: Semantic Relationship Field Ownership Review
- docs/decisions/020-evidence-support-field-contract-and-invariants.md — # ADR-020: Evidence Support Field Contract and Invariant Parity
- docs/decisions/021-evidence-fact-semantic-authority-and-requirement-independence.md — # ADR-021: Evidence Fact Semantic Authority and Requirement Independence
- docs/decisions/022-mapping-producer-and-evaluation-architecture.md — # ADR-022: Mapping Producer V1 and Mapping Eval V1 Architecture
- docs/decisions/023-requirement-extraction-and-canonical-authority.md — # ADR-023: Requirement Extraction and Canonical Requirement Authority
- docs/decisions/024-requirement-gold-v1-1-known-annotation-debt.md — # ADR-024: Requirement Gold v1.1 Known Annotation Debt and Deferred Remediation
- docs/decisions/025-gold-v2-evaluation-governance.md — # ADR-025: V4.3 Gold V2 Evaluation Governance Architecture

### Governing checkpoints

- `backend/eval/architecture-assurance/overnight-2026-09-04/V43_CHAIN_CLOSURE_00_LOCAL_PATH_MANIFEST.json`
- `backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json`
- `backend/eval/gold-governance/v43-gold-v2-foundation/V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json`
- `backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json`
- `backend/eval/gold-governance/v43-real-gold-v2-authority-adjudication/V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.json`
- `backend/eval/gold-governance/v43-real-gold-v2-source-and-fact-closure/V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.json`
- `backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-source-fact-closure-checkpoint.json`
- `backend/eval/gold-governance/production-boundary-manifest.json`
- `docs/CURRENT_STAGE.md`
- `docs/AI_HANDOFF.md`

### Invariants recorded by those artifacts

- Control Plane owns validation, authorization, versioning, audit and finalization; providers discover/draft but do not create formal state.
- Relevant, Evidence, Fact, Mapping, Claim and Writer Authorization are separate objects; downstream never expands upstream authority.
- Material Authority is the single lifecycle/eligibility predicate; quarantine is fail-closed.
- Canonical Requirement and deterministic REQ-ID assignment occur after exact deduplication and source verification.
- Source ambiguity is not silently resolved and ambiguous cases are not evaluable Gold.
- Mapping/Claim/Writer decisions require persisted identity, lineage and currentness; no unauthorized escalation.
- Retrieval candidate ordering is frozen separately from Evidence/Fact/Mapping/Claim authority.
- Offline/engineering Eval artifacts do not mutate production truth or authorize Gold promotion.
- Current Stage20, Real Fact V2 and Gold V2 readiness remain governed by their checkpoints; no readiness inferred from counts alone.

The current repository does not claim: `MAPPING_GOLD_V2_FROZEN`, `REAL_FACT_V2_FROZEN`, `WRITER_PROVIDER_FIDELITY_PASS`, `WRITER_PRODUCTION_READY`, `BID_PILOT_HITL_READY`.

## 11. Side-effect record for this handoff

- Provider calls: `0`
- Production DB writes: `0`
- Gold mutations: `0`
- Production/code/migration/prompt changes by this handoff: `0`
- No tests or live operations were run; this is a read-only inventory plus two documentation artifacts.

