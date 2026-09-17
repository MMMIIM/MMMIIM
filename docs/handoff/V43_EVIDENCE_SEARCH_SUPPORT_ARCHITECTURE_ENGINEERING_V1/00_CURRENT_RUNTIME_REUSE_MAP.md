# V43 Evidence Search Support — Current Runtime Reuse Map

Authority: current Human/GPT decision, frozen Chengchuan role checkpoint, and inspected runtime/code. This is a Gate 0 inventory, not a production-status claim.

| Boundary | Current owner | Reuse status | Bounded integration rule |
| --- | --- | --- | --- |
| Response decision | `backend/src/pipeline/response-router-service.js` | REUSE | Read-only projection; no Router mutation. |
| Enterprise material/chunk retrieval | `EnterpriseRetrievalService`, `PgRepository.listChunksForRetrieval` | PARTIAL | Reuse embedding identity and chunk lineage only. The current service combines public and private corpus, so it is not called for the Evidence-only path. |
| Source authority/role | `material-source-authority-policy.js` | PARTIAL | Reuse lifecycle/authority policy. Require frozen explicit `EVIDENCE_CANDIDATE` role projection; fail closed when absent. |
| Evidence review/source span | `EvidenceReviewService`, `EvidenceSourceContextResolver` | REUSE | Existing review lifecycle remains the only route to new Fact extraction. |
| Canonical Fact | `EvidenceSourceFactService` | REUSE | Exact approved/current Fact is reused; otherwise only the existing approved-Review Fact path is invoked. |
| Mapping support record | `RequirementEvidenceFactMappingService`, builder/evaluator/contract | REUSE | Existing canonical Mapping record/service only; EvidenceNeedProfile is deterministic applicability input and is not Provider payload. |
| Claim gate | `claim-gate-input-adapter-v1.js`, `ClaimGateService` | REUSE | Candidate spans never enter; Fact/Mapping approval remains required. |
| Safe packet / Writer authorization | `safe-response-packet-builder.js`, writer authorization service | REUSE | Safe packet consumes allow-claim only; Writer remains uninvoked in this decision. |
| Eval embeddings | existing `EmbeddingClient` identity fields | PARTIAL | No isolated Eval DB is configured. Use only the isolated in-memory Eval repository in tests; production DB vector/retrieval tables are never opened or written. |

## Gate 0 result

`PARTIAL_REUSE_NO_ARCHITECTURE_CONTRADICTION`.

The current SQL retrieval projection does not carry an explicit frozen source role and its generic runtime mixes public corpus candidates. The new bounded Eval orchestrator therefore requires an explicit frozen source-role projection and an `ISOLATED_EVAL` repository. It neither replaces nor mutates the production retrieval path.

## Authority note

`docs/handoff/V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_V1/12_E2E_CHECKPOINT.json` is `STALE_BUT_RECENT` for current Mapping status: it records the superseded pre-exact-pair failure, which conflicts with the later exact-pair canary decision and current bounded-cohort evidence. Its historical input identity remains auditable; its blocker status is not used as current authority.
