# V43 Requirement Fixed-48 Runner Durability Recovery Gate

## Result

`FIXED48_RUNNER_DURABILITY = PASS`

The implementation is Eval-only. It does not change the Requirement Producer,
Prompt, Schema, Chunker, Source Resolver, Canonicalizer, Quality Gate, or Gold.

## Durable accounting

The new append-only JSONL ledger persists case identity, hashes, state,
call sequence, timestamps, and bounded response metadata. Each
`CALL_RESERVED` record is fsync'd before dispatch. Budget usage is derived from
the ledger, so a reserved or dispatched call is conservatively consumed even
when no response is durable.

`CALL_RESERVED`/`DISPATCHED` records recovered after restart become
`UNKNOWN_AFTER_DISPATCH` and are routed to `MANUAL_REVIEW_FOR_RERUN`; they are
never automatically retried. A durable `RESPONSE_RECEIVED` resumes finalization
without another Provider call.

## Verification

- Fixed-48 durability/crash/budget/safe-telemetry tests: **7/7 PASS**
- Existing Requirement quality and recovery focused tests: **14/14 PASS**
- Combined focused suite: **21/21 PASS**
- Provider calls in this Gate: **0**
- Production DB writes: **0**
- Gold mutations: **0**
- New migrations: **0**
- `git diff --check`: **PASS**

The historical Fixed-48 run remains `NON_RESUMABLE_HISTORICAL_RUN`; its call
count is not inferred or reused. No new live Fixed-48 certification was run.

The next live certification requires a new scoped Provider authorization and a
fresh run with a durable ledger.
