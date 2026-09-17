# V43_FACT_OUTPUT_CONTRACT_RECOVERY_CHECKPOINT

## Offline phase

- Task: `evidence_fact_extraction` Provider Output → Gateway → Canonical Semantic Envelope
- Provider calls in this phase: **0**
- Production DB writes in this phase: **0**
- Gold mutations in this phase: **0**
- Historical run inspected: 22 calls; 19 Gateway `422 OUTPUT_SCHEMA_INVALID`, 3 Gateway `200`, Provider HTTP `200` for all 22.

## Contract identity

- Contract: `4.3-evidence-fact-extraction-v1`
- Request format: strict `json_schema`, name `evidence_fact_extraction_data`
- Task data: object with only `facts` (array)
- Gateway envelope: `schema_version`, `task_type`, `status`, `data`, `warnings`
- Fact parser: `envelope.data.facts[]` projected into Canonical Evidence Fact; no legacy fallback.

The exact Provider top-level keys for the 19 invalid rows were not retained by the prior runner. Three safe sampled rows are therefore recorded by call index, Gateway/Provider status, content length and hash only. Historical same-runtime canary diagnostics show representative nested violations (type/extra-field/empty-field), but are not substituted for the exact 22-row payloads.

## Ownership

The 19 schema failures are provisionally classified as `A_PROVIDER_DID_NOT_FOLLOW_REQUESTED_SCHEMA`: Provider HTTP 200 reached the Gateway, strict validation rejected the returned task data, the same runtime canary showed nested schema violations, and contract-parity tests pass. Configuration incompatibility, Gateway normalization, internal schema, parser expectation and prompt conflict are not supported by current evidence. Exact per-row paths remain a diagnostic gap.

## Remediation performed

1. Deterministic `OUTPUT_SCHEMA_INVALID` no longer consumes a corrective Provider retry (`SCHEMA_CONTRACT_RETRY=0`).
2. The Eval runner now persists only bounded probe metadata: validation paths/types, contract identity, generation controls and hashes. Provider content and parsed business data are never persisted by this telemetry projection.
3. Valid semantic-empty output remains distinct from a contract error; its bounded retry behavior is unchanged only when the context explicitly expects a Fact.

Focused offline regressions: Fact/Gateway/Eval 58/58 and Semantic Gateway contract 63/63. No external Provider was called.

## Verdict

`TARGETED_FACT_GATE = STOP_BEFORE_RERUN_PENDING_EXACT_SHAPE_EVIDENCE`

The same 12-material rerun may proceed only after the updated Eval runner and Gateway runtime are in use. Until its contract rate is measured, `RAG_FACT_PRODUCTION_READINESS = NOT_READY`; Retrieval Currentness remains not executed.
