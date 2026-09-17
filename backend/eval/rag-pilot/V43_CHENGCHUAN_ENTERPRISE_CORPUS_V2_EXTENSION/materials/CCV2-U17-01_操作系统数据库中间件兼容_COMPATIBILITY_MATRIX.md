---
doc_id: "CCV2-U17-01"
title: "操作系统数据库中间件兼容-COMPATIBILITY_MATRIX"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U17"]
matrix_theme: "U17"
evidence_slot: "COMPATIBILITY_MATRIX"
collection_basis: "GENERIC_TENDER_MATRIX"
requirement_blind: true
source_kind: "controlled_synthetic_enterprise_evidence"
evidence_status: "synthetic_development_only"
claim_permission: false
human_review_required: true
synthetic_company_evidence: true
valid_from: "2026-01-01"
valid_until: "2027-06-30"
evidence_temporal_status: "CURRENT"
freshness_sensitivity: "HIGH"
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

# 操作系统数据库中间件兼容-COMPATIBILITY_MATRIX

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向操作系统数据库中间件兼容主题。

## 可核验记录

1. 兼容矩阵记录XDP 5.2支持PostgreSQL 15/16、MySQL 8.0和达梦DM8指定测试版本。
2. 消息队列已验证RabbitMQ 3.12和Kafka 3.6。
3. 浏览器兼容记录覆盖Chrome 120+、Edge 120+。
4. 矩阵明确未验证Oracle 11g。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
