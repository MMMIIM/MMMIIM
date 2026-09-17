# V43 Mapping E2E Blocker Final Adjudication

## Decision

`MAPPING_RUNTIME_READY_FOR_SYNTHETIC_E2E`

The Mapping runtime does not read or require `backend/eval/requirement-evidence-mapping-v2/successor-manifest.json`. The successor's `SUCCESSOR_BUILT_NOT_ACTIVATED` state is therefore reclassified as `NON_BLOCKING_EVAL_GOLD_GOVERNANCE_DEBT` for this runtime readiness question.

## Actual production-shaped path

`POST /api/projects/:projectId/requirements/:requirementId/requirement-evidence-fact-mappings/produce` (`backend/src/app.js`) delegates to `RequirementEvidenceFactMappingService` (`backend/src/requirement-evidence-fact-mapping-service.js`). The service obtains a candidate set from `MappingCandidateBuilder`, evaluates batches through `SemanticGatewayMappingEvaluator` for task `requirement_evidence_mapping`, projects the result through the frozen Mapping contract/policy, and persists only through the canonical `requirement_evidence_fact_mappings` repository boundary when a write is explicitly authorized.

Static search found no successor-manifest reference in `backend/src` or `backend/scripts`. References are confined to Eval/governance tooling, including `backend/eval/real-e2e/build-pre-e2e-offline-closure-v1.mjs` and the Mapping Gold export script.

## Input boundary

The Mapping contract accepts a current canonical Requirement plus approved/current, lineage-verified Fact objects carrying source span/material identity, payload hash, contract version, and an upstream support boundary. The frozen 500 CORE6 deep-chain selection remains unchanged.

Chengchuan Base16 remains `CONTROLLED_REAL_TEST` / `SYNTHETIC_ENTERPRISE_EVIDENCE` with `production_authority=NONE`. Its current synthetic material marker is intentionally resolved as `REFERENCE_ONLY` by the existing source-role gate and is filtered by `MappingCandidateBuilder`; this is an authority boundary, not a successor-manifest dependency. Synthetic Eval fixtures can exercise the same Mapping contract without promoting the corpus to Production authority. No E2E was run and no vectors were re-embedded.

## Frozen taxonomy

- Relationships: `direct`, `partial`, `related`, `conflict`, `unrelated`, `unknown`
- Support levels: `full_support`, `partial_support`, `conflict`, `insufficient`, `reference_only`, `unknown`
- Dimensions: `subject_match`, `scope_match`, `status_match`, `quantitative_match`, `entity_match`, `validity_match`, `support_sufficiency`
- Dimension values: `match`, `mismatch`, `unknown`, `not_applicable`
- Transport decisions: `direct_full`, `partial_support`, `related_reference`, `related_insufficient`, `conflict`, `unrelated`, `unknown`
- Policy version: `mapping-decision-policy-v1`

## Safety

Provider calls, LLM calls, database writes, Mapping/Claim/Writer actions, Gold mutations, and Git integration actions were all zero. Router V2.2.3 and the 500 deep-chain selection were not changed.
