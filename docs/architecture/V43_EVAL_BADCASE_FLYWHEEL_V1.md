# V43 Eval / BadCase Flywheel Foundation V1

Implementation status (2026-09-11): Eval-only foundation implemented and
awaiting GPT/Human implementation review. No semantic Gold labels, Provider
calls, Production DB writes or production cutover are claimed.

状态：Eval-only foundation 已实现；等待 GPT/Human implementation review。本 Decision 未执行语义 Gold 判定或生产切换。

## 1. Problem statement

当前每个模块都可以独立产生评测包，但从一次 Run 到下一次修复的证据链通常由脚本和人工约定连接：执行评测、打开 JSON、回溯 source、区分结构故障与语义问题、登记 bad case、修复后重跑。这种连接方式难以保证跨月比较时使用了同一 source、Gold、生产运行、Prompt、Schema 和 evaluator。

本 V1 设计一个轻量、可复用的 Eval / BadCase Flywheel 基础层：

```text
Production/Eval Run
  -> immutable run snapshot
  -> provenance trace
  -> deterministic evaluators
  -> BadCase registry
  -> failure-family grouping
  -> GPT/Human semantic review
  -> repair decision
  -> targeted regression
  -> Core6 regression
  -> fresh-holdout gate
```

第一生产使用场景是 Requirement P0：冻结的 487 个 Source Truth atoms 与现有 Core6 production canonical exports（1998 条）之间的机械溯源。当前 GPT/Human 已提供的 P0 语义基线只作为输入事实，Codex 不重新判断或重建其 MATCH/PARTIAL/DISTORTED/MISS 标签。

## 2. Non-goals and hard boundaries

V1 不实现以下能力：Semantic Judge Agent、自动 Gold 变更、Prompt 自动调优、自动代码修复、标注 UI、dashboard、LangSmith/Braintrust/Phoenix 集成、独立服务、队列、向量数据库、embedding 聚类、多模型投票、生产监控平台、生产权限或业务表变更。

本 Decision 不修改 Production code、Requirement/Fact/Mapping/Claim/Writer 语义、Gold、Prompt、Schema 或 migration；不调用 Provider/LLM；不写数据库；不提交 Git。设计文档中的“新文件/新表”均为后续实现提案，不代表本轮已创建。

## 3. Authority model

| 责任 | 权威来源 | V1 行为 |
| --- | --- | --- |
| 业务事实与生产状态 | Backend owning service + canonical tables | 仅读取并引用 identity；不由飞轮改写 |
| 结构/溯源观察 | Codex deterministic evaluator | 只输出可复现的结构、hash、span、状态和第一机械分歧 |
| 语义标签（MATCH/PARTIAL/DISTORTED/MISS 等） | GPT 评审，最终由 Human 接受 | 可导入已冻结标签；字段在未提供时必须为 null |
| Gold 冻结与变更 | Human governance | V1 无自动 promotion/mutation |
| Provider/model identity | 现有 Gateway/adapter audit | 只记录非敏感 identity；不将配置推断成实际响应 |

任何下游 stage 都不能扩大上游 authority。`semantic_label`、`gold_decision`、`business_importance`、`claim_permission` 不由 deterministic evaluator 推导。

## 4. Existing architecture and proposed placement

现有生产链由 Backend control plane 负责 canonicalization、retrieval、evidence/fact/mapping/claim/writer authorization；`services/semantic-gateway` 负责 Provider 适配。评测代码集中在 `backend/eval/**`，通用候选/合同工具在 `backend/src/eval/**` 与 `packages/semantic-contracts/**`。因此飞轮应作为 Eval-only library/CLI 层，引用生产读取服务与已有 artifact builders，不复制生产 authority。

建议后续实现位置（本轮不创建）：

```text
backend/src/eval/flywheel/
  contract.js       # generic records and validation
  run-registry.js   # immutable EvalRun identity
  artifact-snapshot.js
  trace.js
  evaluator.js
  badcase-registry.js
  failure-family.js
  regression-runner.js
backend/eval/flywheel/runner.js  # one developer entrypoint
backend/test/eval-flywheel/*.test.js
```

