# ADR 015: Source Ambiguity Must Not Be Silently Resolved

- **Status:** Accepted
- **Scope:** Requirement Extraction source interpretation and evaluation
- **Date:** 2026-08-30
- **Decision authority:** User-confirmed product decision

## Context

Tender source text can contain incompatible, meaning-bearing values within the
same requirement source.  In the confirmed FAST-WATER-01 G071 table, the row
contains `指标参数=次数/年`, `描述=平均每季度发生严重故障次数`, and
`周期=月`.  The last value is consistent with the neighbouring report/check
cycle column, but the annual and quarterly values are both directly present
KPI-frequency statements and cannot be uniquely reconciled from the source.

Treating the existing Gold wording “每年” as the only truth would incorrectly
turn another source-supported interpretation into a critical model omission.

## Decision

1. When the authoritative tender source contains an unresolved semantic
   conflict, the platform MUST preserve the original provenance and mark the
   case `SOURCE_AMBIGUOUS`.
2. The platform MUST NOT invent a field priority such as
   `指标参数 > 描述` without explicit business authority.
3. The conflict must remain unresolved when table headers, multi-level headers,
   merged-cell relationships, neighbouring-row patterns, section context, and
   explicit textual qualifications do not establish one interpretation.
4. `SOURCE_AMBIGUOUS` is distinct from `MODEL_MISS`, `MODEL_ERROR`, and
   `GOLD_INCORRECT`.
5. Evaluation MUST NOT use one conflict interpretation as the sole Gold Truth
   to produce a critical material omission.
6. The treatment of `SOURCE_AMBIGUOUS` in quality denominators and freeze
   metrics is deferred to a separate Evaluation Contract decision.

## Alternatives Considered

- **A. Fix a global column priority:** rejected; it lacks business authority
  and can convert a source error into system fact.
- **B. Let the model choose any interpretation:** rejected; it hides the
  source conflict and weakens auditability.
- **C. Preserve source ambiguity explicitly:** accepted; it keeps both
  source-supported meanings and prevents false critical misses.

## Consequences

Positive:

- prevents the system from manufacturing tender facts;
- preserves auditable source provenance;
- prevents ambiguous Gold items from being treated as unique quality truth.

Tradeoffs:

- some requirements require human/product clarification;
- evaluation needs an explicit ambiguity contract and separate reporting;
- not every Gold item has a single automatic truth value.

## Guardrails

- Never rewrite `SOURCE_AMBIGUOUS` into a single Gold interpretation merely to
  improve evaluation metrics.
- Do not prompt the model to select a preferred conflicting value.
- Do not introduce an unapproved global table-column priority.
- Preserve all conflicting source spans and their provenance.
- Historical certification artifacts remain unchanged; any metric policy
  change requires a separately approved Evaluation Contract decision.

## References

- `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/manifest.json`
- `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-WATER-01.json`
- `backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/semantic-adjudication.json`
- `backend/eval/reports/reqx-v311-source-ambiguity-gold-audit-v1.json`
- User confirmation in `REQX_V311_SOURCE_AMBIGUITY_ADR_AND_199_GOLD_AUDIT_V1`

