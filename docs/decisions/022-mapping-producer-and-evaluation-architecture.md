# ADR-022: Mapping Producer V1 and Mapping Eval V1 Architecture

- **Decision:** `V43_MAPPING_MAPPING_EVAL_ADR_FREEZE`
- **Status:** Accepted
- **Date:** 2026-09-02
- **Scope:** V4.3 Backend-controlled Requirement–Evidence Fact Mapping
  Producer V1 and Mapping Eval V1

## Context

ADR-017 already freezes the canonical Requirement, Evidence Fact, Mapping,
Readiness and Claim authorities. This ADR freezes the producer/evaluation
boundary that operates within those authorities; it does not create a second
Mapping contract or reopen the canonical persistence decision.

## Decision

### Authority and input boundary

`RequirementEvidenceFactMappingService` and
`requirement_evidence_fact_mappings` remain the sole canonical Mapping write
authority. The producer may propose a Mapping only for the same project and a
Canonical Requirement projection, using an approved/current Review, an
approved/current non-superseded canonical Evidence Fact, valid source/material
lineage, and deterministic deduplication. The Backend validates identity,
provenance, contract versions, support ceilings and lifecycle state. Retrieval
results, raw Evidence, legacy Facts and RAG content are inputs, not Mapping
authority. The producer does not re-embed, retrieve, or perform pair-by-pair
search.

The semantic call is one Requirement plus at most six eligible Facts. A set of
seven or more Facts is deterministically partitioned as `6 + 1` (and then
repeated) without dropping eligible Facts or reducing recall. The LLM is a
semantic judge only. Requirement input is the Canonical Requirement projection,
not a dependency on the Requirement Extraction implementation.
It returns `fact_ref`, one decision, and six dimension values; it does not own
IDs, support authority, relationship status, hashes, provenance, reviewer
identity, approval, persistence, confidence, or rationale.

The seven decision values are:

```text
direct_full | partial_support | unrelated | related_reference |
related_insufficient | conflict | unknown
```

The Backend's fixed decision projection is:

| Semantic decision | Canonical `support_level` |
| --- | --- |
| `direct_full` | `full_support` |
| `partial_support` | `partial_support` |
| `unrelated` | `insufficient` |
| `related_reference` | `reference_only` |
| `related_insufficient` | `insufficient` |
| `conflict` | `conflict` |
| `unknown` | `unknown` |

The four dimension values are `match`, `mismatch`, `unknown`, and
`not_applicable`. `unknown` means an applicable dimension is not established;
`not_applicable` means the Requirement does not ask for that dimension.
Deterministic Backend observations override semantic hints. The LLM transport
does not contain `Mapping.dimensions.support_sufficiency`; downstream behavior
uses canonical `support_level`.

### Projection, approval and persistence

The Backend projects the semantic result to the existing Mapping contract and
enforces the exact decision projection. Machine approval is permitted only
after schema, identity, lineage, currentness, support-ceiling, dimension and
cross-field checks pass with no conflict, unknown, high-risk or human-review
condition. Exceptions and semantic gaps remain with the Human
Exception/Gap Resolver; high-risk cases remain human-reviewable. Every
Requirement's Mapping set is persisted atomically: any validation or write
failure rolls the complete set back. Idempotency covers Requirement identity
and hash, ordered Fact identities/hashes, upstream support, Mapping contract,
task/prompt and schema identity, and policy version.

No downstream operation may escalate authority. Mapping support can narrow,
never expand; `partial_support`, `insufficient`, `conflict`, and `unknown`
cannot become `full`. Fact exact coverage is only a Claim factual-boundary
check. A `reference_only` source cannot create a strong enterprise Claim, and
an enterprise Fact requiring Claim authorization cannot enter Writer context
until a current authorized Claim/Project Fact exists. Readiness and Claim
consume canonical Mapping; Writer consumes only approved Claim or authorized
Project Fact.

### Mapping Eval V1

Mapping Eval is versioned, task-specific quality governance. It is not a
production service, authority, agent, or alternate producer. Its dependency
direction is:

```text
canonical Requirement/Fact fixtures -> Mapping producer/evaluator ->
canonical contract projection -> quality/safety report
```

Evaluation may consume production builders/resolvers and their artifacts;
approved evaluation evidence may inform a later production decision, but
production code must never consume evaluator labels, gold, or derived metrics.
The default Fast Gate is offline (`Provider=0`, `DB writes=0`). The
semantic Gold is human-authored and static; the evaluator must not self-label
or turn structural alignment into semantic quality.

The four gates are:

```text
MAPPING_FAST_GATE
MAPPING_DB_GATE
MAPPING_SEMANTIC_GATE
MAPPING_DOWNSTREAM_SAFETY_GATE
```

DB unavailability is `NOT_VERIFIED`, not a pass. Semantic reports include
case-level identity and evidence, with false-full, false-positive, conflict
recall, dimension accuracy, unknown/N/A handling, latency and cost. The
permanent taxonomy is:

```text
FALSE_FULL, FALSE_PARTIAL, FALSE_SUPPORT, MISSED_CONFLICT,
RELATED_AS_SUPPORT, QUANTITY_CONFUSION, STATUS_CONFUSION,
SCOPE_CONFUSION, ENTITY_CONFUSION, VALIDITY_CONFUSION, NA_MISUSE,
UNKNOWN_OVERUSE, SCHEMA_FAILURE, ALIAS_FAILURE, OUTPUT_INCOMPLETE,
AUTHORITY_ESCALATION, UNAUTHORIZED_CLAIM_ALLOW, WRITER_AUTHORITY_BYPASS
```

Hard release gates are Schema validity 100%, false-full 0, authority
escalation 0, unauthorized Claim allow 0, Writer bypass 0, and cross-project
leakage 0. A semantic quality target cannot hide a safety failure. The two
permanent P0 regressions are Mapping-to-Claim no-escalation and
`claim_required` enterprise-Fact Writer bypass.

### Operations, versioning and non-goals

One-plus-six batching is the performance default; no Provider call is made by
ordinary offline evaluation. Every live/certification experiment must carry a
run identity, frozen dataset/gold, evaluator identity, contract/prompt/schema
identity, call accounting, first-failure evidence, and side-effect checks.
Structural or provisional metrics are never exposed as unqualified semantic
Recall/Precision/F1. A failed lower gate blocks higher semantic conclusions.

This decision does not change Requirement Extraction, Evidence Support, Fact,
Claim, Readiness, Writer, RAG, DB schema, API, or any production contract. It
does not add a Mapping v2, a second authority, an Agent, a new retrieval
architecture, a per-pair model call, or a Provider fallback. It also does not
merge Mapping Eval into production.

Future changes require a new decision with parity tests, case-level evidence,
and explicit authority review. Do not reopen the passed canonical authority,
no-escalation, atomic persistence, or evaluation-boundary layers merely
because a downstream quality result is poor.

## References

- [ADR-017: Canonical Requirement–Evidence Fact–Mapping Authority](017-canonical-requirement-evidence-fact-mapping-authority.md)
- [ADR-019: Evidence Support semantic relationship boundary](019-semantic-dependent-field-logic-review.md)
- [ADR-020: Evidence Support field contract and invariant parity](020-evidence-support-field-contract-and-invariants.md)
- [ADR-021: Evidence Fact semantic authority and Requirement independence](021-evidence-fact-semantic-authority-and-requirement-independence.md)
