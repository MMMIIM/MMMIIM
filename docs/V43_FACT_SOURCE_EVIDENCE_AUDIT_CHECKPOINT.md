# V43 Fact Source Evidence Audit Checkpoint

- Checkpoint: `V43_FACT_SOURCE_EVIDENCE_AUDIT_CHECKPOINT`
- Mode: **READ_ONLY**
- Date: `2026-09-05`
- Scope: matrix RAG database alignment and COM-01～COM-12 source suitability. No Fact extraction or authority promotion was performed.

## PART A — ENVIRONMENT_STATUS

| Check | Result | Fact |
|---|---|---|
| Docker | **PASS** | semantic-gateway, backend and pgvector/PostgreSQL containers are healthy; ports 18082, 3001 and 5432 are published. |
| PostgreSQL health | **PASS** | PostgreSQL 16.15, public schema, not in recovery. |
| Backend connectivity | **PASS** | `GET http://127.0.0.1:3001/api/health` returned HTTP 200 with `ok=true`. |
| Migration status | **SCHEMA_PRESENT** | 51 SQL files exist. `backend/src/migrate.js` replays all files in lexical order and has no migration ledger. Current schema contains retrieval relations and 051 quarantine/synthetic columns. Full migration was not run in this read-only audit. |

## PART B — MATERIAL_ALIGNMENT_TABLE

Source archive: `backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1.zip` (exists; 16 COM entries). Extracted directory also contains 16 COM entries. Bundle manifest: `backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json`.

All rows below are database observations. `authority` reports the existing Material Authority policy result plus the stored authority level; the synthetic flag prevents these rows from being treated as real enterprise Fact authority.

| material_id | file_name | db_exists | lifecycle | source_type | synthetic_flag | authority |
|---|---|---:|---|---|---:|---|
| adde4515-c4bd-4fba-9269-efa94cf6ac2a | COM-01_公司概况与业务范围.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 7dc70fee-13e0-4b7d-b95f-202665c241d0 | COM-02_产品平台能力说明.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| e523330e-a0ff-4928-99ac-8a8206d64dfd | COM-03_技术架构与部署适配报告.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 2511c8f9-fff1-489d-b385-2ddc522c548c | COM-04_API与系统集成能力报告.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 81990289-5472-4c41-a68e-b16035013a9a | COM-05_数据治理与迁移能力材料.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 3ec066d3-679a-4232-ba6d-364038658c81 | COM-06_权限、安全与审计测试报告.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 42debef7-084f-471c-8fa5-1f9dcbf4c2f7 | COM-07_性能与容量测试报告.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 4ba1c701-7c4f-415b-9186-28b25c4472ce | COM-08_备份恢复与容灾演练记录.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| f32d71e5-37db-496f-9050-dd7b52fd3804 | COM-09_项目实施与质量管理方法.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| bee37331-9769-4856-a907-6ad8a49a80c0 | COM-10_项目团队与人员能力模板.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| b94aca0b-a314-4f71-a54b-e6d31e4ef702 | COM-11_测试、培训、验收与交付能力.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 45d3a548-516a-4349-a50b-e67ccef7930a | COM-12_运维、SLA与应急服务说明.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| a5510db7-bb22-46e3-aa7f-13b77f1206a6 | COM-13_Synthetic政企案例：城市事件协同平台.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| 04738608-0aa8-4e12-b37b-fc5084e0428b | COM-14_Synthetic医疗案例：医院接口与数据平台.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| e39ce20c-b73c-4cd2-a965-d8fbad6775e2 | COM-15_Synthetic资质、知识产权与授权索引.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |
| fa4d4d1b-7add-4b2e-bab5-646df34ad084 | COM-16_商务与合同响应边界.md | YES | ACTIVE | synthetic_company_evidence | YES | Material Authority policy eligible (ACTIVE + approved + ACTIVE_FULLTEXT + extraction succeeded + INDEXED); authority_level=enterprise_private; synthetic source is not Real Fact authority |

Additional persisted facts for all 16 rows: `review_status=approved`, `usage_status=ACTIVE_FULLTEXT`, `extraction_status=succeeded`, `index_status=INDEXED`, `file_hash` present, `source_url=NULL`, `source_org` contains OFF-* references, `authority_level=enterprise_private`.

## PART C — FACT EVIDENCE AUDIT (COM-01～COM-12)

“适合作为 Fact 来源” means production enterprise Fact authority. It is **NO** for every row because the source is synthetic and `claim_permission=false`. `evidence_strength` describes only the observed document content and structure; it is not a Fact approval.

