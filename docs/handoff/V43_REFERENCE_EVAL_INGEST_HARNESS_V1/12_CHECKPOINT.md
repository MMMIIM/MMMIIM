# V43 Reference Eval Ingest Harness V1

Status: READY_FOR_HUMAN_HOST_REFERENCE_EVAL_INGEST_EXECUTION

Dry-run validated 11 frozen sources, 5211 planned chunks, 6 HTML adapters and 5 production PDF parser paths. Source SHA verification passed.

V3 baseline manifest SHA256: c2087cd46a1642452915658ff1e687be27e40e4c674008a85ad63f780b7fcdae; expected exact baseline {"materials":34,"chunks":318,"embeddings":382} with no re-chunk, re-embed, or ID regeneration.

Role: REFERENCE_ONLY; HTML fidelity: PARTIAL_EVAL_ADAPTER. Fact/Mapping/Claim/Writer paths are unreachable.

Provider calls, embedding calls, DB writes and Production writes in this dry-run: 0.

Host execution is not run from Codex; the command is recorded in 11_HOST_EXECUTION_PLAN.json.
