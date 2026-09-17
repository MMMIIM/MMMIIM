import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { buildEvidenceFactExtractionPayload } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const REVIEW = 'EREVIEW-FACT-RETRY-1';
const MATERIAL = '22222222-2222-4222-8222-222222222222';
const SOURCE = '产品：数据交换平台。支持 50 并发用户。';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const baseContext = {
  review_id: REVIEW,
  project_id: PROJECT,
  source_span_id: 'ESPAN-FACT-RETRY-1',
  material_id: MATERIAL,
  anchor_chunk_id: 'MCH-FACT-RETRY-1',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH,
  current_source_text_hash: SOURCE_HASH,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable',
  support_level: 'full_support',
  material_type: 'project_case'
};
const input = { projectId: PROJECT, reviewId: REVIEW, actor: { actor_id: 'retry-test', actor_type: 'test' } };
const candidate = {
  subject_type: 'product',
  subject_name: '数据交换平台',
  entities: [],
  status: 'unknown',
  scopes: [],
  quantities: [{ metric: 'concurrency', value: '50', unit: 'user' }],
  validity: { status: 'unknown', valid_from: null, valid_until: null },
  domain_metadata: {}
};

const authorization = { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) };

test('corrective payload is absent on first pass and carries only bounded schema feedback on retry', () => {
  const first = buildEvidenceFactExtractionPayload(baseContext);
  assert.equal(Object.hasOwn(first, 'validation_feedback'), false);
  const retry = buildEvidenceFactExtractionPayload(baseContext, {
    correctiveFeedback: {
      path: 'data.facts[0].entities',
      keyword: 'type',
      expected: 'array',
      actual_type: 'string',
      arbitrary_instruction: 'drop this'
    }
  });
  assert.deepEqual(retry.validation_feedback, {
    path: 'data.facts[0].entities',
    keyword: 'type',
    expected: 'array',
    actual_type: 'string'
  });
  assert.equal(Object.hasOwn(retry.validation_feedback, 'arbitrary_instruction'), false);
});

function schemaFailure() {
  return Object.assign(new Error('semantic schema failure'), {
    code: 'FACT_SEMANTIC_EXTRACTION_FAILED',
    details: {
      stage: 'FACT',
      boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient',
      cause_code: 'OUTPUT_SCHEMA_INVALID',
      schema_validation_errors: [{
        stage: 'FACT',
        path: 'data.facts[0].entities',
        keyword: 'type',
        expected: 'array',
        actual_type: 'string'
      }]
    }
  });
}

function makeService(sequence, { context = baseContext, onPersist = async fact => fact } = {}) {
  const calls = [];
  const extractor = {
    version: 'semantic-retry-test-v1',
    async extract(receivedContext, options) {
      calls.push({ context: receivedContext, options });
      const next = sequence[calls.length - 1];
      if (next instanceof Error) throw next;
      return next;
    }
  };
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      upsertEvidenceSourceFactsAtomic: async facts => Promise.all(facts.map(onPersist))
    },
    projectAuthorizationService: authorization,
    extractor
  });
  return { service, calls };
}

test('first-pass success records one attempt and does not retry', async () => {
  const { service, calls } = makeService([[candidate]]);
  const result = await service.extract(input);
  assert.equal(calls.length, 1);
  assert.equal(result.facts.length, 1);
  assert.deepEqual(result.provider_audit, {
    attempt_count: 1,
    retry_attempt: 0,
    retry_reason: null,
    first_pass: true,
    retry_eligible: false,
    retry_attempted: false,
    retry_success: false,
    auto_recovered: false,
    final_auto_success: true,
    human_escalation: false
  });
});

test('schema contract failure is fail-closed without a corrective retry', async () => {
  let writes = 0;
  const { service, calls } = makeService([schemaFailure(), [candidate]], {
    onPersist: async fact => { writes += 1; return fact; }
  });
  await assert.rejects(
    () => service.extract(input),
    error => {
      assert.equal(error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
      assert.equal(error.details.cause_code, 'OUTPUT_SCHEMA_INVALID');
      assert.deepEqual(error.details.schema_validation_errors, [{
        stage: 'FACT',
        path: 'data.facts[0].entities',
        keyword: 'type',
        expected: 'array',
        actual_type: 'string'
      }]);
      return true;
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(writes, 0);
});

test('schema contract failure never consumes a second attempt', async () => {
  let writes = 0;
  const { service, calls } = makeService([schemaFailure(), schemaFailure()], {
    onPersist: async fact => { writes += 1; return fact; }
  });
  await assert.rejects(
    () => service.extract(input),
    error => {
      assert.equal(error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
      assert.equal(error.details.cause_code, 'OUTPUT_SCHEMA_INVALID');
      return true;
    }
  );
  assert.equal(calls.length, 1);
  assert.equal(writes, 0);
});

test('authorization failure never invokes corrective retry', async () => {
  let calls = 0;
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => baseContext },
    projectAuthorizationService: {
      assertProjectAccess: async () => { throw Object.assign(new Error('denied'), { code: 'PROJECT_ACCESS_DENIED' }); }
    },
    extractor: { async extract() { calls += 1; return [candidate]; } }
  });
  await assert.rejects(() => service.extract(input), error => error.code === 'PROJECT_ACCESS_DENIED');
  assert.equal(calls, 0);
});

test('transport failure is non-retryable', async () => {
  const { service, calls } = makeService([
    Object.assign(new Error('gateway unavailable'), { code: 'GATEWAY_NETWORK_ERROR' })
  ]);
  await assert.rejects(() => service.extract(input), error => error.code === 'FACT_SEMANTIC_EXTRACTION_FAILED');
  assert.equal(calls.length, 1);
});

test('empty semantic result retries only when context explicitly expects a Fact', async () => {
  const { service, calls } = makeService([[], [candidate]], {
    context: { ...baseContext, fact_extraction_expected: true }
  });
  const result = await service.extract(input);
  assert.equal(calls.length, 2);
  assert.equal(result.facts.length, 1);
  assert.equal(result.provider_audit.auto_recovered, true);
});

test('valid empty semantic result without expectation remains non-retryable', async () => {
  const { service, calls } = makeService([[]]);
  await assert.rejects(() => service.extract(input), error => error.code === 'FACT_SEMANTIC_EMPTY');
  assert.equal(calls.length, 1);
});

test('persistence failure does not invoke corrective retry', async () => {
  const { service, calls } = makeService([[candidate]], {
    onPersist: async () => { throw Object.assign(new Error('db unavailable'), { code: 'DB_FAILURE' }); }
  });
  await assert.rejects(() => service.extract(input), error => error.code === 'DB_FAILURE');
  assert.equal(calls.length, 1);
});
