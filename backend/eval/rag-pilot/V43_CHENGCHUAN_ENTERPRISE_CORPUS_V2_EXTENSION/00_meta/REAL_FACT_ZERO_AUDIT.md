# V43 Real Fact = 0 Root-Cause Audit

## Verdict

`REAL_FACT_V2_ELIGIBLE_CANDIDATES = 0` was a **current real-authority eligibility result**, not proof that the database had never contained any Fact rows.

### Primary cause

The existing Chengchuan company-case materials are intentionally synthetic. The original COM-01 metadata explicitly identifies the company as a `Synthetic Demo Company` and sets:

- `source_kind = synthetic_company_evidence`
- `evidence_status = synthetic_pilot_evidence`
- `claim_permission = false`
- `human_review_required = true`
- `synthetic_company_evidence = true`

Therefore these materials belong to the synthetic development lane and are not eligible to become `REAL_ENTERPRISE_EVIDENCE_CANDIDATE`.

### Current 56-material authority projection

- 16 synthetic enterprise evidence
- 34 reference-only
- 4 quarantined
- 2 unknown/review-required
- 0 real enterprise evidence candidates

The 4 quarantined Neusoft materials historically had Facts, but their **current Fact authority is 0** after quarantine. Historical rows can still exist for audit and still not count as current real eligible Facts.

The 2 unknown materials were deliberately not auto-promoted.

### Formal Real Fact admission is stricter than “a Fact row exists”

A real current Fact must come from a real, independent, non-synthetic, non-quarantined enterprise source with clear enterprise identity, provenance/snapshot/hash/currentness, and then satisfy canonical Fact authority and human review requirements.

Hence:

`historical Fact rows > 0` can coexist with `REAL_FACT_V2_ELIGIBLE_CANDIDATES = 0`.

## Merge consequence

This V2 extension remains synthetic. Renaming the unimported Xinglan test company to Chengchuan **does not and must not** change Real Fact eligibility.

After importing this extension, the expected authority state is still:

- Synthetic enterprise material depth: increased
- Synthetic Fact candidates: can increase
- Real enterprise source candidates: unchanged unless genuinely real materials are separately imported
- Real Fact eligible candidates: still 0 unless a real-source lane is established and reviewed
