---
name: engineering-governance
description: Use when a change may affect shared meaning, boundaries, runtime identity, production contracts, or evaluation parity.
---

# Engineering Governance

This Skill routes anti-drift checks at risk checkpoints. `AGENTS.md`, architecture/ADR/formal contracts, and explicit user authorization outrank it. TDD, debugging, and planning remain with the applicable development tools when separately active.

## Routing

- **GREEN** — local implementation detail with no shared meaning, boundary, or runtime impact. Result: `SKIP GOVERNANCE`; do zero governance and Runtime Identity checks.
- **YELLOW** — shared API, Schema, Prompt, Eval, Gateway, duplicated transformation, compatibility, or runtime-facing change. Run only a focused anti-drift check.
- **RED** — canonical authority/identity/persistence, migration, security, destructive action, production contract cut, or deploy. If authority or evidence is unclear, STOP.

Do not perform repository-wide audits for GREEN work, refactor opportunistically, expand architecture for standards, or enlarge task scope.

## Anti-drift invariants

Check only affected surfaces:

1. **Definition** — one canonical business meaning. Before creating a new
   business or domain term, search the existing canonical contract, schema,
   and concept definitions, and reuse an existing canonical concept when one
   exists.
2. **Authority** — the owning service controls identity, state, persistence, approval, and critical transforms.
3. **Identity** — use stable contract/source/runtime identity; when comparison
   matters, identity explicitly includes runtime, contract, prompt, schema,
   and evaluator identity. Do not invent aliases.
4. **Parity** — reuse the shared canonical implementation. If reuse is impossible, require an executable parity assertion; documentation or developer intention is not proof.
5. **Stable Identity** — run-local refs, chunk/index/rank IDs are not cross-run identity.
6. **Exact/Canonical vs Derived Representation** — canonical identity/provenance remain authoritative; derived or model-facing forms cannot redefine them.
7. **No Silent Fallback** — no hidden alias, bypass, coercion, repair, retry, or state promotion that masks a break.

## Event-triggered Runtime Identity

Runtime Identity is not continuous. Before relying on Live/Provider/E2E results, check it only when:

- runtime-loaded code/config/Prompt/Schema/Contract changed;
- endpoint, environment, server/container, branch, or runtime target changed;
- observed behavior contradicts current code; or
- the result will support Benchmark, Freeze, or Release.

For an unchanged session/Eval Run, reuse a passing Runtime Certification. After an invalidating event (relevant code/Prompt/Schema/Contract, Gateway restart/deploy, endpoint/base URL/environment, or branch/runtime target), re-certify only when a live result is needed. Start with cheap endpoint/base URL/started_at/build checks; inspect hashes, provider, model, or detailed config only on mismatch, certification, or an issue requiring them. Do not run a full Runtime audit by default.

Code on disk != code proven in execution. A confirmed mismatch is `RUNTIME_PARITY_VIOLATION`; stale runtime is a Runtime/Parity failure, not a Semantic Model failure.

## Failure discipline

Use the First Failure Boundary: identify one primary root cause, apply the smallest owner-level fix, replay affected cases, and run affected-layer regression only. Do not reopen passed/frozen layers without invalidating evidence.

## Boundaries

This Skill grants no commit, push, merge, deploy, destructive DB, external Provider, or contract-change authority. No continuous hooks, agents, services, watchers, or governance framework are implied.
