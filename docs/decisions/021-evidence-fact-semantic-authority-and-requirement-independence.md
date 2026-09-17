# ADR-021: Evidence Fact Semantic Authority and Requirement Independence

- **Status:** Implemented; Requirement-relative input isolation enforced
- **Date:** 2026-09-01
- **Scope:** `evidence_fact_extraction` semantic ownership and reuse boundary

## Decision

An Evidence Fact is **enterprise-source truth**, not a Requirement-relative
judgment. It answers:

> What does this enterprise source actually state?

Evidence Support answers a different question:

> Does this source or fact support this Requirement?

Fact semantic values must therefore remain stable when only the Requirement or
its Review verdict changes. Requirement–Fact relationship remains the separate
Backend-owned Mapping concern.

## Authority boundary

The provider task is:

```text
evidence_fact_extraction
contract: 4.3-evidence-fact-extraction-v1
```

The Semantic Worker proposes only source-grounded semantic values:

```text
subject_type
subject_name
entities
status
status_source_text
scopes
scope_source_texts
quantities
validity
domain_metadata
```

The Backend owns and derives:

```text
source_text
source_span_id
source_text_hash
material_id
source_document_id
anchor_chunk_id
project_id
evidence_review_id
fact_id
payload_hash
review_status
extractor_type/version
contract/version
supersession/edit lifecycle
persistence
```

The only canonical write path is:

```text
EvidenceSourceFactService
  → createEvidenceFactContract()
  → evidence_source_facts
```

The Semantic Worker has no Fact, Review, Mapping, Sufficiency, Claim,
approval, provenance, identity, hash, or lifecycle authority.

## Field ownership

### Semantic / hybrid

`subject`, `entities`, `scopes`, `status`, `quantities`, and `validity` express
source-relative meaning and require semantic interpretation. Source quotes,
numeric values, identifiers, and dates are model proposals that must pass
Backend grounding and format checks.

The canonical `subject` object is mechanically assembled from
`subject_type + subject_name`. Canonical payload hashing and `fact_id` creation
remain Backend-derived.

### Unresolved

`domain_metadata` remains unresolved. Its namespace shape is validated, but its
domain semantics and source-grounding policy are not sufficiently specified
for a final owner decision.

## Dependent-field invariants

```text
status != unknown
  → status_source_text is required, non-empty, and source-grounded

scope[i]
  → scope_source_texts[scope[i]] is required and source-grounded

entity.identifier
  → applies only to an existing entity and must be grounded

quantity sample_size / conditions
  → are dependent on a quantity item and retain decimal constraints

validity dates
  → are meaningful only for known validity and must be formatted/grounded
```

JSON Schema structural validity is not sufficient for Fact semantic or
grounding validity; the canonical factory remains the final validation
boundary.

## Requirement-independence risk (pre-patch baseline)

`requirement_text` and an expected Requirement outcome do not enter the Fact
Provider payload. However, the payload currently includes `evidence_capability`
and `support_level` inside the approved Review object. These are
Requirement-relative Review metadata. They are needed by the owning service to
authorize or reject extraction, but they are also visible in the semantic
request today.

This created the historical:

```text
FACT_REQUIREMENT_CONTAMINATION_RISK
```

The Fact prompt said `source_text` was the only factual basis, but the
pre-patch implementation had no executable cross-Requirement invariant
proving that changing Review support metadata could not change the semantic
Fact payload. The implementation status and invariant are recorded below.

## Cross-Requirement parity audit

Using the pre-patch production payload builder offline with identical source
text, source hash, material, and provenance:

