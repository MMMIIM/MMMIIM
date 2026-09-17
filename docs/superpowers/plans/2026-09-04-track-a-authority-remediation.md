# Plan: Track A Authority Remediation

## Scope

Close only the confirmed Material Authority Gate bypasses for historical
retrieval reload, Evidence Review decisions, canonical Fact draft/edit, and
legacy Fact/Mapping mutation. Preserve all existing Requirement, Mapping,
Claim, Writer, Gold, Retrieval, and Provider contracts.

## Tasks

1. Record the current authority-bearing paths in the required local path
   manifest, including owner, entry point, lifecycle gate, and AS-IS status.
2. Add isolated PostgreSQL entry-point negative controls NC02–NC05 and run
   them before any production-code change so the bypasses are reproduced.
3. Apply the smallest fail-closed changes that reuse the existing
   `MATERIAL_AUTHORITY_SQL` / Material Authority Gate at each owning boundary.
4. Re-run NC02–NC05, a valid-material positive control, and canonical
   Mapping, Claim, and Writer authorization regressions.
5. Write the final Markdown/JSON remediation checkpoint with production-write,
   provider-call, Gold-mutation, and remaining-blocker status.

## Verification

Run the isolated Track A PostgreSQL tests first, then the existing backend
unit/integration suites, frontend tests, Requirement Eval, build, lint, and
`git diff --check`. No Provider call, production DB write, or Git history
mutation is permitted.
