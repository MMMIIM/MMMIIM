# V43 Mapping + Writer Special Audit Checkpoint

Status: `V43_MAPPING_WRITER_SPECIAL_AUDIT_CHECKPOINT`

Mode: read-only architecture audit. This checkpoint is the only file created by the audit. It was finalized after the closing focused-test, diff, worktree, and benchmark-preservation verification.

## 1. Worktree identity and baseline

- branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- dirty: `YES` (`104` porcelain entries at audit start)
- authoritative branch policy: current branch matches `config/branch-policy.json`
- baseline checkpoints read:
  - `06_global_engineering_quality_audit_checkpoint.md`
  - `07_p0_remediation_writer_v2_preimplementation_checkpoint.md`
- separate post-implementation Writer V2 checkpoint file: `NOT FOUND`; Writer V2 claims will be reconstructed from current production code/tests.
- AUTH-001: `FIXED / FRESH VERIFIED`. Focused formal-mutation tests cover the production entry points and owning-service project authorization boundary.
- DATA-001: `FIXED / FRESH VERIFIED`. Fact multi-candidate persistence and edit replacement use repository-owned transactions with rollback controls.
- DATA-002: `FIXED FOR ONE PAIR / FRESH VERIFIED`. Canonical Mapping replacement is atomic for one Requirement/Fact pair; this does not satisfy the future Requirement-to-N refresh transaction discussed in section 3.6.
- Provider credential rotation: `MANUAL_REQUIRED` in the latest checkpoint; no repository authority/evidence proves rotation completed. No secret values will be read or emitted.
- protected benchmarks observed at audit start:
  - `backend/eval/tender-benchmark-v1/`
  - `backend/eval/rag-pilot/`

## 2. Authority graph

`AUTHORITY_GRAPH = DRIFT_FOUND`

Verified canonical chain so far:

```text
Canonical Requirement
  -> Evidence Review / Support
  -> EvidenceSourceFactService / evidence_source_facts
  -> RequirementEvidenceFactMappingService / requirement_evidence_fact_mappings
  -> EvidenceReadinessService
  -> Claim Gate v2
  -> WriterInputAuthorizationService / writer_safe_contexts
  -> DocumentGenerationService(writerV2=true)
  -> document_versions
```

| Layer | Authority owner | Producer | Persistence owner | Approval / decision owner | Currentness / invalidation | Downstream consumer | Legacy parallel path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement | confirmed Requirement baseline | Requirement parse/baseline services | `requirements` repository path | user confirmation/baseline owner | baseline, Requirement hash and contract | Review, Mapping, Readiness, Claim, Writer planning | no second formal Requirement authority found |
| Support / Review | `EvidenceReviewService` + Evidence Support canonical factory | deterministic router plus bounded semantic reviewer | `evidence_candidate_reviews` via `PgRepository` | machine proposal; human approve/reject | Requirement text hash, source text hash, Review contract; stale decision invalidates | Fact eligibility, Readiness, Mapping candidate lineage | legacy Evidence views exist but are not canonical Review authority |
| Canonical Fact | `EvidenceSourceFactService` | approved Review + source-relative semantic candidate + Backend factory | `evidence_source_facts`; atomic multi-candidate write/replacement | machine extraction creates `draft`; human approve/reject/edit | Review approval, source/hash, Fact payload/contract, supersession | Mapping, Readiness, Project Fact lineage | `evidence_facts` remains a legacy mutation/read surface |
| Canonical Mapping | `RequirementEvidenceFactMappingService` + Mapping contract | default evaluator currently returns no candidate | `requirement_evidence_fact_mappings`; atomic per pair | machine `proposed`; current service human approve/reject | Requirement/Fact hashes/contracts/current approval, Mapping contract/evaluator version | Readiness and canonical Claim support lookup | `requirement_evidence_mappings` remains legacy and has no canonical Claim authority |
| Readiness | `EvidenceReadinessService` deterministic projection | approved/current Review, Fact and Mapping rows | derived response; no Mapping authority is persisted here | Backend derivation only | recomputed from current rows | readiness UI/generation advisory | no second readiness authority found |
| Claim Gate | `ClaimGateService` / Enterprise Claim Gate | deterministic Claim plus canonical Fact/Mapping adapter | `claims`, `claim_decisions`, `claim_gate_evaluations` | gate decision; permitted human decision cannot overturn deterministic rejection | intended Claim assertion/input/gate identity and lineage | Writer Input Authorization | older deterministic Claim projection coexists, but canonical support lookup is required |
| Writer Input Authorization | `WriterInputAuthorizationService` / `createWriterSafeContext()` | Project Facts, propagation bindings, current allow Claims/Gates | `writer_safe_contexts`, mention lineage | Backend-only authorization mode | Fact approval/conflict, gate currentness, authorization snapshot; implementation gaps below | Writer V2 task builder | no second formal Safe Context owner found |
| Writer V2 | sole server-owned `DocumentGenerationService(writerV2=true)` plus Writer Execution contract | Backend plans/context/batches; LLM drafts expression | generations/tasks, Writer execution rows, outputs, mentions | critical assertion, propagation and document validators | Safe Context identity and artifact invalidation; regeneration gaps below | Document Version and DOCX | V1 methods remain branch-inactive; smoke/eval paths are not production |
| Document Version | document generation/delivery services | validated/sanitized Writer result | `document_versions`, export records | pending review/delivery lifecycle | parent/version hashes and stored snapshots | review/export | no hidden third version authority found |

