# V43 FAST-01 Section Classifier P0 Repair

## Scope

This is a deterministic section-heading classification repair for
`V43-REAL-E2E-FAST01-20260911-0001`. It does not change Requirement semantics,
schemas, prompts, downstream routing, or authority contracts.

## Root cause confirmed

- The FAST-01 PDF extraction contains the chapter heading `第三章 用户需求书`
  (also rendered with a full-width space in some extraction variants).
- The existing parser recognizes `第…章 …` chapter headings.
- The existing technical-section taxonomy did not include `用户需求书`, so the
  heading became an unknown section and no `technical_requirements` section was
  returned.
- `RequirementParseService` then raised `NO_TECHNICAL_REQUIREMENTS_FOUND` at the
  section guard before chunking or Gateway invocation.

## Minimal repair

The existing `technical_requirements` taxonomy now accepts a bounded set of
procurement requirement heading synonyms, including `用户需求书`. The heading
parser additionally recognizes the same exact, short heading forms with an
optional numeric prefix (`3 用户需求书` / `用户需求书`). It does not scan body
paragraphs for keywords and contains no tender/project/filename rule.

## TDD evidence

The focused regression was added first and failed against the pre-repair
behavior. After the minimal classifier change it passes for:

- `第三章 用户需求书`
- `第三章　用户需求书`
- `3 用户需求书`
- `用户需求书`

The negative control `第五章 合同条款及格式` with body text mentioning
`项目需求` remains a contract/legal section and is not promoted.

## Core6 mechanical heading regression

All six source extractions expose a requirement-bearing section after the
repair. Five use the existing heading taxonomy; TB-003 uses the pre-existing
controlled full-text fallback and remains `UNKNOWN` by design. This is a
mechanical section result, not a semantic recall judgment. Detailed rows and
source hashes are in
`docs/V43_CORE6_REQUIREMENT_SECTION_HEADING_REGRESSION.json`.

## Safety

No Provider/LLM call was made during classifier verification. No Gold or
Production domain records were mutated by the repair. The original FAST-01 V1
failure artifacts remain unchanged.

## FAST-01 V2 production-shaped regression

The fresh V2 project reached the repaired section classification (`用户需求书`
→ `technical_requirements`) and generated 25 chunks; the original
`NO_TECHNICAL_REQUIREMENTS_FOUND` did not recur. The run then stopped at the
existing `tender_parse_chunks_check` persistence constraint for chunk 6
(`source_start_offset=45345`, `source_end_offset=7705`) before any Gateway or
Provider call. This downstream blocker is recorded without an automatic fix in
`docs/e2e/FAST01_V2/`.
