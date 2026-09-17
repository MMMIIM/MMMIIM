# ADR 008：Curated Corpus Scope and Governance

状态：Accepted

本 ADR 的 V43 冻结 Decision：`V43_REQUIREMENT_RAG_ARCHITECTURE_ADR_FREEZE`。
Retrieval Architecture = **FROZEN**；Corpus Readiness / Coverage Expansion =
**ACTIVE DEVELOPMENT**。

## Context

企业资料库需要同时承载通用法规/政策、行业资料和企业私有材料。检索基础设施
应保持统一，但来源权威性、使用范围、当前性和企业能力证明边界不能混在一起。
仅有资料数量或检索相关性，不能证明知识库已经可用于投标。

## Decision

- 资料库固定提供三个业务范围：`GENERAL`、`INDUSTRY`、`ENTERPRISE_PRIVATE`。
- 首批行业范围为 `GOVERNMENT_ENTERPRISE` 和 `HEALTHCARE`。
- 三个范围共用一套 Material、Parsed Document、Chunk、Search Index 和 Retrieval
  基础设施，不创建三套独立 RAG 系统。
- 公共语料使用受控激活生命周期：
  `DISCOVERED → SCREENED → APPROVED_FOR_PROCESSING → PROCESSED → EVAL_PASSED → ACTIVE`。
- 只有 `ACTIVE` 内容进入正式 Production Retrieval；`REFERENCE_ONLY`、`REJECTED`、
  `SUPERSEDED`、`EXPIRED` 不参与正常检索。
- Corpus Readiness L3 是知识库达到可用于投标的成熟度目标，按业务覆盖、检索质量、
  来源可追溯性、范围安全、当前性、无答案行为和审核/使用状态完整性评估。
- 官方权威资料优先用于法规和行业知识；企业私有材料仍是企业能力证据的主要来源。
- 开源内容只能作为补充技术参考，不能自动成为权威合规知识。
- 相关性、候选证据、已审核事实和安全 Claim 继续分层管理，通用/行业资料不得静默
  升级为企业能力或 Approved Claim。

## V43 RAG authority and source boundary

RAG 的职责是返回相关、范围有效且可追溯的 Source/Context Candidate。RAG
不是 Fact、Mapping、Sufficiency、Claim 或 Writer Assertion Authority；
`Retrieval Candidate != Evidence Fact`。Raw Retrieval Candidate 不得直接
进入 Fact、Mapping、Claim 或 Writer Assertion。企业私有材料仍必须经过
`Retrieval → Review → Canonical Fact → Mapping → Claim Gate`，
`ENTERPRISE_PRIVATE` 不会自动获得 Claim permission。

官方/行业资料可用于 Requirement understanding、行业检索、参考上下文和
coverage analysis，但不得直接产生“我司具备某能力”的 Canonical Enterprise
Fact。Synthetic company evidence 仅用于受控评测并保持 `claim_permission=false`。
Source-first 路径固定为：

```text
Source → Import → Chunk → Retrieval → Review → Fact
```

Requirement 不得生成 supporting enterprise evidence；`NO_EVIDENCE` 与
`INSUFFICIENT` 是正常业务结果。

RAG Candidate 只能进入 Evidence Review 或 semantic support observation，
不能越过 Review 直接成为 Fact。公开政策、行业白皮书和技术参考可以作为
Writer 的 Reference Context，但不具备 Enterprise Assertion Authority。

## Shared infrastructure and actual scope values

GENERAL、INDUSTRY（当前 `GOVERNMENT_ENTERPRISE`、`HEALTHCARE`）和
`ENTERPRISE_PRIVATE` 使用同一 Material → Parsed Document → Chunk → Search
Index → Retrieval 基础设施。Scope 是 governance/routing 维度，不是三套
RAG service。当前正式 corpus contract 的 lifecycle 为：

```text
DISCOVERED → SCREENED → APPROVED_FOR_PROCESSING → PROCESSED → EVAL_PASSED → ACTIVE
```

仅合法 `ACTIVE` 内容进入公共 Production Retrieval；
`REFERENCE_ONLY`、`REJECTED`、`SUPERSEDED`、`EXPIRED` 不参与正常检索。
当前代码与 corpus manifest 还保留项目私有材料的同一底层路径和公共 corpus
project 的 scope/filter 隔离；不新增表、namespace service 或独立向量库。

## RAG evaluation and readiness boundary

Corpus Readiness L3 是目标，不等同于当前已认证 PASS。RAG/Evidence chain
评测分层为：

```text
Corpus Import Integrity → Retrieval → Source/Evidence Resolution → Fact
→ Mapping → Sufficiency → Claim Safety
```

至少分别报告 Evidence Coverage、Retrieval Recall、Fact Yield、Fact
Semantic Accuracy、Mapping Semantic Accuracy、No-Evidence Precision、
Sufficiency Accuracy 和 Claim Safety；不得用单一 `RAG Accuracy` 替代这些
层。`SOURCE_ABSENT` 必须与 `RETRIEVAL_MISS` 区分。低层 Gate 失败时不得把
结果归因于模型质量或浪费 Provider 调用。Eval 复用生产 resolver/builder，
保留 stable provenance、dataset/evaluator/runtime identity、first-failure
boundary 与 immutable historical artifacts。

当前 L3 目标仍是目标值而非本 ADR 自动认证结果：Business Question Coverage
≥95%、Recall@5 ≥95%、MRR ≥0.85、Source Traceability 100%、Scope Violation 0%、
Obsolete/Superseded Preferred 0%、No-answer Accuracy ≥95%、ACTIVE Review
Coverage 100%、Usage Status Coverage 100%、Formal Safety Violations 0%。
Corpus 扩展按业务覆盖和质量缺口停止；不得按文件数量机械扩库，也不得无限
扩大 Top-K 制造 Coverage。当前开发优先顺序为 corpus quality、coverage、
retrieval evaluation、lineage、no-answer behavior，再到下游正向验证。

## V43 rejected alternatives and temporal boundary

拒绝三套行业 RAG、Retrieval Candidate 直接升级 Fact、官方政策直接升级
企业能力、Requirement-derived synthetic evidence、在 corpus/source 诊断
之前优化 ranking/embedding、过早新增 Temporal Service，以及一个总体 RAG
分数。`publish_date`、`effective_date`、`expiry_date`、`last_verified_at` 和
`source_url` 可保留为描述性 metadata；在单独 ADR 前不增加 Temporal Authority、
scheduled refresh、automatic invalidation 或新 DB 状态机。

Requirement 与本 RAG ADR 互相引用；Requirement、RAG、Fact、Mapping、Claim
和 Writer 的职责边界见 [ADR-023](023-requirement-extraction-and-canonical-authority.md)。

## Consequences

- 资料库 UI 可以用通用资料、行业资料、企业资料表达范围，而不暴露检索实现细节。
- 公共语料入库必须保留来源、版本、使用状态和评测血缘；权利不清时只能使用摘录或
  参考记录，不能冒充可再分发全文。
- Retrieval Engine 与 Corpus Readiness 独立验收；引入新资料优先解决已证实的业务覆盖缺口，
  不因语料不足而直接重构检索架构。
- 企业材料、Evidence、Fact、Mapping 和 Claim 的正式审批边界保持不变。
