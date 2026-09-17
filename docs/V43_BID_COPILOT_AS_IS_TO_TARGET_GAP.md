# V43 Bid Copilot Wave 1 — AS-IS to Target Gap

## Scope
Offline response projection only; no production cutover.

## AS-IS
- Canonical Requirements, source refs, categories, mandatory flags, confirmation flags and risk flags already exist.
- Existing Fact, Mapping, Claim and Writer authority services remain unchanged.
- Existing read models do not expose a persisted response projection or Compliance Matrix response decision.

## Reuse
- Canonical Requirement artifacts and source lineage.
- Existing authority-bearing services and safety contracts; this wave only derives a read projection.

## Wave 1 addition
- Deterministic runtime/Eval requirement-response-router.js.
- Eval-only per-cohort projection artifacts and a blind GPT calibration packet.
- Compliance Matrix DTO serializer with explicit NOT_EVALUATED downstream fields.

## Deferred
- Production routing, schema/migration changes, Fact/Mapping/Claim/Writer changes, human approval UI, and provider evaluation.
