# V43 Requirement Final Runtime Smoke Provider-Unavailable Forensic

## Result

`READY_FOR_USER_AUTHORIZATION_FOR_FINAL_REQUIREMENT_RUNTIME_SMOKE_RETRY_IN_HOST_ENV`

The previously authorized smoke attempt is consumed. No live retry was performed in this forensic.

## Failed execution

- Run ID: `requirement-task-budget-smoke-2026-09-09T09-01-08-432Z-cc4d3e1e`
- Execution ID: not recorded by the failed artifact
- Task: `requirement_extraction`
- Target: `HOLDOUT-REQ-V2-01`, Chunk `45`
- Provider: `openai_compatible` / `api.siliconflow.cn`
- Model: `deepseek-ai/DeepSeek-V4-Flash`
- Endpoint: `/chat/completions`
- Gateway HTTP: `502`
- Provider HTTP: not received
- Failure stage: `FETCH_INVOKED`
- Safe error: `PROVIDER_UNAVAILABLE`
- Latency: `31 ms`

The smoke artifact records that the request body and headers were constructed and fetch was invoked. It does not retain the underlying fetch exception or OS error code. No raw response, prompt, headers, or secret was persisted.

## Output-budget wiring

The failed run could not return task-router audit fields, so its persisted resolved budget is `null`; this is an observability consequence of the transport failure, not evidence of a wrong budget.

An offline production-shaped task-router/provider request-construction probe verified:

- `requirement_extraction` configured default: `4800`
- resolved task budget: `9600`
- task override applied: `true`
- outbound request-body max tokens: `9600`
- representative non-Requirement tasks remain at `4800`

Budget wiring: `PASS`. Global budget regression: `false`.

## Transport comparison

Reused evidence from `docs/V43_REQUIREMENT_PROVIDER_CONNECTIVITY_FORENSIC_CHECKPOINT.json`:

| Probe | Codex sandbox | Host execution |
|---|---|---|
| DNS | PASS | PASS |
| TCP 443 | FAIL (`EACCES`) | PASS |
| TLS/HTTPS | FAIL (`EACCES`) | PASS |

The latest failed artifact lacks its own OS error code, but it ran in the same Codex sandbox execution topology and failed before any provider HTTP response. The available evidence supports the same isolated-environment transport pattern.

## Classification

`A_SAME_ISOLATED_ENVIRONMENT_EACCES`

This is a transport/connectivity limitation, not a Requirement semantic failure, output-budget failure, schema failure, or model failure.

## Safety

For this forensic task:

```text
PROVIDER_CALLS = 0
LLM_CALLS = 0
PRODUCTION_DB_WRITES = 0
GOLD_MUTATIONS = 0
MAPPING = 0
CLAIM = 0
WRITER = 0
ROUTER_V2_CHANGES = 0
COMMIT = 0
PUSH = 0
MERGE = 0
DEPLOY = 0
```

No code, Prompt, Schema, Provider, Model, or configuration was modified. No automatic retry was performed.

Next permitted step: obtain explicit user authorization for one final retry executed in the host network environment.
