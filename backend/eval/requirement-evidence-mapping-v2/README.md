# Mapping Eval Suite v2

`mapping-eval-suite-v2` is the successor evaluation snapshot for Mapping Gold V2 governance. It is Eval-only: it does not import Gold into Production, call a Provider, or write to the database.

## Partitions

| Dataset | Cases | Scored | Purpose |
| --- | ---: | ---: | --- |
| `real-derived-gold-v1.json` | 12 | 12 | Human-authorized real-derived semantic cases selected after source-parity and novelty review |
| `synthetic-boundary-gold-v2.json` | 29 | 29 | Representative synthetic semantic boundary cases with only approved expectation corrections |
| `engineering-fixtures-v2.json` | 6 | 0 | Deterministic persistence, identity, isolation, and batch regressions; excluded from semantic denominator |
| `disputed-cases-v2.json` | 1 | 0 | Auditable unresolved semantic case; excluded from scoring |

The former active dataset `backend/eval/requirement-evidence-mapping-v1/gold-cases.json` remains immutable. Its SHA-256 is recorded in `successor-manifest.json`; the successor has distinct dataset identities and hashes.

## Authority and provenance

Real-derived cases project the restored case-level human adjudication and the corrected source rendering. `REAL-MAP-SUPP-007` remains an accepted but unscored redundant stability case; it is not projected as a disputed semantic case. `REAL-MAP-SUPP-009` and `REAL-MAP-SUPP-010` are the two supplemental cases selected as novel scored cases.

The source packet, corrected Markdown rendering, Batch01 authority record, and supplemental authority record remain separate artifacts. No expected answer, Provider output, or production Mapping result is included in a blind human-review packet.

## Synthetic corrections

`synthetic-corrections-v1.json` records the six human-approved expected-answer deltas. Each delta is marked `production_contract_changed: false`. `MAP-G028` stays an engineering fixture because it verifies deterministic batch splitting and Fact retention rather than semantic Mapping quality. `MAP-G032` stays disputed because its third-party delivery boundary remains unresolved.

## Scoring and release boundary

Semantic reporting must keep REAL_DERIVED_GOLD and SYNTHETIC_BOUNDARY_GOLD separate from ENGINEERING_FIXTURE and DISPUTED_CASE. Do not collapse the partitions into a single accuracy denominator. Dual evaluation is explicitly `NOT_EXECUTED` because no trusted frozen full prediction snapshot exists for the prior run.

The successor is ready for deterministic Eval development only. It does not authorize Mapping Semantic Live, Production import, or Production readiness.