- Mapping producer in current production composition is still `ProviderNeutralMappingEvaluator`, whose `evaluate()` always returns `null`; the canonical Mapping write path therefore stops with `MAPPING_EVALUATION_REQUIRED` before persistence.
- Canonical Mapping persistence remains single-authority and atomic per Requirement/Fact pair through `replaceRequirementEvidenceFactMappingAtomic()`.
- Claim Gate consumes approved/current canonical Mapping + Fact rows through repository joins; no canonical Fact-to-Writer direct assertion path has been observed.
- **Direct enterprise Fact-to-Writer bypass is now confirmed.** `authorizeProjectFact()` returns `claim_required` for an approved `enterprise_fact` without a current allow Claim, but `createWriterSafeContext()` treats every mode except `blocked` as a `context_item`. `buildSectionContext()` then projects all context items into Provider-facing `project_facts` while dropping `authorization_mode` and `authorization_reason`.
- Executable offline proof with one approved enterprise Project Fact, one chapter binding, and zero Claims produced `authorization_mode=claim_required`, `assertable_claim_count=0`, while the complete enterprise value still appeared in `provider_project_facts`. This is a concrete `Fact -> Project Fact -> Writer` assertion bypass.
- Potential no-escalation break found in `adaptClaimGateInput()`: an exact Fact/Claim assertion match replaces any non-`reference_only` Mapping support with `full_support`. Full downstream reachability is being verified.
- Executable offline proof now confirms the downstream reachability: with identical approved/current Fact and Claim inputs, each original Mapping support value `partial_support`, `insufficient`, `conflict`, and `unknown` is adapted to `full_support` and reaches Claim Gate `decision=allow`, `writer_eligible=true`. Only `reference_only` remains `restrict`.
- Candidate-to-downstream bypass: no raw semantic Candidate write path was found; Backend factories/services remain the formal persistence boundary.
- Mapping-to-Writer direct path: none found. The actual drift is Fact -> approved Project Fact -> `claim_required` Safe Context item -> Provider-facing `project_facts`, which bypasses Mapping/Claim authorization semantics.
- Reference-to-Claim/assertion bypass: none found; references stay in `reference_materials`. They have separate relevance/currentness risks but no formal assertion authority.
- Second Mapping Authority: legacy mutation APIs remain visible but canonical Claim/Readiness queries do not treat those rows as authority. This is a P1 ambiguity/integration risk, not a proven canonical escalation.
- Second/third Writer production path: none found under the current server composition and `V43_LEGACY_GENERATION_COMPAT=false`.

## 3. Mapping design audit

`REQUIRES_SMALL_DECISIONS_AND_OWNER_FIXES`

### 3.1 Canonical contract (KEEP)

