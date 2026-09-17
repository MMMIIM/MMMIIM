# V43 Response Router V2.1 — Regression Report

## Deterministic focused suites

Command:

```text
node --test backend/test/requirement-response-router-v2.test.js backend/test/requirement-response-router-v2-1.test.js backend/test/response-router-semantic-calibration-v2.test.js backend/test/response-router-full-blind-export-v2.test.js
```

Result: **30/30 PASS**.  The V2.1 suite covers pre-award eligibility and
formality, offered product/technical metrics, qualification, project design,
post-award obligations, proof-document dependency, personnel boundary,
incomplete fragments, mixed-boundary abstention, informational context,
determinism, and non-mutation.  V2 remains independently covered.

## Frozen Reference V3 replay

Replay command:

```text
node backend/eval/response-router-v2-1-replay-reference-v3.mjs
```

Run: `V43-RR-V2_1-V3-REPLAY-c7184cd488d85c64`.

- Reference identity: SHA256
  `3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744`,
  2,178 rows.
- Primary agreement: 1,684/2,178 (0.773186).
- Per-mode: SOLUTION precision/recall 0.460938/0.295; EVIDENCE
  0.827352/0.891327; COMMITMENT 0.736730/0.688492; COMPLIANCE
  0.802281/0.821012; NEED_REVIEW 0.136364/1.0.
- Hard/safety observations: P0 compliance escape 0; high-risk evidence
  dependency false negatives 105; post-award commitment→evidence 66.
- Ambiguity: 3/3 genuine ambiguous cases abstained; false abstention 19.
- Cross-cutting agreement: risk 0.605601; response_required 0.965106;
  evidence_dependency 0.781910; human_required 0.813131; scoring_related
  0.986226.

The replay artifacts preserve these misses rather than silently converting
them into a pass.  Any semantic interpretation remains pending GPT review.

## Other requested checks

Requirement focused smoke, relevant Frontend tests, build, lint, and
`git diff --check` are recorded in the final V2.1 checkpoint after execution.
No Provider/LLM call or production write is part of this report.

## Side-effect and compatibility checks

- V2 production module/path unchanged; V2.1 is an additive read-only module.
- Runtime V2.1 has no dependency on Reference V2/V3 or Eval artifacts.
- Provider calls: 0; LLM calls: 0; production DB writes: 0.
- Requirement/Fact/Mapping/Claim/Writer mutations: 0.
- Reference V2/V3 mutations: 0; production cutover: 0.
- Commit/push/merge/deploy: 0.
