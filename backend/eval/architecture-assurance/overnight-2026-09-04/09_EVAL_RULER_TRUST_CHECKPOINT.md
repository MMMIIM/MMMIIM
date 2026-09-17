# Phase 09 — Eval Ruler Trust Checkpoint

**PHASE:** 09  
**OBJECTIVE:** Determine whether evaluation fails on semantic/provenance mutations and whether denominators are honest.

**BASELINE:** Phase 00 fingerprint `318d53c8a8785952d38a173dc086efd1d044c5871e288e305614e52e14a19641`; no evaluator/provider run.

## Requirement Eval

Requirement Eval records source/provenance and contract metrics; reported 100% Recall/Precision/Source Verified in prior checkpoints. Those scores establish performance against the frozen fixture/ruler, not human-truth completeness. Missing authoritative packets for JY-001, TB-003 and FAST-04 prevent a six-tender source-universe claim.

## Mapping/Claim denominator isolation

Governance artifacts separate REAL, SYNTHETIC, ENGINEERING/FIXTURE and DISPUTED material. Engineering cases (`W-AUTH-RETENTION-001`, `W-IDEMPOTENCY-AUTH-001`) are excluded from Writer semantic denominators. Supplemental duplicate pairs remain auditable but unscored; successor Gold is not frozen. This prevents synthetic/engineering leakage, although promotion remains process-gated.

## Mutation sensitivity

Existing harness/tests prove source-parity mutation fails, altered support/dimension output fails schema/semantic checks, duplicate identity is detected, and stale identity is rejected. The checks are deterministic and do not rely on a single aggregate accuracy number.

## Evaluator identity/provenance

Gateway/eval artifacts record contract/version, evaluator revision or instruction hash, provider/model where applicable, source provenance and Gold version. Certification is incomplete for a trusted Real Mapping/Claim semantic ruler because authoritative source packets and frozen human case-level labels are incomplete; prior known full-backend failures include missing Gold/source artifact paths.

## Verdict

`EVAL_RULER_TRUST = STRONG_WITH_DEBT` for deterministic gates and denominator isolation; **not certified** for Real semantic Gold or human-truth claims.

## Required fields

**FILES_INSPECTED:** `docs/EVAL_POLICY.md`, Requirement Eval harness/checkpoints, mapping Gold governance harness/successor checkpoints, mutation tests, source-role and provider-fidelity tests.  
**CODE_PATHS_CONFIRMED:** metric calculation, source parity gate, mutation sensitivity, dataset classification and evaluator identity projection.  
**TABLES_CONFIRMED:** eval-only manifests/packets; no production truth writes.  
**TESTS_INSPECTED:** `gold-governance-harness`, source packet parity, mapping/claim eval, requirement extraction live harness tests.  
**CONFIRMED_FACTS:** deterministic semantic mutations fail; engineering/fixture denominator is separated; aggregate metrics are not human truth.  
**CONFLICTING_FACTS:** historical “PASS” labels coexist with incomplete source packets and known missing-artifact failures.  
**UNKNOWN_AREAS:** Real Mapping/Claim Gold semantic accuracy.  
**LOCAL_ONLY_FACTS:** no external evaluator invoked.  
**P0_RISKS:** P0-GOLD-001 if incomplete artifacts were promoted; current governance prevents promotion.  
**P1_RISKS:** P1-EVAL-001 ruler lineage/certification debt; P1-REQ-001 source artifact drift.  
**P2_RISKS:** duplicated checkpoints and path-sensitive fixtures.  
**TECH_DEBT:** no single evaluator registry across all suites.  
**ARCHITECTURE_DRIFT:** score labels can outpace artifact completeness.  
**NEXT_DEPENDENCY:** Phase 10 Gold enforcement.

**SAFE_TO_CONTINUE:** YES.
