# V43 Parallel Final Deterministic Gates V2 Checkpoint

状态：`READY_FOR_GPT_SEMANTIC_ADJUDICATION`（双 Track；不是生产就绪）

## 安全边界

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Worktree: dirty existing changes preserved
- Provider calls: **0**
- Production DB writes: **0**
- Fact persistence / Gold mutations / Mapping / Claim / Writer actions: **0**
- Prompt / Schema / Model / Provider changes: **0**

## Track A — Requirement governing critical structure

- CAN-0149: `REVIEW_REQUIRED` via `GOVERNING_CRITICAL_LIST`。
- CAN-0208: `REVIEW_REQUIRED` via `GOVERNING_CRITICAL_TABLE`，marker `附表二`，relation `全部内容，否则其投标无效`。
- POST-FIX-V2-015: `REVIEW_REQUIRED` via `NEGATION_DISTORTION`。
- Holdout V1: 397 total; after `256 ACCEPT / 141 REVIEW_REQUIRED / 0 REJECT`; transitions `256 ACCEPT→REVIEW_REQUIRED` = 2; source unresolved = 0。
- Six-tender replay: 1009 total; `758 ACCEPT / 251 REVIEW_REQUIRED / 0 REJECT`; previous decision class was not retained, so this is an offline `UNKNOWN→ACCEPT/REVIEW` replay rather than a before/after metric。
- Controls: P0 governing structure `12/12`, negative containment `4/4`, number controls `4/4`, combined `16/16`。
- Track A: `READY_FOR_GPT_FINAL_CRITICAL_STRUCTURE_ADJUDICATION`。

## Track B — Fact Candidate V2.1

- 26 candidates replayed from the comprehensive Canary; old Stage-1 remains diagnostic only。
- Source-role distribution: profile 1, capability 3, performance 6, reference-only 8, governance-only 8, unknown 0。
- Final decisions: `ACCEPT 4`, `REVIEW_REQUIRED 6`, `EXCLUDED_REFERENCE 8`, `EXCLUDED_GOVERNANCE 8`, `REJECT 0`。
- False rejects fixed: 3; prior grounding rejects: 18。
- Reference-to-enterprise authority escapes: 0；governance-to-enterprise authority escapes: 0。
- Canonicalizer new business semantics: 0；source-ref mutation: 0；synthetic claim-permission escalation: 0。
- COM-01 C0 is source-grounded by `BOUNDED_COMPOSITIONAL` alignment; C1 remains enterprise-eligible and accepted; C2/C3 are grounded `REFERENCE_CONTEXT_ONLY` and excluded from Enterprise Fact authority。
- COM-06 A/B both remain source-grounded and `REVIEW_REQUIRED` with `NEGATED_OR_UNCERTAIN_STATUS`，so equivalent negative boundaries do not diverge into accept/certified semantics。
- CCV2 820 ms, 1,650 tps / 0.18%, and 120 minutes resolve to `ENTERPRISE_PERFORMANCE_ELIGIBLE`; the minute alias remains deterministic and unresolved quantity conditions remain reviewable。
- Track B: `READY_FOR_GPT_FACT_COMPOSITIONAL_GROUNDING_SOURCE_ROLE_ADJUDICATION`。

## Regression

- Focused Requirement/Fact suite: `92/92 PASS`。
- Requirement suite: `46/48 PASS`; the two failures are the previously recorded unrelated source-parity fixture baseline (`5/6` and `5/7`), not this Track A/B change。
- Frontend: `51/51 PASS`。
- Build: PASS；Lint: PASS；`git diff --check`: PASS。
- Root `npm test` remains blocked by pre-existing unrelated governance/fixture/path failures; no unrelated repair was made。

## Artifacts

- [V2 JSON checkpoint](/D:/AI工作/AI/标书平台/标书平台/docs/V43_PARALLEL_FINAL_DETERMINISTIC_GATES_V2_CHECKPOINT.json)
- [Requirement offline replay](</D:/AI工作/AI/标书平台/标书平台/backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/critical-structure-final-20260908094523/offline-replay.json>)
- [Requirement GPT delta packet](</D:/AI工作/AI/标书平台/标书平台/backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/critical-structure-final-20260908094523/V43_REQUIREMENT_CRITICAL_STRUCTURE_DELTA_GPT_PACKET.json>)
- [Fact offline replay](</D:/AI工作/AI/标书平台/标书平台/backend/eval/rag-pilot/results/fact-candidate-v2-1-fresh-20260908085537-f852ae10/deterministic-delta-20260908095841/offline-replay.json>)
- [Fact GPT delta packet](</D:/AI工作/AI/标书平台/标书平台/backend/eval/rag-pilot/results/fact-candidate-v2-1-fresh-20260908085537-f852ae10/deterministic-delta-20260908095841/V43_FACT_V21_CANONICALIZER_GROUNDING_DELTA_GPT_PACKET.json>)

## Readiness / stop

- `REQUIREMENT_PRODUCTION_CERTIFIED = NO`
- `FACT_PRODUCTION_READY = NO`
- `MAPPING_READY = NO`
- New Holdout V2: not started。
- Fixed12: not started。
- Next action is GPT semantic adjudication only. No automatic promotion, live execution, Mapping, Claim, Writer, or Provider work was started。
