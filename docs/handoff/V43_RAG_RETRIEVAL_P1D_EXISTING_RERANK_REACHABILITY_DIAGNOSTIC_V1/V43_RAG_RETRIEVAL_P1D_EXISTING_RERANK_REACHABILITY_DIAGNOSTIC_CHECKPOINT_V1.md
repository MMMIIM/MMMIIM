# V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1

Status: **PROVISIONAL / BLOCKED BEFORE EXISTING-RERANK REPLAY**  
Mode: **EVAL / ENGINEERING DIAGNOSTIC ONLY**  
Decision gate: **EXISTING_RERANK_NOT_EVALUABLE**

## Scope and frozen inputs

This checkpoint inspects the actual production rerank path and replays only
the already-frozen P1C fallback results. It does not modify Production
Retrieval and does not invoke the existing reranker with invented metadata.

| Field | Value |
|---|---|
| Snapshot | EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D |
| Snapshot SHA256 | 5D0A7F451D4090DEDBD8E9EE4F3B5851565F01F7A4170D5A40C673031BCC4578 |
| Corpus | 9 materials / 94 chunks |
| Embedding | Qwen/Qwen3-Embedding-0.6B / 1024 dimensions |
| Gold | backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json / 7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7 |
| Matcher | EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE / ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2 |
| Candidate ladder | 20 / 32 / 48 / 64 |
| Final K | 8 |
| Development cases | 7 |
| Provider / embedding / LLM calls | 0 / 0 / 0 |

## Production implementation identity

- Route: `POST /api/requirements/:requirementId/enterprise-retrieval`.
- Service: `EnterpriseRetrievalService.retrieve`.
- Reranker: `rerankProductionCandidates` in `backend/src/pipeline/semantic-retrieval-reranker.js`, version `4.3-role-need-rerank-v1`.
- Current shape: dense candidateK=20 → existing Production Hygiene → existing rerank if semantic metadata is usable, otherwise raw-vector fallback → final K=8.
- The reranker requires `semanticMetadata.requirement_role`, approved `evidence_needs`, and `candidate_roles[chunk_id]`. It applies bounded deterministic role/need shifts, then tie-breaks by bounded rank, raw rank, similarity, and source identity.
- Exact shift contract: preferred=-2, compatible=-1, unknown=0, weak=+1, incompatible=+2, with maximum absolute shift 4. Final order is bounded rank → raw vector rank → raw similarity descending → stable source identity; final review is the first 8.
- The semantic-role lookup is keyed by the raw candidate `chunk_id` before normalization. The production candidate normalizer also accepts `source_chunk_id`, but no current service adapter maps the computed `chunk_role` to `candidate_roles[chunk_id]`.
- No Gold labels or LLM are part of the production reranker.

## Metadata reachability

| Required input | Production status | Eval status | Finding |
|---|---|---|---|
| canonical requirement id/text/query hash | AVAILABLE_UPSTREAM | AVAILABLE_UPSTREAM | Caller-supplied query_text is not accepted as the canonical production query. |
| EvidenceNeedProfile.version/profile_hash | NOT_AVAILABLE | NOT_AVAILABLE | The existing profile builder is a separate module and is not invoked by the actual route. |
| requirement_role.value/status | UNAUTHORIZED_FOR_EVAL | UNAUTHORIZED_FOR_EVAL | It cannot be supplied from Gold or accepted as a synthetic Eval input. |
| evidence_needs[].value/status | UNAUTHORIZED_FOR_EVAL | UNAUTHORIZED_FOR_EVAL | Production reranker requires approved/non-unknown needs; no approved source is reachable. |
| candidate.chunk_role/substantive_candidate | AVAILABLE_UPSTREAM | AVAILABLE_BUT_DROPPED_BY_EVAL_ADAPTER | P1C replay candidates retain hashes/spans but not source text or chunk_role. |
| semanticMetadata.candidate_roles[chunk_id] | NOT_AVAILABLE | NOT_AVAILABLE | The P1C artifact cannot safely reconstruct this map without inventing or adding an unauthorized adapter. |
| raw_vector_rank/raw_similarity/source ids | AVAILABLE_UPSTREAM | AVAILABLE_UPSTREAM | These fields are present in the frozen P1C replay. |
| GPT Gold profile_class / Gold grades | UNAUTHORIZED_FOR_EVAL | UNAUTHORIZED_FOR_EVAL | Gold is used only by the frozen matcher after a replay, never to activate rerank inputs. |

The actual route accepts caller-provided `semantic_metadata`, but this is not
an approved Production EvidenceNeedProfile. The existing deterministic profile
builder is not called by the actual Enterprise Retrieval path. The frozen P1C
adapter also omitted `source_text`, `chunk_role`, and `content_role`, so a
candidate-role map cannot be reconstructed without a new adapter or invented
metadata. Gold `profile_class` was not used.

## R-FALLBACK: frozen current behavior

R-FALLBACK was replayed from the frozen P1C result using the exact current
fallback contract: dense → existing Hygiene → raw-vector fallback → Top8.

| Raw depth | Recall@1 | Recall@3 | Recall@5 | Recall@8 | Precision@8 | nDCG@8 | MRR_FINAL@8 | Fill rate | Final pool <8 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 0.600000 | 0.700000 | 0.700000 | 0.800000 | 0.089286 | 0.503277 | 0.500000 | 0.785714 | 3 |
| 32 | 0.600000 | 0.700000 | 0.700000 | 0.800000 | 0.089286 | 0.517757 | 0.500000 | 0.964286 | 1 |
| 48 | 0.600000 | 0.700000 | 0.700000 | 0.800000 | 0.089286 | 0.517757 | 0.500000 | 1.000000 | 0 |
| 64 | 0.600000 | 0.700000 | 0.700000 | 0.800000 | 0.089286 | 0.517757 | 0.500000 | 1.000000 | 0 |

