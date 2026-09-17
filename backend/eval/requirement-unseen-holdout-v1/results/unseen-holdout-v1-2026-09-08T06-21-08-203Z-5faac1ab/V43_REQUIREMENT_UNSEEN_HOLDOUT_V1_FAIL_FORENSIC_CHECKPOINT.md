# V43 Requirement Unseen Holdout v1 Fail Forensic Checkpoint

- RUN_ID: unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab
- HOLDOUT_V1_FINAL_STATUS: FAIL
- CONFIRMED_P0_ESCAPE_COUNT: 1
- CONFIRMED_P0_CASE_IDS: HOLDOUT-REQ-01-CAN-0149
- PRODUCER_SEMANTIC_FIDELITY: FAIL
- QUALITY_GATE_SAFETY_NET: FAIL
- ROOT_CAUSE_CLASSIFICATION: F_COMBINED_CAUSE (B + C + D)
- SAME_FAILURE_FAMILY_AS_V2_015: YES
- CAN_0208_DUPLICATE_RELATIONSHIP: SAME_UNDERLYING_REQUIREMENT_DUPLICATED_IN_DOCUMENT (not double-counted)
- SPAN_CONSERVATION_ROOT_CLASS: FRONT_MATTER_OR_TOC
- ACTUAL_REQUIREMENT_BEARING_SOURCE_LOSS: NO
- REVIEW_RATE: 35.0126% (not false-positive rate)
- PROVIDER_CALLS_ADDED: 0
- PRODUCTION_DB_WRITES: 0
- GOLD_MUTATIONS: 0

## CAN-0149

- Source text: 5) 	投标有效期不满足招标文件要求的；
- Candidate: 投标有效期须满足招标文件要求。
- Canonical: 投标有效期须满足招标文件要求。
- Actual gate: ACCEPT; expected gate: REVIEW_REQUIRED

Source-side packets are preserved as blind artifacts without expected labels, Provider results, or Gold answers.

