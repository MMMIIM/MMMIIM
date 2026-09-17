---
doc_id: "COM-04"
title: "API与系统集成能力报告"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U05"
evidence_category: "INTEGRATION"
source_ids:
  - "OFF-U03"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-07-12"
valid_until: "2027-07-11"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "MEDIUM"
last_verified_at: "2026-08-31"
next_review_at: "2027-01-12"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# API与系统集成能力报告

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 接口

支持REST API、Webhook和批量文件交换；2026-07-12完成12个模拟接口联调。

## 边界

不代表已对接任何真实政务或医院系统。

## 官方来源 / 依据

- **OFF-U03｜政务数据共享条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-08-01`｜最后核验 `2026-08-31`｜https://www.stats.gov.cn/gk/tjfg/xgfxfg/202506/t20250609_1960124.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
