# V43 Fact Subject Flat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change only the provider-facing `evidence_fact_extraction` DTO from nested `subject` to flat `subject_type`/`subject_name`, then mechanically assemble the unchanged Canonical Fact subject in the existing semantic adapter.

**Architecture:** `packages/semantic-contracts` remains the sole semantic schema/instruction owner. `SemanticGatewayEvidenceFactExtractor` converts the validated flat DTO into the existing `{ type, name }` subject immediately before `EvidenceSourceFactService` invokes `createEvidenceFactContract()`. No Canonical, persistence, Mapping, lifecycle, or downstream shape changes are introduced.

**Tech Stack:** Node.js ESM, `node:test`, existing semantic gateway/task router, existing EvidenceSourceFactService and Canonical Fact contract.

**Spec:** ADR-018 and the user-provided `V43_FACT_SUBJECT_FLAT_IMPLEMENTATION_V1` decision.

## Global Constraints

- Canonical Fact Contract and `evidence_source_facts` schema remain unchanged.
- Semantic Worker emits `subject_type` and `subject_name`; Backend only assembles `{ type, name }` without inference.
- Candidate remains an ephemeral, non-authoritative DTO and is not persisted.
- Unknown top-level fields are dropped only by the existing Fact-task projection; known type/missing-field/metadata failures remain fail-closed.
- Mapping, Sufficiency, Readiness, Claim, DB schema, Human Review and all unrelated tasks remain unchanged.
- Provider use is limited to at most one synthetic positive-case request after offline and runtime behavior gates pass; retry/fallback/Dify remain zero.
- Existing dirty worktree and `backend/eval/tender-benchmark-v1/` are preserved.

### Task 1: Add RED tests for the flat DTO and mechanical assembly

**Files:**
- Modify: `services/semantic-gateway/test/task-router-response-format.test.js`
- Modify: `backend/test/evidence-fact-producer-v1.test.js`

**Interfaces:**
- Consume the current nested Fact candidate schema and `SemanticGatewayEvidenceFactExtractor` behavior.
- Produce failing assertions that require flat `subject_type`/`subject_name`, reject nested `subject` in the provider DTO, and assemble the unchanged Canonical subject through the existing adapter.

- [ ] **Step 1: Write the failing tests**

  Update the Fact task schema test fixture to use:

  ```js
  subject_type: 'product',
  subject_name: '数据交换平台'
  ```

  Add assertions that a nested `subject` candidate is rejected by
  `validateTaskData('evidence_fact_extraction', ...)`, and that a mocked
  semantic gateway response containing the flat fields is returned by the
  extractor as:

  ```js
  { subject: { type: 'product', name: '数据交换平台' }, ... }
  ```

  Add negative cases for missing, empty and non-string `subject_type`, and
  missing, empty and wrong-type `subject_name`.

- [ ] **Step 2: Run the RED tests**

  Run:

  ```powershell
  npm test --workspace backend -- backend/test/evidence-fact-producer-v1.test.js
  npm test --workspace semantic-gateway -- services/semantic-gateway/test/task-router-response-format.test.js
  ```

  Expected: failures showing the current nested schema rejects the desired
  flat DTO and the extractor does not assemble the Canonical subject.

### Task 2: Implement the minimal flat semantic contract

**Files:**
- Modify: `packages/semantic-contracts/index.js`

**Interfaces:**
- Consume the existing `EVIDENCE_FACT_CANDIDATE_SCHEMA`, instruction text and `validateEvidenceFactExtractionData`.
- Produce a strict Fact-task schema whose candidate required fields include `subject_type` and `subject_name`, while preserving every other field and existing Canonical-derived constraint.

- [ ] **Step 1: Replace only the subject projection fields**

  Remove `subject` from `EVIDENCE_FACT_CANDIDATE_SCHEMA` and add:

  ```js
  subject_type: Object.freeze({ type: 'string', minLength: 1 }),
  subject_name: nullableString,
  ```

  Add both fields to the schema `required` list. Keep the existing
  `subject.name` nullability as the Canonical contract permits a null name;
  the validator must still reject a missing key, empty string, or any
  non-string/non-null value.

  Update the Fact-task instruction to name `subject_type` and `subject_name`
  explicitly. Do not add a taxonomy or change any other semantic instruction.

