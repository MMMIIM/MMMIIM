# Gold Full Human Review Manifest

本 Manifest 只描述冻结 Gold authority 与完整人工审查导出；不代表 Gold 质量 PASS。所有源记录均保持原字段，不调用 Eval/Gateway/Provider，不写数据库。

## Authority and counts

| Surface | Runner | Classification | Active/scored | Count | Source |
| --- | --- | --- | ---: | ---: | --- |
| Mapping | backend/eval/mapping-benchmark-v1/mapping-eval-runner.js | HUMAN_AUTHORED_STATIC | yes | 36 | backend/eval/requirement-evidence-mapping-v1/gold-cases.json |
| Claim Quality | backend/eval/claim-eval-v1/runner.js | REPRESENTATIVE_SYNTHETIC | yes | 24 | backend/eval/evidence-gold/claim-quality-cases.js |
| Claim Legacy | backend/eval/claim-eval-v1/runner.js | REAL_PUBLIC_DERIVED_LIVE_PROJECT | no, retained | 60 | backend/eval/evidence-gold/gold-candidates.json |
| Writer Fast Gate | backend/eval/rag-pilot/writer-fast-gate-v1.js | REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA | yes | 8 | backend/eval/rag-pilot/writer-fast-gate-v1.js |

## Frozen identities

```json
{
  "mapping": {
    "schema_version": "requirement-evidence-mapping-v1.1",
    "dataset_version": "requirement-evidence-mapping-v1-gold-2026-09-02",
    "case_count": 36,
    "expected_case_count": 36,
    "source_file": {
      "path": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "sha256": "5a6d9eb7c4e7b23f347da111b5276060375b3de2e07716b9cee88d15d5431707",
      "bytes": 18323
    },
    "validation": "PASS"
  },
  "claim_quality": {
    "dataset_id": "claim-quality-gold-v1-2026-09-02",
    "schema_version": "4.3-claim-quality-v1",
    "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
    "real_customer_data": false,
    "case_count": 24,
    "dataset_sha": "0a3a691fa27afc5ebc2daa4e2c8d327d263ff69b424c248870e13fcbbbe1b3d0",
    "validation": {
      "ok": true,
      "errors": [],
      "case_count": 24,
      "schema_version": "4.3-claim-quality-v1"
    }
  },
  "claim_legacy": {
    "runner": "backend/eval/claim-eval-v1/runner.js",
    "gold_source": {
      "path": "backend/eval/evidence-gold/gold-candidates.json",
      "sha256": "d7151db9420186a9e4f63e72dbe7ebb03f7f3ccea461c92fae1fb5c40581ed12",
      "bytes": 10710
    },
    "review_overlay": {
      "path": "backend/eval/evidence-gold/review/gold-reviews.json",
      "sha256": "8e2ad02ada2ffbbd7109d20dec9d0326e3684ae265259bc683fddcdef11c4322",
      "bytes": 74
    },
    "schema_version": "4.3-evidence-claim-gold-v1",
    "classification": "REAL_PUBLIC_DERIVED_LIVE_PROJECT",
    "real_customer_data": false,
    "retained_by_runner": true,
    "active_scored": false,
    "reason_not_scored": "Current Claim runner retains the 60 Legacy Gold claims as a source slice; only the 24 Claim Quality cases are scored.",
    "case_count": 60
  },
  "writer_fast_gate": {
    "runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
    "gold_source": {
      "path": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "sha256": "8e2d02e4bd18a159738691110607b55fa8a1714daa197f6ec916d5c2b009030e",
      "bytes": 6919
    },
    "contract": "WRITER_FAST_GATE",
    "classification": "REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA",
    "real_customer_data": false,
    "active_scored": true,
    "case_count": 8,
    "provider_fidelity_gold": "NOT_ESTABLISHED",
    "export_json": "backend/eval/gold-human-review/03_writer_gold_full_review.json",
    "export_markdown": "backend/eval/gold-human-review/03_writer_gold_full_review.md"
  }
}
```

## Review boundaries

- Mapping: `gold-cases.json` is the sole 36-case human-authored static authority.
- Claim: the runner scores 24 Claim Quality cases; 60 Legacy Gold claims remain visible but are not scored by that runner.
- Writer: the deterministic Fast Gate is the active 8-case source. `WRITER_PROVIDER_FIDELITY_GOLD = NOT_ESTABLISHED`.
- Regression/support fixtures are listed separately and never counted as Gold.
- No real-customer Gold is included in this export.

## Integrity findings

