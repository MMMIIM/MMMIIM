# V43_OVERNIGHT_GLOBAL_ENGINEERING_QUALITY_MASTER_CHECKPOINT

Audit status: COMPLETE  
Mode: read-only engineering audit; this file is the only audit artifact created.  
Evidence rule: findings below require an observed call chain, executable result, or runtime artifact; names and TODOs alone are not treated as defects.

## EXECUTIVE VERDICT

- overall engineering health: **核心 Authority 分层方向正确，Claim/Writer 与来源隔离有强负向门禁；但正式 Evidence 生命周期仍存在三个发布级缺口。**
- architecture direction: **KEEP** — Backend Control Plane 继续拥有 Review/Fact/Mapping/Claim/Writer authority；未发现需要新增 Agent、RAG 架构或第二套 Canonical Authority 的证据。
- immediate P0: 项目级授权未覆盖正式决定端点；Canonical Fact/Mapping 替代写入非事务；本次审计工具输出曾意外暴露 Provider credential，必须轮换。
- immediate P1: Support 生产语义组合尚未闭合；Mapping producer 是 stub；runtime/eval identity、raw failure evidence、domain metadata ownership、legacy mutation surface 尚未收口。
- safe to continue development: **YES, only in the ordered remediation path below; NO large live or release certification.**
- Mapping ready: **NO**.
- Large Evidence Chain ready: **NO**.

## OPEN DRIFT REGISTER

