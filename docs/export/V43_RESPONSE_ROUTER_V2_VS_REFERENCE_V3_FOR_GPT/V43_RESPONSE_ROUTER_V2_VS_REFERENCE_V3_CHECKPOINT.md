# V43 Response Router V2 vs Frozen Reference V3

- run_id: V43-RR-V2-V3-REPLAY-1f606f817ef33ec0
- reference_v3: docs\V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip#V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json
- reference_v3_sha256: 3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744
- cases: 2178
- Router V2: backend\src\pipeline\requirement-response-router-v2.js
- router_sha256: c2e787e361dd6e2a4e8c27b5f1def49821d4f869b46c4074c66229abb9bbefaa
- primary agreement: 1597/2178 (0.733242)
- disagreements: 1560
- genuine ambiguous reference cases: 3
- Router NEED_REVIEW: 0

## Per-mode metrics

- SOLUTION: precision=0.315985, recall=0.425, TP=85, FP=184, FN=115
- EVIDENCE: precision=0.828631, recall=0.828631, TP=793, FP=164, FN=164
- COMMITMENT: precision=0.696466, recall=0.664683, TP=335, FP=146, FN=169
- COMPLIANCE: precision=0.815287, recall=0.747082, TP=384, FP=87, FN=130
- NEED_REVIEW: precision=0, recall=0, TP=0, FP=0, FN=3

## Safety boundaries

- P0 compliance escape: 10
- high-risk evidence false negative: 229
- future commitment → evidence: 73
- project solution → evidence: 67
- evidence → solution: 73
- commitment → compliance: 41
- compliance → commitment: 52

## Side effects

- Provider calls: 0
- LLM calls: 0
- Production DB writes: 0
- Reference V2/V3 mutations: 0
- Router V1/V2 mutations: 0
- Commit/push/merge/deploy: 0

Failure families are mechanically assigned from frozen V3 labels and Router output; no semantic truth was inferred by Codex.
