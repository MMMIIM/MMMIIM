# V43 Requirement Source Resolution / Canonicalization Gate Checkpoint

## Scope

This checkpoint records an offline, zero-Provider replay of the retained
candidate artifacts. It does not certify a new live smoke run and does not
promote any Requirement or Gold artifact.

## Safety

- Provider calls: `0`
- Production DB writes: `0`
- Gold mutations: `0`
- Production semantic changes: `0`
- Six-case live smoke: not executed
- 48-case benchmark: not executed

## Historical observability

The retained historical diagnostics contain counts, hashes, statuses, and
stage summaries, but not the complete candidate payloads for TB-003 attempt 1,
TB-003 attempt 2, or FAST-01 attempt 1. Candidate-level historical comparison
is therefore not executed. This is recorded as
`HISTORICAL_PAYLOAD_OBSERVABILITY_GAP`, not as an inferred semantic cause.

## Stage-separated offline replay

The Eval boundary now reports Source Resolution, Canonicalization, and Quality
Gate independently, including failure code and candidate index where available.
An empty valid provider payload is classified as a Quality Gate review result,
not as a Source Resolution or Canonicalization failure.

Retained-packet replay was run three times per packet with no external calls:

- TB-003 packet: 265 candidates, 33 prepared chunks, 29 grouped chunks;
  Source Resolution 29/29, Canonicalization 29/29, Quality Gate PASS 3/29.
- FAST-01 packet: 39 candidates, 7 packet windows, 6 grouped windows;
  Source Resolution 4/6, Canonicalization 4/6. The two unresolved groups are
  retained-packet source-span cases and are not treated as the historical live
  attempt.

All three replays of each retained packet were deterministic.

## Wrapper regression

The TB-006 local Eval wrapper regression is PASS: it consumes `smoke_cases`
directly and does not infer status from a non-existent `result` property.

## Decision

`REQUIREMENT_SOURCE_RESOLUTION_CANONICALIZATION_GATE = BLOCKED_PENDING_HISTORICAL_PAYLOAD_ARTIFACT`

The bounded live revalidation (TB-003, FAST-01, TB-006; then FAST-04 and
FAST-WATER-01 only if the first three pass) has not started. No Provider call,
database write, Gold mutation, or production semantic change was made by this
checkpoint.
