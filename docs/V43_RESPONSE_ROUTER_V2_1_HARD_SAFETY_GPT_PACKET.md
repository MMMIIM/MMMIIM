# V43 Response Router V2.1 Hard Safety GPT Packet

## A. Identity verification

- Reference V3 path: docs/V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip#V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json
- Reference V3 SHA256: 3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744
- Reference V3 rows: 2178
- Reference V3 mutated: NO (replay identity matches frozen SHA/row count).
- Router version: v43-response-router-v2.1
- Router implementation id: v43-response-router-v2.1-systematic-boundary-repair
- Router source: backend/src/pipeline/requirement-response-router-v2-1.js
- Router source SHA256: d8a2cd54a6949d0e0ee6312a2e7592d7ae169a2e40f01807df47488a79449b73
- Runtime dependency audit: source imports only the V2 projection module; no Reference V2/V3, Eval artifact, case-id map, tender-id map, or expected-label map dependency was found in the Router source.

## B. Exact hard-safety metrics

- TRUE_P0_COMPLIANCE_ESCAPE: baseline_v2=10; v2_1=0; delta=-10; gate_target=0; PASS
- HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE: baseline_v2=229; v2_1=105; delta=-124; gate_target=0; FAIL
- POST_AWARD_COMMITMENT_AS_EVIDENCE: baseline_v2=73; v2_1=66; delta=-7; gate_target=0; FAIL

## C. Remaining hard-safety failure rows

- Rows exported: 171 (105 HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE + 66 POST_AWARD_COMMITMENT_AS_EVIDENCE).
- All rows below are mechanical replay records. No Codex semantic verdict is added.

