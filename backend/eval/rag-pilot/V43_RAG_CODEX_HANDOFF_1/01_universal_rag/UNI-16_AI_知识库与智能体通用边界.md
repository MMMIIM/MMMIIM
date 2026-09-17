---
doc_id: "UNI-16"
title: "AI、知识库与智能体通用边界"
library_scope: "universal"
domain: "cross_industry"
requirement_themes:
  - "U18"
evidence_category: "G18"
source_ids:
  - "OFF-U01"
  - "OFF-U04"
  - "OFF-U05"
  - "OFF-U07"
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

# AI、知识库与智能体通用边界

> 官方资料结构化摘要。正式投标与合规判断需回到原始法律、标准、政策或项目文件核验。

## AI

覆盖模型接入、RAG、Agent、工具权限、审计、评测与Human Review。

## 边界

模型输入、知识库和工具调用仍受数据安全、个人信息与最小权限约束。

## 官方来源 / 依据

- **OFF-U01｜政府采购需求管理办法**｜财政部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-07-01`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/gkml/caizhengwengao/wg2021/wg202005/202109/t20210917_3753625.htm
- **OFF-U04｜网络数据安全管理条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-01-01`｜最后核验 `2026-08-31`｜https://app.www.gov.cn/govdata/gov/202409/30/520076/article.html
- **OFF-U05｜中华人民共和国网络安全法（2025年修正）**｜全国人大常委会｜状态 `CURRENT_CONFIRMED`｜实施 `2026-01-01`｜最后核验 `2026-08-31`｜https://www.cac.gov.cn/2025-12/29/c_1768735112911946.htm
- **OFF-U07｜中华人民共和国个人信息保护法**｜全国人大常委会｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-11-01`｜最后核验 `2026-08-31`｜https://www.miit.gov.cn/zwgk/zcwj/flfg/art/2022/art_04a0f1fb5df244e39688fd5372623a8d.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
