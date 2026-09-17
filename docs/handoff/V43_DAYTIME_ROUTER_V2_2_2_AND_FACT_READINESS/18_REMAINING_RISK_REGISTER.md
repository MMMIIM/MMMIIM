# Remaining Risk Register

- Router V2.2.2 deterministic safety gates pass on the frozen 2178-row replay.
- 79 V2.2.1→V2.2.2 changed rows and 17 NEED_REVIEW rows remain for GPT semantic adjudication; no Codex semantic labels are assigned.
- Reference V3 informational P0 human-gate residual: 9.
- Backend full-suite baseline remains 29 failures with an equivalent recorded identity/signature set; no new task regression was observed.
- PostgreSQL regression was not run because no isolated writable test database was available.
- Real Fact V2 readiness remains blocked at NO_ELIGIBLE_SOURCE: current projection has zero REAL_ENTERPRISE_EVIDENCE_CANDIDATE materials.
- No Provider/LLM calls, production DB writes, Fact writes, Gold mutations, or production semantic changes occurred in this task.

## Decision status

Router implementation is engineering-complete pending GPT semantic freeze. Real Fact V2 remains a separate data-source blocker.
