import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import {
  REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION,
  createRequirementEvidenceMapping,
  MAPPING_DIMENSIONS
} from '../src/pipeline/requirement-evidence-mapping-contract-v1.js';
import { MappingCandidateBuilder } from '../src/pipeline/mapping-candidate-builder.js';
import {
  SemanticGatewayMappingEvaluator,
  projectMappingResult,
  MAPPING_SEMANTIC_EVALUATOR_IDENTITY
} from '../src/pipeline/semantic-gateway-mapping-evaluator.js';
import {
  applyMappingDecisionPolicy,
  projectMappingTransportResult
} from '../src/pipeline/mapping-decision-policy-v1.js';
import { validateTaskData, getSemanticTaskContract } from '../../packages/semantic-contracts/index.js';
import { createSemanticTaskRouter } from '../../services/semantic-gateway/src/task-router.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';

const context = (overrides = {}) => ({
  project_id: '11111111-1111-4111-8111-111111111111',
  requirement_db_id: '22222222-2222-4222-8222-222222222222',
  requirement_id: 'REQ-001',
  requirement_hash: 'a'.repeat(64),
  requirement_contract_version: 'canonical-requirement-v1',
  text: 'requirement',
  requirement_valid: true,
  fact_id: 'EFACT-001',
  fact_payload_hash: 'b'.repeat(64),
  fact_contract_version: 'evidence-fact-v1',
  fact_review_status: 'approved',
  upstream_support_level: 'unknown',
  fact_current: true,
  source_lineage_verified: true,
  evidence_review_id: 'REVIEW-001',
  source_span_id: 'SPAN-001',
  material_id: '33333333-3333-4333-8333-333333333333',
  ...overrides
});

const transportResult = (overrides = {}) => ({
  fact_ref: 'EFACT-001',
  decision: 'direct_full',
  dimensions: {
    subject: 'match', scope: 'match', status: 'not_applicable', quantity: 'match',
    entity: 'match', validity: 'not_applicable'
  },
  ...overrides
});

test('mapping transport contract is registered with six explicit dimensions and N/A', () => {
  const contract = getSemanticTaskContract('requirement_evidence_mapping');
  assert.equal(contract.contract_version, '4.3-requirement-evidence-mapping-v1');
  assert.deepEqual(contract.data_allowed, ['results']);
  assert.doesNotThrow(() => validateTaskData('requirement_evidence_mapping', { results: [transportResult()] }));
  assert.throws(() => validateTaskData('requirement_evidence_mapping', {
    results: [transportResult({ dimensions: { ...transportResult().dimensions, scope: 'mismatch' } })]
  }), error => error.code === 'MAPPING_SEMANTIC_INCONSISTENT');
});

test('mapping task routes through the shared strict structured-output gateway contract', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: { invoke: async value => { invocation = value; return { data: { results: [transportResult()] } }; } }
  });
  const data = await router.dispatch({ taskType: 'requirement_evidence_mapping', payload: { facts: [] } });
  assert.equal(invocation.response_format.type, 'json_schema');
  assert.equal(invocation.response_format.json_schema.strict, true);
  assert.deepEqual(data.data.results[0].dimensions, transportResult().dimensions);
});

test('mapping candidate builder filters to approved current facts and deterministic order', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64), requirement_valid: true, project_id: 'p' },
      reviews: [{ review_id: 'R1', requirement_id: 'RDB-001', requirement_text_hash: 'a'.repeat(64), review_status: 'approved' }],
      facts: [
        { ...context({ project_id: 'p', fact_id: 'F2', evidence_review_id: 'R1', fact_current: true }) },
        { ...context({ project_id: 'p', fact_id: 'F3', evidence_review_id: 'R1', fact_review_status: 'draft', fact_current: true }) },
        { ...context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1', fact_current: true }) },
        { ...context({ project_id: 'p', fact_id: 'F4', evidence_review_id: 'R1', fact_review_status: 'approved', fact_current: false }) }
      ]
    })
  };
  const result = await new MappingCandidateBuilder({ repository }).build({ projectId: 'p', requirementId: 'REQ-001' });
  assert.deepEqual(result.facts.map(fact => fact.fact_id), ['F1', 'F2']);
});

