# Current Stage

## V43 Evidence RAG Retrieval Quality P1D — Existing Rerank Reachability Diagnostic

Priority: **P1 / Eval and engineering diagnostic only**
Status: **P1D DIAGNOSTIC COMPLETE / GPT REVIEW PENDING**

The production reranker implementation is present as
`4.3-role-need-rerank-v1` and is called by
`EnterpriseRetrievalService.retrieve`, but the actual route does not build or
attach a Backend-owned Production EvidenceNeedProfile. The caller-supplied
`semantic_metadata` is not an approved Eval source, and the frozen P1C
adapter omitted the candidate role fields required by the reranker. Gold
`profile_class` was not used to fill this gap.

R-FALLBACK was replayed from the frozen P1C results for the 20 / 32 / 48 / 64
candidate-depth ladder. R-EXISTING was intentionally blocked before reranker
invocation; no synthetic metadata was introduced. The resulting gate is
`EXISTING_RERANK_NOT_EVALUABLE`.

Checkpoint:
`docs/handoff/V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_V1/V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1.md/.json`.

No Production Retrieval change is authorized. P2 Parent/Child, P3
Profile/Lexical, P4 K0, bounded overfetch promotion, MMR, Hybrid, and
Cross-encoder Reranker remain **HOLD**. Stop for GPT review.

## V43 Evidence RAG Retrieval Quality P1C — Bounded Overfetch Challenger

Priority: **P1 / Eval and engineering challenger only**
Status: **P1C ENGINEERING VALIDATION COMPLETE / GPT REVIEW PENDING**

P1C froze the bounded candidate ladder `20 / 32 / 48 / 64` before replay and
reused the frozen 94-chunk snapshot, query vectors, GPT semantic Gold,
development-validation overlay, matcher, and existing Production Hygiene.
R0 is raw dense Top20 → existing Hygiene → existing fallback → final Top8;
R32/R48/R64 use the same path with only the bounded raw candidate depth
changed. No new Hygiene rule, re-chunking, re-embedding, Provider, Embedding,
LLM, or Production Retrieval change was made.

Across the 10 frozen development-eval cases, Recall@8 and MRR_FINAL@8 did not
improve at any challenger depth. R32/R48/R64 reduced final-pool underfill, and
Top20-external grade≥2 candidates entered the existing Hygiene survivor pool,
but none entered final review Top8. All regression and safety gates passed;
the required missing-atom-to-final-review gate failed.

`DEVELOPMENT_SELECTED_CANDIDATE_K = NONE`;
`R64_DIAGNOSTIC_ONLY = TRUE`;
`OVERFETCH_GAIN_SATURATION_POINT = NONE`;
next recommendation candidate: **`NO_CHANGE_YET`**.

Checkpoint:
`docs/handoff/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_V1/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1.md/.json`.

Stop for GPT review. Do not implement bounded overfetch. P2 Parent/Child, P3
Profile/Lexical, P4 K0, MMR, Hybrid, and Cross-encoder Reranker remain **HOLD**.

## V43 Evidence RAG Retrieval Quality P1B — Production-Shape Hygiene Canary (historical)

Priority: **P1 / Engineering validation only**
Status: **P1B ENGINEERING VALIDATION COMPLETE / GPT PASS; P1C OVERRIDES THE P1A PRODUCTION GATE**

The production Retrieval shape is frozen as raw vector `candidateK=20`,
post-truncation hygiene, no slot replenishment, and final review `K=8`.
P1B replayed R0 (current shape) against R1 (same shape plus the exact frozen
P1A hygiene rule) using the unchanged vectors and the frozen matcher. R1 made
no additional raw-top-20 exclusions because the existing production hygiene
already removed those structural candidates. On the 7-case
`DEVELOPMENT_VALIDATION_SET`, R0/R1 at K=5 were Recall `0.700000`, Candidate
Precision `0.114286`, and nDCG `0.471039`; this reproduces or exceeds the
P1A full-rank projection for the decision gate. The recommended gate is
`P1A_PRODUCTION_SAFE_AS_IS`; this was the Codex mechanical gate only. GPT
review overrode it with `P1A_NEEDS_BOUNDED_OVERFETCH` and authorized P1C as an
Eval challenger; neither result is Production promotion authorization.

The former seven-case holdout is represented only by a governance overlay as
`DEVELOPMENT_VALIDATION_SET`; semantic Gold labels and the Gold file remain
unchanged. The P1A rule remains
`P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC`, hash
`8320c40c28fa5052f6ea9abe3843a2544b6c929a955a252b97ee56b5180a79c2`.
Matcher: `EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE`, hash
`ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2`.
Replay parity passed; Provider, embedding, LLM, production DB, Gold, corpus,
authority, lineage, Fact, Mapping, Claim, and Writer mutations were all zero.

Checkpoint:
`docs/handoff/V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_V1/V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1.md/.json`.

No production Retrieval change is authorized. P2 Parent/Child, P3
Profile/Lexical, P4 K0, MMR, Hybrid, and Cross-encoder Reranker remain **HOLD**.
Stop here for GPT review.

