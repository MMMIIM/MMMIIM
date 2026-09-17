import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runWriterFastGate } from '../rag-pilot/writer-fast-gate-v1.js';
import { sanitizeDocument, validateDocument } from '../../src/pipeline/document-generation.js';
import {
  buildWriterTask,
  guardCriticalAssertions,
  validateWriterOutput,
  writerExecutionHash
} from '../../src/pipeline/writer-execution-contract-v1.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = path.join(HERE, 'v43-gold-v2-foundation');
const CHECKPOINT_JSON = 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json';
const CHECKPOINT_MARKDOWN = 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md';
const HASH = 'a'.repeat(64);
const SAFE_PROJECT_FACT = Object.freeze({
  project_fact_id: 'PF-WRITER-FOUNDATION-BOUNDARY',
  version: 1,
  key: 'writer_source_boundary',
  role: 'requirement_constraint',
  value_status: 'known',
  value: 'Reference Context仅用于方案设计，不授权企业事实。',
  authorization_mode: 'context_only',
  authorization_reason: 'CONTEXT_AUTHORIZED',
  binding_role: 'optional',
  source_hash: HASH
});

const requirement = (id = 'REQ-WRITER-FOUNDATION-001') => ({
  requirement_id: id,
  req_id: id,
  text: '系统应提供安全、可靠且可审计的技术方案。',
  response_mode: 'REQUIREMENT_RESPONSE_ONLY',
  enterprise_capability_assertion_allowed: false,
  writer_eligible: false,
  is_mandatory: false,
  target_sections: ['chapter-writer-foundation']
});

const claim = ({ id, text, allowedScope = [], conditions = [], limitations = [], sourceHashes = [HASH], factIds = [], mappingIds = [] }) => ({
  claim_id: id,
  claim_type: 'enterprise_capability',
  claim_text: text,
  text,
  decision: 'allow',
  writer_eligible: true,
  claim_assertion_identity: HASH,
  claim_assertion_hash: HASH,
  gate_result_id: `GATE-${id}`,
  input_snapshot_hash: HASH,
  lineage_current: true,
  allowed_scope: allowedScope,
  required_conditions: conditions,
  limitations,
  source_hashes: sourceHashes,
  referenced_fact_ids: factIds,
  referenced_mapping_ids: mappingIds,
  structured_assertion: []
});

const reference = ({ id, sourceRole = 'REFERENCE_CONTEXT', enterpriseId = null, text }) => ({
  material_id: id,
  chunk_id: `${id}-CHUNK-1`,
  chunk_hash: writerExecutionHash({ id, text }),
  material_type: 'technical_whitepaper',
  source_role: sourceRole,
  enterprise_id: enterpriseId,
  source_text: text,
  authorization_mode: 'context_only'
});

const referenceContextId = material => `REFCTX-${material.material_id}`;

function referenceContextProjection(material) {
  return {
    project_fact_id: referenceContextId(material),
    version: 1,
    key: `reference_material:${material.material_id}:${material.chunk_id}`,
    role: 'reference_context',
    value_status: 'known',
    value: material.source_text,
    authorization_mode: 'context_only',
    authorization_reason: 'REFERENCE_CONTEXT_NOT_ASSERTABLE',
    binding_role: 'optional',
    source_hash: material.chunk_hash,
    source_role: material.source_role,
    reference_material_id: material.material_id,
    reference_chunk_id: material.chunk_id
  };
}

function safeContext({ claims = [], referenceMaterials = [] } = {}) {
  return {
    project_id: 'WRITER-PROVIDER-OFF-FOUNDATION',
    chapter_id: 'chapter-writer-foundation',
    authorization_snapshot_hash: HASH,
    contract_version: 'writer-safe-context-v1',
    context_items: [SAFE_PROJECT_FACT, ...referenceMaterials.map(referenceContextProjection)],
    assertable_claims: claims,
    blocked_items: [],
    pending_items: []
  };
}

