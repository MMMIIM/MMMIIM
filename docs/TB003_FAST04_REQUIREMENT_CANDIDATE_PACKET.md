# TB-003 / FAST-04 Requirement Candidate Packet

Recovery mode: persisted-artifact-only. This Eval-only packet contains no candidate rows because no recoverable candidate artifact is present. It does not call a Provider, create REQ-IDs, promote Gold, create Mapping, or write Production DB.

- provider_calls: 0
- production_db_writes: 0
- gold_mutations: 0
- total_candidate_count: 0
- recovery_status: BLOCKED_NO_PERSISTED_EXTRACTION_ARTIFACT

## Tender records

### TB-003
- source_file: backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf
- source_file_sha256: bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1
- source_status: OFFICIAL_SOURCE_VERIFIED
- parser_chunk_status: PASS
- parser_chunk_count: 33
- candidate_count: 0
- candidate_requirements: []
- recovery_status: BLOCKED_NO_PERSISTED_EXTRACTION_ARTIFACT
- existing_artifact_error_code: GATEWAY_NETWORK_ERROR
- recovery_reason: No candidate requirement rows are present in the current repository for this tender. Recovering requirement_text/source_excerpt/category would require another extraction run or a persisted extraction artifact; no Provider call or re-extraction was performed in this recovery task.

### FAST-04
- source_file: backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf
- source_file_sha256: 7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce
- source_status: OFFICIAL_SOURCE_VERIFIED
- parser_chunk_status: PASS
- parser_chunk_count: 50
- candidate_count: 0
- candidate_requirements: []
- recovery_status: BLOCKED_NO_PERSISTED_EXTRACTION_ARTIFACT
- existing_artifact_error_code: GATEWAY_NETWORK_ERROR
- recovery_reason: No candidate requirement rows are present in the current repository for this tender. Recovering requirement_text/source_excerpt/category would require another extraction run or a persisted extraction artifact; no Provider call or re-extraction was performed in this recovery task.

## Required candidate row shape

If a persisted artifact is later supplied, each row must contain candidate_id, requirement_text, source_excerpt, source_lineage and category. No row is synthesized here.

