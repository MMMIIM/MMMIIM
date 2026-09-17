# V43_RAG_RETRIEVAL_P1G_ORPHANED_SEMANTIC_RERANK_AUTHORITY_CONTAINMENT_CHECKPOINT_V1

Status: **PASS / GATE A**
Mode: **PRODUCTION-CONTRACT CLOSURE / FAIL-CLOSED ENGINEERING**

## Starting authority and scope

| Field | Value |
|---|---|
| Repository | `MMMIIM/MMMIIM` |
| Branch | `feat/v4.3-semantic-boundary-routing` |
| Starting HEAD | `b5bb1aedbda87105973cf35a48f3c859358cbeb8` |
| Durable baseline | `b5bb1aedbda87105973cf35a48f3c859358cbeb8` |
| Tracked baseline parity | `PASS` |
| Scope | Caller semantic-authority containment only |
| Production vector / candidateK / finalK | unchanged / 20 / 8 |
| External/raw/archive untracked artifacts | local-only and not staged |

The current tracked HEAD is exactly the accepted durable engineering baseline.
The repository has unrelated untracked external/raw/archive artifacts; none
were modified or staged.

## Affected production path

- HTTP route: `POST /api/requirements/:requirementId/enterprise-retrieval`
- Owner: `EnterpriseRetrievalService.retrieve`
- Readback: `EnterpriseRetrievalService.get`
- Existing reranker: `backend/src/pipeline/semantic-retrieval-reranker.js`
- Existing contract: `4.3-production-retrieval-v1`
- Existing rerank version: `4.3-role-need-rerank-v1`

## Before / after authority behavior

Before P1G, `input.semantic_metadata` was passed to both
`createRetrievalRun` and `rerankProductionCandidates`. A caller could therefore
provide apparently approved role/need/candidate metadata and potentially change
Production ordering through the stranded semantic contract.

After P1G:

```text
Canonical Requirement
  -> dense retrieval, candidateK=20
  -> existing Production Hygiene
  -> empty Backend-owned semantic contract
  -> deterministic raw-vector fallback
  -> final Top8
```

The compatibility field `semantic_metadata` remains accepted by the service,
but it is ignored, is not persisted as caller authority, and cannot reach the
ranking input. The service exposes:

```text
SEMANTIC_RERANK_ACTIVATED = FALSE
RERANK_MODE = RAW_VECTOR_FALLBACK
RERANK_FALLBACK_REASON = BACKEND_SEMANTIC_CONTRACT_UNAVAILABLE
CALLER_SEMANTIC_METADATA_EFFECT_ON_RANKING = ZERO
```

The old reranker file and ranking algorithm were not deleted or modified. It is
now documented by this checkpoint as:

```text
CONTRACT_STRANDED
NOT_PRODUCTION_AUTHORITY
NOT_ACTIVE_WITH_CALLER_METADATA
```

The pure reranker tests remain as compatibility coverage for the dormant
component; they are not evidence that the old semantic contract is Production
authority.

## Deterministic containment tests

The P1G service regression used the same Canonical Requirement, fixture vector
path, raw candidate IDs/ranks, and Hygiene logic across four inputs:

1. no `semantic_metadata`;
2. apparently valid approved role/need/candidate metadata;
3. conflicting approved roles and needs;
4. unknown/incomplete metadata.

All four produced identical Hygiene survivors, persisted final ordering, and
fallback status. The run creation packet received `{}` for semantic metadata in
all four cases.

```text
CALLER_METADATA_RANKING_INVARIANCE = PASS
CALLER_METADATA_AUTHORITY_ESCAPE = 0
PRODUCTION_FALLBACK_DETERMINISM = PASS
```

## Production / Eval parity

The two Production-shaped E2E runners no longer pass caller semantic metadata:

- `backend/eval/production-retrieval-e2e/run-production-e2e.js`
- `backend/eval/production-retrieval-e2e/run-material-completion-e2e.js`

They now represent the current Production baseline as dense retrieval →
Production Hygiene → raw-vector fallback → Top8. The historical P1D diagnostic
artifacts are unchanged and remain historical evidence of the former reachability
gap; they are not rewritten.

The direct `production-retrieval-contract-v1` and semantic reranker unit tests
remain frozen component-contract tests. They do not grant caller metadata
authority to the Production service.

## Verification

| Verification | Result |
|---|---:|
| `node --check` on both updated Production-shaped E2E runners | PASS |
| P1G/service + related retrieval tests | 26 passed / 0 failed |
| `git diff --check` on implementation/test changes | PASS |
| Old reranker SHA changed | NO |
| Missing historical retrieval-baseline fixtures | known existing test debt; not part of P1G acceptance |

The broader selected retrieval-baseline test batch still has seven pre-existing
`ENOENT` failures because the tracked repository does not contain its historical
`eval/corpus/representative-sme` and `eval/retrieval-baseline` fixtures. No P1G
file caused those failures, and unrelated test debt was not repaired.

## Safety and architecture invariants

```text
PRODUCTION_RETRIEVAL_CHANGED = TRUE (authority containment only)
VECTOR_SIMILARITY_CHANGED = FALSE
CANDIDATE_K_CHANGED = FALSE
FINAL_K_CHANGED = FALSE
HYGIENE_CHANGED = FALSE
OLD_RERANKER_ALGORITHM_CHANGED = FALSE
GOLD_MUTATED = FALSE
CORPUS_MUTATED = FALSE
EMBEDDING_CHANGED = FALSE
FACT_CHANGED = FALSE
MAPPING_CHANGED = FALSE
CLAIM_CHANGED = FALSE
WRITER_CHANGED = FALSE
PROVIDER_CALLS = 0
EMBEDDING_CALLS = 0 (fixture embeddings only; no provider call)
LLM_CALLS = 0
DB_WRITES = 0
PUSH = 0
MERGE = 0
DEPLOY = 0
```

No migration or new database schema was required. No Gold, source lineage,
authority, Requirement, Router, Fact, Mapping, Claim, or Writer contract was
changed.

## Gate and next review

**GATE A — ORPHANED_RERANK_AUTHORITY_CONTAINED**

Caller metadata can no longer activate or influence Production semantic
reranking, the raw-vector fallback is explicit and deterministic, and the
regression suite passes. This does **not** promote Retrieval quality to
Production-ready and does **not** authorize P2, P3, P4, a new reranker, or any
other retrieval optimization.

Local commit SHA is reported after the exact P1G allowlist commit. No network
push is authorized.