## V43 Evidence RAG Retrieval Quality P1A — Structure Hygiene Challenger (historical)

Priority: **P1 / Eval-only challenger**
Status: **P1A SEMANTIC REVIEW PASS / PRODUCTION PROMOTION NOT AUTHORIZED**

The challenger applied frozen dense ranking followed by generic,
deterministic, Gold-independent hygiene filtering and final candidate
projection. It did not re-chunk, merge or split source chunks, change
parent/child structure, re-embed corpus/query vectors, or change source-span
identity. It excluded 47 heading-only structural chunks and retained 47
original source chunks. The P1A replay result remains the separate full-rank
projection baseline for P1B comparison.

Checkpoint:
`docs/handoff/V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_V1/V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1.md/.json`.

## V43 Evidence RAG Retrieval Quality P0 — Gold / Metrics Freeze (completed baseline)

Priority: **P0**
Status: **P0 HOLDOUT REPLAY COMPLETE / PASS**

GPT decision `V43_RAG_RETRIEVAL_P0_GOLD_METRICS_FREEZE_V1` authorizes an
Eval-only Evidence Retrieval Gold and metrics baseline. The frozen
`GPT_SEMANTIC_GOLD_V1` remains unchanged at SHA256
`7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7`.
The immutable baseline snapshot
`EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D` remains unchanged. The 7 frozen
holdout queries were validated against the existing
`HOLDOUT_QUERY_VECTOR_SUPPLEMENT_V1` (7 provider calls, Qwen3-Embedding-0.6B,
1024 dimensions) and replayed against the unchanged 94-vector snapshot at
K=1/3/5/8/20. No additional Provider call was made during the V2 replay.
The holdout is now `DEVELOPMENT_VALIDATION_SET` and is not a fresh final-release
blind holdout.

Checkpoint:
`docs/handoff/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_AND_K0_V2/V43_RAG_RETRIEVAL_P0_HOLDOUT_REPLAY_CHECKPOINT_V2.md/.json`.

This decision does not modify Production Retrieval, ranking, chunking, topK,
MMR, Source Eligibility, Provider/model configuration, or any
Evidence/Fact/Mapping/Claim/Writer state. P1 Structure, P2 Parent/Child, P3
The mechanical next-intervention recommendation is `P3_PROFILE_LEXICAL`;
P1 Structure, P2 Parent/Child, P3 Profile/Lexical, and P4 K0 remain **NOT
AUTHORIZED** until GPT reviews this checkpoint and authorizes one next
intervention.

## Stage 20-S — Evidence Sufficiency Offline Validation Baseline

Priority: **P0**
Status: **OFFLINE BASELINE V3.1 ACCEPTED — STAGE20 REMAINS PARTIAL / BLOCKED**

本轮只使用冻结的六个代表性合成案例和已保存的证据输入，验证
`EvidenceSupportAssessment` 的业务状态、必需维度、反证识别、冲突识别以及
技术失败隔离。该评测不是 Retrieval Hit@K，不调用 Embedding、LLM 或 Dify，
不写 Evidence、Fact、Mapping、Claim、Readiness 或 Writer 状态。评测包位于
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_EVIDENCE_SUFFICIENCY_OFFLINE_V3.md/.json`；
V3.1 已完成独立 GPT review，`GPT_REVIEW_STATUS=PASS`、`EVAL_COMPLETE=YES`。
这些状态仅适用于 Evidence Sufficiency Offline Baseline V3.1，不代表 Stage20
整体完成。Stage17 Retrieval
合同与指标保持 PASS / FROZEN；Stage20 总体仍为 PARTIAL / BLOCKED，不能据此
宣称 Stage20 完成或自动进入 live calibration。

V3 在保留上述修正的基础上分离自动指标与 GPT-reviewed 指标，纠正 V2R-003
子字段 provenance，重建 source-grounded 主体不匹配与带有各自需求相对语义的
冲突控制。自动必需维度准确率为 25/25、自动未决维度为 6/6；GPT-reviewed
分母只包含明确标记的字段。V3.1 closure packet 进一步固定
NEG-SUBJECT 的 `support_sufficiency=mismatch` 与 `entity_match=unknown`，根因
归类为 `FIXTURE_ONLY`。

Closure packet：
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_EVIDENCE_SUFFICIENCY_OFFLINE_V3_1.md/.json`。

下一步：恢复 PostgreSQL 并通过集成回归，再重新评估 Stage20 剩余生产/E2E
门禁。在新的明确授权前不调用外部模型，不修改 Retrieval、排名、MMR、topK、
Source Eligibility 或 Stage17 冻结规则。

## Stage 21-A — Runtime Connectivity Foundation

Priority: **P0 prerequisite for Stage20 completion**
Status: **PASS / FROZEN — RETURNED TO STAGE20 RE-ENTRY**

