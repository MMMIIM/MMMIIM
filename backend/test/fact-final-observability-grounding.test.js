import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { SemanticGatewayClient } from '../src/pipeline/semantic-gateway-client.js';
import { SemanticGatewayEvidenceFactExtractor } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2
} from '../src/pipeline/evidence-fact-candidate-v2.js';

const request = {
  task_type: 'draft_sections',
  task_instruction: 'offline observability fixture',
  task_payload_json: '{}'
};

const audit = (overrides = {}) => ({
  provider: 'deepseek_official',
  model: 'deepseek-v4-pro',
  configured_provider: 'deepseek_official',
  configured_model: 'deepseek-v4-pro',
  requested_provider: 'deepseek_official',
  requested_model: 'deepseek-v4-pro',
  response_provider: null,
  response_model: 'deepseek-v4-pro',
  endpoint: '/responses',
  provider_adapter_invoked: true,
  fetch_invoked: true,
  provider_http_reached: true,
  provider_http_status: 200,
  gateway_http_status: 200,
  latency_ms: 7,
  json_parse_success: true,
  finish_reason: 'stop',
  ...overrides
});

function gatewayResponse({ status = 200, envelope = null, errorCode = null, diagnostics = audit() } = {}) {
  const payload = errorCode
    ? { error_code: errorCode, request_id: 'offline-gateway-fixture', probe_diagnostics: diagnostics }
    : {
      data: { outputs: { response_payload_json: JSON.stringify(envelope || {
        schema_version: '4.3-gateway', task_type: 'draft_sections', status: 'success', data: { sections: [] }, warnings: []
      }) } },
      probe_diagnostics: diagnostics
    };
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

const contextSourceText = '产品：数据交换平台。支持 50 并发用户。';
const contextSourceHash = createHash('sha256').update(contextSourceText).digest('hex');
const sourceContext = {
  review_id: 'EREVIEW-OFFLINE-1',
  project_id: 'PROJECT-OFFLINE-1',
  source_span_id: 'SPAN-OFFLINE-1',
  material_id: 'MATERIAL-OFFLINE-1',
  anchor_chunk_id: 'CHUNK-OFFLINE-1',
  source_text: contextSourceText,
  source_text_hash: contextSourceHash,
  current_source_text_hash: contextSourceHash,
  review_status: 'approved',
  evidence_review_contract_version: 'evidence-review-v1',
  material_type: 'project_case'
};

const validFact = {
  subject_type: 'product', subject_name: '数据交换平台', entities: [], status: 'unknown', status_source_text: null,
  scopes: [], quantities: [{ metric: 'concurrency', value: '50', unit: 'user', source_text: '支持 50 并发用户。' }],
  validity: { status: 'unknown', valid_from: null, valid_until: null }, domain_metadata: {}
};

test('offline Provider audit projection covers success, HTTP, schema, semantic-empty and candidate-success shapes', async () => {
  const fetchCalls = [];
  const client = new SemanticGatewayClient({
    apiBase: 'http://offline-gateway.invalid', apiKey: 'test-only', user: 'offline-test',
    fetchImpl: async (_url, options) => {
      fetchCalls.push(options.body);
      return gatewayResponse();
    }
  });
  const success = await client.run(request, { diagnosticMode: 'probe-v1' });
  assert.equal(success.audit.probe_diagnostics.requested_model, 'deepseek-v4-pro');
  assert.equal(success.audit.probe_diagnostics.endpoint, '/responses');
  assert.equal(success.audit.probe_diagnostics.provider_http_reached, true);

  const httpClient = new SemanticGatewayClient({
    apiBase: 'http://offline-gateway.invalid', apiKey: 'test-only', user: 'offline-test',
    fetchImpl: async () => gatewayResponse({ status: 502, errorCode: 'PROVIDER_HTTP_FAILURE', diagnostics: audit({ provider_http_status: 503, gateway_http_status: 502 }) })
  });
  await assert.rejects(() => httpClient.run(request, { diagnosticMode: 'probe-v1' }), error => {
    assert.equal(error.audit.probe_diagnostics.provider_http_status, 503);
    assert.equal(error.audit.probe_diagnostics.gateway_http_status, 502);
    return error.code === 'PROVIDER_HTTP_FAILURE';
  });

  const schemaClient = new SemanticGatewayClient({
    apiBase: 'http://offline-gateway.invalid', apiKey: 'test-only', user: 'offline-test',
    fetchImpl: async () => gatewayResponse({ status: 422, errorCode: 'OUTPUT_SCHEMA_INVALID', diagnostics: audit({ gateway_http_status: 422, provider_http_status: 200, schema_validation_errors: [{ path: 'data.facts[0]', keyword: 'required' }] }) })
  });
  await assert.rejects(() => schemaClient.run(request, { diagnosticMode: 'probe-v1' }), error => {
    assert.equal(error.audit.probe_diagnostics.provider_http_status, 200);
    assert.equal(error.audit.probe_diagnostics.gateway_http_status, 422);
    return error.code === 'OUTPUT_SCHEMA_INVALID';
  });

  const emptyExtractor = new SemanticGatewayEvidenceFactExtractor({
    client: { run: async () => ({ envelope: { data: { facts: [] } }, audit: { probe_diagnostics: audit() } }) }
  });
  await assert.rejects(() => emptyExtractor.extract(sourceContext), error => {
    assert.equal(error.code, 'FACT_SEMANTIC_EMPTY');
    assert.equal(error.details.provider_audit.requested_model, 'deepseek-v4-pro');
    return true;
  });

  const successExtractor = new SemanticGatewayEvidenceFactExtractor({
    client: { run: async () => ({ envelope: { data: { facts: [validFact] } }, audit: { probe_diagnostics: audit() } }) }
  });
  const facts = await successExtractor.extract(sourceContext);
  assert.equal(facts.length, 1);
  assert.equal(facts.provider_audit, undefined);
  assert.equal(fetchCalls.length, 1);
});

function provenance(text) {
  return { source_text: text, source_refs: ['offline://bounded-window'] };
}

function boundedCandidate({ statement, source_text = statement, subject_name, status_text = null, entity = null, scope = null, quantities = [] }) {
  return {
    statement, subject_name, subject_type_hint: 'offline',
    entity_mentions: entity ? [{ value: entity, type_hint: 'entity', provenance: provenance(source_text) }] : [],
    status_text,
    scope_items: scope ? [{ value: scope, provenance: provenance(source_text) }] : [],
    quantity_items: quantities.map(item => ({ ...item, condition_text: item.condition_text || null, provenance: provenance(source_text) })),
    temporal_items: []
  };
}

test('bounded observation framing accepts same-unit heading/connective additions and rejects cross-unit composition', () => {
  const cases = [
    {
      source: '性能与容量测试报告 / 环境\nSynthetic TEST：4 vCPU、16GB RAM、版本v3.2。',
      candidate: boundedCandidate({
        source_text: '性能与容量测试报告 / 环境\nSynthetic TEST：4 vCPU、16GB RAM、版本v3.2。',
        statement: 'Synthetic TEST 环境配置为 4 vCPU、16GB RAM、版本 v3.2。', subject_name: 'Synthetic TEST',
        quantities: [
          { name: 'vCPU', value_text: '4', unit_text: 'vCPU', condition_text: '' },
          { name: 'RAM', value_text: '16', unit_text: 'GB', condition_text: '' }
        ]
      })
    },
    {
      source: '性能与容量测试报告 / 时效\n2026-11-30后标记STALE_PENDING_RETEST。',
      candidate: boundedCandidate({
        source_text: '性能与容量测试报告 / 时效\n2026-11-30后标记STALE_PENDING_RETEST。',
        statement: '性能与容量测试报告在2026-11-30后被标记为STALE_PENDING_RETEST。', subject_name: '性能与容量测试报告', status_text: 'STALE_PENDING_RETEST'
      })
    },
    {
      source: '备份恢复与容灾演练记录 / 边界\n未形成真实客户RTO/RPO或可用率承诺。',
      candidate: boundedCandidate({
        source_text: '备份恢复与容灾演练记录 / 边界\n未形成真实客户RTO/RPO或可用率承诺。',
        statement: '备份恢复与容灾演练记录中未形成真实客户RTO/RPO或可用率承诺。', subject_name: '备份恢复与容灾演练记录', scope: '真实客户RTO/RPO或可用率承诺'
      })
    }
  ];
  for (const { source, candidate } of cases) {
    const canonical = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText: source });
    const grounding = groundCanonicalEvidenceFactCandidateV2(canonical, { sourceText: source, resolvedSourceUnit: { text: source, heading_path: [] } });
    assert.notEqual(grounding.decision, 'REJECT', grounding.reasons?.join('|'));
    assert.equal(grounding.source_grounding.mode, 'BOUNDED_COMPOSITIONAL');
  }

  const crossUnit = boundedCandidate({
    statement: '澄川数智科技有限公司为虚构测试企业，定位政企与医疗信息化软件服务商。',
    subject_name: '澄川数智科技有限公司', status_text: '虚构测试企业', scope: '政企与医疗信息化软件服务商'
  });
  const crossCanonical = canonicalizeEvidenceFactCandidateV2(crossUnit, {
    sourceText: '澄川数智科技有限公司为虚构测试企业。\n\n定位政企与医疗信息化软件服务商。'
  });
  const crossGrounding = groundCanonicalEvidenceFactCandidateV2(crossCanonical, {
    sourceText: '澄川数智科技有限公司为虚构测试企业。\n\n定位政企与医疗信息化软件服务商。'
  });
  assert.equal(crossGrounding.decision, 'REJECT');
});
