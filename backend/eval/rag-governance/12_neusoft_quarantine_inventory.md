# Neusoft Corpus Quarantine Inventory v1

Quarantine is an authority boundary, not deletion. This artifact preserves all historical material, chunks, embeddings, Facts, Mappings, claims, and Gold references. No database mutation was attempted.

## Detection

- detection rule: case-insensitive match of `东软|neusoft` across material name, source metadata, industry, and project name
- matched materials: 4
- repository files containing references: 37

## Material-level status

| material_id | original_name | chunks | embeddings | derived facts | current facts | derived mappings | current mappings | claim refs | current retrieval predicate | quarantine status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2e553e66-a909-4ed1-b99e-a57c25b51824 | ccgp-neusoft-project.md | 27 | 27 | 2 | 2 | 2 | 2 | 2 | YES | NOT_APPLIED_BLOCKED_MISSING_LIFECYCLE |
| 427e5615-72e0-4d3d-b38a-f44891b993e2 | neusoft-qualifications.md | 3 | 3 | 2 | 2 | 2 | 2 | 2 | YES | NOT_APPLIED_BLOCKED_MISSING_LIFECYCLE |
| 5a4674b0-aaab-475a-964b-977ae4b1ff65 | neusoft-smart-city.md | 34 | 34 | 0 | 0 | 0 | 0 | 0 | YES | NOT_APPLIED_BLOCKED_MISSING_LIFECYCLE |
| c7542760-5ed9-479e-a642-1ebf7999f446 | neusoft-system-integration.md | 17 | 17 | 2 | 2 | 2 | 2 | 2 | YES | NOT_APPLIED_BLOCKED_MISSING_LIFECYCLE |

## Required future exclusions

- Production Retrieval: MUST_EXCLUDE, but currently NOT_ENFORCED because private-project retrieval accepts any `ENTERPRISE_PRIVATE` material without lifecycle/usage checks.
- new Evidence Fact: MUST_EXCLUDE; current derived-source queries do not consume a quarantine state.
- new Mapping candidates: MUST_EXCLUDE; current retrieval/candidate selection has no quarantine predicate.
- Mapping Real Gold discovery: MUST_EXCLUDE by Eval policy; historical source packets remain immutable.
- Claim Real Gold discovery: MUST_EXCLUDE by Eval policy; historical source packets remain immutable.
- Writer Provider Fidelity source discovery: MUST_EXCLUDE by Eval policy.

## Fail-closed decision

- existing lifecycle values: ACTIVE / ACTIVE_FULLTEXT / approved
- safe quarantine enum available: NO
- derived authority invalidation available: NO
- status: NEUSOFT_QUARANTINE_REQUIRES_AUTHORITY_LIFECYCLE_DECISION
- blocker: Existing lifecycle enum has no quarantine state honored by private Retrieval and derived authority queries; applying usage/review/lifecycle updates alone would not fail closed.
- required next decision: define and implement an owner-approved authority lifecycle that is honored by Retrieval, Evidence, Fact, Mapping, Claim, and Writer source selection before applying quarantine.