- [ ] **Step 2: Update the strict validator**

  Replace the Fact candidate field list and nested-subject assertions with
  exact-key checks for `subject_type` and `subject_name`. Validate
  `subject_type` as non-empty text and validate `subject_name` as either null
  or non-empty text. Leave all other validation branches untouched.

- [ ] **Step 3: Run the contract RED tests again**

  Run the focused tests from Task 1. Expected: schema/validator assertions
  pass for flat fields, while the assembly assertion remains failing until
  Task 3.

### Task 3: Assemble the unchanged Canonical subject at the existing adapter boundary

**Files:**
- Modify: `backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js`

**Interfaces:**
- Consume validated `data.facts` with `subject_type` and `subject_name`.
- Produce Canonical-shaped candidates for the existing
  `EvidenceSourceFactService` → `createEvidenceFactContract()` boundary.

- [ ] **Step 1: Add mechanical projection after strict validation**

  After `validateTaskData(...)` succeeds and before returning facts, map each
  fact as:

  ```js
  const { subject_type, subject_name, ...rest } = fact;
  return { ...rest, subject: { type: subject_type, name: subject_name } };
  ```

  Do not infer defaults, coerce types, repair fields, or persist the flat DTO.

- [ ] **Step 2: Run the focused GREEN tests**

  Run:

  ```powershell
  npm test --workspace backend -- backend/test/evidence-fact-producer-v1.test.js
  npm test --workspace semantic-gateway -- services/semantic-gateway/test/task-router-response-format.test.js
  ```

  Expected: flat DTO validation, strict negative cases, adapter assembly,
  unknown-field projection, and existing Canonical assertions pass.

### Task 4: Run parity and downstream regression checks

**Files:**
- Inspect only; no additional production edits unless a direct regression is
  proven by the focused tests.

- [ ] **Step 1: Run Fact/domain/parity and downstream tests**

  Run:

  ```powershell
  npm test --workspace backend -- backend/test/evidence-fact-domain-metadata-parity.test.js
  npm test --workspace backend -- backend/test/evidence-fact-contract.test.js
  npm test --workspace backend -- backend/test/evidence-fact-claim-gate.test.js
  npm test --workspace backend -- backend/test/requirement-evidence-fact-mapping-contract-v1.test.js
  ```

- [ ] **Step 2: Run the semantic gateway and Fact producer suites**

  Run:

  ```powershell
  npm test --workspace semantic-gateway
  npm test --workspace backend -- backend/test/evidence-fact-producer-v1.test.js
  ```

- [ ] **Step 3: Verify invariants**

  Confirm with `git diff` that only the semantic Fact DTO/instruction,
  existing adapter projection, directly dependent tests, and this plan are
  changed; confirm no Canonical/DB/Mapping/Claim source was modified.

### Task 5: Runtime behavior gate and one synthetic Provider probe

**Files:**
- No additional source files.

- [ ] **Step 1: Check current runtime identity and local behavior probe**

  Use the existing Gateway `18082` behavior probe to verify a valid flat Fact
  candidate is accepted and assembled, while missing/wrong subject fields are
  rejected. If the running process does not expose the new behavior, stop with
  `RUNTIME_BEHAVIOR_STALE` and do not call the Provider.

- [ ] **Step 2: Make at most one synthetic Provider request**

  Only after offline and runtime probes pass, use the existing Fact Producer
  path with a non-sensitive approved Source Span. Allow exactly one request
  maximum, with no retry/fallback/Dify. Verify HTTP success, at least one
  semantic candidate, one draft machine Fact, unchanged Canonical subject and
  preserved provenance. If any new known-field schema failure appears in
  `entities`, `status`, `scopes`, `quantities` or `validity`, stop with
  `FACT_SEMANTIC_CANDIDATE_MINIMALITY_REVIEW_REQUIRED`.

### Task 6: Completion verification

- [ ] **Step 1: Run syntax and diff checks**

  ```powershell
  node --check packages/semantic-contracts/index.js
  node --check backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js
  git diff --check
  ```

- [ ] **Step 2: Confirm non-goals and worktree safety**

  Confirm Mapping/Sufficiency/Readiness/Claim/DB/Human Review are unchanged,
  no compatibility or repair path was added, Provider counts are within the
  single-probe budget, and existing dirty/untracked work is preserved.

- [ ] **Step 3: Do not commit, push, deploy, reset or clean**

  Leave the implementation and existing dirty worktree for the next decision.
