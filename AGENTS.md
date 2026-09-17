# Repository Instruction Router

This file is the project's stable instruction entry point. It keeps product
boundaries and source-of-truth routing only. Detailed checkpoint governance is
provided by the `engineering-governance` Skill; execution mechanics such as
TDD, debugging, planning, and general review remain with the applicable
development tools.

## Product identity

This repository builds a controllable, traceable, reviewable, editable, and
deliverable government and enterprise bid-writing workflow. It is not a text
generation-only product.

## Stable product boundaries

- AI and providers discover or draft uncertain content; the Backend Control
  Plane validates, authorizes, versions, audits, and finalizes business state.
- `Relevant` is not `Evidence`; `Evidence` is not `Fact`; `Fact` is not
  `Claim`; Mapping approval is not Claim permission; Requirement coverage is
  not Claim safety. Unknown remains unknown.
- `Material`, `Chunk`, `Evidence`, `Evidence Fact`, `Mapping`, `Claim`, and
  `Writer Authorization` are separate lifecycle objects. Generic or industry
  knowledge must not silently become enterprise capability or an approved
  claim.
- GENERAL, INDUSTRY, and ENTERPRISE_PRIVATE use one shared material and
  retrieval foundation. New corpus content enters Production Retrieval only
  after governance and evaluation activation.
- Core domain ownership remains here: Requirement, Evidence, Fact, Mapping,
  Claim Safety, Project Fact, Propagation, Readiness, review UX, and document
  delivery contracts.
- Provider/model choice is an adapter concern. No provider, model, prompt, or
  external service may bypass the Backend Control Plane or create formal
  business state directly.

## Source of truth

Read only the sources relevant to the current task:

1. `ARCHITECTURE.md` — product and runtime architecture.
2. `docs/CURRENT_STAGE.md` — current stage, authorization, and blockers.
3. `docs/ROADMAP.md` — sequencing only; roadmap items are not authorization.
4. `docs/EVAL_POLICY.md` — evaluation and evidence governance.
5. Relevant files under `docs/decisions/`, plus directly related code/tests.
6. `config/branch-policy.json` — authoritative branch and synchronization
   policy before any Git, runtime, deploy, or live operation.

Do not put mutable commit SHAs, schema hashes, runtime revisions, case counts,
or operational status in this router. Keep those facts in the current-stage,
audit, or runtime artifacts that own them.

## Governance routing

Classify a change by its highest-risk affected surface. GREEN ordinary work
skips governance; YELLOW and RED work use the `engineering-governance` Skill at
the checkpoints it defines. That Skill is scoped to Authority, Boundary,
Contract, Compatibility, Runtime, and Evidence; it does not broaden the task or
scan unrelated files.

## Branch and operational safety

- Read `config/branch-policy.json` before checkout, branch creation,
  synchronization, cherry-pick, merge, deploy, runtime restart, or live
  verification. Never infer a production branch from its name.
- Feature work may proceed only after Git lineage is proven against the policy
  authoritative branch. Historical branches are readable/auditable but are not
  production, live, or synchronization targets.
- Live, deploy, and production runtime restart require the exact policy
  authoritative branch. Feature-to-authoritative synchronization is ff-only;
  divergence stops without merge, rebase, cherry-pick, reset, or force-push.
- Preserve user changes. Never use destructive reset/checkout, force-push, or
  destructive database operations. Push, merge, deploy, and external calls
  require explicit authorization from the current task.

## Formal invariant entry-point rule

Owning-service tests alone do not prove a formal invariant. For every
safety/truth-critical mutation, evidence must cover:

```text
production entry point → owning service → canonical contract → persistence
```

The matrix dimensions are `SERVICE_TESTED`, `ENTRY_POINT_TESTED`,
`PERSISTENCE_TESTED`, and `NEGATIVE_CONTROL_PRESENT`; an invariant is
`ENFORCED` only when all required dimensions are present. Client-provided
reviewer/editor identity, route-to-repository writes that bypass an owning
service, compatibility contract weakening, and test/eval writes to production
truth are forbidden. When a bypass is found, fix the owning boundary, add the
real entry-point regression, update the matrix, and inspect sibling entry
points.

## GPT decision handoff

When a user message begins with `GPT DECISION` and contains stage-decision
fields, treat it as the current decision. Read this router, `CURRENT_STAGE.md`,
and only the directly relevant sources. Update `CURRENT_STAGE.md` only when
the decision changes the stage. Do not change the roadmap without explicit
roadmap authorization, and do not create an ADR unless required by the
decision or a genuinely new long-term architecture choice.

Honor explicit external-data limits and stop conditions: no unapproved model,
embedding, Dify, provider, project-data, destructive, merge, push, or deploy
operation; no false allow, lineage loss, automatic Unknown upgrade, or bypass
of Claim Gate. If a stage's selected work is complete, report a concise
checkpoint and wait for the next decision instead of opening roadmap work.

## Product UX boundary

The main UI expresses user tasks and business language, not Backend Pipeline
internals. Keep technical identifiers, hashes, and reason codes in progressive
disclosure. Business-critical actions should use reusable Backend Services;
future Agent tools must call those services and never duplicate business truth
in prompts.
