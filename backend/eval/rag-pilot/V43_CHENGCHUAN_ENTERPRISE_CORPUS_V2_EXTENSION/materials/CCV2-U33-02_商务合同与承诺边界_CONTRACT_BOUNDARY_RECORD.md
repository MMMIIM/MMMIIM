---
doc_id: "CCV2-U33-02"
title: "商务合同与承诺边界-CONTRACT_BOUNDARY_RECORD"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U33"]
matrix_theme: "U33"
evidence_slot: "CONTRACT_BOUNDARY_RECORD"
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

# 商务合同与承诺边界-CONTRACT_BOUNDARY_RECORD

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向商务合同与承诺边界主题。

## 可核验记录

1. Synthetic合同边界样例记录免费维护期为12个月，仅对样例项目有效。
2. 另一个Synthetic项目免费维护期为36个月。
3. 两个期限不得被抽象成公司统一服务期限。
4. 未存在正式合同的情况下，系统只能描述服务能力，不能承诺固定期限。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
