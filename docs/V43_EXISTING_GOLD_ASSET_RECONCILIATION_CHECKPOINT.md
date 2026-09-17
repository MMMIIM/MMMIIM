# V43_EXISTING_GOLD_ASSET_RECONCILIATION_CHECKPOINT

只读资产核对，生成于 2026-09-05T12:13:20.0972601Z。未调用 Provider，未写入数据库，未修改 Production 或 Gold 数据集。

## Git 状态

- branch: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- worktree: dirty（审计开始时 `git status --short` 为 183 条；均作为既有工作树状态保留）

## Requirement Gold

权威来源包清单 `backend/eval/requirement-extraction-real-tender-pilot-v1/manifest.json` 标记为 `GPT_GOLD_REVIEWED`、`gold_frozen=true`，包含 3 个 tender、162 条 Gold Requirement：

| Tender | packet | gold cases | source parity / authority |
| --- | --- | ---: | --- |
| FAST-01 | `packets/FAST-01.json`; `gpt-reviewed/FAST-01.gold-reviewed.json` | 39 | A / authoritative recovered |
| FAST-WATER-01 | `packets/FAST-WATER-01.json`; `gpt-reviewed/FAST-WATER-01.gold-reviewed.json` | 80 | A / authoritative recovered |
| TB-006 | `packets/TB-006.json`; `gpt-reviewed/TB-006.gold-reviewed.json` | 43 | A / authoritative recovered |

六 tender source universe 还登记 JY-001、TB-003、FAST-04；三者均为 `B_HUMAN_RECONSTRUCTION_POSSIBLE`。`REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.{json,md}` 含 3 个 reconstruction candidate，但明示不提升为 Authoritative/Gold。`requirement-source-foundation-checkpoint.json` 的 parity gate 为 `FAIL_MISSING_AUTHORITATIVE_PACKETS`；因此 Requirement Gold 为部分就绪，未达到六 tender authoritative parity，未发生 Gold V2 promotion。

## Fact Gold / Fact fixtures

| 类别 | 数量/状态 | 来源文件 | 可用于 Eval |
| --- | --- | --- | --- |
| Real Fact Gold | 0 个 eligible；`eligible_count=0`、`candidate_count=7`、`rejected_count=7` | `backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.json`; `.../REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json`; `backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-real-enterprise-source-manifest.json` | 否；仅可作 source/rejection audit，不能作 Real Fact Gold |
| Boundary Fact | 非独立 Real Gold；Mapping synthetic boundary 29 cases | `backend/eval/requirement-evidence-mapping-v2/synthetic-boundary-gold-v2.json` | 是，`REPRESENTATIVE_SYNTHETIC` boundary Eval-only |
| Negative Fact | 无单独 canonical Gold 数据集；由 evidence sufficiency / targeted regression 控制案例承载 | `backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_EVIDENCE_SUFFICIENCY_OFFLINE_V3_1.json`; `targeted-evidence-bearing-regression-v2.json`; Claim quality cases | 是，控制/回归 Eval-only；不是 Real Fact Gold |
| Synthetic Fact fixture | L3 synthetic 17 materials、6 controlled cases；Representative SME 20 materials，事实文件含 company 2/product 2/performance 1/compatibility 4/qualification 3/project 4/personnel 3/service 2 | `backend/eval/corpus/l3-synthetic-enterprise/manifest.json`; `backend/eval/corpus/representative-sme/representative-sme-corpus-manifest-v1.json`; `representative-sme-facts-v1.json` | 是，隔离的 synthetic/representative Eval-only |

结论：`REAL_FACT_GOLD_STATUS=NOT_ESTABLISHED (0 eligible)`；现有 boundary/negative/synthetic 资产不能升级为 Real Fact Gold。

## Mapping Gold

- Active immutable V1：`backend/eval/requirement-evidence-mapping-v1/gold-cases.json`，36 cases，contract `requirement-evidence-mapping-v1.1`，human-authored-static。每 case 有 1 个 `fact_ref`（合计 41 facts），没有单独的 `evidence_ref` 字段；映射证据引用通过 Fact identity 表达。
- V2 successor（未激活/未冻结）：
  - `real-derived-gold-v1.json`: 12 cases，12/12 `scored=true`，12/12 `review_status=ACCEPTED`、`human_authority.pool_status=ACCEPT_FOR_GOLD_POOL`；14 fact records、6 distinct fact refs、3 distinct source refs。
  - `synthetic-boundary-gold-v2.json`: 29 cases，29 scored，`SYNTHETIC_BOUNDARY_GOLD`。
  - `engineering-fixtures-v2.json`: 6 cases，`scored=false`，`ENGINEERING_FIXTURE`。
  - `disputed-cases-v2.json`: 1 case，`scored=false`，`DISPUTED_CASE`。
  - `synthetic-corrections-v1.json`: 6 correction records，`production_contract_changed=false`。
- V1 expected decision labels：`direct_full`、`partial_support`、`related_reference`、`related_insufficient`、`unrelated`、`conflict`、`unknown`；V2 uses the same contract projection. V2 real-derived authority is human-adjudication/source-packet based, but successor manifest states no Production import and no Gold V2 activation.
- Mapping source/authority artifacts：`backend/eval/gold-human-review/v2/01_mapping_real_source_packet.{json,md}`、supplemental packets、`backend/eval/requirement-evidence-mapping-v2/successor-manifest.json`。来源包与 authority/review 状态分离，不能当作已冻结 Gold V2。

