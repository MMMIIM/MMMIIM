# Git Sync Policy — V4.3 Bid Platform

## Canonical repository identity

- Canonical repository full name: `MMMIIM/MMMIIM`
- Canonical repository URL: `https://github.com/MMMIIM/MMMIIM.git`
- Local `origin` must point to the canonical URL. Historical manifests or
  checkpoints may retain an older URL only when recording the URL observed at
  that historical moment; that record is not a current canonical reference.

## Authority

During active development, the dirty local worktree is the working engineering authority. After an accepted checkpoint and successful non-force push, the current GitHub development branch becomes the durable engineering authority. At every accepted synchronization boundary:

```text
LOCAL_HEAD == ORIGIN_CURRENT_BRANCH_HEAD
```

`TRACKED_AUTHORITY_PARITY` is the Git authority check above. It is evaluated
only after the authoritative remote branch HEAD is readable. Ignored files,
local secrets, external-only raw artifacts, and other workstation-only files
do not participate in tracked Git authority parity.

`LOCAL_ARTIFACT_PRESENCE` is the separate fact that files exist in the local
worktree, including ignored/local-only/external-only material. Local artifact
presence can require sync exclusion or review, but it does not by itself
invalidate tracked authority parity.

The authoritative development branch from `config/branch-policy.json` is `feat/v4.3-semantic-boundary-routing`. The policy is ff-preferred and stops on divergence. Force push and automatic reset are forbidden. Main is never merged automatically.

## Normal task

A normal task may auto commit and push the current development branch only after all of the following pass:

- required tests and gates pass;
- an authoritative checkpoint exists;
- secret scan passes;
- no unapproved Gold mutation;
- no unapproved production migration;
- no architecture baseline mutation requiring review;
- no new unreviewed private/customer material;
- no unreviewed large binary;
- the branch is a development branch;
- push is non-force;
- no merge or rebase is required;
- no destructive Git operation is required.

Commit message format:

```text
<TASK_ID>: <concise result>
```

After push, record branch, commit SHA, push result, remote parity, and worktree state in the checkpoint.

## High-risk gate

`AUTO_COMMIT_PUSH = BLOCKED` for any of:

- `GOLD_MUTATION`
- `PRODUCTION_MIGRATION`
- `ARCHITECTURE_BASELINE_MUTATION`
- `PRIVATE_SOURCE_MATERIAL`
- `NEW_LARGE_BINARY`
- `SECRET_SUSPICION`
- `PRODUCTION_CONFIG_CHANGE`
- `DESTRUCTIVE_GIT_REQUIRED`
- `MERGE_REQUIRED`
- `FORCE_PUSH_REQUIRED`

These cases stop for GPT/Human review before commit or push.

## First-sync rule

The first bulk synchronization is not part of the governance foundation task.
The final allowlist candidate is `FIRST_GITHUB_SYNC_MANIFEST_V3`; V1/V2 remain
historical records and are not silently rewritten. V3 separates
`FIRST_SYNC_INCLUDE`, `FIRST_SYNC_IGNORE`, `FIRST_SYNC_EXTERNAL_RAW`,
`FIRST_SYNC_COPYRIGHT_LINK_ONLY`, `FIRST_SYNC_LOCAL_SECRET`, and
`FIRST_SYNC_REVIEW_REQUIRED`. Deterministic grouping is required; no broad
catch-all may conceal unresolved Gold, tooling, external-material, or large
raw-artifact decisions. It requires separate GPT/Human review, explicit
resolution of the review-required set, valid non-interactive GitHub credential
access, and a fresh remote branch HEAD probe. This task records commit `0`,
push `0`, merge `0`, deploy `0`, force push `0`, history rewrite `0`, and
destructive Git `0`.

## Public and synthetic source policy

Synthetic/self-generated materials, including synthetic enterprise fixtures,
synthetic project cases, Gold/Eval artifacts, generated checkpoints, reports,
and source fixtures, are `PUBLIC_SYNC_ALLOWED` from a privacy perspective.
Publicly sourced materials are not privacy-blocked merely because they are
external. Redistribution rights remain a separate decision. When rights are
unclear, retain source URL/type/SHA and the generation or acquisition recipe
in Git while keeping the raw original local or external until review.

Allowed redistribution statuses are:

- `REDISTRIBUTION_CONFIRMED`
- `PUBLIC_SOURCE_NO_EXPLICIT_RESTRICTION`
- `LINK_ONLY_RECOMMENDED`
- `UNKNOWN_LICENSE_REVIEW`

Future real customer data, confidential enterprise material, internal
credentials, private contracts, or non-public bid materials require a
`REPOSITORY_VISIBILITY_REVIEW` before synchronization. The current public
repository policy must not be relaxed automatically.
