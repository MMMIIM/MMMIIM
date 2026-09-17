# V43_OVERNIGHT_RAG_EVIDENCE_MASTER_CHECKPOINT

## OVERVIEW

- start baseline: 2026-09-01T01:40:38.222Z
- package: 50 materials / 478 chunks
- provider attempts (upper bound): 44/150
- production writes: 0
- DB writes: 0
- provider cap reached: false

## PHASE A — RETRIEVAL / CONTEXT

- cases: 40
- expected doc hit: 38/40
- Relevant@5 cases with a hit: 100%
- scope violations: 0
- final heading-only: 0
- context failures: 0
- provenance failures: 0
- status: RECORDED

## PHASE B — SEMANTIC REVIEW

- cases: 36
- pass: 6
- fail: 30
- negative false-positive: 0
- reference contamination: 0
- schema invalid: 4
- status: QUALITY_FINDINGS

## PHASE C — FACT

- provider cases: 24
- final valid: 0
- first-pass: 0
- retry recovered: 0
- human escalation: 24
- hallucination: 0
- authority contamination: 0
- provenance failure: 0
- status: RECORDED

## PHASE D — MAPPING / READINESS

- runtime available: true
- benchmark executed: false
- approval boundary blocker: MAPPING_BENCHMARK_BLOCKED_BY_APPROVAL_BOUNDARY

## PROVIDER

- HTTP attempts (embedding + Gateway): 44
- provider attempt upper bound: 44
- embedding: {"attempts":40,"success":40,"failure":0}
- semantic review Gateway requests: 4
- fact Gateway requests: 0
- retry: 0
- latency: {"min":0,"mean":797.59,"p50":0,"p95":6917,"max":10827}

## DB

- pre counts: `{"projects":14,"requirements":272,"company_materials":56,"material_chunks":561,"material_chunk_embeddings":561,"evidences":7,"evidence_candidate_reviews":2,"evidence_source_facts":0,"requirement_evidence_mappings":6}`
- post counts: `{"projects":14,"requirements":272,"company_materials":56,"material_chunks":561,"material_chunk_embeddings":561,"evidences":7,"evidence_candidate_reviews":2,"evidence_source_facts":0,"requirement_evidence_mappings":6}`
- unexpected delta: `{"projects":false,"requirements":false,"company_materials":false,"material_chunks":false,"material_chunk_embeddings":false,"evidences":false,"evidence_candidate_reviews":false,"evidence_source_facts":false,"requirement_evidence_mappings":false}`

## CRITICAL FAILURES

NONE

## PRIMARY ROOT CAUSE

FACT_EXTRACTION_BLOCKER

## QUALITY BLOCKER

Fact extraction target was not met: 0/24 eligible cases produced a valid grounded Fact. All 24 stopped at the existing FACT source-hash boundary before any Fact Gateway request; this is distinct from the zero hard-fail safety counters above.

## NEXT ACTIONS

### P0\n\n- problem: No critical blocker observed.\n- evidence: "all hard-fail counters zero"\n- minimal change: Review only the named layer; keep frozen contracts unchanged.\n- expected benefit: Restore evidence-chain confidence.\n- architecture impact: none\n\n### P1\n\n- problem: MAPPING_BENCHMARK_BLOCKED_BY_APPROVAL_BOUNDARY\n- evidence: "MAPPING_BENCHMARK_BLOCKED_BY_APPROVAL_BOUNDARY"\n- minimal change: Human approval of valid canonical fixtures.\n- expected benefit: Enable read-only mapping benchmark.\n- architecture impact: none\n\n### P2\n\n- problem: Review semantic/fact quality findings.\n- evidence: {"semantic":{"cases":36,"pass":6,"fail":30,"negative_false_positive":0,"reference_contamination":0,"schema_invalid":4},"fact":{"provider_cases":24,"final_valid_grounded":0,"first_pass":0,"retry_recovered":0,"human_escalation":24,"hallucination":0,"authority_contamination":0,"provenance_failure":0,"boundary_blocked":8}}\n- minimal change: Adjudicate offline artifacts before any tuning.\n- expected benefit: Separate model quality from authority/runtime issues.\n- architecture impact: none

## GIT

- commit: NO
- push: NO
- deploy: NO
- dirty worktree preserved: YES
- tender benchmark preserved: YES

## FINAL STATUS

V43_OVERNIGHT_BENCHMARK_COMPLETE_WITH_BLOCKER
