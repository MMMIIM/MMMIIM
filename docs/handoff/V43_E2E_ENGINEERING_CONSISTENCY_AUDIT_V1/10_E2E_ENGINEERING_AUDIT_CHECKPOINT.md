# V43 E2E Engineering Consistency Audit V1

Mode: READ-ONLY. The local dirty worktree remains the authority.

## Checkpoint

- `ENGINEERING_AUDIT`: `PARTIAL_BLOCKED`
- `FIRST_FAILURE_BOUNDARY`: `PRE_PROVIDER / DATABASE_IDENTITY_AND_SCHEMA_QUERY (SQLSTATE 42703)`
- `P0_E2E_BLOCKER_COUNT`: `4`
- `TARGETED_FACT_REPLAY_READY`: `NO`

The configured `backend/.env` database is `bid_platform`. The expected flow-audit
database is `bid_platform_flow_audit_test`; it contains the expected project,
six HW materials, six active bindings and 590 chunks, but it has zero canonical
Requirement rows for the expected project. The configured database has neither
the expected project nor the HW material snapshot.

The reported `m.material_version` failure reproduces as SQLSTATE `42703` against
both inspected databases. No migration defines `material_version`; migration
041 defines `company_materials.source_version`. The current checked-out canary
runner and repository query use `source_version`, so the runtime emitting the
reported query is not identified by this checkout.

P0 blockers are:

1. Wrong database target for the canary identity.
2. No canonical Requirement authority for the expected project.
3. Requirement scope authority persistence is absent in `bid_platform`.
4. Runtime/schema query identity for the reported `material_version` failure is
   unverified.

No provider call, LLM call, migration, database write, code/config change, Gold
mutation, Mapping, Claim or Writer action was performed. The audit stops before
Provider execution. See the sibling JSON artifacts for the database, schema,
call-graph, persistence and runner-dependency evidence.

`RECOMMENDED_MINIMAL_FIX_SEQUENCE` is recorded in
`10_E2E_ENGINEERING_AUDIT_CHECKPOINT.json`; it is a decision handoff only and
was not executed by this audit.