```json
{
  "duplicate_case_ids": {
    "mapping": [],
    "claim_quality": [],
    "claim_legacy": [],
    "writer_fast_gate": [],
    "across_exports": []
  },
  "missing_rationale_or_review_note": {
    "mapping_active_cases": [
      "MAP-G001",
      "MAP-G002",
      "MAP-G003",
      "MAP-G004",
      "MAP-G005",
      "MAP-G006",
      "MAP-G007",
      "MAP-G008",
      "MAP-G009",
      "MAP-G010",
      "MAP-G011",
      "MAP-G012",
      "MAP-G013",
      "MAP-G014",
      "MAP-G015",
      "MAP-G016",
      "MAP-G017",
      "MAP-G018",
      "MAP-G019",
      "MAP-G020",
      "MAP-G021",
      "MAP-G022",
      "MAP-G023",
      "MAP-G024",
      "MAP-G025",
      "MAP-G026",
      "MAP-G027",
      "MAP-G028",
      "MAP-G029",
      "MAP-G030",
      "MAP-G031",
      "MAP-G032",
      "MAP-G033",
      "MAP-G034",
      "MAP-G035",
      "MAP-G036"
    ],
    "claim_quality_active_cases": [
      "CQ-STRONG-SSO",
      "CQ-STRONG-INTERFACE",
      "CQ-STRONG-PERFORMANCE",
      "CQ-STRONG-QUALIFICATION",
      "CQ-NARROW-SSO",
      "CQ-NARROW-LDAP",
      "CQ-NARROW-INTERFACE",
      "CQ-NARROW-CLOUD",
      "CQ-NARROW-PERFORMANCE",
      "CQ-COMMITMENT-ENTERPRISE",
      "CQ-COMMITMENT-PROJECT",
      "CQ-STATUS-AWARD",
      "CQ-SCOPE-BROAD",
      "CQ-QUANTITY-OVERCLAIM",
      "CQ-ENTITY-OVERCLAIM",
      "CQ-STALE-EXPIRED",
      "CQ-STALE-REVOKED",
      "CQ-MISSING-LINEAGE",
      "CQ-MAPPING-PENDING",
      "CQ-HISTORICAL-BID",
      "CQ-REFERENCE-ONLY",
      "CQ-SUPPORT-UNKNOWN",
      "CQ-COMPOSITE-STATUS-CONFLICT",
      "CQ-COMPOSITE-SUBJECT-CONFLICT"
    ],
    "writer_fast_gate_active_cases": [
      "project_response_only",
      "requirement_laundering_negative",
      "authorized_strong_claim",
      "scope_restriction_negative",
      "quantity_restriction_negative",
      "status_restriction_negative",
      "validity_restriction_negative",
      "composite_authorized_claim"
    ],
    "note": "The frozen schemas do not require a rationale field; listed cases need a human note if a future adjudication packet requires one."
  },
  "missing_or_intentionally_partial_fields": {
    "mapping_without_expected_decision": [
      "MAP-G028"
    ],
    "mapping_cases_with_fact_ref_gap": [],
    "note": "These are intentional contract fixtures (for example batch-split or zero-fact cases), not silently filled by this export."
  },
  "lineage": {
    "mapping_source_lineage_fields": "NOT_PART_OF_MAPPING_GOLD_CONTRACT; facts are evaluator refs only",
    "legacy_source_lineage": "PRESENT_IN_SOURCE_CANDIDATES (chunk/material/offset/hash); review overlay is empty",
    "claim_quality_lineage": "PRESENT_AS_SYNTHETIC_BINDING_IDENTITIES; not real customer provenance",
    "writer_lineage": "PRESENT_AS_DETERMINISTIC_SYNTHETIC_HASHES"
  },
  "non_deterministic_or_historical_artifacts": [
    "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.json",
    "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.md",
    "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.json",
    "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.md",
    "backend/eval/rag-pilot/results/all_package_chunks.jsonl",
    "backend/eval/rag-pilot/results/chunk_quality_by_document.csv",
    "backend/eval/rag-pilot/results/chunk_quality_summary.json",
    "backend/eval/rag-pilot/results/context_recovery_24case_cases.csv",
    "backend/eval/rag-pilot/results/context_recovery_24case_report.md",
    "backend/eval/rag-pilot/results/context_recovery_24case_results.json",
    "backend/eval/rag-pilot/results/context_recovery_runtime_verification.json",
    "backend/eval/rag-pilot/results/context_recovery_runtime_verification.md",
    "backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md",
    "backend/eval/rag-pilot/results/corrected_scope_retrieval_raw.json",
    "backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/00_master_summary.json",
    "backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.csv",
    "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json",
    "backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.csv",
    "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.json",
    "backend/eval/rag-pilot/results/overnight/02_semantic_review_contract.json",
    "backend/eval/rag-pilot/results/overnight/03_fact_32case.csv",
    "backend/eval/rag-pilot/results/overnight/03_fact_32case.json",
    "backend/eval/rag-pilot/results/overnight/03_fact_contract.json",
    "backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_audit.json",
    "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_report.md",
    "backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/05_failures.jsonl",
    "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/05_provider_calls.csv",
    "backend/eval/rag-pilot/results/overnight/05_regression_tests.md",
    "backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md",
    "backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md",
    "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.json",
    "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.md",
    "backend/eval/rag-pilot/results/post-hash-fix/FACT_CONTROLLED_RERUN.json",
    "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json",
    "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md",
    "backend/eval/rag-pilot/results/post-hash-fix/provider_call_ledger.jsonl",
    "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/canary-report.json",
    "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/provider_call_ledger.jsonl",
    "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02/canary-report.json",
    "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/canary-report.json",
    "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/provider_call_ledger.jsonl",
    "backend/eval/rag-pilot/results/structured-output-shared-canary-03/canary-report.json",
    "backend/eval/rag-pilot/results/structured-output-shared-canary-03/provider_call_ledger.jsonl"
  ],
  "no_truncation_marker": true
}
```