| id | title | document type | evidence_strength | fact source suitable | first-500-character context summary |
|---|---|---|---|---|---|
| COM-01 | 公司概况与业务范围 | company_profile | LOW | NO | 文件标记为 Synthetic Company Evidence；描述虚构企业定位为政企与医疗信息化软件服务商，列出业务平台、数据治理、接口集成、RAG/Agent、实施与运维等范围，并附官方来源编号。 |
| COM-02 | 产品平台能力说明 | product_documentation | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；描述测试产品 v3.2 的组织权限、流程、表单、接口、日志、报表、知识库、RAG 与 Agent 工具管理，并记录发布日期及版本变化后需重新核验。 |
| COM-03 | 技术架构与部署适配报告 | technical_solution | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；列出 Web 前端、API、关系数据库、对象存储、缓存和消息队列，记录 Linux x86_64、某国产 Linux 测试环境及 PostgreSQL 兼容数据库安装和核心验证，未列版本不得推断。 |
| COM-04 | API与系统集成能力报告 | technical_solution | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；记录 REST API、Webhook、批量文件交换及 12 个模拟接口联调，并明确不代表已对接真实政务或医院系统。 |
| COM-05 | 数据治理与迁移能力材料 | technical_solution | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；描述字典、标准、目录、质量规则、血缘测试模块，以及盘点、映射、清洗、预迁移、核验、正式迁移和回滚准备流程。 |
| COM-06 | 权限、安全与审计测试报告 | technical_solution | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；记录 2026-08-01 在 v3.2 测试环境执行账号、角色、最小权限、登录审计、关键操作和数据导出审计，并明确不代表等保、密评或第三方认证。 |
| COM-07 | 性能与容量测试报告 | technical_solution | HIGH | NO | 文件标记为 Synthetic Company Evidence；记录 4 vCPU、16GB RAM、v3.2 环境，100 个虚拟用户标准查询 P95=1.8 秒、10000 条合成记录导入耗时 42 秒，并标记 2026-11-30 后需复测。 |
| COM-08 | 备份恢复与容灾演练记录 | delivery_capability | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；记录 2026-07-25 完成 Synthetic 数据库备份恢复和应用节点故障切换，并明确未形成真实客户 RTO/RPO 或可用率承诺。 |
| COM-09 | 项目实施与质量管理方法 | delivery_capability | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；列出启动、调研、设计、开发/配置、集成、测试、培训、试运行、验收，以及周计划、风险清单、问题单、变更单和里程碑评审。 |
| COM-10 | 项目团队与人员能力模板 | personnel | LOW | NO | 文件标记为 Synthetic Company Evidence；列出项目经理、产品、架构、开发、测试、实施、数据、安全和运维角色，并要求真实人员证据包含证书有效期、劳动/社保关系和可投入时间。 |
| COM-11 | 测试、培训、验收与交付能力 | delivery_capability | MEDIUM | NO | 文件标记为 Synthetic Company Evidence；概述功能、接口、迁移、性能、安全、UAT、培训、交付和验收记录能力，并保留时效使用规则。 |
| COM-12 | 运维、SLA与应急服务说明 | delivery_capability | LOW | NO | 文件标记为 Synthetic Company Evidence；列出巡检、告警、故障、升级、备份和复盘，并明确无真实客户合同，不提供可对外使用的 7×24、分钟级响应或赔付承诺。 |

重点结论：

- COM-06：结构化测试记录，范围和日期明确，但文件明确不代表等保、密评或第三方认证；MEDIUM。
- COM-07：包含环境、并发量、P95 和导入耗时，且有复测日期；HIGH，但全部为 synthetic 测试数据；不形成生产 Fact。
- COM-08：记录备份恢复/故障切换事件，但明确没有真实客户 RTO/RPO 或可用率承诺；MEDIUM。
- COM-02：有产品能力字段和版本信息，但为 synthetic 测试产品；MEDIUM。
- COM-03：有部署架构和适配验证边界，未列版本不得推断；MEDIUM。

## CHECKPOINT COUNTS

- `FACT_SOURCE_READY_COUNT = 0`
- `HIGH_CONFIDENCE_SOURCE_COUNT = 1`（COM-07，仅内容强度）
- `HUMAN_REVIEW_REQUIRED_COUNT = 12`
- `SOURCE_GAPS`：无非合成、独立、可解析来源的企业 Fact；DB 中 COM 记录无 `source_url`；所有 COM 文档保持 synthetic / human-review-required。

## SAFETY / SIDE EFFECTS

- Provider calls: `0`
- Production DB writes: `0`
- Gold mutations: `0`
- Code / Production / Migration / Prompt changes: `0`
- No Fact, Mapping, Claim or Writer objects were created.

**FINAL STATUS:** `FACT_SOURCE_READY_COUNT=0`; synthetic COM corpus is aligned and auditable, but no production Real Enterprise Fact source is ready.

