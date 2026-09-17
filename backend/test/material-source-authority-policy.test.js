import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthorityEligible,
  isEvidenceSourceEligible,
  isRetrievalEligible,
  materialAuthorityStatus
} from '../src/pipeline/material-source-authority-policy.js';
import { CompanyMaterialService } from '../src/company-material-service.js';
import { buildSectionContext } from '../src/pipeline/section-context-builder.js';
import { PgRepository } from '../src/db.js';

const active = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  lifecycle_status: 'ACTIVE',
  review_status: 'approved',
  usage_status: 'ACTIVE_FULLTEXT',
  extraction_status: 'succeeded',
  corpus_scope: 'ENTERPRISE_PRIVATE',
  index_status: 'NOT_INDEXED',
  ...overrides
});

test('material authority is one fail-closed lifecycle gate', () => {
  assert.equal(isEvidenceSourceEligible(active()), true);
  assert.equal(isAuthorityEligible(active()), true);
  assert.equal(isRetrievalEligible(active()), true);
  assert.equal(isAuthorityEligible(active({ lifecycle_status: 'QUARANTINED' })), false);
  assert.equal(isAuthorityEligible(active({ review_status: 'pending' })), false);
  assert.equal(isAuthorityEligible(active({ usage_status: 'REFERENCE_ONLY' })), false);
  assert.equal(isAuthorityEligible(active({ extraction_status: 'pending' })), false);
  assert.equal(isAuthorityEligible(active({ corpus_scope: '' })), false);
  assert.equal(isAuthorityEligible(null), false);
  assert.equal(materialAuthorityStatus({ ...active(), id: '' }).reason, 'MATERIAL_MISSING');
});

test('public retrieval additionally requires an indexed material', () => {
  const material = active({ corpus_scope: 'GOVERNMENT_ENTERPRISE', index_status: 'NOT_INDEXED' });
  assert.equal(isEvidenceSourceEligible(material), true);
  assert.equal(isRetrievalEligible(material), false);
  assert.equal(isRetrievalEligible({ ...material, index_status: 'INDEXED' }), true);
});

test('quarantine is owned by CompanyMaterialService and preserves selected history', async () => {
  const calls = [];
  const materials = [
    { id: active().id, original_name: 'demo.md' },
    { id: '22222222-2222-4222-8222-222222222222', original_name: 'other.md' }
  ];
  const repository = {
    listAllCompanyMaterials: async () => materials,
    getCompanyMaterial: async id => materials.find(item => item.id === id),
    quarantineCompanyMaterial: async input => { calls.push(input); return { ...materials.find(item => item.id === input.materialId), lifecycle_status: 'QUARANTINED' }; }
  };
  const service = new CompanyMaterialService({ repository });
  const result = await service.quarantineMatching({
    predicate: material => material.original_name === 'demo.md',
    reason: 'SOURCE_AUTHORITY_QUARANTINE'
  });
  assert.equal(result.materials.length, 1);
  assert.deepEqual(calls, [{ materialId: materials[0].id, reason: 'SOURCE_AUTHORITY_QUARANTINE' }]);
});

test('section context never exposes a claim marked non-current by source authority', () => {
  const context = buildSectionContext({
    project: { id: 'project-1' },
    section: { section_id: 'chapter-1', requirement_ids: [] },
    claims: [{
      claim_id: 'CLM-QUARANTINED', text: 'enterprise assertion', claim_type: 'evidence_support',
      target_sections: ['chapter-1'], decision: 'approved', current: false,
      writer_eligible: false
    }]
  });
  assert.deepEqual(context.approved_claims, []);
  assert.deepEqual(context.authorized_enterprise_claims, []);
});

test('authority projections use batched SQL reads rather than per-claim lookups', async () => {
  const calls = [];
  const repository = new PgRepository({
    query: async (...args) => {
      calls.push(args[0]);
      return { rows: [] };
    }
  });
  await repository.listClaims('project-1');
  await repository.listEnterpriseEvidenceBindings('project-1');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /LATERAL/);
  assert.match(calls[1], /source_material_authority_eligible/);
});
