# V43 Chengchuan Controlled Real Fact Checkpoint

- status: PARTIAL_WITH_FAILURES
- materials: 92
- processed: 1
- failed: 91
- provider calls: 140
- provider failures (HTTP 4xx/5xx): 120 (all 422 schema/transport responses)
- fact candidates: 5
- usable facts: 5
- controlled approved facts: 5
- fact review required: 91
- rejected facts: 0
- matrix themes with usable Fact: `U20`
- matrix themes with zero usable Fact: `U01`–`U19`, `U21`–`U34` (33 themes)
- median usable Facts per U01–U34 theme: 0
- source traceability: 100%; source span mismatch: 0
- numeric/entity/status-validity mismatches: 0/0/0
- requirement-blind extraction: PASS
- downstream requirement baseline: `SIX_TENDER_CANONICAL_1009` (mapping input ready; mapping actions: 0)
- Eval DB writes: permitted and isolated; Production DB writes: 0
- Gold mutations: 0; Claim/Writer actions: 0; synthetic-to-production escalation: 0
- production DB writes: 0
- gold mutations: 0
- mapping/claim/writer actions: 0

Final status: `FACT_INVENTORY_PARTIAL_WITH_FAILURES`; not ready for GPT
assessment or downstream Mapping. Failed windows remain review-required and
their safe error classifications are retained in the quality audit.
