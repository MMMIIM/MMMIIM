# Gold V2 Foundation and Writer Eval Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce auditable, provider-off Gold V2 foundation artifacts for real Requirement sources, real Enterprise Fact candidates, and Writer authorization/source-role boundaries without changing production semantics.

**Architecture:** A thin Eval-only orchestration layer composes the existing Requirement source builder, enterprise source import harness, Material Authority projections, and Writer Fast Gate. New outputs are immutable snapshots/blind packets/checkpoints; no new service, migration, provider adapter, or authority-bearing database path is introduced.

**Tech Stack:** Node.js ESM, `node:test`, existing repository hash/renderer helpers, JSON/Markdown Eval artifacts.

**Spec:** `docs/superpowers/specs/2026-09-04-gold-v2-foundation-writer-eval-prep.md`

## Global Constraints

- No Provider, Dify, Embedding, LLM, or external network calls.
- No production database writes and no active Gold/Requirement/Mapping/Claim/Writer mutation.
- No new migration and no Production service/contract changes.
- Synthetic, representative, public, and private material classifications remain explicit and separate.
- Downstream artifacts only project already-authorized upstream state; they may not approve, expand, or promote authority.
- Existing unrelated baseline failures remain out of scope and must be reported, not repaired.

---

### Task 1: Thin orchestration and Requirement source foundation

**Files:**
- Create: `backend/eval/gold-governance/gold-v2-foundation-orchestrator.js`
- Create: `backend/test/gold-v2-foundation-orchestrator.test.js`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.json`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.md`
- Modify: `backend/package.json` (add Eval-only `eval:gold-v2-foundation` script)

**Interfaces:**
- Consumes: `buildArtifacts()`/`TARGET_TENDER_IDS` from `backend/eval/gold-human-review/v2/mapping-real-rebuild/build-real-gold-source-foundation.js`.
- Produces: `buildGoldV2Foundation({ now, outputDir })` returning `{ requirementSource, factCandidates, writerEval, architecture, factReconciliation, bidPilot, gates }`; no database handle is accepted.

- [ ] **Step 1: Write failing tests for source classification and side-effect guard**

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoldV2Foundation, classifyRequirementSources } from '../eval/gold-governance/gold-v2-foundation-orchestrator.js';

test('classifies the six tender source states from existing builder evidence', () => {
  const result = classifyRequirementSources({
    tenderSources: [
      { tender_id: 'FAST-01', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'TB-006', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'FAST-WATER-01', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'JY-001', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'TB-003', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'FAST-04', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true }
    ]
  });
  assert.deepEqual(result, { 'FAST-01': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'TB-006': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'FAST-WATER-01': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'JY-001': 'B_HUMAN_RECONSTRUCTION_POSSIBLE', 'TB-003': 'B_HUMAN_RECONSTRUCTION_POSSIBLE', 'FAST-04': 'B_HUMAN_RECONSTRUCTION_POSSIBLE' });
});