Raw diagnostics remain separate: MRR_RAW@20=0.380952, MRR_RAW@32=0.386243, MRR_RAW@48=0.386243, MRR_RAW@64=0.386243.

The metrics above are Development Validation metrics, not fresh blind-holdout
acceptance. Candidate precision, nDCG, and atom recall use the frozen Evidence
Item/span matcher only.

## Required input trace

The trace is explicit at each boundary; `UNKNOWN` means the frozen artifact
does not establish that the intermediate packet exists, not that a missing
field was inferred.

| Required input | Canonical Requirement | EvidenceNeedProfile | Candidate Evidence Packet | Retrieval candidate | Rerank input | Note |
|---|---|---|---|---|---|---|
| canonical requirement query text / requirement_id | AVAILABLE_UPSTREAM | NOT_AVAILABLE | UNKNOWN | AVAILABLE_UPSTREAM | AVAILABLE_UPSTREAM | EnterpriseRetrievalService loads the Canonical Requirement and blocks caller query_text. |
| requirement_role.value/status | AVAILABLE_UPSTREAM | NOT_AVAILABLE | UNKNOWN | NOT_AVAILABLE | UNAUTHORIZED_FOR_EVAL | No Backend-owned Production EvidenceNeedProfile is built in the actual route. |
| evidence_needs[].value/status and profile_hash/version | AVAILABLE_UPSTREAM | NOT_AVAILABLE | UNKNOWN | NOT_AVAILABLE | UNAUTHORIZED_FOR_EVAL | Gold profile_class is Eval-only and cannot populate production semantic metadata. |
| candidate_roles[chunk_id] | NOT_APPLICABLE | NOT_APPLICABLE | UNKNOWN | AVAILABLE_BUT_DROPPED_BY_EVAL_ADAPTER | NOT_AVAILABLE | Production partitioning computes chunk_role, but the actual reranker input requires candidate_roles and P1C did not retain the source fields needed for an adapter. |
| raw_vector_rank/raw_similarity/source ids | NOT_APPLICABLE | NOT_APPLICABLE | AVAILABLE_UPSTREAM | AVAILABLE_UPSTREAM | AVAILABLE_UPSTREAM | Frozen P1C replay preserves deterministic raw identity and rank fields. |

## R-EXISTING: existing rerank replay gate

R-EXISTING was **not invoked**. The replay is blocked before reranker
invocation because no approved Production EvidenceNeedProfile and no safe
candidate-role adapter are reachable from the frozen inputs. Consequently,
there are no R-EXISTING metrics, no claimed rerank rank movement, and no
semantic conclusion about the quality of `4.3-role-need-rerank-v1`.

| Depth | Status | Invocation count | Metrics |
|---:|---|---:|---|
| 20 | NOT_EVALUATED | 0 | APPROVED_PRODUCTION_METADATA_UNAVAILABLE |
| 32 | NOT_EVALUATED | 0 | APPROVED_PRODUCTION_METADATA_UNAVAILABLE |
| 48 | NOT_EVALUATED | 0 | APPROVED_PRODUCTION_METADATA_UNAVAILABLE |
| 64 | NOT_EVALUATED | 0 | APPROVED_PRODUCTION_METADATA_UNAVAILABLE |

## Special-case diagnostics

These are diagnostic references only and were not used to tune or create
metadata. `FAST-01:REQ-005` remains a Calibration case; the other three are
Development Validation cases.

| Requirement | Split | First grade≥2 dense rank | Survivor depth | Fallback final-review rank by depth | Atom Recall@8 |
|---|---|---:|---:|---|---|
| FAST-01:REQ-005 | CALIBRATION_SET | 40 | 48 | 20:—<br>32:—<br>48:—<br>64:— | 0→0 |
| TB-003:REQ-119 | DEVELOPMENT_VALIDATION_SET | 27 | 32 | 20:—<br>32:—<br>48:—<br>64:— | 0→0 |
| JY-001:REQ-027 | DEVELOPMENT_VALIDATION_SET | 6 | — | 20:2<br>32:2<br>48:2<br>64:2 | 1→1 |
| TB-003:REQ-170 | DEVELOPMENT_VALIDATION_SET | 2 | 32 | 20:1<br>32:1<br>48:1<br>64:1 | 1→1 |

The diagnostics show why a rerank quality claim cannot be made yet: candidates
that are present in the frozen replay still lack the approved semantic inputs
needed to activate the production reranker.

## Safety and authority parity

- Production Retrieval changes: 0; production DB writes: 0.
- Gold mutations: 0; corpus/vector mutations: 0; source span/lineage changes: 0.
- Fact / Mapping / Claim / Writer / Router / profile mutations: 0.
- Gold was not used in rerank activation logic; no Gold-aware filter or ranking was added.
- Provider, embedding, and LLM calls: 0.

## Recommendation

**EXISTING_RERANK_NOT_EVALUABLE**

Return to GPT for an architecture/metadata decision. If GPT authorizes a
follow-up, it must define a Backend-owned Production EvidenceNeedProfile and a
deterministic candidate-role adapter before any R-EXISTING replay. No P2, P3,
P4, hybrid, MMR, cross-encoder, or Production Retrieval change is authorized
by this checkpoint.

No commit, push, merge, deploy, or production modification was performed.
