# Codex 导入指南

## 建议建立 3 个逻辑库
1. `universal`
2. `industry/government`、`industry/medical`
3. `company_case`

## 读取
优先读取 `rag_import_manifest.jsonl`，Markdown YAML frontmatter 作为 chunk metadata。

## 关键字段
`doc_id / library_scope / domain / requirement_themes / evidence_category / source_ids / source_kind / valid_from / valid_until / evidence_temporal_status / freshness_sensitivity / last_verified_at / next_review_at / claim_permission / sha256`

## 强制边界
- `official_guidance_summary`：用于 Requirement/行业知识，不是企业 Evidence。
- `synthetic_company_evidence`：可用于 Fact/Mapping/Sufficiency Benchmark，但 `claim_permission=false`。
- 法规/标准与公司 Evidence 分开判断时效。
- 不删除历史材料；保留时效 metadata，由下游判断是否可用。
- 不把 `CURRENTNESS_UNCONFIRMED` 当当前强制要求。
- 不把 Synthetic 公司材料当真实投标证据。
