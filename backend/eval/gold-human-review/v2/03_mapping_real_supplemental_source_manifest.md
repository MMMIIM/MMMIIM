# Mapping Gold V2 — Supplemental Real Source Manifest

## Packet and scope

- packet_version: `mapping-real-supplemental-source-packet-v1`
- parent_packet_version: `mapping-real-source-packet-v1`
- parent_packet_sha256: `5ca994228f7d4bfedb61aed0c0aac5ef5cf0b284aa573c7732ce4383ecde4acb`
- dataset_namespace: `REAL_DERIVED_GOLD_CANDIDATE_SUPPLEMENTAL`
- data_classification: `REAL_PUBLIC_DERIVED`
- created_from_branch: `feat/v4.3-semantic-boundary-routing`
- baseline_head: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- upstream gate: `MAPPING_REAL_GOLD_UPSTREAM_ELIGIBILITY_GATE`
- packet_json_sha256: `a3a0c1abb4f98eef4d77fd120f4d4e47639fa1680a1a17139c65077756032bd0`

## Counts

- candidate_count: **10**
- unique requirement_count: **10**
- unique fact_count: **6**
- fact_occurrence_count: **12**
- source_material_count: **4**
- source_project_count: **1**
- real_source_resolvable_count: **10**
- excluded_candidate_count: **0**

## Domain distribution

```json
{
  "interface": 3,
  "compatibility": 1,
  "deployment": 1,
  "qualifications": 2,
  "project_case": 1,
  "product_device": 1,
  "implementation": 1
}
```

## Gap status

- DIRECT_FULL_COVERAGE: candidate source characteristics included; human label pending.
- CONFLICT_COVERAGE: no approved/current conflict fact is available in the current corpus; remains a gap.
- UNIQUE_FACT_DIVERSITY: six unique approved/current facts included.
- SOURCE_PROJECT_DIVERSITY: one resolvable public project/tender context; a second context was not available and is not fabricated.
- PERFORMANCE_MEASUREMENT_FACT: no approved/current performance measurement fact is available.
- SOURCE_PROJECT_DIVERSITY_GAP: **true** (one source project only; no padding or cross-project inference).

## Blindness and side effects

- contains expected labels: **false**
- contains Provider results: **false**
- contains Production Mapping results: **false**
- forbidden answer fields: **absent**
- Provider calls: **0**
- production writes: **0**
- Evidence/Fact/Mapping lifecycle writes: **0**

## Admission gate

Before a candidate can enter a scored Mapping Gold denominator, the
evaluation-only `MAPPING_REAL_GOLD_UPSTREAM_ELIGIBILITY_GATE` must confirm:
active/current Canonical Requirement, mapping eligibility, resolvable source
provenance, and sufficient atomicity for independent adjudication. The gate
does not mutate Production Requirement or Mapping state.

The packet is intentionally dirty-worktree output and awaits independent human
adjudication. It does not freeze Gold V2 or authorize live semantic evaluation.
