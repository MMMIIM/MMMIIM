# V43 Requirement Fixed-48 Runtime and Semantic Certification Gate

Status: `FAIL_CLOSED_RUN_AUDIT_INCOMPLETE`

- Frozen case/source identity: 48/48 input hashes and source SHA checks passed.
- First probe (`FIXED48-01`): Provider reached, HTTP 200, schema/source/canonicalization passed, truncation false, 13,183 ms.
- Bulk execution did not produce a persisted per-case artifact before the process exited.
- Provider calls observed: 1; additional calls are unaccounted and therefore treated as unknown.
- Retries: 0. No rerun is permitted because the 48-call budget cannot be proven unused.
- Gateway provider family: `semantic_gateway`; actual provider reached: `openai_compatible`.
- Model identity: `PROVIDER_NOT_EXPOSED` (performance remains conditional).
- Production DB writes: 0; Gold mutations: 0.
- Output-side 239 and source-side 72 adjudication were not started.

First failure: `FIXED_48_RUNNER_TELEMETRY_NOT_PERSISTED`.

No provider raw response, full prompt, API key, or authorization header was persisted.
