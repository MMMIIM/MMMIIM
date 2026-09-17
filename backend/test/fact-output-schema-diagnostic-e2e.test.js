import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStandaloneGatewayServer } from '../../services/semantic-gateway/src/gateway.js';
import { SemanticGatewayClient } from '../src/pipeline/semantic-gateway-client.js';
import { SemanticGatewayEvidenceFactExtractor } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { createApp } from '../src/app.js';

const PROJECT = '33333333-3333-4333-8333-333333333333';
const REVIEW = 'EREVIEW-FACT-DIAGNOSTIC-E2E-1';
const SOURCE = 'Synthetic product Alpha provides 50 concurrent users.';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const context = {
  review_id: REVIEW,
  project_id: PROJECT,
  source_span_id: 'ESPAN-FACT-DIAGNOSTIC-E2E-1',
  material_id: '44444444-4444-4444-8444-444444444444',
  anchor_chunk_id: 'MCH-FACT-DIAGNOSTIC-E2E-1',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH,
  current_source_text_hash: SOURCE_HASH,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable',
  support_level: 'full_support',
  material_type: 'project_case'
};

function factGatewayProvider() {
  return {
    model: 'fixture-fact-diagnostic',
    async invoke() {
      return {
        data: {
          facts: [{
            subject_type: 'product',
            subject_name: '平台',
            entities: '平台',
            status: 'unknown',
            scopes: [],
            quantities: [],
            validity: { status: 'unknown' },
            domain_metadata: {}
          }]
        },
        provider_audit: { http_status: 200, provider_http_reached: true, json_parse_success: true }
      };
    }
  };
}

test('Fact schema diagnostics survive Gateway HTTP, Client, Extractor, Service, and API boundaries', async () => {
  const gateway = createStandaloneGatewayServer({
    config: { apiKey: 'diagnostic-key', providerName: 'mock', provider: factGatewayProvider() }
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const gatewayPort = gateway.address().port;
  const client = new SemanticGatewayClient({
    apiBase: `http://127.0.0.1:${gatewayPort}`,
    apiKey: 'diagnostic-key',
    user: 'diagnostic-test',
    timeoutMs: 5000,
    configuredTaskType: 'evidence_fact_extraction',
    fetchImpl: fetch
  });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      upsertEvidenceSourceFact: async () => assert.fail('invalid output must not persist')
    },
    projectAuthorizationService: { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) },
    extractor
  });
  const app = createApp({
    repository: { getEvidenceReviewProject: async () => ({ project_id: PROJECT }) },
    evidenceSourceFactService: service,
    actorResolver: () => ({ actor_id: 'diagnostic-actor', actor_type: 'test', source: 'test' })
  });
  const api = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${api.address().port}/api/evidence-reviews/${REVIEW}/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
    assert.equal(body.error.diagnostic.stage, 'FACT');
    assert.equal(body.error.diagnostic.cause_code, 'OUTPUT_SCHEMA_INVALID');
    assert.equal(body.error.diagnostic.schema_validation_errors[0].path, 'data.facts[0].entities');
    assert.equal(body.error.diagnostic.schema_validation_errors[0].keyword, 'type');
    assert.equal(body.error.diagnostic.schema_validation_errors[0].expected, 'array');
    assert.equal(body.error.diagnostic.schema_validation_errors[0].actual_type, 'string');
  } finally {
    await new Promise((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  }
});
