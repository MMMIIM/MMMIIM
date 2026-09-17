# V43 Fact Provider Shape Canary Gate Checkpoint

## Contract

The canonical contract remained unchanged:

- task: `evidence_fact_extraction`
- version: `4.3-evidence-fact-extraction-v1`
- response format: strict `json_schema`
- schema name: `evidence_fact_extraction_data`
- parser: `envelope.data.facts[]` only
- legacy fallback: disabled
- schema-contract retry: `0`

The current Eval runner and safe Gateway telemetry were verified before the
canary. No Provider call was made during that verification.

## Canary result

Three sequential single-material runs were executed from the fixed targeted
set, with a total call cap of 4 and observed maximum concurrency of 1:

| Material | Provider | Gateway | Result |
| --- | ---: | ---: | --- |
| COM-01 | 200 | 422 | `OUTPUT_SCHEMA_INVALID` at `data.facts[0].domain_metadata` |
| COM-06 | 200 | 200 | strict valid envelope, `facts=[]`, review-required empty |
| CCV2-U13-01 | 200 | 422 | `OUTPUT_SCHEMA_INVALID` at `data.facts[0].domain_metadata` |

The two invalid responses had the same safe structural failure: an object was
returned where the schema requires non-empty namespace objects. No raw Provider
content or prompt was retained; only hashes, lengths, statuses, and safe paths
were recorded.

Aggregate:

- Provider calls: `3`
- Retries: `0`
- Wrong-shape rate: `2/3 = 66.67%`
- Contract-valid rate: `1/3 = 33.33%`
- Gateway envelope mismatch: `0`
- Unexplained 422: `0`
- Production DB writes: `0`
- Eval DB writes: `true` (isolated Eval DB only)
- Gold mutations: `0`

## Root cause and stop decision

Root cause is finalized as:

`B_PROVIDER_STRUCTURED_OUTPUT_FEATURE_MISMATCH`

The observed manifestation is Provider schema noncompliance: the Provider
accepts the strict JSON-schema request and returns HTTP 200, but does not
reliably satisfy the non-empty `domain_metadata` constraint. The adapter request,
Gateway validator, and Prompt/Schema conflict are not supported by this canary
evidence.

There is no safe deterministic projection. Filling or removing
`domain_metadata` would invent or discard business meaning, so the result must
remain fail-closed. No prompt, schema, Provider, or model change was made.

The 12-material rerun is not started. The next semantic Fact gate remains
blocked pending a separately approved Provider compatibility decision.