本阶段是经 sequencing decision 批准的受控前置阶段，不等同于完整 Stage 21。
目标是建立可重复的开发运行时连通性：Database、semantic_gateway、Embedding
Provider 的启动前检查、分层错误分类和最小安全观测。Stage17 Retrieval Engine
以及 Stage16–19 冻结规则不变；Stage21-A 完成后必须返回 Stage20，继续 Corpus
L3 和 Real Business E2E，不能直接进入 Release Readiness。

验收已完成：用户配置的 reusable SSH key/agent 通过 BatchMode；单一 managed SSH
session 同时承载 18080 LocalForward 和 18081 SOCKS；Gateway `/info`、SOCKS
远端 DNS/TCP/TLS/HTTPS 和 4 次串行真实 Embedding smoke 均通过，模型维度为
1024。monitor 重启验证通过且无重复监听。开发态被动预检和 degraded 启动测试仍保留。

本阶段已冻结；不新增 Provider、模型、fallback、retry 架构，不修改 Retrieval
business contract。Stage20 重新进入现有正式 Retrieval 边界，具体决策见
`docs/decisions/009-runtime-connectivity-foundation.md`。

## Stage 20 — Production Beta Hardening / Real E2E

Priority: **P0/P1**
Status: **PARTIAL — P0 REAL RETRIEVAL REVALIDATION**

本阶段只验证现有产品能力能否作为一条可恢复、可追溯的完整业务流运行：
项目准备 → 招标解析 → 需求基线 → 材料检索与复核 → 生成准备 → 标书生成 →
章节复核/安全修订 → 投标检查 → Word 导出。禁止新增 AI 能力、Provider、Agent
自治或部署基础设施；外部 Provider 在本阶段默认不调用，若已有授权路径不可用则
记录为运营阻断而不改变架构。本轮完成了既有 EmbeddingClient 的受控真实 Retrieval
重验证，没有调用 LLM 或 Dify。三个控制案例已到达 Top5 并完成合格来源片段复核，
但全量 evidence-bearing 指标、下游 E2E 和人工审阅仍未完成，
因此 Stage20 仍为 PARTIAL。

最新范围校正：正式 Stage20 路径使用 `semantic_gateway` Provider Adapter，
不依赖 Dify Workflow/App/End 状态；保留的 v4.2 Dify 路由仅作兼容，不属于当前
平台主流程。`企业资料库`按一个底层资料能力提供“通用资料 / 行业资料 / 企业资料”
三种业务范围，SSH 隧道仅是开发环境访问方式。最近一次只读网关检查已通过；
不得把手工 SSH 隧道当作正式产品运行要求。

## Stage20-S — Evidence Support Assessment Shared Core

Priority: **P0/P1**
Status: **IMPLEMENTATION COMPLETE — OFFLINE / REAL RETRIEVAL BLOCKED**

本子阶段建立 `EvidenceSupportAssessment` 共享语义边界：它只观察
Requirement 与来源之间的支持关系，不创建 Evidence、Fact、Mapping、Claim，
不改变审批、Readiness 或 Writer 状态。Raw Retrieval Candidate 与 approved
Evidence Fact 通过显式 Adapter 输入；来源片段必须可由后端从 source text
验证并带 hash；冲突只记录，不自动裁决。默认 provider-neutral evaluator
返回不可用状态，不能伪装为 capable/direct。

已有 Evidence Review 和 Requirement-Evidence-Fact Mapping 仅通过 additive
兼容投影复用共享语义，旧 `requirement_evidence_mappings` 路径保持不变。
本轮没有数据库迁移、远端发布或模型调用；本地共享 Gateway Contract 的
实现状态见下方 addendum。
详见 `docs/decisions/010-evidence-support-assessment-boundary.md`。

### Stage20-S shared Gateway contract (2026-08-24)

`evidence_support_assessment` 已完成本地 Gateway Contract、task registry、
严格 envelope/schema validator、Raw Retrieval Candidate / approved Evidence
Fact adapters 与 provider-neutral evaluator adapter。契约版本为
`4.3-evidence-support-assessment-v1`；模型只返回 source-bound semantic
observations 和 cross-source conflict observations，最终业务状态继续由后端
`aggregateEvidenceSufficiency()` 确定。严格模式只允许 BOM/外层空白规范化，
不接受 result/text/answer/message/raw_response，不做 JSON 修复。

当前状态：**LOCAL IMPLEMENTED / NOT REMOTELY PUBLISHED — NO LIVE MODEL CALL**。
没有数据库迁移、Evidence/Fact/Mapping/Claim/Writer 生命周期写入或 Retrieval/MMR
变更；Stage20 仍为 `BLOCKED`（等待正式 live evidence sufficiency validation），
Corpus L3 仍为 `IN_PROGRESS`。

### Stage20 canonical direct-provider cutover (2026-08-25)

`DIFY_FORMAL_DEPENDENCY_4_3 = NO`。Evidence Support 的正式运行边界改为：

```text
Backend → Standalone Semantic Gateway → Task Router → Provider Adapter → Model
```

