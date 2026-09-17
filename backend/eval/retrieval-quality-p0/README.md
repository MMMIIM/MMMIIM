# V43 Retrieval Quality P0

This directory contains the Evidence Retrieval P0 semantic Gold and the
read-only frozen baseline replay. It is Eval-only and does not modify the
Production Retrieval path, production database, Evidence/Fact/Mapping/Claim
state, or the frozen vector snapshot.

## Authority and blindness

`GPT_SEMANTIC_GOLD_V1.json` is frozen with `authority=DEVELOPMENT_EVAL_ONLY`.
Gold cases were created from the frozen Requirement/query rows and the complete
allowed Evidence Candidate corpus. The three known cases are calibration only;
the seven holdout cases were selected without retrieval output, similarity,
rerank score, or historical pass/fail data.

Codex performs only artifact, source, hash, offset, lineage, deterministic join,
replay, and metric calculations. It does not infer semantic labels from Top-K.

## Replay

```text
node backend/eval/retrieval-quality-p0/run-p0-baseline.mjs
```

The replay uses `EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D` as a read-only
input. That snapshot contains three query vectors, so the calibration replay is
executed and the seven untouched holdout cases are recorded as
`NOT_EXECUTED` until a separately authorized query-vector artifact exists.

## Metric rules

- Evidence Atom Recall@K uses retrievable, explicitly acceptable Gold atoms.
- Candidate Precision@K counts candidates with common evidence-item grade >= 2.
- MRR uses the first candidate with grade >= 2.
- nDCG@K uses common evidence-item grades 3/2/1/0.
- Atom Recall and Candidate Precision are different units; no cross-unit F1 is
  emitted.
- K0 Precision/Recall are `NOT_EVALUATED` for this baseline because the frozen
  path has no candidate-sufficiency output and returns K candidates for this
  non-empty corpus.
