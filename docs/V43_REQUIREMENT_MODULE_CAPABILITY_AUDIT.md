# V43 Requirement Module Capability Audit

**Status:** `REQUIREMENT_MODULE_CAPABILITY_AUDIT_COMPLETE`
**Audit mode:** read-only static capability audit
**Repository:** `feat/v4.3-semantic-boundary-routing`
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
**Worktree:** dirty before this audit; pre-existing changes were preserved. The audit did not alter them.

## Scope and evidence

The conclusions below are based on the current working tree, Requirement source code, repository SQL, migration SQL, semantic-contract definitions, and existing tests. No Provider was called, no database write was made, and no existing Gold artifact was changed. The runtime database was not mutated or used as a source of truth; schema facts are taken from the migration chain and the SQL selected by the repository.

Inspected primary paths:

- `backend/src/pipeline/requirement-extraction.js`
- `backend/src/pipeline/requirement-chunker.js`
- `backend/src/pipeline/canonical-requirements.js`
- `backend/src/pipeline/mandatory-requirement.js`
- `backend/src/requirement-parse-service.js`
- `backend/src/requirement-source-service.js`
- `backend/src/requirement-evidence-fact-mapping-service.js`
- `backend/src/db.js`
- `packages/semantic-contracts/index.js`
- `backend/migrations/003_tender_parse_confirmation.sql`
- `backend/migrations/004_requirement_extraction_chunks.sql`
- `backend/migrations/005_mandatory_requirement_metadata.sql`
- `backend/migrations/008_requirement_source_mapping.sql`
- `backend/migrations/009_requirement_source_ranges.sql`
- `backend/migrations/010_provisional_requirement_baseline.sql`
- `backend/migrations/011_requirement_candidate_api_and_classification.sql`
- `backend/migrations/017_canonical_requirement_v1.sql`
- `backend/migrations/018_requirement_source_resolution_ambiguous.sql`
- `backend/migrations/046_actor_boundary_requirement_classification.sql`

Relevant test evidence includes `canonical-requirements-v1.test.js`, `requirement-chunker-v2.test.js`, `requirement-extraction-contract-owner.test.js`, `requirement-source-provenance.test.js`, `requirement-source-reconstruction.test.js`, `requirement-evaluation.test.js`, `requirement-gold-eligibility.test.js`, `provisional-requirement-baseline.test.js`, and `tender-parse.test.js`.

## EXTRACTION_CAPABILITY

**Implemented: YES.**

1. **PDF/chunk input — YES.** `RequirementParseService.processJob()` reads the tender file, runs the text extractor, classifies the requirement scope, and calls `chunkExtractedText()`. The production chunker emits deterministic chunks with `Cxxx-Sxxx` source references, model text, offsets, page/paragraph boundaries, and content hashes. The text extractor path accepts text-based PDF (and the supported document types enforced by `DocumentCapabilityDetector`).
2. **Candidate Requirement output — YES.** `createRequirementExtractionGateway().extract()` calls the registered `requirement_extraction` semantic task and `validateRequirementExtractionEnvelope()` accepts only the frozen envelope/schema. It projects each model item to text, category, source range, `mandatory_observed`, and `requires_confirmation`; the model does not assign a formal REQ-ID.
3. **Category classification — YES, in two layers.** The extraction contract validates the candidate taxonomy (`functional`, `technical`, `performance`, `security`, `data`, `implementation`, `delivery`, `acceptance`, `service`, `constraint`, `other`). `buildCanonicalRequirements()` normalizes aliases and deterministically maps to the downstream/formal categories (`technical`, `performance`, `implementation`, `delivery`, `service`, `contractual`, `commercial`, `qualification`, `context`). Unknown categories become `other`/`context` with a warning and review flag; this is not an importance score.
4. **Mandatory judgment — YES.** Candidate output carries `mandatory_observed`. Before persistence, `enrichMandatoryRequirement()` derives `is_mandatory`, marker, scope rule and exceptions from backend-validated source text and mandatory scope rules. The resulting boolean and metadata are asserted by `assertMandatoryRequirementMetadata()`.
5. **`requires_confirmation` judgment — YES, deterministic canonical rule.** The extraction contract requires the candidate hint, but `buildCanonicalRequirements()` computes the canonical value from verified source context and frozen rules (explicit pending, to-be-provided, to-be-determined, missing referenced content, incomplete clause). A candidate hint is not treated as authority by itself. Unverified/ambiguous/suggested source evidence does not receive fabricated verified fields.
6. **Source lineage — YES.** The parser resolves candidate ranges through `SourceLocationResolver`, validates the candidate scope, and persists source chunk/page/paragraph ranges, source hash, resolution status/method, verified flag, paragraph hashes, and source evidence. `RequirementSourceService.reconcileRequirementSources()` re-extracts and hashes the same tender snapshot and persists reconciliation/audit rows; mismatches fail closed.

