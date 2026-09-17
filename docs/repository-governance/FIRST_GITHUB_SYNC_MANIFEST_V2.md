# FIRST_GITHUB_SYNC_MANIFEST_V2

Status: `PREPARED_DO_NOT_COMMIT_OR_PUSH`

## Repository identity

- Canonical repository: `MMMIIM/MMMIIM`
- Canonical URL: `https://github.com/MMMIIM/MMMIIM.git`
- Current branch: `feat/v4.3-semantic-boundary-routing`
- Local HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- `origin`: corrected to the canonical URL.
- Remote branch HEAD: unavailable because the supported GitHub credential mechanism returned `SEC_E_NO_CREDENTIALS`.

The former `MMMIIM/Bid-Pilot.git` URL is retained only where it is part of a historical governance observation. It is not a current canonical reference.

## Authority model

`TRACKED_AUTHORITY_PARITY` means comparing the local branch HEAD with `ORIGIN_CURRENT_BRANCH_HEAD` after the remote HEAD is readable. `LOCAL_ARTIFACT_PRESENCE` covers ignored, local-secret, external-only, or otherwise untracked workstation files; their presence does not by itself invalidate tracked authority parity.

Remote parity is currently `UNKNOWN_REMOTE_HEAD_UNAVAILABLE`.

## Worktree audit

The read-only audit found 709 tracked files, 103 tracked modifications, 3,135 expanded untracked entries, and zero deleted entries. Directory-level status counts are recorded in the companion JSON. No commit, push, merge, rebase, force-push, history rewrite, or destructive Git operation was performed.

## Actionable classification

### `SYNC_APPROVED`

The current candidate allowlist contains 606 unmodified tracked baseline files:

| Directory | Count |
|---|---:|
| `.codex` | 1 |
| `backend` | 514 |
| `config` | 1 |
| `docs` | 48 |
| `frontend` | 19 |
| `packages` | 1 |
| root files | 18 |
| `services` | 4 |
| **Total** | **606** |

This is a classification candidate, not authorization to commit or push. Reconciliation governance artifacts and synthetic P1B eval artifacts are separately identified in the JSON manifest.

### `LOCAL_ONLY_SECRET`

- `backend/.env` — 1,238 bytes, redacted fingerprint `97309F8DC2A18C01`.
- `services/semantic-gateway/.env` — 762 bytes, redacted fingerprint `9E13FACCA33C68B2`.

Secret values were not printed. Both remain local-only.

### `LARGE_RAW_ARTIFACT_EXCLUDED`

The 11 decision-listed large generated JSON payloads are excluded as raw Git content. Their path, byte count, SHA256, identity, and retention policy are in the companion JSON manifest. No Git LFS is used for first sync.

A fresh physical-file scan also found one additional exact duplicate of the listed isolated `10_R1_RESULTS.json` under the reference replay directory. It is explicitly marked `AMBIGUOUS_REVIEW_REQUIRED` rather than silently changing the user-specified count of 11.

### `PRIVATE_SOURCE_EXCLUDED`

Count: 0. The public-source amendment says external PDFs are not private by default.

### `AMBIGUOUS_REVIEW_REQUIRED`

The four identified PDF files form two duplicate groups, have SHA256 recorded, and are classified as public external source with `UNKNOWN_LICENSE_REVIEW`, not as private source. Raw PDFs remain excluded pending redistribution review; source URL and SHA are preserved without printing document contents.

The pre-existing 103 tracked modifications, 3,135 untracked entries, the additional large duplicate, and historical V1 governance records are also explicitly separated for review.

## Secret-history scan

The read-only scan found zero tracked secret suspicions, zero historical `.env` inclusions, and zero credential-pattern suspicions. No affected commit/path exists, no secret value was printed, and history was not rewritten.

## Blocking state

`BLOCKED_GITHUB_AUTH_INTERACTIVE_REQUIRED`

`git ls-remote --heads origin feat/v4.3-semantic-boundary-routing` could not read the remote branch because Git credential acquisition returned `SEC_E_NO_CREDENTIALS`; GitHub CLI also reports no authenticated host. Interactive authentication is required from the human. No hardcoded token or workaround was used.

After authentication is restored, rerun the non-interactive remote HEAD probe. Only then can the repository be classified as `REMOTE_BRANCH_ABSENT_FIRST_PUSH_REQUIRED`, `REMOTE_READY_FOR_FIRST_SYNC`, or `BLOCKED_REMOTE_DIVERGENCE_REVIEW`.
