# Requirement Source Parity and Source-First Fact Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a deterministic six-tender source-authority parity manifest and an Eval-only, requirement-blind Fact inventory without changing frozen Production/Gold semantics.

**Architecture:** A successor resolver reads the existing frozen/recovery packets, validates source and canonical identities, and emits a new parity report without mutating historical manifests. A source-first inventory auditor classifies current material authority lanes and only invokes the already-wired `SemanticGatewayEvidenceFactExtractor` when a legally eligible, review-backed window exists; otherwise it records a fail-closed blocker and emits empty candidate/raw artifacts. All artifacts are Eval/docs only.

**Tech Stack:** Node.js ESM, JSON/Markdown artifacts, SHA-256 via `node:crypto`, existing Jest/Vitest-compatible Node tests, existing semantic gateway contracts.

**Spec:** `C:/Users/WINDOWS/.codex/attachments/5ce315c0-ca77-4cc1-b600-2f7d704a9ae0/pasted-text.txt`

## Global Constraints

- Branch remains `feat/v4.3-semantic-boundary-routing`; preserve the dirty worktree.
- No reset, clean, stash, restore, rebase, checkout overwrite, commit, push, merge, deploy, or Production DB writes.
- Do not modify Requirement, Mapping, Claim, Writer, Gold, Retriever, migration, or Provider configuration semantics.
- Provider calls are limited to `evidence_fact_extraction`; no Requirement/Mapping/Claim/Writer/Gold calls and no fabricated fallback.
- Keep Real, Synthetic, Reference, Quarantined, and Unknown material lanes separate; no authority escalation.

### Task 1: Six-tender source parity successor

**Files:**
- Create: `backend/eval/gold-governance/requirement-source-parity-v2.js`
- Create: `backend/test/requirement-source-parity-v2.test.js`
- Create: `docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_MANIFEST.json`
- Create: `docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.json`
- Create: `docs/V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.md`

**Interfaces:**
- `resolveSixTenderSourceParity({ repoRoot })` returns six deterministic tender rows plus gate counts.
- `buildSuccessorManifest({ repoRoot })` returns a stable JSON-safe manifest.
- `renderParityCheckpoint(report)` returns Markdown without Requirement text or Gold labels.

- [x] **Step 1: Write failing tests** for six IDs, actual source SHA verification, packet SHA verification, canonical linkage, wrong-SHA failure, unknown-tender fail-closed, and old-manifest immutability.
- [x] **Step 2: Run** `node --test backend/test/requirement-source-parity-v2.test.js` and confirm failure because the successor module is absent.
- [x] **Step 3: Implement** deterministic packet selection (recovery packets for JY-001/TB-003/FAST-04, frozen packets for FAST-01/TB-006/FAST-WATER-01), path resolution, byte SHA checks, packet/tender checks, and canonical-input source-hash/count checks. Never rewrite source packets or generate Requirements.
- [x] **Step 4: Run the focused test and generate the three parity artifacts; require `6/6`, zero hash mismatch, zero unresolved source, and zero fabricated source before marking PASS.** Result: 4/4 focused tests; parity 6/6.

### Task 2: Source-first Fact inventory audit

**Files:**
- Create: `backend/eval/gold-governance/source-first-fact-inventory-v1.js`
- Create: `backend/test/source-first-fact-inventory-v1.test.js`
- Create: `docs/V43_RAG_FACT_SOURCE_INVENTORY.json`
- Create: `docs/V43_RAG_SOURCE_FIRST_FACT_CANDIDATES.json`
- Create: `docs/V43_RAG_FACT_QUALITY_AUDIT.json`
- Create: `docs/V43_RAG_FACT_EXTRACTION_RAW_RESPONSES.jsonl`
- Create: `docs/V43_RAG_FACT_INVENTORY_CHECKPOINT.json`
- Create: `docs/V43_RAG_FACT_INVENTORY_CHECKPOINT.md`

**Interfaces:**
- `classifyMaterialLanes(projection)` returns separate real/synthetic/reference/quarantined/unknown arrays.
- `buildFactInventory({ projection, repoRoot, extractor })` returns inventory metrics and zero-side-effect disposition rows.
- `renderFactInventoryCheckpoint(report)` returns the required checkpoint fields.

- [x] **Step 1: Write failing tests** for lane separation, reference/quarantine/synthetic exclusion, requirement-blind payload assertion, no eligible review-backed windows, traceability accounting, and deterministic replay of post-processing.
- [x] **Step 2: Run** `node --test backend/test/source-first-fact-inventory-v1.test.js` and verify the missing module failure.
- [x] **Step 3: Implement** an Eval-only auditor that reads `00_source_role_projection.json` and the current Fact contract metadata, reports the existing gateway-backed producer, creates no fake Review/Requirement/DB row, and emits an empty candidate/raw set when no authority-eligible review-backed source window exists. If a valid window is present, call only the injected existing extractor and retain safe audit metadata, never raw secrets or Requirement fields.
- [x] **Step 4: Run focused tests and generate all inventory artifacts with explicit `FACT_INVENTORY_COMPLETE` and readiness states derived from dispositions.** Result: 3/3 focused tests; inventory remains blocked with zero candidates.

### Task 3: Integrated verification and checkpoint review

**Files:**
- Modify only the newly created Task 1/2 artifact generators if a test proves their output inconsistent; do not modify Production modules.

- [x] **Step 1: Run focused source-parity, Fact, Material Authority/quarantine, source identity/hash, Requirement canonical, and relevant RAG tests.** Result: 99/99 pass.
- [x] **Step 2: Run `npm run build`, `npm run lint`, and `git diff --check`; classify unrelated baseline or unavailable-PostgreSQL failures without fixing them.** Build, lint, and diff-check pass; Docker/PostgreSQL unavailable; root suite retains pre-existing governance/fixture/path failures.
- [x] **Step 3: Verify artifact hashes, side-effect counters, branch/HEAD/worktree, and that no Mapping/Claim/Writer/Gold/Coverage action occurred.** Provider calls, DB writes, and Gold mutations are all zero.
- [x] **Step 4: Write the final checkpoint only from measured artifacts/tests; stop with Fact inventory handed to GPT for breadth/depth/quality assessment.** Final verdict remains source-authority blocked.