test('orchestration is Eval-only and records zero writes/calls', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-'));
  const result = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z', outputDir });
  assert.equal(result.provider_calls, 0);
  assert.equal(result.db_writes, 0);
  assert.equal(result.gold_mutations, 0);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test backend/test/gold-v2-foundation-orchestrator.test.js`

Expected: FAIL because the orchestration exports and source classifier do not yet exist.

- [ ] **Step 3: Implement deterministic orchestration and source classification**

Implement these exact exports:

```js
export const FOUNDATION_TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
export function classifyRequirementSources({ tenderSources = [] } = {});
export function buildGoldV2Foundation({ now = new Date().toISOString(), outputDir } = {});
```

`classifyRequirementSources` returns `A_AUTHORITATIVE_PACKET_RECOVERED` only when packet, source file, source hash match, and official source verification are all true. A source file without an authoritative packet returns `B_HUMAN_RECONSTRUCTION_POSSIBLE` only when deterministic identity is intact; otherwise return `C_REEXTRACTION_REQUIRED` for an existing but unusable source and `D_SOURCE_INSUFFICIENT_OR_BLOCKED` when no safe source identity exists. The orchestrator invokes the existing builder, writes only checkpoint/report files under its Eval output directory, and sets `provider_calls`, `db_writes`, and `gold_mutations` to zero.

- [ ] **Step 4: Run focused tests and the existing source builder**

Run: `node --test backend/test/gold-v2-foundation-orchestrator.test.js`

Run: `node backend/eval/gold-governance/gold-v2-foundation-orchestrator.js`

Expected: PASS; three A rows and the existing missing-tender rows remain blocked; no external call/write occurs.

- [ ] **Step 5: Add the package script and verify artifact hashes**

Add `"eval:gold-v2-foundation": "node eval/gold-governance/gold-v2-foundation-orchestrator.js"` to `backend/package.json`. Assert every generated JSON/Markdown file has deterministic content for a fixed `now` and that the source builder's existing packet SHA values are unchanged.

### Task 2: Real Enterprise Fact V2 candidate manifest and blind packet

**Files:**
- Create: `backend/eval/gold-governance/real-fact-v2-foundation.js`
- Create: `backend/test/real-fact-v2-foundation.test.js`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.json`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.md`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.md`

**Interfaces:**
- Consumes: `SOURCE_CANDIDATES`, `validateSourceManifest()`, `buildImportPlan()` and `assertEnterpriseIsolation()` from `real-enterprise-source-import-harness.js`; existing Material Authority projection artifacts.
- Produces: `buildRealFactV2Foundation({ candidates, snapshots = new Map(), outputDir })` returning `{ manifest, blindPacket, eligibleCount, rejectionAudit, provider_calls: 0, db_writes: 0 }`.

- [ ] **Step 1: Write failing admission, rejection, and blindness tests**

```js
test('synthetic, quarantined, identity-missing, and requirement-derived sources are rejected', () => {
  const report = buildRealFactV2Foundation({ candidates: [
    { source_id: 'SYN', enterprise_id: 'E', enterprise_name: 'E', source_type: 'official_product_documentation', material_type: 'product_documentation', expected_source_authority: 'corporate_primary', synthetic_test_material: true },
    { source_id: 'QUAR', enterprise_id: 'E', enterprise_name: 'E', source_type: 'official_project_case', material_type: 'project_case', expected_source_authority: 'corporate_primary', lifecycle: 'QUARANTINED' },
    { source_id: 'REQ', enterprise_id: '', enterprise_name: '', source_type: 'requirement_derived', material_type: 'other', expected_source_authority: 'unknown' }
  ] });
  assert.equal(report.eligibleCount, 0);
  assert.ok(report.rejectionAudit.every(row => row.status !== 'SOURCE_READY_FOR_GPT_REVIEW'));
});

test('blind packet contains source identity but no expected/provider/production fields', () => {
  const report = buildRealFactV2Foundation({ candidates: [] });
  assert.equal(report.blindPacket.expected_decision, undefined);
  assert.equal(report.blindPacket.provider_result, undefined);
  assert.equal(report.db_writes, 0);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `node --test backend/test/real-fact-v2-foundation.test.js`

Expected: FAIL because the candidate foundation module is absent.

- [ ] **Step 3: Implement mechanical candidate foundation**

Implement exact exports:

```js
export const REAL_FACT_V2_SCHEMA_VERSION = 'v43-real-fact-v2-foundation-v1';
export function buildRealFactV2Foundation({ candidates = [], snapshots = new Map(), outputDir } = {});
```

For each candidate, require non-synthetic, non-quarantined lifecycle, resolved enterprise identity, authority eligibility, and a stable snapshot hash. Call the existing harness for mechanical validation and chunk identity preview only. Label complete sources `SOURCE_READY_FOR_HUMAN_FACT_REVIEW`, never `FACT_READY`. Emit `CORPUS_GAP` for unavailable source classes. Blind packets must contain no expected answer, Provider output, or Production result.

- [ ] **Step 4: Run focused tests and inspect manifest counts**

Run: `node --test backend/test/real-fact-v2-foundation.test.js`

Run: `node backend/eval/gold-governance/real-fact-v2-foundation.js`

Expected: PASS; current metadata-only candidates produce `REAL_FACT_V2_ELIGIBLE_CANDIDATES=0` unless a complete immutable snapshot is already present; zero Provider/DB writes.

### Task 3: Writer Provider-Off and Source Role Boundary Eval

**Files:**
- Create: `backend/eval/gold-governance/writer-eval-provider-off-foundation.js`
- Create: `backend/test/writer-eval-provider-off-foundation.test.js`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md`

**Interfaces:**
- Consumes: `runWriterFastGate()` from `backend/eval/rag-pilot/writer-fast-gate-v1.js`, `guardCriticalAssertions()`/`validateWriterOutput()` from `writer-execution-contract-v1.js`, and existing Writer Authorization/Safe Context fixture shapes.
- Produces: `runWriterProviderOffFoundation({ outputDir })` returning `{ semanticCases, engineeringCases, sourceRoleBoundary, metrics, provider_calls: 0, db_writes: 0, status }`.

- [ ] **Step 1: Write failing tests for six source-role cases and mutations**

```js
test('reference context can enrich design but cannot authorize enterprise assertions', () => {
  const result = runWriterProviderOffFoundation();
  assert.equal(result.sourceRoleBoundary.ENTERPRISE_EVIDENCE_ASSERTABLE_PASS, 'PASS');
  assert.equal(result.sourceRoleBoundary.REFERENCE_SOLUTION_DESIGN_PASS, 'PASS');
  assert.equal(result.sourceRoleBoundary.REFERENCE_TO_ENTERPRISE_ASSERTION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.FOREIGN_ENTERPRISE_IDENTITY_CONTAMINATION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.REFERENCE_STRONG_FACT_PROMOTION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.MIXED_ASSERTABLE_REFERENCE_BOUNDARY, 'FAIL_CLOSED');
});

test('unsupported quantity, entity, status, scope, SLA, certification and case mutations fail closed', () => {
  const result = runWriterProviderOffFoundation();
  assert.ok(result.mutationCases.every(row => row.expected === 'failed' && row.actual !== 'pass'));
  assert.equal(result.provider_calls, 0);
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test backend/test/writer-eval-provider-off-foundation.test.js`

Expected: FAIL because the provider-off foundation wrapper and source-role fixtures are absent.

- [ ] **Step 3: Implement deterministic fixtures and metrics**

Implement exact export:

```js
export function runWriterProviderOffFoundation({ outputDir } = {});
```

Reuse Fast Gate construction rather than modifying it. Add six source-role fixtures with explicit `assertable_claims` and `reference_materials`; route all outputs through `buildWriterTask`, `validateWriterOutput`, and `guardCriticalAssertions`. Add the nine mutation dimensions listed in the spec. Report `REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE` and `FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE` as ratios over their deterministic cases. Keep `W-AUTH-RETENTION-001` and `W-IDEMPOTENCY-AUTH-001` in `engineeringCases` only and exclude them from semantic denominator. Never inspect or store raw Provider content.

- [ ] **Step 4: Run focused Writer tests and existing Fast Gate regression**

Run: `node --test backend/test/writer-eval-provider-off-foundation.test.js backend/test/writer-overnight.test.js`

Expected: PASS with `provider_calls=0`, all hard-safety and source-role boundary controls passing.

### Task 4: Read-only materialization, unified checkpoint, and regression gate

**Files:**
- Create: `backend/eval/gold-governance/architecture-materialization.js`
- Create: `backend/eval/gold-governance/fact-control-reconciliation.js`
- Create: `backend/eval/gold-governance/bid-pilot-read-only-foundation.js`
- Modify: `backend/eval/gold-governance/gold-v2-foundation-orchestrator.js` (compose the three reports and final gates)
- Modify: `backend/test/gold-v2-foundation-orchestrator.test.js` (integration assertions)
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json`
- Create: `backend/eval/gold-governance/v43-gold-v2-foundation/V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.md`

**Interfaces:**
- Consumes: Track 1–3 reports and existing Track A closure/path manifests, Fact/Mapping/Writer checkpoints, and read-only Bid Pilot fixtures.
- Produces: one unified checkpoint with the seven foundation statuses and five readiness gates, each tied to actual artifact/test evidence.

- [ ] **Step 1: Write failing integration tests for boundary and gate derivation**

```js
test('unified checkpoint does not infer readiness from design intent', () => {
  const report = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z' });
  assert.equal(report.gates.SAFE_TO_FREEZE_REAL_FACT_V2, 'NO');
  assert.equal(report.gates.SAFE_TO_RUN_WRITER_LIVE_EVAL, 'NO');
  assert.equal(report.gates.SAFE_TO_START_BID_PILOT_HITL, 'NO');
  assert.equal(report.architecture.status, 'PASS');
  assert.equal(report.factReconciliation.status, 'PASS');
  assert.equal(report.bidPilot.status, 'PASS');
});

test('production boundary is unchanged and all side effects remain zero', () => {
  const report = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z' });
  assert.equal(report.provider_calls, 0);
  assert.equal(report.db_writes, 0);
  assert.equal(report.production_files_changed, 0);
  assert.equal(report.gold_mutations, 0);
});
```

- [ ] **Step 2: Run integration tests to verify failure**

Run: `node --test backend/test/gold-v2-foundation-orchestrator.test.js`

Expected: FAIL until read-only reports and gate derivation are wired.

- [ ] **Step 3: Implement read-only reports and explicit gate derivation**

Each report must cite paths/tests and classify only with the allowed status vocabulary. `SAFE_TO_START_HUMAN_FACT_V2_REVIEW` is `YES` only if at least one eligible source has a fixed snapshot and the blind packet passes; `SAFE_TO_FREEZE_REAL_FACT_V2` remains `NO` because no human Fact authority is created here; `SAFE_TO_BUILD_MAPPING_GOLD_V2` remains `NO` unless the existing Mapping prerequisites are independently present and no source gap is hidden; `SAFE_TO_RUN_WRITER_LIVE_EVAL` remains `NO` until a later Gold V2/provider authorization decision; `SAFE_TO_START_BID_PILOT_HITL` remains `NO` because this task is read-only. Record `TRACK_A_REMEDIATION=CLOSED` from its existing checkpoint without rewriting it.

- [ ] **Step 4: Run the complete deterministic validation set**

Run in order:

1. `node --test backend/test/gold-v2-foundation-orchestrator.test.js backend/test/real-fact-v2-foundation.test.js backend/test/writer-eval-provider-off-foundation.test.js`
2. `npm run eval:gold-v2-foundation -w backend`
3. `npm test`
4. `npm run test:postgres -w backend`
5. `npm run eval:requirements -w backend`
6. `npm run build`
7. `npm run lint`
8. `git diff --check`

Expected: focused tests and all deterministic checks pass; any known unrelated baseline failures are recorded without scope expansion. Provider calls, production writes, Gold mutations, and new migrations remain zero.

- [ ] **Step 5: Final checkpoint review**

Inspect the unified JSON/Markdown checkpoint and confirm it reports:

`REQUIREMENT_REAL_SOURCE_FOUNDATION`, `REAL_ENTERPRISE_FACT_V2_FOUNDATION`,
`REAL_FACT_V2_ELIGIBLE_CANDIDATES`, `WRITER_EVAL_PROVIDER_OFF_FOUNDATION`,
`ARCHITECTURE_MATERIALIZATION`, `FACT_CONTROL_RECONCILIATION`,
`BID_PILOT_READ_ONLY_FOUNDATION`, all five readiness gates, and explicit zero
Provider/DB/Gold/Production side effects. Stop and return the decision; do not
commit, push, merge, deploy, or start Gold adjudication/Writer live/Bid Pilot
HITL.