## CANONICALIZATION_CAPABILITY

**Implemented, with a deliberately narrow scope.**

- **Exact duplicate detection — YES.** `buildCanonicalRequirements()` constructs a deterministic exact key from normalized candidate category, normalized requirement text, normalized raw source text, and source clause. The map is applied before formal ID assignment.
- **Candidate aggregation — YES.** `aggregateRequirementCandidates()` combines validated candidates from all processed chunks. Exact duplicates are retained as `merged_candidate_refs` and `merged_candidate_count`; the audit reports `candidate_count`, `duplicate_count`, and `canonical_count`.
- **Canonical Requirement ID — YES.** The canonical builder assigns stable sequential `REQ-001`, `REQ-002`, … IDs after deduplication and records `ordinal`, `canonical_rule_version`, and deduplication metadata. The persistence layer stores these IDs in `requirement_candidates` and later in `requirements`.
- **Semantic merge — NO.** There is no embedding, fuzzy, or semantic-similarity merge in the Requirement module. Similar-but-not-exact text remains separate.
- **Parent/child requirement model — NO.** There is no parent-child Requirement hierarchy or relationship table. The chunker protects semantic boundaries and the canonical object carries `atomicity_review_required`, but that flag does not create a hierarchy or split/merge children.
- **Formal-object canonicalization — LIMITED.** `canonicalizeRequirements()` validates already-IDed formal Requirements (including route and mandatory metadata) and explicitly treats their IDs as fixed; it does not merge them. The merge/ID operation is `buildCanonicalRequirements()` before formal persistence.

## IMPORTANCE_CAPABILITY

**PARTIAL only for mandatory metadata; importance classification is not implemented.**

- `priority`: **NO** in the Requirement schema/module.
- `importance`: **NO**.
- `criticality`: **NO**.
- `mandatory level`: **PARTIAL** — the module has a boolean `is_mandatory`, `mandatory_observed`, marker, scope source, and exception IDs. This is a mandatory/compliance flag, not a graded importance level.
- `evaluation weight`: **NO**.

The migration and source scan contain no Requirement field/service for priority, importance, criticality, importance level, or evaluation weight. Downstream readiness may derive operational gap priority, but that is not Requirement importance classification and is outside this module audit.

## BASELINE_ROLE

`requirement_baselines` is a **confirmed Requirement snapshot/version and lifecycle boundary**, not the canonicalization engine.

- It is one-per-project and linked one-to-one to a parse job (`project_id` and `parse_job_id` uniqueness in migration 003).
- It moves through `building` to `confirmed`; confirmed baseline and its Requirement rows are protected by immutability triggers.
- `confirmRequirementBaseline()` writes the already canonicalized, routed Requirement rows and records confirmation actor/time/type (including mixed provisional state).
- `getRequirementBaseline()` reloads the confirmed snapshot and its formal `requirements`; `getFormalRequirements()` and downstream services consume those rows.