### CORE6:TB-003:TB-003:REQ-011 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-011",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-011",
  "requirement_text": "投标人须提前办理CA数字证书，并学习电子投标文件制作；加密的电子投标文件须使用CA数字证书上传；为防止网络拥堵等不可控因素影响上传，须提前上传，因未能及时上传导致投标失败的责任由投标人自行承担。",
  "available_source_context_text": "投标人须提前办理CA数字证书，并学习电子投标文件制作；加密的电子投标文件须使用CA数字证书上传；为防止网络拥堵等不可控因素影响上传，须提前上传，因未能及时上传导致投标失败的责任由投标人自行承担。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-016 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-016",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-016",
  "requirement_text": "投标人在投标时，按照规定提供相关承诺函，无需再提交上述证明材料。",
  "available_source_context_text": "投标人在投标时，按照规定提供相关承诺函，无需再提交上述证明材料。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-017 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-017",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-017",
  "requirement_text": "供应商应当遵循诚实信用原则，不得作虚假承诺。",
  "available_source_context_text": "供应商应当遵循诚实信用原则，不得作虚假承诺。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-029 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-029",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-029",
  "requirement_text": "原版为外文的证书类文件，以及由外国人做出的本人签名、外国公司的名称或外国印章等可以是外文，但应当提供中文翻译文件并加盖投标人公章。必要时评标委员会可以要求投标人提供附有公证书的中文翻译文件或者与原版文件签章相一致的中文翻译文件。",
  "available_source_context_text": "原版为外文的证书类文件，以及由外国人做出的本人签名、外国公司的名称或外国印章等可以是外文，但应当提供中文翻译文件并加盖投标人公章。必要时评标委员会可以要求投标人提供附有公证书的中文翻译文件或者与原版文件签章相一致的中文翻译文件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": false,
    "human_required": true,
    "scoring_related": true,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE",
      "SCORING_RELATED"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "response_required",
    "evidence_dependency",
    "scoring_related"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-106 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-106",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-106",
  "requirement_text": "提供SSL数字证书1张。",
  "available_source_context_text": "提供SSL数字证书1张。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-107 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-107",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-107",
  "requirement_text": "提供数字证书（含USBKey）2套。",
  "available_source_context_text": "提供数字证书（含USBKey）2套。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-108 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-108",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-108",
  "requirement_text": "提供手写签名证书服务1套。",
  "available_source_context_text": "提供手写签名证书服务1套。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-192 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-192",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-192",
  "requirement_text": "提供3年手写签名证书服务，个人数字证书由权威合法的第三方CA机构签发，符合《x.509c的国内数字证书格式规范》，证书标准遵循X.509 V3格式标准。",
  "available_source_context_text": "提供3年手写签名证书服务，个人数字证书由权威合法的第三方CA机构签发，符合《x.509c的国内数字证书格式规范》，证书标准遵循X.509 V3格式标准。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-193 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-193",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-193",
  "requirement_text": "提供3年包含20万次人脸核身服务，自然人三要素核验：人脸、姓名、身份证号。",
  "available_source_context_text": "提供3年包含20万次人脸核身服务，自然人三要素核验：人脸、姓名、身份证号。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-005 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-005",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-005",
  "requirement_text": "投标人必须有完善的技术支持服务体系，可提供如下技术支持服务：1) 针对用户在使用过程中的技术问题提供解答；2) 投标人须提供技术适配服务，服务提供方式不限于现场、邮件、电话、即时通讯工具等服务形式。",
  "available_source_context_text": "投标人必须有完善的技术支持服务体系，可提供如下技术支持服务：1) 针对用户在使用过程中的技术问题提供解答；2) 投标人须提供技术适配服务，服务提供方式不限于现场、邮件、电话、即时通讯工具等服务形式。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-008 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-008",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-008",
  "requirement_text": "本次采购的软件产品提供 2 年原厂保修服务，在质保期内所有服务不再另行支付任何费用。",
  "available_source_context_text": "本次采购的软件产品提供 2 年原厂保修服务，在质保期内所有服务不再另行支付任何费用。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-174 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-174",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-174",
  "requirement_text": "售后服务最小保障期≥8年。",
  "available_source_context_text": "售后服务最小保障期≥8年。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-175 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-175",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-175",
  "requirement_text": "服务由操作系统厂商的正式员工提供，不由代理商提供。",
  "available_source_context_text": "服务由操作系统厂商的正式员工提供，不由代理商提供。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-178 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-178",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-178",
  "requirement_text": "操作系统厂商提供代码级定制优化服务。",
  "available_source_context_text": "操作系统厂商提供代码级定制优化服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-179 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-179",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-179",
  "requirement_text": "操作系统厂商满足同城4h、异地12h响应要求，两个工作日解决问题，对于未能解决的问题和故障提供可行的升级方案。",
  "available_source_context_text": "操作系统厂商满足同城4h、异地12h响应要求，两个工作日解决问题，对于未能解决的问题和故障提供可行的升级方案。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-180 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-180",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-180",
  "requirement_text": "发生非人为因素故障，在七日内由操作系统厂商原厂人员免费对产品进行补充或更换。",
  "available_source_context_text": "发生非人为因素故障，在七日内由操作系统厂商原厂人员免费对产品进行补充或更换。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-182 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-182",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-182",
  "requirement_text": "交付产品时操作系统厂商提供配套的技术资料，包括但不限于系统说明文件、用户手册（用户安装、操作、维护、故障排除）等。",
  "available_source_context_text": "交付产品时操作系统厂商提供配套的技术资料，包括但不限于系统说明文件、用户手册（用户安装、操作、维护、故障排除）等。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-184 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-184",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-184",
  "requirement_text": "操作系统厂商建立全国技术服务体系和服务团队，为客户提供专业的原厂中文服务。",
  "available_source_context_text": "操作系统厂商建立全国技术服务体系和服务团队，为客户提供专业的原厂中文服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-212 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-212",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-212",
  "requirement_text": "支持OpenSSL、Libgcrypt、Gnulib、Nettle、Hashes、libkcapi、OpenSSH等常见商用密码算法库，OpenSSL须支持X509、PKCS#7证书。须提供功能测试截图，并加盖投标人公章。",
  "available_source_context_text": "支持OpenSSL、Libgcrypt、Gnulib、Nettle、Hashes、libkcapi、OpenSSH等常见商用密码算法库，OpenSSL须支持X509、PKCS#7证书。须提供功能测试截图，并加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-298 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-298",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-298",
  "requirement_text": "支持对归档模式、归档文件位置、归档启用/停用进行管理。",
  "available_source_context_text": "支持对归档模式、归档文件位置、归档启用/停用进行管理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-299 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-299",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-299",
  "requirement_text": "提供图形化管理数据的备份、还原/恢复的功能。",
  "available_source_context_text": "提供图形化管理数据的备份、还原/恢复的功能。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-307 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-307",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-307",
  "requirement_text": "提供远程容灾部署与管理功能；提供生产中心与备份中心之间的容灾部署与管理功能。",
  "available_source_context_text": "提供远程容灾部署与管理功能；提供生产中心与备份中心之间的容灾部署与管理功能。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-330 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-330",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-330",
  "requirement_text": "提供身份鉴别及访问控制，加解密的密码要求符合GM/T0028的相关规定。",
  "available_source_context_text": "提供身份鉴别及访问控制，加解密的密码要求符合GM/T0028的相关规定。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-338 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-338",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-338",
  "requirement_text": "支持Oracle model语法（允许在SQL中执行复杂的多维数组计算），支持NLS_NUMERIC_CHARACTERS（用于指定小数点和千分位分隔符的字符）参数。须提供功能截图，并加盖投标人公章。",
  "available_source_context_text": "支持Oracle model语法（允许在SQL中执行复杂的多维数组计算），支持NLS_NUMERIC_CHARACTERS（用于指定小数点和千分位分隔符的字符）参数。须提供功能截图，并加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-344 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-344",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-344",
  "requirement_text": "兼容SQLServer可使用拼接操作符+，将字符串常量、字符串列（如name列）、返回字符串结果的函数（如CAST、CONVERT转换后的字符串）、字符串变量以及NULL等多个字符串类型的元素组合为一个完整字符串的功能。须提供功能截图，并加盖投标人公章。",
  "available_source_context_text": "兼容SQLServer可使用拼接操作符+，将字符串常量、字符串列（如name列）、返回字符串结果的函数（如CAST、CONVERT转换后的字符串）、字符串变量以及NULL等多个字符串类型的元素组合为一个完整字符串的功能。须提供功能截图，并加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-345 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-345",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-345",
  "requirement_text": "兼容MySQL常用数据类型date、time、datetime、tinyblob、tinyint，bit；兼容MySQL自增列，且自增列数据类型包括TINYINT、SMALLINT、MEDIUMINT、BIGINT、INT、FLOAT、DOUBLE、SERIAL；且自增列上支持创建唯一键约束、主键约束、NULL约束。须提供功能截图，并加盖投标人公章。",
  "available_source_context_text": "兼容MySQL常用数据类型date、time、datetime、tinyblob、tinyint，bit；兼容MySQL自增列，且自增列数据类型包括TINYINT、SMALLINT、MEDIUMINT、BIGINT、INT、FLOAT、DOUBLE、SERIAL；且自增列上支持创建唯一键约束、主键约束、NULL约束。须提供功能截图，并加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-347 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-347",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-347",
  "requirement_text": "支持表空间级数据加密功能、支持同一表空间存在多表情况下部分表进行加密功能、支持SM4、RC4算法、支持单机、集群场景。须提供功能测试截图，并加盖投标人公章。",
  "available_source_context_text": "支持表空间级数据加密功能、支持同一表空间存在多表情况下部分表进行加密功能、支持SM4、RC4算法、支持单机、集群场景。须提供功能测试截图，并加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-049 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-049",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-049",
  "requirement_text": "应维护计算机终端操作系统、办公软件、防病毒、数字证书、邮件和OA等软件，清理不常用/恶意软件和系统垃圾，修复漏洞和缺失功能并提供简单数据恢复备份。",
  "available_source_context_text": "应维护计算机终端操作系统、办公软件、防病毒、数字证书、邮件和OA等软件，清理不常用/恶意软件和系统垃圾，修复漏洞和缺失功能并提供简单数据恢复备份。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-069 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-069",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-069",
  "requirement_text": "安全设备硬件应提供一年原厂保修，发现硬件故障时免费提供备机和备件以保证正常运行。",
  "available_source_context_text": "安全设备硬件应提供一年原厂保修，发现硬件故障时免费提供备机和备件以保证正常运行。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-091 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-091",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-091",
  "requirement_text": "供应商应配备经验丰富的技术人员。",
  "available_source_context_text": "供应商应配备经验丰富的技术人员。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-092 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-092",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-092",
  "requirement_text": "供应商应建立完善的运维服务制度和良好的用户服务记录，并备有保障网络连续运行的相应备品备件。",
  "available_source_context_text": "供应商应建立完善的运维服务制度和良好的用户服务记录，并备有保障网络连续运行的相应备品备件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0029 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0029",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0029",
  "requirement_text": "投标人须是所供产品的知识产权的合法所有人，或已从其所有人那里得到了适当的授权。",
  "available_source_context_text": "投标人须是所供产品的知识产权的合法所有人，或已从其所有人那里得到了适当的授权。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0054 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0054",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0054",
  "requirement_text": "招标文件采购需求书中指出的工艺、方案等的标准以及参照的品牌、型号或配置仅起说明作用，并没有任何限制性。投标人在投标中可以选用替代标准、牌号或配置，但这些替代要实质上不低于技术规格的要求，并且使招标人满意。",
  "available_source_context_text": "招标文件采购需求书中指出的工艺、方案等的标准以及参照的品牌、型号或配置仅起说明作用，并没有任何限制性。投标人在投标中可以选用替代标准、牌号或配置，但这些替代要实质上不低于技术规格的要求，并且使招标人满意。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": false,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "response_required",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0075 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0075",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0075",
  "requirement_text": "投标文件封套上应写明：1）采购人名称、招标代理机构名称；2）项目名称、项目编号、包号；3）注明“（项目名称）（编号）投标文件和‘在年月日时分（开标时间）前不得开启’”字样；4）投标人名称。",
  "available_source_context_text": "投标文件封套上应写明：1）采购人名称、招标代理机构名称；2）项目名称、项目编号、包号；3）注明“（项目名称）（编号）投标文件和‘在年月日时分（开标时间）前不得开启’”字样；4）投标人名称。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0076 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0076",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0076",
  "requirement_text": "本项目不得以任何形式进行转包。",
  "available_source_context_text": "本项目不得以任何形式进行转包。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0077 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0077",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0077",
  "requirement_text": "本项目适用本国产品标准及相关政策，本国产品标准适用于货物，包括政府采购货物项目和服务项目中涉及的货物；适用本国产品标准的货物具体是指《政府采购品目分类目录》中的货物类产品，但不包括其中的房屋和构筑物、文物和陈列品、图书和档案、特种动植物、农林牧渔业产品、矿与矿物、电力、城市燃气、蒸汽和热水、水、食品、饮料和烟草原料、无形资产。",
  "available_source_context_text": "本项目适用本国产品标准及相关政策，本国产品标准适用于货物，包括政府采购货物项目和服务项目中涉及的货物；适用本国产品标准的货物具体是指《政府采购品目分类目录》中的货物类产品，但不包括其中的房屋和构筑物、文物和陈列品、图书和档案、特种动植物、农林牧渔业产品、矿与矿物、电力、城市燃气、蒸汽和热水、水、食品、饮料和烟草原料、无形资产。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0078 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0078",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0078",
  "requirement_text": "投标人须提供经审计的2025年度财务报告复印件，或提供本年度基本户出具的资信证明原件或复印件；对于资信证明文件中写明“复印无效”的，应提供原件。",
  "available_source_context_text": "投标人须提供经审计的2025年度财务报告复印件，或提供本年度基本户出具的资信证明原件或复印件；对于资信证明文件中写明“复印无效”的，应提供原件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0085 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0085",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0085",
  "requirement_text": "投标人所提供的货物须通过国家有关检验部门的认可并被允许在中华人民共和国境内销售。",
  "available_source_context_text": "投标人所提供的货物须通过国家有关检验部门的认可并被允许在中华人民共和国境内销售。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0086 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0086",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0086",
  "requirement_text": "投标人所提供的所有软件必须为正版，投标人因本项目开发需要配备的任何第三方软件、控件、插件均应无任何限制条件（包括但不限于无限期、无用户数等）。投标人须确认其为所供服务的知识产权的合法所有人，或已经从其所有人那里得到了适当的授权。",
  "available_source_context_text": "投标人所提供的所有软件必须为正版，投标人因本项目开发需要配备的任何第三方软件、控件、插件均应无任何限制条件（包括但不限于无限期、无用户数等）。投标人须确认其为所供服务的知识产权的合法所有人，或已经从其所有人那里得到了适当的授权。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0121 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0121",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0121",
  "requirement_text": "在数据交换过程中如遇异常或中断，可自动识别缺失或不一致的数据范围，并支持手动和自动触发补齐操作，精准恢复数据完整性。分别提供数据补齐功能截图和补齐成功结果截图，截图均加盖投标人公章。",
  "available_source_context_text": "在数据交换过程中如遇异常或中断，可自动识别缺失或不一致的数据范围，并支持手动和自动触发补齐操作，精准恢复数据完整性。分别提供数据补齐功能截图和补齐成功结果截图，截图均加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0122 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0122",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0122",
  "requirement_text": "针对对账过程中发现的异常或缺失数据，可自动和手动触发数据修复流程，确保两端数据的一致性与完整性。分别提供数据对账结果截图和对账任务截图，截图均加盖投标人公章。",
  "available_source_context_text": "针对对账过程中发现的异常或缺失数据，可自动和手动触发数据修复流程，确保两端数据的一致性与完整性。分别提供数据对账结果截图和对账任务截图，截图均加盖投标人公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0124 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0124",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0124",
  "requirement_text": "可使用自定义场景模板，快速开发新场景功能。",
  "available_source_context_text": "可使用自定义场景模板，快速开发新场景功能。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0125 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0125",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0125",
  "requirement_text": "提供灵活的交换触发方式，支持：手工触发、周期性循环。",
  "available_source_context_text": "提供灵活的交换触发方式，支持：手工触发、周期性循环。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0128 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0128",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0128",
  "requirement_text": "使用写时复制技术，交换数据先高效写入再进行交换，保障数据完整性。",
  "available_source_context_text": "使用写时复制技术，交换数据先高效写入再进行交换，保障数据完整性。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0130 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0130",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0130",
  "requirement_text": "提供数据路由功能，根据某个数据字段的值，路由到不同的目的端。",
  "available_source_context_text": "提供数据路由功能，根据某个数据字段的值，路由到不同的目的端。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0134 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0134",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0134",
  "requirement_text": "支持流程级的流量监测和控制，实时检测各交换流程的数据积压情况并自动调整抽取频率。",
  "available_source_context_text": "支持流程级的流量监测和控制，实时检测各交换流程的数据积压情况并自动调整抽取频率。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0140 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0140",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0140",
  "requirement_text": "提供管理审计功能，包括操作审计和登录审计；提供用户操作记录，审计登录用户、登录时间、任务启停、流程启停、增删交换与流程等重要信息。",
  "available_source_context_text": "提供管理审计功能，包括操作审计和登录审计；提供用户操作记录，审计登录用户、登录时间、任务启停、流程启停、增删交换与流程等重要信息。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0141 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0141",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0141",
  "requirement_text": "提供CDC监控、CDC统计、CDC告警功能。",
  "available_source_context_text": "提供CDC监控、CDC统计、CDC告警功能。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0145 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0145",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0145",
  "requirement_text": "投标人须按时提交投标保证金，且投标保证金的金额、形式或投标保函出具银行须符合招标文件要求。",
  "available_source_context_text": "投标人须按时提交投标保证金，且投标保证金的金额、形式或投标保函出具银行须符合招标文件要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0146 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0146",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0146",
  "requirement_text": "投标文件须有投标单位公章、法定代表人签字或人名章，签字人须有法定代表人有效授权书。",
  "available_source_context_text": "投标文件须有投标单位公章、法定代表人签字或人名章，签字人须有法定代表人有效授权书。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0147 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0147",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0147",
  "requirement_text": "使用投标专用章时，须在法人代表授权书中对投标专用章（含编号）授权等同于公章。",
  "available_source_context_text": "使用投标专用章时，须在法人代表授权书中对投标专用章（含编号）授权等同于公章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0148 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0148",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0148",
  "requirement_text": "投标文件须按照招标文件要求签署、盖章。",
  "available_source_context_text": "投标文件须按照招标文件要求签署、盖章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0149 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0149",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0149",
  "requirement_text": "投标有效期须满足招标文件要求。",
  "available_source_context_text": "投标有效期须满足招标文件要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0150 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0150",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0150",
  "requirement_text": "投标总价不得超过项目预算金额或招标控制价。",
  "available_source_context_text": "投标总价不得超过项目预算金额或招标控制价。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0151 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0151",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0151",
  "requirement_text": "投标人不得递交两份或多份内容不同的投标文件，或在一份投标文件中对同一招标货物或服务提交不同内容。",
  "available_source_context_text": "投标人不得递交两份或多份内容不同的投标文件，或在一份投标文件中对同一招标货物或服务提交不同内容。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0154 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0154",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0154",
  "requirement_text": "投标人须按招标文件要求提供承诺函。",
  "available_source_context_text": "投标人须按招标文件要求提供承诺函。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0155 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0155",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0155",
  "requirement_text": "投标人的违约责任须满足招标文件要求。",
  "available_source_context_text": "投标人的违约责任须满足招标文件要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0156 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0156",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0156",
  "requirement_text": "投标总价缺少和漏项金额不得超过其投标总价的10%。",
  "available_source_context_text": "投标总价缺少和漏项金额不得超过其投标总价的10%。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0157 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0157",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0157",
  "requirement_text": "投标文件中不得附有招标人/招标机构不能接受的条件。",
  "available_source_context_text": "投标文件中不得附有招标人/招标机构不能接受的条件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0158 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0158",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0158",
  "requirement_text": "投标文件中不得有虚假文件和/或资料。",
  "available_source_context_text": "投标文件中不得有虚假文件和/或资料。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0159 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0159",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0159",
  "requirement_text": "投标人不得采取相互串标、排挤其他投标人的不公平竞争，损害招标人/招标机构或其他投标人的合法权益。",
  "available_source_context_text": "投标人不得采取相互串标、排挤其他投标人的不公平竞争，损害招标人/招标机构或其他投标人的合法权益。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0160 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0160",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0160",
  "requirement_text": "投标人不得以行贿手段谋取中标或以其他弄虚作假方式投标，不得违反国家法律及相关法令法规。",
  "available_source_context_text": "投标人不得以行贿手段谋取中标或以其他弄虚作假方式投标，不得违反国家法律及相关法令法规。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0161 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0161",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0161",
  "requirement_text": "投标人须遵守招标文件规定的其他导致其投标被否决的条款及要求。",
  "available_source_context_text": "投标人须遵守招标文件规定的其他导致其投标被否决的条款及要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0162 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0162",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0162",
  "requirement_text": "投标人不得进行低价恶意竞争。",
  "available_source_context_text": "投标人不得进行低价恶意竞争。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0184 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0184",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0184",
  "requirement_text": "投标人不得提交两份或者多份内容不同的投标文件，或者在同一份投标文件中对同一招标项目有两个或者多个报价。",
  "available_source_context_text": "投标人不得提交两份或者多份内容不同的投标文件，或者在同一份投标文件中对同一招标项目有两个或者多个报价。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0185 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0185",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0185",
  "requirement_text": "投标人的技术响应必须符合“采购需求书”★条款或实质性条款要求，无偏离。",
  "available_source_context_text": "投标人的技术响应必须符合“采购需求书”★条款或实质性条款要求，无偏离。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0188 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0188",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0188",
  "requirement_text": "针对招标文件“第五章采购需求书”中的▲重要技术要求，投标人须满足或优于每项要求，共计15项，每项2分，共计30分。",
  "available_source_context_text": "针对招标文件“第五章采购需求书”中的▲重要技术要求，投标人须满足或优于每项要求，共计15项，每项2分，共计30分。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": true
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required",
    "scoring_related"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0189 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0189",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0189",
  "requirement_text": "针对招标文件“第五章采购需求书”中的△基本技术要求，投标人须满足或优于每项要求，共计20项，每项0.5分，共计10分。",
  "available_source_context_text": "针对招标文件“第五章采购需求书”中的△基本技术要求，投标人须满足或优于每项要求，共计20项，每项0.5分，共计10分。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": true
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required",
    "scoring_related"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0191 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0191",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0191",
  "requirement_text": "投标人须提供实施方案，包括实施计划、切换方案、风险与应对方案共3项内容，每项2分；实施计划须分阶段详细且可实施性强，切换方案须步骤明确且逻辑关联顺畅，风险与应对方案须表述明确、逻辑关联顺畅且具备可操作性。",
  "available_source_context_text": "投标人须提供实施方案，包括实施计划、切换方案、风险与应对方案共3项内容，每项2分；实施计划须分阶段详细且可实施性强，切换方案须步骤明确且逻辑关联顺畅，风险与应对方案须表述明确、逻辑关联顺畅且具备可操作性。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": true
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "scoring_related"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0193 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0193",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0193",
  "requirement_text": "投标人须满足附表二符合性审查表的全部内容，否则其投标无效。",
  "available_source_context_text": "投标人须满足附表二符合性审查表的全部内容，否则其投标无效。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0198 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0198",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0198",
  "requirement_text": "投标人须有依法缴纳税收和社会保障资金的良好记录，并提供企业依法纳税记录（近6个月内任意1个月）和社会保障资金缴纳记录（近6个月内任意1个月）。",
  "available_source_context_text": "投标人须有依法缴纳税收和社会保障资金的良好记录，并提供企业依法纳税记录（近6个月内任意1个月）和社会保障资金缴纳记录（近6个月内任意1个月）。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0203 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0203",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0203",
  "requirement_text": "投标人须按照招标文件的规定提交投标保证金。",
  "available_source_context_text": "投标人须按照招标文件的规定提交投标保证金。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0204 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0204",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0204",
  "requirement_text": "投标文件须按招标文件要求在规定位置加盖投标人公章和/或有法定代表人或其授权代表签字或加盖人名章。",
  "available_source_context_text": "投标文件须按招标文件要求在规定位置加盖投标人公章和/或有法定代表人或其授权代表签字或加盖人名章。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0205 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0205",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0205",
  "requirement_text": "投标报价须是固定价且未超过预算金额、相应最高限价。",
  "available_source_context_text": "投标报价须是固定价且未超过预算金额、相应最高限价。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0206 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0206",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0206",
  "requirement_text": "投标文件不得含有采购人不能接受的附加条件。",
  "available_source_context_text": "投标文件不得含有采购人不能接受的附加条件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0207 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0207",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0207",
  "requirement_text": "投标人须遵循公平竞争的原则，不得有弄虚作假、恶意串通或妨碍其他投标人的竞争行为，不得损害采购人或者其他投标人的合法权益。",
  "available_source_context_text": "投标人须遵循公平竞争的原则，不得有弄虚作假、恶意串通或妨碍其他投标人的竞争行为，不得损害采购人或者其他投标人的合法权益。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0208 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0208",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0208",
  "requirement_text": "投标有效期须满足招标文件要求。",
  "available_source_context_text": "投标有效期须满足招标文件要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0018 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0018",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0018",
  "requirement_text": "供应商应当到相关服务机构办理并取得数字证书介质和应用，电子签名及电子印章与手写签名或者盖章具有同等的法律效力。签名（含电子签名）和盖章（含电子印章）是不同使用场景，应按招标文件要求在投标（响应）文件指定位置进行签名（含电子签名）和盖章（含电子印章），对允许采用手写签名的文件，应在纸质文件手写签名后，提供文件的彩色扫描电子文档进行后续操作。",
  "available_source_context_text": "供应商应当到相关服务机构办理并取得数字证书介质和应用，电子签名及电子印章与手写签名或者盖章具有同等的法律效力。签名（含电子签名）和盖章（含电子印章）是不同使用场景，应按招标文件要求在投标（响应）文件指定位置进行签名（含电子签名）和盖章（含电子印章），对允许采用手写签名的文件，应在纸质文件手写签名后，提供文件的彩色扫描电子文档进行后续操作。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0019 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0019",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0019",
  "requirement_text": "在电子投标（响应）文件及相关的其他电子资料中，涉及“全称”或“公司全称”的应在对应文件编辑时使用文本录入方式，或在纸质投标（响应）文件上进行手写签名，或通过投标客户端使用电子印章完成；涉及“加盖单位公章”和“公章”应使用投标人单位的数字证书并通过投标客户端使用电子印章完成。",
  "available_source_context_text": "在电子投标（响应）文件及相关的其他电子资料中，涉及“全称”或“公司全称”的应在对应文件编辑时使用文本录入方式，或在纸质投标（响应）文件上进行手写签名，或通过投标客户端使用电子印章完成；涉及“加盖单位公章”和“公章”应使用投标人单位的数字证书并通过投标客户端使用电子印章完成。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0024 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0024",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0024",
  "requirement_text": "当无法使用CA证书在云平台项目采购系统进行电子投标文件开标解密时，供应商须在代理机构指引下启用非加密电子版投标文件。",
  "available_source_context_text": "当无法使用CA证书在云平台项目采购系统进行电子投标文件开标解密时，供应商须在代理机构指引下启用非加密电子版投标文件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0026 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0026",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0026",
  "requirement_text": "供应商应在投标响应前通过广州交易集团有限公司网站完成企业信用档案登记，并确认成功。",
  "available_source_context_text": "供应商应在投标响应前通过广州交易集团有限公司网站完成企业信用档案登记，并确认成功。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0047 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0047",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0047",
  "requirement_text": "保险类项目只接受保险分公司或中心支公司以上的保险机构投标；分公司或中心支公司的保险机构投标的，还须提供分公司或中心支公司的保险机构的营业执照。",
  "available_source_context_text": "保险类项目只接受保险分公司或中心支公司以上的保险机构投标；分公司或中心支公司的保险机构投标的，还须提供分公司或中心支公司的保险机构的营业执照。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0048 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0048",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0048",
  "requirement_text": "如更正公告有重新发布电子招标文件的，供应商应登录云平台项目采购系统下载最新发布的电子招标文件制作投标文件。",
  "available_source_context_text": "如更正公告有重新发布电子招标文件的，供应商应登录云平台项目采购系统下载最新发布的电子招标文件制作投标文件。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": false,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "response_required",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0060 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0060",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0060",
  "requirement_text": "投标人须在采购代理机构规定的时间内完成投标文件解密，未携带数字证书或其他非系统原因导致的逾期未解密投标文件，将作无效投标处理。",
  "available_source_context_text": "投标人须在采购代理机构规定的时间内完成投标文件解密，未携带数字证书或其他非系统原因导致的逾期未解密投标文件，将作无效投标处理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0065 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0065",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0065",
  "requirement_text": "开标时，投标人应当使用编制本项目（采购包）电子投标文件时加密所用数字证书在开始解密后按照代理机构规定的时间内完成电子投标文件的解密，如遇不可抗力等其他特殊情况，采购代理机构可视情况延长解密时间。投标人未携带数字证书或其他非系统原因导致的在规定时间内未解密投标文件，将作无效投标处理。采用远程电子开标的，各投标人在参加开标以前须自行对使用电脑的网络环境、驱动安装、客户端安装以及数字证书的有效性等进行检测，确保可以正常使用。",
  "available_source_context_text": "开标时，投标人应当使用编制本项目（采购包）电子投标文件时加密所用数字证书在开始解密后按照代理机构规定的时间内完成电子投标文件的解密，如遇不可抗力等其他特殊情况，采购代理机构可视情况延长解密时间。投标人未携带数字证书或其他非系统原因导致的在规定时间内未解密投标文件，将作无效投标处理。采用远程电子开标的，各投标人在参加开标以前须自行对使用电脑的网络环境、驱动安装、客户端安装以及数字证书的有效性等进行检测，确保可以正常使用。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0078 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0078",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0078",
  "requirement_text": "投标人须有依法缴纳税收和社会保障资金的良好记录，依据《投标函》。",
  "available_source_context_text": "投标人须有依法缴纳税收和社会保障资金的良好记录，依据《投标函》。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0079 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0079",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0079",
  "requirement_text": "投标人须具有良好的商业信誉和健全的财务会计制度，依据《投标函》。",
  "available_source_context_text": "投标人须具有良好的商业信誉和健全的财务会计制度，依据《投标函》。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0081 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0081",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0081",
  "requirement_text": "投标人参加采购活动前3年内，在经营活动中没有重大违法记录，依据《投标函》。",
  "available_source_context_text": "投标人参加采购活动前3年内，在经营活动中没有重大违法记录，依据《投标函》。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0126 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0126",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0126",
  "requirement_text": "对于采购文件确实允许非独立法人参与采购活动的，应按其所属集团公司合并财务报表数据情况予以填报；以联合体形式参加或者合同分包的，需填写联合体中的中小企业或签订分包意向协议的中小企业相关信息。",
  "available_source_context_text": "对于采购文件确实允许非独立法人参与采购活动的，应按其所属集团公司合并财务报表数据情况予以填报；以联合体形式参加或者合同分包的，需填写联合体中的中小企业或签订分包意向协议的中小企业相关信息。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0164 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0164",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-02",
  "requirement_id": "HOLDOUT-REQ-02-CAN-0164",
  "requirement_text": "联合体各方应签署联合体共同投标协议书，以一个投标人的身份共同参加项目响应，明确牵头单位及内部职责划分，若中标则共同与采购人签订合同并承担连带责任；联合体成员不得再以自己名义参与本采购包响应，协议自签署之日起生效，有效期延续至合同履行完毕之日。",
  "available_source_context_text": "联合体各方应签署联合体共同投标协议书，以一个投标人的身份共同参加项目响应，明确牵头单位及内部职责划分，若中标则共同与采购人签订合同并承担连带责任；联合体成员不得再以自己名义参与本采购包响应，协议自签署之日起生效，有效期延续至合同履行完毕之日。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0012 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0012",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0012",
  "requirement_text": "供应商应使用系统公告-《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的数字证书（CA）和电子签章。供应商登录项目电子化交易系统进行的一切操作和资料传递，以及加盖电子签章确认采购过程中制作、交换的电子数据，均属于供应商真实意思表示，由供应商对其系统操作行为和电子签章确认的事项承担法律责任。",
  "available_source_context_text": "供应商应使用系统公告-《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的数字证书（CA）和电子签章。供应商登录项目电子化交易系统进行的一切操作和资料传递，以及加盖电子签章确认采购过程中制作、交换的电子数据，均属于供应商真实意思表示，由供应商对其系统操作行为和电子签章确认的事项承担法律责任。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": false,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "response_required",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0013 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0013",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0013",
  "requirement_text": "供应商应当加强数字证书(CA)及电子签章日常校验和妥善保管，确保在参加采购活动期间互认的证书及签章能够正常使用；供应商应当严格互认的证书及签章的内部授权管理，防止非授权操作。",
  "available_source_context_text": "供应商应当加强数字证书(CA)及电子签章日常校验和妥善保管，确保在参加采购活动期间互认的证书及签章能够正常使用；供应商应当严格互认的证书及签章的内部授权管理，防止非授权操作。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0034 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0034",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0034",
  "requirement_text": "投标人完成投标文件签章后，使用投标人数字证书(CA）对投标文件进行加密。",
  "available_source_context_text": "投标人完成投标文件签章后，使用投标人数字证书(CA）对投标文件进行加密。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0035 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0035",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0035",
  "requirement_text": "投标人须携带加密投标文件的数字证书（CA）和密封的非加密电子投标文件参加开标会议。",
  "available_source_context_text": "投标人须携带加密投标文件的数字证书（CA）和密封的非加密电子投标文件参加开标会议。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0048 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0048",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0048",
  "requirement_text": "投标文件电子版未按要求加盖《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的单位电子签章（如遇启用纸质投标文件时，纸质投标文件未按要求加盖公章）的，投标文件按无效投标处理。",
  "available_source_context_text": "投标文件电子版未按要求加盖《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的单位电子签章（如遇启用纸质投标文件时，纸质投标文件未按要求加盖公章）的，投标文件按无效投标处理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0338 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0338",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0338",
  "requirement_text": "实配支持策略风险调优，支持安全策略优化分析，支持策略数冗余及命中分析，支持基于应用风险的自动批量和手动逐条策略调优，可根据流量、应用、风险类型等细粒度展示，并给出总体安全评分，便于用户更好的管理安全策略。",
  "available_source_context_text": "实配支持策略风险调优，支持安全策略优化分析，支持策略数冗余及命中分析，支持基于应用风险的自动批量和手动逐条策略调优，可根据流量、应用、风险类型等细粒度展示，并给出总体安全评分，便于用户更好的管理安全策略。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "LOW",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": true,
    "routing_reasons": [
      "SCORING_RELATED"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "scoring_related"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0416 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0416",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0416",
  "requirement_text": "支持文件上传、文件包含攻击检测。",
  "available_source_context_text": "支持文件上传、文件包含攻击检测。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0427 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0427",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0427",
  "requirement_text": "支持全中文管理界面和HTTPS方式登录、用户管理。",
  "available_source_context_text": "支持全中文管理界面和HTTPS方式登录、用户管理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0454 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0454",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0454",
  "requirement_text": "六年原厂设备硬件维保，服务等级不低于7×24×4（4为硬件故障后4小时内备件及人员到场）；六年原厂设备软件维保含软件更新，服务等级不低于7×24。",
  "available_source_context_text": "六年原厂设备硬件维保，服务等级不低于7×24×4（4为硬件故障后4小时内备件及人员到场）；六年原厂设备软件维保含软件更新，服务等级不低于7×24。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0458 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0458",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0458",
  "requirement_text": "提供原厂及供应商现场服务：基本现场服务包括不限次数的节假日网络变更、日常网络变更、日常技术交流及系统上线的原厂现场服务；故障现场服务要求技术人员4小时内到场提供维护服务，6小时内完成故障定位，恢复系统正常运行；未现场完全解决的问题，服务工程师须至少每周与客户工程师联系，跟踪问题，分析协商处理方案，直至问题解决，并提供故障报告。服务的起始时间为设备到货日，截止时间与原厂维保的服务截止时间保持一致。",
  "available_source_context_text": "提供原厂及供应商现场服务：基本现场服务包括不限次数的节假日网络变更、日常网络变更、日常技术交流及系统上线的原厂现场服务；故障现场服务要求技术人员4小时内到场提供维护服务，6小时内完成故障定位，恢复系统正常运行；未现场完全解决的问题，服务工程师须至少每周与客户工程师联系，跟踪问题，分析协商处理方案，直至问题解决，并提供故障报告。服务的起始时间为设备到货日，截止时间与原厂维保的服务截止时间保持一致。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0462 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0462",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0462",
  "requirement_text": "供应商为本项目后续实施、维护提供一定数量的原厂工程师，到场天数不限（由采购人指定）。",
  "available_source_context_text": "供应商为本项目后续实施、维护提供一定数量的原厂工程师，到场天数不限（由采购人指定）。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0485 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0485",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0485",
  "requirement_text": "投标文件电子版未按要求加盖《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的单位电子签章（如遇启用纸质投标文件时，评标委员会对纸质投标文件按要求加盖公章进行审查）的，投标无效。",
  "available_source_context_text": "投标文件电子版未按要求加盖《关于供应商办理CA数字证书及电子签章的通知》中指定供应商签发的单位电子签章（如遇启用纸质投标文件时，评标委员会对纸质投标文件按要求加盖公章进行审查）的，投标无效。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": true,
    "routing_reasons": [
      "P0_OR_ELIGIBILITY_COMPLIANCE",
      "SCORING_RELATED"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency",
    "scoring_related"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0004 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0004",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0004",
  "requirement_text": "供应商进行投标须提前办理数字证书和电子签章，已办理数字证书须确保证书在有效期内，如已过期或即将过期，须联系CA服务机构进行证书更新。",
  "available_source_context_text": "供应商进行投标须提前办理数字证书和电子签章，已办理数字证书须确保证书在有效期内，如已过期或即将过期，须联系CA服务机构进行证书更新。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMPLIANCE",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "BID_FORMALITY_OR_PROCEDURE"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0126 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0126",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0126",
  "requirement_text": "支持加密应用的交易解析定制，如HTTPS支持导入秘钥后提供与HTTP一致的交易解析能力，能够看到请求方法、请求量、响应码等关键数据。",
  "available_source_context_text": "支持加密应用的交易解析定制，如HTTPS支持导入秘钥后提供与HTTP一致的交易解析能力，能够看到请求方法、请求量、响应码等关键数据。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "SOLUTION",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0179 — HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0179",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0179",
  "requirement_text": "下列资料应包装在合同货物的包装箱中：装箱单、合同货物数量和质量合格证书、保修证书、产品使用说明书及其它必要的技术资料。",
  "available_source_context_text": "下列资料应包装在合同货物的包装箱中：装箱单、合同货物数量和质量合格证书、保修证书、产品使用说明书及其它必要的技术资料。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false,
    "routing_reasons": [
      "PROJECT_OR_CONTRACT_COMMITMENT"
    ]
  },
  "hard_safety_gate_name": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "secondaryDependencies",
    "evidence_dependency assignment"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "risk_tier",
    "evidence_dependency"
  ]
}
```

### CORE6:JY-001:JY-001:REQ-101 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:JY-001:JY-001:REQ-101",
  "cohort": "CORE6",
  "tender_id": "JY-001",
  "requirement_id": "JY-001:REQ-101",
  "requirement_text": "AR场景授权应接入AR高空摄像机,按照接入路数收费8路。",
  "available_source_context_text": "AR场景授权应接入AR高空摄像机,按照接入路数收费8路。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:JY-001:JY-001:REQ-150 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:JY-001:JY-001:REQ-150",
  "cohort": "CORE6",
  "tender_id": "JY-001",
  "requirement_id": "JY-001:REQ-150",
  "requirement_text": "防火墙此次配置需包含5年硬件质保和技术支持服务以及5年IPS、AV特征库升级授权。",
  "available_source_context_text": "防火墙此次配置需包含5年硬件质保和技术支持服务以及5年IPS、AV特征库升级授权。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:TB-003:TB-003:REQ-206 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:TB-003:TB-003:REQ-206",
  "cohort": "CORE6",
  "tender_id": "TB-003",
  "requirement_id": "TB-003:REQ-206",
  "requirement_text": "系统开发应严格遵照国家软件工程规范进行，根据开发进度及时提供有关开发文档，包括调研文档、需求说明书、系统设计说明书、数据库设计说明书、测试记录、用户手册、测试分析报告，以及必要的其他文档等。",
  "available_source_context_text": "系统开发应严格遵照国家软件工程规范进行，根据开发进度及时提供有关开发文档，包括调研文档、需求说明书、系统设计说明书、数据库设计说明书、测试记录、用户手册、测试分析报告，以及必要的其他文档等。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:TB-006:TB-006:REQ-004 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:TB-006:TB-006:REQ-004",
  "cohort": "CORE6",
  "tender_id": "TB-006",
  "requirement_id": "TB-006:REQ-004",
  "requirement_text": "合同期内系统应安全稳定运行，不得因硬件故障导致服务中断12小时。",
  "available_source_context_text": "合同期内系统应安全稳定运行，不得因硬件故障导致服务中断12小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:TB-006:TB-006:REQ-021 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:TB-006:TB-006:REQ-021",
  "cohort": "CORE6",
  "tender_id": "TB-006",
  "requirement_id": "TB-006:REQ-021",
  "requirement_text": "本地备份服务应通过备份策略实现文件、操作系统和数据库的本地备份。",
  "available_source_context_text": "本地备份服务应通过备份策略实现文件、操作系统和数据库的本地备份。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "MEDIUM",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:TB-006:TB-006:REQ-028 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:TB-006:TB-006:REQ-028",
  "cohort": "CORE6",
  "tender_id": "TB-006",
  "requirement_id": "TB-006:REQ-028",
  "requirement_text": "非宕机故障发生时应协调人力在1小时内到达运维现场；系统宕机时5分钟内响应并在1小时内恢复正常，处理完成后提交宕机报告。",
  "available_source_context_text": "非宕机故障发生时应协调人力在1小时内到达运维现场；系统宕机时5分钟内响应并在1小时内恢复正常，处理完成后提交宕机报告。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-003 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-003",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-003",
  "requirement_text": "维护服务范围应覆盖HIS、电子病历、PACS-RIS、LIS、体检、手术麻醉、心电、输血、院感、药事等10个业务软件系统及相关接口。",
  "available_source_context_text": "维护服务范围应覆盖HIS、电子病历、PACS-RIS、LIS、体检、手术麻醉、心电、输血、院感、药事等10个业务软件系统及相关接口。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-005 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-005",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-005",
  "requirement_text": "应及时优化处理信息系统操作变慢、性能降低等性能问题。",
  "available_source_context_text": "应及时优化处理信息系统操作变慢、性能降低等性能问题。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-016 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-016",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-016",
  "requirement_text": "信息系统宕机等严重影响业务且现场人员预计30分钟内无法排除时，应安排技术人员2小时内到场处理。",
  "available_source_context_text": "信息系统宕机等严重影响业务且现场人员预计30分钟内无法排除时，应安排技术人员2小时内到场处理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-021 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-021",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-021",
  "requirement_text": "一级故障应立即响应、立即处理，并在30分钟内解决。",
  "available_source_context_text": "一级故障应立即响应、立即处理，并在30分钟内解决。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-022 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-022",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-022",
  "requirement_text": "二级故障应立即响应，处理时间不超过10分钟，解决时间不超过50分钟。",
  "available_source_context_text": "二级故障应立即响应，处理时间不超过10分钟，解决时间不超过50分钟。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-023 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-023",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-023",
  "requirement_text": "三级故障响应时间不超过10分钟、处理时间不超过30分钟、解决时间不超过2小时。",
  "available_source_context_text": "三级故障响应时间不超过10分钟、处理时间不超过30分钟、解决时间不超过2小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-024 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-024",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-024",
  "requirement_text": "四级故障响应时间不超过20分钟、处理时间不超过1小时、解决时间不超过24小时。",
  "available_source_context_text": "四级故障响应时间不超过20分钟、处理时间不超过1小时、解决时间不超过24小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-027 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-027",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-027",
  "requirement_text": "一般需求应一周内完成，重大需求最长不超过一个月；特殊情况不能按时完成时应提前告知并协商完成时间。",
  "available_source_context_text": "一般需求应一周内完成，重大需求最长不超过一个月；特殊情况不能按时完成时应提前告知并协商完成时间。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-028 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-028",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-028",
  "requirement_text": "应定期开展软件和数据库巡检并按时提交巡检报告，检查内容包括性能、功能正确性、可用性、安全性、参数合理性和性能优化等。",
  "available_source_context_text": "应定期开展软件和数据库巡检并按时提交巡检报告，检查内容包括性能、功能正确性、可用性、安全性、参数合理性和性能优化等。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-01:FAST-01:REQ-035 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-01:FAST-01:REQ-035",
  "cohort": "CORE6",
  "tender_id": "FAST-01",
  "requirement_id": "FAST-01:REQ-035",
  "requirement_text": "应遵守信息安全和保密原则，对网络、主机、系统软件、应用软件的密码、核心参数及业务数据等承担保密责任，不得随意复制和传播。",
  "available_source_context_text": "应遵守信息安全和保密原则，对网络、主机、系统软件、应用软件的密码、核心参数及业务数据等承担保密责任，不得随意复制和传播。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-176 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-176",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-176",
  "requirement_text": "操作系统厂商为最终用户提供工作日每日不少于8h（覆盖一般工作时间，具体时间由企业标准给出）中文技术服务热线。",
  "available_source_context_text": "操作系统厂商为最终用户提供工作日每日不少于8h（覆盖一般工作时间，具体时间由企业标准给出）中文技术服务热线。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-177 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-177",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-177",
  "requirement_text": "操作系统厂商提供工作日每日不少于8h技术支持服务。",
  "available_source_context_text": "操作系统厂商提供工作日每日不少于8h技术支持服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-181 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-181",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-181",
  "requirement_text": "操作系统厂商提供产品安装与现场调试，并提供安装与调试所需的工具和设备。",
  "available_source_context_text": "操作系统厂商提供产品安装与现场调试，并提供安装与调试所需的工具和设备。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-324 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-324",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-324",
  "requirement_text": "a)提供多种形式支持服务，包含电话、电子邮件、远程连接等；b)提供技术支持服务，支持同城4h、异地12h响应要求，两个工作日解决问题，对于未能解决的问题和故障提供可行的升级方案；c)提供培训材料、产品手册、培训视频等培训相关内容；d)建立全国技术服务体系和服务团队，符合专业服务体系标准要求，提供原厂中文服务；e)服务周期内支持版本免费升级；f)开源产品对获得的社区源代码进行安全性和知识产权审查与管理；g)提供数据库参数、慢SQL语句的性能优化指南，包含性能优化。",
  "available_source_context_text": "a)提供多种形式支持服务，包含电话、电子邮件、远程连接等；b)提供技术支持服务，支持同城4h、异地12h响应要求，两个工作日解决问题，对于未能解决的问题和故障提供可行的升级方案；c)提供培训材料、产品手册、培训视频等培训相关内容；d)建立全国技术服务体系和服务团队，符合专业服务体系标准要求，提供原厂中文服务；e)服务周期内支持版本免费升级；f)开源产品对获得的社区源代码进行安全性和知识产权审查与管理；g)提供数据库参数、慢SQL语句的性能优化指南，包含性能优化。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "human_required"
  ]
}
```

