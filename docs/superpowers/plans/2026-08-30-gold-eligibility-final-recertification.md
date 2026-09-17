# Requirement Extraction V3.1 Gold Eligibility Final Recertification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evaluation-only Gold Eligibility boundary that quarantines source-ambiguous cases, recomputes semantic certification from the existing 199-case artifacts, and leaves historical Gold and production behavior untouched.

**Architecture:** A small evaluation helper consumes only the Source Authority Audit classification and exposes eligibility plus deterministic eligible-only aggregation. A recertification script reads the frozen packets and historical semantic adjudication, writes new certification-facing artifacts under ignored reports, and never rewrites historical artifacts or invokes a Provider.

**Tech Stack:** Node.js ES modules, `node:test`, JSON artifacts, SHA-256 identity checks.

**Spec:** `REQX_V311_GOLD_ELIGIBILITY_GATE_AND_FINAL_RECERTIFICATION_V1` (user-provided decision).

## Global Constraints

- Provider, DeepSeek, and Dify calls remain `0`.
- `SOURCE_AMBIGUOUS` is not evaluable Gold and is excluded from semantic denominators and freeze consequences.
- The frozen dataset remains 199 cases; only the certification-facing eligible denominator becomes 198.
- Historical Gold packets, historical live/certification artifacts, Prompt, Candidate, Parser, Router, Chunker, Table, Gateway, model settings, and thresholds are unchanged.
- No benchmark-specific Gold-ID rule, fallback, compatibility layer, or production semantic change.

### Task 1: Gold Eligibility Contract Helper

**Files:**
- Create: `backend/eval/requirement-extraction-real-tender-pilot-v1/gold-eligibility.js`
- Test: `backend/test/requirement-gold-eligibility.test.js`

**Interfaces:**
- `classifyGoldEligibility(sourceAuthority)` returns `{ source_authority, evaluation_eligible }` and marks only `SOURCE_CLEAR` eligible.
- `summarizeEligibleGold({ goldItems, sourceAuditItems })` returns dataset/evaluable/quarantine counts and an ID-keyed eligibility map.
- `aggregateEligibleSemanticAdjudication({ adjudicationItems, sourceAuditItems })` returns eligible-only FULL/PARTIAL/MISS, completeness, mandatory, critical omission, grouping, and preserved candidate-scope metrics.

- [x] **Step 1: Write the failing test**

  Add tests for ambiguous exclusion, clear retention, eligible-only denominator, critical-blocker exclusion, transparent reporting, and candidate-independent source authority.

- [x] **Step 2: Run the test to verify it fails**

  Run `node --test backend/test/requirement-gold-eligibility.test.js`; expect the missing helper import or missing exports to fail before implementation.

- [x] **Step 3: Implement the minimal helper**

  Implement source-authority-only classification and deterministic aggregation. Do not accept Candidate quality as an input to eligibility classification.

- [x] **Step 4: Run the focused test to verify it passes**

  Run `node --test backend/test/requirement-gold-eligibility.test.js`; all eligibility tests must pass.

### Task 2: Offline Final Recertification

**Files:**
- Create: `backend/eval/requirement-extraction-real-tender-pilot-v1/recertify-gold-eligibility.js`
- Create (generated/ignored): `backend/eval/reports/reqx-v311-gold-eligibility-final-recertification-v1/eligibility.json`
- Create (generated/ignored): `backend/eval/reports/reqx-v311-gold-eligibility-final-recertification-v1/semantic-metrics.json`
- Create (generated/ignored): `backend/eval/reports/reqx-v311-gold-eligibility-final-recertification-v1/semantic-certification.json`

**Interfaces:**
- The script reads the frozen semantic-boundary packets, `source-ambiguity-gold-audit-v1.json`, and historical `semantic-adjudication.json`.
- It writes new certification-facing artifacts with the new evaluation contract identity and evaluator revision, preserving source capture/evaluation run identities.

- [x] **Step 1: Add script-level integrity assertions**

  Assert 199 Gold cases, 173 Candidates in the historical artifact, 199 source-audit entries, packet hashes unchanged, G071 classified by the generic audit as `SOURCE_AMBIGUOUS`, and G005-06 remains `SOURCE_CLEAR`.

- [x] **Step 2: Implement recertification output**

  Filter semantic adjudication only by the source-audit eligibility map, produce `evaluable_gold_count=198`, `source_ambiguous_count=1`, eligible-only metrics, transparent quarantine details, and freeze gates without changing thresholds.

- [x] **Step 3: Run the script offline**

  Run `node backend/eval/requirement-extraction-real-tender-pilot-v1/recertify-gold-eligibility.js`; expect Provider/DeepSeek/Dify counts to remain zero and all three JSON artifacts to be written.

### Task 3: ADR and Verification

**Files:**
- Create: `docs/decisions/016-source-ambiguous-cases-are-not-evaluable-gold.md`

- [x] **Step 1: Record ADR-016**

  Record the user-confirmed Accepted decision, denominator/reporting rules, alternatives, consequences, guardrails, and historical-artifact immutability.

- [x] **Step 2: Run targeted verification**

  Parse all new artifacts, verify Gold hashes and 199-case lineage, assert the eligibility counts and G005-06 negative control, run governance/integrity tests, and run `git diff --check`.

- [x] **Step 3: Confirm scope**

  Verify no production semantic file, Gold packet, historical artifact, Prompt, Candidate, or threshold changed; do not commit, push, deploy, or call any model.
