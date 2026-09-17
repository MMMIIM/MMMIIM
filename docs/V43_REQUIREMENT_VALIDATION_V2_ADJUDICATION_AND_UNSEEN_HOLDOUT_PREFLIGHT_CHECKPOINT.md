# Requirement Validation V2 / Unseen Holdout Preflight

Validation V2 adjudication is recorded as 20 safe, 3 true errors, and 1 context-required case. The final number-omission micro-fix remains PASS, while `POST-FIX-V2-018` remains known P1 development debt. Production certification, Gold V2 readiness, and Mapping readiness remain **NO**.

The repository contains the frozen six-tender development cohort. The only additional benchmark PDF is `TB-016-shenzhen-water-operations.pdf` (SHA-256 `fbf1af7c...9881a46c`, 32 pages); its extracted title identifies a 2026 department budget, not a verified tender solicitation, and no tender packet/manifest or contract identity exists. It is therefore rejected as an unseen holdout candidate rather than misclassified as a Tender.

```text
HOLDOUT_CANDIDATE_TENDER_COUNT = 0
HOLDOUT_TENDER_IDS = []
UNSEEN_INDEPENDENCE = FAIL
OVERLAP_WITH_SIX_TENDER = 0
OVERLAP_WITH_CALIBRATION = 0
OVERLAP_WITH_VALIDATION_V1 = 0
OVERLAP_WITH_VALIDATION_V2 = 0
OVERLAP_WITH_SAFETY = 0
PROVIDER_CALLS = 0
PRODUCTION_DB_WRITES = 0
GOLD_MUTATIONS = 0
```

Requirement prompt/schema/router/canonicalizer/quality-gate/source-resolver identities and the dirty-worktree manifest are frozen in the JSON checkpoint. No holdout execution was started.