### CORE6:FAST-04:FAST-04:REQ-349 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-04:FAST-04:REQ-349",
  "cohort": "CORE6",
  "tender_id": "FAST-04",
  "requirement_id": "FAST-04:REQ-349",
  "requirement_text": "中标人应保证所供货物符合安全可靠测评要求。",
  "available_source_context_text": "中标人应保证所供货物符合安全可靠测评要求。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-033 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-033",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-033",
  "requirement_text": "应对即时通讯系统提供系统版本升级服务。",
  "available_source_context_text": "应对即时通讯系统提供系统版本升级服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-038 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-038",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-038",
  "requirement_text": "应为财务系统、CAD系统及专业软件等提供使用技术咨询和故障诊断处理。",
  "available_source_context_text": "应为财务系统、CAD系统及专业软件等提供使用技术咨询和故障诊断处理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-046 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-046",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-046",
  "requirement_text": "信息网络运维应覆盖网络设备管理、网络安全管理、网络性能优化、网络故障处理及数据备份与恢复等，确保网络稳定、安全、可靠运行。",
  "available_source_context_text": "信息网络运维应覆盖网络设备管理、网络安全管理、网络性能优化、网络故障处理及数据备份与恢复等，确保网络稳定、安全、可靠运行。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-048 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-048",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-048",
  "requirement_text": "应对计算机终端硬件故障进行检修和维修更换，并处理运行缓慢、不稳定等问题及提供合理使用建议。",
  "available_source_context_text": "应对计算机终端硬件故障进行检修和维修更换，并处理运行缓慢、不稳定等问题及提供合理使用建议。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-052 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-052",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-052",
  "requirement_text": "应每月进行终端杀毒软件升级、病毒查杀和性能优化，并开展安全使用风险评估、病毒统计分析和防护策略制定，必要时进行额外病毒查杀和安全加固。",
  "available_source_context_text": "应每月进行终端杀毒软件升级、病毒查杀和性能优化，并开展安全使用风险评估、病毒统计分析和防护策略制定，必要时进行额外病毒查杀和安全加固。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-059 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-059",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-059",
  "requirement_text": "应对两个基地网络及计算机设备进行日常状态监测、策略制定调整、特征库及版本升级，并利用分析系统辅助故障定位；同时维护机房基础设施。",
  "available_source_context_text": "应对两个基地网络及计算机设备进行日常状态监测、策略制定调整、特征库及版本升级，并利用分析系统辅助故障定位；同时维护机房基础设施。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-060 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-060",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-060",
  "requirement_text": "应为20台网络设备/服务器资产提供为期1年的硬件保修服务。",
  "available_source_context_text": "应为20台网络设备/服务器资产提供为期1年的硬件保修服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-061 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-061",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-061",
  "requirement_text": "应为7台会议室设备资产提供为期1年的硬件保修服务。",
  "available_source_context_text": "应为7台会议室设备资产提供为期1年的硬件保修服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-064 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-064",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-064",
  "requirement_text": "特殊时期故障申告后应在30秒内响应。",
  "available_source_context_text": "特殊时期故障申告后应在30秒内响应。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-065 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-065",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-065",
  "requirement_text": "硬件损坏定位后备件应在30分钟内到场。",
  "available_source_context_text": "硬件损坏定位后备件应在30分钟内到场。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-066 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-066",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-066",
  "requirement_text": "故障应在1小时内解决并恢复系统运行。",
  "available_source_context_text": "故障应在1小时内解决并恢复系统运行。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-067 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-067",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-067",
  "requirement_text": "应为4台防火墙、3台上网行为设备提供软硬件维保和特征库升级等服务。",
  "available_source_context_text": "应为4台防火墙、3台上网行为设备提供软硬件维保和特征库升级等服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-068 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-068",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-068",
  "requirement_text": "应为EDR软件、200台PC和30台Windows Server提供升级服务。",
  "available_source_context_text": "应为EDR软件、200台PC和30台Windows Server提供升级服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-070 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-070",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-070",
  "requirement_text": "每季度至少进行一次设备清理保养，发现隐患应及时报告。",
  "available_source_context_text": "每季度至少进行一次设备清理保养，发现隐患应及时报告。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-072 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-072",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-072",
  "requirement_text": "应为WAF、防火墙、上网行为管理、僵木蠕、EDR等安全设备和软件提供为期1年的特征库升级服务。",
  "available_source_context_text": "应为WAF、防火墙、上网行为管理、僵木蠕、EDR等安全设备和软件提供为期1年的特征库升级服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-077 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-077",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-077",
  "requirement_text": "远程支持重大和严重故障响应时间应小于15分钟，一般故障小于30分钟。",
  "available_source_context_text": "远程支持重大和严重故障响应时间应小于15分钟，一般故障小于30分钟。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-078 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-078",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-078",
  "requirement_text": "远程支持重大故障解决时间应小于2小时、严重故障小于4小时、一般故障小于12小时。",
  "available_source_context_text": "远程支持重大故障解决时间应小于2小时、严重故障小于4小时、一般故障小于12小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-082 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-082",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-082",
  "requirement_text": "现场支持重大故障响应时间小于2小时、严重故障小于4小时、一般故障小于8小时。",
  "available_source_context_text": "现场支持重大故障响应时间小于2小时、严重故障小于4小时、一般故障小于8小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-083 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-083",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-083",
  "requirement_text": "现场支持重大故障解决时间小于2小时、严重故障小于4小时、一般故障小于12小时。",
  "available_source_context_text": "现场支持重大故障解决时间小于2小时、严重故障小于4小时、一般故障小于12小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-087 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-087",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-087",
  "requirement_text": "重大故障电话支持应立即响应，远程登录时间小于15分钟，现场到达时间为2小时。",
  "available_source_context_text": "重大故障电话支持应立即响应，远程登录时间小于15分钟，现场到达时间为2小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-088 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-088",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-088",
  "requirement_text": "紧急故障业务恢复时间：重大故障小于2小时、严重故障小于4小时、一般故障小于8小时。",
  "available_source_context_text": "紧急故障业务恢复时间：重大故障小于2小时、严重故障小于4小时、一般故障小于8小时。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-089 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-089",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-089",
  "requirement_text": "项目执行应遵循《2006-2020年国家信息化发展战略》《网络安全等级保护制度2.0标准》《电子政务运维服务支撑系统规范》等标准规范。",
  "available_source_context_text": "项目执行应遵循《2006-2020年国家信息化发展战略》《网络安全等级保护制度2.0标准》《电子政务运维服务支撑系统规范》等标准规范。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-101 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-101",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-101",
  "requirement_text": "系统日志检查目标为每月2次，1次可接受，少于1次不可接受。",
  "available_source_context_text": "系统日志检查目标为每月2次，1次可接受，少于1次不可接受。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### CORE6:FAST-WATER-01:FAST-WATER-01:REQ-102 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-102",
  "cohort": "CORE6",
  "tender_id": "FAST-WATER-01",
  "requirement_id": "FAST-WATER-01:REQ-102",
  "requirement_text": "系统可用性目标为100%，99.9%可接受，低于99%不可接受。",
  "available_source_context_text": "系统可用性目标为100%，99.9%可接受，低于99%不可接受。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0003 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0003",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0003",
  "requirement_text": "投标人须完成数据共享交换平台管理中心软件2套和数据共享交换平台交换节点软件34套的安装部署，以及从现有交换通道到新通道的切换、切换保障和技术支撑服务。",
  "available_source_context_text": "投标人须完成数据共享交换平台管理中心软件2套和数据共享交换平台交换节点软件34套的安装部署，以及从现有交换通道到新通道的切换、切换保障和技术支撑服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0211 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0211",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0211",
  "requirement_text": "乙方须提供数据共享交换平台管理中心软件2套、数据共享交换平台交换节点软件34套，以及相应的覆盖全国的实施服务，包括国家端和各省节点的安装部署，从现有交换通道到新通道的切换、切换保障和技术支撑服务。",
  "available_source_context_text": "乙方须提供数据共享交换平台管理中心软件2套、数据共享交换平台交换节点软件34套，以及相应的覆盖全国的实施服务，包括国家端和各省节点的安装部署，从现有交换通道到新通道的切换、切换保障和技术支撑服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0218 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0218",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0218",
  "requirement_text": "乙方应指定本公司专人参加为甲方服务工作，不得外包服务，并严格审核人员保密素质，尽可能是中共党员；乙方有义务对有关人员实施保密教育和监督管理，应及时签署保密协议，并向甲方提供参与人员的名单，报甲方备案；乙方应严格控制参与甲方项目的人员数量，不得经常更换，如需变更，须经甲方同意，并立即签署三方保密协议。",
  "available_source_context_text": "乙方应指定本公司专人参加为甲方服务工作，不得外包服务，并严格审核人员保密素质，尽可能是中共党员；乙方有义务对有关人员实施保密教育和监督管理，应及时签署保密协议，并向甲方提供参与人员的名单，报甲方备案；乙方应严格控制参与甲方项目的人员数量，不得经常更换，如需变更，须经甲方同意，并立即签署三方保密协议。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0220 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0220",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0220",
  "requirement_text": "对属于甲方的信息数据应进行特别保护，乙方必须操作数据时，需向甲方申请并由甲方审批同意后进行操作；如必须操作敏感数据时，需由甲方安排随工人员；所有甲方系统或数据库的数据，乙方不得私自拷贝，未经允许，不得将数据从原安全域迁移到其他区域。",
  "available_source_context_text": "对属于甲方的信息数据应进行特别保护，乙方必须操作数据时，需向甲方申请并由甲方审批同意后进行操作；如必须操作敏感数据时，需由甲方安排随工人员；所有甲方系统或数据库的数据，乙方不得私自拷贝，未经允许，不得将数据从原安全域迁移到其他区域。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0221 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0221",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0221",
  "requirement_text": "在甲方尚未提供专用设备及网络环境用于乙方开展配置维护升级等工作时，乙方应采取尽可能的措施对来自甲方提供的未公开信息进行严格保密，包括但不限于乙方在使用保密信息时的网络环境不能与互联网联通、确保为相关工作设备安装部署安全防护措施等，且乙方有技术手段监控参与服务人员工作设备使用情况；在甲方提供专用设备及网络环境后，乙方必须在专用设备及网络环境下工作，不得私自使用个人设备办公。",
  "available_source_context_text": "在甲方尚未提供专用设备及网络环境用于乙方开展配置维护升级等工作时，乙方应采取尽可能的措施对来自甲方提供的未公开信息进行严格保密，包括但不限于乙方在使用保密信息时的网络环境不能与互联网联通、确保为相关工作设备安装部署安全防护措施等，且乙方有技术手段监控参与服务人员工作设备使用情况；在甲方提供专用设备及网络环境后，乙方必须在专用设备及网络环境下工作，不得私自使用个人设备办公。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0222 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0222",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0222",
  "requirement_text": "乙方人员在进入甲方工作区域，进行商谈，软件安装、配置、调试、集成及提供培训、现场技术支持、维修服务时应严格遵守甲方单位的保密规定，并由甲方人员陪同在指定的场所活动，不得擅自进入非指定场所；乙方承诺为甲方提供的货物（含应用软件）符合国家安全保密标准。",
  "available_source_context_text": "乙方人员在进入甲方工作区域，进行商谈，软件安装、配置、调试、集成及提供培训、现场技术支持、维修服务时应严格遵守甲方单位的保密规定，并由甲方人员陪同在指定的场所活动，不得擅自进入非指定场所；乙方承诺为甲方提供的货物（含应用软件）符合国家安全保密标准。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0223 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0223",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0223",
  "requirement_text": "在甲方发出要求返还或删除保密信息的书面通知三天内，乙方必须立即交还或删除甲方提供的属于保密信息的全部文件或其他资料。",
  "available_source_context_text": "在甲方发出要求返还或删除保密信息的书面通知三天内，乙方必须立即交还或删除甲方提供的属于保密信息的全部文件或其他资料。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0229 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0229",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0229",
  "requirement_text": "乙方工作人员须遵守安全保密规定，对从甲方接触的保密信息严格保密，未经许可不得提供给第三方、私自拷贝、篡改、毁损、泄露、出售或以其他非法方式使用。",
  "available_source_context_text": "乙方工作人员须遵守安全保密规定，对从甲方接触的保密信息严格保密，未经许可不得提供给第三方、私自拷贝、篡改、毁损、泄露、出售或以其他非法方式使用。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0232 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0232",
  "cohort": "HOLDOUT_V1",
  "tender_id": "HOLDOUT-REQ-01",
  "requirement_id": "HOLDOUT-REQ-01-CAN-0232",
  "requirement_text": "乙方工作人员即使与乙方解除雇用关系后，也不得向第三方公开甲方所拥有的未被公众知晓的保密信息。",
  "available_source_context_text": "乙方工作人员即使与乙方解除雇用关系后，也不得向第三方公开甲方所拥有的未被公众知晓的保密信息。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "MEDIUM",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "UNCLASSIFIED_RESPONSE_BOUNDARY"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0059 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0059",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0059",
  "requirement_text": "招标人如对产品功能有疑问，中标人须配合招标人对产品功能进行测试。如不满足招标技术指标，招标人有权要求更换产品并追究其责任，所产生的费用及损失全部由中标人承担。",
  "available_source_context_text": "招标人如对产品功能有疑问，中标人须配合招标人对产品功能进行测试。如不满足招标技术指标，招标人有权要求更换产品并追究其责任，所产生的费用及损失全部由中标人承担。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0459 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0459",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0459",
  "requirement_text": "每年1次对设备操作系统、软件和硬件的缺陷进行防御性维护检查和评估，提交评估报告，并协助完成必要的优化或升级。服务的起始时间为设备到货日，截止时间与原厂维保的服务截止时间保持一致。",
  "available_source_context_text": "每年1次对设备操作系统、软件和硬件的缺陷进行防御性维护检查和评估，提交评估报告，并协助完成必要的优化或升级。服务的起始时间为设备到货日，截止时间与原厂维保的服务截止时间保持一致。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0460 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0460",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-01",
  "requirement_id": "HOLDOUT-REQ-V2-01-CAN-0460",
  "requirement_text": "投标人承诺，若中标，则无条件配合招标人完成“中国网络安全审查认证和市场监管大数据中心”的网络安全审查并提供审查所需材料。中标人的产品和服务须通过“中国网络安全审查认证和市场监管大数据中心”的网络安全审查，若未通过，招标人有权终止合同。",
  "available_source_context_text": "投标人承诺，若中标，则无条件配合招标人完成“中国网络安全审查认证和市场监管大数据中心”的网络安全审查并提供审查所需材料。中标人的产品和服务须通过“中国网络安全审查认证和市场监管大数据中心”的网络安全审查，若未通过，招标人有权终止合同。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0156 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0156",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0156",
  "requirement_text": "实施团队人员须具备服务器硬件、操作系统、网络交换机等相关工作经验，工作经验不少于3年，并免费提供本项目设备上下架及搬迁服务。",
  "available_source_context_text": "实施团队人员须具备服务器硬件、操作系统、网络交换机等相关工作经验，工作经验不少于3年，并免费提供本项目设备上下架及搬迁服务。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0173 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0173",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0173",
  "requirement_text": "乙方应在货物运到甲方地点日七日前，向甲方提供货物卸车、清点计划（内容包括：合同号、设备名称、数量、价格、箱数、型号规格、重量和体积、拟发运的时间及其他必要的说明），并于发运的同时通知甲方。",
  "available_source_context_text": "乙方应在货物运到甲方地点日七日前，向甲方提供货物卸车、清点计划（内容包括：合同号、设备名称、数量、价格、箱数、型号规格、重量和体积、拟发运的时间及其他必要的说明），并于发运的同时通知甲方。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0184 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0184",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0184",
  "requirement_text": "乙方应保证所提供的货物经正确安装、合理操作和维护保养在其使用寿命期内具有令甲方满意的性能，并对由于合同货物的设计、工艺或材料的缺陷而发生的任何故障负责。",
  "available_source_context_text": "乙方应保证所提供的货物经正确安装、合理操作和维护保养在其使用寿命期内具有令甲方满意的性能，并对由于合同货物的设计、工艺或材料的缺陷而发生的任何故障负责。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0187 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0187",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0187",
  "requirement_text": "若检验时发现货物数量不足、规格与合同要求不符或开箱时货物外包装完好但箱内货物短缺或损伤，双方应签署书面形式证明，乙方应根据该证明及时补足或更换；补足或更换的货物应在签署货损证明之日起规定期限内（详见合同条款专用部分）运达甲方指定地点，相关费用由乙方承担。",
  "available_source_context_text": "若检验时发现货物数量不足、规格与合同要求不符或开箱时货物外包装完好但箱内货物短缺或损伤，双方应签署书面形式证明，乙方应根据该证明及时补足或更换；补足或更换的货物应在签署货损证明之日起规定期限内（详见合同条款专用部分）运达甲方指定地点，相关费用由乙方承担。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0197 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0197",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0197",
  "requirement_text": "如乙方在接到甲方维修通知后的规定时间内（具体见合同条款专用部分）仍不能修复有关货物，乙方应提供与该货物同一型号的备用货物，如因此给甲方造成损失，乙方应负责赔偿。",
  "available_source_context_text": "如乙方在接到甲方维修通知后的规定时间内（具体见合同条款专用部分）仍不能修复有关货物，乙方应提供与该货物同一型号的备用货物，如因此给甲方造成损失，乙方应负责赔偿。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0200 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0200",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0200",
  "requirement_text": "因乙方提供的货物硬件或软件有缺陷、技术资料有错误或现场技术人员指导错误而使合同货物不能达到合同规定的指标和技术性能时，乙方应负责按本合同相关条款规定修理或更换，使货物运行指标和技术性能达到合同规定，由此引起的全部费用由乙方承担；若导致甲方损失或第三方损害，全部赔偿责任由乙方承担。",
  "available_source_context_text": "因乙方提供的货物硬件或软件有缺陷、技术资料有错误或现场技术人员指导错误而使合同货物不能达到合同规定的指标和技术性能时，乙方应负责按本合同相关条款规定修理或更换，使货物运行指标和技术性能达到合同规定，由此引起的全部费用由乙方承担；若导致甲方损失或第三方损害，全部赔偿责任由乙方承担。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0203 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0203",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0203",
  "requirement_text": "在合同货物保修期届满后，因合同货物硬件或软件的固有缺陷和瑕疵出现紧急故障和事故时，乙方应在接到甲方通知后立即提供电话支持、远程支持并在规定时间内（具体时间见合同条款专用部分）到达现场，迅速排除货物故障。",
  "available_source_context_text": "在合同货物保修期届满后，因合同货物硬件或软件的固有缺陷和瑕疵出现紧急故障和事故时，乙方应在接到甲方通知后立即提供电话支持、远程支持并在规定时间内（具体时间见合同条款专用部分）到达现场，迅速排除货物故障。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0215 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0215",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0215",
  "requirement_text": "在甲方规定的时间内，用符合合同规定的规格、质量和性能要求的新零件、部件或货物来更换有缺陷的零件、部件和货物，或修补缺陷部分以达到合同规定的要求，乙方应承担由此发生的相关费用并承担由此给甲方造成的直接损失及甲方因此产生的对第三方的责任；此时相关货物的质量保修期也应相应延长。",
  "available_source_context_text": "在甲方规定的时间内，用符合合同规定的规格、质量和性能要求的新零件、部件或货物来更换有缺陷的零件、部件和货物，或修补缺陷部分以达到合同规定的要求，乙方应承担由此发生的相关费用并承担由此给甲方造成的直接损失及甲方因此产生的对第三方的责任；此时相关货物的质量保修期也应相应延长。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "HIGH",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "evidence_dependency",
    "human_required"
  ]
}
```

### HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0221 — POST_AWARD_COMMITMENT_AS_EVIDENCE
```json
{
  "case_id": "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0221",
  "cohort": "HOLDOUT_V2",
  "tender_id": "HOLDOUT-REQ-V2-02",
  "requirement_id": "HOLDOUT-REQ-V2-02-CAN-0221",
  "requirement_text": "超过一定时间（详见合同条款专用部分）且成套集成的货物已交货套数未达合同约定套数90%的以及单套货物未能全部交足的，或非成套、非集成的货物已交货件数未达合同约定件数90%的，守约方有权解除合同，并要求违约方赔偿由此造成的损失。上述逾期超过20天但成套集成的货物已交货套数已达合同约定套数90%的，或非成套、非集成的货物已交货件数已达合同约定件数90%的，按合同条款专用部分处理。",
  "available_source_context_text": "超过一定时间（详见合同条款专用部分）且成套集成的货物已交货套数未达合同约定套数90%的以及单套货物未能全部交足的，或非成套、非集成的货物已交货件数未达合同约定件数90%的，守约方有权解除合同，并要求违约方赔偿由此造成的损失。上述逾期超过20天但成套集成的货物已交货套数已达合同约定套数90%的，或非成套、非集成的货物已交货件数已达合同约定件数90%的，按合同条款专用部分处理。",
  "source_context_note": "Router replay row contains requirement text; no separate source-span/context artifact was attached to this row.",
  "frozen_reference_v3": {
    "primary_response_mode": "COMMITMENT",
    "risk_tier": "P0",
    "evidence_dependency": false,
    "response_required": true,
    "human_required": true,
    "scoring_related": false
  },
  "router_v2_1": {
    "primary_response_mode": "EVIDENCE",
    "risk_tier": "HIGH",
    "evidence_dependency": true,
    "response_required": true,
    "human_required": false,
    "scoring_related": false,
    "routing_reasons": [
      "ENTERPRISE_OR_PRODUCT_EVIDENCE"
    ]
  },
  "hard_safety_gate_name": "POST_AWARD_COMMITMENT_AS_EVIDENCE",
  "mechanical_detector_rule_path": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "productDominant/technicalSpec evidence branch",
    "response_mode=EVIDENCE"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "disagreement_dimensions": [
    "primary_response_mode",
    "risk_tier",
    "evidence_dependency",
    "human_required"
  ]
}
```

## D. Mechanical rule-path groups

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|BID_FORMALITY_OR_PROCEDURE",
  "count": 40,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:TB-003:TB-003:REQ-011",
    "CORE6:TB-003:TB-003:REQ-016",
    "CORE6:FAST-04:FAST-04:REQ-212",
    "CORE6:FAST-04:FAST-04:REQ-338",
    "CORE6:FAST-04:FAST-04:REQ-344",
    "CORE6:FAST-04:FAST-04:REQ-345",
    "CORE6:FAST-04:FAST-04:REQ-347",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0054",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0075",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0121"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMMITMENT|PROJECT_OR_CONTRACT_COMMITMENT",
  "count": 38,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMMITMENT",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:TB-003:TB-003:REQ-017",
    "CORE6:TB-003:TB-003:REQ-106",
    "CORE6:TB-003:TB-003:REQ-107",
    "CORE6:TB-003:TB-003:REQ-108",
    "CORE6:TB-003:TB-003:REQ-192",
    "CORE6:TB-003:TB-003:REQ-193",
    "CORE6:FAST-04:FAST-04:REQ-005",
    "CORE6:FAST-04:FAST-04:REQ-008",
    "CORE6:FAST-04:FAST-04:REQ-174",
    "CORE6:FAST-04:FAST-04:REQ-175"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|BID_FORMALITY_OR_PROCEDURE+SCORING_RELATED",
  "count": 1,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:TB-003:TB-003:REQ-029"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|SOLUTION|PROJECT_SOLUTION_OR_FUNCTIONAL_DESIGN",
  "count": 9,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned SOLUTION",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:FAST-04:FAST-04:REQ-298",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0124",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0128",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0134",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0191",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0026",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0047",
    "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0427",
    "HOLDOUT_V2:HOLDOUT-REQ-V2-02:HOLDOUT-REQ-V2-02-CAN-0126"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|P0_OR_ELIGIBILITY_COMPLIANCE",
  "count": 9,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0076",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0078",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0160",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0161",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0193",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0207",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0060",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0065",
    "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0048"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|UNCLASSIFIED_RESPONSE_BOUNDARY",
  "count": 6,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0150",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0198",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0078",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0079",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0081",
    "HOLDOUT_V1:HOLDOUT-REQ-02:HOLDOUT-REQ-02-CAN-0164"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|SCORING_RELATED",
  "count": 1,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned LOW",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0338"
  ]
}
```

