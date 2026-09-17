# V43 Eval / BadCase Flywheel Foundation V1 — Implementation Plan

状态：实现已完成，等待最终 GPT/人审；本 Decision 未执行语义 Gold 判定或生产切换。

## Execution guardrails

- 先测后写（TDD）；每个 Task 独立验收并记录 artifact manifest。
- 只复用现有 Backend/Eval contracts、source lineage 和报告 sanitizer；不新建语义判定器、生产服务或并行 authority。
- Provider/LLM calls、Production DB writes、Gold mutations、migration execution、Git commit/push/merge/deploy 均为 0，直到另一个 Decision 明确授权。
- 所有运行失败均保留 case-level evidence；不以 aggregate 计数替代 case record。
- Semantic labels 只能由已冻结 GPT/Human ledger 导入；Codex 只计算 deterministic observations。

## Task 0 — Contract and identity fixtures (precondition)

**Purpose:** 固定 generic record、identity/hash 与安全字段边界，再实现存储。

**New files**

- `backend/src/eval/flywheel/contract.js`
- `backend/src/eval/flywheel/identity.js`
- `backend/test/eval-flywheel/contract.test.js`

**Interfaces**

- `validateEvalRunInput(input) -> { value, identityHash }`
- `validateTraceStage(stage)`
- `validateBadCaseInput(input)`
- `buildIdentityHash(value) -> sha256:<hex>`
- `buildDirtyWorktreeIdentity({ gitHead, statusText, diffText, untrackedManifest }) -> { git_head, git_dirty, git_status_sha256, git_diff_sha256, git_untracked_manifest_sha256 }`

**Tests first**

- Required run identity fields, module enum and SHA format.
- Stable hash for key-order changes; changed source/Gold/Git identity changes hash.
- Clean and dirty trees with the same HEAD have different identities; secret file contents are excluded from all fingerprints.
- Reject sensitive keys and semantic label without author/version.
- Validate nullable module payload without Requirement-specific fields in core.

**Verification**

`node --test backend/test/eval-flywheel/contract.test.js`

**Stop/review checkpoint:** `EVAL_CONTRACT_V1=PASS`, `IDENTITY_HASH_STABLE=PASS`, no production imports. If contract shape conflicts with existing conventions, stop and review before Task 1.

## Task 1 — EvalRun registry and ArtifactSnapshot (file-first)

**Purpose:** Persist immutable run identity and artifact manifest as files, without adding DB tables, and establish the explicit evidence-sink boundary.

**New files**

- `backend/src/eval/flywheel/run-registry.js`
- `backend/src/eval/flywheel/artifact-snapshot.js`
- `backend/src/eval/flywheel/evidence-sink.js`
- `backend/test/eval-flywheel/run-registry.test.js`
- `backend/test/eval-flywheel/artifact-snapshot.test.js`
- `backend/test/eval-flywheel/evidence-sink.test.js`

**Reuse**

- `backend/src/verification/requirement-extraction-report.js` sanitizer and report writer.
- Existing JSON/JSONL/Markdown checkpoint conventions under `docs/eval/**`.

**Interfaces**

- `createEvalRun(input, { rootDir }) -> EvalRunRecord`
- `loadEvalRun(evalRunId, { rootDir })`
- `snapshotArtifact({ path, producer, sourceRunId }) -> ArtifactSnapshot`
- `buildArtifactManifest(entries) -> { entries, sha256 }`
- `createEvalEvidenceSink({ mode: 'noop'|'restricted', rootDir }) -> EvalEvidenceSink`
- `capture(stage, evidence) -> ArtifactSnapshotRef`

**Tests first**

- Immutable write/reload round trip and deterministic manifest hash.
- Repeat identical `createEvalRun` is idempotent; conflicting identity returns `EVAL_RUN_IDENTITY_CONFLICT`.
- Missing mandatory source/Gold/run identity fails closed.
- Sanitizer removes credentials, prompts, raw model responses and unbounded source fields.
- Default sink is a no-op; restricted capture requires explicit mode, redacts secrets, writes immutable stage artifacts outside shareable `docs` unless policy permits, and returns only refs/hashes to registry callers.
- Sink-off and sink-on fixture runs produce identical semantic outputs.

**Verification**

`node --test backend/test/eval-flywheel/run-registry.test.js backend/test/eval-flywheel/artifact-snapshot.test.js backend/test/eval-flywheel/evidence-sink.test.js`

**Stop/review checkpoint:** one run directory is created only in a temporary test root; `PRODUCTION_DB_WRITES=0`, `PROVIDER_CALLS=0`. Review registry-safe versus restricted evidence boundaries and manifest fields before proceeding.

## Task 2 — Generic Trace model and Requirement adapter

**Purpose:** Reuse P0 evidence and existing source/canonical artifacts through a generic tracer.

