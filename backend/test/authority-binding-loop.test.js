import test from 'node:test';
import assert from 'node:assert/strict';
import { RequirementScopeAuthorityService } from '../src/requirement-scope-authority-service.js';
import { ProjectMaterialBindingService } from '../src/project-material-binding-service.js';
import { PgRepository } from '../src/db.js';

const projectId = '11111111-1111-4111-8111-111111111111';
const materialId = '22222222-2222-4222-8222-222222222222';

test('scope authority rejects invalid decisions before persistence', async () => {
  const repository = { upsertRequirementScopeAuthority: async () => assert.fail('must not persist') };
  const service = new RequirementScopeAuthorityService({ repository });
  await assert.rejects(() => service.recordDecision({ projectId, candidateIdentity: 'candidate-out-1', sourceChunkId: 'chunk-1', sourceHash: 'sha-1', sourcePageStart: 12, sourcePageEnd: 12, decision: 'OUT_SCOPE', reasonCodes: ['NON_APPLICABLE_TEMPLATE'], actor: 'human-1' }), error => error.code === 'SCOPE_AUTHORITY_DECISION_INVALID');
});

test('scope authority validates and delegates canonical identity', async () => {
  const calls = [];
  const repository = { upsertRequirementScopeAuthority: async input => { calls.push(input); return { ...input, id: 'decision-1' }; } };
  const service = new RequirementScopeAuthorityService({ repository, clock: () => '2026-09-14T00:00:00.000Z' });
  const result = await service.recordDecision({ projectId, candidateIdentity: 'candidate-out-1', sourceChunkId: 'chunk-1', sourceHash: 'sha-1', sourcePageStart: 12, sourcePageEnd: 12, decision: 'OUT_OF_SCOPE', reasonCodes: ['NON_APPLICABLE_TEMPLATE'], actor: 'human-1' });
  assert.equal(result.decision, 'OUT_OF_SCOPE');
  assert.equal(calls[0].authorityType, 'HUMAN');
  assert.equal(calls[0].confirmedAt, '2026-09-14T00:00:00.000Z');
});

test('material binding requires active authoritative enterprise material', async () => {
  const repository = { getCompanyMaterial: async () => ({ id: materialId, corpus_scope: 'ENTERPRISE_PRIVATE', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded' }), upsertProjectMaterialBinding: async input => input };
  const service = new ProjectMaterialBindingService({ repository });
  const result = await service.create({ projectId, materialId, actor: 'human-1', bindingSource: 'REAL_E2E_CASE_01' });
  assert.deepEqual(result, { projectId, materialId, bindingSource: 'REAL_E2E_CASE_01' });
});

test('material binding rejects quarantined material', async () => {
  const repository = { getCompanyMaterial: async () => ({ id: materialId, corpus_scope: 'ENTERPRISE_PRIVATE', lifecycle_status: 'QUARANTINED', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded' }) };
  const service = new ProjectMaterialBindingService({ repository });
  await assert.rejects(() => service.create({ projectId, materialId, actor: 'human-1' }), error => error.code === 'MATERIAL_NOT_AUTHORITY_ELIGIBLE');
});

test('retrieval SQL authorizes only active explicit bindings while retaining lifecycle gate', async () => {
  const calls = [];
  const repository = new PgRepository({ query: async (...args) => { calls.push(args); return { rows: [] }; } });
  await repository.listChunksForRetrieval({ projectId, materialTypes: [], materialIds: [materialId], model: 'fixture', version: 'v1', corpusScopes: ['GENERAL'] });
  assert.match(calls[0][0], /project_material_bindings/);
  assert.match(calls[0][0], /pmb\.status='ACTIVE'/);
  assert.match(calls[0][0], /lifecycle_status='ACTIVE'/);
  assert.deepEqual(calls[0][1], [projectId, [], 'fixture', 'v1', '00000000-0000-4000-8000-000000000001', ['GENERAL'], [materialId]]);
});

test('scope authority conflict is handled as fail-closed by repository', async () => {
  const existing = { project_id: projectId, candidate_identity: 'candidate-1', source_chunk_id: 'chunk-1', source_hash: 'hash-1', source_page_start: 1, source_page_end: 1, decision: 'OUT_OF_SCOPE', reason_codes: ['NON_APPLICABLE_TEMPLATE'], authority_type: 'HUMAN' };
  let first = true;
  const repository = new PgRepository({ query: async (sql) => {
    if (sql.startsWith('INSERT')) return { rows: first ? (first = false, [existing]) : [] };
    return { rows: [existing] };
  } });
  const firstValue = await repository.upsertRequirementScopeAuthority({ projectId, candidateIdentity: 'candidate-1', sourceChunkId: 'chunk-1', sourceHash: 'hash-1', sourcePageStart: 1, sourcePageEnd: 1, decision: 'OUT_OF_SCOPE', reasonCodes: ['NON_APPLICABLE_TEMPLATE'] });
  assert.equal(firstValue.candidate_identity, 'candidate-1');
  await assert.rejects(() => repository.upsertRequirementScopeAuthority({ projectId, candidateIdentity: 'candidate-1', sourceChunkId: 'chunk-1', sourceHash: 'hash-1', sourcePageStart: 1, sourcePageEnd: 1, decision: 'IN_SCOPE', reasonCodes: ['BID_FORMALITY'] }), error => error.code === 'REQUIREMENT_SCOPE_AUTHORITY_CONFLICT');
});
