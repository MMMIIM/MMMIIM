# V43 Fact Source Material Identity Reconciliation Checkpoint

## Scope

Read-only reconciliation for `MCH-586AF54E29E13328B1D105D03FF08957` in `bid_platform_flow_audit_test/public`.

## Result

- Current database ownership of source hash `beaf393788e406b1728c57531b8c7061a0d51cb910d87df2fc040f1a0d5ff0aa`: **only** `da4b0715-9d47-4853-ab2f-df5eee22c597` (answer A).
- Direct retrieval report and direct Fact report both record `da4b0715-9d47-4853-ab2f-df5eee22c597` for this exact chunk.
- The replay plan (and its fallback diagnostic summary) records `2f84fdcc-4f27-4fc6-91a4-746d8a11a6a7`, but this conflicts with the direct records.
- `2f84` is `HW-002.pdf`; `da4b` is `HW-001.pdf`; file hashes and source URLs differ.
- `chunkEnterpriseMaterial` includes `material_id` in the MCH hash input. Recomputing the observed row yields the observed ID for `da4b`; using `2f84` yields `MCH-19077F33ACD5782CAD8352D74CF9E8BC`.

## Classification

`STALE_ARTIFACT_MATERIAL_ID` — limited to the replay-plan assignment for this target chunk. The `2f84` material row remains a distinct active material for its own chunks; it is not treated as deleted or globally invalid.

## Gate

`REPLAY_PLAN_IDENTITY_REBASE_SAFE = YES` for `MCH-586AF54E29E13328B1D105D03FF08957`, as a recommendation only. No replay plan, chunk, material, or database row was changed.

## Safety

`PROVIDER_CALLS = 0`  
`DB_WRITES = 0`  
`FACT_WRITES = 0`  
`GOLD_MUTATIONS = 0`  
`REPLAY_PLAN_UPDATED = 0`  
`CHUNKS_REBUILT = 0`

