# V43 Chengchuan Base16 Source Role Model Frozen

Status: `CHENGCHUAN_BASE16_SOURCE_ROLE_FROZEN_FOR_ENGINEERING_E2E`

Freeze decision: `V43_CHENGCHUAN_BASE16_CONTENT_ROLE_FREEZE_V1`

This audit applies the existing `material-source-role-v1` material taxonomy and
the `material-source-authority-v1` authority tier. Synthetic status is not used
to select a source role. All Base16 records remain `synthetic=true`,
`authority=SYNTHETIC_EVAL_ONLY`, and `production_authority=NONE`.

## Base16 classification

| Material | Material type | Source role | Authority | Production authority |
|---|---|---|---|---|
| COM-01 | `company_profile` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-02 | `product_documentation` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-03 | `product_documentation` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-04 | `product_documentation` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-05 | `technical_solution` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-06 | `delivery_capability` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-07 | `delivery_capability` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-08 | `delivery_capability` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-09 | `technical_solution` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-10 | `other` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-11 | `technical_solution` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-12 | `technical_solution` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-13 | `project_case` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-14 | `project_case` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-15 | `qualification` | `EVIDENCE_CANDIDATE` | `SYNTHETIC_EVAL_ONLY` | `NONE` |
| COM-16 | `other` | `REFERENCE_ONLY` | `SYNTHETIC_EVAL_ONLY` | `NONE` |

Counts: 16 total; 7 `REFERENCE_ONLY`; 9 `EVIDENCE_CANDIDATE`; 1 `UNKNOWN_REVIEW_REQUIRED` (COM-06).

## COM-06 boundary

COM-06 is an `EVIDENCE_CANDIDATE` because the source records a dated v3.2
permissions, security, and audit test on 2026-08-01. It has no explicit
PASS/FAIL result, so its `semantic_review_status` is
`UNKNOWN_REVIEW_REQUIRED`. Eval may preserve the observed test event, but no
positive “passed”, “satisfied”, or “verified compliant” assertion is
authorized automatically.

## Behavior boundary

- Synthetic `REFERENCE_ONLY`: Fact, Mapping, and Claim authority are blocked; Writer may receive context only where its existing policy permits.
- Synthetic `EVIDENCE_CANDIDATE`: Fact, Mapping, and Claim evaluation are allowed only in an isolated `SYNTHETIC_EVAL_ONLY` or existing `CONTROLLED_REAL_TEST` mode; Production authority remains `NONE`; Writer assertions still require an approved Claim.
- Real `EVIDENCE_CANDIDATE`: default Production behavior is unchanged.
- Reference material cannot become an assertable Claim, and raw Evidence cannot enter Writer directly.

All future Chengchuan Base16 Eval/E2E consumers must load this frozen snapshot;
re-deriving roles from legacy `material_type`/manifest evidence categories is
not permitted. No Provider, embedding, E2E, database, Gold, Mapping, Claim, or
Writer action was performed by this freeze.
