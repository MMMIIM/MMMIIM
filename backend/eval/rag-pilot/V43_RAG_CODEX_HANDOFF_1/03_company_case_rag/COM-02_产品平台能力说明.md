---
doc_id: "COM-02"
title: "产品平台能力说明"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U02"
  - "U18"
evidence_category: "PRODUCT"
source_ids:
  - "OFF-U01"
  - "OFF-U04"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-06-15"
valid_until: "2027-06-14"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "MEDIUM"
last_verified_at: "2026-08-31"
next_review_at: "2026-12-15"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 产品平台能力说明

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 产品

Synthetic产品含组织权限、流程、表单、接口、日志、报表、知识库、RAG和Agent工具管理。

## 版本

测试版本v3.2，发布日期2026-06-15；版本变化后需重新核验能力。

## 官方来源 / 依据

- **OFF-U01｜政府采购需求管理办法**｜财政部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-07-01`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/gkml/caizhengwengao/wg2021/wg202005/202109/t20210917_3753625.htm
- **OFF-U04｜网络数据安全管理条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-01-01`｜最后核验 `2026-08-31`｜https://app.www.gov.cn/govdata/gov/202409/30/520076/article.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
