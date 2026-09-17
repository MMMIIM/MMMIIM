# Writer Gold Full Human Review

当前真正参与 Writer Fast Gate/scored Eval 的 8 条确定性 fixture 完整展开；Provider Fidelity Gold 未建立。

## project_response_only

```json
{
  "case_id": "project_response_only",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [
        {
          "requirement_id": "REQ-FAST-1",
          "text": "系统应支持统一认证。",
          "category": null,
          "mandatory": false,
          "response_mode": "REQUIREMENT_RESPONSE_ONLY",
          "enterprise_capability_assertion_allowed": false
        }
      ],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-55DDDA87F54DA6CCD69BED7EEC129374",
      "task_hash": "55ddda87f54da6ccd69bed7eec1293744703015d7b322c727aeb262d92564731"
    },
    "proposed_output": "本项目将按照招标要求开展统一认证设计。",
    "used_claim_refs": []
  },
  "gold_expected_answer": {
    "status": "pass",
    "metric": "requirement_laundering"
  },
  "full_case_record": {
    "id": "project_response_only",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [
        {
          "requirement_id": "REQ-FAST-1",
          "text": "系统应支持统一认证。",
          "category": null,
          "mandatory": false,
          "response_mode": "REQUIREMENT_RESPONSE_ONLY",
          "enterprise_capability_assertion_allowed": false
        }
      ],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-55DDDA87F54DA6CCD69BED7EEC129374",
      "task_hash": "55ddda87f54da6ccd69bed7eec1293744703015d7b322c727aeb262d92564731"
    },
    "output": "本项目将按照招标要求开展统一认证设计。",
    "expected": "pass",
    "metric": "requirement_laundering"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "requirement_laundering",
        "pass"
      ]
    },
    "requirement": [
      {
        "requirement_id": "REQ-FAST-1",
        "text": "系统应支持统一认证。",
        "category": null,
        "mandatory": false,
        "response_mode": "REQUIREMENT_RESPONSE_ONLY",
        "enterprise_capability_assertion_allowed": false
      }
    ],
    "authorized_claim": [],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [
          {
            "requirement_id": "REQ-FAST-1",
            "text": "系统应支持统一认证。",
            "category": null,
            "mandatory": false,
            "response_mode": "REQUIREMENT_RESPONSE_ONLY",
            "enterprise_capability_assertion_allowed": false
          }
        ],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-55DDDA87F54DA6CCD69BED7EEC129374",
        "task_hash": "55ddda87f54da6ccd69bed7eec1293744703015d7b322c727aeb262d92564731"
      },
      "proposed_output": "本项目将按照招标要求开展统一认证设计。",
      "used_claim_refs": []
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [
        "本项目将按照招标要求开展统一认证设计。"
      ],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": []
    },
    "expected_guard": {
      "status": "pass",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "本项目将按照招标要求开展统一认证设计。"
  }
}
```

## requirement_laundering_negative