| ID | Drift Type | Module | Evidence | Impact | Priority |
| -- | ---------- | ------ | -------- | ------ | -------- |
| AUTH-001 | Authority / security | Review, canonical Fact, canonical Mapping, Project Fact, Claim, Document endpoints | Review proposal calls `ProjectAuthorizationService.assertProjectAccess()` at `backend/src/app.js:336-353`; Fact extraction enforces it at `backend/src/evidence-source-fact-service.js:131-140`. Sibling decisions/proposals at `backend/src/app.js:393,396-401,425-435` call owning services without a project-access assertion. `ProjectAuthorizationService.assertProjectAccess()` is the actual membership gate at `backend/src/project-authorization-service.js:32-45`. | A trusted actor can reach formal mutations outside proven project membership. Loopback binding (`backend/src/server.js:140-141`) reduces network exposure but does not establish project authority. | P0 |
| DATA-001 | Atomicity / lifecycle | Canonical Fact | `EvidenceSourceFactService.extract()` persists each candidate inside a loop (`backend/src/evidence-source-fact-service.js:200-215`); each upsert is an independent `pool.query` (`backend/src/db.js:219`). Fact edit invalidates then inserts via two calls (`evidence-source-fact-service.js:261-286`; `db.js:219,221`). | A later candidate/insert failure can leave a partial Fact set; edit failure can leave the predecessor invalidated without its replacement. | P0 |
| DATA-002 | Atomicity / lifecycle | Canonical Mapping | `RequirementEvidenceFactMappingService.propose()` invalidates obsolete rows before upsert (`backend/src/requirement-evidence-fact-mapping-service.js:5`); repository operations are separate calls (`backend/src/db.js:225-226`). | Failed replacement can invalidate the current Mapping without producing the new proposal. | P0 |
| SEC-001 | Secret handling incident | Local audit/runtime credential | During this audit, a broad environment search printed the configured Provider key into tool output. The repository ignores local env files, but the credential has crossed its intended boundary. | Credential should be considered exposed and rotated; do not repeat it in artifacts. | P0 |
| AUTH-002 | Parallel legacy surface | Fact / Mapping | ADR-017 declares `evidence_source_facts` and `requirement_evidence_fact_mappings` canonical (`docs/decisions/017-canonical-requirement-evidence-fact-mapping-authority.md:24-46`). Legacy mutation routes remain active at `backend/src/app.js:318-325,358-377`, writing `evidence_facts`/legacy mappings (`backend/src/evidence-fact-service.js:28-30`; `backend/src/db.js:333`). Canonical Claim support reads only the new tables (`backend/src/db.js:231`). | No observed Claim bypass, but users/integrations can create approved-looking legacy state that canonical Readiness/Claim ignores. | P1 |
| COMP-001 | Production composition | Evidence Support | Production constructs `new EvidenceSupportReviewEvaluator()` without a semantic adjudicator (`backend/src/server.js:65-69`). Ambiguous cases throw `ASSESSMENT_UNAVAILABLE` (`backend/src/pipeline/evidence-support-review-evaluator.js:202-219`) before `EvidenceReviewService.propose()` can persist a Review. | Intentional fail-closed Beta behavior, but ambiguous evidence has no persisted Review object for later human decision. | P1 |
| MAP-001 | Missing producer | Canonical Mapping | Production uses default `ProviderNeutralMappingEvaluator` (`backend/src/server.js:93`); its `evaluate()` always returns `null` (`backend/src/pipeline/requirement-evidence-mapping-contract-v1.js:22`), so propose fails with `MAPPING_EVALUATION_REQUIRED` (`backend/src/requirement-evidence-fact-mapping-service.js:5`). | Canonical Mapping cannot be produced through the default production composition. | P1 |
| ID-001 | Runtime identity | Semantic Gateway | Fresh `/info` exposes revision, dirty flag, task contract/instruction/schema hashes, but not model, `enable_thinking`, or process `started_at`. Two dirty runtimes can share `f509514` and identical schema hashes while executing different runtime code/config. | Runtime certification and release reproduction are incomplete. | P1 |
| EVAL-001 | Eval attribution | RAG/Evidence benchmark | `controlled-rerun.js:64` and `overnight-benchmark.js:610,638` read benchmark-process `process.env` for runtime snapshots, while calls go through the Gateway. Historical reports therefore recorded mock defaults although `/ready` showed the real Gateway provider. | Model/provider attribution can be wrong even when call accounting is correct. | P1 |
| OBS-001 | First-failure evidence | Gateway → Backend | Provider adapter has `model_content`/parsed JSON in process memory (`services/semantic-gateway/src/openai-compatible-provider.js:404-431`), but Gateway safe diagnostics persist hashes/lengths/tokens rather than raw output (`services/semantic-gateway/src/gateway.js:285-365`); Backend receives the safe envelope (`backend/src/pipeline/semantic-gateway-client.js:481-485`). | Historical schema failures cannot always be semantically adjudicated or reproduced from artifacts. | P1 |
| FACT-001 | Unresolved semantic ownership | `domain_metadata` | Provider transport requires it (`packages/semantic-contracts/index.js:241,352,410`), Backend projects it (`backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js:236`), and canonical Fact includes it in `payload_hash`/`fact_id` (`backend/src/pipeline/evidence-fact-contract-v1.js:24-27`). Repository search found no behavior-changing Mapping/Sufficiency/Readiness/Claim/Writer consumer. | An unresolved LLM field changes Fact identity and supersession without an observed downstream business use. | P1 |
| RETRY-001 | Recovery effectiveness | Fact extraction | Corrective retry is bounded to two attempts and only schema-invalid or expected-empty cases (`backend/src/evidence-source-fact-service.js:37-68,147-196`). Historical controlled evidence recorded retries without recovery; no current post-transport live effectiveness proof exists. | Safe but possibly costly retry; effectiveness remains unmeasured after the latest Prompt/transport changes. | P1 |
| DOC-001 | Stage/decision identity | Governance docs | `docs/CURRENT_STAGE.md:73-145` still describes Stage20-S as locally implemented/live pending and deterministic-only; current dirty work includes later Fact/Support work. ADR-021 records obsolete Fact instruction hash at line 307, while runtime/worktree report `f4303de...10925d`. No repository ADR-022/model-selection decision artifact was found. | A future session can select stale stage/model assumptions even though code/runtime has moved. | P1 |
| TEST-001 | Brittle/stale assertion | Governance tests | Fresh `node --test backend/test/engineering-governance-parity.test.js` = 0/3. Tests assert removed literal headings/phrases (`7. Parity`, `production owner`, `Ephemeral Identity`) while the compact Skill still contains substantive Parity and event-triggered Runtime rules. | False red from documentation wording; no executable behavior evidence. | P2 |
| DATA-003 | Failure audit atomicity | Generation | Failure audit insert and job failure update are separate best-effort calls (`backend/src/service.js:30-59`; `backend/src/pipeline/generation-audit.js:210-231`). `createJob()` inserts a job then updates project status separately (`backend/src/db.js:1081-1087`). | Failure remains fail-closed, but an audit row or project/job status can be incomplete. | P2 |
| ERR-001 | Error semantics overlap | Support | Technical unavailability uses `ASSESSMENT_UNAVAILABLE` (`evidence-support-review-evaluator.js:92-96`), while sufficiency aggregation also represents unavailable business state. | Operators may conflate technical evaluation failure with business insufficiency unless stage/details are preserved. | P2 |

