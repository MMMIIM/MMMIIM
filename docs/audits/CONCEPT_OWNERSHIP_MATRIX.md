# CONCEPT OWNERSHIP MATRIX

This matrix is the audit dictionary required before remediation. Runtime names and UI labels may differ; the canonical owner and transition boundary are what matter. `PARTIAL` indicates drift/compatibility work, not an authorization to change a frozen contract.

| Concept | Canonical owner | Canonical status/enum | DB representation | API/runtime representation | Eval representation | Allowed transitions | Forbidden transitions | Flags |
|---|---|---|---|---|---|---|---|---|
| Requirement | `canonical-requirements.js`, requirement parse service | source_status, confirmation_type | `requirements`, `requirement_candidates` | req_id/content/source metadata | expected requirement / case | candidate → confirmed/provisional/excluded | model-generated REQ-ID; mutate confirmed baseline | ENFORCED |
| Candidate Requirement | `requirement-extraction.js`, source service | provisional/verified/excluded | `requirement_candidates` | parse job candidate DTO | extraction fixture | parsed → reviewed → include/exclude | direct baseline creation on failure | ENFORCED |
| Canonical Requirement | requirement parse service + baseline repository | confirmed baseline | `requirement_baselines`, `requirements` | confirmed baseline API | Gold requirement anchor | confirmed/frozen | add/delete/merge after freeze | ENFORCED |
| Material | `CompanyMaterialService` | extraction/approval lifecycle | `company_materials` | material upload/list | corpus material | upload → processed/indexed/active | eval/LLM artifact promotion | ENFORCED |
| Document | tender/material extractor and source-span layer | extractability/section identity | material/document fields; spans currently bind material | parsed document/source location | document fixture | extracted → sectioned | guessed page/paragraph | PARTIAL (P2-DATA-001) |
| Chunk | chunker/repository | chunk role | `material_chunks` | retrieval candidate source | chunk fixture | parsed → indexed/retrieved | cross-document span | ENFORCED |
| Retrieval Candidate | `enterprise-retrieval-service.js` | candidate_eligibility | `enterprise_retrieval_results` | raw/final candidate DTO | Top-K actual | retrieved → audited/final | candidate → Evidence Fact | ENFORCED |
| Chunk Role | `retrieval-chunk-role.js` | `RETRIEVAL_CHUNK_ROLES` | role column | candidate chunk_role | expected role | classified → final/context | role implies support | ENFORCED |
| Substantive Candidate | `retrieval-substantive-candidate.js` | substantive classes | result substantive fields | audit classification | hygiene expected | classified → retained/excluded audit | substantive implies source eligibility | ENFORCED |
| Evidence Source Eligibility | `retrieval-source-eligibility.js` | source classes + boolean | migration 044 fields | source eligibility audit | source-eligibility replay | unknown → eligible only with provenance classification | unknown/derived → eligible | ENFORCED |
| Proof Eligibility | Evidence/Claim evaluators | capability/reference_only/not_capable | review/mapping JSON/status | review/mapping DTO | proof expected | source eligible → review | relevant → proof without capability | ENFORCED |
| Evidence Bearing | evidence-bearing classifier | evidence-bearing classes | retrieval result audit | candidate audit | Gold classification | candidate → bearing audit | bearing → approved Fact | ENFORCED |
| Evidence Span | `evidence-source-span-service.js` | resolver strategy/status | `evidence_source_spans` | exact span + hash | expected span | chunk → exact/bounded span | fabricated offset/hash | ENFORCED |
| Evidence Context Window | context recovery service | recovery status | JSON/audit fields | bounded context | context recovery metric | span → bounded context | context replaces exact span | ENFORCED |
| Evidence Support Assessment | shared contract + evaluator | available/unavailable, sufficiency statuses | transient (no formal DB write) | adapter input/output | calibration cases | source → observation → aggregate | assessment → approval/fact | ENFORCED |
| Evidence Review | `EvidenceReviewService` | proposed/needs_review/approved/rejected/invalidated | `evidence_candidate_reviews` | review DTO | review case | candidate → human decision | machine assessment → approved | ENFORCED |
| Approved Evidence Fact | `EvidenceSourceFactService` | draft/approved/rejected/invalidated | `evidence_source_facts` | fact DTO | Fact Gold | review → draft → human decision | review alone → approved Fact | ENFORCED |
| Mapping | `RequirementEvidenceFactMappingService` | proposed/approved/rejected/invalidated; support levels | `requirement_evidence_fact_mappings` (canonical); legacy table retained for compatibility | mapping DTO | mapping Gold | approved Fact → proposed → human decision | Mapping → Claim permission automatically | CANONICAL; LEGACY_COMPATIBILITY |
| Claim Permission | Claim Gate | allow/restrict + writer_eligible | `claim_gate_evaluations` | gate result | claim safety eval | approved mapping/claim → evaluated | mapping approval → allow without gate | ENFORCED |
| Claim Gate | `claim-gate.js`, `claim-gate-v2.js` | decision/reason codes | gate evaluation | claim gate DTO | Claim Gold | candidate → evaluated | gate creates Evidence | ENFORCED |
| Writer Authorization | writer input authorization + safe context | active/invalidated, writer eligibility | writer_safe_contexts/bindings | authorized task input | writer E2E | gate allow → task | writer expands refs/claims | ENFORCED |
| Generation Task | document generation service | created/queued/running/succeeded/failed/... | document_generations/tasks | task/job DTO | generation fixture | gate → task lifecycle | failed → finalized without validation | PARTIAL (P1-STATE-001) |
| Generated Section | document generation/renderer | drafted/sanitized/validated | snapshots/final text | section DTO | grounding cases | authorized claims → draft → validate | section creates facts | ENFORCED |
| Grounding | validator/mention ledger/critical guard | coverage/guard statuses | writer outputs/mentions | validation + ledger | grounding eval | output → guard/coverage | output → approved Fact | ENFORCED |
| Validation | document validator and contract validators | valid/warning/critical or schema error | validation JSON/error fields | safe error/validation DTO | schema/negative cases | preflight/final → pass/fail | validation repairs/invents facts | ENFORCED |
| DOCUMENT_VERSION_CONFIRMATION | `GenerationService.confirmVersion` + `assertVersionCanBeConfirmed` | pending_confirmation → confirmed; warning requires acknowledgement; critical forbidden | `document_versions`, `review_decisions` (`confirmation_text`, `actor_id`) | POST `/api/document-versions/:versionId/confirm` and `/review-decisions` | HTTP lifecycle tests | pass → confirmed; warning + non-empty acknowledgement → confirmed | route/repository bypass; critical → confirmed; warning without acknowledgement | ENFORCED |
| Audit | repository audit methods + provider audit | append-only-ish audit records | generation/provider/review/audit tables | safe audit summaries | packet lineage | lifecycle event → audit | audit content as source proof | PARTIAL |
| Evaluation Gold | eval manifests/gold files | draft/ready/human-reviewed metadata | files, not production DB | eval-only | expected labels | source review → Gold | Gold → runtime input | ENFORCED |
| GPT-reviewed expectation | GPT packet/review process | pending/complete | packet metadata | review artifact | review status | draft packet → independent review | automation marks human review | ENFORCED |
| Human Gold | human review importer | explicit human decision | eval JSON | eval-only | holdout truth | candidate → human label | system draft → human gold | ENFORCED |