```json
{
  "case_id": "requirement_laundering_negative",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [
        {
          "requirement_id": "REQ-FAST-2",
          "text": "系统应支持统一认证。",
          "category": null,
          "mandatory": false,
          "response_mode": "REQUIREMENT_RESPONSE_ONLY",
          "enterprise_capability_assertion_allowed": false
        }
      ],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-B59F26A0A3806823FD7A86EA3BB802EC",
      "task_hash": "b59f26a0a3806823fd7a86ea3bb802ec5ee17faa7f72ce75a76cc9a3d369bf7f"
    },
    "proposed_output": "我司现有平台具备统一认证能力。",
    "used_claim_refs": []
  },
  "gold_expected_answer": {
    "status": "failed",
    "metric": "requirement_laundering"
  },
  "full_case_record": {
    "id": "requirement_laundering_negative",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [
        {
          "requirement_id": "REQ-FAST-2",
          "text": "系统应支持统一认证。",
          "category": null,
          "mandatory": false,
          "response_mode": "REQUIREMENT_RESPONSE_ONLY",
          "enterprise_capability_assertion_allowed": false
        }
      ],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-B59F26A0A3806823FD7A86EA3BB802EC",
      "task_hash": "b59f26a0a3806823fd7a86ea3bb802ec5ee17faa7f72ce75a76cc9a3d369bf7f"
    },
    "output": "我司现有平台具备统一认证能力。",
    "expected": "failed",
    "metric": "requirement_laundering"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "requirement_laundering",
        "failed"
      ]
    },
    "requirement": [
      {
        "requirement_id": "REQ-FAST-2",
        "text": "系统应支持统一认证。",
        "category": null,
        "mandatory": false,
        "response_mode": "REQUIREMENT_RESPONSE_ONLY",
        "enterprise_capability_assertion_allowed": false
      }
    ],
    "authorized_claim": [],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [
          {
            "requirement_id": "REQ-FAST-2",
            "text": "系统应支持统一认证。",
            "category": null,
            "mandatory": false,
            "response_mode": "REQUIREMENT_RESPONSE_ONLY",
            "enterprise_capability_assertion_allowed": false
          }
        ],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-B59F26A0A3806823FD7A86EA3BB802EC",
        "task_hash": "b59f26a0a3806823fd7a86ea3bb802ec5ee17faa7f72ce75a76cc9a3d369bf7f"
      },
      "proposed_output": "我司现有平台具备统一认证能力。",
      "used_claim_refs": []
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": [
        "我司现有平台具备统一认证能力。"
      ]
    },
    "expected_guard": {
      "status": "failed",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "我司现有平台具备统一认证能力。"
  }
}
```

## authorized_strong_claim

```json
{
  "case_id": "authorized_strong_claim",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-1",
          "claim_type": "enterprise_capability",
          "claim_text": "我司现有平台具备统一认证能力。",
          "text": "我司现有平台具备统一认证能力。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
      "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
    },
    "proposed_output": "我司现有平台具备统一认证能力。",
    "used_claim_refs": [
      "CLM-FAST-1"
    ]
  },
  "gold_expected_answer": {
    "status": "pass",
    "metric": "authorized_strong_claim"
  },
  "full_case_record": {
    "id": "authorized_strong_claim",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-1",
          "claim_type": "enterprise_capability",
          "claim_text": "我司现有平台具备统一认证能力。",
          "text": "我司现有平台具备统一认证能力。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
      "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
    },
    "output": "我司现有平台具备统一认证能力。",
    "refs": [
      "CLM-FAST-1"
    ],
    "expected": "pass",
    "metric": "authorized_strong_claim"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "authorized_strong_claim",
        "pass"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-1",
        "claim_type": "enterprise_capability",
        "claim_text": "我司现有平台具备统一认证能力。",
        "text": "我司现有平台具备统一认证能力。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "仅限当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-1",
            "claim_type": "enterprise_capability",
            "claim_text": "我司现有平台具备统一认证能力。",
            "text": "我司现有平台具备统一认证能力。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "仅限当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
        "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
      },
      "proposed_output": "我司现有平台具备统一认证能力。",
      "used_claim_refs": [
        "CLM-FAST-1"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [
        "我司现有平台具备统一认证能力。"
      ],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": []
    },
    "expected_guard": {
      "status": "pass",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "我司现有平台具备统一认证能力。"
  }
}
```

## scope_restriction_negative

```json
{
  "case_id": "scope_restriction_negative",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-1",
          "claim_type": "enterprise_capability",
          "claim_text": "我司现有平台具备统一认证能力。",
          "text": "我司现有平台具备统一认证能力。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
      "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
    },
    "proposed_output": "我司现有平台在全国范围具备统一认证能力。",
    "used_claim_refs": [
      "CLM-FAST-1"
    ]
  },
  "gold_expected_answer": {
    "status": "failed",
    "metric": "restrict_loss"
  },
  "full_case_record": {
    "id": "scope_restriction_negative",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-1",
          "claim_type": "enterprise_capability",
          "claim_text": "我司现有平台具备统一认证能力。",
          "text": "我司现有平台具备统一认证能力。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
      "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
    },
    "output": "我司现有平台在全国范围具备统一认证能力。",
    "refs": [
      "CLM-FAST-1"
    ],
    "expected": "failed",
    "metric": "restrict_loss"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "restrict_loss",
        "failed"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-1",
        "claim_type": "enterprise_capability",
        "claim_text": "我司现有平台具备统一认证能力。",
        "text": "我司现有平台具备统一认证能力。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "仅限当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-1",
            "claim_type": "enterprise_capability",
            "claim_text": "我司现有平台具备统一认证能力。",
            "text": "我司现有平台具备统一认证能力。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "仅限当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-A89757BD609B6FE9145DDADBE2F2C8A4",
        "task_hash": "a89757bd609b6fe9145ddadbe2f2c8a42accd9f6677af24f9848e65678a2729c"
      },
      "proposed_output": "我司现有平台在全国范围具备统一认证能力。",
      "used_claim_refs": [
        "CLM-FAST-1"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": [
        "我司现有平台在全国范围具备统一认证能力。"
      ]
    },
    "expected_guard": {
      "status": "failed",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "我司现有平台在全国范围具备统一认证能力。"
  }
}
```

