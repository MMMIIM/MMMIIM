# V43 Parallel Final Deterministic Gates Checkpoint

## Scope and safety

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Worktree: dirty existing changes preserved.
- Provider calls: **0**
- Production DB writes: **0**
- Fact persistence / Gold mutations / Mapping / Claim / Writer actions: **0**
- Production semantic contract change: **0**. Two existing pipeline modules received the bounded detector/grounding remediation; no new contract, schema, model or provider configuration was introduced.
- Prompt, schema, model and provider configuration changes: **0**

## Track A — Requirement governing critical structure

The detector now uses a bounded `GOVERNING_CRITICAL_STRUCTURE` path for both list and review-table ownership. It relies on backend-provided parent context/structural metadata, consequence carriers and governing relations; it does not name a tender, case, clause or page.

- CAN-0149: `ACCEPT → REVIEW_REQUIRED`, `GOVERNING_CRITICAL_LIST`.
- CAN-0208: `ACCEPT → REVIEW_REQUIRED`, `GOVERNING_CRITICAL_TABLE`; `附表二` and `全部内容，否则其投标无效` are retained as evidence.
- POST-FIX-V2-015 remains `REVIEW_REQUIRED` via `NEGATION_DISTORTION`.
- Holdout V1: 397 cases; after 256 ACCEPT / 141 REVIEW_REQUIRED / 0 REJECT; only two ACCEPT→REVIEW_REQUIRED transitions, both the target parent-consequence cases; source unresolved 0.
- Six-tender offline replay: 1009 cases; 758 ACCEPT / 251 REVIEW_REQUIRED / 0 REJECT. The source artifact has no prior decision class, so no before/after transition claim is made.
- Offline controls: governing-structure P0 12/12, negative containment 4/4, number controls 4/4. No broad false-positive signal; canonical/source mutation 0.

Evidence: `backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/critical-structure-final-20260908094523/`.

## Track B — Fact Candidate V2.1 false-reject delta

The saved fresh Canary run was replayed offline with the same 26 observations. No Provider or database was used.

- Classification: A TRUE_ACCEPT 5; B TRUE_REVIEW 3; C TRUE_REJECT 8; D FALSE_REJECT 2; E FALSE_REVIEW 0; F NON_ENTERPRISE_CONTEXT_NOISE 8.
- COM-06-A is now `REVIEW_REQUIRED` because the source-grounded negative boundary has unresolved canonical status semantics; it is not rejected as ungrounded.
- COM-06-B remains `ACCEPT` as a reference boundary.
- CCV2-U13-01 120 minutes is now `REVIEW_REQUIRED` after the narrow `MINUTE → 分钟` source alias; 820ms, 1650 tps and 0.18% remain explicitly review-required where condition/unit semantics are unresolved.
- Grounding rejects before: 18; confirmed false-reject anchors: 2; non-enterprise-context noise: 8; critical grounding escape: 0.
- No new status enum, no business-semantic inference, no generic unknown-field stripping.

Evidence: `backend/eval/rag-pilot/results/fact-candidate-v2-1-fresh-20260908085537-f852ae10/deterministic-delta-20260908094528/`.

## Regression and independent review

- Focused requirement/fact suite: **81/81 PASS**.
- Wider requirement suite: **48/50 PASS**; two failures are pre-existing unrelated source-parity fixture failures.
- Fact authority/contract suite: **52/52 PASS**.
- Frontend: **51/51 PASS**.
- Build, lint and `git diff --check`: **PASS**.
- Root `npm test`: **FAIL_PRE_EXISTING_UNRELATED_BASELINE**. Observed failures are historical missing calibration fixtures, governance instruction/runtime fixtures, source-role projection fixture path, and existing Gold governance/parity fixtures. No current-track failure was identified.
- Independent review: **PASS_WITH_NON_BLOCKING_FINDINGS**. The full findings and artifact paths are in the JSON checkpoint; importantly, no case-specific hardcode or production authority expansion was found.

## Decision boundary

`Track A = READY_FOR_GPT_FINAL_CRITICAL_STRUCTURE_ADJUDICATION`.

`Track B = READY_FOR_GPT_FACT_FALSE_REJECT_DELTA_ADJUDICATION`.

This is not a production certification. Requirement production, Fact production, Mapping input, Holdout V2, Fixed-12, live Provider runs, Gold promotion and downstream Mapping/Claim/Writer work remain **NO / NOT STARTED**.
