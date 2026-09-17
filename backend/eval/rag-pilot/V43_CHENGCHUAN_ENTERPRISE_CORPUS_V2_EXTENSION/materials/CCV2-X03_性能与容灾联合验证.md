---
doc_id: "CCV2-X03"
title: "性能与容灾联合验证"
library_scope: "controlled_enterprise"
domain: "cross_industry"
enterprise_id: "SYNTH-CHENGCHUAN-001"
enterprise_name: "澄川数智科技有限公司（Synthetic Demo Company）"
requirement_themes: ["U13", "U14", "U15"]
matrix_theme: "MULTI"
evidence_slot: "PERFORMANCE_DR_COMBINED"
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

# 性能与容灾联合验证

## 联合记录

1. XDP 5.2.2在8,000并发虚拟用户测试中P95为820毫秒。
2. 同一测试环境混合写入稳定吞吐1,650事务/秒。
3. 单应用节点故障后38秒内完成流量转移。
4. 数据库主节点故障演练业务恢复4分26秒。
5. 增加2个应用节点后混合查询吞吐提升约71%。

## 使用边界

本材料仅用于受控开发企业 Corpus，不得作为真实企业能力或 Real Gold。
