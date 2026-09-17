# V43 Minimal Production-Shaped Flow Implementation Plan

This is a plan only. It is not an implementation authorization. It intentionally
reuses current domain services and deterministic projections; it does not alter
the frozen semantic contracts.

## P0 — wire one safe end-to-end orchestration

### P0.1 Response Router service adapter

- **Likely files:** new `backend/src/pipeline/response-router-service.js`; wiring
  in `backend/src/server.js` and `backend/src/app.js`; frontend API read method
  in `frontend/src/api.js`.
- **Reason:** `requirement-response-router-v2-1.js` is currently an isolated
  read-only projection with no production caller.
- **Reuse:** `projectRequirementResponseV21`, existing canonical requirement
  repository reads, existing ResponsePlan/Claim services.
- **New code:** thin orchestration/read-model adapter only; expose requirement
  ID, response mode, risk tier, dependencies, next action and route reason.
- **Scope:** project/requirement read/projection first; no new authority table,
  no provider call, no automatic approval, no semantic rule rewrite.
- **Tests:** production HTTP entry-point test; project/tender/version identity;
  deterministic repeatability; unknown/ambiguous fallback; no writes.
- **Authority impact:** none if output remains a projection and downstream
  calls existing services.

### P0.2 Safe Response Packet builder/adapter

- **Likely files:** new `backend/src/pipeline/safe-response-packet-builder.js`;
  wiring in `server.js`, `app.js`, and the document-generation entry adapter.
- **Reason:** target Writer input boundary is missing; current generation reads
  older snapshots directly.
- **Reuse:** Writer Authorization/Safe Context,
  `writer-authorization-snapshot.js`, Claim Gate evaluations, Project Fact
  control, reference selector and document plan builders.
- **New code:** deterministic packet projection with the frozen fields:
  `requirement_id`, `response_mode`, `risk_tier`, `must_cover`, project/reference
  context, allowed assertions, allowed commitments, forbidden assertions,
  citation requirements, human decisions, packet hash.
- **Scope:** projection/orchestration only. Packet must not approve Claims,
  Facts, Mappings or Project Decisions, and must fail closed if required
  upstream authorization is absent.
- **Tests:** packet identity/hash stability; approved-only enterprise
  assertions; Reference Context remains non-enterprise; project commitment
  remains project-scoped; missing packet inputs fail closed; Writer entry-point
  consumes packet identity.
- **Authority impact:** P0 boundary; downstream must not expand packet
  authority.

### P0.3 Final requirement reconciliation adapter

- **Likely files:** new thin projection around `coverage-validator.js` and
  `document-validator.js`; route wiring in `app.js`; persistence may reuse
  existing version snapshots before any schema proposal.
- **Reason:** current coverage/risk results exist, but no final artifact joins
  all requirements, findings, unresolved decisions and finalized version.
- **Reuse:** `CoverageValidator`, document validation output,
  `ReviewCenterService`, document version snapshots and existing audit records.
- **New code:** read-only reconciliation projection with explicit requirement,
  source, claim, packet, validation and version identities.
- **Scope:** no new semantic decision; findings remain fail-closed and human
  actionable.
- **Tests:** complete/partial/unresolved coverage; critical finding blocks
  confirmation; stable snapshot/version identity; no authority creation.
- **Authority impact:** none; this is a final review projection.

## P1 — connect the user workflow

### P1.1 Gate A project task projection

- **Likely files:** additive backend read-model adapter and `frontend/src/main.jsx`
  or a small new component; reuse `ReviewCenterService`, Evidence Readiness,
  Project Fact controls and Claim decisions.
- **Reason:** users currently move among several domain screens without one
  project-scoped decision queue.
- **New code:** links/status projection only; existing approve/reject/edit
  actions remain the only writes.
- **Tests:** navigation and action links preserve project/requirement IDs;
  no client-provided authority bypass.

### P1.2 Compliance Matrix projection

- **Likely files:** new read-only projection module and `frontend/src/api.js`
  plus the existing review/check page.
- **Reuse:** requirement source status, document validator, risk review and
  source lineage.
- **Scope:** deterministic checklist/read model; no second compliance engine,
  no LLM auto-pass for P0.
- **Tests:** P0/mandatory/format/deadline cases fail closed and show source
  identity; Human confirmation remains explicit.

### P1.3 Bid Pilot final review input

- **Likely files:** `backend/src/pipeline/bid-copilot-orchestrator.js`,
  `AgentContextResolver`, `frontend/src/bid-copilot.jsx`.
- **Reuse:** existing read-only context, action preview, audit and explicit
  human-confirm execution path.
- **New code:** consume the reconciliation projection; do not let Copilot
  approve or write domain authority directly.
- **Tests:** read-only preview, cross-project rejection, explicit approval for
  any mutation, action audit linkage.

## P2 — after the first real E2E

- Add cross-edge correlation/audit identity and retry/idempotency regression.
- Add one deterministic HTTP E2E covering all four lanes with synthetic data.
- Add runtime availability diagnostics for backend/PostgreSQL/gateway before
  live verification.
- Measure UI task completion/rework only after the flow is wired.

## Explicit non-goals

Do not change frozen Requirement, Retrieval, Evidence, Fact, Mapping, Claim,
Writer, Provider, Prompt, Schema or authority semantics. Do not add a second
Fact/Mapping/Compliance/Writer system. Do not make Bid Pilot or an LLM an
authority owner. Do not start live Provider evaluation as part of the glue
implementation.