- relationships: `direct | partial | related | conflict | unrelated | unknown`
- support levels: `full_support | partial_support | conflict | insufficient | reference_only | unknown`
- dimensions: `subject_match | scope_match | status_match | quantitative_match | entity_match | validity_match | support_sufficiency`, each currently only `match | mismatch | unknown`
- lifecycle: `proposed | approved | rejected | invalidated`; creation is machine/proposed, current decision operation is human approve/reject.
- identity inputs: project, Requirement DB/id/hash/contract, Fact id/payload hash/contract, Mapping contract, evaluator version.
- currentness checks on human decision cover Requirement hash/contract/baseline, Fact approval/hash/contract, Mapping contract/evaluator. Prompt/schema/model/policy identity is not independently frozen unless manually encoded into `evaluator_version`.

### 3.2 Minimal LLM transport ownership

| Field | Owner classification | Evidence-based disposition |
| --- | --- | --- |
| `fact_ref` | `LLM_REQUIRED` | required to correlate a 4-6 Fact response with Backend-owned candidates; Backend verifies membership |
| `decision` | `LLM_REQUIRED` | minimal semantic judgment |
| subject/scope/status/quantity/entity/validity dimensions | `LLM_REQUIRED` | semantic comparison values; Backend validates enums and policy |
| `semantic_relationship` | `BACKEND_DERIVABLE` | deterministic projection from decision |
| `support_level` | `BACKEND_DERIVABLE/BACKEND_OVERRIDE` | projected from decision, then capped by upstream Support and risk policy |
| `support_sufficiency` | `UNNECESSARY` in LLM transport | no behavior-changing production consumer found for this Mapping dimension |
| `reason_codes` | `BACKEND_DERIVABLE` | derive from decision/dimensions/policy; do not accept free model codes |
| `review_status`, `reviewer_type` | `BACKEND_OVERRIDE` | Authority/lifecycle fields, never model-owned |
| `confidence`, free rationale | `UNNECESSARY` | not part of canonical authority and not required for the narrow decision |
| hashes/contracts/source/reviewer audit | `CANONICAL_ONLY` | Backend-owned identity and provenance |

- Decision projection is unique for the proposed enum: `direct_full -> direct/full_support`; `partial_support -> partial/partial_support`; `related_reference -> related/reference_only`; `related_insufficient -> related/insufficient`; `conflict -> conflict/conflict`; `unrelated -> unrelated/insufficient`; `unknown -> unknown/unknown`.
- Verdict for decision enum alone: `SIMPLIFIED_TRANSPORT_SAFE`.
- Verdict for the full `{fact_ref, decision, dimensions}` transport today: `SEMANTIC_LOSS` because Canonical dimensions cannot losslessly distinguish `not_applicable` from `unknown`.

### 3.3 N/A and support sufficiency

- Current Canonical `unknown` conflates “cannot determine” with “not applicable”. This is material because `status_match=unknown` or `validity_match=unknown` blocks `full_support`; quantity N/A likewise cannot be retained distinctly.
- Projecting transport N/A to Canonical `match` would permit full support but destroys the difference between “applicable and matched” and “not applicable”. Projecting it to `unknown` is conservative but creates false incompleteness. No lossless projection exists in the current enum.
- Verdict: `CONTRACT_CHANGE_CANDIDATE` limited to dimension N/A semantics; no change is made by this audit.
- `Mapping.dimensions.support_sufficiency` is serialized/listed but Readiness uses canonical `support_level`, and Claim Gate receives support from that same field. No direct behavior-changing consumer of the Mapping dimension was found. Recommendation: `REMOVE_FROM_MAPPING_LLM_TRANSPORT`; keep the Canonical field unchanged pending its own cleanup decision.

### 3.4 Candidate builder and no-escalation inputs

- Feasibility: `SAFE_WITH_THIN_QUERY`, not direct reuse of `getRequirementEvidenceFactMappingContext()`.
- The thin query can join confirmed Requirement -> approved Evidence Review for that Requirement and current hashes -> approved/current non-superseded Fact, enforcing same project/source lineage and deduplicating by Fact identity. No RAG or retrieval rerun is required.
- Current single-pair context query is unsafe for the future evaluator: it permits any approved Fact in the same project, does not require the Fact's Review to belong to the target Requirement, does not require the Review to be approved/current, does not exclude a superseded Fact, and does not expose upstream Support fields. Therefore it cannot enforce Support -> Mapping no-escalation.
- Required Backend cap: Mapping support may equal or be weaker than upstream Review support; `partial/insufficient/conflict -> full_support` must fail closed or require the explicit high-risk exception policy, never silently pass.

