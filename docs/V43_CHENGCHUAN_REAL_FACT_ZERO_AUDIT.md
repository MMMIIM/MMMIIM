# V43 澄川 Real Fact Zero Audit

**Checkpoint:** `V43_CHENGCHUAN_REAL_FACT_ZERO_AUDIT`  
**范围：** 只读核对 COM-01～COM-16 的数据库状态、Source Role 与 Fact authority。未导入扩展包，未调用 Provider，未写入 Production DB 或 Gold。

## 环境与 Git

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Worktree: `DIRTY_PRE_EXISTING`（本次仅新增本审计的两份文档）
- Docker: `bid-platform-postgres-1`、`bid-platform-backend-1`、`bid-platform-semantic-gateway-1` 均 healthy
- PostgreSQL: 16.15；只执行只读查询
- Backend / Semantic Gateway 容器均 healthy；本次未调用任何会写入业务状态的 API 或 Provider
- 数据库目录仅发现 `bid_platform`、`postgres`、`template0`、`template1`；未发现独立 test/eval/integration database。相关审计表（如 `claim_gate_evaluations`、`enterprise_retrieval_runs`、`enterprise_retrieval_results`）位于 `bid_platform`。

## 1. 澄川材料对齐

数据库中存在完整的 COM-01～COM-16，共 **16** 份材料；均属于同一示范项目 `d22e95d8-3a2e-450d-a5ef-27f83a283aff`（`Synthetic Demo Company RAG Benchmark`）。每份材料的生命周期为 `ACTIVE`、审核为 `approved`、全文使用状态为 `ACTIVE_FULLTEXT`、解析为 `succeeded`、索引为 `INDEXED`；共 160 个 Material Chunk 和 160 个 Chunk Embedding。

| COM | material_id | file_name | material_type | db_exists | lifecycle | source_type | synthetic_flag | authority |
|---|---|---|---|---|---|---|---|---|
| 01 | `adde4515-c4bd-4fba-9269-efa94cf6ac2a` | COM-01_公司概况与业务范围.md | company_profile | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 02 | `7dc70fee-13e0-4b7d-b95f-202665c241d0` | COM-02_产品平台能力说明.md | product_documentation | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 03 | `e523330e-a0ff-4928-99ac-8a8206d64dfd` | COM-03_技术架构与部署适配报告.md | technical_solution | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 04 | `2511c8f9-fff1-489d-b385-2ddc522c548c` | COM-04_API与系统集成能力报告.md | technical_solution | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 05 | `81990289-5472-4c41-a68e-b16035013a9a` | COM-05_数据治理与迁移能力材料.md | technical_solution | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 06 | `3ec066d3-679a-4232-ba6d-364038658c81` | COM-06_权限、安全与审计测试报告.md | technical_solution | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 07 | `42debef7-084f-471c-8fa5-1f9dcbf4c2f7` | COM-07_性能与容量测试报告.md | technical_solution | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 08 | `4ba1c701-7c4f-415b-9186-28b25c4472ce` | COM-08_备份恢复与容灾演练记录.md | delivery_capability | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 09 | `f32d71e5-37db-496f-9050-dd7b52fd3804` | COM-09_项目实施与质量管理方法.md | delivery_capability | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 10 | `bee37331-9769-4856-a907-6ad8a49a80c0` | COM-10_项目团队与人员能力模板.md | personnel | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 11 | `b94aca0b-a314-4f71-a54b-e6d31e4ef702` | COM-11_测试、培训、验收与交付能力.md | delivery_capability | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 12 | `45d3a548-516a-4349-a50b-e67ccef7930a` | COM-12_运维、SLA与应急服务说明.md | delivery_capability | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 13 | `a5510db7-bb22-46e3-aa7f-13b77f1206a6` | COM-13_Synthetic政企案例：城市事件协同平台.md | project_case | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 14 | `04738608-0aa8-4e12-b37b-fc5084e0428b` | COM-14_Synthetic医疗案例：医院接口与数据平台.md | project_case | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 15 | `e39ce20c-b73c-4cd2-a965-d8fbad6775e2` | COM-15_Synthetic资质、知识产权与授权索引.md | qualification | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |
| 16 | `fa4d4d1b-7add-4b2e-bab5-646df34ad084` | COM-16_商务与合同响应边界.md | other | yes | ACTIVE | synthetic_company_evidence | true | SYNTHETIC_DEVELOPMENT_ONLY |

