# V43 Claim Gate Targeted Production Remediation

## Scope

- Remove the active legacy Claim authority duplication without deleting the
  compatibility route.
- Persist and reload the existing Claim/Gate identity fields needed for
  fail-closed Writer authorization.
- Keep V2 gate decision and legacy decision projections in parity.
- Preserve human decision, stale-lineage, and Mapping/Writer authority
  boundaries.
- Add focused Claim quality/evaluation evidence without Provider calls.

## Constraints

- No Prompt, model, Fact, Mapping, Requirement, Writer architecture, or
  downstream contract redesign.
- No Provider, DeepSeek, Dify, commit, push, deploy, reset, clean, stash, or
  unrelated-file cleanup.
- Preserve all existing dirty worktree changes and benchmark fixtures.

## Execution Checklist

1. Inspect current diffs, route callers, Claim persistence, migrations, and
   focused tests; identify the exact owner boundaries.
2. Add focused RED tests for legacy-route authority, identity persistence and
   DB-shaped reconstruction, V2 decision parity, stale authorization, human
   decisions, and Claim quality/no-escalation cases.
3. Run the new tests and record the failing boundaries.
4. Implement the smallest route compatibility guard, migration/persistence
   projection, and currentness/parity fixes required by the RED evidence.
5. Run the focused Claim/Mapping/Writer regressions and the applicable
   contract/formal tests.
6. Run syntax, build, lint-status check, and `git diff --check`; classify any
   unrelated pre-existing failures without changing them.
7. Report exact changed files, migration status, safety metrics, and whether
   PostgreSQL was available. Do not commit or push.
