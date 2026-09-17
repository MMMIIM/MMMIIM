# V43 P0 487 Semantic Adjudication V2

Status: **GPT semantic adjudication complete; Human freeze pending**

## Identity
- Source Truth: `GPT_SOURCE_TRUTH_P0_CORE6_V1`
- Source Truth SHA256: `sha256:9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0`
- Production run: `V43-CORE6-20260911`
- R3 Eval run: `V43-FLYWHEEL-P0-487-R3`
- Review bundle SHA256: `867965a6f2e0b1568278a62c05316b16bcb1b1dfd09e01705020f4b51d240a2d`

## Result
| Label | Count |
|---|---:|
| MATCH | 443 |
| PARTIAL | 7 |
| DISTORTED | 6 |
| MISS | 31 |
| Total | 487 |

- Strict P0 Recall: **90.97%**
- Outright Miss Rate: **6.37%**
- Critical Escape: **44 / 487 = 9.03%**

## Post-hoc parity
- Historical aggregate: `{'MATCH': 443, 'PARTIAL': 7, 'DISTORTED': 6, 'MISS': 31}`
- V2 aggregate: `{'MATCH': 443, 'PARTIAL': 7, 'DISTORTED': 6, 'MISS': 31}`
- Aggregate parity: **PASS**
- Tender-level unsafe-count parity: **PASS**
- Per-row parity to V1: **UNVERIFIABLE_NO_V1_ROW_LEDGER**

Historical aggregate was not used as a row-label constraint. The review packet itself was blind, but the adjudicator had project-history context; therefore this is not claimed as a fully independent second-judge blind study.

## Special review note
`FAST-WATER-01-P0-0072` remains `DISTORTED` against the frozen Source Truth (`0次/年`), while the source table itself contains an internal cycle conflict (`次数/年` vs `平均每季度`). This is preserved as `source_internal_conflict=true`; Gold is not silently changed.

## Authority
- Semantic label author: GPT
- Human Gold authority: **PENDING_USER_APPROVAL**
- Codex semantic labels: 0