## Export files

- manifest_json: backend/eval/gold-human-review/00_gold_review_manifest.json
- manifest_markdown: backend/eval/gold-human-review/00_gold_review_manifest.md
- mapping_json: backend/eval/gold-human-review/01_mapping_gold_full_review.json
- mapping_markdown: backend/eval/gold-human-review/01_mapping_gold_full_review.md
- claim_json: backend/eval/gold-human-review/02_claim_gold_full_review.json
- claim_markdown: backend/eval/gold-human-review/02_claim_gold_full_review.md
- writer_json: backend/eval/gold-human-review/03_writer_gold_full_review.json
- writer_markdown: backend/eval/gold-human-review/03_writer_gold_full_review.md

## Checkpoint

`GOLD_FULL_HUMAN_REVIEW_EXPORT_PASS` means the complete source projections were generated and structurally checked. It is not a claim that semantic Gold quality is PASS.

## Export integrity summary

```json
{
  "counts": {
    "mapping_active_scored": 36,
    "claim_quality_active_scored": 24,
    "claim_legacy_retained_not_scored": 60,
    "writer_fast_gate_active_scored": 8,
    "writer_provider_fidelity_gold": 0
  },
  "integrity": {
    "duplicate_case_ids": {
      "mapping": [],
      "claim_quality": [],
      "claim_legacy": [],
      "writer_fast_gate": [],
      "across_exports": []
    },
    "missing_rationale_or_review_note": {
      "mapping_active_cases": [
        "MAP-G001",
        "MAP-G002",
        "MAP-G003",
        "MAP-G004",
        "MAP-G005",
        "MAP-G006",
        "MAP-G007",
        "MAP-G008",
        "MAP-G009",
        "MAP-G010",
        "MAP-G011",
        "MAP-G012",
        "MAP-G013",
        "MAP-G014",
        "MAP-G015",
        "MAP-G016",
        "MAP-G017",
        "MAP-G018",
        "MAP-G019",
        "MAP-G020",
        "MAP-G021",
        "MAP-G022",
        "MAP-G023",
        "MAP-G024",
        "MAP-G025",
        "MAP-G026",
        "MAP-G027",
        "MAP-G028",
        "MAP-G029",
        "MAP-G030",
        "MAP-G031",
        "MAP-G032",
        "MAP-G033",
        "MAP-G034",
        "MAP-G035",
        "MAP-G036"
      ],
      "claim_quality_active_cases": [
        "CQ-STRONG-SSO",
        "CQ-STRONG-INTERFACE",
        "CQ-STRONG-PERFORMANCE",
        "CQ-STRONG-QUALIFICATION",
        "CQ-NARROW-SSO",
        "CQ-NARROW-LDAP",
        "CQ-NARROW-INTERFACE",
        "CQ-NARROW-CLOUD",
        "CQ-NARROW-PERFORMANCE",
        "CQ-COMMITMENT-ENTERPRISE",
        "CQ-COMMITMENT-PROJECT",
        "CQ-STATUS-AWARD",
        "CQ-SCOPE-BROAD",
        "CQ-QUANTITY-OVERCLAIM",
        "CQ-ENTITY-OVERCLAIM",
        "CQ-STALE-EXPIRED",
        "CQ-STALE-REVOKED",
        "CQ-MISSING-LINEAGE",
        "CQ-MAPPING-PENDING",
        "CQ-HISTORICAL-BID",
        "CQ-REFERENCE-ONLY",
        "CQ-SUPPORT-UNKNOWN",
        "CQ-COMPOSITE-STATUS-CONFLICT",
        "CQ-COMPOSITE-SUBJECT-CONFLICT"
      ],
      "writer_fast_gate_active_cases": [
        "project_response_only",
        "requirement_laundering_negative",
        "authorized_strong_claim",
        "scope_restriction_negative",
        "quantity_restriction_negative",
        "status_restriction_negative",
        "validity_restriction_negative",
        "composite_authorized_claim"
      ],
      "note": "The frozen schemas do not require a rationale field; listed cases need a human note if a future adjudication packet requires one."
    },
    "missing_or_intentionally_partial_fields": {
      "mapping_without_expected_decision": [
        "MAP-G028"
      ],
      "mapping_cases_with_fact_ref_gap": [],
      "note": "These are intentional contract fixtures (for example batch-split or zero-fact cases), not silently filled by this export."
    },
    "lineage": {
      "mapping_source_lineage_fields": "NOT_PART_OF_MAPPING_GOLD_CONTRACT; facts are evaluator refs only",
      "legacy_source_lineage": "PRESENT_IN_SOURCE_CANDIDATES (chunk/material/offset/hash); review overlay is empty",
      "claim_quality_lineage": "PRESENT_AS_SYNTHETIC_BINDING_IDENTITIES; not real customer provenance",
      "writer_lineage": "PRESENT_AS_DETERMINISTIC_SYNTHETIC_HASHES"
    },
    "non_deterministic_or_historical_artifacts": [
      "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.json",
      "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.md",
      "backend/eval/rag-pilot/results/all_package_chunks.jsonl",
      "backend/eval/rag-pilot/results/chunk_quality_by_document.csv",
      "backend/eval/rag-pilot/results/chunk_quality_summary.json",
      "backend/eval/rag-pilot/results/context_recovery_24case_cases.csv",
      "backend/eval/rag-pilot/results/context_recovery_24case_report.md",
      "backend/eval/rag-pilot/results/context_recovery_24case_results.json",
      "backend/eval/rag-pilot/results/context_recovery_runtime_verification.json",
      "backend/eval/rag-pilot/results/context_recovery_runtime_verification.md",
      "backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md",
      "backend/eval/rag-pilot/results/corrected_scope_retrieval_raw.json",
      "backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/00_master_summary.json",
      "backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.csv",
      "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json",
      "backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.csv",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.json",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_contract.json",
      "backend/eval/rag-pilot/results/overnight/03_fact_32case.csv",
      "backend/eval/rag-pilot/results/overnight/03_fact_32case.json",
      "backend/eval/rag-pilot/results/overnight/03_fact_contract.json",
      "backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_audit.json",
      "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_report.md",
      "backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/05_failures.jsonl",
      "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/05_provider_calls.csv",
      "backend/eval/rag-pilot/results/overnight/05_regression_tests.md",
      "backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.json",
      "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.md",
      "backend/eval/rag-pilot/results/post-hash-fix/FACT_CONTROLLED_RERUN.json",
      "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json",
      "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md",
      "backend/eval/rag-pilot/results/post-hash-fix/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/canary-report.json",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/structured-output-shared-canary-03/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-shared-canary-03/provider_call_ledger.jsonl"
    ],
    "no_truncation_marker": true,
    "missing_expected_fields": {
      "mapping_expected_decision": [
        "MAP-G028"
      ],
      "mapping_requirement_id": [
        "MAP-G001",
        "MAP-G002",
        "MAP-G003",
        "MAP-G004",
        "MAP-G005",
        "MAP-G006",
        "MAP-G007",
        "MAP-G008",
        "MAP-G009",
        "MAP-G010",
        "MAP-G011",
        "MAP-G012",
        "MAP-G013",
        "MAP-G014",
        "MAP-G015",
        "MAP-G016",
        "MAP-G017",
        "MAP-G018",
        "MAP-G019",
        "MAP-G020",
        "MAP-G021",
        "MAP-G022",
        "MAP-G023",
        "MAP-G024",
        "MAP-G025",
        "MAP-G026",
        "MAP-G027",
        "MAP-G028",
        "MAP-G029",
        "MAP-G030",
        "MAP-G031",
        "MAP-G032",
        "MAP-G033",
        "MAP-G034",
        "MAP-G035",
        "MAP-G036"
      ],
      "mapping_fact_semantic_fields": [
        "MAP-G028"
      ],
      "note": "Missing values are preserved as explicit NOT_AUTHORED/NOT_PRESENT in review projections; source records are unchanged."
    },
    "missing_source_lineage": {
      "mapping_cases": [
        "MAP-G001",
        "MAP-G002",
        "MAP-G003",
        "MAP-G004",
        "MAP-G005",
        "MAP-G006",
        "MAP-G007",
        "MAP-G008",
        "MAP-G009",
        "MAP-G010",
        "MAP-G011",
        "MAP-G012",
        "MAP-G013",
        "MAP-G014",
        "MAP-G015",
        "MAP-G016",
        "MAP-G017",
        "MAP-G018",
        "MAP-G019",
        "MAP-G020",
        "MAP-G021",
        "MAP-G022",
        "MAP-G023",
        "MAP-G024",
        "MAP-G025",
        "MAP-G026",
        "MAP-G027",
        "MAP-G028",
        "MAP-G029",
        "MAP-G030",
        "MAP-G031",
        "MAP-G032",
        "MAP-G033",
        "MAP-G034",
        "MAP-G035",
        "MAP-G036"
      ],
      "claim_quality_cases": [],
      "claim_legacy_cases": [],
      "writer_cases": [],
      "note": "Mapping Gold facts intentionally use evaluator fact_ref identities, not production Material/Chunk lineage."
    },
    "orphan_gold_files": [
      "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.json",
      "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.md",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.json",
      "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.md",
      "backend/eval/rag-pilot/results/all_package_chunks.jsonl",
      "backend/eval/rag-pilot/results/chunk_quality_by_document.csv",
      "backend/eval/rag-pilot/results/chunk_quality_summary.json",
      "backend/eval/rag-pilot/results/context_recovery_24case_cases.csv",
      "backend/eval/rag-pilot/results/context_recovery_24case_report.md",
      "backend/eval/rag-pilot/results/context_recovery_24case_results.json",
      "backend/eval/rag-pilot/results/context_recovery_runtime_verification.json",
      "backend/eval/rag-pilot/results/context_recovery_runtime_verification.md",
      "backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md",
      "backend/eval/rag-pilot/results/corrected_scope_retrieval_raw.json",
      "backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/00_master_summary.json",
      "backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.csv",
      "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json",
      "backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.csv",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.json",
      "backend/eval/rag-pilot/results/overnight/02_semantic_review_contract.json",
      "backend/eval/rag-pilot/results/overnight/03_fact_32case.csv",
      "backend/eval/rag-pilot/results/overnight/03_fact_32case.json",
      "backend/eval/rag-pilot/results/overnight/03_fact_contract.json",
      "backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_audit.json",
      "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_report.md",
      "backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/05_failures.jsonl",
      "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/05_provider_calls.csv",
      "backend/eval/rag-pilot/results/overnight/05_regression_tests.md",
      "backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md",
      "backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md",
      "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.json",
      "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.md",
      "backend/eval/rag-pilot/results/post-hash-fix/FACT_CONTROLLED_RERUN.json",
      "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json",
      "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md",
      "backend/eval/rag-pilot/results/post-hash-fix/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/canary-report.json",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/provider_call_ledger.jsonl",
      "backend/eval/rag-pilot/results/structured-output-shared-canary-03/canary-report.json",
      "backend/eval/rag-pilot/results/structured-output-shared-canary-03/provider_call_ledger.jsonl"
    ],
    "no_source_fields_dropped": true,
    "source_projection_deep_equal": true
  },
  "claim_statistics": {
    "total_active_scored_gold": 24,
    "legacy_count": 60,
    "quality_count": 24,
    "safety_negative_count": 20,
    "strong_positive_count": 4,
    "narrow_positive_count": 5,
    "project_commitment_count": 1,
    "support_fixture_count": 7
  }
}
```

