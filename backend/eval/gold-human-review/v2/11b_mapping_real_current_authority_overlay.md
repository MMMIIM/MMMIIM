# Mapping Real Current Authority Overlay

This file is a post-blind-review comparison overlay. It is intentionally separate from the blind packet.

### REAL-MAP-CAND-001
- existing_pool_status: REJECT_UPSTREAM_SCOPE
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 是总体建设目标的复合 context，包含统一标准、一图展现、一脑分析、一键点调等多个整体建设目标；Fact 仅为“全生命周期一站式集成服务能力”。

该 Requirement 过于宏观和复合，不适合作为独立 Evidence Mapping Semantic Gold。问题主要属于 Requirement scope / atomicity，而不是 Mapping decision。
- existing_confidence: HIGH

### REAL-MAP-CAND-002
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: partial_support
- existing_expected_dimensions: {"subject":"match","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求充分利用已有智慧城市综合管理平台和 12345 平台进行整合对接与提档改造。

Fact 明确证明企业具有咨询、实施、迁移、运维等全生命周期集成服务能力，可以支持“一般系统整合/实施能力”这个子命题。

但 Fact 没有证明：

* 对指定江阴平台的实际适配能力；
* 已完成两个指定平台的对接；
* 能完成 Requirement 中完整的提档改造范围。

因此是 `partial_support`，不能升级为 full support。
- existing_confidence: HIGH

### REAL-MAP-CAND-003
- existing_pool_status: REJECT_UPSTREAM_SCOPE
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 为“社会治理事件跨部门、跨层级、跨平台多级联动处置”，属于较宽泛 context 目标。

Fact 只有通用集成服务能力。

该 Case 主要受 Requirement scope / atomicity 影响，不适合作为独立 Mapping Semantic Gold。
- existing_confidence: HIGH

### REAL-MAP-CAND-004
- existing_pool_status: REJECT_UPSTREAM_SCOPE
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 同时包含热线智能化、精细化管理、事件预警、联勤联动、综合态势等多个建设目标，是明显复合 context Requirement。

不应让 Mapping Gold承担上游 Requirement 非原子化产生的语义歧义。
- existing_confidence: HIGH

### REAL-MAP-CAND-005
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"unknown","entity":"not_applicable","validity":"not_applicable"}
- existing_human_rationale: Requirement 明确要求在线用户量 `>=10000`。

Fact 仅证明全生命周期系统集成服务能力，没有任何：

* 在线用户容量；
* 并发；
* 性能；
* 压测；
* 用户规模

证据。

通用系统集成能力不能用于证明 10000 在线用户容量。
- existing_confidence: HIGH

### REAL-MAP-CAND-006
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 要求并发量 100 次/秒，而 Fact 仍是 generic integration capability。

语义上无法支持定量并发能力，但与 CAND-005、009、010、011 属于同族“无性能事实支持定量性能 Requirement”的负例。

保留审计价值，但不需要进入 Real Gold V1 分母。
- existing_confidence: HIGH

### REAL-MAP-CAND-007
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"unknown","entity":"not_applicable","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求：

* 7×24稳定运行；
* 事务成功率99.99%。

Fact 没有稳定性、可用率、SLA 或事务成功率测试事实。

该 Case 用于证明：

```text
generic capability
!=
quantified SLA / reliability evidence
```
- existing_confidence: HIGH

### REAL-MAP-CAND-008
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_insufficient
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求 X86 架构以及国产操作系统、国产数据库兼容改造。

Fact 的咨询、实施、迁移、运维能力与“兼容改造/迁移”存在合理业务关联。

但没有任何：

* X86；
* 国产 OS；
* 国产数据库；
* 兼容性测试

事实。

属于“相关但无法证明”，因此为 `related_insufficient`，不是 partial capability proof。
- existing_confidence: HIGH

### REAL-MAP-CAND-009
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 为数据服务接口响应时间 `<=1秒`，Fact 不包含任何性能数据。

