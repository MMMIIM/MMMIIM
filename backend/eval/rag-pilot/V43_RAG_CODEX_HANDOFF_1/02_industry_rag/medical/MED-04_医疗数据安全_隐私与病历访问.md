---
doc_id: "MED-04"
title: "医疗数据安全、隐私与病历访问"
library_scope: "industry"
domain: "medical"
requirement_themes:
  - "U09"
  - "U10"
  - "U11"
  - "U31"
  - "U34"
evidence_category: "G18"
source_ids:
  - "OFF-M06"
  - "OFF-M12"
  - "OFF-U04"
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

# 医疗数据安全、隐私与病历访问

> 官方资料结构化摘要。正式投标与合规判断需回到原始法律、标准、政策或项目文件核验。

## 安全

医疗机构需开展分类分级、风险评估和安全责任管理。

## 病历

电子病历访问遵循分级分类、最小可用和行为审计。

## 官方来源 / 依据

- **OFF-M06｜医疗卫生机构网络安全管理办法**｜国家卫生健康委员会等｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2022-08-08`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/guihuaxxs/c100133/202208/8a23d01133214a779879094dd20cd383.shtml
- **OFF-M12｜关于进一步加强医疗机构电子病历信息使用管理的通知**｜国家卫生健康委员会｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2025-06-01`｜最后核验 `2026-08-31`｜https://www.nhc.gov.cn/yzygj/c100068/202506/c68abee7c54b4651a774cd533761780b.shtml
- **OFF-U04｜网络数据安全管理条例**｜国务院｜状态 `CURRENT_CONFIRMED`｜实施 `2025-01-01`｜最后核验 `2026-08-31`｜https://app.www.gov.cn/govdata/gov/202409/30/520076/article.html
- **OFF-U07｜中华人民共和国个人信息保护法**｜全国人大常委会｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2021-11-01`｜最后核验 `2026-08-31`｜https://www.miit.gov.cn/zwgk/zcwj/flfg/art/2022/art_04a0f1fb5df244e39688fd5372623a8d.html

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
