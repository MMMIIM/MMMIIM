# V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE

> 项目：AI 标书平台 V4.3  
> 文档性质：Target Architecture / Codex Engineering Baseline  
> 目标：为后续所有 Codex 工程任务提供最小但充分的产品与架构上下文。  
> 说明：本文不是对当前仓库 AS-IS 的完全描述；当前 dirty worktree 仍是工程事实 authority。本文定义的是后续开发必须遵守的 Target Architecture 与不可破坏边界。

---

## 0. Authority Priority

发生冲突时，按以下优先级处理：

```text
1. 最新用户明确 Decision / Checkpoint
2. 最新 GPT 架构 / 语义 adjudication
3. 本 Target Architecture Baseline
4. 当前 dirty worktree runtime evidence
5. 历史 handoff / checkpoint / docs
6. 旧 V4.2 / Dify 逻辑
```

Codex 不得根据旧实现反向覆盖新的 Target Architecture。

---

## 1. Target Product

V4.3 后续产品目标正式定义为：

```text
RISK-ROUTED BID COPILOT
```

不是：

```text
FULLY AUTONOMOUS BID GENERATOR
```

产品目标：

```text
少读
少找
少漏
少问人
少返工
降低关键投标风险
```

生产成功标准不是“所有 LLM 100% 正确”，而是：

```text
Critical Error Escape 极低 / P0 尽可能为 0
+
高风险企业断言可追溯
+
Human Review 集中而非层层重复
+
整体人工时间显著低于传统流程
```

核心产品指标：

```text
END_TO_END_HUMAN_REVIEW_MINUTES_PER_100_PAGE_TENDER
```

---

## 2. Frozen Global Invariants

以下原则继续冻结，不因产品转型而失效：

```text
Requirement != Enterprise Capability

Fact != Writer Assertion Authorization

Mapping Approval != Claim Approval

Claim Allow != Writer Visibility Automatically

Reference Material != Enterprise Assertion Authority

Official Source != Enterprise Evidence Automatically

Project Decision != Global Enterprise Fact

Unknown != Confirmed

partial_support != direct_full

DOWNSTREAM NEVER EXPANDS UPSTREAM AUTHORITY

LLM OUTPUT != SYSTEM AUTHORITY
```

新增产品级原则：

```text
STRICTNESS FOLLOWS RISK,
NOT PIPELINE DEPTH.
```

以及：

```text
所有高风险企业断言必须有可追溯 Authority；
非企业断言型方案内容不应被强迫经过企业证据链。
```

---

## 3. Target Runtime Shape

旧的隐含假设：

```text
Requirement
→ Fact
→ Mapping
→ Sufficiency
→ Claim
→ Writer
```

对所有 Requirement 强制执行。

新 Target：

```text
Tender
  ↓
Parse / Requirement Radar
  ↓
Canonical Requirement
  ↓
Response Router
  ↓
┌─────────────┬─────────────┬──────────────┬──────────────┐
│ SOLUTION    │ EVIDENCE    │ COMMITMENT   │ COMPLIANCE   │
│ 方案型       │ 证据型       │ 项目承诺型      │ 合规型         │
└─────────────┴─────────────┴──────────────┴──────────────┘
      │              │              │               │
      │              │              │               │
      │          RAG / Fact      Human /        Deterministic
      │          Mapping /       Project        Rules + Human
      │          Claim           Decision
      │          as needed
      └──────────────┴──────────────┴───────────────┘
                          ↓
                 Safe Response Packet
                          ↓
                        Writer
                          ↓
                Deterministic Review
                          ↓
                  Bid Pilot Review
                          ↓
                        Human
```

---

## 4. Response Modes

### 4.1 SOLUTION

用于：

```text
实施方案
技术方案
服务方案
运维方案
应急预案
培训方案
质量管理方案
流程设计
项目组织方法
```

默认不要求企业历史 Fact。

允许 Writer 使用：