```json
{
  "mechanical_group_id": "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE|COMPLIANCE|P0_OR_ELIGIBILITY_COMPLIANCE+SCORING_RELATED",
  "count": 1,
  "affected_hard_safety_gates": [
    "HIGH_RISK_P0_EVIDENCE_DEPENDENCY_FALSE_NEGATIVE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned COMPLIANCE",
    "riskOf returned P0",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "HOLDOUT_V2:HOLDOUT-REQ-V2-01:HOLDOUT-REQ-V2-01-CAN-0485"
  ]
}
```

```json
{
  "mechanical_group_id": "POST_AWARD_COMMITMENT_AS_EVIDENCE|EVIDENCE|ENTERPRISE_OR_PRODUCT_EVIDENCE",
  "count": 58,
  "affected_hard_safety_gates": [
    "POST_AWARD_COMMITMENT_AS_EVIDENCE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned HIGH",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:JY-001:JY-001:REQ-101",
    "CORE6:JY-001:JY-001:REQ-150",
    "CORE6:TB-006:TB-006:REQ-004",
    "CORE6:TB-006:TB-006:REQ-028",
    "CORE6:FAST-01:FAST-01:REQ-003",
    "CORE6:FAST-01:FAST-01:REQ-005",
    "CORE6:FAST-01:FAST-01:REQ-016",
    "CORE6:FAST-01:FAST-01:REQ-021",
    "CORE6:FAST-01:FAST-01:REQ-022",
    "CORE6:FAST-01:FAST-01:REQ-023"
  ]
}
```

