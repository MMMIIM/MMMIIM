# Real Fact V2 Candidate Manifest

Eval-only source admission manifest. Candidates are source records pending Human Fact review; no Fact, Mapping, Claim, Writer, Provider, or Production result is created.

Candidates: 7
Eligible for Human Fact review: 0
Rejected: 7


## Rejection audit

- {"source_id":"SRC-ALIBABA-APIGW","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-TENCENT-APIGW","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-HUAWEI-APIGW","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-TENCENT-ISO27001","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-HUAWEI-GOV-CASE","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-TENCENT-GOV-CASE","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
- {"source_id":"SRC-H3C-CUSTOMER-CASE","status":"REJECTED","code":"SOURCE_SNAPSHOT_HASH_REQUIRED","message":"declared immutable snapshot SHA-256 is required"}
## Corpus gaps

- product_documentation: CORPUS_GAP
- qualification: CORPUS_GAP
- project_case: CORPUS_GAP

Promotion status: SOURCE_READY_FOR_HUMAN_FACT_REVIEW only; FACT_READY is never emitted.
