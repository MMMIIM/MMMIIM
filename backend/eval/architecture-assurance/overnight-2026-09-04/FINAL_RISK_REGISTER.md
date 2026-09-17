# V43 Assurance Audit V2 — Final Risk Register

Baseline anchor: branch `feat/v4.3-semantic-boundary-routing`, `HEAD=f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`, Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`.

## P0

| ID | Risk | Current evidence | Gate impact |
|---|---|---|---|
| P0-BASELINE-001 | Dirty local worktree and stale remote tip | 85 modified + 351 untracked at Phase 00; local `HEAD` differs from remote tracking | Local-only findings; no release assurance |
| P0-RAG-001 | Quarantine/authority leakage | Neusoft source-role checkpoint: derived leakage YES; future retrieval/fact/mapping exclusion NOT_ENFORCED; real enterprise candidates 0 | Blocks RAG/real enterprise readiness |
| P0-REQ-001 | Missing authoritative source packets | JY-001, TB-003, FAST-04 raw PDFs only; source verification/promotion blocked | Blocks six-tender and Real Gold promotion |

## P1

`P1-LEGACY-001` dual writable Fact/Mapping surfaces; `P1-DIFY-001` legacy Dify reachability; `P1-PRODUCER-001/002` Fact/Mapping semantic producers wired but uncertified; `P1-SUPPORT-001` ambiguous support unavailable; `P1-STALE-001` full-chain propagation only partial; `P1-MIG-001` no migration ledger; `P1-EVAL-001` ruler provenance/certification debt; `P1-WRITER-001` Provider Fidelity Gold absent; `P1-WRITER-002` context-only payload reinterpretation risk; `P1-LINEAGE-001` hash identities without universal FKs; `P1-RAG-002` dual embedding identity/index dimensions; `P1-REQ-001` source artifact drift.

## P2 / Debt

Documentation/task-status drift, duplicate table representations, low-information chunks, path-sensitive fixtures, distributed capability status, absent central identity/tool/migration manifests, and pending UI/status terminology. These do not override P0/P1 gates.

## Negative conclusions

No current evidence of cross-project mutation, Gold mutation, Claim authority escalation or Writer authorization bypass was found. The audit did not modify production code, production DB, Gold, prompts, schemas, providers or Git history.
