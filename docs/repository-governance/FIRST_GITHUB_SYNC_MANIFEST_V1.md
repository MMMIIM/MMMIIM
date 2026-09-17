# FIRST_GITHUB_SYNC_MANIFEST_V1

Status: **PREPARED — DO NOT COMMIT OR PUSH**

## Repository snapshot

- Root: `D:/AI工作/AI/标书平台/标书平台`
- Branch: `feat/v4.3-semantic-boundary-routing`
- Local HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Origin: `https://github.com/MMMIIM/Bid-Pilot.git`
- Origin branch HEAD: **not available**; `git ls-remote` stopped with `SEC_E_NO_CREDENTIALS`.
- Audit counts before governance writes: 103 tracked modified status entries, 618 Git untracked status entries, 3,121 expanded untracked files, 0 deleted, 88 ignored status entries, 42,979 expanded ignored files.

Counts use both Git status entries and expanded file counts where a directory is collapsed by Git. Classification units intentionally overlap when a group has both size and privacy risk.

## Classification summary

| Classification | Count / scope | Treatment |
|---|---:|---|
| `COMMIT_NOW` | 8 governance-support files | Proposed for the first reviewed sync only; not committed here |
| `IGNORE` | 42,979 expanded ignored files | Keep local and excluded |
| `GIT_LFS` | 0 approved | Four large PDFs remain private-source review candidates |
| `EXTERNAL_ONLY` | 11 large generated JSON artifacts | Keep manifest/SHA/recipe; externalize raw payload unless reviewed |
| `GPT_REVIEW_REQUIRED` | 721 residual status entries plus private/secret overlays | Do not include automatically |

## Proposed commit-now set

Only the governance files created by this task are proposed as the initial reviewed set:

- `docs/project-state/CURRENT_STATE.md`
- `docs/project-state/DECISION_REGISTRY.md`
- `docs/repository-governance/GIT_SYNC_POLICY.md`
- `docs/repository-governance/REPOSITORY_CLASSIFICATION.md`
- `docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V1.json`
- `docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V1.md`
- `docs/repository-governance/V43_REPOSITORY_GOVERNANCE_AND_GITHUB_SYNC_FOUNDATION_CHECKPOINT_V1.json`
- `docs/repository-governance/V43_REPOSITORY_GOVERNANCE_AND_GITHUB_SYNC_FOUNDATION_CHECKPOINT_V1.md`

This is a proposal, not authorization to commit.

## Directory-level review groups

- `backend/src/`, `backend/migrations/`, `backend/test/`, `backend/integration/`: production boundary, schema, or test changes; `GPT_REVIEW_REQUIRED`.
- `backend/eval/`: mixed harnesses, Gold, handoffs, generated results, and P1A artifacts; keep small reproducible harness/contracts, review generated payloads individually.
- `docs/`: mixed architecture, Decisions, handoffs, Gold/Eval packets, raw result payloads, and generated reports; `GPT_REVIEW_REQUIRED` unless explicitly classified as governance or external-only.
- `data/eval/` and `uploads/`: source documents and runtime upload material; private-source review; no automatic sync.
- `frontend/`, `packages/`, `services/`: tracked production/runtime changes; `GPT_REVIEW_REQUIRED`.
- `.env`, runtime directories, caches, local databases, and logs: `IGNORE` plus secret/private review where applicable.

## Secret scan

No tracked private-key or token-like literal was reported by the non-printing pattern scan. Two untracked/ignored secret-bearing local environment files were found:

- `backend/.env` — API-key, token, database, and gateway credential variables; untracked/ignored; redacted file fingerprint `97309F8DC2A18C01`; exclude and review locally.
- `services/semantic-gateway/.env` — provider/gateway credential variables; untracked/ignored; redacted file fingerprint `9E13FACCA33C68B2`; exclude and review locally.

Tracked `.env.example` files are templates, not proof that local secrets are safe to sync. Values were not printed.

## Large-file audit

Files at or above 10 MB, all currently untracked:

- `docs/eval/p0-recall/V43_P0_487_PROVENANCE_TRACE_INDEX.json` — 64.40 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `data/eval/real-enterprise-upload-test-v1/raw/HW-001.pdf` — 35.46 MB — source PDF — `GPT_REVIEW_REQUIRED`, possible LFS only after private-source authorization.
- `data/eval/real-pdf-pilot-storage/5d724373-3d88-41ec-b72d-0d7a01107af7/061de778-001c-48c7-a30b-ffd2e0a6bfb4.pdf` — 35.46 MB — source PDF — `GPT_REVIEW_REQUIRED`, possible LFS only after authorization.
- `docs/eval/p0-recall/V43_P0_SOURCE_FIDELITY_EVIDENCE.json` — 32.52 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/eval/flywheel/V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json` — 19.84 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/eval/flywheel/p0-badcase-repair-v2/V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6.json` — 15.56 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/09_R0_RESULTS.json` — 12.65 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/09_R0_RESULTS.json` — 12.65 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/10_R1_RESULTS.json` — 12.65 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/06_R1_HYGIENE_RESULTS.json` — 12.65 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/05_R0_CURRENT_RESULTS.json` — 12.65 MB — generated JSON — `EXTERNAL_ONLY` candidate.
- `data/eval/real-enterprise-upload-test-v1/raw/HW-003.pdf` — 12.29 MB — source PDF — `GPT_REVIEW_REQUIRED`, possible LFS only after authorization.
- `data/eval/real-pdf-pilot-storage/5d724373-3d88-41ec-b72d-0d7a01107af7/13c1eb7e-4ab4-48c7-864d-354abf50a8aa.pdf` — 12.29 MB — source PDF — `GPT_REVIEW_REQUIRED`, possible LFS only after authorization.
- `backend/eval/requirement-unseen-holdout-v3/results/unseen-holdout-v3-2026-09-09T15-43-27-853Z-0dba352e/parsed-sources/HOLDOUT-REQ-V3-01.json` — 11.50 MB — generated parsed source — `EXTERNAL_ONLY` candidate.
- `backend/eval/requirement-unseen-holdout-v3/results/unseen-holdout-v3-2026-09-09T15-43-27-853Z-0dba352e/V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_GPT_REVIEW_PACKET.json` — 11.18 MB — generated review packet — `EXTERNAL_ONLY` candidate.

Size distribution excluding `.git`, `node_modules`, and `.pnpm-store`: `<10 MB` 4,430 files; `10–50 MB` 15 files; `50–100 MB` 1 file; `>100 MB` 0 files.

## Exact first-sync blocker

`BLOCKED_REMOTE_HEAD_UNAVAILABLE_CREDENTIALS; FIRST_BULK_SYNC_GPT_REVIEW_REQUIRED; SECRET_AND_PRIVATE_SOURCE_REVIEW_REQUIRED`

Next action: GPT reviews this manifest, confirms the initial inclusion set and private/external handling, then a separately authorized run restores non-printing GitHub credential access and performs the first bulk synchronization with parity verification.
