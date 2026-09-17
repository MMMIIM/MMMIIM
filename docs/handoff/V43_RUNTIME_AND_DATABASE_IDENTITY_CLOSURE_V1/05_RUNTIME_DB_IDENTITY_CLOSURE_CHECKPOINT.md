# V43 Runtime and Database Identity Closure V1

Mode: read-only, with an authorized environment-only alignment for a
pre-provider smoke. No source/config file was changed.

## Result

- `P0-04 RUNTIME_SCHEMA_QUERY_IDENTITY_UNVERIFIED`: **CLOSED FOR CURRENT CANARY EXECUTOR**
- `P0-01 WRONG_DATABASE_TARGET`: **CLOSED FOR CURRENT CANARY EXECUTOR WITH EXPLICIT ISOLATED DATABASE_URL**
- `ACTUAL_RUNTIME_QUERY`: `m.source_version`
- `CURRENT_WORKTREE_QUERY`: `m.source_version`
- `ACTUAL_CONNECTION_DB`: `bid_platform_flow_audit_test/public`
- `SQLSTATE 42703`: **NOT REPRODUCED** in pre-provider smoke
- `TARGETED_FACT_REPLAY_READY`: **NO**

## Evidence

The canary script directly executes local Node imports. It does not dispatch to
the HTTP backend, `docker exec`, or a Compose service. With
`BACKEND_RUNTIME_MODE=container`, dotenv does not override existing variables,
but if the host process has no `DATABASE_URL`, `backend/.env` supplies
`bid_platform`. The prior wrong-target observation is therefore an environment
propagation drift.

When the isolated database URL was supplied explicitly, the smoke verified:

- `SELECT current_database(), current_schema()` → `bid_platform_flow_audit_test`, `public`;
- canary schema preflight → `PASS`;
- six HW materials and 590 target chunks with `source_version` present;
- `m.source_version` query path → `PASS`;
- `provider_calls=0`, `production_db_writes=0`, `eval_db_writes=0`.

Backend and Gateway containers use bind mounts from the current dirty worktree;
their inspected mounted sources contain no `m.material_version` query. The
emitter of the previously reported stale query remains unidentified, so
`RUNTIME_CODE_DRIFT` is not confirmed for the current executor.

Remaining blockers are canonical Requirements absent for the expected canary
project and unavailable Production scope-authority persistence. No migration,
Provider call, Fact persistence, or downstream action was performed.
