# V4.3 Gold V2 Foundation and Writer Eval Preparation

## Status

Approved design. This specification is the implementation boundary for the
approved reuse-first design. It does not authorize Provider calls, production
database writes, Gold promotion, or production semantic changes.

## Objective

Prepare three independent, auditable foundations without changing frozen
Requirement, Retrieval, Evidence Fact, Mapping, Claim, or Writer production
contracts:

1. a real Requirement source foundation across the six named tenders;
2. a candidate-only Real Enterprise Fact V2 source/Fact inventory; and
3. a Provider-off Writer deterministic evaluation foundation.

Architecture, Fact capability, and Bid Pilot work are read-only materialization
reports, not new authority-bearing capabilities.

## Invariants and exclusions

- The local worktree is authoritative; pre-existing dirty files are preserved.
- No Provider, Dify, Embedding, LLM, or external network calls.
- No production database writes and no mutation of active Requirement, Mapping,
  Claim, Writer, or Real Gold data.
- No new migration and no production service changes.
- Synthetic, representative, public, and private material classifications are
  explicit and never mixed into Real Gold counts.
- Downstream artifacts only project authority already established upstream;
  they may not approve, expand scope, or turn a candidate into a Fact, Claim,
  or Writer permission.

## Track 1 — Requirement Real Source Foundation

Reuse `build-real-gold-source-foundation.js` and its census, packet index,
source SHA validation, span index, and deterministic Markdown/JSON renderer.
The only orchestration layer selects `JY-001`, `TB-003`, `TB-006`, `FAST-01`,
`FAST-04`, and `FAST-WATER-01`, then emits a per-tender status:

- `A_AUTHORITATIVE_PACKET_RECOVERED` when the packet, raw source, declared
  hash, official source, and source audit all satisfy the existing contract;
- `B_HUMAN_RECONSTRUCTION_POSSIBLE` when deterministic source identity exists
  but a complete authoritative packet is not present (blind review only);
- `C_REEXTRACTION_REQUIRED` when the source is present but cannot be evaluated
  without a new extraction run; and
- `D_SOURCE_INSUFFICIENT_OR_BLOCKED` when the source cannot support a safe
  reconstruction.

No historical Eval artifact is promoted to an authoritative packet. C/D items
remain blocked; no automatic re-extraction is started. A blind reconstruction
packet, if required, contains source identity and excerpts only and waits for
human authority.

Outputs:

- `07_real_requirement_source_universe_v2.json/.md` (or the existing builder's
  equivalent, regenerated deterministically from current inputs);
- a six-tender reconciliation report with the A/B/C/D classification; and
- a checkpoint recording packet/source SHA parity and the blocked tenders.

## Track 2 — Real Enterprise Fact V2 Candidate Foundation

Reuse `real-enterprise-source-import-harness.js`, Material Authority Gate and
the existing material chunking/source-lineage conventions. The orchestration
layer is metadata-only and admits a source candidate only if all conditions
hold:

- non-synthetic and non-quarantined;
- enterprise identity resolved;
- authority eligible under the single Material Authority Gate;
- provenance resolvable to a stable source snapshot/SHA; and
- no Requirement-derived, reference-context, or masquerading industry source.

Each admitted source record contains:

`source_id`, `enterprise_identity`, `source_type`, `source_location`,
`snapshot`, `sha256`, `version_or_date`, `currentness`, `material_lifecycle`,
`authority_eligible`, `synthetic`, and `quarantined`.

The formal Fact projection is candidate-only and records `fact_text`, subject/
entities, status, quantity, scope, validity/currentness, `source_id`,
`source_span`, `source_sha256`, and conflict state. It never writes canonical
Facts or Real Gold. The blind packet contains no expected answer, Provider
output, or production result. If no source meets every condition,
`REAL_FACT_V2_ELIGIBLE_CANDIDATES=0` is the correct result.

Outputs:

- `REAL_FACT_V2_CANDIDATE_MANIFEST` JSON/Markdown;
- `REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET` JSON/Markdown; and
- a source eligibility/rejection audit, including CORPUS_GAP rows.

## Track 3 — Writer Provider-Off Foundation

Reuse `writer-fast-gate-v1.js`, Writer Authorization/Safe Context projections,
Sanitizer, Validator, and Critical Assertion Guard. Freeze a deterministic
input snapshot containing Requirement, Fact, Mapping, Claim, authorization,
reference/project-fact projections, and provider/model identity as metadata
only. Run no provider.

The suite must separately report semantic/safety cases and engineering
regression cases. It covers requirement coverage, unsupported enterprise
assertions, Claim escalation, numeric/entity/status/scope mutation, SLA,
certification, customer-case and unsupported-commitment fabrication,
cross-section contradiction, authorization provenance, sanitizer, validator,
and Critical Assertion Guard.

