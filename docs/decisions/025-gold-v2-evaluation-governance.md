# ADR-025: V4.3 Gold V2 Evaluation Governance Architecture

**Status:** Accepted  
**Date:** 2026-09-03  
**Scope:** Evaluation governance only; no production behavior change

## Decision

V4.3 Gold V2 uses explicit namespaces and provenance boundaries:

1. `REAL_DERIVED_GOLD` contains adjudicable cases derived from resolvable real
   public or otherwise authorized source material. Requirement text, enterprise
   facts, and source spans retain their source references and hashes.
2. `SYNTHETIC_BOUNDARY_GOLD` contains representative synthetic cases used to
   exercise safety boundaries. Synthetic content is never presented as a real
   customer fact and is not mixed into the real-source packet.
3. `ENGINEERING_FIXTURE` contains deterministic persistence, transport, and
   entry-point regressions. It is reported separately from semantic-quality
   denominators.

The Human reviewer is the final Gold authority. A model or provider may
produce a candidate only; it cannot approve a Gold label. Codex acts as Gold
engineer and preserves the immutable source and adjudication artifacts.

Old Gold files are immutable. Disputed or unresolvable cases remain
unscored, with the reason retained. Production behavior is evaluated with a
zero-diff expectation: this ADR and source-packet artifacts must not change
Requirement, Evidence Fact, Mapping, Claim, Writer, Retrieval, prompts,
schemas, migrations, configuration, or production database state.

Where a semantic case is evaluated through more than one implementation, the
same frozen input and the same output contract are used. Mutation-sensitive
boundaries and negative controls are first-class evidence. Semantic-quality
denominators are kept separate from engineering and provider-fidelity
denominators.

## Writer acceptance baseline at Gold V2 adoption

The Writer authorization remediation engineering checkpoint is recorded as:

```text
WRITER_AUTHORIZATION_REMEDIATION = ACCEPTED
P1_001 = CLOSED
P1_002 = CLOSED
WRITER_ENGINEERING_FULL_CHAIN_BLOCKERS = 0
WRITER_PROVIDER_FIDELITY_READINESS = READY_FOR_EVAL_DEVELOPMENT
WRITER_PROVIDER_FIDELITY_PASS = NOT_ESTABLISHED
WRITER_PRODUCTION_READY = NOT_CLAIMED
```

The following cases are deliberately engineering regressions, not Writer
semantic Gold:

```text
W-AUTH-RETENTION-001 = DETERMINISTIC_REGRESSION
W-IDEMPOTENCY-AUTH-001 = ENGINEERING / POSTGRESQL_REGRESSION
```

They verify authorization persistence/reconstruction and generation-identity
idempotency. Their execution in Writer-related suites must not increase the
Writer semantic-quality Gold denominator. Writer Provider Fidelity Gold
remains `NOT_ESTABLISHED`.

## Mapping real-source packet

The blind source packet is recorded at:

* `backend/eval/gold-human-review/v2/00_gold_v2_source_manifest.md`
* `backend/eval/gold-human-review/v2/01_mapping_real_source_packet.md`
* `backend/eval/gold-human-review/v2/01_mapping_real_source_packet.json`

The packet contains source-backed Requirement and Enterprise Evidence Fact
projections only. It contains no expected decisions, provider/model results,
historical pass/fail labels, or production Mapping outputs. Candidates are
identified with stable neutral IDs and are adjudicated in a separate review
submission.

## Consequences and controls

* Source authority and evidence sufficiency remain independent dimensions.
* A source excerpt or material role cannot create an Evidence Fact, Claim
  permission, or Writer authorization automatically.
* Missing, ambiguous, stale, cross-project, or synthetic-only provenance is
  excluded from the primary real-source packet and listed with a reason.
* The packet is deterministic: no generated timestamps, random IDs, absolute
  paths, database-order dependence, or provider calls.
* Integrity checks must verify unique IDs, resolvable source references and
  hashes, absence of forbidden answer/result fields, no synthetic-only or
  cross-project leakage, deterministic serialization, and unchanged legacy
  Gold hashes.

## Explicit non-decisions

This ADR does not authorize or implement Provider evaluation, Mapping/Claim/
Writer changes, RAG or Retrieval changes, new prompts or schemas, migrations,
or any production data mutation.
