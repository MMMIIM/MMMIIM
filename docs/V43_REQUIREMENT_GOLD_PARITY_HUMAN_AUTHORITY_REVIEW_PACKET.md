# V43 Requirement Gold Parity — Human Authority Review Packet

这是 Eval-only、blind、非权威的 Human Authority 审核包索引。它复用现有 `REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET`，不生成新的 Gold 类型，不分配正式 REQ-ID，不执行 promotion。

## Packet boundary

- source candidate artifact: `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json`
- source candidate Markdown: `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.md`
- source manifest/census: `backend/eval/tender-benchmark-v1/reports/tender-benchmark-pilot-census-v1.json`
- all records remain `PENDING_HUMAN_AUTHORITY`; historical text is reconstruction evidence only。
- 本包不显示任何旧 expected、Provider result 或 Gold decision。

## Tender review envelopes

### JY-001

- source_file: `backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf`
- source_hash: `bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145`
- candidate_requirements: 193 条，完整明细及 `candidate_id`、历史 requirement text、source span、source span hash 见现有 blind packet 的 `tenders[0].candidate_requirements`。
- source_span: 193/193 有记录；source span hash 193/193 有记录。
- source_excerpt: `null`；现有历史 artifact 的 `exact_source_text` 为 0/193，状态 `NOT_CAPTURED_IN_HISTORICAL_ARTIFACT`。Human 必须回看上述 PDF 的 cited span，不得由本包补写或推测原文。
- candidate_confidence: `null`；现有 reconstruction artifact 未提供该字段，不能从历史 match type 推导 confidence。
- review_required_fields: `formal_requirement_id`、`authority_decision`、逐条 PDF source excerpt 核验、candidate confidence、source span 与 requirement text 一致性、ambiguity/conflict 处理、是否纳入 Requirement Gold。

### TB-003

- source_file: `backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf`
- source_hash: `bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1`
- candidate_requirements: 0；现有 artifact 没有历史 Requirement packet 或 source index。
- source_excerpt: `null`；当前仅确认 raw source identity，未生成候选摘录。
- candidate_confidence: `null`；没有 candidate 可评估。
- review_required_fields: `source packet 或经授权的 manual reconstruction`、candidate requirement、exact source span/text、confidence、Human Authority decision。不得在本包内自动 re-extract。

### FAST-04

- source_file: `backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf`
- source_hash: `7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce`
- candidate_requirements: 0；现有 artifact 没有历史 Requirement packet 或 source index。
- source_excerpt: `null`；当前仅确认 raw source identity，未生成候选摘录。
- candidate_confidence: `null`；没有 candidate 可评估。
- review_required_fields: `source packet 或经授权的 manual reconstruction`、candidate requirement、exact source span/text、confidence、Human Authority decision。不得在本包内自动 re-extract。

## Human review stop condition

任何字段缺失都保持 pending；Human Authority 需要先补足 source excerpt 与 authority decision，之后才可讨论 source parity 或 Gold promotion。本包不改变既有 Requirement Gold、Canonical Requirement、Production 或数据库。
