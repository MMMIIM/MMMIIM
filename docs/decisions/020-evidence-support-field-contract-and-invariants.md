# ADR-020: Evidence Support Field Contract and Invariant Parity

- **Decision:** `DOCUMENT_FIELD_OWNERS_AND_CANONICAL_INVARIANT_PARITY`
- **Status:** Accepted for the current Evidence Support contract
- **Date:** 2026-09-01
- **Scope:** Evidence Support field ownership, dependencies, and validation parity

## Decision

The Evidence Support assessment keeps one canonical contract and one
deterministic cross-field invariant. The Gateway validator and canonical
assessment factory must reject the same invalid combinations. ADR-019 remains
the authority for the `semantic_relationship` decision boundary.

### Field ownership

| Field | Owner | Current producer | Dependency / consumer | Backend-only migration | State |
| --- | --- | --- | --- | --- | --- |
| `semantic_relevance` | OWNERSHIP_UNRESOLVED | deterministic exclusions + Semantic Gateway | Requirement ↔ Evidence | NO | REVIEWED |
| `evidence_capability` | OWNERSHIP_UNRESOLVED | eligibility rules + Semantic Gateway | source eligibility + semantic capability | NO | REVIEWED |
| `support_level` | LLM_DEPENDENT / hybrid | deterministic router + semantic output | relevance/capability/dimensions | NO | REVIEWED |
| `review_dimensions` | LLM_DEPENDENT / hybrid | deterministic hints + semantic output | Requirement ↔ Evidence | partial only | REVIEWED |
| `reason_codes` | DIAGNOSTIC_DERIVED / mixed | deterministic codes ∪ semantic codes | assessment/dimensions | subset only | REVIEWED |
| `conflict_observations` | LLM_DEPENDENT | Semantic Gateway | conflicting grounded source observations | NO | REVIEWED |
| `semantic_relationship` | LLM_DEPENDENT | LLM | relevance/capability/support constrain but do not derive | NO | FROZEN / ADR-019 |

No field in this matrix is approved for an immediate Backend-only migration.
The `support_sufficiency` review dimension remains under evaluation. The
`semantic_relevance` owner declaration is stale and requires reconciliation;
the `evidence_capability` owner row was previously missing. These are
documentation/ownership findings, not permission to change runtime semantics.

### Dependency graph

```text
retrieval input + source eligibility
  -> deterministic evidence-support router
  -> deterministic observations and reason codes
  -> validated Semantic Gateway assessment
  -> assembled Evidence Support assessment
  -> Evidence Review / Fact / Mapping adapters
  -> human review and downstream gates
```

The semantic worker may fill unresolved values only through the validated
Gateway boundary. Deterministic values win and cannot be overwritten by
semantic output. Review approval is not Fact approval and Mapping remains
outside this decision.

## Cross-field invariants

1. `semantic_relationship=direct` requires
   `semantic_relevance=relevant`, `evidence_capability=capable`, and
   `support_level=full_support`.
2. `support_level=full_support` requires `semantic_relationship=direct`.
3. Unknown core values (`semantic_relevance`, `evidence_capability`, or
   `support_level`) forbid `direct` and `full_support`.
4. Source IDs and spans must belong to the request; support excerpts must be
   grounded in those spans.
5. A conflict requires at least two unique sources with differing observed
   values and grounded excerpts; any conflict blocks aggregate sufficiency.
6. An unavailable assessment is surfaced as `ASSESSMENT_UNAVAILABLE`.

The strict task schema is transport validation, not business consistency.
Schema validity is therefore not a substitute for the cross-field invariant.
The Gateway and canonical factory use the same pure invariant helper, with
targeted parity tests as executable authority.

## Consequences and unresolved work

Consumers must distinguish exact/canonical representations from derived
diagnostic views. Invalid combinations fail closed at both validation
boundaries; no fallback, coercion, or compatibility path is introduced.
Future ownership changes require an explicit contract update, regression
coverage, and reconciliation of the stale/missing owner declarations above.
