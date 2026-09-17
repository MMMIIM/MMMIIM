# Requirement Extraction Runtime & Model Decision

Status: **FROZEN — REQUIREMENT_EXTRACTION_V311_FROZEN**

Sections dated before 2026-08-30 are retained as historical V3/V3.1 decision
records. The V3.1.1 formal freeze section below is the sole current authority
for the active contract, runtime controls, evaluation identity, and handoff.

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

The promotion gate below is retained as historical V3 evidence; the V3.1.1
Freeze Baseline and reopening rules are authoritative from the section below.

Promotion gate: DS becomes active only after the exact FAST-01 sample passes through
the persistent Docker runtime with schema, source resolution, backend projection,
and no-truncation checks, with zero retry and zero fallback. If it fails, retain the
exact blocked status and diagnostics; do not silently revert the decision.

## V3.1.1 formal freeze and handoff (2026-08-30)

This section is the single traceable Freeze Baseline for the Requirement
Extraction V3.1.1 iteration. It records the already completed live evidence and
the eligible-Gold recertification; it does not change production semantics,
contracts, thresholds, or historical artifacts.

### Frozen active contract

| Field | Frozen value |
| --- | --- |
| Prompt | `4.3-requirement-extraction-v3.1.1` |
| Prompt instruction SHA-256 | `9b8fe6582e774a64f36b2be307274e297fafb309cf17270a4d8fc463da817305` |
| Candidate contract | `4.3-requirement-candidate-v3` |
| Candidate schema SHA-256 | `1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba` |
| Model | `deepseek-ai/DeepSeek-V4-Flash` |
| Provider | SiliconFlow |
| Structured output | `json_schema`, `strict=true` |
| Runtime controls | `max_tokens=4800`, `timeout=120000`, `concurrency=2`, `retry=0`, `fallback=0` |

The V3.1.1 source-range contract is the only active Requirement Extraction
source contract. V2/V2.3 contracts, `source_refs` model-output compatibility,
JSON-object downgrade, Qwen fallback, Dify fallback, hidden retry, and legacy
`:18080` routing are historical/non-runtime paths.

### Canonical live and evaluation identity

| Field | Frozen value |
| --- | --- |
| Source capture | `reqx-v311-canonical-post-fix-live-1788026179424-583a8c74` |
| Evaluation run | `reqx-v311-canonical-post-fix-evaluation-1788026179424-583a8c74` |
| Historical Provider requests | `13` |
| Historical accepted Candidates | `173` |
| New Provider requests in this closure | `0` |
| Dataset | `reqx-v3-real-tender-gold-pilot-v1.1-semantic-boundary` |
| Dataset cases | `199` |
| Evaluable Gold | `198` |
| Source-ambiguous Gold | `1` (`FAST-WATER-01-G071`) |
| Evaluation Contract | `reqx-v311-evaluation-contract-v2` |
| Evaluation Contract hash | `sha256:6acaab94a821d7132112234df9a5214d967159c53cf223be38132497527e9e28` |
| Evaluator revision | `sha256:01fc826559c5e97a6e59cba82381adc2af2eef5be161435018dc7efde1250eb7` |

Frozen Gold packet identities remain:

- FAST-01: 39 cases, `b8899d73111ade28e2d5765cc5a10822e4ffb95ee2869d701f83ee099343e576`
- FAST-WATER-01: 114 cases, `036c55e286db072ff73fe92b2ee2d237fb0d460321b7045cd6709f2f3ed589bf`
- TB-006: 46 cases, `311f974b754ce0d681698d56f5994b5b7f4939ee4b5266e0dc348825a882db1b`

### Final eligible-Gold quality baseline

The certification denominator is the 198 `SOURCE_CLEAR` Gold cases. The one
`SOURCE_AMBIGUOUS` case remains in lineage and reporting but is quarantined from
semantic quality denominators under ADR-016.

```text
FULL = 197
PARTIAL = 0
MISS = 1
semantic_coverage = 197 / 198 = 99.4949%
meaning_completeness = 197 / 198 = 99.4949%
mandatory Gold = 112
mandatory critical miss = 0
critical material omission = 0
harmful merge = 0
critical harmful merge = 0
scope leakage = 3 / 173 = 1.7341% (CONTROLLED)
```

