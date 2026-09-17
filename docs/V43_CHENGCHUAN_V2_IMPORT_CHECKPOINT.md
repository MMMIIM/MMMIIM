# V43 CHENGCHUAN V2 IMPORT CHECKPOINT

Status: `IMPORT_COMPLETE_FACT_EXTRACTION_PARTIAL_WITH_FAILURES`

- Existing COM materials: 16
- Extension materials: 76
- Expected isolated Eval total: 92
- Matrix coverage: 34/34
- ZIP/file SHA validation: PASS
- Requirement leakage in extension manifest: 0
- Residual Xinglan references: 0
- Document ID collisions: 0
- Authority: `SYNTHETIC_DEVELOPMENT_ONLY`
- Eval mode: `CONTROLLED_REAL_TEST`
- Provider calls: 140 (hard cap reached)
- Fact candidates: 5; controlled approved: 5; review required: 91
- Eval DB writes: 92-material import plus Eval-only review/retrieval context
- Production DB writes: 0

Requirement-blind extraction: PASS. Downstream canonical Requirement baseline:
`SIX_TENDER_CANONICAL_1009` (mapping input ready; mapping actions: 0).
Fact extraction completed only partially because the provider call cap was reached;
remaining windows are retained as review-required failures in the quality audit.
