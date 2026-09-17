# V43_TARGETED_FACT_HOST_REPLAY_V1_CHECKPOINT

## Status

`BLOCKED_REQUIREMENT_SCOPE_AUTHORITY_PERSISTENCE_UNAVAILABLE`

The repository contains the existing `RequirementScopeAuthorityService`, its
repository methods, API route, and migration 052. The current `bid_platform`
database does not contain the `requirement_scope_authority_decisions` relation;
migration 052 was not executed. The production `requirements` table also has no
canonical rows for the TB-006 source snapshot. Its existing REQ-041/REQ-048
candidate rows have different source text and hashes, so they are not valid
targets for the supplied Human decisions.

## Human exceptions

| Tender | Requirement | Decision | Reasons | Persistence |
| --- | --- | --- | --- | --- |
| TB-006 | REQ-048 | OUT_OF_SCOPE | BUYER_SIDE_OBLIGATION; NON_APPLICABLE_BID_BOND | blocked |
| TB-006 | REQ-041 | OUT_OF_SCOPE | NON_APPLICABLE_TEMPLATE | blocked |

No migration or database write was performed. The Eval-only routing-gap packet
was mechanically marked for both IDs as `GPT/HUMAN_RESOLVED_OUT_OF_SCOPE`, with
no implication of production authority.

## Safety

- Provider/LLM calls: 0
- Production DB writes: 0
- Eval DB writes: 0
- Gold mutations: 0
- Retrieval, Fact, Mapping, Claim, Writer actions: 0
- Production code, Prompt, Schema, and Migration changes: 0
