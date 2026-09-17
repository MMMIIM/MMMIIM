import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSemanticTaskRouter, normalizeEvidenceFactDomainMetadata } from '../src/task-router.js';
import { validateTaskData } from '../../../packages/semantic-contracts/index.js';
import { createEvidenceFactContract } from '../../../backend/src/pipeline/evidence-fact-contract-v1.js';

const SOURCE = '平台提供服务。';
const SOURCE_HASH = createHash('sha256').update(SOURCE).digest('hex');
const CONTEXT = {
  project_id: 'project-domain-normalization',
  review_id: 'review-domain-normalization',
  source_span_id: 'span-domain-normalization',
  material_id: 'material-domain-normalization',
  anchor_chunk_id: 'chunk-domain-normalization',
  source_text: SOURCE,
  source_text_hash: SOURCE_HASH
};

const fact = (domain_metadata) => ({
  subject_type: 'product',
  subject_name: '平台',
  entities: [],
  status: 'unknown',
  scopes: [],
  quantities: [],
  validity: { status: 'unknown', valid_from: null, valid_until: null },
  domain_metadata
});

const dispatch = async (domain_metadata) => {
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        return { data: { facts: [fact(domain_metadata)] }, provider_audit: {} };
      }
    }
  });
  return router.dispatch({ taskType: 'evidence_fact_extraction', payload: {} });
};

function canonicalFact(data) {
  const candidate = data.facts[0];
  return createEvidenceFactContract(CONTEXT, {
    subject: { type: candidate.subject_type, name: candidate.subject_name },
    entities: candidate.entities,
    status: candidate.status,
    scopes: candidate.scopes,
    quantities: candidate.quantities,
    validity: candidate.validity,
    domain_metadata: candidate.domain_metadata
  }, { extractorVersion: 'domain-normalization-test-v1' });
}

test('empty namespace normalization is bounded and does not mutate provider data', () => {
  const providerData = { facts: [fact({ capability: {}, security: {} })] };
  const normalized = normalizeEvidenceFactDomainMetadata(providerData);
  assert.deepEqual(normalized.data.facts[0].domain_metadata, {});
  assert.equal(normalized.empty_namespace_count, 2);
  assert.deepEqual(providerData.facts[0].domain_metadata, { capability: {}, security: {} });
});

test('empty root metadata passes and empty namespaces normalize before strict validation', async () => {
  const emptyRoot = await dispatch({});
  assert.deepEqual(emptyRoot.data.facts[0].domain_metadata, {});

  const emptyNamespace = await dispatch({ capability: {} });
  assert.deepEqual(emptyNamespace.data.facts[0].domain_metadata, {});
  assert.equal(emptyNamespace.provider_audit.empty_domain_namespace_normalized_count, 1);
});

test('mixed metadata removes only empty namespaces and preserves non-empty values exactly', async () => {
  const input = {
    capability: {},
    security: { level: '三级' },
    deployment: { region: 'cn' }
  };
  const result = await dispatch(input);
  assert.deepEqual(result.data.facts[0].domain_metadata, {
    security: { level: '三级' },
    deployment: { region: 'cn' }
  });
  assert.equal(result.provider_audit.empty_domain_namespace_normalized_count, 1);
  assert.equal(result.provider_audit.fact_normalization_diagnostic.normalizer_invoked, true);
  assert.equal(result.provider_audit.fact_normalization_diagnostic.projection_invoked, true);
  assert.deepEqual(result.provider_audit.fact_normalization_diagnostic.pre_normalization_fact_keys[0], [
    'domain_metadata', 'entities', 'quantities', 'scopes', 'status', 'subject_name', 'subject_type', 'validity'
  ]);
  assert.deepEqual(result.provider_audit.fact_normalization_diagnostic.post_normalization_fact_keys[0], [
    'domain_metadata', 'entities', 'quantities', 'scopes', 'status', 'subject_name', 'subject_type', 'validity'
  ]);
  assert.deepEqual(result.provider_audit.fact_normalization_diagnostic.removed_property_names, ['capability']);
});

test('unknown Fact fields are reported with canonical key inventory without being removed', async () => {
  await assert.rejects(
    () => createSemanticTaskRouter({
      provider: {
        async invoke() {
          return {
            data: { facts: [{ ...fact({ capability: { value: 'RBAC' } }), explanation: 'non-authoritative' }] },
            provider_audit: {}
          };
        }
      }
    }).dispatch({ taskType: 'evidence_fact_extraction', payload: {} }),
    error => error.provider_audit.fact_normalization_diagnostic.normalizer_invoked === true
      && error.provider_audit.fact_normalization_diagnostic.projection_invoked === true
      && error.provider_audit.fact_normalization_diagnostic.pre_normalization_fact_keys[0].includes('domain_metadata')
      && error.provider_audit.fact_normalization_diagnostic.post_normalization_fact_keys[0].includes('domain_metadata')
      && error.provider_audit.fact_normalization_diagnostic.unexpected_property_names.includes('explanation')
  );
});

test('normalized and already-empty metadata produce stable Fact payload hash and fact id', async () => {
  const normalized = await dispatch({ capability: {} });
  const alreadyEmpty = await dispatch({});
  const first = canonicalFact(normalized.data);
  const second = canonicalFact(alreadyEmpty.data);
  assert.equal(first.payload_hash, second.payload_hash);
  assert.equal(first.fact_id, second.fact_id);
});

test('non-empty namespace content remains Canonical-valid without normalization', async () => {
  const result = await dispatch({ capability: { value: 'RBAC' } });
  assert.deepEqual(result.data.facts[0].domain_metadata, { capability: { value: 'RBAC' } });
  assert.equal(result.provider_audit.empty_domain_namespace_normalized_count, 0);
  assert.doesNotThrow(() => validateTaskData('evidence_fact_extraction', result.data));
});

test('malformed namespace values and invalid namespace names still fail closed', async () => {
  for (const domain_metadata of [
    { capability: null },
    { capability: 'x' },
    { capability: [] },
    { 'invalid-name': {} },
    []
  ]) {
    await assert.rejects(
      () => dispatch(domain_metadata),
      error => error.code === 'OUTPUT_SCHEMA_INVALID'
        && error.validation_diagnostics?.some(item => item.path === 'data.facts[0].domain_metadata')
    );
  }
});
