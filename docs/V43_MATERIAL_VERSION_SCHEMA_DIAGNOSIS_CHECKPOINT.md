# V43_MATERIAL_VERSION_SCHEMA_DIAGNOSIS_CHECKPOINT

Mode: read-only schema diagnosis. No migration, ALTER, Provider call, or database write was performed.

## Database identity

- Current Codex process `DATABASE_URL`: not set.
- `backend/.env` database: `bid_platform`.
- Live identity query: `current_database() = bid_platform`, `current_schema() = public`.
- Can﻿ary expected database: `bid_platform_flow_audit_test` (database exists, but is not the current configured target).

## Failure evidence

- Reported SQLSTATE: `42703`.
- Reported message: `column m.material_version does not exist`.
- Read-only reproduction on both `bid_platform` and `bid_platform_flow_audit_test`: `SELECT m.material_version FROM company_materials m LIMIT 1` returns the same `42703` error.
- The current checkout contains no `m.material_version` query. The production-shaped canary selects `m.source_version` in `run-requirement-retrieval-fact-canary.mjs` and maps it to the Fact snapshot field `material_version`.
- Therefore the exact emitting runtime file/function for the reported fragment is not recoverable from the current checkout.

## Schema and migration facts

- `company_materials` has `source_version` and does not have `material_version` in either inspected database.
- `material_chunks` and `material_chunk_embeddings` also do not have `material_version`.
- `backend/migrations/041_corpus_l3_public_materials.sql` defines `company_materials.source_version text`.
- No migration defines `material_version`.
- Migration 052 was inspected only; it defines requirement-scope authority and project-material binding tables, not `material_version`.

## Data-target facts

- In configured `bid_platform`, project `7a038c5d-38e4-46ae-b24d-39437bb3b545` is absent and no `HW-*` target materials exist (56 company materials exist overall).
- In `bid_platform_flow_audit_test`, that project exists; six `HW-*` materials, 590 chunks, and six active project-material bindings exist. The materials carry `source_version`.

## Classification

- Primary: `CODE_SCHEMA_DRIFT` — the reported SQL references a column absent from the formal schema, while the formal version column is `source_version`.
- Secondary: `WRONG_DATABASE_TARGET` — the current configured runtime target is `bid_platform`, whereas the canary requires `bid_platform_flow_audit_test`.
- `TEST_DB_SCHEMA_BEHIND` and `QUERY_CONTRACT_DRIFT` are not established by current evidence.

## Recommended minimal fix (not implemented)

Use the canary database and the current `source_version` projection/runtime revision. Do not add a compatibility column or fallback version. Provider replay remains stopped pending GPT decision.

## Safety

```text
PROVIDER_CALLS = 0
PRODUCTION_DB_WRITES = 0
EVAL_DB_WRITES = 0
MIGRATIONS_EXECUTED = 0
```
