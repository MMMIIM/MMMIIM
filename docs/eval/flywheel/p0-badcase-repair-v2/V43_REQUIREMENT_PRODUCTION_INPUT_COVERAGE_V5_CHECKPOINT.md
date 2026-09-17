# V43 Requirement Production Input Coverage V5 Checkpoint

- FINAL_STATUS: BLOCKED_PRODUCTION_INPUT_COVERAGE_ROOT_CAUSE_UNRESOLVED
- PRODUCTION_PARSE_CHUNK_UNIQUE_COUNT: 197
- HASH_COMPARISON_RECORD_COUNT: 197
- DUPLICATE_OR_AUXILIARY_RECORD_COUNT: 0
- REASON_FOR_197_VS_204: 204 is the FAST-01 Requirement candidate/source-verified count recorded by docs/e2e/FAST01_V3/E2E_CHECKPOINT.md and is not a Parse Chunk hash-record count. The frozen Core6 Production run has 197 unique persisted Parse Chunks (28+33+32+26+51+27), with 197 deterministic hash comparisons.
- BADCASE_31_COUNT: 31
- BADCASE_31_EARLIEST_LOSS_COUNTS: {"NONE":25,"UNRESOLVED":6}
- P0_SOURCE_TO_PROVIDER_INPUT_COVERAGE: {"total_atoms":487,"source_found_in_full_extraction":472,"source_covered_by_selected_sections":472,"source_covered_by_parse_chunks":472,"source_covered_by_provider_payload":472,"cross_chunk_semantic_splits":0,"unresolved":["FAST-01-P0-0009","FAST-01-P0-0010","FAST-01-P0-0011","FAST-01-P0-0012","FAST-01-P0-0013","FAST-01-P0-0014","FAST-01-P0-0015","FAST-01-P0-0016","FAST-01-P0-0017","FAST-01-P0-0018","FAST-01-P0-0019","TB-003-P0-0006","TB-003-P0-0023","TB-003-P0-0024","TB-003-P0-0025"],"gate":"FAIL"}
- SYSTEMIC_SCOPE_HYPOTHESIS: {"status":"OBSERVED_SCOPE_BOUNDARY_RISK","excluded_section_roles_observed":["tender_invitation","compliance_rule_candidate","scoring_point_candidate","delivery_constraint_candidate","word_template_candidate","requirement_extraction_fallback"],"hypothesis_targets":["qualification requirements","invalidity conditions","bid document composition","pricing / quotation constraints","payment obligations","procedural conformity obligations"],"case_specific_keyword_patch_applied":false,"full_tender_to_llm_fallback":false,"semantic_contract_redefined":false,"interpretation":"The current scope routing contract explicitly routes several non-technical sections away from Requirement Extraction. The diagnostic records the observed boundary; it does not promote this observation to a semantic root cause or alter routing."}
- PROVIDER_CALLS: 0
- LLM_CALLS: 0
- PRODUCTION_DB_WRITES: 0
- GOLD_MUTATIONS: 0
- PRODUCTION_REPAIR_APPLIED: false

All evidence is deterministic and offline. No semantic adjudication or Provider call was performed.
