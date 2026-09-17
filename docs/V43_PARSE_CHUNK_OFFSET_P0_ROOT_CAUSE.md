# V43 Parse Chunk Offset P0 — Root Cause and Repair

## Root cause

`RequirementParseService` builds the extraction scope from routed sections. The
scope may contain overlapping sections, while each paragraph retains its
document-absolute source offsets. `combineRequirementExtractionSections()`
sorted only whole sections, so the flattened paragraph sequence could return to
an earlier document position. FAST-01 therefore produced chunk 6 with
`source_start_offset=45345` and `source_end_offset=7705`; PostgreSQL correctly
rejected that invalid range with `tender_parse_chunks_check` / SQLSTATE `23514`.

The defect was a source-order construction problem, not a database constraint
problem and not a Requirement semantic decision. No coordinate swapping,
clamping, synthetic offsets, or constraint weakening is used.

## Minimal repair

The existing requirement-scope composition now deterministically orders the
flattened paragraphs by their backend-owned `source_start_offset` and removes
only exact duplicate `(start, end, text)` spans introduced by overlapping
section views. Paragraphs without offsets are retained in stable input order.
Chunk budgets, heading taxonomy, prompts, schemas, and downstream contracts are
unchanged. Persisted chunk offsets remain document-absolute and satisfy:

```text
0 <= source_start_offset < source_end_offset <= extracted_text.length
```

## TDD evidence

The regression first failed with the paragraph order `第一段、第三段、第二段`
and passed after the repair. It covers a non-zero document base offset,
overlapping section views, multiple chunks, bounds, and deterministic replay.

## Core6 mechanical result

`docs/V43_CORE6_CHUNK_OFFSET_INTEGRITY.json` records all six source PDFs. All
six requirement scopes produced valid, in-bounds, reconstructable chunk ranges:

```text
INVALID_OFFSET = 0
OUT_OF_BOUNDS = 0
NON_RECONSTRUCTABLE = 0
```

## Safety

Phase-A verification used no Provider/LLM calls, no Gold mutations and no
manual database writes. The PostgreSQL constraint remains unchanged.

## FAST-01 V3 production-shaped verification

Fresh project `23d0d9e5-2e1e-4cf6-a2d6-bcfd61771158` (parse job
`82a8ba86-e16b-42e3-943d-31dd0e2259a8`) re-ran the normal API path against the
same source SHA. The requirement section was found, 26 chunks were generated
and persisted, and all 204 candidates were source-verified. Invalid,
out-of-bounds, and non-reconstructable offset counts were all zero; the prior
SQLSTATE 23514 offset failure did not recur. The run reached Gateway/provider
and canonicalization. Semantic quality adjudication was not performed.
