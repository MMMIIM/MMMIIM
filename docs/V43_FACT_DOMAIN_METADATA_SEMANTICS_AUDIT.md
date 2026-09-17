# V43 Fact `domain_metadata` Semantics Audit

## Scope and safety

This is a read-only audit. Provider calls: **0**. Canary was not rerun. Production DB writes and Gold mutations: **0**. No Prompt, Schema, Fact Contract, Gateway, Parser, Validator, Mapping, Claim, or Writer code was modified.

## Historical introduction

- The first committed introduction is `8ad0915` (`feat: freeze evidence fact contract`), which added `domain_metadata jsonb NOT NULL DEFAULT '{}'::jsonb` plus an object-type check in `backend/migrations/023_evidence_facts.sql`, the direct `EvidenceFactService` path, and its contract test.
- `12f76ae` added the canonical `evidence-fact-v1` factory and `backend/migrations/027_evidence_fact_v1.sql`; its fixture defaulted `domain_metadata` to `{}` and included the field in the canonical payload hash/fact identity.
- No committed history entry introduces `domain_metadata` in `packages/semantic-contracts/index.js`; that shared transport schema is present in the current dirty worktree. No original committed design comment assigning final domain ownership was found.
- ADR-021 explicitly records the field's ownership and source-grounding policy as unresolved and says it must not be used as a transport garbage-bin.

## Current contract evidence

The current shared transport schema requires the field and defines it as an object. Top-level `{}` is valid. When namespaces are present, keys must match `^[a-z][a-z0-9_]*$`, values must be objects with at least one property, and additional properties are rejected. The canonical factory applies the same non-empty-namespace rule and defaults a missing value to `{}`. Migrations 023 and 027 store an object and default to `{}`.

Current tests provide the clearest executable semantics:

- `{}` is valid (`backend/test/evidence-fact-domain-metadata-parity.test.js`, `services/semantic-gateway/test/contract-parity.test.js`, `backend/test/evidence-fact-contract-v1.test.js`).
- Non-empty namespace objects are valid.
- Primitive, array, invalid-name, and empty-namespace objects are rejected.

The direct `EvidenceFactService` uses a different non-empty shape (`{namespace, version, values}`), while the transport/canonical factory uses a namespace map. This is an unresolved shape/ownership drift, not evidence that the field is core Fact truth.

## Downstream consumers

| Consumer | Reads | Requires non-empty | Authority depends on value | Finding |
|---|---|---:|---:|---|
| EvidenceSourceFactService / canonical factory | Yes | No | No | Defaults `{}`; source/material/review gates own authority. |
| Fact identity / payload hash / supersession | Indirectly | No | No | Metadata participates in payload hash/fact ID, but grants no authority. |
| Fact grounding | No | No | No | No source-grounding rule for this field. |
| Persistence | Yes | No | No | JSONB object with `{}` default/check. |
| Approval/currentness | No | No | No | Uses lifecycle, lineage, validity and material authority. |
| Retrieval | No | No | No | No consumer found. |
| Mapping / Sufficiency | No | No | No | No consumer found. |
| Claim / Writer | No | No | No | No consumer found. |

Therefore `domain_metadata = {}` does not currently remove core Fact semantics, cause a Mapping error, or remove Claim authority. It does mean the canonical identity remains sensitive to any future metadata value.

## Canary interpretation

The recorded canary failure is an **empty nested namespace object** at `data.facts[0].domain_metadata` (for example `{ capability: {} }`), not a rejection of top-level `{}`. The existing executable tests accept top-level `{}`. No Provider conclusion is changed by this audit.

## Final classification

`FINAL_CLASSIFICATION = D — UNRESOLVED / HISTORICAL_DRIFT`

Operational behavior is compatible with an optional extension container, but formal business ownership is unresolved in ADR-021 and the transport and direct-service non-empty shapes differ. The evidence is insufficient to freeze classification C or authorize a schema change. The requested top-level empty-object behavior already exists, so no Schema patch is justified by this audit.

`CONTRACT_DRIFT = YES` (ownership and shape drift; not a proven core-semantic requirement).

The parity test passed: **4/4**. No Provider call, Canary rerun, production write, or Gold mutation occurred.

## Checkpoint

`DOMAIN_METADATA_FIRST_INTRODUCED_AT = 8ad0915 (storage/service), extended by 12f76ae (canonical contract)`  
`ORIGINAL_INTENT = typed JSON object carried through Fact storage/contract; final domain authority not assigned`  
`CURRENT_SCHEMA_SEMANTICS = top-level {} valid; present namespaces must be non-empty objects`  
`CURRENT_BUSINESS_SEMANTICS = core Fact does not require non-empty metadata; formal owner unresolved`  
`DOWNSTREAM_NONEMPTY_DEPENDENCIES = NO`  
`EMPTY_OBJECT_HISTORICALLY_ALLOWED = YES`  
`CONTRACT_DRIFT = YES`  
`FINAL_CLASSIFICATION = D`

Machine-readable record: [V43_FACT_DOMAIN_METADATA_SEMANTICS_AUDIT.json](D:/AI工作/AI/标书平台/标书平台/docs/V43_FACT_DOMAIN_METADATA_SEMANTICS_AUDIT.json)

STOP: do not enter the 12-material Fact run, Retrieval currentness, Mapping, Claim, or Writer work from this audit.