上述位置是对现有 Node ESM、`backend/test`、`backend/eval` 约定的延伸，不是新的生产服务。

## 5. Generic domain model

所有 generic records 使用 stable string IDs、ISO-8601 timestamps、SHA-256 identity 和 JSON typed payload；Requirement/Fact/Mapping/Claim/Writer 特有字段放在 adapter payload，不能进入 generic core。

### EvalRun

```json
{
  "eval_run_id": "string",
  "module": "requirement|fact|mapping|claim|writer|rag",
  "dataset_id": "string",
  "dataset_partition": "TARGETED_BADCASE|CORE6|FRESH_HOLDOUT|OTHER",
  "created_at": "ISO-8601",
  "git_head": "full commit sha or null for dirty working tree",
  "git_dirty": true,
  "git_status_sha256": "hex",
  "git_diff_sha256": "hex",
  "git_untracked_manifest_sha256": "hex",
  "source_corpus": {"id": "string", "version": "string", "sha256": "hex"},
  "gold_or_source_truth": {"id": "string", "version": "string", "sha256": "hex", "semantic_status": "PENDING|FROZEN|NOT_APPLICABLE"},
  "production_artifact_identity": {"run_id": "string|null", "artifact_id": "string|null", "sha256": "hex|null"},
  "contract_versions": {"prompt": "string|null", "schema": "string|null", "task": "string|null", "rules": {"name": "version"}},
  "provider_model": {"provider": "string|null", "model": "string|null", "endpoint_category": "string|null"},
  "evaluator_version": "string",
  "artifact_manifest": {"path": "string", "sha256": "hex"},
  "status": "OPEN|COMPLETED|BLOCKED|SUPERSEDED"
}
```

The identity is immutable after creation. A new source, Gold, code head, contract or evaluator creates a new `eval_run_id`; it never edits a completed run.

### EvalCase

`eval_case_id`, `eval_run_id`, `module`, `case_key`, `source_truth_atom_id` (nullable), `dataset_id`, `dataset_partition` (`TARGETED_BADCASE`, `CORE6`, `FRESH_HOLDOUT`, `OTHER`), `input_artifact_ref`, `expected_artifact_ref`, `actual_artifact_ref`, `status`, and typed `module_payload`. One formal `EvalRun` has exactly one `dataset_partition`; `CORE6` is never encoded as `FRESH_HOLDOUT`.

### TraceStage

`stage_id`, `trace_id`, `ordinal`, `stage_type`, `status` (`PRESENT`, `ABSENT`, `NOT_REACHED`, `EVIDENCE_NOT_PERSISTED`), `artifact_ref`, `identity` (IDs/hashes only), `observed_at`, and typed `details`. Stage order is explicit, but absent persisted evidence does not invent a value.

### EvaluationObservation

`observation_id`, `eval_case_id`, `evaluator_id`, `check_id`, `result` (`PASS`, `FAIL`, `REVIEW_REQUIRED`, `NOT_EVALUATED`), `severity`, `mechanical_first_divergence`, `risk_signals[]`, `evidence_refs[]`, `details`.

### BadCase

