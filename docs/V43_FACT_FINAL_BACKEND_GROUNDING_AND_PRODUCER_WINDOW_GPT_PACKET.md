# V43_FACT_FINAL_BACKEND_GROUNDING_AND_PRODUCER_WINDOW_GPT_PACKET

- mode: OFFLINE_DETERMINISTIC
- source run: fact-v21-fixed12-20260908110957-e4f158f6
- observations: 50

## Backend grounding

- critical false accepts after: 0
- confirmed false rejects after: 0
- COM-12 grounded: 7/7
- COM-12 enterprise eligible: 2
- COM-12 reference excluded: 1
- COM-12 governance excluded: 4
- reference authority escape: 0
- governance authority escape: 0

## Producer windows

### COM-07
- windows: 6
- cross-heading body leakage: 0
- COM-07-WINDOW-001: 性能与容量测试报告; body_sha256=8cd497a43fb799377252d9dc42393cb7a5ba005f392fd56753a89a6f79f0ec1c
- COM-07-WINDOW-002: 性能与容量测试报告 > 环境; body_sha256=ac61395f76765144e56b91510f1b5dd60c2c55ec1002aad91ed73cdc80445f34
- COM-07-WINDOW-003: 性能与容量测试报告 > 结果; body_sha256=af6d5d8c9e9f5ae7cbd8ee3e107fd3e4736b69dd7babedc0f5053076533cb291
- COM-07-WINDOW-004: 性能与容量测试报告 > 时效; body_sha256=859c6b070be8a0c30d68161dc9df8ecfde4505bf4db2c097d8010c2ef22639b5
- COM-07-WINDOW-005: 性能与容量测试报告 > 官方来源 / 依据; body_sha256=5204be690588383f7c63135198829c1e5700b9c6b04eec2a241108187a70ad07
- COM-07-WINDOW-006: 性能与容量测试报告 > 时效使用规则; body_sha256=e5a8d616daadb1e2a308231026a4f1f9e51e6b9bfe05134137339f498f3465c8

### COM-08
- windows: 5
- cross-heading body leakage: 0
- COM-08-WINDOW-001: 备份恢复与容灾演练记录; body_sha256=af96196a9bc862a360944959c7539c65960c5595bbdb488e900ca478d40e79db
- COM-08-WINDOW-002: 备份恢复与容灾演练记录 > 演练; body_sha256=c122e8cbdb20dd92ae254cb1751add7f01132ec5534ad4ec60e48b531934723d
- COM-08-WINDOW-003: 备份恢复与容灾演练记录 > 边界; body_sha256=d5edb4f61d57df0fbe95a6368e617eb898732a517a0031722d6b8cffecdcfe21
- COM-08-WINDOW-004: 备份恢复与容灾演练记录 > 官方来源 / 依据; body_sha256=5d4a89188c78de8f9f9202c6b442f26095b01770d8044b95a2a70da4f3c9fa49
- COM-08-WINDOW-005: 备份恢复与容灾演练记录 > 时效使用规则; body_sha256=c5a5b995dfdf2c242260f24b7758861ec28275dfcc5a80626feec87e038be9cd

## Frozen boundaries

- Prompt change: 0
- Schema change: 0
- Provider calls: 0
- Production DB writes: 0
- Fact persistence: 0
- Gold mutations: 0

- Fact backend: READY_FOR_GPT_FINAL_GROUNDING_ADJUDICATION
- Fact producer input window: READY_FOR_GPT_WINDOW_BOUNDARY_ADJUDICATION