Mutation cases include an authorized `支持高并发处理` assertion mutated to an
unsupported `不少于10万并发用户` assertion, plus quantity, entity, status,
scope, SLA, certification, customer-case, unsupported-commitment, and
authorization-source mutations. All must fail closed without a new authorized
Claim.

`W-AUTH-RETENTION-001` and `W-IDEMPOTENCY-AUTH-001` remain engineering/
PostgreSQL regressions and are excluded from the semantic Gold denominator.
The result can be `WRITER_EVAL_PROVIDER_OFF_FOUNDATION=READY/PASS` only; it
cannot establish Provider Fidelity or Production Ready.

### Source Role Boundary Eval

The Writer foundation adds six deterministic/fixture-only cases to verify the
existing Source Role and authorization boundary. This is not a new classifier
or a new production service. Cases reuse Material Authority, Writer
Authorization, Safe Context, `assertable_claims`, `reference_materials`, and
the existing mutation framework:

- `ENTERPRISE_EVIDENCE_ASSERTABLE_PASS`: an authority-approved enterprise Fact
  projected as an authorized Claim may be asserted;
- `REFERENCE_SOLUTION_DESIGN_PASS`: Reference Context may inform solution
  design, methods, architecture, and background without becoming enterprise
  fact;
- `REFERENCE_TO_ENTERPRISE_ASSERTION_FAIL`: reference text rewritten as an
  “our company/product supports” assertion is blocked;
- `FOREIGN_ENTERPRISE_IDENTITY_CONTAMINATION_FAIL`: another enterprise's
  material rewritten as the bidder's capability is blocked;
- `REFERENCE_STRONG_FACT_PROMOTION_FAIL`: reference performance, SLA,
  certification, or customer-case facts cannot be promoted to bidder facts;
- `MIXED_ASSERTABLE_REFERENCE_BOUNDARY`: reference may enrich design, while
  enterprise assertions must come only from authorized Claims.

The report includes `SOURCE_ROLE_BOUNDARY_EVAL`,
`REFERENCE_SOLUTION_USAGE_PASS`,
`REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE`, and
`FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE`. Source Role decisions are
inputs projected by the owning services; Writer does not re-decide them. These
cases remain outside semantic Gold promotion and are reported separately from
engineering regressions.

Output:

- `V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md/.json` with case
  counts, mutation outcomes, authority provenance, and `provider_calls=0`.

## Parallel read-only materialization

### Architecture

Materialize an AS-IS/target matrix for Domain, Authority, Human Gate, Agent
Boundary, Provenance, and Runtime Enforcement. Every row cites an existing
path/test/checkpoint and marks whether the invariant is ENFORCED, PARTIAL,
BYPASS_FOUND, NOT_ENFORCED, or NOT_VERIFIED. Track A remains CLOSED; no
roadmap or CURRENT_STAGE update is implied.

### Fact capability reconciliation

Inventory Fact Human Edit, Review Workbench, Evidence Readiness,
`ProjectFactControlService`, Project Locked Fact, Enterprise Global Fact,
conflict/version/effective-time lifecycle, Human confirmation API, and Agent
projection. Each is classified only as `REUSE`, `MISSING`, `NEEDS_HARDENING`, or
`NOT_NEEDED`; no capability is implemented in this task.

### Bid Pilot

Only read-only projections, fixtures, and explanations are allowed. No HITL,
approval, override, or other authority-bearing write is exposed.

## Deterministic verification

Tests are Eval-only and deterministic. They verify source packet hash parity,
classification boundaries, real-source admission/rejection, blind-packet
non-contamination, Writer mutation fail-closed behavior, engineering-vs-
semantic denominator separation, zero Provider calls, zero production writes,
and no changes to frozen production files. Existing unrelated baseline failures
remain out of scope and are reported rather than repaired.

## Decision outputs

The final checkpoint reports actual artifact/test evidence for:

`REQUIREMENT_REAL_SOURCE_FOUNDATION`
`REAL_ENTERPRISE_FACT_V2_FOUNDATION`
`REAL_FACT_V2_ELIGIBLE_CANDIDATES`
`WRITER_EVAL_PROVIDER_OFF_FOUNDATION`
`ARCHITECTURE_MATERIALIZATION`
`FACT_CONTROL_RECONCILIATION`
`BID_PILOT_READ_ONLY_FOUNDATION`

and the gates:

`SAFE_TO_START_HUMAN_FACT_V2_REVIEW`
`SAFE_TO_FREEZE_REAL_FACT_V2`
`SAFE_TO_BUILD_MAPPING_GOLD_V2`
`SAFE_TO_RUN_WRITER_LIVE_EVAL`
`SAFE_TO_START_BID_PILOT_HITL`.

No gate is inferred from the design; each is derived from the produced
artifacts and test results. The task stops after this decision checkpoint.
