# Requirement Evidence Mapping Eval V1

This evaluation is a read-only quality and safety harness for the Mapping
Producer. It reuses the single human-authored Gold authority at
`backend/eval/requirement-evidence-mapping-v1/gold-cases.json` and the
production projection, decision-policy, semantic-contract, Claim Gate, and
Writer authorization functions. Production code never imports this directory.

## Gates

The default `MAPPING_FAST_GATE` is offline and covers Gold integrity, transport
validation, projection/policy behavior, alias integrity, deterministic batch
splitting, and downstream authority-safety controls. Its semantic model
quality is always `NOT_MEASURED`.

`MAPPING_DB_GATE` is opt-in and invokes the existing PostgreSQL test command;
unavailable PostgreSQL is reported as `NOT_VERIFIED`, never as a pass.
`MAPPING_SEMANTIC_GATE` is opt-in live mode and must receive the production
`SemanticGatewayMappingEvaluator`; no Prompt or Schema is copied here.
Release remains blocked until every required gate is explicitly verified.

## Run

```text
npm run eval:mapping -w backend
```

This writes a JSON and Markdown artifact under `results/` with a unique run
identity, Gold hash, gate statuses, taxonomy, side-effect counts, and Git
identity. The artifact contains no credentials. Use `--mode db`, `--mode live`,
or `--mode release` only with explicit authorization for those operations.

Failure taxonomy distinguishes authority escalation, false support/full,
conflicts, dimension confusion, schema/alias failures, incomplete output, and
Writer/Claim bypasses. Structural/policy metrics are diagnostics and must not
be presented as semantic model quality.