本地已完成 canonical task-specific 配置绑定与 Gateway Task Router：
`evidence_support_assessment` 只读取 `SEMANTIC_GATEWAY_API_BASE`、
`SEMANTIC_GATEWAY_API_KEY` 和 `SEMANTIC_GATEWAY_USER`，不会回退到
`V43_GATEWAY_*` 或 `DIFY_*`。Gateway 使用已有 OpenAI-compatible Provider
Adapter，严格校验 `4.3-evidence-support-assessment-v1`，失败保持技术失败。
旧 Dify 需求提取 Workflow 继续作为兼容路径，但不是 Evidence Support 的运行时。

当前状态：**LOCAL IMPLEMENTED / LIVE SCHEMA PROBE PENDING**。在唯一一次
Provider schema probe 完成并通过前，不执行 Stage20 全量 live validation。

### Stage20 responsibility shrink / field-owner freeze (2026-08-26)

Stage17 retrieval/rerank remains the frozen candidate-ordering boundary. The
additive `evidence-support-responsibility` router now applies deterministic
source and mismatch checks first, calls semantic adjudication only for an
unresolved relationship, and assembles the existing assessment contract
without writing formal lifecycle state. Field ownership and the future narrow
adjudication prompt are documented in
`docs/STAGE20_RESPONSIBILITY_SHRINK.md`; Stage17 semantics and Stage20-S V3.1
oracle are unchanged. No external provider/model call was made.

### Stage20 entry-point adoption (2026-08-26)

The production HTTP Evidence Review proposal route now injects the existing
`EvidenceSupportReviewEvaluator` into `EvidenceReviewService`. Project WRITE
authorization runs before proposal evaluation; deterministic source and
mismatch checks resolve without semantic calls, while ambiguous proposals fail
closed until a separately published `semantic_adjudication_v1` port exists.
The evaluator assembles the existing canonical assessment before the Review
contract is persisted. Real HTTP and PostgreSQL negative-control coverage
asserts unauthorized, deterministic, ambiguous and technical-failure paths;
no external provider, embedding, LLM or Dify call was made.

### P0 Evidence Context / Real Retrieval revalidation (2026-08-24)

Bounded context recovery and enterprise-proof source routing are implemented and
covered by offline tests. The 36 active calibration cases were re-audited:
3 `EVIDENCE_REVIEW_READY`, 32 `INSUFFICIENT_EVIDENCE`, 1
`NO_RELEVANT_EVIDENCE`, 0 `CONFLICTING_EVIDENCE`; Human Gold remains 0 and
Human Review remains paused.

Three distinct real Retrieval cases were executed once through the formal
EnterpriseRetrievalService after restoring the existing managed SOCKS setting in
the ignored local `backend/.env`. All three reached Top5 and qualified source
spans through the existing EmbeddingClient; no LLM/Dify call or retry occurred.
The result is `PASS_RETRIEVAL_SPAN_ONLY`: full evidence-bearing recall is not
available without independent verified-span Gold, and the 12-case targeted live
regression still needs a formally mapped project/span set. Do not change Retrieval
ranking, chunking, topK, model, Provider or retry architecture.

### P0 Evidence-bearing classification and targeted Gold revalidation (2026-08-24)

The former length-only candidate labeling was rejected. The deterministic
`evidence-bearing-classifier-v1` is Requirement-relative: metadata/frontmatter and
title-only chunks are `METADATA_OR_HEADER`, topic matches are not proof, and a
qualified source span is allowed only after `EVIDENCE_BEARING` classification.
Offline reclassification of the prior three cases records the historical false
labels (7/7 metadata and 4/4 topic candidates), while the corrected classifier
records 0 current false-evidence labels; REQ-009 and REQ-012 remain unqualified
because the indexed corpus does not contain the requested verified dimensions.

The previous blanket `GOLD_INVALID` result has been superseded by the read-only
case-level qualification packet
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_GOLD_QUALIFICATION.md`
and `.json`. Retrieval Gold uses an independent `eval_requirement_id` and does
not require a formal production Requirement row. The qualification found 7/12
`GOLD_READY_FOR_RETRIEVAL` cases with persisted exact spans and current index
bindings, and 5/12 `GOLD_PARTIAL` cases whose exact chunk/hash can be resolved
but whose span/manifest binding is transient; three of those five also lack a
current embedding row. No case was collapsed into a generic invalid state.

No live Retrieval was run in this qualification: Embedding/LLM/Dify calls and DB
writes were all zero. Expected Material/Document/Chunk/Span IDs remain evaluator
only and are not passed to query construction, filters, ranking, MMR, classifiers
or context expansion. The 7 ready cases were subsequently executed once under
the safe external-eval policy; the 5 partial cases remain excluded and require
deterministic manifest/span repair before inclusion.
Four independent canonical synthetic Retrieval samples (`E2E-REQ-001..004`)
remain diagnostic samples rather than the 12-case Gold metric.

Stage17 is now **PASS / FROZEN**. P0 remediation, metric rebase, offline GPT
review, controlled live retrieval, Gold/Context integrity, rank semantics, and
full regression/build acceptance are complete. Stage20 remains **PARTIAL /
BLOCKED**. Do not infer Gold from nearest Requirements, modify ranking,
chunking, topK, MMR, or call another external model.

### P0 7-case live Retrieval checkpoint (2026-08-24)

The seven `GOLD_READY_FOR_RETRIEVAL` cases were executed once through the formal
`EnterpriseRetrievalService → EmbeddingClient → managed SOCKS → pgvector → Top5`
path. Only seven query embeddings were sent to the allowlisted SiliconFlow
endpoint; no corpus was uploaded or re-embedded, and no LLM/Dify/Mapping/Evidence
Fact/Claim Gate/Writer path ran. All seven Retrieval runs succeeded technically.

Formal evaluator metrics: Hit@1 **42.86%**, Hit@3 **71.43%**, Hit@5 **85.71%**,
Material Hit@5 **85.71%**, Document Hit@5 **85.71%**, MRR **0.5833**. There was
one Hit@5 miss, classified as metadata pollution; metadata candidates were not
classified as Evidence-Bearing. The complete case-level packet is
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_LIVE_RETRIEVAL_7.md`
and `.json`; `GPT_REVIEW_STATUS=PENDING_REVIEW`, `EVAL_COMPLETE=NO`.