## quantity_restriction_negative

```json
{
  "case_id": "quantity_restriction_negative",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-2",
          "claim_type": "enterprise_capability",
          "claim_text": "接口响应时间不超过3秒。",
          "text": "接口响应时间不超过3秒。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A3F2D26AAD0C5D76D52DB9D8CEE03F01",
      "task_hash": "a3f2d26aad0c5d76d52db9d8cee03f01f4ca1c4a04803b66ed73e92246ea4be3"
    },
    "proposed_output": "接口响应时间不超过5秒。",
    "used_claim_refs": [
      "CLM-FAST-2"
    ]
  },
  "gold_expected_answer": {
    "status": "failed",
    "metric": "quantity_invention"
  },
  "full_case_record": {
    "id": "quantity_restriction_negative",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-2",
          "claim_type": "enterprise_capability",
          "claim_text": "接口响应时间不超过3秒。",
          "text": "接口响应时间不超过3秒。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-A3F2D26AAD0C5D76D52DB9D8CEE03F01",
      "task_hash": "a3f2d26aad0c5d76d52db9d8cee03f01f4ca1c4a04803b66ed73e92246ea4be3"
    },
    "output": "接口响应时间不超过5秒。",
    "refs": [
      "CLM-FAST-2"
    ],
    "expected": "failed",
    "metric": "quantity_invention"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "quantity_invention",
        "failed"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-2",
        "claim_type": "enterprise_capability",
        "claim_text": "接口响应时间不超过3秒。",
        "text": "接口响应时间不超过3秒。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "仅限当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-2",
            "claim_type": "enterprise_capability",
            "claim_text": "接口响应时间不超过3秒。",
            "text": "接口响应时间不超过3秒。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "仅限当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-A3F2D26AAD0C5D76D52DB9D8CEE03F01",
        "task_hash": "a3f2d26aad0c5d76d52db9d8cee03f01f4ca1c4a04803b66ed73e92246ea4be3"
      },
      "proposed_output": "接口响应时间不超过5秒。",
      "used_claim_refs": [
        "CLM-FAST-2"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": [
        "接口响应时间不超过5秒。"
      ]
    },
    "expected_guard": {
      "status": "failed",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "接口响应时间不超过5秒。"
  }
}
```

## status_restriction_negative

```json
{
  "case_id": "status_restriction_negative",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-3",
          "claim_type": "enterprise_capability",
          "claim_text": "项目已完成验收。",
          "text": "项目已完成验收。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-3269390A6F7E596790FEE2170F3F2111",
      "task_hash": "3269390a6f7e596790fee2170f3f2111637aa9fa8f9907ca3fc569fca796fb62"
    },
    "proposed_output": "项目已成功交付并完成验收。",
    "used_claim_refs": [
      "CLM-FAST-3"
    ]
  },
  "gold_expected_answer": {
    "status": "failed",
    "metric": "status_expansion"
  },
  "full_case_record": {
    "id": "status_restriction_negative",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-3",
          "claim_type": "enterprise_capability",
          "claim_text": "项目已完成验收。",
          "text": "项目已完成验收。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-3269390A6F7E596790FEE2170F3F2111",
      "task_hash": "3269390a6f7e596790fee2170f3f2111637aa9fa8f9907ca3fc569fca796fb62"
    },
    "output": "项目已成功交付并完成验收。",
    "refs": [
      "CLM-FAST-3"
    ],
    "expected": "failed",
    "metric": "status_expansion"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "status_expansion",
        "failed"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-3",
        "claim_type": "enterprise_capability",
        "claim_text": "项目已完成验收。",
        "text": "项目已完成验收。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "仅限当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-3",
            "claim_type": "enterprise_capability",
            "claim_text": "项目已完成验收。",
            "text": "项目已完成验收。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "仅限当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-3269390A6F7E596790FEE2170F3F2111",
        "task_hash": "3269390a6f7e596790fee2170f3f2111637aa9fa8f9907ca3fc569fca796fb62"
      },
      "proposed_output": "项目已成功交付并完成验收。",
      "used_claim_refs": [
        "CLM-FAST-3"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": [
        "项目已成功交付并完成验收。"
      ]
    },
    "expected_guard": {
      "status": "failed",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "项目已成功交付并完成验收。"
  }
}
```