```text
本项目拟...
系统将...
方案设计为...
实施阶段将...
```

不得自动写成：

```text
我司已经...
我司已在多个客户验证...
我司现有平台已...
```

---

### 4.2 EVIDENCE

用于需要证明企业已有事实的 Requirement：

```text
资质
认证
业绩
客户案例
产品型号 / 版本
兼容性
性能数字
检测报告
人员资历
既有企业能力
```

这类 Requirement 才按风险调用：

```text
RAG
→ Evidence
→ Fact
→ Mapping
→ Sufficiency
→ Claim
```

现有深证据链继续保留。

---

### 4.3 COMMITMENT

用于：

```text
中标后专项承诺
SLA
服务响应时限
人员投入
专项工期
资源投入
赔付责任
项目级保证
```

优先走：

```text
Human / Project Locked Decision
```

而不是把项目专项承诺错误升级为企业长期 Fact。

---

### 4.4 COMPLIANCE

用于：

```text
废标
资格
无效投标
签章
格式
递交时限
法律禁止
实质性响应条件
重大合同强制条款
```

优先：

```text
Deterministic Rule
+
Source
+
Human when high impact
```

不能依赖第二个 LLM 自动放行 P0。

---

## 5. SCORING Is an Attribute, Not a Fifth Pipeline

评分相关内容应作为横向属性：

```text
is_scoring_related
scoring_priority
score_weight
score_condition
response_depth_hint
```

不新增独立 Scoring Authority Chain。

---

## 6. Risk Tiers

```text
LOW
MEDIUM
HIGH
P0
```

### LOW

方案、方法、流程、组织机制。

### MEDIUM

普通产品能力、一般兼容性、普通经验。

### HIGH

```text
具体数字
客户名称
认证
资质
项目业绩
产品型号 / 版本
SLA
有效期
金额
```

### P0

```text
废标
资格
法律禁止
投标无效
重大合同强制义务
```

高风险不等于“更多 LLM”。

高风险意味着：

```text
更严格的 deterministic authority
+
更清晰的 source lineage
+
必要时 Human Gate
```

---

## 7. Human Review Model

用户级 Review 不应复制 Backend Domain 层级。

禁止产品演化成：

```text
Requirement Review
Fact Review
Mapping Review
Claim Review
Writer Review
```

五套重复审批。

目标只保留两个用户级 Gate：

### Gate A — 投标决策

处理：

```text
废标 / 资格风险
关键评分项
Evidence Gap
企业事实冲突
专项承诺
部分满足
需要 SME 输入的问题
```

确认后形成项目级冻结决策，下游继承。

### Gate B — 最终审标

处理：

```text
漏项
未经授权企业断言
数字漂移
过度承诺
评分项覆盖
跨章节矛盾
模板化 / 空泛表达
```

---

## 8. Project Locked Decision

Project Decision 是：

```text
当前项目范围内的 Human Authority
```

例如：

```text
本项目允许 7×24 服务承诺
本项目只允许描述已验证 8000 并发
本项目采用某个案例
```

必须保证：

```text
Project Decision
!=
Global Enterprise Fact
```

不得自动提升为企业长期事实。

---

## 9. Response Decision

前台不暴露 Mapping / Sufficiency / Claim 的内部术语。

统一投影为：

```text
READY
READY_WITH_EVIDENCE
PLAN_RESPONSE
NEED_CONFIRMATION
NO_EVIDENCE
CONFLICT
DO_NOT_ASSERT
NOT_EVALUATED
```

这是 Read Model / Projection。

不是新的业务 Authority。

---

## 10. Safe Response Packet

Writer 未来应优先消费：

```text
Safe Response Packet
```

而不是自行理解所有内部 Domain Object。

最小内容：

```text
requirement_id
response_mode
risk_tier
must_cover
project_context
reference_context
allowed_enterprise_assertions
allowed_project_commitments
forbidden_assertions
citation_requirements
human_decisions
packet_hash
```