判断明确，但与现有定量性能负例高度重复，不进入第一版 scored Real Gold。
- existing_confidence: HIGH

### REAL-MAP-CAND-010
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 要求系统日均关键事务 `>=10万笔`。

Fact 没有任何容量或交易量证据。

与已有 performance-negative case 重复度过高，保留但不计分。
- existing_confidence: HIGH

### REAL-MAP-CAND-011
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 同时要求：

* 正常100并发用户；
* 响应时间 <1秒。

Fact 不能支持其中任何一个定量性能维度。

与 CAND-005/006/009/010 同族，暂不进入 scored Real Gold。
- existing_confidence: HIGH

### REAL-MAP-CAND-012
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求根据用户实际需求设置严格系统安全等级。

Fact 是 ISO9001:2015 质量管理体系认证。

ISO9001证明的是质量管理体系，不能证明：

* 系统访问控制；
* 权限安全；
* 用户安全等级；
* 信息系统安全能力。

属于典型“资质存在，但证明对象错误”的负例。
- existing_confidence: HIGH

### REAL-MAP-CAND-013
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: ISO9001质量管理体系认证不证明系统安全或灾难恢复能力。

新增的 qualification_reference Fact 仅包含泛化“资质认证”引用，没有任何安全、灾备、容灾、恢复或信息安全实质内容。

因此新增 Fact 不改变语义判断。
- existing_confidence: HIGH

### REAL-MAP-CAND-014
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_insufficient
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求软件开放性以及对不同业务数据、异构数据的兼容。

Fact 为系统集成能力 reference。

系统集成与异构系统/数据兼容存在业务相关性，但 Fact 不证明：

* 软件开放性；
* 异构数据格式兼容；
* 数据转换；
* 对应协议或接口。

因此属于 `related_insufficient`。
- existing_confidence: MEDIUM_HIGH

