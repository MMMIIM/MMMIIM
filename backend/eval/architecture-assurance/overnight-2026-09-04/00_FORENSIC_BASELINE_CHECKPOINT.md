# Phase 00 — Forensic Baseline Checkpoint

**PHASE:** 00  
**OBJECTIVE:** Freeze the read-only audit starting point and prove the worktree fingerprint.

## Files inspected

- `config/branch-policy.json`
- `ARCHITECTURE.md`
- `docs/CURRENT_STAGE.md`
- `docs/ROADMAP.md`
- `docs/EVAL_POLICY.md`
- Git refs, status, diff/stat and recent log.

## Code paths confirmed

- Authoritative branch policy names `feat/v4.3-semantic-boundary-routing` for requirement-extraction work.
- Current branch is `feat/v4.3-semantic-boundary-routing`.
- Current `HEAD` is `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e` (`feat: freeze requirement extraction v3 runtime`).

## Tables confirmed

Not queried in this phase; schema/migration inventory is Phase 08.

## Tests inspected

Package scripts expose backend unit, PostgreSQL integration, frontend, Requirement Eval, retrieval/evidence/mapping/claim/writer/agent evals, build and lint. No tests were run in Phase 00.

## Confirmed facts

- **CONFIRMED_BY_GIT:** worktree is dirty: 85 modified/staged-status entries and 351 untracked entries (436 porcelain lines total); no staged changes were reported by `git diff --cached --stat`.
- **CONFIRMED_BY_GIT:** baseline fingerprint over branch, `HEAD`, and full porcelain status is `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`.
- **CONFIRMED_BY_GIT:** latest local log starts `f509514`, `8a5b721`, `b7c2c35`, `4965135`, `6dba9d6`.
- **CONFIRMED_BY_POLICY:** feature branch is the policy-authoritative branch; remote tracking ref is stale at `origin/feat/v4.3-semantic-boundary-routing`=`8ef5a0c`, so remote/local divergence is recorded, not reconciled.
- **CONFIRMED_BY_GIT:** no provider, database, Gold, commit, merge, push, reset, clean, stash, restore or deploy operation was performed by this audit before this checkpoint.
- **LOCAL_ONLY:** existing dirty source/eval artifacts are preserved developer state, not a clean committed release snapshot.

## Conflicting facts

- Local branch `HEAD=f509514` while its remote-tracking ref is `8ef5a0c`; this is branch-tip drift, not an action taken by the audit.
- `docs/CURRENT_STAGE.md` describes earlier frozen stages and a Stage 20 retrieval blocker; current dirty files contain later governance artifacts. Their reconciliation is deferred to Phase 13.

## Unknown areas

- Runtime process/version and live database contents were not queried yet.
- Exact production route wiring, authority ownership, invalidation propagation, and test-layer coverage require later phases.

## P0 risks

- **P0-BASELINE-001:** dirty worktree plus local/remote branch-tip divergence means every finding is local-only until a clean authoritative snapshot is established.

## P1 risks

- **P1-BASELINE-002:** 351 untracked artifacts can mask missing/duplicate eval inputs and must be classified before readiness claims.

## P2 risks

- **P2-BASELINE-003:** line-ending warnings appear during diff/stat; no semantic change inferred.

## Tech debt

- Large accumulated eval and stage artifacts are not yet indexed under one manifest.

## Architecture drift

- **AD-00-001:** branch policy and remote tracking do not describe the local tip; must remain explicit in all later checkpoints.

## Next dependency

Phase 01 component inventory, using this checkpoint as the immutable starting reference.

## SAFE_TO_CONTINUE

**YES** — read-only audit may continue while this fingerprint remains unchanged. Any branch, `HEAD`, or status change requires `AUDIT_BASELINE_DRIFT` and fail-closed stop.

**Gate:** `AUDIT_FORENSIC_BASELINE_CAPTURED`
