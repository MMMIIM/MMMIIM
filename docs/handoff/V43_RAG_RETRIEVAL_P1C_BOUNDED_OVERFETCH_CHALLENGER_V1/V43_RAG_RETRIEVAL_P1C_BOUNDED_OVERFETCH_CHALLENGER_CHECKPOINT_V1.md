# V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_CHALLENGER_CHECKPOINT_V1

- Status: **P1C_ENGINEERING_VALIDATION_COMPLETE_GPT_REVIEW_PENDING**
- Mode: **EVAL / ENGINEERING CHALLENGER ONLY**; no Production Retrieval change.
- Frozen candidateK ladder: **20 / 32 / 48 / 64**; final K: **8**.
- Shape: raw dense candidateK → existing Production Hygiene → existing fallback → final Top8.
- New Hygiene rules: **0**; Provider calls: **0**; Embedding calls: **0**; LLM calls: **0**.

## Final-review metrics

| Depth | K | Evidence Atom Recall | Candidate Precision | nDCG |
|---:|---:|---:|---:|---:|
| 20 | 1 | 0.571428571429 | 0.4 | 0.444444444444 |
| 20 | 3 | 0.642857142857 | 0.2 | 0.425137184125 |
| 20 | 5 | 0.642857142857 | 0.12 | 0.451492485544 |
| 20 | 8 | 0.714285714286 | 0.0875 | 0.494476130793 |
| 32 | 1 | 0.571428571429 | 0.4 | 0.444444444444 |
| 32 | 3 | 0.642857142857 | 0.2 | 0.425137184125 |
| 32 | 5 | 0.642857142857 | 0.12 | 0.451492485544 |
| 32 | 8 | 0.714285714286 | 0.0875 | 0.504129760952 |
| 48 | 1 | 0.571428571429 | 0.4 | 0.444444444444 |
| 48 | 3 | 0.642857142857 | 0.2 | 0.425137184125 |
| 48 | 5 | 0.642857142857 | 0.12 | 0.451492485544 |
| 48 | 8 | 0.714285714286 | 0.0875 | 0.504129760952 |
| 64 | 1 | 0.571428571429 | 0.4 | 0.444444444444 |
| 64 | 3 | 0.642857142857 | 0.2 | 0.425137184125 |
| 64 | 5 | 0.642857142857 | 0.12 | 0.451492485544 |
| 64 | 8 | 0.714285714286 | 0.0875 | 0.504129760952 |

## MRR and pool diagnostics

