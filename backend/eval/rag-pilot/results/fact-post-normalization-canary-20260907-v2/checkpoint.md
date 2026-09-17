# V43 Fact Post-Normalization Canary Diagnostic Close

- case: COM-01
- provider calls: 1
- Provider reached: true
- HTTP status: 200
- normalizer invoked: NOT_OBSERVED
- validation path: data.facts[0]
- classification: SECOND_SCHEMA_VIOLATION_REVEALED
- historical pre-normalization validation path: data.facts[0].domain_metadata
- output contract valid: false
- durable telemetry: true
- three-case gate: NOT_STARTED
- production DB writes: 0
- gold mutations: 0
