---
doc_id: "CCV2-U23-02"
title: "测试与验证-TEST_EXECUTION_REPORT"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U23"]
matrix_theme: "U23"
evidence_slot: "TEST_EXECUTION_REPORT"
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

# 测试与验证-TEST_EXECUTION_REPORT

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向测试与验证主题。

## 可核验记录

1. 2026-06 XDP 5.2.2发布测试执行核心回归用例486项。
2. 首次执行通过473项，13项失败。
3. 13项失败中11项修复后复测通过，2项判定为测试环境配置问题并重新执行通过。
4. 最终发布前核心回归通过486/486。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