**New files**

- `backend/src/eval/flywheel/trace.js`
- `backend/src/eval/flywheel/adapters/requirement.js`
- `backend/test/eval-flywheel/trace.test.js`
- `backend/test/eval-flywheel/requirement-adapter.test.js`

**Reuse**

- `backend/src/pipeline/source-location-resolver.js` (`SourceLocationResolver`, source hash helpers).
- `backend/eval/requirement-extraction-real-tender-pilot-v1/evaluation-artifact.js` artifact builders/readers.
- `backend/eval/requirement-production-quality-gate/recovery.js` runtime/provenance identity conventions.
- Existing P0 trace artifacts under `docs/eval/p0-recall/` as read-only fixtures.

**Interfaces**

- `buildTrace({ module, evalRunId, caseId, adapterInput }) -> TraceRecord`
- `appendTraceStage(trace, stage) -> TraceRecord`
- `buildRequirementTrace(adapterInput) -> TraceRecord`
- `listEvidenceGaps(trace) -> EvidenceGap[]`

Requirement adapter stage order:

`Tender Source -> Section -> Chunk -> Provider Input -> Raw Candidate -> Normalization -> Source Resolution -> Canonical Requirement`.

Absent persisted evidence is `EVIDENCE_NOT_PERSISTED`; no Provider call or regeneration is allowed.

**Tests first**

- Stage ordering and stable stage IDs.
- Partial trace with missing Provider response preserves other stages and emits `EVIDENCE_NOT_PERSISTED`.
- Source SHA and production run identity mismatch fail closed.
- Mechanical indexing of a small fixture and then all 487 P0 atom IDs without changing frozen source-truth bytes.

**Verification**

`node --test backend/test/eval-flywheel/trace.test.js backend/test/eval-flywheel/requirement-adapter.test.js`

**Stop/review checkpoint:** inspect first-divergence evidence and verify no semantic labels are present in adapter output.

## Task 3 — Deterministic evaluator suite

**Purpose:** Add reusable structural/provenance checks and first mechanical divergence.

**New files**

- `backend/src/eval/flywheel/deterministic-evaluator.js`
- `backend/test/eval-flywheel/deterministic-evaluator.test.js`

**Reuse**

- `backend/src/eval/requirement-extraction-evaluator.js` schema/case evaluation patterns.
- `backend/eval/requirement-production-quality-gate/run-quality-gate.js` source span, duplicate and mutation checks.
- `backend/src/verification/requirement-extraction-report.js` safe reporting.

**Interfaces**

- `runDeterministicEvaluators(trace, context) -> EvaluationObservation[]`
- `findFirstMechanicalDivergence(trace) -> { stage, reason } | null`
- `evaluateRiskSignals(trace) -> RiskSignal[]`

Checks: `SECTION_COVERAGE`, `CHUNK_SOURCE_SPAN_VALID`, `SOURCE_SPAN_RECONSTRUCTABLE`, `SOURCE_HASH_MATCH`, `SCHEMA_VALID`, `OUTPUT_TRUNCATION`, `SOURCE_RESOLUTION_PRESENT`, `SOURCE_VERIFIED_FLAG`, `DUPLICATE_CANONICAL_ID`, `MISSING_SOURCE_REFS`, `CROSS_PROJECT_CONTAMINATION`.

Risk signals: `NEGATION_TOKEN_CHANGED`, `NUMERIC_TOKEN_CHANGED`, `TABLE_INDEX_TOKEN_RISK`, `SOURCE_CANONICAL_LOW_LEXICAL_ALIGNMENT`; never map directly to semantic labels.

**Tests first**

- One fixture per check, including pass/fail and `NOT_EVALUATED`.
- First divergence is the earliest mechanically missing/invalid stage, independent of semantic root cause.
- Numeric/negation/table signals enqueue review but do not set MATCH/PARTIAL/DISTORTED/MISS.
- Cross-project identity collision fails closed.

**Verification**

`node --test backend/test/eval-flywheel/deterministic-evaluator.test.js`

**Stop/review checkpoint:** deterministic evaluator review confirms no model, embedding or semantic-judge import.

## Task 4 — BadCase registry and frozen-ledger import

**Purpose:** Record case-level failures and import explicit GPT/Human labels without invention.

**New files**

- `backend/src/eval/flywheel/badcase-registry.js`
- `backend/test/eval-flywheel/badcase-registry.test.js`

**Interfaces**

- `registerBadCase(input, store) -> BadCaseRecord`
- `importBadCaseLedger({ evalRunId, ledgerPath, store }) -> ImportReport`
- `transitionBadCase({ badcaseId, nextStatus, evidenceRefs })`

**Tests first**