### 3.5 Call shape and data availability

- A read-only current DB measurement was attempted but PostgreSQL at `127.0.0.1:5432` was unavailable. It was not restarted under this audit's boundary.
- Latest auditable DB snapshot (`04_mapping_readiness_audit.json`) contains 272 confirmed Requirements, 0 approved canonical Evidence Source Facts, and 0 approved canonical Mappings. For that snapshot the observed candidate distribution is median/p90/max `0/0/0`, `>6=0`, expected calls `0`, skip rate `100%`.
- This is not evidence for a future positive Fact population. The 4-6 Facts/call split frequency and worst-case amplification remain `NOT_MEASURABLE` until a read-only current positive dataset exists; truncation is forbidden.

### 3.6 Machine approval, policy, transaction, idempotency

- Machine/human distinction: `EXISTING_SCHEMA_SUFFICIENT`. `reviewer_type`, `reviewed_by`, `reviewed_at`, `evaluator_version`, and lifecycle fields can distinguish LLM evaluation, Backend machine policy, and human override. Current service/repository implements only machine-proposed plus human decision; a Backend machine-policy decision operation and audit are still required. The model must never supply reviewer identity.
- Auto policy can remain Backend-only and narrow: auto-reject unrelated/insufficient; restrict related/reference-only; accept partial as partial; record conflict; machine-approve direct/full only when upstream Support permits it and no high-risk full-support exception applies. Unknown/ambiguous/high-risk full routes to exception. No new Priority Authority is needed.
- Atomicity: current repository is atomic only for one Requirement/Fact pair. It cannot provide the required Requirement -> N all-or-nothing refresh. Future producer needs prepare/validate/policy all, then one Requirement-scoped transaction that invalidates/replaces/decides the full set and rolls back all on failure.
- Idempotency is incomplete: individual mapping ID covers Requirement/Fact hashes, contracts, and evaluator version, but not Prompt/schema/model/policy identity unless bundled into evaluator version; no Requirement-level candidate-set identity controls removal/skip. Prompt change with unchanged evaluator version is drift.

## 4. Claim no-escalation audit

`CONFIRMED_ESCALATION`

- Candidate first-failure boundary: `backend/src/pipeline/claim-gate-input-adapter-v1.js` computes `supportLevel = exact ? full_support : mapping.support_level` (except `reference_only`). This can promote an approved `partial_support`, `insufficient`, `conflict`, or `unknown` Mapping to Claim-Gate `full_support` solely because Fact fields cover the drafted Claim.
- `enterprise-claim-gate-v2.js` then maps `full_support` to `support_sufficiency=sufficient` and may produce `decision=allow` when Fact dimensions match. This is a real Authority escalation surface, not a naming issue.
- Direct execution of `evaluateClaimGateBridge()` produced:
  - `partial_support -> adapted full_support -> allow/writer_eligible`
  - `insufficient -> adapted full_support -> allow/writer_eligible`
  - `conflict -> adapted full_support -> allow/writer_eligible`
  - `unknown -> adapted full_support -> allow/writer_eligible`
  - `reference_only -> reference_only -> restrict/not writer_eligible`
- Existing tests cover `reference_only`, but the test named `Requirement insufficient ... narrow exact Claim` explicitly permits the unsafe case and does not assert no escalation. No entry-point negative control proving `partial/insufficient/conflict/unknown -> never full/allow` exists in the inspected test.
- Primary owner and smallest fix boundary: preserve canonical Mapping `support_level` in `adaptClaimGateInput()`; exact Fact coverage may populate dimension checks but must not upgrade Mapping authority. Add adapter and real entry-point negative controls. No Prompt/model change is implicated.

## 5. Writer V2 production-path audit

`WRITER_V2_BLOCKED`

