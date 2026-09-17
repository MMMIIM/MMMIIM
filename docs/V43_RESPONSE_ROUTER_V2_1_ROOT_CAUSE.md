# V43 Response Router V2.1 — Root-Cause Record

## Scope and identity

This record covers the deterministic, read-only V2.1 projection and its replay
against the immutable GPT semantic Reference V3.  The reference remains a
development semantic reference, not Human Gold or production certification.

- Reference: `docs/V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip#V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json`
- Reference SHA256: `3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744`
- Reference rows: 2,178 (CORE6 1,009; HOLDOUT_V1 397; HOLDOUT_V2 772)
- Router: `backend/src/pipeline/requirement-response-router-v2-1.js`
- Version: `v43-response-router-v2.1`
- Implementation: `v43-response-router-v2.1-systematic-boundary-repair`
- Replay run: `V43-RR-V2_1-V3-REPLAY-c7184cd488d85c64`

## Mechanical root causes addressed

The V2 baseline projection did not express the required boundary precedence
explicitly.  The V2.1 read-only layer therefore adds general signals for:

1. pre-award eligibility, bid formality, and direct disqualification;
2. offered/existing product capability, technical specifications, and
   measurable performance;
3. current-project design, architecture, implementation, and integration;
4. future/post-award, delivery, service, and contract obligations;
5. evidence dependency after primary-mode selection;
6. risk after mode selection, including P0 consequences and high-risk facts;
7. structurally incomplete boundary fragments and genuinely mixed subjects.

The rules are lexical/structural and domain-neutral.  They do not inspect
case IDs, requirement IDs, tender IDs, reference artifacts, expected labels,
or provider output, and they do not mutate Requirement or production state.

## V2.1 replay evidence

- Primary agreement: 1,684 / 2,178 (0.773186)
- Primary disagreements: 1,263
- P0 compliance escapes: 0
- High-risk/P0 evidence-dependency false negatives: 105
- Post-award commitment routed as evidence: 66
- Project solution routed as enterprise evidence: 96
- Evidence routed as solution: 15
- Commitment routed as compliance: 48
- Compliance routed as commitment: 51
- Genuine ambiguous reference cases: 3; Router NEED_REVIEW: 22; recall 3/3;
  false abstention 19

Cross-cutting agreement is reported separately from primary-mode agreement in
the checkpoint and full-corpus JSON.  The disagreement/failure-family files
are mechanical indices only; they are not semantic authority.

The sealed V2 projection comparison is intentionally not a V2.1 acceptance
gate; V2.1 has a distinct projection version and implementation identity.

## Gate interpretation

The deterministic implementation preserves the hard P0 compliance boundary
and catches all three reference ambiguous cases, but the replay still misses
the development quality floors and the two remaining hard safety targets.
Those misses are retained as evidence for GPT adjudication.  No case-specific
exception or benchmark-derived routing rule was added, and no production
cutover is authorized by this artifact.

## Side effects

Provider calls, LLM calls, production database writes, Requirement/Fact/
Mapping/Claim/Writer mutations, reference mutations, and commit/push/merge/
deploy operations: **0**.
