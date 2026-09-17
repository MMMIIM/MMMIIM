# Claim Gold Full Human Review

Quality Gold 与 Legacy Gold 分层展示；Quality 为当前 runner 计分的 24 条，Legacy 为保留但不计分的 60 条。每条记录完整展开。

## CQ-STRONG-SSO

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STRONG-SSO",
  "quality_class": "supported_strong",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STRONG-SSO",
    "requirement_hash": "7baaa0e18a92cdaa0d8ad1b73910434cf8bf0166e499504f3f81ce1789fc0b64",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持单点登录。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STRONG-SSO",
    "requirement_id": "REQ-EVAL-STRONG-SSO",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STRONG-SSO"
    ],
    "text": "我司统一身份认证平台已完成 SSO 能力建设。",
    "metadata": {
      "subject": "SSO",
      "entities": [
        "统一身份认证平台"
      ],
      "scope": [
        "capability_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STRONG-SSO",
    "mapping_id": "MAP-EVAL-STRONG-SSO",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STRONG-SSO",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "completion_fact"
    ],
    "source_hash": "47547eb4b31626d2d4612469ddafb7aa692f54a62b3c37ab23f7ce2807b14979",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STRONG-SSO",
        "evidence_identifier": "FACT-EVAL-STRONG-SSO",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "SSO"
        },
        "entities_json": [
          {
            "type": "capability",
            "name": "统一身份认证平台"
          }
        ],
        "fact_status": "completed",
        "fact_scopes_json": [
          "capability_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "allow",
    "writer_eligible": true,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STRONG-SSO",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_strong",
        "allow"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STRONG-SSO",
      "requirement_hash": "7baaa0e18a92cdaa0d8ad1b73910434cf8bf0166e499504f3f81ce1789fc0b64",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持单点登录。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STRONG-SSO",
          "evidence_identifier": "FACT-EVAL-STRONG-SSO",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "SSO"
          },
          "entities_json": [
            {
              "type": "capability",
              "name": "统一身份认证平台"
            }
          ],
          "fact_status": "completed",
          "fact_scopes_json": [
            "capability_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司统一身份认证平台已完成 SSO 能力建设。",
      "semantics": {
        "subject": "SSO",
        "entities": [
          "统一身份认证平台"
        ],
        "scope": [
          "capability_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "allow",
      "writer_eligible": true,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": true,
      "narrow_retention": false,
      "false_hard_reject": true,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STRONG-INTERFACE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STRONG-INTERFACE",
  "quality_class": "supported_strong",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STRONG-INTERFACE",
    "requirement_hash": "7c0f0b0e770db9d774e841b353f3c9b64d4ae2c37fc5f88feb97e3ed25ccc0ee",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持标准数据交换接口。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STRONG-INTERFACE",
    "requirement_id": "REQ-EVAL-STRONG-INTERFACE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STRONG-INTERFACE"
    ],
    "text": "标准数据交换接口已验证可用。",
    "metadata": {
      "subject": "接口服务",
      "entities": [
        "标准数据交换接口"
      ],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STRONG-INTERFACE",
    "mapping_id": "MAP-EVAL-STRONG-INTERFACE",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STRONG-INTERFACE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "834f9bb6790dd607337619a20d63f34d7650a56b7bfa75a44a7c81f87586b3c5",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STRONG-INTERFACE",
        "evidence_identifier": "FACT-EVAL-STRONG-INTERFACE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [
          {
            "type": "capability",
            "name": "标准数据交换接口"
          }
        ],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "allow",
    "writer_eligible": true,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STRONG-INTERFACE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_strong",
        "allow"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STRONG-INTERFACE",
      "requirement_hash": "7c0f0b0e770db9d774e841b353f3c9b64d4ae2c37fc5f88feb97e3ed25ccc0ee",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持标准数据交换接口。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STRONG-INTERFACE",
          "evidence_identifier": "FACT-EVAL-STRONG-INTERFACE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [
            {
              "type": "capability",
              "name": "标准数据交换接口"
            }
          ],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "标准数据交换接口已验证可用。",
      "semantics": {
        "subject": "接口服务",
        "entities": [
          "标准数据交换接口"
        ],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "allow",
      "writer_eligible": true,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": true,
      "narrow_retention": false,
      "false_hard_reject": true,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STRONG-PERFORMANCE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STRONG-PERFORMANCE",
  "quality_class": "supported_strong",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STRONG-PERFORMANCE",
    "requirement_hash": "b9a333fa318d41dc6a51754276d95f8757851b0aa0403926a9719186cda91448",
    "contract_version": "canonical-requirement-v1",
    "text": "数据服务接口响应时间应不超过1秒。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STRONG-PERFORMANCE",
    "requirement_id": "REQ-EVAL-STRONG-PERFORMANCE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STRONG-PERFORMANCE"
    ],
    "text": "数据服务已验证响应时间不超过1秒。",
    "metadata": {
      "subject": "数据服务",
      "entities": [],
      "scope": [
        "performance_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STRONG-PERFORMANCE",
    "mapping_id": "MAP-EVAL-STRONG-PERFORMANCE",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STRONG-PERFORMANCE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "performance_fact",
      "verification_fact"
    ],
    "source_hash": "ce6bf69c3c1b9dc364c3d7882f82708e66372f6aed4d6d70976c0e791d1fabb8",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STRONG-PERFORMANCE",
        "evidence_identifier": "FACT-EVAL-STRONG-PERFORMANCE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "数据服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "performance_fact",
          "verification_fact"
        ],
        "quantities_json": [
          {
            "metric": "latency",
            "operator": "lte",
            "value": "1",
            "unit": "秒"
          }
        ],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "allow",
    "writer_eligible": true,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STRONG-PERFORMANCE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_strong",
        "allow"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STRONG-PERFORMANCE",
      "requirement_hash": "b9a333fa318d41dc6a51754276d95f8757851b0aa0403926a9719186cda91448",
      "contract_version": "canonical-requirement-v1",
      "text": "数据服务接口响应时间应不超过1秒。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STRONG-PERFORMANCE",
          "evidence_identifier": "FACT-EVAL-STRONG-PERFORMANCE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "数据服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "performance_fact",
            "verification_fact"
          ],
          "quantities_json": [
            {
              "metric": "latency",
              "operator": "lte",
              "value": "1",
              "unit": "秒"
            }
          ],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务已验证响应时间不超过1秒。",
      "semantics": {
        "subject": "数据服务",
        "entities": [],
        "scope": [
          "performance_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "allow",
      "writer_eligible": true,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": true,
      "narrow_retention": false,
      "false_hard_reject": true,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STRONG-QUALIFICATION

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STRONG-QUALIFICATION",
  "quality_class": "supported_strong",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STRONG-QUALIFICATION",
    "requirement_hash": "d96907ec48601eda5fcee5eb1a15d42dfe5dcfecf141237ed4bcfef19a93df82",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备有效的信息安全管理体系。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STRONG-QUALIFICATION",
    "requirement_id": "REQ-EVAL-STRONG-QUALIFICATION",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STRONG-QUALIFICATION"
    ],
    "text": "信息安全管理体系已验证有效。",
    "metadata": {
      "subject": "信息安全管理体系",
      "entities": [],
      "scope": [
        "qualification_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STRONG-QUALIFICATION",
    "mapping_id": "MAP-EVAL-STRONG-QUALIFICATION",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STRONG-QUALIFICATION",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "qualification_fact",
      "verification_fact"
    ],
    "source_hash": "344fd5f178d4307f9f1382e7f7dda95f8d308683943cadc5152bdddf8a8c7132",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STRONG-QUALIFICATION",
        "evidence_identifier": "FACT-EVAL-STRONG-QUALIFICATION",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "信息安全管理体系"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "qualification_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "allow",
    "writer_eligible": true,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STRONG-QUALIFICATION",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_strong",
        "allow"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STRONG-QUALIFICATION",
      "requirement_hash": "d96907ec48601eda5fcee5eb1a15d42dfe5dcfecf141237ed4bcfef19a93df82",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备有效的信息安全管理体系。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STRONG-QUALIFICATION",
          "evidence_identifier": "FACT-EVAL-STRONG-QUALIFICATION",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "信息安全管理体系"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "qualification_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "信息安全管理体系已验证有效。",
      "semantics": {
        "subject": "信息安全管理体系",
        "entities": [],
        "scope": [
          "qualification_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "allow",
      "writer_eligible": true,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": true,
      "narrow_retention": false,
      "false_hard_reject": true,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-NARROW-SSO

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-NARROW-SSO",
  "quality_class": "supported_narrow",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-NARROW-SSO",
    "requirement_hash": "5a1b288d26ec219ee85993c6c7884340723c13591214862179ad3509d577d8d6",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持统一身份体系。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-NARROW-SSO",
    "requirement_id": "REQ-EVAL-NARROW-SSO",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-NARROW-SSO"
    ],
    "text": "我司平台已完成 SSO 能力建设。",
    "metadata": {
      "subject": "SSO",
      "entities": [],
      "scope": [
        "capability_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-NARROW-SSO",
    "mapping_id": "MAP-EVAL-NARROW-SSO",
    "mapping_status": "approved",
    "support_level": "partial_support",
    "evidence_id": "FACT-EVAL-NARROW-SSO",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "completion_fact"
    ],
    "source_hash": "8c49e0dcc8ef844cb0cb4c1cc797efda44f14d23ff28d73326afe6917c57d6dc",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-NARROW-SSO",
        "evidence_identifier": "FACT-EVAL-NARROW-SSO",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "SSO"
        },
        "entities_json": [],
        "fact_status": "completed",
        "fact_scopes_json": [
          "capability_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-NARROW-SSO",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_narrow",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-NARROW-SSO",
      "requirement_hash": "5a1b288d26ec219ee85993c6c7884340723c13591214862179ad3509d577d8d6",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持统一身份体系。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-NARROW-SSO",
          "evidence_identifier": "FACT-EVAL-NARROW-SSO",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "SSO"
          },
          "entities_json": [],
          "fact_status": "completed",
          "fact_scopes_json": [
            "capability_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "partial_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司平台已完成 SSO 能力建设。",
      "semantics": {
        "subject": "SSO",
        "entities": [],
        "scope": [
          "capability_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": true,
      "false_hard_reject": false,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-NARROW-LDAP

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-NARROW-LDAP",
  "quality_class": "supported_narrow",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-NARROW-LDAP",
    "requirement_hash": "2435b42bd813f18dd9a0f297740449fba3d8e34e758799c6843dda08356849fa",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持统一目录服务。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-NARROW-LDAP",
    "requirement_id": "REQ-EVAL-NARROW-LDAP",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-NARROW-LDAP"
    ],
    "text": "我司平台已验证支持 LDAP。",
    "metadata": {
      "subject": "LDAP",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-NARROW-LDAP",
    "mapping_id": "MAP-EVAL-NARROW-LDAP",
    "mapping_status": "approved",
    "support_level": "partial_support",
    "evidence_id": "FACT-EVAL-NARROW-LDAP",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "6015b2db3dbae1dd5288758af1b80838f5f59d9f041f6feb69aceb612fa009c6",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-NARROW-LDAP",
        "evidence_identifier": "FACT-EVAL-NARROW-LDAP",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "LDAP"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-NARROW-LDAP",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_narrow",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-NARROW-LDAP",
      "requirement_hash": "2435b42bd813f18dd9a0f297740449fba3d8e34e758799c6843dda08356849fa",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持统一目录服务。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-NARROW-LDAP",
          "evidence_identifier": "FACT-EVAL-NARROW-LDAP",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "LDAP"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "partial_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司平台已验证支持 LDAP。",
      "semantics": {
        "subject": "LDAP",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": true,
      "false_hard_reject": false,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-NARROW-INTERFACE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-NARROW-INTERFACE",
  "quality_class": "supported_narrow",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-NARROW-INTERFACE",
    "requirement_hash": "6cb68df3f1fa8be3c92d4fd14785cdc1fc9c19761a50824eeaab17e272608a05",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持多类异构系统接口集成。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-NARROW-INTERFACE",
    "requirement_id": "REQ-EVAL-NARROW-INTERFACE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-NARROW-INTERFACE"
    ],
    "text": "我司已验证支持标准数据交换接口。",
    "metadata": {
      "subject": "接口服务",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-NARROW-INTERFACE",
    "mapping_id": "MAP-EVAL-NARROW-INTERFACE",
    "mapping_status": "approved",
    "support_level": "partial_support",
    "evidence_id": "FACT-EVAL-NARROW-INTERFACE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "53c0d176a3f3fa4a4fa995a428bb7224bb12a8496f6d75c76cfedc2e502da13e",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-NARROW-INTERFACE",
        "evidence_identifier": "FACT-EVAL-NARROW-INTERFACE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-NARROW-INTERFACE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_narrow",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-NARROW-INTERFACE",
      "requirement_hash": "6cb68df3f1fa8be3c92d4fd14785cdc1fc9c19761a50824eeaab17e272608a05",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持多类异构系统接口集成。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-NARROW-INTERFACE",
          "evidence_identifier": "FACT-EVAL-NARROW-INTERFACE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "partial_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司已验证支持标准数据交换接口。",
      "semantics": {
        "subject": "接口服务",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": true,
      "false_hard_reject": false,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-NARROW-CLOUD

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-NARROW-CLOUD",
  "quality_class": "supported_narrow",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-NARROW-CLOUD",
    "requirement_hash": "341993351580d8f4b6bf922f025b4438be84b85293d394faf4af8f0a90a924af",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应具备云服务部署能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-NARROW-CLOUD",
    "requirement_id": "REQ-EVAL-NARROW-CLOUD",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-NARROW-CLOUD"
    ],
    "text": "我司已完成云服务部署适配。",
    "metadata": {
      "subject": "云服务",
      "entities": [],
      "scope": [
        "capability_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-NARROW-CLOUD",
    "mapping_id": "MAP-EVAL-NARROW-CLOUD",
    "mapping_status": "approved",
    "support_level": "partial_support",
    "evidence_id": "FACT-EVAL-NARROW-CLOUD",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "completion_fact"
    ],
    "source_hash": "0940bc36abe30a0f230d0fa17fadb9595f91a9c285a52797a2c0e881f440eec3",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-NARROW-CLOUD",
        "evidence_identifier": "FACT-EVAL-NARROW-CLOUD",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "云服务"
        },
        "entities_json": [],
        "fact_status": "completed",
        "fact_scopes_json": [
          "capability_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-NARROW-CLOUD",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_narrow",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-NARROW-CLOUD",
      "requirement_hash": "341993351580d8f4b6bf922f025b4438be84b85293d394faf4af8f0a90a924af",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应具备云服务部署能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-NARROW-CLOUD",
          "evidence_identifier": "FACT-EVAL-NARROW-CLOUD",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "云服务"
          },
          "entities_json": [],
          "fact_status": "completed",
          "fact_scopes_json": [
            "capability_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "partial_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司已完成云服务部署适配。",
      "semantics": {
        "subject": "云服务",
        "entities": [],
        "scope": [
          "capability_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": true,
      "false_hard_reject": false,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-NARROW-PERFORMANCE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-NARROW-PERFORMANCE",
  "quality_class": "supported_narrow",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-NARROW-PERFORMANCE",
    "requirement_hash": "dc8d7c7a491dce9df1134067b645d249f5cf267707ae08007a4123ae195ec4fd",
    "contract_version": "canonical-requirement-v1",
    "text": "系统接口响应时间应不超过1秒。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-NARROW-PERFORMANCE",
    "requirement_id": "REQ-EVAL-NARROW-PERFORMANCE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-NARROW-PERFORMANCE"
    ],
    "text": "数据服务已验证响应时间不超过1秒。",
    "metadata": {
      "subject": "数据服务",
      "entities": [],
      "scope": [
        "performance_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-NARROW-PERFORMANCE",
    "mapping_id": "MAP-EVAL-NARROW-PERFORMANCE",
    "mapping_status": "approved",
    "support_level": "partial_support",
    "evidence_id": "FACT-EVAL-NARROW-PERFORMANCE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "performance_fact",
      "verification_fact"
    ],
    "source_hash": "e415f68dfbffd5e28692111d3af8814887b15bc1f41a150845a05fd53a97025b",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-NARROW-PERFORMANCE",
        "evidence_identifier": "FACT-EVAL-NARROW-PERFORMANCE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "数据服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "performance_fact",
          "verification_fact"
        ],
        "quantities_json": [
          {
            "metric": "latency",
            "operator": "lte",
            "value": "1",
            "unit": "秒"
          }
        ],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": true
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-NARROW-PERFORMANCE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "supported_narrow",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-NARROW-PERFORMANCE",
      "requirement_hash": "dc8d7c7a491dce9df1134067b645d249f5cf267707ae08007a4123ae195ec4fd",
      "contract_version": "canonical-requirement-v1",
      "text": "系统接口响应时间应不超过1秒。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-NARROW-PERFORMANCE",
          "evidence_identifier": "FACT-EVAL-NARROW-PERFORMANCE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "数据服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "performance_fact",
            "verification_fact"
          ],
          "quantities_json": [
            {
              "metric": "latency",
              "operator": "lte",
              "value": "1",
              "unit": "秒"
            }
          ],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "partial_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务已验证响应时间不超过1秒。",
      "semantics": {
        "subject": "数据服务",
        "entities": [],
        "scope": [
          "performance_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": true,
      "false_hard_reject": false,
      "useful_evidence_utilization": true,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-COMMITMENT-ENTERPRISE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-COMMITMENT-ENTERPRISE",
  "quality_class": "commitment_distinction",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-COMMITMENT-ENTERPRISE",
    "requirement_hash": "d3e24c3e2ab1624e135299ca343d53a686c37e954aab68473d27898545c40226",
    "contract_version": "canonical-requirement-v1",
    "text": "系统接口响应P95应不超过1秒。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-COMMITMENT-ENTERPRISE",
    "requirement_id": "REQ-EVAL-COMMITMENT-ENTERPRISE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-COMMITMENT-ENTERPRISE"
    ],
    "text": "我司现有平台接口响应P95不超过1秒。",
    "metadata": {
      "subject": "接口服务",
      "entities": [],
      "scope": [
        "performance_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-COMMITMENT-ENTERPRISE",
    "mapping_id": "MAP-EVAL-COMMITMENT-ENTERPRISE",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-COMMITMENT-ENTERPRISE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "performance_fact",
      "verification_fact"
    ],
    "source_hash": "436904108064623537ce28bbf03c06bd4cf289c5d29d44296603b9f4526393d2",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-COMMITMENT-ENTERPRISE",
        "evidence_identifier": "FACT-EVAL-COMMITMENT-ENTERPRISE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "performance_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "QUANTITATIVE_UNSUPPORTED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-COMMITMENT-ENTERPRISE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "commitment_distinction",
        "reject",
        "QUANTITATIVE_UNSUPPORTED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-COMMITMENT-ENTERPRISE",
      "requirement_hash": "d3e24c3e2ab1624e135299ca343d53a686c37e954aab68473d27898545c40226",
      "contract_version": "canonical-requirement-v1",
      "text": "系统接口响应P95应不超过1秒。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-COMMITMENT-ENTERPRISE",
          "evidence_identifier": "FACT-EVAL-COMMITMENT-ENTERPRISE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "performance_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司现有平台接口响应P95不超过1秒。",
      "semantics": {
        "subject": "接口服务",
        "entities": [],
        "scope": [
          "performance_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "QUANTITATIVE_UNSUPPORTED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-COMMITMENT-PROJECT

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-COMMITMENT-PROJECT",
  "quality_class": "commitment_distinction",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-COMMITMENT-PROJECT",
    "requirement_hash": "c4640241c109e983b92c8ce7d39f5850346747ba9f4acec2794c9252cc93a347",
    "contract_version": "canonical-requirement-v1",
    "text": "系统接口响应P95应不超过1秒。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-COMMITMENT-PROJECT",
    "requirement_id": "REQ-EVAL-COMMITMENT-PROJECT",
    "claim_type": "response_commitment",
    "basis_evidence_ids": [
      "FACT-EVAL-COMMITMENT-PROJECT"
    ],
    "text": "本项目将按招标要求开展性能设计和验收。",
    "metadata": {
      "subject": "接口服务",
      "entities": [],
      "scope": [
        "performance_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-COMMITMENT-PROJECT",
    "mapping_id": "MAP-EVAL-COMMITMENT-PROJECT",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-COMMITMENT-PROJECT",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "performance_fact",
      "verification_fact"
    ],
    "source_hash": "bcc60384f0406ee028fcc230a6c59a1c070a18268342c497582be193feb8a665",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-COMMITMENT-PROJECT",
        "evidence_identifier": "FACT-EVAL-COMMITMENT-PROJECT",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "performance_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-COMMITMENT-PROJECT",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "commitment_distinction",
        "needs_review"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-COMMITMENT-PROJECT",
      "requirement_hash": "c4640241c109e983b92c8ce7d39f5850346747ba9f4acec2794c9252cc93a347",
      "contract_version": "canonical-requirement-v1",
      "text": "系统接口响应P95应不超过1秒。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-COMMITMENT-PROJECT",
          "evidence_identifier": "FACT-EVAL-COMMITMENT-PROJECT",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "performance_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目将按招标要求开展性能设计和验收。",
      "semantics": {
        "subject": "接口服务",
        "entities": [],
        "scope": [
          "performance_fact",
          "verification_fact"
        ]
      },
      "claim_type": "response_commitment",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": true,
      "enterprise_capability": false
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STATUS-AWARD

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STATUS-AWARD",
  "quality_class": "status_overclaim",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STATUS-AWARD",
    "requirement_hash": "d57ecc75012cc14f26d68c968f563f32a27ce52d624954d57b9a470e6ede5462",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具有相关项目实施经验。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STATUS-AWARD",
    "requirement_id": "REQ-EVAL-STATUS-AWARD",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STATUS-AWARD"
    ],
    "text": "我司已完成该项目全部建设内容。",
    "metadata": {
      "subject": "项目A",
      "entities": [],
      "scope": [
        "project_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STATUS-AWARD",
    "mapping_id": "MAP-EVAL-STATUS-AWARD",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STATUS-AWARD",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "project_fact",
      "award_fact"
    ],
    "source_hash": "5c5faeb7f37682909a42a2dd2205c6f598d45aa2d8958ac080bed8c1068e133c",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STATUS-AWARD",
        "evidence_identifier": "FACT-EVAL-STATUS-AWARD",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "项目A"
        },
        "entities_json": [],
        "fact_status": "award",
        "fact_scopes_json": [
          "project_fact",
          "award_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "STATUS_OVERCLAIM",
      "EVIDENCE_SCOPE_EXCEEDED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STATUS-AWARD",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "status_overclaim",
        "reject",
        "STATUS_OVERCLAIM",
        "EVIDENCE_SCOPE_EXCEEDED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STATUS-AWARD",
      "requirement_hash": "d57ecc75012cc14f26d68c968f563f32a27ce52d624954d57b9a470e6ede5462",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具有相关项目实施经验。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STATUS-AWARD",
          "evidence_identifier": "FACT-EVAL-STATUS-AWARD",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "项目A"
          },
          "entities_json": [],
          "fact_status": "award",
          "fact_scopes_json": [
            "project_fact",
            "award_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司已完成该项目全部建设内容。",
      "semantics": {
        "subject": "项目A",
        "entities": [],
        "scope": [
          "project_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "STATUS_OVERCLAIM",
        "EVIDENCE_SCOPE_EXCEEDED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-SCOPE-BROAD

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-SCOPE-BROAD",
  "quality_class": "scope_overclaim",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-SCOPE-BROAD",
    "requirement_hash": "1eb17f94d1136cf7dd05e2e02a0d1796a139ac968e0b37b985a72259b362f398",
    "contract_version": "canonical-requirement-v1",
    "text": "产品应支持统一认证。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-SCOPE-BROAD",
    "requirement_id": "REQ-EVAL-SCOPE-BROAD",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-SCOPE-BROAD"
    ],
    "text": "我司全部产品已验证支持统一认证。",
    "metadata": {
      "subject": "产品A",
      "entities": [
        "产品A"
      ],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-SCOPE-BROAD",
    "mapping_id": "MAP-EVAL-SCOPE-BROAD",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-SCOPE-BROAD",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "523b278e271dd60bdd220c3808e589712b7a22e619e7a250bb276bdfefa12086",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-SCOPE-BROAD",
        "evidence_identifier": "FACT-EVAL-SCOPE-BROAD",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "产品A"
        },
        "entities_json": [
          {
            "type": "capability",
            "name": "产品A"
          }
        ],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "ENTITY_MISMATCH",
      "EVIDENCE_SCOPE_EXCEEDED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-SCOPE-BROAD",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "scope_overclaim",
        "reject",
        "ENTITY_MISMATCH",
        "EVIDENCE_SCOPE_EXCEEDED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-SCOPE-BROAD",
      "requirement_hash": "1eb17f94d1136cf7dd05e2e02a0d1796a139ac968e0b37b985a72259b362f398",
      "contract_version": "canonical-requirement-v1",
      "text": "产品应支持统一认证。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-SCOPE-BROAD",
          "evidence_identifier": "FACT-EVAL-SCOPE-BROAD",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "产品A"
          },
          "entities_json": [
            {
              "type": "capability",
              "name": "产品A"
            }
          ],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司全部产品已验证支持统一认证。",
      "semantics": {
        "subject": "产品A",
        "entities": [
          "产品A"
        ],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "ENTITY_MISMATCH",
        "EVIDENCE_SCOPE_EXCEEDED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-QUANTITY-OVERCLAIM

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-QUANTITY-OVERCLAIM",
  "quality_class": "quantity_overclaim",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-QUANTITY-OVERCLAIM",
    "requirement_hash": "a11f8320abacbbc1d473582d658d2c4a5b84ea861e24ac69ab61ff81a4f769e0",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持100并发用户。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-QUANTITY-OVERCLAIM",
    "requirement_id": "REQ-EVAL-QUANTITY-OVERCLAIM",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-QUANTITY-OVERCLAIM"
    ],
    "text": "系统已验证支持1000并发用户。",
    "metadata": {
      "subject": "并发服务",
      "entities": [],
      "scope": [
        "performance_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-QUANTITY-OVERCLAIM",
    "mapping_id": "MAP-EVAL-QUANTITY-OVERCLAIM",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-QUANTITY-OVERCLAIM",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "performance_fact",
      "verification_fact"
    ],
    "source_hash": "b7493f90497cc9fa2ada74243800cba1846f7e3e7cd3bd72eb89ad24f2d15926",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-QUANTITY-OVERCLAIM",
        "evidence_identifier": "FACT-EVAL-QUANTITY-OVERCLAIM",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "并发服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "performance_fact",
          "verification_fact"
        ],
        "quantities_json": [
          {
            "metric": "concurrency",
            "operator": "eq",
            "value": "100",
            "unit": "并发"
          }
        ],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "QUANTITATIVE_UNSUPPORTED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-QUANTITY-OVERCLAIM",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "quantity_overclaim",
        "reject",
        "QUANTITATIVE_UNSUPPORTED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-QUANTITY-OVERCLAIM",
      "requirement_hash": "a11f8320abacbbc1d473582d658d2c4a5b84ea861e24ac69ab61ff81a4f769e0",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持100并发用户。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-QUANTITY-OVERCLAIM",
          "evidence_identifier": "FACT-EVAL-QUANTITY-OVERCLAIM",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "并发服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "performance_fact",
            "verification_fact"
          ],
          "quantities_json": [
            {
              "metric": "concurrency",
              "operator": "eq",
              "value": "100",
              "unit": "并发"
            }
          ],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "系统已验证支持1000并发用户。",
      "semantics": {
        "subject": "并发服务",
        "entities": [],
        "scope": [
          "performance_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "QUANTITATIVE_UNSUPPORTED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-ENTITY-OVERCLAIM

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-ENTITY-OVERCLAIM",
  "quality_class": "entity_overclaim",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-ENTITY-OVERCLAIM",
    "requirement_hash": "893da81bb7f74cec2013dbc5c0e61c70ab57e905762727bcedbd004d1931e523",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应提供统一认证能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-ENTITY-OVERCLAIM",
    "requirement_id": "REQ-EVAL-ENTITY-OVERCLAIM",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-ENTITY-OVERCLAIM"
    ],
    "text": "集团公司已验证具备统一认证能力。",
    "metadata": {
      "subject": "集团公司",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-ENTITY-OVERCLAIM",
    "mapping_id": "MAP-EVAL-ENTITY-OVERCLAIM",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-ENTITY-OVERCLAIM",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "0b15e5dc53ea4d541a75612e99ae5407c9f5c084b19b2174938d0795b7272c2b",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-ENTITY-OVERCLAIM",
        "evidence_identifier": "FACT-EVAL-ENTITY-OVERCLAIM",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "子公司A"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "ENTITY_MISMATCH"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-ENTITY-OVERCLAIM",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "entity_overclaim",
        "reject",
        "ENTITY_MISMATCH"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-ENTITY-OVERCLAIM",
      "requirement_hash": "893da81bb7f74cec2013dbc5c0e61c70ab57e905762727bcedbd004d1931e523",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应提供统一认证能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-ENTITY-OVERCLAIM",
          "evidence_identifier": "FACT-EVAL-ENTITY-OVERCLAIM",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "子公司A"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "集团公司已验证具备统一认证能力。",
      "semantics": {
        "subject": "集团公司",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "ENTITY_MISMATCH"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STALE-EXPIRED

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STALE-EXPIRED",
  "quality_class": "stale_currentness",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STALE-EXPIRED",
    "requirement_hash": "d2e13587a13bede4eea9489123cf4928e73276facb0142a3ba8a19b9b4d96863",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备有效资质。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STALE-EXPIRED",
    "requirement_id": "REQ-EVAL-STALE-EXPIRED",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STALE-EXPIRED"
    ],
    "text": "资质证书已验证有效。",
    "metadata": {
      "subject": "资质证书",
      "entities": [],
      "scope": [
        "qualification_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STALE-EXPIRED",
    "mapping_id": "MAP-EVAL-STALE-EXPIRED",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STALE-EXPIRED",
    "approval_status": "approved",
    "validity_status": "expired",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "qualification_fact",
      "verification_fact"
    ],
    "source_hash": "bed6ec79fa0c14cf337544bed16fd8d95ca364b8bd68957e3ebb8149ab957d76",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STALE-EXPIRED",
        "evidence_identifier": "FACT-EVAL-STALE-EXPIRED",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "资质证书"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "qualification_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "EVIDENCE_EXPIRED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STALE-EXPIRED",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "stale_currentness",
        "reject",
        "EVIDENCE_EXPIRED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STALE-EXPIRED",
      "requirement_hash": "d2e13587a13bede4eea9489123cf4928e73276facb0142a3ba8a19b9b4d96863",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备有效资质。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STALE-EXPIRED",
          "evidence_identifier": "FACT-EVAL-STALE-EXPIRED",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "资质证书"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "qualification_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "expired",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "资质证书已验证有效。",
      "semantics": {
        "subject": "资质证书",
        "entities": [],
        "scope": [
          "qualification_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "EVIDENCE_EXPIRED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-STALE-REVOKED

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-STALE-REVOKED",
  "quality_class": "stale_currentness",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-STALE-REVOKED",
    "requirement_hash": "878c1c6b3e62b7a7fa9ac9000ab085b010f8410d0e5b5760581300db3237b2d3",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备有效资质。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-STALE-REVOKED",
    "requirement_id": "REQ-EVAL-STALE-REVOKED",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-STALE-REVOKED"
    ],
    "text": "资质证书已验证有效。",
    "metadata": {
      "subject": "资质证书",
      "entities": [],
      "scope": [
        "qualification_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-STALE-REVOKED",
    "mapping_id": "MAP-EVAL-STALE-REVOKED",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-STALE-REVOKED",
    "approval_status": "approved",
    "validity_status": "revoked",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "qualification_fact",
      "verification_fact"
    ],
    "source_hash": "eb3708edb8fb7fdc79ce8fb18abcf9419a846355207eac88f23822ffd13f33a5",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-STALE-REVOKED",
        "evidence_identifier": "FACT-EVAL-STALE-REVOKED",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "资质证书"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "qualification_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "EVIDENCE_EXPIRED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-STALE-REVOKED",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "stale_currentness",
        "reject",
        "EVIDENCE_EXPIRED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-STALE-REVOKED",
      "requirement_hash": "878c1c6b3e62b7a7fa9ac9000ab085b010f8410d0e5b5760581300db3237b2d3",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备有效资质。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-STALE-REVOKED",
          "evidence_identifier": "FACT-EVAL-STALE-REVOKED",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "资质证书"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "qualification_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "revoked",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "资质证书已验证有效。",
      "semantics": {
        "subject": "资质证书",
        "entities": [],
        "scope": [
          "qualification_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "EVIDENCE_EXPIRED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-MISSING-LINEAGE

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-MISSING-LINEAGE",
  "quality_class": "lineage_integrity",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-MISSING-LINEAGE",
    "requirement_hash": "626dbdb911e316fe487b8c2041f37ab3973d6dc835c8dd0943b5a9b37e9e58e8",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备接口集成能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-MISSING-LINEAGE",
    "requirement_id": "REQ-EVAL-MISSING-LINEAGE",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-MISSING-LINEAGE"
    ],
    "text": "接口服务已验证可用。",
    "metadata": {
      "subject": "接口服务",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-MISSING-LINEAGE",
    "mapping_id": "MAP-EVAL-MISSING-LINEAGE",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-MISSING-LINEAGE",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": false,
    "usable_for_claims": false,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "b05b4b51e8c25b5f0a75aa4ece1c131b9780439336f16b55f562201189b8f869",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-MISSING-LINEAGE",
        "evidence_identifier": "FACT-EVAL-MISSING-LINEAGE",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "SOURCE_LINEAGE_REQUIRED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-MISSING-LINEAGE",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "lineage_integrity",
        "reject",
        "SOURCE_LINEAGE_REQUIRED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-MISSING-LINEAGE",
      "requirement_hash": "626dbdb911e316fe487b8c2041f37ab3973d6dc835c8dd0943b5a9b37e9e58e8",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备接口集成能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-MISSING-LINEAGE",
          "evidence_identifier": "FACT-EVAL-MISSING-LINEAGE",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": false,
        "usable_for_claims": false
      }
    },
    "claim_candidate": {
      "assertion_text": "接口服务已验证可用。",
      "semantics": {
        "subject": "接口服务",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "SOURCE_LINEAGE_REQUIRED"
      ],
      "lineage_current": false,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-MAPPING-PENDING

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-MAPPING-PENDING",
  "quality_class": "authorization_boundary",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-MAPPING-PENDING",
    "requirement_hash": "c9e83287f6b300d049b7cfae642bc5b5c6b7459aec236c3e6a2c4fea59b4da34",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备接口集成能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-MAPPING-PENDING",
    "requirement_id": "REQ-EVAL-MAPPING-PENDING",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-MAPPING-PENDING"
    ],
    "text": "接口服务已验证可用。",
    "metadata": {
      "subject": "接口服务",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-MAPPING-PENDING",
    "mapping_id": "MAP-EVAL-MAPPING-PENDING",
    "mapping_status": "proposed",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-MAPPING-PENDING",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "798161df7638a3f75ed7ee532e1cc4c6ff6f6dc58b65442ca46c39440b861412",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-MAPPING-PENDING",
        "evidence_identifier": "FACT-EVAL-MAPPING-PENDING",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "接口服务"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "MAPPING_NOT_APPROVED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-MAPPING-PENDING",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "authorization_boundary",
        "reject",
        "MAPPING_NOT_APPROVED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-MAPPING-PENDING",
      "requirement_hash": "c9e83287f6b300d049b7cfae642bc5b5c6b7459aec236c3e6a2c4fea59b4da34",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备接口集成能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-MAPPING-PENDING",
          "evidence_identifier": "FACT-EVAL-MAPPING-PENDING",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "接口服务"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "proposed",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "接口服务已验证可用。",
      "semantics": {
        "subject": "接口服务",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "MAPPING_NOT_APPROVED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-HISTORICAL-BID

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-HISTORICAL-BID",
  "quality_class": "reference_authority",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-HISTORICAL-BID",
    "requirement_hash": "b13aa1820243be0facbbfc8e5d02810bfef6045746a0323e202df684f9fec607",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备项目实施经验。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-HISTORICAL-BID",
    "requirement_id": "REQ-EVAL-HISTORICAL-BID",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-HISTORICAL-BID"
    ],
    "text": "我司具备该项目实施经验。",
    "metadata": {
      "subject": "历史标书材料",
      "entities": [],
      "scope": [
        "project_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-HISTORICAL-BID",
    "mapping_id": "MAP-EVAL-HISTORICAL-BID",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-HISTORICAL-BID",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "historical_bid",
    "evidence_scope": [
      "project_fact",
      "completion_fact"
    ],
    "source_hash": "b4f1cdf2be1fdf4a5ae45f8cfbd85c537657a3b95bb659bfbd15d5d69f7bf575",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-HISTORICAL-BID",
        "evidence_identifier": "FACT-EVAL-HISTORICAL-BID",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "历史标书材料"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "project_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "SOURCE_NOT_USABLE"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-HISTORICAL-BID",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "reference_authority",
        "reject",
        "SOURCE_NOT_USABLE"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-HISTORICAL-BID",
      "requirement_hash": "b13aa1820243be0facbbfc8e5d02810bfef6045746a0323e202df684f9fec607",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备项目实施经验。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-HISTORICAL-BID",
          "evidence_identifier": "FACT-EVAL-HISTORICAL-BID",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "历史标书材料"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "project_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "我司具备该项目实施经验。",
      "semantics": {
        "subject": "历史标书材料",
        "entities": [],
        "scope": [
          "project_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "SOURCE_NOT_USABLE"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-REFERENCE-ONLY

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-REFERENCE-ONLY",
  "quality_class": "reference_authority",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-REFERENCE-ONLY",
    "requirement_hash": "5892177fb56225dc36ac432135331e11f5ea6bee3982fd9a8c2d733215973465",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备项目实施经验。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-REFERENCE-ONLY",
    "requirement_id": "REQ-EVAL-REFERENCE-ONLY",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-REFERENCE-ONLY"
    ],
    "text": "项目材料可作为相关能力参考。",
    "metadata": {
      "subject": "项目材料",
      "entities": [],
      "scope": [
        "project_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-REFERENCE-ONLY",
    "mapping_id": "MAP-EVAL-REFERENCE-ONLY",
    "mapping_status": "approved",
    "support_level": "reference_only",
    "evidence_id": "FACT-EVAL-REFERENCE-ONLY",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "project_fact",
      "completion_fact"
    ],
    "source_hash": "ce6f7ad88be187880dcc80c16f453cdcea2b0c370ac82bb07cce05c5831050c9",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-REFERENCE-ONLY",
        "evidence_identifier": "FACT-EVAL-REFERENCE-ONLY",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "项目材料"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "project_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "restrict",
    "writer_eligible": false,
    "reason_codes": [
      "REFERENCE_ONLY"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-REFERENCE-ONLY",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "reference_authority",
        "restrict",
        "REFERENCE_ONLY"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-REFERENCE-ONLY",
      "requirement_hash": "5892177fb56225dc36ac432135331e11f5ea6bee3982fd9a8c2d733215973465",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备项目实施经验。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-REFERENCE-ONLY",
          "evidence_identifier": "FACT-EVAL-REFERENCE-ONLY",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "项目材料"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "project_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "reference_only",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "项目材料可作为相关能力参考。",
      "semantics": {
        "subject": "项目材料",
        "entities": [],
        "scope": [
          "project_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "restrict",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "REFERENCE_ONLY"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": true,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-SUPPORT-UNKNOWN

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-SUPPORT-UNKNOWN",
  "quality_class": "support_authority",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-SUPPORT-UNKNOWN",
    "requirement_hash": "97e876ac795a952af784bbc438841c88ff806b20df721cc17f44ce06b816cd0f",
    "contract_version": "canonical-requirement-v1",
    "text": "供应商应具备项目实施经验。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-SUPPORT-UNKNOWN",
    "requirement_id": "REQ-EVAL-SUPPORT-UNKNOWN",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-SUPPORT-UNKNOWN"
    ],
    "text": "项目材料支持相关能力。",
    "metadata": {
      "subject": "项目材料",
      "entities": [],
      "scope": [
        "project_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-SUPPORT-UNKNOWN",
    "mapping_id": "MAP-EVAL-SUPPORT-UNKNOWN",
    "mapping_status": "approved",
    "support_level": "unknown",
    "evidence_id": "FACT-EVAL-SUPPORT-UNKNOWN",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "project_fact",
      "completion_fact"
    ],
    "source_hash": "3e1465cf9dac4b9869b94cd1a7912e091061f183f885a423dae275debeaf1e29",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-SUPPORT-UNKNOWN",
        "evidence_identifier": "FACT-EVAL-SUPPORT-UNKNOWN",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "项目材料"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "project_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "reject",
    "writer_eligible": false,
    "reason_codes": [
      "SUPPORT_INSUFFICIENT"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-SUPPORT-UNKNOWN",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "support_authority",
        "reject",
        "SUPPORT_INSUFFICIENT"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-SUPPORT-UNKNOWN",
      "requirement_hash": "97e876ac795a952af784bbc438841c88ff806b20df721cc17f44ce06b816cd0f",
      "contract_version": "canonical-requirement-v1",
      "text": "供应商应具备项目实施经验。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-SUPPORT-UNKNOWN",
          "evidence_identifier": "FACT-EVAL-SUPPORT-UNKNOWN",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "项目材料"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "project_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "unknown",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "项目材料支持相关能力。",
      "semantics": {
        "subject": "项目材料",
        "entities": [],
        "scope": [
          "project_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "SUPPORT_INSUFFICIENT"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-COMPOSITE-STATUS-CONFLICT

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-COMPOSITE-STATUS-CONFLICT",
  "quality_class": "composite_boundary",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-COMPOSITE-STATUS-CONFLICT",
    "requirement_hash": "2152269299f5a4f28e527e6e43544f014f4b3a36d84ab6cc5760f904efe0904c",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持已完成的统一认证能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-COMPOSITE-STATUS-CONFLICT",
    "requirement_id": "REQ-EVAL-COMPOSITE-STATUS-CONFLICT",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-COMPOSITE-STATUS-CONFLICT"
    ],
    "text": "统一认证能力已完成建设。",
    "metadata": {
      "subject": "统一认证",
      "entities": [],
      "scope": [
        "capability_fact",
        "completion_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-COMPOSITE-STATUS-CONFLICT",
    "mapping_id": "MAP-EVAL-COMPOSITE-STATUS-CONFLICT",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "completion_fact"
    ],
    "source_hash": "7ac733d7182ff22b96d33c40e26652c5cf6b78c367d4b813611abbdc5db9539f",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
        "evidence_identifier": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities_json": [],
        "fact_status": "completed",
        "fact_scopes_json": [
          "capability_fact",
          "completion_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      },
      {
        "fact_id": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT-2",
        "evidence_identifier": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [
      "HUMAN_REVIEW_REQUIRED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-COMPOSITE-STATUS-CONFLICT",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "composite_boundary",
        "needs_review",
        "HUMAN_REVIEW_REQUIRED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-COMPOSITE-STATUS-CONFLICT",
      "requirement_hash": "2152269299f5a4f28e527e6e43544f014f4b3a36d84ab6cc5760f904efe0904c",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持已完成的统一认证能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
          "evidence_identifier": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities_json": [],
          "fact_status": "completed",
          "fact_scopes_json": [
            "capability_fact",
            "completion_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        },
        {
          "fact_id": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT-2",
          "evidence_identifier": "FACT-EVAL-COMPOSITE-STATUS-CONFLICT",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "统一认证能力已完成建设。",
      "semantics": {
        "subject": "统一认证",
        "entities": [],
        "scope": [
          "capability_fact",
          "completion_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "HUMAN_REVIEW_REQUIRED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CQ-COMPOSITE-SUBJECT-CONFLICT

```json
{
  "section": "SCORED_GOLD/QUALITY",
  "case_id": "CQ-COMPOSITE-SUBJECT-CONFLICT",
  "quality_class": "composite_boundary",
  "dataset_classification": "REPRESENTATIVE_SYNTHETIC",
  "real_customer_data": false,
  "requirement": {
    "req_id": "REQ-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "requirement_hash": "e492c5efe7c112a1906c38ec974fa64fb4eca8c56bb517fc8c6c77ddd3ac8c43",
    "contract_version": "canonical-requirement-v1",
    "text": "系统应支持统一认证能力。"
  },
  "claim": {
    "claim_id": "CLM-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "requirement_id": "REQ-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "claim_type": "enterprise_capability",
    "basis_evidence_ids": [
      "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT"
    ],
    "text": "统一认证能力已验证可用。",
    "metadata": {
      "subject": "产品A",
      "entities": [],
      "scope": [
        "capability_fact",
        "verification_fact"
      ]
    }
  },
  "binding": {
    "project_id": "CLAIM-EVAL-SYNTHETIC",
    "requirement_id": "REQ-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "mapping_id": "MAP-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "mapping_status": "approved",
    "support_level": "full_support",
    "evidence_id": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
    "approval_status": "approved",
    "validity_status": "active",
    "source_lineage_verified": true,
    "usable_for_claims": true,
    "material_type": "project_case",
    "evidence_scope": [
      "capability_fact",
      "verification_fact"
    ],
    "source_hash": "b3f14494e797786ea5a984042ce4c2a5d314f0069faa37cfed88d84f6868ad7b",
    "evidence_facts": [
      {
        "fact_id": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
        "evidence_identifier": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "产品A"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      },
      {
        "fact_id": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT-2",
        "evidence_identifier": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
        "project_id": "CLAIM-EVAL-SYNTHETIC",
        "review_status": "approved",
        "is_current": true,
        "version": 1,
        "fact_type": "capability",
        "subject_json": {
          "type": "capability",
          "name": "产品B"
        },
        "entities_json": [],
        "fact_status": "verified",
        "fact_scopes_json": [
          "capability_fact",
          "verification_fact"
        ],
        "quantities_json": [],
        "validity_json": {
          "status": "active"
        }
      }
    ],
    "content": "Representative synthetic evidence content.",
    "source_text": "Representative synthetic source text."
  },
  "expected": {
    "decision": "needs_review",
    "writer_eligible": false,
    "reason_codes": [
      "HUMAN_REVIEW_REQUIRED"
    ],
    "critical": true,
    "useful_evidence": false
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "CQ-COMPOSITE-SUBJECT-CONFLICT",
      "layer": "CLAIM_QUALITY",
      "active": true,
      "scored": true,
      "classification": "SCORED_GOLD / REPRESENTATIVE_SYNTHETIC",
      "source_fixture": "backend/eval/evidence-gold/claim-quality-cases.js",
      "tags": [
        "composite_boundary",
        "needs_review",
        "HUMAN_REVIEW_REQUIRED"
      ]
    },
    "requirement": {
      "req_id": "REQ-EVAL-COMPOSITE-SUBJECT-CONFLICT",
      "requirement_hash": "e492c5efe7c112a1906c38ec974fa64fb4eca8c56bb517fc8c6c77ddd3ac8c43",
      "contract_version": "canonical-requirement-v1",
      "text": "系统应支持统一认证能力。"
    },
    "upstream_authority": {
      "fact": [
        {
          "fact_id": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
          "evidence_identifier": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "产品A"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        },
        {
          "fact_id": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT-2",
          "evidence_identifier": "FACT-EVAL-COMPOSITE-SUBJECT-CONFLICT",
          "project_id": "CLAIM-EVAL-SYNTHETIC",
          "review_status": "approved",
          "is_current": true,
          "version": 1,
          "fact_type": "capability",
          "subject_json": {
            "type": "capability",
            "name": "产品B"
          },
          "entities_json": [],
          "fact_status": "verified",
          "fact_scopes_json": [
            "capability_fact",
            "verification_fact"
          ],
          "quantities_json": [],
          "validity_json": {
            "status": "active"
          }
        }
      ],
      "mapping_relationship": "approved",
      "support_level": "full_support",
      "dimensions": "NOT_PRESENT_IN_FIXTURE",
      "evidence_readiness": {
        "approval_status": "approved",
        "validity_status": "active",
        "source_lineage_verified": true,
        "usable_for_claims": true
      }
    },
    "claim_candidate": {
      "assertion_text": "统一认证能力已验证可用。",
      "semantics": {
        "subject": "产品A",
        "entities": [],
        "scope": [
          "capability_fact",
          "verification_fact"
        ]
      },
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_FIXTURE",
      "required_conditions": "NOT_PRESENT_IN_FIXTURE",
      "limitations": "NOT_PRESENT_IN_FIXTURE",
      "reason_codes": [
        "HUMAN_REVIEW_REQUIRED"
      ],
      "lineage_current": true,
      "current": "NOT_PRESENT_IN_FIXTURE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "NOT_AUTHORED"
  }
}
```

## CLM-001-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-1-1",
  "evidence_case_id": "EVD-001-01",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 248,
          "anchor_char_end": 289,
          "anchor_chunk_hash": "64739a2b900319c0ec60bb99ed1b1a2f74c67967b4eef2d3f7ea0f9d27c3c583",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-001-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-1-2",
  "evidence_case_id": "EVD-001-01",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 248,
          "anchor_char_end": 289,
          "anchor_chunk_hash": "64739a2b900319c0ec60bb99ed1b1a2f74c67967b4eef2d3f7ea0f9d27c3c583",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-001-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-2-1",
  "evidence_case_id": "EVD-001-02",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 370,
          "anchor_char_end": 389,
          "anchor_chunk_hash": "6bd025f2f6875159b1d6358fc294fbaa4a6ddd183c8325a9e28680fe4a00ea98",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-001-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-2-2",
  "evidence_case_id": "EVD-001-02",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 370,
          "anchor_char_end": 389,
          "anchor_chunk_hash": "6bd025f2f6875159b1d6358fc294fbaa4a6ddd183c8325a9e28680fe4a00ea98",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-001-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-3-1",
  "evidence_case_id": "EVD-001-03",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-001-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-001-3-2",
  "evidence_case_id": "EVD-001-03",
  "requirement_id": "REQ-001",
  "claim_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-001-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-001",
      "requirement_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "制定统一的技术标准、数据标准和业务标准，通过“一网统管”核心平台和数字底座实现城市治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-1-1",
  "evidence_case_id": "EVD-015-01",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-1-2",
  "evidence_case_id": "EVD-015-01",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-2-1",
  "evidence_case_id": "EVD-015-02",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 514,
          "anchor_char_end": 525,
          "anchor_chunk_hash": "fdc88a76490a48c8bf49db1445aebe887cf1f7b3c79867da5f715e233f533533",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-2-2",
  "evidence_case_id": "EVD-015-02",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 514,
          "anchor_char_end": 525,
          "anchor_chunk_hash": "fdc88a76490a48c8bf49db1445aebe887cf1f7b3c79867da5f715e233f533533",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-3-1",
  "evidence_case_id": "EVD-015-03",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 617,
          "anchor_char_end": 659,
          "anchor_chunk_hash": "2ed4f5cc69ef370398f1c7deb48803ca938413fc334ce5c25106ff2fc4073685",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-015-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-015-3-2",
  "evidence_case_id": "EVD-015-03",
  "requirement_id": "REQ-015",
  "claim_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-015-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-015",
      "requirement_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 617,
          "anchor_char_end": 659,
          "anchor_chunk_hash": "2ed4f5cc69ef370398f1c7deb48803ca938413fc334ce5c25106ff2fc4073685",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "兼容X86架构，配合支持国产化的操作系统和数据库改造。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-016-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-016-01",
  "requirement_id": "REQ-016",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "review_status": "approved",
  "case_id": "CLM-016-1",
  "system_output": {
    "dimensions": {
      "subject_match": "unknown",
      "entity_match": "match",
      "status_match": "unknown",
      "scope_match": "match",
      "quantitative_match": "not_applicable",
      "validity_match": "unknown",
      "support_sufficiency": "partial",
      "source_authority": "usable"
    },
    "reason_codes": [
      "HUMAN_REVIEW_REQUIRED"
    ],
    "decision": "needs_review",
    "writer_eligible": false
  },
  "claim_text": "材料提供系统集成能力参考。",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "match",
    "status_match": "unknown",
    "scope_match": "match",
    "quantitative_match": "not_applicable",
    "validity_match": "unknown",
    "support_sufficiency": "partial",
    "source_authority": "usable"
  },
  "expected_reason_codes": [
    "HUMAN_REVIEW_REQUIRED"
  ],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_notes": "材料不含一秒响应指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [
          "系统集成"
        ],
        "fact_status": "unknown",
        "fact_scopes": [
          "integration_capability_reference"
        ],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "match",
        "status_match": "unknown",
        "scope_match": "match",
        "quantitative_match": "not_applicable",
        "validity_match": "unknown",
        "support_sufficiency": "partial",
        "source_authority": "usable"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": "911ef7337ec4bfe4c8d6f50b2757ee230dc1e9c064914d3a5991ed076aefb21d"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "材料提供系统集成能力参考。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "HUMAN_REVIEW_REQUIRED"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "材料不含一秒响应指标。"
  }
}
```

## CLM-016-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-016-01",
  "requirement_id": "REQ-016",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "review_status": "approved",
  "case_id": "CLM-016-2",
  "system_output": {
    "dimensions": {
      "subject_match": "unknown",
      "entity_match": "match",
      "status_match": "unknown",
      "scope_match": "match",
      "quantitative_match": "mismatch",
      "validity_match": "unknown",
      "support_sufficiency": "partial",
      "source_authority": "usable"
    },
    "reason_codes": [
      "QUANTITATIVE_UNSUPPORTED"
    ],
    "decision": "reject",
    "writer_eligible": false
  },
  "claim_text": "系统集成接口响应时间不超过1秒。",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "match",
    "status_match": "unknown",
    "scope_match": "match",
    "quantitative_match": "mismatch",
    "validity_match": "unknown",
    "support_sufficiency": "partial",
    "source_authority": "usable"
  },
  "expected_reason_codes": [
    "QUANTITATIVE_UNSUPPORTED"
  ],
  "expected_decision": "reject",
  "expected_writer_eligible": false,
  "review_notes": "量化指标没有企业材料依据。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [
          "系统集成"
        ],
        "fact_status": "unknown",
        "fact_scopes": [
          "integration_capability_reference"
        ],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "match",
        "status_match": "unknown",
        "scope_match": "match",
        "quantitative_match": "mismatch",
        "validity_match": "unknown",
        "support_sufficiency": "partial",
        "source_authority": "usable"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": "911ef7337ec4bfe4c8d6f50b2757ee230dc1e9c064914d3a5991ed076aefb21d"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统集成接口响应时间不超过1秒。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "QUANTITATIVE_UNSUPPORTED"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "量化指标没有企业材料依据。"
  }
}
```

## CLM-016-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-016-2-1",
  "evidence_case_id": "EVD-016-02",
  "requirement_id": "REQ-016",
  "claim_text": "数据服务类接口响应时间需<=1秒。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务类接口响应时间需<=1秒。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-016-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-016-2-2",
  "evidence_case_id": "EVD-016-02",
  "requirement_id": "REQ-016",
  "claim_text": "数据服务类接口响应时间需<=1秒。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务类接口响应时间需<=1秒。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-016-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-016-3-1",
  "evidence_case_id": "EVD-016-03",
  "requirement_id": "REQ-016",
  "claim_text": "数据服务类接口响应时间需<=1秒。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 330,
          "anchor_char_end": 338,
          "anchor_chunk_hash": "ad9844834f47cdf6faa96b25cf6f64c11840237865462fd1480be18884b7fb38",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务类接口响应时间需<=1秒。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-016-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-016-3-2",
  "evidence_case_id": "EVD-016-03",
  "requirement_id": "REQ-016",
  "claim_text": "数据服务类接口响应时间需<=1秒。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-016-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-016",
      "requirement_text": "数据服务类接口响应时间需<=1秒。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 330,
          "anchor_char_end": 338,
          "anchor_chunk_hash": "ad9844834f47cdf6faa96b25cf6f64c11840237865462fd1480be18884b7fb38",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "数据服务类接口响应时间需<=1秒。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-1-1",
  "evidence_case_id": "EVD-027-01",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-1-2",
  "evidence_case_id": "EVD-027-01",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-2-1",
  "evidence_case_id": "EVD-027-02",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 759,
          "anchor_char_end": 1087,
          "anchor_chunk_hash": "3e6581fcab7d38429962ebbb1512de05fe85987644ce0cbfbfef5dbd2c6dbb66",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-2-2",
  "evidence_case_id": "EVD-027-02",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 759,
          "anchor_char_end": 1087,
          "anchor_chunk_hash": "3e6581fcab7d38429962ebbb1512de05fe85987644ce0cbfbfef5dbd2c6dbb66",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-3-1",
  "evidence_case_id": "EVD-027-03",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 514,
          "anchor_char_end": 525,
          "anchor_chunk_hash": "fdc88a76490a48c8bf49db1445aebe887cf1f7b3c79867da5f715e233f533533",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-027-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-027-3-2",
  "evidence_case_id": "EVD-027-03",
  "requirement_id": "REQ-027",
  "claim_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-027-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-027",
      "requirement_text": "系统安全性好，按用户需求设定严格安全等级。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 514,
          "anchor_char_end": 525,
          "anchor_chunk_hash": "fdc88a76490a48c8bf49db1445aebe887cf1f7b3c79867da5f715e233f533533",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "系统安全性好，按用户需求设定严格安全等级。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-030-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-030-01",
  "requirement_id": "REQ-030",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "review_status": "approved",
  "case_id": "CLM-030-1",
  "system_output": {
    "dimensions": {
      "subject_match": "match",
      "entity_match": "match",
      "status_match": "match",
      "scope_match": "match",
      "quantitative_match": "not_applicable",
      "validity_match": "match",
      "support_sufficiency": "partial",
      "source_authority": "usable"
    },
    "reason_codes": [
      "HUMAN_REVIEW_REQUIRED"
    ],
    "decision": "needs_review",
    "writer_eligible": false
  },
  "claim_text": "东软集团股份有限公司中标数据共享交换平台管理中心软件。",
  "expected_dimensions": {
    "subject_match": "match",
    "entity_match": "match",
    "status_match": "match",
    "scope_match": "match",
    "quantitative_match": "not_applicable",
    "validity_match": "match",
    "support_sufficiency": "partial",
    "source_authority": "usable"
  },
  "expected_reason_codes": [
    "HUMAN_REVIEW_REQUIRED"
  ],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_notes": "原文只证明中标事实，不证明完成或验收。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "东软集团股份有限公司",
        "entities": [
          "数据共享交换平台管理中心软件"
        ],
        "fact_status": "award",
        "fact_scopes": [
          "award_fact"
        ],
        "quantities": [],
        "validity": "not_applicable"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "match",
        "entity_match": "match",
        "status_match": "match",
        "scope_match": "match",
        "quantitative_match": "not_applicable",
        "validity_match": "match",
        "support_sufficiency": "partial",
        "source_authority": "usable"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 545,
          "anchor_char_end": 564,
          "anchor_chunk_hash": "b678b47c22955e02c27fd84fd561022fb2c1773216834ab6e73bafab0ccedba3",
          "expected_source_hash": "852f3c682d66dd7b52fec16548895e10aaa648000b1427dadc9c653dbc2bcb05"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "东软集团股份有限公司中标数据共享交换平台管理中心软件。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "HUMAN_REVIEW_REQUIRED"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "原文只证明中标事实，不证明完成或验收。"
  }
}
```

## CLM-030-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-030-01",
  "requirement_id": "REQ-030",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "review_status": "approved",
  "case_id": "CLM-030-2",
  "system_output": {
    "dimensions": {
      "subject_match": "match",
      "entity_match": "match",
      "status_match": "mismatch",
      "scope_match": "mismatch",
      "quantitative_match": "not_applicable",
      "validity_match": "match",
      "support_sufficiency": "partial",
      "source_authority": "usable"
    },
    "reason_codes": [
      "STATUS_OVERCLAIM",
      "EVIDENCE_SCOPE_EXCEEDED"
    ],
    "decision": "reject",
    "writer_eligible": false
  },
  "claim_text": "东软集团股份有限公司已完成并验收数据共享交换平台全部建设内容。",
  "expected_dimensions": {
    "subject_match": "match",
    "entity_match": "match",
    "status_match": "mismatch",
    "scope_match": "mismatch",
    "quantitative_match": "not_applicable",
    "validity_match": "match",
    "support_sufficiency": "partial",
    "source_authority": "usable"
  },
  "expected_reason_codes": [
    "STATUS_OVERCLAIM",
    "EVIDENCE_SCOPE_EXCEEDED"
  ],
  "expected_decision": "reject",
  "expected_writer_eligible": false,
  "review_notes": "award 不得扩张为 completed/accepted。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "东软集团股份有限公司",
        "entities": [
          "数据共享交换平台管理中心软件"
        ],
        "fact_status": "award",
        "fact_scopes": [
          "award_fact"
        ],
        "quantities": [],
        "validity": "not_applicable"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "match",
        "entity_match": "match",
        "status_match": "mismatch",
        "scope_match": "mismatch",
        "quantitative_match": "not_applicable",
        "validity_match": "match",
        "support_sufficiency": "partial",
        "source_authority": "usable"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 545,
          "anchor_char_end": 564,
          "anchor_chunk_hash": "b678b47c22955e02c27fd84fd561022fb2c1773216834ab6e73bafab0ccedba3",
          "expected_source_hash": "852f3c682d66dd7b52fec16548895e10aaa648000b1427dadc9c653dbc2bcb05"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "东软集团股份有限公司已完成并验收数据共享交换平台全部建设内容。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "STATUS_OVERCLAIM",
        "EVIDENCE_SCOPE_EXCEEDED"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "award 不得扩张为 completed/accepted。"
  }
}
```

## CLM-030-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-030-2-1",
  "evidence_case_id": "EVD-030-02",
  "requirement_id": "REQ-030",
  "claim_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-030-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-030-2-2",
  "evidence_case_id": "EVD-030-02",
  "requirement_id": "REQ-030",
  "claim_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-030-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-030-3-1",
  "evidence_case_id": "EVD-030-03",
  "requirement_id": "REQ-030",
  "claim_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-030-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-030-3-2",
  "evidence_case_id": "EVD-030-03",
  "requirement_id": "REQ-030",
  "claim_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-030-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-030",
      "requirement_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "通过数据交换共享平台实现与其它异构系统之间的数据交换和共享。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-1-1",
  "evidence_case_id": "EVD-047-01",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 260,
          "anchor_char_end": 293,
          "anchor_chunk_hash": "e9d1852a844168de46d33f31c8d55e2ed53c30aa117b7f22a1fc820f97dd7ec7",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-1-2",
  "evidence_case_id": "EVD-047-01",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 260,
          "anchor_char_end": 293,
          "anchor_chunk_hash": "e9d1852a844168de46d33f31c8d55e2ed53c30aa117b7f22a1fc820f97dd7ec7",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-2-1",
  "evidence_case_id": "EVD-047-02",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 811,
          "anchor_char_end": 870,
          "anchor_chunk_hash": "1c91db2af866891c8b84e2a9d5951b208252aa5a1189f6a0f3ce04431802da9b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-2-2",
  "evidence_case_id": "EVD-047-02",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 811,
          "anchor_char_end": 870,
          "anchor_chunk_hash": "1c91db2af866891c8b84e2a9d5951b208252aa5a1189f6a0f3ce04431802da9b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-3-1",
  "evidence_case_id": "EVD-047-03",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 404,
          "anchor_char_end": 430,
          "anchor_chunk_hash": "3714b377e96b5fd0049be2d94a48d700d3861bc681f288a7147ffe2169b503ef",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-047-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-047-3-2",
  "evidence_case_id": "EVD-047-03",
  "requirement_id": "REQ-047",
  "claim_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-047-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-047",
      "requirement_text": "本项目部署在政务云平台，要求供应商具备云服务能力。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 404,
          "anchor_char_end": 430,
          "anchor_chunk_hash": "3714b377e96b5fd0049be2d94a48d700d3861bc681f288a7147ffe2169b503ef",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "本项目部署在政务云平台，要求供应商具备云服务能力。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-1-1",
  "evidence_case_id": "EVD-048-01",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 182,
          "anchor_char_end": 188,
          "anchor_chunk_hash": "510a50d662b0bbd7d5b263d570125ca3cc8c30b06fe73e0ab0653640e2795937",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-1-2",
  "evidence_case_id": "EVD-048-01",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 182,
          "anchor_char_end": 188,
          "anchor_chunk_hash": "510a50d662b0bbd7d5b263d570125ca3cc8c30b06fe73e0ab0653640e2795937",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-2-1",
  "evidence_case_id": "EVD-048-02",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 401,
          "anchor_char_end": 422,
          "anchor_chunk_hash": "b2d5cfb9260c1a2567d5b117af2ce63cc001c13c7918176de6799b4465710c9d",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-2-2",
  "evidence_case_id": "EVD-048-02",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 401,
          "anchor_char_end": 422,
          "anchor_chunk_hash": "b2d5cfb9260c1a2567d5b117af2ce63cc001c13c7918176de6799b4465710c9d",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-3-1",
  "evidence_case_id": "EVD-048-03",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 228,
          "anchor_char_end": 246,
          "anchor_chunk_hash": "8cd5f5f4748b1d687707d202e0f06438aec372925dfd3b8cd9b93792748d1f3b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-048-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-048-3-2",
  "evidence_case_id": "EVD-048-03",
  "requirement_id": "REQ-048",
  "claim_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-048-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-048",
      "requirement_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 228,
          "anchor_char_end": 246,
          "anchor_chunk_hash": "8cd5f5f4748b1d687707d202e0f06438aec372925dfd3b8cd9b93792748d1f3b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "平台必须能够与外部风险防范和网格联动平台无缝对接。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-1-1",
  "evidence_case_id": "EVD-059-01",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-1-2",
  "evidence_case_id": "EVD-059-01",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 335,
          "anchor_char_end": 341,
          "anchor_chunk_hash": "fb8777920d6b9ff664626a85788f57027e0f7bc4e4fb52dec130fd47597a1204",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-2-1",
  "evidence_case_id": "EVD-059-02",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-2-2",
  "evidence_case_id": "EVD-059-02",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 340,
          "anchor_char_end": 358,
          "anchor_chunk_hash": "6336677b4ab418a310644287e52056c0d4bffeb53d2d2769243aebb8b62ea25e",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-3-1",
  "evidence_case_id": "EVD-059-03",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 360,
          "anchor_char_end": 368,
          "anchor_chunk_hash": "365365b722f9c1d5145859faae559b7de485aefa5a123318d79bac01d99b4e19",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-059-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-059-3-2",
  "evidence_case_id": "EVD-059-03",
  "requirement_id": "REQ-059",
  "claim_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-059-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-059",
      "requirement_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 360,
          "anchor_char_end": 368,
          "anchor_chunk_hash": "365365b722f9c1d5145859faae559b7de485aefa5a123318d79bac01d99b4e19",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "事件汇聚收发网关应汇聚实时事件并对事件数据进行治理。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-1-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-1-1",
  "evidence_case_id": "EVD-070-01",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-1-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 401,
          "anchor_char_end": 422,
          "anchor_chunk_hash": "b2d5cfb9260c1a2567d5b117af2ce63cc001c13c7918176de6799b4465710c9d",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-1-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-1-2",
  "evidence_case_id": "EVD-070-01",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-1-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 401,
          "anchor_char_end": 422,
          "anchor_chunk_hash": "b2d5cfb9260c1a2567d5b117af2ce63cc001c13c7918176de6799b4465710c9d",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-2-1",
  "evidence_case_id": "EVD-070-02",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 360,
          "anchor_char_end": 368,
          "anchor_chunk_hash": "365365b722f9c1d5145859faae559b7de485aefa5a123318d79bac01d99b4e19",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-2-2",
  "evidence_case_id": "EVD-070-02",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 360,
          "anchor_char_end": 368,
          "anchor_chunk_hash": "365365b722f9c1d5145859faae559b7de485aefa5a123318d79bac01d99b4e19",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-3-1",
  "evidence_case_id": "EVD-070-03",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 370,
          "anchor_char_end": 389,
          "anchor_chunk_hash": "6bd025f2f6875159b1d6358fc294fbaa4a6ddd183c8325a9e28680fe4a00ea98",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-070-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-070-3-2",
  "evidence_case_id": "EVD-070-03",
  "requirement_id": "REQ-070",
  "claim_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-070-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-070",
      "requirement_text": "构建平台精网微格体系、警网融合应用和网格学院。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 370,
          "anchor_char_end": 389,
          "anchor_chunk_hash": "6bd025f2f6875159b1d6358fc294fbaa4a6ddd183c8325a9e28680fe4a00ea98",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "构建平台精网微格体系、警网融合应用和网格学院。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-187-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-187-01",
  "requirement_id": "REQ-187",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "reference_only",
  "review_status": "approved",
  "case_id": "CLM-187-1",
  "system_output": {
    "dimensions": {
      "subject_match": "unknown",
      "entity_match": "match",
      "status_match": "unknown",
      "scope_match": "match",
      "quantitative_match": "not_applicable",
      "validity_match": "unknown",
      "support_sufficiency": "insufficient",
      "source_authority": "reference_only"
    },
    "reason_codes": [
      "REFERENCE_ONLY"
    ],
    "decision": "restrict",
    "writer_eligible": false
  },
  "claim_text": "材料列示ISO9001:2015资质信息，可供参考。",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "match",
    "status_match": "unknown",
    "scope_match": "match",
    "quantitative_match": "not_applicable",
    "validity_match": "unknown",
    "support_sufficiency": "insufficient",
    "source_authority": "reference_only"
  },
  "expected_reason_codes": [
    "REFERENCE_ONLY"
  ],
  "expected_decision": "restrict",
  "expected_writer_eligible": false,
  "review_notes": "资质清单不能证明指定防火墙检测报告。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [
          "ISO9001:2015"
        ],
        "fact_status": "unknown",
        "fact_scopes": [
          "qualification_fact"
        ],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "reference_only",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "match",
        "status_match": "unknown",
        "scope_match": "match",
        "quantitative_match": "not_applicable",
        "validity_match": "unknown",
        "support_sufficiency": "insufficient",
        "source_authority": "reference_only"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 198,
          "anchor_char_end": 204,
          "anchor_chunk_hash": "11df61a7d0ccecdd5a6f25860832d5c0c28805c428b9ab06e6dd3e171fe1f238",
          "expected_source_hash": "1fa44899e3fe5a0a037cb13660d0d8a400df14244b0d778381948d785a045b63"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "材料列示ISO9001:2015资质信息，可供参考。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "restrict",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "REFERENCE_ONLY"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "资质清单不能证明指定防火墙检测报告。"
  }
}
```

## CLM-187-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "evidence_case_id": "EVD-187-01",
  "requirement_id": "REQ-187",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "reference_only",
  "review_status": "approved",
  "case_id": "CLM-187-2",
  "system_output": {
    "dimensions": {
      "subject_match": "unknown",
      "entity_match": "mismatch",
      "status_match": "unknown",
      "scope_match": "mismatch",
      "quantitative_match": "not_applicable",
      "validity_match": "unknown",
      "support_sufficiency": "insufficient",
      "source_authority": "reference_only"
    },
    "reason_codes": [
      "ENTITY_MISMATCH",
      "EVIDENCE_SCOPE_EXCEEDED",
      "REFERENCE_ONLY"
    ],
    "decision": "reject",
    "writer_eligible": false
  },
  "claim_text": "材料证明我司持有ISO9001:2015并已取得指定防火墙检测报告。",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "mismatch",
    "status_match": "unknown",
    "scope_match": "mismatch",
    "quantitative_match": "not_applicable",
    "validity_match": "unknown",
    "support_sufficiency": "insufficient",
    "source_authority": "reference_only"
  },
  "expected_reason_codes": [
    "ENTITY_MISMATCH",
    "EVIDENCE_SCOPE_EXCEEDED",
    "REFERENCE_ONLY"
  ],
  "expected_decision": "reject",
  "expected_writer_eligible": false,
  "review_notes": "增加了原文没有的证书主体和检测报告实体。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "approved",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [
          "ISO9001:2015"
        ],
        "fact_status": "unknown",
        "fact_scopes": [
          "qualification_fact"
        ],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "reference_only",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "mismatch",
        "status_match": "unknown",
        "scope_match": "mismatch",
        "quantitative_match": "not_applicable",
        "validity_match": "unknown",
        "support_sufficiency": "insufficient",
        "source_authority": "reference_only"
      },
      "evidence_readiness": {
        "review_status": "approved",
        "source_reference": {
          "anchor_char_start": 198,
          "anchor_char_end": 204,
          "anchor_chunk_hash": "11df61a7d0ccecdd5a6f25860832d5c0c28805c428b9ab06e6dd3e171fe1f238",
          "expected_source_hash": "1fa44899e3fe5a0a037cb13660d0d8a400df14244b0d778381948d785a045b63"
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "材料证明我司持有ISO9001:2015并已取得指定防火墙检测报告。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "reject",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [
        "ENTITY_MISMATCH",
        "EVIDENCE_SCOPE_EXCEEDED",
        "REFERENCE_ONLY"
      ],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "增加了原文没有的证书主体和检测报告实体。"
  }
}
```

## CLM-187-2-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-187-2-1",
  "evidence_case_id": "EVD-187-02",
  "requirement_id": "REQ-187",
  "claim_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-2-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 563,
          "anchor_char_end": 586,
          "anchor_chunk_hash": "73accccfb1f39a941ec8540b5e4f73c97f60b87685087b10245a82e7bd3afea2",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-187-2-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-187-2-2",
  "evidence_case_id": "EVD-187-02",
  "requirement_id": "REQ-187",
  "claim_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-2-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 563,
          "anchor_char_end": 586,
          "anchor_chunk_hash": "73accccfb1f39a941ec8540b5e4f73c97f60b87685087b10245a82e7bd3afea2",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-187-3-1

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-187-3-1",
  "evidence_case_id": "EVD-187-03",
  "requirement_id": "REQ-187",
  "claim_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-3-1",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 588,
          "anchor_char_end": 615,
          "anchor_chunk_hash": "171538e3360511061bb23c712e37d3e5254e89f7c113cc2f8a75253690f98d4b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

## CLM-187-3-2

```json
{
  "section": "RETAINED_LEGACY/NOT_SCORED",
  "case_id": "CLM-187-3-2",
  "evidence_case_id": "EVD-187-03",
  "requirement_id": "REQ-187",
  "claim_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。（候选边界扩张探针，待人工审核）",
  "claim_type": "enterprise_capability",
  "mapping_support_level": "partial_support",
  "expected_dimensions": {
    "subject_match": "unknown",
    "entity_match": "unknown",
    "status_match": "unknown",
    "scope_match": "unknown",
    "quantitative_match": "unknown",
    "validity_match": "unknown",
    "support_sufficiency": "unknown",
    "source_authority": "unknown"
  },
  "expected_reason_codes": [],
  "expected_decision": "needs_review",
  "expected_writer_eligible": false,
  "review_status": "pending",
  "review_notes": "仅为人工审核候选，不计入正式指标。",
  "human_review_sections": {
    "metadata": {
      "case_id": "CLM-187-3-2",
      "layer": "CLAIM_LEGACY",
      "active": false,
      "scored": false,
      "classification": "RETAINED_LEGACY / REAL_PUBLIC_DERIVED_LIVE_PROJECT",
      "source_fixture": "backend/eval/evidence-gold/gold-candidates.json",
      "tags": [
        "pending",
        "legacy-source-slice"
      ]
    },
    "requirement": {
      "requirement_id": "REQ-187",
      "requirement_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。",
      "requirement_hash": null
    },
    "upstream_authority": {
      "fact": {
        "subject": "unknown",
        "entities": [],
        "fact_status": "unknown",
        "fact_scopes": [],
        "quantities": [],
        "validity": "unknown"
      },
      "mapping_relationship": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "support_level": "partial_support",
      "dimensions": {
        "subject_match": "unknown",
        "entity_match": "unknown",
        "status_match": "unknown",
        "scope_match": "unknown",
        "quantitative_match": "unknown",
        "validity_match": "unknown",
        "support_sufficiency": "unknown",
        "source_authority": "unknown"
      },
      "evidence_readiness": {
        "review_status": "pending",
        "source_reference": {
          "anchor_char_start": 588,
          "anchor_char_end": 615,
          "anchor_chunk_hash": "171538e3360511061bb23c712e37d3e5254e89f7c113cc2f8a75253690f98d4b",
          "expected_source_hash": null
        }
      }
    },
    "claim_candidate": {
      "assertion_text": "防火墙需支持一体化安全策略并提供第三方权威检测报告扫描件。（候选边界扩张探针，待人工审核）",
      "semantics": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "claim_type": "enterprise_capability",
      "assertion_hash": null
    },
    "expected_gate": {
      "decision": "needs_review",
      "writer_eligible": false,
      "allowed_scope": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "required_conditions": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "limitations": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "reason_codes": [],
      "lineage_current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE",
      "current": "NOT_PRESENT_IN_LEGACY_CLAIM_SLICE"
    },
    "quality_expectation": {
      "strong_retention": false,
      "narrow_retention": false,
      "false_hard_reject": false,
      "useful_evidence_utilization": false,
      "project_commitment": false,
      "enterprise_capability": true
    },
    "rationale": "仅为人工审核候选，不计入正式指标。"
  }
}
```

