# FIRST_GITHUB_SYNC_MANIFEST_V4

Status: `READY_FOR_FIRST_BASELINE_COMMIT_AND_LOCAL_RECONCILIATION`

This is the GPT-authorized exact first-sync allowlist. Git inclusion does not
promote Gold, Eval, Human Review, or holdout artifacts. Previous V3 review
entries are included only with authority-preserving metadata.

## Repository and divergence

- Canonical repository: `MMMIIM/MMMIIM`
- Origin: `https://github.com/MMMIIM/MMMIIM.git`
- Branch: `feat/v4.3-semantic-boundary-routing`
- Local HEAD before baseline commit: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Remote HEAD: `8ef5a0c323aca5848d2068444a58a8196b04c631`
- Merge base: `8a5b721a26894caf4c90b48441d6b680beb6c786`
- AUTH_BLOCKER: `CLOSED`
- DIVERGENCE: `RESOLVED_PENDING_LOCAL_HISTORY_RECONCILIATION`
- GOVERNANCE_RULE_PORT: `PASS`

## Classification summary

| Category | Files | Tracked modified | Untracked |
|---|---:|---:|---:|
| `FIRST_SYNC_INCLUDE` | 3092 | 104 | 2988 |
| `FIRST_SYNC_IGNORE` | 0 | 0 | 0 |
| `FIRST_SYNC_EXTERNAL_RAW` | 41 | 0 | 41 |
| `FIRST_SYNC_COPYRIGHT_LINK_ONLY` | 129 | 0 | 129 |
| **all status entries** | **3262** | **104** | **3158** |

### FIRST_SYNC_INCLUDE

- `.codex`: 1
- `<root>`: 3
- `backend`: 1197
- `data`: 32
- `docs`: 1839
- `frontend`: 4
- `packages`: 3
- `services`: 13

### FIRST_SYNC_IGNORE



### FIRST_SYNC_EXTERNAL_RAW

- `backend`: 6
- `docs`: 35

### FIRST_SYNC_COPYRIGHT_LINK_ONLY

- `backend`: 88
- `data`: 35
- `docs`: 6

## Resolved review set

- Previous V3 review-required entries: 143
- Resolved into FIRST_SYNC_INCLUDE: 143
- Unresolved review-required entries: 0
- FIRST_SYNC_INCLUDE paths: 3092
- Exact NUL-delimited staging allowlist: `FIRST_GITHUB_SYNC_MANIFEST_V4_ALLOWLIST.txt`

## Exclusions

- Local secret paths: `backend/.env`, `services/semantic-gateway/.env`
- External raw files: 41
- Copyright/link-only originals: 129
- No raw excluded document contents are embedded in this manifest.

## Baseline gates

- Staging must use only the exact allowlist; no `git add .`.
- Staged .env, secret, external raw, and copyright/link-only counts must be zero.
- Run staged secret scan and `git diff --check` before commit.
- Backend full-suite status remains `KNOWN_TEST_DEBT`; release certification remains blocked.

## Safety

No commit, push, merge, rebase, reset, force push, clean, or deploy is recorded
by this manifest generator. The only later authorized history action is the
single audited `git merge -s ours --no-ff origin/feat/v4.3-semantic-boundary-routing`.