## AUTHORITY RISKS

| Layer | Canonical Authority | Duplicate Writer | Candidate Bypass | Status |
| ----- | ------------------- | ---------------- | ---------------- | ------ |
| Requirement | Confirmed `requirements` / Requirement owning services | Legacy/historical views only | No bypass observed in audited Fact/Mapping path | FROZEN; do not reopen |
| Support | `EvidenceReviewService` + canonical Evidence Support factory | Eval can inject semantic adjudicator; production cannot | Retrieval candidate cannot directly become Fact; however ambiguous cases produce no Review | BETA / composition incomplete |
| Fact | `EvidenceSourceFactService` → `createEvidenceFactContract()` → `evidence_source_facts` | Active legacy `EvidenceFactService` writes `evidence_facts` | Canonical downstream does not read legacy table | Canonical boundary sound; mutation safety incomplete |
| Mapping | `RequirementEvidenceFactMappingService` → canonical contract → `requirement_evidence_fact_mappings` | Active legacy mapping API | Canonical Claim query only reads canonical approved/current mapping | BLOCKED by producer, auth, atomicity |
| Sufficiency | Backend aggregate/readiness services | No LLM authority observed | Review-dimension `support_sufficiency` does not directly authorize Claim | Deterministic; naming ownership partially unresolved |
| Claim | Claim Gate evaluation + approved/current canonical inputs | Older production-beta/document paths coexist | Claim Adapter and Writer Safe Context reject non-current/unapproved lineage | Guarded; legacy composition needs release review |

## UNFROZEN MODULES

### Fact

- status: **BOUNDARY MOSTLY SOUND / PRODUCER NOT FREEZE-READY**.
- blockers: P0 authorization and atomicity; unresolved `domain_metadata` identity ownership; model/structured-output and retry effectiveness lack a current bounded qualification result; raw failure evidence gap.
- non-blockers: source-relative input, exact source hash/provenance, flat semantic subject → deterministic canonical subject, draft machine lifecycle, Canonical Factory validation, Mapping/Claim non-escalation are all covered by executable tests.
- recommended next decision: settle generic transport ownership (`domain_metadata`) and qualify one Fact worker only after P0 mutation safety.

### Domain Metadata

- status: `REMOVE_FROM_GENERIC_LLM_TRANSPORT_RECOMMENDED`; no implementation in this audit.
- downstream dependency: persisted and identity-changing, but no observed behavior-changing production consumer.
- recommendation: keep canonical Fact shape unchanged; remove it from generic LLM responsibility or establish a real owner/consumer before allowing it to affect identity.

### Mapping

- status: **BLOCKED**.
- blockers: default evaluator returns null; project authorization absent from propose/decide; replacement is non-atomic; legacy Mapping mutation surface remains user-visible.

### Sufficiency / Readiness

