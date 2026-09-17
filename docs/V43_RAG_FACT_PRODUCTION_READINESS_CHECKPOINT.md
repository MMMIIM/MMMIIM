# V43 RAG / Fact Production Readiness Checkpoint

`RAG_FACT_PRODUCTION_READINESS = FAIL`

## Scope and safety

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Production DB writes: `0`
- Gold mutations: `0`
- Mapping / Claim / Writer actions: `0`
- Provider calls in this audit: `0`

## Evidence

The existing 92-material Eval run produced 5 traceable facts from one material
and 91 failed/review-required material windows after 140 Gateway attempts. The
safe audit records 120 Gateway HTTP 422 rows (not proven Provider HTTP 422), 20
Gateway 200 semantic envelopes, 14 empty results from heading-only anchors, 17
network failures, and 5 grounding rejections. The five persisted facts share
one source span and require a granularity review.

Current Retrieval data is readable, but a write-free current 24-case expected-
source packet was not available. Historical Retrieval metrics remain historical
and are not relabeled as current certification.

## Targeted gate

The fixed 12-material targeted Fact run is `BLOCKED_EXTERNAL_AUTHORIZATION` by
the execution environment before external egress. No workaround, prompt
rewrite, model switch, or mock result was used. Because the targeted gate did
not execute, the 92-material resume condition is not met.

## Subverdicts

| Area | Verdict |
|---|---|
| RAG ingestion engineering | PASS |
| RAG retrieval quality | CONDITIONAL (current verification not executed) |
| RAG source authority | CONDITIONAL |
| Fact producer runtime | CONDITIONAL |
| Fact semantic quality | FAIL |
| Fact engineering integrity | CONDITIONAL |
| RAG/Fact performance | NOT_EVALUATED |
| Review burden | FAIL (prior 91/92 escalation is not certifiable) |

**Stop condition:** do not resume the remaining 80 materials or enter Mapping;
obtain explicit task-scoped egress authorization, run only the fixed 12, and
preserve the strict contract and fail-closed behavior.

## Regression evidence

- Fact-focused deterministic suite: 83/83 PASS, provider calls 0, production DB writes 0.
- Retrieval-focused suite: 43/50 PASS; 7 pre-existing `ENOENT` fixture/path failures in `retrieval-baseline.test.js` (`PRE_EXISTING_UNRELATED_BASELINE`).
- Backend unit suite: 1241/1255 PASS; 14 failures are pre-existing cwd-sensitive fixture/governance expectations and one Jiangyin audit fixture mismatch (`PRE_EXISTING_UNRELATED_BASELINE`).
- Frontend suite: 51/51 PASS.
- PostgreSQL integration suite: 0/61 PASS because host Node `pg` connections to the Docker-published port terminate before query; an in-container `pg_isready` and Node probe succeed. Classified `ENVIRONMENTAL`; no test rows were created.
- Requirement Eval: PASS (recall 100%, precision 100%, source verification 100%). Build, lint, and `git diff --check`: PASS.
