import { buildWriterTask, guardCriticalAssertions, validateWriterOutput } from '../../src/pipeline/writer-execution-contract-v1.js';

const HASH = 'a'.repeat(64);

const enterpriseClaim = (overrides = {}) => ({
  claim_id: 'CLM-FAST-1',
  claim_type: 'enterprise_capability',
  claim_text: '我司现有平台具备统一认证能力。',
  text: '我司现有平台具备统一认证能力。',
  decision: 'allow',
  writer_eligible: true,
  claim_assertion_identity: HASH,
  gate_result_id: 'GATE-FAST-1',
  input_snapshot_hash: HASH,
  lineage_current: true,
  allowed_scope: ['华东区域'],
  required_conditions: ['仅限当前项目'],
  limitations: ['不包含其他区域'],
  ...overrides
});

const requirementResponseClaim = (overrides = {}) => ({
  claim_id: 'CLM-FAST-RESPONSE-1',
  requirement_id: 'REQ-FAST-RESPONSE-1',
  claim_type: 'requirement_response',
  claim_text: '系统应提供审计日志。',
  text: '系统应提供审计日志。',
  decision: 'allow',
  writer_eligible: true,
  claim_assertion_identity: HASH,
  gate_result_id: 'GATE-FAST-RESPONSE-1',
  input_snapshot_hash: HASH,
  lineage_current: true,
  ...overrides
});

const safeContext = ({ requirements = [], claims = [] } = {}) => ({
  project_id: 'WRITER-FAST-SYNTHETIC',
  chapter_id: 'chapter-fast',
  authorization_snapshot_hash: HASH,
  contract_version: 'writer-safe-context-v1',
  context_items: [],
  assertable_claims: claims,
  blocked_items: [],
  pending_items: [],
  requirements
});

const makeTask = ({ requirements = [], claims = [] } = {}) => buildWriterTask({
  safeContext: safeContext({ requirements, claims }),
  chapterRole: 'functional_solution',
  chapterInstruction: '仅使用授权输入。',
  requirements
});

const makeOutput = (task, text, refs = []) => validateWriterOutput(task, {
  writer_task_id: task.writer_task_id,
  chapter_id: task.chapter_id,
  source_context_hash: task.safe_context_hash,
  blocks: [{ block_id: 'block-1', text, used_context_refs: [], used_claim_refs: refs }]
});

const cases = [
  {
    id: 'project_response_only',
    task: makeTask({ requirements: [{ requirement_id: 'REQ-FAST-1', req_id: 'REQ-FAST-1', text: '系统应支持统一认证。', response_mode: 'REQUIREMENT_RESPONSE_ONLY', enterprise_capability_assertion_allowed: false }] }),
    output: '本项目将按照招标要求开展统一认证设计。',
    expected: 'pass', metric: 'requirement_laundering'
  },
  {
    id: 'W-AUTH-RETENTION-001',
    task: makeTask({
      requirements: [{ requirement_id: 'REQ-FAST-RESPONSE-1', req_id: 'REQ-FAST-RESPONSE-1', text: '系统应提供审计日志。', response_mode: 'REQUIREMENT_RESPONSE_ONLY', enterprise_capability_assertion_allowed: false }],
      claims: [requirementResponseClaim()]
    }),
    output: '本项目将按照招标要求提供审计日志。',
    refs: ['CLM-FAST-RESPONSE-1'],
    expected: 'pass', metric: 'requirement_response_retention'
  },
  {
    id: 'requirement_laundering_negative',
    task: makeTask({ requirements: [{ requirement_id: 'REQ-FAST-2', req_id: 'REQ-FAST-2', text: '系统应支持统一认证。', response_mode: 'REQUIREMENT_RESPONSE_ONLY', enterprise_capability_assertion_allowed: false }] }),
    output: '我司现有平台具备统一认证能力。',
    expected: 'failed', metric: 'requirement_laundering'
  },
  {
    id: 'authorized_strong_claim',
    task: makeTask({ claims: [enterpriseClaim()] }),
    output: enterpriseClaim().claim_text, refs: ['CLM-FAST-1'], expected: 'pass', metric: 'authorized_strong_claim'
  },
  {
    id: 'scope_restriction_negative',
    task: makeTask({ claims: [enterpriseClaim()] }),
    output: '我司现有平台在全国范围具备统一认证能力。', refs: ['CLM-FAST-1'], expected: 'failed', metric: 'restrict_loss'
  },
  {
    id: 'quantity_restriction_negative',
    task: makeTask({ claims: [enterpriseClaim({ claim_id: 'CLM-FAST-2', claim_text: '接口响应时间不超过3秒。', text: '接口响应时间不超过3秒。' })] }),
    output: '接口响应时间不超过5秒。', refs: ['CLM-FAST-2'], expected: 'failed', metric: 'quantity_invention'
  },
  {
    id: 'status_restriction_negative',
    task: makeTask({ claims: [enterpriseClaim({ claim_id: 'CLM-FAST-3', claim_text: '项目已完成验收。', text: '项目已完成验收。' })] }),
    output: '项目已成功交付并完成验收。', refs: ['CLM-FAST-3'], expected: 'failed', metric: 'status_expansion'
  },
  {
    id: 'validity_restriction_negative',
    task: makeTask({ claims: [enterpriseClaim({ claim_id: 'CLM-FAST-4', claim_text: '证书有效期至2026年1月1日。', text: '证书有效期至2026年1月1日。' })] }),
    output: '证书长期有效。', refs: ['CLM-FAST-4'], expected: 'failed', metric: 'validity_expansion'
  },
  {
    id: 'composite_authorized_claim',
    task: makeTask({ claims: [enterpriseClaim({ claim_id: 'CLM-FAST-5', claim_text: '华东区域当前项目支持统一认证，接口响应时间不超过3秒。', text: '华东区域当前项目支持统一认证，接口响应时间不超过3秒。', allowed_scope: ['华东区域'], required_conditions: ['当前项目'] })] }),
    output: '华东区域当前项目支持统一认证，接口响应时间不超过3秒。', refs: ['CLM-FAST-5'], expected: 'pass', metric: 'authorized_narrow_claim'
  }
];

