# V43 RAG / Fact Development Archaeology

**Run:** `V43_RAG_AND_FACT_PRODUCTION_READINESS_AUDIT_V1`  
**Branch:** `feat/v4.3-semantic-boundary-routing`  
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`  
**Mode:** local dirty-worktree authority; no Git history mutation.

## Stage timeline

| Stage | What was added | What was tested | Not tested / remained open | Current status |
|---|---|---|---|---|
| Stage 17 Retrieval | Material → chunk → embedding → pgvector Retrieval, source-span hygiene and source-role gates | Offline/integration and bounded live Retrieval; historical checkpoint records 40-case hygiene and 7-case live Retrieval | Complete evidence-bearing Gold and current 24-case replay were not rerun in this audit | PASS/FROZEN historically; current revalidation pending |
| Stage 20 Evidence / Fact | Evidence span/context recovery, EvidenceSupportAssessment boundary, Evidence Review → Fact lifecycle | Offline calibration, PostgreSQL lifecycle/lineage/atomicity and gateway contract tests | Live semantic Fact quality and full corpus Fact inventory remain unproven | PARTIAL/BLOCKED |
| Stage 21-A runtime connectivity | Health/readiness checks and standalone Semantic Gateway path | Gateway `/info`, SOCKS/embedding smoke and restart monitoring | Does not certify Fact semantic quality | PASS/FROZEN prerequisite |
| Standalone Semantic Gateway | Versioned task registry, strict schema/envelope validation, OpenAI-compatible adapter, technical error classes | Gateway/provider adapter/task-router contract tests and prior canaries | Current 92-material Fact outputs remain contract-failing | IMPLEMENTED; semantic quality unproven |
| Material authority/quarantine | Central Material Authority SQL predicate, lifecycle/review/usage/extraction checks, quarantine propagation | Track-A negative controls and retrieval hygiene tests | Historical retrieval rows remain auditable; all reload surfaces are not equivalent | ENFORCED on current new retrieval; historical residue retained |
| Canonical Evidence Review / Fact | Source span identity, review gate, `EvidenceSourceFactService`, canonical `evidence_source_facts` persistence | Contract, grounding, atomicity, currentness and PostgreSQL tests | Real enterprise Fact authority and provider fidelity are not established | IMPLEMENTED; not certified |
| Source-first / Fact producer work | Deterministic grounding/lineage/identity; Gateway-backed `evidence_fact_extraction` | Offline 140-call audit, canaries and Eval DB run | 91/92 material runs failed; targeted recovery not yet certified | BLOCKED by semantic/transport failures |
| Current Chengchuan run | 92 synthetic Eval materials, 676 chunks, 92 Eval embeddings, 185 retrieval audits, 92 review rows | Controlled extraction run; production DB unchanged | Full inventory and quality gates are incomplete | PARTIAL_WITH_FAILURES |

## Evidence and safety

- Production DB was queried read-only (56 materials, 561 chunks, 625 vectors,
  17 retrieval runs, 129 results, 0 canonical `evidence_source_facts`).
- Eval DB contains 92 materials, 676 chunks, 92 `eval-placeholder` vectors,
  185 retrieval runs/results, 92 controlled reviews and 5 approved Eval facts.
- Existing provider/audit artifacts are synthetic-only and requirement-blind;
  Requirement baseline `SIX_TENDER_CANONICAL_1009` was not injected into Fact
  extraction.
- No Provider call, Production DB write, Gold mutation, Mapping, Claim or Writer
  action was performed while producing this archaeology artifact.

## Open gates

1. Current Retrieval currentness verification needs an executable 24-case
   expected-source packet; historical metrics cannot be relabeled as current.
2. The 140-call Fact run has a systematic output-contract failure and missing
   upstream-provider status diagnostics; targeted 12-material recovery is
   required before any 92-material resume.
3. The five existing U20 facts share one source span and require granularity /
   duplicate review; they are not evidence of broad corpus coverage.

**Gate:** `RAG_FACT_ARCHAEOLOGY_COMPLETE_WITH_OPEN_GATES`
