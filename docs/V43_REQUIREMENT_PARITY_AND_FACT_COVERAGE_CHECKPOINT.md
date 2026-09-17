# V43_REQUIREMENT_PARITY_AND_FACT_COVERAGE_CHECKPOINT

只读审计。未创建 Fact、未修改 Fact/Mapping Gold、未调用 Provider、未写数据库。

## Requirement parity

现有 reconstruction artifact：`backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json`。

| tender | 当前 extraction 状态 | candidate 数量 | source 状态 | authority |
| --- | --- | ---: | --- | --- |
| JY-001 | `CANDIDATE_PACKET_READY_FOR_HUMAN_AUTHORITY` | 193 | 193 source span/hash；0 exact excerpt | `B_HUMAN_RECONSTRUCTION_POSSIBLE`，pending |
| TB-003 | `BLOCKED_RAW_SOURCE_ONLY` | 0 | raw source identity 已确认，无 packet/index | `C_REEXTRACTION_REQUIRED` |
| FAST-04 | `BLOCKED_RAW_SOURCE_ONLY` | 0 | raw source identity 已确认，无 packet/index | `C_REEXTRACTION_REQUIRED` |

因此本轮不能将三者标记为完成 extraction 或提升为 Gold。JY 的 193 条只能作为 candidate；TB-003/FAST-04 没有可供审核的 candidate。

## Existing Fact Pool

| Fact Pool | 记录/上下文数量 | origin | synthetic | 当前可用范围 |
| --- | ---: | --- | --- | --- |
| `representative-sme-facts-v1` | 21 frozen facts | `enterprise_representative_sme` | YES | category/boundary/regression Eval；不是 Real Fact Gold |
| `l3-synthetic-enterprise` | 6 controlled cases，17 materials context | `synthetic_enterprise` | YES | boundary/negative/regression Eval；不是 Real Fact Gold |
| `synthetic-boundary-gold-v2` | 29 Mapping cases | `REPRESENTATIVE_SYNTHETIC` | YES | 独立 synthetic Mapping semantic denominator |
| `real-derived-gold-v1` | 12 Mapping cases，14 fact records | human-adjudicated real-derived Eval | NO（REAL_DERIVED_EVAL） | 独立 real-derived Mapping semantic denominator；不是 Real Fact Gold |

Representative SME 的事实类别计数：company 2、product 2、performance 1、compatibility 4、qualification 3、project 4、personnel 3、service 2。当前不存在独立的 contractual、acceptance、security-test 或 formal-SLA Fact pool。

## Requirement-Fact coverage matrix

以下是类别级 pool presence，不是逐条 Requirement 的语义支持结论，也不改变任何 Gold/Production authority。

| requirement type | frozen A count | JY candidate count | 已有 Fact pool 类别 | 覆盖状态 | 事实边界 |
| --- | ---: | ---: | --- | --- | --- |
| technical | 7 | 151 | product、compatibility、performance、qualification | PARTIAL | 有类别记录，但没有逐 Requirement mapping；compatibility/performance 条件有限 |
| implementation | 23 | 9 | product、compatibility、project、personnel、service | PARTIAL | 可作候选支撑池，不能自动形成 approved Fact |
| delivery | 10 | 8 | project、personnel、service | PARTIAL | service facts 无 formal SLA；项目阶段记录不等于交付承诺 |
| performance | 21 | 0 | performance（1） | LIMITED | 仅一条带条件基准，不能覆盖所有 SLA/阈值 |
| security | 15 | 0 | qualification（含 ISO 类资质） | LIMITED | 资质不等于安全检测报告或具体安全效果 |
| data | 4 | 0 | product、compatibility | PARTIAL | 无独立 data-governance Fact 类别 |
| acceptance | 12 | 0 | project（部分含 acceptance_date） | LIMITED | 无独立验收证据池，单一阶段字段不能证明全部验收条件 |
| contractual / constraint | 14 | 19 | 无 dedicated contractual Fact pool | MISSING | 不得从企业事实池反推合同义务 |
| context | 0 | 6 | 不适用 | NOT_APPLICABLE | context 不进入 Fact 覆盖计算 |

## Missing fact categories

1. `contractual` / constraint：无独立合同条款 Fact 来源。
2. `acceptance_verification`：没有独立、可核验的验收记录池；project stage 字段不足以替代。
3. `security_test_or_assessment`：qualification 记录存在，但没有安全检测/评估事实类别。
4. `formal_performance_or_sla`：有 1 条条件化 performance fact、2 条非正式 service facts；不能视为完整 SLA 覆盖。
5. JY-001、TB-003、FAST-04 的 candidate 尚未取得 Human Authority，因此不能进入正式 Fact coverage 或 Gold promotion。

## Final status

```text
REQUIREMENT_PARITY = NOT_COMPLETE
FACT_COVERAGE = CATEGORY_LEVEL_ONLY
REAL_FACT_GOLD_MUTATION = 0
PROVIDER_CALLS = 0
PRODUCTION_DB_WRITES = 0
```