```json
{
  "mechanical_group_id": "POST_AWARD_COMMITMENT_AS_EVIDENCE|EVIDENCE|UNCLASSIFIED_RESPONSE_BOUNDARY",
  "count": 8,
  "affected_hard_safety_gates": [
    "POST_AWARD_COMMITMENT_AS_EVIDENCE"
  ],
  "rule_function_names": [
    "projectRequirementResponseV21",
    "signalsOf",
    "modeOf",
    "riskOf",
    "secondaryDependencies"
  ],
  "mechanical_precedence_path": [
    "projectRequirementResponseV21",
    "modeOf returned EVIDENCE",
    "riskOf returned MEDIUM",
    "cross-cutting projection fields emitted"
  ],
  "representative_case_ids": [
    "CORE6:TB-003:TB-003:REQ-206",
    "CORE6:TB-006:TB-006:REQ-021",
    "CORE6:FAST-04:FAST-04:REQ-181",
    "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-038",
    "CORE6:FAST-WATER-01:FAST-WATER-01:REQ-048",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0223",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0229",
    "HOLDOUT_V1:HOLDOUT-REQ-01:HOLDOUT-REQ-01-CAN-0232"
  ]
}
```

## E. V2 → V2.1 metric snapshot

- Overall primary agreement: V2 1597/2178 (0.733242); V2.1 1684/2178 (0.773186).
```json
{
  "per_mode_precision_recall": {
    "SOLUTION": {
      "v2": {
        "true_positive": 85,
        "false_positive": 184,
        "false_negative": 115,
        "precision": 0.315985,
        "recall": 0.425
      },
      "v2_1": {
        "true_positive": 59,
        "false_positive": 69,
        "false_negative": 141,
        "precision": 0.460938,
        "recall": 0.295
      }
    },
    "EVIDENCE": {
      "v2": {
        "true_positive": 793,
        "false_positive": 164,
        "false_negative": 164,
        "precision": 0.828631,
        "recall": 0.828631
      },
      "v2_1": {
        "true_positive": 853,
        "false_positive": 178,
        "false_negative": 104,
        "precision": 0.827352,
        "recall": 0.891327
      }
    },
    "COMMITMENT": {
      "v2": {
        "true_positive": 335,
        "false_positive": 146,
        "false_negative": 169,
        "precision": 0.696466,
        "recall": 0.664683
      },
      "v2_1": {
        "true_positive": 347,
        "false_positive": 124,
        "false_negative": 157,
        "precision": 0.73673,
        "recall": 0.688492
      }
    },
    "COMPLIANCE": {
      "v2": {
        "true_positive": 384,
        "false_positive": 87,
        "false_negative": 130,
        "precision": 0.815287,
        "recall": 0.747082
      },
      "v2_1": {
        "true_positive": 422,
        "false_positive": 104,
        "false_negative": 92,
        "precision": 0.802281,
        "recall": 0.821012
      }
    },
    "NEED_REVIEW": {
      "v2": {
        "true_positive": 0,
        "false_positive": 0,
        "false_negative": 3,
        "precision": 0,
        "recall": 0
      },
      "v2_1": {
        "true_positive": 3,
        "false_positive": 19,
        "false_negative": 0,
        "precision": 0.136364,
        "recall": 1
      }
    }
  },
  "cross_cutting": {
    "risk_tier": {
      "v2": {
        "count": 1046,
        "rate": 0.480257
      },
      "v2_1": {
        "count": 1319,
        "rate": 0.605601
      }
    },
    "response_required": {
      "v2": {
        "count": 2005,
        "rate": 0.920569
      },
      "v2_1": {
        "count": 2102,
        "rate": 0.965106
      }
    },
    "evidence_dependency": {
      "v2": {
        "count": 1707,
        "rate": 0.783747
      },
      "v2_1": {
        "count": 1703,
        "rate": 0.78191
      }
    },
    "human_required": {
      "v2": {
        "count": 1597,
        "rate": 0.733242
      },
      "v2_1": {
        "count": 1771,
        "rate": 0.813131
      }
    },
    "scoring_related": {
      "v2": {
        "count": 2148,
        "rate": 0.986226
      },
      "v2_1": {
        "count": 2148,
        "rate": 0.986226
      }
    }
  },
  "need_review": {
    "v2": {
      "true_positive": 0,
      "false_positive": 0,
      "false_negative": 3,
      "precision": 0,
      "recall": 0
    },
    "v2_1": {
      "true_positive": 3,
      "false_positive": 19,
      "false_negative": 0,
      "precision": 0.136364,
      "recall": 1
    }
  }
}
```

