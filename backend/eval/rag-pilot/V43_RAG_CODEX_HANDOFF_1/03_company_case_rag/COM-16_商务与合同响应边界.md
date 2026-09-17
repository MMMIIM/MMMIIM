---
doc_id: "COM-16"
title: "商务与合同响应边界"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U33"
evidence_category: "COMMERCIAL"
source_ids:
  - "OFF-U01"
  - "OFF-U14"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-01-01"
valid_until: "2026-12-31"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-10-31"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 商务与合同响应边界

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 边界

报价、付款、质保、履约期和法律责任必须由正式商务与法务流程确认。

## 官方来源 / 依据

- **OFF-U01｜政府采购需求管理办法**｜财政部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-07-01`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/gkml/caizhengwengao/wg2021/wg202005/202109/t20210917_3753625.htm
- **OFF-U14｜中华人民共和国政府采购法实施条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2015-03-01`｜最后核验 `2026-08-31`｜https://xzfg.moj.gov.cn/law/detail?LawID=417

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
