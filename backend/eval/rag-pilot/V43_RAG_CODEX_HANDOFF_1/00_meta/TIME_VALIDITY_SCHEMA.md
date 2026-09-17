# RAG 时效性 Metadata 规范 V1

最后核验：2026-08-31

## Source 时效
- `CURRENT_CONFIRMED`：官方明确现行/有效，或当前版本已确认。
- `CURRENT_NO_REPEAL_FOUND`：未发现废止，但来源页未直接给“有效”字段。
- `CURRENTNESS_UNCONFIRMED`：旧版、试行、状态不明；只能指导/历史参考，正式使用前复核。
- `FUTURE`：已发布但未实施。
- `HISTORICAL_REFERENCE`：年度通知、已结束规划等历史依据。
- `SUPERSEDED`：已知被替代。

字段：`publish_date / effective_date / expiry_date / last_verified_at / next_review_at / freshness_sensitivity / superseded_by`

## Evidence 时效
- `CURRENT`
- `EXPIRING_SOON`
- `EXPIRED`
- `HISTORICAL_PROJECT_EVIDENCE`
- `STALE_PENDING_RETEST`
- `TIME_UNKNOWN`

字段：`valid_from / valid_until / evidence_temporal_status / last_verified_at / next_review_at`

## 后续业务建议
1. Retrieval 可以召回历史/过期资料，但必须同时返回时效 metadata。
2. Mapping 可建立历史相关关系，但不能忽略过期。
3. Sufficiency 对 `EXPIRED / STALE_PENDING_RETEST / CURRENTNESS_UNCONFIRMED` 降级或转人工复核。
4. Claim Gate 对资质、证书、人员、授权、SLA、性能报告等高时效 Evidence 要求 `CURRENT`。
5. 历史项目案例可证明历史履约，不自动证明当前产品版本仍有同等能力。
6. `next_review_at` 到期触发 re-validation，不自动删除或判失效。
