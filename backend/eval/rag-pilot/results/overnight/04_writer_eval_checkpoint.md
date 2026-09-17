# V43 Writer Overnight — 04 Writer Eval Checkpoint

Status: `WRITER_FAST_GATE_PASS`

## Eval identity

- contract: `WRITER_FAST_GATE`
- fixture classification: `REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA`
- provider calls: `0`
- external calls: `0`
- full Provider fidelity baseline: `BLOCKED_BY_AUTHORIZATION` (no current-task
  external Writer authorization was supplied)

## Deterministic fast metrics

The reproducible runner is `backend/eval/rag-pilot/writer-fast-gate-v1.js` and
is exposed as `npm run eval:writer-fast-gate -w backend`.

| Metric | Result |
| --- | ---: |
| Unauthorized Assertion Count | `0` |
| Requirement Laundering Count | `0` |
| Authority Expansion Count | `0` |
| Restrict Condition Loss Count | `0` |
| Fact Bypass Count | `0` |
| Mapping Bypass Count | `0` |
| Stale Authorization Use Count | `0` |
| Authorized Strong Claim Retention | `1` |
| Authorized Narrow Claim Retention | `1` |
| Section Completeness | `1.0` |

The fixture covers response-only requirements, an authorized strong claim, a
narrow/composite claim, and negative scope/status/quantity/validity expansion.
All hard-safety predicates are true and the runner reports `PASS`.

## HTTP / DB evidence

- Canonical `POST /api/projects/:projectId/document-generations` negative
  controls: unauthorized/cross-project requests return safe JSON 403;
  missing mandatory approved Claim returns safe JSON 409.
- PostgreSQL writer DB gate: `15/15 PASS` targeted (full group executed
  separately), including atomic task/output/mention writes, finalization,
  stale authorization, failed batch, identity replay, and concurrent identity.
- Failed V2 batch audit retains `batch_id`, `section_ids`, and `error_category`;
  no DocumentVersion is created.

No LLM-as-a-Judge, prompt rewrite, Provider fallback, or production data write
was used.