Writer 的职责：

```text
专业表达
```

而不是：

```text
发现 Fact
判断 Mapping
审批 Claim
决定专项承诺
```

---

## 11. Bid Pilot Boundary

Bid Pilot 定位：

```text
APPLICATION / INTERACTION LAYER
```

不是：

```text
DOMAIN AUTHORITY
```

Bid Pilot 可以：

```text
发现问题
解释问题
排序任务
提出建议
形成 action preview
调用既有 Backend Service
```

Bid Pilot 不可以：

```text
直接创建 Canonical Fact
自动批准 Mapping
自动批准 Claim
直接改数据库 Authority
自行批准重大承诺
绕过 Human Gate
```

高影响动作必须：

```text
Agent Proposal
→ Preview
→ Human Confirm
→ Existing Backend Service
→ Verify
```

---

## 12. Existing Domain Services — Reuse First

以下现有能力优先保留和复用：

```text
Requirement Pipeline
Evidence / RAG
EvidenceSourceFactService
Canonical Evidence Fact
MappingService
Sufficiency / Readiness
ClaimGate
Project Fact / Human Control
Writer Authorization
Source Lineage
Validator
Generation Pipeline
```

不得因为 Target Architecture 变化而建立第二套同类 Domain System。

---

## 13. New Capabilities — Minimal Additive Set

后续优先新增：

```text
ResponseRouterService

ResponseDecisionProjection

ComplianceMatrixProjection

SafeResponsePacketBuilder

BidPilotTaskProjection
```

这些能力优先作为：

```text
Projection
Read Model
Orchestration Adapter
```

而不是新的 Authority Owner。

---

## 14. Migration Strategy

采用：

```text
STRANGLER / ADDITIVE MIGRATION
```

不是：

```text
BIG-BANG REWRITE
```

正确方式：

```text
现有 Domain 保持
        +
新增 Projection / Router / Safe Packet
        ↓
逐步改变 Orchestration
```

禁止 Codex 因为新方案：

```text
删除旧表
删除旧 Service
重写全部 Generation Pipeline
清理“看起来没用了”的 Authority 层
```

除非有新的明确 Decision。

---

## 15. Current Development Waves

Target Roadmap：

```text
Wave 1
Response Projection
→ response_role / response_mode / risk_tier

Wave 2
Compliance Matrix
→ 主工作台 / Evidence Gap

Wave 3
Project Locked Decision
→ 集中 Human Gate

Wave 4
Safe Response Packet
→ Writer Adapter

Wave 5
Final Review
→ Bid Pilot Read-only / advisory

Wave 6
Controlled HITL
→ preview / confirm / execute / verify
```

当前不得自动跨 Wave。

---

## 16. Requirement Module Position

Requirement 继续回答：

```text
招标方要求什么？
```

保持：

```text
Backend parse / structure
→ Semantic Window
→ LLM Candidate
→ Source Resolution
→ Canonical Requirement
→ Quality Gate
```

不因 Bid Copilot 转型而降低 Requirement source fidelity。

---

## 17. Fact Module Position

Fact 未来定位：

```text
ON-DEMAND HIGH-RISK EVIDENCE SERVICE
```

而不是：

```text
所有 Requirement 的必经步骤
```

Fact 重点保护：

```text
资质
认证
业绩
客户
性能
型号
版本
有效期
高风险企业能力
```

不要为了低风险 SOLUTION 内容建立无意义 Fact。

---

## 18. Mapping / Claim Position

Mapping / Claim：

```text
保留
但按需
```

主要处理：

```text
EVIDENCE
+
HIGH-RISK ENTERPRISE ASSERTION
```

不得让 `partial_support` 在下游变成 `direct_full`。

---

## 19. Source / Reference Boundary

继续冻结：

```text
SOURCE_GROUNDED
!=
ENTERPRISE_ELIGIBLE
```