### REAL-MAP-CAND-015
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_reference
- existing_expected_dimensions: {"subject":"match","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"match","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求通过数据交换共享平台，实现与其他异构系统之间的数据交换与共享。

真实 Facts 表明：

* 采购货物为“数据共享交换平台管理中心软件”；
* 中标供应商为东软集团股份有限公司。

这能够证明企业存在与“数据共享交换平台”高度相关的真实采购/中标经历。

但 award / procurement item 不能自动证明：

* XML结构化设计；
* 具体交换功能；
* 项目已经实施完成；
* 项目已经验收；
* 异构交换功能实际可用。

所以作为 `related_reference`，不能升级为 full/partial capability proof。
- existing_confidence: HIGH

### REAL-MAP-CAND-016
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求兼容 IE9+、360、Chrome 等浏览器。

Fact 只是系统集成能力 reference。

没有任何：

* 浏览器兼容测试；
* 浏览器版本矩阵；
* 产品兼容记录。

系统集成能力不能证明浏览器兼容性。
- existing_confidence: HIGH

### REAL-MAP-CAND-017
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_insufficient
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 明确：

* 项目部署在政务云；
* 供应商具备云服务能力。

Fact 证明企业有一般咨询、实施、迁移、运维能力。

这与部署/迁移存在关联，但没有证明：

* 云服务能力；
* 政务云；
* 云平台部署；
* 云环境适配。

因此 `related_insufficient`。
- existing_confidence: HIGH

### REAL-MAP-CAND-018
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: partial_support
- existing_expected_dimensions: {"subject":"match","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求平台与两个明确指定的外部平台无缝对接。

Fact 证明企业有 system integration capability。

Fact 对：

```text
系统集成 / 对接能力
```

这个 Requirement 子命题提供真实支持。

但是没有证明：

* 已对两个指定平台做过适配；
* 已拥有对应接口；
* 已实际实现无缝对接。

所以为 `partial_support`，不能 full。
- existing_confidence: HIGH

### REAL-MAP-CAND-019
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: 语义结构与 CAND-018 基本同构：

```text
specific named platform integration
vs
generic system integration capability
```

判断可以是 partial support，但第一版 Real Gold 保留 CAND-018 即可。
- existing_confidence: HIGH

### REAL-MAP-CAND-020
- existing_pool_status: REJECT_LOW_INFORMATION
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 同时包含：

* GIS；
* 视频通讯；
* 一键建组；
* 资源调度；
* 实时通信。

Fact 只有 generic lifecycle integration service。

Requirement 复合度高、Fact 信息过弱，即使可以机械判断 insufficient/unrelated，对 Mapping Semantic Gold 的信息增益很低。
- existing_confidence: MEDIUM_HIGH

### REAL-MAP-CAND-021
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: partial_support
- existing_expected_dimensions: {"subject":"match","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 包括：

* 多渠道事件字段提取；
* 标准化；
* 标准化库；
* 联动接口规范；
* 专业系统与平台联动。

Fact 的系统集成能力能够支持：

```text
系统联动 / 接口集成能力
```

这一有意义的子范围。

但不能证明数据标准化、规则匹配和标准化库。

因此属于真实的 `partial_support`。
- existing_confidence: HIGH

### REAL-MAP-CAND-022
- existing_pool_status: REJECT_LOW_INFORMATION
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: Requirement 同时包含监测模型、模拟打分、实时报表、监测视图、质检平台等多项能力。

Fact 仍只是 generic lifecycle integration capability。

Requirement过度复合，Fact又过弱，无法形成高信息量 Mapping Gold。
- existing_confidence: MEDIUM_HIGH

### REAL-MAP-CAND-023
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_reference
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"unknown","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求：

```text
采购方书面通知开工后6个月完成并上线
```

Fact 证明企业曾中标数据共享交换平台软件采购。

Award 可以证明相关项目/采购经历，但不能证明：

* 历史项目在6个月完成；
* 历史项目已上线；
* 当前企业具备固定六个月交付能力；
* 当前项目一定能按期完成。

因此只能作为 `related_reference`。
- existing_confidence: HIGH

### REAL-MAP-CAND-024
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_insufficient
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Requirement 要求：

* 详尽项目管理办法；
* 专门项目管理组；
* 专人负责；
* 按时按质进行。

Fact 证明企业具备咨询、实施、迁移、运维的一站式服务能力。

这能证明一般项目实施服务能力，但没有证明：

* 正式项目管理制度；
* 专门项目组；
* 专职人员；
* 具体项目管理方法；
* 按期按质历史绩效。

因此为 `related_insufficient`。
- existing_confidence: HIGH

### REAL-MAP-SUPP-007
- existing_pool_status: HOLD_REDUNDANT
- existing_scored: false
- existing_expected_decision: null
- existing_expected_dimensions: null
- existing_human_rationale: 同一 REQ-058 下更换为 generic integration capability Fact。该 Fact 支持系统联动/集成子范围，但不证明事件字段标准化、规则匹配、标准库或接口规范。语义为 partial support，但与已有 CAND-021 高度重复。适合作为 fact-substitution / stability regression，而不是新增 Real Semantic Gold 权重。
- existing_confidence: HIGH

### REAL-MAP-SUPP-009
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: unrelated
- existing_expected_dimensions: {"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"unknown","entity":"mismatch","validity":"not_applicable"}
- existing_human_rationale: Requirement 是防火墙硬件规格。Fact 是数据共享交换平台管理中心软件采购记录。产品实体、产品类型以及全部硬件规格均不匹配。真实采购事实不能证明任意其他产品要求。
- existing_confidence: HIGH

### REAL-MAP-SUPP-010
- existing_pool_status: ACCEPT_FOR_GOLD_POOL
- existing_scored: true
- existing_expected_decision: related_insufficient
- existing_expected_dimensions: {"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}
- existing_human_rationale: Fact 能证明一般系统集成/实施服务能力，因此与项目实施存在业务相关性。但完全不能证明项目主要人员不少于6人、项目负责人、专业技术人员不少于5人、辅助人员不少于10人、技术负责人/需求分析师等角色。所以属于 related_insufficient。
- existing_confidence: HIGH