const SOURCE_ROLE_FIXTURES = [
  {
    id: 'ENTERPRISE_EVIDENCE_ASSERTABLE_PASS',
    expected: 'pass',
    requirements: [requirement('REQ-SOURCE-ROLE-001')],
    claims: [claim({
      id: 'CLM-SOURCE-ROLE-001',
      text: '我司现有平台具备统一身份认证能力。',
      factIds: ['FACT-SOURCE-ROLE-001'],
      mappingIds: ['MAP-SOURCE-ROLE-001']
    })],
    authoritySources: [{ source_role: 'ENTERPRISE_EVIDENCE', fact_id: 'FACT-SOURCE-ROLE-001', mapping_id: 'MAP-SOURCE-ROLE-001' }],
    referenceMaterials: [],
    output: '我司现有平台具备统一身份认证能力。',
    usedClaimRefs: ['CLM-SOURCE-ROLE-001'],
    metricGroups: ['enterprise_evidence_assertable']
  },
  {
    id: 'REFERENCE_SOLUTION_DESIGN_PASS',
    expected: 'pass',
    requirements: [requirement('REQ-SOURCE-ROLE-002')],
    claims: [],
    referenceMaterials: [reference({ id: 'REF-DESIGN-001', text: '可采用分层架构与异步队列组织弹性处理流程。' })],
    output: '方案采用分层架构与异步队列组织弹性处理流程。',
    usedClaimRefs: [],
    metricGroups: ['reference_solution_usage']
  },
  {
    id: 'REFERENCE_TO_ENTERPRISE_ASSERTION_FAIL',
    expected: 'failed',
    requirements: [requirement('REQ-SOURCE-ROLE-003')],
    claims: [],
    referenceMaterials: [reference({ id: 'REF-DESIGN-002', text: '参考方案采用异步队列和弹性处理。' })],
    output: '我司现有平台具备异步队列和弹性处理能力。',
    usedClaimRefs: [],
    metricGroups: ['reference_to_enterprise_assertion']
  },
  {
    id: 'FOREIGN_ENTERPRISE_IDENTITY_CONTAMINATION_FAIL',
    expected: 'failed',
    requirements: [requirement('REQ-SOURCE-ROLE-004')],
    claims: [],
    referenceMaterials: [reference({ id: 'REF-FOREIGN-001', sourceRole: 'FOREIGN_ENTERPRISE_REFERENCE', enterpriseId: 'FOREIGN-ENTERPRISE-001', text: '海云科技现有产品已完成全国部署。' })],
    output: '我司现有产品已完成全国部署。',
    usedClaimRefs: [],
    metricGroups: ['foreign_enterprise_contamination', 'reference_to_enterprise_assertion']
  },
  {
    id: 'REFERENCE_STRONG_FACT_PROMOTION_FAIL',
    expected: 'failed',
    requirements: [requirement('REQ-SOURCE-ROLE-005')],
    claims: [],
    referenceMaterials: [reference({ id: 'REF-STRONG-001', text: '参考案例记载SLA 99.99%、ISO 27001认证及客户项目验收。' })],
    output: '我司现有平台SLA为99.99%，已通过ISO 27001认证并完成客户项目验收。',
    usedClaimRefs: [],
    metricGroups: ['reference_to_enterprise_assertion']
  },
  {
    id: 'MIXED_ASSERTABLE_REFERENCE_BOUNDARY',
    expected: 'failed',
    requirements: [requirement('REQ-SOURCE-ROLE-006')],
    claims: [claim({ id: 'CLM-SOURCE-ROLE-006', text: '我司现有平台具备统一身份认证能力。', allowedScope: ['当前项目'] })],
    referenceMaterials: [reference({ id: 'REF-MIXED-001', text: '参考设计采用分层架构，并描述覆盖全国全部产品。' })],
    output: '方案采用分层架构。我司现有平台具备统一身份认证能力。我司现有平台覆盖全国全部产品。',
    usedClaimRefs: ['CLM-SOURCE-ROLE-006'],
    metricGroups: ['reference_to_enterprise_assertion']
  }
];

