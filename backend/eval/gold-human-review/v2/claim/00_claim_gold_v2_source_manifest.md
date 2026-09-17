# Claim Gold V2 Source Manifest

- dataset_id: `claim-quality-gold-v1-2026-09-02`
- dataset_version: `4.3-claim-quality-v1`
- case_count: 24
- classification: REPRESENTATIVE_SYNTHETIC
- real_customer_data: false
- active: true
- role: ACTIVE_SCORED_QUALITY_GOLD_SOURCE_PARITY_ONLY
- source_path: `backend/eval/evidence-gold/claim-quality-cases.js`
- source_file_sha256: `ee46d8cb9894b0d4df2afaca776ed7050c7edb382fb846d5ff710ea50cd12624`
- canonical_cases_sha256: `0a3a691fa27afc5ebc2daa4e2c8d327d263ff69b424c248870e13fcbbbe1b3d0`
- source_authority: deterministic_eval_fixture
- provider_calls: 0

## Governance

This is a source manifest and parity anchor. It contains no semantic answer authority. The seven named quality cases remain HUMAN_REVIEW_REQUIRED and are not re-labelled here.

## Known review targets

- CQ-NARROW-SSO
- CQ-NARROW-LDAP
- CQ-NARROW-INTERFACE
- CQ-NARROW-CLOUD
- CQ-NARROW-PERFORMANCE
- CQ-COMMITMENT-PROJECT
- CQ-COMPOSITE-STATUS-CONFLICT
