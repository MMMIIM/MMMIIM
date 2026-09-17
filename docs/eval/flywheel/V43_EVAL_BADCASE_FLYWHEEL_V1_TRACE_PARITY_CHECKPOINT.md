# V43 Eval Flywheel v1 — Trace Parity Checkpoint

Status: `READY_FOR_GPT_EVAL_FLYWHEEL_V1_FINAL_REVIEW`

The current adapter had lost the historical mechanical page-lineage, many-to-many atom-to-canonical linkage. The eval-only repair restores deterministic page linkage and records `normalized_exact_substring`, `shared_8gram`, or `same_page_span_only`; it does not perform semantic matching or create labels.

## Identity

- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Frozen source truth: `docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json`
- Frozen source SHA-256: `9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0`
- Historical R2 remains immutable (`TARGETED_BADCASE`; trace SHA-256 `c9119bd896ad3730938c1697a44550146319742cdd3fe3d03f69d7e60d2d9b19`).
- Successor: `V43-FLYWHEEL-P0-487-R3`, partition `CORE6`.

## Mechanical parity

| Metric | Result |
| --- | ---: |
| Atom count / unique | 487 / 487 |
| Source-linked atoms | 472 |
| Chunk observable | 472 |
| Source resolution observable | 472 |
| Canonical lineage atoms | 472 |
| No mechanical link | 15 |
| Canonical links total | 5,286 |
| Provider Input historical gaps | 487 |
| Raw Candidate historical gaps | 487 |
| Normalization historical gaps | 487 |

The 15 non-linked atoms use `NO_MECHANICAL_LINK_FOUND`; they are not relabeled as semantic misses. The recovered link method precedence is 32 exact-substring atoms, 335 shared-8gram atoms, and 105 same-page-only atoms.

## Deterministic risk inventory

The R3 evaluator produced no `FAIL` observations. It surfaced the existing deterministic risk families for later review: `NEGATION_TOKEN_CHANGED` (399 cases), `NUMERIC_TOKEN_CHANGED` (378), `TABLE_INDEX_TOKEN_RISK` (335), and `SOURCE_CANONICAL_LOW_LEXICAL_ALIGNMENT` (447). These are signals only; no semantic labels were created.

## Safety and test state

- Provider/LLM calls: 0
- Production DB writes: 0
- Gold mutations: 0
- Production semantic changes: 0
- New migrations: 0
- Flywheel focused and legacy parity tests: PASS (17/17)
- Existing Requirement deterministic regression: PASS (68/68)
- Frontend: PASS (51/51)
- Backend full: exit 1 with 23 pre-existing unrelated baseline failures; no current-task failure identified
- Build: PASS
- Lint: PASS
- `git diff --check`: PASS
- PostgreSQL regression: NOT_RUN_SAFE_GUARD (production-writing suite)
- Independent review: `PASS_WITH_NON_BLOCKING_FINDINGS`
- Baseline drift: `NO_CURRENT_TASK_REGRESSION`

The independent review is recorded at `V43_EVAL_BADCASE_FLYWHEEL_V1_TRACE_PARITY_INDEPENDENT_REVIEW.json`. Task-scoped changed files are limited to the eval flywheel adapter/runner, its deterministic regression test, and these checkpoint artifacts; no production module, Gold artifact, migration, or database was changed by this repair.

This checkpoint is an implementation-progress artifact; it does not freeze Gold, approve semantic labels, or change production behavior.