- Active production constructor: `backend/src/server.js` creates exactly one `DocumentGenerationService` with `writerV2:true`; the project document-generation and regeneration routes use this instance.
- V2 composition reaches `DocumentPlan -> SectionContext -> WriterReferenceSelector -> BatchBuilder V2 -> WriterProvider -> WriterExecution guards -> document version persistence`.
- The older V1 methods remain in the same class but are branch-inactive for the production instance; no separately wired third production DocumentGenerationService or ExternalWriterProvider has been found.
- Production integration drift found: `writer-input-authorization-v1` requires Claim `assertion_hash`, referenced Fact/Mapping IDs and Gate `claim_assertion_hash`, `gate_result_id`, `input_snapshot_hash`, `lineage_current`. The production `claims` query and `claim_gate_evaluations` table/query do not provide those identities. Current Writer V2 tests inject them manually. Consequently current persisted production rows cannot satisfy `isCurrentAllowClaim()` and approved enterprise Claims/Project Facts are omitted from `assertable_claims`.
- This is evidence of `CONTEXT_LOSS` on the real DB-backed composition even though the in-memory production-composition test passes.
- A separate and more severe `AUTHORITY_BYPASS` exists even before that DB identity drift is repaired: approved `enterprise_fact` items without an allow Claim are sent in Provider-facing `project_facts` as `claim_required`. Because the V2 payload omits authorization mode and `buildWriterTask()`/Critical Assertion Guard treat every `context_item` value as authorized, the model can assert the enterprise value without Mapping/Claim authorization.
- Smallest owner-level boundary fix: `claim_required` enterprise facts must not enter Provider-visible `context_items`/`project_facts`; keep them blocked/pending in Safe Context until a current allow Claim exists. Add Safe Context, active HTTP entry-point, and Writer-output negative controls. No Writer Prompt/model change is implicated.
- Approved Claims have the inverse composition gap: `buildSectionContext()` does not project eligible section Claims directly. `createWriterSafeContext()` only adds a Claim while iterating a chapter-bound Project Fact that resolves to that current allow Claim. A valid approved/current Claim with no matching Project Fact/binding is therefore omitted from `approved_claims`.
- Provider payload projection is otherwise narrow: `section`, safe Requirements, Safe-Context Claims, projected Project Facts, and context-only references. Mapping internals, raw Evidence/Fact rows, support/readiness, retrieval scores, hashes, and audit metadata are not sent.
- Reference selector is read-only and writes no Retrieval/Evidence/Fact/Claim state. It may create a query embedding, but does not re-embed corpus chunks or create a retrieval run. Public references require governed active/approved/indexed state; enterprise-private fallback queries require extraction success but not equivalent lifecycle approval, and a missing embedding client falls back to deterministic first chunks rather than semantic relevance.
- Production path inventory:
  - `ACTIVE_V2`: project document-generation route -> the sole server-owned `DocumentGenerationService(writerV2=true)` -> `WriterProvider(section_drafting)` -> V2 guards/validators/version.
  - `LEGACY_INACTIVE`: V1 methods in the same class and `document-generation.js` batching; runtime config reports `V43_LEGACY_GENERATION_COMPAT=false`.
  - `TEST_ONLY/SMOKE_ONLY`: `live-gateway-tools`, document task scripts, External Writer preflight/provider.
  - `HIDDEN_ACTIVE_PATH`: none found under the current runtime configuration.
- Validator ownership is layered rather than singular:
  - `writer-execution-contract-v1.js` owns Task/output identity, authorized reference IDs, exact mention slices, critical assertion guard, and propagation coverage.
  - `document-sanitizer.js` owns deterministic removal/manual routing for third-party modification, commercial claims, and unsupported fixed commitments.
  - `document-validator.js` owns REQ-ID immutability/routing, final sentence safety, and requirement coverage.
  - `document-structure-validator.js` owns renderer-facing tree shape only.
- `coverage-validator.js` belongs to the older response-plan/approved-claim path and is not the authority for V2 Safe Context authorization.
- Fresh frozen-199 replay through current DocumentPlan routing and BatchBuilder V2 produced 185 Writer-eligible Requirements across 6 active chapters and 2 batches (`04/05/06/07` and `08/09`), with estimator totals `3,754 + 3,255 = 7,009` tokens and `28,113` serialized input chars. This replay included Requirements only because the current positive DB chain was unavailable; it is not represented as a full-context cost.
- The asserted “1 batch / ~4972” is not reproduced by current code/data. More importantly, `estimated_tokens = JSON.stringify(inputSections).length / 4` excludes task instruction, Gateway envelope/Prompt/schema, section markers, expected output, and safety margin. `estimated_tokens` is also discarded by `createDocumentTasks()` rather than persisted. Verdict: `ESTIMATOR_UNDERCOUNT`, not proven context dedup.
- V2 has no automatic retry: each batch is attempted once. The manual retry endpoint can reset failed batches and rebuild current contexts; the old V1 network/timeout retry loop is inactive. A bounded recoverable-only V2 retry policy is not implemented.
- Regeneration reuses frozen reference projections and does not rerun retrieval. It reloads current Project Facts/bindings/Gate rows, but uses the frozen legacy Claim snapshot and has no persisted Prompt/schema/model identity check. Project Fact conflict/approval is rechecked, while Claim currentness and Writer runtime identity are not reliably reconstructable from persisted snapshots. Only the parent document hash is fail-closed at apply time. Verdict: regeneration currentness `REMEDIATION_REQUIRED`.

