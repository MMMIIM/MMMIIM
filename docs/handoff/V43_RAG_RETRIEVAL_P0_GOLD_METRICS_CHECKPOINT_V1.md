# V43_RAG_RETRIEVAL_P0_GOLD_METRICS_CHECKPOINT_V1

Status: `PROVISIONAL_BLOCKED_HOLDOUT_REPLAY_PENDING`

## Decision boundary

P0 is approved and executed with the requested corrections. P1, P2, P3 and
P4 were not started. Production Retrieval code, the frozen vector snapshot,
production database, Fact/Mapping/Claim state and the existing Gold artifacts
were not modified.

## Gold and split

`GPT_SEMANTIC_GOLD_V1` is frozen with:

- authority: `DEVELOPMENT_EVAL_ONLY`
- total cases: 10
- calibration: 3 — the three user-specified known cases only
- untouched holdout: 7
- distribution: `POSITIVE=1`, `PARTIAL=6`, `NEGATIVE=1`, `CORPUS_GAP=2`
- Codex-created semantic labels: false
- Human confirmation: optional, not a P0 development blocker

Gold was created from the frozen Requirement/query pool and the complete allowed
Evidence Candidate corpus. Retrieval output, similarity, rerank score and
historical pass/fail were not used in Gold creation.

## Frozen baseline

`EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D`

- 9 materials / 94 chunks
- `Qwen/Qwen3-Embedding-0.6B`, 1024 dimensions
- snapshot SHA256: `5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578`
- manifest identity hash: `ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8`
- baseline remained immutable

The snapshot contains only 3 query vectors. Therefore the 3-case calibration
replay ran at K=1/3/5/8/20; all 7 holdout cases are explicitly
`NOT_EXECUTED`. No Provider call was made to fill the gap.

## Calibration baseline metrics

| K | Evidence Atom Recall | Candidate Precision | MRR | nDCG | FP Candidate Rate | K0 P/R |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 0.0000 | 0.0000 | 0.2625 | 0.0000 | 0.0000 | NOT_EVALUATED |
| 3 | 0.5000 | 0.1111 | 0.2625 | 0.1290 | 0.3333 | NOT_EVALUATED |
| 5 | 0.5000 | 0.0667 | 0.2625 | 0.1290 | 0.3333 | NOT_EVALUATED |
| 8 | 0.5000 | 0.0417 | 0.2625 | 0.1290 | 0.3333 | NOT_EVALUATED |
| 20 | 0.5000 | 0.0333 | 0.2625 | 0.2914 | 0.3333 | NOT_EVALUATED |

These are calibration-only figures, not release metrics. Atom Recall and
Candidate Precision intentionally remain separate units; V1 emits no combined
F1. K0 Precision/Recall are not evaluated because the frozen baseline has no
candidate-sufficiency output and returns K candidates for the non-empty pool.

## Slice view at K=5

- PRODUCT_CAPABILITY: atom recall 1.0000, candidate precision 0.2000, MRR 0.5
- PERFORMANCE: atom recall 0, candidate precision 0, MRR 0.025
- QUALIFICATION: no matchable evidence atom, candidate precision 0, MRR N/A

The mechanical first-failure families are one metadata/header false-evidence
case, one corpus-gap/negative no-acceptable-evidence case, and one
wrong-material or retrieval-miss case.

## Safety and reproducibility

- lineage complete: 94/94
- source-role escape: 0
- reference-only escape: 0
- quarantine escape: 0
- cross-enterprise / cross-scope escape: 0
- production DB / Eval DB writes: 0 / 0
- Provider / LLM calls: 0 / 0
- Production Retrieval changes: 0
- migrations: 0
- Gold mutations after freeze: 0
- second replay hash matched first replay hash

## NEXT_INTERVENTION_RECOMMENDATION

`NO_CHANGE_YET`

The holdout is frozen but cannot be replayed from the immutable snapshot. The
calibration results are useful failure evidence, but are insufficient to choose
P1 Structure, P2 Parent/Child, P3 Profile/Lexical, or P4 K0. Stop here and
return to GPT for authorization of the next bounded action, including any
separate authorization needed to create holdout query vectors.