- Nullable semantic fields accepted for Codex observations.
- GPT/Human label requires `semantic_label_author` and `semantic_label_version`.
- Same run/case/version is idempotent; conflicting evidence/hash is rejected.
- Unknown aggregate-only seed yields `SEED_LEDGER_INPUT_PENDING_GPT`, not fabricated rows.
- Lifecycle transition rejects illegal transitions.

**Verification**

`node --test backend/test/eval-flywheel/badcase-registry.test.js`

**Stop/review checkpoint:** import a synthetic two-row ledger only; do not import current 44 cases until the exact frozen ledger is supplied.

## Task 5 — Failure Family registry

**Purpose:** Version root-cause classes independently from symptoms and semantic labels.

**New files**

- `backend/src/eval/flywheel/failure-family-registry.js`
- `backend/test/eval-flywheel/failure-family-registry.test.js`

**Interfaces**

- `registerFailureFamily(input) -> FailureFamily`
- `assignFailureFamily({ badcaseId, familyId, evidenceRefs })`
- `listFamilyMembers(familyId)`

**Tests first**

- Family definition versioning and idempotent membership.
- Membership requires an existing BadCase and evidence references.
- Version changes do not mutate historical observations.
- Example names remain unregistered until a reviewed root cause is supplied.

**Verification**

`node --test backend/test/eval-flywheel/failure-family-registry.test.js`

**Stop/review checkpoint:** family records remain `PROPOSED` unless an explicit GPT/Human decision supplies confirmation.

## Task 5A — Known Baseline Failure Registry

**Purpose:** Classify pre-existing and task-induced test failures without building a second platform or table.

**New files**

- `backend/src/eval/flywheel/known-baseline-registry.js`
- `backend/test/eval-flywheel/known-baseline-registry.test.js`

**Interfaces**

- `recordBaselineFailure({ testId, failureSignature, classification, firstSeen, evidenceRef, status })`
- `loadBaselineFailures(path)`
- `classifyFailure(observation, registry) -> KNOWN_BASELINE_FAILURE|NEW_TASK_REGRESSION|FLAKY|ENVIRONMENT|UNKNOWN`

**Tests first**

- Stable signatures match known failures; changed signatures classify as new regressions.
- Unknown high-impact failures are surfaced as hard gates.
- Registry is an Eval artifact and cannot write production tables.

**Verification**

`node --test backend/test/eval-flywheel/known-baseline-registry.test.js`

**Stop/review checkpoint:** unrelated existing failures may be recorded; current-task regressions must remain actionable.

## Task 6 — Regression Runner

**Purpose:** Compare targeted, family, Core6 and fresh-holdout scopes with explicit partition identity.

**New files**

- `backend/src/eval/flywheel/regression-runner.js`
- `backend/test/eval-flywheel/regression-runner.test.js`

**Reuse**

- `backend/eval/requirement-production-quality-gate/run-quality-gate.js` replay/mutation conventions.
- Existing targeted/holdout runner result schemas under `backend/eval/requirement-unseen-holdout-*`.

**Interface**

- `runRegression({ scope, caseIds, familyId, evalDatasetId, baselineIdentity, currentIdentity }) -> RegressionResult[]`

**Tests first**

- Targeted case and family selection are deterministic.
- Core6 and fresh-holdout partitions cannot be silently mixed.
- Baseline identity mismatch fails closed.
- Per-check `PASS`, `FAIL`, `REVIEW_REQUIRED`, `NOT_EVALUATED` are preserved; no aggregate-only output.

**Verification**

`node --test backend/test/eval-flywheel/regression-runner.test.js`

**Stop/review checkpoint:** run only temporary fixtures; do not claim production readiness or deployment gating.

## Task 7 — One CLI entrypoint

**Purpose:** Expose trace/evaluate/import-badcases/regression/summary without a second framework.

**New files**

- `backend/eval/flywheel/runner.js`
- `backend/test/eval-flywheel/runner-cli.test.js`

**Modified file (only after review)**

- `backend/package.json` — add one `eval:flywheel` script, reusing Node ESM conventions.

**Commands**

```text
npm run eval:flywheel -- trace --module requirement --run <id>
npm run eval:flywheel -- evaluate --run <id>
npm run eval:flywheel -- import-badcases --run <id> --ledger <path>
npm run eval:flywheel -- regression --scope targeted|family|core6|holdout --run <id>
npm run eval:flywheel -- summary --run <id>
```

**Tests first**

- Argument validation and unknown command failure.
- Each command delegates to the library exactly once and writes only the requested Eval artifact directory.
- Sanitized output contains no key, authorization, raw prompt, raw provider response or unbounded source body.
- `--dry-run` or fixture root keeps tests off production DB and Provider.

**Verification**

`node --test backend/test/eval-flywheel/runner-cli.test.js`

**Stop/review checkpoint:** CLI review confirms one entrypoint, no duplicate runner, and no automatic production gate.

