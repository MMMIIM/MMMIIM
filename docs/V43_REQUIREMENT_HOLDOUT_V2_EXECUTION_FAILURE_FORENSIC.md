# V43_REQUIREMENT_HOLDOUT_V2_EXECUTION_FAILURE_FORENSIC_AND_OBSERVABILITY_CHECKPOINT

- HOLDOUT_V2_STATUS: FAILED_DEVELOPMENT_EVIDENCE
- SOURCE_RUN_ID: unseen-holdout-v2-2026-09-08T11-28-47-937Z-49fd034e
- HISTORICAL_PLANNED_EXECUTIONS: 78
- HISTORICAL_PROVIDER_CALLS: 78
- UNIQUE_FAILED_EXECUTION_COUNT: NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE
- FAILURE_ROOT_CAUSE: UNRECOVERABLE_FROM_EXISTING_EVIDENCE
- RECOVERED_FAILED_EXECUTIONS: 0
- UNRECOVERABLE_FAILED_EXECUTION_AGGREGATES: 1

## Failure evidence

- Schema failure aggregate: 2
- Provider failure aggregate: 2
- Schema/provider double counting: NOT_DETERMINED_FROM_EXISTING_AGGREGATES
- First-failure evidence complete: NO
- Source/parser/chunker failure evidence: NO_FAILURE_EVIDENCE_IN_RETAINED_ARTIFACTS

## Observability delta

- Runner observability patch: APPLIED_OFFLINE_NOT_CERTIFIED_BY_RERUN
- Execution journal fields now include execution identity, request hash, bounded diagnostics, first-failure stage/code, and separated counters.
- No V2 certification rerun was performed.

## Regression

- Requirement focused: PASS (105 tests)
- Frontend: PASS (51 tests)
- Build: PASS
- Lint: PASS
- git diff --check: PASS
- Root npm test: PRE_EXISTING_UNRELATED_BASELINE

## Side effects

- Provider calls: 0
- Production DB writes: 0
- Gold mutations: 0
- Mapping/Claim/Writer actions: 0

- FINAL_VERDICT: READY_FOR_GPT_REQUIREMENT_RUNTIME_FORENSIC_ADJUDICATION
