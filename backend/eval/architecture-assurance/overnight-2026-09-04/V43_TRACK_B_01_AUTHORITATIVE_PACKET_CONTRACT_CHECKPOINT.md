# V43 Track B — Observed Authoritative Requirement Packet Contract

**Mode:** READ_ONLY / EVAL_ONLY / FORENSIC / NO_PROVIDER / NO_REEXTRACTION / NO_GOLD_MUTATION  
**Branch:** `feat/v4.3-semantic-boundary-routing`  
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`  
**Track A checkpoint read:** YES  
**Baseline drift:** NO (the pre-existing dirty worktree and Track A audit files are preserved)

## Evidence inspected

- `backend/eval/gold-human-review/v2/mapping-real-rebuild/build-real-gold-source-foundation.js`
- `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/manifest.json`
- `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/{FAST-01,TB-006,FAST-WATER-01}.json`
- `backend/eval/reports/reqx-v311-source-ambiguity-gold-audit-v1.json`
- `backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/semantic-adjudication.json`
- `backend/eval/gold-human-review/v2/mapping-real-rebuild/07_real_requirement_source_universe_v2.json`

No generator or resolver was run. This checkpoint records the current implementation contract only.

## Contract observed from the current resolver/exporter

| Class | Observed fields/conditions | Evidence |
|---|---|---|
| REQUIRED | Fixed Tender identity (`tender_id`); manifest packet entry (`packet_file`); packet JSON with `tender_id`, `source_file`, `source_file_sha256`, `gold_requirements`, and `windows[].spans[]`; each gold item has `gold_id`, `text`, `category`, `source_range.start_ref/end_ref`, `mandatory_observed`, `requires_confirmation`; source audit row is `SOURCE_CLEAR` for an evaluable item; raw source exists and its SHA equals the declared SHA; official source is marked verified. | `packetIndex`, `spanIndex`, `sourceIdentity`, `requirementRecord`, and `buildUniverse` in `build-real-gold-source-foundation.js`; positive packet and manifest entries. |
| OPTIONAL | Packet title/industry/project type, extraction window metadata, chunk budget, cross-chunk count, official source type, and other census metadata. | Present in positive packets/census but not required to construct the resolver's source identity. |
| DERIVED | Packet SHA, source-excerpt text/SHA, source refs, `eval_requirement_id` (`tender_id:gold_id`), packet requirement counts, missing-tender list, and parity gate results. | `sourceIdentity`, `renderSourceExcerpt`, `requirementRecord`, `buildUniverse`, and checkpoint rendering. |
| UNKNOWN / NOT EXPLICIT | A separate human-adjudication identity is not a direct predicate in the current resolver. The available frozen adjudication artifact is linked by path/hash in the source-foundation builder, while the packet itself carries `annotation_status=GPT_SOURCE_AUDITED_SEMANTIC_BOUNDARY_V1_1_FROZEN`. Whether an external artifact owner retains additional human-authority records is not provable from this worktree. | Current resolver source plus the frozen adjudication artifact metadata. |

## Frozen identity and schema observed

- Dataset: `reqx-v3-real-tender-gold-pilot-v1.1-semantic-boundary`.
- Manifest: `gold_frozen=true`, `model_output_used_for_gold=false`, `provider_calls=0`.
- Packet schema: `reqx-v3-real-tender-gold-packet-v1.1-semantic-boundary`.
- Source audit: `198 SOURCE_CLEAR`, `1 SOURCE_AMBIGUOUS`; the ambiguous row is excluded rather than silently upgraded.
- Source-foundation output is `eval_only=true`, `blind=true`, and leaves formal `requirement_id=null`; `eval_requirement_id` is the deterministic Eval identity.

## Current authority interpretation

`AUTHORITATIVE_PACKET_CONTRACT_OBSERVED = CONFIRMED` for the current resolver's packet/source/parity contract. This does **not** establish that a separately stored human semantic adjudication record is available for every Tender; that authority dimension remains explicit and must not be inferred from a production or temporary Eval output.

No missing Tender is promoted, no manifest is rewritten, and no frozen Gold is changed by Track B.

**Provider calls:** 0  
**LLM calls:** 0  
**Production DB writes:** 0  
**Production code changes:** 0  
**Gold mutations:** 0
