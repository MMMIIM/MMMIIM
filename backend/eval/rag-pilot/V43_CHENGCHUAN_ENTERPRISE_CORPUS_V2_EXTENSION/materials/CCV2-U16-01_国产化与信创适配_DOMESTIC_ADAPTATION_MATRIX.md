---
doc_id: "CCV2-U16-01"
title: "国产化与信创适配-DOMESTIC_ADAPTATION_MATRIX"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U16"]
matrix_theme: "U16"
evidence_slot: "DOMESTIC_ADAPTATION_MATRIX"
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

# 国产化与信创适配-DOMESTIC_ADAPTATION_MATRIX

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向国产化与信创适配主题。

## 可核验记录

1. 国产化适配矩阵记录鲲鹏ARM64与海光x86_64两类服务器架构已完成安装验证。
2. 应用运行环境已验证openEuler 22.03 LTS SP3和麒麟服务器操作系统V10测试环境。
3. 适配矩阵按产品版本维护，不允许用旧版本矩阵证明新版本。
4. 未列入矩阵的国产操作系统需要单独联调。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