The mandatory full case-level review packet is available at
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET.md` and `.json`.
It contains all 12 cases, expected lineage, raw verified source snapshots where
available, explicit empty TopK for the blocked cases and primary failure layers.
`CASE_LEVEL_RESULTS_COMPLETE=YES`, `RAW_SOURCE_INCLUDED=YES`,
`GPT_REVIEW_STATUS=PENDING_REVIEW`, and `EVAL_COMPLETE=NO`; aggregate metrics
cannot freeze this P0 evaluation before independent review.

### P0 Retrieval Eval Integrity Repair (2026-08-24)

The prior 7-case Hit@5 **85.71%** is rejected as a formal quality result until
Gold integrity is repaired. The offline audit found **0/7 persisted Gold
bindings valid** under the invariant that the expected span must be an exact
substring of the expected raw chunk and share its chunk identity; all **7/7**
are `GOLD_LINEAGE_INVALID`. Deterministic evaluation-only slices rebind all
seven cases to exact persisted chunk text (**7/7 valid**), without database
writes, HUMAN_GOLD mutation, or production lifecycle use. V2R-005 and V2R-006
were title-only-anchor / multi-chunk span mismatches; V2R-007 is
`GOLD_DESIGN_AMBIGUOUS`, with rank-4 `MCH-268A...` retained as an equivalent
supporting candidate requiring review rather than automatic Gold promotion.

All 35 recorded Top5 candidates were re-audited offline. The previous runtime
label marked 13 candidates `EVIDENCE_BEARING`; the corrected
Requirement-relative classifier marks 7, with **6 explicit false positives**
and 0 false negatives against the separate
`GPT_REVIEW_EXPECTED_CLASSIFICATION` review expectation. This includes the
three confirmed cases (V2R-001 rank 2 capability description, V2R-003 rank 3
open-source policy, V2R-005 rank 5 ISO 9001) plus scope-boundary candidates in
V2R-006. Metadata candidates total 14: 2 at rank 1, 10 within rank 3 and 14
within rank 5 (40% of recorded candidates).

Using only the existing recorded Top5 and repaired evaluation-only binding, the
decision-bearing denominator is 5: Hit@1 **60%**, Hit@3 **80%**, Hit@5
**100%**, MRR **0.75**. Useful first evidence ranks are 1 for four cases and 4
for one case (V2R-001). V2R-006 remains a boundary case and V2R-007 remains
excluded pending Gold design review. The complete offline packet is
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_RETRIEVAL_EVAL_INTEGRITY.md`
and `.json`.

Stage17 is now **PASS / FROZEN** after the deterministic Gold repair, offline
review, controlled live retrieval, and full metric/build gate. Stage20 remains
**PARTIAL / BLOCKED** for separate formal evidence-sufficiency acceptance. The
persisted multi-chunk Evidence Spans remain valid records (7/7), and direct
Retrieval Gold bindings use evaluation-only business-bearing derivation without
mutating formal spans. V2R-006 remains Evidence-Bearing with a boundary/partial
scope, not topic-only. No additional Embedding, LLM, Dify, or retry calls were
made by this correction. Do not change ranking, chunking, topK, MMR, Provider,
or retry architecture from this audit.

### P0 Retrieval candidate hygiene (2026-08-24)

Deterministic chunk-role classification and candidate eligibility are now
implemented in the formal `EnterpriseRetrievalService` path. The existing raw
candidate pool (20) is preserved for audit/context recovery; before final TopK,
HEADING, METADATA and FRONT_MATTER candidates are excluded from the formal
Evidence lane unless the Requirement explicitly requests metadata.
BUSINESS_CONTENT and TABLE_ROW remain eligible, with original similarity order
and no ranking boost. Migration `042_retrieval_candidate_hygiene.sql` persists
the role and eligibility audit fields. Context headings remain available to
context recovery.

