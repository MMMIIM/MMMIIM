---
doc_id: "COM-07"
title: "性能与容量测试报告"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U13"
  - "U15"
evidence_category: "PERFORMANCE"
source_ids:
  - "OFF-U01"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-08-10"
valid_until: "2026-11-30"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "VERY_HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-11-01"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 性能与容量测试报告

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 环境

Synthetic TEST：4 vCPU、16GB RAM、版本v3.2。

## 结果

100个虚拟用户标准查询场景P95=1.8秒；导入10000条合成记录耗时42秒。

## 时效

2026-11-30后标记STALE_PENDING_RETEST。

## 官方来源 / 依据

- **OFF-U01｜政府采购需求管理办法**｜财政部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-07-01`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/gkml/caizhengwengao/wg2021/wg202005/202109/t20210917_3753625.htm

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