`GOLD_FULL_HUMAN_REVIEW_EXPORT_PASS` 表示完整源投影与结构校验通过，不表示 Gold 质量 PASS。

## Explicit fixture inventory

### RUNNER_REFERENCED_GOLD_FILES

```json
[
  "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
  "backend/eval/evidence-gold/claim-quality-cases.js",
  "backend/eval/evidence-gold/gold-candidates.json",
  "backend/eval/evidence-gold/review/gold-reviews.json",
  "backend/eval/rag-pilot/writer-fast-gate-v1.js"
]
```

### ORPHAN_GOLD_FILES

```json
[
  "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.json",
  "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.md",
  "backend/eval/rag-pilot/results/all_package_chunks.jsonl",
  "backend/eval/rag-pilot/results/chunk_quality_by_document.csv",
  "backend/eval/rag-pilot/results/chunk_quality_summary.json",
  "backend/eval/rag-pilot/results/context_recovery_24case_cases.csv",
  "backend/eval/rag-pilot/results/context_recovery_24case_report.md",
  "backend/eval/rag-pilot/results/context_recovery_24case_results.json",
  "backend/eval/rag-pilot/results/context_recovery_runtime_verification.json",
  "backend/eval/rag-pilot/results/context_recovery_runtime_verification.md",
  "backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md",
  "backend/eval/rag-pilot/results/corrected_scope_retrieval_raw.json",
  "backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/00_master_summary.json",
  "backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.csv",
  "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json",
  "backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.csv",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.json",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_contract.json",
  "backend/eval/rag-pilot/results/overnight/03_fact_32case.csv",
  "backend/eval/rag-pilot/results/overnight/03_fact_32case.json",
  "backend/eval/rag-pilot/results/overnight/03_fact_contract.json",
  "backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_audit.json",
  "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_report.md",
  "backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/05_failures.jsonl",
  "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/05_provider_calls.csv",
  "backend/eval/rag-pilot/results/overnight/05_regression_tests.md",
  "backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.json",
  "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.md",
  "backend/eval/rag-pilot/results/post-hash-fix/FACT_CONTROLLED_RERUN.json",
  "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json",
  "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md",
  "backend/eval/rag-pilot/results/post-hash-fix/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/canary-report.json",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/structured-output-shared-canary-03/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-shared-canary-03/provider_call_ledger.jsonl"
]
```