例如：

```text
官方标准
→ SOURCE_GROUNDED = YES
→ REFERENCE_CONTEXT_ONLY
→ 不成为企业事实
```

Reference 可以进入 Writer context，

但不能授予：

```text
我司已经...
```

这类企业断言。

---

## 20. Codex Role

Codex 是：

```text
ENGINEERING EXECUTOR
```

负责：

```text
代码实现
runtime
contract
tests
telemetry
DB / file side effects
build
lint
regression
artifact
```

Codex 不负责最终：

```text
产品方向
架构重定义
Prompt 语义决策
Gold
Semantic PASS/FAIL
Mapping 语义裁决
Claim 语义裁决
Writer 质量裁决
```

固定原则：

```text
ENGINEERING BY CODEX
SEMANTIC JUDGMENT BY GPT
HUMAN IS FINAL BUSINESS / GOLD AUTHORITY
```

---

## 21. New Error Protocol

任何新错误 / blocker：

```text
NEW ERROR
→ HANDOFF CHECK
→ HISTORICAL CHECK
→ CURRENT RUNTIME EVIDENCE
→ CODEX ENGINEERING DIAGNOSIS
→ GPT SEMANTIC REVIEW
→ ROOT CAUSE
→ MINIMAL FIX
```

禁止：

```text
看到报错
→ 直接改 Prompt / Schema / Provider / Authority
```

---

## 22. Scope Discipline

默认禁止：

```text
Multi-Agent 重构

自动 Review → Rewrite → Review 无限循环

自动 retry until pass

让 Reviewer LLM 自动提升 Authority

全量 Fact Inventory 作为所有功能前置 Gate

全量 Requirement × Fact 笛卡尔 Mapping

为降低 Review Rate 放松 P0 安全

因为新 Target Architecture 删除现有审计 / lineage
```

---

## 23. Product UI Direction

前台产品中心：

```text
项目驾驶舱
Requirement Radar
Compliance Matrix
Evidence Gap
Project Decisions
Safe Writer
Final Review
Bid Pilot
```

后台 Domain：

```text
Requirement
Fact
Mapping
Claim
Authorization
Audit
```

应尽量隐藏在产品内部。

用户不需要理解：

```text
canonical_fact
direct_full
claim_allowed
writer_authorization
```

而应看到：

```text
已证明
部分证明
证据不足
存在冲突
待确认
禁止确定性表达
```

---

## 24. Production Metrics

后续 Production Gate 至少同时观察：

### Safety

```text
Critical Requirement Escape
Unsupported Enterprise Assertion Escape
Authority Escalation
```

### Efficiency

```text
Human Review Minutes / 100 pages
Evidence Gap Resolution Time
SME Question Count
```

### Product Quality

```text
Requirement Coverage
Evidence Coverage
Scoring Coverage
First Draft Rework Rate
Final Review Time
```

不能只用：

```text
LLM Accuracy
```

代表产品是否成功。

---

## 25. Codex Task Header Requirement

后续 Codex Decision 建议默认包含：

```text
TARGET ARCHITECTURE BASELINE:

V43_TARGET_ARCHITECTURE_BID_COPILOT_BASELINE

This task must conform to this target.

Do not redesign architecture.
Do not expand scope.
Do not remove existing authority boundaries.
```

如果某个具体 Decision 与本文冲突：

```text
最新具体 Decision 优先。
```

---

## 26. Final Architecture Statement

V4.3 最终不追求：

```text
所有 Requirement
都经过更多 LLM
以获得“更严格”
```

而追求：

```text
低风险内容
→ 少走链路

高风险企业断言
→ 严格 Authority

重大项目承诺
→ Human

P0 合规
→ Deterministic + Human

所有 Writer 输出
→ 不得扩大已授权边界
```

最终原则：

# 少调用，不等于少安全。

# 严格程度跟风险走，不跟 Pipeline 层数走。