## validity_restriction_negative

```json
{
  "case_id": "validity_restriction_negative",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-4",
          "claim_type": "enterprise_capability",
          "claim_text": "证书有效期至2026年1月1日。",
          "text": "证书有效期至2026年1月1日。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-FAD3688B487C08A1E5F880434A4DABD4",
      "task_hash": "fad3688b487c08a1e5f880434a4dabd40be22e02fb7cc9c3e65a5a90965576e8"
    },
    "proposed_output": "证书长期有效。",
    "used_claim_refs": [
      "CLM-FAST-4"
    ]
  },
  "gold_expected_answer": {
    "status": "failed",
    "metric": "validity_expansion"
  },
  "full_case_record": {
    "id": "validity_restriction_negative",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-4",
          "claim_type": "enterprise_capability",
          "claim_text": "证书有效期至2026年1月1日。",
          "text": "证书有效期至2026年1月1日。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "仅限当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-FAD3688B487C08A1E5F880434A4DABD4",
      "task_hash": "fad3688b487c08a1e5f880434a4dabd40be22e02fb7cc9c3e65a5a90965576e8"
    },
    "output": "证书长期有效。",
    "refs": [
      "CLM-FAST-4"
    ],
    "expected": "failed",
    "metric": "validity_expansion"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "validity_expansion",
        "failed"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-4",
        "claim_type": "enterprise_capability",
        "claim_text": "证书有效期至2026年1月1日。",
        "text": "证书有效期至2026年1月1日。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "仅限当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-4",
            "claim_type": "enterprise_capability",
            "claim_text": "证书有效期至2026年1月1日。",
            "text": "证书有效期至2026年1月1日。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "仅限当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-FAD3688B487C08A1E5F880434A4DABD4",
        "task_hash": "fad3688b487c08a1e5f880434a4dabd40be22e02fb7cc9c3e65a5a90965576e8"
      },
      "proposed_output": "证书长期有效。",
      "used_claim_refs": [
        "CLM-FAST-4"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": [
        "证书长期有效。"
      ]
    },
    "expected_guard": {
      "status": "failed",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "证书长期有效。"
  }
}
```

## composite_authorized_claim

