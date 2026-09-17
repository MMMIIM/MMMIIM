# Requirement Minimal Coverage Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute the frozen 21 Requirement source-side misses and seven output-side P1 cases offline, apply at most two evidence-backed deterministic fixes, and produce independently reproducible readiness checkpoints without Provider, database, Gold, or downstream changes.

**Architecture:** Reuse the production Requirement parser/chunker, scope router, semantic-window metadata, `SourceLocationResolver`, canonicalizer, and existing report artifacts. The new work is Eval-only orchestration: it joins source, retained-input, candidate, resolver, canonical, and alignment evidence; it never creates Requirement authority. A deterministic fix is allowed only after Checkpoint A proves S0/S1/S3/S4 ownership; S2 or missing evidence stops semantic remediation.

**Tech Stack:** Node.js ESM, existing Requirement pipeline modules, JSON/JSONL/Markdown artifacts, SHA-256 identities, Node test runner, existing build/lint scripts.

**Spec:** `C:/Users/WINDOWS/.codex/attachments/1778e93f-be66-468e-8e77-c896bb514e68/pasted-text.txt`

## Global Constraints

- Preserve branch `feat/v4.3-semantic-boundary-routing`, HEAD `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`, and the dirty worktree; never reset, clean, stash, restore, rebase, overwrite checkout, commit, push, merge, deploy, or modify unrelated baseline failures.
- Provider calls remain `0`; Requirement live calls, Fact, Mapping, Claim, Writer calls remain `0`; Production DB writes and Gold mutations remain `0`.
- Do not modify Requirement Prompt, candidate schema, canonical contract, Provider/model/config, Gold, migrations, downstream Fact/Mapping/Claim/Writer/Bid Pilot, or create a new holdout.
- Reuse production source identity and resolver logic; never fabricate source text, expected labels, candidate output, or recovery.
- The 21 misses plus seven P1 cases are the development cohort and must not be reused as unseen holdout evidence.

### Task 1: Offline miss inventory and Checkpoint A attribution

**Files:**
- Create: `backend/eval/requirement-production-quality-gate/attribute-21-source-misses.mjs`
- Create: `backend/test/requirement-miss-attribution.test.js`
- Create: `docs/V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION.json`
- Create: `docs/V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION_CHECKPOINT.md`

**Interfaces:**
- `loadMissCohort({ repoRoot })` returns only the persisted 21-case miss manifest; it fails closed when no authoritative miss list exists.
- `attributeMiss({ miss, artifacts, productionModules })` returns exactly one of `S0_SOURCE_SCOPE_MISS`, `S1_INPUT_CONTEXT_DAMAGE`, `S2_GENUINE_MODEL_SEMANTIC_MISS`, `S3_POST_MODEL_FILTER_LOSS`, `S4_CANONICAL_MERGE_DEDUP_LOSS`, `S5_EVAL_ALIGNMENT_ERROR`, or `UNRESOLVED_ARTIFACT_LIMITATION` plus evidence fields.
- `buildAttributionCheckpoint(report)` records S0–S5/UNRESOLVED counts, dominant/secondary cause, side-effect counters, and stop/readiness state.

- [x] **Step 1: Write failing tests** for missing authoritative 21-case manifest, unique classification, evidence-required fields, no fabricated provider input/output, and deterministic dominant-root-cause calculation.
- [x] **Step 2: Run the focused test** and confirm it fails because no persisted 21-case manifest is available or the attribution module is absent; record the exact missing artifact in the test output.
- [x] **Step 3: Implement the Eval-only joiner** over the known source PDFs/indices, `V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL*.jsonl`, historical retained-input/candidate/canonical reports, and production resolver/canonicalizer. If an expected ID/label cannot be located, emit `UNRESOLVED_ARTIFACT_LIMITATION` with the missing path instead of inventing a case.
- [x] **Step 4: Generate Checkpoint A** and verify `PROVIDER_CALLS=0`, `PRODUCTION_DB_WRITES=0`, `GOLD_MUTATIONS=0`, and that source/candidate/canonical hashes match their existing manifests.
- [x] **Step 5: Independently review Task 1** against the spec: no semantic rejudgement, exactly one classification per known case, and no root-cause claim from an unavailable artifact. Review result: blocked, because the authoritative 21-case manifest is absent.

**Task 1 stop condition:** Checkpoint A is `BLOCKED_ARTIFACT_INCOMPLETE`; all 21 slots are `UNRESOLVED_ARTIFACT_LIMITATION`. Tasks 2–4 must not infer a deterministic root cause or modify production code until the manifest is supplied.

### Task 2: Evidence-gated deterministic remediation (only if Checkpoint A permits)

**Files:**
- Modify only the owning deterministic module proven by Task 1, selected from: `backend/src/pipeline/requirement-scope-router.js`, `backend/src/pipeline/requirement-chunker.js`, `backend/src/pipeline/section-context-builder.js`, `backend/src/pipeline/canonical-requirements.js`, `backend/src/verification/requirement-extraction-verifier.js`.
- Create or modify focused tests beside the proven owner, such as `backend/test/requirement-scope-router.test.js`, `backend/test/requirement-chunker-v2.test.js`, `backend/test/requirement-source-resolution.test.js`, `backend/test/requirement-extraction-contract-owner.test.js`.
- Create: `docs/V43_REQUIREMENT_MINIMAL_REMEDIATION_CHECKPOINT.json`
- Create: `docs/V43_REQUIREMENT_MINIMAL_REMEDIATION_CHECKPOINT.md`

