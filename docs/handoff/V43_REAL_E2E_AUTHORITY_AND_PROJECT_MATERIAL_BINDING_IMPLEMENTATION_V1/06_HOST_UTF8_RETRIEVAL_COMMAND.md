# Host UTF-8 retrieval smoke

Run from Windows PowerShell on the host that can reach the configured embedding provider. This uses the reusable Eval-only runner and the canonical `EmbeddingClient` + `PgRepository` authority query. It does not call the writeful `EnterpriseRetrievalService`, and it writes only the JSON diagnostic artifact.

```powershell
Set-Location 'D:\AI工作\AI\标书平台\标书平台'
$env:DATABASE_URL = 'postgresql://bid_user:bid_password@127.0.0.1:5432/bid_platform_flow_audit_test'
$env:BACKEND_RUNTIME_MODE = 'container'
$env:EMBEDDING_PROXY_URL = ''
$env:RETRIEVAL_PROJECT_ID = '7a038c5d-38e4-46ae-b24d-39437bb3b545'
$env:RETRIEVAL_MATERIAL_NAME_PREFIX = 'HW-'
$env:RETRIEVAL_SMOKE_OUTPUT = 'docs/handoff/V43_REAL_E2E_AUTHORITY_AND_PROJECT_MATERIAL_BINDING_IMPLEMENTATION_V1/host-retrieval-utf8.json'
node 'backend/eval/real-e2e/run-retrieval-smoke-utf8.mjs'
```

The runner preserves the explicitly supplied Host `DATABASE_URL` and does not silently replace it from `backend/.env`. The process environment must provide the existing embedding credentials/model configuration; do not paste secrets into the command or output. The runner requires `EMBEDDING_PROXY_URL` to be empty and records `transport = DIRECT_HTTPS`.

The output records each query's UTF-8 code points and byte length, rank, score, material/chunk IDs, source excerpt, source lineage and `low_information_chunk`, plus `TOTAL_RETURNED`, `LOW_INFORMATION_RETURNED`, `LOW_INFORMATION_RATE`, `NON_EMPTY_SEMANTIC_TEXT_RETURNED`, provider-call count and zero-write guards.

No Requirement text, Fact, Mapping, Claim, Writer or Gold operation is performed.