### DUPLICATE_CASE_IDS

```json
{
  "mapping": [],
  "claim_quality": [],
  "claim_legacy": [],
  "writer_fast_gate": [],
  "across_exports": []
}
```

### MISSING_RATIONALE_CASES

```json
{
  "mapping_active_cases": [
    "MAP-G001",
    "MAP-G002",
    "MAP-G003",
    "MAP-G004",
    "MAP-G005",
    "MAP-G006",
    "MAP-G007",
    "MAP-G008",
    "MAP-G009",
    "MAP-G010",
    "MAP-G011",
    "MAP-G012",
    "MAP-G013",
    "MAP-G014",
    "MAP-G015",
    "MAP-G016",
    "MAP-G017",
    "MAP-G018",
    "MAP-G019",
    "MAP-G020",
    "MAP-G021",
    "MAP-G022",
    "MAP-G023",
    "MAP-G024",
    "MAP-G025",
    "MAP-G026",
    "MAP-G027",
    "MAP-G028",
    "MAP-G029",
    "MAP-G030",
    "MAP-G031",
    "MAP-G032",
    "MAP-G033",
    "MAP-G034",
    "MAP-G035",
    "MAP-G036"
  ],
  "claim_quality_active_cases": [
    "CQ-STRONG-SSO",
    "CQ-STRONG-INTERFACE",
    "CQ-STRONG-PERFORMANCE",
    "CQ-STRONG-QUALIFICATION",
    "CQ-NARROW-SSO",
    "CQ-NARROW-LDAP",
    "CQ-NARROW-INTERFACE",
    "CQ-NARROW-CLOUD",
    "CQ-NARROW-PERFORMANCE",
    "CQ-COMMITMENT-ENTERPRISE",
    "CQ-COMMITMENT-PROJECT",
    "CQ-STATUS-AWARD",
    "CQ-SCOPE-BROAD",
    "CQ-QUANTITY-OVERCLAIM",
    "CQ-ENTITY-OVERCLAIM",
    "CQ-STALE-EXPIRED",
    "CQ-STALE-REVOKED",
    "CQ-MISSING-LINEAGE",
    "CQ-MAPPING-PENDING",
    "CQ-HISTORICAL-BID",
    "CQ-REFERENCE-ONLY",
    "CQ-SUPPORT-UNKNOWN",
    "CQ-COMPOSITE-STATUS-CONFLICT",
    "CQ-COMPOSITE-SUBJECT-CONFLICT"
  ],
  "writer_fast_gate_active_cases": [
    "project_response_only",
    "requirement_laundering_negative",
    "authorized_strong_claim",
    "scope_restriction_negative",
    "quantity_restriction_negative",
    "status_restriction_negative",
    "validity_restriction_negative",
    "composite_authorized_claim"
  ],
  "note": "The frozen schemas do not require a rationale field; listed cases need a human note if a future adjudication packet requires one."
}
```

