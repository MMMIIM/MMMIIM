# V43 Isolated PostgreSQL Test Report

Audit: `V43_PRODUCTION_SHAPED_FLOW_ENGINEERING_QUALITY_AUDIT_V1`

The configured `backend/.env` target was inspected without printing secrets:

- host: `127.0.0.1`
- port: `5432`
- database: `bid_platform`
- user: `bid_user`

The decision requires a disposable database named `bid_platform_flow_audit_test` and forbids writes to `bid_platform`. The Codex execution topology could not reach PostgreSQL:

- `Test-NetConnection 127.0.0.1 -Port 5432`: `TcpTestSucceeded=False`
- `docker ps`: Docker named-pipe access denied / pipe not found
- read-only `pg` connection to `bid_platform_flow_audit_test`: `ECONNREFUSED 127.0.0.1:5432`

Therefore no database was created, no migration was run, and no PostgreSQL integration test was executed.

```ini
TEST_DB_NAME=bid_platform_flow_audit_test
TEST_DB_CREATED=NO
MIGRATIONS_APPLIED=NOT_RUN
MIGRATION_FIRST_RUN=NOT_RUN
MIGRATION_SECOND_RUN=NOT_RUN
POSTGRES_TEST_COUNT=0
PASS=0
FAIL=0
SKIP=1
CODEX_SANDBOX_DOCKER_ACCESS=BLOCKED
PRODUCTION_DB_WRITES=0
```

Classification: `BLOCKED_ENGINEERING_AUDIT_POSTGRES` due to the Codex sandbox/Docker permission boundary. This is not evidence that the host runtime or production database is unhealthy.
