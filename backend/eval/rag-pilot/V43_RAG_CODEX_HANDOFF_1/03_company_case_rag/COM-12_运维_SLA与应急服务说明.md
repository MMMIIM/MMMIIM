---
doc_id: "COM-12"
title: "运维、SLA与应急服务说明"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U12"
  - "U26"
  - "U27"
  - "U28"
evidence_category: "SERVICE"
source_ids:
  - "OFF-U05"
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

# 运维、SLA与应急服务说明

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 运维

巡检、告警、故障、升级、备份和复盘。

## 边界

无真实客户合同，因此不提供可对外使用的7×24、分钟级响应或赔付承诺。

## 官方来源 / 依据

- **OFF-U05｜中华人民共和国网络安全法（2025年修正）**｜全国人大常委会｜状态 `CURRENT_CONFIRMED`｜实施 `2026-01-01`｜最后核验 `2026-08-31`｜https://www.cac.gov.cn/2025-12/29/c_1768735112911946.htm

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
