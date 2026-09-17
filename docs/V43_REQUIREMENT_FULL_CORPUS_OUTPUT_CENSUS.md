# V43 Requirement Full Corpus Output Density and Truncation Census

- Generated: 2026-09-09T10:11:42.504Z
- Canonical requirements: 2178/2178
- Unique extraction windows: 238
- Exact runtime telemetry windows: 78
- Partial runtime telemetry windows: 91
- Reconstructed-from-artifacts windows: 69
- Structural-only windows: 0
- Unresolved window identity: 0
- Confirmed truncation windows: 1
- Measured truncation rate (incomplete denominator): 0.78%
- GLOBAL_TRUNCATION_RATE: NOT_REPORTABLE
- Successful completion telemetry samples: 3
- Successful completion >4800: 1
- Review packet windows: 4

## Cohorts

| Cohort | Requirements | Windows | Exact | Partial | Reconstructed | Confirmed truncation |
|---|---:|---:|---:|---:|---:|---:|
| CORE6 | 1009 | 117 | 0 | 48 | 69 | 0 |
| HOLDOUT_V1 | 397 | 43 | 0 | 43 | 0 | 0 |
| HOLDOUT_V2 | 772 | 78 | 78 | 0 | 0 | 1 |

## Safety

Provider/LLM calls, production DB writes, Gold/canonical mutations, Mapping/Claim/Writer actions, and Router changes: 0.

Runtime telemetry is heterogeneous and incomplete; unavailable token/output/failure fields are not inferred. V2 canonical requirements without source refs remain explicitly unmapped for window-level audit flags. No extraction was rerun.

## Truncation and budget

- Confirmed truncation attempts: 1 (HOLDOUT-REQ-V2-01 Chunk 45; `finish_reason=length` / `OUTPUT_TRUNCATED` in the historical attempt).
- Measured execution denominator with explicit finish/error evidence: 129; measured truncation rate: 0.78%.
- `GLOBAL_TRUNCATION_RATE = NOT_REPORTABLE` because telemetry does not cover every unique window.
- Successful token telemetry samples with an observed resolved ceiling: 3; completion-token p50/p75/p90/p95/p99/max: 2525 / 3993 / 4873.8 / 5167.4 / 5402.28 / 5461; resolved ceiling: 9600 throughout; no sample reached 70% of its ceiling.
- Successful completion tokens above 4800: 1 window (Chunk 45, 5461 tokens; later successful micro run).

## Structural density

Density is an audit-only mean of component percentile ranks over available `source_characters`, `source_unit_count`, `candidate_count`, and `canonical_requirement_count`; no global high-density threshold is imposed. Top-ranked windows are recorded in the JSON census and ledger. Density percentiles are unavailable for windows whose source structure is not present in the retained artifacts.

## Requirement-level audit coverage

All 2178 canonical requirements carry audit-only flags. 1406 have a resolved source-window identity; 772 HOLDOUT_V2 requirements retain `UNMAPPED_SOURCE_WINDOW_IDENTITY` because their canonical artifact has no source refs. No canonical requirement text or labels were changed.

The blind GPT review packet contains the deterministic union of confirmed-truncation, budget-pressure, successful-completion-over-4800, top-1%-density, and required Chunk 45 windows (4 windows total). It contains source text only where retained safely; other windows use lossless source-file/hash/reference coordinates. No Provider/LLM call, production write, Gold mutation, or semantic classification occurred.