### MISSING_EXPECTED_FIELDS

```json
{
  "mapping_expected_decision": [
    "MAP-G028"
  ],
  "mapping_requirement_id": [
    "MAP-G001",
    "MAP-G002",
    "MAP-G003",
    "MAP-G004",
    "MAP-G005",
    "MAP-G006",
    "MAP-G007",
    "MAP-G008",
    "MAP-G009",
    "MAP-G010",
    "MAP-G011",
    "MAP-G012",
    "MAP-G013",
    "MAP-G014",
    "MAP-G015",
    "MAP-G016",
    "MAP-G017",
    "MAP-G018",
    "MAP-G019",
    "MAP-G020",
    "MAP-G021",
    "MAP-G022",
    "MAP-G023",
    "MAP-G024",
    "MAP-G025",
    "MAP-G026",
    "MAP-G027",
    "MAP-G028",
    "MAP-G029",
    "MAP-G030",
    "MAP-G031",
    "MAP-G032",
    "MAP-G033",
    "MAP-G034",
    "MAP-G035",
    "MAP-G036"
  ],
  "mapping_fact_semantic_fields": [
    "MAP-G028"
  ],
  "note": "Missing values are preserved as explicit NOT_AUTHORED/NOT_PRESENT in review projections; source records are unchanged."
}
```

