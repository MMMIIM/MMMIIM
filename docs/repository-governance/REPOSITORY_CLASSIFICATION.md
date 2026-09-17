# Repository Classification — V4.3 Bid Platform

Classification is scoped to first-sync preparation. It does not move files, change `.gitignore`, add Git LFS tracking, or upload artifacts.

## GIT_REQUIRED

Keep source, tests, schemas, migrations, architecture contracts, accepted Decisions, handoffs, Eval harness code, frozen Gold, metric contracts, small reproducible result summaries, manifests, and governance files in Git when they pass the applicable review gates.

Current examples:

- `backend/src/`, `backend/test/`, `backend/integration/`, `backend/migrations/`
- `frontend/`, `packages/`, `services/`
- `docs/architecture/`, `docs/decisions/`, `docs/handoff/`
- `backend/eval/retrieval-quality-p0/` and the P1A Eval artifacts
- `docs/project-state/` and `docs/repository-governance/`

The current dirty versions of production code, migrations, `.gitignore`, and broad test sets are not automatically approved for first sync; they remain `GPT_REVIEW_REQUIRED` until their change intent is confirmed.

## GIT_LFS_CANDIDATE

Large binary source materials may be candidates for Git LFS only after private-source authorization, licensing review, and an explicit first-sync decision. No file is approved for LFS by this foundation task.

## GIT_IGNORE_REQUIRED

Keep local secrets, runtime data, uploads, storage, temporary files, logs, databases, caches, `node_modules`, `.pnpm-store`, and disposable embedding/runtime outputs ignored. Existing `.gitignore` was inspected and not changed in this task.

## SECRET_OR_PRIVATE_REVIEW_REQUIRED

Local `.env` files, credentials, SSH material, API keys, access tokens, passwords, private/customer documents, and private source PDFs must never enter the first sync without explicit review. Secret values are not printed by the audit.

## EXTERNAL_STORAGE_CANDIDATE

Very large generated JSON/JSONL/raw payloads should retain a small manifest, identity, SHA, generation recipe, and external artifact location. The raw payload should not be bulk-synced by default.

## Ambiguity rule

When a changed or untracked group cannot be classified from repository evidence alone, classify it as `GPT_REVIEW_REQUIRED`. No broad directory migration is performed for aesthetics.
