---
doc_id: "CCV2-U26-01"
title: "运维服务能力-OPS_SERVICE_SPEC"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U26"]
matrix_theme: "U26"
evidence_slot: "OPS_SERVICE_SPEC"
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

# 运维服务能力-OPS_SERVICE_SPEC

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向运维服务能力主题。

## 可核验记录

1. 运维服务目录包括事件处理、问题管理、变更支持、巡检、备份检查和版本升级支持。
2. 服务工单记录受理时间、负责人、处理过程、关闭原因和满意度字段。
3. 远程支持与现场支持是否提供由具体项目服务合同决定。
4. 运维人员不得通过共享管理员账号操作客户系统。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