结论：`MAPPING_GOLD_STATUS=V1_36_CASES_PRESENT; V2_SUCCESSOR_PRESENT_NOT_FROZEN`。

## Claim / Writer Gold

### Claim

- Semantic Claim quality source parity：`backend/eval/gold-human-review/v2/claim/01_claim_quality_source_parity_report.md`，dataset `claim-quality-gold-v1-2026-09-02`，24 canonical cases / 24 rendered cases，`parity_status=PASS`；expected/provider/production 字段未进入 blind source packet。
- Fast Claim Eval 结果：`backend/eval/claim-eval-v1/results/claim-eval-v1-1788405131826.json`，quality 24 cases scored；另有 60-case legacy source slice（6 approved seeds、54 pending）只作来源审计，不作新的 Gold authority。
- Real claim source packet：`backend/eval/gold-human-review/v2/claim/02_claim_real_source_packet.json`，source-only 60 candidates、selected 12；不等于已冻结 Claim Gold V2。

### Writer

- Provider-off source/fixture：`backend/eval/gold-human-review/v2/writer/00_writer_gold_v2_source_manifest.md`、`01_writer_source_authority_inventory.md`、`02_writer_provider_fidelity_source_packet.json`；provider fidelity 明确为 `NOT_ESTABLISHED`，source candidates 12。
- Provider-off foundation checkpoint：`backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json`：semantic cases 15，engineering cases 2；engineering regression 不进入 semantic denominator；source-role boundary 6 cases 均有 deterministic outcome。

结论：`WRITER_GOLD_STATUS=SOURCE_PACKET_PRESENT_PROVIDER_FIDELITY_NOT_ESTABLISHED`；不能据此声明 Writer Provider Fidelity Gold 或生产就绪。

## Engineering Regression

已存在并可复用的 contract/regression 资产包括：

- `backend/test/canonical-requirements-v1.test.js`
- `backend/test/real-fact-v2-foundation.test.js`
- `backend/test/mapping-eval-v1.test.js`
- `backend/test/mapping-gold-v2-successor.test.js`
- `backend/test/claim-eval-v1.test.js`
- `backend/test/claim-gate-v2-contract.test.js`
- `backend/test/writer-eval-provider-off-foundation.test.js`
- `backend/test/writer-authority-p0.test.js`
- `backend/test/writer-authorization-snapshot.test.js`
- `backend/test/gold-governance-harness.test.js`
- `backend/test/gold-v2-foundation-orchestrator.test.js`
- `backend/eval/gold-governance/gold-governance-harness-v1.js`
- `backend/eval/gold-governance/gold-v2-foundation-orchestrator.js`
- `backend/eval/gold-governance/claim-writer-gold-v2-harness.js`

Track A checkpoint `backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json` 记录 NC02–NC05、canonical Mapping/Claim/Writer authorization regression PASS；同时记录 14 个 pre-existing unrelated unit failures。工程回归 fixture 与 semantic Gold 分母分离。

结论：`ENGINEERING_GOLD_STATUS=PRESENT/PASS_FOR_DETERMINISTIC_CONTRACTS_WITH_PRE_EXISTING_UNRELATED_FAILURES`。

## Required status fields

```text
REQUIREMENT_GOLD_STATUS = PARTIAL/BLOCKED_FOR_AUTHORITATIVE_PARITY
REAL_FACT_GOLD_STATUS = NOT_ESTABLISHED (REAL_FACT_V2 eligible=0)
BOUNDARY_GOLD_STATUS = PRESENT_SYNTHETIC_EVAL_ONLY
NEGATIVE_GOLD_STATUS = PRESENT_CONTROL_FIXTURES_NOT_STANDALONE_GOLD
MAPPING_GOLD_STATUS = V1_36_CASES_PRESENT; V2_SUCCESSOR_PRESENT_NOT_FROZEN
WRITER_GOLD_STATUS = SOURCE_PACKET_PRESENT_PROVIDER_FIDELITY_NOT_ESTABLISHED
ENGINEERING_GOLD_STATUS = PRESENT/PASS_FOR_DETERMINISTIC_CONTRACTS_WITH_PRE_EXISTING_UNRELATED_FAILURES
```

## Gaps only

1. 三个 B 类 tender 尚无 Human-authorized authoritative Requirement packet；六 tender parity 未通过。
2. Real Enterprise Fact V2 eligible candidates 为 0；现有四份 enterprise source 仍在 quarantine/pending human source authority。
3. Mapping Gold V2 successor 尚未激活/冻结；disputed 与 engineering partitions 不得并入 semantic denominator。
4. Writer Provider Fidelity Gold 尚未建立；现有 Writer 结果是 provider-off deterministic foundation。
5. Track A checkpoint 记录 14 个 pre-existing unrelated unit failures；它们不是本审计产生的 Gold 资产，也未在本轮修复。

本轮未新增 Gold、未修改 Production、未修改数据库/迁移、未调用 Provider；仅生成本审计 checkpoint 文件。
