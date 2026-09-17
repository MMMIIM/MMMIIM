import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import {
  buildEvidenceFactExtractionPayload,
  buildEvidenceFactAuthorizationContext,
  SemanticGatewayEvidenceFactExtractor
} from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { createEvidenceFactContract } from '../src/pipeline/evidence-fact-contract-v1.js';
import { parseSemanticGatewayConfig } from '../src/pipeline/semantic-gateway-client.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const REVIEW = 'EREVIEW-FACT-1';
const SOURCE = '产品：数据交换平台。支持 50 并发用户。';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const context = {
  review_id: REVIEW,
  project_id: PROJECT,
  source_span_id: 'ESPAN-FACT-1',
  material_id: '22222222-2222-4222-8222-222222222222',
  anchor_chunk_id: 'MCH-FACT-1',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH,
  current_source_text_hash: SOURCE_HASH,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable',
  support_level: 'full_support',
  material_type: 'project_case'
};
const authorization = { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) };
const input = { projectId: PROJECT, reviewId: REVIEW, actor: { actor_id: 'fact-tester', actor_type: 'test' } };

const validCandidate = {
  subject_type: 'product',
  subject_name: '数据交换平台',
  entities: [],
  status: 'unknown',
  status_source_text: null,
  scopes: [],
  quantities: [{ metric: 'concurrency', value: '50', unit: 'user', source_text: '支持 50 并发用户。' }],
  validity: { status: 'unknown', valid_from: null, valid_until: null },
  domain_metadata: {}
};

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const hashJson = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

test('evidence_fact_extraction is registered with a strict canonical data schema', () => {
  const contract = getSemanticTaskContract('evidence_fact_extraction');
  assert.ok(contract);
  assert.equal(contract.contract_version, '4.3-evidence-fact-extraction-v1');
  assert.deepEqual(contract.data_schema.required, ['facts']);
  assert.equal(contract.data_schema.additionalProperties, false);
  assert.equal(contract.data_schema.properties.facts.items.additionalProperties, false);
});

test('evidence_fact_extraction validates the flat semantic Fact candidate shape', () => {
  const result = validateTaskData('evidence_fact_extraction', { facts: [validCandidate] }, {
    source_text: SOURCE
  });
  assert.deepEqual(result, { facts: [validCandidate] });
});

test('Fact instruction explicitly states strict nested shapes and dependent evidence fields', () => {
  const instruction = getSemanticTaskInstructionMetadata('evidence_fact_extraction').instruction;
  assert.match(instruction, /entities.*对象/);
  assert.match(instruction, /不得.*entity_type/);
  assert.match(instruction, /valid_until/);
  assert.match(instruction, /不得.*valid_to/);
  assert.match(instruction, /subject_type.*subject_name.*平面/);
  assert.match(instruction, /status.*unknown.*非空 status_source_text/);
  assert.match(instruction, /scopes.*仅含 value/);
  assert.match(instruction, /不得.*scope_source_texts/);
});

test('Fact instruction explicitly suppresses undeclared relation decorations', () => {
  const instruction = getSemanticTaskInstructionMetadata('evidence_fact_extraction').instruction;
  assert.match(instruction, /predicate|relation|triple|谓词|关系|三元组/);
  assert.match(instruction, /未在 Schema 中声明|声明字段/);
});

test('approved Review with valid empty semantic output completes without persistence', async () => {
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      invalidateEvidenceCandidateReview: async () => {},
      upsertEvidenceSourceFactsAtomic: async () => assert.fail('empty output must not persist')
    },
    projectAuthorizationService: authorization,
    extractor: { version: 'semantic-test-v1', extract: async () => [] }
  });
  const result = await service.extract(input);
  assert.deepEqual(result.facts, []);
});