**Interfaces:**
- Any fix must be a generic deterministic rule over existing structural metadata; no case ID, tender ID, expected text, or prompt-specific branch.
- Cross-window provenance fixes must union authoritative source refs before deduplication; confirmation fixes must derive only from the frozen explicit pending reasons.

- [ ] **Step 1: Select at most two closely related deterministic owners** from the measured S0/S1/S3/S4 counts; if S2 is dominant, or evidence is unresolved, stop with a no-patch checkpoint.
- [ ] **Step 2: Write red tests** for the measured failure at the real production entry boundary and for the matching negative control (unknown fields, unrelated sections, incomplete source, or unsupported confirmation ambiguity).
- [ ] **Step 3: Implement the smallest generic rule** in the owning module, preserving Prompt, schema, authority, source lineage, and canonical IDs.
- [ ] **Step 4: Run the focused red/green tests** plus existing parser/chunker/router/window/source-resolver/canonicalizer suites; stop after one remediation cycle if the measured defect remains.
- [ ] **Step 5: Write Checkpoint B** with before/after routed block/window counts, workload growth, changed production components, and zero Provider/DB/Gold side effects.
- [ ] **Step 6: Independently review Task 2** for generic behavior, no case-specific hardcode, and no semantic producer change.

### Task 3: Known-cohort regression and optional structural coverage evaluator

**Files:**
- Create only if Task 1 proves silent omission of source-bearing obligation blocks: `backend/eval/requirement-production-quality-gate/requirement-coverage-evaluator.js`, `backend/test/requirement-coverage-evaluator.test.js`, and Eval-only coverage artifacts.
- Create: `backend/eval/requirement-production-quality-gate/run-minimal-coverage-regression.mjs`
- Create: `docs/V43_REQUIREMENT_KNOWN_COHORT_REGRESSION.json`
- Create: `docs/V43_REQUIREMENT_KNOWN_COHORT_REGRESSION.md`

**Interfaces:**
- `runKnownCohortRegression({ repoRoot })` replays 21 miss records, seven P1 records, and 10–20 stable controls through offline production-equivalent deterministic stages.
- `evaluateCoverageBlock({ block, metadata, canonicalRequirements })` returns only `COVERED` or `POSSIBLY_UNCOVERED`/`REVIEW_REQUIRED`; it never generates, promotes, or persists Requirements.

- [ ] **Step 1: Write tests** for recovery-stage accounting, stable controls, P0/source-traceability/duplicate/schema gates, cohort separation, and the evaluator’s high-recall review-only output.
- [ ] **Step 2: Run the focused regression** before any evaluator implementation and classify each failure as current-task, pre-existing unrelated baseline, fixture/environment, or not determined.
- [ ] **Step 3: Implement the evaluator only if the attribution evidence proves it is justified;** otherwise record `NOT_NEEDED` and do not create the module.
- [ ] **Step 4: Run the known cohort and stable controls** without Provider or DB access; emit per-case `expected_id → recovered canonical id / not recovered`, source refs, and recovery stage.
- [ ] **Step 5: Write Checkpoint C** and independently review that engineering regressions are not semantic Gold and that S2 cases remain blocked from prompt/model changes.

### Task 4: Readiness Checkpoint D and final verification

**Files:**
- Create: `docs/V43_REQUIREMENT_MINIMAL_COVERAGE_HARDENING_CHECKPOINT.json`
- Create: `docs/V43_REQUIREMENT_MINIMAL_COVERAGE_HARDENING_CHECKPOINT.md`
- Create only if not already present and justified by the plan: `docs/V43_REQUIREMENT_UNSEEN_HOLDOUT_V2_SPEC.md`

- [ ] **Step 1: Run remaining offline focused suites** (parser/chunker/router/window/table/source resolver/canonical/dedup/confirmation), then build, lint, and `git diff --check`; classify unrelated failures without fixing them.
- [ ] **Step 2: Verify artifact hashes, branch/HEAD/status, Provider/DB/Gold counters, and no downstream actions.**
- [ ] **Step 3: Derive readiness from measured Checkpoints A–C only.** `READY_FOR_SMALL_CONTROLLED_LIVE` and `READY_FOR_UNSEEN_HOLDOUT_V2` remain `NO` when attribution is unresolved, S2-dominant, any P0 escapes, or current regressions remain.
- [ ] **Step 4: Perform the independent final review** for spec/plan compliance, production parity, deterministic credibility, source authority, artifact consistency, and side-effect zero; stop with blockers and do not enter Fact/Mapping/Claim/Writer/Bid Pilot.

**Final verification commands:**
```powershell
node --test backend/test/requirement-miss-attribution.test.js
npm test
npm run build
npm run lint
git diff --check
```
