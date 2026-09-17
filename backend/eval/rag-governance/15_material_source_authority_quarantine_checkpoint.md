# V43 Material Source Authority Quarantine Checkpoint

`V43_MATERIAL_SOURCE_AUTHORITY_QUARANTINE_CHECKPOINT`

## Authority state

- Material lifecycle mechanism: `company_materials.lifecycle_status=QUARANTINED` with `quarantine_reason` and `quarantined_at`; the lifecycle constraint is replay-compatible.
- New schema fields: `quarantine_reason`, `quarantined_at`.
- Neusoft materials: 4 total, 4 quarantined.
- Exact Neusoft retrieval candidates after quarantine: 0.
- Historical rows retained: 6 facts, 6 mappings, 6 evidence-support claims.
- Current authority derived from those rows: 0 facts, 0 mappings, 0 claim authorizations.
- Active Writer Safe Context exposure: 0.
- Historical lineage remains readable, but current authority is fail-closed.

## Controls

- Non-Neusoft active private retrieval control: PASS (one eligible material returned one chunk).
- Non-Neusoft authority control: PASS.
- Authority fail-closed gate: PASS.
- Historical lineage gate: PASS.
- Performance query gate: PASS (batched SQL/lateral authority reads; no per-claim authority query).
- Illegal material type remains rejected by PostgreSQL (`23514`): PASS.

## Verification

- Focused authority tests: 15/15 unit tests and 2/2 PostgreSQL integration tests PASS.
- PostgreSQL suite: 57/57 PASS.
- Frontend: 51/51 PASS.
- Requirement Eval: PASS (recall 100%, precision 100%, source verified 100%).
- Fresh migration (001-051): PASS.
- Existing full migration: PASS.
- Second full migration pass: PASS.
- Build, lint, and `git diff --check`: PASS.
- Backend full suite: 1163/1176 PASS. The 13 failures are unrelated pre-existing dirty-worktree governance/document/fixture expectations; none are authority-quarantine failures.
- Provider calls: 0.

## Scope and verdict

Eight runtime integration files plus two migration files (041 replay compatibility and 051 quarantine schema) were changed; no Requirement, Evidence, Mapping, Claim, Retrieval, Writer, or provider contract was semantically broadened. Four owning-service quarantine transitions wrote only lifecycle metadata and preserved all source data.

`MATERIAL_SOURCE_AUTHORITY_QUARANTINE_ENFORCED`

RAG production readiness, Mapping Gold readiness, and Claim Gold readiness are intentionally **not claimed**.