test('semantic extraction transport failure is reported as FACT failure', async () => {
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => context, invalidateEvidenceCandidateReview: async () => {} },
    projectAuthorizationService: authorization,
    extractor: {
      version: 'semantic-test-v1',
      extract: async () => { throw Object.assign(new Error('gateway unavailable'), { code: 'GATEWAY_TIMEOUT' }); }
    }
  });
  await assert.rejects(
    () => service.extract(input),
    error => error.code === 'FACT_SEMANTIC_EXTRACTION_FAILED'
  );
});

test('Fact semantic input contains only source-relative semantic content', () => {
  const payload = buildEvidenceFactExtractionPayload({ ...context, actor: { actor_id: 'must-not-leak' }, unrelated: 'must-not-leak' });
  assert.deepEqual(Object.keys(payload), ['source_text', 'material']);
  assert.equal(payload.source_text, SOURCE);
  assert.deepEqual(payload.material, { material_type: 'project_case' });
  for (const field of ['review_id', 'review_status', 'evidence_capability', 'support_level', 'project_id', 'material_id', 'source_span_id', 'source_text_hash', 'actor', 'unrelated']) {
    assert.equal(Object.hasOwn(payload, field), false, field);
  }
  assert.throws(
    () => buildEvidenceFactExtractionPayload({ ...context, review_status: 'proposed' }),
    error => error.code === 'FACT_SEMANTIC_INPUT_INVALID'
  );
});

test('Fact semantic input is invariant across authorized Review metadata', () => {
  const full = buildEvidenceFactExtractionPayload({ ...context, review_id: 'EREVIEW-FACT-A', support_level: 'full_support' });
  const partial = buildEvidenceFactExtractionPayload({ ...context, review_id: 'EREVIEW-FACT-B', support_level: 'partial_support' });
  assert.deepEqual(partial, full);
  assert.equal(JSON.stringify(partial), JSON.stringify(full));
});

test('authorization/context hash may vary while model semantic input hash remains stable', () => {
  const contextA = { ...context, review_id: 'EREVIEW-FACT-A', support_level: 'full_support' };
  const contextB = { ...context, review_id: 'EREVIEW-FACT-B', support_level: 'partial_support' };
  assert.notEqual(hashJson(buildEvidenceFactAuthorizationContext(contextA)), hashJson(buildEvidenceFactAuthorizationContext(contextB)));
  assert.equal(hashJson(buildEvidenceFactExtractionPayload(contextA)), hashJson(buildEvidenceFactExtractionPayload(contextB)));
});

test('Fact authorization remains fail-closed before semantic projection', async () => {
  for (const [label, review] of [
    ['unapproved', { ...context, review_status: 'proposed' }],
    ['reference-only', { ...context, evidence_capability: 'reference_only' }]
  ]) {
    let extractorCalls = 0;
    const service = new EvidenceSourceFactService({
      repository: {
        getEvidenceReviewForFact: async () => review,
        invalidateEvidenceCandidateReview: async () => {},
        upsertEvidenceSourceFactsAtomic: async () => assert.fail(`${label} must not persist`)
      },
      projectAuthorizationService: authorization,
      extractor: { extract: async () => { extractorCalls += 1; return [validCandidate]; } }
    });
    await assert.rejects(
      () => service.extract(input),
      error => ['EVIDENCE_REVIEW_NOT_APPROVED', 'EVIDENCE_FACT_REFERENCE_ONLY_FORBIDDEN'].includes(error.code),
      label
    );
    assert.equal(extractorCalls, 0, label);
  }
});

test('Fact semantic payload preserves exact source text while hashing the same representation', () => {
  const sourceText = 'GOV-02 exact source span\n';
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');
  const payload = buildEvidenceFactExtractionPayload({ ...context, source_text: sourceText, source_text_hash: sourceHash, current_source_text_hash: sourceHash });
  assert.equal(payload.source_text, sourceText);
  assert.equal(payload.material.material_type, 'project_case');
  assert.equal(Object.hasOwn(payload, 'source_span'), false);
});