The six-case Phase-1 baseline and live comparison are retained for audit only.
An offline Phase-2 replay now uses the captured raw candidate pools and raw
vector order, with independent GPT-reviewed decision labels. It separates
Gold Evidence from Gold Context and produces:

- PRE exact Gold Hit@1/3/5: 0.50 / 0.8333 / 1.00; MRR 0.68056;
- POST_V1 exact Gold Hit@1/3/5: 0.50 / 1.00 / 1.00; MRR 0.75;
- POST_V2 exact Gold Hit@1/3/5: 0.50 / 1.00 / 1.00; MRR 0.75;
- POST_V2 Metadata@5: 0; NonSubstantive@5: 0; substantive rate@5: 100%;
- V2R-001 first decision-bearing rank: PRE 4 → POST_V1 2 → POST_V2 2;
- V2R-006 boundary evidence remains eligible; ISO9001 remains topic-only.

The packet is `GPT_REVIEW_PACKET_SUBSTANTIVE_HYGIENE_OFFLINE.md/.json` with
`GPT_REVIEW_STATUS=PENDING_REVIEW` and `EVAL_COMPLETE=NO`. No new Embedding,
LLM or Dify call was made in Phase-2.

### P0 Evidence source eligibility / anti-laundering gate (2026-08-24)

Phase 2B is implemented as a deterministic source-eligibility gate after
structural and substantive hygiene and before formal Evidence TopK. The gate
classifies provenance into original business/technical/project/qualification
facts or authoritative references, and excludes internal process, system/eval/
control-plane artifacts and non-auditable claims. `UNKNOWN` remains excluded;
low-specificity claims are retained in audit metadata and never auto-promoted.
Raw candidates remain available for audit/context recovery, while only source
eligible candidates can enter the formal evidence lane. Excluded rows are
persisted with their raw rank and an audit-only rank; they cannot become formal
Evidence, Fact, Mapping, Claim or Writer input.

The offline POST_V3 packet is
`backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_EVIDENCE_SOURCE_ELIGIBILITY_OFFLINE.md/.json`.
It replays all 120 captured candidate occurrences with independent reviewed
expectations: 56 source-eligible, 64 ineligible, 21 derived artifacts, 22
internal-process artifacts, 21 low-specificity claims, and 0 unknown. POST_V3
has zero metadata, non-substantive, non-evidence-source, derived-artifact,
internal-process, and low-specificity leakage at Top5; decision-bearing Hit@5
remains 100%, and all six confirmed false positives are excluded. ISO9001 is
source-eligible but remains topic-only; V2R-006 remains source-eligible at the
scope boundary. `GPT_REVIEW_STATUS=PENDING_REVIEW`, `EVAL_COMPLETE=NO`; no
Embedding, LLM, Dify, retry, or production lifecycle call was made.

Stage17 P0 remediation, metric rebase, offline GPT review, controlled live
retrieval, Gold/Context integrity, rank semantics, and full regression/build
acceptance are **PASS / FROZEN**. The canonical six-case metrics are
Decision-Bearing Hit@1/3/5 **83.33% / 100% / 100%**, Decision-Bearing MRR
**0.9167**, Exact Gold Hit@1/3/5 **50% / 100% / 100%**, and Exact Gold MRR
**0.75**. The eight-case offline suite remains separately labeled Regression
Retrieval Suite metrics (Recall@5 **90%**, MRR **1.000**). The final metric
packet is `backend/eval/evidence-support/calibration-v2/STAGE17_METRIC_REBASE_AND_FREEZE_PACKET.md`
and `.json`. Stage20 remains **PARTIAL / BLOCKED** pending its separate formal
evidence-sufficiency validation. Do not change ranking, chunking, topK, MMR,
Provider, or retry architecture.

### Standalone Semantic Gateway foundation (2026-08-24)

本地已实现独立无状态 Node Gateway：`services/semantic-gateway`。共享语义
Contract 唯一来源为 `packages/semantic-contracts`，Backend task registry 通过
该路径消费；服务提供 `/health`、`/ready` 与兼容 `POST /workflows/run`，支持
六类正式 Task，另保留 `draft_sections` 兼容入口。当前仅使用注入式 mock
Provider，OpenAI-compatible adapter 只完成本地严格 JSON 路径；不调用真实模型，
不连接业务数据库，不写 Evidence/Fact/Mapping/Review/Readiness/Claim/Writer。

当前 Backend 默认仍指向 Legacy Dify-compatible runtime，未执行 cutover。远端
Dify 不修改、不部署；下一步需单独决定本地 cutover 与真实 Provider 验证。

### Stage20 parallel acceptance tracks

- Track A — Corpus Readiness L3：`IN_PROGRESS`。当前真实公共资料为通用 10、政企 15、医疗 15，
  合成企业基线 17；17 份合成企业资料已通过 `CompanyMaterialService` 实际导入并索引（51 chunks），
  正式生产检索夹具另保留 21 份材料、329 个 chunk。Golden V2 共 139 个领域问题，业务覆盖 96.8%，
  4 个范围边界缺口已记录为 non-critical；冻结检索基线 Recall@5 仍为 90%。