- status: deterministic aggregate/readiness ownership is intact.
- ownership risks: Evidence Review `review_dimensions.support_sufficiency` remains semantically under evaluation; Claim Gate's similarly named dimension is independently derived from canonical Mapping `support_level`, not the Review field. No direct unsafe dependency was found.

### Support Production Composition

- status: `INTENTIONAL_BETA_LIMITATION`.
- Beta impact: deterministic cases can persist Review; ambiguous cases fail closed before Review persistence and cannot be handed to the existing Review decision endpoint without a proposal object.

## FAILURE PATHS

| Failure | Persisted invalid data risk | Retry | Human escalation | Audit | Status |
| ------- | --------------------------: | ----: | ---------------: | ----: | ------ |
| Provider failure | 0 canonical Fact from failed extraction | no transport retry in Fact service | error returned; no Fact to review | safe diagnostics, raw output unavailable | FAIL-CLOSED |
| Schema failure | 0 canonical Fact | one bounded corrective retry when field diagnostic exists | final failure requires external/human diagnosis | both attempt summaries retained; raw body gap | FAIL-CLOSED / effectiveness unproven |
| Semantic empty | 0 when empty unexpected; empty can be valid when context says no Fact expected | retry only for expected-positive empty | no canonical Fact; human can act only outside this extraction call | attempt metadata retained | FAIL-CLOSED |
| Grounding failure | 0 for the failing candidate, but earlier candidates in same response may already be persisted | no retry | no automatic approval | stage `FACT` error | FAIL-CLOSED PER CANDIDATE, NON-ATOMIC SET |
| Mapping failure | no invalid new Mapping; obsolete current Mapping may already be invalidated | no retry | proposal cannot be decided if not created | structured error | FAIL-CLOSED OUTPUT, NON-ATOMIC REPLACEMENT |

## PRODUCTION ↔ EVAL

| Task | Production | Eval | Difference | Classification |
| ---- | ---------- | ---- | ---------- | -------------- |
| Requirement | Canonical parser/router/chunker/Gateway path | Certified harness reuses production input builder and parity assertion | current design aligned | PARITY GUARDED |
| Support | deterministic `EvidenceSupportReviewEvaluator` without semantic adjudicator | benchmarks inject Semantic Gateway adjudicator | intentionally different capability | INTENTIONAL_BETA_LIMITATION |
| Fact | Gateway extractor → canonical validation → persistence | eval reuses extractor but captures candidates/audits and may avoid DB writes | evidence capture/additional instrumentation | ACCEPTABLE IF IDENTITY FIXED |
| Mapping | default evaluator stub, no production candidate | audit fixtures/manual evaluators can create candidates | eval has capability production lacks | PRODUCTION GAP |
| Claim | canonical approved/current Mapping/Fact query and Claim Gate | tests use deterministic fixtures | same contract assertions; fixture data only | PARITY TESTED |
| Writer | active document generation uses approved Claim snapshots; newer Safe Context/Writer execution guards exist separately | deterministic and pre-E2E fixtures test Safe Context/Claim authorization | two compositions coexist | RELEASE COMPOSITION REVIEW REQUIRED |

## RUNTIME / RELEASE

