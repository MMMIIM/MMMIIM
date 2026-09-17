# Mapping Gold V2 Promotion Dependency Inventory

This is an evaluation-only inventory. It does not change the active Mapping
Gold, runner, Production Mapping, Claim Gate, or Writer policy.

## Authority snapshot

- active Mapping Gold path: `backend/eval/requirement-evidence-mapping-v1/gold-cases.json`
- dataset: `requirement-evidence-mapping-v1-gold-2026-09-02`
- contract: `requirement-evidence-mapping-v1.1`
- case count: 36 (`MAP-G001`–`MAP-G036`)
- SHA-256 before this task: `5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707`
- SHA-256 after this task: `5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707`
- production files changed by this task: 0

## Dependency inventory

| Path | Use | Classification | Promotion action |
| --- | --- | --- | --- |
| `backend/eval/requirement-evidence-mapping-v1/gold-cases.json` | Human-authored v1.1 source | HISTORICAL_KEEP | Preserve immutable; a V2 authority needs a new namespace and SHA. |
| `backend/eval/mapping-benchmark-v1/mapping-eval-metrics.js` | Loads/validates active Gold and enforces the 36-case v1 contract | MUST_CHANGE_AT_PROMOTION | Replace only after V2 case-level labels and contract are authorized. |
| `backend/eval/mapping-benchmark-v1/mapping-eval-runner.js` | Runner artifact lineage and case report | MUST_CHANGE_AT_PROMOTION | Add explicit V2 dataset identity; do not silently retarget v1. |
| `backend/eval/mapping-benchmark-v1/README.md` | Documents the v1 runner/source relationship | REPORT_ONLY | Update when promotion is approved. |
| `backend/test/mapping-eval-v1.test.js` | Deterministic v1 contract regression, including case count | TEST_ONLY | Keep as v1 regression; add separate V2 tests at promotion. |
| `backend/test/mapping-producer-gold.test.js` | Producer parity against v1 Gold and count | TEST_ONLY | Keep; do not reinterpret as V2 semantic scoring. |
| `backend/eval/gold-human-review/00_gold_review_manifest.json` | Historical export manifest and v1 counts | HISTORICAL_KEEP | Preserve as an audit snapshot. |
| `backend/eval/gold-human-review/00_gold_review_manifest.md` | Human-readable historical export | REPORT_ONLY | Preserve; regenerate only as a new versioned report. |
| `backend/eval/gold-human-review/01_mapping_gold_full_review.json` | Full human-review projection of v1 cases | HISTORICAL_KEEP | Preserve; not a promotion authority by itself. |
| `backend/eval/gold-human-review/01_mapping_gold_full_review.md` | Human-readable v1 review projection | REPORT_ONLY | Preserve; never use as executable Gold. |
| `backend/eval/gold-human-review/v2/02_mapping_batch01_human_adjudication.json` | Aggregate Batch01 human authority record | MUST_CHANGE_AT_PROMOTION | Require case-level overlay before scoring; current promotion remains unauthorized. |
| `backend/eval/gold-human-review/v2/02_mapping_batch01_human_adjudication.md` | Batch01 adjudication narrative | REPORT_ONLY | Preserve verbatim; no case labels inferred. |
| `backend/eval/mapping-benchmark-v1/results/*` | Historical runner outputs | REPORT_ONLY | Never use as active Gold or baseline without an explicit experiment identity. |
| `backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.json` | Blind supplemental candidate packet source | MUST_CHANGE_AT_PROMOTION | Human-adjudicate and create a new immutable expected-answer overlay. |
| `backend/eval/gold-human-review/v2/03_mapping_real_supplemental_source_packet.md` | Blind supplemental candidate index | REPORT_ONLY | Preserve; it is not yet the complete human-adjudication rendering. |

No dependency outside the listed evaluation/reporting paths was changed. The
Production Import Guard is an explicit gate in the Governance Harness rather
than a Production dependency.

## Hard-coded denominator audit

Only active Mapping Gold dependencies are counted here; unrelated fixtures and
historical prose containing the number 36 are excluded.

`MAPPING_GOLD_HARDCODED_DENOMINATOR_COUNT = 4`

Findings:

1. `backend/eval/mapping-benchmark-v1/mapping-eval-metrics.js:79` checks
   `data.cases.length !== 36`.
2. `backend/test/mapping-eval-v1.test.js:40` asserts the active Gold length.
3. `backend/test/mapping-eval-v1.test.js:94` asserts the runner report count.
4. `backend/test/mapping-producer-gold.test.js:11` asserts the producer Gold
   length and ID cardinality.

The findings are intentionally retained as v1 regression controls. They must
be reviewed as promotion dependencies rather than batch-edited now.

## Promotion order

1. Freeze a new V2 dataset namespace, case-level labels, review status,
   classification, and immutable SHA.
2. Run the Governance Harness and dual-evaluation primitive against the same
   predictions.
3. Update only explicitly authorized V2 runner/report/CI references.
4. Retain v1 files, hashes, and regression tests as historical controls.

Until those steps are complete, `Production Mapping` and the existing v1 Gold
remain unchanged and no V2 semantic-quality claim is made.

## Newly recorded completeness and novelty gaps

- `BATCH01_CASE_LEVEL_HUMAN_AUTHORITY = NOT_YET_COMPLETE`: the current
  adjudication artifact contains aggregate counts only; no per-case labels are
  inferred from those totals.
- `SUPPLEMENTAL_NOVELTY_REVIEW_REQUIRED`: canonical Requirement plus sorted Fact
  identity comparison found seven exact parent-packet pairs:
  `REAL-MAP-SUPP-001/REAL-MAP-CAND-015`,
  `REAL-MAP-SUPP-002/REAL-MAP-CAND-008`,
  `REAL-MAP-SUPP-003/REAL-MAP-CAND-017`,
  `REAL-MAP-SUPP-004/REAL-MAP-CAND-012`,
  `REAL-MAP-SUPP-005/REAL-MAP-CAND-013`,
  `REAL-MAP-SUPP-006/REAL-MAP-CAND-018`, and
  `REAL-MAP-SUPP-008/REAL-MAP-CAND-023`. Only three candidates are novel under
  this deterministic check, and none is eligible for Gold promotion until a
  human novelty review is complete.
- `SUPPLEMENTAL_MARKDOWN_RENDERING_INCOMPLETE`: the current Markdown is an
  index/manifest projection. It does not yet render every Requirement, Fact,
  and source excerpt in full; this task records the gap and does not regenerate
  the packet.
