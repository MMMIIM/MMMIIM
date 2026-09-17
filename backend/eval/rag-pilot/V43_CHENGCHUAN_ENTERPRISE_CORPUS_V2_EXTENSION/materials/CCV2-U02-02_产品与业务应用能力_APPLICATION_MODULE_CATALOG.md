---
doc_id: "CCV2-U02-02"
title: "产品与业务应用能力-APPLICATION_MODULE_CATALOG"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U02"]
matrix_theme: "U02"
evidence_slot: "APPLICATION_MODULE_CATALOG"
collection_basis: "GENERIC_TENDER_MATRIX"
requirement_blind: true
source_kind: "controlled_synthetic_enterprise_evidence"
evidence_status: "synthetic_development_only"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-01-01"
valid_until: "2027-12-31"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "MEDIUM"
last_verified_at: "2026-09-06"
next_review_at: "2026-12-31"
supersession_check_required: true
chunking_hint: "heading_then_paragraph"
corpus_generation: "CHENGCHUAN_DEPTH_V2"
merge_relation: "EXTENDS_EXISTING_COM_01_COM_16"
merge_policy: "DOCUMENT_ISOLATED_NO_TEXT_CONCAT"
fact_auto_merge_forbidden: true
source_authority: "SYNTHETIC_DEVELOPMENT_ONLY"
---

# 产品与业务应用能力-APPLICATION_MODULE_CATALOG

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向产品与业务应用能力主题。

## 可核验记录

1. 澄川事件协同平台 XEC 3.4包含事件受理、派发、处置、督办、核查和闭环归档功能。
2. 澄川医疗集成平台 XHI 2.1包含患者主索引、接口路由、数据交换任务和接口监控功能。
3. 行业扩展模块均通过平台扩展接口安装，不改变核心平台数据库表结构。
4. 医疗扩展模块与政务扩展模块属于不同产品实体，不得互相替代作为能力证明。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