## 6. Error, retry, observability, and performance

`DRIFT_FOUND`

- Mapping: current producer stops at `MAPPING_EVALUATION_REQUIRED`; no Provider/retry path exists. Future retry must be limited to transport/schema repair, never semantic partial/conflict/insufficient/none. Existing Mapping rows lack explicit Prompt/schema/model/policy/input-set identity and latency/token/retry audit.
- Writer errors retain specific error codes when available and task runtime, but Provider audit currently records only provider/task type. It does not persist model, Prompt/schema identity, token counts, or the computed batch estimate. Safe Context is persisted separately but the generation task input does not retain its authorization hash as an explicit link.
- Writer V2 performs one attempt; failure becomes a failed batch. Manual retry is explicit but not internally bounded across repeated API invocations. There is no `retry_exhausted` state distinct from repeated user retries.
- Performance evidence: legacy checkpoint measured 6 calls/43,775 old estimator tokens; current Requirement-only V2 replay measured 2 calls/7,009 new estimator tokens. These estimators use different payload shapes and token divisors and are not a valid quality/cost comparison. No Provider latency or output-token claim is made.
- Test status: 173 focused offline tests passed, including authorization/atomicity, Mapping contract and production Claim entry, Claim Gate, Readiness, Writer Safe Context/Execution/V2 composition, and document delivery. They do not cover the two executable counterexamples: Mapping-support promotion or Provider-visible `claim_required` enterprise Fact exposure. In particular, the current test named `Requirement insufficient 不单独 hard reject narrow exact Claim` encodes the promotion behavior rather than preventing it.

## 7. Risk register