## Explicit ambiguity list

1. The legacy `EvidenceService`/`requirement_evidence_mappings` path and the newer Evidence Fact Mapping path are intentionally additive but create two API/DB representations for “Mapping”; this is compatibility debt, not permission to merge them in the audit.
2. Generation pipeline states and persisted task statuses share names but have separate owners/registries.
3. A server-configured development actor is an explicit non-authenticated adapter; production readiness remains blocked until an authenticated request actor is integrated. Client reviewer/editor fields are non-authoritative.
4. Material/Document identity is one-to-one in the current source span schema.

## ADR-017 authority freeze

This table supersedes ambiguity for canonical authority while preserving the
historical audit rows above. Every business fact has at most one canonical
write authority.

| Business Fact | Canonical Owner | Legacy | Write Authority |
|---|---|---|---|
| Requirement | `requirements` | none | Canonical Requirement path |
| Evidence Fact | `evidence_source_facts` | `evidence_facts` | `EvidenceSourceFactService` |
| Requirement-Evidence Mapping | `requirement_evidence_fact_mappings` | `requirement_evidence_mappings` | `RequirementEvidenceFactMappingService` |
| Sufficiency | Evidence Support + Readiness | none | Backend derived (`aggregateEvidenceSufficiency`) |
| Claim permission | Claim Gate | none | `ClaimGateService` / Enterprise Claim Gate |
| Coverage | CoverageValidator / `requirement_coverages` | none | Coverage lifecycle |

Legacy Evidence Facts and legacy Mappings are limited to historical
compatibility, audit/read and temporary legacy UI/API compatibility. Their
approval fields are not formal authority for Claim, Sufficiency, Readiness,
Writer or canonical Mapping support. Canonical Mapping writes require the
database FK `requirements.id` and a Fact FK into `evidence_source_facts`;
display IDs, retrieval candidates, old `evidence_facts`, `evidences`, chunks
and source refs cannot substitute for those identities.

Sufficiency is derived through Evidence Support aggregation and
`EvidenceReadinessService`; it is not granted by a Mapping row or persisted as
an LLM assessment. Mapping approval remains distinct from Claim approval, and
Claim permission is decided only by the Claim Gate.

### Consumer authority confirmation

| Consumer | Canonical path | Legacy Mapping Authority | Result |
|---|---|---|---|
| `EvidenceReadinessService` | `listRequirementEvidenceFactMappings` + source facts/reviews | NO | canonical readiness only |
| `ReviewCenterService` | review/fact/mapping review services | NO | review/compatibility view only |
| `PgRepository.getApprovedRequirementFactSupport()` | approved canonical Fact Mapping joins | NO | canonical Claim support only |
| `ProductionBetaService.generateClaims()` | canonical support lookup, fail closed | NO | legacy support cannot authorize |
| `ClaimGateService` | Claim Gate evaluation | NO | mapping approval is insufficient |
| `EnterpriseClaimGateV2` | Enterprise Claim Gate evaluation | NO | canonical gated path |
| `DocumentGenerationService` | Writer authorization after Claim Gate | NO | no legacy Writer authority |
