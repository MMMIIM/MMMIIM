# V43 Writer Overnight — 03 Operational / DB Checkpoint

Status: `OPERATIONAL_DB_PASS`

## Run identity

- phase: `OPERATIONAL_DB`
- branch: `feat/v4.3-semantic-boundary-routing`
- source HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- real Provider calls: `0`
- database writes: isolated PostgreSQL integration fixtures only
- secrets emitted: `0`

## Persistence and failure boundaries

- `writer_execution_tasks`, `writer_outputs`, and `fact_mention_ledger` use one
  `persistWriterExecutionAtomic()` transaction when the production repository
  is present.
- Provider invocation remains outside that transaction.
- `finalizeDocumentGenerationAtomic()` locks the generation, inserts a
  `pending_review` DocumentVersion, and finalizes the generation in one
  transaction. Missing `chapter_tasks` / audit arrays default to empty JSON
  arrays, preserving existing compatibility rows.
- A failed batch is retained with a safe batch identity, section IDs, and an
  error category; `finalizeV2()` leaves the generation failed and creates no
  DocumentVersion.

## Identity and concurrency

Migration `050_writer_generation_identity.sql` adds the generation type and
input snapshot hash plus a partial unique active-generation identity index.
The same project/type/snapshot replays the existing active generation; a
failed generation is retryable; a changed snapshot gets a new identity.

Targeted PostgreSQL evidence: `15/15 PASS` in
`integration/deterministic.integration.js`, including same-snapshot concurrent
requests resolving to one active generation (`1` persisted row, one replay).
The migration runner was executed again and replayed migrations `001`–`050`
without error.

## Retry and audit

- V2 manual retry budget is bounded (`1` retry after the initial attempt).
- Retry exhaustion is terminal (`WRITER_RETRY_EXHAUSTED`); no automatic LLM
  repair or unbounded retry is enabled.
- Writer semantic audit projects provider/model, prompt and schema identity,
  configuration controls, provider request identity, token usage, and latency
  without raw payloads. Unavailable usage is recorded as `NOT_EXPOSED`.

## Focused commands

- `node --test backend/test/writer-overnight.test.js`: `13/13 PASS`
- `node --test --test-concurrency=1 backend/integration/deterministic.integration.js`:
  `15/15 PASS`
- `npm run db:migrate -w backend`: `PASS` (replay through migration 050)

No Provider, prompt, Claim/Evidence Contract, or unrelated module was changed
by this checkpoint.
