# V43 Requirement Re-extraction Candidate Packet

`artifact_type=REQUIREMENT_REEXTRACTION_CANDIDATE_PACKET`，仅为 Eval/人审准备，不是 Requirement Gold。未调用 Provider、未写数据库、未分配正式 REQ-ID、未创建 Mapping。

## Source authority

| tender_id | source_file | source_sha256 | source identity |
| --- | --- | --- | --- |
| JY-001 | `backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf` | `bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145` | `CONFIRMED_RAW_SOURCE_IDENTITY` |
| TB-003 | `backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf` | `bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1` | `CONFIRMED_RAW_SOURCE_IDENTITY` |
| FAST-04 | `backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf` | `7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce` | `CONFIRMED_RAW_SOURCE_IDENTITY` |

## Candidate review envelopes

### JY-001

- candidate_requirements: 193 条，完整记录复用 `backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json` 中 JY-001 的 `candidate_requirements`。
- requirement_category 分布：technical 151、contractual 19、implementation 9、delivery 8、context 6。
- source_span: 193/193 有 page/paragraph span；source_span_hash 193/193 有记录。
- source_excerpt: 0/193；既有 artifact 的 `exact_source_text` 全部为 null，状态 `NOT_CAPTURED_IN_HISTORICAL_ARTIFACT`。本包不从模型或历史摘要补写原文；Human 必须回看 PDF cited span。
- candidate_confidence: 0/193；现有 artifact 未提供 confidence，保持 null，不由 match type 推导。
- requires_human_review: 193/193。
- review_required_fields: exact PDF excerpt、span/text 一致性、confidence、ambiguity/conflict、正式 Requirement authority、REQ-ID/Gold eligibility。

### TB-003

- candidate_requirements: 0。
- source_excerpt: null；当前仅有 raw source identity，未发现 historical packet 或 source index。
- candidate_confidence: null；无 candidate 可评估。
- requires_human_review: true（在获得授权 source packet 或人工 reconstruction 后）。
- review_required_fields: candidate requirement、exact source span/text、confidence、Human Authority decision。
- blocker: `NO_HISTORICAL_PACKET_OR_SOURCE_INDEX`；本轮不自动调用 Provider、不自动 re-extract。

### FAST-04

- candidate_requirements: 0。
- source_excerpt: null；当前仅有 raw source identity，未发现 historical packet 或 source index。
- candidate_confidence: null；无 candidate 可评估。
- requires_human_review: true（在获得授权 source packet 或人工 reconstruction 后）。
- review_required_fields: candidate requirement、exact source span/text、confidence、Human Authority decision。
- blocker: `NO_HISTORICAL_PACKET_OR_SOURCE_INDEX`；本轮不自动调用 Provider、不自动 re-extract。

## Boundary

- 193 条 JY-001 记录仍是 candidate/reconstruction evidence，不是 authoritative Requirement。
- TB-003、FAST-04 未凭空生成 candidate；raw PDF 存在不等于已有语义 extraction 结果。
- 不生成 Gold、不冻结 REQ-ID、不修改 Requirement contract/canonical schema。
