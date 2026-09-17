# V43 Fact Post-Normalization Canary Diagnostic Close

- Scope: `COM-01` only
- Provider calls: `1`
- Retries: `0`
- Provider reached: `true`
- Provider HTTP status: `200`
- Gateway HTTP status: `422`
- Gateway failure: `OUTPUT_SCHEMA_INVALID`
- Response shape: `wrong_shape`; JSON parse: `true`; schema valid: `false`
- Normalizer invocation: `NOT_OBSERVED` (runtime did not expose a normalization count)
- Exact current validation path: `data.facts[0]`
- Expected shape: `no additional properties`
- Observed type: `object`
- Historical pre-normalization path: `data.facts[0].domain_metadata`
- Classification: `SECOND_SCHEMA_VIOLATION_REVEALED`
- Durable per-case telemetry: `PASS`
- COM-01 gate: `FAIL_CLOSED`
- Three-case gate: `NOT_STARTED`
- Fixed-12 material gate: `NOT_STARTED`

Runtime identity: Gateway `/info` HTTP `200`, build `f509514`, task registry loaded, Fact contract `4.3-evidence-fact-extraction-v1`; local and runtime schema/instruction hashes matched. `/info` does not expose a normalization-count field.

Safety: production code unchanged, Provider/Prompt/Schema unchanged, production DB writes `0`, Gold mutations `0`, raw Provider content and credentials not persisted.

Per fail-fast policy, COM-06 and CCV2-U13-01 were not called.