```json
{
  "badcase_id": "string",
  "module": "string",
  "eval_run_id": "string",
  "case_id": "string",
  "source_truth_atom_id": "string|null",
  "severity": "P0|P1|P2|INFO",
  "semantic_label": null,
  "semantic_label_author": null,
  "semantic_label_version": null,
  "first_divergence_stage": "string|null",
  "failure_family_id": "string|null",
  "status": "OPEN|ROOT_CAUSE_CONFIRMED|REPAIR_PLANNED|REPAIRED|REGRESSION_PASS|REGRESSION_FAIL|WONT_FIX|DISPUTED",
  "introduced_run_id": "string|null",
  "resolved_run_id": "string|null",
  "regression_case_id": "string|null",
  "evidence_refs": [],
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

`semantic_label` remains null until GPT/Human input is explicitly imported. A Codex-created BadCase can carry only deterministic observations and a review queue state.

### FailureFamily, RegressionResult, ArtifactSnapshot

`FailureFamily` groups root-cause classes with `failure_family_id`, module, name, description, first observed run, owner, status and member bad-case IDs. Example names in the implementation plan are schema examples only and are not current diagnoses.

`RegressionResult` records `regression_result_id`, run, scope, target IDs, baseline identity, current identity, per-check outcomes, first divergence and status. It must preserve `NOT_EVALUATED` when a layer was not reached.

`ArtifactSnapshot` records an immutable `artifact_id`, logical path/key, byte length, SHA-256, media type, producer, captured-at, source run and redaction policy. Large source text/provider content stays in the existing artifact files, not duplicated into every registry row.

### Registry-safe versus restricted evidence

The flywheel has two intentionally separate artifact classes:

* `REGISTRY_SAFE_ARTIFACT`: shareable identity/summary material with no secret, Authorization, API key, raw prompt, raw Provider response, or unbounded source body. Only bounded source excerpts and immutable references are allowed.
* `RESTRICTED_EVAL_EVIDENCE_ARTIFACT`: Eval-only, explicitly enabled, secret-redacted evidence preserving the semantic content needed for diagnosis. It is not a default Production log and is not placed in a shareable `docs` directory unless repository security policy explicitly permits that location.

The restricted sink may capture immutable snapshots for `PROVIDER_INPUT_SNAPSHOT`, `RAW_PROVIDER_RESPONSE_SNAPSHOT`, `RAW_CANDIDATE_SNAPSHOT`, `NORMALIZED_CANDIDATE_SNAPSHOT`, `CANONICALIZATION_DECISION_SNAPSHOT`, `SOURCE_RESOLUTION_SNAPSHOT` and `CANONICAL_OUTPUT_SNAPSHOT`. Registry rows store only `{artifact_id, path_or_key, sha256, stage, redaction_policy}`. The default Production path uses a no-op `EvalEvidenceSink`; an explicit Eval harness may inject a `TraceCollector`/sink. If a Production observer callback is ever unavoidable, it must be disabled by default and equivalence-tested so sink-off and sink-on semantic outputs are identical.

## 6. Persistence model

Repository reconnaissance found no dedicated `eval_runs`, `eval_cases`, `bad_cases`, `failure_families` or `regression_results` tables. Existing migrations 001–051 persist production/domain objects such as `requirements`, `requirement_baselines`, `company_materials`, `material_chunks`, `enterprise_retrieval_runs/results`, evidence/fact/mapping/claim/writer tables and audit tables. Those tables are production authority and must not be repurposed as an Eval registry.

### V1 storage decision

For the first implementation, use immutable JSON/JSONL/Markdown artifacts under `docs/eval/flywheel/<eval_run_id>/` plus an artifact manifest. This matches current Beta conventions and avoids a migration solely for an Eval registry. The registry API should be storage-agnostic so a future decision can add a single Eval migration if query scale requires it.

### Optional future tables (not created in this Decision)

If a later decision proves DB queries necessary, evaluate one migration containing logical entities rather than five uncoordinated migrations:

| Entity | Key columns | Constraints/indexes | Write/authority rule |
| --- | --- | --- | --- |
| `eval_runs` | `eval_run_id` PK, module, git/source/Gold hashes, contract JSONB, status | unique `(module, identity_hash)`; index module/status | append-only registry writer; no FK to production mutation paths |
| `eval_cases` | `eval_case_id` PK, run FK, case key, partition, artifact refs | unique `(eval_run_id, case_key)` | immutable case identity; observations separate |
| `bad_cases` | `badcase_id` PK, case FK, label/status/family, refs JSONB | unique `(eval_run_id, case_id, semantic_label_version)` | import or registry service only; semantic fields require GPT/Human provenance |
| `failure_families` | family PK, module, owner, lifecycle | unique `(module, name, version)` | family definitions versioned; no inferred business truth |
| `regression_results` | result PK, run/case/family scope, baseline/current identity | index scope/status | append-only result; no production writes |

The artifact manifest remains the source of large evidence. Any future migration must add FK/permission tests proving no Eval write changes production tables.

## 7. Trace contract

The generic trace is a directed, ordered list:

```text
source -> stage[0..n] -> expected/reference -> actual -> observations -> first divergence -> failure family
```

Each edge carries a stable artifact reference and hash; text is optional and redacted according to the existing report sanitizer. The tracer accepts partial evidence. Missing rows are represented as `EVIDENCE_NOT_PERSISTED`, not reconstructed through a new Provider call.

### Requirement adapter stage map

```text
Tender Source
  -> Section
  -> Chunk
  -> Provider Input
  -> Raw Candidate
  -> Normalization
  -> Source Resolution
  -> Canonical Requirement
