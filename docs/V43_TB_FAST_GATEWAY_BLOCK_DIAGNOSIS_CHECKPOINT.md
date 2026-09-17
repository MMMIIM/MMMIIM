# V43 TB-003 / FAST-04 Gateway Block Diagnosis Checkpoint

- Mode: `READ_ONLY_GATEWAY_BLOCK_DIAGNOSIS`
- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Provider calls: `0`
- Gateway attempts: `2` (one bounded first-chunk request per tender)
- Retries: `0`
- Production DB writes: `0`
- Gold mutations: `0`

## TB-003

- Source present: true
- Source SHA-256: bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1
- Parser/chunker: PASS; 91 pages, 2239 paragraphs, 33 chunks
- Gateway payload: BUILT; keys=project_name,section_name,chunk_index,chunk_count,chunk_text; payload hash=a04957d8a0377135626afdc6045c53918a002f7c57aab0b2fd72d898c04c7dad
- Gateway response: HTTP not reached; body not received
- Error code: `GATEWAY_NETWORK_ERROR`
- Failure class: `environment`
- Provider reached: false
- Candidates: 0
- Retry count: 0

## FAST-04

- Source present: true
- Source SHA-256: 7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce
- Parser/chunker: PASS; 119 pages, 4590 paragraphs, 50 chunks
- Gateway payload: BUILT; keys=project_name,section_name,chunk_index,chunk_count,chunk_text; payload hash=17d432b8100c2f019b24cb2a873793f633ae16cdd6fe0a9e947000080669b78f
- Gateway response: HTTP not reached; body not received
- Error code: `GATEWAY_NETWORK_ERROR`
- Failure class: `environment`
- Provider reached: false
- Candidates: 0
- Retry count: 0

## Environment fingerprint

- Backend target: http://127.0.0.1:3001; TCP reachable=true, HTTP reachable=false
- Gateway target: http://127.0.0.1:18082; TCP reachable=true, HTTP reachable=false
- Config source: canonical_semantic_gateway
- Provider configured: false
- Node: v24.19.0
- Credential values: not recorded

## Classification

Both documents passed local extraction and deterministic chunking. The fresh semantic attempt stopped at the local Semantic Gateway transport layer with `GATEWAY_NETWORK_ERROR`; no provider call or candidate inference occurred.
