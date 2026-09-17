# Mapping Gold Full Human Review

每条记录完整保留源 case，并显式展示 Requirement、Fact、Expected Mapping、Dimensions、Lineage 与 rationale 字段。`NOT_AUTHORED`/`NOT_PRESENT_IN_MAPPING_GOLD` 表示源 Gold 未提供该字段。

## MAP-G001

```json
{
  "case_id": "MAP-G001",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "已完成统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F001",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G001",
    "label": "direct full",
    "requirement": {
      "text": "已完成统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F001",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G001",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "direct full"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "已完成统一认证项目",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F001",
        "fact_ref": "F001",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F001",
          "subject": {
            "type": "project",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G002

```json
{
  "case_id": "MAP-G002",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供统一认证能力"
    },
    "facts": [
      {
        "fact_ref": "F002",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G002",
    "label": "direct full N/A status",
    "requirement": {
      "text": "提供统一认证能力"
    },
    "facts": [
      {
        "fact_ref": "F002",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G002",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "direct full N/A status"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供统一认证能力",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F002",
        "fact_ref": "F002",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F002",
          "subject": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G003

```json
{
  "case_id": "MAP-G003",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "统一认证与权限管理"
    },
    "facts": [
      {
        "fact_ref": "F003",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G003",
    "label": "partial capability",
    "requirement": {
      "text": "统一认证与权限管理"
    },
    "facts": [
      {
        "fact_ref": "F003",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G003",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "partial capability"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "统一认证与权限管理",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F003",
        "fact_ref": "F003",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F003",
          "subject": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G004

```json
{
  "case_id": "MAP-G004",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "国产数据库适配案例"
    },
    "facts": [
      {
        "fact_ref": "F004",
        "subject": {
          "type": "technology",
          "name": "数据库技术方案"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "related_reference",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G004",
    "label": "related reference",
    "requirement": {
      "text": "国产数据库适配案例"
    },
    "facts": [
      {
        "fact_ref": "F004",
        "subject": {
          "type": "technology",
          "name": "数据库技术方案"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "related_reference",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G004",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "related reference"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "国产数据库适配案例",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F004",
        "fact_ref": "F004",
        "subject": {
          "type": "technology",
          "name": "数据库技术方案"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F004",
          "subject": {
            "type": "technology",
            "name": "数据库技术方案"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "technical_reference"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "related_reference",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G005

```json
{
  "case_id": "MAP-G005",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供已验收的统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F005",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "related_insufficient",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G005",
    "label": "related insufficient",
    "requirement": {
      "text": "提供已验收的统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F005",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "related_insufficient",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "mismatch",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G005",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "related insufficient"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供已验收的统一认证项目",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F005",
        "fact_ref": "F005",
        "subject": {
          "type": "project",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F005",
          "subject": {
            "type": "project",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "in_progress",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "related_insufficient",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G006

```json
{
  "case_id": "MAP-G006",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F006",
        "subject": {
          "type": "project",
          "name": "财务报销"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unrelated",
    "dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G006",
    "label": "unrelated",
    "requirement": {
      "text": "提供统一认证项目"
    },
    "facts": [
      {
        "fact_ref": "F006",
        "subject": {
          "type": "project",
          "name": "财务报销"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "unrelated",
      "dimensions": {
        "subject": "mismatch",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G006",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "unrelated"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供统一认证项目",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F006",
        "fact_ref": "F006",
        "subject": {
          "type": "project",
          "name": "财务报销"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F006",
          "subject": {
            "type": "project",
            "name": "财务报销"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unrelated",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G007

```json
{
  "case_id": "MAP-G007",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "支持10000并发用户",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "10000",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F007",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "concurrency",
            "value": "1000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "conflict",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G007",
    "label": "conflict quantity",
    "requirement": {
      "text": "支持10000并发用户",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "10000",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F007",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "concurrency",
            "value": "1000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "conflict",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "mismatch",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G007",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "conflict quantity"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "支持10000并发用户",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F007",
        "fact_ref": "F007",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "concurrency",
            "value": "1000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F007",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [
            {
              "metric": "concurrency",
              "value": "1000",
              "unit": "user"
            }
          ],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "conflict",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G008

```json
{
  "case_id": "MAP-G008",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "已完成并验收的项目",
      "status": "completed"
    },
    "facts": [
      {
        "fact_ref": "F008",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G008",
    "label": "status mismatch",
    "requirement": {
      "text": "已完成并验收的项目",
      "status": "completed"
    },
    "facts": [
      {
        "fact_ref": "F008",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "mismatch",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G008",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "status mismatch"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "已完成并验收的项目",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F008",
        "fact_ref": "F008",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F008",
          "subject": {
            "type": "project",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "in_progress",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G009

```json
{
  "case_id": "MAP-G009",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "集团范围部署",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F009",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G009",
    "label": "scope mismatch",
    "requirement": {
      "text": "集团范围部署",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F009",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "mismatch",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G009",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "scope mismatch"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "集团范围部署",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F009",
        "fact_ref": "F009",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F009",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "subsidiary"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G010

```json
{
  "case_id": "MAP-G010",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "为甲公司建设平台",
      "entities": [
        {
          "type": "company",
          "name": "甲公司"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F010",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "乙公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G010",
    "label": "entity mismatch",
    "requirement": {
      "text": "为甲公司建设平台",
      "entities": [
        {
          "type": "company",
          "name": "甲公司"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F010",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "乙公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "mismatch",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G010",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "entity mismatch"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "为甲公司建设平台",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F010",
        "fact_ref": "F010",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "乙公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F010",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [
            {
              "type": "company",
              "name": "乙公司"
            }
          ],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G011

```json
{
  "case_id": "MAP-G011",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "当前有效许可",
      "validity": {
        "status": "active"
      }
    },
    "facts": [
      {
        "fact_ref": "F011",
        "subject": {
          "type": "license",
          "name": "许可"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "expired"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "mismatch"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G011",
    "label": "validity mismatch",
    "requirement": {
      "text": "当前有效许可",
      "validity": {
        "status": "active"
      }
    },
    "facts": [
      {
        "fact_ref": "F011",
        "subject": {
          "type": "license",
          "name": "许可"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "expired"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "mismatch"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G011",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "validity mismatch"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "当前有效许可",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F011",
        "fact_ref": "F011",
        "subject": {
          "type": "license",
          "name": "许可"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "expired"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F011",
          "subject": {
            "type": "license",
            "name": "许可"
          },
          "entities": [],
          "fact_status": "verified",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "expired"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "mismatch"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G012

```json
{
  "case_id": "MAP-G012",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供日志审计能力"
    },
    "facts": [
      {
        "fact_ref": "F012",
        "subject": {
          "type": "capability",
          "name": "日志审计"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G012",
    "label": "N/A quantity",
    "requirement": {
      "text": "提供日志审计能力"
    },
    "facts": [
      {
        "fact_ref": "F012",
        "subject": {
          "type": "capability",
          "name": "日志审计"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G012",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "N/A quantity"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供日志审计能力",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F012",
        "fact_ref": "F012",
        "subject": {
          "type": "capability",
          "name": "日志审计"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F012",
          "subject": {
            "type": "capability",
            "name": "日志审计"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G013

```json
{
  "case_id": "MAP-G013",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "具备备份能力"
    },
    "facts": [
      {
        "fact_ref": "F013",
        "subject": {
          "type": "capability",
          "name": "备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G013",
    "label": "N/A status",
    "requirement": {
      "text": "具备备份能力"
    },
    "facts": [
      {
        "fact_ref": "F013",
        "subject": {
          "type": "capability",
          "name": "备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G013",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "N/A status"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "具备备份能力",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F013",
        "fact_ref": "F013",
        "subject": {
          "type": "capability",
          "name": "备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F013",
          "subject": {
            "type": "capability",
            "name": "备份"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G014

```json
{
  "case_id": "MAP-G014",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "支持数据导出"
    },
    "facts": [
      {
        "fact_ref": "F014",
        "subject": {
          "type": "capability",
          "name": "数据导出"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G014",
    "label": "N/A validity",
    "requirement": {
      "text": "支持数据导出"
    },
    "facts": [
      {
        "fact_ref": "F014",
        "subject": {
          "type": "capability",
          "name": "数据导出"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G014",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "N/A validity"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "支持数据导出",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F014",
        "fact_ref": "F014",
        "subject": {
          "type": "capability",
          "name": "数据导出"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F014",
          "subject": {
            "type": "capability",
            "name": "数据导出"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G015

```json
{
  "case_id": "MAP-G015",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "支持100并发",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "100",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F015",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unknown",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "unknown",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G015",
    "label": "applicable unknown",
    "requirement": {
      "text": "支持100并发",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "100",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F015",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "unknown",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "unknown",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G015",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "applicable unknown"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "支持100并发",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F015",
        "fact_ref": "F015",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F015",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unknown",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "unknown",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G016

```json
{
  "case_id": "MAP-G016",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供容灾恢复服务"
    },
    "facts": [
      {
        "fact_ref": "F016",
        "subject": {
          "type": "capability",
          "name": "数据备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unrelated",
    "dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G016",
    "label": "similar topic false positive",
    "requirement": {
      "text": "提供容灾恢复服务"
    },
    "facts": [
      {
        "fact_ref": "F016",
        "subject": {
          "type": "capability",
          "name": "数据备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "unrelated",
      "dimensions": {
        "subject": "mismatch",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G016",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "similar topic false positive"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供容灾恢复服务",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F016",
        "fact_ref": "F016",
        "subject": {
          "type": "capability",
          "name": "数据备份"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F016",
          "subject": {
            "type": "capability",
            "name": "数据备份"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unrelated",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G017

```json
{
  "case_id": "MAP-G017",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "10000并发用户",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "10000",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F017",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "registered",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "registered_users",
            "value": "10000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "conflict",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G017",
    "label": "registered not concurrent",
    "requirement": {
      "text": "10000并发用户",
      "quantities": [
        {
          "metric": "concurrency",
          "value": "10000",
          "unit": "user"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F017",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "registered",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "registered_users",
            "value": "10000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "conflict",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "mismatch",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G017",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "registered not concurrent"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "10000并发用户",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F017",
        "fact_ref": "F017",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "registered",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "registered_users",
            "value": "10000",
            "unit": "user"
          }
        ],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F017",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "registered",
          "scopes": [
            "enterprise"
          ],
          "quantities": [
            {
              "metric": "registered_users",
              "value": "10000",
              "unit": "user"
            }
          ],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "conflict",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G018

```json
{
  "case_id": "MAP-G018",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "已完成项目",
      "status": "completed"
    },
    "facts": [
      {
        "fact_ref": "F018",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "participated",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G018",
    "label": "participated not completed",
    "requirement": {
      "text": "已完成项目",
      "status": "completed"
    },
    "facts": [
      {
        "fact_ref": "F018",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "participated",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "mismatch",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G018",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "participated not completed"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "已完成项目",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F018",
        "fact_ref": "F018",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "participated",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F018",
          "subject": {
            "type": "project",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "participated",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G019

```json
{
  "case_id": "MAP-G019",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "集团范围案例",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F019",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "集团子公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G019",
    "label": "subsidiary not group",
    "requirement": {
      "text": "集团范围案例",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F019",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "集团子公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "mismatch",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "mismatch",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G019",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "subsidiary not group"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "集团范围案例",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F019",
        "fact_ref": "F019",
        "subject": {
          "type": "project",
          "name": "平台"
        },
        "entities": [
          {
            "type": "company",
            "name": "集团子公司"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F019",
          "subject": {
            "type": "project",
            "name": "平台"
          },
          "entities": [
            {
              "type": "company",
              "name": "集团子公司"
            }
          ],
          "fact_status": "completed",
          "scopes": [
            "subsidiary"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G020

```json
{
  "case_id": "MAP-G020",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "当前项目经验"
    },
    "facts": [
      {
        "fact_ref": "F020",
        "subject": {
          "type": "project",
          "name": "历史项目"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "historical_bid"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "related_insufficient",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G020",
    "label": "historical contamination",
    "requirement": {
      "text": "当前项目经验"
    },
    "facts": [
      {
        "fact_ref": "F020",
        "subject": {
          "type": "project",
          "name": "历史项目"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "historical_bid"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "related_insufficient",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G020",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "historical contamination"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "当前项目经验",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F020",
        "fact_ref": "F020",
        "subject": {
          "type": "project",
          "name": "历史项目"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "historical_bid"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F020",
          "subject": {
            "type": "project",
            "name": "历史项目"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "historical_bid"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "related_insufficient",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G021

```json
{
  "case_id": "MAP-G021",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "统一认证和权限管理"
    },
    "facts": [
      {
        "fact_ref": "F021",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G021",
    "label": "multi-fact coverage first",
    "requirement": {
      "text": "统一认证和权限管理"
    },
    "facts": [
      {
        "fact_ref": "F021",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G021",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "multi-fact coverage first"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "统一认证和权限管理",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F021",
        "fact_ref": "F021",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F021",
          "subject": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G022

```json
{
  "case_id": "MAP-G022",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "统一认证和权限管理"
    },
    "facts": [
      {
        "fact_ref": "F022",
        "subject": {
          "type": "capability",
          "name": "权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G022",
    "label": "multi-fact coverage second",
    "requirement": {
      "text": "统一认证和权限管理"
    },
    "facts": [
      {
        "fact_ref": "F022",
        "subject": {
          "type": "capability",
          "name": "权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G022",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "multi-fact coverage second"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "统一认证和权限管理",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F022",
        "fact_ref": "F022",
        "subject": {
          "type": "capability",
          "name": "权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F022",
          "subject": {
            "type": "capability",
            "name": "权限管理"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G023

```json
{
  "case_id": "MAP-G023",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供统一认证"
    },
    "facts": []
  },
  "gold_expected_answer": {
    "decision": "unknown",
    "dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G023",
    "label": "zero evidence",
    "requirement": {
      "text": "提供统一认证"
    },
    "facts": [],
    "expected": {
      "decision": "unknown",
      "dimensions": {
        "subject": "unknown",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "unknown",
        "entity": "unknown",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G023",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "zero evidence"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供统一认证",
      "requirement_hash": null
    },
    "facts": [],
    "expected_mapping_gold": {
      "decision": "unknown",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G024

```json
{
  "case_id": "MAP-G024",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "当前平台版本"
    },
    "facts": [
      {
        "fact_ref": "F024",
        "subject": {
          "type": "system",
          "name": "旧平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "fact_current": false
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unknown",
    "dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G024",
    "label": "superseded fact",
    "requirement": {
      "text": "当前平台版本"
    },
    "facts": [
      {
        "fact_ref": "F024",
        "subject": {
          "type": "system",
          "name": "旧平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "fact_current": false
      }
    ],
    "expected": {
      "decision": "unknown",
      "dimensions": {
        "subject": "unknown",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "unknown",
        "entity": "unknown",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G024",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "superseded fact"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "当前平台版本",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F024",
        "fact_ref": "F024",
        "subject": {
          "type": "system",
          "name": "旧平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": false,
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F024",
          "subject": {
            "type": "system",
            "name": "旧平台"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          },
          "fact_current": false
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unknown",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G025

```json
{
  "case_id": "MAP-G025",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "本项目平台"
    },
    "facts": [
      {
        "fact_ref": "F025",
        "project_id": "other-project",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unknown",
    "dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G025",
    "label": "cross project fact",
    "requirement": {
      "text": "本项目平台"
    },
    "facts": [
      {
        "fact_ref": "F025",
        "project_id": "other-project",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "unknown",
      "dimensions": {
        "subject": "unknown",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "unknown",
        "entity": "unknown",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G025",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "cross project fact"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "本项目平台",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F025",
        "fact_ref": "F025",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F025",
          "project_id": "other-project",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unknown",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "unknown",
      "entity": "unknown",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G026

```json
{
  "case_id": "MAP-G026",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "统一认证与权限管理"
    },
    "facts": [
      {
        "fact_ref": "F026",
        "subject": {
          "type": "capability",
          "name": "统一认证与权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "backend_expected_support": "partial_support"
  },
  "full_case_record": {
    "case_id": "MAP-G026",
    "label": "upstream partial attempted full",
    "requirement": {
      "text": "统一认证与权限管理"
    },
    "facts": [
      {
        "fact_ref": "F026",
        "subject": {
          "type": "capability",
          "name": "统一认证与权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "upstream_support_level": "partial_support",
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      },
      "backend_expected_support": "partial_support"
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G026",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "upstream partial attempted full"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "统一认证与权限管理",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F026",
        "fact_ref": "F026",
        "subject": {
          "type": "capability",
          "name": "统一认证与权限管理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F026",
          "subject": {
            "type": "capability",
            "name": "统一认证与权限管理"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G027

```json
{
  "case_id": "MAP-G027",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "统一认证"
    },
    "facts": [
      {
        "fact_ref": "F027",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "direct_full",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "human_mapping_preserved": true
  },
  "full_case_record": {
    "case_id": "MAP-G027",
    "label": "human override",
    "requirement": {
      "text": "统一认证"
    },
    "facts": [
      {
        "fact_ref": "F027",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "existing_mapping": {
      "reviewer_type": "human",
      "review_status": "approved"
    },
    "expected": {
      "decision": "direct_full",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      },
      "human_mapping_preserved": true
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G027",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "human override"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "统一认证",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F027",
        "fact_ref": "F027",
        "subject": {
          "type": "capability",
          "name": "统一认证"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F027",
          "subject": {
            "type": "capability",
            "name": "统一认证"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "direct_full",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G028

```json
{
  "case_id": "MAP-G028",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "平台能力清单"
    },
    "facts": [
      {
        "fact_ref": "F028-1"
      },
      {
        "fact_ref": "F028-2"
      },
      {
        "fact_ref": "F028-3"
      },
      {
        "fact_ref": "F028-4"
      },
      {
        "fact_ref": "F028-5"
      },
      {
        "fact_ref": "F028-6"
      },
      {
        "fact_ref": "F028-7"
      }
    ]
  },
  "gold_expected_answer": {
    "batch_sizes": [
      6,
      1
    ],
    "all_fact_refs_required": true
  },
  "full_case_record": {
    "case_id": "MAP-G028",
    "label": "batch split six plus one",
    "requirement": {
      "text": "平台能力清单"
    },
    "facts": [
      {
        "fact_ref": "F028-1"
      },
      {
        "fact_ref": "F028-2"
      },
      {
        "fact_ref": "F028-3"
      },
      {
        "fact_ref": "F028-4"
      },
      {
        "fact_ref": "F028-5"
      },
      {
        "fact_ref": "F028-6"
      },
      {
        "fact_ref": "F028-7"
      }
    ],
    "expected": {
      "batch_sizes": [
        6,
        1
      ],
      "all_fact_refs_required": true
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G028",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "batch split six plus one"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "平台能力清单",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F028-1",
        "fact_ref": "F028-1",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-1"
        }
      },
      {
        "fact_id": "F028-2",
        "fact_ref": "F028-2",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-2"
        }
      },
      {
        "fact_id": "F028-3",
        "fact_ref": "F028-3",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-3"
        }
      },
      {
        "fact_id": "F028-4",
        "fact_ref": "F028-4",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-4"
        }
      },
      {
        "fact_id": "F028-5",
        "fact_ref": "F028-5",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-5"
        }
      },
      {
        "fact_id": "F028-6",
        "fact_ref": "F028-6",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-6"
        }
      },
      {
        "fact_id": "F028-7",
        "fact_ref": "F028-7",
        "subject": null,
        "entities": "NOT_PRESENT_IN_FIXTURE",
        "fact_status": null,
        "scopes": "NOT_PRESENT_IN_FIXTURE",
        "quantities": "NOT_PRESENT_IN_FIXTURE",
        "validity": null,
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F028-7"
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "NOT_AUTHORED",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "NOT_AUTHORED",
      "scope": "NOT_AUTHORED",
      "status": "NOT_AUTHORED",
      "quantity": "NOT_AUTHORED",
      "entity": "NOT_AUTHORED",
      "validity": "NOT_AUTHORED"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": false,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G029

```json
{
  "case_id": "MAP-G029",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "P95响应时间不超过1秒",
      "quantities": [
        {
          "metric": "p95_response_time",
          "value": "1",
          "unit": "second"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F029",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "p95_response_time",
            "value": "1.4",
            "unit": "second"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "conflict",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G029",
    "label": "performance threshold",
    "requirement": {
      "text": "P95响应时间不超过1秒",
      "quantities": [
        {
          "metric": "p95_response_time",
          "value": "1",
          "unit": "second"
        }
      ]
    },
    "facts": [
      {
        "fact_ref": "F029",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "p95_response_time",
            "value": "1.4",
            "unit": "second"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "conflict",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "mismatch",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G029",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "performance threshold"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "P95响应时间不超过1秒",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F029",
        "fact_ref": "F029",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "p95_response_time",
            "value": "1.4",
            "unit": "second"
          }
        ],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F029",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "verified",
          "scopes": [
            "enterprise"
          ],
          "quantities": [
            {
              "metric": "p95_response_time",
              "value": "1.4",
              "unit": "second"
            }
          ],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "conflict",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G030

```json
{
  "case_id": "MAP-G030",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "可用率99.99%"
    },
    "facts": [
      {
        "fact_ref": "F030",
        "subject": {
          "type": "service",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "availability",
            "value": "99.9",
            "unit": "percent"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "conflict",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G030",
    "label": "availability mismatch",
    "requirement": {
      "text": "可用率99.99%"
    },
    "facts": [
      {
        "fact_ref": "F030",
        "subject": {
          "type": "service",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "availability",
            "value": "99.9",
            "unit": "percent"
          }
        ],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "conflict",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "mismatch",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G030",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "availability mismatch"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "可用率99.99%",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F030",
        "fact_ref": "F030",
        "subject": {
          "type": "service",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [
          {
            "metric": "availability",
            "value": "99.9",
            "unit": "percent"
          }
        ],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F030",
          "subject": {
            "type": "service",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "verified",
          "scopes": [
            "enterprise"
          ],
          "quantities": [
            {
              "metric": "availability",
              "value": "99.9",
              "unit": "percent"
            }
          ],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "conflict",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "mismatch",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G031

```json
{
  "case_id": "MAP-G031",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "具备认证项目经理"
    },
    "facts": [
      {
        "fact_ref": "F031",
        "subject": {
          "type": "personnel",
          "name": "项目经理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G031",
    "label": "personnel qualification",
    "requirement": {
      "text": "具备认证项目经理"
    },
    "facts": [
      {
        "fact_ref": "F031",
        "subject": {
          "type": "personnel",
          "name": "项目经理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G031",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "personnel qualification"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "具备认证项目经理",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F031",
        "fact_ref": "F031",
        "subject": {
          "type": "personnel",
          "name": "项目经理"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F031",
          "subject": {
            "type": "personnel",
            "name": "项目经理"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G032

```json
{
  "case_id": "MAP-G032",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "由本企业直接交付平台"
    },
    "facts": [
      {
        "fact_ref": "F032",
        "subject": {
          "type": "service",
          "name": "平台集成"
        },
        "entities": [
          {
            "type": "vendor",
            "name": "第三方供应商"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G032",
    "label": "third-party dependency",
    "requirement": {
      "text": "由本企业直接交付平台"
    },
    "facts": [
      {
        "fact_ref": "F032",
        "subject": {
          "type": "service",
          "name": "平台集成"
        },
        "entities": [
          {
            "type": "vendor",
            "name": "第三方供应商"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "match",
        "scope": "match",
        "status": "match",
        "quantity": "not_applicable",
        "entity": "mismatch",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G032",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "third-party dependency"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "由本企业直接交付平台",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F032",
        "fact_ref": "F032",
        "subject": {
          "type": "service",
          "name": "平台集成"
        },
        "entities": [
          {
            "type": "vendor",
            "name": "第三方供应商"
          }
        ],
        "fact_status": "completed",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F032",
          "subject": {
            "type": "service",
            "name": "平台集成"
          },
          "entities": [
            {
              "type": "vendor",
              "name": "第三方供应商"
            }
          ],
          "fact_status": "completed",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "match",
      "status": "match",
      "quantity": "not_applicable",
      "entity": "mismatch",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G033

```json
{
  "case_id": "MAP-G033",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "使用指定品牌型号"
    },
    "facts": [
      {
        "fact_ref": "F033",
        "subject": {
          "type": "product",
          "name": "通用设备"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "partial_support",
    "dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "unknown"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G033",
    "label": "brand commitment",
    "requirement": {
      "text": "使用指定品牌型号"
    },
    "facts": [
      {
        "fact_ref": "F033",
        "subject": {
          "type": "product",
          "name": "通用设备"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "partial_support",
      "dimensions": {
        "subject": "mismatch",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "unknown"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G033",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "brand commitment"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "使用指定品牌型号",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F033",
        "fact_ref": "F033",
        "subject": {
          "type": "product",
          "name": "通用设备"
        },
        "entities": [],
        "fact_status": "verified",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F033",
          "subject": {
            "type": "product",
            "name": "通用设备"
          },
          "entities": [],
          "fact_status": "verified",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "partial_support",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "mismatch",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "unknown"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G034

```json
{
  "case_id": "MAP-G034",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "支持容灾演练"
    },
    "facts": [
      {
        "fact_ref": "F034",
        "subject": {
          "type": "document",
          "name": "灾备技术白皮书"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "related_reference",
    "dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G034",
    "label": "related technical context",
    "requirement": {
      "text": "支持容灾演练"
    },
    "facts": [
      {
        "fact_ref": "F034",
        "subject": {
          "type": "document",
          "name": "灾备技术白皮书"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "related_reference",
      "dimensions": {
        "subject": "match",
        "scope": "unknown",
        "status": "not_applicable",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G034",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "related technical context"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "支持容灾演练",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F034",
        "fact_ref": "F034",
        "subject": {
          "type": "document",
          "name": "灾备技术白皮书"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "technical_reference"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F034",
          "subject": {
            "type": "document",
            "name": "灾备技术白皮书"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "technical_reference"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "related_reference",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "unknown",
      "status": "not_applicable",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": false,
      "quality_case": true,
      "no_escalation_relevance": true
    }
  }
}
```

## MAP-G035

```json
{
  "case_id": "MAP-G035",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "提供数据治理能力"
    },
    "facts": [
      {
        "fact_ref": "F035",
        "subject": {
          "type": "capability",
          "name": "数据相关"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "unknown",
    "dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G035",
    "label": "unknown semantic result",
    "requirement": {
      "text": "提供数据治理能力"
    },
    "facts": [
      {
        "fact_ref": "F035",
        "subject": {
          "type": "capability",
          "name": "数据相关"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        }
      }
    ],
    "expected": {
      "decision": "unknown",
      "dimensions": {
        "subject": "unknown",
        "scope": "unknown",
        "status": "unknown",
        "quantity": "not_applicable",
        "entity": "unknown",
        "validity": "not_applicable"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G035",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "unknown semantic result"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "提供数据治理能力",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F035",
        "fact_ref": "F035",
        "subject": {
          "type": "capability",
          "name": "数据相关"
        },
        "entities": [],
        "fact_status": "unknown",
        "scopes": [
          "enterprise"
        ],
        "quantities": [],
        "validity": {
          "status": "unknown"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F035",
          "subject": {
            "type": "capability",
            "name": "数据相关"
          },
          "entities": [],
          "fact_status": "unknown",
          "scopes": [
            "enterprise"
          ],
          "quantities": [],
          "validity": {
            "status": "unknown"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "unknown",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "unknown",
      "scope": "unknown",
      "status": "unknown",
      "quantity": "not_applicable",
      "entity": "unknown",
      "validity": "not_applicable"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

## MAP-G036

```json
{
  "case_id": "MAP-G036",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "requirement": {
      "text": "集团已验收平台",
      "status": "accepted",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F036",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ]
  },
  "gold_expected_answer": {
    "decision": "conflict",
    "dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    }
  },
  "full_case_record": {
    "case_id": "MAP-G036",
    "label": "conflict status and scope",
    "requirement": {
      "text": "集团已验收平台",
      "status": "accepted",
      "scopes": [
        "group"
      ]
    },
    "facts": [
      {
        "fact_ref": "F036",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        }
      }
    ],
    "expected": {
      "decision": "conflict",
      "dimensions": {
        "subject": "match",
        "scope": "mismatch",
        "status": "mismatch",
        "quantity": "not_applicable",
        "entity": "not_applicable",
        "validity": "match"
      }
    }
  },
  "human_review_sections": {
    "metadata": {
      "case_id": "MAP-G036",
      "dataset": "requirement-evidence-mapping-v1-gold-2026-09-02",
      "source_fixture": "backend/eval/requirement-evidence-mapping-v1/gold-cases.json",
      "classification": "HUMAN_AUTHORED_STATIC / SCORED_GOLD",
      "active": true,
      "tags": [
        "conflict status and scope"
      ]
    },
    "requirement": {
      "requirement_id": null,
      "requirement_text": "集团已验收平台",
      "requirement_hash": null
    },
    "facts": [
      {
        "fact_id": "F036",
        "fact_ref": "F036",
        "subject": {
          "type": "system",
          "name": "平台"
        },
        "entities": [],
        "fact_status": "in_progress",
        "scopes": [
          "subsidiary"
        ],
        "quantities": [],
        "validity": {
          "status": "known"
        },
        "source_lineage": "NOT_PRESENT_IN_MAPPING_GOLD",
        "source_hashes": "NOT_PRESENT_IN_MAPPING_GOLD",
        "current_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "approval_status": "NOT_PRESENT_IN_MAPPING_GOLD",
        "full_canonical_fact_fields": {
          "fact_ref": "F036",
          "subject": {
            "type": "system",
            "name": "平台"
          },
          "entities": [],
          "fact_status": "in_progress",
          "scopes": [
            "subsidiary"
          ],
          "quantities": [],
          "validity": {
            "status": "known"
          }
        }
      }
    ],
    "expected_mapping_gold": {
      "decision": "conflict",
      "semantic_relationship": "NOT_AUTHORED",
      "support_level": "NOT_AUTHORED"
    },
    "expected_dimensions": {
      "subject": "match",
      "scope": "mismatch",
      "status": "mismatch",
      "quantity": "not_applicable",
      "entity": "not_applicable",
      "validity": "match"
    },
    "gold_rationale": "NOT_AUTHORED",
    "evaluation_expectations": {
      "pass_condition": "Production mapping projection matches the expected decision/dimensions supplied by this case.",
      "safety_critical": true,
      "quality_case": true,
      "no_escalation_relevance": false
    }
  }
}
```

