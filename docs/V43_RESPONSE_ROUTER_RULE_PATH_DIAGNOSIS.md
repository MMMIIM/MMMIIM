# V43 Response Router Rule-Path Diagnosis

Scope: read-only diagnosis of `backend/src/pipeline/requirement-response-router.js`; no router or production semantic change.

## Exact deterministic path

1. `projectRequirementResponse(requirement, context)` reads requirement text, category, requirement_category, score/weight/max_score, risk_flags and requirement identity.
2. `textOf` applies NFKC normalization, whitespace collapse and trim; `explicitCategory` lowercases category fields.
3. Predicates are evaluated from the frozen pattern groups `P0_PATTERNS`, `COMPLIANCE_PATTERNS`, `SCORING_PATTERNS`, `EVIDENCE_PATTERNS`, `COMMITMENT_PATTERNS` and `SOLUTION_PATTERNS`.
4. `routeMode` precedence is P0/compliance → EVIDENCE (including evidence+commitment) → COMMITMENT → SOLUTION → NEED_REVIEW fallback.
5. `roleFor` precedence is COMPLIANCE → SCORING → COMMITMENT/contract category → TECHNICAL for SOLUTION/EVIDENCE → NONE.
6. `riskFor` precedence is P0 → compliance pattern HIGH → evidence/risk flag HIGH → commitment/scoring MEDIUM → SOLUTION LOW → MEDIUM fallback.
7. `scoringPriority` uses scoring patterns or score/weight/max_score, with HIGH/MEDIUM/LOW escalation based on the existing text and numeric thresholds.
8. `reasonsFor` emits deterministic reason codes; `deep_chain_required` is true for EVIDENCE or evidence-dependent COMMITMENT; `human_required` is true for NEED_REVIEW or P0.

## Failure families to calibrate

- **ROLE_NONE_COLLAPSE** (calibration examples: JY-001:REQ-030 and JY-001:REQ-033): the final route reaches `routeMode:fallback_need_review`; `roleFor` then reaches NONE when no mode/category branch matches.
- **QUANTITATIVE_PERFORMANCE_ROUTING_MISS** (calibration examples: JY-001:REQ-009, REQ-011, REQ-017, REQ-019 and REQ-021): numeric/performance terms are only consulted through the broad EVIDENCE patterns; there is no dedicated quantitative branch.
- **COMPLIANCE_COMMITMENT_COLLISION** (calibration example: TB-003:REQ-009): P0/compliance predicates run before commitment, but the final reason/mode depends on matching the compliance patterns.
- **CONSEQUENCE_TARGET_SCOPE_FALSE_POSITIVE** (calibration example: HOLDOUT-REQ-V2-02-CAN-0060): P0 patterns match consequence language without a separate consequence-target field; target scope is not independently resolved.
- **SCORING_CONTEXT_LOSS** (calibration example: HOLDOUT-REQ-V2-01-CAN-0506): scoring requires scoring pattern or numeric score/weight/max_score; contextual scoring language outside those predicates falls through.
- **CONTRACT_DELIVERABLE_VS_SOLUTION_COLLISION**: delivery/contract category and contract patterns are handled in role assignment after mode selection; implementation language can reach SOLUTION before contract context is considered.

This diagnosis records rule paths, not semantic verdicts. The GPT packet supplies the unresolved semantic calibration fields.
