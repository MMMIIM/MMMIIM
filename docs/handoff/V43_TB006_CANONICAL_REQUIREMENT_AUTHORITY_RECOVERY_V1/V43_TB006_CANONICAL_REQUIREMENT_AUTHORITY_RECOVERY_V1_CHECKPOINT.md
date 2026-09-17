# V43 TB-006 Canonical Requirement Authority Recovery V1

## Checkpoint

`V43_TB006_CANONICAL_REQUIREMENT_AUTHORITY_RECOVERY_V1_CHECKPOINT`

Status: `PASS`

The current-production-path packet `08_TB006_REQUIREMENT_RUN_V3.json` (SHA-256 `bd08de5b85747b59bc91a2275d979a0de85b66d5b34e6bfc72f3986a9e5ef54d`) was mechanically verified for the target project, parse job, tender PDF identity, and source SHA. Its 341 source-verified candidates were reduced only by the frozen scope decisions in `01_SCOPE_FINAL_CLOSURE.json` (SHA-256 `cda50603257c31c1ce349840ea5ba9a60335a602075acc8b33a168ea6f44993a`): `REQ-040`, `REQ-043`, `REQ-049`, and `REQ-090` are excluded, leaving 337 retained rows. The Eval-only post-recert packet was not used as row authority. Requirement V6.4 freeze evidence is `docs/V43_REQUIREMENT_V6_4_FREEZE_CHECKPOINT.json` (SHA-256 `10df14915f36e7304988f59010b18b20bba9901b47f3d084c46d33891e5fe63b`); retained rows carry canonical rule `4.3-canonical-requirement-1`.

## Persistence

The existing transactional `PgRepository.confirmRequirementBaseline` path in `backend/src/db.js` was used against `bid_platform_flow_audit_test` / `public`, project `7a038c5d-38e4-46ae-b24d-39437bb3b545`. The target was empty before the write. It now contains one `confirmed` baseline (`80e88ce3-8002-42db-8cca-abf47b3e3949`) and 337 requirements; the project is `requirements_confirmed`. The formal actor was `system:v43-tb006-canonical-authority-recovery-v1`, validated by `requireFormalActorId`. The method enforces the project baseline uniqueness/frozen guard and rolls back the entire transaction on any failure.

## Verification

- Requirement IDs: 337 rows, unique; all retained source fields matched the authority packet.
- Source lineage: source verified/status verified/resolution verified = 100%; 30 distinct parse chunks resolved.
- Spot checks: `REQ-014`, `REQ-023`, `REQ-041`, `REQ-048`, `REQ-099`, and `REQ-139` resolve through a confirmed baseline with their source hashes/chunk IDs intact.
- Targeted chunk identities were confirmed for `MCH-93D4FDD592216F58BCD0237DDF4F8F0F`, `MCH-586AF54E29E13328B1D105D03FF08957`, and `MCH-CE770B545973FB9CF092951FCDC402B5`; the parse job has 33/33 succeeded chunks.
- Existing Scope Authority rows (5) were unchanged; no new Scope Authority rows were written.
- Evidence Fact, Mapping, Claim, Project Fact, and Response Plan counts remain zero for this project. Targeted Fact replay was not executed.

## Safety

`PROVIDER_CALLS = 0`  
`LLM_CALLS = 0`  
`PRODUCTION_DB_WRITES = 0`  
`EVAL_DB_WRITES = 1`  
`GOLD_MUTATIONS = 0`  
`MIGRATION_EXECUTED = 0`  
`MAPPING_ACTIONS = 0`  
`CLAIM_ACTIONS = 0`  
`WRITER_ACTIONS = 0`

No production code, prompt, schema, Gold, or migration was changed. Stop here before the separately authorized Fact replay.