## Task 8 — Reproduce the 487 P0 trace through the reusable API

**Purpose:** Replace the prior bespoke trace generation with the generic tracer.

**Modified files (implementation-time only)**

- `backend/eval/flywheel/runner.js` (wire Requirement adapter)
- `backend/src/eval/flywheel/adapters/requirement.js` (only adapter-specific wiring)

**Tests first**

- Frozen source-truth file SHA remains `9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0`.
- Output contains 487 unique atom IDs and the expected artifact manifest references.
- Existing production run `V43-CORE6-20260911` and source hashes are preserved.
- Missing persisted request/response evidence remains explicitly flagged.

**Verification**

`npm run eval:flywheel -- trace --module requirement --source docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json --run V43-CORE6-20260911`

Run the command only after Tasks 0–7 review; compare generated artifact hashes to an approved baseline without overwriting prior artifacts.

**Stop/review checkpoint:** GPT/Human reviews the new trace index and manifest. No semantic metrics are recalculated by Codex.

## Task 9 — Import current 44 unsafe P0 seed (conditional)

**Purpose:** Make the current seed usable only after the exact frozen GPT/Human ledger exists.

**No code changes expected**

- `backend/src/eval/flywheel/badcase-registry.js` already supports ledger import.
- Add only a fixture/test if a ledger format gap is proven.

**Tests first**

- Exact 44 rows, atom IDs, `severity=P0`, label, author and version are required.
- Aggregate-only counts are rejected with `SEED_LEDGER_INPUT_PENDING_GPT`.
- Imported labels remain immutable and are not re-derived by evaluator.

**Verification**

`node --test backend/test/eval-flywheel/badcase-registry.test.js`

Then use the reviewed CLI import command in a temporary Eval artifact root. No production DB write.

**Stop/review checkpoint:** if the exact ledger is absent, stop with the pending-input status; do not create 44 semantic rows.

## Task 10 — Full regression, documentation and handoff

**Purpose:** Verify the foundation as a whole and publish case-level artifacts.

**Modified files**

- `backend/eval/flywheel/runner.js` only for proven wiring defects.
- `backend/package.json` only if Task 7 script was approved.
- `docs/architecture/V43_EVAL_BADCASE_FLYWHEEL_V1.md` and this plan for factual implementation notes.

**Tests first / verification**

```text
node --test backend/test/eval-flywheel/*.test.js
npm test -w backend
npm run test:postgres -w backend        # only if no production writes are exercised
npm run build
npm run lint
git diff --check
```

The full repository regression is classified by existing policy: current-task regression, pre-existing unrelated baseline, environment/fixture availability, or not determined. Unrelated failures are not repaired in this plan.

**Stop/review checkpoint:** produce a unified checkpoint with provider calls, DB writes, Gold mutations, migration count, artifact hashes, per-task status, and remaining blockers. Readiness gates remain NO unless the required GPT/Human and production governance decisions are separately complete.

## Dependency and review map

```text
Task 0 -> Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5
                                      \-> Task 6 -> Task 7
Task 7 + reviewed fixtures -> Task 8 -> Task 9 (conditional) -> Task 10
```

Each arrow is a review gate; a failed task does not authorize later tasks. No task contains a Git commit step.

## Plan self-review

- Every task has tests before implementation, exact proposed files, interfaces, command and stop checkpoint.
- The plan introduces one Eval library/CLI, not a competing evaluator, service or authority.
- Persistence is file-first; no migration is scheduled in this Decision.
- Requirement adapter is typed at the edge; generic core has no Requirement-only truth fields.
- Core6 is explicitly regression/development; fresh tenders are a distinct holdout partition.
- Semantic labels, Gold mutation, Provider calls and production writes have explicit gates and remain off by default.

## Implementation record (2026-09-11)

- Tasks 0–7 are implemented under `backend/src/eval/flywheel/` with one CLI at
  `backend/eval/flywheel/runner.js`; the only package change is the
  `eval:flywheel` script in `backend/package.json`.
- Task 8 produced the reusable P0 trace run
  `V43-FLYWHEEL-P0-487-R2` (487 unique atoms); missing persisted stages remain
  explicit `EVIDENCE_NOT_PERSISTED`.
- Task 9 was evaluated conditionally. The exact frozen 44-row ledger was not
  present, so import status is `SEED_LEDGER_INPUT_PENDING_GPT` and no semantic
  rows were fabricated.
- Task 10 focused tests are 16/16. Full backend unit regression retains only
  pre-existing unrelated baseline/fixture failures listed in
  `docs/eval/flywheel/KNOWN_BASELINE_FAILURE_REGISTRY.json`; no current-task
  regression was introduced by the flywheel.
- Provider/LLM calls, production database writes, Gold mutations, migrations,
  commits, pushes, merges and deploys remain zero.
