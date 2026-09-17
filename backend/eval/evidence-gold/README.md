# Evidence / Claim Gold Evaluation Contract v1

This directory is an evaluation-only contract. It does not alter retrieval, Evidence, Evidence Fact, or Claim Gate production decisions.

`gold-candidates.json` records 30 candidates from live project `112b3805-df67-4483-b1aa-c8941a111465`. Its chunk IDs, material IDs, offsets, excerpts, and hashes are source provenance, not generated evidence. The three previously human-reviewed seeds (`REQ-030`, `REQ-016`, and `REQ-187`) are the only approved Gold labels. Every other candidate remains `pending` and is excluded from formal metrics.

`contract.js` deterministically expands the compact source into three stable datasets:

- Retrieval Gold separates relevant anchors from best evidence-capable anchors and explicitly represents no-sufficient-evidence cases.
- Evidence/Fact Gold preserves exact source ranges and six fact dimensions. `unknown` and `not_applicable` are first-class labels.
- Claim Gate Gold records expected dimensions, reason codes, decision, and Writer eligibility. Probe labels are based on the reviewed source boundaries, not inferred from current system output.

`runner.js` validates the versioned contract and reports only approved records. Pending counts remain visible. Run with:

```text
npm run eval:evidence-gold -w backend
```

Material coverage is intentionally incomplete. Current live data covers `company_profile`, `product_documentation`, `project_case`, and `qualification`; it does not manufacture delivery/service, personnel, technical whitepaper, historical bid, or other material types.

Claim quality cases are maintained beside this Gold source in
`claim-quality-cases.js`; they are a separate evaluation slice, not a second
production authority. `backend/eval/claim-eval-v1/runner.js` imports the frozen
production Claim Gate directly and reports Safety, Bid Quality, and offline
Authorization Integrity. Fast Claim Eval is provider-free and database-free;
the DB Gate remains an explicit PostgreSQL step.
