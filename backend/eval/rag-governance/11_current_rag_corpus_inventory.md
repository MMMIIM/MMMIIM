# V43 RAG Corpus Inventory v1

This is a read-only deterministic inventory. It does not call a Provider and does not create or modify business state. Missing database fields are represented as `NOT_AVAILABLE`.

## Totals

- materials: 56
- chunks: 561
- embeddings: 625
- evidence facts: 6
- evidence source facts: 0
- legacy mappings: 6
- fact mappings: 0
- retrieval runs: 17
- retrieval results: 129

## Scope distribution

| scope | materials | chunks | embeddings |
| --- | ---: | ---: | ---: |
| ENTERPRISE_PRIVATE | 22 | 243 | 243 |
| GENERAL | 16 | 162 | 162 |
| GOVERNMENT_ENTERPRISE | 8 | 64 | 128 |
| HEALTHCARE | 10 | 92 | 92 |

## Material inventory

| material_id | original_name | type | scope | chunks | embeddings | retrieval eligible | facts | mappings |
| --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| 2e553e66-a909-4ed1-b99e-a57c25b51824 | ccgp-neusoft-project.md | project_case | ENTERPRISE_PRIVATE | 27 | 27 | YES | 2 | 2 |
| adde4515-c4bd-4fba-9269-efa94cf6ac2a | COM-01_公司概况与业务范围.md | company_profile | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 7dc70fee-13e0-4b7d-b95f-202665c241d0 | COM-02_产品平台能力说明.md | product_documentation | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| e523330e-a0ff-4928-99ac-8a8206d64dfd | COM-03_技术架构与部署适配报告.md | technical_solution | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 2511c8f9-fff1-489d-b385-2ddc522c548c | COM-04_API与系统集成能力报告.md | technical_solution | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 81990289-5472-4c41-a68e-b16035013a9a | COM-05_数据治理与迁移能力材料.md | technical_solution | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 3ec066d3-679a-4232-ba6d-364038658c81 | COM-06_权限、安全与审计测试报告.md | technical_solution | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 42debef7-084f-471c-8fa5-1f9dcbf4c2f7 | COM-07_性能与容量测试报告.md | technical_solution | ENTERPRISE_PRIVATE | 12 | 12 | YES | 0 | 0 |
| 4ba1c701-7c4f-415b-9186-28b25c4472ce | COM-08_备份恢复与容灾演练记录.md | delivery_capability | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| f32d71e5-37db-496f-9050-dd7b52fd3804 | COM-09_项目实施与质量管理方法.md | delivery_capability | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| bee37331-9769-4856-a907-6ad8a49a80c0 | COM-10_项目团队与人员能力模板.md | personnel | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| b94aca0b-a314-4f71-a54b-e6d31e4ef702 | COM-11_测试、培训、验收与交付能力.md | delivery_capability | ENTERPRISE_PRIVATE | 8 | 8 | YES | 0 | 0 |
| 45d3a548-516a-4349-a50b-e67ccef7930a | COM-12_运维、SLA与应急服务说明.md | delivery_capability | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| a5510db7-bb22-46e3-aa7f-13b77f1206a6 | COM-13_Synthetic政企案例：城市事件协同平台.md | project_case | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| 04738608-0aa8-4e12-b37b-fc5084e0428b | COM-14_Synthetic医疗案例：医院接口与数据平台.md | project_case | ENTERPRISE_PRIVATE | 10 | 10 | YES | 0 | 0 |
| e39ce20c-b73c-4cd2-a965-d8fbad6775e2 | COM-15_Synthetic资质、知识产权与授权索引.md | qualification | ENTERPRISE_PRIVATE | 12 | 12 | YES | 0 | 0 |
| fa4d4d1b-7add-4b2e-bab5-646df34ad084 | COM-16_商务与合同响应边界.md | other | ENTERPRISE_PRIVATE | 8 | 8 | YES | 0 | 0 |
| d888b245-b0af-4a2d-a26e-7134c885247e | fact-acceptance-v3.txt | project_case | ENTERPRISE_PRIVATE | 1 | 1 | YES | 0 | 0 |
| 427e5615-72e0-4d3d-b38a-f44891b993e2 | neusoft-qualifications.md | qualification | ENTERPRISE_PRIVATE | 3 | 3 | YES | 2 | 2 |
| 5a4674b0-aaab-475a-964b-977ae4b1ff65 | neusoft-smart-city.md | company_profile | ENTERPRISE_PRIVATE | 34 | 34 | YES | 0 | 0 |
| c7542760-5ed9-479e-a642-1ebf7999f446 | neusoft-system-integration.md | product_documentation | ENTERPRISE_PRIVATE | 17 | 17 | YES | 2 | 2 |
| 487a83f9-9ca4-4525-a064-a4df03869b13 | synthetic-fact-source.txt | project_case | ENTERPRISE_PRIVATE | 1 | 1 | YES | 0 | 0 |
| da0524ff-46a1-4266-a1f7-29ffcd3545ae | UNI-01_采购需求、评分与验收边界.md | technical_whitepaper | GENERAL | 12 | 12 | YES | 0 | 0 |
| ff5abe48-c358-4bcb-b2c7-e54b8eeffe10 | UNI-02_政务信息化项目建设与治理.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 02001ebe-6272-45ca-b641-d33e3bfcec24 | UNI-03_数据共享、目录与治理.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 2c26c5a4-b816-4611-b89d-2c1db4db297e | UNI-04_网络数据安全与个人信息保护.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 5057a650-b809-4bf5-9b9b-c6fea2c1925c | UNI-05_等级保护与安全设计.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| b2c89530-fc68-4149-9db2-3e8aa4a0ad44 | UNI-06_数据安全能力与生命周期.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 8492c3e4-01b7-4a8f-a0a4-6ef24a223825 | UNI-07_架构、部署与信创适配.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 31d40c70-2f1a-4155-b829-a1e8ccca3cc6 | UNI-08_接口集成与互操作.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| edb39391-dc20-4d53-97ed-e053af081b7b | UNI-09_身份权限、日志审计与可追溯.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 4f7ac6cd-1cba-451d-9fc9-286fceda898b | UNI-10_监控、运维、SLA与应急.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 4f395744-f341-4c1e-8437-cea45ad44a42 | UNI-11_备份、高可用与容灾.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 6d2349a3-6d6e-406d-98b6-ea2bbde81770 | UNI-12_性能、容量与扩展性.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 61eeaf03-dcab-4d32-a3e1-39c561201c5a | UNI-13_实施、团队、质量、风险与变更.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 17f48354-f2be-4b74-a930-0ab7d95face8 | UNI-14_测试、试运行、培训与验收.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| f2ee34ca-8fd8-4c40-b532-9af049d73139 | UNI-15_业绩、资质与可核验证明.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| d8b8c2f7-9a51-4eb3-a91c-61b141a97748 | UNI-16_AI、知识库与智能体通用边界.md | technical_whitepaper | GENERAL | 10 | 10 | YES | 0 | 0 |
| 434265bb-f3e6-4341-9a5d-57546997ae68 | GOV-01_政务信息化项目全生命周期管理.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 08d5580a-d81b-491f-8c9b-d37ca4251840 | GOV-02_政务数据目录、共享与跨部门协同.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 40bb49d9-58f1-4828-b00a-37acbc9ffb96 | GOV-03_政务平台安全、等保与数据保护.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 7821ed9b-ec17-4a63-bd7d-fea5ff670bf7 | GOV-04_政务云、信创与基础环境适配.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 2b056228-38f8-4868-bbed-06ba8b0bad15 | GOV-05_政务服务、门户与多端应用.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 4c324fa0-1d08-447f-bc3d-1f239fe5a064 | GOV-06_政务系统接口迁移、联调与上线.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 549213aa-0c25-4116-983c-9779de476452 | GOV-07_政务运维、重保与应急.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 60da053c-c356-49ca-93ac-c8418bf9d798 | GOV-08_政务采购证明材料组织.md | technical_whitepaper | GOVERNMENT_ENTERPRISE | 8 | 16 | YES | 0 | 0 |
| 6b0456ff-0a60-4214-9811-c225fc78e942 | MED-01_医院信息化总体建设框架.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |
| 014434eb-0d82-423f-aa8b-676d30af0182 | MED-02_电子病历功能与应用水平.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |
| c8a97e64-c235-4522-beee-87a8be697328 | MED-03_医院信息平台与互联互通.md | technical_whitepaper | HEALTHCARE | 8 | 8 | YES | 0 | 0 |
| 9669c4f6-e215-4b08-a5e3-488bf239ce75 | MED-04_医疗数据安全、隐私与病历访问.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |
| f367e088-988d-4db8-85ff-54f2f0685463 | MED-05_医院智慧服务.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |
| 3f2e8318-e8fc-4491-9320-5620bb90d381 | MED-06_医院智慧管理.md | technical_whitepaper | HEALTHCARE | 8 | 8 | YES | 0 | 0 |
| 3cd85f3c-89b7-4b95-8b8d-38ead65cee23 | MED-07_医疗接口、迁移与上线切换.md | technical_whitepaper | HEALTHCARE | 8 | 8 | YES | 0 | 0 |
| 27a41b4e-a6d6-4f64-9374-8b3f5d10f2fa | MED-08_医疗业务连续性、备份与应急.md | technical_whitepaper | HEALTHCARE | 8 | 8 | YES | 0 | 0 |
| 867d6da7-09bd-490b-b349-63acf35f9fed | MED-09_医疗测试、符合性与成熟度.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |
| 5855cce7-1c58-4315-a00e-58ae871af01b | MED-10_医院项目实施、培训与运维.md | technical_whitepaper | HEALTHCARE | 10 | 10 | YES | 0 | 0 |

