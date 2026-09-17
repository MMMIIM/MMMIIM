# V43_FULL_CHUNK_EXPORT_AND_CORRECTED_SCOPE_RETEST_CHECKPOINT

## PACKAGE CHUNKS

- expected: 478
- exported: 478
- docs represented: 50
- scope counts: GENERAL 162; GOVERNMENT_ENTERPRISE 64; HEALTHCARE 92; ENTERPRISE_PRIVATE 160

## CHUNK DISTRIBUTION

- total chars: 37967
- min: 5
- mean: 79.43
- P25: 9
- P50: 17
- P75: 53
- P90: 223
- P95: 351
- max: 865

| Bucket | Count | Percentage |
| --- | ---: | ---: |
| <20 | 243 | 50.84% |
| <50 | 357 | 74.69% |
| <100 | 378 | 79.08% |
| 100–299 | 62 | 12.97% |
| 300–599 | 33 | 6.9% |
| 600–899 | 5 | 1.05% |
| >=900 | 0 | 0% |

- markdown heading only: 239
- short single line: 357
- body-length candidates >=100: 100

## 528 -> 478

- frontmatter explains exact delta: YES
- evidence: direct chunkEnterpriseMaterial(raw file) vs frontmatter-stripped body per document; raw=528, body=478, each delta=1=true

## OUTPUT FILES

- all chunks: D:\AI工作\AI\标书平台\标书平台\backend\eval\rag-pilot\results\all_package_chunks.jsonl
- quality summary: D:\AI工作\AI\标书平台\标书平台\backend\eval\rag-pilot\results\chunk_quality_summary.json
- by document: D:\AI工作\AI\标书平台\标书平台\backend\eval\rag-pilot\results\chunk_quality_by_document.csv
- raw retrieval: D:\AI工作\AI\标书平台\标书平台\backend\eval\rag-pilot\results\corrected_scope_retrieval_raw.json
- checkpoint: D:\AI工作\AI\标书平台\标书平台\backend\eval\rag-pilot\results\corrected_scope_retrieval_checkpoint.md

## EMBEDDING RETEST

| Call | Case | Inputs | Missing chunks | HTTP | Latency |
| ---: | --- | ---: | ---: | --- | ---: |
| 1 | GENERAL | 1 | 0 | 200 | 249 |
| 2 | GOVERNMENT | 1 | 0 | 200 | 80 |
| 3 | MEDICAL | 1 | 0 | 200 | 79 |
| 4 | COMPANY | 1 | 0 | 200 | 107 |

- attempts: 4
- cap: 4
- document re-embedding: NO

## CASE GENERAL

- project: 00000000-0000-4000-8000-000000000001
- requested scopes: GENERAL
- returned scopes: GENERAL
- unexpected scope: 0
- expected doc hit: YES
- Relevant@5: 4
- UsefulContext@5: 2
- <50 hits: 2
- heading-only hits: 0
- PASS/FAIL: PASS

Top-K candidates are preserved in corrected_scope_retrieval_raw.json.

## CASE GOVERNMENT

- project: 00000000-0000-4000-8000-000000000001
- requested scopes: GENERAL, GOVERNMENT_ENTERPRISE
- returned scopes: GOVERNMENT_ENTERPRISE, GENERAL
- unexpected scope: 0
- expected doc hit: YES
- Relevant@5: 5
- UsefulContext@5: 0
- <50 hits: 5
- heading-only hits: 3
- PASS/FAIL: PASS

Top-K candidates are preserved in corrected_scope_retrieval_raw.json.

## CASE MEDICAL

- project: 00000000-0000-4000-8000-000000000001
- requested scopes: GENERAL, HEALTHCARE
- returned scopes: HEALTHCARE
- unexpected scope: 0
- expected doc hit: YES
- Relevant@5: 5
- UsefulContext@5: 3
- <50 hits: 2
- heading-only hits: 0
- PASS/FAIL: PASS

Top-K candidates are preserved in corrected_scope_retrieval_raw.json.

## CASE COMPANY

- project: d22e95d8-3a2e-450d-a5ef-27f83a283aff
- requested scopes: GENERAL
- returned scopes: ENTERPRISE_PRIVATE, GENERAL
- unexpected scope: 13
- expected doc hit: YES
- Relevant@5: 5
- UsefulContext@5: 0
- <50 hits: 4
- heading-only hits: 0
- PASS/FAIL: PASS (mixed PRIVATE + public reference context is expected for enterprise evidence)

Top-K candidates are preserved in corrected_scope_retrieval_raw.json.

## TOP-K TABLES

`source_text` is complete in `corrected_scope_retrieval_raw.json`; the tables below show deterministic metadata and a compact excerpt.

