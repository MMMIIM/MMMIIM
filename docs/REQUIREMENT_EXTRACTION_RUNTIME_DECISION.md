# Requirement Extraction Runtime & Model Decision

Status: **ACTIVE — DS FLASH + CANDIDATE V3 LIVE VERIFIED**

## Source-range contract closure (2026-08-28)

The previous DeepSeek FAST-01 run is classified as
`SOURCE_REF_CONTIGUITY_CONTRACT_GAP`, not a model rejection. Provider transport,
strict Candidate V2 validation and no-truncation checks passed; one candidate
used a non-contiguous source-reference set that the unchanged backend resolver
correctly rejected. The active runtime now uses the clean-break Candidate V3
contract `4.3-requirement-candidate-v3` and prompt contract
`4.3-requirement-extraction-v3`.

Candidate V3 replaces the model-facing `source_refs` array with a strict
`source_range` object containing only `start_ref` and `end_ref`. The two
endpoints must be deterministic `Cxxx-Sxxx` identifiers in the current chunk,
with start before or equal to end; the backend expands the contiguous slice and
derives canonical `source_refs` and all source provenance. Unknown, malformed or
reversed ranges fail closed. V2/V2.3 are historical/superseded and have no
runtime fallback or alias.

The persistent development Gateway `/info` also reports a safe Git source
revision (and, when known, `working_tree_dirty`) injected by the runtime
bootstrap; it never exposes provider credentials.

Active prompt version/hash:
`4.3-requirement-extraction-v3`
`de424ed7fa81a476c2021f35b6c63babd654c32e48bf3d42ec0380356fd4c589`.

Active Candidate schema version/hash:
`4.3-requirement-candidate-v3`
`1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba`.

## V3 milestone freeze (2026-08-28)

The exact FAST-01 sample passed once through the persistent runtime:

- Provider HTTP 200: 7/7
- `finish_reason=stop`: 7/7
- Candidate V3 schema: 7/7 PASS
- source-range resolution: 7/7 PASS
- backend ingestion: 7/7 PASS
- truncation: 0
- unresolved ranges: 0
- out-of-window ranges: 0
- reversed ranges: 0
- malformed ranges: 0
- retries: 0
- fallbacks: 0
- total accepted candidates: 51

The run used seven deterministic production windows (`780/42`, `462/23`,
`936/50`, `679/50`, `450/20`, `991/48`, `626/22`) from the 4930-character,
255-span FAST-01 extraction. This evidence is the accepted V3 live verification;
the live call is not repeated merely for milestone freeze.

Candidate V2's model-facing `source_refs` array was superseded because it could
not structurally represent contiguity. Candidate V3's `source_range` object is
the sole active Requirement Extraction source contract. The backend expands the
validated contiguous range and derives canonical `source_refs` and provenance.
V2/V2.3 remain historical only and have no runtime compatibility or fallback.

## Runtime decision

- Docker Desktop owns the development lifetime of PostgreSQL, Semantic Gateway, and Backend.
- `npm run runtime:up` is the normal persistent runtime entry point.
- `npm run runtime:refresh` rebuilds and recreates Backend/Gateway without removing the PostgreSQL volume.
- Codex may edit and test the repository but does not own long-lived foreground runtime processes.
- Docker Desktop is the canonical persistent service owner; Codex sandbox Docker permission is not an application dependency.
- Host bootstrap: `npm run runtime:bootstrap`.
- Normal Codex-safe check: `npm run runtime:health` (localhost HTTP/TCP only).
- Dependency or infrastructure refresh: `npm run runtime:refresh`.
- Normal source edits hot-reload through targeted source mounts; no host PowerShell watcher is required.
- Compose marks the Backend as `container` mode so its injected service endpoints
  remain authoritative over the mounted local `backend/.env`.

## Model decision

Selected Requirement Extraction candidate: `deepseek-ai/DeepSeek-V4-Flash`

Provider: SiliconFlow through the OpenAI-compatible adapter.

Generation controls:

- `enable_thinking=false`
- `response_format=json_schema`, `strict=true`
- `temperature=0.1`
- `top_p=1`
- `top_k=50`
- `frequency_penalty=0`
- `max_tokens=3200`
- `stream=false`
- `n=1`
- `timeout=120000`

`thinking_budget` and `reasoning_effort` are not sent. There is no Qwen fallback,
retry, or JSON-object downgrade.

Qwen is not preferred for this task because the recorded FAST-01 evidence showed
one source-reference failure and one truncated 3200-token response. Earlier DS
attempts ended before a usable model response because of runtime transport
conditions, so they are not model-quality evidence.

Promotion gate: DS becomes active only after the exact FAST-01 sample passes through
the persistent Docker runtime with schema, source resolution, backend projection,
and no-truncation checks, with zero retry and zero fallback. If it fails, retain the
exact blocked status and diagnostics; do not silently revert the decision.
