# V43 RAG / Fact Production Readiness Recovery Checkpoint

`RAG_FACT_PRODUCTION_READINESS = FAIL`

## Recovery scope

This continuation completed deterministic remediation and offline validation only.
No Provider call, production database write, Gold mutation, Mapping action, Claim
action, or Writer action was performed.

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Provider calls: `0`
- Production DB writes: `0`
- Gold mutations: `0`

## Deterministic remediation

- Gateway and Provider HTTP status are now separate safe telemetry fields.
- Safe telemetry exposes optional `provider_error_code`, `gateway_error_code`,
  `semantic_error_code`, `retry_attempt`, and `retry_reason` without exposing
  keys, authorization, prompts, or model content.
- The Eval Fact runner selects the first substantive source chunk and fails
  closed when a material has no substantive chunk; heading-only chunk[0] is not
  sent as the Fact input window.
- Focused Fact/Gateway validation: **97/97 PASS**.
- A requirement-blind 24-case expected-source packet was prepared at
  `docs/V43_RAG_RETRIEVAL_CURRENTNESS_24_EXPECTED_SOURCE_PACKET.json`.

## Evidence limits

The five historical grounding/status false-reject classifications cannot be
deterministically replayed because exact source/response pairs were not retained.
No validator strictness was changed. The five U20 Facts share one source span;
aggregate/child duplication remains suspected and unresolved.

## Regression results

- Backend unit: **1246/1260 PASS**; 14 failures are classified
  `PRE_EXISTING_UNRELATED_BASELINE` (missing cwd-sensitive fixtures and existing
  governance/fixture expectation drift).
- Frontend: **51/51 PASS**.
- PostgreSQL: **0/61 PASS**, classified `ENVIRONMENTAL`; host Node connections to
  the Docker-published port terminate before query. No test rows were created.
- Retrieval-focused: **62/69 PASS**; 7 missing root `eval/...` fixture failures are
  `PRE_EXISTING_UNRELATED_BASELINE`.
- Requirement Eval: **PASS** (schema, recall, precision, source verification all
  100%).
- Build: **PASS**. Lint: **PASS**. `git diff --check`: **PASS**.

## Deferred execution

The fixed 12-material targeted `evidence_fact_extraction` run is
`BLOCKED_WAITING_FOR_SCOPED_AUTHORIZATION` (cap 30, concurrency 2). The current
retrieval currentness execution is not run because it requires external embedding
egress and isolated Eval DB execution. The remaining 80 materials are not resumed.

No Mapping, Claim, or Writer downstream work is authorized by this checkpoint.
