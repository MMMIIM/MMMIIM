# V43_REAL_ENTERPRISE_UPLOAD_TEST_PACK_V1

- Package decision: `REAL_ENTERPRISE_UPLOAD_TEST_PACK_V1/02_CODEX_DECISION.txt`
- Manifest: `01_REAL_DOCUMENT_MANIFEST.json`
- Manifest documents: 12
- Real official PDFs acquired: 6 (`HW-001` through `HW-006`)
- Inaccessible/non-PDF responses: 6 (`HW-007` through `HW-012`)
- Minimum required to continue: 8
- Status: `BLOCKED_REAL_PDF_ACQUISITION_BELOW_MINIMUM_8`

The upload → parse → chunk → Fact extraction path was not started because the package hard gate requires at least eight acquired real PDFs. No HTML response was retained as a source document, no synthetic substitution was made, and no Provider/LLM or database call occurred.

Safety counters:

- Provider calls: 0
- LLM calls: 0
- Production DB writes: 0
- Eval DB writes: 0
- Mapping / Claim / Writer actions: 0
