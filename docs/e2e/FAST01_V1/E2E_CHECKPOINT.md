# V43_REAL_E2E_BASELINE_FAST01_V1

## Checkpoint

- **Run:** `V43-REAL-E2E-FAST01-20260911-0001`
- **Branch / HEAD:** `feat/v4.3-semantic-boundary-routing` / `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- **Final status:** `BLOCKED_REAL_E2E_P0_FLOW`
- **Data classification:** `PUBLIC_EVAL_TENDER`; customer-private data observed: `NO`

## Production-shaped path reached

- Project creation: PASS (`0e30c45e-40bf-490e-9784-5a6be9bbfa6b`)
- FAST-01 upload: PASS (`daf726eb-a47c-4a56-ac8d-8c2b94451d7e`)
- Parse job creation: PASS (`5a237389-a59c-462c-b457-e76b1af9e667`)
- Parse completion: FAIL-CLOSED, `NO_TECHNICAL_REQUIREMENTS_FOUND`
- Canonical Requirement / Router / Safe Packet / Writer / Reconciliation: NOT REACHED

## Source and runtime identity

- Source: `backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf`
- SHA-256: `8048485301cad27536c6f4a44e355c8ae05a5ded0ebb537ab9d6a61900d92c29`
- Source bytes: `1,234,398`; extracted text: `53,622` chars / `56` pages
- Backend: `http://127.0.0.1:3010`, health/database: `PASS / connected`
- Semantic Gateway: `http://127.0.0.1:18082`, ready: `PASS`, build: `f509514`

## Counts and side effects

- Parse chunks: `0`; candidate requirements: `0`; canonical requirements: `0`
- Raw/final router candidates: `0 / 0`
- Safe packets: `0`; writer generations: `0`; final versions: `0`
- Provider calls: `0`; retries: `0`
- Manual/direct production DB writes: `0`; authorized normal-API records: `3`
  (project, tender-file, parse-job); Gold mutations: `0`

## Failure attribution

The extractor produced text and chapter-like paragraphs, but the frozen
classifier did not produce a `technical_requirements` section for this PDF.
`requirement-parse-service.js` throws at the section-classification guard before
chunking and before any Semantic Gateway call. This is a `P0_FLOW_BLOCKER`, not
a Provider or semantic-quality result. No retry or product-code change was made.

## Safety

- Prompt / Schema / Router / Requirement / Fact / Mapping / Claim / Writer code: unchanged by this run.
- No Evidence, Fact, Mapping, Claim or Writer actions were started.
- The only state-changing operations were the authorized normal API creation of
  the isolated E2E project, tender-file record and parse-job record.
