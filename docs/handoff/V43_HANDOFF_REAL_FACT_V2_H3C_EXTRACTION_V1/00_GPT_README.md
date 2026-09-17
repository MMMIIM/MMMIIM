# V43 Real Fact V2 H3C Extraction

This handoff contains mechanical source, lifecycle, parse/chunk, and
production-shaped Fact extraction evidence for the frozen H3C public source
foundation. Semantic authority remains GPT/Human review pending; no Fact Gold
was frozen and no downstream Mapping, Claim, or Writer action was run.

- Enterprise: `H3C-PUBLIC-REAL-V1`
- Source foundation: 20/20 eligible, 20 unique source snapshots
- Eval DB (isolated): `bid_platform_flow_audit_test`
- Materials processed: 20
- Parse/chunk: 20/20 parse success, 4,929 unique chunks, 0 provenance-free chunks
- Provider: 20 calls, 0 provider failures, 0 retries; `deepseek_official /
  deepseek-v4-pro` via `/responses`
- Fact candidates: 4 raw/normalized/deduplicated/canonical candidates
- Source outcomes: 13 valid empty results; 3 strict-schema failures; 2
  contract-grounding failures; all remain review-required and fail closed
- Currentness unknown: 2 candidates; review required: 18 source outcomes/candidates
- Provenance, source-span, and enterprise identity rates: 100%
- Authority escalation violations: 0
- Requirement/tender leakage: 0 (`REQUIREMENT_BLIND_EXTRACTION=PASS`)
- Production DB writes: 0; Gold mutations: 0
- Parser fidelity note: frozen source snapshots are HTML. The existing parser's
  plain-text/Markdown path was used with the raw HTML bytes under a `.md`
  compatibility filename in the isolated Eval project; no Production parser
  code was changed.
