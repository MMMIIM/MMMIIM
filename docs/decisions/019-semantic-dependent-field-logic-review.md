# ADR-019: Semantic Relationship Field Ownership Review

- **Decision:** `KEEP_LLM_DEPENDENT_FIELD`
- **Status:** Accepted for the current Evidence Support contract
- **Date:** 2026-09-01
- **Scope:** `EvidenceSupportAssessment` semantic relationship field only

## Context

The current contract contains four separate semantic observations:
`semantic_relevance`, `evidence_capability`, `support_level`, and
`semantic_relationship`. The existing cross-field invariant says that
`semantic_relationship=direct` requires `relevant + capable + full_support`.
That is a one-way safety rule; it does not establish that the three parent
fields uniquely determine every relationship.

The formal enums are:

```text
semantic_relevance: relevant | weakly_relevant | irrelevant | unknown
evidence_capability: capable | reference_only | not_capable | unknown
support_level: full_support | partial_support | conflict | insufficient |
               reference_only | unknown
semantic_relationship: direct | partial | related | conflict | unrelated | unknown
```

## Logic review

The strict Gateway validator enforces only the direct/full boundary and the
prohibition on `direct` for unknown or non-capable inputs. It does not map all
other parent states to one relationship:

| relevance | capability | support | formally accepted relationships | unique |
|---|---|---|---|---|
| relevant | capable | full_support | direct | YES |
| relevant | capable | partial_support | partial, related, conflict, unrelated, unknown | NO |
| relevant | capable | conflict | partial, related, conflict, unrelated, unknown | NO |
| relevant | capable | insufficient | partial, related, conflict, unrelated, unknown | NO |
| relevant | reference_only | reference_only | non-direct values; router emits related | NO |
| irrelevant | not_capable | insufficient | non-direct values; router emits unrelated | NO |
| unknown | unknown | unknown | non-direct values; contract path emits unknown | NO |

The repository also contains distinct legitimate producers: the deterministic
responsibility router emits `related` for reference-only context, `unrelated`
for irrelevant/ineligible sources, and `conflict` for explicit mismatches;
unresolved cases are delegated to semantic adjudication. These are relationship
observations, not aliases for support strength.

## Evidence and ownership

`aggregateEvidenceSufficiency()` reads `semantic_relationship` independently:
`conflict` blocks, `unrelated` participates in the non-relevant result, and only
`direct + full_support` produces review-ready evidence. The field-owner matrix
therefore correctly records the producer as a deterministic rule or validated
semantic adjudication. `requirement-evidence-mapping-v1` also requires and
persists the relationship; Readiness consumes it for conflict and review states.

The field adds independent information about how a source relates to the
Requirement. Backend derivation from the three parent fields is therefore not
safe, and removing the field would break downstream semantics.

## Incident recorded

The following outputs passed JSON shape/enum checks but failed the business
cross-field invariant before the invariant was made explicit:

```text
S01: relevant + capable + partial_support + direct
S03: relevant + not_capable + reference_only + direct
JSON Schema: PASS
Business Invariant: FAIL
Root cause: PROMPT_INVARIANT_UNDERSPECIFIED
```

The accepted controls are the explicit Prompt invariant, the retained Backend
Validator cross-field gate, and evaluation fail-closed handling. No new Prompt,
Schema, Aggregator, Fact, Provider, or derivation change is part of this ADR.

## Frozen principles

```text
Structured Output != Business Logical Consistency
Independent Fields != Dependent Fields != Derived Fields
Cross-field invariants require Prompt guidance, hard validation, and eval checks
Canonical contract remains the source of truth
Backend derivation is preferred only when uniqueness is proven
```

## Downstream boundary

`EvidenceSupportAssessment` remains transient and side-effect free. Review,
Mapping, Readiness, Claim and Fact ownership remain unchanged. This ADR does
not implement a migration and does not change any contract or provider call.

## Live verification record

The Prompt invariant was exercised on 2026-09-01 in run
`SEMANTIC_INVARIANT_ROOT_FIX_CANARY_01` against the shared `18082` Gateway.
Three Semantic cases reached DeepSeek and one was resolved deterministically;
the canary used three Provider attempts, zero retries, and zero Fact calls.
The running Gateway reported the prior Semantic instruction hash
(`984653f19d08c2cb0d405c6c133416410f5ba82f6f6f1c2f111bb9c14b92502a`), while
the worktree Prompt hash is `cf006e98d42f3f9d8947fa46edd2580cf9aaf6bdebff4f5e6cdab1dbea498284`.
Because the runtime was stale, the canary is a `RUNTIME_PARITY_VIOLATION` and
is not a valid proof of the Prompt root fix; its S03 schema rejection is not a
semantic-quality conclusion. `PROMPT_INVARIANT_LIVE_VERIFIED` is not asserted.

### Corrected live verification record

After the shared Gateway was restarted, run
`SEMANTIC_INVARIANT_ROOT_FIX_CANARY_02` re-exercised the same S01–S04 cases
against the current runtime. The runtime instruction hash was
`cf006e98d42f3f9d8947fa46edd2580cf9aaf6bdebff4f5e6cdab1dbea498284`, matching
the current worktree; the evidence-support schema hash remained
`15276121aed6a8337384618a3939d66a7802815163f676e193ff8775a8486578`.
Three cases reached DeepSeek (S01–S03) and S04 remained deterministic, with
three Provider attempts, zero retries, zero fallbacks, zero Fact calls, and
all three Provider responses HTTP 200 / `finish_reason=stop` /
`output_truncated=false` using `json_schema`. The direct relationship invariant
held for every returned assessment: `illegal_direct_combinations=0` and
`direct_invariant_violations=0`. S01 and S03 still differed from their frozen
semantic expectation (S01 and S03 were returned as partial), so this is a
semantic-quality result only; it is not a Contract failure and does not assert
`PROMPT_INVARIANT_LIVE_VERIFIED`.

The invariant gate itself therefore passes for the current runtime; the two
expected-label mismatches are recorded independently as `SEMANTIC_QUALITY_FAIL`
and do not reopen the contract or runtime-parity decision.