| Case | Review metadata | Semantic request hash | Payload hash |
|---|---|---|---|
| FCR-01 | `capable / full_support` | `1acd18321d327add6af1561a8b173272d1264f5b72390f3cf432f238c074d577` | `b3cfce35ed761794f4bf2f6270ce901142f05dc3afad684533a46f64d715d34a` |
| FCR-02 | `capable / partial_support` | `5c9856168bce55c83b107b8bf0661676dc2c0dafd8b54a1d680ea54b220580e4` | `2f0cb1800ed023e6c604a36c4bab10d732f6659492434fdef034789added2b85` |
| FCR-03 | `capable / insufficient` | `2ea483c880b3242e76c91601a6b3fc6803a8f9305219f0e6b617c911c1b6ccc4` | `b122129416ad8dc482e7d82d9112fb4d97539e4341426faef102cd50ebe1092c` |

The source and provenance were identical, but the semantic request changed.
This proves input conditioning is present; it does not prove that the model
would emit different Fact values. A future executable parity test must
separate authorization differences from semantic-input differences.

## Executable input boundary (offline design proof)

The accepted boundary is now explicit: Review metadata remains in the
Backend authorization/audit envelope, while the model-facing semantic
projection contains only `source_text` and source-relative Material context
(plus the invariant task instruction). `review_id`, `review_status`,
`evidence_capability`, and `support_level` must not be semantic meaning hints.

An offline projection proof with identical Source/Material produced:

| Case | Authorization hash | Target semantic input hash |
|---|---|---|
| FI-A (`EREVIEW-FI-A`, `full_support`) | `97e94dd865e55410fa66742bd6af9487a7a08491226c2b3b4574ef011480269b` | `324d39437a5b04dd0874964796b640f84d10ae84c051e9cdc97ef65a8aab9c07` |
| FI-B (`EREVIEW-FI-B`, `full_support`) | `671c9ac638192536399c68e851c574656d8624be868a852b09ba222c85f31c65` | `324d39437a5b04dd0874964796b640f84d10ae84c051e9cdc97ef65a8aab9c07` |
| FI-C (`EREVIEW-FI-C`, `insufficient`) | `415820de079d33c6b9d10f590c6ae2cfd58555f2a55f853c6751749b6918257e` | `324d39437a5b04dd0874964796b640f84d10ae84c051e9cdc97ef65a8aab9c07` |

The production model-facing projection now uses the same semantic input hash
for all three cases; the authorization envelope remains separate and is not
serialized into the model request. No Provider output claim is made here.

The authorization guard is independently preserved: an unapproved Review
returns `EVIDENCE_REVIEW_NOT_APPROVED`, and a `reference_only` capability
returns `EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN`; in both cases the extractor
was not invoked.

Executable guard specification:

```text
FACT_SEMANTIC_INPUT_REQUIREMENT_INDEPENDENCE
FI-01: same Source + different support_level → identical semantic input
FI-02: same Source + different Review ID → identical semantic input
FI-03: ineligible Review → no semantic request is created
```

The boundary is implemented by the single `buildEvidenceFactSemanticInput`
projection used by `SemanticGatewayEvidenceFactExtractor`; the existing
`buildEvidenceFactExtractionPayload` name delegates to that projection. This
is not a second Fact authority or a compatibility path.

Implementation invariant:

```text
authorization metadata may vary by Requirement;
Fact model-facing semantic input is source-relative and invariant
for the same Source context.
```

## Canonical reuse

Canonical Fact persistence is already Requirement-independent:

- `fact_id` does not include `requirement_id`;
- Fact source authority is the Source Span/material lineage;
- Requirement identity belongs to `requirement_evidence_fact_mappings`;
- one canonical Fact may be mapped to multiple Requirements.

The Fact identity and Mapping authority model remain unchanged; producer
input conditioning is now isolated by the implemented semantic projection.

## Prior live failure record

The following are Provider/schema-boundary cases, not evidence that the
Canonical Fact Contract should be weakened:

- `entities[0]` expected an object but received a string — Provider/schema
  adherence failure;
- unauthorized `entity_type` and `valid_to` — legacy/alternate field
  contamination under strict additional-property validation;
- `scope_source_texts` wrong type — dependent grounding-field mismatch;
- empty `status_source_text` — conditional status grounding failure;
- `facts=[]` — empty semantic result, fail-closed as no Fact candidate.

## Consolidation principle

