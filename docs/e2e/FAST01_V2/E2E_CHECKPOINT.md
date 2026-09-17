# V43 FAST-01 P0 Section Classifier Repair — V2 E2E

- Run: `V43-REAL-E2E-FAST01-20260911-0002`
- Project: `4f7f770f-2998-44c9-b860-5b5b650ce210`
- Tender file: `6b080989-7b0a-40be-b0f7-304c92595439`
- Parse job: `54bcfd98-9bed-44e3-856d-15d0ee4ceb22`
- Source SHA-256: `8048485301cad27536c6f4a44e355c8ae05a5ded0ebb537ab9d6a61900d92c29`

## Section-classifier repair result

`REQUIREMENT_SECTION_FOUND=YES`; observed heading `用户需求书` was classified as
the existing `technical_requirements` / `REQUIREMENT_ELIGIBLE` role. The original
`NO_TECHNICAL_REQUIREMENTS_FOUND` failure did not recur. Text extraction passed
and 25 chunks were generated.

## New downstream blocker

The normal persistence path rejected the generated chunk batch with PostgreSQL
constraint `tender_parse_chunks_check` (`23514`) before the first Gateway call.
For chunk 6, the safe structural values were `source_start_offset=45345` and
`source_end_offset=7705`, violating the existing `source_end_offset >
source_start_offset` check. This is a new downstream P0 flow blocker; no fix was
attempted in this Decision.

## Counts and safety

- Candidate / canonical requirements: `0 / 0`
- Router, Safe Packet, Writer, reconciliation: `NOT_REACHED`
- Provider / LLM calls: `0`; retries: `0`
- Direct/manual DB writes: `0`
- Authorized normal API records: `3` (project, tender file, parse job)
- Gold mutations: `0`

The original V1 artifacts remain unchanged. No Prompt, Schema, Requirement,
Router, Fact, Mapping, Claim, Writer or Validator semantics were modified.