## Status and authority

- lifecycle/status/currentness are reported from existing columns only; no inferred status is promoted to truth.
- authority and evidence sufficiency remain separate.
- mechanical source flags are advisory only and never create Fact, Mapping, Claim permission, or Gold labels.
- quality flags: {"STRUCTURED_FACT_CANDIDATE":60,"HEADING_ONLY":263,"VERY_LOW_INFORMATION":451,"MARKETING_STYLE_CANDIDATE":7,"AUTHORITATIVE_RECORD_CANDIDATE":34}

## Matrix-driven corpus

- manifest: backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/rag_bundle_manifest.json
- documents: 50
- libraries: {"universal":16,"industry":18,"company_case":16}
- source registry records: 26
- coverage requirement rows: 34
- themes: {"U01":5,"U19":6,"U20":6,"U21":5,"U23":8,"U24":8,"U32":5,"U33":3,"U03":5,"U05":8,"U06":6,"U07":6,"U31":5,"U09":7,"U10":6,"U11":6,"U12":4,"U14":5,"U08":5,"U04":4,"U16":3,"U17":3,"U26":5,"U27":4,"U28":4,"U15":3,"U13":2,"U22":3,"U25":4,"U29":5,"U30":3,"U18":2,"U34":19,"U02":6}

## Baseline comparison

- known baseline: 50 materials / 478 chunks (backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md)
- current delta: 6 materials / 83 chunks
- delta explanation: current DB includes the matrix-driven public + synthetic baseline plus four retained Neusoft materials and two additional test materials.

## Neusoft references

- detected materials: 4
- chunks: 81
- embeddings: 81
- derived facts: 6
- current facts: 6
- derived mappings: 6
- current mappings: 6
- retrieval results: 55
- repository references: 37
- quarantine: NEUSOFT_QUARANTINE_REQUIRES_AUTHORITY_LIFECYCLE_DECISION
- blocker: Existing lifecycle enum has no quarantine state honored by private Retrieval and derived authority queries; applying usage/review/lifecycle updates alone would not fail closed.
