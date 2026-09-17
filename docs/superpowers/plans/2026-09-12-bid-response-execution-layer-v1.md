# V43 Bid Response Execution Layer V1 — Implementation Plan

## Goal

在不改 Requirement extraction/canonical contract、Provider、Gold 或数据库
schema 的前提下，把现有 Canonical Requirement 投影为可审查的
ResponseDecisionV1、Bid Response Matrix、runtime-only ResponseUnit，以及带
完整 requirement lineage 的 Safe Response Packet/Writer 输入。所有证据、承诺和
合规缺口保持 fail-closed。

## Current call graph (AS-IS)

```text
GET /api/projects/:projectId/requirements/:requirementId/response-decision
  -> ResponseRouterService.get
  -> projectRequirementResponseV21

GET /api/projects/:projectId/compliance-matrix
  -> FlowProjectionService.getCompliance
  -> projectRequirementResponseV21

POST /api/projects/:projectId/document-generations
  -> DocumentGenerationService.generate (writerV2)
  -> gate (currently legacy writer_eligible filter)
  -> V21 projection + SafeResponsePacketBuilder
  -> document-plan -> section context -> WriterExecutionService
```

## Target architecture

1. Add one canonical adapter around the existing V2.1 router. It maps the legacy
   internal `response_mode=NEED_REVIEW` to `decision_status=NEED_REVIEW,
   response_mode=null`, and derives read-model readiness without granting
   authority.
2. Reuse `ResponseRouterService`, `FlowProjectionService`, existing repository
   reads and project authorization. Add a project-scoped read-only
   `/bid-response-matrix` endpoint as a thin alias/read model.
3. Add deterministic runtime `ResponseUnitV1` grouping by target section,
   compatible mode and authority state. It never merges or mutates Requirements.
4. Extend Safe Response Packet only with response-unit and lineage metadata;
   preserve existing Claim/Project Fact authorization and reference-only boundary.
5. Replace formal Writer V2 eligibility filtering with the ResponseDecision plus
   downstream authority result. Retain `writer_eligible` only for legacy
   compatibility paths and display/eval fixtures.
6. Propagate backend-owned `covered_requirement_ids[]` through ResponseUnit,
   Writer task/output metadata and final reconciliation. No LLM-created IDs.
7. Add a small Matrix workspace/tab using existing navigation, API and styles.

## Files to modify/create

- `backend/src/pipeline/response-decision-v1.js` — canonical DTO adapter and
  readiness helper (new, no second semantic router).
- `backend/src/pipeline/response-router-service.js` — expose canonical decision
  projection while preserving legacy internal projection.
- `backend/src/pipeline/response-unit-v1.js` — runtime deterministic grouping
  (new).
- `backend/src/pipeline/flow-projection-service.js` — canonical Matrix rows,
  readiness, authority summaries and response-unit projection.
- `backend/src/app.js` — read-only Matrix route, reusing existing auth.
- `frontend/src/api.js` — Matrix read method.
- `frontend/src/main.jsx` — minimal Matrix tab/workspace and labels/filters.
- `frontend/src/styles.css` — only local Matrix table/badge styles if needed.
- `backend/src/pipeline/safe-response-packet-builder.js` — add response-unit and
  requirement lineage fields without changing authorization semantics.
- `backend/src/pipeline/writer-execution-contract-v1.js` and
  `backend/src/pipeline/document-generation-service.js` — lineage propagation
  and formal writer gating, only where tests prove the current path uses legacy
  eligibility.
- `backend/src/pipeline/document-plan.js` — accept backend-derived writer route
  flags for the formal V2 path; keep legacy compatibility fallback explicit.
- `backend/test/response-decision-v1.test.js`,
  `backend/test/response-unit-v1.test.js`,
  `backend/test/bid-response-matrix.test.js`,
  `backend/test/writer-response-lineage.test.js` — focused deterministic tests.
- `frontend/src/main.test.jsx` or the nearest existing frontend test file — Matrix
  render/filter smoke test if the repository test setup supports it.
- `docs/V43_BID_RESPONSE_EXECUTION_LAYER_V1_CHECKPOINT.md` and `.json` — final
  evidence/checkpoint.

No migration or new persistence is planned. If implementation requires one,
stop with `BLOCKED_NEW_PERSISTENCE_ARCHITECTURE_REQUIRED`.

