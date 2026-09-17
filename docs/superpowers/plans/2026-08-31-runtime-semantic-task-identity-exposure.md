# Runtime Semantic Task Identity Exposure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Semantic Gateway `/info` observer to expose identities derived from the registered runtime semantic task contracts without adding a new authority or changing provider behavior.

**Architecture:** Keep `packages/semantic-contracts` as the only contract source of truth. Build the existing runtime task registry view from those registered contracts, derive stable hashes from the actual schema objects, and have `/info` read that view without hardcoded task names or mutable state.

**Tech Stack:** Node.js ESM, built-in `node:test`, `node:crypto`, HTTP gateway tests.

**Spec:** `V43_RUNTIME_SEMANTIC_TASK_IDENTITY_EXPOSURE_V1` (user-provided task specification)

## Global Constraints

- `/info` remains observability-only and has no authority or persistence.
- Canonical Requirement, Evidence Fact, Mapping, downstream contracts, and Provider behavior remain unchanged.
- No new service, Contract Registry Service, Runtime Manager, database table, mock endpoint, or dynamic contract switching.
- Existing `/info` fields remain backward compatible; `semantic_tasks` is additive.
- Runtime identity is derived from registered contract objects; no hardcoded contract versions or hashes.
- Hashes use stable serialization so object key insertion order cannot cause drift.
- Provider, DeepSeek, and Dify calls remain zero.
- No commit, push, deploy, reset, or clean; preserve dirty worktree and benchmark fixtures.

---

### Task 1: Add failing `/info` and stable-hash tests

**Files:**
- Modify: `services/semantic-gateway/test/gateway.test.js`
- Modify: `services/semantic-gateway/test/provider-adapter.test.js` (or a focused existing registry test if the stable-hash helper is already imported there)

**Interfaces:**
- Expected `/info.semantic_tasks` map is derived from registered task contracts.
- Expected identity fields are `contract_version`, `candidate_schema_sha256` (nullable where no candidate schema exists), `task_data_schema_sha256`, and `instruction_hash` (or `NOT_AVAILABLE`).
- Stable hash helper must return the same digest for semantically identical objects with different key insertion order.

- [ ] **Step 1: Write the failing `/info` identity test**

Add a test using the existing `withGateway` helper that requests `/info` and asserts:

```js
assert.equal(info.semantic_tasks.evidence_fact_extraction.contract_version, '4.3-evidence-fact-extraction-v1');
assert.equal(info.semantic_tasks.evidence_fact_extraction.candidate_schema_sha256, 'c1068e6251131f3218419ae2e3ef6f0b2ef529d6740d59799d7232031948c3ee');
assert.equal(info.semantic_tasks.evidence_fact_extraction.task_data_schema_sha256, '2cc97797765c5f1892ac91b2109e15549aedeb23736a786e5189735a1c23713d');
assert.match(info.semantic_tasks.evidence_fact_extraction.instruction_hash, /^[a-f0-9]{64}$/);
assert.ok(info.semantic_tasks.requirement_extraction);
```

- [ ] **Step 2: Write the failing registry-driven test**

Use the existing gateway construction seam (without adding an HTTP endpoint) to supply a synthetic registered contract to the `/info` identity builder and assert that the synthetic task appears automatically. The assertion must not modify a production task-name list.

- [ ] **Step 3: Write the failing stable-hash test**

Assert that two objects with the same semantic content but different insertion order produce equal hashes, and that changing a schema value changes the digest.

- [ ] **Step 4: Run only the new tests and verify RED**

Run:

```powershell
npm test -w semantic-gateway -- --test-name-pattern "semantic task identity|stable schema hash|registry-driven"
```

Expected: failures because `semantic_tasks` and the stable runtime identity derivation do not yet exist.

### Task 2: Derive identities from the canonical registered contracts

**Files:**
- Modify: `packages/semantic-contracts/index.js`
- Modify: `backend/src/pipeline/semantic-gateway-task-registry.js`
- Modify: `services/semantic-gateway/src/gateway.js`
- Modify: `services/semantic-gateway/src/task-router.js` only if an existing registry seam must be shared without changing dispatch behavior

**Interfaces:**
- Export one minimal stable serialization/hash helper from `packages/semantic-contracts/index.js`.
- Extend the existing registry view with the actual `data_schema` and candidate-item schema references derived from each contract; do not duplicate schema definitions.
- `/info` reads the registry view and returns an additive `semantic_tasks` object.

- [ ] **Step 1: Add the minimal stable serialization/hash helper**

Implement a recursive key-sorting serializer and SHA-256 function in `packages/semantic-contracts/index.js`, preserving array order and primitive values. Export it for registry identity use. Do not create a registry service or alter contract objects.

- [ ] **Step 2: Extend the existing registry entries from contract objects**

When building `SEMANTIC_GATEWAY_TASK_REGISTRY`, retain the existing fields and attach non-mutating references to `contract.data_schema` plus the derived candidate item schema when the task data schema is an array property. The registry must still be generated by `SEMANTIC_TASK_TYPES.map(...)`.

- [ ] **Step 3: Add a registry identity projection helper**

Derive, per registered task, `contract_version`, `task_data_schema_sha256` from the actual task `data_schema`, `candidate_schema_sha256` from the actual array item schema when present (otherwise `null`), and `instruction_hash` when present (otherwise `NOT_AVAILABLE`). Never hardcode task names, versions, or hashes in the handler.

- [ ] **Step 4: Add additive `/info.semantic_tasks` output**

In the existing `/info` branch, iterate the runtime registry identity projection and add only the new `semantic_tasks` field. Preserve every existing `/info` field and do not expose schema bodies, prompt text, secrets, or payloads.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the same focused command from Task 1. Expected: all new identity and stable-hash tests pass.

### Task 3: Runtime and regression verification

**Files:**
- Modify: `services/semantic-gateway/test/gateway.test.js` only if assertions need a focused backward-compatibility or security check

- [ ] **Step 1: Verify existing `/info` compatibility and security**

Run the complete Semantic Gateway test suite and confirm existing Requirement identity fields, revision, working-tree metadata, provider/model fields, and secret-absence assertions remain passing.

- [ ] **Step 2: Run relevant backend contract/registry tests**

Run the existing semantic gateway task registry, Fact contract, and parity tests; confirm Canonical Fact remains nested while only the model-facing semantic candidate identity is observed.

- [ ] **Step 3: Run syntax and diff checks**

Run:

```powershell
node --check packages/semantic-contracts/index.js
node --check services/semantic-gateway/src/gateway.js
node --check backend/src/pipeline/semantic-gateway-task-registry.js
git diff --check
```

- [ ] **Step 4: Restart only Semantic Gateway and verify live `/info`**

Use the existing project runtime restart path only if needed to load the changed observer. Verify `/health=200`, `/ready=200`, and that `semantic_tasks.evidence_fact_extraction` reports the worktree-derived contract version and hashes. Do not invoke `/workflows/run` or any Provider.

- [ ] **Step 5: Completion check**

Confirm no production semantic behavior, provider configuration, persistence, downstream contract, or Human Review lifecycle changed; the worktree remains dirty only with pre-existing/task-scoped changes and `backend/eval/tender-benchmark-v1/` remains preserved.