All freeze criteria pass: semantic coverage `>=97%`, meaning completeness
`>=95%`, mandatory-critical miss `0`, critical material omission `0`, harmful
merge `<=2%`, critical harmful merge `0`, controlled scope leakage, stable
runtime, 100% production/evaluation parity, and 100% schema/source/backend
checks. Certification status is `SEMANTIC_CERTIFIED`; `semantic_certified=true`;
`freeze_valid=true`.

The retained long-tail negative control `FAST-WATER-01-G005-06` is
`SOURCE_CLEAR`, `MISS`, `NON_CRITICAL`, and `evaluation_eligible=true`. It is
not a Freeze blocker and must not be changed merely to pursue 100%.

### Accepted decisions and residual backlog

The following existing ADRs are the decision authority for this baseline and
all are **Accepted**:

- [ADR-013 — Evaluation Metric Authority and Semantic Namespace](decisions/013-evaluation-metric-authority-and-namespace.md)
- [ADR-014 — Canonical Production Path and Isolated Test Instances](decisions/014-canonical-production-path-and-isolated-test-instances.md)
- [ADR-015 — Source Ambiguity Must Not Be Silently Resolved](decisions/015-source-ambiguity-must-not-be-silently-resolved.md)
- [ADR-016 — Source-Ambiguous Cases Are Not Evaluable Gold](decisions/016-source-ambiguous-cases-are-not-evaluable-gold.md)

`FAST-WATER-01-G005-06` remains a documented non-critical miss. Cross-page
table-header binding (`header_context`/`header_cells` may be unavailable on a
continuation page) is a separate parser/table-quality backlog item and is **not
a V3.1.1 Freeze blocker**. Neither item is changed in this closure.

### Freeze and reopening rule

Requirement Extraction V3.1.1 is now a **FROZEN BASELINE**. Reopen it only for:

1. new real-production failure evidence;
2. a new Requirement Extraction contract version;
3. an explicit product requirement change;
4. a new Gold Dataset release; or
5. a security or correctness blocker.

Do not reopen it for a pursuit of 100% benchmark, one non-critical long-tail
miss, code cleanliness, metric cosmetics, or a non-blocking engineering
improvement. Any future change must create a new decision/evaluation lineage;
it must not rewrite this baseline or its historical artifacts.

### Historical integrity and audit references

The frozen Gold packets, historical semantic adjudication, historical
certification, and historical Provider capture remain unchanged. The eligible-
Gold recertification artifacts under the ignored `backend/eval/reports/`
directory are a new evaluation-contract-v2 lineage and do not overwrite the
historical contract-v1 artifacts. The freeze evidence is therefore auditable
from the source capture, the frozen Gold manifest, the source-ambiguity audit,
the recertification artifacts, and the evaluator revision above.

No `docs/glossary.md` exists in this repository; no standalone glossary system
was introduced. The four accepted terms (Gold Eligibility, SOURCE_AMBIGUOUS,
Evaluable Gold, Quarantined Case) are defined by ADR-016 and the recertification
contract.

### Handoff boundary

Requirement Extraction ends at:

```text
Tender Source → Requirement Candidate V3 → Canonical Requirement
```

The next business chain is:

```text
Canonical Requirement
        ↓
Enterprise Evidence
        ↓
Requirement-Evidence Mapping
        ↓
Sufficiency / Claim Gate
        ↓
Response Planning
```

Requirement Extraction does not own evidence retrieval, sufficiency decisions,
claim approval, response planning, or writing. Those downstream stages must
consume the canonical Requirement contract and remain separately governed.

### Closure verification

The final closure verification is read-only: freeze artifacts parse as strict
JSON; the 199-case Gold lineage and frozen packet hashes are intact; the
evaluation contract and evaluator revision match this record; Prompt/Candidate
identities match; ADR-013–016 are present and Accepted; historical artifacts
are unmodified; and `git diff --check` passes. This closure made no Provider,
DeepSeek, or Dify calls and performs no commit, push, or deploy.

**Freeze status: `REQUIREMENT_EXTRACTION_V311_FROZEN`.**
