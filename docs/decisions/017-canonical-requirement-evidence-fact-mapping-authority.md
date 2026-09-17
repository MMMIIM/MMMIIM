# ADR-017: Canonical Requirement–Evidence Fact–Mapping Authority

- **Status:** Accepted
- **Date:** 2026-08-30
- **Scope:** Evidence Fact, Requirement–Evidence Fact Mapping, sufficiency,
  readiness, Claim permission and their runtime consumers.

## Context

The repository contains two historical representations of an Evidence Fact
(`evidence_facts` and `evidence_source_facts`) and two representations of a
Requirement–Evidence Mapping (`requirement_evidence_mappings` and
`requirement_evidence_fact_mappings`). The newer Evidence Review → Source Fact
→ Fact Mapping path is the formal path consumed by Claim and Readiness code,
while the older tables and APIs remain for history, audit and temporary
compatibility. Without an explicit authority boundary, identical words such
as *approved*, *support* and *mapping* can be mistaken for interchangeable
business states.

## Decision

### Evidence Fact

`evidence_source_facts` is the sole canonical Evidence Fact persistence owner,
implemented by `EvidenceSourceFactService`. A canonical Evidence Fact is a
bounded, atomic enterprise fact that is bound to an exact source span, an
approved Evidence Review and traceable company-material lineage.

`evidence_facts` is a legacy representation. It may be read for historical
compatibility and audit, or served by a temporary legacy UI/API, but it cannot
authorize Claim support, sufficiency, readiness or Writer input and cannot be
used as the canonical mapping Fact FK.

### Requirement–Evidence Fact Mapping

`requirement_evidence_fact_mappings` is the sole canonical Mapping persistence
owner, implemented by `RequirementEvidenceFactMappingService`. A canonical
Mapping is a reviewed support relationship between a Canonical Requirement and
an approved canonical Evidence Fact.

它正式定义为 **Canonical Requirement 与 approved Evidence Fact** 之间的
受审查支持关系。

`requirement_evidence_mappings` is legacy. It may remain for historical reads,
audit and temporary compatibility, but it is not authority for Claim support,
sufficiency, readiness, Writer input or canonical Mapping creation.

The `requirement-evidence-mapping-v1.1` contract is the active Mapping
contract. Its `requirement_id` is the database FK to `requirements.id` (the
display `req_id` is not an FK), and `evidence_fact_id` points only to
`evidence_source_facts`. Retrieval results, `evidences`, `evidence_facts`,
chunks and source spans are lineage/input, not canonical Fact identity. The
v1.1 dimension values preserve the distinction between `unknown` (applicable
but not established) and `not_applicable` (the Requirement does not ask for
that dimension).

### Sufficiency and readiness

Sufficiency is not a persisted Mapping authority. Backend Evidence Support
observations are aggregated by `aggregateEvidenceSufficiency()` and consumed
by `EvidenceReadinessService`. The existing
`evidence_support_assessment` semantic seam handles unavailable or uncertain
observations. No `sufficiency_assessment` LLM task is introduced.

### Claim permission and lifecycle

Evidence approval, Review approval, Fact approval, Mapping approval and Claim
approval are distinct lifecycle events; there is no global `approved = true`
authority. Mapping approval is not Claim approval. Claim permission is decided
only by `ClaimGateService` / the Enterprise Claim Gate, and Writer input is
authorized only after that gate.

### Authority table

| Business fact | Canonical owner | Legacy representation | Canonical write authority |
|---|---|---|---|
| Requirement | `requirements` / canonical Requirement path | none | Requirement parse/baseline owner |
| Evidence Fact | `evidence_source_facts` | `evidence_facts` | `EvidenceSourceFactService` |
| Requirement–Evidence Fact Mapping | `requirement_evidence_fact_mappings` | `requirement_evidence_mappings` | `RequirementEvidenceFactMappingService` |
| Sufficiency | Evidence Support + readiness derivation | none | Backend derived (`aggregateEvidenceSufficiency`) |
| Claim permission | Claim Gate | none | `ClaimGateService` / Enterprise Claim Gate |
| Coverage | Coverage validator / `requirement_coverages` | none | Coverage lifecycle |

Each row has at most one canonical write authority. Legacy rows do not gain
formal Claim, Sufficiency, Readiness or Writer authority merely because an old
API reports an approved status.

## Consumer authority audit

`EvidenceReadinessService` reads `listRequirementEvidenceFactMappings` and
canonical source facts. `PgRepository.getApprovedRequirementFactSupport()`
joins only `requirement_evidence_fact_mappings`, approved source facts/reviews,
current hashes and source lineage. `ProductionBetaService.generateClaims()`
requires that canonical lookup and fails closed when it is unavailable. The
Claim Gate services and `DocumentGenerationService` consume gated Claim/Writer
outputs, not legacy mappings. `ReviewCenterService` may expose review and
compatibility views, but does not grant legacy Claim authority.

## Explicit non-equivalences

Retrieval Candidate ≠ Evidence; Evidence ≠ Evidence Fact; Source Span ≠
Evidence Fact; Evidence Support Assessment ≠ Mapping; Mapping ≠ Sufficiency;
Sufficiency ≠ Readiness; Mapping approval ≠ Claim approval; Mapping ≠ Coverage;
Claim Gate ≠ Claim; Requirement ID ≠ Candidate ID.

`support_level` enums are contract-specific. Legacy three-value support
levels must not be compared with canonical Mapping/Review enums without an
explicit adapter. Naming/status cleanup is retained as P1 backlog and is not
a reason to merge contracts in this ADR.

## Consequences and non-goals

This freezes authority without deleting legacy tables/APIs, rewriting the
frontend, adding a Mapping v2/v3, or adding a new service. Mapping Producer V1
uses the existing `RequirementEvidenceFactMappingService` authority with a
thin `MappingCandidateBuilder`, a shared strict
`requirement_evidence_mapping` semantic task, Backend projection/policy, and
repository-owned Requirement-level atomic set persistence. The
`ProviderNeutralMappingEvaluator` remains available for explicit no-provider
fixtures; production wiring uses the shared Gateway evaluator. Provider
qualification remains a separate, explicitly authorized live step.
