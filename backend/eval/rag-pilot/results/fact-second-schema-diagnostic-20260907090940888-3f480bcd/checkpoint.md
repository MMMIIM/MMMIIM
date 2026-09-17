# V43 Fact Second Schema Violation Diagnostic

- run: fact-second-schema-diagnostic-20260907090940888-3f480bcd
- case: COM-01
- provider calls: 1
- retries: 0
- Provider reached: true
- HTTP status: 200
- normalizer invoked: null
- unexpected properties: none
- validation path: data.facts[0].domain_metadata
- classification: TELEMETRY_NOT_OBSERVED
- semantic/grounding gate: NOT_RUN
- production DB writes: 0
- gold mutations: 0
- raw provider content persisted: false

STOP: Strict Fact Schema failed; fail-fast after the single permitted Provider call.
