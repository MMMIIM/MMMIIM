import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateTaskData } from '../../packages/semantic-contracts/index.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { createEvidenceFactContract } from '../src/pipeline/evidence-fact-contract-v1.js';
import { SemanticGatewayEvidenceFactExtractor } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';

const SOURCE = '产品：数据交换平台。支持 50 并发用户。';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const context = {
  review_id: 'EREVIEW-DOMAIN-METADATA-1',
  project_id: '11111111-1111-4111-8111-111111111111',
  source_span_id: 'ESPAN-DOMAIN-METADATA-1',
  material_id: '22222222-2222-4222-8222-222222222222',
  anchor_chunk_id: 'MCH-DOMAIN-METADATA-1',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH,
  current_source_text_hash: SOURCE_HASH
};

const candidate = domain_metadata => ({
  subject_type: 'product',
  subject_name: '数据交换平台',
  entities: [],
  status: 'unknown',
  scopes: [],
  quantities: [{ metric: 'concurrency', value: '50', unit: 'user', source_text: '支持 50 并发用户。' }],
  validity: { status: 'unknown', valid_from: null, valid_until: null },
  domain_metadata
});

const canonicalCandidate = ({ subject_type, subject_name, ...rest }) => ({
  ...rest,
  subject: { type: subject_type, name: subject_name }
});

test('Semantic domain_metadata rejects values the Canonical Fact contract rejects', () => {
  for (const domain_metadata of [
    { capability: 'RBAC' },
    { Capability: { value: 'RBAC' } },
    { 'capability-name': { value: 'RBAC' } },
    { capability: [] }
  ]) {
    const value = candidate(domain_metadata);
    assert.throws(
      () => validateTaskData('evidence_fact_extraction', { facts: [value] }, { source_text: SOURCE }),
      /domain_metadata/
    );
    assert.throws(
      () => createEvidenceFactContract(context, canonicalCandidate(value), { extractorVersion: 'domain-metadata-test-v1' }),
      error => error.code === 'EVIDENCE_FACT_DOMAIN_METADATA_INVALID'
    );
  }
});

test('Semantic domain_metadata rejects an empty namespace object', () => {
  assert.throws(
    () => validateTaskData('evidence_fact_extraction', { facts: [candidate({ capability: {} })] }, { source_text: SOURCE }),
    /domain_metadata/
  );
});

test('Semantic-valid domain_metadata values remain Canonical-valid', () => {
  for (const domain_metadata of [
    {},
    { capability: { value: 'RBAC' } },
    { capability: { value: 'RBAC' }, deployment: { region: 'cn' } }
  ]) {
    const value = candidate(domain_metadata);
    assert.doesNotThrow(() => validateTaskData('evidence_fact_extraction', { facts: [value] }, { source_text: SOURCE }));
    const fact = createEvidenceFactContract(context, canonicalCandidate(value), { extractorVersion: 'domain-metadata-test-v1' });
    assert.deepEqual(fact.domain_metadata, domain_metadata);
  }
});

test('invalid semantic metadata fails before Canonical Fact persistence', async () => {
  let writes = 0;
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => ({
        ...context,
        review_status: 'approved',
        evidence_review_contract_version: 'evidence-review-v1',
        evidence_capability: 'capable',
        support_level: 'full_support',
        material_type: 'project_case'
      }),
      upsertEvidenceSourceFact: async () => { writes += 1; }
    },
    projectAuthorizationService: { assertProjectAccess: async () => {} },
    extractor: new SemanticGatewayEvidenceFactExtractor({
      client: {
        run: async () => ({ envelope: { data: { facts: [candidate({ capability: 'RBAC' })] } } })
      }
    })
  });

  await assert.rejects(
    () => service.extract({
      projectId: context.project_id,
      reviewId: context.review_id,
      actor: { actor_id: 'domain-metadata-test' }
    }),
    error => error.code === 'FACT_SEMANTIC_SCHEMA_INVALID'
  );
  assert.equal(writes, 0);
});