| ID | Module | Risk | Executable/code evidence | Business impact | Engineering impact | Priority | Smallest action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MW-AUTH-001 | Mapping -> Claim | Claim adapter promotes `partial_support`, `insufficient`, `conflict`, and `unknown` to `full_support` when a narrow Claim is exactly covered | `claim-gate-input-adapter-v1.js:5`; direct bridge execution reached `allow/writer_eligible` for all four values | weak/conflicting Requirement support can authorize a strong enterprise Claim | breaks no-escalation and invalidates downstream safety evidence | P0 | preserve canonical Mapping support in adapter; exact coverage may only populate dimensions; add adapter + HTTP negative controls |
| MW-AUTH-002 | Project Fact -> Writer | `claim_required` enterprise Fact enters Provider-visible `project_facts` with its authorization mode removed | `writer-input-authorization-v1.js:29,49-51`; `section-context-builder.js:41-42`; executable zero-Claim proof | enterprise data can be asserted without an allow Claim | active Writer Authority bypass | P0 | exclude `claim_required` enterprise values from Provider context until a current allow Claim exists; add Safe Context, entry-point and output controls |
| SEC-001 | Provider credential | prior audit recorded credential exposure; latest authorized checkpoint remains `MANUAL_REQUIRED`; repository has no evidence of rotation completion | `06_global_engineering_quality_audit_checkpoint.md:24`; `07_p0...checkpoint.md:22,38` | credential misuse risk remains operationally unresolved | release/live authorization must not assume the old key is safe | P0 | rotate/revoke through Provider console and authorized secret environment; record non-secret completion evidence |
| MAP-001 | Mapping producer | default `ProviderNeutralMappingEvaluator.evaluate()` returns `null` | production `propose()` stops at `MAPPING_EVALUATION_REQUIRED` | no canonical Mapping can be created by default production composition | Mapping stage is non-operational | P1 | implement only the accepted narrow evaluator after the design decisions below |
| MAP-002 | Mapping candidate builder | current single-pair context allows same-project Fact without proving target Review ownership/current approval/supersession and omits upstream Support | current `getRequirementEvidenceFactMappingContext()` join/shape | cross-Requirement or stale candidates; no upstream cap | unsafe input for a future semantic evaluator | P1 | add the thin Requirement -> approved Review -> current Fact query; no Retrieval rerun |
| MAP-003 | Mapping dimensions | Canonical `unknown` conflates unknown and not-applicable | contract enums + full-support dimension rules | false incompleteness or lossy N/A projection | blocks lossless `{fact_ref,decision,dimensions}` transport | P1 | explicit small contract decision before implementation; do not silently coerce N/A |
| MAP-004 | Mapping transaction/identity | repository is atomic per pair, not for Requirement -> N; Prompt/schema/model/policy and candidate-set identity are not explicit | service/repository identity and replacement path | partial refresh or stale skip can leave incomplete mappings | future producer cannot safely batch/skip | P1 | Requirement-scoped prepare/validate/policy transaction and complete evaluation identity |
| WRITER-001 | Claim -> Safe Context | persisted Claim/Gate rows do not expose the assertion/currentness identity required by `isCurrentAllowClaim()` | `writer-input-authorization-v1.js:17-20`; `db.js:1283,1290` | valid approved Claims disappear from Writer context | production composition differs from fixture-only tests | P1 | persist/query the existing canonical identity fields; no new authority |
| WRITER-002 | Section composition | approved Claims are discovered only while iterating a matching chapter-bound Project Fact | `createWriterSafeContext()` and `buildSectionContext()` composition | legitimate approved Claim can be omitted | inverse context-loss path | P1 | project current section Claims independently, then link optional Project Fact context |
| WRITER-003 | Regeneration | reloads current Project Facts/Gates but retains frozen legacy Claim snapshot and lacks Writer Prompt/schema/model identity validation | `document-generation-service.js:312+`; version snapshot fields | regenerated chapter may mix stale Claim/runtime identity | reproducibility/currentness gap | P1 | fail closed on Claim and Writer runtime identity; retain frozen references |
| LEGACY-001 | Fact/Mapping surfaces | legacy Fact and Mapping mutations remain user/integration-visible though ADR-017 denies them canonical authority | legacy routes/repository paths recorded in baseline | approved-looking state can be ignored by canonical chain, confusing operators | parallel lifecycle debt | P1 | fence normal writes; retain historical reads explicitly |
| WRITER-004 | Batch budget | estimate is serialized section input chars/4 only and is not persisted | `writer-generation-batch-builder-v2.js`; 199-Gold replay | output truncation/cost risk is understated | no prompt/schema/envelope/output reserve or audit trail | P2 | define and persist a conservative full-envelope estimate and output reserve |
| OBS-001 | Mapping/Writer audit | Mapping lacks runtime/token/retry/policy identity; Writer provider audit omits model/Prompt/schema/tokens and task loses estimate | current persistence shapes | failures/costs cannot be reconstructed reliably | weak first-failure observability | P2 | extend existing audit snapshots only; do not add a second observability system |
| RETRY-001 | Writer retry | V2 has one automatic attempt; manual retry can be invoked repeatedly with no persisted exhaustion boundary | V2 run/manual retry path | recoverable failures need operator work; repeated retries are weakly bounded | operational debt, not authority bypass | P2 | explicit bounded recoverable-only retry/exhaustion policy |
| REF-001 | Writer references | no-embedding fallback returns deterministic first chunks; enterprise-private reference eligibility is weaker than public governance | `writer-reference-selector.js` path | context relevance/currentness can degrade while remaining non-authoritative | quality/privacy review debt | P2 | preserve context-only status; tighten read eligibility and make no-vector fallback explicit |

## 8. Freeze and final gates

### 8.1 Frozen/passed layers

