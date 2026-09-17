---
doc_id: "CCV2-U34-01"
title: "行业专项能力-INDUSTRY_GOV_CASE"
library_scope: "controlled_enterprise"
domain: "government+medical"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U34"]
matrix_theme: "U34"
evidence_slot: "INDUSTRY_GOV_CASE"
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

# 行业专项能力-INDUSTRY_GOV_CASE

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向行业专项能力主题。

## 可核验记录

1. 澄川事件协同平台 XEC 3.4在Synthetic政务案例中处理城市事件受理、派发、处置、督办和闭环。
2. 案例数据源包含热线事件、网格上报和物联告警三类测试来源。
3. 事件状态流转记录处置部门和处理时限字段。
4. 该行业案例只证明政务事件协同场景，不证明医疗业务能力。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
