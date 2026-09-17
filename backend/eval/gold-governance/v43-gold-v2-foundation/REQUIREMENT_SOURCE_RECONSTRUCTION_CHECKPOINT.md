# Requirement Source Reconstruction Checkpoint

Generated: 2026-09-04T09:59:52.214Z
Schema: v43-requirement-source-reconstruction-v1

## Status

- source_classifications: {"JY-001":"B_HUMAN_RECONSTRUCTION_POSSIBLE","TB-003":"C_REEXTRACTION_REQUIRED","FAST-04":"C_REEXTRACTION_REQUIRED"}
- source_a_count: 3
- initial_source_b_count: 3
- source_b_count: 1
- source_c_count: 2
- packet_ready_tender_count: 1
- total_candidate_requirements: 193
- total_blocked_historical_rows: 28
- SIX_TENDER_SOURCE_PARITY: BLOCKED_HUMAN_AUTHORITY_PENDING
- SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION: YES
- SAFE_TO_PROMOTE_REQUIREMENT_AUTHORITY: NO

## Side effects

- provider_calls: 0
- db_writes: 0
- gold_mutations: 0
- production_semantic_changes: 0

## Human decisions required

- Human Authority must verify each candidate text against its source span.
- JY-001 has a candidate packet but no authority upgrade.
- TB-003 and FAST-04 remain blocked because only raw source identity is available.
- SIX_TENDER_SOURCE_PARITY remains blocked pending Human Authority and complete authoritative packets.

