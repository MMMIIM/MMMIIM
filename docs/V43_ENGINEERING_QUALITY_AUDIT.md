# V43 Production-shaped Flow Engineering Quality Audit

## Scope and identity

- Audit: `V43_PRODUCTION_SHAPED_FLOW_ENGINEERING_QUALITY_AUDIT_V1`
- Branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- Worktree: dirty before and after this read-only audit; existing changes were preserved.
- Provider calls: `0`; LLM calls: `0`; production DB writes: `0`; Gold mutations: `0`.
- No production semantic, Prompt, Schema, migration, Router, Claim, Writer, or Gold changes were made.

## A. Executable call graph

The call graph is documented in [V43_ENGINEERING_RUNTIME_CALL_GRAPH.json](V43_ENGINEERING_RUNTIME_CALL_GRAPH.json). The code path is present from project/tender upload through parse, confirmed canonical Requirement, advisory Response Router, Safe Response Packet, Writer generation/persistence, deterministic validation, final reconciliation, Gate A/Compliance, Bid Pilot, and Human confirmation. Because Docker/PostgreSQL were unreachable from this Codex topology, no edge is marked `RUNTIME_CONFIRMED`; edges are `CODE_ONLY_CONFIRMED`, `TEST_ONLY_CONFIRMED`, or `PARTIAL`.

The prior runtime edge matrix labels projections as connected, but this audit records the stronger evidence boundary: runtime connectivity was not independently observed in this run.

## B. Authority safety

The authority matrix records all required negative controls. In the offline focused scope:

- LLM output and Router advisory output do not become authority.
- Unapproved or stale Fact/Claim/Mapping inputs do not enter Writer assertion context.
- Reference material is `CONTEXT_ONLY`.
- Bid Pilot receives read-only reconciliation context and must use existing human-gated services for mutations.
- Unknown and `NEED_REVIEW` remain unresolved.
- Cross-project authority is rejected.

`AUTHORITY_SENSITIVE_FAIL_OPEN_COUNT=0` for the tested offline scope. This is not a full runtime certification because PostgreSQL/runtime execution was blocked.

## C. Safe Response Packet

`SafeResponsePacketBuilder` is a deterministic projection. It preserves `requirement_id`, source hashes/lineage, project ownership, current Claim/Project Fact status, and deterministic `packet_hash`. Approved/current enterprise assertions and project commitments are separately projected; missing evidence/commitment becomes a human decision. Router output is advisory and does not populate either authority-bearing list by itself. References are explicitly context-only.

## D. Writer identity and lineage

Writer V2 consumes Safe Response Packets and reuses Writer Authorization. Focused tests prove packet identity propagation, current allow Claim filtering, cross-project rejection, stale preview prevention, and authorization snapshot changes affecting generation identity. Requirement lineage is retained in packet/task input and source identity.

Two bounded observations remain:

1. `finalizeV2` version `rule_versions` does not repeat `writer_authorization_snapshot_hash`, although generation identity includes it. This is an identity metadata consistency observation, not a semantic expansion finding.
2. New projection GET routes are not observed behind a project read-authorization middleware (mutation routes are guarded). This is a possible P1 read-ownership gap requiring a separate decision; it is not an observed authority-bearing write bypass.

## E. Data integrity

Code/tests preserve project, requirement, source, claim, fact, packet, generation, task, version, and reconciliation identities. Currentness is guarded for confirmed baselines, current allow claims, approved project facts, safe contexts, and stale previews. Runtime/DB replay was not available, so persistence-level currentness is `PARTIAL` rather than certified.

## F. Failure, retry, and recovery

The failure/recovery matrix records deterministic outcomes. Generation identity has a unique active identity path; task creation uses conflict protection; Writer network retry is bounded; validation and authority failures fail closed; Agent actions use idempotency keys and stale-preview checks. No unsafe recovery path was observed offline. Runtime persistence/replay remains unverified.

## G. Full-suite failures

The fresh `npm test -w backend` run exited `1` and observed 24 distinct failing entries, while the historical checkpoint recorded 23. The required filename is retained as `V43_BACKEND_23_FAILURE_LEDGER.json`; its metadata explicitly records the 24-vs-23 discrepancy and contains all 24 rows. The failures are missing historical Gold/packet artifacts, governance expectation assertions, and runtime configuration assertions. The additional observed entry is the Fact pre-certification boundary fixture (`BLOCKED_WITH_EVIDENCE` vs expected `READY_FOR_GPT_REVIEW`).

The focused current-flow suite remained green at 36/36. No full-suite row identifies a failing current flow module. Nevertheless, the full suite is not certified green and the baseline/artifact/configuration failures are not repaired in this audit.

## H. Frontend contract

Frontend tests pass 51/51. The UI labels Response Router output as advisory and explicitly says it is not Claim/Writer permission. Project and Requirement IDs are carried in API calls for response decision, Gate A, Compliance, and final reconciliation projections. This is contract/test evidence; live API authorization was not exercised.

## I. PostgreSQL and migration gate

The configured database is `bid_platform`, which is production-scoped for this task. The required disposable `bid_platform_flow_audit_test` could not be reached because port 5432 was refused and Docker named-pipe access was blocked. No DB was created; migrations and PostgreSQL integration tests were not run. See [V43_POSTGRES_ISOLATED_TEST_REPORT.md](V43_POSTGRES_ISOLATED_TEST_REPORT.md).

## Decision

`ENGINEERING_QUALITY_AUDIT = BLOCKED_ENGINEERING_AUDIT_POSTGRES`

The blocker is the missing isolated PostgreSQL proof. This audit does not start real E2E, does not change production code, and does not waive the 24 observed full-suite failures.
