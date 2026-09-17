# Gold V2 Source Manifest — Mapping Real Source Packet

This manifest registers the deterministic, blind source packet for Gold V2
human adjudication. It is source inventory, not an answer key. No Provider was
called and no production business state was written.

## Manifest contract

```json
{
  "packet_version": "mapping-real-source-packet-v1",
  "created_from_branch": "feat/v4.3-semantic-boundary-routing",
  "baseline_head": "f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e",
  "candidate_count": 24,
  "source_project_count": 1,
  "requirement_count": 24,
  "fact_count": 6,
  "fact_occurrence_count": 26,
  "domain_distribution": {
    "functionality": 4,
    "project_case": 1,
    "interface": 5,
    "performance_capacity": 6,
    "domestic_os_environment_compatibility": 3,
    "deployment": 1,
    "qualifications": 2,
    "ops_service": 0,
    "data_governance": 1,
    "product_device": 0,
    "implementation": 1
  },
  "real_source_resolvable_count": 24,
  "excluded_candidate_count": 0,
  "excluded_reasons": [],
  "contains_expected_labels": false,
  "contains_provider_results": false,
  "contains_production_mapping_results": false,
  "provider_calls": 0,
  "production_writes": 0,
  "packet_json_sha256": "5ca994228f7d4bfedb61aed0c0aac5ef5cf0b284aa573c7732ce4383ecde4acb"
}
```

`packet_json_sha256` is filled from the canonical UTF-8 JSON serialization
after this file is created; it covers the packet JSON only and does not create
a circular manifest hash.

## Source inventory

The packet draws from one public tender parse record and four public-source
materials associated with the demonstration enterprise “东软集团公开资料
Demo”. The demonstration label is a data boundary, not a customer claim.

| material | type | authority | packet role |
| --- | --- | --- | --- |
| `neusoft-smart-city.md` | `company_profile` | `corporate_primary` | retained source inventory; no approved fact projection available |
| `neusoft-system-integration.md` | `product_documentation` | `corporate_primary` | approved integration/capability fact projections |
| `neusoft-qualifications.md` | `qualification` | `corporate_primary` | approved qualification fact projection |
| `ccgp-neusoft-project.md` | `project_case` | `government_official` | approved procurement/award fact projections |

Requirements use the public tender’s persisted source range and hash. Facts
use approved/current `evidence_facts` rows plus their material/chunk lineage,
source range, and source hash. The packet does not copy any Mapping decision,
support level, expected answer, or provider result.

## Coverage and limitations

The 24 candidates intentionally cover functionality/context, project/case,
interface integration, quantitative performance, compatibility, deployment,
qualification/security, data governance, delivery, and implementation
boundaries. The current source corpus has no approved fact projection from the
smart-city profile and no performance measurement fact; those are retained as
explicit corpus gaps rather than inferred capabilities. A candidate can
therefore be source-resolvable while still requiring a human “insufficient”
assessment.

No candidate is synthetic-only, cross-project, or source-less. If a future
review identifies a missing, ambiguous, stale, or otherwise unresolvable
source, it must move to `REJECTED_SOURCE_CANDIDATES` with one of the fixed
reasons: `MISSING_REQUIREMENT_PROVENANCE`, `MISSING_FACT_PROVENANCE`,
`AMBIGUOUS_SOURCE`, `SYNTHETIC_SOURCE`, `STALE_OR_UNAPPROVED_FACT`,
`CROSS_PROJECT`, or `OTHER`.

## Integrity checkpoint

* source resolvability: `PASS` (24/24 requirement and fact references carry
  persisted IDs and SHA-256 hashes)
* blind-label contamination: `PASS` (forbidden answer/result keys absent)
* synthetic-only contamination: `PASS` (0)
* cross-project leakage: `PASS` (0)
* Provider calls: `0`
* production writes: `0`
* legacy Gold files: unchanged; hashes are verified independently

The packet is intentionally dirty-worktree output for the current task. No
stage, commit, push, merge, reset, clean, or stash operation is part of this
checkpoint.