### MISSING_SOURCE_LINEAGE

```json
{
  "mapping_cases": [
    "MAP-G001",
    "MAP-G002",
    "MAP-G003",
    "MAP-G004",
    "MAP-G005",
    "MAP-G006",
    "MAP-G007",
    "MAP-G008",
    "MAP-G009",
    "MAP-G010",
    "MAP-G011",
    "MAP-G012",
    "MAP-G013",
    "MAP-G014",
    "MAP-G015",
    "MAP-G016",
    "MAP-G017",
    "MAP-G018",
    "MAP-G019",
    "MAP-G020",
    "MAP-G021",
    "MAP-G022",
    "MAP-G023",
    "MAP-G024",
    "MAP-G025",
    "MAP-G026",
    "MAP-G027",
    "MAP-G028",
    "MAP-G029",
    "MAP-G030",
    "MAP-G031",
    "MAP-G032",
    "MAP-G033",
    "MAP-G034",
    "MAP-G035",
    "MAP-G036"
  ],
  "claim_quality_cases": [],
  "claim_legacy_cases": [],
  "writer_cases": [],
  "note": "Mapping Gold facts intentionally use evaluator fact_ref identities, not production Material/Chunk lineage."
}
```

### NON_DETERMINISTIC_FIXTURES

```json
[
  "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.json",
  "backend/eval/claim-eval-v1/results/claim-eval-v1-1788401006591.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350305543.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350404949.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350432246.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350551914.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350652069.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788350711959.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788351549144.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788353328499.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788354413008.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-eval-v1-1788356988995.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-1788362450017.md",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.json",
  "backend/eval/mapping-benchmark-v1/results/mapping-semantic-baseline-v1-blocked-1788362573315.md",
  "backend/eval/rag-pilot/results/all_package_chunks.jsonl",
  "backend/eval/rag-pilot/results/chunk_quality_by_document.csv",
  "backend/eval/rag-pilot/results/chunk_quality_summary.json",
  "backend/eval/rag-pilot/results/context_recovery_24case_cases.csv",
  "backend/eval/rag-pilot/results/context_recovery_24case_report.md",
  "backend/eval/rag-pilot/results/context_recovery_24case_results.json",
  "backend/eval/rag-pilot/results/context_recovery_runtime_verification.json",
  "backend/eval/rag-pilot/results/context_recovery_runtime_verification.md",
  "backend/eval/rag-pilot/results/corrected_scope_retrieval_checkpoint.md",
  "backend/eval/rag-pilot/results/corrected_scope_retrieval_raw.json",
  "backend/eval/rag-pilot/results/overnight/00_master_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/00_master_summary.json",
  "backend/eval/rag-pilot/results/overnight/01_post_p0_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.csv",
  "backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json",
  "backend/eval/rag-pilot/results/overnight/02_production_composition_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.csv",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_36case.json",
  "backend/eval/rag-pilot/results/overnight/02_semantic_review_contract.json",
  "backend/eval/rag-pilot/results/overnight/03_fact_32case.csv",
  "backend/eval/rag-pilot/results/overnight/03_fact_32case.json",
  "backend/eval/rag-pilot/results/overnight/03_fact_contract.json",
  "backend/eval/rag-pilot/results/overnight/03_operational_db_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_audit.json",
  "backend/eval/rag-pilot/results/overnight/04_mapping_readiness_report.md",
  "backend/eval/rag-pilot/results/overnight/04_writer_eval_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/05_failures.jsonl",
  "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/05_provider_calls.csv",
  "backend/eval/rag-pilot/results/overnight/05_regression_tests.md",
  "backend/eval/rag-pilot/results/overnight/06_global_engineering_quality_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/06_writer_regression_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/08_mapping_writer_special_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/09_mapping_live_diagnostic_integrity_checkpoint.md",
  "backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md",
  "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.json",
  "backend/eval/rag-pilot/results/post-hash-fix/CONTROLLED_RERUN_SUMMARY.md",
  "backend/eval/rag-pilot/results/post-hash-fix/FACT_CONTROLLED_RERUN.json",
  "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json",
  "backend/eval/rag-pilot/results/post-hash-fix/SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md",
  "backend/eval/rag-pilot/results/post-hash-fix/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/canary-report.json",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-01/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/semantic-invariant-root-fix-canary-02/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-isolated-canary-01/provider_call_ledger.jsonl",
  "backend/eval/rag-pilot/results/structured-output-shared-canary-03/canary-report.json",
  "backend/eval/rag-pilot/results/structured-output-shared-canary-03/provider_call_ledger.jsonl"
]
```

