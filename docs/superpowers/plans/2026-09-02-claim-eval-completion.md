# V4.3 Claim Eval Completion & Release Gate Plan

## Scope and guardrails

This plan completes the evaluation boundary only.  It reuses the existing
`backend/eval/evidence-gold/` authority, production Claim Gate V2,
`claim-gate-input-adapter-v1`, `WriterInputAuthorization`, and PostgreSQL
integration setup.  It must not change Requirement, Fact, Mapping, Retrieval,
Writer, Provider, Prompt, or production Claim Gate semantics.  The working
tree is intentionally dirty; no reset, clean, stash, checkout, commit, merge,
push, or deploy is permitted.

## Read-only audit completed before further changes

| Category | Existing cases | Positive | Negative | DB-backed | Gap / owner |
| --- | ---: | ---: | ---: | ---: | --- |
| full support | 4 quality + legacy | 4 | 0 | existing integration | Fast coverage present |
| partial support | 5 quality + legacy | 5 | legacy pending | existing integration | Fast coverage present |
| reference only | 2 quality + legacy | 0 | 2 | existing integration | Fast coverage present |
| insufficient / unknown | quality + legacy | 0 | 1+ | existing integration | Fast coverage present |
| conflict | 2 quality | 0 | 2 | existing integration | Fast coverage present |
| status / scope / entity | 1 each quality | 0 | 3 | existing integration | Fast coverage present |
| quantity / performance | quality + legacy | 3 | 1 | existing integration | Fast coverage present |
| validity | 2 quality | 0 | 2 | existing integration | Fast coverage present |
| strong supported claim | 4 quality | 4 | 0 | no integrated DB gate | DB reconstruction gap |
| narrow supported claim | 5 quality | 5 | 0 | no integrated DB gate | DB reconstruction gap |
| project commitment | 2 quality | 1 | 1 | no integrated DB gate | DB reconstruction gap |
| enterprise-existing claim | quality slice | 0 | 1 | no integrated DB gate | DB reconstruction gap |
| multi-fact claim | 2 quality | 0 | 2 | no integrated DB gate | DB reconstruction gap |
| stale authorization | 4 identity variants | 0 | 4 | pure authorization only | DB round-trip gap |
| DB reconstruction | existing persistence tests | 0 | 0 | partial | integrated runner gap |
| gate decision parity | existing integration | 0 | 0 | partial | integrated runner gap |
| writer authorization | existing unit/integration | 1 | negatives | partial | integrated runner gap |

The audit found no need for a second Gold authority or production-rule change.
The remaining owner is `DB_AUTHORIZATION_GAP` / `RUNNER_GAP`, not a Claim Gate
behavior gap.

## TDD tasks

1. **Plan and contract inventory**
   - Keep the existing 24-case synthetic quality slice and 60-case legacy slice.
   - Add no duplicate Claim schema or production decision enum.
   - Prove dataset identity, metric denominators, failure taxonomy, and report
     secret exclusion with `node --test backend/test/claim-eval-v1.test.js`.

2. **Fast Gate regression**
   - Run the production Claim Gate directly for safety and bid-quality cases.
   - Assert Provider, Embedding, Retrieval, retry, fallback, and DB writes are
     all zero.
   - Record `CLAIM_FAST_GATE`, `CLAIM_BID_QUALITY`, and case-level boundaries.

3. **PostgreSQL DB Gate**
   - Add a dedicated integration fixture under `backend/integration/` using the
     existing `createPool` / `PgRepository` setup.
   - Exercise fresh `001 -> 049` migration presence, `048 -> 049` identity
     columns, Claim/Gate identity persist and reload, current allow Writer
     reconstruction, stale identity fail-closed, Gate decision parity, human
     allow/reject decision limits, actor/project scope, and cleanup by fixture
     project only.
   - Never mutate production projects or use real customer data.
   - Expose the DB Gate to the Claim Eval runner without changing production
     services; unavailable PostgreSQL is an explicit `TEST_INFRA_FAILURE`.

4. **Release artifact and gate**
   - Keep a single thin runner in `backend/eval/claim-eval-v1/`.
   - Emit structured JSON/Markdown with dataset and contract identities,
     Safety/Bid Quality/Authorization metrics, failure owner, branch/HEAD,
     Provider and DB write counters, and separate gate statuses.
   - `CLAIM_GATE_PRODUCTION_READY` remains caller-controlled; this task may
     report completion gates but must not upgrade the module status by itself.

5. **Regression and checkpoint**
   - Run targeted Claim Eval, Claim/Writer, Mapping→Claim, affected service and
     PostgreSQL tests, then the repository-approved global commands.
   - Compare known global failures with the pre-existing baseline; do not fix
     unrelated governance, fixture isolation, or runtime wording failures.
   - Run `git diff --check`; leave all changes uncommitted for human review.

## Proving commands

```text
node --test backend/test/claim-eval-v1.test.js
npm run eval:claim -w backend
npm run eval:claim -w backend -- --mode db
npm run test:postgres -w backend
npm run eval:requirements -w backend
npm test
npm run build
npm run lint
git diff --check
```

The Fast Gate command must never call a Provider or write the database.  The DB
Gate command must use only isolated synthetic fixtures and must fail closed on
missing or stale identity.
