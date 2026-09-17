# Host execution

This is an Eval-only, Host-only canary. The Codex sandbox must not run it.

```powershell
$env:V43_HOST_EXECUTION='true'
$env:V43_REQUIREMENT_RETRIEVAL_LIVE='true'
$env:V43_FACT_CANARY_LIVE='true'
if(-not $env:DATABASE_URL){throw 'Set DATABASE_URL to the isolated Eval DB before running; production database is forbidden.'}
$env:BACKEND_RUNTIME_MODE='container'
$env:EMBEDDING_PROXY_URL=''
$env:RETRIEVAL_PROJECT_ID='7a038c5d-38e4-46ae-b24d-39437bb3b545'
$env:RETRIEVAL_MATERIAL_NAME_PREFIX='HW-'
node backend/eval/real-e2e/run-requirement-retrieval-fact-canary.mjs
```

Run only from the repository root on the authorized Host. Outputs are 04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json, 05_FACT_CANARY_REPORT.json, and 06_CHECKPOINT.json in this handoff directory.
