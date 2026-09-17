# ADR 014: Canonical Production Path and Isolated Test Instances

- **Status:** Accepted
- **Scope:** Production-like evaluation and verification runtimes
- **Date:** 2026-08-30

## Context

Health and readiness of a temporary process do not prove that it uses the
canonical production source, configuration, contracts, or runtime topology.
Evaluation and live verification must remain attributable to the same
production behavior they claim to validate, while focused tests may still need
isolated local instances.

## Decision

The canonical production path remains the authority for production behavior.
An isolated test or verification instance is permitted only when it reuses the
canonical resolver/builders and configuration/contract identities, or proves
equivalence with an executable parity assertion before any Provider invocation.
An isolated instance must not become an alternate or shadow production path,
implicit fallback, or source of production conclusions merely because it is
healthy. Parity failure is fail-closed.

## Alternatives Considered

- Treat any healthy temporary endpoint as production-equivalent: rejected
  because health does not establish source or configuration parity.
- Add an alternate endpoint or fallback route for verification: rejected
  because it creates unowned runtime behavior and hides drift.

## Consequences

Focused tests can run safely without changing production topology, and
production-like evidence remains attributable to the canonical path. Test
fixtures and temporary processes require explicit identity and parity evidence.

## Guardrails

- Verify canonical owner, input/configuration parity, and contract identity
  before Provider invocation.
- Use technical `PRODUCTION_PARITY_VIOLATION` and stop on mismatch.
- Do not infer production equivalence from process health alone.

## References

- `docs/decisions/011-standalone-semantic-gateway-runtime.md`
- `backend/test/requirement-real-path-preflight.test.js`
- `backend/test/requirement-evaluation-integrity.test.js`
- `backend/test/engineering-governance-parity.test.js`
- `.codex/skills/engineering-governance/SKILL.md`
