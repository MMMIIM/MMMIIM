# ADR 016: Source-Ambiguous Cases Are Not Evaluable Gold

- **Status:** Accepted
- **Scope:** Requirement Extraction Gold eligibility and semantic certification
- **Date:** 2026-08-30
- **Decision authority:** User-confirmed product decision

## Context

The frozen Requirement Extraction dataset contains 199 Gold cases. The
independent Source Authority audit classifies 198 as `SOURCE_CLEAR` and one as
`SOURCE_AMBIGUOUS`: FAST-WATER-01-G071. Its source row contains both
`指标参数=次数/年` and `描述=平均每季度发生严重故障次数`; available table and
neighbor context does not establish one unique KPI frequency.

## Decision

1. Gold eligibility requires a unique, verifiable semantic truth from Source
   Authority. Only `SOURCE_CLEAR` is `evaluation_eligible=true`.
2. `SOURCE_AMBIGUOUS`, `SOURCE_ERROR_SUSPECTED`, and `UNRESOLVED` are not
   evaluable Gold for model-quality aggregation.
3. Ineligible cases do not participate in `FULL`, `PARTIAL`, `MISS`, semantic
   coverage denominators or numerators, meaning-completeness denominators or
   numerators, mandatory-critical-miss, critical-material-omission,
   harmful-merge quality consequences, or Freeze quality blockers.
4. Ineligible cases remain in dataset lineage, provenance, ambiguity audit,
   reporting, and historical artifacts. Certification-facing reports must
   disclose `dataset_case_count`, `evaluable_gold_count`, and
   `source_ambiguous_count`.
5. Eligibility is determined only from the Source Authority audit. Candidate
   quality or semantic result must not retroactively remove a Gold case from
   the denominator.
6. The frozen v1.1 Gold packets, source hashes, and historical certification
   artifacts remain unchanged. A future dataset may move ambiguous cases to a
   dedicated ambiguity corpus, but that migration is not part of this ADR.

## Alternatives Considered

- **A. Keep ambiguous cases in the denominator:** rejected because one chosen
  interpretation would create a false model failure and an unjustified Freeze
  blocker.
- **B. Delete or rewrite the ambiguous Gold case:** rejected because it loses
  dataset lineage and changes frozen Gold truth.
- **C. Separate eligibility from Source Authority and quarantine ambiguity:**
  accepted; it preserves the full dataset while making quality denominators
  auditable and evidence-based.

## Consequences

Positive:

- source ambiguity cannot be counted as a model miss or critical omission;
- the original 199-case lineage remains visible;
- semantic quality metrics have an explicit 198-case eligible denominator;
- clear negative controls such as FAST-WATER-01-G005-06 remain evaluable.

Tradeoffs:

- certification reports carry separate dataset and eligible counts;
- a future Evaluation Contract may choose a different treatment such as
  multiple acceptable interpretations;
- historical reports remain unchanged and must be read with their original
  contract identity.

## Guardrails

- No Gold-ID-specific eligibility branch is permitted.
- Do not infer ambiguity from Candidate quality, semantic results, or score
  improvement.
- Do not silently rewrite `SOURCE_AMBIGUOUS` as `FULL`, `PARTIAL`, or `MISS`.
- Do not alter frozen Gold hashes, historical artifacts, or Freeze thresholds.
- Keep cross-page table-header binding as a separate engineering improvement.

## References

- `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/manifest.json`
- `backend/eval/reports/reqx-v311-source-ambiguity-gold-audit-v1.json`
- `backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/`
- `backend/eval/requirement-extraction-real-tender-pilot-v1/gold-eligibility.js`
- `REQX_V311_GOLD_ELIGIBILITY_GATE_AND_FINAL_RECERTIFICATION_V1`
