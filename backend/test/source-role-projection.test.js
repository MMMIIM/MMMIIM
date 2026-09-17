import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classifySourceRole,
  classifyChunk,
  renderRequirements,
  parityForRequirements
} from '../eval/gold-human-review/v2/mapping-real-rebuild/build-source-universes.js';

function material(overrides = {}) {
  return {
    id: 'm-1', project_id: 'p-1', project_name: 'Enterprise project', project_status: 'active',
    original_name: 'enterprise.md', material_type: 'project_case', corpus_scope: 'ENTERPRISE_PRIVATE',
    source_type: 'enterprise_case', source_org: 'Example Corp', source_url: 'https://example.test/source',
    authority_level: 'enterprise_private', file_hash: 'file-hash', synthetic_test_material: false,
    lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT',
    extraction_status: 'succeeded', effective_status: 'CURRENT', ...overrides
  };
}

test('formal quarantine wins over every other source attribute', () => {
  assert.deepEqual(classifySourceRole(material({ lifecycle_status: 'QUARANTINED', synthetic_test_material: true }), null), {
    role: 'QUARANTINED', reasons: ['formal_lifecycle_quarantine']
  });
});

test('explicit synthetic enterprise evidence cannot be promoted by private scope', () => {
  const result = classifySourceRole(material({ source_type: 'synthetic_company_evidence', synthetic_test_material: true }), null);
  assert.equal(result.role, 'SYNTHETIC_ENTERPRISE_EVIDENCE');
});

test('official source authority is reference context, never enterprise evidence', () => {
  const result = classifySourceRole(material({ corpus_scope: 'GOVERNMENT_ENTERPRISE', authority_level: 'official', source_type: 'government_guidance' }), null);
  assert.equal(result.role, 'REFERENCE_CONTEXT_ONLY');
});

test('complete enterprise provenance is eligible for real enterprise source review', () => {
  assert.equal(classifySourceRole(material(), null).role, 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE');
});

test('missing enterprise provenance fails closed to unknown review', () => {
  const result = classifySourceRole(material({ source_type: null, source_org: null, source_url: null, file_hash: null }), null);
  assert.equal(result.role, 'UNKNOWN_REVIEW_REQUIRED');
  assert.ok(result.reasons.includes('source_type'));
  assert.ok(result.reasons.includes('source_provenance'));
});

test('chunk hygiene excludes headers and metadata while retaining substantive text', () => {
  const header = classifyChunk({ chunk_id: 'h', chunk_index: 0, chunk_hash: 'h', source_text: '# Heading' });
  const marker = classifyChunk({ chunk_id: 'm', chunk_index: 1, chunk_hash: 'm', source_text: '> **Synthetic Company Evidence**：仅用于测试。' });
  const body = classifyChunk({ chunk_id: 'b', chunk_index: 2, chunk_hash: 'b', source_text: '项目完成了接口联调，并在验收环境记录了响应时间与测试结果。' });
  assert.equal(header.substantive, false);
  assert.equal(marker.substantive, false);
  assert.equal(body.substantive, true);
});

test('requirement rendering parity is identity based and fail-closed on omission', () => {
  const packet = {
    requirements: [{
      requirement_id: 'REQ-1', requirement_db_id: 'db-1', project_id: 'p-1', project_name: 'Tender',
      tender_file_name: 'tender.pdf', category: 'technical', mandatory: true, source_status: 'verified',
      source_verified: true, baseline_status: 'confirmed', domain: null,
      text: '系统应支持接口集成。',
      source_reference: { source_hash: 'hash-1', source_chunk_id: 'chunk-1', page_start: 1, page_end: 1,
        paragraph_start: 1, paragraph_end: 1, source_excerpt: '系统应支持接口集成。' }
    }], tender_count: 1
  };
  const markdown = renderRequirements(packet);
  assert.equal(parityForRequirements(packet, markdown).ok, true);
  assert.equal(parityForRequirements(packet, markdown.replace('hash-1', 'omitted')).ok, false);
});

test('generated source universes preserve role boundaries and remain blind', () => {
  const dir = 'backend/eval/gold-human-review/v2/mapping-real-rebuild';
  const projection = JSON.parse(fs.readFileSync(`${dir}/00_source_role_projection.json`, 'utf8'));
  const requirements = JSON.parse(fs.readFileSync(`${dir}/01_real_requirement_source_universe.json`, 'utf8'));
  const enterprise = JSON.parse(fs.readFileSync(`${dir}/02_real_enterprise_evidence_source_universe.json`, 'utf8'));
  assert.equal(Object.values(projection.role_counts).reduce((a, b) => a + b, 0), projection.materials.length);
  assert.ok(projection.role_counts.QUARANTINED > 0);
  assert.ok(projection.role_counts.SYNTHETIC_ENTERPRISE_EVIDENCE > 0);
  assert.ok(projection.role_counts.REFERENCE_CONTEXT_ONLY > 0);
  const enterpriseIds = new Set(enterprise.materials.map(item => item.material_id));
  assert.equal(projection.materials.filter(item => item.derived_source_role === 'QUARANTINED' && enterpriseIds.has(item.material_id)).length, 0);
  assert.equal(projection.materials.filter(item => item.derived_source_role === 'SYNTHETIC_ENTERPRISE_EVIDENCE' && enterpriseIds.has(item.material_id)).length, 0);
  assert.ok(requirements.requirements.length > 0);
  const blindText = [
    fs.readFileSync(`${dir}/01_real_requirement_source_universe.json`, 'utf8'),
    fs.readFileSync(`${dir}/01_real_requirement_source_universe.md`, 'utf8'),
    fs.readFileSync(`${dir}/02_real_enterprise_evidence_source_universe.json`, 'utf8'),
    fs.readFileSync(`${dir}/02_real_enterprise_evidence_source_universe.md`, 'utf8')
  ].join('\n').toLowerCase();
  for (const token of ['expected_decision', 'provider_result', 'writer_authorization', 'suggested_mapping', 'claim_decision', 'gold_label']) {
    assert.equal(blindText.includes(token), false, `blind packet leaked ${token}`);
  }
});
