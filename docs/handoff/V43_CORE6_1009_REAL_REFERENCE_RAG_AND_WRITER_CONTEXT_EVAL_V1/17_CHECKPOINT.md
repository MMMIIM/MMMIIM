# V43 CORE6 1009 Real Reference RAG + Writer Context Eval

Status: `BLOCKED_PRODUCTION_RETRIEVAL_SCHEMA_MISSING_TABLE`
Run: `V43-CORE6-REAL-REFERENCE-RAG-WRITER-20260915071233`
Core6 source: docs\V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json (ff07402688a3013af9a9b8be01f613f76848b7ea905208c1955a604432422fe1)
Requirements: 1009; tenders represented: 6/6.
Reference denominator eligible: 59; final Eval set: 36.
Production query semantics reused: YES.
Provider calls/failures/retries (current run): 0/0/0; task cumulative query-embedding calls across bounded attempts: 2.
True vector MMR: NOT_EXECUTED_VECTOR_UNAVAILABLE_OR_RETRIEVAL_BLOCKED.
Reference→Assertion escape: 0.
Production/Eval DB writes: 0/0; Gold/Requirement/Fact/Mapping/Claim/Writer mutations: 0.

Semantic labels and strategy conclusions remain pending GPT; no automatic RAG freeze or Writer Provider generation was performed.

Blockers: `project_material_bindings` is missing in `bid_platform.public` (SQLSTATE 42P01), preventing the current production retrieval query; the mechanically eligible set is 36, below the required minimum 45 without cross-tender backfill.

BLOCKED_PRODUCTION_RETRIEVAL_SCHEMA_MISSING_TABLE
