---
doc_id: "CCV2-U05-02"
title: "API与系统集成-INTEGRATION_TEST_RECORD"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U05"]
matrix_theme: "U05"
evidence_slot: "INTEGRATION_TEST_RECORD"
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

# API与系统集成-INTEGRATION_TEST_RECORD

## 记录对象

本记录属于澄川数智科技有限公司（Synthetic Demo Company）的受控开发企业材料，面向API与系统集成主题。

## 可核验记录

1. 澄川集成网关 XIG 3.6在2026-06联调测试中完成12个REST接口、3个SOAP接口和2个SFTP交换任务的联调。
2. 测试中字段转换规则支持JSON路径提取和枚举值映射。
3. 一个第三方接口连续3次超时后进入告警状态，但平台未自动重试写操作接口。
4. 联调记录仅证明测试过的接口类型，不证明任意第三方系统均可无改造接入。

## 使用边界

本材料仅用于 V4.3 RAG / Fact / Mapping / Claim / Writer 开发与评测。
不得晋升为 REAL_ENTERPRISE_EVIDENCE，不得作为真实投标企业能力声明依据。
事实使用必须同时保留 enterprise_id、产品/对象、版本、有效期和 source lineage。
