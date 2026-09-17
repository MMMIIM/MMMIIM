# Legacy Reachability Matrix

| Object | Canonical owner | Legacy surface | Can legacy row authorize canonical Claim? | Current status |
|---|---|---|---|---|
| Evidence Fact | `EvidenceSourceFactService` → `evidence_source_facts` | `EvidenceFactService` → `evidence_facts` | **No evidence found; canonical query requires source facts/mappings** | Compatibility write remains reachable |
| Requirement-Evidence relation | `RequirementEvidenceFactMappingService` → `requirement_evidence_fact_mappings` | `EvidenceService` → `requirement_evidence_mappings` | **No**; Claim Gate V2 adapter rejects missing canonical lineage | Compatibility write remains reachable |
| Generation | `claims/generate`, writerV2 | `production-beta` (flagged) | Legacy result does not satisfy canonical authorization snapshot | Legacy-only compatibility |
| Provider | Semantic Gateway task clients | Dify generation adapter | No fallback from canonical task envelopes to legacy fields | Dify legacy-only for old routes |

**Verdict:** `LEGACY_ISOLATION = PARTIAL / FAIL-CLOSED_FOR_CANONICAL_CLAIMS`; legacy surfaces are not inert and require operational deprecation/retirement decision.
