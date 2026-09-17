# Supplemental Human Adjudication — Mapping Gold V2

- Dataset: `requirement-evidence-mapping-v1-gold-2026-09-02`
- Packet SHA-256: `a3a0c1abb4f98eef4d77fd120f4d4e47639fa1680a1a17139c65077756032bd0`
- Cases: `3`
- `FINAL_GOLD_PROMOTION`: `NOT_YET_AUTHORIZED`

This artifact registers the supplied supplemental Human Authority. It does not
change the blind source packet and does not contain provider or production
Mapping results.

## Records

### REAL-MAP-SUPP-007

- `pool_status`: `HOLD_REDUNDANT`
- `review_status`: `ACCEPTED`
- `scored`: `false`
- `exclusion_reason`: `REDUNDANT`
- `semantic_judgment`: `partial_support`
- `expected_decision`: `null`
- `expected_dimensions`: `null`
- `confidence`: `HIGH`

Human rationale: 同一 REQ-058 下更换为 generic integration capability Fact。该 Fact 支持系统联动/集成子范围，但不证明事件字段标准化、规则匹配、标准库或接口规范。语义为 partial support，但与已有 CAND-021 高度重复。适合作为 fact-substitution / stability regression，而不是新增 Real Semantic Gold 权重。

### REAL-MAP-SUPP-009

- `pool_status`: `ACCEPT_FOR_GOLD_POOL`
- `review_status`: `ACCEPTED`
- `scored`: `true`
- `expected_decision`: `unrelated`
- `expected_dimensions`: `{"subject":"mismatch","scope":"unknown","status":"not_applicable","quantity":"unknown","entity":"mismatch","validity":"not_applicable"}`
- `confidence`: `HIGH`

Human rationale: Requirement 是防火墙硬件规格。Fact 是数据共享交换平台管理中心软件采购记录。产品实体、产品类型以及全部硬件规格均不匹配。真实采购事实不能证明任意其他产品要求。

### REAL-MAP-SUPP-010

- `pool_status`: `ACCEPT_FOR_GOLD_POOL`
- `review_status`: `ACCEPTED`
- `scored`: `true`
- `expected_decision`: `related_insufficient`
- `expected_dimensions`: `{"subject":"unknown","scope":"unknown","status":"not_applicable","quantity":"not_applicable","entity":"unknown","validity":"not_applicable"}`
- `confidence`: `HIGH`

Human rationale: Fact 能证明一般系统集成/实施服务能力，因此与项目实施存在业务相关性。但完全不能证明项目主要人员不少于6人、项目负责人、专业技术人员不少于5人、辅助人员不少于10人、技术负责人/需求分析师等角色。所以属于 related_insufficient。

