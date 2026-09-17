# V43 RAG Semantic Usefulness Baseline V1

- Branch: feat/v4.3-semantic-boundary-routing
- HEAD: f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e
- Dirty worktree entries observed: 696
- Runtime audit: embedding Qwen/Qwen3-Embedding-0.6B, dimension 1024, candidateK 20, finalK 8; production MMR/Hybrid/Exact Signal/Cross-Encoder Reranker: not implemented.
- Historical experiment artifacts audited: 7; missing/unfrozen semantic usefulness labels are explicitly not reconstructed.
- Reference query set: 40 captured cases; retrieval results: 40 cases / 311 Top-K rows.
- GPT semantic review packet: 40 cases, semantic labels created: 0, Gold mutations: 0.
- Source-role handling: reused Backend material-source policy (material-source-role-v1); Reference-only material is not Enterprise Assertion Authority.
- Provider calls added: 0; LLM calls: 0; Production DB writes: 0; Eval DB writes: 0; Fact/Mapping/Claim/Writer actions: 0.
- No MMR, Exact Signal, Hybrid, Reranker, embedding-model, corpus, or production semantic change was implemented.

## Status

READY_FOR_GPT_RAG_SEMANTIC_USEFULNESS_ADJUDICATION