test('Semantic Gateway Fact extractor dispatches the canonical task and returns validated candidates', async () => {
  let request;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run(value) {
        request = value;
        return { envelope: { data: { facts: [validCandidate] } } };
      }
    }
  });
  const facts = await extractor.extract(context);
  assert.deepEqual(facts, [{
    subject: { type: 'product', name: '数据交换平台' },
    entities: validCandidate.entities,
    status: validCandidate.status,
    status_source_text: validCandidate.status_source_text,
    scopes: validCandidate.scopes,
    quantities: [{ metric: 'concurrency', value: '50', unit: 'user' }],
    scope_source_texts: {},
    validity: validCandidate.validity,
    domain_metadata: validCandidate.domain_metadata
  }]);
  assert.equal(request.task_type, 'evidence_fact_extraction');
  const parsed = JSON.parse(request.task_payload_json);
  assert.deepEqual(Object.keys(parsed), ['source_text', 'material']);
  assert.equal(parsed.source_text, SOURCE);
  assert.deepEqual(parsed.material, { material_type: 'project_case' });
  assert.match(request.task_instruction, /approved Evidence Review/);
});

test('EvidenceSourceFactService production path sends semantic-only payload to extractor', async () => {
  let request;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run(value) {
        request = value;
        return { envelope: { data: { facts: [validCandidate] } } };
      }
    }
  });
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      upsertEvidenceSourceFactsAtomic: async facts => facts
    },
    projectAuthorizationService: authorization,
    extractor
  });
  await service.extract(input);
  const parsed = JSON.parse(request.task_payload_json);
  assert.deepEqual(Object.keys(parsed), ['source_text', 'material']);
  assert.equal(parsed.source_text, SOURCE);
  for (const field of ['review_id', 'review_status', 'evidence_capability', 'support_level', 'source_span_id', 'source_text_hash']) {
    assert.equal(Object.hasOwn(parsed, field), false, field);
  }
});

test('flat subject fields are required and reject empty or wrong types', () => {
  const cases = [
    ['subject_type missing', candidate => { delete candidate.subject_type; }],
    ['subject_name missing', candidate => { delete candidate.subject_name; }],
    ['subject_type empty', candidate => { candidate.subject_type = ''; }],
    ['subject_name empty', candidate => { candidate.subject_name = ''; }],
    ['subject_type wrong type', candidate => { candidate.subject_type = { value: 'product' }; }],
    ['subject_name wrong type', candidate => { candidate.subject_name = ['平台']; }]
  ];
  for (const [name, mutate] of cases) {
    const candidate = { ...validCandidate };
    mutate(candidate);
    assert.throws(
      () => validateTaskData('evidence_fact_extraction', { facts: [candidate] }, { source_text: SOURCE }),
      error => error instanceof Error,
      name
    );
  }
});

test('nested subject is not accepted as a compatibility input', () => {
  const nested = {
    ...validCandidate,
    subject: { type: 'product', name: '数据交换平台' }
  };
  delete nested.subject_type;
  delete nested.subject_name;
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [nested] }, { source_text: SOURCE }),
    /subject_type|unsupported|missing/
  );
});

test('Semantic Gateway Fact extractor fails closed on malformed or empty task data', async () => {
  for (const data of [{ facts: [{ ...validCandidate, unsupported: true }] }, { facts: [] }]) {
    const extractor = new SemanticGatewayEvidenceFactExtractor({ client: { run: async () => ({ envelope: { data } }) } });
    const service = new EvidenceSourceFactService({
      repository: { getEvidenceReviewForFact: async () => context, upsertEvidenceSourceFactsAtomic: async () => assert.fail('invalid output must not persist') },
      projectAuthorizationService: authorization,
      extractor
    });
    if (data.facts.length === 0) {
      const result = await service.extract(input);
      assert.deepEqual(result.facts, []);
    } else {
      await assert.rejects(() => service.extract(input), error => error.code === 'FACT_SEMANTIC_SCHEMA_INVALID');
    }
  }
});

