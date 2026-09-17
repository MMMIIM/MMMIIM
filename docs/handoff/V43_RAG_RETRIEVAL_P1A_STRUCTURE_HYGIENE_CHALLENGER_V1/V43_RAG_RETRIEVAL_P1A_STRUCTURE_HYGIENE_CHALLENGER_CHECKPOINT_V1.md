# V43 RAG Retrieval P1A Structure Hygiene Challenger Checkpoint

- Status: **P1A_EVAL_CHALLENGER_COMPLETE_GPT_REVIEW_PENDING**
- Scope: **P1A_STRUCTURE_HYGIENE_ONLY**
- Frozen dense input: **94** chunks; final hygiene projection: **47** chunks; excluded: **47**.
- Re-chunking: **0**; parent/child change: **0**; embedding change: **0**; production changes: **0**.
- Hygiene rule: `P1A_HYGIENE_RULE_V1_GENERIC_DETERMINISTIC` / `8320c40c28fa5052f6ea9abe3843a2544b6c929a955a252b97ee56b5180a79c2`
- Matcher: `EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE` / `ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2`
- Replay parity: **true**; K=5 challenger gate: **CHALLENGER_CLEAR_IMPROVEMENT**
- Provider calls: **0**; no corpus or query re-embedding.
- Production promotion: **NOT AUTHORIZED**.

The challenger applies only generic, deterministic, Gold-independent hygiene filtering after the frozen dense ranking and preserves original source chunk identity and lineage.

P2, P3, P4, MMR, hybrid retrieval, and cross-encoder reranking remain on hold.

**V43_RAG_RETRIEVAL_P1A_STRUCTURE_HYGIENE_CHALLENGER_CHECKPOINT_V1**
