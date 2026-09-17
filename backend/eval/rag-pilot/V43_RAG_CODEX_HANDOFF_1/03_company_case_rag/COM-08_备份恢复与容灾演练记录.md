---
doc_id: "COM-08"
title: "备份恢复与容灾演练记录"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U08"
  - "U14"
evidence_category: "DR"
source_ids:
  - "OFF-U08"
  - "OFF-U09"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-07-25"
valid_until: "2027-01-24"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-10-25"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 备份恢复与容灾演练记录

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 演练

2026-07-25完成Synthetic数据库备份恢复和应用节点故障切换。

## 边界

未形成真实客户RTO/RPO或可用率承诺。

## 官方来源 / 依据

- **OFF-U08｜GB/T 22239-2019 网络安全等级保护基本要求**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2019-12-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=BAFB47E8874764186BDB7865E8344DAF
- **OFF-U09｜GB/T 25070-2019 网络安全等级保护安全设计技术要求**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2019-12-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=9FB6EE8597B21436D0E99BF44FD42C4D

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
