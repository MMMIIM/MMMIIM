---
doc_id: "COM-14"
title: "Synthetic医疗案例：医院接口与数据平台"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U05"
  - "U06"
  - "U29"
  - "U34"
evidence_category: "CASE_MEDICAL"
source_ids:
  - "OFF-M03"
  - "OFF-M05"
  - "OFF-M06"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-01-31"
valid_until: null
evidence_temporal_status: "HISTORICAL_PROJECT_EVIDENCE"
freshness_sensitivity: "LOW"
last_verified_at: "2026-08-31"
next_review_at: "2027-02-28"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# Synthetic医疗案例：医院接口与数据平台

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 案例

某虚构三级医院接口与数据平台，包含接口治理、患者主索引、历史迁移、联调和试运行。

## 时效

实施期2025-06至2026-01；标准映射以2026-08-31核验结果为准。

## 官方来源 / 依据

- **OFF-M03｜WS/T 447-2014 基于电子病历的医院信息平台技术规范**｜国家卫生健康委员会｜状态 `CURRENTNESS_UNCONFIRMED`｜实施 `2014-06-20`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/wjw/s9497/201406/a2014514701f4e76b14f3446f6318937.shtml
- **OFF-M05｜医院信息平台交互标准 第1-11部分 + 医学电子文档数字签名技术标准**｜国家卫生健康委员会｜状态 `CURRENT_CONFIRMED`｜实施 `2025-04-01`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/wjw/zcwjtg/202411/308603c60d554dd49052b5bfb3a9d391.shtml
- **OFF-M06｜医疗卫生机构网络安全管理办法**｜国家卫生健康委员会等｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2022-08-08`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/guihuaxxs/c100133/202208/8a23d01133214a779879094dd20cd383.shtml

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
