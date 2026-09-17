# V43 Response Router V2.1 vs Frozen Reference V3

- run_id: V43-RR-V2_1-V3-REPLAY-c7184cd488d85c64
- reference_v3: docs\V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip#V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json
- reference_v3_sha256: 3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744
- cases: 2178
- Router V2.1: backend\src\pipeline\requirement-response-router-v2-1.js
- router_sha256: d8a2cd54a6949d0e0ee6312a2e7592d7ae169a2e40f01807df47488a79449b73
- primary agreement: 1684/2178 (0.773186)
- disagreements: 1263
- genuine ambiguous reference cases: 3
- Router NEED_REVIEW: 22

## Per-mode metrics

- SOLUTION: precision=0.460938, recall=0.295, TP=59, FP=69, FN=141
- EVIDENCE: precision=0.827352, recall=0.891327, TP=853, FP=178, FN=104
- COMMITMENT: precision=0.73673, recall=0.688492, TP=347, FP=124, FN=157
- COMPLIANCE: precision=0.802281, recall=0.821012, TP=422, FP=104, FN=92
- NEED_REVIEW: precision=0.136364, recall=1, TP=3, FP=19, FN=0

## Safety boundaries

- P0 compliance escape: 0
- high-risk evidence false negative: 105
- future commitment → evidence: 66
- project solution → evidence: 96
- evidence → solution: 15
- commitment → compliance: 48
- compliance → commitment: 51

## Development targets

- Hard P0 compliance escape: PASS (0)
- High-risk/P0 evidence dependency false negative: FAIL (105)
- Post-award commitment → evidence: FAIL (66)
- Genuine ambiguous recall: 3/3
- False abstention: 19

## Side effects

- Provider calls: 0
- LLM calls: 0
- Production DB writes: 0
- Reference V2/V3 mutations: 0
- Router V1/V2 mutations: 0
- Commit/push/merge/deploy: 0

## Verification

- Router V2/V2.1, calibration, and blind-export focused tests: 30/30 PASS
- Requirement focused smoke: 33/33 PASS
- Frontend test suite: 51/51 PASS
- Build: PASS
- Lint: PASS
- `git diff --check`: PASS (line-ending normalization warnings only)

Failure families are mechanically assigned from frozen V3 labels and Router output; no semantic truth was inferred by Codex.