| Case | Rank | Doc | Chunk | Scope | Chars | Relevance | Excerpt |
| --- | ---: | --- | --- | --- | ---: | --- | --- |
| GENERAL | 1 | UNI-01 | MCH-46C2386CA239E1D893BEECD206D32C34 | GENERAL | 30 | CLEARLY_RELEVANT | 验收应与采购需求、合同、测试、试运行和交付物形成可追溯关系。 |
| GENERAL | 2 | UNI-13 | MCH-AF9EA12360D013EE0D9183A380A20A65 | GENERAL | 351 | PLAUSIBLY_RELEVANT | OFF-U01 政府采购需求管理办法；状态 CURRENT_NO_REPEAL_FOUND |
| GENERAL | 3 | UNI-07 | MCH-05F049FDDFC9366E3A89627A73BCA161 | GENERAL | 504 | PLAUSIBLY_RELEVANT | OFF-U02 国家政务信息化项目建设管理办法；状态 CURRENT_CONFIRMED |
| GENERAL | 4 | UNI-02 | MCH-1F3F89A2F5481907547AD37E671BC7D7 | GENERAL | 171 | IRRELEVANT | OFF-U02 国家政务信息化项目建设管理办法；状态 CURRENT_CONFIRMED |
| GENERAL | 5 | UNI-02 | MCH-3763FB1D7E2A78C402D08EEE11C4CBB2 | GENERAL | 31 | PLAUSIBLY_RELEVANT | 应覆盖总体方案、范围、架构、计划、风险、验收、运行和绩效材料。 |
| GOVERNMENT | 1 | GOV-02 | MCH-9B1EE59AC49517697E22459FF10EF20E | GOVERNMENT_ENTERPRISE | 17 | CLEARLY_RELEVANT | 政务数据目录、共享与跨部门协同 |
| GOVERNMENT | 2 | UNI-03 | MCH-BD2BEECFAE57C2A4782752DF9DE6EECD | GENERAL | 12 | CLEARLY_RELEVANT | 数据共享、目录与治理 |
| GOVERNMENT | 3 | GOV-06 | MCH-5587D60D1D42A1B961453B0A55B05D5F | GOVERNMENT_ENTERPRISE | 16 | CLEARLY_RELEVANT | 政务系统接口迁移、联调与上线 |
| GOVERNMENT | 4 | GOV-02 | MCH-B7204C620F6A0CF603CEE34E625A583C | GOVERNMENT_ENTERPRISE | 27 | CLEARLY_RELEVANT | 需明确数据目录、共享属性、使用条件、授权、安全和记录。 |
| GOVERNMENT | 5 | UNI-03 | MCH-21587AB044DB961052FBC5EDF7EA8302 | GENERAL | 44 | CLEARLY_RELEVANT | 数据目录需描述数据项、提供单位、格式、更新频率、共享属性、共享方式。 |
| MEDICAL | 1 | MED-03 | MCH-3E7D468B9E1DC1A415C6AEF9AC540CED | HEALTHCARE | 595 | CLEARLY_RELEVANT | OFF-M03 WS/T 447-2014 医院信息平台技术规范 |
| MEDICAL | 2 | MED-09 | MCH-D1B1106E2AC828537BAC702CFD7FF67C | HEALTHCARE | 604 | PLAUSIBLY_RELEVANT | OFF-M04 WS/T 501-2016 电子病历与医院信息平台标准符合性测试规范 |
| MEDICAL | 3 | MED-07 | MCH-E1B90AC5869B6D115FF8D7AB28375071 | HEALTHCARE | 394 | PLAUSIBLY_RELEVANT | OFF-M03 医院信息平台技术规范；接口、迁移与上线 |
| MEDICAL | 4 | MED-01 | MCH-85128F1140026803AD6C33E6571EE7A2 | HEALTHCARE | 30 | PLAUSIBLY_RELEVANT | 统筹临床业务、医院管理、数据平台、基础设施、安全与便民服务。 |
| MEDICAL | 5 | MED-04 | MCH-8736E635D9BDC32F7A144E75372135ED | HEALTHCARE | 23 | CLEARLY_RELEVANT | 电子病历访问遵循分级分类、最小可用和行为审计。 |
| COMPANY | 1 | COM-14 | MCH-9BD85ED0A87D7C6B058D4EE89A4A1303 | ENTERPRISE_PRIVATE | 40 | PLAUSIBLY_RELEVANT | 某虚构三级医院接口与数据平台，包含接口治理、患者主索引、历史迁移。 |
| COMPANY | 2 | COM-01 | MCH-3EDDDF27D0B75EE6F91A2BEAB76012FC | ENTERPRISE_PRIVATE | 37 | PLAUSIBLY_RELEVANT | 测试能力包括业务平台、数据治理、接口集成、RAG/Agent、实施与运维。 |
| COMPANY | 3 | COM-11 | MCH-D06343ED00C2802BEB0CC954418DB047 | ENTERPRISE_PRIVATE | 32 | PLAUSIBLY_RELEVANT | 支持功能、接口、迁移、性能、安全、UAT、培训、交付和验收记录。 |
| COMPANY | 4 | COM-04 | MCH-99497AE6286B2BAC390E35611FEE3A8A | ENTERPRISE_PRIVATE | 18 | CLEARLY_RELEVANT | 不代表已对接任何真实政务或医院系统。 |
| COMPANY | 5 | COM-08 | MCH-1E7333C6035E531EC2A8E86A09A34F4A | ENTERPRISE_PRIVATE | 76 | PLAUSIBLY_RELEVANT | Synthetic Company Evidence；仅用于 RAG / Fact / Mapping 测试。 |

## COMPANY ROUTING

- private candidates: 13
- public reference candidates: 7
- guidance promoted: NO
- reference_only promoted: NO

## SCOPE DECISION

- GENERAL pure scope: PASS
- GOVERNMENT public scope: PASS
- MEDICAL public scope: PASS
- enterprise mixed retrieval behavior: PASS

## AUTHORITY

- contamination: NO
- Fact executed: NO

## DB DELTA

- projects: 14 -> 14 (delta 0)
- company_materials: 56 -> 56 (delta 0)
- material_chunks: 561 -> 561 (delta 0)
- material_chunk_embeddings: 561 -> 561 (delta 0)

## CALLS

- SiliconFlow embedding HTTP: 4
- DeepSeek: 0
- Dify: 0
- Generation: 0

## TESTS

- retrieval/repository/routing: 48/48 PASS
- JSONL/JSON/CSV: PASS
- syntax: PASS
- diff-check: PASS

## FINAL STATUS

RAG_CORRECTED_SCOPE_RETEST_PASS
