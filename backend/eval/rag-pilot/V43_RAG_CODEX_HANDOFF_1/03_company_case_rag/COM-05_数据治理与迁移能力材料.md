---
doc_id: "COM-05"
title: "数据治理与迁移能力材料"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U06"
  - "U07"
  - "U08"
evidence_category: "DATA"
source_ids:
  - "OFF-U03"
  - "OFF-U06"
  - "OFF-U11"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-04-01"
valid_until: "2027-03-31"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "MEDIUM"
last_verified_at: "2026-08-31"
next_review_at: "2026-12-31"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 数据治理与迁移能力材料

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 治理

包含字典、标准、目录、质量规则和血缘测试模块。

## 迁移

采用盘点、映射、清洗、预迁移、核验、正式迁移和回滚准备。

## 官方来源 / 依据

- **OFF-U03｜政务数据共享条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-08-01`｜最后核验 `2026-08-31`｜https://www.stats.gov.cn/gk/tjfg/xgfxfg/202506/t20250609_1960124.html
- **OFF-U06｜中华人民共和国数据安全法**｜全国人大常委会｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-09-01`｜最后核验 `2026-08-31`｜https://www.npc.gov.cn/npc/c2/c30834/202106/t20210610_311888.html
- **OFF-U11｜GB/T 37988-2019 数据安全能力成熟度模型**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2020-03-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=3CFD5E5A14C24D303EA1E139E6EB75C8

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
