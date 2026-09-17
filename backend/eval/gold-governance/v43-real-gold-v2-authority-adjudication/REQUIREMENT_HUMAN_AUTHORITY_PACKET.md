# Requirement Human Authority — Bounded Re-extraction Packet

Eval-only blind packet. Candidates are derived from the frozen Requirement Extraction path and require independent Human Authority review. No formal Requirement ID or Gold decision is included.

Tender count: 3

## JY-001

- extraction_status: BLOCKED_PROVIDER_OR_CONTRACT
- declared_source_sha256: bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145
- actual_source_sha256: bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145
- source_sha_match: true
- production_chunk_count: 14
- provider_calls: 1
- retry_count: 0
- historical_provenance: backend/eval/reports/jiangyin-full-requirement-rag-fitness-v1.json

- first_failure_code: GATEWAY_NETWORK_ERROR
- first_failure_message: Semantic Gateway 网络请求失败。

- No candidate was produced before the recorded bounded stop.

## TB-003

- extraction_status: NOT_ATTEMPTED_AFTER_FIRST_FAILURE
- declared_source_sha256: bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1
- actual_source_sha256: bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1
- source_sha_match: true
- production_chunk_count: 33
- provider_calls: 0
- retry_count: 0
- historical_provenance: none

- No candidate was produced before the recorded bounded stop.

## FAST-04

- extraction_status: NOT_ATTEMPTED_AFTER_FIRST_FAILURE
- declared_source_sha256: 7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce
- actual_source_sha256: 7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce
- source_sha_match: true
- production_chunk_count: 25
- provider_calls: 0
- retry_count: 0
- historical_provenance: none

- No candidate was produced before the recorded bounded stop.

## Human review boundary

- Verify each candidate against the original PDF and cited source span.
- Historical artifacts are reconstruction evidence only.
- Do not infer a prior expected PASS/FAIL decision.
- Do not assign a formal REQ-ID or promote Requirement Gold in this packet.