```

The adapter consumes the existing tender source/PDF manifest, production exports, parse/chunk artifacts, `SourceLocationResolver`, candidate artifacts and canonical exports. For the frozen P0 corpus it must index all 487 atoms and link to the existing `V43-CORE6-20260911` exports without regenerating the Provider layer. A missing persisted request or response is an explicit evidence gap.

### Trace errors

Fail closed on source-truth/Gold SHA mismatch, production-run identity mismatch, source SHA mismatch, artifact corruption, cross-project identity collision or missing mandatory frozen metadata. A single absent intermediate artifact does not fail all cases; the affected case receives `EVIDENCE_NOT_PERSISTED` and continues with available stages.

## 8. Deterministic evaluator contract

V1 evaluators are pure functions over a trace and frozen identity context. They return case-level observations with check ID, result, evidence references and first mechanical divergence.

Required Requirement checks:

`SECTION_COVERAGE`, `CHUNK_SOURCE_SPAN_VALID`, `SOURCE_SPAN_RECONSTRUCTABLE`, `SOURCE_HASH_MATCH`, `SCHEMA_VALID`, `OUTPUT_TRUNCATION`, `SOURCE_RESOLUTION_PRESENT`, `SOURCE_VERIFIED_FLAG`, `DUPLICATE_CANONICAL_ID`, `MISSING_SOURCE_REFS`, `CROSS_PROJECT_CONTAMINATION`.

Risk signals:

`NEGATION_TOKEN_CHANGED`, `NUMERIC_TOKEN_CHANGED`, `TABLE_INDEX_TOKEN_RISK`, `SOURCE_CANONICAL_LOW_LEXICAL_ALIGNMENT`.

Risk signals only enqueue review. They never become `MATCH`, `PARTIAL`, `DISTORTED` or `MISS`.

### First divergence

The evaluator scans stages in declared order and returns the first mechanically missing/invalid stage. For example, a present chunk and absent Provider output yields `PROVIDER_OUTPUT`; a present raw candidate and absent canonical record yields `CANONICALIZATION`. This value is distinct from `semantic_root_cause`, which is null until GPT/Human adjudication or a previously frozen label is supplied.

## 9. BadCase lifecycle and import

Lifecycle:

```text
OPEN -> ROOT_CAUSE_CONFIRMED -> REPAIR_PLANNED -> REPAIRED
  -> REGRESSION_PASS | REGRESSION_FAIL
