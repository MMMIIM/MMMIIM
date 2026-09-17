# Claim Eval V1

Claim Eval is evaluation-only. It imports the frozen production
`evaluateEnterpriseClaimV2` implementation. The Fast Gate never writes
Requirement, Evidence Fact, Mapping, Claim, Gate, or Writer state. The explicit
PostgreSQL DB Gate uses only ephemeral `REPRESENTATIVE_SYNTHETIC` fixture rows,
cleans them up by fixture project, and never mutates production truth.

The dataset is kept under `backend/eval/evidence-gold/` so Claim Eval does not
create a second Gold authority. The 24 cases are human-authored,
`REPRESENTATIVE_SYNTHETIC`, and contain no customer data. They cover:

- supported strong claims;
- supported narrow claims;
- enterprise fact versus project commitment;
- status, scope, entity and quantity overclaim;
- stale, lineage and mapping authorization boundaries;
- historical/reference-only evidence;
- composite conflict controls.

Run the provider-free Fast Gate with:

```text
npm run eval:claim -w backend
```

The artifact reports the three layers separately:

- `CLAIM_FAST_GATE`: safety, bid quality and deterministic authorization checks;
- `CLAIM_DB_GATE`: PostgreSQL identity, reconstruction and authorization checks
  when `--mode db` or `--mode release` is explicitly selected;
- `CLAIM_BID_QUALITY_BASELINE`: measured retention and false-hard-reject
  baseline (`CLAIM_BID_QUALITY` remains a read-only compatibility alias).

Fast Gate has `Provider=0`, `Embedding=0`, `Retrieval=0`, `DB writes=0`, no
retry and no fallback. DB Gate has no Provider/Embedding/Retrieval calls and
reports its synthetic fixture writes separately from production writes. A
production-readiness conclusion requires the DB Gate and affected global
regression; a Fast Gate result alone is not a release authorization. The
`release` report remains `NOT_READY` until an independently verified global
regression is supplied as `globalRegressionStatus: 'PASS'`; the runner never
assumes that a partial test run is a release gate.
