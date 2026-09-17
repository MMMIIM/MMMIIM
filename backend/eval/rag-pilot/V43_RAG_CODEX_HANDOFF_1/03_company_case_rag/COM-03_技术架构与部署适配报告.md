---
doc_id: "COM-03"
title: "技术架构与部署适配报告"
library_scope: "company_case"
domain: "government+medical"
requirement_themes:
  - "U03"
  - "U04"
  - "U16"
  - "U17"
evidence_category: "ARCHITECTURE"
source_ids:
  - "OFF-U02"
  - "OFF-U12"
  - "OFF-U13"
source_kind: "synthetic_company_evidence"
evidence_status: "synthetic_pilot_evidence"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-05-20"
valid_until: "2027-05-19"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
last_verified_at: "2026-08-31"
next_review_at: "2026-11-30"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
---

# 技术架构与部署适配报告

> **Synthetic Company Evidence**：案例数据，仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。

## 架构

Web前端、API服务、关系数据库、对象存储、缓存和消息队列。

## 适配

Synthetic记录：Linux x86_64、某国产Linux测试环境、PostgreSQL兼容数据库完成安装与核心功能验证；未列版本不得推断。

## 官方来源 / 依据

- **OFF-U02｜国家政务信息化项目建设管理办法**｜国务院办公厅｜状态 `CURRENT_CONFIRMED`｜实施 `2020-02-01`｜最后核验 `2026-08-31`｜https://www.beijing.gov.cn/zhengce/zhengcefagui/202001/t20200122_1620360.html
- **OFF-U12｜数据库政府采购需求标准（2023年版）**｜财政部、工业和信息化部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2023-12-16`｜最后核验 `2026-08-31`｜https://m.mof.gov.cn/zcfb/202312/t20231226_3924124.htm
- **OFF-U13｜操作系统政府采购需求标准（2023年版）**｜财政部、工业和信息化部｜状态 `CURRENT_NO_REPEAL_FOUND`｜实施 `2023-12-16`｜最后核验 `2026-08-31`｜https://www.mof.gov.cn/jrttts/202312/t20231226_3924138.htm

## 时效使用规则

- 召回后同时检查 `evidence_temporal_status` 与 Source Registry 的 `validity_status`。
- `HISTORICAL_REFERENCE / CURRENTNESS_UNCONFIRMED` 不能直接当作当前强制要求。
- 到达 `next_review_at` 只代表必须重新核验，不等于自动失效。
- 公司 Evidence 的有效期与官方 Source 的有效期是两个不同维度。
