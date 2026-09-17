# V43 Tender Requirement Fresh Candidate Extraction Checkpoint

- Status: `PARTIAL_BLOCKED`
- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Candidate artifact: `docs/V43_TENDER_REQUIREMENT_FRESH_CANDIDATE_EXTRACTION_PACKET.json`
- Authority upgrade: `NO_AUTHORITATIVE_UPGRADE`
- Formal REQ-ID assignments: `0`
- Gold promotion: `NOT_AUTHORIZED`
- Production DB writes: `0`
- Provider calls: `0`
- Gateway request attempts: `2` (one bounded first-chunk attempt for each of TB-003 and FAST-04; no retry)

## Results

| Tender | Parser/chunker | Fresh extraction | Candidates | Human review |
| --- | --- | --- | ---: | --- |
| JY-001 | PASS; 60 pages, 2,138 paragraphs | source excerpt supplement captured from the official PDF | 193 | required for all 193 |
| TB-003 | PASS; 91 pages, 2,239 paragraphs, 33 chunks | BLOCKED (`environment`, `GATEWAY_NETWORK_ERROR`) | 0 | no inferred candidates |
| FAST-04 | PASS; 119 pages, 4,590 paragraphs, 50 chunks | BLOCKED (`environment`, `GATEWAY_NETWORK_ERROR`) | 0 | no inferred candidates |

## JY-001 source excerpt status

All 193 candidate records carry a verbatim excerpt captured from the current official PDF parser output, with page/paragraph span and excerpt SHA-256. Historical source-span hashes are retained for comparison; no hash parity is asserted where the historical normalization differs. Confidence is `null` because the historical artifact did not provide it. All records remain candidate-only and require Human Authority review.

## TB-003 / FAST-04 failure classification

Both documents passed local PDF text extraction, section routing, and deterministic chunking. A single bounded request was attempted against the configured Semantic Gateway for each document. The local endpoint was not serving HTTP (`GATEWAY_NETWORK_ERROR`) before provider reach, so semantic extraction did not produce candidates. No mock, inferred, or fallback candidates were created. No retry was performed.

## Blockers

1. Restore a reachable, correctly configured Semantic Gateway before retrying fresh extraction for TB-003 and FAST-04.
2. Human Authority must review the 193 JY-001 candidate records; confidence remains unavailable from historical evidence.

This is an eval-only candidate packet. It does not create canonical Requirements, assign formal REQ-IDs, promote Gold, create Mapping, or write Production state.
