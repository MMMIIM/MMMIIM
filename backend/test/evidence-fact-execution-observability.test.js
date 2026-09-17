import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { SemanticGatewayEvidenceFactExtractor } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const REVIEW = 'EREVIEW-FACT-OBSERVABILITY-1';
const SOURCE = 'Synthetic product Alpha provides 50 concurrent users.';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const context = {
  review_id: REVIEW,
  project_id: PROJECT,
  source_span_id: 'ESPAN-FACT-OBS-1',
  material_id: '22222222-2222-4222-8222-222222222222',
  anchor_chunk_id: 'MCH-FACT-OBS-1',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH,
  current_source_text_hash: SOURCE_HASH,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable',
  support_level: 'full_support',
  material_type: 'project_case'
};
const input = { projectId: PROJECT, reviewId: REVIEW, actor: { actor_id: 'fact-observer', actor_type: 'test' } };
const authorization = { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) };
const candidate = {
  subject_type: 'product',
  subject_name: 'Synthetic product Alpha',
  entities: [],
  status: 'unknown',
  scopes: [],
  quantities: [{ metric: 'concurrency', value: '50', unit: 'user', source_text: 'provides 50 concurrent users' }],
  validity: { status: 'unknown', valid_from: null, valid_until: null },
  domain_metadata: {}
};

function serviceWithExtractor(extractor) {
  return new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => context,
      upsertEvidenceSourceFactsAtomic: async facts => facts
    },
    projectAuthorizationService: authorization,
    extractor
  });
}

async function capture(run) {
  try {
    return { ok: true, result: await run() };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error.code,
        details: error.details || null
      }
    };
  }
}

test('successful Fact extraction preserves safe provider execution evidence for the runner', async () => {
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run() {
        return {
          envelope: { data: { facts: [candidate] } },
          audit: {
            probe_diagnostics: {
              provider_adapter_invoked: true,
              fetch_invoked: true,
              provider_http_reached: true,
              gateway_http_status: 200,
              provider_http_status: 200,
              finish_reason: 'stop',
              prompt_tokens: 12,
              completion_tokens: 7,
              output_truncated: false
            }
          }
        };
      }
    }
  });
  const observed = await capture(() => serviceWithExtractor(extractor).extract(input));
  assert.equal(observed.ok, true);
  assert.equal(observed.result.facts.length, 1);
  assert.equal(observed.result.provider_audit.provider_http_reached, true);
  assert.equal(observed.result.provider_audit.gateway_http_status, 200);
  assert.equal(observed.result.provider_audit.provider_http_status, 200);
  assert.equal(observed.result.provider_audit.finish_reason, 'stop');
  assert.equal(Object.hasOwn(observed.result.provider_audit, 'model_content'), false);
});

test('lower-layer execution failure reaches the runner with stage, boundary, and cause', async () => {
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run() {
        throw Object.assign(new Error('synthetic provider failure'), {
          code: 'GATEWAY_NETWORK_ERROR',
          audit: {
            probe_diagnostics: {
              provider_adapter_invoked: false,
              fetch_invoked: false,
              provider_http_reached: false,
              safe_error_code: 'FETCH_FAILED'
            }
          }
        });
      }
    }
  });
  const observed = await capture(() => serviceWithExtractor(extractor).extract(input));
  assert.equal(observed.ok, false);
  assert.equal(observed.error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
  assert.equal(observed.error.details.stage, 'FACT');
  assert.match(observed.error.details.boundary, /SemanticGatewayEvidenceFactExtractor/);
  assert.equal(observed.error.details.cause_code, 'GATEWAY_NETWORK_ERROR');
  assert.equal(observed.error.details.provider_invocation, 'PROVIDER_NOT_INVOKED');
  assert.equal(observed.error.details.provider_audit.provider_http_reached, false);
  assert.notEqual(observed.error.code, 'FACT_SEMANTIC_EMPTY');
});

test('valid empty semantic output remains distinguishable from execution failure', async () => {
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { async run() { return { envelope: { data: { facts: [] } } }; } }
  });
  const observed = await capture(() => serviceWithExtractor(extractor).extract(input));
  assert.equal(observed.ok, false);
  assert.equal(observed.error.code, 'FACT_SEMANTIC_EMPTY');
  assert.equal(observed.error.details.stage, 'FACT');
  assert.notEqual(observed.error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
});

test('Fact API entry point exposes only safe execution diagnostics', async () => {
  const app = createApp({
    repository: { getEvidenceReviewProject: async () => ({ project_id: PROJECT }) },
    evidenceSourceFactService: {
      async extract() {
        const error = new Error('provider details must not leak');
        error.code = 'FACT_SEMANTIC_EXTRACTION_FAILED';
        error.status = 502;
        error.details = {
          stage: 'FACT',
          boundary: 'SemanticGatewayEvidenceFactExtractor -> SemanticGatewayClient',
          cause_code: 'GATEWAY_NETWORK_ERROR',
          provider_audit: {
            provider_http_reached: false,
            provider_http_status: null,
            safe_error_code: 'FETCH_FAILED',
            model_content: 'MUST_NOT_LEAK'
          }
        };
        throw error;
      }
    },
    actorResolver: () => ({ actor_id: 'fact-observer', actor_type: 'test', source: 'test' })
  });
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/evidence-reviews/${REVIEW}/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error.code, 'FACT_SEMANTIC_EXTRACTION_FAILED');
    assert.equal(body.error.diagnostic.stage, 'FACT');
    assert.equal(body.error.diagnostic.cause_code, 'GATEWAY_NETWORK_ERROR');
    assert.equal(body.error.diagnostic.provider_audit.provider_http_reached, false);
    assert.equal(Object.hasOwn(body.error.diagnostic.provider_audit, 'model_content'), false);
    assert.equal(JSON.stringify(body).includes('MUST_NOT_LEAK'), false);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