- Track B — Real Provider E2E：`PARTIAL — REAL RETRIEVAL REVALIDATION`。已使用公开的
  江阴市国有企业集中采购 PDF 完成实际上传、解析、4 个网关分片和需求基线确认；
 140 条需求、17 份合成企业材料已通过正式服务落库。本轮通过现有 managed SOCKS
 运行配置完成 1 次 Embedding smoke 和 3 个正式 Retrieval 回归案例；三例均到达
 Top5 和合格来源片段。Evidence、正文生成、章节修订、Copilot 或 Word 尚未进入，
 且未重试。
- Track C — Deterministic / Offline Product Acceptance：`PASS`（已达到范围内）。

Stage20 当前并行推进 Corpus Readiness L3：以业务问题覆盖、来源权威性、有效期、
使用许可、可追溯性和人工审核覆盖衡量语料是否可支撑投标业务，不以文档数量替代
验收。当前 L3 为 `IN_PROGRESS`；Stage17 检索架构保持冻结，详见
`docs/RAG_CORPUS_L3_PLAN.md` 与 `npm run eval:corpus-l3 -w backend`。
已完成真实官方摘录扩展入库：通用资料 10 份、政企平台 15 份、医疗行业 15 份，
共 40 份 ACTIVE_EXCERPT，预计 120 个 chunk，全部经过来源复核、处理、索引和脱敏摘录审计。
真实公共语料离线评测：业务问题覆盖 100%、Recall@5 100%、MRR 1.000、来源可追溯
100%、范围违规 0%、无答案准确率 100%。整体 L3 仍为 `IN_PROGRESS`：官方语料数量
已达到各范围的下限，合成企业基线仍单独保留；更广泛的问题覆盖和冻结的检索基线仍未达标，
未以摘录评测替代完整正文授权。

### Stage20 public E2E evidence (2026-08-22)

- Representative tender: public 江阴市国有企业集中采购 PDF (政企/智慧城市项目)，
  project `91ab7f01-2bfb-4d49-8a81-ddfcb20ee903`。
- Tender parse job `1e5d7007-ad2d-4121-8929-2257d7a95dd6` succeeded in 122,728 ms;
  4/4 chunks, 144 candidates, 140 mandatory, 0 parse warnings, 130 verified / 10 suggested /
  4 unresolved source locations. After explicit review decisions, 140 requirements were frozen
  in the confirmed baseline; no requirement text or ID was changed.
- 17 fictional `杭州景云数科有限公司` materials were imported through
  `CompanyMaterialService` into the project and indexed. The first retrieval call used
  GENERAL + GOVERNMENT_ENTERPRISE + ENTERPRISE_PRIVATE scope with the existing embedding
  configuration, but failed with safe code `EMBEDDING_NETWORK_ERROR` after 67 ms.
- No real Writer/Provider generation, Copilot, Bid Check, or Word export was started after
  the retrieval blocker; no automatic retry was performed. The remaining action is to restore
  the existing Embedding endpoint/network, then rerun the explicitly authorized E2E once.

验收产物：`docs/STAGE20_PRODUCTION_BETA_ACCEPTANCE.md` 与离线合成 E2E 夹具。
Stage 19 及之前的冻结规则继续有效。

## Stage 19 — Bid Copilot Guided Actions / Safe Execution

Priority: **P1**
Status: **PASS / FROZEN**

Stage 18 remains **PASS / FROZEN** below.

Stage 19 extends the contextual assistant with bounded, reversible actions over
existing formal services. Every action is context-bound, risk-classified,
idempotent where needed, validated after execution, and auditable. Formal
business decisions remain human-only. Engineering acceptance is complete;
manual formal decisions remain in the existing workbench.

Stage 16 — Document Delivery & Word V1 is **PASS / FROZEN**.
Manual TOC Acceptance: **PASS**
System Default Page Policy: **PASS**
The system default page policy is frozen: the cover hides its page number,
the TOC starts visible numbering at 1, and the body inherits the TOC sequence
without restarting. The representative DOCX contains a real updateable TOC
field with cached entries and native section numbering.

Stage 13 — Material Processing / Review UX, Stage 14 — Platform Shell & Core
Flow IA, and Stage 15 — Generation Workbench V1 remain frozen with acceptance
**PASS**. Stage 16 Word Foundation and the page-number calibration are frozen
after consolidated OOXML, backend, frontend, PostgreSQL, build, lint and diff
checks passed.

## Stage 17 goal

将企业资料库从材料存储与处理能力推进为可追溯、可评测、受项目范围约束
的检索能力。检索只产生候选证据，不产生正式事实或承诺。

```text
Bid Document Model → Format Policy → DOCX Renderer
```

## Frozen foundation

- valid heading hierarchy / duplicate-heading prevention；
- Word automatic numbering with SPACE suffix；
- natural pagination, heading keepNext/keepLines, body widow/orphan；
- Chinese EastAsia font mapping and centralized paragraph policy；
- table width/padding/repeated headers/cantSplit；
- section/page numbering, metadata allow-list and document structure validation；
- formal version linkage。
- TOC 缓存条目不包含伪造页码；Word/WPS/LibreOffice 仍负责最终页码更新；
- 表格只有 `header_row_index` 指定的行可重复，其他行不写入 `tblHeader`。

