# V43 Chain Closure — Local Authority Path Manifest

**Audit mode:** read-only inventory before Track A remediation  
**Branch:** `feat/v4.3-semantic-boundary-routing`  
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`  
**Production writes:** 0  
**Provider calls:** 0  
**Gold mutations:** 0

This manifest records the current local implementation, not historical
checkpoints. `Material Authority Gate` means the single predicate exported by
`pipeline/material-source-authority-policy.js`; no parallel lifecycle rule is
introduced by this audit.

| Surface | Path / owner | Entry point | Authority-bearing | Current lifecycle gate | AS-IS status |
|---|---|---|---|---|---|
| Material lifecycle / authority | `src/pipeline/material-source-authority-policy.js` (`materialAuthorityStatus`, `isAuthorityEligible`) | shared policy calls | YES | one deterministic lifecycle/provenance predicate | ENFORCED |
| Material transitions | `src/company-material-service.js` → `PgRepository.quarantineCompanyMaterial` | company-material quarantine API | YES | owning-service transition; persisted lifecycle state | ENFORCED |
| New Retrieval | `src/pipeline/enterprise-retrieval-service.js` → `PgRepository.listChunksForRetrieval` | `POST /api/requirements/:requirementId/enterprise-retrieval` | YES | `MATERIAL_AUTHORITY_SQL` in candidate query | ENFORCED |
| Historical Retrieval reload | `src/pipeline/enterprise-retrieval-service.js` → `PgRepository.getRetrievalRun` | `GET /api/enterprise-retrieval-runs/:runId` | YES | result reload currently joins material without lifecycle predicate | BYPASS_FOUND |
| Evidence Review context / proposal | `src/evidence-review-service.js` → `PgRepository.getEvidenceReviewCandidate` | `POST /api/projects/:projectId/requirements/:requirementId/evidence-reviews` | YES | candidate lineage joins material, but no authority predicate | BYPASS_FOUND |
| Evidence Review decision | `src/evidence-review-service.js` → current/read + `decideEvidenceCandidateReview` | `POST /api/evidence-reviews/:reviewId/approve|reject` | YES | status/staleness only; no Material Authority Gate | BYPASS_FOUND |
| Canonical Fact draft | `src/evidence-source-fact-service.js` → `extract` / `upsertEvidenceSourceFactsAtomic` | `POST /api/projects/:projectId/evidence-reviews/:reviewId/facts` | YES | review approval and lineage; extraction context does not reject ineligible material | PARTIAL |
| Canonical Fact edit | `src/evidence-source-fact-service.js` → `edit` / `replaceEvidenceSourceFactAtomic` | `POST /api/evidence-source-facts/:factId/edit` | YES | current read projects authority, but stale/edit path lacks an explicit fail-closed check | PARTIAL |
| Canonical Fact approval | `src/evidence-source-fact-service.js` → `decide` | `POST /api/evidence-source-facts/:factId/approve|reject` | YES | current read exposes authority and approve rejects false | ENFORCED |
| Legacy Evidence Fact | `src/evidence-fact-service.js` → `create`, `decide`; `PgRepository.createEvidenceFact` / `decideEvidenceFact` | `/api/projects/:projectId/evidences/:evidenceId/facts`, `/api/evidence-facts/:factId/*` | YES | service create checks authority; repository mutation/decision does not uniformly gate | BYPASS_FOUND |
| Legacy Evidence Mapping | `src/evidence-service.js` → `proposeMapping`, `decideMapping`; legacy repository methods | `/api/projects/:projectId/evidence-mappings`, `/api/evidence-mappings/:mappingId/*` | YES | create validates authority; decision update has no material predicate | BYPASS_FOUND |
| Canonical Mapping | `src/requirement-evidence-fact-mapping-service.js` + `src/pipeline/mapping-candidate-builder.js` | canonical mapping propose/produce/decide routes | YES | context/current authority checks plus canonical contract | ENFORCED |
| Canonical Claim Gate | `src/pipeline/claim-gate-service.js`, `claim-gate-v2-contract.js`, `claim-gate-input-adapter-v1.js` | claim evaluation / persistence routes | YES | canonical claim gate and approved source authority projection | ENFORCED |
| Writer Authorization | `src/writer-input-authorization-service.js`, `src/pipeline/writer-input-authorization-v1.js` | document generation service | YES | current allow identity, lineage and project scope | ENFORCED |
| Writer Safe Context / snapshot | `src/pipeline/document-generation-service.js`, `writer-authorization-snapshot.js` | generation entry point | YES | server-owned safe context and snapshot identity | ENFORCED |
| Writer provider / output gates | `src/pipeline/writer-provider.js`, `document-sanitizer.js`, `document-validator.js`, `writer-execution-contract-v1.js` | writer execution/finalization | YES | authorization before provider; sanitizer/validator after | ENFORCED |
| Track A evidence | `eval/architecture-assurance/overnight-2026-09-04/V43_P0_RAG_MATERIAL_AUTHORITY_FAIL_CLOSED_ROOT_CAUSE_CHECKPOINT.*` | audit artifacts | NO | documents the known bypasses | NOT_VERIFIED (new NC gates pending) |
| NC01–NC05 / PostgreSQL | `integration/sem-p1-004-entry-matrix.integration.js`, PostgreSQL suites | isolated test runner | NO | existing NC01 and sibling controls; NC02–NC05 to be added | PARTIAL |
| Mapping Gold / Claim Gold | `eval/gold-human-review`, `eval/mapping-benchmark-v1`, `eval/claim-eval-v1` | eval runners | NO | immutable eval inputs; not production authority | ENFORCED |
| Writer Eval / source parity / Track B | `eval/rag-pilot`, `eval/gold-human-review/v2`, `eval/architecture-assurance/.../V43_TRACK_B_*` | eval/audit runners | NO | governance-only, no production writes | ENFORCED |

## Authority boundary summary

The local code has one Material Authority Gate, and new retrieval plus current
canonical projections already use it. The confirmed gaps are downstream
re-entry points: historical retrieval reload, Review context/decision,
canonical Fact draft/edit, and legacy Fact/Mapping mutation. Track A changes are
limited to these boundaries and must not weaken canonical Mapping, Claim Gate,
Writer Safe Context, or Writer Authorization.
