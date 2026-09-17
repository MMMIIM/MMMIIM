---
doc_id: "MED-07"
title: "医疗接口、迁移与上线切换"
library_scope: "industry"
domain: "medical"
requirement_themes:
  - "U05"
  - "U06"
  - "U23"
  - "U24"
  - "U34"
evidence_category: "G18"
source_ids:
  - "OFF-M03"
  - "OFF-M05"
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

# 医疗接口、迁移与上线切换

> 官方资料结构化摘要。正式投标与合规判断需回到原始法律、标准、政策或项目文件核验。

## 接口与迁移

患者、就诊、医嘱、申请、预约、文档等交互对象需要规范、联调、核验和回退证据。

## 官方来源 / 依据

- **OFF-M03｜WS/T 447-2014 基于电子病历的医院信息平台技术规范**｜国家卫生健康委员会｜状态 `CURRENTNESS_UNCONFIRMED`｜实施 `2014-06-20`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/wjw/s9497/201406/a2014514701f4e76b14f3446f6318937.shtml
- **OFF-M05｜医院信息平台交互标准 第1-11部分 + 医学电子文档数字签名技术标准**｜国家卫生健康委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2025-04-01`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/wjw/zcwjtg/202411/308603c60d554dd49052b5bfb3a9d391.shtml

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
