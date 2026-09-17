# V43_MAPPING_BATCH01_HUMAN_REVIEW_SOURCE_PARITY_CHECKPOINT

Branch: `feat/v4.3-semantic-boundary-routing`  
HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`  
Packet: `mapping-real-source-packet-v1`

## Result

- `TOTAL_CASES`: `24`
- Original JSON/Markdown source parity: **FAIL** (`0/24` pass, `24/24` fail).
- Corrected source-only rendering parity: **PASS** (`24/24` pass, `0/24` fail).
- `SOURCE_PACKET_RENDER_PARITY_GATE`: `PASS_AFTER_CORRECTED_RENDERING`.
- `FINAL_VERDICT`: `HUMAN_REVIEW_SOURCE_PARITY_REMEDIATION_REQUIRED`.

## Initial parity observation

| identity | result before repair |
| --- | --- |
| candidate_id | 24/24 PASS |
| requirement_id | 24/24 PASS |
| requirement source hash | 24/24 PASS |
| sorted fact_id set | 23/24 PASS |
| sorted fact_ref set | 23/24 PASS |
| Fact source hash set | 0/24 PASS — no Fact source hashes were rendered |

The missing Fact source hashes make every original human-facing case fail the required source identity comparison. CAND-013 additionally omitted one Fact from the rendered set.

## CAND-013 / REQ-028

- `PARENT_JSON_FACT_SET`: `EFACT-51BBB3D4-8397-4E1E-B030-26DA8E4A9465`, `EFACT-CD2403D4-C896-4762-9DBC-8ECA23B7B1D4`
- `PARENT_MARKDOWN_FACT_SET` before repair: `EFACT-51BBB3D4-8397-4E1E-B030-26DA8E4A9465`
- `NOVELTY_COMPARATOR_FACT_SET`: `EFACT-51BBB3D4-8397-4E1E-B030-26DA8E4A9465`, `EFACT-CD2403D4-C896-4762-9DBC-8ECA23B7B1D4`
- `SUPP-005` contains the same two Fact identities as the canonical CAND-013 JSON, so the comparator classification `DUPLICATE_PARENT_PAIR` is correct.

## Repair

The Markdown rendering at `backend/eval/gold-human-review/v2/01_mapping_real_source_packet.md` was rebuilt deterministically from the canonical JSON. Each case now renders `requirement_id`, `requirement_source_hash`, `fact_id`, `fact_ref`, and `fact_source_hash`, without expected labels, provider output, or production results.

The permanent Eval-only `SOURCE_PACKET_RENDER_PARITY_GATE` now checks Requirement identity, Requirement source hash, sorted Fact ID/ref sets, and sorted Fact source hashes. A mutation that omits CAND-013’s second Fact fails closed.

## Human authority and safety

- Original affected cases: all 24 (global Fact source-hash omission; CAND-013 also had a Fact-set omission).
- Current Human Authority: `SUSPENDED_PENDING_REVIEW` for affected cases.
- No label, expected decision, Gold, Prompt, Schema, Production behavior, or Fact content was changed.
- `CURRENT_MAPPING_GOLD_SHA_PARITY`: **PASS** (`5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707`).
- `PRODUCTION_FILES_CHANGED`: `0`.
- `ACTIVE_GOLD_CHANGED`: `0`.
- `PROVIDER_CALLS`: `0`.
- `DB_WRITES`: `0`.
- No Git mutation was performed; dirty worktree preserved.

The corrected rendering is ready for a fresh Human review, but it does not automatically restore authority or authorize Gold promotion.

