# V43 Structured Output Contract Parity Minimal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing Evidence Support assessment contract as a canonical task `data_schema` so the Router emits strict JSON Schema transport, with offline parity regressions that detect contract drift.

**Architecture:** Keep `packages/semantic-contracts/index.js` as the Task Router’s contract registry and add only the existing assessment output shape there. Reuse the existing backend Gateway provider schema and validators as parity authorities in tests; no new runtime service, adapter, or compatibility path is introduced.

**Tech Stack:** Node.js ESM, Node test runner, existing semantic-gateway Task Router/provider adapter, existing backend assessment/fact validators.

**Spec:** User decision `V43 STRUCTURED OUTPUT CONTRACT PARITY MINIMAL IMPLEMENTATION`.

## Global Constraints

- Provider, DeepSeek, Dify, database writes: 0.
- Do not alter Prompt, Candidate V3, Fact/Canonical semantics, retry/fallback, model, Router architecture, or unrelated tasks.
- Production modules touched: only `packages/semantic-contracts/index.js`; tests may be added/updated.
- Preserve existing dirty worktree and `backend/eval/tender-benchmark-v1/`.

### Task 1: Assessment schema transport parity

**Files:**
- Modify: `packages/semantic-contracts/index.js` near `SEMANTIC_TASK_CONTRACTS.evidence_support_assessment`.
- Test: `services/semantic-gateway/test/contract-parity.test.js`.

**Interfaces:**
- Consumes: existing assessment field lists/enums from `backend/src/pipeline/evidence-support-assessment-gateway-contract-v1.js` in tests.
- Produces: `getSemanticTaskContract('evidence_support_assessment').data_schema`, consumed by existing `deriveTaskResponseFormat()`.

- [x] **Step 1: Write failing parity tests** covering task/version, strict `json_schema`, deep equality to the existing backend provider schema, Fact schema/prompt parity, retry contract identity, legacy-key guard, and a negative drift fixture.
- [x] **Step 2: Run the focused test and observe failure** because the assessment contract currently has no `data_schema` and Router therefore has no explicit response format.
- [x] **Step 3: Add the minimal assessment `data_schema`** with the exact existing top-level, assessment, observation, conflict, enum, required-key, and additional-property constraints.
- [x] **Step 4: Run focused parity, Router, provider-adapter, Gateway, and assessment contract tests; then run syntax and diff checks.**

### Task 2: Completion verification

**Files:**
- No additional production files.

- [x] **Step 1: Reconfirm only the intended production diff was added on top of the existing dirty worktree.**
- [x] **Step 2: Report Provider/DeepSeek/Dify/database call counts as zero and preserve all unrelated user changes.**