test('mapping candidate builder keeps the strictest upstream support ceiling across Facts', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64), requirement_valid: true, project_id: 'p', text: 'r' },
      reviews: [{ review_id: 'R1', requirement_id: 'RDB-001', requirement_text_hash: 'a'.repeat(64), review_status: 'approved' }],
      facts: [
        context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1', upstream_support_level: 'full_support' }),
        context({ project_id: 'p', fact_id: 'F2', evidence_review_id: 'R1', upstream_support_level: 'partial_support' })
      ]
    })
  };
  const result = await new MappingCandidateBuilder({ repository }).build({ projectId: 'p', requirementId: 'REQ-001' });
  assert.equal(result.upstream_support_level, 'partial_support');
});

test('mapping candidate builder fails closed when upstream support boundary is missing', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64), requirement_valid: true, project_id: 'p', text: 'requirement' },
      reviews: [{ review_id: 'R1', requirement_id: 'RDB-001', requirement_text_hash: 'a'.repeat(64), review_status: 'approved' }],
      facts: [context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1', upstream_support_level: null })]
    })
  };
  await assert.rejects(
    () => new MappingCandidateBuilder({ repository }).build({ projectId: 'p', requirementId: 'REQ-001' }),
    error => error.code === 'MAPPING_UPSTREAM_SUPPORT_REQUIRED'
  );
});

test('mapping candidate builder excludes an approved Review whose Requirement hash is stale', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64), requirement_valid: true, project_id: 'p', text: 'current requirement' },
      reviews: [{ review_id: 'R1', requirement_id: 'RDB-001', review_status: 'approved', requirement_text_hash: 'c'.repeat(64) }],
      facts: [context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1' })]
    })
  };
  const result = await new MappingCandidateBuilder({ repository }).build({ projectId: 'p', requirementId: 'REQ-001' });
  assert.deepEqual(result.facts, []);
});

test('mapping candidate builder excludes Facts without explicit currentness or source-lineage proof', async () => {
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64), requirement_valid: true, project_id: 'p', text: 'requirement' },
      reviews: [{ review_id: 'R1', requirement_id: 'RDB-001', requirement_text_hash: 'a'.repeat(64), review_status: 'approved' }],
      facts: [context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1', fact_current: undefined, source_lineage_verified: undefined })]
    })
  };
  const result = await new MappingCandidateBuilder({ repository }).build({ projectId: 'p', requirementId: 'REQ-001' });
  assert.deepEqual(result.facts, []);
});

test('mapping candidate builder fails closed when Review lineage is unavailable or unowned', async () => {
  const baseRequirement = {
    requirement_db_id: 'RDB-001', requirement_id: 'REQ-001', requirement_hash: 'a'.repeat(64),
    requirement_valid: true, project_id: 'p', text: 'requirement'
  };
  const fact = context({ project_id: 'p', fact_id: 'F1', evidence_review_id: 'R1', fact_current: true });
  const missingReviews = new MappingCandidateBuilder({ repository: {
    getMappingCandidateContext: async () => ({ requirement: baseRequirement, facts: [fact] })
  } });
  await assert.rejects(
    () => missingReviews.build({ projectId: 'p', requirementId: 'REQ-001' }),
    error => error.code === 'MAPPING_REVIEW_LINEAGE_REQUIRED'
  );
  const unownedReview = new MappingCandidateBuilder({ repository: {
    getMappingCandidateContext: async () => ({ requirement: baseRequirement, reviews: [{ review_id: 'R1', review_status: 'approved' }], facts: [fact] })
  } });
  const result = await unownedReview.build({ projectId: 'p', requirementId: 'REQ-001' });
  assert.equal(result.facts.length, 0);
});

test('mapping evaluator preserves all facts across six-item batches and rejects duplicate/missing refs', async () => {
  const calls = [];
  const client = { run: async request => { calls.push(JSON.parse(request.task_payload_json)); return { envelope: { data: { results: request.results || [] } } }; } };
  const facts = Array.from({ length: 7 }, (_, index) => context({ fact_id: `F${index + 1}` }));
  const evaluator = new SemanticGatewayMappingEvaluator({ client, batchSize: 6 });
  client.run = async ({ task_payload_json }) => {
    const payload = JSON.parse(task_payload_json);
    calls.push(payload);
    return { envelope: { data: { results: payload.facts.map(fact => transportResult({ fact_ref: fact.fact_ref })) } } };
  };
  const result = await evaluator.evaluate({ requirement: { requirement_id: 'REQ-001', text: 'r', requirement_hash: 'c'.repeat(64) }, facts });
  assert.equal(calls.length, 2);
  assert.deepEqual(result.map(item => item.evidence_fact_id), facts.map(fact => fact.fact_id));
  const duplicateClient = { run: async () => ({ envelope: { data: { results: [transportResult(), transportResult()] } } }) };
  await assert.rejects(() => new SemanticGatewayMappingEvaluator({ client: duplicateClient }).evaluate({ requirement: { requirement_id: 'REQ-001', text: 'r', requirement_hash: 'c'.repeat(64) }, facts: [context()] }), error => error.code === 'MAPPING_RESULT_SET_INVALID');
});

