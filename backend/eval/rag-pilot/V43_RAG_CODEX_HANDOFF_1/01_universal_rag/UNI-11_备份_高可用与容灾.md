---
doc_id: "UNI-11"
title: "备份、高可用与容灾"
library_scope: "universal"
domain: "cross_industry"
requirement_themes:
  - "U08"
  - "U14"
  - "U15"
evidence_category: "G09/G10"
source_ids:
  - "OFF-U05"
  - "OFF-U08"
source_kind: "official_guidance_summary"
evidence_status: "official_guidance_summary"
claim_permission: false
human_review_required: true
synthetic_company_evidence: false
valid_from: null
valid_until: null
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-11-30"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 备份、高可用与容灾

> 官方资料结构化摘要。正式投标与合规判断需回到原始法律、标准、政策或项目文件核验。

## 能力

设计能力与实测能力需区分。

## 指标

RTO/RPO/可用率必须带测试环境、架构条件和测试日期。

## 官方来源 / 依据

- **OFF-U05｜中华人民共和国网络安全法（2025年修正）**｜全国人大常委会｜状态 `CURRENT_CONFIRMED`｜实施 `2026-01-01`｜最后核验 `2026-08-31`｜https://www.cac.gov.cn/2025-12/29/c_1768735112911946.htm
- **OFF-U08｜GB/T 22239-2019 网络安全等级保护基本要求**｜国家市场监督管理总局、国家标准化管理委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2019-12-01`｜最后核验 `2026-08-31`｜https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=BAFB47E8874764186BDB7865E8344DAF

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
