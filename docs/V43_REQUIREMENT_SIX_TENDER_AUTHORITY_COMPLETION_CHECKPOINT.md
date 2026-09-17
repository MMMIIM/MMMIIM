# V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT

- BRANCH: feat/v4.3-semantic-boundary-routing
- HEAD: f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e
- WORKTREE: DIRTY_PRE_EXISTING_CHANGES_PRESERVED
- SIX_TENDER_SOURCE_PARITY: FAIL_CURRENT_RESOLVER_MANIFEST_MISSING_RECOVERED_PACKETS
- SIX_TENDER_RESOLVER_COVERAGE: 3/6
- CANONICAL_INPUT_COUNT: 1009
- CANONICAL_INPUT_SOURCE_VERIFIED: 1009/1009 (1)
- CANDIDATE_POOL_SOURCE_VERIFIED: 1009/1010 (0.999009900990099)
- IMPORTANCE_CAPABILITY: NOT_IMPLEMENTED_AS_SEPARATE_REQUIREMENT_FIELD
- BLIND_INPUT_LEAKAGE_CHECK: PASS
- PRODUCTION_DB_WRITES: 0
- GOLD_MUTATIONS: 0
- PRODUCTION_SEMANTIC_CHANGES: 0
- PROVIDER_CALLS: 0
- FOCUSED_TESTS: PASS_100_OF_100
- FULL_NPM_TEST: FAILED_PRE_EXISTING_UNRELATED_BASELINE
- POSTGRES_REGRESSION: FAILED_ENVIRONMENTAL_POSTGRES_CONNECTION_TERMINATED
- POSTGRES_REGRESSION_CLASSIFICATION: ENVIRONMENTAL_POSTGRES_UNAVAILABLE
- REQUIREMENT_REGRESSION: PASS_REQUIREMENT_EVAL
- BASELINE_DRIFT: NO_CURRENT_TASK_REGRESSION_DETECTED
- BUILD: PASS
- LINT: PASS
- DIFF_CHECK: PASS
- FINAL_VERDICT: REQUIREMENT_GOLD_V2_BLIND_INPUT_BUILT_BUT_SIX_TENDER_SOURCE_PARITY_BLOCKED_BY_FROZEN_RESOLVER_MANIFEST

## Tender recovery

- JY-001: C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING; candidates=193; canonical=193; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/JY-001.json; resolver_visible=false; blocker=CURRENT_FROZEN_SOURCE_FOUNDATION_RESOLVER_MANIFEST_HAS_NO_ENTRY; MANIFEST_NOT_MUTATED_TO_PROTECT_FROZEN_GOLD
- TB-003: C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING; candidates=265; canonical=265; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/TB-003.json; resolver_visible=false; blocker=CURRENT_FROZEN_SOURCE_FOUNDATION_RESOLVER_MANIFEST_HAS_NO_ENTRY; MANIFEST_NOT_MUTATED_TO_PROTECT_FROZEN_GOLD
- TB-006: A_ALREADY_AUTHORITATIVE_PACKET_EXISTS; candidates=46; canonical=46; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/TB-006.json; resolver_visible=true; blocker=none
- FAST-01: A_ALREADY_AUTHORITATIVE_PACKET_EXISTS; candidates=39; canonical=39; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json; resolver_visible=true; blocker=none
- FAST-04: C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING; candidates=353; canonical=353; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/FAST-04.json; resolver_visible=false; blocker=CURRENT_FROZEN_SOURCE_FOUNDATION_RESOLVER_MANIFEST_HAS_NO_ENTRY; MANIFEST_NOT_MUTATED_TO_PROTECT_FROZEN_GOLD
- FAST-WATER-01: A_ALREADY_AUTHORITATIVE_PACKET_EXISTS; candidates=114; canonical=113; packet=backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-WATER-01.json; resolver_visible=true; blocker=none

## Capability facts

- {"extraction":"ENFORCED","source_resolution":"ENFORCED","canonicalization":"ENFORCED","semantic_merge":"NOT_IMPLEMENTED","dedup":"ENFORCED","category":"ENFORCED","mandatory":"ENFORCED","requires_confirmation":"ENFORCED","risk":"ENFORCED","importance_or_priority":"NOT_IMPLEMENTED_AS_SEPARATE_REQUIREMENT_FIELD","baseline_versioning":"ENFORCED","authoritative_packet_export":"PARTIAL_EVAL_CONTRACT_ONLY"}

## Gate note

- Missing Tender packets are kept Eval-only and pending Human Authority. The frozen semantic-boundary manifest was not changed; therefore the existing resolver remains 3/6 discoverable until an authorized manifest/index update.