上述规则未经具体回归证据不得重新设计。

## Frozen Stage 16 acceptance

- Cover page number hidden;
- TOC visible page number starts at 1;
- Body inherits numbering and does not restart;
- TOC cached entries and updateable field are present;
- heading hierarchy, numbering, pagination, tables and metadata allow-list
  remain covered by the consolidated OOXML acceptance.

## Stage 17 acceptance result

- Stage17 is **PASS / FROZEN**. P0 remediation, controlled live retrieval,
  Gold/Context integrity, rank semantics, canonical metric rebase, and the full
  regression/build gate are complete.
- Canonical six-case metrics remain separate from the eight-case offline
  Regression Retrieval Suite metrics; historical Recall/MMR experiments remain
  labeled historical and are not overwritten.
- enterprise materials can be processed and indexed;
- retrieval preserves material/document/chunk/source lineage;
- project and selected-material scope filtering is enforced;
- no-answer is explicit;
- deterministic retrieval evaluation reports Recall@5 **90%**, MRR **1.000**,
  source traceability **100%**, scope violation **0%**, duplicate retrieval
  **0%**, and no-answer accuracy **100%**;
- retrieval cannot bypass Evidence, Fact, Mapping, Claim Gate or Writer auth;
- backend 659/659, frontend 50/50, PostgreSQL 41/41, build, lint and diff
  checks all pass.

## Stage 19 goal

让用户可以安全执行可逆的准备和检查动作，并对章节修订先预览差异、再由
正式服务应用；Agent 不直接写数据库、不覆盖旧版本、不把检索候选升级为
正式事实或 Claim。

## Stage 19 acceptance target

- safe action tools and centralized L0–L4 execution authorization;
- bounded multi-step execution with exact partial-failure reporting;
- chapter revision preview/diff, validation and stale-preview protection;
- idempotent action execution and post-action authoritative re-read;
- structured human decisions for L4 blockers;
- Agent Eval V2 and prompt-injection action safety tests;
- full backend/frontend/PostgreSQL/retrieval/eval/build/lint regression.

## Stage 19 acceptance result

- Safe L0/L1 refresh, retrieval and bid-check actions execute only through
  formal services; L2 actions prepare/validate without mutation;
- L3 chapter changes require a persisted preview, current-version hash match
  and explicit human approval, then create a new version through the formal
  document service;
- L4 approvals, rejections, overrides and Claim Gate bypasses remain
  `HUMAN_REQUIRED` and are audited without execution;
- action previews expose business-readable Original / Proposed / Diff, with
  stale-preview protection, bounded eight-step plans and idempotent replay;
- migration 040 persists previews and action audits, and project-scoped HTTP
  endpoints expose only safe preview fields;
- Agent Eval V2: 12/12 cases, pass rate 100%, stale prevention 100%,
  idempotency 100%, unauthorized mutation 0, prompt-injection action
  violation 0, partial-failure reporting 100%;
- backend 502 tests, frontend 47 tests, PostgreSQL 40 tests, retrieval eval,
  build, lint and diff checks pass. No external AI calls, push, merge or
  deployment were used.

## Stage 18 goal

让普通投标人员可以在项目上下文中询问“还缺什么、为什么不能生成、哪些材料
可以证明”，并得到基于正式服务的可追溯解释、待办和导航动作。初期仅提供
只读工具、上下文解析、动作风险门禁、执行审计和确定性评测；不新增 AI
提供商、不自动确认 Evidence/Mapping/Claim/Project Fact/Writer。

## Stage 18 acceptance target

- explicit project context resolver and authoritative read tools;
- deterministic L0–L4 action policy with formal decisions requiring humans;
- primary next-step, generation-blocker and requirement-material scenarios;
- candidate material results remain distinct from confirmed proof;
- prompt injection content remains data and cannot alter policy;
- execution trace, ten-case deterministic eval and full regression pass.

## Stage 18 acceptance result

- explicit context, read-only formal tools and safe navigation are available;
- L0–L4 action policy blocks automatic formal decisions and Claim Gate bypass;
- next-step, generation-blocker and requirement-material scenarios are covered;
- retrieval candidates remain distinct from confirmed proof;
- prompt-injection and context-mismatch tests pass;
- execution audit migration 039 and ten-case offline evaluation pass;
- backend 497 tests, frontend 45 tests, PostgreSQL 39 tests, build, lint and
  diff checks pass.

Stage 18 is **PASS / FROZEN**. No external AI calls, new providers, private
data scope, push, merge or deployment were used.

## Stop conditions

不修改已冻结 Word 基线；不修改 Writer、Claim Gate、Evidence/Fact/Mapping、
semantic gateway 或业务 Contract；不调用外部 AI；不新增 Provider/私有数据
范围；不自动批准、不绕过正式门禁；不直接数据库写入；不推送、不合并、
不部署。
