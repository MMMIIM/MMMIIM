# Mapping Engineering + Disputed Review

- This surface is not Semantic Gold and is excluded from the semantic denominator.

### MAP-G023
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G023","requirement":{"text":"提供统一认证"},"facts":[],"governance_purpose":"zero-fact persistence/unknown fallback"}
- deterministic_behavior_tested: zero-fact persistence/unknown fallback
- semantic_expected_decision: unknown
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G024
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G024","requirement":{"text":"当前平台版本"},"facts":[{"fact_ref":"F024","subject":{"type":"system","name":"旧平台"},"entities":[],"fact_status":"completed","scopes":["enterprise"],"quantities":[],"validity":{"status":"known"},"fact_current":false}],"governance_purpose":"stale-currentness rejection"}
- deterministic_behavior_tested: stale-currentness rejection
- semantic_expected_decision: unknown
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G025
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G025","requirement":{"text":"本项目平台"},"facts":[{"fact_ref":"F025","project_id":"other-project","subject":{"type":"system","name":"平台"},"entities":[],"fact_status":"completed","scopes":["enterprise"],"quantities":[],"validity":{"status":"known"}}],"governance_purpose":"cross-project isolation"}
- deterministic_behavior_tested: cross-project isolation
- semantic_expected_decision: unknown
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G026
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G026","requirement":{"text":"统一认证与权限管理"},"facts":[{"fact_ref":"F026","subject":{"type":"capability","name":"统一认证与权限管理"},"entities":[],"fact_status":"unknown","scopes":["enterprise"],"quantities":[],"validity":{"status":"unknown"}}],"upstream_support_level":"partial_support","governance_purpose":"upstream partial support cannot escalate"}
- deterministic_behavior_tested: upstream partial support cannot escalate
- semantic_expected_decision: direct_full
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G027
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G027","requirement":{"text":"统一认证"},"facts":[{"fact_ref":"F027","subject":{"type":"capability","name":"统一认证"},"entities":[],"fact_status":"unknown","scopes":["enterprise"],"quantities":[],"validity":{"status":"unknown"}}],"existing_mapping":{"reviewer_type":"human","review_status":"approved"},"governance_purpose":"human approval identity preservation"}
- deterministic_behavior_tested: human approval identity preservation
- semantic_expected_decision: direct_full
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G028
- current_classification: ENGINEERING_FIXTURE
- fixture_input: {"case_id":"MAP-G028","requirement":{"text":"平台能力清单"},"facts":[{"fact_ref":"F028-1"},{"fact_ref":"F028-2"},{"fact_ref":"F028-3"},{"fact_ref":"F028-4"},{"fact_ref":"F028-5"},{"fact_ref":"F028-6"},{"fact_ref":"F028-7"}],"governance_purpose":"deterministic batch split and fact retention"}
- deterministic_behavior_tested: deterministic batch split and fact retention
- semantic_expected_decision: ABSENT
- excluded_from_semantic_denominator: true
- exclusion_reason: ENGINEERING_REGRESSION

### MAP-G032
- current_classification: DISPUTED_CASE
- fixture_input: {"case_id":"MAP-G032","requirement":{"text":"由本企业直接交付平台"},"facts":[{"fact_ref":"F032","subject":{"type":"service","name":"平台集成"},"entities":[{"type":"vendor","name":"第三方供应商"}],"fact_status":"completed","scopes":["enterprise"],"quantities":[],"validity":{"status":"known"}}],"governance_purpose":"third-party dependency and delivery-boundary semantics remain unresolved"}
- deterministic_behavior_tested: third-party dependency and delivery-boundary semantics remain unresolved
- semantic_expected_decision: partial_support
- excluded_from_semantic_denominator: true
- exclusion_reason: DISPUTED_HUMAN_REVIEW