test('mapping projection and policy preserve upstream ceiling and high-risk full support exception', () => {
  const projected = projectMappingTransportResult(transportResult(), context());
  assert.equal(projected.semantic_relationship, 'direct');
  assert.equal(projected.support_level, 'full_support');
  const capped = applyMappingDecisionPolicy(projected, { upstream_support_level: 'partial_support' });
  assert.notEqual(capped.support_level, 'full_support');
  const highRisk = applyMappingDecisionPolicy(projected, { requirement: { text: 'SLA availability within 1 hour' } });
  assert.equal(highRisk.review_status, 'proposed');
});

test('mapping evaluator identity binds task, instruction, transport, canonical and policy versions', () => {
  const evaluator = new SemanticGatewayMappingEvaluator({ client: { run: async () => ({}) } });
  assert.equal(evaluator.version, MAPPING_SEMANTIC_EVALUATOR_IDENTITY);
  assert.match(evaluator.version, /^mapping-semantic-evaluator-v1:[0-9a-f]{64}$/);
});

test('backend deterministic overrides retain explicit status, validity and entity mismatches', () => {
  const projected = projectMappingTransportResult(transportResult(), context());
  const value = applyMappingDecisionPolicy(projected, {
    requirement: {
      text: 'requirement', status: 'completed', validity: { status: 'known' },
      entities: [{ type: 'system', name: 'A' }]
    }
  });
  const overridden = projectMappingTransportResult(transportResult(), context());
  const withMismatch = applyMappingDecisionPolicy(
    { ...overridden, dimensions: { ...overridden.dimensions, status_match: 'mismatch', validity_match: 'mismatch', entity_match: 'mismatch' } },
    { requirement: { text: 'requirement' } }
  );
  assert.equal(value.semantic_relationship, 'direct');
  assert.equal(withMismatch.support_level, 'partial_support');
  assert.ok(withMismatch.reason_codes.includes('HUMAN_REVIEW_REQUIRED'));
});

test('known applicable quantity cannot be marked not_applicable by the semantic worker', async () => {
  const client = { run: async () => ({ envelope: { data: { results: [{
    ...transportResult(), dimensions: { ...transportResult().dimensions, quantity: 'not_applicable' }
  }] } } }) };
  await assert.rejects(
    () => new SemanticGatewayMappingEvaluator({ client }).evaluate({
      requirement: { requirement_id: 'REQ-001', text: '4 accounts', requirement_hash: 'c'.repeat(64), quantities: [{ metric: 'accounts', value: '4', unit: 'account' }] },
      facts: [context()]
    }),
    error => error.code === 'MAPPING_SEMANTIC_INCONSISTENT'
  );
});

test('mapping service exposes requirement-level producer and preserves human mappings on atomic replacement', async () => {
  const events = [];
  const repository = {
    getMappingCandidateContext: async () => ({ requirement: { requirement_id: 'REQ-001', requirement_db_id: context().requirement_db_id, requirement_hash: context().requirement_hash, requirement_valid: true, project_id: context().project_id, text: 'requirement' }, reviews: [{ review_id: 'REVIEW-001', review_status: 'approved', requirement_id: context().requirement_db_id, requirement_text_hash: context().requirement_hash }], facts: [context()] }),
    listRequirementEvidenceFactMappings: async () => [{ mapping_id: 'H1', requirement_identifier: 'REQ-001', reviewer_type: 'human', evidence_fact_id: 'EFACT-H' }],
    replaceRequirementEvidenceFactMappingSetAtomic: async value => { events.push(value); return value.mappings; }
  };
  const evaluator = { version: 'mapping-worker-v1', evaluate: async () => [projectMappingTransportResult(transportResult(), context())] };
  const service = new RequirementEvidenceFactMappingService({ repository, evaluator });
  const result = await service.produceForRequirement({ projectId: context().project_id, requirementId: 'REQ-001' });
  assert.equal(result.mappings.length, 2);
  assert.deepEqual(events[0].preserve_mapping_ids, ['H1']);
  assert.equal(events[0].mappings[0].contract_version, REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION);
});

