# ADR-018: Fact Subject Semantic Representation (Flat)

- **Decision:** `V43_FACT_SUBJECT_SEMANTIC_REPRESENTATION_FLAT_ACCEPTED`
- **Status:** Accepted and frozen
- **Date:** 2026-08-31
- **Scope:** Evidence Fact semantic extraction projection only

## Context

The canonical Evidence Fact subject is an object with two meaningful fields,
`type` and `name`. Provider evidence showed that asking the Semantic Worker to
emit this nested object creates avoidable structured-output compatibility cost.
The two values remain semantic values; only their transport representation is
flattened at the semantic boundary.

## Decision

The Semantic Worker projection is flat and emits exactly:

```text
subject_type
subject_name
```

The Backend deterministically assembles the unchanged canonical shape:

```json
{
  "type": "<subject_type>",
  "name": "<subject_name>"
}
```

The Semantic Worker owns the semantic proposals for `subject_type` and
`subject_name`. The Backend owns deterministic representation assembly,
validation, source grounding, provenance, persistence and lifecycle. Backend
semantic inference is forbidden.

`EvidenceSourceFactService` remains the sole canonical Fact authority and the
existing `createEvidenceFactContract()` → `evidence_source_facts` path remains
unchanged. Candidate persistence and Candidate authority remain forbidden.

## Frozen invariants

```text
FACT_SUBJECT_SEMANTIC_REPRESENTATION = FLAT
CANONICAL_SUBJECT_SHAPE = UNCHANGED
CANONICAL_FACT_CONTRACT = UNCHANGED
FACT_AUTHORITY = EvidenceSourceFactService
SEMANTIC_WORKER_HAS_AUTHORITY = FALSE
BACKEND_SEMANTIC_INFERENCE = FORBIDDEN
BACKEND_SOURCE_GROUNDING_REQUIRED = TRUE
BACKEND_CONTRACT_VALIDATION_REQUIRED = TRUE
CANDIDATE_PERSISTENCE = FALSE
CANDIDATE_AUTHORITY = FALSE
SHADOW_CANONICAL_SUBJECT_DEFINITION = FORBIDDEN
LEGACY_FACT_FALLBACK = FALSE
REQUIREMENT_DERIVED_FACT = FALSE
FAIL_CLOSED = TRUE
MAPPING_CHANGE_IN_THIS_DECISION = FALSE
```

The following remain unchanged and outside this decision:

```text
Mapping
Sufficiency
Readiness
Claim
DB schema
Human Review lifecycle
```

## Development gates

The existing gates remain the only required gates for this boundary:

```text
SINGLE_CANONICAL_SOURCE
BOUNDARY_PARITY_REQUIRED
FIRST_FAILURE_OBSERVABLE
RUNTIME_PREFLIGHT = Identity Check + Local Behavior Probe
```

If implementation of this decision is followed by new consecutive known-field
schema failures in `entities`, `status`, `scopes`, `quantities` or `validity`,
stop field-by-field compatibility work and escalate:

```text
FACT_SEMANTIC_CANDIDATE_MINIMALITY_REVIEW_REQUIRED
```

## Non-goals

This decision does not introduce a Candidate Service, normalizer service,
parallel Fact definition, new database table, Fact v2, new business authority,
Mapping producer, or any new Agent/RAG architecture. It records the accepted
representation boundary only; implementation is a separate task.