const MUTATION_FIXTURES = [
  {
    id: 'MUTATION-QUANTITY-CONCURRENCY', dimension: 'quantity', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-QUANTITY', text: '我司现有平台支持高并发处理。' })],
    output: '我司现有平台支持不少于10万并发用户（100000个并发用户）。', usedClaimRefs: ['CLM-MUT-QUANTITY']
  },
  {
    id: 'MUTATION-ENTITY', dimension: 'entity', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-ENTITY', text: '项目经理为张伟。' })],
    output: '项目经理为李强。', usedClaimRefs: ['CLM-MUT-ENTITY']
  },
  {
    id: 'MUTATION-STATUS', dimension: 'status', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-STATUS', text: '项目处于试运行阶段。' })],
    output: '项目已完成验收。', usedClaimRefs: ['CLM-MUT-STATUS']
  },
  {
    id: 'MUTATION-SCOPE', dimension: 'scope', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-SCOPE', text: '我司现有平台在华东区域提供服务。', allowedScope: ['华东区域'] })],
    output: '我司现有平台在全国提供服务。', usedClaimRefs: ['CLM-MUT-SCOPE']
  },
  {
    id: 'MUTATION-SLA', dimension: 'SLA', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-SLA', text: '服务响应目标为4小时。' })],
    output: '服务SLA为2小时。', usedClaimRefs: ['CLM-MUT-SLA']
  },
  {
    id: 'MUTATION-CERTIFICATION', dimension: 'certification', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-CERT', text: '企业通过ISO 9001认证。' })],
    output: '企业通过ISO 27001认证。', usedClaimRefs: ['CLM-MUT-CERT']
  },
  {
    id: 'MUTATION-CUSTOMER-CASE', dimension: 'customer_case', expected: 'failed',
    claims: [claim({ id: 'CLM-MUT-CASE', text: '已服务临江市政务项目。' })],
    output: '我司已完成海云集团客户案例交付。', usedClaimRefs: ['CLM-MUT-CASE']
  },
  {
    id: 'MUTATION-UNSUPPORTED-COMMITMENT', dimension: 'unsupported_commitment', expected: 'failed',
    claims: [],
    output: '我司保证按期交付并确保第三方完成配套改造。', usedClaimRefs: []
  },
  {
    id: 'MUTATION-AUTHORIZATION-SOURCE', dimension: 'authorization_source', expected: 'failed',
    claims: [],
    referenceMaterials: [reference({ id: 'REF-MUT-AUTH', text: '参考架构描述双活容灾能力。' })],
    output: '我司现有平台具备双活容灾能力。', usedClaimRefs: []
  }
].map((fixture, index) => ({
  requirements: [requirement(`REQ-MUTATION-${String(index + 1).padStart(3, '0')}`)],
  referenceMaterials: [],
  authoritySources: [],
  ...fixture
}));

const ENGINEERING_CASES = Object.freeze([
  {
    id: 'W-AUTH-RETENTION-001',
    classification: 'ENGINEERING_REGRESSION',
    evidence: 'backend/test/writer-overnight.test.js',
    status: 'EXCLUDED_FROM_PROVIDER_OFF_SEMANTIC_EVAL',
    semantic_denominator_included: false
  },
  {
    id: 'W-IDEMPOTENCY-AUTH-001',
    classification: 'ENGINEERING_POSTGRESQL_REGRESSION',
    evidence: 'backend/integration/deterministic.integration.js',
    status: 'EXCLUDED_FROM_PROVIDER_OFF_SEMANTIC_EVAL',
    semantic_denominator_included: false
  }
]);

function frozenInputSnapshot() {
  const fixtures = [...SOURCE_ROLE_FIXTURES, ...MUTATION_FIXTURES];
  const uniqueBy = (values, key) => [...new Map(values.map(item => [item[key], item])).values()];
  const requirements = uniqueBy(fixtures.flatMap(item => item.requirements), 'requirement_id').map(item => ({
    requirement_id: item.requirement_id,
    requirement_hash: writerExecutionHash(item.text),
    response_mode: item.response_mode,
    enterprise_capability_assertion_allowed: item.enterprise_capability_assertion_allowed
  }));
  const claims = uniqueBy(fixtures.flatMap(item => item.claims), 'claim_id').map(item => ({
    claim_id: item.claim_id,
    claim_text_hash: writerExecutionHash(item.claim_text),
    gate_result_id: item.gate_result_id,
    input_snapshot_hash: item.input_snapshot_hash,
    lineage_current: item.lineage_current,
    writer_eligible: item.writer_eligible,
    referenced_fact_ids: item.referenced_fact_ids,
    referenced_mapping_ids: item.referenced_mapping_ids,
    source_hashes: item.source_hashes
  }));
  const authoritySources = fixtures.flatMap(item => item.authoritySources || []);
  const references = uniqueBy(fixtures.flatMap(item => item.referenceMaterials), 'material_id').map(item => ({
    material_id: item.material_id,
    chunk_id: item.chunk_id,
    chunk_hash: item.chunk_hash,
    source_role: item.source_role,
    enterprise_id: item.enterprise_id,
    authorization_mode: item.authorization_mode,
    source_text_hash: writerExecutionHash(item.source_text)
  }));
  return {
    fixture_classification: 'DETERMINISTIC_SYNTHETIC_EVAL_ONLY',
    requirements,
    evidence_facts: authoritySources.map(item => ({
      fact_id: item.fact_id,
      source_role: item.source_role,
      status: 'authority_approved_fixture_projection'
    })),
    mappings: authoritySources.map(item => ({
      mapping_id: item.mapping_id,
      fact_id: item.fact_id,
      status: 'approved_fixture_projection',
      claim_permission: false
    })),
    claims,
    writer_authorization: {
      contract_version: 'writer-input-authorization-v1',
      assertable_claim_ids: claims.map(item => item.claim_id)
    },
    safe_context: {
      contract_version: 'writer-safe-context-v1',
      authorization_snapshot_hash: HASH
    },
    project_fact_projections: [{
      project_fact_id: SAFE_PROJECT_FACT.project_fact_id,
      value_hash: writerExecutionHash(SAFE_PROJECT_FACT.value),
      role: SAFE_PROJECT_FACT.role,
      authorization_mode: SAFE_PROJECT_FACT.authorization_mode
    }],
    reference_materials: references,
    provider_metadata: { provider: 'NOT_CALLED', model: 'NOT_CALLED', execution: 'OFF' }
  };
}

