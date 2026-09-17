---
doc_id: "CCV2-U34-02"
title: "行业专项能力-INDUSTRY_MEDICAL_CASE"
library_scope: "controlled_enterprise"
domain: "government+medical"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U34"]
matrix_theme: "U34"
evidence_slot: "INDUSTRY_MEDICAL_CASE"
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

# 行业专项能力-INDUSTRY_MEDICAL_CASE

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向行业专项能力主题。

## 可核验记录

1. 澄川医疗集成平台 XHI 2.1在Synthetic医疗案例中完成HL7 v2消息接入、患者主索引和接口路由测试。
2. 测试接口包含ADT、医嘱和检验结果三类消息。
3. 测试数据全部为脱敏Synthetic数据。
4. 该行业案例只证明医疗接口集成测试能力，不证明政务事件协同能力。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
