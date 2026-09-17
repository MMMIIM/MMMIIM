# V43 RAG Reference Hygiene + MMR Challenger V1

- Status: `READY_FOR_GPT_REFERENCE_STRATEGY_AB_ADJUDICATION`
- Reference denominator: A01-A30 (30); A31-A40 deferred to Evidence Retrieval lane.
- Captured source: backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json (7fde0c5434718a238ba74301dae001ffc82089d3af86f6dba3a017ec68c77d42)
- Strategies: A current baseline, B hygiene-only, C bounded material diversity, D MMR 0.9 challenger.
- MMR note: raw embedding vectors are not stored; D is a deterministic lexical redundancy proxy, not a production MMR implementation.
- GPT packet: 30 cases, semantic labels created: 0.
- Side effects: Provider/LLM/DB/Gold/Fact/Mapping/Claim/Writer actions all 0.

## Mechanical strategy aggregates

```json
{
  "A": {
    "case_count": 30,
    "top4_rows": 120,
    "heading_count_top4": 2,
    "citation_index_like_count_top4": 23,
    "substantive_count_top4": 120,
    "expected_doc_hit_at_4_count": 28,
    "expected_doc_hit_at_4_rate": 0.9333333333333333,
    "max_same_material_count": 4,
    "mean_same_material_max_count": 1.6333333333333333,
    "mean_unique_material_count": 3.2666666666666666,
    "semantic_labels_created": 0
  },
  "B": {
    "case_count": 30,
    "top4_rows": 120,
    "heading_count_top4": 2,
    "citation_index_like_count_top4": 0,
    "substantive_count_top4": 120,
    "expected_doc_hit_at_4_count": 27,
    "expected_doc_hit_at_4_rate": 0.9,
    "max_same_material_count": 2,
    "mean_same_material_max_count": 1.4666666666666666,
    "mean_unique_material_count": 3.5,
    "semantic_labels_created": 0
  },
  "C": {
    "case_count": 30,
    "top4_rows": 120,
    "heading_count_top4": 2,
    "citation_index_like_count_top4": 0,
    "substantive_count_top4": 120,
    "expected_doc_hit_at_4_count": 27,
    "expected_doc_hit_at_4_rate": 0.9,
    "max_same_material_count": 2,
    "mean_same_material_max_count": 1.4666666666666666,
    "mean_unique_material_count": 3.5,
    "semantic_labels_created": 0
  },
  "D": {
    "case_count": 30,
    "top4_rows": 120,
    "heading_count_top4": 2,
    "citation_index_like_count_top4": 0,
    "substantive_count_top4": 120,
    "expected_doc_hit_at_4_count": 27,
    "expected_doc_hit_at_4_rate": 0.9,
    "max_same_material_count": 2,
    "mean_same_material_max_count": 1.4666666666666666,
    "mean_unique_material_count": 3.5,
    "semantic_labels_created": 0
  }
}
```

## Boundary

Reference-only material remains context-only. No strategy was promoted and no production behavior changed.

READY_FOR_GPT_REFERENCE_STRATEGY_AB_ADJUDICATION
