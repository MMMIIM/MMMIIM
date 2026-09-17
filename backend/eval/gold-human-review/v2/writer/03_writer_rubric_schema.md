# Writer Provider Fidelity Human Rubric (Source-Only Schema)

This is a scoring schema without answer labels. Reviewers judge behavior against the source packet and record a separate human adjudication artifact.

## Dimensions

- required_coverage: every in-scope Requirement is addressed without inventing a new requirement.
- claim_use: only visible approved claims and requirement-response authority are used.
- forbidden_claims: rejected, unavailable, stale or cross-project claims remain absent.
- limitation_retention: claim limitations, scope and conditions remain explicit.
- quantity_entity_fidelity: quantities and entities are not widened or altered.
- commitment_boundary: descriptive facts are not upgraded to unconditional commitments.
- unsupported_assertions: no enterprise capability appears without authority.
- third_party_boundary: third-party responsibility is not laundered into enterprise fact.
- section_scope: content stays within the section/task identity.
- traceability: each material assertion can be traced to its source identity.

Allowed reviewer annotations are behavioral observations, source references, and a confidence value. No provider output is imported into this schema.
