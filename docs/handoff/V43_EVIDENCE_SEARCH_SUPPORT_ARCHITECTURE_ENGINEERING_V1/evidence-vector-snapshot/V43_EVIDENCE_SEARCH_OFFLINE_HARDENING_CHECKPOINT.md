# V43 Evidence Search Offline Hardening Checkpoint

Status: V43_EVIDENCE_SEARCH_OFFLINE_HARDENING_CHECKPOINT
Current Decision result: MECHANICALLY_READY_PENDING_GPT_SEMANTIC_REVIEW
Snapshot: EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D

This checkpoint is offline mechanical evidence only. It does not cross the GPT semantic review gate and assigns no semantic support, Fact truth, Mapping relationship, Claim eligibility, or Gold label.

## 3-case replay

- JY-001:REQ-057 (PRODUCT_CAPABILITY): candidate=94, structural raw/final=4/0, material diversity=5, duplicate removed=17, final duplicate=0, K0=false, lineage=true
- FAST-01:REQ-005 (PERFORMANCE): candidate=94, structural raw/final=5/0, material diversity=5, duplicate removed=17, final duplicate=0, K0=false, lineage=true
- FAST-04:REQ-004 (QUALIFICATION): candidate=94, structural raw/final=0/0, material diversity=5, duplicate removed=17, final duplicate=0, K0=false, lineage=true

## Corpus quality

Materials/chunks: 9/94; structural/substantive: 47/47; duplicate ratio: 0.414894; metadata/URL/heading-only: 47; mixed evidence/reference-style: 0.
Exact duplicate groups: 8; duplicated headings across materials: 5; ultra-short (<=24 chars): 50.

## Chunking root cause

CHUNKING: A standalone Markdown heading such as # 性能与容量测试报告, ## 时效, or ## 案例 survives parsing and paragraph chunking as a retrievable chunk.

- source_file: backend/src/company-material-service.js:19-35 — uploaded DOCX/PDF/TXT/Markdown material enters the company-material upload path
- parser: backend/src/tender-text-extractor.js:90-114 — extractTenderText selects format parser; DOCX/PDF/plain text are converted to text
- normalization: backend/src/tender-text-extractor.js:10-16 — normalizes line endings, whitespace before line breaks, repeated blank lines, and outer trim
- section_split: none — no heading hierarchy/section split is created for enterprise material chunks
- chunk_builder: backend/src/pipeline/enterprise-material-chunker.js:30-53 — splits only on blank-line paragraphs and emits every non-empty paragraph, including a standalone heading, as a chunk
- embedding_input: backend/src/pipeline/enterprise-retrieval-service.js:30 — passes chunk.source_text directly to the existing embedding client when a vector is missing

## Profile consumption coverage

- PRODUCT_CAPABILITY: prior types=product, documentation, project_case, technical, integration, delivery; signal match=SIGNAL; literal match=CRIT; fallback=0
- PERFORMANCE: prior types=performance, test, capacity, benchmark, delivery; signal match=SIGNAL; literal match=CRIT; fallback=0
- QUALIFICATION: prior types=qualification, credential, certificate, personnel, license; signal match=SIGNAL; literal match=CRIT; fallback=0
- PERSONNEL: prior types=personnel, qualification, credential, certificate; signal match=SIGNAL; literal match=CRIT; fallback=0
- PROJECT_CASE: prior types=project_case, case, delivery; signal match=SIGNAL; literal match=CRIT; fallback=0
- SERVICE_CAPABILITY: prior types=service, delivery, support, maintenance; signal match=SIGNAL; literal match=CRIT; fallback=0
- OTHER_EVIDENCE: prior types=none; signal match=SIGNAL; literal match=CRIT; fallback=0

Unused profile fields: required_dimensions, conditional_dimensions
Decorative/identity-only fields: profile_hash
Missing class behavior: none

## Retrieval harness and regressions

Harness metrics: candidate_count, structural_candidate_count, substantive_candidate_count, duplicate_removed_count, final_duplicate_count, material_diversity, top_k_material_ids, top_k_chunk_ids, similarity_scores, profile_rerank_contribution, K0
Regression tests: 16 cases in backend/test/evidence-search-orchestrator.test.js + backend/test/evidence-chunk-quality-gate.test.js
Focused tests: PASS (16/16); relevant backend regression: PASS (58/58 selected retrieval/chunk/source-span suite); lint: PASS (no backend/frontend lint script configured; root --if-present completed); build: PASS; diff check: PASS

## Authority and side effects

Reference-only escape=0; cross-enterprise escape=0; quarantine escape=0; raw-candidate-to-claim escape=0; mapping/claim authority escalation=0; lineage missing=0.
Provider/Embedding/Fact/Mapping/Claim/Writer calls=0; Production DB writes=0; Eval DB writes=0; Gold mutations=0.

Remaining blocker: GPT semantic review of retrieval usefulness and boundary cases; no semantic labels or support adjudication performed
Stopped before Fact Resolution; semantic review remains required.