function executeFixture(fixture) {
  const pipeline = {};
  let task;
  let output;
  let guard;
  try {
    task = buildWriterTask({
      safeContext: safeContext({ claims: fixture.claims, referenceMaterials: fixture.referenceMaterials }),
      chapterRole: 'functional_solution',
      chapterInstruction: '仅使用 Writer Safe Context 中的授权 Claim；Reference Context 仅用于方案设计。',
      requirements: fixture.requirements
    });
    pipeline.buildWriterTask = 'PASS';
    output = validateWriterOutput(task, {
      writer_task_id: task.writer_task_id,
      chapter_id: task.chapter_id,
      source_context_hash: task.safe_context_hash,
      blocks: [{
        block_id: `${fixture.id}-BLOCK-1`,
        text: fixture.output,
        used_context_refs: fixture.referenceMaterials.map(referenceContextId),
        used_claim_refs: fixture.usedClaimRefs
      }]
    }, { writerModel: 'provider-off-deterministic-fixture', promptVersion: 'writer-provider-off-foundation-v1' });
    pipeline.validateWriterOutput = 'PASS';
    guard = guardCriticalAssertions(task, output);
    pipeline.guardCriticalAssertions = guard.status === 'pass' ? 'PASS' : 'FAIL_CLOSED';
  } catch (error) {
    return {
      id: fixture.id,
      ...(fixture.dimension ? { dimension: fixture.dimension } : {}),
      expected: fixture.expected,
      actual: 'contract_failed',
      outcome: 'FAIL',
      pipeline: { ...pipeline, error_code: error?.code || 'UNEXPECTED_ERROR' },
      finding_codes: [],
      guard_findings: [],
      task_hash: task?.task_hash || null,
      output_hash: output?.output_hash || null,
      used_context_refs: [],
      reference_material_ids: fixture.referenceMaterials.map(item => item.material_id),
      source_roles: [...new Set([
        ...fixture.referenceMaterials.map(item => item.source_role),
        ...(fixture.authoritySources || []).map(item => item.source_role)
      ])],
      authority_provenance: []
    };
  }

  const sanitized = sanitizeDocument(output.blocks.map(block => block.text).join('\n'));
  pipeline.sanitizer = sanitized.removed_items.length ? 'REMOVED_UNSAFE_CONTENT' : 'PASS_NO_REMOVAL';
  const validator = validateDocument({
    text: sanitized.sanitized_text,
    requirements: fixture.requirements,
    approvedClaims: fixture.claims.map(item => ({ ...item, decision: 'approved', basis_requirement_ids: [] })),
    approvedEvidence: [],
    chapterConfig: []
  });
  pipeline.validator = validator.validation_pass ? 'PASS' : 'FAIL_CLOSED';

  const actual = guard.status;
  const outcome = actual === fixture.expected ? 'PASS' : 'FAIL';
  return {
    id: fixture.id,
    ...(fixture.dimension ? { dimension: fixture.dimension } : {}),
    expected: fixture.expected,
    actual,
    outcome,
    pipeline,
    finding_codes: [...new Set(guard.findings.map(item => item.code))].sort(),
    guard_findings: guard.findings.map(item => ({
      code: item.code,
      category: item.category,
      token_hash: item.token_hash,
      ...(item.claim_id ? { claim_id: item.claim_id } : {})
    })),
    guard_finding_count: guard.findings.length,
    critical_assertion_count: guard.critical_assertion_count,
    task_hash: task.task_hash,
    output_hash: output.output_hash,
    used_context_refs: output.blocks.flatMap(block => block.used_context_refs),
    reference_material_ids: fixture.referenceMaterials.map(item => item.material_id),
    source_roles: [...new Set([
      ...fixture.referenceMaterials.map(item => item.source_role),
      ...(fixture.authoritySources || []).map(item => item.source_role)
    ])],
    authority_provenance: fixture.claims.map(item => ({
      claim_id: item.claim_id,
      gate_result_id: item.gate_result_id,
      input_snapshot_hash: item.input_snapshot_hash,
      lineage_current: item.lineage_current,
      referenced_fact_ids: item.referenced_fact_ids,
      referenced_mapping_ids: item.referenced_mapping_ids,
      source_hashes: item.source_hashes
    })),
    sanitizer_removed_count: sanitized.removed_items.length,
    validator_status: validator.validation_status
  };
}

