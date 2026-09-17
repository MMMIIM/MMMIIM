---
doc_id: "COM-09"
title: "项目实施与质量管理方法"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U19"
  - "U20"
  - "U21"
evidence_category: "DELIVERY"
source_ids:
  - "OFF-U01"
  - "OFF-U02"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-01-01"
valid_until: null
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "LOW"
last_verified_at: "2026-08-31"
next_review_at: "2027-02-28"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 项目实施与质量管理方法

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 方法

启动、调研、设计、开发/配置、集成、测试、培训、试运行和验收。

## 治理

周计划、风险清单、问题单、变更单和里程碑评审。

## 官方来源 / 依据

- **OFF-U01｜政府采购需求管理办法**｜财政部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-07-01`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/gkml/caizhengwengao/wg2021/wg202005/202109/t20210917_3753625.htm
- **OFF-U02｜国家政务信息化项目建设管理办法**｜国务院办公厅｜状态 `CURRENT_CONFIRMED`｜实施 `2020-02-01`｜最后核验 `2026-08-31`｜https://www.beijing.gov.cn/zhengce/zhengcefagui/202001/t20200122_1620360.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
