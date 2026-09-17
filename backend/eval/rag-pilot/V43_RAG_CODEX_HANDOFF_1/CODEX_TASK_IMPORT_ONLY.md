# CODEX TASK — IMPORT RAG CONTENT ONLY

请先阅读：

1. `DECISION_CURRENT_BOUNDARY.md`
2. `CODEX_IMPORT_GUIDE.md`
3. `rag_import_manifest.jsonl`
4. `00_meta/COVERAGE_MATRIX.md`

然后只读检查当前项目已有 RAG ingestion / material ingestion 入口。

## 目标

将本包内容按现有正式 RAG 导入机制导入项目：

- `01_universal_rag/`
- `02_industry_rag/government/`
- `02_industry_rag/medical/`
- `03_company_case_rag/`

优先复用现有 Material / Source ingestion 流程。

## 不允许

- 不新建 RAG Service
- 不新建 Temporal Service
- 不改 DB schema
- 不改 Evidence Fact Contract
- 不改 Mapping / Sufficiency / Claim
- 不把官方指导资料当企业 Evidence
- 不把 Synthetic 公司资料当真实企业 Evidence
- 不自动调用 DeepSeek / SiliconFlow / Dify
- 不运行 Fact Benchmark
- 不 commit / push / deploy / reset / clean

## 时效字段

包内时效字段当前只作为 metadata 保存；如果现有 ingestion 不支持这些字段：

- 不为此扩 DB
- 不阻塞导入
- 只在 checkpoint 中报告哪些字段未被持久化

## 去重

优先使用现有文档 hash / content hash / source identity 机制。
如果现有系统没有可安全复用的去重机制，不新增框架，只报告潜在重复风险。

## 输出

# V43_RAG_LIBRARY_IMPORT_CHECKPOINT

## PRECHECK
- current ingestion path:
- existing RAG/material stores:
- DB migration required:
  NO
- architecture change required:
  NO

## PACKAGE
- universal docs:
- government docs:
- medical docs:
- company case docs:
- total docs:

## IMPORT
- imported:
- skipped existing:
- failed:
- duplicates detected:

## METADATA
- requirement_themes preserved:
- source_kind preserved:
- source_ids preserved:
- date/source fields preserved:
- temporal descriptive metadata preserved:
- unsupported metadata fields:

## BOUNDARY
- official guidance converted to company evidence:
  NO
- synthetic company evidence treated as real:
  NO
- Fact Contract changed:
  NO
- Mapping changed:
  NO
- Sufficiency changed:
  NO
- Claim changed:
  NO
- Temporal runtime logic added:
  NO

## CALLS
- Provider:
  0
- DeepSeek:
  0
- Dify:
  0

## GIT
- commit:
  NO
- push:
  NO
- deploy:
  NO
- dirty worktree preserved:

## FINAL STATUS

Success:
`RAG_LIBRARY_CONTENT_IMPORTED`

Existing ingestion cannot safely import without architecture change:
`RAG_IMPORT_REQUIRES_DESIGN_REVIEW`

Package/metadata mismatch:
`RAG_PACKAGE_CONTRACT_MISMATCH`
