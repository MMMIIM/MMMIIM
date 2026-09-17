# V43_CONTEXT_RECOVERY_24CASE_BENCHMARK_CHECKPOINT

## SAMPLE

- total cases: 24
- scopes: GENERAL, GOVERNMENT_ENTERPRISE, HEALTHCARE, ENTERPRISE_PRIVATE
- docs: UNI-08, GOV-02, MED-07, COM-04, UNI-03, GOV-06, MED-08, COM-03, COM-02, COM-06, COM-08, COM-12, MED-01, COM-07
- DB materials/chunks observed: 50/478
- production chunks only: YES
- synthetic fixture created: NO

## CATEGORY RESULTS

| Category | Cases | PASS | FAIL | Rate |
| --- | ---: | ---: | ---: | ---: |
| HEADING_TO_BODY | 4 | 4 | 0 | 100.00% |
| BODY_TO_HEADING | 4 | 4 | 0 | 100.00% |
| POSITIVE_CAPABILITY | 4 | 4 | 0 | 100.00% |
| NEGATIVE_BOUNDARY | 4 | 4 | 0 | 100.00% |
| MULTI_PARAGRAPH | 4 | 4 | 0 | 100.00% |
| METADATA_SECTION_BOUNDARY | 4 | 4 | 0 | 100.00% |
| TOTAL | 24 | 24 | 0 | 100.00% |

## QUALITY SIGNALS

- heading_missing: 0
- body_missing: 0
- anchor_missing: 0
- cross_section_contamination: 0
- provenance_failure: 0
- wrong_material: 0
- invalid_bounds: 0

## TOP-LEVEL HEADING CASES

- count: 1
- max resolved chars: 859
- max paragraphs: 8
- max source chunks: 8
- unexpected whole-document expansion: NO

## PROVENANCE

- material identity: PASS
- source_chunk_ids: PASS
- char bounds: PASS
- paragraph bounds: PASS
- cross-material contamination: NONE

## SEMANTIC POLARITY

OUT_OF_SCOPE

## CALLS

- SiliconFlow embedding: 0
- Provider generation: 0
- DeepSeek: 0
- Dify: 0

## TESTS / GIT

- Resolver/Expansion: executed against DB rows
- syntax: PASS
- JSON parse: PASS
- CSV parse: PASS
- git diff --check: PASS
- production writes: 0
- DB writes: 0
- commit/push/deploy: NO

## FINAL STATUS

CONTEXT_RECOVERY_24CASE_PASS