Source-role projection 将 16 份全部分类为 `SYNTHETIC_ENTERPRISE_EVIDENCE`。数据库的 `authority_level` 原值均为 `enterprise_private`，但 source-role/manifest authority 明确为 `SYNTHETIC_DEVELOPMENT_ONLY`；这是 corpus lane，不是 Real Enterprise Evidence authority。`ACTIVE`/`approved` 生命周期状态不会把 synthetic source 转成 Real Fact。

## 2. Fact 行与 Real Fact Zero 根因

- `evidence_source_facts`（canonical）总行数：**0**。
- COM-01～COM-16 来源的 legacy `evidence_facts`：**0**。
- 数据库确有 **6** 条 legacy `evidence_facts`，均 `approved`，但均来自 4 份当前已 quarantine 的 Neusoft 历史材料；当前 authority 查询为 **0**。
- 因此此前 `REAL_FACT_V2_ELIGIBLE_CANDIDATES = 0` 不是“没有任何 Fact 行”，而是历史 Fact 不在当前 authority lane，澄川材料又全部是 synthetic。

适用根因：

1. `ALL_SOURCES_SYNTHETIC`（COM-01～COM-16）。
2. `FACT_EXISTS_BUT_SOURCE_QUARANTINED`（6 条 Neusoft legacy Fact）。
3. `FACT_EXISTS_BUT_NOT_CURRENT`（当前 authority 结果为 0）。

未发现把上述数据解释为 Real Enterprise Fact 的依据；未知来源材料也不自动升级：

| material_id | file | role | 原因 |
|---|---|---|---|
| `487a83f9-9ca4-4525-a064-a4df03869b13` | synthetic-fact-source.txt | UNKNOWN_REVIEW_REQUIRED | source_type、source_provenance 缺失；ACTIVE 但 NOT_INDEXED |
| `d888b245-b0af-4a2d-a26e-7134c885247e` | fact-acceptance-v3.txt | UNKNOWN_REVIEW_REQUIRED | source_type、source_provenance 缺失；ACTIVE 但 NOT_INDEXED |

## 3. Resolver 与 Inventory 结论

`build-source-universes.js` 的 source-role resolver 正常执行：当前 projection 总计 56 份，分布为 `QUARANTINED=4`、`REFERENCE_CONTEXT_ONLY=34`、`SYNTHETIC_ENTERPRISE_EVIDENCE=16`、`UNKNOWN_REVIEW_REQUIRED=2`、`REAL_ENTERPRISE_EVIDENCE_CANDIDATE=0`。本次核对未发现 exporter scope bug；Real lane 为 0 是 authority/source-role 分类结果。

## 4. 扩展包安全状态（未导入）

`D:/AI工作/AI/标书平台/V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION.zip` 仅作 manifest 只读核对，SHA-256 为 `EC192565B151C132F0FF68F163AE498F3AAC2888DC99A86368517972F305EA9B`。manifest 明确：基础 COM 文档 16、扩展 76、导入后 synthetic 文档 92，主题覆盖 34/34，`DOC_ID_COLLISIONS=0`、`FACT_AUTO_MERGE=false`、`REAL_AUTHORITY_PROMOTION=FORBIDDEN`、`CLAIM_PERMISSION=false`、`HUMAN_REVIEW_REQUIRED=true`。本轮 `NEW_CORPUS_IMPORTS=0`；没有把它视为 Real Fact 候选。

## 5. 安全计数与最终结论

```text
PROVIDER_CALLS = 0
PRODUCTION_DB_WRITES = 0
GOLD_MUTATIONS = 0
MAPPING_ACTIONS = 0
CLAIM_ACTIONS = 0
WRITER_ACTIONS = 0
NEW_CORPUS_IMPORTS = 0
```

`SOURCE_ROLE_RESOLVER_STATUS = PASS`  
`INVENTORY_EXPORTER_STATUS = PASS_NO_SCOPE_BUG_FOUND`  
`CHENGCHUAN_REAL_ELIGIBLE_FACTS = 0`  
`REAL_FACT_ZERO_ROOT_CAUSES = ALL_SOURCES_SYNTHETIC + FACT_EXISTS_BUT_SOURCE_QUARANTINED + FACT_EXISTS_BUT_NOT_CURRENT`

**最终：** `AUDIT_PASS_REAL_FACT_ZERO_DUE_TO_SYNTHETIC_CHENGCHUAN_AND_QUARANTINED_HISTORICAL_FACTS`。根据 Decision，本阶段到此停止；未导入新 corpus，未创建 Fact/Mapping/Claim，也未改变任何 Production 或 Gold 状态。