function ratio(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : 0;
}

function sourceBoundaryResult(rows) {
  return Object.fromEntries(rows.map(row => [row.id, row.actual === 'pass' ? 'PASS' : row.actual === 'failed' ? 'FAIL_CLOSED' : 'PIPELINE_ERROR']));
}

function markdown(checkpoint) {
  const sourceRows = checkpoint.semantic_cases.filter(row => row.case_class === 'SOURCE_ROLE');
  const mutationRows = checkpoint.semantic_cases.filter(row => row.case_class === 'MUTATION');
  return [
    '# V43 Writer Eval Provider-Off Foundation Checkpoint',
    '',
    `- STATUS: ${checkpoint.status}`,
    `- FIXTURE_CLASSIFICATION: ${checkpoint.fixture_classification}`,
    `- PROVIDER_EXECUTION: ${checkpoint.provider_execution}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- DB_WRITES: ${checkpoint.db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- SEMANTIC_DENOMINATOR: ${checkpoint.metrics.semantic_denominator}`,
    `- SOURCE_ROLE_DENOMINATOR: ${checkpoint.metrics.source_role_denominator}`,
    `- MUTATION_DENOMINATOR: ${checkpoint.metrics.mutation_denominator}`,
    `- ENGINEERING_DENOMINATOR: ${checkpoint.metrics.engineering_denominator}`,
    `- SOURCE_ROLE_BOUNDARY_EVAL: ${checkpoint.metrics.SOURCE_ROLE_BOUNDARY_EVAL}`,
    `- REFERENCE_SOLUTION_USAGE_PASS: ${checkpoint.metrics.REFERENCE_SOLUTION_USAGE_PASS}`,
    `- REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE: ${checkpoint.metrics.REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE}`,
    `- FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE: ${checkpoint.metrics.FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE}`,
    '',
    '## Source Role boundary cases',
    '',
    '| Case | Expected | Actual | Outcome | Existing guard findings |',
    '| --- | --- | --- | --- | --- |',
    ...sourceRows.map(row => `| ${row.id} | ${row.expected} | ${row.actual} | ${row.outcome} | ${row.finding_codes.join(', ') || 'none'} |`),
    '',
    '## Mutation sensitivity',
    '',
    '| Dimension | Case | Expected | Actual | Outcome | Existing guard findings |',
    '| --- | --- | --- | --- | --- | --- |',
    ...mutationRows.map(row => `| ${row.dimension} | ${row.id} | ${row.expected} | ${row.actual} | ${row.outcome} | ${row.finding_codes.join(', ') || 'none'} |`),
    '',
    '## Engineering regressions (excluded from semantic denominator)',
    '',
    ...checkpoint.engineering_cases.map(row => `- ${row.id}: ${row.status}; evidence=${row.evidence}`),
    '',
    'Reference Context is an owning-service projection and remains context-only. It may enrich solution design, but it is never converted into an assertable enterprise Claim by this Eval.',
    '',
    'This deterministic checkpoint establishes only WRITER_EVAL_PROVIDER_OFF_FOUNDATION=READY/PASS. It does not establish Provider Fidelity or Production Ready.'
  ].join('\n') + '\n';
}

function writeArtifacts(outputDir, checkpoint) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, CHECKPOINT_JSON), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, CHECKPOINT_MARKDOWN), markdown(checkpoint), 'utf8');
}