## F. Changed-file / anti-overfit audit

- Router source paths in the current V2.1 artifact: `backend/src/pipeline/requirement-response-router-v2.js`, `backend/src/pipeline/requirement-response-router-v2-1.js`.
- Related deterministic tests recorded by the V2.1 regression report: `backend/test/requirement-response-router-v2.test.js`, `backend/test/requirement-response-router-v2-1.test.js`, `backend/test/response-router-semantic-calibration-v2.test.js`, `backend/test/response-router-full-blind-export-v2.test.js`.
- Current worktree status for these paths is untracked; no committed diff against HEAD is available.
- Major general-rule changes are recorded in `docs/V43_RESPONSE_ROUTER_V2_1_ROOT_CAUSE.md`: pre-award compliance, product/technical evidence, project design, post-award obligations, evidence dependency, risk, and mixed/incomplete boundary handling.
- Production Router source scan found no case/tender/reference/expected-label branching. Test fixtures contain cohort/case identifiers only for artifact-shape assertions; no exact-case production exception was found.
- Anti-overfit violation detected: NO in the Router source scan.

## G. Side-effect verification

```json
{
  "provider_calls": 0,
  "llm_calls": 0,
  "production_db_writes": 0,
  "reference_v2_mutations": 0,
  "reference_v3_mutations": 0,
  "requirement_mutations": 0,
  "fact_mutations": 0,
  "mapping_actions": 0,
  "claim_actions": 0,
  "writer_actions": 0,
  "production_router_cutover": 0,
  "commit": 0,
  "push": 0,
  "merge": 0,
  "deploy": 0
}
```

## Status

- V2.1 hard-safety gates remain blocked: two target metrics are non-zero.