Therefore, a Baseline is the version/confirmation boundary around canonical Requirements. It does not perform duplicate detection, semantic merge, or importance scoring.

## GOLD_INPUT_RECOMMENDATION

**Primary recommendation: B — Canonical Requirement.**

- Raw Candidate is appropriate only as a temporary extraction/preclassification/reconstruction input. It has model-originated candidate semantics and can contain duplicates, unresolved provenance, or provisional decisions; it must not be the final semantic Gold denominator by itself.
- Canonical Requirement is the correct semantic identity layer because exact deduplication and stable REQ-ID assignment occur there, with source evidence, confirmation reasons, risk flags, category, mandatory metadata, and writer eligibility already materialized.
- Requirement Baseline (C) is the correct **production-state qualifier** when the Gold case is intended to represent a confirmed project snapshot. It is not a replacement for the canonical identity; it supplies the confirmed/versioned container and status boundary.

Accordingly: build/partition Gold candidates from canonicalized, source-grounded Requirements; use a confirmed Baseline when testing the production-confirmed state; retain Raw Candidates only for extraction-quality and human-review staging.

## Capability matrix

| Capability | 已实现 | 位置 | 说明 |
| --- | --- | --- | --- |
| candidate extraction | YES | `requirement-extraction.js`, `requirement-parse-service.js` | Frozen semantic task validates candidate array; parser/chunker feed each chunk. |
| source lineage | YES | `source-location-resolver.js`, `requirement-parse-service.js`, `requirement-source-service.js`, migrations 008/009/018 | Backend resolves and verifies source refs, hashes, ranges, status, and reconciliation. |
| category classification | YES | `packages/semantic-contracts/index.js`, `canonical-requirements.js`, migration 011 | Candidate taxonomy is normalized to formal downstream categories; unknowns are reviewable. |
| requirement merge | PARTIAL | `canonical-requirements.js`, `requirement-chunker.js` | Exact normalized-key dedup/aggregation only; no semantic/fuzzy merge. |
| canonical requirement | YES | `canonical-requirements.js`, `db.js`, migration 017 | Stable sequential REQ-ID after exact dedup; canonical metadata and audit persisted. |
| importance classification | NO (mandatory only) | `mandatory-requirement.js`, migrations 005/006/011 | Boolean mandatory and scope metadata exist; no priority/importance/weight model. |
| baseline/version | YES | `requirement-parse-service.js`, `db.js`, migration 003 and 010 | Confirmed, immutable per-project snapshot/version boundary with confirmation audit fields. |

## Database schema facts

- `requirement_candidates` stores parse-job candidates, source text/excerpt/hash/chunk/ranges/status, category, mandatory fields, confirmation fields, classification fields, source evidence, deduplication and canonical rule version.
- `requirements` stores formal baseline-bound rows with the corresponding content, source lineage, mandatory/classification/confirmation metadata, target sections, deduplication and canonical rule version.
- `requirement_baselines` stores the project/parse-job snapshot lifecycle and confirmation metadata; immutable after confirmation.
- `requirement_source_reconciliations` stores file/extracted-text hashes, extractor version, reconciliation status/statistics, and timestamps.
- `requirement_coverages` stores downstream covered/severity/source-status/category/mandatory/writer-eligibility projections; it is not the canonicalization table.
- No inspected Requirement migration adds importance, priority, criticality, or evaluation-weight columns.

## Explicit non-capabilities and boundaries

- No embedding/fuzzy semantic deduplication or parent-child Requirement graph.
- No importance/priority scoring beyond mandatory boolean/scope metadata.
- Requirement Gold is not automatically frozen or promoted by this module.
- Chapter routing supplies `target_sections` for canonical/formal Requirements; it does not change Requirement text or identity.
- Evidence/Fact/Mapping services consume confirmed Requirements; they do not canonicalize extraction candidates.

**Final status:** `REQUIREMENT_MODULE_CAPABILITY_AUDIT_COMPLETE`