export function runWriterProviderOffFoundation({ outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const fastGate = runWriterFastGate();
  const sourceRoleRows = SOURCE_ROLE_FIXTURES.map(executeFixture).map(row => ({ ...row, case_class: 'SOURCE_ROLE' }));
  const mutationRows = MUTATION_FIXTURES.map(executeFixture).map(row => ({ ...row, case_class: 'MUTATION' }));
  const semanticCases = [...sourceRoleRows, ...mutationRows];
  const referenceSolutionCases = SOURCE_ROLE_FIXTURES
    .map((fixture, index) => ({ fixture, row: sourceRoleRows[index] }))
    .filter(item => item.fixture.metricGroups.includes('reference_solution_usage'));
  const referenceAssertionCases = SOURCE_ROLE_FIXTURES
    .map((fixture, index) => ({ fixture, row: sourceRoleRows[index] }))
    .filter(item => item.fixture.metricGroups.includes('reference_to_enterprise_assertion'));
  const foreignContaminationCases = SOURCE_ROLE_FIXTURES
    .map((fixture, index) => ({ fixture, row: sourceRoleRows[index] }))
    .filter(item => item.fixture.metricGroups.includes('foreign_enterprise_contamination'));
  const allSemanticOutcomesPass = semanticCases.every(row => row.outcome === 'PASS');
  const sourceBoundaryPass = sourceRoleRows.every(row => row.outcome === 'PASS');
  const mutationBoundaryPass = mutationRows.every(row => row.outcome === 'PASS');
  const metrics = {
    SOURCE_ROLE_BOUNDARY_EVAL: sourceBoundaryPass ? 'PASS' : 'FAIL',
    REFERENCE_SOLUTION_USAGE_PASS: referenceSolutionCases.length > 0 && referenceSolutionCases.every(item => item.row.actual === 'pass') ? 'PASS' : 'FAIL',
    REFERENCE_SOLUTION_USAGE_RATE: ratio(referenceSolutionCases, item => item.row.actual === 'pass'),
    REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE: ratio(referenceAssertionCases, item => item.row.actual === 'failed'),
    FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE: ratio(foreignContaminationCases, item => item.row.actual === 'failed'),
    MUTATION_FAIL_CLOSED_RATE: ratio(mutationRows, row => row.actual === 'failed'),
    semantic_denominator: semanticCases.length,
    semantic_pass_count: semanticCases.filter(row => row.outcome === 'PASS').length,
    source_role_denominator: sourceRoleRows.length,
    mutation_denominator: mutationRows.length,
    engineering_denominator: ENGINEERING_CASES.length,
    engineering_cases_in_semantic_denominator: 0,
    WRITER_FAST_GATE: fastGate.status
  };
  const status = allSemanticOutcomesPass && sourceBoundaryPass && mutationBoundaryPass && fastGate.status === 'PASS'
    ? 'READY/PASS'
    : 'NOT_READY';
  const inputSnapshot = frozenInputSnapshot();
  const checkpoint = {
    checkpoint: 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT',
    status,
    fixture_classification: 'DETERMINISTIC_SYNTHETIC_EVAL_ONLY',
    provider_execution: 'OFF',
    frozen_input_snapshot: inputSnapshot,
    frozen_input_snapshot_hash: writerExecutionHash(inputSnapshot),
    semantic_cases: semanticCases,
    engineering_cases: ENGINEERING_CASES,
    source_role_boundary: sourceBoundaryResult(sourceRoleRows),
    metrics,
    fast_gate: {
      contract: fastGate.contract,
      status: fastGate.status,
      provider_calls: fastGate.provider_calls,
      hard_safety: fastGate.hard_safety
    },
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    provider_fidelity_established: false,
    production_ready_established: false
  };
  writeArtifacts(outputDir, checkpoint);
  return {
    semanticCases,
    engineeringCases: ENGINEERING_CASES.map(row => ({ ...row })),
    sourceRoleBoundary: sourceBoundaryResult(sourceRoleRows),
    mutationCases: mutationRows,
    metrics,
    provider_calls: 0,
    db_writes: 0,
    status
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runWriterProviderOffFoundation();
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    semantic_denominator: result.metrics.semantic_denominator,
    engineering_denominator: result.metrics.engineering_denominator,
    source_role_boundary: result.sourceRoleBoundary,
    mutation_fail_closed_rate: result.metrics.MUTATION_FAIL_CLOSED_RATE,
    provider_calls: result.provider_calls,
    db_writes: result.db_writes
  }, null, 2)}\n`);
}
