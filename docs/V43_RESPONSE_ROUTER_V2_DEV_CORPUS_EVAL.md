# V43 Response Router V2 Dev Corpus Evaluation

- run_id: V43-RR-V2-DEV-5cab74957e63926f
- generated_at: 2026-09-09T09:19:58.638Z
- reference_sha256: b6faf37c1ed33e5d8c26d830d6cf9d25f139b4bafeb4f78ac9294f13acb40507
- router_projection_version: v43-response-router-v2
- case_count: 2178
- primary_mode_agreement: 1556/2178 (0.714417)
- risk_tier_agreement: 1355/2178 (0.62213)
- p0_recall: 0.494505
- response_required_agreement: 1997/2178 (0.916896)
- scoring_agreement: 2156/2178 (0.989899)
- evidence_dependency_agreement: 1707/2178 (0.783747)
- human_required_agreement: 1812/2178 (0.831956)
- NEED_REVIEW: 0/2178 (0)

## Development status

- deterministic comparison: PASS_WITH_SEMANTIC_GATES_NOT_MET
- semantic adjudication: BLOCKED_ROUTER_V2_SEMANTIC_GATES_NOT_MET
- Provider/LLM calls: 0
- production DB writes: 0
- Gold mutations: 0

Failure-family counts are mechanical label deltas defined in the JSON artifact; they are not Codex semantic judgments.
- P0_COMPLIANCE_ESCAPE: 31 (0.014233)
- HIGH_RISK_EVIDENCE_FALSE_NEGATIVE: 139 (0.06382)
- FUTURE_COMMITMENT_AS_EXISTING_FACT: 90 (0.041322)
- PROJECT_DESIGN_AS_ENTERPRISE_FACT: 117 (0.053719)
- UNNECESSARY_WRITER_RESPONSE: 42 (0.019284)
- UNNECESSARY_HUMAN_REVIEW: 180 (0.082645)
