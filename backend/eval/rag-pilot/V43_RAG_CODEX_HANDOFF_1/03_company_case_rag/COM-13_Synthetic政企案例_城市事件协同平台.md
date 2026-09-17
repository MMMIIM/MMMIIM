---
doc_id: "COM-13"
title: "Synthetic政企案例：城市事件协同平台"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U29"
  - "U34"
evidence_category: "CASE_GOV"
source_ids:
  - "OFF-U02"
  - "OFF-U03"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2025-10-31"
valid_until: null
evidence_temporal_status: "HISTORICAL_PROJECT_EVIDENCE"
freshness_sensitivity: "LOW"
last_verified_at: "2026-08-31"
next_review_at: "2027-02-28"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# Synthetic政企案例：城市事件协同平台

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 案例

某虚构市级事件协同平台，包含受理、派单、处置、督办、统计、地图和部门接口。

## 时效

实施期2025-03至2025-10；历史案例可用于业绩测试，但产品版本能力需重新核验。

## 官方来源 / 依据

- **OFF-U02｜国家政务信息化项目建设管理办法**｜国务院办公厅｜状态 `CURRENT_CONFIRMED`｜实施 `2020-02-01`｜最后核验 `2026-08-31`｜https://www.beijing.gov.cn/zhengce/zhengcefagui/202001/t20200122_1620360.html
- **OFF-U03｜政务数据共享条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-08-01`｜最后核验 `2026-08-31`｜https://www.stats.gov.cn/gk/tjfg/xgfxfg/202506/t20250609_1960124.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
