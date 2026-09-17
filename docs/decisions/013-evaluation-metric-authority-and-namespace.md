# ADR 013: Evaluation Metric Authority and Semantic Namespace

- **Status:** Accepted
- **Scope:** Requirement Extraction evaluation and certification
- **Date:** 2026-08-30

## Context

Source-range alignment diagnostics and task-level semantic quality metrics
answer different questions. A structural matcher may report exact, partial,
contiguous, or unmatched ranges, but those observations do not establish that
a Requirement's meaning was covered. Presenting structural values as bare
`Recall`, `Precision`, `F1`, `TP`, `FP`, or `FN` can therefore misstate product
quality and Freeze readiness.

## Decision

Structural alignment values remain diagnostic and use an explicit semantic
namespace such as `SOURCE_RANGE_STRUCTURAL_ONLY` or
`SOURCE_RANGE_STRUCTURAL_DIAGNOSTIC`. They must not be used as Freeze or
release thresholds. Authoritative Requirement Extraction quality metrics are
produced only after task-specific Gold semantic adjudication and use explicit
semantic names such as `semantic_coverage` and `meaning_completeness`.

Existing historical artifacts are not rewritten solely for naming consistency.
New or modified evaluation and certification surfaces must preserve this
authority boundary and must not substitute structural diagnostics for semantic
metrics.

## Alternatives Considered

- Migrate or rewrite all historical reports: rejected because historical
  evidence must remain immutable.
- Treat structural range alignment as semantic quality: rejected because range
  overlap does not establish requirement meaning.

## Consequences

Certification reports can show structural diagnostics without implying a
semantic score. Semantic metrics require complete Gold adjudication and remain
auditable against the canonical capture and evaluator identity.

## Guardrails

- Structural diagnostics are explicitly qualified at reporting boundaries.
- Freeze validity remains false until semantic adjudication is complete.
- Evaluation code must identify its contract and evaluator revision.

## References

- `backend/eval/requirement-extraction-real-tender-pilot-v1/run-live-eval.js`
- `backend/eval/requirement-extraction-real-tender-pilot-v1/evaluation-certification.js`
- `backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/`
- `.codex/skills/engineering-governance/SKILL.md`
