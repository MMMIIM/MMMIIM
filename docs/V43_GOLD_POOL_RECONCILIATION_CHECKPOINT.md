# V43_GOLD_POOL_RECONCILIATION_CHECKPOINT

只读架构评估准备审计。生成于 2026-09-05T12:13:20Z。未新增 Gold 类型、未修改 Production/数据库、未调用 Provider。

## REQUIREMENT_GOLD_PARITY_MATRIX

| tender_id | current_status | source_packet | gold_status | human_action_required |
| --- | --- | --- | --- | --- |
| FAST-01 | A_AUTHORITATIVE_PACKET_RECOVERED | `backend/eval/requirement-extraction-real-tender-pilot-v1/packets/FAST-01.json` | GPT_GOLD_REVIEWED / frozen，39 条 | NO |
| FAST-WATER-01 | A_AUTHORITATIVE_PACKET_RECOVERED | `backend/eval/requirement-extraction-real-tender-pilot-v1/packets/FAST-WATER-01.json` | GPT_GOLD_REVIEWED / frozen，80 条 | NO |
| TB-006 | A_AUTHORITATIVE_PACKET_RECOVERED | `backend/eval/requirement-extraction-real-tender-pilot-v1/packets/TB-006.json` | GPT_GOLD_REVIEWED / frozen，43 条 | NO |
| JY-001 | B_HUMAN_RECONSTRUCTION_POSSIBLE | `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json` | candidate / pending；不是 Gold | YES，Human Authority review |
| TB-003 | B_HUMAN_RECONSTRUCTION_POSSIBLE | `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json` | candidate / pending；不是 Gold | YES，Human Authority review |
| FAST-04 | B_HUMAN_RECONSTRUCTION_POSSIBLE | `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json` | candidate / pending；不是 Gold | YES，Human Authority review |

权威 Requirement Gold manifest 为 3 tender、162 条 reviewed Gold Requirement。六 tender source foundation 的 packet parity 为 `FAIL_MISSING_AUTHORITATIVE_PACKETS`；B 类 packet 保持 blind、eval-only，不执行 promotion。

## FACT_EVAL_POOL_MATRIX

| fact_pool | count | origin | synthetic_flag | authority_level | allowed_eval_usage | blocked_usage |
| --- | ---: | --- | --- | --- | --- | --- |
| `real-derived-gold-v1` | 14 fact records / 12 cases（6 distinct fact refs） | Human-adjudicated real-derived Mapping Eval | NO（REAL_DERIVED_EVAL） | Eval authority only；未激活 Real Fact Gold | 可进入 Mapping V2 的 real semantic denominator（独立分区） | 不得导入 Production、不得视为 Real Fact Gold |
| `representative-sme-facts-v1` | 21 frozen fact records | `enterprise_representative_sme` | YES（Representative synthetic） | Synthetic fixture | boundary / regression / controlled Eval | 不得进入 Real Gold 或 Real semantic denominator |
| `l3-synthetic-enterprise` | 6 controlled cases（17 materials context） | `synthetic_enterprise` | YES | Synthetic controlled fixture | boundary、negative、regression Eval | 不得进入 Real Gold、不得作为企业事实 authority |
| `synthetic-boundary-gold-v2` | 29 cases | Human-approved synthetic Mapping boundary partition | YES (`REPRESENTATIVE_SYNTHETIC`) | Eval-only semantic boundary authority | 可进入独立 synthetic Mapping semantic denominator | 不得与 real-derived denominator 合并，不得 Production import |

Fact V2 source closure manifest 记录 `eligible_count=0`；因此当前不存在可用于 Real Fact Gold 的事实池。`representative-sme-facts-v1` 的 21 条为按文件类别计数（company 2、product 2、performance 1、compatibility 4、qualification 3、project 4、personnel 3、service 2）。

## MAPPING_GOLD_V2_READINESS

| dataset | cases | scored | human_review | allowed_denominator |
| --- | ---: | ---: | --- | --- |
| `requirement-evidence-mapping-v1/gold-cases.json` | 36 | 未声明 scored 字段（V1 active immutable） | static human-authored | V1 contract regression/eval；不与 V2 分区混并 |
| `requirement-evidence-mapping-v2/real-derived-gold-v1.json` | 12 | 12 | 12/12 `ACCEPTED`，authority `ACCEPT_FOR_GOLD_POOL` | YES，real-derived semantic partition；successor 未激活 |
| `requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json` | 29 | 29 | 29/29 `ACCEPTED` | YES，仅 synthetic semantic partition |
| `requirement-evidence-mapping-v2/engineering-fixtures-v2.json` | 6 | 0 | accepted fixture status | NO，engineering regression only |

Successor manifest：`backend/eval/requirement-evidence-mapping-v2/successor-manifest.json`。该 manifest 明确 old V1 immutable、V2 partitions Eval-only、无 Production import、无 Gold V2 activation。

## FINAL DECISION

```text
REQUIREMENT_GOLD_STATUS = PARTIAL/BLOCKED_FOR_AUTHORITATIVE_PARITY
FACT_EVAL_POOL_STATUS = PRESENT_EVAL_ONLY; REAL_FACT_GOLD_NOT_ESTABLISHED (eligible=0)
MAPPING_GOLD_V2_READINESS = SUCCESSOR_BUILT_NOT_ACTIVATED
```

### BLOCKERS_ONLY

1. JY-001、TB-003、FAST-04 只有 blind reconstruction candidate，尚无 Human-authorized authoritative Requirement packet；六 tender parity 未完成。
2. Real Fact V2 eligible candidates 为 0；现有 real-derived/Representative/L3 资产均不能替代真实企业 Fact Gold。
3. Mapping V2 successor 虽有 real/synthetic 分区，但尚未激活或冻结；engineering fixtures 必须继续排除出 semantic denominator。

本审计未运行测试套件；本轮只读取现有 manifest、packet、dataset 与 checkpoint，并生成本 checkpoint 文件。