```

`DISPUTED` and `WONT_FIX` are terminal governance outcomes. A BadCase import requires case/run identity, severity, deterministic evidence refs and (if present) an explicit semantic label author/version. The importer rejects labels without author/version, rejects identity/hash mismatches, and is idempotent on `(eval_run_id, case_id, semantic_label_version)`.

The current 44 unsafe P0 cases are a seed only. If the exact frozen ledger is not present, the registry reports `SEED_LEDGER_INPUT_PENDING_GPT`; this is not a framework blocker. Codex must not infer the 44 labels from aggregate counts.

## 10. Failure-family lifecycle

Families are versioned definitions of root-cause classes, not symptom lists. A family may be created only with a deterministic evidence reference or an imported GPT/Human decision. Membership is many-to-many through BadCase references; reclassification creates a new version rather than mutating historical observations. Family status is `PROPOSED`, `CONFIRMED`, `RETIRED` or `DISPUTED`, and `root_cause_owner` is descriptive, not an automatic repair command.

## 11. Regression lifecycle

`RegressionRunner` runs selected case IDs, family IDs or dataset IDs against a frozen baseline identity. It emits per-check results, not just an aggregate score. Scopes are explicit:

1. targeted BadCase regression;
2. failure-family regression;
3. Core6 development/regression set;
4. fresh-tender holdout/generalization set.

Core6 is never silently treated as an independent holdout. A future release decision may require all targeted checks, no unacceptable Core6 loss and a fresh-holdout threshold; V1 only records those outcomes and does not deploy or gate production automatically.

## 12. Core6 vs Holdout governance

The dataset partition is part of `EvalCase` and `EvalRun` identity. Core6 cases can prove development/regression behavior and trace continuity. Fresh tender cases prove generalization and must use a separate source corpus identity. The runner rejects a comparison when partition identity is missing or when a Core6 artifact is passed as a fresh holdout without an explicit, reviewed mapping.

## 13. Artifact and versioning rules

Every run has one manifest containing sorted artifact entries (`path`, bytes, SHA-256, media type, producer, redaction status). The manifest itself is hashed and included in `EvalRun.artifact_manifest`. Run identity includes `git_head`, `git_dirty`, `git_status_sha256`, `git_diff_sha256` and `git_untracked_manifest_sha256`; the fingerprints exclude secret file contents and use names/metadata only. A dirty tree with the same HEAD therefore cannot collide with a clean tree or a different dirty state. Mutable branch names are informational only.

Existing report sanitation in `backend/src/verification/requirement-extraction-report.js` blocks credentials, prompts, raw model output, source/body fields and parsed responses. The flywheel reuses that policy and stores only safe excerpts or references in registry records. Full Provider response persistence is never a default; restricted evidence capture must be explicit and immutable.

### Known Baseline Failure Registry

The first implementation adds a small machine-readable artifact (not a new platform or table) with `test_id`, `failure_signature`, `classification`, `first_seen`, `evidence_ref` and `status`. Allowed classifications are `KNOWN_BASELINE_FAILURE`, `NEW_TASK_REGRESSION`, `FLAKY`, `ENVIRONMENT` and `UNKNOWN`. Existing unrelated failures are recorded as known baseline; task-induced failures must be repaired. `UNKNOWN` with high impact is a hard gate. This registry is separate from semantic BadCase labels.

Comparing `v18` with `v17` months later is therefore a comparison of immutable run identities, source/Gold hashes, production run IDs, contract/rule versions, evaluator version and artifact manifest—not of a mutable directory name.

## 14. CLI/API interfaces

One developer entrypoint should expose five operations, following existing Node script conventions:

```text
npm run eval:flywheel -- trace --module requirement --run <id> --source <manifest>
npm run eval:flywheel -- evaluate --run <id> --checks <manifest>
npm run eval:flywheel -- import-badcases --run <id> --ledger <gpt-ledger>
npm run eval:flywheel -- regression --scope targeted|family|core6|holdout --run <id>
npm run eval:flywheel -- summary --run <id>
```

The exact npm script name is subject to the implementation plan and existing script review; no second CLI framework is allowed.

### Stable function contracts (design)

`createEvalRun(input)` validates all mandatory identity fields, computes `identity_hash`, writes one immutable run record and returns `{ evalRunId, identityHash, artifactManifestRef }`. Missing source/Gold/run metadata is a hard error; repeated identical input returns the existing record, while a conflicting identity returns `EVAL_RUN_IDENTITY_CONFLICT`.

`buildTrace({ module, evalRunId, caseId, adapterInput })` resolves only existing artifacts, returns `{ traceId, stages, evidenceGaps, identity }`, and marks absent persistence as `EVIDENCE_NOT_PERSISTED`. It must not call a Provider.

`runDeterministicEvaluators(trace, context)` returns case-level observations and first mechanical divergence. Invalid trace identity is an error; semantic labels are not produced.

`registerBadCase(input)` validates provenance, accepts nullable semantic fields, rejects an unversioned semantic label, and is idempotent for the same run/case/label version.

`assignFailureFamily({ badcaseId, familyId, evidenceRefs })` requires an existing family and evidence; it creates a versioned membership relation and does not change semantic labels.

`runRegression({ scope, caseIds, familyId, evalDatasetId, baselineIdentity })` returns per-case/per-check `RegressionResult` rows with `PASS`, `FAIL`, `REVIEW_REQUIRED` or `NOT_EVALUATED`; it rejects mixed or unverified dataset identities.

## 15. Testing strategy

Tests are written before implementation. Unit coverage must include immutable run identity, artifact hash stability, stage ordering, `EVIDENCE_NOT_PERSISTED`, first divergence, deterministic checks/risk signals, BadCase idempotency, family membership and regression comparison. PostgreSQL coverage (only if future DB persistence is approved) must test uniqueness/FKs, immutable snapshots, repeat imports and proof that Eval writes cannot mutate production authority tables. Integration coverage must mechanically index all 487 P0 atoms, preserve production run identity/source SHA, and prove zero Provider calls during trace reconstruction. Regression fixtures include the existing FAST-01 polarity, FAST-04 ODBC/JDBC table-token and source-fidelity examples, with semantic expectations loaded only from frozen GPT/Human data.

## 16. Migration strategy

No migration is executed in V1 architecture work. First implementation should use file artifacts and keep production DB untouched. A later DB decision must demonstrate query need, define one migration or an explicitly justified minimal set, add permission/transaction tests, and preserve the immutable artifact manifest. Existing production tables are never altered to host Eval rows.

## 17. Rollout stages

1. **Contract stage:** implement generic record validators, identity hashing and artifact manifest tests.
2. **Trace stage:** implement generic tracer and Requirement adapter; reproduce one small fixture, then the 487 index.
3. **Evaluator stage:** add deterministic checks and first-divergence reporting.
4. **Registry stage:** add BadCase/family import and idempotency using a frozen sample ledger.
5. **Regression stage:** run targeted and Core6 comparisons; require explicit holdout partition.
6. **Operational stage:** add one CLI entrypoint and case-level reports; keep Provider/DB writes disabled by default.

Each stage ends with focused tests and an artifact manifest; no stage silently promotes semantic labels or writes production authority.

## 18. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hash/source drift | Fail closed on identity mismatch; include source and manifest SHA in every run |
| Missing historical payload | Preserve `EVIDENCE_NOT_PERSISTED`; never regenerate Provider evidence |
| Semantic leakage into deterministic code | Nullable labels and explicit GPT/Human provenance; risk signals are non-semantic |
| Duplicate subsystem | Extend current builders/runners; one flywheel library and one CLI |
| Sensitive artifact exposure | Reuse report sanitizer; store references/hashes and bounded excerpts |
| Core6 mistaken for holdout | Partition in run/case identity and runner validation |
| Eval writes touching production | File-first storage; future DB permission/FK tests and separate schema |
| Seed aggregate mistaken for case ledger | Require exact 44-item GPT/Human ledger; otherwise `SEED_LEDGER_INPUT_PENDING_GPT` |

## 19. Explicit V2 backlog

V2 may consider reviewed semantic-judge integration, annotation workflow, richer source-span visual inspection, optional Eval DB indexing, multi-run dashboards, controlled experiment scheduling, and model/provider comparison. These require separate decisions, data-security review and explicit authority boundaries. They are not part of V1.

## Design self-review

- No implementation, Provider/LLM call, production DB write, migration or Gold mutation was performed.
- No generic core field authorizes a Claim or Writer output.
- No semantic label is inferred from a risk signal or aggregate metric.
- Existing production/eval services are referenced rather than duplicated.
- Core6 and fresh holdout are separate partitions.
- The 44-case seed remains pending exact GPT/Human ledger when unavailable.