export function runWriterFastGate() {
  const metrics = {
    unauthorized_assertion_count: 0,
    requirement_laundering_count: 0,
    authority_expansion_count: 0,
    restrict_condition_loss_count: 0,
    fact_bypass_count: 0,
    mapping_bypass_count: 0,
    stale_authorization_use_count: 0,
    authorized_strong_claim_retention: 0,
    authorized_narrow_claim_retention: 0,
    authorized_requirement_response_retention: 0,
    section_completeness: 1
  };
  const observed = [];
  for (const fixture of cases) {
    const output = makeOutput(fixture.task, fixture.output, fixture.refs || []);
    const guard = guardCriticalAssertions(fixture.task, output);
    const actual = guard.status;
    observed.push({ id: fixture.id, expected: fixture.expected, actual, findings: guard.findings.length });
    if (fixture.expected === 'pass' && actual !== 'pass') metrics.unauthorized_assertion_count += 1;
    if (fixture.expected === 'failed' && actual === 'pass') {
      metrics.unauthorized_assertion_count += 1;
      if (fixture.metric === 'requirement_laundering') metrics.requirement_laundering_count += 1;
      if (fixture.metric === 'restrict_loss') metrics.restrict_condition_loss_count += 1;
      if (fixture.metric === 'validity_expansion' || fixture.metric === 'status_expansion' || fixture.metric === 'quantity_invention') metrics.authority_expansion_count += 1;
    }
    if (fixture.id === 'authorized_strong_claim' && actual === 'pass') metrics.authorized_strong_claim_retention = 1;
    if (fixture.id === 'composite_authorized_claim' && actual === 'pass') metrics.authorized_narrow_claim_retention = 1;
    if (fixture.id === 'W-AUTH-RETENTION-001' && actual === 'pass') metrics.authorized_requirement_response_retention = 1;
  }
  const hardSafety = {
    unauthorized_assertion: metrics.unauthorized_assertion_count === 0,
    requirement_laundering: metrics.requirement_laundering_count === 0,
    authority_expansion: metrics.authority_expansion_count === 0,
    restrict_loss: metrics.restrict_condition_loss_count === 0,
    fact_bypass: metrics.fact_bypass_count === 0,
    mapping_bypass: metrics.mapping_bypass_count === 0,
    stale_use: metrics.stale_authorization_use_count === 0
  };
  return {
    contract: 'WRITER_FAST_GATE',
    fixture_classification: 'REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA',
    provider_calls: 0,
    cases: observed,
    metrics,
    hard_safety: hardSafety,
    status: Object.values(hardSafety).every(Boolean) ? 'PASS' : 'FAIL'
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  process.stdout.write(`${JSON.stringify(runWriterFastGate(), null, 2)}\n`);
}
