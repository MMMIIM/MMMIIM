# V43 RAG Retrieval P1B Production-Shape Hygiene Canary Checkpoint

- Status: **P1B_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING**
- Mode: **ENGINEERING VALIDATION ONLY**; production promotion: **NOT AUTHORIZED**.
- Scope: **P1A_STRUCTURE_HYGIENE_ONLY / production-shape canary**; re-chunking 0; parent/child change 0; embedding change 0.
- P1A rule: P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC / 8320c40c28fa5052f6ea9abe3843a2544b6c929a955a252b97ee56b5180a79c2
- Matcher: EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE / ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2

## Production shape

- CURRENT_HYGIENE_POSITION: **POST_TRUNCATION**; CURRENT_RAW_CANDIDATE_K: **20**; CURRENT_FINAL_K: **8**; CURRENT_SLOT_REPLENISHMENT: **NO**.
- One vector query; no replenishment query. Bounded overfetch was not implemented or inferred as a runtime setting.

## Final-review metrics

| K | R0 atom recall | R1 atom recall | R0 precision | R1 precision | R0 nDCG | R1 nDCG |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.571428571429 | 0.571428571429 | 0.4 | 0.4 | 0.444444444444 | 0.444444444444 |
| 3 | 0.642857142857 | 0.642857142857 | 0.2 | 0.2 | 0.425137184125 | 0.425137184125 |
| 5 | 0.642857142857 | 0.642857142857 | 0.12 | 0.12 | 0.451492485544 | 0.451492485544 |
| 8 | 0.714285714286 | 0.714285714286 | 0.0875 | 0.0875 | 0.494476130793 | 0.494476130793 |

- K=20 is raw-pool-only and is not mixed with final review K=8 metrics.
- Gate: **P1A_PRODUCTION_SAFE_AS_IS**
- OVERFETCH_REQUIRED_FOR_P1A_GAIN: **NO**

## Diagnostic and safety

- Development-validation overlay: **7** former holdout cases; semantic Gold mutated: **0**; fresh blind holdout claim: **false**.
- Special-case classifications: [{"requirement_id":"FAST-01:REQ-005","classification":"HYGIENE_GAIN_REQUIRES_DEEPER_POOL","outside":[{"source_chunk_id":"MCH-D09A2FC0D82F6D27ED11B48CBDA4B06C","dense_rank":40,"gold_grade":2}]},{"requirement_id":"JY-001:REQ-027","classification":"HYGIENE_GAIN_WITHIN_POOL","outside":[]},{"requirement_id":"TB-003:REQ-119","classification":"HYGIENE_GAIN_REQUIRES_DEEPER_POOL","outside":[{"source_chunk_id":"MCH-AA94BB7D153A30F95E869D78DC45A0E5","dense_rank":27,"gold_grade":2}]},{"requirement_id":"TB-003:REQ-170","classification":"HYGIENE_GAIN_REQUIRES_DEEPER_POOL","outside":[{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":25,"gold_grade":2}]}].
- Reproducibility: **true**.
- Provider/embedding/LLM calls: **0/0/0**; production/eval DB writes: **0/0**; no corpus or authority mutation.

Stop for GPT review. Do not implement P1B runtime changes, P2, P3, P4, MMR, hybrid, or reranker.

**V43_RAG_RETRIEVAL_P1B_PRODUCTION_SHAPE_HYGIENE_CANARY_CHECKPOINT_V1**
