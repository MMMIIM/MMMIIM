# V43 Fact Second Schema Violation Diagnostic

- run: fact-second-schema-diagnostic-20260907105153088-8f8a070b
- case: COM-01
- provider calls: 1
- retries: 0
- Provider reached: true
- HTTP status: 200
- normalizer invoked: true
- unexpected properties: predicate, object
- validation path: data.facts[0]
- classification: CONTRACT_DRIFT_REQUIRES_DECISION
- semantic/grounding gate: NOT_RUN
- production DB writes: 0
- gold mutations: 0
- raw provider content persisted: false

STOP: Strict Fact Schema failed; fail-fast after the single permitted Provider call.
