# V43_FACT_FIXED12_SEMANTIC_FAILURE_ATTRIBUTION_CHECKPOINT

- Replay mode: OFFLINE_DETERMINISTIC
- Source run: fact-v21-fixed12-20260908110957-e4f158f6
- Observations: 50

## Offline delta

- Critical false accepts: 2 → 0
- False rejects: 2 → 0
- Source-role unknown: 8 → 1
- Reference authority escapes: 0
- Governance authority escapes: 0
- Producer atomicity blockers open: 0
- COM-12 source-grounded observations: 7/7
- Producer window cross-heading body leakage: 0

## Hard anchors

- U17_NEGATED_STATUS: PASS
- U20_NEGATED_STATUS: PASS
- U34_NEGATIVE_SCOPE_REVIEW: PASS
- COM01_COMPOSITIONAL_GROUNDING: PASS
- U09_STATUS_GROUNDING: PASS
- COM06_NEGATIVE_CERTIFICATION_REVIEW: PASS
- U29_NEGATIVE_HIS_REVIEW: PASS
- U30_EXPIRED_NOT_POSITIVE: PASS

## Gate status

- Track B backend: READY_FOR_GPT_FACT_FIXED12_BACKEND_DELTA_ADJUDICATION
- Fact producer atomicity: READY_FOR_GPT_WINDOW_BOUNDARY_ADJUDICATION
- Fixed12 live rerun: NOT EXECUTED (offline-only decision boundary)

## Side effects

- Provider calls: 0
- Production DB writes: 0
- Fact persistence: 0
- Gold mutations: 0
- Production semantic changes: 0

- Next step: STOP_AND_WAIT_FOR_GPT_BACKEND_DELTA_AND_PRODUCER_ATOMICITY_ADJUDICATION