`PARTIAL_CONSOLIDATION_RECOMMENDED` remains the accepted direction. A future
shared semantic analysis may emit two explicitly separated projections:

```text
support_observation = Requirement-relative
fact_candidates     = Source-relative
```

It must not become one giant prompt that allows Requirement context to rewrite
Fact truth. Existing Support, Fact, Canonical Fact, Mapping, Sufficiency,
Claim Gate, and Human Review boundaries remain active until a separate,
parity-tested migration decision.

## Invariants

```text
FACT_SEMANTIC_SOURCE_RELATIVE = TRUE
FACT_SEMANTIC_INPUT_REQUIREMENT_INDEPENDENT = TRUE
FACT_REQUIREMENT_CONDITIONING_PROVEN = FALSE
FACT_REQUIREMENT_CONTAMINATION_RISK = FALSE
FACT_CANONICAL_PERSISTENCE_REQUIREMENT_INDEPENDENT = TRUE
LLM_FACT_AUTHORITY = FALSE
BACKEND_FACT_AUTHORITY = TRUE
DOMAIN_METADATA_OWNERSHIP = UNRESOLVED
MAPPING_CHANGE_IN_THIS_DECISION = FALSE
```

No Prompt, Schema, Validator, Gateway, Fact Contract, DB, Mapping, or
production semantic behavior is changed by this ADR. Any future change to
remove Review metadata from semantic input requires a focused implementation
decision and cross-Requirement parity regression.

## Fact transport complexity ladder and implementation (2026-09-01)

The controlled DeepSeek probe used the same non-sensitive source text and the
production provider settings. P1 (subject only) and P2 (entities/status) both
passed strict `json_schema`; P3 (the current-like Fact shape) reached HTTP 200
but failed validation at `quantities[0]`: `context` was an unsupported field,
`metric` was missing, and `value` was numeric rather than exact decimal text.
This is recorded as `FACT_SCHEMA_COMPLEXITY_THRESHOLD_CONFIRMED`, not a
transport or model-availability failure.

The approved direction is a **transport-only** simplification. The Canonical
Fact Contract, authority, provenance, and lifecycle remain unchanged. The
P2-proven `status`, `entities`, `validity`, and unresolved `domain_metadata`
semantics remain unchanged. The provider transport replaces the parallel
scope quote map with source-bound scope items, and represents quantities with
an explicit `metric`, source quote, and ordered conditions:

```text
scopes: [{ value, source_text }]
quantities: [{ metric, value, unit, source_text,
               operator, sample_size, conditions: [{ name, value }] }]
```

The Backend may perform only deterministic projection: build
`scope_source_texts`, build the quantity `conditions` object (duplicate keys
fail closed), and normalize safe numeric values to exact decimal strings. It
must not infer `metric` from free text or map `context` to `metric`. Generic
`statements`/untyped observations are rejected as they would move semantic
interpretation into the Backend. `domain_metadata` remains
`OWNERSHIP_UNRESOLVED` and is not a transport garbage-bin.

The implementation is owned by the shared semantic transport schema and the
single `projectEvidenceFactTransportCandidate` projection in the Backend
extractor. It preserves exact source grounding and Requirement independence;
unknown fields, conflicting duplicate scope/condition values, unsupported
numeric representations, and missing metrics fail closed. The transport
schema hash is derived from that shared schema and is used by the registered
Gateway task; the Canonical Fact schema/hash, DB, Mapping, Sufficiency, Claim,
and Human Review behavior are unchanged.

Implementation identity:

```text
transport_schema_version = 4.3-evidence-fact-transport-v2
transport_schema_sha256  = 07879e029e558cd90b159c1f07602d4f6ac030cc608eb1205f0f7a447a53c348
task_data_schema_sha256  = 9b1c3dbe95e5817470032ce7594686bdc90e3d794babc7a207ced3ae443f42d9
instruction_hash         = 145e919dba533c7fa89e4535d6876daa3208e72a3f2a60feae49d8bd50bb6b43
```