test('Fact semantic schema diagnostics preserve safe field-level failure details', async () => {
  let receivedOptions;
  const gatewayError = Object.assign(new Error('Semantic Gateway request failed: OUTPUT_SCHEMA_INVALID.'), {
    code: 'OUTPUT_SCHEMA_INVALID',
    audit: {
      probe_diagnostics: {
        schema_validation_errors: [{
          stage: 'FACT',
          path: 'data.facts[0].entities',
          keyword: 'type',
          expected: 'array',
          actual_type: 'string',
          message: 'Semantic Fact candidate failed the canonical task schema.'
        }]
      }
    }
  });
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      run: async (_request, options) => {
        receivedOptions = options;
        throw gatewayError;
      }
    }
  });

  await assert.rejects(
    () => extractor.extract(context),
    error => {
      assert.equal(error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
      assert.equal(error.details.stage, 'FACT');
      assert.equal(error.details.cause_code, 'OUTPUT_SCHEMA_INVALID');
      assert.deepEqual(error.details.schema_validation_errors, [{
        stage: 'FACT',
        path: 'data.facts[0].entities',
        keyword: 'type',
        expected: 'array',
        actual_type: 'string',
        message: 'Semantic Fact candidate failed the canonical task schema.'
      }]);
      return true;
    }
  );
  assert.equal(receivedOptions.diagnosticMode, 'probe-v1');
});

test('FS-01 rejects a completed status without a non-empty grounded status quote', () => {
  const source = '项目已完成。';
  const sourceHash = createHash('sha256').update(source).digest('hex');
  assert.throws(
    () => createEvidenceFactContract(
      { ...context, source_text: source, source_text_hash: sourceHash, current_source_text_hash: sourceHash },
      { subject: { type: 'project', name: '项目' }, entities: [], status: 'completed', status_source_text: '', scopes: [], quantities: [], validity: { status: 'unknown' }, domain_metadata: {} },
      { extractorVersion: 'fixture-v1' }
    ),
    error => error.code === 'EVIDENCE_FACT_CONTRACT_INVALID'
  );
});

test('FS-02 requires inline scope source text and rejects the legacy map', () => {
  const source = '支持 RBAC。';
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const sourceContext = { ...context, source_text: source, source_text_hash: sourceHash, current_source_text_hash: sourceHash };
  assert.throws(
    () => createEvidenceFactContract(sourceContext, { subject: { type: 'product', name: null }, entities: [], status: 'unknown', scopes: ['RBAC'], quantities: [], validity: { status: 'unknown' }, domain_metadata: {} }, { extractorVersion: 'fixture-v1' }),
    error => error.code === 'EVIDENCE_FACT_CONTRACT_INVALID'
  );
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [{ ...validCandidate, scopes: [{ value: 'RBAC' }] }] }),
    /source_text/
  );
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [{ ...validCandidate, scope_source_texts: { RBAC: '支持 RBAC。' } }] }),
    /unsupported fields/
  );
});

test('FS-03 rejects string entities while FS-04 accepts entity objects', () => {
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [{ ...validCandidate, entities: ['数据交换平台'] }] }, { source_text: SOURCE }),
    /must be an object/
  );
  assert.doesNotThrow(() => validateTaskData('evidence_fact_extraction', {
    facts: [{ ...validCandidate, entities: [{ type: 'product', name: '数据交换平台', identifier: null }] }]
  }, { source_text: SOURCE }));
});

test('FS-05 rejects legacy valid_to while FS-06 accepts canonical valid_until', () => {
  const legacy = { ...validCandidate, validity: { status: 'known', valid_to: '2030-01-01' } };
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [legacy] }, { source_text: SOURCE }),
    /unsupported fields/
  );
  assert.doesNotThrow(() => validateTaskData('evidence_fact_extraction', {
    facts: [{ ...validCandidate, validity: { status: 'known', valid_from: null, valid_until: '2030-01-01' } }]
  }, { source_text: SOURCE }));
});