- Git revision: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`.
- dirty: YES.
- baseline observed before this checkpoint: 45 tracked modified files; 35 untracked porcelain entries; benchmark directory present.
- Runtime fingerprint completeness: **INCOMPLETE** — task contract/Prompt/schema hashes are good; model, thinking config, process start/build identity are absent from `/info`.
- reproducible release possible: **NO** from current dirty worktree/runtime identity alone.
- risk: a stale or differently configured process can share the same HEAD/dirty marker; eval can attribute the benchmark process's env rather than the Gateway's actual runtime.

## TEST QUALITY

- invariant guards: strong targeted coverage for Fact provenance/draft lifecycle, Mapping currentness, Claim Gate, Writer authorization, source hash, parity, and fail-closed behavior. Final fresh focused run: 241/241 PASS.
- production-composition coverage: Review proposal and Fact extraction have real-entrypoint/adoption tests; sibling Review/Fact/Mapping decisions and several Project Fact/Claim/Document mutations lack project-membership negative controls.
- brittle tests: governance test checks Markdown wording instead of executable routing behavior; fresh result 0/3.
- stale assertions: ADR-021 hash and `CURRENT_STAGE.md` operational state lag current runtime/worktree.
- false confidence risks: offline `Provider=0` contract tests prove deterministic boundaries, not model quality; mock runtime snapshots do not prove actual Gateway provider identity.

## OBSERVABILITY

- raw Provider trace: available transiently inside Provider adapter; not retained through safe Gateway/Backend failure artifacts.
- request contract identity: task contract, Prompt instruction, candidate/transport schema, task schema hashes are exposed.
- Prompt identity: PASS for current runtime/worktree at audit time.
- model identity: available in Provider audit per call, absent from `/info` certification surface.
- validation diagnostics: field-level path/keyword/expected/actual type available for schema errors.
- lineage completeness: canonical Fact and Mapping contracts preserve source/hash/version lineage; failed Provider semantic output is not fully reconstructable.

Minimal eval-only failure envelope recommended: run/case/task ID; contract/Prompt/transport/task-schema hashes; actual Gateway endpoint/provider/model/thinking config; request input hash/length; Provider HTTP/finish/tokens/latency/trace; response content hash/length; field diagnostics; optional access-controlled short-retention raw output. Never log keys or full enterprise payloads by default.

## PERFORMANCE / COST RISKS

- LLM call amplification: current Requirement extraction is one call per provider-ready chunk. Future semantic Support can approach `Requirement count × candidate K`; with 200 Requirements and K=5 this is up to 1,000 Support calls before Fact.
- retry amplification: Fact extraction is at most 2 attempts per approved Review; Writer batches are at most 2 attempts only for network/timeout.
- likely bottleneck: Support candidate fan-out, followed by Fact corrective retries and per-chunk Requirement extraction.
- unnecessary duplicated calls: runtime certification repeated per case is avoidable; current governance says reuse one certification in an unchanged run. Eval runtime attribution must be fixed before using that reuse for formal reports.

## SECURITY / DATA BOUNDARY

- cross-project risk: **CONFIRMED AUTHORIZATION ADOPTION GAP** on authority-bearing mutation routes; actor spoofing from request bodies is separately prevented (`backend/src/request-actor.js:8-56`).
- synthetic contamination: corpus scope and source-eligibility gates distinguish public guidance/synthetic material from enterprise Evidence; no bypass to canonical Fact/Claim was observed.
- secrets/logging: production code does not intentionally log API keys; however this audit's tool output exposed the configured Provider key. Rotate it immediately.
- Provider data exposure: Fact semantic input is bounded to trusted source text plus material context; Requirement/support identifiers are not included in the Fact extraction payload.
- status: **P0 until membership authorization and credential rotation are complete.**

# PRIORITIES

## P0 — MUST FIX BEFORE CONTINUING

1. Rotate the exposed Provider credential; update only the authorized secret store/runtime env, never commit it.
2. Adopt project membership authorization in every formal Review/Fact/Mapping/Project Fact/Claim/Document mutation entrypoint and owning service; add real HTTP negative controls and update the authorization matrix.
3. Make canonical Fact multi-candidate creation/edit and Mapping replacement atomic; add rollback/partial-write negative controls.

## P1 — FIX BEFORE LARGE LIVE ACCEPTANCE

1. Implement/approve one production Support ambiguity handoff (semantic port or persisted human-reviewable proposal) without giving the model authority.
2. Complete the Mapping producer only after its auth/transaction boundary is fixed; retain human approval and currentness checks.
3. Decide `domain_metadata` ownership and Fact worker qualification; rerun a bounded Fact retry-effectiveness evaluation.
4. Expose a complete safe runtime fingerprint and make eval reports read actual Gateway identity.
5. Add eval-only raw failure evidence retention with strict redaction/access/retention controls.
6. Fence or retire legacy Fact/Mapping mutation APIs from normal UI/integration use; keep historical reads as ADR-017 permits.
7. Reconcile `CURRENT_STAGE.md`, ADR-021 runtime identity, and the missing model-strategy decision record before release certification.

## P2 — BETA / MAINTENANCE DEBT

1. Replace governance Markdown wording assertions with behavior/routing assertions.
2. Separate technical `ASSESSMENT_UNAVAILABLE` diagnostics from business unavailable status in reporting.
3. Review legacy document-generation composition and non-atomic job/audit status updates before Writer release, without reopening frozen Claim/Writer contracts.

# FREEZE CANDIDATES

1. Fact source-relative input, source hash/provenance grounding, flat subject projection, and machine-draft lifecycle — freeze the boundary after P0 transactional/auth fixes; do not freeze the worker/model yet.
2. RAG public/industry/enterprise scope isolation and Evidence source-eligibility anti-laundering boundary.
3. Claim Gate → Writer Safe Context authorization invariants and negative controls.

# DO NOT REOPEN

- Requirement Extraction V3.1.1 Canonical contract/source-range boundary without new benchmark evidence.
- Source text/hash boundary and stable provenance rules.
- Evidence Support shared contract parity and Backend final business-invariant authority.
- ADR-019 `semantic_relationship` ownership.
- ADR-018 flat Fact subject representation and deterministic Backend assembly.
- ADR-021 Requirement-independent, source-relative Fact semantic input.
- Canonical Fact vs model transport separation; Candidate has no authority/persistence.
- Claim Gate and Writer Safe Context rule that approved Mapping is not automatic Claim permission.
- Predicate compatibility guard remains deferred; no repository evidence establishes a winning replacement Fact model.

# MAPPING GATE

`MAPPING_BLOCKED`

Exact reasons: production evaluator returns `null`; propose/decide lack project membership authorization; replacement invalidation/upsert is non-atomic; the parallel legacy mutation surface remains exposed. Contract review can continue offline, but a production Mapping live run or freeze cannot.

# LARGE LIVE GATE

`LARGE_EVIDENCE_CHAIN_LIVE_NOT_READY`

Exact blockers: P0 authorization/atomicity/credential incident; Support ambiguous production composition has no persisted handoff; Mapping producer is non-operational; Fact worker/domain-metadata/retry effectiveness are unfrozen; runtime/eval identity is not release-grade; current dirty worktree is not reproducible.

# RECOMMENDED DEVELOPMENT ORDER

1. Rotate the exposed Provider credential and verify no secret is tracked or logged.
2. Close project-authorization adoption at all formal mutation entrypoints with executable negative controls.
3. Add transactions and rollback tests for canonical Fact creation/edit and Mapping replacement.
4. Fence legacy Fact/Mapping mutation APIs while preserving ADR-017 historical reads.
5. Fix safe runtime fingerprint + eval attribution + failure evidence retention; reconcile stage/ADR identity.
6. Close Support ambiguous-case production handoff and run affected Support cases only.
7. Decide Fact generic transport ownership/model qualification; run bounded targeted Fact acceptance and freeze the producer boundary.
8. Implement and review the canonical Mapping producer, then run Mapping → Readiness → Claim → Writer targeted live before any large chain benchmark.

# SAFETY REPORT

- source changes: 0
- eval checkpoint artifacts created: 1
- Prompt changes: 0
- Schema changes: 0
- ADR changes: 0
- DB writes: 0
- Provider calls: 0
- Dify calls: 0
- Gateway restart: NO
- Backend restart: NO
- commit/push/deploy/reset/clean: NO
- dirty worktree preserved: YES
- benchmark preserved: YES

# FINAL STATUS

`V43_OVERNIGHT_GLOBAL_ENGINEERING_QUALITY_AUDIT_COMPLETE`