- MRR_FINAL@8 by depth: **{"20":{"value":0.45,"hit_count":5,"case_count":10,"contract":"MRR_FINAL@8; misses contribute 0; final-review set is capped at 8"},"32":{"value":0.45,"hit_count":5,"case_count":10,"contract":"MRR_FINAL@8; misses contribute 0; final-review set is capped at 8"},"48":{"value":0.45,"hit_count":5,"case_count":10,"contract":"MRR_FINAL@8; misses contribute 0; final-review set is capped at 8"},"64":{"value":0.45,"hit_count":5,"case_count":10,"contract":"MRR_FINAL@8; misses contribute 0; final-review set is capped at 8"}}**
- Raw diagnostics: **{"MRR_RAW@20":{"value":0.316666666667,"hit_count":5,"case_count":10,"metric":"MRR_RAW@20","contract":"dense raw candidate pool only; never mixed with final-review MRR"},"MRR_RAW@32":{"value":0.32037037037,"hit_count":6,"case_count":10,"metric":"MRR_RAW@32","contract":"dense raw candidate pool only; never mixed with final-review MRR"},"MRR_RAW@48":{"value":0.32287037037,"hit_count":7,"case_count":10,"metric":"MRR_RAW@48","contract":"dense raw candidate pool only; never mixed with final-review MRR"},"MRR_RAW@64":{"value":0.32287037037,"hit_count":7,"case_count":10,"metric":"MRR_RAW@64","contract":"dense raw candidate pool only; never mixed with final-review MRR"}}**
- FINAL_POOL_FILL_RATE_BY_DEPTH: **{"20":0.75,"32":0.9375,"48":1,"64":1}**
- RAW_TO_FINAL_SURVIVAL_RATIO_BY_DEPTH: **{"20":0.3,"32":0.234375,"48":0.166666666667,"64":0.125}**
- GRADE_GTE_2_ENTERING_FROM_GT20_BY_DEPTH: **{"20":{"raw_pool_entry_count":0,"post_hygiene_survivor_count":0,"post_hygiene_case_count":0,"final_review_candidate_count":0,"final_review_case_count":0,"candidates_in_survivor_pool":[],"candidates_in_final_review":[]},"32":{"raw_pool_entry_count":2,"post_hygiene_survivor_count":2,"post_hygiene_case_count":2,"final_review_candidate_count":0,"final_review_case_count":0,"candidates_in_survivor_pool":[{"source_chunk_id":"MCH-AA94BB7D153A30F95E869D78DC45A0E5","dense_rank":27,"post_hygiene_rank":17,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-119","requirement_id":"TB-003:REQ-119"},{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":25,"post_hygiene_rank":11,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-170","requirement_id":"TB-003:REQ-170"}],"candidates_in_final_review":[]},"48":{"raw_pool_entry_count":4,"post_hygiene_survivor_count":4,"post_hygiene_case_count":3,"final_review_candidate_count":0,"final_review_case_count":0,"candidates_in_survivor_pool":[{"source_chunk_id":"MCH-D09A2FC0D82F6D27ED11B48CBDA4B06C","dense_rank":40,"post_hygiene_rank":11,"gold_grade":2,"case_id":"RAG-P0-CAL-FAST-01-REQ-005","requirement_id":"FAST-01:REQ-005"},{"source_chunk_id":"MCH-AA94BB7D153A30F95E869D78DC45A0E5","dense_rank":27,"post_hygiene_rank":17,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-119","requirement_id":"TB-003:REQ-119"},{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":46,"post_hygiene_rank":22,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-119","requirement_id":"TB-003:REQ-119"},{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":25,"post_hygiene_rank":11,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-170","requirement_id":"TB-003:REQ-170"}],"candidates_in_final_review":[]},"64":{"raw_pool_entry_count":4,"post_hygiene_survivor_count":4,"post_hygiene_case_count":3,"final_review_candidate_count":0,"final_review_case_count":0,"candidates_in_survivor_pool":[{"source_chunk_id":"MCH-D09A2FC0D82F6D27ED11B48CBDA4B06C","dense_rank":40,"post_hygiene_rank":11,"gold_grade":2,"case_id":"RAG-P0-CAL-FAST-01-REQ-005","requirement_id":"FAST-01:REQ-005"},{"source_chunk_id":"MCH-AA94BB7D153A30F95E869D78DC45A0E5","dense_rank":27,"post_hygiene_rank":17,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-119","requirement_id":"TB-003:REQ-119"},{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":46,"post_hygiene_rank":22,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-119","requirement_id":"TB-003:REQ-119"},{"source_chunk_id":"MCH-2EEFA4F9B214B94D417935EEB260A88E","dense_rank":25,"post_hygiene_rank":11,"gold_grade":2,"case_id":"RAG-P0-HOLD-TB-003-REQ-170","requirement_id":"TB-003:REQ-170"}],"candidates_in_final_review":[]}}**

## Selection and gates

- DEVELOPMENT_SELECTED_CANDIDATE_K: **NONE**
- R64_DIAGNOSTIC_ONLY: **true**
- OVERFETCH_GAIN_SATURATION_POINT: **NONE**
- Recommendation candidate: **NO_CHANGE_YET**
- Selection contract: Smallest challenger in 32/48 that passes all regression gates, admits at least one previously Top20-truncated Gold atom into final review, reduces underfill, and captures >=90% of the combined positive Recall@8+nDCG@8 gain available at R64. The selected value is development-only and is not a production config or release threshold.

## Special diagnostics

- FAST-01:REQ-005: overall first grade≥2 dense rank 40; Top20-external first dense rank 40; raw K to survivor 48; overall final rank by depth {"20":null,"32":null,"48":null,"64":null}; Top20-external final rank by depth {"20":null,"32":null,"48":null,"64":null}; Recall@8 movement {"20":0,"32":0,"48":0,"64":0}.
- TB-003:REQ-119: overall first grade≥2 dense rank 27; Top20-external first dense rank 27; raw K to survivor 32; overall final rank by depth {"20":null,"32":null,"48":null,"64":null}; Top20-external final rank by depth {"20":null,"32":null,"48":null,"64":null}; Recall@8 movement {"20":0,"32":0,"48":0,"64":0}.
- JY-001:REQ-027: overall first grade≥2 dense rank 6; Top20-external first dense rank NONE; raw K to survivor NONE; overall final rank by depth {"20":2,"32":2,"48":2,"64":2}; Top20-external final rank by depth {"20":null,"32":null,"48":null,"64":null}; Recall@8 movement {"20":0,"32":0,"48":0,"64":0}.
- TB-003:REQ-170: overall first grade≥2 dense rank 2; Top20-external first dense rank 25; raw K to survivor 32; overall final rank by depth {"20":1,"32":1,"48":1,"64":1}; Top20-external final rank by depth {"20":null,"32":null,"48":null,"64":null}; Recall@8 movement {"20":0,"32":0,"48":0,"64":0}.

## Safety

- Scope, authority, quarantine, enterprise, lineage, Gold, corpus, DB, Fact, Mapping, Claim, and Writer boundaries are unchanged.
- Safety report: **{"source_role_escape_count":0,"quarantine_escape_count":0,"cross_enterprise_escape_count":0,"authority_scope_escape_count":0,"lineage_incomplete_count":0,"source_corpus_count":94,"source_span_identity_preserved":true,"fact_mapping_claim_writer_mutations":0,"production_db_writes":0,"eval_db_writes":0,"gold_mutations":0,"corpus_mutations":0,"authority_changes":0,"lineage_changes":0}**

STOP FOR GPT REVIEW. Do not implement the recommendation.
