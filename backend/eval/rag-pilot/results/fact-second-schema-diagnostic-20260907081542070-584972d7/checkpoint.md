# V43 Fact Second Schema Violation Diagnostic

- run: fact-second-schema-diagnostic-20260907081542070-584972d7
- case: COM-01
- provider calls: 1
- retries: 0
- Provider reached: true
- HTTP status: 200
- normalizer invoked: NOT_OBSERVED_RUNTIME_REVISION (current source path projects before validation)
- unexpected properties: predicate
- validation path: data.facts[0]
- classification: TELEMETRY_NOT_OBSERVED (observed property classification: CONTRACT_DRIFT_REQUIRES_DECISION)
- semantic/grounding gate: NOT_RUN
- production DB writes: 0
- gold mutations: 0
- raw provider content persisted: false

STOP: Strict Fact Schema failed; fail-fast after the single permitted Provider call.
