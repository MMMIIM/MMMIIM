# V43 Requirement Output Truncation Forensic Checkpoint

- Decision: V43_REQUIREMENT_OUTPUT_TRUNCATION_AND_SHARED_PROVIDER_AUDIT_CLOSURE
- Historical run: unseen-holdout-v2-2026-09-08T16-24-57-426Z-69cf5c50 (78 executions, 77 successful, 1 failed)
- Failed execution: HOLDOUT-REQ-V2-01 / chunk 45 / hash 4e7b360135fc5e8f998e539c06cf022a7695346a961ba717fb073e8531892697
- Root classification: D_PROVIDER_ABNORMAL_VERBOSITY
- Provider calls in this task: 0

## Chunk 45 exact metrics

| Metric | Value |
|---|---:|
| Provider input characters | 2419 |
| Estimated input tokens | 1691 |
| Atomic source units | 79 |
| Table rows | 0 |
| Sections | 3 |
| Pages | 77-82 |
| Finish reason | length |
| Provider HTTP / Gateway HTTP | 200 / 502 |
| Safe error | OUTPUT_TRUNCATED |

## Successful controls

- Chunk 6: 2552 input chars, 2092 estimated input tokens, 56 units, 25 candidates, 5659 output chars, stop.
- Chunk 14: 2064 input chars, 990 estimated input tokens, 100 units, 19 candidates, 3414 output chars, stop.

## Output budget provenance

- Requirement input chunk token budget: 8000 (input only).
- Gateway/runner/provider output budget: 4800.
- Task-specific output override: absent.
- Request protocol: chat completions, field max_tokens=4800.
- Current code propagates the value through runner → gateway → adapter → request body.

## Telemetry

Shared probe-v1 telemetry is reused. Current code exposes requested provider/model, endpoint, Provider HTTP, response identity, finish reason, Gateway status, latency, parse/schema status, and safe error code. Historical journal identity remains partial (requested_model and endpoint were not retained); no values are inferred.

## Gates

- Offline Semantic Gateway/Provider audit: 65/65 PASS.
- Requirement path focused suite: 116/118 PASS; two unchanged requirement-source-parity-v2 baseline failures (5/6, 5/7) are unrelated and unmodified.
- Micro live proof: not executed because classification D requires STOP.
- Holdout V2 remains FAILED_DEVELOPMENT_EVIDENCE_PERMANENT; no certification is inferred.

## Safety

Provider calls = 0; production DB writes = 0; Gold mutations = 0; Mapping/Claim/Writer actions = 0; commit/push/merge/deploy = 0.

Final status: BLOCKED_PROVIDER_ABNORMAL_VERBOSITY