```json
{
  "case_id": "composite_authorized_claim",
  "classification": "ACTIVE_SCORED_GOLD",
  "gold_input": {
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-5",
          "claim_type": "enterprise_capability",
          "claim_text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
          "text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-5CBB27C0F86A68F7501A3ABF5E512085",
      "task_hash": "5cbb27c0f86a68f7501a3abf5e51208570cfb189c8a78cbdb14c79b22dab75a5"
    },
    "proposed_output": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
    "used_claim_refs": [
      "CLM-FAST-5"
    ]
  },
  "gold_expected_answer": {
    "status": "pass",
    "metric": "authorized_narrow_claim"
  },
  "full_case_record": {
    "id": "composite_authorized_claim",
    "task": {
      "project_id": "WRITER-FAST-SYNTHETIC",
      "chapter_id": "chapter-fast",
      "chapter_role": "functional_solution",
      "chapter_instruction": "仅使用授权输入。",
      "requirements": [],
      "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "context_items": [],
      "assertable_claims": [
        {
          "claim_id": "CLM-FAST-5",
          "claim_type": "enterprise_capability",
          "claim_text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
          "text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
          "decision": "allow",
          "writer_eligible": true,
          "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "gate_result_id": "GATE-FAST-1",
          "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "lineage_current": true,
          "allowed_scope": [
            "华东区域"
          ],
          "required_conditions": [
            "当前项目"
          ],
          "limitations": [
            "不包含其他区域"
          ]
        }
      ],
      "required_bindings": [],
      "optional_bindings": [],
      "pending_controls": [],
      "forbidden_assertions": [],
      "writer_contract_version": "writer-task-v1",
      "task_version": 1,
      "writer_task_id": "WT-5CBB27C0F86A68F7501A3ABF5E512085",
      "task_hash": "5cbb27c0f86a68f7501a3abf5e51208570cfb189c8a78cbdb14c79b22dab75a5"
    },
    "output": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
    "refs": [
      "CLM-FAST-5"
    ],
    "expected": "pass",
    "metric": "authorized_narrow_claim"
  },
  "human_review_sections": {
    "metadata": {
      "test_or_runner": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "classification": "SCORED_GOLD / DETERMINISTIC_REGRESSION",
      "active": true,
      "scored": true,
      "source_fixture": "backend/eval/rag-pilot/writer-fast-gate-v1.js",
      "tags": [
        "authorized_narrow_claim",
        "pass"
      ]
    },
    "requirement": [],
    "authorized_claim": [
      {
        "claim_id": "CLM-FAST-5",
        "claim_type": "enterprise_capability",
        "claim_text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
        "text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
        "decision": "allow",
        "writer_eligible": true,
        "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "gate_result_id": "GATE-FAST-1",
        "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "lineage_current": true,
        "allowed_scope": [
          "华东区域"
        ],
        "required_conditions": [
          "当前项目"
        ],
        "limitations": [
          "不包含其他区域"
        ]
      }
    ],
    "reference_context": {
      "assertable_facts": [],
      "context_only_or_reference_only": []
    },
    "writer_input": {
      "task": {
        "project_id": "WRITER-FAST-SYNTHETIC",
        "chapter_id": "chapter-fast",
        "chapter_role": "functional_solution",
        "chapter_instruction": "仅使用授权输入。",
        "requirements": [],
        "safe_context_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "safe_context_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "context_items": [],
        "assertable_claims": [
          {
            "claim_id": "CLM-FAST-5",
            "claim_type": "enterprise_capability",
            "claim_text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
            "text": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
            "decision": "allow",
            "writer_eligible": true,
            "claim_assertion_identity": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "gate_result_id": "GATE-FAST-1",
            "input_snapshot_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "lineage_current": true,
            "allowed_scope": [
              "华东区域"
            ],
            "required_conditions": [
              "当前项目"
            ],
            "limitations": [
              "不包含其他区域"
            ]
          }
        ],
        "required_bindings": [],
        "optional_bindings": [],
        "pending_controls": [],
        "forbidden_assertions": [],
        "writer_contract_version": "writer-task-v1",
        "task_version": 1,
        "writer_task_id": "WT-5CBB27C0F86A68F7501A3ABF5E512085",
        "task_hash": "5cbb27c0f86a68f7501a3abf5e51208570cfb189c8a78cbdb14c79b22dab75a5"
      },
      "proposed_output": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。",
      "used_claim_refs": [
        "CLM-FAST-5"
      ]
    },
    "expected_writer_behavior": {
      "MUST_INCLUDE": [
        "华东区域当前项目支持统一认证，接口响应时间不超过3秒。"
      ],
      "MAY_INCLUDE": [],
      "MUST_NOT_INCLUDE": []
    },
    "expected_guard": {
      "status": "pass",
      "error_or_reason": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE; metric is the fixture expectation."
    },
    "expected_validator": {
      "status": "NOT_AUTHORED_IN_FAST_GATE_FIXTURE",
      "error": "NOT_PRESENT"
    },
    "expected_retention_or_fidelity": "NOT_PRESENT_IN_FAST_GATE_FIXTURE",
    "simulated_fixture_output": "华东区域当前项目支持统一认证，接口响应时间不超过3秒。"
  }
}
```