- Keep ADR-017 authority: `evidence_source_facts` and `requirement_evidence_fact_mappings` remain the only canonical Fact/Mapping stores and owning services remain the only write authorities.
- Keep Canonical Requirement, Source hash/provenance, Canonical Fact, existing Mapping shape, Evidence Support, Readiness derivation, Claim Gate contract, Project Fact contract, Writer Execution contract, Mention/Propagation, document validation and DOCX model closed. This audit does not reopen their definitions.
- Keep the accepted provider-neutral boundary: semantic workers propose values only; Backend owns identity, validation, policy, lifecycle and persistence.
- AUTH-001 and Fact atomicity remain passed. Per-pair Mapping replacement remains passed, but is not evidence for future Requirement-level multi-row atomicity.
- Active Writer V2 consolidation and read-only reference boundary remain passed; no hidden third production Writer path was found.

### 8.2 Unresolved owner decisions/repairs

- Small Mapping decisions: N/A representation; exact minimal transport fields; Backend machine-policy operation; Prompt/schema/model/policy identity; Requirement-level candidate-set identity.
- Owner repairs before live: safe thin candidate query, Requirement-scoped transaction, Claim no-escalation adapter, persisted Claim/Gate currentness identity, `claim_required` enterprise Fact exclusion, independent section Claim composition, regeneration identity.
- Operational evidence: Provider credential rotation completion and a future read-only positive canonical Fact population for call-shape measurement.
- No large/live evidence-chain run is authorized or justified while the two P0 boundary violations remain.

### 8.3 Final gates

- Mapping: `MAPPING_V1_DESIGN_REQUIRES_SMALL_DECISIONS`
  - The canonical owner and narrow design are viable, but N/A semantics, Requirement-level transaction/identity and the safe candidate query must be settled before implementation.
- Writer: `WRITER_V2_BLOCKED`
  - One active production path exists, but Provider-visible `claim_required` enterprise facts are an Authority bypass and persisted approved Claims cannot satisfy currentness checks.
- Cross-chain: `MAPPING_CLAIM_WRITER_BOUNDARY_BLOCKED`
  - Mapping support is demonstrably promoted at Claim adaptation and enterprise Fact values demonstrably bypass Claim authorization at Writer composition.
- Large Live: `LARGE_EVIDENCE_CHAIN_LIVE_NOT_EXECUTED`

### 8.4 Requested checkpoint index

1. worktree identity: section 1
2. Authority graph: section 2 (`DRIFT_FOUND`)
3. Mapping Transport: section 3.2 (`decision enum SAFE`; full minimal transport currently `SEMANTIC_LOSS`)
4. N/A: section 3.3 (`CONTRACT_CHANGE_CANDIDATE`)
5. support_sufficiency: section 3.3 (`REMOVE_FROM_MAPPING_LLM_TRANSPORT`; Canonical unchanged)
6. Candidate Builder: section 3.4 (`SAFE_WITH_THIN_QUERY`)
7. machine approval: section 3.6 (`EXISTING_SCHEMA_SUFFICIENT`)
8. Mapping atomicity/idempotency: section 3.6 (pair atomic; Requirement-set/identity incomplete)
9. Mapping no-escalation: sections 3.4/8.2 (Backend cap required)
10. Claim promotion: section 4 (`CONFIRMED_ESCALATION`)
11. Writer production path: section 5 (`ACTIVE_V2`)
12. hidden path: section 5 (none found)
13. SectionContext/reference boundary: section 5 (payload narrow; references context-only)
14. Project Fact adoption: section 5 (active, but `claim_required` bypass)
15. validator ownership: section 5 (layered owners, no second formal authority)
16. batch/token: sections 5-6 (`ESTIMATOR_UNDERCOUNT`)
17. regeneration: section 5 (`REMEDIATION_REQUIRED`)
18. observability/retry: section 6
19. performance: sections 3.5 and 5-6
20. P0/P1/P2 register: section 7
21. freeze/unresolved: sections 8.1-8.2
22. final gates: section 8.3
23. safety: section 9

## 9. Safety ledger

- source changes: `0`
- audit artifact writes: `1` (this checkpoint only)
- Prompt/Schema/Contract changes: `0`
- DB writes: `0`
- Provider/DeepSeek/Dify calls: `0`
- restart/deploy: `0`
- Git destructive actions: `0`
- focused offline tests: `173/173 PASS`
- `git diff --check`: `PASS` (line-ending conversion warnings only; no whitespace errors)
- current branch / HEAD rechecked: `feat/v4.3-semantic-boundary-routing` / `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- dirty worktree preserved: `YES`
- benchmarks preserved: `YES`
