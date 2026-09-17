# ADR-023: Requirement Extraction and Canonical Requirement Authority

- **Decision:** `V43_REQUIREMENT_RAG_ARCHITECTURE_ADR_FREEZE`
- **Status:** Accepted
- **Date:** 2026-09-02
- **Scope:** V4.3 Requirement Extraction, candidate validation and Canonical
  Requirement authority

## Definition and authority

A Requirement is an independently respondable project obligation that can be
evaluated, mapped to Evidence, and used for risk and coverage control. It is
not a collection of tender sentences, a RAG query, Evidence, a Claim, or a
Writer section.

The Requirement Semantic Worker/LLM is a **Requirement Candidate Generator**.
The Backend is the **Canonical Requirement Authority**. The model does not own
REQ-ID, canonical identity, final provenance, source hash, final mandatory or
risk status, deduplication, confirmation, lifecycle, or baseline approval.
Planner, Mapping, Claim and Writer consume the canonical projection and may
not redefine Requirement meaning.

## Production path

The formal path is:

```text
Tender Parser
  -> Section/Scope Classification
  -> Canonical text and semantic chunk windows
  -> additive Layout/Table presentation
  -> Requirement Semantic Worker
  -> Candidate V3 validation
  -> SourceLocationResolver provenance verification
  -> Candidate Scope Gate
  -> deterministic aggregation/canonicalization
  -> Canonical Requirement baseline
```

Layout/Table data is additive context for table boundaries and presentation;
the parsed text, paragraph order, stable `Cxxx-Sxxx` provenance and source hash
remain authoritative. The current implementation overlays table metadata onto
the stable chunk windows before Provider input, so annotation cannot become a
second source authority. `REQUIREMENT_ELIGIBLE` reaches the semantic worker;
`UNKNOWN` is conservatively retained; a pure excluded scope is removed before
Provider execution. Mixed clauses are retained for review, not keyword-filtered.
No Eval-only shortcut is the formal production path.

## Candidate and canonicalization boundary

The active shared contract is:

```text
contract: 4.3-requirement-extraction-v3.1.1
candidate: 4.3-requirement-candidate-v3
candidate_schema_sha256:
1f5bd20f624a34a5f0bfd76e226f24d3595cc8a1e06bdc176c3d40e9694edbba
instruction_sha256:
9b8fe6582e774a64f36b2be307274e297fafb309cf17270a4d8fc463da817305
```

The Candidate contains only the model semantic fields (`text`, canonical
category, `source_range.start_ref`, `source_range.end_ref`,
`mandatory_observed`, and `requires_confirmation`). It cannot contain REQ-ID,
page/paragraph authority, source hash, approval or lifecycle fields. The
Backend owns source resolution, confirmation semantics, risk, deterministic
normalization, exact deduplication, REQ-ID, currentness and baseline state.
Raw Candidates never become formal Requirement state without those checks.

## Requirement evaluation and failure ownership

Requirement Eval is formal quality governance and must measure semantic
coverage/completeness, grouping, provenance, scope, duplicates and failure
layer—not merely range equality or Candidate count. Meaning-critical values
include quantity, deadline, duration, frequency, SLA/threshold, scope,
prerequisites, exceptions/prohibitions, deliverables and acceptance criteria.

Evaluation reuses the production parser, router, chunker, semantic contract and
provenance resolver, or proves executable parity. Benchmark slicing,
benchmark provenance resolution and benchmark-only semantic interpretation are
forbidden. A target selector may locate cases for diagnosis but is not a
production capability. Evaluation artifacts carry dataset, gold, evaluator,
Prompt/schema/runtime and run identity; structural metrics remain distinct from
semantic adjudication. Deterministic/offline gates are Provider-free by
default; live Provider evaluation requires an explicit decision and must not
be spent above a failing lower gate.

An Eval failure does not imply Prompt failure. The first failing owner must be
identified among Parser, Layout/Table, Router, Chunker, Provider Input,
Semantic Worker, Transport/Schema, Provenance, Canonicalizer or Gold/Eval.
Only the owning layer is changed; passed layers remain frozen unless new
evidence invalidates them.

## Reopening and rejected alternatives

Without repeated real regression evidence, do not reopen Candidate architecture,
Canonical Requirement authority, REQ-ID ownership, parser/table rewrites, an
LLM Router, a new Agent, a second semantic pass, a repair LLM, a new
classifier, a subrequirement authority, or a large Prompt redesign. The default
repair order is input integrity, deterministic owning-layer fix, then a minimal
Prompt change; architecture changes require a new decision.

## Cross-module boundary

Requirement means what the tender requires. RAG identifies relevant,
scope-valid, traceable source/context candidates. Fact records formally
established source truth. Mapping describes Fact support for a Requirement.
Claim describes what may be asserted, and Writer expresses only authorized
content. No later module may rewrite an earlier module's authority. In
particular, no Evidence or Retrieval result modifies Canonical Requirement
meaning.

This ADR references the shared Semantic Constitution and does not duplicate it:
Relevant is not Evidence-Bearing; Evidence-Bearing is not Sufficient; a raw
Retrieval Candidate is not formal Evidence; an AI proposal is not Backend
formal state; and no stage silently writes another stage's truth.

## References

- [ADR-008: Curated Corpus Scope and Governance](008-curated-corpus-governance.md)
- [ADR-013: Evaluation Metric Authority and Semantic Namespace](013-evaluation-metric-authority-and-namespace.md)
- [ADR-014: Canonical Production Path and Isolated Test Instances](014-canonical-production-path-and-isolated-test-instances.md)
- [ADR-015: Source Ambiguity Must Not Be Silently Resolved](015-source-ambiguity-must-not-be-silently-resolved.md)
- [ADR-016: Source-Ambiguous Cases Are Not Evaluable Gold](016-source-ambiguous-cases-are-not-evaluable-gold.md)
- [ADR-017: Canonical Requirement–Evidence Fact–Mapping Authority](017-canonical-requirement-evidence-fact-mapping-authority.md)
- [ADR-022: Mapping Producer V1 and Mapping Eval V1 Architecture](022-mapping-producer-and-evaluation-architecture.md)
- [`docs/REQUIREMENT_EXTRACTION_RUNTIME_DECISION.md`](../REQUIREMENT_EXTRACTION_RUNTIME_DECISION.md)
- [`docs/SEMANTIC_CONSTITUTION.md`](../SEMANTIC_CONSTITUTION.md)