test('Fact service preserves field diagnostics from a lower-layer schema failure', async () => {
  const schemaDiagnostics = [{
    stage: 'FACT',
    path: 'data.facts[0].entities',
    keyword: 'type',
    expected: 'array',
    actual_type: 'string'
  }];
  let attempts = 0;
  const extractor = {
    async extract() {
      attempts += 1;
      throw Object.assign(new Error('Semantic Gateway request failed: OUTPUT_SCHEMA_INVALID.'), {
        code: 'OUTPUT_SCHEMA_INVALID',
        status: 422,
        details: {
          stage: 'FACT',
          boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient',
          cause_code: 'OUTPUT_SCHEMA_INVALID',
          schema_validation_errors: schemaDiagnostics
        }
      });
    }
  };
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => context },
    projectAuthorizationService: authorization,
    extractor
  });
  await assert.rejects(
    () => service.extract(input),
    error => {
      assert.equal(error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
      assert.equal(error.details.cause_code, 'OUTPUT_SCHEMA_INVALID');
      assert.deepEqual(error.details.schema_validation_errors, schemaDiagnostics);
      return true;
    }
  );
  assert.equal(attempts, 1);
});

test('Fact contract validation failures retain an explicit FACT diagnostic stage', async () => {
  const invalidCandidate = {
    ...validCandidate,
    quantities: [{ metric: 'concurrency', value: '999', unit: 'user', source_text: '支持 50 并发用户。' }]
  };
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { run: async () => ({ envelope: { data: { facts: [invalidCandidate] } } }) }
  });
  const service = new EvidenceSourceFactService({
    repository: { getEvidenceReviewForFact: async () => context, upsertEvidenceSourceFactsAtomic: async () => assert.fail('ungrounded Fact must not persist') },
    projectAuthorizationService: authorization,
    extractor
  });
  await assert.rejects(
    () => service.extract(input),
    error => error.code === 'EVIDENCE_FACT_SOURCE_UNGROUNDED' && error.details?.stage === 'FACT'
  );
});

test('Fact extraction client uses the canonical Semantic Gateway target and timeout', () => {
  const config = parseSemanticGatewayConfig({
    SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:18082',
    SEMANTIC_GATEWAY_API_KEY: 'service-key',
    SEMANTIC_GATEWAY_USER: 'fact-test',
    SEMANTIC_GATEWAY_EVIDENCE_FACT_TIMEOUT_MS: '90000',
    V43_GATEWAY_API_BASE: 'http://127.0.0.1:18080',
    V43_GATEWAY_API_KEY: 'legacy-key'
  }, { taskType: 'evidence_fact_extraction' });
  assert.equal(config.apiBase, 'http://127.0.0.1:18082');
  assert.equal(config.apiKey, 'service-key');
  assert.equal(config.configuredTaskType, 'evidence_fact_extraction');
  assert.equal(config.config_source, 'canonical_semantic_gateway');
  assert.equal(config.timeoutMs, 90000);
  assert.equal(config.taskTimeouts.evidence_fact_extraction, 90000);
});

test('approved Source Span + Review produces a draft canonical Fact with unchanged provenance', async () => {
  let persisted;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { run: async () => ({ envelope: { data: { facts: [validCandidate] } } }) }
  });
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      upsertEvidenceSourceFactsAtomic: async facts => { [persisted] = facts; return facts; }
    },
    projectAuthorizationService: authorization,
    extractor
  });
  const result = await service.extract(input);
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].review_status, 'draft');
  assert.equal(persisted.source_span_id, context.source_span_id);
  assert.equal(persisted.material_id, context.material_id);
  assert.equal(persisted.source.source_text_hash, SOURCE_HASH);
  assert.equal(persisted.extractor_type, 'machine');
});
