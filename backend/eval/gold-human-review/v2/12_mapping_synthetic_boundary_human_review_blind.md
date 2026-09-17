# Mapping Synthetic Boundary Full Human Review — Blind



- source-only packet; engineering/disputed cases are exported separately

- semantic boundary cases: 29



### MAP-G001
#### Requirement
- text: 已完成统一认证项目
- structured_fields: {}

#### Fact 1
- fact_ref: F001
- subject: {"type":"project","name":"统一认证"}
- entities: []
- fact_status: completed
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G002
#### Requirement
- text: 提供统一认证能力
- structured_fields: {}

#### Fact 1
- fact_ref: F002
- subject: {"type":"capability","name":"统一认证"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G003
#### Requirement
- text: 统一认证与权限管理
- structured_fields: {}

#### Fact 1
- fact_ref: F003
- subject: {"type":"capability","name":"统一认证"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G004
#### Requirement
- text: 国产数据库适配案例
- structured_fields: {}

#### Fact 1
- fact_ref: F004
- subject: {"type":"technology","name":"数据库技术方案"}
- entities: []
- fact_status: unknown
- scopes: ["technical_reference"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G005
#### Requirement
- text: 提供已验收的统一认证项目
- structured_fields: {}

#### Fact 1
- fact_ref: F005
- subject: {"type":"project","name":"统一认证"}
- entities: []
- fact_status: in_progress
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G006
#### Requirement
- text: 提供统一认证项目
- structured_fields: {}

#### Fact 1
- fact_ref: F006
- subject: {"type":"project","name":"财务报销"}
- entities: []
- fact_status: completed
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G007
#### Requirement
- text: 支持10000并发用户
- structured_fields: {"quantities":[{"metric":"concurrency","value":"10000","unit":"user"}]}

#### Fact 1
- fact_ref: F007
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: [{"metric":"concurrency","value":"1000","unit":"user"}]
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G008
#### Requirement
- text: 已完成并验收的项目
- structured_fields: {"status":"completed"}

#### Fact 1
- fact_ref: F008
- subject: {"type":"project","name":"平台"}
- entities: []
- fact_status: in_progress
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G009
#### Requirement
- text: 集团范围部署
- structured_fields: {"scopes":["group"]}

#### Fact 1
- fact_ref: F009
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: completed
- scopes: ["subsidiary"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G010
#### Requirement
- text: 为甲公司建设平台
- structured_fields: {"entities":[{"type":"company","name":"甲公司"}]}

#### Fact 1
- fact_ref: F010
- subject: {"type":"system","name":"平台"}
- entities: [{"type":"company","name":"乙公司"}]
- fact_status: completed
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G011
#### Requirement
- text: 当前有效许可
- structured_fields: {"validity":{"status":"active"}}

#### Fact 1
- fact_ref: F011
- subject: {"type":"license","name":"许可"}
- entities: []
- fact_status: verified
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"expired"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G012
#### Requirement
- text: 提供日志审计能力
- structured_fields: {}

#### Fact 1
- fact_ref: F012
- subject: {"type":"capability","name":"日志审计"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G013
#### Requirement
- text: 具备备份能力
- structured_fields: {}

#### Fact 1
- fact_ref: F013
- subject: {"type":"capability","name":"备份"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G014
#### Requirement
- text: 支持数据导出
- structured_fields: {}

#### Fact 1
- fact_ref: F014
- subject: {"type":"capability","name":"数据导出"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G015
#### Requirement
- text: 支持100并发
- structured_fields: {"quantities":[{"metric":"concurrency","value":"100","unit":"user"}]}

#### Fact 1
- fact_ref: F015
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G016
#### Requirement
- text: 提供容灾恢复服务
- structured_fields: {}

#### Fact 1
- fact_ref: F016
- subject: {"type":"capability","name":"数据备份"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G017
#### Requirement
- text: 10000并发用户
- structured_fields: {"quantities":[{"metric":"concurrency","value":"10000","unit":"user"}]}

#### Fact 1
- fact_ref: F017
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: registered
- scopes: ["enterprise"]
- quantities: [{"metric":"registered_users","value":"10000","unit":"user"}]
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G018
#### Requirement
- text: 已完成项目
- structured_fields: {"status":"completed"}

#### Fact 1
- fact_ref: F018
- subject: {"type":"project","name":"平台"}
- entities: []
- fact_status: participated
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G019
#### Requirement
- text: 集团范围案例
- structured_fields: {"scopes":["group"]}

#### Fact 1
- fact_ref: F019
- subject: {"type":"project","name":"平台"}
- entities: [{"type":"company","name":"集团子公司"}]
- fact_status: completed
- scopes: ["subsidiary"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G020
#### Requirement
- text: 当前项目经验
- structured_fields: {}

#### Fact 1
- fact_ref: F020
- subject: {"type":"project","name":"历史项目"}
- entities: []
- fact_status: completed
- scopes: ["historical_bid"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G021
#### Requirement
- text: 统一认证和权限管理
- structured_fields: {}

#### Fact 1
- fact_ref: F021
- subject: {"type":"capability","name":"统一认证"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G022
#### Requirement
- text: 统一认证和权限管理
- structured_fields: {}

#### Fact 1
- fact_ref: F022
- subject: {"type":"capability","name":"权限管理"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G029
#### Requirement
- text: P95响应时间不超过1秒
- structured_fields: {"quantities":[{"metric":"p95_response_time","value":"1","unit":"second"}]}

#### Fact 1
- fact_ref: F029
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: verified
- scopes: ["enterprise"]
- quantities: [{"metric":"p95_response_time","value":"1.4","unit":"second"}]
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G030
#### Requirement
- text: 可用率99.99%
- structured_fields: {}

#### Fact 1
- fact_ref: F030
- subject: {"type":"service","name":"平台"}
- entities: []
- fact_status: verified
- scopes: ["enterprise"]
- quantities: [{"metric":"availability","value":"99.9","unit":"percent"}]
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G031
#### Requirement
- text: 具备认证项目经理
- structured_fields: {}

#### Fact 1
- fact_ref: F031
- subject: {"type":"personnel","name":"项目经理"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G033
#### Requirement
- text: 使用指定品牌型号
- structured_fields: {}

#### Fact 1
- fact_ref: F033
- subject: {"type":"product","name":"通用设备"}
- entities: []
- fact_status: verified
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G034
#### Requirement
- text: 支持容灾演练
- structured_fields: {}

#### Fact 1
- fact_ref: F034
- subject: {"type":"document","name":"灾备技术白皮书"}
- entities: []
- fact_status: unknown
- scopes: ["technical_reference"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G035
#### Requirement
- text: 提供数据治理能力
- structured_fields: {}

#### Fact 1
- fact_ref: F035
- subject: {"type":"capability","name":"数据相关"}
- entities: []
- fact_status: unknown
- scopes: ["enterprise"]
- quantities: []
- validity: {"status":"unknown"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:

### MAP-G036
#### Requirement
- text: 集团已验收平台
- structured_fields: {"status":"accepted","scopes":["group"]}

#### Fact 1
- fact_ref: F036
- subject: {"type":"system","name":"平台"}
- entities: []
- fact_status: in_progress
- scopes: ["subsidiary"]
- quantities: []
- validity: {"status":"known"}

#### Fixture input metadata
- {}

#### USER REVIEW (blank)
- USER_SOURCE_QUALITY: [ ] PASS  [ ] FAIL  [ ] DISPUTED
- USER_MAPPING_DECISION: [ ] direct_full  [ ] partial_support  [ ] related_reference  [ ] related_insufficient  [ ] conflict  [ ] unrelated  [ ] unknown  [ ] NOT_SUITABLE_FOR_GOLD
- USER_DIMENSIONS: subject = ; scope = ; status = ; quantity = ; entity = ; validity =
- USER_SCORE_ELIGIBILITY: [ ] SCORED  [ ] RESERVE  [ ] DISPUTED  [ ] REMOVE
- USER_CONFIDENCE:
- USER_RATIONALE:
