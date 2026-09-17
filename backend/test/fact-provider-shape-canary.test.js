import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStandaloneGatewayServer } from '../../services/semantic-gateway/src/gateway.js';
import { validateTaskData } from '../../packages/semantic-contracts/index.js';
import { SemanticGatewayClient } from '../src/pipeline/semantic-gateway-client.js';
import { FACT_PROVIDER_AUDIT, SemanticGatewayEvidenceFactExtractor } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { FACT_PROVIDER_SHAPE_CANARY_FIXTURES } from '../eval/rag-pilot/fact-provider-shape-canary-fixtures.js';

const SOURCE = 'Synthetic source span for shape canary.';
const HASH = createHash('sha256').update(SOURCE).digest('hex');
const CONTEXT = {
  review_id: 'EREVIEW-FACT-SHAPE-CANARY-1',
  project_id: '33333333-3333-4333-8333-333333333333',
  source_span_id: 'ESPAN-FACT-SHAPE-CANARY-1',
  material_id: '44444444-4444-4444-8444-444444444444',
  anchor_chunk_id: 'MCH-FACT-SHAPE-CANARY-1',
  source_text: SOURCE,
  source_text_hash: HASH,
  current_source_text_hash: HASH,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable',
  support_level: 'full_support',
  material_type: 'project_case'
};

test('anonymized Provider empty domain namespace is normalized at Gateway boundary', async () => {
  const providerOutput = FACT_PROVIDER_SHAPE_CANARY_FIXTURES.invalid_empty_domain_metadata;
  const gateway = createStandaloneGatewayServer({
    config: {
      apiKey: 'shape-canary-key',
      providerName: 'mock',
      provider: {
        model: 'shape-canary-fixture',
        async invoke() { return { data: providerOutput }; }
      }
    }
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const client = new SemanticGatewayClient({
    apiBase: `http://127.0.0.1:${gateway.address().port}`,
    apiKey: 'shape-canary-key',
    user: 'shape-canary-test',
    timeoutMs: 5000,
    configuredTaskType: 'evidence_fact_extraction',
    fetchImpl: fetch
  });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const facts = await extractor.extract(CONTEXT);
  assert.equal(facts.length, 1);
  assert.deepEqual(facts[0].domain_metadata, {});
  assert.equal(facts[FACT_PROVIDER_AUDIT].empty_domain_namespace_normalized_count, 1);
  await new Promise((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  assert.deepEqual(providerOutput.facts[0].domain_metadata, { capability: {} });
});

test('anonymized valid empty Fact result remains a strict semantic-empty result', () => {
  const validEmpty = FACT_PROVIDER_SHAPE_CANARY_FIXTURES.valid_empty_result;
  assert.deepEqual(validateTaskData('evidence_fact_extraction', validEmpty), validEmpty);
  assert.equal(validEmpty.facts.length, 0);
});