## Interfaces

`ResponseDecisionV1`:

```text
requirement_id, decision_status, response_mode|null, response_required,
risk_tier, scoring_related, scoring_priority, evidence_dependency,
human_required, secondary_dependencies, routing_reasons, readiness_status
```

`BidResponseMatrixRowV1` contains requirement/source summary, content category,
decision, readiness, blocking reason codes, authority IDs/status summaries and
writer target when applicable. It is read-only and deterministic.

`ResponseUnitV1` contains `response_unit_id`, `section_key`, `response_mode`,
`requirement_ids[]`, `source_requirement_count`, and authority/readiness summary.

Safe packet additions are `response_unit_id`, `requirement_ids[]`,
`response_mode`, and backend lineage only; existing authorized assertions,
project commitments, references and forbidden boundaries remain authoritative.

## Test strategy (TDD)

For every change: add a failing deterministic test, run it, implement the minimum
generic fix, then run the focused test and relevant existing suite. Required cases
cover all four modes, NEED_REVIEW, response_required=false, scoring, evidence and
commitment authority absence, compliance non-Writer routing, grouping/tie-breaks,
reference boundary, safe packet lineage, writer output lineage, and reconciliation.

Run backend router/plan/claim/writer tests, frontend tests/build, lint and
`git diff --check`. PostgreSQL integration is read-only/skipped unless an isolated
test database is demonstrably configured. Classify unrelated failures as
`KNOWN_BASELINE_FAILURE`, not as task regressions.

## Compatibility strategy

Keep V1/V2/V2.1 router exports and legacy response fields for existing callers.
Canonical DTO is an additive projection. Keep `writer_eligible` in stored
Requirements and legacy planning paths, but formal Writer V2 must consume derived
ResponseDecision/downstream authority. Existing API paths remain backward
compatible; `/bid-response-matrix` is additive.

## Frontend UX

Add one “响应矩阵” workspace tab reusing project navigation and existing table,
badge and filter conventions. Columns: Requirement, Source, Content Type, Risk,
Response Mode, Needs Handling, Readiness. Filters: action required, P0/HIGH,
scoring, human required, evidence required, need review. Internal identifiers stay
in detail/progressive disclosure; no broad redesign.

## Risk analysis

- Authority leakage: evidence/commitment routes remain blocked without approved
  downstream authority; reference material never enters assertable claims.
- Legacy eligibility leakage: audit and tests must show zero direct use on the
  formal V2 writer path.
- Lineage loss: every unit/task/output carries backend-owned requirement IDs.
- Scale: one project-scoped read and deterministic in-memory projection; no N+1
  Provider/LLM calls.
- Compatibility: additive DTO/route and explicit legacy fallback tests.

## No-go boundaries

No Requirement semantic changes, Prompt/Schema/Provider changes, migrations,
new authority services, Gold mutation, semantic LLM calls, production DB writes,
new Agent/compliance subsystem, tender-specific rules, or destructive Git actions.

## Completion gates

Response decision coverage 100%; P0 compliance escape 0; high-risk evidence false
negative 0; future commitment as existing fact 0; direct legacy Writer eligibility
usage 0 on formal path; compliance-to-normal-Writer direct 0; no Writer output
without lineage; no enterprise assertion without authority lineage; frontend and
backend build/lint/diff-check pass; Provider/LLM/DB/Gold/Requirement mutations 0.

## Self-review before execution

### Bid quality

The matrix makes P0/compliance omissions visible, blocks unsupported Evidence and
Commitment, and preserves unresolved rows instead of manufacturing green output.

### Product usability

A bid professional can see what requires action, evidence, a project decision or
compliance handling, while inspecting source context from the same project scope.

### Engineering quality

The plan wraps the existing V2.1 router and authority services, adds no parallel
truth system, keeps runtime projections non-persistent, and makes lineage backend
owned and deterministic.

### Development cost

The scope is limited to additive adapters, one read model/route, one small UI tab,
runtime grouping and focused tests. No migration, Agent, provider call or broad UI
redesign is required.

### Scope decision

Proceed only with these bounded changes. If any gate requires changing upstream
Requirement semantics, four-mode taxonomy, authority, or persistence, stop at the
specified hard gate instead of widening scope.
