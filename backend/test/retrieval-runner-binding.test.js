import test from 'node:test';
import assert from 'node:assert/strict';
import {
  databaseNameFromUrl,
  preserveHostDatabaseUrl,
  selectAuthorizedMaterialChunks
} from '../eval/real-e2e/retrieval-runner-utils.mjs';

test('retrieval runner preserves an explicitly supplied Host DATABASE_URL', () => {
  const env = preserveHostDatabaseUrl({
    hostDatabaseUrl: 'postgresql://host-user:host-pass@127.0.0.1:5432/bid_platform_flow_audit_test',
    runtimeEnv: { DATABASE_URL: 'postgresql://file-user:file-pass@127.0.0.1:5432/bid_platform' }
  });
  assert.equal(databaseNameFromUrl(env.DATABASE_URL), 'bid_platform_flow_audit_test');
});

test('authorized material discovery keeps distinct same-project and bound material IDs', () => {
  const rows = [
    { material_id: 'owner-hw-001', original_name: 'HW-001.pdf' },
    { material_id: 'owner-hw-001', original_name: 'HW-001.pdf' },
    { material_id: 'owner-hw-002', original_name: 'HW-002.pdf' },
    { material_id: 'unrelated', original_name: 'OTHER.pdf' }
  ];
  const result = selectAuthorizedMaterialChunks(rows, 'HW-');
  assert.deepEqual(result.materialIds, ['owner-hw-001', 'owner-hw-002']);
  assert.equal(result.chunks.length, 3);
  assert.equal(new Set(result.chunks.map(row => row.material_id)).size, 2);
});

test('unbound or removed material rows remain denied when canonical authorization returns no rows', () => {
  const result = selectAuthorizedMaterialChunks([], 'HW-');
  assert.deepEqual(result.materialIds, []);
  assert.deepEqual(result.chunks, []);
});

test('material selector does not create material, chunk, or embedding copies', () => {
  const source = { material_id: 'owner-hw-001', original_name: 'HW-001.pdf', chunk_id: 'chunk-1' };
  const result = selectAuthorizedMaterialChunks([source], 'HW-');
  assert.equal(result.materialIds.length, 1);
  assert.equal(result.chunks[0], source);
});
