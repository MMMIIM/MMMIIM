# V43 Eval / BadCase Flywheel V1 checkpoint

Status: `READY_FOR_GPT_EVAL_FLYWHEEL_V1_IMPLEMENTATION_REVIEW`

The Eval-only foundation is implemented on branch
`feat/v4.3-semantic-boundary-routing` at HEAD
`f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`. The worktree remains dirty by
design; pre-existing changes were preserved.

## Verification

- Focused flywheel suite: **16/16 PASS**.
- P0 trace: **487/487 unique atoms**, source-truth SHA
  `9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0`.
- Deterministic evaluation rows: 487; no semantic labels were inferred.
- Frontend suite: **51/51 PASS**; build, lint and `git diff --check`: PASS.
- Full backend unit run retains 23 pre-existing unrelated baseline/fixture
  failures; they are recorded in the machine-readable baseline registry.
- PostgreSQL regression was not run because the existing suite writes to the
  `bid_platform` database, while this Decision requires zero production DB
  writes.

## Safety and boundaries

Provider/LLM calls, Production DB writes, Gold mutations, migrations, commits,
pushes, merges and deploys are all zero. The default `EvalEvidenceSink` is a
no-op; restricted evidence capture requires explicit Eval mode and a
non-shareable root. No production module imports the flywheel.

The trace keeps absent persisted stages as `EVIDENCE_NOT_PERSISTED`: Provider
Input, Raw Candidate and Normalization are absent for all 487 atoms; Chunk,
Source Resolution and Canonical Requirement are absent for 483 atoms. Four
atoms link to the existing production artifact. This is an evidence-coverage
statement, not a semantic quality claim.

Task 9 remains `SEED_LEDGER_INPUT_PENDING_GPT` because the exact frozen 44-row
ledger was not supplied; Codex created zero semantic BadCase labels.

All five downstream readiness gates remain **NO**. This checkpoint does not
freeze or promote Requirement, Fact, Mapping, Claim or Writer Gold and does not
authorize live Provider evaluation.
