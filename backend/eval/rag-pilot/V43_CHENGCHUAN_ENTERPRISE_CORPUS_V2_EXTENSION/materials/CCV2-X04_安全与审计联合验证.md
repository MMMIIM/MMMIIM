---
doc_id: "CCV2-X04"
title: "安全与审计联合验证"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U09", "U10", "U11", "U31"]
matrix_theme: "MULTI"
evidence_slot: "SECURITY_AUDIT_COMBINED"
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

# 安全与审计联合验证

## 联合记录

1. 普通用户越权访问受限数据的测试用例被系统拒绝。
2. 管理接口仅在内网地址监听。
3. 审计日志记录用户、时间、来源IP、对象和结果。
4. 受限数据导出需要审批记录。
5. 2026-06安全复测未发现未关闭高风险问题。

## 使用边界

本材料仅用于受控开发企业 Corpus，不得作为真实企业能力或 Real Gold。
