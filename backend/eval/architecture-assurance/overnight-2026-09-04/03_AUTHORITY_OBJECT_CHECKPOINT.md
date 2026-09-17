# Phase 03 — Business Object / Authority Audit Checkpoint

**PHASE:** 03  
**OBJECTIVE:** Map creator, reviewer and final authority for every business object and test the invariant that downstream objects never expand upstream authority.

## Files inspected

`canonical-requirements.js`, `requirement-parse-service.js`, `requirement-source-service.js`, material/evidence/review/fact/mapping services, `production-beta-service.js`, Claim Gate contracts/adapters, project-fact control/propagation, writer authorization/snapshot/execution modules, Agent policy/executor, migrations `003`, `007`, `010`, `017`, `019`, `022`, `023`, `025`–`036`, `045`–`051`, and targeted authority tests.

## Authority registry

| Object | Formal creator / final authority | Reviewer / lifecycle | LLM/Eval/Codex authority |
|---|---|---|---|
| Project | `PgRepository.createProjectWithOwner`; owner/authorization service | owner + project membership | LLM/Eval/Codex: no |
| Tender Source / Parse Job | upload route + `RequirementParseService`; parse state persisted | system state; source confirmation is human | LLM creates no formal source |
| Requirement Candidate | extraction gateway proposes; repository stores | `RequirementSourceService` / human confirmation | LLM candidate only; Eval/Codex no |
| Canonical Requirement | `buildCanonicalRequirements` + backend confirmation | baseline confirmation human/trusted actor; immutable after confirmed | LLM/Eval/Codex no |
| Material / Chunk | `CompanyMaterialService` and deterministic chunker | material lifecycle/review policy | LLM may extract text; no authority |
| Retrieval Candidate | `EnterpriseRetrievalService` | retrieval audit; not formal proof | LLM no; Eval no production authority |
| Evidence Span / Review | source-span resolver + `EvidenceReviewService` | human review decision | LLM may assess/propose; cannot approve |
| Evidence Fact | fact service/extractor; versioned source lineage | human approve/reject and supersede | LLM candidate only; Eval/Codex no |
| Mapping | mapping service + evaluator; review decision persisted | human review is final | semantic evaluator proposes; Eval no |
| Readiness / Sufficiency | deterministic readiness service | derived, not authority | no |
| Project Fact | `ProjectFactControlService` | human review/conflict resolution | no direct LLM/Eval authority |
| Claim / Claim Gate Result | deterministic ClaimBuilder + ClaimGate; v2 evaluation persisted | human claim decision where applicable; gate is canonical policy | LLM does not authorize; Eval fixtures no |
| Response Plan | deterministic backend builder | user edits through service | no semantic provider in formal path |
| Writer Authorization / Safe Context | authorization v1 + snapshot builder | generated from current gate/lineage; invalidation service | LLM cannot expand |
| Generation / Section / Version | DocumentGenerationService + writer provider; finalization | sanitizer/validator then human version confirmation | provider drafts only; no final confirmation |
| Mention Ledger | writer authorization/execution service | audit/materialization | no |
| Gold Requirement/Fact/Mapping/Claim | Eval artifacts + human adjudication governance | human only | Codex automation cannot mark human or promote |

## CONFIRMED_FACTS

- **CONFIRMED_BY_CODE:** Candidate extraction, canonicalization, Evidence Fact, Mapping and Claim Gate have separate contracts and persistence objects.
- **CONFIRMED_BY_CODE/TEST:** canonical Requirement IDs and exact dedup are backend-generated; mapping candidates filter for approved/current/lineaged facts; Claim Gate v2 decisions project to legacy approved/rejected/null without widening `needs_review`/`restrict`.
- **CONFIRMED_BY_CODE:** Writer assertability requires current allow gate, matching assertion hash, gate result ID, input snapshot hash and `lineage_current=true`.
- **CONFIRMED_BY_CODE:** Agent action policy routes formal approvals/mutations through trusted services and human-required levels; Agent does not directly own Fact/Mapping/Claim authority in the inspected path.
- **CONFIRMED_BY_SCHEMA:** confirmed Requirement baseline and reviewed Evidence Fact rows have immutability/version triggers; mapping identity includes Requirement and Fact hashes/contracts.

## CONFLICTING_FACTS

- **CONFLICTING:** `createRequirementResponseGateEvaluation` creates an `allow` v2 evaluation for a requirement-response Claim after deterministic legacy gate approval, while enterprise Claims require approved Mapping/Fact. This is intentional separation of tender-response permission from enterprise capability proof, but the helper itself has no direct current-baseline lookup.
- **CONFLICTING:** legacy tables (`evidence_facts`, `requirement_evidence_mappings`) remain readable and some adapters project legacy fields; exact runtime use must be verified by Phase 07.

## UNKNOWN_AREAS

- Whether every persisted Claim has a corresponding latest Gate evaluation after historical migrations.
- Whether all Agent action tools expose the same membership/actor boundary under deployed configuration.

## LOCAL_ONLY_FACTS

- Registry is derived from current dirty source and schema; no human review or production DB state was changed.

## P0_RISKS

- **P0-AUTH-001:** dual legacy/current object representations create a potential authority confusion surface until all read/write paths are proven fail-closed.

## P1_RISKS

- **P1-AUTH-002:** requirement-response allow projection is deterministic but not itself evidence-backed; a regression test should explicitly prove it cannot authorize enterprise capability claims.
- **P1-AUTH-003:** Agent and direct HTTP routes rely on trusted actor resolver/membership configuration, which is runtime-dependent.

## P2_RISKS

- **P2-AUTH-004:** authority registry is not machine-generated from one schema manifest.

## TECH_DEBT

- Legacy Evidence/Mapping rows need eventual canonical-only write convergence while preserving historical reads.

## ARCHITECTURE_DRIFT

- **AD-03-001:** “one formal authority” product principle is implemented through multiple compatibility projections rather than one physical object family.

## NEXT_DEPENDENCY

Phase 04 lineage/invalidation matrix must test every edge and identify where hashes/currentness do not form a hard FK or invalidation chain.

## SAFE_TO_CONTINUE

**YES** — no unconditional enterprise capability allow was proven; authority gaps are recorded for lineage/legacy phases.