### writer_fixture_inventory

```json
[
  {
    "path": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
    "classification": "SCORED_GOLD",
    "active": true,
    "case_count": 8
  },
  {
    "path": "backend/test/writer-authority-p0.test.js",
    "classification": "DETERMINISTIC_REGRESSION",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/test/writer-overnight.test.js",
    "classification": "DETERMINISTIC_REGRESSION",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/test/writer-overnight.test.js",
    "classification": "HTTP_NEGATIVE_FIXTURE",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/test/external-writer-preflight-v1.test.js",
    "classification": "PROVIDER_FIDELITY_CANDIDATE / NOT_FROZEN",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/test/external-writer-lifecycle.test.js",
    "classification": "PROVIDER_FIDELITY_CANDIDATE / NOT_FROZEN",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/eval/claim-eval-v1/db-gate.js",
    "classification": "DB_FIXTURE (Claim support, not Writer Gold)",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/eval/rag-pilot/results/overnight/05_final_writer_checkpoint.md",
    "classification": "HISTORICAL_RESULT / NOT_ACTIVE_AUTHORITY",
    "active": false,
    "case_count": null
  },
  {
    "path": null,
    "classification": "FROZEN_PROVIDER_FIDELITY_GOLD",
    "active": false,
    "case_count": 0,
    "status": "NOT_ESTABLISHED"
  }
]
```

### claim_fixture_inventory

```json
[
  {
    "path": "backend/eval/evidence-gold/claim-quality-cases.js",
    "classification": "SCORED_GOLD",
    "active": true,
    "case_count": 24
  },
  {
    "path": "backend/eval/evidence-gold/gold-candidates.json",
    "classification": "LEGACY_GOLD_RETAINED_NOT_SCORED",
    "active": false,
    "case_count": 60
  },
  {
    "path": "backend/eval/claim-eval-v1/db-gate.js",
    "classification": "SUPPORT_FIXTURE",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/integration/claim-eval-v1.integration.js",
    "classification": "SUPPORT_FIXTURE",
    "active": false,
    "case_count": null
  },
  {
    "path": "backend/test/claim-eval-v1.test.js",
    "classification": "REGRESSION_FIXTURE",
    "active": false,
    "case_count": null
  }
]
```

## Current claim statistics

```json
{
  "total_active_scored_gold": 24,
  "legacy_count": 60,
  "quality_count": 24,
  "safety_negative_count": 20,
  "strong_positive_count": 4,
  "narrow_positive_count": 5,
  "project_commitment_count": 1,
  "support_fixture_count": 2,
  "regression_fixture_count": 1,
  "human_review_support_count": 4
}
```
