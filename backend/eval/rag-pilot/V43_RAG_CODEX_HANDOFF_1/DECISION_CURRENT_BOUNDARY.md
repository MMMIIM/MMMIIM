# V43 RAG IMPORT — CURRENT BOUNDARY DECISION

Status: `RAG_IMPORT_ONLY_BOUNDARY_FROZEN`
Date: 2026-08-31

## 1. 本轮目标

将本目录中的三类 RAG 文档导入现有项目知识库，用于后续 Retrieval / Fact / Mapping Benchmark：

1. `01_universal_rag/`：通用政企信息化知识
2. `02_industry_rag/government/`：政企行业知识
3. `02_industry_rag/medical/`：医疗行业知识
4. `03_company_case_rag/`：Synthetic 案例公司材料

本轮只做 **RAG 内容导入与来源 metadata 保留**。

## 2. 严禁扩大架构

不得新增或修改：

- DB schema
- Temporal Validity Service
- Temporal Validator
- Retrieval ranking logic
- Mapping business semantics
- Sufficiency business semantics
- Claim Gate
- Evidence Fact Contract
- Requirement–Evidence Mapping Contract
- 状态机
- 定时刷新任务
- 自动失效逻辑
- 新的 Authority

现有业务链保持不变。

## 3. 时效性边界

“时效性”当前仅作为未来 Evidence Quality 维度的概念记录。

允许保留来源本身明确存在的事实字段，例如：

- `publish_date`
- `effective_date`
- `expiry_date`（原始资料明确存在时）
- `last_verified_at`
- `source_url`

包内若已有以下字段：

- `validity_status`
- `valid_from`
- `valid_until`
- `evidence_temporal_status`
- `freshness_sensitivity`
- `next_review_at`

当前一律视为：

`DESCRIPTIVE_METADATA_ONLY`

Codex 不得据此新增运行逻辑、数据库字段或下游判定规则。

## 4. Authority 边界

### 官方指导资料

`source_kind=official_guidance_summary`

用途：
- Requirement 理解
- 行业知识检索
- Writer 背景资料
- Coverage 分析

禁止：
- 将法规、标准、政策直接变成“公司具备某能力”的 Canonical Evidence Fact。

### 案例公司资料

`source_kind=synthetic_company_evidence`

用途：
- Fact Extraction
- Mapping
- Sufficiency Benchmark
- Human Review 测试

边界：
- `claim_permission=false`
- Synthetic 公司、案例、证书、性能值均不是真实企业事实。
- 不得用于真实投标或对外承诺。

## 5. Definition Ownership

保持现有定义唯一：

- Canonical Evidence Fact Authority：现有 `EvidenceSourceFactService`
- Canonical Mapping Authority：现有 `RequirementEvidenceFactMappingService`
- Sufficiency：现有正式聚合逻辑
- Claim permission：现有 Claim Gate

RAG 文档只能提供 Source / Context，不获得任何业务 Authority。

## 6. 导入结果

导入后只需报告：

- universal 文档数
- government 文档数
- medical 文档数
- company_case 文档数
- 导入成功/失败
- metadata 是否保留
- 是否出现重复文档
- 是否影响现有真实 RAG 数据

不得因为导入而自动运行 Provider Benchmark。

## 7. Git

不得自动：

- commit
- push
- deploy
- reset
- clean

保留当前 dirty worktree。

## FINAL BOUNDARY

`RAG_CONTENT_IMPORT = YES`

`TEMPORAL_CONCEPT_NOTED = YES`

`TEMPORAL_RUNTIME_LOGIC = NO`

`DB_CHANGE = NO`

`BUSINESS_CONTRACT_CHANGE = NO`

`AUTHORITY_CHANGE = NO`
