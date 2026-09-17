---
doc_id: "COM-06"
title: "权限、安全与审计测试报告"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U09"
  - "U10"
  - "U11"
evidence_category: "SECURITY"
source_ids:
  - "OFF-U05"
  - "OFF-U08"
  - "OFF-U10"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-08-01"
valid_until: "2027-01-31"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-11-01"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 权限、安全与审计测试报告

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 测试

2026-08-01对v3.2测试环境执行账号、角色、最小权限、登录审计、关键操作和数据导出审计。

## 边界

不代表通过等保、密评或第三方认证。

## 官方来源 / 依据

- **OFF-U05｜中华人民共和国网络安全法（2025年修正）**｜全国人大常委会｜状态 `CURRENT_CONFIRMED`｜实施 `2026-01-01`｜最后核验 `2026-08-31`｜https://www.cac.gov.cn/2025-12/29/c_1768735112911946.htm
- **OFF-U08｜GB/T 22239-2019 网络安全等级保护基本要求**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2019-12-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=BAFB47E8874764186BDB7865E8344DAF
- **OFF-U10｜GB/T 35273-2020 个人信息安全规范**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2020-10-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=4568F276E0F8346EB0FBA097AA0CE05E

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