test('legacy single-pair propose remains compatible with the shared Mapping evaluator', async () => {
  const repository = {
    getRequirementEvidenceFactMappingContext: async () => context({ requirement_valid: true, upstream_support_level: 'full_support' }),
    replaceRequirementEvidenceFactMappingAtomic: async value => value
  };
  const client = {
    run: async request => {
      const payload = JSON.parse(request.task_payload_json);
      return { envelope: { data: { results: [transportResult({ fact_ref: payload.facts[0].fact_ref })] } } };
    }
  };
  const service = new RequirementEvidenceFactMappingService({
    repository,
    evaluator: new SemanticGatewayMappingEvaluator({ client })
  });
  const mapping = await service.propose({ projectId: context().project_id, requirementId: context().requirement_id, factId: context().fact_id });
  assert.equal(mapping.evidence_fact_id, context().fact_id);
  assert.equal(mapping.semantic_relationship, 'direct');
});

test('mapping producer skips an unchanged complete machine set without semantic evaluation', async () => {
  let evaluateCalls = 0;
  const repository = {
    getMappingCandidateContext: async () => ({
      requirement: {
        requirement_id: 'REQ-001', requirement_db_id: context().requirement_db_id,
        requirement_hash: context().requirement_hash, requirement_valid: true,
        project_id: context().project_id, text: 'requirement'
      },
      reviews: [{ review_id: 'REVIEW-001', review_status: 'approved', requirement_id: context().requirement_db_id, requirement_text_hash: context().requirement_hash }],
      facts: [context()]
    }),
    listRequirementEvidenceFactMappings: async () => [{
      mapping_id: 'M1', requirement_identifier: 'REQ-001', reviewer_type: 'machine',
      review_status: 'approved', mapping_current: true,
      contract_version: REQUIREMENT_EVIDENCE_MAPPING_CONTRACT_VERSION,
      evaluator_version: 'mapping-worker-v1', evidence_fact_id: 'EFACT-001'
    }],
    replaceRequirementEvidenceFactMappingSetAtomic: async () => {
      throw new Error('idempotent set must not persist');
    }
  };
  const service = new RequirementEvidenceFactMappingService({
    repository,
    evaluator: { version: 'mapping-worker-v1', evaluate: async () => { evaluateCalls += 1; return []; } }
  });
  const result = await service.produceForRequirement({ projectId: context().project_id, requirementId: 'REQ-001' });
  assert.equal(result.status, 'IDEMPOTENT_REPLAY');
  assert.equal(evaluateCalls, 0);
});

test('production Mapping producer route delegates through the owning service boundary', async () => {
  const calls = [];
  const app = createApp({
    repository: {},
    requirementEvidenceFactMappingService: {
      produceForRequirement: async input => { calls.push(input); return { status: 'PRODUCED', mappings: [] }; }
    },
    projectAuthorizationService: { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) },
    actorResolver: () => ({ actor_id: 'trusted-test', actor_type: 'test', source: 'test' })
  });
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/project-1/requirements/REQ-001/requirement-evidence-fact-mappings/produce`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true, data: { status: 'PRODUCED', mappings: [] } });
    assert.deepEqual(calls, [{ projectId: 'project-1', requirementId: 'REQ-001' }]);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('canonical mapping dimensions remain stable and source authority is backend-owned', () => {
  assert.deepEqual(MAPPING_DIMENSIONS, ['subject_match', 'scope_match', 'status_match', 'quantitative_match', 'entity_match', 'validity_match', 'support_sufficiency']);
  const value = createRequirementEvidenceMapping(context(), {
    semantic_relationship: 'partial', support_level: 'partial_support',
    dimensions: Object.fromEntries(MAPPING_DIMENSIONS.map(name => [name, 'unknown'])), reason_codes: []
  });
  assert.equal(value.reviewer_type, 'machine');
  assert.equal(value.claim_permission, undefined);
});
